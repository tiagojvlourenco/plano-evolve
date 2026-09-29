// Fase 13 — correções reportadas ao testar no telemóvel real: input de
// horário desenquadrado no iOS, cópia do questionário sem fallback robusto,
// e ordem das secções do Perfil.
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

// ---- 1. Input de horário (Plano) desenquadrado no iOS: falta -webkit-appearance:none ----

// 1. .onb-field input tem o reset de aparência nativa (mesmo padrão já usado em .checkin-field)
(function(){
  var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  var rule = html.slice(html.indexOf(".onb-field input"), html.indexOf(".onb-field input") + 400);
  check.check("1. .onb-field input reseta -webkit-appearance (corrige o input type=time no iOS)", /-webkit-appearance:\s*none/.test(rule));
  check.check("1. .onb-field input reseta appearance também (não só -webkit-)", /(?<!-webkit-)appearance:\s*none/.test(rule));
  check.check("1. .onb-field input define a cor do texto (color:var(--ink))", rule.indexOf("color:var(--ink)") >= 0);
})();

// ---- 2. Copiar respostas do questionário ----
// (Fase 13 tentava clipboard.writeText -> execCommand -> só mostrava o modal
// SE ambos falhassem; continuou a falhar num telemóvel real porque
// execCommand pode devolver sucesso sem copiar nada de verdade, no WKWebView
// standalone. Fase 14 muda a estratégia — ver phase14.test.js.)

// ---- 3. Ordem do Perfil: Dados médicos passa a ser a 2ª secção ----

// 6. tplProPerfil gera as secções na ordem: Dados pessoais, Dados médicos, Rotina, Alimentação, Hidratação, Personalizar
(function(){
  var s = freshStudent({
    age:30, sex:"Feminino", height:170, weightCurrent:65, weightInitial:70,
    goal:"Perda de gordura", trainingsPerWeek:3, trainingType:"—", trainingTime:"—", wakeTime:"—", sleepTime:"—",
    work:"—", weekendNote:"—", mealsAtWorkEase:null, usesSupplements:false, supplements:[],
    dailyEatingDescription:null, overeatingMealsPerWeek:null, hardestFoodToResist:null, waterIntake:null
  });
  var html = tplProPerfil(s);
  var order = ["Dados pessoais","Dados médicos","Rotina de trabalho","Alimentação","Hidratação","Personalizar comportamento do plano"];
  var positions = order.map(function(title){ return html.indexOf(title); });
  check.check("6. Todas as secções esperadas existem", positions.every(function(p){ return p >= 0; }));
  check.check("6. Dados médicos aparece logo a seguir a Dados pessoais (2ª posição)", positions[0] < positions[1] && positions[1] < positions[2]);
  check.check("6. Ordem geral respeitada (cada secção depois da anterior)", positions.every(function(p, i){ return i===0 || p > positions[i-1]; }));
})();

check.summarize();
