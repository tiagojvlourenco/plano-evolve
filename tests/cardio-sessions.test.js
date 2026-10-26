// Treinos de cardio estruturados (corrida-core.js): validação, passos, resumo, avanço por tempo ou distância; e o texto/guia do gravador (corrida-live.js).
var fs = require("fs"), path = require("path");
var check = require("./check")();
var coreCode = fs.readFileSync(path.join(__dirname, "..", "corrida-core.js"), "utf8");
var names = [], m, re = /^(?:function\s+(\w+)|var\s+(\w+))/gm;
while ((m = re.exec(coreCode))) names.push(m[1] || m[2]);
var C = (function(){ "use strict"; return eval(coreCode + "\n;({" + names.map(function(x){ return x + ": " + x; }).join(", ") + "})"); })();
var n = 0;
function ck(d, c){ n++; check.check(n + ". " + d, !!c); }
var T = C.RUN_SESSION_TEMPLATES[0];
ck("Todos os treinos prontos são válidos e têm resumo e passos", C.RUN_SESSION_TEMPLATES.length >= 8 && C.RUN_SESSION_TEMPLATES.every(function(t){ var s = C.runSessionNormalize(t); return s && C.runSessionSummary(s).length > 5 && C.runSessionSteps(s).length >= 1; }));
ck("«8 × 400 m»: aquecimento + 8 esforços + 7 recuperações + arrefecimento = 17 passos; o resumo diz tudo", C.runSessionSteps(T).length === 17 && C.runSessionSummary(T) === "Aquecimento 10 min · 8 × 400 m (recuperação 90 s) · Arrefecimento 5 min" && C.runSessionSteps(T)[1].kind === "work" && C.runSessionSteps(T)[2].kind === "rest" && C.runSessionSteps(T)[16].kind === "cooldown");
ck("Meta: 5 km dá um passo de 5000 m; 30 min dá 1800 s", C.runSessionSteps({name: "x", kind: "goal", goal: {unit: "km", value: 5}})[0].value === 5000 && C.runSessionSteps({name: "x", kind: "goal", goal: {unit: "min", value: 30}})[0].value === 1800);
var bad = [null, "x", {}, {name: "", kind: "goal", goal: {unit: "km", value: 5}}, {name: "a", kind: "x"}, {name: "a", kind: "goal", goal: {unit: "km", value: 0.1}}, {name: "a", kind: "goal", goal: {unit: "km", value: 500}}, {name: "a", kind: "goal", goal: {unit: "h", value: 5}},
  {name: "a", kind: "intervals", intervals: {reps: 0, work: {unit: "m", value: 400}, rest: {unit: "s", value: 60}}}, {name: "a", kind: "intervals", intervals: {reps: 31, work: {unit: "m", value: 400}, rest: {unit: "s", value: 60}}},
  {name: "a", kind: "intervals", intervals: {reps: 5, work: {unit: "m", value: 20}, rest: {unit: "s", value: 60}}}, {name: "a", kind: "intervals", intervals: {reps: 5, work: {unit: "m", value: 400}, rest: {unit: "s", value: 5}}},
  {name: "a", kind: "intervals", intervals: {reps: 5, work: {unit: "m", value: 400}, rest: {unit: "s", value: 60}, warmupMin: 99}}, {name: "a", kind: "goal", goal: {unit: "km", value: 5}, date: "28/10"}];
ck("Valores fora dos limites ou mal formados são recusados (nome vazio, tipo, meta 0,1 km ou 500 km, 0 ou 31 repetições, esforço 20 m, recuperação 5 s, aquecimento 99 min, data mal escrita)", bad.every(function(x){ return C.runSessionNormalize(x) === null; }) && C.runSessionSteps(null).length === 0 && C.runSessionSummary("x") === "");
var nz = C.runSessionNormalize({name: "  Meu   treino  " + "x".repeat(100), activity: "bike", kind: "intervals", date: "2026-11-03", intervals: {reps: "6", work: {unit: "s", value: "180"}, rest: {unit: "s", value: "120"}, warmupMin: "", cooldownMin: "5"}});
ck("Normalizar limpa o nome (espaços, 60 caracteres), aceita números em texto, aquecimento vazio = 0, e guarda atividade e data", nz.name.length === 60 && nz.name.indexOf("  ") < 0 && nz.activity === "bike" && nz.date === "2026-11-03" && nz.intervals.reps === 6 && nz.intervals.warmupMin === 0 && nz.intervals.cooldownMin === 5);
var st = C.runSessionSteps(T), a = C.runSessionAdvance(C.runSessionCursor(), st, 300, 700);
ck("Avanço: aos 5 min ainda é aquecimento (faltam 300 s); passados os 10 min passa ao 1.º esforço e avisa (changed)", a.step.kind === "warmup" && a.remaining.value === 300 && a.changed === false && (a = C.runSessionAdvance(a.cursor, st, 600, 900)).step.kind === "work" && a.changed === true && a.remaining.unit === "m" && a.remaining.value === 400);
a = C.runSessionAdvance(a.cursor, st, 640, 1100);
ck("O esforço em metros avança pela distância desde o início do passo (200 m feitos: faltam 200) e ao chegar aos 400 m passa à recuperação em segundos", a.step.kind === "work" && a.remaining.value === 200 && (a = C.runSessionAdvance(a.cursor, st, 700, 1300)).step.kind === "rest" && a.remaining.unit === "s" && a.remaining.value === 90);
var cur = C.runSessionCursor(), r = C.runSessionAdvance(cur, st, 99999, 99999);
ck("Um salto grande (telemóvel suspenso) avança só um passo (cada passo conta desde o momento em que começa), sem rebentar nem ficar num ciclo", r.cursor.i === 1 && r.changed === true && r.finished === false && (function(){ var c = r.cursor, k = 0; while (!(r = C.runSessionAdvance(c, st, 99999 + 1e6 * (k + 1), 99999 + 1e6 * (k + 1))).finished && k < 100) { c = r.cursor; k++; } return r.finished === true && r.cursor.i === st.length; })());
ck("Sem passos (corrida livre) ou com entradas estranhas não lança: devolve finished e nada a mostrar", C.runSessionAdvance(null, [], 10, 10).finished === true && C.runSessionAdvance(C.runSessionCursor(), st, NaN, "x").step.kind === "warmup" && C.runSessionAdvance(C.runSessionCursor(), st, -5, -5).step.kind === "warmup");
// ---- o guia do gravador (funções extraídas de corrida-live.js) ----
var live = fs.readFileSync(path.join(__dirname, "..", "corrida-live.js"), "utf8");
function grab(name){ var i = live.indexOf("function " + name + "("); var j = live.indexOf("\n}\n", i); return live.slice(i, j + 3); }
var pings = 0, el = {textContent: "", attrs: {}, setAttribute: function(k, v){ this.attrs[k] = v; }};
var G = (function(){
  var runSessionAdvance = C.runSessionAdvance, document = {getElementById: function(id){ return id === "runLiveGuide" ? el : null; }}, restTimerAlert = function(){ pings++; };
  var RUN_L_STEP_NAMES = eval("(" + live.match(/var RUN_L_STEP_NAMES = (\{[^}]*\});/)[1] + ")");
  eval(grab("runLGuideAmount") + grab("runLGuideText") + grab("runLGuideTick"));
  return {tick: runLGuideTick, text: runLGuideText, amount: runLGuideAmount};
})();
var L = {sess: C.runSessionNormalize(T), steps: st, cur: C.runSessionCursor(), guideDone: false, guide: ""};
G.tick(L, {elapsedS: 120, distM: 300});
ck("O guia mostra o passo atual e o que falta («Aquecimento · faltam 8:00 (passo 1 de 17)») sem tocar sinal enquanto o passo não muda", /^Aquecimento · faltam 8:00 \(passo 1 de 17\)$/.test(el.textContent) && pings === 0 && el.attrs["data-kind"] === "warmup");
G.tick(L, {elapsedS: 600, distM: 1500});
ck("Ao mudar de passo toca o sinal uma vez e mostra «Corre forte 1 · faltam 400 m»", pings === 1 && /^Corre forte 1 · faltam 400 m \(passo 2 de 17\)$/.test(el.textContent) && el.attrs["data-kind"] === "work");
G.tick(L, {elapsedS: 601, distM: 1510}); G.tick(L, {elapsedS: 602, distM: 1520});
ck("Sem mudança de passo não volta a tocar", pings === 1);
var kk = 0; while (!L.guideDone && kk < 100) { kk++; G.tick(L, {elapsedS: 1e6 * kk, distM: 1e6 * kk}); }
var p1 = pings; G.tick(L, {elapsedS: 1e9, distM: 1e9});
ck("No fim (passo a passo) diz «Treino concluído», e depois de concluído não volta a tocar", /Treino concluído/.test(el.textContent) && el.attrs["data-kind"] === "done" && L.guideDone === true && pings === p1 && p1 >= 16);
ck("Sem treino estruturado o guia não faz nada", (function(){ var before = el.textContent; G.tick({sess: null}, {elapsedS: 5, distM: 5}); return el.textContent === before; })());
ck("O gravador só guia (não altera estatísticas): o código do guia não escreve em L.st nem chama runFeed", !/L\.st\s*=/.test(grab("runLGuideTick")) && !/runFeed\(/.test(grab("runLGuideTick")));

// ---- Melhorar tempo ----
var REF = C.runBeatRef({distM: 5000, durationS: 1800, splitsS: [370, 360, 350, 360, 360]});
ck("runBeatRef normaliza a corrida anterior (distância, tempo, parciais) e recusa as muito curtas, sem tempo ou com lixo; parciais incoerentes viram ritmo constante", REF.distM === 5000 && REF.durationS === 1800 && REF.splitsS.length === 5 && C.runBeatRef({distM: 300, durationS: 600}) === null && C.runBeatRef({distM: 5000, durationS: 10}) === null && C.runBeatRef(null) === null && C.runBeatRef({distM: 5000, durationS: 1800, splitsS: [2000]}).splitsS.length === 0 && C.runBeatRef({distance_m: 5000, duration_s: 1800, splits_s: [360, 360]}).splitsS.length === 2);
ck("O tempo esperado segue as parciais da corrida anterior (1 km = 370 s, 1,5 km = 550 s) e, sem parciais, é constante (2,5 km em 1800 s/5 km = 900 s)", Math.abs(C.runBeatExpected(REF, 1000) - 370) < 1e-9 && Math.abs(C.runBeatExpected(REF, 1500) - 550) < 1e-9 && Math.abs(C.runBeatExpected(REF, 5000) - 1800) < 1e-9 && C.runBeatExpected(REF, 9000) === 1800 && Math.abs(C.runBeatExpected({distM: 5000, durationS: 1800, splitsS: []}, 2500) - 900) < 1e-9 && C.runBeatExpected(REF, 0) === 0);
var b1 = C.runBeatStatus(REF, 540, 1500), b2 = C.runBeatStatus(REF, 600, 1500), b3 = C.runBeatStatus(REF, 549, 1500);
ck("Estado: 540 s aos 1,5 km (esperado 550) = adiantado 10 s, previsão 1790 s; 600 s = atrasado 50 s; 549 s = no ritmo; antes dos 100 m = início", b1.state === "ahead" && Math.round(b1.deltaS) === 10 && Math.round(b1.projectedS) === 1790 && b1.remainingM === 3500 && b2.state === "behind" && Math.round(b2.deltaS) === -50 && b3.state === "even" && C.runBeatStatus(REF, 20, 50).state === "start");
var d1 = C.runBeatStatus(REF, 1770, 5000), d2 = C.runBeatStatus(REF, 1830, 5100);
ck("Ao chegar à distância: meta atingida (1770 s contra 1800 = 30 s melhor) ou não (1830 s = 30 s a mais); entradas estranhas devolvem null", d1.state === "done" && d1.deltaS === 30 && d1.projectedS === 1770 && d2.state === "done" && d2.deltaS === -30 && C.runBeatStatus(null, 1, 1) === null && C.runBeatStatus(REF, NaN, 1) === null);
var BS = C.runSessionNormalize({name: "5 km em 25:00", activity: "run", kind: "beat", beat: {km: "5", timeS: 1500}});
ck("Treino «contra o relógio» (5 km em 25:00): válido, sem passos, com resumo; recusa distância 0,1, tempo 10 s, ritmo impossível (5 km em 5 min a pé) e bicicleta rápida demais", BS && BS.beat.km === 5 && C.runSessionSteps(BS).length === 0 && C.runSessionSummary(BS) === "Contra o relógio: 5 km em 25:00" && C.runSessionNormalize({name: "a", kind: "beat", beat: {km: 0.1, timeS: 600}}) === null && C.runSessionNormalize({name: "a", kind: "beat", beat: {km: 5, timeS: 10}}) === null && C.runSessionNormalize({name: "a", kind: "beat", beat: {km: 5, timeS: 300}}) === null && C.runSessionNormalize({name: "a", activity: "bike", kind: "beat", beat: {km: 5, timeS: 300}}) !== null && C.runSessionNormalize({name: "a", activity: "bike", kind: "beat", beat: {km: 50, timeS: 300}}) === null);
// texto do gravador
var G2 = (function(){
  var RUN_L_STEP_NAMES = {}, runDurStr = C.runDurStr, runBeatStatus = C.runBeatStatus, restTimerAlert = function(){ pings++; };
  var elB = {textContent: "", attrs: {}, setAttribute: function(k, v){ this.attrs[k] = v; }}, document = {getElementById: function(id){ return id === "runLiveBeat" ? elB : null; }};
  eval(grab("runLBeatKm") + grab("runLBeatText") + grab("runLBeatTick"));
  return {tick: runLBeatTick, text: runLBeatText, el: elB};
})();
var LB = {beat: REF, beatDone: false, beatLabel: "x", beatText: ""}; pings = 0;
G2.tick(LB, {elapsedS: 540, distM: 1500});
ck("O gravador mostra «Adiantado 0:10 · previsão 29:50 · faltam 3,5 km» sem tocar sinal", G2.el.textContent === "Adiantado 0:10 · previsão 29:50 · faltam 3,5 km" && G2.el.attrs["data-state"] === "ahead" && pings === 0);
G2.tick(LB, {elapsedS: 600, distM: 1500});
ck("Atrasado: «Atrasado 0:50 · previsão 30:50 · faltam 3,5 km»", G2.el.textContent === "Atrasado 0:50 · previsão 30:50 · faltam 3,5 km" && G2.el.attrs["data-state"] === "behind");
G2.tick(LB, {elapsedS: 1770, distM: 5000}); var pb = pings; G2.tick(LB, {elapsedS: 1780, distM: 5050});
ck("Ao chegar: «Meta atingida! 0:30 mais rápido (29:30 contra 30:00). Podes terminar.» e toca uma só vez; o resultado fica fixo mesmo que se continue a correr", /^Meta atingida! 0:30 mais rápido \(29:30 contra 30:00\)\. Podes terminar\.$/.test(G2.el.textContent) && pb === 1 && pings === 1 && LB.beatDone === true);
check.summarize();
