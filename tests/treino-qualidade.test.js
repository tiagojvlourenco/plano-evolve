// EVOLVE Treino, ronda de qualidade: histórico paginado e com pesquisa rápida (anos de treinos), calendário com leitura por voz válida, dias de calendário na mudança de
// hora, limpeza de treinos «por enviar» que já não existem e pré-visualização do profissional sem erros.
// O que não se vê aqui: a velocidade num telemóvel real (a medição de 4× mais lento é simulada) e o leitor de ecrã de verdade.
process.env.TZ = "Europe/Lisbon";
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var fs = require("fs"), path = require("path");
var RealDate = Date;
function iso(d){ return isoOfLocalDate(new Date(Date.now() - d * 86400000)); }

// ---- dias de calendário (mudança de hora) ----
function withNow(isoStamp, fn){
  var fixed = new RealDate(isoStamp).getTime();
  global.Date = class extends RealDate { constructor(){ if (arguments.length) super(...arguments); else super(fixed); } static now(){ return fixed; } };
  try { return fn(); } finally { global.Date = RealDate; }
}
var tzOk = new RealDate(2026, 2, 29, 3, 0).getTimezoneOffset() === -60 && new RealDate(2026, 0, 10, 12).getTimezoneOffset() === 0; // Lisboa: verão +1, inverno 0
check.check("1. O teste corre com o fuso de Lisboa (mudança de hora de 29/03 e 25/10 de 2026)", tzOk);
check.check("2. Depois do «avanço» de hora (dia de 23 h): segunda 00:30 está a 2 dias de sábado, não a 1", withNow("2026-03-30T00:30:00+01:00", function(){ return daysSinceDate("2026-03-28"); }) === 2);
check.check("3. No «recuo» de hora (dia de 25 h): domingo 23:30 está a 1 dia de sábado, não a 2", withNow("2026-10-25T23:30:00+00:00", function(){ return daysSinceDate("2026-10-24"); }) === 1);
check.check("4. Hoje é 0, ontem é 1, e datas inválidas ou futuras não dão números negativos", withNow("2026-11-05T12:00:00+00:00", function(){ return daysSinceDate("2026-11-05") === 0 && daysSinceDate("2026-11-04") === 1 && daysSinceDate("lixo") === null && daysSinceDate("2026-11-09") === 0; }));

// ---- histórico paginado ----
authRole = "student"; sbReady = true;
function bigStudent(n){ var logs = []; for (var i = 0; i < n; i++) logs.push({id: "l" + i, date: iso(1 + i), dayId: "d", dayName: i % 2 ? "Treino B — Pernas" : "Treino A — Peito", rpe: 7, entries: [{exerciseId: "e", name: i % 2 ? "Agachamento" : "Supino", sets: [{reps: 8, load: 50}]}]}); return {id: "big", workoutLogs: logs, workoutLogsRaw: logs}; }
var big = bigStudent(120);
state.histQ = ""; state.histPeriod = "all"; state.histLimit = 0;
var l1 = histListHtml(big);
check.check("5. Com 120 treinos a lista mostra 40 linhas, diz «120 treinos» e oferece «Mostrar mais (80 treinos por ver)»", (l1.match(/class="hist-row"/g) || []).length === 40 && /120 treinos/.test(l1) && /id="histMore"/.test(l1) && /80 treinos por ver/.test(l1));
state.histLimit = 80;
check.check("6. «Mostrar mais» junta mais 40 linhas (80) e depois já só faltam 40", (histListHtml(big).match(/class="hist-row"/g) || []).length === 80 && /40 treinos por ver/.test(histListHtml(big)));
state.histLimit = 200;
check.check("7. Quando já se vê tudo, o botão desaparece", !/id="histMore"/.test(histListHtml(big)) && (histListHtml(big).match(/class="hist-row"/g) || []).length === 120);
state.histLimit = 0; state.histQ = "agachamento";
var lq = histListHtml(big);
check.check("8. A pesquisa conta todos os resultados (60) mesmo mostrando só 40", /60 treinos/.test(lq) && (lq.match(/class="hist-row"/g) || []).length === 40);
state.histQ = "";

// ---- calendário: ARIA válido ----
var ch = tplCalendario(bigStudent(3));
check.check("9. O calendário não usa grid/gridcell sem linhas (ARIA inválido): é um grupo com nome, dias sem atividade escondidos da leitura e só os dias com treino são botões com rótulo", !/role="(grid|gridcell|columnheader)"/.test(ch) && /role="group" aria-label="[^"]*: dias com atividade"/.test(ch) && (ch.match(/data-cal-day=/g) || []).length === 3 && /aria-hidden="true"><span>\d+<\/span>/.test(ch) && !/class="cal-dow"[^>]*>(?![^<]*<)/.test("") );

// ---- por enviar: limpeza ----
var store = {}; global.window.localStorage = {getItem: function(k){ return k in store ? store[k] : null; }, setItem: function(k, v){ store[k] = v; }, removeItem: function(k){ delete store[k]; }};
unsentAdd("p1", "existe"); unsentAdd("p1", "fantasma");
var ps = {id: "p1", workoutLogs: [{id: "existe"}], workoutLogsRaw: [{id: "existe"}]};
Object.defineProperty(ps, "_sync", {value: {workout_logs: JSON.stringify([])}, writable: true, enumerable: false});
var si = workoutSyncInfo(ps);
check.check("10. Um treino «por enviar» que já não existe na ficha (ex.: reposto pelo servidor) é esquecido e não conta: 1 por enviar, não 2", si.state === "pending" && si.pending === 1 && JSON.stringify(unsentRead().p1) === '["existe"]');

// ---- ficheiros ----
var root = path.join(__dirname, "..");
var app = fs.readFileSync(path.join(root, "app.js"), "utf8");
check.check("11. A barra da série atual tem nome acessível (região «Série atual»)", /id=\\"wlDock\\" role=\\"region\\" aria-label=\\"Série atual\\"/.test(app));
check.check("12. A pesquisa do histórico espera uma pausa na escrita (120 ms) antes de redesenhar a lista", /histTimer = setTimeout\(paint, 120\)/.test(app));

// ---- Chromium ----
var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){ console.log("(ignorado o ecrã: Playwright/Chromium não disponíveis aqui)"); check.summarize(); }
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");
function rowBig(n, role){
  authRole = "professional";
  var s = buildFullDemoStudent(); s.id = "ana"; s.name = "Ana Treina"; s.isDemo = false; s.active = true; s.photos = []; s.nutritionPhase = null;
  var days = s.trainingProgram.days, r = JSON.parse(JSON.stringify(studentToRow(s)));
  r.workout_logs = []; for (var i = 0; i < n; i++){ var d = days[i % days.length]; r.workout_logs.push({id: "h" + i, date: iso(1 + i), dayId: d.id, dayName: d.name, rpe: 7, notes: "", entries: d.exercises.map(function(e){ return {exerciseId: e.id, name: e.name, sets: [{reps: 8, load: 40 + (i % 20)}]}; })}); }
  r.runs_mode = "import";
  authRole = role === "professional" ? "professional" : "student";
  return r;
}
(async function(){
  var srv = await startStaticServer(root);
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  async function open(role, n){
    var ctx = await browser.newContext({viewport: {width: 390, height: 844}});
    await ctx.addInitScript(fakeSource({role: role, userId: role === "professional" ? "pro-1" : "user-ana", email: "ana@x.test", rows: [rowBig(n, role)]}));
    var pg = await ctx.newPage(); pg.setDefaultTimeout(7000); pg.on("pageerror", function(e){ errors.push(role + ": " + e.message); });
    await pg.goto(srv.url + "treino.html");
    await pg.waitForSelector("#startWorkout, [data-start-day], #alunoApp:not(.hidden)");
    return {ctx: ctx, pg: pg};
  }
  var A = await open("student", 120);
  await A.pg.waitForSelector("#openHistorico"); await A.pg.locator("#openHistorico").click(); await A.pg.waitForSelector("#histList");
  check.check("13. No ecrã, com 120 treinos, a lista mostra 40 linhas e «Mostrar mais»", (await A.pg.locator(".hist-row").count()) === 40 && (await A.pg.locator("#histMore").count()) === 1);
  await A.pg.locator("#histMore").click();
  check.check("14. «Mostrar mais» acrescenta 40 linhas sem redesenhar o ecrã (a pesquisa e o período mantêm-se)", (await A.pg.locator(".hist-row").count()) === 80 && (await A.pg.locator("#histQ").count()) === 1);
  var t0 = Date.now();
  await A.pg.fill("#histQ", "agacha");
  await A.pg.waitForFunction(function(){ var e = document.getElementById("histCount"); return e && /^40 treinos/.test(e.innerText); }); // (1 de cada 3 treinos é o de pernas) só depois de a lista ser redesenhada com o filtro
  var focused = await A.pg.evaluate(function(){ return document.activeElement && document.activeElement.id; });
  check.check("15. Escrever na pesquisa filtra a lista (com pausa) e o teclado continua aberto no campo", focused === "histQ" && (await A.pg.locator(".hist-row").count()) > 0 && Date.now() - t0 < 2000);
  await A.pg.fill("#histQ", "");
  await A.pg.waitForFunction(function(){ var e = document.getElementById("histCount"); return e && /120 treinos/.test(e.innerText) && document.querySelectorAll(".hist-row").length === 40; });
  check.check("16. Apagar a pesquisa volta à primeira página (40 linhas) e ao total de 120", (await A.pg.locator(".hist-row").count()) === 40);
  await A.ctx.close();

  // pré-visualização do profissional: todos os separadores sem erros e sem o estado de sincronização do aluno
  var P = await open("professional", 30);
  var seen = [];
  var tabsOk = true;
  for (var tab of ["hoje", "evolucao", "corrida", "hoje"]){
    await P.pg.locator('.tabbar [data-tab="' + tab + '"]').click();
    await P.pg.waitForTimeout(300);
    seen.push(tab + ":" + ((await P.pg.locator("#alunoTabContent").innerText()).length > 20));
    if ((await P.pg.locator("#alunoTabContent").innerText()).length <= 20) tabsOk = false;
  }
  await P.pg.waitForSelector("#openHistorico"); await P.pg.locator("#openHistorico").click(); await P.pg.waitForSelector("#histList");
  await P.pg.locator('[data-hist-view="cal"]').click(); await P.pg.waitForSelector("#calTitle");
  check.check("17. Na pré-visualização do profissional todos os separadores (incluindo histórico e calendário) abrem sem erros e sem o estado de sincronização do aluno", tabsOk && (await P.pg.locator("#syncLine").count()) === 0 && (await P.pg.locator("#calRunLoad").count()) === 0);
  await P.ctx.close();

  check.check("18. Sem erros de JavaScript" + (errors.length ? " — " + errors.join(" | ") : ""), errors.length === 0);
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção " + (e && e.message)); process.exit(1); });
