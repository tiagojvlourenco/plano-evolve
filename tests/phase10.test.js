// Fase 10 — melhorias de uso reportadas pelo profissional.
const fs = require("fs");
const path = require("path");
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

function freshStudent(overrides){
  var base = {
    id:"x", flexibility:50, flexOverrides:{}, blockedFoods:[],
    substitutionHistory:[], adaptationHistory:[], photos:[],
    targets:{kcal:2000, protein:150, carbs:200, fat:60},
    meals:[]
  };
  Object.keys(overrides || {}).forEach(function(k){ base[k] = overrides[k]; });
  return base;
}

// ---- 1. Dashboard: reordenado, renomeado, "active" (ativo/inativo) ----

// 1. isStudentActive(): true por omissão, só false quando explicitamente marcado
(function(){
  check.check("1. Sem campo active definido, considera-se ativo", isStudentActive(freshStudent()) === true);
  check.check("1. active:true é ativo", isStudentActive(freshStudent({active:true})) === true);
  check.check("1. active:false é inativo", isStudentActive(freshStudent({active:false})) === false);
})();

// 2. studentToRow/rowToStudent fazem round-trip correto de active (default true) e birthDate
(function(){
  var rowDefault = studentToRow(freshStudent());
  check.check("2. Sem active definido, persiste como true (default)", rowDefault.active === true);
  var rowInactive = studentToRow(freshStudent({active:false}));
  check.check("2. active:false persiste como false", rowInactive.active === false);

  var rowWithBirth = studentToRow(freshStudent({birthDate:"1990-05-20"}));
  check.check("2. birthDate persiste em birth_date", rowWithBirth.birth_date === "1990-05-20");
  var rowNoBirth = studentToRow(freshStudent());
  check.check("2. Sem birthDate, birth_date fica null", rowNoBirth.birth_date === null);

  var back = rowToStudent({id:"x", active:false, birth_date:"1990-05-20", meals:[], photos:[], likes:[], dislikes:[], avoid:[], allergies:[]});
  check.check("2. rowToStudent traduz active:false", back.active === false);
  check.check("2. rowToStudent traduz birth_date", back.birthDate === "1990-05-20");
  var backDefault = rowToStudent({id:"x", meals:[], photos:[], likes:[], dislikes:[], avoid:[], allergies:[]});
  check.check("2. rowToStudent sem active assume true", backDefault.active === true);
})();

// 3. Ordem e nomes dos 4 blocos do dashboard: Alunos ativos, Check-ins, Alertas, Total de alunos
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function renderProDashboardMain"), appSource.indexOf("function renderProDashboardMain") + 1200);
  var order = ["Alunos ativos", "Check-ins", "Alertas", "Total de alunos"];
  var lastIdx = -1;
  var inOrder = true;
  order.forEach(function(label){
    var idx = fnSrc.indexOf('"' + label + '"');
    if (idx < 0 || idx < lastIdx) inOrder = false;
    lastIdx = idx;
  });
  check.check("3. Os 4 blocos aparecem pela ordem pedida: Alunos ativos, Check-ins, Alertas, Total de alunos", inOrder);
  check.check("3. Já não existe o nome antigo 'Check-ins pendentes' no dashboard", fnSrc.indexOf("Check-ins pendentes") === -1);
})();

// 4. A lista completa de alunos já não aparece por omissão — só dentro de state.dashboardListMode
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function renderProDashboardMain"), appSource.indexOf("function renderProDashboardMain") + 1600);
  check.check("4. A lista só é construída dentro de um if (state.dashboardListMode)", fnSrc.indexOf("if (state.dashboardListMode)") >= 0);
})();

// ---- 2. Comparação de fotografias por posição (frente/lado/costas) ----

// 5. distinctPhotoDates(): datas únicas, ordenadas, sem duplicados
(function(){
  var s = freshStudent({photos:[
    {date:"2026-09-01", position:"frente"}, {date:"2026-09-01", position:"lado"},
    {date:"2026-08-01", position:"frente"}
  ]});
  var dates = distinctPhotoDates(s);
  check.check("5. Devolve 2 datas distintas (não 3)", dates.length === 2);
  check.check("5. Ordenadas ascendentemente", dates[0] === "2026-08-01" && dates[1] === "2026-09-01");
})();

// 6. findPhotoByDateAndPosition(): encontra a foto certa, devolve null se não existir
(function(){
  var frente = {date:"2026-09-01", position:"frente", path:"a.jpg"};
  var lado = {date:"2026-09-01", position:"lado", path:"b.jpg"};
  var s = freshStudent({photos:[frente, lado]});
  check.check("6. Encontra a foto certa por data+posição", findPhotoByDateAndPosition(s, "2026-09-01", "frente") === frente);
  check.check("6. Devolve null quando não há foto dessa posição", findPhotoByDateAndPosition(s, "2026-09-01", "costas") === null);
  check.check("6. Devolve null para uma data sem fotos", findPhotoByDateAndPosition(s, "2026-01-01", "frente") === null);
})();

// 7. compareGridHtml(): mostra as 3 posições, com "Sem foto" quando falta alguma
(function(){
  var s = freshStudent({photos:[{date:"2026-09-01", position:"frente", path:"a.jpg"}]});
  var html = compareGridHtml(s, "2026-09-01", "2026-09-01");
  check.check("7. Mostra a etiqueta das 3 posições", ["Frente","Lado","Costas"].every(function(l){ return html.indexOf(l) >= 0; }));
  check.check("7. Mostra 'Sem foto' para posições em falta (lado/costas)", (html.match(/Sem foto/g) || []).length === 4); // lado e costas em falta, para as 2 colunas (mesma data)
  check.check("7. Mostra a imagem da posição que existe (frente)", html.indexOf("<img") >= 0);
})();

// 8. PHOTO_POSITIONS: exatamente as 3 posições pedidas, nesta ordem
(function(){
  check.check("8. 3 posições: frente, lado, costas, por esta ordem", PHOTO_POSITIONS.map(function(p){return p.key;}).join(",") === "frente,lado,costas");
})();

// 9. O upload passa a posição escolhida para o objeto da foto (não fica sempre "frente" fixo)
(function(){
  var fnSrc = appSource.slice(appSource.indexOf('el.querySelectorAll(".photo-upload-input")'), appSource.indexOf('el.querySelectorAll(".photo-upload-input")') + 1800);
  check.check("9. Lê a posição do atributo data-position do input clicado", fnSrc.indexOf('photoInput.getAttribute("data-position")') >= 0);
  check.check("9. Guarda a posição no objeto da foto (modo real)", /position: position/.test(fnSrc));
  check.check("9. Guarda a posição no objeto da foto (modo local/dataUrl)", /dataUrl: reader\.result, position: position/.test(fnSrc));
})();

// 10. downloadPhotoComparison(): usa fetch()+blob, nunca img.crossOrigin (mais fiável com URLs assinados)
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function loadImageAsElement"), appSource.indexOf("function loadImageAsElement") + 700);
  check.check("10. Carrega a foto via fetch() e blob", fnSrc.indexOf("fetch(url)") >= 0 && fnSrc.indexOf(".blob()") >= 0);
  // "crossOrigin" só pode aparecer em comentários (a explicar a decisão),
  // nunca como código real (img.crossOrigin = ...) — daí o filtro de linhas.
  var crossOriginCodeLines = appSource.split("\n").filter(function(line){
    return line.indexOf("crossOrigin") >= 0 && line.trim().indexOf("//") !== 0;
  });
  check.check("10. Não usa img.crossOrigin no código (só é mencionado em comentários)", crossOriginCodeLines.length === 0);
})();

// ---- 3. Auto-centrar separador ao clicar (menu do profissional em telemóvel) ----

// 11. O separador ativo é centrado depois de renderProShell() reconstruir o menu
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function renderProShell"), appSource.indexOf("function renderProShell") + 3000);
  check.check("11. Chama scrollIntoView no separador ativo", fnSrc.indexOf(".scrollIntoView(") >= 0);
  // Encontrado a validar ao vivo: sem behavior:"instant" explícito, herda
  // scroll-behavior:smooth do CSS e uma animação smooth nunca progride num
  // separador do browser em segundo plano — ficava sempre em scrollLeft:0.
  check.check("11. Força behavior:\"instant\" explicitamente (não confia no smooth por omissão)", /behavior:\s*"instant"/.test(fnSrc));
  check.check("11. Está adiado (setTimeout) para correr depois do layout do DOM recém-inserido", /setTimeout\(function\(\)\{[\s\S]*?scrollIntoView/.test(fnSrc));
})();

// ---- 4. Bug de layout no telemóvel: data sobreposta ao peso (Composição corporal) ----

// 12. .assess-form-grid tem proteção min-width:0 e força a data a ocupar a linha toda em ecrãs estreitos
(function(){
  var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  check.check("12. .assess-form-grid .f tem min-width:0 (impede overflow do date input)", /\.assess-form-grid \.f\{min-width:0;\}/.test(html));
  check.check("12. Media query força a data a ocupar a linha toda abaixo de 480px", /max-width:480px\)\{[\s\S]{0,400}assess-form-grid\{grid-template-columns:repeat\(2,1fr\)/.test(html));
})();

// ---- 5. Perfil reorganizado em secções recolhíveis ----

// 13. tplProPerfil usa <details> em vez de uma lista contínua, com "Dados pessoais" aberta por omissão
(function(){
  var s = freshStudent({
    age:30, birthDate:"1994-03-10", sex:"Feminino", height:170, weightCurrent:65, weightInitial:70, weightGoal:60,
    goal:"Perda de gordura", trainingsPerWeek:3, trainingType:"—", trainingTime:"—", wakeTime:"—", sleepTime:"—",
    mealsPreferred:5, budget:"Médio", cookTime:"—", work:"—", weekendNote:"—",
    likes:[], dislikes:[], avoid:[], allergies:[],
    mealsAtWorkEase:null, usesSupplements:false, supplements:[], dailyEatingDescription:null,
    overeatingMealsPerWeek:null, hardestFoodToResist:null, waterIntake:null
  });
  var html = tplProPerfil(s);
  // Dados pessoais, Rotina de trabalho, Alimentação, Hidratação — sem
  // "Contexto" (só aparece com weekendNote real, testado a seguir).
  check.check("13. Usa <details> para as 4 secções sem Contexto legacy", (html.match(/<details/g) || []).length === 4);
  check.check("13. Só a primeira secção (Dados pessoais) começa aberta", (html.match(/<details class="perfil-section" open>/g) || []).length === 1);
  check.check("13. Mostra a data de nascimento formatada", html.indexOf(fmtDatePt("1994-03-10")) >= 0);
})();

// 14. "Contexto" só aparece para dados antigos com weekendNote real preenchido
(function(){
  var semWeekend = freshStudent({likes:[], dislikes:[], avoid:[], allergies:[], weekendNote:"—"});
  check.check("14. Sem weekendNote real, não mostra a secção Contexto", tplProPerfil(semWeekend).indexOf("Contexto") === -1);

  var comWeekend = freshStudent({likes:[], dislikes:[], avoid:[], allergies:[], weekendNote:"Janta fora 1x/semana"});
  check.check("14. Com weekendNote real (dado legacy), mostra a secção Contexto", tplProPerfil(comWeekend).indexOf("Contexto") >= 0);
})();

// ---- 6. Questionário alinhado ao formulário real (Google Forms) ----

// 15. As perguntas novas existem no questionário, com as opções exatas do formulário real
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function openOnboardingForm"), appSource.indexOf("function openOnboardingForm") + 6000);
  check.check("15. Género com as 4 opções reais (Masculino/Feminino/Outro/Prefiro não dizer)", /<option>Masculino<\/option><option>Feminino<\/option><option>Outro<\/option><option>Prefiro não dizer<\/option>/.test(fnSrc));
  check.check("15. Facilidade de refeições no trabalho (4 níveis)", WORK_MEALS_EASE_OPTIONS.join(",") === "Muito fácil,Fácil,Difícil,Muito Difícil");
  check.check("15. Suplementos: Proteína e Creatina + Outra", SUPPLEMENT_OPTIONS.join(",") === "Proteína,Creatina" && fnSrc.indexOf("obSupplementOtherText") >= 0);
  check.check("15. Hidratação com as 4 faixas reais", WATER_INTAKE_OPTIONS.join(",") === "Menos de 1L,Entre 1L e 2L,Entre 2L e 3L,Mais de 3L");
  check.check("15. Pede a descrição do dia-a-dia alimentar (texto longo)", fnSrc.indexOf('id=\\"obDailyEating\\"') >= 0 || fnSrc.indexOf('id="obDailyEating"') >= 0);
  check.check("15. Pede o nº de refeições exageradas por semana", fnSrc.indexOf("obOvereating") >= 0);
  check.check("15. Pede o alimento mais difícil de resistir", fnSrc.indexOf("obHardestFood") >= 0);
})();

// 16. Os campos antigos (gosta de/não gosta/não quer consumir/fins de semana/tempo a cozinhar/orçamento)
// já não são pedidos no questionário — alinhado 100% ao formulário real, conforme pedido.
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function openOnboardingForm"), appSource.indexOf("function proStat"));
  ["obLikes","obDislikes","obAvoid","obMeals\"","obWeekend","obCookTime","obBudget"].forEach(function(id){
    check.check("16. Já não pede " + id, fnSrc.indexOf('id="' + id) === -1 && fnSrc.indexOf("id=\\\"" + id) === -1);
  });
})();

// 17. Objetivo/Treinos/Tipo de treino/Acorda/Dorme/Peso continuam no questionário — são
// preenchidos pelo profissional, não pelo aluno, e alimentam computeSuggestedTargets
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function openOnboardingForm"), appSource.indexOf("function proStat"));
  // extract-app.js preserva as aspas escapadas (\") tal como estão na fonte
  // — verifica só o id em si, sem depender do formato exato das aspas.
  ["obWeight","obGoal","obTrainings","obTrainType","obWake","obSleep"].forEach(function(id){
    check.check("17. Continua a pedir " + id, fnSrc.indexOf(id) >= 0);
  });
})();

// 18. "Que suplementos utiliza?" só aparece condicionalmente (JS troca o display, tal
// como no formulário real, onde a secção 4 só surge depois de responder Sim na secção 3)
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function openOnboardingForm"), appSource.indexOf("function proStat"));
  check.check("18. obSupplementsField começa escondido", fnSrc.indexOf("obSupplementsField") >= 0 && fnSrc.indexOf("display:none") >= 0);
  check.check("18. Alterna a visibilidade consoante a resposta a obUsesSupplements", fnSrc.indexOf("syncSupplementsVisibility") >= 0 && fnSrc.indexOf('suppSelect.value === "Sim"') >= 0);
})();

// 19. studentToRow/rowToStudent fazem round-trip correto dos campos novos
(function(){
  var s = freshStudent({
    mealsAtWorkEase:"Difícil", usesSupplements:true, supplements:["Proteína","Outra: Ómega 3"],
    dailyEatingDescription:"8h - ovos", overeatingMealsPerWeek:3, hardestFoodToResist:"Chocolate", waterIntake:"Entre 1L e 2L"
  });
  var row = studentToRow(s);
  check.check("19. meals_at_work_ease persiste", row.meals_at_work_ease === "Difícil");
  check.check("19. uses_supplements persiste", row.uses_supplements === true);
  check.check("19. supplements persiste o array completo", JSON.stringify(row.supplements) === JSON.stringify(["Proteína","Outra: Ómega 3"]));
  check.check("19. daily_eating_description persiste", row.daily_eating_description === "8h - ovos");
  check.check("19. overeating_meals_per_week persiste", row.overeating_meals_per_week === 3);
  check.check("19. hardest_food_to_resist persiste", row.hardest_food_to_resist === "Chocolate");
  check.check("19. water_intake persiste", row.water_intake === "Entre 1L e 2L");

  var back = rowToStudent({
    id:"x", meals:[], photos:[], likes:[], dislikes:[], avoid:[], allergies:["Marisco"],
    meals_at_work_ease:"Fácil", uses_supplements:false, supplements:[], daily_eating_description:null,
    overeating_meals_per_week:0, hardest_food_to_resist:null, water_intake:"Mais de 3L"
  });
  check.check("19. rowToStudent traduz meals_at_work_ease", back.mealsAtWorkEase === "Fácil");
  check.check("19. rowToStudent traduz uses_supplements", back.usesSupplements === false);
  check.check("19. rowToStudent traduz overeating_meals_per_week mesmo quando é 0 (não troca por null)", back.overeatingMealsPerWeek === 0);
  check.check("19. rowToStudent traduz water_intake", back.waterIntake === "Mais de 3L");

  var backSemCampos = rowToStudent({id:"x", meals:[], photos:[], likes:[], dislikes:[], avoid:[], allergies:[]});
  check.check("19. Sem os campos novos na BD, assume defaults seguros (não undefined)", backSemCampos.usesSupplements === false && Array.isArray(backSemCampos.supplements) && backSemCampos.overeatingMealsPerWeek === null);
})();

// 20. "Alimentos que nunca consome ou é alérgico/a" mapeia para allergies (aceita vírgula e quebra de linha)
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function openOnboardingForm"), appSource.indexOf("function proStat"));
  check.check("20. Lê #obAllergies e faz split por vírgula ou quebra de linha", /obAllergies"\)\.value\.split\(\/\[,\\n\]\//.test(fnSrc));
})();

check.summarize();
