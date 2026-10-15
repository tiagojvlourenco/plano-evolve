// Casal com pacotes partilhados: aulas anteriores ao pacote próprio não gastam o pacote do parceiro, o pacote próprio gasta-se primeiro,
// e «reassignSharedPackSessions» corrige as aulas que ficaram ligadas ao pacote errado.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
// ---- casal com pacotes partilhados (a Daniela renova, o Gerson ainda tem 2 aulas) ----
(function(){
  var today = localTodayISO(), d = function(n){ return addDaysISO(today, -n); };
  STUDENTS.push({id: "cd", name: "Dora Casal", isDemo: false, active: true}, {id: "cg", name: "Gil Casal", isDemo: false, active: true});
  var packD = {id: "pD", student_id: "cd", name: "26", total: 26, starts_on: d(120), expires_on: null, used_before: 0, shared_with: ["cg"], missed_consumes: true, late_cancel_consumes: true};
  var packG = {id: "pG", student_id: "cg", name: "13", total: 13, starts_on: d(100), expires_on: null, used_before: 0, shared_with: ["cd"], missed_consumes: true, late_cancel_consumes: true};
  studio.packs = [packG, packD]; studio.sessions = [];
  var n = 0;
  function ses(st, back){ studio.sessions.push({id: "q" + (n++), student_id: st, pack_id: null, date: d(back), time: null, status: "feita", source: "calendario"}); }
  for (var k = 0; k < 26; k++) ses("cd", 120 - k * 4 > 3 ? 120 - k * 4 : 3 + k);      // 26 aulas da Dora, uma de 4 em 4 dias
  ses("cg", 110); ses("cg", 104);                                                    // duas do Gil ANTES de o pacote dele começar (eram de um pacote anterior)
  for (var m = 0; m < 11; m++) ses("cg", 98 - m * 8);                                  // 11 depois do início do pacote dele
  ses("cd", 0);                                                                      // hoje: a Dora, depois de acabar o dela
  studio.sessions.forEach(function(x){ x.pack_id = null; });
  return reassignSharedPackSessions().then(function(){
    var usedD = packUsage(packD, today).used, usedG = packUsage(packG, today).used;
    var early = studio.sessions.filter(function(x){ return x.student_id === "cg" && x.date < packG.starts_on; });
    check.check("2n. As 2 aulas do Gil anteriores ao pacote dele não gastam o pacote da Dora", early.length === 2 && early.every(function(x){ return !x.pack_id; }));
    check.check("2o. O pacote da Dora fica só com as aulas dela (26 de 26) e o do Gil com as dele (11 de 13 + a de hoje da Dora = 12)", usedD === 26 && usedG === 12);
    var todayS = studio.sessions.filter(function(x){ return x.student_id === "cd" && x.date === today; })[0];
    check.check("2p. Sem pacote novo, a aula de hoje da Dora gasta o pacote do Gil (restam 1)", todayS.pack_id === "pG");
    // a Dora renova: a aula de hoje passa para o pacote novo dela e o Gil volta a ter 2
    studio.packs.push({id: "pD2", student_id: "cd", name: "22", total: 22, starts_on: today, expires_on: null, used_before: 0, shared_with: ["cg"], missed_consumes: true, late_cancel_consumes: true});
    return reassignSharedPackSessions().then(function(){
      var t2 = studio.sessions.filter(function(x){ return x.student_id === "cd" && x.date === today; })[0];
      check.check("2q. Com o pacote novo da Dora, a aula de hoje conta nele e o Gil volta a ter 2 aulas por dar", t2.pack_id === "pD2" && packUsage(packG, today).remaining === 2);
    });
  });
})().then(function(){ check.summarize(); });
