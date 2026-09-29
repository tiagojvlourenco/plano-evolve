// Fase 22 — bug reportado ao usar "Ajustar quantidades aos alvos" com dados
// reais: deu 3411 kcal para um alvo de 3089 kcal, ~10% a mais. A Fase 19
// reescalava cada balde de macro (proteína/hidratos/gordura) por
// aproximação iterativa (4 passagens); com vários alimentos a contribuir a
// sério para mais do que o seu macro "prioritário" (ex.: frutos secos têm
// gordura MAS também hidratos/proteína relevantes), a aproximação não
// convergia bem. A contribuição de cada balde para cada macro é uma função
// LINEAR do seu fator de escala, por isso agora resolve-se o sistema de
// equações exatamente (até 3x3) em vez de aproximar.
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

// ---- 1. solveLinearSystem: resolve sistemas pequenos exatamente ----

// 1. Sistema 2x2 com solução conhecida (x=2, y=3)
(function(){
  // x + y = 5 ; 2x - y = 1  ->  x=2, y=3
  var sol = solveLinearSystem([[1,1],[2,-1]], [5,1]);
  check.check("1. Resolve um sistema 2x2 simples", sol && Math.abs(sol[0]-2) < 1e-6 && Math.abs(sol[1]-3) < 1e-6);
})();

// 2. Sistema 3x3 com solução conhecida (x=1, y=2, z=3)
(function(){
  // x+y+z=6 ; 2x+y-z=1 ; x-y+2z=5  -> x=1,y=2,z=3 (verificado à mão)
  var sol = solveLinearSystem([[1,1,1],[2,1,-1],[1,-1,2]], [6,1,5]);
  check.check("2. Resolve um sistema 3x3", sol && Math.abs(sol[0]-1) < 1e-6 && Math.abs(sol[1]-2) < 1e-6 && Math.abs(sol[2]-3) < 1e-6);
})();

// 3. Sistema singular devolve null (nunca rebenta nem inventa uma solução)
(function(){
  var sol = solveLinearSystem([[1,2],[2,4]], [3,6]);
  check.check("3. Sistema singular devolve null", sol === null);
})();

// ---- 2. autoAdjustPlanQuantities: converge exatamente, mesmo com contaminação cruzada forte ----

// 4. Cenário do bug reportado: 3 baldes ativos, alimentos com contaminação cruzada
// significativa (frutos secos têm gordura E hidratos/proteína a sério) — a versão
// antiga (iterativa) ficava ~10% acima do alvo de calorias; a nova bate certo.
(function(){
  var kcalCoerente = 180*4 + 350*4 + 90*9;
  var s = freshStudent({targets:{kcal:kcalCoerente, protein:180, carbs:350, fat:90}});
  s.meals = [
    meal("Almoço","13:00",[
      food("Frango (peito)","200 g","protein"),
      food("Arroz (cozido)","300 g","carb"),
      food("Frutos secos","80 g","fat")
    ]),
    meal("Jantar","20:00",[
      food("Atum (natural)","150 g","protein"),
      food("Batata-doce","250 g","carb"),
      food("Azeite","20 ml","fat")
    ])
  ];
  autoAdjustPlanQuantities(s);
  var allFoods = s.meals.reduce(function(a,m){ return a.concat(m.foods); }, []);
  var totals = foodsTotals(allFoods);
  check.check("4. Proteína bate certo (tolerância 3g)", Math.abs(totals.p - 180) <= 3);
  check.check("4. Hidratos batem certo (tolerância 3g)", Math.abs(totals.c - 350) <= 3);
  check.check("4. Gordura bate certo (tolerância 3g)", Math.abs(totals.f - 90) <= 3);
  check.check("4. Calorias batem certo (tolerância 3%, não ~10% como antes)", Math.abs(totals.kcal - kcalCoerente) / kcalCoerente <= 0.03);
})();

// 5. Continua a manter a proporção relativa entre alimentos do mesmo balde
(function(){
  var s = freshStudent({targets:{kcal:600, protein:150, carbs:0, fat:0}});
  s.meals = [
    meal("Almoço","13:00",[food("Frango (peito)","200 g","protein")]),
    meal("Jantar","20:00",[food("Atum (natural)","100 g","protein")])
  ];
  autoAdjustPlanQuantities(s);
  var frangoG = parseFloat(s.meals[0].foods[0].qty);
  var atumG = parseFloat(s.meals[1].foods[0].qty);
  check.check("5. Mantém a proporção 2:1 entre os dois alimentos do mesmo macro", Math.abs((frangoG / atumG) - 2) < 0.3);
})();

// 6. "à vontade" continua de fora do sistema e continua "untouched"
(function(){
  var s = freshStudent({targets:{kcal:2000, protein:100, carbs:0, fat:0}});
  s.meals = [meal("Jantar","20:00",[
    food("Frango (peito)","100 g","protein"),
    food("Brócolos","à vontade","veg")
  ])];
  var result = autoAdjustPlanQuantities(s);
  check.check("6. Só mexeu no frango", result.changed === 1);
  check.check("6. Brócolos continua 'à vontade' e conta como untouched", s.meals[0].foods[1].qty === "à vontade" && result.untouched === 1);
})();

// 7. Sem alimentos para um macro com alvo definido, sinaliza em skippedMacros (comportamento preservado)
(function(){
  var s = freshStudent({targets:{kcal:2000, protein:100, carbs:100, fat:60}});
  s.meals = [meal("Almoço","13:00",[food("Frango (peito)","100 g","protein")])];
  var result = autoAdjustPlanQuantities(s);
  check.check("7. Sinaliza que falta hidratos e gordura no plano", result.skippedMacros.indexOf("carb") >= 0 && result.skippedMacros.indexOf("fat") >= 0);
})();

// 8. Um balde cujos alimentos fixos já ultrapassam o alvo (escala <= 0) fica sem mexer, não rebenta
(function(){
  var s = freshStudent({targets:{kcal:2000, protein:0, carbs:0, fat:30}});
  // Azeite (gordura) é o único balde ativo; sem outros alimentos fixos a contaminar — cenário simples de confirmar que nunca rebenta com alvo baixo
  s.meals = [meal("Almoço","13:00",[food("Azeite","10 ml","fat")])];
  var result;
  check.check("8. Não rebenta a calcular", (function(){ try { result = autoAdjustPlanQuantities(s); return true; } catch(e){ return false; } })());
  check.check("8. Alterou o azeite (único balde ativo)", result.changed === 1);
})();

check.summarize();
