// Tamanho da embalagem individual de produtos que se estragam depois de abertos (iogurtes, queijo fresco, fiambre, leite...).
// Lê o texto "Embalagem" das listas de produtos (Open Food Facts: "150 g", "500 g (4 x 125 g)", "4x125g", "1 l", ...) e devolve
// o tamanho de UMA unidade fechada, que é o que a app usa para o plano não deixar sobras (FOOD_PACKS / package_quantity).
// Cópia, de propósito, das expressões da app (index.html): tests/pack-sizes.test.js confirma que continuam iguais.
"use strict";

var PERISHABLE_AFTER_OPENING = /iogurte|skyr|leite|queijo|fiambre|presunto|peru fatiado|natas|requeij|bebida vegetal|kefir|sumo|molho|pudim|manteiga|margarina|húmus|hummus|paté|mozzarella|mozarela|cottage|ricotta|burrata|camembert|brie|feta|quark|tofu|tempeh|seitan/i;
// o nome começa por (ou tem na 1.ª/2.ª palavra) um produto que não se estraga depois de aberto: "Pão de Leite", "Chocolate de leite", "Bolachas com manteiga"...
var NOT_PERISHABLE_HEAD = /^(?:\S+\s+)?(?:bolacha|biscoito|batata|bolo|wafer|chocolate|p[ãa]o|barra|snack|tosta|gelado|doce|feij|cereais|granola|muesli|pastilha|caramelo|compota|cacau)/i;
var NOT_PERISHABLE_ANYWHERE = /(?:manteiga|pasta|creme) de amendoim/i;
function isPerishableAfterOpening(name){
  name = String(name || "");
  return PERISHABLE_AFTER_OPENING.test(name) && !NOT_PERISHABLE_HEAD.test(name) && !NOT_PERISHABLE_ANYWHERE.test(name);
}

// só se aplica a doses individuais: um pote de 250 g ou uma garrafa de 1 l não são "uma dose" e obrigariam a comer o pote inteiro
var PACK_MIN = 10, PACK_MAX = 200;

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
  var m, mm;
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
  return firstR;
}

// decide o que escrever em food_products: só doses individuais (10–200 g/ml) de produtos que se estragam depois de abertos
function packForProduct(name, embalagem){
  if (!isPerishableAfterOpening(name)) return {ok: false, reason: "não se estraga depois de aberto (ou nome não reconhecido)"};
  var p = parsePackaging(embalagem);
  if (!p.ok) return p;
  if (p.size < PACK_MIN) return skip("unidade muito pequena (" + p.size + " " + p.unit + ")");
  if (p.size > PACK_MAX) return skip("embalagem grande (" + p.size + " " + p.unit + "): não é uma dose individual");
  return {ok: true, packageQuantity: p.size, packageUnit: p.unit, form: p.form, count: p.count};
}

module.exports = {PERISHABLE_AFTER_OPENING: PERISHABLE_AFTER_OPENING, NOT_PERISHABLE_HEAD: NOT_PERISHABLE_HEAD, NOT_PERISHABLE_ANYWHERE: NOT_PERISHABLE_ANYWHERE, isPerishableAfterOpening: isPerishableAfterOpening, parsePackaging: parsePackaging, packForProduct: packForProduct, PACK_MIN: PACK_MIN, PACK_MAX: PACK_MAX};
