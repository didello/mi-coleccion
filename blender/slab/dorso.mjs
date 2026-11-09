// Reversos de las cartas para el slab 3D, enderezados a partir de fotos de la parte de atrás de un slab.
// Uso: node blender/slab/dorso.mjs  ->  public/modelos/dorso-pokemon.jpg y dorso-dragonball.jpg
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(dir, '..', '..');
const ANCHO = 630, ALTO = 880;

function homografia([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]) {
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den, h = (dx1 * sy - sx * dy1) / den;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h];
}

// Esquinas de la carta dentro del slab (arriba-izq, arriba-der, abajo-der, abajo-izq) y el color con el
// que se pintan las esquinas redondeadas (lo que queda fuera de la carta).
const DORSOS = [
  { foto: 'slab-trasera.webp', puntos: [[445, 905], [1005, 906], [1032, 1734], [418, 1749]], esquina: '#232a63',
    // El plástico rojizo de esa foto tiñe la carta: un poco más de contraste y menos rojo.
    ajuste: [[1.08, 1.12, 1.12], [-14, -10, -6]], destino: 'dorso-pokemon.jpg' },
  // Dragon Ball: escaneo del reverso de un slab de PSA (imagen de producto de GameStop), sin reflejos.
  { foto: 'dorso-dragonball-gamestop.jpg', puntos: [[158, 652], [1267, 652], [1267, 2197], [163, 2197]], esquina: '#9a95a1',
    ajuste: null, destino: 'dorso-dragonball.jpg' },
];

// Quita rayas y manchas claras del fondo oscuro sin tocar las bolas, su brillo ni el texto naranja:
// el fondo se rehace como un degradado oscuro y liso (el tono medio del fondo de la foto, muy difuminado)
// y se funde suavemente con lo naranja.
async function limpiarFondo(buf, zona) {
  const raw1 = { raw: { width: ANCHO, height: ALTO, channels: 1 } };
  // Lo naranja (bolas, brillo, letras y marco).
  const naranja = Buffer.alloc(ANCHO * ALTO);
  for (let p = 0; p < ANCHO * ALTO; p++) {
    const r = buf[p * 3], g = buf[p * 3 + 1], b = buf[p * 3 + 2];
    // Cálido (amarillo, naranja o rojo): las rayas y manchas de la foto son blancas o grises y no entran.
    naranja[p] = r > 60 && r - b > 30 ? 255 : 0;
  }
  // Peso de "esto es naranja o está pegado a ello": 1 dentro, se desvanece en unos píxeles.
  const cerca = await sharp(naranja, raw1).blur(7).extractChannel(0).raw().toBuffer();
  if (cerca.length !== ANCHO * ALTO) throw new Error('máscara con tamaño inesperado: ' + cerca.length);
  // Tono del fondo: la mediana de los píxeles oscuros del recuadro (sin naranja ni rayas).
  const oscuros = [[], [], []];
  for (let y = zona.y0; y < zona.y1; y += 2) for (let x = zona.x0; x < zona.x1; x += 2) {
    const p = y * ANCHO + x;
    if (cerca[p] > 2) continue;
    const l = buf[p * 3] + buf[p * 3 + 1] + buf[p * 3 + 2];
    if (l < 150) for (let k = 0; k < 3; k++) oscuros[k].push(buf[p * 3 + k]);
  }
  const med = oscuros.map((a) => a.sort((m, n) => m - n)[Math.floor(a.length / 2)]);
  // Una viñeta suave como la de la carta: algo más claro en el centro.
  const res = Buffer.from(buf);
  const cx = (zona.x0 + zona.x1) / 2, cy = (zona.y0 + zona.y1) / 2, rx = (zona.x1 - zona.x0) / 2, ry = (zona.y1 - zona.y0) / 2;
  for (let y = zona.y0; y < zona.y1; y++) for (let x = zona.x0; x < zona.x1; x++) {
    const p = y * ANCHO + x;
    const d = Math.min(1, Math.hypot((x - cx) / rx, (y - cy) / ry));
    const f = 1.12 - 0.22 * d * d;
    const t = Math.min(1, cerca[p] / 60); // 0 fondo limpio, 1 original
    for (let k = 0; k < 3; k++) {
      const limpio = Math.min(255, med[k] * f);
      res[p * 3 + k] = Math.round(limpio * (1 - t) + buf[p * 3 + k] * t);
    }
  }
  return res;
}

for (const D of DORSOS) {
  const { data, info } = await sharp(path.join(dir, 'fotos', D.foto)).raw().toBuffer({ resolveWithObject: true });
  const [a, b, c, d, e, f, g, h] = homografia(D.puntos);
  const C = info.channels, W = info.width, H = info.height, out = Buffer.alloc(ANCHO * ALTO * 3);
  for (let j = 0; j < ALTO; j++) for (let i = 0; i < ANCHO; i++) {
    const u = (i + 0.5) / ANCHO, v = (j + 0.5) / ALTO, w = g * u + h * v + 1;
    const x = Math.min(W - 1.001, Math.max(0, (a * u + b * v + c) / w)), y = Math.min(H - 1.001, Math.max(0, (d * u + e * v + f) / w));
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    for (let k = 0; k < 3; k++) {
      const p = (yy, xx) => data[(yy * W + xx) * C + k];
      out[(j * ANCHO + i) * 3 + k] = p(yi, xi) * (1 - fx) * (1 - fy) + p(yi, xi + 1) * fx * (1 - fy) + p(yi + 1, xi) * (1 - fx) * fy + p(yi + 1, xi + 1) * fx * fy;
    }
  }
  const limpio = D.limpiar ? await limpiarFondo(out, D.limpiar) : out;
  let img = sharp(limpio, { raw: { width: ANCHO, height: ALTO, channels: 3 } });
  if (D.ajuste) img = img.linear(...D.ajuste);
  const destino = path.join(raiz, 'public', 'modelos', D.destino);
  await img
    .composite([{ input: Buffer.from(`<svg width="${ANCHO}" height="${ALTO}" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" fill="${D.esquina}" d="M0 0H${ANCHO}V${ALTO}H0Z M30 0H${ANCHO - 30}A30 30 0 0 1 ${ANCHO} 30V${ALTO - 30}A30 30 0 0 1 ${ANCHO - 30} ${ALTO}H30A30 30 0 0 1 0 ${ALTO - 30}V30A30 30 0 0 1 30 0Z"/><rect x="0" y="0" width="${ANCHO}" height="${ALTO}" fill="none" stroke="${D.esquina}" stroke-width="10"/></svg>`) }])
    .jpeg({ quality: 84, mozjpeg: true }).toFile(destino);
  console.log('ok', destino);
}
