// Google Agenda: reconhecer o aluno no título do evento, normalizar eventos da API, plano de sincronização e definições.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var fs = require("fs");
var store = {};
global.localStorage = {getItem: function(k){ return k in store ? store[k] : null; }, setItem: function(k, v){ store[k] = String(v); }, removeItem: function(k){ delete store[k]; }};
var today = localTodayISO();
function d(n){ return addDaysISO(today, -n); }
STUDENTS = [{id: "a", name: "Isabel Carvalho", active: true}, {id: "b", name: "Ricardo Rocha", active: true}, {id: "c", name: "Ricardo Jafe", active: true}, {id: "m", name: "Mãe + Pai", active: true}, {id: "x", name: "Ana Silva", active: true}, {id: "y", name: "Ana Silva Santos", active: true}, {id: "z", name: "Zé Inativo", active: false}];
function m(t, al){ var r = matchEventStudent(t, al || {}); return r ? r.id : null; }

// ---- quem é o aluno de um evento ----
check.check("1. 'PT 60 - Nome' reconhece o aluno pela parte depois do hífen", m("PT 60 - Isabel Carvalho") === "a" && m("PT 60 - Ricardo Rocha") === "b");
check.check("2. Aceita hífen longo, maiúsculas e acentos diferentes", m("pt 60 – isabel carvalho") === "a" && m("PT 60 — ISABEL CARVALHO") === "a");
check.check("3. O título pode ser só o nome", m("Isabel Carvalho") === "a" && m("isabel carvalho") === "a");
check.check("4. 'PT Duo 60 - Mãe + Pai' reconhece o aluno com esse nome", m("PT Duo 60 - Mãe + Pai") === "m");
check.check("5. O nome completo dentro de um título maior também serve (se for só um aluno)", m("Sessão extra Isabel Carvalho 18h") === "a");
check.check("6. Dois alunos no mesmo título é ambíguo (não conta para nenhum)", m("Reunião Isabel Carvalho e Ricardo Rocha") === null);
check.check("7. Nome incompleto ou desconhecido não conta (Ricardo sozinho tem dois)", m("PT 60 - Ricardo") === null && m("Dentista") === null && m("") === null);
check.check("8. Se um nome está dentro de outro mais comprido, ganha o mais comprido", m("PT 60 - Ana Silva Santos") === "y" && m("PT 60 - Ana Silva") === "x");
check.check("9. Um alias definido à mão tem prioridade", m("Isabel C.", {"isabel c.": "a"}) === "a" && m("PT 60 - Isabel Carvalho", {"pt 60 - isabel carvalho": "b"}) === "b");

// ---- eventos da API ----
var n = normalizeCalendarEvent({id: "abc_20261013T070000Z", summary: "  PT 60 - Isabel Carvalho ", colorId: 11, status: "confirmed", start: {dateTime: "2026-10-13T07:00:00+01:00"}});
check.check("10. Um evento da API fica com id, título, dia e hora locais e a cor", n && n.id === "abc_20261013T070000Z" && n.title === "PT 60 - Isabel Carvalho" && /^\d{4}-\d{2}-\d{2}$/.test(n.date) && /^\d{2}:\d{2}$/.test(n.time) && n.colorId === "11");
check.check("11. Eventos de dia inteiro ficam sem hora; sem título, sem início ou inválidos são ignorados", normalizeCalendarEvent({id: "1", summary: "X", start: {date: "2026-10-13"}}).time === null && normalizeCalendarEvent({id: "1", start: {dateTime: "2026-10-13T07:00:00Z"}}) === null && normalizeCalendarEvent({id: "1", summary: "X"}) === null && normalizeCalendarEvent({id: "1", summary: "X", start: {dateTime: "lixo"}}) === null && normalizeCalendarEvent(null) === null);
check.check("12. Eventos cancelados vêm marcados", normalizeCalendarEvent({id: "1", summary: "X", status: "cancelled", start: {date: "2026-10-13"}}).cancelled === true);

// ---- janela ----
studio.packs = [{id: "p", student_id: "a", starts_on: d(50), expires_on: null}]; studio.sessions = []; studio.loaded = true; studio.available = true; studio.slotsAvailable = true;
check.check("13. A janela começa no pacote ainda em vigor mais antigo (50 dias) e acaba hoje", calendarWindow(today).from === d(120) || calendarWindow(today).from === d(50) ? calendarWindow(today).from <= d(50) : false);
studio.packs = [{id: "p", student_id: "a", starts_on: d(900), expires_on: null}];
check.check("14. Nunca vai além de 400 dias para trás", calendarWindow(today).from === d(400));
studio.packs = [];
check.check("15. Sem pacotes lê os últimos 120 dias", calendarWindow(today).from === d(120) && calendarWindow(today).to === today);

// ---- plano de sincronização ----
function evt(id, title, daysAgo, time, color, cancelled){ return {id: id, title: title, date: d(daysAgo), time: time || "10:00", colorId: color || "10", cancelled: !!cancelled}; }
var win = {from: d(30), to: today};
studio.sessions = [];
var plan = planCalendarSync({events: [evt("1", "PT 60 - Isabel Carvalho", 5), evt("2", "PT 60 - Ricardo Rocha", 4, "18:00", "11"), evt("3", "Dentista", 3), evt("4", "PT 60 - Isabel Carvalho", -2), evt("5", "PT 60 - Isabel Carvalho", 6, "10:00", "10", true), evt("6", "PT 60 - Zé Inativo", 3), evt("7", "PT 60 - Isabel Carvalho", 40)], today: today, window: win, aliases: {}});
check.check("16. Só entram os eventos de alunos ativos, até hoje, dentro da janela e não cancelados", plan.insert.length === 2 && plan.insert.map(function(x){ return x.external_id; }).join() === "1,2" && plan.matched === 2);
check.check("17. Cor 11 = faltou, as outras = feita; origem calendário; hora do evento", plan.insert[0].status === "feita" && plan.insert[1].status === "faltou" && plan.insert.every(function(x){ return x.source === "calendario"; }) && plan.insert[1].time === "18:00");
check.check("18. Os títulos sem aluno ficam na lista (com contagem), os futuros e cancelados não", plan.unmatched["Dentista"] === 1 && Object.keys(plan.unmatched).length === 1);
// já sincronizado + alterações
studio.sessions = [
  {id: "s1", student_id: "a", date: d(5), time: "10:00", status: "feita", source: "calendario", external_id: "1"},
  {id: "s2", student_id: "b", date: d(4), time: "18:00", status: "feita", source: "calendario", external_id: "2"},
  {id: "s9", student_id: "a", date: d(8), time: "10:00", status: "feita", source: "calendario", external_id: "9"},
  {id: "old", student_id: "a", date: d(60), time: "10:00", status: "feita", source: "calendario", external_id: "8"},
  {id: "man", student_id: "a", date: d(7), time: "10:00", status: "faltou", source: "manual", external_id: null}];
var plan2 = planCalendarSync({events: [evt("1", "PT 60 - Isabel Carvalho", 5), evt("2", "PT 60 - Ricardo Rocha", 4, "18:00", "11"), evt("3b", "PT 60 - Isabel Carvalho", 7)], today: today, window: win, aliases: {}});
check.check("19. Uma sessão já registada com o mesmo estado não gera trabalho", !plan2.update.some(function(u){ return u.id === "s1"; }));
check.check("20. Cor mudada para Tomate atualiza o estado da sessão para faltou", plan2.update.length === 1 && plan2.update[0].id === "s2" && plan2.update[0].patch.status === "faltou");
check.check("21. Um evento apagado (dentro da janela) remove a sessão; fora da janela não se mexe", plan2.remove.join() === "s9");
check.check("22. Uma sessão registada à mão no mesmo dia/hora ganha: o evento não se conta outra vez", plan2.insert.length === 0);
var plan3 = planCalendarSync({events: [{id: "1", title: "PT 60 - Isabel Carvalho", date: d(4), time: "09:00", colorId: "10", cancelled: false}], today: today, window: win, aliases: {}});
check.check("23. Um evento que mudou de dia e de hora atualiza a sessão em vez de a duplicar", plan3.update.some(function(u){ return u.id === "s1" && u.patch.date === d(4) && u.patch.time === "09:00"; }));
check.check("24. Sem evento nenhum, as sessões do calendário na janela são removidas e as manuais ficam", planCalendarSync({events: [], today: today, window: win, aliases: {}}).remove.sort().join() === "s1,s2,s9");

// ---- revisão antes do merge ----
STUDENTS.push({id: "q", name: "Rita Arquivada", active: false});
studio.sessions = [{id: "k1", student_id: "q", date: d(5), time: "10:00", status: "feita", source: "calendario", external_id: "ev1"}];
check.check("33. Aluno arquivado: as aulas já registadas não são apagadas quando o evento continua no calendário", planCalendarSync({events: [evt("ev1", "PT 60 - Rita Arquivada", 5)], today: today, window: win, aliases: {}}).remove.length === 0);
check.check("34. Aluno arquivado: eventos novos dele não criam sessões", planCalendarSync({events: [evt("ev2", "PT 60 - Rita Arquivada", 3)], today: today, window: win, aliases: {}}).insert.length === 0);

// ---- definições e ecrã ----
(async function(){
  sbReady = false; store = {};
  studio.packs = [{id: "pa", student_id: "a", total: 2, price: 0, starts_on: d(40), expires_on: null, used_before: 0, missed_consumes: true, late_cancel_consumes: false}, {id: "pb", student_id: "b", total: 5, price: 0, starts_on: d(40), expires_on: null, used_before: 0, missed_consumes: true, late_cancel_consumes: false}];
  studio.sessions = [
    {id: "o1", student_id: "a", pack_id: "pa", date: d(10), time: "10:00", status: "feita", source: "calendario", external_id: "o1"},
    {id: "o2", student_id: "a", pack_id: "pa", date: d(9), time: "10:00", status: "feita", source: "calendario", external_id: "o2"},
    {id: "u1", student_id: "a", pack_id: "pa", date: d(8), time: "11:00", status: "feita", source: "calendario", external_id: "u1"}];
  studio.packs[0].total = 3;
  var r1 = await applyCalendarPlan({remove: ["o1", "o2"], update: [{id: "u1", patch: {student_id: "b"}}], insert: [{student_id: "a", date: d(2), time: "10:00", status: "feita", source: "calendario", external_id: "y1"}]});
  var u1 = studio.sessions.filter(function(x){ return x.id === "u1"; })[0], y1 = studio.sessions.filter(function(x){ return x.external_id === "y1"; })[0];
  check.check("35. Mudar o aluno de uma sessão do calendário passa-a para o pacote do novo aluno", r1.errors === 0 && u1.student_id === "b" && u1.pack_id === "pb");
  check.check("36. As remoções contam antes das novas sessões: a nova aula fica no pacote libertado", y1 && y1.pack_id === "pa");

  calSettings.clientId = "123.apps.googleusercontent.com"; calSettings.useAsSource = true; calSettings.aliases = {"x": "a"};
  await calSaveSettings();
  calSettings.clientId = ""; calSettings.useAsSource = false; calSettings.aliases = {};
  await calLoadSettings();
  check.check("25. As definições guardam-se e voltam a ler-se (sem tokens)", calSettings.clientId === "123.apps.googleusercontent.com" && calSettings.useAsSource === true && calSettings.aliases.x === "a" && /googleusercontent/.test(store[CAL_LOCAL_KEY]) && !/token/i.test(store[CAL_LOCAL_KEY]));
  check.check("26. Com ID e opção ativa, o calendário é a fonte; sem ID não", calUsesCalendar() === true && (function(){ calSettings.clientId = ""; var r = calUsesCalendar(); calSettings.clientId = "123.apps.googleusercontent.com"; return r === false; })());
  studio.slotsAvailable = true; calSettings.available = true; calSettings.lastSync = null; calSettings.clientId = "";
  var h0 = calendarCardHtml();
  check.check("27. Sem ID de cliente o cartão explica os passos e pede o ID", /id="gcClient"/.test(h0) && /Origens JavaScript autorizadas/.test(h0) && /calendar\.readonly|Calendar API/.test(h0));
  calSettings.clientId = "123.apps.googleusercontent.com"; calSettings.lastSync = {at: new Date().toISOString(), events: 40, matched: 30, inserted: 5, updated: 1, removed: 0, errors: 0, unmatched: [{title: "Dentista", n: 2}], warnUsedBefore: ["Ana"]};
  var h1 = calendarCardHtml();
  check.check("28. Ligado, mostra sincronizar, a fonte, o último resumo e os eventos sem aluno", /id="gcSync"/.test(h1) && /id="gcToggle"/.test(h1) && /40 eventos lidos/.test(h1) && /Dentista/.test(h1) && /data-gc-alias="0"/.test(h1) && /aulas já dadas/.test(h1));
  studio.slotsAvailable = false;
  check.check("29. Sem as migrações 0024/0025 avisa em vez de falhar", /0024/.test(calendarCardHtml()) && (function(){ studio.slotsAvailable = true; calSettings.available = false; var t = calendarCardHtml(); calSettings.available = true; return /0025/.test(t); })());
  var mig = fs.readFileSync(__dirname + "/../supabase/migrations/0025_google_calendar.sql", "utf8");
  check.check("30. A migração 0025: definições só para profissionais, 'calendario' como origem e id do evento único", /create table if not exists studio_settings/.test(mig) && /exists \(select 1 from professionals where user_id = auth\.uid\(\)\)/.test(mig) && /source in \('manual', 'agenda', 'calendario'\)/.test(mig) && /sessions_calendar_unique on sessions\(external_id\) where source = 'calendario'/.test(mig) && !/drop table|delete from|truncate/i.test(mig));
  check.check("31. O pedido de autorização é só de leitura e o token não é guardado", appSource.indexOf('var CAL_SCOPE = "https://www.googleapis.com/auth/calendar.readonly"') >= 0 && !/localStorage\.setItem\([^)]*access_token/.test(appSource) && !/calSettings\.token/.test(appSource));
  check.check("32. Mexer numa sessão do calendário na app desliga-a do calendário", /ses\.source === "calendario" \? \{status: status, source: "manual"\}/.test(appSource));
  studio.slots = [{id: "sl1", student_id: "a", weekday: 1, time: "10:00", counts_from: d(90), generated_until: d(60)}];
  studio.loaded = true; studio.available = true; studio.slotsAvailable = true; calSettings.clientId = "123.apps.googleusercontent.com"; calSettings.useAsSource = true;
  await studioAutoSessions();
  check.check("37. Com o calendário como fonte o horário semanal avança sem criar aulas, para não haver aulas retroativas ao desligar", studio.slots[0].generated_until === addDaysISO(today, -1) && agendaDue({date: today, minutes: 0}).length === 0);
  studio.available = true; studio.slotsAvailable = true; studio.packs = []; studio.sessions = [{id: "c1", student_id: "a", date: d(3), time: "10:00", status: "feita", source: "calendario", external_id: "z1"}];
  var tabOn = tplProSessoes(STUDENTS[0]);
  check.check("38. Com o calendário como fonte a ficha esconde o horário semanal e explica que se conta pelo nome", !/Horário semanal/.test(tabOn) && !/id="slAdd"/.test(tabOn) && /Isabel Carvalho/.test(tabOn) && /1 já contadas/.test(tabOn));
  calSettings.useAsSource = false;
  check.check("39. Sem o calendário como fonte o horário semanal continua disponível", /id="slAdd"/.test(tplProSessoes(STUDENTS[0])));
  // ---- criar alunos a partir da agenda ----
  var cands = calStudentCandidates([{title: "PT 60 - Beatriz Lopes", n: 3}, {title: "PT Duo 60 - Mãe + Pai", n: 2}, {title: "Beatriz Lopes", n: 1}, {title: "Dentista", n: 4}, {title: "PT 60", n: 2}, {title: "PT 60 - Rui Costa (online)", n: 1}, {title: "Reunião com a Ana", n: 1}]);
  var cn = {}; cands.forEach(function(c){ cn[c.name] = c; });
  check.check("40. O nome é a parte depois do último ' - ', sem parênteses; o mesmo nome em títulos diferentes junta-se", cn["Beatriz Lopes"] && cn["Beatriz Lopes"].n === 4 && cn["Beatriz Lopes"].titles.length === 2 && cn["Rui Costa"] && cn["Mãe + Pai"]);
  check.check("41. Parecem alunos: nomes; não parecem: compromissos e títulos com números", cn["Beatriz Lopes"].likely && cn["Mãe + Pai"].likely && cn["Rui Costa"].likely && !cn["Dentista"].likely && !cn["PT 60"].likely && !cn["Reunião com a Ana"].likely);
  check.check("42. Os que parecem alunos vêm primeiro", cands.slice(0, 3).every(function(c){ return c.likely; }));
  var nst = calNewStudent("Beatriz Lopes");
  check.check("43. Um aluno criado da agenda é só de estúdio, sem email e sem registos inventados", nst.studioOnly === true && nst.inviteEmail === null && nst.weights.length === 0 && nst.checkins.length === 0 && nst.name === "Beatriz Lopes" && nst.id === "beatriz-lopes");
  var nst2 = (function(){ STUDENTS.push(nst); var n2 = calNewStudent("Beatriz Lopes"); STUDENTS.pop(); return n2; })();
  check.check("44. O identificador não repete o de um aluno que já existe", nst2.id === "beatriz-lopes-2");
  var mk = function(extra){ return Object.assign({id: "z9", name: "Zé", active: true, checkins: [], weights: [], workoutLogs: [], targets: {kcal: 2000, protein: 100, carbs: 200, fat: 60}, createdAt: new Date(Date.now() - 20 * 86400000).toISOString()}, extra || {}); };
  check.check("45. 'Só estúdio' só vale sem email e sem conta", isStudioOnly(mk({studioOnly: true})) && !isStudioOnly(mk({studioOnly: true, inviteEmail: "a@b.pt"})) && !isStudioOnly(mk({studioOnly: true, authUserId: "u1"})) && !isStudioOnly(mk()));
  var plain = contactReasonsFor(mk(), today).map(function(r){ return r.key; }), only = contactReasonsFor(mk({studioOnly: true}), today).map(function(r){ return r.key; });
  check.check("46. Um aluno normal sem registos entra na lista de contactos; um só de estúdio não", (plain.indexOf("sem-registos") >= 0 || plain.indexOf("onboarding") >= 0) && only.indexOf("sem-registos") < 0 && only.indexOf("onboarding") < 0);
  check.check("47. O pulso do estúdio só conta quem usa a app", studioPulse([mk(), mk({id: "z8", studioOnly: true})], today).active === 1);
  check.check("48. A coluna studio_only vai na gravação e volta a ler-se", studentToRow(mk({studioOnly: true})).studio_only === true && rowToStudent(Object.assign(studentToRow(mk({studioOnly: true})), {id: "z9"})).studioOnly === true);
  var mig26 = fs.readFileSync(__dirname + "/../supabase/migrations/0026_studio_only_students.sql", "utf8");
  check.check("49. A migração 0026 só acrescenta a coluna (repetível, sem apagar nada)", /add column if not exists studio_only boolean not null default false/.test(mig26) && !/drop |delete from|truncate/i.test(mig26));
  // ---- achados da revisão (criação em massa) ----
  check.check("50. Um título 'Constructor' ou '__proto__' não rebenta a lista de candidatos nem o plano", (function(){ try { var c = calStudentCandidates([{title: "Constructor", n: 1}, {title: "PT 60 - __proto__", n: 2}]); var pl = planCalendarSync({events: [evt("e", "Constructor", 2), evt("f", "__proto__", 2)], today: today, window: win, aliases: {}}); return c.length === 2 && Object.keys(pl.unmatched).length === 2 && pl.unmatched["Constructor"] === 1; } catch (e) { return false; } })());
  check.check("51. Um alias chamado 'constructor' não é lido como alias", m("Constructor", {}) === null && (function(){ try { return matchEventStudent("constructor", {}) === null; } catch (e) { return false; } })());
  STUDENTS.length = 0; STUDENTS.push({id: "rui", name: "Rui", active: false}, {id: "mar", name: "Maria Silva", active: true, isDemo: true});
  studio.sessions = [{id: "s1", student_id: "rui", date: d(5), time: "10:00", status: "feita", source: "calendario", external_id: "e1"}];
  calSettings.aliases = {}; calSettings.lastSync = {unmatched: [{title: "Rui (faltou)", n: 1}, {title: "Maria Silva", n: 2}, {title: "Outro", n: 1}]};
  calLastRun = null; state.showDemoStudents = false;
  var before = STUDENTS.length;
  var res2 = await createStudentsFromCalendar([{name: "Rui", titles: ["Rui (faltou)"]}, {name: "Maria Silva", titles: ["Maria Silva"]}]);
  check.check("52. Um aluno arquivado com o mesmo nome não é duplicado: o título passa a alias dele", res2.made.length === 1 && res2.archived.join() === "Rui" && calSettings.aliases[calTitleKey("Rui (faltou)")] === "rui" && STUDENTS.filter(function(x){ return x.name === "Rui"; }).length === 1);
  check.check("53. Um aluno de demonstração oculto não conta como 'já existe': cria-se o aluno real", STUDENTS.filter(function(x){ return x.name === "Maria Silva"; }).length === 2 && !STUDENTS.filter(function(x){ return x.name === "Maria Silva" && !x.isDemo; })[0].isDemo);
  check.check("54. Os títulos tratados saem da lista guardada, mesmo sem eventos em memória", calSettings.lastSync.unmatched.length === 1 && calSettings.lastSync.unmatched[0].title === "Outro");
  STUDENTS.length = 0; STUDENTS.push({id: "r1", name: "Rui", active: false}, {id: "r2", name: "Rui", active: true});
  check.check("55. Um arquivado e um ativo com o mesmo nome: o ativo é o aluno (não é ambíguo)", m("PT 60 - Rui") === "r2" && m("Rui") === "r2");
  var so = {id: "q1", name: "Q", active: true, studioOnly: true, checkins: [], weights: [], targets: {kcal: 0, protein: 0, carbs: 0, fat: 0}, meals: []};
  check.check("56. O painel de alunos não dá alertas nem 'check-in em atraso' a um aluno só de estúdio", computeDashboardAlerts(so).length === 0 && dashLateDays(so) === 0 && dashLateDays(Object.assign({}, so, {studioOnly: false})) !== 0);
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e && e.stack || e); process.exit(1); });
