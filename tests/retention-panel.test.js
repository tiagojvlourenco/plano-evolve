// Painel de retenção do profissional: quem contactar hoje, registo de contactos, WhatsApp, onboarding e pulso do estúdio.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var fs = require("fs");

var today = todayISO();
function iso(daysAgo){ return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10); }
function clone(s){ return JSON.parse(JSON.stringify(s)); }
// um aluno com registos de hoje, sem motivo nenhum para contactar
function healthy(id, name){
  var s = clone(buildFullDemoStudent());
  s.id = id; s.name = name; s.isDemo = false; s.active = true; s.contactLog = [];
  s.planHistory = [{date: iso(3), type: "macros", summary: "x"}];
  s.workoutLogs = [{id: "l1", date: iso(1), dayId: "d", dayName: "A", entries: [{name: "X", sets: [{reps: 8, load: 10}]}]}];
  s.checkins = [{date: iso(1), weight: 70, adherence: 7, energy: 6, hunger: 5}];
  s.weights = [{date: iso(1), w: 70}, {date: iso(8), w: 71}];
  return s;
}
function keys(s){ return contactReasonsFor(s, today).map(function(r){ return r.key; }); }

// ---------- telefone e WhatsApp ----------
check.check("1. Telemóvel português de 9 dígitos ganha o indicativo 351", normalizePhone("912 345 678").digits === "351912345678" && normalizePhone("912 345 678").ok);
check.check("2. Números com + ou 00 mantêm o país indicado", normalizePhone("+44 7700 900123").digits === "447700900123" && normalizePhone("0044 7700 900123").digits === "447700900123");
check.check("3. Números curtos ou vazios são inválidos", !normalizePhone("12345").ok && !normalizePhone("").ok && !normalizePhone(null).ok);
check.check("4. O link do WhatsApp leva o número e a mensagem codificada", whatsappUrl("912345678", "Olá, Ana!") === "https://wa.me/351912345678?text=Ol%C3%A1%2C%20Ana!");
check.check("5. Sem telefone válido não há link", whatsappUrl("abc", "x") === "");
check.check("6. A mensagem usa o primeiro nome do aluno", contactMessageFor("sem-registos", {name: "Maria Silva Santos"}).indexOf("Olá Maria!") === 0 && contactMessageFor("sem-registos", {name: "Maria Silva"}).indexOf("{nome}") < 0);
check.check("7. Há mensagem para todos os motivos", Object.keys(CONTACT_REASONS).every(function(k){ return /\{nome\}/.test(CONTACT_REASONS[k].template); }));

// ---------- motivos ----------
var ok = healthy("ok", "Aluno Bem");
check.check("8. Um aluno com tudo em dia só tem, no máximo, boas notícias (peso sem alerta)", keys(ok).every(function(k){ return ["boa-noticia", "estagnado"].indexOf(k) >= 0; }));
var gone = healthy("gone", "Aluno Sumido"); gone.workoutLogs = []; gone.checkins = [{date: iso(20), weight: 70, adherence: 7}]; gone.weights = [{date: iso(20), w: 70}];
check.check("9. Sem registos há 20 dias é motivo crítico (peso 90)", contactReasonsFor(gone, today)[0].key === "sem-registos" && contactReasonsFor(gone, today)[0].weight === 90);
state.pendingHelp = {gone: 2};
check.check("10. Pedidos de ajuda por tratar passam à frente de tudo (peso 100)", contactReasonsFor(gone, today)[0].key === "pedido-ajuda" && /2 pedidos/.test(contactReasonsFor(gone, today)[0].label));
state.pendingHelp = {};
var late = healthy("late", "Aluno Atrasado"); late.checkins = [{date: iso(12), weight: 70, adherence: 7}];
check.check("11. Check-in com mais de 10 dias (mas com treinos) é motivo", keys(late).indexOf("sem-checkin") >= 0);
var oldPlan = healthy("op", "Plano Velho"); oldPlan.planHistory = [{date: iso(60), type: "macros", summary: "x"}];
check.check("12. Plano sem ajustes há mais de 6 semanas é motivo", keys(oldPlan).indexOf("plano-antigo") >= 0);
var bday = healthy("bd", "Faz Anos"); bday.birthDate = "1990-" + today.slice(5);
check.check("13. O aniversário aparece no dia certo", keys(bday).indexOf("aniversario") >= 0 && keys(ok).indexOf("aniversario") < 0);
check.check("14. Os motivos vêm do mais para o menos urgente", (function(){ var r = contactReasonsFor(gone, today); return r.every(function(x, i){ return i === 0 || r[i - 1].weight >= x.weight; }); })());

// ---------- fila ----------
var inactive = healthy("in", "Inativo"); inactive.active = false; inactive.workoutLogs = []; inactive.checkins = []; inactive.weights = [];
var recent = clone(gone); recent.id = "rec"; recent.name = "Contactado Há Pouco"; recent.contactLog = [{date: iso(1), kind: "contacto", channel: "whatsapp", reason: "sem-registos"}];
var snoozed = clone(gone); snoozed.id = "sn"; snoozed.name = "Adiado"; snoozed.contactLog = [{date: iso(1), kind: "adiado", reason: "sem-registos", until: addDaysISO(today, 6)}];
var oldContact = clone(gone); oldContact.id = "oc"; oldContact.name = "Contactado Há Muito"; oldContact.contactLog = [{date: iso(10), kind: "contacto", channel: "telefone", reason: "sem-registos"}];
var q = computeContactQueue([ok, gone, inactive, recent, snoozed, oldContact], today);
var names = q.items.map(function(i){ return i.s.id; });
check.check("15. A fila só tem quem precisa de contacto (e nunca inativos)", names.indexOf("gone") >= 0 && names.indexOf("in") < 0 && names.indexOf("ok") < 0);
check.check("16. Quem foi contactado há menos de 3 dias fica de fora", names.indexOf("rec") < 0 && q.recent === 1);
check.check("17. Quem foi adiado fica de fora até à data", names.indexOf("sn") < 0 && q.snoozed === 1);
check.check("18. Um contacto antigo (10 dias) não esconde o aluno", names.indexOf("oc") >= 0);
state.pendingHelp = {rec: 1};
check.check("19. Um pedido de ajuda urgente volta a mostrar quem foi contactado há pouco", computeContactQueue([recent], today).items.length === 1);
state.pendingHelp = {};
var many = []; for (var i = 0; i < 12; i++){ var m = clone(gone); m.id = "m" + i; m.name = "Aluno " + i; many.push(m); }
var qm = computeContactQueue(many, today);
check.check("20. A lista mostra no máximo 8 e diz quantos mais há", qm.shown.length === CONTACT_QUEUE_MAX && qm.more === 4);

// ---------- registo de contactos ----------
(function(){
  var s = clone(gone); sbReady = false; // modo local: persistStudent não faz nada
  contactLogAdd(s, {kind: "contacto", channel: "whatsapp", reason: "sem-registos"});
  check.check("21. Contactar regista a data de hoje, o canal e o motivo", s.contactLog.length === 1 && s.contactLog[0].date === today && s.contactLog[0].channel === "whatsapp" && s.contactLog[0].reason === "sem-registos");
  check.check("22. A seguir o aluno sai da fila", computeContactQueue([s], today).items.length === 0);
  for (var k = 0; k < 60; k++) contactLogAdd(s, {kind: "contacto", channel: "outro", reason: "generico"});
  check.check("23. O registo guarda só os últimos 50 contactos", s.contactLog.length === CONTACT_LOG_MAX);
  check.check("24. Adiar 7 dias vai até à data certa", addDaysISO("2026-10-13", 7) === "2026-10-20" && addDaysISO("2026-12-28", 7) === "2027-01-04");
})();

// ---------- onboarding ----------
(function(){
  var n = healthy("n", "Novo"); n.createdAt = new Date(Date.now() - 9 * 86400000).toISOString(); n.workoutLogs = []; n.checkins = []; n.weights = []; n.photos = []; n.allowPhotos = false; n.inviteEmail = "n@x.pt"; n.authUserId = null; n.meals = [];
  var ob = onboardingOf(n);
  check.check("25. Um aluno de 9 dias sem registos está em onboarding e parado", ob.inOnboarding && ob.stalled && ob.daysSince === 9);
  check.check("26. Os passos que não se aplicam não contam (fotos sem autorização)", ob.steps.filter(function(x){ return x.key === "fotos"; })[0].na === true && ob.total === ob.steps.filter(function(x){ return !x.na; }).length);
  check.check("27. O onboarding parado gera um motivo forte e uma mensagem de boas-vindas", keys(n)[0] === "onboarding" && /Bem-vindo/.test(contactMessageFor("onboarding", n)));
  n.checkins = [{date: iso(1), weight: 70, adherence: 7}]; n.workoutLogs = healthy("x", "x").workoutLogs; n.weights = [{date: iso(1), w: 70}]; n.meals = healthy("y", "y").meals; n.authUserId = "u";
  var ob2 = onboardingOf(n);
  check.check("28. Com registos já não está parado, e a barra de progresso avança", !ob2.stalled && ob2.done > ob.done);
  var old = healthy("o", "Antigo"); old.createdAt = new Date(Date.now() - 90 * 86400000).toISOString();
  check.check("29. Passados 30 dias já não é aluno novo", !onboardingOf(old).inOnboarding);
  var legacy = healthy("l", "Sem data"); legacy.createdAt = null;
  check.check("30. Alunos antigos (sem data de criação) nunca aparecem como novos", !onboardingOf(legacy).inOnboarding && onboardingOf(legacy).daysSince === null);
  check.check("31. O cartão de alunos novos só aparece se houver novos", tplOnboardingCard([old, legacy]) === "" && /Novo/.test(tplOnboardingCard([onboardingFixture()])));
  function onboardingFixture(){ var x = healthy("z", "Novo"); x.createdAt = new Date(Date.now() - 2 * 86400000).toISOString(); x.checkins = []; x.workoutLogs = []; return x; }
})();

// ---------- pulso ----------
(function(){
  var p = studioPulse([ok, gone, inactive], today);
  check.check("32. O pulso conta só alunos ativos", p.active === 2);
  check.check("33. Percentagem com registos nos últimos 7 dias", p.recordsPct === 50);
  check.check("34. Alunos em risco inclui quem não regista há semanas", p.atRisk === 1);
  check.check("35. Sessões dos últimos 7 dias somadas", p.sessions7d === 1);
  check.check("36. Sem alunos o cartão não aparece", tplStudioPulse([]) === "");
})();

// ---------- interface e base de dados ----------
check.check("37. O painel está no dashboard, antes da lista de alunos", /tplContactQueue\(activeStudents\) \+ tplOnboardingCard\(activeStudents\) \+ tplStudioPulse\(activeStudents\);[\s\S]{0,400}if \(state\.dashboardListMode\)/.test(appSource));
check.check("38. O cartão tem botão Contactar com o motivo principal", /data-contact="/.test(tplContactQueue([gone])) && /data-reason="sem-registos"/.test(tplContactQueue([gone])));
check.check("39. Sem ninguém a contactar diz que está tudo bem", /Ninguém precisa de contacto hoje/.test(tplContactQueue([ok])));
check.check("40. O convite pede o telefone (opcional) e a ficha tem o campo Contacto", /id=\\"obPhone\\"/.test(appSource) && /saveContactPhone/.test(appSource));
check.check("41. O telefone e o registo de contactos entram na gravação só se a migração 0022 existe", /if \(contactColumnsAvailable\)\{ row\.phone = s\.phone \|\| null; row\.contact_log = s\.contactLog \|\| \[\]; \}/.test(appSource));
var mig = fs.readFileSync(__dirname + "/../supabase/migrations/0022_contact_and_onboarding.sql", "utf8");
check.check("42. A migração 0022 acrescenta as 3 colunas e é repetível", /add column if not exists phone/.test(mig) && /add column if not exists contact_log/.test(mig) && /add column if not exists created_at/.test(mig) && !/drop column|drop table/i.test(mig));
check.check("43. As fichas antigas não passam a 'novas' (created_at só tem default para as novas)", /alter column created_at set default now\(\)/.test(mig) && !/update students/i.test(mig));
check.summarize();
