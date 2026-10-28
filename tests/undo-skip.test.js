// Refeição ignorada ou reagendada por engano: dá para voltar a incluí-la / repor o horário; concluir uma ignorada volta a contá-la.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var fs = require("fs"), path = require("path");

function mk(){ var s = buildFullDemoStudent(); s.id = "k1"; s.isDemo = false; s.adaptationHistory = []; return s; }
var s = mk(), m = s.meals[1];
skipMeal(s, m, "");
var other = s.meals[2]; skipMeal(s, other, "");
check.check("1. Ignorar põe o estado «skipped» e regista a ocorrência de hoje", m.status === "skipped" && s.adaptationHistory.length === 2);
unskipMeal(s, m);
check.check("2. «Voltar a incluir» repõe o estado «planned» e tira só o registo dessa refeição; a outra continua ignorada", m.status === "planned" && s.adaptationHistory.length === 1 && s.adaptationHistory[0].meal === other.name && other.status === "skipped");
var s2 = mk(), m2 = s2.meals[0];
rescheduleMeal(s2, m2, "09:00");
check.check("3. Reagendar guarda a hora nova e o estado «rescheduled»", m2.rescheduledTime === "09:00" && m2.status === "rescheduled");
unrescheduleMeal(s2, m2);
check.check("4. «Repor o horário original» limpa a hora nova, volta a «planned» e tira o registo de hoje", m2.rescheduledTime === null && m2.status === "planned" && s2.adaptationHistory.length === 0);
var s3 = mk(), m3 = s3.meals[0]; rescheduleMeal(s3, m3, "09:00"); skipMeal(s3, m3, ""); unskipMeal(s3, m3);
check.check("5. Uma refeição reagendada e depois ignorada volta a ficar reagendada (não perde a hora nova)", m3.status === "rescheduled" && m3.rescheduledTime === "09:00");

var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(mm){ try { pw = require(mm); return true; } catch (e) { return false; } });
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){ console.log("(ignorado o ecrã: Playwright/Chromium não disponíveis aqui)"); check.summarize(); }
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");
(async function(){
  authRole = "professional";
  var st = buildFullDemoStudent(); st.id = "ana"; st.name = "Ana"; st.isDemo = false; st.active = true; st.photos = []; st.nutritionPhase = null; st.flexibility = "flexivel";
  var row = JSON.parse(JSON.stringify(studentToRow(st)));
  var srv = await startStaticServer(path.join(__dirname, ".."));
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  var ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx.addInitScript(fakeSource({role: "student", userId: "user-ana", email: "ana@x.test", rows: [row]}));
  var pg = await ctx.newPage(); pg.setDefaultTimeout(6000); pg.on("pageerror", function(e){ errors.push(e.message); });
  await pg.goto(srv.url + "index.html");
  await pg.waitForSelector(".meal-row[data-midx]");
  var rows = pg.locator(".meal-row[data-midx]");
  var feitas = async function(){ return (await pg.locator("body").innerText()).match(/(\d+)\/(\d+) feitas/); };
  await rows.nth(1).click(); await pg.waitForSelector("#mdSkip"); await pg.click("#mdSkip"); await pg.click("#skipConfirm"); await pg.waitForTimeout(300);
  await rows.nth(1).click(); await pg.waitForSelector("#mdUnskip");
  check.check("6. Depois de ignorar, a refeição oferece «Voltar a incluir esta refeição»", (await pg.locator("#mdUnskip").count()) === 1);
  await pg.click("#mdUnskip"); await pg.waitForTimeout(300);
  check.check("7. Voltar a incluir tira «ignorada» da linha", !/ignorada/i.test(await rows.nth(1).innerText()));
  // ignorar e depois concluir: conta como feita e deixa de estar ignorada
  await rows.nth(1).click(); await pg.waitForSelector("#mdSkip"); await pg.click("#mdSkip"); await pg.click("#skipConfirm"); await pg.waitForTimeout(300);
  var before = await feitas();
  await rows.nth(1).locator(".check-circle").click(); await pg.waitForTimeout(300);
  var after = await feitas();
  check.check("8. Tocar no círculo de uma refeição ignorada inclui-a de novo e conta como feita (" + before[0] + " → " + after[0] + "), sem ficar «ignorada»", parseInt(after[1], 10) === parseInt(before[1], 10) + 1 && parseInt(after[2], 10) === parseInt(before[2], 10) + 1 && !/ignorada/i.test(await rows.nth(1).innerText()));
  // reagendar e repor (a refeição reagendada muda de lugar na lista: procura-se pelo nome)
  var almoco = function(){ return pg.locator(".meal-row[data-midx]", {hasText: /^\s*Almoço/}).first(); };
  await almoco().click(); await pg.waitForSelector("#mdReschedule"); await pg.click("#mdReschedule"); await pg.waitForSelector("#rescheduleTime");
  await pg.fill("#rescheduleTime", "18:45");
  await pg.click("#rescheduleConfirm"); await pg.waitForSelector("#mdUnreschedule");
  check.check("9. Depois de reagendar, a refeição oferece «Repor o horário original» e a linha mostra a hora nova", (await pg.locator("#mdUnreschedule").count()) === 1 && /18:45/.test(await almoco().innerText()));
  await pg.click("#mdUnreschedule"); await pg.waitForTimeout(400);
  check.check("10. Repor o horário tira a hora nova da linha e a refeição volta a 13:00", !/18:45/.test(await almoco().innerText()) && /13:00/.test(await almoco().innerText()));
  check.check("11. Sem erros de JavaScript", errors.length === 0);
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção " + (e && e.stack)); process.exit(1); });
