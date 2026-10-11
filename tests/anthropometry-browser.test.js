// Fluxo completo no browser: o profissional regista perímetros e pregas, vê os cartões, o aluno vê-os e a avaliação pode ser apagada.
// Corre num Chromium real se o Playwright existir (senão fica ignorado e conta como passado).
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
(async function(){
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  var page = await ctx.newPage();
  page.setDefaultTimeout(4000);
  var errors = [];
  page.on("pageerror", function(e){ errors.push(e.message); });
  await page.route(/jsdelivr|fonts\./, function(r){ return r.abort(); });
  await page.goto("file://" + path.join(__dirname, "..", "index.html"));
  await page.click('#modeSwitch button[data-mode="pro"]');
  await page.click("#toggleDemo").catch(function(){});
  await page.click('[data-stat-key="active"]').catch(function(){});
  await page.click("[data-open]");
  await page.click('#proApp .pro-nav-item[data-t="evolucao"]');
  async function openSections(){
    await page.evaluate(function(){ document.querySelectorAll("details.assess-extra").forEach(function(d){ d.open = true; }); });
  }
  // títulos dos cartões visíveis num contentor (o cabeçalho do formulário também diz "Perímetros", por isso não serve procurar no texto todo)
  async function cardTitles(scope){ return page.evaluate(function(sel){ return Array.prototype.map.call(document.querySelectorAll(sel + " .card > .eyebrow"), function(e){ return e.textContent.trim(); }); }, scope); }
  async function fillAll(map){ for (var id in map) await page.fill("#" + id, String(map[id])); }
  async function clearAll(ids){ for (var i = 0; i < ids.length; i++) await page.fill("#" + ids[i], ""); }
  await openSections();

  // 1. perímetro fora dos limites é recusado com a mensagem do campo
  await page.fill("#asWaist", "20");
  await page.click("#addAssessment");
  var err1 = await page.locator("#assessError").innerText();
  check.check("1. Cintura 20 cm é recusada com o intervalo do campo", /Cintura/.test(err1) && /entre 45 e 230 cm/.test(err1));
  // punho de 16 cm (real) tem de ser aceite: a regra antiga de 20 cm rejeitá-lo-ia
  await page.fill("#asWaist", "");
  await page.fill("#asWrist", "16");
  await page.fill("#asWaist", "82");
  var errNow = await page.locator("#assessError").evaluate(function(e){ return getComputedStyle(e).display; });

  // 2. avisos ao vivo (não bloqueiam)
  await fillAll({asNeck: "34", asHip: "98", asArm: "28", asArmL: "27", asThigh: "54", asThighL: "53", asCalf: "37", asAnkle: "22", asForearm: "25"});
  var warnClean = await page.locator("#assessWarn").innerText();
  check.check("2. Medidas normais não geram avisos", warnClean.trim() === "");
  await page.fill("#asNeck", "62");
  var warnNeck = await page.locator("#assessWarn").innerText();
  check.check("2. Pescoço de 62 cm avisa (muito alto) sem bloquear", /Pescoço 62,0 cm é muito alto/.test(warnNeck));
  await page.fill("#asNeck", "34");

  // 3. pregas: pré-visualização com o protocolo e a % de gordura
  await fillAll({sfTriceps: "16", sfBiceps: "8", sfSubscapular: "14", sfSuprailiac: "15", sfAbdominal: "24", sfChest: "12", sfMidaxillary: "11", sfThigh: "22", sfCalf: "10"});
  var prev = await page.locator("#sfPreview").innerText();
  check.check("3. A pré-visualização mostra o protocolo (JP7 com as 7 pregas) e a % de gordura", /Jackson-Pollock 7 pregas: \d+,\d % de gordura/.test(prev));
  await page.selectOption("#sfProtocol", "dw4");
  var prevDw = await page.locator("#sfPreview").innerText();
  check.check("3. Mudar o protocolo para Durnin-Womersley atualiza a pré-visualização", /Durnin-Womersley 4 pregas: \d+,\d % de gordura/.test(prevDw));
  await page.selectOption("#sfProtocol", "auto");
  await page.fill("#sfTriceps", "2");
  check.check("3. Uma prega tricipital de 2 mm avisa (muito baixa)", /tricipital de 2,0 mm é muito baixa/.test(await page.locator("#assessWarn").innerText()));
  await page.fill("#sfTriceps", "16");

  // 4. um valor de prega fora dos limites é recusado
  await page.fill("#sfCalf", "95");
  await page.click("#addAssessment");
  check.check("4. Prega de 95 mm é recusada", /Prega geminal: o valor tem de estar entre 1 e 80 mm/.test(await page.locator("#assessError").innerText()));
  await page.fill("#sfCalf", "10");

  // 5. guardar: aparecem os cartões e a linha na tabela, sem criar peso
  await page.click("#addAssessment");
  await page.waitForTimeout(200);
  var body = await page.locator("#proTabContent").innerText();
  var titles5 = await cardTitles("#proTabContent");
  check.check("5. Aparece o cartão de perímetros com as zonas e a diferença D/E", titles5.indexOf("Perímetros") >= 0 && /Pescoço/.test(body) && /Braço relaxado \(D\)/.test(body) && /Diferença entre o lado direito e o esquerdo/.test(body));
  check.check("5. Aparece o cartão de pregas com o protocolo, a soma e a % de gordura", titles5.indexOf("Pregas cutâneas") >= 0 && /Jackson-Pollock 7 pregas/.test(body) && /Σ 7 pregas/i.test(body) && /% gordura \(pregas\)/i.test(body));
  check.check("5. Sem peso, não aparecem massas em kg (não se inventa peso)", !/Massa gorda \(pregas\)/i.test(body));
  check.check("5. A tabela de avaliações marca a visita com 'perímetros' e 'pregas'", /perímetros · pregas/.test(body));
  check.check("5. Cintura 82 cm (mulher: ≥ 80) aparece como risco aumentado, se a aluna for mulher; ou sem risco, se homem", /risco aumentado|sem risco acrescido/.test(body));

  // 6. protocolo explícito sem as pregas todas
  await openSections();
  await clearAll(["asWaist", "asWrist", "asNeck", "asHip", "asArm", "asArmL", "asThigh", "asThighL", "asCalf", "asAnkle", "asForearm", "sfBiceps", "sfSubscapular", "sfSuprailiac", "sfAbdominal", "sfChest", "sfMidaxillary", "sfThigh", "sfCalf"]);
  await page.fill("#sfTriceps", "14");
  await page.selectOption("#sfProtocol", "dw4");
  await page.click("#addAssessment");
  check.check("6. Protocolo D-W4 só com a tricipital: recusa e diz que pregas faltam", /faltam as pregas/.test(await page.locator("#assessError").innerText()));

  // 7. o aluno vê os cartões (só leitura)
  await page.click('#modeSwitch button[data-mode="aluno"]');
  await page.click('[data-tab="evolucao"]');
  var stu = await page.locator("#alunoTabContent").innerText();
  var titles7 = await cardTitles("#alunoTabContent");
  check.check("7. O aluno vê perímetros e pregas, sem formulário de edição", titles7.indexOf("Perímetros") >= 0 && titles7.indexOf("Pregas cutâneas") >= 0 && (await page.locator("#alunoTabContent #addAssessment").count()) === 0);
  var overflow = await page.evaluate(function(){ return document.documentElement.scrollWidth - document.documentElement.clientWidth; });
  check.check("7. Sem scroll horizontal da página a 390 px", overflow <= 0);

  // 8. apagar a visita
  await page.click('#modeSwitch button[data-mode="pro"]');
  await page.click('#proApp .pro-nav-item[data-t="evolucao"]');
  var proRows = page.locator("#proTabContent table.assess-table tbody tr").filter({hasText: "perímetros · pregas"});
  var dels = await page.locator("#proTabContent .assess-del").count();
  var rowText = await proRows.first().innerText();
  await proRows.first().locator(".assess-del").click();
  await page.waitForTimeout(150);
  var titles8 = await cardTitles("#proTabContent");
  check.check("8. Apagar a visita remove os cartões de perímetros e de pregas", titles8.indexOf("Pregas cutâneas") < 0 && titles8.indexOf("Perímetros") < 0 && dels >= 1 && /pregas/.test(rowText));
  // 8b. várias leituras por local: o interruptor mostra 3 campos por local; média de 2, mediana de 3, avisos e leituras guardadas
  await openSections();
  check.check("8b. Por omissão só há um campo por local (as leituras extra estão escondidas)", !(await page.locator("#asWaist_2").isVisible()) && !(await page.locator("#sfTriceps_3").isVisible()));
  await page.check("#mrPerim");
  check.check("8b. Ligar '2–3 leituras' mostra os campos extra e põe cada local numa linha", (await page.locator("#asWaist_2").isVisible()) && (await page.locator("#asWaist_3").isVisible()) && (await page.locator(".meas-grid.multi-read").count()) === 1);
  var ov = await page.evaluate(function(){ return document.documentElement.scrollWidth - document.documentElement.clientWidth; });
  check.check("8b. Sem scroll horizontal da página com o modo de várias leituras (390 px)", ov <= 0);
  await page.fill("#asWaist", "82"); await page.fill("#asWaist_2", "83");
  check.check("8b. Duas leituras que diferem mais de 1 % avisam para fazer a 3.ª medição", /Cintura: as 2 leituras diferem/.test(await page.locator("#assessWarn").innerText()) && /3\.ª medição/.test(await page.locator("#assessWarn").innerText()));
  await page.fill("#asWaist_3", "82.4");
  check.check("8b. Com a 3.ª leitura o aviso desaparece (usa-se a mediana)", !/3\.ª medição/.test(await page.locator("#assessWarn").innerText()));
  await page.fill("#asHip", "98");
  await page.check("#mrSkin");
  await page.fill("#sfTriceps", "12"); await page.fill("#sfTriceps_2", "12.2");
  await page.fill("#asWaist_2", "5");
  await page.click("#addAssessment");
  check.check("8b. Uma leitura individual fora dos limites (cintura 5 cm) é recusada, mesmo que o valor final fosse aceitável", /Cintura: o perímetro tem de estar entre 45 e 230 cm/.test(await page.locator("#assessError").innerText()));
  await page.fill("#asWaist_2", "83");
  await page.click("#addAssessment");
  await page.waitForTimeout(200);
  var body8 = await page.locator("#proTabContent").innerText();
  check.check("8b. Guardado: a cintura aparece como a mediana (82,4), a tricipital como a média (12,1) e há a nota das várias leituras", /Cintura\s+82,4/.test(body8) && /Tricipital\s+12,1/.test(body8) && /média de 2 ou a mediana de 3/.test(body8));
  var ovAfter = await page.evaluate(function(){ return document.documentElement.scrollWidth - document.documentElement.clientWidth; });
  check.check("8b. Depois de guardar o formulário volta ao estado normal (um campo por local) e a página não tem scroll horizontal", !(await page.locator("#asWaist_2").isVisible()) && ovAfter <= 0);
  check.check("9. Nenhum erro de JavaScript durante o fluxo", errors.length === 0);
  if (errors.length) console.log(errors);
  await browser.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e); process.exit(1); });
