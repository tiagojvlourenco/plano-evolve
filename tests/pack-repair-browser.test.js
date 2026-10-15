// Pacote caducado com aulas extra (o aluno parou e voltou): «Contar estas aulas no pacote», editar o pacote,
// e a janela da agenda a chegar às aulas previstas já passadas. Chromium real com Supabase simulado.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

// ---- a janela da agenda chega às aulas previstas (folha) que já passaram e ainda não foram confirmadas ----
(function(){
  var today = localTodayISO();
  studio.packs = [{id: "p1", student_id: "x", name: "T", total: 13, starts_on: addDaysISO(today, -250), expires_on: addDaysISO(today, -70), used_before: 0}];
  studio.sessions = [{id: "a", student_id: "x", pack_id: null, date: addDaysISO(today, -240), status: "agendada", source: "folha"}];
  var w = calendarWindow(today);
  check.check("1. A janela da agenda chega ao pacote caducado que ainda tem aulas (e à aula prevista mais antiga)", w.from <= addDaysISO(today, -240));
  studio.packs[0].used_before = 13;
  studio.sessions = [];
  var w2 = calendarWindow(today);
  check.check("2. Um pacote caducado e esgotado não alarga a janela", w2.from > addDaysISO(today, -250));
})();

// ---- só o primeiro ou o último nome no evento ----
(function(){
  STUDENTS.push({id: "t1", name: "Ana Carina Tok", isDemo: false, active: true}, {id: "t2", name: "Rui Silvano Pax", isDemo: false, active: true}, {id: "t3", name: "Eva Silvano Pax", isDemo: false, active: true});
  check.check("2a1. «PT 60 - Carina» não casa (Carina é o 2.º nome, não o primeiro nem o último)", matchEventStudent("PT 60 - Carina", {}) === null);
  STUDENTS.push({id: "t4", name: "Diana Zeta", isDemo: false, active: true}, {id: "t5", name: "Maria Carina", isDemo: false, active: true});
  check.check("2a2. «PT 60 - Diana» casa com a única Diana (primeiro nome)", (matchEventStudent("PT 60 - Diana", {}) || {}).id === "t4");
  check.check("2a3. «PT 60 - Carina» casa com quem tem Carina como último nome", (matchEventStudent("PT 60 - Carina", {}) || {}).id === "t5");
  check.check("2a4. Um nome partilhado por dois alunos é ambíguo e não casa", matchEventStudent("PT 60 - Pax", {}) === null && matchEventStudent("PT 60 - Silvano", {}) === null);
  check.check("2a5. Palavras curtas demais não casam", matchEventStudent("PT 60 - Di", {}) === null);
})();

// ---- renovar antes de acabar: as aulas que restam gastam-se primeiro ----
(function(){
  var today = localTodayISO();
  STUDENTS.push({id: "early", name: "Cedo Renova", isDemo: false, active: true});
  studio.sessions = [];
  var oldP = {id: "o", student_id: "early", name: "A", total: 5, starts_on: addDaysISO(today, -100), expires_on: null, used_before: 3};   // restam 2
  var newP = {id: "n", student_id: "early", name: "A", total: 5, starts_on: today, expires_on: null, used_before: 0};
  studio.packs = [newP, oldP];   // (a base devolve os mais recentes primeiro)
  check.check("2h. Com dois pacotes sem validade, a aula gasta o mais antigo primeiro (restam 2 nele)", pickPackForSession("early", today).id === "o");
  oldP.used_before = 5;
  check.check("2i. Quando o antigo acaba, passa para o novo", pickPackForSession("early", today).id === "n");
  oldP.used_before = 3; oldP.expires_on = addDaysISO(today, 30); newP.expires_on = addDaysISO(today, 200);
  check.check("2j. Com validade, o que caduca primeiro (o antigo) é gasto primeiro", pickPackForSession("early", today).id === "o");
  oldP.expires_on = null;
  check.check("2k. Antigo sem validade e novo com validade: o que caduca primeiro é o novo (regra da validade)", pickPackForSession("early", today).id === "n");
  oldP.expires_on = addDaysISO(today, 30); newP.expires_on = null; newP.notes = "renov:6";
  check.check("2l. Pacote renovado «a contar» (sem validade ainda) gasta-se depois do antigo", pickPackForSession("early", today).id === "o");
  var rows = studioSummaryRows(today).filter(function(r){ return r.student.id === "early"; });
  check.check("2m. O resumo mostra os 2 pacotes ativos e as aulas que restam no total (2 + 5 = 7)", rows.length === 1 && rows[0].activeN === 2 && rows[0].activeRemaining === 7);
})();

// ---- ignorar de uma vez os títulos sem aluno ----
(function(){
  calSettings.ignored = {"pt 60 - velho": true};
  calSettings.lastSync = {unmatched: [{title: "PT 60 - Velho", n: 3}, {title: "PT 60 - Cancelada A", n: 41}, {title: "PT 45 - Cancelado B", n: 2}], unmatchedMore: 4};
  var n = calIgnoreAllUnmatched();
  check.check("2f. «Ignorar todos» ignora os títulos que ainda não estavam ignorados e esvazia a lista", n === 2 && calSettings.lastSync.unmatched.length === 0 && calSettings.lastSync.unmatchedMore === 0 && calIsIgnored(calSettings.ignored, "PT 60 - Cancelada A") && calIsIgnored(calSettings.ignored, "PT 45 - Cancelado B"));
  var plan = planCalendarSync({events: [{id: "ig", title: "PT 60 - Cancelada A", date: addDaysISO(localTodayISO(), -2), time: "10:00"}], today: localTodayISO(), window: {from: addDaysISO(localTodayISO(), -30), to: localTodayISO()}, aliases: {}, ignored: calSettings.ignored, prefix: "PT"});
  check.check("2g. E nas sincronizações seguintes esses títulos já não aparecem sem aluno", Object.keys(plan.unmatched).length === 0);
})();

// ---- duo: «PT Duo 60 - Ana + Rui» conta uma aula a cada um ----
(function(){
  var today = localTodayISO(), day = addDaysISO(today, -3);
  STUDENTS.push({id: "duo1", name: "Zita Duo", isDemo: false, active: true}, {id: "duo2", name: "Hugo Duo", isDemo: false, active: true});
  studio.sessions = []; studio.packs = [];
  var win = {from: addDaysISO(today, -30), to: today};
  var ev = {id: "evd", title: "PT Duo 60 - Zita Duo + Hugo Duo", date: day, time: "10:00", colorId: "10"};
  var plan = planCalendarSync({events: [ev, {id: "evx", title: "PT Duo 60 - Zita Duo + Ninguém Real", date: day, time: "11:00"}], today: today, window: win, aliases: {}, ignored: {}, prefix: "PT"});
  check.check("2b. Um evento de duo cria uma sessão para cada aluno (id do evento + aluno)", plan.insert.filter(function(x){ return /^evd#/.test(x.external_id); }).map(function(x){ return x.external_id; }).sort().join() === "evd#duo1,evd#duo2");
  check.check("2c. Se só um dos nomes é aluno, a aula conta só para esse (como antes)", plan.insert.filter(function(x){ return x.external_id === "evx"; }).length === 1 && Object.keys(plan.unmatched).length === 0);
  studio.sessions = plan.insert.map(function(x, i){ return Object.assign({id: "s" + i, pack_id: null}, x); });
  var evx = {id: "evx", title: "PT Duo 60 - Zita Duo + Ninguém Real", date: day, time: "11:00"};
  var plan2 = planCalendarSync({events: [ev, evx], today: today, window: win, aliases: {}, ignored: {}, prefix: "PT"});
  check.check("2d. Sincronizar outra vez não duplica nem remove", plan2.insert.length === 0 && plan2.remove.length === 0 && plan2.update.length === 0);
  studio.sessions = studio.sessions.slice(0);
  var plan3 = planCalendarSync({events: [], today: today, window: win, aliases: {}, ignored: {}, prefix: "PT"});
  check.check("2e. Se os eventos desaparecem, as sessões saem", plan3.remove.length === 3);
})();

var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var fs = require("fs");
var path = require("path");
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(q){ return fs.existsSync(q); })[0];
if (!pw || !chromiumPath){ console.log("(ignorado: Playwright/Chromium não disponíveis aqui)"); check.check("browser indisponível — teste ignorado", true); check.summarize(); }
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
  var ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx.addInitScript(fakeSource({role: "professional", userId: "pro-1", rows: [fixtureRow("s1", "Maria Leite")]}));
  await ctx.addInitScript(function(){
    function iso(back){ var d = new Date(); d.setDate(d.getDate() - back); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
    var T = window.__fake.tables;
    T.session_packs.push({id: "pk1", student_id: "s1", name: "Pacote 13 aulas", total: 13, price: 527.25, starts_on: iso(250), expires_on: iso(70), missed_consumes: true, late_cancel_consumes: true, used_before: 0});
    [60, 30, 5].forEach(function(b, i){ T.sessions.push({id: "se" + i, student_id: "s1", pack_id: null, date: iso(b), time: null, status: "feita", source: "calendario", external_id: "ev" + i}); });
  });
  var pg = await ctx.newPage(); pg.setDefaultTimeout(6000);
  pg.on("pageerror", function(e){ errors.push(e.message); }); pg.on("dialog", function(d){ d.accept(); });
  await pg.goto(srv.url);
  await pg.waitForSelector(".student-row");
  await pg.locator('[data-open="s1"]').first().click();
  await pg.click('[data-sub="sessoes"]');
  await pg.waitForSelector("[data-extend-pack]");
  var txt = await pg.locator("#proMain").innerText();
  check.check("3. Mostra «Aguarda renovação · +3 aulas extra» e o botão para as contar no pacote caducado", /Aguarda renovação/.test(txt) && /\+3 aulas extra/.test(txt) && /Contar estas aulas no pacote/i.test(txt));
  await pg.click("[data-extend-pack]");
  await pg.waitForFunction(function(){ return window.__fake.tables.sessions.every(function(x){ return x.pack_id === "pk1"; }); });
  var fk = await pg.evaluate(function(){ return {pk: window.__fake.tables.session_packs[0], ses: window.__fake.tables.sessions}; });
  check.check("4. O pacote perde a validade e as 3 aulas passam a ser dele", fk.pk.expires_on === null && fk.ses.length === 3 && fk.ses.every(function(x){ return x.pack_id === "pk1"; }));
  await pg.waitForFunction(function(){ return /3 de 13 usadas/.test(document.getElementById("proMain").innerText); });
  check.check("5. A ficha passa a mostrar 3 de 13 usadas, sem validade, e deixa de aguardar renovação", /restam 10/.test(await pg.locator("#proMain").innerText()) && !/Aguarda renovação/.test(await pg.locator("#proMain").innerText()));
  // editar
  await pg.click("[data-edit-pack]");
  await pg.waitForSelector("#epTotal");
  check.check("6. A janela de editar traz os valores atuais do pacote", (await pg.inputValue("#epTotal")) === "13" && (await pg.inputValue("#epExpiry")) === "");
  await pg.fill("#epTotal", "20");
  await pg.fill("#epUsed", "2");
  await pg.fill("#epTotal", "1"); await pg.fill("#epUsed", "5"); await pg.click("#epGo");
  check.check("7. Aulas já dadas acima do total é recusado", /entre 0 e 1/.test(await pg.locator("#epErr").innerText()));
  await pg.fill("#epTotal", "20"); await pg.fill("#epUsed", "2"); await pg.click("#epGo");
  await pg.waitForFunction(function(){ return window.__fake.tables.session_packs[0].total === 20; });
  var pk = await pg.evaluate(function(){ return window.__fake.tables.session_packs[0]; });
  check.check("8. Guardar grava o novo total e as aulas já dadas", pk.total === 20 && pk.used_before === 2);
  await pg.waitForFunction(function(){ return /5 de 20 usadas/.test(document.getElementById("proMain").innerText); });
  check.check("9. E a contagem passa a 5 de 20 (2 antes da app + 3 sessões)", true);
  await ctx.close();

  // ---- todos de uma vez: «Acertar pacotes» ----
  var ctx2 = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx2.addInitScript(fakeSource({role: "professional", userId: "pro-1", rows: [fixtureRow("a", "Ana A"), fixtureRow("b", "Bia B"), fixtureRow("c", "Carla C"), fixtureRow("d", "Dina D")]}));
  await ctx2.addInitScript(function(){
    function iso(back){ var d = new Date(); d.setDate(d.getDate() - back); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
    var T = window.__fake.tables, n = 0;
    function pack(id, st, total, start, exp, used){ T.session_packs.push({id: id, student_id: st, name: "P " + id, total: total, price: 100, starts_on: iso(start), expires_on: exp == null ? null : iso(exp), missed_consumes: true, late_cancel_consumes: true, used_before: used || 0}); }
    function ses(st, back, packId){ T.sessions.push({id: "s" + (n++), student_id: st, pack_id: packId || null, date: iso(back), time: null, status: "feita", source: "calendario", external_id: "e" + n}); }
    pack("pa", "a", 13, 250, 70, 0); ses("a", 60); ses("a", 30);               // A: caducou com aulas por dar e voltou a treinar → conta, sem validade
    pack("pb", "b", 10, 250, 70, 0); pack("pb2", "b", 10, 40, -100, 0);        // B: já renovou (pacote novo a decorrer) → o antigo não se mexe
    pack("pc", "c", 4, 250, 70, 0); ses("c", 240, "pc"); ses("c", 230, "pc"); ses("c", 220, "pc"); ses("c", 210, "pc"); ses("c", 20);   // C: pacote caducado e esgotado → a aula nova continua extra
    pack("pd", "d", 10, 30, null, 0); ses("d", 10);                           // D: pacote a decorrer e uma aula sem pacote → liga-se
  });
  var p2 = await ctx2.newPage(); p2.setDefaultTimeout(6000);
  p2.on("pageerror", function(e){ errors.push(e.message); }); p2.on("dialog", function(d){ d.accept(); });
  await p2.goto(srv.url); await p2.waitForSelector(".student-row");
  await p2.click("#navStudio"); await p2.waitForSelector("#fixPacks");
  await p2.click("#fixPacks");
  await p2.waitForFunction(function(){ return /acertadas|acertada/.test(document.querySelector(".toast, #toast, [class*=toast]") ? document.querySelector(".toast, #toast, [class*=toast]").innerText : ""); }).catch(function(){});
  await p2.waitForFunction(function(){ return window.__fake.tables.sessions.filter(function(x){ return x.student_id === "a"; }).every(function(x){ return x.pack_id === "pa"; }); });
  var f2 = await p2.evaluate(function(){ var T = window.__fake.tables; return {packs: T.session_packs, ses: T.sessions}; });
  function packById(id){ return f2.packs.filter(function(x){ return x.id === id; })[0]; }
  function of(st){ return f2.ses.filter(function(x){ return x.student_id === st; }); }
  check.check("11. A: as aulas contam no pacote que caducou e este fica sem validade", of("a").every(function(x){ return x.pack_id === "pa"; }) && packById("pa").expires_on === null);
  check.check("12. B: já tinha pacote novo, o antigo mantém a validade", packById("pb").expires_on !== null);
  check.check("13. C: pacote esgotado não é alargado e a aula nova continua sem pacote", packById("pc").expires_on !== null && of("c").filter(function(x){ return !x.pack_id; }).length === 1);
  check.check("14. D: a aula sem pacote liga-se ao pacote a decorrer", of("d").every(function(x){ return x.pack_id === "pd"; }));
  check.check("15. Nenhum erro de JavaScript (todos)", errors.length === 0);
  await ctx2.close();
  // ---- renovar num toque ----
  var ctx3 = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx3.addInitScript(fakeSource({role: "professional", userId: "pro-1", rows: [fixtureRow("r1", "Rita Renova")]}));
  await ctx3.addInitScript(function(){
    function iso(back){ var d = new Date(); d.setDate(d.getDate() - back); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
    var T = window.__fake.tables;
    T.session_packs.push({id: "old", student_id: "r1", name: "Pacote 3 aulas", total: 3, price: 120, starts_on: iso(60), expires_on: null, missed_consumes: true, late_cancel_consumes: true, used_before: 0, shared_with: []});
    [50, 40, 30].forEach(function(b, i){ T.sessions.push({id: "o" + i, student_id: "r1", pack_id: "old", date: iso(b), time: null, status: "feita", source: "calendario", external_id: "o" + i}); });
    [10, 3].forEach(function(b, i){ T.sessions.push({id: "x" + i, student_id: "r1", pack_id: null, date: iso(b), time: null, status: "feita", source: "calendario", external_id: "x" + i}); });
  });
  var p3 = await ctx3.newPage(); p3.setDefaultTimeout(6000);
  p3.on("pageerror", function(e){ errors.push(e.message); }); p3.on("dialog", function(d){ d.accept(); });
  await p3.goto(srv.url); await p3.waitForSelector(".student-row");
  await p3.locator('[data-open="r1"]').first().click();
  await p3.click('[data-sub="sessoes"]');
  await p3.waitForSelector("[data-renew-pack]");
  await p3.click("[data-renew-pack]");
  await p3.waitForFunction(function(){ var T = window.__fake.tables; return T.session_packs.length === 2 && T.payments.length === 1 && T.sessions.filter(function(x){ return x.id[0] === "x" && x.pack_id; }).length === 2; });
  var f3 = await p3.evaluate(function(){ var T = window.__fake.tables; return {packs: T.session_packs, pay: T.payments, ses: T.sessions}; });
  var np = f3.packs.filter(function(x){ return x.id !== "old"; })[0];
  check.check("16. Renovar cria um pacote igual (3 aulas, 120 €), que começa na primeira aula que ficou sem pacote", np && np.total === 3 && Number(np.price) === 120 && np.used_before === 0 && f3.ses.filter(function(x){ return x.id === "x0"; })[0].pack_id === np.id);
  check.check("17. As 2 aulas já dadas depois do pacote anterior passam para o novo; o antigo fica como estava", f3.ses.filter(function(x){ return x.pack_id === np.id; }).length === 2 && f3.ses.filter(function(x){ return x.pack_id === "old"; }).length === 3);
  check.check("18. Cria a cobrança de 120 € por pagar, com o pacote novo", f3.pay[0].amount === 120 && f3.pay[0].pack_id === np.id && !f3.pay[0].paid_on);
  await p3.waitForFunction(function(){ return /2 de 3 usadas/.test(document.getElementById("proMain").innerText); });
  check.check("19. A ficha mostra o pacote novo com 2 de 3 usadas (restam 1)", /restam 1/.test(await p3.locator("#proMain").innerText()));
  await ctx3.close();
  // ---- renovar antes de haver aulas: a validade conta a partir da 1.ª aula do pacote novo ----
  var ctx4 = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx4.addInitScript(fakeSource({role: "professional", userId: "pro-1", rows: [fixtureRow("q1", "Quita Renova")]}));
  await ctx4.addInitScript(function(){
    function iso(back){ var d = new Date(); d.setDate(d.getDate() - back); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
    var T = window.__fake.tables;
    T.session_packs.push({id: "old", student_id: "q1", name: "Pacote 2 aulas", total: 2, price: 80, starts_on: iso(100), expires_on: iso(100 - 183), missed_consumes: true, late_cancel_consumes: true, used_before: 0, shared_with: []});
    [60, 40].forEach(function(b, i){ T.sessions.push({id: "o" + i, student_id: "q1", pack_id: "old", date: iso(b), time: null, status: "feita", source: "calendario", external_id: "o" + i}); });
  });
  var p4 = await ctx4.newPage(); p4.setDefaultTimeout(6000);
  p4.on("pageerror", function(e){ errors.push(e.message); }); p4.on("dialog", function(d){ d.accept(); });
  await p4.goto(srv.url); await p4.waitForSelector(".student-row");
  await p4.locator('[data-open="q1"]').first().click();
  await p4.click('[data-sub="sessoes"]');
  await p4.waitForSelector("[data-renew-pack]");
  await p4.click("[data-renew-pack]");
  await p4.waitForFunction(function(){ return window.__fake.tables.session_packs.length === 2; });
  var n1 = await p4.evaluate(function(){ return window.__fake.tables.session_packs.filter(function(x){ return x.id !== "old"; })[0]; });
  check.check("20. Sem aulas ainda, o pacote renovado fica «a contar» (sem data de validade e com a marca da duração)", n1.expires_on === null && /^renov:\d+$/.test(n1.notes || ""));
  check.check("20b. E a ficha avisa que a validade conta a partir da 1.ª aula", /a validade conta a partir da 1\.ª aula/.test(await p4.locator("#proMain").innerText()));
  await ctx4.close();
  // a primeira aula do pacote novo entra: o início e a validade passam a contar dessa aula
  var ctx5 = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx5.addInitScript(fakeSource({role: "professional", userId: "pro-1", rows: [fixtureRow("w1", "Wanda Renova")]}));
  await ctx5.addInitScript(function(){
    function iso(back){ var d = new Date(); d.setDate(d.getDate() - back); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
    var T = window.__fake.tables;
    T.session_packs.push({id: "nw", student_id: "w1", name: "Pacote 5 aulas", total: 5, price: 100, starts_on: iso(9), expires_on: null, notes: "renov:6", missed_consumes: true, late_cancel_consumes: true, used_before: 0, shared_with: []});
    [4, 1].forEach(function(b, i){ T.sessions.push({id: "w" + i, student_id: "w1", pack_id: "nw", date: iso(b), time: null, status: "feita", source: "calendario", external_id: "w" + i}); });
  });
  var p5 = await ctx5.newPage(); p5.setDefaultTimeout(6000);
  p5.on("pageerror", function(e){ errors.push(e.message); }); p5.on("dialog", function(d){ d.accept(); });
  await p5.goto(srv.url); await p5.waitForSelector(".student-row");
  await p5.click("#navStudio"); await p5.waitForSelector("#fixPacks");
  await p5.click("#fixPacks");
  await p5.waitForFunction(function(){ var p = window.__fake.tables.session_packs[0]; return p && p.expires_on; });
  var n2 = await p5.evaluate(function(){ return window.__fake.tables.session_packs[0]; });
  var d4 = (function(){ var d = new Date(); d.setDate(d.getDate() - 4); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); })();
  check.check("21. Com a 1.ª aula dentro do pacote, o início passa a ser o dia dessa aula e a validade conta daí (a marca desaparece)", n2.starts_on === d4 && n2.notes === null && n2.expires_on === addMonthsISO(d4, 6));
  await ctx5.close();
  check.check("10. Nenhum erro de JavaScript", errors.length === 0);
  if (errors.length) console.log(errors.slice(0, 3));
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e.message.split("\n")[0]); process.exit(1); });
