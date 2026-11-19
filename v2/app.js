// Camerino v2 — schermate. Le regole dell'outfit stanno in stylist.js.
import * as S from "./stylist.js";
import { LINGUA, cambiaLingua, tr } from "./lingua.js";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const euro = n => `${Math.round(n).toLocaleString("it")} €`;
const mesiFreddi = () => { const m = new Date().getMonth(); return m >= 9 || m <= 3; };

// ---------- stato ----------
const CHIAVE = "camerino-v2";
const salvato = (() => { try { return JSON.parse(localStorage.getItem(CHIAVE)) || {}; } catch { return {}; } })();
const profilo = Object.assign({ avatar: null, avatari: [], genere: null, tagliaSopra: null, tagliaSotto: null, scarpa: null, stagione: null, budget: 400, stili: [], conCapospalla: mesiFreddi(), pronto: false }, salvato.profilo);
profilo.freddo = mesiFreddi();            // la stagione viene dal calendario; "conCapospalla" dice solo se vuole la giacca
let outfit = S.outfitVuoto();
let bloccati = new Set(salvato.bloccati || []);
let salvati = salvato.salvati || [];          // [{ capi: [chiavi], quando }]
let DATI = null, INDICE = new Map(), esclusi = new Set(), manca = [];
let seme = Date.now() % 1e9;
let genereDati = null, daProvare = null, vistaAvatar = 0;

// ---------- prova addosso: il server (server/worker.js) veste l'avatar col look; vuoto = non ancora acceso ----------
const SERVER = (() => { try { return localStorage.getItem("camerino-server"); } catch { return null; } })() || "https://camerino-prova.camerino.workers.dev";   // in prova si può indicare un server locale
const BASE_AVATAR = "https://sosukeaizen04.github.io/camerino-anteprima/img/";
const prove = (() => { try { return JSON.parse(localStorage.getItem(CHIAVE + "-prove")) || {}; } catch { return {}; } })();   // look → immagine
let vestito = true, inCorso = null;          // vestito = mostra l'avatar col look quando c'è; inCorso = look che si sta vestendo
// ---------- girare: davanti → destra → dietro → sinistra. Ogni vista è un'immagine generata solo quando la si chiede, poi resta ----------
const GIRI = ["fronte", "destra", "dietro", "sinistra"];
const NOME_GIRO = { fronte: "Davanti", destra: "Lato destro", dietro: "Dietro", sinistra: "Lato sinistro" };
const giri = (() => { try { return JSON.parse(localStorage.getItem(CHIAVE + "-giri")) || {}; } catch { return {}; } })();   // "immagine|vista" → immagine girata
let vistaGiro = 0, girando = null;
function ricordaGiri() {
  const k = Object.keys(giri); for (const x of k.slice(0, Math.max(0, k.length - 90))) delete giri[x];
  try { localStorage.setItem(CHIAVE + "-giri", JSON.stringify(giri)); } catch {}
}
async function gira(fronte, vista) {
  const k = fronte + "|" + vista;
  if (giri[k] || girando) return;
  girando = k; disegnaPalco();
  try {
    const r = await fetch(SERVER + "/gira", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ immagine: fronte, vista, lingua: LINGUA }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.url) throw new Error(d.messaggio || "Non sono riuscito a girare l'avatar. Riprova.");
    await new Promise((ok, ko) => { const im = new Image(); im.onload = ok; im.onerror = ko; im.src = d.url; });
    giri[k] = d.url; ricordaGiri();
    if (d.restano != null && d.restano <= 3) toast(d.restano ? `Oggi ti restano ${d.restano} immagini` : "Era l'ultima immagine di oggi");
  } catch (e) { toast(e.message || "Non sono riuscito a girare l'avatar. Riprova."); if (girando === k) vistaGiro = 0; }
  finally { girando = null; if (!$("s-camerino").hidden) disegnaPalco(); }
}
const chiaveLook = () => profilo.genere + "|" + (profilo.avatar?.url || "") + "|" + S.capiDi(outfit).map(S.chiave).join("+");
function ricordaProve() {
  const k = Object.keys(prove); for (const x of k.slice(0, Math.max(0, k.length - 60))) delete prove[x];    // le ultime 60 bastano
  try { localStorage.setItem(CHIAVE + "-prove", JSON.stringify(prove)); } catch {}
}
async function provaLook() {
  if (!SERVER || inCorso || S.mancanti(outfit).length) return;
  const k = chiaveLook();
  inCorso = k; disegnaPalco();
  try {
    const r = await fetch(SERVER + "/prova", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ lingua: LINGUA, avatar: avatarPerServer(), capi: S.capiDi(outfit).map(c => ({ posto: S.postoDi(c), url: "https://cdn.shopify.com/s/files/" + c.i.slice(1) })) }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.url) throw new Error(d.messaggio || "Non sono riuscito a vestire l'avatar. Riprova.");
    await new Promise((ok, ko) => { const im = new Image(); im.onload = ok; im.onerror = ko; im.src = d.url; });    // pronta prima di mostrarla
    prove[k] = d.url; ricordaProve();
    if (chiaveLook() === k) { vestito = true; vistaAvatar = 0; vistaGiro = 0; }
    if (d.restano != null && d.restano <= 3) toast(d.restano ? `Oggi ti restano ${d.restano} prove` : "Era l'ultima prova di oggi");
  } catch (e) { toast(e.message || "Non sono riuscito a vestire l'avatar. Riprova."); }
  finally { inCorso = null; if (!$("s-camerino").hidden) disegnaPalco(); }
}

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
/** Mostra uno schermo; la barra in basso c'è solo in Camerino e Scopri. */
function mostra(id) {
  for (const s of document.querySelectorAll(".schermo")) s.hidden = s.id !== id;
  $("schede").hidden = !(id === "s-camerino" || id === "s-scopri");
  for (const b of $("schede").children) { if ("s-" + b.dataset.s === id) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); }
}

// ---------- avvisi brevi, con "Annulla" ----------
function toast(testo, annulla, pulsante = "Annulla") {
  const el = $("toast");
  el.innerHTML = `<span>${esc(testo)}</span>` + (annulla ? `<button>${esc(pulsante)}</button>` : "");
  if (annulla) el.querySelector("button").onclick = () => { el.classList.remove("su"); annulla(); };
  el.classList.add("su"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("su"), annulla ? 5000 : 2400);
}

// ---------- fogli ----------
let alChiudere = null;     // cosa fare quando si chiude il foglio principale (comunque si chiuda)
function apriFoglio(titolo, html, livello = 1) {
  const f = $(livello === 2 ? "foglio2" : "foglio");
  if (livello === 1) alChiudere = null;
  $(f.id + "-titolo").textContent = titolo;
  const corpo = $(f.id + "-corpo"); corpo.innerHTML = html; corpo.scrollTop = 0; corpo.onclick = null;
  f.classList.add("aperto"); f.setAttribute("aria-hidden", "false");
  return corpo;
}
function chiudiFoglio(livello = 1) {
  const f = $(livello === 2 ? "foglio2" : "foglio");
  const aperto = f.classList.contains("aperto");
  f.classList.remove("aperto"); f.setAttribute("aria-hidden", "true");
  if (livello === 1 && aperto && alChiudere) { const fai = alChiudere; alChiudere = null; fai(); }
}
$("foglio-chiudi").onclick = () => chiudiFoglio(1);
$("foglio2-chiudi").onclick = () => chiudiFoglio(2);
document.addEventListener("keydown", e => { if (e.key === "Escape") { if ($("foglio2").classList.contains("aperto")) chiudiFoglio(2); else chiudiFoglio(1); } });

// ======================================================================
// PROFILO — quattro passi, poi si entra con un look già composto
// ======================================================================
const PASSI = ["chi", "taglie", "colori", "budget"];
let passo = 0, daProfilo = false;

function disegnaPasso() {
  const el = $("passo"), nome = PASSI[passo];
  const dove = `<div class="dove"><span>${passo > 0 ? `<button class="testo-link" id="indietro">← Indietro</button>` : "Camerino"}</span><span>${passo + 1} di ${PASSI.length}</span></div>`;
  const avanti = (testo, ok = true) => `<div class="piede"><button class="pieno" id="avanti" ${ok ? "" : "disabled"}><span>${testo}</span><span>→</span></button></div>`;
  const scelte = (id, valori, attuale) => `<div class="scelte" id="${id}">${valori.map(v => `<button data-v="${v}" aria-pressed="${attuale === v}">${v}</button>`).join("")}</div>`;

  if (nome === "chi") {
    el.innerHTML = `${dove}<h1>Donna o uomo?</h1>
      <div class="grandi" id="genere">
        <button data-v="d" aria-pressed="${profilo.genere === "d"}"><span>Donna</span><span>→</span></button>
        <button data-v="u" aria-pressed="${profilo.genere === "u"}"><span>Uomo</span><span>→</span></button>
      </div>`;
    $("genere").onclick = e => {
      const b = e.target.closest("button"); if (!b) return;
      if (profilo.genere !== b.dataset.v) { profilo.genere = b.dataset.v; profilo.scarpa = null; DATI = null; outfit = S.outfitVuoto(); bloccati.clear(); vistaAvatar = 0; }
      passo++; disegnaPasso();
    };
  }
  if (nome === "taglie") {
    const numeri = profilo.genere === "u" ? S.NUMERI_SCARPE.filter(n => n >= 39) : S.NUMERI_SCARPE.filter(n => n <= 42);
    const pronto = () => profilo.tagliaSopra && profilo.tagliaSotto && profilo.scarpa;
    el.innerHTML = `${dove}<h1>Le tue taglie</h1>
      <div class="campo"><div class="etichetta"><span>Sopra</span></div>${scelte("t-sopra", S.TAGLIE, profilo.tagliaSopra)}</div>
      <div class="campo"><div class="etichetta"><span>Sotto</span></div>${scelte("t-sotto", S.TAGLIE, profilo.tagliaSotto)}</div>
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
    el.innerHTML = `${dove}<h1>I tuoi colori</h1><p class="sotto">Scegli la tua stagione. Se non la sai, usa una foto o salta.</p>
      <div class="stagioni" id="stagioni">${Object.entries(S.STAGIONI).map(([k, s]) => `<button class="stagione" data-v="${k}" aria-pressed="${profilo.stagione === k}"><span><b>${s.nome}</b><small>${s.desc}</small></span><span class="pallini">${s.colori.map(c => `<i style="background:${c}"></i>`).join("")}</span></button>`).join("")}</div>
      <div class="campo" style="margin-top:14px">
        <label class="vuoto" style="cursor:pointer">Usa una foto del viso<input type="file" id="selfie" accept="image/*" hidden></label>
        <div class="esito" id="esito" hidden></div>
      </div>
      <div class="piede"><button class="pieno" id="avanti"><span>${profilo.stagione ? "Avanti" : "Salta"}</span><span>→</span></button></div>`;
    const segna = k => { profilo.stagione = profilo.stagione === k ? null : k; for (const x of $("stagioni").children) x.setAttribute("aria-pressed", x.dataset.v === profilo.stagione); $("avanti").firstElementChild.textContent = profilo.stagione ? "Avanti" : "Salta"; };
    $("stagioni").onclick = e => { const b = e.target.closest("button"); if (b) segna(b.dataset.v); };
    $("selfie").onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      const out = $("esito"); out.hidden = false; out.textContent = "Un attimo…";
      try {
        const { stagioneDaFoto } = await import("./palette.js");
        const r = await stagioneDaFoto(f);
        if (!r) { out.textContent = "Qui non vedo un viso. Prova con una foto di fronte, in buona luce."; return; }
        if (profilo.stagione !== r.stagione) segna(r.stagione);
        out.innerHTML = `Dalla foto: <b>${S.STAGIONI[r.stagione].nome}</b>. È una stima, la luce può ingannare: se non ti convince cambiala qui sopra.`;
      } catch { out.textContent = "Non riesco a leggere la foto. Scegli tu qui sopra."; }
    };
  }
  if (nome === "budget") {
    el.innerHTML = `${dove}<h1>Budget</h1><p class="sotto">Per tutto il look, scarpe comprese.</p>
      <div class="campo"><div class="etichetta"><span>Fino a</span><output id="o-budget">${euro(profilo.budget)}</output></div>
        <input type="range" id="i-budget" min="100" max="3000" step="50" value="${profilo.budget}" aria-label="Budget del look in euro"></div>
      <div class="campo"><label class="interruttore"><input type="checkbox" id="i-capospalla" ${profilo.conCapospalla ? "checked" : ""}> Con giacca o cappotto</label></div>
      <div class="campo"><div class="etichetta"><span>Stile</span><span>se vuoi</span></div>
        <div class="scelte" id="stili">${S.STILI.map(k => `<button data-v="${k}" aria-pressed="${profilo.stili.includes(k)}">${k}</button>`).join("")}</div></div>
      ${avanti(daProfilo ? "Fatto" : "Entra")}`;
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

// ======================================================================
// IL MIO ACCOUNT — si guarda e si modifica sul posto; la ✕ riporta dove eri
// ======================================================================
function apriAccount(prima = JSON.stringify(profilo)) {
  const scelte = (campo, valori, attuale) => `<div class="scelte" data-campo="${campo}">${valori.map(v => `<button data-v="${v}" aria-pressed="${String(attuale) === String(v)}">${v}</button>`).join("")}</div>`;
  const numeri = profilo.genere === "u" ? S.NUMERI_SCARPE.filter(n => n >= 39) : S.NUMERI_SCARPE.filter(n => n <= 42);
  const corpo = apriFoglio("Il mio account", `
    <div class="campo" style="border-top:0"><div class="etichetta"><span>Capi da</span></div>
      <div class="scelte" data-campo="genere"><button data-v="d" aria-pressed="${profilo.genere === "d"}">Donna</button><button data-v="u" aria-pressed="${profilo.genere === "u"}">Uomo</button></div></div>
    <div class="campo"><div class="etichetta"><span>Taglia sopra</span></div>${scelte("tagliaSopra", S.TAGLIE, profilo.tagliaSopra)}</div>
    <div class="campo"><div class="etichetta"><span>Taglia sotto</span></div>${scelte("tagliaSotto", S.TAGLIE, profilo.tagliaSotto)}</div>
    <div class="campo"><div class="etichetta"><span>Scarpe</span></div>${scelte("scarpa", numeri, profilo.scarpa)}</div>
    <div class="campo"><div class="etichetta"><span>Budget del look</span><output id="a-o-budget">${euro(profilo.budget)}</output></div>
      <input type="range" id="a-budget" min="100" max="3000" step="50" value="${profilo.budget}" aria-label="Budget del look in euro">
      <label class="interruttore"><input type="checkbox" id="a-capospalla" ${profilo.conCapospalla ? "checked" : ""}> Con giacca o cappotto</label></div>
    <div class="campo"><div class="etichetta"><span>Colori</span><span>${profilo.stagione ? "" : "nessuna stagione"}</span></div>
      <div class="stagioni" data-campo="stagione">${Object.entries(S.STAGIONI).map(([k, st]) => `<button class="stagione" data-v="${k}" aria-pressed="${profilo.stagione === k}"><span><b>${st.nome}</b><small>${st.desc}</small></span><span class="pallini">${st.colori.map(c => `<i style="background:${c}"></i>`).join("")}</span></button>`).join("")}</div></div>
    <div class="campo"><div class="etichetta"><span>Stile</span></div>
      <div class="scelte" data-campo="stili">${S.STILI.map(k => `<button data-v="${k}" aria-pressed="${profilo.stili.includes(k)}">${k}</button>`).join("")}</div></div>
    <div class="campo"><div class="etichetta"><span>Avatar</span><span>${avatarScelto() ? avatarScelto().nome : "base"}</span></div>
      <button class="vuoto" id="a-avatar">Cambia avatar</button></div>
    <div class="campo"><div class="etichetta"><span>Salvati</span><span>${salvati.length}</span></div>
      <button class="vuoto" id="a-salvati">Vedi i look salvati</button></div>
    <div class="campo"><div class="etichetta"><span>Lingua</span></div>
      <div class="scelte" id="a-lingua" translate="no"><button data-l="it" aria-pressed="${LINGUA === "it"}">Italiano</button><button data-l="en" aria-pressed="${LINGUA === "en"}">English</button></div></div>
    <div class="campo"><button class="vuoto" id="a-guida">Come funziona</button></div>
    <div class="campo"><button class="testo-link" id="a-azzera" style="justify-self:start">Cancella tutto e ricomincia</button></div>`);
  corpo.onclick = e => {
    if (e.target.closest("#a-salvati")) { chiudiFoglio(); return apriSalvati(); }
    if (e.target.closest("#a-avatar")) { chiudiFoglio(); return apriAvatar(); }
    if (e.target.closest("#a-guida")) { chiudiFoglio(); return apriGuida(0); }
    const lb = e.target.closest("#a-lingua button");
    if (lb) { cambiaLingua(lb.dataset.l); for (const x of lb.parentElement.children) x.setAttribute("aria-pressed", x === lb); return; }
    if (e.target.closest("#a-azzera")) {
      if (!corpo.querySelector("#a-azzera").dataset.sicuro) { corpo.querySelector("#a-azzera").dataset.sicuro = 1; corpo.querySelector("#a-azzera").textContent = "Tocca di nuovo per cancellare profilo, look e salvati"; return; }
      try { localStorage.removeItem(CHIAVE); } catch {}
      location.replace(location.pathname); return;
    }
    const b = e.target.closest("[data-campo] button"); if (!b) return;
    const gruppo = b.parentElement, campo = gruppo.dataset.campo, v = b.dataset.v;
    if (campo === "stili") { profilo.stili = profilo.stili.includes(v) ? profilo.stili.filter(x => x !== v) : [...profilo.stili, v]; b.setAttribute("aria-pressed", profilo.stili.includes(v)); return; }
    if (campo === "stagione") { profilo.stagione = profilo.stagione === v ? null : v; for (const x of gruppo.children) x.setAttribute("aria-pressed", x.dataset.v === profilo.stagione); return; }
    if (campo === "genere" && v !== profilo.genere) { profilo.genere = v; profilo.scarpa = null; alChiudere = null; return apriAccount(prima); }   // ridisegna: cambiano i numeri delle scarpe
    profilo[campo] = campo === "scarpa" ? +v : v;
    for (const x of gruppo.children) x.setAttribute("aria-pressed", x === b);
  };
  corpo.querySelector("#a-budget").oninput = e => { profilo.budget = +e.target.value; corpo.querySelector("#a-o-budget").textContent = euro(profilo.budget); };
  corpo.querySelector("#a-capospalla").onchange = e => { profilo.conCapospalla = e.target.checked; };
  // alla chiusura: si salva e il camerino si aggiorna; se è cambiato il genere si riparte con un look nuovo
  alChiudere = () => {
    if (!profilo.scarpa) { daProfilo = false; passo = 1; mostra("s-profilo"); disegnaPasso(); outfit = S.outfitVuoto(); bloccati.clear(); DATI = null; return; }   // ha cambiato genere senza scegliere il numero
    if (JSON.stringify(profilo) === prima) return;
    const cambiatoGenere = JSON.parse(prima).genere !== profilo.genere;
    ricorda();
    if (cambiatoGenere) { outfit = S.outfitVuoto(); bloccati.clear(); vistaAvatar = 0; DATI = null; return entra(); }
    if (!$("s-camerino").hidden) disegna();
    const fuori = S.capiDi(outfit).filter(c => !S.haTaglia(c, profilo));
    toast(fuori.length ? `${fuori.length === 1 ? "Un capo non c'è" : `${fuori.length} capi non ci sono`} nella nuova taglia` : "Salvato");
    if (fuori.length) setTimeout(() => toast("Rifaccio il look con le nuove taglie?", () => { for (const c of fuori) bloccati.delete(S.postoDi(c)); componi(false); }, "Sì"), 2600);
  };
}
$("apri-profilo").onclick = () => apriAccount();

// ======================================================================
// CAMERINO — l'avatar a tutto schermo, i capi del look di fianco
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
    $("budget").innerHTML = ""; disegnaPalco("Un attimo…");
    if (!await carica(profilo.genere)) { disegnaPalco("Non riesco a caricare i capi. Controlla la connessione e riapri."); return; }
    outfit = S.outfitVuoto();
    for (const [p, k] of Object.entries(salvato.outfit || {})) if (k && INDICE.has(k)) outfit[p] = INDICE.get(k);
    salvato.outfit = null;
  }
  if (daProvare) {                       // look arrivato da un link: lo si indossa al posto di comporne uno
    outfit = S.outfitVuoto(); bloccati.clear(); manca = [];
    for (const k of daProvare) { const c = INDICE.get(k); if (c) outfit = S.metti(outfit, c).outfit; }
    daProvare = null; history.replaceState(null, "", location.pathname); ricorda();
  }
  if (!S.capiDi(outfit).length) await componi(false);
  else disegna();
  if (!profilo.guidaVista) { profilo.guidaVista = true; ricorda(); setTimeout(() => apriGuida(0), 400); }
}

/** Compone (o ricompone) tenendo i capi bloccati, poi controlla sul sito dei marchi che la taglia ci sia davvero. */
async function componi(avvisa = true) {
  const prima = outfit;
  const posti = new Set([...bloccati].filter(p => outfit[p]));
  const r = S.componi(DATI.capi, ctx(), outfit, posti, S.casuale(++seme));
  outfit = r.outfit; manca = r.manca;
  disegna(); ricorda();
  if (avvisa && S.capiDi(prima).length) toast("Nuovo look", () => { outfit = prima; manca = []; disegna(); ricorda(); });
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

const LUCCHETTO = `<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`;
const CUORE = `<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>`;
const FIGURA = `<svg viewBox="0 0 24 24"><circle cx="12" cy="6" r="3"/><path d="M12 9v7M8 12h8M12 16l-3 5M12 16l3 5"/></svg>`;
const LENTE = `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5M11 8.5v5M8.5 11h5"/></svg>`;
const MANDA = `<svg viewBox="0 0 24 24"><path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/></svg>`;
/** Le viste dell'avatar: [indirizzo, a specchio]. Quello base si gira trascinando; un avatar scelto o creato ha una vista sola. */
const avatarScelto = () => profilo.avatar && profilo.avatar.genere === profilo.genere ? profilo.avatar : null;
const viste = () => avatarScelto() ? [[avatarScelto().url, 0]] : profilo.genere === "u"
  ? [["../img/avatar_uomo_front.jpg", 0], ["../img/avatar_uomo_side.jpg", 0], ["../img/avatar_uomo_side.jpg", 1]]
  : [["../img/avatar_front.jpg", 0], ["../img/avatar_side.jpg?v=2", 0], ["../img/avatar_back.jpg?v=2", 0], ["../img/avatar_side.jpg?v=2", 1]];
/** L'indirizzo pubblico dell'avatar di fronte, quello che riceve il server. */
const avatarPerServer = () => avatarScelto()?.url || BASE_AVATAR + (profilo.genere === "u" ? "avatar_uomo_front.jpg" : "avatar_front.jpg");

function disegna() {
  // budget: un'informazione, non un pulsante
  const tot = S.totale(outfit), resto = profilo.budget - tot;
  $("budget").className = "budget lati" + (resto < 0 ? " sfora" : "");
  $("budget").innerHTML = `<div class="cifre"><span><b>${euro(tot)}</b> di ${euro(profilo.budget)}</span><span class="resto">${resto < 0 ? "oltre di " + euro(-resto) : "restano " + euro(resto)}</span></div>
    <div class="barra"><i style="width:${Math.min(100, tot / profilo.budget * 100)}%"></i></div>`;
  disegnaPalco();

  const m = S.mancanti(outfit), nomi = m.map(p => ({ sopra: "il sopra", sotto: "il sotto", scarpe: "le scarpe" })[p]);
  let avviso = "";
  if (m.length && manca.length) avviso = `Con ${euro(profilo.budget)} il look non si chiude: ${manca.map(x => `${S.NOME_POSTO[x.posto].toLowerCase()} da ${euro(x.daEuro)}`).join(", ")}. Alza il budget o scegli un capo meno caro.`;
  else if (m.length) avviso = `Manca${m.length > 1 || m[0] === "scarpe" ? "no" : ""} ${nomi.join(m.length > 2 ? ", " : " e ")}.`;
  $("avviso").hidden = !avviso; $("avviso").textContent = avviso;

  const p = $("principale");
  if (m.length) { p.textContent = "Completa il look"; p.onclick = componiMancanti; }
  else { p.textContent = `Compra · ${euro(tot)}`; p.onclick = apriCompra; }
}
/** Riempie solo i posti vuoti, tenendo tutto ciò che c'è. */
async function componiMancanti() {
  const tutti = bloccati; bloccati = new Set(["capospalla", "sopra", "sotto", "scarpe", "abito"].filter(p => outfit[p]));
  const conCapo = profilo.conCapospalla; if (outfit.capospalla === null) profilo.conCapospalla = false;   // non aggiunge una giacca non chiesta
  await componi(false);
  profilo.conCapospalla = conCapo; bloccati = tutti; disegna();
}

function disegnaPalco(messaggio) {
  if (messaggio) { $("palco").innerHTML = `<div class="riquadro" style="position:absolute;inset:0;height:auto;border:0;background:none"><div class="solo-testo">${esc(messaggio)}</div></div>`; return; }
  const vv = viste(), k = chiaveLook(), foto_ = prove[k], conLook = !!(foto_ && vestito), completo = !S.mancanti(outfit).length;
  // quale immagine: l'avatar base senza look ha già le sue viste (gratis, si gira trascinando); gli altri si girano con le frecce
  const base = !conLook && !avatarScelto();
  const fronte = conLook ? foto_ : avatarScelto()?.url;
  let src, specchio = 0, attesa = inCorso === k;
  if (base) [src, specchio] = vv[vistaAvatar % vv.length];
  else {
    if (vistaGiro && !giri[fronte + "|" + GIRI[vistaGiro]] && girando !== fronte + "|" + GIRI[vistaGiro]) vistaGiro = 0;   // look o avatar cambiato: si torna davanti
    const vista = GIRI[vistaGiro], girata = vistaGiro ? giri[fronte + "|" + vista] : fronte;
    src = girata || fronte; if (!girata) attesa = true;
  }
  palcoOra = { src, specchio, fronte, base };
  const pillola = !SERVER ? `<button class="pillola" id="info-prova">I capi sull'avatar arrivano presto</button>`
    : inCorso === k ? `<span class="pillola">Sto vestendo l'avatar…</span>`
    : girando ? `<span class="pillola">Sto girando l'avatar…</span>`
    : foto_ ? `<button class="pillola" id="vista-look">${vestito ? "Vedi senza il look" : "Vedi con il look"}</button>`
    : completo ? `<button class="pillola nera" id="prova">Prova il look</button>`
    : `<span class="pillola">Completa il look per provarlo</span>`;
  const posti = outfit.abito ? ["capospalla", "abito", "scarpe"] : ["capospalla", "sopra", "sotto", "scarpe"];
  const caselle = posti.map(p => {
    const c = outfit[p];
    if (!c) return `<button class="casella libera" data-cambia="${p}" aria-label="Scegli: ${S.NOME_POSTO[p].toLowerCase()}">+<small>${S.NOME_POSTO[p]}</small></button>`;
    return `<button class="casella ${p}" data-apri="${p}" aria-label="${S.NOME_POSTO[p]}: ${esc(c.t)}"><img src="${foto(c, 160)}" alt="">${bloccati.has(p) ? `<span class="lucchetto">${LUCCHETTO}</span>` : ""}<small>${S.NOME_POSTO[p]}</small></button>`;
  }).join("");
  const giaSalvato = salvati.some(s => s.capi.join() === S.capiDi(outfit).map(S.chiave).join());
  const nomeVista = base ? null : NOME_GIRO[GIRI[vistaGiro]];
  const frecce = base ? (vv.length > 1 ? `<div class="giro"><button class="icona" id="gira-sx" aria-label="Gira a sinistra">‹</button><span class="punti-giro">${vv.map((_, i) => `<i class="${i === vistaAvatar % vv.length ? "ora" : ""}"></i>`).join("")}</span><button class="icona" id="gira-dx" aria-label="Gira a destra">›</button></div>` : "")
    : SERVER ? `<div class="giro"><button class="icona" id="gira-sx" aria-label="Gira a sinistra" ${girando ? "disabled" : ""}>‹</button><span class="nome-vista">${nomeVista}</span><button class="icona" id="gira-dx" aria-label="Gira a destra" ${girando ? "disabled" : ""}>›</button></div>` : "";
  $("palco").innerHTML = `<div class="tela"><img class="avatar${specchio ? " specchio" : ""}${attesa ? " attesa" : ""}" src="${esc(src)}" alt="${conLook ? "L'avatar con il look" : "Avatar"}" draggable="false"></div>
    ${pillola}
    <div class="colonna">${caselle}</div>
    <div class="attrezzi"><button class="icona" id="salva" aria-label="Salva questo look" aria-pressed="${giaSalvato}">${CUORE}</button><button class="icona" id="condividi" aria-label="Condividi questo look">${MANDA}</button><button class="icona" id="cambia-avatar" aria-label="Cambia avatar">${FIGURA}</button><button class="icona" id="zoom" aria-label="Ingrandisci">${LENTE}</button></div>
    ${frecce}`;
}
let palcoOra = {};
/** Una freccia: l'avatar base passa alla vista dopo; gli altri chiedono la vista al server se non c'è ancora. */
function frecciaGiro(verso) {
  if (palcoOra.base) { const n = viste().length; vistaAvatar = ((vistaAvatar + verso) % n + n) % n; return disegnaPalco(); }
  if (girando) return;
  vistaGiro = ((vistaGiro + verso) % 4 + 4) % 4;
  const vista = GIRI[vistaGiro];
  if (vistaGiro && !giri[palcoOra.fronte + "|" + vista]) gira(palcoOra.fronte, vista); else disegnaPalco();
}

// ---------- zoom con due dita (Andrea, 18/11: "come si fa con una foto, con qualsiasi cosa sui telefoni") ----------
// Pizzicare ingrandisce il punto fra le dita (fino a 5 volte), con un dito si sposta, doppio tocco ingrandisce o torna com'era.
// Vale sull'avatar nel camerino, a tutto schermo (lente) e sulla foto del capo nella scheda.
function pizzico(contenitore, bersaglio) {
  const dita = new Map();
  let s = 1, tx = 0, ty = 0, el = null, inizio = null, tocco = 0;
  const mio = () => { const b = bersaglio(); if (b !== el) { el = b; s = 1; tx = ty = 0; } return el; };
  const metti = (anima) => {
    const b = mio(); if (!b) return;
    const r = contenitore.getBoundingClientRect(), w = b.offsetWidth, h = b.offsetHeight;
    s = Math.min(5, Math.max(1, s));
    tx = Math.min(0, Math.max(w - w * s, tx)); ty = Math.min(0, Math.max(h - h * s, ty));
    if (s === 1) tx = ty = 0;
    b.style.transformOrigin = "0 0"; b.style.transition = anima ? "transform .2s" : "none";
    b.style.transform = s === 1 ? "" : `translate(${tx}px, ${ty}px) scale(${s})`;
    contenitore.classList.toggle("zoomato", s > 1);
    void r;
  };
  const punto = e => { const b = mio().getBoundingClientRect(), x = b.left - tx, y = b.top - ty; return { x: e.clientX - x, y: e.clientY - y }; };
  const due = () => { const [a, b] = [...dita.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
  const parti = () => {
    if (dita.size >= 2) { const m = due(); inizio = { s, tx, ty, ...m }; }
    else if (dita.size === 1) { const [p] = dita.values(); inizio = { s, tx, ty, x: p.x, y: p.y, uno: true }; }
    else inizio = null;
  };
  contenitore.addEventListener("pointerdown", e => {
    if (e.target.closest("button") || !mio()) return;
    dita.set(e.pointerId, punto(e)); parti();
    if (dita.size === 2) contenitore.setPointerCapture?.(e.pointerId);
  });
  contenitore.addEventListener("pointermove", e => {
    if (!dita.has(e.pointerId) || !inizio) return;
    dita.set(e.pointerId, punto(e));
    if (dita.size >= 2 && !inizio.uno) {
      const m = due(), q = { x: (inizio.x - inizio.tx) / inizio.s, y: (inizio.y - inizio.ty) / inizio.s };
      s = inizio.s * m.d / inizio.d; s = Math.min(5, Math.max(1, s));
      tx = m.x - s * q.x; ty = m.y - s * q.y; metti(false);
    } else if (inizio.uno && inizio.s > 1) {
      const [p] = dita.values(); tx = inizio.tx + p.x - inizio.x; ty = inizio.ty + p.y - inizio.y; metti(false);
    } else if (dita.size >= 2) parti();
  });
  const fine = e => {
    if (!dita.has(e.pointerId)) return;
    const p = dita.get(e.pointerId), eraUno = dita.size === 1 && inizio?.uno, mosso = inizio && Math.hypot(p.x - inizio.x, p.y - inizio.y) > 8;
    dita.delete(e.pointerId); parti();
    if (eraUno && !mosso && e.type === "pointerup") {          // doppio tocco
      const ora = Date.now();
      if (ora - tocco < 320) { tocco = 0; if (s > 1) s = 1; else { const q = { x: (p.x - tx) / s, y: (p.y - ty) / s }; s = 2.5; tx = p.x - s * q.x; ty = p.y - s * q.y; } metti(true); }
      else tocco = ora;
    }
  };
  contenitore.addEventListener("pointerup", fine); contenitore.addEventListener("pointercancel", fine);
  // Safari: niente zoom di tutta la pagina mentre si pizzica qui
  for (const ev of ["gesturestart", "gesturechange"]) contenitore.addEventListener(ev, e => e.preventDefault());
  return { dita: () => dita.size, zoomato: () => s > 1, azzera: () => { s = 1; tx = ty = 0; metti(false); } };
}
// a tutto schermo (la lente)
const zoomGrande = pizzico($("zoom-vista"), () => $("zoom-vista").querySelector(".tela"));
function apriZoom() {
  const z = $("zoom-vista"), im = z.querySelector("img");
  im.src = palcoOra.src; im.className = palcoOra.specchio ? "specchio" : ""; z.hidden = false; zoomGrande.azzera();
}
$("zoom-vista").querySelector("button").onclick = () => { $("zoom-vista").hidden = true; };
document.addEventListener("keydown", e => { if (e.key === "Escape") $("zoom-vista").hidden = true; });
// direttamente sull'avatar nel camerino
const zoomPalco = pizzico($("palco"), () => $("palco").querySelector(".tela"));
// girare l'avatar trascinando; un tocco fermo sulle caselle le apre
let presa = null;
$("palco").addEventListener("pointerdown", e => { if (e.target.closest("button") || !palcoOra.base || viste().length < 2 || zoomPalco.zoomato() || zoomPalco.dita() > 1) { presa = null; $("palco").classList.remove("gira"); return; } presa = { x: e.clientX, passi: 0 }; $("palco").classList.add("gira"); $("palco").setPointerCapture(e.pointerId); });
$("palco").addEventListener("pointermove", e => {
  if (!presa) return;
  if (zoomPalco.dita() > 1 || zoomPalco.zoomato()) { presa = null; $("palco").classList.remove("gira"); return; }
  const passi = Math.trunc((e.clientX - presa.x) / 55);
  if (passi !== presa.passi) { const n = viste().length; vistaAvatar = ((vistaAvatar - (passi - presa.passi)) % n + n) % n; presa.passi = passi; disegnaPalco(); }
});
for (const ev of ["pointerup", "pointercancel"]) $("palco").addEventListener(ev, () => { presa = null; $("palco").classList.remove("gira"); });
$("palco").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.apri) apriScheda(outfit[b.dataset.apri]);
  else if (b.dataset.cambia) apriCambia(b.dataset.cambia);
  else if (b.id === "salva") salva();
  else if (b.id === "condividi") condividi();
  else if (b.id === "info-prova") apriInfoProva();
  else if (b.id === "prova") provaLook();
  else if (b.id === "cambia-avatar") apriAvatar();
  else if (b.id === "vista-look") { vestito = !vestito; vistaAvatar = 0; vistaGiro = 0; disegnaPalco(); }
  else if (b.id === "gira-sx") frecciaGiro(-1);
  else if (b.id === "gira-dx") frecciaGiro(1);
  else if (b.id === "zoom") apriZoom();
});
$("altro").onclick = () => componi(true);

/** Mette un capo nel look, con "Annulla" e l'avviso se ha sostituito altro. */
function indossa(capo) {
  const prima = outfit, r = S.metti(outfit, capo);
  outfit = r.outfit; manca = [];
  for (const p of [...bloccati]) if (!outfit[p]) bloccati.delete(p);
  ricorda(); disegna();
  const tolti = r.tolti.filter(t => S.postoDi(t) !== S.postoDi(capo));
  toast(tolti.length ? `Aggiunto. Via ${tolti.map(t => S.NOME_POSTO[S.postoDi(t)].toLowerCase()).join(" e ")}` : "Aggiunto", () => { outfit = prima; ricorda(); disegna(); });
}

// ---------- salvati ----------
function salva() {
  const capi = S.capiDi(outfit).map(S.chiave); if (!capi.length) return;
  const i = salvati.findIndex(s => s.capi.join() === capi.join());
  if (i >= 0) { salvati.splice(i, 1); toast("Tolto dai salvati"); } else { salvati.unshift({ capi, quando: Date.now() }); toast("Salvato"); }
  ricorda(); disegnaPalco();
}
function apriSalvati() {
  const righe = salvati.map((s, i) => {
    const capi = s.capi.map(k => INDICE.get(k)).filter(Boolean);
    return `<div class="salvato"><div class="strip">${capi.map(c => `<img src="${foto(c, 120)}" alt="${esc(c.t)}">`).join("")}</div>
      <div class="sotto-strip"><span>${capi.length} capi · ${euro(capi.reduce((t, c) => t + c.e, 0))}${capi.length < s.capi.length ? " · qualcuno non c'è più" : ""}</span>
      <span style="display:flex;gap:6px"><button class="piccolo" data-indossa="${i}">Indossa</button><button class="piccolo" data-via="${i}">Elimina</button></span></div></div>`;
  }).join("");
  const corpo = apriFoglio("Salvati", righe || `<p class="niente">Ancora niente. Il cuore nel camerino salva il look che stai guardando.</p>`);
  corpo.onclick = e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.via) { salvati.splice(+b.dataset.via, 1); ricorda(); apriSalvati(); disegnaPalco(); return; }
    const prima = outfit; outfit = S.outfitVuoto();
    for (const k of salvati[+b.dataset.indossa].capi) { const c = INDICE.get(k); if (c) outfit = S.metti(outfit, c).outfit; }
    bloccati.clear(); manca = []; ricorda(); mostra("s-camerino"); disegna(); chiudiFoglio();
    toast("Fatto", () => { outfit = prima; ricorda(); disegna(); });
  };
}
$("schede").onclick = e => {
  const b = e.target.closest("button"); if (!b || !DATI) return;
  if (b.dataset.s === "salvati") return apriSalvati();
  chiudiFoglio(2); chiudiFoglio(1);
  if (b.dataset.s === "scopri") { mostra("s-scopri"); scopri(); } else { mostra("s-camerino"); disegna(); }
};

// ======================================================================
// FILTRI — come nell'app di Zalando (Andrea, 18/11): più scelte nello stesso filtro (blu + nero + rosso, cashmere + cotone)
// e filtri diversi insieme. Dentro un filtro vale "uno qualsiasi", tra filtri diversi "tutti". I dati vengono dal negozio:
// un capo di cui il negozio non dice il materiale (o la fantasia, lo scollo…) non compare quando si filtra per quello.
// ======================================================================
const NOMI_FILTRI = {
  f: { cotone: "Cotone", lana: "Lana", cashmere: "Cashmere", seta: "Seta", lino: "Lino", pelle: "Pelle", denim: "Denim", velluto: "Velluto", viscosa: "Viscosa", sintetico: "Sintetico" },
  m: { righe: "A righe", quadri: "A quadri", fiori: "Floreale", pois: "A pois", animalier: "Animalier", stampa: "Altre stampe" },
  a: { aderente: "Aderente", regolare: "Regolare", ampia: "Ampia", oversize: "Oversize" },
  l: { corta: "Corta", normale: "Normale", lunga: "Lunga" },
  w: { senza: "Senza maniche", corte: "Maniche corte", "3/4": "Maniche 3/4", lunghe: "Maniche lunghe" },
  z: { v: "Scollo a V", giro: "Girocollo", alto: "Collo alto", quadrato: "Scollo quadrato", spalle: "Spalle scoperte", americana: "All'americana" },
  prezzo: { p1: "Fino a 50 €", p2: "50–100 €", p3: "100–200 €", p4: "200–400 €", p5: "Oltre 400 €" },
};
const FASCE = { p1: [0, 50], p2: [50, 100], p3: [100, 200], p4: [200, 400], p5: [400, Infinity] };
const COLORI_FILTRO = [["nero", "#141414"], ["bianco", "#f7f7f5"], ["panna", "#f1ead8"], ["beige", "#d6c3a3"], ["cammello", "#b0814f"], ["marrone", "#5a3d2b"], ["grigio", "#8d8d8d"],
  ["navy", "#1c2541"], ["blu", "#2f5d9e"], ["azzurro", "#8fb6dd"], ["verde", "#3f6b45"], ["oliva", "#6b6b3a"], ["rosso", "#b3202a"], ["bordeaux", "#5c1a26"], ["rosa", "#e7a3b5"],
  ["arancione", "#e5762b"], ["giallo", "#f0cf3a"], ["viola", "#5e3a87"], ["lilla", "#c3a6d8"]];
const LAB_FILTRO = Object.fromEntries(COLORI_FILTRO.map(([v, hex]) => [v, S.lab(hex)]));
const ORDINI = [["consigliati", "Consigliati"], ["prezzo-su", "Prezzo crescente"], ["prezzo-giu", "Prezzo decrescente"], ["sconto", "Sconto più alto"]];
/** I filtri nell'ordine in cui si vedono; `per` dice in quali posti hanno senso. */
const GRUPPI = [
  { k: "colore", nome: "Colore" }, { k: "prezzo", nome: "Prezzo" }, { k: "marca", nome: "Marca" },
  { k: "f", nome: "Materiale", per: p => p !== "scarpe" }, { k: "m", nome: "Fantasia", per: p => p !== "scarpe" },
  { k: "a", nome: "Vestibilità", per: p => p !== "scarpe" }, { k: "l", nome: "Lunghezza", per: p => ["sotto", "abito", "capospalla"].includes(p) },
  { k: "w", nome: "Maniche", per: p => ["sopra", "abito"].includes(p) }, { k: "z", nome: "Scollo", per: p => ["sopra", "abito"].includes(p) },
];
const CHIAVI = GRUPPI.map(g => g.k);
const nuoviFiltri = () => ({ ...Object.fromEntries(CHIAVI.map(k => [k, new Set()])), saldi: false, ordina: "consigliati" });
const copiaFiltri = st => ({ ...Object.fromEntries(CHIAVI.map(k => [k, new Set(st[k])])), saldi: st.saldi, ordina: st.ordina });
const gruppiPer = posto => GRUPPI.filter(g => !g.per || g.per(posto));
/** Toglie i filtri che non hanno senso nel nuovo posto (es. le maniche passando ai pantaloni). */
function adattaFiltri(st, posto) { const ok = new Set(gruppiPer(posto).map(g => g.k)); for (const k of CHIAVI) if (!ok.has(k)) st[k].clear(); }
const vicinoA = (c, hex) => c.x && Math.hypot(...S.lab(c.x).map((v, i) => v - S.lab(hex)[i])) < 16;
const colorePassa = (c, v) => c.x && Math.hypot(...S.lab(c.x).map((x, i) => x - LAB_FILTRO[v][i])) < 16;
/** Un valore del capo per un filtro (per contare e filtrare). */
function passaUno(c, k, v) {
  if (k === "colore") return colorePassa(c, v);
  if (k === "prezzo") return c.e >= FASCE[v][0] && c.e < FASCE[v][1];
  if (k === "marca") return c.n === +v;
  if (k === "l") return v === "normale" ? !c.l || c.l === "media" : c.l === v;
  return c[k] === v;
}
const comeSet = v => v instanceof Set ? v : v == null ? new Set() : new Set([v]);
/** Il capo passa tutti i filtri? `salta` = un filtro da ignorare (per contare le scelte di quel filtro). Accetta anche { l: "corta" }. */
function passaFiltri(c, st, salta) {
  if (st.saldi && !c.o) return false;
  for (const k of CHIAVI) {
    if (k === salta) continue;
    const vv = comeSet(st[k]); if (!vv.size) continue;
    let ok = false; for (const v of vv) if (passaUno(c, k, v)) { ok = true; break; }
    if (!ok) return false;
  }
  return true;
}
const quantiFiltri = st => CHIAVI.reduce((n, k) => n + st[k].size, 0) + (st.saldi ? 1 : 0);
const sconto = c => c.o ? 1 - c.e / c.o : 0;
/** Filtra e ordina una lista. */
function applicaFiltri(lista, st) {
  const out = lista.filter(c => passaFiltri(c, st));
  if (st.ordina === "prezzo-su") out.sort((a, b) => a.e - b.e);
  else if (st.ordina === "prezzo-giu") out.sort((a, b) => b.e - a.e);
  else if (st.ordina === "sconto") out.sort((a, b) => sconto(b) - sconto(a));
  return out;
}
/** Le scelte di un filtro: [valore, nome, quanti capi] — il numero tiene conto degli altri filtri, come su Zalando. */
function sceltePer(k, base, st) {
  const dentro = base.filter(c => passaFiltri(c, st, k));
  if (k === "marca") {
    const n = new Map(); for (const c of dentro) n.set(c.n, (n.get(c.n) || 0) + 1);
    for (const v of st.marca) if (!n.has(+v)) n.set(+v, 0);
    return [...n].sort((a, b) => DATI.negozi[a[0]].nome.localeCompare(DATI.negozi[b[0]].nome)).map(([i, q]) => [String(i), DATI.negozi[i].nome, q]);
  }
  const voci = k === "colore" ? COLORI_FILTRO.map(([v]) => [v, v]) : Object.entries(NOMI_FILTRI[k]);
  return voci.map(([v, nome]) => [v, nome, dentro.reduce((q, c) => q + passaUno(c, k, v), 0)]);
}
const riassunto = (k, st) => {
  const vv = [...st[k]]; if (!vv.length) return "";
  const nome = v => k === "marca" ? DATI.negozi[+v].nome : k === "colore" ? v[0].toUpperCase() + v.slice(1) : NOMI_FILTRI[k][v];
  return vv.length > 2 ? `${nome(vv[0])}, ${nome(vv[1])} +${vv.length - 2}` : vv.map(nome).join(", ");
};
/** La riga di filtri sopra la lista: Ordina, Filtri, poi un pulsante per filtro (scuro se attivo) e Saldi. */
function htmlFiltri(st, posto) {
  const n = quantiFiltri(st);
  return `<div class="riga-filtri"><button class="piccolo" data-filtri="ordina" aria-pressed="${st.ordina !== "consigliati"}">${ORDINI.find(o => o[0] === st.ordina)[1]} ▾</button>` +
    `<button class="piccolo" data-filtri="tutti" aria-pressed="${n > 0}">Filtri${n ? ` · ${n}` : ""}</button>` +
    gruppiPer(posto).map(g => `<button class="piccolo" data-filtri="${g.k}" aria-pressed="${st[g.k].size > 0}">${g.nome}${st[g.k].size ? ` · ${st[g.k].size}` : ""}</button>`).join("") +
    `<button class="piccolo" data-filtri="saldi" aria-pressed="${st.saldi}">In saldo</button>` +
    (n ? `<button class="piccolo" data-filtri="via">Togli filtri</button>` : "") + `</div>`;
}
/**
 * Gestisce un clic sulla riga dei filtri. Apre il pannello quando serve; `base()` dà la lista non filtrata,
 * `fatto()` ridisegna. Restituisce true se il clic era suo.
 */
function clicFiltri(e, st, posto, base, fatto) {
  const b = e.target.closest("[data-filtri]"); if (!b) return false;
  const k = b.dataset.filtri;
  if (k === "via") { Object.assign(st, nuoviFiltri(), { ordina: st.ordina }); fatto(); }
  else if (k === "saldi") { st.saldi = !st.saldi; fatto(); }
  else apriPannelloFiltri(st, posto, base(), k, fatto);
  return true;
}
/** Il pannello dei filtri: a tutto schermo sopra il resto. Le scelte si applicano con "Mostra N capi"; la ✕ le lascia com'erano. */
function apriPannelloFiltri(st, posto, base, primo, fatto) {
  const bozza = copiaFiltri(st), el = $("pannello-filtri");
  const aperti = new Set(primo === "tutti" ? [] : [primo]);
  const solo = primo !== "tutti";          // aperto da un filtro: si vede solo quello, come su Zalando
  const titolo = primo === "tutti" ? "Filtri" : primo === "ordina" ? "Ordina" : GRUPPI.find(g => g.k === primo).nome;
  const disegnaP = () => {
    const quanti = applicaFiltri(base, bozza).length;
    const gruppo = g => {
      const scelte = sceltePer(g.k, base, bozza), aperto = solo || aperti.has(g.k);
      const voci = scelte.filter(([v, , q]) => q > 0 || bozza[g.k].has(v)).map(([v, nome, q]) => {
        const su = bozza[g.k].has(v);
        if (g.k === "colore") return `<button class="voce-colore" data-fk="colore" data-fv="${v}" aria-pressed="${su}"><i style="background:${COLORI_FILTRO.find(x => x[0] === v)[1]}"></i><span>${nome[0].toUpperCase() + nome.slice(1)}</span><small>${q.toLocaleString("it")}</small></button>`;
        return `<button class="voce" data-fk="${g.k}" data-fv="${esc(v)}" aria-pressed="${su}"><span class="spunta" aria-hidden="true"></span><span${g.k === "marca" ? ' translate="no"' : ""}>${esc(nome)}</span><small>${q.toLocaleString("it")}</small></button>`;
      }).join("") || `<p class="niente-filtro">Nessuna scelta con gli altri filtri.</p>`;
      return `<section class="gruppo-filtri${aperto ? " aperto" : ""}">` +
        (solo ? "" : `<button class="testa-gruppo" data-g="${g.k}" aria-expanded="${aperto}"><span>${g.nome}</span><small>${esc(riassunto(g.k, bozza))}</small><i aria-hidden="true">${aperto ? "−" : "+"}</i></button>`) +
        (aperto ? `<div class="opzioni${g.k === "colore" ? " opzioni-colore" : ""}">${voci}</div>` : "") + `</section>`;
    };
    const corpo = primo === "ordina"
      ? `<div class="opzioni">${ORDINI.map(([v, nome]) => `<button class="voce tondo" data-ordina="${v}" aria-pressed="${bozza.ordina === v}"><span class="spunta" aria-hidden="true"></span><span>${nome}</span></button>`).join("")}</div>`
      : (solo ? gruppo(GRUPPI.find(g => g.k === primo)) : gruppiPer(posto).map(gruppo).join("") +
        `<section class="gruppo-filtri"><button class="testa-gruppo" data-saldi="1" aria-pressed="${bozza.saldi}"><span>Solo in saldo</span><small></small><i aria-hidden="true" class="interruttore${bozza.saldi ? " su" : ""}"></i></button></section>`);
    const nAttivi = solo && primo !== "ordina" ? bozza[primo].size : quantiFiltri(bozza);
    el.innerHTML = `<div class="foglio-testa lati"><h2>${titolo}</h2><button class="icona" data-chiudi aria-label="Chiudi">✕</button></div>
      <div class="foglio-corpo lati">${corpo}</div>
      <div class="piede-filtri lati">${primo === "ordina" ? "" : `<button class="vuoto" data-azzera ${nAttivi ? "" : "disabled"}>Azzera</button>`}<button class="pieno" data-mostra>${quanti ? `Mostra ${quanti.toLocaleString("it")} capi` : "Nessun capo"}</button></div>`;
  };
  disegnaP();
  el.hidden = false; requestAnimationFrame(() => el.classList.add("aperto"));
  const chiudi = applica => { if (applica) { Object.assign(st, bozza); fatto(); } el.classList.remove("aperto"); setTimeout(() => { el.hidden = true; }, 250); el.onclick = null; };
  el.onclick = ev => {
    const b = ev.target.closest("button"); if (!b) return;
    const y = el.querySelector(".foglio-corpo").scrollTop;
    if (b.hasAttribute("data-chiudi")) return chiudi(false);
    if (b.hasAttribute("data-mostra")) return chiudi(true);
    if (b.dataset.ordina) { bozza.ordina = b.dataset.ordina; return chiudi(true); }
    if (b.hasAttribute("data-azzera")) { if (solo) bozza[primo].clear(); else Object.assign(bozza, nuoviFiltri(), { ordina: bozza.ordina }); }
    else if (b.dataset.saldi) bozza.saldi = !bozza.saldi;
    else if (b.dataset.g) { aperti.has(b.dataset.g) ? aperti.delete(b.dataset.g) : aperti.add(b.dataset.g); }
    else if (b.dataset.fk) { const s = bozza[b.dataset.fk], v = b.dataset.fv; s.has(v) ? s.delete(v) : s.add(v); }
    else return;
    disegnaP(); el.querySelector(".foglio-corpo").scrollTop = y;
  };
}
/** Prezzo nelle carte: se è in saldo, il prezzo pieno barrato e lo sconto. */
const prezzoCarta = c => c.o ? `<span class="saldo">${prezzo(c)}</span> <s>${euro(c.o)}</s> <span class="saldo">−${Math.round(sconto(c) * 100)}%</span>` : prezzo(c);

// ======================================================================
// CAMBIA UN CAPO — alternative per un posto, già filtrate
// ======================================================================
const SOTTOFILTRI = {
  sopra: [["sopra", null, "Tutti"], ["sopra", "maglia", "Maglie"], ["sopra", "camicia", "Camicie"], ["sopra", "top", "Top e t-shirt"], ["abito", null, "Abiti", "d"]],
  sotto: [["sotto", null, "Tutti"], ["sotto", "pantaloni", "Pantaloni"], ["sotto", "jeans", "Jeans"], ["sotto", "gonna", "Gonne", "d"], ["abito", null, "Abiti", "d"]],
  abito: [["abito", null, "Abiti"], ["sopra", null, "Sopra"], ["sotto", null, "Sotto"]],
  capospalla: [["capospalla", null, "Tutti"]], scarpe: [["scarpe", null, "Tutte"]],
};
const finto = posto => ({ c: posto === "abito" ? "abito" : posto === "sopra" ? "top" : posto === "sotto" ? "pantaloni" : posto, e: 0, n: 0, h: "", v: null });
function apriCambia(postoIniziale) {
  const filtri = SOTTOFILTRI[postoIniziale].filter(f => !f[3] || f[3] === profilo.genere);
  let scelto = 0, lista = [], mostrati = 0, entro = 0;
  const filtri2 = nuoviFiltri();
  const corpo = apriFoglio(S.NOME_POSTO[postoIniziale], "");
  const carta = c => `<button class="carta" data-k="${esc(S.chiave(c))}"><img src="${foto(c)}" alt="" loading="lazy">
    <span class="marca">${esc(negozio(c).nome)}</span><b>${esc(c.t)}</b><small>${prezzoCarta(c)}</small>
    ${c.e > entro ? `<small class="male">+${euro(c.e - entro)} sul budget</small>` : ""}</button>`;
  const altri = () => {
    corpo.querySelector(".altri")?.remove();
    const lotto = lista.slice(mostrati, mostrati + 30); mostrati += lotto.length;
    corpo.querySelector(".griglia").insertAdjacentHTML("beforeend", lotto.map(carta).join("") + (mostrati < lista.length ? `<button class="vuoto altri">Altri</button>` : ""));
  };
  const base = () => {
    const [posto, cat] = filtri[scelto];
    return S.alternative(DATI.capi, ctx(), outfit, posto, entro).filter(c => !cat || c.c === cat).filter(c => !outfit[posto] || S.chiave(c) !== S.chiave(outfit[posto]));
  };
  const rifai = () => {
    const [posto, cat] = filtri[scelto];
    entro = profilo.budget - S.totale(S.metti(outfit, finto(posto)).outfit);     // il budget meno gli altri capi che restano
    adattaFiltri(filtri2, posto);
    lista = applicaFiltri(base(), filtri2);
    mostrati = 0;
    const dentro = lista.filter(c => c.e <= entro).length;
    corpo.innerHTML = (filtri.length > 1 ? `<div class="filtri">${filtri.map((f, i) => `<button class="piccolo" data-f="${i}" aria-pressed="${i === scelto}">${f[2]}</button>`).join("")}</div>` : "") +
      `<div class="filtri filtri-capo">${htmlFiltri(filtri2, posto)}</div>` +
      `<div class="conta">${entro > 0 ? `Fino a ${euro(entro)} · ${dentro.toLocaleString("it")} capi` : "Budget finito: questi vanno oltre"} · taglia ${S.tagliaPer(profilo, finto(posto))}</div><div class="griglia"></div>`;
    if (!lista.length) corpo.querySelector(".griglia").innerHTML = `<p class="niente">${quantiFiltri(filtri2) ? "Niente con questi filtri." : "Niente nella tua taglia, per ora."}</p>`; else altri();
    corpo.scrollTop = 0;
  };
  rifai();
  corpo.onclick = e => {
    const f = e.target.closest("[data-f]"); if (f) { scelto = +f.dataset.f; rifai(); return; }
    if (clicFiltri(e, filtri2, filtri[scelto][0], base, rifai)) return;
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
    const r = await fetch(`https://${neg.dominio}/products/${c.h}.js?country=IT`);   // stesso mercato del catalogo: prezzi per l'Italia
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
      // gli altri colori dello stesso capo, con o senza qualcosa di acquistabile nella mia taglia
      const colori = ic < 0 ? [] : [...new Set(p.variants.map(x => x.options[ic]))].map(nome => {
        const vv = p.variants.filter(x => x.options[ic] === nome);
        const nella = vv.some(x => x.available && (c.c === "scarpe" ? S.numeroScarpa(x.options[is], neg.sistema, c.g) === mia : (S.lettera(x.options[is], neg.sistema, c.c) || "").split("/").some(t => t === mia || t === "*")));
        return { nome, disponibile: vv.some(x => x.available), nella, foto: vv[0]?.featured_image?.src || null };
      });
      esito = { stato: !var_ ? "non-prodotta" : var_.available ? "ok" : "esaurita", variante: var_?.id, taglie: per, prezzoVivo: var_ ? var_.price / 100 : null, unica: !per.has(mia) && per.has("Unica"),
        descrizione: p.description || "", colori };
    }
  } catch { esito = { stato: "ignoto" }; }
  if (esito.stato === "sparito") esclusi.add(k);
  vive.set(k, { quando: Date.now(), esito });
  return esito;
}
const linkCapo = (c, e) => `https://${negozio(c).dominio}/products/${c.h}${e?.variante ? "?variant=" + e.variante : ""}`;
function fraseTaglia(c, e) {
  const mia = S.tagliaPer(profilo, c);
  return { ok: `<span class="bene">${e.unica ? "Taglia unica" : mia} disponibile</span>`, esaurita: `<span class="male">${mia} esaurita</span>`,
    "non-prodotta": `<span class="male">Non c'è in ${mia}</span>`, sparito: `<span class="male">Non più in vendita</span>`, ignoto: `Controlla la taglia sul sito` }[e.stato];
}
/** `sola` = solo da guardare (look ricevuto da un link). */
async function apriScheda(c, livello = 1, sola = false) {
  const neg = negozio(c), p = S.postoDi(c), dentro = !sola && outfit[p] && S.chiave(outfit[p]) === S.chiave(c);
  const d = S.distPalette(c, profilo.stagione);
  const colore = !c.k ? "" : `${c.x ? `<span class="tono" style="background:${c.x}"></span>` : ""}${esc(c.k)}` +
    (d === null ? "" : ` · <span class="${d < 18 ? "bene" : d >= 30 ? "male" : ""}">${d < 18 ? "nei tuoi colori" : d < 30 ? "vicino ai tuoi colori" : "fuori dai tuoi colori"}</span>`);
  const azioni = dentro ? `<div class="tre"><button class="piccolo" id="sc-cambia">Cambia</button><button class="piccolo" id="sc-blocca" aria-pressed="${bloccati.has(p)}">${bloccati.has(p) ? "Bloccato" : "Blocca"}</button><button class="piccolo" id="sc-togli">Togli</button></div>` : "";
  const corpo = apriFoglio(S.NOME_POSTO[p], `
    <div class="foto"><img src="${foto(c, 900)}" alt="${esc(c.t)}"></div>
    <div class="dettagli"><span class="marca">${esc(neg.nome)}</span><h3>${esc(c.t)}</h3><span class="riga" id="sc-prezzo">${prezzo(c)}</span>${colore ? `<span class="riga">${colore}</span>` : ""}
      ${neg.ue ? "" : `<span class="riga male">Spedito da fuori UE: possibili dazi alla consegna.</span>`}</div>
    <div class="vivo">${azioni}
      <div class="etichetta"><span>Taglie</span><span id="sc-ora"></span></div>
      <div class="taglie-vive" id="sc-taglie">…</div><div class="riga" id="sc-mia"></div>
      ${dentro || sola ? "" : `<button class="pieno" id="sc-metti">Indossa</button>`}
      <a class="vuoto" id="sc-sito" href="${linkCapo(c)}" target="_blank" rel="noopener">Vedi sul sito di ${esc(neg.nome)} ↗</a></div>
    <div class="campo" id="sc-colori-box" hidden><div class="etichetta"><span>Colori</span><span>nella tua taglia</span></div><div class="colori-capo" id="sc-colori"></div></div>
    <div class="campo" id="sc-descr-box" hidden><div class="etichetta"><span>Descrizione</span></div><div class="descrizione" id="sc-descr"></div></div>
    ${dettagliCapo(c)}`, livello);
  const chiudi = () => { chiudiFoglio(2); chiudiFoglio(1); };
  const q = id => corpo.querySelector(id);
  pizzico(q(".foto"), () => q(".foto img"));
  if (q("#sc-metti")) q("#sc-metti").onclick = () => { chiudi(); mostra("s-camerino"); indossa(c); };
  if (dentro) {
    q("#sc-cambia").onclick = () => apriCambia(p);
    q("#sc-blocca").onclick = () => { bloccati.has(p) ? bloccati.delete(p) : bloccati.add(p); ricorda(); disegnaPalco(); q("#sc-blocca").setAttribute("aria-pressed", bloccati.has(p)); q("#sc-blocca").textContent = bloccati.has(p) ? "Bloccato" : "Blocca"; if (bloccati.has(p)) toast("Resta quando chiedi un nuovo look"); };
    q("#sc-togli").onclick = () => { const prima = outfit; outfit = S.togli(outfit, p); bloccati.delete(p); ricorda(); disegna(); chiudi(); toast("Tolto", () => { outfit = prima; ricorda(); disegna(); }); };
  }
  const e = await verifica(c);
  if (!q("#sc-taglie")) return;
  const mia = S.tagliaPer(profilo, c), scala = c.c === "scarpe" ? S.NUMERI_SCARPE : S.TAGLIE;
  if (e.taglie) {
    const ordine = [...e.taglie.keys()].sort((a, b) => scala.indexOf(a) - scala.indexOf(b));
    q("#sc-taglie").innerHTML = ordine.map(t => `<span class="${e.taglie.get(t).available ? "si" : "no"}${t === mia ? " mia" : ""}">${t}</span>`).join("") || "Guarda le taglie sul sito.";
    q("#sc-ora").textContent = "ore " + new Date().toLocaleTimeString("it", { hour: "2-digit", minute: "2-digit" });
    if (e.prezzoVivo != null && Math.abs(e.prezzoVivo - c.p) > 0.5) q("#sc-prezzo").insertAdjacentHTML("beforeend", ` · <span class="male">ora ${Math.round(e.prezzoVivo)} sul sito</span>`);
  } else q("#sc-taglie").textContent = "";
  q("#sc-mia").innerHTML = mia || e.stato === "sparito" ? fraseTaglia(c, e) : "";
  q("#sc-sito").href = linkCapo(c, mia ? e : null);
  if (e.stato === "sparito") { q("#sc-metti")?.remove(); q("#sc-sito").remove(); }
  // descrizione del negozio (testo semplice, niente HTML esterno nella pagina)
  const testoDescr = descrizioneTesto(e.descrizione);
  if (testoDescr) {
    q("#sc-descr-box").hidden = false;
    const corta = testoDescr.length > 320 ? testoDescr.slice(0, 300).replace(/\s+\S*$/, "") + "…" : null;
    q("#sc-descr").innerHTML = `<p>${esc(corta || testoDescr)}</p>${corta ? `<button class="testo-link" id="sc-tutto">Leggi tutto</button>` : ""}`;
    if (corta) q("#sc-tutto").onclick = () => { q("#sc-descr").innerHTML = `<p>${esc(testoDescr)}</p>`; };
  }
  // gli altri colori: quelli che abbiamo nel catalogo si aprono qui, gli altri si vedono sul sito
  if (e.colori && e.colori.length > 1) {
    q("#sc-colori-box").hidden = false;
    q("#sc-colori").innerHTML = e.colori.map(x => {
      const altro = INDICE.get(`${c.z}|${c.h}|${x.nome}`), questo = x.nome === c.v;
      const cl = `${questo ? "questo" : ""} ${x.nella ? "si" : "no"}`;
      return altro && !questo ? `<button class="${cl}" data-k="${esc(S.chiave(altro))}">${altro.x ? `<i style="background:${altro.x}"></i>` : ""}${esc(x.nome)}</button>`
        : `<span class="${cl}">${questo && c.x ? `<i style="background:${c.x}"></i>` : ""}${esc(x.nome)}</span>`;
    }).join("");
    q("#sc-colori").onclick = ev => { const b = ev.target.closest("button[data-k]"); if (b) apriScheda(INDICE.get(b.dataset.k), livello, sola); };
  }
}
/** La descrizione del negozio in testo semplice: si legge come testo, nessun HTML del negozio entra nella pagina. */
function descrizioneTesto(html) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html.replace(/<(br|\/p|\/li|\/div|\/h\d)[^>]*>/gi, "$&\n"), "text/html");
  return (doc.body.textContent || "").split("\n").map(r => r.replace(/\s+/g, " ").trim()).filter(Boolean).join(" · ").slice(0, 2000);
}
/** Materiale, lunghezza e maniche come li dice il negozio (dal catalogo). */
function dettagliCapo(c) {
  const voci = [c.f && ["Materiale", NOMI_FILTRI.f[c.f]], c.l && ["Lunghezza", NOMI_FILTRI.l[c.l === "media" ? "normale" : c.l]], c.w && ["Maniche", NOMI_FILTRI.w[c.w]],
    c.m && ["Fantasia", NOMI_FILTRI.m[c.m]], c.a && ["Vestibilità", NOMI_FILTRI.a[c.a]], c.z && ["Scollo", NOMI_FILTRI.z[c.z]]].filter(Boolean);
  return voci.length ? `<div class="campo"><div class="voci">${voci.map(([a, b]) => `<span><small>${a}</small>${b}</span>`).join("")}</div></div>` : "";
}

// ======================================================================
// COMPRA — un capo per negozio, taglia controllata adesso
// ======================================================================
async function apriCompra() {
  const capi = S.capiDi(outfit);
  const corpo = apriFoglio("Compra", capi.map((c, i) => `<div class="acquisto"><img src="${foto(c, 140)}" alt="">
      <div><span class="marca" style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3)">${esc(negozio(c).nome)}</span><br><b style="font-size:13px">${esc(c.t)}</b><br>
        <span style="font-size:12px;color:var(--ink-2)">${prezzo(c)}</span>
        <div class="stato" id="st-${i}">…</div>
        ${negozio(c).ue ? "" : `<div class="stato male">Da fuori UE: possibili dazi alla consegna.</div>`}
        <a class="pieno" id="go-${i}" href="${linkCapo(c)}" target="_blank" rel="noopener">Compra su ${esc(negozio(c).dominio.replace(/^www\./, ""))} ↗</a></div></div>`).join("") +
    `<div class="totale"><span>Totale</span><span>${euro(S.totale(outfit))}</span></div>
     <p class="note">Ogni capo si compra sul sito del suo marchio, con la taglia già scelta. Spedizione e resi sono i loro.</p>`);
  capi.forEach(async (c, i) => {
    const e = await verifica(c), st = corpo.querySelector(`#st-${i}`); if (!st) return;
    st.innerHTML = fraseTaglia(c, e);
    const a = corpo.querySelector(`#go-${i}`);
    if (e.stato === "ok" || e.stato === "ignoto") a.href = linkCapo(c, e);
    else { a.className = "vuoto"; a.removeAttribute("href"); a.removeAttribute("target"); a.textContent = "Cambia"; a.style.cursor = "pointer"; a.onclick = () => apriCambia(S.postoDi(c)); }
  });
}

// ======================================================================
// SCOPRI — sfogliare i capi per reparto, o cercarne uno preciso
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
// ricerca in inglese: le parole si riportano all'italiano prima di capirle
const DA_INGLESE = [["shoes?", "scarpe"], ["sneakers?|trainers?", "sneakers"], ["boots?|booties", "stivali"], ["sandals?", "sandali"], ["loafers?", "mocassini"], ["heels|pumps", "tacchi"],
  ["coats?", "cappotto"], ["jackets?", "giacca"], ["puffer|down jacket", "piumino"], ["sweaters?|jumpers?|knit(wear)?|pullovers?", "maglione"], ["cardigans?", "cardigan"], ["hoodies?|sweatshirts?", "felpa"],
  ["shirts?|blouses?", "camicia"], ["t-?shirts?|tees?|tank tops?|tops?", "top"], ["dress(es)?", "vestito"], ["skirts?", "gonna"], ["trousers|pants|shorts|leggings", "pantaloni"],
  ["black", "nero"], ["white", "bianco"], ["cream|off-?white|ivory", "panna"], ["beige", "beige"], ["camel", "cammello"], ["brown", "marrone"], ["gr[ae]y", "grigio"], ["navy", "navy"],
  ["light blue", "azzurro"], ["blue", "blu"], ["green", "verde"], ["olive", "oliva"], ["red", "rosso"], ["burgundy", "bordeaux"], ["pink", "rosa"], ["orange", "arancione"], ["yellow", "giallo"],
  ["mustard", "senape"], ["purple", "viola"], ["lilac", "lilla"], ["wool", "lana"], ["silk", "seta"], ["linen", "lino"], ["leather", "pelle"], ["cotton", "cotone"], ["velvet", "velluto"], ["lace", "pizzo"],
  ["long", "lungo"], ["short|mini|cropped", "corto"], ["under|below|less than|up to|max(imum)?", "sotto"]];
const inglese = t => LINGUA === "en" ? DA_INGLESE.reduce((x, [en, it]) => x.replace(new RegExp(`\\b(${en})\\b`, "g"), it), t) : t;
function capisci(testo) {
  const t = inglese(piano(testo)), q = { cat: null, hex: null, max: null, negozio: -1, parole: [] };
  for (const [c, rx] of PAROLE_CAT) if (rx.test(t)) { q.cat = c; break; }
  for (const [w, hex] of Object.entries(PAROLE_COLORE)) if (new RegExp(`\\b${w}\\b`).test(t)) { q.colore = w; q.hex = hex; break; }
  const m = t.match(/(?:sotto|entro|max|massimo|meno di|fino a)\s*(?:i\s*|€\s*)?(\d{2,4})/) || t.match(/(\d{2,4})\s*(?:€|euro)/);
  if (m) q.max = +m[1];
  q.parole = Object.keys(TRADUCI).filter(w => new RegExp(`\\b${w.slice(0, -1)}`).test(t));
  const VUOTE = ["the", "shop", "brand", "paris", "studio", "und", "set", "with", "good", "house", "home", "of"];
  q.negozio = DATI.negozi.findIndex(n => piano(n.nome).split(/[^a-z']+/).some(w => w.length > 2 && !VUOTE.includes(w) && new RegExp(`\\b${w}\\b`).test(t)));
  return q;
}
const REPARTI = [["capospalla", "Giacche e cappotti"], ["sopra", "Sopra"], ["sotto", "Sotto"], ["abito", "Abiti", "d"], ["scarpe", "Scarpe"]];
let reparto = "sopra", listaScopri = [], mostratiScopri = 0, soloTaglia = true;
const filtriScopri = nuoviFiltri();
/** I capi del reparto senza i filtri (per contarli nel pannello). Con una ricerca scritta: i risultati della ricerca. */
function baseScopri() {
  const testo = $("c-q").value.trim();
  if (testo) return ricercaScopri;
  const vaBene = c => !esclusi.has(S.chiave(c)) && !(profilo.genere === "u" && (c.c === "abito" || c.c === "gonna"));
  return soloTaglia ? S.alternative(DATI.capi, ctx(), outfit, reparto, Infinity) : DATI.capi.filter(c => S.postoDi(c) === reparto && vaBene(c));
}
let ricercaScopri = [];
function scopri() {
  const reparti = REPARTI.filter(r => !r[2] || r[2] === profilo.genere), testo = $("c-q").value.trim();
  $("c-filtri").innerHTML = (testo ? "" : reparti.map(r => `<button class="piccolo" data-r="${r[0]}" aria-pressed="${r[0] === reparto}">${r[1]}</button>`).join("")) +
    `<button class="piccolo" data-t="1" aria-pressed="${soloTaglia}">La mia taglia</button>` + htmlFiltri(filtriScopri, testo ? "abito" : reparto);
  const vaBene = c => !esclusi.has(S.chiave(c)) && (!soloTaglia || S.haTaglia(c, profilo)) && !(profilo.genere === "u" && (c.c === "abito" || c.c === "gonna"));
  if (testo) {
    const q = capisci(testo), ql = q.hex ? S.lab(q.hex) : null;
    const capito = [q.cat, q.colore, ...q.parole.filter(w => w !== q.cat), q.negozio >= 0 ? DATI.negozi[q.negozio].nome : null, q.max ? `fino a ${euro(q.max)}` : null].filter(Boolean);
    ricercaScopri = !capito.length ? [] : DATI.capi.filter(c => vaBene(c) && (!q.cat || c.c === q.cat) && (q.negozio < 0 || c.n === q.negozio) && (!q.max || c.e <= q.max)
      && (!ql || (c.x && Math.hypot(...S.lab(c.x).map((v, i) => v - ql[i])) < 16)) && q.parole.every(w => TRADUCI[w].test(c.t.toLowerCase())))
      .sort((a, b) => (S.distPalette(a, profilo.stagione) ?? 50) - (S.distPalette(b, profilo.stagione) ?? 50));
    listaScopri = applicaFiltri(ricercaScopri, filtriScopri);
    $("c-conta").textContent = capito.length ? `${capito.join(" · ")} — ${listaScopri.length.toLocaleString("it")} capi` : "Prova con un capo, un colore, un prezzo o un marchio.";
  } else {
    // senza ricerca: i capi del reparto; con "la mia taglia", prima quelli che stanno bene col look di adesso
    listaScopri = applicaFiltri(baseScopri(), filtriScopri);
    $("c-conta").textContent = `${listaScopri.length.toLocaleString("it")} capi${soloTaglia ? " nella tua taglia" : ""}`;
  }
  mostratiScopri = 0; $("c-griglia").innerHTML = ""; $("c-griglia").parentElement.scrollTop = 0;
  if (!listaScopri.length) $("c-griglia").innerHTML = `<p class="niente">Niente${soloTaglia ? " nella tua taglia" : ""}.</p>`; else altriScopri();
}
function altriScopri() {
  $("c-griglia").querySelector(".altri")?.remove();
  const l = listaScopri.slice(mostratiScopri, mostratiScopri + 30); mostratiScopri += l.length;
  $("c-griglia").insertAdjacentHTML("beforeend", l.map(c => `<button class="carta" data-k="${esc(S.chiave(c))}"><img src="${foto(c)}" alt="" loading="lazy"><span class="marca">${esc(negozio(c).nome)}</span><b>${esc(c.t)}</b><small>${prezzoCarta(c)}</small></button>`).join("") + (mostratiScopri < listaScopri.length ? `<button class="vuoto altri">Altri</button>` : ""));
}
$("c-form").onsubmit = e => { e.preventDefault(); $("c-q").blur(); scopri(); };
$("c-q").addEventListener("search", () => { if (!$("c-q").value) scopri(); });
$("c-filtri").onclick = e => {
  if (clicFiltri(e, filtriScopri, $("c-q").value.trim() ? "abito" : reparto, baseScopri, scopri)) return;
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.r) { reparto = b.dataset.r; adattaFiltri(filtriScopri, reparto); } else if (b.dataset.t) soloTaglia = !soloTaglia; else return;
  scopri();
};
$("c-griglia").onclick = e => { if (e.target.closest(".altri")) return altriScopri(); const b = e.target.closest(".carta"); if (b) apriScheda(INDICE.get(b.dataset.k)); };

// ======================================================================
// IL TUO AVATAR — modelli pronti, dalla tua foto, personaggio inventato
// ======================================================================
const MODELLI = { d: [["avatar_front", "Base"], ["avatar_mod_d1", "Modello 1"], ["avatar_mod_d2", "Modello 2"], ["avatar_mod_d3", "Modello 3"]],
  u: [["avatar_uomo_front", "Base"], ["avatar_mod_u1", "Modello 1"], ["avatar_mod_u2", "Modello 2"], ["avatar_mod_u3", "Modello 3"]] };
const OPZ = {
  tipo: [["umano", "Umano"], ["alieno", "Alieno"], ["animale", "Animale"], ["robot", "Robot"], ["elfo", "Elfo"]],
  animale: [["gatto", "Gatto"], ["volpe", "Volpe"], ["orso", "Orso"], ["coniglio", "Coniglio"], ["lupo", "Lupo"], ["panda", "Panda"], ["leone", "Leone"], ["cane", "Cane"]],
  corpo: [["esile", "Esile"], ["media", "Media"], ["robusta", "Robusta"], ["morbida", "Morbida"]],
  capelli: [["corti", "Corti"], ["lunghi", "Lunghi"], ["ricci", "Ricci"], ["raccolti", "Raccolti"], ["rasati", "Rasati"], ["nessuno", "Nessuno"]],
  tinta: [["nero", "Neri"], ["castano", "Castani"], ["biondo", "Biondi"], ["rosso", "Rossi"], ["grigio", "Grigi"], ["pastello", "Rosa"]],
  stile: [["realistico", "Realistico"], ["cartone", "Cartone"], ["fumetto", "Fumetto"]],
};
const TINTE = { c1: "#f6e1d3", c2: "#eac4a8", c3: "#d5a77d", c4: "#b98457", c5: "#8a5a3b", c6: "#5a3824", verde: "#9be3c4", azzurro: "#a9d3f5", viola: "#c3a6e8",
  rosa: "#f4b6cf", argento: "#c8ccd2", oro: "#d9b44a", nero: "#222222", bianco: "#f5f5f5" };
const coloriPer = tipo => tipo === "umano" || tipo === "elfo" ? ["c1", "c2", "c3", "c4", "c5", "c6"] : tipo === "animale" ? ["c2", "c4", "c5", "c6", "bianco", "nero", "argento"]
  : tipo === "robot" ? ["argento", "oro", "nero", "bianco", "azzurro", "rosa"] : ["verde", "azzurro", "viola", "rosa", "argento", "oro"];
// "Su di te" per l'avatar dalla foto (come Alta): ciò che la foto può nascondere. Restano nel profilo per la volta dopo.
const SU = {
  capelli: [["cortissimi", "Cortissimi"], ["corti", "Corti"], ["medi", "Medi"], ["lunghi", "Lunghi"], ["raccolti", "Raccolti"], ["rasati", "Rasati"]],
  tinta: [["nero", "Neri"], ["castano_scuro", "Castano scuro"], ["castano", "Castani"], ["biondo_scuro", "Biondo scuro"], ["biondo", "Biondi"], ["platino", "Platino"], ["rosso", "Rossi"], ["grigio", "Grigi"], ["bianco", "Bianchi"]],
  ricci: [["lisci", "Lisci"], ["mossi", "Mossi"], ["ricci", "Ricci"], ["afro", "Afro"]],
  corpo: [["esile", "Esile"], ["media", "Media"], ["atletica", "Atletica"], ["robusta", "Robusta"], ["morbida", "Morbida"]],
};
const NOMI_SU = { capelli: "Capelli", tinta: "Colore capelli", ricci: "Tipo di capelli", corpo: "Corporatura" };
const RITOCCHI = [["capelli-corti", "Capelli più corti"], ["capelli-lunghi", "Capelli più lunghi"], ["piu-snella", "Fisico più snello"], ["piu-robusta", "Fisico più robusto"], ["piu-alta", "Statura più alta"], ["piu-bassa", "Statura più bassa"]];
let fotoViso = null, fotoIntera = null, appenaCreato = null;
let scelte = { tipo: "umano", animale: "gatto", corpo: "media", colore: "c3", capelli: "corti", tinta: "castano", stile: "realistico" }, schedaAvatar = "modelli", creando = false;

function usaAvatar(a) {
  profilo.avatar = a;
  if (a && a.creato && !profilo.avatari.some(x => x.url === a.url)) profilo.avatari = [a, ...profilo.avatari].slice(0, 8);
  vistaAvatar = 0; vistaGiro = 0; vestito = true; ricorda(); if (!$("s-camerino").hidden) disegna();
}
async function chiediAvatar(corpo) {
  const r = await fetch(SERVER + "/avatar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lingua: LINGUA, genere: profilo.genere, ...corpo }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.url) throw new Error(d.messaggio || "Non ci sono riuscito. Riprova.");
  await new Promise((ok, ko) => { const im = new Image(); im.onload = ok; im.onerror = ko; im.src = d.url; });
  return d.url;
}
/** Foto ridotta a 1024 px in JPEG: meno da inviare, stessa resa. */
async function riduci(file) {
  const im = new Image(); im.src = URL.createObjectURL(file); await im.decode();
  const s = Math.min(1, 1024 / Math.max(im.naturalWidth, im.naturalHeight)), cv = document.createElement("canvas");
  cv.width = Math.round(im.naturalWidth * s); cv.height = Math.round(im.naturalHeight * s);
  cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(im.src);
  return cv.toDataURL("image/jpeg", 0.86);
}
function apriAvatar() {
  const corpo = apriFoglio("Il tuo avatar", "");
  appenaCreato = null;
  const g = profilo.genere, attuale = profilo.avatar?.genere === g ? profilo.avatar.url : null;
  const carta = (url, nome, sel) => `<button class="carta" data-url="${esc(url)}" data-nome="${esc(nome)}"><img src="${esc(url)}" alt="${esc(nome)}" style="${sel ? "outline:2px solid var(--ink);outline-offset:2px" : ""}"><small>${esc(nome)}</small></button>`;
  const gruppo = (k, voci) => `<div class="campo"><div class="etichetta"><span>${{ tipo: "Chi", animale: "Animale", corpo: "Corporatura", capelli: "Capelli", tinta: "Colore capelli", stile: "Stile" }[k]}</span></div>
    <div class="scelte" data-k="${k}">${voci.map(([v, n]) => `<button data-v="${v}" aria-pressed="${scelte[k] === v}">${n}</button>`).join("")}</div></div>`;
  const disegnaScheda = () => {
    const schede = `<div class="filtri">${[["modelli", "Modelli"], ["foto", "Dalla tua foto"], ["personaggio", "Personaggio"]].map(([k, n]) => `<button class="piccolo" data-s="${k}" aria-pressed="${schedaAvatar === k}">${n}</button>`).join("")}</div>`;
    let html = "";
    if (schedaAvatar === "modelli") {
      const miei = profilo.avatari.filter(a => a.genere === g);
      const base = (f, n) => `<button class="carta" data-url="" data-nome="${n}"><img src="../img/${f}.jpg" alt="${n}" style="${!attuale ? "outline:2px solid var(--ink);outline-offset:2px" : ""}"><small>${n}</small></button>`;
      html = `<div class="griglia">${MODELLI[g].map(([f, n]) => n === "Base" ? base(f, n) : carta(BASE_AVATAR + f + ".jpg", n, attuale === BASE_AVATAR + f + ".jpg")).join("")}</div>` +
        (miei.length ? `<div class="etichetta" style="margin:18px 0 8px"><span>Creati da te</span></div><div class="griglia">${miei.map(a => carta(a.url, a.nome, attuale === a.url)).join("")}</div>` : "");
    }
    if (schedaAvatar === "foto") {
      const su = profilo.su || (profilo.su = {});
      const riga = k => `<div class="campo"><div class="etichetta"><span>${NOMI_SU[k]}</span>${k === "capelli" ? "" : "<small>se vuoi</small>"}</div>
        <div class="scelte" data-su="${k}">${SU[k].map(([v, n]) => `<button data-v="${v}" aria-pressed="${su[k] === v}">${n}</button>`).join("")}</div></div>`;
      const anteprima = (f, nome, id) => `<label class="foto-scelta${f ? " piena" : ""}">${f ? `<img src="${f}" alt="">` : `<span>+</span>`}<small>${nome}</small><input type="file" id="${id}" accept="image/*" hidden ${creando ? "disabled" : ""}></label>`;
      const pronto = fotoViso && su.capelli;
      html = (appenaCreato ? `<div class="appena"><img src="${esc(appenaCreato)}" alt="Il tuo avatar"><div>
          <p style="margin:0 0 8px">Ti somiglia? Se no, correggi una cosa alla volta:</p>
          <div class="scelte" id="av-ritocchi">${RITOCCHI.map(([k, n]) => `<button data-r="${k}" ${creando ? "disabled" : ""}>${n}</button>`).join("")}</div>
          ${creando ? `<p class="note">Lo sto correggendo…</p>` : ""}</div></div>` : "") +
        `<div class="dettagli" style="gap:10px;font-size:14px">
        <p style="margin:0">Una foto del viso, di fronte e con buona luce. Se vuoi, anche una foto in piedi a figura intera: l'avatar ti somiglierà di più.</p>
        <div class="foto-due">${anteprima(fotoViso, "Viso", "av-viso")}${anteprima(fotoIntera, "Figura intera · se vuoi", "av-intera")}</div></div>
        <div class="etichetta" style="margin:16px 0 4px"><span>Su di te</span></div>
        <p class="note" style="margin:0 0 6px">Conta più della foto: se in foto hai i capelli raccolti o la luce inganna, qui dici come sei.</p>
        ${riga("capelli")}${riga("tinta")}${riga("ricci")}${riga("corpo")}
        <div class="campo"><div class="etichetta"><span>Altezza</span><small>se vuoi</small></div><input type="number" id="av-altezza" inputmode="numeric" min="130" max="215" placeholder="cm" value="${su.altezza || ""}" style="width:110px"></div>
        <p class="note" style="margin:4px 0 10px">Uso anche le taglie del tuo profilo (${esc(profilo.tagliaSopra || "–")} sopra, ${esc(profilo.tagliaSotto || "–")} sotto) per le proporzioni.</p>
        <button class="pieno" id="av-da-foto" ${pronto && !creando ? "" : "disabled"}>${creando ? "Lo sto creando…" : !fotoViso ? "Scegli la foto del viso" : !su.capelli ? "Scegli i capelli" : "Crea il mio avatar"}</button>
        <p class="note" style="margin:8px 0 0">Le foto servono solo a creare l'avatar e non vengono conservate.</p><div id="av-esito"></div>`;
    }
    if (schedaAvatar === "personaggio") {
      const t = scelte.tipo, colori = coloriPer(t);
      if (!colori.includes(scelte.colore)) scelte.colore = colori[0];
      html = gruppo("tipo", OPZ.tipo) + (t === "animale" ? gruppo("animale", OPZ.animale) : "") +
        `<div class="campo"><div class="etichetta"><span>${t === "animale" ? "Pelo" : t === "robot" ? "Colore" : "Carnagione"}</span></div><div class="scelte" data-k="colore">${colori.map(c => `<button data-v="${c}" aria-pressed="${scelte.colore === c}" aria-label="${c}" style="width:40px;background:${TINTE[c]};${scelte.colore === c ? "box-shadow:inset 0 0 0 2px var(--carta);border:2px solid var(--ink)" : ""}"></button>`).join("")}</div></div>` +
        gruppo("corpo", OPZ.corpo) + (t === "animale" || t === "robot" ? "" : gruppo("capelli", OPZ.capelli) + (["rasati", "nessuno"].includes(scelte.capelli) ? "" : gruppo("tinta", OPZ.tinta))) +
        gruppo("stile", OPZ.stile) + `<div class="campo"><button class="pieno" id="av-crea" ${creando ? "disabled" : ""}>${creando ? "Lo sto creando…" : "Crea"}</button><div id="av-esito"></div></div>`;
    }
    corpo.innerHTML = schede + html;
    for (const [id, metti] of [["#av-viso", f => { fotoViso = f; }], ["#av-intera", f => { fotoIntera = f; }]]) {
      const inp = corpo.querySelector(id);
      if (inp) inp.onchange = async e => { const file = e.target.files[0]; if (!file) return; metti(await riduci(file)); disegnaScheda(); };
    }
    const alt = corpo.querySelector("#av-altezza");
    if (alt) alt.onchange = () => { const v = Math.round(+alt.value); profilo.su.altezza = v >= 130 && v <= 215 ? v : undefined; ricorda(); };
  };
  /** Crea (o corregge) l'avatar dalla foto e lo indossa subito; il ritocco sostituisce quello appena fatto. */
  const daFoto = async (richiesta, sostituisce) => {
    creando = true; disegnaScheda();
    try {
      const url = await chiediAvatar(richiesta);
      if (sostituisce) profilo.avatari = profilo.avatari.filter(a => a.url !== sostituisce);
      usaAvatar({ url, genere: g, nome: "Dalla foto", creato: true }); appenaCreato = url;
      creando = false; disegnaScheda(); corpo.scrollTop = 0; toast("Avatar pronto");
    } catch (err) { creando = false; disegnaScheda(); corpo.querySelector("#av-esito").innerHTML = `<p class="male" style="margin:8px 0 0">${esc(err.message)}</p>`; }
  };
  disegnaScheda();
  corpo.onclick = async e => {
    const s = e.target.closest("[data-s]"); if (s) { schedaAvatar = s.dataset.s; return disegnaScheda(); }
    const o = e.target.closest("[data-k] button"); if (o) { scelte[o.parentElement.dataset.k] = o.dataset.v; return disegnaScheda(); }
    const su = e.target.closest("[data-su] button");
    if (su) { const k = su.parentElement.dataset.su; profilo.su[k] = profilo.su[k] === su.dataset.v && k !== "capelli" ? undefined : su.dataset.v; ricorda(); return disegnaScheda(); }
    if (e.target.closest("#av-da-foto") && !creando && fotoViso && profilo.su?.capelli) {
      const { altezza, ...resto } = profilo.su;
      return daFoto({ modo: "foto", foto: fotoViso, ...(fotoIntera ? { foto2: fotoIntera } : {}), su: { ...resto, ...(altezza ? { altezza } : {}), taglia: profilo.tagliaSopra } });
    }
    const r = e.target.closest("[data-r]");
    if (r && appenaCreato && !creando) return daFoto({ modo: "ritocco", immagine: appenaCreato, ritocco: r.dataset.r }, appenaCreato);
    const c = e.target.closest(".carta");
    if (c) { usaAvatar(c.dataset.url ? { url: c.dataset.url, genere: g, nome: c.dataset.nome, creato: !c.dataset.url.startsWith(BASE_AVATAR) } : null); chiudiFoglio(); return; }
    if (e.target.closest("#av-crea") && !creando) {
      creando = true; disegnaScheda();
      const nome = scelte.tipo === "animale" ? OPZ.animale.find(x => x[0] === scelte.animale)[1] : OPZ.tipo.find(x => x[0] === scelte.tipo)[1];
      try { const url = await chiediAvatar({ modo: "personaggio", scelte }); usaAvatar({ url, genere: g, nome, creato: true }); creando = false; schedaAvatar = "modelli"; disegnaScheda(); toast("Avatar pronto"); }
      catch (err) { creando = false; disegnaScheda(); corpo.querySelector("#av-esito").innerHTML = `<p class="male" style="margin:8px 0 0">${esc(err.message)}</p>`; }
    }
  };
}

// ======================================================================
// STYLIST — si scrive cosa si cerca; l'AI capisce la richiesta, i capi li sceglie l'app dal catalogo vero
// ======================================================================
const chat = [];                 // [{ chi: "io"|"stylist", testo, capi? }]
let ultimaRichiesta = null, pensando = false;
const RX_SCARPE = { stivali: /boot|botte|bottine|stival/i, sneakers: /sneaker|trainer|basket/i, tacchi: /heel|pump|escarpin|d[ée]collet|tacc/i,
  sandali: /sandal/i, mocassini: /loafer|mocassin|moccasin/i, ballerine: /ballet|ballerin|\bflats?\b/i };
const RX_GIACCA = { cappotto: /coat|manteau|cappott|abrigo/i, giacca: /jacket|veste|giacc|chaqueta/i, blazer: /blazer/i, piumino: /puffer|padded|down\b|piumin|doudoune/i, trench: /trench/i };
/** Il capo rispetta quello che lo stylist ha capito per il suo posto? */
function vaPerRichiesta(c, r) {
  const p = S.postoDi(c);
  const pz = p === "abito" ? r.abito_dettagli : p === "capospalla" ? r.giacca_dettagli : r[p];
  if (r.abito === true && (p === "sopra" || p === "sotto")) return false;
  if (r.abito === false && p === "abito") return false;
  if (r.stili?.length && p !== "scarpe" && !r.stili.includes(DATI.negozi[c.n].stile)) return false;   // lo stile chiesto conta davvero (se manca, il posto si allarga)
  if (r.elegante && p !== "scarpe" && /\b(t-?shirt|tee|hoodie|sweatshirt|sudadera|jogger|sweat ?pants?|track|legging|cargo|active|zip-?up|fleece|windbreaker|anorak|puffer|bomber|sport|felpa|chándal|sudadera|basico tinto)/i.test(c.t)) return false;
  if (!pz) return true;
  if (pz.tipo) {
    if (p === "scarpe" && !RX_SCARPE[pz.tipo]?.test(c.t)) return false;
    if (p === "capospalla" && !RX_GIACCA[pz.tipo]?.test(c.t)) return false;
    if ((p === "sopra" || p === "sotto") && c.c !== pz.tipo) return false;
  }
  if (pz.colori?.length && !pz.colori.some(n => { const x = COLORI_FILTRO.find(y => y[0] === n); return x && vicinoA(c, x[1]); })) return false;
  if (pz.materiale && c.f !== pz.materiale) return false;
  if (pz.lunghezza && !passaFiltri(c, { l: pz.lunghezza })) return false;
  if (pz.maniche && c.w !== pz.maniche) return false;
  return true;
}
/** Compone il look della richiesta. Un posto senza capi adatti nella taglia si allarga subito (prima di dividere il budget). */
function lookPerRichiesta(r) {
  const pezzo = x => x && (x.tipo || x.colori?.length || x.materiale || x.maniche || x.lunghezza);
  if (r.abito == null && (pezzo(r.sopra) || pezzo(r.sotto))) r = { ...r, abito: false };   // ha chiesto un sopra o un sotto: niente abito al loro posto
  if (r.abito == null && pezzo(r.abito_dettagli)) r = { ...r, abito: true };
  const tmp = { ...profilo, budget: r.budget || profilo.budget, stili: r.stili?.length ? r.stili : profilo.stili, conCapospalla: r.giacca ?? profilo.conCapospalla };
  const c2 = { profilo: tmp, negozi: DATI.negozi, esclusi };
  const larghi = { abito: r.abito, elegante: r.elegante };     // allargando si lasciano cadere stile e dettagli, non l'occasione
  const usabile = c => !esclusi.has(S.chiave(c)) && S.haTaglia(c, tmp) && !S.fuoriStagione(c, tmp.freddo);
  // per ogni posto si allarga per gradi finché ci sono almeno 3 capi nella taglia e nel budget: tutto → senza stile → solo il tipo di capo → solo l'occasione
  const soloTipo = x => x && { tipo: x.tipo };
  const gradi = [r, { ...r, stili: [] }, { ...r, stili: [], sopra: soloTipo(r.sopra), sotto: soloTipo(r.sotto), scarpe: soloTipo(r.scarpe), giacca_dettagli: soloTipo(r.giacca_dettagli), abito_dettagli: null }, larghi];
  const capi = [], allargati = [];
  for (const p of ["capospalla", "sopra", "sotto", "scarpe", "abito"]) {
    if ((r.abito === true && (p === "sopra" || p === "sotto")) || (r.abito === false && p === "abito")) continue;
    const delPosto = DATI.capi.filter(c => S.postoDi(c) === p);
    let g = 0, lista = [];
    for (; g < gradi.length; g++) { lista = delPosto.filter(c => vaPerRichiesta(c, gradi[g])); if (lista.filter(c => usabile(c) && c.e <= tmp.budget * 0.5).length >= 3) break; }
    capi.push(...lista);
    if (g > 0 && (p !== "abito" || r.abito) && (p !== "capospalla" || tmp.conCapospalla) && (p === "capospalla" ? r.giacca_dettagli : p === "abito" ? r.abito_dettagli : r[p])) allargati.push(p);
  }
  let o = S.componi(capi, c2, S.outfitVuoto(), new Set(), S.casuale(++seme));
  if (S.mancanti(o.outfit).length) {        // il budget non bastava coi capi richiesti: si completa coi più vicini
    const tutti = DATI.capi.filter(c => vaPerRichiesta(c, larghi));
    const posti = new Set(["capospalla", "sopra", "sotto", "scarpe", "abito"].filter(p => o.outfit[p]));
    const tenuti = S.componi(tutti, c2, o.outfit, posti, S.casuale(++seme));
    o = !S.mancanti(tenuti.outfit).length ? tenuti : S.componi([...capi, ...tutti], c2, S.outfitVuoto(), new Set(), S.casuale(++seme));   // se no si riparte da capo
    for (const p of S.POSTI) if (o.outfit[p] && !vaPerRichiesta(o.outfit[p], r) && !allargati.includes(p)) allargati.push(p);
  }
  return { ...o, budget: tmp.budget, allargati: allargati.filter(p => o.outfit[p]) };
}
function apriStylist() {
  const corpo = apriFoglio("Stylist", "");
  const disegnaChat = () => {
    const esempi = profilo.genere === "u" ? ["Un look da ufficio sotto 300 €", "Qualcosa per una cena, scarpe nere", "Weekend in montagna"] : ["Un look da ufficio sotto 300 €", "Una cena elegante, stivali neri", "Jeans e maglione di lana per il weekend"];
    corpo.innerHTML = `<div class="chat" id="chat">${chat.length ? chat.map((m, i) => `<div class="msg ${m.chi}"${m.chi === "io" ? ' translate="no"' : ""}><p>${esc(m.testo)}</p>${m.capi ? `<div class="strip">${m.capi.map(k => INDICE.get(k)).filter(Boolean).map(c => `<img src="${foto(c, 120)}" alt="${esc(c.t)}">`).join("")}</div><button class="piccolo" data-rimetti="${i}">Indossa questo look</button>` : ""}</div>`).join("")
      : `<p class="sotto" style="margin:0 0 10px">Scrivi cosa cerchi: l'occasione, i colori, un capo, il budget. Compongo il look con capi veri, nella tua taglia.</p><div class="esempi">${esempi.map(x => `<button class="piccolo" data-esempio>${esc(x)}</button>`).join("")}</div>`}
      ${pensando ? `<div class="msg stylist"><p class="attesa-testo">Sto pensando…</p></div>` : ""}</div>
      <form class="cerca chat-form" id="chat-form"><input id="chat-q" autocomplete="off" placeholder="Scrivi qui…" aria-label="Scrivi allo stylist" ${pensando ? "disabled" : ""}><button aria-label="Invia" ${pensando ? "disabled" : ""}>→</button></form>`;
    corpo.scrollTop = corpo.scrollHeight;
    corpo.querySelector("#chat-form").onsubmit = e => { e.preventDefault(); manda(corpo.querySelector("#chat-q").value); };
  };
  const manda = async testo => {
    testo = testo.trim(); if (!testo || pensando) return;
    chat.push({ chi: "io", testo }); pensando = true; disegnaChat();
    try {
      const r = await fetch(SERVER + "/chiedi", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ testo, genere: profilo.genere, budget: profilo.budget, lingua: LINGUA, storia: ultimaRichiesta }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.richiesta) throw new Error(d.messaggio || "Non ci sono riuscito. Riprova.");
      ultimaRichiesta = d.richiesta;
      const l = lookPerRichiesta(d.richiesta), capi = S.capiDi(l.outfit);
      let testoR = d.risposta || "Ecco il look.";
      if (!capi.length) testoR += " " + tr("Però con queste richieste non trovo capi nella tua taglia. Prova ad allargare un po'.");
      else {
        if (l.budget !== profilo.budget) { profilo.budget = l.budget; }
        const prima = outfit; outfit = l.outfit; manca = l.manca; bloccati.clear(); ricorda(); disegna();
        const en = LINGUA === "en", nomi = l.allargati.map(p => tr(S.NOME_POSTO[p]).toLowerCase()).join(en ? " and " : " e ");
        testoR += en ? ` (${capi.length} items, ${euro(S.totale(outfit))})` : ` (${capi.length} capi, ${euro(S.totale(outfit))})`;
        if (l.allargati.length) testoR += " " + (en ? `For the ${nomi} there wasn't exactly what you asked for: I picked the closest.` : `Per ${nomi} non c'era esattamente quello che chiedi: ho messo il più vicino.`);
        chat.push({ chi: "stylist", testo: testoR, capi: capi.map(S.chiave) });
        pensando = false; disegnaChat();
        return;
      }
      chat.push({ chi: "stylist", testo: testoR });
    } catch (e) { chat.push({ chi: "stylist", testo: e.message || "Non ci sono riuscito. Riprova." }); }
    pensando = false; disegnaChat();
  };
  disegnaChat();
  corpo.onclick = e => {
    const es = e.target.closest("[data-esempio]"); if (es) return manda(es.textContent);
    const ri = e.target.closest("[data-rimetti]");
    if (ri) {
      outfit = S.outfitVuoto();
      for (const k of chat[+ri.dataset.rimetti].capi) { const c = INDICE.get(k); if (c) outfit = S.metti(outfit, c).outfit; }
      bloccati.clear(); manca = []; ricorda(); chiudiFoglio(); mostra("s-camerino"); disegna();
    }
  };
}
$("chiedi").onclick = () => { if (DATI) apriStylist(); };

// ======================================================================
// COME FUNZIONA — la prima volta nel camerino, poi dall'account
// ======================================================================
const PASSI_GUIDA = [
  ["Il tuo camerino", "Al centro c'è il tuo avatar. A destra i capi del look: giacca, sopra, sotto, scarpe. Sono capi veri, in vendita adesso nella tua taglia."],
  ["Cambia un capo", "Tocca una casella a destra: vedi il capo, le taglie disponibili adesso, i colori e la descrizione. Da lì puoi cambiarlo, bloccarlo o toglierlo."],
  ["Chiedi allo stylist", "Scrivi cosa ti serve, per esempio \"un look da ufficio sotto 300 €\": lo stylist compone il look per te."],
  ["Prova il look", "Con il look completo tocca \"Prova il look\": in circa 15 secondi l'avatar lo indossa. Con le frecce in basso lo giri: di lato e da dietro. Con due dita lo ingrandisci, come una foto."],
  ["Il tuo avatar", "L'icona della figurina cambia l'avatar: un modello pronto, uno creato dalla tua foto o un personaggio inventato."],
  ["Compra", "\"Compra\" apre il sito di ogni marchio con la tua taglia già scelta. Il cuore salva il look, la freccia lo condivide."],
];
function apriGuida(i = 0) {
  const [titolo, testo] = PASSI_GUIDA[i];
  const corpo = apriFoglio("Come funziona", `<div class="guida"><small>${i + 1} / ${PASSI_GUIDA.length}</small><h3>${esc(titolo)}</h3><p>${esc(testo)}</p>
    <div class="tre" style="grid-template-columns:1fr 1fr">${i ? `<button class="vuoto" id="g-indietro">Indietro</button>` : `<button class="vuoto" id="g-salta">Salta</button>`}<button class="pieno" id="g-avanti">${i < PASSI_GUIDA.length - 1 ? "Avanti" : "Inizia"}</button></div></div>`);
  corpo.onclick = e => {
    if (e.target.closest("#g-avanti")) return i < PASSI_GUIDA.length - 1 ? apriGuida(i + 1) : chiudiFoglio();
    if (e.target.closest("#g-indietro")) return apriGuida(i - 1);
    if (e.target.closest("#g-salta")) return chiudiFoglio();
  };
}

// ======================================================================
// I CAPI SULL'AVATAR — detto com'è finché non è acceso
// ======================================================================
function apriInfoProva() {
  apriFoglio("I capi sull'avatar", `<div class="dettagli" style="gap:12px;font-size:14px">
    <p style="margin:0">Tra poco l'avatar indosserà il look che componi. Per ora porta i capi base, e il look lo vedi nelle caselle a destra.</p>
    <p style="margin:0">Potrai usare una tua foto, un modello che ti somiglia o un personaggio creato da te.</p>
    <p style="margin:0;color:var(--ink-2)">L'immagine mostra come stanno insieme i capi. Per la taglia valgono le guide del marchio.</p>
    <figure style="margin:6px 0 0"><img src="esempio-addosso.jpg" alt="Esempio: una modella con cappotto, maglione, pantaloni e sneakers" style="border:1px solid var(--riga)"><figcaption style="font-size:12px;color:var(--ink-3);margin-top:6px">Un esempio.</figcaption></figure></div>`);
}

// ======================================================================
// CONDIVIDI — un link che apre questo look; chi lo riceve lo guarda, lo compra o lo prova nel suo camerino
// ======================================================================
const b64 = { su: t => btoa(String.fromCharCode(...new TextEncoder().encode(t))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  giu: t => new TextDecoder().decode(Uint8Array.from(atob(t.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0))) };
async function condividi() {
  const capi = S.capiDi(outfit); if (!capi.length) return;
  const url = `${location.origin}${location.pathname}?o=${b64.su(JSON.stringify({ g: profilo.genere, c: capi.map(S.chiave) }))}`;
  const copia = async () => { try { await navigator.clipboard.writeText(url); toast("Link copiato"); } catch { toast("Da questo browser non riesco a condividere"); } };
  try { if (navigator.share) await navigator.share({ title: "Camerino", text: `Il mio look: ${capi.length} capi, ${euro(S.totale(outfit))}`, url }); else await copia(); }
  catch (e) { if (e.name !== "AbortError") await copia(); }
}
function leggiCondiviso() {
  try { const o = JSON.parse(b64.giu(new URLSearchParams(location.search).get("o"))); return ["d", "u"].includes(o.g) && Array.isArray(o.c) && o.c.length <= 6 ? o : null; } catch { return null; }
}
/** La tavola dei capi (foto dei negozi nell'ordine del corpo), per il look ricevuto. */
function tavola(o) {
  const tess = (p, primo) => `<button class="tessera ${p}" data-apri="${p}" aria-label="${S.NOME_POSTO[p]}: ${esc(o[p].t)}"><img src="${foto(o[p], primo ? 500 : 360)}" alt=""><span>${S.NOME_POSTO[p]}</span></button>`;
  const [primo, ...resto] = ["capospalla", "abito", "sopra", "sotto", "scarpe"].filter(p => o[p]);
  return `<div class="tavola"${resto.length ? "" : ` style="grid-template-columns:1fr"`}>${tess(primo, true)}${resto.length ? `<div class="destra" style="grid-template-rows:${resto.map(p => p === "scarpe" && resto.length > 1 ? ".6fr" : "1fr").join(" ")}">${resto.map(p => tess(p)).join("")}</div>` : ""}</div>`;
}
async function apriCondiviso(link) {
  mostra("s-condiviso");
  const dice = t => { $("cond-palco").innerHTML = `<div class="solo-testo">${t}</div>`; };
  dice("Un attimo…");
  if (!await carica(link.g)) return dice("Non riesco a caricare il look. Controlla la connessione e riapri il link.");
  let o = S.outfitVuoto();
  const trovati = link.c.map(k => INDICE.get(k)).filter(Boolean);
  for (const c of trovati) o = S.metti(o, c).outfit;
  const proprio = () => { history.replaceState(null, "", location.pathname); if (profilo.pronto && profilo.genere) entra(); else apriProfilo(); };
  if (!trovati.length) {
    dice("Questi capi non sono più in vendita.");
    $("cond-posti").innerHTML = ""; $("cond-totale").innerHTML = ""; $("cond-nota").textContent = "";
    $("cond-prova").textContent = "Apri il camerino"; $("cond-prova").onclick = proprio; return;
  }
  $("cond-palco").innerHTML = tavola(o);
  $("cond-posti").innerHTML = S.capiDi(o).map(c => `<div class="posto"><button class="mini" data-k="${esc(S.chiave(c))}"><img src="${foto(c, 120)}" alt=""></button>
    <button class="chi" data-k="${esc(S.chiave(c))}"><div class="nome-posto">${esc(negozio(c).nome)}</div><div class="titolo">${esc(c.t)}</div><div class="riga2">${c.x ? `<span class="tono" style="background:${c.x}"></span>` : ""}${prezzo(c)}</div></button>
    <a class="piccolo" style="display:grid;place-items:center;text-decoration:none" href="${linkCapo(c)}" target="_blank" rel="noopener">Sito ↗</a></div>`).join("");
  $("cond-totale").innerHTML = `<span>Totale</span><span>${euro(S.totale(o))}</span>`;
  $("cond-nota").textContent = trovati.length < link.c.length ? "Qualche capo non è più in vendita." : "";
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
if (location.hostname === "localhost") window.__cam = { lookPerRichiesta, vaPerRichiesta, S, get DATI() { return DATI; }, profilo };   // solo per le prove in locale
