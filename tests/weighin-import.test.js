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
  check.check("1. '9:00 (jejum)' dá 09:00, sem nota e sem guardar o jejum", j.time === "09:00" && j.note === "" && !("fasting" in j));
  check.check("1. Peso sem 'kg' (78.3 /) é lido", byDate("2023-05-07").weight === 78.3);
  check.check("1. Linha antes da data (NOVA DIETA…) fica como nota da pesagem seguinte", byDate("2023-05-07").note === "NOVA DIETA - 1800 kcal");
  var f = byDate("2023-05-08");
  check.check("1. Nota depois da hora e linha entre a data e as medidas juntam-se (sem a palavra jejum)", f.time === "07:00" && f.note === "FÉRIAS · Calorias: 2000 kcal");
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
  check.check("3. A avaliação guarda hora e nota, e nunca o jejum", s.assessments.some(function(a){ return a.time === "09:00"; }) && s.assessments.some(function(a){ return a.note === "FÉRIAS · Calorias: 2000 kcal"; }) && !s.assessments.some(function(a){ return "fasting" in a; }) && !s.weights.some(function(w){ return "fasting" in w; }));
  check.check("3. Avaliações sem hora/nota não ganham campos vazios", !("time" in s.assessments.filter(function(a){ return a.date === "2020-03-01"; })[0]));
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
  for (var i = 1; i <= 25; i++) lista.push({date:"2024-01-" + ("0" + i).slice(-2), weight:70, bodyFat:15, muscle:55, visceral:3, water:60, time: i === 25 ? "07:00" : undefined});
  state.assessShowAll = false;
  var t = tplAssessTable({assessments: lista}, true);
  check.check("5. Com mais de 10, mostra só as 10 mais recentes", (t.match(/<tr><td class="date-cell"/g) || []).length === 10);
  check.check("5. Oferece 'Mostrar todas (25)'", /id="assessToggleAll"[^>]*>Mostrar todas \(25\)/.test(t));
  check.check("5. A mais recente (25/01) está primeiro e mostra a hora, sem 'jejum'", /25\/01\/2024 <span class="atime">· 07:00<\/span>/.test(t) && t.indexOf("jejum") === -1);
  check.check("5. Os índices de apagar continuam certos (0 a 9)", /data-idx="0"/.test(t) && /data-idx="9"/.test(t) && !/data-idx="10"/.test(t));
  state.assessShowAll = true;
  var todas = tplAssessTable({assessments: lista}, true);
  check.check("5. 'Mostrar todas' mostra as 25 e oferece voltar a recolher", (todas.match(/<tr><td class="date-cell"/g) || []).length === 25 && /Mostrar só as 10 primeiras/.test(todas));
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

// ---- 7. "jejum" sem hora conta como 06:00; o jejum em si já não aparece ----
(function(){
  var j = parseWeighInNotes("01/02/2024 (jejum)\n70 kg\n\n02/02/2024 - jejum\n70.5 kg\n\n03/02/2024 - 8:15 (jejum)\n71 kg\n\n04/02/2024\n71.5 kg\n\n05/02/2024 (Jejum) - FÉRIAS\n72 kg");
  function e(d){ return j.entries.filter(function(x){ return x.date === d; })[0]; }
  check.check("7. '(jejum)' sem hora → 06:00", e("2024-02-01").time === "06:00");
  check.check("7. '- jejum' sem hora → 06:00", e("2024-02-02").time === "06:00");
  check.check("7. 'Jejum' com maiúscula também (e a nota fica só FÉRIAS)", e("2024-02-05").time === "06:00" && e("2024-02-05").note === "FÉRIAS");
  check.check("7. Jejum com hora mantém a hora escrita (08:15), não força 06:00", e("2024-02-03").time === "08:15");
  check.check("7. Sem jejum e sem hora continua sem hora", e("2024-02-04").time === "");
  check.check("7. Nenhuma pesagem tem o campo fasting, e a palavra 'jejum' não aparece na nota", j.entries.every(function(x){ return !("fasting" in x) && !/jejum/i.test(x.note); }));
  var prev = tplImportPreview({id:"t", name:"Aluno"}, j, {full:0, weightOnly:5, duplicates:0, newInitial:null});
  check.check("7. A pré-visualização não mostra 'jejum' mas mostra a hora 06:00", prev.indexOf("jejum") === -1 && prev.indexOf("06:00") >= 0);
})();

// ---- 8. Peso inicial = pesagem mais antiga (se a importação trouxer datas anteriores a tudo) ----
(function(){
  var ents = parseWeighInNotes("24/08/2020\n72.4 kg / 13.9 % / 59.2 kg / GV 3 / H2O 61.3 %\n\n26/09/2026 - 6:00\n71.5 kg").entries;
  var s = {id:"t", name:"Aluno", weightInitial: 71.5, weightCurrent: 71.5, weights:[{date:"2026-09-26", w:71.5}], assessments:[]};
  var plan = mergeWeighIns(s, ents, false);
  check.check("8. A pré-visualização anuncia o novo peso inicial (72.4 em 24/08/2020) sem o gravar", plan.newInitial && plan.newInitial.w === 72.4 && plan.newInitial.date === "2020-08-24" && s.weightInitial === 71.5);
  var prev = tplImportPreview(s, {name:"", entries:ents, warnings:[]}, plan);
  check.check("8. O texto da pré-visualização diz o novo peso inicial e a data", /peso inicial<\/strong> passa a ser <strong>72\.4 kg<\/strong> \(pesagem de 24\/08\/2020\)/.test(prev));
  mergeWeighIns(s, ents, true);
  check.check("8. Ao importar, o peso inicial passa a ser a pesagem de 24/08/2020", s.weightInitial === 72.4);
  check.check("8. O peso atual não muda (a pesagem mais recente é a mesma)", s.weightCurrent === 71.5);
  var sMid = {id:"t", weightInitial: 70, weightCurrent: 75, weights:[{date:"2020-01-01", w:70}], assessments:[]};
  mergeWeighIns(sMid, ents, true);
  check.check("8. Se já existe uma pesagem mais antiga, o peso inicial não muda", sMid.weightInitial === 70);
  var sSame = {id:"t", weightInitial: 72.4, weights:[], assessments:[], weightCurrent: 0};
  check.check("8. Se o peso inicial já é esse valor, não anuncia mudança", mergeWeighIns(sSame, ents, false).newInitial === null);
  var sNone = {id:"t", weightInitial: 80, weights:[], assessments:[], weightCurrent: 80};
  mergeWeighIns(sNone, ents, true);
  check.check("8. Sem histórico, o peso inicial passa a ser a primeira pesagem importada", sNone.weightInitial === 72.4);
})();

// ---- 9. Formato irregular (dados sintéticos): sem barras, datas com "-" e 2 dígitos, hora por omissão ----
(function(){
  var txt = [
    "Aluna Teste",
    "22/04/2021",
    "60 kg / 40 kg / 30 % / GV 3 / H20 50 %",
    "21/03-2025 - 9:00 (jejum)",
    "55 kg / 39 kg / 25 % / GV 2 H2O 52 %",
    "30/08/2024 - 8:00",
    "54kg / 38.9kg / 24,1% / GV2.5/ H2O52.6%",
    "54 38,9 24.2 2 53.2",
    "24/11/25 - 8:15 (jejum)",
    "53 kg / 27.9 kg / 23 % / GV 2 / H2O 52 %",
    "21/06/2024 - 10:00 (jejum)",
    "54.5 kg",
    "23/10/2025",
    "54 kg"
  ].join("\n");
  var r = parseWeighInNotes(txt, {defaultTime: "08:00"});
  function e(d){ return r.entries.filter(function(x){ return x.date === d; })[0]; }
  check.check("9. Aceita 'H20' (zero) e GV/H2O sem barra", e("2021-04-22").water === 50 && e("2025-03-21").visceral === 2 && e("2025-03-21").water === 52);
  check.check("9. Aceita 21/03-2025 e anos com 2 dígitos", !!e("2025-03-21") && !!e("2025-11-24"));
  check.check("9. Sem espaços (GV2.5, H2O52.6%) e vírgula decimal", e("2024-08-30").visceral === 2.5 && e("2024-08-30").water === 52.6 && e("2024-08-30").bodyFat === 24.1);
  check.check("9. Sem hora → hora por omissão (08:00), com ou sem 'jejum'", e("2021-04-22").time === "08:00" && e("2025-10-23").time === "08:00");
  check.check("9. Com hora escrita, mantém-na", e("2025-03-21").time === "09:00" && e("2025-11-24").time === "08:15" && e("2024-06-21").time === "10:00");
  check.check("9. A linha só com números sem data não vira nota e dá aviso", r.warnings.some(function(w){ return /sem data nem unidades/.test(w); }) && !r.entries.some(function(x){ return /54 38/.test(x.note); }));
  check.check("9. Massa muscular implausível (27.9 kg para 53 kg) dá aviso mas importa", r.warnings.some(function(w){ return /parece estranha/.test(w); }) && !!e("2025-11-24"));
  check.check("9. Peso sem restantes medidas continua a funcionar", e("2024-06-21").weight === 54.5 && !e("2024-06-21").complete);
  var sem = parseWeighInNotes("01/02/2024\n60 kg\n\n03/02/2024 (jejum)\n61 kg").entries;
  check.check("9. Sem opção, mantém o comportamento anterior (sem hora; jejum = 06:00)", sem[0].time === "" && sem[1].time === "06:00");
  check.check("9. O formulário tem o campo 'hora por omissão'", /id="importWeighDefaultTime"/.test(tplImportWeighIns({id:"t", name:"A"})));
})();

// ---- 10. Ordenar a tabela por coluna (melhores/piores valores) e ano na data ----
(function(){
  var lista = [
    {date:"2024-01-01", weight:70, bodyFat:20, muscle:50, visceral:3, water:55},
    {date:"2024-02-01", weight:65, bodyFat:25, muscle:52, visceral:2, water:57},
    {date:"2024-03-01", weight:68, bodyFat:15, muscle:48, visceral:4, water:60}
  ];
  function rows(t){ return (t.match(/<td class="date-cell">(\d{2}\/\d{2}\/\d{4})/g) || []).map(function(x){ return x.slice(-10); }); }
  state.assessSort = null; state.assessShowAll = true;
  var t = tplAssessTable({assessments: lista}, true);
  check.check("10. A data mostra o ano (dd/mm/aaaa)", rows(t)[0] === "01/03/2024");
  check.check("10. Por omissão: data, mais recente primeiro", rows(t).join() === "01/03/2024,01/02/2024,01/01/2024");
  check.check("10. Cabeçalhos clicáveis para as 6 colunas", (t.match(/data-sort="/g) || []).length === 6);
  toggleAssessSort("weight");
  check.check("10. Peso: do maior para o menor", rows(tplAssessTable({assessments: lista}, true)).join() === "01/01/2024,01/03/2024,01/02/2024");
  toggleAssessSort("weight");
  var asc = tplAssessTable({assessments: lista}, true);
  check.check("10. Segundo clique inverte (menor primeiro) e marca aria-sort", rows(asc)[0] === "01/02/2024" && /aria-sort="ascending"/.test(asc));
  toggleAssessSort("bodyFat"); toggleAssessSort("bodyFat");
  check.check("10. Massa gorda crescente: a melhor (15%) fica primeiro", rows(tplAssessTable({assessments: lista}, true))[0] === "01/03/2024");
  toggleAssessSort("date"); toggleAssessSort("date");
  check.check("10. Data crescente: a mais antiga primeiro", rows(tplAssessTable({assessments: lista}, true))[0] === "01/01/2024");
  state.assessSort = {key:"weight", dir:"asc"};
  var s2 = tplAssessTable({assessments: lista}, true);
  check.check("10. Apagar usa sempre o índice por data (a linha de 65 kg, ordenada em 1.º, é a data-idx=1)", /data-idx="1"[\s\S]*$/.test(s2) && s2.indexOf('data-idx="1"') < s2.indexOf('data-idx="2"'));
  state.assessSort = null;
})();

check.summarize();
