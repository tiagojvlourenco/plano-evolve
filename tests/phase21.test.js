// Fase 21 — três pedidos depois de usar as Fases 19/20 com dados reais:
// (1) editar um alimento do plano (trocar o alimento ou a quantidade), não
// só apagar; (2) bebidas em mililitros, não em gramas; (3) mostrar os
// "não reconhecidos" no momento de aplicar o rascunho ao plano, não só
// enquanto o rascunho está visível.
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

// ---- 1. isBeverage: heurística por nome, exclui formas secas/em pó/em grão ----

// 1. Reconhece bebidas óbvias — inclui "água" e "café", que expuseram um bug
// à parte: "\bágua\b"/"\bcafé\b" nunca acertavam (o \b nativo do JS não
// reconhece á/é como "carácter de palavra", só ASCII) — ver accentSafeWordRegex.
(function(){
  check.check("1. 'Água' é bebida", isBeverage("Água") === true);
  check.check("1. 'Café, infusão - bica' é bebida (café no FIM, sem acabar em \\b nativo)", isBeverage("Café, infusão - bica") === true);
  check.check("1. 'Vinho do Porto, doce' é bebida", isBeverage("Vinho do Porto, doce") === true);
  check.check("1. 'Leite de coco, enlatado' é bebida", isBeverage("Leite de coco, enlatado") === true);
})();

// 2. Nunca marca sólidos como bebida
(function(){
  check.check("2. 'Frango (peito)' não é bebida", isBeverage("Frango (peito)") === false);
  check.check("2. 'Azeite' não é bebida (é líquido, mas não 'bebível')", isBeverage("Azeite") === false);
})();

// 3. Exclui formas secas/em pó/em grão mesmo com palavra de bebida no nome
(function(){
  check.check("3. 'Café solúvel em pó' NÃO é bebida (é pó)", isBeverage("Café solúvel em pó") === false);
  check.check("3. 'Café em grão' NÃO é bebida (é grão)", isBeverage("Café em grão") === false);
  check.check("3. 'Leite em pó' NÃO é bebida", isBeverage("Leite em pó") === false);
})();

// 4. qtyStringWithBeverageUnit troca "g" por "ml" só em bebidas
(function(){
  check.check("4. Troca 'g' por 'ml' numa bebida", qtyStringWithBeverageUnit("Água", "250 g") === "250 ml");
  check.check("4. Não mexe num sólido", qtyStringWithBeverageUnit("Frango (peito)", "150 g") === "150 g");
  check.check("4. Não mexe se já não termina em 'g' (ex.: unidades)", qtyStringWithBeverageUnit("Água", "1 unid.") === "1 unid.");
})();

// ---- 2. buildQtyString / tplAddFoodQty / defaultQtyForFood usam "ml" para bebidas ----

// 5. buildQtyString devolve "ml" para uma bebida real da base (vinho, um alimento com per:100g)
(function(){
  var name = "Vinho do Porto, doce";
  var db = FOOD_DB[name];
  check.check("5. Existe na base como per:100g", !!db && db.per === "100g");
  check.check("5. buildQtyString devolve ml para bebida", buildQtyString(name, 250) === "250 ml");
  check.check("5. buildQtyString continua a devolver g para sólido", buildQtyString("Frango (peito)", 150) === "150 g");
})();

// 6. tplAddFoodQty mostra o rótulo certo consoante o alimento
(function(){
  check.check("6. Rótulo 'ml' para bebida", tplAddFoodQty("Água").indexOf("Quantidade (ml)") >= 0);
  check.check("6. Rótulo 'g' para sólido", tplAddFoodQty("Frango (peito)").indexOf("Quantidade (g)") >= 0);
})();

// 7. FOOD_GROUPS já vem normalizado (Fase 21): entradas de bebida têm qty em ml
(function(){
  var found = null;
  Object.keys(FOOD_GROUPS).forEach(function(g){
    FOOD_GROUPS[g].forEach(function(o){ if (o.name === "Vinho do Porto, doce") found = o; });
  });
  check.check("7. Uma bebida real em FOOD_GROUPS já tem qty em ml", !!found && / ml$/.test(found.qty));
})();

// ---- 3. Editar um alimento do plano: trocar alimento ou quantidade, não só apagar ----

// 8. Cada alimento tem um botão de editar (✏️) além do de remover (✕)
(function(){
  var m = meal("Almoço", "13:00", [food("Frango (peito)","150 g","protein")]);
  var html = tplPlanoMealEditor(m, 0);
  check.check("8. Tem o botão de editar", html.indexOf('data-edit-food="0"') >= 0);
  check.check("8. Continua a ter o botão de remover", html.indexOf('data-del-food="0"') >= 0);
})();

// 9. O formulário de edição existe no HTML mas começa escondido, pré-preenchido com o alimento atual
(function(){
  var m = meal("Almoço", "13:00", [food("Frango (peito)","150 g","protein")]);
  var html = tplPlanoMealEditor(m, 0);
  check.check("9. Existe um formulário de edição para este alimento", html.indexOf('data-edit-form="0-0"') >= 0);
  check.check("9. Começa escondido (classe hidden)", /food-edit-form hidden" data-edit-form="0-0"/.test(html));
  check.check("9. Vem pré-preenchido com o nome atual", html.indexOf('class="ef-food" data-midx="0" data-fidx="0" value="Frango (peito)"') >= 0);
  check.check("9. Vem pré-preenchido com a quantidade atual (150)", /class="ef-qty-num"[^>]*value="150"/.test(html));
})();

// 10. wireProTab liga o botão de editar a mostrar/esconder o formulário (toggle), sem mexer no plano
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function wireProTab"), appSource.indexOf("function wireProTab") + 20000);
  var block = fnSrc.slice(fnSrc.indexOf('querySelectorAll("[data-edit-food]")'), fnSrc.indexOf('querySelectorAll("[data-edit-food]")') + 500);
  check.check("10. Alterna a classe hidden do formulário certo", block.indexOf("classList.toggle(\"hidden\")") >= 0);
})();

// 11. Guardar a edição substitui o alimento (nome/quantidade/grupo) e regista no histórico
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function wireProTab"), appSource.indexOf("function wireProTab") + 20000);
  var block = fnSrc.slice(fnSrc.indexOf('querySelectorAll("[data-save-food-edit]")'), fnSrc.indexOf('querySelectorAll("[data-save-food-edit]")') + 1400);
  check.check("11. Substitui m.foods[fidx] com o novo alimento", block.indexOf("m.foods[fidx] = food(name, qty, group)") >= 0);
  check.check("11. Regista a alteração no histórico do plano", block.indexOf("logFoodEdited(s, m.name, oldFood, m.foods[fidx])") >= 0);
  check.check("11. Valida que a quantidade é positiva antes de guardar", block.indexOf("amount > 0") >= 0);
  check.check("11. Persiste e volta a renderizar depois de guardar", block.indexOf("persistStudent(s)") >= 0 && block.indexOf("renderProTabContent(s)") >= 0);
})();

// 12. Simulação direta (sem DOM): editar troca o alimento certo sem afetar os outros
(function(){
  var s = freshStudent();
  s.meals = [meal("Almoço", "13:00", [
    food("Frango (peito)","150 g","protein"),
    food("Arroz (cozido)","150 g","carb")
  ])];
  var oldFood = s.meals[0].foods[0];
  var newQty = buildQtyString("Atum (natural)", 120);
  s.meals[0].foods[0] = food("Atum (natural)", newQty, "protein");
  logFoodEdited(s, s.meals[0].name, oldFood, s.meals[0].foods[0]);
  check.check("12. O primeiro alimento foi trocado", s.meals[0].foods[0].name === "Atum (natural)" && s.meals[0].foods[0].qty === "120 g");
  check.check("12. O segundo alimento não foi tocado", s.meals[0].foods[1].name === "Arroz (cozido)" && s.meals[0].foods[1].qty === "150 g");
  check.check("12. Ficou registado no histórico do plano", s.planHistory.some(function(ev){ return ev.type === "alimento_editado"; }));
})();

// ---- 4. Avisar sobre "não reconhecidos" no momento de aplicar, não só no rascunho ----

// 13. wireProTab calcula e mostra os não-reconhecidos na notificação e no histórico ao aplicar
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function wireProTab"), appSource.indexOf("function wireProTab") + 20000);
  var block = fnSrc.slice(fnSrc.indexOf("draftFromDailyText"), fnSrc.indexOf("draftFromDailyText") + 3600);
  check.check("13. Calcula allUnmatchedWords com extractUnmatchedWords", block.indexOf("extractUnmatchedWords(d.sourceText, matchedNames, index)") >= 0);
  check.check("13. Inclui os não-reconhecidos na notificação (toast)", block.indexOf("toastMsg += \". Não reconhecidos") >= 0);
  check.check("13. Inclui os não-reconhecidos no resumo registado no histórico", block.indexOf("não reconhecidos: \" + allUnmatchedWords.join") >= 0);
})();

// 14. Simulação direta: aplicar com uma palavra não reconhecida na descrição regista-a no histórico
(function(){
  var s = freshStudent({dailyEatingDescription:"Ao almoço como frango com azeitonas."});
  var draft = draftPlanFromDailyText(s.dailyEatingDescription);
  var index = getFoodKeywordIndex();
  var allUnmatchedWords = [];
  draft.forEach(function(d){
    var matchedNames = d.foods.map(function(f){ return f.name; });
    extractUnmatchedWords(d.sourceText, matchedNames, index).forEach(function(w){
      if (allUnmatchedWords.indexOf(w) === -1) allUnmatchedWords.push(w);
    });
  });
  check.check("14. Encontra 'azeitonas' como não reconhecido mesmo com o resto da refeição aplicada", allUnmatchedWords.indexOf("azeitonas") >= 0);
})();

// ---- 5. Bug apanhado ao testar ao vivo: logPlanEvent(s, tipo, resumo, null, null) nunca
// registava nada — a proteção contra duplicados ("before === after, não regista de novo")
// disparava sempre que before/after eram ambos null (null === null), mesmo sem antes/depois
// fazer sentido para este tipo de evento (é um resumo de ação, não a alteração de um campo).

// 15. logPlanEvent sem before/after (undefined) regista sempre — nunca é tratado como "sem alteração"
(function(){
  var s = freshStudent();
  logPlanEvent(s, "plano_gerado_texto", "Resumo qualquer");
  check.check("15. Fica registado mesmo sem before/after", s.planHistory.length === 1 && s.planHistory[0].summary === "Resumo qualquer");
})();

// 16. Confirma que já não sobrou nenhuma chamada com null,null a estes dois tipos de evento
(function(){
  check.check("16. plano_gerado_texto já não passa null, null", appSource.indexOf('logPlanEvent(s, "plano_gerado_texto", summary, null, null)') === -1);
  var ajusteBlock = appSource.slice(appSource.indexOf('logPlanEvent(s, "ajuste_quantidades"'), appSource.indexOf('logPlanEvent(s, "ajuste_quantidades"') + 200);
  check.check("16. ajuste_quantidades já não passa null, null", ajusteBlock.indexOf(", null, null)") === -1);
})();

check.summarize();
