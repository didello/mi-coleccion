// Genera los iconos PNG de la app (pantalla de inicio del iPhone y Android) a partir de public/favicon.svg.
import sharp from "sharp";
import { readFile } from "node:fs/promises";

const svg = await readFile(new URL("../public/favicon.svg", import.meta.url));
const out = (f) => new URL(`../public/${f}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

// iOS recorta las esquinas solo: el icono va a sangre, sin transparencias.
const square = await sharp(svg, { density: 384 })
  .resize(512, 512)
  .flatten({ background: "#070B14" })
  .png()
  .toBuffer();

await sharp(square).resize(180, 180).toFile(out("apple-touch-icon.png"));
await sharp(square).resize(192, 192).toFile(out("icon-192.png"));
await sharp(square).resize(512, 512).toFile(out("icon-512.png"));
console.log("Iconos generados en public/");
