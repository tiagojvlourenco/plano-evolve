// Lista de alunos (lupa + ordem A→Z/Z→A) e pacotes partilhados num Chromium real com Supabase simulado:
// escolher o tipo de pack (validade = duração + 3 meses), partilhar com o parceiro, janela «Partilhar», e as contas dos dois alunos.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var fs = require("fs");
var path = require("path");
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){
  console.log("(ignorado: Playwright/Chromium não disponíveis aqui)");
  check.check("browser indisponível — teste ignorado", true);
  check.summarize();
}
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");
function fixtureRow(id, name){
  authRole = "professional";
  var s = buildFullDemoStudent();
  s.id = id; s.name = name; s.isDemo = false; s.active = true; s.photos = [];
  return JSON.parse(JSON.stringify(studentToRow(s)));
}
var START = addDaysISO(localTodayISO(), -10); // o pacote já começou (as datas fixas deixavam o teste caducar com o tempo)
function localISO(d){ return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
(async function(){
  var srv = await startStaticServer(path.join(__dirname, ".."));
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  var ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  var rows = [fixtureRow("s1", "Ana Silva"), fixtureRow("s2", "Bruno Costa"), fixtureRow("s3", "Álvaro Dias"), fixtureRow("s4", "Zélia Pinto")];
  await ctx.addInitScript(fakeSource({role: "professional", userId: "pro-1", rows: rows}));
  var pg = await ctx.newPage(); pg.setDefaultTimeout(6000);
  pg.on("pageerror", function(e){ errors.push(e.message); }); pg.on("dialog", function(d){ d.accept(); });
  await pg.goto(srv.url);
  await pg.waitForSelector(".student-row");

  // ---- lupa e ordem ----
  async function names(){ return pg.evaluate(function(){ return [].map.call(document.querySelectorAll(".student-row .sname"), function(e){ return e.textContent.replace(/\s+/g, " ").trim(); }); }); }
  check.check("1. A lista tem a lupa e a ordem e mostra os 4 alunos", (await pg.locator("#stuSearch").count()) === 1 && (await pg.locator("#stuSort").count()) === 1 && (await names()).length === 4);
  await pg.fill("#stuSearch", "alvaro");
  check.check("2. A lupa ignora maiúsculas e acentos («alvaro» encontra Álvaro Dias)", (await names()).join("|") === "Álvaro Dias");
  check.check("3. Escrever na lupa não faz perder o foco do campo", await pg.evaluate(function(){ return document.activeElement && document.activeElement.id === "stuSearch"; }));
  await pg.fill("#stuSearch", "silva ");
  check.check("4. Procura por parte do nome e ignora espaços no fim", (await names()).join("|") === "Ana Silva");
  await pg.fill("#stuSearch", "xyz");
  check.check("5. Sem resultados diz o que procurou", /Nenhum aluno com «xyz»/.test(await pg.locator("#studentListBox").innerText()));
  await pg.fill("#stuSearch", "");
  await pg.selectOption("#stuSort", "az");
  check.check("6. A→Z põe Álvaro à frente de Ana (acentos não desordenam)", (await names()).join("|") === "Álvaro Dias|Ana Silva|Bruno Costa|Zélia Pinto");
  await pg.selectOption("#stuSort", "za");
  check.check("7. Z→A inverte a ordem", (await names()).join("|") === "Zélia Pinto|Bruno Costa|Ana Silva|Álvaro Dias");
  await pg.selectOption("#stuSort", "az"); await pg.fill("#stuSearch", "a");
  check.check("8. Pesquisa e ordem combinam-se (todos têm «a»; fica A→Z)", (await names()).join("|") === "Álvaro Dias|Ana Silva|Bruno Costa|Zélia Pinto");
  await pg.fill("#stuSearch", "");
  await pg.locator('[data-open="s1"]').first().click();
  await pg.click("#proBack");
  check.check("9. Ao voltar à lista, a ordem e a pesquisa escolhidas mantêm-se", (await pg.locator("#stuSort").inputValue()) === "az");

  // ---- pacote com tipo e partilha ----
  await pg.locator('[data-open="s1"]').first().click();
  await pg.click('[data-sub="sessoes"]');
  await pg.evaluate(function(){ document.querySelectorAll("details.perfil-section").forEach(function(d){ d.open = true; }); });
  check.check("10. O formulário tem o tipo de pack e o aluno com quem partilhar (sem a própria Ana)", (await pg.locator("#pkType option").count()) === 5 && (await pg.locator("#pkShare option").count()) === 4 && !(await pg.locator("#pkShare").innerText()).includes("Ana Silva"));
  await pg.selectOption("#pkType", "trimestral");
  check.check("11. Escolher «Trimestral» põe 6 meses de validade e o nome do pack", (await pg.locator("#pkMonths").inputValue()) === "6" && (await pg.locator("#pkName").inputValue()) === "Pack trimestral");
  await pg.fill("#pkName", "Pack casal"); await pg.selectOption("#pkType", "anual");
  check.check("12. Se o nome já foi escrito à mão, o tipo só muda a validade (15 meses)", (await pg.locator("#pkMonths").inputValue()) === "15" && (await pg.locator("#pkName").inputValue()) === "Pack casal");
  await pg.selectOption("#pkType", "trimestral");
  await pg.fill("#pkTotal", "39"); await pg.fill("#pkPrice", "900"); await pg.fill("#pkStart", START);
  await pg.selectOption("#pkShare", "s2");
  await pg.click("#pkAdd");
  await pg.waitForSelector("[data-share-pack]");
  var fk = await pg.evaluate(function(){ return window.__fake.tables; });
  check.check("13. O pacote grava a validade (início + 6 meses, a duração do trimestral + 3), o preço e o parceiro", fk.session_packs.length === 1 && fk.session_packs[0].expires_on === addMonthsISO(START, 6) && fk.session_packs[0].total === 39 && fk.session_packs[0].shared_with.join() === "s2");
  check.check("14. E só cria uma cobrança (um pagamento para os dois)", fk.payments.length === 1 && fk.payments[0].student_id === "s1" && fk.payments[0].amount === 900);
  var tabA = await pg.locator("#proTabContent").innerText();
  check.check("15. A ficha da Ana mostra «Partilhado com Bruno Costa»", /Partilhado com Bruno Costa/.test(tabA));

  // ---- o parceiro vê o pacote e regista uma sessão que desconta ao mesmo pacote ----
  await pg.click("#proBack");
  await pg.locator('[data-open="s2"]').first().click();
  await pg.click('[data-sub="sessoes"]');
  var tabB = await pg.locator("#proTabContent").innerText();
  check.check("16. A ficha do Bruno mostra o pacote da Ana, sem botão de apagar", /Pacote de Ana Silva/.test(tabB) && (await pg.locator("[data-del-pack]").count()) === 0);
  await pg.evaluate(function(){ document.querySelectorAll("details.perfil-section").forEach(function(d){ d.open = true; }); });
  await pg.fill("#seDate", localISO(new Date())); await pg.click("#seAdd");
  await pg.waitForSelector("[data-del-session]");
  var fk2 = await pg.evaluate(function(){ return window.__fake.tables; });
  check.check("17. A sessão do Bruno fica ligada ao pacote da Ana (um só pacote para os dois)", fk2.sessions.length === 1 && fk2.sessions[0].student_id === "s2" && fk2.sessions[0].pack_id === fk2.session_packs[0].id);
  check.check("18. O pacote mostra 1 de 39 usadas", /1 de 39 usadas · restam 38/.test(await pg.locator("#proTabContent").innerText()));

  // ---- janela «Partilhar» ----
  await pg.click("#proBack");
  await pg.locator('[data-open="s1"]').first().click();
  await pg.click('[data-sub="sessoes"]');
  await pg.locator("[data-share-pack]").first().click();
  await pg.waitForSelector("#shList");
  check.check("19. A janela mostra os outros alunos com o Bruno já marcado", (await pg.locator("#shList input").count()) === 3 && (await pg.locator('#shList input[data-sh-id="s2"]').isChecked()));
  await pg.fill("#shFilter", "zelia");
  check.check("20. A lupa da janela filtra a lista sem perder as marcas", (await pg.locator("#shList [data-sh-name]:visible").count()) === 1 && (await pg.locator('#shList input[data-sh-id="s2"]').isChecked()));
  await pg.locator('#shList input[data-sh-id="s4"]').check();
  await pg.click("#shGo");
  await pg.waitForFunction(function(){ return window.__fake.tables.session_packs[0].shared_with.length === 2; });
  check.check("21. Guardar partilha também com a Zélia", (await pg.evaluate(function(){ return window.__fake.tables.session_packs[0].shared_with.slice().sort().join(); })) === "s2,s4");
  await pg.locator("[data-share-pack]").first().click();
  await pg.waitForSelector("#shList");
  await pg.locator('#shList input[data-sh-id="s2"]').uncheck(); await pg.locator('#shList input[data-sh-id="s4"]').uncheck();
  await pg.click("#shGo");
  await pg.waitForFunction(function(){ return window.__fake.tables.session_packs[0].shared_with.length === 0; });
  check.check("22. Desmarcar todos deixa de partilhar", (await pg.locator("[data-share-pack]").count()) === 1 && !/Partilhado com/.test(await pg.locator("#proTabContent").innerText()));

  // ---- resumo do estúdio ----
  await pg.locator("[data-share-pack]").first().click(); await pg.waitForSelector("#shList");
  await pg.locator('#shList input[data-sh-id="s2"]').check(); await pg.click("#shGo");
  await pg.waitForFunction(function(){ return window.__fake.tables.session_packs[0].shared_with.length === 1; });
  await pg.click("#proBack"); await pg.click("#navStudio"); await pg.waitForSelector("#studioSummary");
  var sum = await pg.locator("#studioSummary").innerText();
  check.check("23. O resumo do estúdio mostra a partilha e o que resta no conjunto (38 de 39)", /Partilha com/.test(sum) && /restam\s*38\s*de 39/.test(sum.replace(/\n/g, " ")));

  check.check("24. Nenhum erro de JavaScript", errors.length === 0);
  if (errors.length) console.log(errors.slice(0, 3));
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e.message.split("\n")[0], (e.stack.split("\n").filter(function(l){ return /shared-packs-browser/.test(l); })[0] || "").trim()); process.exit(1); });
