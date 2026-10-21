// App «EVOLVE Treino» (treino.html): musculação + corrida numa app à parte; a app EVOLVE (index.html) fica só com alimentação e avaliações.
// Parte 1 (Node): ficheiros, manifesto, service worker. Parte 2 (Chromium com Supabase simulado): os ecrãs de cada app.
// O que não se vê aqui: instalar a app no ecrã principal do iPhone/Android (ícone, sessão própria por ícone) — só em telemóvel real.
require("./setup")();
var fs = require("fs"), path = require("path");
var check = require("./check")();
var root = path.join(__dirname, "..");
function read(f){ return fs.readFileSync(path.join(root, f), "utf8"); }

var treinoHtml = read("treino.html"), indexHtml = read("index.html"), gestaoHtml = read("gestao.html"), sw = read("sw.js"), app = read("app.js");
var bodyOf = function(h){ return h.slice(h.indexOf("<body>")); };
var manifest = JSON.parse(read("manifest-treino.json"));

// ---- ficheiros ----
check.check("1. treino.html tem o mesmo corpo que as outras duas páginas (só muda o cabeçalho: título, manifesto, ícones e data-app)", bodyOf(treinoHtml) === bodyOf(indexHtml) && bodyOf(treinoHtml) === bodyOf(gestaoHtml));
check.check("2. treino.html identifica-se como app «treino», com o seu manifesto e ícones; o corpo continua a ter #alunoApp (o service worker só guarda páginas da app)", /<html[^>]*data-app="treino"/.test(treinoHtml) && /manifest-treino\.json/.test(treinoHtml) && /icon-treino-180\.png/.test(treinoHtml) && /icon-treino-192\.png/.test(treinoHtml) && /id="alunoApp"/.test(treinoHtml) && /apple-mobile-web-app-title" content="Treino"/.test(treinoHtml));
check.check("3. O manifesto da app Treino é independente: start_url, id e nome próprios; ícones existentes", manifest.start_url === "./treino.html" && manifest.id === "./treino.html" && manifest.id !== JSON.parse(read("manifest.json")).id && manifest.id !== JSON.parse(read("manifest-gestao.json")).id && /Treino/.test(manifest.name) && manifest.display === "standalone" && manifest.icons.length >= 2 && manifest.icons.every(function(i){ return fs.existsSync(path.join(root, i.src)); }));
check.check("4. Os ícones são três tamanhos PNG, diferentes dos da EVOLVE e da Gestão", ["180", "192", "512"].every(function(n){ var f = path.join(root, "icon-treino-" + n + ".png"); return fs.existsSync(f) && !fs.readFileSync(f).equals(fs.readFileSync(path.join(root, "icon-" + n + ".png"))) && !fs.readFileSync(f).equals(fs.readFileSync(path.join(root, "icon-gestao-" + n + ".png"))); }));
check.check("5. O service worker guarda a página, o manifesto e os ícones de treino.html, e a cópia da página é por página (nunca o treino no lugar do EVOLVE)", ["treino.html", "manifest-treino.json", "icon-treino-180.png", "icon-treino-192.png", "icon-treino-512.png", "corrida.js", "corrida-core.js"].every(function(f){ return sw.indexOf('"' + f + '"') >= 0; }) && /treino\\\.html\$\/\.test\(p\) \? "treino\.html"/.test(sw));
check.check("6. A app distingue os três modos pelo data-app (gestao | treino | acompanhamento)", /APP_MODE = \(function\(\)/.test(app) && /a === "treino" \? "treino"/.test(app));
check.check("7. app.js não ficou maior que o limite (a Corrida vai noutro ficheiro, corrida.js)", Buffer.byteLength(app) < 1100000);

// ---- ecrãs ----
var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){ console.log("(ignorado o ecrã: Playwright/Chromium não disponíveis aqui)"); check.summarize(); }
var appSource = require("./extract-app")();
eval(appSource);
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");

function row(id, name, mut, logs){
  authRole = "professional";
  var s = buildFullDemoStudent(); s.id = id; s.name = name; s.isDemo = false; s.active = true; s.photos = [];
  s.nutritionPhase = null;
  if (mut) mut(s);
  var r = JSON.parse(JSON.stringify(studentToRow(s)));
  if (logs) r.workout_logs = logs; // studentToRow não escreve os treinos como profissional: o ecrã lê-os da coluna
  return r;
}

(async function(){
  var srv = await startStaticServer(root);
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  async function open(role, rows, page){
    var ctx = await browser.newContext({viewport: {width: 390, height: 844}});
    await ctx.addInitScript(fakeSource({role: role, userId: role === "professional" ? "pro-1" : "user-1", email: "ana@x.test", rows: rows}));
    var pg = await ctx.newPage(); pg.setDefaultTimeout(6000);
    pg.on("pageerror", function(e){ errors.push(e.message); });
    pg.on("dialog", function(d){ d.accept(); });
    await pg.goto(srv.url + (page || ""));
    return {ctx: ctx, pg: pg};
  }
  var tabs = function(pg){ return pg.locator(".tabbar button").allInnerTexts().then(function(a){ return a.map(function(t){ return t.trim(); }); }); };

  // app EVOLVE (index.html): só alimentação e avaliações
  var A = await open("student", [row("ana", "Ana Treina")]);
  await A.pg.waitForSelector(".check-circle[data-circle]");
  var tA = await tabs(A.pg);
  check.check("8. EVOLVE: os separadores são Hoje, Plano e Progresso (sem Treino nem Corrida)", tA.join("|") === "Hoje|Plano|Progresso");
  check.check("9. EVOLVE, Hoje: as refeições continuam, o treino saiu (sem «Iniciar treino») e há um atalho para a app Treino", (await A.pg.locator("#startWorkout").count()) === 0 && (await A.pg.locator('a[href="treino.html"]').count()) === 1 && /Treino e corrida/i.test(await A.pg.locator(".treino-app-link").innerText()));
  await A.pg.click('.tabbar [data-tab="plano"]');
  await A.pg.waitForSelector(".plano-meal-card, .seg");
  var planoTxt = await A.pg.locator("#alunoTabContent").innerText();
  check.check("10. EVOLVE, Plano: só Alimentação (e Compras); sem o programa de treino", !/Programa de treino/i.test(planoTxt) && (await A.pg.locator('[data-plano-sec="treino"]').count()) === 0 && (await A.pg.locator("[data-start-day]").count()) === 0);
  await A.ctx.close();

  // quem não faz nutrição: na EVOLVE só há o atalho para o treino
  var N = await open("student", [row("ana", "Ana Treina", function(s){ s.noNutrition = true; })]);
  await N.pg.waitForSelector(".treino-app-link");
  check.check("11. Sem nutrição: a EVOLVE mostra só o atalho para a app Treino", (await N.pg.locator(".check-circle").count()) === 0 && (await N.pg.locator('a[href="treino.html"]').count()) === 1);
  await N.ctx.close();

  // app Treino (treino.html)
  var T = await open("student", [row("ana", "Ana Treina", null, [{id: "w1", date: "2026-10-10", dayId: null, dayName: "Treino A", rpe: 7, notes: "", entries: [{exerciseId: null, name: "Agachamento", sets: [{reps: 8, load: 60}, {reps: 8, load: 60}]}]}])], "treino.html");
  await T.pg.waitForSelector("#startWorkout");
  var tT = await tabs(T.pg);
  check.check("12. Treino: os separadores são Treino e Corrida (sem Plano nem Progresso)", tT.join("|") === "Treino|Corrida");
  var homeTxt = await T.pg.locator("#alunoTabContent").innerText();
  check.check("13. Treino, início: treino de hoje, programa e últimos treinos; nada de refeições", (await T.pg.locator(".check-circle[data-circle]").count()) === 0 && /Programa de treino/i.test(homeTxt) && /Últimos treinos/i.test(homeTxt) && /Treino A/i.test(homeTxt) && /2 séries/i.test(homeTxt));
  check.check("14. Treino, início: há ligação para a app EVOLVE (alimentação e avaliações)", (await T.pg.locator('#alunoTabContent a[href="index.html"]').count()) === 1);
  check.check("15. O botão «Treino» do separador fica aceso no início", await T.pg.locator('.tabbar [data-tab="hoje"]').evaluate(function(b){ return b.classList.contains("active"); }));
  await T.pg.click("#startWorkout");
  await T.pg.waitForSelector("#backToHoje");
  check.check("16. O ecrã de treino abre dentro da app Treino, com «← Treino» e a linha de música", /← Treino/i.test(await T.pg.locator("#backToHoje").innerText()) && (await T.pg.locator("[data-music]").count()) === 3 && await T.pg.locator('.tabbar [data-tab="hoje"]').evaluate(function(b){ return b.classList.contains("active"); }));
  await T.pg.click("#backToHoje");
  await T.pg.waitForSelector("#startWorkout");
  check.check("17. «← Treino» volta ao início da app", /Programa de treino/i.test(await T.pg.locator("#alunoTabContent").innerText()));
  await T.pg.click('.tabbar [data-tab="corrida"]');
  await T.pg.waitForSelector("#alunoTabContent");
  check.check("18. O separador Corrida abre (carrega corrida.js sob pedido)", await T.pg.locator('.tabbar [data-tab="corrida"]').evaluate(function(b){ return b.classList.contains("active"); }));
  await T.ctx.close();

  // o profissional em treino.html: só pré-visualiza o ecrã do aluno
  var P = await open("professional", [row("ana", "Ana Treina"), row("rui", "Rui Costa")], "treino.html");
  await P.pg.waitForSelector("#alunoStudentSwitch");
  check.check("19. O profissional em treino.html vê o ecrã do aluno com seletor de aluno, sem o interruptor Aluno/Profissional nem a área do profissional", !(await P.pg.locator("#modeSwitch").isVisible()) && !(await P.pg.locator("#proApp").isVisible()) && (await P.pg.locator("#startWorkout").count()) === 1);
  await P.ctx.close();

  // sem sessão ativa nem Supabase configurado a app continua a abrir
  check.check("20. Nenhum erro de JavaScript", errors.length === 0);
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e.message.split("\n")[0]); process.exit(1); });
