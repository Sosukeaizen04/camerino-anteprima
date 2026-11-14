// Camerino — server della prova addosso (Cloudflare Worker).
// Tiene nascosta la chiave di fal.ai, accetta solo foto dell'avatar del Camerino e dei negozi (Shopify),
// ricorda le immagini già fatte (lo stesso look non si paga due volte) e mette due limiti di spesa:
// prove al giorno per persona e prove al giorno in tutto. Il saldo prepagato su fal è il tetto finale.
//
// Variabili (wrangler.toml / segreti): FAL_KEY (segreto), MODELLO, LIMITE_PERSONA, LIMITE_GIORNO, ORIGINI, BASE_AVATAR; KV: MEMORIA.

const POSTI = { capospalla: "the jacket or coat, worn open over the rest", abito: "the dress", sopra: "the top", sotto: "the trousers, jeans or skirt", scarpe: "the shoes" };

function risposta(corpo, stato, origine) {
  return new Response(JSON.stringify(corpo), { status: stato, headers: {
    "content-type": "application/json", "access-control-allow-origin": origine || "null",
    "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", vary: "origin" } });
}
async function impronta(testo) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(testo));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
function istruzioni(capi) {
  const elenco = capi.map((c, i) => `image ${i + 2}: ${POSTI[c.posto]}`).join("; ");
  return `Image 1 is a person standing on a plain white background. Dress this exact person in the garments shown in the other images (${elenco}). ` +
    `The garment photos may show other models or other clothes: take only the indicated garment from each one, keeping its exact colour, fabric, pattern, length and details. ` +
    `Replace the person's current clothes completely with these garments, nothing else: no extra accessories, bags, hats or jewellery. ` +
    `Keep the person's face, hair, skin tone, body shape, height and pose identical, full body from head to toe visible, same plain white background, same soft studio light, realistic fashion catalogue photo.`;
}

export default {
  async fetch(req, env) {
    const origini = (env.ORIGINI || "").split(",").map(s => s.trim()).filter(Boolean);
    const origine = req.headers.get("origin") || "";
    const ok = origini.includes(origine);
    if (req.method === "OPTIONS") return new Response(null, { status: ok ? 204 : 403, headers: ok ? {
      "access-control-allow-origin": origine, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "86400" } : {} });
    const url = new URL(req.url);
    if (url.pathname === "/salute") return risposta({ ok: true }, 200, ok ? origine : null);
    if (req.method !== "POST" || url.pathname !== "/prova") return risposta({ errore: "non trovato" }, 404, ok ? origine : null);
    if (!ok) return risposta({ errore: "origine non ammessa" }, 403, null);

    // --- controllo della richiesta: solo il nostro avatar e foto dei negozi, al massimo 4 capi
    let dati;
    try { dati = await req.json(); } catch { return risposta({ errore: "richiesta non valida" }, 400, origine); }
    const { avatar, capi } = dati || {};
    if (typeof avatar !== "string" || !avatar.startsWith(env.BASE_AVATAR)) return risposta({ errore: "avatar non ammesso" }, 400, origine);
    if (!Array.isArray(capi) || !capi.length || capi.length > 4) return risposta({ errore: "servono da 1 a 4 capi" }, 400, origine);
    for (const c of capi) {
      if (!POSTI[c?.posto] || typeof c.url !== "string" || !/^https:\/\/cdn\.shopify\.com\/s\/files\/[^\s"]+$/.test(c.url)) return risposta({ errore: "capo non ammesso" }, 400, origine);
    }

    // --- già fatta? si restituisce senza pagare
    const chiave = "img:" + await impronta(JSON.stringify([env.MODELLO, avatar, capi.map(c => [c.posto, c.url])]));
    const gia = await env.MEMORIA.get(chiave);
    if (gia) return risposta({ url: gia, memoria: true }, 200, origine);

    // --- limiti di spesa
    const giorno = new Date().toISOString().slice(0, 10);
    const chi = await impronta((req.headers.get("cf-connecting-ip") || "?") + giorno);
    const kPersona = `conta:${giorno}:${chi}`, kGiorno = `conta:${giorno}`;
    const [nPersona, nGiorno] = (await Promise.all([env.MEMORIA.get(kPersona), env.MEMORIA.get(kGiorno)])).map(v => +v || 0);
    if (nPersona >= +env.LIMITE_PERSONA) return risposta({ errore: "limite", messaggio: "Per oggi hai provato abbastanza look. Domani si riparte." }, 429, origine);
    if (nGiorno >= +env.LIMITE_GIORNO) return risposta({ errore: "limite", messaggio: "Oggi il camerino è pieno. Riprova domani." }, 429, origine);
    const dueGiorni = { expirationTtl: 172800 };
    await Promise.all([env.MEMORIA.put(kPersona, String(nPersona + 1), dueGiorni), env.MEMORIA.put(kGiorno, String(nGiorno + 1), dueGiorni)]);

    // --- generazione
    let r;
    try {
      r = await fetch(`https://fal.run/${env.MODELLO}`, { method: "POST",
        headers: { authorization: `Key ${env.FAL_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ prompt: istruzioni(capi), image_urls: [avatar, ...capi.map(c => c.url + "?width=1024")], num_images: 1,
          aspect_ratio: "3:4", resolution: "1K", output_format: "jpeg" }) });
    } catch { return risposta({ errore: "servizio", messaggio: "Il servizio non risponde. Riprova tra poco." }, 502, origine); }
    if (!r.ok) {
      const testo = (await r.text()).slice(0, 300);
      console.log("fal", r.status, testo);
      if (r.status >= 500) await env.MEMORIA.put(kPersona, String(nPersona), dueGiorni);   // non pagato da fal: non si conta
      const msg = r.status === 403 || /balance|credit|locked/i.test(testo) ? "Il credito delle prove è finito." : "Non sono riuscito a vestire l'avatar. Riprova.";
      return risposta({ errore: "servizio", messaggio: msg }, 502, origine);
    }
    const out = await r.json(), img = out?.images?.[0]?.url;
    if (!img) return risposta({ errore: "servizio", messaggio: "Non sono riuscito a vestire l'avatar. Riprova." }, 502, origine);
    await env.MEMORIA.put(chiave, img, { expirationTtl: 60 * 60 * 24 * 30 });
    return risposta({ url: img, restano: Math.max(0, +env.LIMITE_PERSONA - nPersona - 1) }, 200, origine);
  },
};
