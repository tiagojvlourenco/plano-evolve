// Tamanho da embalagem individual de produtos que se estragam depois de abertos (iogurtes, queijo fresco, leite...).
// Lê o texto "Embalagem" das listas de produtos (Open Food Facts: "150 g", "500 g (4 x 125 g)", "4x125g", "1 l", ...) e devolve
// o tamanho de UMA unidade fechada, que é o que a app usa para o plano não deixar sobras (FOOD_PACKS / package_quantity).
//
// Só se preenchem DOSES INDIVIDUAIS (um copo de iogurte, uma unidade de queijo fresco, um pacote de leite): produtos de uso fracionado
// (queijo ralado, fatiado ou curado, fiambre, húmus, natas, molhos, conservas) nunca se comem de uma vez e forçariam porções absurdas.
// As expressões PERISHABLE_AFTER_OPENING, NOT_PERISHABLE_HEAD e NOT_PERISHABLE_ANYWHERE são cópia das da app (index.html): tests/pack-sizes.test.js confirma que continuam iguais.
"use strict";

// o produto aparece nas 3 primeiras palavras do nome ("Mythos Iogurte Estilo Grego", "100% Sumo de Pera"); uma palavra de sabor mais à frente ("Nachos sabor a Queijo", "Chocolate de Leite") não conta
var PERISHABLE_AFTER_OPENING = /^(?:\S+\s+){0,2}(?:iogurte|yogurte|skyr|quark|kefir|pudim|flan|leite|bebida vegetal|queijo|requeij|cottage|mozzarella|mozarela|burrata|ricotta|feta|camembert|brie|natas|fiambre|peru fatiado|presunto|paté|húmus|hummus|tofu|tempeh|seitan|sumo|margarina|manteiga|molho)/i;
// produtos que não se estragam depois de abertos, ainda que a palavra apareça ao início: "Pão de Leite", "Bolachas com manteiga", "Brioche de leite"
var NOT_PERISHABLE_HEAD = /^(?:\S+\s+)?(?:bolacha|biscoito|biscuit|batata|bolo|wafer|chocolate|p[ãa]o|brioche|barra|snack|tosta|gelado|doce|feij|cereais|granola|muesli|pastilha|caramelo|compota|cacau|palitos|palets)/i;
var NOT_PERISHABLE_ANYWHERE = /(?:manteiga|pasta|creme) de amendoim|leite de coco|leite condensado|leite em p[óo]|molho de soja|tempero|piri-?piri|pesto/i;
function isPerishableAfterOpening(name){
  name = String(name || "");
  return PERISHABLE_AFTER_OPENING.test(name) && !NOT_PERISHABLE_HEAD.test(name) && !NOT_PERISHABLE_ANYWHERE.test(name);
}

// ---- classificação para preencher embalagens (mais estrita do que a da app) ----
var HEAD3 = "^(?:\\S+\\s+){0,2}(?:";
var CATEGORIES = [
  // copos de iogurte e semelhantes (também líquidos): até 200 g/ml
  {key: "iogurte", head: new RegExp(HEAD3 + "iogurte|yogurte|skyr|quark|kefir|pudim|flan)", "i"), max: 200, kcalMax: 250},
  // leite e bebidas vegetais em pacote pequeno
  {key: "bebida", head: new RegExp(HEAD3 + "leite|bebida vegetal|sumo)", "i"), max: 250, kcalMax: 120, unit: "ml"},
  // unidades individuais de queijo fresco (2 x 62,5 g...) e cottage, requeijão, burrata, mozzarella fresca
  {key: "queijo fresco", head: new RegExp(HEAD3 + "queijo fresco|queijo cottage|cottage|requeij|burrata|ricotta|mozzarella|mozarela)", "i"), max: 125, kcalMax: 350,
    exclude: /ralad|fatiad|fatias|pizza|gratinar|massas|mexicano|culin|barrar|cremos|creme|cremette|mousse|curad/i}
];
// em qualquer categoria: peso variável, condimentos, conservas, snacks e sobremesas congeladas
var NEVER = /ralad|fatiad|fatias|curad|barrar|cremos|cremette|culin[áa]ri|para (?:pizza|massas|gratinar|cozinhar)|gratinar|pesto|tempero|molho|conserva|atum|sardinha|polvo|lula|cavala|nachos|tortilla|aperitivo|snack|gelado|bombom|chocolate de leite|chocolate branco|brioche|natas|húmus|hummus|paté|fiambre|presunto/i;

// só doses individuais: um pote de 250 g ou uma garrafa de 1 l não são "uma dose" e obrigariam a comer o pote inteiro
var PACK_MIN = 10, PACK_MAX = 250;

var UNIT = "(kg|gramas?|gram|gr|g|litros?|l|ml|cl)";
var QTY = "(\\d+(?:\\.\\d+)?)\\s*" + UNIT + "\\b";

function toBase(value, unit){
  unit = unit.toLowerCase();
  if (unit === "kg") return {size: value * 1000, unit: "g"};
  if (unit === "l" || unit === "litro" || unit === "litros") return {size: value * 1000, unit: "ml"};
  if (unit === "cl") return {size: value * 10, unit: "ml"};
  if (unit === "ml") return {size: value, unit: "ml"};
  return {size: value, unit: "g"}; // g, gr, gram, grama(s)
}
function round(n){ return Math.round(n * 100) / 100; }
function skip(reason){ return {ok: false, reason: reason}; }

function parseOne(alt){
  var m;
  // "4 x 125 g", "4x125g", "2 x 62.5 g"
  m = alt.match(new RegExp("(\\d+)\\s*x\\s*" + QTY, "i"));
  // "115 g x 4"
  var m2 = m ? null : alt.match(new RegExp(QTY + "\\s*x\\s*(\\d+)\\b", "i"));
  if (m || m2){
    var count = m ? parseInt(m[1], 10) : parseInt(m2[3], 10);
    var base = m ? toBase(parseFloat(m[2]), m[3]) : toBase(parseFloat(m2[1]), m2[2]);
    if (!(count >= 1) || !(base.size > 0)) return skip("multi-embalagem ilegível");
    return {ok: true, form: "multi", count: count, unit: base.unit, size: round(base.size)};
  }
  var inner = alt.match(/\(([^)]*)\)/);
  var first = alt.replace(/\([^)]*\)/g, " ").match(new RegExp(QTY, "i"));
  if (!first) return skip("sem quantidade");
  var main = toBase(parseFloat(first[1]), first[2]);
  if (inner){
    if (/\+/.test(inner[1])) return skip("parêntesis com soma de pesos");
    var other = inner[1].match(new RegExp(QTY, "i"));
    // "250 g (125 g)" é, em regra, peso escorrido; "170 g (159 ml)" é só o mesmo produto noutra unidade
    if (other && toBase(parseFloat(other[1]), other[2]).unit === main.unit) return skip("parêntesis ambíguo (peso escorrido?)");
  }
  return {ok: true, form: "single", count: 1, unit: main.unit, size: round(main.size)};
}

// "Embalagem" (texto livre) → {ok, form: "single"|"multi", count, unit: "g"|"ml", size} ou {ok: false, reason}
function parsePackaging(raw){
  var s = String(raw == null ? "" : raw).trim().toLowerCase();
  if (!s) return skip("sem embalagem");
  if (/vari[aá]vel|~|aprox/.test(s)) return skip("peso variável");
  s = s.replace(/(\d),(\d)/g, "$1.$2").replace(/×/g, "x").replace(/\s+/g, " ");
  var alts = s.split(/\s*\/\s*/), results = [];
  alts.forEach(function(a){ var r = parseOne(a); if (r.ok) results.push(r); });
  if (!results.length) return parseOne(alts[0]);
  var firstR = results[0];
  // alternativas que dão tamanhos de unidade diferentes na mesma unidade de medida: ambíguo
  if (results.some(function(r){ return r.unit === firstR.unit && Math.abs(r.size - firstR.size) > 0.01 && r.form === "multi" && firstR.form === "multi"; })) return skip("alternativas com tamanhos diferentes");
  return Object.assign({alts: results}, firstR);
}

// categoria de dose individual (ou null): precisa de a palavra do produto estar à cabeça do nome e de não ser um produto de uso fracionado
function servingCategory(name, kcalPer100){
  name = String(name || "");
  if (!isPerishableAfterOpening(name)) return null;
  for (var i = 0; i < CATEGORIES.length; i++){
    var c = CATEGORIES[i];
    if (!c.head.test(name)) continue;
    if (c.key !== "iogurte" && NEVER.test(name)) return null;   // um iogurte pode ter "chocolate" no sabor: só os outros têm de passar pelas exclusões
    if (c.exclude && c.exclude.test(name)) return null;
    if (isFinite(kcalPer100) && kcalPer100 > c.kcalMax) return null; // nutrição incoerente com a categoria: "leite" que é pó de sobremesa, "presunto" que é snack...
    return c;
  }
  return null;
}

// decide o que escrever em food_products
function packForProduct(name, embalagem, kcalPer100, ean){
  if (ean && /^2\d{12}$/.test(String(ean))) return skip("código de peso variável (EAN 2...)");
  var cat = servingCategory(name, kcalPer100);
  if (!cat) return skip("não é uma dose individual de iogurte, bebida ou queijo fresco");
  var p = parsePackaging(embalagem);
  if (!p.ok) return p;
  // a embalagem pode vir em peso e em volume ("602 ml (4 x 150,6 ml) / 640 g (4 x 160 g)"): bebidas ficam em ml, o resto em g (é como o plano mede)
  var wanted = cat.unit || "g", same = (p.alts || []).filter(function(a){ return a.unit === wanted; })[0];
  if (same) p = same;
  if (p.size < PACK_MIN) return skip("unidade muito pequena (" + p.size + " " + p.unit + ")");
  if (p.size > cat.max) return skip("embalagem grande (" + p.size + " " + p.unit + "): não é uma dose individual de " + cat.key);
  if (cat.unit && p.unit !== cat.unit) return skip("unidade " + p.unit + " numa bebida: confirmar à mão");
  return {ok: true, packageQuantity: p.size, packageUnit: p.unit, form: p.form, count: p.count, category: cat.key};
}

module.exports = {PERISHABLE_AFTER_OPENING: PERISHABLE_AFTER_OPENING, NOT_PERISHABLE_HEAD: NOT_PERISHABLE_HEAD, NOT_PERISHABLE_ANYWHERE: NOT_PERISHABLE_ANYWHERE, isPerishableAfterOpening: isPerishableAfterOpening,
  parsePackaging: parsePackaging, servingCategory: servingCategory, packForProduct: packForProduct, PACK_MIN: PACK_MIN, PACK_MAX: PACK_MAX, CATEGORIES: CATEGORIES};
