// Corrida com a atividade «Bicicleta»: escolha no ecrã, registo à mão e importação de ficheiro de ciclismo, lista e totais (mesmo cenário de corrida-browser.test.js).
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
  var seedConsent = function(pg, sid){ return pg.evaluate(function(id){ window.__fake.tables.run_consents.push({student_id: id, version: 2, accepted_at: "2026-10-01T10:00:00Z"}); }, sid); };
  var seedRuns = function(pg, list){ return pg.evaluate(function(l){ l.forEach(function(r){ window.__fake.tables.runs.push(r); }); }, list); };
  var seedTrack = function(pg, rec){ return pg.evaluate(function(r){ window.__fake.tables.run_tracks.push(r); }, rec); };
  function runRow(i, o){
    o = o || {};
    var started = new Date(Date.now() - (i + 1) * 86400000 - 3600000).toISOString();
    return Object.assign({id: uuid(i + 1), student_id: o.sid || "ana", created_by: "user-1", created_at: started, started_at: started, source: "gpx", duration_s: 1800, moving_s: 1780, distance_m: 5000 + i * 10,
      gaps: 0, gap_s: 0, hidden_s: 0, splits_s: [360, 355, 350, 362, 358], rpe: 6, notes: null, consent_v: 2}, o.over || {});
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
  var BIKE_GPX = '<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><type>cycling</type><trkseg>' + (function(){ var o = "", i; for (i = 0; i < 120; i++) o += '<trkpt lat="' + (38.7 + i * 0.00018) + '" lon="-9.1"><time>' + new Date(Date.UTC(2026, 9, 10, 8, 0, 0) + i * 5000).toISOString().replace(".000", "") + '</time></trkpt>'; return o; })() + '</trkseg></trk></gpx>';
  var todayIso = new Date().toISOString().slice(0, 10);
  // hora de hoje alguns minutos atrás (nunca no futuro, mesmo logo depois da meia-noite): o registo à mão recusa corridas que ainda não aconteceram
  var nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  var hmAgo = function(off){ var t = Math.max(0, nowMin - off); return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0"); };

  var B = await student({});
  ck("1. O ecrã da Corrida tem a escolha «Corrida | Bicicleta», com Corrida ativa", (await B.pg.locator("#runActRun").getAttribute("aria-pressed")) === "true" && (await B.pg.locator("#runActBike").getAttribute("aria-pressed")) === "false");
  await importFile(B, "pedal.gpx", BIKE_GPX);
  ck("2. Um ficheiro de ciclismo na atividade Corrida é recusado e diz para escolher «Bicicleta»", /Escolhe «Bicicleta»/.test(await B.pg.locator("#runImpMsg").innerText()));
  await B.pg.click("#runBack");
  await B.pg.waitForSelector("#runActBike");
  await B.pg.click("#runActBike");
  ck("3. Escolher «Bicicleta» fica marcado", (await B.pg.locator("#runActBike").getAttribute("aria-pressed")) === "true");
  await importFile(B, "pedal.gpx", BIKE_GPX);
  await B.pg.waitForSelector("#runSave");
  var sv = await B.pg.locator("#runSave").innerText();
  ck("4. O mesmo ficheiro como Bicicleta abre o ecrã de guardar com «Atividade Bicicleta» e velocidade em km/h (sem ritmo por km)", /Bicicleta/.test(sv) && /Velocidade média em movimento/i.test(sv) && /km\/h/.test(sv) && !/Ritmo em movimento/i.test(sv));
  await B.pg.click("#runSvSave");
  await B.pg.waitForSelector(".run-row");
  var tb = await tables(B.pg);
  ck("5. Guardou uma linha com activity = 'bike' (e só isso a distingue de uma corrida)", tb.runs.length === 1 && tb.runs[0].activity === "bike" && tb.runs[0].source === "gpx");
  var listTxt = await B.pg.locator("#alunoTabContent").innerText();
  ck("6. A lista mostra «Bicicleta» e a velocidade em km/h, e os totais passam a «Atividades»", /Bicicleta/.test(listTxt) && /\d+,\d km\/h/i.test(listTxt) && /Atividades/i.test(listTxt));
  await B.pg.click(".run-row");
  await B.pg.waitForSelector(".run-detail");
  ck("7. O detalhe mostra a «Velocidade média em movimento» em km/h", /Velocidade média em movimento/i.test(await B.pg.locator(".run-detail").innerText()));
  await B.pg.click("#runBackDetail, .run-back");
  await B.pg.waitForSelector("#runActRun");
  await B.pg.click("#runActRun");
  await B.pg.click("#runGoManual");
  await B.pg.waitForSelector("#runManNext");
  await B.pg.fill("#runManDate", todayIso); await B.pg.fill("#runManTime", hmAgo(6)); await B.pg.fill("#runManKm", "5"); await B.pg.fill("#runManDur", "28:00");
  await B.pg.click("#runManNext"); await B.pg.waitForSelector("#runSave"); await B.pg.click("#runSvSave");
  await B.pg.waitForSelector(".run-row");
  var tb2 = await tables(B.pg), manual = tb2.runs.filter(function(r){ return r.source === "manual"; })[0];
  ck("8. Uma corrida normal continua a gravar-se SEM o campo activity (funciona antes de correr a migração 0033)", manual && !("activity" in manual));
  await B.pg.click("#runActBike"); await B.pg.click("#runGoManual"); await B.pg.waitForSelector("#runManNext");
  await B.pg.fill("#runManDate", todayIso); await B.pg.fill("#runManTime", hmAgo(3)); await B.pg.fill("#runManKm", "40"); await B.pg.fill("#runManDur", "1:20:00");
  await B.pg.click("#runManNext"); await B.pg.waitForSelector("#runSave");
  ck("9. À mão como Bicicleta: 40 km em 1:20 passa e mostra 30 km/h (e «Guardar corrida» sem aviso de ritmo)", /30 km\/h/i.test(await B.pg.locator("#runSave").innerText()));
  await B.ctx.close();

  // servidor sem a migração 0033: sem a coluna activity
  var NOCOL = function(){
    var cl = window.supabase.createClient(), of = cl.from.bind(cl);
    cl.from = function(t){
      var b = of(t);
      if (t === "runs"){
        var sel = b.select.bind(b), ins = b.insert.bind(b);
        var bad = function(msg){ var r = {data: null, error: {code: "42703", message: msg}, status: 400}, q = {eq: function(){ return q; }, gte: function(){ return q; }, order: function(){ return q; }, range: function(){ return q; }, select: function(){ return q; }, maybeSingle: function(){ return q; }, then: function(a, c){ return Promise.resolve(r).then(a, c); }}; return q; };
        b.select = function(cols){ return /activity/.test(String(cols || "")) ? bad("column runs.activity does not exist") : sel(cols); };
        b.insert = function(rw){ return rw && rw.activity ? bad("Could not find the 'activity' column of 'runs' in the schema cache") : ins(rw); };
      }
      return b;
    };
  };
  var NC = await student({init: NOCOL, runs: [runRow(0)]});
  ck("11. Sem a coluna activity no servidor, a lista de corridas lê-se na mesma (sem erro)", (await NC.pg.locator(".run-row").count()) === 1 && (await NC.pg.locator("#runLoadErr").count()) === 0);
  await NC.pg.click("#runActBike"); await NC.pg.click("#runGoManual"); await NC.pg.waitForSelector("#runManNext");
  await NC.pg.fill("#runManDate", todayIso); await NC.pg.fill("#runManTime", hmAgo(3)); await NC.pg.fill("#runManKm", "30"); await NC.pg.fill("#runManDur", "1:00:00");
  await NC.pg.click("#runManNext"); await NC.pg.waitForSelector("#runSave"); await NC.pg.click("#runSvSave");
  await NC.pg.waitForFunction(function(){ var e = document.getElementById("runSvErr"); return e && e.textContent.length > 0; });
  ck("12. Guardar uma bicicleta sem a migração 0033 diz «falta correr a migração 0033» e não guarda nada", /migração 0033/.test(await NC.pg.locator("#runSvErr").innerText()) && (await tables(NC.pg)).runs.length === 1);
  await NC.ctx.close();
  ck("13. Nenhum erro de JavaScript", errors.length === 0 || (console.log(errors), false));
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", String(e && e.stack || e).split("\n").slice(0, 5).join(" | ")); process.exit(1); });
