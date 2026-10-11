// Terceira ronda da revisão adversarial: regressões das correções.
require("./setup")();
var fs = require("fs");
var path = require("path");
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
function daysAgo(n){ return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10); }

// ---- 1. Separador Histórico: o 'tipo' de uma adaptação (escrito pelo aluno) nunca chega ao HTML sem escapar ----
(function(){
  var evil = "<img src=x onerror=alert(1)>";
  var s = {planHistory: [], adaptationHistory: [{date: daysAgo(1), type: evil}, {date: daysAgo(1), type: 42}, {date: daysAgo(1), type: {a: 1}}, {date: daysAgo(1), type: "ignorar"}]};
  var summary = computeAdaptationSummary(s, 7);
  check.check("1. O resumo só conta tipos que são texto (42 e objeto ficam de fora)", Object.keys(summary).every(function(k){ return typeof k === "string"; }) && summary[evil] === 1 && summary["ignorar"] === 1 && Object.keys(summary).length === 2);
  var out = tplProHistorico(s);
  check.check("1. O tipo forjado aparece escapado no HTML do profissional", out.indexOf("<img src=x") < 0 && out.indexOf("&lt;img src=x") >= 0);
})();

// ---- 2. Estado das refeições: reconstruído só com os campos e tipos que a app escreve ----
(function(){
  check.check("2. Sem data em texto → null (reconstrói-se)", normalizeMealState({date: 20260101, entries: {}}) === null && normalizeMealState({entries: {}}) === null);
  check.check("2. entries que não é objeto → null", normalizeMealState({date: "2026-01-01", entries: []}) === null && normalizeMealState({date: "2026-01-01", entries: "x"}) === null && normalizeMealState(null) === null && normalizeMealState([]) === null);
  var ok = normalizeMealState({date: "2026-01-01", entries: {m1: {status: "flexible", done: true, substitutions: {"0": {name: "Ovo", qty: "2 un"}, a: {name: "x", qty: "1"}, "1": {name: 5, qty: "1"}, "2": "lixo"}}, m2: "lixo", m3: null, m4: {status: "skipped", substitutions: "lixo"}, m5: {status: "pending", substitutions: [1, 2]}}});
  check.check("2. Entradas que não são objetos são descartadas", Object.keys(ok.entries).join() === "m1,m4,m5");
  check.check("2. Só ficam substituições com índice numérico, nome em texto e quantidade em texto", JSON.stringify(ok.entries.m1.substitutions) === JSON.stringify({"0": {name: "Ovo", qty: "2 un"}}) && JSON.stringify(ok.entries.m4.substitutions) === "{}" && JSON.stringify(ok.entries.m5.substitutions) === "{}");
  check.check("2. Estado desconhecido volta a 'planned'; flexível mantém-se", ok.entries.m5.status === "planned" && ok.entries.m1.status === "flexible" && ok.entries.m4.status === "skipped");
  var t1 = normalizeMealState({date: "d", entries: {a: {rescheduledTime: "13:30"}, b: {rescheduledTime: "<img src=x>"}, c: {rescheduledTime: "25:99"}, d: {rescheduledTime: 1330}, e: {rescheduledTime: "9:05"}}}).entries;
  check.check("2. rescheduledTime só aceita horas HH:MM (senão null — não rebenta toMinutes nem entra no HTML)", t1.a.rescheduledTime === "13:30" && t1.b.rescheduledTime === null && t1.c.rescheduledTime === null && t1.d.rescheduledTime === null && t1.e.rescheduledTime === "9:05");
  var lc = normalizeMealState({date: "d", entries: {a: {liveChoice: {prot: 1, carb: "x", fat: -1, bad: 1.5, huge: 1e9}}, b: {liveChoice: "lixo"}, c: {}}}).entries;
  check.check("2. liveChoice: só índices inteiros pequenos; o resto cai (ou null)", JSON.stringify(lc.a.liveChoice) === JSON.stringify({prot: 1, fat: -1}) && lc.b.liveChoice === null && lc.c.liveChoice === null);
  var legit = {date: "2026-01-02", entries: {m1: {done: true, adapted: true, status: "rescheduled", rescheduledTime: "18:00", liveChoice: {prot: 0}, substitutions: {"1": {name: "Frango", qty: "120 g"}}}}};
  check.check("2. Estado legítimo mantém-se igual", JSON.stringify(normalizeMealState(legit)) === JSON.stringify(legit));
  // texto forjado: nunca chega ao HTML do profissional/aluno sem escape
  var evilQty = '<form action="https://evil.example/login"><input type=password></form><style>*{display:none}</style>';
  var s = rowToStudent({id: "z", name: "T", meals: [{name: "Almoço", time: "13:00", foods: [{name: "Arroz", qty: "100 g", group: "carb", required: false}, {name: "Frango", qty: "120 g", group: "prot", required: false}]}], weights: [], assessments: [], photos: [],
    meals_date: todayISO(), meal_daily_state: {date: todayISO(), entries: {"Almoço@13:00": {substitutions: {"0": {name: "Ovo <b>x</b>", qty: evilQty}}}}}});
  var sv = studentView(s);
  var html = tplPlano(sv) + tplHoje(sv);
  check.check("2. Nome/quantidade de uma substituição forjada aparecem escapados em Plano e Hoje", html.indexOf("<form action") < 0 && html.indexOf("<style>*") < 0 && html.indexOf("&lt;form action") >= 0);
})();

// ---- 3. Progressão: topSet / 1RM com Epley simples; a bonificação de repetições só entra na pontuação ----
(function(){
  var st = workoutEntryStats({sets: [{reps: 15, load: 40}, {reps: 8, load: 40}]});
  check.check("3. topSet e 1RM estimado vêm do Epley simples (15 reps = 1RM como 12 reps)", st.topSet.reps === 15 && st.est1RM === epley1RM(40, 15) && st.est1RM === 56);
  check.check("3. A pontuação de progressão tem a bonificação das repetições acima de 12 (≥ 1RM)", st.score > st.est1RM);
  var a = workoutEntryStats({sets: [{reps: 14, load: 40}]}), b = workoutEntryStats({sets: [{reps: 15, load: 40}]});
  check.check("3. Uma repetição a mais acima de 12 conta como progresso (score sobe), sem inflacionar o 1RM mostrado", b.score > a.score && a.est1RM === b.est1RM);
  var bw = workoutEntryStats({sets: [{reps: 10, load: 0}, {reps: 12, load: 0}]});
  check.check("3. Sem carga: kind 'reps', score = máximo de repetições", bw.kind === "reps" && bw.score === 12 && bw.topSet.load === 0);
})();

// ---- 4. Rascunho do treino: expira em cada leitura, mesmo com a página aberta ----
(function(){
  var realNow = Date.now, t0 = realNow();
  var s = {id: "alunoX"};
  var clock = t0;
  Date.now = function(){ return clock; };
  state.wlDraft = null;
  var d = wlDraftGet(s, "d1");
  d.sets["e1_0"] = true; d.rpe = 8; wlDraftSave(d);
  clock = t0 + 11 * 3600000;
  check.check("4. Com 11 h ainda é o mesmo rascunho", wlDraftGet(s, "d1").rpe === 8);
  wlDraftSave(wlDraftGet(s, "d1"));  // volta a carimbar (agora + 11 h)
  clock = t0 + 11 * 3600000 + 13 * 3600000;
  var d2 = wlDraftGet(s, "d1");
  check.check("4. 13 h depois do último uso o rascunho velho desaparece (sem recarregar a página)", d2.rpe === null && Object.keys(d2.sets).length === 0);
  Date.now = realNow;
  wlDraftWipe();
})();

// ---- 5. Tendência do peso: pouca pesagem recente não cai no 'insuficiente' se houver 14+ dias na janela ----
(function(){
  var s = {goal: "Perder peso", weightGoal: 60, weightCurrent: 70, weights: [{date: daysAgo(120), w: 80}, {date: daysAgo(25), w: 71}, {date: daysAgo(2), w: 70}]};
  var sig = signalWeight(s);
  check.check("5. Referência antiga (120 dias) mas há pesagem a 25 dias → avalia com a da janela", sig.status !== "insuficiente" && /1,0 kg/.test(sig.text.replace("−", "-")) );
  var s2 = {goal: "Perder peso", weightGoal: 60, weightCurrent: 70, weights: [{date: daysAgo(120), w: 80}, {date: daysAgo(5), w: 70}]};
  check.check("5. Sem pesagem de referência dentro da janela → 'insuficiente' com explicação", signalWeight(s2).status === "insuficiente");
})();

// ---- 6. Profissional a gravar a sessão: sem colunas de treino devolve false; falhar não deixa sessão fantasma ----
(function(){
  var realSb = sb, realReady = sbReady, realCols = trainingColumnsAvailable;
  sb = {from: function(){ throw new Error("não devia ser chamado"); }}; sbReady = true;
  trainingColumnsAvailable = false;
  var la = {id: "a"}, lb = {id: "b"};   // na app a sessão nova é o MESMO objeto nas duas listas (logWorkout)
  var s = {id: "x", workoutLogs: [la, lb], workoutLogsRaw: [la, lb]};
  var log = lb;
  return appendWorkoutLogAsPro(s, log).then(function(ok){
    check.check("6. Sem a migração 0019 não tenta gravar e devolve false", ok === false);
    undoWorkoutLog(s, log);
    check.check("6. undoWorkoutLog remove a sessão das duas listas", s.workoutLogs.length === 1 && s.workoutLogsRaw.length === 1 && s.workoutLogs[0].id === "a" && s.workoutLogsRaw[0].id === "a");
    trainingColumnsAvailable = realCols; sb = realSb; sbReady = realReady;
    var src = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
    check.check("6. O guardar do profissional só dá 'guardado' depois da escrita e repõe o registo se falhar (rascunho mantido)", /appendWorkoutLogAsPro\(s, log\); \}\)\.then\(function\(ok\)\{\s*if \(!ok\) throw new Error\("columns"\);/.test(src) && /catch\(function\([a-z]*\)\{[^}]*undoWorkoutLog\(s, log\)/.test(src.replace(/\n/g, " ")));
    // rotas de leitura da tabela/gráfico do profissional usam o histórico dentro da linha de base e do mesmo tipo
    check.check("6. Tabela do profissional usa baselineHistory e o gráfico só histórico do mesmo tipo", /progressionStatus\(baselineHistory\(h\)\)/.test(src) && /sameKindHistory\(/.test(src));
  });
})().then(function(){ check.summarize(); }, function(e){ console.log("FAIL: exceção", e); process.exit(1); });
