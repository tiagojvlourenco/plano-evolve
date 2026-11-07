// EVOLVE Treino, robustez: dados corrompidos no armazenamento do telemóvel (rascunho, fila de envio) não podem impedir a app de abrir, e o funcionamento
// offline de ponta a ponta com o service worker a sério (abrir sem rede, registar, terminar, recarregar, sincronizar ao voltar a rede).
// O que não se vê aqui: o iOS a limpar o armazenamento da app, o Wi-Fi a falhar a meio de um pedido e o armazenamento realmente cheio.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var fs = require("fs"), path = require("path");
function iso(d){ return isoOfLocalDate(new Date(Date.now() - d * 86400000)); }

// ---- Node: limpeza do que vem do armazenamento ----
check.check("1. Rascunho: número, texto, lista ou nulo viram «sem rascunho» (nunca rebentam)", [42, "abc", [1, 2], null, true].every(function(v){ var c = wlDraftClean(v); return c && typeof c === "object" && Object.keys(c).length === 0; }));
var dirty = {"a|d": {savedAt: Date.now(), sets: {"e:0": {reps: "10", load: 50, rir: 2, done: true, lixo: {x: 1}}, "e:1": "x", "e:2": null}, rpe: "nove", notes: 5, restOverride: {"Supino": 135, "Remada": "x", "Peso": 99999}}, "b|d": null, "c|d": {sets: "x"}};
var cl = wlDraftClean(dirty);
check.check("2. Rascunho: ficam só os campos certos (séries válidas com repetições, carga, RIR e «feita»), o resto desaparece", Object.keys(cl).join() === "a|d,c|d" && JSON.stringify(Object.keys(cl["a|d"].sets)) === '["e:0"]' && JSON.stringify(cl["a|d"].sets["e:0"]) === '{"reps":"10","load":50,"rir":2,"done":true}');
check.check("3. Rascunho: o esforço e as notas inválidos viram vazio; o descanso ajustado só aceita 5 s a 1 h", cl["a|d"].rpe === null && cl["a|d"].notes === "" && JSON.stringify(cl["a|d"].restOverride) === '{"Supino":135}' && cl["c|d"].sets && Object.keys(cl["c|d"].sets).length === 0);
var oc = outboxClean({ana: {cols: {workout_logs: [{id: "w"}], weight_current: 70}, full: 1, ts: 5}, bad1: "x", bad2: {}, bad3: {cols: null}, bad4: {cols: {workout_logs: "x"}}, arr: [1]});
check.check("4. Fila de envio: só ficam as entradas bem formadas ({cols}), uma lista de treinos que não é lista é descartada, e o resto não é tocado", Object.keys(oc).join() === "ana" && oc.ana.cols.weight_current === 70 && Array.isArray(oc.ana.cols.workout_logs) && oc.ana.full === true && oc.ana.ts === 5);
check.check("5. Fila de envio: texto, lista ou nulo viram fila vazia", [ "x", [1], null, 7 ].every(function(v){ return Object.keys(outboxClean(v)).length === 0; }));

// cartão de erro: saída para dados locais estragados
var APP_MODE_SAVED = APP_MODE, saved = tplTreinoHome;
APP_MODE = "treino"; state.alunoTab = "hoje";
var fakeEl = {innerHTML: "", querySelector: function(){ return null; }, querySelectorAll: function(){ return []; }};
var origGet = document.getElementById; document.getElementById = function(id){ return id === "alunoTabContent" ? fakeEl : origGet.call(document, id); };
tplTreinoHome = function(){ throw new Error("falha simulada"); };
var errSaved = console.error; console.error = function(){};
renderAlunoTab({id: "e", name: "E", workoutLogs: [], meals: [], weights: []});
console.error = errSaved; tplTreinoHome = saved; document.getElementById = origGet; APP_MODE = APP_MODE_SAVED;
check.check("6. Se o erro persiste, o cartão oferece «Apagar o rascunho local» e diz que os treinos guardados e os por enviar não são tocados", /id="tabErrorReset"/.test(fakeEl.innerHTML) && /Continua a falhar\?/.test(fakeEl.innerHTML) && /não são tocados/.test(fakeEl.innerHTML));

// ---- Chromium ----
var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){ console.log("(ignorado o ecrã: Playwright/Chromium não disponíveis aqui)"); check.summarize(); }
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");
function rowAna(){
  authRole = "professional";
  var s = buildFullDemoStudent(); s.id = "ana"; s.name = "Ana Treina"; s.isDemo = false; s.active = true; s.photos = []; s.nutritionPhase = null;
  var day = s.trainingProgram.days[0], r = JSON.parse(JSON.stringify(studentToRow(s)));
  r.workout_logs = [0, 1].map(function(i){ return {id: "h" + i, date: iso(2 + i * 7), dayId: day.id, dayName: day.name, rpe: 7, notes: "", entries: day.exercises.map(function(e){ return {exerciseId: e.id, name: e.name, sets: [{reps: 8, load: 40 + i}]}; })}; });
  authRole = "student";
  return r;
}
(async function(){
  var srv = await startStaticServer(path.join(__dirname, ".."));
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  var CASES = {
    "rascunho = número": {evolve_wl_draft_v1: "42"}, "rascunho = texto": {evolve_wl_draft_v1: "\"abc\""}, "rascunho com séries = texto": {evolve_wl_draft_v1: JSON.stringify({"ana|x": {savedAt: Date.now(), sets: "x", rpe: "y", notes: 5}})},
    "fila = {ana: texto}": {evolve_outbox_v1: JSON.stringify({ana: "x"})}, "fila = cols nulo": {evolve_outbox_v1: JSON.stringify({ana: {cols: null}})}, "fila = treinos em texto": {evolve_outbox_v1: JSON.stringify({ana: {cols: {workout_logs: "x"}, ts: 1}})},
    "por enviar = texto": {evolve_wl_unsent_v1: "\"abc\""}, "conforto = número": {evolve_wl_comfort_v1: "42"}
  };
  var names = Object.keys(CASES), okAll = [], bad = [];
  for (var n of names){
    var ctx = await browser.newContext({viewport: {width: 390, height: 844}});
    await ctx.addInitScript(function(kv){ for (var k in kv){ try { localStorage.setItem(k, kv[k]); } catch (e) {} } }, CASES[n]);
    await ctx.addInitScript(fakeSource({role: "student", userId: "user-ana", email: "ana@x.test", rows: [rowAna()]}));
    var pg = await ctx.newPage(); pg.setDefaultTimeout(6000); var errs = []; pg.on("pageerror", function(e){ errs.push(e.message); });
    try {
      await pg.goto(srv.url + "treino.html"); await pg.waitForSelector("#startWorkout");
      await pg.locator("#startWorkout").click(); await pg.waitForSelector("#wlDock"); await pg.locator("#wlDockBtn").click();
      await pg.locator('.tabbar [data-tab="hoje"]').click(); await pg.waitForSelector("#openHistorico");
      if (errs.length) throw new Error(errs[0]);
      okAll.push(n);
    } catch (e) { bad.push(n + ": " + String(e.message).split("\n")[0].slice(0, 60)); }
    await ctx.close();
  }
  check.check("7. Com dados estragados no armazenamento (" + names.length + " casos: rascunho, fila de envio, por enviar, conforto) a app abre, o treino arranca e o histórico abre" + (bad.length ? " — falhou: " + bad.join(" | ") : ""), bad.length === 0);

  // offline de ponta a ponta com o service worker
  var ctx2 = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: "allow"});
  await ctx2.addInitScript(fakeSource({role: "student", userId: "user-ana", email: "ana@x.test", rows: [rowAna()]}));
  var pg2 = await ctx2.newPage(); pg2.setDefaultTimeout(9000); pg2.on("pageerror", function(e){ errors.push(e.message); });
  var failed = []; pg2.on("requestfailed", function(r){ if (!/supabase/.test(r.url())) failed.push(r.url()); });
  await pg2.goto(srv.url + "treino.html"); await pg2.waitForSelector("#startWorkout");
  await pg2.evaluate(function(){ return navigator.serviceWorker.ready; });
  await pg2.waitForFunction(async function(){ var ks = await caches.keys(); for (var k of ks){ var c = await caches.open(k); var u = (await c.keys()).map(function(r){ return new URL(r.url).pathname; }); if (u.indexOf("/treino.html") >= 0 && u.indexOf("/app.js") >= 0 && u.indexOf("/app.css") >= 0) return true; } return false; }, null, {timeout: 15000});
  await ctx2.setOffline(true); failed.length = 0;
  await pg2.reload(); await pg2.waitForSelector("#startWorkout");
  check.check("8. Sem rede, depois de a app ter sido aberta uma vez, ela abre a partir do service worker (sem pedidos falhados)", failed.length === 0);
  await pg2.locator("#startWorkout").click(); await pg2.waitForSelector("#wlDock"); await pg2.locator("#wlDockBtn").click(); await pg2.waitForTimeout(250);
  await pg2.locator("#wlSave").click(); var yes = pg2.locator("#wlFinishYes"); if (await yes.count()) await yes.click();
  await pg2.waitForSelector("#syncLine");
  await pg2.waitForFunction(function(){ var e = document.getElementById("syncLine"); return e && /Sem ligação: 1 treino guardado/.test(e.innerText); });
  check.check("9. Sem rede, terminar o treino fica guardado no telemóvel e a linha de estado diz «Sem ligação: 1 treino guardado neste telemóvel»", true);
  await pg2.reload(); await pg2.waitForSelector("#openHistorico");
  await pg2.locator("#openHistorico").click(); await pg2.waitForSelector("#histList");
  check.check("10. Depois de recarregar ainda sem rede, o treino continua no histórico (3 treinos) com a marca «por enviar»", (await pg2.locator(".hist-row").count()) === 3 && (await pg2.locator(".hist-badge").count()) === 1);
  await ctx2.setOffline(false); await pg2.evaluate(function(){ window.dispatchEvent(new Event("online")); });
  await pg2.waitForFunction(function(){ return window.__fake.rows[0].workout_logs.length === 3; }, null, {timeout: 12000});
  check.check("11. Ao voltar a rede o treino segue sozinho para o servidor (3 treinos), sem duplicar", (await pg2.evaluate(function(){ return window.__fake.rows[0].workout_logs.length; })) === 3);
  await ctx2.close();

  check.check("12. Sem erros de JavaScript" + (errors.length ? " — " + errors.join(" | ") : ""), errors.length === 0);
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção " + (e && e.message)); process.exit(1); });
