// Lee los precios de una ficha de PriceCharting o SportsCardsPro (misma web, mismo formato).
// Las cartas usan las columnas: Ungraded · Grade 7 · Grade 8 · Grade 9 · Grade 9.5 · PSA 10.
// Los productos sellados (ETB, colecciones) muestran su precio en la primera columna.
// Los videojuegos usan las mismas casillas con otro sentido: Loose (raw) · Complete (g7) · New (g8) · Graded (psa9).

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
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} en ${url}`), { status: res.status });
  return parsePrices(await res.text());
}

// Qué columna corresponde a la pieza según su tipo y nota.
export const isGame = (item) => item.cat === "videojuegos";

export function priceFor(item, prices) {
  if (isGame(item)) {
    if (item.kind === "Sellado") return prices.g8 ?? null; // New
    if (item.kind === "Graded") return prices.psa9 ?? null; // Graded
    return prices.raw ?? null; // Loose
  }
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

// ---------- Buscar la ficha de una pieza que no tiene enlace ----------
// Solo PriceCharting: SportsCardsPro (fútbol) bloquea a GitHub y el resto de categorías no está en la guía.
const SEARCHABLE = { pokemon: /pokemon/i, dragonball: /dragon ball/i, videojuegos: null };
const CARD_SETS = /pokemon|dragon ball|magic|yugioh|yu-gi-oh|one piece|lorcana|digimon|marvel|star wars|weiss|garbage pail|union arena|flesh/i;
// Palabras que indican otra versión de la carta: si la ficha las tiene y la pieza no, se descarta.
const VARIANT = new Set(["holo", "foil", "reverse", "spr", "alternate", "alt", "art", "1st", "first", "edition", "shadowless", "promo", "gold", "silver", "parallel", "prerelease", "stamped", "jumbo", "japanese", "sealed", "error", "misprint", "staff", "serial", "sp", "scr", "gdr", "ssr"]);
const STOP = new Set(["the", "of", "and", "de", "la", "el", "y", "a", "with", "an", "card", "carta", "tcg", "ccg"]);
// Abreviaturas de consola → nombre de la consola en PriceCharting (el «Set» de la ficha).
const PLATFORMS = {
  ps1: "playstation", psx: "playstation", ps2: "playstation 2", ps3: "playstation 3", ps4: "playstation 4", ps5: "playstation 5",
  psp: "psp", n64: "nintendo 64", gc: "gamecube", gamecube: "gamecube", nes: "nes", snes: "super nintendo",
  gb: "gameboy", gbc: "gameboy color", gba: "gameboy advance", nds: "nintendo ds", "3ds": "nintendo 3ds",
  wii: "wii", wiiu: "wii u", switch: "nintendo switch", xbox: "xbox", x360: "xbox 360",
};

export const canSearchGuide = (item) => item.cat in SEARCHABLE;

const words = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP.has(w));

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

export function parseSearch(html) {
  const out = [];
  for (const row of html.split(/<tr id="product-/).slice(1)) {
    const t = row.match(/<td class="title">\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!t || !isPriceGuideUrl(t[1])) continue;
    const c = row.match(/<a href="\/console\/[^"]*">([\s\S]*?)<\/a>/);
    out.push({ url: decode(t[1]), title: decode(t[2]), set: c ? decode(c[1]) : "" });
  }
  return out;
}

// Puntúa una ficha: cuántas palabras de la pieza aparecen en ella, descartando otras versiones y otros números.
export function scoreCandidate(item, cand) {
  const mine = words([item.name, item.set, item.code].join(" "));
  const theirs = new Set(words(cand.title + " " + cand.set));
  const own = new Set(mine);
  const re = SEARCHABLE[item.cat];
  if (re && !re.test(cand.set)) return 0;
  if (item.cat === "videojuegos") {
    if (CARD_SETS.test(cand.set)) return 0;
    const pf = mine.find((w) => PLATFORMS[w]);
    if (pf && words(cand.set).filter((w) => w !== "pal" && w !== "jp").join(" ") !== words(PLATFORMS[pf]).join(" ")) return 0;
  }
  // Versiones europea o japonesa solo si la pieza lo dice.
  if (words(cand.set).some((w) => (w === "pal" || w === "jp" || w === "japanese") && !own.has(w))) return 0;
  // La ficha tiene que nombrar lo principal de la pieza (su primera palabra).
  const titleWords = words(cand.title);
  if (!titleWords.includes(mine[0])) return 0;
  // Números de carta: si la pieza los tiene, la ficha debe tener los mismos.
  const nums = (ws) => ws.filter((w) => /\d/.test(w) && !/^(19|20)\d\d$/.test(w) && !PLATFORMS[w]);
  if (nums(mine).length && nums(titleWords).some((n) => !own.has(n))) return 0;
  if (titleWords.some((w) => VARIANT.has(w) && !own.has(w))) return 0;
  const all = mine.filter((w) => !PLATFORMS[w]); // la consola ya se ha comprobado arriba
  const hit = all.filter((w) => theirs.has(w)).length;
  const extra = titleWords.filter((w) => !own.has(w)).length;
  return hit / all.length - extra * 0.05;
}

async function search(q) {
  const res = await fetch("https://www.pricecharting.com/search-products?type=prices&q=" + encodeURIComponent(q), {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
  });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} buscando «${q}»`), { status: res.status });
  // Con un solo resultado PriceCharting abre directamente la ficha.
  if (isPriceGuideUrl(res.url)) {
    const html = await res.text();
    const title = decode((html.match(/<h1[^>]*id="product_name"[^>]*>([\s\S]*?)<\/h1>/) || [, ""])[1].replace(/<[^>]+>/g, " "));
    return [{ url: res.url.split("?")[0], title, set: title }];
  }
  return parseSearch(await res.text());
}

// Devuelve { url, title, set, score } con la ficha más probable, o null si no hay una clara.
export async function findGuideUrl(item) {
  if (!canSearchGuide(item)) return null;
  const base = [item.name, item.code && !String(item.name).includes(item.code) ? item.code : ""].join(" ");
  const q = words(base).map((w) => PLATFORMS[w] || w).join(" ");
  let cands = await search(q);
  if (!cands.length && item.set) cands = await search(words(item.name).join(" "));
  const scored = cands
    .map((c) => ({ ...c, score: scoreCandidate(item, c) }))
    .filter((c) => c.score >= 0.6)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  if (scored[1] && scored[0].score - scored[1].score < 0.1) return null; // dos fichas igual de probables: mejor no adivinar
  return scored[0];
}
