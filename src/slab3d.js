// Slab 3D de las cartas gradeadas: el modelo (public/modelos/slab.glb, hecho en blender/slab) es el mismo
// para todas; aquí se dibujan la etiqueta de delante, la de detrás y la carta de cada pieza y se le ponen
// como texturas al abrir su ficha.
import qrcode from "qrcode-generator";

const LABEL_W = 1280, LABEL_H = 380; // 64 × 19 mm
const CARD_W = 630, CARD_H = 880; // 63 × 88 mm
const FONT = "Arial, Helvetica, sans-serif";
const PSA_RED = "#d0233a", INK = "#1d1f22";

// --- Código de barras Code 128 (juego B): el número de certificado, como en la etiqueta real ---
const C128 = "212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112".split(" ");
function code128(text) {
  const vals = [...String(text)].map((ch) => Math.min(94, Math.max(0, ch.charCodeAt(0) - 32)));
  const check = (104 + vals.reduce((s, v, i) => s + v * (i + 1), 0)) % 103;
  return [104, ...vals, check, 106].map((v) => C128[v]).join(""); // anchos alternos barra/espacio
}
export function drawBarcode(ctx, text, x, y, w, h, color = INK) {
  const widths = [...code128(text)].map(Number), total = widths.reduce((a, b) => a + b, 0), u = w / total;
  let cx = x;
  widths.forEach((bw, i) => { if (i % 2 === 0) { ctx.fillStyle = color; ctx.fillRect(cx, y, bw * u, h); } cx += bw * u; });
}

// Texto en una línea que encoge hasta caber en el ancho.
export function fitText(ctx, text, x, y, maxW, size, weight = 400, align = "left") {
  let s = size;
  do { ctx.font = `${weight} ${s}px ${FONT}`; s -= 1; } while (ctx.measureText(text).width > maxW && s > 10);
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}

// Logo de PSA sobre el holograma plateado. escudo: con la punta abajo, como el de la etiqueta trasera.
function psaHolo(ctx, x, y, w, h, escudo = false, letras = h * .72) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, "#c3c9d3"); g.addColorStop(.3, "#f2f4f8"); g.addColorStop(.5, "#b3c0d6"); g.addColorStop(.7, "#e9ecf2"); g.addColorStop(1, "#a9b2c0");
  ctx.fillStyle = g;
  ctx.beginPath();
  if (escudo) { ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h * .78); ctx.lineTo(x + w / 2, y + h); ctx.lineTo(x, y + h * .78); ctx.closePath(); }
  else ctx.rect(x, y, w, h);
  ctx.fill();
  // Trama fina del holograma.
  ctx.save(); ctx.clip(); ctx.strokeStyle = "rgba(120,135,160,.18)"; ctx.lineWidth = 2;
  for (let k = -h; k < w; k += 9) { ctx.beginPath(); ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + h, y); ctx.stroke(); }
  ctx.restore();
  ctx.font = `italic 900 ${letras}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const cx = x + w / 2, cy = y + (escudo ? h * .42 : h * .5), sw = ctx.measureText("S").width, pw = ctx.measureText("P").width;
  ctx.fillStyle = "#1c3d8f"; ctx.fillText("P", cx - sw / 2 - pw / 2, cy); ctx.fillText("A", cx + sw / 2 + ctx.measureText("A").width / 2, cy);
  ctx.fillStyle = PSA_RED; ctx.fillText("S", cx, cy);
  ctx.textBaseline = "alphabetic";
}

export function frontLabel(L) {
  const c = document.createElement("canvas"); c.width = LABEL_W; c.height = LABEL_H;
  const x = c.getContext("2d");
  x.fillStyle = L.grader === "PSA" ? PSA_RED : "#3a3f46"; x.fillRect(0, 0, LABEL_W, LABEL_H);
  const b = 26; // marco rojo
  const g = x.createLinearGradient(0, 0, LABEL_W, LABEL_H); g.addColorStop(0, "#fbfbf8"); g.addColorStop(.5, "#ffffff"); g.addColorStop(1, "#f1f2ef");
  x.fillStyle = g; x.fillRect(b, b, LABEL_W - 2 * b, LABEL_H - 2 * b);
  x.fillStyle = INK;
  const lx = 64, rx = LABEL_W - 64, top = 112, step = 62, leftW = 760;
  L.left.slice(0, 3).forEach((t, i) => fitText(x, t, lx, top + i * step, leftW, 54));
  L.right.slice(0, 3).forEach((t, i) => fitText(x, t, rx, top + i * step, LABEL_W - leftW - 150, 54, 400, "right"));
  // Número de certificado y código de barras solo cuando lo has puesto en la app.
  if (L.cert) {
    drawBarcode(x, L.cert, lx, 262, 380, 62);
    fitText(x, L.cert, rx, 318, 380, 56, 400, "right");
  }
  // El holograma de delante es una pegatina que baja por encima del marco rojo.
  if (L.grader === "PSA") psaHolo(x, 548, 240, 184, LABEL_H - 240, false, 64);
  else { x.fillStyle = INK; fitText(x, L.grader, LABEL_W / 2, 318, 220, 60, 800, "center"); }
  return c;
}

export function backLabel(L) {
  const c = document.createElement("canvas"); c.width = LABEL_W; c.height = LABEL_H;
  const x = c.getContext("2d");
  x.fillStyle = "#3a3845"; x.fillRect(0, 0, LABEL_W, LABEL_H);
  // Franja clara de abajo con el código de barras y el certificado.
  x.fillStyle = "#eef0f2"; x.fillRect(0, 282, LABEL_W, 98);
  x.fillStyle = "#c8cdd3"; x.fillRect(0, 282, LABEL_W, 4);
  if (L.cert) {
    drawBarcode(x, L.cert, 70, 298, 420, 64);
    x.fillStyle = INK; fitText(x, L.cert, LABEL_W - 70, 352, 420, 58, 400, "right");
  }
  // Logo, holograma y QR al certificado.
  x.fillStyle = "#ffffff"; fitText(x, L.grader, 70, 205, 330, 150, 900);
  if (L.grader === "PSA") psaHolo(x, 520, 0, 250, 200, true, 92);
  if (L.cert) {
    const q = qrcode(0, "M"); q.addData(L.qr || L.cert); q.make();
    const n = q.getModuleCount(), size = 226, m = size / (n + 2), qx = LABEL_W - 80 - size, qy = 30;
    x.fillStyle = "#ffffff"; x.beginPath(); x.roundRect(qx - 10, qy - 10, size + 20, size + 20, 18); x.fill();
    x.fillStyle = "#000000";
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect(qx + (k + 1) * m, qy + (r + 1) * m, Math.ceil(m), Math.ceil(m));
  }
  return c;
}

function loadImg(src) {
  return new Promise((ok, ko) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = ko; i.src = src; });
}
function roundedClip(x, w, h, r) {
  x.beginPath(); x.moveTo(r, 0); x.arcTo(w, 0, w, h, r); x.arcTo(w, h, 0, h, r); x.arcTo(0, h, 0, 0, r); x.arcTo(0, 0, w, 0, r); x.closePath(); x.clip();
}
// Carta: una URL, o una celda de una hoja de sprites de 10 × 10 ({sheet, cell, rot}).
export async function cardFace(src, CARD_W = 630, CARD_H = 880, radio = 26) {
  const c = document.createElement("canvas"); c.width = CARD_W; c.height = CARD_H;
  const x = c.getContext("2d");
  x.fillStyle = "#16181c"; x.fillRect(0, 0, CARD_W, CARD_H);
  if (!src) return c;
  try {
    const img = await loadImg(src.sheet || src.url);
    x.save(); roundedClip(x, CARD_W, CARD_H, radio);
    if (src.sheet) {
      const cw = img.naturalWidth / 10, ch = img.naturalHeight / 10, cell = +src.cell, sx = (cell % 10) * cw, sy = Math.floor(cell / 10) * ch;
      if (src.rot) { x.translate(CARD_W, 0); x.rotate(Math.PI / 2); x.drawImage(img, sx, sy, cw, ch, 0, 0, CARD_H, CARD_W); }
      else x.drawImage(img, sx, sy, cw, ch, 0, 0, CARD_W, CARD_H);
    } else {
      // Ajusta la imagen a la carta sin deformarla (recorta lo que sobre).
      const s = Math.max(CARD_W / img.naturalWidth, CARD_H / img.naturalHeight), w = img.naturalWidth * s, h = img.naturalHeight * s;
      x.drawImage(img, (CARD_W - w) / 2, (CARD_H - h) / 2, w, h);
    }
    x.restore();
  } catch (e) { /* sin imagen: se queda la carta oscura */ }
  return c;
}

// Dorso genérico para las cartas que no son de Pokémon (no tenemos foto de su reverso).
export function genericBack(title) {
  const c = document.createElement("canvas"); c.width = CARD_W; c.height = CARD_H;
  const x = c.getContext("2d");
  x.save(); roundedClip(x, CARD_W, CARD_H, 26);
  const g = x.createLinearGradient(0, 0, CARD_W, CARD_H); g.addColorStop(0, "#1c2333"); g.addColorStop(1, "#0d1018");
  x.fillStyle = g; x.fillRect(0, 0, CARD_W, CARD_H);
  x.strokeStyle = "rgba(255,255,255,.12)"; x.lineWidth = 14; x.strokeRect(28, 28, CARD_W - 56, CARD_H - 56);
  x.fillStyle = "rgba(255,255,255,.28)"; fitText(x, title.toUpperCase(), CARD_W / 2, CARD_H / 2 + 20, CARD_W - 120, 64, 800, "center");
  x.restore();
  return c;
}

const toURL = (canvas) => new Promise((ok) => canvas.toBlob((b) => ok(URL.createObjectURL(b)), "image/png"));

// Pone las texturas de la pieza en el slab. mv: el <model-viewer> con slab.glb.
export async function dressSlab(mv, { label, card, back }) {
  if (!mv.loaded) await new Promise((ok) => mv.addEventListener("load", ok, { once: true }));
  const faces = {
    Etiqueta: frontLabel(label),
    EtiquetaTrasera: backLabel(label),
    Carta: await cardFace(card),
    CartaTrasera: typeof back === "string" ? back : genericBack(back.title),
  };
  const urls = [];
  for (const m of mv.model.materials) {
    const f = faces[m.name];
    if (!f) continue;
    const url = typeof f === "string" ? f : await toURL(f);
    if (typeof f !== "string") urls.push(url);
    const tex = await mv.createTexture(url);
    m.pbrMetallicRoughness.baseColorTexture.setTexture(tex);
  }
  setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 4000);
}
