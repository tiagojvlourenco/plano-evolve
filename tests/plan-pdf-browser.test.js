// Exportar o plano alimentar em PDF num Chromium real: botão do aluno (e creatina no plano), descarregamento, ficheiro válido,
// botão do profissional, e a partilha nativa quando o telemóvel a oferece.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var fs = require("fs");
var path = require("path");
var cp = require("child_process");
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){
  console.log("(ignorado: Playwright/Chromium não disponíveis aqui)");
  check.check("browser indisponível — teste ignorado", true);
  check.summarize();
}
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");
function fixtureRow(id, name, extra){
  authRole = "professional";
  var s = buildFullDemoStudent();
  s.id = id; s.name = name; s.isDemo = false; s.active = true; s.photos = []; s.weightCurrent = 82; s.age = 33;
  Object.assign(s, extra || {});
  return JSON.parse(JSON.stringify(studentToRow(s)));
}
(async function(){
  var srv = await startStaticServer(path.join(__dirname, ".."));
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  async function session(role, rows){
    var ctx = await browser.newContext({viewport: {width: 390, height: 844}, acceptDownloads: true});
    await ctx.addInitScript(fakeSource({role: role, userId: "user-1", rows: rows}));
    var page = await ctx.newPage(); page.setDefaultTimeout(6000);
    page.on("pageerror", function(e){ errors.push(e.message); }); page.on("dialog", function(d){ d.accept(); });
    return {ctx: ctx, page: page};
  }

  // ---------- aluno ----------
  var st = await session("student", [fixtureRow("stu1", "Ana Teste")]);
  var pg = st.page;
  await pg.goto(srv.url);
  await pg.waitForSelector(".check-circle[data-circle]");
  await pg.click('.tabbar button:nth-child(2)');
  await pg.waitForSelector(".plano-meal-card");
  check.check("1. O plano do aluno tem o botão «Plano em PDF»", (await pg.locator("#exportPlanPdf").count()) === 1);
  var plano = await pg.locator("#alunoTabContent").innerText();
  check.check("2. E mostra a creatina mono-hidratada no pequeno-almoço, com a dose e a nota do horário", /Creatina mono-hidratada/.test(plano) && /4 g/.test(plano) && /Pode ser tomada em qualquer altura do dia/.test(plano));
  var card = await pg.locator(".plano-meal-card").first().innerText();
  check.check("3. A creatina está no cartão do pequeno-almoço (o primeiro)", /Pequeno-almoço/i.test(card) && /Creatina/.test(card));
  var [dl] = await Promise.all([pg.waitForEvent("download"), pg.click("#exportPlanPdf")]);
  var file = await dl.path(), buf = fs.readFileSync(file), head = buf.slice(0, 8).toString("latin1");
  check.check("4. Descarrega um PDF com o nome do aluno e a data", /^plano-alimentar-ana-teste-\d{4}-\d{2}-\d{2}\.pdf$/.test(dl.suggestedFilename()) && /^%PDF-1\.4/.test(head) && buf.toString("latin1").trim().endsWith("%%EOF"));
  var txt = buf.toString("latin1");
  check.check("5. O PDF leva o nome do aluno, uma refeição e a creatina", txt.indexOf("(Ana Teste)") > 0 && txt.indexOf("(Creatina mono-hidratada)") > 0 && txt.indexOf("(PLANO ALIMENTAR)") > 0);
  // desenha mesmo (se existir o pdftoppm)
  var haveRaster = false; try { cp.execSync("which pdftoppm", {stdio: "ignore"}); haveRaster = true; } catch (e) {}
  if (haveRaster){
    var tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "evpdf-")), pdfPath = path.join(tmp, "p.pdf");
    fs.writeFileSync(pdfPath, buf);
    cp.execSync("pdftoppm -r 40 -png " + pdfPath + " " + path.join(tmp, "out"));
    var png = fs.readdirSync(tmp).filter(function(f){ return /\.png$/.test(f); });
    var pngBuf = png.length ? fs.readFileSync(path.join(tmp, png[0])) : null;
    check.check("6. O PDF abre num leitor real (poppler) e gera a imagem da página", png.length >= 1 && pngBuf.length > 3000 && pngBuf.slice(1, 4).toString() === "PNG");
  } else check.check("6. (sem poppler: verificação visual ignorada)", true);

  // creatina retirada pelo profissional → deixa de aparecer ao aluno (aluno não escreve: só vê)
  await st.ctx.close();
  var st2 = await session("student", [fixtureRow("stu1", "Ana Teste", {blockedFoods: ["Creatina mono-hidratada"]})]);
  await st2.page.goto(srv.url);
  await st2.page.waitForSelector(".check-circle[data-circle]");
  await st2.page.click('.tabbar button:nth-child(2)'); await st2.page.waitForSelector(".plano-meal-card");
  check.check("7. Com a creatina retirada pelo profissional o aluno não a vê", !/Creatina/.test(await st2.page.locator("#alunoTabContent").innerText()));
  await st2.ctx.close();

  // ---------- profissional ----------
  var sp = await session("professional", [fixtureRow("stu1", "Ana Teste"), fixtureRow("stu2", "Rui Teste")]);
  var pp = sp.page;
  await pp.goto(srv.url);
  await pp.waitForSelector(".student-row");
  await pp.locator('[data-open="stu1"]').first().click();
  await pp.locator('.pro-sidebar [data-t="plano"]').click();
  await pp.waitForSelector("#proExportPdf");
  check.check("8. O profissional vê o cartão da creatina (dose pelo peso) e o botão do PDF", /4 g por dia/.test(await pp.locator("#creatineCard").innerText()) && (await pp.locator("#proExportPdf").count()) === 1);
  var [dl2] = await Promise.all([pp.waitForEvent("download"), pp.click("#proExportPdf")]);
  check.check("9. O botão do profissional descarrega o mesmo PDF", /^plano-alimentar-ana-teste-/.test(dl2.suggestedFilename()));
  // retirar a creatina: grava em blockedFoods e o botão passa a «Incluir no plano»
  await pp.click("#creatineToggle");
  await pp.waitForSelector('#creatineToggle[data-on="1"]');
  await pp.waitForFunction(function(){ return window.__fake.rows.some(function(r){ return r.id === "stu1" && (r.blocked_foods || []).indexOf("Creatina mono-hidratada") >= 0; }); }, null, {timeout: 6000});
  check.check("10. Retirar a creatina grava-a em blocked_foods e regista no histórico do plano", await pp.evaluate(function(){ var r = window.__fake.rows.filter(function(x){ return x.id === "stu1"; })[0]; return (r.plan_history || []).some(function(e){ return e.type === "creatina"; }); }));
  await pp.click("#creatineToggle");
  await pp.waitForSelector('#creatineToggle[data-on="0"]');
  check.check("11. E voltar a incluir tira-a de blocked_foods", await pp.waitForFunction(function(){ return window.__fake.rows.filter(function(r){ return r.id === "stu1"; })[0].blocked_foods.indexOf("Creatina mono-hidratada") < 0; }, null, {timeout: 6000}).then(function(){ return true; }, function(){ return false; }));
  await sp.ctx.close();

  // ---------- partilha nativa (iPhone) ----------
  var ctx3 = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx3.addInitScript(fakeSource({role: "student", userId: "user-1", rows: [fixtureRow("stu1", "Ana Teste")]}));
  await ctx3.addInitScript(function(){
    window.__shared = null;
    navigator.canShare = function(d){ return !!(d && d.files && d.files.length && d.files[0].type === "application/pdf"); };
    navigator.share = function(d){ window.__shared = {title: d.title, name: d.files[0].name, type: d.files[0].type, size: d.files[0].size}; return Promise.resolve(); };
  });
  var p3 = await ctx3.newPage(); p3.setDefaultTimeout(6000); p3.on("pageerror", function(e){ errors.push(e.message); });
  await p3.goto(srv.url); await p3.waitForSelector(".check-circle[data-circle]");
  await p3.click('.tabbar button:nth-child(2)'); await p3.waitForSelector("#exportPlanPdf");
  await p3.click("#exportPlanPdf");
  await p3.waitForFunction(function(){ return window.__shared; });
  var sh = await p3.evaluate(function(){ return window.__shared; });
  check.check("12. Com partilha nativa (iPhone), o PDF vai direto para a folha de partilha, sem descarregar", sh.type === "application/pdf" && /^plano-alimentar-ana-teste-/.test(sh.name) && sh.size > 2000 && sh.title === "Plano alimentar EVOLVE");
  await ctx3.close();

  check.check("13. Nenhum erro de JavaScript", errors.length === 0);
  if (errors.length) console.log(errors.slice(0, 3));
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e.message.split("\n")[0], (e.stack.split("\n").filter(function(l){ return /plan-pdf-browser/.test(l); })[0] || "").trim()); process.exit(1); });
