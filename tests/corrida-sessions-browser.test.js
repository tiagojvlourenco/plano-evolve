// Treinos de cardio estruturados: o profissional prescreve, o aluno vê, escolhe um pronto ou monta o seu (mesmo cenário de corrida-browser.test.js).
// Corrida, ecrãs do aluno e do profissional (corrida.js) no Chromium, com o Supabase simulado (tests/helpers/fake-supabase.js, runsRls ligado:
// as regras de INSERT do servidor — modo ligado, consentimento da versão, só o aluno cria — valem aqui como no servidor real).
// O corrida-core.js e o corrida.js são os REAIS; o corrida-live.js é de MENTIRA (servido por Playwright route, só dentro deste teste: a fila e o
// ecrã de gravação só existem para provar o contrato entre os dois ficheiros). O gravador real tem os seus próprios testes.
// O que isto NÃO prova: o Supabase real (RLS, CHECKs e gatilhos estão em tests/runs-db.test.js, num Postgres local), o Safari/WebKit ou o Firefox,
// o seletor de ficheiros, a partilha (navigator.share) e a descarga num iPhone ou Android reais, ficheiros reais de relógios, nem o GPS.
require("./setup")();
var fs = require("fs"), path = require("path");
var check = require("./check")();
var root = path.join(__dirname, "..");
var n = 0;
function ck(desc, cond){ n++; if (parseInt(desc, 10) !== n) console.log("AVISO: verificação numerada " + parseInt(desc, 10) + " na posição " + n); check.check(desc, !!cond); }

var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){ console.log("(ignorado: Playwright/Chromium não disponíveis aqui)"); check.summarize(); }
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");
var appSource = require("./extract-app")();
eval(appSource);   // só para fabricar as fichas dos alunos (buildFullDemoStudent / studentToRow)

// o núcleo, em Node, só para fabricar entradas e conferir contas (nada disto precisa de DOM)
var coreCode = fs.readFileSync(path.join(root, "corrida-core.js"), "utf8");
var topNames = [], mm, reNames = /^(?:function\s+(\w+)|var\s+(\w+))/gm;
while ((mm = reNames.exec(coreCode))) topNames.push(mm[1] || mm[2]);
var C = (function(){ "use strict"; return eval(coreCode + "\n;({" + topNames.map(function(x){ return x + ": " + x; }).join(", ") + "})"); })();

function row(id, name, runsMode){
  authRole = "professional";
  var s = buildFullDemoStudent(); s.id = id; s.name = name; s.isDemo = false; s.active = true; s.photos = [];
  s.nutritionPhase = null;
  var r = JSON.parse(JSON.stringify(studentToRow(s)));
  if (runsMode !== undefined) r.runs_mode = runsMode;
  return r;
}
function uuid(i){ var h = ("0000000" + i.toString(16)).slice(-8); return h + "-1111-4111-8111-" + ("000000000000" + i.toString(16)).slice(-12); }

// ---- ficheiros sintéticos: nPts pontos, um de `dt` em `dt` segundos, `step` metros entre eles; com loopy o rumo vai rodando (1,2 voltas), como numa
// volta ao bairro (uma reta seria reduzida a 2 pontos pela simplificação) ----
var LAT0 = 38.7, LON0 = -9.15, M = 111320;
function track(nPts, step, dt, t0, loopy){
  var out = [], i, la = LAT0, lo = LON0, b = Math.PI / 6, turn = loopy ? 2 * Math.PI * 1.2 / nPts : 0;
  for (i = 0; i < nPts; i++){
    out.push({lat: +la.toFixed(6), lon: +lo.toFixed(6), t: t0 + i * dt * 1000});
    la += step * Math.cos(b) / M; lo += step * Math.sin(b) / (M * Math.cos(la * Math.PI / 180)); b += turn;
  }
  return out;
}
function isoZ(ms){ return new Date(ms).toISOString().replace(".000Z", "Z"); }
function gpxOf(pts, extra){
  return '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="RELOGIO" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>' + (extra || "Treino") + '</name><trkseg>' +
    pts.map(function(p){ return '<trkpt lat="' + p.lat + '" lon="' + p.lon + '"><time>' + isoZ(p.t) + '</time></trkpt>'; }).join("") + '</trkseg></trk></gpx>';
}
function tcxOf(pts){
  return '<?xml version="1.0" encoding="UTF-8"?>\n<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Running"><Id>' + isoZ(pts[0].t) + '</Id><Lap StartTime="' + isoZ(pts[0].t) + '"><Track>' +
    pts.map(function(p){ return '<Trackpoint><Time>' + isoZ(p.t) + '</Time><Position><LatitudeDegrees>' + p.lat + '</LatitudeDegrees><LongitudeDegrees>' + p.lon + '</LongitudeDegrees></Position></Trackpoint>'; }).join("") + '</Track></Lap></Activity></Activities></TrainingCenterDatabase>';
}
var T_RUN = Date.now() - 3 * 86400000;          // 3 dias atrás
var P5K = track(340, 15, 5, T_RUN, true);        // ~5 km a 5:30/km
var P5K_B = track(340, 15, 5, T_RUN - 86400000, true);   // outro dia (não é duplicado)
var P400 = track(40, 10, 4, T_RUN - 2 * 86400000, false);   // ~400 m
var PFAST = track(120, 40, 5, T_RUN - 4 * 86400000, false);  // 8 m/s = 28,8 km/h
var EXP5K = C.runStats([P5K], null, "import");
var HAV = C.runHav;

// ---- luz de mentira do gravador (corrida-live.js): só o contrato ----
function liveStub(o){
  o = o || {};
  return [
    "window.__T = {RUN: RUN, runStats: runStats, runBuildInsert: runBuildInsert, runUuid: runUuid, runPrepareTrack: runPrepareTrack, findStudent: findStudent, state: state};",
    "RUN.liveOpen = function(s){ window.__liveOpen = (window.__liveOpen || 0) + 1; RUN.go('live'); };",
    "RUN.liveScreen = function(sv){ return '<div class=\"card\" id=\"fakeLive\">gravador de mentira</div>'; };",
    "RUN.liveWire = function(s, el){ window.__liveWired = (window.__liveWired || 0) + 1; };",
    "RUN.liveDraftBanner = function(s){ return window.__draft ? '<div class=\"card\" id=\"fakeBanner\">rascunho por terminar</div>' : ''; };",
    "RUN.liveWireBanner = function(s, el){ window.__bannerWired = (window.__bannerWired || 0) + 1; };",
    o.queue ? "RUN.queueAdd = function(item){ (window.__queue = window.__queue || []).push(JSON.parse(JSON.stringify(item))); return true; };" : "",
    // contrato novo com o gravador: contagens e limpeza da fila, recibo local do consentimento, gravação em curso
    o.queue ? "RUN.queuePending = function(){ return window.__qPending || 0; }; RUN.queueFailed = function(){ return window.__qFailed || 0; }; RUN.queueClear = function(id){ (window.__qClear = window.__qClear || []).push(id); return 0; };" : "",
    o.cache ? "window.__cache = window.__cache || {}; window.__cacheLog = []; RUN.consentCacheGet = function(id){ var v = window.__cache[id]; return typeof v === 'number' ? v : null; };" +
      " RUN.consentCacheSet = function(id, v){ window.__cache[id] = v; window.__cacheLog.push(['set', id, v]); };" +
      " RUN.consentCacheClear = function(id){ delete window.__cache[id]; window.__cacheLog.push(['clear', id]); };" : "",
    "RUN.liveBusy = function(){ return !!window.__busy; };",
    // espião: o que corrida.js passa a runPrepareTrack (o gravador é o último ficheiro avaliado: vê as mesmas declarações)
    "window.__prepCalls = []; var runPrepSpy = runPrepareTrack; runPrepareTrack = function(seg, opt){ window.__prepCalls.push({trimM: opt && opt.trimM, rnd: opt && opt.rnd}); return runPrepSpy(seg, opt); };",
    "RUN.reset = function(){ window.__resetCalls = (window.__resetCalls || 0) + 1; };",
    "RUN.loaded = true;"
  ].join("\n");
}
// espião: nenhuma chamada ao GPS do telemóvel vindo de corrida.js
var GEO_SPY = function(){
  window.__geo = 0; window.__toasts = [];
  try {
    new MutationObserver(function(ms){ ms.forEach(function(m){ Array.prototype.forEach.call(m.addedNodes, function(nd){ if (nd.classList && nd.classList.contains("toast")) window.__toasts.push(nd.textContent); }); }); }).observe(document, {childList: true, subtree: true});
  } catch (e) {}
  try {
    ["getCurrentPosition", "watchPosition"].forEach(function(k){
      var orig = navigator.geolocation && navigator.geolocation[k];
      if (orig) navigator.geolocation[k] = function(){ window.__geo++; return orig.apply(this, arguments); };
    });
  } catch (e) {}
};

var ZERO_DEL = function(){
  var cl = window.supabase.createClient(), of = cl.from.bind(cl);
  cl.from = function(t){
    var b = of(t);
    if (/^run/.test(t)){
      var del = b.delete.bind(b);
      b.delete = function(){ del(); var sel = false; b.select = function(){ sel = true; return b; }; b.then = function(res, rej){ return Promise.resolve({data: sel ? [] : null, error: null, status: 200}).then(res, rej); }; return b; };
    }
    return b;
  };
};
var EXPECTED_COLS = ["consent_v", "distance_m", "duration_s", "gap_s", "gaps", "hidden_s", "id", "moving_s", "notes", "rpe", "source", "splits_s", "started_at", "student_id"];
var NOCOORD = /38\.7\d{2}|-9\.1\d{2}/;   // as coordenadas das nossas pistas

(async function(){
  var srv = await startStaticServer(root);
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [], consoleMsgs = [], external = [], allUrls = [], allToasts = [];
  async function open(role, rows, page, o){
    o = o || {};
    var ctl = {dialogs: [], answer: true, answers: null, requests: []};
    var ctx = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: "block", acceptDownloads: true, timezoneId: o.tz || undefined});
    await ctx.addInitScript(fakeSource({role: role, userId: role === "professional" ? "pro-1" : "user-1", email: "ana@x.test", rows: rows, runsRls: o.rls !== false, missingTables: o.missingTables, missingTableCode: o.missingCode}));
    await ctx.addInitScript(GEO_SPY);
    if (o.init) await ctx.addInitScript(o.init);
    if (o.seed) await ctx.addInitScript(function(seed){ try { Object.keys(seed).forEach(function(k){ localStorage.setItem(k, seed[k]); }); } catch (e) {} }, o.seed);
    if (!o.realLive) await ctx.route(/\/corrida-live\.js(\?|$)/, function(route){ ctl.requests.push("live"); route.fulfill({status: 200, contentType: "text/javascript", body: liveStub({queue: o.queue !== false, cache: o.cache !== false})}); });
    // o gravador REAL é servido como está; só se lhe acrescenta, no fim do mesmo eval, um puxador para o teste chegar a RUN e a runUuid
    else await ctx.route(/\/corrida-live\.js(\?|$)/, async function(route){ var resp = await route.fetch(); route.fulfill({response: resp, body: (await resp.text()) + "\n;window.__T = {RUN: RUN, runUuid: runUuid};"}); });
    var pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
    var realClose = ctx.close.bind(ctx);
    ctx.close = async function(){ try { (await pg.evaluate(function(){ return window.__toasts || []; })).forEach(function(t){ allToasts.push(t); }); } catch (e) {} return realClose(); };
    pg.on("pageerror", function(e){ errors.push(e.message); });
    pg.on("console", function(m){ consoleMsgs.push(m.text()); });
    pg.on("dialog", function(d){
      ctl.dialogs.push(d.message());
      var yes = ctl.answers && ctl.answers.length ? ctl.answers.shift() : ctl.answer;
      if (yes) d.accept(); else d.dismiss();
    });
    pg.on("request", function(r){
      var u = r.url();
      allUrls.push(u);
      if (!/^http:\/\/127\.0\.0\.1/.test(u) && !/^(data|blob|about):/.test(u)) external.push(u);
      if (/\/corrida(-core|-live)?\.js/.test(u)) ctl.requests.push(u.replace(/^.*\//, "").replace(/\?.*$/, ""));
    });
    await pg.goto(srv.url + (page || ""));
    return {ctx: ctx, pg: pg, ctl: ctl};
  }
  var tabText = function(pg){ return pg.locator("#alunoTabContent").innerText(); };
  var fake = function(pg, fn, arg){ return pg.evaluate(fn, arg); };
  var writes = function(pg){ return pg.evaluate(function(){ return window.__fake.writes; }); };
  var tables = function(pg){ return pg.evaluate(function(){ return JSON.parse(JSON.stringify(window.__fake.tables)); }); };
  var seedConsent = function(pg, sid){ return pg.evaluate(function(id){ window.__fake.tables.run_consents.push({student_id: id, version: 1, accepted_at: "2026-10-01T10:00:00Z"}); }, sid); };
  var seedRuns = function(pg, list){ return pg.evaluate(function(l){ l.forEach(function(r){ window.__fake.tables.runs.push(r); }); }, list); };
  var seedTrack = function(pg, rec){ return pg.evaluate(function(r){ window.__fake.tables.run_tracks.push(r); }, rec); };
  function runRow(i, o){
    o = o || {};
    var started = new Date(Date.now() - (i + 1) * 86400000 - 3600000).toISOString();
    return Object.assign({id: uuid(i + 1), student_id: o.sid || "ana", created_by: "user-1", created_at: started, started_at: started, source: "gpx", duration_s: 1800, moving_s: 1780, distance_m: 5000 + i * 10,
      gaps: 0, gap_s: 0, hidden_s: 0, splits_s: [360, 355, 350, 362, 358], rpe: 6, notes: null, consent_v: 1}, o.over || {});
  }
  async function goCorrida(pg){
    await pg.waitForSelector("#startWorkout");
    await pg.click('.tabbar [data-tab="corrida"]');
  }
  // abre a app EVOLVE Treino como aluno «import», com consentimento dado, no separador Corrida (lista carregada)
  async function student(o){
    o = o || {};
    var X = await open("student", [row("ana", "Ana Treina", o.mode || "import")], "treino.html", o);
    if (o.consent !== false) await seedConsent(X.pg, "ana");
    if (o.runs) await seedRuns(X.pg, o.runs);
    if (o.tracks) for (var i = 0; i < o.tracks.length; i++) await seedTrack(X.pg, o.tracks[i]);
    await goCorrida(X.pg);
    await X.pg.waitForSelector(o.wait || "#runGoImport");
    if (o.settle !== false) await X.pg.waitForSelector("#runEmpty, .run-row, #runLoadErr, #runMissing");
    return X;
  }
  var toast = function(pg){ return pg.locator(".toast").last().innerText(); };
  async function importFile(X, name, content, type){
    await X.pg.click("#runGoImport");
    await X.pg.waitForSelector("#runFile", {state: "attached"});
    await X.pg.setInputFiles("#runFile", {name: name, mimeType: type || "application/gpx+xml", buffer: Buffer.isBuffer(content) ? content : Buffer.from(content)});
  }

  // ==================================================================================================================== A. visibilidade
  var A = await student({consent: false});
  var txtA = await tabText(A.pg);
  ck("1. Modo «import»: o aluno vê «Importar ficheiro (GPX ou TCX)» e «Registar à mão», e NÃO vê «Gravar com GPS»", /Importar ficheiro \(GPX ou TCX\)/i.test(txtA) && /Registar à mão/i.test(txtA) && !/Gravar com GPS/i.test(txtA));
  ck("2. Lista vazia amigável e o guia «Como obter o ficheiro» com a ressalva «Não testámos todas as apps»", /Ainda não tens corridas\. Importa um ficheiro ou regista a primeira à mão\./.test(txtA) && /Como obter o ficheiro/.test(txtA));
  await A.pg.locator("#runGuide summary").click();
  var guide = await A.pg.locator("#runGuide").innerText();
  ck("3. O guia só diz o que a especificação afirma (Suunto, COROS, Strava, Garmin, Polar; Apple sem exportação própria; Nike sem confirmação) e traz a ressalva «Não testámos todas as apps»", /Não testámos todas as apps/.test(guide) && /Suunto/.test(guide) && /COROS/.test(guide) && /Strava: só no site/.test(guide) && /Garmin Connect/.test(guide) && /Polar Flow/.test(guide) && /Apple Fitness: não exporta um treino sozinho/.test(guide) && /Nike Run Club: não confirmámos nenhuma exportação/.test(guide));
  ck("4. Nenhuma linha de música no ecrã da Corrida (nem botões Spotify/Apple Music/YouTube Music)", (await A.pg.locator("[data-music], .playlist-row").count()) === 0 && !/Spotify|Apple Music|YouTube Music/.test(txtA + guide));
  ck("5. O texto de privacidade diz o que fica guardado e onde (Supabase) e que a localização é um dado sensível", /Privacidade e dados/.test(txtA));

  n = 0;
  function localToday(){ var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function withSessions(id, mode, list){ var r = row(id, "Ana Treina", mode); r.training_program = Object.assign({}, r.training_program, {cardioSessions: list}); return r; }
  var SES = [{id: "c1", name: "Repetições 8 × 400 m", activity: "run", kind: "intervals", date: localToday(), intervals: {warmupMin: 10, reps: 8, work: {unit: "m", value: 400}, rest: {unit: "s", value: 90}, cooldownMin: 5}},
    {id: "c2", name: "Pedal de 60 min", activity: "bike", kind: "goal", goal: {unit: "min", value: 60}}];

  var S = await open("student", [withSessions("ana", "live", SES)], "treino.html");
  await S.pg.waitForSelector("#startWorkout"); await seedConsent(S.pg, "ana");
  await S.pg.click('.tabbar [data-tab="corrida"]'); await S.pg.waitForSelector("#runSessions");
  var tx = await S.pg.locator("#runSessions").innerText();
  ck("1. O aluno vê «Treinos» com os do profissional (nome, resumo «8 × 400 m (recuperação 90 s)», bicicleta marcada) e botões «Começar»", /Repetições 8 × 400 m/.test(tx) && /Aquecimento 10 min · 8 × 400 m \(recuperação 90 s\) · Arrefecimento 5 min/.test(tx) && /Pedal de 60 min/.test(tx) && /Meta: 60 min/.test(tx) && (await S.pg.locator('[data-sess-start^="p:"]').count()) === 2);
  ck("2. Há «Treinos prontos» (8) e «Montar o meu treino»", (await S.pg.locator("#runSessTpl li").count()) === 8 && (await S.pg.locator("#runSessOwn").count()) === 1);
  await S.pg.click('[data-sess-start="p:0"]');
  await S.pg.waitForSelector("#fakeLive");
  var got = await S.pg.evaluate(function(){ var r = window.__T.RUN; return {opened: window.__liveOpen, sess: r.session && r.session.name, act: r.activity}; });
  ck("3. «Começar» entrega o treino ao gravador (RUN.session) e abre o ecrã de gravação", got.opened === 1 && got.sess === "Repetições 8 × 400 m" && got.act === "run");
  await S.ctx.close();

  var S2 = await open("student", [withSessions("ana", "live", SES)], "treino.html");
  await S2.pg.waitForSelector("#startWorkout"); await seedConsent(S2.pg, "ana");
  await S2.pg.click('.tabbar [data-tab="corrida"]'); await S2.pg.waitForSelector("#runSessions");
  await S2.pg.click('[data-sess-start="p:1"]'); await S2.pg.waitForSelector("#fakeLive");
  ck("4. Escolher o treino de bicicleta muda a atividade para Bicicleta", (await S2.pg.evaluate(function(){ return window.__T.RUN.activity; })) === "bike");
  await S2.ctx.close();

  var S3 = await open("student", [withSessions("ana", "live", [])], "treino.html");
  await S3.pg.waitForSelector("#startWorkout"); await seedConsent(S3.pg, "ana");
  await S3.pg.click('.tabbar [data-tab="corrida"]'); await S3.pg.waitForSelector("#runSessions");
  ck("5. Sem treinos do profissional diz que pode escolher um pronto ou montar o seu", /Sem treinos do teu profissional/.test(await S3.pg.locator("#runSessions").innerText()));
  await S3.pg.locator("#runSessTpl summary").click();
  await S3.pg.click('[data-sess-start="t:1"]'); await S3.pg.waitForSelector("#fakeLive");
  ck("6. Um treino pronto («5 × 1000 m») começa sem o profissional ter prescrito nada", (await S3.pg.evaluate(function(){ return window.__T.RUN.session.name; })) === "5 × 1000 m");
  await S3.ctx.close();

  var S4 = await open("student", [withSessions("ana", "live", [])], "treino.html");
  await S4.pg.waitForSelector("#startWorkout"); await seedConsent(S4.pg, "ana");
  await S4.pg.click('.tabbar [data-tab="corrida"]'); await S4.pg.waitForSelector("#runSessions");
  await S4.pg.locator("#runSessOwn summary").click();
  await S4.pg.click("#runSessOwnGo");
  ck("7. Montar o meu treino sem nome dá uma mensagem de erro e não começa", /Confirma o nome e os valores/.test(await S4.pg.locator("#runSessErr").innerText()) && (await S4.pg.locator("#fakeLive").count()) === 0);
  await S4.pg.fill("#ssName", "Os meus 6 × 800"); await S4.pg.fill("#ssReps", "6"); await S4.pg.fill("#ssWork", "800"); await S4.pg.fill("#ssRest", "120");
  await S4.pg.click("#runSessOwnGo"); await S4.pg.waitForSelector("#fakeLive");
  var own = await S4.pg.evaluate(function(){ return window.__T.RUN.session; });
  ck("8. Montar o meu treino (6 × 800 m, recuperação 120 s) valida e começa", own.name === "Os meus 6 × 800" && own.intervals.reps === 6 && own.intervals.work.value === 800 && own.intervals.rest.value === 120);
  await S4.pg.evaluate(function(){ window.__T.RUN.go("home"); });
  await S4.pg.waitForSelector("#runGoLive");
  await S4.pg.click("#runGoLive");
  await S4.pg.waitForSelector("#fakeLive");
  ck("9. «Gravar com GPS» (sem treino) limpa o treino: nenhum guia", (await S4.pg.evaluate(function(){ return window.__T.RUN.session; })) === null);
  await S4.ctx.close();

  var S5 = await open("student", [withSessions("ana", "import", SES)], "treino.html");
  await S5.pg.waitForSelector("#startWorkout"); await seedConsent(S5.pg, "ana");
  await S5.pg.click('.tabbar [data-tab="corrida"]'); await S5.pg.waitForSelector("#runSessions");
  ck("10. Sem a gravação por GPS o aluno vê os treinos mas sem botão «Começar», com a nota a explicar", (await S5.pg.locator("[data-sess-start]").count()) === 0 && /ligar a gravação por GPS/.test(await S5.pg.locator("#runSessions").innerText()));
  await S5.ctx.close();

  var P = await open("professional", [row("a", "Ana Silva", "live")], "index.html");
  await P.pg.waitForSelector(".student-row");
  await P.pg.locator('[data-open="a"]').first().click(); await P.pg.waitForSelector("#proBack");
  await P.pg.click('.pro-nav-item[data-g="treino"]'); await P.pg.click('[data-sub="corridas"]');
  await P.pg.waitForSelector("#proTabContent #runEmpty, #proTabContent .run-row"); await P.pg.waitForSelector("#runSessionsPro");
  await P.pg.locator("#runSessionsPro summary").click();
  await P.pg.fill("#psName", "Repetições 8 × 400 m"); await P.pg.fill("#psDate", localToday());
  await P.pg.waitForTimeout(300);
  await P.pg.click("#psAdd");
  await P.pg.waitForSelector('[data-sess-del]');
  await P.pg.waitForTimeout(2200);
  var wr = (await writes(P.pg)).filter(function(x){ return x.table === "students" && x.payload && "training_program" in x.payload; }).slice(-1)[0];
  var saved = wr && wr.payload.training_program.cardioSessions;
  ck("11. O profissional prescreve «8 × 400 m» e fica gravado na ficha (cardioSessions) com a data e os valores", saved && saved.length === 1 && saved[0].name === "Repetições 8 × 400 m" && saved[0].date === localToday() && saved[0].intervals.reps === 8 && saved[0].intervals.work.value === 400 && /^c/.test(saved[0].id));
  await P.pg.click('[data-sess-del]');
  await P.pg.waitForFunction(function(){ return !document.querySelector("[data-sess-del]"); });
  await P.pg.waitForTimeout(2200);
  var wr2 = (await writes(P.pg)).filter(function(x){ return x.table === "students" && x.payload && "training_program" in x.payload; }).slice(-1)[0];
  ck("12. Remover tira-o da ficha", wr2 && (wr2.payload.training_program.cardioSessions || []).length === 0);
  await P.ctx.close();
  ck("13. Nenhum erro de JavaScript", errors.length === 0 || (console.log(errors), false));
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", String(e && e.stack || e).split("\n").slice(0, 5).join(" | ")); process.exit(1); });
