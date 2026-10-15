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
var html = fs.readFileSync(path.join(root, "index.html"), "utf8");
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
check.check("3. O módulo exporta o que o núcleo chama e marca-se como carregado", ["G.enter", "G.goToMe", "G.gestaoAreaLabel", "G.studio", "G.renderProStudioMain", "G.renderProContractsMain", "G.tplProSessoes", "G.wireProSessoes", "G.studentStudioSummary", "G.studioRefresh", "G.studioAutoSessions", "G.studioAfterAutoSessions", "G.loaded = true"].every(function(s){ return gestao.indexOf(s) >= 0; }));
check.check("4. index.html não carrega gestao.js como script nem o service worker o pré-guarda; o núcleo carrega-o com loadGestao()", !/<script[^>]*gestao\.js/.test(html) && !/SHELL = \[[^\]]*gestao/.test(sw) && /function loadGestao\(/.test(html));
check.check("5. O service worker serve gestao.js com rede primeiro (nunca uma cópia antiga com rede) e cache como reserva", /networkFirstFile/.test(sw) && /gestao\\\.js/.test(sw) && /no-cache/.test(sw.slice(sw.indexOf("function networkFirstFile"))));
check.check("6. O ficheiro dos alunos (index.html) ficou sem a Gestão: menos de 1,03 MB, e a Gestão (gestao.js) tem mais de 150 KB", Buffer.byteLength(html) < 1030000 && Buffer.byteLength(gestao) > 150000);

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

  // 7. aluno: nunca pede gestao.js
  var ctxS = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctxS.addInitScript(fakeSource({role: "student", userId: "user-1", rows: [fixtureRow("stu1", "Ana Teste")]}));
  var pgS = await ctxS.newPage(); pgS.setDefaultTimeout(6000);
  var reqS = []; watch(pgS, reqS);
  await pgS.goto(srv.url);
  await pgS.waitForSelector(".check-circle[data-circle]");
  await pgS.waitForTimeout(600);
  check.check("7. O aluno não descarrega gestao.js", reqS.length === 0);
  await ctxS.close();

  // 8. profissional: pede uma vez (logo a seguir ao arranque) e a Gestão abre
  var ctxP = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctxP.addInitScript(fakeSource({role: "professional", userId: "pro-1", rows: [fixtureRow("a", "Ana Silva"), fixtureRow("b", "Bruno Costa")]}));
  var pgP = await ctxP.newPage(); pgP.setDefaultTimeout(6000);
  var reqP = []; watch(pgP, reqP);
  await pgP.goto(srv.url);
  await pgP.waitForSelector(".student-row");
  await pgP.waitForTimeout(500);
  await pgP.click("#areaGestao");
  await pgP.click("#navContracts");
  await pgP.waitForSelector("#contractTotals");
  await pgP.click("#navStudio");
  await pgP.waitForSelector("#gcalCard");
  await pgP.click("#areaAcomp");
  await pgP.waitForSelector(".student-row");
  await pgP.click("#areaGestao");
  await pgP.waitForTimeout(300);
  check.check("8. O profissional descarrega gestao.js uma só vez e abre Estúdio e Contratos", reqP.length === 1);
  await ctxP.close();

  // 9. falha ao carregar: o resto da app funciona, aparece um aviso e dá para tentar de novo
  var ctxF = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: "block"}); // sem o service worker, o route() apanha o pedido
  await ctxF.addInitScript(fakeSource({role: "professional", userId: "pro-1", rows: [fixtureRow("a", "Ana Silva"), fixtureRow("b", "Bruno Costa")]}));
  var failing = true;
  await ctxF.route(/gestao\.js/, function(route){ if (failing) route.fulfill({status: 503, body: "no"}); else route.continue(); });
  var pgF = await ctxF.newPage(); pgF.setDefaultTimeout(6000);
  var reqF = []; watch(pgF, reqF);
  await pgF.goto(srv.url);
  await pgF.waitForSelector(".student-row");
  await pgF.waitForTimeout(400);
  check.check("9. Sem gestao.js a lista de alunos funciona na mesma", (await pgF.locator(".student-row").count()) === 2);
  await pgF.click("#areaGestao");
  await pgF.waitForSelector(".toast");
  check.check("10. Ao abrir a Gestão sem o ficheiro, aparece um aviso e a app não muda de ecrã", /Não foi possível abrir a Gestão/.test(await pgF.locator(".toast").first().innerText()) && (await pgF.locator(".student-row").count()) === 2);
  // a ficha do aluno: o separador Pacotes avisa em vez de ficar em branco
  await pgF.locator('[data-open="a"]').first().click();
  await pgF.click('[data-sub="sessoes"]');
  await pgF.waitForFunction(function(){ return /Não foi possível abrir os pacotes/.test(document.getElementById("proMain").innerText); });
  check.check("11. O separador Pacotes da ficha avisa que não carregou (em vez de ficar em branco)", /Não foi possível abrir os pacotes/.test(await pgF.locator("#proMain").innerText()));
  failing = false;
  // voltar à lista e tentar outra vez: já carrega
  await pgF.click("#proBack");
  await pgF.waitForSelector(".student-row");
  await pgF.click("#areaGestao");
  await pgF.click("#navContracts");
  await pgF.waitForSelector("#contractTotals");
  check.check("12. Quando a ligação volta, abrir a Gestão carrega o ficheiro e funciona (tenta de novo)", reqF.length >= 2 && (await pgF.locator("#contractTotals").count()) === 1);
  await ctxF.close();

  // 13-14. service worker: com o ficheiro já visto, sem rede ainda o serve (cópia guardada); com rede vem sempre o atual
  var ctxW = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctxW.addInitScript(fakeSource({role: "professional", userId: "pro-1", rows: [fixtureRow("a", "Ana Silva")]}));
  var pgW = await ctxW.newPage(); pgW.setDefaultTimeout(8000);
  watch(pgW, []);
  await pgW.goto(srv.url);
  await pgW.waitForSelector(".student-row");
  await pgW.waitForFunction(function(){ return navigator.serviceWorker && navigator.serviceWorker.controller; }, null, {timeout: 8000}).catch(function(){});
  await pgW.reload(); await pgW.waitForSelector(".student-row");
  await pgW.waitForFunction(function(){ return caches.open("evolve-v1").then(function(c){ return c.match("gestao.js"); }).then(function(m){ return !!m; }); }, null, {timeout: 8000}).catch(function(){});
  var cached = await pgW.evaluate(function(){ return caches.open("evolve-v1").then(function(c){ return c.match("gestao.js"); }).then(function(m){ return !!m; }); });
  check.check("13. O service worker guarda gestao.js depois de o profissional a usar (rede primeiro)", cached);
  await ctxW.setOffline(true);
  var offStatus = await pgW.evaluate(function(){ return fetch("gestao.js").then(function(r){ return r.status + ":" + (r.headers.get("content-type") || "") ; }).catch(function(e){ return "erro " + e.message; }); });
  check.check("14. Sem rede, gestao.js sai da cache do service worker (a Gestão abre offline)", /^200/.test(offStatus));
  await ctxW.close();

  await browser.close();
  srv.server.close();
  check.check("15. Sem erros de JavaScript na página", errors.length === 0 || (console.log(errors), false));
  check.summarize();
})();
