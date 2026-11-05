// As tabelas de alimentos (FOOD_GROUPS e FOOD_DB, ~200 KB) vivem em alimentos.js: index.html e gestao.html carregam-no antes do app.js,
// treino.html não (o EVOLVE Treino não as usa) e o app.js fica com as duas tabelas vazias nesse caso.
// O que não se vê aqui: o ganho de tempo num telemóvel real (só se mede em iPhone/Android com rede móvel).
var fs = require("fs"), path = require("path");
var check = require("./check")();
var root = path.join(__dirname, "..");
function read(f){ return fs.readFileSync(path.join(root, f), "utf8"); }
var idx = read("index.html"), ges = read("gestao.html"), tre = read("treino.html"), sw = read("sw.js"), app = read("app.js"), food = read("alimentos.js");
var tag = '<script src="alimentos.js"></script>\n<script src="app.js"></script>';

check.check("1. index.html e gestao.html carregam alimentos.js mesmo antes do app.js; treino.html não o carrega", idx.indexOf(tag) > 0 && ges.indexOf(tag) > 0 && !/alimentos\.js/.test(tre));
check.check("2. O app.js já não traz as tabelas (menos de 950 KB) e alimentos.js tem mais de 190 KB", Buffer.byteLength(app) < 950000 && Buffer.byteLength(food) > 190000 && !/\{name:"Pão de forma 100% integral \(Mercadona\)"/.test(app) && !/"Wasabi, raiz crua"/.test(app));
check.check("3. O service worker pré-guarda alimentos.js (as apps com alimentação abrem sem rede) e serve-o com rede primeiro", /"alimentos\.js"/.test(sw.slice(sw.indexOf("var SHELL = ["), sw.indexOf("];", sw.indexOf("var SHELL = [")))) && /alimentos\|app/.test(sw));
check.check("4. alimentos.js é autónomo (não depende de nada do app.js) e expõe só window.EVOLVE_FOOD", /window\.EVOLVE_FOOD = \{groups: FOOD_GROUPS, db: FOOD_DB\};/.test(food) && (function(){ var w = {}; try { new Function("window", food)(w); } catch (e) { return false; } return Object.keys(w).join() === "EVOLVE_FOOD" && Object.keys(w.EVOLVE_FOOD.db).length > 1000 && Object.keys(w.EVOLVE_FOOD.groups).length >= 8; })());
check.check("5. No app.js as tabelas leem window.EVOLVE_FOOD e, sem ele, ficam vazias (sem rebentar)", /var FOOD_GROUPS = \(typeof window !== "undefined" && window\.EVOLVE_FOOD && window\.EVOLVE_FOOD\.groups\) \|\| \{\};/.test(app) && /var FOOD_DB = \(typeof window !== "undefined" && window\.EVOLVE_FOOD && window\.EVOLVE_FOOD\.db\) \|\| \{\};/.test(app));

// ---- Chromium ----
var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){ console.log("(ignorado o ecrã: Playwright/Chromium não disponíveis aqui)"); check.summarize(); }
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");
function rowAna(){
  authRole = "professional";
  var s = buildFullDemoStudent(); s.id = "ana"; s.name = "Ana Treina"; s.isDemo = false; s.active = true; s.photos = []; s.nutritionPhase = null;
  return JSON.parse(JSON.stringify(studentToRow(s)));
}
(async function(){
  var srv = await startStaticServer(root);
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  async function open(page){
    var ctx = await browser.newContext({viewport: {width: 390, height: 844}});
    await ctx.addInitScript(fakeSource({role: "student", userId: "user-ana", email: "ana@x.test", rows: [rowAna()]}));
    var pg = await ctx.newPage(); pg.setDefaultTimeout(6000); pg.on("pageerror", function(e){ errors.push(page + ": " + e.message); });
    var asked = []; pg.on("request", function(r){ asked.push(r.url()); });
    await pg.goto(srv.url + page);
    return {ctx: ctx, pg: pg, asked: asked};
  }
  var T = await open("treino.html");
  await T.pg.waitForSelector("#startWorkout, [data-start-day]");
  await T.pg.locator("#startWorkout, [data-start-day]").first().click();
  await T.pg.waitForSelector(".wl-set");
  check.check("6. O EVOLVE Treino não pede alimentos.js e o treino abre e regista séries na mesma", !T.asked.some(function(u){ return /alimentos\.js/.test(u); }) && (await T.pg.evaluate(function(){ return typeof window.EVOLVE_FOOD; })) === "undefined" && (await T.pg.locator(".wl-set").count()) > 0);
  await T.pg.locator('[data-tab="corrida"]').first().click();
  await T.pg.waitForTimeout(300);
  check.check("7. O separador Cardio abre no EVOLVE Treino sem as tabelas de alimentos", (await T.pg.locator("#alunoApp").count()) === 1);
  await T.ctx.close();

  var A = await open("index.html");
  await A.pg.waitForSelector('[data-tab="plano"]');
  var n = await A.pg.evaluate(function(){ return window.EVOLVE_FOOD ? Object.keys(window.EVOLVE_FOOD.db).length : 0; });
  check.check("8. A app EVOLVE (alimentação) carrega alimentos.js e tem a base completa (" + n + " alimentos)", A.asked.some(function(u){ return /alimentos\.js/.test(u); }) && n > 1000);
  await A.pg.locator('[data-tab="plano"]').first().click();
  await A.pg.waitForTimeout(400);
  var planTxt = await A.pg.locator("#alunoApp").innerText();
  check.check("9. O separador Plano continua a mostrar refeições com alimentos e quantidades", /Pequeno-almoço/.test(planTxt) && /\d+\s?(g|ml)/.test(planTxt));
  await A.ctx.close();

  check.check("10. Sem erros de JavaScript em nenhuma das duas apps" + (errors.length ? " — " + errors.join(" | ") : ""), errors.length === 0);
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção " + (e && e.message)); process.exit(1); });
