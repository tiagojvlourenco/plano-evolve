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
  await A.pg.locator("#runPrivacy summary").click();
  var priv = await A.pg.locator("#runPrivacy").innerText();
  ck("6. Privacidade: «Supabase», «frequência cardíaca», «dado sensível» e os botões «Retirar consentimento» (sem «Apagar todas» enquanto não há corridas)", /Supabase/.test(priv) && /frequência cardíaca/.test(priv) && /dado sensível/.test(priv) && (await A.pg.locator("#runWithdraw").count()) === 1 && (await A.pg.locator("#runDelAll").count()) === 0);
  await A.ctx.close();

  var AL = await student({mode: "live", consent: false});
  var txtL = await tabText(AL.pg);
  ck("7. Modo «live» (com o gravador carregado): aparece «Gravar com GPS» e o aviso do ecrã (pode falhar; não testado em todos os telemóveis), sem afirmar que funciona com o ecrã bloqueado", (await AL.pg.locator("#runGoLive").count()) === 1 && /ecrã bloquear/.test(txtL) && /pode falhar/.test(txtL) && /Ainda não testámos/.test(txtL) && !/funciona com o ecrã bloqueado/i.test(txtL));
  AL.pg.on("dialog", function(){});
  await AL.pg.click("#runGoLive");
  await AL.pg.waitForSelector("#runConsent");
  ck("8. «Gravar com GPS» sem consentimento mostra primeiro o aviso de privacidade (que diz que o GPS só liga depois de «Gravar com GPS» e «Preparar GPS») e o gravador ainda NÃO abriu", /Corridas: antes de começares/.test(await tabText(AL.pg)) && /O GPS do telemóvel só liga depois de carregares em «Gravar com GPS» e em «Preparar GPS»/.test(await tabText(AL.pg)) && !(await AL.pg.evaluate(function(){ return window.__liveOpen; })));
  await AL.pg.click("#runCsAccept");
  await AL.pg.waitForSelector("#fakeLive");
  ck("9. Depois de aceitar, o gravador abre (RUN.liveOpen chamado uma vez) e o ecrã é o do gravador; sem música (a página de primeiro plano não pode sair)", (await AL.pg.evaluate(function(){ return window.__liveOpen; })) === 1 && (await AL.pg.locator("[data-music]").count()) === 0 && (await AL.pg.evaluate(function(){ return window.__liveWired; })) >= 1);
  ck("10. A geolocalização do telemóvel nunca é pedida por corrida.js (só o gravador o faz)", (await AL.pg.evaluate(function(){ return window.__geo; })) === 0);
  await AL.ctx.close();

  var AB = await student({mode: "live", consent: true});
  await AB.pg.evaluate(function(){ window.__draft = true; });
  await AB.pg.click('.tabbar [data-tab="hoje"]'); await AB.pg.waitForSelector("#startWorkout");
  await AB.pg.click('.tabbar [data-tab="corrida"]'); await AB.pg.waitForSelector("#fakeBanner");
  var firstKid = await AB.pg.locator("#alunoTabContent").evaluate(function(el){ return Array.prototype.map.call(el.children, function(c){ return c.className + "#" + c.id; }); });
  ck("11. O rascunho do gravador (RUN.liveDraftBanner) fica no topo da vista «home», antes dos botões, e os seus eventos são ligados (RUN.liveWireBanner)", firstKid.join(" ").indexOf("fakeBanner") >= 0 && firstKid.join(" ").indexOf("fakeBanner") < firstKid.join(" ").indexOf("run-actions") && (await AB.pg.evaluate(function(){ return window.__bannerWired; })) >= 1);
  await AB.ctx.close();

  // ==================================================================================================================== B. consentimento
  var B = await student({consent: false});
  await B.pg.click("#runGoImport");
  await B.pg.waitForSelector("#runConsent");
  var cons = await tabText(B.pg);
  ck("12. Importar sem consentimento mostra o aviso «Corridas: antes de começares» (o que fica guardado, quem vê, apagar, retirar) com «Aceito e continuar» e «Agora não», e já não diz que a EVOLVE não ativa o GPS", /Corridas: antes de começares/.test(cons) && /Fica guardado no servidor: a data e a hora de início/.test(cons) && /Quem vê: tu e os profissionais da EVOLVE/.test(cons) && /Se retirares este consentimento, apagamos todas as tuas corridas/.test(cons) && /Aceito e continuar/i.test(cons) && /Agora não/i.test(cons) && !/não ativa o GPS do telemóvel/.test(cons));
  ck("13. Enquanto não aceita, nada é escrito no servidor", (await tables(B.pg)).run_consents.length === 0 && (await writes(B.pg)).filter(function(w){ return /run/.test(w.table); }).length === 0);
  await B.pg.click("#runCsDecline");
  await B.pg.waitForSelector("#runGoImport");
  ck("14. «Agora não» volta ao início sem escrever nada e sem abrir o ecrã de importar", (await B.pg.locator("#runFile").count()) === 0 && (await tables(B.pg)).run_consents.length === 0);
  await B.pg.click("#runGoManual");
  await B.pg.waitForSelector("#runConsent");
  await B.pg.click("#runCsAccept");
  await B.pg.waitForSelector("#runManual");
  var tb = await tables(B.pg), wb = (await writes(B.pg)).filter(function(w){ return w.table === "run_consents"; });
  ck("15. Aceitar grava UMA linha em run_consents (aluno e versão 1, só essas colunas; a data é do servidor) e segue para o que se pediu (Registar à mão)", tb.run_consents.length === 1 && tb.run_consents[0].student_id === "ana" && tb.run_consents[0].version === 1 && wb.length === 1 && wb[0].cols.sort().join() === "student_id,version");
  await B.pg.click("#runBack"); await B.pg.waitForSelector("#runGoImport");
  await B.pg.click("#runGoImport");
  await B.pg.waitForSelector("#runFile", {state: "attached"});
  ck("16. Com o consentimento já dado, o aviso não volta (vai direto ao ecrã de importar)", (await B.pg.locator("#runConsent").count()) === 0);
  await B.ctx.close();

  // o consentimento já existia no servidor mas a leitura não o viu (duas sessões): o 23505 do insert é tolerado e segue-se
  var CD = await student({consent: true, init: function(){
    var cl = window.supabase.createClient(), of = cl.from.bind(cl), done = false;
    cl.from = function(t){
      var b = of(t);
      if (t === "run_consents"){
        b.then = function(res, rej){
          if (b.op === "select" && !done){ done = true; return Promise.resolve({data: [], error: null, status: 200}).then(res, rej); }
          return Promise.resolve(b.run()).then(res, rej);
        };
      }
      return b;
    };
  }});
  await CD.pg.click("#runGoImport");
  await CD.pg.waitForSelector("#runConsent");
  await CD.pg.click("#runCsAccept");
  await CD.pg.waitForSelector("#runFile", {state: "attached"});
  ck("17. Se o consentimento já estava registado (23505 ao aceitar), segue-se na mesma, sem erro e sem linha repetida", (await tables(CD.pg)).run_consents.length === 1);
  await CD.ctx.close();

  var B2 = await student({consent: false});
  var denied = await B2.pg.evaluate(async function(){
    var T = window.__T, s = T.findStudent("ana");
    var row = T.runBuildInsert({id: T.runUuid(), studentId: "ana", source: "gpx", startedAtMs: Date.now() - 86400000, durationS: 1800, movingS: 1790, distM: 5000, gaps: 0, gapS: 0, splitsS: [], hiddenS: 0, rpe: null, notes: "", consentV: 1}, Date.now());
    var res = await T.RUN.submitRun(s, {row: row, track: null});
    return {res: res, runs: window.__fake.tables.runs.length};
  });
  ck("18. Sem consentimento o servidor recusa (RLS) e submitRun devolve {ok:false, permanent:true} com texto fixo, sem a mensagem do servidor, e nada fica na tabela", denied.res.ok === false && denied.res.permanent === true && /consentimento/.test(denied.res.error) && !/row-level|policy/i.test(denied.res.error) && denied.runs === 0);
  await B2.ctx.close();

  // ==================================================================================================================== C. importar
  var Cc = await student({});
  await Cc.pg.click("#runGoImport");
  await Cc.pg.waitForSelector("#runFile", {state: "attached"});
  ck("19. O seletor de ficheiros não tem o atributo accept (o WebKit trata mal tipos desconhecidos; sem filtro aceita-se qualquer ficheiro e valida-se o conteúdo)", (await Cc.pg.locator("#runFile").getAttribute("accept")) === null && /Aceitamos \.gpx e \.tcx/.test(await tabText(Cc.pg)));
  await Cc.pg.setInputFiles("#runFile", {name: "corrida-NOMESECRETO-Joana.gpx", mimeType: "application/gpx+xml", buffer: Buffer.from(gpxOf(P5K, "Nome secreto da atividade"))});
  await Cc.pg.waitForSelector("#runSave");
  var sv = await tabText(Cc.pg);
  ck("20. Importar um GPX mostra «Confirma antes de guardar» com data, hora, distância, tempo, ritmo e origem, e o percurso desenhado em SVG (role=img, sem mapa)", /Confirma antes de guardar/.test(sv) && sv.indexOf(C.runDistStr(EXP5K.distM)) >= 0 && /Hora de início/i.test(sv) && /Ritmo em movimento/i.test(sv) && /Ficheiro GPX/i.test(sv) && (await Cc.pg.locator('#runSave svg.run-svg[role="img"]').count()) === 1 && (await Cc.pg.locator("#runSave img, #runSave iframe").count()) === 0);
  ck("21. A distância mostrada é a do núcleo para estes pontos (" + C.runDistStr(EXP5K.distM) + ") e há parciais por quilómetro", EXP5K.distM > 4500 && EXP5K.splitsS.length >= 4 && (await Cc.pg.locator("#runSave .run-split").count()) === EXP5K.splitsS.length);
  ck("22. «Partilhar o percurso com o meu profissional» vem DESMARCADO; as opções de aparar só aparecem ao marcar; «Exportar GPX (percurso completo, só para ti)» disponível", (await Cc.pg.locator("#runSvShare").isChecked()) === false && !(await Cc.pg.locator("#runSvShareOpts").isVisible()) && /Exportar GPX \(percurso completo, só para ti\)/i.test(sv) && /Se não partilhares, o percurso apaga-se deste telemóvel ao guardar/.test(sv) && (await Cc.pg.locator("#runSvNotes").getAttribute("maxlength")) === "300" && (await Cc.pg.locator("#runSvRpe option").count()) === 11);
  await Cc.pg.check("#runSvShare");
  ck("23. Ao marcar aparecem 0 (Não esconder), 100, 200 (recomendado, escolhido) e 500 m com a explicação do risco", (await Cc.pg.locator("#runSvShareOpts").isVisible()) && (await Cc.pg.locator('input[name="runSvTrim"]').count()) === 4 && (await Cc.pg.locator('input[name="runSvTrim"]:checked').getAttribute("value")) === "200" && /200 m \(recomendado\)/.test(await Cc.pg.locator("#runSvShareOpts").innerText()) && /reduz o risco, mas não o elimina/.test(await Cc.pg.locator("#runSvShareOpts").innerText()));
  await Cc.pg.click('label.run-opt:has(input[value="0"])');
  ck("24. Escolher «Não esconder» avisa: «O profissional vai ver exatamente onde começaste e acabaste.»", await Cc.pg.locator("#runSvTrim0").isVisible());
  await Cc.pg.click('label.run-opt:has(input[value="200"])');
  await Cc.pg.uncheck("#runSvShare");
  // guardar SEM partilhar: só a tabela runs
  await Cc.pg.selectOption("#runSvRpe", "7");
  await Cc.pg.fill("#runSvNotes", "Boa sessão <b>negrito</b>");
  await Cc.pg.click("#runSvSave");
  await Cc.pg.waitForSelector("#runGoImport");
  await Cc.pg.waitForSelector(".run-row");
  var wr = (await writes(Cc.pg)).filter(function(w){ return /^runs?$|run_tracks/.test(w.table) && w.op === "insert"; });
  var tc = await tables(Cc.pg), saved = tc.runs[0];
  ck("25. Guardar sem partilhar escreve SÓ em «runs» (nenhum pedido a run_tracks) e a linha tem exatamente as colunas esperadas", wr.length === 1 && wr[0].table === "runs" && wr[0].cols.slice().sort().join() === EXPECTED_COLS.join() && tc.run_tracks.length === 0);
  ck("26. A linha tem a origem gpx, a versão do consentimento, esforço 7, a nota e os números do núcleo; id uuid; sem created_by/created_at do telemóvel; sem NENHUMA coordenada", saved.source === "gpx" && saved.consent_v === 1 && saved.rpe === 7 && saved.notes === "Boa sessão <b>negrito</b>" && saved.distance_m === EXP5K.distM && saved.duration_s === EXP5K.durationS && /^[0-9a-f-]{36}$/.test(saved.id) && !NOCOORD.test(JSON.stringify(wr[0].payload)) && Object.keys(wr[0].payload).indexOf("created_by") < 0);
  ck("27. O nome do ficheiro e o nome da atividade não ficam em lado nenhum (nem na linha, nem no ecrã, nem no armazenamento)", JSON.stringify(tc).indexOf("NOMESECRETO") < 0 && JSON.stringify(tc).indexOf("Nome secreto") < 0 && (await tabText(Cc.pg)).indexOf("NOMESECRETO") < 0 && (await Cc.pg.evaluate(function(){ return JSON.stringify(Object.keys(localStorage).map(function(k){ return localStorage.getItem(k); })); })).indexOf("NOMESECRETO") < 0);
  var home = await tabText(Cc.pg);
  ck("28. Depois de guardar: aviso «Corrida guardada.», a lista mostra a corrida (distância, origem) e os totais das últimas 8 semanas contam-na", /Corrida guardada\./.test(await toast(Cc.pg)) && home.indexOf(C.runDistStr(EXP5K.distM)) >= 0 && /Últimas 8 semanas/i.test(home) && /As minhas corridas/i.test(home) && (await Cc.pg.locator(".run-row").count()) === 1 && (await Cc.pg.locator(".run-weeks .kpi").first().innerText()).replace(/\s+/g, " ").indexOf("1") >= 0);
  ck("29. A nota é mostrada como texto (o HTML escrito não vira elementos)", (await Cc.pg.locator(".run-row b").count()) === 0 && home.indexOf("<b>negrito</b>") >= 0);
  // duplicado
  await importFile(Cc, "a.gpx", gpxOf(P5K));
  await Cc.pg.waitForSelector("#runSave");
  await Cc.pg.waitForSelector("#runSvDup:not(.hidden)");
  ck("30. Importar a mesma corrida outra vez avisa que já existe uma parecida (mesma hora, distância ±2 %)", /Já tens uma corrida parecida/.test(await Cc.pg.locator("#runSvDup").innerText()));
  Cc.ctl.answer = false;
  await Cc.pg.click("#runSvSave");
  await Cc.pg.waitForTimeout(300);
  ck("31. Ao guardar, pergunta «Guardar mesmo assim?»; recusando nada é escrito", Cc.ctl.dialogs.some(function(d){ return /Já tens uma corrida parecida neste momento\. Guardar mesmo assim\?/.test(d); }) && (await tables(Cc.pg)).runs.length === 1 && (await Cc.pg.locator("#runSave").count()) === 1);
  Cc.ctl.answer = true;
  await Cc.pg.click("#runSvSave");
  await Cc.pg.waitForSelector("#runGoImport");
  ck("32. Aceitando, guarda-se a segunda (a decisão é do aluno)", (await tables(Cc.pg)).runs.length === 2);
  // partilhar
  await importFile(Cc, "b.gpx", C.runToGpx({startedAtMs: P5K_B[0].t}, [P5K_B]));
  await Cc.pg.waitForSelector("#runSave");
  await Cc.pg.check("#runSvShare");
  await Cc.pg.click("#runSvSave");
  await Cc.pg.waitForSelector("#runGoImport");
  await Cc.pg.waitForSelector(".run-row >> nth=2");
  var t3 = await tables(Cc.pg), trk = t3.run_tracks[0], w3 = (await writes(Cc.pg)).filter(function(w){ return w.table === "run_tracks"; });
  var runOfTrack = t3.runs.filter(function(r){ return r.id === (trk && trk.run_id); })[0];
  ck("33. Partilhando, escreve também em run_tracks (run_id, student_id, fmt 1, trim_m 200, points) para a corrida certa", t3.run_tracks.length === 1 && !!runOfTrack && trk.student_id === "ana" && trk.fmt === 1 && trk.trim_m === 200 && Array.isArray(trk.points) && w3.length === 1);
  var startPt = P5K_B[0], endPt = P5K_B[P5K_B.length - 1], allPts = [].concat.apply([], trk.points);
  var minStart = Math.min.apply(null, allPts.map(function(p){ return HAV(startPt.lat, startPt.lon, p[0], p[1]); })), minEnd = Math.min.apply(null, allPts.map(function(p){ return HAV(endPt.lat, endPt.lon, p[0], p[1]); }));
  ck("34. O percurso partilhado NÃO tem nenhum ponto a menos de 200 m da partida nem da chegada (e tem pontos), em segundos inteiros desde o início", allPts.length > 20 && minStart >= 200 && minEnd >= 200 && allPts.every(function(p){ return p.length === 3 && Math.floor(p[2]) === p[2]; }));
  ck("35. A corrida guardada com percurso partilhado tem os números da corrida INTEIRA (a distância não é a do percurso aparado)", Math.abs(runOfTrack.distance_m - C.runStats([P5K_B], null, "import").distM) <= 1);
  // curto demais para aparar
  await importFile(Cc, "c.gpx", gpxOf(P400.concat([])));
  await Cc.pg.waitForSelector("#runSave");
  await Cc.pg.check("#runSvShare");
  await Cc.pg.click('label.run-opt:has(input[value="500"])');
  await Cc.pg.click("#runSvSave");
  await Cc.pg.waitForSelector("#runGoImport");
  var t4 = await tables(Cc.pg);
  ck("36. Corrida curta demais para esconder 500 m: guarda só os números e avisa «curta demais para mostrar o percurso»; nenhum percurso é escrito", t4.runs.length === 4 && t4.run_tracks.length === 1 && /curta demais/.test(await toast(Cc.pg)));
  // TCX
  await importFile(Cc, "d.tcx", tcxOf(track(300, 15, 5, T_RUN - 5 * 86400000, true)), "application/vnd.garmin.tcx+xml");
  await Cc.pg.waitForSelector("#runSave");
  ck("37. Importar TCX funciona e a origem é «Ficheiro TCX»", /Ficheiro TCX/i.test(await tabText(Cc.pg)));
  await Cc.pg.click("#runSvSave"); await Cc.pg.waitForSelector("#runGoImport");
  ck("38. A linha do TCX tem source «tcx»", (await tables(Cc.pg)).runs.filter(function(r){ return r.source === "tcx"; }).length === 1);
  // cancelar
  await importFile(Cc, "e.gpx", gpxOf(track(300, 15, 5, T_RUN - 6 * 86400000, true)));
  await Cc.pg.waitForSelector("#runSave");
  var before = (await tables(Cc.pg)).runs.length;
  await Cc.pg.click("#runSvCancel");
  await Cc.pg.waitForSelector("#runFile", {state: "attached"});
  ck("39. «Cancelar» volta ao ecrã de importar sem escrever nada", (await tables(Cc.pg)).runs.length === before && (await Cc.pg.locator("#runSave").count()) === 0);
  await Cc.ctx.close();

  // ficheiros maus
  var Ch = await student({});
  async function badFile(name, content, re, type){
    await importFile(Ch, name, content, type);
    await Ch.pg.waitForFunction(function(){ var m = document.getElementById("runImpMsg"); return m && m.textContent && m.textContent !== "A processar…"; });
    var msg = await Ch.pg.locator("#runImpMsg").innerText();
    var onSave = await Ch.pg.locator("#runSave").count();
    await Ch.pg.click("#runBack"); await Ch.pg.waitForSelector("#runGoImport");
    return re.test(msg) && onSave === 0;
  }
  var fitBuf = Buffer.alloc(64); fitBuf.writeUInt8(14, 0); fitBuf.write(".FIT", 8, "latin1");
  ck("40. Um ficheiro FIT é recusado em português («Ficheiros FIT ainda não são suportados»), sem avançar", await badFile("treino.fit", fitBuf, /Ficheiros FIT ainda não são suportados/, "application/octet-stream"));
  ck("41. XML com DOCTYPE/ENTITY (bomba de expansão) é recusado antes de ser lido: «Por segurança, não aceitamos este tipo de ficheiro XML»", await badFile("x.gpx", '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">]><gpx><trk><trkseg><trkpt lat="1" lon="1"><time>2026-10-01T10:00:00Z</time></trkpt></trkseg></trk>&lol2;</gpx>', /Por segurança, não aceitamos este tipo de ficheiro XML/));
  ck("42. Texto que não é GPX nem TCX diz «Não consegui ler este ficheiro»", await badFile("lixo.txt", "isto nao e xml <<<", /Não consegui ler este ficheiro/, "text/plain"));
  ck("43. Um GPX sem horas explica porquê e sugere «Registar à mão»", await badFile("sem-horas.gpx", '<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>' + P5K.slice(0, 30).map(function(p){ return '<trkpt lat="' + p.lat + '" lon="' + p.lon + '"/>'; }).join("") + '</trkseg></trk></gpx>', /não tem horas/));
  ck("44. Um ficheiro com quase nenhuma deslocação (menos de 100 m) é recusado", await badFile("parado.gpx", gpxOf(track(30, 1, 5, T_RUN, false)), /Quase não há deslocação/));
  ck("45. Um ficheiro de 16 MB (acima do limite) é recusado sem o ler: «demasiado grande (máximo 15 MB)»", await badFile("grande.gpx", Buffer.alloc(16 * 1024 * 1024, 32), /demasiado grande \(máximo 15 MB\)/));
  var evilPage = await tabText(Ch.pg);
  ck("46. Depois de todos os ficheiros maus nada foi escrito no servidor e a app continua a funcionar", (await tables(Ch.pg)).runs.length === 0 && (await writes(Ch.pg)).filter(function(w){ return /run/.test(w.table); }).length === 0 && /Importar ficheiro/i.test(evilPage));
  // velocidade média alta
  await importFile(Ch, "rapido.gpx", gpxOf(PFAST));
  await Ch.pg.waitForSelector("#runSave");
  ck("47. Velocidade média acima de 25 km/h avisa («muito alta para corrida. Tens a certeza?»)", /A velocidade média é de \d+,\d km\/h, muito alta para corrida\. Tens a certeza\?/.test(await Ch.pg.locator("#runSvWarns").innerText()));
  await Ch.pg.click("#runSvCancel"); await Ch.pg.waitForSelector("#runFile", {state: "attached"});
  var PGAP = P5K.slice(0, 100).concat(P5K.slice(119));   // ~95 s sem posições a meio
  await Ch.pg.setInputFiles("#runFile", {name: "lacuna.gpx", mimeType: "application/gpx+xml", buffer: Buffer.from(gpxOf(PGAP))});
  await Ch.pg.waitForSelector("#runSave");
  ck("48. Uma lacuna de sinal no ficheiro aparece no resumo («Lacunas: 1 (…sem posições; não contam para a distância)»)", /Lacunas: 1 \(\d+:\d\d sem posições; não contam para a distância\)/.test(await tabText(Ch.pg)));
  await Ch.ctx.close();

  // exportar GPX antes de guardar
  var Ce = await student({});
  await importFile(Ce, "e.gpx", gpxOf(P5K));
  await Ce.pg.waitForSelector("#runSave");
  var dlP = Ce.pg.waitForEvent("download");
  await Ce.pg.click("#runSvExport");
  var dl = await dlP, dlText = fs.readFileSync(await dl.path(), "utf8");
  ck("49. «Exportar GPX (percurso completo, só para ti)» descarrega um GPX 1.1 com o percurso completo (sem aparar), sem nome nem autor, e o nome do ficheiro só tem a data", /^corrida-\d{4}-\d{2}-\d{2}\.gpx$/.test(dl.suggestedFilename()) && /<gpx version="1.1"/.test(dlText) && (dlText.match(/<trkpt /g) || []).length === P5K.length && !/<name>|<author>|NOMESECRETO/.test(dlText));
  ck("50. Exportar não escreveu nada no servidor", (await writes(Ce.pg)).filter(function(w){ return /run/.test(w.table); }).length === 0);
  await Ce.ctx.close();

  // ==================================================================================================================== D. à mão
  var D = await student({});
  await D.pg.click("#runGoManual");
  await D.pg.waitForSelector("#runManual");
  var todayIso = await D.pg.evaluate(function(){ var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); });
  ck("51. O formulário à mão traz a data de hoje (local) e não deixa escolher o futuro (max = hoje)", (await D.pg.inputValue("#runManDate")) === todayIso && (await D.pg.getAttribute("#runManDate", "max")) === todayIso);
  await D.pg.fill("#runManKm", "0"); await D.pg.fill("#runManDur", "99:99"); await D.pg.click("#runManNext");
  var e1 = await D.pg.locator("#runManErr").innerText();
  ck("52. Distância e tempo inválidos mostram os avisos em português e não avançam", /Indica uma distância entre 0,1 e 300 km\./.test(e1) && /Indica o tempo, por exemplo 32:15 ou 1:05:30\./.test(e1) && (await D.pg.locator("#runSave").count()) === 0);
  await D.pg.fill("#runManKm", "10"); await D.pg.fill("#runManDur", "10:00"); await D.pg.click("#runManNext");
  ck("53. Uma combinação impossível (10 km em 10 min) avisa «velocidade impossível»", /velocidade impossível/.test(await D.pg.locator("#runManErr").innerText()));
  await D.pg.evaluate(function(){ var i = document.getElementById("runManDate"); i.max = ""; });
  var tomorrow = await D.pg.evaluate(function(){ var d = new Date(Date.now() + 86400000 * 2); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); });
  await D.pg.fill("#runManDate", tomorrow); await D.pg.fill("#runManKm", "5,2"); await D.pg.fill("#runManDur", "28:30"); await D.pg.click("#runManNext");
  ck("54. Uma data no futuro avisa «A data não pode ser no futuro.»", /A data não pode ser no futuro\./.test(await D.pg.locator("#runManErr").innerText()));
  var yesterdayIso = await D.pg.evaluate(function(){ var d = new Date(Date.now() - 86400000); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); });
  await D.pg.fill("#runManDate", yesterdayIso); await D.pg.fill("#runManTime", "07:15"); await D.pg.click("#runManNext");
  await D.pg.waitForSelector("#runSave");
  var mt = await tabText(D.pg);
  ck("55. À mão passa pelo mesmo ecrã «Confirma antes de guardar», sem percurso: sem SVG, sem partilhar, sem exportar, sem parciais", /Confirma antes de guardar/.test(mt) && /À mão/i.test(mt) && (await D.pg.locator("#runSave svg").count()) === 0 && (await D.pg.locator("#runSvShare").count()) === 0 && (await D.pg.locator("#runSvExport").count()) === 0 && /5,20 km/.test(mt) && /28:30/.test(mt) && /07:15/.test(mt));
  await D.pg.click("#runSvCancel");
  await D.pg.waitForSelector("#runManual");
  ck("56. «Cancelar» volta ao formulário com o que se escreveu", (await D.pg.inputValue("#runManKm")) === "5,2" && (await D.pg.inputValue("#runManDur")) === "28:30" && (await D.pg.inputValue("#runManTime")) === "07:15");
  await D.pg.click("#runManNext"); await D.pg.waitForSelector("#runSave");
  await D.pg.selectOption("#runSvRpe", "4");
  await D.pg.click("#runSvSave");
  await D.pg.waitForSelector(".run-row");
  var td = await tables(D.pg), md = td.runs[0];
  ck("57. Guardar à mão: source «manual», 5200 m, 1710 s, tempo em movimento = tempo, sem parciais, esforço 4, e nada em run_tracks", td.runs.length === 1 && md.source === "manual" && md.distance_m === 5200 && md.duration_s === 1710 && md.moving_s === 1710 && md.splits_s === null && md.rpe === 4 && td.run_tracks.length === 0 && md.gaps === 0);
  await D.ctx.close();

  // hoje é o dia LOCAL (num fuso muito adiantado ou muito atrasado, o dia UTC é outro)
  var tzOk = true;
  for (var zi = 0; zi < 2; zi++){
    var DT = await student({tz: ["Pacific/Kiritimati", "Pacific/Pago_Pago"][zi]});
    await DT.pg.click("#runGoManual"); await DT.pg.waitForSelector("#runManual");
    var tzDay = await DT.pg.evaluate(function(){ var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); });
    tzOk = tzOk && (await DT.pg.inputValue("#runManDate")) === tzDay && (await DT.pg.getAttribute("#runManDate", "max")) === tzDay;
    await DT.ctx.close();
  }
  ck("58. A data por omissão e o máximo do registo à mão são o dia LOCAL (testado em dois fusos extremos, em que o dia UTC é outro num deles)", tzOk);
  // sem ligação: só se confia no consentimento já confirmado nesta sessão
  var CN = await student({});
  await CN.pg.click("#runGoImport"); await CN.pg.waitForSelector("#runFile", {state: "attached"});
  await CN.pg.click("#runBack"); await CN.pg.waitForSelector("#runGoImport");
  await CN.ctx.setOffline(true);
  await CN.pg.click("#runGoImport"); await CN.pg.waitForSelector("#runFile", {state: "attached"});
  ck("59. Sem ligação, com o consentimento já confirmado nesta sessão, importar abre na mesma (o ficheiro lê-se no telemóvel)", (await CN.pg.locator("#runConsent").count()) === 0);
  await CN.ctx.setOffline(false); await CN.ctx.close();
  var CO = await student({});
  await CO.ctx.setOffline(true);
  await CO.pg.click("#runGoImport");
  await CO.pg.waitForFunction(function(){ return (window.__toasts || []).some(function(t){ return /Sem ligação\. Não consegui verificar o teu consentimento/.test(t); }); });
  ck("60. Sem ligação e SEM consentimento confirmado, não se abre nada: avisa que não foi possível verificar o consentimento (nunca se assume que foi dado)", (await CO.pg.locator("#runFile, #runConsent").count()) === 0 && /Importar ficheiro/i.test(await tabText(CO.pg)));
  await CO.ctx.setOffline(false); await CO.ctx.close();

  // ==================================================================================================================== E. lista e detalhe
  var many = [];
  for (var q = 0; q < 150; q++) many.push(runRow(q % 300, {over: {id: uuid(1000 + q), started_at: new Date(Date.now() - (q + 1) * 3 * 3600000).toISOString(), distance_m: 4000 + q}}));
  var E = await student({runs: many});
  ck("61. Com 150 corridas mostra as 100 mais recentes, «A mostrar as 100 mais recentes.» e «Ver mais»", (await E.pg.locator(".run-row").count()) === 100 && /A mostrar as 100 mais recentes\./.test(await tabText(E.pg)) && (await E.pg.locator("#runMore").count()) === 1);
  ck("62. Com a página cheia dentro das 8 semanas, os totais leem o resto dessas semanas (colunas mínimas) e contam as 150 corridas", /CORRIDAS\s*150/i.test((await E.pg.locator(".run-weeks").innerText()).replace(/\n/g, " ")) && (await E.pg.evaluate(function(){ return window.__fake.selectCols.filter(function(x){ return x.table === "runs" && !/notes/.test(x.cols); }).length; })) >= 1);
  var cols = await E.pg.evaluate(function(){ return window.__fake.selectCols.filter(function(x){ return x.table === "runs"; }).map(function(x){ return x.cols; }); });
  ck("63. A lista pede colunas leves (nunca «*» nem «points») e a leitura não toca em run_tracks", cols.length >= 1 && cols.every(function(c){ return c !== "*" && !/points/.test(c); }) && (await E.pg.evaluate(function(){ return window.__fake.selects.filter(function(t){ return t === "run_tracks"; }).length; })) === 0);
  var firstDates = await E.pg.locator(".run-row .run-row-date").allInnerTexts();
  ck("64. A lista está por ordem, da mais recente para a mais antiga", (await E.pg.locator(".run-row .run-row-dist").first().innerText()) === C.runDistStr(4000));
  await E.pg.click("#runMore");
  await E.pg.waitForFunction(function(){ return document.querySelectorAll(".run-row").length === 150; });
  ck("65. «Ver mais» traz as restantes (150) e o botão desaparece", (await E.pg.locator("#runMore").count()) === 0);
  await E.ctx.close();

  var seed3 = [runRow(0, {over: {id: uuid(1), notes: '<img src=x onerror="window.__xss=1">Nota "perigosa"'}}), runRow(1, {over: {id: uuid(2), splits_s: [330, 345, 360, 350], distance_m: 4200}}), runRow(2, {over: {id: uuid(3), source: "manual", splits_s: null, rpe: null, distance_m: 3000}})].reverse();   // inseridas da mais antiga para a mais recente: a ordem tem de ser a do ecrã, não a do servidor
  var shared = [[[38.7, -9.15, 0], [38.7005, -9.1495, 40], [38.701, -9.149, 80], [38.7015, -9.1485, 120]]];
  var F = await student({runs: seed3, tracks: [{run_id: uuid(1), student_id: "ana", fmt: 1, trim_m: 200, points: shared}]});
  var wk = (await F.pg.locator(".run-weeks").innerText()).replace(/\s+/g, " ");
  ck("66. Totais das últimas 8 semanas: 3 corridas, distância somada (12,20 km), tempo e ritmo médio por km; e a lista fica da mais recente para a mais antiga mesmo que o servidor as entregue pela ordem contrária", (await F.pg.locator(".run-row .run-row-dist").allInnerTexts()).join("|") === "5,00 km|4,20 km|3,00 km" && /CORRIDAS 3/i.test(wk) && /12,20/.test(wk) && /\/km/.test(wk) && (await F.pg.locator(".run-bars .run-bar").count()) === 8);
  await F.pg.click('.run-row[data-run="' + uuid(1) + '"]');
  await F.pg.waitForSelector(".run-detail");
  await F.pg.waitForSelector(".run-svg-wrap svg");
  var dt = await tabText(F.pg);
  ck("67. O detalhe mostra a nota como TEXTO (o HTML hostil não executa), o esforço e as ações (exportar, apagar só o percurso, apagar corrida)", dt.indexOf('<img src=x onerror="window.__xss=1">Nota "perigosa"') >= 0 && (await F.pg.evaluate(function(){ return window.__xss; })) === undefined && (await F.pg.locator(".run-detail img").count()) === 0 && /Exportar GPX \(percurso guardado\)/i.test(dt) && /Apagar só o percurso/i.test(dt) && /Apagar corrida/i.test(dt));
  ck("68. O percurso partilhado é carregado só ao abrir o detalhe (maybeSingle por run_id), desenhado em SVG, com a nota de que foi aparado e simplificado", /aparado e simplificado/.test(dt) && (await F.pg.locator('.run-svg-wrap svg[role="img"]').count()) === 1 && /esconder|escondidos: 200 m/.test(dt));
  var dlP2 = F.pg.waitForEvent("download");
  await F.pg.click("#runExportSaved");
  var dl2 = await dlP2, g2 = fs.readFileSync(await dl2.path(), "utf8");
  ck("69. «Exportar GPX (percurso guardado)» descarrega os pontos guardados (4)", /<gpx version="1.1"/.test(g2) && (g2.match(/<trkpt /g) || []).length === 4);
  await F.pg.click("#runBack"); await F.pg.waitForSelector(".run-row");
  await F.pg.click('.run-row[data-run="' + uuid(2) + '"]');
  await F.pg.waitForSelector(".run-detail");
  await F.pg.waitForFunction(function(){ return /Não partilhaste o percurso/.test(document.body.innerText); });
  var d2 = await tabText(F.pg);
  ck("70. Detalhe sem percurso partilhado: parciais por quilómetro em barras (4) e «Não partilhaste o percurso: ficaram só os números.»; sem apagar-percurso nem exportar", (await F.pg.locator(".run-split").count()) === 4 && /Parciais por quilómetro/i.test(d2) && /Não partilhaste o percurso: ficaram só os números\./.test(d2) && (await F.pg.locator("#runDelTrack, #runExportSaved").count()) === 0);
  await F.pg.click("#runBack"); await F.pg.waitForSelector(".run-row");
  await F.pg.click('.run-row[data-run="' + uuid(3) + '"]');
  await F.pg.waitForSelector(".run-detail");
  ck("71. Uma corrida à mão não fala de percurso nem mostra parciais", !/percurso/i.test((await tabText(F.pg)).replace(/Apagar corrida|Percurso/g, "")) && (await F.pg.locator(".run-split").count()) === 0);
  await F.pg.click("#runBack"); await F.pg.waitForSelector(".run-row");
  // apagar só o percurso: recusar e aceitar
  await F.pg.click('.run-row[data-run="' + uuid(1) + '"]');
  await F.pg.waitForSelector("#runDelTrack");
  F.ctl.answer = false;
  await F.pg.click("#runDelTrack"); await F.pg.waitForTimeout(200);
  ck("72. «Apagar só o percurso» pede confirmação (texto: os números ficam; não dá para desfazer); recusando nada se apaga", F.ctl.dialogs.some(function(d){ return /Apagar só o percurso\? Os números \(distância, tempo, ritmo\) ficam\. Não dá para desfazer\./.test(d); }) && (await tables(F.pg)).run_tracks.length === 1);
  F.ctl.answer = true;
  await F.pg.click("#runDelTrack");
  await F.pg.waitForFunction(function(){ return window.__fake.tables.run_tracks.length === 0; });
  await F.pg.waitForSelector("#runDelRun");
  var tf = await tables(F.pg);
  ck("73. Confirmando, o percurso desaparece e a corrida (os números) fica; o detalhe passa a dizer que não há percurso", tf.runs.length === 3 && tf.run_tracks.length === 0 && (await F.pg.locator("#runDelTrack").count()) === 0 && /Não partilhaste o percurso/.test(await tabText(F.pg)));
  // sem ligação: não apaga nem pergunta
  F.ctl.dialogs.length = 0;
  await F.ctx.setOffline(true);
  await F.pg.click("#runDelRun");
  await F.pg.waitForTimeout(200);
  ck("74. Sem ligação, apagar recusa logo («Para apagar corridas é preciso ligação à internet.»), sem sequer perguntar, e nada se apaga", /Para apagar corridas é preciso ligação à internet\./.test(await toast(F.pg)) && F.ctl.dialogs.length === 0 && (await tables(F.pg)).runs.length === 3);
  await F.ctx.setOffline(false);
  await F.pg.click("#runDelRun");
  await F.pg.waitForSelector(".run-row");
  await F.pg.waitForFunction(function(){ return document.querySelectorAll(".run-row").length === 2; });
  ck("75. Apagar a corrida (com confirmação «Apagar esta corrida e o percurso? Não dá para desfazer.») tira-a da lista e do servidor", F.ctl.dialogs.some(function(d){ return /^Apagar esta corrida e o percurso\? Não dá para desfazer\.$/.test(d); }) && (await tables(F.pg)).runs.length === 2);
  // o servidor responde «0 linhas apagadas» (sem permissão): não se finge que apagou
  var ZD1 = await student({init: ZERO_DEL, runs: [runRow(0, {over: {id: uuid(81)}})]});
  await ZD1.pg.click(".run-row"); await ZD1.pg.waitForSelector("#runDelRun");
  await ZD1.pg.click("#runDelRun");
  await ZD1.pg.waitForFunction(function(){ return (window.__toasts || []).some(function(t){ return /Não foi possível apagar/.test(t); }); });
  ck("76. Se o servidor responder que não apagou nenhuma linha, o aluno vê «Não foi possível apagar» e a corrida continua na lista (nunca se finge que apagou)", (await ZD1.pg.locator("#runDelRun").count()) === 1 && (await tables(ZD1.pg)).runs.length === 1);
  await ZD1.ctx.close();
  // apagar todas
  F.ctl.answer = false;
  await F.pg.locator("#runPrivacy summary").click();
  await F.pg.click("#runDelAll"); await F.pg.waitForTimeout(150);
  ck("77. «Apagar todas as corridas» pede confirmação e, recusada, não apaga", F.ctl.dialogs.some(function(d){ return /^Apagar todas as tuas corridas\? Não dá para desfazer\.$/.test(d); }) && (await tables(F.pg)).runs.length === 2);
  F.ctl.answer = true;
  await F.pg.click("#runDelAll");
  await F.pg.waitForSelector("#runEmpty");
  ck("78. Confirmando, apaga todas e o ecrã volta ao estado vazio", (await tables(F.pg)).runs.length === 0);
  await F.ctx.close();

  var wipeSeed = {}; wipeSeed["evolve_run_draft_v1"] = JSON.stringify({uid: "user-1", segs: []}); wipeSeed["evolve_runs_outbox_v1"] = JSON.stringify([{uid: "user-1", id: "x"}, {uid: "outro", id: "y"}]);
  var W = await student({seed: wipeSeed, runs: [runRow(0, {over: {id: uuid(11)}}), runRow(1, {over: {id: uuid(12)}})], tracks: [{run_id: uuid(11), student_id: "ana", fmt: 1, trim_m: 0, points: shared}]});
  await W.pg.locator("#runPrivacy summary").click();
  W.ctl.answer = false;
  await W.pg.click("#runWithdraw"); await W.pg.waitForTimeout(150);
  ck("79. «Retirar consentimento» pede confirmação («apaga todas as tuas corridas e percursos») e, recusada, não apaga nada", W.ctl.dialogs.some(function(d){ return /^Retirar o consentimento apaga todas as tuas corridas e percursos\. Não dá para desfazer\.( Também apaga[^.]*\.)?$/.test(d); }) && (await tables(W.pg)).runs.length === 2 && (await tables(W.pg)).run_consents.length === 1);
  ck("80. Havendo uma gravação por terminar ou corridas por enviar neste telemóvel, o aviso de retirar também o diz", W.ctl.dialogs.some(function(d){ return /Também apaga a gravação por terminar e as corridas por enviar que estão neste telemóvel\./.test(d); }));
  W.ctl.answer = true;
  await W.pg.click("#runWithdraw");
  await W.pg.waitForSelector("#runEmpty");
  var lsW = await W.pg.evaluate(function(){ return {d: localStorage.getItem("evolve_run_draft_v1"), o: localStorage.getItem("evolve_runs_outbox_v1"), reset: window.__resetCalls || 0}; });
  ck("81. Retirar o consentimento apaga também o rascunho e a fila de corridas deste telemóvel (e pede ao gravador para parar e esquecer)", lsW.d === null && lsW.o === null && lsW.reset >= 1);
  var tw = await tables(W.pg);
  ck("82. Confirmando, o consentimento é apagado e, com ele, TODAS as corridas e percursos (como o gatilho do servidor); o ecrã fica vazio", tw.run_consents.length === 0 && tw.runs.length === 0 && tw.run_tracks.length === 0);
  await W.pg.click("#runGoImport");
  await W.pg.waitForSelector("#runConsent");
  ck("83. Depois de retirar, para voltar a importar é preciso aceitar o aviso outra vez", /Corridas: antes de começares/.test(await tabText(W.pg)));
  await W.ctx.close();

  // ==================================================================================================================== F. profissional
  var pro1 = row("a", "Ana Silva", "off"), pro2 = row("b", "Bruno Costa", "import");
  var P = await open("professional", [pro1, pro2], "index.html");
  await P.pg.waitForSelector(".student-row");
  async function proCorridas(pg, id){
    await pg.locator('[data-open="' + id + '"]').first().click();
    await pg.waitForSelector("#proBack");
    await pg.click('.pro-nav-item[data-g="treino"]');
    await pg.click('[data-sub="corridas"]');
    await pg.waitForSelector(".run-modes");
  }
  await proCorridas(P.pg, "a");
  var pt = await P.pg.locator("#proTabContent").innerText();
  ck("84. Na ficha: interruptor «Corrida neste aluno» com «Desligada», «Importar e registar à mão» e «Também gravar com GPS (experimental)», com a atual (Desligada) marcada", /Corrida neste aluno/i.test(pt) && /Desligada/.test(pt) && /Importar e registar à mão/.test(pt) && /Também gravar com GPS \(experimental\)/.test(pt) && (await P.pg.locator('.run-mode[aria-checked="true"]').innerText()) === "Desligada");
  ck("85. O profissional não vê botões de importar nem de registar corridas (não cria nem altera), e vê a nota «A localização é um dado sensível: não partilhes estas corridas com terceiros.»", (await P.pg.locator("#runGoImport, #runGoManual, #runGoLive, #runFile").count()) === 0 && /A localização é um dado sensível: não partilhes estas corridas com terceiros\./.test(pt));
  ck("86. Mostra o estado do consentimento: «Ainda não aceitou o aviso»", await P.pg.waitForFunction(function(){ return /Ainda não aceitou o aviso/.test(document.getElementById("runProConsent").innerText); }).then(function(){ return true; }));
  await P.pg.click('[data-run-mode="import"]');
  await P.pg.waitForSelector('.run-mode[data-run-mode="import"].on');
  var upd = (await writes(P.pg)).filter(function(w){ return w.table === "students" && w.op === "update"; });
  ck("87. Ligar «Importar e registar à mão» grava students.runs_mode = 'import' por update direto (só essa coluna), e a ficha passa a mostrá-lo", upd.length === 1 && upd[0].cols.join() === "runs_mode" && upd[0].payload.runs_mode === "import" && (await P.pg.evaluate(function(){ return window.__fake.rows[0].runs_mode; })) === "import" && (await P.pg.locator('.run-mode[aria-checked="true"]').innerText()) === "Importar e registar à mão");
  await P.pg.click('[data-run-mode="live"]');
  await P.pg.waitForSelector('.run-mode[data-run-mode="live"].on');
  ck("88. «Também gravar com GPS (experimental)» grava 'live' e avisa que o ecrã bloqueado ou noutra aplicação não está verificado", (await P.pg.evaluate(function(){ return window.__fake.rows[0].runs_mode; })) === "live" && /não está verificado em iPhone nem em Android/.test(await P.pg.locator("#runModeHelp").innerText()));
  await P.pg.evaluate(function(){
    var cl = window.supabase.createClient(), of = cl.from.bind(cl), once = false;
    cl.from = function(t){
      var b = of(t);
      if (t === "students" && !once){
        var up = b.update.bind(b);
        b.update = function(p){ once = true; up(p); b.then = function(res, rej){ return Promise.resolve({data: [], error: null, status: 200}).then(res, rej); }; return b; };
      }
      return b;
    };
  });
  await P.pg.click('[data-run-mode="off"]');
  await P.pg.waitForFunction(function(){ return /Não foi possível mudar a Corrida deste aluno/.test(document.getElementById("runModeErr").innerText); });
  ck("89. Se o servidor não alterar nenhuma ficha (sem permissão: 0 linhas), o interruptor não finge que mudou: erro claro e o modo continua o mesmo", (await P.pg.evaluate(function(){ return window.__fake.rows[0].runs_mode; })) === "live" && (await P.pg.locator('.run-mode[aria-checked="true"]').innerText()) === "Também gravar com GPS (experimental)");
  await P.pg.evaluate(function(){ window.__fake.failNext = 1; });
  await P.pg.click('[data-run-mode="off"]');
  await P.pg.waitForFunction(function(){ return /Não foi possível mudar a Corrida deste aluno/.test(document.getElementById("runModeErr").innerText); });
  ck("90. Se a gravação falhar, o erro é claro e o modo não muda (continua 'live')", (await P.pg.evaluate(function(){ return window.__fake.rows[0].runs_mode; })) === "live" && (await P.pg.locator('.run-mode[aria-checked="true"]').innerText()) === "Também gravar com GPS (experimental)");
  await P.pg.click('[data-run-mode="off"]');
  await P.pg.waitForSelector('.run-mode[data-run-mode="off"].on');
  ck("91. Desligar volta a gravar 'off'", (await P.pg.evaluate(function(){ return window.__fake.rows[0].runs_mode; })) === "off");
  // dados do aluno b
  await seedConsent(P.pg, "b");
  var pruns = [runRow(0, {sid: "b", over: {id: uuid(21), notes: "<script>window.__xss2=1</script>pro"}}), runRow(1, {sid: "b", over: {id: uuid(22), splits_s: [340, 350, 345]}})];
  await seedRuns(P.pg, pruns);
  await seedTrack(P.pg, {run_id: uuid(21), student_id: "b", fmt: 1, trim_m: 200, points: shared});
  await P.pg.click("#proBack"); await P.pg.waitForSelector(".student-row");
  await proCorridas(P.pg, "b");
  await P.pg.waitForSelector(".run-row");
  var ptb = (await P.pg.locator("#proTabContent").innerText()).replace(/\s+/g, " ");
  ck("92. Aluno com corridas: estado do consentimento «Aceitou o aviso em dd/mm/aaaa (versão 1)», totais e lista leve (2 corridas)", /Aceitou o aviso em 01\/10\/2026 \(versão 1\)/.test(ptb) && (await P.pg.locator(".run-row").count()) === 2 && /Últimas 8 semanas/i.test(ptb) && /Importar e registar à mão/.test(ptb));
  ck("93. A lista do profissional não lê percursos nem usa «*»", (await P.pg.evaluate(function(){ return window.__fake.selectCols.filter(function(x){ return x.table === "runs"; }).every(function(x){ return x.cols !== "*" && !/points/.test(x.cols); }) && window.__fake.selects.indexOf("run_tracks") < 0; })));
  await P.pg.click('.run-row[data-prun="' + uuid(22) + '"]');
  await P.pg.waitForSelector(".run-detail");
  await P.pg.waitForFunction(function(){ return /O aluno não partilhou o percurso/.test(document.body.innerText); });
  ck("94. Detalhe sem percurso partilhado: parciais em barras e «O aluno não partilhou o percurso.»", (await P.pg.locator(".run-split").count()) === 3 && /O aluno não partilhou o percurso\./.test(await P.pg.locator("#proTabContent").innerText()));
  await P.pg.click("#runProBack"); await P.pg.waitForSelector(".run-row");
  await P.pg.click('.run-row[data-prun="' + uuid(21) + '"]');
  await P.pg.waitForSelector(".run-svg-wrap svg");
  ck("95. O profissional não exporta o GPX do aluno (só o aluno o faz) mas pode apagar só o percurso", (await P.pg.locator("#runExportSaved").count()) === 0 && (await P.pg.locator("#runDelTrack").count()) === 1);
  ck("96. Com o percurso partilhado, o profissional vê o SVG (e a nota hostil só como texto: nada executa)", (await P.pg.evaluate(function(){ return window.__xss2; })) === undefined && (await P.pg.locator("#proTabContent script").count()) === 0 && (await P.pg.locator("#proTabContent").innerText()).indexOf("<script>window.__xss2=1</script>pro") >= 0);
  P.ctl.answer = false;
  await P.pg.click("#runDelRun"); await P.pg.waitForTimeout(150);
  ck("97. Apagar uma corrida do aluno pede «Apagar esta corrida do aluno? Não dá para desfazer.»; recusando nada se apaga", P.ctl.dialogs.some(function(d){ return /^Apagar esta corrida do aluno\? Não dá para desfazer\.$/.test(d); }) && (await tables(P.pg)).runs.length === 2);
  P.ctl.answer = true;
  await P.pg.click("#runDelRun");
  await P.pg.waitForFunction(function(){ return document.querySelectorAll(".run-row").length === 1; });
  var tpd = await tables(P.pg);
  ck("98. Confirmando, a corrida e o percurso dela desaparecem (o do outro dia fica)", tpd.runs.length === 1 && tpd.run_tracks.length === 0 && tpd.runs[0].id === uuid(22));
  await P.ctx.close();

  var PZ = await open("professional", [row("a", "Ana Silva", "import")], "index.html", {init: ZERO_DEL});
  await PZ.pg.waitForSelector(".student-row");
  await seedConsent(PZ.pg, "a"); await seedRuns(PZ.pg, [runRow(0, {sid: "a", over: {id: uuid(82)}})]);
  await proCorridas(PZ.pg, "a"); await PZ.pg.waitForSelector(".run-row");
  await PZ.pg.click(".run-row"); await PZ.pg.waitForSelector("#runDelRun");
  await PZ.pg.click("#runDelRun");
  await PZ.pg.waitForFunction(function(){ return (window.__toasts || []).some(function(t){ return /Não foi possível apagar/.test(t); }); });
  ck("99. O mesmo no profissional: se o servidor não apagou nada, avisa e a corrida fica", (await PZ.pg.locator("#runDelRun").count()) === 1 && (await tables(PZ.pg)).runs.length === 1);
  await PZ.ctx.close();

  var P2 = await open("professional", [row("a", "Ana Silva", "import")], "index.html", {missingTables: true, missingCode: "PGRST205"});
  await P2.pg.waitForSelector(".student-row");
  await P2.pg.locator('[data-open="a"]').first().click(); await P2.pg.waitForSelector("#proBack");
  await P2.pg.click('.pro-nav-item[data-g="treino"]'); await P2.pg.click('[data-sub="corridas"]');
  await P2.pg.waitForSelector("#runProMissing");
  ck("100. Coluna runs_mode presente mas tabelas em falta (PGRST205): «Falta correr a migração 0032 no Supabase (docs/OPERACOES.md, secção 8u).»", /Falta correr a migração 0032 no Supabase \(docs\/OPERACOES\.md, secção 8u\)\./.test(await P2.pg.locator("#proTabContent").innerText()));
  await P2.ctx.close();

  // ==================================================================================================================== G. «Ver como aluno» (profissional em treino.html)
  var V = await open("professional", [row("ana", "Ana Silva", "import")], "treino.html");
  await V.pg.waitForSelector("#alunoStudentSwitch");
  await seedRuns(V.pg, [runRow(0, {over: {id: uuid(31)}})]);
  await V.pg.click('.tabbar [data-tab="corrida"]');
  await V.pg.waitForSelector(".run-row");
  var vt = await tabText(V.pg);
  ck("101. «Ver como aluno»: só leitura — «Só o aluno pode importar ou registar corridas.», sem importar, registar, gravar, apagar nem retirar o consentimento; a lista aparece", /Só o aluno pode importar ou registar corridas\./.test(vt) && (await V.pg.locator("#runGoImport, #runGoManual, #runGoLive, #runDelAll, #runWithdraw, #runFile").count()) === 0);
  await V.pg.click('.run-row[data-run="' + uuid(31) + '"]');
  await V.pg.waitForSelector(".run-detail");
  ck("102. Em «Ver como aluno» o detalhe também é só de leitura (sem apagar nem exportar)", (await V.pg.locator("#runDelRun, #runDelTrack, #runExportSaved").count()) === 0);
  ck("103. O profissional a ver como aluno não escreveu nada nas tabelas da Corrida", (await writes(V.pg)).filter(function(w){ return /run/.test(w.table); }).length === 0);
  await V.ctx.close();

  // ==================================================================================================================== H. tabela em falta
  var H = await student({missingTables: true, missingCode: "PGRST205", settle: false, wait: "#runMissing"});
  var ht = await tabText(H.pg);
  ck("104. Tabelas em falta (PGRST205): «Corrida indisponível por agora. Volta a tentar mais tarde.», sem botões de importar nem de registar", /Corrida indisponível por agora\. Volta a tentar mais tarde\./.test(ht) && (await H.pg.locator("#runGoImport, #runGoManual").count()) === 0 && !/migração/.test(ht));
  ck("105. Nada é persistido neste estado (nenhuma chave local da Corrida, nenhuma escrita)", (await H.pg.evaluate(function(){ return Object.keys(localStorage).filter(function(k){ return /run/i.test(k); }); })).length === 0 && (await writes(H.pg)).filter(function(w){ return /run/.test(w.table); }).length === 0);
  await H.pg.evaluate(function(){ window.__fake.missingTables = false; });
  await H.pg.click("#runRetry");
  await H.pg.waitForSelector("#runGoImport");
  ck("106. «Tentar outra vez» volta a ler e, com as tabelas já criadas, mostra a Corrida", (await H.pg.locator("#runMissing").count()) === 0);
  await H.ctx.close();
  var H2 = await student({missingTables: true, settle: false, wait: "#runMissing"});
  ck("107. O erro 42P01 (relação inexistente) é tratado como o PGRST205", /Corrida indisponível por agora/.test(await tabText(H2.pg)));
  await H2.ctx.close();

  // ==================================================================================================================== I. falhas, fila e contrato de submitRun
  var I = await student({queue: false});
  await importFile(I, "a.gpx", gpxOf(P5K));
  await I.pg.waitForSelector("#runSave");
  await I.pg.evaluate(function(){ window.__fake.failNext = 1; });
  await I.pg.click("#runSvSave");
  await I.pg.waitForFunction(function(){ return /Sem ligação\. Nada foi perdido: tenta guardar outra vez\./.test(document.getElementById("runSvErr").innerText); });
  ck("108. Falha transitória sem fila (5xx): «Sem ligação. Nada foi perdido: tenta guardar outra vez.», o ecrã fica como estava e o botão volta a estar ativo", (await I.pg.locator("#runSvSave").isEnabled()) && (await I.pg.locator("#runSave").count()) === 1 && (await tables(I.pg)).runs.length === 0);
  await I.pg.click("#runSvSave");
  await I.pg.waitForSelector("#runGoImport");
  ck("109. Tentando outra vez guarda UMA só corrida", (await tables(I.pg)).runs.length === 1);
  // a resposta perde-se depois de a corrida ter entrado: tentar outra vez NÃO pode duplicar (o mesmo id)
  await importFile(I, "b.gpx", gpxOf(P5K_B));
  await I.pg.waitForSelector("#runSave");
  await I.pg.evaluate(function(){
    var c = window.supabase.createClient(), orig = c.from.bind(c), done = false;
    c.from = function(t){
      var b = orig(t);
      if (t === "runs" && !done){
        var real = b.insert.bind(b);
        b.insert = function(p){ done = true; return real(p).then(function(){ return {data: null, error: {message: "TypeError: Failed to fetch", code: ""}, status: 0}; }); };
      }
      return b;
    };
  });
  await I.pg.click("#runSvSave");
  await I.pg.waitForFunction(function(){ return /Sem ligação\. Nada foi perdido/.test(document.getElementById("runSvErr").innerText); });
  var mid = (await tables(I.pg)).runs.length;
  await I.pg.click("#runSvSave");
  await I.pg.waitForSelector("#runGoImport");
  ck("110. Se a resposta se perde depois de a corrida entrar, tentar outra vez reutiliza o mesmo identificador: o servidor responde «já existe» (23505), confirma-se e NÃO há corrida duplicada", mid === 2 && (await tables(I.pg)).runs.length === 2);
  var sub = await I.pg.evaluate(async function(){
    var T = window.__T, s = T.findStudent("ana"), out = {};
    var mk = function(extra){ return T.runBuildInsert(Object.assign({id: T.runUuid(), studentId: "ana", source: "manual", startedAtMs: Date.now() - 86400000 * 9, durationS: 1800, movingS: 1800, distM: 5000, gaps: 0, gapS: 0, splitsS: [], hiddenS: 0, rpe: null, notes: "", consentV: 1}, extra || {}), Date.now()); };
    var row1 = mk();
    out.first = await T.RUN.submitRun(s, {row: row1, track: null});
    out.again = await T.RUN.submitRun(s, {row: row1, track: null});
    out.count = window.__fake.tables.runs.filter(function(r){ return r.id === row1.id; }).length;
    window.__fake.blockHost = true;
    out.offline = await T.RUN.submitRun(s, {row: mk(), track: null});
    window.__fake.blockHost = false;
    out.garbage = [];
    var junk = [[null, null], [s, null], [s, {}], [s, {row: 5}], [null, {row: row1}], [{id: "outro"}, {row: row1}], [s, {row: {id: "x", student_id: "ana"}}]];
    for (var i = 0; i < junk.length; i++) { try { out.garbage.push(await T.RUN.submitRun(junk[i][0], junk[i][1])); } catch (e) { out.garbage.push("LANÇOU"); } }
    out.liveRow = await T.RUN.submitRun(s, {row: mk({source: "live"}), track: null});
    return out;
  });
  ck("111. submitRun: {ok:true, queued:false} e, reenviando a mesma corrida (23505), continua {ok:true} sem duplicar (confirma por maybeSingle)", sub.first.ok === true && sub.first.queued === false && sub.again.ok === true && sub.again.queued === false && sub.count === 1);
  ck("112. submitRun sem ligação e sem fila: {ok:false, permanent:false} (nada se perde: o chamador mantém o item)", sub.offline.ok === false && sub.offline.permanent === false && typeof sub.offline.error === "string" && sub.offline.error.length > 5);
  ck("113. submitRun NUNCA lança, qualquer que seja a entrada (nulos, vazios, linhas incompletas, aluno trocado)", sub.garbage.length === 7 && sub.garbage.every(function(g){ return g && g !== "LANÇOU" && g.ok === false; }));
  ck("114. Recusa permanente do servidor (origem «live» com o modo «import»): {ok:false, permanent:true} e nada na tabela", sub.liveRow.ok === false && sub.liveRow.permanent === true && !/row-level|policy/i.test(sub.liveRow.error));
  await I.ctx.close();

  var Iq = await student({queue: true});
  await importFile(Iq, "a.gpx", gpxOf(P5K));
  await Iq.pg.waitForSelector("#runSave");
  await Iq.pg.check("#runSvShare");
  await Iq.ctx.setOffline(true);
  await Iq.pg.click("#runSvSave");
  await Iq.pg.waitForSelector("#runGoImport");
  var qd = await Iq.pg.evaluate(function(){ return {queue: window.__queue || [], toasts: Array.prototype.map.call(document.querySelectorAll(".toast"), function(t){ return t.textContent; })}; });
  ck("115. Sem ligação e COM fila (RUN.queueAdd): a corrida vai para a fila ({ok:true, queued:true}) e o aluno é avisado de que ficou neste telemóvel", qd.queue.length === 1 && qd.toasts.some(function(t){ return /ficou guardada neste telemóvel e será enviada quando houver ligação/.test(t); }));
  ck("116. O item da fila traz só o que seria enviado: a linha (sem coordenadas) e o percurso já aparado e simplificado (nunca os pontos brutos)", qd.queue[0].row && qd.queue[0].row.student_id === "ana" && qd.queue[0].track && qd.queue[0].track.trimM === 200 && qd.queue[0].track.segments.length >= 1 && qd.queue[0].track.segments.every(function(sg){ return sg.every(function(p){ return p.length === 3; }); }) && !NOCOORD.test(JSON.stringify(qd.queue[0].row)));
  await Iq.ctx.setOffline(false);
  await Iq.ctx.close();

  // o percurso falha depois de a corrida entrar
  var It = await student({queue: false, missingTables: ["run_tracks"], missingCode: "PGRST205"});
  await importFile(It, "a.gpx", gpxOf(P5K));
  await It.pg.waitForSelector("#runSave");
  await It.pg.check("#runSvShare");
  await It.pg.click("#runSvSave");
  await It.pg.waitForSelector("#runSvSkipTrack");
  var tt = await tabText(It.pg);
  ck("117. Se a corrida entra mas o percurso não: «A corrida ficou guardada, mas o percurso não.» com «Guardar o percurso» e «Continuar sem percurso»", /A corrida ficou guardada, mas o percurso não\./.test(tt) && /Guardar o percurso/i.test(tt) && /Continuar sem percurso/i.test(tt) && (await tables(It.pg)).runs.length === 1);
  await It.pg.click("#runSvRetryTrack");
  await It.pg.waitForFunction(function(){ return /Não foi possível guardar o percurso/.test(document.getElementById("runSvErr").innerText); });
  await It.pg.evaluate(function(){ window.__fake.missingTables = false; });
  await It.pg.click("#runSvRetryTrack");
  await It.pg.waitForSelector("#runGoImport");
  ck("118. «Guardar o percurso» tenta só o percurso (falha com mensagem e, quando a tabela volta, guarda-o sem duplicar a corrida)", (await tables(It.pg)).runs.length === 1 && (await tables(It.pg)).run_tracks.length === 1);
  await It.ctx.close();
  var It2 = await student({queue: false, missingTables: ["run_tracks"], missingCode: "PGRST205"});
  await importFile(It2, "a.gpx", gpxOf(P5K));
  await It2.pg.waitForSelector("#runSave"); await It2.pg.check("#runSvShare"); await It2.pg.click("#runSvSave");
  await It2.pg.waitForSelector("#runSvSkipTrack");
  await It2.pg.click("#runSvSkipTrack");
  await It2.pg.waitForSelector("#runGoImport");
  ck("119. «Continuar sem percurso» volta ao início; a corrida fica e não há percurso", (await tables(It2.pg)).runs.length === 1 && (await tables(It2.pg)).run_tracks.length === 0);
  await It2.ctx.close();

  // ==================================================================================================================== J. contrato de saveFlow com o gravador
  var S = await student({mode: "live"});
  var flow = await S.pg.evaluate(function(){
    var T = window.__T, s = T.findStudent("ana"), segs = [[]], t0 = Date.now() - 3600000, i;
    for (i = 0; i < 200; i++) segs[0].push({lat: 38.7 + i * 0.0001, lon: -9.15 + i * 0.00006, t: t0 + i * 5000, acc: 5});
    var stats = T.runStats(segs, null, "live");
    window.__saved = null; window.__cancelled = 0;
    window.__prep = {source: "live", stats: stats, segments: segs, hiddenS: 12, warnings: ["Aviso do gravador.", "<b id=w1>negrito</b><img src=x onerror=window.__xss5=1>"], fileDistM: null, startedAtMs: stats.startedAtMs,
      onSaved: function(res){ window.__saved = res; }, onCancel: function(){ window.__cancelled++; T.RUN.go("home"); }};
    T.RUN.saveFlow(s, window.__prep);
    return {name: T.RUN.v.name, dist: stats.distM};
  });
  await S.pg.waitForSelector("#runSave");
  ck("120. RUN.saveFlow(s, prep) mostra «Confirma antes de guardar» com os números do gravador, o SVG, os avisos do prep e a opção de partilhar", flow.name === "save" && /Confirma antes de guardar/.test(await tabText(S.pg)) && /Aviso do gravador\./.test(await tabText(S.pg)) && (await S.pg.locator("#runSvWarns b, #runSvWarns img").count()) === 0 && (await S.pg.evaluate(function(){ return window.__xss5; })) === undefined && (await S.pg.locator("#runSave svg.run-svg").count()) === 1 && (await S.pg.locator("#runSvShare").isChecked()) === false && /GPS no telemóvel/.test(await tabText(S.pg)));
  await S.pg.click("#runSvCancel");
  await S.pg.waitForSelector("#runGoImport");
  ck("121. Cancelar chama prep.onCancel() (o gravador decide para onde volta)", (await S.pg.evaluate(function(){ return window.__cancelled; })) === 1);
  await S.pg.evaluate(function(){ var T = window.__T; T.RUN.saveFlow(T.findStudent("ana"), window.__prep); });
  await S.pg.waitForSelector("#runSave");
  await S.pg.check("#runSvShare");
  await S.pg.click("#runSvSave");
  await S.pg.waitForSelector("#runGoImport");
  var ts = await tables(S.pg), svd = await S.pg.evaluate(function(){ return window.__saved; });
  ck("122. Guardar uma gravação ao vivo: source «live», hidden_s do gravador, percurso partilhado e aparado, e prep.onSaved(res) chamado com {ok:true}", ts.runs.length === 1 && ts.runs[0].source === "live" && ts.runs[0].hidden_s === 12 && ts.run_tracks.length === 1 && ts.run_tracks[0].trim_m === 200 && svd && svd.ok === true);
  await S.ctx.close();

  // ==================================================================================================================== M. navegação, estado e contrato
  var M1 = await student({});
  await importFile(M1, "ida.gpx", C.runToGpx({startedAtMs: P5K[0].t}, [P5K]));
  await M1.pg.waitForSelector("#runSave");
  await M1.pg.click("label.run-check");
  await M1.pg.fill("#runSvNotes", "a meio da escrita");
  await M1.pg.click('label.run-opt:has(input[value="0"])');
  await M1.pg.click('.tabbar [data-tab="hoje"]'); await M1.pg.waitForSelector("#startWorkout");
  await M1.pg.click('.tabbar [data-tab="corrida"]'); await M1.pg.waitForSelector("#runSave");
  ck("123. O ecrã de confirmar sobrevive a mudar de separador: mantém o percurso, a escolha de partilhar e o que se escreveu", (await M1.pg.locator('input[name="runSvTrim"]:checked').getAttribute("value")) === "0" && (await M1.pg.locator("#runSvTrim0").isVisible()) && (await M1.pg.locator("#runSvNotes").inputValue()) === "a meio da escrita" && (await M1.pg.locator("#runSvShare").isChecked()) && (await M1.pg.locator("#runSave svg.run-svg").count()) === 1 && (await M1.pg.locator("#runSvShareOpts").isVisible()));
  await M1.pg.click("#runSvSave"); await M1.pg.waitForSelector(".run-row");
  await M1.pg.click(".run-row"); await M1.pg.waitForSelector(".run-svg-wrap svg");
  var rtP = M1.pg.waitForEvent("download");
  await M1.pg.click("#runExportSaved");
  var rtFile = fs.readFileSync(await (await rtP).path());
  await M1.pg.click("#runBack"); await M1.pg.waitForSelector(".run-row");
  await M1.pg.click("#runGoImport"); await M1.pg.waitForSelector("#runFile", {state: "attached"});
  await M1.pg.setInputFiles("#runFile", {name: "volta.gpx", mimeType: "application/gpx+xml", buffer: rtFile});
  await M1.pg.waitForSelector("#runSave");
  var rtTxt = await tabText(M1.pg), rtDist = /(\d+),(\d\d) km/.exec(rtTxt), rtKm = rtDist ? +rtDist[1] + +rtDist[2] / 100 : 0;
  ck("124. O GPX exportado do percurso guardado volta a ser aceite na importação (ida e volta; sem aparar, só um pouco menor por ter sido simplificado)", rtKm > EXP5K.distM / 1000 * 0.9 && rtKm <= EXP5K.distM / 1000 + 0.01 && /Ficheiro GPX/i.test(rtTxt));
  await M1.pg.click("#runSvCancel"); await M1.pg.waitForSelector("#runFile", {state: "attached"});
  await M1.pg.click("#runBack"); await M1.pg.waitForSelector(".run-row");
  await M1.pg.click('.tabbar [data-tab="hoje"]'); await M1.pg.waitForSelector("#startWorkout");
  await M1.pg.evaluate(function(){ window.__T.RUN.go("manual"); });
  ck("125. RUN.go só desenha se o separador «Corrida» estiver aberto (noutro separador só muda o estado)", (await M1.pg.locator("#runManual").count()) === 0 && (await M1.pg.evaluate(function(){ return window.__T.RUN.v.name; })) === "manual");
  await M1.pg.click('.tabbar [data-tab="corrida"]'); await M1.pg.waitForSelector("#runManual");
  ck("126. Ao voltar ao separador aparece a vista em que se estava", (await M1.pg.locator("#runManual").count()) === 1);
  var misc = await M1.pg.evaluate(async function(){
    var T = window.__T, p = T.RUN.flush(), out = {};
    out.isPromise = !!(p && typeof p.then === "function"); out.val = await p; out.v = T.RUN.consentVersion();
    return out;
  });
  ck("127. RUN.flush() por omissão devolve uma Promise que resolve (o gravador sobrepõe-na) e RUN.consentVersion() é 1", misc.isPromise && misc.val === undefined && misc.v === 1);
  await M1.ctx.close();

  var M2 = await open("professional", [row("a", "Ana Silva", "import"), row("b", "Bruno Costa", "import")], "treino.html");
  await M2.pg.waitForSelector("#alunoStudentSwitch");
  await seedRuns(M2.pg, [runRow(0, {sid: "a", over: {id: uuid(61), distance_m: 5000}}), runRow(0, {sid: "b", over: {id: uuid(62), distance_m: 8000}}), runRow(1, {sid: "b", over: {id: uuid(63), distance_m: 9000}})]);
  await M2.pg.click('.tabbar [data-tab="corrida"]'); await M2.pg.waitForSelector(".run-row");
  var nA = await M2.pg.locator(".run-row").count();
  await M2.pg.selectOption("#alunoStudentSwitch", "b");
  await M2.pg.waitForFunction(function(){ return document.querySelectorAll(".run-row").length === 2; });
  var cbCalled = await M2.pg.evaluate(function(){ var T = window.__T, s = T.findStudent("b"); window.__cb = 0; T.RUN.ensureConsent(s, function(){ window.__cb++; }); T.RUN.saveFlow(s, {source: "gpx", stats: {distM: 1, durationS: 1}, segments: []}); return new Promise(function(r){ setTimeout(function(){ r({cb: window.__cb, v: T.RUN.v.name}); }, 300); }); });
  ck("128. Na pré-visualização do profissional cada aluno mostra as SUAS corridas (muda ao trocar de aluno), e RUN.ensureConsent / RUN.saveFlow não fazem nada (só o aluno cria)", nA === 1 && /8,00 km|9,00 km/.test(await tabText(M2.pg)) && cbCalled.cb === 0 && cbCalled.v === "home" && (await writes(M2.pg)).filter(function(w){ return /run/.test(w.table); }).length === 0);
  await M2.ctx.close();

  // ==================================================================================================================== N. com o gravador REAL (corrida-live.js): ecrã e fila de envio
  var RL = await student({realLive: true, mode: "live"});
  await RL.pg.click("#runGoLive"); await RL.pg.waitForSelector("#runLive");
  var liveTxt = await tabText(RL.pg);
  ck("129. Com o gravador real: «Gravar com GPS» abre o ecrã de gravação, que diz «Põe a música a tocar ANTES de carregar em Iniciar e volta aqui.», avisa que o ecrã bloqueado pode falhar (não garante) e NÃO tem a linha de música; o GPS ainda não foi pedido", /Põe a música a tocar ANTES de carregar em Iniciar e volta aqui\./.test(liveTxt) && /Não garantimos que o registo continue com o ecrã bloqueado/.test(liveTxt) && (await RL.pg.locator("[data-music]").count()) === 0 && (await RL.pg.evaluate(function(){ return window.__geo; })) === 0);
  await RL.pg.click("#runLiveBack"); await RL.pg.waitForSelector("#runGoImport");
  await importFile(RL, "a.gpx", gpxOf(P5K));
  await RL.pg.waitForSelector("#runSave");
  await RL.pg.check("#runSvShare");
  await RL.ctx.setOffline(true);
  await RL.pg.click("#runSvSave");
  await RL.pg.waitForSelector("#runGoImport");
  var qLs = await RL.pg.evaluate(function(){ return {o: localStorage.getItem("evolve_runs_outbox_v1"), toasts: window.__toasts.slice()}; });
  var qItems = qLs.o ? JSON.parse(qLs.o) : [];
  ck("130. Sem ligação, com o gravador real, a corrida vai para a fila deste telemóvel (uma entrada, da conta atual) e o aluno é avisado; o servidor ainda não tem nada", Array.isArray(qItems) && qItems.length === 1 && qItems[0].uid === "user-1" && qLs.toasts.some(function(t){ return /ficou guardada neste telemóvel/.test(t); }) && (await tables(RL.pg)).runs.length === 0);
  await RL.ctx.setOffline(false);
  await RL.pg.evaluate(function(){ window.dispatchEvent(new Event("online")); });
  await RL.pg.waitForFunction(function(){ return window.__fake.tables.runs.length === 1; });
  await RL.pg.waitForFunction(function(){ var o = localStorage.getItem("evolve_runs_outbox_v1"); try { return !o || JSON.parse(o).length === 0; } catch (e) { return false; } });
  var tq = await tables(RL.pg);
  ck("131. Ao voltar a haver ligação o gravador real envia a fila: a corrida e o percurso partilhado chegam ao servidor UMA vez e a fila esvazia-se", tq.runs.length === 1 && tq.run_tracks.length === 1 && tq.run_tracks[0].run_id === tq.runs[0].id && tq.run_tracks[0].trim_m === 200);
  await RL.pg.click("#alunoTabContent .run-row >> nth=0").catch(function(){});
  await RL.ctx.close();

  // ==================================================================================================================== K. segurança, privacidade e aspeto
  var FOREIGN = function(){
    var fk = window.supabase, cl = fk.createClient(), of = cl.from.bind(cl);
    cl.from = function(t){
      var b = of(t);
      if (t === "runs"){
        b.then = function(res, rej){
          return Promise.resolve(b.run()).then(function(r){
            if (b.op === "select" && Array.isArray(r.data)) r.data = r.data.concat([{id: "99999999-1111-4111-8111-999999999999", student_id: "outra-aluna", created_by: "x", started_at: new Date(Date.now() - 3600000).toISOString(), source: "gpx", duration_s: 1800, moving_s: 1800, distance_m: 5000, gaps: 0, gap_s: 0, hidden_s: 0, splits_s: null, rpe: null, notes: "CORRIDA-ALHEIA", consent_v: 1}]);
            return r;
          }).then(res, rej);
        };
      }
      return b;
    };
  };
  var X = await student({init: FOREIGN, runs: [
    runRow(0, {over: {id: uuid(41), notes: '"><img src=x onerror="window.__xss3=1">'}}),
    runRow(1, {over: {id: "../../etc/passwd<script>", notes: "id perigoso"}}),
    runRow(2, {over: {id: uuid(43), student_id: "outra", notes: "de outro aluno"}}),
    runRow(3, {over: {id: uuid(44), source: "<b>x</b>", notes: "origem inválida"}}),
    runRow(4, {over: {id: uuid(45), distance_m: "99999999999", duration_s: "abc", splits_s: ["<b>x</b>", 5, {a: 1}], rpe: 99, notes: "números hostis"}}),
    runRow(5, {over: {id: uuid(46), started_at: "não é data", notes: "data má"}})
  ], tracks: [
    {run_id: uuid(41), student_id: "ana", fmt: 1, trim_m: 0, points: [[["<script>window.__xss4=1</script>", 1, 0], [1, 2, 3]]]},
    {run_id: uuid(45), student_id: "ana", fmt: 1, trim_m: 0, points: [[[999, 1, 0], [1, 2, 3]]]}
  ]});
  var xt = await tabText(X.pg);
  ck("132. Linhas hostis na BD (id com HTML, aluno trocado, origem inválida, data má) não aparecem; as com números absurdos são limitadas; nada executa", (await X.pg.evaluate(function(){ return window.__xss3; })) === undefined && !/id perigoso|de outro aluno|origem inválida|data má|CORRIDA-ALHEIA/.test(xt) && (await X.pg.locator("#alunoTabContent img, #alunoTabContent script").count()) === 0 && /números hostis/.test(xt) && !/99999999999|NaN|undefined|\[object/.test(xt));
  await X.pg.click('.run-row[data-run="' + uuid(41) + '"]');
  await X.pg.waitForFunction(function(){ return /Não foi possível mostrar o percurso/.test(document.body.innerText); });
  ck("133. Um percurso hostil (texto no lugar de números) é rejeitado: «Não foi possível mostrar o percurso», sem SVG e sem executar", (await X.pg.locator(".run-svg-wrap, .run-detail svg").count()) === 0 && (await X.pg.evaluate(function(){ return window.__xss4; })) === undefined);
  await X.pg.click("#runBack"); await X.pg.waitForSelector(".run-row");
  await X.pg.click('.run-row[data-run="' + uuid(45) + '"]');
  await X.pg.waitForFunction(function(){ return /Não foi possível mostrar o percurso/.test(document.body.innerText); });
  var dx = await tabText(X.pg);
  ck("134. Coordenadas fora do intervalo (lat 999) também são rejeitadas, e os parciais com texto são limpos (só números)", (await X.pg.locator(".run-svg-wrap").count()) === 0 && (await X.pg.locator(".run-split").count()) === 1 && !/<b>/.test(dx));
  await X.ctx.close();

  // largura e alvos de toque (iPhone estreito)
  var Y = await student({runs: [runRow(0, {over: {id: uuid(51)}})], tracks: [{run_id: uuid(51), student_id: "ana", fmt: 1, trim_m: 100, points: shared}]});
  async function noOverflow(pg){ return pg.evaluate(function(){ return document.documentElement.scrollWidth <= window.innerWidth + 1 && document.body.scrollWidth <= window.innerWidth + 1; }); }
  var okWidth = await noOverflow(Y.pg);
  var heights = await Y.pg.evaluate(function(){ return Array.prototype.map.call(document.querySelectorAll("#runGoImport, #runGoManual, .run-row, #runMore"), function(b){ return b.getBoundingClientRect().height; }); });
  await Y.pg.click("#runGoImport"); await Y.pg.waitForSelector("#runFile", {state: "attached"});
  okWidth = okWidth && await noOverflow(Y.pg);
  var fh = await Y.pg.evaluate(function(){ return document.querySelector(".run-file").getBoundingClientRect().height; });
  await Y.pg.setInputFiles("#runFile", {name: "a.gpx", mimeType: "application/gpx+xml", buffer: Buffer.from(gpxOf(P5K))});
  await Y.pg.waitForSelector("#runSave");
  await Y.pg.check("#runSvShare");
  okWidth = okWidth && await noOverflow(Y.pg);
  var sh = await Y.pg.evaluate(function(){ return Array.prototype.map.call(document.querySelectorAll("#runSvSave, #runSvCancel, #runSvExport, .run-opt, .run-check"), function(b){ return b.getBoundingClientRect().height; }); });
  await Y.pg.click("#runSvCancel"); await Y.pg.waitForSelector("#runFile", {state: "attached"}); await Y.pg.click("#runBack"); await Y.pg.waitForSelector(".run-row");
  await Y.pg.click(".run-row"); await Y.pg.waitForSelector(".run-svg-wrap svg");
  okWidth = okWidth && await noOverflow(Y.pg);
  var dh = await Y.pg.evaluate(function(){ return Array.prototype.map.call(document.querySelectorAll("#runDelTrack, #runDelRun, #runExportSaved, #runBack"), function(b){ return b.getBoundingClientRect().height; }); });
  ck("135. A 390 px não há rolagem horizontal em nenhum ecrã (início, importar, confirmar, detalhe)", okWidth);
  ck("136. Os botões e linhas tocáveis têm pelo menos 44 px de altura (início, importar, confirmar, detalhe)", heights.length >= 3 && heights.concat([fh], sh, dh).every(function(h){ return h >= 43.5; }));
  await Y.ctx.close();

  // ==================================================================================================================== O. revisão: aviso único, vista de dados, recibo do consentimento, fila, lista sem limite de idade
  // (3/9/39) O aviso é UM só (versão 1) e diz a verdade sobre TODOS os usos: não pode afirmar que o GPS não é usado quando o profissional o pode ligar.
  var NC1 = await student({consent: false});
  var privImport = (await NC1.pg.evaluate(function(){ var d = document.getElementById("runPrivacy"); return d ? d.textContent : ""; }));
  await NC1.pg.click("#runGoImport"); await NC1.pg.waitForSelector("#runConsent");
  var noticeImport = (await NC1.pg.locator("#runConsent").innerText()).replace(/\s+/g, " ");
  await NC1.ctx.close();
  var NC2 = await student({mode: "live", consent: false});
  var liveBtn = await NC2.pg.locator("#runGoLive").evaluate(function(b){ return b.textContent; });
  await NC2.pg.click("#runGoLive"); await NC2.pg.waitForSelector("#runConsent");
  var noticeLive = (await NC2.pg.locator("#runConsent").innerText()).replace(/\s+/g, " ");
  var noticeParas = await NC2.pg.locator("#runConsent p:not(.run-err)").allInnerTexts();
  await NC2.pg.click("#runCsAccept"); await NC2.pg.waitForSelector("#fakeLive");
  var accV = (await tables(NC2.pg)).run_consents.map(function(c){ return c.version; });
  await NC2.ctx.close();
  ck("137. O aviso de consentimento é o MESMO nos dois modos (importar e gravar com GPS) e continua na versão 1: quem aceita no modo «importar» aceitou o que diz sobre o GPS", noticeImport === noticeLive && accV.join() === "1" && noticeParas.length >= 4);
  var liveSrc = fs.readFileSync(path.join(root, "corrida-live.js"), "utf8"), mig = fs.readFileSync(path.join(root, "supabase/migrations/0032_corrida.sql"), "utf8");
  var prepLabel = (/runLivePrepare[\\"']*>([^<]+)</.exec(liveSrc) || [])[1];
  ck("138. O aviso descreve os três usos (ficheiro GPX/TCX, à mão, GPS), o que o GPS faz («" + liveBtn + "» e «" + prepLabel + "», só com a EVOLVE aberta, rascunho neste telemóvel) e que o ecrã bloqueado pode falhar", !!prepLabel && noticeLive.indexOf("«" + liveBtn + "»") >= 0 && noticeLive.indexOf("«" + prepLabel + "»") >= 0 && /ficheiro \(GPX ou TCX\)/.test(noticeLive) && /registas a corrida à mão/.test(noticeLive) && /gravas aqui com o GPS do telemóvel/.test(noticeLive) && /só enquanto a EVOLVE está aberta a gravar/.test(noticeLive) && /rascunho neste telemóvel até guardares ou descartares/.test(noticeLive) && /ecrã bloqueado ou noutra aplicação o registo pode falhar/.test(noticeLive) && /\bRUN_DRAFT_KEY\b/.test(liveSrc));
  // cada coluna que se grava tem a sua menção: quem acrescentar uma coluna a EXPECTED_COLS (e ao insert) tem de dizer aqui, e no aviso, o que ela é
  var COL_TERMS = {id: true, student_id: true, consent_v: /versão deste aviso/, started_at: /data e a hora de início/, source: /a origem \(ficheiro GPX ou TCX, à mão ou GPS\)/, duration_s: /tempo total/, moving_s: /tempo em movimento/,
    distance_m: /a distância/, gaps: /lacunas sem sinal/, gap_s: /lacunas sem sinal/, hidden_s: /segundo plano/, splits_s: /tempo de cada quilómetro/, rpe: /esforço \(1 a 10\)/, notes: /as notas que escreveres/};
  var colsMissing = EXPECTED_COLS.filter(function(c){ return !(c in COL_TERMS) || (COL_TERMS[c] !== true && !COL_TERMS[c].test(noticeLive)); });
  ck("139. Cada coluna que a corrida grava (data, origem, tempos, parciais, lacunas, segundo plano, esforço, notas, versão do aviso) vem dita no aviso" + (colsMissing.length ? " (em falta: " + colsMissing.join(", ") + ")" : ""), colsMissing.length === 0 && EXPECTED_COLS.length === 14);
  var proReadsAll = /create policy "professionals read runs" on runs for select\s+using \(exists \(select 1 from professionals where user_id = auth\.uid\(\)\)\)/.test(mig);
  ck("140. «Quem vê» diz a verdade sobre a política do servidor (qualquer profissional lê as corridas): «tu e os profissionais da EVOLVE», não «o teu profissional»; e «Privacidade e dados» repete os mesmos parágrafos", proReadsAll && /Quem vê: tu e os profissionais da EVOLVE/.test(noticeLive) && !/Quem vê: tu e o teu profissional/.test(noticeLive) && noticeParas.every(function(p){ return privImport.replace(/\s+/g, " ").indexOf(p.replace(/\s+/g, " ")) >= 0; }));

  // (4/10/54) Corrida desligada: o aluno vê e apaga o que já tem (nada de importar, registar à mão nem gravar), mesmo com o profissional a ver o separador
  var OF = await student({mode: "off", consent: true, wait: "#runOffData", settle: false, runs: [runRow(0, {over: {id: uuid(91), notes: "primeira"}}), runRow(1, {over: {id: uuid(92), notes: "segunda"}})],
    tracks: [{run_id: uuid(91), student_id: "ana", fmt: 1, trim_m: 100, points: shared}]});
  var offCard = await tabText(OF.pg);
  ck("141. Com a Corrida desligada o separador mostra o cartão «A Corrida ainda não está ativa para ti» (diz «profissional», nunca «treinador») e o botão «Ver ou apagar as minhas corridas»; nada foi pedido ao servidor da Corrida", /A Corrida ainda não está ativa para ti/.test(offCard) && /O teu profissional liga-a/.test(offCard) && !/treinador/i.test(offCard) && (await OF.pg.locator("#runOffData").count()) === 1 && (await OF.pg.evaluate(function(){ return window.__fake.selects.filter(function(t){ return /^run/.test(t); }).length; })) === 0);
  await OF.pg.evaluate(function(){ window.__draft = true; window.__qPending = 1; });
  await OF.pg.click("#runOffData");
  await OF.pg.waitForSelector("#runOff"); await OF.pg.waitForSelector(".run-row");
  var offTxt = await tabText(OF.pg);
  ck("142. «Ver ou apagar as minhas corridas» abre a vista de dados: título «A Corrida está desligada», explica que só se pode ver e apagar, e mostra a lista (2 corridas) com «Voltar»", /A Corrida está desligada/.test(offTxt) && /só podes ver e apagar o que já tens guardado/.test(offTxt) && (await OF.pg.locator(".run-row").count()) === 2 && (await OF.pg.locator("#runOffBack").count()) === 1 && /primeira/.test(offTxt) && !/treinador/i.test(offTxt));
  ck("143. A vista de dados NÃO oferece importar, registar à mão, gravar com GPS, guia de exportação nem o ecrã de consentimento; só «Apagar todas as corridas» e «Retirar consentimento» (Privacidade e dados já aberta)", (await OF.pg.locator("#runGoImport, #runGoManual, #runGoLive, #runFile, #runGuide, #runConsent").count()) === 0 && !/Importar ficheiro|Registar à mão|Como obter o ficheiro/.test((await OF.pg.locator("#alunoTabContent button, #alunoTabContent summary").allInnerTexts()).join("|")) && (await OF.pg.locator("#runDelAll").count()) === 1 && (await OF.pg.locator("#runWithdraw").count()) === 1 && (await OF.pg.locator("#runPrivacy[open]").count()) === 1);
  ck("144. O aviso do rascunho/da fila do gravador (RUN.liveDraftBanner) aparece também na vista de dados e os seus eventos são ligados, para o aluno os poder descartar", (await OF.pg.locator("#fakeBanner").count()) === 1 && (await OF.pg.evaluate(function(){ return window.__bannerWired; })) >= 1);
  await OF.pg.evaluate(function(){ var T = window.__T; T.RUN.go("import"); });
  await OF.pg.waitForSelector("#runOff");
  var forced = await OF.pg.evaluate(function(){ var T = window.__T; T.RUN.go("manual"); T.RUN.go("save", {prep: {source: "gpx", stats: {distM: 1, durationS: 1}, segments: []}}); return T.RUN.v.name; });
  await OF.pg.waitForSelector("#runOff");
  ck("145. Mesmo que algo peça outra vista (importar, à mão, confirmar), com a Corrida desligada fica sempre a vista de dados", forced === "home" && (await OF.pg.locator("#runFile, #runManual, #runSave").count()) === 0 && (await OF.pg.locator("#runOff").count()) === 1);
  await OF.pg.click('.run-row[data-run="' + uuid(91) + '"]');
  await OF.pg.waitForSelector("#runDelRun"); await OF.pg.waitForSelector(".run-svg-wrap svg");
  ck("146. Abrir uma corrida na vista de dados mostra o detalhe com «Exportar GPX», «Apagar só o percurso» e «Apagar corrida»", (await OF.pg.locator("#runDelTrack").count()) === 1 && (await OF.pg.locator("#runExportSaved").count()) === 1);
  await OF.pg.click("#runDelRun");
  await OF.pg.waitForSelector("#runOff");
  await OF.pg.waitForFunction(function(){ return document.querySelectorAll(".run-row").length === 1; });
  var tOf = await tables(OF.pg);
  ck("147. Apagar uma corrida na vista de dados apaga-a (e o percurso) no servidor e volta à vista de dados com a outra", tOf.runs.length === 1 && tOf.runs[0].id === uuid(92) && tOf.run_tracks.length === 0 && (await OF.pg.locator("#runOff").count()) === 1);
  ck("148. Apagar uma só corrida NÃO esvazia a fila de envio do telemóvel (as corridas por enviar de outras não se perdem)", (await OF.pg.evaluate(function(){ return window.__qClear || []; })).length === 0);
  OF.ctl.dialogs.length = 0;
  await OF.pg.click("#runDelAll");
  await OF.pg.waitForSelector("#runEmpty");
  ck("149. «Apagar todas as corridas» (que avisa que também apaga as corridas por enviar deste telemóvel) apaga tudo, limpa a fila local do aluno (RUN.queueClear) e a vista diz «Não tens corridas guardadas.»", OF.ctl.dialogs.some(function(d){ return /^Apagar todas as tuas corridas\? Não dá para desfazer\. Também apaga as corridas por enviar que estão neste telemóvel\.$/.test(d); }) && (await tables(OF.pg)).runs.length === 0 && (await OF.pg.evaluate(function(){ return window.__qClear; })).join() === "ana" && /Não tens corridas guardadas\./.test(await tabText(OF.pg)) && (await OF.pg.locator("#runGoImport, #runGoManual").count()) === 0);
  await OF.pg.click("#runOffBack");
  await OF.pg.waitForSelector("#corridaOff");
  ck("150. «Voltar» desliga a vista de dados (RUN.dataMode = false) e volta ao cartão «A Corrida ainda não está ativa para ti»", (await OF.pg.evaluate(function(){ return window.__T.RUN.dataMode; })) === false && (await OF.pg.locator("#runOff").count()) === 0 && (await OF.pg.locator("#runOffData").count()) === 1);
  ck("151. Em toda a vista de dados só se apagou: nenhum insert nas tabelas da Corrida e nenhuma coordenada escrita", (await writes(OF.pg)).filter(function(w){ return /run/.test(w.table) && w.op === "insert"; }).length === 0);
  await OF.ctx.close();

  var wipeSeed2 = {}; wipeSeed2["evolve_run_draft_v1"] = JSON.stringify({uid: "user-1", segs: []}); wipeSeed2["evolve_runs_outbox_v1"] = JSON.stringify([{uid: "user-1", id: "x", state: "failed"}]);
  var OW = await student({mode: "off", consent: true, wait: "#runOffData", settle: false, seed: wipeSeed2, init: function(){ window.__cache = {ana: 1}; }, runs: [runRow(0, {over: {id: uuid(93)}})]});
  await OW.pg.click("#runOffData"); await OW.pg.waitForSelector(".run-row");
  await OW.pg.click("#runWithdraw");
  await OW.pg.waitForSelector("#runEmpty");
  var lsOW = await OW.pg.evaluate(function(){ return {d: localStorage.getItem("evolve_run_draft_v1"), o: localStorage.getItem("evolve_runs_outbox_v1"), reset: window.__resetCalls || 0, cache: window.__cache.ana}; });
  var tOW = await tables(OW.pg);
  ck("152. «Retirar consentimento» na vista de dados apaga o consentimento e todas as corridas, o rascunho, a fila (também as recusadas) e o recibo local, pára o gravador (RUN.reset), e fica na vista de dados", tOW.run_consents.length === 0 && tOW.runs.length === 0 && lsOW.d === null && lsOW.o === null && lsOW.reset >= 1 && lsOW.cache === undefined && (await OW.pg.locator("#runOff").count()) === 1);
  await OW.ctx.close();

  var OV = await open("professional", [row("ana", "Ana Silva", "off")], "treino.html");
  await OV.pg.waitForSelector("#alunoStudentSwitch");
  await seedConsent(OV.pg, "ana"); await seedRuns(OV.pg, [runRow(0, {over: {id: uuid(94)}})]);
  await OV.pg.click('.tabbar [data-tab="corrida"]'); await OV.pg.waitForSelector("#runOffData");
  await OV.pg.click("#runOffData"); await OV.pg.waitForSelector(".run-row");
  ck("153. «Ver como aluno» com a Corrida desligada: a vista de dados é só de leitura (sem «Apagar todas», sem «Retirar consentimento», sem banner)", (await OV.pg.locator("#runOff").count()) === 1 && (await OV.pg.locator("#runDelAll, #runWithdraw, #fakeBanner, #runGoImport").count()) === 0 && (await writes(OV.pg)).filter(function(w){ return /run/.test(w.table); }).length === 0);
  await OV.ctx.close();

  // (33/40/10) o texto do profissional diz o que o aluno vê de facto
  var PT = await open("professional", [row("a", "Ana Silva", "off")], "index.html");
  await PT.pg.waitForSelector(".student-row");
  await proCorridas(PT.pg, "a");
  var helpOff = await PT.pg.locator("#runModeHelp").innerText();
  await PT.pg.click('[data-run-mode="import"]'); await PT.pg.waitForSelector('.run-mode[data-run-mode="import"].on');
  var helpImp = await PT.pg.locator("#runModeHelp").innerText();
  await PT.pg.click('[data-run-mode="live"]'); await PT.pg.waitForSelector('.run-mode[data-run-mode="live"].on');
  var helpLive = await PT.pg.locator("#runModeHelp").innerText();
  ck("154. O texto do interruptor diz a verdade: desligada = o aluno continua a ver o separador (com a indicação de que não está ativa), as corridas ficam mas ele pode vê-las e apagá-las; «importar» não diz que o separador «passa a aparecer»; «GPS» diz que só liga em «Preparar GPS»; nenhum diz «treinador»", /continua a ver o separador «Corrida»/.test(helpOff) && !/não vê o separador/.test(helpOff) && /o aluno também as pode ver e apagar/.test(helpOff) && !/passa a ver/.test(helpImp) && /separador «Corrida» da app EVOLVE Treino/.test(helpImp) && /só liga depois de ele carregar em «Preparar GPS»/.test(helpLive) && !/treinador/i.test(helpOff + helpImp + helpLive));
  await PT.ctx.close();

  // (11/16/21) começar sem rede, ao ar livre: o recibo local do consentimento (só quando a leitura falha por rede); o servidor decide sempre
  var RC1 = await student({consent: true, init: function(){ window.__cache = {ana: 1}; }});
  await RC1.ctx.setOffline(true);
  await RC1.pg.click("#runGoManual");
  await RC1.pg.waitForSelector("#runManual");
  ck("155. Sem rede, com o recibo local do consentimento da versão atual, «Registar à mão» abre (a app abriu com rede mas esta sessão ainda não tinha lido o consentimento)", (await RC1.pg.locator("#runConsent").count()) === 0 && !(await RC1.pg.evaluate(function(){ return window.__toasts.some(function(t){ return /Não consegui verificar o teu consentimento/.test(t); }); })));
  await RC1.ctx.setOffline(false); await RC1.ctx.close();
  var RC2 = await student({mode: "live", consent: true, init: function(){ window.__cache = {ana: 1}; }});
  await RC2.ctx.setOffline(true);
  await RC2.pg.click("#runGoLive");
  await RC2.pg.waitForSelector("#fakeLive");
  ck("156. O mesmo vale para «Gravar com GPS»: sem rede e com o recibo, o gravador abre", (await RC2.pg.evaluate(function(){ return window.__liveOpen; })) === 1);
  await RC2.ctx.setOffline(false); await RC2.ctx.close();
  var RC3 = await student({consent: true, init: function(){ window.__cache = {ana: 0}; }});
  await RC3.ctx.setOffline(true);
  await RC3.pg.click("#runGoImport");
  await RC3.pg.waitForFunction(function(){ return (window.__toasts || []).some(function(t){ return /Sem ligação\. Não consegui verificar o teu consentimento/.test(t); }); });
  ck("157. Um recibo de OUTRA versão não serve: sem rede avisa «Não consegui verificar o teu consentimento» e não abre nada", (await RC3.pg.locator("#runFile, #runConsent").count()) === 0);
  await RC3.ctx.setOffline(false); await RC3.ctx.close();
  var RC4 = await student({consent: false, init: function(){ window.__cache = {ana: 1}; }});
  await RC4.pg.click("#runGoImport");
  await RC4.pg.waitForSelector("#runConsent");
  ck("158. Com rede quem decide é o servidor: sem consentimento no servidor mostra-se o aviso mesmo com um recibo local, e o recibo é apagado", (await RC4.pg.evaluate(function(){ return window.__cache.ana; })) === undefined && (await RC4.pg.evaluate(function(){ return window.__cacheLog.map(function(x){ return x[0]; }).join(); })) === "clear");
  await RC4.pg.click("#runCsAccept"); await RC4.pg.waitForSelector("#runFile", {state: "attached"});
  ck("159. Aceitar o aviso guarda o recibo (versão 1)", (await RC4.pg.evaluate(function(){ return window.__cache.ana; })) === 1);
  await RC4.ctx.close();
  var RC5 = await student({consent: true});
  await RC5.pg.click("#runGoImport"); await RC5.pg.waitForSelector("#runFile", {state: "attached"});
  ck("160. Ler o consentimento no servidor e ver que existe guarda o recibo (versão 1)", (await RC5.pg.evaluate(function(){ return window.__cache.ana; })) === 1);
  var lost = await RC5.pg.evaluate(async function(){
    var T = window.__T, s = T.findStudent("ana");
    window.__fake.tables.run_consents.length = 0;   // o consentimento foi retirado noutro aparelho
    var row = T.runBuildInsert({id: T.runUuid(), studentId: "ana", source: "gpx", startedAtMs: Date.now() - 86400000, durationS: 1800, movingS: 1790, distM: 5000, gaps: 0, gapS: 0, splitsS: [], hiddenS: 0, rpe: null, notes: "", consentV: 1}, Date.now());
    var res = await T.RUN.submitRun(s, {row: row, track: null});
    return {ok: res.ok, permanent: res.permanent, cache: window.__cache.ana};
  });
  ck("161. Se o servidor recusar a corrida por falta de consentimento, o recibo local é apagado (próxima vez sem rede já não deixa começar)", lost.ok === false && lost.permanent === true && lost.cache === undefined);
  await RC5.ctx.close();
  var RC6 = await student({consent: true, cache: false, init: function(){ window.__cache = {ana: 1}; }});
  await RC6.ctx.setOffline(true);
  await RC6.pg.click("#runGoImport");
  await RC6.pg.waitForFunction(function(){ return (window.__toasts || []).some(function(t){ return /Não consegui verificar o teu consentimento/.test(t); }); });
  ck("162. Sem as funções do recibo (gravador por carregar ou antigo) tudo fica como antes: sem rede e sem confirmação nesta sessão, não abre", (await RC6.pg.locator("#runFile, #runConsent").count()) === 0);
  await RC6.ctx.setOffline(false); await RC6.ctx.close();

  // (24) apagar todas limpa a fila local; recusado pelo servidor não limpa nada
  var QC = await student({runs: [runRow(0, {over: {id: uuid(95)}})]});
  await QC.pg.locator("#runPrivacy summary").click();
  await QC.pg.evaluate(function(){ window.__fake.failNext = 1; });
  await QC.pg.click("#runDelAll"); await QC.pg.waitForTimeout(300);
  ck("163. Se o servidor recusar «Apagar todas», nada se apaga e a fila local fica como estava", (await tables(QC.pg)).runs.length === 1 && (await QC.pg.evaluate(function(){ return window.__qClear || []; })).length === 0);
  await QC.pg.click("#runDelAll"); await QC.pg.waitForSelector("#runEmpty");
  ck("164. «Apagar todas» (sem nada por enviar) pergunta só «Apagar todas as tuas corridas? Não dá para desfazer.» e limpa a fila do aluno uma vez", QC.ctl.dialogs.filter(function(d){ return /^Apagar todas as tuas corridas\? Não dá para desfazer\.$/.test(d); }).length === 2 && (await QC.pg.evaluate(function(){ return window.__qClear; })).join() === "ana");
  await QC.ctx.close();

  // (25) a lista não corta as corridas com mais de um ano; os totais continuam às 8 semanas
  var oldRuns = [runRow(0, {over: {id: uuid(96), distance_m: 6000}}), runRow(0, {over: {id: uuid(97), distance_m: 7000, started_at: new Date(Date.now() - 400 * 86400000).toISOString()}}), runRow(0, {over: {id: uuid(98), distance_m: 8000, started_at: new Date(Date.now() - 900 * 86400000).toISOString()}})];
  var OL = await student({runs: oldRuns});
  var olTxt = (await OL.pg.locator(".run-weeks").innerText()).replace(/\s+/g, " ");
  ck("165. A lista do aluno mostra também as corridas com 400 e 900 dias (nada fica escondido sem forma de apagar) e os totais das 8 semanas só contam a recente", (await OL.pg.locator(".run-row").count()) === 3 && /CORRIDAS 1\b/i.test(olTxt) && /6,00/.test(olTxt));
  await OL.pg.click('.run-row[data-run="' + uuid(97) + '"]'); await OL.pg.waitForSelector("#runDelRun");
  await OL.pg.click("#runDelRun"); await OL.pg.waitForFunction(function(){ return document.querySelectorAll(".run-row").length === 2; });
  ck("166. E a corrida antiga apaga-se uma a uma como as outras", (await tables(OL.pg)).runs.map(function(r){ return r.id; }).sort().join() === [uuid(96), uuid(98)].sort().join());
  await OL.ctx.close();
  var ageMany = [], ai;
  for (ai = 0; ai < 60; ai++) ageMany.push(runRow(0, {over: {id: uuid(2000 + ai), started_at: new Date(Date.now() - (ai + 1) * 3 * 3600000).toISOString(), distance_m: 4000 + ai}}));
  for (ai = 0; ai < 60; ai++) ageMany.push(runRow(0, {over: {id: uuid(3000 + ai), started_at: new Date(Date.now() - (400 + ai) * 86400000).toISOString(), distance_m: 3000 + ai}}));
  var OM = await student({runs: ageMany});
  await OM.pg.click("#runMore");
  await OM.pg.waitForFunction(function(){ return document.querySelectorAll(".run-row").length === 120; });
  ck("167. Com 60 corridas recentes e 60 com mais de um ano, a paginação chega às 120 (a página 2 traz as antigas)", (await OM.pg.locator("#runMore").count()) === 0);
  await OM.ctx.close();
  var OPro = await open("professional", [row("a", "Ana Silva", "import")], "index.html");
  await OPro.pg.waitForSelector(".student-row");
  await seedConsent(OPro.pg, "a"); await seedRuns(OPro.pg, [runRow(0, {sid: "a", over: {id: uuid(99), started_at: new Date(Date.now() - 500 * 86400000).toISOString()}})]);
  await proCorridas(OPro.pg, "a"); await OPro.pg.waitForSelector(".run-row");
  ck("168. O profissional também vê as corridas com mais de um ano do aluno", (await OPro.pg.locator(".run-row").count()) === 1);
  await OPro.ctx.close();

  // (aparo) o raio escondido leva uma folga ao acaso: corrida.js passa rnd = Math.random() ao núcleo (o gravador de mentira espia a chamada)
  var RN = await student({init: function(){ Math.random = function(){ return 0.5; }; }});
  await importFile(RN, "a.gpx", gpxOf(P5K));
  await RN.pg.waitForSelector("#runSave"); await RN.pg.check("#runSvShare");
  await RN.pg.click('label.run-opt:has(input[value="100"])');
  await RN.pg.click("#runSvSave"); await RN.pg.waitForSelector("#runGoImport");
  var prepCalls = await RN.pg.evaluate(function(){ return window.__prepCalls; });
  var lastPrep = prepCalls[prepCalls.length - 1];
  ck("169. Ao guardar com percurso partilhado, corrida.js chama runPrepareTrack com o escalão escolhido (trimM 100) e rnd = Math.random() (aqui 0,5); a pré-visualização usa trimM 0", !!lastPrep && lastPrep.trimM === 100 && lastPrep.rnd === 0.5 && prepCalls.some(function(c){ return c.trimM === 0; }) && (await tables(RN.pg)).run_tracks[0].trim_m === 100);
  await RN.ctx.close();

  // (42) uma gravação em curso não se esconde se o profissional mudar o modo: a vista «live» passa para o ecrã do gravador, que decide o que mostrar
  var LB = await student({mode: "import"});
  await LB.pg.evaluate(function(){ window.__busy = false; window.__T.RUN.go("live"); });
  await LB.pg.waitForSelector("#runGoImport");
  var idleLive = await LB.pg.locator("#fakeLive").count();
  await LB.pg.evaluate(function(){ window.__busy = true; window.__T.RUN.go("live"); });
  await LB.pg.waitForSelector("#fakeLive");
  ck("170. Com o modo «importar» e sem gravação em curso a vista «live» volta ao início; com o gravador ocupado (RUN.liveBusy) o ecrã do gravador mantém-se acessível (não fica órfão atrás do início)", idleLive === 0 && (await LB.pg.locator("#fakeLive").count()) === 1 && (await LB.pg.evaluate(function(){ return window.__liveWired; })) >= 1);
  await LB.ctx.close();

  // ==================================================================================================================== L. rede, consola, erros
  ck("171. Nenhum pedido saiu do site (nem mapas, nem terceiros): só 127.0.0.1, data: e blob:", external.length === 0 || (console.log(external), false));
  ck("172. Nenhuma coordenada foi escrita na consola, nos avisos (toasts) nem em nenhum endereço pedido (URLs e parâmetros), em toda a sessão de testes", consoleMsgs.every(function(m){ return !NOCOORD.test(m); }) && allToasts.length >= 10 && allToasts.every(function(t){ return !NOCOORD.test(t); }) && allUrls.length > 50 && allUrls.every(function(u){ return !NOCOORD.test(decodeURIComponent(u)); }));
  ck("173. Nenhum erro de JavaScript em nenhuma página", errors.length === 0 || (console.log(errors), false));
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", String(e && e.stack || e).split("\n").slice(0, 5).join(" | ")); process.exit(1); });
