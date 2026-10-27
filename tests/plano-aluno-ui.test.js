// Plano (alimentação) do aluno: cada grupo de uma refeição mostra a opção escolhida e «Trocar»; as alternativas só aparecem ao tocar.
// O que não se vê aqui: o aspeto num telemóvel real.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var fs = require("fs"), path = require("path");

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
  await pg.waitForSelector('.tabbar [data-tab="plano"]');
  await pg.click('.tabbar [data-tab="plano"]');
  await pg.waitForSelector(".plano-meal-card");
  var m = await pg.evaluate(function(){ return {h: document.documentElement.scrollHeight, picks: document.querySelectorAll(".builder-group.pick").length, opts: document.querySelectorAll(".builder-opt").length, over: document.documentElement.scrollWidth > window.innerWidth}; });
  check.check("1. Por omissão cada grupo está recolhido (opção escolhida + «Trocar») e não há listas de alternativas abertas", m.picks >= 5 && m.opts === 0);
  check.check("2. A página do Plano ficou curta (< 3200 px; antes cerca de 7200) e sem scroll horizontal", m.h < 3200 && !m.over);
  var firstTxt = await pg.locator(".pick-name").first().innerText();
  await pg.locator("[data-open-group]").first().click();
  await pg.waitForSelector(".builder-opt");
  var opened = await pg.evaluate(function(){ return {opts: document.querySelectorAll(".builder-opt").length, sel: document.querySelectorAll(".builder-opt.sel").length, picks: document.querySelectorAll(".builder-group.pick").length}; });
  check.check("3. «Trocar» abre só esse grupo: mostra as opções (com a escolhida marcada) e os outros ficam recolhidos", opened.opts >= 2 && opened.sel === 1 && opened.picks >= 4);
  var other = pg.locator(".builder-opt:not(.sel)").first();
  var otherName = (await other.innerText()).replace(/\s+/g, " ").trim();
  await other.click();
  await pg.waitForSelector(".builder-group.pick");
  var after = await pg.evaluate(function(){ return {opts: document.querySelectorAll(".builder-opt").length, firstPick: document.querySelector(".pick-name").innerText.replace(/\s+/g, " ").trim()}; });
  check.check("4. Escolher uma opção troca-a e o grupo volta a recolher, a mostrar a nova escolha", after.opts === 0 && after.firstPick.replace(/\s*\(.*$/, "") === otherName.replace(/\s*\(.*$/, "") && after.firstPick !== firstTxt.replace(/\s+/g, " ").trim());
  var tap = await pg.locator("[data-open-group]").first().evaluate(function(b){ return b.getBoundingClientRect().height; });
  check.check("5. O botão «Trocar» é fácil de tocar (≥ 40 px)", tap >= 40);
  check.check("6. Sem erros de JavaScript", errors.length === 0);
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção " + (e && e.message)); process.exit(1); });
