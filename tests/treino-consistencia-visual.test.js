// EVOLVE Treino: linguagem visual comum entre musculação e corrida (botões, campos, títulos, estados, foco) e isolamento em relação às outras apps.
// Mede estilos calculados no Chromium (390 px) em todos os ecrãs do aluno. O que não se vê aqui: o aspeto numa pantalha real (brilho, cor, dedos) e o Safari.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var fs = require("fs"), path = require("path");
var root = path.join(__dirname, "..");
var css = fs.readFileSync(path.join(root, "app.css"), "utf8");
var marker = css.indexOf("EVOLVE Treino — linguagem visual comum");
var layer = css.slice(marker);
// ---- ficheiro: a camada comum só toca na app de treino ----
var offenders = layer.split("\n").filter(function(l){ return /\{/.test(l) && !/^\s/.test(l) && !/^@|^\/\*|^\*/.test(l) && !/^(:where\()?html\[data-app="treino"\]/.test(l); });
check.check("1. Todas as regras da linguagem visual comum começam por html[data-app=\"treino\"] (nada muda no EVOLVE nem na Gestão)" + (offenders.length ? " — fora do âmbito: " + offenders.slice(0, 2).join(" | ").slice(0, 120) : ""), marker > 0 && offenders.length === 0 && /html\[data-app="treino"\]\{--ctl-r:12px; --surf-r:14px/.test(layer));
check.check("2. Existe estado de carregamento (aria-busy) com animação desligada em «reduzir movimento», estado desativado e anel de foco comum", /\[aria-busy="true"\]::before/.test(layer) && /prefers-reduced-motion:reduce/.test(layer) && /\.btn:disabled/.test(layer) && /:focus-visible\{outline:var\(--focus-ring\)/.test(layer));
function iso(d){ return isoOfLocalDate(new Date(Date.now() - d * 86400000)); }

var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){ console.log("(ignorado o ecrã: Playwright/Chromium não disponíveis aqui)"); check.summarize(); }
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");
function rowAna(o){
  o = o || {};
  authRole = "professional";
  var s = buildFullDemoStudent(); s.id = "ana"; s.name = "Ana Treina"; s.isDemo = false; s.active = true; s.photos = []; s.nutritionPhase = null;
  var day = s.trainingProgram.days[0];
  s.trainingDays = [0, 1, 2, 3, 4, 5, 6]; // todos os dias são de treino: senão, num dia de descanso, o botão é «Treinar mesmo assim» (pequeno, de propósito) e o teste dependia do dia da semana
  if (o.noPlan) s.trainingProgram.days = [];
  var r = JSON.parse(JSON.stringify(studentToRow(s)));
  r.workout_logs = o.noPlan ? [] : [0, 1, 2].map(function(i){ return {id: "h" + i, date: iso(2 + i * 7), dayId: day.id, dayName: day.name, rpe: 7, notes: "", entries: day.exercises.map(function(e){ return {exerciseId: e.id, name: e.name, sets: [{reps: 8, load: 40 + i}, {reps: 8, load: 40 + i}]}; })}; });
  if (o.runs !== false) r.runs_mode = "import";
  authRole = "student";
  return r;
}
(async function(){
  var srv = await startStaticServer(root);
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  async function open(o, page){
    o = o || {};
    var ctx = await browser.newContext({viewport: {width: 390, height: 844}});
    await ctx.addInitScript(fakeSource({role: "student", userId: "user-ana", email: "ana@x.test", rows: [rowAna(o)]}));
    await ctx.addInitScript(function(){ window.__fake.tables.run_consents.push({student_id: "ana", version: 2, accepted_at: "2026-10-01T10:00:00Z"}); });
    var pg = await ctx.newPage(); pg.setDefaultTimeout(7000); pg.on("pageerror", function(e){ errors.push(e.message); });
    await pg.goto(srv.url + (page || "treino.html"));
    await pg.waitForSelector(o.noPlan ? "#noPlan" : "#startWorkout, [data-start-day], #alunoApp:not(.hidden)");
    return {ctx: ctx, pg: pg};
  }
  // recolhe, no ecrã atual, os estilos que interessam
  var probe = function(){
    var vis = function(e){ var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; };
    var one = function(e){ var c = getComputedStyle(e); return {id: e.id || e.className, fs: parseFloat(c.fontSize), r: parseFloat(c.borderTopLeftRadius), h: Math.round(e.getBoundingClientRect().height)}; };
    var out = {btn: [], field: [], title: [], label: [], chip: []};
    document.querySelectorAll("#alunoTabContent button.btn, #alunoTabContent a.btn, #alunoTabContent .run-btn").forEach(function(e){ if (vis(e)) out.btn.push(one(e)); });
    document.querySelectorAll("#alunoTabContent select, #alunoTabContent textarea, #alunoTabContent input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]):not([type=file]):not([data-wl-load]):not([data-wl-reps])").forEach(function(e){ if (vis(e)) out.field.push(one(e)); });
    document.querySelectorAll("#alunoTabContent .tab-head h2, #alunoTabContent .tw-name").forEach(function(e){ if (vis(e)) out.title.push(one(e)); });
    document.querySelectorAll("#alunoTabContent .checkin-field > label, #alunoTabContent .run-field > label, #alunoTabContent .assess-form-grid .f > label").forEach(function(e){ if (vis(e)) out.label.push(one(e)); });
    document.querySelectorAll("#alunoTabContent .wl-chip").forEach(function(e){ if (vis(e)) out.chip.push(one(e)); });
    return out;
  };
  var A = await open({});
  var seen = {btn: [], field: [], title: [], label: [], chip: []}, byScreen = {};
  async function grab(name){ var m = await A.pg.evaluate(probe); byScreen[name] = m; Object.keys(seen).forEach(function(k){ seen[k] = seen[k].concat(m[k]); }); }
  await grab("hoje");
  await A.pg.locator("#startWorkout").click(); await A.pg.waitForSelector("#wlDock"); await grab("treino");
  await A.pg.locator("#backToHoje").click(); await A.pg.waitForSelector("#openHistorico");
  await A.pg.locator("#openHistorico").click(); await A.pg.waitForSelector("#histQ"); await grab("historico");
  await A.pg.locator("#backToHoje").click(); await A.pg.waitForSelector("#openHistorico");
  await A.pg.locator('.tabbar [data-tab="evolucao"]').click(); await A.pg.waitForSelector("#evoExSel"); await grab("evolucao");
  await A.pg.locator('.tabbar [data-tab="corrida"]').click(); await A.pg.waitForSelector("#runGoManual"); await grab("cardio");
  var primaryRun = byScreen.cardio.btn.filter(function(b){ return b.id === "runGoImport"; })[0], primaryTreino = byScreen.treino.btn.filter(function(b){ return b.id === "wlSave"; })[0], primaryHoje = byScreen.hoje.btn.filter(function(b){ return b.id === "startWorkout"; })[0];
  await A.pg.locator("#runGoManual").click(); await A.pg.waitForSelector("#runManDate"); await grab("cardio-mao");

  var radii = function(list){ return list.map(function(x){ return x.r; }).filter(function(v, i, a){ return a.indexOf(v) === i; }); };
  check.check("3. Todos os botões (musculação e corrida) têm o mesmo canto (12 px) e pelo menos 44 px de altura — " + seen.btn.length + " botões em 6 ecrãs", seen.btn.length >= 12 && radii(seen.btn).join() === "12" && seen.btn.every(function(b){ return b.h >= 44; }));
  check.check("4. Os botões principais («Iniciar treino», «Terminar treino», «Importar ficheiro») têm o mesmo tamanho: 56 px e a mesma letra", primaryRun && primaryTreino && primaryHoje && primaryRun.h === 56 && primaryTreino.h === 56 && primaryHoje.h === 56 && primaryRun.fs === primaryTreino.fs && primaryTreino.fs === primaryHoje.fs);
  check.check("5. Os campos de texto, listas e notas têm 16 px (o iPhone não amplia o ecrã) e o mesmo canto (12 px) em todos os ecrãs — " + seen.field.length + " campos", seen.field.length >= 6 && seen.field.every(function(f){ return f.fs >= 16; }) && radii(seen.field).join() === "12");
  check.check("6. Os títulos de ecrã (Histórico, Evolução, Cardio e o nome do treino) têm todos 24 px", seen.title.length >= 4 && seen.title.every(function(t){ return t.fs === 24; }) && byScreen.historico.title.length === 1 && byScreen.evolucao.title.length === 1 && byScreen.cardio.title.length === 1);
  var lbl = seen.label.map(function(l){ return Math.round(l.fs * 10) / 10; }).filter(function(v, i, a){ return a.indexOf(v) === i; });
  check.check("7. As etiquetas dos campos (Pesquisar, Exercício, formulários da corrida) têm todas o mesmo tamanho (" + lbl.join(", ") + " px)", seen.label.length >= 6 && lbl.length === 1);
  check.check("8. As pastilhas (período, vista, RIR) têm o mesmo canto (12 px) e 44 px", seen.chip.length >= 8 && radii(seen.chip).join() === "12" && seen.chip.every(function(c){ return c.h >= 44; }));
  check.check("9. «Histórico» tem título de ecrã como os outros separadores (e o botão «← Treino»)", /Histórico/.test(await (async function(){ await A.pg.locator("#runBack").click().catch(function(){}); await A.pg.locator('.tabbar [data-tab="hoje"]').click(); await A.pg.waitForSelector("#openHistorico"); await A.pg.locator("#openHistorico").click(); await A.pg.waitForSelector("#histQ"); return await A.pg.locator(".tab-head h2").innerText(); })()) && (await A.pg.locator("#backToHoje").count()) === 1);

  // foco por teclado, desativado, a carregar
  await A.pg.keyboard.press("Tab");
  var focusOk = await A.pg.evaluate(function(){
    var out = [];
    ["#backToHoje", '[data-hist-period="4"]', "#histQ"].forEach(function(sel){ var e = document.querySelector(sel); e.focus(); var c = getComputedStyle(e); out.push(parseFloat(c.outlineWidth) >= 2 && c.outlineStyle !== "none"); });
    return out;
  });
  check.check("10. O anel de foco do teclado (2 px) aparece em botões, pastilhas e campos", focusOk.every(Boolean));
  await A.pg.locator('[data-hist-view="cal"]').click(); await A.pg.waitForSelector("#calTitle");
  var dis = await A.pg.locator('[data-cal-nav="1"]').evaluate(function(b){ var c = getComputedStyle(b); return {disabled: b.disabled, op: parseFloat(c.opacity), cur: c.cursor}; });
  check.check("11. Um botão desativado fica esbatido (50%) e com cursor «não permitido»", dis.disabled && dis.op === 0.5 && dis.cur === "not-allowed");
  var busy = await A.pg.evaluate(function(){ var b = document.querySelector('[data-cal-nav="-1"]'); b.setAttribute("aria-busy", "true"); var c = getComputedStyle(b, "::before"), s = getComputedStyle(b); var r = {content: c.content, pe: s.pointerEvents, anim: c.animationName}; b.removeAttribute("aria-busy"); return r; });
  check.check("12. Um botão a carregar (aria-busy) mostra um indicador e deixa de aceitar toques", busy.content !== "none" && busy.pe === "none" && /evoSpin/.test(busy.anim));
  await A.ctx.close();

  // estados: vazio e sem plano
  var N = await open({noPlan: true});
  var np = await N.pg.locator("#noPlan").evaluate(function(e){ var c = getComputedStyle(e); return {ta: c.textAlign, r: parseFloat(c.borderTopLeftRadius)}; });
  await N.pg.locator('.tabbar [data-tab="evolucao"]').click(); await N.pg.waitForSelector("#evoEmpty");
  var ev = await N.pg.locator("#evoEmpty").evaluate(function(e){ var c = getComputedStyle(e); return {ta: c.textAlign, r: parseFloat(c.borderTopLeftRadius)}; });
  await N.pg.locator('.tabbar [data-tab="corrida"]').click(); await N.pg.waitForSelector(".run-state");
  var rs = await N.pg.locator(".run-state").first().evaluate(function(e){ var c = getComputedStyle(e); return {ta: c.textAlign, r: parseFloat(c.borderTopLeftRadius)}; });
  check.check("13. Os estados vazios da musculação (sem programa, sem treinos) e da corrida (sem corridas) têm o mesmo desenho: cartão centrado com o mesmo canto", np.ta === "center" && ev.ta === "center" && rs.ta === "center" && np.r === ev.r && ev.r === rs.r);
  await N.ctx.close();

  // isolamento: no EVOLVE (index.html) nada mudou
  var I = await open({runs: false}, "index.html");
  var idx = await I.pg.evaluate(function(){ var b = document.querySelector(".treino-app-link .btn, #alunoTabContent .btn.btn-sm"); return b ? parseFloat(getComputedStyle(b).borderTopLeftRadius) : -1; });
  check.check("14. Na app EVOLVE (index.html) os botões continuam com o canto antigo (9 px): a camada comum não lhe toca", idx === 9);
  await I.ctx.close();

  check.check("15. Sem erros de JavaScript" + (errors.length ? " — " + errors.join(" | ") : ""), errors.length === 0);
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção " + (e && e.message)); process.exit(1); });
