// Fase 24 — causa raiz real do "as calorias continuam a não bater certo"
// (reportado depois das Fases 20-23): o texto do dia-a-dia de um aluno real
// tinha alternativas escritas como "150 g frango / peru / coelho" (é para
// escolher UM, não somar os três) e "* ou 150 g peixe branco" (mais uma
// alternativa à linha anterior) — o reconhecedor de palavras-chave da Fase
// 20 não distinguia isto de uma lista de alimentos genuinamente diferentes,
// e somava tudo. Com um plano assim inflacionado à partida, nem o "Ajustar
// quantidades aos alvos" (já matematicamente exato desde a Fase 22)
// conseguia bater certo — o problema nunca esteve no ajuste em si.
const fs = require("fs");
const path = require("path");
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

// ---- 1. matchFoodsInText: encontra correspondências ordenadas por posição no texto ----

// 1. Devolve as correspondências ordenadas pela posição em que aparecem
(function(){
  var index = getFoodKeywordIndex();
  var found = matchFoodsInText("frango com arroz", index);
  check.check("1. Encontra 'Frango (peito)' e 'Arroz (cozido)'", found.some(function(f){return f.name==="Frango (peito)";}) && found.some(function(f){return f.name==="Arroz (cozido)";}));
  check.check("1. 'Frango' vem antes de 'Arroz' (está mais cedo no texto)", found.findIndex(function(f){return f.name==="Frango (peito)";}) < found.findIndex(function(f){return f.name==="Arroz (cozido)";}));
})();

// ---- 2. draftPlanFromDailyText: "/" numa linha é alternativa, só a primeira conta ----

// 2. "frango / peru / coelho" só sugere o primeiro (Frango), não os três
(function(){
  var draft = draftPlanFromDailyText("Ao almoço como 150 g frango / peru / coelho.");
  var almoco = draft.find(function(d){ return d.mealName === "Almoço"; });
  var names = almoco.foods.map(function(f){ return f.name; });
  check.check("2. Só sugere Frango (a primeira alternativa)", names.indexOf("Frango (peito)") >= 0);
  check.check("2. NÃO soma Peru nem Coelho (eram alternativas, não itens extra)", names.indexOf("Peru (fatiado)") === -1 && names.indexOf("Coelho cru") === -1);
})();

// 3. "arroz / massa / quinoa / batata-doce" só sugere o primeiro
(function(){
  var draft = draftPlanFromDailyText("Ao jantar como 150 g arroz / massa / quinoa / batata-doce.");
  var jantar = draft.find(function(d){ return d.mealName === "Jantar"; });
  var names = jantar.foods.map(function(f){ return f.name; });
  check.check("3. Só sugere Arroz (a primeira alternativa)", names.indexOf("Arroz (cozido)") >= 0);
  check.check("3. NÃO soma Massa, Quinoa nem Batata-doce", names.indexOf("Massa (cozida)") === -1 && names.indexOf("Quinoa (cozida)") === -1 && names.indexOf("Batata-doce") === -1);
})();

// 4. Uma linha seguinte a começar por "ou" junta-se ao grupo de alternativas da linha anterior
(function(){
  var texto = "Almoço\n150 g frango\nou 150 g peixe";
  var draft = draftPlanFromDailyText(texto);
  var almoco = draft.find(function(d){ return d.mealName === "Almoço"; });
  var names = almoco.foods.map(function(f){ return f.name; });
  check.check("4. Só sugere Frango (a primeira alternativa entre linhas)", names.indexOf("Frango (peito)") >= 0);
  check.check("4. Não soma Pescada (a alternativa 'ou peixe' da linha seguinte)", names.indexOf("Pescada") === -1);
})();

// 5. Uma linha SEM "/" continua a poder ter vários alimentos genuínos (comportamento antigo preservado)
(function(){
  var draft = draftPlanFromDailyText("Ao pequeno-almoço como ovos com pão integral e um café.");
  var peq = draft.find(function(d){ return d.mealName === "Pequeno-almoço"; });
  var names = peq.foods.map(function(f){ return f.name; });
  check.check("5. Continua a somar vários alimentos genuínos numa linha sem '/'", names.indexOf("Ovos") >= 0 && names.indexOf("Pão integral") >= 0);
})();

// 6. Uma linha com "/" que só tem UMA correspondência reconhecida continua a sugeri-la normalmente
(function(){
  var draft = draftPlanFromDailyText("Ao jantar como 150 g frango / com molho especial da casa.");
  var jantar = draft.find(function(d){ return d.mealName === "Jantar"; });
  check.check("6. Continua a reconhecer Frango mesmo havendo um '/' na linha", jantar.foods.some(function(f){ return f.name === "Frango (peito)"; }));
})();

// ---- 3. Cenário real reportado: reproduz o texto do questionário e confirma que agora bate certo ----

// 7. Com alternativas "/" e "ou" corretamente tratadas como escolha única, o plano gerado já
// não fica inflacionado — e o "Ajustar quantidades aos alvos" (Fase 22) consegue bater perto do alvo.
(function(){
  // Texto completo (com fontes de gordura no pequeno-almoço) — a versão só
  // com Almoço/Jantar não tem nenhum alimento de gordura mencionado, o que
  // dispara skippedMacros("fat") e portanto um défice real de calorias por
  // falta de alimentos desse grupo, não por causa deste bug.
  var texto = [
    "Pequeno-almoço",
    "* 200 ml leite meio-gordo",
    "* 60 g queijo fresco magro",
    "* 100g mirtilos",
    "",
    "Almoço",
    "* 159 g arroz basmati / massa integral / quinoa / batata-doce",
    "* 150 g frango / peru / coelho",
    "* ou 150 g peixe branco",
    "* 100 g legumes verdes",
    "",
    "Jantar",
    "* 150 g arroz basmati / massa integral / quinoa / batata-doce",
    "* 150 g carne branca",
    "* ou 150 g peixe branco",
    "* 1 Prato Sopa"
  ].join("\n");

  var s = {targets:{kcal:3090, protein:143, carbs:420, fat:93}, meals:[]};
  var draft = draftPlanFromDailyText(texto);
  draft.forEach(function(d){
    if (!d.foods.length) return;
    var m = meal(d.mealName, d.mealTime, []);
    d.foods.forEach(function(f){ m.foods.push(food(f.name, f.qty, f.group)); });
    s.meals.push(m);
  });

  // Confirma que o Almoço/Jantar não têm as 4 alternativas de hidrato nem as 3 de proteína somadas
  var almoco = s.meals.find(function(m){ return m.name === "Almoço"; });
  var hidratosAlmoco = almoco.foods.filter(function(f){ return ["Arroz (cozido)","Massa (cozida)","Quinoa (cozida)","Batata-doce"].indexOf(f.name) >= 0; });
  check.check("7. O Almoço gerado só tem UM hidrato das 4 alternativas, não os 4", hidratosAlmoco.length === 1);

  autoAdjustPlanQuantities(s);
  var allFoods = s.meals.reduce(function(a,m){ return a.concat(m.foods); }, []);
  var totals = foodsTotals(allFoods);
  var diffPct = Math.abs(totals.kcal - s.targets.kcal) / s.targets.kcal;
  check.check("7. Depois de ajustar, as calorias ficam perto do alvo (<5%, não os ~11-16% reportados)", diffPct < 0.05);
})();

check.summarize();
