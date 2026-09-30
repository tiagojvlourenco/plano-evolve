// Fase 34 — catálogo de produtos de supermercado (food_products), pedido
// explícito e muito detalhado do profissional para substituir os produtos
// de marca escritos diretamente no código (Fase 30) por um catálogo
// próprio, apoiado em Supabase: EAN, marca, supermercado(s), fonte, data e
// estado de validação. Só "verified" fica disponível a um aluno.
//
// IMPORTANTE (deixado claro também no relatório final): isto testa a
// LÓGICA em JavaScript — mergeFoodProduct/loadFoodProducts/formatação do
// nome — com o mesmo motor usado no resto de `npm test`. RLS e restrições
// da base de dados (produto pending invisível a um aluno, EAN duplicado
// rejeitado, insert/update/delete bloqueados para quem não é profissional)
// só são verificáveis com SQL real contra o projeto Supabase — ver
// supabase/verify_food_products_security.sql, para correres tu no SQL
// Editor depois de aplicares a migração 0018.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

function sampleRow(overrides){
  var base = {
    id: "test-id-1", ean: "5601234567890", name: "Produto Teste", brand: "MarcaTeste",
    food_group: "snacks", nutrition_basis: "100g",
    kcal: 200, protein: 10, carbs: 20, fat: 5,
    verification_status: "verified", source_type: "open_food_facts"
  };
  Object.keys(overrides || {}).forEach(function(k){ base[k] = overrides[k]; });
  return base;
}

// 1. foodProductDisplayName: "Nome (Marca)" sem retalhista, ou com 1; nunca
// com 2+ (evita ambiguidade/repetição no nome)
(function(){
  check.check("1. Sem retalhistas -> 'Nome (Marca)'", foodProductDisplayName(sampleRow(), []) === "Produto Teste (MarcaTeste)");
  check.check("1. 1 retalhista -> 'Nome (Marca) · Retalhista'", foodProductDisplayName(sampleRow(), [{retailer:"Continente"}]) === "Produto Teste (MarcaTeste) · Continente");
  check.check("1. 2+ retalhistas -> sem sufixo (ambíguo)", foodProductDisplayName(sampleRow(), [{retailer:"Continente"},{retailer:"Pingo Doce"}]) === "Produto Teste (MarcaTeste)");
  check.check("1. undefined/null retailers -> sem sufixo, não rebenta", foodProductDisplayName(sampleRow(), undefined) === "Produto Teste (MarcaTeste)");
})();

// 2. mergeFoodProduct: nunca substitui um nome já existente em FOOD_DB
// (INSA, curado, Fase 30 ou custom_foods) — mesma trava de mergeCustomFood
(function(){
  var existing = "Frango (peito)";
  var before = JSON.stringify(FOOD_DB[existing]);
  var ok = mergeFoodProduct(sampleRow({name:"Frango", brand:"peito"}), []);
  check.check("2. mergeFoodProduct recusa colidir com um nome já existente", ok === false);
  check.check("2. O alimento existente fica inalterado", JSON.stringify(FOOD_DB[existing]) === before);
})();

// 3. mergeFoodProduct: acrescenta um produto novo a FOOD_DB e ao grupo certo
(function(){
  var row = sampleRow({name:"Snack Novo XPTO", brand:"TesteBrand", food_group:"snacks"});
  var ok = mergeFoodProduct(row, []);
  var name = "Snack Novo XPTO (TesteBrand)";
  check.check("3. mergeFoodProduct devolve true para um produto novo", ok === true);
  check.check("3. O produto fica em FOOD_DB com os valores certos", !!FOOD_DB[name] && FOOD_DB[name].kcal === 200 && FOOD_DB[name].p === 10 && FOOD_DB[name].c === 20 && FOOD_DB[name].f === 5);
  check.check("3. O produto fica no grupo certo (resolveGroup aplicado)", FOOD_GROUPS.snacks.some(function(o){ return o.name === name; }));
})();

// 4. mergeFoodProduct: com exatamente 1 retalhista, o nome inclui a loja
(function(){
  var row = sampleRow({name:"Iogurte proteico natural", brand:"YoPRO", food_group:"laticinios"});
  mergeFoodProduct(row, [{retailer:"Continente"}]);
  check.check("4. Nome com retalhista único fica com '· Continente'", !!FOOD_DB["Iogurte proteico natural (YoPRO) · Continente"]);
  check.check("4. Fica no grupo laticínios", FOOD_GROUPS.laticinios.some(function(o){ return o.name === "Iogurte proteico natural (YoPRO) · Continente"; }));
})();

// 5. mergeFoodProduct: chamado 2 vezes com o mesmo nome nunca duplica a
// entrada no grupo (idempotente, tal como mergeCustomFood)
(function(){
  var row = sampleRow({name:"Produto Repetido", brand:"MarcaX", food_group:"cereais"});
  mergeFoodProduct(row, []);
  var countBefore = FOOD_GROUPS.cereais.filter(function(o){ return o.name === "Produto Repetido (MarcaX)"; }).length;
  mergeFoodProduct(row, []); // segunda chamada, mesmo nome
  var countAfter = FOOD_GROUPS.cereais.filter(function(o){ return o.name === "Produto Repetido (MarcaX)"; }).length;
  check.check("5. Chamar mergeFoodProduct 2x com o mesmo nome não duplica no grupo", countBefore === 1 && countAfter === 1);
})();

// 6. loadFoodProducts: pede só "verification_status=verified" ao Supabase
// (pending/rejected nunca chegam a FOOD_DB por este caminho)
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function loadFoodProducts"), appSource.indexOf("function loadFoodProducts") + 500);
  check.check("6. loadFoodProducts filtra por verification_status = verified", fnSrc.indexOf('.eq("verification_status", "verified")') >= 0);
  check.check("6. loadFoodProducts também pede food_product_retailers (para o sufixo de loja)", fnSrc.indexOf("food_product_retailers") >= 0);
})();

// 7. Alimentos já num plano continuam a calcular macros sem alterações —
// mergeFoodProduct/loadFoodProducts não mexem em foodNutrition/FOOD_DB de
// alimentos existentes
(function(){
  var m = meal("Almoço","13:00",[food("Frango (peito)","150 g","carnes")]);
  var totals = foodsTotals(m.foods);
  check.check("7. 'Frango (peito)' continua a calcular os macros esperados", totals.kcal === Math.round(165*1.5) && totals.p === 46.5);
})();

// 8. Nenhum alimento genérico do INSA foi alterado por esta fase (spot check)
(function(){
  check.check("8. 'Arroz (cozido)' continua com os valores originais do INSA", FOOD_DB["Arroz (cozido)"].kcal === 130 && FOOD_DB["Arroz (cozido)"].p === 2.7);
  check.check("8. 'Azeite' genérico continua intacto", FOOD_DB["Azeite"] && FOOD_DB["Azeite"].kcal > 0);
})();

// 9. Novo estado de navegação: "Catálogo" existe ao lado de "Dashboard" em
// renderProShell, fora de PRO_TABS (que são por aluno)
(function(){
  check.check("9. PRO_TABS não inclui 'catalogo'/'catálogo' (não é um separador por aluno)", !PRO_TABS.some(function(t){ return /cat[aá]logo/i.test(t[0]) || /cat[aá]logo/i.test(t[1]); }));
  var fnSrc = appSource.slice(appSource.indexOf("function renderProShell"), appSource.indexOf("function renderProShell") + 1200);
  check.check("9. renderProShell tem um botão navCatalog", fnSrc.indexOf('id=\\"navCatalog\\"') >= 0);
  check.check("9. renderProShell despacha para renderProCatalogMain quando proView === 'catalog'", appSource.indexOf('state.proView === "catalog"') >= 0 && appSource.indexOf("renderProCatalogMain()") >= 0);
})();

check.summarize();
