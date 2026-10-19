// Pacotes, sessões e cobranças num Chromium real com Supabase simulado: criar pacote (com cobrança), registar sessões, marcar pago,
// registo rápido no ecrã Estúdio, CSV, e o aviso quando falta a migração 0023.
// Duas apps: tudo isto vive na Gestão (gestao.html, abre direta no Estúdio; a ficha do aluno mostra só os Pacotes);
// o dashboard de alunos (aviso da migração em falta) é do Acompanhamento (index.html), noutra página com o seu próprio Supabase simulado.
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
(async function(){
  var srv = await startStaticServer(path.join(__dirname, ".."));
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  async function newPage(ctx){
    var page = await ctx.newPage(); page.setDefaultTimeout(6000);
    page.on("pageerror", function(e){ errors.push(e.message); }); page.on("dialog", function(d){ d.accept(); });
    return page;
  }
  async function session(initial, seed){
    var ctx = await browser.newContext({viewport: {width: 390, height: 844}, acceptDownloads: true});
    await ctx.addInitScript(fakeSource(initial));
    if (seed) await ctx.addInitScript(seed);
    return {ctx: ctx, page: await newPage(ctx)};
  }
  var rows = [fixtureRow("stu1", "Ana Teste"), fixtureRow("stu2", "Rui Teste")];
  // na Gestão não há lista de alunos: a ficha abre-se a partir dos contratos/estúdio, por isso a Ana já tem contrato (sem pacotes) à partida
  var st = await session({role: "professional", userId: "pro-1", rows: rows}, function(){ window.__fake.tables.studio_settings.push({key: "contracts", value: {stu1: {modalidade: "trimestral", minutos: 60}}}); });
  var pg = st.page;
  await pg.goto(srv.url + "gestao.html");
  await pg.waitForSelector("#quickSessions");
  check.check("1. O ecrã Estúdio abre e diz que não há pacotes a decorrer", /Nenhum aluno com pacote/.test(await pg.locator("#quickSessions").innerText()));

  // criar pacote na ficha
  await pg.click("#navContracts"); await pg.waitForSelector("#contractList [data-open-contract]");
  await pg.locator("#contractList [data-open-contract]").first().click();
  await pg.locator('[data-open-student="stu1"]').first().click();
  await pg.waitForSelector("#pkName", {state: "attached"});
  await pg.evaluate(function(){ document.querySelectorAll("details.perfil-section").forEach(function(d){ d.open = true; }); });
  await pg.fill("#pkName", "Pack 10 sessões"); await pg.fill("#pkTotal", "10"); await pg.fill("#pkPrice", "250");
  await pg.click("#pkAdd");
  await pg.waitForSelector("[data-del-pack]");
  var fk = await pg.evaluate(function(){ return {packs: window.__fake.tables.session_packs, pays: window.__fake.tables.payments}; });
  check.check("2. Criar o pacote grava-o com as regras e a validade (3 meses)", fk.packs.length === 1 && fk.packs[0].total === 10 && fk.packs[0].price === 250 && fk.packs[0].missed_consumes === true && !!fk.packs[0].expires_on && fk.packs[0].student_id);
  check.check("3. E cria a cobrança do preço, a vencer no início do pacote", fk.pays.length === 1 && fk.pays[0].amount === 250 && fk.pays[0].pack_id === fk.packs[0].id && fk.pays[0].due_on === fk.packs[0].starts_on);
  check.check("4. A ficha mostra o pacote com 0 de 10 usadas", /0 de 10 usadas · restam 10/.test(await pg.locator("#proTabContent").innerText()));

  // registar sessões
  await pg.click("#seAdd"); await pg.waitForSelector("[data-del-session]");
  await pg.selectOption("#seStatus", "faltou"); await pg.click("#seAdd");
  await pg.waitForFunction(function(){ return document.querySelectorAll("[data-del-session]").length === 2; });
  var ss = await pg.evaluate(function(){ return window.__fake.tables.sessions; });
  check.check("5. As sessões ficam ligadas ao pacote", ss.length === 2 && ss.every(function(x){ return x.pack_id === "session_packs-1"; }) && ss.map(function(x){ return x.status; }).sort().join() === "faltou,feita");
  check.check("6. A falta sem aviso gasta uma sessão (restam 8)", /2 de 10 usadas · restam 8/.test(await pg.locator("#proTabContent").innerText()));

  // marcar pago
  await pg.locator('[data-pay]').first().click(); await pg.selectOption("#payMethod", "mbway"); await pg.click("#payGo");
  await pg.waitForFunction(function(){ return window.__fake.tables.payments[0].paid_on; });
  var pay = await pg.evaluate(function(){ return window.__fake.tables.payments[0]; });
  check.check("7. Marcar como pago grava a data e o método", /^\d{4}-\d{2}-\d{2}$/.test(pay.paid_on) && pay.method === "mbway");

  // ecrã Estúdio: registo rápido do outro aluno com pacote
  await pg.evaluate(function(){ window.__fake.tables.session_packs.push({id: "pk-x", student_id: "stu2", name: "Pack 20", total: 20, price: 440, starts_on: "2026-01-01", expires_on: null, missed_consumes: true, late_cancel_consumes: true}); });
  await pg.click("#proBack");
  await pg.click("#navStudio");
  await pg.waitForSelector("#quickSessions");
  check.check("8. O Estúdio lê os dados de novo ao abrir e mostra o aluno que tem pacote a decorrer", (await pg.locator('#quickSessions [data-qs="stu2:feita"]').count()) === 1);
  await pg.locator('#quickSessions [data-qs="stu2:feita"]').click();
  await pg.waitForFunction(function(){ return window.__fake.tables.sessions.length === 3; });
  check.check("9. O registo rápido grava a sessão de hoje como feita", (await pg.evaluate(function(){ var l = window.__fake.tables.sessions; return l[l.length - 1].status; })) === "feita");
  // horário semanal: conta sozinho as sessões que já passaram
  await pg.locator('#studioSummary [data-open-student="stu1"]').first().click();
  await pg.waitForSelector("#slWeekday", {state: "attached"});
  await pg.evaluate(function(){ document.querySelectorAll("details.perfil-section").forEach(function(d){ d.open = true; }); });
  var weekAgo = new Date(Date.now() - 7 * 86400000), wdAgo = weekAgo.getDay() === 0 ? 7 : weekAgo.getDay();
  var weekAgoISO = weekAgo.getFullYear() + "-" + String(weekAgo.getMonth() + 1).padStart(2, "0") + "-" + String(weekAgo.getDate()).padStart(2, "0");
  await pg.selectOption("#slWeekday", String(wdAgo)); await pg.fill("#slTime", "07:00"); await pg.fill("#slFrom", weekAgoISO);
  await pg.click("#slAdd");
  await pg.waitForFunction(function(){ return window.__fake.tables.sessions.some(function(x){ return x.source === "agenda"; }); });
  var auto = await pg.evaluate(function(){ return {sess: window.__fake.tables.sessions.filter(function(x){ return x.source === "agenda"; }), slot: window.__fake.tables.session_slots[0]}; });
  check.check("9b. O horário conta sozinho a sessão que já passou (feita, 07:00, do horário)", auto.sess.length === 1 && auto.sess[0].status === "feita" && auto.sess[0].time === "07:00" && auto.sess[0].date === weekAgoISO);
  await pg.waitForFunction(function(){ var sl = window.__fake.tables.session_slots[0]; return sl && sl.generated_until; });
  check.check("9c. O horário fica marcado como contado até ontem, para não repetir", !!(await pg.evaluate(function(){ return window.__fake.tables.session_slots[0].generated_until; })));
  await pg.click("#proBack"); await pg.click("#navStudio"); await pg.waitForSelector("#studioSummary");
  check.check("9d. O Estúdio mostra o resumo de treinos com o pacote (faltam 8) e a agenda", /faltam 8/.test(await pg.locator("#studioSummary").innerText()) && (await pg.locator("#studioAgenda").count()) === 1);
  check.check("9e. A sessão contada pelo horário não se duplica ao reabrir o Estúdio", (await pg.evaluate(function(){ return window.__fake.tables.sessions.filter(function(x){ return x.source === "agenda"; }).length; })) === 1);
  // importar pacotes a decorrer
  await pg.click("#studioImport summary");
  await pg.fill("#impText", "Rui Teste; 26; 01/10/2026; 520; 9\nNinguém; 10; 01/10/2026; 1; 0");
  await pg.click("#impGo");
  await pg.waitForFunction(function(){ return window.__fake.tables.session_packs.some(function(p){ return p.student_id === "stu2" && p.used_before === 9; }); });
  check.check("9f. Importar cria o pacote do aluno com as aulas já dadas e avisa do nome que não existe", /Ninguém/.test(await pg.locator("#impOut").innerText()) && /1 pacote criado/.test(await pg.locator("#impOut").innerText()));
  var [dl] = await Promise.all([pg.waitForEvent("download"), pg.click("#csvSessions")]);
  var csv = fs.readFileSync(await dl.path(), "utf8");
  check.check("10. O CSV das sessões descarrega com cabeçalho e as sessões do mês", /^﻿Aluno;Data;Hora;Estado;Pacote;Notas/.test(csv) && /Pack 10 sessões/.test(csv));
  await st.ctx.close();

  // migração por correr
  var st2 = await session({role: "professional", userId: "pro-1", rows: rows, missingTables: true});
  await st2.page.goto(srv.url + "gestao.html");
  await st2.page.waitForSelector("#proMain .card");
  check.check("11. Sem a migração 0023 a app avisa o que fazer em vez de falhar", /migração 0023/.test(await st2.page.locator("#proMain").innerText()));
  // o dashboard de alunos é do Acompanhamento (outra página, com o seu próprio Supabase simulado, também sem as tabelas)
  var stA = await newPage(st2.ctx);
  await stA.goto(srv.url);
  await stA.waitForSelector(".student-row");
  check.check("12. E o resto do dashboard continua a funcionar", (await stA.locator(".student-row").count()) === 2);
  await st2.ctx.close();

  check.check("13. Nenhum erro de JavaScript", errors.length === 0);
  if (errors.length) console.log(errors.slice(0, 3));
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e.message.split("\n")[0], (e.stack.split("\n").filter(function(l){ return /studio-browser/.test(l); })[0] || "").trim()); process.exit(1); });
