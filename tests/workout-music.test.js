// Música no treino: três botões (Spotify, Apple Music, YouTube Music) que abrem a app de música; a EVOLVE não guarda nada.
// Parte 1 (Node): o HTML. Parte 2 (Chromium com Supabase simulado): o ecrã de treino.
// A reprodução e a continuidade da música ao sair da app dependem do iPhone/Android e da app de música: só se vê em dispositivo real.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();


var html = playlistRowHtml();
check.check("1. Há exatamente três botões: Spotify, Apple Music e YouTube Music", (html.match(/<a /g) || []).length === 3 && /Spotify/.test(html) && /Apple Music/.test(html) && /YouTube Music/.test(html));
check.check("2. Cada botão é um link https para o serviço certo, noutro separador e sem referência à EVOLVE", MUSIC_APPS.every(function(m){ return /^https:\/\/(open\.spotify\.com|music\.apple\.com|music\.youtube\.com)\/$/.test(m.url); }) && (html.match(/target="_blank"/g) || []).length === 3 && (html.match(/rel="noopener noreferrer"/g) || []).length === 3);
check.check("3. Sem endereços próprios de app (ficariam mortos se a app não existir) nem javascript:", !/href="(spotify|music|youtubemusic|javascript):/.test(html));
var src = appSource.slice(appSource.indexOf("Música no treino: botões"), appSource.indexOf("function shopStoreKey"));
check.check("4. O código da música não faz pedidos, não guarda nada, não incorpora leitores e não usa o Supabase", !/\b(fetch|XMLHttpRequest|sendBeacon|iframe|<audio|<video|new Audio|localStorage|sb\.)\b/.test(src));

// ---- ecrã (Chromium) ----
var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var fs = require("fs"), path = require("path");
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){ console.log("(ignorado o ecrã: Playwright/Chromium não disponíveis aqui)"); check.summarize(); }
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");
(async function(){
  authRole = "professional";
  var s = buildFullDemoStudent(); s.id = "ana"; s.name = "Ana Treina"; s.isDemo = false; s.active = true; s.photos = []; s.nutritionPhase = null;
  var row = JSON.parse(JSON.stringify(studentToRow(s)));
  var srv = await startStaticServer(path.join(__dirname, ".."));
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  var ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx.addInitScript(fakeSource({role: "student", userId: "user-ana", email: "ana@x.test", rows: [row]}));
  var pg = await ctx.newPage(); pg.setDefaultTimeout(6000); pg.on("pageerror", function(e){ errors.push(e.message); });
  var reqs = []; pg.on("request", function(r){ reqs.push(r.url()); });
  await pg.goto(srv.url + "treino.html");
  await pg.waitForSelector("#startWorkout, [data-start-day]");
  await pg.locator("#startWorkout, [data-start-day]").first().click();
  await pg.waitForSelector(".wl-music summary");
  check.check("4b. A música está recolhida por omissão (não ocupa espaço antes do treino)", (await pg.locator(".wl-music").evaluate(function(d){ return !d.open; })));
  await pg.click(".wl-music summary");
  await pg.waitForSelector("[data-music]");
  var links = await pg.evaluate(function(){ return Array.prototype.map.call(document.querySelectorAll("[data-music]"), function(e){ return {id: e.getAttribute("data-music"), href: e.href, target: e.target, rel: e.rel, text: e.textContent.trim(), h: e.getBoundingClientRect().height}; }); });
  check.check("5. O ecrã de treino mostra os três botões com o link certo", links.length === 3 && links[0].href === "https://open.spotify.com/" && links[1].href === "https://music.apple.com/" && links[2].href === "https://music.youtube.com/" && links.every(function(l){ return l.target === "_blank" && /noopener/.test(l.rel); }));
  check.check("6. Os botões são fáceis de tocar (44 px) e cabem no ecrã", links.every(function(l){ return l.h >= 44; }) && (await pg.evaluate(function(){ return document.documentElement.scrollWidth <= window.innerWidth; })));
  check.check("7. Fica avisado de que a música toca na app de música e o treino fica guardado", /podes sair da EVOLVE/.test(await pg.locator(".aluno-tabs").innerText()));
  check.check("8. Não guarda nada no telemóvel (sem chaves de música)", (await pg.evaluate(function(){ return Object.keys(localStorage).filter(function(k){ return /playlist|music/i.test(k); }).length; })) === 0);
  await pg.evaluate(function(){ document.querySelectorAll("[data-music]").forEach(function(a){ a.addEventListener("click", function(e){ e.preventDefault(); }); }); });
  await pg.locator("[data-music]").first().click();
  var external = reqs.filter(function(u){ return /spotify|apple|youtube/.test(u); });
  check.check("9. A EVOLVE nunca contacta os serviços de música", external.length === 0);
  check.check("10. Nenhum erro de JavaScript", errors.length === 0);
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e.message.split("\n")[0]); process.exit(1); });
