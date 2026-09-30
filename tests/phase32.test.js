// Fase 32 — 3 pedidos do profissional depois de testar ao vivo:
//   1. "ao escrever o nome de alimento aparece logo um alimento (não quero
//      que apareça nada!)" — o campo "Alimento" vinha sempre com um
//      alimento pré-preenchido (o primeiro do grupo selecionado).
//   2. "queijo fresco magro + pão de forma Rustik Bakery + mirtilos nao
//      aparecem" — a pesquisa estava restrita ao grupo selecionado no
//      dropdown "Grupo", por isso um alimento que existe mas está noutro
//      grupo nunca aparecia (ex.: "Queijo fresco magro" está em
//      "Lacticínios", não em "Cereais", o grupo por omissão).
//   3. "quero que nos alimentos ao carregar apareça os que tens por lista e
//      ordenados" — ao focar o campo sem escrever nada, mostrar a lista
//      completa por ordem alfabética, não uma ordem arbitrária.
// ("Pão de forma ... Rustik Bakery" nunca chegou a ser acrescentado na
// Fase 30 — o nome original na Open Food Facts era ambíguo/truncado
// ("CLASICA / CLASSICO") e ficou de fora da limpeza manual; não é um bug
// de pesquisa, é um alimento que ainda não existe na base.)
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

// 1. allFoodNames(): todos os alimentos do FOOD_DB, ordenados alfabeticamente
(function(){
  var names = allFoodNames();
  check.check("1. allFoodNames() devolve o mesmo total que FOOD_DB", names.length === Object.keys(FOOD_DB).length);
  var sorted = names.slice().sort(function(a,b){ return a.localeCompare(b, "pt"); });
  check.check("1. A lista já vem ordenada alfabeticamente", JSON.stringify(names) === JSON.stringify(sorted));
})();

// 2. Um alimento de QUALQUER grupo aparece na pesquisa global, mesmo sem
// estar no grupo por omissão (cereais) — o bug relatado
(function(){
  check.check("2. 'Queijo fresco magro' (lacticínios) aparece a pesquisar em todos os alimentos", filterFoodNames(allFoodNames(), "queijo fresco magro").indexOf("Queijo fresco magro") >= 0);
  check.check("2. 'Mirtilos' (fruta) aparece a pesquisar em todos os alimentos", filterFoodNames(allFoodNames(), "mirtilos").indexOf("Mirtilos") >= 0);
  check.check("2. Ambas as variantes de Mirtilos aparecem (genérico + Pingo Doce)", filterFoodNames(allFoodNames(), "mirtilos").length === 2);
})();

// 3. tplAddFoodForm: o campo "Alimento" começa vazio, nunca pré-preenchido
(function(){
  var html = tplAddFoodForm(0);
  var m = html.match(/class="af-food"[^>]*value="([^"]*)"/);
  check.check("3. O valor inicial do campo Alimento está vazio", !!m && m[1] === "");
  check.check("3. Os resultados iniciais vêm de allFoodNames(), não de um grupo só", html.indexOf("food-search-results") >= 0);
})();

// 4. tplEditFoodForm: o campo "Alimento" continua a mostrar o alimento ATUAL
// (isto não é o mesmo bug — aqui faz sentido mostrar o que já lá está)
(function(){
  var f = food("Frango (peito)", "150 g", "protein");
  var html = tplEditFoodForm(0, 0, f);
  check.check("4. tplEditFoodForm mostra o nome do alimento atual (não vazio)", html.indexOf('value="Frango (peito)"') >= 0);
})();

// 5. wireProTab: a pesquisa de .af-food/.ef-food usa allFoodNames() (global),
// não foodOptionsForGroup() (restrito ao grupo selecionado)
(function(){
  var afIdx = appSource.indexOf('el.querySelectorAll(".af-food")');
  var afBlock = appSource.slice(afIdx, afIdx + 900);
  check.check("5. O bloco .af-food usa allFoodNames() na pesquisa", afBlock.indexOf("foodSearchResultsHtml(allFoodNames()") >= 0);
  check.check("5. O bloco .af-food já não filtra por foodOptionsForGroup()", afBlock.indexOf("foodOptionsForGroup(") === -1);

  var efIdx = appSource.indexOf('el.querySelectorAll(".ef-food")');
  var efBlock = appSource.slice(efIdx, efIdx + 900);
  check.check("5. O bloco .ef-food usa allFoodNames() na pesquisa", efBlock.indexOf("foodSearchResultsHtml(allFoodNames()") >= 0);
  check.check("5. O bloco .ef-food já não filtra por foodOptionsForGroup()", efBlock.indexOf("foodOptionsForGroup(") === -1);
})();

// 6. Ao escolher um alimento na pesquisa, o "Grupo" atualiza-se sozinho
// para o grupo REAL desse alimento (groupOfFood), em vez de ficar com o
// grupo que estava selecionado antes (que podia já não corresponder)
(function(){
  var afIdx = appSource.indexOf('el.querySelectorAll(".af-food")');
  var afBlock = appSource.slice(afIdx, afIdx + 1200);
  check.check("6. .af-food atualiza o Grupo com groupOfFood(name) ao escolher", afBlock.indexOf("groupSel.value = groupOfFood(name)") >= 0);

  var efIdx = appSource.indexOf('el.querySelectorAll(".ef-food")');
  var efBlock = appSource.slice(efIdx, efIdx + 1600);
  check.check("6. .ef-food atualiza o Grupo com groupOfFood(name) ao escolher", efBlock.indexOf("groupSel.value = groupOfFood(name)") >= 0);
})();

// 7. Mudar o "Grupo" manualmente já não reescreve o alimento escolhido
// (antes: trocar de grupo esvaziava/substituía o alimento por defeito)
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function wireProTab"), appSource.indexOf("function wireProTab") + 20000);
  check.check("7. Já não há nenhum '.value = options[0]' a mexer no alimento ao trocar de grupo", fnSrc.indexOf("foodInput.value = options[0]") === -1);
})();

check.summarize();
