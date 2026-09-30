// Fase 33 — depois de testar ao vivo a Fase 32:
//   1. "quando carrego em grupo a categoria do alimento quero que no
//      'alimento' esse mesmo se apague porque selecionei uma categoria a
//      que não pertence" — trocar manualmente o "Grupo" com um alimento já
//      escolhido que não pertence a esse grupo deve limpar o campo
//      "Alimento" (antes: ficava lá, com uma etiqueta de grupo errada).
//   2. "ponto 3 não corrigiu" (a lista ordenada ao focar o campo Alimento,
//      da Fase 32) — NÃO era caching: era um bug real de seletor. Uma
//      refeição com mais de um alimento tem vários
//      ".food-search-results[data-midx=X]" (um por cada "Editar alimento"
//      já existente, cada um com o seu próprio data-fidx) e o
//      ".af-food"/".ef-food" iam buscar o resultsEl só por data-midx —
//      apanhavam sempre o primeiro da refeição (escondido, de outro
//      alimento) em vez do seu próprio. Confirmado ao vivo no browser:
//      getBoundingClientRect() do elemento errado devolvia {w:0,h:0} —
//      o dropdown estava mesmo a ser escrito, só que no sítio errado.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

// 1. O resultsEl de .af-food/.ef-food já não depende de [data-midx] sozinho
// — usa o irmão seguinte do input no DOM, que é sempre o seu próprio
(function(){
  var afIdx = appSource.indexOf('el.querySelectorAll(".af-food")');
  var afBlock = appSource.slice(afIdx, afIdx + 500);
  check.check("1. .af-food usa input.nextElementSibling para o resultsEl", afBlock.indexOf("var resultsEl = input.nextElementSibling;") >= 0);

  var efIdx = appSource.indexOf('el.querySelectorAll(".ef-food")');
  var efBlock = appSource.slice(efIdx, efIdx + 700);
  check.check("1. .ef-food usa input.nextElementSibling para o resultsEl", efBlock.indexOf("var resultsEl = input.nextElementSibling;") >= 0);
})();

// 2. Trocar o Grupo manualmente, com um alimento escolhido que NÃO pertence
// a esse grupo, limpa o campo Alimento
(function(){
  var afGroupIdx = appSource.indexOf('el.querySelectorAll(".af-group")');
  var afGroupBlock = appSource.slice(afGroupIdx, afGroupIdx + 600);
  check.check("2. .af-group tem um listener de change", afGroupBlock.indexOf('sel.addEventListener("change"') >= 0);
  check.check("2. .af-group compara groupOfFood(foodInput.value) com sel.value", afGroupBlock.indexOf("groupOfFood(foodInput.value) !== sel.value") >= 0);
  check.check("2. .af-group limpa o campo Alimento quando não corresponde", afGroupBlock.indexOf('foodInput.value = "";') >= 0);

  var efGroupIdx = appSource.indexOf('el.querySelectorAll(".ef-group")');
  var efGroupBlock = appSource.slice(efGroupIdx, efGroupIdx + 700);
  check.check("2. .ef-group tem um listener de change", efGroupBlock.indexOf('sel.addEventListener("change"') >= 0);
  check.check("2. .ef-group compara groupOfFood(foodInput.value) com sel.value", efGroupBlock.indexOf("groupOfFood(foodInput.value) !== sel.value") >= 0);
  check.check("2. .ef-group limpa o campo Alimento quando não corresponde", efGroupBlock.indexOf('foodInput.value = "";') >= 0);
})();

// 3. tplAddFoodQty/tplEditFoodQty continuam seguros com um nome vazio
// (usado depois de limpar o campo Alimento por troca de grupo)
(function(){
  check.check("3. tplAddFoodQty('') não rebenta", typeof tplAddFoodQty("") === "string");
  check.check("3. tplEditFoodQty('', null) não rebenta", typeof tplEditFoodQty("", null) === "string");
  check.check("3. Nenhum dos dois mostra preview nutricional para nome vazio", tplAddFoodQty("").indexOf("food-nutri-preview") === -1 && tplEditFoodQty("", null).indexOf("food-nutri-preview") === -1);
})();

check.summarize();
