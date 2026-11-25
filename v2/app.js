// Camerino v2 — schermate. Le regole dell'outfit stanno in stylist.js.
import * as S from "./stylist.js";
import * as R from "./richiesta.js";
import { LINGUA, cambiaLingua, tr } from "./lingua.js";
import { isole } from "./isole.js";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const euro = n => `${Math.round(n).toLocaleString("it")} €`;
const mesiFreddi = () => { const m = new Date().getMonth(); return m >= 9 || m <= 3; };

// ---------- stato ----------
const CHIAVE = "camerino-v2";
const salvato = (() => { try { return JSON.parse(localStorage.getItem(CHIAVE)) || {}; } catch { return {}; } })();
const profilo = Object.assign({ avatar: null, avatari: [], genere: null, tagliaSopra: null, tagliaSotto: null, scarpa: null, stagione: null, budget: 400, stili: [], conCapospalla: mesiFreddi(), pronto: false }, salvato.profilo);
profilo.freddo = mesiFreddi();
profilo.stili = S.stiliNuovi(profilo.stili);   // 25/11: stili rifatti (Parigino → Chic, Italiano → Classico…)            // la stagione viene dal calendario; "conCapospalla" dice solo se vuole la giacca
let outfit = S.outfitVuoto();
let bloccati = new Set(salvato.bloccati || []);
let salvati = salvato.salvati || [];          // [{ capi: [chiavi], quando, nome? }]
let capiSalvati = salvato.capiSalvati || [];  // chiavi dei singoli capi messi da parte col cuore nella scheda
// i capi spariti dal negozio si ricordano per 3 giorni, così non riappaiono nei look nuovi (giro 8)
const SPARITI = CHIAVE + "-spariti";
const sparitiSalvati = (() => { try { const o = JSON.parse(localStorage.getItem(SPARITI)) || {}; return Object.fromEntries(Object.entries(o).filter(([, t]) => Date.now() - t < 3 * 864e5)); } catch { return {}; } })();
let DATI = null, INDICE = new Map(), esclusi = new Set(Object.keys(sparitiSalvati)), manca = [], largo = [], fuoriPal = [];
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
/**
 * Chiede un'immagine al server e la controlla prima di mostrarla (19/11: "fare in modo che non succeda più").
 * Il server la fa già controllare da un modello che vede le immagini; qui si contano i pixel: un pezzo staccato dalla figura
 * (il ciuffo accanto al viso) → si chiede di rifarla, una volta, senza che l'utente debba fare niente.
 */
async function chiediPulita(percorso, corpo) {
  let d;
  for (let giro = 0; giro < 2; giro++) {
    const r = await fetch(SERVER + percorso, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lingua: LINGUA, ...corpo, ...(giro ? { rifai: true } : {}) }) });
    d = await r.json().catch(() => ({}));
    if (!r.ok || !d.url) return { errore: d.messaggio };
    await new Promise((ok, ko) => { const im = new Image(); im.onload = ok; im.onerror = ko; im.src = d.url; });
    const c = await isole(d.url);
    if (c.ok) return d;
    console.log("pezzi staccati", c.isole, "→ la rifaccio");
  }
  return d;
}
// le viste di lato e da dietro si preparano in anticipo, in parallelo, appena c'è una figura nuova davanti:
// quando si gira l'avatar sono già pronte (Emanuele 25/11: "devono essere immediate")
const inArrivo = {};
function chiediVista(fronte, vista, rifai = false) {
  const k = fronte + "|" + vista;
  if (!rifai && inArrivo[k]) return inArrivo[k];
  return inArrivo[k] = chiediPulita("/gira", { immagine: fronte, vista, ...(rifai ? { rifai: true } : {}) })
    .then(d => { if (d.errore === undefined && d.url) { giri[k] = d.url; ricordaGiri(); } return d; })
    .finally(() => { delete inArrivo[k]; });
}
function preparaViste(fronte) {
  if (!SERVER || !fronte) return;
  for (const v of ["destra", "dietro", "sinistra"]) if (!giri[fronte + "|" + v]) chiediVista(fronte, v).then(() => { if (!$("s-camerino").hidden) disegnaPalco(); }).catch(() => {});
}
async function gira(fronte, vista, rifai = false) {
  const k = fronte + "|" + vista;
  if ((giri[k] && !rifai) || girando) return;
  girando = k; disegnaPalco();
  try {
    const d = await chiediVista(fronte, vista, rifai);
    if (d.errore !== undefined || !d.url) throw new Error(d.errore || "Non sono riuscito a girare l'avatar. Riprova.");
    if (d.restano != null && d.restano <= 3) toast(d.restano ? `Oggi ti restano ${d.restano} immagini` : "Era l'ultima immagine di oggi");
  } catch (e) { toast(e.message || "Non sono riuscito a girare l'avatar. Riprova."); if (girando === k) vistaGiro = 0; }
  finally { girando = null; if (!$("s-camerino").hidden) disegnaPalco(); }
}
const chiaveLook = () => profilo.genere + "|" + (profilo.avatar?.url || "") + "|" + S.capiDi(outfit).map(S.chiave).join("+");
function ricordaProve() {
  const k = Object.keys(prove); for (const x of k.slice(0, Math.max(0, k.length - 60))) delete prove[x];    // le ultime 60 bastano
  try { localStorage.setItem(CHIAVE + "-prove", JSON.stringify(prove)); } catch {}
}
async function provaLook(rifai = false) {
  if (!SERVER || inCorso || S.mancanti(outfit).length) return;
  const k = chiaveLook();
  inCorso = k; disegnaPalco();
  try {
    const d = await chiediPulita("/prova", { avatar: avatarPerServer(), capi: S.capiDi(outfit).map(c => ({ posto: S.postoDi(c), url: "https://cdn.shopify.com/s/files/" + c.i.slice(1) })), ...(rifai ? { rifai: true } : {}) });
    if (d.errore !== undefined || !d.url) throw new Error(d.errore || "Non sono riuscito a vestire l'avatar. Riprova.");
    // il look rifatto: le viste girate del vecchio non valgono più
    if (rifai && prove[k]) for (const x of Object.keys(giri)) if (x.startsWith(prove[k] + "|")) delete giri[x];
    prove[k] = d.url; ricordaProve(); preparaViste(d.url);
    if (chiaveLook() === k) { vestito = true; vistaAvatar = 0; vistaGiro = 0; }
    if (d.restano != null && d.restano <= 3) toast(d.restano ? `Oggi ti restano ${d.restano} prove` : "Era l'ultima prova di oggi");
  } catch (e) { toast(e.message || "Non sono riuscito a vestire l'avatar. Riprova."); }
  finally { inCorso = null; if (!$("s-camerino").hidden) disegnaPalco(); }
}

function ricorda() {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify({ profilo, bloccati: [...bloccati], salvati, capiSalvati,
      outfit: Object.fromEntries(Object.entries(outfit).map(([p, c]) => [p, c ? S.chiave(c) : null])) }));
  } catch {}
}
const ctx = () => ({ profilo, negozi: DATI.negozi, esclusi });
const negozio = c => DATI.negozi[c.n];
// segnaposto che si muove finché la foto non arriva (carte, scheda, miniature): si ferma al caricamento
document.addEventListener("load", e => { if (e.target.tagName === "IMG") e.target.parentElement?.classList.add("pronta"); }, true);
document.addEventListener("error", e => { if (e.target.tagName === "IMG") e.target.parentElement?.classList.add("pronta"); }, true);
// il colore sulla carta, se il nome del capo non lo dice già (giro 1: due carte uguali in "Cambia")
const coloreCarta = c => c.k && !/^(fantasia|multi|multicolou?r|print|stampa|mix)/i.test(c.k) && !piano(c.t).includes(piano(c.k)) ? `<span translate="no">${esc(c.k)}</span> · ` : "";
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
const PASSI = ["benvenuto", "chi", "taglie", "colori", "budget"];   // il benvenuto non conta tra i passi
let passo = 0, daProfilo = false;

function disegnaPasso() {
  const el = $("passo"), nome = PASSI[passo];
  const dove = `<div class="dove"><span>${passo > 1 ? `<button class="testo-link" id="indietro">← Indietro</button>` : "Camerino"}</span><span>${passo} di ${PASSI.length - 1}</span></div>`;
  const avanti = (testo, ok = true) => `<div class="piede"><button class="pieno" id="avanti" ${ok ? "" : "disabled"}><span>${testo}</span><span>→</span></button></div>`;
  const scelte = (id, valori, attuale) => `<div class="scelte" id="${id}">${valori.map(v => `<button data-v="${v}" aria-pressed="${attuale === v}">${v}</button>`).join("")}</div>`;

  // Andrea 20/11: chi apre l'app senza spiegazioni non capisce cos'è → prima di tutto due righe chiare
  if (nome === "benvenuto") {
    el.innerHTML = `<div class="benvenuto">
      <img src="esempio-addosso.jpg" alt="Un look completo indossato dall'avatar">
      <div><p class="dove"><span>Camerino</span></p>
        <h1>Il tuo stylist personale</h1>
        <p>Ti prepara look completi con capi veri, in vendita adesso nella tua taglia, da più di 70 marchi.</p>
        <p>Li provi addosso al tuo avatar, li cambi capo per capo e li compri direttamente sul sito del marchio.</p>
        <p class="sotto">Serve un minuto. Niente account: i tuoi dati restano su questo telefono.</p></div></div>
      ${avanti("Inizia")}`;
  }
  if (nome === "chi") {
    el.innerHTML = `${dove}<h1>Donna o uomo?</h1>
      <div class="grandi" id="genere">
        <button data-v="d" aria-pressed="${profilo.genere === "d"}"><span>Donna</span><span>→</span></button>
        <button data-v="u" aria-pressed="${profilo.genere === "u"}"><span>Uomo</span><span>→</span></button>
      </div>`;
    $("genere").onclick = e => {
      const b = e.target.closest("button"); if (!b) return;
      if (profilo.genere !== b.dataset.v) { profilo.genere = b.dataset.v; profilo.scarpa = null; DATI = null; outfit = S.outfitVuoto(); bloccati.clear(); vistaAvatar = 0; }
      scarica(profilo.genere).catch(() => {});
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
        out.innerHTML = r.alternativa
          ? `Dalla foto: <b>${S.STAGIONI[r.stagione].nome}</b> o <b>${S.STAGIONI[r.alternativa].nome}</b>. La foto non basta a decidere: guarda i colori qui sopra e scegli quella in cui ti ritrovi.`
          : `Dalla foto: <b>${S.STAGIONI[r.stagione].nome}</b>. È una stima${r.luce ? `: ho corretto la luce ${r.luce} della foto` : ", la luce può ingannare"}. Se non ti convince cambiala qui sopra.`;
      } catch { out.textContent = "Non riesco a leggere la foto. Scegli tu qui sopra."; }
    };
  }
  if (nome === "budget") {
    el.innerHTML = `${dove}<h1>Budget</h1><p class="sotto">Per tutto il look, scarpe comprese.</p>
      <div class="campo"><div class="etichetta"><span>Fino a</span><output id="o-budget">${euro(profilo.budget)}</output></div>
        <input type="range" id="i-budget" min="50" max="3000" step="10" value="${profilo.budget}" aria-label="Budget del look in euro"></div>
      <div class="campo"><label class="interruttore"><input type="checkbox" id="i-capospalla" ${profilo.conCapospalla ? "checked" : ""}> Con giacca o cappotto</label></div>
      <div class="campo"><div class="etichetta"><span>Stile</span><span>se vuoi</span></div>
        <p class="note" style="margin:0 0 8px">Tocca quelli che ti somigliano: vale anche più di uno.</p>
        <div class="scelte" id="stili">${S.STILI.map(k => `<button data-v="${k}" aria-pressed="${profilo.stili.includes(k)}">${k}</button>`).join("")}</div></div>
      ${avanti(daProfilo ? "Fatto" : "Entra")}`;
    $("i-budget").oninput = () => { profilo.budget = +$("i-budget").value; $("o-budget").textContent = euro(profilo.budget); };
    $("i-capospalla").onchange = () => { profilo.conCapospalla = $("i-capospalla").checked; };
    // lo stile si sceglie guardando: una foto vera per stile, dal catalogo (giro 1–2, A1: 15 parole dicevano poco)
    scarica(profilo.genere).then(d => { const el2 = $("stili"); if (!el2) return; const foto_ = fotoStili(d, profilo.genere); if (!Object.keys(foto_).length) return;
      el2.className = "stili-foto";
      el2.innerHTML = S.STILI.filter(k => foto_[k]).map(k => `<button data-v="${k}" aria-pressed="${profilo.stili.includes(k)}"><span class="stile-foto"><img src="${foto(foto_[k], 300)}" alt=""></span><span>${k}</span></button>`).join(""); }).catch(() => {});
    $("stili").onclick = e => { const b = e.target.closest("button"); if (!b) return; const k = b.dataset.v; profilo.stili = profilo.stili.includes(k) ? profilo.stili.filter(x => x !== k) : [...profilo.stili, k]; b.setAttribute("aria-pressed", profilo.stili.includes(k)); };
  }
  if ($("indietro")) $("indietro").onclick = () => { passo--; disegnaPasso(); };
  if ($("avanti")) $("avanti").onclick = () => {
    if (passo < PASSI.length - 1) { passo++; disegnaPasso(); return; }
    profilo.pronto = true; ricorda(); entra();
  };
  $("passo").scrollTop = 0;
}
function apriProfilo() { daProfilo = profilo.pronto; passo = daProfilo ? 1 : 0; mostra("s-profilo"); disegnaPasso(); }

// ======================================================================
// IL MIO ACCOUNT — si guarda e si modifica sul posto; la ✕ riporta dove eri
// ======================================================================
function apriAccount(prima = JSON.stringify(profilo)) {
  const scelte = (campo, valori, attuale) => `<div class="scelte" data-campo="${campo}">${valori.map(v => `<button data-v="${v}" aria-pressed="${String(attuale) === String(v)}">${v}</button>`).join("")}</div>`;
  const numeri = profilo.genere === "u" ? S.NUMERI_SCARPE.filter(n => n >= 39) : S.NUMERI_SCARPE.filter(n => n <= 42);
  // in cima il riassunto; ogni sezione si apre al tocco, come nelle Impostazioni (giro 1, G4)
  const riass = `${profilo.genere === "u" ? "Uomo" : "Donna"} · ${profilo.tagliaSopra || "–"} / ${profilo.tagliaSotto || "–"} / ${profilo.scarpa || "–"} · fino a ${euro(profilo.budget)}${profilo.stagione ? " · " + S.STAGIONI[profilo.stagione].nome : ""}${profilo.stili.length ? " · " + profilo.stili.join(", ") : ""}`;
  const sez = (titolo, valore, html, aperta = false) => `<details class="sezione"${aperta ? " open" : ""}><summary><span>${titolo}</span><small>${valore}</small></summary><div class="sezione-corpo">${html}</div></details>`;
  const corpo = apriFoglio("Il mio account", `
    <p class="riassunto-account">${esc(riass)}</p>
    ${sez("Capi da", profilo.genere === "u" ? "Uomo" : "Donna", `<div class="scelte" data-campo="genere"><button data-v="d" aria-pressed="${profilo.genere === "d"}">Donna</button><button data-v="u" aria-pressed="${profilo.genere === "u"}">Uomo</button></div>`)}
    ${sez("Taglie", `${profilo.tagliaSopra || "–"} · ${profilo.tagliaSotto || "–"} · ${profilo.scarpa || "–"}`, `
      <div class="campo" style="border-top:0"><div class="etichetta"><span>Taglia sopra</span></div>${scelte("tagliaSopra", S.TAGLIE, profilo.tagliaSopra)}</div>
      <div class="campo"><div class="etichetta"><span>Taglia sotto</span></div>${scelte("tagliaSotto", S.TAGLIE, profilo.tagliaSotto)}</div>
      <div class="campo"><div class="etichetta"><span>Scarpe</span></div>${scelte("scarpa", numeri, profilo.scarpa)}</div>`)}
    ${sez("Budget del look", euro(profilo.budget), `<div class="etichetta"><span></span><output id="a-o-budget">${euro(profilo.budget)}</output></div>
      <input type="range" id="a-budget" min="50" max="3000" step="10" value="${profilo.budget}" aria-label="Budget del look in euro">
      <label class="interruttore"><input type="checkbox" id="a-capospalla" ${profilo.conCapospalla ? "checked" : ""}> Con giacca o cappotto</label>`)}
    ${sez("Colori", profilo.stagione ? S.STAGIONI[profilo.stagione].nome : "nessuna stagione", `      <div class="stagioni" data-campo="stagione">${Object.entries(S.STAGIONI).map(([k, st]) => `<button class="stagione" data-v="${k}" aria-pressed="${profilo.stagione === k}"><span><b>${st.nome}</b><small>${st.desc}</small></span><span class="pallini">${st.colori.map(c => `<i style="background:${c}"></i>`).join("")}</span></button>`).join("")}</div>`)}
    ${sez("Stile", profilo.stili.length ? profilo.stili.join(", ") : "nessuno", (() => { const f = DATI ? fotoStili(DATI, profilo.genere) : {};
      return Object.keys(f).length ? `<div class="stili-foto" data-campo="stili">${S.STILI.filter(k => f[k]).map(k => `<button data-v="${k}" aria-pressed="${profilo.stili.includes(k)}"><span class="stile-foto"><img src="${foto(f[k], 300)}" alt="" loading="lazy"></span><span>${k}</span></button>`).join("")}</div>`
        : `<div class="scelte" data-campo="stili">${S.STILI.map(k => `<button data-v="${k}" aria-pressed="${profilo.stili.includes(k)}">${k}</button>`).join("")}</div>`; })())}
    <button class="riga-account" id="a-avatar"><span>Avatar</span><small>${esc(avatarScelto() ? avatarScelto().nome : MODELLI[profilo.genere === "u" ? "u" : "d"][0][1])}</small></button>
    <button class="riga-account" id="a-salvati"><span>Salvati</span><small>${salvati.length} look · ${capiSalvati.length} ${capiSalvati.length === 1 ? "capo" : "capi"}</small></button>
    <div class="campo"><div class="etichetta"><span>Lingua</span></div>
      <div class="scelte" id="a-lingua" translate="no"><button data-l="it" aria-pressed="${LINGUA === "it"}">Italiano</button><button data-l="en" aria-pressed="${LINGUA === "en"}">English</button></div></div>
    <button class="riga-account" id="a-guida"><span>Come funziona</span><small></small></button>
    <div class="campo"><button class="testo-link" id="a-azzera" style="justify-self:start">Cancella tutto e ricomincia</button></div>`);
  corpo.onclick = e => {
    if (e.target.closest("#a-salvati")) { chiudiFoglio(); return apriSalvati(); }
    if (e.target.closest("#a-avatar")) { chiudiFoglio(); return apriAvatar(); }
    if (e.target.closest("#a-guida")) { chiudiFoglio(); return setTimeout(() => apriGuida(0), 250); }
    const lb = e.target.closest("#a-lingua button");
    if (lb) { const fai = alChiudere; alChiudere = null; fai?.(); ricorda(); cambiaLingua(lb.dataset.l); for (const x of lb.parentElement.children) x.setAttribute("aria-pressed", x === lb); return; }
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
  const vivo = () => {   // il riassunto in cima e le righe chiuse seguono le modifiche (giro 3)
    if (!corpo.querySelector(".riassunto-account")) return;
    corpo.querySelector(".riassunto-account").textContent = `${profilo.genere === "u" ? "Uomo" : "Donna"} · ${profilo.tagliaSopra || "–"} / ${profilo.tagliaSotto || "–"} / ${profilo.scarpa || "–"} · fino a ${euro(profilo.budget)}${profilo.stagione ? " · " + S.STAGIONI[profilo.stagione].nome : ""}${profilo.stili.length ? " · " + profilo.stili.join(", ") : ""}`;
    const righe = corpo.querySelectorAll(".sezione summary small"), val = [profilo.genere === "u" ? "Uomo" : "Donna", `${profilo.tagliaSopra || "–"} · ${profilo.tagliaSotto || "–"} · ${profilo.scarpa || "–"}`, euro(profilo.budget), profilo.stagione ? S.STAGIONI[profilo.stagione].nome : "nessuna stagione", profilo.stili.length ? profilo.stili.join(", ") : "nessuno"];
    righe.forEach((x, i) => { if (val[i] != null) x.textContent = val[i]; });
  };
  if (corpo._vivo) corpo.removeEventListener("click", corpo._vivo);   // giro 4: un ascoltatore in più a ogni apertura
  corpo._vivo = () => setTimeout(vivo, 0); corpo.addEventListener("click", corpo._vivo);
  corpo.querySelector("#a-budget").oninput = e => { profilo.budget = +e.target.value; corpo.querySelector("#a-o-budget").textContent = euro(profilo.budget); vivo(); };
  corpo.querySelector("#a-capospalla").onchange = e => { profilo.conCapospalla = e.target.checked; };
  // alla chiusura: si salva e il camerino si aggiorna; se è cambiato il genere si riparte con un look nuovo
  alChiudere = () => {
    if (!profilo.scarpa) { daProfilo = false; passo = 2; mostra("s-profilo"); disegnaPasso(); outfit = S.outfitVuoto(); bloccati.clear(); DATI = null; return; }   // ha cambiato genere senza scegliere il numero
    if (JSON.stringify(profilo) === prima) return;
    const cambiatoGenere = JSON.parse(prima).genere !== profilo.genere;
    ricorda();
    if (cambiatoGenere) { outfit = S.outfitVuoto(); bloccati.clear(); vistaAvatar = 0; DATI = null; return entra(); }
    if (!$("s-camerino").hidden) disegna();
    const fuori = S.capiDi(outfit).filter(c => !S.haTaglia(c, profilo));
    toast(fuori.length ? `${fuori.length === 1 ? "Un capo non c'è" : `${fuori.length} capi non ci sono`} nella nuova taglia` : "Salvato");
    if (fuori.length) setTimeout(() => toast(S.totale(outfit) > profilo.budget ? "Rifaccio il look con le nuove taglie e il budget?" : "Rifaccio il look con le nuove taglie?", () => { for (const c of fuori) bloccati.delete(S.postoDi(c)); componi(false); }, "Sì"), 2600);
    else if (S.totale(outfit) > profilo.budget) setTimeout(() => toast(`Il look supera i ${euro(profilo.budget)}. Lo rifaccio?`, () => componi(false), "Sì"), 2600);
  };
}
$("apri-profilo").onclick = () => apriAccount();

// ======================================================================
// CAMERINO — l'avatar a tutto schermo, i capi del look di fianco
// ======================================================================
/** Carica i capi di un genere ("d" o "u"). Restituisce false se la rete non va. */
// filtri dei pantaloni più precisi (Andrea 24/11: "non si riesce a selezionare il modello che uno ha in mente"), dal nome del capo
const GAMBE = [["palazzo", /palazzo/i], ["culotte", /culotte/i], ["jogger", /jogger/i], ["bootcut", /boot ?cut/i], ["svasata", /flare|flared|[ée]vas[ée]|acampanad|zampa/i],
  ["barrel", /barrel|balloon|horseshoe/i], ["affusolata", /taper|carrot|peg\b/i], ["sigaretta", /cigarette|sigaretta/i], ["skinny", /skinny|slim leg|slim fit/i],
  ["ampia", /wide|ampi|large|loose|baggy/i], ["dritta", /straight|droit|dritt|recto|column/i]];
const VITE = [["altissima", /ultra[- ]?high|super[- ]?high|extra[- ]?high/i], ["alta", /high[- ]?(rise|waist)|taille haute|vita alta|tiro alto|high[- ]waisted/i],
  ["media", /mid[- ]?(rise|waist)|vita media|taille mi/i], ["bassa", /low[- ]?(rise|waist)|taille basse|vita bassa|tiro bajo/i]];
function gambaEVita(c) {
  c.b = GAMBE.find(([, rx]) => rx.test(c.t))?.[0]; c.j = VITE.find(([, rx]) => rx.test(c.t))?.[0];
  if ((!c.l || c.l === "media") && /ankle|7\/8|cropped|caviglia|\bcrop\b/i.test(c.t)) c.l = "caviglia";
}
/** Una foto per stile: un capo che lo rappresenta davvero (regole per stile sotto), sempre lo stesso a parità di catalogo. */
const SATURO = c => { if (!c.x) return false; const [, a, b] = S.lab(c.x); return Math.hypot(a, b) > 38; };
const TIPICO = {      // per la foto di ogni stile: il capo deve "dirlo" a colpo d'occhio
  Minimal: c => S.tipoColore(c) === "neutro" && !c.q, Chic: c => c.q === "righe" || /trench|breton|marini/i.test(c.t), Classico: c => S.registro(c) >= 2 && /blazer|coat|cappotto|shirt|camicia|trouser/i.test(c.t),
  Ufficio: c => /blazer|tailored|trouser/i.test(c.t) && S.tipoColore(c) === "neutro" && !c.q && !/denim|jean|print|leopard/i.test(c.t),
  Elegante: c => S.registro(c) === 3 && !c.q && (c.c === "abito" || /blazer|blouse|satin|silk/i.test(c.t)) && !/leopard|animal|print/i.test(c.t),
  Lusso: c => S.registro(c) === 3 && !c.q && S.tipoColore(c) === "neutro" && /cashmere|silk|seta|leather|wool coat|cappotto|manteau|coat/i.test(c.t),
  Sera: c => c.c === "abito" && /satin|sequin|velvet|slip/i.test(c.t), Romantico: c => /ruffle|frill|lace|bow|floral|puff/i.test(c.t) || c.q === "fiori",
  Boho: c => /crochet|fringe|paisley|embroider|maxi|tiered/i.test(c.t), Vintage: c => /vintage|retro|corduroy|western|suede|polka/i.test(c.t),
  Preppy: c => /polo|cable|argyle|pleated|varsity|cardigan/i.test(c.t), Casual: c => c.c === "jeans" || /t-?shirt|tee|sweat|denim/i.test(c.t),
  Mare: c => /linen|lino|crochet|beach|resort/i.test(c.t), Colorato: c => SATURO(c) && !c.q, Sportivo: c => S.registro(c) === 0,
  Streetwear: c => /cargo|hoodie|graphic|oversized|baggy|bomber/i.test(c.t), Rock: c => /leather|biker|mesh|stud|black/i.test(c.t),
};
function fotoStili(d, g) {
  // per ogni stile il capo più "puro": ha quello stile e pochi altri, sopra o abito, curato; sempre lo stesso a parità di catalogo
  const out = {}, hash = t => [...t].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const capi = d.capi.filter(c => (c.c === "abito" && g !== "u" || ["camicia", "maglia", "top", "jeans", "capospalla"].includes(c.c)) && !/\bmen'?s\b|\bwomen'?s\b|pijama|pyjama|pigiama/i.test(c.t));
  for (const k of S.STILI) {
    const l = capi.filter(c => S.stiliDi(c, d.negozi).has(k) && (TIPICO[k] || (() => true))(c)
      && (["Rock", "Streetwear", "Sportivo"].includes(k) || !["Rock", "Streetwear", "Sportivo"].includes(d.negozi[c.n].stile)) && !/dot|spot|pois|polka|moucheti/i.test(c.t + " " + (k === "Vintage" ? "" : c.k || "") + " " + (c.v || "")));
    if (!l.length) continue;
    out[k] = l.sort((a, b) => S.stiliDi(a, d.negozi).size - S.stiliDi(b, d.negozi).size || hash(a.h) - hash(b.h))[0];
  }
  return out;
}
// il catalogo si comincia a scaricare appena si sceglie donna/uomo, così all'arrivo nel camerino è già pronto
const scaricati = {};
const scarica = g => scaricati[g] ??= fetch(`../data/v2-${g === "u" ? "uomo" : "donna"}.json`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .catch(e => { delete scaricati[g]; throw e; });
async function carica(g) {
  try { DATI = await scarica(g); } catch { DATI = null; return false; }
  // capi dell'altro genere finiti nel catalogo sbagliato ("Men's" tra la donna) e pigiami: fuori (collaudo giro 2)
  const altroGenere = g === "u" ? /\bwmns\b|\bwom[ae]n'?s?\b|\bdonna\b|\bfemme\b|\bmujer\b/i : /\bmen'?s\b|\bhomme\b|\buomo\b|\bhombre\b/i;
  DATI.capi = DATI.capi.filter(c => !altroGenere.test(c.t) && !/pijama|pyjama|pajama|pigiama|loungewear|nightwear|sleepwear|\bslip\b(?! ?(dress|skirt|abito|gonna|robe))|\bhipster\b(?! ?(jeans?|trousers?|pants?|skirt|flare|denim))|\bbriefs?\b|\bdog\b|\bpet\b|\bper cani\b|\bchien\b|\bperro\b|m[üu]tze|\bbeanie\b|\bbucket hat\b|\bcappellin|\bgorro\b/i.test(c.t));
  for (const c of DATI.capi) { c.dom = DATI.negozi[c.n].dominio; if (c.c === "pantaloni" || c.c === "jeans") gambaEVita(c); }
  INDICE = new Map(DATI.capi.map(c => [S.chiave(c), c]));
  genereDati = g;
  return true;
}
async function entra() {
  mostra("s-camerino");
  if (DATI && genereDati !== profilo.genere) DATI = null;
  if (!DATI) {
    $("budget").innerHTML = ""; disegnaPalco(profilo.genere === "u" ? "Preparo i capi nella tua taglia…" : "Preparo i capi nella tua taglia…");
    if (!await carica(profilo.genere)) {
      disegnaPalco("Non riesco a caricare i capi. Controlla la connessione.");
      $("palco").querySelector(".solo-testo").insertAdjacentHTML("beforeend", `<br><button class="vuoto" id="ricarica" style="margin-top:12px">Riprova</button>`);
      $("ricarica").onclick = () => entra();
      return;
    }
    outfit = S.outfitVuoto();
    for (const [p, k] of Object.entries(salvato.outfit || {})) if (k && INDICE.has(k)) outfit[p] = INDICE.get(k);
    salvato.outfit = null;
  }
  if (daProvare) {                       // look arrivato da un link: lo si indossa al posto di comporne uno
    outfit = S.outfitVuoto(); bloccati.clear(); manca = []; largo = []; fuoriPal = [];
    for (const k of daProvare) { const c = INDICE.get(k); if (c) outfit = S.metti(outfit, c).outfit; }
    daProvare = null; history.replaceState(null, "", location.pathname); ricorda();
  }
  if (!S.capiDi(outfit).length) await componi(false);
  else disegna();
  if (!profilo.guidaVista) { profilo.guidaVista = true; ricorda(); setTimeout(() => apriGuida(0), 700); }
}

/** Compone (o ricompone) tenendo i capi bloccati, poi controlla sul sito dei marchi che la taglia ci sia davvero. */
let recenti = new Set();     // capi degli ultimi look: si ripetono meno (giro 6: sempre la stessa giacca)
/** Nuovo look; `verso` = "elegante" | "casual" | "risparmio" per dargli una direzione (giro 1, B4). */
async function componi(avvisa = true, verso = null) {
  const prima = outfit;
  const posti = new Set([...bloccati].filter(p => outfit[p]));
  let capi = DATI.capi, cx = { ...ctx(), recenti };
  if (verso === "elegante") {
    // un gradino sopra il look di adesso: se era già curato si va su capi eleganti (livello 3) dove ce ne sono abbastanza
    const ora = S.capiDi(outfit).map(S.registro), media = ora.length ? ora.reduce((a, b) => a + b, 0) / ora.length : 2;
    const ok = c => S.registro(c) >= 2 && !R.RX_NON_ELEGANTE.test(c.t) && (S.postoDi(c) === "scarpe" || !R.RX_SPORT.test(c.t));
    const alti = capi.filter(c => ok(c) && S.registro(c) === 3);
    capi = media >= 2 && alti.length > 300 ? capi.filter(c => ok(c) && (S.registro(c) === 3 || S.postoDi(c) === "scarpe")) : capi.filter(ok);
    cx = { ...cx, elegante: true };
  }
  else if (verso === "casual") { const sport = profilo.stili.some(x => ["Sportivo", "Streetwear"].includes(x)); capi = capi.filter(c => S.postoDi(c) === "scarpe" ? S.registro(c) <= 2 : S.registro(c) === 1 || (sport && S.registro(c) === 0)); }
  else if (verso === "risparmio" && S.totale(outfit)) {
    const tetto = Math.max(40, Math.round(S.totale(outfit) * 0.75 / 10) * 10);
    cx = { ...cx, profilo: { ...profilo, budget: Math.min(profilo.budget, tetto) } };
  }
  let r = S.componi(capi, cx, outfit, posti, S.casuale(++seme));
  for (let k = 0; k < 3 && S.mancanti(r.outfit).length && !r.manca.length; k++) r = S.componi(capi, cx, outfit, posti, S.casuale(++seme));   // giro 5: "Sopra" mancante senza motivo
  if (verso && S.mancanti(r.outfit).length) {   // la direzione chiesta non chiude il look nel budget: si allarga e lo si dice
    const largo_ = verso === "elegante" ? DATI.capi.filter(c => S.registro(c) >= 2 && !R.RX_NON_ELEGANTE.test(c.t)) : DATI.capi;
    const r2 = S.componi(largo_, cx, outfit, posti, S.casuale(++seme));
    if (S.mancanti(r2.outfit).length <= S.mancanti(r.outfit).length) r = r2;
  }
  outfit = r.outfit; manca = r.manca; largo = r.largo.filter(p => outfit[p]); fuoriPal = r.fuoriPalette.filter(p => outfit[p]);
  for (const c of S.capiDi(outfit)) { recenti.add(S.chiave(c)); } if (recenti.size > 24) recenti = new Set([...recenti].slice(-24));
  disegna(); ricorda();
  const DETTO = { elegante: "Look più elegante", casual: "Look più casual", risparmio: `Look da ${euro(S.totale(outfit))}` };
  if (avvisa && S.capiDi(prima).length) toast(DETTO[verso] || "Nuovo look", () => { outfit = prima; manca = []; largo = []; fuoriPal = []; disegna(); ricorda(); });
  // verifica dal vivo: un capo esaurito o sparito viene sostituito, senza sforare
  for (let giro = 0; giro < 3; giro++) {
    const mio = outfit, esiti = await Promise.all(S.capiDi(mio).map(c => posti.has(S.postoDi(c)) ? null : verifica(c)));
    if (outfit !== mio) return;                                   // nel frattempo l'utente ha cambiato qualcosa
    const guasti = S.capiDi(mio).filter((c, i) => esiti[i] && (esiti[i].stato === "esaurita" || esiti[i].stato === "sparito"));
    if (esiti.some(x => x?.aggiornato)) {      // i prezzi dal vivo cambiano il totale: se si sfora si rimedia (giro 5: primo look a 440 € su 400)
      for (const p of ["capospalla", "scarpe", "sopra", "sotto", "abito"].filter(p => outfit[p] && !posti.has(p)).sort((a, b) => outfit[b].e - outfit[a].e)) {
        if (S.totale(outfit) <= profilo.budget) break;
        const entro = profilo.budget - S.totale(outfit) + outfit[p].e;
        const alt = S.alternative(DATI.capi, ctx(), outfit, p, entro).find(a => a.e <= entro && !S.fuoriStagione(a, profilo.freddo));
        if (alt) outfit = S.metti(outfit, alt).outfit;
      }
      if (S.totale(outfit) > profilo.budget && outfit.capospalla && !posti.has("capospalla"))
        toast(`Con la giacca sono ${euro(S.totale(outfit))}. Tolgo la giacca?`, () => { outfit = S.togli(outfit, "capospalla"); ricorda(); disegna(); }, "Sì");
      disegna(); ricorda();
    }
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
    <div class="barra"><i style="width:${Math.min(100, tot / profilo.budget * 100)}%"></i></div>${rigaPerche()}`;
  disegnaPalco();

  const m = S.mancanti(outfit), nomi = m.map(p => ({ sopra: "il sopra", sotto: "il sotto", scarpe: "le scarpe" })[p]);
  let avviso = "";
  let serve = 0;
  if (m.length && manca.length) {
    // quanto serve davvero per chiudere il look, coi capi già scelti: un numero vero e un pulsante per usarlo
    serve = Math.ceil((tot + manca.reduce((t, x) => t + x.daEuro, 0)) / 10) * 10;
    avviso = `Con ${euro(profilo.budget)} il look non si chiude: nella tua taglia ${manca.map(x => `${{ sopra: "il sopra", sotto: "il sotto", scarpe: "le scarpe", abito: "l'abito" }[x.posto] || S.NOME_POSTO[x.posto].toLowerCase()} parte da ${euro(x.daEuro)}`).join(", ")}. Servono almeno ${euro(serve)}.`;
  }
  else if (m.length) avviso = `Manca${m.length > 1 || m[0] === "scarpe" ? "no" : ""} ${nomi.join(m.length > 2 ? ", " : " e ")}.`;
  else if (largo.length && profilo.stili.length) {
    const cosa = largo.map(p => ({ capospalla: "la giacca", sopra: "il sopra", sotto: "il sotto", scarpe: "le scarpe", abito: "l'abito" })[p]);
    avviso = `Con ${euro(profilo.budget)} non trovo ${cosa.join(" e ")} nel tuo stile (${profilo.stili.join(", ")}): ho messo ${largo.length > 1 || largo[0] === "scarpe" ? "i più vicini" : "il più vicino"}.`;
  } else if (fuoriPal.length && profilo.stagione) avviso = `Con ${euro(profilo.budget)} non trovo tutto nei colori della tua stagione (${S.STAGIONI[profilo.stagione].nome}): alzando il budget ce ne sono di più.`;
  $("avviso").hidden = !avviso; $("avviso").textContent = avviso;
  if (serve && serve <= 3000) { $("avviso").insertAdjacentHTML("beforeend", ` <button class="testo-link" id="alza-budget">Usa ${euro(serve)}</button>`);
    $("alza-budget").onclick = () => { profilo.budget = serve; ricorda(); componiMancanti(); }; }

  const p = $("principale");
  if (m.length) { p.textContent = "Completa il look"; p.onclick = componiMancanti; }
  else { p.textContent = `Compra · ${euro(tot)}`; p.onclick = apriCompra; }
}
/** Ciò che si è chiesto in chat e che il look rispetta davvero: "✓ stivali neri  ✓ fino a 200 €" (giro 8). */
function rigaUnica(a = [], b = []) { const t = [...a, ...b].filter((x, i, l) => l.indexOf(x) === i).slice(0, 5); return t.length ? `<p class="perche" translate="no">${esc(t.join("  "))}</p>` : ""; }
function rigaChiesto(o, r, en, lista = false) {
  if (!r) return "";
  const T = (it, eng) => en ? eng : it, pezzi = [];
  const COL = { nero: ["neri", "black"], bianco: ["bianchi", "white"], marrone: ["marroni", "brown"], beige: ["beige", "beige"], grigio: ["grigi", "grey"], blu: ["blu", "blue"], rosso: ["rossi", "red"], verde: ["verdi", "green"], cammello: ["cammello", "camel"], navy: ["navy", "navy"], bordeaux: ["bordeaux", "burgundy"], rosa: ["rosa", "pink"], panna: ["panna", "cream"] };
  const TIPI = { stivali: ["stivali", "boots"], tacchi: ["tacchi", "heels"], sneakers: ["sneakers", "sneakers"], mocassini: ["mocassini", "loafers"], sandali: ["sandali", "sandals"], ballerine: ["ballerine", "flats"],
    camicia: ["camicia", "shirt"], maglia: ["maglia", "knit"], top: ["top", "top"], pantaloni: ["pantaloni", "trousers"], jeans: ["jeans", "jeans"], gonna: ["gonna", "skirt"],
    cappotto: ["cappotto", "coat"], giacca: ["giacca", "jacket"], blazer: ["blazer", "blazer"], piumino: ["piumino", "puffer"], trench: ["trench", "trench"] };
  for (const [k, p] of [["giacca_dettagli", "capospalla"], ["sopra", "sopra"], ["sotto", "sotto"], ["scarpe", "scarpe"]]) {
    const pz = r[k], c = o[p]; if (!pz?.tipo || !c || !TIPI[pz.tipo]) continue;
    const okTipo = p === "scarpe" ? R.scarpaDiTipo(c, pz.tipo) : p === "capospalla" ? true : c.c === pz.tipo; if (!okTipo) continue;
    const col = pz.colori?.[0], okCol = col && R.coloreDi(c, col);
    pezzi.push(en ? `✓ ${okCol && COL[col] ? COL[col][1] + " " : ""}${TIPI[pz.tipo][1]}` : `✓ ${TIPI[pz.tipo][0]}${okCol ? ` (${col})` : ""}`);
  }
  if (r.budget && S.totale(o) <= r.budget) pezzi.push(`✓ ${T("fino a", "up to")} ${euro(r.budget)}`);
  if (r.elegante && S.capiDi(o).every(c => S.registro(c) >= 2)) pezzi.push(`✓ ${T("elegante", "elegant")}`);   // solo se è vero per ogni capo
  if (lista) return pezzi;
  return pezzi.length ? `<p class="perche" translate="no">${esc(pezzi.join("  "))}</p>` : "";
}
/** Perché il look è così, solo con ciò che è vero per i capi di adesso (giro 1, B3). */
function rigaPerche(o = outfit, budget = profilo.budget, lista = false, en = false) {
  const capi = S.capiDi(o); if (!capi.length || S.totale(o) > budget || S.mancanti(o).length) return lista ? [] : "";
  const pezzi = [];
  if (profilo.stili.length && (o !== outfit || !largo.length) && capi.every(c => S.nelloStile(c, profilo.stili, DATI.negozi, false))) pezzi.push(`✓ ${profilo.stili.join(", ")}`);
  if (profilo.stagione && (o !== outfit || !fuoriPal.length) && capi.every(c => S.inPalette(c, profilo.stagione))) pezzi.push(en ? `✓ ${({ primavera: "Spring", estate: "Summer", autunno: "Autumn", inverno: "Winter" })[profilo.stagione] || S.STAGIONI[profilo.stagione].nome} colours` : `✓ colori ${S.STAGIONI[profilo.stagione].nome}`);
  if (capi.every(c => S.haTaglia(c, profilo))) pezzi.push(en ? "✓ your size" : `✓ tua taglia`);
  if (lista) return pezzi;
  return pezzi.length ? `<p class="perche">${esc(pezzi.join("  "))}</p>` : "";
}
/** Riempie solo i posti vuoti, tenendo tutto ciò che c'è. */
async function componiMancanti() {
  const tutti = bloccati; bloccati = new Set(["capospalla", "sopra", "sotto", "scarpe", "abito"].filter(p => outfit[p]));
  const conCapo = profilo.conCapospalla; if (outfit.capospalla === null) profilo.conCapospalla = false;   // non aggiunge una giacca non chiesta
  await componi(false);
  profilo.conCapospalla = conCapo; bloccati = tutti; disegna();
}

// Look | Avatar: il look si vede subito con le foto vere dei capi, gratis; l'avatar vestito arriva con "Prova il look" (giro 1, B1)
let modoPalco = "look", chiavePalco = null;
function disegnaPalco(messaggio) {
  if (messaggio) { $("palco").innerHTML = `<div class="riquadro" style="position:absolute;inset:0;height:auto;border:0;background:none"><div class="solo-testo">${esc(messaggio)}</div></div>`; return; }
  const vv = viste(), k = chiaveLook(), foto_ = prove[k], conLook = !!(foto_ && vestito), completo = !S.mancanti(outfit).length;
  if (k !== chiavePalco) { chiavePalco = k; if (inCorso !== k) modoPalco = foto_ ? "avatar" : "look"; }
  const segmenti = `<div class="segmenti" role="group" aria-label="Vista"><button data-modo="look" aria-pressed="${modoPalco === "look"}">Look</button><button data-modo="avatar" aria-pressed="${modoPalco === "avatar"}">Avatar</button></div>`;
  const giaSalvato_ = salvati.some(s => s.capi.join() === S.capiDi(outfit).map(S.chiave).join());
  if (modoPalco === "look") {
    const postiL = outfit.abito ? ["capospalla", "abito", "scarpe"] : ["capospalla", "sopra", "sotto", "scarpe"];
    const vis = postiL.filter(p => outfit[p] || p !== "capospalla" || profilo.conCapospalla);
    const tessere = vis.map(p => {
      const c = outfit[p];
      if (!c) return `<button class="pezzo libero" data-cambia="${p}"><span class="pezzo-foto">+</span><span class="pezzo-testo"><small>${S.NOME_POSTO[p]}</small><b>Scegli</b></span></button>`;
      return `<div class="pezzo-box ${p}"><button class="scambia" data-scambia="${p}" aria-label="Un altro capo: ${S.NOME_POSTO[p].toLowerCase()}">↻</button><button class="pezzo ${p}" data-apri="${p}" aria-label="${S.NOME_POSTO[p]}: ${esc(c.t)}, ${euro(c.e)}"><span class="pezzo-foto"><span class="posto">${S.nomeCapo(c, p)}</span><img src="${foto(c, 420)}" alt="">${bloccati.has(p) ? `<span class="lucchetto">${LUCCHETTO}</span>` : ""}</span>
        <span class="pezzo-testo"><small translate="no">${esc(negozio(c).nome)}</small><b>${euro(c.e)}</b></span></button></div>`;
    }).join("");
    const pillolaL = !SERVER ? "" : inCorso === k ? `<span class="pillola">Sto vestendo l'avatar…</span>`
      : foto_ ? `<button class="pillola" data-modo="avatar">Vedilo addosso</button>`
      : completo ? `<button class="pillola nera" id="prova">Prova addosso</button>` : `<span class="pillola">Completa il look per provarlo</span>`;
    palcoOra = { look: true };
    $("palco").innerHTML = `${segmenti}<div class="tavola-look n${vis.length}">${tessere}</div>${pillolaL}
      <div class="attrezzi"><button class="icona" id="salva" aria-label="Salva questo look" aria-pressed="${giaSalvato_}">${CUORE}</button><button class="icona" id="condividi" aria-label="Condividi questo look">${MANDA}</button></div>`;
    return;
  }
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
  if (!base && fronte && modoPalco === "avatar") preparaViste(fronte);     // anche per prove/avatar fatti prima (le viste restano 30 giorni sul server)
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
    : SERVER ? `<div class="giro"><button class="icona" id="gira-sx" aria-label="Gira a sinistra" ${girando ? "disabled" : ""}>‹</button><span class="nome-vista">${nomeVista}</span><button class="icona" id="gira-dx" aria-label="Gira a destra" ${girando ? "disabled" : ""}>›</button>${(vistaGiro && giri[fronte + "|" + GIRI[vistaGiro]]) || (!vistaGiro && conLook) ? `<button class="piccolo rifai" id="rifai" ${girando || inCorso ? "disabled" : ""}>Rifai</button>` : ""}</div>` : "";
  $("palco").innerHTML = `${segmenti}<div class="tela"><img class="avatar${specchio ? " specchio" : ""}${attesa ? " attesa" : ""}" src="${esc(src)}" alt="${conLook ? "L'avatar con il look" : "Avatar"}" draggable="false"></div>
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
  else if (b.dataset.modo) { modoPalco = b.dataset.modo; disegnaPalco(); }
  else if (b.dataset.scambia) scambia(b.dataset.scambia);
  else if (b.id === "prova") { modoPalco = "avatar"; provaLook(); }
  else if (b.id === "cambia-avatar") apriAvatar();
  else if (b.id === "vista-look") { vestito = !vestito; vistaAvatar = 0; vistaGiro = 0; disegnaPalco(); }
  else if (b.id === "gira-sx") frecciaGiro(-1);
  else if (b.id === "gira-dx") frecciaGiro(1);
  else if (b.id === "zoom") apriZoom();
  else if (b.id === "rifai") { if (vistaGiro) gira(palcoOra.fronte, GIRI[vistaGiro], true); else provaLook(true); }
});
$("altro").onclick = () => componi(true);
$("direzioni").onclick = e => { const b = e.target.closest("[data-verso]"); if (b && DATI) componi(true, b.dataset.verso); };

/** ↻ su una tessera: il prossimo capo dello stesso posto che sta col resto e nel budget, con la differenza di prezzo. */
const giriScambio = {};
function scambia(p) {
  const ora = outfit[p]; if (!ora || !DATI) return;
  const entro = profilo.budget - S.totale(outfit) + ora.e;
  const lista = S.alternative(DATI.capi, ctx(), outfit, p, entro).filter(c => c.e <= entro && !S.fuoriStagione(c, profilo.freddo) && S.chiave(c) !== S.chiave(ora)).slice(0, 12);
  if (!lista.length) return toast("Non ho altro nel budget per questo capo");
  const c = lista[(giriScambio[p] = ((giriScambio[p] ?? -1) + 1) % lista.length)];
  const prima = outfit; outfit = S.metti(outfit, c).outfit; bloccati.delete(p); ricorda(); disegna();
  const d = Math.round(c.e - ora.e);
  toast(`${S.NOME_POSTO[p]}: ${d === 0 ? "stesso prezzo" : (d > 0 ? "+" : "−") + euro(Math.abs(d))}`, () => { outfit = prima; ricorda(); disegna(); });
}
/** Mette un capo nel look, con "Annulla" e l'avviso se ha sostituito altro. */
function indossa(capo) {
  const prima = outfit, r = S.metti(outfit, capo);
  outfit = r.outfit; manca = []; largo = []; fuoriPal = [];
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
// Salvati: look e capi. I look dicono il totale di adesso e se un capo non c'è più nella tua taglia (giro 1, G1–G2)
let schedaSalvati = "look";
const dataBreve = t => new Date(t).toLocaleDateString(LINGUA === "en" ? "en-GB" : "it", { day: "numeric", month: "long" });
function apriSalvati() {
  const look = salvati.map((s, i) => {
    const capi = s.capi.map(k => INDICE.get(k)).filter(Boolean), persi = s.capi.length - capi.length;
    return `<article class="salvato" data-i="${i}">
      <div class="salvato-testa"><b class="nome-look">${esc(s.nome || `Look del ${dataBreve(s.quando || Date.now())}`)}</b><button class="testo-link" data-rinomina="${i}">Rinomina</button></div>
      <div class="salvato-griglia n${capi.length}">${capi.map(c => `<button class="salvato-capo" data-capo="${esc(S.chiave(c))}" aria-label="${esc(c.t)}"><img src="${foto(c, 300)}" alt=""></button>`).join("")}</div>
      <div class="sotto-strip"><span>${capi.length} capi · ${euro(capi.reduce((t, c) => t + c.e, 0))}</span><span class="stato-look" id="stato-look-${i}">${persi ? `<span class="male">${persi === 1 ? "Un capo non è più in vendita" : `${persi} capi non sono più in vendita`}</span>` : "Controllo le taglie…"}</span></div>
      <div class="tre"><button class="pieno piccolo" data-indossa="${i}">Indossa</button><button class="piccolo" data-condividi="${i}">Condividi</button><button class="piccolo" data-via="${i}">Elimina</button></div></article>`;
  }).join("");
  const capi = capiSalvati.map(k => INDICE.get(k)).filter(Boolean);
  const griglia = capi.length ? `<div class="griglia">${capi.map(c => `<button class="carta" data-capo="${esc(S.chiave(c))}"><img src="${foto(c)}" alt="" loading="lazy"><span class="marca">${esc(negozio(c).nome)}</span><b>${esc(c.t)}</b><small>${coloreCarta(c)}${prezzoCarta(c)}</small></button>`).join("")}</div>` : "";
  const vuoto = schedaSalvati === "look"
    ? `<div class="niente"><p>Qui ritrovi i look che ti piacciono. Nel camerino tocca il cuore per salvarne uno.</p><button class="vuoto" data-vai="camerino">Vai al camerino</button></div>`
    : `<div class="niente"><p>Qui metti da parte i singoli capi: apri un capo e tocca "Salva il capo".</p><button class="vuoto" data-vai="scopri">Vai a Scopri</button></div>`;
  const corpo = apriFoglio("Salvati", `<div class="segmenti-foglio" role="group"><button data-scheda="look" aria-pressed="${schedaSalvati === "look"}">Look · ${salvati.length}</button><button data-scheda="capi" aria-pressed="${schedaSalvati === "capi"}">${capi.length === 1 ? "Capo" : "Capi"} · ${capi.length}</button></div>
    ${schedaSalvati === "look" ? (look || vuoto) : (griglia || vuoto)}`);
  // taglie dal vivo per ogni look salvato: un capo finito nella tua taglia si dice, con "Cambia"
  if (schedaSalvati === "look") salvati.forEach(async (s, i) => {
    const capi = s.capi.map(k => INDICE.get(k)).filter(Boolean);
    const esiti = await Promise.all(capi.map(c => verifica(c)));
    const el = corpo.querySelector(`#stato-look-${i}`); if (!el || s.capi.length > capi.length) return;
    const finiti = capi.filter((c, j) => ["esaurita", "non-prodotta", "sparito"].includes(esiti[j].stato));
    el.innerHTML = !finiti.length ? `<span class="bene">Tutto disponibile nella tua taglia</span>`
      : `<span class="male">${finiti.map(c => S.NOME_POSTO[S.postoDi(c)]).join(" e ")}: non più nella tua taglia</span> <button class="testo-link" data-cambia-salvato="${i}" data-posto="${S.postoDi(finiti[0])}">Cambia</button>`;
  });
  const indossaSalvato = i => {
    const prima = outfit; outfit = S.outfitVuoto();
    for (const k of salvati[i].capi) { const c = INDICE.get(k); if (c) outfit = S.metti(outfit, c).outfit; }
    bloccati.clear(); manca = []; largo = []; fuoriPal = []; ricorda(); mostra("s-camerino"); disegna(); chiudiFoglio();
    toast("Look nel camerino", () => { outfit = prima; ricorda(); disegna(); });
  };
  corpo.onclick = e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.scheda) { schedaSalvati = b.dataset.scheda; return apriSalvati(); }
    if (b.dataset.vai) { chiudiFoglio(); if (b.dataset.vai === "scopri") { mostra("s-scopri"); scopri(); } else { mostra("s-camerino"); disegna(); } return; }
    if (b.dataset.capo) { const c = INDICE.get(b.dataset.capo); if (c) apriScheda(c, 2, schedaSalvati === "look"); return; }
    if (b.dataset.via) { const i = +b.dataset.via, tolto = salvati.splice(i, 1)[0]; ricorda(); apriSalvati(); disegnaPalco(); toast("Eliminato", () => { salvati.splice(i, 0, tolto); ricorda(); apriSalvati(); disegnaPalco(); }); return; }
    if (b.dataset.rinomina) {
      const i = +b.dataset.rinomina, testa = b.parentElement, vecchio = salvati[i].nome || testa.querySelector(".nome-look").textContent;
      testa.innerHTML = `<form class="cerca rinomina"><input maxlength="40" value="${esc(vecchio)}" aria-label="Nome del look"><button>OK</button></form>`;
      const f = testa.querySelector("form"), inp = f.querySelector("input"); inp.focus(); inp.select();
      f.onsubmit = ev => { ev.preventDefault(); salvati[i].nome = inp.value.trim() || undefined; ricorda(); apriSalvati(); };
      return;
    }
    if (b.dataset.condividi) { let o = S.outfitVuoto(); for (const k of salvati[+b.dataset.condividi].capi) { const c = INDICE.get(k); if (c) o = S.metti(o, c).outfit; } const prima = outfit; outfit = o; condividi(); outfit = prima; return; }
    if (b.dataset.cambiaSalvato) { indossaSalvato(+b.dataset.cambiaSalvato); return apriCambia(b.dataset.posto); }
    if (b.dataset.indossa) indossaSalvato(+b.dataset.indossa);
  };
}
/** Il cuore di un singolo capo (nella scheda). */
function salvaCapo(c, bottone) {
  const k = S.chiave(c), i = capiSalvati.indexOf(k);
  if (i >= 0) capiSalvati.splice(i, 1); else capiSalvati.unshift(k);
  ricorda(); bottone.setAttribute("aria-pressed", i < 0); bottone.lastChild.textContent = i < 0 ? " Salvato" : " Salva il capo";
  toast(i < 0 ? "Capo salvato" : "Tolto dai salvati");
}
$("schede").onclick = e => {
  const b = e.target.closest("button"); if (!b || !DATI) return;
  if (b.dataset.s === "salvati") { schedaSalvati = "look"; return apriSalvati(); }
  chiudiFoglio(2); chiudiFoglio(1);
  if (b.dataset.s === "scopri") { mostra("s-scopri"); scopri(); } else { mostra("s-camerino"); disegna(); }
};

// ======================================================================
// FILTRI — come nell'app di Zalando (Andrea, 18/11): più scelte nello stesso filtro (blu + nero + rosso, cashmere + cotone)
// e filtri diversi insieme. Dentro un filtro vale "uno qualsiasi", tra filtri diversi "tutti". I dati vengono dal negozio:
// (fantasia = campo q: "m" nel catalogo vuol dire colore stimato dalla foto) un capo di cui il negozio non dice il materiale (o la fantasia, lo scollo…) non compare quando si filtra per quello.
// ======================================================================
const NOMI_FILTRI = {
  st: Object.fromEntries(S.STILI.map(x => [x, x])),
  b: { dritta: "Dritta", ampia: "Ampia / wide leg", palazzo: "Palazzo", svasata: "Svasata / flare", bootcut: "Bootcut", affusolata: "Affusolata / tapered", barrel: "Barrel / a botte", sigaretta: "A sigaretta", skinny: "Skinny", culotte: "Culotte", jogger: "Jogger" },
  j: { bassa: "Vita bassa", media: "Vita media", alta: "Vita alta", altissima: "Vita altissima" },
  f: { cotone: "Cotone", lana: "Lana", cashmere: "Cashmere", seta: "Seta", lino: "Lino", pelle: "Pelle", denim: "Denim", velluto: "Velluto", viscosa: "Viscosa", sintetico: "Sintetico" },
  q: { righe: "A righe", quadri: "A quadri", fiori: "Floreale", pois: "A pois", animalier: "Animalier", stampa: "Altre stampe" },
  a: { aderente: "Aderente", regolare: "Regolare", ampia: "Ampia", oversize: "Oversize" },
  l: { corta: "Corta", caviglia: "Alla caviglia / 7/8", normale: "Normale", lunga: "Lunga" },
  w: { senza: "Senza maniche", corte: "Maniche corte", "3/4": "Maniche 3/4", lunghe: "Maniche lunghe" },
  z: { v: "Scollo a V", giro: "Girocollo", alto: "Collo alto", quadrato: "Scollo quadrato", spalle: "Spalle scoperte", americana: "All'americana" },
  r: { "3": "Elegante", "2": "Curato", "1": "Casual", "0": "Sportivo" },
  y: { stivali: "Stivali", stivaletti: "Stivaletti", "décolleté": "Décolleté e tacchi", sneakers: "Sneakers", mocassini: "Mocassini e stringate",
    ballerine: "Ballerine", sandali: "Sandali", mules: "Mules e sabot" },
  u: { basso: "Basso (meno di 3 cm)", medio: "Medio (3–7 cm)", alto: "Alto (oltre 7 cm)" },
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
  { k: "y", nome: "Tipo", per: p => p === "scarpe" }, { k: "u", nome: "Tacco", per: p => p === "scarpe" },
  { k: "st", nome: "Stile" }, { k: "colore", nome: "Colore" }, { k: "prezzo", nome: "Prezzo" }, { k: "marca", nome: "Marca" }, { k: "r", nome: "Occasione" },
  { k: "b", nome: "Forma", per: p => p === "sotto" }, { k: "j", nome: "Vita", per: p => p === "sotto" },
  { k: "f", nome: "Materiale", per: p => p !== "scarpe" }, { k: "q", nome: "Fantasia", per: p => p !== "scarpe" },
  { k: "a", nome: "Vestibilità", per: p => p !== "scarpe" }, { k: "l", nome: "Lunghezza", per: p => ["sotto", "abito", "capospalla"].includes(p) },
  { k: "w", nome: "Maniche", per: p => ["sopra", "abito"].includes(p) }, { k: "z", nome: "Scollo", per: p => ["sopra", "abito"].includes(p) },
];
const CHIAVI = GRUPPI.map(g => g.k);
const nuoviFiltri = () => ({ ...Object.fromEntries(CHIAVI.map(k => [k, new Set()])), saldi: false, ordina: "consigliati" });
const copiaFiltri = st => ({ ...Object.fromEntries(CHIAVI.map(k => [k, new Set(st[k])])), saldi: st.saldi, ordina: st.ordina });
const gruppiPer = posto => GRUPPI.filter(g => !g.per || g.per(posto));
/** Toglie i filtri che non hanno senso nel nuovo posto (es. le maniche passando ai pantaloni). */
function adattaFiltri(st, posto) { const ok = new Set(gruppiPer(posto).map(g => g.k)); for (const k of CHIAVI) if (!ok.has(k)) st[k].clear(); }
// il colore stimato dalla foto (m) non entra nei filtri: le foto con modella e sfondo ingannano (Andrea 20/11: "nero" e uscivano abiti chiari)
const vicinoA = (c, hex) => !c.m && c.x && Math.hypot(...S.lab(c.x).map((v, i) => v - S.lab(hex)[i])) < 16;
const colorePassa = (c, v) => !c.m && c.x && Math.hypot(...S.lab(c.x).map((x, i) => x - LAB_FILTRO[v][i])) < 16;
/** Un valore del capo per un filtro (per contare e filtrare). */
function passaUno(c, k, v) {
  if (k === "colore") return colorePassa(c, v);
  if (k === "st") return S.stiliDi(c, DATI.negozi).has(v);
  if (k === "prezzo") return c.e >= FASCE[v][0] && c.e < FASCE[v][1];
  if (k === "marca") return c.n === +v;
  if (k === "r") return String(S.registro(c)) === v;
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
    `</div>` + htmlAttivi(st);
}
/** I filtri attivi come tessere da togliere una per una, più "Azzera". */
function htmlAttivi(st) {
  const voci = [];
  for (const k of CHIAVI) for (const v of st[k]) {
    const nome = k === "marca" ? DATI.negozi[+v].nome : k === "colore" ? v[0].toUpperCase() + v.slice(1) : NOMI_FILTRI[k]?.[v] ?? v;
    voci.push(`<button class="tessera-filtro" data-togli="${k}" data-v="${esc(v)}" aria-label="Togli ${esc(nome)}"${k === "marca" ? ' translate="no"' : ""}>${esc(nome)} <span aria-hidden="true">✕</span></button>`);
  }
  if (st.saldi) voci.push(`<button class="tessera-filtro" data-togli="saldi" aria-label="Togli In saldo">In saldo <span aria-hidden="true">✕</span></button>`);
  return voci.length ? `<div class="riga-filtri attivi">${voci.join("")}${voci.length > 1 ? `<button class="testo-link" data-filtri="via">Azzera</button>` : ""}</div>` : "";
}
/**
 * Gestisce un clic sulla riga dei filtri. Apre il pannello quando serve; `base()` dà la lista non filtrata,
 * `fatto()` ridisegna. Restituisce true se il clic era suo.
 */
function clicFiltri(e, st, posto, base, fatto) {
  const t = e.target.closest("[data-togli]");
  if (t) { if (t.dataset.togli === "saldi") st.saldi = false; else st[t.dataset.togli].delete(t.dataset.v); fatto(); return true; }
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
        `<section class="gruppo-filtri"><button class="testa-gruppo" data-saldi="1" aria-pressed="${bozza.saldi}"><span>Solo in saldo</span><small></small><i aria-hidden="true" class="levetta${bozza.saldi ? " su" : ""}"></i></button></section>`);
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
// sulle carte solo euro (giro 3: "kr 135 · circa 12 € · 25 € −52%" non si leggeva); la valuta del negozio resta nella scheda
const prezzoCarta = c => c.o ? `<span class="saldo">${euro(c.e)}</span> <s>${euro(c.o)}</s> <span class="saldo">−${Math.round(sconto(c) * 100)}%</span>` : (negozio(c).valuta === "EUR" ? euro(c.e) : `circa ${euro(c.e)}`);

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
    <span class="marca">${esc(negozio(c).nome)}</span><b>${esc(c.t)}</b><small>${coloreCarta(c)}${prezzoCarta(c)}</small>
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
        descrizione: p.description || "", colori,
        // tutte le foto del capo (Shopify le dà già qui): galleria nella scheda, senza rifare il catalogo
        foto: (p.images || []).slice(0, 8).map(u => (u.startsWith("//") ? "https:" + u : u)) };
    }
  } catch { esito = { stato: "ignoto" }; }
  // il prezzo vero è quello del sito adesso: il capo lo prende, così totali e carte non mentono (collaudo giro 4)
  if (esito.prezzoVivo != null && esito.prezzoVivo > 0 && Math.abs(esito.prezzoVivo - c.p) > 0.5) { c.e = Math.round(c.e * esito.prezzoVivo / c.p); c.p = esito.prezzoVivo; esito.aggiornato = true; }
  if (esito.stato === "sparito") { esclusi.add(k); sparitiSalvati[k] = Date.now(); try { localStorage.setItem(SPARITI, JSON.stringify(sparitiSalvati)); } catch {} }
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
    <div class="galleria" id="sc-galleria"><div class="foto"><img src="${foto(c, 900)}" alt="${esc(c.t)}"></div></div><div class="puntini" id="sc-puntini"></div>
    <div class="dettagli"><span class="marca">${esc(neg.nome)}</span><h3>${esc(c.t)}</h3><span class="riga" id="sc-prezzo">${prezzo(c)}</span>${colore ? `<span class="riga">${colore}</span>` : ""}
      ${neg.ue ? "" : `<span class="riga male">Spedito da fuori UE: possibili dazi alla consegna.</span>`}</div>
    <div class="vivo">${azioni}
      <div class="etichetta"><span>Taglie</span><span id="sc-ora">controllo sul sito…</span></div>
      <div class="taglie-vive" id="sc-taglie">…</div><div class="riga" id="sc-mia"></div>
      ${dentro || sola ? "" : `<button class="pieno" id="sc-metti">Indossa</button>`}
      <a class="vuoto" id="sc-sito" href="${linkCapo(c)}" target="_blank" rel="noopener">Vedi sul sito di ${esc(neg.nome)} ↗</a>
      <button class="vuoto salva-capo" id="sc-salva" aria-pressed="${capiSalvati.includes(S.chiave(c))}">${CUORE}<span> ${capiSalvati.includes(S.chiave(c)) ? "Salvato" : "Salva il capo"}</span></button></div>
    <div class="campo" id="sc-colori-box" hidden><div class="etichetta"><span>Colori</span><span>nella tua taglia</span></div><div class="colori-capo" id="sc-colori"></div></div>
    <div class="campo" id="sc-descr-box" hidden><div class="etichetta"><span>Descrizione</span></div><div class="descrizione" id="sc-descr"></div></div>
    ${dettagliCapo(c)}
    <div class="campo" id="sc-abbina-box" hidden><div class="etichetta"><span>Ci sta bene con</span><span id="sc-abbina-tot"></span></div><div class="abbina" id="sc-abbina"></div>
      <button class="vuoto" id="sc-abbina-metti">Indossa tutto il look</button></div>`, livello);
  const chiudi = () => { chiudiFoglio(2); chiudiFoglio(1); };
  const q = id => corpo.querySelector(id);
  // lo zoom vale sulla foto che si sta guardando
  q("#sc-galleria").querySelectorAll(".foto").forEach(f => pizzico(f, () => f.querySelector("img")));
  if (q("#sc-metti")) q("#sc-metti").onclick = () => { chiudi(); mostra("s-camerino"); indossa(c); };
  q("#sc-salva").onclick = () => salvaCapo(c, q("#sc-salva"));
  // abbinamenti: un capo per ogni altro posto, scelti dalle stesse regole del camerino (taglia, stile, colori, stagione)
  if (DATI && profilo.genere) {
    // il look intorno al capo si compone tutto insieme dentro il budget, col capo fermo (giro 6: scelti uno per uno sforavano)
    const fermo = new Set([p]), base_ = S.metti(S.outfitVuoto(), c).outfit;
    let look = S.componi(DATI.capi, { ...ctx(), profilo: { ...profilo, budget: Math.max(profilo.budget, c.e + 60) } }, base_, fermo, S.casuale(++seme)).outfit;
    if (S.mancanti(look).length) look = S.componi(DATI.capi, { ...ctx(), profilo: { ...profilo, budget: (profilo.budget + c.e) * 2 } }, base_, fermo, S.casuale(++seme)).outfit;
    const altri = S.capiDi(look).filter(k => S.chiave(k) !== S.chiave(c));
    if (altri.length) {
      q("#sc-abbina-box").hidden = false;
      q("#sc-abbina-tot").innerHTML = S.totale(look) > profilo.budget ? `<span class="male">look intero ${euro(S.totale(look))} · oltre il budget</span>` : `look intero ${euro(S.totale(look))}`;
      q("#sc-abbina").innerHTML = altri.map(k => `<button class="mini" data-k="${esc(S.chiave(k))}" aria-label="${esc(k.t)}"><span class="mini-foto"><img src="${foto(k, 240)}" alt=""></span><small translate="no">${esc(negozio(k).nome)}</small><span>${euro(k.e)}</span></button>`).join("");
      q("#sc-abbina").onclick = ev => { const b = ev.target.closest("[data-k]"); if (b) apriScheda(INDICE.get(b.dataset.k), 2, true); };
      q("#sc-abbina-metti").onclick = () => { const prima = outfit; outfit = look; bloccati.clear(); manca = []; largo = []; fuoriPal = []; ricorda(); chiudi(); mostra("s-camerino"); disegna(); toast("Look nel camerino", () => { outfit = prima; ricorda(); disegna(); }); };
    }
  }
  if (dentro) {
    q("#sc-cambia").onclick = () => apriCambia(p);
    q("#sc-blocca").onclick = () => { bloccati.has(p) ? bloccati.delete(p) : bloccati.add(p); ricorda(); disegnaPalco(); q("#sc-blocca").setAttribute("aria-pressed", bloccati.has(p)); q("#sc-blocca").textContent = bloccati.has(p) ? "Bloccato" : "Blocca"; if (bloccati.has(p)) toast("Resta quando chiedi un nuovo look"); };
    q("#sc-togli").onclick = () => { const prima = outfit; outfit = S.togli(outfit, p); bloccati.delete(p); ricorda(); disegna(); chiudi(); toast("Tolto", () => { outfit = prima; ricorda(); disegna(); }); };
  }
  const e = await verifica(c);
  if (!q("#sc-taglie")) return;
  const mia = S.tagliaPer(profilo, c), scala = c.c === "scarpe" ? S.NUMERI_SCARPE : S.TAGLIE;
  // galleria: le altre foto del capo, scorrendo di lato (puntini sotto)
  const altre = (e.foto || []).filter(u => !u.includes(c.i.replace(/^~/, "").split("?")[0].split("/").pop()));
  if (altre.length) {
    const g = q("#sc-galleria");
    g.insertAdjacentHTML("beforeend", altre.slice(0, 5).map(u => `<div class="foto"><img src="${esc(u + (u.includes("?") ? "&" : "?") + "width=900")}" alt="" loading="lazy"></div>`).join(""));
    g.querySelectorAll(".foto").forEach((f, i) => { if (i) pizzico(f, () => f.querySelector("img")); });
    const n = g.querySelectorAll(".foto").length;
    q("#sc-puntini").innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i ? "" : "su"}"></i>`).join("");
    g.onscroll = () => { const i = Math.round(g.scrollLeft / Math.max(1, g.clientWidth)); q("#sc-puntini").querySelectorAll("i").forEach((x, j) => x.classList.toggle("su", j === i)); };
  }
  let scelta = null;     // taglia toccata (se diversa dalla mia)
  const aggiornaCompra = () => {
    const v = scelta ? e.taglie.get(scelta) : null;
    q("#sc-sito").href = v ? linkCapo(c, { variante: v.id }) : linkCapo(c, mia ? e : null);
    q("#sc-sito").textContent = v ? `Compra in ${scelta} su ${neg.nome} ↗` : (mia && e.stato === "ok" ? `Compra in ${e.unica ? "taglia unica" : mia} su ${neg.nome} ↗` : `Vedi sul sito di ${neg.nome} ↗`);
  };
  if (e.taglie) {
    const ordine = [...e.taglie.keys()].sort((a, b) => scala.indexOf(a) - scala.indexOf(b));
    // ogni taglia è un pulsante: si può comprare anche in un'altra taglia (Baymard: pulsanti, finite barrate)
    q("#sc-taglie").innerHTML = ordine.map(t => { const si = e.taglie.get(t).available;
      return `<button class="${si ? "si" : "no"}${t === mia ? " mia" : ""}" data-t="${esc(t)}" ${si ? "" : "disabled"} aria-pressed="false" aria-label="${esc(t)}${si ? "" : ", finita"}${t === mia ? ", la tua taglia" : ""}">${t}</button>`; }).join("") || "Guarda le taglie sul sito.";
    q("#sc-taglie").onclick = ev => { const b = ev.target.closest("button[data-t]"); if (!b || b.disabled) return;
      scelta = scelta === b.dataset.t || b.dataset.t === mia ? null : b.dataset.t;
      q("#sc-taglie").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x.dataset.t === (scelta || ""))); aggiornaCompra(); };
    q("#sc-ora").textContent = "aggiornate alle " + new Date().toLocaleTimeString("it", { hour: "2-digit", minute: "2-digit" });
    if (e.aggiornato) q("#sc-prezzo").innerHTML = `${prezzo(c)} · <small>prezzo aggiornato dal sito</small>`;
  } else { q("#sc-taglie").textContent = ""; q("#sc-ora").textContent = ""; }
  q("#sc-mia").innerHTML = mia || e.stato === "sparito" ? fraseTaglia(c, e) : "";
  // la mia taglia è finita o non c'è: dire quali ci sono e proporre capi simili nella mia taglia
  if (mia && (e.stato === "esaurita" || e.stato === "non-prodotta") && !sola) {
    const altreT = e.taglie ? [...e.taglie].filter(([, v]) => v.available).map(([t]) => t) : [];
    q("#sc-mia").innerHTML = `<span class="male">La tua ${esc(mia)} ${e.stato === "esaurita" ? "è finita" : "non c'è"}.</span>${altreT.length ? ` Disponibili: ${altreT.map(esc).join(", ")}.` : ""}
      <button class="testo-link" id="sc-simili">Vedi simili nella tua taglia</button>`;
    q("#sc-simili").onclick = () => { if (dentro) return apriCambia(p); chiudi(); reparto = p; sottoScopri = S.sottoDi(c, p) || ""; soloTaglia = true; mostra("s-scopri"); scopri(); };
  }
  aggiornaCompra();
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
      const altro = INDICE.get(`${c.dom}|${c.h}|${x.nome}`), questo = x.nome === c.v;
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
    c.q && ["Fantasia", NOMI_FILTRI.q[c.q]], c.a && ["Vestibilità", NOMI_FILTRI.a[c.a]], c.z && ["Scollo", NOMI_FILTRI.z[c.z]],
    c.b && ["Forma", NOMI_FILTRI.b[c.b]], c.j && ["Vita", NOMI_FILTRI.j[c.j]], DATI && ["Stile", [...S.stiliDi(c, DATI.negozi)].slice(0, 3).join(", ")]].filter(Boolean);
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
// parole intere: "coat" non deve prendere "coated", "pelle" non "repellent" (collaudo giro 1)
const TRADUCI = { pelle: /\b(leather|cuir|pelle|leder)\b/, seta: /\b(silk|soie|seta|satin)\b/, lino: /\b(linen|lin|lino)\b/, lana: /\b(wool|woolen|laine|lana|merino)\b/, cashmere: /\b(cashmere|cachemire)\b/, cotone: /\b(cotton|coton|cotone)\b/,
  velluto: /\b(velvet|velours|velluto|corduroy)\b/, pizzo: /\b(lace|dentelle|pizzo)\b/, lungo: /\b(long|maxi|lung\w*)\b/, corto: /\b(mini|short|cropped|cort\w*)\b/, cappotto: /\b(coats?|overcoat|manteau|cappott\w*|abrigo)\b/, blazer: /\bblazers?\b/, trench: /\btrench/,
  piumino: /\b(puffer|padded|down|doudoune|piumin\w*)\b/, cardigan: /\bcardigans?\b/, felpa: /\b(sweatshirts?|hoodies?|felpa)\b/, stivali: /\b(boots?|bottes?|bottines?|stival\w*)\b/, sneakers: /\b(sneakers?|trainers?|baskets?)\b/, sandali: /\bsandal/ };
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
let reparto = "sopra", sottoScopri = "", listaScopri = [], mostratiScopri = 0, soloTaglia = true;
const filtriScopri = nuoviFiltri();
/** I capi del reparto senza i filtri (per contarli nel pannello). Con una ricerca scritta: i risultati della ricerca. */
function baseScopri() {
  const testo = $("c-q").value.trim();
  if (testo) return ricercaScopri;
  const vaBene = c => !esclusi.has(S.chiave(c)) && !(profilo.genere === "u" && (c.c === "abito" || c.c === "gonna"));
  const base = soloTaglia ? S.alternative(DATI.capi, ctx(), outfit, reparto, Infinity) : DATI.capi.filter(c => S.postoDi(c) === reparto && vaBene(c));
  return sottoScopri ? base.filter(c => S.sottoDi(c, reparto) === sottoScopri) : base;
}
/** La riga delle sottocategorie del reparto, con quanti capi (solo quelle che ne hanno). */
function htmlSotto() {
  const l = S.SOTTOCATEGORIE[reparto]; if (!l) return "";
  const prima = sottoScopri; sottoScopri = "";
  const base = baseScopri(); sottoScopri = prima;
  const n = {}; for (const c of base) { const k = S.sottoDi(c, reparto); n[k] = (n[k] || 0) + 1; }
  const voci = l.filter(([k]) => n[k] && !(profilo.genere === "u" && ["decollete", "ballerine"].includes(k)));
  if (voci.length < 2) return "";
  return `<div class="sotto-cat" role="group" aria-label="Tipo">${[["", "Tutto", base.length], ...voci.map(([k, nome]) => [k, profilo.genere === "u" && k === "canotte" ? "Canotte" : nome, n[k]])]
    .map(([k, nome, q]) => `<button class="piccolo" data-s="${k}" aria-pressed="${k === sottoScopri}"><span>${nome}</span> <small>${q.toLocaleString("it")}</small></button>`).join("")}</div>`;
}
let ricercaScopri = [];
function scopri() {
  const reparti = REPARTI.filter(r => !r[2] || r[2] === profilo.genere), testo = $("c-q").value.trim();
  $("c-filtri").innerHTML = `<div class="riga-filtri">${testo ? "" : reparti.map(r => `<button class="piccolo" data-r="${r[0]}" aria-pressed="${r[0] === reparto}">${r[1]}</button>`).join("")}` +
    `<button class="piccolo" data-t="1" aria-pressed="${soloTaglia}">${soloTaglia ? "✓ " : ""}La mia taglia</button></div>` + (testo ? "" : htmlSotto()) + htmlFiltri(filtriScopri, testo ? "abito" : reparto);
  const vaBene = c => !esclusi.has(S.chiave(c)) && (!soloTaglia || S.haTaglia(c, profilo)) && !(profilo.genere === "u" && (c.c === "abito" || c.c === "gonna"));
  if (testo) {
    const q = capisci(testo), ql = q.hex ? S.lab(q.hex) : null;
    const capito = [q.cat, q.colore, ...q.parole.filter(w => w !== q.cat), q.negozio >= 0 ? DATI.negozi[q.negozio].nome : null, q.max ? `fino a ${euro(q.max)}` : null].filter(Boolean);
    ricercaScopri = !capito.length ? [] : DATI.capi.filter(c => vaBene(c) && (!q.cat || c.c === q.cat) && (q.negozio < 0 || c.n === q.negozio) && (!q.max || c.e <= q.max)
      && (!ql || (c.x && Math.hypot(...S.lab(c.x).map((v, i) => v - ql[i])) < 16)) && q.parole.every(w => TRADUCI[w].test(c.t.toLowerCase())))
      .sort((a, b) => (S.distPalette(a, profilo.stagione) ?? 50) - (S.distPalette(b, profilo.stagione) ?? 50));
    listaScopri = applicaFiltri(ricercaScopri, filtriScopri);
    $("c-conta").textContent = capito.length ? `${capito.join(" · ")} — ${listaScopri.length.toLocaleString("it")} capi` : "";
    if (!capito.length) {
      mostratiScopri = 0; $("c-griglia").innerHTML = `<div class="niente"><p>Non so ancora cercare così. Qui capisco un capo, un colore, un prezzo o un marchio (es. "cappotto nero sotto 300").</p>
        <p>Per una frase come la tua c'è lo stylist.</p><button class="pieno" id="c-allo-stylist">Chiedilo allo stylist</button></div>`;
      $("c-allo-stylist").onclick = () => { bozzaStylist = testo; apriStylist(); };
      return;
    }
  } else {
    // senza ricerca: i capi del reparto; con "la mia taglia", prima quelli che stanno bene col look di adesso
    listaScopri = applicaFiltri(baseScopri(), filtriScopri);
    $("c-conta").textContent = `${listaScopri.length.toLocaleString("it")} capi${soloTaglia ? " nella tua taglia" : ""}`;
  }
  mostratiScopri = 0; $("c-griglia").innerHTML = ""; $("c-griglia").parentElement.scrollTop = 0;
  if (!listaScopri.length) {
    const filtri = quantiFiltri(filtriScopri);
    $("c-griglia").innerHTML = `<div class="niente"><p>${filtri ? "Niente con questi filtri" : "Niente"}${soloTaglia ? " nella tua taglia" : ""}.</p>${filtri ? `<p>Prova a togliere un filtro qui sopra.</p><button class="vuoto" data-filtri="via">Togli tutti i filtri</button>` : soloTaglia ? `<button class="vuoto" data-t="1">Mostra anche le altre taglie</button>` : ""}</div>`;
  } else altriScopri();
}
function altriScopri() {
  $("c-griglia").querySelector(".altri")?.remove();
  const l = listaScopri.slice(mostratiScopri, mostratiScopri + 30); mostratiScopri += l.length;
  $("c-griglia").insertAdjacentHTML("beforeend", l.map(c => { const k = S.chiave(c), su = capiSalvati.includes(k);
    return `<div class="carta-box"><button class="carta" data-k="${esc(k)}"><img src="${foto(c)}" alt="" loading="lazy"><span class="marca">${esc(negozio(c).nome)}</span><b>${esc(c.t)}</b><small>${coloreCarta(c)}${prezzoCarta(c)}</small></button>
      <button class="cuore-carta" data-cuore="${esc(k)}" aria-pressed="${su}" aria-label="${su ? "Togli dai salvati" : "Salva il capo"}">${CUORE}</button></div>`; }).join("") + (mostratiScopri < listaScopri.length ? `<button class="vuoto altri">Altri</button>` : ""));
}
$("c-form").onsubmit = e => { e.preventDefault(); $("c-q").blur(); Object.assign(filtriScopri, nuoviFiltri()); scopri(); };   // una nuova ricerca parte pulita (giro 2: restava filtrata per scollo)
$("c-q").addEventListener("search", () => { if (!$("c-q").value) scopri(); });
$("c-filtri").onclick = e => {
  if (clicFiltri(e, filtriScopri, $("c-q").value.trim() ? "abito" : reparto, baseScopri, scopri)) return;
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.r) { if (reparto !== b.dataset.r) sottoScopri = ""; reparto = b.dataset.r; adattaFiltri(filtriScopri, reparto); }
  else if (b.dataset.s != null) sottoScopri = b.dataset.s === sottoScopri ? "" : b.dataset.s;
  else if (b.dataset.t) soloTaglia = !soloTaglia; else return;
  scopri();
};
$("c-griglia").onclick = e => {
  const cu = e.target.closest("[data-cuore]");
  if (cu) { const k = cu.dataset.cuore, i = capiSalvati.indexOf(k); if (i >= 0) capiSalvati.splice(i, 1); else capiSalvati.unshift(k); ricorda();
    cu.setAttribute("aria-pressed", i < 0); cu.setAttribute("aria-label", i < 0 ? "Togli dai salvati" : "Salva il capo"); toast(i < 0 ? "Capo salvato" : "Tolto dai salvati"); return; }
  if (e.target.closest("[data-filtri='via']")) { Object.assign(filtriScopri, nuoviFiltri(), { ordina: filtriScopri.ordina }); return scopri(); }
  if (e.target.closest("[data-t]")) { soloTaglia = false; return scopri(); }
  if (e.target.closest(".altri")) return altriScopri(); const b = e.target.closest(".carta"); if (b) apriScheda(INDICE.get(b.dataset.k)); };

// ======================================================================
// IL TUO AVATAR — modelli pronti, dalla tua foto, personaggio inventato
// ======================================================================
// nomi che dicono com'è il modello (giro 1, F1: "Modello 1, 2, 3" non diceva nulla)
const MODELLI = { d: [["avatar_front", "Rossa, capelli lunghi"], ["avatar_mod_d1", "Castana, liscia"], ["avatar_mod_d2", "Ricci, curvy"], ["avatar_mod_d3", "Bionda, capelli raccolti"]],
  u: [["avatar_uomo_front", "Castano, barba"], ["avatar_mod_u1", "Biondo"], ["avatar_mod_u2", "Rasato"], ["avatar_mod_u3", "Ricci"]] };
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
let fotoViso = null, fotoIntera = null, appenaCreato = null, passoFoto = 1;
let scelte = { tipo: "umano", animale: "gatto", corpo: "media", colore: "c3", capelli: "corti", tinta: "castano", stile: "realistico" }, schedaAvatar = "modelli", creando = false;

function usaAvatar(a) {
  profilo.avatar = a;
  if (a && a.creato && !profilo.avatari.some(x => x.url === a.url)) profilo.avatari = [a, ...profilo.avatari].slice(0, 8);
  vistaAvatar = 0; vistaGiro = 0; vestito = true; ricorda(); if (!$("s-camerino").hidden) disegna();
  if (a?.url) preparaViste(a.url);
}
async function chiediAvatar(corpo) {
  const d = await chiediPulita("/avatar", { genere: profilo.genere, ...corpo });
  if (d.errore !== undefined || !d.url) throw new Error(d.errore || "Non ci sono riuscito. Riprova.");
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
      html = `<div class="griglia">${MODELLI[g].map(([f, n], i) => i === 0 ? base(f, n) : carta(BASE_AVATAR + f + ".jpg", n, attuale === BASE_AVATAR + f + ".jpg")).join("")}</div>` +
        (miei.length ? `<div class="etichetta" style="margin:18px 0 8px"><span>Creati da te</span></div><div class="griglia">${miei.map(a => carta(a.url, a.nome, attuale === a.url)).join("")}</div>` : "");
    }
    if (schedaAvatar === "foto") {
      const su = profilo.su || (profilo.su = {});
      const riga = k => `<div class="campo"><div class="etichetta"><span>${NOMI_SU[k]}</span>${k === "capelli" ? "<small class=\"serve\">serve</small>" : "<small>se vuoi</small>"}</div>
        <div class="scelte" data-su="${k}">${SU[k].map(([v, n]) => `<button data-v="${v}" aria-pressed="${su[k] === v}">${n}</button>`).join("")}</div></div>`;
      const anteprima = (f, nome, id) => `<label class="foto-scelta${f ? " piena" : ""}">${f ? `<img src="${f}" alt="">` : `<span>+</span>`}<small>${nome}</small><input type="file" id="${id}" accept="image/*" hidden ${creando ? "disabled" : ""}></label>`;
      const pronto = fotoViso && su.capelli;
      // tre passi, uno alla volta (giro 1–3, F2): il viso, la figura intera se vuoi, come sei
      const pf = Math.min(passoFoto, fotoViso ? 3 : 1);
      const testa = `<div class="passi-foto"><small>${pf} di 3</small><div class="barra"><i style="width:${pf / 3 * 100}%"></i></div></div>`;
      html = (appenaCreato ? `<div class="appena"><img src="${esc(appenaCreato)}" alt="Il tuo avatar"><div>
          <p style="margin:0 0 8px">Ti somiglia? Se no, correggi una cosa alla volta:</p>
          <div class="scelte" id="av-ritocchi">${RITOCCHI.map(([k, n]) => `<button data-r="${k}" ${creando ? "disabled" : ""}>${n}</button>`).join("")}</div>
          ${creando ? `<p class="note">Lo sto correggendo…</p>` : ""}</div></div>` : "") + testa + (pf === 1 ? `<div class="dettagli" style="gap:10px;font-size:14px">
          <h3 style="margin:0">Il viso</h3>
          <ul class="consigli"><li>Di fronte, sguardo in camera</li><li>Luce del giorno, niente controluce</li><li>Senza occhiali da sole né cappello</li><li>Da sola o da solo nella foto</li></ul>
          <div class="foto-due">${anteprima(fotoViso, "Viso", "av-viso")}</div>
          <p class="note" style="margin:0">La foto va al servizio che crea l'avatar (fal.ai) e noi non la conserviamo. L'avatar creato resta salvato sul nostro server per un anno.</p></div>
          <button class="pieno" data-pf="2" ${fotoViso ? "" : "disabled"}>${fotoViso ? "Avanti" : "Scegli la foto del viso"}</button>`
        : pf === 2 ? `<div class="dettagli" style="gap:10px;font-size:14px">
          <h3 style="margin:0">Figura intera <small style="color:var(--ink-3);font-weight:400">· se vuoi</small></h3>
          <p style="margin:0">In piedi, dalla testa ai piedi, con vestiti aderenti: l'avatar ti somiglierà di più nelle proporzioni.</p>
          <div class="foto-due">${anteprima(fotoIntera, "Figura intera", "av-intera")}</div></div>
          <div class="tre" style="grid-template-columns:1fr 1fr"><button class="vuoto" data-pf="1">Indietro</button><button class="pieno" data-pf="3">${fotoIntera ? "Avanti" : "Salta"}</button></div>`
        : `<h3 style="margin:0 0 4px">Come sei</h3>
          <p class="note" style="margin:0 0 6px">Conta più della foto: se in foto hai i capelli raccolti o la luce inganna, qui dici come sei.</p>
          ${riga("capelli")}${riga("corpo")}
          <details class="sezione altro-su"${su.tinta || su.ricci || su.altezza ? " open" : ""}><summary><span>Altro</span><small>colore e tipo di capelli, altezza · se vuoi</small></summary><div class="sezione-corpo">
          ${riga("tinta")}${riga("ricci")}
          <div class="campo"><div class="etichetta"><span>Altezza</span><small>se vuoi</small></div><input type="number" id="av-altezza" inputmode="numeric" min="130" max="215" placeholder="cm" value="${su.altezza || ""}" style="width:110px"></div></div></details>
          <p class="note" style="margin:4px 0 10px">Uso anche le taglie del tuo profilo (${esc(profilo.tagliaSopra || "–")} sopra, ${esc(profilo.tagliaSotto || "–")} sotto) per le proporzioni.</p>
          <div class="tre" style="grid-template-columns:auto 1fr"><button class="vuoto" data-pf="2">Indietro</button>
          <button class="pieno" id="av-da-foto" ${pronto && !creando ? "" : "disabled"}>${creando ? "Lo sto creando…" : !su.capelli ? "Scegli i capelli" : "Crea il mio avatar · circa 20 s"}</button></div>
          <div id="av-esito"></div>`);
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
    const pfb = e.target.closest("[data-pf]"); if (pfb && !pfb.disabled) { passoFoto = +pfb.dataset.pf; corpo.scrollTop = 0; return disegnaScheda(); }
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
// le regole sono in richiesta.js (provate con node: v2/richiesta.test.js)
const lookPerRichiesta = r => R.lookPerRichiesta(r, { profilo, negozi: DATI.negozi, capi: DATI.capi, esclusi, rnd: S.casuale(++seme) });
const NOMI_EN = { capospalla: "jacket", sopra: "top", sotto: "bottom", scarpe: "shoes", abito: "dress" };
/** Il commento dell'app sotto la risposta dello stylist: corto, vero, dai numeri del look. */
function notaLook(l, r, en) {
  const T = (it, eng) => en ? eng : it;
  const nomi = ps => { const n = ps.map(p => en ? NOMI_EN[p] : S.NOME_POSTO[p].toLowerCase()); const t = n.length > 1 ? n.slice(0, -1).join(", ") + T(" e ", " and ") + n.at(-1) : n[0]; return t[0].toUpperCase() + t.slice(1); };
  const tot = S.totale(l.outfit), righe = [];
  if (l.sforato) righe.push(T(`${euro(tot)}: ${euro(tot - l.budget)} sopra il tuo budget, perché i capi che volevi costano di più.`, `${euro(tot)}: ${euro(tot - l.budget)} over your budget, because the pieces you wanted cost more.`));
  else righe.push(r.budget ? T(`${euro(tot)}, nel tetto di ${euro(l.budget)}.`, `${euro(tot)}, within ${euro(l.budget)}.`)
    : T(`${euro(tot)}, nel tuo budget di ${euro(l.budget)}.`, `${euro(tot)}, within your ${euro(l.budget)} budget.`));
  if (l.allargati.length) righe.push(T(`${nomi(l.allargati)}: quello che chiedi non c'era nella tua taglia, ho messo il più vicino.`, `${nomi(l.allargati)}: what you asked for wasn't in your size, I picked the closest.`));
  if (l.diverso.length) righe.push(T(`${nomi(l.diverso)}: il colore esatto non c'era, ho messo il più vicino.`, `${nomi(l.diverso)}: the exact colour wasn't there, I picked the closest.`));
  if (l.assenti?.length) righe.push(T(`Attenzione: ${nomi(l.assenti).toLowerCase()} che chiedi non c'è nella tua taglia in questo momento, quindi il look ne è senza.`, `Note: there's no ${nomi(l.assenti).toLowerCase()} like that in your size right now, so the look is without it.`));
  return righe.join(" ");
}
// scorciatoie sotto una risposta con un look: cambiano SOLO quello che dicono, qui nel telefono, senza richiamare il modello
// (giro 2: "Cambia le scarpe" rifaceva tutto il look e "Meno spesa" costava di più)
const SCORCIATOIE = [["elegante", "Più elegante", "More elegant"], ["risparmio", "Meno spesa", "Spend less"], ["scarpe", "Cambia le scarpe", "Other shoes"], ["colore", "Altro colore", "Other colour"]];
function affina(look, azione, richiesta) {
  // il tetto è quello scelto in chat se c'è (giro 8: dopo "Fino a 200 €", "Più elegante" dava 295 €)
  const budget = richiesta?.budget ? Math.max(richiesta.budget, Math.min(S.totale(look), richiesta.budget)) : Math.max(profilo.budget, S.totale(look));
  // stesso tipo di capo (camicia resta camicia), prodotto diverso, d'inverno niente gilet come giacca
  // ciò che si era chiesto in chat resta valido (giro 3: dopo "stivali neri", "Cambia le scarpe" dava ballerine); lo stile si allarga, il colore solo per "Altro colore"
  const rr = richiesta ? { ...richiesta, stili: [], ...(azione === "colore" ? Object.fromEntries(["sopra", "sotto", "abito_dettagli", "giacca_dettagli"].map(k => [k, richiesta[k] && { ...richiesta[k], colori: [] }])) : {}) } : null;
  let largo_ = false;
  // allargando si tiene il tipo di capo chiesto (stivali restano stivali), cadono colore, materiale ed eleganza stretta
  const soloTipo = x => x && { tipo: x.tipo };
  const rrTipo = rr && { abito: rr.abito, sopra: soloTipo(rr.sopra), sotto: soloTipo(rr.sotto), scarpe: soloTipo(rr.scarpe), giacca_dettagli: soloTipo(rr.giacca_dettagli), abito_dettagli: null };
  const altri0 = (o, p, entro, ok, conR) => S.alternative(DATI.capi, ctx(), o, p, entro).filter(c => c.e <= entro && !S.fuoriStagione(c, profilo.freddo) && c.h !== o[p].h && c.c === o[p].c
    && (!rr || R.vaPerRichiesta(c, conR ? rr : rrTipo, DATI.negozi))
    && !(p === "capospalla" && profilo.freddo && /gilet|\bvest\b|waistcoat|chaleco|sleeveless/i.test(c.t)) && ok(c));
  // prima con la richiesta della chat; se non c'è niente si allarga (giro 6 uomo: "non trovo di meglio" a ogni scorciatoia)
  const altri = (o, p, entro, ok) => { const l = altri0(o, p, entro, ok, true); if (l.length || !rr) return l; const l2 = altri0(o, p, entro, ok, false); if (l2.length) largo_ = true; return l2; };
  const simile = (l, x) => l.find(c => c.e >= x * 0.7 - 10 && c.e <= x * 1.3 + 10) || l[0];
  let o = { ...look }; const posti = ["capospalla", "sopra", "sotto", "abito", "scarpe"].filter(p => o[p]);
  if (azione === "scarpe") {   // prezzo simile prima di tutto (giro 3: 95 € → 230 €)
    if (!o.scarpe) return null; const l = altri(o, "scarpe", budget - S.totale(o) + o.scarpe.e, () => true);
    const a = simile(l, o.scarpe.e); if (!a) return null; o = S.metti(o, a).outfit; }
  else if (azione === "elegante") {
    let cambiati = 0;
    for (const p of posti) { const r = S.registro(o[p]); if (r >= 3) continue;
      const tuta = S.nomeCapo(o[p], p) === "Tuta";
      const a = altri(o, p, budget - S.totale(o) + o[p].e, c => S.registro(c) > r && !R.RX_NON_ELEGANTE.test(c.t) && (p === "scarpe" || !R.RX_SPORT.test(c.t)) && !c.q && (S.nomeCapo(c, p) === "Tuta") === tuta)[0];
      if (a) { o = S.metti(o, a).outfit; cambiati++; } }
    if (!cambiati) return null;
  } else if (azione === "risparmio") {
    const meta = S.totale(look) * 0.75;
    for (const p of [...posti].sort((a, b) => o[b].e - o[a].e)) { if (S.totale(o) <= meta) break;
      const r0 = S.registro(o[p]), a = altri(o, p, o[p].e * 0.7, c => S.registro(c) >= r0)[0]; if (a) o = S.metti(o, a).outfit; }   // giro 6: meno spesa, stesso livello
    if (S.totale(o) >= S.totale(look)) return null;
  } else if (azione === "colore") {
    const p = ["abito", "sopra", "capospalla", "sotto"].find(x => o[x]); if (!p) return null;
    const lontano = c => !o[p].x || !c.x || Math.hypot(...S.lab(c.x).map((v, i) => v - S.lab(o[p].x)[i])) > 25;
    // altro colore: prima lo stesso capo in un altro colore (se il negozio lo ha), poi un capo simile di un altro colore
    const stesso = DATI.capi.find(c => c.h === o[p].h && c.n === o[p].n && c.v !== o[p].v && lontano(c) && S.haTaglia(c, profilo));
    const simili = altri(o, p, budget - S.totale(o) + o[p].e, lontano);
    const a = stesso || simile(simili, o[p].e); if (!a) return null; o = S.metti(o, a).outfit;
    o.__nota = stesso ? "stesso" : "simile";
  }
  if (largo_) o.__largo = true;
  return o;
}
function apriStylist() {
  const corpo = apriFoglio("Stylist", "");
  const disegnaChat = () => {
    const esempi = profilo.genere === "u" ? ["Un look da ufficio sotto 300 €", "Qualcosa per una cena, scarpe nere", "Weekend in montagna"] : ["Un look da ufficio sotto 300 €", "Una cena elegante, stivali neri", "Jeans e maglione di lana per il weekend"];
    const ultimoLook = chat.map(m => !!m.capi).lastIndexOf(true);
    corpo.innerHTML = `<div class="chat" id="chat">${chat.length ? chat.map((m, i) => {
        const capi = m.capi ? m.capi.map(k => INDICE.get(k)).filter(Boolean) : [];
        return `<div class="msg ${m.chi}${m.errore ? " errore" : ""}"><p translate="no">${esc(m.testo)}</p>${capi.length ? `
          <div class="strip">${capi.map(c => `<button class="mini" data-capo="${esc(S.chiave(c))}" aria-label="${esc(c.t)}"><span class="mini-foto"><span class="posto" translate="no">${m.en ? ({ capospalla: "Jacket", sopra: "Top", sotto: "Bottom", scarpe: "Shoes", abito: S.nomeCapo(c) === "Tuta" ? "Jumpsuit" : "Dress" })[S.postoDi(c)] : S.nomeCapo(c)}</span><img src="${foto(c, 240)}" alt=""></span><small translate="no">${esc(negozio(c).nome)}</small><span>${euro(c.e)}</span></button>`).join("")}</div>
          ${m.nota ? `<p class="nota" translate="no">${esc(m.nota)}</p>` : ""}${(() => { let o = S.outfitVuoto(); for (const c of capi) o = S.metti(o, c).outfit; return rigaUnica(rigaChiesto(o, m.richiesta, m.en, true), rigaPerche(o, Math.max(profilo.budget, S.totale(o)), true, m.en)); })()}
          <div class="azioni-look" translate="no"><button class="pieno piccolo" data-rimetti="${i}">${m.en ? "Wear this look" : "Indossa questo look"}</button><span class="suggerimento">${m.en ? "Tap a piece to see it" : "Tocca un capo per vederlo"}</span></div>
          ${i === ultimoLook && !pensando ? `<div class="scorciatoie" translate="no">${SCORCIATOIE.map(([k, it, en]) => `<button class="piccolo" data-affina="${k}" data-i="${i}">${esc(m.en ? en : it)}</button>`).join("")}</div>
            ${m.richiesta && !m.richiesta.budget ? `<div class="scorciatoie budget-veloce" translate="no"><small>${m.en ? "Budget:" : "Budget:"}</small>${[100, 200, 300, 500].map(b => `<button class="piccolo" data-budget="${b}" data-i="${i}">${m.en ? "up to" : "fino a"} ${euro(b)}</button>`).join("")}</div>` : ""}` : ""}` : ""}
          ${m.errore ? `<button class="piccolo" data-riprova="${esc(m.riprova)}">Riprova</button>` : ""}
          ${m.alza ? `<div class="scorciatoie" translate="no"><button class="piccolo" data-budget="${m.alza.budget}" data-i="${i}">${m.en ? "Raise to" : "Alzo a"} ${euro(m.alza.budget)}</button></div>` : ""}</div>`; }).join("")
      : `<p class="sotto" style="margin:0 0 10px">Scrivi cosa cerchi: l'occasione, i colori, un capo, il budget. Compongo il look con capi veri, nella tua taglia.</p><div class="esempi">${esempi.map(x => `<button class="piccolo" data-esempio>${esc(x)}</button>`).join("")}</div>`}
      ${pensando ? `<div class="msg stylist"><p class="attesa-testo"><span class="puntini-attesa" aria-hidden="true"><i></i><i></i><i></i></span> Sto scegliendo i capi…</p></div>` : ""}</div>
      <form class="cerca chat-form" id="chat-form"><input id="chat-q" autocomplete="off" placeholder="Scrivi qui…" aria-label="Scrivi allo stylist" ${pensando ? "disabled" : ""}><button aria-label="Invia" ${pensando ? "disabled" : ""}>→</button></form>`;
    corpo.scrollTop = corpo.scrollHeight;
    corpo.querySelector("#chat-form").onsubmit = e => { e.preventDefault(); manda(corpo.querySelector("#chat-q").value); };
    if (bozzaStylist) { corpo.querySelector("#chat-q").value = bozzaStylist; bozzaStylist = ""; }
  };
  const manda = async testo => {
    testo = testo.trim(); if (!testo || pensando) return;
    chat.push({ chi: "io", testo }); pensando = true; disegnaChat();
    const lento = setTimeout(() => { const t = corpo.querySelector(".attesa-testo"); if (t) t.lastChild.textContent = " " + tr("Ci sto mettendo un po' più del solito…"); }, 7000);
    const sbaglio = (msg) => chat.push({ chi: "stylist", testo: msg, errore: true, riprova: testo });
    try {
      let r;
      try { r = await fetch(SERVER + "/chiedi", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ testo, genere: profilo.genere, budget: profilo.budget, lingua: LINGUA, storia: testo.split(/\s+/).length <= 6 ? ultimaRichiesta : null }) }); }   // solo i seguiti brevi ereditano la richiesta di prima
      catch { sbaglio(tr("Non riesco a collegarmi. Controlla la connessione e riprova.")); return; }
      const d = await r.json().catch(() => ({}));
      if (r.status === 429) { chat.push({ chi: "stylist", testo: d.messaggio || tr("Per oggi lo stylist ha risposto a tante domande. Torna domani.") }); return; }   // limite: "Riprova" non servirebbe
      if (!r.ok || !d.richiesta) { sbaglio(d.messaggio || tr("Non ci sono riuscito. Riprova tra poco.")); return; }
      const en = d.lingua ? d.lingua !== "it" : LINGUA === "en";
      // "grazie", "ciao", una domanda di stile: si risponde a parole, senza rifare il look (giro 1: "grazie" dava di nuovo il look)
      if (d.tipo === "chiacchiera" || d.tipo === "domanda") { chat.push({ chi: "stylist", testo: d.risposta || (en ? "You're welcome!" : "Figurati!") }); return; }
      if (d.tuta) d.richiesta.tuta = true;
      ultimaRichiesta = d.richiesta;
      const l = lookPerRichiesta(d.richiesta), capi = S.capiDi(l.outfit);
      if (!capi.length) { chat.push({ chi: "stylist", testo: (d.risposta ? d.risposta + " " : "") + (en ? "But I can't find pieces in your size for this. Try something a bit broader." : "Però non trovo capi nella tua taglia per questa richiesta. Prova con qualcosa di più largo.") }); return; }
      // il look si propone qui; nel camerino entra con "Indossa questo look" (si può confrontare con quello di prima)
      chat.push({ richiesta: d.richiesta, chi: "stylist", testo: l.assenti.length ? (en ? "Here's what I found." : "Ecco cosa ho trovato.") : (d.risposta || (en ? "Here's the look." : "Ecco il look.")), nota: notaLook(l, d.richiesta, en), capi: capi.map(S.chiave), en });
    } finally { clearTimeout(lento); pensando = false; disegnaChat(); }
  };
  disegnaChat();
  corpo.onclick = e => {
    const es = e.target.closest("[data-esempio]"); if (es) return manda(es.textContent);
    const bv = e.target.closest("[data-budget]");
    if (bv) {   // stessa richiesta con un tetto diverso, composta qui senza richiamare il modello (giro 7)
      const m = chat[+bv.dataset.i], b = +bv.dataset.budget, en = m.en, T = (it, eng) => en ? eng : it, r = { ...m.richiesta, budget: b };
      chat.push({ chi: "io", testo: T(`Fino a ${euro(b)}`, `Up to ${euro(b)}`) });
      const l = lookPerRichiesta(r), capi = S.capiDi(l.outfit);
      if (!capi.length) chat.push({ chi: "stylist", testo: T("Con questo budget non trovo capi nella tua taglia.", "I can't find pieces in your size with this budget.") });
      else chat.push({ richiesta: r, chi: "stylist", testo: T("Ecco.", "Here you go."), nota: notaLook(l, r, en), capi: capi.map(S.chiave), en });
      return disegnaChat();
    }
    const af = e.target.closest("[data-affina]");
    if (af) {
      const m = chat[+af.dataset.i]; let look = S.outfitVuoto(); for (const k of m.capi) { const c = INDICE.get(k); if (c) look = S.metti(look, c).outfit; }
      const nuovo = affina(look, af.dataset.affina, m.richiesta), en = m.en, T = (it, eng) => en ? eng : it;
      const detto = { elegante: T("Più elegante", "More elegant"), risparmio: T("Meno spesa", "Spend less"), scarpe: T("Altre scarpe", "Other shoes"), colore: T("Altro colore", "Other colour") }[af.dataset.affina];
      chat.push({ chi: "io", testo: detto });
      if (!nuovo && af.dataset.affina === "elegante" && m.richiesta?.budget) chat.push({ chi: "stylist", testo: T(`Dentro i ${euro(m.richiesta.budget)} non trovo niente di più elegante nella tua taglia.`, `Within ${euro(m.richiesta.budget)} I can't find anything more elegant in your size.`), alza: { i: chat.length, budget: m.richiesta.budget + 100 }, en, richiesta: m.richiesta });
      else if (!nuovo) chat.push({ chi: "stylist", testo: T("Con questi capi non trovo di meglio nella tua taglia. Prova a scrivermi cosa vorresti.", "I can't find anything better in your size for this. Try telling me what you'd like.") });
      else { const d = S.totale(nuovo) - S.totale(look);
        // cosa è cambiato, capo per capo (giro 4: "+115 €" non diceva cosa)
        const nomeP = p => en ? { capospalla: "jacket", sopra: "top", sotto: "bottom", scarpe: "shoes", abito: "dress" }[p] : S.NOME_POSTO[p].toLowerCase();
        const cambiati = ["capospalla", "sopra", "sotto", "abito", "scarpe"].filter(p => (look[p] && S.chiave(look[p])) !== (nuovo[p] && S.chiave(nuovo[p])));
        const dettaglio = cambiati.map(p => { const x = Math.round((nuovo[p]?.e || 0) - (look[p]?.e || 0)); return `${nomeP(p)} ${x === 0 ? T("stesso prezzo", "same price") : (x > 0 ? "+" : "−") + euro(Math.abs(x))}`; }).join(", ");
        const frase = nuovo.__nota === "stesso" ? T("Lo stesso capo, in un altro colore.", "The same piece, in another colour.") : nuovo.__nota === "simile" ? T("Questo capo non c'è in un altro colore nella tua taglia: ne ho messo uno simile.", "This piece isn't in another colour in your size: I picked a similar one.") : T("Ecco.", "Here you go.");
        const largo2 = nuovo.__largo; delete nuovo.__nota; delete nuovo.__largo;
        chat.push({ richiesta: m.richiesta, chi: "stylist", testo: frase, nota: `${largo2 ? T("Con tutto quello che avevi chiesto non c'era altro: ho allargato un po'. ", "With everything you'd asked there was nothing else: I widened a little. ") : ""}${T("Cambiati", "Changed")}: ${dettaglio}. ${T("Totale", "Total")} ${euro(S.totale(nuovo))} (${d === 0 ? T("stesso prezzo", "same price") : (d > 0 ? "+" : "−") + euro(Math.abs(d))}).`, capi: S.capiDi(nuovo).map(S.chiave), en }); }
      return disegnaChat();
    }
    const rp = e.target.closest("[data-riprova]"); if (rp) { const t = rp.dataset.riprova; const i = chat.findLastIndex(m => m.errore); if (i >= 0) chat.splice(chat[i - 1]?.chi === "io" ? i - 1 : i, chat[i - 1]?.chi === "io" ? 2 : 1); return manda(t); }
    const mi = e.target.closest("[data-capo]"); if (mi) { const c = INDICE.get(mi.dataset.capo); if (c) apriScheda(c, 2, true); return; }
    const ri = e.target.closest("[data-rimetti]");
    if (ri) {
      const prima = outfit;
      outfit = S.outfitVuoto();
      for (const k of chat[+ri.dataset.rimetti].capi) { const c = INDICE.get(k); if (c) outfit = S.metti(outfit, c).outfit; }
      bloccati.clear(); manca = []; largo = []; fuoriPal = []; ricorda(); chiudiFoglio(); mostra("s-camerino"); disegna();
      toast("Look nel camerino", () => { outfit = prima; ricorda(); disegna(); });
    }
  };
}
let bozzaStylist = "";     // frase già scritta quando si arriva dalla ricerca di Scopri
$("chiedi").onclick = () => { if (DATI) apriStylist(); };

// ======================================================================
// COME FUNZIONA — la prima volta nel camerino, poi dall'account
// ======================================================================
// la guida indica le cose vere sullo schermo, una alla volta (giro 1, A2: prima erano 6 fogli di solo testo)
const PASSI_GUIDA = [
  ["#palco .segmenti", "Il tuo look", "Look mostra i capi veri, in vendita adesso nella tua taglia. Avatar te lo fa vedere addosso."],
  ["#palco .pezzo, #palco .casella", "Tocca un capo", "Vedi le taglie disponibili adesso, le foto e i colori. Da lì lo cambi, lo blocchi o lo togli."],
  ["#chiedi", "Chiedi allo stylist", "Scrivi cosa ti serve, per esempio \"cena elegante, 200 €\": compone il look per te."],
  ["#direzioni", "Un altro look", "Più elegante, più casual o spendendo meno. \"Nuovo look\" ne propone uno diverso."],
  ["#principale", "Compra", "Apre il sito di ogni marchio con la tua taglia già scelta. Il cuore salva il look."],
  ["#schede", "Scopri e Salvati", "In Scopri sfogli tutti i capi con i filtri. In Salvati ritrovi look e capi messi da parte."],
];
function apriGuida(i = 0) {
  chiudiFoglio(); mostra("s-camerino");
  if (modoPalco !== "look") { modoPalco = "look"; disegnaPalco(); }
  document.querySelector(".coach")?.remove();
  if (i >= PASSI_GUIDA.length) return;
  const [sel, titolo, testo] = PASSI_GUIDA[i];
  const el = document.querySelector(sel);
  if (!el || !el.getClientRects().length) return apriGuida(i + 1);
  const r = el.getBoundingClientRect(), sotto = r.top + r.height / 2 < innerHeight / 2;
  const box = document.createElement("div");
  box.className = "coach";
  box.innerHTML = `<div class="coach-buco" style="top:${r.top - 6}px;left:${r.left - 6}px;width:${r.width + 12}px;height:${r.height + 12}px"></div>
    <div class="coach-fumetto" role="dialog" aria-label="${esc(titolo)}" style="${sotto ? `top:${Math.min(r.bottom + 14, innerHeight - 200)}px` : `bottom:${Math.max(innerHeight - r.top + 14, 20)}px`}">
      <small>${i + 1} / ${PASSI_GUIDA.length}</small><b>${esc(titolo)}</b><p>${esc(testo)}</p>
      <div class="coach-azioni"><button class="testo-link" data-g="via">Salta</button><button class="pieno piccolo" data-g="avanti">${i < PASSI_GUIDA.length - 1 ? "Avanti" : "Ho capito"}</button></div></div>`;
  box.onclick = e => { const b = e.target.closest("[data-g]"); if (!b) return; box.remove(); if (b.dataset.g === "avanti") apriGuida(i + 1); };
  document.body.append(box);
  box.querySelector("[data-g=avanti]").focus();
}
document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelector(".coach")?.remove(); });

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
/** Condividi: il link (il look vivo) oppure un'immagine del look disegnata nel telefono (giro 1, G3). */
function condividi() {
  const look = outfit; if (!S.capiDi(look).length) return;
  const corpo = apriFoglio("Condividi il look", `<div class="dettagli" style="gap:10px">
    <button class="pieno" id="cd-link">Invia il link</button><p class="note" style="margin:0">Chi lo apre vede il look con i capi veri e può comprarli.</p>
    <button class="vuoto" id="cd-immagine">Salva come immagine</button><p class="note" style="margin:0">Per WhatsApp, Instagram o una storia.</p></div>`);
  corpo.querySelector("#cd-link").onclick = () => { chiudiFoglio(); condividiLink(look); };
  corpo.querySelector("#cd-immagine").onclick = async e => { e.target.disabled = true; e.target.textContent = tr("Preparo l'immagine…"); await condividiImmagine(look); chiudiFoglio(); };
}
async function condividiImmagine(look) {
  const capi = S.capiDi(look), W = 1080, H = 1350, M = 60, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
  const carica = src => new Promise(ok => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => ok(im); im.onerror = () => ok(null); im.src = src; });
  const foto_ = await Promise.all(capi.map(c => carica(foto(c, 700))));
  const col = 2, righe = Math.ceil(capi.length / col), gap = 24, cw = (W - 2 * M - gap) / col, top = 150, ch = (H - top - 120 - (righe - 1) * gap) / righe - 50;
  g.fillStyle = "#111111"; g.font = "52px 'Courier New', monospace"; g.fillText("camerino", M, 100);
  g.font = "28px 'Courier New', monospace"; g.textAlign = "right"; g.fillText(`${capi.length} ${LINGUA === "en" ? "items" : "capi"} · ${euro(S.totale(look))}`, W - M, 100); g.textAlign = "left";
  capi.forEach((c, i) => {
    const x = M + (i % col) * (cw + gap), y = top + Math.floor(i / col) * (ch + 50 + gap), im = foto_[i];
    g.fillStyle = "#f6f6f4"; g.fillRect(x, y, cw, ch);
    if (im) { const r = Math.max(cw / im.width, ch / im.height), w = im.width * r, h = im.height * r; g.save(); g.beginPath(); g.rect(x, y, cw, ch); g.clip(); g.drawImage(im, x + (cw - w) / 2, y + (S.postoDi(c) === "scarpe" ? (ch - h) / 2 : 0), w, h); g.restore(); }
    g.fillStyle = "#9a9a93"; g.font = "22px 'Courier New', monospace"; g.fillText(negozio(c).nome.toUpperCase().slice(0, 24), x, y + ch + 34);
    g.fillStyle = "#111111"; g.textAlign = "right"; g.fillText(euro(c.e), x + cw, y + ch + 34); g.textAlign = "left";
  });
  g.fillStyle = "#9a9a93"; g.font = "22px 'Courier New', monospace"; g.fillText(location.host + location.pathname.replace(/\/$/, ""), M, H - 50);
  const blob = await new Promise(ok => cv.toBlob(ok, "image/jpeg", 0.9));
  if (!blob) return toast(tr("Non riesco a creare l'immagine"));
  const file = new File([blob], "camerino-look.jpg", { type: "image/jpeg" });
  try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (e) { if (e.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "camerino-look.jpg"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(tr("Immagine salvata"));
}
async function condividiLink(look = outfit) {
  const capi = S.capiDi(look); if (!capi.length) return;
  const url = `${location.origin}${location.pathname}?o=${b64.su(JSON.stringify({ g: profilo.genere, c: capi.map(S.chiave) }))}`;
  const copia = async () => { try { await navigator.clipboard.writeText(url); toast("Link copiato"); } catch { toast("Da questo browser non riesco a condividere"); } };
  try { if (navigator.share) await navigator.share({ title: "Camerino", text: `Il mio look: ${capi.length} capi, ${euro(S.totale(look))}`, url }); else await copia(); }
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
    else { profilo.genere = link.g; daProfilo = false; passo = 2; mostra("s-profilo"); disegnaPasso(); }
  };
}

// ---------- avvio ----------
const condiviso = leggiCondiviso();
if (condiviso) apriCondiviso(condiviso);
else if (profilo.pronto && profilo.genere) entra(); else apriProfilo();
if (location.hostname === "localhost") window.__cam = { lookPerRichiesta, R, S, get DATI() { return DATI; }, profilo };   // solo per le prove in locale
