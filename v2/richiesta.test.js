// Prove dello stylist (chat → look) sul catalogo vero. Uso: node --test v2/richiesta.test.js
// Casi dal riscontro di Andrea del 24/11: chiedo una camicia e mi dà una maglietta.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as S from "./stylist.js";
import { lookPerRichiesta, scarpaDiTipo } from "./richiesta.js";
const D = JSON.parse(readFileSync(new URL(process.env.CATALOGO || "../data/v2-donna.json", import.meta.url)));
const prof = { genere: "d", tagliaSopra: "M", tagliaSotto: "M", scarpa: 38, stagione: "autunno", budget: 300, stili: [], conCapospalla: true, freddo: true };
const pz = (tipo, x = {}) => ({ tipo, colori: [], materiale: null, ...x });
const CASI = [
  ["camicia elegante, pantalone marrone, scarpa col tacco", { budget: null, stili: ["Italiano", "Sera"], elegante: true, abito: null, sopra: pz("camicia"), sotto: pz("pantaloni", { colori: ["marrone"] }), scarpe: pz("tacchi") }],
  ["camicia maniche lunghe elegante, pantalone marrone, tacco", { budget: null, stili: ["Italiano", "Sera"], elegante: true, abito: null, sopra: pz("camicia", { maniche: "lunghe" }), sotto: pz("pantaloni", { colori: ["marrone"] }), scarpe: pz("tacchi") }],
  ["ufficio: camicia, pantalone, scarpa", { budget: null, stili: ["Minimal", "Italiano"], elegante: true, abito: null, sopra: pz("camicia"), sotto: pz("pantaloni"), scarpe: pz(null) }],
  ["camicia sotto 150 €", { budget: 150, stili: [], elegante: false, abito: null, sopra: pz("camicia"), sotto: null, scarpe: null }],
];
for (const [nome, r] of CASI) test(nome, () => {
  for (let s = 1; s <= 30; s++) {
    const l = lookPerRichiesta(r, { profilo: prof, negozi: D.negozi, capi: D.capi, rnd: S.casuale(1e6 + s * 7919) });
    const o = l.outfit;
    assert.ok(S.completo(o), "look completo");
    for (const p of ["sopra", "sotto"]) if (r[p]?.tipo) assert.equal(o[p].c, r[p].tipo, `${p}: chiesto ${r[p].tipo}, dato "${o[p].t}"`);
    if (r.sopra?.maniche) assert.equal(o.sopra.w, r.sopra.maniche, `maniche: "${o.sopra.t}"`);
    if (r.scarpe?.tipo) assert.ok(scarpaDiTipo(o.scarpe, r.scarpe.tipo), `scarpe ${r.scarpe.tipo}: "${o.scarpe.t}"`);
    // ha elencato i capi e non la giacca: niente giacca che si prende il budget
    if (r.sopra && r.sotto) assert.equal(o.capospalla, null, `giacca non chiesta: "${o.capospalla?.t}"`);
    if (r.elegante) for (const c of S.capiDi(o)) assert.ok(S.registro(c) >= 2, `elegante: "${c.t}"`);
    if (!l.sforato) assert.ok(S.totale(o) <= (r.budget || prof.budget), "nel budget");
  }
});
test("le boat shoes con la suola alta non sono tacchi", () => {
  assert.equal(scarpaDiTipo({ t: "Mahogany Brown Chunky Boat Shoes", y: "mocassini", u: "medio" }, "tacchi"), false);
  assert.equal(scarpaDiTipo({ t: "Escarpins MILANAISE", y: "décolleté" }, "tacchi"), true);
  assert.equal(scarpaDiTipo({ t: "Bottines DORIA", y: "stivaletti", u: "alto" }, "tacchi"), true);
});
test("sottocategorie: ogni capo del sopra ne ha una, felpe e camicie riconosciute", () => {
  assert.equal(S.sottoDi({ c: "top", t: "Hooded Sweatshirt - Grey" }), "felpe");
  assert.equal(S.sottoDi({ c: "camicia", t: "Petrice Shirt - White" }), "camicie");
  assert.equal(S.sottoDi({ c: "top", t: "Crew Neck T Shirt | White" }), "tshirt");
  assert.equal(S.sottoDi({ c: "top", t: "Dayna Top - China" }), "top");
  for (const c of D.capi.slice(0, 3000)) if (S.SOTTOCATEGORIE[S.postoDi(c)]) assert.ok(S.sottoDi(c));
});
