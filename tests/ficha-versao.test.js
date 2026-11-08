// Y1 — versão otimista da ficha (migração 0035): dois aparelhos do profissional não se sobrescrevem em silêncio.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var store = {};
global.localStorage = {getItem: function(k){ return k in store ? store[k] : null; }, setItem: function(k, v){ store[k] = String(v); }, removeItem: function(k){ delete store[k]; }};

// servidor mínimo com `rev` que sobe em cada update (como o gatilho da 0035)
var DB, LOG;
function fakeServer(opts){
  opts = opts || {};
  return {from: function(){
    var q = {op: "select", filters: [], payload: null, cols: "*"};
    q.update = function(p){ q.op = "update"; q.payload = p; return q; };
    q.select = function(c){ q.cols = c || "*"; return q; };
    q.eq = function(k, v){ q.filters.push([k, v]); return q; };
    q.maybeSingle = function(){ q.single = true; return q; };
    q.then = function(res, rej){
      var out;
      var id = (q.filters.filter(function(f){ return f[0] === "id"; })[0] || [])[1];
      var row = DB[id];
      if (q.op === "update"){
        LOG.push({cols: Object.keys(q.payload), revFilter: (q.filters.filter(function(f){ return f[0] === "rev"; })[0] || [])[1]});
        if (opts.noRevColumn && (q.filters.some(function(f){ return f[0] === "rev"; }) || /rev/.test(q.cols))) out = {data: null, error: {message: "column students.rev does not exist", code: "42703"}, status: 400};
        else {
          var rf = q.filters.filter(function(f){ return f[0] === "rev"; })[0];
          if (!row || (rf && row.rev !== rf[1])) out = {data: [], error: null, status: 200};
          else { Object.keys(q.payload).forEach(function(k){ row[k] = JSON.parse(JSON.stringify(q.payload[k])); }); row.rev += 1; out = {data: [{id: id, rev: row.rev}], error: null, status: 200}; }
        }
      } else out = {data: row ? JSON.parse(JSON.stringify(row)) : null, error: null, status: 200};
      return Promise.resolve(out).then(res, rej);
    };
    return q;
  }};
}
function baseRow(){ return {id: "a", initials: "A", name: "Ana", meals: [], photos: [], likes: [], dislikes: [], avoid: [], allergies: [], targets: {kcal: 1800}, notes: "original", checkins: [], weights: [], assessments: [], plan_history: [], rev: 5}; }
function openOnDevice(){ // o aparelho lê a ficha tal como está no servidor
  var s = rowToStudent(JSON.parse(JSON.stringify(DB.a)));
  setSyncBaseline(s, rowBaseline(studentToRow(s)));
  STUDENTS = [s];
  return s;
}
function reset(role, opts){ DB = {a: baseRow()}; LOG = []; outboxMem = {}; store = {}; authRole = role; sbReady = true; sb = fakeServer(opts); syncLast.fails = 0; }
var confirms; window.confirm = function(m){ confirms.push(m); return confirms.answer; };
function edit(s, col, value){ outboxMem = {}; outboxAdd("a", (function(o){ o[col] = value; return o; })({})); }

(async function(){
  // 1. envio normal: leva o filtro rev e guarda a versão nova
  reset("professional"); confirms = []; confirms.answer = true;
  var s = openOnDevice();
  check.check("1. A ficha lida traz a versão (rev 5)", s._rev === 5);
  check.check("2. A versão não entra na ficha nem nas comparações (não enumerável)", Object.keys(s).indexOf("_rev") < 0 && !("rev" in studentToRow(s)));
  edit(s, "notes", "do aparelho A");
  var ok = await outboxSendOne("a");
  check.check("3. Envio normal: grava com o filtro rev=5 e fica na versão 6", ok === true && DB.a.notes === "do aparelho A" && LOG[0].revFilter === 5 && s._rev === 6 && !confirms.length);

  // 2. outro aparelho mudou OUTRA coluna: reenvia sozinho, sem perguntar, e as duas alterações ficam
  reset("professional"); confirms = []; confirms.answer = true;
  s = openOnDevice();
  DB.a.meals = [{name: "Almoço", time: "13:00", foods: []}]; DB.a.rev = 6; // aparelho B
  edit(s, "notes", "do aparelho A");
  ok = await outboxSendOne("a");
  check.check("4. Colunas diferentes: reenvia com a versão nova sem perguntar", ok === true && !confirms.length && LOG.length === 2 && LOG[1].revFilter === 6);
  check.check("5. As alterações dos dois aparelhos ficam no servidor", DB.a.notes === "do aparelho A" && DB.a.meals.length === 1 && DB.a.rev === 7);

  // 3. a mesma coluna mudou nos dois: pergunta; OK mantém a minha
  reset("professional"); confirms = []; confirms.answer = true;
  s = openOnDevice();
  DB.a.notes = "do aparelho B"; DB.a.rev = 6;
  edit(s, "notes", "do aparelho A");
  ok = await outboxSendOne("a");
  check.check("6. Mesma coluna alterada noutro aparelho: pergunta, e nomeia a coluna", confirms.length === 1 && /notes/.test(confirms[0]) && /Ana/.test(confirms[0]));
  check.check("7. Responder OK mantém a alteração local", ok === true && DB.a.notes === "do aparelho A" && outboxCount() === 0);

  // 4. Cancelar: fica a do servidor, nada é enviado, a fila esvazia e a ficha local atualiza-se
  reset("professional"); confirms = []; confirms.answer = false;
  s = openOnDevice();
  DB.a.notes = "do aparelho B"; DB.a.rev = 6;
  edit(s, "notes", "do aparelho A");
  var writesBefore = LOG.length;
  ok = await outboxSendOne("a");
  check.check("8. Cancelar nunca sobrescreve o servidor", DB.a.notes === "do aparelho B" && LOG.length === writesBefore + 1 /* só a tentativa recusada */);
  check.check("9. Cancelar esvazia a fila e a ficha local passa a ter a versão do servidor", outboxCount() === 0 && s.notes === "do aparelho B" && s._rev === 6);

  // 5. o outro aparelho gravou o MESMO valor: não há conflito
  reset("professional"); confirms = []; confirms.answer = false;
  s = openOnDevice();
  DB.a.notes = "igual"; DB.a.rev = 6;
  edit(s, "notes", "igual");
  ok = await outboxSendOne("a");
  check.check("10. Mesmo valor nos dois aparelhos: sem pergunta", ok === true && !confirms.length && DB.a.notes === "igual");

  // 6. conflito misto: coluna livre segue, a em conflito é descartada com Cancelar
  reset("professional"); confirms = []; confirms.answer = false;
  s = openOnDevice();
  DB.a.notes = "do aparelho B"; DB.a.rev = 6;
  outboxMem = {}; outboxAdd("a", {notes: "do aparelho A", flexibility: 77});
  ok = await outboxSendOne("a");
  check.check("11. Conflito misto + Cancelar: a coluna livre segue e a em conflito fica com a do servidor", DB.a.flexibility === 77 && DB.a.notes === "do aparelho B" && confirms.length === 1);

  // 7. o aluno nunca usa o filtro (só o profissional)
  reset("student"); confirms = []; confirms.answer = true;
  s = openOnDevice();
  edit(s, "meals_date", "2026-11-08");
  ok = await outboxSendOne("a");
  check.check("12. O aluno grava sem filtro de versão", ok === true && LOG[0].revFilter === undefined && DB.a.meals_date === "2026-11-08");

  // 8. migração por aplicar: sem rev na leitura, grava como antes; se o servidor reclamar da coluna, também
  reset("professional", {noRevColumn: true}); confirms = []; confirms.answer = true;
  DB.a.rev = undefined; delete DB.a.rev;
  s = openOnDevice();
  check.check("13. Sem a coluna rev a ficha não tem versão", s._rev === null);
  edit(s, "notes", "sem migração");
  ok = await outboxSendOne("a");
  check.check("14. Sem a migração 0035 grava como antes", ok === true && DB.a.notes === "sem migração" && LOG[0].revFilter === undefined);
  reset("professional", {noRevColumn: true}); confirms = []; confirms.answer = true;
  s = openOnDevice(); revColumnAvailable = true; // versão conhecida, mas o servidor recusa a coluna
  edit(s, "notes", "a meio");
  ok = await outboxSendOne("a");
  check.check("15. Se o servidor recusar a coluna rev, grava na mesma e deixa de a usar", ok === true && DB.a.notes === "a meio" && revColumnAvailable === false);
  revColumnAvailable = true;

  // 9. a ficha não pára de mudar: desiste sem perder a alteração
  reset("professional"); confirms = []; confirms.answer = true;
  s = openOnDevice();
  var realFrom = sb.from;
  sb = {from: function(){ var q = realFrom(); var origThen = q.then; q.then = function(res, rej){ if (q.op === "update") DB.a.rev += 1; return origThen(res, rej); }; return q; }};
  edit(s, "notes", "do aparelho A");
  ok = await outboxSendOne("a");
  check.check("16. Se a versão muda sempre, desiste ao fim de 3 tentativas e a alteração fica na fila", ok === false && outboxCount() === 1 && LOG.length <= 4);

})().catch(function(e){ console.error(e); process.exit(1); }).then(function(){ check.summarize(); });
