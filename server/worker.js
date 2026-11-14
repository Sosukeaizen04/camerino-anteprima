// Camerino — server della prova addosso e del creatore di avatar (Cloudflare Worker).
// Tiene nascosta la chiave di fal.ai, accetta solo ciò che serve all'app (avatar del Camerino o creati qui, foto dei negozi),
// conserva le immagini generate nella propria memoria (KV: i link di fal non si sa quanto durano) e limita la spesa.
// Il saldo prepagato su fal è il tetto finale.
//
//   POST /prova   { avatar, capi: [{posto, url}] }                       → { url }   l'avatar con il look addosso
//   POST /avatar  { modo: "foto", genere, foto: "data:image/jpeg;base64,…" } → { url }   avatar dalla foto della persona
//   POST /avatar  { modo: "personaggio", genere, scelte: {…} }            → { url }   personaggio inventato
//   GET  /img/<id>.jpg                                                     immagini conservate
//
// La foto della persona NON viene conservata: passa a fal solo per generare l'avatar (privacy da sistemare prima di aprire a tutti).
// Variabili: FAL_KEY (segreto), MODELLO (modifica), MODELLO_TESTO (da testo), LIMITE_PERSONA, LIMITE_AVATAR, LIMITE_GIORNO, ORIGINI, BASE_AVATAR; KV: MEMORIA.

const VERSIONE = 2;   // cambia quando cambia l'istruzione delle prove: le immagini vecchie non vengono più restituite
const GIORNO = 86400;
const POSTI = { capospalla: "the jacket or coat, worn open over the rest", abito: "the dress", sopra: "the top", sotto: "the trousers, jeans or skirt", scarpe: "the shoes" };
const BASE = "wearing a plain white crew-neck t-shirt, light grey slim trousers and plain white sneakers";
const POSA = "standing straight and facing the camera, arms relaxed at the sides, neutral expression, the whole body visible from head to toe, centred, " +
  "on a plain white seamless background, soft even studio light";

// --- scelte del personaggio: solo valori conosciuti, il testo per il modello lo scrive il server
const SCELTE = {
  tipo: { umano: "human", alieno: "friendly humanoid alien", animale: "anthropomorphic animal", robot: "humanoid robot", elfo: "fantasy elf with pointed ears" },
  animale: { gatto: "cat", volpe: "fox", orso: "bear", coniglio: "rabbit", lupo: "wolf", panda: "panda", leone: "lion", cane: "dog" },
  corpo: { esile: "slim", media: "average build", robusta: "broad and strong", morbida: "curvy, full-figured" },
  colore: { c1: "very fair", c2: "fair", c3: "light olive", c4: "medium tan", c5: "brown", c6: "deep brown",
    verde: "mint green", azzurro: "light blue", viola: "lavender purple", rosa: "pink", argento: "silver", oro: "gold", nero: "matte black", bianco: "white" },
  capelli: { corti: "short hair", lunghi: "long hair", ricci: "curly hair", raccolti: "hair tied up in a bun", rasati: "a shaved head", nessuno: "no hair" },
  tinta: { nero: "black", castano: "brown", biondo: "blonde", rosso: "copper red", grigio: "silver grey", pastello: "pastel pink" },
  stile: { realistico: "photorealistic fashion catalogue photo", cartone: "3D animated film character render, soft and friendly", fumetto: "flat illustration with clean outlines, comic style" },
};
function testoPersonaggio(genere, s) {
  const chi = genere === "u" ? "male" : "female";
  const pelle = SCELTE.colore[s.colore];
  let figura;
  if (s.tipo === "animale") figura = `a ${chi} ${SCELTE.tipo.animale}: a human body with the head, fur and tail of a ${SCELTE.animale[s.animale]}, fur colour ${pelle}`;
  else if (s.tipo === "robot") figura = `a ${chi}-looking ${SCELTE.tipo.robot} with a smooth ${pelle} body`;
  else if (s.tipo === "alieno") figura = `a ${chi} ${SCELTE.tipo.alieno} with ${pelle} skin and large expressive eyes`;
  else figura = `a ${chi} ${SCELTE.tipo[s.tipo]} with ${pelle} skin`;
  const capelli = s.tipo === "animale" || s.tipo === "robot" || s.capelli === "nessuno" ? "" : `, ${s.capelli === "rasati" ? SCELTE.capelli.rasati : `${SCELTE.tinta[s.tinta]} ${SCELTE.capelli[s.capelli]}`}`;
  return `A single character: ${figura}${capelli}, ${SCELTE.corpo[s.corpo]} body, adult proportions, ${BASE}, ${POSA}. Style: ${SCELTE.stile[s.stile]}. One character only, no text, no props.`;
}
const testoFoto = () => `Image 1 is a photo of a real person. Create a clean full-body photo of this same person: keep the face, facial features, hair, skin tone, body shape and proportions identical. ` +
  `The person is ${BASE}, ${POSA}. Realistic fashion catalogue photo, one person only, no text.`;
function testoProva(capi) {
  const elenco = capi.map((c, i) => `image ${i + 2}: ${POSTI[c.posto]}`).join("; ");
  return `Image 1 is a figure standing on a plain white background. Dress this exact figure in the garments shown in the other images (${elenco}). ` +
    `The garment photos may show other models or other clothes: take only the indicated garment from each one, keeping its exact colour, fabric, pattern, length and details. ` +
    `Replace the figure's current clothes completely with these garments, nothing else. ` +
    `Do not copy anything else that appears in the garment photos: no socks, tights, belts, bags, hats, scarves, sunglasses or jewellery. If the legs show, they are bare. ` +
    `Keep the figure's face, head, hair, skin, body shape, height, pose and drawing style identical, full body from head to toe visible, same plain white background, same light.`;
}

// --- utilità
const intestazioni = origine => ({ "access-control-allow-origin": origine || "null", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", vary: "origin" });
const risposta = (corpo, stato, origine) => new Response(JSON.stringify(corpo), { status: stato, headers: { "content-type": "application/json", ...intestazioni(origine) } });
async function impronta(testo) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(testo));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
const nuovoId = () => [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, "0")).join("");

/** Conta una generazione per la persona e per il giorno; restituisce un messaggio se si è oltre il limite. */
async function conta(env, req, tipo, limite) {
  const giorno = new Date().toISOString().slice(0, 10);
  const chi = await impronta((req.headers.get("cf-connecting-ip") || "?") + giorno);
  const kP = `conta:${tipo}:${giorno}:${chi}`, kG = `conta:${giorno}`;
  const [nP, nG] = (await Promise.all([env.MEMORIA.get(kP), env.MEMORIA.get(kG)])).map(v => +v || 0);
  if (nP >= limite) return { no: tipo === "avatar" ? "Per oggi hai creato abbastanza avatar. Domani si riparte." : "Per oggi hai provato abbastanza look. Domani si riparte." };
  if (nG >= +env.LIMITE_GIORNO) return { no: "Oggi il camerino è pieno. Riprova domani." };
  await Promise.all([env.MEMORIA.put(kP, String(nP + 1), { expirationTtl: 2 * GIORNO }), env.MEMORIA.put(kG, String(nG + 1), { expirationTtl: 2 * GIORNO })]);
  return { restano: Math.max(0, limite - nP - 1), annulla: () => env.MEMORIA.put(kP, String(nP), { expirationTtl: 2 * GIORNO }) };
}
/** Chiama fal; restituisce l'URL dell'immagine o un messaggio d'errore. */
async function genera(env, modello, corpo) {
  let r;
  try {
    r = await fetch(`https://fal.run/${modello}`, { method: "POST", headers: { authorization: `Key ${env.FAL_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ num_images: 1, aspect_ratio: "3:4", resolution: "1K", output_format: "jpeg", ...corpo }) });
  } catch { return { errore: "Il servizio non risponde. Riprova tra poco.", nonPagato: true }; }
  if (!r.ok) {
    const testo = (await r.text()).slice(0, 300);
    console.log("fal", r.status, testo);
    return { errore: r.status === 403 || /balance|credit|locked/i.test(testo) ? "Il credito è finito." : /safety|content|policy/i.test(testo) ? "Questa immagine non si può usare. Prova con un'altra." : "Non ci sono riuscito. Riprova.", nonPagato: r.status >= 500 };
  }
  const out = await r.json();
  return out?.images?.[0]?.url ? { url: out.images[0].url } : { errore: "Non ci sono riuscito. Riprova." };
}
/** Copia l'immagine nella memoria del server e restituisce il suo indirizzo stabile. */
async function conserva(env, sede, url, tipo, giorni) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("download " + r.status);
  const id = nuovoId();
  await env.MEMORIA.put(`file:${id}`, await r.arrayBuffer(), { expirationTtl: giorni * GIORNO, metadata: { tipo } });
  return `${sede}/img/${id}.jpg`;
}

export default {
  async fetch(req, env) {
    const origini = (env.ORIGINI || "").split(",").map(s => s.trim()).filter(Boolean);
    const origine = req.headers.get("origin") || "", ok = origini.includes(origine), url = new URL(req.url), sede = url.origin;
    if (req.method === "OPTIONS") return new Response(null, { status: ok ? 204 : 403, headers: ok ? { ...intestazioni(origine), "access-control-max-age": "86400" } : {} });

    // --- immagini conservate (le legge anche fal, quindi senza controllo d'origine)
    const m = url.pathname.match(/^\/img\/([0-9a-f]{24})\.jpg$/);
    if (m && req.method === "GET") {
      const { value, metadata } = await env.MEMORIA.getWithMetadata(`file:${m[1]}`, { type: "arrayBuffer" });
      if (!value) return new Response("non trovata", { status: 404 });
      return new Response(value, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=2592000, immutable", "access-control-allow-origin": "*", "x-tipo": metadata?.tipo || "" } });
    }
    if (url.pathname === "/salute") return risposta({ ok: true }, 200, ok ? origine : null);
    if (req.method !== "POST" || !["/prova", "/avatar"].includes(url.pathname)) return risposta({ errore: "non trovato" }, 404, ok ? origine : null);
    if (!ok) return risposta({ errore: "origine non ammessa" }, 403, null);
    let dati;
    try { dati = await req.json(); } catch { return risposta({ errore: "richiesta non valida" }, 400, origine); }

    // ================= AVATAR =================
    if (url.pathname === "/avatar") {
      const { modo, genere, foto, scelte } = dati || {};
      if (!["d", "u"].includes(genere)) return risposta({ errore: "genere non valido" }, 400, origine);
      let corpo, modello;
      if (modo === "foto") {
        if (typeof foto !== "string" || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(foto) || foto.length > 3_000_000) return risposta({ errore: "foto non valida" }, 400, origine);
        corpo = { prompt: testoFoto(), image_urls: [foto] }; modello = env.MODELLO;
      } else if (modo === "personaggio") {
        const s = scelte || {};
        for (const k of ["tipo", "corpo", "colore", "stile"]) if (!SCELTE[k][s[k]]) return risposta({ errore: `scelta non valida: ${k}` }, 400, origine);
        if (s.tipo === "animale" && !SCELTE.animale[s.animale]) return risposta({ errore: "scelta non valida: animale" }, 400, origine);
        if (!["animale", "robot"].includes(s.tipo) && (!SCELTE.capelli[s.capelli] || (!["rasati", "nessuno"].includes(s.capelli) && !SCELTE.tinta[s.tinta]))) return risposta({ errore: "scelta non valida: capelli" }, 400, origine);
        corpo = { prompt: testoPersonaggio(genere, s) }; modello = env.MODELLO_TESTO;
      } else return risposta({ errore: "modo non valido" }, 400, origine);

      const c = await conta(env, req, "avatar", +env.LIMITE_AVATAR);
      if (c.no) return risposta({ errore: "limite", messaggio: c.no }, 429, origine);
      const g = await genera(env, modello, corpo);
      if (g.errore) { if (g.nonPagato) await c.annulla(); return risposta({ errore: "servizio", messaggio: g.errore }, 502, origine); }
      try {
        const indirizzo = await conserva(env, sede, g.url, "avatar", 365);
        return risposta({ url: indirizzo, restano: c.restano }, 200, origine);
      } catch { return risposta({ errore: "servizio", messaggio: "Non ci sono riuscito. Riprova." }, 502, origine); }
    }

    // ================= PROVA ADDOSSO =================
    const { avatar, capi } = dati || {};
    let avatarOk = typeof avatar === "string" && avatar.startsWith(env.BASE_AVATAR);
    const mio = typeof avatar === "string" && avatar.match(new RegExp(`^${sede.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}/img/([0-9a-f]{24})\\.jpg$`));
    if (mio) avatarOk = (await env.MEMORIA.getWithMetadata(`file:${mio[1]}`, { type: "stream" })).metadata?.tipo === "avatar";
    if (!avatarOk) return risposta({ errore: "avatar non ammesso" }, 400, origine);
    if (!Array.isArray(capi) || !capi.length || capi.length > 4) return risposta({ errore: "servono da 1 a 4 capi" }, 400, origine);
    for (const c of capi) if (!POSTI[c?.posto] || typeof c.url !== "string" || !/^https:\/\/cdn\.shopify\.com\/s\/files\/[^\s"]+$/.test(c.url)) return risposta({ errore: "capo non ammesso" }, 400, origine);

    const chiave = "img:" + await impronta(JSON.stringify([env.MODELLO, VERSIONE, avatar, capi.map(c => [c.posto, c.url])]));
    const gia = await env.MEMORIA.get(chiave);
    if (gia) return risposta({ url: gia, memoria: true }, 200, origine);

    const c = await conta(env, req, "prova", +env.LIMITE_PERSONA);
    if (c.no) return risposta({ errore: "limite", messaggio: c.no }, 429, origine);
    const g = await genera(env, env.MODELLO, { prompt: testoProva(capi), image_urls: [avatar, ...capi.map(x => x.url + "?width=1024")] });
    if (g.errore) { if (g.nonPagato) await c.annulla(); return risposta({ errore: "servizio", messaggio: g.errore === "Non ci sono riuscito. Riprova." ? "Non sono riuscito a vestire l'avatar. Riprova." : g.errore }, 502, origine); }
    let indirizzo = g.url;
    try { indirizzo = await conserva(env, sede, g.url, "prova", 30); } catch {}
    await env.MEMORIA.put(chiave, indirizzo, { expirationTtl: 30 * GIORNO });
    return risposta({ url: indirizzo, restano: c.restano }, 200, origine);
  },
};
