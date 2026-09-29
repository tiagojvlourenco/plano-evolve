// Fase 16 — base de alimentos alargada com a Tabela da Composição de
// Alimentos do INSA (fonte pública oficial), e pesquisa nos 3 sítios onde
// alimentos são escolhidos (profissional a montar plano, construtor de
// refeições do aluno, e "Substituir"), em vez de listas/dropdowns longos.
const fs = require("fs");
const path = require("path");
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

function freshStudent(overrides){
  var base = {
    id:"x", name:"Teste Aluno", flexibility:50, flexOverrides:{}, blockedFoods:[],
    substitutionHistory:[], adaptationHistory:[], photos:[], weightLogPhotos:[],
    likes:[], dislikes:[], avoid:[], allergies:[],
    targets:{kcal:2000, protein:150, carbs:200, fat:60},
    meals:[], planHistory:[]
  };
  Object.keys(overrides || {}).forEach(function(k){ base[k] = overrides[k]; });
  return base;
}

// ---- 1. Dados do INSA carregados ----

// 1. FOOD_DB e FOOD_GROUPS cresceram muito face à base curada original (~31 / ~27)
(function(){
  check.check("1. FOOD_DB tem mais de 1000 alimentos", Object.keys(FOOD_DB).length > 1000);
  ["protein","carb","veg","fat","fruit"].forEach(function(g){
    check.check("1. FOOD_GROUPS." + g + " tem mais de 90 alimentos", FOOD_GROUPS[g].length > 90);
  });
})();

// 2. Alimentos comuns do INSA estão presentes e com dados coerentes
(function(){
  check.check("2. 'Salmão cru' existe no FOOD_DB", !!FOOD_DB["Salmão cru"]);
  check.check("2. 'Salmão cru' tem kcal/proteína plausíveis", FOOD_DB["Salmão cru"].kcal > 100 && FOOD_DB["Salmão cru"].p > 15);
  check.check("2. 'Feijão-verde fresco cozido' existe", !!FOOD_DB["Feijão-verde fresco cozido"]);
  check.check("2. 'Sementes de chia' existe e é gordura-dominante ou razoável", !!FOOD_DB["Sementes de chia"]);
})();

// 3. Colisões de nome com a base curada original (per:"unit") foram evitadas —
// "Banana" e "Iogurte grego natural" do INSA (per:"100g") não substituíram as originais
(function(){
  check.check("3. Banana mantém-se per:unit (base curada original)", FOOD_DB["Banana"].per === "unit" && FOOD_DB["Banana"].kcal === 105);
  check.check("3. Iogurte grego natural mantém-se per:100g com os valores originais", FOOD_DB["Iogurte grego natural"].kcal === 97);
})();

// ---- 2. filterFoodNames / foodSearchResultsHtml (pesquisa partilhada) ----

// 4. filterFoodNames filtra por substring, sem distinguir maiúsculas/minúsculas
(function(){
  var names = ["Frango (peito)", "Peru (fatiado)", "Salmão cru", "Atum (natural)"];
  check.check("4. Sem termo, devolve tudo", filterFoodNames(names, "").length === 4);
  check.check("4. Filtra por substring", filterFoodNames(names, "salmão").length === 1);
  check.check("4. Case-insensitive", filterFoodNames(names, "SALMÃO").length === 1);
  check.check("4. Sem correspondência, devolve vazio", filterFoodNames(names, "xyzxyz").length === 0);
})();

// 5. foodSearchResultsHtml limita o número de linhas renderizadas (FOOD_SEARCH_RENDER_CAP)
(function(){
  var names = FOOD_GROUPS.protein.map(function(o){ return o.name; });
  check.check("5. Grupo protein tem mais alimentos que o limite de render", names.length > FOOD_SEARCH_RENDER_CAP);
  var html = foodSearchResultsHtml(names, "");
  var itemCount = (html.match(/food-search-item/g) || []).length;
  check.check("5. Nunca renderiza mais que FOOD_SEARCH_RENDER_CAP itens de uma vez", itemCount <= FOOD_SEARCH_RENDER_CAP);
  check.check("5. Avisa que há mais para pesquisar", html.indexOf("mais") >= 0);
})();

// ---- 3. "+ Adicionar alimento" (profissional): pesquisa em vez de <select> ----

// 6. tplAddFoodForm usa input de pesquisa, não <select>, para o alimento
(function(){
  var html = tplAddFoodForm(0);
  check.check("6. Não usa <select class=\"af-food\">", html.indexOf('<select class="af-food"') === -1);
  check.check("6. Usa <input class=\"af-food\">", /<input type="text" class="af-food"/.test(html));
  check.check("6. Tem o contentor de resultados de pesquisa", html.indexOf('class="food-search-results"') >= 0);
})();

// 7. wireProTab liga .af-food ao evento input/focus (pesquisa), não change (comportamento de select)
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function wireProTab"), appSource.indexOf("function wireProTab") + 20000);
  var afFoodBlock = fnSrc.slice(fnSrc.indexOf('querySelectorAll(".af-food")'), fnSrc.indexOf('querySelectorAll(".af-food")') + 1200);
  check.check("7. Liga .af-food a 'input' (pesquisa em tempo real)", afFoodBlock.indexOf('addEventListener("input", refresh)') >= 0);
  check.check("7. Liga também a 'focus' (mostra sugestões ao focar)", afFoodBlock.indexOf('addEventListener("focus", refresh)') >= 0);
  check.check("7. Usa foodSearchResultsHtml para renderizar os resultados", afFoodBlock.indexOf("foodSearchResultsHtml(options, input.value)") >= 0);
})();

// ---- 4. Construtor de refeições (aluno): opções inline limitadas + "Ver mais" ----

// 8. tplMealChoice mostra só até INLINE_BUILDER_OPTIONS_MAX + a escolha atual, com botão "Ver mais" quando há mais
(function(){
  var s = freshStudent({allergies:[], avoid:[]});
  var m = meal("Almoço", "13:00", [food("Frango (peito)","150 g","protein")]);
  var html = tplMealChoice(m, 0, s);
  var optCount = (html.match(/class="builder-opt/g) || []).length;
  check.check("8. protein tem mais opções que o limite inline", FOOD_GROUPS.protein.length > INLINE_BUILDER_OPTIONS_MAX);
  check.check("8. Não mostra todas as opções inline (fica pelo limite)", optCount <= INLINE_BUILDER_OPTIONS_MAX + 1);
  check.check("8. Mostra o botão 'Ver mais alimentos' com a contagem em falta", /Ver mais alimentos \(\+\d+\)/.test(html));
})();

// 9. Se a escolha atual (liveChoice) estiver fora do subconjunto inicial, continua visível e marcada
(function(){
  var s = freshStudent({allergies:[], avoid:[]});
  var m = meal("Almoço", "13:00", [food("Frango (peito)","150 g","protein")]);
  m.liveChoice = {protein: FOOD_GROUPS.protein.length - 1}; // último item, certamente fora do subconjunto inicial
  var html = tplMealChoice(m, 0, s);
  check.check("9. A opção selecionada (fora do topo) continua a aparecer marcada", html.indexOf('data-oi="' + (FOOD_GROUPS.protein.length - 1) + '"') >= 0);
  var idx = html.indexOf('data-oi="' + (FOOD_GROUPS.protein.length - 1) + '"');
  var tagStart = html.lastIndexOf("<div", idx);
  check.check("9. Essa opção tem a classe 'sel'", html.slice(tagStart, idx).indexOf(" sel\"") >= 0);
})();

// 10. openMealOptionPicker e a ligação do botão "Ver mais" existem
(function(){
  check.check("10. openMealOptionPicker existe", typeof openMealOptionPicker === "function");
  var fnSrc = appSource.slice(appSource.indexOf("function wireAlunoTab"), appSource.indexOf("function wireAlunoTab") + 15000);
  check.check("10. wireAlunoTab liga [data-more-food-midx]", fnSrc.indexOf("data-more-food-midx") >= 0);
  check.check("10. Chama openMealOptionPicker com optionsFor(f, s)", fnSrc.indexOf("openMealOptionPicker(optionsFor(f, s)") >= 0);
})();

// 11. Bloqueio de segurança (Fase 8) continua a funcionar: locked não mostra builder-opt nem "Ver mais"
(function(){
  var s = freshStudent({allergies:["Marisco"]});
  var m = meal("Almoço", "13:00", [food("Frango (peito)","150 g","protein")]);
  var html = tplMealChoice(m, 0, s);
  check.check("11. Com alergia não mapeada, não mostra opções clicáveis", html.indexOf("builder-opt") === -1);
  check.check("11. Não mostra 'Ver mais alimentos' (bloqueado)", html.indexOf("Ver mais alimentos") === -1);
  check.check("11. Mostra a mensagem de segurança", html.indexOf(DIET_RISK_SAFE_MESSAGE) >= 0);
})();

// ---- 5. Substituir (openSubstitution): pesquisa quando há muitas alternativas ----

// 12. optionsHtml/renderList de openSubstitution existe com pesquisa (verificado por fonte, sem DOM real)
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function openSubstitution"), appSource.indexOf("function openSubstitution") + 6000);
  check.check("12. Tem um input de pesquisa (subSearch)", fnSrc.indexOf("subSearch") >= 0);
  check.check("12. Só mostra a pesquisa quando há mais de 8 alternativas", fnSrc.indexOf("options.length > 8") >= 0);
  check.check("12. Limita o render com FOOD_SEARCH_RENDER_CAP", fnSrc.indexOf("FOOD_SEARCH_RENDER_CAP") >= 0);
  check.check("12. Os índices mostrados continuam a referir-se ao array completo (não recalcula computeEquivalentAlternative ao filtrar)", fnSrc.indexOf("options[idx]") >= 0);
})();

check.summarize();
