// Fase 0 — página de diagnóstico de GPS (gps-teste/): isolada da app, sem rede, sem armazenamento, só recolhe depois de «Iniciar teste».
// Aprovado aqui = comportamento da página em Chromium com GPS SIMULADO. Nada disto prova o que o iPhone ou o Android fazem
// com o ecrã bloqueado: isso só se sabe com os testes em dispositivos físicos (gps-teste/LEIA-ME.md).
var fs = require("fs");
var path = require("path");
var check = require("./check")();
var root = path.join(__dirname, "..");
var dir = path.join(root, "gps-teste");
var html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
var script = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));

// ---- estático: isolamento e privacidade ----
check.check("1. A página existe numa pasta própria, com manifesto e ícones, sem tocar nos ficheiros da app", fs.existsSync(path.join(dir, "manifest.json")) && fs.existsSync(path.join(dir, "icon-192.png")) && fs.existsSync(path.join(dir, "icon-512.png")));
var manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
check.check("2. O manifesto é próprio (âmbito e início na própria pasta, modo app)", manifest.scope === "./" && manifest.start_url === "./" && manifest.display === "standalone" && !/evolve-v|index\.html/.test(manifest.start_url));
check.check("3. A política de segurança proíbe qualquer pedido de rede (connect-src 'none') e ficheiros de terceiros", /Content-Security-Policy[^>]*connect-src 'none'/.test(html) && /default-src 'none'/.test(html));
check.check("4. Sem ligações externas nem scripts ou fontes de fora", !/https?:\/\//i.test(html.replace(/<!--[\s\S]*?-->/g, "")) && !/<script[^>]+src=/i.test(html) && !/<link[^>]+href="https?:/i.test(html));
check.check("5. O código não usa rede (fetch, XMLHttpRequest, WebSocket, sendBeacon, EventSource, importScripts)", !/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|EventSource|importScripts)\b/.test(script));
check.check("6. Não guarda nada no dispositivo (localStorage, sessionStorage, IndexedDB, cookies, caches, service worker)", !/\b(localStorage|sessionStorage|indexedDB|caches|serviceWorker)\b|document\.cookie/.test(script));
check.check("7. Não fala do Supabase nem usa credenciais", !/supabase|apikey|api_key|anon|token|password/i.test(html));
check.check("8. A localização só é pedida dentro de startTest (um só watchPosition, nunca no arranque)", (script.match(/watchPosition\(/g) || []).length === 1 && script.indexOf("watchPosition(") > script.indexOf("function startTest") && !/getCurrentPosition/.test(script) && /clearWatch/.test(script));
check.check("9. Não se mexe na app de produção: o service worker, o index.html e o app.js não mencionam a página de teste", ["sw.js", "index.html", "app.js", "gestao.html", "gestao.js", "manifest.json"].every(function(f){ return !/gps-teste/.test(fs.readFileSync(path.join(root, f), "utf8")); }));

var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){
  console.log("SALTADO: sem Playwright/Chromium nesta máquina; só correu a parte estática.");
  check.summarize();
}
var startStaticServer = require("./helpers/static-server");

(async function(){
  var srv = await startStaticServer(root);
  var url = srv.url.replace(/\/?$/, "/") + "gps-teste/index.html";
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var A = {latitude: 38.7223, longitude: -9.1393, accuracy: 8};
  // instrumentação: conta chamadas à API de localização
  var INSTR = "window.__geo = {watch: 0, clear: 0, current: 0}; (function(){ var g = navigator.geolocation, w = g.watchPosition.bind(g), c = g.clearWatch.bind(g), cur = g.getCurrentPosition.bind(g); " +
    "g.watchPosition = function(){ window.__geo.watch++; return w.apply(null, arguments); }; g.clearWatch = function(i){ window.__geo.clear++; return c(i); }; g.getCurrentPosition = function(){ window.__geo.current++; return cur.apply(null, arguments); }; })();";
  async function ctxWith(opts){ var ctx = await browser.newContext(Object.assign({viewport: {width: 390, height: 844}}, opts || {})); await ctx.addInitScript(INSTR); return ctx; }
  async function waitCount(pg, n){ await pg.waitForFunction(function(k){ return window.GPSTESTE.events().filter(function(e){ return e.tipo === "posicao"; }).length >= k; }, n, {timeout: 6000}); }
  async function move(ctx, i){ await ctx.setGeolocation({latitude: A.latitude + i * 0.0001, longitude: A.longitude, accuracy: 8}); }

  // ---- 1. nada acontece antes do clique; iniciar → watchPosition; mexer → posições ----
  var errors = [], requests = [];
  var ctx = await ctxWith({geolocation: A, permissions: ["geolocation"]});
  var pg = await ctx.newPage(); pg.on("pageerror", function(e){ errors.push(e.message); });
  await pg.goto(url);
  var g0 = await pg.evaluate(function(){ return window.__geo; });
  check.check("10. Ao abrir a página não se pede nem se lê a localização", g0.watch === 0 && g0.current === 0 && (await pg.locator("#banner").innerText()).indexOf("parado") >= 0 && (await pg.locator("#bStop").isDisabled()));
  srv.server.prependListener("request", function(req){ requests.push(req.method + " " + req.url); });   // o que chega mesmo ao servidor depois de a página abrir
  await pg.fill("#fModelo", "Telemóvel de teste"); await pg.fill("#fSO", "Android 14"); await pg.fill("#fNav", "Chrome"); await pg.selectOption("#fModo", {index: 1}); await pg.fill("#fNotas", "simulação");
  await pg.click("#bStart");
  await waitCount(pg, 1);
  var g1 = await pg.evaluate(function(){ return window.__geo; });
  check.check("11. «Iniciar teste» faz um único watchPosition e mostra a recolha ativa", g1.watch === 1 && /RECOLHER/.test(await pg.locator("#banner").innerText()) && !(await pg.locator("#bStop").isDisabled()));
  for (var i = 1; i <= 5; i++){ await move(ctx, i); await waitCount(pg, i + 1); }
  var ev = await pg.evaluate(function(){ return window.GPSTESTE.events(); });
  var pos = ev.filter(function(e){ return e.tipo === "posicao"; });
  check.check("12. Cada posição regista coordenadas, precisão, timestamp do dispositivo, hora de receção e intervalo", pos.length >= 6 && pos.every(function(p){ return typeof p.lat === "number" && typeof p.lon === "number" && p.precisao_m > 0 && p.timestamp_posicao_ms > 0 && p.t_ms > 0; }) && pos.slice(1).every(function(p){ return p.intervalo_ms >= 0; }));
  var d = await pg.evaluate(function(){ return window.GPSTESTE.haversine({lat: 0, lon: 0}, {lat: 0, lon: 1}); });
  check.check("13. A distância (só diagnóstico) usa Haversine: 1° de longitude no equador ≈ 111,19 km", Math.abs(d - 111195) < 200);
  var dist = await pg.evaluate(function(){ return window.GPSTESTE.summarize().distancia_aproximada_m; });
  check.check("14. 5 passos de 0,0001° de latitude ≈ 55 m de distância aproximada", dist > 45 && dist < 65);

  // ---- 2. visibilidade (SIMULADA) ----
  await pg.evaluate(function(){ Object.defineProperty(document, "visibilityState", {configurable: true, get: function(){ return window.__vis || "visible"; }}); window.__vis = "hidden"; document.dispatchEvent(new Event("visibilitychange")); });
  await move(ctx, 6); await waitCount(pg, 7);
  await pg.waitForTimeout(300);
  await pg.evaluate(function(){ window.__vis = "visible"; document.dispatchEvent(new Event("visibilitychange")); });
  var sm = await pg.evaluate(function(){ return window.GPSTESTE.summarize(); });
  var tipos = (await pg.evaluate(function(){ return window.GPSTESTE.events().map(function(e){ return e.tipo; }); }));
  check.check("15. (simulado) A passagem a segundo plano e o regresso ficam registados, e as posições recebidas com a página oculta são contadas à parte", tipos.indexOf("pagina_oculta") >= 0 && tipos.indexOf("pagina_visivel") >= 0 && sm.posicoes_com_pagina_oculta >= 1 && sm.posicoes_com_pagina_visivel >= 6 && sm.tempo_pagina_oculta_s >= 0);

  // ---- 3. sem rede: o GPS continua e a página não faz pedidos ----
  await ctx.setOffline(true);
  await move(ctx, 7); await waitCount(pg, 8);
  var redeEv = await pg.evaluate(function(){ return window.GPSTESTE.events().filter(function(e){ return e.tipo === "rede"; }).map(function(e){ return e.detalhe; }); });
  check.check("16. (simulado) Sem ligação à internet as posições continuam a chegar e o estado da rede fica registado", redeEv.some(function(t){ return /sem ligação/.test(t); }) && (await pg.evaluate(function(){ return window.GPSTESTE.events().filter(function(e){ return e.tipo === "posicao"; }).length; })) >= 8);
  await ctx.setOffline(false);
  var antes = requests.length;
  var net = await pg.evaluate(function(){ return Promise.all([
    fetch("/pedido-fetch").then(function(){ return "ok"; }, function(){ return "bloqueado"; }),
    new Promise(function(res){ try { var x = new XMLHttpRequest(); x.open("GET", "/pedido-xhr"); x.onerror = function(){ res("bloqueado"); }; x.onload = function(){ res("ok"); }; x.send(); } catch (e) { res("bloqueado"); } })
  ]).then(function(r){ try { navigator.sendBeacon("/pedido-beacon", "x"); } catch (e) {} return r; }); });
  await pg.waitForTimeout(500);
  check.check("17. No Chromium real, a política de segurança bloqueia fetch e XHR, e nenhum pedido (nem sendBeacon, que aceita o pedido mas o navegador descarta) chega ao servidor: a página não consegue enviar coordenadas", net.join() === "bloqueado,bloqueado" && requests.length === antes);
  check.check("18. Depois de abrir a página e iniciar o teste, a página não fez nenhum pedido de rede", antes === 0);

  // ---- 4. parar: liberta o GPS e deixa de recolher ----
  await pg.click("#bStop");
  var g2 = await pg.evaluate(function(){ return window.__geo; });
  var before = await pg.evaluate(function(){ return window.GPSTESTE.events().length; });
  await move(ctx, 8); await pg.waitForTimeout(700);
  var after = await pg.evaluate(function(){ return window.GPSTESTE.events().length; });
  check.check("19. «Parar teste» liberta o watchPosition e deixa de registar posições", g2.clear === 1 && after === before && !(await pg.evaluate(function(){ return window.GPSTESTE.running(); })) && /parado/.test(await pg.locator("#banner").innerText()));

  // ---- 5. exportar ----
  var exp = await pg.evaluate(function(){ return window.GPSTESTE.exportObj(); });
  check.check("20. A exportação leva o que o utilizador escreveu, o resumo, as observações e todos os eventos", exp.dispositivo_indicado_pelo_utilizador.modelo === "Telemóvel de teste" && exp.dispositivo_indicado_pelo_utilizador.sistema === "Android 14" && exp.dispositivo_indicado_pelo_utilizador.notas === "simulação" && exp.eventos.length === before && exp.resumo.posicoes_total >= 8 && Array.isArray(exp.observacoes) && /Registos incompletos não provam/.test(exp.aviso));
  var csv = await pg.evaluate(function(){ return window.GPSTESTE.csv(); });
  var lines = csv.split("\n");
  check.check("21. O CSV tem cabeçalho e uma linha por evento", /^n,t_iso,t_ms,tipo,pagina,lat,lon,precisao_m/.test(lines[0]) && lines.length === exp.eventos.length + 1);
  var dl = await Promise.all([pg.waitForEvent("download"), (async function(){ await pg.click("#bExport"); await pg.click("#bJson"); })()]);
  check.check("22. «Guardar JSON» descarrega um ficheiro gps-teste-*.json", /^gps-teste-\d{8}-\d{4}\.json$/.test(dl[0].suggestedFilename()));
  var stor = await pg.evaluate(async function(){ var dbs = indexedDB.databases ? await indexedDB.databases() : []; return {ls: localStorage.length, ss: sessionStorage.length, db: dbs.length, ck: document.cookie}; });
  check.check("23. Nada ficou guardado no dispositivo (localStorage, sessionStorage, IndexedDB, cookies)", stor.ls === 0 && stor.ss === 0 && stor.db === 0 && stor.ck === "");
  await ctx.close();

  // ---- 6. permissão recusada ----
  var ctxD = await ctxWith({geolocation: undefined, permissions: []});
  var pd = await ctxD.newPage(); await pd.goto(url);
  await pd.click("#bStart");
  await pd.waitForFunction(function(){ return window.GPSTESTE.events().some(function(e){ return e.tipo === "erro_gps"; }); }, null, {timeout: 6000});
  var ed = await pd.evaluate(function(){ return window.GPSTESTE.events().filter(function(e){ return e.tipo === "erro_gps"; })[0]; });
  check.check("24. Permissão recusada: mostra o erro em português, para o teste e liberta o GPS", ed.codigo === 1 && /recusada/.test(await pd.locator("#banner").innerText()) && !(await pd.evaluate(function(){ return window.GPSTESTE.running(); })) && (await pd.evaluate(function(){ return window.__geo.clear; })) === 1);
  await ctxD.close();

  // ---- 7. suspensão da página e lacunas (relógio SIMULADO) ----
  var ctxC = await ctxWith({geolocation: A, permissions: ["geolocation"]});
  var pc = await ctxC.newPage();
  await pc.clock.install({time: new Date("2026-06-01T10:00:00Z")});
  await pc.goto(url);
  await pc.click("#bStart");
  await pc.clock.runFor(3000);
  await ctxC.setGeolocation({latitude: A.latitude + 0.0001, longitude: A.longitude, accuracy: 8});
  await pc.waitForFunction(function(){ return window.GPSTESTE.events().some(function(e){ return e.tipo === "posicao"; }); }, null, {timeout: 6000});
  await pc.clock.fastForward(60000);   // a página «adormece» 60 s: o relógio dela salta
  await ctxC.setGeolocation({latitude: A.latitude + 0.0002, longitude: A.longitude, accuracy: 8});
  await pc.waitForFunction(function(){ return window.GPSTESTE.events().filter(function(e){ return e.tipo === "posicao"; }).length >= 2; }, null, {timeout: 6000});
  var tc = await pc.evaluate(function(){ return {tipos: window.GPSTESTE.events().map(function(e){ return e.tipo; }), s: window.GPSTESTE.summarize(), lac: window.GPSTESTE.events().filter(function(e){ return e.tipo === "lacuna_gps"; })[0]}; });
  check.check("25. (simulado) Um salto de 60 s no relógio da página regista o atraso do relógio e a lacuna entre posições, sem tirar conclusões", tc.tipos.indexOf("atraso_do_relogio_da_pagina") >= 0 && tc.tipos.indexOf("lacuna_gps") >= 0 && tc.lac.lacuna_s >= 55 && tc.s.atrasos_do_relogio_da_pagina >= 1 && tc.s.lacunas_gps_mais_de_15s.length === 1);
  await ctxC.close();

  // ---- 8. precisão e HTTPS ----
  var ctxP = await ctxWith({geolocation: {latitude: A.latitude, longitude: A.longitude, accuracy: 10}, permissions: ["geolocation"]});
  var pp = await ctxP.newPage(); await pp.goto(url); await pp.click("#bStart");
  for (var k = 0; k < 6; k++){ await ctxP.setGeolocation({latitude: A.latitude + k * 0.00005, longitude: A.longitude, accuracy: 10}); await waitCount(pp, k + 1); }
  await ctxP.setGeolocation({latitude: A.latitude + 0.001, longitude: A.longitude, accuracy: 120});
  await waitCount(pp, 7);
  var tp = await pp.evaluate(function(){ return window.GPSTESTE.events().map(function(e){ return e.tipo; }); });
  check.check("26. Uma piora grande da precisão (10 m → 120 m) fica registada", tp.indexOf("precisao_piorou") >= 0);
  await ctxP.close();

  check.check("27. Nenhum erro de JavaScript na página", errors.length === 0);
  if (errors.length) console.log(errors.slice(0, 3));
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e.message.split("\n")[0]); process.exit(1); });
