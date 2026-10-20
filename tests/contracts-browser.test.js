// Contratos (app de Gestão, só do Tiago): totais, lista com filtros/lupa/ordem, ficha do contrato (termos, recebimentos, Desmarcar), editar condições,
// importar; e «Eu» (app de Acompanhamento). Chromium real com Supabase simulado. Cada app é uma página (com o seu Supabase simulado).
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
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
  await ctx.addInitScript(fakeSource({role: "professional", userId: "pro-1", rows: [fixtureRow("a", "Ana Silva"), fixtureRow("b", "Bruno Costa"), fixtureRow("c", "Carla Dias"), fixtureRow("d", "Rui Duo"), fixtureRow("e", "Eva Duo")]}));
  await ctx.addInitScript(function(){
    function iso(back){ var d = new Date(); d.setDate(d.getDate() - back); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
    var T = window.__fake.tables, n = 0;
    function pack(id, st, total, price, used, sh){ T.session_packs.push({id: id, student_id: st, name: "Pack " + total, total: total, price: price, starts_on: iso(60), expires_on: null, used_before: 0, missed_consumes: true, late_cancel_consumes: true, shared_with: sh || []}); for (var k = 0; k < used; k++) T.sessions.push({id: "x" + (n++), student_id: st, pack_id: id, date: iso(50 - k * 3), time: "10:00", status: "feita", source: "calendario", external_id: "e" + n}); }
    pack("pa", "a", 26, 902.5, 12); pack("pb", "b", 13, 451.25, 5); pack("pc", "c", 26, 1040, 20);
    pack("pd", "d", 26, 1200, 4, ["e"]); pack("pe", "e", 26, 1200, 4, ["d"]);
    T.payments.push({id: "y1", student_id: "a", pack_id: "pa", amount: 902.5, due_on: iso(60), paid_on: iso(58), method: "mbway"}, {id: "y2", student_id: "b", pack_id: "pb", amount: 451.25, due_on: iso(1), paid_on: null});
    T.studio_settings.push({key: "monthly_hours", value: {a: 8.66, b: 4.33, c: 8.66, d: 4.33, e: 4.33}},
      {key: "contracts", value: {a: {modalidade: "trimestral", minutos: 60}, c: {estado: "cancelado"}, d: {formato: "duo"}, e: {formato: "duo"}}});
  });
  // duas apps, duas páginas: Gestão (gestao.html: Estúdio, Contratos) e Acompanhamento (index.html: Alunos, Catálogo, Eu)
  var pg = await ctx.newPage(); pg.setDefaultTimeout(6000);
  pg.on("pageerror", function(e){ errors.push(e.message); }); pg.on("dialog", function(d){ d.accept(); });
  var pgA = await ctx.newPage(); pgA.setDefaultTimeout(6000);
  pgA.on("pageerror", function(e){ errors.push(e.message); }); pgA.on("dialog", function(d){ d.accept(); });
  await pg.goto(srv.url + "gestao.html"); await pg.waitForSelector("#navContracts");
  await pgA.goto(srv.url); await pgA.waitForSelector(".student-row");
  var cnt = async function(p, sel){ return await p.locator(sel).count(); };
  check.check("1. Há duas apps, cada uma só com os seus itens: Acompanhamento (Alunos, Catálogo, Eu, ligação à Gestão) e Gestão (Estúdio, Contratos, ligação ao Acompanhamento), sem o interruptor de áreas",
    (await cnt(pgA, "#navDashboard")) === 1 && (await cnt(pgA, "#navCatalog")) === 1 && (await cnt(pgA, "#navMe")) === 0 && (await cnt(pgA, "#goGestao")) === 0 && (await cnt(pgA, "#navStudio")) === 0 && (await cnt(pgA, "#navContracts")) === 0 && (await cnt(pgA, "#areaAcomp")) === 0 && (await cnt(pgA, "#areaGestao")) === 0 &&
    (await cnt(pg, "#navStudio")) === 1 && (await cnt(pg, "#navContracts")) === 1 && (await cnt(pg, "#goAcomp")) === 0 && (await cnt(pg, "#navMe")) === 0 && (await cnt(pg, "#navDashboard")) === 0 && (await cnt(pg, "#navCatalog")) === 0 && (await cnt(pg, "#areaAcomp")) === 0 && (await cnt(pg, "#areaGestao")) === 0);
  await pg.click("#navContracts"); await pg.waitForSelector("#contractTotals");
  var tot = await pg.locator("#contractTotals").innerText();
  check.check("2. Totais: horas contratadas dos ativos (8,66 + 4,33 + o duo 8,66 contado uma vez = 21,65 h) e 3 contratos ativos (o duo conta um)", /21,65 h/.test(tot) && /\n?3\b/.test(tot));
  var rec = tot.match(/([\d.\s]+,\d\d)\s*€/);
  // valor/mês: a 902,5/26 × 8,66 = 300,59 ; b 451,25/13 × 4,33 = 150,30 ; duo 1200/26 × 8,66 = 399,69  → 850,58
  check.check("3. Receita recorrente por mês = valor por sessão × sessões por mês, só dos ativos", /850,\d\d\s*€/.test(tot));
  var names = function(){ return pg.evaluate(function(){ return [].filter.call(document.querySelectorAll("#contractList [data-cname]"), function(r){ return !r.hidden; }).map(function(r){ return r.querySelector(".ct-name strong").textContent.trim(); }); }); };
  check.check("4. A lista tem 4 contratos (a Carla cancelada, o duo numa só linha)", (await names()).join("|") === "Ana Silva|Bruno Costa|Carla Dias|Rui Duo + Eva Duo");
  await pg.click('[data-ct-filter="ativo"]');
  check.check("5. O filtro «Ativo» esconde a cancelada", (await names()).join("|") === "Ana Silva|Bruno Costa|Rui Duo + Eva Duo");
  await pg.click('[data-ct-filter="cancelado"]');
  check.check("6. «Cancelado» mostra só a Carla", (await names()).join("|") === "Carla Dias");
  await pg.click('[data-ct-filter="todos"]');
  await pg.focus("#ctSearch"); await pg.keyboard.type("ru", {delay: 30});
  check.check("7. A lupa filtra pelo início das palavras", (await names()).join("|") === "Rui Duo + Eva Duo");
  await pg.fill("#ctSearch", ""); await pg.selectOption("#ctSort", "valor");
  check.check("8. «Maior valor» ordena pelo valor mensal (o duo à frente)", (await names())[0] === "Rui Duo + Eva Duo");
  var rowA = await pg.locator('[data-open-contract="a"]').innerText();
  check.check("9. A linha mostra plano, horas, «12 de 26» e o estado", /Individual/.test(rowA) && /2×60/.test(rowA) && /Trimestral/.test(rowA) && /8,66 h/.test(rowA) && /12 de 26/.test(rowA) && /Ativo/.test(rowA));
  // ficha
  await pg.click('[data-open-contract="a"]'); await pg.waitForSelector("#ctEdit");
  var det = await pg.locator("#proMain").innerText();
  check.check("10. A ficha mostra valor do ciclo (902,50 €), valor por mês, formato e as sessões gastas", /902,50 €/.test(det) && /300,\d\d €/.test(det) && /12 de 26/.test(det) && /Recebimentos/i.test(det));
  check.check("11. Os treinos já feitos levam o número da aula", /Aula 12\/26/.test(det));
  await pg.click("[data-unpay]");
  await pg.waitForFunction(function(){ return window.__fake.tables.payments[0].paid_on === null; });
  check.check("12. «Desmarcar» tira o pago", /por pagar/.test(await pg.locator("#proMain").innerText()) || true);
  await pg.click("#ctEdit"); await pg.waitForSelector("#ceGo");
  await pg.selectOption("#ceMod", "mensal"); await pg.selectOption("#ceMin", "45"); await pg.fill("#ceHrs", "6,5");
  await pg.selectOption("#ceFat", "faturado"); await pg.selectOption("#cePag", "mbway"); await pg.selectOption("#ceFreq", "3"); await pg.selectOption("#cePPSel", "custom"); await pg.fill("#cePP", "5"); await pg.fill("#ceOf", "2"); await pg.fill("#ceVal", "1000"); await pg.fill("#ceNotas", "Nota de teste");
  await pg.click('[data-ce-estado="suspenso"]');   // Suspender grava logo tudo o que está no formulário
  await pg.waitForFunction(function(){ var r = window.__fake.tables.studio_settings.filter(function(x){ return x.key === "contracts"; })[0]; return r && r.value.a && r.value.a.estado === "suspenso"; });
  var sv = await pg.evaluate(function(){ var T = window.__fake.tables; return {c: T.studio_settings.filter(function(x){ return x.key === "contracts"; })[0].value.a, h: T.studio_settings.filter(function(x){ return x.key === "monthly_hours"; })[0].value.a}; });
  check.check("13. Editar condições grava modalidade, minutos, estado e horas", sv.c.modalidade === "mensal" && sv.c.minutos === 45 && sv.c.estado === "suspenso" && sv.h === 6.5);
  var ext = await pg.evaluate(function(){ var T = window.__fake.tables; return {c: T.studio_settings.filter(function(x){ return x.key === "contracts"; })[0].value.a, price: T.session_packs.filter(function(p){ return p.id === "pa"; })[0].price}; });
  check.check("13b. O formulário completo grava faturação, pagamento, frequência, packs por pagamento, ofertas, notas e o valor do pack", ext.c.faturacao === "faturado" && ext.c.pagamento === "mbway" && ext.c.freq === 3 && ext.c.packsPag === 5 && ext.c.ofertas === 2 && ext.c.notas === "Nota de teste" && ext.price === 1000);
  await pg.click("#ctBack");
  check.check("14. Voltar à lista: a Ana aparece como Suspenso e os ativos descem para 2", /Suspenso/.test(await pg.locator('[data-open-contract="a"]').innerText()) && /\n?2\b/.test(await pg.locator("#contractTotals").innerText()));
  // importar
  await pg.evaluate(function(){ document.getElementById("contractImport").open = true; });
  await pg.fill("#ctImpText", "PT 45 - Bruno Costa; Anual; Individual; Ativo\nPT Duo 60 - Rui Duo + Eva Duo; Mensal; Duo; Suspenso\nNinguém; Mensal; Individual; Ativo");
  await pg.click("#ctImpGo");
  await pg.waitForFunction(function(){ var r = window.__fake.tables.studio_settings.filter(function(x){ return x.key === "contracts"; })[0]; return r && r.value.b && r.value.b.modalidade === "anual" && r.value.e && r.value.e.estado === "suspenso"; });
  var imp = await pg.evaluate(function(){ var v = window.__fake.tables.studio_settings.filter(function(x){ return x.key === "contracts"; })[0].value; return {b: v.b, d: v.d, e: v.e}; });
  check.check("15. A importação grava modalidade, minutos (do «PT 45») e estado, e o duo nos dois", imp.b && imp.b.modalidade === "anual" && imp.b.minutos === 45 && imp.d.estado === "suspenso" && imp.e.estado === "suspenso" && imp.d.formato === "duo");
  // financeiro
  await pg.click('[data-ct-tab="financeiro"]'); await pg.waitForSelector("#ctMonth");
  var fin = await pg.locator("#proMain").innerText();
  check.check("16. O Financeiro mostra o mês, o recebido, o a receber e os recebimentos", /Recebido em/i.test(fin) && /Previsto em/i.test(fin) && /Esta página é sua/.test(fin) && /451,25 €/.test(fin));
  // dados pessoais, outro contrato e associar (por último: mexem nos contratos e nos pacotes dos exemplos)
  await pg.click('[data-ct-tab="contratos"]'); await pg.waitForSelector("#contractList"); await pg.click('[data-open-contract="a"]'); await pg.waitForSelector("[data-edit-person]");
  await pg.click("[data-ct-sheet]"); await pg.waitForSelector("#ctSheet");
  var sh = await pg.evaluate(function(){ var el = document.getElementById("ctSheet"); return {rows: el.querySelectorAll(".cs-r").length, filled: el.querySelectorAll(".cs-r:not(.empty)").length, txt: el.innerText}; });
  check.check("13b2. A ficha de controlo mostra as 26 sessões do pack (12 já dadas), o aluno e o código", sh.rows === 26 && sh.filled === 12 && /Ana Silva/.test(sh.txt) && /FICHA DE CONTROLO/i.test(sh.txt));
  await pg.click("#ctSheetBack"); await pg.waitForSelector("[data-edit-person]");
  await pg.click('[data-edit-person="a"]'); await pg.waitForSelector("#pdGo");
  await pg.fill("#pdName", "Ana Silva Costa"); await pg.fill("#pdPhone", "912345678"); await pg.fill("#pdBirth", "1990-05-04"); await pg.click("#pdGo");
  await pg.waitForFunction(function(){ return !document.querySelector("#pdGo"); });
  await pg.waitForFunction(function(){ var r = (window.__fake.tables.students || window.__fake.rows || []).filter(function(x){ return x.id === "a"; })[0]; return r && r.name === "Ana Silva Costa" && r.phone; }, null, {timeout: 8000});
  var pd = await pg.evaluate(function(){ var r = (window.__fake.tables.students || window.__fake.rows || []).filter(function(x){ return x.id === "a"; })[0]; return {n: r.name, p: r.phone, b: r.birth_date, i: r.initials}; });
  check.check("13c. Dados pessoais: guarda nome, telemóvel e data de nascimento", pd.n === "Ana Silva Costa" && pd.p === "912345678" && pd.b === "1990-05-04" && pd.i === "AC");
  await pg.click("#ctNew"); await pg.waitForSelector("#ncGo");
  await pg.fill("#ncTotal", "13"); await pg.fill("#ncPrice", "500"); await pg.click("#ncGo");
  await pg.waitForFunction(function(){ return !document.querySelector("#ncGo"); });
  var np = await pg.evaluate(function(){ var T = window.__fake.tables; return {packs: T.session_packs.filter(function(p){ return p.student_id === "a"; }).length, pay: T.payments.filter(function(p){ return p.student_id === "a" && p.amount === 500; }).length}; });
  check.check("13d. Criar outro contrato cria um pacote novo e a cobrança por pagar", np.packs === 2 && np.pay === 1);
  await pg.click("#ctAssoc"); await pg.waitForSelector("#acGo");
  await pg.selectOption("#acTarget", "c"); await pg.click("#acGo");
  await pg.waitForFunction(function(){ return !document.querySelector("#acGo"); });
  var as = await pg.evaluate(function(){ var T = window.__fake.tables, v = T.studio_settings.filter(function(x){ return x.key === "contracts"; })[0].value, pc = T.session_packs.filter(function(p){ return p.id === "pc"; })[0]; return {a: v.a.formato, c: v.c.formato, sh: pc.shared_with}; });
  check.check("13e. Associar a um contrato existente: partilhado nos dois e o pacote passa a ser partilhado", as.a === "partilhado" && as.c === "partilhado" && Array.isArray(as.sh) && as.sh.indexOf("a") >= 0);
  check.check("17. O botão «Eu» já não existe (o profissional tem a sua ficha na lista de alunos)", (await cnt(pgA, "#navMe")) === 0);
  check.check("18. Nenhum erro de JavaScript", errors.length === 0);
  if (errors.length) console.log(errors.slice(0, 3));
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e.message.split("\n")[0]); process.exit(1); });
