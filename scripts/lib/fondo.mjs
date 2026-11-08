// Quita el fondo blanco liso de una foto de producto (lo que toca los bordes de la imagen),
// sin tocar los blancos de dentro del producto. Devuelve un PNG con transparencia.
import sharp from "sharp";

export async function quitarFondoBlanco(input, { umbral = 238, tolerancia = 14 } = {}) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const blanco = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    return Math.min(r, g, b) >= umbral && Math.max(r, g, b) - Math.min(r, g, b) <= tolerancia;
  };
  // Relleno desde los bordes: solo el blanco conectado con el exterior es fondo.
  const fondo = new Uint8Array(w * h);
  const cola = new Int32Array(w * h);
  let ini = 0, fin = 0;
  const push = (p) => { if (!fondo[p] && blanco(p * 4)) { fondo[p] = 1; cola[fin++] = p } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x) }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1) }
  while (ini < fin) {
    const p = cola[ini++], x = p % w, y = (p / w) | 0;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (y > 0) push(p - w);
    if (y < h - 1) push(p + w);
  }
  // Borde suave: los píxeles del producto que tocan el fondo se vuelven algo transparentes según lo claros que sean.
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (fondo[p]) { data[i + 3] = 0; continue }
    const x = p % w, y = (p / w) | 0;
    const toca = (x > 0 && fondo[p - 1]) || (x < w - 1 && fondo[p + 1]) || (y > 0 && fondo[p - w]) || (y < h - 1 && fondo[p + w]);
    if (toca) {
      const claro = Math.min(data[i], data[i + 1], data[i + 2]);
      data[i + 3] = Math.round(255 * Math.min(1, Math.max(0.35, (255 - claro) / 60)));
    }
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).trim({ threshold: 1 }).png().toBuffer();
}
