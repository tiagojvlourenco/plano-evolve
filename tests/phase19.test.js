// Fase 19 — ajuste automático de quantidades aos alvos nutricionais.
// Pedido explícito e corrigido a meio: TODOS os alimentos contam, incluindo
// vegetais e fruta, não só grupos protein/carb/fat — só fica de fora quem
// estiver mesmo "à vontade" (sem número nenhum para reescalar).
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

// ---- 1. priorityMacroForFood: decide pelo que o alimento realmente contribui mais ----

// 1. Frango (proteína dominante), Arroz (hidratos dominante), Azeite (gordura, só gordura)
(function(){
  check.check("1. Frango (peito) -> proteína", priorityMacroForFood("Frango (peito)") === "p");
  check.check("1. Arroz (cozido) -> hidratos", priorityMacroForFood("Arroz (cozido)") === "c");
  check.check("1. Azeite -> gordura", priorityMacroForFood("Azeite") === "f");
  check.check("1. Alimento inexistente devolve null", priorityMacroForFood("Isto não existe") === null);
})();

// 2. Um vegetal/fruta com macros reais também tem macro prioritário (participa no ajuste)
(function(){
  // Cenoura tem per:"fixed" na base curada original — usa outro com per:"100g" do INSA para testar isto
  check.check("2. Maçã (fruta, per:unit) tem macro prioritário calculável", priorityMacroForFood("Maçã") === "c");
})();

// ---- 2. scaleFoodQty: reescala mantendo o tipo de unidade, nunca mexe em "à vontade" ----

// 3. Reescala gramas, arredondado a 5g
(function(){
  check.check("3. 150 g x2 -> 300 g", scaleFoodQty("Frango (peito)", "150 g", 2) === "300 g");
  check.check("3. 150 g x1.5 arredonda a 5g", scaleFoodQty("Frango (peito)", "150 g", 1.5) === "225 g");
})();

// 4. Preserva "ml" em vez de trocar para "g"
(function(){
  check.check("4. Azeite em ml mantém-se em ml ao reescalar", scaleFoodQty("Azeite", "10 ml", 2) === "20 ml");
})();

// 5. Reescala unidades para um número inteiro, nunca 0
(function(){
  check.check("5. Ovos: 3 unid. x0.4 -> arredonda para 1 (nunca 0)", scaleFoodQty("Ovos", "3 unid.", 0.4) === "1 unid.");
  check.check("5. Ovos: 2 unid. x1.6 -> 3 unid.", scaleFoodQty("Ovos", "2 unid.", 1.6) === "3 unid.");
})();

// 6. Nunca mexe em alimentos "à vontade" (nem por per:"fixed" na base, nem pelo texto da quantidade)
(function(){
  check.check("6. 'à vontade' nunca é reescalado, mesmo com escala grande", scaleFoodQty("Brócolos", "à vontade", 3) === "à vontade");
})();

// ---- 3. autoAdjustPlanQuantities: tudo conta, incluindo vegetais e fruta com quantidade real ----

// 7. Cenário simples: só proteína e hidratos no plano, cada um reescalado independentemente
(function(){
  var s = freshStudent({targets:{kcal:2000, protein:100, carbs:100, fat:60}});
  s.meals = [meal("Almoço","13:00",[
    food("Frango (peito)","100 g","protein"), // 31g proteína por 100g
    food("Arroz (cozido)","100 g","carb") // 28g hidratos por 100g
  ])];
  var result = autoAdjustPlanQuantities(s);
  check.check("7. Alterou os 2 alimentos", result.changed === 2);
  var totals = foodsTotals(s.meals[0].foods);
  check.check("7. Proteína final fica perto do alvo (100g)", Math.abs(totals.p - 100) <= 5);
  check.check("7. Hidratos final fica perto do alvo (100g)", Math.abs(totals.c - 100) <= 5);
})();

// 8. Vegetais e fruta COM quantidade real (não "à vontade") entram no ajuste — pedido explícito
(function(){
  var s = freshStudent({targets:{kcal:2000, protein:0, carbs:200, fat:0}});
  // "Maçã" (fruta, per:unit) e "Batata-doce" (carb) — ambos contribuem para hidratos
  s.meals = [meal("Lanche","17:00",[
    food("Maçã","1 unid.","fruit"),
    food("Batata-doce","100 g","carb")
  ])];
  var before = foodNutrition("Maçã","1 unid.").c;
  var result = autoAdjustPlanQuantities(s);
  check.check("8. Mexeu na fruta também (não ficou de fora por ser 'fruit')", result.changed === 2);
  var maça = s.meals[0].foods.find(function(f){ return f.name === "Maçã"; });
  check.check("8. A quantidade da maçã mudou de '1 unid.' (fruta reescalada)", maça.qty !== "1 unid.");
})();

// 9. Um vegetal genuinamente "à vontade" fica de fora e conta em "untouched"
(function(){
  var s = freshStudent({targets:{kcal:2000, protein:100, carbs:0, fat:0}});
  s.meals = [meal("Jantar","20:00",[
    food("Frango (peito)","100 g","protein"),
    food("Brócolos","à vontade","veg")
  ])];
  var result = autoAdjustPlanQuantities(s);
  check.check("9. Só mexeu no frango (1 alterado)", result.changed === 1);
  check.check("9. Contou 1 alimento 'à vontade' como untouched", result.untouched === 1);
  var brocolos = s.meals[0].foods.find(function(f){ return f.name === "Brócolos"; });
  check.check("9. Brócolos continua 'à vontade'", brocolos.qty === "à vontade");
})();

// 10. Sem nenhum alimento a contribuir para um macro com alvo definido, sinaliza em skippedMacros
(function(){
  var s = freshStudent({targets:{kcal:2000, protein:100, carbs:100, fat:60}});
  s.meals = [meal("Almoço","13:00",[food("Frango (peito)","100 g","protein")])];
  var result = autoAdjustPlanQuantities(s);
  check.check("10. Sinaliza que falta hidratos e gordura no plano", result.skippedMacros.indexOf("carb") >= 0 && result.skippedMacros.indexOf("fat") >= 0);
  check.check("10. Não sinaliza proteína (já tem alimento)", result.skippedMacros.indexOf("protein") === -1);
})();

// 11. Mantém as proporções relativas entre alimentos do mesmo macro
(function(){
  var s = freshStudent({targets:{kcal:2000, protein:150, carbs:0, fat:0}});
  s.meals = [
    meal("Almoço","13:00",[food("Frango (peito)","200 g","protein")]),
    meal("Jantar","20:00",[food("Atum (natural)","100 g","protein")])
  ];
  autoAdjustPlanQuantities(s);
  var frangoG = parseFloat(s.meals[0].foods[0].qty);
  var atumG = parseFloat(s.meals[1].foods[0].qty);
  // Frango começou com o dobro do atum — depois de reescalar pela mesma proporção, continua perto do dobro
  check.check("11. Mantém a proporção 2:1 entre os dois alimentos do mesmo macro", Math.abs((frangoG / atumG) - 2) < 0.3);
})();

// ---- 4. UI: botão só aparece com refeições, confirma antes de aplicar, regista no histórico ----

// 12. tplProPlano só mostra o botão quando há refeições
(function(){
  var vazio = freshStudent({targets:{kcal:2000,protein:150,carbs:200,fat:60}, meals:[]});
  check.check("12. Sem refeições, não mostra o botão de ajuste", tplProPlano(vazio).indexOf("autoAdjustBtn") === -1);

  var comRefeicoes = freshStudent({targets:{kcal:2000,protein:150,carbs:200,fat:60}, meals:[meal("Almoço","13:00",[])]});
  check.check("12. Com refeições, mostra o botão de ajuste", tplProPlano(comRefeicoes).indexOf("autoAdjustBtn") >= 0);
})();

// 13. wireProTab pede confirmação antes de aplicar, e regista no histórico do plano
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function wireProTab"), appSource.indexOf("function wireProTab") + 20000);
  var block = fnSrc.slice(fnSrc.indexOf("autoAdjustBtn"), fnSrc.indexOf("autoAdjustBtn") + 1200);
  check.check("13. Pede confirmação com window.confirm antes de aplicar", block.indexOf("window.confirm(") >= 0);
  check.check("13. Chama autoAdjustPlanQuantities(s)", block.indexOf("autoAdjustPlanQuantities(s)") >= 0);
  check.check("13. Regista no histórico do plano com logPlanEvent", block.indexOf("logPlanEvent(s, \"ajuste_quantidades\"") >= 0);
  check.check("13. Persiste e volta a renderizar depois de ajustar", block.indexOf("persistStudent(s)") >= 0 && block.indexOf("renderProTabContent(s)") >= 0);
})();

check.summarize();
