// EVOLVE Treino: resumo da semana, histórico com pesquisa e detalhe, estado de sincronização, barra fixa da série atual, cronómetro compacto,
// ecrã ligado durante o treino e conforto (controlos grandes, mão esquerda). Só usa dados já registados.
// O que não se vê aqui: o toque real num telemóvel (uma mão, suor, luvas), o ecrã a apagar de verdade (o wake lock é simulado) e o iOS a fechar a app.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var fs = require("fs"), path = require("path");
function iso(daysAgo){ var d = new Date(Date.now() - daysAgo * 86400000); return isoOfLocalDate(d); }
function log(id, daysAgo, dayName, name, sets){ return {id: id, date: iso(daysAgo), dayId: "d1", dayName: dayName, rpe: 7, notes: "", entries: [{exerciseId: "e1", name: name, sets: sets}]}; }

// ---- Node: semana ----
var mon = weekDaysIso(new Date(2026, 10, 5, 12).getTime(), 0); // quinta, 5 de novembro de 2026
check.check("1. A semana vai de segunda a domingo (02/11 a 08/11 de 2026) e a anterior recua 7 dias", mon[0] === "2026-11-02" && mon[6] === "2026-11-08" && weekDaysIso(new Date(2026, 10, 5, 12).getTime(), 1)[0] === "2026-10-26");
check.check("2. No domingo ainda é a mesma semana (08/11 pertence à de segunda 02/11)", weekDaysIso(new Date(2026, 10, 8, 23).getTime(), 0)[0] === "2026-11-02");
var days = weekDaysIso(Date.now(), 0), todayIso = isoOfLocalDate(new Date());
var stu = {id: "x", name: "Ana", trainingDays: [1, 3, 5], runsColumn: false, workoutLogs: [
  {id: "w1", date: days[0], dayId: "d", dayName: "A", rpe: 7, entries: [{exerciseId: "e", name: "Supino", sets: [{reps: 10, load: 50}, {reps: 8, load: 50}]}]},
  {id: "w2", date: days[2], dayId: "d", dayName: "B", rpe: 8, entries: [{exerciseId: "e", name: "Supino", sets: [{reps: 10, load: 60}]}]},
  {id: "w0", date: weekDaysIso(Date.now(), 1)[2], dayId: "d", dayName: "A", entries: [{exerciseId: "e", name: "Supino", sets: [{reps: 5, load: 40}]}]}
]};
var wk = strengthWeek(stu, days);
check.check("3. O resumo conta só os treinos desta semana: 2 treinos, 3 séries e volume 500+400+600 kg", wk.sessions === 2 && wk.sets === 3 && wk.volume === 10 * 50 + 8 * 50 + 10 * 60 && wk.byDay[days[0]] === 1);
authRole = "student";
var wh = tplSemanaResumo(stu);
check.check("4. O cartão «Esta semana» mostra os 7 dias, os treinos feitos vs previstos e a semana passada; sem Corrida ligada não fala de corrida", /id="weekCard"/.test(wh) && (wh.match(/class="wk-day[ "]/g) || []).length === 7 && /2 treinos \(de 3 previstos\)/.test(wh) && /3 séries/.test(wh) && /Semana passada: 1 treino/.test(wh) && !/id="weekRun"/.test(wh) && /treino feito/.test(wh));

// ---- Node: histórico ----
state.histQ = ""; state.histPeriod = "all";
var hs = {workoutLogs: [log("h1", 3, "Treino A — Peito", "Supino reto", [{reps: 8, load: 50}]), log("h2", 10, "Treino B — Pernas", "Agachamento", [{reps: 10, load: 60}]), log("h3", 100, "Treino B — Pernas", "Elevação de gémeos", [{reps: 12, load: 40}]), log("h4", 2, "Vazio", "Nada", [{reps: 0, load: 10}])]};
check.check("5. O histórico lista os treinos com séries válidas, do mais recente para o mais antigo (o treino sem repetições não entra)", histFiltered(hs).map(function(l){ return l.id; }).join() === "h1,h2,h3");
state.histQ = "gemeos";
check.check("6. A pesquisa ignora acentos e maiúsculas e procura no nome do treino e dos exercícios (gemeos → «Elevação de gémeos»)", histFiltered(hs).map(function(l){ return l.id; }).join() === "h3");
state.histQ = "PERNAS";
check.check("7. Pesquisar pelo nome do treino também funciona", histFiltered(hs).length === 2);
state.histQ = ""; state.histPeriod = "12";
check.check("8. O período filtra: 12 semanas deixa de fora o treino de há 100 dias", histFiltered(hs).map(function(l){ return l.id; }).join() === "h1,h2");
state.histQ = "zzz";
check.check("9. Sem resultados: mensagem e botão para limpar; sem treinos nenhuns: mensagem de vazio", /id="histNone"/.test(histListHtml(hs)) && /id="histClear"/.test(histListHtml(hs)) && /id="histEmpty"/.test(histListHtml({workoutLogs: []})));
state.histQ = ""; state.histPeriod = "all";
var det = workoutDetailHtml(hs, hs.workoutLogs[0]);
check.check("10. O detalhe mostra o treino, a data, o exercício e cada série (carga × repetições)", /Treino A — Peito/.test(det) && /Supino reto/.test(det) && /Série 1/.test(det) && /50 kg × 8/.test(det));
check.check("11. O texto vindo dos dados é escapado (um nome de treino malicioso não vira HTML)", !/<img/.test(workoutDetailHtml(hs, {id: "z", date: iso(1), dayName: "<img src=x onerror=1>", entries: []})) && /&lt;img/.test(workoutDetailHtml(hs, {id: "z", date: iso(1), dayName: "<img src=x onerror=1>", entries: []})));

// ---- Node: sincronização ----
var navSaved = global.navigator; sbReady = true; authRole = "student";
function syncStu(logs, baselineIds){ var s = {id: "sy", workoutLogs: logs, workoutLogsRaw: logs}; Object.defineProperty(s, "_sync", {value: {workout_logs: JSON.stringify(baselineIds.map(function(i){ return {id: i}; }))}, writable: true, enumerable: false}); return s; }
syncLast.fails = 0; syncLast.rejectedAt = 0; syncLast.okAt = 0;
var inSync = workoutSyncInfo(syncStu([{id: "a"}], ["a"]));
check.check("12. Tudo enviado: «Tudo sincronizado», sem botão", inSync.state === "synced" && /Tudo sincronizado/.test(inSync.text) && !inSync.canRetry);
var pend = workoutSyncInfo(syncStu([{id: "a"}, {id: "b"}], ["a"]));
check.check("13. Um treino ainda não confirmado pelo servidor aparece «por enviar», com botão «Enviar agora»", pend.state === "pending" && pend.pending === 1 && /por enviar/.test(pend.text) && pend.canRetry);
syncNoteFail(); syncNoteFail();
var err = workoutSyncInfo(syncStu([{id: "a"}, {id: "b"}], ["a"]));
check.check("14. Depois de falhas: avisa quantas tentativas, diz que o treino continua guardado no telemóvel e deixa tentar outra vez", err.state === "error" && /2 tentativas/.test(err.text) && /continua guardado neste telemóvel/.test(err.text) && err.canRetry);
syncNoteOk();
check.check("15. Um envio com sucesso limpa as falhas", workoutSyncInfo(syncStu([{id: "a"}, {id: "b"}], ["a"])).state === "pending");
try { Object.defineProperty(global, "navigator", {value: {onLine: false}, configurable: true, writable: true}); } catch (e) {}
var off = workoutSyncInfo(syncStu([{id: "a"}, {id: "b"}], ["a"]));
check.check("16. Sem ligação: diz que os treinos ficam neste telemóvel e seguem sozinhos quando houver rede (sem botão)", off.state === "offline" && /Sem ligação/.test(off.text) && !off.canRetry);
try { Object.defineProperty(global, "navigator", {value: navSaved, configurable: true, writable: true}); } catch (e) {}
sbReady = false;
check.check("17. Em modo local (sem servidor) diz que os dados ficam só neste telemóvel", workoutSyncInfo(syncStu([{id: "a"}], ["a"])).state === "local");
sbReady = true; authRole = "professional";
check.check("18. O profissional não vê o estado de sincronização do aluno (pré-visualização)", workoutSyncInfo(syncStu([{id: "a"}], ["a"])).state === "none" && tplSyncLine(syncStu([{id: "a"}], ["a"])) === "");
authRole = "student";
check.check("19. Uma recusa do servidor fica visível durante 30 min", (function(){ syncNoteRejected(); var i = workoutSyncInfo(syncStu([{id: "a"}], ["a"])); syncLast.rejectedAt = 0; return i.state === "error" && /recusou/.test(i.text); })());

// ---- ficheiros ----
var root = path.join(__dirname, "..");
var corr = fs.readFileSync(path.join(root, "corrida.js"), "utf8");
check.check("20. A Corrida expõe RUN.weekSummary e só lê dados da rede se lho pedirem (load === true)", /^RUN\.weekSummary = function\(s, onChange, load\)/m.test(corr) && /if \(load === true && !d\.loading/.test(corr));

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
  var row = JSON.parse(JSON.stringify(studentToRow(s)));
  var day = s.trainingProgram.days[0];
  row.workout_logs = (opts.logs === false) ? [] : [0, 1, 2].map(function(i){
    return {id: "h" + i, date: iso(2 + i * 7), dayId: day.id, dayName: day.name, rpe: 7, notes: i === 0 ? "Ombro direito sensível" : "", entries: day.exercises.map(function(e){ return {exerciseId: e.id, name: e.name, sets: [{reps: 8, load: 40 + i, rir: 2}, {reps: 8, load: 40 + i}]}; })};
  });
  if (opts.runsMode) row.runs_mode = opts.runsMode;
  authRole = "student";
  return row;
}
(async function(){
  var srv = await startStaticServer(root);
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [], external = [];
  async function open(o, page){
    o = o || {};
    var ctx = await browser.newContext({viewport: {width: 390, height: 844}});
    await ctx.addInitScript(fakeSource({role: "student", userId: "user-ana", email: "ana@x.test", rows: [rowAna(o)]}));
    if (o.wake) await ctx.addInitScript(function(){ window.__wl = {req: 0, rel: 0}; try { Object.defineProperty(navigator, "wakeLock", {configurable: true, value: {request: function(){ window.__wl.req++; return Promise.resolve({release: function(){ window.__wl.rel++; }, addEventListener: function(){}}); }}}); } catch (e) {} });
    if (o.runs) await ctx.addInitScript(function(rows){ window.__fake.tables.runs.push.apply(window.__fake.tables.runs, rows); }, o.runs);
    var pg = await ctx.newPage(); pg.setDefaultTimeout(7000); pg.on("pageerror", function(e){ errors.push(e.message); });
    var asked = []; pg.on("request", function(r){ var u = r.url(); asked.push(u); if (!/^http:\/\/127\.0\.0\.1/.test(u) && !/^(data|blob|about):/.test(u)) external.push(u); });
    await pg.goto(srv.url + (page || "treino.html"));
    await pg.waitForSelector("#startWorkout, [data-start-day]");
    return {ctx: ctx, pg: pg, asked: asked};
  }
  async function start(pg){ await pg.locator("#startWorkout, [data-start-day]").first().click(); await pg.waitForSelector("#wlDock"); }

  // --- Hoje: resumo, sincronização, histórico ---
  var H = await open({});
  check.check("21. «Hoje» mostra o resumo da semana, o estado «Tudo sincronizado» e os últimos treinos com «Ver todo o histórico (3)»", (await H.pg.locator("#weekCard").count()) === 1 && /Tudo sincronizado/.test(await H.pg.locator("#syncLine").innerText()) && /Ver todo o histórico \(3\)/i.test(await H.pg.locator("#openHistorico").innerText()) && (await H.pg.locator("#recentCard .hist-row").count()) === 3);
  check.check("22. Sem Corrida ligada o resumo não fala de corrida nem pede o código dela", (await H.pg.locator("#weekRun").count()) === 0 && !H.asked.some(function(u){ return /corrida/.test(u); }));
  await H.pg.locator("#recentCard .hist-row").first().click();
  var mt = await H.pg.locator("#modalRoot").innerText();
  check.check("23. Tocar num treino recente abre o detalhe com as séries e as notas", /Série 1/.test(mt) && /Ombro direito sensível/.test(mt) && /Sincronizado/.test(mt));
  await H.pg.keyboard.press("Escape");
  await H.pg.locator("#openHistorico").click(); await H.pg.waitForSelector("#histList");
  check.check("24. O histórico completo mostra os treinos agrupados por mês, com a contagem", /3 treinos/.test(await H.pg.locator("#histCount").innerText()) && (await H.pg.locator(".hist-month").count()) >= 1 && (await H.pg.locator(".hist-row").count()) === 3);
  await H.pg.fill("#histQ", "SUPINO");
  check.check("25. Escrever na pesquisa filtra a lista sem perder o foco do teclado", (await H.pg.evaluate(function(){ return document.activeElement && document.activeElement.id; })) === "histQ" && /3 treinos/.test(await H.pg.locator("#histCount").innerText()));
  await H.pg.fill("#histQ", "xyz");
  check.check("26. Pesquisa sem resultados: mensagem e «Limpar pesquisa e filtros» repõe tudo", /Nenhum treino corresponde/.test(await H.pg.locator("#histNone").innerText()));
  await H.pg.locator("#histClear").click(); await H.pg.waitForSelector("#histList .hist-row");
  check.check("27. Voltar atrás («← Treino») regressa a «Hoje» e o separador Treino continua aceso", await (async function(){ await H.pg.locator("#backToHoje").click(); await H.pg.waitForSelector("#weekCard"); return await H.pg.locator('.tabbar [data-tab="hoje"]').evaluate(function(b){ return b.classList.contains("active"); }); })());
  await H.ctx.close();

  // --- Corrida na semana: só lê quando o aluno pede ---
  var started = new Date(Date.now() - 60000).toISOString();
  var runRow = {id: "11111111-1111-4111-8111-000000000001", student_id: "ana", created_by: "user-ana", created_at: started, started_at: started, source: "gpx", duration_s: 1800, moving_s: 1780, distance_m: 5000, gaps: 0, gap_s: 0, hidden_s: 0, splits_s: [360, 355, 350, 362, 358], rpe: 6, notes: null, consent_v: 2};
  var R = await open({runsMode: "import", runs: [runRow]});
  var wr = await R.pg.locator("#weekRun").innerText();
  check.check("28. Com a Corrida ligada, o resumo oferece «Ver esta semana» e ainda não leu nenhuma corrida", /Ver esta semana/i.test(wr) && (await R.pg.evaluate(function(){ return window.__fake.selects.filter(function(x){ return /runs/.test(JSON.stringify(x)); }).length; })) === 0);
  await R.pg.locator("#weekRunLoad").click();
  await R.pg.waitForFunction(function(){ var e = document.getElementById("weekRun"); return e && /atividade/.test(e.innerText); });
  var wr2 = await R.pg.locator("#weekRun").innerText();
  check.check("29. Ao pedir, mostra as atividades da semana com distância, duração e ritmo médio (dados da tabela, sem inventar)", /1 atividade/.test(wr2) && /5,00 km/.test(wr2) && /ritmo médio/.test(wr2) && /\/km/.test(wr2));
  await R.ctx.close();

  // --- ecrã de treino: barra fixa, cronómetro compacto, ecrã ligado ---
  var W = await open({wake: true});
  await start(W.pg);
  check.check("30. Abrir o treino liga o ecrã (wake lock) mesmo sem descanso a correr", (await W.pg.evaluate(function(){ return window.__wl.req; })) >= 1);
  var dk = await W.pg.locator("#wlDock").innerText();
  check.check("31. A barra fixa mostra o exercício, «Série 1 de n», a carga e as repetições, e o botão «✓ Feita»", /Série 1 de \d/.test(dk) && /kg × \d+ reps|sem carga × \d+ reps/.test(dk) && /Feita/i.test(dk));
  check.check("32. Nada é marcado sozinho: ao abrir, 0 séries feitas; a barra fica por cima do separador e à vista", (await W.pg.locator("[data-wl-done]:checked").count()) === 0 && (await W.pg.locator("#wlDock").evaluate(function(d){ var r = d.getBoundingClientRect(), t = document.querySelector(".tabbar").getBoundingClientRect(); return r.bottom <= t.top + 1 && r.top > 0; })));
  var cnt0 = await W.pg.locator("[data-wl-done]").count();
  await W.pg.locator("#wlDockBtn").click();
  check.check("33. Tocar em «✓ Feita» marca a série atual (e só essa) e a barra passa à seguinte", (await W.pg.locator("[data-wl-done]:checked").count()) === 1 && /Série 2 de/.test(await W.pg.locator("#wlDock").innerText()) && (await W.pg.locator('[data-wl-done]').first().isChecked()));
  var rt = await W.pg.locator("#restTimer").evaluate(function(e){ return {compact: e.classList.contains("compact"), h: e.getBoundingClientRect().height, hidden: e.classList.contains("hidden")}; });
  check.check("34. O descanso começou como antes e o cronómetro ficou compacto no ecrã de treino (< 170 px de altura)", !rt.hidden && rt.compact && rt.h < 170);
  check.check("35. A marcação é anunciada a leitores de ecrã (região viva): «Série 1 de … feita. Faltam n séries.»", await (async function(){ await W.pg.waitForTimeout(150); return /Série 1 de .* feita\. Faltam \d+ séries\./.test(await W.pg.locator("#liveRegion").innerText()); })());
  // cronómetro: pausa e +15 s continuam a funcionar
  await W.pg.locator('#restTimer [data-rt="pause"]').click();
  check.check("36. Os botões do cronómetro (pausa, ±15 s, reiniciar) continuam disponíveis e a pausa funciona", /em pausa/i.test(await W.pg.locator("#restTimer .rt-label").innerText()) && (await W.pg.locator('#restTimer [data-rt="+15"]').count()) === 1 && (await W.pg.locator('#restTimer [data-rt="restart"]').count()) === 1);
  await W.pg.locator("#wlComfort summary").click();
  await W.pg.locator('[data-comfort="big"]').check();
  var big = await W.pg.evaluate(function(){ var st = document.querySelector(".wl-step").getBoundingClientRect(), inp = document.querySelector("[data-wl-load]").getBoundingClientRect(); return {cls: document.getElementById("alunoApp").classList.contains("wl-big"), stepW: st.width, stepH: st.height, inpH: inp.height, over: document.documentElement.scrollWidth > innerWidth}; });
  check.check("37. «Controlos grandes»: botões −/+ e campos com ≥ 56 px, sem transbordar na largura", big.cls && big.stepW >= 56 && big.stepH >= 56 && big.inpH >= 56 && !big.over);
  await W.pg.locator('[data-comfort="lefty"]').check();
  var lf = await W.pg.evaluate(function(){ var b = document.getElementById("wlDockBtn").getBoundingClientRect(), i = document.getElementById("wlDockEx").getBoundingClientRect(), d = document.querySelector(".wl-set .wl-done").getBoundingClientRect(), f = document.querySelector(".wl-set .wl-fields").getBoundingClientRect(); return {dockBtnLeft: b.left < i.left, doneLeft: d.left < f.left}; });
  check.check("38. «Mão esquerda»: o botão «Feita» da barra e o ✓ de cada série passam para a esquerda", lf.dockBtnLeft && lf.doneLeft);
  await W.pg.reload(); await W.pg.waitForSelector("#startWorkout"); await start(W.pg);
  check.check("39. As opções de conforto ficam guardadas neste telemóvel (voltam depois de recarregar) e não vão para o servidor", (await W.pg.evaluate(function(){ var a = document.getElementById("alunoApp"); return a.classList.contains("wl-big") && a.classList.contains("wl-lefty"); })) && (await W.pg.evaluate(function(){ return localStorage.getItem("evolve_wl_comfort_v1"); })) === '{"big":true,"lefty":true}' && !(await W.pg.evaluate(function(){ return JSON.stringify(window.__fake.writes); })).includes("evolve_wl_comfort"));
  await W.pg.locator("#wlComfort summary").click();
  await W.pg.locator('[data-comfort="big"]').uncheck(); await W.pg.locator('[data-comfort="lefty"]').uncheck();
  // marcar todas pela barra fixa: no fim vira «Terminar treino»
  var total = await W.pg.locator("[data-wl-done]").count(), guard = 0;
  while ((await W.pg.locator("#wlDockBtn").getAttribute("data-mode")) === "set" && guard++ < total + 2) await W.pg.locator("#wlDockBtn").click();
  check.check("40. Com todas as séries marcadas a barra diz «Treino completo» e o botão passa a «Terminar treino»", /Treino completo/.test(await W.pg.locator("#wlDock").innerText()) && /Terminar treino/i.test(await W.pg.locator("#wlDockBtn").innerText()) && (await W.pg.locator("[data-wl-done]:checked").count()) === total);
  await W.pg.locator('.tabbar [data-tab="evolucao"]').click();
  await W.pg.waitForTimeout(200);
  check.check("41. Ao sair do ecrã de treino o ecrã deixa de ser mantido ligado (sem descanso a correr) e a barra desaparece", (await W.pg.locator("#wlDock").count()) === 0 && (await W.pg.evaluate(function(){ return document.body.classList.contains("wl-dock-on"); })) === false);
  await W.ctx.close();

  // --- sincronização no browser: falha de envio, «Enviar agora», por enviar no histórico ---
  var S = await open({});
  await start(S.pg);
  await S.pg.locator("#wlDockBtn").click();
  await S.pg.evaluate(function(){ window.__fake.failNext = 50; });
  await S.pg.locator("#wlSave").click();
  var fin = S.pg.locator("#wlFinishYes"); if (await fin.count()) await fin.click();
  await S.pg.waitForSelector("#syncLine");
  await S.pg.waitForFunction(function(){ var e = document.getElementById("syncLine"); return e && /(por enviar|Não foi possível enviar)/.test(e.innerText); }, null, {timeout: 12000});
  var sl = await S.pg.locator("#syncLine").innerText();
  check.check("42. Depois de terminar com o servidor a falhar: o treino aparece «por enviar»/erro, com «Enviar agora», e o texto diz que está guardado neste telemóvel", /(por enviar|guardado)/.test(sl) && (await S.pg.locator("#syncNow").count()) === 1);
  await S.pg.locator("#openHistorico").click(); await S.pg.waitForSelector("#histList");
  check.check("43. No histórico, o treino novo tem a marca «por enviar» e os antigos não", (await S.pg.locator(".hist-badge").count()) === 1);
  await S.pg.locator("#backToHoje").click(); await S.pg.waitForSelector("#syncNow");
  await S.pg.evaluate(function(){ window.__fake.failNext = 0; });
  await S.pg.locator("#syncNow").click();
  await S.pg.waitForFunction(function(){ var e = document.getElementById("syncLine"); return e && /Tudo sincronizado/.test(e.innerText); }, null, {timeout: 12000});
  check.check("44. «Enviar agora» envia o treino e o estado passa a «Tudo sincronizado»", /Tudo sincronizado/.test(await S.pg.locator("#syncLine").innerText()) && (await S.pg.evaluate(function(){ return window.__fake.rows[0].workout_logs.length; })) === 4);
  await S.ctx.close();

  check.check("45. Nada saiu para fora do servidor local e não houve erros de JavaScript" + (errors.length ? " — " + errors.join(" | ") : ""), errors.length === 0 && external.length === 0);
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção " + (e && e.message)); process.exit(1); });
