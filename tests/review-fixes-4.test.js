// Quarta ronda da revisão adversarial: duplo toque / aluno errado ao gravar como profissional, pesagens no mesmo dia, tipos forjados.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
function daysAgo(n){ return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10); }

// formulário de registo falso: o suficiente para o wireWorkoutLogger (uma série marcada)
function fakeLogger(s){
  var handlers = {};
  var els = {
    "#wlDay": {value: "d1", addEventListener: function(){}},
    "#wlSave": {textContent: "Guardar treino", disabled: false, addEventListener: function(evt, fn){ handlers.save = fn; }},
    "#wlError": {style: {display: "none"}, textContent: ""},
    "#wlRpe": {value: "7", addEventListener: function(){}, style: {setProperty: function(){}}},
    "#wlRpeVal": {textContent: ""},
    "#wlNotes": {value: ""},
    '[data-wl-done="e1:0"]': {checked: true},
    '[data-wl-reps="e1:0"]': {value: "8"},
    '[data-wl-load="e1:0"]': {value: "60"}
  };
  var el = {querySelector: function(sel){ return els[sel] || null; }, querySelectorAll: function(){ return []; }};
  return {el: el, els: els, handlers: handlers};
}
function sbWithManualPromises(){
  var pending = [], updates = [];
  var serverLogs = [];
  function builder(){
    var b = {_op: "select", _payload: null};
    ["select", "eq", "single"].forEach(function(m){ b[m] = function(){ return b; }; });
    b.update = function(p){ b._op = "update"; b._payload = p; return b; };
    b.then = function(ok, ko){
      return new Promise(function(res){ pending.push(function(){ res(); }); }).then(function(){
        if (b._op === "update"){ updates.push(b._payload); serverLogs = b._payload.workout_logs; return {error: null}; }
        return {data: {workout_logs: serverLogs.slice()}, error: null};
      }).then(ok, ko);
    };
    return b;
  }
  return {sb: {from: builder}, release: function(){ var p = pending.splice(0); p.forEach(function(f){ f(); }); }, updates: updates, server: function(){ return serverLogs; }};
}
function tick(){ return new Promise(function(r){ setTimeout(r, 5); }); }

(async function(){
  var realSb = sb, realReady = sbReady, realRole = authRole, realCols = trainingColumnsAvailable, realTab = state.alunoTab, realStu = state.alunoStudentId;
  var mock = sbWithManualPromises();
  sb = mock.sb; sbReady = true; authRole = "professional"; trainingColumnsAvailable = true;
  state.alunoTab = "checkin"; state.alunoStudentId = "S1"; state.wlDraft = {};
  var s = {id: "S1", name: "Maria", workoutLogs: [], workoutLogsRaw: [], checkins: [], weights: [], meals: [],
    trainingProgram: {days: [{id: "d1", name: "A", exercises: [{id: "e1", name: "Supino", sets: 3, reps: "8", rpe: 7, rest: 90}]}]}};
  var rerenders = 0;
  var f = fakeLogger(s);
  wireWorkoutLogger(s, f.el, function(){ rerenders++; });
  // 1. duplo toque durante o pedido
  f.handlers.save();
  check.check("1. Durante o pedido o botão fica desativado e diz 'A guardar…'", f.els["#wlSave"].disabled === true && f.els["#wlSave"].textContent === "A guardar…");
  f.handlers.save();
  f.handlers.save();
  check.check("1. Toques repetidos não criam outra sessão nem outro pedido (1 sessão local)", s.workoutLogs.length === 1);
  check.check("1. E mostram o aviso 'A guardar…' em vez de falharem em silêncio", /A guardar/.test(f.els["#wlError"].textContent));
  for (var i = 0; i < 4; i++){ mock.release(); await tick(); }
  check.check("1. No fim há 1 sessão no servidor e 1 gravação", mock.server().length === 1 && mock.updates.length === 1 && s.workoutLogs.length === 1 && s.workoutLogsRaw.length === 1);
  check.check("1. Redesenha (aluno e separador ainda são estes) e a flag volta a estar livre", rerenders === 1 && !wlSaving["S1"]);

  // 2. falha de rede: repõe o botão, desfaz a sessão local e deixa gravar outra vez
  state.wlDraft = {};
  var f2 = fakeLogger(s), rr2 = 0;
  wireWorkoutLogger(s, f2.el, function(){ rr2++; });
  sb = {from: function(){ throw new Error("rede"); }};
  f2.handlers.save();
  await tick();
  check.check("2. Falha: botão ativo outra vez, sessão desfeita nas duas listas e sem redesenhar", f2.els["#wlSave"].disabled === false && f2.els["#wlSave"].textContent === "Guardar treino" && s.workoutLogs.length === 1 && s.workoutLogsRaw.length === 1 && rr2 === 0 && !wlSaving["S1"]);

  // 3. o profissional mudou de aluno (ou de separador) enquanto o pedido estava em curso: não se redesenha o aluno antigo
  mock = sbWithManualPromises(); sb = mock.sb;
  var f3 = fakeLogger(s), rr3 = 0;
  wireWorkoutLogger(s, f3.el, function(){ rr3++; });
  f3.handlers.save();
  state.alunoStudentId = "OUTRO";
  for (i = 0; i < 4; i++){ mock.release(); await tick(); }
  check.check("3. Mudou de aluno a meio: grava na Maria mas não redesenha por cima do outro aluno", s.workoutLogs.length === 2 && mock.updates.length === 1 && rr3 === 0);
  state.alunoStudentId = "S1";
  var f4 = fakeLogger(s), rr4 = 0;
  mock = sbWithManualPromises(); sb = mock.sb;
  wireWorkoutLogger(s, f4.el, function(){ rr4++; });
  f4.handlers.save();
  state.alunoTab = "hoje";
  for (i = 0; i < 4; i++){ mock.release(); await tick(); }
  check.check("3. Mudou de separador a meio: também não redesenha", rr4 === 0 && s.workoutLogs.length === 3);

  sb = realSb; sbReady = realReady; authRole = realRole; trainingColumnsAvailable = realCols; state.alunoTab = realTab; state.alunoStudentId = realStu; wlDraftWipe();

  // 4. Tipos de adaptação forjados que coincidem com nomes do protótipo
  var sum = computeAdaptationSummary({adaptationHistory: [
    {date: daysAgo(1), type: "constructor"}, {date: daysAgo(1), type: "constructor"}, {date: daysAgo(1), type: "__proto__"}, {date: daysAgo(1), type: "toString"}, {date: daysAgo(1), type: "ignorar"}]}, 7);
  check.check("4. 'constructor', '__proto__' e 'toString' contam como chaves normais", sum["constructor"] === 2 && sum["__proto__"] === 1 && sum["toString"] === 1 && sum["ignorar"] === 1 && Object.keys(sum).length === 4);
  var out = tplProHistorico({planHistory: [], adaptationHistory: [{date: daysAgo(1), type: "constructor"}]});
  check.check("4. O Histórico mostra o texto do tipo (não o código de uma função)", out.indexOf("constructor") >= 0 && out.indexOf("function") < 0 && out.indexOf("[native code]") < 0);

  // 5. Duas pesagens no mesmo dia: o sinal de peso usa sempre a última (como weightCurrent), com ou sem pesagem de referência antiga
  var base = {goal: "Perder peso", weightGoal: 60, weightCurrent: 79.2};
  var withOld = Object.assign({}, base, {weights: [{date: daysAgo(60), w: 80}, {date: daysAgo(20), w: 79}, {date: daysAgo(1), w: 77}, {date: daysAgo(1), w: 79.2}]});
  var noOld = Object.assign({}, base, {weights: [{date: daysAgo(20), w: 79}, {date: daysAgo(1), w: 77}, {date: daysAgo(1), w: 79.2}]});
  var rev = Object.assign({}, base, {weights: [{date: daysAgo(60), w: 80}, {date: daysAgo(20), w: 79}, {date: daysAgo(1), w: 79.2}, {date: daysAgo(1), w: 77}], weightCurrent: 77});
  var a = signalWeight(withOld), b = signalWeight(noOld);
  check.check("5. Com referência antiga e com referência recente o resultado é o mesmo (+0,2 kg — a última pesagem do dia)", a.text === b.text && /\+0,2 kg/.test(a.text));
  check.check("5. Se a última do dia for outra, o sinal acompanha-a (−2,0 kg)", /-2,0 kg|−2,0 kg/.test(signalWeight(rev).text));
  check.check("5. computeRecentWeightChange: dentro do mesmo dia ganha a última inserida", computeRecentWeightChange(noOld.weights, 3).diff.toFixed(1) === "0.2");

  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e); process.exit(1); });
