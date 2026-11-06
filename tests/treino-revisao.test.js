// EVOLVE Treino, revisão abrangente: último treino e «sem plano», pesquisa por data, calendário e resumo do mês (treinos e corridas), pontos-chave no exercício,
// descanso ajustado por exercício, notas, aviso de «sincronizado», recuperação de erros ao desenhar e ecrãs baixos/horizontais.
// O que não se vê aqui: o toque real num telemóvel, a rotação verdadeira do aparelho e o iOS/Android a fechar a app.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var fs = require("fs"), path = require("path");
function iso(daysAgo){ return isoOfLocalDate(new Date(Date.now() - daysAgo * 86400000)); }
function log(id, daysAgo, dayName, name, sets, notes){ return {id: id, date: iso(daysAgo), dayId: "d1", dayName: dayName, rpe: 7, notes: notes || "", entries: [{exerciseId: "e1", name: name, sets: sets}]}; }

// ---- Node ----
authRole = "student";
var s1 = {id: "x", workoutLogs: [log("a", 0, "Treino A", "Supino", [{reps: 8, load: 50}]), log("b", 4, "Treino B — Pernas", "Agachamento", [{reps: 8, load: 60}])]};
check.check("1. «Último treino» diz hoje, ontem ou há N dias, com o nome do treino e a data", /Treino A<\/b> · hoje/.test(lastWorkoutLine(s1)) && /há 4 dias/.test(lastWorkoutLine({workoutLogs: [s1.workoutLogs[1]]})) && /ontem/.test(lastWorkoutLine({workoutLogs: [log("c", 1, "X", "Y", [{reps: 5, load: 1}])]})) && lastWorkoutLine({workoutLogs: []}) === "");
var noPlan = tplTodayWorkout({id: "np", workoutLogs: s1.workoutLogs, trainingProgram: {days: []}});
check.check("2. Sem treino planeado: explica o estado (programa a ser preparado, o que acontece depois) e mostra o último treino feito", /id="noPlan"/.test(noPlan) && /ainda está a ser preparado/.test(noPlan) && /Quando houver treinos no programa/.test(noPlan) && /id="lastWorkout"/.test(noPlan));
var fixed = new Date(2026, 10, 5).getTime();
var hs = {workoutLogs: [log("h1", 1, "Treino A — Peito", "Supino reto", [{reps: 8, load: 50}], "ombro direito sensível"), log("h2", 8, "Treino B — Pernas", "Agachamento", [{reps: 10, load: 60}])]};
var d1 = hs.workoutLogs[0].date, ddmm = d1.slice(8) + "/" + d1.slice(5, 7);
state.histQ = ddmm; state.histPeriod = "all";
check.check("3. Pesquisa por data (dd/mm) encontra o treino desse dia", histFiltered(hs).map(function(l){ return l.id; }).join() === "h1");
state.histQ = "Ombro";
check.check("4. A pesquisa também procura nas notas da sessão (e ignora maiúsculas)", histFiltered(hs).map(function(l){ return l.id; }).join() === "h1");
state.histQ = "pernas agachamento";
check.check("5. Várias palavras: todas têm de aparecer (treino + exercício)", histFiltered(hs).map(function(l){ return l.id; }).join() === "h2");
state.histQ = "pernas supino";
check.check("6. …e se uma delas não existe nessa sessão, não há resultado", histFiltered(hs).length === 0);
var wd = new Date(d1 + "T00:00:00").toLocaleDateString("pt-PT", {weekday: "long"}).split("-")[0];
state.histQ = wd + " supino";
check.check("7. Pesquisa por dia da semana («" + wd + "») combinada com o exercício", histFiltered(hs).map(function(l){ return l.id; }).join() === "h1");
state.histQ = "";
check.check("8. A linha do histórico indica «com nota» quando a sessão tem nota", /com nota/.test(histRowHtml(hs, hs.workoutLogs[0], null)) && !/com nota/.test(histRowHtml(hs, hs.workoutLogs[1], null)));

// calendário
var key = calNowKey();
check.check("9. Navegação de meses: anterior/seguinte (inclui virar o ano) e nunca para o futuro", calShift("2026-01", -1) === "2025-12" && calShift("2026-12", 1) === "2027-01" && (state.calMonth = "2099-01", calMonthKey()) === "2099-01" && (state.calMonth = "lixo", calMonthKey()) === key);
state.calMonth = null;
var cs = {id: "c", workoutLogs: [log("m1", 0, "A", "Supino", [{reps: 8, load: 50}, {reps: 8, load: 50}]), log("m2", 0, "B", "Remada", [{reps: 10, load: 30}]), log("m3", 40, "A", "Supino", [{reps: 5, load: 40}])]};
var mm = calStrengthMonth(cs, iso(0).slice(0, 7));
check.check("10. O mês conta treinos, séries e dias com atividade só desse mês (o treino de há 40 dias fica de fora)", mm.sessions === 2 && mm.sets === 3 && mm.days === 1 && mm.volume === 800 + 300);
var ch = tplCalendario(cs);
check.check("11. O calendário tem 7 cabeçalhos de dia, botões só nos dias com treino (com rótulo «2 treinos»), o dia de hoje marcado e o resumo do mês", (ch.match(/class="cal-dow"/g) || []).length === 7 && (ch.match(/data-cal-day=/g) || []).length === 1 && /2 treinos/.test(ch) && /class="cal-cell today/.test(ch) && /id="calSummary"/.test(ch) && /2 treinos em 1 dia/.test(ch) && /disabled/.test(ch));
check.check("12. Sem Corrida ligada o calendário não fala de corrida", !/Corrida e bicicleta/.test(ch));
var d0 = tplCalendario({id: "c0", workoutLogs: []});
check.check("13. Mês sem treinos: diz «sem treinos neste mês» (sem inventar nada)", /sem treinos neste mês/.test(d0) && (d0.match(/data-cal-day=/g) || []).length === 0);

// semana: objetivo
var wk = tplSemanaResumo({id: "w", name: "A", trainingDays: [1, 3, 5], workoutLogs: [log("w1", 0, "A", "Supino", [{reps: 8, load: 50}])]});
check.check("14. O objetivo semanal (dias previstos) tem barra de progresso acessível; sem dias previstos não há barra nem meta inventada", /role="progressbar"/.test(wk) && /aria-valuemax="3"/.test(wk) && !/role="progressbar"/.test(tplSemanaResumo({id: "w", name: "A", trainingDays: [], workoutLogs: []})));

// recuperação de erros
var APP_MODE_SAVED = APP_MODE, home_saved = tplTreinoHome;
APP_MODE = "treino"; state.alunoTab = "hoje";
var fakeEl = {innerHTML: "", querySelector: function(){ return null; }, querySelectorAll: function(){ return []; }};
var origGet = document.getElementById; document.getElementById = function(id){ return id === "alunoTabContent" ? fakeEl : origGet.call(document, id); };
tplTreinoHome = function(){ throw new Error("falha simulada"); };
var errSaved = console.error; console.error = function(){};
var threw = false;
try { renderAlunoTab({id: "e", name: "E", workoutLogs: [], meals: [], weights: []}); } catch (e) { threw = true; }
console.error = errSaved; tplTreinoHome = home_saved; document.getElementById = origGet; APP_MODE = APP_MODE_SAVED;
check.check("15. Se desenhar um ecrã falha, não rebenta nem fica em branco: aparece «Algo correu mal» com «Tentar outra vez» e a garantia de que os treinos estão guardados", !threw && /id="tabError"/.test(fakeEl.innerHTML) && /Tentar outra vez/.test(fakeEl.innerHTML) && /continuam guardados neste telemóvel/.test(fakeEl.innerHTML));

// ficheiros
var root = path.join(__dirname, "..");
var corr = fs.readFileSync(path.join(root, "corrida.js"), "utf8"), css = fs.readFileSync(path.join(root, "app.css"), "utf8");
check.check("16. A Corrida expõe RUN.monthSummary (aditivo) e só lê dados da rede se lho pedirem (load === true)", /^RUN\.monthSummary = function\(s, monthKey, onChange, load\)/m.test(corr) && /if \(load === true && !d\.loading/.test(corr.slice(corr.indexOf("RUN.monthSummary"))));
check.check("17. Há regras para ecrãs baixos e orientação horizontal, e o conteúdo largo tem largura máxima", /@media \(max-height:520px\)/.test(css) && /orientation:landscape/.test(css) && /@media \(min-width:900px\)/.test(css));

// ---- Chromium ----
var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){ console.log("(ignorado o ecrã: Playwright/Chromium não disponíveis aqui)"); check.summarize(); }
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");
function rowAna(opts){
  opts = opts || {};
  authRole = "professional";
  var s = buildFullDemoStudent(); s.id = "ana"; s.name = "Ana Treina"; s.isDemo = false; s.active = true; s.photos = []; s.nutritionPhase = null;
  var day = s.trainingProgram.days[0];
  if (opts.noPlan) s.trainingProgram.days = [];
  else s.trainingProgram.days.forEach(function(d){ d.exercises.forEach(function(e){ e.cues = ["Omoplatas juntas e para baixo", "Pés firmes no chão"]; }); }); // o treino de «hoje» depende do dia da semana: todos têm pontos-chave
  var row = JSON.parse(JSON.stringify(studentToRow(s)));
  row.workout_logs = opts.noPlan || opts.logs === false ? [] : [0, 1, 2].map(function(i){
    return {id: "h" + i, date: iso(2 + i * 7), dayId: day.id, dayName: day.name, rpe: 7, notes: i === 0 ? "Ombro direito sensível" : "", entries: day.exercises.map(function(e){ return {exerciseId: e.id, name: e.name, sets: [{reps: 8, load: 40 + i, rir: 2}, {reps: 8, load: 40 + i}]}; })};
  });
  if (opts.runsMode) row.runs_mode = opts.runsMode;
  authRole = "student";
  return row;
}
(async function(){
  var srv = await startStaticServer(root);
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  async function open(o, vp){
    o = o || {};
    var ctx = await browser.newContext({viewport: vp || {width: 390, height: 844}});
    await ctx.addInitScript(fakeSource({role: "student", userId: "user-ana", email: "ana@x.test", rows: [rowAna(o)]}));
    if (o.runs) await ctx.addInitScript(function(rows){ window.__fake.tables.runs.push.apply(window.__fake.tables.runs, rows); }, o.runs);
    var pg = await ctx.newPage(); pg.setDefaultTimeout(7000); pg.on("pageerror", function(e){ errors.push(e.message); });
    var asked = []; pg.on("request", function(r){ asked.push(r.url()); });
    await pg.goto(srv.url + "treino.html");
    await pg.waitForSelector(o.noPlan ? "#noPlan" : "#startWorkout, [data-start-day]");
    return {ctx: ctx, pg: pg, asked: asked};
  }
  async function start(pg){ await pg.locator("#startWorkout, [data-start-day]").first().click(); await pg.waitForSelector("#wlDock"); }

  // arranque
  var N = await open({noPlan: true});
  check.check("18. Aluno sem programa: o cartão explica o estado de forma simples e não mostra botão de iniciar", /Quando houver treinos no programa/.test(await N.pg.locator("#noPlan").innerText()) && (await N.pg.locator("#startWorkout").count()) === 0);
  await N.ctx.close();
  var H = await open({});
  check.check("19. «Hoje» mostra o treino previsto, o último treino realizado e o botão para começar", /Último treino/.test(await H.pg.locator("#lastWorkout").innerText()) && (await H.pg.locator("#startWorkout, [data-start-day]").count()) >= 1);
  await H.ctx.close();

  // ecrã de treino: pontos-chave, descanso por exercício, notas
  var W = await open({});
  await start(W.pg);
  var cues = W.pg.locator(".wl-cues").first();
  await cues.locator("summary").click();
  check.check("20. Os pontos-chave do exercício ficam acessíveis no próprio ecrã de treino", /Omoplatas juntas/.test(await cues.evaluate(function(d){ return d.textContent; })) && (await cues.evaluate(function(d){ return d.open; })));
  var secsOf = function(t){ var m = /^(\d+):(\d\d)$/.exec(String(t).trim()); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : -1; };
  await W.pg.locator(".wl-done").first().click();
  var t0 = secsOf(await W.pg.locator("#restTimer .rt-time").innerText());
  await W.pg.locator('#restTimer [data-rt="+15"]').click();
  await W.pg.waitForTimeout(250);
  await W.pg.locator("#wlDockBtn").click();
  await W.pg.waitForTimeout(300);
  var t2 = secsOf(await W.pg.locator("#restTimer .rt-time").innerText());
  check.check("21. O descanso que ajustaste (+15 s sobre " + t0 + " s) passa a valer para as séries seguintes do mesmo exercício (agora " + t2 + " s)", t0 > 0 && t2 >= t0 + 13 && t2 <= t0 + 15);
  var total = await W.pg.locator("[data-wl-done]").count(), guard = 0;
  while ((await W.pg.locator("#wlDockBtn").getAttribute("data-mode")) === "set" && guard++ < total + 2) await W.pg.locator("#wlDockBtn").click();
  check.check("22. Quando todas as séries estão feitas a caixa «Como correu?» abre sozinha para escreveres a nota", (await W.pg.locator("#wlNotesBox").evaluate(function(d){ return d.open; })) === true);
  await W.pg.fill("#wlNotes", "Ombro bem hoje");
  await W.pg.locator("#wlSave").click();
  await W.pg.waitForFunction(function(){ return /Treino sincronizado/.test(document.body.innerText); }, null, {timeout: 9000});
  check.check("23. Depois de guardar, o aluno vê «Treino sincronizado» quando o servidor confirma (não só «guardado»)", true);
  await W.pg.waitForSelector("#openHistorico");
  await W.pg.locator("#openHistorico").click(); await W.pg.waitForSelector("#histQ");
  await W.pg.fill("#histQ", "bem hoje");
  check.check("24. A nota escrita encontra-se na pesquisa do histórico, e a linha diz «com nota»", /com nota/.test(await W.pg.locator("#histList").innerText()) && /1 treino/.test(await W.pg.locator("#histCount").innerText()));
  await W.ctx.close();

  // calendário com corridas
  var started = new Date(Date.now() - 60000).toISOString();
  var runRow = {id: "11111111-1111-4111-8111-000000000009", student_id: "ana", created_by: "user-ana", created_at: started, started_at: started, source: "gpx", duration_s: 1800, moving_s: 1780, distance_m: 5000, gaps: 0, gap_s: 0, hidden_s: 0, splits_s: [360, 355, 350, 362, 358], rpe: 6, notes: null, consent_v: 2};
  var C = await open({runsMode: "import", runs: [runRow]});
  await C.pg.locator("#openHistorico").click(); await C.pg.waitForSelector("[data-hist-view]");
  await C.pg.locator('[data-hist-view="cal"]').click(); await C.pg.waitForSelector("#calTitle");
  check.check("25. O calendário mostra o mês, a legenda e «Ver corridas do mês» sem ter pedido nada à Corrida ainda", (await C.pg.locator("#calRunLoad").count()) === 1 && !C.asked.some(function(u){ return /corrida/.test(u); }));
  await C.pg.locator("#calRunLoad").click();
  await C.pg.waitForFunction(function(){ var e = document.getElementById("calSummary"); return e && /1 atividade/.test(e.innerText); });
  var sum = await C.pg.locator("#calSummary").innerText();
  check.check("26. Depois de pedir, o resumo do mês junta os treinos e a corrida (atividades, distância, duração, ritmo)", /Musculação/.test(sum) && /1 atividade/.test(sum) && /5,00 km/.test(sum) && /ritmo médio/.test(sum));
  check.check("27. Os dias com corrida e com treino têm marcas diferentes (pontos) e rótulo falado para leitores de ecrã", (await C.pg.locator(".cal-cell .dot.r").count()) >= 1 && /atividade de corrida/.test(await C.pg.locator("button.cal-cell.today").getAttribute("aria-label")));
  await C.pg.locator("button.cal-cell.today").click();
  var dayTxt = await C.pg.locator("#modalRoot").innerText();
  check.check("28. Tocar num dia abre o resumo do dia com a corrida e o botão para a abrir no Cardio", /Corrida/.test(dayTxt) && /Abrir no Cardio/.test(dayTxt));
  await C.pg.locator("[data-day-run]").click();
  await C.pg.waitForSelector("#runBack, .run-detail, [data-run-del]", {timeout: 6000}).catch(function(){});
  check.check("29. «Abrir no Cardio» muda para o separador Cardio", await C.pg.locator('.tabbar [data-tab="corrida"]').evaluate(function(b){ return b.classList.contains("active"); }));
  await C.ctx.close();

  // calendário: meses e dia só com treino
  var K = await open({});
  await K.pg.locator("#openHistorico").click(); await K.pg.locator('[data-hist-view="cal"]').click(); await K.pg.waitForSelector("#calTitle");
  var title0 = await K.pg.locator("#calTitle").innerText();
  check.check("30. Não se avança para meses futuros (botão «seguinte» desativado) e dá para recuar", (await K.pg.locator('[data-cal-nav="1"]').isDisabled()) && (await (async function(){ await K.pg.locator('[data-cal-nav="-1"]').click(); return (await K.pg.locator("#calTitle").innerText()) !== title0; })()));
  await K.ctx.close();

  // ecrãs: horizontal, pequeno, largo
  var L = await open({}, {width: 844, height: 390});
  await start(L.pg); await L.pg.locator(".wl-done").first().click(); await L.pg.waitForTimeout(300);
  var land = await L.pg.evaluate(function(){ var h = function(sel){ var e = document.querySelector(sel); return e && !e.classList.contains("hidden") && !e.hidden ? e.getBoundingClientRect().height : 0; }; return {timer: h("#restTimer"), dock: h("#wlDock"), tab: h(".tabbar"), over: document.documentElement.scrollWidth > innerWidth, vh: innerHeight}; });
  check.check("31. Na horizontal (844×390) o cronómetro, a barra da série e o separador deixam pelo menos 200 px para o treino, sem scroll lateral", land.vh - land.timer - land.dock - land.tab >= 200 && !land.over);
  await L.ctx.close();
  var S = await open({}, {width: 320, height: 568});
  check.check("32. Em 320 px nada transborda em «Hoje»", !(await S.pg.evaluate(function(){ return document.documentElement.scrollWidth > innerWidth; })));
  await S.ctx.close();
  var X = await open({}, {width: 1280, height: 800});
  check.check("33. Num ecrã largo o conteúdo tem largura máxima (≤ 880 px) e fica centrado", await X.pg.locator(".aluno-tabs").evaluate(function(e){ var r = e.getBoundingClientRect(); return r.width <= 881 && Math.abs((r.left + r.right) / 2 - innerWidth / 2) < 40; }));
  await X.ctx.close();

  check.check("34. Sem erros de JavaScript" + (errors.length ? " — " + errors.join(" | ") : ""), errors.length === 0);
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção " + (e && e.message)); process.exit(1); });
