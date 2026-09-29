// Fase 15 — bloco de respostas do questionário (Plano) era fácil de não
// reparar que existia, por estar fechado por omissão como as secções do
// Perfil. Ao contrário dessas (informação passiva), este é diretamente
// acionável ao montar o plano — passa a começar aberto.
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

// 1. tplQuestionnaireCopy começa aberto (open) quando há respostas
(function(){
  var s = freshStudent({dailyEatingDescription:"Como fora ao almoço quase sempre."});
  var html = tplQuestionnaireCopy(s);
  check.check("1. O <details> tem o atributo open", /^<details class="perfil-section" open/.test(html));
})();

// 2. Continua ausente quando não há respostas (nada a mostrar nem a abrir)
(function(){
  var vazio = freshStudent();
  check.check("2. Sem respostas, continua a não renderizar nada", tplQuestionnaireCopy(vazio) === "");
})();

// 3. tplProPlano reflete o mesmo: o bloco vem aberto quando embutido no separador Plano
(function(){
  var s = freshStudent({targets:{kcal:2000,protein:150,carbs:200,fat:60}, meals:[], hardestFoodToResist:"Chocolate"});
  var html = tplProPlano(s);
  var idx = html.indexOf("Respostas do questionário");
  var detailsStart = html.lastIndexOf("<details", idx);
  check.check("3. O <details> que envolve o bloco no Plano tem open", html.slice(detailsStart, idx).indexOf(" open") >= 0);
})();

check.summarize();
