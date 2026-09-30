// Fase 31 — pedido do profissional: "ha alguma forma de ao selecionar o
// alimento dizer as calorias por 100g e por dose bem como os macros?" — ao
// adicionar/editar um alimento no plano, mostrar logo kcal/P/H/G por 100g
// (ou por unidade, para alimentos como "Ovos") e para a dose que está de
// facto a ser escolhida, e atualizar isso ao vivo enquanto a quantidade é
// escrita.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

// 1. foodNutritionPreviewHtml: alimento por 100g mostra a base e a dose corretas
(function(){
  var html = foodNutritionPreviewHtml("Frango (peito)", 150);
  check.check("1. Mostra 'Por 100g' para um alimento per:\"100g\"", html.indexOf("Por 100g:") >= 0);
  check.check("1. Base por 100g usa os valores de FOOD_DB sem escala", html.indexOf("165 kcal") >= 0 && html.indexOf("P 31g") >= 0);
  check.check("1. Dose (150g) está escalada corretamente", html.indexOf("Nesta dose (150 g): 248 kcal") >= 0 && html.indexOf("P 46.5g") >= 0);
})();

// 2. Alimento per:"unit" (ex.: Ovos) mostra "Por unidade", não "Por 100g"
(function(){
  var html = foodNutritionPreviewHtml("Ovos", 3);
  check.check("2. Mostra 'Por unidade' para um alimento per:\"unit\"", html.indexOf("Por unidade:") >= 0);
  check.check("2. Dose usa 'unid.' como unidade", html.indexOf("Nesta dose (3 unid.)") >= 0);
})();

// 3. Alimento per:"fixed" (à vontade) não mostra nada — não há dose para calcular
// (nenhum alimento real do FOOD_DB é per:"fixed" desde a Fase 23, por isso
// injeta-se um fictício, tal como noutros testes deste tipo)
(function(){
  FOOD_DB["Teste Fixo XPTO"] = {per:"fixed", kcal:0, p:0, c:0, f:0};
  check.check("3. Sem preview para alimento 'à vontade' (per:\"fixed\")", foodNutritionPreviewHtml("Teste Fixo XPTO", 100) === "");
})();

// 4. Bebida usa "ml" em vez de "g" (isBeverage)
(function(){
  var html = foodNutritionPreviewHtml("Leite meio gordo, UHT", 200);
  check.check("4. Bebida usa 'Por 100ml'", html.indexOf("Por 100ml:") >= 0);
  check.check("4. Dose de bebida usa 'ml'", html.indexOf("200 ml") >= 0);
})();

// 5. Sem quantidade válida (amount inválido), usa o valor por omissão (100 ou 1) em vez de rebentar
(function(){
  check.check("5. amount NaN cai para 100g por omissão", foodNutritionPreviewHtml("Frango (peito)", NaN).indexOf("Nesta dose (100 g)") >= 0);
  check.check("5. amount 0 ou negativo também cai para a omissão", foodNutritionPreviewHtml("Frango (peito)", -5).indexOf("Nesta dose (100 g)") >= 0);
})();

// 6. Alimento desconhecido não rebenta, devolve string vazia
(function(){
  check.check("6. Alimento inexistente devolve string vazia", foodNutritionPreviewHtml("Alimento Que Não Existe XPTO", 100) === "");
})();

// 7. tplAddFoodQty/tplEditFoodQty embutem o preview automaticamente
(function(){
  check.check("7. tplAddFoodQty inclui a classe food-nutri-preview", tplAddFoodQty("Frango (peito)").indexOf("food-nutri-preview") >= 0);
  check.check("7. tplEditFoodQty inclui a classe food-nutri-preview", tplEditFoodQty("Frango (peito)", 200).indexOf("food-nutri-preview") >= 0);
  check.check("7. tplAddFoodQty NÃO mostra preview para alimento 'à vontade'", tplAddFoodQty("Teste Fixo XPTO").indexOf("food-nutri-preview") === -1);
})();

// 8. wireProTab liga um listener de "input" delegado (não um por cada campo,
// que teria de ser religado sempre que a quantidade/grupo mudam)
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function wireProTab"), appSource.indexOf("function wireProTab") + 15000);
  check.check("8. Liga um listener de input em 'el' (delegado)", /el\.addEventListener\("input"/.test(fnSrc));
  check.check("8. O listener reconhece af-qty-num e ef-qty-num", fnSrc.indexOf("af-qty-num") >= 0 && fnSrc.indexOf("ef-qty-num") >= 0);
  check.check("8. O listener chama foodNutritionPreviewHtml para atualizar", fnSrc.indexOf("foodNutritionPreviewHtml(nameInput.value") >= 0);
})();

check.summarize();
