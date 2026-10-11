#!/usr/bin/env node
// Tamanho da embalagem individual dos produtos perecíveis do Catálogo (food_products).
//
// As listas lista-*.csv (Open Food Facts) têm a coluna "Embalagem" ("150 g", "500 g (4 x 125 g)", "1 l"...), mas os inserts do catálogo
// nunca a gravaram em package_quantity/package_unit — por isso a app só conhecia 3 embalagens. Este script lê as listas, calcula o tamanho
// de UMA unidade fechada (iogurte de 125 g, queijo fresco de 62,5 g, leite de 200 ml...) e gera o SQL para o preencher. Só doses individuais
// (copos de iogurte, unidades de queijo fresco, pacotes pequenos de leite/bebida): ralado, fatiado, curado, fiambre, húmus, natas, molhos e conservas ficam de fora.
//
//   node scripts/generate-pack-sizes.js
//
// Não escreve na Supabase (nunca precisa de chave): gera
//   scripts/output-pack-sizes.sql          os UPDATE, para reveres e correres no SQL Editor
//   scripts/output-pack-sizes-review.csv   cada produto com o que foi decidido e porquê (para conferir)
// Os UPDATE só tocam em linhas sem package_quantity (nunca sobrescrevem o que o profissional já preencheu no Catálogo).
"use strict";
const fs = require("fs");
const path = require("path");
const { packForProduct, PACK_MIN, PACK_MAX } = require("./lib/pack-size.js");

function parseCsv(text){
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++){
    const c = text[i];
    if (q){ if (c === '"'){ if (text[i + 1] === '"'){ cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ","){ row.push(cur); cur = ""; }
    else if (c === "\n"){ row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur || row.length){ row.push(cur); rows.push(row); }
  return rows;
}
function csvCell(v){ v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function sqlStr(v){ return "'" + String(v).replace(/'/g, "''") + "'"; }

// algumas listas trazem o EAN com uma plica à frente ('5601002123626, truque da folha de cálculo para não perder zeros): na base fica só com dígitos
function normalizeEan(v){
  const e = String(v == null ? "" : v).trim().replace(/^'+/, "").replace(/\s+/g, "");
  return /^\d{6,14}$/.test(e) ? e : "";
}

function loadProducts(dir){
  const out = [];
  fs.readdirSync(dir).filter(f => /^lista-.*\.csv$/.test(f)).sort().forEach(file => {
    const rows = parseCsv(fs.readFileSync(path.join(dir, file), "utf8"));
    const head = rows[0] || [];
    const iEan = head.findIndex(h => /^EAN/i.test(h)), iName = 1, iBrand = 2, iPack = head.findIndex(h => /Embalagem/i.test(h)), iKcal = head.findIndex(h => /^kcal/i.test(h));
    if (iEan < 0 || iPack < 0) return;
    rows.slice(1).forEach(r => {
      const ean = normalizeEan(r[iEan]);
      const kcal = iKcal >= 0 ? parseFloat(String(r[iKcal] || "").replace(",", ".")) : NaN;
      if (ean) out.push({file, ean, name: (r[iName] || "").trim(), brand: (r[iBrand] || "").trim(), embalagem: (r[iPack] || "").trim(), kcal: isFinite(kcal) ? kcal : NaN});
    });
  });
  return out;
}

// nomes tal como ficaram no catálogo (os output-import-*.sql traduzem e corrigem os nomes das listas): é nesses que a app procura "iogurte", "queijo"...
function loadDbNames(dir){
  const names = new Map();
  const re = /^insert into food_products \(ean, name, brand, food_group[^)]*\) values \('([^']*)', '((?:[^']|'')*)', '((?:[^']|'')*)'/;
  fs.readdirSync(dir).filter(f => /^output-(import|migrate)-.*\.sql$/.test(f)).sort().forEach(file => {
    fs.readFileSync(path.join(dir, file), "utf8").split("\n").forEach(line => {
      const m = re.exec(line);
      if (m) names.set(m[1], m[2].replace(/''/g, "'"));
    });
  });
  return names;
}

function run(dir){
  const products = loadProducts(dir);
  const dbNames = loadDbNames(dir);
  const byEan = new Map();
  products.forEach(p => {
    const dbName = dbNames.get(p.ean) || null;
    const d = packForProduct(dbName || p.name, p.embalagem, p.kcal, p.ean);
    const rec = {ean: p.ean, name: dbName || p.name, listName: p.name, brand: p.brand, file: p.file, embalagem: p.embalagem, decision: d};
    const prev = byEan.get(p.ean);
    if (!prev){ byEan.set(p.ean, rec); return; }
    // mesmo EAN em várias listas: se concordam, fica um; se não, não se escreve nada (decidir à mão)
    const a = prev.decision, b = d;
    if (a.ok && b.ok && (a.packageQuantity !== b.packageQuantity || a.packageUnit !== b.packageUnit)) prev.decision = {ok: false, reason: "o mesmo EAN dá tamanhos diferentes em listas diferentes"};
    else if (!a.ok && b.ok && /não se estraga/.test(a.reason) === false && /sem embalagem|sem quantidade/.test(a.reason)) byEan.set(p.ean, rec); // a outra lista tem embalagem
  });
  return Array.from(byEan.values());
}

if (require.main === module){
  const recs = run(__dirname);
  const ok = recs.filter(r => r.decision.ok);
  const sql = ["-- Tamanho da embalagem individual (dose) dos produtos perecíveis do Catálogo, a partir da coluna 'Embalagem' das listas lista-*.csv.",
    "-- Gerado por scripts/generate-pack-sizes.js — " + ok.length + " produtos (doses individuais de iogurte, bebida e queijo fresco). Só preenche linhas sem package_quantity.",
    "-- Corre isto no SQL Editor do Supabase. Pode correr-se mais do que uma vez (não sobrescreve nada).", ""]
    .concat(ok.map(r => "update food_products set package_quantity = " + r.decision.packageQuantity + ", package_unit = " + sqlStr(r.decision.packageUnit) + " where ean = " + sqlStr(r.ean) + " and package_quantity is null; -- " + r.name.replace(/[\r\n]/g, " ")))
    .join("\n") + "\n";
  fs.writeFileSync(path.join(__dirname, "output-pack-sizes.sql"), sql);
  const csv = ["EAN,Nome,Marca,Lista,Embalagem,Decisão,Tamanho (g/ml),Unidade,Categoria,Motivo"].concat(recs.map(r => [r.ean, r.name, r.brand, r.file, r.embalagem, r.decision.ok ? "preencher" : "ignorar", r.decision.ok ? r.decision.packageQuantity : "", r.decision.ok ? r.decision.packageUnit : "", r.decision.ok ? r.decision.category : "", r.decision.ok ? (r.decision.form === "multi" ? "unidade de um pack de " + r.decision.count : "embalagem individual") : r.decision.reason].map(csvCell).join(","))).join("\n") + "\n";
  fs.writeFileSync(path.join(__dirname, "output-pack-sizes-review.csv"), csv);
  const reasons = {};
  recs.filter(r => !r.decision.ok).forEach(r => { reasons[r.decision.reason] = (reasons[r.decision.reason] || 0) + 1; });
  console.log("Produtos nas listas (EAN únicos):", recs.length);
  console.log("A preencher:", ok.length, "(multi-packs:", ok.filter(r => r.decision.form === "multi").length + ", embalagem individual:", ok.filter(r => r.decision.form === "single").length + ")");
  console.log("Ignorados por motivo:"); Object.keys(reasons).sort((a, b) => reasons[b] - reasons[a]).forEach(k => console.log("  " + String(reasons[k]).padStart(5) + "  " + k));
}
module.exports = { run, parseCsv, loadProducts, loadDbNames, normalizeEan };
