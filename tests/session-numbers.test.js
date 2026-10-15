// Número da aula ao lado de cada sessão: posição dentro do pacote (com as aulas já dadas antes da app), nas partilhas conta o conjunto,
// e as previstas (agendadas) levam o número que terão, passando ao pacote seguinte quando o primeiro acaba.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var today = localTodayISO(), d = function(n){ return addDaysISO(today, -n); };
STUDENTS.push({id: "n1", name: "Num Um", isDemo: false, active: true}, {id: "n2", name: "Num Dois", isDemo: false, active: true});
function ses(id, st, back, status, pack){ return {id: id, student_id: st, pack_id: pack || null, date: d(back), time: null, status: status || "feita", source: "calendario"}; }

studio.packs = [{id: "pa", student_id: "n1", name: "13", total: 13, starts_on: d(100), expires_on: null, used_before: 2, missed_consumes: true, late_cancel_consumes: true}];
studio.sessions = [ses("s3", "n1", 10, "feita", "pa"), ses("s1", "n1", 30, "feita", "pa"), ses("s2", "n1", 20, "faltou", "pa")];
var m = sessionNumberMap();
check.check("1. A 1.ª aula dada depois das 2 anteriores à app é a 3.ª (por ordem de data, não de lista)", m.s1.n === 3 && m.s2.n === 4 && m.s3.n === 5 && m.s1.total === 13);
check.check("2. O texto leva «Aula n/total»", /Aula 3\/13/.test(sessionNumberPill(m.s1)) && sessionNumberPill(undefined) === "");

// faltou que não gasta aula: sem número
studio.packs[0].missed_consumes = false;
m = sessionNumberMap();
check.check("3. Uma falta que não gasta aula não leva número e não conta para a seguinte", !m.s2 && m.s3.n === 4);
studio.packs[0].missed_consumes = true;

// partilhado: conta o conjunto
studio.packs = [{id: "pa", student_id: "n1", name: "A", total: 5, starts_on: d(100), expires_on: null, used_before: 0, shared_with: ["n2"], missed_consumes: true, late_cancel_consumes: true}];
studio.sessions = [ses("a1", "n1", 30, "feita", "pa"), ses("b1", "n2", 20, "feita", "pa"), ses("a2", "n1", 10, "feita", "pa")];
m = sessionNumberMap();
check.check("4. Num pacote partilhado a numeração é do conjunto (a 2.ª aula foi do outro aluno)", m.a1.n === 1 && m.b1.n === 2 && m.a2.n === 3);

// previstas: seguem a contagem e passam ao pacote seguinte
studio.packs = [
  {id: "p1", student_id: "n1", name: "P1", total: 4, starts_on: d(100), expires_on: null, used_before: 0, missed_consumes: true, late_cancel_consumes: true},
  {id: "p2", student_id: "n1", name: "P2", total: 3, starts_on: d(50), expires_on: null, used_before: 0, missed_consumes: true, late_cancel_consumes: true}
];
studio.sessions = [ses("d1", "n1", 30, "feita", "p1"), ses("d2", "n1", 20, "feita", "p1"),
  {id: "f1", student_id: "n1", pack_id: null, date: addDaysISO(today, 2), time: null, status: "agendada", source: "folha"},
  {id: "f2", student_id: "n1", pack_id: null, date: addDaysISO(today, 4), time: null, status: "agendada", source: "folha"},
  {id: "f3", student_id: "n1", pack_id: null, date: addDaysISO(today, 6), time: null, status: "agendada", source: "folha"}];
m = sessionNumberMap();
check.check("5. As previstas continuam a numeração (3/4, 4/4) e a seguinte já é a 1.ª do pacote seguinte (1/3)", m.f1.n === 3 && m.f1.total === 4 && m.f2.n === 4 && m.f3.n === 1 && m.f3.total === 3 && m.f1.projected);
studio.packs = []; studio.sessions = [{id: "z", student_id: "n1", pack_id: null, date: addDaysISO(today, 1), time: null, status: "agendada", source: "folha"}];
check.check("6. Sem pacote não há número", sessionNumberMap().z === undefined);
check.summarize();
