// Modo offline e gravação só do que mudou, num Chromium real com Supabase simulado (tests/helpers/fake-supabase.js):
// - o aluno abre a app, marca uma refeição e só viaja a coluna que mudou (agrupada);
// - sem rede a alteração fica na fila (e no indicador); ao voltar a rede segue;
// - a app abre sem rede a partir do service worker e da cópia da ficha; a alteração feita offline continua lá;
// - o profissional não pede os URLs das fotos no arranque e não guarda fichas no dispositivo.
// Corre se o Playwright existir (senão fica ignorado e conta como passado).
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

// a ficha completa de um aluno, tal como a app a grava
function fixtureRow(id, name){
  authRole = "professional";
  var s = buildFullDemoStudent();
  s.id = id; s.name = name; s.initials = name.split(" ").map(function(w){ return w[0]; }).join("").slice(0, 2).toUpperCase(); s.isDemo = false; s.active = true;
  s.photos = [{date: "2026-09-01", position: "frente", path: id + "/foto1.jpg"}];
  return JSON.parse(JSON.stringify(studentToRow(s)));
}

(async function(){
  var root = path.join(__dirname, "..");
  var srv = await startStaticServer(root);
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  async function newSession(role, rows){
    var ctx = await browser.newContext({viewport: {width: 390, height: 844}});
    await ctx.addInitScript(fakeSource({role: role, userId: "user-1", rows: rows}));
    var page = await ctx.newPage();
    page.setDefaultTimeout(6000);
    page.on("pageerror", function(e){ errors.push(e.message); });
    return {ctx: ctx, page: page};
  }
  var row = fixtureRow("stu1", "Ana Teste");

  // ---------- aluno ----------
  var st = await newSession("student", [row]);
  var page = st.page;
  await page.goto(srv.url);
  await page.waitForSelector(".check-circle[data-circle]");
  check.check("1. O aluno entra na app com a sua ficha", /Olá, Ana/.test(await page.locator("#alunoApp").innerText()));
  var swReady = await page.evaluate(async function(){ var r = await navigator.serviceWorker.ready; return !!(r && r.active); });
  check.check("2. O service worker fica ativo", swReady);
  var cached = await page.evaluate(async function(){ var ks = await caches.keys(); var c = await caches.open(ks[0]); var reqs = await c.keys(); return {keys: ks, urls: reqs.map(function(r){ return new URL(r.url).pathname; })}; });
  check.check("3. A cache tem a página, o Supabase local e as fontes", cached.keys[0] === "evolve-v5" && ["/index.html", "/vendor/supabase.js", "/fonts/manrope-latin-wght-normal.woff2", "/manifest.json"].every(function(u){ return cached.urls.indexOf(u) >= 0; }));
  var external = await page.evaluate(function(){ return performance.getEntriesByType("resource").map(function(r){ return r.name; }).filter(function(u){ return !/^http:\/\/127\.0\.0\.1/.test(u); }); });
  check.check("4. A app não pede nada a servidores externos ao abrir (fontes e Supabase são locais)", external.length === 0);

  // várias marcações seguidas -> uma só gravação, só com a coluna que mudou
  var before = await page.evaluate(function(){ return window.__fake.writes.length; });
  var circles = page.locator(".check-circle[data-circle]");
  await circles.nth(0).click(); await page.waitForTimeout(80);
  await page.locator(".check-circle[data-circle]").nth(1).click();
  await page.waitForTimeout(1300);
  var w = await page.evaluate(function(b){ return window.__fake.writes.slice(b); }, before);
  check.check("5. Duas marcações seguidas viram uma única gravação", w.length === 1);
  check.check("6. A gravação leva só a coluna que mudou (não a ficha toda)", w.length === 1 && w[0].cols.join(",") === "meal_daily_state");
  var okStudent = await page.evaluate(function(){ return window.__fake.writes.every(function(x){ return !x.cols.some(function(c){ return ["targets", "meals", "notes", "alerts", "training_program", "phone", "contact_log"].indexOf(c) >= 0; }); }); });
  check.check("7. O aluno nunca envia colunas que só o profissional altera (o servidor recusaria)", okStudent);
  check.check("8. O indicador não aparece quando está tudo enviado", await page.locator("#syncPill").evaluate(function(el){ return el.classList.contains("hidden"); }));

  // sem rede
  await st.ctx.setOffline(true);
  await page.evaluate(function(){ window.dispatchEvent(new Event("offline")); });
  await page.locator(".check-circle[data-circle]").nth(2).click();
  await page.waitForTimeout(1200);
  var pill = await page.locator("#syncPill").innerText();
  check.check("9. Sem rede aparece o aviso e a alteração guardada no telemóvel", /Sem ligação/.test(pill) && /1 alteração guardada/.test(pill));
  var ob = await page.evaluate(function(){ return JSON.parse(localStorage.getItem("evolve_outbox_v1") || "{}"); });
  check.check("10. A alteração fica na fila do telemóvel (só a coluna que mudou)", Object.keys(ob).length === 1 && Object.keys(ob.stu1.cols).join(",") === "meal_daily_state");
  var writesOffline = await page.evaluate(function(){ return window.__fake.writes.length; });
  check.check("11. Sem rede não se enviou nada ao servidor", writesOffline === before + 1);
  var snap = await page.evaluate(function(){ var v = JSON.parse(localStorage.getItem("evolve_snapshot_v1") || "null"); return v && v.rows && v.rows[0] && JSON.stringify(v.rows[0].meal_daily_state); });
  var fakeNow = await page.evaluate(function(){ return JSON.stringify(window.__fake.rows[0].meal_daily_state); });
  check.check("12. A cópia da ficha já inclui a alteração feita sem rede", !!snap && snap !== fakeNow);

  // voltar a abrir sem rede: servidor de ficheiros parado de verdade, a página vem do service worker
  await page.close();
  await new Promise(function(r){ srv.server.close(r); });
  var page2 = await st.ctx.newPage();
  page2.setDefaultTimeout(6000);
  page2.on("pageerror", function(e){ errors.push(e.message); });
  await page2.goto(srv.url);
  await page2.waitForSelector(".check-circle[data-circle]");
  check.check("13. Sem rede e sem servidor, a app abre a partir do service worker com a ficha guardada", /Olá, Ana/.test(await page2.locator("#alunoApp").innerText()));
  check.check("14. As 3 refeições marcadas (2 com rede, 1 sem) continuam marcadas ao reabrir sem rede", /3\/\d+ feitas/.test(await page2.locator("#alunoTabContent").innerText()));
  check.check("15. O aviso continua a dizer que há 1 alteração guardada", /1 alteração guardada/.test(await page2.locator("#syncPill").innerText()));

  // a rede volta (o servidor de ficheiros continua parado, mas a página já está carregada)
  await st.ctx.setOffline(false);
  await page2.evaluate(function(){ window.dispatchEvent(new Event("online")); });
  await page2.waitForFunction(function(){ return window.__fake.writes.length > 0 && JSON.parse(localStorage.getItem("evolve_outbox_v1") || "{}").stu1 === undefined; }, null, {timeout: 6000}).catch(function(){});
  var obAfter = await page2.evaluate(function(){ return JSON.parse(localStorage.getItem("evolve_outbox_v1") || "{}"); });
  var sent = await page2.evaluate(function(){ return window.__fake.writes.map(function(x){ return x.cols.join(","); }); });
  check.check("16. Quando a rede volta, a fila é enviada e esvazia", Object.keys(obAfter).length === 0 && sent.indexOf("meal_daily_state") >= 0);
  check.check("17. Depois de enviado o aviso desaparece", await page2.locator("#syncPill").evaluate(function(el){ return el.classList.contains("hidden"); }));
  await st.ctx.close();

  // ---------- falha do servidor ----------
  srv = await startStaticServer(root);
  var st2 = await newSession("student", [row]);
  var p3 = st2.page;
  await p3.goto(srv.url);
  await p3.waitForSelector(".check-circle[data-circle]");
  await p3.evaluate(function(){ window.__fake.failNext = 1; });
  await p3.locator(".check-circle[data-circle]").nth(0).click();
  await p3.waitForTimeout(1300);
  var retried = await p3.evaluate(function(){ return window.__fake.writes.length; });
  check.check("18. Uma falha do servidor não perde a alteração: fica na fila e é repetida", retried >= 1 && (await p3.evaluate(function(){ return Object.keys(JSON.parse(localStorage.getItem("evolve_outbox_v1") || "{}")).length; })) === 1);
  await p3.evaluate(function(){ window.dispatchEvent(new Event("online")); });
  await p3.waitForFunction(function(){ return Object.keys(JSON.parse(localStorage.getItem("evolve_outbox_v1") || "{}")).length === 0; }, null, {timeout: 6000}).catch(function(){});
  check.check("19. Na repetição seguinte a alteração segue e a fila esvazia", (await p3.evaluate(function(){ return Object.keys(JSON.parse(localStorage.getItem("evolve_outbox_v1") || "{}")).length; })) === 0);
  await st2.ctx.close();

  // ---------- profissional ----------
  var rows = [fixtureRow("stu1", "Ana Teste"), fixtureRow("stu2", "Rui Teste")];
  var pr = await newSession("professional", rows);
  var pp = pr.page;
  await pp.goto(srv.url);
  await pp.waitForSelector(".student-row");
  check.check("20. O profissional vê os alunos", (await pp.locator(".student-row").count()) === 2);
  check.check("21. No arranque não se pede nenhum URL de foto", (await pp.evaluate(function(){ return window.__fake.signedUrls.length; })) === 0);
  check.check("22. O profissional não guarda cópia das fichas no dispositivo", (await pp.evaluate(function(){ return localStorage.getItem("evolve_snapshot_v1"); })) === null);
  await pp.locator("[data-open]").first().click();
  await pp.click('.pro-nav-item[data-g="evolucao"], .pro-nav-item[data-t="evolucao"]').catch(function(){});
  await pp.waitForTimeout(500);
  var signed = await pp.evaluate(function(){ return window.__fake.signedUrls.length; });
  check.check("23. Os URLs das fotos só são pedidos ao abrir a evolução do aluno", signed >= 1);
  // atualizar: um aluno novo no servidor aparece
  await pp.click("#proBack");
  await pp.evaluate(function(r){ window.__fake.rows.push(r); }, fixtureRow("stu3", "Eva Teste"));
  await pp.click("#btnRefresh");
  await pp.waitForTimeout(500);
  check.check("24. O botão Atualizar traz alunos novos sem recarregar a app", (await pp.locator(".student-row").count()) === 3);
  // gravação do profissional: só a coluna alterada
  var wBefore = await pp.evaluate(function(){ return window.__fake.writes.length; });
  await pp.locator("[data-active-toggle]").first().evaluate(function(el){ el.click(); });
  await pp.waitForTimeout(1300);
  var pw1 = await pp.evaluate(function(b){ return window.__fake.writes.slice(b); }, wBefore);
  check.check("25. Desativar um aluno grava uma só gravação", pw1.length === 1);
  // gravação do profissional com a ficha aberta: só a coluna do telefone
  await pp.locator("[data-open]").first().click();
  await pp.click('[data-sub="perfil"]');
  await pp.evaluate(function(){ document.querySelectorAll("details.perfil-section").forEach(function(d){ d.open = true; }); });
  var wb = await pp.evaluate(function(){ return window.__fake.writes.length; });
  await pp.fill("#contactPhone", "912 345 678");
  await pp.click("#saveContactPhone");
  await pp.waitForTimeout(1300);
  var pw2 = await pp.evaluate(function(b){ return window.__fake.writes.slice(b); }, wb);
  check.check("25b. Guardar o telefone no perfil grava só a coluna do telefone (e nada mais da ficha)", pw2.length === 1 && pw2[0].cols.join(",") === "phone" && pw2[0].payload.phone === "912 345 678");
  await pr.ctx.close();

  check.check("26. Nenhum erro de JavaScript durante os testes", errors.length === 0);
  if (errors.length) console.log(errors.slice(0, 3));
  await browser.close();
  srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e.message.split("\n")[0], (e.stack.split("\n").filter(function(l){ return /offline-browser/.test(l); })[0] || "").trim()); process.exit(1); });
