// Motor de gravação: diferença por coluna, fila de envio, alterações desfeitas, erros temporários e cópia para abrir sem rede.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var store = {};
global.localStorage = {getItem: function(k){ return k in store ? store[k] : null; }, setItem: function(k, v){ store[k] = String(v); }, removeItem: function(k){ delete store[k]; }};

var row = {id: "a", name: "Ana", meals: [1], checkins: [], weights: [{w: 70}], notes: ""};
var base = rowBaseline(row);
check.check("1. Sem alterações a diferença é vazia", Object.keys(rowPatch(row, base)).length === 0);
var changed = Object.assign({}, row, {weights: [{w: 70}, {w: 69}]});
check.check("2. Só a coluna alterada entra na diferença", Object.keys(rowPatch(changed, base)).join(",") === "weights");
check.check("3. Sem versão de partida, vai a ficha toda (como antes)", Object.keys(rowPatch(row, null)).length === 6);
check.check("4. Arrays e objetos comparam-se pelo conteúdo, não pela referência", Object.keys(rowPatch(Object.assign({}, row, {meals: [1], weights: [{w: 70}]}), base)).length === 0);

// fila
outboxMem = null; delete store[OUTBOX_KEY];
outboxAdd("a", {weights: [1]});
outboxAdd("a", {notes: "x", weights: [1, 2]});
var ob = outboxRead();
check.check("5. A fila junta alterações do mesmo aluno e a última versão ganha", Object.keys(ob.a.cols).sort().join(",") === "notes,weights" && ob.a.cols.weights.length === 2);
check.check("6. A fila fica guardada no telemóvel", JSON.parse(store[OUTBOX_KEY]).a.cols.notes === "x");
outboxMem = null;
check.check("7. E volta a ler-se depois de fechar a app", outboxRead().a.cols.weights.length === 2 && outboxCount() === 1);

// alteração desfeita antes de seguir: a fila fica com o valor atual e não com o antigo
(function(){
  outboxMem = {}; delete store[OUTBOX_KEY];
  var s = {id: "a", name: "Ana", meals: [], checkins: [], weights: [], workoutLogs: [], photos: [], weightLogPhotos: [], targets: {}, trainingProgram: null};
  authRole = "student"; sbReady = true;
  ensureSyncBaseline(s);
  s.notes = "primeira"; // ainda não existe 'notes' nas colunas do aluno; usa um campo que studentToRow grava
  s.mealsDate = "2026-10-01";
  persistStudents["a"] = s; persistPrepare("a");
  var first = Object.assign({}, outboxRead().a && outboxRead().a.cols);
  s.mealsDate = null;
  persistStudents["a"] = s; persistPrepare("a");
  var cols = outboxRead().a ? outboxRead().a.cols : {};
  check.check("8. A fila só leva colunas que mudaram desde a versão de partida", Object.keys(first).every(function(k){ return k === "meals_date" || k === "notes"; }) && "meals_date" in first);
  check.check("9. Uma alteração desfeita antes de seguir substitui a que estava na fila", !("meals_date" in cols) || cols.meals_date == null);
  authRole = null; sbReady = false;
})();

// erros
check.check("10. Sem resposta do servidor (rede) é um erro temporário", outboxErrorIsTransient({error: {message: "TypeError: Failed to fetch"}, status: 0}));
check.check("11. Servidor ocupado ou sessão a renovar também é temporário", outboxErrorIsTransient({error: {message: "x"}, status: 503}) && outboxErrorIsTransient({error: {message: "JWT expired"}, status: 401}));
check.check("12. Recusa do servidor (permissões, formato) é permanente", !outboxErrorIsTransient({error: {message: "Só o profissional pode alterar estes dados do plano.", code: "P0001"}, status: 400}));

// ficha com alterações por enviar ao abrir a app
var rows = [{id: "a", weights: [1], notes: "velho"}, {id: "b", weights: []}];
outboxMem = {a: {cols: {notes: "novo"}, full: false}};
var over = outboxOverlay(rows);
check.check("13. Ao abrir, a ficha mostra já as alterações por enviar", over[0].notes === "novo" && over[1].weights.length === 0);
check.check("14. A leitura do servidor não é alterada (copia-se)", rows[0].notes === "velho");

// cópia da ficha para abrir sem rede
store = {}; global.localStorage = {getItem: function(k){ return k in store ? store[k] : null; }, setItem: function(k, v){ store[k] = String(v); }, removeItem: function(k){ delete store[k]; }};
snapshotWrite("u1", [{id: "a", notes: "x"}]);
check.check("15. A cópia só é lida pelo próprio utilizador", snapshotRead("u1").rows[0].id === "a" && snapshotRead("u2") === null);
authRole = "student"; snapshotApplyPatch("a", {notes: "y"});
check.check("16. As alterações do aluno entram na cópia", snapshotRead("u1").rows[0].notes === "y");
authRole = "professional"; snapshotApplyPatch("a", {notes: "z"});
check.check("17. O profissional nunca altera nem guarda cópias de fichas", snapshotRead("u1").rows[0].notes === "y");
store[OUTBOX_KEY] = "{}"; outboxMem = {a: {cols: {}}}; offlineDataWipe();
check.check("18. Ao sair da conta apaga-se a cópia e a fila", snapshotRead("u1") === null && outboxCount() === 0 && !(OUTBOX_KEY in store));

// o aluno nunca envia colunas só do profissional quando não as alterou
(function(){
  var s = rowToStudent({id: "a", initials: "A", name: "Ana", meals: [], photos: [], likes: [], dislikes: [], avoid: [], allergies: [], targets: {kcal: 1}, notes: "privada", checkins: [], weights: [], workout_logs: []});
  authRole = "student"; ensureSyncBaseline(s);
  s.weights.push({date: "2026-10-13", w: 70});
  var patch = rowPatch(studentToRow(s), s._sync);
  check.check("19. Uma pesagem do aluno altera só o peso (nunca notas, alertas nem plano)", Object.keys(patch).every(function(k){ return ["weights", "weight_current"].indexOf(k) >= 0; }) && "weights" in patch);
  check.check("20. O estado de sincronização não aparece ao listar as propriedades da ficha", Object.keys(s).indexOf("_sync") < 0 && !!s._sync);
  authRole = null;
})();
check.summarize();
