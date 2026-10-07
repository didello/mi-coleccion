// Importa la copia de la primera versión (carpeta "migracion" que genera `npm run migracion`).
// Sube las imágenes y crea los documentos con la sesión del usuario.

import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

export function initImporter(getCtx) {
  const input = $("importInput");
  $("importGo").addEventListener("click", () => input.click());

  input.addEventListener("change", async () => {
    const files = [...input.files];
    input.value = "";
    const ctx = getCtx();
    if (!ctx || !files.length) return;
    const status = $("importMsg"),
      btn = $("importGo");
    const say = (t) => (status.textContent = t);
    const byName = new Map(files.map((f) => [f.name, f]));
    const manifestFile = byName.get("importar.json");
    if (!manifestFile) {
      say("No encuentro «importar.json». Elige la carpeta «migracion» del proyecto.");
      return;
    }
    btn.disabled = true;
    try {
      const plan = JSON.parse(await manifestFile.text());
      let n = 0;
      for (const f of plan.files) {
        const file = byName.get(f.name);
        n++;
        if (!file) continue;
        say(`Subiendo imágenes… ${n} de ${plan.files.length}`);
        const path = f.bucket === "fotos" ? `${ctx.userId}/${f.name}` : f.name;
        const { error } = await supabase.storage
          .from(f.bucket)
          .upload(path, file, { upsert: true, contentType: f.type || file.type || undefined });
        if (error) throw new Error(`${f.name}: ${error.message}`);
      }
      n = 0;
      for (const d of plan.docs) {
        n++;
        say(`Guardando datos… ${n} de ${plan.docs.length}`);
        await ctx.db.doc(`${d.collection}/${d.id}`).set(d.data);
      }
      say("¡Importación completa! Ya tienes aquí toda tu colección.");
      setTimeout(() => ($("importPanel").hidden = true), 2500);
    } catch (err) {
      say("La importación se ha parado: " + (err.message || err) + ". Puedes repetirla, no duplica nada.");
    } finally {
      btn.disabled = false;
    }
  });
}
