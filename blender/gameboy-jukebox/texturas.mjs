// Genera las texturas del modelo 3D del Game Boy Jukebox a partir de las fotos del producto.
// Endereza cada cara de la caja (homografía) y la guarda como imagen plana.
// Uso: node blender/gameboy-jukebox/texturas.mjs
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const fotos = path.join(dir, 'fotos');
const out = path.join(dir, 'texturas');
fs.mkdirSync(out, { recursive: true });

// Resuelve la homografía que lleva el cuadrado unidad a los 4 puntos (TL, TR, BR, BL).
function homografia([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]) {
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h];
}

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
        const val = p(yi, xi) * (1 - fx) * (1 - fy) + p(yi, xi + 1) * fx * (1 - fy) +
          p(yi + 1, xi) * (1 - fx) * fy + p(yi + 1, xi + 1) * fx * fy;
        res[(j * ancho + i) * 3 + k] = val;
      }
    }
  }
  await sharp(res, { raw: { width: ancho, height: alto, channels: 3 } }).png().toFile(path.join(out, nombre));
  console.log('ok', nombre);
}

const T = 1024;
// Frontal (foto 3, vista de frente): caja de (130,142) a (1072,1062).
await cara('3.webp', [[131, 143], [1071, 143], [1071, 1061], [131, 1061]], T, T, 'frente.png');
// Lateral derecho, versión Azul (foto 1).
await cara('1.webp', [[747, 352], [1103, 177], [1094, 848], [747, 1108]], T, T, 'lado-azul.png');
// Lateral izquierdo, versión Roja (foto 2).
await cara('2.webp', [[102, 172], [425, 352], [430, 1108], [110, 852]], T, T, 'lado-rojo.png');
// Tapa (foto cenital): esquina trasera izquierda, trasera derecha, delantera derecha, delantera izquierda.
await cara('tapa.webp', [[180, 37], [1415, 22], [1532, 1355], [112, 1347]], T, T, 'tapa.png');
// Base (foto desde abajo).
await cara('base.webp', [[150, 47], [1447, 37], [1542, 1424], [82, 1429]], T, T, 'base.png');
// Trasera (foto de frente a la parte de atrás).
await cara('trasera.webp', [[150, 72], [1442, 70], [1512, 1435], [45, 1412]], T, T, 'trasera.png');
// Interior visto por la ventana (foto 3).
await cara('3.webp', [[262, 143], [942, 143], [942, 702], [262, 702]], 1024, 842, 'interior.png');

// Ventana en "L": recorte en el frontal que sigue por la tapa. Debe coincidir con VENTANA en modelo.py.
const V = { u0: 0.139, u1: 0.863, alto: 0.609, fondo: 0.365, radio: 0.035 };

// Máscara con un rectángulo transparente (esquinas redondeadas solo en el lado indicado).
function mascara(x0, y0, x1, y1, r, redondasAbajo) {
  const s = (v) => Math.round(v * T);
  const rx = s(r);
  const path = redondasAbajo
    ? `M${s(x0)},${s(y0)} H${s(x1)} V${s(y1) - rx} Q${s(x1)},${s(y1)} ${s(x1) - rx},${s(y1)} H${s(x0) + rx} Q${s(x0)},${s(y1)} ${s(x0)},${s(y1) - rx} Z`
    : `M${s(x0)},${s(y1)} H${s(x1)} V${s(y0) + rx} Q${s(x1)},${s(y0)} ${s(x1) - rx},${s(y0)} H${s(x0) + rx} Q${s(x0)},${s(y0)} ${s(x0)},${s(y0) + rx} Z`;
  return Buffer.from(`<svg width="${T}" height="${T}" xmlns="http://www.w3.org/2000/svg"><rect width="${T}" height="${T}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`);
}

async function conAlfa(nombre, svg) {
  const alfa = await sharp(svg).flatten({ background: '#fff' }).extractChannel(0).raw().toBuffer();
  await sharp(path.join(out, nombre)).joinChannel(alfa, { raw: { width: T, height: T, channels: 1 } })
    .png().toFile(path.join(out, nombre.replace('.png', '-alfa.png')));
  console.log('ok', nombre.replace('.png', '-alfa.png'));
}
await conAlfa('frente.png', mascara(V.u0, -0.1, V.u1, V.alto, V.radio, true));
// En la tapa la parte delantera queda abajo de la textura.
await conAlfa('tapa.png', mascara(V.u0, 1 - V.fondo, V.u1, 1.1, V.radio, false));

// Formatos finales ligeros para la web: JPEG las opacas y PNG con paleta las que tienen ventana.
for (const n of ['lado-azul', 'lado-rojo', 'trasera', 'base', 'interior']) {
  await sharp(path.join(out, n + '.png')).jpeg({ quality: 85, mozjpeg: true }).toFile(path.join(out, n + '.jpg'));
}
for (const n of ['frente-alfa', 'tapa-alfa']) {
  const buf = await sharp(path.join(out, n + '.png')).png({ palette: true, quality: 90 }).toBuffer();
  fs.writeFileSync(path.join(out, n + '.png'), buf);
}
for (const n of ['frente', 'tapa', 'lado-azul', 'lado-rojo', 'trasera', 'base', 'interior']) fs.rmSync(path.join(out, n + '.png'));
console.log('texturas listas en', out);
