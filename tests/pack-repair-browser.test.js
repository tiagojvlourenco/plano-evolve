// Pacote caducado com aulas extra (o aluno parou e voltou): «Contar estas aulas no pacote», editar o pacote,
// e a janela da agenda a chegar às aulas previstas já passadas. Chromium real com Supabase simulado.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

// ---- a janela da agenda chega às aulas previstas (folha) que já passaram e ainda não foram confirmadas ----
(function(){
  var today = localTodayISO();
  studio.packs = [{id: "p1", student_id: "x", name: "T", total: 13, starts_on: addDaysISO(today, -250), expires_on: addDaysISO(today, -70), used_before: 0}];
  studio.sessions = [{id: "a", student_id: "x", pack_id: null, date: addDaysISO(today, -240), status: "agendada", source: "folha"}];
  var w = calendarWindow(today);
  check.check("1. A janela da agenda chega ao pacote caducado que ainda tem aulas (e à aula prevista mais antiga)", w.from <= addDaysISO(today, -240));
  studio.packs[0].used_before = 13;
  studio.sessions = [];
  var w2 = calendarWindow(today);
  check.check("2. Um pacote caducado e esgotado não alarga a janela", w2.from > addDaysISO(today, -250));
})();

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
  await ctx.addInitScript(fakeSource({role: "professional", userId: "pro-1", rows: [fixtureRow("s1", "Maria Leite")]}));
  await ctx.addInitScript(function(){
    function iso(back){ var d = new Date(); d.setDate(d.getDate() - back); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
    var T = window.__fake.tables;
    T.session_packs.push({id: "pk1", student_id: "s1", name: "Pacote 13 aulas", total: 13, price: 527.25, starts_on: iso(250), expires_on: iso(70), missed_consumes: true, late_cancel_consumes: true, used_before: 0});
    [60, 30, 5].forEach(function(b, i){ T.sessions.push({id: "se" + i, student_id: "s1", pack_id: null, date: iso(b), time: null, status: "feita", source: "calendario", external_id: "ev" + i}); });
  });
  var pg = await ctx.newPage(); pg.setDefaultTimeout(6000);
  pg.on("pageerror", function(e){ errors.push(e.message); }); pg.on("dialog", function(d){ d.accept(); });
  await pg.goto(srv.url);
  await pg.waitForSelector(".student-row");
  await pg.locator('[data-open="s1"]').first().click();
  await pg.click('[data-sub="sessoes"]');
  await pg.waitForSelector("[data-extend-pack]");
  var txt = await pg.locator("#proMain").innerText();
  check.check("3. Mostra «Aguarda renovação · +3 aulas extra» e o botão para as contar no pacote caducado", /Aguarda renovação/.test(txt) && /\+3 aulas extra/.test(txt) && /Contar estas aulas no pacote/i.test(txt));
  await pg.click("[data-extend-pack]");
  await pg.waitForFunction(function(){ return window.__fake.tables.sessions.every(function(x){ return x.pack_id === "pk1"; }); });
  var fk = await pg.evaluate(function(){ return {pk: window.__fake.tables.session_packs[0], ses: window.__fake.tables.sessions}; });
  check.check("4. O pacote perde a validade e as 3 aulas passam a ser dele", fk.pk.expires_on === null && fk.ses.length === 3 && fk.ses.every(function(x){ return x.pack_id === "pk1"; }));
  await pg.waitForFunction(function(){ return /3 de 13 usadas/.test(document.getElementById("proMain").innerText); });
  check.check("5. A ficha passa a mostrar 3 de 13 usadas, sem validade, e deixa de aguardar renovação", /restam 10/.test(await pg.locator("#proMain").innerText()) && !/Aguarda renovação/.test(await pg.locator("#proMain").innerText()));
  // editar
  await pg.click("[data-edit-pack]");
  await pg.waitForSelector("#epTotal");
  check.check("6. A janela de editar traz os valores atuais do pacote", (await pg.inputValue("#epTotal")) === "13" && (await pg.inputValue("#epExpiry")) === "");
  await pg.fill("#epTotal", "20");
  await pg.fill("#epUsed", "2");
  await pg.fill("#epTotal", "1"); await pg.fill("#epUsed", "5"); await pg.click("#epGo");
  check.check("7. Aulas já dadas acima do total é recusado", /entre 0 e 1/.test(await pg.locator("#epErr").innerText()));
  await pg.fill("#epTotal", "20"); await pg.fill("#epUsed", "2"); await pg.click("#epGo");
  await pg.waitForFunction(function(){ return window.__fake.tables.session_packs[0].total === 20; });
  var pk = await pg.evaluate(function(){ return window.__fake.tables.session_packs[0]; });
  check.check("8. Guardar grava o novo total e as aulas já dadas", pk.total === 20 && pk.used_before === 2);
  await pg.waitForFunction(function(){ return /5 de 20 usadas/.test(document.getElementById("proMain").innerText); });
  check.check("9. E a contagem passa a 5 de 20 (2 antes da app + 3 sessões)", true);
  check.check("10. Nenhum erro de JavaScript", errors.length === 0);
  if (errors.length) console.log(errors.slice(0, 3));
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e.message.split("\n")[0]); process.exit(1); });
