// Entorno de luz tipo estudio de fotografía para el slab 3D (public/modelos/estudio.hdr).
// Un fondo oscuro con varias ventanas de luz (softboxes) muy intensas: son las que dibujan los brillos
// en los cantos del plástico. Formato Radiance HDR sin comprimir (lo lee model-viewer).
// Uso: node blender/slab/estudio.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const W = 512, H = 256;

// Rectángulos de luz en coordenadas del panorama (u: 0..1 alrededor, v: 0 arriba .. 1 abajo).
const LUCES = [
  { u0: 0.36, u1: 0.64, v0: 0.06, v1: 0.20, i: 4, c: [1, 1, 1] },        // cenital grande
  { u0: 0.14, u1: 0.20, v0: 0.22, v1: 0.62, i: 8, c: [1, 0.99, 0.97] }, // tira izquierda
  { u0: 0.80, u1: 0.86, v0: 0.22, v1: 0.62, i: 8, c: [0.97, 0.99, 1] }, // tira derecha
  { u0: 0.36, u1: 0.64, v0: 0.24, v1: 0.56, i: 0.5, c: [1, 1, 1] },       // relleno frontal amplio y suave
  { u0: 0.97, u1: 1.03, v0: 0.18, v1: 0.58, i: 9, c: [1, 1, 1] },        // contraluz
];

function fondo(v) {
  // Degradado: techo gris medio, horizonte oscuro, suelo casi negro.
  if (v < 0.5) { const t = v / 0.5; return 0.30 * (1 - t) + 0.16 * t; }
  const t = (v - 0.5) / 0.5; return 0.16 * (1 - t) + 0.06 * t;
}

function rgbe([r, g, b]) {
  const m = Math.max(r, g, b);
  if (m < 1e-32) return [0, 0, 0, 0];
  const e = Math.ceil(Math.log2(m));
  const f = 256 / Math.pow(2, e);
  return [Math.min(255, Math.floor(r * f)), Math.min(255, Math.floor(g * f)), Math.min(255, Math.floor(b * f)), e + 128];
}

const datos = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const u = (x + 0.5) / W, v = (y + 0.5) / H;
    let col = [fondo(v), fondo(v), fondo(v) * 1.04];
    for (const L of LUCES) {
      for (const uu of [u, u + 1]) {
        if (uu >= L.u0 && uu <= L.u1 && v >= L.v0 && v <= L.v1) {
          // Bordes algo suaves para que los reflejos no queden pixelados.
          const bu = Math.min(uu - L.u0, L.u1 - uu) * W, bv = Math.min(v - L.v0, L.v1 - v) * H;
          const k = Math.min(1, bu / 2) * Math.min(1, bv / 2);
          col = col.map((c, i) => c + L.i * L.c[i] * k);
        }
      }
    }
    rgbe(col).forEach((val, i) => { datos[(y * W + x) * 4 + i] = val; });
  }
}
const cabecera = Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${H} +X ${W}\n`, 'ascii');
const destino = path.join(raiz, 'public', 'modelos', 'estudio.hdr');
fs.writeFileSync(destino, Buffer.concat([cabecera, datos]));
console.log('ok', destino, fs.statSync(destino).size, 'bytes');
