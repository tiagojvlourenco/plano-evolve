#!/usr/bin/env node
// Fase 34 — importação local e repetível de produtos de supermercado para o
// Catálogo (food_products), a partir da Open Food Facts. Corre localmente,
// nunca no browser: node scripts/import-food-products.js [categoria...]
//
// Diferença chave face à limpeza manual da Fase 30: não traduz nem corrige
// nomes um a um — tudo entra como "pending" (com a fonte e o EAN
// registados), para o profissional rever/corrigir/aprovar no Catálogo. É
// para isso que o estado de validação existe.
//
// Não escreve na Supabase diretamente (nunca precisa de chave de serviço) —
// gera um .sql com os inserts, para reveres e correres tu no SQL Editor
// depois de aplicares 0018_food_products_catalog.sql.
const https = require("https");
const fs = require("fs");
const path = require("path");

const UA = "EvolveNutritionCatalog/1.0 (tiagojvlourenco@gmail.com)";
const OUT_DIR = path.join(__dirname, "output");

// Categorias da Open Food Facts (slugs em inglês) mapeadas aos 7 grupos da
// Fase 29 — mesmo mapeamento já validado na Fase 30.
const CATEGORY_MAP = {
  cereais: ["breads", "pastas", "rices", "breakfast-cereals", "flours"],
  laticinios: ["yogurts", "cheeses", "milks", "plant-based-beverages"],
  carnes: ["meats", "poultry", "fishes", "seafood", "cold-cuts", "eggs"],
  fruta: ["fruits"],
  vegetais: ["vegetables"],
  gorduras: ["olive-oils", "vegetable-oils", "spreads", "nuts", "margarines"],
  snacks: ["biscuits-and-cakes", "chips-and-fries", "sodas", "chocolates", "candies"]
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": UA } }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        if (res.statusCode !== 200) { reject(new Error("HTTP " + res.statusCode + " em " + url)); return; }
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function fetchWithRetry(url, attempts) {
  for (let i = 0; i < attempts; i++) {
    try { return await fetchJson(url); }
    catch (e) { if (i === attempts - 1) throw e; await sleep(1500 * (i + 1)); }
  }
}

function inferRetailer(brand) {
  const b = (brand || "").toLowerCase();
  if (b.includes("hacendado") || b.includes("mercadona")) return "Mercadona";
  if (b.includes("continente")) return "Continente";
  if (b.includes("pingo doce")) return "Pingo Doce";
  if (b.includes("auchan")) return "Auchan";
  if (b.includes("lidl")) return "Lidl";
  return null;
}

async function fetchCategory(group, cat, cap) {
  const fields = "code,product_name,brands,nutriments,quantity,unique_scans_n";
  const url = "https://world.openfoodfacts.org/api/v2/search?countries_tags_en=Portugal&categories_tags_en=" + cat +
    "&fields=" + fields + "&page_size=" + cap + "&sort_by=unique_scans_n";
  const json = await fetchWithRetry(url, 4);
  const products = (json.products || []).map((p) => {
    const n = p.nutriments || {};
    return {
      group, category: cat,
      ean: p.code || null,
      name: (p.product_name || "").trim(),
      brand: (p.brands || "").split(",")[0].trim(),
      kcal: n["energy-kcal_100g"], protein: n["proteins_100g"], carbs: n["carbohydrates_100g"], fat: n["fat_100g"],
      sugars: n["sugars_100g"], fiber: n["fiber_100g"], saturated_fat: n["saturated-fat_100g"], salt: n["salt_100g"]
    };
  }).filter((p) =>
    p.ean && p.name && p.name.length >= 2 && p.brand &&
    typeof p.kcal === "number" && typeof p.protein === "number" && typeof p.carbs === "number" && typeof p.fat === "number" &&
    p.kcal >= 0 && p.protein >= 0 && p.carbs >= 0 && p.fat >= 0
  );
  return { total: json.count, kept: products };
}

function round1(n) { return typeof n === "number" && isFinite(n) ? Math.round(n * 10) / 10 : null; }
function sqlStr(s) { return s == null ? "null" : "'" + String(s).replace(/'/g, "''") + "'"; }
function sqlNum(n) { return n == null ? "null" : n; }

async function main() {
  const argCats = process.argv.slice(2);
  const groups = argCats.length ? argCats.filter((g) => CATEGORY_MAP[g]) : Object.keys(CATEGORY_MAP);
  const perCategoryCap = 12; // 27 categorias x ~12 = alvo ~150-250 depois de deduplicar por EAN
  const all = [];
  const summary = [];

  for (const group of groups) {
    for (const cat of CATEGORY_MAP[group]) {
      try {
        const { total, kept } = await fetchCategory(group, cat, perCategoryCap);
        summary.push(group + "/" + cat + ": " + total + " produtos PT no total, " + kept.length + " com EAN+dados completos");
        all.push(...kept);
      } catch (e) {
        summary.push(group + "/" + cat + ": ERRO — " + e.message);
      }
      await sleep(400);
    }
  }
  console.log(summary.join("\n"));

  // Deduplicar por EAN (é a chave real do catálogo)
  const seen = new Set();
  const deduped = all.filter((p) => {
    if (seen.has(p.ean)) return false;
    seen.add(p.ean);
    return true;
  });
  console.log("\nTotal recolhido:", all.length, "-> únicos por EAN:", deduped.length);

  const lines = [
    "-- Fase 34 — importação inicial do catálogo (Open Food Facts).",
    "-- Gerado por scripts/import-food-products.js — revê antes de correr.",
    "-- Todos entram como 'pending' (source_type = 'open_food_facts') — aprova",
    "-- ou corrige no Catálogo do profissional antes de ficarem visíveis a um aluno.",
    "-- Se um EAN já existir na tabela, o insert desse produto falha (unique) —",
    "-- corre o resto à mesma, ou remove a linha do EAN repetido antes de correr.",
    ""
  ];
  deduped.forEach((p) => {
    const sourceUrl = "https://world.openfoodfacts.org/product/" + p.ean;
    lines.push(
      "insert into food_products (ean, name, brand, food_group, nutrition_basis, kcal, protein, carbs, fat, sugars, fiber, saturated_fat, salt, source_url, source_type, verification_status) values (" +
      [sqlStr(p.ean), sqlStr(p.name), sqlStr(p.brand), sqlStr(p.group), sqlStr("100g"),
        sqlNum(round1(p.kcal)), sqlNum(round1(p.protein)), sqlNum(round1(p.carbs)), sqlNum(round1(p.fat)),
        sqlNum(round1(p.sugars)), sqlNum(round1(p.fiber)), sqlNum(round1(p.saturated_fat)), sqlNum(round1(p.salt)),
        sqlStr(sourceUrl), sqlStr("open_food_facts"), sqlStr("pending")].join(", ") +
      ") on conflict (ean) do nothing;"
    );
    const retailer = inferRetailer(p.brand);
    if (retailer) {
      lines.push(
        "insert into food_product_retailers (food_product_id, retailer) select id, " + sqlStr(retailer) +
        " from food_products where ean = " + sqlStr(p.ean) + " on conflict do nothing;"
      );
    }
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, "import-food-products-" + Date.now() + ".sql");
  fs.writeFileSync(outPath, lines.join("\n") + "\n");
  console.log("Guardado:", outPath);
  console.log("Produtos no ficheiro:", deduped.length, "| com retalhista inferido:", deduped.filter((p) => inferRetailer(p.brand)).length);
}

main().catch((e) => { console.error(e); process.exit(1); });
