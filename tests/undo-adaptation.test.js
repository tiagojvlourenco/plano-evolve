// Desfazer uma adaptação feita por engano: «Adaptar refeição» (sem trocar alimentos) e trocas de alimentos voltam ao plano original;
// o registo de hoje deixa de contar o que não aconteceu.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

function mk(){ var s = buildFullDemoStudent(); s.id = "u1"; s.isDemo = false; s.adaptationHistory = []; s.substitutionHistory = []; return s; }
var s = mk(), m = s.meals[0];
m.adapted = true; logAdaptation(s, m, "adaptacao", {reason: "Adaptação manual"});
var other = s.meals[1]; other.adapted = true; logAdaptation(s, other, "adaptacao", {reason: "outra"});
check.check("1. Uma refeição só marcada como «adaptada» (sem trocas) não tem «repor original», mas tem de poder ser desfeita", m.adapted === true && mealHasRevertible(m) === false);
undoMealAdaptation(s, m);
check.check("2. Desfazer tira a marca «adaptada» e retira a adaptação de hoje dessa refeição do registo (a outra refeição fica)", m.adapted === false && s.adaptationHistory.length === 1 && s.adaptationHistory[0].meal === other.name && other.adapted === true);

var s2 = mk(), m2 = s2.meals[0], idx = m2.foods.findIndex(function(f){ return f.group; });
var orig = m2.foods[idx].name;
applySubstitution(s2, m2, idx, {name: "Maçã", qty: "1 unid."});
check.check("3. Depois de trocar um alimento ele muda e a refeição fica adaptada, com registo da troca", m2.foods[idx].name === "Maçã" && m2.adapted === true && s2.adaptationHistory.length === 1 && s2.substitutionHistory.length === 1);
undoMealAdaptation(s2, m2);
check.check("4. Desfazer repõe o alimento original, tira a marca e limpa o registo de hoje (troca e adaptação)", m2.foods[idx].name === orig && m2.adapted === false && s2.adaptationHistory.length === 0 && s2.substitutionHistory.length === 0);

var s3 = mk(), m3 = s3.meals[0];
s3.adaptationHistory.push({date: "2020-01-01", time: "10:00", timestamp: "2020-01-01T10:00:00Z", meal: m3.name, type: "adaptacao"});
m3.adapted = true; logAdaptation(s3, m3, "adaptacao", {});
undoMealAdaptation(s3, m3);
check.check("5. O histórico de dias anteriores nunca é apagado", s3.adaptationHistory.length === 1 && s3.adaptationHistory[0].date === "2020-01-01");

var src = appSource;
check.check("6. O detalhe da refeição oferece «Desfazer adaptação» quando está adaptada sem trocas, e os dois botões de repor usam undoMealAdaptation", /id=\\"mdUndoAdapt\\">↺ Desfazer adaptação/.test(src) && /m\.adapted && !mealHasRevertible\(m\)/.test(src) && (src.match(/undoMealAdaptation\(s, m\)/g) || []).length === 2);

// ---- ecrã (Chromium): adaptar e desfazer ----
var fs = require("fs"), path = require("path");
var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){ console.log("(ignorado o ecrã: Playwright/Chromium não disponíveis aqui)"); check.summarize(); }
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");
(async function(){
  authRole = "professional";
  var st = buildFullDemoStudent(); st.id = "ana"; st.name = "Ana"; st.isDemo = false; st.active = true; st.photos = []; st.nutritionPhase = null; st.flexibility = "equilibrado";
  var row = JSON.parse(JSON.stringify(studentToRow(st)));
  var srv = await startStaticServer(path.join(__dirname, ".."));
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  var ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx.addInitScript(fakeSource({role: "student", userId: "user-ana", email: "ana@x.test", rows: [row]}));
  var pg = await ctx.newPage(); pg.setDefaultTimeout(6000); pg.on("pageerror", function(e){ errors.push(e.message); });
  await pg.goto(srv.url + "index.html");
  await pg.waitForSelector(".meal-row[data-midx]");
  await pg.locator(".meal-row[data-midx]").first().click();
  await pg.waitForSelector("#mdAdapt");
  await pg.click("#mdAdapt");
  await pg.waitForSelector("#mdUndoAdapt");
  check.check("7. Depois de adaptar, a refeição mostra «Desfazer adaptação» (antes só dizia «Refeição já adaptada»)", (await pg.locator("#mdUndoAdapt").count()) === 1 && /já adaptada/i.test(await pg.locator("#mdAdapt").innerText()));
  await pg.click("#mdUndoAdapt");
  await pg.waitForTimeout(400);
  await pg.locator(".meal-row[data-midx]").first().click();
  await pg.waitForSelector("#mdAdapt");
  check.check("8. Desfeita a adaptação, «Adaptar refeição» volta a estar disponível e o botão de desfazer desaparece", (await pg.locator("#mdUndoAdapt").count()) === 0 && !(await pg.locator("#mdAdapt").isDisabled()));
  check.check("9. Sem erros de JavaScript", errors.length === 0);
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção " + (e && e.message)); process.exit(1); });
