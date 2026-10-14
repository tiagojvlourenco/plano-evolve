// Criar alunos de uma vez a partir dos nomes da agenda (migração 0026: só estúdio).
// O Google é simulado (o script de autorização e a API de eventos são interceptados): nada sai para a rede real.
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
function iso(n){ var d = new Date(Date.now() - n * 86400000); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function ev(id, title, daysAgo, hhmm, color){ return {id: id, summary: title, colorId: color, status: "confirmed", start: {dateTime: iso(daysAgo) + "T" + hhmm + ":00+00:00"}, end: {dateTime: iso(daysAgo) + "T" + hhmm + ":00+00:00"}}; }
(async function(){
  var srv = await startStaticServer(path.join(__dirname, ".."));
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  var rows = [fixtureRow("stu1", "Ana Teste")];
  var events = [
    ev("a1", "PT 60 - Ana Teste", 6, "10:00", "10"),
    ev("b1", "PT 60 - Beatriz Lopes", 5, "11:00", "10"),
    ev("b2", "PT 60 - Beatriz Lopes", 2, "11:00", "11"),
    ev("c1", "PT Duo 60 - Mãe + Pai", 4, "17:00", "10"),
    ev("d1", "PT 60 - Rui Costa (online)", 3, "08:00", "10"),
    ev("x1", "Dentista", 4, "09:00", "6"),
    ev("x2", "Reunião de equipa", 3, "15:00", "6"),
    ev("x3", "PT 60", 1, "12:00", "10")
  ];
  var tokens = 0;
  var ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx.addInitScript(fakeSource({role: "professional", userId: "pro-1", rows: rows}));
  await ctx.route("https://accounts.google.com/gsi/client", function(r){ tokens++; return r.fulfill({status: 200, contentType: "text/javascript", body: "window.google={accounts:{oauth2:{initTokenClient:function(c){return {requestAccessToken:function(){setTimeout(function(){c.callback({access_token:'fake-token'});},10);}};}}}};"}); });
  await ctx.route(/https:\/\/www\.googleapis\.com\/calendar\/v3\/calendars\/.*\/events/, function(r){
    return r.fulfill({status: 200, contentType: "application/json", headers: {"access-control-allow-origin": "*"}, body: JSON.stringify({items: events})});
  });
  var page = await ctx.newPage(); page.setDefaultTimeout(6000);
  page.on("pageerror", function(e){ errors.push(e.message); }); page.on("dialog", function(d){ d.accept(); });
  await page.goto(srv.url);
  await page.waitForSelector(".student-row");
  await page.evaluate(function(d){ window.__fake.tables.session_packs.push({id: "pk-a", student_id: "stu1", name: "Trim", total: 10, price: 200, starts_on: d, expires_on: null, missed_consumes: true, late_cancel_consumes: true, used_before: 0}); }, iso(30));
  await page.click("#navStudio");
  await page.waitForSelector("#gcalCard");
  await page.fill("#gcClient", "123456-abc.apps.googleusercontent.com"); await page.click("#gcSave");
  await page.waitForSelector("#gcSync");
  await page.click("#gcSync");
  await page.waitForSelector("#gcCreate");
  var names = await page.locator("[data-gc-name]").evaluateAll(function(els){ return els.map(function(e){ return e.value; }); });
  var checked = await page.locator("[data-gc-new]").evaluateAll(function(els){ return els.map(function(e){ return e.checked; }); });
  check.check("1. Os nomes que a agenda traz e ainda não são alunos aparecem para criar (nome depois do último ' - ', sem '(online)')", names.indexOf("Beatriz Lopes") >= 0 && names.indexOf("Mãe + Pai") >= 0 && names.indexOf("Rui Costa") >= 0 && names.indexOf("Ana Teste") < 0);
  var pick = {}; names.forEach(function(n, i){ pick[n] = checked[i]; });
  check.check("2. Só vêm marcados os que parecem alunos (Dentista, Reunião e 'PT 60' ficam por marcar)", pick["Beatriz Lopes"] === true && pick["Mãe + Pai"] === true && pick["Dentista"] === false && pick["Reunião de equipa"] === false && pick["PT 60"] === false);
  // corrige um nome antes de criar
  var idx = names.indexOf("Rui Costa");
  await page.fill('[data-gc-name="' + idx + '"]', "Rui Costa Silva");
  var tokensBefore = tokens;
  await page.click("#gcCreate");
  await page.waitForFunction(function(){ return window.__fake.rows.length >= 4; });
  await page.waitForFunction(function(){ return window.__fake.tables.sessions.length >= 5; });
  var made = await page.evaluate(function(){ return window.__fake.rows.slice(1).map(function(r){ return {id: r.id, name: r.name, so: r.studio_only, mail: r.invite_email, fo: r.from_onboarding}; }); });
  check.check("3. Cria os alunos escolhidos (com o nome corrigido) como 'só estúdio', sem email", made.length === 3 && made.every(function(m){ return m.so === true && m.mail === null && m.fo === false; }) && made.some(function(m){ return m.name === "Rui Costa Silva"; }) && made.some(function(m){ return m.name === "Mãe + Pai"; }));
  var ss = await page.evaluate(function(){ return window.__fake.tables.sessions.map(function(x){ return {s: x.student_id, st: x.status, ext: x.external_id}; }); });
  var byExt = {}; ss.forEach(function(x){ byExt[x.ext] = x; });
  var beaId = made.filter(function(m){ return m.name === "Beatriz Lopes"; })[0].id;
  check.check("4. As aulas desses alunos contam-se logo, com a falta (cor Tomate) incluída", byExt.b1 && byExt.b1.s === beaId && byExt.b1.st === "feita" && byExt.b2 && byExt.b2.st === "faltou" && byExt.c1 && byExt.d1 && !byExt.x1 && !byExt.x2 && !byExt.x3);
  check.check("5. Não pede autorização outra vez (usa os eventos que acabou de ler)", tokens === tokensBefore);
  var al = await page.evaluate(function(){ return window.__fake.tables.studio_settings[0].value.aliases; });
  check.check("6. Guarda os títulos como alias: nas próximas sincronizações continuam a contar para o aluno certo", Object.keys(al).length >= 3 && Object.keys(al).some(function(k){ return /rui costa/.test(k) && al[k] === made.filter(function(m){ return m.name === "Rui Costa Silva"; })[0].id; }));
  // sincronizar outra vez não duplica nem recria alunos
  await page.click("#gcSync"); await page.waitForFunction(function(){ return /0 novas/.test(document.querySelector("#gcOut").textContent); });
  check.check("7. Sincronizar outra vez não duplica sessões nem alunos", (await page.evaluate(function(){ return window.__fake.tables.sessions.length; })) === ss.length && (await page.evaluate(function(){ return window.__fake.rows.length; })) === 4);
  // painel de retenção: não os trata como alunos sem registos
  var reasons = await page.evaluate(function(){ var out = []; STUDENTS_FOR_TEST = null; return out; }).catch(function(){ return []; });
  await page.click("#navDashboard");
  await page.waitForSelector(".student-row");
  var queue = await page.evaluate(function(){ var q = document.getElementById("contactQueue"); return q ? q.textContent : ""; });
  check.check("8. Os alunos 'só estúdio' não aparecem na lista 'quem contactar' por não terem registos", !/Beatriz Lopes|Mãe \+ Pai|Rui Costa Silva/.test(queue));
  // a ficha abre sem erros
  await page.click('.student-row:has-text("Beatriz Lopes")');
  await page.waitForSelector(".pro-sidebar [data-t]");
  var bad = [];
  var tabs = await page.locator(".pro-sidebar [data-t]").evaluateAll(function(els){ return els.map(function(e){ return e.getAttribute("data-t"); }); });
  for (var tab of tabs){
    await page.locator('.pro-sidebar [data-t="' + tab + '"]').click(); await page.waitForTimeout(150);
    var body = await page.locator("#proMain").evaluate(function(el){ return el.textContent; });
    var m = body.match(/.{0,40}(NaN|undefined|\bnull\b|Infinity).{0,40}/); if (m) bad.push(tab + ": " + m[0]);
  }
  check.check("9. A ficha de um aluno criado da agenda abre em todos os separadores sem erros, 'NaN' nem 'undefined' (" + tabs.join(", ") + ")", errors.length === 0 && bad.length === 0 && tabs.length >= 4);
  if (bad.length) console.log("separadores com lixo:", bad);
  if (errors.length) console.log(errors.slice(0, 3));
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e.message.split("\n")[0], (e.stack.split("\n").filter(function(l){ return /gcal-students/.test(l); })[0] || "").trim()); process.exit(1); });
