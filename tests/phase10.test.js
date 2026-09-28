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
    likes:[], dislikes:[], avoid:[], allergies:[]
  });
  var html = tplProPerfil(s);
  check.check("13. Usa <details> para as secções", (html.match(/<details/g) || []).length === 3);
  check.check("13. Só a primeira secção (Dados pessoais) começa aberta", (html.match(/<details class="perfil-section" open>/g) || []).length === 1);
  check.check("13. Mostra a data de nascimento formatada", html.indexOf(fmtDatePt("1994-03-10")) >= 0);
})();

check.summarize();
