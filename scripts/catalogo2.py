#!/usr/bin/env python3
"""Catalogo per il Camerino v2: come catalogo.py, ma ogni capo ha un genere (donna, uomo, unisex) ed entrano le scarpe.

Scrive data/v2-donna.json e data/v2-uomo.json (gli unisex stanno in tutti e due), così il telefono scarica solo il suo.
Riusa lettura dei negozi, colori e taglie di catalogo.py.

Uso: python scripts/catalogo2.py            (rilegge i negozi se la cache ha più di 6 ore)
     python scripts/catalogo2.py --cache    (usa la cache così com'è: per provare in locale senza rete)
"""
import gzip, json, re, sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import catalogo as C

# Negozi a prevalenza maschile o unisex: un capo senza segni di genere vale "unisex" invece di essere scartato.
SENZA_SEGNO_UNISEX = {"eu.stussy.com", "eu.kith.com", "rains.com", "pangaia.com", "kotn.com", "organicbasics.com"}

RX_UOMO = re.compile(r"(?<![a-z])(men|mens|men's|man|homme|hommes|uomo|herren|hombre|him|menswear|male)(?![a-z])")
RX_DONNA = re.compile(r"wom[ae]n|femme|donna|mujer|damen|(?<![a-z])(dame|ladies|girls?|her|female)(?![a-z])")
RX_UNISEX = re.compile(r"unisex|genderless|all gender")

RX_SCARPE = re.compile(r"\b(shoes?|sneakers?|trainers?|boots?|booties?|bottes?|bottines?|sandals?|sandales?|sandal[io]|mules?|loafers?|"
                       r"heels?|pumps?|ballet flats?|ballerin[ae]s?|chaussures?|scarp[ae]|stival[ei]|stivalett[io]|mocassin[io]?|"
                       r"derby|derbies|espadrill\w*|clogs?|slingbacks?|flats|baskets|zapat\w+|botas?)\b")
# tutto ciò che resta fuori (accessori, intimo, casa…): le parole delle scarpe sono tolte dalla lista di catalogo.py
RX_FUORI = re.compile(r"\b(bag|bags|borsa|sac|bolso|tote|clutch|pouch|belt|ceinture|cintura|earring|necklace|bracelet|ring|jewel|bijou|"
                      r"scarf|sciarpa|foulard|echarpe|hat|cap|beanie|bonnet|sock|socks|chaussette|calz|gift|card|candle|sunglass|lunette|"
                      r"keyring|charm|hair|swim|bikini|maillot|underwear|lingerie|bra\b|brief|culotte|perfume|parfum|towel|mask|glove|gant|"
                      r"blanket|snood|scaldacollo|neck ?warmer|\bcombs?\b|hairbrush|spazzola|skullcap|balaclava|patron de couture|sewing pattern|knitting pattern|crochet pattern|\bclasp\b|\bpdf\b|cartamodell|guantes?|gloves?|mittens?|keychain|key ?ring|headband|head ?scarf|bandana|beret|scrunchie|hair ?clip|bucket hat|llavero|\bthrow\b|kids?\b|baby|bebe|enfant|toddler|infant|pj\b|pyjama|pajama|sleep|robe de chambre|gift card|final sale item|laces?|insoles?|shoe care)")

NUMERI_SCARPE = list(range(35, 48))  # taglie europee 35–47


def testo(p):
    tags = " ".join(p["tags"]) if isinstance(p["tags"], list) else p["tags"]
    return f"{p['product_type']} {tags} {p['title']} {p['handle'].replace('-', ' ')}".lower()


def genere(p, dominio, misto):
    """'d', 'u', 'x' (unisex) oppure None se non si capisce (negozio misto senza segni)."""
    if not misto:
        return "d"
    t = testo(p)
    u, d = bool(RX_UOMO.search(t)), bool(RX_DONNA.search(t))
    if RX_UNISEX.search(t) or (u and d):
        return "x"
    if u:
        return "u"
    if d:
        return "d"
    return "x" if dominio in SENZA_SEGNO_UNISEX else None


# casi che le regole di catalogo.py sbagliano: prima queste, poi le sue
PRIMA = [
    ("abito", r"\bdress(es)?\b|(mini|midi|maxi)dress|shirt ?dress|\bjumpsuit|\bplaysuit|\bgown\b"),
    ("top", r"\bvest top|\btank top|\bcami top"),
    ("pantaloni", r"sweat ?pants?|track ?pants?|\bjoggers?\b|\bleggings?\b|\bchándal\b"),
    ("capospalla", r"overshirt|shacket|\bcazadora|\bgabardina|\babrigo|\bchaleco|\bparka"),
    ("maglia", r"\bsudadera|\bjers[eé]is?\b|\bc[aá]rdigan|\bsu[eé]ter|\bstrick|\bpulli"),
    ("top", r"\bcamiseta|\bt-?shirts?\b|\bt shirts?\b|\btshirts?\b|long ?sleeve tee|baby tee"),
    ("jeans", r"\bvaqueros?\b"),
    # "knit skirt", "knit pants": la parola del capo vince su "knit" (prima finivano tra le maglie, quindi nel sopra)
    ("gonna", r"\bskirts?\b|\bskorts?\b|\bjupe\b|\bgonna\b|\bfalda\b|\bminigonna"),
    ("pantaloni", r"\bpants?\b|\btrousers?\b|\bpantal[oó]n|\bpantalone|\bjoggers?\b"),
]


def categoria(p):
    """Posto del capo: le categorie di catalogo.py più 'scarpe'. Vale il titolo, poi il tipo prodotto.
    I tag non si usano: sono rumorosi e mettevano felpe tra i pantaloni."""
    titolo, tipo = p["title"].lower(), p["product_type"].lower()
    if RX_FUORI.search(f"{tipo} {titolo}"):
        return None
    if RX_SCARPE.search(titolo) or RX_SCARPE.search(tipo):
        return "scarpe"
    for campo in (titolo, tipo):
        for cat, rx in PRIMA + C.CATEGORIE[1:]:
            if re.search(rx, campo):
                return cat
    return None


# ---------- materiale, lunghezza, maniche (filtri chiesti da Andrea il 14/11) ----------
# Si leggono da titolo, tipo, tag e descrizione del negozio. Se il negozio non lo dice, il capo resta senza: niente indovinare.
MATERIALI = [  # (nome nell'app, parole in en/fr/it/es/de)
    ("cashmere", r"cashmere|cachemire|kaschmir"),
    ("lana", r"wool|merino|laine|lana|wolle|alpaca|mohair"),
    ("seta", r"silk|soie|seta|seide"),
    ("lino", r"linen|\blin\b|lino|leinen"),
    ("pelle", r"leather|cuir|pelle|leder|suede|daim|scamosciat|shearling"),
    ("denim", r"denim"),
    ("velluto", r"velvet|velours|velluto|corduroy|samt"),
    ("cotone", r"cotton|coton|cotone|algod[oó]n|baumwolle|poplin|jersey"),
    ("viscosa", r"viscose|viscosa|rayon|lyocell|tencel|modal|cupro"),
    ("sintetico", r"polyester|poliestere|polyamide|nylon|acrylic|acrilico|elastane|spandex|recycled poly"),
]
RX_PERC = re.compile(r"(\d{1,3})\s*%\s*([a-zà-ü ]{3,30})")


def materiale(p):
    """Il materiale principale: dalla composizione in percentuale se c'è (quello con la quota più alta), altrimenti la prima
    parola di materiale nel titolo o nei tag."""
    corpo = re.sub(r"<[^>]+>", " ", p.get("body_html") or "").lower()
    migliore = None
    for perc, parola in RX_PERC.findall(corpo):
        for nome, rx in MATERIALI:
            if re.search(rx, parola):
                if not migliore or int(perc) > migliore[0]:
                    migliore = (int(perc), nome)
                break
    if migliore:
        return migliore[1]
    t = testo(p)
    for nome, rx in MATERIALI:
        if re.search(rx, t):
            return nome
    return None


def lunghezza(p, cat):
    """'corta' | 'media' | 'lunga' | None. Detto dal negozio (mini, cropped, midi, maxi…)."""
    if cat == "scarpe":
        return None
    t = f"{p['title']} {p['handle'].replace('-', ' ')}".lower()   # solo il nome: nei tag "short" e "long" sono rumore
    if cat in ("pantaloni", "jeans") and re.search(r"\bshorts?\b|bermuda|pantaloncin", t):
        return "corta"
    if re.search(r"\b(maxi|floor[- ]length|full[- ]length|long (coat|dress|skirt|cardigan)|longline|ankle[- ]length|lungo|lunga|longue)\b", t):
        return "lunga"
    if re.search(r"\b(midi|knee[- ]length|mid[- ]length|calf)\b", t):
        return "media"
    if re.search(r"\b(mini|cropped|crop|short (dress|skirt|coat|jacket)|corta|corto|courte|shorts?)\b", t):
        return "corta"
    return None


def maniche(p, cat):
    """'senza' | 'corte' | '3/4' | 'lunghe' | None, solo per sopra, abiti e giacche."""
    if cat not in ("maglia", "camicia", "top", "abito", "capospalla"):
        return None
    titolo = f"{p['title']} {p['handle'].replace('-', ' ')}".lower()
    corpo = re.sub(r"<[^>]+>", " ", p.get("body_html") or "").lower()
    for t in (titolo, corpo):
        if re.search(r"sleeveless|strapless|halter|\btank\b|\bcami\b|camisole|spaghetti|smanicat|senza maniche|sans manches|d[ée]bardeur|canott|\bvest top", t):
            return "senza"
        if re.search(r"3/4|three[- ]quarter|elbow[- ]length|manches? 3/4", t):
            return "3/4"
        if re.search(r"short[- ]sleeve|\bs/s\b|manches? courtes|maniche corte|manica corta|cap sleeve|t-?shirt|\btee\b|polo", t):
            return "corte"
        if re.search(r"long[- ]sleeve|\bl/s\b|manches? longues|maniche lunghe|manica lunga|long sleeves", t):
            return "lunghe"
    if cat in ("maglia", "capospalla"):
        return "lunghe"     # maglioni, cardigan e giacche: quando le maniche sono corte il negozio lo scrive
    return None


def _nome(p):
    """Titolo e handle, più i soli tag strutturati (neckline:…, fit:…, print-group:…): dove il negozio dice fantasia,
    vestibilità e scollo. Gli altri tag sono rumore (collezioni, "print:Solid", "fit-liberty"), la descrizione parla d'altro."""
    tag = p.get("tags") or []
    tag = tag if isinstance(tag, list) else str(tag).split(",")
    buoni = [t for t in tag if re.match(r"\s*((neckline|fit[ _]?type|fit|print[-_ ]group|pattern)\s*:|fitfilter-)", t, re.I) and not re.search(r"solid|s[óo]lido", t, re.I)]
    return f"{p['title']} {p['handle'].replace('-', ' ')} {' '.join(buoni)}".lower()


FANTASIE = [
    ("righe", r"strip(e|ed|es)\b|pinstripe|breton|mariniere|marinière|ray[ée]|rayure|a righe|rigat|gestreift|\braya"),
    ("quadri", r"\bcheck(ed|s)?\b|plaid|tartan|gingham|houndstooth|pied[- ]de[- ]poule|carreaux|\bquadri|vichy|cuadros|kariert|\bmadras"),
    ("fiori", r"floral|flower|fleur|fleuri|\bfiori|florea|\bflores\b|blumen|\bliberty\b|botanical"),
    ("pois", r"polka|\bdots?\b|dotted|\bpois\b|lunares|tupfen"),
    ("animalier", r"leopard|léopard|zebra|snake|python|cheetah|tiger|animal[- ]?print|animalier|\bleo\b|croc[- ]print|giraffe"),
    ("stampa", r"\bprint(ed)?\b|imprim[ée]|paisley|tie[- ]dye|camo(uflage)?\b|\bstampa|estampad|graphic|jacquard|motif"),
]
VESTIBILITA = [
    ("oversize", r"oversi[sz]ed?|boyfriend|\bbaggy\b"),
    ("ampia", r"wide[- ]leg|\bwide\b|palazzo|\bloose\b|relaxed|\bflare[ds]?\b|balloon|barrel|culotte"),
    ("aderente", r"\bslim\b|skinny|fitted|bodycon|\bajust[ée]|moulant|aderent|second skin|\bcigarette"),
    ("regolare", r"regular fit|\bstraight\b|\bdroit\b|\bdritt|classic fit"),
]
SCOLLI = [
    ("v", r"v[- ]?neck|\bcol v\b|scollo a v|v[- ]neckline|\bwrap\b|cache[- ]coeur|portafoglio"),
    ("alto", r"turtle ?neck|roll[- ]?neck|mock[- ]?neck|high[- ]neck|funnel|col roul[ée]|dolcevita|collo alto|rollkragen|cuello alto"),
    ("spalle", r"off[- ]the[- ]shoulder|off[- ]shoulder|one[- ]shoulder|bardot|asymmetric neck|[ée]paules? d[ée]nud|monospalla"),
    ("quadrato", r"square[- ]neck|col carr[ée]|scollo quadrato"),
    ("americana", r"halter|all'americana|dos nu|neckholder"),
    ("giro", r"crew ?neck|round[- ]neck|\bcol rond\b|girocollo"),
]


def fantasia(p):
    t = _nome(p)
    return next((nome for nome, rx in FANTASIE if re.search(rx, t)), None)


def vestibilita(p, cat):
    if cat in ("scarpe",):
        return None
    t = _nome(p)
    return next((nome for nome, rx in VESTIBILITA if re.search(rx, t)), None)


def scollo(p, cat):
    if cat not in ("maglia", "camicia", "top", "abito"):
        return None
    t = _nome(p)
    return next((nome for nome, rx in SCOLLI if re.search(rx, t)), None)


# ---------- quanto è elegante un capo (Andrea 20/11: "se scelgo elegante non deve uscire una maglietta sportiva") ----------
# 0 sportivo · 1 casual · 2 curato · 3 elegante. Dal titolo e dal tipo prodotto, poi materiale e categoria; lo stile del
# negozio limita solo i casi estremi (un negozio sportivo non fa capi da sera). Regole, non indovinare: nel dubbio "curato".
RX_SPORT = re.compile(r"legging|sweat ?pants?|track ?(pants?|suit|jacket|top)|jogger|hoodie|hoody|sweatshirt|sweat\b|zip[- ]?up|"
                      r"sports? bra|activewear|\bactive\b|bike short|biker short|running|\bgym\b|yoga|tennis|fleece|"
                      r"\bsudadera|chándal|felpa|unitard|onesie|windbreaker|anorak|\bteddy\b")
RX_CASUAL = re.compile(r"zapatilla|deportiv|\bt-?shirts?\b|\bt shirts?\b|\btshirt|\btees?\b|tee-shirt|tank|graphic|\blogo|varsity|collegiate|"
                       r"\bcrop|baby tee|\bshorts?\b|cargo|overall|dungaree|\bcamo\b|distressed|ripped|\bdenim\b|\bjeans?\b|"
                       r"sneakers?|baskets|slides?|flip|clogs?|espadrill|\bpolo\b|rugby|henley|thermal|waffle|jersey dress|"
                       r"\bbucket\b|puffer|bomber|parka|rain|camiseta|vaquer|\bfun\b|slogan|print tee|souvenir")
RX_ELEGANTE = re.compile(r"\bgown|evening|cocktail|sequin|paillette|satin|silk|\bsoie\b|\bseta\b|velvet|velours|velluto|lace\b|dentelle|"
                         r"pizzo|tailored|tuxedo|smoking|blazer|\btrousers?\b|pleated|plissé|pumps?\b|stiletto|slingback|heels?\b|"
                         r"escarpin|d[ée]collet|corset|bustier|draped|drapé|organza|chiffon|tulle|crepe|crêpe|cady|brocade|jacquard|"
                         r"cashmere|cachemire|camel coat|wrap coat|wool coat|cappotto|manteau|\bcoat\b|trench|mary jane|kitten")
STILI_SPORT = {"Sportivo"}
STILI_STRADA = {"Streetwear", "Rock"}


def registro(p, cat, stile):
    """0 sportivo, 1 casual, 2 curato, 3 elegante."""
    t = f"{p['title']} {p['product_type']}".lower()
    if RX_SPORT.search(t):
        r = 0
    elif RX_ELEGANTE.search(t) and not RX_CASUAL.search(t):
        r = 3
    elif RX_CASUAL.search(t):
        r = 1
    else:
        r = {"top": 1, "jeans": 1, "scarpe": 2}.get(cat, 2)
    if stile in STILI_SPORT:
        r = min(r, 1)
    elif stile in STILI_STRADA:
        r = min(r, 2)
    return r


TIPI_SCARPE = [  # (nome nell'app, parole) — vince la prima che si trova
    ("stivaletti", r"ankle[\w -]{0,20}boot|bootie|bottine|stivalett|chelsea|botín"),
    ("stivali", r"\bboots?\b|bottes?\b|stival|botas?\b"),
    ("sneakers", r"sneaker|trainer|baskets?\b|running|tennis|zapatilla"),
    ("décolleté", r"\bpumps?\b|escarpin|d[ée]collet|stiletto|slingback|\bheels?\b"),
    ("sandali", r"sandal|espadrill"),
    ("mocassini", r"loafer|mocassin|moccasin|derby|derbies|oxford|brogue"),
    ("ballerine", r"ballet|ballerin|mary jane|\bflats?\b"),
    ("mules", r"\bmules?\b|\bclogs?\b|sabot|slides?\b"),
]


def tipo_scarpa(p):
    t = f"{p['title']} {p['product_type']} {p['handle'].replace('-', ' ')}".lower()
    return next((n for n, rx in TIPI_SCARPE if re.search(rx, t)), None)


def tacco(p):
    """'basso' (< 3 cm), 'medio' (3–7), 'alto' (> 7) dall'altezza scritta dal negozio, o dalle parole; None se non si sa."""
    corpo = re.sub(r"<[^>]+>", " ", p.get("body_html") or "").lower()
    t = f"{p['title']} {corpo}".lower()
    m = re.search(r"(?:heel|tacco|talon|absatz)[^.]{0,40}?(\d{1,2}(?:[.,]\d)?)\s*cm", t) or \
        re.search(r"(\d{1,2}(?:[.,]\d)?)\s*cm\s*(?:heel|tacco|talon|absatz)", t)
    if m:
        cm = float(m.group(1).replace(",", "."))
        if 0 < cm < 20:
            return "basso" if cm < 3 else "medio" if cm <= 7 else "alto"
    m = re.search(r"(\d(?:\.\d)?)\s*(?:\"|”|inch|in\b)\s*heel|heel[^.]{0,30}?(\d(?:\.\d)?)\s*(?:\"|”|inch)", t)
    if m:
        cm = float(m.group(1) or m.group(2)) * 2.54
        return "basso" if cm < 3 else "medio" if cm <= 7 else "alto"
    if re.search(r"stiletto|high heel|tacco alto|talon haut", t):
        return "alto"
    if re.search(r"kitten heel|block heel|mid heel|low heel", t):
        return "medio"
    if re.search(r"\bflat\b|\bflats\b|sneaker|trainer|ballet|ballerin|loafer|mocassin|slide", t):
        return "basso"
    return None


def numero_scarpa(etichetta, sistema, gen):
    """Taglia europea (35–47) di una variante di scarpa, o None. Le conversioni da US/UK sono indicative."""
    e = etichetta.upper().replace(",", ".")
    m = re.search(r"(?:EU|IT|FR)\s*(\d{2}(?:\.5)?)", e) or re.fullmatch(r"\s*(\d{2}(?:\.5)?)\s*(?:EU|IT|FR)?\s*", e)
    if m and 35 <= float(m.group(1)) <= 47.5:
        return int(float(m.group(1)))
    m = re.search(r"(US|UK|AU)\s*(\d{1,2}(?:\.5)?)", e) or re.search(r"(\d{1,2}(?:\.5)?)\s*(US|UK|AU)", e)
    if m:
        a, b = m.groups()
        sis, n = (a, float(b)) if a in ("US", "UK", "AU") else (b, float(a))
    elif re.fullmatch(r"\s*\d{1,2}(?:\.5)?\s*", e) and float(e) < 16:
        sis, n = sistema, float(e)
    else:
        return None
    if sis in ("FR", "IT"):
        return None
    uomo = gen == "u"
    eu = n + (33.5 if uomo else 33) if sis == "UK" else n + (33 if uomo else 30.5)
    eu = int(eu + 0.5)
    return eu if 35 <= eu <= 47 else None


def main():
    radice = Path(__file__).resolve().parent.parent
    cache = radice / ".cache"
    solo_cache = "--cache" in sys.argv
    negozi, out = [], []
    # verifiche fatte da catalogo.py nelle ultime 6 ore (stesso giro notturno): niente doppi controlli sui negozi
    try:
        v = json.loads((cache / "verifiche.json").read_text())
        verificati = v["negozi"] if __import__("time").time() - v["quando"] < 6 * 3600 else {}
    except Exception:
        verificati = {}
    verificati_ok = bool(verificati)
    for dominio, nome, sistema, stile, misto in C.NEGOZI:
        try:
            if solo_cache:
                dati = json.loads(gzip.decompress((cache / f"{dominio}.json.gz").read_bytes()))
            else:
                dati = C.leggi_negozio(dominio, cache)
        except Exception as e:
            print(f"!! {dominio}: {e}", file=sys.stderr)
            continue
        gia = verificati.get(dominio)          # catalogo.py ha appena controllato questo negozio: si riusa
        if gia:
            dati["host"] = gia["host"]
        elif verificati_ok:
            print(f"!! {dominio}: escluso da catalogo.py (non leggibile dal browser)", file=sys.stderr)
            continue
        elif not solo_cache:
            prova = [p["handle"] for p in dati["prodotti"] if any(v["available"] for v in p["variants"])][:3]
            host = next((h for h in (C.dal_vivo(dati["host"], x) for x in prova) if h), None)
            if not host:
                print(f"!! {dominio}: non leggibile dal browser, escluso", file=sys.stderr)
                continue
            dati["host"] = host
        n = len(negozi)
        negozi.append({"nome": nome, "dominio": dati["host"], "valuta": dati["valuta"], "sistema": sistema, "stile": stile,
                       "ue": dati["paese"] in C.UE})
        cambio = C.EURO.get(dati["valuta"], 1)
        primo = len(out)
        for p in dati["prodotti"]:
            if not p["images"]:
                continue
            gen = genere(p, dominio, misto)
            cat = gen and categoria(p)
            if not cat:
                continue
            it = C.opzione(p, r"size|taille|taglia|talla|grösse|storlek|str|pointure|numero")
            it = 0 if it is None else it
            immagini = {im["id"]: im["src"] for im in p["images"]}
            for valore, varianti in C.capi(p, sistema, cat):
                prodotte, disponibili = set(), set()
                for v in varianti:
                    et = v.get(f"option{it + 1}") or ""
                    if cat == "scarpe":
                        num = numero_scarpa(et, sistema, gen)
                        tt = [num] if num else []
                    else:
                        let = C.lettera(et, sistema, cat)
                        tt = [] if let is None else (C.TAGLIE if let == "*" else let.split("/"))
                    prodotte.update(tt)
                    if v["available"]:
                        disponibili.update(tt)
                if not disponibili:
                    continue
                scala = NUMERI_SCARPE if cat == "scarpe" else C.TAGLIE
                maschera = lambda ins: sum(1 << scala.index(t) for t in ins)
                col = C.colore(([valore] if valore else []) + [p["title"], p["handle"].replace("-", " ")])
                fi = varianti[0].get("featured_image") or {}
                img = (fi.get("src") or immagini.get(varianti[0].get("image_id")) or p["images"][0]["src"]).split("?")[0]
                prezzo = min(float(v["price"]) for v in varianti)
                out.append({
                    "n": n, "h": p["handle"], "t": re.sub(r"\s*[-–|]+\s*final sale\s*$", "", p["title"], flags=re.I), "c": cat, "g": gen,
                    "k": col[0] if col else None, "x": col[1] if col else None, "v": valore,
                    "p": prezzo, "e": round(prezzo * cambio),
                    "i": img.replace("https://cdn.shopify.com/s/files/", "~"),
                    "s": maschera(prodotte), "d": maschera(disponibili),
                })
                pieno = max((float(v.get("compare_at_price") or 0) for v in varianti), default=0)
                if pieno > prezzo * 1.04:          # in saldo: il negozio mostra il prezzo pieno barrato
                    out[-1]["o"] = round(pieno * cambio)
                out[-1]["r"] = registro(p, cat, stile)
                ts = tipo_scarpa(p) if cat == "scarpe" else None
                tc = tacco(p) if cat == "scarpe" else None
                if cat == "scarpe" and not tc and ts in ("sneakers", "ballerine", "mocassini"):
                    tc = "basso"
                extra = (("y", ts), ("u", tc)) if cat == "scarpe" else ()
                for chiave, val in (("f", materiale(p)), ("l", lunghezza(p, cat)), ("w", maniche(p, cat)),
                                    ("q", fantasia(p)), ("a", vestibilita(p, cat)), ("z", scollo(p, cat))) + extra:
                    if val:
                        out[-1][chiave] = val
        if gia:
            nascosti = set(gia["nascosti"])
            out[primo:] = [c for c in out[primo:] if c["h"] not in nascosti]
        elif not solo_cache and len(out) > primo:
            out[primo:] = C.togli_nascosti(dati["host"], out[primo:])[0]
        mio = out[primo:]
        conta = lambda g: sum(1 for c in mio if c["g"] == g)
        print(f"{nome:24} donna {conta('d'):5}  uomo {conta('u'):5}  unisex {conta('x'):4}  scarpe {sum(1 for c in mio if c['c'] == 'scarpe'):4}", file=sys.stderr)

    # colore dalla foto per chi non ce l'ha nel nome (stessa cache di catalogo.py)
    try:
        from colore_foto import misura_tutti
        senza = [c for c in out if c["k"] is None]
        url = lambda c: "https://cdn.shopify.com/s/files/" + c["i"][1:] if c["i"].startswith("~") else c["i"]
        if solo_cache:
            f = cache / "colori.json"
            misure = json.loads(f.read_text()) if f.exists() else {}
        else:
            misure = misura_tutti([url(c) for c in senza], cache / "colori.json")
        for c in senza:
            m = misure.get(url(c))
            if m:
                c["k"], c["x"], c["m"] = m[0], m[1], 1
    except ImportError:
        print("!! Pillow assente: colore dalla foto saltato", file=sys.stderr)

    base = {"aggiornato": datetime.now().strftime("%Y-%m-%d %H:%M"), "taglie": C.TAGLIE, "scarpe": NUMERI_SCARPE, "negozi": negozi}
    for nome, generi in (("donna", "dx"), ("uomo", "ux")):
        capi = [c for c in out if c["g"] in generi]
        dest = radice / "data" / f"v2-{nome}.json"
        dest.write_text(json.dumps({**base, "capi": capi}, ensure_ascii=False, separators=(",", ":")))
        per = {}
        for c in capi:
            per[c["c"]] = per.get(c["c"], 0) + 1
        print(f"\n{nome}: {len(capi)} capi → {dest.name} ({dest.stat().st_size // 1024} KB)  {per}", file=sys.stderr)


if __name__ == "__main__":
    main()
