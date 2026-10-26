// A Gestão (estúdio, contratos, pacotes) vive em gestao.js, que só o profissional descarrega.
// Estático: o núcleo não usa nomes do módulo sem passar por G, não há nomes repetidos, o service worker trata o ficheiro bem.
// Browser: o aluno nunca pede gestao.js; o profissional pede-o uma vez; se falhar, o resto da app continua e dá para tentar de novo.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var fs = require("fs");
var path = require("path");
var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(q){ return fs.existsSync(q); })[0];
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");

var root = path.join(__dirname, "..");
var html = fs.readFileSync(path.join(root, "app.js"), "utf8");
var gestao = fs.readFileSync(path.join(root, "gestao.js"), "utf8");
var sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");

// núcleo = o script inline de index.html (sem gestao.js); nomes de topo = «function X(» / «var X» no início de linha
var a = html.indexOf('"use strict";') + 13, b = html.lastIndexOf("})();");
var coreText = html.slice(a, b);
function topNames(src){
  var names = {}, re = /^(?:function\s+([A-Za-z_$][\w$]*)|(?:var|let|const)\s+([A-Za-z_$][\w$]*))/gm, m;
  while ((m = re.exec(src))) names[m[1] || m[2]] = true;
  return names;
}
var coreNames = topNames(coreText), modNames = topNames(gestao);
var modOnly = Object.keys(modNames).filter(function(n){ return !coreNames[n]; });
var repeated = Object.keys(modNames).filter(function(n){ return coreNames[n]; });

check.check("1. gestao.js tem declarações próprias (nomes de topo) e nenhuma repete uma do núcleo", modOnly.length > 100 && repeated.length === 0);
// uma referência a «studio», «contractMeta»... no núcleo, fora de G.xxx, rebentaria para o aluno e para o profissional sem rede
var leaks = modOnly.filter(function(n){
  var re = new RegExp("(^|[^\\w$.\"'])" + n.replace(/\$/g, "\\$") + "(?![\\w$])", "m");
  return coreText.split("\n").some(function(line){ return re.test(line.replace(/\/\/.*$/, "").replace(/"(?:[^"\\]|\\.)*"/g, '""')); });
});
check.check("2. O núcleo não usa nenhum nome do módulo sem passar por G (" + (leaks.slice(0, 5).join(", ") || "nenhum") + ")", leaks.length === 0);
check.check("3. O módulo exporta o que o núcleo chama e marca-se como carregado", ["G.enter", "G.studioNavLabel", "G.studio", "G.renderProStudioMain", "G.renderProContractsMain", "G.tplProSessoes", "G.wireProSessoes", "G.studentStudioSummary", "G.studioRefresh", "G.studioAutoSessions", "G.studioAfterAutoSessions", "G.loaded = true"].every(function(s){ return gestao.indexOf(s) >= 0; }));
var pageA = fs.readFileSync(path.join(root, "index.html"), "utf8"), pageG = fs.readFileSync(path.join(root, "gestao.html"), "utf8");
check.check("4. Nenhuma das duas páginas carrega gestao.js como script nem o service worker o pré-guarda; o núcleo carrega-o com loadGestao()", !/<script[^>]*gestao\.js/.test(pageA + pageG) && !/SHELL = \[[^\]]*"gestao\.js"/.test(sw) && /function loadGestao\(/.test(html));
check.check("5. O service worker serve app.js, app.css, gestao.js e a Corrida (corrida.js, corrida-core.js) com rede primeiro (nunca uma cópia antiga com rede) e cache como reserva", /networkFirstFile/.test(sw) && /\(gestao\|corrida\|corrida-core\|corrida-live\|app\)\\\.\(js\|css\)/.test(sw) && /no-cache/.test(sw.slice(sw.indexOf("function networkFirstFile"))));
check.check("6. O núcleo (app.js) ficou sem a Gestão: menos de 1,1 MB (o núcleo foi crescendo com o treino, a nutrição e o convite por link; a Gestão já não conta), e a Gestão (gestao.js) tem mais de 150 KB", Buffer.byteLength(html) < 1100000 && Buffer.byteLength(gestao) > 150000);
// as duas páginas têm o mesmo corpo (ecrãs de entrada, modais...) e só diferem no cabeçalho (nome, manifesto, ícone) e em data-app
var bodyOf = function(t){ return t.slice(t.indexOf("<body>")); };
check.check("7. gestao.html e index.html têm o mesmo corpo; a Gestão tem data-app, manifesto e ícone próprios", bodyOf(pageA) === bodyOf(pageG) && /<html[^>]*data-app="gestao"/.test(pageG) && !/data-app/.test(pageA) && /manifest-gestao\.json/.test(pageG) && /icon-gestao-180\.png/.test(pageG) && /manifest\.json/.test(pageA));
var mA = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8")), mG = JSON.parse(fs.readFileSync(path.join(root, "manifest-gestao.json"), "utf8"));
check.check("8. O manifesto da Gestão é de outra app (nome, início em gestao.html, id e ícones próprios) no mesmo âmbito", mG.start_url === "./gestao.html" && mG.id !== mA.id && mG.short_name !== mA.short_name && mG.scope === mA.scope && mG.icons.every(function(i){ return /icon-gestao-/.test(i.src) && fs.existsSync(path.join(root, i.src)); }));

if (!pw || !chromiumPath){ console.log("(ignorado: Playwright/Chromium não disponíveis aqui)"); check.check("browser indisponível — teste ignorado", true); check.summarize(); return; }

function fixtureRow(id, name){
  authRole = "professional";
  var s = buildFullDemoStudent();
  s.id = id; s.name = name; s.isDemo = false; s.active = true; s.photos = [];
  return JSON.parse(JSON.stringify(studentToRow(s)));
}

(async function(){
  var srv = await startStaticServer(root);
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  function watch(pg, log){
    pg.on("pageerror", function(e){ errors.push(e.message); });
    pg.on("dialog", function(d){ d.accept(); });
    pg.on("request", function(r){ if (/gestao\.js/.test(r.url())) log.push(r.url()); });
  }
  async function open(role, rows, page, opts){
    var ctx = await browser.newContext(Object.assign({viewport: {width: 390, height: 844}}, opts || {}));
    await ctx.addInitScript(fakeSource({role: role, userId: role === "professional" ? "pro-1" : "user-1", rows: rows}));
    var pg = await ctx.newPage(); pg.setDefaultTimeout(6000);
    var log = []; watch(pg, log);
    await pg.goto(srv.url + (page || ""));
    return {ctx: ctx, pg: pg, log: log};
  }
  var PRO_ROWS = [fixtureRow("a", "Ana Silva"), fixtureRow("b", "Bruno Costa")];

  // 9. aluno: nunca pede gestao.js
  var S = await open("student", [fixtureRow("stu1", "Ana Teste")]);
  await S.pg.waitForSelector(".check-circle[data-circle]");
  await S.pg.waitForTimeout(600);
  check.check("9. O aluno não descarrega gestao.js", S.log.length === 0);
  await S.ctx.close();

  // 10. a app de Acompanhamento do profissional: sem Gestão dentro (sem área, sem pedido do ficheiro, sem separador Pacotes), com ligação à outra app
  var A = await open("professional", PRO_ROWS);
  await A.pg.waitForSelector(".student-row");
  await A.pg.waitForTimeout(500);
  var sideA = await A.pg.locator(".pro-sidebar").innerText();
  check.check("10. No Acompanhamento: Alunos e Catálogo, sem ligação para a outra app (são independentes); sem seletor de áreas, Estúdio nem Contratos; sem pedir gestao.js",
    /Alunos/i.test(sideA) && /Cat[aá]logo/i.test(sideA) && !/\bEu\b/i.test(sideA) && (await A.pg.locator("#goGestao").count()) === 0 &&
    (await A.pg.locator("#areaGestao, #areaAcomp, #navStudio, #navContracts").count()) === 0 && A.log.length === 0);
  await A.pg.locator('[data-open="a"]').first().click();
  await A.pg.waitForSelector("#proBack");
  check.check("11. A ficha do aluno no Acompanhamento não tem o separador Pacotes", (await A.pg.locator('[data-sub="sessoes"]').count()) === 0 && !/Pacotes/.test(await A.pg.locator(".pro-subtabs").innerText()));
  await A.pg.click("#proBack"); await A.pg.waitForSelector(".student-row");
  check.check("12. O botão «Eu» foi retirado do Acompanhamento", (await A.pg.locator("#navMe").count()) === 0);
  await A.ctx.close();

  // 13. a app de Gestão: abre no Estúdio, descarrega gestao.js uma vez, sem lista de alunos nem menu de acompanhamento
  var G2 = await open("professional", PRO_ROWS, "gestao.html");
  await G2.pg.waitForSelector("#gcalCard");
  var sideG = await G2.pg.locator(".pro-sidebar").innerText();
  check.check("13. Na Gestão: abre no Estúdio, menu Estúdio e Contratos sem ligação para a outra app; sem Alunos/Catálogo/Eu nem interruptor Aluno/Profissional; gestao.js pedido uma vez",
    /Hoje/i.test(sideG) && /Contratos/i.test(sideG) && (await G2.pg.locator("#goAcomp").count()) === 0 &&
    (await G2.pg.locator("#navDashboard, #navCatalog, #navMe, .student-row").count()) === 0 && !(await G2.pg.locator("#modeSwitch").isVisible()) && G2.log.length === 1);
  await G2.pg.click("#navContracts"); await G2.pg.waitForSelector("#contractTotals");
  await G2.pg.click("#navStudio"); await G2.pg.waitForSelector("#gcalCard");
  check.check("14. Na Gestão dá para ir de Estúdio a Contratos e voltar", (await G2.pg.locator("#gcalCard").count()) === 1);
  // 14b. alunos sem pacote: sem lista de alunos na Gestão, abrem-se a partir do separador Clientes dos Contratos para lhes criar o primeiro pacote
  await G2.pg.click("#navContracts"); await G2.pg.waitForSelector("#contractTotals"); await G2.pg.click('[data-ct-filter="semcontrato"]'); await G2.pg.waitForSelector("[data-open-student]");
  check.check("14b. Na Gestão, o filtro «Sem contrato» lista os alunos sem pacote e abre a ficha de Pacotes para criar o primeiro", (await G2.pg.locator("[data-open-student]").count()) >= 2);
  await G2.pg.locator('[data-open-student]').first().click();
  await G2.pg.waitForSelector("#pkAdd", {state: "attached"});
  check.check("14c. A ficha aberta a partir daí mostra só Pacotes (formulário para criar o pacote), sem separadores de acompanhamento", (await G2.pg.locator("[data-sub]").count()) === 0 && (await G2.pg.locator("#pkAdd").count()) === 1);
  await G2.ctx.close();

  // 15. uma conta de aluno na app de Gestão não entra: mostra aviso e ligação para a app dele
  var GS = await open("student", [fixtureRow("stu1", "Ana Teste")], "gestao.html");
  await GS.pg.waitForSelector("#noStudentScreen:not(.hidden)");
  var msg = await GS.pg.locator("#noStudentScreen").innerText();
  check.check("15. Um aluno em gestao.html vê «Só para o profissional», com ligação para a app EVOLVE, e não descarrega gestao.js", /Só para o profissional/i.test(msg) && (await GS.pg.locator('#noStudentScreen a[href="index.html"]').count()) === 1 && GS.log.length === 0);
  await GS.ctx.close();

  // 16. falha ao carregar gestao.js: aviso e «Tentar outra vez»; quando a ligação volta, abre
  var failing = true;
  var ctxF = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: "block"}); // sem o service worker, o route() apanha o pedido
  await ctxF.addInitScript(fakeSource({role: "professional", userId: "pro-1", rows: PRO_ROWS}));
  await ctxF.route(/gestao\.js/, function(route){ if (failing) route.fulfill({status: 503, body: "no"}); else route.continue(); });
  var pgF = await ctxF.newPage(); pgF.setDefaultTimeout(6000);
  var reqF = []; watch(pgF, reqF);
  await pgF.goto(srv.url + "gestao.html");
  await pgF.waitForSelector("#gestaoRetry");
  check.check("16. Sem gestao.js a app de Gestão avisa «Não foi possível abrir a Gestão» e oferece «Tentar outra vez»", /Não foi possível abrir a Gestão/.test(await pgF.locator("#proMain").innerText()));
  failing = false;
  await pgF.click("#gestaoRetry");
  await pgF.waitForSelector("#gcalCard");
  check.check("17. Quando a ligação volta, «Tentar outra vez» carrega o ficheiro e mostra o Estúdio", reqF.length >= 2);
  await ctxF.close();

  // 18-19. service worker: guarda o código e as duas páginas; sem rede ainda serve gestao.js
  var W = await open("professional", [fixtureRow("a", "Ana Silva")], "gestao.html");
  W.pg.setDefaultTimeout(8000);
  await W.pg.waitForSelector("#gcalCard");
  await W.pg.waitForFunction(function(){ return navigator.serviceWorker && navigator.serviceWorker.controller; }, null, {timeout: 8000}).catch(function(){});
  await W.pg.reload(); await W.pg.waitForSelector("#gcalCard");
  var names = ["gestao.js", "app.js", "app.css", "gestao.html"];
  await W.pg.waitForFunction(function(n){ return caches.open("evolve-v5").then(function(c){ return Promise.all(n.map(function(x){ return c.match(x); })); }).then(function(m){ return m.every(Boolean); }); }, names, {timeout: 8000}).catch(function(){});
  var cached = await W.pg.evaluate(function(n){ return caches.open("evolve-v5").then(function(c){ return Promise.all(n.map(function(x){ return c.match(x).then(function(m){ return !!m; }); })); }); }, names);
  check.check("18. O service worker guarda gestao.js, app.js, app.css e a página gestao.html (rede primeiro)", cached.every(Boolean));
  await W.ctx.setOffline(true);
  var offStatus = await W.pg.evaluate(function(){ return fetch("gestao.js").then(function(r){ return r.status; }).catch(function(e){ return "erro " + e.message; }); });
  check.check("19. Sem rede, gestao.js sai da cache do service worker (a Gestão abre offline)", offStatus === 200);
  await W.ctx.close();

  await browser.close();
  srv.server.close();
  check.check("20. Sem erros de JavaScript nas páginas", errors.length === 0 || (console.log(errors), false));
  check.summarize();
})();
