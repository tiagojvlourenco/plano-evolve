// Pacotes, presenças/faltas e cobranças: regras, números do estúdio, CSV, motivos de contacto e migração 0023.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var fs = require("fs");
var store = {};
global.localStorage = {getItem: function(k){ return k in store ? store[k] : null; }, setItem: function(k, v){ store[k] = String(v); }, removeItem: function(k){ delete store[k]; }};
function d(n){ return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10); }
var today = todayISO();
function reset(packs, sessions, payments){ studio.packs = packs || []; studio.sessions = sessions || []; studio.payments = payments || []; studio.loaded = true; studio.available = true; }
function pack(o){ return Object.assign({id: "p1", student_id: "a", name: "Pack 10", total: 10, price: 250, starts_on: d(30), expires_on: null, missed_consumes: true, late_cancel_consumes: true}, o || {}); }
function sess(o){ return Object.assign({id: "s" + Math.random(), student_id: "a", pack_id: "p1", date: d(1), status: "feita"}, o || {}); }

// ---- regras ----
var pk = pack();
check.check("1. Feita gasta uma sessão", sessionConsumes(pk, sess({status: "feita"})));
check.check("2. Faltar gasta (por omissão) e não gasta se o pacote disser que não", sessionConsumes(pk, sess({status: "faltou"})) && !sessionConsumes(pack({missed_consumes: false}), sess({status: "faltou"})));
check.check("3. Cancelar tarde gasta (por omissão); cancelar a tempo nunca gasta", sessionConsumes(pk, sess({status: "cancelada_tarde"})) && !sessionConsumes(pack({late_cancel_consumes: false}), sess({status: "cancelada_tarde"})) && !sessionConsumes(pk, sess({status: "cancelada"})));
reset([pk], [sess({status: "feita"}), sess({status: "faltou"}), sess({status: "cancelada"}), sess({status: "cancelada_tarde", pack_id: "outro"})]);
var u = packUsage(pk, today);
check.check("4. O uso soma só as sessões do pacote que gastam (2 de 10, restam 8)", u.used === 2 && u.remaining === 8 && u.pct === 20 && u.active && !u.ending);
reset([pack({total: 3})], [sess(), sess(), sess()]);
check.check("5. Sem sessões por usar fica esgotado e deixa de estar ativo", packUsage(studio.packs[0], today).exhausted && !packUsage(studio.packs[0], today).active);
reset([pack({total: 10, expires_on: d(1)})], []);
check.check("6. Pacote fora da validade está caducado e inativo", packUsage(studio.packs[0], today).expired && !packUsage(studio.packs[0], today).active);
reset([pack({total: 10})], [sess(), sess(), sess(), sess(), sess(), sess(), sess(), sess()]);
check.check("7. Restam 2 ou menos = a acabar", packUsage(studio.packs[0], today).ending && packUsage(studio.packs[0], today).remaining === 2);
reset([pack({expires_on: d(-10)})], []);
check.check("8. Faltam 10 dias de validade = a acabar (limite 14)", packUsage(studio.packs[0], today).ending && packUsage(studio.packs[0], today).daysLeft === 10);
reset([pack({starts_on: d(-5)})], []);
check.check("9. Um pacote que ainda não começou não está ativo", !packUsage(studio.packs[0], today).active);

// ---- que pacote é descontado ----
reset([pack({id: "late", expires_on: d(-60)}), pack({id: "soon", expires_on: d(-10)}), pack({id: "none", expires_on: null})], []);
check.check("10. A sessão desconta ao pacote que caduca primeiro", pickPackForSession("a", today).id === "soon");
reset([pack({id: "x", total: 1}), pack({id: "y", total: 5, expires_on: null})], [sess({pack_id: "x"})]);
check.check("11. Um pacote esgotado passa a vez ao seguinte", pickPackForSession("a", today).id === "y");
reset([pack({id: "x", expires_on: d(10)})], []);
check.check("12. Fora da validade (data antiga ou futura) não há pacote", pickPackForSession("a", today) === null && pickPackForSession("a", d(40)) === null && pickPackForSession("b", today) === null);

// ---- cobranças ----
check.check("13. Estados da cobrança: pago, atrasado, a vencer, futuro", paymentStatus({due_on: d(5), paid_on: d(4)}) === "pago" && paymentStatus({due_on: d(1), paid_on: null}) === "atrasado" && paymentStatus({due_on: d(-2), paid_on: null}) === "a vencer" && paymentStatus({due_on: d(-20), paid_on: null}) === "futuro");
check.check("14. Valores em euros ao estilo português", eur(250) === "250,00 €" && eur(12.5) === "12,50 €" && eur("x") === "0,00 €");
var m = monthOf(today);
reset([pack()], [sess({date: today, status: "feita"}), sess({date: today, status: "faltou"}), sess({date: today, status: "feita"}), sess({date: today, status: "cancelada"})], [
  {id: "1", student_id: "a", amount: 100, due_on: d(3), paid_on: null},
  {id: "2", student_id: "a", amount: 50, due_on: d(-1), paid_on: null},
  {id: "3", student_id: "a", amount: 70, due_on: d(5), paid_on: today, method: "mbway"}]);
STUDENTS = [{id: "a", name: "Ana Silva", active: true}];
var kp = studioKpis(m, today);
check.check("15. Em atraso soma o que venceu e não foi pago", kp.overdue === 100 && kp.overdueN === 1);
check.check("16. A cobrar no mês soma só o que ainda vai vencer", (monthOf(d(-1)) === m ? kp.toCollect === 50 : kp.toCollect === 0));
check.check("17. Presença = feitas / (feitas + faltas); cancelar a tempo não conta", kp.attendance === 67 && kp.missed === 1 && kp.done === 2);
check.check("18. O recebido no mês soma os pagamentos feitos nesse mês", kp.received === 70 && kp.receivedN === 1);

// ---- resumo e motivos de contacto ----
var ana = {id: "a", name: "Ana Silva", active: true, birthDate: null, checkins: [], weights: [], workoutLogs: [], planHistory: [], meals: [], trainingProgram: null, goal: "x", targets: {}, assessments: []};
STUDENTS = [ana];
reset([pack({total: 4})], [sess(), sess(), sess()], [{id: "1", student_id: "a", amount: 100, due_on: d(10), paid_on: null}]);
var sm = studentStudioSummary("a", today);
check.check("19. O resumo do aluno: 1 pacote a acabar e 1 cobrança em atraso", sm.ending.length === 1 && sm.overdue.length === 1 && sm.hasActive);
var rs = studioContactReasons("a", today), by = {};
rs.forEach(function(r){ by[r.key] = r; });
check.check("20. Pagamento em atraso aparece como motivo, com valor e data na mensagem", by["pagamento-atrasado"] && /100,00/.test(contactMessageFor("pagamento-atrasado", ana, by["pagamento-atrasado"].vars)) && by["pagamento-atrasado"].weight === 65);
check.check("21. Pacote a acabar aparece como motivo com o que resta", by["pacote-a-acabar"] && /restam 1 sessão/.test(by["pacote-a-acabar"].label) && /restam 1 sessão/.test(contactMessageFor("pacote-a-acabar", ana, by["pacote-a-acabar"].vars)));
reset([pack({total: 10})], [sess({date: d(5), status: "faltou"}), sess({date: d(9), status: "cancelada_tarde"}), sess({date: d(60), status: "faltou"})]);
check.check("22. Duas faltas/cancelamentos tardios em 30 dias dão o motivo 'faltas' (a de há 60 dias não conta)", studioContactReasons("a", today).some(function(r){ return r.key === "faltas" && /2 faltas/.test(r.label); }));
reset([pack({starts_on: d(80), expires_on: d(10)})], []);
check.check("23. Sem pacote a decorrer depois de ter tido um há pouco: renovar", studioContactReasons("a", today).some(function(r){ return r.key === "pacote-a-acabar" && /renovar/.test(r.label); }));
reset([], []);
check.check("24. Sem dados do estúdio não há motivos novos (a app continua a funcionar)", !studioContactReasons("a", today).some(function(r){ return ["pagamento-atrasado", "pacote-a-acabar", "faltas"].indexOf(r.key) >= 0; }));
studio.available = false;
check.check("25. Com a migração por correr não há motivos novos nem erros", !studioContactReasons("a", today).some(function(r){ return r.key === "pagamento-atrasado"; }) && /migração <strong>0023/.test(tplProSessoes(ana)));
studio.available = true;
reset([pack({total: 4})], [sess(), sess(), sess()], [{id: "1", student_id: "a", amount: 100, due_on: d(10), paid_on: null}]);
check.check("25b. O núcleo (Acompanhamento) já não mistura avisos de pacotes e pagamentos na lista de contactos: vivem na Gestão", !contactReasonsFor(ana, today).some(function(r){ return ["pagamento-atrasado", "pacote-a-acabar", "faltas"].indexOf(r.key) >= 0; }) && /id="studioContact"/.test(studioContactHtml([ana], today)) && /data-open-student="a"/.test(studioContactHtml([ana], today)));

// ---- CSV ----
reset([pack({name: 'Pack "especial"; 10'})], [sess({date: today, status: "faltou", notes: "x"})], [{id: "1", student_id: "a", amount: 250, due_on: today, paid_on: null, notes: "linha1\nlinha2"}]);
var csv = paymentsCsv(m).split("\r\n");
check.check("26. O CSV de cobranças tem cabeçalho e valores com vírgula decimal", csv[0].indexOf("Aluno;Vencimento;Valor (€)") === 0 && /Ana Silva;.*;250,00;a vencer|Ana Silva;.*;250,00;atrasado|Ana Silva;.*;250,00;futuro/.test(csv[1]));
check.check("27. Texto com ; aspas ou quebras de linha fica entre aspas (aspas duplicadas)", csvCell('a;b') === '"a;b"' && csvCell('diz "olá"') === '"diz ""olá"""' && /^"linha1\nlinha2"$/.test(csvCell("linha1\nlinha2")) && csvCell("simples") === "simples");
check.check("28. O CSV de sessões traz o estado em português e o pacote", /Ana Silva;.*;;Faltou;Pack ""especial""; 10|Faltou/.test(sessionsCsv(m)) && sessionsCsv(m).split("\r\n").length === 2);

// ---- dados em modo local ----
sbReady = false; reset([], [], []); store = {};
(async function(){
  var r = await studioInsert("packs", {student_id: "a", name: "P", total: 5, starts_on: today});
  check.check("29. Em modo local um pacote novo recebe id e fica guardado no browser", !r.error && r.data.id && studio.packs.length === 1 && JSON.parse(store[STUDIO_LOCAL_KEY]).packs.length === 1);
  var sr = await studioAddSession("a", today, "feita", "18:30");
  check.check("30. Registar uma sessão desconta ao pacote certo e guarda a hora", !sr.error && studio.sessions[0].pack_id === r.data.id && studio.sessions[0].time === "18:30" && packUsage(studio.packs[0], today).remaining === 4);
  check.check("31. Data inválida ou resultado inválido são recusados", (await studioAddSession("a", "ontem", "feita")).error && (await studioAddSession("a", today, "xpto")).error);
  var ur = await studioUpdate("sessions", studio.sessions[0].id, {status: "faltou"});
  check.check("32. Alterar o resultado de uma sessão funciona", !ur.error && studio.sessions[0].status === "faltou");
  await studioInsert("payments", {student_id: "a", pack_id: r.data.id, amount: 80, due_on: today});
  await studioDelete("packs", r.data.id);
  check.check("33. Apagar um pacote mantém as sessões e cobranças, mas sem pacote", studio.packs.length === 0 && studio.sessions[0].pack_id === null && studio.payments[0].pack_id === null);
  var sr2 = await studioAddSession("a", today, "feita");
  check.check("34. Sem pacote, a sessão fica registada sem pacote", !sr2.error && sr2.data.pack_id === null);
  store = {}; reset([], [], []); studio.loaded = false; await studioLoad();
  check.check("35. Em modo local, sem dados guardados, carregam-se dados de demonstração (3 pacotes) e ficam guardados", studio.loaded && studio.packs.length === 3 && studio.payments.length === 4 && !!store[STUDIO_LOCAL_KEY]);
  sbReady = false;

  // ---- ecrãs ----
  reset([pack()], [sess()], [{id: "1", student_id: "a", amount: 250, due_on: d(3), paid_on: null}]);
  var tab = tplProSessoes(ana);
  check.check("36. A ficha mostra pacotes, formulário, sessões e cobranças", /Pack 10/.test(tab) && /id="pkAdd"/.test(tab) && /id="seAdd"/.test(tab) && /data-pay="1"/.test(tab) && /data-del-session=/.test(tab));
  check.check("37. O texto do utilizador é escapado nos ecrãs", !/<img/.test((function(){ reset([pack({name: "<img src=x onerror=1>"})], []); return tplProSessoes(ana); })()));
  check.check("38. O separador Pacotes existe na ficha e o menu Estúdio na lista", /\["sessoes","Pacotes"\]/.test(appSource) && /id=\\"navStudio\\"/.test(appSource) && /proView === "studio" \|\| state\.proView === "contracts"\) renderGestaoMain/.test(appSource) && /G\.renderProStudioMain\(\)/.test(appSource));

  // ---- migração ----
  var mig = fs.readFileSync(__dirname + "/../supabase/migrations/0023_studio_packs.sql", "utf8");
  check.check("39. A migração cria as 3 tabelas com RLS e uma política só para profissionais em cada", ["session_packs", "sessions", "payments"].every(function(t){ return new RegExp("create table if not exists " + t + " ").test(mig) && new RegExp("alter table " + t + " enable row level security").test(mig) && new RegExp("create policy \"professionals manage [a-z ]+\" on " + t).test(mig); }));
  check.check("40. Os alunos nunca têm acesso (sem políticas para 'authenticated' em geral)", !/to authenticated|to anon|using \(true\)/i.test(mig) && (mig.match(/exists \(select 1 from professionals where user_id = auth\.uid\(\)\)/g) || []).length === 6);
  check.check("41. Apagar um aluno apaga o histórico; apagar um pacote não apaga sessões nem cobranças", /student_id text not null references students\(id\) on delete cascade/.test(mig) && (mig.match(/pack_id uuid references session_packs\(id\) on delete set null/g) || []).length === 2);
  check.check("42. Os estados e métodos válidos estão limitados na base de dados", /status in \('feita', 'faltou', 'cancelada', 'cancelada_tarde'\)/.test(mig) && /method in \('mbway'/.test(mig) && /amount numeric\(8,2\) not null check \(amount > 0\)/.test(mig));
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e && e.stack || e); process.exit(1); });
