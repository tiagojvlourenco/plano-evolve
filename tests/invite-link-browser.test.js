// Convite por link (sem email): o PT gera o link (função segura do Supabase, aqui simulada), o aluno abre-o, define a password e a conta fica ativa.
// Chromium real com Supabase simulado. A função «convidar-aluno» e o servidor de autenticação reais só se validam no teu projeto (docs 8s).
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var fs = require("fs");
var path = require("path");
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){ console.log("(ignorado: Playwright/Chromium não disponíveis aqui)"); check.check("browser indisponível — teste ignorado", true); check.summarize(); }
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");

function row(id, name, o){
  authRole = "professional";
  var s = buildFullDemoStudent();
  s.id = id; s.name = name; s.isDemo = false; s.active = true; s.photos = []; s.nutritionPhase = null; s.inviteEmail = (o && o.email) || null;
  var r = JSON.parse(JSON.stringify(studentToRow(s)));
  if (o && o.authUserId) r.auth_user_id = o.authUserId;
  return r;
}
async function openContacto(pg){
  await pg.waitForSelector("summary");
  var sm = pg.locator("summary", {hasText: /Contacto/i}).first();
  await sm.waitFor();
  if (!(await pg.locator("#genInvite").isVisible().catch(function(){ return false; }))) await sm.click();
  await pg.waitForSelector("#genInvite");
}
(async function(){
  var srv = await startStaticServer(path.join(__dirname, ".."));
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  async function open(initial, query){
    var ctx = await browser.newContext({viewport: {width: 390, height: 844}});
    await ctx.addInitScript(fakeSource(initial));
    var pg = await ctx.newPage(); pg.setDefaultTimeout(6000);
    pg.on("pageerror", function(e){ errors.push(e.message); });
    await pg.goto(srv.url + (query || ""));
    return {ctx: ctx, pg: pg};
  }
  var TOK = "tokenAlunoNovo1234567890";

  // ---- aluno abre o link ----
  var tokens = {}; tokens[TOK] = {type: "invite", email: "ana@exemplo.pt"};
  var a = await open({role: "student", userId: "user-ana", email: "ana@exemplo.pt", rows: [row("ana", "Ana Convidada", {email: "ana@exemplo.pt"})], noSession: true, inviteTokens: tokens}, "?convite=" + TOK + "&tipo=invite");
  await a.pg.waitForSelector("#recoveryScreen:not(.hidden)");
  var txt = await a.pg.locator("#recoveryScreen").innerText();
  check.check("1. O link abre direto o ecrã de definir password («Ativa a tua conta»), sem passar pelo login", /ativa a tua conta/i.test(txt) && /definir password e entrar/i.test(txt) && !(await a.pg.locator("#authScreen:not(.hidden)").count()));
  check.check("2. O token sai do endereço e ainda não foi gasto (pré-visualizações do link não o inutilizam)", !/convite=/.test(a.pg.url()) && (await a.pg.evaluate(function(){ return window.__fake.verifies || 0; })) === 0);
  await a.pg.fill("#recoveryPassword", "12");   // o campo exige 6, mas o navegador deixa-nos forçar
  await a.pg.evaluate(function(){ document.getElementById("recoveryPassword").removeAttribute("minlength"); });
  await a.pg.click("#recoverySubmit");
  await a.pg.waitForFunction(function(){ var e = document.getElementById("recoveryError"); return e && e.style.display !== "none" && /6 caracteres/.test(e.textContent); });
  check.check("3. Uma password curta é recusada com mensagem em português", /6 caracteres/.test(await a.pg.locator("#recoveryError").innerText()));
  await a.pg.fill("#recoveryPassword", "segredo123");
  await a.pg.click("#recoverySubmit");
  await a.pg.waitForSelector("#alunoApp:not(.hidden)");
  var fk = await a.pg.evaluate(function(){ return {verifies: window.__fake.verifies, pass: window.__fake.passwordSet, last: window.__fake.lastPassword}; });
  check.check("4. Ao definir a password a conta fica ativa e a app abre logo (o token foi gasto uma só vez, mesmo depois de a 1.ª password falhar)", fk.verifies === 1 && fk.pass === true && fk.last === "segredo123" && (await a.pg.locator("#recoveryScreen.hidden").count()) === 1);
  await a.ctx.close();

  var b = await open({role: "student", userId: "user-ana", email: "ana@exemplo.pt", rows: [], noSession: true, inviteTokens: {tokenJaUsado123456789: {type: "invite", email: "ana@exemplo.pt", used: true}}}, "?convite=tokenJaUsado123456789&tipo=invite");
  await b.pg.waitForSelector("#recoveryScreen:not(.hidden)");
  await b.pg.fill("#recoveryPassword", "segredo123"); await b.pg.click("#recoverySubmit");
  await b.pg.waitForFunction(function(){ var e = document.getElementById("recoveryError"); return e && e.style.display !== "none"; });
  check.check("5. Um link já usado ou expirado explica o que fazer (pedir outro ao profissional) e não abre a app", /já foi usado ou expirou/.test(await b.pg.locator("#recoveryError").innerText()) && (await b.pg.locator("#alunoApp:not(.hidden)").count()) === 0);
  await b.ctx.close();

  var c = await open({role: "student", userId: "user-ana", rows: [], noSession: true}, "?convite=x%3Cscript%3E&tipo=invite");
  await c.pg.waitForSelector("#recoveryScreen:not(.hidden)");
  check.check("6. Um token malformado é recusado logo (não chega a ser enviado ao servidor)", /não é válido/i.test(await c.pg.locator("#recoveryScreen").innerText()) && (await c.pg.locator("#recoverySubmit").isDisabled()) && (await c.pg.evaluate(function(){ return window.__fake.verifies || 0; })) === 0);
  await c.ctx.close();

  var d = await open({role: "student", userId: "user-ana", rows: [], noSession: true}, "");
  await d.pg.waitForSelector("#authScreen:not(.hidden)");
  check.check("7. Sem link, o login normal continua igual", (await d.pg.locator("#recoveryScreen:not(.hidden)").count()) === 0);
  await d.ctx.close();

  // ---- profissional gera o link ----
  var rows = [row("a1", "Ana Nova", {email: "ana@exemplo.pt"}), row("b1", "Rui Com Conta", {email: "rui@exemplo.pt", authUserId: "user-rui"}), row("c1", "Sem Email")];
  var p = await open({role: "professional", userId: "pt-1", rows: rows});
  await p.pg.waitForSelector(".student-row");
  await p.pg.locator('[data-open="a1"]').first().click();
  await openContacto(p.pg);
  check.check("8. Na ficha de um aluno por convidar o PT vê «Gerar link de convite»", /gerar link de convite/i.test(await p.pg.locator("#genInvite").innerText()));
  await p.pg.click("#genInvite");
  await p.pg.waitForSelector("#invLink");
  var link = await p.pg.locator("#invLink").inputValue(), call = await p.pg.evaluate(function(){ return window.__fake.invokes; });
  check.check("9. O link aponta para a própria app com o token e o tipo «invite»; a função recebeu só o email do convite", /\?convite=tok[A-Za-z0-9]+&tipo=invite$/.test(link) && link.indexOf(srv.url) === 0 && call.length === 1 && call[0].name === "convidar-aluno" && call[0].body.email === "ana@exemplo.pt" && Object.keys(call[0].body).join() === "email");
  check.check("10. O modal diz que o link é só para esse aluno, de uso único, e a conta fica ativa ao abrir", /só para ana nova/i.test(await p.pg.locator(".modal-sheet").innerText()) && /uma vez/i.test(await p.pg.locator(".modal-sheet").innerText()) && /ativa/i.test(await p.pg.locator(".modal-sheet").innerText()));
  check.check("11. O link não leva a password nem a chave de serviço", !/service|password|senha/i.test(link));
  await p.pg.click(".modal-sheet .mclose button");
  await p.pg.click("#proBack");
  await p.pg.locator('[data-open="b1"]').first().click();
  await openContacto(p.pg);
  check.check("12. Para quem já tem conta o botão é «Link para nova password» e o link é do tipo «recovery»", /link para nova password/i.test(await p.pg.locator("#genInvite").innerText()));
  await p.pg.click("#genInvite"); await p.pg.waitForSelector("#invLink");
  check.check("13. …e o modal explica que serve para definir uma password nova", /tipo=recovery$/.test(await p.pg.locator("#invLink").inputValue()) && /password nova/i.test(await p.pg.locator(".modal-sheet").innerText()));
  await p.pg.click(".modal-sheet .mclose button");
  await p.pg.click("#proBack");
  await p.pg.locator('[data-open="c1"]').first().click();
  await p.pg.waitForSelector(".pro-sidebar, .pro-nav-item");
  check.check("14. Sem email de convite não há botão", (await p.pg.locator("#genInvite").count()) === 0);
  await p.ctx.close();

  // ---- a função ainda não está publicada ----
  var m = await open({role: "professional", userId: "pt-1", rows: [row("a1", "Ana Nova", {email: "ana@exemplo.pt"})], functionMissing: true});
  await m.pg.waitForSelector(".student-row"); await m.pg.locator('[data-open="a1"]').first().click(); await openContacto(m.pg); await m.pg.click("#genInvite");
  await m.pg.waitForFunction(function(){ var e = document.getElementById("invMsg"); return e && /⚠/.test(e.textContent); });
  check.check("15. Se a função ainda não foi publicada, o PT é avisado (e vê onde está a explicação) em vez de ficar à espera", /ainda não está publicada/.test(await m.pg.locator("#invMsg").innerText()) && (await m.pg.locator("#invBox.hidden").count()) === 1);
  await m.ctx.close();

  // ---- o aluno nunca vê o botão ----
  var s = await open({role: "student", userId: "user-ana", email: "ana@exemplo.pt", rows: [row("ana", "Ana Convidada", {email: "ana@exemplo.pt", authUserId: "user-ana"})]});
  await s.pg.waitForSelector(".check-circle[data-circle], #alunoApp:not(.hidden)");
  check.check("16. Um aluno não tem botão de gerar links", (await s.pg.locator("#genInvite").count()) === 0);
  await s.ctx.close();

  check.check("17. Nenhum erro de JavaScript", errors.length === 0);
  if (errors.length) console.log(errors.slice(0, 3));
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e.message.split("\n")[0], (e.stack.split("\n").filter(function(l){ return /invite-link-browser/.test(l); })[0] || "").trim()); process.exit(1); });
