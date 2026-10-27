// Ecrã de registo do treino (redesenho): uma série por bloco compacto, RIR em toque rápido (0 / +1 / +2 / 3+), legenda do RIR,
// música recolhida e modo do RIR escolhido pelo profissional (trainingProgram.rirMode: last | all | off).
// O que não se vê aqui: o aspeto e o toque num telemóvel real (teclado numérico, tamanho dos dedos) — só em iPhone/Android.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var fs = require("fs"), path = require("path");

// ---- Node: modo do RIR ----
var base = {trainingProgram: {name: "p", days: []}};
check.check("1. Por omissão o RIR pede-se só na última série; o profissional pode pôr «all» ou «off»; valores inválidos voltam à omissão",
  rirModeOf(base) === "last" && rirModeOf({trainingProgram: {days: [], rirMode: "all"}}) === "all" && rirModeOf({trainingProgram: {days: [], rirMode: "off"}}) === "off" && rirModeOf({trainingProgram: {days: [], rirMode: "xx"}}) === "last" && rirModeOf({}) === "last");
check.check("2. O profissional tem o seletor do RIR no programa de treino", /id="rirMode"/.test(tplProTreino(Object.assign(buildFullDemoStudent(), {id: "n", name: "N"}))));

// ---- Chromium ----
var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){ console.log("(ignorado o ecrã: Playwright/Chromium não disponíveis aqui)"); check.summarize(); }
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");

function rowWith(mode){
  authRole = "professional";
  var s = buildFullDemoStudent(); s.id = "ana"; s.name = "Ana Treina"; s.isDemo = false; s.active = true; s.photos = []; s.nutritionPhase = null;
  if (mode) s.trainingProgram.rirMode = mode;
  return JSON.parse(JSON.stringify(studentToRow(s)));
}

(async function(){
  var srv = await startStaticServer(path.join(__dirname, ".."));
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  async function open(mode, width){
    var ctx = await browser.newContext({viewport: {width: width || 390, height: 844}});
    await ctx.addInitScript(fakeSource({role: "student", userId: "user-ana", email: "ana@x.test", rows: [rowWith(mode)]}));
    var pg = await ctx.newPage(); pg.setDefaultTimeout(6000); pg.on("pageerror", function(e){ errors.push(e.message); });
    await pg.goto(srv.url + "treino.html");
    await pg.waitForSelector("#startWorkout, [data-start-day]");
    await pg.locator("#startWorkout, [data-start-day]").first().click();
    await pg.waitForSelector(".wl-set");
    return {ctx: ctx, pg: pg};
  }

  var A = await open(null);
  var nSets = await A.pg.locator(".wl-set").count(), nEx = await A.pg.locator(".wl-ex").count();
  var nChipGroups = await A.pg.locator(".wl-rir").count();
  check.check("3. Por omissão há uma linha de RIR por exercício (na última série): " + nEx + " exercícios, " + nSets + " séries, " + nChipGroups + " grupos de RIR", nEx >= 2 && nChipGroups === nEx && nSets > nEx);
  var lastHasChips = await A.pg.evaluate(function(){
    return Array.prototype.every.call(document.querySelectorAll(".wl-ex"), function(ex){ var sets = ex.querySelectorAll(".wl-set"); return sets[sets.length - 1].querySelector(".wl-rir") && !sets[0].querySelector(".wl-rir") || sets.length === 1; });
  });
  check.check("4. As pastilhas estão na última série de cada exercício e não nas primeiras", lastHasChips);
  var hiddenRir = await A.pg.locator('input[type=hidden][data-wl-rir]').count();
  check.check("5. Cada série continua a ter o campo escondido do RIR (o envio e as sugestões leem-no)", hiddenRir === nSets);

  // legenda
  var helpClosed = await A.pg.locator("#wlHelp").evaluate(function(d){ return !d.open; });
  check.check("6. A legenda «Como registar» está recolhida por omissão", helpClosed);
  await A.pg.locator("[data-rir-help]").first().click();
  var helpTxt = await A.pg.locator("#wlHelp").evaluate(function(d){ return {open: d.open, text: d.innerText}; });
  check.check("7. O «?» do RIR abre a legenda: o que é o RIR (repetições em reserva), falha, +1, +2, 3+", helpTxt.open && /repetições em reserva/i.test(helpTxt.text) && /Falha \(0\)/.test(helpTxt.text) && /\+1/.test(helpTxt.text) && /\+2/.test(helpTxt.text) && /3\+/.test(helpTxt.text));

  // toque no RIR
  var chip = A.pg.locator('[data-rir-pick][data-rir-val="2"]').first();
  var key = await chip.getAttribute("data-rir-pick");
  await chip.click();
  var v1 = await A.pg.locator('input[data-wl-rir="' + key + '"]').inputValue();
  var pressed = await chip.getAttribute("aria-pressed");
  check.check("8. Tocar em «+2» põe 2 no campo do RIR e a pastilha fica ativa", v1 === "2" && pressed === "true");
  await A.pg.locator('[data-rir-pick="' + key + '"][data-rir-val="3"]').click();
  var v3 = await A.pg.locator('input[data-wl-rir="' + key + '"]').inputValue();
  check.check("9. «3+» guarda 3 e desativa a anterior", v3 === "3" && (await chip.getAttribute("aria-pressed")) === "false");
  await A.pg.locator('[data-rir-pick="' + key + '"][data-rir-val="3"]').click();
  check.check("10. Tocar outra vez na mesma pastilha limpa o RIR", (await A.pg.locator('input[data-wl-rir="' + key + '"]').inputValue()) === "");
  await chip.click();
  var draft = await A.pg.evaluate(function(){ var o = []; for (var i = 0; i < localStorage.length; i++){ var k = localStorage.key(i); if (/draft|workout/i.test(k)) o.push(localStorage.getItem(k)); } return o.join("|"); });
  check.check("11. O RIR escolhido fica no rascunho do treino (sobrevive a mudar de separador)", /"rir":"2"/.test(draft));

  // tamanho e compacidade
  var m = await A.pg.evaluate(function(){
    var h = document.documentElement.scrollHeight, sets = document.querySelectorAll(".wl-set");
    var inp = document.querySelector("[data-wl-load]").getBoundingClientRect().height, chipH = document.querySelector(".wl-chip").getBoundingClientRect().height;
    var firstSet = sets[0].getBoundingClientRect().height;
    return {h: h, inp: inp, chipH: chipH, firstSet: firstSet, over: document.documentElement.scrollWidth > window.innerWidth, n: sets.length};
  });
  check.check("12. Os campos e as pastilhas são fáceis de tocar (≥ 40 px) e a página não tem scroll horizontal", m.inp >= 40 && m.chipH >= 40 && !m.over);
  check.check("13. Uma série sem RIR ocupa menos de 100 px (antes eram cerca de 190) e 9 séries cabem em menos de 2300 px de página (antes 2850)", m.firstSet < 100 && m.h < 2300);
  await A.ctx.close();

  // largura de 320 px (iPhone SE antigo)
  var S = await open(null, 320);
  var over320 = await S.pg.evaluate(function(){ var r = document.querySelector(".wl-set").getBoundingClientRect(); return {over: document.documentElement.scrollWidth > window.innerWidth, w: r.width, kgW: document.querySelector("[data-wl-load]").getBoundingClientRect().width}; });
  check.check("14. Em 320 px nada transborda e o campo dos kg continua legível (≥ 60 px de largura)", !over320.over && over320.kgW >= 60);
  await S.ctx.close();

  // modos do profissional
  var All = await open("all");
  check.check("15. Modo «all»: pastilhas em todas as séries", (await All.pg.locator(".wl-rir").count()) === (await All.pg.locator(".wl-set").count()));
  await All.ctx.close();
  var Off = await open("off");
  check.check("16. Modo «off»: sem pastilhas e a legenda não fala de RIR", (await Off.pg.locator(".wl-rir").count()) === 0 && !/RIR/.test(await Off.pg.locator("#wlHelp").evaluate(function(d){ return d.textContent; })));
  await Off.ctx.close();

  // música
  var Mu = await open(null);
  check.check("17. A música fica recolhida por omissão", await Mu.pg.locator(".wl-music").evaluate(function(d){ return !d.open; }));
  await Mu.ctx.close();

  check.check("18. Sem erros de JavaScript no ecrã", errors.length === 0);
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção " + (e && e.message)); process.exit(1); });
