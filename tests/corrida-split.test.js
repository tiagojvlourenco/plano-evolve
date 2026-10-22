// Corrida: corrida.js (ecrãs do aluno e do profissional) é um ficheiro à parte, avaliado COM o núcleo (corrida-core.js) e o gravador (corrida-live.js)
// num só eval. Estático: nomes de topo próprios e sem repetições, ES5, sem GPS nem armazenamento local nem rede, sem HTML cru, o contrato com o gravador,
// o CSS só com classes .run-. Browser: ninguém pede os ficheiros da Corrida sem abrir o separador (aluno) ou «Corridas» (profissional).
require("./setup")();
var fs = require("fs"), path = require("path");
var check = require("./check")();
var root = path.join(__dirname, "..");
function read(f){ return fs.readFileSync(path.join(root, f), "utf8"); }
var n = 0;
function ck(desc, cond){ n++; if (parseInt(desc, 10) !== n) console.log("AVISO: verificação numerada " + parseInt(desc, 10) + " na posição " + n); check.check(desc, !!cond); }

var ui = read("corrida.js"), core = read("corrida-core.js"), app = read("app.js"), gestao = read("gestao.js"), sw = read("sw.js"), css = read("app.css");
var live = fs.existsSync(path.join(root, "corrida-live.js")) ? read("corrida-live.js") : "";
function topNames(src){
  var names = [], re = /^(?:function\s+([A-Za-z_$][\w$]*)|(?:var|let|const)\s+([A-Za-z_$][\w$]*))/gm, m;
  while ((m = re.exec(src))) names.push(m[1] || m[2]);
  return names;
}
var uiNames = topNames(ui), coreNames = topNames(core), liveNames = topNames(live);
var appCore = app.slice(app.indexOf('"use strict";') + 13, app.lastIndexOf("})();")), appNames = topNames(appCore), gestaoNames = topNames(gestao);
// o código sem comentários nem textos (para procurar construções da linguagem sem apanhar frases)
function bare(src){
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1").replace(/"(?:[^"\\\n]|\\.)*"/g, '""').replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
}
var code = bare(ui);

// ---- tamanho e nomes ----
ck("1. corrida.js existe e tem um tamanho razoável (entre 30 KB e 140 KB; um ecrã carregado sob pedido, não o núcleo)", Buffer.byteLength(ui) > 30000 && Buffer.byteLength(ui) < 140000);
ck("2. Todas as declarações de topo levam o prefixo runUi / RUN_UI_ (o núcleo usa run* e RUN_*, o gravador os seus)", uiNames.length > 60 && uiNames.every(function(x){ return /^(runUi[A-Z]|RUN_UI_[A-Z])/.test(x); }));
var dupSelf = uiNames.filter(function(x, i){ return uiNames.indexOf(x) !== i; });
ck("3. Nenhum nome é declarado duas vezes dentro do ficheiro" + (dupSelf.length ? " (" + dupSelf.join(", ") + ")" : ""), dupSelf.length === 0);
var clash = uiNames.filter(function(x){ return coreNames.indexOf(x) >= 0 || appNames.indexOf(x) >= 0 || gestaoNames.indexOf(x) >= 0 || liveNames.indexOf(x) >= 0; });
ck("4. Nenhum nome de topo repete um do núcleo da Corrida, da app, da Gestão ou do gravador (num eval conjunto a 2.ª declaração apagava a 1.ª em silêncio)" + (clash.length ? " (" + clash.join(", ") + ")" : ""), clash.length === 0);
ck("5. corrida.js não declara RUN (já existe em app.js) e não toca nas chaves de armazenamento do gravador (RUN_DRAFT_KEY / RUN_OUTBOX_KEY / RUN_CONSENT_KEY: o recibo do consentimento pede-se por RUN.consentCacheGet/Set/Clear)", !/\b(var|function|let|const)\s+RUN\b/.test(code) && !/RUN_DRAFT_KEY|RUN_OUTBOX_KEY|RUN_CONSENT_KEY/.test(code));
ck("6. Não menciona o diagnóstico de GPS antigo", !/gps-teste/i.test(ui));

// ---- ES5 do projeto ----
ck("7. ES5: sem funções de seta, let, const, async/await, classes, módulos nem textos com acento grave", !/=>/.test(code) && !/\b(let|const|async|await|class|yield)\b/.test(code) && !/`/.test(ui) && !/^\s*(import|export)\s/m.test(code));
ck("8. ES5: sem Object.assign, Array.prototype.find/includes, String startsWith/endsWith/includes/padStart nem spread", !/Object\.assign|\.find\(|\.includes\(|\.startsWith\(|\.endsWith\(|\.padStart\(|\.\.\.[A-Za-z_$\[]/.test(code));
var strictOk = true;
try { new Function('"use strict";\n' + core + "\n" + ui + "\n" + live); } catch (e) { strictOk = false; console.log(e.message); }
ck("9. O núcleo, corrida.js e o gravador juntos compilam em modo estrito (é assim que a app os avalia)", strictOk);

// ---- privacidade e rede ----
ck("10. Sem GPS (navigator.geolocation) — só o gravador o usa —, sem localStorage/sessionStorage/IndexedDB/cookies e sem Cache API", !/geolocation|watchPosition|getCurrentPosition|localStorage|sessionStorage|indexedDB|document\.cookie|\bcaches\b/.test(code));
ck("11. Sem consola (nenhuma coordenada pode sair por aí), sem fetch/XHR/beacon/WebSocket/Image, sem eval nem new Function", !/\bconsole\b|\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|new\s+Image\b|importScripts|\beval\s*\(|new\s+Function/.test(code));
ck("12. Nenhum endereço de rede nem de mapa no ficheiro (nenhum http, https, //, tile, mapbox, google, openstreetmap)", !/https?:|\/\/[a-z]|tile|mapbox|openstreetmap|googleapis|maps\.google/i.test(ui.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")));
ck("13. O HTML dos ecrãs não leva eventos nem recursos externos: sem onclick=/onerror=…, sem javascript:, sem <script>, <img>, <iframe>, <link>, <object>, <embed>, <style>", !/\bon[a-z]+\s*=\s*\\?["']/i.test(ui.replace(/fr\.on(load|error)\s*=/g, "")) && !/javascript:|<\s*(script|img|iframe|link|object|embed|style|svg)\b/i.test(ui));
var inner = ui.split("\n").filter(function(l){ return /\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write/.test(l); });
ck("14. Só há UMA escrita de HTML no DOM (a ficha do profissional, que desenha tudo de uma vez) e nada de insertAdjacentHTML/document.write; o resto vai por RUN.screen (devolve texto para o núcleo escapar-se a si próprio)", inner.length === 1 && /el\.innerHTML = runUiProHtml\(s, d\)/.test(inner[0]));
// o texto que vem de dados nunca entra no HTML sem escapeHtml: as linhas de construção de HTML que tocam em campos de dados usam-no
var dataFields = ["r.notes", "r.id", "d.modeErr", "f.notes", "f.date", "f.time", "f.km", "f.dur", "w.", "g[0]", "g[1]"];
var rawLeaks = ui.split("\n").filter(function(l){
  return /<[a-z]/.test(l) && /['"]\s*\+\s*(r\.notes|r\.id|f\.notes|f\.km|f\.dur|f\.date|f\.time|d\.modeErr|prep\.warnings|prep\.source|m\[1\])\s*\+/.test(l);
});
ck("15. Nenhuma linha de HTML concatena notas, ids, avisos ou campos dos formulários sem escapeHtml" + (rawLeaks.length ? " (" + rawLeaks.length + ")" : ""), rawLeaks.length === 0 && (ui.match(/escapeHtml\(/g) || []).length > 30);
ck("16. O SVG vem só de runTrackSvg (o ficheiro não escreve elementos svg à mão) e o percurso da BD passa por runUiTrackFromDb antes de ser desenhado", !/<svg|<polyline|<circle|<path/i.test(ui) && /runUiTrackFromDb\(res\.data\.points\)/.test(ui) && (ui.match(/runTrackSvg\(/g) || []).length >= 2);
ck("17. Toda a linha lida da BD passa por runNormalizeRows (via runUiNormalize) antes de chegar ao DOM", (ui.match(/runNormalizeRows\(/g) || []).length === 1 && (ui.match(/runUiNormalize\(/g) || []).length >= 3);

// ---- o que se pede ao servidor ----
ck("18. Nunca .single(), .upsert(), .in(), .limit() nem select(\"*\") (o simulado e a RLS só contam com isto): corridas por colunas leves + range", !/\.single\(|\.upsert\(|\.in\(|\.limit\(|select\(\s*["']\*["']/.test(ui) && /RUN_UI_COLS = "id, student_id, started_at/.test(ui) && !/RUN_UI_COLS[^;]*points/.test(ui) && /\.range\(/.test(ui));
ck("19. O percurso só é lido ao abrir o detalhe (run_tracks, por run_id, maybeSingle) e nunca na lista", (ui.match(/from\("run_tracks"\)\.select/g) || []).length === 1 && /select\("points, trim_m"\)\.eq\("run_id", runId\)\.maybeSingle\(\)/.test(ui));
ck("20. Tudo o que escreve passa pelos mesmos sítios: runs/run_tracks/run_consents só em insert (submitRun, consentimento, percurso) e delete (apagar); students só o interruptor do profissional (runs_mode)", (ui.match(/\.update\(/g) || []).length === 1 && /\.update\(\{runs_mode: mode\}\)\.eq\("id", s\.id\)\.select\("id"\)/.test(ui) && (ui.match(/\.insert\(/g) || []).length === 3);
ck("21. Apagar só se houver ligação e com confirmação (window.confirm), e o texto fixo está lá: «Para apagar corridas é preciso ligação à internet.»", /function runUiDelete\(o\)\{\s*if \(!runUiOnline\(\)\)\{ showToast\(RUN_UI_MSG\.offDelete\); return; \}\s*if \(!runUiAsk\(o\.ask\)\) return;/.test(ui) && /window\.confirm/.test(ui) && /Para apagar corridas é preciso ligação à internet\./.test(ui));

// ---- contrato com o gravador e com a app ----
var defines = ["go", "screen", "wire", "proTab", "consentVersion", "ensureConsent", "submitRun", "saveFlow", "flush", "uiReset"];
ck("22. corrida.js define em RUN: " + defines.join(", ") + " (e RUN.v, o estado da vista)", defines.every(function(k){ return new RegExp("^RUN\\." + k + " = ", "m").test(ui); }) && /^RUN\.v = \{name: "home"\};/m.test(ui));
ck("23. NÃO define o que é do gravador (liveOpen, liveScreen, liveWire, liveDraftBanner, liveWireBanner, queueAdd, queuePending, gps) nem RUN.loaded", !/^\s*RUN\.(liveOpen|liveScreen|liveWire|liveDraftBanner|liveWireBanner|queueAdd|queuePending|queueFailed|gps|loaded)\s*=/m.test(code));
var unguarded = ["liveOpen", "liveScreen", "liveWire", "liveDraftBanner", "liveWireBanner", "liveBusy", "queueAdd", "queueClear", "queuePending", "queueFailed", "consentCacheGet", "consentCacheSet", "consentCacheClear", "reset"].filter(function(name){
  var re = new RegExp("RUN\\." + name + "\\(", "g"), m, bad = false;
  while ((m = re.exec(code))) if (code.slice(Math.max(0, m.index - 400), m.index).indexOf("typeof RUN." + name) < 0) bad = true;
  return bad;
});
ck("24. Só chama as funções do gravador atrás de «typeof RUN.x === \"function\»" + (unguarded.length ? " (sem guarda: " + unguarded.join(", ") + ")" : ""), unguarded.length === 0 && /typeof RUN\.liveOpen/.test(ui) && /typeof RUN\.queueAdd/.test(ui) && /typeof RUN\.queueClear/.test(ui) && /typeof RUN\.consentCacheGet/.test(ui) && /typeof RUN\.liveBusy/.test(ui));
ck("25. A linha de música não aparece (nenhum playlistRowHtml, data-music, Spotify, Apple Music ou YouTube Music)", !/playlistRow|data-music|spotify|apple music|youtube music/i.test(ui));
ck("26. Não usa nenhum nome privado do núcleo da Corrida (runI*) e só chama funções públicas dele", !/\brunI[A-Z]\w*\(/.test(code));
var publicCore = coreNames.filter(function(x){ return /^run[A-Z]/.test(x) && !/^runI[A-Z]/.test(x); });
var called = (code.match(/\brun[A-Z]\w*\(/g) || []).map(function(x){ return x.slice(0, -1); }).filter(function(x){ return !/^runUi/.test(x); });
var unknown = called.filter(function(x, i){ return called.indexOf(x) === i && publicCore.indexOf(x) < 0 && ["runPendingCount", "runWipeLocal"].indexOf(x) < 0; });
ck("27. Todas as funções run* que corrida.js chama existem no núcleo (ou são runPendingCount/runWipeLocal da app)" + (unknown.length ? " (desconhecidas: " + unknown.join(", ") + ")" : ""), unknown.length === 0);
ck("28. O ficheiro tem os textos fixos do desenho (Confirma antes de guardar, indisponível por agora, migração 0032, só o aluno pode, consentimento)", ["Confirma antes de guardar", "Corrida indisponível por agora. Volta a tentar mais tarde.", "Falta correr a migração 0032 no Supabase (docs/OPERACOES.md, secção 8u).", "Só o aluno pode importar ou registar corridas.", "Corridas: antes de começares", "Partilhar o percurso com o meu profissional", "Exportar GPX (percurso completo, só para ti)", "A localização é um dado sensível"].every(function(t){ return ui.indexOf(t) >= 0; }));
ck("29. Português de Portugal nos textos (nada de «salvar», «você», «arquivo», «tela», «celular», «usuário», «baixar») e tratamento por «tu»; «profissional», nunca «treinador»", !/\b(salvar|você|voce|arquivo|tela|celular|usuário|baixar|clique|treinador)\b/i.test(ui));
ck("30. O ficheiro não deixa a escolha de partilhar por omissão: a forma inicial é share:false e trim 200", /share: false, trim: 200/.test(ui) && !/share: true/.test(ui));

// ---- carregamento, service worker, CSS ----
var swShell = sw.slice(sw.indexOf("var SHELL = ["), sw.indexOf("];", sw.indexOf("var SHELL = [")));
ck("31. O service worker serve corrida.js com rede primeiro (como o resto da app) e não o põe no SHELL: a Corrida só se guarda quando alguém a usa", swShell.length > 20 && !/corrida/.test(swShell) && /\(gestao\|corrida\|corrida-core\|corrida-live\|app\)\\\.\(js\|css\)/.test(sw));
ck("32. app.js só pede os ficheiros da Corrida dentro de loadCorrida (a lista é fixa: corrida-core.js, corrida.js, corrida-live.js, por esta ordem)", /\["corrida-core\.js", "corrida\.js", "corrida-live\.js"\]\.map\(function\(f\)\{ return fetch\(f/.test(app) && !/fetch\(\s*["']corrida/.test(app));
// os blocos de CSS de corrida.js (cada um começa com «/* ---- Corrida (corrida.js)...» e acaba no cabeçalho seguinte; o gravador tem o seu)
var cssParts = css.split(/\/\* ---- /).slice(1).filter(function(b){ return /^Corrida \(corrida\.js\)/.test(b); });
var cssBlock = cssParts.join("\n"), cssBlockStart = cssParts.length ? 1 : -1;
var rules = cssBlock.split(/\}\s*\n/).map(function(r){ return r.replace(/^[^\n]*---- \*\/\s*/, "").replace(/\/\*[\s\S]*?\*\//g, "").trim(); }).filter(function(r){ return r && r.indexOf("{") > 0 && !/^@/.test(r); });
var ownRules = rules;
ck("33. O CSS de corrida.js está num bloco com cabeçalho e todos os seletores contêm uma classe .run- (nada de regras que mexam no resto da app)", cssBlockStart >= 0 && ownRules.length > 40 && ownRules.every(function(r){ return /\.run-/.test(r.slice(0, r.indexOf("{"))); }));
var defined = {}, dm, reDef = /--([a-z0-9-]+)\s*:/g, rootBlock = css.slice(css.indexOf(":root{"), css.indexOf("}", css.indexOf(":root{")));
while ((dm = reDef.exec(rootBlock))) defined[dm[1]] = true;
var usedVars = [], um, reUse = /var\(--([a-z0-9-]+)/g;
while ((um = reUse.exec(cssBlock))) usedVars.push(um[1]);
ck("34. O CSS só usa as cores e medidas já definidas em :root (nenhuma cor nova)" + (usedVars.filter(function(v){ return !defined[v]; }).length ? " (em falta: " + usedVars.filter(function(v){ return !defined[v]; }).join(", ") + ")" : ""), usedVars.length > 20 && usedVars.every(function(v){ return defined[v]; }));

// ---- revisão: aviso único, vista de dados, lista sem limite de idade, aparo com folga ----
function fnBody(src, name){
  var i = src.indexOf("function " + name + "("), depth = 0, j, started = false;
  if (i < 0) return "";
  for (j = src.indexOf("{", i); j < src.length; j++){
    if (src[j] === "{"){ depth++; started = true; } else if (src[j] === "}"){ depth--; if (started && depth === 0) break; }
  }
  return src.slice(i, j + 1);
}
var consentFn = fnBody(ui, "runUiConsentHtml"), privFn = fnBody(ui, "runUiPrivacyHtml");
ck("35. O aviso de privacidade é UM só (RUN_UI_NOTICE, versão 1): o ecrã de consentimento e «Privacidade e dados» mostram os mesmos parágrafos, não há texto repetido à mão nem frases falsas («não ativa o GPS», «tu e o teu profissional») e RUN.consentVersion() é 1", /runUiNoticeHtml\(/.test(consentFn) && /runUiNoticeHtml\(/.test(privFn) && !/não ativa o GPS|Quem vê: tu e o teu profissional/.test(ui) && /^RUN\.consentVersion = function\(\)\{ return 1; \};/m.test(ui) && /GPS do telemóvel só liga depois de carregares em «Gravar com GPS» e em «Preparar GPS»/.test(ui));
var offFn = fnBody(ui, "runUiOffHtml"), homeFn = fnBody(ui, "runUiHomeHtml");
ck("36. A vista de dados (Corrida desligada) não tem nenhum botão de criar (importar, à mão, gravar, guia); o início delega nela quando o modo é «off»; e RUN.screen só deixa o detalhe e o início nesse modo", offFn.length > 100 && !/runGoImport|runGoManual|runGoLive|runGuide|runUiGuideHtml|runFile/.test(offFn) && /runOffBack/.test(offFn) && /^\s*if \(corridaModeOf\(sv\) === "off"\) return runUiOffHtml\(sv\);/m.test(homeFn) && /if \(off && v\.name !== "detail"\) RUN\.v = v = \{name: "home"\};/.test(ui));
ck("37. O pedido da lista de corridas não tem limite de idade (sem .gte em started_at: só os totais das 8 semanas têm janela)", !/\.gte\(/.test(fnBody(ui, "runUiFetchRuns")) && (ui.match(/\.gte\(/g) || []).length === 1 && /RUN_UI_WEEKS/.test(ui));
var prepCalls = ui.match(/runPrepareTrack\(prep\.segments, \{[^}]*\}\)/g) || [];
ck("38. Todo o percurso partilhado passa por runPrepareTrack com o escalão escolhido e uma folga ao acaso (rnd: Math.random()); só a pré-visualização usa trimM 0", prepCalls.length === 2 && prepCalls.filter(function(c){ return /trimM: 0\}/.test(c); }).length === 1 && prepCalls.filter(function(c){ return /rnd: Math\.random\(\)/.test(c); }).length === 1);
ck("39. O recibo local do consentimento só se lê quando a leitura no servidor falha por rede (k === \"net\"), e é apagado quando o servidor diz que já não vale (rls/consent) ou o aluno retira o consentimento", /known = runUiConsentFor === s\.id \|\| runUiReceiptGet\(s\.id\) === v/.test(ui) && /if \(k === "net" && known\) return \{ok: true, accepted: true\};/.test(ui) && /kind === "rls"\)\{ runUiConsentLost\(sid\)/.test(ui) && /kind === "consent"\)\{ runUiConsentLost\(sid\)/.test(ui) && /runUiReceiptClear\(s\.id\);\s*runUiQueueClear\(s\.id\);\s*runUiData = runUiNewData/.test(ui) && (ui.match(/runUiReceiptGet\(/g) || []).length === 2);
ck("40. «Apagar todas» limpa a fila local do aluno só depois de o servidor confirmar (runUiQueueClear no after); retirar o consentimento também a limpa; apagar uma só corrida não a esvazia (apagaria corridas por enviar de outras)", /after: function\(\)\{\s*runUiQueueClear\(s\.id\);/.test(ui) && /runUiReceiptClear\(s\.id\);\s*runUiQueueClear\(s\.id\);/.test(ui) && (ui.match(/runUiQueueClear\(/g) || []).length === 3);

// ---- browser: os ficheiros só se pedem ao abrir a Corrida ----
var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){ console.log("(ignorado o ecrã: Playwright/Chromium não disponíveis aqui)"); check.summarize(); }
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");
var appSource = require("./extract-app")();
eval(appSource);
function row(id, name, mode){
  authRole = "professional";
  var s = buildFullDemoStudent(); s.id = id; s.name = name; s.isDemo = false; s.active = true; s.photos = [];
  s.nutritionPhase = null;
  var r = JSON.parse(JSON.stringify(studentToRow(s)));
  if (mode !== undefined) r.runs_mode = mode;
  return r;
}
(async function(){
  var srv = await startStaticServer(root);
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  async function open(role, rows, page){
    var log = [];
    var ctx = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: "block"});
    await ctx.addInitScript(fakeSource({role: role, userId: role === "professional" ? "pro-1" : "user-1", email: "ana@x.test", rows: rows, runsRls: true}));
    await ctx.route(/\/corrida-live\.js(\?|$)/, function(route){ route.fulfill({status: 200, contentType: "text/javascript", body: "RUN.loaded = true;"}); });
    var pg = await ctx.newPage(); pg.setDefaultTimeout(6000);
    pg.on("pageerror", function(e){ errors.push(e.message); });
    pg.on("dialog", function(d){ d.accept(); });
    pg.on("request", function(r){ if (/\/corrida(-core|-live)?\.js/.test(r.url())) log.push(r.url().replace(/^.*\//, "").replace(/\?.*$/, "")); });
    await pg.goto(srv.url + (page || ""));
    return {ctx: ctx, pg: pg, log: log};
  }
  var S = await open("student", [row("ana", "Ana Treina", "import")], "index.html");
  await S.pg.waitForSelector(".check-circle[data-circle]"); await S.pg.waitForTimeout(500);
  ck("41. Na app EVOLVE (index.html) o aluno nunca pede os ficheiros da Corrida", S.log.length === 0);
  await S.ctx.close();
  var T = await open("student", [row("ana", "Ana Treina", "import")], "treino.html");
  await T.pg.waitForSelector("#startWorkout"); await T.pg.waitForTimeout(500);
  ck("42. Na app EVOLVE Treino o aluno também não os pede enquanto não abre o separador «Corrida»", T.log.length === 0);
  await T.pg.click('.tabbar [data-tab="corrida"]');
  await T.pg.waitForSelector("#runGoImport");
  ck("43. Ao abrir «Corrida» pede o núcleo, os ecrãs e o gravador, uma vez cada, por esta ordem de avaliação, e mostra o ecrã", T.log.slice().sort().join() === "corrida-core.js,corrida-live.js,corrida.js" && T.log.length === 3);
  await T.pg.click('.tabbar [data-tab="hoje"]'); await T.pg.waitForSelector("#startWorkout");
  await T.pg.click('.tabbar [data-tab="corrida"]'); await T.pg.waitForSelector("#runGoImport");
  ck("44. Voltar ao separador não volta a pedi-los", T.log.length === 3);
  await T.ctx.close();
  var O = await open("student", [row("ana", "Ana Treina", "off")], "treino.html");
  await O.pg.waitForSelector("#startWorkout");
  await O.pg.click('.tabbar [data-tab="corrida"]'); await O.pg.waitForSelector("#corridaOff"); await O.pg.waitForTimeout(300);
  ck("45. Com a Corrida desligada pelo profissional o separador é só um cartão e nada é pedido", O.log.length === 0);
  await O.ctx.close();
  var P = await open("professional", [row("a", "Ana Silva", "import")], "index.html");
  await P.pg.waitForSelector(".student-row"); await P.pg.waitForTimeout(300);
  await P.pg.locator('[data-open="a"]').first().click(); await P.pg.waitForSelector("#proBack");
  await P.pg.click('.pro-nav-item[data-g="treino"]'); await P.pg.waitForTimeout(200);
  ck("46. O profissional só pede os ficheiros ao abrir o chip «Corridas» da ficha (não ao abrir a ficha nem o grupo «Treino»)", P.log.length === 0);
  await P.pg.click('[data-sub="corridas"]'); await P.pg.waitForSelector(".run-modes");
  ck("47. Abrir «Corridas» pede-os uma vez cada e mostra o separador do profissional", P.log.length === 3);
  await P.ctx.close();
  ck("48. Nenhum erro de JavaScript", errors.length === 0 || (console.log(errors), false));
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", String(e && e.stack || e).split("\n").slice(0, 4).join(" | ")); process.exit(1); });
