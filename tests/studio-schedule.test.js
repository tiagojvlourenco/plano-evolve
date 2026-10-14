// Sessões "agendadas" (datas previstas da folha): importar, não gastar aulas, e passar a feita/faltou quando o Google Agenda as traz.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var fs = require("fs");
var store = {};
global.localStorage = {getItem: function(k){ return k in store ? store[k] : null; }, setItem: function(k, v){ store[k] = String(v); }, removeItem: function(k){ delete store[k]; }};
var today = localTodayISO();
function d(n){ return addDaysISO(today, n); }
function pt(iso){ return iso.slice(8) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4); }
function reset(){ sbReady = false; studio.packs = []; studio.sessions = []; studio.payments = []; studio.slots = []; studio.loaded = true; studio.available = true; studio.slotsAvailable = true; }
STUDENTS = [{id: "a", name: "Isabel Carvalho", active: true}, {id: "b", name: "Mãe + Pai", active: true}];

(async function(){
  reset();
  var p = parseScheduleImport("Isabel Carvalho; " + pt(d(2)) + "; " + pt(d(5)) + "; 2026/12/31\nMãe + Pai\t" + pt(d(3)) + "\n\nSemDatas; abc\nSó o nome");
  check.check("1. A importação lê 'Nome; data; data…' (dd/mm/aaaa, aaaa/mm/dd, tabulações) e dá erro nas linhas sem datas ou sem ';'", p.rows.length === 2 && p.rows[0].dates.length === 3 && p.rows[0].dates[2] === "2026-12-31" && p.rows[1].name === "Mãe + Pai" && p.errors.length === 2);
  var imp = parseImportDate("2026/10/09");
  check.check("2. O formato aaaa/mm/dd da folha é aceite", imp === "2026-10-09" && parseImportDate("09/10/2026") === "2026-10-09" && parseImportDate("2026-10-09") === "2026-10-09" && parseImportDate("31/02/2026") === null);
  var rep = await studioImportSchedule("Isabel Carvalho; " + [d(2), d(5), d(5), d(-3)].map(pt).join("; ") + "\nNinguém; " + pt(d(1)));
  var mine = studio.sessions.filter(function(x){ return x.student_id === "a"; });
  check.check("3. Cria as sessões agendadas (incluindo duas no mesmo dia e datas passadas), sem pacote, e avisa dos nomes que não encontra", rep.created === 4 && mine.length === 4 && mine.every(function(x){ return x.status === "agendada" && x.source === "folha" && x.pack_id === null; }) && rep.errors.some(function(e){ return /Ninguém/.test(e); }));
  var rep2 = await studioImportSchedule("Isabel Carvalho; " + [d(2), d(5), d(5), d(-3)].map(pt).join("; "));
  check.check("4. Importar duas vezes não duplica (conta as que já existem em cada dia)", rep2.created === 0 && rep2.skipped === 4 && studio.sessions.length === 4);
  studio.packs = [{id: "pk", student_id: "a", name: "Pacote", total: 10, price: 0, starts_on: d(-30), expires_on: null, used_before: 0, missed_consumes: true, late_cancel_consumes: true}];
  check.check("5. Uma sessão agendada não gasta aulas do pacote", packUsage(studio.packs[0], today).used === 0 && sessionConsumes(studio.packs[0], mine[0]) === false);
  check.check("6. A data já passada aparece como 'por confirmar'; a futura só como 'Agendada'", /por confirmar/.test(sessionStatusPill("agendada", d(-3))) && !/por confirmar/.test(sessionStatusPill("agendada", d(2))) && /Feita/.test(sessionStatusPill("feita", d(-3))));
  var tab = tplProSessoes(STUDENTS[0]);
  check.check("7. A ficha mostra 'Próximas sessões agendadas' (só as de hoje em diante) e a de ontem fica em 'recentes'", /Próximas sessões agendadas · 3/.test(tab) && /Sessões recentes/.test(tab) && /por confirmar/.test(tab));

  // o Google Agenda traz o evento desse dia: a sessão agendada converte-se, sem criar outra
  var ev = function(id, title, date, time, color){ return {id: id, title: title, date: date, time: time, colorId: color || "10", cancelled: false}; };
  var win = {from: d(-30), to: today};
  var plan = planCalendarSync({events: [ev("e1", "PT 60 - Isabel Carvalho", d(-3), "10:00"), ev("e2", "PT 60 - Isabel Carvalho", d(-3), "12:00", "11")], today: today, window: win, aliases: {}, ignored: {}, prefix: "PT"});
  var planned = studio.sessions.filter(function(x){ return x.date === d(-3); });
  check.check("8. Um evento desse dia converte a sessão agendada (feita) em vez de criar outra; um 2.º evento no mesmo dia cria uma nova", plan.update.length === 1 && plan.update[0].id === planned[0].id && plan.update[0].patch.status === "feita" && plan.update[0].patch.source === "calendario" && plan.update[0].patch.external_id === "e1" && plan.update[0].patch.time === "10:00" && plan.insert.length === 1 && plan.insert[0].external_id === "e2");
  var plan2 = planCalendarSync({events: [ev("e3", "PT 60 - Isabel Carvalho", d(-3), "10:00")], today: today, window: win, aliases: {}, ignored: {}, prefix: "PT"});
  var plan3 = planCalendarSync({events: [], today: today, window: win, aliases: {}, ignored: {}, prefix: "PT"});
  check.check("9. Sem evento, a sessão agendada fica como está (a sincronização nunca apaga as da folha)", plan3.remove.length === 0 && plan2.insert.length === 0);
  var res = await applyCalendarPlan(plan);
  var conv = studio.sessions.filter(function(x){ return x.external_id === "e1"; })[0];
  check.check("10. Ao converter, a sessão passa a gastar uma aula do pacote certo; a falta também", res.errors === 0 && conv && conv.status === "feita" && conv.pack_id === "pk" && conv.source === "calendario" && studio.sessions.filter(function(x){ return x.external_id === "e2"; })[0].status === "faltou" && packUsage(studio.packs[0], today).used === 2);
  // confirmar à mão
  var fut = studio.sessions.filter(function(x){ return x.date === d(2); })[0];
  var r3 = await studioSetSessionStatus(fut, "feita");
  var after = studio.sessions.filter(function(x){ return x.id === fut.id; })[0];
  check.check("11. Marcar uma agendada como feita à mão passa-a a manual e desconta ao pacote", !r3.error && after.status === "feita" && after.source === "manual" && after.pack_id === "pk");
  var mig = fs.readFileSync(__dirname + "/../supabase/migrations/0027_sessions_agendadas.sql", "utf8");
  check.check("12. A migração 0027 aceita 'agendada' e 'folha' sem apagar dados (repetível)", /'agendada', 'feita', 'faltou', 'cancelada', 'cancelada_tarde'/.test(mig) && /'manual', 'agenda', 'calendario', 'folha'/.test(mig) && /like '%cancelada_tarde%'/.test(mig) && !/delete from|truncate|drop table/i.test(mig));
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e && e.stack || e); process.exit(1); });
