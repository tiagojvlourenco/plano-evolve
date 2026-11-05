// Acessibilidade da app EVOLVE Treino (aluno): zonas e título, separador ativo, janelas (foco, Esc, devolver o foco), avisos lidos por
// leitores de ecrã, áreas de toque, contraste do texto vermelho, foco visível e menos movimento.
// O que não se vê aqui: o que um leitor de ecrã real (VoiceOver/TalkBack) diz, e o toque num telemóvel real.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var fs = require("fs"), path = require("path");
var root = path.join(__dirname, "..");
function read(f){ return fs.readFileSync(path.join(root, f), "utf8"); }

// ---- ficheiros ----
var pages = ["index.html", "treino.html", "gestao.html"].map(read);
check.check("1. As três páginas têm zona principal (role=main), região viva (#liveRegion) e estados anunciados (carregar = status, erros = alert)", pages.every(function(h){ return /id="alunoApp" class="hidden" role="main"/.test(h) && /id="proApp" class="hidden" role="main"/.test(h) && /id="liveRegion" class="sr-only" role="status" aria-live="polite"/.test(h) && /id="appLoadingText" role="status"/.test(h) && /id="authError" role="alert"/.test(h) && /id="connectionErrorScreen" role="alert"/.test(h); }));
var bodyOf = function(h){ return h.slice(h.indexOf("<body>")); };
check.check("2. O corpo continua igual nas três páginas (só muda o cabeçalho)", bodyOf(pages[0]) === bodyOf(pages[1]) && bodyOf(pages[1]) === bodyOf(pages[2]));
var css = read("app.css");
check.check("3. O CSS tem foco visível global, texto vermelho com contraste (--critical-text) e regra para quem pede menos movimento", /:focus-visible\{outline:2px solid/.test(css) && /--critical-text:#FF7B72/.test(css) && /@media \(prefers-reduced-motion:reduce\)\{\s*\*, \*::before/.test(css));

// contraste (WCAG) calculado aqui para o vermelho de texto sobre o fundo dos cartões
function lum(hex){ var n = parseInt(hex.slice(1), 16), f = function(v){ v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(n >> 16 & 255) + 0.7152 * f(n >> 8 & 255) + 0.0722 * f(n & 255); }
function ratio(a, b){ var l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
check.check("4. O vermelho de texto (#FF7B72) tem pelo menos 4,5:1 sobre o cartão, o fundo e as superfícies mais claras (até #2A2F3A); o antigo (#E5534B) ficava a 4,1:1 sobre #21252E", ratio("#FF7B72", "#1A1D24") >= 4.5 && ratio("#FF7B72", "#0D0F12") >= 4.5 && ratio("#E5534B", "#21252E") < 4.5 && ratio("#FF7B72", "#2A2F3A") >= 4.5);

var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){ console.log("(ignorado o ecrã: Playwright/Chromium não disponíveis aqui)"); check.summarize(); }
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");
(async function(){
  authRole = "professional";
  var st = buildFullDemoStudent(); st.id = "ana"; st.name = "Ana Treina"; st.isDemo = false; st.active = true; st.photos = []; st.nutritionPhase = null;
  var row = JSON.parse(JSON.stringify(studentToRow(st))); row.runs_mode = "live";
  var srv = await startStaticServer(root);
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  async function open(opts){
    var ctx = await browser.newContext(Object.assign({viewport: {width: 390, height: 844}}, opts || {}));
    await ctx.addInitScript(fakeSource({role: "student", userId: "user-ana", email: "ana@x.test", rows: [row]}));
    await ctx.addInitScript(function(){ window.__fake.tables.run_consents.push({student_id: "ana", version: 2}); });
    var pg = await ctx.newPage(); pg.setDefaultTimeout(6000); pg.on("pageerror", function(e){ errors.push(e.message); });
    await pg.goto(srv.url + "treino.html");
    await pg.waitForSelector(".tabbar button");
    return {ctx: ctx, pg: pg};
  }
  var A = await open(), pg = A.pg;

  // ---- estrutura ----
  var st1 = await pg.evaluate(function(){ var nav = document.querySelector(".tabbar"), h1 = document.querySelector("h1"); var act = nav.querySelector("[aria-current=page]"); return {role: nav.getAttribute("role"), label: nav.getAttribute("aria-label"), cur: act ? act.getAttribute("data-tab") : null, h1: h1 ? h1.innerText : null, mainVisible: Array.prototype.filter.call(document.querySelectorAll("[role=main]"), function(m){ return m.getClientRects().length > 0; }).length}; });
  check.check("5. Uma só zona principal visível, título principal «Olá, Ana», barra de baixo é navegação com nome e indica o separador ativo (aria-current)", st1.mainVisible === 1 && /Olá, Ana/.test(st1.h1) && st1.role === "navigation" && /Navegação/.test(st1.label) && st1.cur === "hoje");
  await pg.click('.tabbar [data-tab="corrida"]'); await pg.waitForSelector(".run-head, #runGoManual, #runGoImport");
  var cur2 = await pg.evaluate(function(){ var a = document.querySelectorAll(".tabbar [aria-current=page]"); return a.length === 1 ? a[0].getAttribute("data-tab") : "n=" + a.length; });
  check.check("6. Ao mudar de separador o aria-current muda com ele (só um ativo)", cur2 === "corrida");
  await pg.click('.tabbar [data-tab="hoje"]'); await pg.waitForSelector("[data-start-day]");

  // ---- janelas (no registo do treino, onde o nome do exercício está à vista) ----
  await pg.locator("[data-start-day]").first().click(); await pg.waitForSelector(".wl-set");
  var opener = pg.locator("[data-ex-info]").first();
  await opener.focus();
  await pg.keyboard.press("Enter");
  await pg.waitForSelector("#modalRoot .modal-sheet");
  await pg.waitForTimeout(150);
  var dlg = await pg.evaluate(function(){ var s = document.querySelector("#modalRoot .modal-sheet"); return {role: s.getAttribute("role"), modal: s.getAttribute("aria-modal"), named: !!(s.getAttribute("aria-label") || (s.getAttribute("aria-labelledby") && document.getElementById(s.getAttribute("aria-labelledby")))), inside: s.contains(document.activeElement)}; });
  check.check("7. A janela é um diálogo modal com nome e o foco entra nela (aberta pelo teclado)", dlg.role === "dialog" && dlg.modal === "true" && dlg.named && dlg.inside);
  var trapped = true;
  for (var i = 0; i < 14; i++){ await pg.keyboard.press("Tab"); if (!(await pg.evaluate(function(){ return document.querySelector("#modalRoot .modal-sheet").contains(document.activeElement); }))) trapped = false; }
  check.check("8. Com Tab (14 vezes) o foco não sai da janela; com Shift+Tab também não", trapped && await (async function(){ for (var j = 0; j < 14; j++){ await pg.keyboard.press("Shift+Tab"); if (!(await pg.evaluate(function(){ return document.querySelector("#modalRoot .modal-sheet").contains(document.activeElement); }))) return false; } return true; })());
  await pg.keyboard.press("Escape");
  await pg.waitForTimeout(100);
  var back = await pg.evaluate(function(){ return {open: !!document.querySelector("#modalRoot .modal-sheet"), onOpener: document.activeElement && document.activeElement.hasAttribute("data-ex-info")}; });
  check.check("9. Esc fecha a janela e o foco volta ao botão de onde ela foi aberta", !back.open && back.onOpener === true);
  await pg.click("#backToHoje"); await pg.waitForSelector("[data-start-day]");

  // ---- áreas de toque ----
  var small = async function(){ return pg.evaluate(function(){ var out = []; document.querySelectorAll("button, a[href], summary, select, input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]), textarea").forEach(function(el){ var r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || el.closest("[hidden]")) return; var exempt = el.hasAttribute("data-step-key") || (el.tagName === "A" && el.closest("p")); if (exempt) return; if (r.height < 43.5 || (r.width < 43.5 && !el.matches(".wl-chip"))) out.push(el.tagName + ":" + ((el.getAttribute("aria-label") || el.innerText || el.id || "").trim().slice(0, 24)) + " " + Math.round(r.width) + "x" + Math.round(r.height)); }); return out; }); };
  var smallHoje = await small();
  check.check("11. Hoje: todos os botões, cabeçalhos e ligações têm pelo menos 44 px de altura (" + (smallHoje.join(" | ") || "nenhum pequeno") + ")", smallHoje.length === 0);
  await pg.locator("[data-start-day]").first().click(); await pg.waitForSelector(".wl-set");
  var smallLog = await small();
  check.check("12. Registo do treino: o mesmo (os − / + das cargas têm 34 × 44 px, acima dos 24 px do WCAG 2.2) (" + (smallLog.join(" | ") || "nenhum pequeno") + ")", smallLog.length === 0);
  var sizes = await pg.evaluate(function(){ var s = document.querySelector("[data-step-key]").getBoundingClientRect(); var c = document.querySelector(".wl-chip").getBoundingClientRect(); return {sw: s.width, sh: s.height, ch: c.height}; });
  check.check("13. Os botões − / + têm pelo menos 34 × 44 px e as pastilhas do RIR 44 px de altura", sizes.sw >= 33.5 && sizes.sh >= 43.5 && sizes.ch >= 43.5);
  await pg.click("#backToHoje"); await pg.waitForSelector("[data-start-day]");
  await pg.click('.tabbar [data-tab="corrida"]'); await pg.waitForSelector("#runSessions, .run-head"); await pg.waitForTimeout(500);
  await pg.evaluate(function(){ document.querySelectorAll("#alunoApp details").forEach(function(d){ d.open = true; }); });
  var smallCardio = await small();
  check.check("14. Cardio (com tudo aberto): sem botões, secções, seletores ou campos abaixo de 44 px (" + (smallCardio.join(" | ") || "nenhum pequeno") + ")", smallCardio.length === 0);
  var danger = await pg.evaluate(function(){ var b = document.getElementById("runWithdraw"); return b ? getComputedStyle(b).color : null; });
  check.check("15. «Retirar consentimento» usa o vermelho de texto claro (rgb(255, 123, 114))", danger === "rgb(255, 123, 114)");

  // ---- foco visível por teclado ----
  await pg.click('.tabbar [data-tab="hoje"]'); await pg.waitForSelector("[data-start-day]");
  await pg.locator("[data-start-day]").first().focus();
  await pg.keyboard.press("Tab"); await pg.keyboard.press("Shift+Tab");
  var ring = await pg.evaluate(function(){ var e = document.activeElement, cs = getComputedStyle(e); return {tag: e.tagName, style: cs.outlineStyle, width: parseFloat(cs.outlineWidth)}; });
  check.check("16. Ao navegar com o teclado o elemento com foco tem contorno visível (" + ring.tag + ", " + ring.style + " " + ring.width + " px)", ring.style !== "none" && ring.width >= 2);
  await A.ctx.close();

  // ---- avisos (terminar um treino mostra «Treino guardado…») ----
  var T = await open(), tp = T.pg;
  await tp.locator("[data-start-day]").first().click(); await tp.waitForSelector(".wl-set");
  await tp.evaluate(function(){ document.querySelectorAll("[data-wl-done]").forEach(function(b){ b.click(); }); });
  await tp.click("#wlSave"); await tp.waitForSelector(".toast"); await tp.waitForTimeout(300);
  var toast = await tp.evaluate(function(){ var t = document.querySelector(".toast"); return {live: document.getElementById("liveRegion").textContent, hidden: t && t.getAttribute("aria-hidden")}; });
  check.check("10. Ao terminar o treino o aviso «Treino guardado…» é lido na região viva e a bolha visual não repete a leitura (aria-hidden)", /Treino guardado/.test(toast.live) && toast.hidden === "true");
  await T.ctx.close();

  // ---- menos movimento ----
  var R = await open({reducedMotion: "reduce"});
  var dur = await R.pg.evaluate(function(){ var b = document.querySelector(".tabbar button"), cs = getComputedStyle(b); return parseFloat(cs.transitionDuration) + "|" + parseFloat(cs.animationDuration || "0"); });
  var parts = dur.split("|").map(Number);
  check.check("17. Com «reduzir movimento» ligado no telemóvel as transições e animações ficam praticamente instantâneas (≤ 1 ms)", parts[0] <= 0.001 && parts[1] <= 0.001);
  await R.ctx.close();

  check.check("18. Sem erros de JavaScript", errors.length === 0);
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção " + (e && e.stack)); process.exit(1); });
