// Fase 28 — pedidos de melhoria ao questionário inicial depois de testar num
// iPhone real: (1) data de nascimento com aspeto estranho quando vazia;
// (2) idade calculada automaticamente a partir da data + trocar a ordem dos
// dois campos; (3) altura como lista de escolha; (4) só 3 objetivos;
// (5) treinos por semana como lista; (6) horários como <input type="time">;
// (7) refeições exageradas como lista; (8) descrições nos níveis de
// atividade física.
const fs = require("fs");
const path = require("path");
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

// ---- 1. CSS: input type="date"/"time" sem -webkit-appearance:none ----

(function(){
  var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  check.check("1. Tem uma regra CSS própria para input[type=date]/[type=time]", html.indexOf('.onb-field input[type="date"], .onb-field input[type="time"]') >= 0);
  var rule = html.slice(html.indexOf('.onb-field input[type="date"]'), html.indexOf('.onb-field input[type="date"]') + 200);
  check.check("1. Usa appearance:auto (aspeto nativo do picker)", rule.indexOf("appearance:auto") >= 0);
})();

// ---- 2. ageFromBirthDate: calcula a idade certa, considerando se já fez anos este ano ----

(function(){
  var tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
  var isoTenYearsAgo = tenYearsAgo.toISOString().slice(0,10);
  check.check("2. Data de há exatamente 10 anos -> idade 10", ageFromBirthDate(isoTenYearsAgo) === 10);
  check.check("2. Sem data, devolve null", ageFromBirthDate("") === null && ageFromBirthDate(null) === null);
  check.check("2. Nunca devolve idade negativa (data no futuro)", (function(){
    var future = new Date(); future.setFullYear(future.getFullYear() + 1);
    return ageFromBirthDate(future.toISOString().slice(0,10)) === null;
  })());
})();

// 3. Ordem trocada: "Data de nascimento" aparece antes de "Idade" no formulário
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function openOnboardingForm"), appSource.indexOf("function openOnboardingForm") + 3000);
  check.check("3. 'Data de nascimento' vem antes de 'Idade'", fnSrc.indexOf("Data de nascimento") < fnSrc.indexOf(">Idade<"));
})();

// 4. Ao mudar a data de nascimento, a idade é preenchida automaticamente
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function openOnboardingForm"), appSource.indexOf("function openOnboardingForm") + 8000);
  check.check("4. Liga um evento 'change' a #obBirthDate", fnSrc.indexOf('querySelector("#obBirthDate")') >= 0 && fnSrc.indexOf('addEventListener("change"') >= 0);
  check.check("4. Usa ageFromBirthDate para calcular a idade", fnSrc.indexOf("ageFromBirthDate(birthDateInput.value)") >= 0);
  check.check("4. Escreve o resultado no campo #obAge", fnSrc.indexOf('querySelector("#obAge").value = age') >= 0);
})();

// ---- 3. Altura como lista de escolha ----

(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function openOnboardingForm"), appSource.indexOf("function openOnboardingForm") + 3000);
  check.check("5. Altura é um <select>, não <input>", /<select id=\\"obHeight\\">/.test(fnSrc));
  check.check("5. HEIGHT_OPTIONS cobre um intervalo generoso (120-220)", HEIGHT_OPTIONS[0] === 120 && HEIGHT_OPTIONS[HEIGHT_OPTIONS.length-1] === 220);
})();

// ---- 4. Só 3 objetivos no questionário, mas os antigos continuam a funcionar ----

(function(){
  check.check("6. ONBOARDING_GOAL_OPTIONS tem só 3 opções", ONBOARDING_GOAL_OPTIONS.length === 3);
  check.check("6. 'Perda de peso' está nas novas opções", ONBOARDING_GOAL_OPTIONS.indexOf("Perda de peso") >= 0);
  check.check("6. 'Aumento de massa muscular' está nas novas opções", ONBOARDING_GOAL_OPTIONS.indexOf("Aumento de massa muscular") >= 0);
  check.check("6. 'Manutenção corporal' está nas novas opções", ONBOARDING_GOAL_OPTIONS.indexOf("Manutenção corporal") >= 0);
  // Retrocompatibilidade: um aluno antigo com "Ganho de massa muscular" continua a funcionar
  check.check("6. GOAL_ADJUST mantém as chaves antigas (retrocompatibilidade)", GOAL_ADJUST["Ganho de massa muscular"] === 15 && GOAL_ADJUST["Perda de gordura"] === -20);
  check.check("6. As novas chaves têm os mesmos valores das equivalentes antigas", GOAL_ADJUST["Aumento de massa muscular"] === GOAL_ADJUST["Ganho de massa muscular"] && GOAL_ADJUST["Perda de peso"] === GOAL_ADJUST["Perda de gordura"] && GOAL_ADJUST["Manutenção corporal"] === GOAL_ADJUST["Manutenção / recomposição"]);
})();

// 7. O <select id="obGoal"> usa ONBOARDING_GOAL_OPTIONS, não todas as chaves de GOAL_ADJUST
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function openOnboardingForm"), appSource.indexOf("function openOnboardingForm") + 3000);
  check.check("7. Gera as opções a partir de ONBOARDING_GOAL_OPTIONS", fnSrc.indexOf("ONBOARDING_GOAL_OPTIONS.map(") >= 0);
})();

// ---- 5. Treinos por semana e refeições exageradas como listas ----

(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function openOnboardingForm"), appSource.indexOf("function openOnboardingForm") + 3000);
  check.check("8. 'Treinos por semana' é um <select>", /<select id=\\"obTrainings\\">/.test(fnSrc));
})();

(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function openOnboardingForm"), appSource.indexOf("function openOnboardingForm") + 6000);
  check.check("9. 'Nº de refeições exageradas' é um <select>", /<select id=\\"obOvereating\\">/.test(fnSrc));
})();

// ---- 6. Horários como <input type="time"> (não texto livre) ----

(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function openOnboardingForm"), appSource.indexOf("function openOnboardingForm") + 4000);
  check.check("10. 'Horário habitual de treino' é type=\"time\"", /id=\\"obTrainTime\\"/.test(fnSrc) && /type=\\"time\\"[^>]*id=\\"obTrainTime\\"/.test(fnSrc));
  check.check("10. 'Acorda' é type=\"time\"", /type=\\"time\\"[^>]*id=\\"obWake\\"/.test(fnSrc));
  check.check("10. 'Dorme' é type=\"time\"", /type=\\"time\\"[^>]*id=\\"obSleep\\"/.test(fnSrc));
})();

// ---- 7. Descrições breves nos níveis de atividade física ----

(function(){
  check.check("11. ACTIVITY_LEVEL_DESCRIPTIONS tem uma descrição para cada nível", ACTIVITY_LEVEL_OPTIONS.every(function(o){ return !!ACTIVITY_LEVEL_DESCRIPTIONS[o]; }));
  check.check("11. Descrição de 'Sedentário' é a esperada", ACTIVITY_LEVEL_DESCRIPTIONS["Sedentário"] === "pouco ou nenhum exercício");
})();

// 12. As opções do <select> mostram a descrição no texto, mas o value continua a ser só o nome
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function openOnboardingForm"), appSource.indexOf("function openOnboardingForm") + 4000);
  check.check("12. option value continua a ser só o nome do nível (não o texto com descrição)", fnSrc.indexOf('"<option value=\\"" + o + "\\">" + o + " — " + ACTIVITY_LEVEL_DESCRIPTIONS[o]') >= 0);
})();

// 13. Simulação direta: as opções geradas têm value correto e texto com descrição
(function(){
  ACTIVITY_LEVEL_OPTIONS.forEach(function(o){
    var optionHtml = "<option value=\"" + o + "\">" + o + " — " + ACTIVITY_LEVEL_DESCRIPTIONS[o] + "</option>";
    check.check("13. Opção de '" + o + "' tem value correto", optionHtml.indexOf('value="' + o + '"') >= 0);
    check.check("13. Opção de '" + o + "' mostra a descrição no texto", optionHtml.indexOf(ACTIVITY_LEVEL_DESCRIPTIONS[o]) >= 0);
  });
})();

check.summarize();
