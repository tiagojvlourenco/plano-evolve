// Estúdio: lupa (nomes que começam pelas letras) e ordem no resumo de treinos; número da aula na ficha e na agenda do dia. Chromium real.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var fs = require("fs");
var path = require("path");
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(q){ return fs.existsSync(q); })[0];
if (!pw || !chromiumPath){ console.log("(ignorado: Playwright/Chromium não disponíveis aqui)"); check.check("browser indisponível — teste ignorado", true); check.summarize(); }
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");
function fixtureRow(id, name){
  authRole = "professional";
  var s = buildFullDemoStudent();
  s.id = id; s.name = name; s.isDemo = false; s.active = true; s.photos = [];
  return JSON.parse(JSON.stringify(studentToRow(s)));
}
(async function(){
  var srv = await startStaticServer(path.join(__dirname, ".."));
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  var ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx.addInitScript(fakeSource({role: "professional", userId: "pro-1", rows: [fixtureRow("a", "Ana Silva"), fixtureRow("b", "Bruno Costa"), fixtureRow("c", "Álvaro Dias"), fixtureRow("d", "Zélia Pinto")]}));
  await ctx.addInitScript(function(){
    function iso(back){ var d = new Date(); d.setDate(d.getDate() - back); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
    var T = window.__fake.tables, n = 0;
    [["a", 13, 2], ["b", 13, 11], ["c", 13, 5], ["d", 13, 0]].forEach(function(r){
      T.session_packs.push({id: "p" + r[0], student_id: r[0], name: "Pacote 13", total: r[1], price: 100, starts_on: iso(80), expires_on: null, used_before: 0, missed_consumes: true, late_cancel_consumes: true, shared_with: []});
      for (var k = 0; k < r[2]; k++) T.sessions.push({id: "x" + (n++), student_id: r[0], pack_id: "p" + r[0], date: iso(70 - k * 3), time: "10:00", status: "feita", source: "calendario", external_id: "e" + n});
    });
  });
  var pg = await ctx.newPage(); pg.setDefaultTimeout(6000);
  pg.on("pageerror", function(e){ errors.push(e.message); }); pg.on("dialog", function(d){ d.accept(); });
  await pg.goto(srv.url); await pg.waitForSelector(".student-row");
  // ---- número da aula na ficha ----
  await pg.locator('[data-open="a"]').first().click();
  await pg.click('[data-sub="sessoes"]');
  await pg.waitForSelector(".history-row .pill");
  var ficha = await pg.locator("#proMain").innerText();
  check.check("1. A ficha mostra «Aula 1/13» e «Aula 2/13» ao lado das sessões da aluna", /Aula 1\/13/.test(ficha) && /Aula 2\/13/.test(ficha));
  // ---- Estúdio ----
  await pg.click("#proBack"); await pg.click("#navStudio"); await pg.waitForSelector("#studioSummary");
  var names = function(){ return pg.evaluate(function(){ return [].filter.call(document.querySelectorAll("#studioSummary .studio-row"), function(r){ return !r.hidden; }).map(function(r){ return r.querySelector(".wl-info").textContent.trim(); }); }); };
  check.check("2. O Estúdio tem a lupa e a ordem, e o resumo mostra os 4 alunos", (await pg.locator("#stSearch").count()) === 1 && (await pg.locator("#stSort").count()) === 1 && (await names()).length === 4);
  await pg.focus("#stSearch"); await pg.keyboard.type("br", {delay: 40});
  check.check("3. Ao escrever, ficam só os nomes que começam por «br»", (await names()).join("|") === "Bruno Costa" && /1 aluno no estúdio/.test(await pg.locator("#stInfo").innerText()));
  await pg.fill("#stSearch", "zzz");
  check.check("4. Sem resultados diz o que procurou", (await names()).length === 0 && /Nenhum aluno com «zzz»/.test(await pg.locator("#stInfo").innerText()));
  await pg.fill("#stSearch", "");
  await pg.selectOption("#stSort", "az");
  check.check("5. A→Z ordena o resumo (Álvaro antes de Ana)", (await names()).join("|") === "Álvaro Dias|Ana Silva|Bruno Costa|Zélia Pinto");
  await pg.selectOption("#stSort", "za");
  check.check("6. Z→A inverte", (await names()).join("|") === "Zélia Pinto|Bruno Costa|Ana Silva|Álvaro Dias");
  await pg.selectOption("#stSort", "menos");
  check.check("7. «Menos aulas primeiro» põe quem tem menos aulas por dar à frente (Bruno com 2 por dar)", (await names())[0] === "Bruno Costa");
  await pg.fill("#stSearch", "an");
  check.check("8. A lupa também filtra as outras listas do Estúdio (registo rápido): só aparece a Ana", await pg.evaluate(function(){ return [].filter.call(document.querySelectorAll("#quickSessions [data-sname]"), function(r){ return !r.hidden; }).map(function(r){ return r.getAttribute("data-sname"); }).join("|"); }) === "ana silva");
  check.check("9. Nenhum erro de JavaScript", errors.length === 0);
  if (errors.length) console.log(errors.slice(0, 3));
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e.message.split("\n")[0]); process.exit(1); });
