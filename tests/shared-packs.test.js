// Pacotes partilhados (casais com um só pagamento, migração 0028) e validade por tipo de pack (duração + 3 meses).
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
function reset(){ sbReady = false; studio.packs = []; studio.sessions = []; studio.payments = []; studio.slots = []; studio.loaded = true; studio.available = true; studio.slotsAvailable = true; studio.sharedAvailable = true; }
function pack(id, owner, total, extra){ return Object.assign({id: id, student_id: owner, name: "Pacote " + total, total: total, price: 0, starts_on: d(-10), expires_on: d(80), used_before: 0, shared_with: [], missed_consumes: true, late_cancel_consumes: true}, extra || {}); }
function ses(n, student, pack_id, status){ return {id: "x" + n, student_id: student, pack_id: pack_id, date: d(-5), status: status || "feita"}; }
STUDENTS = [{id: "a", name: "Ana Silva", active: true}, {id: "b", name: "Bruno Silva", active: true}, {id: "c", name: "Carla Dias", active: true}];

(async function(){
  // ---- validade por tipo de pack ----
  check.check("1. Mensal 3, trimestral 6, semestral 9 e anual 15 meses (duração + 3 meses)", PACK_TYPES.mensal.months === 3 && PACK_TYPES.trimestral.months === 6 && PACK_TYPES.semestral.months === 9 && PACK_TYPES.anual.months === 15);
  check.check("2. packTypeMonths aceita maiúsculas, acentos e espaços; desconhecidos dão null", packTypeMonths("Trimestral") === 6 && packTypeMonths(" ANUAL ") === 15 && packTypeMonths("semestral") === 9 && packTypeMonths("Mensal") === 3 && packTypeMonths("12") === null && packTypeMonths("") === null && packTypeMonths("toString") === null);
  check.check("3. Trimestral pago a 14 de janeiro vale até 14 de julho (duração 14/04 + 3 meses)", addMonthsISO("2026-01-14", PACK_TYPES.trimestral.months) === "2026-07-14");
  check.check("4. Somar meses não passa ao mês seguinte (30/11 + 3 = 28/02; 31/10 + 4 = 28/02)", addMonthsISO("2026-11-30", 3) === "2027-02-28" && addMonthsISO("2027-10-31", 4) === "2028-02-29" && addMonthsISO("2026-01-31", 1) === "2026-02-28");
  check.check("5. Anual pago a 1 de março vale até 1 de junho do ano seguinte (15 meses)", addMonthsISO("2026-03-01", PACK_TYPES.anual.months) === "2027-06-01");

  // ---- importação com tipo e partilha ----
  var p = parsePackImport("Ana Silva; 13; 01/10/2026; 300; 0; Trimestral; Bruno Silva\nBruno Silva; 26; 01/10/2026; 600; 2; 9\nCarla Dias; 10; 01/10/2026; 200; 0; Semestral\nDiana; 10; 01/10/2026; 1; 0; Quinzenal");
  check.check("6. A coluna da validade aceita o tipo por extenso e a coluna seguinte a partilha", p.rows.length === 3 && p.rows[0].months === 6 && p.rows[0].shareWith.join() === "Bruno Silva" && p.rows[1].months === 9 && p.rows[1].shareWith.length === 0 && p.rows[2].months === 9 && p.errors.length === 1 && /validade inválida/.test(p.errors[0]));
  var p2 = parsePackImport("Ana Silva; 13; 01/10/2026; 300; 0; 6; Bruno Silva & Carla Dias\nBruno Silva; 26; 01/10/2026; 300; 0; Anual; Ana Silva e Carla Dias");
  check.check("7. «A & B», «A e B» e «A / B» separam vários alunos", p2.rows[0].shareWith.join() === "Bruno Silva,Carla Dias" && p2.rows[1].shareWith.join() === "Ana Silva,Carla Dias" && p2.rows[1].months === 15);

  reset();
  var rep = await studioImportPacks("Ana Silva; 13; 01/10/2026; 300; 0; Trimestral; Bruno Silva\nBruno Silva; 26; 01/10/2026; 300; 0; Trimestral; Ana Silva\nCarla Dias; 10; 01/10/2026; 200; 0; Anual; Zé Ninguém");
  var pa = studio.packs.filter(function(x){ return x.student_id === "a"; })[0], pb = studio.packs.filter(function(x){ return x.student_id === "b"; })[0], pc = studio.packs.filter(function(x){ return x.student_id === "c"; })[0];
  check.check("8. Importar cria os pacotes com a validade do tipo e o aluno do «partilhado com» (e avisa dos nomes que não encontra)", rep.created === 3 && pa.expires_on === "2027-04-01" && pa.shared_with.join() === "b" && pb.shared_with.join() === "a" && sharedIdsOf(pc).length === 0 && rep.errors.length === 1 && /Zé Ninguém/.test(rep.errors[0]));
  check.check("9. O anual de 1 de outubro de 2026 vale até 1 de janeiro de 2028 (15 meses)", pc.expires_on === "2028-01-01");

  // ---- escolher o pacote de uma sessão ----
  reset();
  studio.packs = [pack("pa", "a", 13, {shared_with: ["b"]}), pack("pb", "b", 26, {shared_with: ["a"]})];
  check.check("10. Cada aluno vê os seus pacotes e os que partilham com ele", usablePacksOf("a").length === 2 && usablePacksOf("b").length === 2 && usablePacksOf("c").length === 0);
  check.check("11. Com a mesma validade, a sessão desconta primeiro ao pacote do próprio aluno", pickPackForSession("a", today).id === "pa" && pickPackForSession("b", today).id === "pb");
  // a Ana gasta as 13 e continua a treinar: passa para o pacote do Bruno
  for (var i = 0; i < 13; i++) studio.sessions.push(ses(i, "a", "pa"));
  check.check("12. Quando o pacote de 13 acaba, a Ana continua com as aulas do Bruno (sem ficar sem pacote)", packUsage(studio.packs[0], today).exhausted && pickPackForSession("a", today).id === "pb");
  check.check("13. O conjunto mostra o que resta nos dois pacotes (26 de 39)", (function(){ var pl = poolOf("b", today); return pl.total === 39 && pl.used === 13 && pl.remaining === 26 && pl.shared === true; })());
  check.check("14. A sessão do Bruno continua no pacote dele; as da Ana no do Bruno contam no pacote do Bruno", (function(){ studio.sessions.push(ses(100, "a", "pb")); studio.sessions.push(ses(101, "b", "pb")); return packUsage(studio.packs[1], today).used === 2 && packUsage(studio.packs[0], today).used === 13; })());

  // um pacote só partilhado (39 aulas) – ou seja, um dono e um parceiro
  reset();
  studio.packs = [pack("pk", "a", 39, {shared_with: ["b"]})];
  check.check("15. Um só pacote partilhado: o parceiro também o gasta", pickPackForSession("b", today).id === "pk" && pickPackForSession("c", today) === null);
  var r1 = await studioAddSession("b", today, "feita"), r2 = await studioAddSession("a", today, "feita");
  check.check("16. As sessões dos dois descontam ao mesmo pacote", !r1.error && !r2.error && packUsage(studio.packs[0], today).used === 2 && r1.data.pack_id === "pk" && r2.data.pack_id === "pk");
  // pacote que caduca primeiro ganha ao do próprio aluno
  reset();
  studio.packs = [pack("own", "a", 10, {expires_on: d(60)}), pack("other", "b", 10, {expires_on: d(20), shared_with: ["a"]})];
  check.check("17. Se o pacote partilhado caduca primeiro, gasta-se esse (como nos pacotes normais)", pickPackForSession("a", today).id === "other");
  // pacote partilhado ainda não começou / caducado
  studio.packs = [pack("o", "b", 10, {starts_on: d(5), shared_with: ["a"]})];
  check.check("18. Um pacote partilhado que ainda não começou não é escolhido", pickPackForSession("a", today) === null);

  // ---- resumo, a acabar, renovação ----
  reset();
  studio.packs = [pack("pk", "a", 4, {shared_with: ["b"]})];
  studio.slots = [{id: "s1", student_id: "a", weekday: 1, time: "10:00", counts_from: d(-30)}, {id: "s2", student_id: "b", weekday: 3, time: "10:00", counts_from: d(-30)}, {id: "s3", student_id: "b", weekday: 5, time: "10:00", counts_from: d(-30)}];
  check.check("19. Os pacotes partilhados contam as sessões semanais de todos os alunos (a acabar mais cedo)", weeklySlotsOfPack(studio.packs[0]) === 3 && packUsage(studio.packs[0], today).ending === false);
  studio.sessions.push(ses(1, "a", "pk"));
  check.check("20. Restam 3 e treinam 3 vezes por semana: o pacote já está a acabar", packUsage(studio.packs[0], today).ending === true);
  var sumB = studentStudioSummary("b", today);
  check.check("21. A ficha do parceiro mostra o pacote do outro, marcado como partilhado, e conta como ativo", sumB.packs.length === 1 && sumB.packs[0].foreign === true && sumB.packs[0].shared === true && sumB.hasActive === true);
  var htmlB = tplProSessoes(STUDENTS[1]), htmlA = tplProSessoes(STUDENTS[0]);
  check.check("22. Mostra «Pacote de Ana Silva» ao parceiro (sem botão de apagar) e «Partilhado com Bruno Silva» ao dono (com Partilhar)", /Pacote de Ana Silva/.test(htmlB) && !/data-del-pack/.test(htmlB) && /Partilhado com Bruno Silva/.test(htmlA) && /data-share-pack/.test(htmlA) && /data-del-pack/.test(htmlA));
  var rows = studioSummaryRows(today);
  var rowB = rows.filter(function(r){ return r.student.id === "b"; })[0];
  check.check("23. O resumo do estúdio mostra a quem pertence o pacote e o que resta no conjunto", !!rowB && rowB.others.join() === "Ana Silva" && rowB.pool.remaining === 3 && rowB.pool.shared === true);

  // ---- aulas extra: um pacote novo desconta as dos alunos com quem é partilhado ----
  reset();
  studio.sessions = [{id: "e1", student_id: "a", pack_id: null, date: d(-3), status: "feita"}, {id: "e2", student_id: "b", pack_id: null, date: d(-2), status: "feita"}, {id: "e3", student_id: "c", pack_id: null, date: d(-2), status: "feita"}];
  var np = pack("new", "a", 10, {starts_on: d(-5), shared_with: ["b"]});
  studio.packs = [np];
  var n = await attachExtrasToPack(np);
  check.check("24. Um pacote partilhado desconta as aulas extra de todos os seus alunos (não as de outros)", n === 2 && studio.sessions[0].pack_id === "new" && studio.sessions[1].pack_id === "new" && studio.sessions[2].pack_id === null);

  // ---- calendário: a sessão do parceiro usa o pacote partilhado ----
  reset();
  studio.packs = [pack("pk", "a", 5, {shared_with: ["b"], expires_on: null})];
  var ev = function(id, title, date){ return {id: id, title: title, date: date, time: "10:00", colorId: "10", cancelled: false}; };
  var plan = planCalendarSync({events: [ev("e1", "PT 60 - Bruno Silva", d(-2)), ev("e2", "PT 60 - Ana Silva", d(-1))], today: today, window: {from: d(-30), to: today}, aliases: {}, ignored: {}, prefix: "PT"});
  var res = await applyCalendarPlan(plan);
  check.check("25. Os eventos do Google Agenda dos dois descontam ao pacote partilhado", res.errors === 0 && res.inserted === 2 && studio.sessions.filter(function(x){ return x.pack_id === "pk"; }).length === 2);

  // ---- partilhar e deixar de partilhar (com partilha nos dois sentidos) ----
  reset();
  studio.packs = [pack("pa", "a", 13), pack("pb", "b", 26), pack("pc", "c", 10, {starts_on: d(-300), expires_on: d(-100)})];
  var sh = await studioSetPackSharing(studio.packs[0], ["b", "a", "b", ""], true);
  check.check("26. Partilhar com o Bruno dá-lhe acesso ao pacote da Ana e, nos dois sentidos, à Ana o do Bruno (sem duplicados nem o próprio dono)", !sh.error && studio.packs[0].shared_with.join() === "b" && studio.packs[1].shared_with.join() === "a" && usablePacksOf("a").length === 2 && usablePacksOf("b").length === 2);
  var sh2 = await studioSetPackSharing(studio.packs[0], ["b", "c"], true);
  check.check("27. Adicionar a Carla: o pacote caducado da Carla não é partilhado de volta", !sh2.error && studio.packs[0].shared_with.join() === "b,c" && studio.packs[2].shared_with.length === 0);
  var sh3 = await studioSetPackSharing(studio.packs[0], [], true);
  check.check("28. Deixar de partilhar remove o acesso nos dois sentidos (o Bruno continua a partilhar com a Carla, que é outra partilha)", !sh3.error && studio.packs[0].shared_with.length === 0 && studio.packs[1].shared_with.join() === "c" && usablePacksOf("a").length === 1 && usablePacksOf("b").length === 2);   // (o Bruno e a Carla continuam parceiros: partilhar num dos dois basta)
  var sh4 = await studioSetPackSharing(studio.packs[0], ["b"], false);
  check.check("29. Sem partilha nos dois sentidos, só o pacote escolhido muda", !sh4.error && studio.packs[0].shared_with.join() === "b" && studio.packs[1].shared_with.join() === "c");
  studio.sharedAvailable = false;
  var sh5 = await studioSetPackSharing(studio.packs[0], ["c"], true);
  check.check("30. Sem a migração 0028, avisa em vez de falhar em silêncio", !!sh5.error && /0028/.test(sh5.error));
  studio.sharedAvailable = true;

  // ---- migração ----
  var mig = fs.readFileSync(__dirname + "/../supabase/migrations/0028_shared_packs.sql", "utf8");
  check.check("31. A migração 0028 junta shared_with (jsonb, default []) sem apagar dados e é repetível", /shared_with jsonb not null default '\[\]'::jsonb/.test(mig) && /if not exists/i.test(mig) && !/drop table|delete from/i.test(mig));
  
// ---- revisão adversarial: reciprocidade idempotente, desmarcar com outro pacote, conjunto de três, «a acabar» pelo conjunto, importação com « e » ----
  reset();
  studio.packs = [pack("pa", "a", 13, {shared_with: ["b"]}), pack("pb", "b", 26)];
  var rp = await studioSetPackSharing(studio.packs[0], ["b"], true);
  check.check("33. «Guardar» outra vez repara a partilha nos dois sentidos que ficou incompleta (antes, sem alterações, não fazia nada)", !rp.error && studio.packs[1].shared_with.join() === "a");
  reset();
  studio.packs = [pack("pa", "a", 13, {shared_with: ["b"]}), pack("pa2", "a", 13, {shared_with: ["b"]}), pack("pb", "b", 26, {shared_with: ["a"]})];
  await studioSetPackSharing(studio.packs[1], [], true);
  check.check("34. Deixar de partilhar só um de dois pacotes do mesmo dono não tira à Ana o acesso ao pacote do Bruno", studio.packs[2].shared_with.join() === "a" && studio.packs[0].shared_with.join() === "b" && usablePacksOf("a").some(function(p){ return p.id === "pb"; }));
  reset();
  studio.packs = [pack("pa", "a", 10), pack("pb", "b", 10), pack("pc", "c", 10)];
  await studioSetPackSharing(studio.packs[0], ["b", "c"], true);
  check.check("35. Partilha a três: o conjunto fecha-se (os três gastam dos três pacotes)", ["a", "b", "c"].every(function(id){ return usablePacksOf(id).length === 3; }) && studio.packs[1].shared_with.slice().sort().join() === "a,c" && studio.packs[2].shared_with.slice().sort().join() === "a,b");
  var many = []; for (var i = 0; i < 11; i++) many.push("s" + i);
  var big = await studioSetPackSharing(studio.packs[0], many, true);
  check.check("36. Mais de 10 alunos num pacote dá um erro claro (não «falta a migração»)", !!big.error && /10 alunos/.test(big.error) && !/0028/.test(big.error));
  // «a acabar» pelo conjunto
  reset();
  studio.packs = [pack("pa", "a", 13, {shared_with: ["b"]}), pack("pb", "b", 26, {shared_with: ["a"]})];
  for (var k = 0; k < 12; k++) studio.sessions.push(ses(k, "a", "pa"));
  studio.slots = [{id: "s1", student_id: "a", weekday: 1, time: "10:00", counts_from: d(-30)}];
  check.check("37. Com 12 de 13 usadas num pacote e 26 no outro, o conjunto NÃO está a acabar (o pacote da Ana, sozinho, sim)", packUsage(studio.packs[0], today).ending === true && packEndingInPool(studio.packs[0], today) === false && packEndingInPool(studio.packs[1], today) === false);
  var rows = studioSummaryRows(today);
  check.check("38. O resumo do estúdio não manda renovar nem marca «a acabar» nenhum dos dois; a contagem de pacotes a acabar é 0", rows.every(function(r){ return r.state === "normal"; }) && studioKpis(monthOf(today), today).endingN === 0 && studentStudioSummary("b", today).ending.length === 0);
  for (var k2 = 12; k2 < 13; k2++) studio.sessions.push(ses(40 + k2, "a", "pa"));
  for (var k3 = 0; k3 < 25; k3++) studio.sessions.push(ses(100 + k3, "b", "pb"));
  check.check("39. Quando o conjunto está quase no fim (1 aula em 39) passa a «a acabar» (um alerta só, o do pacote que ainda tem aulas)", packEndingInPool(studio.packs[1], today) === true && studentStudioSummary("a", today).ending.length >= 1 && studioKpis(monthOf(today), today).endingN === 1);
  // aluno inativo: o aviso vai para quem está ativo
  STUDENTS[0].active = false;
  check.check("40. Se o dono do pacote está inativo, o pacote partilhado continua a contar para o parceiro ativo", packActiveMember(studio.packs[0]) && packActiveMember(studio.packs[0]).id === "b" && packHasActiveMember(studio.packs[0]));
  STUDENTS[0].active = true;
  // importação com nomes que levam « e »
  var savedStudents = STUDENTS;
  STUDENTS = [{id: "a", name: "Ana Silva", active: true}, {id: "x", name: "Ana Sousa e Silva", active: true}, {id: "j", name: "José Pinto", active: true}, {id: "m", name: "Maria Silva", active: true}];
  reset();
  var imp = await studioImportPacks("Ana Silva; 13; 01/10/2026; 300; 0; Trimestral; Ana Sousa e Silva\nJosé Pinto; 10; 01/10/2026; 100; 0; 6; José Pinto e Maria Silva");
  var pAna = studio.packs.filter(function(x){ return x.student_id === "a"; })[0], pJose = studio.packs.filter(function(x){ return x.student_id === "j"; })[0];
  check.check("41. Um nome com « e » (Ana Sousa e Silva) é um aluno só; «A e B» continua a separar dois alunos", imp.errors.length === 0 && pAna.shared_with.join() === "x" && pJose.shared_with.slice().sort().join() === "m");
  STUDENTS = savedStudents;
  // coluna 0028 em falta: erro em português e deixa de oferecer a partilha
  reset(); sbReady = true;
  var savedSb = typeof sb !== "undefined" ? sb : null;
  sb = {from: function(){ return {insert: function(){ return {select: function(){ return Promise.resolve({data: null, error: {message: "Could not find the 'shared_with' column of 'session_packs' in the schema cache"}}); }}; }}; }};
  var ins = await studioInsert("packs", {student_id: "a", name: "P", total: 5, starts_on: d(0), shared_with: ["b"]});
  sbReady = false; sb = savedSb;
  check.check("42. Sem a migração 0028 o erro do Supabase (em inglês) vira a mensagem em português e a partilha deixa de se oferecer", !!ins.error && /0028/.test(ins.error) && !/Could not find/.test(ins.error) && studio.sharedAvailable === false);
  studio.sharedAvailable = true;
  // remover um aluno só-estúdio deixa as sessões do parceiro sem pacote (não penduradas num pacote que já não existe)
  reset();
  STUDENTS = [{id: "a", name: "Ana Silva", active: true, studioOnly: true}, {id: "b", name: "Bruno Silva", active: true}];
  studio.packs = [pack("pa", "a", 10, {shared_with: ["b"]})]; studio.sessions = [ses(1, "b", "pa"), ses(2, "a", "pa")];
  await removeStudioOnlyStudent(STUDENTS[0]);
  check.check("43. Ao remover o dono de um pacote partilhado, as sessões do parceiro ficam sem pacote (não penduradas)", studio.sessions.length === 1 && studio.sessions[0].student_id === "b" && studio.sessions[0].pack_id === null && studio.packs.length === 0);
  // o formulário de novo pacote: sem a migração não mostra «Partilhado com»; o resto do texto
  STUDENTS = [{id: "a", name: "Ana Silva", active: true}, {id: "b", name: "Bruno Silva", active: true}];
  studio.sharedAvailable = false;
  check.check("44. Sem a migração, a ficha não mostra «Partilhado com»", !/id="pkShare"/.test(tplProSessoes(STUDENTS[0])));
  studio.sharedAvailable = true;


check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e && e.stack || e); process.exit(1); });
