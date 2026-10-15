// Muitas sessões (mais do que o servidor devolve de uma vez): a app lê por páginas e a sincronização não tenta recriar as que já existem.
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
  var N = 1150, events = [], sessions = [], slots = ["08:00", "10:00", "12:00"];
  for (var i = 0; i < N; i++){
    var daysAgo = 1 + Math.floor(i / 3), hhmm = slots[i % 3];
    events.push(ev("big" + i, "PT 60 - Ana Teste", daysAgo, hhmm, "10"));
    sessions.push({student_id: "stu1", pack_id: "pk-a", date: iso(daysAgo), time: hhmm, status: "feita", source: "calendario", external_id: "big" + i});
  }
  var ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx.addInitScript(fakeSource({role: "professional", userId: "pro-1", rows: rows}));
  await ctx.route("https://accounts.google.com/gsi/client", function(r){ return r.fulfill({status: 200, contentType: "text/javascript", body: "window.google={accounts:{oauth2:{initTokenClient:function(c){return {requestAccessToken:function(){setTimeout(function(){c.callback({access_token:'fake-token'});},10);}};}}}};"}); });
  await ctx.route(/https:\/\/www\.googleapis\.com\/calendar\/v3\/calendars\/.*\/events/, function(r){
    return r.fulfill({status: 200, contentType: "application/json", headers: {"access-control-allow-origin": "*"}, body: JSON.stringify({items: events})});
  });
  var page = await ctx.newPage(); page.setDefaultTimeout(15000);
  page.on("pageerror", function(e){ errors.push(e.message); }); page.on("dialog", function(d){ d.accept(); });
  await page.goto(srv.url);
  await page.waitForSelector(".student-row");
  await page.evaluate(function(a){
    window.__fake.tables.session_packs.push({id: "pk-a", student_id: "stu1", name: "Trim", total: 10, price: 200, starts_on: a.start, expires_on: null, missed_consumes: true, late_cancel_consumes: true, used_before: 0});
    a.sessions.forEach(function(x, i){ window.__fake.tables.sessions.push(Object.assign({id: "s" + (i + 1)}, x)); });
    window.__fake.tables.studio_settings.push({id: "st1", key: "google_calendar", value: {clientId: "123456-abc.apps.googleusercontent.com", calendarId: "primary", useAsSource: false, titlePrefix: "", aliases: {}, ignored: {}, lastSync: null}});
  }, {start: iso(399), sessions: sessions});
  await page.click("#areaGestao"); await page.click("#navStudio");
  await page.waitForSelector("#gcSync");
  await page.click("#gcSync");
  await page.waitForFunction(function(){ var o = document.querySelector("#gcOut"); return o && /eventos lidos/.test(o.textContent); });
  var out = await page.locator("#gcOut").textContent();
  check.check("1. Com mais sessões do que o servidor devolve de uma vez, a sincronização não volta a criá-las nem dá erros (" + out.slice(0, 120) + ")", /1150 eventos lidos/.test(out) && /0 novas/.test(out) && !/erro/.test(out));
  var maxRows = await page.evaluate(function(){ return window.__fake.tables.sessions.length; });
  check.check("2. Não se criaram sessões repetidas", maxRows === 1150);
  check.check("3. Nenhum erro de JavaScript", errors.length === 0);
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e.message.split("\n")[0], (e.stack.split("\n").filter(function(l){ return /gcal-many/.test(l); })[0] || "").trim()); process.exit(1); });
