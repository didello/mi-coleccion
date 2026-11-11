// Caja 3D de los juegos de PS1: la carcasa (public/modelos/caja-ps1.glb, hecha en blender/juego-ps1) es la
// misma para todos; aquí se le ponen la portada, la trasera y los dos lomos de cada juego.
import { drawBarcode, fitText, cardFace } from "./slab3d.js";

const FONT = "Arial, Helvetica, sans-serif";
const LOMO_W = 2360, LOMO_H = 130; // 118 × 6,5 mm

// Lomo de la bisagra: franja negra con «NTSC U/C», el título y el código del juego (como el de las cajas americanas).
export function lomoBisagra(J) {
  const c = document.createElement("canvas"); c.width = LOMO_W; c.height = LOMO_H;
  const x = c.getContext("2d");
  x.fillStyle = "#16171a"; x.fillRect(0, 0, LOMO_W, LOMO_H);
  x.fillStyle = "#3a3c40"; x.fillRect(0, 0, LOMO_W, 10); x.fillRect(0, LOMO_H - 10, LOMO_W, 10);
  // «NTSC U/C» en recuadro blanco.
  x.fillStyle = "#fff"; x.fillRect(70, 38, 230, 54);
  x.fillStyle = "#16171a"; x.font = `700 38px ${FONT}`; x.textBaseline = "middle"; x.textAlign = "left";
  x.fillText("NTSC", 82, 66); x.fillRect(192, 42, 4, 46); x.fillText("U/C", 205, 66);
  x.fillStyle = "#f2f2f2"; fitText(x, J.titulo, LOMO_W / 2, 82, 1500, 64, 700, "center");
  if (J.codigo) { x.fillStyle = "#e8e8e8"; fitText(x, J.codigo, LOMO_W - 70, 82, 400, 44, 700, "right"); }
  return c;
}

// Lomo del lado que abre: etiqueta blanca con título, editora, código y código de barras.
export function lomoApertura(J) {
  const c = document.createElement("canvas"); c.width = LOMO_W; c.height = LOMO_H;
  const x = c.getContext("2d");
  x.fillStyle = "#f4f4f2"; x.fillRect(0, 0, LOMO_W, LOMO_H);
  x.fillStyle = "#1b1b1b"; x.textBaseline = "alphabetic";
  fitText(x, J.titulo.toUpperCase(), 230, 56, 900, 46, 400);
  if (J.editora) fitText(x, J.editora.toUpperCase(), 230, 108, 900, 46, 400);
  if (J.codigo) fitText(x, J.codigo, 1200, 108, 380, 46, 400);
  drawBarcode(x, J.upc || J.codigo || J.titulo, 1660, 20, 620, 90, "#111");
  return c;
}

// Trasera genérica para los juegos sin foto de la trasera: negra con el logo y el título.
export function traseraGenerica(J) {
  const W = 1035, H = 885, c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#1d1e22"); g.addColorStop(1, "#0c0c0e");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = "rgba(255,255,255,.85)"; fitText(x, J.titulo, W / 2, H / 2 - 10, W - 160, 72, 800, "center");
  x.fillStyle = "rgba(255,255,255,.45)"; fitText(x, "PlayStation", W / 2, H / 2 + 70, 400, 40, 400, "center");
  if (J.codigo) { x.fillStyle = "rgba(255,255,255,.35)"; fitText(x, J.codigo, W - 50, H - 40, 300, 28, 400, "right"); }
  return c;
}

// Los lomos del modelo son tiras verticales: el dibujo horizontal se gira para que se lea de arriba abajo.
function vertical(c) {
  const v = document.createElement("canvas"); v.width = c.height; v.height = c.width;
  const x = v.getContext("2d"); x.translate(v.width, 0); x.rotate(Math.PI / 2); x.drawImage(c, 0, 0);
  return v;
}

const toURL = (canvas) => new Promise((ok) => canvas.toBlob((b) => ok(URL.createObjectURL(b)), "image/jpeg", 0.9));

// J: {titulo, editora, codigo, upc, portada (url o {url}|{sheet,cell,rot}), trasera, lomo, lomoDerecho (urls de escaneos, o null)}
export async function dressCase(mv, J) {
  if (!mv.loaded) await new Promise((ok) => mv.addEventListener("load", ok, { once: true }));
  const portada = typeof J.portada === "string" ? J.portada : await cardFace(J.portada, 900, 900, 0);
  const caras = {
    Portada: portada,
    Trasera: J.trasera || traseraGenerica(J),
    Lomo: J.lomo || vertical(lomoBisagra(J)),
    LomoDerecho: J.lomoDerecho || vertical(lomoApertura(J)),
  };
  const urls = [];
  for (const m of mv.model.materials) {
    const f = caras[m.name];
    if (!f) continue;
    const url = typeof f === "string" ? f : await toURL(f);
    if (typeof f !== "string") urls.push(url);
    m.pbrMetallicRoughness.baseColorTexture.setTexture(await mv.createTexture(url));
  }
  setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 4000);
}
