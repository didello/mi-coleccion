// Portada, trasera y lomos de los juegos de PS1 para la carcasa 3D, sacados de escaneos planos de la caja
// (PSX Datacenter, 600 ppp): la portada (120 × 120 mm) y la trasera completa con sus dos lomos (151 × 118 mm).
// Cada juego se añade a JUEGOS con las columnas de los pliegues de los lomos en el escaneo de la trasera.
// Uso: node blender/juego-ps1/texturas.mjs  ->  public/modelos/juegos/<id>-{portada,trasera,lomo,lomo-derecho}.jpg
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(dir, '..', '..', 'public', 'modelos', 'juegos');
fs.mkdirSync(out, { recursive: true });

// trasera.lomos: [inicio y fin del lomo izquierdo, inicio y fin del derecho] en píxeles del escaneo.
// Visto desde atrás, el lomo de la derecha del escaneo es el de la bisagra (lado izquierdo de la caja de frente).
const JUEGOS = {
  'fifa-2004': {
    portada: 'fifa2004-escaneo-portada.jpg',
    trasera: 'fifa2004-escaneo-trasera.jpg', lomos: [5, 78, 1708, 1780],
  },
};

const jpg = (img, nombre) => img.jpeg({ quality: 88, mozjpeg: true }).toFile(path.join(out, nombre)).then(() => console.log('ok', nombre));

for (const [id, J] of Object.entries(JUEGOS)) {
  await jpg(sharp(path.join(dir, 'fotos', J.portada)).resize(1024, 1024, { fit: 'fill' }), `${id}-portada.jpg`);
  const t = path.join(dir, 'fotos', J.trasera);
  const { height: H } = await sharp(t).metadata();
  const [a0, a1, b0, b1] = J.lomos;
  await jpg(sharp(t).extract({ left: a1 + 1, top: 0, width: b0 - a1 - 1, height: H }).resize(1194, 1024, { fit: 'fill' }), `${id}-trasera.jpg`);
  await jpg(sharp(t).extract({ left: b0, top: 0, width: b1 - b0, height: H }).resize(64, 1024, { fit: 'fill' }), `${id}-lomo.jpg`);
  await jpg(sharp(t).extract({ left: a0, top: 0, width: a1 - a0, height: H }).resize(64, 1024, { fit: 'fill' }), `${id}-lomo-derecho.jpg`);
}
