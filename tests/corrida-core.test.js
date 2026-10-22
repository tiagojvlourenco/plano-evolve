// Corrida, núcleo puro (corrida-core.js): contas, privacidade do percurso, limites do SQL, formatação PT-PT.
// Corre em Node, sem browser (a leitura de GPX/TCX e o GPX gerado lido de volta estão em tests/corrida-import-browser.test.js).
// TUDO o que aqui se mede usa séries SINTÉTICAS (ruído gaussiano com semente fixa): mostra a direção dos efeitos e que a aritmética está certa,
// NÃO mede o erro de um GPS real nem calibra os valores de RUN_CFG (são hipóteses do desenho, a calibrar com um percurso de distância conhecida).
var fs = require("fs"), path = require("path");
var check = require("./check")();
var root = path.join(__dirname, "..");
var coreFile = path.join(root, "corrida-core.js");
var code = fs.readFileSync(coreFile, "utf8");
var n = 0;
function ck(desc, cond){ n++; if (parseInt(desc, 10) !== n) console.log("AVISO: verificação numerada " + parseInt(desc, 10) + " na posição " + n); check.check(desc, !!cond); }

// ---- carregamento: eval direto em modo estrito, como em app.js (as declarações ficam no eval, por isso exporta-se no fim dele) ----
var topNames = [], m, re = /^(?:function\s+(\w+)|var\s+(\w+))/gm;
while ((m = re.exec(code))) topNames.push(m[1] || m[2]);
var C = (function(){ "use strict"; return eval(code + "\n;({" + topNames.map(function(x){ return x + ": " + x; }).join(", ") + "})"); })();
var T0 = Date.UTC(2026, 9, 1, 7, 0, 0), NOW = Date.UTC(2026, 9, 21, 12, 0, 0);

// ---- auxiliares sintéticos ----
function rng(seed){ return function(){ seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gauss(r){ var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
var LAT0 = 38.7, LON0 = -9.1, M_LAT = Math.PI / 180 * 6371008.8, M_LON = M_LAT * Math.cos(LAT0 * Math.PI / 180);
// fix de uma reta para norte a v m/s, ruído sigma (m) em cada eixo, 1 Hz, instante i
function lineFix(i, v, sigma, r, acc, t0){ return {lat: LAT0 + v * i / M_LAT + (sigma ? gauss(r) * sigma / M_LAT : 0), lon: LON0 + (sigma ? gauss(r) * sigma / M_LON : 0), acc: acc == null ? 5 : acc, t: (t0 == null ? T0 : t0) + i * 1000}; }
function feedLine(n, v, sigma, seed, acc){
  var r = rng(seed), st = C.runFeedInit(), simple = 0, prev = null, i;
  for (i = 0; i < n; i++) {
    var f = lineFix(i, v, sigma, r, acc);
    if (prev) simple += C.runHav(prev.lat, prev.lon, f.lat, f.lon);
    prev = f;
    C.runFeed(st, f);
  }
  return {st: st, simple: simple, truth: v * (n - 1)};
}
function pt(lat, lon, t){ return {lat: lat, lon: lon, t: t, acc: null}; }
function northPt(meters, tSec){ return pt(LAT0 + meters / M_LAT, LON0, T0 + tSec * 1000); }
function eachPt(segs, f){ segs.forEach(function(s){ s.forEach(f); }); }

// ================================================================ contrato e ficheiro ================================================================
ck("1. O núcleo avalia-se em modo estrito e exporta as funções do contrato", ["runHav", "runFeedInit", "runFeed", "runPause", "runResume", "runStats", "runTrim", "runSimplify", "runPrepareTrack", "runToGpx", "runParseGpx", "runParseTcx", "runParseFile", "runNormalizeRow", "runBuildInsert", "runDupCheck", "runPaceStr", "runDurStr", "runDistStr", "runPaceOf", "runTrackSvg"].every(function(k){ return typeof C[k] === "function"; }) && typeof C.RUN_CFG === "object");
ck("2. Todos os nomes de topo levam o prefixo run / RUN_ (e nenhum chama RUN: já existe em app.js)", topNames.length > 40 && topNames.every(function(x){ return /^(run[A-Z]|RUN_)/.test(x); }));
var others = [fs.readFileSync(path.join(root, "app.js"), "utf8"), fs.readFileSync(path.join(root, "gestao.js"), "utf8")];
var clash = topNames.filter(function(x){ return others.some(function(src){ return new RegExp("(?:function\\s+|\\b(?:var|let|const)\\s+)" + x + "\\b").test(src); }); });
ck("3. Nenhum nome de topo repete um nome declarado em app.js ou gestao.js" + (clash.length ? " (repetidos: " + clash.join(", ") + ")" : ""), clash.length === 0);
ck("4. Não menciona o diagnóstico de GPS antigo", !/gps-teste/i.test(code));
ck("5. Sem rede, sem armazenamento e sem DOM (fora do DOMParser), e sem usar o objeto RUN de app.js (o núcleo não depende dele)", !/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|importScripts|localStorage|sessionStorage|indexedDB|navigator|document|window)\b|\bRUN\b/.test(code.replace(/\/\*[\s\S]*?\*\//, "")) && /\bDOMParser\b/.test(code));
ck("6. Só ES5 (sem arrow, let, const, async, await, template strings, classes)", !/=>|`|\b(let|const|async|await|class)\s/.test(code.replace(/\/\*[\s\S]*?\*\//, "")) && !/^\s*"use strict"/m.test(code));
var apiBlock = code.slice(0, code.indexOf("*/"));
var publicFns = topNames.filter(function(x){ return /^run[A-Z]/.test(x) && !/^runI[A-Z]/.test(x); });
var undocumented = publicFns.filter(function(x){ return apiBlock.indexOf(x) < 0; });
ck("7. O bloco «API» do topo documenta todas as funções públicas" + (undocumented.length ? " (falta: " + undocumented.join(", ") + ")" : ""), undocumented.length === 0 && /RUN_CFG/.test(apiBlock) && /NÃO verificado/.test(apiBlock));
var both = (function(){ "use strict"; return eval(code + "\n//# sourceURL=corrida-core.js\n" + "var runPaceCheck = runPaceStr(330), runDup = typeof RUN_CFG;\n[runPaceCheck, runDup]"); })();
ck("8. Avaliado em conjunto com código seguinte (como em loadCorrida), as declarações ficam visíveis", both[0] === "5:30" && both[1] === "object");
var noDom = C.runParseGpx("<gpx/>");
ck("9. Sem DOMParser (Node) os leitores devolvem um erro claro em vez de lançar", noDom.ok === false && noDom.code === "noparser" && /^Este navegador/.test(noDom.error) && C.runParseFile("a.gpx", "<gpx/>").ok === false);
var cfg = C.RUN_CFG;
ck("10. RUN_CFG tem os valores iniciais do desenho (hipóteses)", cfg.accMaxM === 30 && cfg.gapS === 15 && cfg.minStepLiveM === 15 && cfg.minStepImportM === 8 && cfg.vMaxMs === 12 && cfg.vMoveMin === 0.5 && cfg.importGapS === 60 && cfg.trimM === 200 && cfg.simplifyEps.join() === "4,8,15" && cfg.maxTrackPoints === 3000 && cfg.maxSegments === 200 && cfg.maxFilePoints === 60000 && cfg.maxFileBytes === 15 * 1024 * 1024 && cfg.maxDurationS === 86400);
ck("11. runCfg junta um cfg parcial a RUN_CFG sem alterar RUN_CFG", (function(){ var c = C.runCfg({trimM: 500}); return c.trimM === 500 && c.gapS === 15 && cfg.trimM === 200 && C.runCfg() === cfg && C.runCfg(undefined) === cfg; })());

// ================================================================ haversine ================================================================
var DEG = Math.PI / 180 * 6371008.8;
ck("12. Haversine: 1 grau de longitude no equador ≈ 111 195 m", Math.abs(C.runHav(0, 0, 0, 1) - 111195) < 1 && Math.abs(C.runHav(0, 0, 0, 1) - DEG) < 1e-6);
ck("13. Haversine: 5 passos de 0,0001 grau ≈ 55 m", (function(){ var s = 0, i; for (i = 0; i < 5; i++) s += C.runHav(0, i * 0.0001, 0, (i + 1) * 0.0001); return Math.abs(s - 55.6) < 0.2; })());
ck("14. Haversine: 1 grau de latitude vale o mesmo em qualquer latitude; é simétrica; zero para o mesmo ponto", Math.abs(C.runHav(38, -9, 39, -9) - DEG) < 1e-6 && Math.abs(C.runHav(-60, 20, -59, 20) - DEG) < 1e-6 && C.runHav(38.7, -9.1, 38.8, -9.2) === C.runHav(38.8, -9.2, 38.7, -9.1) && C.runHav(38.7, -9.1, 38.7, -9.1) === 0);
ck("15. Haversine: pontos opostos dão meia circunferência e o grau de longitude encolhe com cos(lat)", Math.abs(C.runHav(0, 0, 0, 180) - Math.PI * 6371008.8) < 1 && Math.abs(C.runHav(60, 0, 60, 1) - DEG * 0.5) < 30);

// ================================================================ reducer ao vivo ================================================================
var still = (function(){ var r = rng(11), st = C.runFeedInit(), i; for (i = 0; i < 300; i++) C.runFeed(st, lineFix(0 + 0, 0, 3, r, 6, T0 + i * 1000 - 0)); return st; })();
ck("16. Parado 5 min com ruído de 3 m: não soma distância (sintético)", still.distM < 1 && still.nPts <= 2 && still.splitsS.length === 0);
var clean = feedLine(1501, 3, 0, 1, 5);
ck("17. Reta de 4,5 km sem ruído a 3 m/s: a distância fica a menos de 0,5 % (sintético)", Math.abs(clean.st.distM / clean.truth - 1) < 0.005);
var n15 = feedLine(3001, 3, 1.5, 7, 5), n3 = feedLine(3001, 3, 3, 7, 5);
var e15 = n15.st.distM / n15.truth - 1, e3 = n3.st.distM / n3.truth - 1, s15 = n15.simple / n15.truth - 1, s3 = n3.simple / n3.truth - 1;
console.log("(sintético, 9 km a 3 m/s, 1 Hz, ruído branco) σ 1,5 m: âncora " + (e15 * 100).toFixed(1) + " % vs soma simples " + (s15 * 100).toFixed(1) + " %; σ 3 m: âncora " + (e3 * 100).toFixed(1) + " % vs soma simples " + (s3 * 100).toFixed(1) + " %");
ck("18. Âncora vs soma ponto a ponto: o erro da âncora é bem menor (σ 1,5 m e σ 3 m)", Math.abs(e15) < Math.abs(s15) / 5 && Math.abs(e3) < Math.abs(s3) / 5);
ck("19. A soma simples sobrestima muito com ruído (a razão de ser da âncora); a âncora fica em poucos % no sintético", s15 > 0.15 && s3 > 0.5 && Math.abs(e15) < 0.03 && Math.abs(e3) < 0.08);
var circ = (function(){ // volta a um círculo de raio 60 m a 3 m/s, sem ruído: a âncora corta um pouco as curvas
  var st = C.runFeedInit(), R = 60, w = 3 / R, i, tot = 0;
  for (i = 0; i < 400; i++) C.runFeed(st, {lat: LAT0 + R * Math.sin(w * i) / M_LAT, lon: LON0 + R * (1 - Math.cos(w * i)) / M_LON, acc: 5, t: T0 + i * 1000});
  return {st: st, truth: 3 * 399};
})();
ck("20. Curvas de raio 60 m sem ruído: a âncora subestima pouco (entre -3 % e 0 %) (sintético)", circ.st.distM / circ.truth - 1 < 0 && circ.st.distM / circ.truth - 1 > -0.03);
// lacuna
var gapRun = (function(){
  var st = C.runFeedInit(), i, rs = [], r = rng(3);
  for (i = 0; i < 60; i++) rs.push(C.runFeed(st, lineFix(i, 3, 0, r, 5)));
  var distBefore = st.distM;
  for (i = 360; i < 420; i++) rs.push(C.runFeed(st, lineFix(i, 3, 0, r, 5)));   // 5 min sem nenhum fix (a corrida continua 1 km mais à frente)
  return {st: st, rs: rs, distBefore: distBefore};
})();
ck("21. Lacuna de 5 min: fecha o segmento, abre outro, gaps=1 e gapS ≈ 300", gapRun.st.segs.length === 2 && gapRun.st.gaps === 1 && Math.abs(gapRun.st.gapMs / 1000 - 301) <= 2 && gapRun.rs.filter(function(x){ return x.gap; }).length === 1 && gapRun.st.segs[1][0].b === "gap" && Math.abs(gapRun.st.segs[1][0].g - 301) <= 1);
var gapSegsDist = (function(){ var a = 0, i, segs = gapRun.st.segs; segs.forEach(function(s){ for (i = 1; i < s.length; i++) a += C.runHav(s[i - 1].lat, s[i - 1].lon, s[i].lat, s[i].lon); }); return a; })();
ck("22. Nunca se soma a linha reta através da lacuna (1 km em linha reta ficaria de fora)", gapRun.st.distM < 400 && Math.abs(gapRun.st.distM - gapSegsDist) < 60);
var gapStats = C.runStats(gapRun.st.segs, null, "live");
ck("23. runStats em live conta a lacuna no tempo total mas não no tempo em movimento", gapStats.gaps === 1 && Math.abs(gapStats.gapS - 301) <= 2 && gapStats.durationS >= 405 && gapStats.durationS <= 420 && gapStats.movingS >= 100 && gapStats.movingS <= 125 && gapStats.distM === Math.round(gapRun.st.distM));
// pausa
var pauseRun = (function(){
  var st = C.runFeedInit(), i, r = rng(4), rs = [];
  for (i = 0; i < 30; i++) C.runFeed(st, lineFix(i, 3, 0, r, 5));
  C.runPause(st, T0 + 30000);
  for (i = 30; i < 150; i++) rs.push(C.runFeed(st, lineFix(i, 3, 0, r, 5)));      // fixes durante a pausa (2 min): ignorados
  C.runResume(st, T0 + 150000);
  for (i = 150; i < 180; i++) C.runFeed(st, lineFix(i, 3, 0, r, 5));
  return {st: st, rs: rs};
})();
ck("24. Pausa: os fixes durante a pausa são ignorados com o motivo «paused»", pauseRun.rs.length === 120 && pauseRun.rs.every(function(x){ return x.reason === "paused" && !x.added; }));
ck("25. Pausa: fecha o segmento, não é lacuna, o 1.º ponto seguinte traz b:\"pause\"", pauseRun.st.segs.length === 2 && pauseRun.st.gaps === 0 && pauseRun.st.segs[1][0].b === "pause" && pauseRun.st.segs[1][0].g === undefined && pauseRun.st.segs[0][0].b === undefined);
ck("26. Pausa: o tempo parado não conta (cronómetro e duração total), a distância não atravessa a pausa", (function(){
  var v = C.runLiveView(pauseRun.st, T0 + 180000), s = C.runStats(pauseRun.st.segs, null, "live");
  return v.elapsedS === 60 && pauseRun.st.pausedMs === 120000 && s.durationS >= 40 && s.durationS <= 60 && s.gaps === 0 && s.gapS === 0 && s.distM > 100 && s.distM < 180;
})());
ck("27. Durante uma pausa o cronómetro congela", (function(){ var st = C.runFeedInit(), i, r = rng(5); for (i = 0; i < 20; i++) C.runFeed(st, lineFix(i, 3, 0, r, 5)); C.runPause(st, T0 + 20000); return C.runLiveView(st, T0 + 50000).elapsedS === 20 && C.runLiveView(st, T0 + 90000).elapsedS === 20 && C.runLiveView(st, T0 + 90000).paused === true; })());
// salto, tempo, precisão, inválidos
var jumpRun = (function(){
  var st = C.runFeedInit(), i, r = rng(6), rs = [];
  for (i = 0; i < 20; i++) C.runFeed(st, lineFix(i, 3, 0, r, 5));
  var d0 = st.distM, bad = lineFix(20, 3, 0, r, 5); bad.lat += 1000 / M_LAT;
  rs.push(C.runFeed(st, bad));
  rs.push(C.runFeed(st, lineFix(21, 3, 0, r, 5)));
  return {st: st, rs: rs, d0: d0};
})();
ck("28. Salto de 1 km num segundo: rejeitado («jump»), contado, e o fix seguinte entra normalmente", jumpRun.rs[0].reason === "jump" && !jumpRun.rs[0].added && jumpRun.st.rej.jump === 1 && jumpRun.rs[1].good && jumpRun.st.distM < 80);
var tRun = (function(){
  var st = C.runFeedInit(), r = rng(7), a = C.runFeed(st, lineFix(0, 3, 0, r, 5)), b = C.runFeed(st, lineFix(1, 3, 0, r, 5)), same = C.runFeed(st, lineFix(1, 3, 0, r, 5)), back = C.runFeed(st, lineFix(0, 3, 0, r, 5));
  return {st: st, same: same, back: back, a: a};
})();
ck("29. Tempo que não cresce (igual ou a recuar) é rejeitado com «time»", tRun.same.reason === "time" && tRun.back.reason === "time" && tRun.st.rej.time === 2 && tRun.st.maxT === T0 + 1000);
ck("30. Precisão a 100 m, a null ou negativa: «acc»; exatamente 30 m passa", (function(){
  var st = C.runFeedInit(), r = rng(8), x = C.runFeed(st, lineFix(0, 3, 0, r, 100)), y = C.runFeed(st, {lat: LAT0, lon: LON0, acc: null, t: T0 + 1000}), z = C.runFeed(st, {lat: LAT0, lon: LON0, acc: -1, t: T0 + 2000}), ok = C.runFeed(st, {lat: LAT0, lon: LON0, acc: 30, t: T0 + 3000});
  return x.reason === "acc" && y.reason === "acc" && z.reason === "acc" && ok.reason === "ok" && st.rej.acc === 3;
})());
ck("31. Fixes inválidos (NaN, fora de intervalo, sem tempo, nulo) não lançam e dão «invalid»", (function(){
  var st = C.runFeedInit();
  var bads = [null, {}, {lat: NaN, lon: 1, acc: 5, t: T0}, {lat: 91, lon: 1, acc: 5, t: T0}, {lat: 1, lon: 181, acc: 5, t: T0}, {lat: 1, lon: 1, acc: 5}, {lat: "38", lon: "-9", acc: 5, t: T0}, {lat: 1, lon: 1, acc: 5, t: 0}];
  return bads.every(function(f){ return C.runFeed(st, f).reason === "invalid"; }) && st.rej.invalid === bads.length && st.segs.length === 0;
})());
ck("32. O 1.º fix aceite define o início (startedAtMs = o seu t) e abre o 1.º segmento sem marca de quebra", (function(){ var st = C.runFeedInit(), r = C.runFeed(st, {lat: LAT0, lon: LON0, acc: 8, t: T0 + 777}); return r.reason === "ok" && r.added && st.startedAtMs === T0 + 777 && st.segs.length === 1 && st.segs[0][0].b === undefined && !r.gap; })());
ck("33. Um fix a menos de 15 m da âncora é «near»: sinal bom, mas não é ponto e não soma", (function(){ var st = C.runFeedInit(); C.runFeed(st, {lat: LAT0, lon: LON0, acc: 5, t: T0}); var r = C.runFeed(st, {lat: LAT0 + 5 / M_LAT, lon: LON0, acc: 5, t: T0 + 1000}); return r.reason === "near" && r.good && !r.added && st.nPts === 1 && st.distM === 0 && st.lastGoodT === T0 + 1000; })());
// parciais
var splitRun = feedLine(1100, 3, 0, 1, 5);
ck("34. Parciais ao vivo: reta a 3 m/s dá km de ≈333 s (3 km completos em 1100 s, o 4.º incompleto fica de fora)", splitRun.st.splitsS.length === 3 && splitRun.st.splitsS.every(function(s){ return Math.abs(s - 333) <= 6; }));
var interp = [[]]; (function(){ var i; for (i = 0; i <= 11; i++) interp[0].push(northPt(i * 240, i * 60)); })();   // passos de 240 m em 60 s (4 m/s): os km cruzam-se a 1/6 e a 5/6 de um passo
var iStats = C.runStats(interp, null, "import");
ck("35. Parciais interpolados: passos de 240 m a 4 m/s cruzam os km dentro do passo e dão 250 s cada", iStats.splitsS.join() === "250,250" && iStats.distM === 2640 && iStats.movingS === 660 && iStats.durationS === 660 && iStats.gaps === 0);
ck("36. runStats em live repete o acumulado do reducer (distância, movimento, lacunas, parciais) em séries com ruído, lacunas e pausas", (function(){
  var ok = true, seed;
  for (seed = 20; seed < 28; seed++) {
    var r = rng(seed), st = C.runFeedInit(), i, t = 0;
    for (i = 0; i < 1500; i++) {
      if (i === 400) C.runPause(st, T0 + t * 1000);
      if (i === 450) { t += 45; C.runResume(st, T0 + t * 1000); }
      if (i === 900) t += 40;   // lacuna de 40 s
      var f = lineFix(t, 3.2, 2.5, r, 4 + 20 * r());
      t++;
      C.runFeed(st, f);
    }
    var s = C.runStats(st.segs, null, "live");
    ok = ok && s.distM === Math.round(st.distM) && s.gaps === st.gaps && Math.abs(s.gapS - Math.round(st.gapMs / 1000)) <= 0 && s.splitsS.join() === st.splitsS.join() && s.movingS === Math.round(st.movMs / 1000) && s.points === st.nPts && s.skipped === 0 && s.gaps >= 1;
  }
  return ok;
})());
ck("37. Rascunho: o state vai a JSON e volta (runFeedRestore) com os mesmos totais, e o fix seguinte abre uma lacuna marcada", (function(){
  var r = rng(30), st = C.runFeedInit(), i;
  for (i = 0; i < 500; i++) C.runFeed(st, lineFix(i, 3, 2, r, 6));
  var back = C.runFeedRestore(JSON.parse(JSON.stringify(st)));
  var same = back && back.distM === st.distM && back.nPts === st.nPts && back.splitsS.join() === st.splitsS.join() && back.startedAtMs === st.startedAtMs && back.segs.length === 1 && back.open === false;
  var res = C.runFeed(back, lineFix(520, 3, 2, r, 6));
  return same && res.added && res.gap && back.segs.length === 2 && back.segs[1][0].b === "gap" && back.gaps === 1 && back.segs[1][0].g >= 20 && back.segs[1][0].g <= 30;
})());
ck("38. Restaurar: lixo e tempos desordenados não lançam; sem segs devolve null; pausa guardada mantém-se pausada", (function(){
  var junk = C.runFeedRestore({segs: [[{lat: "x", lon: 1, t: 5}, {lat: 1, lon: 1, t: T0 + 5}, {lat: 1, lon: 1, t: T0}], 7, null]});
  var paused = C.runFeedRestore({segs: [[{lat: 38, lon: -9, t: T0, acc: 5}]], paused: true, pauseAt: T0 + 5, pausedMs: 1000});
  return C.runFeedRestore(null) === null && C.runFeedRestore({}) === null && junk && junk.segs.length === 1 && junk.segs[0].length === 1 && paused.paused && paused.brk === "pause" && paused.pausedMs === 1000 && C.runFeed(paused, {lat: 38, lon: -9, acc: 5, t: T0 + 9000}).reason === "paused";
})());
ck("39. runLiveView devolve números arredondados, o ritmo em movimento e há quanto tempo não há sinal bom", (function(){
  var s = feedLine(601, 3, 0, 1, 5), v = C.runLiveView(s.st, T0 + 605000);
  return v.distM === Math.round(s.st.distM) && Math.abs(v.paceSPerKm - 333) < 8 && v.sinceGoodS === 5 && v.elapsedS === 605 && v.points === s.st.nPts && Array.isArray(v.splitsS) && v.rej.acc === 0;
})());
ck("40. Os motivos têm texto PT-PT curto para o ecrã", C.runReasonText("acc") === "Sinal fraco" && /salto/.test(C.runReasonText("jump")) && C.runReasonText("ok") === "");

// ================================================================ runStats (qualquer fonte) ================================================================
ck("41. runStats em importação: 3,1 km a 3,33 m/s em 1 Hz dão ≈3100 m, 930 s e 3 parciais de ≈300 s", (function(){
  var seg = [], i; for (i = 0; i <= 930; i++) seg.push(northPt(i * 10 / 3, i));
  var s = C.runStats([seg], null, "import");
  return Math.abs(s.distM - 3100) <= 10 && s.durationS === 930 && s.movingS >= 925 && s.movingS <= 930 && s.splitsS.length === 3 && s.splitsS.every(function(x){ return Math.abs(x - 300) <= 3; }) && s.gaps === 0 && s.startedAtMs === T0 && s.endedAtMs === T0 + 930000;
})());
ck("42. Importação: parado a meio (ruído < 8 m) não conta como movimento, mas conta no tempo total", (function(){
  var seg = [], i;
  for (i = 0; i <= 100; i++) seg.push(northPt(i * 3, i));                 // 100 s a 3 m/s
  for (i = 101; i <= 200; i++) seg.push(northPt(300 + (i % 3), i));      // 100 s parado
  for (i = 201; i <= 300; i++) seg.push(northPt(300 + (i - 200) * 3, i));  // 100 s a 3 m/s
  var s = C.runStats([seg], null, "import");
  return s.durationS === 300 && s.movingS >= 185 && s.movingS <= 205 && Math.abs(s.distM - 600) <= 15;
})());
ck("43. Importação: intervalo > 60 s dentro do segmento é lacuna (conta no tempo, não na distância)", (function(){
  var seg = [], i;
  for (i = 0; i <= 60; i++) seg.push(northPt(i * 3, i));
  for (i = 0; i <= 60; i++) seg.push(northPt(180 + 250 + i * 3, 160 + i));   // 100 s depois e 250 m à frente (2,5 m/s: possível)
  var s = C.runStats([seg], null, "import");
  return s.gaps === 1 && s.gapS === 100 && s.durationS === 220 && Math.abs(s.distM - 360) <= 20 && s.movingS <= 125;
})());
ck("44. Importação: a quebra ENTRE segmentos é pausa do relógio — não é lacuna e não conta no tempo", (function(){
  var a = [], b = [], i;
  for (i = 0; i <= 60; i++) a.push(northPt(i * 3, i));
  for (i = 0; i <= 60; i++) b.push(northPt(180 + 40 + i * 3, 400 + i));   // pausa de 340 s
  var s = C.runStats([a, b], null, "import");
  return s.gaps === 0 && s.gapS === 0 && s.durationS === 120 && s.endedAtMs - s.startedAtMs === 460000 && Math.abs(s.distM - 360) <= 20;
})());
ck("45. Importação: um salto de GPS (>12 m/s) é ignorado e contado em skipped", (function(){
  var seg = [], i;
  for (i = 0; i <= 120; i++) seg.push(northPt(i * 3, i));
  seg[60] = pt(LAT0 + 2000 / M_LAT, LON0, seg[60].t);
  var s = C.runStats([seg], null, "import");
  return s.skipped === 1 && Math.abs(s.distM - 360) <= 15;
})());
ck("46. Ficheiro de 1 ponto, segmentos vazios, nada: zeros sem lançar; movingS nunca passa durationS", (function(){
  var one = C.runStats([[northPt(0, 0)]], null, "import"), none = C.runStats([[], []], null, "import"), junk = C.runStats(null), bad = C.runStats([[{lat: NaN, lon: 1, t: T0}, null, northPt(0, 0)]], null, "import");
  return one.distM === 0 && one.durationS === 0 && one.startedAtMs === T0 && none.points === 0 && none.startedAtMs === null && junk.distM === 0 && bad.skipped === 2 && one.movingS <= one.durationS;
})());
ck("47. Pontos com tempo repetido ou a recuar dentro de runStats são ignorados, sem apagar o resto", (function(){
  var seg = [northPt(0, 0), northPt(10, 5), northPt(20, 5), northPt(30, 3), northPt(40, 10)];
  var s = C.runStats([seg], null, "import");
  return s.skipped === 2 && s.distM === 40 && s.durationS === 10;
})());
ck("48. runManualStats: tempo em movimento = tempo, sem lacunas nem parciais", (function(){ var s = C.runManualStats(T0, 5234.4, 1800); return s.distM === 5234 && s.durationS === 1800 && s.movingS === 1800 && s.gaps === 0 && s.splitsS.length === 0 && s.endedAtMs === T0 + 1800000; })());

// ================================================================ privacidade do percurso ================================================================
function lineTrack(meters, step){ var seg = [], i; for (i = 0; i <= meters / step; i++) seg.push(northPt(i * step, i * step / 3)); return [seg]; }
var long2k = lineTrack(2000, 3), trimmed = C.runTrim(long2k, 200);
var first = long2k[0][0], last = long2k[0][long2k[0].length - 1];
ck("49. runTrim numa reta de 2 km: remove ≈200 m de cada ponta; nada fica a menos de 200 m do início nem do fim", trimmed.length === 1 && trimmed[0].length > 0 && trimmed[0].every(function(p){ return C.runHav(p.lat, p.lon, first.lat, first.lon) >= 200 && C.runHav(p.lat, p.lon, last.lat, last.lon) >= 200; }) && Math.abs(C.runHav(trimmed[0][0].lat, trimmed[0][0].lon, first.lat, first.lon) - 200) <= 3 && Math.abs(trimmed[0].length * 3 - 1600) <= 8);
ck("50. runTrim não altera a entrada e R=0 (ou inválido) devolve tudo", (function(){ var before = JSON.stringify(long2k), z = C.runTrim(long2k, 0), nan = C.runTrim(long2k, NaN), neg = C.runTrim(long2k, -5); return JSON.stringify(long2k) === before && z[0].length === long2k[0].length && nan[0].length === long2k[0].length && neg[0].length === long2k[0].length && z[0] !== long2k[0]; })());
var loop = (function(){ // laço de ≈2,8 km (raio 440 m): a chegada fica ao lado da partida
  var seg = [], R = 440, i, N = 350;
  for (i = 0; i <= N; i++) { var a = i / N * 2 * Math.PI; seg.push(pt(LAT0 + R * Math.sin(a) / M_LAT, LON0 + R * (1 - Math.cos(a)) / M_LON, T0 + i * 8000)); }
  return [seg];
})();
var loopTrim = C.runTrim(loop, 200), lf = loop[0][0], ll = loop[0][loop[0].length - 1];
ck("51. runTrim num laço (partida = chegada): tira as duas pontas e sobra o meio, todo a ≥200 m da partida", loopTrim.length === 1 && loopTrim[0].length > 150 && loopTrim[0].length < 350 && loopTrim[0].every(function(p){ return C.runHav(p.lat, p.lon, lf.lat, lf.lon) >= 200 && C.runHav(p.lat, p.lon, ll.lat, ll.lon) >= 200; }));
ck("52. runTrim: se o percurso passa perto da partida a meio, esses pontos também saem e o segmento parte-se", (function(){
  var seg = [], i;
  for (i = 0; i <= 400; i++) seg.push(northPt(i * 3, i));                    // ida: 1,2 km
  for (i = 1; i <= 400; i++) seg.push(northPt(1200 - i * 3, 400 + i));      // volta até à partida
  for (i = 1; i <= 400; i++) seg.push(northPt(i * 3, 800 + i));             // e outra vez para norte
  var out = C.runTrim([seg], 200), f = seg[0], l = seg[seg.length - 1];
  return out.length >= 2 && out.every(function(s){ return s.every(function(p){ return C.runHav(p.lat, p.lon, f.lat, f.lon) >= 200 && C.runHav(p.lat, p.lon, l.lat, l.lon) >= 200; }); });
})());
ck("53. Corrida mais curta que o aparo (150 m) não deixa percurso: runTrim vazio e runPrepareTrack null", C.runTrim(lineTrack(150, 3), 200).length === 0 && C.runPrepareTrack(lineTrack(150, 3)) === null && C.runPrepareTrack(lineTrack(350, 3)) === null);
ck("54. runTrim em segmentos vários: a partida é o 1.º ponto do 1.º segmento e a chegada o último do último", (function(){
  var a = lineTrack(600, 3)[0], b = a.map(function(p, i){ return northPt(700 + i * 3, 400 + i); });
  var out = C.runTrim([a, b], 200), f = a[0], l = b[b.length - 1];
  return out.length === 2 && out[0][0] !== a[0] && out.every(function(s){ return s.every(function(p){ return C.runHav(p.lat, p.lon, f.lat, f.lon) >= 200 && C.runHav(p.lat, p.lon, l.lat, l.lon) >= 200; }); });
})());
// simplify
var noisyLine = (function(){ var r = rng(40), a = [], i; for (i = 0; i < 2000; i++) a.push(pt(LAT0 + i * 1.5 / M_LAT + gauss(r) * 0.8 / M_LAT, LON0 + gauss(r) * 0.8 / M_LON, T0 + i * 1000)); return a; })();
var simp = C.runSimplify(noisyLine, 4);
ck("55. runSimplify: reduz muito uma reta com ruído e mantém o 1.º e o último ponto", simp.length < 20 && simp[0] === noisyLine[0] && simp[simp.length - 1] === noisyLine[noisyLine.length - 1]);
function planar(p, c, lat0){ return [p.lon * c * DEG, p.lat * DEG]; }
function maxDevFromPolyline(orig, simp){
  var lat0 = orig.reduce(function(a, p){ return a + p.lat; }, 0) / orig.length, c = Math.cos(lat0 * Math.PI / 180), worst = 0;
  var S = simp.map(function(p){ return planar(p, c); });
  orig.forEach(function(p){
    var q = planar(p, c), best = Infinity, i;
    for (i = 0; i + 1 < S.length; i++) {
      var dx = S[i + 1][0] - S[i][0], dy = S[i + 1][1] - S[i][1], l2 = dx * dx + dy * dy, t = l2 ? ((q[0] - S[i][0]) * dx + (q[1] - S[i][1]) * dy) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      var ex = S[i][0] + t * dx - q[0], ey = S[i][1] + t * dy - q[1];
      best = Math.min(best, Math.sqrt(ex * ex + ey * ey));
    }
    worst = Math.max(worst, best);
  });
  return worst;
}
var curvy = (function(){ var r = rng(41), a = [], i; for (i = 0; i < 1500; i++) { var th = i / 60; a.push(pt(LAT0 + (80 * Math.sin(th) + gauss(r)) / M_LAT, LON0 + (80 * Math.cos(th * 0.7) + gauss(r)) / M_LON, T0 + i * 1000)); } return a; })();
ck("56. runSimplify: nenhum ponto original fica a mais de eps do resultado (eps 4, 8 e 15 em curvas com ruído)", [4, 8, 15].every(function(e){ var s = C.runSimplify(curvy, e); return s.length < curvy.length && maxDevFromPolyline(curvy, s) <= e + 0.05; }) && C.runSimplify(curvy, 15).length < C.runSimplify(curvy, 4).length);
ck("57. runSimplify iterativo: 200 000 pontos não rebentam a pilha e terminam depressa (sem recursão)", (function(){
  var a = [], i, t = Date.now(); for (i = 0; i < 200000; i++) a.push([LAT0 + i * 1e-6, LON0 + Math.sin(i / 50) * 1e-4]);
  var s = C.runSimplify(a, 4);
  return s.length > 2 && s.length < a.length && s[0] === a[0] && s[s.length - 1] === a[a.length - 1] && Date.now() - t < 5000;
})());
ck("58. runSimplify: 0, 1, 2 pontos, eps inválido e laço fechado (1.º = último) não lançam e mantêm o essencial", (function(){
  var ring = []; var i; for (i = 0; i <= 60; i++) ring.push(pt(LAT0 + 100 * Math.sin(i / 60 * 2 * Math.PI) / M_LAT, LON0 + 100 * Math.cos(i / 60 * 2 * Math.PI) / M_LON, T0 + i * 1000));
  var rs = C.runSimplify(ring, 4);
  return C.runSimplify([], 4).length === 0 && C.runSimplify(null, 4).length === 0 && C.runSimplify([northPt(0, 0)], 4).length === 1 && C.runSimplify([northPt(0, 0), northPt(5, 1)], 4).length === 2 && C.runSimplify(ring, 0).length === ring.length && rs.length > 8 && maxDevFromPolyline(ring, rs) <= 4.05;
})());
ck("59. runSimplify: dados patológicos (dentes de serra de km, 60 000 pontos) acabam em segundos e mantêm a garantia de eps", (function(){
  var a = [], i, t = Date.now(); for (i = 0; i < 60000; i++) a.push({lat: LAT0 + 0.02 * (1 - i / 60000) * (i % 2), lon: LON0 + i * 1e-5, t: T0 + i * 1000});
  var s = C.runSimplify(a, 4), spent = Date.now() - t;
  return spent < 4000 && s.length > 1000 && s[0] === a[0] && s[s.length - 1] === a[a.length - 1] && maxDevFromPolyline(a, s) <= 4.05;
})());
// prepare
var hour = (function(){ var r = rng(50), seg = [], i; for (i = 0; i < 3600; i++) seg.push(pt(LAT0 + (i * 2.8 + gauss(r) * 2) / M_LAT, LON0 + (400 * Math.sin(i / 400) + gauss(r) * 2) / M_LON, T0 + i * 1000)); return [seg]; })();
var prep = C.runPrepareTrack(hour);
ck("60. runPrepareTrack (1 h, 3600 pontos com ruído): devolve {segments, trimM:200, points} com ≤ 3000 pontos", prep && prep.trimM === 200 && prep.points === prep.segments.reduce(function(a, s){ return a + s.length; }, 0) && prep.points <= 3000 && prep.points > 20);
ck("61. runPrepareTrack: coordenadas a 5 casas, t em segundos inteiros desde o 1.º ponto, crescente, a começar depois do aparo", (function(){
  var ok = true, lastT = -1;
  prep.segments.forEach(function(s){ s.forEach(function(p){ ok = ok && p.length === 3 && Math.round(p[0] * 1e5) / 1e5 === p[0] && Math.round(p[1] * 1e5) / 1e5 === p[1] && p[2] === Math.round(p[2]) && p[2] >= lastT; lastT = p[2]; }); });
  return ok && prep.segments[0][0][2] > 30 && prep.segments[0][0][2] < 200;
})());
ck("62. runPrepareTrack: nenhum ponto a menos de 200 m da partida nem da chegada originais", (function(){
  var f = hour[0][0], l = hour[0][hour[0].length - 1];
  return prep.segments.every(function(s){ return s.every(function(p){ return C.runHav(p[0], p[1], f.lat, f.lon) >= 199 && C.runHav(p[0], p[1], l.lat, l.lon) >= 199; }); });
})());
ck("63. runPrepareTrack: cfg.trimM muda o aparo (0, 500, 1000, 2000) e nunca passa de 2000 (CHECK de trim_m); um valor fora do conjunto cai nos 200 por omissão", (function(){
  var p0 = C.runPrepareTrack(hour, {trimM: 0}), p5 = C.runPrepareTrack(hour, {trimM: 500}), big = C.runPrepareTrack(lineTrack(9000, 3), {trimM: 2000}), huge = C.runPrepareTrack(lineTrack(9000, 3), {trimM: 99999});
  return p0.trimM === 0 && p5.trimM === 500 && big && big.trimM === 2000 && huge && huge.trimM === 200 && p0.segments[0][0][2] === 0 && p5.segments[0][0][2] > prep.segments[0][0][2];
})());
ck("64. runPrepareTrack: 60 000 pontos acabam com ≤ 3000 pontos, ≤ 200 segmentos e texto jsonb ≤ 200 000", (function(){
  var r = rng(51), seg = [], i, la = LAT0, lo = LON0;
  for (i = 0; i < 60000; i++) { la += (r() - 0.5) * 0.0001; lo += (r() - 0.45) * 0.0001; seg.push(pt(la, lo, T0 + i * 1000)); }
  var p = C.runPrepareTrack([seg]);
  return p && p.points <= 3000 && p.segments.length <= 200 && C.runTrackBytes(p.segments) <= 200000;
})());
ck("65. runPrepareTrack: 1000 segmentos curtos são fundidos em ≤ 200 sem perder a ordem do tempo", (function(){
  var segs = [], i, j;
  for (i = 0; i < 1000; i++) { var s = []; for (j = 0; j < 12; j++) s.push(northPt(i * 40 + j * 3, i * 20 + j)); segs.push(s); }
  var p = C.runPrepareTrack(segs, {trimM: 0}), lastT = -1, ok = true;
  p.segments.forEach(function(s){ s.forEach(function(q){ ok = ok && q[2] >= lastT; lastT = q[2]; }); });
  return p && p.segments.length <= 200 && p.segments.length > 100 && ok;
})());
ck("66. runPrepareTrack: sem segmentos, sem pontos válidos ou só pontos soltos → null", C.runPrepareTrack([]) === null && C.runPrepareTrack(null) === null && C.runPrepareTrack([[]]) === null && C.runPrepareTrack([[{lat: NaN, lon: 1, t: 1}]]) === null && C.runPrepareTrack([[northPt(0, 0)]], {trimM: 0}) === null);
ck("67. O texto jsonb que o SQL mede (octet_length(points::text)) é o que runTrackBytes calcula", (function(){
  var real = JSON.stringify(prep.segments).replace(/,/g, ", ");
  return C.runTrackBytes(prep.segments) === real.length && real.length <= 200000;
})());
ck("68. runPrepareTrack não altera a entrada", (function(){ var before = JSON.stringify(hour); C.runPrepareTrack(hour); return JSON.stringify(hour) === before; })());

// ================================================================ exportação GPX (texto; a leitura de volta está no teste de browser) ================================================================
var gpx = C.runToGpx({startedAtMs: T0}, [[[38.71234, -9.12345, 0], [38.71244, -9.12355, 12]], [[38.8, -9.2, 100], [38.8001, -9.2001, 105]]]);
ck("69. runToGpx: GPX 1.1 com um trkseg por segmento, tempos = início + t e sem nome, autor nem metadados", /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<gpx version="1\.1" creator="EVOLVE" xmlns="http:\/\/www\.topografix\.com\/GPX\/1\/1">/.test(gpx) && (gpx.match(/<trkseg>/g) || []).length === 2 && (gpx.match(/<trkpt /g) || []).length === 4 && gpx.indexOf("<time>2026-10-01T07:00:12Z</time>") > 0 && !/<(name|author|metadata|desc|cmt|extensions|email|link)\b/.test(gpx));
ck("70. runToGpx: aceita a linha da BD (started_at ISO) e pontos {lat,lon,t(ms)}; ignora campos estranhos; sem pontos → null", (function(){
  var a = C.runToGpx({started_at: "2026-10-01T07:00:00+00:00", name: "<x>", notes: "&"}, [[[38.7, -9.1, 5]]]), b = C.runToGpx({}, [[{lat: 38.7, lon: -9.1, t: T0 + 1500}]]);
  return a.indexOf("2026-10-01T07:00:05Z") > 0 && b.indexOf("2026-10-01T07:00:01.500Z") > 0 &&  !/<x>|name/.test(a) && C.runToGpx({startedAtMs: T0}, []) === null && C.runToGpx({startedAtMs: T0}, [[]]) === null && C.runToGpx({}, [[[38.7, -9.1, 5]]]) === null && C.runToGpx({startedAtMs: T0}, null) === null;
})());
ck("71. runToGpx: pontos inválidos ou com coordenadas de texto não entram (nada de texto livre no XML)", (function(){
  var g = C.runToGpx({startedAtMs: T0}, [[["<script>", -9.1, 5], [38.7, -9.1, 5], [91, 0, 6], [38.71, -9.11, "x"]]]);
  return (g.match(/<trkpt /g) || []).length === 1 && g.indexOf("<script>") < 0;
})());

// ================================================================ datas ================================================================
ck("72. runParseTime: Z, ±hh:mm, ±hhmm e ±hh dão o mesmo instante", (function(){ var z = C.runParseTime("2026-10-01T07:00:00Z").ms; return z === T0 && C.runParseTime("2026-10-01T08:00:00+01:00").ms === T0 && C.runParseTime("2026-10-01T02:00:00-0500").ms === T0 && C.runParseTime("2026-10-01T09:00:00+02").ms === T0; })());
ck("73. runParseTime: sem fuso é naive:true e lê-se como UTC, qualquer que seja o fuso do computador", (function(){ var a = C.runParseTime("2026-10-01T07:00:00"), b = C.runParseTime("2026-10-01 07:00:00"); return a.ms === T0 && a.naive === true && b.ms === T0 && C.runParseTime("2026-10-01T07:00:00Z").naive === false; })());
ck("74. runParseTime: milésimos e datas impossíveis (31 fev, hora 25, texto, vazio, não-texto)", C.runParseTime("2026-10-01T07:00:00.250Z").ms === T0 + 250 && C.runParseTime("2026-10-01T07:00:00.123456+00:00").ms === T0 + 123 && C.runParseTime("2026-02-31T07:00:00Z") === null && C.runParseTime("2026-10-01T25:00:00Z") === null && C.runParseTime("ontem") === null && C.runParseTime("") === null && C.runParseTime(null) === null && C.runParseTime(12345) === null);

// ================================================================ limites do SQL (CHECK) ================================================================
var sqlFile = path.join(root, "supabase", "migrations", "0032_corrida.sql");
var sql = fs.existsSync(sqlFile) ? fs.readFileSync(sqlFile, "utf8") : null;
// valores do SQL: lidos do ficheiro quando existe; senão os que estavam no SQL validado quando isto foi escrito (marcado abaixo)
var LIM = {duration: [1, 86400], moving: [0, 86400], dist: [0, 300000], gaps: [0, 1000], gapS: [0, 86400], hidden: [0, 86400], splits: 300, splitMax: 86400, notes: 300, rpe: [1, 10], avg: 12, segs: 200, bytes: 200000, trim: [0, 2000], secMax: 604800};
if (sql) {
  // o SQL pode escrever o mesmo limite de duas maneiras (CHECK direto ou dentro de uma função de validação): aceitam-se as duas
  var between = function(re){ var mm = re.exec(sql); return mm ? [+mm[1], +mm[2]] : null; };
  var first = function(list){ var k, mm; for (k = 0; k < list.length; k++) { mm = list[k].exec(sql); if (mm) return +mm[1]; } return 0; };
  LIM = {
    duration: between(/duration_s integer[^\n]*check \(duration_s between (\d+) and (\d+)\)/), moving: between(/moving_s integer[^\n]*check \(moving_s between (\d+) and (\d+)\)/),
    dist: between(/distance_m integer[^\n]*check \(distance_m between (\d+) and (\d+)\)/), gaps: between(/gaps smallint[^\n]*check \(gaps between (\d+) and (\d+)\)/),
    gapS: between(/gap_s integer[^\n]*check \(gap_s between (\d+) and (\d+)\)/), hidden: between(/hidden_s integer[^\n]*check \(hidden_s between (\d+) and (\d+)\)/),
    splits: first([/jsonb_array_length\(splits_s\) <= (\d+)/, /jsonb_array_length\(s\) > (\d+)/]), splitMax: first([/v < 0 or v > (\d+)/]),
    notes: first([/char_length\(notes\) <= (\d+)/]), rpe: between(/rpe smallint check \(rpe is null or rpe between (\d+) and (\d+)\)/),
    avg: first([/distance_m::numeric \/ duration_s <= (\d+)/, /distance_m <= (\d+) \* duration_s/]),
    segs: first([/jsonb_array_length\(points\) between 1 and (\d+)/, /jsonb_array_length\(p\) > (\d+)/]), bytes: first([/octet_length\(points::text\) <= (\d+)/, /octet_length\(p::text\) > (\d+)/]),
    trim: between(/trim_m smallint[^\n]*check \(trim_m between (\d+) and (\d+)\)/), secMax: first([/sec > (\d+)/])
  };
} else console.log("(0032_corrida.sql ainda não está no repositório: os limites do SQL ficam fixados à mão neste teste; quando o ficheiro existir, passam a ser lidos dele)");
ck("75. Os limites do SQL e os do RUN_CFG coincidem (duração, distância, lacunas, parciais, notas, velocidade média, segmentos, bytes, aparo)" + (sql ? "" : " [limites fixos: SQL em falta]"),
  LIM.duration && LIM.duration[0] === 1 && LIM.duration[1] === cfg.maxDurationS && LIM.moving && LIM.moving[1] === cfg.maxDurationS && LIM.dist && LIM.dist[1] === cfg.maxDistM && LIM.gaps && LIM.gaps[1] === cfg.maxGaps && LIM.gapS && LIM.gapS[1] === cfg.maxDurationS && LIM.hidden && LIM.hidden[1] === cfg.maxDurationS &&
  LIM.splits === cfg.maxSplits && LIM.splitMax === cfg.maxDurationS && LIM.notes === cfg.maxNotes && LIM.avg === cfg.maxAvgSpeedMs && LIM.segs === cfg.maxSegments && LIM.bytes === cfg.maxTrackBytes && LIM.trim && LIM.trim[1] === cfg.maxTrimM && LIM.rpe && LIM.rpe[0] === 1 && LIM.rpe[1] === 10 && LIM.secMax >= 86400);
ck("76. O SQL aceita as seis origens que RUN_SOURCES lista" + (sql ? "" : " [SQL em falta]"), !sql || /source in \('live', 'gpx', 'tcx', 'fit', 'manual', 'native'\)/.test(sql) && C.RUN_SOURCES.join() === "live,gpx,tcx,fit,manual,native");
ck("77. O CHECK de started_at do SQL é 2000-01-01 e minStartedAtMs é esse instante" + (sql ? "" : " [SQL em falta]"), (!sql || /started_at >= timestamptz '2000-01-01 00:00:00\+00'/.test(sql)) && cfg.minStartedAtMs === Date.UTC(2000, 0, 1));

var ID = "0b5f6c7e-3a3b-4c43-9d0e-0a1b2c3d4e5f";
function goodRun(o){ var r = {id: ID, studentId: "ana", source: "gpx", startedAtMs: T0, durationS: 1800, movingS: 1700, distM: 5234, gaps: 1, gapS: 12, hiddenS: 0, splitsS: [340, 342, 338, 335, 341], rpe: 7, notes: "Boa corrida", consentV: 1}; Object.keys(o || {}).forEach(function(k){ r[k] = o[k]; }); return r; }
var COLS = ["id", "student_id", "started_at", "source", "duration_s", "moving_s", "distance_m", "gaps", "gap_s", "hidden_s", "splits_s", "rpe", "notes", "consent_v"];
function dbAccepts(row, nowMs){   // os CHECK do SQL, por extenso
  var ok = Object.keys(row).sort().join() === COLS.slice().sort().join(), isInt = function(v, a, b){ return typeof v === "number" && v === Math.floor(v) && v >= a && v <= b; };
  var st = Date.parse(row.started_at);
  ok = ok && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(row.id) && typeof row.student_id === "string" && row.student_id.length > 0;
  ok = ok && st >= Date.UTC(2000, 0, 1) && st <= nowMs + 2 * 86400000 && C.RUN_SOURCES.indexOf(row.source) >= 0;
  ok = ok && isInt(row.duration_s, LIM.duration[0], LIM.duration[1]) && isInt(row.moving_s, LIM.moving[0], LIM.moving[1]) && isInt(row.distance_m, LIM.dist[0], LIM.dist[1]) && isInt(row.gaps, LIM.gaps[0], LIM.gaps[1]) && isInt(row.gap_s, LIM.gapS[0], LIM.gapS[1]) && isInt(row.hidden_s, LIM.hidden[0], LIM.hidden[1]);
  ok = ok && (row.splits_s === null || (Array.isArray(row.splits_s) && row.splits_s.length <= LIM.splits && row.splits_s.every(function(x){ return typeof x === "number" && isFinite(x); })));
  ok = ok && (row.rpe === null || isInt(row.rpe, LIM.rpe[0], LIM.rpe[1])) && (row.notes === null || (typeof row.notes === "string" && Array.from(row.notes).length <= LIM.notes && row.notes.indexOf("\u0000") < 0));
  ok = ok && isInt(row.consent_v, 1, 32767) && row.moving_s <= row.duration_s && row.distance_m / row.duration_s <= LIM.avg;
  return ok;
}
var built = C.runBuildInsert(goodRun(), NOW);
ck("78. runBuildInsert devolve exatamente as colunas de runs que o cliente envia (sem created_by nem created_at)", built && Object.keys(built).join() === COLS.join() && built.started_at === "2026-10-01T07:00:00.000Z" && built.student_id === "ana" && built.distance_m === 5234 && built.splits_s.length === 5 && built.rpe === 7 && built.notes === "Boa corrida" && built.consent_v === 1);
ck("79. A linha construída cumpre todos os CHECK do SQL", dbAccepts(built, NOW));
ck("80. Valores acima dos tetos são limitados em vez de enviados (lacunas, segundos, notas, parciais, rpe)", (function(){
  var row = C.runBuildInsert(goodRun({gaps: 5000, gapS: 999999, hiddenS: 123456789, notes: new Array(400).join("ã"), splitsS: new Array(500).join("1,").split(",").map(Number), rpe: 99, movingS: 5000}), NOW);
  return row && row.gaps === 1000 && row.gap_s === 86400 && row.hidden_s === 86400 && row.notes.length === 300 && row.splits_s.length === 300 && row.rpe === null && row.moving_s === 1800 && dbAccepts(row, NOW);
})());
ck("81. Texto vindo do aluno: controlos e NUL saem, par substituto cortado não fica, espaços nas pontas saem, vazio → null", (function(){
  var a = C.runBuildInsert(goodRun({notes: "  olá\u0000 mundo\u0007  "}), NOW), emo = new Array(300).join("a") + "😀😀", b = C.runBuildInsert(goodRun({notes: emo}), NOW), c = C.runBuildInsert(goodRun({notes: "   "}), NOW), d = C.runBuildInsert(goodRun({notes: 12345}), NOW);
  return a.notes === "olá mundo" && b.notes.length <= 300 && !/[\uD800-\uDBFF]$/.test(b.notes) && c.notes === null && d.notes === null && dbAccepts(b, NOW);
})());
ck("82. Recusa (null) o que a BD recusaria: duração 0, ritmo impossível, distância > 300 km, uuid mau, sem aluno, origem estranha, sem consentimento", (function(){
  var bads = [{durationS: 0}, {durationS: 100000}, {distM: 20000, durationS: 1000}, {distM: 400000, durationS: 86400}, {id: "abc"}, {id: 123}, {studentId: ""}, {studentId: null}, {source: "strava"}, {source: null}, {consentV: 0}, {consentV: null}, {startedAtMs: Date.UTC(1999, 11, 31)}, {startedAtMs: NOW + 3 * 86400000}, {startedAtMs: NaN}, {distM: "abc"}];
  return bads.every(function(b){ return C.runBuildInsert(goodRun(b), NOW) === null; }) && C.runBuildInsert(null, NOW) === null && C.runBuildInsert("x", NOW) === null;
})());
ck("83. Ritmo no limite (12 m/s de média) passa; um metro acima não", C.runBuildInsert(goodRun({distM: 12000, durationS: 1000, movingS: 1000}), NOW) !== null && C.runBuildInsert(goodRun({distM: 12001, durationS: 1000}), NOW) === null);
ck("84. runCheckRun diz porquê, em PT-PT, para o ecrã", (function(){
  var a = C.runCheckRun(goodRun(), NOW), b = C.runCheckRun(goodRun({distM: 20000, durationS: 1000}), NOW), c = C.runCheckRun(goodRun({durationS: 0}), NOW), d = C.runCheckRun(goodRun({consentV: 0}), NOW);
  return a.ok === true && b.ok === false && b.code === "speed" && /ritmo parece impossível/.test(b.error) && c.code === "duration" && /pelo menos 1 segundo/.test(c.error) && d.code === "consent";
})());
ck("85. Aceita números dados como texto e arredonda (5234.6 → 5235; rpe \"7\")", (function(){ var r = C.runBuildInsert(goodRun({distM: "5234.6", durationS: "1800.4", rpe: "7", consentV: "1"}), NOW); return r && r.distance_m === 5235 && r.duration_s === 1800 && r.rpe === 7; })());
ck("86. O id sai em minúsculas; sem parciais, splits_s é null; movingS em falta fica igual ao tempo total", (function(){ var r = C.runBuildInsert(goodRun({id: ID.toUpperCase(), splitsS: [], movingS: undefined}), NOW); return r.id === ID && r.splits_s === null && r.moving_s === r.duration_s; })());
ck("87. Fuzz (3000 corridas aleatórias, algumas lixo): tudo o que runBuildInsert devolve cumpre os CHECK do SQL", (function(){
  var r = rng(77), count = 0, okAll = true, i, junk = [undefined, null, NaN, Infinity, -1, "x", "", {}, [], true, 1e300, -1e300, "1e3", 0, 0.4, 5.5];
  function pick(){ return r() < 0.25 ? junk[Math.floor(r() * junk.length)] : r() < 0.5 ? Math.round(r() * 100000) : r() * 4000; }
  for (i = 0; i < 3000; i++) {
    var run = goodRun({durationS: pick(), movingS: pick(), distM: pick(), gaps: pick(), gapS: pick(), hiddenS: pick(), rpe: pick(), consentV: r() < 0.9 ? 1 : pick(), startedAtMs: r() < 0.8 ? T0 + Math.floor(r() * 1e9) : pick(), splitsS: r() < 0.5 ? [pick(), pick()] : pick(), notes: r() < 0.3 ? new Array(Math.floor(r() * 700)).join("é") : pick()});
    var row = C.runBuildInsert(run, NOW);
    if (row) { count++; if (!dbAccepts(row, NOW)) okAll = false; }
  }
  return okAll && count > 200;
})());

// ================================================================ linhas lidas da BD ================================================================
var dbRow = {id: ID, student_id: "ana", created_by: "11111111-2222-3333-4444-555555555555", created_at: "2026-10-01T09:00:00+00:00", started_at: "2026-10-01T07:00:00+00:00", source: "gpx", duration_s: 1800, moving_s: 1700, distance_m: 5234, gaps: 1, gap_s: 12, hidden_s: 0, splits_s: [340, 342], rpe: 7, notes: "ok", consent_v: 1};
var norm = C.runNormalizeRow(dbRow);
ck("88. runNormalizeRow: converte uma linha de runs em objeto com tipos certos e ritmo calculado", norm && norm.id === ID && norm.startedAtMs === T0 && norm.startedAt === "2026-10-01T07:00:00.000Z" && norm.distM === 5234 && norm.durationS === 1800 && norm.movingS === 1700 && norm.splitsS.length === 2 && norm.rpe === 7 && norm.notes === "ok" && norm.consentV === 1 && Math.abs(norm.paceSPerKm - 1700 / 5.234) < 1e-9 && norm.source === "gpx");
ck("89. runNormalizeRow: tipos errados, textos enormes e valores fora de intervalo ficam limitados", (function(){
  var r = C.runNormalizeRow({id: ID, started_at: "2026-10-01T07:00:00.123456+00:00", source: "tcx", duration_s: "99999999", moving_s: 5e9, distance_m: "abc", gaps: -3, gap_s: 1e9, hidden_s: null, splits_s: "no", rpe: 42, notes: new Array(2000).join("x"), consent_v: "7", created_by: {a: 1}});
  return r && r.durationS === 86400 && r.movingS === 86400 && r.distM === 0 && r.gaps === 0 && r.gapS === 86400 && r.hiddenS === 0 && r.splitsS.length === 0 && r.rpe === null && r.notes.length === 300 && r.consentV === 7 && r.createdBy === "" && r.paceSPerKm === null && r.startedAtMs === T0 + 123;
})());
ck("90. runNormalizeRow: sem id válido, sem data, data antes de 2000 ou origem desconhecida → null; o movimento nunca passa o tempo total", (function(){
  var base = function(o){ var r = JSON.parse(JSON.stringify(dbRow)); Object.keys(o).forEach(function(k){ r[k] = o[k]; }); return r; };
  return C.runNormalizeRow(null) === null && C.runNormalizeRow("x") === null && C.runNormalizeRow(base({id: null})) === null && C.runNormalizeRow(base({id: "<img src=x>"})) === null && C.runNormalizeRow(base({started_at: "ontem"})) === null && C.runNormalizeRow(base({started_at: "1999-12-31T00:00:00Z"})) === null && C.runNormalizeRow(base({source: "xx"})) === null && C.runNormalizeRow(base({duration_s: 100, moving_s: 500})).movingS === 100;
})());
ck("91. runNormalizeRows ignora as linhas inválidas e aceita lixo", C.runNormalizeRows([dbRow, null, 5, {id: 1}, dbRow]).length === 2 && C.runNormalizeRows(null).length === 0);
ck("92. Uma linha construída por runBuildInsert volta a normalizar-se sem perder nada", (function(){ var r = C.runNormalizeRow(built); return r && r.startedAtMs === T0 && r.distM === built.distance_m && r.durationS === built.duration_s && r.rpe === 7 && r.notes === "Boa corrida" && r.splitsS.join() === built.splits_s.join(); })());
ck("93. runDupCheck: mesma hora (±60 s) e distância (±2 %) → corrida parecida; fora disso não", (function(){
  var list = [norm, {startedAtMs: T0 + 3600000, distM: 10000}], c = function(dt, d){ return C.runDupCheck(list, {startedAtMs: T0 + dt, distM: d}); };
  return c(0, 5234) === norm && c(59000, 5300) === norm && c(60000, 5130) === norm && c(61000, 5234) === null && c(0, 5400) === null && c(3600000, 10100) === list[1] && C.runDupCheck([], {startedAtMs: T0, distM: 1}) === null && C.runDupCheck(null, {}) === null && C.runDupCheck(list, null) === null;
})());
ck("94. runDupCheck: aceita linhas de BD sem normalizar ({started_at, distance_m}) e ignora lixo na lista", C.runDupCheck([null, 7, {started_at: "xx", distance_m: 5}, dbRow], {startedAtMs: T0 + 5000, distM: 5240}) === dbRow);
ck("95. runUuid gera uuid v4 válidos e distintos, aceites por runBuildInsert", (function(){ var a = C.runUuid(), b = C.runUuid(); return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(a) && a !== b && C.runBuildInsert(goodRun({id: a}), NOW) !== null; })());

// ================================================================ formatação PT-PT ================================================================
ck("96. Ritmo: 330 s/km → «5:30»; arredonda ao segundo; inválido → «–»", C.runPaceStr(330) === "5:30" && C.runPaceStr(359.6) === "6:00" && C.runPaceStr(305) === "5:05" && C.runPaceStr(59) === "0:59" && C.runPaceStr(0) === "–" && C.runPaceStr(NaN) === "–" && C.runPaceStr(null) === "–" && C.runPaceStr(Infinity) === "–" && C.runPaceStr(-5) === "–");
ck("97. Duração: «42:10», «1:02:10», «0:00», «0:07»", C.runDurStr(2530) === "42:10" && C.runDurStr(3730) === "1:02:10" && C.runDurStr(0) === "0:00" && C.runDurStr(7) === "0:07" && C.runDurStr(36000) === "10:00:00" && C.runDurStr(-1) === "–" && C.runDurStr("x") === "–");
ck("98. Distância: «5,23 km» com vírgula decimal; arredonda ao metro certo", C.runDistStr(5234) === "5,23 km" && C.runDistStr(5235) === "5,24 km" && C.runDistStr(0) === "0,00 km" && C.runDistStr(999.9) === "1,00 km" && C.runDistStr(42195) === "42,20 km" && C.runDistStr(-1) === "–" && C.runDistStr(NaN) === "–");
ck("99. runPaceOf: segundos por km a partir da distância e do tempo em movimento; sem dados → null", Math.abs(C.runPaceOf(5000, 1650) - 330) < 1e-9 && C.runPaceOf(0, 100) === null && C.runPaceOf(1000, 0) === null && C.runPaceOf(null, 1) === null && C.runPaceOf(NaN, 1) === null);
ck("100. runParseKm: «5,23», «5.23», «10 km», até 3 decimais, nada de negativos, texto, vazio ou > 300 km", C.runParseKm("5,23") === 5230 && C.runParseKm("5.23") === 5230 && C.runParseKm(" 10 km ") === 10000 && C.runParseKm("0,5") === 500 && isNaN(C.runParseKm("0")) && isNaN(C.runParseKm("-3")) && isNaN(C.runParseKm("abc")) && isNaN(C.runParseKm("")) && isNaN(C.runParseKm(null)) && isNaN(C.runParseKm("301")) && isNaN(C.runParseKm("5,2345")) && isNaN(C.runParseKm("1e3")));
ck("101. runParseDuration: «42:10», «1:02:10»; segundos < 60; vazio, texto, zero e > 24 h → NaN", C.runParseDuration("42:10") === 2530 && C.runParseDuration("1:02:10") === 3730 && C.runParseDuration(" 0:30 ") === 30 && isNaN(C.runParseDuration("42:75")) && isNaN(C.runParseDuration("1:75:00")) && isNaN(C.runParseDuration("45")) && isNaN(C.runParseDuration("")) && isNaN(C.runParseDuration("0:00")) && isNaN(C.runParseDuration("25:00:00")) && isNaN(C.runParseDuration(null)));
ck("102. Formatar e voltar a ler: runParseDuration(runDurStr(x)) = x; runParseKm(runDistStr(m)) ≈ m", [61, 2530, 3730, 5999].every(function(x){ return C.runParseDuration(C.runDurStr(x)) === x; }) && [1230, 5230, 21100].every(function(x){ return C.runParseKm(C.runDistStr(x)) === x; }));

// ================================================================ SVG ================================================================
var svgSegs = [[[38.7, -9.1], [38.701, -9.099], [38.702, -9.0985]], [[38.7025, -9.098], [38.704, -9.097]]];
var svg = C.runTrackSvg(svgSegs);
ck("103. runTrackSvg: svg com role=img e aria-label PT-PT, viewBox, uma polilinha por segmento e um tracejado a ligar os dois", /^<svg [^>]*role="img"/.test(svg) && /aria-label="Percurso da corrida/.test(svg) && /viewBox="0 0 320 200"/.test(svg) && (svg.match(/<polyline /g) || []).length === 2 && (svg.match(/stroke-dasharray/g) || []).length === 1 && (svg.match(/class="run-svg-start"/g) || []).length === 1 && (svg.match(/class="run-svg-end"/g) || []).length === 1);
ck("104. runTrackSvg: nenhum NaN/Infinity/undefined, sem mapa nem imagens nem ligações a terceiros, sem scripts nem atributos de evento", !/NaN|Infinity|undefined|null/.test(svg) && !/<(image|script|foreignObject|a|use|iframe)\b|xlink|href|https?:\/\/(?!www\.w3\.org)|\bon\w+=/.test(svg));
ck("105. runTrackSvg: todos os pontos ficam dentro do quadro (com a margem) e o norte fica em cima", (function(){
  var nums = svg.match(/points="([^"]+)"/g).join(" ").match(/-?\d+(\.\d+)?,-?\d+(\.\d+)?/g), ok = nums.length === 5;
  nums.forEach(function(s){ var xy = s.split(",").map(Number); ok = ok && xy[0] >= 14 - 0.1 && xy[0] <= 306 + 0.1 && xy[1] >= 14 - 0.1 && xy[1] <= 186 + 0.1; });
  var ys = svg.match(/points="([^"]+)"/)[1].split(" ").map(function(s){ return +s.split(",")[1]; });
  return ok && ys[0] > ys[ys.length - 1];
})());
ck("106. runTrackSvg: a escala (barra e texto) é desenhada com um valor redondo; pode desligar-se", /run-svg-scale-text[^>]*>\d+ (m|km)</.test(svg) && C.runTrackSvg(svgSegs, {scale: false}).indexOf("run-svg-scale") < 0);
ck("107. runTrackSvg: aceita pontos {lat,lon,t}; devolve \"\" com < 2 pontos, pontos todos iguais, entrada inválida", C.runTrackSvg([[northPt(0, 0), northPt(300, 100)]]) !== "" && C.runTrackSvg([[[38.7, -9.1]]]) === "" && C.runTrackSvg([[[38.7, -9.1], [38.7, -9.1]]]) === "" && C.runTrackSvg(null) === "" && C.runTrackSvg([]) === "" && C.runTrackSvg([null, 5, "x"]) === "");
ck("108. runTrackSvg: dados hostis (texto, NaN, fora de intervalo) são ignorados; nada deles entra no SVG; o aria-label dado é escapado", (function(){
  var s = C.runTrackSvg([[["<script>alert(1)</script>", -9.1], [NaN, 1], [95, 0], [38.7, -9.1], {lat: "38.8", lon: -9.1}, [38.701, -9.099]]], {ariaLabel: 'x" onload="alert(1)'});
  return s !== "" && s.indexOf("<script") < 0 && s.indexOf("alert(1)</") < 0 && /aria-label="x&quot; onload=&quot;alert\(1\)"/.test(s) && (s.match(/<circle /g) || []).length === 2;
})());
ck("109. runTrackSvg: reta exatamente norte-sul (largura zero) e percurso minúsculo desenham-se sem NaN; opções fora de intervalo são limitadas", (function(){
  var a = C.runTrackSvg([[[38.7, -9.1], [38.71, -9.1]]]), b = C.runTrackSvg([[[38.7, -9.1], [38.7000001, -9.1000001]]]), c = C.runTrackSvg(svgSegs, {width: 1e9, height: -5, pad: 1e6});
  return a !== "" && !/NaN|Infinity/.test(a) && b !== "" && !/NaN|Infinity/.test(b) && (c === "" || (/viewBox="0 0 2000 60"/.test(c) && !/NaN|Infinity/.test(c)));
})());
ck("110. A projeção usa cos(latitude): a 60° norte, 1° de longitude desenha-se com metade da largura de 1° de latitude", (function(){
  var s = C.runTrackSvg([[[60, 0], [60, 1], [61, 1]]], {scale: false, width: 400, height: 400, pad: 0}), pts = s.match(/points="([^"]+)"/)[1].split(" ").map(function(q){ return q.split(",").map(Number); });
  var w = pts[1][0] - pts[0][0], h = pts[1][1] - pts[2][1];
  return Math.abs(w / h - 0.5) < 0.02;
})());

// ================================================================ extras: limites configuráveis, rascunho, deduplicação ================================================================
ck("111. O limite de bytes do percurso (maxTrackBytes) obriga mesmo a simplificar mais: com 7000 o texto fica ≤ 5000, com menos pontos que por omissão", (function(){
  var small = C.runPrepareTrack(hour, {maxTrackBytes: 7000});
  return small && C.runTrackBytes(small.segments) <= 5000 && small.points < prep.points && C.runTrackBytes(prep.segments) > 5000;
})());
ck("112. Pontos que ficam iguais depois de arredondar a 5 casas não se repetem, e um segmento que fica com 1 ponto desaparece", (function(){
  var line = lineTrack(900, 3)[0], tiny = [pt(LAT0 + 2000 / M_LAT, LON0, T0 + 5000000), pt(LAT0 + 2000 / M_LAT + 1e-7, LON0 + 1e-7, T0 + 5001000)];
  var p = C.runPrepareTrack([line, tiny], {trimM: 0}), dup = false;
  p.segments.forEach(function(s){ s.forEach(function(q, j){ if (j && q[0] === s[j - 1][0] && q[1] === s[j - 1][1]) dup = true; }); });
  return !dup && p.segments.length === 1;
})());
ck("113. cfg parcial muda o comportamento: gapS 400 não parte a corrida em dois; importGapS 600 não vê lacuna no ficheiro", (function(){
  var st = C.runFeedInit(), r = rng(3), i;
  for (i = 0; i < 60; i++) C.runFeed(st, lineFix(i, 3, 0, r, 5), {gapS: 400});
  for (i = 360; i < 420; i++) C.runFeed(st, lineFix(i, 3, 0, r, 5), {gapS: 400});
  var seg = [], j; for (j = 0; j <= 60; j++) seg.push(northPt(j * 3, j)); for (j = 0; j <= 60; j++) seg.push(northPt(180 + j * 3, 160 + j));
  return st.segs.length === 1 && st.gaps === 0 && C.runStats([seg], {importGapS: 600}, "import").gaps === 0 && C.runStats([seg], null, "import").gaps === 1;
})());
ck("114. O state do registo é JSON puro: ida e volta por JSON.stringify não perde nem acrescenta nada", (function(){
  var s = feedLine(800, 3, 2, 5, 6).st, a = JSON.stringify(s);
  return JSON.stringify(JSON.parse(a)) === a && !/function|undefined/.test(a);
})());
var draft1h = feedLine(3600, 3, 2, 9, 6).st;
console.log("(sintético) rascunho de 1 h a 3 m/s com ruído: " + draft1h.nPts + " pontos, " + JSON.stringify(draft1h).length + " bytes de JSON");
ck("115. O rascunho de 1 h cabe com folga no localStorage (< 300 KB) (sintético)", JSON.stringify(draft1h).length < 300000 && draft1h.nPts > 100);
ck("116. As funções de entrada não são alteradas: runStats, runTrim, runToGpx, runTrackSvg, runDupCheck, runNormalizeRow", (function(){
  var segs = [lineTrack(900, 3)[0]], before = JSON.stringify(segs), run = goodRun(), rb = JSON.stringify(run), arr = [norm], ab = JSON.stringify(arr), row = JSON.parse(JSON.stringify(dbRow)), rowb = JSON.stringify(row);
  C.runStats(segs, null, "import"); C.runTrim(segs, 200); C.runToGpx({startedAtMs: T0}, segs); C.runTrackSvg(segs); C.runBuildInsert(run, NOW); C.runDupCheck(arr, {startedAtMs: T0, distM: 5234}); C.runNormalizeRow(row);
  return JSON.stringify(segs) === before && JSON.stringify(run) === rb && JSON.stringify(arr) === ab && JSON.stringify(row) === rowb;
})());

function dbAcceptsTrack(points){   // run_points_are_valid / CHECK de run_tracks, por extenso
  if (!Array.isArray(points) || points.length < 1 || points.length > LIM.segs) return false;
  if (JSON.stringify(points).replace(/,/g, ", ").length > LIM.bytes) return false;
  return points.every(function(seg){ return Array.isArray(seg) && seg.length >= 1 && seg.every(function(p){
    return Array.isArray(p) && p.length === 3 && p.every(function(v){ return typeof v === "number" && isFinite(v); }) && p[0] >= -90 && p[0] <= 90 && p[1] >= -180 && p[1] <= 180 && p[2] >= 0 && p[2] <= LIM.secMax;
  }); });
}
ck("117. Todo o percurso que runPrepareTrack devolve cumpre a validação do SQL (3 números por ponto, lat/lon/segundos nos intervalos, 1..200 segmentos, ≤ 200 000 bytes)", (function(){
  var r = rng(88), i, ok = true, made = 0;
  for (i = 0; i < 60; i++) {
    var segs = [], ns = 1 + Math.floor(r() * (i < 6 ? 1200 : 25)), la = r() < 0.2 ? -85.1 : LAT0, lo = r() < 0.2 ? 179.9 : LON0, t = 0, s2, k;
    for (s2 = 0; s2 < ns; s2++) { var sg = [], len = 1 + Math.floor(r() * 400); for (k = 0; k < len; k++) { la += (r() - 0.5) * 3e-4; lo += (r() - 0.5) * 3e-4; t += 1000 * (1 + Math.floor(r() * 3)); sg.push(pt(Math.max(-89.9, Math.min(89.9, la)), Math.max(-179.9, Math.min(179.9, lo)), T0 + t)); } segs.push(sg); t += 7000; }
    var p = C.runPrepareTrack(segs, {trimM: [0, 200, 500, 1000, 2000][i % 5]});
    if (p) { made++; if (!dbAcceptsTrack(p.segments) || p.trimM < LIM.trim[0] || p.trimM > LIM.trim[1]) ok = false; }
  }
  return ok && made >= 20 && dbAcceptsTrack(prep.segments);
})());

var corridaFile = path.join(root, "corrida.js");
var uiNames = fs.existsSync(corridaFile) ? (function(){ var out = [], mm2, re2 = /^(?:function\s+(\w+)|var\s+(\w+))/gm, src = fs.readFileSync(corridaFile, "utf8"); while ((mm2 = re2.exec(src))) out.push(mm2[1] || mm2[2]); return out; })() : [];
var twice = uiNames.filter(function(x){ return topNames.indexOf(x) >= 0; });
ck("118. corrida.js (se já existir) não redeclara nenhum nome do núcleo: no eval conjunto a 2.ª declaração apagava a 1.ª em silêncio" + (twice.length ? " (repetidos: " + twice.join(", ") + ")" : "") + (fs.existsSync(corridaFile) ? "" : " [corrida.js ainda não existe]"), twice.length === 0);

// ================================================================ revisão adversarial: dados hostis, privacidade, horas ================================================================
function runSeg(n, dt, v, t0){ var a = [], i; for (i = 0; i < n; i++) a.push(northPt(v * i * dt, (t0 || 0) + i * dt)); return a; }
function minDistTo(tr, la, lo){ var best = Infinity; tr.segments.forEach(function(sg){ sg.forEach(function(q){ var d = C.runHav(q[0], q[1], la, lo); if (d < best) best = d; }); }); return best; }
function coords(tr){ return JSON.stringify(tr.segments.map(function(sg){ return sg.map(function(q){ return [q[0], q[1]]; }); })); }
var base3600 = runSeg(1201, 1, 3), homeLat = LAT0, endLat = LAT0 + 3600 / M_LAT;
var cleanTr = C.runPrepareTrack([base3600], {trimM: 200});
var staleHead = [northPt(-1500, -1)].concat(base3600), staleBoth = staleHead.concat([northPt(3600 + 4000, 1201)]);
var trHead = C.runPrepareTrack([staleHead], {trimM: 200}), trBoth = C.runPrepareTrack([staleBoth], {trimM: 200});
ck("119. Aparo com o 1.º ponto espúrio (fix antigo a 1,5 km): centra-se na partida REAL; nada fica a menos de 200 m dela e o percurso partilhado é o mesmo que sem o ponto", trHead && minDistTo(trHead, homeLat, LON0) >= 199.9 && coords(trHead) === coords(cleanTr) && trHead.trimM === 200);
ck("120. O mesmo com o último ponto também espúrio (4 km para lá da chegada real): a chegada real fica a ≥ 200 m e nada do ponto espúrio entra no percurso", trBoth && minDistTo(trBoth, endLat, LON0) >= 199.9 && minDistTo(trBoth, homeLat, LON0) >= 199.9 && coords(trBoth) === coords(cleanTr) && minDistTo(trBoth, endLat + 4000 / M_LAT, LON0) > 3000);
var stHead = C.runStats([staleHead], null, "import"), stClean = C.runStats([base3600], null, "import");
ck("121. runStats em importação com o 1.º ponto espúrio: distância, tempo e parciais iguais ao percurso limpo (o ponto sai SÓ ele, entra em skipped) — antes somava ~1,5 km fantasma", stHead.distM === stClean.distM && stHead.durationS === stClean.durationS && stHead.movingS === stClean.movingS && stHead.splitsS.join() === stClean.splitsS.join() && stHead.skipped === 1 && stHead.startedAtMs === T0 && stClean.distM > 3500);
ck("122. Trecho espúrio no início (5 fixes parados a 1,5 km) e outliers do meio e do fim (1, 2 seguidos): saem só eles; distância e parciais não mudam", (function(){
  var head5 = [], i; for (i = 5; i >= 1; i--) head5.push(northPt(-1500, -i));
  var mid = base3600.slice(); mid[300] = northPt(5000 + 900, 300); mid[301] = northPt(5000 + 903, 301);
  var tail = base3600.concat([northPt(7600, 1201), northPt(7603, 1202)]);
  return [head5.concat(base3600), mid, tail].every(function(segA){ var s = C.runStats([segA], null, "import"); return Math.abs(s.distM - stClean.distM) <= 12 && s.splitsS.join() === stClean.splitsS.join() && s.skipped >= 1 && s.endedAtMs <= T0 + 1200000 + 1000; });
})());
ck("123. Um ponto do meio com posição absurda não entra no percurso partilhado nem no SVG (a polilinha não vai até lá)", (function(){
  var a = base3600.slice(); a[600] = pt(LAT0 + 1800 / M_LAT, LON0 + 5000 / M_LON, T0 + 600000);
  var tr = C.runPrepareTrack([a], {trimM: 0}), svg2 = C.runTrackSvg(C.runPrepareTrack([a], {trimM: 0}).segments);
  var far = false; tr.segments.forEach(function(sg){ sg.forEach(function(q){ if (Math.abs(q[1] - LON0) * M_LON > 100) far = true; }); });
  return tr && !far && coords(tr) === coords(C.runPrepareTrack([base3600], {trimM: 0})) && svg2 !== "";
})());
ck("124. runIClean não altera a entrada e é idempotente (limpar o já limpo não muda nada)", (function(){
  var segsA = [staleBoth.slice(), runSeg(100, 1, 3, 5000)], before = JSON.stringify(segsA), c1 = C.runIClean(segsA, C.RUN_CFG), c2 = C.runIClean(c1.segs, C.RUN_CFG);
  return JSON.stringify(segsA) === before && c1.dropped >= 2 && c2.dropped === 0 && JSON.stringify(c2.segs) === JSON.stringify(c1.segs);
})());
ck("125. Ruído normal de GPS (σ 3 m a 1 Hz, saltos < 30 m) não é «limpo»: a limpeza só mexe em saltos > spikeMinM", (function(){
  var r = rng(61), a = [], i; for (i = 0; i < 1800; i++) a.push(pt(LAT0 + (3 * i + gauss(r) * 3) / M_LAT, LON0 + gauss(r) * 3 / M_LON, T0 + i * 1000));
  var c = C.runIClean([a], C.RUN_CFG); return c.dropped === 0 && c.segs.length === 1 && c.segs[0].length === 1800;
})());

// ---- aparo: raio efetivo com folga aleatória, falha fechado
function firstSharedDist(tr){ return C.runHav(tr.segments[0][0][0], tr.segments[0][0][1], homeLat, LON0); }
var line9 = runSeg(3001, 1, 3);
var tr0 = C.runPrepareTrack([line9], {trimM: 200, rnd: 0}), trHi = C.runPrepareTrack([line9], {trimM: 200, rnd: 0.999}), trMid = C.runPrepareTrack([line9], {trimM: 200, rnd: 0.5});
ck("126. Folga aleatória: com rnd 0 o raio efetivo é 200 m, com rnd 0,5 é 250 m e com rnd ≈ 1 é ≈ 300 m (trimM × (1 + 0,5 × rnd)); o trimM guardado é sempre o NOMINAL (200)", firstSharedDist(tr0) >= 199.9 && firstSharedDist(tr0) < 215 && firstSharedDist(trMid) >= 249.9 && firstSharedDist(trMid) < 265 && firstSharedDist(trHi) >= 299 && firstSharedDist(trHi) < 315 && tr0.trimM === 200 && trMid.trimM === 200 && trHi.trimM === 200);
ck("127. rnd fora de [0,1) ou inválido: sem rnd (ou NaN, texto, negativo) usa 0; rnd ≥ 1 fica no máximo (nunca sai do intervalo, nunca aparta menos que trimM)", [undefined, NaN, "x", null, -3].every(function(r2){ var t = C.runPrepareTrack([line9], {trimM: 200, rnd: r2}); return coords(t) === coords(tr0); }) && (function(){ var big2 = C.runPrepareTrack([line9], {trimM: 200, rnd: 7}); return firstSharedDist(big2) >= 299 && firstSharedDist(big2) < 315; })());
ck("128. Raio efetivo com folga também vale para a chegada, e uma corrida que cabia nos 200 m mas não nos ≈300 m dá null (demasiado curta)", (function(){
  var endD = C.runHav(trHi.segments[trHi.segments.length - 1][trHi.segments[trHi.segments.length - 1].length - 1][0], LON0 * 0 + trHi.segments[trHi.segments.length - 1][trHi.segments[trHi.segments.length - 1].length - 1][1], LAT0 + 9000 / M_LAT, LON0);
  return endD >= 299 && C.runPrepareTrack([runSeg(161, 1, 3)], {trimM: 200, rnd: 0}) !== null && C.runPrepareTrack([runSeg(161, 1, 3)], {trimM: 200, rnd: 0.999}) === null;
})());
ck("129. trimM inválido NÃO desliga o aparo (falha fechado): NaN, null, texto, vazio, objeto, negativo, fora do conjunto e infinito dão trimM 200 e nada a menos de 200 m", [NaN, null, "abc", "", {}, [], -5, 300, 99999, Infinity, true].every(function(v){ var t = C.runPrepareTrack([line9], {trimM: v}); return t && t.trimM === 200 && minDistTo(t, homeLat, LON0) >= 199.9; }) && C.runPrepareTrack([line9], {trimM: 0}).trimM === 0 && C.runPrepareTrack([line9], {trimM: "500"}).trimM === 500 && C.runPrepareTrack([line9], {trimM: undefined}).trimM === 200 && C.runPrepareTrack([line9]).trimM === 200 && C.runPrepareTrack([line9], {trimM: 100}).trimM === 100);

// ---- horas adiantadas e segmentos fora de ordem na importação (runIFinish é o que os leitores de GPX/TCX chamam no fim)
function rawOf(pts){ return pts.map(function(sg){ return sg.map(function(p){ return {lat: p.lat, lon: p.lon, t: p.t, naive: false}; }); }); }
function finish(raw2){ return C.runIFinish("gpx", raw2, {cfg: C.RUN_CFG, nowMs: NOW}, null); }
var r0 = finish(rawOf([base3600])), st0 = C.runStats(r0.segments, null, "import");
ck("130. Base sem problemas: nenhum aviso, nada descartado, 1201 pontos", r0.ok && r0.warnings.length === 0 && r0.points === 1201 && r0.declaredDistM === null && st0.skipped === 0);
ck("131. UM ponto com a hora +10 min (e +1 ano, e o 1.º ponto adiantado): sai SÓ esse ponto, o resto fica e as contas são as mesmas (antes apagava 600 pontos e dava o ritmo a 2:46/km)", [600000, 365 * 86400000].every(function(adv){
  var a = base3600.slice(); a[100] = pt(a[100].lat, a[100].lon, a[100].t + adv);
  var r = finish(rawOf([a])), s2 = C.runStats(r.segments, null, "import");
  return r.ok && r.points === 1200 && r.warnings.join("|") === "Ignorámos 1 ponto inválido ou com hora repetida." && s2.distM === st0.distM && s2.durationS >= st0.durationS - 2 && s2.movingS >= st0.movingS - 3 && s2.splitsS.join() === st0.splitsS.join();
}) && (function(){ var a = base3600.slice(); a[0] = pt(a[0].lat, a[0].lon, T0 + 3600000); var r = finish(rawOf([a])); return r.ok && r.points === 1200 && r.startedAtMs === T0 + 1000; })());
ck("132. Série curta de pontos adiantados (2 seguidos) também sai só ela, sem apagar o resto", (function(){
  var a = base3600.slice(); a[100] = pt(a[100].lat, a[100].lon, a[100].t + 600000); a[101] = pt(a[101].lat, a[101].lon, a[101].t + 600000);
  var r = finish(rawOf([a])); return r.ok && r.points === 1199 && C.runStats(r.segments, null, "import").distM === st0.distM;
})());
ck("133. Segmentos em ordem cronológica invertida (ficheiro fundido): ordenam-se e nada se perde (antes metade do percurso desaparecia)", (function(){
  var s1 = runSeg(600, 1, 3, 0), s2 = runSeg(600, 1, 3, 600).map(function(p, i){ return northPt(1800 + 3 * i, 600 + i); });
  var r = finish(rawOf([s2, s1])), s = C.runStats(r.segments, null, "import");
  return r.ok && r.points === 1200 && r.segments.length === 2 && r.startedAtMs === T0 && r.segments[0][0].t === T0 && s.distM > 3500 && r.warnings.length === 0;
})());
ck("134. Se mais de 2 % dos pontos saem por hora fora de ordem, o aviso diz que a corrida pode estar incompleta (texto fixo); com poucos não aparece", (function(){
  var a = base3600.slice(), i; for (i = 0; i < 40; i++) a[200 + i] = pt(a[200 + i].lat, a[200 + i].lon, T0 + (600 + i) * 1000 * 0 + 1000);   // 40 pontos com hora 1 s (a recuar)
  var r = finish(rawOf([a])), few = finish(rawOf([base3600.slice(0, 100).concat([pt(1, 1, T0 + 5)]).concat(base3600.slice(100))]));
  return r.ok && r.warnings.indexOf("O ficheiro tem horas fora de ordem: a corrida pode estar incompleta.") >= 0 && few.ok && few.warnings.indexOf("O ficheiro tem horas fora de ordem: a corrida pode estar incompleta.") < 0;
})());
ck("135. Posição e hora absurdas no mesmo ficheiro, mais pontos sem hora: o resultado é o do percurso limpo e os avisos só levam números", (function(){
  var a = base3600.slice(); a[10] = pt(a[10].lat + 0.5, a[10].lon, a[10].t); a[500] = pt(a[500].lat, a[500].lon, a[500].t + 900000);
  var raw3 = rawOf([a]); raw3[0].push({lat: LAT0, lon: LON0, t: NaN, naive: false});
  var r = finish(raw3), s = C.runStats(r.segments, null, "import");
  return r.ok && r.points === 1199 && s.distM === st0.distM && r.warnings.every(function(w){ return /^[^<>&]*$/.test(w); }) && /posição impossível/.test(r.warnings.join("|")) && /sem hora/.test(r.warnings.join("|"));
})());

// ---- reducer ao vivo: hora adiantada
function F(meters, tSec, acc, t0){ return {lat: LAT0 + meters / M_LAT, lon: LON0, acc: acc == null ? 5 : acc, t: (t0 == null ? T0 : t0) + tSec * 1000}; }
ck("136. Ao vivo: um fix que ABRE uma lacuna com +1 dia desfaz-se quando o seguinte recua; o resto da gravação não é recusado (antes: distância 291 m em vez de ~1797)", (function(){
  var st = C.runFeedInit(), i, reasons = {};
  for (i = 0; i < 600; i++) { var f = F(3 * i, i); if (i === 100) f.t = T0 + 86400000; var rr = C.runFeed(st, f); reasons[rr.reason] = (reasons[rr.reason] || 0) + 1; }
  return Math.abs(st.distM / (3 * 599) - 1) < 0.01 && st.segs.length === 1 && st.gaps === 0 && st.gapMs === 0 && st.rej.time === 1 && (reasons.time || 0) === 0 && st.maxT === T0 + 599000;
})());
ck("137. Ao vivo: o 1.º fix da corrida com a hora +1 h também se desfaz (início = o 2.º fix) e fixes recusados por precisão ou por salto NÃO avançam o máximo", (function(){
  var st = C.runFeedInit(), i;
  C.runFeed(st, F(0, 3600));
  for (i = 1; i <= 300; i++) C.runFeed(st, F(3 * i, i));
  var ok1 = st.startedAtMs === T0 + 1000 && st.segs.length === 1 && Math.abs(st.distM / (3 * 299) - 1) < 0.01;
  var st2 = C.runFeedInit(); for (i = 0; i < 300; i++) { var f2 = F(3 * i, i); if (i === 50) { f2 = F(3 * i, i + 7200, 90); } C.runFeed(st2, f2); }
  var st3 = C.runFeedInit(); for (i = 0; i < 300; i++) { var f3 = F(3 * i, i); if (i === 50) f3 = F(3 * i + 4000, i); C.runFeed(st3, f3); }
  return ok1 && st2.rej.acc === 1 && st2.rej.time === 0 && Math.abs(st2.distM / (3 * 299) - 1) < 0.01 && st3.rej.jump === 1 && st3.rej.time === 0 && st3.maxT === T0 + 299000;
})());
ck("138. Ao vivo: o fix adiantado também se desfaz se o que vem a seguir traz primeiro fixes de sinal fraco (recusados por precisão) e só depois um bom", (function(){
  var st = C.runFeedInit(), i;
  for (i = 0; i < 100; i++) C.runFeed(st, F(3 * i, i));
  C.runFeed(st, F(300, 100 + 3600));
  C.runFeed(st, F(303, 101, 80)); C.runFeed(st, F(306, 102, 80));
  for (i = 103; i < 300; i++) C.runFeed(st, F(3 * i, i));
  return st.segs.length === 1 && st.gaps === 0 && st.rej.time === 3 && st.rej.acc === 0 && Math.abs(st.distM / (3 * 297) - 1) < 0.03 && st.maxT === T0 + 299000;
})());
ck("139. Ao vivo: uma lacuna a sério (5 min sem posições) continua a abrir segmento e a contar (o desfazer só vale quando o fixe seguinte recua)", (function(){
  var st = C.runFeedInit(), i; for (i = 0; i < 60; i++) C.runFeed(st, F(3 * i, i)); for (i = 360; i < 420; i++) C.runFeed(st, F(3 * i, i));
  return st.segs.length === 2 && st.gaps === 1 && Math.abs(st.gapMs / 1000 - 301) <= 2 && st.rej.time === 0 && st.segs[1].length > 1;
})());
ck("140. Ao vivo: depois de desfazer, o estado continua válido: JSON, runFeedRestore e runStats(live) dão os mesmos totais", (function(){
  var st = C.runFeedInit(), i; for (i = 0; i < 100; i++) C.runFeed(st, F(3 * i, i)); C.runFeed(st, F(300, 100 + 7200)); for (i = 101; i < 400; i++) C.runFeed(st, F(3 * i, i));
  var back = C.runFeedRestore(JSON.parse(JSON.stringify(st))), s = C.runStats(st.segs, null, "live");
  return s.distM === Math.round(st.distM) && s.gaps === 0 && s.durationS >= 390 && s.durationS <= 399 && back && Math.round(back.distM) === Math.round(st.distM) && JSON.stringify(st).indexOf("undefined") < 0;
})());

// ---- «terminar no último ponto bom»
var forgot = (function(){ var run = C.runFeedInit(), i; for (i = 0; i <= 1800; i++) C.runFeed(run, F(3 * i, i)); C.runFeed(run, F(5400, 1800 + 5 * 3600)); C.runFeed(run, F(5400, 1800 + 5 * 3600 + 1)); return run; })();
var forgotAll = C.runStats(forgot.segs, null, "live"), forgotCut = C.runCutAtLastGap(forgot.segs, 600), forgotCutStats = C.runStats(forgotCut.segments, null, "live");
ck("141. Esqueceu-se de terminar: a lacuna de 5 h soma-se ao tempo (5:30:00); runCutAtLastGap tira-a e fica 30 min com a mesma distância; devolve cutS e cutPoints", forgotAll.durationS > 19000 && forgotCutStats.durationS >= 1790 && forgotCutStats.durationS <= 1800 && forgotCutStats.endedAtMs <= T0 + 1800000 && forgotCutStats.distM === C.runStats(forgot.segs.slice(0, 1), null, "live").distM && forgotCutStats.gaps === 0 && forgotCut.cutS > 17000 && forgotCut.cutPoints >= 1 && forgotCut.segments.length === 1);
ck("142. runCutAtLastGap: sem lacuna (ou menor que minGapS) devolve tudo numa cópia; não altera a entrada; abaixo de 24 h passa a ser guardável", (function(){
  var before = JSON.stringify(forgot.segs), none = C.runCutAtLastGap(forgot.segs, 99999), few = C.runCutAtLastGap([lineTrack(300, 3)[0]], 10), run30 = C.runFeedInit(), i;
  for (i = 0; i <= 600; i++) C.runFeed(run30, F(3 * i, i)); C.runFeed(run30, F(1800, 600 + 30 * 3600));
  var s30 = C.runStats(run30.segs, null, "live"), c30 = C.runStats(C.runCutAtLastGap(run30.segs, 600).segments, null, "live");
  function chk(sx){ return C.runCheckRun({id: ID, studentId: "ana", source: "live", startedAtMs: sx.startedAtMs, durationS: sx.durationS, movingS: sx.movingS, distM: sx.distM, gaps: sx.gaps, gapS: sx.gapS, consentV: 1}, NOW + 40 * 3600000); }
  return JSON.stringify(forgot.segs) === before && C.runCutAtLastGap(forgot.segs).cutPoints === 0 && C.runCutAtLastGap(forgot.segs, NaN).segments.length === forgot.segs.length && none.cutS === 0 && none.segments.length === forgot.segs.length && none.segments[0] !== forgot.segs[0] && few.cutPoints === 0 && C.runCutAtLastGap(null).segments.length === 0 && chk(s30).ok === false && chk(c30).ok === true;
})());
ck("143. runStats acaba sempre no último ponto (nunca soma o fim aberto até «agora»): o mesmo resultado se o segmento está aberto ou fechado, e runLiveView.elapsedS segue o relógio de parede", (function(){
  var st = C.runFeedInit(), i; for (i = 0; i < 120; i++) C.runFeed(st, F(3 * i, i));
  var open = C.runStats(st.segs, null, "live"), view = C.runLiveView(st, T0 + 7200000);
  st.open = false; var closed = C.runStats(st.segs, null, "live");
  var lastPt = st.segs[0][st.segs[0].length - 1];
  return st.segs.length === 1 && open.endedAtMs === lastPt.t && open.durationS === Math.round((lastPt.t - T0) / 1000) && open.durationS >= 110 && JSON.stringify(open) === JSON.stringify(closed) && view.elapsedS === 7200 && view.sinceGoodS === Math.round((T0 + 7200000 - st.lastGoodT) / 1000);
})());

// ---- fronteiras de Lap/Track, amostragem esparsa
function lapped(dt, laps, v){ var all = [], t = 0, m = 0; while (m < 10000) { all.push(northPt(m, t)); t += dt; m += (v || 3) * dt; } var per = Math.ceil(all.length / laps), out = [], i; for (i = 0; i < all.length; i += per) out.push(all.slice(i, i + per)); return out; }
ck("144. Importação: 10 Laps (um Track por km) dão a mesma distância e tempo que 1 só segmento (amostragem 1, 5 e 10 s); antes perdiam até -2,7 % e -90 s", [1, 5, 10].every(function(dt){
  var one = C.runStats(lapped(dt, 1), null, "import"), ten = C.runStats(lapped(dt, 10), null, "import");
  return ten.distM === one.distM && ten.durationS === one.durationS && ten.movingS === one.movingS && ten.gaps === 0 && ten.splitsS.join() === one.splitsS.join();
}) && C.runStats(lapped(1, 10), {importJoinS: 0}, "import").durationS < C.runStats(lapped(1, 1), null, "import").durationS);
ck("145. Importação: uma pausa a sério entre segmentos (340 s) continua a não contar, mesmo ligando os que seguem juntos; um intervalo > 10 s não se liga; velocidade impossível também não", (function(){
  var a = runSeg(61, 1, 3, 0), b = runSeg(61, 1, 3, 400).map(function(p, i){ return northPt(180 + 40 + 3 * i, 400 + i); });
  var s = C.runStats([a, b], null, "import");
  var c = runSeg(61, 1, 3, 0), d = runSeg(61, 1, 3, 65).map(function(p, i){ return northPt(180 + 3 + 3 * i, 65 + i); });   // 5 s depois do fim do 1.º
  var s2 = C.runStats([c, d], null, "import");
  var e = runSeg(61, 1, 3, 0), f = runSeg(61, 1, 3, 65).map(function(p, i){ return northPt(180 + 900 + 3 * i, 65 + i); });   // salta 900 m em 5 s
  return s.durationS === 120 && s2.durationS === 125 && Math.abs(s2.distM - 366) <= 12 && C.runStats([e, f], null, "import").durationS === 120;
})());
function sparse(dt, n){ var a = [], i; for (i = 0; i < n; i++) a.push(northPt(3 * dt * i, dt * i)); return [a]; }
ck("146. Importação com amostragem esparsa: a 60 s e a 61 s por ponto a distância é a mesma (≈ verdade) e não há lacunas — antes a 61 s dava 0 m; um buraco real de 100 s num ficheiro a 1 Hz continua a ser lacuna", (function(){
  var s60 = C.runStats(sparse(60, 100), null, "import"), s61 = C.runStats(sparse(61, 100), null, "import"), s120 = C.runStats(sparse(120, 60), null, "import");
  var hole = C.runStats([runSeg(61, 1, 3, 0).concat(runSeg(61, 1, 3, 160).map(function(p, i){ return northPt(180 + 250 + 3 * i, 160 + i); }))], null, "import");
  return Math.abs(s60.distM - 3 * 60 * 99) <= 20 && Math.abs(s61.distM - 3 * 61 * 99) <= 20 && s61.gaps === 0 && s60.gaps === 0 && Math.abs(s120.distM - 3 * 120 * 59) <= 20 && s120.gaps === 0 && hole.gaps === 1 && hole.gapS === 100;
})());

// ---- texto das notas
ck("147. Notas com substituto UTF-16 solto (no início, no meio, no fim ou sozinho) saem limpas e o JSON enviado nunca leva \\ud8xx solto; um par válido (emoji) fica", (function(){
  var cases = ["\uD83D", "ok \uD83D", "\uD83D ok", "a\uD83Db", "a\uDE00b", "\uDE00\uD83D", "ok 😀 fim\uD83D", "😀😀"];
  var rows = cases.map(function(nt){ return C.runBuildInsert(goodRun({notes: nt}), NOW); });
  return rows.every(function(r){ return r && !/\\u[dD][89a-fA-F]/.test(JSON.stringify(r)) && (r.notes === null || !/[\uD800-\uDFFF]/.test(r.notes.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ""))); }) && rows[0].notes === null && rows[1].notes === "ok" && rows[2].notes === "ok" && rows[3].notes === "ab" && rows[6].notes === "ok 😀 fim" && rows[7].notes === "😀😀" && C.runNormalizeRow(Object.assign({}, dbRow, {notes: "x\uD83Dy"})).notes === "xy";
})());
ck("148. Fuzz de notas com substitutos soltos misturados (2000 textos): tudo o que runBuildInsert devolve cumpre os CHECK do SQL e não leva escapes de substituto solto", (function(){
  var r = rng(91), pool = ["a", "é", " ", "\uD83D", "\uDE00", "😀", "x", "\u0000", "\n"], ok = true, i, j;
  for (i = 0; i < 2000; i++) { var nt = ""; var len = Math.floor(r() * 620); for (j = 0; j < len; j++) nt += pool[Math.floor(r() * pool.length)]; var row = C.runBuildInsert(goodRun({notes: nt}), NOW); if (!row || !dbAccepts(row, NOW) || /\\u[dD][89a-fA-F]/.test(JSON.stringify(row))) ok = false; }
  return ok;
})());

// ---- fuzz de dados hostis (nunca lança; o que sai cumpre o SQL)
ck("149. Fuzz de séries hostis (300): pontos soltos, horas adiantadas, duplicadas, NaN e laps aleatórios nunca lançam; runStats fica coerente (movingS ≤ durationS, tudo ≥ 0) e runPrepareTrack cumpre a validação do SQL", (function(){
  var r = rng(404), ok = true, made = 0, i, j, k;
  for (i = 0; i < 300; i++) {
    var segsH = [], ns = 1 + Math.floor(r() * 4), t = 0, m = 0;
    for (j = 0; j < ns; j++) {
      var sg = [], len = 1 + Math.floor(r() * 120);
      for (k = 0; k < len; k++) {
        t += 1 + Math.floor(r() * 3); m += 2 + r() * 2;
        var q = northPt(m, t), dice = r();
        if (dice < 0.04) q = northPt(m + (r() - 0.5) * 20000, t); else if (dice < 0.07) q = northPt(m, t + (r() < 0.5 ? 1 : -1) * Math.floor(r() * 1e6)); else if (dice < 0.09) q = {lat: NaN, lon: LON0, t: T0 + t * 1000, acc: null}; else if (dice < 0.1) q = null;
        sg.push(q);
      }
      segsH.push(sg); t += Math.floor(r() * 90);
    }
    try {
      var s = C.runStats(segsH, null, "import");
      if (!(s.movingS <= s.durationS && s.distM >= 0 && s.durationS >= 0 && s.skipped >= 0 && s.points >= 0)) ok = false;
      var tp = C.runPrepareTrack(segsH.map(function(sx){ return sx.filter(function(p){ return p; }); }), {trimM: [0, 100, 200][i % 3], rnd: r()});
      if (tp) { made++; if (!dbAcceptsTrack(tp.segments)) ok = false; }
    } catch (e) { ok = false; }
  }
  return ok && made > 30;
})());

check.summarize();
