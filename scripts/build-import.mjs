// Prepara migracion/importar.json a partir de la copia exportada de la primera versión:
//   migracion/db/<colección>/<id>.json   documentos
//   migracion/assets/<id>.<ext>          imágenes y catálogo Topps
// La app lo lee desde «Elegir la carpeta migracion» y lo sube a Supabase.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "../migracion");
const assetsDir = path.join(root, "assets");

const assetFiles = await readdir(assetsDir);
const byId = new Map(assetFiles.map((f) => [path.parse(f).name, f]));
const TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".json": "application/json" };

const files = new Map(); // name -> { name, bucket, type }
function asset(id, bucket) {
  if (!id) return id;
  const name = byId.get(id);
  if (!name) {
    console.warn(`  ! falta el archivo del asset ${id}`);
    return null;
  }
  files.set(name, { name, bucket, type: TYPES[path.extname(name).toLowerCase()] });
  return name;
}

const docs = [];
for (const collection of await readdir(path.join(root, "db"))) {
  for (const f of await readdir(path.join(root, "db", collection))) {
    const id = path.parse(f).name;
    const data = JSON.parse(await readFile(path.join(root, "db", collection, f), "utf8"));

    if (collection === "items" && data.photo) data.photo = asset(data.photo, "fotos");
    if (collection === "media") {
      if (data.official) data.official = asset(data.official, "catalogo");
      if (data.sprite?.sheet) data.sprite.sheet = asset(data.sprite.sheet, "catalogo");
    }
    if (collection === "meta" && id === "topps") {
      data.catalog = asset(data.catalog, "catalogo");
      data.sheets = (data.sheets || []).map((s) => asset(s, "catalogo"));
    }
    docs.push({ collection, id, data });
  }
}

const out = { version: 1, created: new Date().toISOString(), files: [...files.values()], docs };
await writeFile(path.join(root, "importar.json"), JSON.stringify(out, null, 2));
console.log(`migracion/importar.json: ${docs.length} documentos y ${files.size} archivos.`);
if (!existsSync(path.join(root, "assets"))) console.warn("No hay carpeta migracion/assets");
