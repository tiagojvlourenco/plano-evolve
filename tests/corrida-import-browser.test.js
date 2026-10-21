// Corrida, leitura de ficheiros (corrida-core.js: runParseGpx / runParseTcx / runParseFile) no Chromium, com ficheiros normais e HOSTIS.
// O que isto prova: o comportamento no Chromium do Playwright (o mesmo motor do Chrome/Android). NÃO prova nada sobre o Safari/WebKit
// nem o Firefox (o DOMParser e os limites de memória são diferentes), nem sobre ficheiros reais de relógios (aqui são sintéticos).
// Os tempos escritos são desta máquina (Chromium headless), não de um iPhone.
var fs = require("fs"), path = require("path"), http = require("http");
var check = require("./check")();
var root = path.join(__dirname, "..");
var n = 0;
function ck(desc, cond){ n++; if (parseInt(desc, 10) !== n) console.log("AVISO: verificação numerada " + parseInt(desc, 10) + " na posição " + n); check.check(desc, !!cond); }

var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){ console.log("(ignorado: Playwright/Chromium não disponíveis aqui)"); check.summarize(); }

var code = fs.readFileSync(path.join(root, "corrida-core.js"), "utf8");
var topNames = [], mm, re = /^(?:function\s+(\w+)|var\s+(\w+))/gm;
while ((mm = re.exec(code))) topNames.push(mm[1] || mm[2]);
var exportTail = "({" + topNames.map(function(x){ return x + ": " + x; }).join(", ") + "})";
// Node: o mesmo código, só para gerar entradas (runToGpx, runPrepareTrack... não precisam de DOM)
var C = (function(){ "use strict"; return eval(code + "\n;" + exportTail); })();

var T0 = Date.UTC(2026, 9, 1, 7, 0, 0), NOW = Date.UTC(2026, 9, 21, 12, 0, 0);
var LAT0 = 38.7, LON0 = -9.1, M_LAT = Math.PI / 180 * 6371008.8;
function iso(ms){ return new Date(ms).toISOString().replace(".000Z", "Z"); }
// ---- gerador de ficheiros sintéticos ----
var HR = "HRMARK-9137", NAME = "&lt;img src=x onerror=alert(1)&gt;NOMEMARK", AUTH = "AUTORMARK Joana Silva", CRE = "CREATORMARK";
function gpxText(segs, o){
  o = o || {};
  var body = segs.map(function(seg){
    return "<trkseg>" + seg.map(function(p){
      return '<trkpt lat="' + p[0] + '" lon="' + p[1] + '">' + (p[2] ? "<time>" + p[2] + "</time>" : "") + (o.hr === false ? "" : "<extensions><ns3:TrackPointExtension><ns3:hr>" + HR + "</ns3:hr></ns3:TrackPointExtension></extensions>") + "</trkpt>";
    }).join("") + "</trkseg>";
  }).join("");
  return '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="' + CRE + '" xmlns="http://www.topografix.com/GPX/1/1" xmlns:ns3="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">' +
    "<metadata><name>" + NAME + "</name><author><name>" + AUTH + "</name><email id=\"joana\" domain=\"example.com\"/></author></metadata>" +
    (o.rte ? "<rte><name>ROTAMARK</name><rtept lat=\"38.7\" lon=\"-9.1\"/><rtept lat=\"38.71\" lon=\"-9.1\"/></rte>" : "") + (o.wpt ? "<wpt lat=\"38.7\" lon=\"-9.1\"><name>x</name></wpt>" : "") +
    (segs.length ? "<trk><name>" + NAME + "</name><desc>" + AUTH + "</desc>" + body + "</trk>" : "") + "</gpx>";
}
function straight(n, step, dt, t0, tz){   // n pontos para norte, step metros, dt segundos; tz = sufixo de fuso («Z» por omissão, «» = sem fuso)
  var a = [], i, base = t0 == null ? T0 : t0;
  for (i = 0; i < n; i++) a.push([(LAT0 + i * step / M_LAT).toFixed(6), LON0.toFixed(6), new Date(base + i * dt * 1000).toISOString().slice(0, 19) + (tz == null ? "Z" : tz)]);
  return a;
}
function tcxText(acts, o){
  o = o || {};
  var ns = o.prefix ? o.prefix + ":" : "";
  var open = o.prefix ? '<' + ns + 'TrainingCenterDatabase xmlns:' + o.prefix + '="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:x="http://www.garmin.com/xmlschemas/ActivityExtension/v2">' : '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">';
  var close = "</" + ns + "TrainingCenterDatabase>";
  function e(name, inner, attrs){ return "<" + ns + name + (attrs || "") + ">" + inner + "</" + ns + name + ">"; }
  var a = acts.map(function(act){
    return e("Activity", e("Id", act.id || "2026-10-01T07:00:00Z") + act.laps.map(function(lap){
      return e("Lap", lap.map(function(track){
        return e("Track", track.map(function(tp){
          return e("Trackpoint", (tp.time ? e("Time", tp.time) : "") + (tp.pos ? e("Position", e("LatitudeDegrees", tp.pos[0]) + e("LongitudeDegrees", tp.pos[1])) : "") + e("HeartRateBpm", e("Value", HR)) + (tp.pos ? e("DistanceMeters", "12") : ""));
        }).join(""));
      }).join(""), ' StartTime="2026-10-01T07:00:00Z"');
    }).join("") + e("Creator", e("Name", AUTH), ' xsi:type="Device_t" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'), act.sport === undefined ? "" : ' Sport="' + act.sport + '"');
  }).join("");
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + open + (o.courses ? e("Courses", e("Course", e("Name", "ROTAMARK"))) : e("Activities", a)) + close;
}
function tcxPts(n, step, dt, t0, tz){ var a = [], i; for (i = 0; i < n; i++) a.push({time: new Date((t0 == null ? T0 : t0) + i * dt * 1000).toISOString().slice(0, 19) + (tz == null ? "Z" : tz), pos: [(LAT0 + i * step / M_LAT).toFixed(6), LON0.toFixed(6)]}); return a; }

var evilHits = 0;
var evil = http.createServer(function(req, res){ evilHits++; res.writeHead(200, {"Content-Type": "text/plain"}); res.end("x"); });

(async function(){
  await new Promise(function(r){ evil.listen(0, "127.0.0.1", r); });
  var evilUrl = "http://127.0.0.1:" + evil.address().port + "/x";
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [], requests = [];
  async function open(ctxOpts){
    var ctx = await browser.newContext(ctxOpts || {});
    var pg = await ctx.newPage(); pg.setDefaultTimeout(60000);
    pg.on("pageerror", function(e){ errors.push(e.message); });
    pg.on("request", function(r){ requests.push(r.url()); });
    await pg.goto("about:blank");
    // eval direto em modo estrito, como em loadCorrida (as declarações ficam no eval; exporta-se no fim)
    await pg.evaluate(function(a){ "use strict"; eval(a.code + "\n;window.RC = " + a.tail); }, {code: code, tail: exportTail});
    return {ctx: ctx, pg: pg};
  }
  var P = await open();
  var pg = P.pg;
  function gpx(text, opts){ return pg.evaluate(function(a){ return window.RC.runParseGpx(a.text, a.opts); }, {text: text, opts: opts || {nowMs: 1}}); }
  function file(name, text, opts){ return pg.evaluate(function(a){ return window.RC.runParseFile(a.name, a.text, a.opts); }, {name: name, text: text, opts: opts}); }
  var NOWO = {nowMs: NOW};
  function leaks(r){ var s = JSON.stringify(r); return /HRMARK|NOMEMARK|AUTORMARK|CREATORMARK|onerror|Joana|example\.com|ROTAMARK/.test(s); }
  function ptKeys(r){ return r.segments.every(function(s){ return s.every(function(p){ return Object.keys(p).sort().join() === "acc,lat,lon,t" && p.acc === null; }); }); }

  // ======================= GPX normal =======================
  var g1 = await gpx(gpxText([straight(5, 10, 5)]), NOWO);
  ck("1. GPX do tipo Garmin (prefixo ns3, frequência cardíaca, nome, autor): lê 1 segmento de 5 pontos com hora em ms", g1.ok === true && g1.source === "gpx" && g1.segments.length === 1 && g1.segments[0].length === 5 && g1.startedAtMs === T0 && g1.endedAtMs === T0 + 20000 && g1.points === 5 && g1.segments[0][1].t === T0 + 5000 && Math.abs(g1.segments[0][4].lat - (LAT0 + 40 / M_LAT)) < 1e-6 && g1.warnings.length === 0);
  ck("2. Os pontos lidos só têm lat, lon, t e acc:null; nada do ficheiro (nome, autor, creator, FC, extensões) aparece no resultado", ptKeys(g1) && !leaks(g1));
  var g2 = await gpx(gpxText([straight(3, 10, 5), straight(4, 10, 5, T0 + 600000), straight(2, 10, 5, T0 + 900000)]), NOWO);
  ck("3. Vários trkseg: cada um é um segmento (3 + 4 + 2 pontos), por ordem", g2.ok && g2.segments.map(function(s){ return s.length; }).join() === "3,4,2" && g2.points === 9);
  var g2b = await gpx(gpxText([straight(3, 10, 5)]).replace("</trk>", "</trk><trk><trkseg>" + straight(2, 10, 5, T0 + 100000).map(function(p){ return '<trkpt lat="' + p[0] + '" lon="' + p[1] + '"><time>' + p[2] + "</time></trkpt>"; }).join("") + "</trkseg></trk>"), NOWO);
  ck("4. Vários trk: todos os trkseg de todos os trk entram, por ordem", g2b.ok && g2b.segments.length === 2 && g2b.points === 5);
  var off = await gpx(gpxText([[[LAT0, LON0, "2026-10-01T08:00:00+01:00"], [LAT0 + 0.0001, LON0, "2026-10-01T02:00:10-0500"]]]), NOWO);
  ck("5. Horas com fusos diferentes (+01:00, -0500) dão o mesmo instante UTC", off.ok && off.startedAtMs === T0 && off.endedAtMs === T0 + 10000 && off.warnings.length === 0);
  var rte = await gpx(gpxText([], {rte: true}), NOWO), wpt = await gpx(gpxText([], {wpt: true}), NOWO), rteTrk = await gpx(gpxText([straight(3, 10, 5)], {rte: true}), NOWO);
  ck("6. Só rte (percurso planeado) ou só wpt: recusado com «É um percurso planeado, não uma corrida gravada.»", rte.ok === false && rte.code === "route" && rte.error === "É um percurso planeado, não uma corrida gravada." && wpt.ok === false && wpt.code === "route" && !leaks(rte));
  ck("7. rte junto com um trk gravado: o rte ignora-se e o trk lê-se", rteTrk.ok && rteTrk.points === 3);
  var notime = await gpx(gpxText([[[LAT0, LON0, null], [LAT0 + 0.0001, LON0, null]]]), NOWO);
  ck("8. Sem nenhuma hora: recusado, sem calcular ritmo, e sugere o registo à mão", notime.ok === false && notime.code === "notime" && /não tem horas/.test(notime.error) && /à mão/.test(notime.error));
  var someTime = await gpx(gpxText([[[LAT0, LON0, iso(T0)], [LAT0 + 0.0001, LON0, null], [LAT0 + 0.0002, LON0, iso(T0 + 10000)], [LAT0 + 0.0003, LON0, "isto não é uma data"]]]), NOWO);
  ck("9. Pontos sem hora (ou com hora ilegível) são ignorados com um aviso que só leva números", someTime.ok && someTime.points === 2 && someTime.warnings.join("|") === "Ignorámos 2 pontos sem hora.");
  var naive = await gpx(gpxText([[[LAT0, LON0, "2026-10-01T07:00:00"], [LAT0 + 0.0001, LON0, "2026-10-01T07:00:10"]]]), NOWO);
  ck("10. Horas sem fuso lêem-se como UTC e avisa-se: «O ficheiro não tinha fuso horário: assumimos hora UTC.»", naive.ok && naive.startedAtMs === T0 && naive.warnings.length === 1 && naive.warnings[0] === "O ficheiro não tinha fuso horário: assumimos hora UTC.");
  var bad = await gpx(gpxText([[[LAT0, LON0, iso(T0)], ["91", LON0, iso(T0 + 1000)], [LAT0, "abc", iso(T0 + 2000)], ["", "", iso(T0 + 3000)], [0, 0, iso(T0 + 4000)], [LAT0 + 0.0001, LON0, iso(T0 + 5000)], [LAT0 + 0.0002, LON0, iso(T0 + 5000)], [LAT0 + 0.0003, LON0, iso(T0 + 2000)], [LAT0 + 0.0004, LON0, iso(T0 + 9000)]]]), NOWO);
  ck("11. Coordenadas inválidas, (0,0), horas repetidas ou a recuar são descartadas (3 + 1 + 2 = 6 pontos) e fica o resto crescente", bad.ok && bad.points === 3 && bad.segments[0].map(function(p){ return p.t - T0; }).join() === "0,5000,9000" && bad.warnings.join("|") === "Ignorámos 6 pontos inválidos ou com hora repetida.");
  var future = await gpx(gpxText([straight(3, 10, 5, NOW + 5 * 86400000)]), NOWO), within = await gpx(gpxText([straight(3, 10, 5, NOW + 3600000)]), NOWO), old = await gpx(gpxText([straight(3, 10, 5, Date.UTC(1999, 5, 1))]), NOWO);
  ck("12. Início no futuro (5 dias) ou antes de 2000: recusado com «A data desta corrida não é válida»; 1 hora no futuro (fusos) passa", future.ok === false && future.code === "date" && old.ok === false && old.code === "date" && /não é válida/.test(old.error) && within.ok === true);
  var long = await gpx(gpxText([straight(3, 10, 50000, T0)]), NOWO);
  ck("13. Mais de 24 horas entre o primeiro e o último ponto: recusado", long.ok === false && long.code === "long" && /24 horas/.test(long.error));
  var one = await gpx(gpxText([straight(1, 10, 5)]), NOWO);
  ck("14. Um único ponto: recusado («pontos a menos»)", one.ok === false && one.code === "short");
  var empty = await gpx('<gpx version="1.1" creator="x" xmlns="http://www.topografix.com/GPX/1/1"></gpx>', NOWO), emptyTrk = await gpx('<gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg></trkseg></trk></gpx>', NOWO);
  ck("15. GPX sem percurso nenhum (nem rte nem trk com pontos): recusado com a mensagem do treino interior", empty.ok === false && empty.code === "empty" && /à mão/.test(empty.error) && emptyTrk.ok === false && emptyTrk.code === "empty");
  var noNs = await gpx('<gpx version="1.0"><trk><trkseg><trkpt lat="38.7" lon="-9.1"><time>2026-10-01T07:00:00Z</time></trkpt><trkpt lat="38.7001" lon="-9.1"><time>2026-10-01T07:00:05Z</time></trkpt></trkseg></trk></gpx>', NOWO);
  var pfx = await gpx('<g:gpx xmlns:g="http://www.topografix.com/GPX/1/1" version="1.1" creator="x"><g:trk><g:trkseg><g:trkpt lat="38.7" lon="-9.1"><g:time>2026-10-01T07:00:00Z</g:time></g:trkpt><g:trkpt lat="38.7001" lon="-9.1"><g:time>2026-10-01T07:00:05Z</g:time></g:trkpt></g:trkseg></g:trk></g:gpx>', NOWO);
  ck("16. Sem espaço de nomes (GPX 1.0 antigo) e com prefixo (g:trkpt) também se leem: o prefixo é ignorado", noNs.ok && noNs.points === 2 && pfx.ok && pfx.points === 2);
  var bom = await gpx("﻿ \n" + gpxText([straight(3, 10, 5)]), NOWO);
  ck("17. BOM e linhas em branco antes da declaração XML não estragam a leitura", bom.ok && bom.points === 3);
  var viaFile = await file("percurso.GPX", gpxText([straight(3, 10, 5)]), NOWO), tcxViaFile = await file("sem-extensao", tcxText([{sport: "Running", laps: [[tcxPts(3, 10, 5)]]}]), NOWO), wrongExt = await file("treino.fit.txt", gpxText([straight(3, 10, 5)]), NOWO);
  ck("18. runParseFile detecta pelo conteúdo (raiz gpx ou TrainingCenterDatabase), não pelo nome ou pelo tipo MIME", viaFile.ok && viaFile.source === "gpx" && tcxViaFile.ok && tcxViaFile.source === "tcx" && wrongExt.ok && wrongExt.source === "gpx");

  // ======================= TCX =======================
  var t1 = await pg.evaluate(function(a){ return window.RC.runParseTcx(a.text, a.opts); }, {text: tcxText([{sport: "Running", laps: [[tcxPts(5, 10, 5)]]}]), opts: NOWO});
  ck("19. TCX normal (Running, FC, criador): 1 segmento de 5 pontos; FC, nome e criador não aparecem", t1.ok && t1.source === "tcx" && t1.segments.length === 1 && t1.points === 5 && t1.startedAtMs === T0 && ptKeys(t1) && !leaks(t1));
  function tcx(acts, o, opts){ return pg.evaluate(function(a){ return window.RC.runParseTcx(a.text, a.opts); }, {text: tcxText(acts, o), opts: opts || NOWO}); }
  var tOther = await tcx([{sport: "Other", laps: [[tcxPts(3, 10, 5)]]}]), tNone = await tcx([{laps: [[tcxPts(3, 10, 5)]]}]), tWalk = await tcx([{sport: "Walking", laps: [[tcxPts(3, 10, 5)]]}]);
  ck("20. Sport Other aceite (e Walking ou sem Sport também); o que não é bicicleta passa", tOther.ok && tNone.ok && tWalk.ok);
  var tBike = await tcx([{sport: "Biking", laps: [[tcxPts(3, 10, 5)]]}]);
  ck("21. Sport Biking recusado: «Este ficheiro parece ciclismo»", tBike.ok === false && tBike.code === "bike" && /ciclismo/.test(tBike.error));
  var tTracks = await tcx([{sport: "Running", laps: [[tcxPts(3, 10, 5), tcxPts(2, 10, 5, T0 + 300000)], [tcxPts(4, 10, 5, T0 + 600000)]]}]);
  ck("22. Vários Track e várias Lap: cada Track é um segmento (3 + 2 + 4)", tTracks.ok && tTracks.segments.map(function(s){ return s.length; }).join() === "3,2,4");
  var mixed = tcxPts(4, 10, 5); mixed[1] = {time: mixed[1].time}; mixed[2] = {pos: mixed[2].pos};
  var tNoPos = await tcx([{sport: "Running", laps: [[mixed]]}]);
  ck("23. Trackpoint sem Position (ou sem Time) é ignorado: dos 4 pontos ficam 2", tNoPos.ok && tNoPos.points === 2 && tNoPos.warnings.join("|") === "Ignorámos 1 ponto sem hora.");
  var tAllNoPos = await tcx([{sport: "Running", laps: [[[{time: iso(T0)}, {time: iso(T0 + 1000)}]]]}]);
  ck("24. Nenhum Position (treino interior): recusado a sugerir o registo à mão", tAllNoPos.ok === false && tAllNoPos.code === "empty" && /à mão/.test(tAllNoPos.error));
  var tMulti = await tcx([{sport: "Running", laps: [[tcxPts(3, 10, 5)]]}, {sport: "Running", laps: [[tcxPts(7, 10, 5, T0 + 900000)]]}]);
  ck("25. Várias atividades: importa só a primeira e avisa", tMulti.ok && tMulti.points === 3 && tMulti.warnings.join("|") === "O ficheiro tem várias atividades: importámos só a primeira.");
  var tCourse = await tcx([], {courses: true}), tNoTime = await tcx([{sport: "Running", laps: [[[{pos: ["38.7", "-9.1"]}, {pos: ["38.8", "-9.1"]}]]]}]);
  ck("26. TCX só com Courses (planeado): «percurso planeado»; sem Time: «não tem horas»", tCourse.ok === false && tCourse.code === "route" && tNoTime.ok === false && tNoTime.code === "notime");
  var tPrefix = await tcx([{sport: "Running", laps: [[tcxPts(4, 10, 5)]]}], {prefix: "tc"});
  ck("27. TCX com prefixo de espaço de nomes (tc:Trackpoint) lê-se na mesma", tPrefix.ok && tPrefix.points === 4);
  var tNaive = await tcx([{sport: "Running", laps: [[tcxPts(3, 10, 5, T0, "")]]}]);
  ck("28. TCX com horas sem fuso: UTC com aviso", tNaive.ok && tNaive.startedAtMs === T0 && tNaive.warnings.join("|") === "O ficheiro não tinha fuso horário: assumimos hora UTC.");
  var wrongRoot = await pg.evaluate(function(a){ return window.RC.runParseTcx(a.text, a.opts); }, {text: gpxText([straight(3, 10, 5)]), opts: NOWO});
  var wrongRoot2 = await gpx(tcxText([{sport: "Running", laps: [[tcxPts(3, 10, 5)]]}]), NOWO);
  ck("29. runParseTcx num GPX e runParseGpx num TCX recusam (ficheiro do tipo errado)", wrongRoot.ok === false && wrongRoot.code === "unreadable" && wrongRoot2.ok === false && wrongRoot2.code === "unreadable");

  // ======================= XML mal formado e lixo =======================
  var malformed = ['<gpx><trk><trkseg><trkpt lat="1" lon="1"></gpx>', "<gpx", "isto não é XML", '{"json": true}', "", "   \n  ", '<kml xmlns="http://www.opengis.net/kml/2.2"><Placemark/></kml>', "<a><b></a></b>", '<gpx><trk><trkseg><trkpt lat="1" lon="1"/></trkseg></trk></gpx>garbage'];
  var mres = [];
  for (var i = 0; i < malformed.length; i++) mres.push(await gpx(malformed[i], NOWO));
  ck("30. XML mal formado, texto livre, JSON, vazio, KML: «Não consegui ler este ficheiro» e nada é guardado", mres.every(function(r){ return r.ok === false && r.code === "unreadable" && /^Não consegui ler este ficheiro\./.test(r.error) && !r.segments; }));
  var weird = await pg.evaluate(function(){ return [window.RC.runParseGpx(null), window.RC.runParseGpx(undefined), window.RC.runParseGpx(42), window.RC.runParseFile(null, {}), window.RC.runParseFile("x.gpx", null), window.RC.runParseFile(undefined, new Uint8Array([1, 2, 3])), window.RC.runParseTcx([])].map(function(r){ return r.ok === false; }); });
  ck("31. Entradas que nem são texto (null, número, objeto, bytes soltos) devolvem erro, sem lançar", weird.every(Boolean));

  // ======================= fuso horário do telemóvel =======================
  var NAIVE_GPX = gpxText([[[LAT0, LON0, "2026-10-01T07:00:00"], [LAT0 + 0.0001, LON0, "2026-10-01T07:00:10"]]]), TZ_GPX = gpxText([[[LAT0, LON0, "2026-10-01T07:00:00Z"], [LAT0 + 0.0001, LON0, "2026-10-01T07:00:10Z"]]]);
  var tzOut = {}, tzNative = {};
  var zones = ["Europe/Lisbon", "America/New_York", "Asia/Tokyo"];
  for (var z = 0; z < zones.length; z++) {
    var Z = await open({timezoneId: zones[z]});
    tzNative[zones[z]] = await Z.pg.evaluate(function(){ return new Date("2026-10-01T07:00:00").getTime(); });   // o que o JavaScript faria sozinho: depende do fuso
    tzOut[zones[z]] = await Z.pg.evaluate(function(a){ return [window.RC.runParseGpx(a.naive, {nowMs: a.now}), window.RC.runParseGpx(a.tz, {nowMs: a.now}), window.RC.runParseTime("2026-10-01T07:00:00")]; }, {naive: NAIVE_GPX, tz: TZ_GPX, now: NOW});
    await Z.ctx.close();
  }
  var nativeVals = zones.map(function(k){ return tzNative[k]; });
  ck("32. (controlo) o fuso de cada contexto é diferente: new Date(\"…T07:00:00\") dá 3 instantes distintos", nativeVals[0] !== nativeVals[1] && nativeVals[1] !== nativeVals[2] && nativeVals[0] !== nativeVals[2]);
  ck("33. Horas sem fuso dão o MESMO instante (UTC) em Europe/Lisbon, America/New_York e Asia/Tokyo", zones.every(function(k){ var o = tzOut[k]; return o[0].ok && o[0].startedAtMs === T0 && o[0].endedAtMs === T0 + 10000 && o[0].warnings.length === 1 && o[2].ms === T0 && o[2].naive === true; }));
  ck("34. Horas com Z dão o mesmo instante nos três fusos e sem aviso", zones.every(function(k){ var o = tzOut[k]; return o[1].ok && o[1].startedAtMs === T0 && o[1].warnings.length === 0; }));

  // ======================= ficheiros hostis =======================
  var hostile = {
    doctype: '<?xml version="1.0"?><!DOCTYPE gpx [<!ELEMENT gpx ANY>]><gpx xmlns="http://www.topografix.com/GPX/1/1"/>',
    doctypeLower: '<!doctype gpx><gpx xmlns="http://www.topografix.com/GPX/1/1"/>',
    entity: '<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><!ENTITY x "y"></gpx>',
    entityExt: '<?xml version="1.0"?><!DOCTYPE gpx [<!ENTITY ext SYSTEM "' + evilUrl + '">]><gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><name>&ext;</name></trk></gpx>',
    dtdExt: '<?xml version="1.0"?><!DOCTYPE gpx SYSTEM "' + evilUrl + '.dtd"><gpx xmlns="http://www.topografix.com/GPX/1/1"/>',
    laughs: '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;"><!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;"><!ENTITY lol4 "&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;"><!ENTITY lol5 "&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;"><!ENTITY lol6 "&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;"><!ENTITY lol7 "&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;"><!ENTITY lol8 "&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;"><!ENTITY lol9 "&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;">]><gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><name>&lol9;</name></trk></gpx>',
    quad: '<?xml version="1.0"?><!DOCTYPE kaboom [<!ENTITY a "' + new Array(5000).join("aaaaaaaaaa") + '">]><gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><name>' + new Array(2000).join("&a;") + "</name></trk></gpx>"
  };
  var hres = {}, hms = {};
  for (var k in hostile) { var t = Date.now(); hres[k] = await gpx(hostile[k], NOWO); hms[k] = Date.now() - t; }
  var hFile = await file("a.tcx", hostile.doctype, NOWO);
  ck("35. DOCTYPE e ENTITY (qualquer capitalização) são recusados antes de parsear: «Por segurança, não aceitamos este tipo de ficheiro XML.»", ["doctype", "doctypeLower", "entity", "entityExt", "dtdExt", "laughs", "quad"].every(function(k){ return hres[k].ok === false && hres[k].code === "doctype" && hres[k].error === "Por segurança, não aceitamos este tipo de ficheiro XML."; }) && hFile.code === "doctype");
  ck("36. Billion laughs, explosão quadrática e entidades externas terminam em < 1 s cada (recusados à entrada)", Object.keys(hms).every(function(k){ return hms[k] < 1000; }));
  ck("37. Zero pedidos de rede: o servidor local de teste não recebeu nenhuma visita e a página só tem about:blank", evilHits === 0 && requests.every(function(u){ return /^(about:|data:)/.test(u); }));
  // aninhamento enorme, sem DOCTYPE: o parser tem de recusar ou terminar; medimos
  var nest = {}, nestMs = {};
  for (var depth of [1000, 100000, 2000000]) {
    var tn = Date.now();
    nest[depth] = await pg.evaluate(function(d){ var s = '<gpx xmlns="http://www.topografix.com/GPX/1/1">'; var open = new Array(d + 1).join("<a>"), close = new Array(d + 1).join("</a>"); return window.RC.runParseGpx(s + open + close + "</gpx>", {nowMs: 1}); }, depth);
    nestMs[depth] = Date.now() - tn;
  }
  console.log("(tempos nesta máquina, Chromium) aninhamento de 1 000 / 100 000 / 2 000 000 níveis: " + nestMs[1000] + " / " + nestMs[100000] + " / " + nestMs[2000000] + " ms; resultado: " + [1000, 100000, 2000000].map(function(d){ return nest[d].code || (nest[d].ok ? "ok" : "?"); }).join(" / "));
  ck("38. Aninhamento enorme (100 000 e 2 000 000 níveis de elementos): não bloqueia a página (< 20 s), não lança e nunca devolve percurso", [100000, 2000000].every(function(d){ return nestMs[d] < 20000 && nest[d].ok === false; }));
  var manyAttrs = await pg.evaluate(function(){ var a = [], i; for (i = 0; i < 60000; i++) a.push('x' + i + '=""'); var t = performance.now(); var r = window.RC.runParseGpx('<gpx xmlns="http://www.topografix.com/GPX/1/1" ' + a.join(" ") + "/>", {nowMs: 1}); return {ok: r.ok, code: r.code, ms: performance.now() - t}; });
  console.log("(Chromium) elemento com 60 000 atributos: " + Math.round(manyAttrs.ms) + " ms, resultado " + manyAttrs.code);
  ck("39. Um elemento com 60 000 atributos (parser quadrático em alguns motores) termina em < 20 s e não dá percurso", manyAttrs.ms < 20000 && manyAttrs.ok === false);
  var big = await pg.evaluate(function(){ var t = performance.now(); var r = window.RC.runParseGpx(new Array(15 * 1024 * 1024 + 2).join("a"), {nowMs: 1}); var r2 = window.RC.runParseFile("x.gpx", new Uint8Array(15 * 1024 * 1024 + 1), {nowMs: 1}); var r3 = window.RC.runParseFile("x.gpx", new ArrayBuffer(16 * 1024 * 1024), {nowMs: 1}); return {a: r, b: r2, c: r3, ms: performance.now() - t}; });
  ck("40. Ficheiro com mais de 15 MB (texto, Uint8Array ou ArrayBuffer): recusado por tamanho, depressa, sem parsear", big.a.code === "toobig" && big.b.code === "toobig" && big.c.code === "toobig" && big.a.error === "Este ficheiro é demasiado grande (máximo 15 MB)." && big.ms < 10000);
  var atLimit = await pg.evaluate(function(){ var head = '<gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>'; var pad = new Array(15 * 1024 * 1024 - head.length - 40).join(" "); return window.RC.runParseGpx(head + pad + "</trkseg></trk></gpx>", {nowMs: 1}).code; });
  ck("41. Exatamente no limite de 15 MB não é recusado por tamanho (o limite é «mais de 15 MB»)", atLimit !== "toobig");

  // ======================= FIT =======================
  var fitHeader = [14, 0x10, 0x4C, 0x08, 0x20, 0x00, 0x00, 0x00, 0x2E, 0x46, 0x49, 0x54, 0xAA, 0xBB];
  var fit = await pg.evaluate(function(h){ var u = new Uint8Array(h.concat([1, 2, 3, 200, 201, 255, 254, 0, 0])); return [window.RC.runParseFile("treino.fit", u, {nowMs: 1}), window.RC.runParseFile("sem-nome", u, {nowMs: 1}), window.RC.runParseFile("sem-nome", u.buffer, {nowMs: 1}), window.RC.runParseFile("sem-nome", new TextDecoder().decode(u), {nowMs: 1}), window.RC.runParseFile("TREINO.FIT", "<gpx/>", {nowMs: 1})]; }, fitHeader);
  ck("42. FIT: recusado com «Ficheiros FIT ainda não são suportados. Exporta em GPX ou TCX.» (por bytes 8–11, por texto decodificado e por extensão .fit)", fit.every(function(r){ return r.ok === false && r.code === "fit" && r.error === "Ficheiros FIT ainda não são suportados. Exporta em GPX ou TCX."; }));
  var rnd = await pg.evaluate(function(){ var u = new Uint8Array(5000), i, s = 12345; for (i = 0; i < u.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; u[i] = s >> 8 & 255; } u[8] = 0x41; return window.RC.runParseFile("x.gpx", u, {nowMs: 1}); });
  ck("43. Bytes aleatórios que não são FIT nem XML: «Não consegui ler este ficheiro»", rnd.ok === false && rnd.code === "unreadable");
  var asBytes = await pg.evaluate(function(a){ var u = new TextEncoder().encode(a.t); return [window.RC.runParseFile("a.gpx", u, {nowMs: a.now}), window.RC.runParseFile("a.gpx", u.buffer, {nowMs: a.now}), window.RC.runParseFile("a.gpx", new Uint8Array(u.buffer, 0, u.length), {nowMs: a.now})]; }, {t: gpxText([straight(4, 10, 5)]), now: NOW});
  ck("44. runParseFile também lê bytes (Uint8Array / ArrayBuffer) em UTF-8", asBytes.every(function(r){ return r.ok && r.points === 4; }));
  var xssName = await file('"><img src=x onerror=alert(1)>.gpx', gpxText([straight(3, 10, 5)]), NOWO), xssFail = await file("<script>alert(1)</script>.gpx", "lixo", NOWO);
  ck("45. O nome do ficheiro nunca aparece no resultado nem nos erros (marcador de XSS no nome)", JSON.stringify(xssName).indexOf("onerror") < 0 && JSON.stringify(xssFail).indexOf("script") < 0 && xssName.ok === true);

  // ======================= tamanho e desempenho =======================
  var perf = await pg.evaluate(function(npts){
    var C = window.RC, lat0 = 38.7, mLat = Math.PI / 180 * 6371008.8, t0 = Date.UTC(2026, 9, 1, 7, 0, 0), parts = ['<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="x" xmlns="http://www.topografix.com/GPX/1/1" xmlns:ns3="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"><trk><trkseg>'], i;
    for (i = 0; i < npts; i++) parts.push('<trkpt lat="' + (lat0 + i * 2.5 / mLat + Math.sin(i / 90) * 2e-4).toFixed(7) + '" lon="' + (-9.1 + Math.cos(i / 130) * 3e-4).toFixed(7) + '"><ele>' + (20 + i % 7) + '</ele><time>' + new Date(t0 + i * 1000).toISOString() + '</time><extensions><ns3:TrackPointExtension><ns3:hr>' + (120 + i % 40) + '</ns3:hr><ns3:cad>85</ns3:cad></ns3:TrackPointExtension></extensions></trkpt>');
    parts.push("</trkseg></trk></gpx>");
    var text = parts.join(""), times = [], r;
    for (i = 0; i < 3; i++) { var t = performance.now(); r = C.runParseGpx(text, {nowMs: Date.UTC(2026, 9, 21)}); times.push(performance.now() - t); }
    var s0 = performance.now(), st = r.ok ? C.runStats(r.segments, null, "import") : null, tStats = performance.now() - s0;
    var p0 = performance.now(), prep = r.ok ? C.runPrepareTrack(r.segments) : null, tPrep = performance.now() - p0;
    return {ok: r.ok, code: r.code, points: r.points, bytes: text.length, times: times, tStats: tStats, tPrep: tPrep, dist: st && st.distM, prepPts: prep && prep.points};
  }, 36000);
  var sortedT = perf.times.slice().sort(function(a, b){ return a - b; });
  console.log("(Chromium headless nesta máquina, NÃO um iPhone) ler 36 000 pontos de GPX (" + (perf.bytes / 1048576).toFixed(1) + " MB): mediana " + Math.round(sortedT[1]) + " ms (3 leituras: " + perf.times.map(Math.round).join(" / ") + " ms); runStats " + Math.round(perf.tStats) + " ms; runPrepareTrack " + Math.round(perf.tPrep) + " ms (" + perf.prepPts + " pontos); distância sintética " + perf.dist + " m");
  ck("46. Ler 36 000 pontos (hora, altitude, FC e cadência no ficheiro): ok, 36 000 pontos, em < 15 s neste Chromium; stats e preparação do percurso também funcionam", perf.ok && perf.points === 36000 && sortedT[1] < 15000 && perf.dist > 80000 && perf.prepPts <= 3000 && perf.prepPts > 50);
  var tooMany = await pg.evaluate(function(now){ var parts = ['<gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>'], i; for (i = 0; i < 60001; i++) parts.push('<trkpt lat="38.7" lon="-9.1"><time>2026-10-01T07:00:00Z</time></trkpt>'); parts.push("</trkseg></trk></gpx>"); var t = performance.now(); var r = window.RC.runParseGpx(parts.join(""), {nowMs: now}); return {code: r.code, error: r.error, ms: performance.now() - t}; }, NOW);
  ck("47. 60 001 pontos (o limite é 60 000): recusado com «pontos a mais (máximo 60 000)»", tooMany.code === "points" && /60 000/.test(tooMany.error));
  var capped = await gpx(gpxText([straight(11, 10, 5)]), {nowMs: NOW, cfg: {maxFilePoints: 10}});
  ck("48. Os limites podem ser mudados por cfg (maxFilePoints: 10 recusa 11 pontos, e a mensagem acompanha)", capped.code === "points" && /máximo 10\)/.test(capped.error));

  // ======================= ida e volta: o GPX gerado volta a ler-se =======================
  var runPts = [], i2;
  for (i2 = 0; i2 < 1800; i2++) runPts.push({lat: LAT0 + (i2 * 2.9) / M_LAT + Math.sin(i2 / 100) * 2e-4, lon: LON0 + Math.cos(i2 / 140) * 3e-4, t: T0 + i2 * 1000, acc: 5});
  var prepared = C.runPrepareTrack([runPts.slice(0, 900), runPts.slice(900)], {trimM: 0});
  var gpxOut = C.runToGpx({startedAtMs: T0}, prepared.segments);
  var back = await file("exportado.gpx", gpxOut, NOWO);
  ck("49. O GPX que a app gera (formato da BD) volta a ler-se: mesmos segmentos, mesmos pontos, coordenadas e horas iguais", back.ok && back.source === "gpx" && back.warnings.length === 0 && back.segments.length === prepared.segments.length && back.segments.every(function(s, i){ return s.length === prepared.segments[i].length && s.every(function(p, j){ var q = prepared.segments[i][j]; return Math.abs(p.lat - q[0]) < 1e-9 && Math.abs(p.lon - q[1]) < 1e-9 && p.t === T0 + q[2] * 1000; }); }) && back.startedAtMs === T0 + prepared.segments[0][0][2] * 1000);
  ck("50. O XML gerado é bem formado para o parser do browser e não leva nome, autor, FC nem metadados", back.ok && !/<(name|author|metadata|desc|extensions|email)\b/.test(gpxOut) && (gpxOut.match(/<trkseg>/g) || []).length === prepared.segments.length);
  var fullGpx = C.runToGpx({startedAtMs: T0}, [runPts.slice(0, 600).map(function(p){ return {lat: p.lat, lon: p.lon, t: p.t + 250}; })]);
  var backFull = await file("completo.gpx", fullGpx, NOWO);
  ck("51. O percurso completo (pontos com t em ms, do ecrã de resumo) também exporta e volta a ler-se, com milésimos", backFull.ok && backFull.points === 600 && backFull.segments[0][0].t === T0 + 250 && Math.abs(backFull.segments[0][599].lat - runPts[599].lat) < 1e-6);
  var fullText = C.runToGpx({startedAtMs: T0}, [runPts.map(function(p){ return {lat: p.lat, lon: p.lon, t: p.t}; })]);
  var stIn = C.runStats([runPts], null, "import"), stBack = await pg.evaluate(function(a){ var r = window.RC.runParseGpx(a.t, {nowMs: a.now}); return window.RC.runStats(r.segments, null, "import"); }, {t: fullText, now: NOW});
  ck("52. Estatísticas antes e depois da ida e volta pelo GPX completo coincidem (distância ±0,2 %, tempos iguais)", Math.abs(stBack.distM / stIn.distM - 1) < 0.002 && stBack.durationS === stIn.durationS && Math.abs(stBack.movingS - stIn.movingS) <= 2 && stBack.splitsS.length === stIn.splitsS.length);

  // ======================= fluxo completo no browser: ficheiro → stats → percurso → linha da BD =======================
  var flow = await pg.evaluate(function(a){
    var C = window.RC, r = C.runParseFile("treino.gpx", a.text, {nowMs: a.now});
    if (!r.ok) return {error: r.error};
    var st = C.runStats(r.segments, null, "import"), prep = C.runPrepareTrack(r.segments, {trimM: 200});
    var row = C.runBuildInsert({id: C.runUuid(), studentId: "ana", source: r.source, startedAtMs: st.startedAtMs, durationS: st.durationS, movingS: st.movingS, distM: st.distM, gaps: st.gaps, gapS: st.gapS, splitsS: st.splitsS, rpe: 6, notes: "ok", consentV: 1}, a.now);
    var svg = prep ? C.runTrackSvg(prep.segments) : "";
    var wrap = document.createElement("div"); wrap.innerHTML = svg; var el = wrap.firstChild;
    return {st: st, prep: prep && {points: prep.points, trimM: prep.trimM}, row: row, svgOk: !!el && el.tagName.toLowerCase() === "svg" && el.getAttribute("role") === "img" && el.querySelectorAll("polyline").length >= 1, pace: C.runPaceStr(C.runPaceOf(st.distM, st.movingS)), dist: C.runDistStr(st.distM), dur: C.runDurStr(st.durationS), dup: C.runDupCheck([C.runNormalizeRow(row)], {startedAtMs: st.startedAtMs + 20000, distM: st.distM})};
  }, {text: fullText, now: NOW});
  ck("53. Fluxo completo no browser (ler → runStats → runPrepareTrack → runBuildInsert → SVG → duplicado): tudo coerente e o SVG é aceite pelo parser de HTML", !flow.error && flow.st.distM > 4000 && flow.prep && flow.prep.points > 10 && flow.row && flow.row.distance_m === flow.st.distM && flow.row.source === "gpx" && flow.svgOk && /^\d+:\d\d$/.test(flow.pace) && /^\d+,\d\d km$/.test(flow.dist) && /^\d+:\d\d$/.test(flow.dur) && !!flow.dup);

  ck("54. Nenhum erro de JavaScript na página e nenhum pedido de rede em todo o teste", errors.length === 0 && evilHits === 0 && requests.every(function(u){ return /^(about:|data:)/.test(u); }));
  await browser.close(); evil.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", (e && e.stack || String(e)).split("\n").slice(0, 4).join(" | ")); process.exit(1); });
