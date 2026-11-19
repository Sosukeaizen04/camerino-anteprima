// Camerino — server della prova addosso e del creatore di avatar (Cloudflare Worker).
// Tiene nascosta la chiave di fal.ai, accetta solo ciò che serve all'app (avatar del Camerino o creati qui, foto dei negozi),
// conserva le immagini generate nella propria memoria (KV: i link di fal non si sa quanto durano) e limita la spesa.
// Il saldo prepagato su fal è il tetto finale.
//
//   POST /prova   { avatar, capi: [{posto, url}] }                       → { url }   l'avatar con il look addosso
//   POST /avatar  { modo: "foto", genere, foto: "data:image/jpeg;base64,…" } → { url }   avatar dalla foto della persona
//   POST /avatar  { modo: "personaggio", genere, scelte: {…} }            → { url }   personaggio inventato
//   POST /avatar  { modo: "foto", …, foto2?, su?: {capelli, tinta, ricci, corpo, altezza, taglia} }  → foto del viso + figura intera + "su di te" (come Alta)
//   POST /avatar  { modo: "ritocco", genere, immagine, ritocco: "capelli-corti"|… }  → { url }   corregge un avatar già creato
//   POST /gira    { immagine, vista: "destra"|"sinistra"|"dietro" }        → { url }   la stessa figura vista da un lato o da dietro
//   POST /chiedi  { testo, genere, budget, lingua, storia? }               → { risposta, richiesta }   lo stylist: capisce cosa si cerca
//   GET  /img/<id>.jpg                                                     immagini conservate
// Tutte le richieste accettano `lingua` ("it" | "en"): i messaggi per l'utente tornano in quella lingua.
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
// --- avatar dalla foto: come Alta (Andrea, 18/11), la foto dice il viso, "su di te" dice ciò che la foto può nascondere
// (capelli raccolti o in controluce, corpo coperto o tagliato). Ciò che la persona dichiara vince sulla foto.
const SU_DI_TE = {
  capelli: { cortissimi: "very short cropped hair (buzz cut or pixie), well above the ears", corti: "short hair, ending between the ears and the jaw",
    medi: "medium-length hair, ending between the chin and the shoulders", lunghi: "long hair, falling below the shoulders", rasati: "a shaved head", raccolti: "hair tied back in a bun or ponytail" },
  tinta: { nero: "black", castano_scuro: "dark brown", castano: "brown", biondo_scuro: "dark blonde", biondo: "blonde", platino: "platinum blonde",
    rosso: "red", grigio: "grey or silver", bianco: "white" },
  ricci: { lisci: "straight", mossi: "wavy", ricci: "curly", afro: "afro-textured, coily" },
  corpo: { esile: "slim, slender build", media: "average build", atletica: "athletic, toned build", robusta: "broad, sturdy build", morbida: "curvy, full-figured build" },
};
const TAGLIE_OK = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];
function testoFoto(n, d = {}) {
  const foto = n > 1 ? "Images 1 and 2 are photos of the same real person (one may be a close-up of the face, one a full-body photo)." : "Image 1 is a photo of a real person.";
  const capelli = SU_DI_TE.capelli[d.capelli]
    ? `Hair: exactly ${[SU_DI_TE.ricci[d.ricci], SU_DI_TE.tinta[d.tinta]].filter(Boolean).join(", ")} ${SU_DI_TE.capelli[d.capelli]}. This is how the person wears their hair: follow it even if the photo shows the hair differently or partly hidden.`
    : "Hair: the exact same haircut as in the photo — same length, cut, volume, parting, texture and colour. Never make the hair longer, fuller or different.";
  const corpo = [d.altezza ? `${d.altezza} cm tall` : "", SU_DI_TE.corpo[d.corpo] || "", d.taglia ? `wears clothing size ${d.taglia} (EU women/men sizing)` : ""].filter(Boolean).join(", ");
  return `${foto} Create a clean, realistic full-body photo of THIS same person, so that they recognise themselves. ` +
    `Identity: keep the face, facial features, eyebrows, eyes, nose, mouth, jaw, skin tone, freckles or marks, age and expression identical. ${capelli} ` +
    (corpo ? `Body: ${corpo}; realistic proportions for these measurements, not idealised. ` : "Body: the same body shape and proportions as in the photo, not idealised. ") +
    `The person is ${BASE}, ${POSA}. No glasses, hats or jewellery unless they are part of the face in the photo. Realistic fashion catalogue photo, one person only, no text.`;
}
// --- ritocco di un avatar già creato: si cambia una cosa sola, il resto identico
const RITOCCHI = {
  "capelli-corti": "Make the hair clearly shorter (shorten the existing haircut by a lot), same colour and texture.",
  "capelli-lunghi": "Make the hair clearly longer, same colour and texture.",
  "piu-snella": "Make the body a little slimmer, realistic.", "piu-robusta": "Make the body a little fuller and broader, realistic.",
  "piu-alta": "Make the person look a little taller with longer legs.", "piu-bassa": "Make the person look a little shorter.",
};
const testoRitocco = k => `Image 1 is a full-body photo of a person. ${RITOCCHI[k]} Keep everything else identical: face, identity, skin, clothes, pose, ` +
  `framing, the plain white background and the light. One person only, no text.`;
function testoProva(capi) {
  const elenco = capi.map((c, i) => `image ${i + 2}: ${POSTI[c.posto]}`).join("; ");
  return `Image 1 is a figure standing on a plain white background. Dress this exact figure in the garments shown in the other images (${elenco}). ` +
    `The garment photos may show other models or other clothes: take only the indicated garment from each one, keeping its exact colour, fabric, pattern, length and details. ` +
    `Replace the figure's current clothes completely with these garments, nothing else. ` +
    `Do not copy anything else that appears in the garment photos: no socks, tights, belts, bags, hats, scarves, sunglasses or jewellery. If the legs show, they are bare. ` +
    `Keep the figure's face, head, hair, skin, body shape, height, pose and drawing style identical, full body from head to toe visible, same plain white background, same light.`;
}

// --- messaggi per l'utente, in italiano e inglese
const MSG = {
  limiteAvatar: ["Per oggi hai creato abbastanza avatar. Domani si riparte.", "You've made enough avatars for today. Try again tomorrow."],
  limiteProva: ["Per oggi hai provato abbastanza look. Domani si riparte.", "You've tried on enough looks for today. Try again tomorrow."],
  pieno: ["Oggi il camerino è pieno. Riprova domani.", "The fitting room is full today. Try again tomorrow."],
  nonRisponde: ["Il servizio non risponde. Riprova tra poco.", "The service isn't responding. Try again shortly."],
  credito: ["Il credito è finito.", "The credit has run out."],
  immagine: ["Questa immagine non si può usare. Prova con un'altra.", "This image can't be used. Try another one."],
  riprova: ["Non ci sono riuscito. Riprova.", "That didn't work. Please try again."],
  vestire: ["Non sono riuscito a vestire l'avatar. Riprova.", "I couldn't dress the avatar. Please try again."],
  girare: ["Non sono riuscito a girare l'avatar. Riprova.", "I couldn't turn the avatar. Please try again."],
  capire: ["Non ho capito. Prova a dirlo in un altro modo.", "I didn't get that. Try saying it another way."],
};
const msg = (k, lingua) => MSG[k][lingua === "en" ? 1 : 0];

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
  const kP = `conta:${tipo}:${giorno}:${chi}`, kG = tipo === "chat" ? `conta:chat:${giorno}` : `conta:${giorno}`;   // i messaggi allo stylist costano ~100 volte meno: contatore a parte
  const [nP, nG] = (await Promise.all([env.MEMORIA.get(kP), env.MEMORIA.get(kG)])).map(v => +v || 0);
  if (nP >= limite) return { no: tipo === "avatar" ? "limiteAvatar" : "limiteProva" };
  if (nG >= +env.LIMITE_GIORNO * (tipo === "chat" ? 10 : 1)) return { no: "pieno" };
  await Promise.all([env.MEMORIA.put(kP, String(nP + 1), { expirationTtl: 2 * GIORNO }), env.MEMORIA.put(kG, String(nG + 1), { expirationTtl: 2 * GIORNO })]);
  return { restano: Math.max(0, limite - nP - 1), annulla: () => env.MEMORIA.put(kP, String(nP), { expirationTtl: 2 * GIORNO }) };
}
/** Chiama fal; restituisce l'URL dell'immagine o un messaggio d'errore. */
async function genera(env, modello, corpo) {
  let r;
  try {
    r = await fetch(`https://fal.run/${modello}`, { method: "POST", headers: { authorization: `Key ${env.FAL_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ num_images: 1, aspect_ratio: "3:4", resolution: "1K", output_format: "jpeg", ...corpo }) });
  } catch { return { errore: "nonRisponde", nonPagato: true }; }
  if (!r.ok) {
    const testo = (await r.text()).slice(0, 300);
    console.log("fal", r.status, testo);
    return { errore: r.status === 403 || /balance|credit|locked/i.test(testo) ? "credito" : /safety|content|policy/i.test(testo) ? "immagine" : "riprova", nonPagato: r.status >= 500 };
  }
  const out = await r.json();
  return out?.images?.[0]?.url ? { url: out.images[0].url } : { errore: "riprova" };
}
/** Copia l'immagine nella memoria del server e restituisce il suo indirizzo stabile. */
async function conserva(env, sede, url, tipo, giorni) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("download " + r.status);
  const id = nuovoId();
  await env.MEMORIA.put(`file:${id}`, await r.arrayBuffer(), { expirationTtl: giorni * GIORNO, metadata: { tipo } });
  return `${sede}/img/${id}.jpg`;
}

// --- vista da un lato o da dietro: stessa figura, stessi vestiti
const VISTE = {
  destra: "turned 90 degrees so that we see the figure's right side in profile",
  sinistra: "turned 90 degrees so that we see the figure's left side in profile",
  dietro: "turned 180 degrees so that we see the figure from behind (back view, the face is not visible)",
};
const testoGira = vista => `Image 1 shows a figure standing on a plain white background. Show this exact same figure ${VISTE[vista]}. ` +
  `Keep everything identical: the same person or character, body shape, height, hair, skin, the same clothes and shoes with the same colours, fabrics, ` +
  `patterns, lengths and fit, the same drawing style. Full body from head to toe visible, arms relaxed, same plain white background, same soft light. Add nothing. ` +
  `Redraw the whole figure from the new angle: the hair must fall naturally for this view and belong to the head. Leave nothing from the original front view: ` +
  `no loose strands, wisps or pieces of hair floating beside the face or the body, no ghost outlines, no doubled edges, no leftover fragments. The white background around the figure is perfectly clean.`;
const VERSIONE_GIRA = 2;   // 19/11: istruzione nuova contro i ciuffi rimasti dalla vista di fronte (amico di Andrea) → le viste vecchie si rifanno

// --- lo stylist: dal testo libero a una richiesta che l'app sa comporre col catalogo vero (l'AI non inventa capi)
const STILI = ["Minimal", "Parigino", "Lusso", "Romantico", "Boho", "Colore", "Italiano", "Maglieria", "Sostenibile", "Denim", "Curvy", "Sportivo", "Streetwear", "Sera", "Rock"];
const COLORI = ["nero", "bianco", "panna", "beige", "cammello", "marrone", "grigio", "blu", "navy", "azzurro", "verde", "oliva", "rosso", "bordeaux", "rosa", "arancione", "giallo", "viola", "lilla"];
const MATERIALI = ["cashmere", "lana", "seta", "lino", "pelle", "denim", "velluto", "cotone", "viscosa"];
const SISTEMA_STYLIST = `You are the stylist of Camerino, a fashion app that builds complete outfits from real products of online shops.
The user writes what they want. Turn it into a request the app can search. You never name products or shops: the app picks real ones.
Answer ONLY with JSON, no markdown:
{"risposta": string, "budget": number|null, "stili": string[], "elegante": boolean, "giacca": boolean|null, "abito": boolean|null,
 "sopra": {"tipo": "maglia"|"camicia"|"top"|null, "colori": string[], "materiale": string|null, "maniche": "senza"|"corte"|"3/4"|"lunghe"|null} | null,
 "sotto": {"tipo": "pantaloni"|"jeans"|"gonna"|null, "colori": string[], "materiale": string|null, "lunghezza": "corta"|"normale"|"lunga"|null} | null,
 "abito_dettagli": {"colori": string[], "materiale": string|null, "lunghezza": "corta"|"normale"|"lunga"|null, "maniche": "senza"|"corte"|"3/4"|"lunghe"|null} | null,
 "scarpe": {"tipo": "stivali"|"sneakers"|"tacchi"|"sandali"|"mocassini"|"ballerine"|null, "colori": string[]} | null,
 "giacca_dettagli": {"tipo": "cappotto"|"giacca"|"blazer"|"piumino"|"trench"|null, "colori": string[], "materiale": string|null} | null}
Rules:
- "risposta": one or two short friendly sentences in the language required below, saying what you are putting together (no product names, no prices you can't know). If the request is not about clothes, say kindly what you can do.
- "budget": total euros for the whole outfit only if the user says it, else null.
- "stili": zero to two of ${JSON.stringify(STILI)} that fit the request (office → Minimal/Italiano, evening/party → Sera, sport → Sportivo, etc.).
- "elegante": true for dinners, evenings, ceremonies, office/work, dates, theatre: then also choose a fitting "tipo" for each piece (e.g. camicia or maglia, pantaloni or gonna, tacchi or stivali or mocassini).
- colours only from ${JSON.stringify(COLORI)}; materials only from ${JSON.stringify(MATERIALI)}. Leave a field null or [] if the user doesn't ask; do not over-constrain.
- "giacca": true if a coat/jacket is wanted or the weather is cold, false if explicitly not, else null. "abito": true if a dress is wanted (women only), false if trousers/skirt are wanted, else null.
- If the user only changes one thing ("make it cheaper", "darker shoes"), keep the rest of the previous request.`;

async function chiediStylist(env, testo, genere, budget, lingua, storia) {
  const contesto = `User: ${genere === "u" ? "man" : "woman"}. Current outfit budget: ${budget} euro. Write "risposta" in ${lingua === "en" ? "English" : "Italian"}, unless the user clearly writes in another language (then use theirs).` +
    (storia ? `\nPrevious request (JSON): ${JSON.stringify(storia).slice(0, 1500)}` : "");
  let r;
  try {
    r = await fetch("https://fal.run/openrouter/router", { method: "POST", headers: { authorization: `Key ${env.FAL_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: env.MODELLO_CHAT, system_prompt: SISTEMA_STYLIST, prompt: `${contesto}\n\nUser message: ${testo}`, temperature: 0.3, max_tokens: 600 }) });
  } catch { return { errore: "nonRisponde" }; }
  if (!r.ok) { console.log("chat", r.status, (await r.text()).slice(0, 300)); return { errore: r.status === 403 ? "credito" : "riprova" }; }
  const out = await r.json();
  const testoOut = String(out?.output || "").replace(/^```(?:json)?\s*|\s*```$/g, "");
  let j;
  try { j = JSON.parse(testoOut.slice(testoOut.indexOf("{"), testoOut.lastIndexOf("}") + 1)); } catch { return { errore: "capire" }; }
  // si tiene solo ciò che l'app conosce
  const lista = (v, ammessi) => Array.isArray(v) ? v.filter(x => ammessi.includes(x)).slice(0, 3) : [];
  const una = (v, ammessi) => ammessi.includes(v) ? v : null;
  const pezzo = (o, campi) => o && typeof o === "object" ? Object.fromEntries(Object.entries(campi).map(([k, amm]) => [k, k === "colori" ? lista(o[k], COLORI) : una(o[k], amm)])) : null;
  const MAN = ["senza", "corte", "3/4", "lunghe"], LUN = ["corta", "normale", "lunga"];
  return {
    risposta: String(j.risposta || "").slice(0, 400),
    richiesta: {
      budget: Number.isFinite(+j.budget) && +j.budget >= 30 && +j.budget <= 20000 ? Math.round(+j.budget) : null,
      stili: lista(j.stili, STILI).slice(0, 2), elegante: j.elegante === true, giacca: typeof j.giacca === "boolean" ? j.giacca : null, abito: genere === "d" && typeof j.abito === "boolean" ? j.abito : genere === "u" ? false : null,
      sopra: pezzo(j.sopra, { tipo: ["maglia", "camicia", "top"], colori: 0, materiale: MATERIALI, maniche: MAN }),
      sotto: pezzo(j.sotto, { tipo: ["pantaloni", "jeans", "gonna"], colori: 0, materiale: MATERIALI, lunghezza: LUN }),
      abito: null,
      abito_dettagli: genere === "d" ? pezzo(j.abito_dettagli, { colori: 0, materiale: MATERIALI, lunghezza: LUN, maniche: MAN }) : null,
      scarpe: pezzo(j.scarpe, { tipo: ["stivali", "sneakers", "tacchi", "sandali", "mocassini", "ballerine"], colori: 0 }),
      giacca_dettagli: pezzo(j.giacca_dettagli, { tipo: ["cappotto", "giacca", "blazer", "piumino", "trench"], colori: 0, materiale: MATERIALI }),
    },
    costo: out?.usage?.cost,
  };
}

/** L'immagine è nostra? Base del Camerino, oppure un avatar o una prova conservati qui. */
async function immagineNostra(env, sede, url, tipi) {
  if (typeof url !== "string") return false;
  if (url.startsWith(env.BASE_AVATAR)) return true;
  const mio = url.match(new RegExp(`^${sede.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}/img/([0-9a-f]{24})\\.jpg$`));
  if (!mio) return false;
  return tipi.includes((await env.MEMORIA.getWithMetadata(`file:${mio[1]}`, { type: "stream" })).metadata?.tipo);
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
    if (req.method !== "POST" || !["/prova", "/avatar", "/gira", "/chiedi"].includes(url.pathname)) return risposta({ errore: "non trovato" }, 404, ok ? origine : null);
    if (!ok) return risposta({ errore: "origine non ammessa" }, 403, null);
    let dati;
    try { dati = await req.json(); } catch { return risposta({ errore: "richiesta non valida" }, 400, origine); }
    const lingua = dati?.lingua === "en" ? "en" : "it";
    const errore = (k, stato) => risposta({ errore: k, messaggio: msg(k, lingua) }, stato, origine);

    // ================= STYLIST =================
    if (url.pathname === "/chiedi") {
      const { testo, genere, budget, storia } = dati || {};
      if (typeof testo !== "string" || !testo.trim() || testo.length > 500) return risposta({ errore: "testo non valido" }, 400, origine);
      if (!["d", "u"].includes(genere)) return risposta({ errore: "genere non valido" }, 400, origine);
      const c = await conta(env, req, "chat", +env.LIMITE_CHAT);
      if (c.no) return errore(c.no === "pieno" ? "pieno" : "limiteProva", 429);
      const r = await chiediStylist(env, testo.trim(), genere, Math.round(+budget) || 400, lingua, storia);
      if (r.errore) { await c.annulla(); return errore(r.errore, 502); }
      return risposta(r, 200, origine);
    }

    // ================= AVATAR =================
    if (url.pathname === "/avatar") {
      const { modo, genere, foto, scelte } = dati || {};
      if (!["d", "u"].includes(genere)) return risposta({ errore: "genere non valido" }, 400, origine);
      let corpo, modello;
      if (modo === "foto") {
        const foto2 = dati.foto2, buona = f => typeof f === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(f) && f.length <= 3_000_000;
        if (!buona(foto) || (foto2 != null && !buona(foto2))) return risposta({ errore: "foto non valida" }, 400, origine);
        // "su di te": solo valori conosciuti
        const d = dati.su || {}, su = {};
        for (const k of ["capelli", "tinta", "ricci", "corpo"]) if (SU_DI_TE[k][d[k]]) su[k] = d[k];
        if (Number.isInteger(+d.altezza) && +d.altezza >= 130 && +d.altezza <= 215) su.altezza = +d.altezza;
        if (TAGLIE_OK.includes(d.taglia)) su.taglia = d.taglia;
        const foto_ = foto2 ? [foto, foto2] : [foto];
        corpo = { prompt: testoFoto(foto_.length, su), image_urls: foto_ }; modello = env.MODELLO;
      } else if (modo === "ritocco") {
        if (!RITOCCHI[dati.ritocco]) return risposta({ errore: "ritocco non valido" }, 400, origine);
        if (!await immagineNostra(env, sede, dati.immagine, ["avatar"])) return risposta({ errore: "immagine non ammessa" }, 400, origine);
        corpo = { prompt: testoRitocco(dati.ritocco), image_urls: [dati.immagine] }; modello = env.MODELLO;
      } else if (modo === "personaggio") {
        const s = scelte || {};
        for (const k of ["tipo", "corpo", "colore", "stile"]) if (!SCELTE[k][s[k]]) return risposta({ errore: `scelta non valida: ${k}` }, 400, origine);
        if (s.tipo === "animale" && !SCELTE.animale[s.animale]) return risposta({ errore: "scelta non valida: animale" }, 400, origine);
        if (!["animale", "robot"].includes(s.tipo) && (!SCELTE.capelli[s.capelli] || (!["rasati", "nessuno"].includes(s.capelli) && !SCELTE.tinta[s.tinta]))) return risposta({ errore: "scelta non valida: capelli" }, 400, origine);
        corpo = { prompt: testoPersonaggio(genere, s) }; modello = env.MODELLO_TESTO;
      } else return risposta({ errore: "modo non valido" }, 400, origine);

      const c = await conta(env, req, "avatar", +env.LIMITE_AVATAR);
      if (c.no) return errore(c.no, 429);
      const g = await genera(env, modello, corpo);
      if (g.errore) { if (g.nonPagato) await c.annulla(); return errore(g.errore, 502); }
      try {
        const indirizzo = await conserva(env, sede, g.url, "avatar", 365);
        return risposta({ url: indirizzo, restano: c.restano }, 200, origine);
      } catch { return errore("riprova", 502); }
    }

    // ================= GIRA: vista da destra, sinistra o dietro (una immagine per vista, solo quando la si chiede) =================
    if (url.pathname === "/gira") {
      const { immagine, vista } = dati || {};
      if (!VISTE[vista]) return risposta({ errore: "vista non valida" }, 400, origine);
      if (!await immagineNostra(env, sede, immagine, ["avatar", "prova"])) return risposta({ errore: "immagine non ammessa" }, 400, origine);
      const chiave = "gira:" + await impronta(JSON.stringify([env.MODELLO, VERSIONE, VERSIONE_GIRA, immagine, vista]));
      const gia = await env.MEMORIA.get(chiave);
      if (gia) return risposta({ url: gia, memoria: true }, 200, origine);
      const c = await conta(env, req, "prova", +env.LIMITE_PERSONA);
      if (c.no) return errore(c.no, 429);
      const g = await genera(env, env.MODELLO, { prompt: testoGira(vista), image_urls: [immagine] });
      if (g.errore) { if (g.nonPagato) await c.annulla(); return errore(g.errore === "riprova" ? "girare" : g.errore, 502); }
      let indirizzo = g.url;
      try { indirizzo = await conserva(env, sede, g.url, "vista", 30); } catch {}
      await env.MEMORIA.put(chiave, indirizzo, { expirationTtl: 30 * GIORNO });
      return risposta({ url: indirizzo, restano: c.restano }, 200, origine);
    }

    // ================= PROVA ADDOSSO =================
    const { avatar, capi } = dati || {};
    if (!await immagineNostra(env, sede, avatar, ["avatar"])) return risposta({ errore: "avatar non ammesso" }, 400, origine);
    if (!Array.isArray(capi) || !capi.length || capi.length > 4) return risposta({ errore: "servono da 1 a 4 capi" }, 400, origine);
    for (const c of capi) if (!POSTI[c?.posto] || typeof c.url !== "string" || !/^https:\/\/cdn\.shopify\.com\/s\/files\/[^\s"]+$/.test(c.url)) return risposta({ errore: "capo non ammesso" }, 400, origine);

    const chiave = "img:" + await impronta(JSON.stringify([env.MODELLO, VERSIONE, avatar, capi.map(c => [c.posto, c.url])]));
    const gia = await env.MEMORIA.get(chiave);
    if (gia) return risposta({ url: gia, memoria: true }, 200, origine);

    const c = await conta(env, req, "prova", +env.LIMITE_PERSONA);
    if (c.no) return errore(c.no, 429);
    const g = await genera(env, env.MODELLO, { prompt: testoProva(capi), image_urls: [avatar, ...capi.map(x => x.url + "?width=1024")] });
    if (g.errore) { if (g.nonPagato) await c.annulla(); return errore(g.errore === "riprova" ? "vestire" : g.errore, 502); }
    let indirizzo = g.url;
    try { indirizzo = await conserva(env, sede, g.url, "prova", 30); } catch {}
    await env.MEMORIA.put(chiave, indirizzo, { expirationTtl: 30 * GIORNO });
    return risposta({ url: indirizzo, restano: c.restano }, 200, origine);
  },
};
