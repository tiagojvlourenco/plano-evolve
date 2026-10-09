// Acertos de UI com dados reais: dias de treino vazios, questionário com marcadores, sliders e CSS responsivo.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

// ---- 1. Dias de treino por definir (lista vazia) não são "descanso" todos os dias ----
(function(){
  check.check("1. trainingDays vazio devolve null (não inventa 'descanso')", isTrainingDayToday({trainingDays: []}) === null);
  check.check("1. trainingDays ausente continua a devolver null", isTrainingDayToday({}) === null);
  var all = isTrainingDayToday({trainingDays: [0,1,2,3,4,5,6]});
  check.check("1. Com dias definidos continua a devolver true/false", all === true);
  check.check("1. Com dias definidos que não incluem hoje devolve false", isTrainingDayToday({trainingDays: [(new Date().getDay() + 1) % 7]}) === false);
})();

(function(){
  var semDias = tplTrainingOverview({trainingDays: [], trainingType: "Musculação", trainingsPerWeek: 4, trainingTime: "19:00", checkins: []});
  check.check("2. Sem dias definidos, não desenha os 7 dias apagados", semDias.indexOf("week-chip") === -1);
  check.check("2. Sem dias definidos, diz que estão por definir", semDias.indexOf("Dias de treino por definir") >= 0);
  check.check("2. Sem dias definidos, mantém tipo e sessões por semana", semDias.indexOf("Musculação") >= 0 && semDias.indexOf("4× por semana") >= 0);
  var comDias = tplTrainingOverview({trainingDays: [1,3], trainingType: "Musculação", trainingsPerWeek: 2, checkins: []});
  check.check("2. Com dias definidos, desenha a semana", comDias.indexOf("week-chip") >= 0 && comDias.indexOf("por definir") === -1);
  check.check("2. Dias marcados aparecem como ativos", (comDias.match(/week-chip on/g) || []).length === 2);
})();

// ---- 3. Questionário: linhas com "*" viram lista, tudo escapado ----
(function(){
  var html = bulletedText("Pequeno-almoço\n\n* 200 ml leite\n* 2 fatias de pão\n\nMeio da manhã\n- iogurte");
  check.check("3. Linhas com '*' viram itens de lista", (html.match(/<li>/g) || []).length === 3);
  check.check("3. Não sobram asteriscos soltos", html.indexOf("* ") === -1);
  check.check("3. Linhas normais viram parágrafos", html.indexOf('<p class="qa-line">Pequeno-almoço</p>') >= 0);
  check.check("3. Linhas em branco viram espaço", html.indexOf("qa-gap") >= 0);
  check.check("3. As listas ficam fechadas", (html.match(/<ul/g) || []).length === (html.match(/<\/ul>/g) || []).length);
  var xss = bulletedText("* <img src=x onerror=alert(1)>\n<b>negrito</b>");
  check.check("3. O texto é escapado (nunca HTML cru)", xss.indexOf("<img") === -1 && xss.indexOf("<b>") === -1 && xss.indexOf("&lt;img") >= 0);
  check.check("3. Texto vazio/undefined não rebenta", bulletedText(undefined) === "" && bulletedText("") === "");
})();

// ---- 4. Sliders: preenchimento proporcional ao valor ----
(function(){
  check.check("4. rangeFill(1) = 0% e rangeFill(10) = 100%", rangeFill(1) === 0 && rangeFill(10) === 100);
  check.check("4. rangeFill(5) está entre 40% e 50%", rangeFill(5) > 40 && rangeFill(5) < 50);
  var html = rangeField("ciHunger", "Fome (1-10)", 5);
  check.check("4. O slider arranca com o preenchimento (--p) definido", /style="--p:\d+%"/.test(html));
  check.check("4. O handler de 'input' atualiza o preenchimento", /input\.style\.setProperty\("--p"/.test(appSource));
})();

// ---- 5. CSS responsivo (contrato: as regras existem) ----
(function(){
  var html = require("fs").readFileSync(require("path").join(__dirname, "..", "index.html"), "utf8");
  check.check("5. Blocos de peso do profissional ficam 2x2 em ecrãs pequenos", /@media \(max-width:760px\)\{ \.pro-main \.stat-grid-4\{grid-template-columns:repeat\(2,1fr\);\} \}/.test(html));
  check.check("5. 'Sair' fica na linha do logótipo em ecrãs pequenos", /\.brand-header #signOutBtn\{grid-column:2; grid-row:1;\}/.test(html));
  check.check("5. A data do Histórico passa para baixo do texto em ecrãs pequenos", /\.history-row:has\(> \.hdate\)\{flex-direction:column/.test(html));
  check.check("5. A data do Histórico não parte em duas linhas", /\.history-row \.hdate\{[^}]*white-space:nowrap/.test(html));
  check.check("5. Os sliders têm trilho visível", /input\[type=range\]::-webkit-slider-runnable-track\{[^}]*var\(--p,50%\)/.test(html));
})();

// ---- 6. Menu horizontal do profissional (telemóvel): o aluno nunca fica cortado a meio ----
(function(){
  // menu de 356px; aluno em 188, primeiro separador (Perfil) em 312, Leitura termina em 462
  var perfil  = {studentLeft:188, firstTabLeft:312, center:346, right:380};
  var leitura = {studentLeft:188, firstTabLeft:312, center:424, right:462};
  var pedidos = {studentLeft:188, firstTabLeft:312, center:501, right:539};
  var longe   = {studentLeft:188, firstTabLeft:312, center:960, right:1020};
  check.check("6. Perfil ativo: o menu começa no aluno, que fica inteiro", stripScrollLeft(perfil, 356) === 178);
  check.check("6. Leitura ativa: continua a começar no aluno (cabe a seguir a ele)", stripScrollLeft(leitura, 356) === 178);
  var p = stripScrollLeft(pedidos, 356);
  check.check("6. Quando já não cabe, o aluno sai por inteiro (nunca a meio)", p >= 312 - 2 && p === 323);
  check.check("6. Separadores mais à frente centram normalmente", stripScrollLeft(longe, 356) === 782);
  check.check("6. Sem aluno nem separadores (Dashboard/Catálogo), começa no início", stripScrollLeft({studentLeft:0, firstTabLeft:0, center:60, right:118}, 356) === 0);
  check.check("6. Nunca devolve scroll negativo", stripScrollLeft({studentLeft:0, firstTabLeft:0, center:10, right:400}, 356) >= 0);
  check.check("6. renderProShell usa stripPositions/stripScrollLeft e continua a usar scrollTo no contentor", /stripPositions\(container, activeNavItem\)/.test(appSource) && /stripScrollLeft\(pos, container\.clientWidth\)/.test(appSource) && /container\.scrollTo\(\{/.test(appSource));
})();

check.summarize();
