// Enviar evolução ao aluno no Chromium (Supabase simulado): «Abrir no WhatsApp com ligação à imagem» gera o JPEG leve, guarda-o no balde privado,
// cria a ligação com validade de 7 dias e abre a conversa do aluno (wa.me) com a mensagem + a ligação; se falhar, avisa e não abre nada;
// «Só a mensagem» continua sem imagem e sem telefone não há botão de WhatsApp. (O WhatsApp em si não corre aqui: o pedido a wa.me é interceptado.)
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

function row(id, name, phone){
  authRole = "professional";
  var s = buildFullDemoStudent();
  s.id = id; s.name = name; s.isDemo = false; s.active = true; s.photos = []; s.phone = phone || "";
  return JSON.parse(JSON.stringify(studentToRow(s)));
}
(async function(){
  var srv = await startStaticServer(path.join(__dirname, ".."));
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  // uma página por cenário; os pedidos a wa.me ficam registados e respondem com uma página vazia (o WhatsApp não corre aqui)
  async function open(ctxOpts, abortWa){
    var ctx = await browser.newContext(Object.assign({viewport: {width: 390, height: 844}}, ctxOpts || {}));
    await ctx.addInitScript(fakeSource({role: "professional", userId: "pro-1", rows: [row("a1", "Ana Silva", "912345678"), row("b1", "Bruno Sem Telefone", "")]}));
    var wa = [];
    await ctx.route(/^https:\/\/wa\.me\//, function(r){
      wa.push(r.request().url());
      // no telemóvel a página navega para wa.me: abortar a navegação deixa a app (e o Supabase simulado) onde estava, para se poder ver o que ficou guardado
      return abortWa ? r.abort("aborted") : r.fulfill({status: 200, contentType: "text/html", body: "<!doctype html><title>wa</title><body>wa.me</body>"});
    });
    var pg = await ctx.newPage(); pg.setDefaultTimeout(7000);
    pg.on("pageerror", function(e){ errors.push(e.message); });
    await pg.goto(srv.url); await pg.waitForSelector(".student-row");
    return {ctx: ctx, pg: pg, wa: wa};
  }
  async function openSheet(pg, id){
    await pg.locator('[data-open="' + id + '"]').first().click();
    await pg.click('#proApp .pro-nav-item[data-t="evolucao"]');
    await pg.waitForSelector("#sendEvolution");
    await pg.click("#sendEvolution");
    await pg.waitForSelector("#evPreview img");
  }

  // ---- 1. telemóvel (ecrã tátil): a página navega para a conversa, como a app instalada ----
  var m = await open({isMobile: true, hasTouch: true}, true);
  var touch = await m.pg.evaluate(function(){ return matchMedia("(pointer: coarse)").matches; });
  await openSheet(m.pg, "a1");
  var btn = m.pg.locator("#evWaLink");
  var enabled = await btn.isEnabled();
  var label = (await btn.textContent()).trim();
  check.check("1. Com telefone há três saídas: «Abrir no WhatsApp com ligação à imagem» (principal, ativa com a imagem pronta), «Partilhar a imagem» e «Só a mensagem, sem imagem»",
    touch && enabled && label === "Abrir no WhatsApp com ligação à imagem" && /Partilhar a imagem/.test(await m.pg.locator("#evSendImg").textContent()) && /Só a mensagem, sem imagem/.test(await m.pg.locator("#evWa").textContent()) && /\b7 dias\b/.test(await m.pg.locator("body").innerText()));
  var msgText = await m.pg.inputValue("#evMsg");
  var pngKB = Math.round(((await m.pg.locator("#evPreview img").getAttribute("src")).length * 0.75) / 1024);
  var reqP = m.pg.waitForRequest(function(r){ return /^https:\/\/wa\.me\//.test(r.url()); });
  await btn.click();
  var req = await reqP;
  var url = new URL(req.url()), sent = url.searchParams.get("text") || "";
  var f1 = await m.pg.evaluate(function(){ var u = (window.__fake.uploads || [])[0] || {}; return {n: (window.__fake.uploads || []).length, path: u.path, type: u.type, size: u.size, head: u.head, b64: u.b64, ttl: (window.__fake.signedTtls || [])[0], signed: window.__fake.signedUrls.slice()}; });
  check.check("2. O clique abre wa.me/351912345678 (a conversa do aluno) com a mensagem editada e, por baixo, a ligação à imagem com a validade", url.pathname === "/351912345678" && sent.indexOf(msgText) === 0 && /\n\nImagem da tua evolução \(ligação válida 7 dias\):\nhttps:\/\/signed\.test\/evolucao\/[0-9a-f]{32}\.jpg$/.test(sent));
  check.check("3. Foi guardado um único JPEG (começa por FF D8 FF) na pasta evolucao, abaixo de 280 KB, e a ligação criada para esse ficheiro vale 7 dias (604 800 s)",
    f1.n === 1 && /^evolucao\/[0-9a-f]{32}\.jpg$/.test(f1.path) && f1.type === "image/jpeg" && f1.head.join() === "255,216,255" && f1.size > 5000 && f1.size <= 280 * 1024 && f1.ttl === 604800 && f1.signed.indexOf(f1.path) >= 0 && sent.indexOf("https://signed.test/" + f1.path) > 0);
  console.log("(medido: PNG da pré-visualização ≈ " + pngKB + " KB; JPEG enviado = " + Math.round(f1.size / 1024) + " KB)");
  if (process.env.SAVE_EVOLUTION_JPG && f1.b64) fs.writeFileSync(process.env.SAVE_EVOLUTION_JPG, Buffer.from(f1.b64, "base64"));
  await m.pg.waitForFunction(function(){ return window.__fake.writes.some(function(w){ return w.table === "students" && w.op === "update" && w.cols.indexOf("contact_log") >= 0; }); }).catch(function(){});
  var logged = await m.pg.evaluate(function(){ return window.__fake.writes.some(function(w){ return w.table === "students" && w.op === "update" && w.cols.indexOf("contact_log") >= 0 && /whatsapp/.test(JSON.stringify(w.payload || {})); }); });
  check.check("4. O contacto fica registado no histórico do aluno (canal WhatsApp), como no «Só a mensagem»", logged);
  await m.ctx.close();

  // ---- 2. computador: abre outro separador e a app (com a janela) fica onde estava ----
  var d = await open();
  await openSheet(d.pg, "a1");
  var popP = d.ctx.waitForEvent("page");
  await d.pg.click("#evWaLink");
  var pop = await popP;
  await pop.waitForLoadState().catch(function(){});
  check.check("5. No computador a conversa abre num separador novo e a janela «Enviar evolução» continua aberta com o botão de novo ativo",
    /^https:\/\/wa\.me\/351912345678\?text=/.test(pop.url()) && d.wa.length === 1 && (await d.pg.locator("#evWaLink").isEnabled()) && (await d.pg.locator("#evWaLink").textContent()).trim() === "Abrir no WhatsApp com ligação à imagem");
  await d.ctx.close();

  // ---- 3. limpeza das imagens expiradas ----
  var c = await open({isMobile: true, hasTouch: true}, true);
  await c.pg.evaluate(function(){
    var ago = function(n){ return new Date(Date.now() - n * 86400000).toISOString(); };
    window.__fake.storageFiles = [{name: "velha.jpg", created_at: ago(10)}, {name: "recente.jpg", created_at: ago(2)}];
  });
  await openSheet(c.pg, "a1");
  var reqC = c.pg.waitForRequest(function(r){ return /^https:\/\/wa\.me\//.test(r.url()); });
  await c.pg.click("#evWaLink"); await reqC;
  var removed = await c.pg.waitForFunction(function(){ return (window.__fake.removed || []).length ? window.__fake.removed : null; }).then(function(h){ return h.jsonValue(); }).catch(function(){ return null; });
  check.check("6. Ao enviar, apaga do balde as imagens com mais de 8 dias (a velha vai, a recente fica)", removed && removed.length === 1 && removed[0].join() === "evolucao/velha.jpg" && (await c.pg.evaluate(function(){ return window.__fake.listed[0]; })) === "evolucao");
  await c.ctx.close();

  // ---- 4. falha do servidor: avisa, não abre o WhatsApp e deixa as outras saídas ----
  var e = await open({isMobile: true, hasTouch: true}, true);
  await openSheet(e.pg, "a1");
  await e.pg.evaluate(function(){ window.__fake.failUpload = true; });
  await e.pg.click("#evWaLink");
  await e.pg.waitForSelector(".toast");
  var toast = await e.pg.locator(".toast").first().innerText();
  await e.pg.waitForTimeout(400);
  check.check("7. Se o servidor recusar o ficheiro, aparece o aviso com a causa, o WhatsApp não abre, nada fica guardado e o botão volta a ficar ativo",
    /Não consegui preparar a ligação à imagem/.test(toast) && /row-level security/.test(toast) && /Partilhar a imagem/.test(toast) && e.wa.length === 0 && !(await e.pg.evaluate(function(){ return (window.__fake.uploads || []).length; })) && (await e.pg.locator("#evWaLink").isEnabled()) && (await e.pg.locator("#evWaLink").textContent()).trim() === "Abrir no WhatsApp com ligação à imagem");
  // a ligação cai a meio (o pedido é rejeitado em vez de devolver um erro): o mesmo caminho
  await e.pg.evaluate(function(){ window.__fake.failUpload = false; window.__fake.rejectUpload = true; });
  await e.pg.click("#evWaLink");
  await e.pg.waitForFunction(function(){ return Array.prototype.some.call(document.querySelectorAll(".toast"), function(t){ return /Failed to fetch/.test(t.textContent); }); });
  check.check("8. Se o pedido cair a meio também avisa (com a causa), não abre o WhatsApp e o botão volta a ficar ativo", e.wa.length === 0 && (await e.pg.locator("#evWaLink").isEnabled()));
  await e.ctx.close();

  // ---- 5. «Só a mensagem»: sem ficheiro nenhum ----
  var t = await open({isMobile: true, hasTouch: true}, true);
  await openSheet(t.pg, "a1");
  var href = await t.pg.locator("#evWa").getAttribute("href");
  check.check("9. «Só a mensagem, sem imagem» abre a conversa só com o texto da mensagem (sem ligação) e não guarda nada", /^https:\/\/wa\.me\/351912345678\?text=/.test(href) && decodeURIComponent(href.split("?text=")[1]) === await t.pg.inputValue("#evMsg") && !(await t.pg.evaluate(function(){ return (window.__fake.uploads || []).length; })));
  // mudar o período refaz a imagem e a mensagem; o botão da ligação acompanha
  await t.pg.click('[data-evr="90"]');
  await t.pg.waitForFunction(function(){ var b = document.getElementById("evWaLink"); return b && !b.disabled; });
  check.check("10. Mudar o período mantém o botão da ligação utilizável", await t.pg.locator("#evWaLink").isEnabled());
  await t.ctx.close();

  // ---- 6. sem telefone: nada de WhatsApp, a partilha passa a principal ----
  var n = await open({isMobile: true, hasTouch: true}, true);
  await openSheet(n.pg, "b1");
  var send = n.pg.locator("#evSendImg");
  check.check("11. Sem telefone na ficha não há botão do WhatsApp nem «Só a mensagem»; a partilha da imagem fica como saída principal e explica o que fazer",
    (await n.pg.locator("#evWaLink").count()) === 0 && (await n.pg.locator("#evWa").count()) === 0 && /primary/.test(await send.getAttribute("class")) && /Sem telefone na ficha/.test(await n.pg.locator("body").innerText()));
  await n.ctx.close();

  await browser.close(); srv.server.close();
  check.check("12. Nenhum erro de JavaScript na página", errors.length === 0);
  if (errors.length) console.log(errors.slice(0, 5));
  check.summarize();
})().catch(function(err){ console.error(err); process.exit(1); });
