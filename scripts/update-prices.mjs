// Revisión diaria de precios. La ejecuta GitHub Actions cada día (.github/workflows/precios.yml).
//
// Para cada usuario:
//  · Las piezas con fuente «Guía» y enlace de PriceCharting/SportsCardsPro toman el precio del día
//    (y las nuevas con enlace que aún están «Pendiente de buscar referencia»).
//  · Las de eBay con enlace se vigilan: si la guía da un precio parecido (±20 %) al puesto a mano,
//    pasan a «Guía». Si no, conservan su valor, igual que las sin comparables o con valor a mano.
//  · Todas reciben el punto de hoy en su historial; si faltaran días (por ejemplo, si un día
//    GitHub no ejecutó la tarea) se rellenan con el último valor conocido.
//  · Se actualiza el resumen (meta/summary) con el total del día.
//
// Variables de entorno: SUPABASE_URL y SUPABASE_SECRET_KEY (clave secreta, solo en GitHub Secrets).
// Opcional: DRY_RUN=1 para ver qué cambiaría sin guardar nada.

import { createClient } from "@supabase/supabase-js";
import { fetchPrices, isGame, isPriceGuideUrl, priceFor } from "./lib/pricecharting.mjs";

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
const DRY = process.env.DRY_RUN === "1";
if (!URL_ || !KEY) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SECRET_KEY.");
  process.exit(1);
}
const sb = createClient(URL_, KEY, { auth: { persistSession: false } });

const ymd = (d) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }); // AAAA-MM-DD en hora de España
const today = ymd(new Date());
const tomorrow = ymd(new Date(Date.now() + 86400000));
const addDay = (d) => {
  const t = new Date(d + "T12:00:00Z");
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
};
const money = (n) => "$" + n.toLocaleString("es-ES", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
// Diferencia máxima (20 %) para que una pieza de eBay pase a la guía.
const SIMILAR = 0.2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isAuto(it) {
  if (!isPriceGuideUrl(it.ref) || it.pending) return false;
  if (it.source === "guia") return true;
  return it.source === "manual" && /^Pendiente de buscar referencia/.test(it.sourceName || "");
}

function gradeLabel(it) {
  if (isGame(it)) return it.kind === "Sellado" ? "New (sellado)" : it.kind === "Graded" ? "Graded" : "Loose";
  if (it.kind === "Sellado") return "sellado";
  if (it.kind === "Graded" && it.grade) return it.grade;
  return "raw";
}

// Historial ordenado, sin huecos hasta hoy y con el valor de hoy.
function withToday(history, value) {
  const h = (history || []).filter((p) => p && p.d && p.v != null).sort((a, b) => (a.d < b.d ? -1 : 1));
  const out = h.filter((p) => p.d < today);
  if (out.length) {
    let last = out[out.length - 1];
    for (let d = addDay(last.d); d < today; d = addDay(d)) out.push({ d, v: last.v });
  }
  if (value != null) out.push({ d: today, v: value });
  return out;
}

async function allDocs(collection) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("documents")
      .select("user_id,id,data")
      .eq("collection", collection)
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function save(user_id, collection, id, data) {
  if (DRY) return;
  const { error } = await sb
    .from("documents")
    .upsert({ user_id, collection, id, data }, { onConflict: "user_id,collection,id" });
  if (error) throw new Error(`${collection}/${id}: ${error.message}`);
}

const priceCache = new Map();
const blocked = new Set(); // enlaces de SportsCardsPro que GitHub no puede leer
async function pricesFor(url) {
  if (!priceCache.has(url)) {
    await sleep(1500); // sin prisas: una petición cada segundo y medio
    priceCache.set(
      url,
      fetchPrices(url).catch((e) => {
        // SportsCardsPro bloquea los servidores de GitHub (403): no es un fallo de la pieza, se resume al final.
        if (e.status === 403 && url.includes("sportscardspro")) blocked.add(url);
        else console.warn(`  ! ${e.message}`);
        return null;
      }),
    );
  }
  return priceCache.get(url);
}

const items = await allDocs("items");
const media = new Map((await allDocs("media")).map((r) => [`${r.user_id}/${r.id}`, r.data]));
const summaries = new Map(
  (await allDocs("meta")).filter((r) => r.id === "summary").map((r) => [r.user_id, r.data]),
);

console.log(`Revisión del ${today}: ${items.length} piezas.${DRY ? " (simulación, no se guarda nada)" : ""}`);

const totals = new Map(); // user_id -> { value, invested }
let updated = 0,
  kept = 0,
  failed = 0;

for (const row of items) {
  const it = { ...row.data };
  let value = it.value ?? null;

  const ebayWatch = it.source === "ebay" && isPriceGuideUrl(it.ref) && !it.pending;
  if (isAuto(it) || ebayWatch) {
    const got = await pricesFor(it.ref);
    const prices = got && Object.keys(got).length ? got : null; // vacío = no se pudo leer la página
    const v = prices ? priceFor(it, prices) : null;
    const site = it.ref.includes("sportscardspro") ? "SportsCardsPro" : "PriceCharting";
    if (prices) {
      // Los precios de mercado se guardan aunque falte la columna de su nota: sirven de referencia.
      const key = `${row.user_id}/${row.id}`;
      const m = { ...(media.get(key) || {}) };
      const market = { d: today };
      if (isGame(it)) Object.assign(market, { loose: prices.raw ?? null, cib: prices.g7 ?? null, new: prices.g8 ?? null });
      else if (it.kind === "Sellado") market.sealed = prices.raw ?? null;
      else Object.assign(market, { raw: prices.raw ?? null, psa9: prices.psa9 ?? null, psa10: prices.psa10 ?? null });
      m.market = market;
      m.src = m.src || site;
      await save(row.user_id, "media", row.id, m);
    }
    // Las de eBay pasan a la guía solo cuando su precio se parece al puesto a mano.
    const close = v != null && (!ebayWatch || (value != null && Math.abs(v - value) <= value * SIMILAR));
    if (close) {
      if (ebayWatch) console.log(`  ${it.name}: ${site} ${gradeLabel(it)} ${money(v)} se parece al de eBay (${money(value)}), pasa a la guía`);
      else if (v !== value) console.log(`  ${it.name}: ${value ?? "—"} → ${v}`);
      value = v;
      it.value = v;
      it.source = "guia";
      it.sourceName = `${site} ${gradeLabel(it)}: ${money(v)} (revisión automática)`;
      delete it.priceNote;
      updated++;
    } else if (ebayWatch) {
      if (v != null) console.log(`  ${it.name}: ${site} ${gradeLabel(it)} ${money(v)} no se parece al de eBay (${money(value)}), sigue con eBay`);
      kept++;
    } else if (prices) {
      // La página se leyó bien pero no tiene precio para su nota: se avisa en la ficha para usar eBay.
      it.priceNote = `${site} no tiene precio ${gradeLabel(it)} para esta carta. Usa ventas de eBay.`;
      console.log(`  ${it.name}: ${site} no tiene precio ${gradeLabel(it)}, se mantiene ${value ?? "—"}`);
      failed++;
    } else {
      console.log(`  ${it.name}: sin precio hoy, se mantiene ${value ?? "—"}`);
      failed++;
    }
  } else kept++;

  it.history = withToday(it.history, value);
  it.updated = today;
  await save(row.user_id, "items", row.id, it);

  const t = totals.get(row.user_id) || { value: 0, invested: 0 };
  const q = it.qty || 1;
  if (!it.pending && value != null) t.value += value * q;
  if (!it.pending && it.paid != null) t.invested += it.paid * q;
  totals.set(row.user_id, t);
}

for (const [user_id, t] of totals) {
  const s = { ...(summaries.get(user_id) || {}) };
  const points = (s.points || []).filter((p) => p.d !== today);
  points.push({ d: today, value: +t.value.toFixed(2), invested: +t.invested.toFixed(2) });
  points.sort((a, b) => (a.d < b.d ? -1 : 1));
  await save(user_id, "meta", "summary", { ...s, points, updated: today, nextCheck: tomorrow });
  console.log(`Usuario ${user_id.slice(0, 8)}…: valor ${money(+t.value.toFixed(2))}, invertido ${money(+t.invested.toFixed(2))}`);
}

if (blocked.size) console.log(`SportsCardsPro no deja leer sus páginas desde GitHub: ${blocked.size} pieza${blocked.size > 1 ? "s" : ""} con su valor de siempre.`);
console.log(`Listo: ${updated} actualizadas, ${kept} con valor mantenido, ${failed} sin precio hoy.`);
