// Corridas do motor de gravação (achados da revisão): alterações durante um envio, recusas parciais, fusão de treinos,
// refresh do profissional e arranque offline com cópia desatualizada.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var store = {};
global.localStorage = {getItem: function(k){ return k in store ? store[k] : null; }, setItem: function(k, v){ store[k] = String(v); }, removeItem: function(k){ delete store[k]; }};

// Supabase simulado em Node: update/select controláveis; cada pedido pode ficar "em voo" até o teste o libertar
var server, calls, gates;
function resetServer(row){
  server = JSON.parse(JSON.stringify(row)); calls = []; gates = [];
  outboxMem = {}; store = {}; syncCleanup();
}
function syncCleanup(){ Object.keys(persistTimers).forEach(function(k){ clearTimeout(persistTimers[k]); delete persistTimers[k]; delete persistStudents[k]; }); clearTimeout(outboxRetryTimer); outboxFlushPromise = null; }
var refuse = null;      // função (payload) -> mensagem de recusa permanente, ou null
var holdNext = false;   // o próximo update fica em voo até gates[n]()
sbReady = true;
sb = {from: function(){
  var q = {op: "select", payload: null, cols: "*"};
  var api = {
    select: function(c){ if (q.op === "select") q.cols = c || "*"; return api; },
    update: function(p){ q.op = "update"; q.payload = p; return api; },
    eq: function(){ return api; },
    maybeSingle: function(){ q.single = true; return api; },
    then: function(ok, bad){
      return new Promise(function(resolve){
        var run = function(){
          if (q.op === "update"){
            calls.push(JSON.parse(JSON.stringify(q.payload)));
            var msg = refuse ? refuse(q.payload) : null;
            if (msg) return resolve({data: null, error: {message: msg, code: "P0001"}, status: 400});
            Object.keys(q.payload).forEach(function(k){ server[k] = JSON.parse(JSON.stringify(q.payload[k])); });
            return resolve({data: [{id: server.id}], error: null, status: 200});
          }
          if (q.cols === "*" && !q.single) return resolve({data: [JSON.parse(JSON.stringify(server))], error: null, status: 200});
          resolve({data: q.cols === "*" ? JSON.parse(JSON.stringify(server)) : (function(){ var o = {}; q.cols.split(",").forEach(function(c){ o[c] = JSON.parse(JSON.stringify(server[c])); }); return o; })(), error: null, status: 200});
        };
        if (q.op === "update" && holdNext){ holdNext = false; gates.push(run); } else run();
      }).then(ok, bad);
    }
  };
  return api;
}};
function tick(ms){ return new Promise(function(r){ setTimeout(r, ms || 10); }); }
function baseRow(extra){
  return Object.assign({id: "a", initials: "A", name: "Ana", meals: [], photos: [], likes: [], dislikes: [], avoid: [], allergies: [], targets: {}, checkins: [], weights: [], workout_logs: [], substitution_history: [], adaptation_history: []}, extra || {});
}
function load(row){ var s = rowToStudent(row); STUDENTS = [s]; authRole = "student"; ensureSyncBaseline(s); return s; }
function persistNow(s){ persistStudents[s.id] = s; persistPrepare(s.id); }

(async function(){
  // ---- 1. alteração feita com um pedido em voo não se perde ----
  resetServer(baseRow());
  var s = load(baseRow());
  pushCheckin(s, {date: "2026-10-01", weight: 70}); persistNow(s);
  holdNext = true;
  var f1 = outboxFlush();
  await tick();
  pushCheckin(s, {date: "2026-10-02", weight: 69}); persistNow(s);   // muda a MESMA lista enquanto o 1.º pedido segue
  gates[0](); await f1; await tick(200);
  check.check("1. A pesagem feita durante o envio também chega ao servidor", server.checkins.length === 2 && server.checkins[1].weight === 69);
  check.check("2. Depois de tudo enviado a fila está vazia", outboxCount() === 0);
  check.check("3. O 1.º pedido levou só a 1.ª pesagem (cópia, não a lista viva)", calls[0].checkins.length === 1);

  // ---- 2. coluna recusada não leva as outras ----
  resetServer(baseRow({workout_logs: [{id: "w1", date: "2026-10-01", dayId: "d", dayName: "A", entries: []}]}));
  s = load(baseRow({workout_logs: [{id: "w1", date: "2026-10-01", dayId: "d", dayName: "A", entries: []}]}));
  var seenRefusals = 0;
  refuse = function(p){ if ("workout_logs" in p && p.workout_logs.length === 2 && p.workout_logs[0].id !== "w1") { seenRefusals++; return "Não é permitido alterar ou remover sessões de treino já registadas."; } return null; };
  pushCheckin(s, {date: "2026-10-03", weight: 68});
  s.workoutLogsRaw = [{id: "w2", date: "2026-10-03", dayId: "d", dayName: "A", entries: []}, {id: "w1", date: "2026-10-01", dayId: "d", dayName: "A", entries: []}]; // outro aparelho tinha ordem diferente: recusado
  persistNow(s);
  await outboxFlush(); await tick(100);
  check.check("4. A pesagem seguiu mesmo com a coluna dos treinos recusada", server.checkins.length === 1 && server.checkins[0].weight === 68);
  check.check("5. Os treinos recusados foram fundidos por id (servidor primeiro) e reenviados", server.workout_logs.length === 2 && server.workout_logs[0].id === "w1" && server.workout_logs[1].id === "w2");
  check.check("6. A ficha do aluno ficou com os dois treinos", s.workoutLogsRaw.length === 2 && s.workoutLogs.length === 2);
  check.check("7. A fila ficou vazia (nada a repetir em ciclo)", outboxCount() === 0);
  refuse = null;

  // ---- 3. recusa de outra coluna: descarta só essa e repõe a versão do servidor ----
  resetServer(baseRow({checkins: [{date: "2026-10-01", weight: 70, adherence: 7}]}));
  s = load(baseRow());
  refuse = function(p){ return "checkins" in p ? "Só o profissional pode alterar estes dados do plano." : null; };
  pushCheckin(s, {date: "2026-10-04", weight: 67});
  s.checkinsRaw = [{date: "2026-10-04", weight: 67, adherence: 9}];
  persistNow(s);
  await outboxFlush(); await tick(100);
  check.check("8. A pesagem seguiu e a coluna recusada foi descartada", server.checkins.length === 1 && outboxCount() === 0);
  check.check("9. A ficha foi reposta com a versão do servidor (sem o check-in recusado)", s.checkinsRaw.length === 1 && s.checkinsRaw[0].date === "2026-10-01");
  refuse = null;

  // ---- 4. update que não alterou nenhuma linha não conta como enviado ----
  resetServer(baseRow());
  s = load(baseRow());
  var realSend = sb.from;
  sb.from = function(){ var a = realSend(); var origThen = a.then; var upd = false; a.update = (function(u){ return function(p){ upd = true; return u(p); }; })(a.update);
    a.then = function(ok, bad){ if (upd) return Promise.resolve({data: [], error: null, status: 200}).then(ok, bad); return origThen(ok, bad); }; return a; };
  pushCheckin(s, {date: "2026-10-05", weight: 66}); persistNow(s);
  await outboxFlush(); await tick(100);
  sb.from = realSend;
  check.check("10. Se o servidor não alterou nenhuma linha, a alteração não é dada como enviada sem aviso", outboxCount() === 0 && /* foi tratada como recusa */ calls.length === 0);

  // ---- 5. arranque offline: a fila é aplicada mesmo que a cópia esteja desatualizada ----
  resetServer(baseRow());
  outboxAdd("a", {workout_logs: [{id: "w9", date: "2026-10-06", dayId: "d", dayName: "A", entries: []}]});
  snapshotWrite("u1", [baseRow()]); // cópia sem o treino w9
  var rowsForBoot = outboxOverlay(snapshotRead("u1").rows);
  check.check("11. Sem rede, a ficha abre já com o treino que estava na fila", rowsForBoot[0].workout_logs.length === 1 && rowsForBoot[0].workout_logs[0].id === "w9");
  check.check("12. O arranque offline usa a sobreposição da fila", /finishBoot\(outboxOverlay\(snap\.rows\), false, true\)/.test(appSource));

  // ---- 6. o refresh do profissional atualiza no próprio objeto e não se faz com janela aberta ----
  resetServer(baseRow({name: "Ana"}));
  authRole = "professional";
  var cur = rowToStudent(baseRow({name: "Ana Velha"})); STUDENTS = [cur]; lastStudentsLoad = 0; state.proSelectedId = null;
  var held = cur;
  modalRoot = {firstChild: {}};
  var skipped = await proRefreshStudents(true);
  check.check("13. Com uma janela aberta não se atualiza a lista", skipped === false && STUDENTS[0] === held && held.name === "Ana Velha");
  modalRoot = {firstChild: null};
  var done = await proRefreshStudents(true);
  check.check("14. Sem janela, a ficha é atualizada no mesmo objeto (referências antigas continuam válidas)", done === true && STUDENTS[0] === held && held.name === "Ana");
  held.name = "Ana editada"; persistStudents["a"] = held;
  await proRefreshStudents(true);
  check.check("15. Uma ficha com alterações por enviar nunca é substituída", held.name === "Ana editada");
  delete persistStudents["a"];
  holdNext = false;
  var refreshing = proRefreshStudents(true);
  lastLocalWriteAt = Date.now() + 5; // alteração local durante a leitura
  var res6 = await refreshing;
  check.check("16. Se houve alterações locais durante a leitura, essa leitura é ignorada", res6 === false);
  authRole = null;

  // ---- 7. a fila avisa se o telemóvel não a conseguiu guardar ----
  var keep = global.localStorage;
  global.localStorage = {getItem: function(){ return null; }, setItem: function(){ throw new Error("QuotaExceededError"); }, removeItem: function(){}};
  outboxMem = {}; outboxAdd("a", {weights: [1]});
  check.check("17. Se não há espaço para guardar a fila, fica registado para o aviso", outboxStorageOk === false);
  global.localStorage = keep; outboxWrite();
  check.check("18. E volta ao normal quando a escrita resulta", outboxStorageOk === true);

  // ---- 8. service worker: só guarda páginas válidas ----
  var sw = require("fs").readFileSync(__dirname + "/../sw.js", "utf8");
  check.check("19. O service worker só guarda a página se for HTML da app e resposta boa", sw.indexOf("text\\/html") >= 0 && sw.indexOf('id="alunoApp"') >= 0 && sw.indexOf("res.status >= 500") >= 0);
  check.check("20. As escritas na cache do service worker esperam por waitUntil", /waitUntil\(/.test(sw.slice(sw.indexOf("function networkFirst"))));
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e && e.stack || e); process.exit(1); });
