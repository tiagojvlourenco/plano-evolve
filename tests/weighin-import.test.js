// Importar pesagens coladas do bloco de notas (amostras sintéticas — nunca dados reais).
require("./setup")();
var fs = require("fs");
var path = require("path");
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

var SAMPLE = [
  "Aluno Exemplo",
  "",
  "01/03/2020",
  "70.0 kg / 15.0 % / 55.0 kg / GV 3 / H2O 60.0 %",
  "",
  "10/04/2020",
  "71.5 kg",
  "",
  "",
  "",
  "05/05/2023 - 13h",
  "72.0 kg / 16,5 % / 56.0 kg / GV 3.5 / H2O 59 %",
  "",
  "06/05/2023 - 9:00 (jejum)",
  "72.2 kg / 16.4 % / 56.1 kg / GV 4 / H2O 59.1 %",
  "",
  "NOVA DIETA - 1800 kcal",
  "07/05/2023 - 14:30",
  "78.3 / 18.6 % / 60.6 kg / GV 5.5 / H2O 56.8 %",
  "",
  "08/05/2023 - 7:00 (jejum) - FÉRIAS ",
  "Calorias: 2000 kcal",
  "69.5 kg/ 14.5% / 56.4kg / GV 4 / H2O 60.1 %",
  "",
  "09/05/2023 - 6:00",
  "70  kg/ 14.9 % / 56.6 kg / GV 4 / H2O 59.7 %"
].join("\n");

var P = parseWeighInNotes(SAMPLE);
function byDate(d){ return P.entries.filter(function(e){ return e.date === d; })[0]; }

// ---- 1. Leitura do texto ----
(function(){
  check.check("1. Lê o nome do início", P.name === "Aluno Exemplo");
  check.check("1. Lê todas as pesagens (7) e não inventa avisos", P.entries.length === 7 && P.warnings.length === 0);
  var a = byDate("2020-03-01");
  check.check("1. Linha completa: peso, gordura, massa muscular, visceral e água", a.weight === 70 && a.bodyFat === 15 && a.muscle === 55 && a.visceral === 3 && a.water === 60 && a.complete === true);
  var b = byDate("2020-04-10");
  check.check("1. Só o peso fica como pesagem simples", b.weight === 71.5 && b.complete === false && b.bodyFat === undefined);
  check.check("1. Sem hora fica sem hora", a.time === "" && b.time === "");
  check.check("1. '13h' vira 13:00", byDate("2023-05-05").time === "13:00");
  check.check("1. Vírgula decimal (16,5) e sem espaços (14.5%, 56.4kg, kg/)", byDate("2023-05-05").bodyFat === 16.5 && byDate("2023-05-08").bodyFat === 14.5 && byDate("2023-05-08").muscle === 56.4);
  var j = byDate("2023-05-06");
  check.check("1. '9:00 (jejum)' dá 09:00 e jejum, sem nota", j.time === "09:00" && j.fasting === true && j.note === "");
  check.check("1. Peso sem 'kg' (78.3 /) é lido", byDate("2023-05-07").weight === 78.3);
  check.check("1. Linha antes da data (NOVA DIETA…) fica como nota da pesagem seguinte", byDate("2023-05-07").note === "NOVA DIETA - 1800 kcal");
  var f = byDate("2023-05-08");
  check.check("1. Nota depois da hora e linha entre a data e as medidas juntam-se", f.fasting === true && f.note === "FÉRIAS · Calorias: 2000 kcal");
  check.check("1. Espaços duplos não estragam (70  kg)", byDate("2023-05-09").weight === 70);
  check.check("1. Linhas em branco repetidas são ignoradas", P.entries.length === 7);
})();

// ---- 2. Avisos para o que não se percebe ----
(function(){
  var w = parseWeighInNotes("31/02/2020\n70 kg\n\n01/03/2020\n\n02/03/2020\n600 kg\n\n03/03/2020\n70 kg / 15 % / 55 kg\n\n04/03/2020\n70 kg / 99 % / 55 kg / GV 3 / H2O 60 %\n\n70 kg");
  check.check("2. Data inexistente (31/02) é rejeitada com aviso", w.warnings.some(function(m){ return /data inválida/.test(m); }));
  check.check("2. Data sem medidas é ignorada com aviso", w.warnings.some(function(m){ return /01\/03\/2020 sem medidas/.test(m); }));
  check.check("2. Peso impossível (600 kg) é ignorado com aviso", w.warnings.some(function(m){ return /peso fora do intervalo/.test(m); }) && !w.entries.some(function(e){ return e.weight === 600; }));
  var inc = w.entries.filter(function(e){ return e.date === "2020-03-03"; })[0];
  check.check("2. Medidas incompletas ficam só com o peso, com aviso", inc && inc.complete === false && w.warnings.some(function(m){ return /03\/03\/2020 medidas incompletas/.test(m); }));
  var fora = w.entries.filter(function(e){ return e.date === "2020-03-04"; })[0];
  check.check("2. Percentagem fora de 0–100 deixa só o peso, com aviso", fora && fora.complete === false && w.warnings.some(function(m){ return /valores fora do intervalo/.test(m); }));
  check.check("2. Medidas sem data são ignoradas com aviso", w.warnings.some(function(m){ return /medidas sem data/.test(m); }));
  check.check("2. Texto sem pesagens não rebenta", parseWeighInNotes("").entries.length === 0 && parseWeighInNotes(undefined).entries.length === 0 && parseWeighInNotes("olá\nmundo").entries.length === 0);
})();

// ---- 3. Juntar ao aluno ----
(function(){
  var s = {id:"t", name:"Aluno Exemplo", weights:[{date:"2023-05-09", w:70}], assessments:[], weightCurrent:70};
  var plan = mergeWeighIns(s, P.entries, false);
  check.check("3. Pré-visualização conta sem gravar", plan.full === 6 && plan.weightOnly === 1 && plan.duplicates === 0 && s.assessments.length === 0 && s.weights.length === 1);
  var r = mergeWeighIns(s, P.entries, true);
  check.check("3. Completas viram avaliação + peso; só peso vira só peso", s.assessments.length === 6 && r.full === 6 && r.weightOnly === 1);
  check.check("3. Peso já existente na mesma data não é duplicado", s.weights.filter(function(w){ return w.date === "2023-05-09"; }).length === 1);
  check.check("3. A avaliação guarda hora, jejum e nota", s.assessments.some(function(a){ return a.time === "09:00" && a.fasting === true; }) && s.assessments.some(function(a){ return a.note === "FÉRIAS · Calorias: 2000 kcal"; }));
  check.check("3. Avaliações sem hora/jejum/nota não ganham campos vazios", !("time" in s.assessments.filter(function(a){ return a.date === "2020-03-01"; })[0]));
  var dates = s.weights.map(function(w){ return w.date; });
  check.check("3. Os pesos ficam ordenados por data (gráfico)", dates.join() === dates.slice().sort().join());
  check.check("3. O peso atual passa a ser o mais recente", s.weightCurrent === 70 && s.weights[s.weights.length - 1].date === "2023-05-09");
  check.check("3. Importar o mesmo texto outra vez não repete nada", mergeWeighIns(s, P.entries, false).full === 0 && mergeWeighIns(s, P.entries, false).weightOnly === 0 && mergeWeighIns(s, P.entries, false).duplicates === 7);
  // peso atual só muda se o importado for mais recente
  var s2 = {id:"t", weights:[{date:"2030-01-01", w:99}], assessments:[], weightCurrent:99};
  mergeWeighIns(s2, P.entries, true);
  check.check("3. Dados mais antigos não mudam o peso atual", s2.weightCurrent === 99);
  var s3 = {id:"t", weights:[], assessments:[], weightCurrent:50};
  mergeWeighIns(s3, P.entries, true);
  check.check("3. Sem histórico, o peso atual passa a ser o da pesagem mais recente", s3.weightCurrent === 70);
})();

// ---- 4. Pré-visualização e ecrã ----
(function(){
  var s = {id:"t", name:"Aluno Exemplo", weights:[], assessments:[], weightCurrent:70};
  var plan = mergeWeighIns(s, P.entries, false);
  var prev = tplImportPreview(s, P, plan);
  check.check("4. Resume o número de pesagens e o período", /<strong>7 pesagens<\/strong> entre 01\/03\/2020 e 09\/05\/2023/.test(prev) && /6 completas, 1 só com o peso/.test(prev));
  check.check("4. O botão diz quantas vai importar e para quem", /Importar 7 pesagens para Aluno/.test(prev));
  check.check("4. Nome igual: sem aviso de nome", prev.indexOf("parece ser de") === -1);
  var outro = tplImportPreview({id:"x", name:"Outra Pessoa"}, P, plan);
  check.check("4. Nome diferente: avisa antes de importar", /parece ser de “Aluno Exemplo”, mas estás a importar para “Outra Pessoa”/.test(outro));
  var vazio = tplImportPreview(s, parseWeighInNotes("nada"), {full:0, weightOnly:0, duplicates:0});
  check.check("4. Sem nada percebido: explica e não oferece importar", /Não percebi nenhuma pesagem/.test(vazio) && vazio.indexOf("importWeighConfirm") === -1);
  var dup = tplImportPreview(s, P, {full:0, weightOnly:0, duplicates:7});
  check.check("4. Tudo duplicado: diz que não há nada a importar", /nada a importar/.test(dup) && dup.indexOf("importWeighConfirm") === -1);
  var xss = parseWeighInNotes("<b>Nome</b>\n01/01/2020\n70 kg\n"); xss.name = "<img src=x>";
  check.check("4. O nome do texto é escapado", tplImportPreview(s, xss, {full:0, weightOnly:1, duplicates:0}).indexOf("<img src=x>") === -1);
  var ui = tplImportWeighIns(s);
  check.check("4. A secção tem a caixa de texto e o botão de pré-visualização", /id="importWeighText"/.test(ui) && /id="importWeighPreview"/.test(ui));
  check.check("4. A secção aparece só na vista do profissional", /opts\.editable \? tplAssessForm\(s\) \+ tplImportWeighIns\(s\)/.test(appSource));
  check.check("4. Gravar chama persistStudent depois de juntar", /mergeWeighIns\(s, parsed\.entries, true\)[\s\S]{0,300}persistStudent\(s\)/.test(appSource));
})();

// ---- 5. Tabela: só as 10 mais recentes, com 'jejum' ----
(function(){
  var lista = [];
  for (var i = 1; i <= 25; i++) lista.push({date:"2024-01-" + ("0" + i).slice(-2), weight:70, bodyFat:15, muscle:55, visceral:3, water:60, fasting: i === 25, time: i === 25 ? "07:00" : undefined});
  state.assessShowAll = false;
  var t = tplAssessTable({assessments: lista}, true);
  check.check("5. Com mais de 10, mostra só as 10 mais recentes", (t.match(/<tr><td class="date-cell"/g) || []).length === 10);
  check.check("5. Oferece 'Mostrar todas (25)'", /id="assessToggleAll"[^>]*>Mostrar todas \(25\)/.test(t));
  check.check("5. A mais recente (25/01) está primeiro e mostra hora e jejum", /25\/01 <span class="atime">· 07:00<\/span> <span class="atime">· jejum<\/span>/.test(t));
  check.check("5. Os índices de apagar continuam certos (0 a 9)", /data-idx="0"/.test(t) && /data-idx="9"/.test(t) && !/data-idx="10"/.test(t));
  state.assessShowAll = true;
  var todas = tplAssessTable({assessments: lista}, true);
  check.check("5. 'Mostrar todas' mostra as 25 e oferece voltar a recolher", (todas.match(/<tr><td class="date-cell"/g) || []).length === 25 && /Mostrar só as 10 mais recentes/.test(todas));
  state.assessShowAll = false;
  var poucas = tplAssessTable({assessments: lista.slice(0, 5)}, true);
  check.check("5. Com 10 ou menos não há botão", poucas.indexOf("assessToggleAll") === -1);
  check.check("5. O botão está ligado no profissional e no aluno", /toggleAll\) toggleAll\.addEventListener[\s\S]{0,120}renderProTabContent/.test(appSource) && /toggleAllAluno\.addEventListener[\s\S]{0,120}renderAlunoTab/.test(appSource));
})();

// ---- 6. Tendência semanal: janela das últimas 8 semanas (com anos de histórico a média total não faz sentido) ----
(function(){
  function d(offset){ var x = new Date(Date.UTC(2026, 8, 26) - offset * 86400000); return x.toISOString().slice(0, 10); }
  // 6 anos a 70 kg e, nas últimas 4 semanas, sobe 70 → 72 (0.5 kg/semana)
  var longo = [{date: d(2200), w: 70}, {date: d(1000), w: 70}, {date: d(28), w: 70}, {date: d(14), w: 71}, {date: d(0), w: 72}];
  var tl = computeWeeklyTrend(longo);
  check.check("6. Com histórico longo usa só as últimas 8 semanas (≈ +0.5 kg/semana)", Math.abs(tl - 0.5) < 0.01);
  var curto = [{date: d(21), w: 70}, {date: d(0), w: 73}];
  check.check("6. Com pouco histórico continua a usar tudo (+1 kg/semana)", Math.abs(computeWeeklyTrend(curto) - 1) < 0.01);
  var sparse = [{date: d(500), w: 70}, {date: d(3), w: 71}, {date: d(0), w: 72}];
  check.check("6. Janela com menos de 7 dias de dados cai para o histórico todo", Math.abs(computeWeeklyTrend(sparse) - ((72 - 70) / (500 / 7))) < 0.001);
  check.check("6. Menos de 7 dias no total: sem tendência", computeWeeklyTrend([{date: d(3), w: 70}, {date: d(0), w: 71}]) === null);
  check.check("6. Menos de 2 pesagens: sem tendência", computeWeeklyTrend([{date: d(0), w: 70}]) === null);
  check.check("6. O rótulo diz 'Tendência recente'", appSource.indexOf("Tendência recente:") >= 0);
})();

check.summarize();
