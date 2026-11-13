// Camerino v2 — schermate. Le regole dell'outfit stanno in stylist.js.
import * as S from "./stylist.js";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const euro = n => `${Math.round(n).toLocaleString("it")} €`;
const mesiFreddi = () => { const m = new Date().getMonth(); return m >= 9 || m <= 3; };

// ---------- stato ----------
const CHIAVE = "camerino-v2";
const salvato = (() => { try { return JSON.parse(localStorage.getItem(CHIAVE)) || {}; } catch { return {}; } })();
const profilo = Object.assign({ genere: null, tagliaSopra: null, tagliaSotto: null, scarpa: null, stagione: null, budget: 400, stili: [], conCapospalla: mesiFreddi(), pronto: false }, salvato.profilo);
profilo.freddo = mesiFreddi();            // la stagione viene dal calendario; "conCapospalla" dice solo se vuole la giacca
let outfit = S.outfitVuoto();
let bloccati = new Set(salvato.bloccati || []);
let salvati = salvato.salvati || [];          // [{ capi: [chiavi], quando }]
let vista = "capi";
let DATI = null, INDICE = new Map(), esclusi = new Set(), manca = [];
let seme = Date.now() % 1e9;
let genereDati = null, daProvare = null;

function ricorda() {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify({ profilo, bloccati: [...bloccati], salvati,
      outfit: Object.fromEntries(Object.entries(outfit).map(([p, c]) => [p, c ? S.chiave(c) : null])) }));
  } catch {}
}
const ctx = () => ({ profilo, negozi: DATI.negozi, esclusi });
const negozio = c => DATI.negozi[c.n];
const foto = (c, w = 400) => (c.i.startsWith("~") ? "https://cdn.shopify.com/s/files/" + c.i.slice(1) : c.i) + "?width=" + w;
const VALUTA = { EUR: "€", USD: "$", GBP: "£", AUD: "A$", SEK: "kr", DKK: "kr", NOK: "kr", CAD: "C$" };
function prezzo(c) {
  const v = negozio(c).valuta;
  return v === "EUR" ? euro(c.p) : `${VALUTA[v] || v} ${Math.round(c.p)} · circa ${euro(c.e)}`;
}
function mostra(id) { for (const s of document.querySelectorAll(".schermo")) s.hidden = s.id !== id; }

// ---------- avvisi brevi, con "Annulla" ----------
function toast(testo, annulla) {
  const el = $("toast");
  el.innerHTML = `<span>${esc(testo)}</span>` + (annulla ? `<button>Annulla</button>` : "");
  if (annulla) el.querySelector("button").onclick = () => { el.classList.remove("su"); annulla(); };
  el.classList.add("su"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("su"), annulla ? 5000 : 2400);
}

// ---------- fogli ----------
function apriFoglio(titolo, html, livello = 1) {
  const f = $(livello === 2 ? "foglio2" : "foglio");
  $(f.id + "-titolo").textContent = titolo;
  const corpo = $(f.id + "-corpo"); corpo.innerHTML = html; corpo.scrollTop = 0; corpo.onclick = null;
  f.classList.add("aperto"); f.setAttribute("aria-hidden", "false");
  return corpo;
}
function chiudiFoglio(livello = 1) { const f = $(livello === 2 ? "foglio2" : "foglio"); f.classList.remove("aperto"); f.setAttribute("aria-hidden", "true"); }
$("foglio-chiudi").onclick = () => chiudiFoglio(1);
$("foglio2-chiudi").onclick = () => chiudiFoglio(2);
document.addEventListener("keydown", e => { if (e.key === "Escape") { if ($("foglio2").classList.contains("aperto")) chiudiFoglio(2); else chiudiFoglio(1); } });

// ======================================================================
// PROFILO — quattro domande, poi si entra con un outfit già composto
// ======================================================================
const PASSI = ["chi", "taglie", "colori", "budget"];
let passo = 0, daProfilo = false;

function disegnaPasso() {
  const el = $("passo"), nome = PASSI[passo];
  const dove = `<div class="dove"><span>${passo > 0 ? `<button class="testo-link" id="indietro">← Indietro</button>` : "Camerino"}</span><span>${passo + 1} di ${PASSI.length}</span></div>`;
  const avanti = (testo, ok = true) => `<div class="piede"><button class="pieno" id="avanti" ${ok ? "" : "disabled"}><span>${testo}</span><span>→</span></button></div>`;
  const scelte = (id, valori, attuale) => `<div class="scelte" id="${id}">${valori.map(v => `<button data-v="${v}" aria-pressed="${attuale === v}">${v}</button>`).join("")}</div>`;

  if (nome === "chi") {
    el.innerHTML = `${dove}<h1>Per chi cerchi?</h1><p class="sotto">Ti mostriamo solo i capi giusti.</p>
      <div class="grandi" id="genere">
        <button data-v="d" aria-pressed="${profilo.genere === "d"}"><span>Donna</span><span>→</span></button>
        <button data-v="u" aria-pressed="${profilo.genere === "u"}"><span>Uomo</span><span>→</span></button>
      </div>`;
    $("genere").onclick = e => {
      const b = e.target.closest("button"); if (!b) return;
      if (profilo.genere !== b.dataset.v) { profilo.genere = b.dataset.v; profilo.scarpa = null; DATI = null; outfit = S.outfitVuoto(); bloccati.clear(); }
      passo++; disegnaPasso();
    };
  }
  if (nome === "taglie") {
    const numeri = profilo.genere === "u" ? S.NUMERI_SCARPE.filter(n => n >= 39) : S.NUMERI_SCARPE.filter(n => n <= 42);
    const pronto = () => profilo.tagliaSopra && profilo.tagliaSotto && profilo.scarpa;
    el.innerHTML = `${dove}<h1>Le tue taglie</h1><p class="sotto">Vedrai solo capi che ci sono nella tua taglia. Restano su questo telefono.</p>
      <div class="campo"><div class="etichetta"><span>Sopra</span><span>maglie, camicie, giacche</span></div>${scelte("t-sopra", S.TAGLIE, profilo.tagliaSopra)}</div>
      <div class="campo"><div class="etichetta"><span>Sotto</span><span>pantaloni${profilo.genere === "u" ? "" : ", gonne"}</span></div>${scelte("t-sotto", S.TAGLIE, profilo.tagliaSotto)}</div>
      <div class="campo"><div class="etichetta"><span>Scarpe</span></div>${scelte("t-scarpe", numeri, profilo.scarpa)}</div>
      ${avanti("Avanti", pronto())}`;
    const lega = (id, campo, num) => $(id).onclick = e => {
      const b = e.target.closest("button"); if (!b) return;
      profilo[campo] = num ? +b.dataset.v : b.dataset.v;
      if (campo === "tagliaSopra" && !profilo.tagliaSotto) { profilo.tagliaSotto = profilo.tagliaSopra; for (const x of $("t-sotto").children) x.setAttribute("aria-pressed", x.dataset.v === profilo.tagliaSotto); }
      for (const x of $(id).children) x.setAttribute("aria-pressed", x === b);
      $("avanti").disabled = !pronto();
    };
    lega("t-sopra", "tagliaSopra"); lega("t-sotto", "tagliaSotto"); lega("t-scarpe", "scarpa", true);
  }
  if (nome === "colori") {
    el.innerHTML = `${dove}<h1>I tuoi colori</h1><p class="sotto">Se sai la tua stagione, sceglila. Se no puoi scoprirla da una foto del viso, oppure saltare.</p>
      <div class="stagioni" id="stagioni">${Object.entries(S.STAGIONI).map(([k, s]) => `<button class="stagione" data-v="${k}" aria-pressed="${profilo.stagione === k}"><span><b>${s.nome}</b><small>${s.desc}</small></span><span class="pallini">${s.colori.map(c => `<i style="background:${c}"></i>`).join("")}</span></button>`).join("")}</div>
      <div class="campo" style="margin-top:14px">
        <label class="vuoto" style="cursor:pointer">Scoprila da una foto del viso<input type="file" id="selfie" accept="image/*" hidden></label>
        <div class="esito" id="esito" hidden></div>
        <span style="font-size:12px;color:var(--ink-3)">La foto viene letta su questo telefono e non viene inviata. Meglio alla luce del giorno, senza filtri.</span>
      </div>
      <div class="piede"><button class="pieno" id="avanti"><span>${profilo.stagione ? "Avanti" : "Salta per ora"}</span><span>→</span></button></div>`;
    const segna = k => { profilo.stagione = profilo.stagione === k ? null : k; for (const x of $("stagioni").children) x.setAttribute("aria-pressed", x.dataset.v === profilo.stagione); $("avanti").firstElementChild.textContent = profilo.stagione ? "Avanti" : "Salta per ora"; };
    $("stagioni").onclick = e => { const b = e.target.closest("button"); if (b) segna(b.dataset.v); };
    $("selfie").onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      const out = $("esito"); out.hidden = false; out.textContent = "Leggo la foto…";
      try {
        const { stagioneDaFoto } = await import("./palette.js");
        const r = await stagioneDaFoto(f);
        if (!r) { out.textContent = "Non trovo un viso in questa foto. Provane un'altra, di fronte e con buona luce."; return; }
        if (profilo.stagione !== r.stagione) segna(r.stagione);
        out.innerHTML = `Dalla foto: <b>${S.STAGIONI[r.stagione].nome}</b> (${r.caldo ? "toni caldi" : "toni freddi"}, ${r.profondo ? "colori profondi" : "colori chiari"}). È una stima: la luce la sposta. Se non ti torna, cambiala qui sopra.`;
      } catch { out.textContent = "Non sono riuscito a leggere la foto (serve la connessione). Scegli tu qui sopra."; }
    };
  }
  if (nome === "budget") {
    el.innerHTML = `${dove}<h1>Quanto vuoi spendere?</h1><p class="sotto">È il totale per tutto l'outfit, scarpe comprese.</p>
      <div class="campo"><div class="etichetta"><span>Budget dell'outfit</span><output id="o-budget">${euro(profilo.budget)}</output></div>
        <input type="range" id="i-budget" min="100" max="3000" step="50" value="${profilo.budget}" aria-label="Budget totale dell'outfit in euro"></div>
      <div class="campo"><label class="interruttore"><input type="checkbox" id="i-capospalla" ${profilo.conCapospalla ? "checked" : ""}> Aggiungi giacca o cappotto</label></div>
      <div class="campo"><div class="etichetta"><span>Stili che ti piacciono</span><span>facoltativo</span></div>
        <div class="scelte" id="stili">${S.STILI.map(k => `<button data-v="${k}" aria-pressed="${profilo.stili.includes(k)}">${k}</button>`).join("")}</div></div>
      ${avanti(daProfilo ? "Fatto" : "Entra nel camerino")}`;
    $("i-budget").oninput = () => { profilo.budget = +$("i-budget").value; $("o-budget").textContent = euro(profilo.budget); };
    $("i-capospalla").onchange = () => { profilo.conCapospalla = $("i-capospalla").checked; };
    $("stili").onclick = e => { const b = e.target.closest("button"); if (!b) return; const k = b.dataset.v; profilo.stili = profilo.stili.includes(k) ? profilo.stili.filter(x => x !== k) : [...profilo.stili, k]; b.setAttribute("aria-pressed", profilo.stili.includes(k)); };
  }
  if ($("indietro")) $("indietro").onclick = () => { passo--; disegnaPasso(); };
  if ($("avanti")) $("avanti").onclick = () => {
    if (passo < PASSI.length - 1) { passo++; disegnaPasso(); return; }
    profilo.pronto = true; ricorda(); entra();
  };
  $("passo").scrollTop = 0;
}
function apriProfilo() { daProfilo = profilo.pronto; passo = 0; mostra("s-profilo"); disegnaPasso(); }
$("apri-profilo").onclick = apriProfilo;

// ======================================================================
// CAMERINO
// ======================================================================
/** Carica i capi di un genere ("d" o "u"). Restituisce false se la rete non va. */
async function carica(g) {
  try { DATI = await (await fetch(`../data/v2-${g === "u" ? "uomo" : "donna"}.json`)).json(); } catch { DATI = null; return false; }
  for (const c of DATI.capi) c.z = DATI.negozi[c.n].dominio;
  INDICE = new Map(DATI.capi.map(c => [S.chiave(c), c]));
  genereDati = g;
  return true;
}
async function entra() {
  mostra("s-camerino");
  if (DATI && genereDati !== profilo.genere) DATI = null;
  if (!DATI) {
    $("palco").innerHTML = `<div class="addosso"><div class="solo-testo">Apro il camerino…</div></div>`; $("posti").innerHTML = ""; $("budget").innerHTML = "";
    if (!await carica(profilo.genere)) { $("palco").innerHTML = `<div class="addosso"><div class="solo-testo">Non riesco a caricare i capi. Controlla la connessione e riapri.</div></div>`; return; }
    outfit = S.outfitVuoto();
    for (const [p, k] of Object.entries(salvato.outfit || {})) if (k && INDICE.has(k)) outfit[p] = INDICE.get(k);
    salvato.outfit = null;
  }
  if (daProvare) {                       // outfit arrivato da un link: lo si indossa al posto di comporne uno
    outfit = S.outfitVuoto(); bloccati.clear(); manca = [];
    for (const k of daProvare) { const c = INDICE.get(k); if (c) outfit = S.metti(outfit, c).outfit; }
    daProvare = null; history.replaceState(null, "", location.pathname); ricorda();
  }
  if (!S.capiDi(outfit).length) await componi(false);
  else disegna();
}

/** Compone (o ricompone) tenendo i capi bloccati, poi controlla sul sito dei marchi che la taglia ci sia davvero. */
async function componi(avvisa = true) {
  const prima = outfit;
  const posti = new Set([...bloccati].filter(p => outfit[p]));
  let r = S.componi(DATI.capi, ctx(), outfit, posti, S.casuale(++seme));
  outfit = r.outfit; manca = r.manca;
  disegna(); ricorda();
  if (avvisa && S.capiDi(prima).length) toast("Outfit nuovo", () => { outfit = prima; manca = []; disegna(); ricorda(); });
  // verifica dal vivo: un capo esaurito o sparito viene sostituito, senza sforare
  for (let giro = 0; giro < 3; giro++) {
    const mio = outfit, esiti = await Promise.all(S.capiDi(mio).map(c => posti.has(S.postoDi(c)) ? null : verifica(c)));
    if (outfit !== mio) return;                                   // nel frattempo l'utente ha cambiato qualcosa
    const guasti = S.capiDi(mio).filter((c, i) => esiti[i] && (esiti[i].stato === "esaurita" || esiti[i].stato === "sparito"));
    if (!guasti.length) break;
    for (const c of guasti) {
      esclusi.add(S.chiave(c));
      const p = S.postoDi(c), entro = profilo.budget - S.totale(outfit) + c.e;
      const alt = S.alternative(DATI.capi, ctx(), outfit, p, entro).find(a => a.e <= entro && !S.fuoriStagione(a, profilo.freddo));
      outfit = alt ? S.metti(outfit, alt).outfit : S.togli(outfit, p);
    }
    disegna(); ricorda();
  }
}

function disegna() {
  // budget: un'informazione, non un pulsante
  const tot = S.totale(outfit), resto = profilo.budget - tot;
  $("budget").className = "budget lati" + (resto < 0 ? " sfora" : "");
  $("budget").innerHTML = `<div class="cifre"><span><b>${euro(tot)}</b> di ${euro(profilo.budget)}</span><span class="resto">${resto < 0 ? "sfori di " + euro(-resto) : "restano " + euro(resto)}</span></div>
    <div class="barra"><i style="width:${Math.min(100, tot / profilo.budget * 100)}%"></i></div>`;

  disegnaPalco();

  // i posti dell'outfit
  const righe = outfit.abito ? ["capospalla", "abito", "scarpe"] : ["capospalla", "sopra", "sotto", "scarpe"];
  $("posti").innerHTML = righe.map(p => {
    const c = outfit[p];
    if (!c) {
      const facolt = p === "capospalla";
      return `<div class="posto vuoto-posto"><div class="mini"></div>
        <button class="chi" data-cambia="${p}"><div class="nome-posto">${S.NOME_POSTO[p]}</div><div class="titolo">${facolt ? "Nessuno" : "Da scegliere"}</div><div class="riga2">${facolt ? "facoltativo" : "l'avatar porta un capo base"}</div></button>
        <div class="azioni"><button class="piccolo" data-cambia="${p}">${facolt ? "Aggiungi" : "Scegli"}</button></div></div>`;
    }
    const taglia = S.haTaglia(c, profilo);
    return `<div class="posto"><button class="mini" data-apri="${p}" aria-label="Apri ${esc(c.t)}"><img src="${foto(c, 120)}" alt="" loading="lazy"></button>
      <button class="chi" data-apri="${p}"><div class="nome-posto">${S.NOME_POSTO[p]} · ${esc(negozio(c).nome)}</div><div class="titolo">${esc(c.t)}</div>
        <div class="riga2">${c.x ? `<span class="tono" style="background:${c.x}"></span>` : ""}${prezzo(c)}${taglia ? "" : ` · <span class="male">non c'è la tua taglia</span>`}</div></button>
      <div class="azioni"><button class="piccolo" data-cambia="${p}">Cambia</button><button class="piccolo" data-blocca="${p}" aria-pressed="${bloccati.has(p)}" title="Tienilo quando chiedi un altro outfit">${bloccati.has(p) ? "Tenuto" : "Tieni"}</button></div></div>`;
  }).join("");

  // avviso quando l'outfit non è completo
  const m = S.mancanti(outfit), nomi = m.map(p => S.NOME_POSTO[p].toLowerCase());
  let avviso = "";
  if (m.length && manca.length) avviso = `Con ${euro(profilo.budget)} non riesco a completare l'outfit: ${manca.map(x => `${S.NOME_POSTO[x.posto].toLowerCase()} da ${euro(x.daEuro)}`).join(", ")}. Alza il budget dal profilo o cambia un capo con uno meno caro.`;
  else if (m.length) avviso = `Manca${m.length > 1 ? "no" : ""} ${nomi.join(" e ")}. ${resto > 0 ? `Ti restano ${euro(resto)}.` : ""}`;
  $("avviso").innerHTML = avviso ? `<p class="avviso">${avviso}</p>` : "";

  const p = $("principale");
  if (m.length) { p.textContent = "Completa l'outfit"; p.onclick = () => componiMancanti(); }
  else { p.textContent = `Compra · ${euro(tot)}`; p.onclick = apriCompra; }
  p.disabled = !S.capiDi(outfit).length && !m.length;
  $("salva").setAttribute("aria-pressed", salvati.some(s => s.capi.join() === S.capiDi(outfit).map(S.chiave).join()));
}
/** Riempie solo i posti vuoti, tenendo tutto ciò che c'è. */
async function componiMancanti() {
  const tutti = bloccati; bloccati = new Set(["capospalla", "sopra", "sotto", "scarpe", "abito"].filter(p => outfit[p]));
  const conCapo = profilo.conCapospalla; if (outfit.capospalla === null) profilo.conCapospalla = false;   // non aggiunge un capospalla non chiesto
  await componi(false);
  profilo.conCapospalla = conCapo; bloccati = tutti; disegna();
}

function disegnaPalco() {
  $("vista-capi").setAttribute("aria-pressed", vista === "capi"); $("vista-addosso").setAttribute("aria-pressed", vista === "addosso");
  if (vista === "addosso") {
    const img = profilo.genere === "d" ? `<img src="../img/avatar_front.jpg" alt="Modello con i capi base">` : `<div class="solo-testo">Qui vedrai te, o un modello che ti somiglia, con questi capi addosso.</div>`;
    $("palco").innerHTML = `<div class="addosso">${img}<div class="dice"><span>La prova addosso non è ancora attiva.</span><button class="piccolo" id="come-sara">Come sarà</button></div></div>`;
    $("come-sara").onclick = apriAddosso;
    return;
  }
  $("palco").innerHTML = tavola(outfit, true);
}
/** La tavola dei capi: le foto dei negozi nell'ordine del corpo. `tocchi` = i riquadri si possono toccare. */
function tavola(outfit, tocchi) {
  const tess = (p, primo) => {
    const c = outfit[p];
    if (!c) return `<button class="tessera manca" data-cambia="${p}"><span style="position:static;background:none;padding:0;letter-spacing:0;text-transform:none;font-size:12px"><b>${S.NOME_POSTO[p]}</b>da scegliere</span></button>`;
    return `<button class="tessera ${p}" data-apri="${p}" aria-label="${S.NOME_POSTO[p]}: ${esc(c.t)}"><img src="${foto(c, primo ? 500 : 360)}" alt=""><span>${S.NOME_POSTO[p]}</span></button>`;
  };
  const ordine = [outfit.capospalla ? "capospalla" : null, ...(outfit.abito ? ["abito"] : ["sopra", "sotto"]), "scarpe"].filter(Boolean);
  const [primo, ...resto] = ordine;
  return `<div class="tavola">${tess(primo, true)}<div class="destra" style="grid-template-rows:${resto.map(p => p === "scarpe" && resto.length > 1 ? ".6fr" : "1fr").join(" ")}">${resto.map(p => tess(p)).join("")}</div></div>`;
}
$("vista-capi").onclick = () => { vista = "capi"; disegnaPalco(); };
$("vista-addosso").onclick = () => { vista = "addosso"; disegnaPalco(); };
$("altro").onclick = () => componi(true);

// tocchi su palco e posti: apri il capo, cambialo, tienilo
function tocco(e) {
  const b = e.target.closest("[data-apri],[data-cambia],[data-blocca]"); if (!b) return;
  if (b.dataset.apri) apriScheda(outfit[b.dataset.apri]);
  else if (b.dataset.cambia) apriCambia(b.dataset.cambia);
  else { const p = b.dataset.blocca; bloccati.has(p) ? bloccati.delete(p) : bloccati.add(p); ricorda(); disegna(); }
}
$("palco").addEventListener("click", tocco); $("posti").addEventListener("click", tocco);

/** Mette un capo nell'outfit, con "Annulla" e l'avviso se ha sostituito altro. */
function indossa(capo) {
  const prima = outfit, r = S.metti(outfit, capo);
  outfit = r.outfit; manca = [];
  for (const p of [...bloccati]) if (!outfit[p]) bloccati.delete(p);
  ricorda(); disegna();
  const tolti = r.tolti.filter(t => S.postoDi(t) !== S.postoDi(capo));
  toast(tolti.length ? `Messo. Ho tolto ${tolti.map(t => S.NOME_POSTO[S.postoDi(t)].toLowerCase()).join(" e ")}` : "Messo nell'outfit", () => { outfit = prima; ricorda(); disegna(); });
}

// ---------- salvare ----------
$("salva").onclick = () => {
  const capi = S.capiDi(outfit).map(S.chiave); if (!capi.length) return;
  const i = salvati.findIndex(s => s.capi.join() === capi.join());
  if (i >= 0) { salvati.splice(i, 1); toast("Tolto dai salvati"); } else { salvati.unshift({ capi, quando: Date.now() }); toast("Outfit salvato"); }
  ricorda(); disegna();
};
$("apri-salvati").onclick = () => {
  const righe = salvati.map((s, i) => {
    const capi = s.capi.map(k => INDICE.get(k)).filter(Boolean);
    return `<div class="salvato"><div class="strip">${capi.map(c => `<img src="${foto(c, 120)}" alt="${esc(c.t)}">`).join("")}</div>
      <div class="sotto-strip"><span>${capi.length} capi · ${euro(capi.reduce((t, c) => t + c.e, 0))}${capi.length < s.capi.length ? " · alcuni non ci sono più" : ""}</span>
      <span style="display:flex;gap:6px"><button class="piccolo" data-indossa="${i}">Rimetti</button><button class="piccolo" data-via="${i}">Togli</button></span></div></div>`;
  }).join("");
  const corpo = apriFoglio("Outfit salvati", righe || `<p class="niente">Non hai ancora salvato outfit. Tocca il cuore quando uno ti piace.</p>`);
  corpo.onclick = e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.via) { salvati.splice(+b.dataset.via, 1); ricorda(); $("apri-salvati").onclick(); disegna(); return; }
    const prima = outfit; outfit = S.outfitVuoto();
    for (const k of salvati[+b.dataset.indossa].capi) { const c = INDICE.get(k); if (c) outfit = S.metti(outfit, c).outfit; }
    bloccati.clear(); manca = []; ricorda(); disegna(); chiudiFoglio();
    toast("Outfit rimesso", () => { outfit = prima; ricorda(); disegna(); });
  };
};

// ======================================================================
// CAMBIA UN CAPO — alternative per un posto, già filtrate
// ======================================================================
const SOTTOFILTRI = {
  sopra: [["sopra", null, "Tutti"], ["sopra", "maglia", "Maglie"], ["sopra", "camicia", "Camicie"], ["sopra", "top", "Top e t-shirt"], ["abito", null, "Abiti", "d"]],
  sotto: [["sotto", null, "Tutti"], ["sotto", "pantaloni", "Pantaloni"], ["sotto", "jeans", "Jeans"], ["sotto", "gonna", "Gonne", "d"], ["abito", null, "Abiti", "d"]],
  abito: [["abito", null, "Abiti"], ["sopra", null, "Sopra"], ["sotto", null, "Sotto"]],
  capospalla: [["capospalla", null, "Tutti"]], scarpe: [["scarpe", null, "Tutte"]],
};
function apriCambia(postoIniziale) {
  const filtri = SOTTOFILTRI[postoIniziale].filter(f => !f[3] || f[3] === profilo.genere);
  let scelto = 0, lista = [], mostrati = 0, entro = 0;
  const corpo = apriFoglio(`Cambia: ${S.NOME_POSTO[postoIniziale].toLowerCase()}`, "");
  const carta = c => `<button class="carta" data-k="${esc(S.chiave(c))}"><img src="${foto(c)}" alt="" loading="lazy">
    <span class="marca">${esc(negozio(c).nome)}</span><b>${esc(c.t)}</b><small>${prezzo(c)}</small>
    <small class="${c.e > entro ? "male" : ""}">${c.e > entro ? `${euro(c.e - entro)} oltre il budget` : "ci sta nel budget"}</small></button>`;
  const altri = () => {
    corpo.querySelector(".altri")?.remove();
    const lotto = lista.slice(mostrati, mostrati + 30); mostrati += lotto.length;
    corpo.querySelector(".griglia").insertAdjacentHTML("beforeend", lotto.map(carta).join("") + (mostrati < lista.length ? `<button class="vuoto altri">Mostra altri</button>` : ""));
  };
  const rifai = () => {
    const [posto, cat] = filtri[scelto];
    // quanto si può spendere per questo posto: il budget meno gli altri capi che restano
    const dopo = S.metti(outfit, { c: posto === "abito" ? "abito" : posto === "sopra" ? "top" : posto === "sotto" ? "pantaloni" : posto, e: 0, n: 0, h: "", v: null }).outfit;
    entro = profilo.budget - S.totale(dopo);
    lista = S.alternative(DATI.capi, ctx(), outfit, posto, entro).filter(c => !cat || c.c === cat).filter(c => !outfit[posto] || S.chiave(c) !== S.chiave(outfit[posto]));
    mostrati = 0;
    const dentro = lista.filter(c => c.e <= entro).length;
    corpo.innerHTML = (filtri.length > 1 ? `<div class="filtri">${filtri.map((f, i) => `<button class="piccolo" data-f="${i}" aria-pressed="${i === scelto}">${f[2]}</button>`).join("")}</div>` : "") +
      `<div class="conta">${entro > 0 ? `Puoi spendere fino a ${euro(entro)} · ${dentro.toLocaleString("it")} capi ci stanno` : "Hai già usato tutto il budget: questi capi lo sforano"}. In ordine di abbinamento con il resto. Taglia ${S.tagliaPer(profilo, { c: posto === "scarpe" ? "scarpe" : posto === "sotto" ? "pantaloni" : "top" })}.</div>
      <div class="griglia"></div>`;
    if (!lista.length) corpo.querySelector(".griglia").innerHTML = `<p class="niente">Non trovo capi nella tua taglia per questo posto.</p>`; else altri();
    corpo.scrollTop = 0;
  };
  rifai();
  corpo.onclick = e => {
    const f = e.target.closest("[data-f]"); if (f) { scelto = +f.dataset.f; rifai(); return; }
    if (e.target.closest(".altri")) return altri();
    const b = e.target.closest(".carta"); if (!b) return;
    indossa(INDICE.get(b.dataset.k)); chiudiFoglio();
  };
}

// ======================================================================
// SCHEDA DEL CAPO — taglie lette adesso sul sito del marchio
// ======================================================================
const vive = new Map();   // chiave → { quando, esito }
/** Legge il capo sul sito del marchio. stato: ok | esaurita | non-prodotta | sparito | ignoto */
async function verifica(c) {
  const k = S.chiave(c), v = vive.get(k);
  if (v && Date.now() - v.quando < 10 * 60e3) return v.esito;
  const neg = negozio(c), mia = S.tagliaPer(profilo, c);
  let esito;
  try {
    const r = await fetch(`https://${neg.dominio}/products/${c.h}.js`);
    if (r.status === 404) esito = { stato: "sparito" };
    else if (!r.ok) throw new Error(r.status);
    else {
      const p = await r.json(), nomi = p.options.map(o => typeof o === "string" ? o : o.name);
      const ic = nomi.findIndex(n => /colou?r|couleur|colore|kleur|farbe|färg/i.test(n));
      const is = Math.max(0, nomi.findIndex(n => /size|taille|taglia|talla|grösse|storlek|str|pointure|numero/i.test(n)));
      const per = new Map();
      for (const x of p.variants.filter(x => ic < 0 || c.v == null || x.options[ic] === c.v)) {
        let tt;
        if (c.c === "scarpe") { const n = S.numeroScarpa(x.options[is], neg.sistema, c.g); tt = n ? [n] : []; }
        else { const l = S.lettera(x.options[is], neg.sistema, c.c); tt = !l ? [] : l === "*" ? ["Unica"] : l.split("/"); }
        for (const t of tt) { const old = per.get(t); if (!old || (!old.available && x.available)) per.set(t, x); }
      }
      const var_ = per.get(mia) || per.get("Unica");
      esito = { stato: !var_ ? "non-prodotta" : var_.available ? "ok" : "esaurita", variante: var_?.id, taglie: per, prezzoVivo: var_ ? var_.price / 100 : null, unica: !per.has(mia) && per.has("Unica") };
    }
  } catch { esito = { stato: "ignoto" }; }
  if (esito.stato === "sparito") { esclusi.add(k); }
  vive.set(k, { quando: Date.now(), esito });
  return esito;
}
const linkCapo = (c, e) => `https://${negozio(c).dominio}/products/${c.h}${e?.variante ? "?variant=" + e.variante : ""}`;
function fraseTaglia(c, e) {
  const mia = S.tagliaPer(profilo, c);
  return { ok: `<span class="bene">La ${e.unica ? "taglia unica" : mia} c'è, adesso.</span>`, esaurita: `<span class="male">La ${mia} è finita in questo momento.</span>`,
    "non-prodotta": `<span class="male">Questo capo non viene fatto nella ${mia}.</span>`, sparito: `<span class="male">Non è più in vendita sul sito di ${esc(negozio(c).nome)}.</span>`,
    ignoto: `Non riesco a controllare adesso: guarda sul sito.` }[e.stato];
}
async function apriScheda(c, livello = 1, sola = false) {   // sola = solo da guardare (outfit ricevuto da un link)
  const neg = negozio(c), p = S.postoDi(c), dentro = outfit[p] && S.chiave(outfit[p]) === S.chiave(c);
  const d = S.distPalette(c, profilo.stagione);
  const colore = !c.k ? "" : `${c.x ? `<span class="tono" style="background:${c.x}"></span>` : ""}${esc(c.k)}${c.m ? " (stimato dalla foto)" : ""}` +
    (d === null ? "" : ` · <span class="${d < 18 ? "bene" : d >= 30 ? "male" : ""}">${d < 18 ? "tra i tuoi colori" : d < 30 ? "vicino ai tuoi colori" : "fuori dai tuoi colori"}</span>`);
  const corpo = apriFoglio(S.NOME_POSTO[p], `
    <div class="foto"><img src="${foto(c, 900)}" alt="${esc(c.t)}, foto del negozio"></div>
    <div class="dettagli"><span class="marca">${esc(neg.nome)}</span><h3>${esc(c.t)}</h3><span class="riga" id="sc-prezzo">${prezzo(c)}</span>${colore ? `<span class="riga">${colore}</span>` : ""}
      ${neg.ue ? "" : `<span class="riga male">Spedisce da fuori dall'Unione europea: alla consegna possono esserci dazi e IVA.</span>`}</div>
    <div class="vivo"><div class="etichetta"><span>Taglie sul sito di ${esc(neg.nome)}</span><span id="sc-ora"></span></div>
      <div class="taglie-vive" id="sc-taglie">Controllo adesso…</div><div class="riga" id="sc-mia"></div>
      <button class="${dentro ? "vuoto" : "pieno"}" id="sc-metti">${dentro ? "Toglilo dall'outfit" : "Mettilo nell'outfit"}</button>
      <a class="vuoto" id="sc-sito" href="${linkCapo(c)}" target="_blank" rel="noopener">Vedi sul sito di ${esc(neg.nome)} ↗</a></div>`, livello);
  if (sola) corpo.querySelector("#sc-metti").remove();
  else corpo.querySelector("#sc-metti").onclick = () => {
    if (dentro) { const prima = outfit; outfit = S.togli(outfit, p); bloccati.delete(p); ricorda(); disegna(); toast("Tolto dall'outfit", () => { outfit = prima; ricorda(); disegna(); }); }
    else indossa(c);
    chiudiFoglio(2); chiudiFoglio(1);
  };
  const e = await verifica(c);
  if (!corpo.querySelector("#sc-taglie")) return;
  const mia = S.tagliaPer(profilo, c), scala = c.c === "scarpe" ? S.NUMERI_SCARPE : S.TAGLIE;
  if (e.taglie) {
    const ordine = [...e.taglie.keys()].sort((a, b) => scala.indexOf(a) - scala.indexOf(b));
    corpo.querySelector("#sc-taglie").innerHTML = ordine.map(t => `<span class="${e.taglie.get(t).available ? "si" : "no"}${t === mia ? " mia" : ""}">${t}</span>`).join("") || "Non riesco a leggere le taglie: guarda sul sito.";
    corpo.querySelector("#sc-ora").textContent = "ore " + new Date().toLocaleTimeString("it", { hour: "2-digit", minute: "2-digit" });
    if (e.prezzoVivo != null && Math.abs(e.prezzoVivo - c.p) > 0.5) corpo.querySelector("#sc-prezzo").insertAdjacentHTML("beforeend", ` · <span class="male">ora ${Math.round(e.prezzoVivo)} sul sito</span>`);
  } else corpo.querySelector("#sc-taglie").textContent = "";
  corpo.querySelector("#sc-mia").innerHTML = mia || e.stato === "sparito" ? fraseTaglia(c, e) : "";
  corpo.querySelector("#sc-sito").href = linkCapo(c, mia ? e : null);
  if (sola) corpo.querySelector("#sc-metti")?.remove();
  if (e.stato === "sparito") { corpo.querySelector("#sc-metti").remove(); corpo.querySelector("#sc-sito").remove(); }
}

// ======================================================================
// COMPRA — un capo per negozio, taglia controllata adesso
// ======================================================================
async function apriCompra() {
  const capi = S.capiDi(outfit);
  const corpo = apriFoglio("Compra l'outfit", capi.map((c, i) => `<div class="acquisto"><img src="${foto(c, 140)}" alt="">
      <div><span class="marca" style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3)">${S.NOME_POSTO[S.postoDi(c)]} · ${esc(negozio(c).nome)}</span><br><b style="font-size:13px">${esc(c.t)}</b><br>
        <span style="font-size:12px;color:var(--ink-2)">${prezzo(c)} · taglia ${S.tagliaPer(profilo, c)}</span>
        <div class="stato" id="st-${i}">Controllo la taglia…</div>
        ${negozio(c).ue ? "" : `<div class="stato male">Da fuori UE: possibili dazi e IVA alla consegna.</div>`}
        <a class="pieno" id="go-${i}" href="${linkCapo(c)}" target="_blank" rel="noopener">Compra su ${esc(negozio(c).dominio.replace(/^www\./, ""))} ↗</a></div></div>`).join("") +
    `<div class="totale"><span>Totale</span><span>${euro(S.totale(outfit))}</span></div>
     <p class="note">Ogni capo si compra sul sito del suo marchio: si apre la pagina con la tua taglia già scelta. Spedizione e resi sono quelli di ciascun negozio. I prezzi non in euro sono un cambio indicativo.</p>`);
  capi.forEach(async (c, i) => {
    const e = await verifica(c), st = corpo.querySelector(`#st-${i}`); if (!st) return;
    st.innerHTML = fraseTaglia(c, e);
    const a = corpo.querySelector(`#go-${i}`);
    if (e.stato === "ok" || e.stato === "ignoto") a.href = linkCapo(c, e);
    else { a.className = "vuoto"; a.removeAttribute("href"); a.removeAttribute("target"); a.textContent = "Cambia questo capo"; a.style.cursor = "pointer"; a.onclick = () => { chiudiFoglio(); apriCambia(S.postoDi(c)); }; }
  });
}

// ======================================================================
// CERCA — per chi vuole un capo preciso
// ======================================================================
const PAROLE_CAT = [
  ["scarpe", /\b(scarp|sneaker|stival|sandal|mocassin|ballerin|décolleté|decollete|tacchi|anfibi)/],
  ["capospalla", /\b(cappott|giacc|giubbott|giubbin|piumin|blazer|trench|bomber|parka|gilet|soprabit|montone)/],
  ["maglia", /\b(maglion|maglia\b|maglie\b|cardigan|felp|pullover|dolcevit)/],
  ["camicia", /\b(camici|blus)/], ["top", /\b(top|t-?shirt|magliett|canott|body|polo)/], ["abito", /\b(vestit|abit|tuta\b)/],
  ["gonna", /\b(gonn|minigonn)/], ["jeans", /\b(jeans|denim)/], ["pantaloni", /\b(pantalon|shorts?|bermuda|leggings?)/],
];
const PAROLE_COLORE = { nero: "#141414", nera: "#141414", neri: "#141414", nere: "#141414", bianco: "#f7f7f5", bianca: "#f7f7f5", bianchi: "#f7f7f5", bianche: "#f7f7f5", panna: "#f1ead8", crema: "#f3e9d2",
  beige: "#d6c3a3", cammello: "#b0814f", marrone: "#5a3d2b", marroni: "#5a3d2b", grigio: "#8d8d8d", grigia: "#8d8d8d", grigi: "#8d8d8d", grigie: "#8d8d8d", blu: "#2f5d9e", navy: "#1c2541",
  azzurro: "#8fb6dd", azzurra: "#8fb6dd", verde: "#3f6b45", verdi: "#3f6b45", oliva: "#6b6b3a", rosso: "#b3202a", rossa: "#b3202a", rossi: "#b3202a", rosse: "#b3202a", bordeaux: "#5c1a26",
  rosa: "#e7a3b5", fucsia: "#c71585", arancione: "#e5762b", giallo: "#f0cf3a", gialla: "#f0cf3a", senape: "#c9a227", viola: "#5e3a87", lilla: "#c3a6d8" };
const TRADUCI = { pelle: /leather|cuir|pelle/, seta: /silk|soie|seta|satin/, lino: /linen|\blin\b|lino/, lana: /wool|laine|lana|merino/, cashmere: /cashmere|cachemire/, cotone: /cotton|coton|cotone/,
  velluto: /velvet|velours|velluto|corduroy/, pizzo: /lace|dentelle|pizzo/, lungo: /long|maxi|lung/, corto: /mini|short|cort/, cappotto: /coat|manteau|cappotto|abrigo/, blazer: /blazer/, trench: /trench/,
  piumino: /puffer|padded|down|doudoune|piumino/, cardigan: /cardigan/, felpa: /sweatshirt|hoodie|felpa/, stivali: /boot|botte|stival/, sneakers: /sneaker|trainer|basket/, sandali: /sandal/ };
const piano = x => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function capisci(testo) {
  const t = piano(testo), q = { cat: null, hex: null, max: null, negozio: -1, parole: [] };
  for (const [c, rx] of PAROLE_CAT) if (rx.test(t)) { q.cat = c; break; }
  for (const [w, hex] of Object.entries(PAROLE_COLORE)) if (new RegExp(`\\b${w}\\b`).test(t)) { q.colore = w; q.hex = hex; break; }
  const m = t.match(/(?:sotto|entro|max|massimo|meno di|fino a)\s*(?:i\s*|€\s*)?(\d{2,4})/) || t.match(/(\d{2,4})\s*(?:€|euro)/);
  if (m) q.max = +m[1];
  q.parole = Object.keys(TRADUCI).filter(w => new RegExp(`\\b${w.slice(0, -1)}`).test(t));
  const VUOTE = ["the", "shop", "brand", "paris", "studio", "und", "set", "with", "good", "house", "home", "of"];
  q.negozio = DATI.negozi.findIndex(n => piano(n.nome).split(/[^a-z']+/).some(w => w.length > 2 && !VUOTE.includes(w) && new RegExp(`\\b${w}\\b`).test(t)));
  return q;
}
$("apri-cerca").onclick = () => {
  let lista = [], mostrati = 0, soloTaglia = true;
  const corpo = apriFoglio("Cerca un capo", `<form class="cerca" id="c-form"><input id="c-q" type="search" placeholder="cappotto nero sotto 300" autocomplete="off" aria-label="Cosa cerchi"><button aria-label="Cerca"><svg viewBox="0 0 24 24" width="17" height="17" stroke="currentColor" fill="none" stroke-width="1.5"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg></button></form>
    <div class="filtri"><button class="piccolo" id="c-taglia" aria-pressed="true">Solo nella mia taglia</button></div><div class="conta" id="c-conta">Scrivi un capo, un colore, un prezzo o un marchio.</div><div class="griglia" id="c-griglia"></div>`);
  const carta = c => `<button class="carta" data-k="${esc(S.chiave(c))}"><img src="${foto(c)}" alt="" loading="lazy"><span class="marca">${esc(negozio(c).nome)}</span><b>${esc(c.t)}</b><small>${prezzo(c)}</small></button>`;
  const altri = () => { corpo.querySelector(".altri")?.remove(); const l = lista.slice(mostrati, mostrati + 30); mostrati += l.length; $("c-griglia").insertAdjacentHTML("beforeend", l.map(carta).join("") + (mostrati < lista.length ? `<button class="vuoto altri">Mostra altri</button>` : "")); };
  const cerca = () => {
    const testo = $("c-q").value.trim(); if (!testo) return;
    const q = capisci(testo), ql = q.hex ? S.lab(q.hex) : null;
    lista = DATI.capi.filter(c => (!q.cat || c.c === q.cat) && (q.negozio < 0 || c.n === q.negozio) && (!q.max || c.e <= q.max) && !esclusi.has(S.chiave(c))
      && (!ql || (c.x && Math.hypot(...S.lab(c.x).map((v, i) => v - ql[i])) < 16)) && q.parole.every(w => TRADUCI[w].test(c.t.toLowerCase()))
      && (!soloTaglia || S.haTaglia(c, profilo)) && !(profilo.genere === "u" && (c.c === "abito" || c.c === "gonna")));
    const capito = [q.cat, q.colore, ...q.parole.filter(w => w !== q.cat), q.negozio >= 0 ? DATI.negozi[q.negozio].nome : null, q.max ? `fino a ${euro(q.max)}` : null].filter(Boolean);
    lista.sort((a, b) => (S.distPalette(a, profilo.stagione) ?? 50) - (S.distPalette(b, profilo.stagione) ?? 50));
    $("c-conta").textContent = capito.length ? `Cerco: ${capito.join(" · ")} — ${lista.length.toLocaleString("it")} capi` : "Non ho capito. Prova con un capo (cappotto, jeans, stivali), un colore, un prezzo o un marchio.";
    mostrati = 0; $("c-griglia").innerHTML = "";
    if (!capito.length) { lista = []; return; }
    if (!lista.length) $("c-griglia").innerHTML = `<p class="niente">Nessun capo così${soloTaglia ? " nella tua taglia" : ""}.</p>`; else altri();
  };
  $("c-form").onsubmit = e => { e.preventDefault(); $("c-q").blur(); cerca(); };
  $("c-taglia").onclick = () => { soloTaglia = !soloTaglia; $("c-taglia").setAttribute("aria-pressed", soloTaglia); cerca(); };
  corpo.onclick = e => { if (e.target.closest(".altri")) return altri(); const b = e.target.closest(".carta"); if (b) apriScheda(INDICE.get(b.dataset.k), 2); };
  setTimeout(() => $("c-q").focus(), 300);
};

// ======================================================================
// ADDOSSO — spiegazione onesta finché la prova non è accesa
// ======================================================================
function apriAddosso() {
  apriFoglio("La prova addosso", `<div class="dettagli" style="gap:12px;font-size:14px">
    <p style="margin:0">Qui vedrai l'outfit addosso a te, in una foto.</p>
    <p style="margin:0"><b>Come funziona.</b> Carichi una tua foto in piedi, vestito, oppure scegli un modello che ti somiglia. Tocchi "Prova addosso" e in una quindicina di secondi arriva l'immagine con tutti i capi dell'outfit.</p>
    <p style="margin:0"><b>Cosa mostra.</b> L'aspetto: colori, lunghezze, come stanno insieme i capi. Non dice se la taglia ti va: per quella valgono le guide del marchio.</p>
    <p style="margin:0"><b>Perché non c'è ancora.</b> Ogni immagine ha un costo (pochi centesimi). La accendiamo appena è deciso come coprirlo.</p>
    <p style="margin:0;color:var(--ink-2)">Nel frattempo "I capi" mostra le foto vere dei negozi, una per posto.</p>
    <figure style="margin:6px 0 0"><img src="esempio-addosso.jpg" alt="Esempio: una modella con cappotto, maglione, pantaloni e sneakers" style="border:1px solid var(--riga)"><figcaption style="font-size:12px;color:var(--ink-3);margin-top:6px">Un esempio di come sarà l'immagine (capi dimostrativi).</figcaption></figure></div>`);
}

// ======================================================================
// CONDIVIDI — un link che apre questo outfit; chi lo riceve lo guarda, lo compra o lo prova nel suo camerino
// ======================================================================
const b64 = { su: t => btoa(String.fromCharCode(...new TextEncoder().encode(t))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  giu: t => new TextDecoder().decode(Uint8Array.from(atob(t.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0))) };
$("condividi").onclick = async () => {
  const capi = S.capiDi(outfit); if (!capi.length) return toast("Non c'è ancora niente da condividere");
  const url = `${location.origin}${location.pathname}?o=${b64.su(JSON.stringify({ g: profilo.genere, c: capi.map(S.chiave) }))}`;
  const testo = `Guarda questo outfit: ${capi.length} capi, ${euro(S.totale(outfit))}`;
  try {
    if (navigator.share) await navigator.share({ title: "Camerino", text: testo, url });
    else { await navigator.clipboard.writeText(url); toast("Link copiato: incollalo dove vuoi"); }
  } catch (e) { if (e.name !== "AbortError") { try { await navigator.clipboard.writeText(url); toast("Link copiato: incollalo dove vuoi"); } catch { toast("Non riesco a condividere da questo browser"); } } }
};
function leggiCondiviso() {
  try { const o = JSON.parse(b64.giu(new URLSearchParams(location.search).get("o"))); return ["d", "u"].includes(o.g) && Array.isArray(o.c) && o.c.length <= 6 ? o : null; } catch { return null; }
}
async function apriCondiviso(link) {
  mostra("s-condiviso");
  $("cond-palco").innerHTML = `<div class="addosso"><div class="solo-testo">Apro l'outfit…</div></div>`;
  if (!await carica(link.g)) { $("cond-palco").innerHTML = `<div class="addosso"><div class="solo-testo">Non riesco a caricare l'outfit. Controlla la connessione e riapri il link.</div></div>`; return; }
  let o = S.outfitVuoto();
  const trovati = link.c.map(k => INDICE.get(k)).filter(Boolean);
  for (const c of trovati) o = S.metti(o, c).outfit;
  const proprio = () => { history.replaceState(null, "", location.pathname); if (profilo.pronto && profilo.genere) entra(); else apriProfilo(); };
  if (!trovati.length) {
    $("cond-palco").innerHTML = `<div class="addosso"><div class="solo-testo">Questi capi non sono più in vendita.</div></div>`;
    $("cond-posti").innerHTML = ""; $("cond-totale").innerHTML = ""; $("cond-nota").textContent = "";
    $("cond-prova").textContent = "Apri il camerino"; $("cond-prova").onclick = proprio; return;
  }
  $("cond-palco").innerHTML = tavola(o, true);
  $("cond-posti").innerHTML = S.capiDi(o).map(c => `<div class="posto"><button class="mini" data-k="${esc(S.chiave(c))}"><img src="${foto(c, 120)}" alt=""></button>
    <button class="chi" data-k="${esc(S.chiave(c))}"><div class="nome-posto">${S.NOME_POSTO[S.postoDi(c)]} · ${esc(negozio(c).nome)}</div><div class="titolo">${esc(c.t)}</div><div class="riga2">${c.x ? `<span class="tono" style="background:${c.x}"></span>` : ""}${prezzo(c)}</div></button>
    <div class="azioni"><a class="piccolo" style="display:grid;place-items:center;text-decoration:none" href="${linkCapo(c)}" target="_blank" rel="noopener">Sito ↗</a></div></div>`).join("");
  $("cond-totale").innerHTML = `<span>Totale</span><span>${euro(S.totale(o))}</span>`;
  $("cond-nota").textContent = (trovati.length < link.c.length ? "Alcuni capi non sono più in vendita. " : "") + "Tocca un capo per vedere le taglie disponibili adesso.";
  const apri = e => { const b = e.target.closest("[data-k],[data-apri]"); if (!b) return; const c = b.dataset.k ? INDICE.get(b.dataset.k) : o[b.dataset.apri]; if (c) apriScheda(c, 1, true); };
  $("cond-posti").onclick = apri; $("cond-palco").onclick = apri;
  const altroGenere = profilo.pronto && profilo.genere !== link.g;
  $("cond-prova").textContent = altroGenere ? "Vai al mio camerino" : "Provalo nel mio camerino";
  $("cond-prova").onclick = () => {
    if (altroGenere) return proprio();
    daProvare = trovati.map(S.chiave);
    if (profilo.pronto) entra();
    else { profilo.genere = link.g; daProfilo = false; passo = 1; mostra("s-profilo"); disegnaPasso(); }
  };
}

// ---------- avvio ----------
const condiviso = leggiCondiviso();
if (condiviso) apriCondiviso(condiviso);
else if (profilo.pronto && profilo.genere) entra(); else apriProfilo();
