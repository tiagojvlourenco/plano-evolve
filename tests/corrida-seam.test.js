// Costura da Corrida no núcleo da app (app.js): o que o núcleo faz SEM o módulo (corrida-core.js + corrida.js, carregados à parte).
// Parte 1 (Node): rowToStudent (runs_mode), as chaves locais e runPendingCount/runWipeLocal (outro utilizador, JSON mau, localStorage a falhar),
//   o cartão «ainda não está ativa», o aviso ao sair da conta, o tamanho de app.js.
// Parte 2 (Chromium com Supabase simulado): o módulo é de MENTIRA (servido por Playwright route, só dentro deste teste): off/sem coluna não pede nada,
//   import pede os dois ficheiros uma vez, falha dá «Tentar outra vez», sair da conta, envio da fila só com o módulo carregável, separador do profissional.
// O que este teste NÃO prova: o módulo real (ecrãs, GPS, importação, fila de envio) — tem os seus próprios testes — nem o Supabase real.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var fs = require("fs"), path = require("path");
var root = path.join(__dirname, "..");
function read(f){ return fs.readFileSync(path.join(root, f), "utf8"); }
var appJs = read("app.js");

// ---------------------------------------------------------------- Parte 1 (Node)
// 1. rowToStudent
var withCol = rowToStudent({id: "a", name: "Ana", runs_mode: "import"}), noCol = rowToStudent({id: "b", name: "Bia"}), nullCol = rowToStudent({id: "c", name: "Cris", runs_mode: null});
check.check("1. rowToStudent: com runs_mode na linha a coluna existe e o modo vem do servidor", withCol.runsColumn === true && withCol.runsMode === "import");
check.check("2. rowToStudent: sem runs_mode na linha (migração por aplicar) runsColumn é falso e o modo é «off»; com null a coluna existe e o modo é «off»", noCol.runsColumn === false && noCol.runsMode === "off" && nullCol.runsColumn === true && nullCol.runsMode === "off");
authRole = "professional";
var demo = buildFullDemoStudent(); demo.runsColumn = true; demo.runsMode = "live";
var rowOut = studentToRow(demo);
check.check("3. studentToRow não escreve runs_mode (só o profissional a grava, por update direto a partir do módulo)", !("runs_mode" in rowOut) && !("runsMode" in rowOut) && !("runsColumn" in rowOut));
check.check("4. corridaModeOf: só import/live com a coluna contam; sem coluna, valor estranho ou aluno em falta é «off»",
  corridaModeOf(withCol) === "import" && corridaModeOf({runsColumn: true, runsMode: "live"}) === "live" && corridaModeOf({runsColumn: false, runsMode: "live"}) === "off" &&
  corridaModeOf({runsColumn: true, runsMode: "native"}) === "off" && corridaModeOf({runsColumn: true, runsMode: "off"}) === "off" && corridaModeOf(null) === "off" && corridaModeOf(noCol) === "off");

// 2. chaves e contagem sem carregar o módulo
check.check("5. As chaves locais da Corrida são as combinadas (rascunho e fila de envio)", RUN_DRAFT_KEY === "evolve_run_draft_v1" && RUN_OUTBOX_KEY === "evolve_runs_outbox_v1");
function memStore(init){
  var d = Object.assign({}, init || {});
  return {getItem: function(k){ return k in d ? d[k] : null; }, setItem: function(k, v){ d[k] = String(v); }, removeItem: function(k){ delete d[k]; }, _d: d};
}
function useStore(st){ Object.defineProperty(global, "localStorage", {value: st, configurable: true, writable: true}); }
function throwingStore(){ Object.defineProperty(global, "localStorage", {get: function(){ throw new Error("SecurityError"); }, configurable: true}); }
var J = JSON.stringify;
currentAuthUserId = "u1";
useStore(memStore({}));
check.check("6. Sem nada guardado há 0 corridas pendentes", runPendingCount() === 0);
useStore(memStore({[RUN_DRAFT_KEY]: J({uid: "u1", segs: []})}));
check.check("7. Um rascunho do utilizador atual conta 1", runPendingCount() === 1);
useStore(memStore({[RUN_DRAFT_KEY]: J({uid: "u2", segs: []}), [RUN_OUTBOX_KEY]: J([{id: "r1", uid: "u2"}])}));
check.check("8. Rascunho e fila de OUTRO utilizador não contam (ignoram-se)", runPendingCount() === 0);
useStore(memStore({[RUN_DRAFT_KEY]: J({uid: "u1"}), [RUN_OUTBOX_KEY]: J([{id: "r1", uid: "u1"}, {id: "r2", uid: "u2"}, {id: "r3", uid: "u1"}, null, 5, "x", {id: "r4"}, []])}));
check.check("9. Conta a fila só do utilizador atual (2) mais o rascunho (1); entradas sem uid ou que não são objetos não contam", runPendingCount() === 3);
useStore(memStore({[RUN_OUTBOX_KEY]: J({items: [{id: "r1", uid: "u1"}, {id: "r2", uid: "u1"}]})}));
check.check("10. Aceita também a fila dentro de {items: [...]}", runPendingCount() === 2);
useStore(memStore({[RUN_DRAFT_KEY]: "{isto não é json", [RUN_OUTBOX_KEY]: "[{"}));
check.check("11. JSON inválido conta 0 e não lança", runPendingCount() === 0);
useStore(memStore({[RUN_DRAFT_KEY]: "5", [RUN_OUTBOX_KEY]: "\"texto\""}));
check.check("12. JSON válido mas de outra forma (número, texto) conta 0", runPendingCount() === 0);
useStore(memStore({[RUN_DRAFT_KEY]: "null", [RUN_OUTBOX_KEY]: "{\"uid\":\"u1\"}"}));
check.check("13. null e um objeto solto na fila contam 0", runPendingCount() === 0);
var good = {[RUN_DRAFT_KEY]: J({uid: "u1"}), [RUN_OUTBOX_KEY]: J([{id: "r1", uid: "u1"}])};
var brokenGet = memStore(good); brokenGet.getItem = function(){ throw new Error("QuotaExceeded"); };
useStore(brokenGet);
check.check("14. localStorage.getItem a lançar erro conta 0 e não lança", runPendingCount() === 0);
throwingStore();
var threw = false, n14 = -1; try { n14 = runPendingCount(); } catch (e) { threw = true; }
check.check("15. localStorage inacessível (o próprio acesso lança) conta 0 e não lança", !threw && n14 === 0);
Object.defineProperty(global, "localStorage", {value: undefined, configurable: true, writable: true});
threw = false; try { n14 = runPendingCount(); } catch (e) { threw = true; }
check.check("16. Sem localStorage nenhum conta 0 e não lança", !threw && n14 === 0);
useStore(memStore(good)); currentAuthUserId = null;
check.check("17. Sem sessão (sem uid) nada conta, mesmo com chaves guardadas", runPendingCount() === 0);
currentAuthUserId = "u1";
var st18 = memStore(Object.assign({other: "fica"}, good)); useStore(st18);
runWipeLocal();
check.check("18. runWipeLocal apaga as duas chaves e só essas", !(RUN_DRAFT_KEY in st18._d) && !(RUN_OUTBOX_KEY in st18._d) && st18._d.other === "fica");
var st19 = memStore(good), realRemove = st19.removeItem; st19.removeItem = function(k){ if (k === RUN_DRAFT_KEY) throw new Error("boom"); realRemove(k); }; useStore(st19);
threw = false; try { runWipeLocal(); } catch (e) { threw = true; }
check.check("19. runWipeLocal tolera uma remoção a falhar e apaga a outra chave na mesma", !threw && !(RUN_OUTBOX_KEY in st19._d));
throwingStore();
threw = false; try { runWipeLocal(); } catch (e) { threw = true; }
check.check("20. runWipeLocal tolera o localStorage inacessível", !threw);

// 3. cartão «ainda não está ativa»: nada é pedido
var fetches = [];
global.fetch = function(u){ fetches.push(String(u)); return Promise.reject(new Error("sem rede nos testes")); };
var cardOff = tplCorridaTab(studentView(noCol), noCol), cardOff2 = tplCorridaTab(studentView(rowToStudent({id: "d", name: "Dani", runs_mode: "off"})), rowToStudent({id: "d", name: "Dani", runs_mode: "off"}));
check.check("21. Corrida desligada ou sem coluna: cartão «A Corrida ainda não está ativa para ti. O teu treinador liga-a quando for altura.», sem botões e sem pedir os ficheiros",
  [cardOff, cardOff2].every(function(h){ return h.indexOf("A Corrida ainda não está ativa para ti. O teu treinador liga-a quando for altura.") >= 0 && h.indexOf("<button") < 0; }) && fetches.length === 0);

// 4. aviso ao sair da conta (mensagens e o que se apaga), com o resto da saída de conta simulado
var asked = [], answer = false;
window.confirm = function(m){ asked.push(m); return answer; };
var signedOut = 0;
sb = {auth: {signOut: function(){ signedOut++; return Promise.resolve({}); }}};
function tryOut(store, outboxMemValue, ans){
  useStore(store); outboxMem = outboxMemValue; asked = []; answer = ans; signedOut = 0;
  doSignOut();
  return {asked: asked.slice(), out: signedOut};
}
var nada = tryOut(memStore({}), {}, true);
check.check("22. Sair sem nada por enviar não pergunta nada", nada.asked.length === 0 && nada.out === 1);
var soAlt = tryOut(memStore({}), {x: {cols: {}, full: false}}, false);
check.check("23. Só alterações por enviar: a pergunta é a de sempre e «Cancelar» não sai", soAlt.asked.length === 1 && /alterações que ainda não foram enviadas/.test(soAlt.asked[0]) && !/corrida/.test(soAlt.asked[0]) && soAlt.out === 0);
var stRun = memStore(good);
var soRun = tryOut(stRun, {}, false);
check.check("24. Só uma corrida por terminar/enviar: pergunta antes («Há uma corrida por terminar ou por enviar neste telemóvel…»); «Cancelar» não sai nem apaga nada", soRun.asked.length === 1 && /^Há uma corrida por terminar ou por enviar neste telemóvel e perder-se-ia ao sair\. Sair mesmo assim\?$/.test(soRun.asked[0]) && soRun.out === 0 && RUN_DRAFT_KEY in stRun._d && RUN_OUTBOX_KEY in stRun._d);
var ambas = tryOut(memStore(good), {x: {cols: {}, full: false}}, false);
check.check("25. Alterações e corrida ao mesmo tempo: uma só pergunta que fala de ambas", ambas.asked.length === 1 && /alterações/.test(ambas.asked[0]) && /corrida/.test(ambas.asked[0]) && ambas.out === 0);
var resets = 0, savedRun = RUN;
RUN = {loaded: true, failed: false, reset: function(){ resets++; }};
var stOut = memStore(Object.assign({other: "fica"}, good));
var sai = tryOut(stOut, {}, true);
check.check("26. Confirmando, sai, apaga o rascunho e a fila de corridas (e só essas chaves) e pede ao módulo (RUN.reset) para parar o GPS", sai.asked.length === 1 && sai.out === 1 && !(RUN_DRAFT_KEY in stOut._d) && !(RUN_OUTBOX_KEY in stOut._d) && stOut._d.other === "fica" && resets === 1);
RUN = {loaded: true, failed: false, reset: function(){ throw new Error("falhou"); }};
var stOut2 = memStore(good), s2 = tryOut(stOut2, {}, true);
check.check("27. Um RUN.reset a falhar não impede a saída nem a limpeza", s2.out === 1 && !(RUN_DRAFT_KEY in stOut2._d));
RUN = {loaded: false, failed: false};
var stOut3 = memStore({[RUN_DRAFT_KEY]: J({uid: "u2"}), [RUN_OUTBOX_KEY]: J([{id: "r", uid: "u2"}])}), s3 = tryOut(stOut3, {}, true);
check.check("28. Chaves de outra conta não fazem perguntar, mas saem na mesma (a fila e o rascunho são só desta sessão)", s3.asked.length === 0 && s3.out === 1 && !(RUN_DRAFT_KEY in stOut3._d) && !(RUN_OUTBOX_KEY in stOut3._d));
RUN = savedRun;

// 5. whenCorrida
var ran = 0, failedLoad = 0;
var realLoad = loadCorrida;
RUN = {loaded: true, failed: false};
var wcSync = whenCorrida(function(){ throw new Error("síncrono"); });
var wcAsync = whenCorrida(function(){ return Promise.reject(new Error("assíncrono")); });
var wcOk = whenCorrida(function(){ ran++; return 7; });
RUN = {loaded: false, failed: false};
check.check("29. whenCorrida devolve sempre uma Promise e engole os erros de fn (nunca rebenta quem a chama)", [wcSync, wcAsync, wcOk].every(function(p){ return p && typeof p.then === "function"; }));

// 6. estrutura
check.check("30. app.js continua abaixo de 1 100 000 bytes", Buffer.byteLength(appJs) < 1100000);
check.check("31. Ficha do profissional: o grupo «Treino» tem os separadores treino e corridas, e «Corridas» está nos PRO_TABS", PRO_NAV.filter(function(g){ return g.id === "treino"; })[0].tabs.join() === "treino,corridas" && PRO_TABS.some(function(t){ return t[0] === "corridas" && t[1] === "Corridas"; }));
check.check("32. O texto de apagar aluno inclui as corridas e os percursos", /as corridas e os percursos/.test(appJs));
check.check("33. O núcleo só lê as chaves da Corrida com os helpers (runStoredJson) e os nomes do módulo só aparecem através de RUN", (appJs.match(/evolve_run_draft_v1|evolve_runs_outbox_v1/g) || []).length === 2);

// ---------------------------------------------------------------- Parte 2 (Chromium)
var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){ console.log("(ignorado o ecrã: Playwright/Chromium não disponíveis aqui)"); check.summarize(); }
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");

// o módulo de MENTIRA: o núcleo (corrida-core.js) define uma função que o ecrã (corrida.js) usa — só funciona se os dois forem avaliados no mesmo eval
var FAKE_CORE = "function runFakeHelper(){ return 'núcleo-ok'; }\n";
var FAKE_MODULE = [
  "RUN.screen = function(sv){ window.__screens = (window.__screens || 0) + 1; return '<div class=\"card\" id=\"fakeRunScreen\" data-mode=\"' + escapeHtml(sv.runsMode) + '\">Corrida de ' + escapeHtml(sv.name) + ' · ' + escapeHtml(runFakeHelper()) + ' <button type=\"button\" id=\"fakeRunBtn\">ok</button></div>'; };",
  "RUN.wire = function(s, el){ window.__wired = (window.__wired || 0) + 1; var b = el.querySelector('#fakeRunBtn'); if (b) b.addEventListener('click', function(){ window.__clicks = (window.__clicks || 0) + 1; }); };",
  "RUN.proTab = function(s, el){ window.__proTab = (window.__proTab || 0) + 1; el.innerHTML = '<div id=\"fakeProTab\">Corridas de ' + escapeHtml(s.name) + ' · ' + escapeHtml(runFakeHelper()) + '</div>'; };",
  "RUN.flush = function(){ window.__flushCalls = (window.__flushCalls || 0) + 1; return Promise.resolve(true); };",
  "RUN.reset = function(){ window.__resetCalls = (window.__resetCalls || 0) + 1; };",
  "RUN.loaded = true;"
].join("\n");

function row(id, name, runsMode){
  authRole = "professional";
  var s = buildFullDemoStudent(); s.id = id; s.name = name; s.isDemo = false; s.active = true; s.photos = [];
  s.nutritionPhase = null;
  var r = JSON.parse(JSON.stringify(studentToRow(s)));
  if (runsMode !== undefined) r.runs_mode = runsMode; // undefined = a coluna não existe (migração por aplicar)
  return r;
}

(async function(){
  var srv = await startStaticServer(root);
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  // abre uma página com o Supabase simulado; o módulo de mentira é servido por route (core/module podem falhar: ctl.coreStatus / ctl.moduleStatus)
  async function open(role, rows, page, o){
    o = o || {};
    var ctl = {core: 0, module: 0, coreStatus: 200, moduleStatus: 200, dialogs: [], answer: true, external: []};
    var ctx = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: "block"}); // sem o service worker, o route() apanha todos os pedidos
    await ctx.addInitScript(fakeSource({role: role, userId: role === "professional" ? "pro-1" : "user-1", email: "ana@x.test", rows: rows}));
    if (o.seed) await ctx.addInitScript(function(seed){ try { Object.keys(seed).forEach(function(k){ localStorage.setItem(k, seed[k]); }); } catch (e) {} }, o.seed);
    await ctx.route(/\/corrida-core\.js(\?|$)/, function(route){ ctl.core++; if (ctl.coreStatus === 200) route.fulfill({status: 200, contentType: "text/javascript", body: FAKE_CORE}); else route.fulfill({status: ctl.coreStatus, body: "no"}); });
    await ctx.route(/\/corrida-live\.js(\?|$)/, function(route){ ctl.live = (ctl.live || 0) + 1; route.fulfill({status: 200, contentType: "text/javascript", body: "/* gravador de mentira */\n"}); });
    await ctx.route(/\/corrida\.js(\?|$)/, function(route){ ctl.module++; if (ctl.moduleStatus === 200) route.fulfill({status: 200, contentType: "text/javascript", body: FAKE_MODULE}); else route.fulfill({status: ctl.moduleStatus, body: "no"}); });
    var pg = await ctx.newPage(); pg.setDefaultTimeout(6000);
    pg.on("pageerror", function(e){ errors.push(e.message); });
    pg.on("dialog", function(d){ ctl.dialogs.push(d.message()); if (ctl.answer) d.accept(); else d.dismiss(); });
    pg.on("request", function(r){ if (!/^http:\/\/127\.0\.0\.1/.test(r.url()) && !/^(data|blob|about):/.test(r.url())) ctl.external.push(r.url()); });
    await pg.goto(srv.url + (page || ""));
    return {ctx: ctx, pg: pg, ctl: ctl};
  }
  var tabText = function(pg){ return pg.locator("#alunoTabContent").innerText(); };
  var goCorrida = async function(pg){ await pg.click('.tabbar [data-tab="corrida"]'); };
  var store = function(pg, keys){ return pg.evaluate(function(ks){ var o = {}; ks.forEach(function(k){ o[k] = localStorage.getItem(k); }); return o; }, keys || [RUN_DRAFT_KEY, RUN_OUTBOX_KEY]); };

  // A. sem a coluna (migração por aplicar) e com «off»: cartão, nada pedido
  for (var v = 0; v < 2; v++){
    var A = await open("student", [row("ana", "Ana Treina", v === 0 ? undefined : "off")], "treino.html");
    await A.pg.waitForSelector("#startWorkout");
    await goCorrida(A.pg);
    await A.pg.waitForSelector("#corridaOff");
    await A.pg.waitForTimeout(500);
    check.check((34 + v) + ". " + (v === 0 ? "Sem a coluna runs_mode" : "Com runs_mode «off»") + ": o separador Corrida mostra que ainda não está ativa, sem botões nem «Tentar outra vez», e não pede corrida.js nem corrida-core.js",
      /A Corrida ainda não está ativa para ti\. O teu treinador liga-a quando for altura\./.test(await tabText(A.pg)) && (await A.pg.locator("#alunoTabContent button").count()) === 0 && A.ctl.core === 0 && A.ctl.module === 0);
    await A.ctx.close();
  }

  // B. «import»: pede os dois ficheiros uma vez; o ecrã vem do módulo, avaliado junto com o núcleo; ligações feitas
  var B = await open("student", [row("ana", "Ana Treina", "import")], "treino.html");
  await B.pg.waitForSelector("#startWorkout");
  await B.pg.waitForTimeout(400);
  check.check("36. Com a Corrida ligada, só abrir a app não pede o módulo (carrega sob pedido)", B.ctl.core === 0 && B.ctl.module === 0);
  await goCorrida(B.pg);
  await B.pg.waitForSelector("#fakeRunScreen");
  check.check("37. «import»: pede corrida-core.js e corrida.js (uma vez cada) e mostra o ecrã do módulo, que usa o núcleo (mesmo eval)", B.ctl.core === 1 && B.ctl.module === 1 && /núcleo-ok/.test(await tabText(B.pg)) && (await B.pg.locator("#fakeRunScreen").getAttribute("data-mode")) === "import");
  await B.pg.click("#fakeRunBtn");
  check.check("38. O núcleo chama RUN.wire(s, el) depois de desenhar (o botão do módulo responde)", (await B.pg.evaluate(function(){ return window.__clicks; })) === 1);
  await B.pg.click('.tabbar [data-tab="hoje"]'); await B.pg.waitForSelector("#startWorkout");
  await goCorrida(B.pg); await B.pg.waitForSelector("#fakeRunScreen");
  await B.pg.click('.tabbar [data-tab="hoje"]'); await B.pg.waitForSelector("#startWorkout");
  await goCorrida(B.pg); await B.pg.waitForSelector("#fakeRunScreen");
  check.check("39. Voltar ao separador não volta a pedir os ficheiros (continuam a ser um pedido cada)", B.ctl.core === 1 && B.ctl.module === 1);
  var lsB = await store(B.pg);
  check.check("40. Abrir a Corrida não escreve nada nas chaves locais da Corrida e não contacta ninguém fora do site", lsB[RUN_DRAFT_KEY] === null && lsB[RUN_OUTBOX_KEY] === null && B.ctl.external.length === 0);
  await B.ctx.close();

  // C. falha ao carregar: aviso e «Tentar outra vez»
  var C = await open("student", [row("ana", "Ana Treina", "live")], "treino.html");
  C.ctl.moduleStatus = 503;
  await C.pg.waitForSelector("#startWorkout");
  await goCorrida(C.pg);
  await C.pg.waitForSelector("#corridaRetry");
  check.check("41. Sem corrida.js: «Não foi possível abrir a Corrida» e «Tentar outra vez»; o resto da app continua (separador Treino)", /Não foi possível abrir a Corrida/.test(await tabText(C.pg)) && /Tentar outra vez/i.test(await C.pg.locator("#corridaRetry").innerText()));
  await C.pg.click('.tabbar [data-tab="hoje"]'); await C.pg.waitForSelector("#startWorkout");
  check.check("42. Depois da falha o treino abre normalmente", (await C.pg.locator("#startWorkout").count()) === 1);
  var before = C.ctl.module;
  C.ctl.moduleStatus = 200;
  await goCorrida(C.pg);
  await C.pg.waitForSelector("#corridaRetry");
  await C.pg.click("#corridaRetry");
  await C.pg.waitForSelector("#fakeRunScreen");
  check.check("43. Com a ligação de volta, «Tentar outra vez» carrega o módulo e mostra o ecrã (modo live)", C.ctl.module === before + 1 && (await C.pg.locator("#fakeRunScreen").getAttribute("data-mode")) === "live");
  await C.ctx.close();

  // C2. o módulo carrega mas não define o que o ecrã precisa: tratado como falha, sem erro de JavaScript
  var C2 = await open("student", [row("ana", "Ana Treina", "import")], "treino.html");
  await C2.ctx.unroute(/\/corrida\.js(\?|$)/);
  await C2.ctx.route(/\/corrida\.js(\?|$)/, function(route){ C2.ctl.module++; route.fulfill({status: 200, contentType: "text/javascript", body: "RUN.loaded = true;"}); });
  await C2.pg.waitForSelector("#startWorkout");
  await goCorrida(C2.pg);
  await C2.pg.waitForSelector("#corridaRetry");
  check.check("44. Um módulo incompleto (sem RUN.screen) mostra «Tentar outra vez» em vez de rebentar", /Não foi possível abrir a Corrida/.test(await tabText(C2.pg)));
  await C2.ctx.close();

  // D. sair da conta
  var queued = JSON.stringify([{id: "11111111-1111-4111-8111-111111111111", uid: "user-1", ts: 1}, {id: "22222222-2222-4222-8222-222222222222", uid: "outro", ts: 2}]);
  var draft = JSON.stringify({uid: "user-1", segs: [], savedAt: 1});
  var seedRuns = {}; seedRuns[RUN_DRAFT_KEY] = draft; seedRuns[RUN_OUTBOX_KEY] = queued;
  var D = await open("student", [row("ana", "Ana Treina", "import")], "treino.html", {seed: seedRuns});
  await D.pg.waitForSelector("#startWorkout");
  await D.pg.waitForFunction(function(){ return window.__flushCalls >= 1; }); // o arranque enviou a fila (módulo carregado por causa disso)
  D.ctl.answer = false;
  await D.pg.evaluate(function(){ document.getElementById("signOutBtn").click(); });
  await D.pg.waitForTimeout(200);
  var lsD = await store(D.pg);
  check.check("45. Sair com corrida por enviar pergunta primeiro («Há uma corrida por terminar ou por enviar neste telemóvel…»); cancelar não apaga nada nem chama o módulo", D.ctl.dialogs.length === 1 && /Há uma corrida por terminar ou por enviar neste telemóvel/.test(D.ctl.dialogs[0]) && lsD[RUN_DRAFT_KEY] === draft && lsD[RUN_OUTBOX_KEY] === queued && !(await D.pg.evaluate(function(){ return window.__resetCalls; })));
  D.ctl.answer = true;
  await D.pg.evaluate(function(){ document.getElementById("signOutBtn").click(); });
  await D.pg.waitForTimeout(300);
  lsD = await store(D.pg);
  check.check("46. Confirmando, o rascunho e a fila de corridas são apagados e o módulo é avisado (RUN.reset)", D.ctl.dialogs.length === 2 && lsD[RUN_DRAFT_KEY] === null && lsD[RUN_OUTBOX_KEY] === null && (await D.pg.evaluate(function(){ return window.__resetCalls; })) === 1);
  await D.ctx.close();

  // D2. nada pendente / pendente de outra conta: sai sem perguntar
  var other = {}; other[RUN_DRAFT_KEY] = JSON.stringify({uid: "outro"}); other[RUN_OUTBOX_KEY] = JSON.stringify([{id: "x", uid: "outro"}]);
  var D2 = await open("student", [row("ana", "Ana Treina", "import")], "treino.html", {seed: other});
  await D2.pg.waitForSelector("#startWorkout");
  await D2.pg.waitForTimeout(400);
  check.check("47. Corrida pendente de OUTRA conta não carrega o módulo no arranque", D2.ctl.core === 0 && D2.ctl.module === 0);
  await D2.pg.evaluate(function(){ document.getElementById("signOutBtn").click(); });
  await D2.pg.waitForTimeout(300);
  var lsD2 = await store(D2.pg);
  check.check("48. Sair com pendentes de outra conta não pergunta nada, mas apaga as chaves", D2.ctl.dialogs.length === 0 && lsD2[RUN_DRAFT_KEY] === null && lsD2[RUN_OUTBOX_KEY] === null);
  await D2.ctx.close();

  // D3. localStorage da Corrida a lançar erro: sair não rebenta
  var D3 = await open("student", [row("ana", "Ana Treina", "import")], "treino.html");
  await D3.pg.waitForSelector("#startWorkout");
  await D3.pg.evaluate(function(){ var g = Storage.prototype.getItem; Storage.prototype.getItem = function(k){ if (/^evolve_run/.test(k)) throw new Error("SecurityError"); return g.call(this, k); }; });
  await D3.pg.evaluate(function(){ document.getElementById("signOutBtn").click(); });
  await D3.pg.waitForTimeout(300);
  check.check("49. Com o armazenamento da Corrida a falhar, sair da conta não pergunta, não lança e termina a saída (volta ao ecrã de entrada)", D3.ctl.dialogs.length === 0 && (await D3.pg.locator("#authScreen:not(.hidden)").count()) === 1);
  await D3.ctx.close();

  // E. envio da fila (outboxFlush): só com o módulo carregável
  var seedQ = {}; seedQ[RUN_OUTBOX_KEY] = queued;
  var E0 = await open("student", [row("ana", "Ana Treina", "import")], "treino.html");
  await E0.pg.waitForSelector("#startWorkout"); await E0.pg.waitForTimeout(600);
  await E0.pg.evaluate(function(){ document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("online")); });
  await E0.pg.waitForTimeout(300);
  check.check("50. Sem corridas na fila, abrir a app, voltar a ela ou ficar online nunca pede o módulo", E0.ctl.core === 0 && E0.ctl.module === 0);
  await E0.ctx.close();
  var E1 = await open("student", [row("ana", "Ana Treina", "import")], "treino.html", {seed: seedQ});
  await E1.pg.waitForFunction(function(){ return window.__flushCalls >= 1; });
  check.check("51. Com uma corrida na fila (deste utilizador), o arranque carrega o módulo (uma vez) e chama RUN.flush()", E1.ctl.core === 1 && E1.ctl.module === 1 && (await E1.pg.evaluate(function(){ return window.__flushCalls; })) >= 1);
  var flushes = await E1.pg.evaluate(function(){ return window.__flushCalls; });
  await E1.pg.evaluate(function(){ window.dispatchEvent(new Event("online")); });
  await E1.pg.waitForFunction(function(n){ return window.__flushCalls > n; }, flushes);
  check.check("52. Ao voltar a haver ligação (evento online) volta a chamar RUN.flush() sem pedir os ficheiros de novo", E1.ctl.core === 1 && E1.ctl.module === 1);
  await E1.ctx.close();
  var E2 = await open("student", [row("ana", "Ana Treina", "import")], "treino.html", {seed: seedQ});
  E2.ctl.moduleStatus = 503;
  await E2.pg.waitForSelector("#startWorkout"); await E2.pg.waitForTimeout(700);
  check.check("53. Se o módulo não carregar, a fila fica como está, não há flush e a app continua sem avisos nem erros (a Corrida só avisa quando se abre o separador)", E2.ctl.module >= 1 && !(await E2.pg.evaluate(function(){ return window.__flushCalls; })) && (await E2.pg.locator("#startWorkout").count()) === 1 && (await store(E2.pg))[RUN_OUTBOX_KEY] === queued);
  await E2.ctx.close();
  var E3 = await open("student", [row("ana", "Ana Treina")], "index.html", {seed: seedQ});
  await E3.pg.waitForFunction(function(){ return window.__flushCalls >= 1; });
  check.check("54. Na app EVOLVE (index.html) também se envia a fila pendente deste utilizador, e não aparece nenhum separador Corrida", (await E3.pg.locator('.tabbar [data-tab="corrida"]').count()) === 0);
  await E3.ctx.close();

  // F. EVOLVE (index.html): o aluno não vê a Corrida nem pede o módulo
  var F = await open("student", [row("ana", "Ana Treina", "live")], "index.html");
  await F.pg.waitForSelector(".check-circle[data-circle]"); await F.pg.waitForTimeout(500);
  check.check("55. EVOLVE, aluno com a Corrida ligada: sem separador Corrida e sem pedir o módulo", (await F.pg.locator('.tabbar [data-tab="corrida"]').count()) === 0 && F.ctl.core === 0 && F.ctl.module === 0);
  await F.ctx.close();

  // G. profissional na app EVOLVE: separador «Corridas» da ficha
  var rowsG = [row("a", "Ana Silva", "import"), row("b", "Bruno Costa", "off")];
  var G = await open("professional", rowsG, "index.html");
  await G.pg.waitForSelector(".student-row");
  await G.pg.waitForTimeout(300);
  check.check("56. A lista de alunos do profissional não pede o módulo", G.ctl.core === 0 && G.ctl.module === 0);
  await G.pg.locator('[data-open="a"]').first().click();
  await G.pg.waitForSelector("#proBack");
  await G.pg.click('.pro-nav-item[data-g="treino"]');
  await G.pg.waitForSelector('[data-sub="corridas"]');
  var chips = (await G.pg.locator(".pro-subtabs").innerText()).replace(/\s+/g, " ");
  check.check("57. A ficha tem, no grupo «Treino», os separadores «Treino» e «Corridas»; ainda sem abrir «Corridas» nada foi pedido", /Treino/.test(chips) && /Corridas/.test(chips) && G.ctl.core === 0 && G.ctl.module === 0);
  await G.pg.click('[data-sub="corridas"]');
  await G.pg.waitForSelector("#fakeProTab");
  check.check("58. Abrir «Corridas» carrega o módulo (uma vez cada ficheiro) e chama RUN.proTab(s, el) com a ficha certa", G.ctl.core === 1 && G.ctl.module === 1 && /Corridas de Ana Silva · núcleo-ok/.test(await G.pg.locator("#proTabContent").innerText()));
  await G.pg.click('[data-sub="treino"]'); await G.pg.waitForTimeout(100);
  await G.pg.click('[data-sub="corridas"]'); await G.pg.waitForSelector("#fakeProTab");
  check.check("59. Voltar a «Corridas» não pede os ficheiros outra vez", G.ctl.core === 1 && G.ctl.module === 1 && (await G.pg.evaluate(function(){ return window.__proTab; })) === 2);
  await G.ctx.close();

  // G2. migração por aplicar: mensagem, nada pedido
  var G2 = await open("professional", [row("a", "Ana Silva"), row("b", "Bruno Costa")], "index.html");
  await G2.pg.waitForSelector(".student-row");
  await G2.pg.locator('[data-open="a"]').first().click();
  await G2.pg.waitForSelector("#proBack");
  await G2.pg.click('.pro-nav-item[data-g="treino"]');
  await G2.pg.click('[data-sub="corridas"]');
  await G2.pg.waitForSelector("#corridasMissing");
  var miss = await G2.pg.locator("#proTabContent").innerText();
  check.check("60. Sem a coluna runs_mode (migração por aplicar) o separador «Corridas» diz «Falta aplicar a migração 0032 no Supabase» e como, sem pedir o módulo", /Falta aplicar a migração 0032 no Supabase/.test(miss) && /SQL Editor/.test(miss) && /0032_corrida\.sql/.test(miss) && G2.ctl.core === 0 && G2.ctl.module === 0);
  await G2.ctx.close();

  // G3. o módulo falha na ficha do profissional
  var G3 = await open("professional", rowsG, "index.html");
  G3.ctl.moduleStatus = 503;
  await G3.pg.waitForSelector(".student-row");
  await G3.pg.locator('[data-open="a"]').first().click();
  await G3.pg.waitForSelector("#proBack");
  await G3.pg.click('.pro-nav-item[data-g="treino"]');
  await G3.pg.click('[data-sub="corridas"]');
  await G3.pg.waitForSelector("#corridasRetry");
  check.check("61. Se o módulo falhar, o separador «Corridas» avisa e oferece «Tentar outra vez» (o resto da ficha continua)", /Não foi possível abrir as Corridas/.test(await G3.pg.locator("#proTabContent").innerText()));
  G3.ctl.moduleStatus = 200;
  await G3.pg.click("#corridasRetry");
  await G3.pg.waitForSelector("#fakeProTab");
  check.check("62. «Tentar outra vez» carrega o módulo e mostra o separador", /Corridas de Ana Silva/.test(await G3.pg.locator("#proTabContent").innerText()));
  await G3.ctx.close();

  // H. o profissional a ver o ecrã do aluno em treino.html: o modo REAL de cada aluno
  var H = await open("professional", [row("a", "Ana Silva", "import"), row("b", "Bruno Costa", "off"), row("c", "Carla Reis")], "treino.html");
  await H.pg.waitForSelector("#alunoStudentSwitch");
  await goCorrida(H.pg);
  await H.pg.waitForSelector("#fakeRunScreen");
  var wired1 = await H.pg.evaluate(function(){ return window.__wired; });
  await H.pg.selectOption("#alunoStudentSwitch", "b");
  await H.pg.waitForSelector("#corridaOff");
  check.check("63. Pré-visualização do profissional: um aluno com a Corrida «off» vê o cartão (não o ecrã do módulo) e RUN.wire não é chamado", /ainda não está ativa/.test(await tabText(H.pg)) && (await H.pg.locator("#fakeRunScreen").count()) === 0 && (await H.pg.evaluate(function(){ return window.__wired; })) === wired1);
  await H.pg.selectOption("#alunoStudentSwitch", "c");
  await H.pg.waitForSelector("#corridaOff");
  check.check("64. O aluno sem a coluna também vê o cartão", (await H.pg.locator("#fakeRunScreen").count()) === 0);
  await H.pg.selectOption("#alunoStudentSwitch", "a");
  await H.pg.waitForSelector("#fakeRunScreen");
  check.check("65. Voltando ao aluno com «import» vê o ecrã do módulo, sem novos pedidos dos ficheiros", H.ctl.core === 1 && H.ctl.module === 1 && (await H.pg.locator("#fakeRunScreen").getAttribute("data-mode")) === "import");
  await H.ctx.close();

  // I. apagar aluno: o texto fala das corridas
  var I = await open("professional", [row("a", "Ana Silva", "import")], "index.html");
  await I.pg.waitForSelector(".student-row");
  await I.pg.locator('[data-open="a"]').first().click();
  await I.pg.waitForSelector("#proBack");
  await I.pg.click('.pro-nav-item[data-g="resumo"]');
  if ((await I.pg.locator('[data-sub="perfil"]').count()) > 0) await I.pg.click('[data-sub="perfil"]');
  await I.pg.locator('summary:has-text("Apagar aluno")').click();
  await I.pg.click("#stuDeleteBtn");
  await I.pg.waitForSelector("#delCancel");
  check.check("66. O aviso de apagar aluno diz que apaga as corridas e os percursos (e continua a falar da ficha, das fotografias, dos pacotes e das cobranças)", /as corridas e os percursos/.test(await I.pg.locator(".modal-sheet").innerText()) && /a ficha, as fotografias, os pacotes, as cobranças/.test(await I.pg.locator(".modal-sheet").innerText()));
  await I.ctx.close();

  // J. o Supabase simulado (tests/helpers/fake-supabase.js) reproduz o que a Corrida vai usar: o que os outros testes da Corrida assumem
  var J1 = await open("student", [row("ana", "Ana Treina", "import")], "index.html");
  await J1.pg.waitForSelector(".check-circle[data-circle]");
  var fk = await J1.pg.evaluate(async function(){
    var c = window.supabase.createClient(), out = {};
    var RID = "11111111-1111-4111-8111-111111111111", RID2 = "22222222-2222-4222-8222-222222222222";
    out.consent = await c.from("run_consents").insert({student_id: "ana", version: 1});
    out.consentDup = await c.from("run_consents").insert({student_id: "ana", version: 1});
    out.consentRow = (await c.from("run_consents").select("*").eq("student_id", "ana").maybeSingle()).data;
    out.ins1 = await c.from("runs").insert({id: RID, student_id: "ana", started_at: "2026-10-01T10:00:00Z", source: "gpx", duration_s: 1800, moving_s: 1790, distance_m: 5000, consent_v: 1, points: "nunca-deve-sair-na-lista"});
    out.insDup = await c.from("runs").insert({id: RID, student_id: "ana", started_at: "2026-10-01T10:00:00Z", source: "gpx", duration_s: 1800, moving_s: 1790, distance_m: 5000, consent_v: 1});
    out.ins2 = await c.from("runs").insert({id: RID2, student_id: "ana", started_at: "2026-10-05T10:00:00Z", source: "manual", duration_s: 900, moving_s: 900, distance_m: 2000, consent_v: 1});
    out.trk = await c.from("run_tracks").insert({run_id: RID, student_id: "ana", fmt: 1, trim_m: 200, points: [[[38.7, -9.1, 0], [38.71, -9.1, 60]]]});
    out.trkDup = await c.from("run_tracks").insert({run_id: RID, student_id: "ana", fmt: 1, trim_m: 200, points: [[[38.7, -9.1, 0]]]});
    out.runRow = out.ins1.data && out.ins1.data[0];
    out.listLight = (await c.from("runs").select("id, started_at, distance_m").eq("student_id", "ana")).data;
    out.listGte = (await c.from("runs").select("*").eq("student_id", "ana").gte("started_at", "2026-10-03T00:00:00Z")).data;
    out.listRange = (await c.from("runs").select("id").eq("student_id", "ana").range(0, 0)).data;
    out.listOther = (await c.from("runs").select("id").eq("student_id", "outro")).data;
    out.one = (await c.from("run_tracks").select("*").eq("run_id", RID).maybeSingle()).data;
    out.none = (await c.from("run_tracks").select("*").eq("run_id", RID2).maybeSingle());
    out.cols = window.__fake.selectCols.filter(function(x){ return x.table === "runs"; }).map(function(x){ return x.cols; });
    out.delRun = await c.from("runs").delete().eq("id", RID);
    out.afterDelRun = {runs: window.__fake.tables.runs.length, tracks: window.__fake.tables.run_tracks.length};
    await c.from("run_tracks").insert({run_id: RID2, student_id: "ana", fmt: 1, trim_m: 0, points: [[[38.7, -9.1, 0]]]});
    out.delConsent = await c.from("run_consents").delete().eq("student_id", "ana").eq("version", 1);
    out.afterDelConsent = {runs: window.__fake.tables.runs.length, tracks: window.__fake.tables.run_tracks.length, consents: window.__fake.tables.run_consents.length};
    out.studentSel = (await c.from("students").select("*")).data.map(function(r){ return r.runs_mode; });
    out.studentUpd = await c.from("students").update({runs_mode: "live"}).eq("id", "ana");
    out.studentAfter = window.__fake.rows[0].runs_mode;
    return out;
  });
  check.check("67. Simulado: inserir corrida, percurso e consentimento funciona; repetir o id (corrida/percurso) ou a chave (consentimento) dá 23505", !fk.consent.error && fk.consentDup.error && fk.consentDup.error.code === "23505" && !fk.ins1.error && fk.insDup.error && fk.insDup.error.code === "23505" && !fk.trk.error && fk.trkDup.error && fk.trkDup.error.code === "23505");
  check.check("68. Simulado: o servidor põe a data de criação/aceitação e o autor (não o telemóvel)", !!fk.runRow.created_at && fk.runRow.created_by === "user-1" && !!fk.consentRow.accepted_at && fk.consentRow.version === 1);
  check.check("69. Simulado: select com eq/gte/range/maybeSingle; só as colunas pedidas (a lista leve nunca traz o percurso/points); maybeSingle sem linha dá null", fk.listLight.length === 2 && fk.listLight.every(function(r){ return !("points" in r) && !("notes" in r) && "id" in r; }) && fk.listGte.length === 1 && fk.listGte[0].source === "manual" && fk.listRange.length === 1 && fk.listOther.length === 0 && fk.one.run_id && fk.none.data === null && fk.cols.indexOf("id, started_at, distance_m") >= 0);
  check.check("70. Simulado: apagar uma corrida apaga o percurso dela; apagar o consentimento apaga as corridas e os percursos dessa versão", fk.delRun.status === 204 && fk.afterDelRun.runs === 1 && fk.afterDelRun.tracks === 0 && fk.afterDelConsent.runs === 0 && fk.afterDelConsent.tracks === 0 && fk.afterDelConsent.consents === 0);
  check.check("71. Simulado: o select(\"*\") de students devolve runs_mode quando a fixture o tem; o aluno NÃO consegue alterá-lo (como o gatilho do servidor)", fk.studentSel[0] === "import" && fk.studentUpd.error && fk.studentUpd.error.code === "P0001" && fk.studentAfter === "import");
  await J1.ctx.close();

  var J2 = await open("professional", [row("a", "Ana Silva", "off"), row("b", "Bruno Costa")], "index.html");
  await J2.pg.waitForSelector(".student-row");
  var fp = await J2.pg.evaluate(async function(){
    var c = window.supabase.createClient(), out = {};
    var before = (await c.from("students").select("*")).data;
    out.keys = before.map(function(r){ return "runs_mode" in r; });
    out.upd = await c.from("students").update({runs_mode: "import"}).eq("id", "a");
    out.after = (await c.from("students").select("*").eq("id", "a").maybeSingle()).data.runs_mode;
    await c.from("run_consents").insert({student_id: "a", version: 1});
    await c.from("runs").insert({id: "33333333-3333-4333-8333-333333333333", student_id: "a", started_at: "2026-10-01T10:00:00Z", source: "gpx", duration_s: 60, moving_s: 60, distance_m: 100, consent_v: 1});
    await c.from("run_tracks").insert({run_id: "33333333-3333-4333-8333-333333333333", student_id: "a", points: [[[1, 1, 0]]]});
    await c.from("students").delete().eq("id", "a");
    out.cascade = {runs: window.__fake.tables.runs.length, tracks: window.__fake.tables.run_tracks.length, consents: window.__fake.tables.run_consents.length, students: window.__fake.rows.length};
    window.__fake.missingTables = ["runs"];
    out.missRuns = (await c.from("runs").select("*")).error;
    out.okTracks = (await c.from("run_tracks").select("*")).error;
    out.okSessions = (await c.from("sessions").select("*")).error;
    window.__fake.missingTables = true;
    out.missAll = (await c.from("run_tracks").select("*")).error;
    return out;
  });
  check.check("72. Simulado: a coluna runs_mode é opcional por fixture (um aluno com, outro sem); o profissional altera-a por update e o select seguinte vê o novo modo", fp.keys.join() === "true,false" && !fp.upd.error && fp.after === "import");
  check.check("73. Simulado: apagar o aluno apaga as corridas, os percursos e os consentimentos dele", fp.cascade.runs === 0 && fp.cascade.tracks === 0 && fp.cascade.consents === 0 && fp.cascade.students === 1);
  check.check("74. Simulado: tabelas em falta por LISTA de nomes (só «runs» falha, o resto responde) e por true (todas)", fp.missRuns && fp.missRuns.code === "42P01" && !fp.okTracks && !fp.okSessions && fp.missAll && fp.missAll.code === "42P01");
  await J2.ctx.close();

  // J3. opções do simulado: missingTables como lista no arranque, código PGRST205, e as regras de INSERT do servidor (runsRls)
  var ctxJ = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: "block"});
  await ctxJ.addInitScript(fakeSource({role: "student", userId: "user-1", email: "ana@x.test", rows: [row("ana", "Ana Treina", "import"), row("off1", "Sem Corrida", "off")], missingTables: ["run_tracks"], missingTableCode: "PGRST205", runsRls: true}));
  var pgJ = await ctxJ.newPage(); pgJ.setDefaultTimeout(6000); pgJ.on("pageerror", function(e){ errors.push(e.message); });
  await pgJ.goto(srv.url + "index.html");
  await pgJ.waitForSelector(".check-circle[data-circle]");
  var fr = await pgJ.evaluate(async function(){
    var c = window.supabase.createClient(), out = {}, base = {started_at: "2026-10-01T10:00:00Z", source: "gpx", duration_s: 60, moving_s: 60, distance_m: 100};
    out.miss = (await c.from("run_tracks").select("*")).error;
    out.noConsent = (await c.from("runs").insert(Object.assign({id: "44444444-4444-4444-8444-444444444441", student_id: "ana", consent_v: 1}, base))).error;
    await c.from("run_consents").insert({student_id: "ana", version: 1});
    await c.from("run_consents").insert({student_id: "off1", version: 1});
    out.okImport = (await c.from("runs").insert(Object.assign({id: "44444444-4444-4444-8444-444444444442", student_id: "ana", consent_v: 1}, base))).error;
    out.liveOnImport = (await c.from("runs").insert(Object.assign({id: "44444444-4444-4444-8444-444444444443", student_id: "ana", consent_v: 1}, base, {source: "live"}))).error;
    out.modeOff = (await c.from("runs").insert(Object.assign({id: "44444444-4444-4444-8444-444444444444", student_id: "off1", consent_v: 1}, base))).error;
    out.wrongVersion = (await c.from("runs").insert(Object.assign({id: "44444444-4444-4444-8444-444444444445", student_id: "ana", consent_v: 2}, base))).error;
    out.rows = window.__fake.tables.runs.length;
    return out;
  });
  check.check("75. Simulado: missingTableCode «PGRST205» e missingTables em lista logo no arranque", fr.miss && fr.miss.code === "PGRST205" && /schema cache/.test(fr.miss.message));
  check.check("76. Simulado com runsRls: sem consentimento, com a Corrida «off», «live» só com o modo live e consentimento de outra versão são recusados (42501); import com consentimento passa", fr.noConsent && fr.noConsent.code === "42501" && !fr.okImport && fr.liveOnImport && fr.liveOnImport.code === "42501" && fr.modeOff && fr.modeOff.code === "42501" && fr.wrongVersion && fr.wrongVersion.code === "42501" && fr.rows === 1);
  await ctxJ.close();

  check.check("77. Nenhum erro de JavaScript em nenhuma página", errors.length === 0 || (console.log(errors), false));
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", String(e && e.stack || e).split("\n").slice(0, 4).join(" | ")); process.exit(1); });
