// Stagione dei colori da una foto del viso. Tutto nel browser: la foto non viene inviata.
// Punti del viso con MediaPipe → colore di pelle, capelli e occhi → sottotono (caldo/freddo) e profondità.
// È una stima con soglie fisse, non verificata su persone reali: l'app lo dice e lascia correggere a mano.
import { lab } from "./stylist.js";

let lettore = null;
async function carica() {
  if (lettore) return lettore;
  const v = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs");
  const files = await v.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
  lettore = await v.FaceLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", delegate: "CPU" },
    runningMode: "IMAGE", numFaces: 1,
  });
  return lettore;
}
const hex = rgb => "#" + rgb.map(v => v.toString(16).padStart(2, "0")).join("");
/** Colore mediano di un quadratino attorno al punto: un riflesso o un'ombra non lo falsano. */
function campiona(ctx, x, y, r) {
  const d = ctx.getImageData(Math.max(0, x - r), Math.max(0, y - r), 2 * r + 1, 2 * r + 1).data, px = [];
  for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
  px.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
  return lab(hex(px[px.length >> 1]));
}
/** @returns { stagione, caldo, profondo } oppure null se nella foto non c'è un viso. */
export async function stagioneDaFoto(file) {
  const im = new Image();
  im.src = URL.createObjectURL(file);
  await im.decode();
  const lm = await carica();
  const cv = document.createElement("canvas"), s = Math.min(1, 900 / Math.max(im.naturalWidth, im.naturalHeight));
  cv.width = Math.round(im.naturalWidth * s); cv.height = Math.round(im.naturalHeight * s);
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(im, 0, 0, cv.width, cv.height);
  URL.revokeObjectURL(im.src);
  const p = lm.detect(cv).faceLandmarks?.[0];
  if (!p) return null;
  const P = i => [Math.round(p[i].x * cv.width), Math.round(p[i].y * cv.height)];
  const altezza = Math.hypot(P(10)[0] - P(152)[0], P(10)[1] - P(152)[1]), r0 = Math.max(2, Math.round(altezza / 40));
  const pelle = [50, 280, 151].map(i => campiona(ctx, ...P(i), r0)).reduce((a, b) => a.map((v, i) => v + b[i] / 3), [0, 0, 0]);
  const occhi = [468, 473].map(i => campiona(ctx, ...P(i), Math.max(1, r0 >> 1)));
  const [fx, fy] = P(10), [cx, cy] = P(152), ux = (fx - cx) / altezza, uy = (fy - cy) / altezza;
  const capelli = campiona(ctx, Math.round(fx + ux * altezza * .12), Math.max(r0, Math.round(fy + uy * altezza * .12)), r0);
  const tinta = Math.atan2(pelle[2], pelle[1]) * 180 / Math.PI;
  const scuri = (capelli[0] + (occhi[0][0] + occhi[1][0]) / 2) / 2, contrasto = pelle[0] - capelli[0];
  const croma = Math.hypot(capelli[1], capelli[2]), tintaCapelli = Math.atan2(capelli[2], capelli[1]) * 180 / Math.PI;
  const spinta = croma > 18 && tintaCapelli > 35 && tintaCapelli < 85 ? 5 : croma < 10 ? -3 : 0;   // ramati/dorati → caldo; neri/cenere → freddo
  const caldo = (tinta - 52) + spinta > 0, profondo = scuri < 32 || contrasto > 40;
  return { stagione: caldo ? (profondo ? "autunno" : "primavera") : (profondo ? "inverno" : "estate"), caldo, profondo };
}
