// Ler o Google Agenda: autorização (simulada), eventos "PT 60 - Nome", cor Tomate = falta, evento mudado/apagado, alias e fonte das sessões.
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
  var rows = [fixtureRow("stu1", "Ana Teste"), fixtureRow("stu2", "Rui Teste")];
  var events = [
    ev("e1_20261001", "PT 60 - Ana Teste", 9, "10:00", "10"),
    ev("e1_20261008", "PT 60 - Ana Teste", 2, "10:00", "10"),
    ev("e2", "PT 60 - Rui Teste", 3, "18:00", "11"),
    ev("e3", "Dentista", 4, "09:00", "6"),
    ev("e4", "PT Duo 60 - Mãe + Pai", 5, "17:00", "10"),
    ev("e5", "PT 60 - Ana Teste", -3, "10:00", "10")
  ];
  var requests = [];
  var ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx.addInitScript(fakeSource({role: "professional", userId: "pro-1", rows: rows}));
  await ctx.route("https://accounts.google.com/gsi/client", function(r){ return r.fulfill({status: 200, contentType: "text/javascript", body: "window.google={accounts:{oauth2:{initTokenClient:function(c){window.__gcfg=c;return {requestAccessToken:function(){setTimeout(function(){c.callback({access_token:'fake-token'});},10);}};}}}};"}); });
  await ctx.route(/https:\/\/www\.googleapis\.com\/calendar\/v3\/calendars\/.*\/events/, function(r){
    var req = r.request(); requests.push({url: req.url(), auth: req.headers()["authorization"]});
    return r.fulfill({status: 200, contentType: "application/json", headers: {"access-control-allow-origin": "*"}, body: JSON.stringify({items: events})});
  });
  var page = await ctx.newPage(); page.setDefaultTimeout(6000);
  page.on("pageerror", function(e){ errors.push(e.message); }); page.on("dialog", function(d){ d.accept(); });
  // a app da Gestão (gestao.html) abre logo no Estúdio, sem lista de alunos nem interruptor de áreas
  await page.goto(srv.url + "gestao.html");
  await page.waitForSelector("#navStudio");
  // pacote de 10 aulas a decorrer para os dois alunos (antes de o Estúdio ler os dados: reabre-se o Estúdio a partir do menu)
  await page.evaluate(function(d){ window.__fake.tables.session_packs.push({id: "pk-a", student_id: "stu1", name: "Trim", total: 10, price: 200, starts_on: d, expires_on: null, missed_consumes: true, late_cancel_consumes: true, used_before: 0}, {id: "pk-b", student_id: "stu2", name: "Trim", total: 10, price: 200, starts_on: d, expires_on: null, missed_consumes: true, late_cancel_consumes: true, used_before: 0}); }, iso(20));
  await page.click("#navContracts"); await page.waitForSelector("#navContracts.active");
  await page.click("#navStudio");
  await page.waitForSelector("#gcalCard");
  check.check("1. Sem ligação, o cartão pede o ID de cliente e explica como o obter", /ID de cliente/.test(await page.locator("#gcalCard").textContent()) && /Google Calendar API/.test(await page.locator("#gcalCard").textContent()));
  await page.fill("#gcClient", "isto-nao-e-um-id"); await page.click("#gcSave");
  check.check("2. Um ID inválido é recusado com uma mensagem", /não parece um ID/.test(await page.locator("#gcErr").innerText()));
  await page.fill("#gcClient", "123456-abc.apps.googleusercontent.com"); await page.click("#gcSave");
  await page.waitForSelector("#gcSync");
  var saved = await page.evaluate(function(){ return window.__fake.tables.studio_settings[0]; });
  check.check("3. O ID fica guardado nas definições do estúdio (e nenhum token)", saved && saved.key === "google_calendar" && saved.value.clientId === "123456-abc.apps.googleusercontent.com" && JSON.stringify(saved).indexOf("fake-token") < 0);

  await page.evaluate(function(){ var d = document.getElementById("gcMore"); if (d) d.open = true; }); await page.fill("#gcPrefix", ""); // estes testes usam eventos de todos os tipos; o filtro por prefixo tem o seu teste
  await page.click("#gcSync");
  await page.waitForFunction(function(){ return window.__fake.tables.sessions.length >= 3; });
  var tok = requests[0];
  check.check("4. A leitura usa a autorização do Google (só de leitura) e pede eventos já expandidos", tok.auth === "Bearer fake-token" && /singleEvents=true/.test(tok.url) && /timeMin=/.test(tok.url) && /calendar\.readonly/.test(await page.evaluate(function(){ return window.__gcfg.scope; })));
  var ss = await page.evaluate(function(){ return window.__fake.tables.sessions.map(function(x){ return {s: x.student_id, d: x.date, t: x.time, st: x.status, src: x.source, ext: x.external_id, pk: x.pack_id}; }); });
  var byExt = {}; ss.forEach(function(x){ byExt[x.ext] = x; });
  check.check("5. Os eventos dos alunos viram sessões (títulos 'PT 60 - Nome'), só até hoje", ss.length === 3 && byExt["e1_20261001"] && byExt["e1_20261008"] && byExt["e2"] && !byExt["e5"] && ss.every(function(x){ return x.src === "calendario"; }));
  check.check("6. A cor Tomate (11) conta como falta; as outras como feita", byExt["e2"].st === "faltou" && byExt["e1_20261001"].st === "feita");
  check.check("7. Cada sessão é descontada ao pacote do aluno e guarda a hora", byExt["e1_20261001"].pk === "pk-a" && byExt["e2"].pk === "pk-b" && byExt["e1_20261001"].t === "10:00");
  var txt = await page.locator("#gcalCard").evaluate(function(el){ return el.textContent; });
  check.check("8. O resumo conta eventos lidos e novas sessões, e lista os eventos sem aluno", /6 eventos lidos/.test(txt) && /3 novas/.test(txt) && /Dentista/.test(txt) && /Mãe \+ Pai/.test(txt));
  await page.evaluate(function(){ var b = document.getElementById("stShowAll"); if (b && /Ver todos/.test(b.textContent)) b.click(); }); 
  var sumTxt = await page.locator("#studioSummary").innerText();
  check.check("9. O Resumo de treinos usa estas sessões (Ana: 2 feitas, faltam 8)", /Ana Teste[\s\S]*?2\/10 feitas/.test(sumTxt));

  // repetir não duplica; mudanças no calendário acompanham-se
  await page.click("#gcSync"); await page.waitForFunction(function(){ return /0 novas/.test(document.querySelector("#gcOut").textContent); });
  check.check("10. Sincronizar outra vez não duplica nada", (await page.evaluate(function(){ return window.__fake.tables.sessions.length; })) === 3);
  events[1] = ev("e1_20261008", "PT 60 - Ana Teste", 1, "11:30", "10"); // passou para outro dia e hora
  events.splice(2, 1);                                                 // o do Rui foi apagado
  await page.click("#gcSync"); await page.waitForFunction(function(){ return /1 removidas/.test(document.querySelector("#gcOut").textContent); });
  var ss2 = await page.evaluate(function(){ return window.__fake.tables.sessions.map(function(x){ return {d: x.date, t: x.time, ext: x.external_id}; }); });
  check.check("11. Um evento que mudou de dia/hora atualiza a sessão e um evento apagado remove-a", ss2.length === 2 && ss2.filter(function(x){ return x.ext === "e1_20261008"; })[0].t === "11:30" && !ss2.some(function(x){ return x.ext === "e2"; }));

  // associar um título à mão
  await page.evaluate(function(){ document.querySelectorAll('#gcalCard details').forEach(function(d){ d.open = true; }); });
  await page.evaluate(function(){ var d = document.getElementById("gcMore"); if (d) d.open = true; }); await page.selectOption('[data-gc-alias="0"]', {index: 0}).catch(function(){});
  var opts = await page.locator('[data-gc-alias] option').allTextContents();
  check.check("12. Os eventos sem aluno podem ser associados a um aluno (lista de alunos no seletor)", opts.some(function(o){ return /Rui Teste/.test(o); }));
  var firstAlias = page.locator("[data-gc-alias]").first();
  var title0 = (await page.locator("#gcalCard .history-row .hlabel").first().innerText()).replace(/ ×\d+$/, "").trim();
  await firstAlias.selectOption({label: "Rui Teste"});
  await page.waitForFunction(function(){ var s = window.__fake.tables.studio_settings[0]; return s && s.value.aliases && Object.keys(s.value.aliases).length === 1; });
  events.push(ev("e6", title0, 1, "20:00", "10"));
  await page.click("#gcSync"); await page.waitForFunction(function(){ return window.__fake.tables.sessions.some(function(x){ return x.external_id === "e6"; }); });
  check.check("13. Depois de associar, esse título passa a contar para o aluno nas sincronizações seguintes", (await page.evaluate(function(){ return window.__fake.tables.sessions.filter(function(x){ return x.external_id === "e6"; })[0].student_id; })) === "stu2");

  // fonte das sessões: o horário semanal fica em pausa
  await page.evaluate(function(){ window.__fake.tables.session_slots.push({id: "slx", student_id: "stu1", weekday: 1, time: "07:00", counts_from: "2020-01-01", generated_until: null}); });
  await page.evaluate(function(){ var d = document.getElementById("gcMore"); if (d) d.open = true; }); await page.click("#gcToggle");
  await page.waitForFunction(function(){ var s = window.__fake.tables.studio_settings[0]; return s && s.value.useAsSource === true; });
  var before = await page.evaluate(function(){ return window.__fake.tables.sessions.length; });
  await page.click("#navContracts"); await page.waitForSelector("#navContracts.active"); await page.click("#navStudio"); await page.waitForSelector("#gcalCard");
  check.check("14. Com o Google Agenda como fonte, o horário semanal não conta sessões", (await page.evaluate(function(){ return window.__fake.tables.sessions.filter(function(x){ return x.source === "agenda"; }).length; })) === 0 && before >= 3);

  // desligar
  await page.evaluate(function(){ var d = document.getElementById("gcMore"); if (d) d.open = true; }); await page.click("#gcOff");
  await page.waitForSelector("#gcClient");
  check.check("15. Desligar apaga o ID e mantém as sessões já contadas", (await page.evaluate(function(){ return window.__fake.tables.studio_settings[0].value.clientId; })) === "" && (await page.evaluate(function(){ return window.__fake.tables.sessions.length; })) >= 3);
  check.check("16. Nenhum erro de JavaScript", errors.length === 0);
  if (errors.length) console.log(errors.slice(0, 3));
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e.message.split("\n")[0], (e.stack.split("\n").filter(function(l){ return /gcal-browser/.test(l); })[0] || "").trim()); process.exit(1); });
