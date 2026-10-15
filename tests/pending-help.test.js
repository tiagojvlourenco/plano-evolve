// Indicador de pedidos de ajuda por tratar (lista de alunos e menu do aluno) e lista de alimentos em cache.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

(async function(){
  var realSb = sb, realReady = sbReady;
  // 1. contagem numa só consulta, agrupada por aluno
  var asked = [];
  sb = {from: function(t){ asked.push(t); return {select: function(c){ asked.push(c); return {eq: function(col, v){ asked.push(col + "=" + v); return Promise.resolve({data: [{student_id: "a"}, {student_id: "b"}, {student_id: "a"}], error: null}); }}; }}; }};
  sbReady = true;
  var map = await loadPendingHelpCounts();
  check.check("1. Uma só consulta a help_requests com status 'pendente', agrupada por aluno", asked.join("|") === "help_requests|student_id|status=pendente" && map.a === 2 && map.b === 1 && Object.keys(map).length === 2);
  sb = {from: function(){ return {select: function(){ return {eq: function(){ return Promise.resolve({data: null, error: {message: "rls"}}); }}; }}; }};
  check.check("2. Um erro não parece 'sem pedidos': devolve null e não apaga os indicadores", (await loadPendingHelpCounts()) === null);
  sbReady = false;
  check.check("3. Sem Supabase (modo local) não há pedidos", JSON.stringify(await loadPendingHelpCounts()) === "{}");
  sb = realSb; sbReady = realReady;

  // 2. indicadores
  state.pendingHelp = {x1: 3};
  check.check("4. pendingHelpFor devolve a contagem do aluno (0 se não tem)", pendingHelpFor("x1") === 3 && pendingHelpFor("outro") === 0);
  state.proSelectedId = "x1"; state.proTab = "leitura";
  check.check("5. O menu do aluno com pedidos por tratar mostra o ponto em Resumo e só aí", /has-pending" data-g="resumo"/.test(proStudentNavHtml()) && (proStudentNavHtml().match(/has-pending/g) || []).length === 1);
  state.proSelectedId = "sem-pedidos";
  check.check("6. Sem pedidos não há ponto", proStudentNavHtml().indexOf("has-pending") < 0);
  check.check("7. O menu do aluno tem 4 entradas e todas as chaves antigas continuam num grupo", (proStudentNavHtml().match(/data-g=/g) || []).length === 4 && PRO_TABS.filter(function(t){ return t[0] !== "sessoes"; }).every(function(t){ return PRO_NAV.some(function(g){ return g.tabs.indexOf(t[0]) >= 0; }); }));
  state.pendingHelp = {}; state.proSelectedId = null;

  // 3. lista de alimentos ordenada em cache
  var before = Object.keys(FOOD_DB).length;
  var a = allFoodNames(), b2 = allFoodNames();
  check.check("8. A lista de nomes de alimentos vem ordenada (pt) e é a mesma lista em cache entre chamadas", a === b2 && a.length === before && a.every(function(n, i){ return i === 0 || a[i - 1].localeCompare(n, "pt") <= 0; }));
  FOOD_DB["Zzz alimento novo (teste)"] = {per: "100g", kcal: 1, p: 0, c: 0, f: 0};
  var c = allFoodNames();
  check.check("9. Ao entrar um alimento novo a lista refaz-se e inclui-o", c !== a && c.length === before + 1 && c.indexOf("Zzz alimento novo (teste)") >= 0);
  delete FOOD_DB["Zzz alimento novo (teste)"];
  check.summarize();
})();
