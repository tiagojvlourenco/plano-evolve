// Horário semanal com contagem automática (o que o script do Google Calendar fazia): sessões do horário, exceções, pacote, aulas extra,
// resumo (valor, total, progresso, em falta, renovação) e importação dos pacotes a decorrer.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var fs = require("fs");
var store = {};
global.localStorage = {getItem: function(k){ return k in store ? store[k] : null; }, setItem: function(k, v){ store[k] = String(v); }, removeItem: function(k){ delete store[k]; }};
function d(n){ return addDaysISO(localTodayISO(), -n); }
var today = localTodayISO();
function reset(){ studio.packs = []; studio.sessions = []; studio.payments = []; studio.slots = []; studio.loaded = true; studio.available = true; studio.slotsAvailable = true; sbReady = false; store = {}; }
function mkStudent(id, name){ return {id: id, name: name, active: true, isDemo: false}; }
function pack(o){ return Object.assign({id: "p1", student_id: "a", name: "Trimestre", total: 6, price: 120, starts_on: d(60), expires_on: addDaysISO(today, 60), missed_consumes: true, late_cancel_consumes: true, used_before: 0}, o || {}); }
function slot(o){ return Object.assign({id: "sl" + Math.random(), student_id: "a", weekday: 2, time: "18:00", counts_from: d(30), generated_until: null}, o || {}); }
// data de um dia da semana (1 = segunda) dentro das últimas 3 semanas
function lastWeekday(wd, back){ var x = today, n = 0; while (isoWeekday(x) !== wd || n < (back || 0) * 7){ x = addDaysISO(x, -1); n++; if (n > 60) break; } return x; }

check.check("1. Dias da semana: 2026-10-13 é terça (2) e 2026-10-18 é domingo (7)", isoWeekday("2026-10-13") === 2 && isoWeekday("2026-10-18") === 7 && isoWeekday("2026-10-12") === 1);
check.check("2. Horas em minutos; formato inválido dá nulo", timeToMinutes("18:30") === 1110 && timeToMinutes("7:5") === null && timeToMinutes("") === null);
check.check("3. A data local tem o formato AAAA-MM-DD", /^\d{4}-\d{2}-\d{2}$/.test(localTodayISO()));

// ---- sessões devidas ----
STUDENTS = [mkStudent("a", "Ana Silva"), mkStudent("b", "Rui Costa")];
reset(); studio.slots = [slot({weekday: isoWeekday(d(10)), time: "18:00", counts_from: d(14)})];
var due = agendaDue({date: today, minutes: 12 * 60});
check.check("4. Contam-se as sessões do horário desde 'contar desde' até hoje (cada semana uma)", due.length >= 2 && due.length <= 3 && due.every(function(x){ return isoWeekday(x.date) === studio.slots[0].weekday; }) && due[0].date < due[due.length - 1].date);
reset(); var wdToday = isoWeekday(today); studio.slots = [slot({weekday: wdToday, time: "18:00", counts_from: today})];
check.check("5. A sessão de hoje só conta depois da hora + 1 hora (18:00 → 19:00)", agendaDue({date: today, minutes: 18 * 60 + 30}).length === 0 && agendaDue({date: today, minutes: 19 * 60}).length === 1);
reset(); studio.slots = [slot({weekday: isoWeekday(d(7)), time: "10:00", counts_from: d(7), generated_until: d(1)})];
check.check("6. 'Contado até' evita repetir o que já se contou", agendaDue({date: today, minutes: 20 * 60}).every(function(x){ return x.date > d(1); }));
reset(); studio.slots = [slot({weekday: isoWeekday(d(7)), time: "10:00", counts_from: d(7)})]; studio.sessions = [{id: "x", student_id: "a", date: d(7), time: "10:00", status: "faltou", pack_id: null}];
check.check("7. Uma exceção já registada (falta, cancelamento) não se conta outra vez", agendaDue({date: today, minutes: 20 * 60}).every(function(x){ return x.date !== d(7); }));
reset(); studio.slots = [slot({weekday: isoWeekday(d(7)), time: "10:00", counts_from: d(7)})]; studio.sessions = [{id: "x", student_id: "a", date: d(7), time: null, status: "feita", pack_id: null}];
check.check("8. Uma sessão registada à mão nesse dia (sem hora) também ocupa o horário", agendaDue({date: today, minutes: 20 * 60}).every(function(x){ return x.date !== d(7); }));
reset(); STUDENTS = [mkStudent("a", "Ana"), {id: "b", name: "Rui", active: false}]; studio.slots = [slot({student_id: "b", weekday: isoWeekday(d(7)), counts_from: d(7)}), slot({student_id: "a", weekday: isoWeekday(d(7)), counts_from: d(7)})];
check.check("9. Alunos inativos não geram sessões", agendaDue({date: today, minutes: 20 * 60}).every(function(x){ return x.slot.student_id === "a"; }) && agendaDue({date: today, minutes: 20 * 60}).length >= 1);
STUDENTS = [mkStudent("a", "Ana Silva"), mkStudent("b", "Rui Costa")];

// ---- geração (modo local) ----
(async function(){
  reset();
  var wd = isoWeekday(d(14));
  studio.packs = [pack({total: 3, starts_on: d(20)})];
  studio.slots = [slot({weekday: wd, time: "07:00", counts_from: d(20)})];
  var n = await studioAutoSessions();
  var made = studio.sessions.filter(function(x){ return x.source === "agenda"; });
  check.check("10. A contagem cria as sessões que já passaram, como feitas e do horário", n === made.length && n >= 2 && made.every(function(x){ return x.status === "feita" && x.time === "07:00" && x.student_id === "a"; }));
  check.check("11. Cada uma desconta ao pacote do aluno", made.slice(0, 3).every(function(x){ return x.pack_id === "p1"; }));
  check.check("12. O horário fica marcado como contado até ontem", studio.slots[0].generated_until === d(1));
  var again = await studioAutoSessions();
  check.check("13. Voltar a correr não duplica nada", again === 0 && studio.sessions.filter(function(x){ return x.source === "agenda"; }).length === made.length);

  // pacote de 3 aulas: a 4.ª sessão do horário já é "aula extra" (sem pacote)
  reset(); studio.packs = [pack({total: 2, starts_on: d(30)})]; studio.slots = [slot({weekday: wd, time: "07:00", counts_from: d(30)})];
  await studioAutoSessions();
  var all = studio.sessions.filter(function(x){ return x.source === "agenda"; }).sort(function(a, b){ return a.date < b.date ? -1 : 1; });
  var withPack = all.filter(function(x){ return x.pack_id === "p1"; }).length, extra = all.filter(function(x){ return !x.pack_id; });
  check.check("14. Esgotado o pacote, as sessões seguintes ficam sem pacote (aulas extra)", withPack === 2 && extra.length === all.length - 2 && all.length >= 3);
  check.check("15. 'Aguarda renovação' + aulas extra com a data da primeira", extrasOf("a", today).n === extra.length && extrasOf("a", today).since === extra[0].date);
  var row = studioSummaryRows(today)[0];
  check.check("16. O resumo marca renovar, com 0 em falta", row.state === "renovar" && row.u.remaining === 0 && row.extras.n === extra.length);

  // o pacote novo desconta as aulas extra
  var np = {id: "p2", student_id: "a", name: "Novo", total: 10, starts_on: extra[0].date, expires_on: addDaysISO(today, 90), missed_consumes: true, late_cancel_consumes: true, used_before: 0};
  studio.packs.push(np);
  var moved = await attachExtrasToPack(np);
  check.check("17. Criar o pacote novo desconta as aulas extra já dadas", moved === extra.length && packUsage(np, today).used === extra.length && extrasOf("a", today).n === 0);
  check.check("18. Já não precisa de renovação", studioSummaryRows(today)[0].state !== "renovar");

  // aulas já dadas antes da app
  reset(); studio.packs = [pack({total: 26, used_before: 9})];
  check.check("19. As aulas já dadas antes da app contam (9 de 26, faltam 17)", packUsage(studio.packs[0], today).used === 9 && packUsage(studio.packs[0], today).remaining === 17);

  // a acabar: limite = frequência semanal (mínimo 2)
  reset(); studio.packs = [pack({total: 26, used_before: 22})]; studio.slots = [slot({weekday: 1}), slot({weekday: 3}), slot({weekday: 5}), slot({weekday: 6})];
  check.check("20. Com 4 aulas por semana, faltando 4 já está a acabar", packUsage(studio.packs[0], today).ending && packUsage(studio.packs[0], today).remaining === 4);
  studio.packs = [pack({total: 26, used_before: 21})];
  check.check("21. Faltando 5 ainda não está a acabar (limite = 4 por semana)", !packUsage(studio.packs[0], today).ending);
  studio.slots = []; studio.packs = [pack({total: 26, used_before: 24, expires_on: null})];
  check.check("22. Sem horário, o limite é de 2 aulas", packUsage(studio.packs[0], today).ending);
  reset(); studio.packs = [pack({total: 10, starts_on: addDaysISO(today, 5), expires_on: addDaysISO(today, 95)})];
  var pr = studioSummaryRows(today)[0];
  check.check("23. Pacote que ainda não começou (já pago) aparece como pendente, sem destaque", pr.state === "pendente" && !packUsage(studio.packs[0], today).ending);

  // resumo ordenado e emblemas
  reset(); STUDENTS = [mkStudent("a", "Ana Silva"), mkStudent("b", "Rui Costa"), mkStudent("c", "Eva Lopes")];
  studio.packs = [pack({id: "pa", student_id: "a", total: 10, used_before: 4}), pack({id: "pb", student_id: "b", total: 10, used_before: 10}), pack({id: "pc", student_id: "c", total: 10, used_before: 9})];
  var rows = studioSummaryRows(today);
  check.check("24. O resumo põe primeiro quem aguarda renovação, depois quem está a acabar", rows.map(function(r){ return r.student.id + ":" + r.state; }).join() === "b:renovar,c:acabar,a:normal");
  check.check("25. O número de alunos a precisar de atenção conta no menu", studioAttentionCount(today) === 2 && /Gestão · 2/.test(gestaoAreaLabel()));

  // ---- importação ----
  var imp = parsePackImport("Nome;Aulas;Início;Valor;Dadas\nAna Silva; 26; 01/10/2026; 520,50; 9\nRui Costa\t13\t2026-09-15\t260\t0\n\nXpto;abc;01/10/2026;1;0\nEva;10;31/02/2026;1;0\nEva Lopes;10;01/10/2026;100;11");
  check.check("26. A importação lê datas dd/mm/aaaa e aaaa-mm-dd, decimais com vírgula, tabulações e ignora o cabeçalho", imp.rows.length === 2 && imp.rows[0].price === 520.5 && imp.rows[0].start === "2026-10-01" && imp.rows[1].start === "2026-09-15" && imp.rows[1].used === 0);
  check.check("27. Linhas inválidas dão erro com o número da linha (aulas, data impossível, dadas > total)", imp.errors.length === 3 && /Linha 5.*Xpto.*número de aulas/.test(imp.errors[0]) && /31\/02|data de início/.test(imp.errors[1]) && /aulas já dadas/.test(imp.errors[2]));
  check.check("28. Nomes: igual sem acentos/maiúsculas, ou primeiro+último nome se for único", matchStudentByName("ana silva").id === "a" && matchStudentByName("Rúi  Costa") && matchStudentByName("Rui Costa").id === "b" && matchStudentByName("Ana Maria Silva").id === "a" && matchStudentByName("Joana") === null);
  reset(); STUDENTS = [mkStudent("a", "Ana Silva"), mkStudent("b", "Rui Costa")];
  var rep = await studioImportPacks("Ana Silva; 26; 01/10/2026; 520; 9\nNinguém Aqui; 10; 01/10/2026; 100; 0\nRui Costa; 13; 15/09/2026; 260; 0");
  check.check("29. Importar cria os pacotes (sem validade por omissão, aulas já dadas, preço) e avisa dos nomes que não encontra", rep.created === 2 && rep.errors.some(function(e){ return /Ninguém Aqui/.test(e); }) && studio.packs.filter(function(p){ return p.student_id === "a"; })[0].used_before === 9 && studio.packs.filter(function(p){ return p.student_id === "a"; })[0].expires_on === null);
  var rep2 = await studioImportPacks("Ana Silva; 26; 01/10/2026; 520; 9");
  reset(); STUDENTS = [mkStudent("a", "Ana Silva")];
  var rep3 = await studioImportPacks("Ana Silva; 26; 01/10/2026; 520; 0; 6\nAna Silva; 13; 01/12/2026; 100; 0; 99");
  check.check("29b. A sexta coluna opcional dá a validade em meses (6 meses → 01/04/2027); fora de 0-36 é erro", rep3.created === 1 && studio.packs[0].expires_on === "2027-04-01" && rep3.errors.some(function(e){ return /validade inválida/.test(e); }));
  reset(); STUDENTS = [mkStudent("a", "Ana Silva"), mkStudent("b", "Rui Costa")];
  await studioImportPacks("Ana Silva; 26; 01/10/2026; 520; 9\nRui Costa; 13; 15/09/2026; 260; 0");
  check.check("30. Importar duas vezes não duplica", rep2.created === 0 && rep2.skipped.length === 1 && studio.packs.length === 2);

  // ---- migração e ecrãs ----
  var mig = fs.readFileSync(__dirname + "/../supabase/migrations/0024_studio_agenda.sql", "utf8");
  check.check("31. A migração 0024 cria os horários só para profissionais e protege duplicados do horário", /create table if not exists session_slots/.test(mig) && /enable row level security/.test(mig) && /exists \(select 1 from professionals where user_id = auth\.uid\(\)\)/.test(mig) && /sessions_agenda_unique on sessions\(student_id, date, time\) where source = 'agenda'/.test(mig) && /unique \(student_id, weekday, time\)/.test(mig));
  check.check("32. A migração é repetível e não apaga dados", /add column if not exists used_before/.test(mig) && !/drop table|drop column|delete from|truncate/i.test(mig));
  reset(); studio.packs = [pack()]; studio.slots = [slot()];
  var tab = tplProSessoes(mkStudent("a", "Ana Silva"));
  check.check("33. A ficha mostra o horário semanal e o campo das aulas já dadas", /Horário semanal/.test(tab) && /Terça 18:00/.test(tab) && /id="slAdd"/.test(tab) && /id="pkUsed"/.test(tab));
  studio.slotsAvailable = false;
  var tab2 = tplProSessoes(mkStudent("a", "Ana Silva"));
  check.check("34. Sem a migração 0024 a ficha continua a funcionar, sem horário nem aulas já dadas", !/Horário semanal/.test(tab2) && !/id="pkUsed"/.test(tab2) && /id="pkAdd"/.test(tab2));
  check.check("35. Sem a migração 0024 não se contam sessões nem se rebenta", (await studioAutoSessions()) === 0);
  check.check("36. O resumo, a agenda e a importação estão ligados ao ecrã Estúdio", /id=\\"studioSummary\\"/.test(appSource) && /id=\\"studioAgenda\\"/.test(appSource) && /id=\\"impGo\\"/.test(appSource) && /studioRefresh\(\)/.test(appSource));
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e && e.stack || e); process.exit(1); });
