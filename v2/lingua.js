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
  "Tutto": "All", "Ci sto mettendo un po' più del solito…": "This is taking a bit longer than usual…", "Tuta": "Jumpsuit", "Rifaccio il look con le nuove taglie e il budget?": "Redo the look with the new sizes and budget?", "serve": "required", "Altro": "More", "colore e tipo di capelli, altezza · se vuoi": "hair colour and type, height · optional",
  "La foto va al servizio che crea l'avatar (fal.ai) e noi non la conserviamo. L'avatar creato resta salvato sul nostro server per un anno.": "The photo goes to the service that creates the avatar (fal.ai) and we don't keep it. The avatar created stays saved on our server for one year.", "Lo stesso capo, in un altro colore.": "The same piece, in another colour.", "Questo capo non c'è in un altro colore nella tua taglia: ne ho messo uno simile.": "This piece isn't in another colour in your size: I picked a similar one.", "prezzo aggiornato dal sito": "price updated from the shop", "Il viso": "Your face", "Figura intera": "Full length", "· se vuoi": "· optional", "Come sei": "What you look like", "Scegli la foto del viso": "Choose a face photo", "Salta": "Skip",
  "In piedi, dalla testa ai piedi, con vestiti aderenti: l'avatar ti somiglierà di più nelle proporzioni.": "Standing, head to toe, in fitted clothes: the avatar will match your proportions better.",
  "Crea il mio avatar · circa 20 s": "Create my avatar · about 20 s", "Prova addosso": "Try it on", "Per oggi lo stylist ha risposto a tante domande. Torna domani.": "The stylist has answered a lot today. Come back tomorrow.", "Tocca quelli che ti somigliano: vale anche più di uno.": "Tap the ones that feel like you: more than one is fine.", "Non ho altro nel budget per questo capo": "Nothing else within budget for this item", "Togli dai salvati": "Remove from saved", "stesso prezzo": "same price", "Condividi il look": "Share the look", "Invia il link": "Send the link", "Chi lo apre vede il look con i capi veri e può comprarli.": "Whoever opens it sees the look with the real items and can buy them.",
  "Salva come immagine": "Save as image", "Per WhatsApp, Instagram o una storia.": "For WhatsApp, Instagram or a story.", "Preparo l'immagine…": "Preparing the image…", "Non riesco a creare l'immagine": "I can't create the image", "Immagine salvata": "Image saved", "Il tuo look": "Your look", "Look mostra i capi veri, in vendita adesso nella tua taglia. Avatar te lo fa vedere addosso.": "Look shows the real items, on sale now in your size. Avatar shows it on you.",
  "Tocca un capo": "Tap an item", "Vedi le taglie disponibili adesso, le foto e i colori. Da lì lo cambi, lo blocchi o lo togli.": "See the sizes available now, photos and colours. From there you change, lock or remove it.",
  "Scrivi cosa ti serve, per esempio \"cena elegante, 200 €\": compone il look per te.": "Write what you need, for example \"elegant dinner, €200\": it puts the look together for you.",
  "Un altro look": "Another look", "Più elegante, più casual o spendendo meno. \"Nuovo look\" ne propone uno diverso.": "More elegant, more casual or cheaper. \"New look\" suggests a different one.",
  "Apre il sito di ogni marchio con la tua taglia già scelta. Il cuore salva il look.": "Opens each brand's site with your size already chosen. The heart saves the look.",
  "Scopri e Salvati": "Discover and Saved", "In Scopri sfogli tutti i capi con i filtri. In Salvati ritrovi look e capi messi da parte.": "In Discover you browse every item with filters. In Saved you find the looks and items you kept.",
  "Ho capito": "Got it", "Taglie": "Sizes", "nessuno": "none", "Ci sta bene con": "Goes well with", "Indossa tutto il look": "Wear the whole look", "Una foto del viso. Se vuoi, anche una in piedi a figura intera: l'avatar ti somiglierà di più.": "A photo of your face. If you like, also a full-length standing one: the avatar will look more like you.",
  "Di fronte, sguardo in camera": "Facing the camera", "Luce del giorno, niente controluce": "Daylight, no backlight", "Senza occhiali da sole né cappello": "No sunglasses or hat", "Da sola o da solo nella foto": "Only you in the photo",
  "Ci vogliono circa 20 secondi.": "It takes about 20 seconds.", "Salva il capo": "Save item", "Salvato": "Saved", "Capo salvato": "Item saved", "Tolto dai salvati": "Removed from saved", "Rinomina": "Rename", "Condividi": "Share",
  "Controllo le taglie…": "Checking sizes…", "Tutto disponibile nella tua taglia": "All available in your size", "Eliminato": "Deleted", "Vai al camerino": "Go to the fitting room", "Vai a Scopri": "Go to Discover",
  "Qui ritrovi i look che ti piacciono. Nel camerino tocca il cuore per salvarne uno.": "Your favourite looks live here. In the fitting room tap the heart to save one.",
  "Qui metti da parte i singoli capi: apri un capo e tocca \"Salva il capo\".": "Keep single items here: open an item and tap \"Save item\".",
  "Look": "Look", "Avatar": "Avatar", "Prova il look addosso": "Try the look on", "Vedilo addosso": "See it on you", "Scegli": "Choose",
  "Preparo i capi nella tua taglia…": "Getting the clothes in your size ready…", "Non riesco a caricare i capi. Controlla la connessione.": "I can't load the clothes. Check your connection.",
  "Non so ancora cercare così. Qui capisco un capo, un colore, un prezzo o un marchio (es. \"cappotto nero sotto 300\").": "I can't search like that yet. Here I understand an item, a colour, a price or a brand (e.g. \"black coat under 300\").",
  "Per una frase come la tua c'è lo stylist.": "For a sentence like yours there's the stylist.", "Chiedilo allo stylist": "Ask the stylist", "Prova a togliere un filtro qui sopra.": "Try removing a filter above.",
  "Togli tutti i filtri": "Remove all filters", "Mostra anche le altre taglie": "Show other sizes too", "Azzera": "Clear", "Ecco cosa ho trovato.": "Here's what I found.", "Rossa, capelli lunghi": "Red hair, long", "Castana, liscia": "Brown hair, straight", "Ricci, curvy": "Curly hair, curvy", "Bionda, capelli raccolti": "Blonde, hair up", "Castano, barba": "Brown hair, beard", "Biondo": "Blond", "Rasato": "Shaved head", "Ricci": "Curly hair", "Più elegante": "More elegant", "Più casual": "More casual", "Spendi meno": "Spend less", "Look più elegante": "More elegant look", "Look più casual": "More casual look", "Camicie e bluse": "Shirts and blouses", "Felpe e hoodie": "Sweatshirts and hoodies", "T-shirt e polo": "T-shirts and polos", "Maglioni e maglie": "Jumpers and knits",
  "Canotte e corsetti": "Tank tops and corsets", "Canotte": "Tank tops", "Top": "Tops", "Shorts": "Shorts", "Blazer": "Blazers", "Gilet e smanicati": "Vests and gilets", "Piumini": "Puffer jackets", "Trench": "Trench coats",
  "Cappotti": "Coats", "Giacche": "Jackets", "Corti": "Short", "Lunghi": "Long", "Altri abiti": "Other dresses", "Da sera": "Evening", "Midi": "Midi", "Décolleté": "Pumps", "Stivali": "Boots", "Stivaletti": "Ankle boots",
  "Sneakers": "Sneakers", "Mocassini": "Loafers", "Ballerine": "Ballet flats", "Sandali e mules": "Sandals and mules", "Altre": "Other", "Tocca un capo per vederlo": "Tap a piece to see it",
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
  "Chiedi allo stylist": "Ask the stylist", "«un look da ufficio sotto 300 €»": "“an office look under €300”", "«cena, 200 €»": "“dinner, €200”", "Stylist": "Stylist",
  "Scrivi cosa cerchi: l'occasione, i colori, un capo, il budget. Compongo il look con capi veri, nella tua taglia.": "Tell me what you're looking for: the occasion, colours, an item, your budget. I'll put the look together with real clothes in your size.",
  "Un look da ufficio sotto 300 €": "An office look under €300", "Una cena elegante, stivali neri": "An elegant dinner, black boots", "Qualcosa per una cena, scarpe nere": "Something for a dinner, black shoes",
  "Jeans e maglione di lana per il weekend": "Jeans and a wool jumper for the weekend", "Weekend in montagna": "A weekend in the mountains",
  "Scrivi qui…": "Write here…", "Scrivi allo stylist": "Write to the stylist", "Sto pensando…": "Thinking…", "Sto scegliendo i capi…": "Picking the pieces…", "Riprova": "Try again", "Look nel camerino": "Look in the fitting room",
  "Non riesco a collegarmi. Controlla la connessione e riprova.": "I can't connect. Check your connection and try again.", "Non ci sono riuscito. Riprova tra poco.": "That didn't work. Try again in a moment.",
  "Vedi simili nella tua taglia": "See similar in your size", "controllo sul sito…": "checking the shop…", "Indossa questo look": "Wear this look", "Ecco il look.": "Here's the look.",
  "Non ci sono riuscito. Riprova.": "That didn't work. Please try again.",
  "Però con queste richieste non trovo capi nella tua taglia. Prova ad allargare un po'.": "But I can't find clothes in your size with these requests. Try widening it a little.",
  // guida
  "Il tuo camerino": "Your fitting room", "Cambia un capo": "Change an item", "Il tuo avatar": "Your avatar",
  "Al centro c'è il tuo avatar. A destra i capi del look: giacca, sopra, sotto, scarpe. Sono capi veri, in vendita adesso nella tua taglia.": "Your avatar is in the middle. On the right are the items of the look: jacket, top, bottom, shoes. They are real clothes, on sale now in your size.",
  "Tocca una casella a destra: vedi il capo, le taglie disponibili adesso, i colori e la descrizione. Da lì puoi cambiarlo, bloccarlo o toglierlo.": "Tap a box on the right: you see the item, the sizes available right now, the colours and the description. From there you can change it, lock it or remove it.",
  "Scrivi cosa ti serve, per esempio \"un look da ufficio sotto 300 €\": lo stylist compone il look per te.": "Write what you need, for example \"an office look under €300\": the stylist puts the look together for you.",
  "Con il look completo tocca \"Prova il look\": in circa 15 secondi l'avatar lo indossa. Con le frecce in basso lo giri: di lato e da dietro. Con due dita lo ingrandisci, come una foto.": "When the look is complete tap \"Try on the look\": in about 15 seconds the avatar wears it. Turn it with the arrows at the bottom: side and back views. Pinch with two fingers to zoom, like a photo.",
  "L'icona della figurina cambia l'avatar: un modello pronto, uno creato dalla tua foto o un personaggio inventato.": "The figure icon changes the avatar: a ready-made model, one created from your photo, or an invented character.",
  "\"Compra\" apre il sito di ogni marchio con la tua taglia già scelta. Il cuore salva il look, la freccia lo condivide.": "\"Buy\" opens each brand's site with your size already selected. The heart saves the look, the arrow shares it.",
  // filtri
  "Filtri": "Filters", "Togli filtri": "Clear filters", "Materiale": "Material", "Lunghezza": "Length", "Maniche": "Sleeves",
  "Cotone": "Cotton", "Lana": "Wool", "Cashmere": "Cashmere", "Seta": "Silk", "Lino": "Linen", "Pelle": "Leather", "Velluto": "Velvet", "Viscosa": "Viscose", "Sintetico": "Synthetic",
  "Corta": "Short", "Normale": "Regular", "Lunga": "Long", "Senza maniche": "Sleeveless", "Maniche corte": "Short sleeves", "Maniche 3/4": "3/4 sleeves", "Maniche lunghe": "Long sleeves",
  "Prezzo": "Price", "Marca": "Brand", "Fantasia": "Pattern", "Vestibilità": "Fit", "Scollo": "Neckline", "In saldo": "On sale", "Solo in saldo": "On sale only",
  "Azzera": "Clear", "Ordina": "Sort", "Consigliati": "Recommended", "Prezzo crescente": "Price: low to high", "Prezzo decrescente": "Price: high to low", "Sconto più alto": "Biggest discount",
  "A righe": "Striped", "A quadri": "Checked", "Floreale": "Floral", "A pois": "Polka dot", "Animalier": "Animal print", "Altre stampe": "Other prints",
  "Aderente": "Fitted", "Regolare": "Regular", "Ampia": "Loose", "Oversize": "Oversized",
  "Scollo a V": "V-neck", "Girocollo": "Crew neck", "Collo alto": "High neck", "Scollo quadrato": "Square neck", "Spalle scoperte": "Off-shoulder", "All'americana": "Halter",
  "Fino a 50 €": "Up to €50", "Oltre 400 €": "Over €400", "Nessuna scelta con gli altri filtri.": "No options with the other filters.", "Nessun capo": "No items", "Navy": "Navy",
  "Rifai": "Redo", "Cortissimi": "Very short", "Medi": "Medium", "Castano scuro": "Dark brown", "Biondo scuro": "Dark blonde", "Platino": "Platinum", "Bianchi": "White",
  "Lisci": "Straight", "Mossi": "Wavy", "Afro": "Afro", "Atletica": "Athletic", "Tipo di capelli": "Hair type", "Altezza": "Height", "Su di te": "About you",
  "Viso": "Face", "Figura intera · se vuoi": "Full body · optional", "Scegli la foto del viso": "Choose a photo of your face", "Scegli i capelli": "Choose your hair", "Crea il mio avatar": "Create my avatar",
  "Una foto del viso, di fronte e con buona luce. Se vuoi, anche una foto in piedi a figura intera: l'avatar ti somiglierà di più.": "A photo of your face, from the front, in good light. If you like, also a full-length photo standing: the avatar will look more like you.",
  "Conta più della foto: se in foto hai i capelli raccolti o la luce inganna, qui dici come sei.": "This counts more than the photo: if your hair is tied up in the photo or the light is misleading, tell us here how you really are.",
  "Le foto servono solo a creare l'avatar e non vengono conservate.": "The photos are only used to create the avatar and are not kept.",
  "Ti somiglia? Se no, correggi una cosa alla volta:": "Does it look like you? If not, fix one thing at a time:", "Lo sto correggendo…": "Fixing it…",
  "Capelli più corti": "Shorter hair", "Capelli più lunghi": "Longer hair", "Fisico più snello": "Slimmer build", "Fisico più robusto": "Fuller build", "Statura più alta": "Taller", "Statura più bassa": "Shorter",
  "Il tuo avatar": "Your avatar", "Pizzica con due dita per ingrandire · trascina per muoverti": "Pinch with two fingers to zoom · drag to move around",
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
  // 23/11: benvenuto, filtri scarpe e occasione
  "Il tuo stylist personale": "Your personal stylist",
  "Ti prepara look completi con capi veri, in vendita adesso nella tua taglia, da più di 70 marchi.": "It puts together complete looks with real clothes, on sale right now in your size, from more than 70 brands.",
  "Li provi addosso al tuo avatar, li cambi capo per capo e li compri direttamente sul sito del marchio.": "You try them on your avatar, change them piece by piece and buy them directly on the brand's site.",
  "Serve un minuto. Niente account: i tuoi dati restano su questo telefono.": "It takes a minute. No account: your data stays on this phone.",
  "Un look completo indossato dall'avatar": "A complete look worn by the avatar",
  ". La foto non basta a decidere: guarda i colori qui sopra e scegli quella in cui ti ritrovi.": ". The photo isn't enough to decide: look at the colours above and pick the one that suits you.",
  " o ": " or ", ": ho corretto la luce calda della foto": ": I corrected the warm light in the photo", ": ho corretto la luce fredda della foto": ": I corrected the cool light in the photo",
  ". È una stima": ". It's an estimate", ", la luce può ingannare": ", light can be misleading", ". Se non ti convince cambiala qui sopra.": ". If it doesn't convince you, change it above.",
  "Tipo": "Type", "Tacco": "Heel", "Occasione": "Occasion", "Elegante": "Elegant", "Curato": "Smart", "Casual": "Casual",
  "Stivali": "Boots", "Stivaletti": "Ankle boots", "Décolleté e tacchi": "Pumps and heels", "Sneakers": "Sneakers", "Mocassini e stringate": "Loafers and lace-ups",
  "Ballerine": "Ballet flats", "Sandali": "Sandals", "Mules e sabot": "Mules and clogs",
  "Basso (meno di 3 cm)": "Low (under 3 cm)", "Medio (3–7 cm)": "Mid (3–7 cm)", "Alto (oltre 7 cm)": "High (over 7 cm)",
};
const POSTO = { giacca: "jacket", sopra: "top", sotto: "bottom", scarpe: "shoes", abito: "dress", "il sopra": "the top", "il sotto": "the bottom", "le scarpe": "the shoes" };
const posti = t => t.replace(/il sopra|il sotto|le scarpe|giacca|sopra|sotto|scarpe|abito/g, m => POSTO[m]).replace(/ e /g, " and ");
// testi con numeri o nomi dentro
const REGOLE = [
  [/^Con la giacca sono (.+)\. Tolgo la giacca\?$/, (_, x) => `With the jacket it's ${x}. Remove the jacket?`],
  [/^(\d+) look · 1 capo$/, (_, a) => `${a} looks · 1 item`], [/^Capo · 1$/, () => "Item · 1"],
  [/^look intero (.+) · oltre il budget$/, (_, x) => `whole look ${x} · over budget`],
  [/^(\d+) look · 1 capi$/, (_, a) => `${a} looks · 1 item`],
  [/^(\d) di 3$/, (_, n) => `${n} of 3`],
  [/^✓ .+$/, t => t.split("  ").map(x => x === "✓ tua taglia" ? "✓ your size" : x.replace(/^✓ colori (.+)$/, (_, y) => `✓ ${EN[y] || y} colours`).replace(/^✓ (?!colori)(.+)$/, (_, y) => "✓ " + y.split(", ").map(z => EN[z] || z).join(", "))).join("  ")],
  [/^Il look supera i (.+)\. Lo rifaccio\?$/, (_, x) => `The look goes over ${x}. Redo it?`],
  [/^circa (.+)$/, (_, x) => `about ${x}`],
  [/^(Giacca|Sopra|Sotto|Scarpe|Abito): (stesso prezzo|[+−].+)$/, (_, p, d) => `${EN[p]}: ${d === "stesso prezzo" ? "same price" : d}`],
  [/^Un altro capo: (.+)$/, (_, p) => `Another item: ${(EN[p[0].toUpperCase() + p.slice(1)] || p).toLowerCase()}`],
  [/^(\d+) look · (\d+) capi$/, (_, a, b) => `${a} looks · ${b} items`],
  [/^(Donna|Uomo) · (.+?) · fino a (.+?)((?: · .+)?)$/, (_, g, t, b, resto) => `${g === "Donna" ? "Woman" : "Man"} · ${t} · up to ${b}${resto.split(" · ").map(x => x.split(", ").map(y => EN[y] || y).join(", ")).join(" · ")}`],
  [/^look intero (.+)$/, (_, x) => `whole look ${x}`],
  [/^Look del (.+)$/, (_, d) => `Look of ${d}`], [/^Look · (\d+)$/, (_, n) => `Looks · ${n}`], [/^Capi · (\d+)$/, (_, n) => `Items · ${n}`],
  [/^(Niente con questi filtri|Niente)( nella tua taglia)?\.$/, (_, a, b) => `${a === "Niente" ? "Nothing" : "Nothing with these filters"}${b ? " in your size" : ""}.`],
  [/^(.+): non più nella tua taglia$/, (_, x) => `${x}: no longer in your size`], [/^Togli (.+)$/, (_, x) => `Remove ${x}`],
  [/^Look da (.+)$/, (_, x) => `Look for ${x}`],
  [/^Compra in (taglia unica|.+) su (.+) ↗$/, (_, t, n) => `Buy ${t === "taglia unica" ? "one size" : "in " + t} on ${n} ↗`],
  [/^aggiornate alle (.+)$/, (_, h) => `updated at ${h}`], [/^La tua (.+) è finita\.$/, (_, t) => `Your ${t} is sold out.`], [/^La tua (.+) non c'è\.$/, (_, t) => `No ${t} for this item.`],
  [/^\s*Disponibili: (.+)\.$/, (_, t) => ` Available: ${t}.`],
  [/^(\s*)di (.+)$/, (_, s, x) => `${s}of ${x}`],
  [/^restano (.+)$/, (_, x) => `${x} left`], [/^oltre di (.+)$/, (_, x) => `${x} over`],
  [/^Compra · (.+)$/, (_, x) => `Buy · ${x}`], [/^Filtri · (\d+)$/, (_, n) => `Filters · ${n}`],
  [/^Uso anche le taglie del tuo profilo \((.+) sopra, (.+) sotto\) per le proporzioni\.$/, (_, a, b) => `I also use the sizes in your profile (${a} top, ${b} bottom) for the proportions.`],
  [/^Mostra ([\d.]+) capi$/, (_, n) => `Show ${n} items`], [/^(\d+)–(\d+) €$/, (_, a, b) => `€${a}–${b}`],
  [/^(Consigliati|Prezzo crescente|Prezzo decrescente|Sconto più alto) ▾$/, (_, x) => `${EN[x]} ▾`],
  [/^(Colore|Prezzo|Marca|Materiale|Fantasia|Vestibilità|Lunghezza|Maniche|Scollo|Tipo|Tacco|Occasione) · (\d+)$/, (_, x, n) => `${EN[x]} · ${n}`],
  [/^Mancan?o? (.+)\.$/, (_, x) => `Missing: ${posti(x)}.`],
  [/^Con (.+) il look non si chiude: nella tua taglia (.+)\. Servono almeno (.+)\.\s*$/, (_, b, x, n) => `With ${b} the look can't be completed: in your size ${x.replace(/il sopra/g, "tops").replace(/il sotto/g, "bottoms").replace(/le scarpe/g, "shoes").replace(/l'abito/g, "dresses").replace(/ parte da /g, " start at ")}. You need at least ${n}.`],
  [/^Usa (.+)$/, (_, x) => `Use ${x}`],
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
  [/^Con (.+) non trovo tutto nei colori della tua stagione \((.+)\): alzando il budget ce ne sono di più\.$/, (_, b, st) => `With ${b} I can't find everything in your season's colours (${EN[st] || st}): a higher budget gives more choice.`], [/^(\d+) di (\d+)$/, (_, a, b) => `${a} of ${b}`],
  [/^Con (.+) non trovo (.+) nel tuo stile \((.+)\): ho messo (i più vicini|il più vicino)\.$/, (_, b, x, st) => `With ${b} I can't find ${x.replace(/la giacca/, "a jacket").replace(/il sopra/, "a top").replace(/il sotto/, "a bottom").replace(/le scarpe/, "shoes").replace(/l'abito/, "a dress").replace(/ e /g, " and ")} in your style (${st.split(", ").map(z => EN[z] || z).join(", ")}): I picked the closest.`],
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
