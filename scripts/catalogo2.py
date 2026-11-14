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
                      r"blanket|skullcap|balaclava|\bthrow\b|kids?\b|baby|bebe|enfant|toddler|infant|pj\b|pyjama|pajama|sleep|robe de chambre|gift card|final sale item|laces?|insoles?|shoe care)")

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
    ("pantaloni", r"sweat ?pants?|track ?pants?|\bjoggers?\b|\bleggings?\b|\bchándal\b"),
    ("capospalla", r"overshirt|shacket|\bcazadora|\bgabardina|\babrigo|\bchaleco|\bparka"),
    ("maglia", r"\bsudadera|\bjers[eé]is?\b|\bc[aá]rdigan|\bsu[eé]ter|\bstrick|\bpulli"),
    ("top", r"\bcamiseta|\bt-shirt"),
    ("jeans", r"\bvaqueros?\b"),
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
