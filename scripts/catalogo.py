#!/usr/bin/env python3
"""Costruisce data/catalogo.json dai negozi Shopify (endpoint pubblico /products.json).

Tiene solo i capi d'abbigliamento donna, riconosce categoria, colore e taglie, converte i prezzi in euro
(cambio indicativo). La disponibilità qui è una fotografia: l'app la riverifica dal vivo sul capo aperto.

Uso: python3 scripts/catalogo.py   (scrive data/catalogo.json)
"""
import gzip, json, random, re, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from datetime import datetime
from pathlib import Path

# dominio, nome mostrato, sistema delle taglie numeriche (FR/EU, IT, UK, AU, US), stile, misto (vende anche uomo:
# per questi si tengono solo i capi con un segno "donna" esplicito). Scelti l'11–12/11: catalogo aperto, spediscono in Italia.
# Dove esiste il negozio europeo (eu.…) si usa quello: prezzi in euro e niente dogana.
NEGOZI = [
    # parigino
    ("rouje.com", "Rouje", "FR", "Parigino", False), ("musier-paris.com", "Musier Paris", "FR", "Parigino", False),
    ("balzac-paris.fr", "Balzac Paris", "FR", "Parigino", False), ("soeur.fr", "Soeur", "FR", "Parigino", False),
    ("maisonlabiche.com", "Maison Labiche", "FR", "Parigino", True), ("makemylemonade.com", "Make My Lemonade", "FR", "Parigino", False),
    # minimal
    ("eu.thefrankieshop.com", "The Frankie Shop", "FR", "Minimal", True), ("eu.aninebing.com", "Anine Bing", "US", "Minimal", False),
    ("toteme-studio.com", "Totême", "FR", "Minimal", False), ("thegarment.com", "The Garment", "UK", "Minimal", False),
    ("envelope1976.com", "Envelope 1976", "FR", "Minimal", False), ("nuenotes.com", "Nué Notes", "FR", "Minimal", False),
    ("hopestockholm.com", "Hope", "FR", "Minimal", True), ("leset.com", "Leset", "US", "Minimal", False),
    ("eu.rails.com", "Rails", "US", "Minimal", True),
    # lusso accessibile
    ("khaite.com", "Khaite", "US", "Lusso", False), ("nililotan.com", "Nili Lotan", "US", "Lusso", True),
    ("staud.clothing", "Staud", "US", "Lusso", False), ("annaquan.com", "Anna Quan", "US", "Lusso", False),
    # romantico
    ("shopdoen.com", "Dôen", "US", "Romantico", False), ("loveshackfancy.com", "LoveShackFancy", "US", "Romantico", False),
    ("hillhousehome.com", "Hill House Home", "US", "Romantico", False), ("selkiecollection.com", "Selkie", "US", "Romantico", False),
    ("merlettenyc.com", "Merlette", "US", "Romantico", False), ("christydawn.com", "Christy Dawn", "US", "Romantico", False),
    ("rixo.co.uk", "Rixo", "UK", "Romantico", False),
    # boho
    ("louisemisha.com", "Louise Misha", "FR", "Boho", False), ("spell.co", "Spell", "AU", "Boho", False),
    ("ajeworld.com", "Aje", "AU", "Boho", False),
    # colore e fantasia (scandinavo, spagnolo)
    ("baumundpferdgarten.com", "Baum und Pferdgarten", "FR", "Colore", False), ("rodebjer.com", "Rodebjer", "FR", "Colore", False),
    ("lovechild1979.com", "Lovechild 1979", "FR", "Colore", False), ("resumecph.com", "Résumé", "FR", "Colore", False),
    ("skallstudio.com", "Skall Studio", "FR", "Colore", False),
    ("gimaguas.com", "Gimaguas", "FR", "Colore", False), ("palomawool.com", "Paloma Wool", "FR", "Colore", False),
    ("damsonmadder.com", "Damson Madder", "UK", "Colore", False), ("nobodyschild.com", "Nobody's Child", "UK", "Colore", False),
    ("lucyandyak.com", "Lucy & Yak", "UK", "Colore", False),
    # italiano
    ("manilagrace.com", "Manila Grace", "IT", "Italiano", False), ("alysi.it", "Alysi", "IT", "Italiano", False),
    ("hinnominate.com", "Hinnominate", "IT", "Italiano", False), ("aspesi.com", "Aspesi", "IT", "Italiano", True),
    # maglieria
    ("babaa.es", "Babaà", "FR", "Maglieria", False), ("jumper1234.com", "Jumper 1234", "UK", "Maglieria", False),
    ("nakedcashmere.com", "Naked Cashmere", "US", "Maglieria", False),
    # sostenibile
    ("armedangels.com", "Armedangels", "FR", "Sostenibile", True), ("ecoalf.com", "Ecoalf", "FR", "Sostenibile", True),
    ("thinkingmu.com", "Thinking Mu", "FR", "Sostenibile", True), ("organicbasics.com", "Organic Basics", "FR", "Sostenibile", True),
    ("pangaia.com", "Pangaia", "US", "Sostenibile", True), ("kotn.com", "Kotn", "US", "Sostenibile", True),
    # denim
    ("agolde.com", "Agolde", "US", "Denim", True), ("citizensofhumanity.com", "Citizens of Humanity", "US", "Denim", True),
    ("motherdenim.com", "Mother", "US", "Denim", False), ("frame-store.com", "Frame", "US", "Denim", True),
    ("shopredone.com", "Re/Done", "US", "Denim", True), ("withjean.com", "With Jéan", "US", "Denim", False),
    # curvy (taglie estese)
    ("goodamerican.com", "Good American", "US", "Curvy", False), ("universalstandard.com", "Universal Standard", "US", "Curvy", False),
    # sportivo
    ("setactive.co", "Set Active", "US", "Sportivo", False),
    ("oceansapart.com", "Oceans Apart", "FR", "Sportivo", False),
    # streetwear
    ("eu.stussy.com", "Stüssy", "US", "Streetwear", True), ("eu.kith.com", "Kith", "US", "Streetwear", True),
    ("rains.com", "Rains", "FR", "Streetwear", True),
    ("eu.motelrocks.com", "Motel Rocks", "UK", "Streetwear", False),
    # sera e festa
    ("eu.ohpolly.com", "Oh Polly", "UK", "Sera", False), ("lnaclothing.com", "LNA", "US", "Sera", False),
    ("edikted.com", "Edikted", "US", "Sera", False),
    # rock
    ("eu.killstar.com", "Killstar", "UK", "Rock", True), ("dollskill.com", "Dolls Kill", "US", "Rock", False),
    # camicie
    ("withnothingunderneath.com", "With Nothing Underneath", "UK", "Minimal", False),
]
# Cambio indicativo verso l'euro: serve solo a confrontare col budget, il prezzo vero resta quello del negozio.
EURO = {"EUR": 1, "USD": 0.86, "GBP": 1.15, "AUD": 0.57, "SEK": 0.091, "DKK": 0.134, "CAD": 0.62, "NOK": 0.085, "NZD": 0.52, "CHF": 1.07}

# ---- categorie: parole nel tipo prodotto o nel titolo (en/fr/it/es). L'ordine conta: la prima che combacia vince.
CATEGORIE = [
    (None, r"\b(bag|bags|borsa|sac|bolso|tote|clutch|pouch|belt|ceinture|cintura|earring|necklace|bracelet|ring|jewel|bijou|"
           r"scarf|sciarpa|foulard|echarpe|hat|cap|beanie|bonnet|sock|chaussette|calz|shoe|sneaker|boot|bott|sandal|mule|"
           r"loafer|heel|pump|ballet|ballerin|chaussure|scarp|gift|card|candle|sunglass|lunette|keyring|charm|hair|"
           r"swim|bikini|maillot|underwear|lingerie|bra\b|brief|culotte|perfume|parfum|towel|mask|glove|gant|kids?\b|baby|bebe|enfant|"
           r"(?<!wo)men\b|(?<!wo)men's|homme|uomo|pj\b|pyjama|pajama|sleep|robe de chambre|gift card|final sale item)"),
    ("abito", r"\b(dress|dresses|robe|abito|vestido|jumpsuit|combinaison|tuta|playsuit|gown)"),
    ("capospalla", r"\b(coat|jacket|blazer|trench|bomber|parka|puffer|gilet|vest\b|manteau|veste|blouson|doudoune|cappotto|giacca|giubbotto|"
                   r"piumino|abrigo|chaqueta|outerwear|windbreaker|anorak|cape\b)"),
    ("maglia", r"\b(sweater|jumper|knit|cardigan|pullover|pull\b|sweat|hoodie|maglion|maglia|cardi|punto|turtleneck|crewneck)"),
    ("top", r"(t-shirt|tee-shirt|\btee\b|\btank\b|\bpolo\b|\bcami\b|bodysuit)"),
    ("camicia", r"\b(shirt|blouse|chemise|camicia|camicett|blusa|camisa|tunic)"),
    ("top", r"\b(top|tops|tee|t-shirt|tank|cami|body|bodysuit|polo|debardeur|canotta|camiseta|bustier|corset)"),
    ("gonna", r"\b(skirt|jupe|gonna|falda)"),
    ("jeans", r"\b(jean|jeans|denim)"),
    ("pantaloni", r"\b(pant|pants|trouser|pantalon|pantaloni|short|shorts|legging|jogger|culotte|bermuda)"),
]
NOMI_CAT = {"abito": "Abito", "capospalla": "Capospalla", "maglia": "Maglia", "camicia": "Camicia", "top": "Top",
            "gonna": "Gonna", "jeans": "Jeans", "pantaloni": "Pantaloni"}

# ---- colori: nome (en/fr/it/es) → (nome italiano, esadecimale indicativo). Le parole più lunghe vengono provate prima.
COLORI = {
    "nero": ("Nero", "#141414"), "black": ("Nero", "#141414"), "noir": ("Nero", "#141414"), "negro": ("Nero", "#141414"),
    "jet": ("Nero", "#141414"), "onyx": ("Nero", "#1a1a1a"),
    "bianco": ("Bianco", "#f7f7f5"), "white": ("Bianco", "#f7f7f5"), "blanc": ("Bianco", "#f7f7f5"), "blanco": ("Bianco", "#f7f7f5"),
    "avorio": ("Avorio", "#f1ead8"), "ivory": ("Avorio", "#f1ead8"), "ivoire": ("Avorio", "#f1ead8"), "ecru": ("Écru", "#ece3cf"),
    "écru": ("Écru", "#ece3cf"), "off white": ("Avorio", "#f1ece0"), "off-white": ("Avorio", "#f1ece0"), "cream": ("Crema", "#f3e9d2"),
    "crema": ("Crema", "#f3e9d2"), "creme": ("Crema", "#f3e9d2"), "crème": ("Crema", "#f3e9d2"), "panna": ("Panna", "#f4eddc"),
    "butter": ("Burro", "#f3e2a6"), "vanilla": ("Vaniglia", "#f3e5c0"), "oatmeal": ("Avena", "#d9cbb0"), "oat": ("Avena", "#d9cbb0"),
    "beige": ("Beige", "#d6c3a3"), "sand": ("Sabbia", "#cdb894"), "sabbia": ("Sabbia", "#cdb894"), "sable": ("Sabbia", "#cdb894"),
    "stone": ("Pietra", "#bfb6a6"), "taupe": ("Tortora", "#8b7d6b"), "tortora": ("Tortora", "#8b7d6b"), "greige": ("Tortora", "#a89f91"),
    "khaki": ("Kaki", "#8a7f55"), "kaki": ("Kaki", "#8a7f55"), "camel": ("Cammello", "#b0814f"), "cammello": ("Cammello", "#b0814f"),
    "tan": ("Cuoio", "#a9774a"), "cognac": ("Cognac", "#8e4a24"), "caramel": ("Caramello", "#a8692e"), "caramello": ("Caramello", "#a8692e"),
    "brown": ("Marrone", "#5a3d2b"), "marrone": ("Marrone", "#5a3d2b"), "marron": ("Marrone", "#5a3d2b"), "brun": ("Marrone", "#5a3d2b"),
    "chocolate": ("Cioccolato", "#3f2a20"), "chocolat": ("Cioccolato", "#3f2a20"), "cioccolato": ("Cioccolato", "#3f2a20"),
    "testa di moro": ("Testa di moro", "#3a2a22"), "moro": ("Testa di moro", "#3a2a22"), "espresso": ("Caffè", "#3b2a22"),
    "coffee": ("Caffè", "#4a3427"), "mocha": ("Moka", "#6b4e3d"), "carob": ("Carruba", "#4f3a2c"), "chestnut": ("Castagna", "#6b3e26"),
    "rust": ("Ruggine", "#a4452a"), "ruggine": ("Ruggine", "#a4452a"), "rouille": ("Ruggine", "#a4452a"), "terracotta": ("Terracotta", "#b5573a"),
    "brick": ("Mattone", "#9c4632"), "copper": ("Rame", "#b06a3b"),
    "grigio": ("Grigio", "#8d8d8d"), "grey": ("Grigio", "#8d8d8d"), "gray": ("Grigio", "#8d8d8d"), "gris": ("Grigio", "#8d8d8d"),
    "charcoal": ("Antracite", "#3e3e42"), "antracite": ("Antracite", "#3e3e42"), "anthracite": ("Antracite", "#3e3e42"),
    "melange": ("Grigio mélange", "#9a9a9a"), "heather": ("Grigio mélange", "#9a9a9a"), "silver": ("Argento", "#c0c0c4"), "argento": ("Argento", "#c0c0c4"),
    "navy": ("Blu navy", "#1c2541"), "marine": ("Blu navy", "#1c2541"), "blu notte": ("Blu navy", "#1c2541"), "midnight": ("Blu notte", "#1b1f3b"),
    "blue": ("Blu", "#2f5d9e"), "blu": ("Blu", "#2f5d9e"), "bleu": ("Blu", "#2f5d9e"), "azul": ("Blu", "#2f5d9e"),
    "cobalt": ("Cobalto", "#1f4fb4"), "royal": ("Blu royal", "#2a4bb0"), "azzurro": ("Azzurro", "#8fb6dd"), "light blue": ("Azzurro", "#8fb6dd"),
    "sky": ("Azzurro", "#9cc3e6"), "ciel": ("Azzurro", "#9cc3e6"), "baby blue": ("Azzurro", "#a9c9e8"), "powder": ("Azzurro polvere", "#b5c9dd"),
    "denim": ("Denim", "#4a6382"), "indigo": ("Indaco", "#2e3a6b"), "teal": ("Petrolio", "#1f6a6a"), "petrol": ("Petrolio", "#1f5560"),
    "turquoise": ("Turchese", "#3fb0ac"), "aqua": ("Acqua", "#7fcfc9"),
    "green": ("Verde", "#3f6b45"), "verde": ("Verde", "#3f6b45"), "vert": ("Verde", "#3f6b45"),
    "olive": ("Oliva", "#6b6b3a"), "oliva": ("Oliva", "#6b6b3a"), "olivo": ("Oliva", "#6b6b3a"), "military": ("Verde militare", "#4b5320"),
    "army": ("Verde militare", "#4b5320"), "forest": ("Verde bosco", "#22412c"), "bottle": ("Verde bottiglia", "#1d3b2c"),
    "emerald": ("Smeraldo", "#0f6b4a"), "sage": ("Salvia", "#9caf88"), "salvia": ("Salvia", "#9caf88"), "mint": ("Menta", "#a8d8bf"),
    "pistachio": ("Pistacchio", "#b5c98a"), "lime": ("Lime", "#b6cf3a"), "moss": ("Muschio", "#6d7a3e"), "kelly": ("Verde prato", "#2e9a4a"),
    "red": ("Rosso", "#b3202a"), "rosso": ("Rosso", "#b3202a"), "rouge": ("Rosso", "#b3202a"), "rojo": ("Rosso", "#b3202a"),
    "cherry": ("Ciliegia", "#8f1d2c"), "scarlet": ("Scarlatto", "#c0202a"), "tomato": ("Pomodoro", "#d0402e"),
    "burgundy": ("Bordeaux", "#5c1a26"), "bordeaux": ("Bordeaux", "#5c1a26"), "bordeau": ("Bordeaux", "#5c1a26"), "wine": ("Vinaccia", "#5a1c2a"),
    "cabernet": ("Bordeaux", "#5a1c2a"), "oxblood": ("Sangue di bue", "#4f1a1d"), "merlot": ("Bordeaux", "#5a1c2a"), "plum": ("Prugna", "#5d2a4a"),
    "prugna": ("Prugna", "#5d2a4a"), "prune": ("Prugna", "#5d2a4a"), "aubergine": ("Melanzana", "#3d1f35"),
    "pink": ("Rosa", "#e7a3b5"), "rosa": ("Rosa", "#e7a3b5"), "rose": ("Rosa", "#e7a3b5"), "blush": ("Cipria", "#e8bfb6"),
    "cipria": ("Cipria", "#e8bfb6"), "nude": ("Nude", "#d9b29a"), "fuchsia": ("Fucsia", "#c71585"), "fucsia": ("Fucsia", "#c71585"),
    "magenta": ("Magenta", "#b5176f"), "raspberry": ("Lampone", "#b3325a"), "coral": ("Corallo", "#f07e6e"), "corallo": ("Corallo", "#f07e6e"),
    "salmon": ("Salmone", "#f0927a"), "peach": ("Pesca", "#f6c3a1"), "pesca": ("Pesca", "#f6c3a1"), "apricot": ("Albicocca", "#f2b07b"),
    "orange": ("Arancione", "#e5762b"), "arancio": ("Arancione", "#e5762b"), "arancione": ("Arancione", "#e5762b"), "tangerine": ("Mandarino", "#f08a2c"),
    "yellow": ("Giallo", "#f0cf3a"), "giallo": ("Giallo", "#f0cf3a"), "jaune": ("Giallo", "#f0cf3a"), "amarillo": ("Giallo", "#f0cf3a"),
    "lemon": ("Limone", "#f4e46a"), "mustard": ("Senape", "#c9a227"), "senape": ("Senape", "#c9a227"), "moutarde": ("Senape", "#c9a227"),
    "ochre": ("Ocra", "#c08a2c"), "ocre": ("Ocra", "#c08a2c"), "gold": ("Oro", "#c9a23f"), "oro": ("Oro", "#c9a23f"),
    "purple": ("Viola", "#5e3a87"), "viola": ("Viola", "#5e3a87"), "violet": ("Viola", "#5e3a87"), "lilac": ("Lilla", "#c3a6d8"),
    "lilla": ("Lilla", "#c3a6d8"), "lavender": ("Lavanda", "#b8a9d9"), "lavanda": ("Lavanda", "#b8a9d9"), "mauve": ("Malva", "#a9849a"),
    # nomi "di fantasia" frequenti nei negozi, ricondotti al colore più vicino
    "maroon": ("Bordeaux", "#5c1a26"), "garnet": ("Granato", "#6f1d2b"), "crimson": ("Cremisi", "#9e1b32"), "currant": ("Ribes", "#5a1f33"),
    "fig": ("Fico", "#5b3a4a"), "amethyst": ("Ametista", "#7a5a9a"), "pearl": ("Perla", "#ece8df"), "porcelain": ("Porcellana", "#efeee8"),
    "parchment": ("Pergamena", "#e9dfc6"), "talco": ("Talco", "#efe9e1"), "shell": ("Conchiglia", "#efe5d6"), "champagne": ("Champagne", "#e8d6b3"),
    "natural": ("Naturale", "#e6dccb"), "almond": ("Mandorla", "#e3d2b8"), "flax": ("Lino", "#d8c9a6"), "dune": ("Duna", "#cbb592"),
    "mushroom": ("Fungo", "#a39282"), "mink": ("Visone", "#8a7566"), "truffle": ("Tartufo", "#5a463b"), "cigar": ("Sigaro", "#5c3d2a"),
    "bark": ("Corteccia", "#5a4433"), "mulch": ("Corteccia", "#4f3a2a"), "oak": ("Rovere", "#6b4f35"), "earth": ("Terra", "#6b4b35"),
    "ginger": ("Zenzero", "#b06a2e"), "bronze": ("Bronzo", "#8c6a3a"), "fudge": ("Cioccolato", "#4a3024"), "citron": ("Cedro", "#d9cf5a"),
    "papaya": ("Papaya", "#f0905a"), "ash": ("Cenere", "#a9a8a3"), "smoke": ("Fumo", "#8f8f8c"), "mist": ("Nebbia", "#c9cbc8"),
    "concrete": ("Cemento", "#9b9a96"), "slate": ("Ardesia", "#5a6068"), "graphite": ("Grafite", "#45474b"), "gunmetal": ("Canna di fucile", "#4a4d52"),
    "magnet": ("Grafite", "#4a4b4f"), "soot": ("Fuliggine", "#2b2a2a"), "iron": ("Ferro", "#4d4d4f"), "seaside": ("Azzurro mare", "#7fa7c4"),
    "wash": ("Denim", "#4a6382"), "rinse": ("Denim scuro", "#2f3f5c"), "bleach": ("Denim chiaro", "#a7bcd4"), "indaco": ("Indaco", "#2e3a6b"),
}
# fantasie: il colore non si può confrontare con la palette
FANTASIE = r"(floral|flower|fleur|fiori|print|imprim|stampa|stripe|rayure|righe|check|carreaux|quadri|plaid|tartan|dot|pois|leopard|léopard|leopardo|zebra|paisley|ikat|bloom|bouquet|multi|pinstripe|gingham|vichy|camo)"
# paesi da cui si compra senza dogana
UE = {"AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
      "PL", "PT", "RO", "SK", "SI", "ES", "SE"}
TAGLIE = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"]
# taglia numerica → lettera, per sistema
NUM = {
    "FR": {32: "XXS", 34: "XS", 36: "S", 38: "M", 40: "L", 42: "XL", 44: "XXL", 46: "3XL", 48: "4XL", 50: "4XL"},
    "IT": {36: "XXS", 38: "XS", 40: "S", 42: "M", 44: "L", 46: "XL", 48: "XXL", 50: "3XL", 52: "4XL", 54: "4XL"},
    "UK": {4: "XXS", 6: "XS", 8: "S", 10: "M", 12: "L", 14: "XL", 16: "XXL", 18: "3XL", 20: "4XL", 22: "4XL"},
    "AU": {4: "XXS", 6: "XS", 8: "S", 10: "M", 12: "L", 14: "XL", 16: "XXL", 18: "3XL", 20: "4XL", 22: "4XL"},
    "US": {0: "XXS", 2: "XS", 4: "S", 6: "M", 8: "L", 10: "XL", 12: "XXL", 14: "3XL", 16: "3XL", 18: "4XL", 20: "4XL",
           22: "4XL", 24: "4XL", 26: "4XL", 28: "4XL", 30: "4XL", 32: "4XL", 34: "4XL", 36: "4XL", 38: "4XL", 40: "4XL"},
}
VITA = {23: "XXS", 24: "XXS", 25: "XS", 26: "S", 27: "S", 28: "M", 29: "M", 30: "L", 31: "L", 32: "XL", 33: "XXL", 34: "XXL"}
PAROLE_TAGLIA = [("XX-SMALL", "XXS"), ("XXSMALL", "XXS"), ("X-SMALL", "XS"), ("XSMALL", "XS"), ("EXTRASMALL", "XS"), ("SMALL", "S"),
                 ("MEDIUM", "M"), ("XX-LARGE", "XXL"), ("XXLARGE", "XXL"), ("X-LARGE", "XL"), ("XLARGE", "XL"), ("EXTRALARGE", "XL"), ("LARGE", "L")]
UNICA = re.compile(r"^(o/?s|one ?size|one|os|tu|taille unique|taglia unica|unica|u|default title)$", re.I)


# Si legge il negozio come lo vede chi compra dall'Italia: prezzi del mercato italiano (di solito in euro, spesso con
# dazi già compresi), gli stessi che il browser dell'utente riceve nella scheda del capo.
ITALIA = ["-b", "localization=IT", "-H", "Accept-Language: it-IT,it;q=0.9"]


def leggi(url):
    # curl e non urllib: Shopify risponde 429 alle richieste di urllib, non a quelle di curl
    for tentativo in range(3):  # la rete o il negozio a volte cadono per un attimo
        try:
            r = subprocess.run(["curl", "-sfL", "-m", "40", "-A", "Mozilla/5.0", *ITALIA, url], capture_output=True, check=True)
            return json.loads(r.stdout)
        except Exception:
            if tentativo == 2:
                raise
            time.sleep(3 * (tentativo + 1))


def tag_uomo(p):
    tags = p["tags"] if isinstance(p["tags"], list) else p["tags"].split(",")
    t = [x.strip().lower() for x in tags]
    donna = any(re.search(r"wom[ae]n|femme|donna", x) for x in t)
    uomo = any(re.fullmatch(r"(gender: ?)?(men|mens|man|homme|uomo)|new-men|.*\bedit men", x) for x in t)
    return uomo and not donna


def segno_donna(p):
    """Per i negozi che vendono anche uomo: il capo dice esplicitamente di essere da donna?"""
    tags = " ".join(p["tags"]) if isinstance(p["tags"], list) else p["tags"]
    testo = f"{p['product_type']} {tags} {p['title']} {p['handle']}".lower()
    return bool(re.search(r"unisex|wom[ae]n|femme|donna|mujer|damen|\bdame\b|\bladies\b|\bgirls?\b|\bher\b", testo))


def categoria(p):
    if tag_uomo(p):
        return None
    titolo, tipo = p["title"].lower(), p["product_type"].lower()
    tags = (" ".join(p["tags"]) if isinstance(p["tags"], list) else p["tags"]).lower()
    if re.search(CATEGORIE[0][1], f"{tipo} {titolo}"):
        return None
    # prima il titolo (il più preciso), poi il tipo prodotto, i tag solo come ultima risorsa: sono rumorosi
    for campo in (titolo, tipo, tags):
        for cat, rx in CATEGORIE[1:]:
            if re.search(rx, campo):
                return cat
    return None


def colore(testi):
    """Primo colore riconosciuto nei testi (valore dell'opzione colore, poi titolo); ("Fantasia", None) per le stampe."""
    if any(re.search(FANTASIE, t, re.I) for t in testi):
        return ("Fantasia", None)
    for testo in testi:
        t = testo.lower()
        for k in sorted(COLORI, key=len, reverse=True):
            if re.search(rf"(?<![a-zà-ü]){re.escape(k)}(?![a-zà-ü])", t):
                return COLORI[k]
    return None


def lettera(etichetta, sistema, cat):
    """Converte l'etichetta di una variante in taglia a lettere; '*' = taglia unica, None = non riconosciuta."""
    e = etichetta.strip()
    if UNICA.match(e):
        return "*"
    up = e.upper().replace(" ", "")
    for lunga, corta in PAROLE_TAGLIA:  # "X-SMALL" → "XS"
        up = up.replace(lunga, corta)
    m = re.match(r"^\w+_(\d+)-\d+$", up)  # "S_14-16" (Universal Standard): conta il numero americano
    if m:
        return NUM["US"].get(int(m.group(1)))
    up = re.sub(r"PLUS$", "", up)  # "16 Plus"
    if re.fullmatch(r"\d+", up) and up != e.strip():
        e = up
    up = {"1XL": "XXL", "2XL": "XXL", "1X": "XXL", "2X": "XXL", "XXXL": "3XL", "3X": "3XL", "4X": "4XL"}.get(up, up)
    m = re.match(r"^(XXS|XS|3XL|4XL|XXL|XL|S|M|L)(?:[/-](XXS|XS|3XL|4XL|XXL|XL|S|M|L))?\b", up)
    if m:  # "XS", "XS/S", "XS/UK8"
        return m.group(1) + ("/" + m.group(2) if m.group(2) else "")
    for pre in ("IT", "FR", "EU", "UK", "AU", "US"):  # "UK 8", "AU 6 / US 2"
        m = re.search(rf"{pre}\s*(\d+)", e.upper())
        if m:
            s = {"EU": "FR"}.get(pre, pre)
            return NUM[s].get(int(m.group(1)))
    m = re.fullmatch(r"(\d+)\s*(IT|FR|EU|UK|AU|US)", e.upper())
    if m:
        return NUM[{"EU": "FR"}.get(m.group(2), m.group(2))].get(int(m.group(1)))
    if re.fullmatch(r"\d+", e):
        n = int(e)
        if cat in ("jeans", "pantaloni") and 23 <= n <= 34 and sistema in ("US", "AU", "UK"):
            return VITA.get(n)
        return NUM[sistema].get(n)
    return None


def opzione(p, rx):
    for i, o in enumerate(p["options"]):
        if re.search(rx, o["name"], re.I):
            return i
    return None


def maschera(lettere):
    return sum(1 << TAGLIE.index(t) for t in lettere)


def capi(p, sistema, cat):
    """Un capo per ogni colore del prodotto: (valore colore, varianti di quel colore)."""
    ic = opzione(p, r"colou?r|couleur|colore|kleur|farbe|färg")
    if ic is None:
        return [(None, p["variants"])]
    gruppi = {}
    for v in p["variants"]:
        gruppi.setdefault(v.get(f"option{ic + 1}"), []).append(v)
    return list(gruppi.items())


def leggi_negozio(dominio, cache):
    """Scarica (o rilegge dalla cache di oggi) tutti i prodotti del negozio."""
    file = cache / f"{dominio}.json.gz"  # compressa: crude sono ~500 MB
    if file.exists() and time.time() - file.stat().st_mtime < 6 * 3600:
        dati = json.loads(gzip.decompress(file.read_bytes()))
        if dati.get("mercato") == "IT":
            return dati
    meta = leggi(f"https://{dominio}/meta.json")
    paese = meta.get("country", "")
    valuta = leggi(f"https://{dominio}/cart.js").get("currency") or meta.get("currency", "EUR")  # valuta del mercato italiano
    # dominio finale dopo i redirect (es. rouje.com → www.rouje.com): il browser non segue redirect senza CORS
    finale = subprocess.run(["curl", "-sL", "-o", "/dev/null", "-m", "40", "-A", "Mozilla/5.0", "-w", "%{url_effective}",
                             f"https://{dominio}/products.json?limit=1"], capture_output=True, text=True).stdout
    host = finale.split("/")[2] if finale.startswith("http") else dominio
    prodotti = []
    for pagina in range(1, 9):
        lotto = leggi(f"https://{dominio}/products.json?limit=250&page={pagina}")["products"]
        prodotti += lotto
        if len(lotto) < 250:
            break
        time.sleep(0.5)
    dati = {"valuta": valuta, "paese": paese, "host": host, "prodotti": prodotti, "mercato": "IT"}
    file.write_bytes(gzip.compress(json.dumps(dati).encode()))
    return dati


def dal_vivo(host, handle):
    """La scheda dell'app legge /products/<capo>.js dal browser: serve CORS aperto. Restituisce il dominio finale
    (dopo i reindirizzamenti al dominio principale) o None se il negozio non è leggibile dal browser."""
    r = subprocess.run(["curl", "-sL", "-m", "20", "-A", "Mozilla/5.0", *ITALIA, "-H", "Origin: https://example.com", "-D", "-", "-o", "/dev/null",
                        "-w", "\nFINALE %{http_code} %{url_effective}", f"https://{host}/products/{handle}.js"], capture_output=True, text=True).stdout
    finale = r.rsplit("FINALE ", 1)[-1].split()
    ultima = r.lower().rsplit("\nhttp/", 1)[-1]  # intestazioni dell'ultima risposta
    if len(finale) < 2 or finale[0] != "200" or "access-control-allow-origin" not in ultima:
        return None
    return finale[1].split("/")[2]


def esiste(host, handle):
    """False solo se il negozio dice 404. Se frena (429) si aspetta e si riprova: contarlo come "esiste" lasciava
    nel catalogo capi nascosti."""
    for attesa in (0, 2, 5, 10, 20, 40):
        time.sleep(attesa)
        r = subprocess.run(["curl", "-s", "-o", "/dev/null", "-m", "20", "-A", "Mozilla/5.0", *ITALIA, "-w", "%{http_code}",
                            f"https://{host}/products/{handle}.js"], capture_output=True, text=True).stdout
        if r != "429":
            return r != "404"
    return True  # non si è riusciti a saperlo: meglio tenerlo, l'app lo gestisce se manca


def togli_nascosti(host, capi_negozio):
    """Alcuni negozi elencano capi che sul sito sono nascosti (pagina che non esiste più). Si prova un campione;
    se più di 1 su 10 manca, si verificano tutti i capi del negozio e si tolgono quelli nascosti."""
    maniglie = sorted({c["h"] for c in capi_negozio})
    campione = random.sample(maniglie, min(20, len(maniglie)))
    with ThreadPoolExecutor(2) as ex:
        mancano = sum(1 for ok in ex.map(lambda h: esiste(host, h), campione) if not ok)
    if mancano <= len(campione) // 10:
        return capi_negozio, 0, set()
    with ThreadPoolExecutor(2) as ex:
        vive = {h for h, ok in zip(maniglie, ex.map(lambda h: esiste(host, h), maniglie)) if ok}
    return [c for c in capi_negozio if c["h"] in vive], len(maniglie) - len(vive), set(maniglie) - vive


def main():
    radice = Path(__file__).resolve().parent.parent
    cache = radice / ".cache"
    cache.mkdir(exist_ok=True)
    negozi, out = [], []
    verifiche = {}   # dominio → dominio finale e capi nascosti: catalogo2.py li riusa invece di ricontrollare
    for dominio, nome, sistema, stile, misto in NEGOZI:
        try:
            dati = leggi_negozio(dominio, cache)
        except Exception as e:
            print(f"!! {dominio}: {e}", file=sys.stderr)
            continue
        prova = [p["handle"] for p in dati["prodotti"] if any(v["available"] for v in p["variants"])][:3]
        host = next((h for h in (dal_vivo(dati["host"], x) for x in prova) if h), None)
        if not host:
            print(f"!! {dominio}: disponibilità dal vivo non leggibile dal browser, escluso", file=sys.stderr)
            continue
        dati["host"] = host
        n = len(negozi)
        negozi.append({"nome": nome, "dominio": dati["host"], "valuta": dati["valuta"], "sistema": sistema, "stile": stile,
                       "ue": dati["paese"] in UE, "paese": dati["paese"]})
        cambio = EURO.get(dati["valuta"], 1)
        tenuti = 0
        for p in dati["prodotti"]:
            cat = categoria(p)
            if misto and not segno_donna(p):
                continue
            if not cat or not p["images"]:
                continue
            it = opzione(p, r"size|taille|taglia|talla|grösse|storlek|str")
            it = 0 if it is None else it
            immagini = {im["id"]: im["src"] for im in p["images"]}
            for valore, varianti in capi(p, sistema, cat):
                prodotte, disponibili = set(), set()
                for v in varianti:
                    let = lettera(v.get(f"option{it + 1}") or "", sistema, cat)
                    if let is None:
                        continue
                    tt = TAGLIE if let == "*" else let.split("/")
                    prodotte.update(tt)
                    if v["available"]:
                        disponibili.update(tt)
                if not disponibili:  # niente di acquistabile: inutile mostrarlo
                    continue
                # la fantasia può stare nel titolo anche quando l'opzione colore dice solo "Noir"
                col = colore(([valore] if valore else []) + [p["title"], p["handle"].replace("-", " ")])
                fi = varianti[0].get("featured_image") or {}
                img = (fi.get("src") or immagini.get((varianti[0].get("image_id"))) or p["images"][0]["src"]).split("?")[0]
                prezzo = min(float(v["price"]) for v in varianti)
                titolo = re.sub(r"\s*[-–|]+\s*final sale\s*$", "", p["title"], flags=re.I)
                out.append({
                    "n": n, "h": p["handle"], "t": titolo, "c": cat,
                    "k": col[0] if col else None, "x": col[1] if col else None, "v": valore,
                    "p": prezzo, "e": round(prezzo * cambio),
                    "i": img.replace("https://cdn.shopify.com/s/files/", "~"),
                    "s": maschera(prodotte), "d": maschera(disponibili),
                })
                tenuti += 1
        propri, tolti, nascosti = togli_nascosti(dati["host"], out[-tenuti:] if tenuti else [])
        verifiche[dominio] = {"host": dati["host"], "nascosti": sorted(nascosti)}
        if tolti:
            out[-tenuti:] = propri
            tenuti = len(propri)
        print(f"{nome:22} {tenuti:5} capi da {len(dati['prodotti'])} prodotti ({dati['valuta']})" + (f" · {tolti} nascosti sul sito, tolti" if tolti else ""), file=sys.stderr)
    # capi senza colore nel nome: lo si stima dalla foto (cache: si misura una volta sola per foto)
    try:
        from colore_foto import misura_tutti
        senza = [c for c in out if c["k"] is None]
        url = lambda c: "https://cdn.shopify.com/s/files/" + c["i"][1:] if c["i"].startswith("~") else c["i"]
        misure = misura_tutti([url(c) for c in senza], cache / "colori.json")
        for c in senza:
            m = misure.get(url(c))
            if m:
                c["k"], c["x"], c["m"] = m[0], m[1], 1  # m = colore stimato dalla foto
        print(f"colore dalla foto: {sum(1 for c in senza if 'm' in c)} su {len(senza)} capi senza colore nel nome", file=sys.stderr)
    except ImportError:
        print("!! Pillow assente: colore dalla foto saltato", file=sys.stderr)
    (cache / "verifiche.json").write_text(json.dumps({"quando": time.time(), "negozi": verifiche}))
    dati = {"aggiornato": datetime.now().strftime("%Y-%m-%d %H:%M"), "taglie": TAGLIE, "cambio": EURO,
            "negozi": negozi, "capi": out}
    dest = radice / "data" / "catalogo.json"
    dest.parent.mkdir(exist_ok=True)
    dest.write_text(json.dumps(dati, ensure_ascii=False, separators=(",", ":")))
    print(f"\n{len(out)} capi da {len(negozi)} negozi → {dest} ({dest.stat().st_size // 1024} KB)", file=sys.stderr)


if __name__ == "__main__":
    main()
