// Ecrã «Hoje» da app EVOLVE Treino (redesenho): descanso numa só linha, treinos com nome que abre os exercícios, atalho claro para a app EVOLVE.
// Parte 1 (Node): o HTML. Parte 2 (Chromium com Supabase simulado): o toque em «Iniciar» não abre a lista e o toque no nome abre-a.
// O que não se vê aqui: o aspeto num telemóvel real.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var fs = require("fs"), path = require("path");

function mk(extra){ var s = buildFullDemoStudent(); s.id = "n1"; s.name = "Nuno"; s.isDemo = false; s.active = true; s.photos = []; s.nutritionPhase = null; return Object.assign(s, extra || {}); }
var today = new Date().getDay(), other = [0, 1, 2, 3, 4, 5, 6].filter(function(d){ return d !== today; });
var rest = tplTodayWorkout(mk({trainingDays: other.slice(0, 3)}));
check.check("1. Dia de descanso: cartão curto («Hoje · descanso», próximo treino, botão) sem o título grande «Dia de descanso»", /Hoje · descanso/.test(rest) && /Próximo treino/.test(rest) && !/tw-name/.test(rest) && /id="startWorkout"/.test(rest) && /Treinar mesmo assim/.test(rest));
var prog = tplTrainingProgramCard(mk());
check.check("2. Cada treino é um bloco que abre os exercícios ao tocar no nome (sem a linha extra «Ver exercícios») e tem o botão Iniciar", !/Ver exercícios/.test(prog) && (prog.match(/<details class="prog-day">/g) || []).length >= 2 && /<summary class="pd-row">/.test(prog) && /data-start-day=/.test(prog) && /data-ex-info=/.test(prog));
var home = tplTreinoHome(mk());
check.check("3. O atalho para a app EVOLVE é um cartão com texto e botão «Abrir» (não um link sublinhado perdido)", /class="card evolve-link"/.test(home) && /id="goEvolveApp"/.test(home) && /href="index\.html"/.test(home) && /Abrir/.test(home));

var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){ console.log("(ignorado o ecrã: Playwright/Chromium não disponíveis aqui)"); check.summarize(); }
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");
(async function(){
  authRole = "professional";
  var s = mk({id: "ana", name: "Ana Treina"});
  var row = JSON.parse(JSON.stringify(studentToRow(s)));
  var srv = await startStaticServer(path.join(__dirname, ".."));
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  var ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx.addInitScript(fakeSource({role: "student", userId: "user-ana", email: "ana@x.test", rows: [row]}));
  var pg = await ctx.newPage(); pg.setDefaultTimeout(6000); pg.on("pageerror", function(e){ errors.push(e.message); });
  await pg.goto(srv.url + "treino.html");
  await pg.waitForSelector(".prog-day");
  var closed = await pg.locator(".prog-day").first().evaluate(function(d){ return !d.open; });
  await pg.locator(".prog-day .pd-name").first().click();
  var opened = await pg.locator(".prog-day").first().evaluate(function(d){ return d.open; });
  check.check("4. Os exercícios estão recolhidos e abrem ao tocar no nome do treino", closed && opened);
  var h = await pg.locator(".prog-day [data-start-day]").first().evaluate(function(b){ return b.getBoundingClientRect().height; });
  check.check("5. O botão «Iniciar» é fácil de tocar (≥ 40 px)", h >= 40);
  await pg.locator(".prog-day [data-start-day]").nth(1).click();
  await pg.waitForSelector(".wl-set");
  check.check("6. Tocar em «Iniciar» abre o registo do treino (não só abre ou fecha a lista)", (await pg.locator(".wl-ex").count()) >= 1);
  check.check("7. Sem erros de JavaScript", errors.length === 0);
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção " + (e && e.message)); process.exit(1); });
