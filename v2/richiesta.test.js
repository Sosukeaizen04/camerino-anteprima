// Prove dello stylist (chat → look) sul catalogo vero. Uso: node --test v2/richiesta.test.js
// Casi dal riscontro di Andrea del 24/11: chiedo una camicia e mi dà una maglietta.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as S from "./stylist.js";
import { lookPerRichiesta, scarpaDiTipo } from "./richiesta.js";
import * as R from "./richiesta.js";
const D = JSON.parse(readFileSync(new URL(process.env.CATALOGO || "../data/v2-donna.json", import.meta.url)));
const prof = { genere: "d", tagliaSopra: "M", tagliaSotto: "M", scarpa: 38, stagione: "autunno", budget: 300, stili: [], conCapospalla: true, freddo: true };
const pz = (tipo, x = {}) => ({ tipo, colori: [], materiale: null, ...x });
const CASI = [
  ["camicia elegante, pantalone marrone, scarpa col tacco", { budget: null, stili: ["Classico", "Sera"], elegante: true, abito: null, sopra: pz("camicia"), sotto: pz("pantaloni", { colori: ["marrone"] }), scarpe: pz("tacchi") }],
  ["camicia maniche lunghe elegante, pantalone marrone, tacco", { budget: null, stili: ["Classico", "Sera"], elegante: true, abito: null, sopra: pz("camicia", { maniche: "lunghe" }), sotto: pz("pantaloni", { colori: ["marrone"] }), scarpe: pz("tacchi") }],
  ["ufficio: camicia, pantalone, scarpa", { budget: null, stili: ["Minimal", "Classico"], elegante: true, abito: null, sopra: pz("camicia"), sotto: pz("pantaloni"), scarpe: pz(null) }],
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
// collaudo giro 1: il cappotto chiesto c'è sempre; la stagione chiesta vince sul calendario
test("cappotto cammello e pantaloni neri: c'è il cappotto", () => {
  const r = { budget: null, stili: [], elegante: false, giacca: true, abito: null, sopra: null, sotto: pz("pantaloni", { colori: ["nero"] }), scarpe: null, giacca_dettagli: pz("cappotto", { colori: ["cammello"] }) };
  for (let s = 1; s <= 20; s++) {
    const l = lookPerRichiesta(r, { profilo: { ...prof, budget: 400 }, negozi: D.negozi, capi: D.capi, rnd: S.casuale(1e6 + s * 104729) });
    assert.ok(l.outfit.capospalla, "manca il cappotto");
    assert.match(l.outfit.capospalla.t, /coat|manteau|cappott|abrigo/i, `non è un cappotto: "${l.outfit.capospalla.t}"`);
    assert.equal(l.outfit.sotto?.c, "pantaloni");
  }
});
test("look da spiaggia a novembre: niente stivali né lana", () => {
  const r = { budget: null, stili: [], elegante: false, giacca: null, caldo: true, abito: null, sopra: null, sotto: null, scarpe: null };
  for (let s = 1; s <= 20; s++) {
    const l = lookPerRichiesta(r, { profilo: prof, negozi: D.negozi, capi: D.capi, rnd: S.casuale(1e6 + s * 7919) });
    for (const c of S.capiDi(l.outfit)) assert.ok(!S.fuoriStagione(c, false), `fuori stagione: "${c.t}"`);
    assert.equal(l.outfit.capospalla, null, "giacca in spiaggia");
  }
});
// giro 4: "cena elegante, stivali neri" non dà scarponi con plateau né negozi rock
test("cena elegante, stivali neri: stivali eleganti", () => {
  const r = { budget: null, stili: ["Sera"], elegante: true, giacca: null, abito: null, sopra: null, sotto: null, scarpe: pz("stivali", { colori: ["nero"] }) };
  for (let s = 1; s <= 30; s++) {
    const l = lookPerRichiesta(r, { profilo: prof, negozi: D.negozi, capi: D.capi, rnd: S.casuale(1e6 + s * 31337) });
    for (const c of S.capiDi(l.outfit)) {
      assert.ok(!["Rock", "Streetwear", "Sportivo"].includes(D.negozi[c.n].stile), `negozio ${D.negozi[c.n].stile}: "${c.t}"`);
      assert.ok(!/platform|plateau|creeper|combat|lug|chunky|stomper/i.test(c.t), `non elegante: "${c.t}"`);
    }
    assert.ok(scarpaDiTipo(l.outfit.scarpe, "stivali"), `non stivali: "${l.outfit.scarpe?.t}"`);
  }
});
// collaudo 25/11 (stylist vero): "un vestito rosso per un matrimonio in estate sotto 200 euro" → un vestito rosso, mai una tuta
test("vestito rosso per un matrimonio estivo: vestito, rosso, non tuta, nel budget", () => {
  const r = { budget: 200, stili: ["Sera"], elegante: true, giacca: null, caldo: true, abito: null, sopra: null, sotto: null, scarpe: pz("sandali"), abito_dettagli: { colori: ["rosso"], materiale: null, lunghezza: null, maniche: "senza" }, giacca_dettagli: null };
  for (let s = 1; s <= 10; s++) {
    const l = lookPerRichiesta(r, { profilo: prof, negozi: D.negozi, capi: D.capi, rnd: S.casuale(1e6 + s * 7919) });
    assert.ok(l.outfit.abito, "manca il vestito");
    assert.ok(!/jumpsuit|romper|playsuit|overall|tuta/i.test(l.outfit.abito.t), `tuta: "${l.outfit.abito.t}"`);
    assert.ok(R.coloreDi(l.outfit.abito, "rosso"), `non rosso: "${l.outfit.abito.t}"`);
    assert.ok(S.totale(l.outfit) <= 200 || l.sforato);
  }
});
