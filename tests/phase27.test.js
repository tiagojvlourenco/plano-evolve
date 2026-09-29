// Fase 27 — pedido depois de analisar uma pesquisa sobre cálculo de TDEE: o
// nível de atividade física deveria ser uma pergunta direta ("Sedentário"/
// "Levemente ativo"/"Moderadamente ativo"/"Muito ativo"), não só uma
// aproximação pelo nº de treinos de musculação/semana — alguém pode treinar
// pouco mas ter um trabalho fisicamente exigente, ou o contrário.
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

// ---- 1. activityFactor: usa o nível de atividade quando existe, senão o nº de treinos ----

// 1. Com nível de atividade definido, usa o fator certo (ignora o nº de treinos)
(function(){
  check.check("1. 'Sedentário' -> 1.2, mesmo com muitos treinos", activityFactor({activityLevel:"Sedentário", trainingsPerWeek:6}) === 1.2);
  check.check("1. 'Muito ativo' -> 1.725, mesmo com poucos treinos", activityFactor({activityLevel:"Muito ativo", trainingsPerWeek:0}) === 1.725);
  check.check("1. 'Moderadamente ativo' -> 1.55", activityFactor({activityLevel:"Moderadamente ativo", trainingsPerWeek:0}) === 1.55);
  check.check("1. 'Levemente ativo' -> 1.375", activityFactor({activityLevel:"Levemente ativo", trainingsPerWeek:0}) === 1.375);
})();

// 2. Sem nível de atividade (aluno antigo ou por preencher), cai no nº de treinos — comportamento preservado
(function(){
  check.check("2. Sem activityLevel, usa activityFromTrainings", activityFactor({trainingsPerWeek:3}) === activityFromTrainings(3));
  check.check("2. activityLevel null explícito, também cai no fallback", activityFactor({activityLevel:null, trainingsPerWeek:6}) === activityFromTrainings(6));
})();

// ---- 2. computeSuggestedTargets / computeMaintenanceKcal usam o nível de atividade quando definido ----

// 3. computeSuggestedTargets dá alvos diferentes consoante o nível de atividade, com o mesmo nº de treinos
(function(){
  var base = {sex:"Masculino", weight:80, height:180, age:30, trainingsPerWeek:3, goal:"Manutenção / recomposição"};
  var sedentario = computeSuggestedTargets(Object.assign({}, base, {activityLevel:"Sedentário"}));
  var muitoAtivo = computeSuggestedTargets(Object.assign({}, base, {activityLevel:"Muito ativo"}));
  check.check("3. 'Muito ativo' sugere mais calorias do que 'Sedentário', com o mesmo nº de treinos", muitoAtivo.kcal > sedentario.kcal);
})();

// 4. computeMaintenanceKcal usa o nível de atividade do aluno
(function(){
  var s = freshStudent({sex:"Masculino", weightCurrent:80, height:180, age:30, trainingsPerWeek:3, activityLevel:"Muito ativo"});
  // BMR = 1780; "Muito ativo" = ×1.725 (ignora o fallback de 3 treinos, que seria ×1.375)
  check.check("4. Usa o fator de 'Muito ativo' (1.725), não o do nº de treinos", computeMaintenanceKcal(s) === Math.round(1780 * 1.725));
})();

// ---- 3. Formulário de onboarding: novo campo, opcional, com as 4 opções ----

// 5. openOnboardingForm tem o <select> gerado a partir de ACTIVITY_LEVEL_OPTIONS (fonte única de verdade,
// já testada nas secções 1/2) e uma opção vazia para usar o fallback do nº de treinos
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function openOnboardingForm"), appSource.indexOf("function openOnboardingForm") + 5000);
  check.check("5. Tem o campo obActivityLevel", fnSrc.indexOf('id=\\"obActivityLevel\\"') >= 0);
  check.check("5. Gera as opções a partir de ACTIVITY_LEVEL_OPTIONS (não texto fixo)", fnSrc.indexOf("ACTIVITY_LEVEL_OPTIONS.map(") >= 0);
  check.check("5. É opcional (tem uma opção vazia/fallback)", fnSrc.indexOf('value=\\"\\"') >= 0);
})();

// 6. Ao submeter, o valor escolhido fica no novo aluno (ou null se não escolhido)
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function openOnboardingForm"), appSource.indexOf("function openOnboardingForm") + 12000);
  check.check("6. Lê #obActivityLevel para o profile", fnSrc.indexOf('activityLevel: sheet.querySelector("#obActivityLevel").value || null') >= 0);
  check.check("6. Passa profile.activityLevel para o novo aluno", fnSrc.indexOf("activityLevel:profile.activityLevel") >= 0);
})();

// ---- 4. Persistência: round-trip completo studentToRow -> rowToStudent ----

// 7. studentToRow grava activity_level; rowToStudent lê-o de volta
(function(){
  var s = freshStudent({activityLevel:"Levemente ativo"});
  var row = studentToRow(s);
  check.check("7. studentToRow grava activity_level", row.activity_level === "Levemente ativo");
  var back = rowToStudent(row);
  check.check("7. rowToStudent lê activityLevel de volta", back.activityLevel === "Levemente ativo");
})();

// 8. Sem nível de atividade definido, grava/lê null (nunca inventa um valor)
(function(){
  var s = freshStudent({});
  var row = studentToRow(s);
  check.check("8. Sem activityLevel, grava null", row.activity_level === null);
  check.check("8. rowToStudent devolve null também", rowToStudent({activity_level:null}).activityLevel === null);
})();

// ---- 5. Perfil: mostra o valor atual e permite editá-lo ----

// 9. tplProPerfil mostra o nível de atividade atual (ou o aviso de que está a usar o fallback)
(function(){
  var comNivel = freshStudent({activityLevel:"Moderadamente ativo"});
  check.check("9. Mostra o nível de atividade definido", tplProPerfil(comNivel).indexOf("Moderadamente ativo") >= 0);
  var semNivel = freshStudent({activityLevel:null});
  check.check("9. Sem nível definido, avisa que usa o fallback", tplProPerfil(semNivel).indexOf("aproximação") >= 0);
})();

// 10. tplProPerfil tem o <select> editável com as 4 opções e o botão de guardar
(function(){
  var html = tplProPerfil(freshStudent({activityLevel:"Sedentário"}));
  check.check("10. Tem o select editável activityLevelInput", html.indexOf('id="activityLevelInput"') >= 0);
  check.check("10. A opção atual vem pré-selecionada", /<option selected>Sedentário<\/option>/.test(html));
  check.check("10. Tem o botão de guardar", html.indexOf('id="saveActivityLevel"') >= 0);
})();

// 11. wireProTab liga o botão de guardar, grava no aluno e persiste (sem recalcular alvos sozinho)
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function wireProTab"), appSource.indexOf("function wireProTab") + 30000);
  var block = fnSrc.slice(fnSrc.indexOf("saveActivityLevel"), fnSrc.indexOf("saveActivityLevel") + 700);
  check.check("11. Lê o valor de #activityLevelInput", block.indexOf('querySelector("#activityLevelInput")') >= 0);
  check.check("11. Grava em s.activityLevel", block.indexOf("s.activityLevel = raw || null") >= 0);
  check.check("11. Persiste depois de guardar", block.indexOf("persistStudent(s)") >= 0);
})();

// 12. "Guardar peso objetivo" também passa activityLevel ao recalcular os alvos (antes ignorava-o)
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function wireProTab"), appSource.indexOf("function wireProTab") + 30000);
  var block = fnSrc.slice(fnSrc.indexOf("saveWeightGoal"), fnSrc.indexOf("saveWeightGoal") + 900);
  check.check("12. computeSuggestedTargets recebe activityLevel do aluno", block.indexOf("activityLevel: s.activityLevel") >= 0);
})();

check.summarize();
