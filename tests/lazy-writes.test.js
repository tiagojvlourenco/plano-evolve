// Escritas no Supabase nunca podem ficar "por executar".
// O cliente real (supabase-js) só envia um pedido quando alguém espera pelo resultado
// (.then / await). Uma chamada como  sb.from("x").insert({...});  sem isso NÃO envia nada,
// e a app parece funcionar (foi o que aconteceu com os pedidos de ajuda ao profissional).
// Este teste usa um cliente falso preguiçoso, como o real, para apanhar esse defeito.
require("./setup")();
var fs = require("fs");
var path = require("path");
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

// Cliente falso: só regista o pedido quando .then() é chamado (tal como o supabase-js).
function lazyClient(log){
  function builder(table){
    var b = { _table: table, _op: "select", _payload: null };
    ["select", "eq", "in", "order", "limit", "single"].forEach(function(m){ b[m] = function(){ return b; }; });
    ["insert", "update", "upsert", "delete"].forEach(function(m){
      b[m] = function(payload){ b._op = m; b._payload = payload; return b; };
    });
    b.then = function(ok, ko){
      log.push({ table: b._table, op: b._op, payload: b._payload });
      return Promise.resolve({ data: null, error: null }).then(ok, ko);
    };
    return b;
  }
  return { from: function(table){ return builder(table); } };
}

var student = { id: "s1", name: "Aluno Teste", adaptationHistory: [], meals: [], targets: {} };
var originalSb = sb, originalReady = sbReady;
var tests = [];

// 1. O próprio cliente falso é preguiçoso: sem esperar pelo resultado, nada é registado.
tests.push(function(){
  var log = [];
  var client = lazyClient(log);
  client.from("help_requests").insert({ student_id: "s1" }); // como o código antigo: sem .then
  check.check("1. Sem esperar pelo resultado, o cliente falso não regista nada (como o real)", log.length === 0);
  client.from("help_requests").insert({ student_id: "s1" }).then(function(){});
  check.check("1. Ao esperar pelo resultado, regista a escrita", log.length === 1 && log[0].op === "insert");
});

// 2. createHelpRequest: chamado como a app o faz (sem usar o resultado), a escrita TEM de ser enviada.
tests.push(function(){
  var log = [];
  sbReady = true; sb = lazyClient(log);
  createHelpRequest(student, null, "duvida", "x"); // os 4 chamadores da app ignoram o retorno
  return Promise.resolve().then(function(){ return Promise.resolve(); }).then(function(){
    var inserts = log.filter(function(e){ return e.table === "help_requests" && e.op === "insert"; });
    check.check("2. O pedido de ajuda é mesmo enviado, mesmo que ninguém use o retorno", inserts.length === 1);
    check.check("2. Envia o student_id e a situação certos", inserts[0] && inserts[0].payload.student_id === "s1" && inserts[0].payload.situation === "duvida");
  });
});

// 3. Auditoria estática: toda a instrução que COMEÇA em sb.from(...) tem de ter .then(...) na cadeia.
tests.push(function(){
  var src = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  var re = /^[ \t]*sb\.from\(/gm, m, bare = 0, unconsumed = [];
  while ((m = re.exec(src))){
    bare++;
    var i = m.index + m[0].length - 1; // aponta para o "(" de from(
    var idents = ["from"];
    while (true){
      // consome (...) com parênteses equilibrados (ignora texto entre aspas)
      var depth = 0, quote = null, j = i;
      for (; j < src.length; j++){
        var c = src[j];
        if (quote){ if (c === "\\") j++; else if (c === quote) quote = null; continue; }
        if (c === '"' || c === "'" || c === "`"){ quote = c; continue; }
        if (c === "(") depth++;
        else if (c === ")"){ depth--; if (depth === 0) break; }
      }
      var rest = src.slice(j + 1).match(/^\s*\.([A-Za-z_]+)\(/);
      if (!rest) break;
      idents.push(rest[1]);
      i = j + 1 + rest[0].length - 1;
    }
    if (idents.indexOf("then") === -1) unconsumed.push(src.slice(0, m.index).split("\n").length + ": " + idents.join("."));
  }
  check.check("3. Há escritas/leituras Supabase em instruções soltas para auditar (>0)", bare > 0);
  check.check("3. Nenhuma instrução sb.from(...) solta fica sem .then(): " + unconsumed.join(" | "), unconsumed.length === 0);
});

// 4. Funções que devolvem a escrita por executar têm de ser consumidas pelo chamador.
tests.push(function(){
  var src = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  check.check("4. saveHelpRequestNote(...) é consumida com .then", /saveHelpRequestNote\([^)]*\)\.then\(/.test(src));
  check.check("4. markHelpRequestHandled(...) é consumida com .then", /markHelpRequestHandled\([^)]*\)\.then\(/.test(src));
  check.check("4. createHelpRequest espera pelo resultado da escrita (Promise.resolve(...).then)", /return Promise\.resolve\(sb\.from\("help_requests"\)\.insert\(/.test(src));
});

tests.reduce(function(chain, t){ return chain.then(t); }, Promise.resolve()).then(function(){
  sb = originalSb; sbReady = originalReady;
  check.summarize();
}, function(e){ console.log("FAIL: exceção inesperada", e); process.exit(1); });
