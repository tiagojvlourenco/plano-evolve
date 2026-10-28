// Terminar o treino com séries por marcar: pergunta primeiro (um treino guardado só o profissional o apaga); com todas marcadas não pergunta.
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
  var st = buildFullDemoStudent(); st.id = "ana"; st.name = "Ana"; st.isDemo = false; st.active = true; st.photos = []; st.nutritionPhase = null;
  var row = JSON.parse(JSON.stringify(studentToRow(st)));
  var srv = await startStaticServer(path.join(__dirname, ".."));
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  async function open(){
    var ctx = await browser.newContext({viewport: {width: 390, height: 844}});
    await ctx.addInitScript(fakeSource({role: "student", userId: "user-ana", email: "ana@x.test", rows: [row]}));
    var pg = await ctx.newPage(); pg.setDefaultTimeout(6000); pg.on("pageerror", function(e){ errors.push(e.message); });
    await pg.goto(srv.url + "treino.html");
    await pg.waitForSelector("#startWorkout, [data-start-day]");
    await pg.locator("#startWorkout, [data-start-day]").first().click();
    await pg.waitForSelector(".wl-set");
    return {ctx: ctx, pg: pg};
  }
  var saved = function(pg){ return pg.evaluate(function(){ return window.__fake.writes.filter(function(w){ return (w.cols || []).indexOf("workout_logs") >= 0; }).length; }); };
  var tick = function(pg, n){ return pg.evaluate(function(n){ var b = document.querySelectorAll("[data-wl-done]"); for (var i = 0; i < n && i < b.length; i++){ b[i].click(); } }, n); };

  var A = await open();
  var total = await A.pg.locator("[data-wl-done]").count();
  await tick(A.pg, 2);
  await A.pg.click("#wlSave");
  await A.pg.waitForSelector("#wlFinishYes");
  var msg = await A.pg.locator("#modalRoot").innerText();
  check.check("1. Com séries por marcar pergunta antes de guardar e diz quantas (2 de " + total + ") e que só o profissional o pode apagar", new RegExp("2 de " + total).test(msg) && /só o teu profissional/.test(msg) && (await saved(A.pg)) === 0);
  await A.pg.click("#wlFinishNo");
  await A.pg.waitForTimeout(300);
  check.check("2. «Continuar a treinar» fecha a pergunta, não guarda nada e mantém as séries marcadas", (await saved(A.pg)) === 0 && (await A.pg.locator("[data-wl-done]:checked").count()) === 2 && (await A.pg.locator(".wl-set").count()) === total);
  await A.pg.click("#wlSave"); await A.pg.waitForSelector("#wlFinishYes"); await A.pg.click("#wlFinishYes");
  await A.pg.waitForTimeout(800);
  check.check("3. «Terminar mesmo assim» guarda o treino (uma gravação) e volta ao Hoje", (await saved(A.pg)) === 1 && (await A.pg.locator("#startWorkout").count()) >= 0 && /Feito|Treino feito|Registar outro/i.test(await A.pg.locator("#alunoTabContent").innerText()));
  await A.ctx.close();

  var B = await open();
  await tick(B.pg, 999);
  await B.pg.click("#wlSave");
  await B.pg.waitForTimeout(800);
  check.check("4. Com todas as séries marcadas guarda logo, sem perguntar", (await B.pg.locator("#wlFinishYes").count()) === 0 && (await saved(B.pg)) === 1);
  await B.ctx.close();

  var C = await open();
  await C.pg.click("#wlSave");
  await C.pg.waitForTimeout(300);
  check.check("5. Sem nenhuma série marcada não pergunta: avisa que falta marcar pelo menos uma", (await C.pg.locator("#wlFinishYes").count()) === 0 && /pelo menos uma série/.test(await C.pg.locator("#wlError").innerText()));
  await C.ctx.close();
  check.check("6. Sem erros de JavaScript", errors.length === 0);
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção " + (e && e.stack)); process.exit(1); });
