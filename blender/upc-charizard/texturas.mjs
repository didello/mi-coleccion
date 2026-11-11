// Texturas del modelo 3D de la Ultra-Premium Collection Mega Charizard X ex, sacadas de las fotos de la caja.
// Cada cara se endereza con una homografía a partir de sus 4 esquinas en la foto.
// Uso: node blender/upc-charizard/texturas.mjs
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const fotos = path.join(dir, 'fotos');
const out = path.join(dir, 'texturas');
fs.mkdirSync(out, { recursive: true });

// Homografía del cuadrado unidad a 4 puntos (TL, TR, BR, BL).
function homografia([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]) {
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h];
}

// puntos: esquinas de la cara en la foto, en el orden en que deben quedar en la textura:
// arriba-izquierda, arriba-derecha, abajo-derecha, abajo-izquierda.
async function cara(foto, puntos, ancho, alto, nombre) {
  const { data, info } = await sharp(path.join(fotos, foto)).raw().toBuffer({ resolveWithObject: true });
  const [a, b, c, d, e, f, g, h] = homografia(puntos);
  const C = info.channels, W = info.width, H = info.height;
  const res = Buffer.alloc(ancho * alto * 3);
  for (let j = 0; j < alto; j++) {
    for (let i = 0; i < ancho; i++) {
      const u = (i + 0.5) / ancho, v = (j + 0.5) / alto;
      const w = g * u + h * v + 1;
      const x = Math.min(W - 1.001, Math.max(0, (a * u + b * v + c) / w));
      const y = Math.min(H - 1.001, Math.max(0, (d * u + e * v + f) / w));
      const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
      for (let k = 0; k < 3; k++) {
        const p = (yy, xx) => data[(yy * W + xx) * C + k];
        res[(j * ancho + i) * 3 + k] = p(yi, xi) * (1 - fx) * (1 - fy) + p(yi, xi + 1) * fx * (1 - fy) +
          p(yi + 1, xi) * (1 - fx) * fy + p(yi + 1, xi + 1) * fx * fy;
      }
    }
  }
  await sharp(res, { raw: { width: ancho, height: alto, channels: 3 } })
    .jpeg({ quality: 86, mozjpeg: true }).toFile(path.join(out, nombre));
  console.log('ok', nombre);
}

// La caja de pie, con la tapa mirando al frente. Proporciones ~ 40 × 23,2 × 8,2 cm.
// Frontal (tapa) y trasera.
// La caja de pie, con la tapa mirando al frente: mismas medidas que la UPC 30th (40 × 23,2 × 8,2 cm).
await cara('frente.webp', [[83, 44], [1535, 48], [1528, 906], [78, 894]], 1600, 928, 'frente.jpg');
await cara('trasera.webp', [[37, 42], [927, 45], [925, 567], [39, 549]], 1024, 594, 'trasera.jpg');
// Canto de arriba (abajo de la textura = borde delantero) y canto de abajo (arriba = borde delantero).
await cara('arriba.png', [[64, 77], [931, 66], [948, 272], [70, 298]], 1024, 210, 'arriba.jpg');
await cara('abajo.png', [[18, 46], [950, 50], [946, 262], [14, 266]], 1024, 210, 'abajo.jpg');
// Los dos laterales salen de la misma foto (la caja tiene los dos iguales), girada para la caja de pie.
await cara('lado.webp', [[942, 30], [942, 393], [65, 377], [90, 22]], 210, 594, 'lado-izq.jpg');
await cara('lado.webp', [[65, 377], [90, 22], [942, 30], [942, 393]], 210, 594, 'lado-der.jpg');
