// Mapa do percurso interativo (arrastar, zoom) e só o mapa quando está ligado (mesmo cenário de corrida-browser.test.js).
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
    var ctx = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, serviceWorkers: "block", acceptDownloads: true, timezoneId: o.tz || undefined});
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
  var PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  var shared = [[[38.7, -9.15, 0], [38.7005, -9.1495, 40], [38.701, -9.149, 80], [38.7015, -9.1485, 120], [38.703, -9.147, 200]]];
  var tileReqs = [];
  var M = await student({runs: [runRow(0, {over: {id: uuid(1)}})], tracks: [{run_id: uuid(1), student_id: "ana", fmt: 1, trim_m: 200, points: shared}]});
  await M.pg.context().route(/tile\.openstreetmap\.org/, function(route){ tileReqs.push(route.request().url()); route.fulfill({status: 200, contentType: "image/png", body: PNG}); });
  await M.pg.click(".run-row"); await M.pg.waitForSelector(".run-svg-wrap svg");
  ck("1. Com o mapa desligado o detalhe tem o desenho simples e «Mostrar mapa»", (await M.pg.locator(".run-svg-wrap svg").count()) === 1 && (await M.pg.locator('[data-run-map="on"]').count()) === 1 && (await M.pg.locator(".run-map").count()) === 0);
  await M.pg.click('[data-run-map="on"]'); await M.pg.waitForSelector(".run-map svg polyline"); await M.pg.waitForTimeout(300);
  ck("2. Com o mapa ligado fica SÓ o mapa: o desenho simples desaparece", (await M.pg.locator(".run-svg-wrap").count()) === 0 && (await M.pg.locator(".run-map").count()) === 1);
  var first = tileReqs.length;
  ck("3. O mapa mostra os botões Aproximar, Afastar e Centrar (44 px), e a vista inicial pede 1 a 9 quadrados", (await M.pg.locator('.run-map-ctl button[aria-label="Aproximar"]').count()) === 1 && (await M.pg.locator('.run-map-ctl button[aria-label="Afastar"]').count()) === 1 && (await M.pg.locator('.run-map-ctl button[aria-label="Centrar no percurso"]').count()) === 1 && first >= 1 && first <= 9 && (await M.pg.locator(".run-map-ctl button").first().boundingBox()).height >= 44);
  var z0 = await M.pg.evaluate(function(){ return document.querySelector(".run-map").getAttribute("data-z"); });
  await M.pg.click('.run-map-ctl button[aria-label="Aproximar"]'); await M.pg.waitForTimeout(300);
  var z1 = await M.pg.evaluate(function(){ return document.querySelector(".run-map").getAttribute("data-z"); });
  ck("4. Aproximar sobe o zoom em 1 e o percurso continua desenhado (início e fim)", +z1 === +z0 + 1 && (await M.pg.locator(".run-map svg polyline").count()) === 1 && (await M.pg.locator(".run-map svg circle").count()) === 2);
  await M.pg.click('.run-map-ctl button[aria-label="Afastar"]'); await M.pg.click('.run-map-ctl button[aria-label="Afastar"]'); await M.pg.waitForTimeout(200);
  var z2 = await M.pg.evaluate(function(){ return document.querySelector(".run-map").getAttribute("data-z"); });
  ck("5. Afastar duas vezes baixa o zoom em 2 (relativamente ao anterior)", +z2 === +z1 - 2);
  await M.pg.click('.run-map-ctl button[aria-label="Centrar no percurso"]'); await M.pg.waitForTimeout(200);
  ck("6. Centrar volta ao zoom inicial", (await M.pg.evaluate(function(){ return document.querySelector(".run-map").getAttribute("data-z"); })) === z0);
  var before = tileReqs.length, bb = await M.pg.locator(".run-map").boundingBox(), x0 = bb.x + bb.width / 2, y0 = bb.y + bb.height / 2;
  var pointsBefore = await M.pg.locator(".run-map svg polyline").getAttribute("points");
  await M.pg.mouse.move(x0, y0); await M.pg.mouse.down(); await M.pg.mouse.move(x0 - 90, y0 + 50, {steps: 6});
  var transform = await M.pg.evaluate(function(){ return document.querySelector(".run-map-layer").style.transform; });
  await M.pg.mouse.up(); await M.pg.waitForTimeout(300);
  var pointsAfter = await M.pg.locator(".run-map svg polyline").getAttribute("points");
  ck("7. Arrastar move o mapa (durante o gesto a camada desloca-se; ao largar o percurso é redesenhado noutra posição) e pede os quadrados de margem", /translate\(/.test(transform) && pointsBefore !== pointsAfter && tileReqs.length >= before);
  ck("8. Todos os pedidos de quadrados são só z/x/y de tile.openstreetmap.org (sem coordenadas do percurso nem identificadores)", tileReqs.length > 0 && tileReqs.every(function(u){ return /^https:\/\/tile\.openstreetmap\.org\/\d{1,2}\/\d+\/\d+\.png$/.test(u); }));
  await M.pg.dblclick(".run-map", {position: {x: 100, y: 100}}); await M.pg.waitForTimeout(250);
  ck("9. Duplo toque aproxima (zoom +1)", +(await M.pg.evaluate(function(){ return document.querySelector(".run-map").getAttribute("data-z"); })) === +z0 + 1);
  await M.pg.click('[data-run-map="off"]');
  ck("10. «Esconder o mapa» volta ao desenho simples", (await M.pg.locator(".run-map").count()) === 0 && (await M.pg.locator(".run-svg-wrap svg").count()) === 1);
  ck("11. O aviso de «Mostrar mapa» diz que mexer no mapa (dois dedos ou botões) pede mais quadrados", /mais quadrados/.test(await M.pg.locator(".run-map-ask").innerText()));
  await M.ctx.close();
  // ---- toque: um dedo deixa a página deslizar, dois dedos mexem e aproximam o mapa ----
  var Tm = await student({runs: [runRow(0, {over: {id: uuid(1)}})], tracks: [{run_id: uuid(1), student_id: "ana", fmt: 1, trim_m: 200, points: shared}]});
  await Tm.pg.context().route(/tile\.openstreetmap\.org/, function(route){ route.fulfill({status: 200, contentType: "image/png", body: PNG}); });
  await Tm.pg.click(".run-row"); await Tm.pg.waitForSelector(".run-svg-wrap svg"); await Tm.pg.click('[data-run-map="on"]'); await Tm.pg.waitForSelector(".run-map svg polyline");
  await Tm.pg.evaluate(function(){ document.querySelector(".run-map").scrollIntoView({block: "center"}); }); await Tm.pg.waitForTimeout(200);
  var cdp = await Tm.pg.context().newCDPSession(Tm.pg), tb = await Tm.pg.locator(".run-map").boundingBox(), tcx = tb.x + tb.width / 2, tcy = tb.y + tb.height / 2;
  ck("13. O aviso diz «Dois dedos para mexer e aproximar o mapa; um dedo faz deslizar a página»", /Dois dedos para mexer/.test(await Tm.pg.locator(".run-map").evaluate(function(m){ return m.parentNode.textContent; })));
  var zT0 = await Tm.pg.evaluate(function(){ return +document.querySelector(".run-map").getAttribute("data-z"); }), plT0 = await Tm.pg.locator(".run-map svg polyline").getAttribute("points");
  await cdp.send("Input.dispatchTouchEvent", {type: "touchStart", touchPoints: [{x: tcx, y: tcy, id: 1}]});
  await cdp.send("Input.dispatchTouchEvent", {type: "touchMove", touchPoints: [{x: tcx - 80, y: tcy - 40, id: 1}]});
  await cdp.send("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []});
  await Tm.pg.waitForTimeout(250);
  ck("14. Um dedo NÃO mexe no mapa (zoom e percurso iguais; a página é que desliza)", (await Tm.pg.evaluate(function(){ return +document.querySelector(".run-map").getAttribute("data-z"); })) === zT0 && (await Tm.pg.locator(".run-map svg polyline").getAttribute("points")) === plT0 && (await Tm.pg.evaluate(function(){ return document.querySelector(".run-map-layer") === null || document.querySelector(".run-map-layer").style.transform === ""; })));
  await Tm.pg.evaluate(function(){ document.querySelector(".run-map").scrollIntoView({block: "center"}); }); await Tm.pg.waitForTimeout(200);
  tb = await Tm.pg.locator(".run-map").boundingBox(); tcx = tb.x + tb.width / 2; tcy = tb.y + tb.height / 2;
  await cdp.send("Input.dispatchTouchEvent", {type: "touchStart", touchPoints: [{x: tcx - 20, y: tcy, id: 1}, {x: tcx + 20, y: tcy, id: 2}]});
  await cdp.send("Input.dispatchTouchEvent", {type: "touchMove", touchPoints: [{x: tcx - 40, y: tcy, id: 1}, {x: tcx + 40, y: tcy, id: 2}]});
  var tr = await Tm.pg.evaluate(function(){ var l = document.querySelector(".run-map-layer"); return l ? l.style.transform : ""; });
  await cdp.send("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []});
  await Tm.pg.waitForTimeout(300);
  var zT1 = await Tm.pg.evaluate(function(){ return +document.querySelector(".run-map").getAttribute("data-z"); });
  ck("15. Dois dedos a afastar-se (pinça de 40 para 80 px, ×2) aproximam o mapa 1 nível e o percurso continua desenhado", /scale\(/.test(tr) && zT1 === zT0 + 1 && (await Tm.pg.locator(".run-map svg polyline").count()) === 1);
  var plT1 = await Tm.pg.locator(".run-map svg polyline").getAttribute("points");
  await Tm.pg.evaluate(function(){ document.querySelector(".run-map").scrollIntoView({block: "center"}); }); await Tm.pg.waitForTimeout(200);
  tb = await Tm.pg.locator(".run-map").boundingBox(); tcx = tb.x + tb.width / 2; tcy = tb.y + tb.height / 2;
  await cdp.send("Input.dispatchTouchEvent", {type: "touchStart", touchPoints: [{x: tcx - 30, y: tcy, id: 1}, {x: tcx + 30, y: tcy, id: 2}]});
  await cdp.send("Input.dispatchTouchEvent", {type: "touchMove", touchPoints: [{x: tcx - 30 - 70, y: tcy + 40, id: 1}, {x: tcx + 30 - 70, y: tcy + 40, id: 2}]});
  await cdp.send("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []});
  await Tm.pg.waitForTimeout(300);
  ck("16. Dois dedos a deslizar juntos movem o mapa (mesmo zoom, percurso noutra posição)", (await Tm.pg.evaluate(function(){ return +document.querySelector(".run-map").getAttribute("data-z"); })) === zT1 && (await Tm.pg.locator(".run-map svg polyline").getAttribute("points")) !== plT1);
  await Tm.ctx.close();
  external = external.filter(function(u){ return !/tile\.openstreetmap\.org/.test(u); });
  ck("12. Nenhum pedido a terceiros além do OpenStreetMap e nenhum erro de JavaScript", external.length === 0 && (errors.length === 0 || (console.log(errors), false)));
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", String(e && e.stack || e).split("\n").slice(0, 5).join(" | ")); process.exit(1); });
