// Lingua dell'app: italiano (scritta così nel codice) o inglese (Andrea, 15/11: "gli amici sono tedeschi, serve almeno l'inglese").
// L'inglese si applica alla pagina mentre si disegna: ogni testo visibile (e aria-label, placeholder, alt) passa da `tr`.
// Così il codice resta uno solo e un testo nuovo senza traduzione si vede in italiano invece di rompersi.
// Nomi di capi, marchi e colori dei negozi non si traducono (stanno dentro [translate="no"] o non sono nel dizionario).

const CHIAVE = "camerino-lingua";
export const LINGUA = (() => {
  try { const l = localStorage.getItem(CHIAVE); if (l === "it" || l === "en") return l; } catch {}
  return /^it\b/i.test(navigator.language || "it") ? "it" : "en";
})();
export function cambiaLingua(l) { try { localStorage.setItem(CHIAVE, l); } catch {} location.reload(); }

const EN = {
  // navigazione e azioni
  "Camerino": "Fitting room", "camerino": "camerino", "Scopri": "Discover", "scopri": "discover", "Salvati": "Saved", "Nuovo look": "New look", "Compra": "Buy",
  "Il mio account": "My account", "Chiudi": "Close", "Cerca": "Search", "Cerca un capo": "Search for an item", "Avanti": "Next", "Indietro": "Back", "← Indietro": "← Back",
  "Salta": "Skip", "Entra": "Enter", "Fatto": "Done", "Annulla": "Undo", "Sì": "Yes", "Altri": "More", "Inizia": "Start", "Invia": "Send",
  "Cambia": "Change", "Blocca": "Lock", "Bloccato": "Locked", "Togli": "Remove", "Indossa": "Wear", "Elimina": "Delete", "Crea": "Create",
  "Salva questo look": "Save this look", "Condividi questo look": "Share this look", "Cambia avatar": "Change avatar", "Ingrandisci": "Zoom in",
  "Gira a destra": "Turn right", "Gira a sinistra": "Turn left", "Davanti": "Front", "Dietro": "Back", "Lato destro": "Right side", "Lato sinistro": "Left side",
  "Avatar": "Avatar", "Avatar ingrandito": "Zoomed avatar", "L'avatar con il look": "The avatar wearing the look",
  "Tocca per ingrandire · trascina per muoverti": "Tap to zoom · drag to move around",
  // posti e reparti
  "Giacca": "Jacket", "Sopra": "Top", "Sotto": "Bottom", "Scarpe": "Shoes", "Abito": "Dress", "Abiti": "Dresses", "Giacche e cappotti": "Jackets and coats",
  "Maglie": "Knitwear", "Camicie": "Shirts", "Top e t-shirt": "Tops and t-shirts", "Pantaloni": "Trousers", "Jeans": "Jeans", "Gonne": "Skirts", "Tutti": "All", "Tutte": "All",
  // profilo
  "Donna o uomo?": "Woman or man?", "Donna": "Woman", "Uomo": "Man", "Le tue taglie": "Your sizes", "I tuoi colori": "Your colours",
  "Scegli la tua stagione. Se non la sai, usa una foto o salta.": "Choose your colour season. If you don't know it, use a photo or skip.",
  "Usa una foto del viso": "Use a photo of your face", "Un attimo…": "Just a moment…", "Budget": "Budget", "Per tutto il look, scarpe comprese.": "For the whole look, shoes included.",
  "Fino a": "Up to", "Con giacca o cappotto": "With a jacket or coat", "Stile": "Style", "se vuoi": "optional", "Budget del look in euro": "Look budget in euros",
  "Qui non vedo un viso. Prova con una foto di fronte, in buona luce.": "I can't see a face here. Try a photo from the front, in good light.",
  "Dalla foto: ": "From the photo: ", ". È una stima, la luce può ingannare: se non ti convince cambiala qui sopra.": ". It's an estimate and light can be misleading: if it doesn't convince you, change it above.",
  "Non riesco a leggere la foto. Scegli tu qui sopra.": "I can't read the photo. Choose above.",
  "Primavera": "Spring", "Estate": "Summer", "Autunno": "Autumn", "Inverno": "Winter",
  "calda e chiara": "warm and light", "fredda e chiara": "cool and light", "calda e profonda": "warm and deep", "fredda e intensa": "cool and intense",
  "Minimal": "Minimal", "Parigino": "Parisian", "Lusso": "Luxury", "Romantico": "Romantic", "Boho": "Boho", "Colore": "Colour", "Italiano": "Italian", "Maglieria": "Knitwear",
  "Sostenibile": "Sustainable", "Denim": "Denim", "Curvy": "Curvy", "Sportivo": "Sporty", "Streetwear": "Streetwear", "Sera": "Evening", "Rock": "Rock",
  // account
  "Capi da": "Clothes for", "Taglia sopra": "Top size", "Taglia sotto": "Bottom size", "Budget del look": "Look budget", "Colori": "Colours", "nessuna stagione": "no season",
  "base": "basic", "Vedi i look salvati": "See saved looks", "Cancella tutto e ricomincia": "Delete everything and start over", "Lingua": "Language", "Come funziona": "How it works",
  "Tocca di nuovo per cancellare profilo, look e salvati": "Tap again to delete profile, looks and saved items", "Salvato": "Saved",
  "Rifaccio il look con le nuove taglie?": "Shall I redo the look in the new sizes?",
  // camerino
  "Completa il look": "Complete the look", "Prova il look": "Try on the look", "Completa il look per provarlo": "Complete the look to try it on",
  "Sto vestendo l'avatar…": "Dressing the avatar…", "Sto girando l'avatar…": "Turning the avatar…", "Vedi senza il look": "See without the look", "Vedi con il look": "See with the look",
  "I capi sull'avatar arrivano presto": "Clothes on the avatar coming soon", "Aggiunto": "Added", "Tolto": "Removed", "Tolto dai salvati": "Removed from saved",
  "Resta quando chiedi un nuovo look": "It stays when you ask for a new look", "Era l'ultima prova di oggi": "That was today's last try-on", "Era l'ultima immagine di oggi": "That was today's last image",
  "Non sono riuscito a vestire l'avatar. Riprova.": "I couldn't dress the avatar. Please try again.", "Non sono riuscito a girare l'avatar. Riprova.": "I couldn't turn the avatar. Please try again.",
  "Non riesco a caricare i capi. Controlla la connessione e riapri.": "I can't load the clothes. Check your connection and reopen.",
  "Ancora niente. Il cuore nel camerino salva il look che stai guardando.": "Nothing yet. The heart in the fitting room saves the look you're looking at.",
  // stylist
  "Chiedi allo stylist": "Ask the stylist", "«un look da ufficio sotto 300 €»": "“an office look under €300”", "Stylist": "Stylist",
  "Scrivi cosa cerchi: l'occasione, i colori, un capo, il budget. Compongo il look con capi veri, nella tua taglia.": "Tell me what you're looking for: the occasion, colours, an item, your budget. I'll put the look together with real clothes in your size.",
  "Un look da ufficio sotto 300 €": "An office look under €300", "Una cena elegante, stivali neri": "An elegant dinner, black boots", "Qualcosa per una cena, scarpe nere": "Something for a dinner, black shoes",
  "Jeans e maglione di lana per il weekend": "Jeans and a wool jumper for the weekend", "Weekend in montagna": "A weekend in the mountains",
  "Scrivi qui…": "Write here…", "Scrivi allo stylist": "Write to the stylist", "Sto pensando…": "Thinking…", "Indossa questo look": "Wear this look", "Ecco il look.": "Here's the look.",
  "Non ci sono riuscito. Riprova.": "That didn't work. Please try again.",
  "Però con queste richieste non trovo capi nella tua taglia. Prova ad allargare un po'.": "But I can't find clothes in your size with these requests. Try widening it a little.",
  // guida
  "Il tuo camerino": "Your fitting room", "Cambia un capo": "Change an item", "Il tuo avatar": "Your avatar",
  "Al centro c'è il tuo avatar. A destra i capi del look: giacca, sopra, sotto, scarpe. Sono capi veri, in vendita adesso nella tua taglia.": "Your avatar is in the middle. On the right are the items of the look: jacket, top, bottom, shoes. They are real clothes, on sale now in your size.",
  "Tocca una casella a destra: vedi il capo, le taglie disponibili adesso, i colori e la descrizione. Da lì puoi cambiarlo, bloccarlo o toglierlo.": "Tap a box on the right: you see the item, the sizes available right now, the colours and the description. From there you can change it, lock it or remove it.",
  "Scrivi cosa ti serve, per esempio \"un look da ufficio sotto 300 €\": lo stylist compone il look per te.": "Write what you need, for example \"an office look under €300\": the stylist puts the look together for you.",
  "Con il look completo tocca \"Prova il look\": in circa 15 secondi l'avatar lo indossa. Con le frecce in basso lo giri: di lato e da dietro. La lente ingrandisce.": "When the look is complete tap \"Try on the look\": in about 15 seconds the avatar wears it. Turn it with the arrows at the bottom: side and back views. The magnifier zooms in.",
  "L'icona della figurina cambia l'avatar: un modello pronto, uno creato dalla tua foto o un personaggio inventato.": "The figure icon changes the avatar: a ready-made model, one created from your photo, or an invented character.",
  "\"Compra\" apre il sito di ogni marchio con la tua taglia già scelta. Il cuore salva il look, la freccia lo condivide.": "\"Buy\" opens each brand's site with your size already selected. The heart saves the look, the arrow shares it.",
  // filtri
  "Filtri": "Filters", "Togli filtri": "Clear filters", "Materiale": "Material", "Lunghezza": "Length", "Maniche": "Sleeves",
  "Cotone": "Cotton", "Lana": "Wool", "Cashmere": "Cashmere", "Seta": "Silk", "Lino": "Linen", "Pelle": "Leather", "Velluto": "Velvet", "Viscosa": "Viscose", "Sintetico": "Synthetic",
  "Corta": "Short", "Normale": "Regular", "Lunga": "Long", "Senza maniche": "Sleeveless", "Maniche corte": "Short sleeves", "Maniche 3/4": "3/4 sleeves", "Maniche lunghe": "Long sleeves",
  "Niente con questi filtri.": "Nothing with these filters.", "Niente nella tua taglia, per ora.": "Nothing in your size, for now.", "La mia taglia": "My size",
  "Prova con un capo, un colore, un prezzo o un marchio.": "Try an item, a colour, a price or a brand.", "Budget finito: questi vanno oltre": "Budget used up: these go over",
  // scheda e acquisto
  "Taglie": "Sizes", "Descrizione": "Description", "Leggi tutto": "Read more", "nella tua taglia": "in your size", "Guarda le taglie sul sito.": "Check the sizes on the site.",
  "Controlla la taglia sul sito": "Check the size on the site", "Non più in vendita": "No longer on sale", "Taglia unica": "One size", "Unica": "One size",
  "Spedito da fuori UE: possibili dazi alla consegna.": "Ships from outside the EU: duties may be charged on delivery.", "Da fuori UE: possibili dazi alla consegna.": "From outside the EU: duties may be charged on delivery.",
  "nei tuoi colori": "in your colours", "vicino ai tuoi colori": "close to your colours", "fuori dai tuoi colori": "outside your colours", "stimato dalla foto": "estimated from the photo",
  "Totale": "Total", "Ogni capo si compra sul sito del suo marchio, con la taglia già scelta. Spedizione e resi sono i loro.": "Each item is bought on its brand's site, with the size already chosen. Shipping and returns are theirs.",
  // avatar
  "Modelli": "Models", "Dalla tua foto": "From your photo", "Personaggio": "Character", "Creati da te": "Created by you", "Base": "Basic", "Modello 1": "Model 1", "Modello 2": "Model 2", "Modello 3": "Model 3",
  "Una foto in piedi, vestito, di fronte, con buona luce. Meglio se si vede tutta la figura.": "A photo standing, dressed, from the front, in good light. Best if your whole body is visible.",
  "Scegli la foto": "Choose the photo", "La foto serve solo a creare l'avatar e non viene conservata.": "The photo is only used to create the avatar and is not kept.",
  "Chi": "Who", "Animale": "Animal", "Corporatura": "Build", "Capelli": "Hair", "Colore capelli": "Hair colour", "Pelo": "Fur", "Carnagione": "Skin",
  "Umano": "Human", "Alieno": "Alien", "Robot": "Robot", "Elfo": "Elf", "Gatto": "Cat", "Volpe": "Fox", "Orso": "Bear", "Coniglio": "Rabbit", "Lupo": "Wolf", "Panda": "Panda", "Leone": "Lion", "Cane": "Dog",
  "Esile": "Slim", "Media": "Average", "Robusta": "Strong", "Morbida": "Curvy", "Corti": "Short", "Lunghi": "Long", "Ricci": "Curly", "Raccolti": "Tied up", "Rasati": "Shaved", "Nessuno": "None",
  "Neri": "Black", "Castani": "Brown", "Biondi": "Blonde", "Rossi": "Red", "Grigi": "Grey", "Rosa": "Pink", "Realistico": "Realistic", "Cartone": "Cartoon", "Fumetto": "Comic",
  "Lo sto creando…": "Creating it…", "Avatar pronto": "Avatar ready", "Dalla foto": "From photo",
  "I capi sull'avatar": "Clothes on the avatar", "Un esempio.": "An example.",
  // look condiviso
  "Un look per te": "A look for you", "Provalo nel mio camerino": "Try it in my fitting room", "Vai al mio camerino": "Go to my fitting room", "Apri il camerino": "Open the fitting room",
  "Questi capi non sono più in vendita.": "These items are no longer on sale.", "Qualche capo non è più in vendita.": "Some items are no longer on sale.", "Sito ↗": "Site ↗",
  "Non riesco a caricare il look. Controlla la connessione e riapri il link.": "I can't load the look. Check your connection and reopen the link.",
  "Link copiato": "Link copied", "Da questo browser non riesco a condividere": "I can't share from this browser",
  // messaggi del server
  "Per oggi hai creato abbastanza avatar. Domani si riparte.": "You've made enough avatars for today. Try again tomorrow.",
  "Per oggi hai provato abbastanza look. Domani si riparte.": "You've tried on enough looks for today. Try again tomorrow.",
  "Oggi il camerino è pieno. Riprova domani.": "The fitting room is full today. Try again tomorrow.",
  // colori del catalogo
  "Acqua": "Aqua", "Albicocca": "Apricot", "Ametista": "Amethyst", "Antracite": "Anthracite", "Arancione": "Orange", "Ardesia": "Slate", "Argento": "Silver", "Avena": "Oat", "Avorio": "Ivory",
  "Azzurro": "Light blue", "Azzurro mare": "Sea blue", "Azzurro polvere": "Powder blue", "Beige": "Beige", "Bianco": "White", "Blu": "Blue", "Blu navy": "Navy", "Blu notte": "Midnight blue",
  "Blu royal": "Royal blue", "Bordeaux": "Burgundy", "Bronzo": "Bronze", "Burro": "Butter", "Caffè": "Coffee", "Cammello": "Camel", "Canna di fucile": "Gunmetal", "Caramello": "Caramel",
  "Carruba": "Carob", "Castagna": "Chestnut", "Cedro": "Citron", "Cenere": "Ash", "Champagne": "Champagne", "Ciliegia": "Cherry", "Cioccolato": "Chocolate", "Cipria": "Powder pink",
  "Cobalto": "Cobalt", "Cognac": "Cognac", "Conchiglia": "Shell", "Corallo": "Coral", "Corteccia": "Bark", "Crema": "Cream", "Cremisi": "Crimson", "Cuoio": "Tan", "Denim chiaro": "Light denim",
  "Denim scuro": "Dark denim", "Duna": "Dune", "Fantasia": "Print", "Ferro": "Iron", "Fico": "Fig", "Fucsia": "Fuchsia", "Fuliggine": "Soot", "Fumo": "Smoke", "Fungo": "Mushroom",
  "Giallo": "Yellow", "Grafite": "Graphite", "Granato": "Garnet", "Grigio": "Grey", "Grigio chiaro": "Light grey", "Grigio mélange": "Grey marl", "Indaco": "Indigo", "Kaki": "Khaki",
  "Lampone": "Raspberry", "Lavanda": "Lavender", "Lilla": "Lilac", "Lime": "Lime", "Limone": "Lemon", "Magenta": "Magenta", "Malva": "Mauve", "Mandarino": "Tangerine", "Mandorla": "Almond",
  "Marrone": "Brown", "Mattone": "Brick", "Melanzana": "Aubergine", "Menta": "Mint", "Moka": "Mocha", "Muschio": "Moss", "Naturale": "Natural", "Nebbia": "Mist", "Nero": "Black", "Nude": "Nude",
  "Ocra": "Ochre", "Oliva": "Olive", "Oro": "Gold", "Panna": "Off-white", "Papaya": "Papaya", "Pergamena": "Parchment", "Perla": "Pearl", "Pesca": "Peach", "Petrolio": "Petrol",
  "Pietra": "Stone", "Pistacchio": "Pistachio", "Pomodoro": "Tomato", "Porcellana": "Porcelain", "Prugna": "Plum", "Rame": "Copper", "Ribes": "Currant", "Rosso": "Red", "Rovere": "Oak",
  "Ruggine": "Rust", "Sabbia": "Sand", "Salmone": "Salmon", "Salvia": "Sage", "Sangue di bue": "Oxblood", "Scarlatto": "Scarlet", "Senape": "Mustard", "Sigaro": "Cigar", "Smeraldo": "Emerald",
  "Tartufo": "Truffle", "Terra": "Earth", "Terracotta": "Terracotta", "Testa di moro": "Dark brown", "Tortora": "Taupe", "Turchese": "Turquoise", "Vaniglia": "Vanilla", "Verde": "Green",
  "Verde bosco": "Forest green", "Verde bottiglia": "Bottle green", "Verde militare": "Military green", "Verde prato": "Grass green", "Vinaccia": "Wine", "Viola": "Purple", "Visone": "Mink",
  "Zenzero": "Ginger", "Écru": "Ecru",
  "capospalla": "coats & jackets", "maglia": "knitwear", "camicia": "shirts", "top": "tops", "abito": "dresses", "gonna": "skirts", "jeans": "jeans", "pantaloni": "trousers", "scarpe": "shoes",
  "lana": "wool", "cotone": "cotton", "seta": "silk", "lino": "linen", "pelle": "leather", "velluto": "velvet", "pizzo": "lace", "cashmere": "cashmere", "lungo": "long", "corto": "short",
  "cappotto": "coat", "blazer": "blazer", "trench": "trench", "piumino": "puffer", "cardigan": "cardigan", "felpa": "sweatshirt", "stivali": "boots", "sneakers": "sneakers", "sandali": "sandals",
  "nero": "black", "bianco": "white", "panna": "off-white", "beige": "beige", "cammello": "camel", "marrone": "brown", "grigio": "grey", "navy": "navy", "blu": "blue", "azzurro": "light blue",
  "verde": "green", "oliva": "olive", "rosso": "red", "bordeaux": "burgundy", "rosa": "pink", "arancione": "orange", "giallo": "yellow", "viola": "purple", "lilla": "lilac",
};
const POSTO = { giacca: "jacket", sopra: "top", sotto: "bottom", scarpe: "shoes", abito: "dress", "il sopra": "the top", "il sotto": "the bottom", "le scarpe": "the shoes" };
const posti = t => t.replace(/il sopra|il sotto|le scarpe|giacca|sopra|sotto|scarpe|abito/g, m => POSTO[m]).replace(/ e /g, " and ");
// testi con numeri o nomi dentro
const REGOLE = [
  [/^(\s*)di (.+)$/, (_, s, x) => `${s}of ${x}`],
  [/^restano (.+)$/, (_, x) => `${x} left`], [/^oltre di (.+)$/, (_, x) => `${x} over`],
  [/^Compra · (.+)$/, (_, x) => `Buy · ${x}`], [/^Filtri · (\d+)$/, (_, n) => `Filters · ${n}`],
  [/^Mancan?o? (.+)\.$/, (_, x) => `Missing: ${posti(x)}.`],
  [/^Con (.+) il look non si chiude: (.+)\. Alza il budget o scegli un capo meno caro\.$/, (_, b, x) => `With ${b} the look can't be completed: ${posti(x).replace(/ da /g, " from ")}. Raise the budget or choose a cheaper item.`],
  [/^Fino a (.+) · ([\d.]+) capi · taglia (.+)$/, (_, a, n, t) => `Up to ${a} · ${n} items · size ${t}`],
  [/^Budget finito: questi vanno oltre · taglia (.+)$/, (_, t) => `Budget used up: these go over · size ${t}`],
  [/^\+(.+) sul budget$/, (_, x) => `+${x} over budget`],
  [/^([\d.]+) capi( nella tua taglia)?$/, (_, n, t) => `${n} items${t ? " in your size" : ""}`],
  [/^(\d+) capi · (.+?)( · qualcuno non c'è più)?$/, (_, n, x, q) => `${n} items · ${x}${q ? " · some are gone" : ""}`],
  [/^(.*) — ([\d.]+) capi$/, (_, a, n) => `${a.split(" · ").map(p => p.replace(/^fino a /, "up to ")).map(p => EN[p] || p).join(" · ")} — ${n} items`],
  [/^Oggi ti restano (\d+) (prove|immagini)$/, (_, n, k) => `${n} ${k === "prove" ? "try-ons" : "images"} left today`],
  [/^Aggiunto\. Via (.+)$/, (_, x) => `Added. Removed ${posti(x)}`],
  [/^Un capo non c'è nella nuova taglia$/, () => "One item isn't available in the new size"],
  [/^(\d+) capi non ci sono nella nuova taglia$/, (_, n) => `${n} items aren't available in the new size`],
  [/^(.+) disponibile$/, (_, t) => `${EN[t] || t} available`], [/^(.+) esaurita$/, (_, t) => `${t} sold out`], [/^Non c'è in (.+)$/, (_, t) => `Not available in ${t}`],
  [/^ore (.+)$/, (_, x) => `at ${x}`], [/^ · ora (.+) sul sito$/, (_, x) => ` · now ${x} on the site`], [/^ora (.+) sul sito$/, (_, x) => `now ${x} on the site`],
  [/^Vedi sul sito di (.+) ↗$/, (_, x) => `View on ${x}'s site ↗`], [/^Compra su (.+) ↗$/, (_, x) => `Buy on ${x} ↗`],
  [/^Scegli: (.+)$/, (_, x) => `Choose: ${posti(x)}`], [/^(Giacca|Sopra|Sotto|Scarpe|Abito): (.+)$/, (_, p, x) => `${EN[p]}: ${x}`],
  [/^(\d+) \/ (\d+)$/, m => m],
];
export function tr(testo) {
  if (LINGUA === "it" || !testo) return testo;
  const t = testo.trim(); if (!t) return testo;
  const fuori = testo.slice(0, testo.indexOf(t)), dopo = testo.slice(testo.indexOf(t) + t.length);
  if (EN[t] != null) return fuori + EN[t] + dopo;
  for (const [rx, f] of REGOLE) if (rx.test(testo)) return testo.replace(rx, f);
  for (const [rx, f] of REGOLE) if (rx.test(t)) return fuori + t.replace(rx, f) + dopo;
  const coda = t.match(/^(.+?)\s*·$/); if (coda && EN[coda[1]]) return fuori + EN[coda[1]] + " ·" + dopo;
  if (t.includes(" · ")) { const parti = t.split(" · "); if (parti.some(p => EN[p])) return fuori + parti.map(p => EN[p] ?? p).join(" · ") + dopo; }
  return testo;
}
/** Per i testi composti nel codice (es. le frasi aggiunte alla risposta dello stylist). */
export const t = tr;

if (LINGUA === "en") {
  document.documentElement.lang = "en";
  const ATTR = ["aria-label", "placeholder", "alt", "title"];
  const salta = n => n.parentElement?.closest("[translate='no'],script,style");
  const fatto = new WeakMap();      // nodo → testo già tradotto (evita di ritradurre)
  const testoNodo = n => { if (salta(n)) return; const v = n.nodeValue; if (fatto.get(n) === v) return; const x = tr(v); fatto.set(n, x); if (x !== v) n.nodeValue = x; };
  const elemento = el => { if (el.closest?.("[translate='no']")) return; for (const a of ATTR) { const v = el.getAttribute?.(a); if (v) { const x = tr(v); if (x !== v) el.setAttribute(a, x); } } };
  const giro = radice => {
    if (radice.nodeType === 3) return testoNodo(radice);
    if (radice.nodeType !== 1) return;
    elemento(radice);
    const w = document.createTreeWalker(radice, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeType === 3 ? testoNodo(n) : elemento(n);
  };
  const avvia = () => {
    giro(document.body); document.title = "Camerino";
    new MutationObserver(lista => { for (const m of lista) {
      if (m.type === "childList") m.addedNodes.forEach(giro);
      else if (m.type === "characterData") testoNodo(m.target);
      else if (m.type === "attributes") elemento(m.target);
    } }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR });
  };
  if (document.body) avvia(); else document.addEventListener("DOMContentLoaded", avvia);
}
