// Controllo senza intelligenza artificiale delle immagini generate (19/11): trova i pezzi staccati dalla figura.
// L'immagine ha la figura su fondo bianco: ogni gruppo di pixel non bianchi separato dalla figura da fondo bianco è un difetto
// (il ciuffo che galleggia accanto al viso, un pezzo di stoffa, una sagoma accanto). L'ombra sotto i piedi non conta.
const L = 240;   // larghezza di lavoro: veloce e abbastanza fine per un ciuffo
/** Restituisce { ok, isole: [{x, y, w, h, area}] } in proporzioni 0–1. Se l'immagine non si legge: ok (non si blocca nessuno). */
export async function isole(src) {
  let im;
  try { im = new Image(); im.crossOrigin = "anonymous"; im.src = src; await im.decode(); } catch { return { ok: true, saltato: true }; }
  const W = L, H = Math.round(L * im.naturalHeight / im.naturalWidth), cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const cx = cv.getContext("2d", { willReadFrequently: true }); cx.drawImage(im, 0, 0, W, H);
  let px; try { px = cx.getImageData(0, 0, W, H).data; } catch { return { ok: true, saltato: true }; }
  // fondo: il colore degli angoli (bianco o grigio chiarissimo)
  const ang = [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]].map(([x, y]) => { const i = (y * W + x) * 4; return (px[i] + px[i + 1] + px[i + 2]) / 3; });
  const fondo = Math.max(...ang), soglia = fondo - 28;
  const pieno = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) { const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2]; if (Math.min(r, g, b) < soglia || Math.max(r, g, b) - Math.min(r, g, b) > 30) pieno[i] = 1; }
  // gruppi collegati (8 vicini)
  const gruppo = new Int32Array(W * H).fill(-1), gruppi = [], pila = [];
  for (let i = 0; i < W * H; i++) {
    if (!pieno[i] || gruppo[i] >= 0) continue;
    const id = gruppi.length, g = { area: 0, x0: W, y0: H, x1: 0, y1: 0 }; gruppi.push(g);
    gruppo[i] = id; pila.push(i);
    while (pila.length) {
      const j = pila.pop(), x = j % W, y = (j - x) / W;
      g.area++; if (x < g.x0) g.x0 = x; if (x > g.x1) g.x1 = x; if (y < g.y0) g.y0 = y; if (y > g.y1) g.y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const k = yy * W + xx; if (pieno[k] && gruppo[k] < 0) { gruppo[k] = id; pila.push(k); }
      }
    }
  }
  if (!gruppi.length) return { ok: true };
  // la figura = i gruppi grandi (testa, busto, gambe: una maglia bianca può separarli). Per ogni riga, dove sta la figura.
  const grande = W * H * 0.004, figura = new Set(gruppi.map((g, i) => g.area >= grande ? i : -1).filter(i => i >= 0));
  const da = new Int32Array(H).fill(W), a_ = new Int32Array(H).fill(-1);
  for (let i = 0; i < W * H; i++) if (figura.has(gruppo[i])) { const x = i % W, y = (i - x) / W; if (x < da[y]) da[y] = x; if (x > a_[y]) a_[y] = x; }
  const minimo = Math.max(8, W * H * 0.0002), margine = Math.max(3, W * 0.015);
  const bordo = g => g.x0 === 0 || g.y0 === 0 || g.x1 === W - 1 || g.y1 === H - 1;   // sfumature del fondo ai bordi
  let cima = 0, fondoFig = H - 1; while (cima < H && a_[cima] < 0) cima++; while (fondoFig > 0 && a_[fondoFig] < 0) fondoFig--;
  const piedi = fondoFig - (fondoFig - cima) * 0.09;   // ultimo 9% della figura: ombre e suole, non si giudicano
  const trovate = [];
  gruppi.forEach((g, i) => {
    if (figura.has(i) || g.area < minimo || bordo(g) || g.y0 >= piedi) return;
    let s0 = W, s1 = -1;
    for (let y = g.y0; y <= g.y1; y++) if (a_[y] >= 0) { s0 = Math.min(s0, da[y]); s1 = Math.max(s1, a_[y]); }
    if (s1 < 0) {                                   // in righe senza figura: sopra la testa o sotto i piedi
      const sopra = g.y1 < H / 2; if (!sopra) return;   // sotto i piedi = ombra
      trovate.push(g); return;
    }
    const stacco = Math.max(s0 - g.x1, g.x0 - s1);  // distanza dalla figura nelle stesse righe
    if (stacco > margine) trovate.push(g);
  });
  const out = trovate.map(g => ({ x: g.x0 / W, y: g.y0 / H, w: (g.x1 - g.x0 + 1) / W, h: (g.y1 - g.y0 + 1) / H, area: g.area / (W * H) }));
  return { ok: !out.length, isole: out };
}
