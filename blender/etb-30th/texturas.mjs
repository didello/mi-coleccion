// Texturas del modelo 3D de la Elite Trainer Box Pokémon Center 30th Celebration, sacadas de las fotos de la caja.
// Cada cara se endereza con una homografía a partir de sus 4 esquinas en la foto.
// Uso: node blender/etb-30th/texturas.mjs
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
// La caja de pie con la cara grande al frente, como las UPC. Medidas de una ETB del Pokémon Center:
// 7,5 × 6,5 × 3,5 pulgadas (19,1 × 16,5 × 8,9 cm), más pequeña que las UPC.
// Frontal: foto de frente y sin perspectiva (frente-2).
await cara('frente-2.webp', [[47, 397], [1157, 393], [1170, 1373], [40, 1372]], 1158, 1000, 'frente.jpg');
await cara('trasera.webp', [[132, 2], [800, 2], [930, 598], [18, 598]], 1024, 885, 'trasera.jpg');
// Canto de arriba (abajo de la textura = borde delantero) y canto de abajo (arriba = borde delantero).
await cara('arriba.png', [[80, 9], [876, 9], [897, 388], [74, 388]], 1024, 477, 'arriba.jpg');
await cara('abajo.webp', [[15, 52], [950, 48], [945, 470], [25, 468]], 1024, 477, 'abajo.jpg');
// Laterales (fotos con la caja tumbada, la tapa naranja a la izquierda): se giran para dejar la tapa arriba.
await cara('lado-izq-2.webp', [[148, 545], [145, 195], [790, 205], [785, 540]], 477, 885, 'lado-izq.jpg');
await cara('lado-der-2.webp', [[258, 958], [252, 352], [1393, 345], [1395, 925]], 477, 885, 'lado-der.jpg');
