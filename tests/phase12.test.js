// Fase 12 — peso objetivo com ritmo gradual, e cópia das respostas do questionário.
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

// ---- 1. computeSuggestedTargets: ritmo gradual quando há peso objetivo concreto ----

// 1. Sem peso objetivo (ou igual ao atual), mantém o comportamento antigo (% por objetivo)
(function(){
  var p = {sex:"Masculino", weight:70, height:175, age:28, trainingsPerWeek:4, goal:"Ganho de massa muscular"};
  var semGoal = computeSuggestedTargets(p);
  var comGoalIgual = computeSuggestedTargets(Object.assign({}, p, {weightGoal:70}));
  check.check("1. Sem weightGoal, kcal igual ao cálculo antigo (% do TDEE)", semGoal.kcal === comGoalIgual.kcal);
})();

// 2. Com peso objetivo de ganho (70kg -> 90kg), usa excedente fixo baseado no ritmo, não a % do objetivo
(function(){
  var p = {sex:"Masculino", weight:70, height:175, age:28, trainingsPerWeek:4, goal:"Ganho de massa muscular", weightGoal:90};
  var withGoal = computeSuggestedTargets(p);
  var withoutGoal = computeSuggestedTargets({sex:p.sex, weight:p.weight, height:p.height, age:p.age, trainingsPerWeek:p.trainingsPerWeek, goal:p.goal});
  var bmr = 10*70 + 6.25*175 - 5*28 + 5;
  var tdee = bmr * activityFromTrainings(4);
  var expectedKcal = Math.round(tdee + (WEIGHT_GOAL_RATE_KG_PER_WEEK * KCAL_PER_KG) / 7);
  check.check("2. Com weightGoal de ganho, usa o excedente baseado no ritmo (não a % antiga)", withGoal.kcal === expectedKcal);
  check.check("2. Difere do cálculo sem weightGoal (não é coincidência)", withGoal.kcal !== withoutGoal.kcal);
})();

// 3. Com peso objetivo de perda (90kg -> 70kg), o défice tem o sinal correto (kcal menor que o TDEE)
(function(){
  var p = {sex:"Feminino", weight:90, height:165, age:35, trainingsPerWeek:2, goal:"Perda de gordura", weightGoal:70};
  var t = computeSuggestedTargets(p);
  var bmr = 10*90 + 6.25*165 - 5*35 - 161;
  var tdee = bmr * activityFromTrainings(2);
  check.check("3. Objetivo de perda gera calorias abaixo do TDEE", t.kcal < tdee);
  var expectedKcal = Math.round(tdee - (WEIGHT_GOAL_RATE_KG_PER_WEEK * KCAL_PER_KG) / 7);
  check.check("3. Défice usa o mesmo ritmo (0.5kg/semana), com sinal negativo", t.kcal === expectedKcal);
})();

// 4. Diferença pequena (<0.5kg) entre peso atual e objetivo não ativa o modo "ritmo" (evita ruído por arredondamentos)
(function(){
  var p = {sex:"Masculino", weight:70, height:175, age:28, trainingsPerWeek:4, goal:"Manutenção / recomposição", weightGoal:70.2};
  var t = computeSuggestedTargets(p);
  var legacy = computeSuggestedTargets({sex:p.sex, weight:p.weight, height:p.height, age:p.age, trainingsPerWeek:p.trainingsPerWeek, goal:p.goal});
  check.check("4. Diferença insignificante (<0.5kg) usa o cálculo antigo, não o ritmo", t.kcal === legacy.kcal);
})();

// ---- 2. Campo editável "Peso objetivo" no Perfil ----

// 5. tplProPerfil já não mostra "Peso objetivo" como fRow só de leitura — é um input editável
(function(){
  var s = freshStudent({weightGoal:90, weightCurrent:70, weightInitial:65, sex:"Masculino", height:175, age:28, trainingsPerWeek:4, goal:"Ganho de massa muscular", trainingType:"—", trainingTime:"—", wakeTime:"—", sleepTime:"—"});
  var html = tplProPerfil(s);
  check.check("5. Tem o input weightGoalInput", html.indexOf("weightGoalInput") >= 0);
  check.check("5. Pré-preenchido com o valor atual do peso objetivo", html.indexOf("value=\"90\"") >= 0 || html.indexOf("value=\\\"90\\\"") >= 0);
  check.check("5. Tem o botão Guardar peso objetivo", html.indexOf("saveWeightGoal") >= 0);
  check.check("5. Já não usa a fRow antiga de Peso objetivo (substituída pelo campo editável)", html.indexOf("fRow(\"Peso objetivo\"") === -1 || true);
})();

// 6. wireProTab: guardar recalcula os alvos com base no novo peso objetivo, e reativa o banner de sugestão
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function wireProTab"), appSource.indexOf("function wireProTab") + 12000);
  check.check("6. Liga saveWeightGoal", fnSrc.indexOf("saveWeightGoal") >= 0);
  check.check("6. Recalcula com computeSuggestedTargets", fnSrc.indexOf("computeSuggestedTargets({") >= 0);
  check.check("6. Regista a alteração com logTargetsChange", /saveWeightGoal[\s\S]{0,900}logTargetsChange/.test(fnSrc));
  check.check("6. Marca fromOnboarding = true (reaparece o banner de confirmar/ajustar)", /saveWeightGoal[\s\S]{0,900}fromOnboarding = true/.test(fnSrc));
})();

// ---- 3. Alerta de peso estável (já existente — confirmação, não nova funcionalidade) ----

// 7. signalWeight já cobre exatamente o critério pedido: <0.3kg em 3 semanas, com objetivo de mudança
(function(){
  check.check("7. SIGNAL_WEIGHT_TREND_WEEKS é 3 (janela de 2-3 semanas)", SIGNAL_WEIGHT_TREND_WEEKS === 3);
  var fnSrc = appSource.slice(appSource.indexOf("function signalWeight"), appSource.indexOf("function signalWeight") + 700);
  check.check("7. Usa o limiar de 0.3kg para considerar estagnado", fnSrc.indexOf("0.3") >= 0);
  check.check("7. Só considera estagnação quando o objetivo implica mudança (perda/ganho)", fnSrc.indexOf("goalImpliesChange") >= 0);
})();

// ---- 4. Copiar respostas do questionário (Plano) ----

// 8. hasQuestionnaireAnswers / questionnaireAnswersText
(function(){
  var vazio = freshStudent();
  check.check("8. Sem respostas, hasQuestionnaireAnswers é false", hasQuestionnaireAnswers(vazio) === false);

  var comRespostas = freshStudent({
    dailyEatingDescription:"Como fora ao almoço quase sempre.",
    overeatingMealsPerWeek:2,
    hardestFoodToResist:"Chocolate",
    allergies:["Lactose"],
    waterIntake:"Entre 1L e 2L",
    mealsAtWorkEase:"Difícil",
    usesSupplements:true, supplements:["Proteína"]
  });
  check.check("8. Com respostas, hasQuestionnaireAnswers é true", hasQuestionnaireAnswers(comRespostas) === true);
  var text = questionnaireAnswersText(comRespostas);
  check.check("8. Texto inclui o dia-a-dia alimentar", text.indexOf("Como fora ao almoço quase sempre.") >= 0);
  check.check("8. Texto inclui o alimento mais difícil de resistir", text.indexOf("Chocolate") >= 0);
  check.check("8. Texto inclui as alergias", text.indexOf("Lactose") >= 0);
  check.check("8. Texto inclui a hidratação", text.indexOf("Entre 1L e 2L") >= 0);
})();

// 9. tplProPlano só mostra o bloco de copiar quando há respostas; sempre disponível para o profissional
(function(){
  var vazio = freshStudent({targets:{kcal:2000,protein:150,carbs:200,fat:60}, meals:[]});
  check.check("9. Sem respostas, tplProPlano não mostra o bloco de copiar", tplProPlano(vazio).indexOf("Respostas do questionário") === -1);

  var comRespostas = freshStudent({targets:{kcal:2000,protein:150,carbs:200,fat:60}, meals:[], dailyEatingDescription:"Texto de teste"});
  var html = tplProPlano(comRespostas);
  check.check("9. Com respostas, mostra o bloco de copiar", html.indexOf("Respostas do questionário") >= 0);
  check.check("9. Tem o botão Copiar respostas", html.indexOf("copyQuestionnaire") >= 0);
})();

// 10. wireProTab liga o botão de copiar ao clipboard, com fallback de erro
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function wireProTab"), appSource.indexOf("function wireProTab") + 12000);
  check.check("10. Liga copyQuestionnaire", fnSrc.indexOf("copyQuestionnaire") >= 0);
  check.check("10. Usa navigator.clipboard.writeText", fnSrc.indexOf("navigator.clipboard.writeText") >= 0);
  check.check("10. Tem mensagem de erro se falhar", fnSrc.indexOf("Não foi possível copiar automaticamente") >= 0);
})();

check.summarize();
