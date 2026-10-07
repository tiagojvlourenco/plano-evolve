// Erros nos pedidos de ajuda ao profissional têm de ser visíveis (nunca parecer "sem pedidos").
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

var student = { id: "s1", name: "Aluno Teste", adaptationHistory: [], meals: [], targets: {} };

// Constrói um "cliente Supabase" falso cuja cadeia termina num resultado/rejeição à escolha.
function fakeClient(result, reject){
  var chain = {
    select: function(){ return chain; }, eq: function(){ return chain; }, order: function(){ return chain; },
    insert: function(){ return chain; }, update: function(){ return chain; },
    then: function(ok, ko){ return (reject ? Promise.reject(reject) : Promise.resolve(result)).then(ok, ko); }
  };
  return { from: function(){ return chain; } };
}

// 1. Tabela dos pedidos: o erro aparece como alerta, com detalhe e botão de repetir — não como "sem pedidos".
(function(){
  var reqs = []; reqs.error = { message: "permission denied for table help_requests" };
  var html = tplProPedidos(student, reqs);
  check.check("1. Com erro, mostra o alerta de falha", html.indexOf("Não foi possível carregar os pedidos") >= 0);
  check.check("1. Com erro, NÃO diz 'Ainda sem pedidos de ajuda'", html.indexOf("Ainda sem pedidos de ajuda") === -1);
  check.check("1. Mostra o detalhe técnico do erro", html.indexOf("permission denied for table help_requests") >= 0);
  check.check("1. Tem botão para tentar de novo", html.indexOf('id="retryHelpRequests"') >= 0);
  check.check("1. O alerta é anunciado a leitores de ecrã (role=alert)", html.indexOf('role="alert"') >= 0);
})();

// 2. Sem erro e sem pedidos, continua a mostrar o estado vazio normal.
(function(){
  var html = tplProPedidos(student, []);
  check.check("2. Sem erro e sem pedidos, mostra 'Ainda sem pedidos de ajuda'", html.indexOf("Ainda sem pedidos de ajuda") >= 0);
  check.check("2. Sem erro, não mostra o alerta", html.indexOf("Não foi possível carregar") === -1);
})();

// 3. O detalhe do erro é escapado (vem da base de dados, nunca HTML cru).
(function(){
  var reqs = []; reqs.error = { message: "<img src=x onerror=alert(1)>" };
  var html = tplProPedidos(student, reqs);
  check.check("3. O detalhe do erro é escapado", html.indexOf("<img src=x") === -1 && html.indexOf("&lt;img") >= 0);
})();

var originalSb = sb, originalReady = sbReady;
var tests = [];

// 4. loadHelpRequests: erro devolvido pelo Supabase fica na propriedade .error da lista.
tests.push(function(){
  sbReady = true; sb = fakeClient({ data: null, error: { message: "relation does not exist" } });
  return loadHelpRequests("s1").then(function(list){
    check.check("4. Erro do Supabase fica em list.error", list.error && list.error.message === "relation does not exist");
    check.check("4. Continua a devolver uma lista (vazia), para não rebentar os chamadores", Array.isArray(list) && list.length === 0);
  });
});

// 5. loadHelpRequests: falha de rede (rejeição) também fica em .error.
tests.push(function(){
  sbReady = true; sb = fakeClient(null, new Error("Failed to fetch"));
  return loadHelpRequests("s1").then(function(list){
    check.check("5. Falha de rede fica em list.error", list.error && /Failed to fetch/.test(list.error.message));
  });
});

// 6. loadHelpRequests: sucesso não tem .error.
tests.push(function(){
  sbReady = true; sb = fakeClient({ data: [{ id: 1, situation: "duvida", created_at: "2026-10-01T10:00:00Z" }], error: null });
  return loadHelpRequests("s1").then(function(list){
    check.check("6. Sucesso devolve os pedidos sem .error", list.length === 1 && !list.error);
  });
});

// 7. createHelpRequest: se a gravação falha, o aluno vê o erro (e o aviso de sucesso é retirado).
tests.push(function(){
  var toasts = [], removed = 0;
  var realQSA = document.querySelectorAll, realShow = showToast;
  document.querySelectorAll = function(sel){ return sel === ".toast" ? [{ remove: function(){ removed++; } }] : []; };
  showToast = function(msg){ toasts.push(msg); };
  sbReady = true; sb = fakeClient({ data: null, error: { message: "new row violates row-level security policy" } });
  var origErr = console.error; console.error = function(){};
  return createHelpRequest(student, null, "duvida", "x").then(function(res){
    console.error = origErr; document.querySelectorAll = realQSA; showToast = realShow;
    check.check("7. Gravação falhada mostra um aviso de erro ao aluno", toasts.some(function(m){ return /Não foi possível enviar o pedido/.test(m); }));
    check.check("7. O aviso de sucesso anterior é retirado", removed === 1);
    check.check("7. O resultado indica falha", res && res.success === false && res.error);
  });
});

// 8. createHelpRequest: gravação com sucesso não mostra erro.
tests.push(function(){
  var toasts = [];
  var realShow = showToast; showToast = function(msg){ toasts.push(msg); };
  sbReady = true; sb = fakeClient({ data: null, error: null });
  return createHelpRequest(student, null, "duvida", "x").then(function(){
    showToast = realShow;
    check.check("8. Gravação bem-sucedida não mostra erro", toasts.length === 0);
  });
});

// Corre em sequência: os testes 7 e 8 trocam globais (showToast, document.querySelectorAll).
tests.reduce(function(chain, t){ return chain.then(t); }, Promise.resolve()).then(function(){
  sb = originalSb; sbReady = originalReady;
  check.summarize();
}, function(e){ console.log("FAIL: exceção inesperada", e); process.exit(1); });
