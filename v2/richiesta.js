// Camerino v2 — dallo stylist (chat) al look: l'AI capisce la richiesta, qui si scelgono i capi veri.
// Separato da app.js perché si possa provare con node (v2/richiesta.test.js) sul catalogo vero.
import * as S from "./stylist.js";

export const COLORI_FILTRO = [["nero", "#141414"], ["bianco", "#f7f7f5"], ["panna", "#f1ead8"], ["beige", "#d6c3a3"], ["cammello", "#b0814f"], ["marrone", "#5a3d2b"], ["grigio", "#8d8d8d"],
  ["navy", "#1c2541"], ["blu", "#2f5d9e"], ["azzurro", "#8fb6dd"], ["verde", "#3f6b45"], ["oliva", "#6b6b3a"], ["rosso", "#b3202a"], ["bordeaux", "#5c1a26"], ["rosa", "#e7a3b5"],
  ["arancione", "#e5762b"], ["giallo", "#f0cf3a"], ["viola", "#5e3a87"], ["lilla", "#c3a6d8"]];
const LAB = Object.fromEntries(COLORI_FILTRO.map(([v, hex]) => [v, S.lab(hex)]));
// il colore stimato dalla foto (m) non conta: le foto con modella e sfondo ingannano (Andrea 20/11)
export const coloreDi = (c, nome) => !c.m && c.x && LAB[nome] && Math.hypot(...S.lab(c.x).map((v, i) => v - LAB[nome][i])) < 16;
const lunghezzaOk = (c, v) => v === "normale" ? !c.l || c.l === "media" : c.l === v;

export const RX_SCARPE = { stivali: /boot|botte|bottine|stival/i, sneakers: /sneaker|trainer|basket/i, tacchi: /heel|pump|escarpin|d[ée]collet|tacc|stiletto|slingback|mary ?jane/i,
  sandali: /sandal/i, mocassini: /loafer|mocassin|moccasin/i, ballerine: /ballet|ballerin|\bflats?\b/i };
const RX_GIACCA = { cappotto: /coat|manteau|cappott|abrigo/i, giacca: /jacket|veste|giacc|chaqueta/i, blazer: /blazer/i, piumino: /puffer|padded|down\b|piumin|doudoune/i, trench: /trench/i };
// cose che non vanno in un look elegante anche se il negozio le fa "curate" (giro 2: camicia di flanella a quadri, scarponi con plateau per l'ufficio)
export const RX_NON_ELEGANTE = /knit vest|sweater vest|casual pants?|adilette|plasticana|pool ?slide|\bski\b|soft ?shell|technical|tecnic|waterproof|\brains?\b|dry boot|creepers?|stompers?|lace[- ]?up boots?|rain ?boots?|rubber|wellington|wellies|caoutchouc|gummistiefel|flannel|flanella|plaid|lumberjack|\blug\b|lug ?sole|platform|plateau|combat|chunky|hiking|trek|worker|biker|cargo|fleece|quilted|puffer|padded|sneaker|trainer|baskets?\b|zapatilla|running|canvas|clog|zueco|crocs|slides?\b|flip|distressed|ripped|graphic|logo|slogan/i;
export const RX_SPORT = /\b(t-?shirt|t shirt|tee|hoodie|sweatshirt|sudadera|jogger|sweat ?pants?|track|legging|cargo|active|zip-?up|fleece|windbreaker|anorak|puffer|bomber|sport|felpa|chándal|basico tinto|rain ?(coat|jacket)|shell jacket|hooded jacket|parka)/i;
// il tipo di scarpa: prima il dato del catalogo (y, u), se manca il nome. "Boat shoes" con la suola alta non sono tacchi (24/11)
const TIPO_Y = { stivali: ["stivali", "stivaletti"], sneakers: ["sneakers"], sandali: ["sandali"], mocassini: ["mocassini"], ballerine: ["ballerine"],
  tacchi: ["décolleté"] };
export function scarpaDiTipo(c, tipo) {
  if (tipo === "stivali" && /creeper|sneaker|loafer|mocassin|derby|oxford|mule|sandal/i.test(c.t)) return false;   // giro 4: "Nocturnal Creepers" non sono stivali
  if (!c.y) return !!RX_SCARPE[tipo]?.test(c.t);
  if (TIPO_Y[tipo]?.includes(c.y)) return true;
  // stivaletti, sandali e mules col tacco medio o alto valgono come "scarpa col tacco"
  return tipo === "tacchi" && ["medio", "alto"].includes(c.u) && ["stivali", "stivaletti", "sandali", "mules"].includes(c.y);
}

/** Il capo rispetta quello che lo stylist ha capito per il suo posto? */
export function vaPerRichiesta(c, r, negozi) {
  const p = S.postoDi(c);
  const pz = p === "abito" ? r.abito_dettagli : p === "capospalla" ? r.giacca_dettagli : r[p];
  if (r.abito === true && (p === "sopra" || p === "sotto")) return false;
  if (r.abito === false && p === "abito") return false;
  // un vestito chiesto non è una tuta (collaudo 25/11: "vestito rosso" → tuta marrone)
  if (p === "abito" && !r.tuta && /jumpsuit|playsuit|romper|overall|\btuta\b|combinaison|salopette|boiler ?suit/i.test(c.t)) return false;
  if (r.stili?.length && p !== "scarpe" && !r.stili.includes(negozi[c.n].stile)) return false;
  if (r.elegante && S.registro(c) < 2) return false;                      // per una cena: niente casual né sportivo, scarpe comprese
  if (r.elegante && p !== "scarpe" && RX_SPORT.test(c.t)) return false;
  if (r.elegante && RX_NON_ELEGANTE.test(c.t)) return false;
  if (r.elegante && /corduroy|\bcord\b|velluto a coste/i.test(c.t) && r.caldo === true) return false;   // velluto a coste a un matrimonio estivo
  if (r.elegante && /\bbeach\b|spiaggia/i.test(c.t)) return false;
  if (r.elegante && p === "sotto" && /pantal[oó]n corto|\bshorts?\b|bermuda|cargo/i.test(c.t)) return false;   // giro 8: pantaloncini e cargo a un matrimonio
  // per una sera o l'ufficio niente negozi di un mondo diverso (Killstar, streetwear) se non li si chiede (giro 4)
  if (r.elegante && ["Rock", "Streetwear", "Sportivo"].includes(negozi[c.n].stile) && !r.stili?.includes(negozi[c.n].stile)) return false;
  if (negozi[c.n].stile === "Rock" && !r.stili?.includes("Rock")) return false;   // goth/rock solo se chiesto (giro 5: "casual" con stivali Killstar)
  if (r.elegante && p === "scarpe" && /lace[- ]?up|stringat|combat|biker|creeper|hiker|work ?boot|\bstompers?\b/i.test(c.t)) return false;
  if (!pz) return true;
  if (pz.tipo) {
    if (p === "scarpe" && !scarpaDiTipo(c, pz.tipo)) return false;
    if (p === "capospalla" && !RX_GIACCA[pz.tipo]?.test(c.t)) return false;
    if ((p === "sopra" || p === "sotto") && c.c !== pz.tipo) return false;
    if (pz.tipo === "pantaloni" && /legging|\btrack\b|jogger|sweat ?pants?|chándal/i.test(c.t)) return false;
    if (p === "sotto" && /salopette|overall|dungaree|peto\b/i.test(c.t)) return false;   // giro 9: "jeans" ≠ salopette     // giro 6–8: "pantaloni" non sono leggings né pantaloni della tuta
  }
  if (pz.colori?.length && !pz.colori.some(n => coloreDi(c, n))) return false;
  if (pz.materiale && c.f !== pz.materiale) return false;
  if (pz.lunghezza && !lunghezzaOk(c, pz.lunghezza)) return false;
  if (pz.maniche && c.w !== pz.maniche) return false;
  return true;
}

const vuoto = x => !x || !(x.tipo || x.colori?.length || x.materiale || x.maniche || x.lunghezza);
const dettagliDi = (r, p) => p === "capospalla" ? r.giacca_dettagli : p === "abito" ? r.abito_dettagli : r[p];

/**
 * Compone il look della richiesta.
 * Regola (Andrea 24/11): ciò che si chiede per nome (camicia, pantalone marrone, tacco) NON si cambia mai con altro.
 * Si allarga prima lo stile, poi il colore/materiale, poi il budget; il tipo di capo resta. Solo se nel catalogo,
 * nella taglia, quel tipo non c'è proprio, si prende il più vicino e lo si dice.
 * @param ctx { profilo, negozi, capi, esclusi, rnd }
 * @returns { outfit, budget, sforato, allargati: [posto], mancanti: [posto] }
 */
export function lookPerRichiesta(r, ctx) {
  const { profilo, negozi, capi: catalogo, esclusi = new Set(), rnd = Math.random } = ctx;
  if (r.abito == null && (!vuoto(r.sopra) || !vuoto(r.sotto))) r = { ...r, abito: false };   // ha chiesto un sopra o un sotto: niente abito al loro posto
  if (r.abito == null && !vuoto(r.abito_dettagli)) r = { ...r, abito: true };
  // il budget: quello detto in chat, se no quello del profilo — ma per i capi chiesti per nome si può sforare (e lo si dice)
  const budget = r.budget || profilo.budget;
  // ha elencato i capi che vuole ("camicia, pantalone e scarpa") e non la giacca: niente giacca che si mangia il budget
  const elencati = ["sopra", "sotto", "scarpe", "abito_dettagli"].filter(k => !vuoto(r[k])).length >= 2;
  // giacca o cappotto chiesti per nome: obbligatori come il resto (giro 1: "cappotto cammello" dava un look senza cappotto)
  const vuoleGiacca = r.giacca === true || !vuoto(r.giacca_dettagli);
  // la stagione chiesta ("matrimonio d'estate", "spiaggia") vince sul calendario
  const freddo = r.caldo === true ? false : r.caldo === false ? true : (profilo.freddo ?? profilo.conCapospalla);
  const tmp = { ...profilo, budget, freddo, obbligaGiacca: vuoleGiacca, stili: r.stili?.length ? r.stili : profilo.stili,
    conCapospalla: vuoleGiacca || (r.giacca ?? (r.caldo === true || elencati ? false : profilo.conCapospalla)) };
  const usabile = c => !esclusi.has(S.chiave(c)) && S.haTaglia(c, tmp) && !S.fuoriStagione(c, tmp.freddo) && !(tmp.genere === "u" && (c.c === "abito" || c.c === "gonna"));
  const posti = ["capospalla", "sopra", "sotto", "scarpe", "abito"].filter(p => !((r.abito === true && (p === "sopra" || p === "sotto")) || (r.abito === false && p === "abito")));
  const perPosto = Object.fromEntries(posti.map(p => [p, catalogo.filter(c => S.postoDi(c) === p && usabile(c))]));

  // per ogni posto: gradi dal più fedele al più largo. Il tipo chiesto resta fino al penultimo.
  const soloTipo = x => x && { tipo: x.tipo };
  const senzaStile = { ...r, stili: [] };
  // allargando cadono prima maniche, lunghezza e materiale (dati che il catalogo spesso non ha), il colore per ultimo (collaudo 25/11: "vestito rosso" → abito nero)
  const tipoColore = x => x && { tipo: x.tipo, colori: x.colori };
  const gradi = [
    r,
    senzaStile,
    { ...senzaStile, sopra: tipoColore(r.sopra), sotto: tipoColore(r.sotto), scarpe: tipoColore(r.scarpe), giacca_dettagli: tipoColore(r.giacca_dettagli), abito_dettagli: tipoColore(r.abito_dettagli) },
    { ...senzaStile, sopra: soloTipo(r.sopra), sotto: soloTipo(r.sotto), scarpe: soloTipo(r.scarpe), giacca_dettagli: soloTipo(r.giacca_dettagli), abito_dettagli: soloTipo(r.abito_dettagli) },
    { abito: r.abito, elegante: r.elegante },
    { abito: r.abito },
  ];
  const grado = {};
  for (const p of posti) {
    const chiesto = !vuoto(dettagliDi(r, p));
    // un posto chiesto per nome vuole almeno un capo; uno non chiesto ne vuole qualcuno in più per variare
    const serve = chiesto ? 1 : 3;
    let g = 0, lista = [];
    for (; g < gradi.length; g++) {
      lista = perPosto[p].filter(c => vaPerRichiesta(c, gradi[g], negozi));
      if (lista.filter(c => c.e <= budget).length >= serve) break;
    }
    if (g === gradi.length) g = gradi.length - 1;
    grado[p] = g;
  }
  function candidatiA(p, g) { return perPosto[p].some(c => vaPerRichiesta(c, gradi[g], negozi)); }
  const c2 = { profilo: tmp, negozi, esclusi, elegante: !!r.elegante, sposa: !!r.sposa, caldo: r.caldo === true, vuoleAbito: r.abito === true };
  const prova = (g, tetto, partenza = S.outfitVuoto(), fermi = new Set()) => {
    const tutti = posti.flatMap(p => perPosto[p].filter(c => vaPerRichiesta(c, gradi[g[p]], negozi)));
    return S.componi(tutti, { ...c2, profilo: { ...tmp, budget: tetto } }, partenza, fermi, rnd);
  };
  const manca = o => [...S.mancanti(o.outfit), ...(vuoleGiacca && !o.outfit.capospalla && perPosto.capospalla?.length ? ["capospalla"] : [])];
  let o = prova(grado, budget), sforato = false;
  // il budget non basta: prima si lascia cadere lo stile (non chiesto per nome), poi colore e materiale; il tipo di capo resta
  for (let livello = 1; livello <= 3 && manca(o).length; livello++) {
    for (const p of posti) if (grado[p] < livello && candidatiA(p, livello)) grado[p] = livello;
    o = prova(grado, budget);
  }
  if (manca(o).length) {
    // ancora niente: si tengono i capi chiesti e si sfora quanto basta per il più economico che manca (e lo si dice),
    // invece di mettere una maglietta al posto della camicia (Andrea 24/11)
    const prezzoMin = p => Math.min(...perPosto[p].filter(c => vaPerRichiesta(c, gradi[grado[p]], negozi)).map(c => c.e), Infinity);
    const servono = manca(o).filter(p => posti.includes(p));
    const extra = servono.reduce((t, p) => t + (Number.isFinite(prezzoMin(p)) ? prezzoMin(p) : 0), 0);
    // si ricompone tutto da capo alzando il tetto a piccoli passi: tenendo fermi gli altri capi (che avevano già usato il budget)
    // e aggiungendo il pezzo mancante si sforava di molto (giro 8: cappotto chiesto → 635 € su 400)
    for (const k of [1.1, 1.2, 1.35, 1.5, 2, 3]) { o = prova(grado, Math.max(budget * k, budget + extra * (k - 1))); if (!manca(o).length) break; }
    // poi si scende: ogni capo, dal più caro, si cambia con uno meno caro che rispetta la stessa richiesta (giro 9: 1.150 € su 400)
    for (let giro = 0; giro < 3 && S.totale(o.outfit) > budget; giro++)
      for (const p of posti.filter(p => o.outfit[p]).sort((a, b) => o.outfit[b].e - o.outfit[a].e)) {
        if (S.totale(o.outfit) <= budget) break;
        const ora = o.outfit[p], ok = perPosto[p].filter(c => c.e < ora.e && vaPerRichiesta(c, gradi[grado[p]], negozi));
        const migliori = S.alternative(ok, { ...c2, profilo: tmp }, o.outfit, p, Infinity).slice(0, 8);
        const scelto = migliori.sort((a, b) => a.e - b.e)[0];
        if (scelto) o = { ...o, outfit: S.metti(o.outfit, scelto).outfit };
      }
    sforato = S.totale(o.outfit) > budget;
  }
  const allargati = posti.filter(p => o.outfit[p] && !vuoto(dettagliDi(r, p)) && grado[p] >= 4);
  // il capo chiesto c'è ma in un colore/materiale diverso (grado 2): lo si dice in modo più preciso
  const diverso = posti.filter(p => o.outfit[p] && !vuoto(dettagliDi(r, p)) && (grado[p] === 2 || grado[p] === 3) && !vaPerRichiesta(o.outfit[p], { ...senzaStile }, negozi));
  // un capo chiesto che proprio non c'è nella taglia: lo si dice (mai raccontare un capo che non c'è)
  const assenti = vuoleGiacca && !o.outfit.capospalla ? ["capospalla"] : [];
  return { outfit: o.outfit, budget, sforato, allargati, diverso, assenti };
}
