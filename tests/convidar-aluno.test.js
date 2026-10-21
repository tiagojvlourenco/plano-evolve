// Função «convidar-aluno» (lógica pura, testada em Node com dependências simuladas): só o profissional gera links, só para convites
// existentes, não envia email, nunca devolve o link completo nem a chave de serviço, e usa «recovery» se a conta já existe.
require("./setup")();
var check = require("./check")();
var path = require("path");
var fs = require("fs");
var url = require("url");
var coreFile = path.join(__dirname, "..", "supabase", "functions", "convidar-aluno", "core.mjs");
var indexSrc = fs.readFileSync(path.join(__dirname, "..", "supabase", "functions", "convidar-aluno", "index.ts"), "utf8");

(async function(){
  var core = await import(url.pathToFileURL(coreFile).href);
  var calls;
  function deps(o){
    o = o || {}; calls = {links: [], getUser: 0};
    return {
      getUser: async function(a){ calls.getUser++; return a === "Bearer pt" ? {id: "pt-1"} : a === "Bearer aluno" ? {id: "al-1"} : null; },
      isProfessional: async function(id){ return id === "pt-1"; },
      hasInvite: async function(email){ return o.invites ? o.invites.indexOf(email) >= 0 : email === "ana@exemplo.pt"; },
      generateLink: async function(type, email){ calls.links.push([type, email]); return o.gen ? o.gen(type) : {data: {properties: {hashed_token: "hash-" + type, action_link: "https://x/auth/v1/verify?token=SEGREDO", email_otp: "123456"}}, error: null}; }
    };
  }
  function req(extra){ return Object.assign({method: "POST", origin: "https://tiagojvlourenco.github.io", authorization: "Bearer pt", body: {email: "Ana@Exemplo.pt "}}, extra || {}); }

  var ok = await core.handleConvidar(req(), deps());
  check.check("1. O profissional recebe o token do convite (email normalizado) e o tipo «invite»", ok.status === 200 && ok.json.tipo === "invite" && ok.json.token_hash === "hash-invite" && ok.json.email === "ana@exemplo.pt" && calls.links.length === 1 && calls.links[0][0] === "invite" && calls.links[0][1] === "ana@exemplo.pt");
  check.check("2. A resposta não leva o link completo nem o código de 6 dígitos (só o token em hash) e não é guardada em cache", !/action_link|SEGREDO|123456|email_otp/.test(JSON.stringify(ok.json)) && ok.headers["Cache-Control"] === "no-store");

  var sem = await core.handleConvidar(req({authorization: ""}), deps());
  check.check("3. Sem sessão: 401 e nada é gerado", sem.status === 401 && calls.links.length === 0);
  var tokenMau = await core.handleConvidar(req({authorization: "Bearer falso"}), deps());
  check.check("4. Token inválido: 401 e nada é gerado", tokenMau.status === 401 && calls.links.length === 0);
  var aluno = await core.handleConvidar(req({authorization: "Bearer aluno"}), deps());
  check.check("5. Um aluno autenticado não pode gerar links: 403 e nada é gerado", aluno.status === 403 && aluno.json.codigo === "nao_profissional" && calls.links.length === 0);
  var mau = await Promise.all(["", "sem-arroba", "a@b", "x".repeat(260) + "@a.pt", null].map(function(e){ return core.handleConvidar(req({body: {email: e}}), deps()); }));
  check.check("6. Email vazio ou inválido: 400", mau.every(function(r){ return r.status === 400 && r.json.codigo === "email_invalido"; }));
  var semBody = await core.handleConvidar(req({body: null}), deps());
  check.check("7. Pedido sem corpo: 400", semBody.status === 400);
  var semConvite = await core.handleConvidar(req({body: {email: "estranho@exemplo.pt"}}), deps());
  check.check("8. Email sem ficha de aluno convidado: 404 e nada é gerado (a função não cria contas à toa)", semConvite.status === 404 && semConvite.json.codigo === "sem_convite" && calls.links.length === 0);

  var existe = await core.handleConvidar(req(), deps({gen: function(type){ return type === "invite" ? {data: null, error: {code: "email_exists", message: "A user with this email address has already been registered"}} : {data: {properties: {hashed_token: "hash-recovery"}}, error: null}; }}));
  check.check("9. Se a conta já existe, passa a «recovery» (definir password nova)", existe.status === 200 && existe.json.tipo === "recovery" && existe.json.token_hash === "hash-recovery" && calls.links.map(function(l){ return l[0]; }).join() === "invite,recovery");
  var falha = await core.handleConvidar(req(), deps({gen: function(){ return {data: null, error: {code: "unexpected", message: "boom segredo-interno"}}; }}));
  check.check("10. Outro erro do servidor: 502 com mensagem em português e sem expor o erro interno", falha.status === 502 && !/boom|segredo-interno/.test(JSON.stringify(falha.json)));
  var semToken = await core.handleConvidar(req(), deps({gen: function(){ return {data: {properties: {}}, error: null}; }}));
  check.check("11. Resposta do servidor sem token: 502", semToken.status === 502);

  var pre = await core.handleConvidar({method: "OPTIONS", origin: "https://tiagojvlourenco.github.io"}, deps());
  check.check("12. Pré-pedido CORS (OPTIONS): 204, só a origem da app, sem chamar nada", pre.status === 204 && pre.headers["Access-Control-Allow-Origin"] === "https://tiagojvlourenco.github.io" && calls.getUser === 0 && calls.links.length === 0);
  var estranho = await core.handleConvidar({method: "OPTIONS", origin: "https://mau.exemplo.com"}, deps());
  check.check("13. Uma origem estranha não é autorizada", estranho.headers["Access-Control-Allow-Origin"] === "https://tiagojvlourenco.github.io");
  var get = await core.handleConvidar(req({method: "GET"}), deps());
  check.check("14. Só aceita POST", get.status === 405);

  check.check("15. O ponto de entrada valida o utilizador e a lista de profissionais no servidor, e usa a chave de serviço só aí (nunca no cliente)", /auth\.getUser\(\)/.test(indexSrc) && /from\("professionals"\)/.test(indexSrc) && /SUPABASE_SERVICE_ROLE_KEY/.test(indexSrc));
  var appSrc = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8") + fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  check.check("16. A chave de serviço não aparece na app", !/service_role|SERVICE_ROLE/i.test(appSrc));
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e.message); process.exit(1); });
