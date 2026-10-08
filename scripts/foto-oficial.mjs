// Pone la imagen oficial de una pieza, con el mismo formato que el resto (714×1000, JPG).
// La ejecuta GitHub Actions a mano (.github/workflows/foto-oficial.yml).
//
// Variables de entorno:
//   SUPABASE_URL, SUPABASE_SECRET_KEY  (clave secreta, solo en GitHub Secrets)
//   BUSCAR   parte del nombre de la pieza; si hay varias que coinciden, no cambia nada
//   IMAGEN   (opcional) enlace de la imagen; sin él solo enseña los datos de la pieza
//   NOTA     (opcional) qué versión es, se ve en la ficha como «Imagen oficial»
//   DRY_RUN=1 para ver qué cambiaría sin guardar nada

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import sharp from "sharp";

const { SUPABASE_URL, SUPABASE_SECRET_KEY, BUSCAR = "", IMAGEN = "", NOTA = "" } = process.env;
const DRY = process.env.DRY_RUN === "1";
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SECRET_KEY.");
  process.exit(1);
}
if (!BUSCAR.trim()) {
  console.error("Falta el nombre de la pieza (BUSCAR).");
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const q = BUSCAR.trim().toLowerCase();
const { data: rows, error } = await sb.from("documents").select("user_id,id,data").eq("collection", "items");
if (error) throw error;
const found = rows.filter((r) => (r.data.name || "").toLowerCase().includes(q));

for (const r of found) {
  const { data: m } = await sb
    .from("documents")
    .select("data")
    .match({ user_id: r.user_id, collection: "media", id: r.id })
    .maybeSingle();
  const it = r.data;
  console.log(`${r.id}: ${it.name}`);
  console.log(`  tipo ${it.kind || "—"} · nota ${it.grade || "—"} · código ${it.code || "—"} · cantidad ${it.qty || 1}`);
  console.log(`  valor ${it.value ?? "—"} · fuente ${it.source} (${it.sourceName || ""})`);
  console.log(`  enlace ${it.ref || "—"}`);
  console.log(`  imagen oficial ${m?.data?.official || "—"} · ${m?.data?.check || ""}`);
}
if (found.length !== 1) {
  console.error(found.length ? `Hay ${found.length} piezas con «${BUSCAR}»: afina el nombre.` : `No hay ninguna pieza con «${BUSCAR}».`);
  process.exit(1);
}
if (!IMAGEN) process.exit(0);

const res = await fetch(IMAGEN, { headers: { "User-Agent": "Mozilla/5.0" } });
if (!res.ok) throw new Error(`HTTP ${res.status} en ${IMAGEN}`);
const jpg = await sharp(Buffer.from(await res.arrayBuffer()))
  .rotate()
  .resize(714, 1000, { fit: "cover", position: "centre" })
  .flatten({ background: "#ffffff" })
  .jpeg({ quality: 88, mozjpeg: true })
  .toBuffer();
const name = createHash("md5").update(jpg).digest("hex") + ".jpg";
console.log(`Imagen: 714×1000, ${Math.round(jpg.length / 1024)} KB → catalogo/${name}${DRY ? " (simulación)" : ""}`);
if (DRY) process.exit(0);

const up = await sb.storage.from("catalogo").upload(name, jpg, { contentType: "image/jpeg", upsert: true });
if (up.error) throw up.error;

const [r] = found;
const { data: cur } = await sb
  .from("documents")
  .select("data")
  .match({ user_id: r.user_id, collection: "media", id: r.id })
  .maybeSingle();
const m = { ...(cur?.data || {}), official: name };
if (NOTA.trim()) m.check = NOTA.trim();
const { error: e2 } = await sb
  .from("documents")
  .upsert({ user_id: r.user_id, collection: "media", id: r.id, data: m }, { onConflict: "user_id,collection,id" });
if (e2) throw e2;
console.log(`Listo: ${r.data.name} tiene imagen oficial nueva.`);
