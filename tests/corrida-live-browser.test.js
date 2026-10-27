// Corrida ao vivo (corrida-live.js) no Chromium, com o Supabase simulado e um adaptador de GPS INJETADO (séries sintéticas e determinísticas).
// Parte A: com um corrida.js de MENTIRA servido por Playwright (só dentro deste teste) que cumpre o contrato mínimo (RUN.go, RUN.screen, RUN.wire, RUN.saveFlow,
//   RUN.submitRun, RUN.ensureConsent): a vista ao vivo inteira, o rascunho, a retoma depois de recarregar, a fila offline→online, sair da conta, o bloqueio de toques.
// Parte B: se existir o corrida.js REAL, os mesmos caminhos principais com ele (ecrã de guardar e consentimento verdadeiros).
// Relógio: Date.now() ganha um desvio que o teste avança à mão (sem esperar); os temporizadores do gravador correm em tempo real, com o relógio a 150 ms.
// O que isto prova: o comportamento no Chromium do Playwright (o motor do Chrome/Android). NÃO prova NADA sobre o iPhone/Safari nem sobre um GPS real: não se sabe se
// com o ecrã bloqueado ou noutra aplicação as posições continuam a chegar (aqui o «ecrã oculto» é um evento simulado), nem se o Wake Lock funciona nos iPhones.
require("./setup")();
var fs = require("fs"), path = require("path");
var check = require("./check")();
var root = path.join(__dirname, "..");
var n = 0;
function ck(desc, cond){ n++; if (parseInt(desc, 10) !== n) console.log("AVISO: verificação numerada " + parseInt(desc, 10) + " na posição " + n); check.check(desc, !!cond); }
function read(f){ return fs.readFileSync(path.join(root, f), "utf8"); }

var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){ console.log("(ignorado: Playwright/Chromium não disponíveis aqui)"); check.summarize(); }

var appSource = require("./extract-app")();
eval(appSource);
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");

var coreSrc = read("corrida-core.js"), liveSrc = read("corrida-live.js");
var C = (function(){
  var names = [], m, re = /^(?:function\s+(\w+)|var\s+(\w+))/gm;
  while ((m = re.exec(coreSrc))) names.push(m[1] || m[2]);
  return (function(){ "use strict"; return eval(coreSrc + "\n;({" + names.map(function(x){ return x + ": " + x; }).join(", ") + "})"); })();
})();
var HAS_REAL_UI = fs.existsSync(path.join(root, "corrida.js"));
var RID1 = "11111111-1111-4111-8111-111111111111", RID2 = "22222222-2222-4222-8222-222222222222";
var LAT0 = 38.7, LON0 = -9.1;

function row(id, name, runsMode){
  authRole = "professional";
  var s = buildFullDemoStudent(); s.id = id; s.name = name; s.isDemo = false; s.active = true; s.photos = [];
  s.nutritionPhase = null;
  var r = JSON.parse(JSON.stringify(studentToRow(s)));
  if (runsMode !== undefined) r.runs_mode = runsMode;
  return r;
}

// ---------------------------------------------------------------- o que corre DENTRO da página
// 1) antes de tudo: relógio com desvio, Wake Lock, visibilidade e o adaptador de GPS injetável
function pageStubs(){
  window.__off = 0;
  var realNow = Date.now;
  Date.now = function(){ return realNow.call(Date) + window.__off; };
  window.__wl = {requests: 0, released: 0, deny: false, list: []};
  try {
    Object.defineProperty(navigator, "wakeLock", {configurable: true, value: {request: function(){
      window.__wl.requests++;
      if (window.__wl.deny) return Promise.reject(new Error("NotAllowedError"));
      var s = {released: false, _r: null, release: function(){ if (!s.released) { s.released = true; window.__wl.released++; if (s._r) s._r(); } return Promise.resolve(); }, addEventListener: function(t, f){ s._r = f; }};
      window.__wl.list.push(s);
      return Promise.resolve(s);
    }}});
  } catch (e) {}
  window.__vis = "visible";
  Object.defineProperty(document, "visibilityState", {configurable: true, get: function(){ return window.__vis; }});
  Object.defineProperty(document, "hidden", {configurable: true, get: function(){ return window.__vis === "hidden"; }});
  window.__setVis = function(v){ window.__vis = v; document.dispatchEvent(new Event("visibilitychange")); };
  window.addEventListener("pagehide", function(){ window.__vis = "hidden"; });   // como num navegador a sério: ao descarregar a página, o documento já está oculto
  window.__fakeGps = {starts: 0, stops: 0, onFix: null, onErr: null, start: function(a, b){ this.starts++; this.onFix = a; this.onErr = b; }, stop: function(){ this.stops++; this.onFix = null; this.onErr = null; }};
  window.__y = 0;
  // avança o relógio dtMs e entrega uma posição de quem corre para norte a v m/s
  window.__go = function(dtMs, v, acc){
    window.__off += dtMs; window.__y += v * dtMs / 1000;
    window.__fakeGps.onFix({lat: 38.7 + window.__y / 111194.93, lon: -9.1, acc: acc == null ? 5 : acc, t: Date.now(), speed: null});
  };
  window.__goN = function(n, dtMs, v, acc){ for (var i = 0; i < n; i++) window.__go(dtMs, v, acc); };
  window.__goLog = [];
  window.__consents = 0; window.__consentMode = "accept"; window.__saveFlows = []; window.__submits = [];
  window.__errors = [];
}
// 2) o corrida.js de MENTIRA (só o contrato mínimo); corre no mesmo eval que o núcleo e o gravador, por isso vê runBuildInsert, findStudent, sb...
function fakeUi(){
  RUN.consentVersion = function(){ return 1; };
  RUN.ensureConsent = function(s, cb){ window.__consents++; if (window.__consentMode === "refuse") return; cb(); };
  RUN.v = {name: "home"};
  RUN.go = function(name, params){
    var s = findStudent(state.alunoStudentId), k;
    RUN.v = {name: name};
    if (params) for (k in params) if (Object.prototype.hasOwnProperty.call(params, k)) RUN.v[k] = params[k];
    window.__goLog.push(name);
    if (s && APP_MODE === "treino" && state.alunoTab === "corrida") renderAlunoTab(s);
  };
  RUN.screen = function(sv){
    if (RUN.v.name === "live" && typeof RUN.liveScreen === "function") return RUN.liveScreen(sv);
    if (RUN.v.name === "save") return "<div class=\"card\" id=\"fakeSave\"><p id=\"fakeSaveInfo\">Confirma antes de guardar</p><button type=\"button\" class=\"btn\" id=\"fakeSaveShare\">Partilhar percurso</button><button type=\"button\" class=\"btn primary\" id=\"fakeSaveBtn\">Guardar</button><button type=\"button\" class=\"btn\" id=\"fakeSaveCancel\">Cancelar</button><p id=\"fakeSaveMsg\"></p></div>";
    return "<div id=\"fakeHome\"><button type=\"button\" class=\"btn\" id=\"fakeGoLive\">Gravar com GPS</button></div>" + (typeof RUN.liveDraftBanner === "function" ? RUN.liveDraftBanner(sv) : "");
  };
  RUN.wire = function(s, el){
    var b;
    if (RUN.v.name === "live") { RUN.liveWire(s, el); return; }
    if (RUN.v.name === "save") {
      var prep = RUN.v.prep;
      b = el.querySelector("#fakeSaveShare"); if (b) b.addEventListener("click", function(){ window.__share = !window.__share; b.textContent = window.__share ? "Partilha ligada" : "Partilhar percurso"; });
      b = el.querySelector("#fakeSaveCancel"); if (b) b.addEventListener("click", function(){ var to = prep.cancelView && prep.cancelView.name ? prep.cancelView.name : "home"; RUN.go(to); });
      b = el.querySelector("#fakeSaveBtn");
      if (b) b.addEventListener("click", function(){
        var st = prep.stats, run = {id: runUuid(), studentId: s.id, source: prep.source, startedAtMs: prep.startedAtMs, durationS: st.durationS, movingS: st.movingS, distM: st.distM,
          gaps: st.gaps, gapS: st.gapS, splitsS: st.splitsS, hiddenS: prep.hiddenS || 0, rpe: null, notes: "", consentV: RUN.consentVersion()};
        var rw = runBuildInsert(run, Date.now()), item = {row: rw, track: null}, tr;
        if (window.__share) { tr = runPrepareTrack(prep.segments, {trimM: 0}); if (tr) item.track = {segments: tr.segments, trimM: tr.trimM}; }
        RUN.submitRun(s, item).then(function(res){
          var msg = document.getElementById("fakeSaveMsg");
          if (!res || !res.ok) { if (msg) msg.textContent = (res && res.error) || "Não foi possível guardar."; return; }
          if (typeof prep.onSaved === "function") prep.onSaved(res);
          window.__saved = res;
          RUN.go("home");
        });
      });
      return;
    }
    b = el.querySelector("#fakeGoLive");
    if (b) b.addEventListener("click", function(){ RUN.ensureConsent(s, function(){ RUN.liveOpen(s); }); });
    if (typeof RUN.liveWireBanner === "function") RUN.liveWireBanner(s, el);
  };
  RUN.saveFlow = function(s, prep){
    window.__saveFlows.push({source: prep.source, stats: prep.stats, segments: prep.segments, hiddenS: prep.hiddenS, warnings: prep.warnings, fileDistM: prep.fileDistM, startedAtMs: prep.startedAtMs,
      cancelView: prep.cancelView, hasOnSaved: typeof prep.onSaved === "function"});
    RUN.go("save", {prep: prep});
  };
  RUN.submitRun = function(s, item){
    window.__submits.push(item.row.id);
    function cls(res){ var e = res && res.error; if (!e) return "ok"; if (e.code === "23505") return "dup"; return outboxErrorIsTransient(res) ? "net" : "perm"; }
    return Promise.resolve(sb.from("runs").insert(item.row)).then(function(r1){
      var k = cls(r1);
      if (k === "net") { if (typeof RUN.queueAdd === "function" && RUN.queueAdd(item)) return {ok: true, queued: true}; return {ok: false, error: "Sem ligação.", permanent: false}; }
      if (k === "perm") return {ok: false, error: "Recusada pelo servidor.", permanent: true};
      if (!item.track) return {ok: true, queued: false};
      return Promise.resolve(sb.from("run_tracks").insert({run_id: item.row.id, student_id: item.row.student_id, fmt: 1, trim_m: item.track.trimM, points: item.track.segments})).then(function(){ return {ok: true, queued: false}; });
    });
  };
  RUN.flush = function(){ return Promise.resolve(); };
  RUN.proTab = function(s, el){ el.innerHTML = "<p>fake</p>"; };
  RUN.uiReset = function(){ RUN.v = {name: "home"}; };
  RUN.reset = RUN.uiReset;
}
var FAKE_UI_SRC = "(" + fakeUi.toString() + ")();\n";
// 3) o gancho de teste: corre no fim do eval do gravador e entrega à página o objeto RUN e a configuração
var HOOK = "\n;window.__RUN = RUN; window.__runLiveCfg = RUN_LIVE_CFG; window.__inst = runLInst; window.__findStudent = findStudent; window.__state = state;\n";

// ---------------------------------------------------------------- servidor, browser, utilitários
(async function(){
  var srv = await startStaticServer(root);
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  var allConsole = [], allExternal = [], allText = [];
  var ctxs = [];

  // abre treino.html como aluno com a Corrida ligada
  async function open(o){
    o = o || {};
    var ctx = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: "block", permissions: o.perms || [], hasTouch: !!o.touch});
    ctxs.push(ctx);
    if (o.geo) await ctx.setGeolocation(o.geo);
    var rows = [row("ana", "Ana Treina", o.mode === undefined ? "live" : o.mode)];
    await ctx.addInitScript(fakeSource({role: "student", userId: "user-1", email: "ana@x.test", rows: rows, runsRls: !!o.rls}));
    await ctx.addInitScript(pageStubs);
    if (o.seed) await ctx.addInitScript(function(seed){ try { if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); Object.keys(seed).forEach(function(k){ localStorage.setItem(k, seed[k]); }); } } catch (e) {} }, o.seed);
    if (o.init) await ctx.addInitScript(o.init);
    if (o.preRuns) await ctx.addInitScript(function(rs){ window.__fake.tables.runs = rs.slice(); }, o.preRuns);
    await ctx.route(/\/corrida-live\.js(\?|$)/, function(route){ route.fulfill({status: 200, contentType: "text/javascript", body: liveSrc + HOOK}); });
    if (!o.real) await ctx.route(/\/corrida\.js(\?|$)/, function(route){ route.fulfill({status: 200, contentType: "text/javascript", body: FAKE_UI_SRC}); });
    else await ctx.route(/\/corrida\.js(\?|$)/, function(route){ route.fulfill({status: 200, contentType: "text/javascript", body: read("corrida.js") + "\n;window.__realUi = true;\n"}); });
    var pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
    var ctl = {dialogs: [], answer: true, external: [], consoleMsgs: []};
    pg.on("pageerror", function(e){ errors.push(e.message); });
    pg.on("dialog", function(d){ ctl.dialogs.push(d.message()); if (ctl.answer) d.accept(); else d.dismiss(); });
    pg.on("request", function(r){ var u = r.url(); if (!/^http:\/\/127\.0\.0\.1/.test(u) && !/^(data|blob|about):/.test(u)) { ctl.external.push(u); allExternal.push(u); } });
    pg.on("console", function(m){ ctl.consoleMsgs.push(m.text()); allConsole.push(m.text()); });
    await pg.goto(srv.url + "treino.html");
    await pg.waitForSelector("#startWorkout");
    return {ctx: ctx, pg: pg, ctl: ctl};
  }
  // abre o separador Corrida e (se pedido) injeta o relógio rápido
  async function openCorrida(A){
    await A.pg.click('.tabbar [data-tab="corrida"]');
    await A.pg.waitForFunction(function(){ return window.__RUN && window.__RUN.loaded; });
    await A.pg.evaluate(function(){ if (window.__runLiveCfg) window.__runLiveCfg.tickMs = 150; });
  }
  var T = function(pg, sel){ return pg.locator(sel).innerText(); };
  // recarregar a página mantendo o desvio do relógio simulado (um telemóvel real não «volta atrás» no tempo ao recarregar)
  async function reloadKeepClock(pg){
    var off = await pg.evaluate(function(){ return window.__off; });
    await pg.reload();
    await pg.waitForSelector("#startWorkout");
    await pg.evaluate(function(o){ window.__off = o; }, off);
  }
  var live = function(pg){ return pg.evaluate(function(){ var L = window.__RUN.live; return {phase: L.phase, err: L.err, paused: !!(L.st && L.st.paused), nPts: L.st ? L.st.nPts : null, gaps: L.st ? L.st.gaps : null, hiddenS: L.hiddenS, restarts: L.restarts, locked: L.locked, wl: L.wl, draftOk: L.draftOk, watching: L.watching}; }); };
  var ls = function(pg, k){ return pg.evaluate(function(key){ return localStorage.getItem(key); }, k); };
  var DRAFT = "evolve_run_draft_v1", OUTBOX = "evolve_runs_outbox_v1";
  // do início até estar a gravar (já com o 1.º ponto aceite)
  async function startRecording(A, withFirstPoint){
    await A.pg.click("#fakeGoLive");
    await A.pg.waitForSelector("#runLiveGo");
    await A.pg.click("#runLiveGo");
    await A.pg.waitForSelector("#runLivePrepare");
    await A.pg.evaluate(function(){ window.__RUN.gps = window.__fakeGps; });
    await A.pg.click("#runLivePrepare");
    await A.pg.waitForSelector("#runLiveStart");
    await A.pg.evaluate(function(){ window.__go(1000, 0, 8); });
    await A.pg.waitForFunction(function(){ return !document.getElementById("runLiveStart").disabled; });
    await A.pg.click("#runLiveStart");
    await A.pg.waitForSelector("#runLivePause");
    if (withFirstPoint !== false) await A.pg.evaluate(function(){ window.__go(1000, 0); });
  }
  async function finishRun(A){
    await A.pg.click("#runLiveEnd");
    await A.pg.waitForSelector("#runLiveEndOk");
    await A.pg.click("#runLiveEndOk");
    await A.pg.waitForSelector("#runLiveReview");
  }

  // ======================================================================= A. com o corrida.js de mentira
  // A1. fluxo completo
  var A = await open();
  var p = A.pg;
  await openCorrida(A);
  ck("1. O módulo carregado define o contrato e acaba com RUN.loaded = true; o gancho de teste vê RUN.live e a configuração", await p.evaluate(function(){ var R = window.__RUN; return R.loaded === true && typeof R.liveOpen === "function" && typeof R.liveScreen === "function" && typeof R.liveWire === "function" && typeof R.liveDraftBanner === "function" && typeof R.liveWireBanner === "function" && typeof R.queueAdd === "function" && typeof R.queuePending === "function" && typeof R.flush === "function" && typeof R.reset === "function" && typeof R.gps.start === "function" && R.live.phase === "intro"; }));
  await p.click("#fakeGoLive");
  await p.waitForSelector("#runLiveGo");
  var introTxt = await T(p, "#runLive");
  ck("2. O aviso inicial diz o que tem de dizer (ecrã ligado, pode falhar, não testado em todos os telemóveis, música ANTES de Iniciar) e há a linha de música (3 botões) SÓ aqui, antes de começar (nunca na gravação): botões Spotify/Apple Music/YouTube Music",
    /Mantém a EVOLVE aberta e o ecrã ligado durante a corrida\. Se o ecrã bloquear ou mudares de aplicação, o registo pode falhar e ficará uma lacuna no percurso\. Ainda não testámos isto em todos os telemóveis\./.test(introTxt) &&
    /Põe a música a tocar ANTES de carregar em Iniciar e volta aqui\./.test(introTxt) && (await p.locator("[data-music]").count()) === 3 && /Spotify/i.test(introTxt) && /Apple Music/i.test(introTxt) && /YouTube Music/i.test(introTxt));
  ck("3. Abrir a vista não pede o consentimento nem o GPS nem o Wake Lock (só depois do toque)", await p.evaluate(function(){ return window.__consents === 1 /* o do #fakeGoLive */ && window.__fakeGps.starts === 0 && window.__wl.requests === 0; }));
  await p.click("#runLiveGo");
  await p.waitForSelector("#runLivePrepare");
  ck("4. «Continuar» pede o consentimento (RUN.ensureConsent) e só então mostra «Preparar GPS»; o GPS continua parado", await p.evaluate(function(){ return window.__consents === 2 && window.__fakeGps.starts === 0; }));
  await p.evaluate(function(){ window.__RUN.gps = window.__fakeGps; });
  await p.click("#runLivePrepare");
  await p.waitForSelector("#runLiveStart");
  ck("5. Só depois do toque em «Preparar GPS» arranca o GPS (uma vez) e pede-se o Wake Lock (uma vez)", await p.evaluate(function(){ return window.__fakeGps.starts === 1 && window.__wl.requests === 1; }));
  ck("6. Antes de haver posição o botão Iniciar está desligado e o estado diz que procura sinal", (await p.locator("#runLiveStart").isDisabled()) && /A procurar sinal/.test(await T(p, "#runLiveSignal")));
  await p.evaluate(function(){ window.__go(1000, 0, 60); });
  await p.waitForFunction(function(){ return /Sinal fraco/.test(document.getElementById("runLiveSignal").textContent); });
  ck("7. Com precisão fraca (60 m) diz «Sinal fraco (±60 m)» e o Iniciar continua desligado", /Sinal fraco \(±60 m\)/.test(await T(p, "#runLiveSignal")) && (await p.locator("#runLiveStart").isDisabled()) && /±60 m/.test(await T(p, "#runLiveAcc")));
  await p.evaluate(function(){ window.__go(1000, 0, 7); });
  await p.waitForFunction(function(){ return !document.getElementById("runLiveStart").disabled; });
  ck("8. Com precisão boa diz «Sinal bom (±7 m)» e liga o Iniciar", /Sinal bom \(±7 m\)/.test(await T(p, "#runLiveSignal")) && !(await p.locator("#runLiveStart").isDisabled()));
  await p.click("#runLiveStart");
  await p.waitForSelector("#runLivePause");
  ck("9. Ecrã de gravação: tempo, distância, ritmo e lacunas; Pausa, Terminar e Bloquear toques; SEM linha de música e sem os três botões", (await p.locator("#runLiveTime").count()) === 1 && (await p.locator("#runLiveDist").count()) === 1 && (await p.locator("#runLivePace").count()) === 1 &&
    /Lacunas: 0/.test(await T(p, "#runLiveGaps")) && (await p.locator("[data-music]").count()) === 0 && !/Spotify|Apple Music|YouTube Music/.test(await T(p, "#runLive")) && /Põe a música a tocar ANTES de carregar em Iniciar e volta aqui\./.test(await T(p, "#runLive")));
  var dims = await p.evaluate(function(){ return ["runLivePause", "runLiveEnd", "runLiveLockBtn"].map(function(id){ var r = document.getElementById(id).getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }); });
  ck("10. Botões de gravação com pelo menos 56 px de altura e 44 de largura; sem scroll horizontal da página", dims.every(function(d){ return d[1] >= 56 && d[0] >= 44; }) && await p.evaluate(function(){ return document.documentElement.scrollWidth <= window.innerWidth + 1; }));
  ck("11. Ainda sem posições aceites não há rascunho", (await ls(p, DRAFT)) === null);
  await p.evaluate(function(){ window.__go(1000, 3); });
  await p.waitForFunction(function(k){ return localStorage.getItem(k) !== null; }, DRAFT);
  var d1 = JSON.parse(await ls(p, DRAFT));
  ck("12. O 1.º ponto aceite escreve logo o rascunho: uid da conta, estado do reducer, hiddenS, vista", d1.uid === "user-1" && d1.v === 1 && d1.view === "live" && d1.st.nPts === 1 && d1.ended === false && typeof d1.hiddenS === "number" && Array.isArray(d1.st.segs));
  await p.evaluate(function(){ window.__goN(59, 1000, 3); });
  await p.waitForFunction(function(){ return /^0,1[5-9] km$|^0,2\d km$/.test(document.getElementById("runLiveDist").textContent); });
  var secs1 = await T(p, "#runLiveTime");
  ck("13. Números do ecrã: ~60 s a 3 m/s dá ~180 m, tempo ~1:00 e ritmo ~5:30 (vêm dos timestamps)", /^(0:5[89]|1:0\d)$/.test(secs1) && /^0,1[6-9] km$|^0,2[0-1] km$/.test(await T(p, "#runLiveDist")) && /^5:[0-5]\d$/.test(await T(p, "#runLivePace")));
  // pausa 30 s e retoma
  await p.click("#runLivePause");
  await p.waitForSelector("#runLive[data-phase='rec'] #runLivePause:text('Retomar')");
  var tPaused = await T(p, "#runLiveTime");
  await p.evaluate(function(){ window.__off += 30000; });
  await p.waitForTimeout(500);
  ck("14. Em pausa o relógio pára (30 s de pausa não contam) e o estado diz «Em pausa»", (await T(p, "#runLiveTime")) === tPaused && /Em pausa/.test(await T(p, "#runLiveSignal")) && (await live(p)).paused === true);
  await p.evaluate(function(){ window.__go(1000, 3); });   // chega com a pausa: ignorada
  var dPause = await T(p, "#runLiveDist");
  await p.click("#runLivePause");
  await p.waitForSelector("#runLivePause:text('Pausa')");
  await p.evaluate(function(){ window.__goN(30, 1000, 3); });
  await p.waitForFunction(function(prev){ return document.getElementById("runLiveDist").textContent !== prev; }, dPause);
  var after = await T(p, "#runLiveDist");
  ck("15. Retomar volta a contar; a distância não saltou pela pausa (a pausa não é lacuna)", (await live(p)).paused === false && (await live(p)).gaps === 0 && parseFloat(after.replace(",", ".")) > parseFloat(dPause.replace(",", ".")) && parseFloat(after.replace(",", ".")) < 0.30);
  // terminar
  await p.click("#runLiveEnd");
  await p.waitForSelector("#runLiveEndOk");
  var askTxt = await p.locator(".modal-sheet").innerText();
  ck("16. «Terminar» pede confirmação com «Terminar a corrida?», «Continuar a correr» e «Terminar»; continuar não termina", /Terminar a corrida\?/i.test(askTxt) && /Continuar a correr/i.test(askTxt) && (await p.locator("#runLiveEndOk").count()) === 1 && await (async function(){ await p.click("#runLiveContinue"); return (await live(p)).phase === "rec" && (await p.locator(".modal-sheet").count()) === 0; })());
  await finishRun(A);
  var wlAfterEnd = await p.evaluate(function(){ return {stops: window.__fakeGps.stops, rel: window.__wl.released, req: window.__wl.requests}; });
  ck("17. Ao terminar pára o GPS e liberta o Wake Lock, e mostra o resumo com «Rever e guardar» e «Descartar»", wlAfterEnd.stops === 1 && wlAfterEnd.rel === wlAfterEnd.req && (await p.locator("#runLiveDiscard").count()) === 1 && /Resumo/.test(await T(p, "#runLive")));
  var dEnd = JSON.parse(await ls(p, DRAFT));
  ck("18. O rascunho fica marcado como terminado mas continua guardado até a corrida ser guardada ou descartada", dEnd.ended === true && dEnd.st.nPts > 5);
  await p.click("#runLiveReview");
  await p.waitForSelector("#fakeSave");
  var sf = await p.evaluate(function(){ return window.__saveFlows; });
  var expect = C.runStats(sf[0].segments, null, "live");
  ck("19. RUN.saveFlow é chamado uma vez com source «live», stats iguais a runStats dos pontos completos, hiddenS inteiro, avisos, fileDistM null, hora de início e cancelView para o resumo", sf.length === 1 && sf[0].source === "live" &&
    JSON.stringify(sf[0].stats) === JSON.stringify(expect) && Number.isInteger(sf[0].hiddenS) && Array.isArray(sf[0].warnings) && sf[0].fileDistM === null && sf[0].startedAtMs === expect.startedAtMs && sf[0].cancelView.name === "live" && sf[0].hasOnSaved);
  ck("20. Os pontos que vão para saveFlow são todos (não só os do percurso simplificado) e a distância fica perto da verdade sintética (~270 m: 90 s a 3 m/s, sem a pausa)", sf[0].segments.reduce(function(a, s){ return a + s.length; }, 0) === expect.points && expect.points >= 18 && expect.gaps === 0 && sf[0].stats.distM > 230 && sf[0].stats.distM < 290);
  await p.click("#fakeSaveCancel");
  await p.waitForSelector("#runLiveReview");
  ck("21. «Cancelar» no ecrã de guardar volta ao resumo (a corrida não se perde) e o rascunho continua guardado", (await ls(p, DRAFT)) !== null && (await live(p)).phase === "end");
  await p.click("#runLiveReview");
  await p.waitForSelector("#fakeSaveBtn");
  await p.click("#fakeSaveBtn");
  await p.waitForSelector("#fakeHome");
  ck("22. Guardada a corrida (RUN.submitRun ok) o rascunho apaga-se, a memória limpa-se e voltamos ao início da Corrida sem banner", (await ls(p, DRAFT)) === null && (await live(p)).phase === "intro" && (await p.locator("#runLiveBanner").count()) === 0);
  ck("23. A corrida chegou à base de dados simulada uma vez, como «live», com o hidden_s e a duração certos", await p.evaluate(function(){ var rs = window.__fake.tables.runs; return rs.length === 1 && rs[0].source === "live" && rs[0].student_id === "ana" && rs[0].duration_s > 50 && rs[0].hidden_s === 0 && rs[0].consent_v === 1; }));
  ck("24. Nenhum pedido a terceiros e nada de coordenadas na consola durante o fluxo", A.ctl.external.length === 0 && !A.ctl.consoleMsgs.some(function(m){ return /38\.7|-9\.1/.test(m); }));
  await A.ctx.close();

  // A2. sem posições, vigia, erros
  var B = await open();
  await openCorrida(B);
  await startRecording(B);
  await B.pg.evaluate(function(){ window.__goN(10, 1000, 3); });
  await B.pg.evaluate(function(){ window.__off += 10000; });
  await B.pg.waitForFunction(function(){ return /Sem posições há \d+ s\. Mantém o ecrã ligado\./.test(document.getElementById("runLiveSignal").textContent); });
  ck("25. Sem posições há mais de 8 s o ecrã diz «Sem posições há N s. Mantém o ecrã ligado.»", /Sem posições há \d+ s\. Mantém o ecrã ligado\./.test(await T(B.pg, "#runLiveSignal")));
  await B.pg.evaluate(function(){ window.__off += 12000; });
  await B.pg.waitForFunction(function(){ return window.__fakeGps.starts === 2; });
  var restartState = await live(B.pg);
  ck("26. Vigia: com a página visível e sem posições há mais de 20 s, o watch é parado e iniciado de novo (registado)", await B.pg.evaluate(function(){ return window.__fakeGps.stops === 1 && window.__fakeGps.starts === 2; }) && restartState.restarts === 1 && restartState.watching);
  await B.pg.evaluate(function(){ window.__go(1000, 3); });
  await B.pg.waitForFunction(function(){ return window.__RUN.live.st.gaps === 1; });
  ck("27. A posição que chega depois de ~23 s sem posições abre uma lacuna (contador «Lacunas: 1») e o rascunho é escrito", (await live(B.pg)).gaps === 1 && /Lacunas: 1 \(\d+ s sem posições\)/.test(await T(B.pg, "#runLiveGaps")) && JSON.parse(await ls(B.pg, DRAFT)).st.gaps === 1);
  await B.pg.evaluate(function(){ var e = window.__fakeGps.onErr; e({code: 1}); });
  await B.pg.waitForSelector("#runLiveRetry");
  var dnd = await live(B.pg);
  ck("28. Permissão recusada a meio: grava o rascunho, pára o GPS e explica, com «Tentar outra vez», «Terminar e guardar o que há» e «Descartar»", dnd.err === "denied" && !dnd.watching && /A localização foi recusada e a gravação parou/.test(await T(B.pg, "#runLive")) &&
    (await B.pg.locator("#runLiveEnd").count()) === 1 && (await B.pg.locator("#runLiveDiscard").count()) === 1 && JSON.parse(await ls(B.pg, DRAFT)).st.nPts === (await live(B.pg)).nPts);
  var startsBefore = await B.pg.evaluate(function(){ return window.__fakeGps.starts; });
  await B.pg.click("#runLiveRetry");
  await B.pg.waitForSelector("#runLivePause");
  ck("29. «Tentar outra vez» volta a pedir o GPS e a gravação segue", await B.pg.evaluate(function(s){ return window.__fakeGps.starts === s + 1; }, startsBefore) && (await live(B.pg)).err === null && (await live(B.pg)).watching);
  await B.ctx.close();

  // A3. ecrã oculto simulado → lacuna e aviso
  var Hd = await open();
  await openCorrida(Hd);
  await startRecording(Hd);
  await Hd.pg.evaluate(function(){ window.__goN(20, 1000, 3); });
  var setsBefore = JSON.parse(await ls(Hd.pg, DRAFT)).st.nPts;
  await Hd.pg.evaluate(function(){ window.__setVis("hidden"); });
  var dHidden = JSON.parse(await ls(Hd.pg, DRAFT));
  ck("30. Ao ficar oculta a página força a escrita do rascunho (já com os pontos todos)", dHidden.st.nPts === (await live(Hd.pg)).nPts && dHidden.st.nPts >= setsBefore);
  await Hd.pg.evaluate(function(){ window.__off += 40000; window.__setVis("visible"); });
  await Hd.pg.waitForFunction(function(){ return /A página esteve oculta 40 s: o percurso pode ter lacuna\./.test(document.getElementById("runLiveNotes").textContent); });
  ck("31. Ao voltar mostra «A página esteve oculta 40 s: o percurso pode ter lacuna.» e conta hiddenS = 40", Math.round((await live(Hd.pg)).hiddenS) === 40 && /A página esteve oculta 40 s: o percurso pode ter lacuna\./.test(await T(Hd.pg, "#runLiveNotes")));
  ck("32. O Wake Lock é reposto ao voltar (só se tinha sido libertado) e sem pedidos duplicados", await Hd.pg.evaluate(function(){ return window.__wl.requests === 1; }));
  await Hd.pg.evaluate(function(){ window.__go(1000, 3); window.__goN(12, 1000, 3); });
  await finishRun(Hd);
  await Hd.pg.click("#runLiveReview");
  await Hd.pg.waitForSelector("#fakeSave");
  var sfH = (await Hd.pg.evaluate(function(){ return window.__saveFlows; }))[0];
  ck("33. A lacuna do ecrã oculto chega ao saveFlow: stats com 1 lacuna (~40 s), hiddenS 40 e avisos sobre a lacuna e a página oculta", sfH.stats.gaps === 1 && sfH.stats.gapS >= 38 && sfH.hiddenS === 40 && sfH.warnings.length === 2 && /1 lacuna de sinal/.test(sfH.warnings[0]) && /oculta 40 s/.test(sfH.warnings[1]));
  await Hd.ctx.close();

  // A3b. mudar de separador durante a gravação
  var Tb = await open();
  await openCorrida(Tb);
  await startRecording(Tb);
  await Tb.pg.evaluate(function(){ window.__goN(30, 1000, 3); });
  var nBefore = (await live(Tb.pg)).nPts;
  await Tb.pg.click('.tabbar [data-tab="hoje"]');
  await Tb.pg.waitForSelector("#startWorkout");
  await Tb.pg.evaluate(function(){ window.__goN(30, 1000, 3); });
  var away = await live(Tb.pg);
  ck("34. Mudar para o separador «Treino» não interrompe a gravação: o estado está em memória e as posições continuam a entrar (o ecrã de gravação já não está no DOM)", away.phase === "rec" && away.nPts > nBefore && (await Tb.pg.locator("#runLive").count()) === 0 && away.watching);
  await Tb.pg.click('.tabbar [data-tab="corrida"]');
  await Tb.pg.waitForSelector("#runLivePause");
  ck("35. Ao voltar ao separador «Corrida» o ecrã de gravação volta como estava (o tempo já conta o que passou) e continua a atualizar sozinho", /^1:0\d$|^0:5[89]$/.test(await T(Tb.pg, "#runLiveTime")) && await (async function(){ await Tb.pg.evaluate(function(){ window.__goN(5, 1000, 3); }); await Tb.pg.waitForFunction(function(){ return /^1:0[5-9]$/.test(document.getElementById("runLiveTime").textContent); }); return true; })());
  await Tb.pg.evaluate(function(){ window.__RUN.go("home"); });
  await Tb.pg.waitForSelector("#fakeHome");
  var recBanner = await T(Tb.pg, "#runLiveBanner");
  ck("36. Na vista «home», com uma gravação a decorrer, o aviso diz «Corrida a decorrer» com «Voltar à gravação» (e nada de «Retomar»)", /Corrida a decorrer/i.test(recBanner) && /Voltar à gravação/i.test(recBanner) && !/Retomar/i.test(recBanner));
  await Tb.pg.click('#runLiveBanner [data-act="back"]');
  await Tb.pg.waitForSelector("#runLivePause");
  await Tb.pg.click('.tabbar [data-tab="hoje"]');
  await Tb.pg.waitForSelector("#startWorkout");
  await Tb.pg.evaluate(function(){ window.__fakeGps.onErr({code: 1}); });
  await Tb.pg.waitForSelector(".toast.show");
  ck("37. Se a permissão é recusada com o aluno noutro separador aparece um aviso, a gravação pára e o rascunho fica escrito; ao voltar vê a explicação", /A localização foi recusada: a gravação parou\./.test(await Tb.pg.locator(".toast").first().innerText()) && (await live(Tb.pg)).err === "denied" && JSON.parse(await ls(Tb.pg, DRAFT)).st.nPts === (await live(Tb.pg)).nPts && await (async function(){ await Tb.pg.click('.tabbar [data-tab="corrida"]'); await Tb.pg.waitForSelector("#runLiveRetry"); return true; })());
  await Tb.ctx.close();

  // A4. rascunho + recarregar: retomar
  var Rs = await open();
  await openCorrida(Rs);
  await startRecording(Rs);
  await Rs.pg.evaluate(function(){ window.__goN(40, 1000, 3); window.__setVis("hidden"); });
  var distBeforeReload = (await Rs.pg.evaluate(function(){ return Math.round(window.__RUN.live.st.distM); }));
  var draftTxt = await ls(Rs.pg, DRAFT);
  await reloadKeepClock(Rs.pg);
  ck("38. Depois de recarregar a página a gravação em memória desapareceu mas o rascunho continua guardado e o núcleo avisa («Tens uma corrida por terminar»)", JSON.parse(await ls(Rs.pg, DRAFT)).st.nPts === JSON.parse(draftTxt).st.nPts && (await Rs.pg.locator("#runPendingCard").count()) === 1);
  await Rs.pg.click('.tabbar [data-tab="corrida"]');
  await Rs.pg.waitForFunction(function(){ return window.__RUN && window.__RUN.loaded; });
  await Rs.pg.waitForSelector("#runLiveBanner");
  var banner = await T(Rs.pg, "#runLiveBanner");
  ck("39. Na vista «home» aparece o banner com a corrida por terminar (distância, tempo, quando começou) e «Retomar», «Guardar o que há» e «Descartar»", /Há uma corrida por terminar/i.test(banner) && /0,\d\d km/.test(banner) && /começada a \d\d\/\d\d\/\d{4} às \d\d:\d\d/.test(banner) && /Retomar/i.test(banner) && /Guardar o que há/i.test(banner) && /Descartar/i.test(banner));
  await Rs.pg.evaluate(function(){ window.__RUN.gps = window.__fakeGps; window.__runLiveCfg.tickMs = 150; });
  await Rs.pg.click('#runLiveBanner [data-act="resume"]');
  await Rs.pg.waitForSelector("#runLivePause");
  var rst = await Rs.pg.evaluate(function(){ var st = window.__RUN.live.st; return {dist: Math.round(st.distM), nPts: st.nPts, brk: st.brk, starts: window.__fakeGps.starts}; });
  ck("40. «Retomar» recria o estado (mesma distância e pontos), arranca o GPS só agora e está em gravação", Math.abs(rst.dist - distBeforeReload) <= 5 && rst.starts === 1 && (await live(Rs.pg)).phase === "rec" && rst.brk === "gap");
  await Rs.pg.evaluate(function(){ window.__go(1000, 3); window.__goN(10, 1000, 3); });
  await Rs.pg.waitForFunction(function(){ return window.__RUN.live.st.gaps === 1; });
  ck("41. O 1.º ponto depois de retomar abre uma lacuna e não soma distância através dela", (await live(Rs.pg)).gaps === 1);
  await Rs.ctx.close();

  // A5. rascunho: «Guardar o que há» e «Descartar»
  var Sv = await open();
  await openCorrida(Sv);
  await startRecording(Sv);
  await Sv.pg.evaluate(function(){ window.__goN(40, 1000, 3); window.__setVis("hidden"); });
  var savedStats = await Sv.pg.evaluate(function(){ return JSON.parse(localStorage.getItem("evolve_run_draft_v1")).st.nPts; });
  await reloadKeepClock(Sv.pg);
  await Sv.pg.click('.tabbar [data-tab="corrida"]');
  await Sv.pg.waitForSelector('#runLiveBanner [data-act="save"]');
  await Sv.pg.click('#runLiveBanner [data-act="save"]');
  await Sv.pg.waitForSelector("#fakeSave");
  var sfS = (await Sv.pg.evaluate(function(){ return window.__saveFlows; }))[0];
  ck("42. «Guardar o que há» segue para RUN.saveFlow com os pontos do rascunho (source live), sem arrancar o GPS e sem apagar o rascunho", sfS.source === "live" && sfS.segments.reduce(function(a, s){ return a + s.length; }, 0) === savedStats && sfS.stats.distM > 80 && (await ls(Sv.pg, DRAFT)) !== null);
  await Sv.pg.click("#fakeSaveBtn");
  await Sv.pg.waitForSelector("#fakeHome");
  ck("43. Guardar o que há apaga o rascunho e a corrida chega à BD", (await ls(Sv.pg, DRAFT)) === null && (await Sv.pg.evaluate(function(){ return window.__fake.tables.runs.length; })) === 1 && (await Sv.pg.locator("#runLiveBanner").count()) === 0);
  await Sv.ctx.close();

  var Ds = await open();
  await openCorrida(Ds);
  await startRecording(Ds);
  await Ds.pg.evaluate(function(){ window.__goN(30, 1000, 3); window.__setVis("hidden"); });
  await reloadKeepClock(Ds.pg);
  await Ds.pg.click('.tabbar [data-tab="corrida"]');
  await Ds.pg.waitForSelector('#runLiveBanner [data-act="discard"]');
  Ds.ctl.answer = false;
  await Ds.pg.click('#runLiveBanner [data-act="discard"]');
  await Ds.pg.waitForTimeout(150);
  ck("44. «Descartar» pergunta primeiro; se o aluno diz que não, o rascunho fica", Ds.ctl.dialogs.length === 1 && /Descartar esta corrida\?/.test(Ds.ctl.dialogs[0]) && (await ls(Ds.pg, DRAFT)) !== null && (await Ds.pg.locator("#runLiveBanner").count()) === 1);
  Ds.ctl.answer = true;
  await Ds.pg.click('#runLiveBanner [data-act="discard"]');
  await Ds.pg.waitForFunction(function(){ return localStorage.getItem("evolve_run_draft_v1") === null; });
  await Ds.pg.waitForTimeout(150);
  ck("45. Confirmando, o rascunho apaga-se e o banner desaparece", (await ls(Ds.pg, DRAFT)) === null && (await Ds.pg.locator("#runLiveBanner").count()) === 0);
  await Ds.ctx.close();

  // A6. bloquear toques
  var Lk = await open();
  await openCorrida(Lk);
  await startRecording(Lk);
  await Lk.pg.evaluate(function(){ window.__goN(5, 1000, 3); window.__runLiveCfg.lockHoldMs = 1500; });
  await Lk.pg.click("#runLiveLockBtn");
  await Lk.pg.waitForSelector("#runLiveLock");
  var pb = await Lk.pg.locator("#runLivePause").boundingBox();
  ck("46. «Bloquear toques» cobre o ecrã com instruções (pressão longa de ~1,5 s) e a gravação continua", /Toques bloqueados/.test(await T(Lk.pg, "#runLiveLock")) && /1,5 s/.test(await T(Lk.pg, "#runLiveLock")) && (await live(Lk.pg)).locked === true && (await Lk.pg.evaluate(function(){ var r = document.getElementById("runLiveLock").getBoundingClientRect(); return r.width >= window.innerWidth && r.height >= window.innerHeight; })));
  await Lk.pg.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await Lk.pg.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await Lk.pg.waitForTimeout(200);
  ck("47. Com os toques bloqueados, tocar no botão Pausa não faz nada (nem dois toques)", (await live(Lk.pg)).paused === false && (await Lk.pg.locator("#runLiveLock").count()) === 1);
  var lb = await Lk.pg.locator("#runLiveLock").boundingBox();
  await Lk.pg.mouse.move(lb.x + lb.width / 2, lb.y + 300);
  await Lk.pg.mouse.down();
  await Lk.pg.waitForTimeout(700);
  await Lk.pg.mouse.up();
  await Lk.pg.waitForTimeout(150);
  ck("48. Largar antes de ~1,5 s não desbloqueia", (await live(Lk.pg)).locked === true && (await Lk.pg.locator("#runLiveLock").count()) === 1);
  await Lk.pg.mouse.move(lb.x + lb.width / 2, lb.y + 300);
  await Lk.pg.mouse.down();
  await Lk.pg.waitForTimeout(1750);
  var stillCovering = await Lk.pg.locator("#runLiveLock").count();
  await Lk.pg.mouse.up();
  await Lk.pg.waitForSelector("#runLiveLock", {state: "detached"});
  ck("49. Com o dedo premido ~1,5 s e ao largar desbloqueia (a camada fica até largar, para o toque de largar não acertar nos botões)", stillCovering === 1 && (await live(Lk.pg)).locked === false && (await live(Lk.pg)).paused === false);
  await Lk.pg.click("#runLivePause");
  await Lk.pg.waitForSelector("#runLivePause:text('Retomar')");
  ck("50. Depois de desbloquear os botões voltam a responder", (await live(Lk.pg)).paused === true);
  await Lk.ctx.close();

  // A7. fila offline → online
  var Q = await open();
  await openCorrida(Q);
  await startRecording(Q);
  await Q.pg.evaluate(function(){ window.__goN(45, 1000, 3); });
  await finishRun(Q);
  await Q.pg.click("#runLiveReview");
  await Q.pg.waitForSelector("#fakeSaveBtn");
  await Q.pg.click("#fakeSaveShare");
  await Q.ctx.setOffline(true);
  await Q.pg.click("#fakeSaveBtn");
  await Q.pg.waitForSelector("#fakeHome");
  var qTxt = await ls(Q.pg, OUTBOX);
  var q1 = JSON.parse(qTxt);
  ck("51. Sem ligação a corrida vai para a fila (RUN.queueAdd) e o rascunho apaga-se (a corrida já está na fila)", q1.length === 1 && q1[0].uid === "user-1" && q1[0].state === "pending" && q1[0].item.row.source === "live" && (await ls(Q.pg, DRAFT)) === null && await Q.pg.evaluate(function(){ return window.__saved && window.__saved.queued === true && window.__RUN.queuePending() === 1; }));
  ck("52. A fila guarda SÓ o que seria enviado: sem pontos brutos (nenhum acc, t em ms, b:gap) e o percurso com 3 números por ponto, aparado", !/"acc"|"b":"|"speed"/.test(qTxt) && q1[0].item.track.segments[0][0].length === 3 && q1[0].item.track.trimM === 0 && Object.keys(q1[0].item).sort().join() === "row,track");
  ck("53. O banner da vista «home» mostra «Corridas por enviar» com «Tentar enviar agora»", /Corridas por enviar/i.test(await T(Q.pg, "#runLiveBanner")) && (await Q.pg.locator('#runLiveBanner [data-act="retry"]').count()) === 1);
  await Q.ctx.setOffline(false);
  await Q.pg.waitForFunction(function(k){ return localStorage.getItem(k) === null; }, OUTBOX);
  await Q.pg.waitForTimeout(300);
  var qw = await Q.pg.evaluate(function(){ return {runs: window.__fake.tables.runs.length, tracks: window.__fake.tables.run_tracks.length, inserts: window.__fake.writes.filter(function(w){ return w.table === "runs" && w.op === "insert"; }).length}; });
  ck("54. Ao voltar a ligação (evento online) a fila envia-se UMA vez só: 1 corrida e 1 percurso na BD, fila vazia, aviso desaparece", qw.runs === 1 && qw.tracks === 1 && qw.inserts === 1 && (await Q.pg.locator("#runLiveBanner").count()) === 0);
  await Q.ctx.close();

  // A8. 23505 tolerado: a corrida já tinha chegado
  var preRow = (function(){
    var segs = []; for (var i = 0; i < 40; i++) segs.push({lat: LAT0 + 3 * i / 111194.93, lon: LON0, acc: 5, t: Date.UTC(2026, 9, 22, 7, 0, 0) + i * 1000});
    var st = C.runStats([segs], null, "live");
    return C.runBuildInsert({id: RID1, studentId: "ana", source: "live", startedAtMs: st.startedAtMs, durationS: st.durationS, movingS: st.movingS, distM: st.distM, gaps: 0, gapS: 0, hiddenS: 0, consentV: 1}, Date.UTC(2026, 9, 22, 12, 0, 0));
  })();
  var seedQ = {}; seedQ[OUTBOX] = JSON.stringify([{id: RID1, uid: "user-1", ts: 1, state: "pending", err: "", item: {row: preRow, track: null}}]);
  var Dup = await open({seed: seedQ, preRuns: [Object.assign({created_by: "user-1"}, preRow)]});
  await Dup.pg.waitForFunction(function(k){ return localStorage.getItem(k) === null; }, OUTBOX);
  ck("55. Se a corrida já tinha chegado (23505) a fila esvazia-se sem duplicar: continua 1 corrida na BD e nenhum erro", (await Dup.pg.evaluate(function(){ return window.__fake.tables.runs.length; })) === 1 && (await Dup.pg.evaluate(function(){ return window.__fake.writes.filter(function(w){ return w.table === "runs"; }).length; })) === 0);
  await Dup.ctx.close();

  // A9. recusa permanente
  var seedP = {}; seedP[OUTBOX] = JSON.stringify([{id: RID2, uid: "user-1", ts: 1, state: "pending", err: "", item: {row: Object.assign({}, preRow, {id: RID2}), track: null}}]);
  var Pm = await open({seed: seedP, rls: true, mode: "import"});      // «live» num aluno só com «import»: o servidor recusa (42501)
  await Pm.pg.waitForFunction(function(k){ var q = JSON.parse(localStorage.getItem(k) || "[]"); return q.length === 1 && q[0].state === "failed"; }, OUTBOX);
  await Pm.pg.click('.tabbar [data-tab="corrida"]');
  await Pm.pg.waitForFunction(function(){ return window.__RUN && window.__RUN.loaded; });
  await Pm.pg.waitForSelector("#runLiveBanner");
  var bTxt = await T(Pm.pg, "#runLiveBanner");
  ck("56. Uma corrida recusada de vez fica na fila marcada e visível com «Não foi possível guardar» e «Apagar» (sem texto do servidor); nunca se apaga sozinha", /Não foi possível guardar/i.test(bTxt) && (await Pm.pg.locator('#runLiveBanner [data-act="del"]').count()) === 1 && !/row-level|violates|42501/.test(bTxt) && /desativada/.test(bTxt));
  Pm.ctl.answer = false;
  await Pm.pg.click('#runLiveBanner [data-act="del"]');
  await Pm.pg.waitForTimeout(150);
  var keep = JSON.parse(await ls(Pm.pg, OUTBOX));
  Pm.ctl.answer = true;
  await Pm.pg.click('#runLiveBanner [data-act="del"]');
  await Pm.pg.waitForFunction(function(k){ return localStorage.getItem(k) === null; }, OUTBOX);
  ck("57. «Apagar» pergunta primeiro e só com confirmação tira a corrida da fila", keep.length === 1 && Pm.ctl.dialogs.length === 2 && (await ls(Pm.pg, OUTBOX)) === null);
  await Pm.ctx.close();

  // A10. sair da conta
  var Out = await open();
  await openCorrida(Out);
  await startRecording(Out);
  await Out.pg.evaluate(function(){ window.__goN(30, 1000, 3); });
  var seededFailed = JSON.stringify([{id: RID2, uid: "user-1", ts: 1, state: "failed", err: "x", item: {row: Object.assign({}, preRow, {id: RID2}), track: null}}]);
  await Out.pg.evaluate(function(a){ localStorage.setItem(a[0], a[1]); }, [OUTBOX, seededFailed]);
  Out.ctl.answer = false;
  await Out.pg.evaluate(function(){ document.getElementById("signOutBtn").click(); });
  await Out.pg.waitForTimeout(200);
  ck("58. Sair com uma gravação e uma corrida por enviar pergunta primeiro («Há uma corrida por terminar ou por enviar...»); cancelar não apaga nem pára nada", Out.ctl.dialogs.length === 1 && /corrida por terminar ou por enviar/.test(Out.ctl.dialogs[0]) && (await ls(Out.pg, DRAFT)) !== null && (await ls(Out.pg, OUTBOX)) !== null && (await live(Out.pg)).phase === "rec");
  Out.ctl.answer = true;
  var stopsBeforeOut = await Out.pg.evaluate(function(){ return window.__fakeGps.stops; });
  await Out.pg.evaluate(function(){ document.getElementById("signOutBtn").click(); });
  await Out.pg.waitForTimeout(300);
  var outState = await Out.pg.evaluate(function(){ return {stops: window.__fakeGps.stops, phase: window.__RUN.live.phase, st: window.__RUN.live.st, tick: window.__RUN.live.tickId, draft: localStorage.getItem("evolve_run_draft_v1"), box: localStorage.getItem("evolve_runs_outbox_v1"), wlRel: window.__wl.released, wlReq: window.__wl.requests, view: window.__RUN.v.name}; });
  ck("59. Sair da conta apaga o rascunho e a fila, pára o GPS (RUN.reset), o relógio e o Wake Lock e esquece o estado em memória", outState.draft === null && outState.box === null && outState.stops === stopsBeforeOut + 1 && outState.phase === "intro" && outState.st === null && outState.tick === null && outState.wlRel === outState.wlReq && outState.view === "home");
  await Out.pg.waitForTimeout(700);
  await Out.pg.evaluate(function(){ window.__setVis("hidden"); window.__setVis("visible"); });
  ck("60. Depois de sair nenhum relógio ou evento volta a escrever o rascunho", (await ls(Out.pg, DRAFT)) === null && (await ls(Out.pg, OUTBOX)) === null);
  await Out.ctx.close();

  // A11. modo «import»: sem gravação
  var Im = await open({mode: "import"});
  await openCorrida(Im);
  await Im.pg.evaluate(function(){ window.__RUN.liveOpen({id: "ana", runsColumn: true, runsMode: "import"}); });
  await Im.pg.waitForTimeout(150);
  ck("61. Com a Corrida em modo «import» o gravador não se abre: RUN.liveOpen só avisa (toast) e nada é pedido ao GPS", (await Im.pg.locator("#runLive").count()) === 0 && await Im.pg.evaluate(function(){ return window.__fakeGps.starts === 0 && window.__goLog.indexOf("live") < 0; }) && /não está ligada/.test(await Im.pg.locator(".toast").first().innerText()));
  await Im.ctx.close();

  // A12. adaptador padrão com a geolocalização do Playwright (sem adaptador injetado)
  var Geo = await open({perms: ["geolocation"], geo: {latitude: 38.7, longitude: -9.1, accuracy: 10}});
  await openCorrida(Geo);
  await Geo.pg.click("#fakeGoLive");
  await Geo.pg.waitForSelector("#runLiveGo");
  await Geo.pg.click("#runLiveGo");
  await Geo.pg.waitForSelector("#runLivePrepare");
  await Geo.pg.evaluate(function(){ var g = navigator.geolocation, orig = g.watchPosition.bind(g); window.__wp = []; g.watchPosition = function(a, b, c){ window.__wp.push(c); return orig(a, b, c); }; });
  await Geo.pg.click("#runLivePrepare");
  await Geo.pg.waitForFunction(function(){ return /Sinal bom/.test(document.getElementById("runLiveSignal").textContent); });
  ck("62. Adaptador padrão (navigator.geolocation.watchPosition com a localização do Playwright): mostra «Sinal bom (±10 m)» e liga o Iniciar", /Sinal bom \(±10 m\)/.test(await T(Geo.pg, "#runLiveSignal")) && !(await Geo.pg.locator("#runLiveStart").isDisabled()));
  ck("63. O adaptador padrão pede ao navegador enableHighAccuracy: true, maximumAge: 0 e timeout: 30000, uma só vez", await Geo.pg.evaluate(function(){ return window.__wp.length === 1 && window.__wp[0].enableHighAccuracy === true && window.__wp[0].maximumAge === 0 && window.__wp[0].timeout === 30000; }));
  await Geo.pg.click("#runLiveStart");
  await Geo.pg.waitForSelector("#runLivePause");
  for (var gi = 1; gi <= 3; gi++) { await Geo.ctx.setGeolocation({latitude: 38.7 + gi * 0.00014, longitude: -9.1, accuracy: 10}); await Geo.pg.waitForTimeout(1700); }   // ~15,6 m a cada 1,7 s = ~9 m/s: abaixo do limite de salto
  await Geo.pg.waitForFunction(function(){ return window.__RUN.live.st.nPts >= 2; });
  ck("64. O adaptador padrão entrega posições (lat, lon, precisão e hora do navegador) ao registo: pontos aceites e distância > 0", (await live(Geo.pg)).nPts >= 2 && /^0,0[1-9] km$/.test(await T(Geo.pg, "#runLiveDist")));
  await Geo.ctx.close();
  var Den = await open();     // sem permissão de localização: o Chromium recusa
  await openCorrida(Den);
  await Den.pg.click("#fakeGoLive");
  await Den.pg.waitForSelector("#runLiveGo");
  await Den.pg.click("#runLiveGo");
  await Den.pg.waitForSelector("#runLivePrepare");
  await Den.pg.click("#runLivePrepare");
  await Den.pg.waitForFunction(function(){ return window.__RUN.live.err === "denied"; });
  ck("65. Sem permissão de localização o adaptador padrão dá o código 1: o ecrã explica as permissões e oferece «Tentar outra vez»; nunca começa a gravar", /recusada/.test(await T(Den.pg, "#runLive")) && (await Den.pg.locator("#runLiveRetry").count()) === 1 && (await live(Den.pg)).phase === "prep" && (await ls(Den.pg, DRAFT)) === null && (await Den.pg.locator("#runLiveHelp").isVisible()));
  await Den.ctx.close();

  // A13. Wake Lock indisponível
  var Wl = await open();
  await openCorrida(Wl);
  await Wl.pg.evaluate(function(){ window.__wl.deny = true; });
  await startRecording(Wl);
  await Wl.pg.waitForFunction(function(){ return /Não consegui manter o ecrã ligado/.test(document.getElementById("runLiveNotes").textContent); });
  ck("66. Com o Wake Lock recusado avisa («Não consegui manter o ecrã ligado») e grava na mesma", (await live(Wl.pg)).wl === "denied" && (await live(Wl.pg)).phase === "rec");
  await Wl.ctx.close();

  // A14. localStorage a falhar
  var St = await open();
  await openCorrida(St);
  await St.pg.evaluate(function(){ var orig = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v){ if (/^evolve_run/.test(k)) throw new Error("QuotaExceededError"); return orig.call(this, k, v); }; });
  await startRecording(St);
  await St.pg.waitForFunction(function(){ return /Não feches a app: a corrida ainda não está guardada/.test(document.getElementById("runLiveNotes").textContent); });
  ck("67. Se o armazenamento recusa a escrita do rascunho aparece «Não feches a app: a corrida ainda não está guardada» e a gravação continua", (await live(St.pg)).draftOk === false && (await live(St.pg)).phase === "rec");
  await St.ctx.close();

  // A15. fila cheia / fila vazia no arranque
  var seedBad = {}; seedBad[DRAFT] = "{isto não é json"; seedBad[OUTBOX] = "[1,2,{\"uid\":\"user-1\"}]";
  var Bad = await open({seed: seedBad});
  await openCorrida(Bad);
  await Bad.pg.click("#fakeGoLive");
  await Bad.pg.waitForSelector("#runLiveGo");
  await Bad.pg.waitForFunction(function(k){ return localStorage.getItem(k) === null; }, OUTBOX);
  ck("68. Rascunho e fila com lixo no armazenamento não rebentam a app: a vista abre o aviso inicial, não aparece nenhum banner e as entradas inválidas da fila (que nunca se poderiam enviar) são limpas", (await Bad.pg.locator("#runLiveBanner").count()) === 0 && (await Bad.pg.locator("#runLiveGo").count()) === 1 && (await ls(Bad.pg, OUTBOX)) === null);
  await Bad.ctx.close();

  // ======================================================================= B. com o corrida.js real
  if (HAS_REAL_UI) {
    // B1. fluxo completo com o consentimento e o ecrã de guardar verdadeiros
    var R = await open({real: true, rls: true});
    var rp = R.pg;
    await rp.click('.tabbar [data-tab="corrida"]');
    await rp.waitForFunction(function(){ return window.__RUN && window.__RUN.loaded && window.__realUi; });
    await rp.waitForSelector("#runGoLive");
    await rp.evaluate(function(){ window.__runLiveCfg.tickMs = 150; });
    await rp.click("#runGoLive");
    await rp.waitForSelector("#runCsAccept");
    await rp.click("#runCsAccept");
    await rp.waitForSelector("#runLiveGo");
    ck("69. [corrida.js real] «Gravar com GPS» pede o consentimento (aviso verdadeiro), grava-o no servidor e abre a vista ao vivo com o aviso inicial", (await rp.evaluate(function(){ return window.__fake.tables.run_consents.length; })) === 1 && /Mantém a EVOLVE aberta e o ecrã ligado/.test(await T(rp, "#runLive")));
    await rp.click("#runLiveGo");
    await rp.waitForSelector("#runLivePrepare");
    await rp.evaluate(function(){ window.__RUN.gps = window.__fakeGps; });
    await rp.click("#runLivePrepare");
    await rp.waitForSelector("#runLiveStart");
    await rp.evaluate(function(){ window.__go(1000, 0, 8); });
    await rp.waitForFunction(function(){ return !document.getElementById("runLiveStart").disabled; });
    await rp.click("#runLiveStart");
    await rp.waitForSelector("#runLivePause");
    await rp.evaluate(function(){ window.__go(1000, 0); window.__goN(70, 1000, 3); });
    await finishRun(R);
    await rp.click("#runLiveReview");
    await rp.waitForSelector("#runSave");
    var svTxt = await T(rp, "#runSave");
    ck("70. [corrida.js real] «Rever e guardar» abre o ecrã verdadeiro «Confirma antes de guardar» com a distância, o tempo e a origem «GPS no telemóvel»", /Confirma antes de guardar/.test(svTxt) && /0,(19|2\d) km/.test(svTxt) && /GPS no telemóvel/.test(svTxt) && /Partilhar o percurso com o meu profissional/.test(svTxt));
    ck("71. [corrida.js real] O percurso NÃO está marcado para partilhar por omissão", !(await rp.locator("#runSvShare").isChecked()));
    await rp.click("#runSvSave");
    await rp.waitForSelector("#runGoLive");
    await rp.waitForTimeout(200);
    var rr = await rp.evaluate(function(){ var rs = window.__fake.tables.runs; return {n: rs.length, src: rs[0] && rs[0].source, tracks: window.__fake.tables.run_tracks.length, draft: localStorage.getItem("evolve_run_draft_v1"), phase: window.__RUN.live.phase}; });
    ck("72. [corrida.js real] Guardar: 1 corrida «live» na BD, SEM percurso (não partilhou), rascunho apagado e memória limpa", rr.n === 1 && rr.src === "live" && rr.tracks === 0 && rr.draft === null && rr.phase === "intro");
    ck("73. [corrida.js real] Nenhum pedido a terceiros nem coordenadas na consola", R.ctl.external.length === 0 && !R.ctl.consoleMsgs.some(function(m){ return /38\.7|-9\.1/.test(m); }));
    await R.ctx.close();

    // B2. «Cancelar» no ecrã de guardar volta ao resumo; banner com o rascunho no home real
    var R2 = await open({real: true, rls: true});
    var r2p = R2.pg;
    await r2p.evaluate(function(){ window.__fake.tables.run_consents.push({student_id: "ana", version: 2}); });
    await r2p.click('.tabbar [data-tab="corrida"]');
    await r2p.waitForFunction(function(){ return window.__RUN && window.__RUN.loaded && window.__realUi; });
    await r2p.waitForSelector("#runGoLive");
    await r2p.evaluate(function(){ window.__runLiveCfg.tickMs = 150; });
    await r2p.click("#runGoLive");
    await r2p.waitForSelector("#runLiveGo");
    await r2p.click("#runLiveGo");
    await r2p.waitForSelector("#runLivePrepare");
    await r2p.evaluate(function(){ window.__RUN.gps = window.__fakeGps; });
    await r2p.click("#runLivePrepare");
    await r2p.waitForSelector("#runLiveStart");
    await r2p.evaluate(function(){ window.__go(1000, 0, 8); });
    await r2p.waitForFunction(function(){ return !document.getElementById("runLiveStart").disabled; });
    await r2p.click("#runLiveStart");
    await r2p.waitForSelector("#runLivePause");
    await r2p.evaluate(function(){ window.__go(1000, 0); window.__goN(70, 1000, 3); });
    await finishRun(R2);
    await r2p.click("#runLiveReview");
    await r2p.waitForSelector("#runSvCancel");
    await r2p.click("#runSvCancel");
    await r2p.waitForSelector("#runLiveReview");
    ck("74. [corrida.js real] «Cancelar» no ecrã de guardar volta ao resumo da corrida (cancelView) e o rascunho mantém-se", (await ls(r2p, DRAFT)) !== null && /Resumo/.test(await T(r2p, "#runLive")));
    await r2p.evaluate(function(){ window.__RUN.go("home"); });
    await r2p.waitForSelector("#runLiveBanner");
    ck("75. [corrida.js real] No início real da Corrida o banner mostra a corrida terminada por guardar", /Corrida por guardar/i.test(await T(r2p, "#runLiveBanner")) && (await r2p.locator('#runLiveBanner [data-act="review"]').count()) === 1);
    await R2.ctx.close();

    // B3. fila offline com o submitRun real
    var R3 = await open({real: true, rls: true});
    var r3p = R3.pg;
    await r3p.evaluate(function(){ window.__fake.tables.run_consents.push({student_id: "ana", version: 2}); });
    await r3p.click('.tabbar [data-tab="corrida"]');
    await r3p.waitForFunction(function(){ return window.__RUN && window.__RUN.loaded && window.__realUi; });
    await r3p.waitForSelector("#runGoLive");
    await r3p.evaluate(function(){ window.__runLiveCfg.tickMs = 150; });
    await r3p.click("#runGoLive");
    await r3p.waitForSelector("#runLiveGo");
    await r3p.click("#runLiveGo");
    await r3p.waitForSelector("#runLivePrepare");
    await r3p.evaluate(function(){ window.__RUN.gps = window.__fakeGps; });
    await r3p.click("#runLivePrepare");
    await r3p.waitForSelector("#runLiveStart");
    await r3p.evaluate(function(){ window.__go(1000, 0, 8); });
    await r3p.waitForFunction(function(){ return !document.getElementById("runLiveStart").disabled; });
    await r3p.click("#runLiveStart");
    await r3p.waitForSelector("#runLivePause");
    await r3p.evaluate(function(){ window.__go(1000, 0); window.__goN(600, 1000, 3); });
    await finishRun(R3);
    await r3p.click("#runLiveReview");
    await r3p.waitForSelector("#runSvShare");
    await r3p.check("#runSvShare");
    await R3.ctx.setOffline(true);
    await r3p.click("#runSvSave");
    await r3p.waitForFunction(function(k){ return localStorage.getItem(k) !== null; }, OUTBOX);
    var rq = JSON.parse(await ls(r3p, OUTBOX));
    ck("76. [corrida.js real] Sem ligação o submitRun real põe a corrida (e o percurso aparado) na fila do gravador e o rascunho apaga-se", rq.length === 1 && rq[0].item.track && rq[0].item.track.trimM === 200 && (await ls(r3p, DRAFT)) === null && !/"acc"/.test(JSON.stringify(rq)));
    await R3.ctx.setOffline(false);
    await r3p.waitForFunction(function(k){ return localStorage.getItem(k) === null; }, OUTBOX);
    await r3p.waitForTimeout(300);
    var rw3 = await r3p.evaluate(function(){ return {runs: window.__fake.tables.runs.length, tracks: window.__fake.tables.run_tracks.length, inserts: window.__fake.writes.filter(function(w){ return w.table === "runs" && w.op === "insert"; }).length}; });
    ck("77. [corrida.js real] Ao voltar a ligação envia-se uma vez só: 1 corrida, 1 percurso, fila vazia", rw3.runs === 1 && rw3.tracks === 1 && rw3.inserts === 1);
    await R3.ctx.close();
  } else {
    console.log("(corrida.js real ainda não existe: parte B ignorada)");
  }


  // ======================================================================= C. revisão: o que os testes anteriores só cobriam em caminhos simulados
  // C1. duas janelas da mesma app (o mesmo localStorage, eventos «storage» verdadeiros): a segunda não toma nem estraga a corrida que a primeira grava
  var W1 = await open();
  await openCorrida(W1);
  await startRecording(W1);
  await W1.pg.evaluate(function(){ window.__goN(25, 1000, 3); });
  var W2 = await W1.ctx.newPage(); W2.setDefaultTimeout(8000);
  W2.on("pageerror", function(e){ errors.push(e.message); });
  W2.on("dialog", function(d){ d.accept(); });
  await W2.goto(srv.url + "treino.html");
  await W2.waitForSelector("#startWorkout");
  await W2.click('.tabbar [data-tab="corrida"]');
  await W2.waitForFunction(function(){ return window.__RUN && window.__RUN.loaded; });
  await W2.waitForSelector("#runLiveBanner");
  var w2Txt = await T(W2, "#runLiveBanner");
  ck("78. Duas janelas: com a primeira a gravar, a segunda (mesmo armazenamento) NÃO oferece Retomar, Guardar o que há nem Descartar: diz que a corrida está a ser gravada noutra janela",
    /Corrida a ser gravada/i.test(w2Txt) && /noutra janela/.test(w2Txt) && (await W2.locator('#runLiveBanner [data-act="resume"], #runLiveBanner [data-act="save"], #runLiveBanner [data-act="discard"]').count()) === 0 && (await W2.locator('#runLiveBanner [data-act="refresh"]').count()) === 1);
  await finishRun(W1);
  await W1.pg.click("#runLiveDiscard");
  await W2.waitForSelector("#runLiveBanner", {state: "detached"});
  ck("79. O evento «storage» verdadeiro põe a segunda janela em dia: quando a primeira descarta a corrida, o aviso desaparece lá sem recarregar", (await ls(W2, DRAFT)) === null && (await W2.locator("#runLiveBanner").count()) === 0);
  await startRecording(W1);
  await W1.pg.evaluate(function(){ window.__goN(15, 1000, 3); });
  await W2.waitForSelector("#runLiveBanner");
  ck("80. Quando a primeira volta a gravar, o aviso «a ser gravada noutra janela» aparece na segunda sozinho", /Corrida a ser gravada/i.test(await T(W2, "#runLiveBanner")));
  await W1.pg.goto("about:blank");
  await W2.waitForSelector('#runLiveBanner [data-act="resume"]');
  ck("81. Quando a primeira janela fecha (pagehide despede-se do rascunho) a segunda já pode retomar, guardar ou descartar", (await W2.locator('#runLiveBanner [data-act="save"]').count()) === 1 && (await W2.locator('#runLiveBanner [data-act="discard"]').count()) === 1 && JSON.parse(await ls(W2, DRAFT)).rel === true);
  await W1.ctx.close();
  // a primeira janela fica mudo (sem batimento) e a segunda toma a corrida: a primeira cede ao evento «storage»
  var Y1 = await open();
  await openCorrida(Y1);
  await startRecording(Y1);
  await Y1.pg.evaluate(function(){ window.__goN(25, 1000, 3); window.__runLiveCfg.hbStaleMs = 1500; window.__runLiveCfg.draftEveryMs = 3600000; });
  var Y2 = await Y1.ctx.newPage(); Y2.setDefaultTimeout(8000);
  Y2.on("pageerror", function(e){ errors.push(e.message); });
  await Y2.goto(srv.url + "treino.html");
  await Y2.waitForSelector("#startWorkout");
  await Y2.click('.tabbar [data-tab="corrida"]');
  await Y2.waitForFunction(function(){ return window.__RUN && window.__RUN.loaded; });
  var y1Off = await Y1.pg.evaluate(function(){ return window.__off; });     // as duas janelas são do mesmo telemóvel: têm o mesmo relógio
  await Y2.evaluate(function(off){ window.__off = off; window.__runLiveCfg.hbStaleMs = 1500; window.__runLiveCfg.tickMs = 150; window.__RUN.gps = window.__fakeGps; }, y1Off);
  await Y2.waitForTimeout(1900);
  await Y2.waitForSelector("#runLiveBanner");
  await Y2.click('#runLiveBanner [data-act="refresh"]').catch(function(){});
  await Y2.waitForSelector('#runLiveBanner [data-act="resume"]');
  var y1Stops = await Y1.pg.evaluate(function(){ return window.__fakeGps.stops; });
  await Y2.click('#runLiveBanner [data-act="resume"]');
  await Y2.waitForSelector("#runLivePause");
  await Y1.pg.waitForFunction(function(){ return window.__RUN.live.phase === "intro"; });
  var y1 = await Y1.pg.evaluate(function(){ return {stops: window.__fakeGps.stops, st: window.__RUN.live.st, wl: window.__wl.list.every(function(w){ return w.released; }), inst: window.__inst, toast: Array.prototype.map.call(document.querySelectorAll(".toast"), function(t){ return t.textContent; }).join("|")}; });
  var y2inst = await Y2.evaluate(function(){ return window.__inst; });
  ck("82. Se a segunda janela toma a corrida (a primeira estava sem batimento), a primeira cede sozinha pelo evento «storage»: pára o GPS e o Wake Lock, esquece a cópia, avisa, e o rascunho fica com o id da segunda",
    y1.stops === y1Stops + 1 && y1.st === null && y1.wl === true && /noutra janela/.test(y1.toast) && JSON.parse(await ls(Y2, DRAFT)).iid === y2inst && y1.inst !== y2inst && (await live(Y2)).phase === "rec");
  await Y1.ctx.close();

  // C2. relógio: um fix com hora absurda não envenena o resto da gravação; o relógio que recua mostra o aviso (limite conhecido)
  var Ck = await open();
  await openCorrida(Ck);
  await startRecording(Ck);
  await Ck.pg.evaluate(function(){ window.__goN(20, 1000, 3); });
  await Ck.pg.evaluate(function(){ window.__off += 1000; window.__y += 3; window.__fakeGps.onFix({lat: 38.7 + window.__y / 111194.93, lon: -9.1, acc: 5, t: Date.now() + 12000, speed: null}); });
  await Ck.pg.evaluate(function(){ window.__goN(40, 1000, 3); });
  var ckSt = await Ck.pg.evaluate(function(){ var st = window.__RUN.live.st; return {n: st.nPts, dist: st.distM, rejTime: st.rej.time}; });
  ck("83. Um fix com a hora 12 s à frente a meio da corrida (dentro da lacuna de 15 s: o núcleo sozinho recusava os 12 s seguintes) não a envenena: ~60 s a 3 m/s dão ~180 m e só se perdem 2 posições por «hora repetida»; o ecrã continua a dizer «Sinal bom»", ckSt.dist > 150 && ckSt.rejTime <= 3 && /Sinal bom/.test(await T(Ck.pg, "#runLiveSignal")));
  await Ck.pg.evaluate(function(){ window.__off -= 5 * 60000; });
  await Ck.pg.evaluate(function(){ for (var i = 0; i < 8; i++) { window.__off += 1000; window.__y += 3; window.__fakeGps.onFix({lat: 38.7 + window.__y / 111194.93, lon: -9.1, acc: 5, t: Date.now(), speed: null}); } });
  await Ck.pg.waitForFunction(function(){ return /A receber posições que o registo não consegue usar/.test(document.getElementById("runLiveSignal").textContent); });
  ck("84. LIMITE CONHECIDO, agora visível: se o relógio do telemóvel recuar minutos a meio da corrida, as posições seguintes são recusadas até o relógio apanhar o registo, mas o ecrã já não diz «Sinal bom»: avisa e mostra «Reiniciar GPS»; o aluno pode terminar e guardar o que há", (await Ck.pg.locator("#runLiveRestartWrap").isVisible()) && (await live(Ck.pg)).phase === "rec");
  await Ck.pg.click("#runLiveEnd"); await Ck.pg.click("#runLiveEndOk"); await Ck.pg.waitForSelector("#runLiveReview");
  ck("85. Mesmo assim o resumo guarda o que ficou registado antes", await Ck.pg.evaluate(function(){ return window.__RUN.live.st.nPts > 10; }) && /rever e guardar/i.test(await T(Ck.pg, "#runLive")));
  await Ck.ctx.close();

  // C3. Wake Lock libertado pelo sistema com a página visível
  var Wk = await open();
  await openCorrida(Wk);
  await startRecording(Wk);
  var wk0 = await Wk.pg.evaluate(function(){ return window.__wl.requests; });
  await Wk.pg.evaluate(function(){ window.__wl.list[window.__wl.list.length - 1].release(); });
  await Wk.pg.waitForFunction(function(n){ return window.__wl.requests === n + 1; }, wk0);
  ck("86. O sistema libertou o Wake Lock com a página visível: a gravação pede-o outra vez (uma vez) e o ecrã não fica sem aviso nem com aviso falso", (await live(Wk.pg)).wl === "on" && !/Não consegui manter o ecrã ligado/.test(await T(Wk.pg, "#runLiveNotes")));
  await Wk.pg.evaluate(function(){ window.__wl.deny = true; window.__wl.list[window.__wl.list.length - 1].release(); });
  await Wk.pg.waitForFunction(function(){ return /Não consegui manter o ecrã ligado/.test(document.getElementById("runLiveNotes").textContent); });
  ck("87. Se o novo pedido falha aparece «Não consegui manter o ecrã ligado» e a gravação continua", (await live(Wk.pg)).wl === "denied" && (await live(Wk.pg)).phase === "rec");
  await Wk.ctx.close();

  // C4. a fila local deixa de se poder escrever a meio do envio: sem ciclo de pedidos
  var ob2 = function(id){ return {id: id, uid: "user-1", ts: 1, state: "pending", err: "", item: {row: Object.assign({}, preRow, {id: id}), track: null}}; };
  var seedF = {}; seedF[OUTBOX] = JSON.stringify([ob2(RID1), ob2(RID2)]);
  var Fl = await open({seed: seedF, init: function(){ var orig = Storage.prototype.setItem; window.__failOutbox = true; Storage.prototype.setItem = function(k, v){ if (k === "evolve_runs_outbox_v1" && window.__failOutbox) throw new Error("QuotaExceededError"); return orig.call(this, k, v); }; }});
  await openCorrida(Fl);
  await Fl.pg.waitForSelector(".toast.show");
  await Fl.pg.waitForTimeout(1500);
  var flW = await Fl.pg.evaluate(function(){ return window.__fake.writes.filter(function(w){ return w.table === "runs" && w.op === "insert"; }).length; });
  ck("88. Se a fila local não se deixa escrever depois de enviar, o envio pára: 1 pedido (e não centenas), a fila fica como estava e o aluno é avisado", flW === 1 && JSON.parse(await ls(Fl.pg, OUTBOX)).length === 2 && /Não consegui atualizar as corridas por enviar/.test(await Fl.pg.locator(".toast").first().innerText()));
  await Fl.ctx.close();

  // C5. o evento SIGNED_OUT (sessão que acaba fora desta página) pára tudo e apaga o que a Corrida deixou no telemóvel
  var capAuth = function(){ var fake = window.supabase, oc = fake.createClient; fake.createClient = function(){ var c = oc.apply(this, arguments), oa = c.auth.onAuthStateChange; c.auth.onAuthStateChange = function(cb){ window.__authCb = cb; return oa.apply(this, arguments); }; return c; }; };
  var So = await open({init: capAuth});
  await openCorrida(So);
  await startRecording(So);
  await So.pg.evaluate(function(){ window.__goN(30, 1000, 3); localStorage.setItem("evolve_run_consent_v1", JSON.stringify({uid: "user-1", studentId: "ana", version: 2, at: 1})); });
  var haveCb = await So.pg.evaluate(function(){ return typeof window.__authCb === "function"; });
  var soStops = await So.pg.evaluate(function(){ return window.__fakeGps.stops; });
  await So.pg.evaluate(function(seed){ localStorage.setItem("evolve_runs_outbox_v1", seed); }, JSON.stringify([ob2(RID2)]));
  await So.pg.evaluate(function(){ window.__authCb("SIGNED_OUT", null); });
  await So.pg.waitForTimeout(300);
  var soOut = await So.pg.evaluate(function(){ return {stops: window.__fakeGps.stops, phase: window.__RUN.live.phase, st: window.__RUN.live.st, tick: window.__RUN.live.tickId, wl: window.__wl.list.every(function(w){ return w.released; }), draft: localStorage.getItem("evolve_run_draft_v1"), box: localStorage.getItem("evolve_runs_outbox_v1"), rec: localStorage.getItem("evolve_run_consent_v1")}; });
  ck("89. O evento SIGNED_OUT (e não só o botão «Sair») pára o GPS, o relógio e o Wake Lock, esquece a gravação e apaga o rascunho, a fila e o recibo do consentimento", haveCb && soOut.stops === soStops + 1 && soOut.phase === "intro" && soOut.st === null && soOut.tick === null && soOut.wl && soOut.draft === null && soOut.box === null && soOut.rec === null);
  await So.pg.waitForTimeout(600);
  ck("90. E nada volta a escrever o rascunho depois disso", (await ls(So.pg, DRAFT)) === null);
  await So.ctx.close();

  // C6. toque verdadeiro (ecrã tátil, via CDP): a pressão longa desbloqueia, a curta não, e largar não acerta nos botões de baixo
  var Tc = await open({touch: true});
  await openCorrida(Tc);
  await startRecording(Tc);
  await Tc.pg.evaluate(function(){ window.__goN(5, 1000, 3); window.__runLiveCfg.lockHoldMs = 1500; });
  await Tc.pg.tap("#runLiveLockBtn");
  await Tc.pg.waitForSelector("#runLiveLock");
  var cdp = await Tc.ctx.newCDPSession(Tc.pg);
  var pbT = await Tc.pg.locator("#runLivePause").boundingBox(), tx = Math.round(pbT.x + pbT.width / 2), ty = Math.round(pbT.y + pbT.height / 2);
  await cdp.send("Input.dispatchTouchEvent", {type: "touchStart", touchPoints: [{x: tx, y: ty}]});
  await Tc.pg.waitForTimeout(600);
  await cdp.send("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []});
  await Tc.pg.waitForTimeout(150);
  var shortHold = await live(Tc.pg);
  ck("91. Com toque verdadeiro (não rato): uma pressão curta em cima do botão Pausa não faz nada (nem desbloqueia)", shortHold.locked === true && shortHold.paused === false && (await Tc.pg.locator("#runLiveLock").count()) === 1);
  await cdp.send("Input.dispatchTouchEvent", {type: "touchStart", touchPoints: [{x: tx, y: ty}]});
  await Tc.pg.waitForTimeout(1750);
  var covering = await Tc.pg.locator("#runLiveLock").count();
  await cdp.send("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []});
  await Tc.pg.waitForSelector("#runLiveLock", {state: "detached"});
  var longHold = await live(Tc.pg);
  ck("92. Com toque verdadeiro, a pressão longa (~1,5 s) desbloqueia ao largar e o toque de largar não chega ao botão Pausa que está por baixo", covering === 1 && longHold.locked === false && longHold.paused === false);
  await Tc.ctx.close();

  // C7. o profissional desliga a gravação com GPS a meio
  var Ml = await open();
  await openCorrida(Ml);
  await startRecording(Ml);
  await Ml.pg.evaluate(function(){ window.__goN(15, 1000, 3); });
  var mlStops = await Ml.pg.evaluate(function(){ return window.__fakeGps.stops; });
  await Ml.pg.evaluate(function(){ window.__findStudent(window.__state.alunoStudentId).runsMode = "import"; });
  await Ml.pg.waitForSelector("#runLive[data-phase='end']");
  var mlTxt = await T(Ml.pg, "#runLive");
  var mlO = await Ml.pg.evaluate(function(){ return {stops: window.__fakeGps.stops, busy: window.__RUN.liveBusy(), tick: window.__RUN.live.tickId, wl: window.__wl.list.every(function(w){ return w.released; })}; });
  ck("93. Se o modo da Corrida deixa de ser «live» a meio, a gravação não fica órfã: o GPS, o Wake Lock e o relógio param, RUN.liveBusy() é falso e o resumo explica e só oferece «Descartar»", mlO.stops === mlStops + 1 && mlO.busy === false && mlO.tick === null && mlO.wl && /desligada pelo teu profissional/.test(mlTxt) && (await Ml.pg.locator("#runLiveReview").count()) === 0 && (await Ml.pg.locator("#runLiveDiscard").count()) === 1 && JSON.parse(await ls(Ml.pg, DRAFT)).ended === true);
  await Ml.ctx.close();

  // C8. «Reiniciar GPS» (o botão só aparece quando as posições deixam de chegar) e o limite de reinícios automáticos
  var Rg = await open();
  await openCorrida(Rg);
  await startRecording(Rg);
  await Rg.pg.evaluate(function(){ window.__goN(8, 1000, 3); });
  var hiddenAtFirst = !(await Rg.pg.locator("#runLiveRestartWrap").isVisible());
  await Rg.pg.evaluate(function(){ window.__off += 12000; });
  await Rg.pg.waitForFunction(function(){ return document.getElementById("runLiveRestartWrap") && !document.getElementById("runLiveRestartWrap").classList.contains("hidden"); });
  var rgStarts = await Rg.pg.evaluate(function(){ return window.__fakeGps.starts; });
  await Rg.pg.click("#runLiveRestart");
  ck("94. «Reiniciar GPS» só aparece com «Sem posições há N s» (escondido enquanto chegam posições); o toque reinicia o watch", hiddenAtFirst && (await Rg.pg.evaluate(function(){ return window.__fakeGps.starts; })) === rgStarts + 1 && (await live(Rg.pg)).watching);
  await Rg.ctx.close();

  // ======================================================================= no fim
  ck((n + 1) + ". Nenhum erro de JavaScript em nenhuma página e nenhum pedido a terceiros em todo o teste", errors.length === 0 && allExternal.length === 0 || (console.log(errors, allExternal), false));
  ck((n + 1) + ". Nenhuma coordenada na consola de nenhuma página", !allConsole.some(function(m){ return /38\.7\d|-9\.1\d/.test(m); }));
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", String(e && e.stack || e).split("\n").slice(0, 6).join(" | ")); process.exit(1); });
