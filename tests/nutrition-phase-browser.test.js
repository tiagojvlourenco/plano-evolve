// Fases de peso num Chromium real com Supabase simulado: o pop-up de revisão ao entrar (um só OK aplica alvos + quantidades + fase),
// o cartão no painel, adiar, e definir a fase na ficha de Nutrição.
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
var today = localTodayISO();
function d(n){ return addDaysISO(today, n); }
function flat(kg, days){ var out = []; for (var i = -days; i <= 0; i += 2) out.push({date: d(i), w: kg}); return out; }
function fixtureRow(id, name, o){
  authRole = "professional";
  var s = buildFullDemoStudent();
  s.id = id; s.name = name; s.isDemo = false; s.active = true; s.photos = [];
  s.sex = "Masculino"; s.age = 35; s.height = 178; s.weightCurrent = 90; s.weightInitial = 90; s.trainingsPerWeek = 3; s.weightGoal = 82; s.supplements = [];
  s.weights = o && o.weights ? o.weights : flat(90, 28);
  if (o && o.weights) s.assessments = o.weights.map(function(w){ return {date: w.date, weight: w.w}; });
  s.checkins = o && o.checkins ? o.checkins : [1, 2, 3, 4].map(function(i){ return {date: d(-i * 7), adherence: 8, hunger: 4, energy: 7, weight: 90}; });
  var maint = computeMaintenanceKcal(s), kcal = Math.round(maint * 0.9 / 25) * 25;
  s.targets = {kcal: kcal, protein: 160, fat: 75, carbs: Math.round((kcal - 640 - 675) / 4)};
  s.meals = [meal("Pequeno-almoço", "08:00", [food("Aveia", "100 g", "hidratos"), food("Iogurte grego natural", "300 g"), food("Banana", "2 unid.")]), meal("Almoço", "13:00", [food("Arroz (cozido)", "300 g", "hidratos"), food("Frango (peito)", "250 g"), food("Azeite", "15 ml")]), meal("Jantar", "20:00", [food("Batata-doce", "350 g", "hidratos"), food("Pescada", "250 g"), food("Azeite", "10 ml")])];
  autoAdjustPlanQuantities(s);
  s.nutritionPhase = o && o.noPhase ? null : o && o.phase ? o.phase : {phase: "cut", startDate: d(-35), startWeight: 90, targetWeight: 82, level: "novato", stage: 0, lastChangeDate: d(-35), lastReviewDate: null, nextReviewDate: d(-1), reviewEveryDays: 14, reviews: []};
  return JSON.parse(JSON.stringify(studentToRow(s)));
}
(async function(){
  var srv = await startStaticServer(path.join(__dirname, ".."));
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  async function session(rows){
    var ctx = await browser.newContext({viewport: {width: 390, height: 844}});
    await ctx.addInitScript(fakeSource({role: "professional", userId: "pro-1", rows: rows}));
    var page = await ctx.newPage(); page.setDefaultTimeout(6000);
    page.on("pageerror", function(e){ errors.push(e.message); }); page.on("dialog", function(dlg){ dlg.accept(); });
    return {ctx: ctx, page: page};
  }
  var rowA = fixtureRow("a1", "Ana Teste"), rowB = fixtureRow("b1", "Rui Teste"), rowC = fixtureRow("c1", "Sem Fase", {noPhase: true});
  var kcal0 = rowA.targets.kcal;
  var st = await session([rowA, rowB, rowC]);
  var pg = st.page;
  await pg.goto(srv.url);
  await pg.waitForSelector("#prOk");
  var title = await pg.locator(".modal-sheet").innerText();
  check.check("1. Ao entrar, o profissional vê o pop-up de revisão (1 de 2) com a fase, a evidência e a sugestão", /Revisão do plano de/.test(title) && /1 de 2/.test(title) && /Fase Cut/.test(title) && /kg\/semana/.test(title) && /reduzir \d+ kcal/.test(title));
  check.check("2. O pop-up tem um único botão principal «OK — aplicar» (e adiar / ver aluno)", /✓ OK — aplicar/i.test(title) && (await pg.locator("#prLater").count()) === 1 && (await pg.locator("#prOpen").count()) === 1);
  var beforeMeals = await pg.evaluate(function(){ return JSON.stringify(window.__fake.rows.filter(function(r){ return r.id === "a1"; })[0].meals); });
  await pg.click("#prOk");
  await pg.waitForFunction(function(k){ return window.__fake.rows.filter(function(r){ return r.id === "a1"; })[0].targets.kcal !== k; }, kcal0);
  var a = await pg.evaluate(function(){ return window.__fake.rows.filter(function(r){ return r.id === "a1"; })[0]; });
  check.check("3. Um toque no OK baixa as calorias do aluno um passo pequeno (100–200 kcal)", a.targets.kcal < kcal0 && kcal0 - a.targets.kcal >= 100 && kcal0 - a.targets.kcal <= 200 && a.targets.protein === 160 && a.targets.fat === 75);
  check.check("4. …reajusta as quantidades das refeições (grava a coluna meals)", JSON.stringify(a.meals) !== beforeMeals);
  var wr = await pg.evaluate(function(){ return window.__fake.writes.filter(function(w){ return w.table === "students" && w.op === "update" && w.id === "a1"; }); });
  var forbidden = ["checkins", "weights", "weight_current", "photos", "notes", "name", "meal_daily_state", "workout_logs"];
  check.check("4b. O OK só envia as colunas que mudaram (targets, meals, plan_history, nutrition_phase…): nunca os check-ins, pesos ou fotos que outro dispositivo pode ter acabado de gravar", wr.length >= 1 && wr.every(function(w){ return !w.cols.some(function(c){ return forbidden.indexOf(c) >= 0; }); }) && wr.some(function(w){ return w.cols.indexOf("targets") >= 0; }));
  check.check("5. …avança a fase (etapa 1, próxima revisão daí a 21 dias) e regista no histórico do plano", a.nutrition_phase.stage === 1 && a.nutrition_phase.nextReviewDate === d(21) && a.nutrition_phase.lastChangeDate === today && a.plan_history.some(function(e){ return e.type === "fase_revisao"; }));
  // o segundo da fila abre sozinho
  await pg.waitForSelector("#prOk");
  check.check("6. A seguir abre a revisão do 2.º aluno (2 de 2)", /2 de 2/.test(await pg.locator(".modal-sheet").innerText()));
  await pg.waitForTimeout(700);   // a janela nova não aceita toques nos primeiros 600 ms (duplo toque)
  await pg.click("#prLater");
  await pg.waitForFunction(function(){ var r = window.__fake.rows.filter(function(x){ return x.id === "b1"; })[0]; return r.nutrition_phase && r.nutrition_phase.snoozeUntil; });
  var b = await pg.evaluate(function(){ return window.__fake.rows.filter(function(r){ return r.id === "b1"; })[0]; });
  check.check("7. «Adiar 7 dias» só marca o adiamento: o plano do aluno não muda", b.nutrition_phase.snoozeUntil === d(7) && b.targets.kcal === kcal0 && !b.plan_history.some(function(e){ return e.type === "fase_revisao"; }));
  await pg.waitForSelector(".student-row");
  check.check("8. O pop-up fecha-se no fim da fila e o painel mostra o resto", (await pg.locator("#prOk").count()) === 0);

  // sem nada à espera, o painel não mostra o cartão; o aluno adiado também não aparece
  check.check("9. Quem já foi revisto ou adiado deixa de aparecer no painel", (await pg.locator("#phaseReviewsCard").count()) === 0);

  // ficha de Nutrição
  await pg.locator('[data-open="a1"]').first().click();
  await pg.locator('.pro-sidebar [data-t="plano"]').click();
  await pg.waitForSelector("#phaseCard");
  var panel = await pg.locator("#phaseCard").innerText();
  check.check("10. A ficha de Nutrição mostra a fase Cut, o objetivo (82 kg), as calorias face à manutenção e a próxima revisão", /cut/i.test(panel) && /82 kg/.test(panel) && /da manutenção de/.test(panel) && /Próxima revisão/.test(panel));
  await pg.click("#phaseReviewNow");
  var toastOk = await pg.locator(".toast", {hasText: /Sem avaliação nova desde a última revisão\./}).first().waitFor({timeout: 4000}).then(function(){ return true; }, function(){ return false; });
  check.check("11. «Rever agora» logo depois de uma alteração não abre janela: mostra um aviso de que não há nada a rever", (await pg.locator("#prOk").count()) === 0 && toastOk && !(await pg.locator(".toast", {hasText: /Sem fase definida/}).count()));

  // aluno sem fase: definir
  await pg.click("#proBack");
  await pg.locator('[data-open="c1"]').first().click();
  await pg.locator('.pro-sidebar [data-t="plano"]').click();
  await pg.waitForSelector("#phaseStart");
  check.check("12. Sem fase, a ficha convida a definir uma", /Sem fase definida/.test(await pg.locator("#phaseCard").innerText()));
  await pg.click("#phaseStart");
  await pg.waitForSelector("#phGo");
  check.check("13. A janela traz a fase sugerida pelo objetivo (cut), a pré-visualização gradual e o botão OK", (await pg.locator("#phType").inputValue()) === "cut" && /Calorias de partida/.test(await pg.locator("#phPreview").innerText()) && /passos de 100–200 kcal/.test(await pg.locator("#phPreview").innerText()));
  await pg.selectOption("#phType", "bulk");
  check.check("14. Mudar para bulk mostra a experiência de treino e recalcula a pré-visualização", await pg.locator("#phLevelBox").isVisible() && /\+\d+ kcal/.test(await pg.locator("#phPreview").innerText()));
  await pg.selectOption("#phType", "cut"); await pg.selectOption("#phEvery", "21"); await pg.fill("#phGoal", "80");
  await pg.click("#phGo");
  await pg.waitForFunction(function(){ var r = window.__fake.rows.filter(function(x){ return x.id === "c1"; })[0]; return r.nutrition_phase && r.nutrition_phase.phase === "cut"; });
  var c = await pg.evaluate(function(){ return window.__fake.rows.filter(function(r){ return r.id === "c1"; })[0]; });
  check.check("15. OK define a fase: cut, objetivo 80 kg, revisão de 21 em 21 dias, calorias de partida (−10 %) e o plano reajustado", c.nutrition_phase.phase === "cut" && c.nutrition_phase.targetWeight === 80 && c.weight_goal === 80 && c.nutrition_phase.reviewEveryDays === 21 && Math.abs(c.nutrition_phase.deficitPct + 10) < 2 && c.plan_history.some(function(e){ return e.type === "fase_inicio"; }));
  check.check("16. A fase nova aparece logo no cartão", /cut/i.test(await pg.locator("#phaseCard").innerText()) && /alterar fase/i.test(await pg.locator("#phaseCard").innerText()));
  await st.ctx.close();

  // ---------- duplo toque no OK e fila fechada a meio ----------
  var rowsQ = [fixtureRow("q1", "Ana Fila"), fixtureRow("q2", "Bruno Fila"), fixtureRow("q3", "Carla Fila")];
  var kQ = rowsQ[0].targets.kcal;
  var sq = await session(rowsQ), pq = sq.page;
  await pq.goto(srv.url);
  await pq.waitForSelector("#prOk");
  await pq.dblclick("#prOk");   // dois toques seguidos: só o 1.º aluno pode ser aprovado
  await pq.waitForFunction(function(k){ return window.__fake.rows.filter(function(r){ return r.id === "q1"; })[0].targets.kcal !== k; }, kQ);
  await pq.waitForTimeout(400);
  var q2 = await pq.evaluate(function(){ return window.__fake.rows.filter(function(r){ return r.id === "q2"; })[0]; });
  check.check("19. Um duplo toque no OK aprova só o 1.º aluno: o 2.º abre sem ser aprovado às cegas (2 de 3)", q2.targets.kcal === kQ && !(q2.nutrition_phase && q2.nutrition_phase.stage > 0) && /2 de 3/.test(await pq.locator(".modal-sheet").innerText()));
  await pq.waitForTimeout(700);
  await pq.click(".modal-sheet .mclose button");   // fecha a fila a meio
  await pq.waitForFunction(function(){ var c = document.getElementById("phaseReviewsCard"); return c && /Revisões de plano · 2/i.test(c.innerText); }, null, {timeout: 4000}).catch(function(){});
  check.check("20. Fechar a fila a meio deixa o cartão do painel certo (2 à espera, sem o aluno já tratado) e o «Rever» funciona", /Revisões de plano · 2/i.test(await pq.locator("#phaseReviewsCard").innerText()) && (await pq.locator('[data-phase-review="q1"]').count()) === 0);
  await pq.locator('[data-phase-review="q2"]').click();
  await pq.waitForSelector("#prOk");
  check.check("21. «Rever» abre a revisão desse aluno", /Revisão do plano de Bruno Fila/.test(await pq.locator(".modal-sheet").innerText()));
  await sq.ctx.close();

  // ---------- migração 0029 por correr: grava-se o resto, avisa, e não finge que guardou a fase ----------
  var ctxM = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctxM.addInitScript(fakeSource({role: "professional", userId: "pro-1", rows: [fixtureRow("m1", "Ana Sem Coluna"), fixtureRow("m2", "Rui Sem Coluna")], missingCols: {students: ["nutrition_phase"]}}));
  var pm = await ctxM.newPage(); pm.setDefaultTimeout(6000); pm.on("pageerror", function(e){ errors.push(e.message); });
  var kM = null;
  await pm.goto(srv.url);
  await pm.waitForSelector("#prOk");
  kM = await pm.evaluate(function(){ return window.__fake.rows.filter(function(r){ return r.id === "m1"; })[0].targets.kcal; });
  await pm.click("#prOk");
  await pm.waitForFunction(function(k){ return window.__fake.rows.filter(function(r){ return r.id === "m1"; })[0].targets.kcal !== k; }, kM, {timeout: 6000});
  var wm = await pm.evaluate(function(){ return {writes: window.__fake.writes.filter(function(w){ return w.table === "students"; }), row: window.__fake.rows.filter(function(r){ return r.id === "m1"; })[0]}; });
  check.check("22. Sem a coluna nutrition_phase (0029 por correr) o servidor recusa essa gravação mas as calorias e o plano guardam-se na mesma", wm.writes.some(function(w){ return w.op === "update-REJECTED" && w.cols.indexOf("nutrition_phase") >= 0; }) && wm.row.targets.kcal < kM && wm.row.nutrition_phase.stage === 0 && wm.writes.some(function(w){ return w.op === "update" && w.cols.indexOf("targets") >= 0 && w.cols.indexOf("nutrition_phase") < 0; }));
  await pm.waitForSelector("#prOk");
  await pm.waitForTimeout(700);
  await pm.click("#prOk");
  await pm.waitForSelector(".toast", {timeout: 4000});
  var blockedToast = await pm.locator(".toast", {hasText: /0029/}).first().waitFor({timeout: 4000}).then(function(){ return true; }, function(){ return false; });
  var rM2 = await pm.evaluate(function(){ return window.__fake.rows.filter(function(r){ return r.id === "m2"; })[0].targets.kcal; });
  check.check("23. Depois de saber que falta a migração, o OK seguinte não finge que guardou: avisa da 0029 e não mexe no plano do aluno", blockedToast && rM2 === kM);
  await ctxM.close();

  // ---------- adesão: o PT confirma no próprio pop-up (sem novo ecrã) ----------
  function sparseW(){ return [[84, 90], [56, 89], [28, 88], [0, 87]].map(function(x){ return {date: d(-x[0]), w: x[1]}; }); }
  var sparsePhase = {phase: "cut", startDate: d(-84), startWeight: 90, targetWeight: 82, level: "novato", stage: 0, lastChangeDate: d(-84), lastReviewDate: null, nextReviewDate: d(-1), reviewEveryDays: 28, reviews: []};
  var rowsS = [fixtureRow("s1", "Sara Espaçada", {weights: sparseW(), checkins: [], phase: sparsePhase}), fixtureRow("s2", "Sérgio Espaçado", {weights: sparseW(), checkins: [], phase: sparsePhase})];
  var kS = rowsS[0].targets.kcal;
  var ss = await session(rowsS), ps = ss.page;
  await ps.goto(srv.url);
  await ps.waitForSelector("#prAdh0");
  var txtS = await ps.locator(".modal-sheet").innerText();
  check.check("24. Sem confirmação nem check-ins: o pop-up explica que não há dados fiáveis de adesão e que não se reduz, e oferece os 3 níveis", /não há dados fiáveis de adesão/i.test(txtS) && /não sugiro alterar as calorias/.test(txtS) && (await ps.locator("#prAdh1").count()) === 1 && (await ps.locator("#prAdh2").count()) === 1 && !/OK — aplicar/.test(txtS));
  await ps.waitForTimeout(100);
  await ps.click("#prAdh0");
  await ps.waitForFunction(function(){ var r = window.__fake.rows.filter(function(x){ return x.id === "s1"; })[0]; return r.nutrition_phase && r.nutrition_phase.adherenceConfirmed; });
  var s1 = await ps.evaluate(function(){ return window.__fake.rows.filter(function(r){ return r.id === "s1"; })[0]; });
  check.check("25. «Cumprida» grava {date, level} na fase pela gravação normal e não mexe nos alvos, pesagens nem check-ins", s1.nutrition_phase.adherenceConfirmed.level === "cumprida" && s1.nutrition_phase.adherenceConfirmed.date === today && s1.targets.kcal === kS && s1.checkins.length === 0);
  await ps.waitForFunction(function(){ var b = document.getElementById("prOk"); return b && /aplicar/.test(b.textContent); });
  check.check("26. …e o mesmo pop-up passa a mostrar a proposta de redução para o PT validar (ainda nada aplicado)", (await ps.evaluate(function(){ return window.__fake.rows.filter(function(r){ return r.id === "s1"; })[0].targets.kcal; })) === kS && /kcal/.test(await ps.locator(".modal-sheet").innerText()));
  await ps.waitForTimeout(700);
  await ps.click("#prOk");
  await ps.waitForFunction(function(k){ return window.__fake.rows.filter(function(x){ return x.id === "s1"; })[0].targets.kcal !== k; }, kS);
  var s1b = await ps.evaluate(function(){ return window.__fake.rows.filter(function(r){ return r.id === "s1"; })[0]; });
  check.check("27. Só ao dar OK as calorias baixam; a confirmação anterior fica invalidada e a avaliação vista guardada", s1b.targets.kcal < kS && s1b.nutrition_phase.adherenceConfirmed === null && s1b.nutrition_phase.seenWeighInDate === today);
  await ps.waitForSelector("#prAdh1");
  await ps.waitForTimeout(700);
  await ps.click("#prAdh1");
  await ps.waitForFunction(function(){ var r = window.__fake.rows.filter(function(x){ return x.id === "s2"; })[0]; return r.nutrition_phase && r.nutrition_phase.adherenceConfirmed; });
  var s2r = await ps.evaluate(function(){ return window.__fake.rows.filter(function(r){ return r.id === "s2"; })[0]; });
  check.check("28. «Parcial» regista a confirmação, adia a revisão e deixa as calorias como estão", s2r.nutrition_phase.adherenceConfirmed.level === "parcial" && !!s2r.nutrition_phase.seenWeighInDate && s2r.targets.kcal === kS);
  await ss.ctx.close();

  // ---------- o aluno nunca escreve a fase ----------
  var ctx2 = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx2.addInitScript(fakeSource({role: "student", userId: "user-1", rows: [fixtureRow("a1", "Ana Teste")]}));
  var p2 = await ctx2.newPage(); p2.setDefaultTimeout(6000); p2.on("pageerror", function(e){ errors.push(e.message); });
  await p2.goto(srv.url); await p2.waitForSelector(".check-circle[data-circle]");
  check.check("17. O aluno não vê pop-ups de revisão nem controlos da fase", (await p2.locator("#prOk").count()) === 0 && (await p2.locator("#phaseCard").count()) === 0);
  await ctx2.close();

  check.check("18. Nenhum erro de JavaScript", errors.length === 0);
  if (errors.length) console.log(errors.slice(0, 3));
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e.message.split("\n")[0], (e.stack.split("\n").filter(function(l){ return /nutrition-phase-browser/.test(l); })[0] || "").trim()); process.exit(1); });
