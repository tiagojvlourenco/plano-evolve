// Fase 36 — o Supabase devolve no máximo 1000 linhas por pedido; o catálogo tem milhares.
// fetchAllFoodProductPages tem de ir buscar todas as páginas.
var path = require("path");
var assert = require("assert");
var REPO = path.join(__dirname, "..");
process.chdir(REPO);
require(path.join(REPO, "tests/setup"))();
var appSource = require(path.join(REPO, "tests/extract-app"))();
eval(appSource);

function fakeQuery(total){
  var rows = []; for (var i = 0; i < total; i++) rows.push({id: i});
  var calls = [];
  return {calls: calls, make: function(){
    return {range: function(a, b){ calls.push([a, b]); return Promise.resolve({data: rows.slice(a, b + 1), error: null}); }};
  }};
}

var passed = 0, failed = 0;
function check(name, ok){ if (ok){ passed++; } else { failed++; console.log("FAIL:", name); } }

Promise.all([
  (function(){ var q = fakeQuery(4141); return fetchAllFoodProductPages(q.make).then(function(res){
    check("devolve as 4141 linhas", res.data.length === 4141);
    check("faz 5 pedidos de 1000", q.calls.length === 5 && q.calls[4][0] === 4000);
  }); })(),
  (function(){ var q = fakeQuery(1000); return fetchAllFoodProductPages(q.make).then(function(res){
    check("1000 linhas exatas: 2 pedidos (a 2.ª vem vazia)", res.data.length === 1000 && q.calls.length === 2);
  }); })(),
  (function(){ var q = fakeQuery(37); return fetchAllFoodProductPages(q.make).then(function(res){
    check("poucas linhas: 1 pedido", res.data.length === 37 && q.calls.length === 1);
  }); })(),
  fetchAllFoodProductPages(function(){ return {range: function(){ return Promise.resolve({data: null, error: {message: "x"}}); }}; }).then(function(res){
    check("propaga o erro", !!res.error);
  })
]).then(function(){
  console.log(passed + " passaram, " + failed + " falharam");
  if (failed) process.exit(1);
});
