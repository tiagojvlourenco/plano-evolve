// EVOLVE Treino: registo de séries mais simples (série atual, repetições herdadas, séries marcadas sem repetições, retoma e estado do rascunho)
// e separador «Evolução» (período, exercício, recordes, última sessão vs anterior, volume), só com dados registados.
// O que não se vê aqui: o toque real num telemóvel (teclado, dedos, ecrã apagado a meio do treino) — só em iPhone/Android.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var fs = require("fs"), path = require("path");

// ---- Node: contas da evolução ----
function iso(daysAgo){ var d = new Date(Date.now() - daysAgo * 86400000); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
function log(id, daysAgo, name, sets){ return {id: id, date: iso(daysAgo), dayId: "d1", dayName: "A", rpe: 7, notes: "", entries: [{exerciseId: "e1", name: name, sets: sets}]}; }
var stu = {workoutLogs: [
  log("a", 40, "Supino", [{reps: 8, load: 40}, {reps: 8, load: 40}]),
  log("b", 20, "Supino", [{reps: 8, load: 50}, {reps: 6, load: 50}]),
  log("c", 3, "Supino", [{reps: 8, load: 55}, {reps: 8, load: 50, rir: 1}]),
  log("d", 3, "Flexões", [{reps: 12, load: 0}, {reps: 10, load: 0}])
]};
var list = evoExerciseList(stu);
check.check("1. A lista de exercícios vem só dos treinos registados, do mais frequente para o menos: Supino (3) e Flexões (1)", list.length === 2 && list[0].name === "Supino" && list[0].n === 3 && list[1].name === "Flexões");
var sup = evoSessions(stu, list[0]);
check.check("2. As sessões de um exercício vêm da mais antiga para a mais recente, com volume (repetições × carga) e 1RM estimado", sup.length === 3 && sup[0].date < sup[2].date && sup[2].volume === 8 * 55 + 8 * 50 && sup[2].topLoad === 55 && sup[2].est1RM > 55);
var fl = evoSessions(stu, list[1]);
check.check("3. Exercícios de peso do corpo contam repetições (kind «reps»), sem carga nem 1RM inventados", fl.length === 1 && fl[0].kind === "reps" && fl[0].topReps === 12 && fl[0].totalReps === 22 && fl[0].volume === 0);
var recBest = evoBest(sup, function(x){ return x.topLoad; });
check.check("4. O recorde de carga é o melhor de sempre, com a primeira data em que apareceu", recBest.v === 55 && recBest.date === iso(3));
var tot4 = evoTotals(stu, {days: 28}, 0), tot4prev = evoTotals(stu, {days: 28}, 1), totAll = evoTotals(stu, {days: null}, 0);
check.check("5. Os totais do período contam treinos, séries e volume; o período anterior e «Tudo» não se misturam", tot4.sessions === 3 && tot4.sets === 6 && tot4.volume === (8 * 50 + 6 * 50 + 8 * 55 + 8 * 50) && tot4prev.sessions === 1 && totAll.sessions === 4 && evoTotals(stu, {days: null}, 1).sessions === 0);
check.check("6. Um treino sem séries válidas não conta como sessão (sem repetições não há dados)", evoTotals({workoutLogs: [log("z", 1, "Supino", [{reps: 0, load: 50}])]}, {days: 28}, 0).sessions === 0 && evoExerciseList({workoutLogs: [log("z", 1, "Supino", [{reps: 0, load: 50}])]}).length === 0);
check.check("7. Diferenças: sobe, desce e igual com setas, sem cor de «bom/mau»; sem valor anterior não mostra nada", /▲ \+5 kg/.test(evoDelta(55, 50, " kg")) && /▼ −/.test(evoDelta(40, 50, " kg")) && /igual/.test(evoDelta(5, 5, "")) && evoDelta(5, 0, "") === "");
var emptyHtml = tplTreinoEvolucao({workoutLogs: [], name: "X", runsMode: "off"});
check.check("8. Sem treinos: mensagem clara, sem gráficos nem números inventados", /id="evoEmpty"/.test(emptyHtml) && /Ainda não há treinos registados/.test(emptyHtml) && !/evoRecords/.test(emptyHtml));
state.evoPeriod = "12"; state.evoExercise = null;
var html = tplTreinoEvolucao(stu);
check.check("9. Com dados: período, totais, exercício, recordes e comparação com a sessão anterior; o 1RM diz que é estimado", /data-evo-period="4"/.test(html) && /id="evoTotals"/.test(html) && /id="evoExSel"/.test(html) && /id="evoRecords"/.test(html) && /id="evoCompare"/.test(html) && /estimativa, não medido/.test(html));
state.evoExercise = "flexões";
var htmlBw = tplTreinoEvolucao(stu);
check.check("10. Peso do corpo: só recordes de repetições (sem «Carga máxima» nem «1RM»); com 1 sessão diz que falta a seguinte", !/Carga máxima/.test(htmlBw) && !/1RM estimado/.test(htmlBw) && /Mais repetições/.test(htmlBw) && /id="evoOneSession"/.test(htmlBw) && /id="evoNoChart"/.test(htmlBw));
state.evoExercise = null; state.evoPeriod = "4";
var h4 = tplTreinoEvolucao({workoutLogs: [log("old", 60, "Supino", [{reps: 8, load: 40}])]});
check.check("11. Período sem treinos: mensagem a sugerir um período maior (e os recordes de sempre continuam à vista)", /id="evoNoPeriod"/.test(h4) && /período maior/.test(h4) && /id="evoRecords"/.test(h4));
state.evoPeriod = null;

// ---- Chromium ----
var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){ console.log("(ignorado o ecrã: Playwright/Chromium não disponíveis aqui)"); check.summarize(); }
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");
function rowAna(withLogs){
  authRole = "professional";
  var s = buildFullDemoStudent(); s.id = "ana"; s.name = "Ana Treina"; s.isDemo = false; s.active = true; s.photos = []; s.nutritionPhase = null;
  var row = JSON.parse(JSON.stringify(studentToRow(s)));
  if (withLogs){
    row.workout_logs = [0, 1, 2, 3].map(function(i){
      var day = s.trainingProgram.days[0];
      return {id: "h" + i, date: iso(7 * (4 - i)), dayId: day.id, dayName: day.name, rpe: 7, notes: "", entries: day.exercises.map(function(e){ return {exerciseId: e.id, name: e.name, sets: [{reps: 8, load: 40 + i * 2.5}, {reps: 8, load: 40 + i * 2.5}]}; })};
    });
  } else row.workout_logs = [];
  return row;
}
(async function(){
  var srv = await startStaticServer(path.join(__dirname, ".."));
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  async function open(withLogs, ctxIn){
    var ctx = ctxIn || await browser.newContext({viewport: {width: 390, height: 844}});
    if (!ctxIn) await ctx.addInitScript(fakeSource({role: "student", userId: "user-ana", email: "ana@x.test", rows: [rowAna(withLogs)]}));
    var pg = await ctx.newPage(); pg.setDefaultTimeout(6000); pg.on("pageerror", function(e){ errors.push(e.message); });
    await pg.goto(srv.url + "treino.html");
    await pg.waitForSelector("#startWorkout, [data-start-day]");
    return {ctx: ctx, pg: pg};
  }
  async function start(pg){ await pg.locator("#startWorkout, [data-start-day]").first().click(); await pg.waitForSelector(".wl-set"); }
  async function tick(pg, n){ await pg.locator(".wl-done").nth(n).click(); }

  // --- registo ---
  var A = await open(false);
  await start(A.pg);
  var nSets = await A.pg.locator(".wl-set").count();
  check.check("12. Ao abrir o treino há exatamente uma série «atual» (a primeira por fazer) e cada exercício mostra 0/n", (await A.pg.locator(".wl-set.current").count()) === 1 && (await A.pg.locator(".wl-set").first().getAttribute("aria-current")) === "step" && /^0\/\d$/.test(await A.pg.locator("[data-ex-count]").first().innerText()) && /Faltam \d+ séries/.test(await A.pg.locator("#wlRemain").innerText()));
  var repsFirst = await A.pg.locator("[data-wl-reps]").first().inputValue();
  await A.pg.locator("[data-wl-reps]").first().fill("10");
  await tick(A.pg, 0);
  check.check("13. Marcar ✓ passa a série atual para a seguinte, sobe o contador do exercício e atualiza «Faltam»", (await A.pg.evaluate(function(){ return [].findIndex.call(document.querySelectorAll(".wl-set"), function(r){ return r.classList.contains("current"); }); })) === 1 && /^1\/\d$/.test(await A.pg.locator("[data-ex-count]").first().innerText()) && new RegExp("Faltam " + (nSets - 1) + " séries").test(await A.pg.locator("#wlRemain").innerText()));
  check.check("14. A série seguinte herda as repetições que acabaste de fazer (10, e não as 8 da prescrição «" + repsFirst + "»)", (await A.pg.locator("[data-wl-reps]").nth(1).inputValue()) === "10");
  await A.pg.locator("[data-wl-reps]").nth(1).fill("6"); // o aluno muda a segunda; a terceira herda 6 ao marcar a segunda
  await tick(A.pg, 1);
  check.check("15. Se alteras as repetições de uma série, a seguinte herda o novo valor (6), mas o que já tinhas alterado na seguinte não é sobrescrito", (await A.pg.locator("[data-wl-reps]").nth(2).inputValue()) === "6");
  // série marcada sem repetições: assinalada, a marca não se desfaz, e a pergunta ao terminar avisa
  await A.pg.locator("[data-wl-reps]").nth(2).fill("");
  await tick(A.pg, 2);
  check.check("16. Marcar uma série sem repetições assinala-a (não desfaz a marca nem a regista às escondidas)", (await A.pg.locator(".wl-set").nth(2).evaluate(function(r){ return r.classList.contains("needs-reps"); })) && (await A.pg.locator('[data-wl-done]').nth(2).isChecked()) && (await A.pg.locator("[data-wl-reps]").nth(2).getAttribute("aria-invalid")) === "true");
  await A.pg.locator("#wlSave").click();
  var modalTxt = await A.pg.locator("#modalRoot").innerText();
  check.check("17. Ao terminar, a pergunta diz quantas séries marcadas estão sem repetições e que não são registadas", /sem repetições e não é registada/.test(modalTxt) && /Marcaste 3 de/.test(modalTxt));
  await A.pg.locator("#wlFinishNo").click();
  await A.pg.locator("[data-wl-reps]").nth(2).fill("8");
  check.check("18. Escrever as repetições tira o aviso da série", (await A.pg.locator(".wl-set.needs-reps").count()) === 0);
  var status1 = await A.pg.locator("#wlStatus").innerText();
  check.check("19. A linha de estado diz que o treino em curso está guardado neste telemóvel, com a hora", /guardado neste telemóvel às \d\d:\d\d/.test(status1));

  // --- retoma: fechar e voltar a abrir ---
  var ls = await A.pg.evaluate(function(){ return localStorage.getItem("evolve_wl_draft_v1"); });
  check.check("20. O rascunho está no telemóvel com as séries marcadas e as repetições escritas", /"done":true/.test(ls) && /"reps":"10"/.test(ls));
  await A.pg.reload();
  await A.pg.waitForSelector("#startWorkout");
  check.check("21. Ao reabrir, «Hoje» mostra «Treino em curso» com as séries já marcadas", /Treino em curso/i.test(await A.pg.locator(".today-workout").first().innerText()) && /3\/\d+ séries/.test(await A.pg.locator(".today-workout").first().innerText()));
  await A.pg.locator("#startWorkout").click(); await A.pg.waitForSelector(".wl-set");
  check.check("22. Ao continuar, aparece o aviso «Retomaste o treino em curso» e as séries e valores estão como ficaram", (await A.pg.locator("#wlRestored").count()) === 1 && (await A.pg.locator('[data-wl-done]').nth(0).isChecked()) && (await A.pg.locator("[data-wl-reps]").nth(0).inputValue()) === "10" && (await A.pg.locator(".wl-set.current").count()) === 1);
  await A.pg.locator("[data-wl-reps]").nth(3).fill("9");
  check.check("23. O aviso de retoma desaparece no primeiro toque", (await A.pg.locator("#wlRestored").count()) === 0);
  // recomeçar do zero (com confirmação)
  await A.pg.reload(); await A.pg.waitForSelector("#startWorkout"); await A.pg.locator("#startWorkout").click(); await A.pg.waitForSelector("#wlRestart");
  await A.pg.locator("#wlRestart").click();
  await A.pg.locator("#wlRestartNo").click();
  check.check("24. «Recomeçar» pede confirmação e, se escolheres manter, nada se perde", (await A.pg.locator('[data-wl-done]:checked').count()) === 3);
  await A.pg.locator("#wlRestart").click(); await A.pg.locator("#wlRestartYes").click();
  check.check("25. Confirmando, o treino recomeça do zero e o rascunho é apagado", (await A.pg.locator('[data-wl-done]:checked').count()) === 0 && !/"done":true/.test(await A.pg.evaluate(function(){ return localStorage.getItem("evolve_wl_draft_v1") || ""; })));
  // o telemóvel não deixa guardar: avisa
  await A.pg.evaluate(function(){ Storage.prototype.setItem = function(){ throw new Error("QuotaExceededError"); }; });
  await tick(A.pg, 0);
  check.check("26. Se o telemóvel não deixa guardar o rascunho, a linha de estado avisa para não fechar a app", /não deixou guardar/.test(await A.pg.locator("#wlStatus").innerText()) && (await A.pg.locator("#wlStatus").evaluate(function(e){ return e.classList.contains("bad"); })));
  await A.ctx.close();

  // --- terminar o treino continua a guardar só séries com repetições, e o recorde aparece ---
  var B = await open(true);
  await start(B.pg);
  await tick(B.pg, 0); await tick(B.pg, 1);
  await B.pg.locator("#wlSave").click(); await B.pg.locator("#wlFinishYes").click();
  await B.pg.waitForTimeout(2500);
  var saved = await B.pg.evaluate(function(){ var r = window.__fake.rows[0].workout_logs, l = r[r.length - 1]; return {n: r.length, sets: l.entries.reduce(function(a, e){ return a + e.sets.length; }, 0)}; });
  check.check("27. Terminar grava só as 2 séries marcadas (as outras não entram) e acrescenta um treino ao histórico", saved.n === 5 && saved.sets === 2);

  // --- evolução ---
  var E = await open(true);
  await E.pg.locator('.tabbar [data-tab="evolucao"]').click(); await E.pg.waitForSelector("#evoExercise");
  var tabsTxt = await E.pg.locator(".tabbar button").allInnerTexts();
  check.check("28. O EVOLVE Treino tem o separador «Evolução» (Treino, Evolução, Cardio) e o aluno vê totais, exercício e recordes", tabsTxt.map(function(t){ return t.trim(); }).join("|") === "Treino|Evolução|Cardio" && (await E.pg.locator("#evoTotals").count()) === 1 && (await E.pg.locator("#evoRecords").count()) === 1);
  var t12 = await E.pg.locator("#evoTotals").innerText();
  await E.pg.locator('[data-evo-period="4"]').click();
  var t4 = await E.pg.locator("#evoTotals").innerText();
  check.check("29. Mudar o período (12 semanas → 4 semanas) muda os totais e fica marcado", t12 !== t4 && (await E.pg.locator('[data-evo-period="4"]').getAttribute("aria-pressed")) === "true");
  var firstName = await E.pg.locator("#evoExSel option").nth(1).innerText();
  await E.pg.selectOption("#evoExSel", {index: 1});
  check.check("30. Escolher outro exercício mostra os recordes desse exercício", (await E.pg.locator("#evoExSel option:checked").innerText()) === firstName);
  var cmp = await E.pg.locator("#evoCompare").innerText();
  check.check("31. Há comparação com a sessão anterior e o gráfico de 1RM diz que é uma estimativa", /vs \d\d\/\d\d\/\d{4}/.test(cmp) && /Epley/.test(await E.pg.locator("#evoExercise").innerText()));
  check.check("32. Em 390 px nada transborda e os botões de período têm ≥ 44 px", !(await E.pg.evaluate(function(){ return document.documentElement.scrollWidth > window.innerWidth; })) && (await E.pg.locator("[data-evo-period]").first().evaluate(function(b){ return b.getBoundingClientRect().height; })) >= 44);
  await E.pg.locator('.tabbar [data-tab="corrida"]').click();
  check.check("33. O separador Cardio continua a abrir (a Corrida não foi tocada)", /Corrida|Cardio/i.test(await E.pg.locator("#alunoTabContent").innerText()));
  await E.ctx.close();

  var F = await open(false);
  await F.pg.locator('.tabbar [data-tab="evolucao"]').click(); await F.pg.waitForSelector("#evoEmpty");
  check.check("34. Aluno sem treinos: a Evolução diz que ainda não há dados (sem gráficos vazios)", /Ainda não há treinos registados/.test(await F.pg.locator("#alunoTabContent").innerText()) && (await F.pg.locator("#evoRecords").count()) === 0);
  await F.ctx.close();

  check.check("35. Sem erros de JavaScript" + (errors.length ? " — " + errors.join(" | ") : ""), errors.length === 0);
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção " + (e && e.message)); process.exit(1); });
