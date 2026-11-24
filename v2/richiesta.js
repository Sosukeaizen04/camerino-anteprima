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
const RX_SPORT = /\b(t-?shirt|t shirt|tee|hoodie|sweatshirt|sudadera|jogger|sweat ?pants?|track|legging|cargo|active|zip-?up|fleece|windbreaker|anorak|puffer|bomber|sport|felpa|chándal|basico tinto)/i;
// il tipo di scarpa: prima il dato del catalogo (y, u), se manca il nome. "Boat shoes" con la suola alta non sono tacchi (24/11)
const TIPO_Y = { stivali: ["stivali", "stivaletti"], sneakers: ["sneakers"], sandali: ["sandali"], mocassini: ["mocassini"], ballerine: ["ballerine"],
  tacchi: ["décolleté"] };
export function scarpaDiTipo(c, tipo) {
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
  if (r.stili?.length && p !== "scarpe" && !r.stili.includes(negozi[c.n].stile)) return false;
  if (r.elegante && S.registro(c) < 2) return false;                      // per una cena: niente casual né sportivo, scarpe comprese
  if (r.elegante && p !== "scarpe" && RX_SPORT.test(c.t)) return false;
  if (!pz) return true;
  if (pz.tipo) {
    if (p === "scarpe" && !scarpaDiTipo(c, pz.tipo)) return false;
    if (p === "capospalla" && !RX_GIACCA[pz.tipo]?.test(c.t)) return false;
    if ((p === "sopra" || p === "sotto") && c.c !== pz.tipo) return false;
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
  const tmp = { ...profilo, budget, stili: r.stili?.length ? r.stili : profilo.stili, conCapospalla: r.giacca ?? (!vuoto(r.giacca_dettagli) ? true : elencati ? false : profilo.conCapospalla) };
  const usabile = c => !esclusi.has(S.chiave(c)) && S.haTaglia(c, tmp) && !S.fuoriStagione(c, tmp.freddo ?? tmp.conCapospalla) && !(tmp.genere === "u" && (c.c === "abito" || c.c === "gonna"));
  const posti = ["capospalla", "sopra", "sotto", "scarpe", "abito"].filter(p => !((r.abito === true && (p === "sopra" || p === "sotto")) || (r.abito === false && p === "abito")));
  const perPosto = Object.fromEntries(posti.map(p => [p, catalogo.filter(c => S.postoDi(c) === p && usabile(c))]));

  // per ogni posto: gradi dal più fedele al più largo. Il tipo chiesto resta fino al penultimo.
  const soloTipo = x => x && { tipo: x.tipo };
  const senzaStile = { ...r, stili: [] };
  const gradi = [
    r,
    senzaStile,
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
  const c2 = { profilo: tmp, negozi, esclusi, elegante: !!r.elegante };
  const prova = (g, tetto, partenza = S.outfitVuoto(), fermi = new Set()) => {
    const tutti = posti.flatMap(p => perPosto[p].filter(c => vaPerRichiesta(c, gradi[g[p]], negozi)));
    return S.componi(tutti, { ...c2, profilo: { ...tmp, budget: tetto } }, partenza, fermi, rnd);
  };
  let o = prova(grado, budget), sforato = false;
  // il budget non basta: prima si lascia cadere lo stile (non chiesto per nome), poi colore e materiale; il tipo di capo resta
  for (let livello = 1; livello <= 2 && S.mancanti(o.outfit).length; livello++) {
    for (const p of posti) if (grado[p] < livello && candidatiA(p, livello)) grado[p] = livello;
    o = prova(grado, budget);
  }
  if (S.mancanti(o.outfit).length) {
    // ancora niente: si tengono i capi chiesti e si sfora quanto basta per il più economico che manca (e lo si dice),
    // invece di mettere una maglietta al posto della camicia (Andrea 24/11)
    const prezzoMin = p => Math.min(...perPosto[p].filter(c => vaPerRichiesta(c, gradi[grado[p]], negozi)).map(c => c.e), Infinity);
    const servono = S.mancanti(o.outfit).filter(p => posti.includes(p));
    const extra = servono.reduce((t, p) => t + (Number.isFinite(prezzoMin(p)) ? prezzoMin(p) : 0), 0);
    const fermi = new Set(posti.filter(p => o.outfit[p]));
    const r2 = prova(grado, S.totale(o.outfit) + extra + 1, o.outfit, fermi);
    o = S.mancanti(r2.outfit).length ? prova(grado, budget * 3) : r2;
    sforato = S.totale(o.outfit) > budget;
  }
  const allargati = posti.filter(p => o.outfit[p] && !vuoto(dettagliDi(r, p)) && grado[p] >= 3);
  // il capo chiesto c'è ma in un colore/materiale diverso (grado 2): lo si dice in modo più preciso
  const diverso = posti.filter(p => o.outfit[p] && !vuoto(dettagliDi(r, p)) && grado[p] === 2 && !vaPerRichiesta(o.outfit[p], { ...senzaStile }, negozi));
  return { outfit: o.outfit, budget, sforato, allargati, diverso };
}
