// Fase 30 — pedido do profissional: "consegues arranjar uma lista de todos
// os alimentos com tabela nutricional junto dos principais hipermercados?
// Continente, pingo doce, mercadona, etc" — queria produtos de marca
// (própria e de fabricante) para acrescentar aos alimentos da app, porque
// faltavam produtos comerciais concretos (ex.: "corgete não tem").
//
// Fonte: Open Food Facts (base de dados aberta e gratuita). O PortFIR/INSA
// já era a fonte da base genérica existente (não traria produtos novos) e a
// Nutripédia tem a base de produtos comerciais fechada dentro de um
// software pago, por isso não era uma fonte a usar. A recolha inicial via
// API teve muitos problemas de qualidade (nomes nalgumas fichas vinham de
// Espanha/França/Alemanha, por a Open Food Facts partilhar fichas entre
// países, dados corrompidos, dezenas de "Azeite Virgem Extra" quase
// idênticos) — por isso o resultado final é uma lista pequena (114
// produtos) curada e verificada à mão, um a um, em vez do lote todo (~628)
// tal como veio da API.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

// 1. O FOOD_DB cresceu com os produtos de marca acrescentados
(function(){
  check.check("1. FOOD_DB tem pelo menos 100 alimentos a mais do que os 1397 da base INSA/curada", Object.keys(FOOD_DB).length >= 1497);
})();

// 2. Produtos de marca própria (marca branca) de vários supermercados existem
(function(){
  check.check("2. 'Azeite virgem extra (Hacendado)' existe (Mercadona)", !!FOOD_DB["Azeite virgem extra (Hacendado)"]);
  check.check("2. 'Leite meio-gordo (Continente)' existe", !!FOOD_DB["Leite meio-gordo (Continente)"]);
  check.check("2. 'Azeite virgem extra (Pingo Doce)' existe", !!FOOD_DB["Azeite virgem extra (Pingo Doce)"]);
  check.check("2. 'Leite magro (Continente Equilíbrio)' existe", !!FOOD_DB["Leite magro (Continente Equilíbrio)"]);
})();

// 3. Produtos de marca de fabricante (não marca branca) também existem
(function(){
  check.check("3. 'Coca-Cola original (Coca-Cola)' existe", !!FOOD_DB["Coca-Cola original (Coca-Cola)"]);
  check.check("3. 'Nutella — creme de avelã e cacau (Nutella)' existe", !!FOOD_DB["Nutella — creme de avelã e cacau (Nutella)"]);
  check.check("3. 'Penne Rigate (Barilla)' existe", !!FOOD_DB["Penne Rigate (Barilla)"]);
  check.check("3. 'Sardinhas portuguesas em azeite (Ramirez)' existe", !!FOOD_DB["Sardinhas portuguesas em azeite (Ramirez)"]);
})();

// 4. Todos os produtos novos têm per:"100g" e os 4 valores nutricionais como números válidos
(function(){
  var novos = ["Azeite virgem extra (Hacendado)", "Pão de forma branco (Hacendado)", "Ovos frescos (Continente)",
    "Mirtilos (Pingo Doce)", "Tomate pelado em pedaços (Hacendado)", "Guacamole (Mercadona)", "Pringles original (Pringles)"];
  novos.forEach(function(n){
    var db = FOOD_DB[n];
    check.check("4. '" + n + "' é per:\"100g\" com kcal/p/c/f numéricos válidos",
      !!db && db.per === "100g" && isFinite(db.kcal) && isFinite(db.p) && isFinite(db.c) && isFinite(db.f) &&
      db.kcal >= 0 && db.p >= 0 && db.c >= 0 && db.f >= 0);
  });
})();

// 5. Os produtos novos ficam classificados no grupo (dos 7 novos da Fase 29) certo
(function(){
  check.check("5. 'Azeite virgem extra (Hacendado)' está em FOOD_GROUPS.gorduras", FOOD_GROUPS.gorduras.some(function(o){ return o.name === "Azeite virgem extra (Hacendado)"; }));
  check.check("5. 'Pão de forma branco (Hacendado)' está em FOOD_GROUPS.cereais", FOOD_GROUPS.cereais.some(function(o){ return o.name === "Pão de forma branco (Hacendado)"; }));
  check.check("5. 'Leite meio-gordo (Continente)' está em FOOD_GROUPS.laticinios", FOOD_GROUPS.laticinios.some(function(o){ return o.name === "Leite meio-gordo (Continente)"; }));
  check.check("5. 'Ovos frescos (Continente)' está em FOOD_GROUPS.carnes", FOOD_GROUPS.carnes.some(function(o){ return o.name === "Ovos frescos (Continente)"; }));
  check.check("5. 'Mirtilos (Pingo Doce)' está em FOOD_GROUPS.fruta", FOOD_GROUPS.fruta.some(function(o){ return o.name === "Mirtilos (Pingo Doce)"; }));
  check.check("5. 'Tomate pelado em pedaços (Hacendado)' está em FOOD_GROUPS.vegetais", FOOD_GROUPS.vegetais.some(function(o){ return o.name === "Tomate pelado em pedaços (Hacendado)"; }));
  check.check("5. 'Coca-Cola original (Coca-Cola)' está em FOOD_GROUPS.snacks", FOOD_GROUPS.snacks.some(function(o){ return o.name === "Coca-Cola original (Coca-Cola)"; }));
})();

// 6. Nenhum produto novo substituiu/colidiu com um alimento genérico já existente
(function(){
  check.check("6. O 'Azeite' genérico da base INSA continua intacto", FOOD_DB["Azeite"] && FOOD_DB["Azeite"].kcal > 0 && FOOD_DB["Azeite"] !== FOOD_DB["Azeite virgem extra (Hacendado)"]);
  check.check("6. O 'Frango (peito)' genérico continua com os valores originais do INSA", FOOD_DB["Frango (peito)"].kcal === 165 && FOOD_DB["Frango (peito)"].p === 31);
})();

// 7. Os alimentos "líquidos" (leites/bebidas) usam ml como unidade por omissão, os restantes usam g
(function(){
  check.check("7. 'Leite meio-gordo (Continente)' usa ml", FOOD_GROUPS.laticinios.find(function(o){ return o.name === "Leite meio-gordo (Continente)"; }).qty.indexOf("ml") >= 0);
  check.check("7. 'Azeite virgem extra (Hacendado)' usa g", FOOD_GROUPS.gorduras.find(function(o){ return o.name === "Azeite virgem extra (Hacendado)"; }).qty.indexOf("g") >= 0);
})();

check.summarize();
