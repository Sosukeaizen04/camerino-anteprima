// Prove delle regole dell'outfit sul catalogo vero. Uso: node --test v2/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registro, nelloStile, inPalette, fuoriStagione, componi, alternative, metti, totale, completo, mancanti, outfitVuoto, capiDi, haTaglia, postoDi, casuale, tipoColore, chiave } from "./stylist.js";

const carica = g => JSON.parse(readFileSync(new URL(`../data/v2-${g}.json`, import.meta.url)));
const DONNA = carica("donna"), UOMO = carica("uomo");
const donna = { genere: "d", tagliaSopra: "M", tagliaSotto: "M", scarpa: 38, stagione: "autunno", budget: 500, stili: [], conCapospalla: true };
const uomo = { genere: "u", tagliaSopra: "L", tagliaSotto: "L", scarpa: 43, stagione: null, budget: 400, stili: [], conCapospalla: false };

test("cento outfit donna: completi, nel budget, nella taglia", () => {
  for (let s = 1; s <= 100; s++) {
    const { outfit, manca } = componi(DONNA.capi, { profilo: donna, negozi: DONNA.negozi }, outfitVuoto(), new Set(), casuale(s));
    assert.equal(manca.length, 0, `seme ${s}: manca ${JSON.stringify(manca)}`);
    assert.ok(completo(outfit), `seme ${s}: incompleto`);
    assert.ok(totale(outfit) <= donna.budget, `seme ${s}: ${totale(outfit)} € sfora`);
    for (const c of capiDi(outfit)) assert.ok(haTaglia(c, donna), `seme ${s}: ${c.t} senza taglia`);
    assert.ok(!(outfit.abito && (outfit.sopra || outfit.sotto)), "abito insieme a sopra/sotto");
  }
});

test("il budget viene usato, non si prende sempre il capo più economico", () => {
  let somma = 0;
  for (let s = 1; s <= 60; s++) somma += totale(componi(DONNA.capi, { profilo: donna, negozi: DONNA.negozi }, outfitVuoto(), new Set(), casuale(s)).outfit);
  assert.ok(somma / 60 > donna.budget * 0.6, `in media ${Math.round(somma / 60)} € su ${donna.budget}`);
});

test("al massimo un colore acceso o una fantasia fuori accordo", () => {
  let strani = 0;
  for (let s = 1; s <= 100; s++) {
    const tipi = capiDi(componi(DONNA.capi, { profilo: donna, negozi: DONNA.negozi }, outfitVuoto(), new Set(), casuale(s)).outfit).map(tipoColore);
    if (tipi.filter(t => t === "fantasia").length > 1) strani++;
  }
  assert.ok(strani <= 3, `${strani} outfit su 100 con due fantasie`);
});

test("uomo: niente abiti né gonne, outfit completi", () => {
  for (let s = 1; s <= 60; s++) {
    const { outfit, manca } = componi(UOMO.capi, { profilo: uomo, negozi: UOMO.negozi }, outfitVuoto(), new Set(), casuale(s));
    assert.equal(manca.length, 0);
    assert.ok(completo(outfit) && !outfit.abito && outfit.sotto.c !== "gonna" && !outfit.capospalla);
    assert.ok(totale(outfit) <= uomo.budget);
  }
});

test("i capi bloccati restano, il resto cambia e sta nel budget rimasto", () => {
  const primo = componi(DONNA.capi, { profilo: donna, negozi: DONNA.negozi }, outfitVuoto(), new Set(), casuale(7)).outfit;
  const posto = primo.abito ? "abito" : "sopra";
  for (let s = 1; s <= 30; s++) {
    const { outfit } = componi(DONNA.capi, { profilo: donna, negozi: DONNA.negozi }, primo, new Set([posto]), casuale(s));
    assert.equal(chiave(outfit[posto]), chiave(primo[posto]));
    assert.ok(totale(outfit) <= donna.budget);
  }
});

test("budget troppo basso: dice cosa manca e da quanto parte, senza sforare", () => {
  const povero = { ...donna, budget: 40, conCapospalla: false };
  const { outfit, manca } = componi(DONNA.capi, { profilo: povero, negozi: DONNA.negozi }, outfitVuoto(), new Set(), casuale(3));
  assert.ok(totale(outfit) <= 40);
  assert.ok(manca.length > 0 && manca.every(m => m.daEuro > 0));
  assert.deepEqual(manca.map(m => m.posto).sort(), mancanti(outfit).sort());
});

test("solo una maglietta: l'outfit non è completo e mancano sotto e scarpe", () => {
  const maglietta = DONNA.capi.find(c => c.c === "top");
  const { outfit } = metti(outfitVuoto(), maglietta);
  assert.equal(completo(outfit), false);
  assert.deepEqual(mancanti(outfit), ["sotto", "scarpe"]);
});

test("un abito sostituisce sopra e sotto, e viceversa", () => {
  const top = DONNA.capi.find(c => c.c === "top"), jeans = DONNA.capi.find(c => c.c === "jeans"), abito = DONNA.capi.find(c => c.c === "abito");
  let o = metti(metti(outfitVuoto(), top).outfit, jeans).outfit;
  const r = metti(o, abito);
  assert.equal(r.tolti.length, 2);
  assert.ok(r.outfit.abito && !r.outfit.sopra && !r.outfit.sotto);
  const r2 = metti(r.outfit, top);
  assert.ok(!r2.outfit.abito && r2.outfit.sopra && r2.tolti.length === 1);
});

test("alternative: solo quel posto, nella taglia, prima quelle che stanno nel budget", () => {
  const { outfit } = componi(DONNA.capi, { profilo: donna, negozi: DONNA.negozi }, outfitVuoto(), new Set(), casuale(11));
  const entro = donna.budget - totale(outfit) + outfit.scarpe.e;
  const alt = alternative(DONNA.capi, { profilo: donna, negozi: DONNA.negozi }, outfit, "scarpe", entro);
  assert.ok(alt.length > 20);
  assert.ok(alt.every(c => postoDi(c) === "scarpe" && haTaglia(c, donna)));
  const primoFuori = alt.findIndex(c => c.e > entro);
  assert.ok(primoFuori === -1 || alt.slice(primoFuori).every(c => c.e > entro), "quelli fuori budget stanno in fondo");
});

test("mesi freddi: niente sandali né shorts nelle proposte", () => {
  for (let s = 1; s <= 80; s++) {
    const { outfit } = componi(DONNA.capi, { profilo: donna, negozi: DONNA.negozi }, outfitVuoto(), new Set(), casuale(s));
    for (const c of capiDi(outfit)) assert.ok(!/sandal|slide|shorts?\b/i.test(c.t), `seme ${s}: ${c.t}`);
  }
});

test("al massimo un colore acceso per outfit (o più capi dello stesso colore)", () => {
  let doppi = 0;
  for (let s = 1; s <= 100; s++) {
    const accesi = capiDi(componi(DONNA.capi, { profilo: donna, negozi: DONNA.negozi }, outfitVuoto(), new Set(), casuale(s)).outfit).filter(c => tipoColore(c) === "acceso");
    if (accesi.length > 2) doppi++;
  }
  assert.ok(doppi <= 5, `${doppi} outfit su 100 con tre o più capi accesi`);
});

test("senza capospalla ma d'inverno: comunque niente shorts né sandali", () => {
  const p = { ...donna, conCapospalla: false, freddo: true };
  for (let s = 1; s <= 60; s++) {
    const { outfit } = componi(DONNA.capi, { profilo: p, negozi: DONNA.negozi }, outfitVuoto(), new Set(), casuale(s));
    assert.equal(outfit.capospalla, null);
    for (const c of capiDi(outfit)) assert.ok(!/sandal|shorts?\b/i.test(c.t), `seme ${s}: ${c.t}`);
  }
});

// ---- Andrea 20/11: "lusso italiano" non deve dare capi hip hop o sportivi; palette rispettata; "Nuovo look" non sempre abito
const lusso = { ...donna, stagione: "inverno", budget: 400, stili: ["Lusso", "Italiano"], freddo: true };
test("stile Lusso+Italiano: niente capi sportivi, quasi niente casual, quasi sempre nel suo stile", () => {
  let capi = 0, casual = 0, fuori = 0;
  for (let s = 1; s <= 100; s++) {
    for (const c of capiDi(componi(DONNA.capi, { profilo: lusso, negozi: DONNA.negozi }, outfitVuoto(), new Set(), casuale(s)).outfit)) {
      capi++;
      assert.ok(registro(c) > 0, `seme ${s}: sportivo ${c.t}`);
      if (registro(c) === 1) casual++;
      if (!nelloStile(c, lusso.stili, DONNA.negozi, false)) fuori++;
    }
  }
  assert.ok(casual / capi < 0.15, `${casual} capi casual su ${capi}`);
  assert.ok(fuori / capi < 0.1, `${fuori} capi fuori stile su ${capi}`);
});
test("palette: vicino al viso colori della stagione in almeno 95 capi su 100", () => {
  let tot = 0, ok = 0;
  for (let s = 1; s <= 100; s++) {
    const o = componi(DONNA.capi, { profilo: lusso, negozi: DONNA.negozi }, outfitVuoto(), new Set(), casuale(s)).outfit;
    for (const p of ["sopra", "abito", "capospalla"]) if (o[p]) { tot++; if (inPalette(o[p], "inverno", p)) ok++; }
  }
  assert.ok(ok / tot >= 0.95, `${ok} su ${tot}`);
});
test("eleganza coerente: niente felpa con capi eleganti", () => {
  for (let s = 1; s <= 100; s++) {
    const reg = capiDi(componi(DONNA.capi, { profilo: { ...donna, stili: [] }, negozi: DONNA.negozi }, outfitVuoto(), new Set(), casuale(s)).outfit).map(registro);
    assert.ok(!(reg.includes(0) && reg.includes(3)), `seme ${s}: sportivo ed elegante insieme`);
  }
});
test("Nuovo look: a volte abito, più spesso sopra + sotto", () => {
  let abiti = 0;
  for (let s = 1; s <= 100; s++) if (componi(DONNA.capi, { profilo: donna, negozi: DONNA.negozi }, outfitVuoto(), new Set(), casuale(s)).outfit.abito) abiti++;
  assert.ok(abiti > 10 && abiti < 60, `${abiti} abiti su 100`);
});
test("d'inverno niente abiti senza maniche o a maniche corte (salvo lana)", () => {
  assert.ok(fuoriStagione({ t: "Robe Yolie sable", c: "abito", w: "corte" }, true));
  assert.ok(!fuoriStagione({ t: "Robe en laine", c: "abito", w: "corte", f: "lana" }, true));
  assert.ok(fuoriStagione({ t: "Modal Halterneck Maxi Dress", c: "abito" }, true));
});
test("catalogo: magliette, gonne in maglia e abiti-camicia al posto giusto", () => {
  const cat = t => DONNA.capi.find(c => c.t === t)?.c;
  assert.equal(cat("76 Long Sleeve T Shirt"), "top");
  for (const c of DONNA.capi) {
    const t = c.t.toLowerCase();
    if (/\bskirt\b/.test(t) && !/dress/.test(t)) assert.equal(c.c, "gonna", c.t);
    if (/shirt ?dress|t-shirt dress/.test(t)) assert.equal(c.c, "abito", c.t);
  }
});
