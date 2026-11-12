"""Colore del capo misurato dalla foto del negozio (per i capi il cui nome non dice il colore).

Scarica una miniatura (60 px) dal CDN di Shopify, toglie lo sfondo (stimato dai bordi) e, se resta abbastanza capo,
anche la pelle; poi prende il colore più frequente al centro dell'immagine. È una stima: l'app la presenta come tale.
"""
import io, json, subprocess, colorsys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image

# colori base tra cui scegliere il nome (nome italiano, esadecimale)
BASE = [
    ("Nero", "#141414"), ("Antracite", "#3e3e42"), ("Grigio", "#8d8d8d"), ("Grigio chiaro", "#c8c8c6"), ("Bianco", "#f7f7f5"),
    ("Avorio", "#f1ead8"), ("Beige", "#d6c3a3"), ("Tortora", "#8b7d6b"), ("Cammello", "#b0814f"), ("Marrone", "#5a3d2b"),
    ("Cioccolato", "#3f2a20"), ("Ruggine", "#a4452a"), ("Kaki", "#8a7f55"), ("Oliva", "#6b6b3a"), ("Salvia", "#9caf88"),
    ("Verde", "#3f6b45"), ("Verde bosco", "#22412c"), ("Petrolio", "#1f5560"), ("Blu navy", "#1c2541"), ("Blu", "#2f5d9e"),
    ("Azzurro", "#8fb6dd"), ("Denim", "#4a6382"), ("Viola", "#5e3a87"), ("Lilla", "#c3a6d8"), ("Bordeaux", "#5c1a26"),
    ("Rosso", "#b3202a"), ("Rosa", "#e7a3b5"), ("Cipria", "#e8bfb6"), ("Fucsia", "#c71585"), ("Corallo", "#f07e6e"),
    ("Arancione", "#e5762b"), ("Senape", "#c9a227"), ("Giallo", "#f0cf3a"),
]


def _lab(rgb):
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(float(c)) for c in rgb)
    x, y, z = (r * .4124 + g * .3576 + b * .1805) / .95047, r * .2126 + g * .7152 + b * .0722, (r * .0193 + g * .1192 + b * .9505) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    return 116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))


def _hex(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


BASE_LAB = [(n, h, _lab(_hex(h))) for n, h in BASE]


def nome(rgb):
    L = _lab(rgb)
    return min(BASE_LAB, key=lambda b: sum((p - q) ** 2 for p, q in zip(L, b[2])))[:2]


def _pelle(r, g, b):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return (h < 0.11 or h > 0.97) and 0.18 < s < 0.6 and v > 0.35 and r > g > b


def misura(url):
    """(nome, esadecimale) del colore principale, o None se la foto non si legge."""
    try:
        r = subprocess.run(["curl", "-sfL", "-m", "20", f"{url}?width=60"], capture_output=True, check=True)
        im = Image.open(io.BytesIO(r.stdout)).convert("RGB")
    except Exception:
        return None
    w, h = im.size
    px = im.load()
    bordo = [px[x, 0] for x in range(w)] + [px[0, y] for y in range(h)] + [px[w - 1, y] for y in range(h)]
    sfondo = tuple(sorted(c[i] for c in bordo)[len(bordo) // 2] for i in range(3))
    centro = [px[x, y] for x in range(int(w * .25), int(w * .75)) for y in range(int(h * .2), int(h * .85))]
    capo = [c for c in centro if sum((a - b) ** 2 for a, b in zip(c, sfondo)) > 900]
    if len(capo) < len(centro) * 0.08:  # capo dello stesso colore dello sfondo (es. bianco su bianco)
        capo = centro
    senza_pelle = [c for c in capo if not _pelle(*c)]
    if len(senza_pelle) > len(capo) * 0.3:
        capo = senza_pelle
    secchi = {}
    for c in capo:
        secchi.setdefault(tuple(v // 24 for v in c), []).append(c)
    top = max(secchi.values(), key=len)
    media = tuple(round(sum(c[i] for c in top) / len(top)) for i in range(3))
    n, _ = nome(media)
    return n, "#%02x%02x%02x" % media


def misura_tutti(urls, cache_file):
    """Misura in parallelo, con cache su disco (le foto di un capo non cambiano)."""
    cache_file = Path(cache_file)
    cache = json.loads(cache_file.read_text()) if cache_file.exists() else {}
    cache = {u: v for u, v in cache.items() if v}  # i fallimenti (rete, foto illeggibile) si riprovano
    da_fare = [u for u in set(urls) if u not in cache]
    with ThreadPoolExecutor(24) as ex:
        for u, r in zip(da_fare, ex.map(misura, da_fare)):
            cache[u] = r
    cache_file.write_text(json.dumps(cache))
    return cache
