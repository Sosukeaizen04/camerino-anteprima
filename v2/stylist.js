// Regole dell'outfit: posti, budget, abbinamenti. Nessuna grafica e nessuna rete qui dentro: si prova con `node --test`.

export const TAGLIE = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];
export const NUMERI_SCARPE = [35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47];
export const POSTI = ["capospalla", "sopra", "sotto", "scarpe"];
export const NOME_POSTO = { capospalla: "Capospalla", sopra: "Sopra", sotto: "Sotto", scarpe: "Scarpe", abito: "Abito" };

const POSTO_DI = { top: "sopra", camicia: "sopra", maglia: "sopra", pantaloni: "sotto", jeans: "sotto", gonna: "sotto",
  abito: "abito", capospalla: "capospalla", scarpe: "scarpe" };
export const postoDi = capo => POSTO_DI[capo.c];
// `z` è il dominio del negozio, messo dall'app al caricamento: l'indice `n` cambia se una notte un negozio salta,
// e gli outfit salvati o condivisi devono restare validi.
export const chiave = c => `${c.z ?? c.n}|${c.h}|${c.v ?? ""}`;

// ---------- l'outfit ----------
// Un outfit è { capospalla, sopra, sotto, scarpe, abito } (capo o null). L'abito occupa sopra e sotto.
export const outfitVuoto = () => ({ capospalla: null, sopra: null, sotto: null, scarpe: null, abito: null });
export const capiDi = o => ["capospalla", "abito", "sopra", "sotto", "scarpe"].map(p => o[p]).filter(Boolean);
export const totale = o => capiDi(o).reduce((t, c) => t + c.e, 0);
export const completo = o => !!((o.abito || (o.sopra && o.sotto)) && o.scarpe);
/** I posti che mancano perché l'outfit sia completo (il capospalla è facoltativo). */
export function mancanti(o) {
  const m = [];
  if (!o.abito) { if (!o.sopra) m.push("sopra"); if (!o.sotto) m.push("sotto"); }
  if (!o.scarpe) m.push("scarpe");
  return m;
}
/** Mette un capo nel suo posto. Restituisce il nuovo outfit e i capi che ha dovuto togliere (abito ↔ sopra/sotto). */
export function metti(o, capo) {
  const p = postoDi(capo), n = { ...o }, tolti = [];
  if (p === "abito") { for (const q of ["sopra", "sotto"]) if (n[q]) { tolti.push(n[q]); n[q] = null; } }
  if ((p === "sopra" || p === "sotto") && n.abito) { tolti.push(n.abito); n.abito = null; }
  if (n[p] && chiave(n[p]) !== chiave(capo)) tolti.push(n[p]);
  n[p] = capo;
  return { outfit: n, tolti };
}
export function togli(o, posto) { return { ...o, [posto]: null }; }

// ---------- taglie ----------
/** La taglia del profilo che vale per questo capo. */
export function tagliaPer(profilo, capo) {
  const p = postoDi(capo);
  if (p === "scarpe") return profilo.scarpa;
  return p === "sotto" ? profilo.tagliaSotto : profilo.tagliaSopra;
}
export function haTaglia(capo, profilo, maschera = capo.d) {
  const t = tagliaPer(profilo, capo), scala = capo.c === "scarpe" ? NUMERI_SCARPE : TAGLIE, i = scala.indexOf(t);
  return i >= 0 && !!(maschera & (1 << i));
}

// ---------- colore ----------
export function lab(hex) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v > .04045 ? ((v + .055) / 1.055) ** 2.4 : v / 12.92; });
  let x = (c[0] * .4124 + c[1] * .3576 + c[2] * .1805) / .95047, y = c[0] * .2126 + c[1] * .7152 + c[2] * .0722, z = (c[0] * .0193 + c[1] * .1192 + c[2] * .9505) / 1.08883;
  [x, y, z] = [x, y, z].map(v => v > .008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const STAGIONI = {
  primavera: { nome: "Primavera", desc: "calda e chiara", colori: ["#f88379", "#ffcba4", "#f4d35e", "#8db600", "#fffff0", "#c19a6b", "#40b5ad"] },
  estate: { nome: "Estate", desc: "fredda e chiara", colori: ["#e8b4b8", "#b4a7d6", "#a3c1d9", "#c0c0c8", "#b784a7", "#5b7db1", "#f5f5f0"] },
  autunno: { nome: "Autunno", desc: "calda e profonda", colori: ["#b7410e", "#d4a017", "#708238", "#c19a6b", "#5d3a1a", "#2e4a3a", "#7b2d26", "#efe6d2"] },
  inverno: { nome: "Inverno", desc: "fredda e intensa", colori: ["#111111", "#fafafa", "#1b1f3b", "#c8102e", "#046307", "#c71585", "#3a3a40"] },
};
/** Distanza del capo dalla palette della stagione; null se il colore non si può valutare. */
export function distPalette(capo, stagione) {
  if (!capo.x || !stagione) return null;
  const a = lab(capo.x);
  return Math.min(...STAGIONI[stagione].colori.map(h => dist(a, lab(h))));
}
/** "neutro" (nero, bianco, grigi, beige, blu scuro, denim: stanno con tutto), "acceso", o "fantasia". */
export function tipoColore(capo) {
  if (!capo.x) return "fantasia";
  const [L, a, b] = lab(capo.x), croma = Math.hypot(a, b);
  if (croma < 14) return "neutro";
  if (croma < 30 && (b > 0 && a < 16)) return "neutro";            // beige, sabbia, cammello chiaro, kaki
  if (L < 32 && b < 0) return "neutro";                             // blu notte
  if (capo.c === "jeans" || /denim/i.test(capo.k || "")) return "neutro";
  return "acceso";
}

// ---------- stile ----------
const AFFINI = {
  Minimal: ["Parigino", "Lusso", "Denim", "Maglieria", "Italiano", "Sostenibile"],
  Parigino: ["Minimal", "Romantico", "Denim", "Maglieria", "Italiano", "Lusso"],
  Lusso: ["Minimal", "Parigino", "Italiano", "Maglieria", "Sera"],
  Romantico: ["Parigino", "Boho", "Colore"],
  Boho: ["Romantico", "Colore", "Denim"],
  Colore: ["Romantico", "Boho", "Parigino", "Denim"],
  Italiano: ["Minimal", "Parigino", "Lusso", "Maglieria"],
  Maglieria: ["Minimal", "Parigino", "Italiano", "Denim", "Sostenibile", "Lusso"],
  Sostenibile: ["Minimal", "Denim", "Maglieria", "Sportivo", "Streetwear"],
  Denim: ["Minimal", "Parigino", "Streetwear", "Sostenibile", "Maglieria", "Boho", "Colore", "Curvy", "Rock"],
  Curvy: ["Denim", "Minimal", "Sera"],
  Sportivo: ["Streetwear", "Sostenibile", "Denim"],
  Streetwear: ["Sportivo", "Denim", "Sostenibile", "Rock"],
  Sera: ["Lusso", "Curvy", "Rock"],
  Rock: ["Streetwear", "Denim", "Sera"],
};
export const STILI = Object.keys(AFFINI);
// senza stili scelti si parte da quelli più portabili, non da quelli di nicchia (sera, rock…)
const COMUNI = ["Minimal", "Parigino", "Denim", "Colore", "Italiano", "Maglieria", "Sostenibile", "Romantico"];
const affinita = (a, b) => a === b ? 2 : AFFINI[a]?.includes(b) ? 1 : -2;

// ---------- stagione ----------
const DA_CALDO = /sandal|slide|\bmules?\b|slingback|open.?toe|strappy|feather|espadrill|flip.?flop|tong\b|shorts?\b|bermuda|\blinen|\blin\b|\blino\b|crochet|raffia|sleeveless|sans manches|d[ée]bardeur|canott|\btank\b|\bcami\b|bandeau|bikini|mini ?short/i;
const DA_FREDDO = /\bboots?\b|bottes?|bottines?|stival|\bwool|laine|\blana\b|cashmere|cachemire|puffer|piumin|doudoune|shearling|fleece|polaire|velvet|velours|turtleneck|col roul/i;
/** Il capo è fuori stagione? `freddo` = si sta componendo per i mesi freddi. Vale solo per le proposte, non per la ricerca. */
export const fuoriStagione = (capo, freddo) => (freddo ? DA_CALDO : DA_FREDDO).test(capo.t);

// ---------- comporre ----------
const PESO = { capospalla: 0.35, sopra: 0.20, sotto: 0.22, scarpe: 0.23, abito: 0.42 };

/** Generatore casuale con seme, per avere outfit ripetibili nelle prove. */
export function casuale(seme) {
  let s = seme >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/** Quanto un candidato sta bene con i capi già scelti (più alto è meglio). */
export function punteggio(capo, scelti, ctx) {
  const { profilo, negozi, stileGuida } = ctx;
  let p = 0;
  // stile: vicino allo stile guida e a quello dei capi già scelti
  const st = negozi[capo.n].stile, pesoStile = postoDi(capo) === "scarpe" ? 0.4 : 1;   // poche marche fanno scarpe: lo stile pesa meno
  if (stileGuida) p += affinita(stileGuida, st) * pesoStile;
  for (const s of scelti) p += affinita(negozi[s.n].stile, st) * 0.5 * pesoStile;
  // colore: al massimo un colore acceso o una fantasia, il resto neutri
  const tipo = tipoColore(capo), altri = scelti.map(tipoColore);
  if (tipo === "neutro") p += 1.5;
  else if (tipo === "fantasia") p += altri.includes("fantasia") ? -7 : altri.includes("acceso") ? -2.5 : 0;
  else {
    const accesi = scelti.filter(s => tipoColore(s) === "acceso");
    if (!accesi.length) p += altri.includes("fantasia") ? -1 : 1;
    else p += accesi.every(s => dist(lab(s.x), lab(capo.x)) < 22) ? 0.5 : -7;
  }
  // palette: conta per ciò che sta vicino al viso
  if (profilo.stagione && ["sopra", "abito", "capospalla"].includes(postoDi(capo))) {
    const d = distPalette(capo, profilo.stagione), peso = capo.m ? 0.5 : 1;
    if (d !== null) p += (d < 18 ? 2 : d < 30 ? 1 : -1.5) * peso;
  }
  return p;
}

/**
 * Compone un outfit completo dentro il budget, tenendo i capi bloccati.
 * @param capi      capi del catalogo (già del genere giusto)
 * @param ctx       { profilo, negozi, esclusi?: Set<chiave> }
 * @param partenza  outfit attuale; @param bloccati  Set di posti da non toccare
 * @returns { outfit, manca: [{posto, daEuro}] }  manca = posti rimasti vuoti perché il budget non basta
 */
export function componi(capi, ctx, partenza = outfitVuoto(), bloccati = new Set(), rnd = Math.random) {
  const { profilo, negozi } = ctx, esclusi = ctx.esclusi || new Set();
  const o = outfitVuoto();
  for (const p of [...POSTI, "abito"]) if (bloccati.has(p) && partenza[p]) o[p] = partenza[p];

  // candidati per posto: nella taglia giusta, non esclusi
  const per = { capospalla: [], sopra: [], sotto: [], scarpe: [], abito: [] };
  for (const c of capi) {
    const p = postoDi(c);
    if (!p || esclusi.has(chiave(c)) || !haTaglia(c, profilo) || fuoriStagione(c, profilo.freddo ?? profilo.conCapospalla)) continue;
    if (profilo.genere === "u" && (p === "abito" || c.c === "gonna")) continue;
    per[p].push(c);
  }
  const minimo = p => per[p].length ? Math.min(...per[p].map(c => c.e)) : Infinity;

  // quali posti riempire
  let daFare = [];
  const corpoBloccato = o.abito || o.sopra || o.sotto;
  // l'abito si propone solo se ci sta nel budget insieme alle scarpe: se no si ragiona a sopra + sotto
  const abitoCiSta = minimo("abito") + (o.scarpe ? 0 : minimo("scarpe")) <= profilo.budget - totale(o);
  const usaAbito = !corpoBloccato && profilo.genere !== "u" && abitoCiSta && rnd() < 0.3;
  if (o.abito) { /* abito bloccato: niente sopra/sotto */ }
  else if (usaAbito) daFare.push("abito");
  else { if (!o.sopra) daFare.push("sopra"); if (!o.sotto) daFare.push("sotto"); }
  if (!o.scarpe) daFare.push("scarpe");
  if (profilo.conCapospalla && !o.capospalla) daFare.push("capospalla");
  daFare.sort((a, b) => PESO[b] - PESO[a]);

  const stileGuida = profilo.stili?.length ? profilo.stili[Math.floor(rnd() * profilo.stili.length)]
    : capiDi(o).length ? negozi[capiDi(o)[0].n].stile : COMUNI[Math.floor(rnd() * COMUNI.length)];
  const c2 = { ...ctx, stileGuida };
  const manca = [];
  let resto = profilo.budget - totale(o);

  daFare.forEach((posto, i) => {
    const dopo = daFare.slice(i + 1);
    // il capospalla è facoltativo: non deve togliere soldi ai posti obbligatori
    const riserva = dopo.filter(p => p !== "capospalla").reduce((t, p) => t + minimo(p), 0);
    const tetto = resto - (Number.isFinite(riserva) ? riserva : 0);
    const pesi = [posto, ...dopo].reduce((t, p) => t + PESO[p], 0);
    const obiettivo = Math.max(minimo(posto), resto * PESO[posto] / pesi);
    const scelti = capiDi(o);
    const cand = per[posto].filter(c => c.e <= tetto);
    if (!cand.length) { if (posto !== "capospalla") manca.push({ posto, daEuro: minimo(posto) }); return; }
    const valutati = cand.map(c => {
      const r = c.e / obiettivo;                         // meglio usare il budget che prendere il capo più economico
      const prezzo = r > 1.15 ? -(r - 1.15) * 6 : r < 0.45 ? -(0.45 - r) * 4 : 0;
      return [punteggio(c, scelti, c2) + prezzo + rnd() * 1.5, c];
    }).sort((a, b) => b[0] - a[0]);
    const scelto = valutati[Math.floor(rnd() * Math.min(6, valutati.length))][1];
    o[posto] = scelto;
    resto -= scelto.e;
  });
  return { outfit: o, manca };
}

/** Alternative per un posto, in ordine di abbinamento col resto dell'outfit. `entro` = quanto si può spendere per quel posto. */
export function alternative(capi, ctx, outfit, posto, entro) {
  const { profilo } = ctx, esclusi = ctx.esclusi || new Set();
  const altri = capiDi({ ...outfit, [posto]: null, ...(posto === "abito" ? { sopra: null, sotto: null } : { abito: posto === "scarpe" || posto === "capospalla" ? outfit.abito : null }) });
  const stileGuida = altri.length ? ctx.negozi[altri[0].n].stile : profilo.stili?.[0];
  const c2 = { ...ctx, stileGuida };
  return capi
    .filter(c => postoDi(c) === posto && !esclusi.has(chiave(c)) && haTaglia(c, profilo) && !(profilo.genere === "u" && c.c === "gonna"))
    .map(c => [punteggio(c, altri, c2) - (c.e > entro ? 100 : 0) - (fuoriStagione(c, profilo.freddo ?? profilo.conCapospalla) ? 4 : 0), c])
    .sort((a, b) => b[0] - a[0] || a[1].e - b[1].e)
    .map(x => x[1]);
}

// ---------- leggere le taglie dal sito del marchio (stesse regole di scripts/catalogo.py) ----------
const NUM = {
  FR: { 32: "XXS", 34: "XS", 36: "S", 38: "M", 40: "L", 42: "XL", 44: "XXL", 46: "3XL", 48: "4XL", 50: "4XL" },
  IT: { 36: "XXS", 38: "XS", 40: "S", 42: "M", 44: "L", 46: "XL", 48: "XXL", 50: "3XL", 52: "4XL", 54: "4XL" },
  UK: { 4: "XXS", 6: "XS", 8: "S", 10: "M", 12: "L", 14: "XL", 16: "XXL", 18: "3XL", 20: "4XL", 22: "4XL" },
  AU: { 4: "XXS", 6: "XS", 8: "S", 10: "M", 12: "L", 14: "XL", 16: "XXL", 18: "3XL", 20: "4XL", 22: "4XL" },
  US: { 0: "XXS", 2: "XS", 4: "S", 6: "M", 8: "L", 10: "XL", 12: "XXL", 14: "3XL", 16: "3XL", 18: "4XL", 20: "4XL", 22: "4XL", 24: "4XL", 26: "4XL", 28: "4XL", 30: "4XL", 32: "4XL", 34: "4XL", 36: "4XL", 38: "4XL", 40: "4XL" },
};
const VITA = { 23: "XXS", 24: "XXS", 25: "XS", 26: "S", 27: "S", 28: "M", 29: "M", 30: "L", 31: "L", 32: "XL", 33: "XXL", 34: "XXL" };
const PAROLE_TAGLIA = [["XX-SMALL", "XXS"], ["XXSMALL", "XXS"], ["X-SMALL", "XS"], ["XSMALL", "XS"], ["EXTRASMALL", "XS"], ["SMALL", "S"],
  ["MEDIUM", "M"], ["XX-LARGE", "XXL"], ["XXLARGE", "XXL"], ["X-LARGE", "XL"], ["XLARGE", "XL"], ["EXTRALARGE", "XL"], ["LARGE", "L"]];
const UNICA = /^(o\/?s|one ?size|one|os|tu|taille unique|taglia unica|unica|u|default title)$/i;
/** Etichetta di una variante → taglia a lettere ("M", "XS/S"), "*" per taglia unica, null se non si capisce. */
export function lettera(e, sistema, cat) {
  e = (e || "").trim();
  if (UNICA.test(e)) return "*";
  let up = e.toUpperCase().replace(/ /g, "");
  for (const [lunga, corta] of PAROLE_TAGLIA) up = up.replaceAll(lunga, corta);
  let m = up.match(/^\w+_(\d+)-\d+$/);
  if (m) return NUM.US[+m[1]] || null;
  up = up.replace(/PLUS$/, "");
  if (/^\d+$/.test(up) && up !== e) e = up;
  up = { "1XL": "XXL", "2XL": "XXL", "1X": "XXL", "2X": "XXL", "XXXL": "3XL", "3X": "3XL", "4X": "4XL" }[up] || up;
  m = up.match(/^(XXS|XS|3XL|4XL|XXL|XL|S|M|L)(?:[\/-](XXS|XS|3XL|4XL|XXL|XL|S|M|L))?\b/);
  if (m) return m[1] + (m[2] ? "/" + m[2] : "");
  for (const pre of ["IT", "FR", "EU", "UK", "AU", "US"]) {
    m = e.toUpperCase().match(new RegExp(pre + "\\s*(\\d+)"));
    if (m) return NUM[pre === "EU" ? "FR" : pre][+m[1]] || null;
  }
  m = e.toUpperCase().match(/^(\d+)\s*(IT|FR|EU|UK|AU|US)$/);
  if (m) return NUM[m[2] === "EU" ? "FR" : m[2]][+m[1]] || null;
  if (/^\d+$/.test(e)) {
    const n = +e;
    if ((cat === "jeans" || cat === "pantaloni") && n >= 23 && n <= 34 && ["US", "AU", "UK"].includes(sistema)) return VITA[n] || null;
    return NUM[sistema][n] || null;
  }
  return null;
}
/** Etichetta di una variante di scarpa → numero europeo 35–47, o null. Da US/UK è una conversione indicativa. */
export function numeroScarpa(etichetta, sistema, genere) {
  const e = (etichetta || "").toUpperCase().replace(",", ".");
  let m = e.match(/(?:EU|IT|FR)\s*(\d{2}(?:\.5)?)/) || e.match(/^\s*(\d{2}(?:\.5)?)\s*(?:EU|IT|FR)?\s*$/);
  if (m && +m[1] >= 35 && +m[1] <= 47.5) return Math.floor(+m[1]);
  let sis, n;
  if ((m = e.match(/(US|UK|AU)\s*(\d{1,2}(?:\.5)?)/))) [sis, n] = [m[1], +m[2]];
  else if ((m = e.match(/(\d{1,2}(?:\.5)?)\s*(US|UK|AU)/))) [sis, n] = [m[2], +m[1]];
  else if (/^\s*\d{1,2}(?:\.5)?\s*$/.test(e) && +e < 16) [sis, n] = [sistema, +e];
  else return null;
  if (sis === "FR" || sis === "IT") return null;
  const uomo = genere === "u";
  const eu = Math.floor((sis === "UK" ? n + (uomo ? 33.5 : 33) : n + (uomo ? 33 : 30.5)) + 0.5);
  return eu >= 35 && eu <= 47 ? eu : null;
}
