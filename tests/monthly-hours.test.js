// Horas mensais por aluno: leitura do texto colado (nome como na folha «PT 60 - …»), guardar em studio_settings,
// cabeçalho «Horas mensais ativas» no Estúdio (soma só dos ativos) e campo na ficha, num Chromium real.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

var p = parseHoursImport("Nome; Horas\nPT 60 - Ana Silva; 8,66\nPT Duo 60 - Bruno Costa;4\nRui;0\n;3\nZé");
check.check("1. Lê «Nome; horas», tira o prefixo do pack e ignora o cabeçalho", p.rows.length === 2 && p.rows[0].name === "Ana Silva" && p.rows[0].hours === 8.66 && p.rows[1].name === "Bruno Costa" && p.rows[1].hours === 4);
check.check("2. Horas a 0, nome em falta e linha sem horas dão erro", p.errors.length === 3);
check.check("3. Formata as horas à portuguesa", fmtHours(8.66) === "8,66 h" && fmtHours(12) === "12 h");
check.check("4. Valores absurdos são limpos ao carregar", JSON.stringify(hoursClean({a: 8.666, b: -1, c: "x", d: 500, e: "4"})) === JSON.stringify({a: 8.67, e: 4}));

var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var fs = require("fs");
var path = require("path");
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(q){ return fs.existsSync(q); })[0];
if (!pw || !chromiumPath){ console.log("(ignorado: Playwright/Chromium não disponíveis aqui)"); check.check("browser indisponível — teste ignorado", true); check.summarize(); }
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");
function fixtureRow(id, name, active){
  authRole = "professional";
  var s = buildFullDemoStudent();
  s.id = id; s.name = name; s.isDemo = false; s.active = active !== false; s.photos = [];
  return JSON.parse(JSON.stringify(studentToRow(s)));
}
(async function(){
  var srv = await startStaticServer(path.join(__dirname, ".."));
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  var ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx.addInitScript(fakeSource({role: "professional", userId: "pro-1", rows: [fixtureRow("s1", "Ana Silva"), fixtureRow("s2", "Bruno Costa"), fixtureRow("s3", "Carla Dias")]}));
  // o Estúdio só lista (e deixa abrir a ficha de) quem tem pacote a decorrer: cada aluno ganha um pacote simples, igual em cada carregamento
  var d0 = new Date(); d0.setDate(d0.getDate() - 10);
  var startsOn = d0.getFullYear() + "-" + String(d0.getMonth() + 1).padStart(2, "0") + "-" + String(d0.getDate()).padStart(2, "0");
  await ctx.addInitScript("(function(){ var T = window.__fake.tables; [\"s1\", \"s2\", \"s3\"].forEach(function(id){ T.session_packs.push({id: \"pk-\" + id, student_id: id, name: \"Pack 20\", total: 20, price: 440, starts_on: \"" + startsOn + "\", expires_on: null, missed_consumes: true, late_cancel_consumes: true, used_before: 0}); }); })();");
  var pg = await ctx.newPage(); pg.setDefaultTimeout(6000);
  pg.on("pageerror", function(e){ errors.push(e.message); }); pg.on("dialog", function(d){ d.accept(); });
  // o cabeçalho, a importação e a ficha com os Pacotes vivem na Gestão (gestao.html), que abre direta no Estúdio
  await pg.goto(srv.url + "gestao.html");
  await pg.waitForSelector("#studioKpis");
  check.check("5. Sem horas, o cabeçalho mostra «—»", /—/.test(await pg.locator("#studioKpis").innerText()) && /Horas mensais ativas/i.test(await pg.locator("#studioKpis").innerText()));
  await pg.click("#navContracts"); await pg.waitForSelector("#studioImportHours");   // as importações vivem nos Contratos
  await pg.evaluate(function(){ document.getElementById("studioImportHours").open = true; });
  await pg.fill("#hrsText", "PT 60 - Ana Silva; 8,66\nPT Duo 60 - Bruno Costa + Carla Dias; 4\nNinguém Existe; 3");
  await pg.click("#hrsGo");
  await pg.waitForFunction(function(){ var r = window.__fake.tables.studio_settings.filter(function(x){ return x.key === "monthly_hours"; })[0]; return r && r.value.s1 === 8.66; });
  await pg.click("#navStudio"); await pg.waitForSelector("#studioKpis");
  var kp = await pg.locator("#studioKpis").innerText();
  check.check("6. O cabeçalho passa a mostrar a soma (12,66 h)", /12,66 h/.test(kp));
  var saved = await pg.evaluate(function(){ var r = window.__fake.tables.studio_settings.filter(function(x){ return x.key === "monthly_hours"; })[0]; return r ? r.value : null; });
  check.check("7. Grava em studio_settings (chave monthly_hours) por id de aluno", saved && saved.s1 === 8.66 && saved.s2 === 2 && saved.s3 === 2);
  // ficha: editar
  // na Gestão a ficha abre-se a partir do Estúdio e mostra só os Pacotes (sem separadores)
  await pg.goto(srv.url + "gestao.html"); await pg.waitForSelector("#studioKpis");
  await pg.evaluate(function(){ var b = document.getElementById("stShowAll"); if (b && /Ver todos/.test(b.textContent)) b.click(); }); 
  await pg.locator('[data-open-student="s3"]').first().click();
  await pg.waitForSelector("#stuHours");
  check.check("8. A ficha mostra o campo das horas mensais (recarregar volta aos dados simulados)", (await pg.inputValue("#stuHours")) === "");
  await pg.fill("#stuHours", "6,5"); await pg.press("#stuHours", "Tab");
  await pg.waitForFunction(function(){ var r = window.__fake.tables.studio_settings.filter(function(x){ return x.key === "monthly_hours"; })[0]; return r && r.value.s3 === 6.5; });
  check.check("9. Editar na ficha grava as horas", true);
  await pg.click("#proBack"); await pg.click("#navStudio"); await pg.waitForSelector("#studioKpis");
  check.check("10. E o cabeçalho soma-as (6,5 h)", /6,5 h/.test(await pg.locator("#studioKpis").innerText()));
  check.check("11. Nenhum erro de JavaScript", errors.length === 0);
  if (errors.length) console.log(errors.slice(0, 3));
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e.message.split("\n")[0]); process.exit(1); });
