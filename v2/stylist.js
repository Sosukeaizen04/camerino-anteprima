// Regole dell'outfit: posti, budget, abbinamenti. Nessuna grafica e nessuna rete qui dentro: si prova con `node --test`.

export const TAGLIE = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];
export const NUMERI_SCARPE = [35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47];
export const POSTI = ["capospalla", "sopra", "sotto", "scarpe"];
export const NOME_POSTO = { capospalla: "Giacca", sopra: "Sopra", sotto: "Sotto", scarpe: "Scarpe", abito: "Abito" };

const POSTO_DI = { top: "sopra", camicia: "sopra", maglia: "sopra", pantaloni: "sotto", jeans: "sotto", gonna: "sotto",
  abito: "abito", capospalla: "capospalla", scarpe: "scarpe" };
export const postoDi = capo => POSTO_DI[capo.c];
// `z` è il dominio del negozio, messo dall'app al caricamento: l'indice `n` cambia se una notte un negozio salta,
// e gli outfit salvati o condivisi devono restare validi.
// `dom` = dominio del negozio, messo dall'app al caricamento (prima era `z`, che nel catalogo è lo scollo: il filtro Scollo non funzionava)
export const chiave = c => `${c.dom ?? c.n}|${c.h}|${c.v ?? ""}`;

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
// Lo stile è del CAPO, non del negozio (Emanuele 25/11: "la categoria stile è troppo corta e poco coerente"):
// lo stile del negozio fa da punto di partenza, poi contano nome, fantasia, colore, materiale ed eleganza del capo.
export const AFFINI = {
  Minimal: ["Classico", "Chic", "Casual", "Lusso", "Ufficio"],
  Classico: ["Minimal", "Ufficio", "Chic", "Preppy", "Lusso", "Elegante"],
  Chic: ["Minimal", "Classico", "Romantico", "Preppy"],
  Ufficio: ["Classico", "Minimal", "Elegante", "Chic"],
  Elegante: ["Sera", "Lusso", "Classico", "Ufficio"],
  Lusso: ["Elegante", "Classico", "Minimal", "Sera"],
  Sera: ["Elegante", "Lusso", "Rock"],
  Romantico: ["Chic", "Boho", "Vintage"],
  Boho: ["Romantico", "Vintage", "Mare", "Casual"],
  Vintage: ["Boho", "Romantico", "Rock", "Preppy"],
  Preppy: ["Classico", "Chic", "Casual"],
  Casual: ["Minimal", "Streetwear", "Sportivo", "Preppy", "Boho"],
  Mare: ["Boho", "Casual", "Romantico", "Colorato"],
  Colorato: ["Boho", "Mare", "Romantico"],
  Sportivo: ["Streetwear", "Casual"],
  Streetwear: ["Sportivo", "Casual", "Rock"],
  Rock: ["Streetwear", "Vintage", "Sera"],
};
export const STILI = Object.keys(AFFINI);
// i nomi vecchi (profili salvati, chat) → i nuovi
export const STILE_VECCHIO = { Parigino: "Chic", Italiano: "Classico", Maglieria: "Casual", Denim: "Casual", Colore: "Colorato", Sostenibile: null, Curvy: null };
export const stiliNuovi = l => [...new Set((l || []).map(x => x in STILE_VECCHIO ? STILE_VECCHIO[x] : x).filter(x => x && AFFINI[x]))];
const DAL_NEGOZIO = { Minimal: "Minimal", Parigino: "Chic", Lusso: "Lusso", Romantico: "Romantico", Boho: "Boho", Colore: "Colorato", Italiano: "Classico",
  Maglieria: "Casual", Sostenibile: "Casual", Denim: "Casual", Curvy: null, Sportivo: "Sportivo", Streetwear: "Streetwear", Sera: "Sera", Rock: "Rock" };
const REGOLE_STILE = [
  ["Sera", /sequin|paillett|satin|\bslip dress|velvet|velluto|corset|lurex|metallic|party|cocktail|\bgown|feather|piume|strass|rhinestone|glitter/i],
  ["Romantico", /ruffle|frill|\blace\b|pizzo|dentelle|\bbow\b|fiocco|floral|puff sleeve|smock|broderie|volant|eyelet|pointelle|tulle/i],
  ["Boho", /crochet|uncinetto|fringe|frange|paisley|embroider|ricamat|peasant|tiered|kaftan|caftan|patchwork|macram/i],
  ["Chic", /stripe|righe|breton|marini[eè]re|\btrench|ballet|ballerin|mary ?jane|beret|kitten heel|\bcardigan\b/i],
  ["Classico", /blazer|tailor|sartorial|pleated (trouser|pant)|cigarette|\bchino|cashmere|camel|wool coat|cappotto|loafer|mocassin|oxford|button[- ]down|gabardin/i],
  ["Ufficio", /blazer|tailor|suit\b|trouser|pantalone|pencil skirt|\bshirt\b|camicia|blouse|loafer|pump|d[ée]collet|oxford|vest(?! top)|gilet/i],
  ["Preppy", /\bpolo\b|cable|trecce|argyle|pleated (mini|skirt)|varsity|tennis|cricket|rugby|plaid|tartan|\bcheck/i],
  ["Vintage", /vintage|retro|r[ée]tro|\b(60|70|80|90)s\b|flare|corduroy|\bcord\b|polka|pois|western|cowboy|suede|camoscio/i],
  ["Mare", /\blinen|\blino\b|\blin\b|beach|resort|\bsandal|espadrill|raffia|rafia|kaftan|terry|spugna|swim/i],
  ["Rock", /leather jacket|biker|\bstud|borchie|combat|grunge|\bmesh\b|chain|skull|lace[- ]up boot|creeper|platform boot|faux leather/i],
  ["Streetwear", /cargo|hoodie|graphic|oversized tee|baggy|parachute|bomber|logo|skate|puffer|track jacket/i],
  ["Sportivo", /legging|jogger|track ?pant|running|\bactive|sport|training|yoga|tennis skirt|sneaker/i],
  ["Casual", /\bjeans?\b|denim|t-?shirt|\btee\b|sweatshirt|felpa|hoodie|sneaker|chino|henley|\bknit\b|maglion|sweater|jumper|cardigan|overshirt/i],
];
/** Gli stili di un capo (al massimo 4), calcolati una volta. */
export function stiliDi(c, negozi) {
  if (c._st) return c._st;
  const st = new Set(), base = DAL_NEGOZIO[negozi[c.n].stile], r = registro(c);
  if (base) st.add(base);
  for (const [nome, rx] of REGOLE_STILE) if (rx.test(c.t)) st.add(nome);
  if (c.q === "fiori") st.add("Romantico"); if (c.q === "righe") st.add("Chic"); if (c.q === "pois") st.add("Vintage"); if (c.q === "quadri") st.add("Preppy");
  if (c.f === "lino") st.add("Mare"); if (c.f === "denim" || c.c === "jeans") st.add("Casual"); if (c.f === "velluto") st.add("Vintage");
  if (r === 3) st.add("Elegante"); if (r === 0) st.add("Sportivo");
  const neutro = tipoColore(c) === "neutro", liscio = !c.q && !/ruffle|frill|lace|sequin|print|stampa|logo|graphic|embroider|fringe/i.test(c.t);
  const espressivo = ["Sportivo", "Streetwear", "Rock", "Boho", "Romantico", "Vintage", "Sera"].some(x => st.has(x));
  if (neutro && liscio && r >= 2 && !espressivo) st.add("Minimal");
  if (tipoColore(c) === "acceso" && !c.q) st.add("Colorato");
  // coerenza: un capo a fantasia o con volant non è Minimal anche se il negozio lo è; un capo neutro non è Colorato
  if (!(neutro && liscio) || r === 0) st.delete("Minimal");
  if (tipoColore(c) === "neutro") st.delete("Colorato");
  if (r >= 3 && (/cashmere|silk|seta|soie|leather|pelle|cuir/i.test(c.t) || ["cashmere", "seta", "pelle"].includes(c.f)) && c.e >= 250) st.add("Lusso");
  // ciò che contraddice il livello di eleganza esce: niente "Ufficio" o "Elegante" per una felpa, niente "Sportivo" per un blazer
  if (r <= 1) { st.delete("Ufficio"); st.delete("Elegante"); st.delete("Lusso"); st.delete("Sera"); }
  if (r >= 2) st.delete("Sportivo");
  if (!st.size) st.add(r >= 2 ? "Classico" : "Casual");
  return c._st = st;
}
/** Lo stile principale (per i punteggi): il primo degli stili del capo che è anche nello stile guida, se no il primo. */
const stilePrincipale = (c, negozi) => [...stiliDi(c, negozi)][0];
/** Quanto è elegante un capo: 0 sportivo, 1 casual, 2 curato, 3 elegante (dal catalogo; senza dato vale "curato"). */
// jeans, chambray, cargo, felpe e tute in denim sono al massimo "casual", qualunque cosa dica il dato (giro 9: ✓ elegante su un vestito di jeans)
const RX_CASUAL_SEMPRE = /sneakers?|trainers?|new balance|zapatilla|\bcasual\b|\bdenim\b|\bjeans?\b|chambray|vaquer|cargo|sweatshirt|hoodie|\bfelpa|jogger|track ?pants?/i;
export const registro = c => { const r = c.r ?? 2; return c.c === "jeans" || RX_CASUAL_SEMPRE.test(c.t) ? Math.min(r, 1) : r; };
// stili che non vogliono capi sportivi, e quelli che chiedono almeno "curato" (Andrea 20/11: lusso italiano ≠ hip hop)
const SENZA_SPORT = new Set(["Lusso", "Classico", "Sera", "Chic", "Minimal", "Romantico", "Elegante", "Ufficio", "Preppy"]);
const CURATI = new Set(["Lusso", "Classico", "Sera", "Elegante", "Ufficio"]);
// negozi di scarpe che non stanno con stili curati se non li si sceglie
const SCARPE_DI_STRADA = new Set(["Rock", "Streetwear", "Sportivo"]);
/** Il capo è ammesso dagli stili scelti? `stretto` = solo gli stili scelti, altrimenti anche gli affini. */
/** Il livello di eleganza va bene per gli stili scelti? (vale anche quando si allarga ad altri negozi) */
export function eleganzaOk(capo, stili) {
  if (!stili?.length) return true;
  const r = registro(capo);
  if (stili.every(s => SENZA_SPORT.has(s)) && r === 0) return false;
  return !(stili.every(s => CURATI.has(s)) && r < 2);
}
/** Allargando si resta lontani dai negozi di un mondo diverso (rock, streetwear, sportivo) se non li si è scelti. */
export function compatibile(capo, stili, negozi) {
  if (!eleganzaOk(capo, stili)) return false;
  if (!stili?.length || stili.some(s => SCARPE_DI_STRADA.has(s))) return true;
  return !SCARPE_DI_STRADA.has(negozi[capo.n].stile);
}
export function nelloStile(capo, stili, negozi, stretto) {
  if (!stili?.length) return true;
  if (!eleganzaOk(capo, stili)) return false;
  const st = stiliDi(capo, negozi), negozio = negozi[capo.n].stile;
  // le scarpe: basta che non siano di un negozio "di strada" se lo stile non lo è, o che abbiano lo stile
  if (postoDi(capo) === "scarpe") return stili.some(s => st.has(s)) || !SCARPE_DI_STRADA.has(negozio) || stili.some(s => SCARPE_DI_STRADA.has(s));
  return stili.some(s => st.has(s)) || (!stretto && stili.some(s => AFFINI[s]?.some(a => st.has(a))));
}
// senza stili scelti si parte da quelli più portabili, non da quelli di nicchia (sera, rock…)
const COMUNI = ["Minimal", "Casual", "Chic", "Classico", "Romantico", "Colorato"];
/** Quanto un capo sta con uno stile: 2 se lo ha, 1 se ne ha uno affine, -2 se no. */
const affinita = (guida, st) => st.has(guida) ? 2 : AFFINI[guida]?.some(a => st.has(a)) ? 1 : -2;

// ---------- stagione ----------
const DA_CALDO = /hot ?pants?\b|hotpant|\bsummer\b|\bbeach\b|\bplage\b|\bplaya\b|\bsheer\b|\bvoile\b|\bgauze\b|hot ?pants|shorty|skort|\bthong\b|infradito|pantal[oó]n corto|pantaloncin|short pants|kurze hose|halter|strapless|backless|bandeau|sandal|slide|adilette|slipper|pantofol|ciabatt|claquette|\bmules?\b|slingback|open.?toe|strappy|feather|espadrill|flip.?flop|tong\b|shorts?\b|bermuda|\blinen|\blin\b|\blino\b|crochet|raffia|sleeveless|sans manches|d[ée]bardeur|canott|\btank\b|\bcami\b|bandeau|bikini|mini ?short/i;
const DA_FREDDO = /\bbotas?\b|\bbotines?\b|sweater|jumper|maglion|turtleneck|col roul|\bpull\b|\bboots?\b|bottes?|bottines?|stival|\bwool|laine|\blana\b|cashmere|cachemire|puffer|piumin|doudoune|shearling|fleece|polaire|velvet|velours|turtleneck|col roul/i;
/** Il capo è fuori stagione? `freddo` = si sta componendo per i mesi freddi. Vale solo per le proposte, non per la ricerca. */
export const fuoriStagione = (capo, freddo) => (freddo ? DA_CALDO : DA_FREDDO).test(capo.t) ||
  // pantaloni corti d'inverno anche se il nome non lo dice (hot pants, shorty, skort: il catalogo sa la lunghezza)
  (!!freddo && capo.c === "pantaloni" && (capo.l === "corta" || /hot ?pants?|shorty|skort/i.test(capo.t))) ||
  // d'inverno un abito senza maniche o a maniche corte è da estate, salvo che sia di lana o velluto
  (!!freddo && capo.c === "abito" && (capo.w === "senza" || capo.w === "corte") && !["lana", "cashmere", "velluto"].includes(capo.f));

// ---------- comporre ----------
// una t-shirt dal titolo lungo è quasi sempre una maglietta con scritta ("Welcome to the Party … Tee")
const maglietta_scritta = c => /\btee\b|t-?shirt/i.test(c.t) && c.t.split(/\s+/).length > 6;
const RX_NON_BASE = /\bi love\b|\bcargo\b|boiler ?suit|track ?pants?|\blogo|graphic|slogan|\bprinted tee|\bsocks?\b|calzin|chaussette|\bthong|infradito|raffia|rafia|espadrill|tie[- ]?dye|\bvarsity|\bcollege\b|cartoon|mickey|disney|hello kitty|\bbandana/i;
const RX_SPOSA = /bridal|\bbride\b|wedding (dress|gown)|abito da sposa|robe de mari[ée]e|vestido de novia/i;
const RX_GILET_GIACCA = /gilet|\bvest\b|waistcoat|chaleco|smanicat|sleeveless/i;
const PESO = { capospalla: 0.35, sopra: 0.20, sotto: 0.22, scarpe: 0.23, abito: 0.42 };

/** Generatore casuale con seme, per avere outfit ripetibili nelle prove. */
export function casuale(seme) {
  // il seme si mescola e i primi numeri si scartano: con semi piccoli (1, 2, 3…) il primo numero era sempre vicino a 0,
  // e "Nuovo look" proponeva sempre un abito
  let s = Math.imul(seme >>> 0 || 1, 2654435761) >>> 0 || 1;
  for (let i = 0; i < 8; i++) { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; }
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/** Quanto un candidato sta bene con i capi già scelti (più alto è meglio). */
export function punteggio(capo, scelti, ctx) {
  const { profilo, negozi, stileGuida } = ctx;
  let p = 0;
  // stile: vicino allo stile guida e a quello dei capi già scelti
  const st = stiliDi(capo, negozi), pesoStile = postoDi(capo) === "scarpe" ? 0.4 : 1;   // poche marche fanno scarpe: lo stile pesa meno
  if (stileGuida) p += affinita(stileGuida, st) * pesoStile;
  for (const s of scelti) p += affinita(stilePrincipale(s, negozi), st) * 0.5 * pesoStile;
  // colore: al massimo un colore acceso o una fantasia, il resto neutri
  const tipo = tipoColore(capo), altri = scelti.map(tipoColore);
  if (tipo === "neutro") p += 1.5;
  else if (tipo === "fantasia") p += altri.includes("fantasia") ? -7 : altri.includes("acceso") ? -2.5 : 0;
  else {
    const accesi = scelti.filter(s => tipoColore(s) === "acceso");
    if (!accesi.length) p += altri.includes("fantasia") ? -1 : 1;
    else p += accesi.every(s => dist(lab(s.x), lab(capo.x)) < 22) ? 0.5 : -7;
  }
  // palette: conta per ciò che sta vicino al viso (un colore stimato dalla foto vale poco)
  if (profilo.stagione && ["sopra", "abito", "capospalla"].includes(postoDi(capo))) {
    const d = distPalette(capo, profilo.stagione), peso = capo.m ? 0.5 : 1;
    if (d !== null) p += (d < 18 ? 2 : d < 30 ? 1 : -3) * peso;
  }
  if (ctx.elegante) p += registro(capo) === 3 ? 2 : 0;               // per una sera si preferisce il capo più elegante
  if (ctx.recenti?.has(chiave(capo))) p -= postoDi(capo) === "capospalla" || postoDi(capo) === "scarpe" ? 6 : 3;   // giacche e scarpe si notano di più                         // già visto negli ultimi look
  // un solo protagonista (giro 4: giacca di jeans + gonna a stampa + sneakers verdi in un look parigino)
  const fantasia = c => !!c.q && c.q !== "tinta unita";
  if (fantasia(capo) && scelti.some(fantasia)) p -= 7;
  // lo stile scelto si vede nei capi, non solo nel negozio (giro 4: Minimal con colori accesi, Denim senza denim)
  if (profilo.stili?.includes("Minimal") && !profilo.stili.includes("Colore") && (tipo === "acceso" || fantasia(capo) || /lurex|metallic|sequin|paillette|tapestry|jacquard|glitter/i.test(capo.t))) p -= 9;
  // senza stili scelti, i negozi di nicchia (rock, streetwear) passano in fondo
  if (!profilo.stili?.length && ["Rock", "Streetwear"].includes(negozi[capo.n].stile)) p -= 4;
  if (!profilo.stili?.length && registro(capo) === 0) p -= 3;                 // senza stili, i capi sportivi (track pants col logo) passano in fondo
  if (profilo.stili?.includes("Denim") && postoDi(capo) !== "scarpe" && (capo.c === "jeans" || capo.f === "denim" || /\bdenim\b/i.test(capo.t)) && !scelti.some(c => c.c === "jeans" || c.f === "denim")) p += 4;
  const denim = c => c.c === "jeans" || c.f === "denim" || /\bdenim\b|\bjean\b|vaquer|tejan|chambray/i.test(c.t);
  if (denim(capo) && scelti.some(denim)) p -= 6;
  if (postoDi(capo) === "scarpe" && profilo.stili?.length && profilo.stili.every(s => SENZA_SPORT.has(s)) && (capo.y === "sneakers" || /sneaker|trainer|baskets?\b|zapatilla/i.test(capo.t))) p -= 5;
  // eleganza: una felpa non va con un pantalone sartoriale (Andrea 20/11)
  for (const s of scelti) { const d = Math.abs(registro(s) - registro(capo)); p -= d >= 2 ? 6 : d * 0.8; }
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
    if (negozi[c.n].stile === "Rock" && !profilo.stili?.includes("Rock")) continue;   // goth/rock solo se scelto (giro 9: scarpe Killstar in "Ci sta bene con")
    if (!p || esclusi.has(chiave(c)) || !haTaglia(c, profilo) || fuoriStagione(c, profilo.freddo ?? profilo.conCapospalla)) continue;
    if (!ctx.sposa && RX_SPOSA.test(c.t)) continue;
    // buon senso sul prezzo: con un budget da 200 € in su niente capi da pochi euro accanto a capi da centinaia (giro 3: look "ufficio" con capi da 12 €)
    if (profilo.budget >= 200 && c.e < profilo.budget * (ctx.elegante ? 0.08 : 0.06)) continue;   // per un look elegante la soglia sale
    if (ctx.elegante && /rain ?boots?|rubber|wellington|wellies|gomma|caoutchouc|botas? de agua|gummistiefel/i.test(c.t)) continue;
    // abbigliamento da pioggia e tecnico solo se lo si chiede (giro 5: Rains Dry Boot quasi sempre tra i suggeriti)
    // capi "base" per gli stili curati: niente loghi, scritte, calzini, tie dye, zeppe di rafia (giro 6)
    if ((ctx.elegante || (profilo.stili?.length && profilo.stili.every(s => SENZA_SPORT.has(s)))) && (RX_NON_BASE.test(c.t) || maglietta_scritta(c))) continue;
    if (p === "sopra" && /bodysuit|\bbody\b/i.test(c.t)) continue;      // un body fotografato addosso sembra intimo: nei look no, in Scopri sì (giro 7)
    if (/plasticana|adilette|pool ?slide|\bcrocs\b|zuecos?|\bclogs?\b/i.test(c.t)) continue;   // mai, nemmeno d'estate (giro 8)      // giro 6: zoccoli di plastica e ciabatte da piscina con un cappotto
    // Minimal: tinta unita e niente lucido (giro 6: tapestry, "Rosewater Shine")
    if (profilo.stili?.includes("Minimal") && !profilo.stili.includes("Colore") && p !== "scarpe" && (c.q || /shine|lurex|metallic|sequin|paillette|tapestry|jacquard|glitter/i.test(c.t))) continue;
    if (!ctx.pioggia && /\brain ?(coat|jacket|pants|boots?)\b|rainboot|dry boot|\bwaders?\b|\bski\b|soft ?shell/i.test(c.t)) continue;                                   // l'abito da sposa solo se lo si chiede (giro 2: bridal gown nei look di tutti i giorni)
    if (p === "capospalla" && (profilo.freddo ?? profilo.conCapospalla) && RX_GILET_GIACCA.test(c.t)) continue;   // d'inverno un gilet non fa da giacca
    if (profilo.genere === "u" && (p === "abito" || c.c === "gonna")) continue;
    per[p].push(c);
  }
  // il prezzo minimo da tenere da parte per un posto: quello del capo più economico NELLO STILE (e nei colori), se c'è.
  // Col minimo di tutto il catalogo giacca e scarpe si prendevano il budget e per il sopra restava solo streetwear economico.
  const minimoDi = l => l.length ? Math.min(...l.map(c => c.e)) : Infinity;
  const minimi = {};
  const minimo = p => minimi[p] ??= [
    c => nelloStile(c, profilo.stili, negozi, false) && inPalette(c, profilo.stagione, p),
    c => compatibile(c, profilo.stili, negozi),
    () => true,
  ].map(f => minimoDi(per[p].filter(f))).find(Number.isFinite) ?? Infinity;

  // quali posti riempire
  let daFare = [];
  const corpoBloccato = o.abito || o.sopra || o.sotto;
  // l'abito si propone solo se ci sta nel budget insieme alle scarpe: se no si ragiona a sopra + sotto
  const abitoCiSta = minimo("abito") + (o.scarpe ? 0 : minimo("scarpe")) <= profilo.budget - totale(o);
  // l'abito chiesto (stylist) o l'unica scelta possibile si usa sempre; se no 3 volte su 10 (collaudo 25/11: "vestito rosso" diventava altro)
  const soloAbito = per.abito.length && (!per.sopra.length || !per.sotto.length);
  const usaAbito = !corpoBloccato && profilo.genere !== "u" && (ctx.vuoleAbito || soloAbito || (abitoCiSta && rnd() < 0.3));
  if (o.abito) { /* abito bloccato: niente sopra/sotto */ }
  else if (usaAbito) daFare.push("abito");
  else { if (!o.sopra) daFare.push("sopra"); if (!o.sotto) daFare.push("sotto"); }
  if (!o.scarpe) daFare.push("scarpe");
  if (profilo.conCapospalla && !o.capospalla) daFare.push("capospalla");
  daFare.sort((a, b) => PESO[b] - PESO[a]);

  const stileGuida = profilo.stili?.length ? profilo.stili[Math.floor(rnd() * profilo.stili.length)]
    : capiDi(o).length ? stilePrincipale(capiDi(o)[0], negozi) : COMUNI[Math.floor(rnd() * COMUNI.length)];
  const c2 = { ...ctx, stileGuida };
  const manca = [], largo = [], fuoriPalette = [];
  let resto = profilo.budget - totale(o);

  daFare.forEach((posto, i) => {
    const dopo = daFare.slice(i + 1);
    // il capospalla è facoltativo: non deve togliere soldi ai posti obbligatori
    // il capospalla di solito è facoltativo e non toglie soldi agli altri; se è stato chiesto (obbligaGiacca) gli si tiene il posto (giro 8)
    const riserva = dopo.filter(p => p !== "capospalla" || profilo.obbligaGiacca).reduce((t, p) => t + minimo(p), 0);
    const tetto = resto - (Number.isFinite(riserva) ? riserva : 0);
    const pesi = [posto, ...dopo].reduce((t, p) => t + PESO[p], 0);
    const obiettivo = Math.max(minimo(posto), resto * PESO[posto] / pesi);
    const scelti = capiDi(o);
    let cand = per[posto].filter(c => c.e <= tetto);
    if (!cand.length) { if (posto !== "capospalla" || profilo.obbligaGiacca) manca.push({ posto, daEuro: minimo(posto) }); return; }
    // stile e colori sono vincoli, non suggerimenti: si allarga solo se nel budget non resta niente (e lo si dice)
    // la palette conta più del negozio (Andrea 20/11: "solo cose che vanno bene con l'armocromia")
    const gradi = [
      c => nelloStile(c, profilo.stili, negozi, true) && inPalette(c, profilo.stagione, posto),
      c => nelloStile(c, profilo.stili, negozi, false) && inPalette(c, profilo.stagione, posto),
      c => compatibile(c, profilo.stili, negozi) && inPalette(c, profilo.stagione, posto),
      c => nelloStile(c, profilo.stili, negozi, false),
      c => compatibile(c, profilo.stili, negozi),
      c => eleganzaOk(c, profilo.stili),
    ];
    // il grado più fedele che abbia almeno un capo: meglio un solo capo nello stile che tre fuori stile
    // (prima si cercava il primo grado con 3 capi e si finiva sulle scarpe rock per uno stile lusso)
    let g = gradi.findIndex(f => cand.filter(f).length >= 3);
    const primo = gradi.findIndex(f => cand.some(f));
    if (g < 0 || primo < g) g = primo;
    // varietà: se lo stile esatto ha pochi capi si aggiungono gli stili affini (il punteggio mette comunque prima quelli esatti)
    if (g === 0 && cand.filter(gradi[0]).length < 8) g = 1;
    if (g >= 0) cand = cand.filter(gradi[g]);
    if (g < 0 || g >= 2 && profilo.stili?.length) largo.push(posto);
    if ((g < 0 || g === 3 || g === 4 || g === 5) && profilo.stagione && ["sopra", "abito", "capospalla"].includes(posto)) fuoriPalette.push(posto);
    const valutati = cand.map(c => {
      const r = c.e / obiettivo;                         // meglio usare il budget che prendere il capo più economico
      const prezzo = r > 1.15 ? -(r - 1.15) * 6 : r < 0.45 ? -(0.45 - r) * 4 : 0;
      return [punteggio(c, scelti, c2) + prezzo + rnd() * 1.5, c];
    }).sort((a, b) => b[0] - a[0]);
    const scelto = valutati[Math.floor(rnd() * Math.min(6, valutati.length))][1];
    o[posto] = scelto;
    resto -= scelto.e;
  });
  return { outfit: o, manca, largo, fuoriPalette };
}
/** Colore adatto alla stagione per ciò che sta vicino al viso: neutro o vicino alla palette, e dichiarato dal negozio. */
export function inPalette(capo, stagione, posto = postoDi(capo)) {
  if (!stagione || !["sopra", "abito", "capospalla"].includes(posto)) return true;
  if (capo.m || !capo.x) return false;
  return tipoColore(capo) === "neutro" || distPalette(capo, stagione) < 30;
}

/** Alternative per un posto, in ordine di abbinamento col resto dell'outfit. `entro` = quanto si può spendere per quel posto. */
export function alternative(capi, ctx, outfit, posto, entro) {
  const { profilo } = ctx, esclusi = ctx.esclusi || new Set();
  const altri = capiDi({ ...outfit, [posto]: null, ...(posto === "abito" ? { sopra: null, sotto: null } : { abito: posto === "scarpe" || posto === "capospalla" ? outfit.abito : null }) });
  const stileGuida = profilo.stili?.[0] || (altri.length ? stilePrincipale(altri[0], ctx.negozi) : null);
  const c2 = { ...ctx, stileGuida };
  return capi
    .filter(c => postoDi(c) === posto && !esclusi.has(chiave(c)) && haTaglia(c, profilo) && !(profilo.genere === "u" && c.c === "gonna")
      && !(posto === "capospalla" && (profilo.freddo ?? profilo.conCapospalla) && RX_GILET_GIACCA.test(c.t))
      && !(profilo.budget >= 200 && c.e < profilo.budget * 0.06) && !RX_SPOSA.test(c.t)
      && !/\brain ?(coat|jacket|pants|boots?)\b|rainboot|dry boot|\bwaders?\b|\bski\b|soft ?shell|plasticana|adilette|pool ?slide|\bcrocs\b|zuecos?|\bclogs?\b/i.test(c.t)
      && !((profilo.stili?.length && profilo.stili.every(s => SENZA_SPORT.has(s))) && RX_NON_BASE.test(c.t)))
    .map(c => [punteggio(c, altri, c2) - (c.e > entro ? 100 : 0) - (fuoriStagione(c, profilo.freddo ?? profilo.conCapospalla) ? 4 : 0)
      - (nelloStile(c, profilo.stili, ctx.negozi, false) ? 0 : 8) - (inPalette(c, profilo.stagione, posto) ? 0 : 4), c])
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

// ---------- sottocategorie di Scopri (Andrea 24/11: "Top → felpe e hoodie, camicie e top…") ----------
// dal tipo di capo del catalogo (c), dal tipo di scarpa (y) e dal nome; l'ordine conta: vince la prima che va bene
const RX_FELPA = /hoodie|hoody|sweatshirt|sweat-shirt|\bsweat\b|felpa|sudadera|zip-?up hood|fleece/i;
// "crewneck" da solo è spesso un maglione (Soft Knit Boxy Crewneck Sweater): felpa solo se non è maglia
const RX_MAGLIA_NOME = /sweater|knit|wool|cashmere|merino|alpaca|mohair|\bpull\b|jumper|maglion/i;
const RX_TSHIRT = /t-?shirt|t shirt|\btee\b|tees\b|camiseta|\bpolo\b/i;
const RX_CANOTTA = /tank|\bcami\b|camisole|canott|d[ée]bardeur|bralette|bustier|corset|tube top|bandeau/i;
const RX_GILET = /gilet|\bvest\b|waistcoat|chaleco/i;
const RX_SHORTS = /shorts?\b|bermuda|skort/i;
export const SOTTOCATEGORIE = {
  sopra: [["camicie", "Camicie e bluse", c => c.c === "camicia" || /blouse|blusa|chemise|camicia/i.test(c.t) && !RX_TSHIRT.test(c.t)],
    ["felpe", "Felpe e hoodie", c => RX_FELPA.test(c.t) || (/crewneck|crew neck/i.test(c.t) && c.c !== "maglia" && !RX_MAGLIA_NOME.test(c.t) && !RX_TSHIRT.test(c.t))],
    ["tshirt", "T-shirt e polo", c => RX_TSHIRT.test(c.t)],
    ["maglie", "Maglioni e maglie", c => c.c === "maglia"],
    ["canotte", "Canotte e corsetti", c => RX_CANOTTA.test(c.t)],
    ["top", "Top", () => true]],
  sotto: [["jeans", "Jeans", c => c.c === "jeans"], ["shorts", "Shorts", c => RX_SHORTS.test(c.t)], ["gonne", "Gonne", c => c.c === "gonna"], ["pantaloni", "Pantaloni", () => true]],
  capospalla: [["blazer", "Blazer", c => /blazer/i.test(c.t)], ["gilet", "Gilet e smanicati", c => RX_GILET.test(c.t)], ["piumini", "Piumini", c => /puffer|padded|down jacket|piumin|doudoune/i.test(c.t)],
    ["trench", "Trench", c => /trench/i.test(c.t)], ["cappotti", "Cappotti", c => /coat|manteau|cappott|abrigo|parka/i.test(c.t)],
    ["giacche", "Giacche", () => true]],
  abito: [["sera", "Da sera", c => registro(c) === 3], ["mini", "Corti", c => c.l === "corta" || /\bmini\b/i.test(c.t)], ["midi", "Midi", c => c.l === "media" || /\bmidi\b/i.test(c.t)],
    ["lunghi", "Lunghi", c => c.l === "lunga" || /maxi|long dress|\blong\b/i.test(c.t)], ["altri", "Altri abiti", () => true]],
  scarpe: [["decollete", "Décolleté", c => c.y === "décolleté" && !/ballerin|ballet|\bflats?\b|mocassin|loafer/i.test(c.t)], ["stivali", "Stivali", c => c.y === "stivali"], ["stivaletti", "Stivaletti", c => c.y === "stivaletti"],
    ["sneakers", "Sneakers", c => c.y === "sneakers"], ["mocassini", "Mocassini", c => c.y === "mocassini"], ["ballerine", "Ballerine", c => c.y === "ballerine" || /ballerin|ballet/i.test(c.t)],
    ["sandali", "Sandali e mules", c => c.y === "sandali" || c.y === "mules"], ["altre", "Altre", () => true]],
};
/** Il nome del posto per l'etichetta: una tuta non è un abito (giro 7). */
export const nomeCapo = (c, p = postoDi(c)) => p === "abito" && /jumpsuit|playsuit|romper|overall|\btuta\b|combinaison|\bmono\b|boiler ?suit/i.test(c.t) ? "Tuta" : NOME_POSTO[p];
/** La sottocategoria di un capo nel suo reparto. */
export function sottoDi(capo, posto = postoDi(capo)) {
  const l = SOTTOCATEGORIE[posto]; if (!l) return null;
  return (l.find(([, , f]) => f(capo)) || l[l.length - 1])[0];
}
