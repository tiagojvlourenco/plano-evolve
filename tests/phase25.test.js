// Fase 25 — três pedidos sobre a tab "Plano" do profissional:
// (1) renomear o separador para "Nutrição"; (2) mostrar a % de calorias
// que cada macro (proteína/hidratos/gordura) representa, ao lado do
// campo; (3) mostrar a diferença entre o alvo de calorias e o
// metabolismo basal do aluno ("+500 kcal" = fase de ganho, "-500 kcal" =
// fase de perda).
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

// ---- 1. Separador renomeado para "Nutrição" (key interna continua "plano") ----

(function(){
  var pair = PRO_TABS.find(function(p){ return p[0] === "plano"; });
  check.check("1. O separador com key 'plano' mostra o rótulo 'Nutrição'", pair && pair[1] === "Nutrição");
  check.check("1. A key interna continua 'plano' (routing/estado não muda)", pair && pair[0] === "plano");
})();

// ---- 2. computeBMR: fórmula de Mifflin-St Jeor, a mesma já usada no onboarding ----

// 2. Calcula corretamente para homem e mulher (valores de referência conhecidos)
(function(){
  // Homem, 80kg, 180cm, 30 anos: 10*80 + 6.25*180 - 5*30 + 5 = 800+1125-150+5 = 1780
  check.check("2. BMR homem (80kg/180cm/30a) = 1780", computeBMR("Masculino", 80, 180, 30) === 1780);
  // Mulher, 65kg, 165cm, 28 anos: 10*65 + 6.25*165 - 5*28 - 161 = 650+1031.25-140-161 = 1380.25 -> arredonda 1380
  check.check("2. BMR mulher (65kg/165cm/28a) = 1380", computeBMR("Feminino", 65, 165, 28) === 1380);
})();

// 3. Aceita um objeto aluno diretamente (usa weightCurrent, não weight)
(function(){
  var s = freshStudent({sex:"Masculino", weightCurrent:80, height:180, age:30});
  check.check("3. Aceita o objeto do aluno (s.weightCurrent/height/age/sex)", computeBMR(s) === 1780);
})();

// 4. Sem dados suficientes, devolve null (nunca inventa um valor)
(function(){
  check.check("4. Sem peso, devolve null", computeBMR("Masculino", null, 180, 30) === null);
  check.check("4. Sem altura, devolve null", computeBMR("Masculino", 80, null, 30) === null);
  check.check("4. Sem idade, devolve null", computeBMR("Masculino", 80, 180, null) === null);
  check.check("4. Objeto aluno sem altura, devolve null", computeBMR(freshStudent({sex:"Masculino", weightCurrent:80, age:30})) === null);
})();

// 5. computeSuggestedTargets continua a dar os mesmos resultados de sempre (usa computeBMR agora, por dentro)
(function(){
  var p = {sex:"Masculino", weight:80, height:180, age:30, trainingsPerWeek:3, goal:"Manutenção / recomposição"};
  var t = computeSuggestedTargets(p);
  check.check("5. computeSuggestedTargets continua a devolver kcal/protein/carbs/fat coerentes", t.kcal > 0 && t.protein > 0 && t.carbs >= 0 && t.fat > 0);
})();

// ---- 3. renderTargetWarning: percentagens de macros + diferença face à manutenção ----
// O stub de DOM partilhado (setup.js) não simula querySelector de verdade — para testar a
// LÓGICA de renderTargetWarning (não só a wiring), monta-se aqui um "el" mínimo próprio.
function mockTargetsEl(values){
  var els = {};
  ["targetWarning","tKcal","tProtein","tCarbs","tFat","tKcalDiff","tProteinPct","tCarbsPct","tFatPct"].forEach(function(id){
    els[id] = {value: values[id] !== undefined ? String(values[id]) : "", textContent: "", innerHTML: ""};
  });
  return { querySelector: function(sel){ return els[sel.replace("#","")] || null; }, els: els };
}

// 6. Calcula corretamente a % de calorias de cada macro
(function(){
  var el = mockTargetsEl({tKcal:2000, tProtein:150, tCarbs:200, tFat:60});
  renderTargetWarning(el, null);
  check.check("6. Proteína: 150g*4kcal/2000kcal = 30%", el.els.tProteinPct.textContent === "· 30%");
  check.check("6. Hidratos: 200g*4kcal/2000kcal = 40%", el.els.tCarbsPct.textContent === "· 40%");
  check.check("6. Gordura: 60g*9kcal/2000kcal = 27%", el.els.tFatPct.textContent === "· 27%");
})();

// 6b. computeMaintenanceKcal: BMR × nível de atividade (não o basal puro) —
// pedido de correção depois de ver "+1451 kcal" (o basal sozinho não conta
// o gasto do treino, por isso o "+" ficava sempre bem maior do que devia).
(function(){
  // BMR (80kg/180cm/30a, homem) = 1780; 3 treinos/semana -> activityFromTrainings = 1.375
  // 1780 * 1.375 = 2447.5 -> arredonda a 2448
  var s = freshStudent({sex:"Masculino", weightCurrent:80, height:180, age:30, trainingsPerWeek:3});
  check.check("6b. Manutenção = BMR × fator de atividade (não o BMR sozinho)", computeMaintenanceKcal(s) === 2448);
  check.check("6b. É sempre maior que o BMR puro (fator de atividade > 1)", computeMaintenanceKcal(s) > computeBMR(s));
})();

// 7. Diferença face à manutenção: "+" quando o alvo está acima (fase de ganho)
(function(){
  var el = mockTargetsEl({tKcal:3000, tProtein:150, tCarbs:200, tFat:60});
  var s = freshStudent({sex:"Masculino", weightCurrent:80, height:180, age:30, trainingsPerWeek:3}); // manutenção = 2448
  renderTargetWarning(el, s);
  check.check("7. 3000 kcal vs. manutenção 2448 -> '+552 kcal' (fase de ganho)", el.els.tKcalDiff.textContent === "· +552 kcal vs. manutenção");
})();

// 8. Diferença face à manutenção: "-" quando o alvo está abaixo (fase de perda)
(function(){
  var el = mockTargetsEl({tKcal:2000, tProtein:150, tCarbs:120, tFat:40});
  var s = freshStudent({sex:"Masculino", weightCurrent:80, height:180, age:30, trainingsPerWeek:3}); // manutenção = 2448
  renderTargetWarning(el, s);
  check.check("8. 2000 kcal vs. manutenção 2448 -> '−448 kcal' (fase de perda)", el.els.tKcalDiff.textContent === "· −448 kcal vs. manutenção");
})();

// 9. Sem dados suficientes no perfil para calcular, o campo fica vazio (nunca inventa)
(function(){
  var el = mockTargetsEl({tKcal:2000, tProtein:150, tCarbs:200, tFat:60});
  var s = freshStudent({sex:"Masculino"}); // sem altura/peso/idade
  renderTargetWarning(el, s);
  check.check("9. Sem perfil suficiente, fica em branco", el.els.tKcalDiff.textContent === "");
})();

// 10. wireProTab passa "s" a renderTargetWarning (para conseguir calcular o BMR do aluno certo)
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function wireProTab"), appSource.indexOf("function wireProTab") + 30000);
  check.check("10. Chama renderTargetWarning(el, s) ao carregar", fnSrc.indexOf("renderTargetWarning(el, s)") >= 0);
})();

check.summarize();
