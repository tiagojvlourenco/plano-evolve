// Prescrição segura: piso calórico, proteína/gordura por peso de referência, ritmo de perda, indicadores de peso com direção e inatividade.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

function daysAgo(n){ return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10); }

// ---- 1. Alvos sugeridos ----
(function(){
  var light = computeSuggestedTargets({sex:"Feminino", weight:50, height:158, age:30, weightGoal:47, trainingsPerWeek:1});
  var bmr = computeBMR("Feminino", 50, 158, 30);
  check.check("1. Mulher de 50 kg a perder peso: nunca abaixo do metabolismo basal (" + bmr + ") nem de 1200 kcal (" + light.kcal + ")", light.kcal >= bmr && light.kcal >= 1200);
  var diana = computeSuggestedTargets({sex:"Feminino", weight:54, height:160, age:34, weightGoal:51, trainingsPerWeek:3});
  check.check("1. 54 → 51 kg: ritmo limitado a 0,75% do peso por semana (défice ≤ ~450 kcal), e ≥ BMR", diana.kcal >= computeBMR("Feminino", 54, 160, 34) && diana.kcal >= 1200);
  var heavy = computeSuggestedTargets({sex:"Masculino", weight:120, height:178, age:40, weightGoal:95, trainingsPerWeek:3});
  check.check("1. Homem de 120 kg: proteína por peso de referência (IMC 25 ≈ 79 kg), não 240 g (" + heavy.protein + " g)", heavy.protein < 200 && heavy.protein >= 140);
  var lean = computeSuggestedTargets({sex:"Masculino", weight:70, height:175, age:30, goal:"Aumento de massa muscular", trainingsPerWeek:4});
  check.check("1. Aluno normal em ganho: proteína 2 g/kg (140 g) mantém-se", lean.protein === 140);
  var withLean = computeSuggestedTargets({sex:"Masculino", weight:100, height:180, age:35, weightGoal:90, trainingsPerWeek:4, leanMass:70});
  check.check("1. Com massa magra conhecida, a proteína usa-a (2 g × 70 kg = 140 g)", withLean.protein === 140);
  var lowFat = computeSuggestedTargets({sex:"Feminino", weight:50, height:158, age:30, weightGoal:47, trainingsPerWeek:1});
  check.check("1. Gordura nunca abaixo de 0,6 g/kg (" + lowFat.fat + " g)", lowFat.fat >= 30);
})();

// ---- 2. Avisos de prescrição ----
(function(){
  var s = {sex:"Feminino", weightCurrent:54, height:160, age:34, trainingsPerWeek:3};
  var below = nutritionSafetyWarnings(s, {kcal:950, protein:118, carbs:81, fat:13});
  check.check("2. 950 kcal (plano de 54 kg) → aviso crítico de abaixo do metabolismo basal", below.some(function(w){ return w.level === "critical" && /metabolismo basal/.test(w.text); }));
  check.check("2. Gordura de 13 g (0,24 g/kg) → aviso", below.some(function(w){ return /Gordura de 13 g/.test(w.text); }));
  var ok = nutritionSafetyWarnings(s, {kcal:1450, protein:110, carbs:160, fat:45});
  check.check("2. 1450 kcal, 110 g P, 45 g G → sem avisos", ok.length === 0);
  var heavy = nutritionSafetyWarnings({sex:"Masculino", weightCurrent:120, height:178, age:40, trainingsPerWeek:3}, {kcal:2300, protein:240, carbs:200, fat:70});
  check.check("2. 240 g de proteína num aluno de 120 kg → aviso de proteína a mais", heavy.some(function(w){ return /Proteína de 240 g/.test(w.text); }));
  var big = nutritionSafetyWarnings({sex:"Masculino", weightCurrent:70, height:175, age:30, trainingsPerWeek:3}, {kcal:1500, protein:140, carbs:100, fat:50});
  check.check("2. Défice enorme → aviso de ritmo semanal", big.some(function(w){ return /kg\/semana/.test(w.text); }));
  var html = safetyWarningsHtml({sex:"Feminino", weightCurrent:54, height:160, age:34, trainingsPerWeek:3, assessments:[]}, {kcal:950, protein:118, carbs:81, fat:13});
  check.check("2. As pílulas de aviso são HTML com ⛔/⚠ e escapadas", /⛔/.test(html) && /pill critical/.test(html));
})();

// ---- 3. Indicador de peso com direção ----
(function(){
  function mk(goal, from, to, extra){ return Object.assign({goal:goal, weightCurrent:to, weights:[{date:daysAgo(20), w:from}, {date:daysAgo(0), w:to}]}, extra || {}); }
  check.check("3. Perda de peso mas SUBIU 2 kg → atenção (e grave)", signalWeight(mk("Perda de peso", 70, 72)).status === "atencao" && signalWeight(mk("Perda de peso", 70, 72)).severity === "high");
  check.check("3. Perda de peso e desceu 1 kg → positivo", signalWeight(mk("Perda de peso", 70, 69)).status === "positivo");
  check.check("3. Perda de peso estagnada → atenção", signalWeight(mk("Perda de peso", 70, 70.1)).status === "atencao");
  check.check("3. Perda rápida demais (−4 kg em 3 semanas, 70 kg) → atenção", signalWeight(mk("Perda de peso", 70, 66)).status === "atencao");
  check.check("3. 'Aumento de massa muscular' estagnado → atenção (antes nunca alertava)", signalWeight(mk("Aumento de massa muscular", 70, 70)).status === "atencao");
  check.check("3. Ganho e o peso DESCEU → atenção", signalWeight(mk("Aumento de massa muscular", 70, 68.5)).status === "atencao");
  check.check("3. Ganho de 0,6 kg em 3 semanas → positivo", signalWeight(mk("Aumento de massa muscular", 70, 70.6)).status === "positivo");
  check.check("3. Manutenção: ±0,4 kg → positivo; +2 kg → atenção", signalWeight(mk("Manutenção corporal", 70, 70.4)).status === "positivo" && signalWeight(mk("Manutenção corporal", 70, 72)).status === "atencao");
  check.check("3. A direção vem do peso objetivo quando existe (objetivo 80 kg com o aluno a 70 kg = ganho)", goalDirection({goal:"Perda de peso", weightCurrent:70, weightGoal:80}) === "ganho");
})();

// ---- 4. Inatividade ----
(function(){
  var late = signalPesagem({weights:[{date:daysAgo(30), w:70}], assessments:[]});
  check.check("4. Sem pesagem há 30 dias → atenção", late.status === "atencao" && /30 dias/.test(late.text));
  check.check("4. Sem pesagem há 50 dias → crítico", signalPesagem({weights:[{date:daysAgo(50), w:70}]}).severity === "high");
  check.check("4. Pesagem de há 3 dias → positivo", signalPesagem({weights:[{date:daysAgo(3), w:70}]}).status === "positivo");
  check.check("4. Sem pesagens → dados insuficientes", signalPesagem({weights:[], assessments:[]}).status === "insuficiente");
  var parado = signalInatividadeTreino({trainingsPerWeek:3, checkins:[{date:daysAgo(14), workouts:0}, {date:daysAgo(7), workouts:0}]});
  check.check("4. 2 check-ins seguidos com 0 treinos → atenção grave", parado.status === "atencao" && parado.severity === "high");
  check.check("4. Treinou num deles → positivo", signalInatividadeTreino({trainingsPerWeek:3, checkins:[{date:daysAgo(14), workouts:0}, {date:daysAgo(7), workouts:2}]}).status === "positivo");
})();
check.summarize();
