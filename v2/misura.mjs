// Misura la qualità dei look: stile rispettato, palette, eleganza coerente, fuori stagione. Uso: node v2/misura.mjs
import { readFileSync } from "node:fs";
import * as S from "./stylist.js";
const D = JSON.parse(readFileSync(new URL("../data/v2-donna.json", import.meta.url)));
const casi = [
  { nome: "Lusso+Italiano, inverno, 400 €", p: { genere: "d", tagliaSopra: "M", tagliaSotto: "M", scarpa: 38, stagione: "inverno", budget: 400, stili: ["Lusso", "Classico"], conCapospalla: true, freddo: true } },
  { nome: "Minimal, autunno, 300 €", p: { genere: "d", tagliaSopra: "S", tagliaSotto: "S", scarpa: 37, stagione: "autunno", budget: 300, stili: ["Minimal"], conCapospalla: true, freddo: true } },
  { nome: "senza stile, primavera, 500 €", p: { genere: "d", tagliaSopra: "L", tagliaSotto: "L", scarpa: 39, stagione: "primavera", budget: 500, stili: [], conCapospalla: true, freddo: true } },
];
const AFF = S.AFFINI;
for (const { nome, p } of casi) {
  const fam = new Set(p.stili.flatMap(s => [s, ...AFF[s]]));
  let affini = 0, capi = 0, fuoriStile = 0, fuoriPal = 0, misti = 0, stagione = 0, sport = 0, incompleti = 0, larghi = 0;
  for (let s = 1; s <= 100; s++) {
    const r = S.componi(D.capi, { profilo: p, negozi: D.negozi }, S.outfitVuoto(), new Set(), S.casuale(s));
    const cc = S.capiDi(r.outfit); if (!S.completo(r.outfit)) incompleti++; if (r.largo?.length) larghi++;
    const reg = cc.map(c => c.r ?? 2); if (Math.max(...reg) - Math.min(...reg) >= 2) misti++;
    for (const c of cc) {
      capi++;
      if (!S.nelloStile(c, p.stili, D.negozi, false)) fuoriStile++;
      if (p.stili.length && !p.stili.includes(D.negozi[c.n].stile) && S.postoDi(c) !== "scarpe") affini++;
      if (p.stagione && ["sopra", "abito", "capospalla"].includes(S.postoDi(c)) && S.tipoColore(c) !== "neutro" && !((S.distPalette(c, p.stagione) ?? 99) < 30)) fuoriPal++;
      if (S.fuoriStagione(c, true)) stagione++;
      if ((c.r ?? 2) === 0) sport++;
    }
  }
  console.log(`${nome}: capi fuori stile ${fuoriStile}/${capi} (da stili affini ${affini}), colori fuori palette vicino al viso ${fuoriPal}, look con eleganza mista ${misti}/100, sportivi ${sport}, fuori stagione ${stagione}, incompleti ${incompleti}, allargati ${larghi}`);
}
