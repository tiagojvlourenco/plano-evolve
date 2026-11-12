// Avaliação mais fácil de ler: gráfico de evolução com tendência/eixo/objetivo e histórico por medida (lista com cores) + tabela completa num botão.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var W = [];
for (var d = 0; d < 120; d++) W.push({date: new Date(Date.UTC(2026, 3, 22) + d * 86400000).toISOString().slice(0, 10), w: 58.5 - d * 0.04 + (d % 3 === 0 ? 0.6 : -0.3)});
var svg = trendChartSvg(W, {goal: 51, marks: [{date: "2026-06-01", label: "Cut"}]});
check.check("1. Gráfico: tendência (linha) por cima dos pontos de cada dia, eixo com valores e meses", /class="tc-trend"/.test(svg) && (svg.match(/class="tc-dot"/g) || []).length === 120 && /class="tc-grid"/.test(svg) && />mai</.test(svg) && />jul</.test(svg));
check.check("2. Gráfico: linha do objetivo e início das fases; legenda e descrição acessível", /class="tc-goal"/.test(svg) && /objetivo 51,0/.test(svg) && /class="tc-mark"/.test(svg) && />Cut</.test(svg) && /chart-legend/.test(svg) && /aria-label="De 59,1 kg em 22\/04\/2026 para [\d,]+ kg em 19\/08\/2026; objetivo 51,0 kg"/.test(svg));
check.check("3. A tendência é mais lisa do que as pesagens (média móvel centrada)", (function(){ var t = trendSeries(W.map(function(p){ return {x: dayNum(p.date), date: p.date, v: p.w}; }), 4); var jump = function(a){ var m = 0; for (var i = 1; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - a[i - 1])); return m; }; return jump(t.map(function(p){ return p.v; })) < jump(W.map(function(p){ return p.w; })) / 3; })());
check.check("4. Eixo do tempo é real: dois pontos com 30 dias de intervalo ficam mais afastados do que dois com 1 dia", (function(){ var s2 = trendChartSvg([{date: "2026-01-01", w: 70}, {date: "2026-01-02", w: 70.2}, {date: "2026-01-31", w: 69}]); var xs = (s2.match(/points="([^"]+)"/g) || [])[1].replace(/points="|"/g, "").split(" ").map(function(p){ return parseFloat(p); }); return (xs[2] - xs[1]) > 10 * (xs[1] - xs[0]); })());
check.check("5. Objetivo muito longe não esmaga o gráfico; com menos de 2 dias diz que faltam dados", !/tc-goal/.test(trendChartSvg(W, {goal: 20})) && /Ainda não há dados suficientes/.test(trendChartSvg([{date: "2026-01-01", w: 70}])));
check.check("6. O cartão de peso usa o gráfico novo (com o objetivo do aluno)", /trendChartSvg\(s\.weights, \{goal: s\.weightGoal, marks: phaseChartMarks\(s\)/.test(appSource));

var av = [["2026-09-25", 53.5, 25.1, 38.0, 3, 51.5], ["2026-09-18", 53.7, 25.0, 38.1, 3, 51.6], ["2026-09-04", 54.3, 25.6, 38.3, 3, 51.4], ["2026-08-23", 55.3, 24.0, 39.0, 3, 51.5]].map(function(r){ return {date: r[0], time: "08:00", weight: r[1], bodyFat: r[2], muscle: r[3], visceral: r[4], water: r[5]}; });
var s = {weightInitial: 58.5, weightGoal: 51, assessments: av, planHistory: [{type: "fase_inicio", date: "2026-09-10", after: "bulk", summary: "Fase Bulk iniciada (objetivo 60 kg)"}]};
state.assessView = null; state.assessMetric = null;
var h = tplAssessHistory(s, true);
check.check("7. Por omissão: lista por medida (M. gorda; o Peso não está aqui, tem o seu gráfico), com as medidas disponíveis em botões e a tabela completa num botão", /Histórico das avaliações/.test(h) && /data-assess-metric="bodyFat" aria-pressed="true"/.test(h) && /data-assess-metric="water"/.test(h) && !/data-assess-metric="weight"/.test(h) && /data-assess-view="tabela"/.test(h) && !/<table class="assess-table"/.test(h));
check.check("8. Cada linha: data, hora, valor com unidade e variação para a anterior", /<div class="am-date">25\/09\/2026<span>08:00<\/span><\/div><div class="am-val">25,1<small>%<\/small><\/div><div class="am-d [a-z]+">▲ 0,1<\/div>/.test(h));
state.assessView = "tabela"; var tb9 = tplAssessHistory(s, true); state.assessView = null;
check.check("9. Cor da variação: gordura a subir é má (1,6 ▲), a descer é boa (0,6 ▼) e 0,1 é ruído (cinzento); o Peso continua na tabela completa", /25,6<small>%<\/small><\/div><div class="am-d bad">▲ 1,6/.test(h) && /25,0<small>%<\/small><\/div><div class="am-d good">▼ 0,6/.test(h) && /25,1<small>%<\/small><\/div><div class="am-d flat">▲ 0,1/.test(h) && />Peso/.test(tb9) && /<table class="assess-table"/.test(tb9));
check.check("10. Marca da fase no sítio certo e linhas da fase com a cor dela", /▶ Bulk · 10\/09\/2026 · objetivo 60 kg[\s\S]*04\/09\/2026/.test(h) && h.indexOf("▶ Bulk") > h.indexOf("18/09/2026") && /am-row ph-bulk/.test(h));
check.check("11. Resumo desde a primeira avaliação, com cor", /Desde 23\/08\/2026: 24,0 → 25,1 % <span class="am-d (good|bad|flat)">\(\+1,1 %\)<\/span>/.test(h));
state.assessMetric = "bodyFat";
var hf = tplAssessHistory(s, true);
check.check("12. Massa gorda: subir é mau, descer é bom (em qualquer fase)", /data-assess-metric="bodyFat" aria-pressed="true"/.test(hf) && /25,6<small>%<\/small><\/div><div class="am-d bad">▲ 1,6/.test(hf) && /25,0<small>%<\/small><\/div><div class="am-d good">▼ 0,6/.test(hf));
state.assessMetric = "muscle";
check.check("13. Massa muscular: descer é mau", /38,3<small>kg<\/small><\/div><div class="am-d bad">▼ 0,7/.test(tplAssessHistory(s, true)));
state.assessView = "tabela";
var ht = tplAssessHistory(s, true);
check.check("14. «Tabela completa» mostra a tabela de sempre (com apagar) e um botão para voltar", /<table class="assess-table"/.test(ht) && /class="assess-del" data-idx=/.test(ht) && /data-assess-view="lista"/.test(ht));
state.assessView = null; state.assessMetric = null;
check.check("15. Sem avaliações: diz que não há; o aluno vê «Tabela completa» sem «apagar»", /Ainda sem avaliações/.test(tplAssessHistory({assessments: []}, false)) && />Tabela completa</.test(tplAssessHistory(s, false)));
check.check("16. Os botões da medida e da vista estão ligados no profissional e no aluno", (appSource.match(/wireAssessHistory\(el, function\(\)\{ render(ProTabContent|AlunoTab)\(s\); \}\);/g) || []).length === 2);
// ecrã do aluno: sem vermelho (o que piorou fica a cinzento), o verde mantém-se; o profissional vê tudo
state.assessView = null; state.assessMetric = null;
var hp = tplAssessHistory(s, true), ha = tplAssessHistory(s, false);
check.check("17. Aluno: nenhuma variação a vermelho no histórico; as boas continuam a verde (o profissional vê o vermelho)", /am-d bad/.test(hp) && !/am-d bad/.test(ha) && /am-d good/.test(ha) && /25,6<small>%<\/small><\/div><div class="am-d flat">▲ 1,6/.test(ha));
var kAv = {assessments: [{date: "2026-09-25", weight: 53.5, bodyFat: 25.1, muscle: 38.0, water: 51.5}, {date: "2026-09-18", weight: 53.7, bodyFat: 25.0, muscle: 38.1, water: 51.6}]};
check.check("18. Aluno: os cartões da composição também não ficam a vermelho", /class="d bad"/.test(tplAssessKpis(kAv)) && !/class="d bad"/.test(tplAssessKpis(kAv, true)) && /class="d flat">▲ 0.1 %/.test(tplAssessKpis(kAv, true)));
var evA = tplEvolucaoAluno(Object.assign({weights: [], photos: [], planHistory: [], weightInitial: 58.5, weightCurrent: 53.5}, kAv), {editable: false});
check.check("19. O Progresso do aluno usa a versão sem vermelho", !/class="d bad"/.test(evA) && !/am-d bad/.test(evA) && /tplAssessKpis\(s, !opts\.editable\)/.test(appSource));
// vários anos de pesagens com intervalos grandes (caso real da Diana)
var M = [];
function bloco(ini, n, a, b){ var t0 = Date.parse(ini + "T00:00:00Z"); for (var i = 0; i < n; i += 2) M.push({date: new Date(t0 + i * 86400000).toISOString().slice(0, 10), w: a + (b - a) * i / n}); }
bloco("2021-07-10", 60, 58.5, 52.8); bloco("2024-05-05", 44, 56.3, 53.5); bloco("2025-06-01", 400, 52.4, 53.6);
var tudo = trendChartSvg(M, {}), ano = trendChartSvg(M, {rangeDays: 365});
var etiquetas = function(svgS){ return (svgS.match(/y="194" text-anchor="middle">[^<]+</g) || []).length; };
check.check("20. Vários anos: as datas em baixo passam a anos (sem etiquetas sobrepostas, no máximo ~6)", />2022</.test(tudo) && />2025</.test(tudo) && etiquetas(tudo) <= 6 && !/>jul</.test(tudo));
check.check("21. Um intervalo grande sem pesagens corta a linha da tendência (3 troços, sem rampa inventada)", (tudo.match(/class="tc-trend"/g) || []).length === 3);
check.check("22. «1 ano» mostra só os últimos 365 dias", (ano.match(/class="tc-trend"/g) || []).length === 1 && etiquetas(ano) <= 6 && /aria-label="De [\d,]+ kg em \d\d\/\d\d\/2025/.test(ano));
state.weightRange = null;
var sLong = {weights: M}, sShort = {weights: M.slice(-30)};
check.check("23. Com mais de 400 dias de pesagens o gráfico começa em «1 ano»; botões 3 meses · 6 meses · 1 ano · Tudo", weightRangeDays(sLong) === 365 && /data-wrange="365" aria-pressed="true">1 ano/.test(tplWeightRange(sLong)) && /data-wrange="0"[^>]*>Tudo/.test(tplWeightRange(sLong)) && tplWeightRange(sShort) === "" && weightRangeDays(sShort) === 0);
state.weightRange = 0;
check.check("24. A escolha do período fica guardada e os botões estão ligados", weightRangeDays(sLong) === 0 && /state\.weightRange = parseInt\(b\.getAttribute\("data-wrange"\), 10\) \|\| 0/.test(appSource));
state.weightRange = null;
// arrastar o dedo pelo gráfico
var sv = trendChartSvg(W, {});
var dp = (sv.match(/data-p="([^"]+)"/) || [])[1] || "";
var cp = chartPoints(dp.replace(/&amp;/g, "&"));
check.check("25. O gráfico leva um ponto por dia (x|y|data · valor · tendência) e um cursor escondido", cp.length === 120 && /^\d{2}\/\d{2}\/\d{4} · [\d,]+ kg · tendência [\d,]+$/.test(cp[0].label) && /class="tc-cursor" visibility="hidden"/.test(sv) && /toca e arrasta para ver cada dia/.test(sv));
check.check("26. O ponto mais próximo do dedo é o certo (nas pontas e no meio)", chartNearest(cp, -50) === cp[0] && chartNearest(cp, 9999) === cp[cp.length - 1] && chartNearest(cp, cp[60].x + 0.1) === cp[60]);
check.check("27. Sem suavização (poucos pontos) a etiqueta não fala de tendência", !/tendência/.test(chartPoints((trendChartSvg([{date: "2026-01-01", w: 70}, {date: "2026-01-05", w: 69.5}], {}).match(/data-p="([^"]+)"/) || [])[1])[0].label));
check.check("28. Toque, arrastar e rato ligados; a página continua a deslizar na vertical (touch-action: pan-y)", /\["pointerdown", "pointermove", "pointerleave"\]\.forEach\(function\(ev\)\{ document\.addEventListener\(ev, chartScrub, true\); \}\);/.test(appSource) && /\.tchart\{touch-action:pan-y;/.test(require("fs").readFileSync(__dirname + "/../app.css", "utf8")));

// períodos no gráfico das avaliações (os mesmos botões do peso)
var AL = [];
for (var q = 0; q < 30; q++) AL.push({date: new Date(Date.UTC(2024, 0, 1) + q * 30 * 86400000).toISOString().slice(0, 10), time: "08:00", bodyFat: 30 - q * 0.2});
var sAL = {assessments: AL.slice().reverse().map(function(a){ return a; }), planHistory: []};
state.assessView = null; state.assessMetric = "bodyFat"; state.assessRange = null;
var hl = tplAssessHistory(sAL, true);
check.check("25. Com mais de 400 dias de avaliações o gráfico das medidas começa em «1 ano» e tem os botões 3 meses · 6 meses · 1 ano · Tudo, como o peso", /data-arange="365" aria-pressed="true">1 ano/.test(hl) && /data-arange="90"[^>]*>3 meses/.test(hl) && /data-arange="0"[^>]*>Tudo/.test(hl));
check.check("26. «1 ano» mostra só os últimos 365 dias no gráfico e no resumo («Desde» a primeira avaliação dentro do período)", (function(){ var m = /Desde (\d\d)\/(\d\d)\/(\d{4}):/.exec(hl); return !!m && parseInt(m[3], 10) >= 2025 && /aria-label="De [\d,]+ % em \d\d\/\d\d\/202[5-6]/.test(hl); })());
state.assessRange = 0;
var hl0 = tplAssessHistory(sAL, true);
check.check("27. «Tudo» volta ao histórico completo (desde 01/01/2024) e a escolha fica guardada", /Desde 01\/01\/2024:/.test(hl0) && /data-arange="0" aria-pressed="true">Tudo/.test(hl0));
state.assessRange = null;
check.check("28. Com poucos meses de avaliações não há botões de período (ficam só os do ecrã atual) e os botões estão ligados", !/data-arange/.test(tplAssessHistory(s, true)) && /state\.assessRange = parseInt\(b\.getAttribute\("data-arange"\), 10\) \|\| 0/.test(appSource));
state.assessMetric = null;
check.summarize();
