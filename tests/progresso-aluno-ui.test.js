// Progresso do aluno: números do peso numa só linha, tabela com indicação de que desliza, «Antes vs Depois» sem quadrados vazios quando não há fotografias.
// O que não se vê aqui: o aspeto num telemóvel real.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var fs = require("fs"), path = require("path");

// ---- Node ----
var sNo = buildFullDemoStudent(); sNo.photos = [];
var sYes = buildFullDemoStudent(); sYes.photos = [{id: "p1", date: "2026-10-20", pos: "frente", url: "x"}];
var hNo = tplPhotoCompare(sNo), hYes = tplPhotoCompare(sYes);
check.check("1. Sem fotografias a grelha do «Antes vs Depois» fica escondida e o texto explica que é só peso e medições; com fotografias aparece",
  /id="compareGrid" hidden/.test(hNo) && /As fotografias aparecem aqui/.test(hNo) && !/id="compareGrid" hidden/.test(hYes) && /lado a lado/.test(hYes));

var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
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
  await pg.goto(srv.url + "index.html");
  await pg.waitForSelector('.tabbar [data-tab="evolucao"]');
  await pg.click('.tabbar [data-tab="evolucao"]');
  await pg.waitForSelector(".stat-grid-4");
  await pg.waitForTimeout(500);
  var m = await pg.evaluate(function(){
    var vs = Array.prototype.map.call(document.querySelectorAll(".stat-grid-4 .stat-tile .v"), function(v){ return v.getBoundingClientRect().height; });
    var sc = document.querySelector(".assess-table-scroll");
    var grid = document.getElementById("compareGrid");
    return {vs: vs, bg: sc ? getComputedStyle(sc).backgroundImage : "", gridShown: grid ? grid.getBoundingClientRect().height > 0 : null, over: document.documentElement.scrollWidth > window.innerWidth};
  });
  check.check("2. Os 4 números do peso (inicial, atual, objetivo, diferença) cabem numa linha cada (altura < 30 px)", m.vs.length === 4 && m.vs.every(function(h){ return h < 30; }));
  check.check("3. As tabelas que deslizam têm sombras nas pontas (gradientes de fundo) e a página não tem scroll horizontal", /gradient/.test(m.bg) && !m.over);
  check.check("4. Sem fotografias, a grelha de quadrados «Sem foto» não ocupa espaço", m.gridShown === false);
  check.check("5. Sem erros de JavaScript", errors.length === 0);
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção " + (e && e.message)); process.exit(1); });
