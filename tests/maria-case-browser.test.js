// O caso de uma aluna que parou e voltou ao mesmo pacote (13 aulas, 6 meses de validade): duas aulas do início só existem como «agendada»
// (folha), as outras 8 chegaram depois de o pacote caducar. Sincronizar tem de ler a agenda desde o início do pacote, confirmar as duas
// aulas antigas e contar tudo no pacote: 10 de 13. Google simulado: nada sai para a rede real.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var fs = require("fs");
var path = require("path");
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){ console.log("(ignorado: Playwright/Chromium não disponíveis aqui)"); check.check("browser indisponível — teste ignorado", true); check.summarize(); }
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");
function fixtureRow(id, name){
  authRole = "professional";
  var s = buildFullDemoStudent();
  s.id = id; s.name = name; s.isDemo = false; s.active = true; s.photos = [];
  return JSON.parse(JSON.stringify(studentToRow(s)));
}
function iso(n){ var d = new Date(Date.now() - n * 86400000); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function ev(id, title, daysAgo, hhmm){ return {id: id, summary: title, colorId: "10", status: "confirmed", start: {dateTime: iso(daysAgo) + "T" + hhmm + ":00+00:00"}, end: {dateTime: iso(daysAgo) + "T" + hhmm + ":00+00:00"}}; }
(async function(){
  var srv = await startStaticServer(path.join(__dirname, ".."));
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [], requests = [];
  var TITLE = "PT 60 - Maria Teste Leite";
  var offsets = [386, 350, 142, 113, 105, 104, 73, 66, 64, 8];   // 10 aulas: 2 no início, 8 depois de o pacote caducar
  var events = offsets.map(function(n, i){ return ev("m" + i, TITLE, n, "14:00"); });
  var ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx.addInitScript(fakeSource({role: "professional", userId: "pro-1", rows: [fixtureRow("m1", "Maria Teste Leite")]}));
  await ctx.addInitScript(function(offs){
    function iso2(n){ var d = new Date(Date.now() - n * 86400000); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
    var T = window.__fake.tables;
    T.session_packs.push({id: "pkm", student_id: "m1", name: "Pacote 13 aulas", total: 13, price: 527.25, starts_on: iso2(386), expires_on: iso2(386 - 183), missed_consumes: true, late_cancel_consumes: true, used_before: 0});
    // as duas primeiras aulas vieram da folha (agendada); as 8 seguintes já foram lidas da agenda mas ficaram sem pacote (caducado)
    [386, 350].forEach(function(n, i){ T.sessions.push({id: "f" + i, student_id: "m1", pack_id: null, date: iso2(n), time: null, status: "agendada", source: "folha", external_id: null}); });
    offs.slice(2).forEach(function(n, i){ T.sessions.push({id: "c" + i, student_id: "m1", pack_id: null, date: iso2(n), time: "14:00", status: "feita", source: "calendario", external_id: "m" + (i + 2)}); });
  }, offsets);
  await ctx.route("https://accounts.google.com/gsi/client", function(r){ return r.fulfill({status: 200, contentType: "text/javascript", body: "window.google={accounts:{oauth2:{initTokenClient:function(c){window.__gcfg=c;return {requestAccessToken:function(){setTimeout(function(){c.callback({access_token:'fake-token'});},10);}};}}}};"}); });
  await ctx.route(/https:\/\/www\.googleapis\.com\/calendar\/v3\/calendars\/.*\/events/, function(r){
    requests.push(r.request().url());
    return r.fulfill({status: 200, contentType: "application/json", headers: {"access-control-allow-origin": "*"}, body: JSON.stringify({items: events})});
  });
  var page = await ctx.newPage(); page.setDefaultTimeout(8000);
  page.on("pageerror", function(e){ errors.push(e.message); }); page.on("dialog", function(d){ d.accept(); });
  // a sincronização e a ficha com os Pacotes vivem ambas na Gestão (gestao.html), que abre direta no Estúdio
  await page.goto(srv.url + "gestao.html");
  await page.waitForSelector("#gcalCard");
  await page.fill("#gcClient", "123456-abc.apps.googleusercontent.com"); await page.click("#gcSave");
  await page.waitForSelector("#gcSync");
  await page.click("#gcSync");
  await page.waitForFunction(function(){ return /Agenda sincronizada|sincronizada/i.test(document.body.innerText) || /novas|atualizadas/.test((document.querySelector("#gcOut") || {textContent: ""}).textContent); });
  await page.waitForTimeout(1500);
  var timeMin = requests.length ? decodeURIComponent((/timeMin=([^&]+)/.exec(requests[0]) || [])[1] || "") : "";
  check.check("1. A sincronização lê a agenda desde o início do pacote (há mais de 380 dias), não só os últimos 120", timeMin && (Date.now() - new Date(timeMin).getTime()) / 86400000 > 380);
  var fk = await page.evaluate(function(){ var T = window.__fake.tables; return {pk: T.session_packs[0], ses: T.sessions.map(function(x){ return {d: x.date, st: x.status, p: x.pack_id, src: x.source}; })}; });
  var feitas = fk.ses.filter(function(x){ return x.st === "feita"; });
  check.check("2. As duas aulas antigas deixam de estar «agendada» e passam a feitas (a agenda confirmou-as)", fk.ses.filter(function(x){ return x.st === "agendada"; }).length === 0 && feitas.length === 10);
  check.check("3. As 10 aulas contam no pacote, que perdeu a validade", feitas.every(function(x){ return x.p === "pkm"; }) && fk.pk.expires_on === null);
  // a ficha do aluno na Gestão mostra só os Pacotes (sem separadores de acompanhamento): abre-se a partir do Estúdio
  await page.click("#navStudio"); await page.waitForSelector("#gcalCard");
  await page.locator('[data-open-student="m1"]').first().click();
  await page.waitForSelector("#proBack");
  await page.waitForFunction(function(){ return /10 de 13 usadas/.test(document.getElementById("proMain").innerText); });
  var txt = await page.locator("#proMain").innerText();
  check.check("4. A ficha mostra 10 de 13 usadas, restam 3, e nenhuma aula «por confirmar»", /restam 3/.test(txt) && !/por confirmar/i.test(txt));
  check.check("5. Nenhum erro de JavaScript", errors.length === 0);
  if (errors.length) console.log(errors.slice(0, 3));
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e.message.split("\n")[0]); process.exit(1); });
