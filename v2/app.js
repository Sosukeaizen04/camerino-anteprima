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
let DATI = null, INDICE = new Map(), esclusi = new Set(), manca = [];
let seme = Date.now() % 1e9;
let genereDati = null, daProvare = null, vistaAvatar = 0;

// ---------- prova addosso: il server (server/worker.js) veste l'avatar col look; vuoto = non ancora acceso ----------
const SERVER = (() => { try { return localStorage.getItem("camerino-server"); } catch { return null; } })() || "https://camerino-prova.camerino.workers.dev";   // in prova si può indicare un server locale
const BASE_AVATAR = "https://sosukeaizen04.github.io/camerino-anteprima/img/";
const prove = (() => { try { return JSON.parse(localStorage.getItem(CHIAVE + "-prove")) || {}; } catch { return {}; } })();   // look → immagine
let vestito = true, inCorso = null;          // vestito = mostra l'avatar col look quando c'è; inCorso = look che si sta vestendo
const chiaveLook = () => profilo.genere + "|" + S.capiDi(outfit).map(S.chiave).join("+");
function ricordaProve() {
  const k = Object.keys(prove); for (const x of k.slice(0, Math.max(0, k.length - 60))) delete prove[x];    // le ultime 60 bastano
  try { localStorage.setItem(CHIAVE + "-prove", JSON.stringify(prove)); } catch {}
}
async function provaLook() {
  if (!SERVER || inCorso || S.mancanti(outfit).length) return;
  const k = chiaveLook(), front = viste()[0][0];
  inCorso = k; disegnaPalco();
  try {
    const r = await fetch(SERVER + "/prova", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ avatar: `${BASE_AVATAR}${front}.jpg`, capi: S.capiDi(outfit).map(c => ({ posto: S.postoDi(c), url: "https://cdn.shopify.com/s/files/" + c.i.slice(1) })) }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.url) throw new Error(d.messaggio || "Non sono riuscito a vestire l'avatar. Riprova.");
    await new Promise((ok, ko) => { const im = new Image(); im.onload = ok; im.onerror = ko; im.src = d.url; });    // pronta prima di mostrarla
    prove[k] = d.url; ricordaProve();
    if (chiaveLook() === k) { vestito = true; vistaAvatar = 0; }
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
    <div class="campo"><div class="etichetta"><span>Salvati</span><span>${salvati.length}</span></div>
      <button class="vuoto" id="a-salvati">Vedi i look salvati</button></div>
    <div class="campo"><button class="testo-link" id="a-azzera" style="justify-self:start">Cancella tutto e ricomincia</button></div>`);
  corpo.onclick = e => {
    if (e.target.closest("#a-salvati")) { chiudiFoglio(); return apriSalvati(); }
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
const MANDA = `<svg viewBox="0 0 24 24"><path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/></svg>`;
/** Le viste dell'avatar base: [file, a specchio]. Si gira trascinando. */
const viste = () => profilo.genere === "u"
  ? [["avatar_uomo_front", 0], ["avatar_uomo_side", 0], ["avatar_uomo_side", 1]]
  : [["avatar_front", 0], ["avatar_side", 0], ["avatar_back", 0], ["avatar_side", 1]];

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
  const vv = viste(), [file, specchio] = vv[vistaAvatar % vv.length];
  const k = chiaveLook(), foto_ = prove[k], conLook = !!(foto_ && vestito), completo = !S.mancanti(outfit).length;
  const pillola = !SERVER ? `<button class="pillola" id="info-prova">I capi sull'avatar arrivano presto</button>`
    : inCorso === k ? `<span class="pillola">Sto vestendo l'avatar…</span>`
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
  $("palco").innerHTML = (conLook ? `<img class="avatar" src="${esc(foto_)}" alt="L'avatar con il look" draggable="false">`
      : `<img class="avatar${specchio ? " specchio" : ""}${inCorso === k ? " attesa" : ""}" src="../img/${file}.jpg" alt="Avatar" draggable="false">`) + `
    ${pillola}
    <div class="colonna">${caselle}</div>
    <div class="attrezzi"><button class="icona" id="salva" aria-label="Salva questo look" aria-pressed="${giaSalvato}">${CUORE}</button><button class="icona" id="condividi" aria-label="Condividi questo look">${MANDA}</button></div>
    ${conLook ? "" : `<div class="punti">${vv.map((_, i) => `<i class="${i === vistaAvatar % vv.length ? "ora" : ""}"></i>`).join("")}</div>`}`;
}
// girare l'avatar trascinando; un tocco fermo sulle caselle le apre
let presa = null;
$("palco").addEventListener("pointerdown", e => { if (e.target.closest("button") || (vestito && prove[chiaveLook()])) return; presa = { x: e.clientX, passi: 0 }; $("palco").classList.add("gira"); $("palco").setPointerCapture(e.pointerId); });
$("palco").addEventListener("pointermove", e => {
  if (!presa) return;
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
  else if (b.id === "vista-look") { vestito = !vestito; vistaAvatar = 0; disegnaPalco(); }
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
  const corpo = apriFoglio(S.NOME_POSTO[postoIniziale], "");
  const carta = c => `<button class="carta" data-k="${esc(S.chiave(c))}"><img src="${foto(c)}" alt="" loading="lazy">
    <span class="marca">${esc(negozio(c).nome)}</span><b>${esc(c.t)}</b><small>${prezzo(c)}</small>
    ${c.e > entro ? `<small class="male">+${euro(c.e - entro)} sul budget</small>` : ""}</button>`;
  const altri = () => {
    corpo.querySelector(".altri")?.remove();
    const lotto = lista.slice(mostrati, mostrati + 30); mostrati += lotto.length;
    corpo.querySelector(".griglia").insertAdjacentHTML("beforeend", lotto.map(carta).join("") + (mostrati < lista.length ? `<button class="vuoto altri">Altri</button>` : ""));
  };
  const rifai = () => {
    const [posto, cat] = filtri[scelto];
    entro = profilo.budget - S.totale(S.metti(outfit, finto(posto)).outfit);     // il budget meno gli altri capi che restano
    lista = S.alternative(DATI.capi, ctx(), outfit, posto, entro).filter(c => !cat || c.c === cat).filter(c => !outfit[posto] || S.chiave(c) !== S.chiave(outfit[posto]));
    mostrati = 0;
    const dentro = lista.filter(c => c.e <= entro).length;
    corpo.innerHTML = (filtri.length > 1 ? `<div class="filtri">${filtri.map((f, i) => `<button class="piccolo" data-f="${i}" aria-pressed="${i === scelto}">${f[2]}</button>`).join("")}</div>` : "") +
      `<div class="conta">${entro > 0 ? `Fino a ${euro(entro)} · ${dentro.toLocaleString("it")} capi` : "Budget finito: questi vanno oltre"} · taglia ${S.tagliaPer(profilo, finto(posto))}</div><div class="griglia"></div>`;
    if (!lista.length) corpo.querySelector(".griglia").innerHTML = `<p class="niente">Niente nella tua taglia, per ora.</p>`; else altri();
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
      <a class="vuoto" id="sc-sito" href="${linkCapo(c)}" target="_blank" rel="noopener">Vedi sul sito di ${esc(neg.nome)} ↗</a></div>`, livello);
  const chiudi = () => { chiudiFoglio(2); chiudiFoglio(1); };
  const q = id => corpo.querySelector(id);
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
const REPARTI = [["capospalla", "Giacche e cappotti"], ["sopra", "Sopra"], ["sotto", "Sotto"], ["abito", "Abiti", "d"], ["scarpe", "Scarpe"]];
let reparto = "sopra", listaScopri = [], mostratiScopri = 0, soloTaglia = true;
function scopri() {
  const reparti = REPARTI.filter(r => !r[2] || r[2] === profilo.genere), testo = $("c-q").value.trim();
  $("c-filtri").innerHTML = (testo ? "" : reparti.map(r => `<button class="piccolo" data-r="${r[0]}" aria-pressed="${r[0] === reparto}">${r[1]}</button>`).join("")) +
    `<button class="piccolo" data-t="1" aria-pressed="${soloTaglia}">La mia taglia</button>`;
  const vaBene = c => !esclusi.has(S.chiave(c)) && (!soloTaglia || S.haTaglia(c, profilo)) && !(profilo.genere === "u" && (c.c === "abito" || c.c === "gonna"));
  if (testo) {
    const q = capisci(testo), ql = q.hex ? S.lab(q.hex) : null;
    const capito = [q.cat, q.colore, ...q.parole.filter(w => w !== q.cat), q.negozio >= 0 ? DATI.negozi[q.negozio].nome : null, q.max ? `fino a ${euro(q.max)}` : null].filter(Boolean);
    listaScopri = !capito.length ? [] : DATI.capi.filter(c => vaBene(c) && (!q.cat || c.c === q.cat) && (q.negozio < 0 || c.n === q.negozio) && (!q.max || c.e <= q.max)
      && (!ql || (c.x && Math.hypot(...S.lab(c.x).map((v, i) => v - ql[i])) < 16)) && q.parole.every(w => TRADUCI[w].test(c.t.toLowerCase())))
      .sort((a, b) => (S.distPalette(a, profilo.stagione) ?? 50) - (S.distPalette(b, profilo.stagione) ?? 50));
    $("c-conta").textContent = capito.length ? `${capito.join(" · ")} — ${listaScopri.length.toLocaleString("it")} capi` : "Prova con un capo, un colore, un prezzo o un marchio.";
  } else {
    // senza ricerca: i capi del reparto; con "la mia taglia", prima quelli che stanno bene col look di adesso
    listaScopri = soloTaglia ? S.alternative(DATI.capi, ctx(), outfit, reparto, Infinity) : DATI.capi.filter(c => S.postoDi(c) === reparto && vaBene(c));
    $("c-conta").textContent = `${listaScopri.length.toLocaleString("it")} capi${soloTaglia ? " nella tua taglia" : ""}`;
  }
  mostratiScopri = 0; $("c-griglia").innerHTML = ""; $("c-griglia").parentElement.scrollTop = 0;
  if (!listaScopri.length) $("c-griglia").innerHTML = `<p class="niente">Niente${soloTaglia ? " nella tua taglia" : ""}.</p>`; else altriScopri();
}
function altriScopri() {
  $("c-griglia").querySelector(".altri")?.remove();
  const l = listaScopri.slice(mostratiScopri, mostratiScopri + 30); mostratiScopri += l.length;
  $("c-griglia").insertAdjacentHTML("beforeend", l.map(c => `<button class="carta" data-k="${esc(S.chiave(c))}"><img src="${foto(c)}" alt="" loading="lazy"><span class="marca">${esc(negozio(c).nome)}</span><b>${esc(c.t)}</b><small>${prezzo(c)}</small></button>`).join("") + (mostratiScopri < listaScopri.length ? `<button class="vuoto altri">Altri</button>` : ""));
}
$("c-form").onsubmit = e => { e.preventDefault(); $("c-q").blur(); scopri(); };
$("c-q").addEventListener("search", () => { if (!$("c-q").value) scopri(); });
$("c-filtri").onclick = e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.r) reparto = b.dataset.r; else soloTaglia = !soloTaglia; scopri(); };
$("c-griglia").onclick = e => { if (e.target.closest(".altri")) return altriScopri(); const b = e.target.closest(".carta"); if (b) apriScheda(INDICE.get(b.dataset.k)); };

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
