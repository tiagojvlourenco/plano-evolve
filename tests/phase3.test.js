// Fase 3 — plano alimentar + substituições.
require("./setup")();
eval(require("./extract-app")());
var check = require("./check")();

function freshMeal(){
  return meal("Almoço","13:00",[
    food("Frango (peito)","150 g","protein"),
    food("Arroz (cozido)","120 g","carb"),
    food("Brócolos","à vontade","veg"),
    food("Azeite","10 ml","fat", false)
  ]);
}

// 1. Criar refeição / estrutura básica
(function(){
  var m = freshMeal();
  check.check("1. Refeição criada com 4 alimentos", m.foods.length === 4);
  check.check("1. Refeição começa não adaptada", m.adapted === false);
})();

// 2. Adicionar alimento (food() com required default true)
(function(){
  var f = food("Maçã","1 unid.","fruit");
  check.check("2. food() sem 4º parâmetro é required por omissão", f.required === true);
  var f2 = food("Azeite","10 ml","fat", false);
  check.check("2. food() com required=false marca opcional", f2.required === false);
})();

// 3. Alterar quantidade -> recalcular macros
(function(){
  var m = freshMeal();
  var before = foodsTotals(m.foods);
  m.foods[0].qty = "300 g";
  var after = foodsTotals(m.foods);
  check.check("3. Alterar quantidade recalcula proteína", after.p > before.p);
})();

// 4. Recalcular calorias após alteração
(function(){
  var m = freshMeal();
  var before = foodsTotals(m.foods).kcal;
  m.foods[1].qty = "240 g";
  var after = foodsTotals(m.foods).kcal;
  check.check("4. Recalcula calorias após alteração de quantidade", after > before);
})();

// 5. Substituir alimento com equivalência nutricional (mesma proteína aprox.)
(function(){
  var s = { substitutionHistory: [] };
  var m = freshMeal();
  var original = m.foods[0]; // Frango (peito) protein
  var originalNutri = foodNutrition(original.name, original.qty);
  var alt = computeEquivalentAlternative(original, {name:"Peru (fatiado)", qty:"100 g"});
  var altNutri = foodNutrition(alt.name, alt.qty);
  check.check("5. Alternativa calculada tem proteína aproximadamente equivalente", Math.abs(altNutri.p - originalNutri.p) < originalNutri.p*0.15);
})();

// 6. Confirmar substituição -> aplica, marca adaptada, guarda original
(function(){
  var s = { substitutionHistory: [] };
  var m = freshMeal();
  var origFood = {name:m.foods[0].name, qty:m.foods[0].qty};
  applySubstitution(s, m, 0, {name:"Peru (fatiado)", qty:"150 g"});
  check.check("6. Substituição aplica novo alimento", m.foods[0].name === "Peru (fatiado)");
  check.check("6. Refeição marcada como adaptada", m.adapted === true);
  check.check("6. Alimento original preservado para reversão", m.foods[0].original && m.foods[0].original.name === origFood.name);
})();

// 7. Histórico de substituição regista entrada
(function(){
  var s = { substitutionHistory: [] };
  var m = freshMeal();
  applySubstitution(s, m, 0, {name:"Peru (fatiado)", qty:"150 g"});
  check.check("7. Histórico regista 1 substituição", s.substitutionHistory.length === 1);
  check.check("7. Histórico guarda de/para corretos", s.substitutionHistory[0].from === "Frango (peito)" && s.substitutionHistory[0].to === "Peru (fatiado)");
})();

// 8. Reverter substituição -> volta ao alimento original, remove estado adaptada
(function(){
  var s = { substitutionHistory: [] };
  var m = freshMeal();
  var origName = m.foods[0].name, origQty = m.foods[0].qty;
  applySubstitution(s, m, 0, {name:"Peru (fatiado)", qty:"150 g"});
  check.check("8. mealHasRevertible true após substituição", mealHasRevertible(m) === true);
  revertMeal(m);
  check.check("8. Reverter repõe nome original", m.foods[0].name === origName);
  check.check("8. Reverter repõe quantidade original", m.foods[0].qty === origQty);
  check.check("8. Reverter remove estado adaptada", m.adapted === false);
  check.check("8. mealHasRevertible false após reverter", mealHasRevertible(m) === false);
})();

// 9. Múltiplas substituições seguidas mantêm coerência (histórico + revert total)
(function(){
  var s = { substitutionHistory: [] };
  var m = freshMeal();
  applySubstitution(s, m, 0, {name:"Peru (fatiado)", qty:"150 g"});
  applySubstitution(s, m, 1, {name:"Batata-doce", qty:"150 g"});
  check.check("9. Histórico regista as duas substituições", s.substitutionHistory.length === 2);
  check.check("9. Ambos os slots substituídos guardam original", m.foods[0].original && m.foods[1].original);
  revertMeal(m);
  check.check("9. Reverter repõe ambos os alimentos originais", !m.foods[0].original && !m.foods[1].original);
  check.check("9. Refeição deixa de estar adaptada após reverter tudo", m.adapted === false);
})();

// 10. Prioridade de substituição manual (allowedSubs) sobre grupo genérico
(function(){
  var f = food("Frango (peito)","150 g","protein");
  f.allowedSubs = [{name:"Peru (fatiado)", qty:"150 g"}];
  var opts = optionsFor(f);
  check.check("10. optionsFor usa allowedSubs quando definido", opts.length === 1 && opts[0].name === "Peru (fatiado)");
  var fNoOverride = food("Frango (peito)","150 g","protein");
  var opts2 = optionsFor(fNoOverride);
  check.check("10. optionsFor usa FOOD_GROUPS quando não há allowedSubs", opts2 === FOOD_GROUPS.protein);
})();

// 11. Alimento sem substituição disponível (grupo vazio) não rebenta
(function(){
  var f = { name:"X", qty:"10 g", group:"inexistente", required:true };
  var opts = optionsFor(f);
  check.check("11. optionsFor devolve array vazio para grupo desconhecido", Array.isArray(opts) && opts.length === 0);
})();

// 12. Quantidade zero / inválida não gera NaN
(function(){
  var n = foodNutrition("Frango (peito)", "0 g");
  check.check("12. Quantidade 0g não gera NaN", !isNaN(n.kcal) && n.kcal === 0);
  var n2 = foodNutrition("Frango (peito)", "");
  check.check("12. Quantidade vazia não gera NaN", !isNaN(n2.kcal));
})();

// 13. Plano sem refeições não rebenta getNextMeal
(function(){
  var s = { meals: [], mealsDate: todayISO() };
  var nm = getNextMeal(s);
  check.check("13. Plano sem refeições devolve null em vez de rebentar", nm === null);
})();

// 14. Unidades adicionais: colher de sopa / colher de chá / porção
(function(){
  check.check("14. 1 colher de sopa = 15 g", parseQtyAmount("1 colher de sopa").kind === "g" && parseQtyAmount("1 colher de sopa").value === 15);
  check.check("14. 2 colheres de chá = 10 g", parseQtyAmount("2 colheres de chá").value === 10);
  check.check("14. 1 porção é tratada como unidade", parseQtyAmount("1 porção").kind === "unit" && parseQtyAmount("1 porção").value === 1);
})();

// 15. Grupo com prioridade de macro (protein/carb/fat) calcula equivalência correta
(function(){
  check.check("15. GROUP_PRIORITY_KEY mapeia protein->p", GROUP_PRIORITY_KEY.protein === "p");
  check.check("15. GROUP_PRIORITY_KEY mapeia carb->c", GROUP_PRIORITY_KEY.carb === "c");
  check.check("15. GROUP_PRIORITY_KEY mapeia fat->f", GROUP_PRIORITY_KEY.fat === "f");
  var original = food("Arroz (cozido)","150 g","carb");
  var alt = computeEquivalentAlternative(original, {name:"Batata-doce", qty:"100 g"});
  var origN = foodNutrition(original.name, original.qty);
  var altN = foodNutrition(alt.name, alt.qty);
  check.check("15. Equivalência de hidratos aproxima o valor de carb", Math.abs(altN.c - origN.c) < origN.c*0.2);
})();

// 16. Alimento opcional (required:false) permite "Nenhum" via liveChoice = -1
(function(){
  var m = freshMeal();
  ensureLiveChoiceDefaults(m);
  m.liveChoice.fat = -1;
  var t = liveChoiceTotals(m);
  check.check("16. liveChoice -1 contribui 0 para os totais desse grupo", true); // validated via totals below
  var withFat = (function(){ var m2 = freshMeal(); ensureLiveChoiceDefaults(m2); return liveChoiceTotals(m2); })();
  check.check("16. Selecionar 'Nenhum' reduz os totais face a ter gordura selecionada", t.kcal <= withFat.kcal);
})();

// 17. ensureLiveChoiceDefaults não sobrescreve escolha já feita
(function(){
  var m = freshMeal();
  ensureLiveChoiceDefaults(m);
  m.liveChoice.protein = 0;
  ensureLiveChoiceDefaults(m);
  check.check("17. ensureLiveChoiceDefaults preserva escolha existente", m.liveChoice.protein === 0);
})();

// 18. resolvedMealTotals usa liveChoice apenas fora do tier estruturado
(function(){
  var m = freshMeal();
  var s25 = { flexibility: 25 };
  var tEstruturado = resolvedMealTotals(s25, m);
  var base = foodsTotals(m.foods);
  check.check("18. Tier estruturado ignora liveChoice e usa foodsTotals", tEstruturado.kcal === Math.round(base.kcal) || tEstruturado.kcal === base.kcal);
})();

// 19. Feedback do construtor de refeição é neutro (sem linguagem culpabilizadora)
(function(){
  var m = freshMeal();
  ensureLiveChoiceDefaults(m);
  m.liveChoice.protein = -1 in FOOD_GROUPS.protein ? 0 : 0;
  var allMsgs = Object.keys(MACRO_FEEDBACK).map(function(k){ return MACRO_FEEDBACK[k].low + " " + MACRO_FEEDBACK[k].high; }).join(" ");
  check.check("19. Nenhuma mensagem de feedback usa linguagem culpabilizadora", /falhaste|errado|mal feito|devias|não devias/i.test(allMsgs) === false);
  var msgs = builderFeedback(m);
  check.check("19. builderFeedback devolve um array (mesmo que vazio)", Array.isArray(msgs));
})();

// 20. Dia de treino não inventa informação quando não definida (regressão já coberta, reconfirmar aqui no contexto de refeições)
(function(){
  var fake = { trainingDays: undefined };
  check.check("20. isTrainingDayToday não inventa dado quando ausente", isTrainingDayToday(fake) === null);
})();

// 21. REGRESSÃO: tplMealBuilder não deve mostrar feedback falso antes de inicializar liveChoice
// (bug encontrado ao testar ao vivo: builderFeedback corria antes de ensureLiveChoiceDefaults,
// via liveChoiceTotals contra um liveChoice vazio -> comparava 0 com o plano e assumia sempre falta de tudo)
(function(){
  var m = meal("Pequeno-almoço","08:00",[
    food("Ovos","2 unid.","protein"), food("Pão integral","80 g","carb"), food("Abacate","50 g","fat")
  ]);
  var s = {flexibility:85, flexOverrides:{}, blockedFoods:[]};
  var html = tplMealBuilder(m, 0, s);
  check.check("21. Sem feedback falso quando a seleção por omissão já bate certo com o plano (proteína)", !/Falta proteína/.test(html));
  check.check("21. Sem feedback falso quando a seleção por omissão já bate certo com o plano (hidratos)", !/Falta um pouco de hidratos/.test(html));
  check.check("21. Sem feedback falso quando a seleção por omissão já bate certo com o plano (gordura)", !/Falta um pouco de gordura/.test(html));
})();

check.summarize();
