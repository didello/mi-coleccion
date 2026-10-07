// Lee los precios de una ficha de PriceCharting o SportsCardsPro (misma web, mismo formato).
// Las cartas usan las columnas: Ungraded · Grade 7 · Grade 8 · Grade 9 · Grade 9.5 · PSA 10.
// Los productos sellados (ETB, colecciones) muestran su precio en la primera columna.

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

const FIELDS = {
  used_price: "raw",
  complete_price: "g7",
  new_price: "g8",
  graded_price: "psa9",
  box_only_price: "g95",
  manual_only_price: "psa10",
};

export function isPriceGuideUrl(url) {
  return /^https:\/\/www\.(pricecharting|sportscardspro)\.com\/game\//.test(url || "");
}

export function parsePrices(html) {
  const out = {};
  for (const [id, key] of Object.entries(FIELDS)) {
    const m = html.match(new RegExp(`id="${id}"[^>]*>\\s*<span[^>]*>\\s*([^<]*?)\\s*<`));
    if (!m) continue;
    const n = parseFloat(m[1].replace(/[$,\s]/g, ""));
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
}

export async function fetchPrices(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return parsePrices(await res.text());
}

// Qué columna corresponde a la pieza según su tipo y nota.
export function priceFor(item, prices) {
  if (item.kind === "Sellado") return prices.raw ?? null;
  if (item.kind !== "Graded" || !item.grade) return prices.raw ?? null;
  const num = (String(item.grade).match(/([\d.]+)/) || [])[1];
  if (num === "10") return prices.psa10 ?? null;
  if (num === "9.5") return prices.g95 ?? null;
  if (num === "9") return prices.psa9 ?? null;
  if (num === "8") return prices.g8 ?? null;
  if (num === "7") return prices.g7 ?? null;
  return null;
}
