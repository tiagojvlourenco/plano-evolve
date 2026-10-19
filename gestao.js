/* EVOLVE — Gestão (estúdio, contratos, pacotes, aulas, recebimentos, horas e Google Agenda).
   Só o profissional descarrega este ficheiro (index.html carrega-o depois do início de sessão com loadGestao()).
   O código é avaliado dentro do scope da app (eval direto), por isso usa os mesmos auxiliares do núcleo
   (STUDENTS, state, sb, openModal, escapeHtml, …); o que o núcleo precisa de chamar fica em G, no fim do ficheiro.
   Os testes juntam este ficheiro ao script de index.html (tests/extract-app.js). */
/* ---------- Estúdio: pacotes de sessões, presenças/faltas e cobranças (migração 0023, só o profissional) ----------
   Regras (por pacote, editáveis ao criá-lo): sessão "feita" gasta uma sessão; "faltou" (sem aviso) e "cancelou tarde" gastam também por omissão;
   "cancelou" a tempo nunca gasta. A app regista e avisa; não cobra nem emite faturas (a fatura certificada continua no programa de faturação). */
var STUDIO_LOCAL_KEY = "evolve_studio_v1";
var STUDIO_HISTORY_DAYS = 400;       // sessões mais antigas não se carregam
var PACK_ENDING_DAYS = 14;           // ...ou falta este tempo para terminar a validade
var PAYMENT_DUE_SOON_DAYS = 3;
// validade de cada tipo de pack = duração do pack + 3 meses de margem: um trimestral pago a 14/01 dura até 14/04 e vale até 14/07;
// o mensal, como se paga todos os meses, vale 3 meses a partir do mês em que paga
var PACK_VALIDITY_EXTRA_MONTHS = 3;
var PACK_TYPES = {
  mensal: {label: "Mensal", lengthMonths: 1, months: 3},
  trimestral: {label: "Trimestral", lengthMonths: 3, months: 3 + PACK_VALIDITY_EXTRA_MONTHS},
  semestral: {label: "Semestral", lengthMonths: 6, months: 6 + PACK_VALIDITY_EXTRA_MONTHS},
  anual: {label: "Anual", lengthMonths: 12, months: 12 + PACK_VALIDITY_EXTRA_MONTHS}
};
// meses de validade de um tipo de pack escrito por extenso («Trimestral»…); null se não for um tipo conhecido
function packTypeMonths(text){
  var k = String(text == null ? "" : text).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
  return Object.prototype.hasOwnProperty.call(PACK_TYPES, k) ? PACK_TYPES[k].months : null;
}
// soma meses a uma data AAAA-MM-DD sem passar ao mês seguinte (30/11 + 3 meses = 28/02 ou 29/02, não 2/03)
function addMonthsISO(iso, n){
  var d = new Date(iso + "T00:00:00Z"), day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
  var last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}
var SESSION_STATUS = {
  feita: {label: "Feita", short: "✓ Feita"},
  faltou: {label: "Faltou", short: "✗ Faltou"},
  cancelada: {label: "Cancelou a tempo", short: "⊘ Cancelou"},
  cancelada_tarde: {label: "Cancelou tarde", short: "⊘ Tarde"},
  agendada: {label: "Agendada", short: "◷ Agendada"}   // prevista (da folha); não gasta aulas do pacote
};
var PAYMENT_METHODS = {mbway: "MB WAY", transferencia: "Transferência", multibanco: "Multibanco", numerario: "Numerário", outro: "Outro"};
var studio = {packs: [], sessions: [], payments: [], slots: [], loaded: false, available: true, slotsAvailable: false, sharedAvailable: true};

function studioLocalRead(){
  try { var v = JSON.parse(localStorage.getItem(STUDIO_LOCAL_KEY) || "null"); if (v && Array.isArray(v.packs)) return v; } catch (e) {}
  return null;
}
function studioLocalWrite(){ try { localStorage.setItem(STUDIO_LOCAL_KEY, JSON.stringify({packs: studio.packs, sessions: studio.sessions, payments: studio.payments, slots: studio.slots})); } catch (e) {} }
var STUDIO_TABLES = {packs: "session_packs", sessions: "sessions", payments: "payments", slots: "session_slots"};
// o servidor devolve no máximo ~1000 linhas por pedido: com mais sessões (a agenda traz centenas) lê-se por páginas,
// senão as mais antigas ficavam por ler e a app voltava a tentar criá-las (erros de "duplicada") e contava mal os pacotes
var STUDIO_PAGE = 500;
function studioFetchSessions(from){
  var all = [];
  function page(n){
    return Promise.resolve(sb.from("sessions").select("*").gte("date", from).order("date", {ascending: false}).order("id", {ascending: true}).range(n * STUDIO_PAGE, n * STUDIO_PAGE + STUDIO_PAGE - 1).then(function(r){ return r; })).then(function(res){
      if (!res || res.error) return res || {error: {message: "erro"}};
      var d = res.data || [];
      all = all.concat(d);
      if (d.length < STUDIO_PAGE || n >= 200) return {data: all};
      return page(n + 1);
    });
  }
  return page(0);
}
function studioLoad(){
  if (!sbReady){
    var v = studioLocalRead();
    if (v){ studio.packs = v.packs; studio.sessions = v.sessions || []; studio.payments = v.payments || []; studio.slots = v.slots || []; }
    else { studioSeedDemo(); studioLocalWrite(); }
    studio.loaded = true; studio.available = true; studio.slotsAvailable = true; studio.sharedAvailable = true;
    return Promise.resolve(true);
  }
  var since = new Date(Date.now() - STUDIO_HISTORY_DAYS * 86400000).toISOString().slice(0, 10), today = localTodayISO();
  // as sessões lêem-se desde o início do pacote mais antigo ainda em vigor (senão as sessões usadas ficavam por contar)
  return Promise.all([
    sb.from("session_packs").select("*").order("starts_on", {ascending: false}).then(function(r){ return r; }),
    sb.from("payments").select("*").order("due_on", {ascending: false}).then(function(r){ return r; })
  ]).then(function(r){
    if (r.some(function(x){ return !x || x.error; })) return null;
    var packs = r[0].data || [], from = since;
    packs.forEach(function(p){ if ((!p.expires_on || p.expires_on >= today) && p.starts_on && p.starts_on < from) from = p.starts_on; });
    return studioFetchSessions(from).then(function(sr){
      if (!sr || sr.error) return null;
      return {packs: packs, payments: r[1].data || [], sessions: sr.data || []};
    });
  }).then(function(all){
    if (!all){ studio.available = false; studio.loaded = true; return false; }
    studio.packs = all.packs; studio.sessions = all.sessions; studio.payments = all.payments;
    studio.sharedAvailable = !all.packs.length || Object.prototype.hasOwnProperty.call(all.packs[0], "shared_with"); // falta correr a migração 0028?
    studio.available = true; studio.loaded = true;
    return Promise.resolve(sb.from("session_slots").select("*").order("weekday").then(function(r){ return r; })).then(function(sr){
      studio.slotsAvailable = !!(sr && !sr.error); studio.slots = studio.slotsAvailable ? (sr.data || []) : [];
      return true;
    }, function(){ studio.slotsAvailable = false; studio.slots = []; return true; });
  }).catch(function(){ studio.available = false; studio.loaded = true; return false; });
}
// grava no servidor (ou no browser, em modo local) e só depois altera a memória
function studioInsert(kind, row){
  if (!sbReady){ var r = Object.assign({id: uidShort("s")}, row); studio[kind].unshift(r); studioLocalWrite(); return Promise.resolve({data: r}); }
  return Promise.resolve(sb.from(STUDIO_TABLES[kind]).insert(row).select("*")).then(function(res){
    if (kind === "packs" && row && row.shared_with && res && res.error && /shared_with/.test(res.error.message || "")){ studio.sharedAvailable = false; return {error: SHARED_MIGRATION_MSG}; }
    if (!res || res.error || !res.data || !res.data[0]) return {error: (res && res.error && res.error.message) || "Não foi possível guardar — verifica a ligação (e se a migração 0023 já foi corrida)."};
    studio[kind].unshift(res.data[0]);
    return {data: res.data[0]};
  }, function(){ return {error: "Não foi possível guardar — verifica a ligação."}; });
}
function studioUpdate(kind, id, patch){
  var apply = function(){ var row = studio[kind].filter(function(x){ return x.id === id; })[0]; if (row) Object.assign(row, patch); };
  if (!sbReady){ apply(); studioLocalWrite(); return Promise.resolve({}); }
  return Promise.resolve(sb.from(STUDIO_TABLES[kind]).update(patch).eq("id", id)).then(function(res){
    if (!res || res.error) return {error: (res && res.error && res.error.message) || "Não foi possível guardar."};
    apply(); return {};
  }, function(){ return {error: "Não foi possível guardar — verifica a ligação."}; });
}
function studioDelete(kind, id){
  var apply = function(){ studio[kind] = studio[kind].filter(function(x){ return x.id !== id; }); if (kind === "packs") studio.sessions.concat(studio.payments).forEach(function(x){ if (x.pack_id === id) x.pack_id = null; }); };
  if (!sbReady){ apply(); studioLocalWrite(); return Promise.resolve({}); }
  return Promise.resolve(sb.from(STUDIO_TABLES[kind]).delete().eq("id", id)).then(function(res){
    if (!res || res.error) return {error: "Não foi possível apagar."};
    apply(); return {};
  }, function(){ return {error: "Não foi possível apagar — verifica a ligação."}; });
}

// ---- regras ----
function sessionConsumes(pack, sess){
  if (!pack || !sess) return false;
  if (sess.status === "feita") return true;
  if (sess.status === "faltou") return pack.missed_consumes !== false;
  if (sess.status === "cancelada_tarde") return pack.late_cancel_consumes !== false;
  return false;
}
function packUsage(pack, today){
  today = today || localTodayISO();
  var used = (Number(pack.used_before) || 0) + studio.sessions.filter(function(x){ return x.pack_id === pack.id && sessionConsumes(pack, x); }).length;
  var total = Number(pack.total) || 0, remaining = Math.max(0, total - used);
  var expired = !!pack.expires_on && pack.expires_on < today;
  var daysLeft = pack.expires_on ? Math.round((new Date(pack.expires_on + "T00:00:00Z") - new Date(today + "T00:00:00Z")) / 86400000) : null;
  var started = !pack.starts_on || pack.starts_on <= today;
  return {used: used, total: total, remaining: remaining, pct: total ? Math.min(100, Math.round(used / total * 100)) : 0, expired: expired, exhausted: remaining === 0,
    daysLeft: daysLeft, active: started && !expired && remaining > 0,
    ending: started && !expired && remaining > 0 && (remaining <= Math.max(PACK_ENDING_SESSIONS, weeklySlotsOfPack(pack)) || (daysLeft != null && daysLeft <= PACK_ENDING_DAYS))};
}
function packsOf(studentId){ return studio.packs.filter(function(p){ return p.student_id === studentId; }); }
// ---- pacotes partilhados (migração 0028): casais que treinam sozinhos e juntos com um só pagamento ----
// um pacote tem um dono (student_id) e, em shared_with, os outros alunos que também podem gastar as suas aulas; as sessões de todos descontam ao mesmo pacote
function sharedIdsOf(pack){ return pack && Array.isArray(pack.shared_with) ? pack.shared_with.filter(function(x, i, a){ return typeof x === "string" && x && a.indexOf(x) === i; }) : []; }
// os pacotes que um aluno pode gastar: os seus e os que outros partilham com ele
// parceiros: quem partilha pacotes com o aluno, em qualquer sentido (basta partilhar num dos pacotes do casal para os dois poderem gastar os pacotes um do outro)
function partnersOf(studentId){
  var out = [];
  function add(id){ if (id && id !== studentId && out.indexOf(id) < 0 && findStudent(id)) out.push(id); }
  studio.packs.forEach(function(p){
    if (p.student_id === studentId) sharedIdsOf(p).forEach(add);
    else if (sharedIdsOf(p).indexOf(studentId) >= 0) add(p.student_id);
  });
  return out;
}
// quem pode gastar o pacote: o dono, os que o dono marcou e os parceiros do dono
function effectiveSharedIdsOf(pack){ var ids = sharedIdsOf(pack).slice(); partnersOf(pack.student_id).forEach(function(id){ if (ids.indexOf(id) < 0) ids.push(id); }); return ids; }
function usablePacksOf(studentId){ var partners = partnersOf(studentId); return studio.packs.filter(function(p){ return p.student_id === studentId || partners.indexOf(p.student_id) >= 0 || sharedIdsOf(p).indexOf(studentId) >= 0; }); }
// quem gasta deste pacote: o dono e os alunos com quem está partilhado
function packMembersOf(pack){ var ids = [pack.student_id]; effectiveSharedIdsOf(pack).forEach(function(id){ if (ids.indexOf(id) < 0) ids.push(id); }); return ids; }
function isSharedPack(pack){ return effectiveSharedIdsOf(pack).length > 0; }
// nomes dos outros alunos do pacote (os apagados ficam de fora)
// o primeiro aluno ativo do pacote (o dono, se estiver ativo): é a quem se lembra a renovação
function packActiveMember(pack){ var ids = packMembersOf(pack); for (var i = 0; i < ids.length; i++){ var m = findStudent(ids[i]); if (m && isStudentActive(m)) return m; } return null; }
function packHasActiveMember(pack){ return !!packActiveMember(pack); }
function packOtherNames(pack, viewerId){ return packMembersOf(pack).filter(function(id){ return id !== viewerId && findStudent(id); }).map(nameOf); }
// quem gastou aulas deste pacote (por aluno): numa partilha, o nome de cada um aparece na contagem
function packUsageByStudent(pack){
  var by = {}, order = [];
  studio.sessions.forEach(function(x){ if (x.pack_id === pack.id && sessionConsumes(pack, x)){ if (!by[x.student_id]){ by[x.student_id] = 0; order.push(x.student_id); } by[x.student_id]++; } });
  return order.map(function(id){ return {id: id, name: findStudent(id) ? nameOf(id) : "aluno removido", n: by[id]}; });
}
function weeklySlotsOfPack(pack){ return packMembersOf(pack).reduce(function(n, id){ return n + weeklySlotsOf(id); }, 0); }
// o conjunto de aulas que um aluno pode gastar (os seus pacotes + os partilhados), sem repetir
function poolOf(studentId, today){
  var out = {used: 0, total: 0, remaining: 0, packs: 0, shared: false};
  usablePacksOf(studentId).forEach(function(p){
    var u = packUsage(p, today); if (u.expired || (p.starts_on && p.starts_on > today)) return;
    out.used += u.used; out.total += u.total; out.remaining += u.remaining; out.packs++;
    if (isSharedPack(p) || p.student_id !== studentId) out.shared = true;
  });
  return out;
}
// «a acabar» num pacote partilhado olha para o conjunto: só acaba quando acabam as aulas de todos os pacotes dos alunos envolvidos
function packEndingInPool(pack, today){
  var u = packUsage(pack, today);
  if (!u.ending || !isSharedPack(pack)) return u.ending;
  var seen = {}, rest = 0, slots = 0;
  packMembersOf(pack).forEach(function(id){
    slots += weeklySlotsOf(id);
    usablePacksOf(id).forEach(function(p){ if (seen[p.id]) return; seen[p.id] = true; var q = packUsage(p, today); if (q.active) rest += q.remaining; });
  });
  return rest <= Math.max(PACK_ENDING_SESSIONS, slots) || (u.daysLeft != null && u.daysLeft <= PACK_ENDING_DAYS);
}
function activePacksOf(studentId, today){
  return usablePacksOf(studentId).filter(function(p){ return packUsage(p, today).active; }).sort(function(a, b){
    return (a.expires_on || "9999") < (b.expires_on || "9999") ? -1 : (a.expires_on || "9999") > (b.expires_on || "9999") ? 1 : (a.starts_on < b.starts_on ? -1 : 1);
  });
}
// o pacote a que uma sessão numa certa data deve ser descontada: o que caduca primeiro, dentro da validade e com sessões por usar
// (nos pacotes partilhados, a igualdade de validade resolve-se a favor do pacote do próprio aluno; quando o seu acaba, gasta o do outro)
function pickPackForSession(studentId, date, simUsed){
  var d = isIsoDate(date) ? date : localTodayISO();
  var own = studio.packs.filter(function(p){ return p.student_id === studentId; });
  var firstOwnStart = own.reduce(function(m, p){ return p.starts_on && (!m || p.starts_on < m) ? p.starts_on : m; }, null);
  // as aulas de um aluno que tem pacote próprio, dadas antes de esse pacote começar, não gastam o pacote de outra pessoa (eram de um pacote anterior)
  var mayShare = !firstOwnStart || d >= firstOwnStart;
  return usablePacksOf(studentId).filter(function(p){
    var u = packUsage(p, d), rem = simUsed && simUsed[p.id] != null ? Math.max(0, (Number(p.total) || 0) - simUsed[p.id]) : u.remaining;   // simUsed: contagens simuladas (aulas previstas)
    return rem > 0 && (!p.starts_on || p.starts_on <= d) && (!p.expires_on || p.expires_on >= d) && (p.student_id === studentId || mayShare);
  }).sort(function(a, b){
    // o que caduca primeiro; com a mesma validade, o mais antigo (as aulas que restam no pacote do parceiro gastam-se antes do pacote novo); no empate, o do próprio aluno
    var ea = a.expires_on || "9999", eb = b.expires_on || "9999";
    if (ea !== eb) return ea < eb ? -1 : 1;
    var sa = a.starts_on || "", sb = b.starts_on || "";
    if (sa !== sb) return sa < sb ? -1 : 1;
    return (a.student_id === studentId ? 0 : 1) - (b.student_id === studentId ? 0 : 1);
  })[0] || null;
}
// volta a ligar as aulas dos alunos com pacotes partilhados ao pacote certo, por ordem de data (corrige aulas que ficaram no pacote do parceiro)
function reassignSharedPackSessions(){
  var ids = {};
  studio.packs.forEach(function(p){ if (isSharedPack(p)) packMembersOf(p).forEach(function(id){ ids[id] = true; }); });
  var list = studio.sessions.filter(function(x){ return ids[x.student_id] && x.status !== "agendada" && x.pack_id !== undefined; })
    .sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || "") < (b.time || "") ? -1 : (a.time || "") > (b.time || "") ? 1 : 0; });
  if (!list.length) return Promise.resolve(0);
  var before = {}; list.forEach(function(x){ before[x.id] = x.pack_id || null; x.pack_id = null; });
  list.forEach(function(x){ var pk = sessionConsumes({missed_consumes: true, late_cancel_consumes: true}, x) ? pickPackForSession(x.student_id, x.date) : null; x.pack_id = pk ? pk.id : null; });
  var changed = list.filter(function(x){ return (x.pack_id || null) !== before[x.id]; });
  var chain = Promise.resolve(0);
  changed.forEach(function(x){
    var now = x.pack_id, was = before[x.id];
    x.pack_id = was;   // o estado em memória só muda se a gravação correr bem
    chain = chain.then(function(n){ return studioUpdate("sessions", x.id, {pack_id: now}).then(function(r){ if (!r.error) x.pack_id = now; return n + (r.error ? 0 : 1); }); });
  });
  return chain;
}
// o número da aula dentro do pacote (todas as pessoas que o gastam, por ordem de data); as previstas (agendadas) levam o número que terão
function sessionNumberMap(){
  var map = {}, byTime = function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || "") < (b.time || "") ? -1 : (a.time || "") > (b.time || "") ? 1 : (a.id < b.id ? -1 : 1); };
  var used = {};
  studio.packs.forEach(function(p){
    var base = Number(p.used_before) || 0, total = Number(p.total) || 0;
    var list = studio.sessions.filter(function(x){ return x.pack_id === p.id && sessionConsumes(p, x); }).sort(byTime);
    list.forEach(function(x, i){ map[x.id] = {n: base + i + 1, total: total, over: base + i + 1 > total}; });
    used[p.id] = base + list.length;
  });
  studio.sessions.filter(function(x){ return x.status === "agendada" && !x.pack_id; }).sort(byTime).forEach(function(x){
    var pk = pickPackForSession(x.student_id, x.date, used);
    if (!pk) return;
    used[pk.id] = (used[pk.id] || 0) + 1;
    map[x.id] = {n: used[pk.id], total: Number(pk.total) || 0, projected: true};
  });
  return map;
}
function sessionNumberPill(info){
  if (!info) return "";
  return "<span class=\"pill" + (info.projected ? "" : " good") + "\" title=\"" + (info.projected ? "Número previsto da aula no pacote" : "Número da aula no pacote") + "\" style=\"" + (info.projected ? "opacity:.75;" : "") + "\">Aula " + info.n + "/" + info.total + "</span>";
}
function sessionsOfStudent(studentId){ return studio.sessions.filter(function(x){ return x.student_id === studentId; }).sort(function(a, b){ return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }); }
function paymentStatus(p, today){
  today = today || localTodayISO();
  if (p.paid_on) return "pago";
  if (p.due_on < today) return "atrasado";
  var days = Math.round((new Date(p.due_on + "T00:00:00Z") - new Date(today + "T00:00:00Z")) / 86400000);
  return days <= PAYMENT_DUE_SOON_DAYS ? "a vencer" : "futuro";
}
function paymentsOfStudent(studentId){ return studio.payments.filter(function(p){ return p.student_id === studentId; }).sort(function(a, b){ return a.due_on < b.due_on ? 1 : -1; }); }
function eurShort(n){ var v = Math.round((Number(n) || 0) * 100) / 100; return (v === Math.round(v) ? String(v) : v.toFixed(2).replace(".", ",")) + " €"; }
function monthOf(iso){ return String(iso || "").slice(0, 7); }
function studentById(id){ return findStudent(id); }

// resumo de um aluno para o painel de retenção e para a ficha
function studentStudioSummary(studentId, today){
  today = today || localTodayISO();
  var packs = usablePacksOf(studentId).map(function(p){ return {pack: p, u: packUsage(p, today), shared: p.student_id !== studentId || isSharedPack(p), foreign: p.student_id !== studentId}; });
  var overdue = paymentsOfStudent(studentId).filter(function(p){ return paymentStatus(p, today) === "atrasado"; });
  var since = addDaysISO(today, -ABSENCE_WINDOW_DAYS);
  var absences = studio.sessions.filter(function(x){ return x.student_id === studentId && x.date >= since && (x.status === "faltou" || x.status === "cancelada_tarde"); }).length;
  var activeOrRecent = packs.filter(function(x){ return x.u.active || (x.u.exhausted && x.pack.starts_on >= addDaysISO(today, -90)); });
  var hasActive = packs.some(function(x){ return x.u.active; });
  var ending = packs.filter(function(x){ return packEndingInPool(x.pack, today); });
  // já teve pacote há pouco tempo e já não tem nenhum a decorrer: falta renovar
  return {packs: packs, overdue: overdue, absences: absences, hasActive: hasActive, ending: ending,
    needsRenewal: !hasActive && packs.some(function(x){ return x.pack.starts_on >= addDaysISO(today, -120); }), activeOrRecent: activeOrRecent};
}

// números do estúdio num mês (AAAA-MM)
function studioKpis(month, today){
  today = today || localTodayISO(); month = month || monthOf(today);
  var unpaid = studio.payments.filter(function(p){ return !p.paid_on; });
  var dueMonth = unpaid.filter(function(p){ return monthOf(p.due_on) === month && p.due_on >= today; });
  var overdue = unpaid.filter(function(p){ return p.due_on < today; });
  var sum = function(list){ return list.reduce(function(a, p){ return a + (Number(p.amount) || 0); }, 0); };
  var ms = studio.sessions.filter(function(x){ return monthOf(x.date) === month; });
  var done = ms.filter(function(x){ return x.status === "feita"; }).length;
  var missed = ms.filter(function(x){ return x.status === "faltou" || x.status === "cancelada_tarde"; }).length;
  var ending = studio.packs.filter(function(p){ return packHasActiveMember(p) && packEndingInPool(p, today); });
  var paidMonth = studio.payments.filter(function(p){ return p.paid_on && monthOf(p.paid_on) === month; });
  return {toCollect: sum(dueMonth), toCollectN: dueMonth.length, overdue: sum(overdue), overdueN: overdue.length, endingN: ending.length, missed: missed, done: done,
    attendance: done + missed ? Math.round(done / (done + missed) * 100) : null, received: sum(paidMonth), receivedN: paidMonth.length};
}

function csvCell(v){ var t = String(v == null ? "" : v); return /[;"\n\r]/.test(t) ? "\"" + t.replace(/"/g, "\"\"") + "\"" : t; }
function csvOf(rows){ return rows.map(function(r){ return r.map(csvCell).join(";"); }).join("\r\n"); }
function nameOf(studentId){ var st = findStudent(studentId); return st ? st.name : studentId; }
function paymentsCsv(month){
  var rows = [["Aluno", "Vencimento", "Valor (€)", "Estado", "Pago em", "Método", "Notas"]];
  studio.payments.filter(function(p){ return monthOf(p.due_on) === month || (p.paid_on && monthOf(p.paid_on) === month); }).sort(function(a, b){ return a.due_on < b.due_on ? -1 : 1; }).forEach(function(p){
    rows.push([nameOf(p.student_id), p.due_on, String(Number(p.amount).toFixed(2)).replace(".", ","), paymentStatus(p), p.paid_on || "", PAYMENT_METHODS[p.method] || "", p.notes || ""]);
  });
  return csvOf(rows);
}
function sessionsCsv(month){
  var rows = [["Aluno", "Data", "Hora", "Estado", "Pacote", "Notas"]];
  studio.sessions.filter(function(x){ return monthOf(x.date) === month; }).sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }).forEach(function(x){
    var pk = studio.packs.filter(function(p){ return p.id === x.pack_id; })[0];
    rows.push([nameOf(x.student_id), x.date, x.time || "", (SESSION_STATUS[x.status] || {}).label || x.status, pk ? pk.name : "", x.notes || ""]);
  });
  return csvOf(rows);
}
function downloadText(filename, text){
  try {
    var blob = new Blob(["﻿" + text], {type: "text/csv;charset=utf-8"});
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(function(){ try { URL.revokeObjectURL(a.href); a.remove(); } catch (e) {} }, 500);
    return true;
  } catch (e) { return false; }
}

// ---- horário semanal: as sessões contam-se sozinhas à medida que o dia passa (migração 0024) ----
var SESSION_DURATION_MIN = 60;          // uma sessão de hoje só se conta depois da hora + esta duração
var WEEKDAY_NAMES = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
function isoWeekday(dateISO){ var w = new Date(dateISO + "T00:00:00Z").getUTCDay(); return w === 0 ? 7 : w; }
function timeToMinutes(t){ var m = /^(\d{2}):(\d{2})$/.exec(String(t || "")); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null; }
function slotsOf(studentId){ return studio.slots.filter(function(x){ return x.student_id === studentId; }).sort(function(a, b){ return a.weekday - b.weekday || (a.time < b.time ? -1 : 1); }); }
function weeklySlotsOf(studentId){ return studio.slots.filter(function(x){ return x.student_id === studentId; }).length; }
function slotLabel(sl){ return WEEKDAY_NAMES[sl.weekday] + " " + sl.time; }
// já existe um registo para este horário nesse dia? (uma sessão sem hora, registada à mão, também ocupa o dia)
function sessionExistsFor(studentId, date, time){
  return studio.sessions.some(function(x){ return x.student_id === studentId && x.date === date && (!x.time || x.time === time); });
}
// as sessões do horário que já passaram e ainda não estão registadas: [{slot, date}] por ordem de data
// now = {date: "AAAA-MM-DD", minutes: minutos desde a meia-noite}
function agendaDue(now){
  var out = [];
  studio.slots.forEach(function(sl){
    var st = findStudent(sl.student_id);
    if (!st || !isStudentActive(st)) return;
    var from = sl.counts_from || now.date;
    if (sl.generated_until && addDaysISO(sl.generated_until, 1) > from) from = addDaysISO(sl.generated_until, 1);
    var t = timeToMinutes(sl.time);
    for (var d = from; d <= now.date; d = addDaysISO(d, 1)){
      if (isoWeekday(d) !== sl.weekday) continue;
      if (d === now.date && (t == null || now.minutes < t + SESSION_DURATION_MIN)) continue; // ainda não passou
      if (sessionExistsFor(sl.student_id, d, sl.time)) continue;
      out.push({slot: sl, date: d});
    }
  });
  return out.sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
}
// insere várias linhas de uma vez (uma só ida ao servidor); em modo local grava no browser
function studioInsertMany(kind, rows){
  if (!rows.length) return Promise.resolve({data: []});
  if (!sbReady){
    var made = rows.map(function(r){ return Object.assign({id: uidShort("s")}, r); });
    made.forEach(function(r){ studio[kind].unshift(r); });
    studioLocalWrite();
    return Promise.resolve({data: made});
  }
  return Promise.resolve(sb.from(STUDIO_TABLES[kind]).insert(rows).select("*")).then(function(res){
    if (!res || res.error || !Array.isArray(res.data)) return {error: (res && res.error && res.error.message) || "erro", code: res && res.error && res.error.code};
    res.data.forEach(function(r){ studio[kind].unshift(r); });
    return {data: res.data};
  }, function(){ return {error: "rede"}; });
}
var agendaRunning = null;
// conta as sessões do horário que já passaram (desconta ao pacote certo) e avança "contado até" de cada horário; devolve quantas criou
function studioAutoSessions(){
  if (!studio.loaded || !studio.available || !studio.slotsAvailable) return Promise.resolve(0);
  if (calUsesCalendar()){
    // o Google Agenda é a fonte: o horário semanal fica em pausa, mas avança, para não inventar aulas retroativas se voltares a ele
    var yday = addDaysISO(localTodayISO(), -1);
    studio.slots.filter(function(sl){ return !sl.generated_until || sl.generated_until < yday; }).forEach(function(sl){ studioUpdate("slots", sl.id, {generated_until: yday}); });
    return Promise.resolve(0);
  }
  if (agendaRunning) return agendaRunning;
  var now = new Date(), today = localTodayISO(), nowInfo = {date: today, minutes: now.getHours() * 60 + now.getMinutes()};
  var due = agendaDue(nowInfo);
  var yesterday = addDaysISO(today, -1);
  var rows = [];
  // o pacote de cada sessão decide-se por ordem de data, contando as que acabámos de decidir
  var virtual = [];
  due.forEach(function(x){
    var pk = pickPackForSession(x.slot.student_id, x.date);
    var row = {student_id: x.slot.student_id, pack_id: pk ? pk.id : null, date: x.date, time: x.slot.time, status: "feita", source: "agenda"};
    rows.push(row);
    var v = {id: "virtual-" + virtual.length, student_id: row.student_id, pack_id: row.pack_id, date: row.date, time: row.time, status: "feita"};
    virtual.push(v); studio.sessions.push(v);
  });
  studio.sessions = studio.sessions.filter(function(x){ return virtual.indexOf(x) < 0; });
  var advance = function(){
    // todos os horários passam a "contados até ontem" (hoje ainda pode ter sessões por passar, que se avaliam de novo)
    return Promise.all(studio.slots.filter(function(sl){ return !sl.generated_until || sl.generated_until < yesterday; }).map(function(sl){
      return studioUpdate("slots", sl.id, {generated_until: yesterday});
    }));
  };
  agendaRunning = studioInsertMany("sessions", rows).then(function(r){
    if (r.error){
      // uma duplicada (outro aparelho contou primeiro) não pode impedir as restantes: tenta uma a uma
      if (r.code === "23505" && rows.length > 1) return rows.reduce(function(chain, row){ return chain.then(function(n){ return studioInsert("sessions", row).then(function(x){ return n + (x.error ? 0 : 1); }); }); }, Promise.resolve(0)).then(function(n){ return advance().then(function(){ return n; }); });
      return 0;
    }
    return advance().then(function(){ return r.data.length; });
  }).then(function(n){ agendaRunning = null; return n; }, function(){ agendaRunning = null; return 0; });
  return agendaRunning;
}
// lê os dados do estúdio e conta as sessões do horário que já passaram
function studioRefresh(){
  var mode = sbReady; // se a ligação à base de dados mudar entretanto (testes, início de sessão), não se conta nada com os dados de outro modo
  return Promise.all([studioLoad(), calLoadSettings(), loadMonthlyHours()]).then(function(r){ var ok = r[0]; return ok && sbReady === mode ? studioAutoSessions() : 0; }).then(function(n){ updateStudioBadge(); return n; });
}
function wireCalendarCard(main, redraw){
  var card = main.querySelector("#gcalCard");
  if (!card) return;
  function out(msg, bad){ var o = card.querySelector("#gcOut") || card.querySelector("#gcErr"); if (o){ o.textContent = msg; o.style.color = bad ? "var(--critical)" : ""; o.style.display = "block"; } }
  var save = card.querySelector("#gcSave");
  if (save) save.addEventListener("click", function(){
    var id = card.querySelector("#gcClient").value.trim();
    if (!/^[\w.\-]+\.apps\.googleusercontent\.com$/i.test(id)){ out("Isto não parece um ID de cliente do Google (termina em .apps.googleusercontent.com).", true); return; }
    calSettings.clientId = id; save.disabled = true;
    calSaveSettings().then(function(r){ if (r.error){ calSettings.clientId = ""; save.disabled = false; out(r.error, true); return; } showToast("✓ Guardado — agora sincroniza"); redraw(); });
  });
  var sync = card.querySelector("#gcSync");
  if (sync) sync.addEventListener("click", function(){
    var cal = card.querySelector("#gcCal").value.trim() || "primary";
    if (cal !== calSettings.calendarId){ calSettings.calendarId = cal; }
    var pre = card.querySelector("#gcPrefix"); if (pre) calSettings.titlePrefix = pre.value.trim().slice(0, 30);
    sync.disabled = true; out("A pedir autorização ao Google e a ler a agenda…");
    runCalendarSync().then(function(sum){ var fx = sum && sum.fixed; showToast("✓ Agenda sincronizada" + (fx && fx.sessions ? " · " + fx.sessions + (fx.sessions === 1 ? " aula acertada" : " aulas acertadas") + " em " + fx.students + (fx.students === 1 ? " aluno" : " alunos") : "")); updateStudioBadge(); redraw(); }, function(e){ sync.disabled = false; out(e && e.message ? e.message : "Não foi possível sincronizar.", true); });
  });
  var tog = card.querySelector("#gcToggle");
  if (tog) tog.addEventListener("click", function(){
    if (!calSettings.useAsSource && !window.confirm("Usar o Google Agenda como fonte das sessões? O horário semanal deixa de contar sessões (as já contadas ficam).")) return;
    calSettings.useAsSource = !calSettings.useAsSource;
    calSaveSettings().then(function(r){ if (r.error){ calSettings.useAsSource = !calSettings.useAsSource; showToast("⚠ " + r.error); } redraw(); });
  });
  var off = card.querySelector("#gcOff");
  if (off) off.addEventListener("click", function(){
    if (!window.confirm("Desligar o Google Agenda? As sessões já contadas ficam; deixa de se ler o calendário.")) return;
    calSettings.clientId = ""; calSettings.useAsSource = false; calSettings.lastSync = null;
    calSaveSettings().then(function(){ redraw(); });
  });
  var ignoreBtn = card.querySelector("#gcIgnore");
  if (ignoreBtn) ignoreBtn.addEventListener("click", function(){
    var cands = calStudentCandidates(calSettings.lastSync && calSettings.lastSync.unmatched), n = 0;
    card.querySelectorAll("[data-gc-new]").forEach(function(cb){
      var c = cands[parseInt(cb.getAttribute("data-gc-new"), 10)];
      if (cb.checked || !c) return;
      c.titles.forEach(function(t){ calSettings.ignored[calTitleKey(t)] = true; });
      n++;
    });
    if (!n){ var o0 = card.querySelector("#gcNewOut"); if (o0){ o0.textContent = "Não há nomes por selecionar."; o0.style.display = "block"; } return; }
    if (!window.confirm("Ignorar " + n + (n === 1 ? " nome" : " nomes") + "? Deixam de aparecer nas próximas sincronizações.")) return;
    calSettings.lastSync.unmatched = calSettings.lastSync.unmatched.filter(function(u){ return !calIsIgnored(calSettings.ignored, u.title); });
    calSaveSettings().then(function(){ showToast("✓ " + n + (n === 1 ? " nome ignorado" : " nomes ignorados")); redraw(); });
  });
  var ignoreAll = card.querySelector("#gcIgnoreAll");
  if (ignoreAll) ignoreAll.addEventListener("click", function(){
    var total = (calSettings.lastSync && calSettings.lastSync.unmatched || []).filter(function(u){ return !calIsIgnored(calSettings.ignored, u.title); }).length;
    if (!window.confirm("Ignorar todos os " + total + " títulos sem aluno (por exemplo clientes cancelados)? Deixam de aparecer nas próximas sincronizações e as aulas deles não contam.")) return;
    var n = calIgnoreAllUnmatched();
    calSaveSettings().then(function(){ showToast("✓ " + n + (n === 1 ? " título ignorado" : " títulos ignorados")); redraw(); });
  });
  var create = card.querySelector("#gcCreate");
  if (create) create.addEventListener("click", function(){
    var cands = calStudentCandidates(calSettings.lastSync && calSettings.lastSync.unmatched), items = [];
    card.querySelectorAll("[data-gc-new]").forEach(function(cb){
      var i = parseInt(cb.getAttribute("data-gc-new"), 10), c = cands[i], inp = card.querySelector("[data-gc-name=\"" + i + "\"]");
      if (!cb.checked || !c) return;
      var name = inp ? inp.value.trim() : c.name;
      if (name) items.push({name: name, titles: c.titles});
    });
    var o = card.querySelector("#gcNewOut");
    function say(msg, bad){ if (o){ o.textContent = msg; o.style.color = bad ? "var(--critical)" : ""; o.style.display = "block"; } }
    if (!items.length){ say("Seleciona pelo menos um nome.", true); return; }
    if (!window.confirm("Criar " + items.length + (items.length === 1 ? " aluno" : " alunos") + " a partir da agenda?")) return;
    create.disabled = true; say("A criar os alunos…");
    createStudentsFromCalendar(items).then(function(r){
      var msg = "✓ " + r.made.length + (r.made.length === 1 ? " aluno criado" : " alunos criados") + (r.aliasOnly ? " · " + r.aliasOnly + " já existia" + (r.aliasOnly === 1 ? "" : "m") + (r.archived.length ? " (arquivado: " + r.archived.join(", ") + ")" : "") : "") + (r.failed.length ? " · ⚠ falhou: " + r.failed.join(", ") : "");
      msg += r.summary ? " · " + r.summary.inserted + " aulas contadas." : (r.made.length ? " · Carrega em Sincronizar para contar as aulas." : "");
      showToast(msg); updateStudioBadge(); redraw();
    }, function(e){ create.disabled = false; say(e && e.message ? e.message : "Não foi possível criar os alunos.", true); });
  });
  card.querySelectorAll("[data-gc-alias]").forEach(function(sel){ sel.addEventListener("change", function(){
    var u = calSettings.lastSync && calSettings.lastSync.unmatched[parseInt(sel.getAttribute("data-gc-alias"), 10)];
    if (!u || !sel.value) return;
    calSettings.aliases[calTitleKey(u.title)] = sel.value;
    calSettings.lastSync.unmatched = calSettings.lastSync.unmatched.filter(function(x){ return x !== u; });
    calSaveSettings().then(function(){ showToast("✓ Associado — fica para as próximas sincronizações"); redraw(); });
  }); });
}
function studioAfterAutoSessions(n){
  if (n > 0 && state.mode === "pro" && !modalRoot.firstChild){
    if (state.proView === "studio" && !state.proSelectedId) renderProStudioMain();
    else if (state.proSelectedId && state.proTab === "sessoes") renderProTabContent(findStudent(state.proSelectedId));
  }
  updateStudioBadge();
}

// ---- pacote atual, aulas extra e renovação (o que o resumo semanal por e-mail mostrava) ----
function currentPackOf(studentId, today){
  var list = usablePacksOf(studentId).slice().sort(function(a, b){ return a.starts_on < b.starts_on ? 1 : a.starts_on > b.starts_on ? -1 : 0; });
  var actives = list.filter(function(p){ return packUsage(p, today).active; });
  var active = actives.filter(function(p){ return p.student_id === studentId; })[0] || actives[0];
  if (active) return active;
  var started = list.filter(function(p){ return !p.starts_on || p.starts_on <= today; });
  return started[0] || list[0] || null;   // sem nenhum a decorrer: o mais recente
}
// aulas dadas fora de qualquer pacote, depois de o último pacote ter começado (as "aulas extra" à espera de renovação)
function extrasOf(studentId, today){
  var last = usablePacksOf(studentId).slice().sort(function(a, b){ return a.starts_on < b.starts_on ? 1 : -1; })[0];
  if (!last) return {n: 0, since: null};
  var list = studio.sessions.filter(function(x){ return x.student_id === studentId && !x.pack_id && x.date >= last.starts_on && (x.status === "feita" || x.status === "faltou" || x.status === "cancelada_tarde"); })
    .sort(function(a, b){ return a.date < b.date ? -1 : 1; });
  return {n: list.length, since: list.length ? list[0].date : null};
}
// uma linha por aluno com pacote: o que se via na tabela do e-mail (valor, total, progresso, em falta, a renovar)
function studioSummaryRows(today){
  today = today || localTodayISO();
  var rows = [];
  visibleStudentsForDashboard().filter(isStudentActive).forEach(function(st){
    var pk = currentPackOf(st.id, today);
    if (!pk) return;
    // acabou o pacote dela e está a gastar o do parceiro: a linha mostra o pacote dela (valor e aulas) e, à parte, o que está a gastar
    var spendFrom = null;
    if (pk.student_id !== st.id){
      var ownLatest = packsOf(st.id).slice().sort(function(a, b){ return a.starts_on < b.starts_on ? 1 : a.starts_on > b.starts_on ? -1 : 0; })[0];
      if (ownLatest){ spendFrom = {pack: pk, u: packUsage(pk, today), ownerName: findStudent(pk.student_id) ? nameOf(pk.student_id) : "—"}; pk = ownLatest; }
    }
    var u = packUsage(pk, today), ex = extrasOf(st.id, today);
    var hasActive = activePacksOf(st.id, today).length > 0;
    var renew = !hasActive && (u.exhausted || u.expired);
    var pending = pk.starts_on > today;
    var actives = activePacksOf(st.id, today);
    rows.push({student: st, pack: pk, spendFrom: spendFrom, u: u, extras: ex, weekly: weeklySlotsOf(st.id), pool: poolOf(st.id, today), others: packOtherNames(pk, st.id),
      activeN: actives.length, activeRemaining: actives.reduce(function(a, p){ return a + packUsage(p, today).remaining; }, 0),
      state: renew ? "renovar" : (!pending && packEndingInPool(pk, today) ? "acabar" : (pending ? "pendente" : "normal"))});
  });
  var rank = {renovar: 0, acabar: 1, normal: 2, pendente: 3};
  return rows.sort(function(a, b){ return rank[a.state] - rank[b.state] || a.u.remaining - b.u.remaining || String(a.student.name).localeCompare(String(b.student.name), "pt"); });
}
function studioAttentionCount(today){
  today = today || localTodayISO();
  var rows = studioSummaryRows(today), n = rows.filter(function(r){ return r.state === "renovar" || r.state === "acabar"; }).length;
  var overdue = studio.payments.filter(function(p){ return !p.paid_on && p.due_on < today; }).length;
  return n + overdue;
}
function studioNavLabel(){ var n = studio.loaded && studio.available ? studioAttentionCount() : 0; return "Estúdio" + (n ? " · " + n : ""); }
function gestaoAreaLabel(){ var n = studio.loaded && studio.available ? studioAttentionCount() : 0; return "Gestão" + (n ? " · " + n : ""); }
function updateStudioBadge(){
  var b = document.getElementById("navStudio");
  if (b) b.textContent = studioNavLabel();
}
// um pacote novo desconta as aulas extra já dadas desde a sua data de início
function attachExtrasToPack(pack){
  var capacity = packUsage(pack).remaining;   // só o que ainda resta (as sessões já ligadas ao pacote contam)
  var members = packMembersOf(pack);
  var list = studio.sessions.filter(function(x){ return members.indexOf(x.student_id) >= 0 && !x.pack_id && x.date >= pack.starts_on && (!pack.expires_on || x.date <= pack.expires_on) && sessionConsumes(pack, x); }).sort(function(a, b){ return a.date < b.date ? -1 : 1; }).slice(0, capacity);
  return list.reduce(function(chain, x){ return chain.then(function(n){ return studioUpdate("sessions", x.id, {pack_id: pack.id}).then(function(r){ return n + (r.error ? 0 : 1); }); }); }, Promise.resolve(0));
}

// ---- importar os pacotes que já estão a decorrer (uma linha por aluno: Nome; aulas; início; valor; aulas já dadas; validade em meses ou tipo (Mensal, Trimestral, Semestral, Anual), opcional; partilhado com…, opcional) ----
function parseImportDate(t){
  t = String(t || "").trim();
  var m = /^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/.exec(t) || (function(){ var q = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(t); return q ? [null, q[3], q[2], q[1]] : null; })();
  if (!m) return null;
  var y = +m[1], mo = +m[2], d = +m[3], iso = y + "-" + pad2(mo) + "-" + pad2(d);
  var dt = new Date(iso + "T00:00:00Z");
  return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && dt.getUTCMonth() === mo - 1 ? iso : null;
}
function parseImportNumber(t){ var n = Number(String(t == null ? "" : t).trim().replace(/[€\s]/g, "").replace(",", ".")); return isFinite(n) ? n : null; }
// ---- horas mensais de cada aluno (da folha «Dados» → «Horas mensais»): guardadas em studio_settings, chave 'monthly_hours' ----
var monthlyHours = {map: {}, loaded: false, available: true};
var HOURS_LOCAL_KEY = "evolve.monthlyHours";
function hoursOf(id){ var v = monthlyHours.map[id]; return typeof v === "number" && v > 0 ? v : null; }
function fmtHours(h){ return (Math.round(h * 100) / 100).toString().replace(".", ",") + " h"; }
function totalActiveHours(){
  return visibleStudentsForDashboard().filter(isStudentActive).reduce(function(a, st){ return a + (hoursOf(st.id) || 0); }, 0);
}
function hoursClean(v){
  var out = {};
  if (v && typeof v === "object") Object.keys(v).forEach(function(k){ var n = Number(v[k]); if (isFinite(n) && n > 0 && n <= 200) out[k] = Math.round(n * 100) / 100; });
  return out;
}
function loadMonthlyHours(){
  if (!sbReady){ try { monthlyHours.map = hoursClean(JSON.parse(localStorage.getItem(HOURS_LOCAL_KEY) || "null")); } catch (e) { monthlyHours.map = {}; } monthlyHours.loaded = true; return Promise.resolve(true); }
  return Promise.resolve(sb.from("studio_settings").select("value").eq("key", "monthly_hours").maybeSingle().then(function(r){ return r; })).then(function(res){
    if (res && res.error){ monthlyHours.available = false; monthlyHours.loaded = true; return false; }
    monthlyHours.available = true; monthlyHours.map = hoursClean(res && res.data ? res.data.value : null); monthlyHours.loaded = true; return true;
  }, function(){ monthlyHours.available = false; monthlyHours.loaded = true; return false; });
}
function saveMonthlyHours(){
  var value = hoursClean(monthlyHours.map);
  if (!sbReady){ try { localStorage.setItem(HOURS_LOCAL_KEY, JSON.stringify(value)); } catch (e) {} return Promise.resolve({}); }
  return Promise.resolve(sb.from("studio_settings").upsert({key: "monthly_hours", value: value, updated_at: new Date().toISOString()}).then(function(r){ return r; })).then(function(res){
    return res && res.error ? {error: "Não foi possível guardar as horas (a migração 0025 já foi corrida?)."} : {};
  }, function(){ return {error: "Não foi possível guardar — verifica a ligação."}; });
}
function setStudentHours(id, hours){
  var old = monthlyHours.map[id];
  if (hours > 0) monthlyHours.map[id] = hours; else delete monthlyHours.map[id];
  return saveMonthlyHours().then(function(r){ if (r.error){ if (old > 0) monthlyHours.map[id] = old; else delete monthlyHours.map[id]; } return r; });
}
// «Nome; horas» — o nome pode vir como na folha («PT 60 - Ana Silva»): tira-se o prefixo do pack
function parseHoursImport(text){
  var rows = [], errors = [];
  String(text || "").split(/\r?\n/).forEach(function(line, i){
    if (!line.trim()) return;
    var cols = line.split(/\t|;/).map(function(c){ return c.trim(); });
    if (/^(nome|cliente|aluno)\b/i.test(cols[0]) && parseImportNumber(cols[1]) == null) return;
    var name = cols[0].replace(/^PT(?:\s+[\w.]+)*?\s*[-–]\s*/i, "").trim(), h = cols.length > 1 ? parseImportNumber(cols[1]) : null;
    if (!name) errors.push("Linha " + (i + 1) + ": falta o nome.");
    else if (cols.length < 2 || h == null || h <= 0 || h > 200) errors.push("Linha " + (i + 1) + " (" + name + "): horas inválidas (ex.: 8,66).");
    else rows.push({name: name, hours: Math.round(h * 100) / 100});
  });
  return {rows: rows, errors: errors};
}
// «Ana + Rui» (duo): só vale como nome inteiro se houver um aluno com exatamente esse nome; senão partem-se os dois (matchStudentByName aceita «primeiro + último» e enganava-se)
function matchStudentWholeName(name){
  if (!/\s\+\s/.test(name)) return matchStudentByName(name);
  var key = exLibFold(name), all = STUDENTS.filter(function(x){ return !x.isDemo || state.showDemoStudents; }).filter(function(x){ return exLibFold(x.name) === key; });
  return all.length === 1 ? all[0] : null;
}
function studioImportHours(text){
  var parsed = parseHoursImport(text), report = {saved: 0, errors: parsed.errors.slice()};
  var prev = JSON.parse(JSON.stringify(monthlyHours.map));
  parsed.rows.forEach(function(r){
    var whole = matchStudentWholeName(r.name), names = whole ? [r.name] : r.name.split(/\s*\+\s*|\s+e\s+/i).filter(Boolean);   // «Ana + Rui» (duo): as horas da linha dividem-se pelos dois (a aula conta uma só vez)
    names.forEach(function(nm){
      var st = whole || matchStudentByName(nm);
      if (!st) report.errors.push(nm + ": não encontrei um aluno com este nome.");
      else { monthlyHours.map[st.id] = Math.round(r.hours / names.length * 100) / 100; report.saved++; }
    });
  });
  if (!report.saved) return Promise.resolve(report);
  return saveMonthlyHours().then(function(r){ if (r.error){ monthlyHours.map = prev; report.saved = 0; report.errors.push(r.error); } return report; });
}
function parsePackImport(text){
  var rows = [], errors = [];
  String(text || "").split(/\r?\n/).forEach(function(line, i){
    if (!line.trim()) return;
    var cols = line.split(/\t|;/).map(function(c){ return c.trim(); });
    if (cols.length < 3){ errors.push("Linha " + (i + 1) + ": faltam colunas (nome; aulas; data de início; valor; aulas já dadas; validade em meses ou tipo, opcional; partilhado com, opcional)."); return; }
    var total = parseImportNumber(cols[1]), start = parseImportDate(cols[2]);
    var price = cols[3] ? parseImportNumber(cols[3]) : null, used = cols[4] ? parseImportNumber(cols[4]) : 0;
    // a validade pode vir em meses (6) ou pelo tipo do pack (Trimestral = 6 meses: duração + 3)
    var typeMonths = cols[5] ? packTypeMonths(cols[5]) : null, months = cols[5] ? (typeMonths != null ? typeMonths : parseImportNumber(cols[5])) : 0;
    var shareWith = cols[6] ? cols[6].split(/\s*[&|\/]\s*|\s+e\s+/i).map(function(t){ return t.trim(); }).filter(Boolean) : [], shareRaw = cols[6] || "";
    if (/^(nome|cliente|aluno)$/i.test(cols[0]) && total == null) return; // linha de cabeçalho colada do Sheets
    if (!cols[0]) errors.push("Linha " + (i + 1) + ": falta o nome.");
    else if (total == null || total < 1 || total > 500 || total !== Math.round(total)) errors.push("Linha " + (i + 1) + " (" + cols[0] + "): número de aulas inválido.");
    else if (!start) errors.push("Linha " + (i + 1) + " (" + cols[0] + "): data de início inválida (usa 31/12/2026 ou 2026-12-31).");
    else if (cols[3] && (price == null || price < 0)) errors.push("Linha " + (i + 1) + " (" + cols[0] + "): valor inválido.");
    else if (used == null || used < 0 || used > total || used !== Math.round(used)) errors.push("Linha " + (i + 1) + " (" + cols[0] + "): aulas já dadas inválidas (0 a " + total + ").");
    else if (months == null || months < 0 || months > 36 || months !== Math.round(months)) errors.push("Linha " + (i + 1) + " (" + cols[0] + "): validade inválida (meses, 0 a 36; vazio = sem validade).");
    else rows.push({name: cols[0], total: total, start: start, price: price, used: used, months: months, shareWith: shareWith, shareRaw: shareRaw});
  });
  return {rows: rows, errors: errors};
}
// o aluno da app com este nome (sem distinguir maiúsculas/acentos; aceita só o primeiro e último nome se for único)
function matchStudentByName(name){
  var key = exLibFold(name), all = STUDENTS.filter(function(s){ return !s.isDemo || state.showDemoStudents; });
  var exact = all.filter(function(s){ return exLibFold(s.name) === key; });
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  var parts = key.split(" ").filter(Boolean);
  var loose = all.filter(function(s){ var p = exLibFold(s.name).split(" ").filter(Boolean); return parts.length >= 2 && p[0] === parts[0] && p[p.length - 1] === parts[parts.length - 1]; });
  if (loose.length === 1) return loose[0];
  // só um nome («Carina», «Diana»): vale se for o primeiro ou o último nome de um só aluno
  if (parts.length === 1 && key.length >= 3){
    var one = all.filter(function(s){ var p = exLibFold(s.name).split(" ").filter(Boolean); return p.length >= 2 && (p[0] === key || p[p.length - 1] === key); });
    if (one.length === 1) return one[0];
  }
  return null;
}
function studioImportPacks(text){
  var parsed = parsePackImport(text), report = {created: 0, skipped: [], errors: parsed.errors.slice()};
  var chain = Promise.resolve();
  parsed.rows.forEach(function(r){
    chain = chain.then(function(){
      var st = matchStudentByName(r.name);
      if (!st){ report.errors.push(r.name + ": não encontrei um aluno com este nome."); return; }
      if (packsOf(st.id).some(function(p){ return p.starts_on === r.start && Number(p.total) === r.total; })){ report.skipped.push(st.name + " (já tem este pacote)"); return; }
      // sem validade, a não ser que a linha traga os meses (um pacote de 26 aulas demora quase sempre mais do que 3 meses com pausas e férias)
      var exp = r.months > 0 ? addMonthsISO(r.start, r.months) : null;
      var row = {student_id: st.id, name: "Pacote " + r.total + " aulas", total: r.total, price: r.price, starts_on: r.start, expires_on: exp, missed_consumes: true, late_cancel_consumes: true};
      if (studio.slotsAvailable) row.used_before = r.used;
      // «partilhado com»: o pacote também pode ser gasto por esses alunos (casais)
      var shareIds = [];
      var shareNames = r.shareWith || [];
      // «Ana Sousa e Silva» é um nome só: se a célula inteira for exatamente um aluno, não se parte por « e »
      if (r.shareRaw && /\s+e\s+/i.test(r.shareRaw)){ var kk = exLibFold(r.shareRaw), whole = STUDENTS.filter(function(x){ return (!x.isDemo || state.showDemoStudents) && exLibFold(x.name) === kk; }); if (whole.length === 1) shareNames = [r.shareRaw]; }
      shareNames.forEach(function(nm){
        var other = matchStudentByName(nm);
        if (!other) report.errors.push(st.name + ": não encontrei o aluno «" + nm + "» para partilhar o pacote.");
        else if (other.id !== st.id && shareIds.indexOf(other.id) < 0) shareIds.push(other.id);
      });
      if (shareIds.length){
        if (studio.sharedAvailable) row.shared_with = shareIds;
        else report.errors.push(st.name + ": " + SHARED_MIGRATION_MSG);
      }
      return studioInsert("packs", row).then(function(x){ if (x.error) report.errors.push(st.name + ": " + x.error); else report.created++; });
    });
  });
  return chain.then(function(){ return report; });
}

// ---- importar as datas previstas da folha de cálculo (uma linha por aluno: Nome; data; data; data…) como sessões "agendadas" ----
function parseScheduleImport(text){
  var rows = [], errors = [];
  String(text || "").split(/\r?\n/).forEach(function(line, i){
    if (!line.trim()) return;
    var cut = line.search(/[;\t]/);
    if (cut < 0){ errors.push("Linha " + (i + 1) + ": falta o nome ou as datas (Nome; 31/12/2026; 07/01/2027; …)."); return; }
    var name = line.slice(0, cut).trim(), parts = line.slice(cut + 1).split(/[;\t,\s]+/).map(function(t){ return t.trim(); }).filter(Boolean);
    if (!name){ errors.push("Linha " + (i + 1) + ": falta o nome."); return; }
    var dates = [], bad = 0;
    parts.forEach(function(t){ var d = parseImportDate(t); if (d) dates.push(d); else bad++; });
    if (!dates.length){ errors.push("Linha " + (i + 1) + " (" + name + "): nenhuma data válida."); return; }
    if (bad) errors.push("Linha " + (i + 1) + " (" + name + "): " + bad + (bad === 1 ? " valor ignorado" : " valores ignorados") + " (não são datas).");
    rows.push({name: name, dates: dates});
  });
  return {rows: rows, errors: errors};
}
// cria as sessões agendadas que ainda não existem (conta as que já há em cada dia: importar duas vezes não duplica nem repete as que o Google Agenda já converteu)
function studioImportSchedule(text){
  var parsed = parseScheduleImport(text), report = {created: 0, skipped: 0, errors: parsed.errors.slice(), students: 0};
  var toInsert = [];
  parsed.rows.forEach(function(r){
    var st = matchStudentByName(r.name);
    if (!st){ report.errors.push(r.name + ": não encontrei um aluno com este nome."); return; }
    report.students++;
    var want = {}; r.dates.forEach(function(d){ want[d] = (want[d] || 0) + 1; });
    Object.keys(want).forEach(function(d){
      var have = studio.sessions.filter(function(x){ return x.student_id === st.id && x.date === d; }).length;
      var need = Math.max(0, want[d] - have);
      report.skipped += want[d] - need;
      for (var k = 0; k < need; k++) toInsert.push({student_id: st.id, pack_id: null, date: d, status: "agendada", source: "folha"});
    });
  });
  toInsert.sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  var chain = Promise.resolve(), size = 200;
  for (var i = 0; i < toInsert.length; i += size) (function(chunk){
    chain = chain.then(function(){
      return studioInsertMany("sessions", chunk).then(function(res){
        if (res.error) report.errors.push("Não foi possível guardar " + chunk.length + " sessões" + (res.code === "23514" ? " (falta correr a migração 0027 no Supabase)." : "."));
        else report.created += res.data.length;
      });
    });
  })(toInsert.slice(i, i + size));
  return chain.then(function(){ return report; });
}

// ---- Google Agenda: ler os eventos e contá-los como sessões (migração 0025) ----
// A app pede ao Google, de cada vez que se sincroniza, autorização só de leitura (calendar.readonly). O token vive só na memória.
// Cada evento cujo título é o nome de um aluno vira uma sessão "feita" (cor Tomate/11 = "faltou", como no script antigo); tal como lá,
// contam-se os eventos até ao fim de hoje. O calendário é a fonte: se o evento mudar de dia/hora ou desaparecer, a sessão acompanha-o.
// Mexer numa sessão na app (Agenda → Alterar) desliga-a do calendário (passa a "manual") e a sincronização deixa-a em paz.
var CAL_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
var CAL_LOCAL_KEY = "evolve_gcal_v1";
var CAL_DEFAULT_BACK_DAYS = 120, CAL_MAX_BACK_DAYS = 400;
var CAL_FALTA_COLOR = "11";
var calSettings = {clientId: "", calendarId: "primary", useAsSource: false, titlePrefix: "PT", aliases: {}, ignored: {}, lastSync: null, loaded: false, available: true};

function calLoadSettings(){
  var done = function(v){
    if (v && typeof v === "object"){ calSettings.clientId = String(v.clientId || ""); calSettings.calendarId = String(v.calendarId || "primary"); calSettings.useAsSource = !!v.useAsSource; calSettings.titlePrefix = typeof v.titlePrefix === "string" ? v.titlePrefix.trim().slice(0, 30) : "PT"; calSettings.aliases = v.aliases && typeof v.aliases === "object" ? v.aliases : {}; calSettings.ignored = v.ignored && typeof v.ignored === "object" ? v.ignored : {}; calSettings.lastSync = v.lastSync || null; }
    calSettings.loaded = true; return true;
  };
  if (!sbReady){ try { return Promise.resolve(done(JSON.parse(localStorage.getItem(CAL_LOCAL_KEY) || "null"))); } catch (e) { return Promise.resolve(done(null)); } }
  return Promise.resolve(sb.from("studio_settings").select("value").eq("key", "google_calendar").maybeSingle().then(function(r){ return r; })).then(function(res){
    if (res && res.error){ calSettings.available = false; calSettings.loaded = true; return false; }
    calSettings.available = true;
    return done(res && res.data ? res.data.value : null);
  }, function(){ calSettings.available = false; calSettings.loaded = true; return false; });
}
function calSettingsValue(){ return {clientId: calSettings.clientId, calendarId: calSettings.calendarId, useAsSource: calSettings.useAsSource, titlePrefix: calSettings.titlePrefix, aliases: calSettings.aliases, ignored: calSettings.ignored, lastSync: calSettings.lastSync}; }
function calSaveSettings(){
  if (!sbReady){ try { localStorage.setItem(CAL_LOCAL_KEY, JSON.stringify(calSettingsValue())); } catch (e) {} return Promise.resolve({}); }
  return Promise.resolve(sb.from("studio_settings").upsert({key: "google_calendar", value: calSettingsValue(), updated_at: new Date().toISOString()}).then(function(r){ return r; })).then(function(res){
    return res && res.error ? {error: "Não foi possível guardar as definições (a migração 0025 já foi corrida?)."} : {};
  }, function(){ return {error: "Não foi possível guardar — verifica a ligação."}; });
}
// só contam os eventos cujo título começa pelo prefixo ("PT 60 - Nome", "PT Duo…"); prefixo vazio = todos
function calTitleHasPrefix(title, prefix){
  var p = calTitleKey(prefix || "");
  if (!p) return true;
  var t = calTitleKey(title);
  return t.indexOf(p) === 0 && (t.length === p.length || !/[a-z0-9]/.test(t.charAt(p.length)));
}
// ignora de uma vez todos os títulos da última sincronização que ainda não têm aluno (clientes cancelados); devolve quantos
function calIgnoreAllUnmatched(){
  var ls = calSettings.lastSync, n = 0;
  if (!ls || !ls.unmatched) return 0;
  ls.unmatched.forEach(function(u){ if (!calIsIgnored(calSettings.ignored, u.title)){ calSettings.ignored[calTitleKey(u.title)] = true; n++; } });
  ls.unmatched = [];
  ls.unmatchedMore = 0;
  return n;
}
function calIsIgnored(ignored, title){ return !!(ignored && Object.prototype.hasOwnProperty.call(ignored, calTitleKey(title)) && ignored[calTitleKey(title)] === true); }
function calUsesCalendar(){ return !!(calSettings.useAsSource && calSettings.clientId); }

// ---- eventos ----
// {id, title, date, time, colorId, cancelled} a partir de um evento da API do Google (hora local do dispositivo)
function normalizeCalendarEvent(ev){
  if (!ev || !ev.id || !ev.start) return null;
  var title = String(ev.summary || "").trim();
  if (!title) return null;
  var date = null, time = null;
  if (ev.start.dateTime){
    var d = new Date(ev.start.dateTime);
    if (isNaN(d.getTime())) return null;
    date = d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); time = pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  } else if (ev.start.date && isIsoDate(ev.start.date)) date = ev.start.date;
  if (!date) return null;
  return {id: String(ev.id).slice(0, 200), title: title, date: date, time: time, colorId: ev.colorId ? String(ev.colorId) : "", cancelled: ev.status === "cancelled"};
}
function calTitleKey(t){ return exLibFold(t); }
// o aluno de um evento. Os títulos costumam trazer mais do que o nome ("PT 60 - Isabel Carvalho"), por isso procura, por ordem:
// alias definido à mão; título igual ao nome; a parte depois do último " - " igual ao nome; o nome completo de um só aluno dentro do título
// (se houver vários, o mais comprido); primeiro+último nome se for único.
// «PT Duo 60 - Ana + Rui» → os dois alunos (só se os dois nomes forem alunos da app; senão fica na lista de títulos sem aluno)
function matchDuoStudents(title){
  var parts = String(title || "").split(/\s+[-–—]\s+/), tail = parts.length > 1 ? parts[parts.length - 1] : "";
  if (!/\s[+&]\s/.test(tail)) return null;
  var names = tail.split(/\s*[+&]\s*/).map(function(t){ return t.trim(); }).filter(Boolean), out = [];
  if (names.length < 2) return null;
  for (var k = 0; k < names.length; k++){
    var st = matchStudentByName(names[k]);
    if (!st || out.indexOf(st) >= 0) return null;
    if (isStudentActive(st)) out.push(st);   // (um aluno arquivado do duo não conta; o outro sim)
  }
  return out.length ? out : null;
}
function matchRepeatedStudent(title){
  var parts = String(title || "").split(/\s+[-–—]\s+/), tail = parts.length > 1 ? parts[parts.length - 1] : String(title || "");
  if (!/\s[+&]\s/.test(tail)) return null;
  var names = tail.split(/\s*[+&]\s*/).map(function(t){ return t.trim(); }).filter(Boolean);
  if (names.length < 2 || names.some(function(n){ return exLibFold(n) !== exLibFold(names[0]); })) return null;
  var st = matchStudentByName(names[0]);
  return st ? {st: st, n: names.length} : null;
}
function matchEventStudent(title, aliases){
  var key = calTitleKey(title);
  if (aliases && Object.prototype.hasOwnProperty.call(aliases, key) && aliases[key]){ var a = findStudent(aliases[key]); if (a) return a; }
  var all = STUDENTS.filter(function(s){ return !s.isDemo || state.showDemoStudents; });
  // um arquivado com o mesmo nome de um ativo não torna o nome ambíguo: conta o ativo
  function unique(list){ var act = list.filter(isStudentActive); if (act.length) list = act; return list.length === 1 ? list[0] : null; }
  var exact = all.filter(function(s){ return exLibFold(s.name) === key; });
  if (exact.length) return unique(exact);
  var parts = String(title).split(/\s+[-–—]\s+/), tail = parts.length > 1 ? calTitleKey(parts[parts.length - 1]) : "";
  if (tail){
    var viaTail = all.filter(function(s){ return exLibFold(s.name) === tail; });
    if (viaTail.length) return unique(viaTail);
  }
  // só o primeiro ou o último nome («PT 60 - Carina», «PT 60 - Diana»): vale se for exatamente um aluno (ativo) e a palavra for o primeiro ou o último nome da ficha
  if (tail && tail.indexOf(" ") < 0 && tail.length >= 3){
    var byToken = all.filter(function(s){ var p = exLibFold(s.name).split(" ").filter(Boolean); return p.length >= 2 && (p[0] === tail || p[p.length - 1] === tail); });
    var oneTok = unique(byToken);
    if (oneTok) return oneTok;
  }
  var padded = " " + key + " ";
  var inside = all.filter(function(s){ var n = exLibFold(s.name); return n.indexOf(" ") > 0 && padded.indexOf(" " + n + " ") >= 0; });
  if (inside.length){
    var longest = Math.max.apply(null, inside.map(function(s){ return exLibFold(s.name).length; }));
    var top = inside.filter(function(s){ return exLibFold(s.name).length === longest; });
    if (top.filter(isStudentActive).length) top = top.filter(isStudentActive);
    // dois alunos diferentes no mesmo título é ambíguo; só vale se os outros nomes forem parte do mais comprido ("Ana Silva" e "Ana Silva Santos")
    if (top.length === 1 && inside.every(function(s){ return exLibFold(top[0].name).indexOf(exLibFold(s.name)) >= 0; })) return top[0];
    return null;
  }
  return matchStudentByName(tail || title);
}
// a janela a ler: do início do pacote ainda relevante mais antigo até ao fim de hoje
function calendarWindow(today){
  var from = addDaysISO(today, -CAL_DEFAULT_BACK_DAYS), limit = addDaysISO(today, -CAL_MAX_BACK_DAYS);
  studio.packs.forEach(function(p){ if (p.starts_on && p.starts_on <= today && (!p.expires_on || p.expires_on >= addDaysISO(today, -30) || packUsage(p, today).remaining > 0) && p.starts_on < from) from = p.starts_on; });
  // aulas previstas da folha que já passaram e ainda não foram confirmadas pela agenda: a janela tem de chegar lá (senão ficam «agendadas» para sempre e nunca contam)
  studio.sessions.forEach(function(x){ if (x.status === "agendada" && x.date <= today && x.date < from) from = x.date; });
  if (from < limit) from = limit;
  return {from: from, to: today};
}
// o que há a fazer para as sessões ficarem iguais ao calendário: {insert[], update[], remove[], unmatched{titulo: n}, matched}
function planCalendarSync(opts){
  var today = opts.today, win = opts.window, aliases = opts.aliases || {}, ignored = opts.ignored || {}, prefix = opts.prefix || "";
  var plan = {insert: [], update: [], remove: [], unmatched: Object.create(null), matched: 0};
  var present = Object.create(null);
  var byExt = Object.create(null);
  var claimed = Object.create(null); // sessões agendadas (da folha) que um evento já reivindicou
  studio.sessions.forEach(function(x){ if (x.source === "calendario" && x.external_id) byExt[x.external_id] = x; });
  // um evento de duo («PT Duo 60 - Ana + Rui») conta uma aula a cada um: ganha um id por pessoa (idDoEvento#idDoAluno)
  var items = [];
  opts.events.forEach(function(ev){
    if (!ev || ev.cancelled || ev.date > today || ev.date < win.from) return;
    if (!calTitleHasPrefix(ev.title, prefix)) return; // não é uma aula (ex.: reuniões, feriados): nem conta nem aparece na lista
    var rep = matchRepeatedStudent(ev.title);   // «Ana + Ana»: o mesmo nome várias vezes = várias aulas
    if (rep){ for (var k = 0; k < rep.n; k++) items.push({ev: ev, st: rep.st, eid: k ? ev.id + "#" + rep.st.id + "#" + k : ev.id}); return; }
    var st = matchEventStudent(ev.title, aliases);
    if (st){ items.push({ev: ev, st: st, eid: ev.id}); return; }
    var duo = matchDuoStudents(ev.title);
    if (duo){ duo.forEach(function(d){ items.push({ev: ev, st: d, eid: ev.id + "#" + d.id}); }); return; }
    if (!calIsIgnored(ignored, ev.title)) plan.unmatched[ev.title] = (plan.unmatched[ev.title] || 0) + 1;
  });
  items.forEach(function(it){
    var ev = it.ev, st = it.st, eid = it.eid;
    present[eid] = true; // o evento existe: nunca remover as sessões já registadas (mesmo de alunos arquivados)
    if (!isStudentActive(st)) return;
    plan.matched++;
    var status = ev.colorId === CAL_FALTA_COLOR ? "faltou" : "feita", ex = byExt[eid];
    if (ex){
      var patch = {};
      if (ex.student_id !== st.id) patch.student_id = st.id;
      if (ex.date !== ev.date) patch.date = ev.date;
      if ((ex.time || null) !== (ev.time || null)) patch.time = ev.time;
      if (ex.status !== status) patch.status = status;
      if (Object.keys(patch).length) plan.update.push({id: ex.id, patch: patch});
      return;
    }
    // uma sessão agendada (da folha) nesse dia passa a feita/faltou em vez de se criar outra
    var planned = studio.sessions.filter(function(x){ return x.student_id === st.id && x.date === ev.date && x.status === "agendada" && x.source === "folha" && !claimed[x.id]; })[0];
    if (planned){
      claimed[planned.id] = true;
      var pp = {status: status, source: "calendario", external_id: eid};
      if (ev.time) pp.time = ev.time;
      plan.update.push({id: planned.id, patch: pp});
      return;
    }
    // uma sessão registada à mão (ou do horário) no mesmo dia/hora ganha: não se conta duas vezes (as agendadas não contam: são só previsões)
    // (cada sessão já registada cobre um só evento: dois eventos iguais no mesmo horário são duas aulas)
    var dup = studio.sessions.filter(function(x){ return x.student_id === st.id && x.date === ev.date && x.source !== "calendario" && x.status !== "agendada" && !claimed[x.id] && (!x.time || !ev.time || x.time === ev.time); })[0];
    if (dup){ claimed[dup.id] = true; return; }
    plan.insert.push({student_id: st.id, date: ev.date, time: ev.time, status: status, source: "calendario", external_id: eid});
  });
  // sessões vindas do calendário cujo evento já não existe (apagado, cancelado ou renomeado) dentro da janela lida
  studio.sessions.forEach(function(x){
    if (x.source === "calendario" && x.external_id && !present[x.external_id] && x.date >= win.from && x.date <= today) plan.remove.push(x.id);
  });
  plan.insert.sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || "") < (b.time || "") ? -1 : 1; });
  return plan;
}

// ---- Google (autorização só de leitura + eventos) ----
function loadGoogleIdentity(){
  if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
  return new Promise(function(resolve, reject){
    var sc = document.createElement("script");
    sc.src = "https://accounts.google.com/gsi/client"; sc.async = true;
    sc.onload = function(){ resolve(); };
    sc.onerror = function(){ reject(new Error("Não foi possível carregar o Google — verifica a ligação.")); };
    document.head.appendChild(sc);
  });
}
function googleAccessToken(clientId){
  return loadGoogleIdentity().then(function(){
    return new Promise(function(resolve, reject){
      var client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId, scope: CAL_SCOPE,
        callback: function(resp){ if (resp && resp.access_token) resolve(resp.access_token); else reject(new Error(resp && resp.error === "access_denied" ? "Não autorizaste o acesso à agenda." : "O Google recusou a autorização" + (resp && resp.error ? " (" + resp.error + ")" : "") + ". Confirma o ID de cliente e as origens autorizadas.")); },
        error_callback: function(err){ reject(new Error(err && err.type === "popup_closed" ? "Fechaste a janela do Google antes de autorizar." : "Não foi possível abrir a janela do Google (o browser bloqueou o pop-up?).")); }
      });
      client.requestAccessToken({prompt: ""});
    });
  });
}
function fetchCalendarEvents(token, calendarId, fromISO, toISO){
  var out = [];
  var timeMin = new Date(fromISO + "T00:00:00").toISOString(), timeMax = new Date(addDaysISO(toISO, 1) + "T00:00:00").toISOString();
  function page(pageToken){
    var url = "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(calendarId || "primary") + "/events?singleEvents=true&orderBy=startTime&maxResults=2500" +
      "&timeMin=" + encodeURIComponent(timeMin) + "&timeMax=" + encodeURIComponent(timeMax) + "&fields=" + encodeURIComponent("nextPageToken,items(id,summary,start,end,colorId,status)") + (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");
    return fetch(url, {headers: {Authorization: "Bearer " + token}}).then(function(res){
      if (res.status === 401) throw new Error("A autorização expirou — tenta sincronizar outra vez.");
      if (res.status === 403) throw new Error("O Google recusou o acesso à agenda: confirma que a Google Calendar API está ativada no teu projeto.");
      if (res.status === 404) throw new Error("Agenda não encontrada: confirma o nome/ID da agenda (por omissão, a principal).");
      if (!res.ok) throw new Error("O Google respondeu com o erro " + res.status + ".");
      return res.json();
    }).then(function(j){
      (j.items || []).forEach(function(it){ var n = normalizeCalendarEvent(it); if (n) out.push(n); });
      return j.nextPageToken ? page(j.nextPageToken) : out;
    });
  }
  return page(null);
}

// aplica o plano: remove, atualiza e cria (os pacotes decidem-se por ordem de data, contando as que acabámos de decidir)
function applyCalendarPlan(plan){
  var res = {inserted: 0, updated: 0, removed: 0, errors: 0};
  var chain = Promise.resolve();
  // 1.º remover, 2.º atualizar (o pacote volta a escolher-se se mudou o aluno ou o dia), 3.º criar: assim cada passo vê as contas já certas
  plan.remove.forEach(function(id){ chain = chain.then(function(){ return studioDelete("sessions", id).then(function(r){ if (r.error) res.errors++; else res.removed++; }); }); });
  plan.update.forEach(function(u){
    chain = chain.then(function(){
      var cur = studio.sessions.filter(function(x){ return x.id === u.id; })[0], oldPack;
      var patch = Object.assign({}, u.patch);
      if (cur && (patch.student_id || patch.date || patch.source === "calendario")){ // (também ao converter uma sessão agendada: passa a gastar uma aula)
        oldPack = cur.pack_id; cur.pack_id = null;
        var pk = pickPackForSession(patch.student_id || cur.student_id, patch.date || cur.date);
        patch.pack_id = pk ? pk.id : null;
      }
      return studioUpdate("sessions", u.id, patch).then(function(r){
        if (r.error){ res.errors++; if (cur && oldPack !== undefined) cur.pack_id = oldPack; } else res.updated++;
      });
    });
  });
  chain = chain.then(function(){
    var virtual = [];
    plan.insert.forEach(function(row){
      var pk = pickPackForSession(row.student_id, row.date);
      row.pack_id = pk ? pk.id : null;
      var v = {id: "virtual-" + virtual.length, student_id: row.student_id, pack_id: row.pack_id, date: row.date, time: row.time, status: row.status};
      virtual.push(v); studio.sessions.push(v);
    });
    studio.sessions = studio.sessions.filter(function(x){ return virtual.indexOf(x) < 0; });
    return studioInsertMany("sessions", plan.insert);
  }).then(function(r){
    if (r.error){
      if (plan.insert.length > 1) return plan.insert.reduce(function(c, row){ return c.then(function(){ return studioInsert("sessions", row).then(function(x){ if (x.error) res.errors++; else res.inserted++; }); }); }, Promise.resolve());
      res.errors += plan.insert.length;
    } else res.inserted += r.data.length;
  }).then(function(){ return res; });
  return chain;
}
var calSyncing = false;
var calLastRun = null; // eventos da última leitura (só em memória): permite contar as aulas de alunos novos sem pedir autorização outra vez
// deixa as sessões iguais aos eventos lidos; devolve o resumo para mostrar
function calApplyEvents(events, win){
  var today = localTodayISO();
  calLastRun = {events: events, window: win};
  var plan = planCalendarSync({events: events, today: today, window: win, aliases: calSettings.aliases, ignored: calSettings.ignored, prefix: calSettings.titlePrefix});
  var warnings = studio.packs.filter(function(p){ return Number(p.used_before) > 0 && packUsage(p, today).active; }).map(function(p){ return nameOf(p.student_id); });
  return applyCalendarPlan(plan).then(function(r){
    var titles = Object.keys(plan.unmatched).sort(function(a, b){ return plan.unmatched[b] - plan.unmatched[a]; });
    var summary = {at: new Date().toISOString(), events: events.length, matched: plan.matched, inserted: r.inserted, updated: r.updated, removed: r.removed, errors: r.errors,
      unmatched: titles.slice(0, CAL_UNMATCHED_MAX).map(function(t){ return {title: t, n: plan.unmatched[t]}; }), unmatchedMore: Math.max(0, titles.length - CAL_UNMATCHED_MAX), warnUsedBefore: warnings, from: win.from};
    calSettings.lastSync = summary;
    return calSaveSettings().then(function(){ return summary; });
  });
}
// pede autorização, lê o calendário e deixa as sessões iguais; devolve o resumo para mostrar
function runCalendarSync(){
  if (calSyncing) return Promise.reject(new Error("Já está a sincronizar."));
  if (!calSettings.clientId) return Promise.reject(new Error("Falta o ID de cliente do Google."));
  calSyncing = true;
  var today = localTodayISO(), win = calendarWindow(today);
  return googleAccessToken(calSettings.clientId).then(function(token){ return fetchCalendarEvents(token, calSettings.calendarId, win.from, win.to); }).then(function(events){
    return calApplyEvents(events, win);
  }).then(function(s){
    return autoFixPacks().then(function(fix){ s.fixed = fix; calSyncing = false; return s; }, function(){ calSyncing = false; return s; });
  }, function(e){ calSyncing = false; throw e; });
}

// ---- criar alunos a partir dos nomes da agenda ----
var CAL_UNMATCHED_MAX = 80;
var CAL_MIN_EVENTS = 3; // quem treina aparece várias vezes: os nomes que surgem 1 ou 2 vezes não vêm marcados
var CAL_NOT_A_CLIENT = /\b(casamento|batizado|baptizado|natal|p[aá]scoa|ano novo|dia d[aeo]s?|festa|funeral|concerto|jogo|cinema|reuni[aã]o|dentista|m[eé]dico|consulta|almo[cç]o|jantar|pequeno[- ]almo[cç]o|f[eé]rias|folga|livre|bloque|anivers[aá]rio|lembrete|viagem|voo|feriado|intervalo|pausa|compras|tarefa|pessoal|treino pr[oó]prio|ocupado|indispon[ií]vel|teste)\b/i;
// o nome de um aluno dentro do título: "PT 60 - Isabel Carvalho" → "Isabel Carvalho"
function calCandidateName(title){
  var parts = String(title || "").split(/\s+[-–—]\s+/);
  var t = parts[parts.length - 1].replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  return t.length > 60 ? t.slice(0, 60).trim() : t;
}
function calLooksLikeClient(name){
  if (!name || name.length < 2) return false;
  if (/\d/.test(name)) return false;               // "PT 60", horas, datas
  if (CAL_NOT_A_CLIENT.test(name)) return false;
  return name.split(/\s+/).length <= 5;
}
// títulos sem aluno → um candidato por nome (vários títulos podem trazer o mesmo nome); os que parecem alunos vêm marcados
function calStudentCandidates(unmatched){
  var by = Object.create(null);
  (unmatched || []).forEach(function(u){
    if (calIsIgnored(calSettings.ignored, u.title)) return;
    var name = calCandidateName(u.title), key = calTitleKey(name);
    if (!key) return;
    var c = by[key] || (by[key] = {key: key, name: name, titles: [], n: 0, likely: calLooksLikeClient(name)});
    c.titles.push(u.title); c.n += u.n;
  });
  return Object.keys(by).map(function(k){ return by[k]; }).sort(function(a, b){ return (b.likely ? 1 : 0) - (a.likely ? 1 : 0) || b.n - a.n || a.name.localeCompare(b.name, "pt"); });
}
function calNewStudent(name){
  var baseId = slug(name) || ("aluno-" + Date.now()), id = baseId, n = 2;
  while (findStudent(id)){ id = baseId + "-" + n; n++; }
  // sem peso, objetivo nem alvos inventados: a ficha só tem o nome até ser preenchida (o aluno é "só estúdio")
  return {
    id: id, initials: initialsOf(name), name: name, age: null, birthDate: null, sex: null, height: null,
    weightInitial: null, weightCurrent: null, weightGoal: null, goal: "—", trainingsPerWeek: 0, trainingType: "—", trainingTime: "—", activityLevel: null,
    wakeTime: "—", sleepTime: "—", likes: [], dislikes: [], avoid: [], allergies: [], mealsPreferred: 5, budget: "—", cookTime: "—", work: "—", weekendNote: "—",
    mealsAtWorkEase: null, usesSupplements: false, supplements: [], dailyEatingDescription: "", overeatingMealsPerWeek: null, hardestFoodToResist: "", waterIntake: null,
    targets: {kcal: 0, protein: 0, carbs: 0, fat: 0}, flexibility: 50, flexOverrides: {}, flexHistory: [], blockedFoods: [], substitutionHistory: [], adaptationHistory: [],
    alerts: [], notes: "Criado a partir da agenda do Google (só estúdio). Completa a ficha se o aluno passar a usar a app.", meals: [], checkins: [], weights: [], assessments: [],
    allowPhotos: false, photos: [], weightLogPhotos: [], planHistory: [], lastCheckinDaysAgo: 0, fromOnboarding: false, inviteEmail: null, studioOnly: true, phone: null,
    createdAt: new Date().toISOString()
  };
}
// items: [{name, titles}]. Cria os alunos (um só pedido de cada vez), guarda os títulos como alias e, se há eventos em memória, conta já as aulas
function createStudentsFromCalendar(items){
  var made = [], failed = [], aliasOnly = 0, archived = [], done = {};
  var chain = Promise.resolve();
  items.forEach(function(it){
    var name = String(it.name || "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (!name) return;
    chain = chain.then(function(){
      var same = STUDENTS.filter(function(x){ return calTitleKey(x.name) === calTitleKey(name) && (!x.isDemo || state.showDemoStudents); });
      var existing = same.filter(isStudentActive)[0] || same[0]; // um aluno arquivado com o mesmo nome também é "o mesmo aluno": não se cria outro
      if (existing){ it.titles.forEach(function(t){ calSettings.aliases[calTitleKey(t)] = existing.id; }); aliasOnly++; if (!isStudentActive(existing)) archived.push(existing.name); return; }
      var st = calNewStudent(name);
      STUDENTS.push(st);
      return Promise.resolve(insertStudent(st)).then(function(ok){
        if (!ok){ STUDENTS.splice(STUDENTS.indexOf(st), 1); failed.push(name); return; }
        it.titles.forEach(function(t){ calSettings.aliases[calTitleKey(t)] = st.id; });
        made.push(st);
      });
    });
  });
  return chain.then(function(){
    // os títulos já tratados saem da lista guardada (mesmo sem eventos em memória), para não se oferecerem outra vez
    items.forEach(function(it){ if (failed.indexOf(String(it.name || "").replace(/\s+/g, " ").trim().slice(0, 80)) < 0) it.titles.forEach(function(t){ done[t] = true; }); });
    if (calSettings.lastSync && calSettings.lastSync.unmatched) calSettings.lastSync.unmatched = calSettings.lastSync.unmatched.filter(function(u){ return !done[u.title]; });
    return calSaveSettings();
  }).then(function(saved){
    if (saved && saved.error) throw new Error("Os alunos foram criados, mas não foi possível guardar as associações: " + saved.error);
    var counted = null;
    if (calLastRun && (made.length || aliasOnly)) counted = calApplyEvents(calLastRun.events, calLastRun.window);
    return Promise.resolve(counted).then(function(sum){ return {made: made, failed: failed, aliasOnly: aliasOnly, archived: archived, summary: sum}; });
  });
}
function calendarCardHtml(){
  var cs = calSettings, ls = cs.lastSync;
  var html = "<div class=\"card\" id=\"gcalCard\"><div class=\"eyebrow\" style=\"margin-bottom:6px;\">Google Agenda</div>";
  if (!studio.slotsAvailable) return html + "<p class=\"muted-p\">Para ligar o Google Agenda falta correr a migração <strong>0024</strong> (e depois a 0025) no SQL Editor do Supabase.</p></div>";
  if (!cs.available){ return html + "<p class=\"muted-p\">Falta correr a migração <strong>0025</strong> no SQL Editor do Supabase (<code>supabase/migrations/0025_google_calendar.sql</code>) para ligar o Google Agenda.</p></div>"; }
  if (!cs.clientId){
    html += "<p class=\"muted-p\" style=\"margin-bottom:8px;\">Lê a tua agenda do Google e conta como sessões os eventos que têm o nome de um aluno (a cor Tomate conta como falta). Só pede permissão de <strong>leitura</strong>.</p>" +
      "<div class=\"checkin-field\"><label for=\"gcClient\">ID de cliente do Google (OAuth)</label><input type=\"text\" id=\"gcClient\" placeholder=\"123456-abc.apps.googleusercontent.com\" autocomplete=\"off\"></div>" +
      "<p class=\"muted-p\" id=\"gcErr\" style=\"color:var(--critical); display:none;\"></p>" +
      "<button type=\"button\" class=\"btn primary btn-sm\" id=\"gcSave\">Guardar</button>" +
      "<details class=\"perfil-section\" style=\"margin-top:12px;\"><summary class=\"eyebrow\">Como obter o ID de cliente (uma vez, ~10 min)</summary><ol class=\"muted-p\" style=\"margin:8px 0 0 18px; line-height:1.5;\">" +
      "<li>Abre <strong>console.cloud.google.com</strong> e cria um projeto (ex.: EVOLVE).</li>" +
      "<li><strong>APIs e serviços → Biblioteca</strong>: procura <strong>Google Calendar API</strong> e ativa.</li>" +
      "<li><strong>Ecrã de consentimento OAuth</strong>: tipo <em>Externo</em>, nome EVOLVE, o teu email; em Âmbitos acrescenta <code>calendar.readonly</code>; em Utilizadores de teste acrescenta o teu email.</li>" +
      "<li><strong>Credenciais → Criar credenciais → ID de cliente OAuth</strong>: aplicação Web; em <em>Origens JavaScript autorizadas</em> põe <code>" + escapeHtml(typeof location !== "undefined" && location.origin && location.origin !== "null" ? location.origin : "https://tiagojvlourenco.github.io") + "</code>.</li>" +
      "<li>Copia o ID de cliente e cola aqui. (Para não teres de voltar a autorizar de 7 em 7 dias, publica a aplicação em <em>Produção</em> no ecrã de consentimento.)</li></ol></details></div>";
    return html;
  }
  html += "<p class=\"muted-p\" style=\"margin-bottom:8px;\">" + (cs.useAsSource ? "✓ É a fonte das sessões (o horário semanal fica em pausa)." : "Ainda não é a fonte das sessões: o horário semanal continua a contar.") + "</p>" +
    "<div style=\"display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;\"><button type=\"button\" class=\"btn primary btn-sm\" id=\"gcSync\">⟳ Sincronizar agora</button>" +
    "<button type=\"button\" class=\"btn btn-sm\" id=\"gcToggle\">" + (cs.useAsSource ? "Voltar ao horário semanal" : "Usar como fonte das sessões") + "</button>" +
    "<button type=\"button\" class=\"btn btn-sm\" id=\"gcOff\">Desligar</button></div>" +
    "<div class=\"checkin-field\" style=\"max-width:320px;\"><label for=\"gcCal\">Agenda (por omissão a principal)</label><input type=\"text\" id=\"gcCal\" value=\"" + escapeHtml(cs.calendarId) + "\" autocomplete=\"off\"></div>" +
    "<div class=\"checkin-field\" style=\"max-width:320px; margin-top:8px;\"><label for=\"gcPrefix\">Só eventos que começam por (vazio = todos)</label><input type=\"text\" id=\"gcPrefix\" maxlength=\"30\" value=\"" + escapeHtml(cs.titlePrefix) + "\" placeholder=\"PT\" autocomplete=\"off\"></div>" +
    "<p class=\"muted-p\" id=\"gcOut\" style=\"margin-top:8px;\">" + (ls ? calendarSummaryText(ls) : "Ainda não sincronizaste. A primeira vez pede autorização ao Google.") + "</p>";
  if (ls && ls.unmatched && ls.unmatched.length){
    var cands = calStudentCandidates(ls.unmatched);
    if (cands.length){
      html += "<div class=\"eyebrow\" style=\"margin:12px 0 6px;\">Criar alunos a partir da agenda</div>" +
        "<p class=\"muted-p\" style=\"margin-bottom:6px;\">Estes nomes aparecem na agenda e ainda não são alunos. Só vêm marcados os nomes que aparecem 3 vezes ou mais. Confirma os que são alunos (podes corrigir o nome) e cria-os de uma vez; as aulas contam-se logo. Os que não são alunos, toca em «Ignorar os não selecionados». São criados como <em>só estúdio</em>: não entram nos alertas de «sem registos» da app.</p>" +
        cands.map(function(c, i){ return "<div class=\"history-row\" style=\"align-items:center; gap:8px; flex-wrap:wrap;\"><input type=\"checkbox\" data-gc-new=\"" + i + "\"" + (c.likely && c.n >= CAL_MIN_EVENTS ? " checked" : "") + " aria-label=\"Criar aluno\"><input type=\"text\" class=\"mini-select\" data-gc-name=\"" + i + "\" maxlength=\"80\" value=\"" + escapeHtml(c.name) + "\" style=\"flex:1 1 160px; min-width:0;\"><span class=\"muted-p\">×" + c.n + (c.n === 1 ? " evento" : " eventos") + "</span></div>"; }).join("") +
        (ls.unmatchedMore ? "<p class=\"muted-p\" style=\"margin-top:6px;\">Há mais " + ls.unmatchedMore + " títulos menos frequentes que não se mostram aqui.</p>" : "") +
        "<p class=\"muted-p\" id=\"gcNewOut\" style=\"display:none; margin-top:6px;\"></p>" +
        "<div style=\"display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;\"><button type=\"button\" class=\"btn primary btn-sm\" id=\"gcCreate\">Criar os alunos selecionados</button>" +
        "<button type=\"button\" class=\"btn btn-sm\" id=\"gcIgnore\">Ignorar os não selecionados</button>" +
        "<button type=\"button\" class=\"btn btn-sm\" id=\"gcIgnoreAll\">Ignorar todos</button></div>";
    }
    html += "<details class=\"perfil-section\" style=\"margin-top:12px;\"><summary class=\"eyebrow\">Associar a um aluno que já existe</summary><p class=\"muted-p\" style=\"margin:6px 0;\">Se algum destes é um aluno com o nome escrito de outra forma, associa-o (fica guardado para as próximas vezes).</p>" +
      ls.unmatched.map(function(u, i){ return "<div class=\"history-row\" style=\"align-items:center; gap:6px; flex-wrap:wrap;\"><div class=\"hlabel\" style=\"flex:1 1 120px;\">" + escapeHtml(u.title) + " <span class=\"muted-p\">×" + u.n + "</span></div><select class=\"mini-select\" data-gc-alias=\"" + i + "\"><option value=\"\">Associar a…</option>" + visibleStudentsForDashboard().filter(isStudentActive).map(function(st){ return "<option value=\"" + escapeHtml(st.id) + "\">" + escapeHtml(st.name) + "</option>"; }).join("") + "</select></div>"; }).join("") + "</details>";
  }
  return html + "</div>";
}
function calendarSummaryText(ls){
  var days = Math.floor((Date.now() - new Date(ls.at).getTime()) / 86400000);
  var t = "Última sincronização " + (days <= 0 ? "hoje" : "há " + days + (days === 1 ? " dia" : " dias")) + ": " + ls.events + " eventos lidos, " + ls.matched + " de alunos · " + ls.inserted + " novas, " + ls.updated + " atualizadas, " + ls.removed + " removidas" + (ls.errors ? " · ⚠ " + ls.errors + " com erro" : "") + ".";
  if (ls.warnUsedBefore && ls.warnUsedBefore.length) t += " ⚠ Pacotes com 'aulas já dadas' maior que 0 (" + ls.warnUsedBefore.slice(0, 4).join(", ") + "): o calendário também conta essas aulas — põe 0.";
  return t;
}

// dados de demonstração (só no modo local, sem Supabase)
function studioSeedDemo(){
  var d = function(n){ return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10); };
  var ahead = function(n){ return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10); };
  studio.packs = [
    {id: "pk1", student_id: "maria", name: "Pack 10 sessões", total: 10, price: 250, starts_on: d(40), expires_on: ahead(8), missed_consumes: true, late_cancel_consumes: true, used_before: 0},
    {id: "pk2", student_id: "rui", name: "Pack 20 sessões", total: 20, price: 440, starts_on: d(30), expires_on: ahead(60), missed_consumes: true, late_cancel_consumes: true},
    {id: "pk3", student_id: "sofia", name: "Pack 10 sessões", total: 10, price: 250, starts_on: d(70), expires_on: d(5), missed_consumes: true, late_cancel_consumes: true}
  ];
  var sess = [];
  for (var i = 0; i < 8; i++) sess.push({id: "s1" + i, student_id: "maria", pack_id: "pk1", date: d(36 - i * 4), status: i === 5 ? "faltou" : "feita"});
  for (var j = 0; j < 6; j++) sess.push({id: "s2" + j, student_id: "rui", pack_id: "pk2", date: d(28 - j * 5), status: j === 3 ? "cancelada_tarde" : "feita"});
  sess.push({id: "s30", student_id: "sofia", pack_id: "pk3", date: d(60), status: "feita"}, {id: "s31", student_id: "sofia", pack_id: "pk3", date: d(50), status: "faltou"}, {id: "s32", student_id: "sofia", pack_id: "pk3", date: d(20), status: "faltou"});
  studio.sessions = sess;
  studio.slots = [
    {id: "sl1", student_id: "maria", weekday: 2, time: "18:00", counts_from: d(0), generated_until: d(1)},
    {id: "sl2", student_id: "maria", weekday: 4, time: "18:00", counts_from: d(0), generated_until: d(1)},
    {id: "sl3", student_id: "rui", weekday: 1, time: "19:00", counts_from: d(14), generated_until: null},
    {id: "sl4", student_id: "rui", weekday: 3, time: "19:00", counts_from: d(14), generated_until: null},
    {id: "sl5", student_id: "rui", weekday: 5, time: "19:00", counts_from: d(14), generated_until: null}
  ];
  studio.payments = [
    {id: "py1", student_id: "maria", pack_id: "pk1", amount: 250, due_on: d(40), paid_on: d(40), method: "mbway"},
    {id: "py2", student_id: "rui", pack_id: "pk2", amount: 440, due_on: d(30), paid_on: d(29), method: "transferencia"},
    {id: "py3", student_id: "sofia", pack_id: "pk3", amount: 250, due_on: d(12), paid_on: null, method: null},
    {id: "py4", student_id: "maria", pack_id: null, amount: 250, due_on: ahead(2), paid_on: null, method: null}
  ];
}

/* ---------- Estúdio: ecrãs (ficha do aluno e visão geral) ---------- */
function studioUnavailableHtml(){
  return "<div class=\"card\"><div class=\"eyebrow\" style=\"margin-bottom:6px;\">Pacotes e cobranças</div><p class=\"muted-p\">Ainda não é possível usar esta área: falta correr a migração <strong>0023</strong> no SQL Editor do Supabase (ficheiro <code>supabase/migrations/0023_studio_packs.sql</code>) e depois recarregar a app.</p></div>";
}
function sessionStatusPill(status, date){
  var tone = {feita: "good", faltou: "critical", cancelada: "", cancelada_tarde: "warn", agendada: ""}[status] || "";
  var label = (SESSION_STATUS[status] || {}).label || status;
  if (status === "agendada" && isIsoDate(date) && date < localTodayISO()){ tone = "warn"; label = "Agendada · por confirmar"; } // a data já passou e não há evento na agenda
  return "<span class=\"pill " + tone + "\">" + escapeHtml(label) + "</span>";
}
function packBarHtml(pack, u, viewerId){
  var foreign = !!viewerId && pack.student_id !== viewerId;
  var others = packMembersOf(pack).filter(function(id){ return id !== viewerId && (!foreign || id !== pack.student_id) && findStudent(id); }).map(nameOf);
  var shareLine = foreign ? "Pacote de " + nameOf(pack.student_id) + (others.length ? " · também com " + others.join(", ") : "") : others.length ? "Partilhado com " + others.join(", ") : "";
  return "<div class=\"history-row\" style=\"align-items:flex-start;\"><div style=\"min-width:0;flex:1;\">" +
    "<div class=\"hlabel\">" + escapeHtml(pack.name) + (u.expired ? " <span class=\"pill\">caducado</span>" : u.exhausted ? " <span class=\"pill\">esgotado</span>" : u.ending ? " <span class=\"pill warn\">a acabar</span>" : "") + "</div>" +
    "<div class=\"muted-p\" style=\"font-size:0.76rem;\">" + u.used + " de " + u.total + " usadas · restam " + u.remaining +
      (pack.expires_on ? " · validade até " + escapeHtml(fmtDateFullPt(pack.expires_on)) + (u.daysLeft != null && u.daysLeft >= 0 ? " (" + u.daysLeft + " d)" : "") : renewMonthsPending(pack) ? " · a validade conta a partir da 1.ª aula" : " · sem validade") + "</div>" +
    (shareLine ? "<div class=\"muted-p\" style=\"font-size:0.76rem;\">👥 " + escapeHtml(shareLine) + " · as aulas descontam ao mesmo pacote</div>" : "") +
    (shareLine ? "<div class=\"muted-p\" style=\"font-size:0.76rem;\">Aulas usadas: " + (function(){ var l = packUsageByStudent(pack).map(function(x){ return "<strong>" + escapeHtml(x.name) + "</strong> " + x.n; }); if (Number(pack.used_before) > 0) l.unshift("antes da app " + Number(pack.used_before)); return l.length ? l.join(" · ") : "nenhuma ainda"; })() + "</div>" : "") +
    "<div class=\"bar-track\" style=\"margin-top:6px;\"><div class=\"bar-fill\" style=\"width:" + u.pct + "%\"></div></div></div>" +
    (foreign ? "" : "<span style=\"display:flex; gap:12px; align-items:center; flex-wrap:wrap; justify-content:flex-end;\">" + ("<button type=\"button\" class=\"btn btn-sm" + (u.exhausted || u.expired || u.ending ? " primary" : "") + "\" style=\"min-height:44px;\" data-renew-pack=\"" + escapeHtml(pack.id) + "\" title=\"Novo pacote igual a este, com a cobrança por pagar" + (u.remaining > 0 && !u.expired ? " (as " + u.remaining + " aulas que restam gastam-se primeiro)" : "") + "\">Renovar</button>") + "<button type=\"button\" class=\"btn btn-sm\" style=\"min-height:44px;\" data-edit-pack=\"" + escapeHtml(pack.id) + "\" title=\"Mudar aulas, validade ou início\">Editar</button><button type=\"button\" class=\"btn btn-sm\" style=\"min-height:44px;\" data-share-pack=\"" + escapeHtml(pack.id) + "\" title=\"Casais ou pessoas que partilham o mesmo pagamento\">Partilhar</button>" +
    "<button type=\"button\" class=\"assess-del\" style=\"min-width:44px; min-height:44px;\" data-del-pack=\"" + escapeHtml(pack.id) + "\" aria-label=\"Apagar pacote\" title=\"Apagar pacote (as sessões ficam sem pacote)\">✕</button></span>") + "</div>";
}
function paymentRowHtml(p, today, withName){
  var st = paymentStatus(p, today), tone = {pago: "good", atrasado: "critical", "a vencer": "warn", futuro: ""}[st];
  return "<div class=\"history-row\"" + (withName ? " data-sname=\"" + escapeHtml(exLibFold(nameOf(p.student_id))) + "\"" : "") + " style=\"align-items:center;\"><div style=\"min-width:0;flex:1;\">" +
    "<div class=\"hlabel\">" + (withName ? "<button type=\"button\" class=\"wl-info\" data-open-student=\"" + escapeHtml(p.student_id) + "\">" + escapeHtml(nameOf(p.student_id)) + "</button> · " : "") + escapeHtml(eur(p.amount)) + " <span class=\"pill " + tone + "\">" + st + "</span></div>" +
    "<div class=\"muted-p\" style=\"font-size:0.76rem;\">Vence " + escapeHtml(fmtDateFullPt(p.due_on)) + (p.paid_on ? " · pago em " + escapeHtml(fmtDateFullPt(p.paid_on)) + (p.method ? " (" + escapeHtml(PAYMENT_METHODS[p.method] || p.method) + ")" : "") : "") + "</div></div>" +
    "<span style=\"white-space:nowrap;\">" + (p.paid_on ? "" : "<button type=\"button\" class=\"btn btn-sm primary\" data-pay=\"" + escapeHtml(p.id) + "\">Pago</button> ") +
    (!p.paid_on && withName ? "<button type=\"button\" class=\"btn btn-sm\" data-remind=\"" + escapeHtml(p.id) + "\">Lembrar</button> " : "") +
    "<button type=\"button\" class=\"assess-del\" data-del-payment=\"" + escapeHtml(p.id) + "\" aria-label=\"Apagar cobrança\">✕</button></span></div>";
}

function tplProSessoes(s){
  if (!studio.available) return studioUnavailableHtml();
  var today = localTodayISO(), sum = studentStudioSummary(s.id, today);
  var html = "<div class=\"checkin-field\" style=\"max-width:220px; margin-bottom:12px;\"><label for=\"stuHours\">Horas mensais</label><input type=\"text\" inputmode=\"decimal\" id=\"stuHours\" value=\"" + (hoursOf(s.id) ? String(hoursOf(s.id)).replace(".", ",") : "") + "\" placeholder=\"ex.: 8,66\"></div>";
  html += "<div class=\"eyebrow\" style=\"margin-bottom:8px;\">Pacotes</div>";
  html += sum.packs.length ? sum.packs.map(function(x){ return packBarHtml(x.pack, x.u, s.id); }).join("") : "<p class=\"muted-p\">Ainda sem pacotes. Cria o primeiro abaixo.</p>";

  var ex0 = extrasOf(s.id, today);
  if (ex0.n && !sum.hasActive) html += "<p class=\"muted-p\" style=\"margin-top:8px; color:var(--critical);\">🔄 Aguarda renovação · +" + ex0.n + (ex0.n === 1 ? " aula extra" : " aulas extra") + " desde " + escapeHtml(fmtDateFullPt(ex0.since)) + " (descontam-se ao próximo pacote).</p>";
  var lapsed = ex0.n && !sum.hasActive ? sum.packs.filter(function(x){ return !x.foreign && x.u.expired && x.u.remaining > 0; }).sort(function(a, b){ return a.pack.starts_on < b.pack.starts_on ? 1 : -1; })[0] : null;
  if (lapsed) html += "<div style=\"margin:6px 0 10px;\"><button type=\"button\" class=\"btn btn-sm\" style=\"min-height:44px;\" data-extend-pack=\"" + escapeHtml(lapsed.pack.id) + "\">Contar estas aulas no pacote caducado (sem validade)</button><p class=\"muted-p\" style=\"font-size:0.76rem; margin-top:4px;\">Para quando o aluno parou e voltou ao mesmo pacote: ainda tem " + lapsed.u.remaining + (lapsed.u.remaining === 1 ? " aula" : " aulas") + " nele.</p></div>";
  if (calUsesCalendar()){
    var nCal = studio.sessions.filter(function(x){ return x.student_id === s.id && x.source === "calendario"; }).length;
    html += "<div class=\"eyebrow\" style=\"margin:22px 0 8px;\">Google Agenda</div>" +
      "<p class=\"muted-p\">As aulas contam-se pelo nome na agenda: um evento com «" + escapeHtml(s.name) + "» no título (por exemplo «PT 60 - " + escapeHtml(s.name) + "») conta como aula" + (nCal ? " (" + nCal + " já contadas)" : "") + ". Se na agenda aparece com outro nome, associa-o em Estúdio → Google Agenda, nos títulos sem aluno.</p>";
  } else if (studio.slotsAvailable){
    var slots = slotsOf(s.id);
    html += "<div class=\"eyebrow\" style=\"margin:22px 0 8px;\">Horário semanal</div>" +
      "<p class=\"muted-p\" style=\"margin-bottom:8px;\">As sessões deste horário contam-se sozinhas depois de passarem (como os eventos do calendário). Só precisas de marcar as exceções: faltou, cancelou, mudou de dia.</p>" +
      (slots.length ? slots.map(function(sl){ return "<div class=\"history-row\" style=\"align-items:center;\"><div class=\"hlabel\">" + escapeHtml(slotLabel(sl)) + "<div class=\"muted-p\" style=\"font-size:0.74rem;\">conta desde " + escapeHtml(fmtDateFullPt(sl.counts_from)) + "</div></div><button type=\"button\" class=\"assess-del\" data-del-slot=\"" + escapeHtml(sl.id) + "\" aria-label=\"Remover horário\">✕</button></div>"; }).join("") : "<p class=\"muted-p\">Sem horário fixo.</p>") +
      "<details class=\"perfil-section\" style=\"margin-top:10px;\"><summary class=\"eyebrow\">+ Novo horário</summary><div class=\"assess-form-grid\" style=\"margin-top:10px;\">" +
      "<div class=\"f\"><label>Dia da semana</label><select id=\"slWeekday\" class=\"mini-select\" style=\"width:100%;\">" + [1,2,3,4,5,6,7].map(function(i){ return "<option value=\"" + i + "\">" + WEEKDAY_NAMES[i] + "</option>"; }).join("") + "</select></div>" +
      "<div class=\"f\"><label>Hora</label><input type=\"time\" id=\"slTime\" value=\"18:00\"></div>" +
      "<div class=\"f\" style=\"grid-column:1/-1;\"><label>Contar as sessões desde</label><input type=\"date\" id=\"slFrom\" value=\"" + today + "\"></div>" +
      "<p class=\"muted-p\" style=\"grid-column:1/-1;\">Se o pacote já vem a meio, põe hoje e indica no pacote as aulas já dadas. Para contar desde o início do pacote, escolhe essa data.</p>" +
      "<p class=\"muted-p\" id=\"slErr\" style=\"grid-column:1/-1; color:var(--critical); display:none;\"></p>" +
      "<div class=\"f\" style=\"grid-column:1/-1;\"><button type=\"button\" class=\"btn primary btn-sm\" id=\"slAdd\" style=\"width:100%;\">Adicionar horário</button></div></div></details>";
  }

  html += "<details class=\"perfil-section\" style=\"margin-top:14px;\"><summary class=\"eyebrow\">+ Novo pacote</summary><div class=\"assess-form-grid\" style=\"margin-top:10px;\" id=\"packForm\">" +
    "<div class=\"f\" style=\"grid-column:1/-1;\"><label>Nome</label><input type=\"text\" id=\"pkName\" maxlength=\"80\" value=\"Pack 10 sessões\"></div>" +
    "<div class=\"f\"><label>Sessões</label><input type=\"number\" id=\"pkTotal\" min=\"1\" max=\"500\" value=\"10\"></div>" +
    "<div class=\"f\"><label>Preço (€)</label><input type=\"number\" id=\"pkPrice\" min=\"0\" step=\"0.5\" placeholder=\"250\"></div>" +
    "<div class=\"f\"><label>Início</label><input type=\"date\" id=\"pkStart\" value=\"" + today + "\"></div>" +
    (studio.slotsAvailable ? "<div class=\"f\"><label>Aulas já dadas (antes da app)</label><input type=\"number\" id=\"pkUsed\" min=\"0\" max=\"500\" value=\"0\"></div>" : "") +
    "<div class=\"f\"><label>Tipo de pack</label><select id=\"pkType\" class=\"mini-select\" style=\"width:100%;\"><option value=\"\">Outro</option>" + Object.keys(PACK_TYPES).map(function(k){ return "<option value=\"" + k + "\">" + PACK_TYPES[k].label + " · " + PACK_TYPES[k].months + " meses</option>"; }).join("") + "</select></div>" +
    "<div class=\"f\"><label>Validade (meses, 0 = sem)</label><input type=\"number\" id=\"pkMonths\" min=\"0\" max=\"36\" value=\"3\"></div>" +
    "<p class=\"muted-p\" style=\"grid-column:1/-1; font-size:0.76rem;\">A validade é a duração do pack + " + PACK_VALIDITY_EXTRA_MONTHS + " meses (trimestral pago a 14/01: dura até 14/04 e vale até 14/07). O mensal vale 3 meses desde o mês em que paga.</p>" +
    (studio.sharedAvailable ? "<div class=\"f\" style=\"grid-column:1/-1;\"><label>Partilhado com (casais: um só pagamento)</label><select id=\"pkShare\" class=\"mini-select\" style=\"width:100%;\"><option value=\"\">Ninguém</option>" +
      studentsForSharing(s.id).map(function(st){ return "<option value=\"" + escapeHtml(st.id) + "\">" + escapeHtml(st.name) + "</option>"; }).join("") + "</select></div>" : "") +
    "<label class=\"f\" style=\"grid-column:1/-1; display:flex; gap:8px; align-items:center;\"><input type=\"checkbox\" id=\"pkMissed\" checked> Faltar sem aviso gasta uma sessão</label>" +
    "<label class=\"f\" style=\"grid-column:1/-1; display:flex; gap:8px; align-items:center;\"><input type=\"checkbox\" id=\"pkLate\" checked> Cancelar tarde gasta uma sessão</label>" +
    "<label class=\"f\" style=\"grid-column:1/-1; display:flex; gap:8px; align-items:center;\"><input type=\"checkbox\" id=\"pkCharge\" checked> Criar a cobrança (vence no início, se tiver preço)</label>" +
    "<p class=\"muted-p\" id=\"pkErr\" style=\"grid-column:1/-1; color:var(--critical); display:none;\"></p>" +
    "<div class=\"f\" style=\"grid-column:1/-1;\"><button type=\"button\" class=\"btn primary btn-sm\" id=\"pkAdd\" style=\"width:100%;\">Criar pacote</button></div></div></details>";

  html += "<div class=\"eyebrow\" style=\"margin:22px 0 8px;\">Registar sessão</div><div class=\"assess-form-grid\" id=\"sessForm\">" +
    "<div class=\"f\"><label>Data</label><input type=\"date\" id=\"seDate\" value=\"" + today + "\"></div>" +
    "<div class=\"f\"><label>Hora (opcional)</label><input type=\"time\" id=\"seTime\"></div>" +
    "<div class=\"f\" style=\"grid-column:1/-1;\"><label>Resultado</label><select id=\"seStatus\" class=\"mini-select\" style=\"width:100%;\">" + Object.keys(SESSION_STATUS).map(function(k){ return "<option value=\"" + k + "\">" + SESSION_STATUS[k].label + "</option>"; }).join("") + "</select></div>" +
    "<p class=\"muted-p\" id=\"seErr\" style=\"grid-column:1/-1; color:var(--critical); display:none;\"></p>" +
    "<div class=\"f\" style=\"grid-column:1/-1;\"><button type=\"button\" class=\"btn primary btn-sm\" id=\"seAdd\" style=\"width:100%;\">Registar</button></div></div>" +
    "<p class=\"muted-p\" style=\"margin-top:6px;\">É descontada ao pacote que caduca primeiro e ainda tem sessões. Se não houver pacote, a sessão fica registada sem pacote.</p>";

  var allSess = sessionsOfStudent(s.id);
  var upcoming = allSess.filter(function(x){ return x.status === "agendada" && x.date >= today; }).sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  var numMap = sessionNumberMap();
  var sessRow = function(x){
    var pk = studio.packs.filter(function(p){ return p.id === x.pack_id; })[0];
    return "<div class=\"history-row\" style=\"align-items:center; flex-wrap:wrap; gap:6px;\"><div style=\"min-width:0;flex:1 1 130px;\"><div class=\"hlabel\">" + escapeHtml(fmtDateFullPt(x.date)) + (x.time ? " · " + escapeHtml(x.time) : "") + " " + sessionNumberPill(numMap[x.id]) + "</div><div class=\"muted-p\" style=\"font-size:0.76rem;\">" + (pk ? escapeHtml(pk.name) + (pk.student_id !== x.student_id && findStudent(pk.student_id) ? " · pacote de " + escapeHtml(nameOf(pk.student_id)) : "") : "sem pacote") + "</div></div>" +
      "<span style=\"display:flex; gap:6px; align-items:center; flex-wrap:wrap;\">" + sessionStatusPill(x.status, x.date) +
      "<select class=\"mini-select\" data-sess-set=\"" + escapeHtml(x.id) + "\" aria-label=\"Alterar estado da sessão\"><option value=\"\">Alterar…</option>" + Object.keys(SESSION_STATUS).filter(function(k){ return k !== x.status; }).map(function(k){ return "<option value=\"" + k + "\">" + SESSION_STATUS[k].label + "</option>"; }).join("") + "</select>" +
      " <button type=\"button\" class=\"assess-del\" data-del-session=\"" + escapeHtml(x.id) + "\" aria-label=\"Apagar sessão\">✕</button></span></div>";
  };
  if (upcoming.length){
    html += "<div class=\"eyebrow\" style=\"margin:22px 0 8px;\">Próximas sessões agendadas · " + upcoming.length + "</div>" + upcoming.slice(0, 10).map(sessRow).join("") +
      (upcoming.length > 10 ? "<p class=\"muted-p\" style=\"margin-top:6px;\">+ " + (upcoming.length - 10) + " mais, até " + escapeHtml(fmtDateFullPt(upcoming[upcoming.length - 1].date)) + ".</p>" : "");
  }
  var sess = allSess.filter(function(x){ return !(x.status === "agendada" && x.date >= today); }).slice(0, 12);
  html += "<div class=\"eyebrow\" style=\"margin:22px 0 8px;\">Sessões recentes" + (sum.absences ? " · " + plural(sum.absences, "falta", "faltas") + " nos últimos " + ABSENCE_WINDOW_DAYS + " dias" : "") + "</div>";
  html += sess.length ? sess.map(sessRow).join("") : "<p class=\"muted-p\">Sem sessões registadas.</p>";

  var pays = paymentsOfStudent(s.id);
  html += "<div class=\"eyebrow\" style=\"margin:22px 0 8px;\">Cobranças</div>" + (pays.length ? pays.slice(0, 10).map(function(p){ return paymentRowHtml(p, today, false); }).join("") : "<p class=\"muted-p\">Sem cobranças.</p>") +
    "<details class=\"perfil-section\" style=\"margin-top:10px;\"><summary class=\"eyebrow\">+ Nova cobrança</summary><div class=\"assess-form-grid\" style=\"margin-top:10px;\">" +
    "<div class=\"f\"><label>Valor (€)</label><input type=\"number\" id=\"pyAmount\" min=\"0.01\" step=\"0.5\"></div>" +
    "<div class=\"f\"><label>Vence em</label><input type=\"date\" id=\"pyDue\" value=\"" + today + "\"></div>" +
    "<p class=\"muted-p\" id=\"pyErr\" style=\"grid-column:1/-1; color:var(--critical); display:none;\"></p>" +
    "<div class=\"f\" style=\"grid-column:1/-1;\"><button type=\"button\" class=\"btn primary btn-sm\" id=\"pyAdd\" style=\"width:100%;\">Criar cobrança</button></div></div></details>";
  if (isStudioOnly(s)){
    html += "<details class=\"perfil-section\" style=\"margin-top:22px;\"><summary class=\"eyebrow\">Remover este aluno</summary><p class=\"muted-p\" style=\"margin:8px 0;\">Só para alunos criados por engano a partir da agenda. Apaga a ficha, os pacotes, as sessões e as cobranças deste aluno. Os eventos dele na agenda deixam de contar.</p>" +
      "<p class=\"muted-p\" id=\"stuRemoveErr\" style=\"color:var(--critical); display:none;\"></p>" +
      "<button type=\"button\" class=\"btn btn-sm\" id=\"stuRemove\" style=\"border-color:var(--critical); color:var(--critical);\">Apagar " + escapeHtml(s.name) + "</button></details>";
  }
  return html;
}
// apaga um aluno "só estúdio" (criado por engano a partir da agenda): a ficha, e com ela os pacotes, sessões e cobranças (cascata no servidor)
function removeStudioOnlyStudent(s){
  if (!isStudioOnly(s)) return Promise.resolve({error: "Só se apagam alunos criados a partir da agenda e sem conta na app."});
  var id = s.id;
  var local = function(){
    clearTimeout(persistTimers[id]); delete persistTimers[id]; delete persistStudents[id];
    try { var ob = outboxRead(); if (ob[id]){ delete ob[id]; outboxWrite(); } } catch (e) {}
    var i = STUDENTS.indexOf(s); if (i >= 0) STUDENTS.splice(i, 1);
    var gonePacks = studio.packs.filter(function(p){ return p.student_id === id; }).map(function(p){ return p.id; });
    studio.sessions.concat(studio.payments).forEach(function(x){ if (gonePacks.indexOf(x.pack_id) >= 0) x.pack_id = null; });   // as sessões de quem partilhava o pacote ficam sem pacote (como ao apagar um pacote)
    ["sessions", "packs", "payments", "slots"].forEach(function(k){ studio[k] = studio[k].filter(function(x){ return x.student_id !== id; }); });
    if (!sbReady) studioLocalWrite();
    // os títulos que apontavam para ele passam a ser ignorados (senão voltavam a aparecer para criar)
    Object.keys(calSettings.aliases).forEach(function(k){ if (calSettings.aliases[k] === id){ delete calSettings.aliases[k]; calSettings.ignored[k] = true; } });
    calSettings.ignored[calTitleKey(s.name)] = true;
    return calSaveSettings().then(function(){ return {}; });
  };
  if (!sbReady) return local();
  return Promise.resolve(sb.from("students").delete().eq("id", id)).then(function(res){
    if (!res || res.error) return {error: "Não foi possível apagar — verifica a ligação."};
    return local();
  }, function(){ return {error: "Não foi possível apagar — verifica a ligação."}; });
}

function studioRerender(s){ if (s && state.proSelectedId === s.id) renderProTabContent(s); else renderProStudioMain(); }
function openPayModal(paymentId, onDone){
  var p = studio.payments.filter(function(x){ return x.id === paymentId; })[0];
  if (!p) return;
  var sheet = openModal("<div class=\"mtitle\">Marcar como pago</div><p class=\"muted-p\" style=\"margin-bottom:10px;\">" + escapeHtml(nameOf(p.student_id)) + " · " + escapeHtml(eur(p.amount)) + "</p>" +
    "<div class=\"checkin-field\"><label for=\"payDate\">Pago em</label><input type=\"date\" id=\"payDate\" value=\"" + localTodayISO() + "\"></div>" +
    "<div class=\"checkin-field\"><label for=\"payMethod\">Método</label><select id=\"payMethod\" class=\"mini-select\" style=\"width:100%;\">" + Object.keys(PAYMENT_METHODS).map(function(k){ return "<option value=\"" + k + "\">" + PAYMENT_METHODS[k] + "</option>"; }).join("") + "</select></div>" +
    "<p class=\"muted-p\" id=\"payErr\" style=\"color:var(--critical); display:none;\"></p>" +
    "<button type=\"button\" class=\"btn primary\" id=\"payGo\" style=\"width:100%;\">Confirmar</button>");
  sheet.querySelector("#payGo").addEventListener("click", function(){
    var d = sheet.querySelector("#payDate").value;
    if (!isIsoDate(d)){ var e = sheet.querySelector("#payErr"); e.textContent = "Indica a data do pagamento."; e.style.display = "block"; return; }
    studioUpdate("payments", paymentId, {paid_on: d, method: sheet.querySelector("#payMethod").value}).then(function(r){
      if (r.error){ var e2 = sheet.querySelector("#payErr"); e2.textContent = r.error; e2.style.display = "block"; return; }
      closeModal(); showToast("✓ Pagamento registado"); if (onDone) onDone();
    });
  });
}
// registar uma sessão (usado na ficha e no registo rápido)
function studioAddSession(studentId, date, status, time){
  if (!isIsoDate(date)) return Promise.resolve({error: "Indica a data da sessão."});
  if (!SESSION_STATUS[status]) return Promise.resolve({error: "Escolhe o resultado."});
  var pack = pickPackForSession(studentId, date);
  var row = {student_id: studentId, pack_id: pack ? pack.id : null, date: date, status: status};
  if (time && /^\d{2}:\d{2}$/.test(time)) row.time = time;
  return studioInsert("sessions", row);
}

// muda o estado de uma sessão (confirmar uma agendada, marcar falta...); passa a "manual" para a sincronização não lhe mexer
function studioSetSessionStatus(ses, status){
  if (!ses || !SESSION_STATUS[status]) return Promise.resolve({error: "Escolhe o estado."});
  var patch = {status: status};
  if (ses.source === "calendario" || ses.source === "folha") patch.source = "manual";
  if (!ses.pack_id && status !== "agendada"){
    var probe = Object.assign({}, ses, {pack_id: null, status: status});
    var pk = pickPackForSession(ses.student_id, ses.date);
    if (pk && sessionConsumes(pk, probe)) patch.pack_id = pk.id;
  }
  return studioUpdate("sessions", ses.id, patch);
}
function wireProSessoes(s, el){
  var hrsIn = el.querySelector("#stuHours");
  if (hrsIn) hrsIn.addEventListener("change", function(){
    var raw = hrsIn.value.trim(), h = raw ? parseImportNumber(raw) : 0;
    if (h == null || h < 0 || h > 200){ showToast("⚠ Horas inválidas (ex.: 8,66)"); hrsIn.value = hoursOf(s.id) ? String(hoursOf(s.id)).replace(".", ",") : ""; return; }
    setStudentHours(s.id, Math.round(h * 100) / 100).then(function(r){ showToast(r.error ? "⚠ " + r.error : h ? "✓ Horas mensais guardadas" : "✓ Horas removidas"); if (r.error) hrsIn.value = hoursOf(s.id) ? String(hoursOf(s.id)).replace(".", ",") : ""; });
  });
  function fail(id, msg){ var e = el.querySelector(id); if (e){ e.textContent = msg; e.style.display = "block"; } }
  el.querySelectorAll("[data-sess-set]").forEach(function(sel){ sel.addEventListener("change", function(){
    var ses = studio.sessions.filter(function(x){ return x.id === sel.getAttribute("data-sess-set"); })[0];
    if (!ses || !sel.value) return;
    sel.disabled = true;
    studioSetSessionStatus(ses, sel.value).then(function(r){ if (r.error) showToast("⚠ " + r.error); renderProTabContent(s); updateStudioBadge(); });
  }); });
  var stuRemove = el.querySelector("#stuRemove");
  if (stuRemove) stuRemove.addEventListener("click", function(){
    if (!window.confirm(["Apagar ", s.name, " e tudo o que está ligado (pacotes, sessões, cobranças)? Não dá para desfazer."].join(""))) return;
    stuRemove.disabled = true;
    removeStudioOnlyStudent(s).then(function(r){
      if (r.error){ stuRemove.disabled = false; return fail("#stuRemoveErr", r.error); }
      showToast("✓ Aluno apagado"); state.proSelectedId = null; state.proView = APP_MODE === "gestao" ? "studio" : "dashboard"; renderProShell(); updateStudioBadge();
    });
  });
  var pkAdd = el.querySelector("#pkAdd");
  if (pkAdd) pkAdd.addEventListener("click", function(){
    var name = el.querySelector("#pkName").value.trim(), total = parseInt(el.querySelector("#pkTotal").value, 10), start = el.querySelector("#pkStart").value;
    var priceRaw = el.querySelector("#pkPrice").value, price = priceRaw === "" ? null : Number(priceRaw), months = parseInt(el.querySelector("#pkMonths").value, 10) || 0;
    if (!name) return fail("#pkErr", "Dá um nome ao pacote.");
    if (!(total >= 1 && total <= 500)) return fail("#pkErr", "O número de sessões tem de estar entre 1 e 500.");
    if (!isIsoDate(start)) return fail("#pkErr", "Indica a data de início.");
    if (price != null && !(price >= 0)) return fail("#pkErr", "O preço não pode ser negativo.");
    var usedBefore = el.querySelector("#pkUsed") ? parseInt(el.querySelector("#pkUsed").value, 10) || 0 : 0;
    if (usedBefore < 0 || usedBefore > total) return fail("#pkErr", "As aulas já dadas têm de estar entre 0 e " + total + ".");
    var exp = months > 0 ? addMonthsISO(start, months) : null;
    var partner = el.querySelector("#pkShare") ? el.querySelector("#pkShare").value : "";
    pkAdd.disabled = true;
    studioInsert("packs", Object.assign({student_id: s.id, name: name.slice(0, 80), total: total, price: price, starts_on: start, expires_on: exp,
      missed_consumes: el.querySelector("#pkMissed").checked, late_cancel_consumes: el.querySelector("#pkLate").checked}, studio.slotsAvailable ? {used_before: usedBefore} : {}, partner ? {shared_with: [partner]} : {})).then(function(r){
      if (r.error){ pkAdd.disabled = false; return fail("#pkErr", r.error); }
      var charge = price > 0 && el.querySelector("#pkCharge").checked ? studioInsert("payments", {student_id: s.id, pack_id: r.data.id, amount: price, due_on: start}) : Promise.resolve({});
      // o outro aluno também passa a poder gastar o pacote que já tinha (se tiver), para os dois acabarem juntos
      var back = partner ? studioGrantReciprocal(r.data, [partner], []) : Promise.resolve({});
      Promise.all([charge, back, attachExtrasToPack(r.data)]).then(function(res){ showToast(res[0].error ? "Pacote criado, mas a cobrança não foi guardada" : res[1].error ? "Pacote criado, mas não foi possível dar ao outro aluno acesso ao pacote dele" : "✓ Pacote criado" + (partner ? " e partilhado" : "") + (res[2] ? " · " + res[2] + (res[2] === 1 ? " aula extra descontada" : " aulas extra descontadas") : "")); studioRerender(s); });
    });
  });
  var pkType = el.querySelector("#pkType"), pkNameEl = el.querySelector("#pkName"), pkNameTouched = false;
  if (pkNameEl) pkNameEl.addEventListener("input", function(){ pkNameTouched = true; });
  if (pkType) pkType.addEventListener("change", function(){
    var t = PACK_TYPES[pkType.value];
    if (!t) return;
    el.querySelector("#pkMonths").value = String(t.months);
    if (!pkNameTouched) pkNameEl.value = "Pack " + t.label.toLowerCase();
  });
  var slAdd = el.querySelector("#slAdd");
  if (slAdd) slAdd.addEventListener("click", function(){
    var wd = parseInt(el.querySelector("#slWeekday").value, 10), tm = el.querySelector("#slTime").value, from = el.querySelector("#slFrom").value;
    if (timeToMinutes(tm) == null) return fail("#slErr", "Indica a hora (ex.: 18:00).");
    if (!isIsoDate(from)) return fail("#slErr", "Indica o dia a partir do qual contar.");
    if (slotsOf(s.id).some(function(x){ return x.weekday === wd && x.time === tm; })) return fail("#slErr", "Este horário já existe.");
    slAdd.disabled = true;
    studioInsert("slots", {student_id: s.id, weekday: wd, time: tm, counts_from: from}).then(function(r){
      if (r.error){ slAdd.disabled = false; return fail("#slErr", r.error); }
      showToast("✓ Horário adicionado"); studioAutoSessions().then(function(n){ studioRerender(s); studioAfterAutoSessions(n); });
    });
  });
  var seAdd = el.querySelector("#seAdd");
  if (seAdd) seAdd.addEventListener("click", function(){
    seAdd.disabled = true;
    studioAddSession(s.id, el.querySelector("#seDate").value, el.querySelector("#seStatus").value, el.querySelector("#seTime").value).then(function(r){
      if (r.error){ seAdd.disabled = false; return fail("#seErr", r.error); }
      showToast("✓ Sessão registada"); studioRerender(s);
    });
  });
  var pyAdd = el.querySelector("#pyAdd");
  if (pyAdd) pyAdd.addEventListener("click", function(){
    var amount = Number(el.querySelector("#pyAmount").value), due = el.querySelector("#pyDue").value;
    if (!(amount > 0)) return fail("#pyErr", "Indica um valor maior que zero.");
    if (!isIsoDate(due)) return fail("#pyErr", "Indica a data de vencimento.");
    studioInsert("payments", {student_id: s.id, amount: amount, due_on: due}).then(function(r){ if (r.error) return fail("#pyErr", r.error); showToast("✓ Cobrança criada"); studioRerender(s); });
  });
  wireStudioCommon(el, function(){ studioRerender(s); });
}
// alunos com quem se pode partilhar um pacote (ativos, menos o próprio)
function studentsForSharing(ownerId){
  return STUDENTS.filter(function(st){ return st.id !== ownerId && isStudentActive(st) && (!st.isDemo || state.showDemoStudents); })
    .sort(function(a, b){ return String(a.name).localeCompare(String(b.name), "pt", {sensitivity: "base"}); });
}
var SHARED_MIGRATION_MSG = "Para partilhar pacotes falta correr a migração 0028 no SQL Editor do Supabase (ficheiro supabase/migrations/0028_shared_packs.sql) e recarregar a app.";
// o aluno com quem se partilha passa a poder gastar também os pacotes dele que ainda têm aulas (e deixa de poder, nos removidos); assim os dois gastam do mesmo conjunto
function studioGrantReciprocal(pack, added, removed){
  var today = localTodayISO(), errors = 0, group = [pack.student_id].concat(added.filter(function(id){ return id !== pack.student_id; }));
  var jobs = [];
  studio.packs.forEach(function(q){
    if (q.id === pack.id) return;
    var cur = sharedIdsOf(q);
    if (added.indexOf(q.student_id) >= 0){
      // o conjunto fecha-se: cada aluno acrescentado passa a poder gastar os pacotes de todos os outros do grupo (se ainda têm aulas e não caducaram)
      var u = packUsage(q, today); if (u.expired || u.remaining <= 0) return;
      var missing = group.filter(function(id){ return id !== q.student_id && cur.indexOf(id) < 0; });
      if (missing.length) jobs.push({id: q.id, next: cur.concat(missing)});
    } else if (removed.indexOf(q.student_id) >= 0 && cur.indexOf(pack.student_id) >= 0){
      // só se tira o acesso se o dono não tem outro pacote ainda partilhado com este aluno
      var stillShared = studio.packs.some(function(o){ return o.id !== pack.id && o.student_id === pack.student_id && sharedIdsOf(o).indexOf(q.student_id) >= 0 && !packUsage(o, today).expired; });
      if (!stillShared) jobs.push({id: q.id, next: cur.filter(function(x){ return x !== pack.student_id; })});
    }
  });
  return jobs.reduce(function(c, j){ return c.then(function(){ return studioUpdate("packs", j.id, {shared_with: j.next}).then(function(r){ if (r.error) errors++; }); }); }, Promise.resolve()).then(function(){ return errors ? {error: "Não foi possível atualizar " + errors + (errors === 1 ? " pacote" : " pacotes") + " do outro aluno."} : {}; });
}
function studioSetPackSharing(pack, ids, reciprocal){
  if (!studio.sharedAvailable) return Promise.resolve({error: SHARED_MIGRATION_MSG});
  ids = (ids || []).filter(function(id, i, a){ return id && id !== pack.student_id && a.indexOf(id) === i; });
  if (ids.length > 10) return Promise.resolve({error: "Um pacote só pode ser partilhado com 10 alunos no máximo."});
  var before = sharedIdsOf(pack);
  var removed = before.filter(function(id){ return ids.indexOf(id) < 0; });
  return studioUpdate("packs", pack.id, {shared_with: ids}).then(function(r){
    if (r.error) return {error: /shared_with/.test(r.error) ? SHARED_MIGRATION_MSG : r.error};
    // com a partilha nos dois sentidos, repõe-se sempre o que falta a TODOS os escolhidos (guardar outra vez repara uma falha anterior)
    return reciprocal ? studioGrantReciprocal(pack, ids, removed) : {};
  });
}
// editar o pacote: total, aulas já dadas antes da app, início e validade (vazia = sem validade); depois as aulas extra que caibam passam para ele
function openEditPackModal(pack, onDone){
  var owner = findStudent(pack.student_id);
  var sheet = openModal("<div class=\"mtitle\">Editar pacote</div><p class=\"muted-p\" style=\"margin-bottom:10px;\">«" + escapeHtml(pack.name) + "» de " + escapeHtml(owner ? owner.name : "—") + ".</p>" +
    "<div class=\"checkin-field\"><label for=\"epTotal\">Aulas do pacote</label><input type=\"number\" id=\"epTotal\" min=\"1\" max=\"500\" inputmode=\"numeric\" value=\"" + (Number(pack.total) || 0) + "\"></div>" +
    (studio.slotsAvailable ? "<div class=\"checkin-field\"><label for=\"epUsed\">Aulas já dadas antes da app</label><input type=\"number\" id=\"epUsed\" min=\"0\" inputmode=\"numeric\" value=\"" + (Number(pack.used_before) || 0) + "\"></div>" : "") +
    "<div class=\"checkin-field\"><label for=\"epStart\">Início</label><input type=\"date\" id=\"epStart\" value=\"" + escapeHtml(pack.starts_on || "") + "\"></div>" +
    "<div class=\"checkin-field\"><label for=\"epExpiry\">Validade (vazio = sem validade)</label><input type=\"date\" id=\"epExpiry\" value=\"" + escapeHtml(pack.expires_on || "") + "\"></div>" +
    "<p class=\"muted-p\" id=\"epErr\" style=\"color:var(--critical); display:none; margin:8px 0;\"></p>" +
    "<button type=\"button\" class=\"btn primary\" id=\"epGo\" style=\"width:100%; margin-top:10px;\">Guardar</button>");
  sheet.querySelector("#epGo").addEventListener("click", function(){
    var err = sheet.querySelector("#epErr"), btn = sheet.querySelector("#epGo");
    function fail(m){ err.textContent = m; err.style.display = "block"; }
    var total = parseInt(sheet.querySelector("#epTotal").value, 10), start = sheet.querySelector("#epStart").value, exp = sheet.querySelector("#epExpiry").value;
    var usedEl = sheet.querySelector("#epUsed"), used = usedEl ? (parseInt(usedEl.value, 10) || 0) : 0;
    if (!(total >= 1 && total <= 500)) return fail("O número de aulas tem de estar entre 1 e 500.");
    if (used < 0 || used > total) return fail("As aulas já dadas têm de estar entre 0 e " + total + ".");
    if (!isIsoDate(start)) return fail("Indica a data de início.");
    if (exp && !isIsoDate(exp)) return fail("A validade não é uma data válida.");
    if (exp && exp < start) return fail("A validade não pode ser antes do início.");
    var patch = {total: total, starts_on: start, expires_on: exp || null};
    if (usedEl) patch.used_before = used;
    btn.disabled = true;
    studioUpdate("packs", pack.id, patch).then(function(r){
      if (r.error){ btn.disabled = false; return fail(r.error); }
      return attachExtrasToPack(pack).then(function(n){ closeModal(); showToast("✓ Pacote atualizado" + (n ? " · " + n + (n === 1 ? " aula extra passou" : " aulas extra passaram") + " para ele" : "")); if (onDone) onDone(); updateStudioBadge(); });
    });
  });
}
// automático, para todos os alunos: as aulas dadas sem pacote contam no pacote que ainda tem aulas. Se o pacote caducou, não há outro mais novo
// e o aluno continuou a treinar, o pacote deixa de caducar (a folha trata-o como o mesmo contrato). Devolve {students, sessions, extended}.
function autoFixPacks(){
  var today = localTodayISO(), rep = {students: 0, sessions: 0, extended: 0, aligned: 0, reassigned: 0}, chain = alignRenewedPacks().then(function(n){ rep.aligned = n; return reassignSharedPackSessions(); }).then(function(n){ rep.reassigned = n; });
  visibleStudentsForDashboard().filter(isStudentActive).forEach(function(st){
    chain = chain.then(function(){
      if (!extrasOf(st.id, today).n) return;
      var own = studio.packs.filter(function(p){ return p.student_id === st.id; }).sort(function(a, b){ return a.starts_on < b.starts_on ? 1 : -1; });
      var steps = Promise.resolve(0), moved = 0;
      // 1.º os pacotes a decorrer; 2.º o mais recente que caducou com aulas por dar, se nenhum outro começou depois dele
      usablePacksOf(st.id).filter(function(p){ var u = packUsage(p, today); return u.active; }).forEach(function(p){
        steps = steps.then(function(){ return attachExtrasToPack(p).then(function(n){ moved += n; }); });
      });
      steps = steps.then(function(){
        if (!extrasOf(st.id, today).n) return;
        var latest = own[0];
        if (!latest || !packUsage(latest, today).expired || packUsage(latest, today).remaining <= 0) return;
        return extendPackAndAttach(latest).then(function(r){ if (!r.error){ rep.extended++; moved += r.n || 0; } });
      });
      return steps.then(function(){ if (moved){ rep.students++; rep.sessions += moved; } });
    });
  });
  return chain.then(function(){ return rep; });
}
var RENEW_PENDING_PREFIX = "renov:";
function renewMonthsPending(pack){ var m = pack && typeof pack.notes === "string" ? /^renov:(\d+)$/.exec(pack.notes) : null; return m ? parseInt(m[1], 10) : 0; }
// pacotes renovados «a contar»: quando a primeira aula entra no pacote, o início e a validade passam a contar dessa aula
function alignRenewedPacks(){
  var chain = Promise.resolve(0);
  studio.packs.filter(function(p){ return renewMonthsPending(p) > 0; }).forEach(function(p){
    chain = chain.then(function(n){
      var dates = studio.sessions.filter(function(x){ return x.pack_id === p.id && sessionConsumes(p, x); }).map(function(x){ return x.date; }).sort();
      if (!dates.length) return n;
      var first = dates[0], months = renewMonthsPending(p);
      return studioUpdate("packs", p.id, {starts_on: first, expires_on: addMonthsISO(first, months), notes: null}).then(function(r){ return n + (r.error ? 0 : 1); });
    });
  });
  return chain;
}
// renovar num toque: novo pacote igual ao anterior (aulas, preço, validade, partilha) a começar na primeira aula que ficou sem pacote (ou hoje) + cobrança por pagar;
// o contador volta a zero e as aulas extra já dadas passam para ele
function renewPack(pack){
  var today = localTodayISO(), ex = extrasOf(pack.student_id, today);
  var start = ex.since && ex.since >= pack.starts_on ? ex.since : today;
  var months = pack.expires_on && pack.starts_on ? Math.max(1, Math.round((new Date(pack.expires_on + "T00:00:00Z") - new Date(pack.starts_on + "T00:00:00Z")) / 86400000 / 30.4)) : 0;
  // a validade conta a partir da 1.ª aula do pacote novo: se já há aulas dadas, é a data delas; se não, fica «a contar» e acerta-se quando a primeira aula entrar
  var pending = !(ex.since && ex.since >= pack.starts_on) && months > 0;
  var row = {student_id: pack.student_id, name: pack.name, total: pack.total, price: pack.price, starts_on: start, expires_on: months && !pending ? addMonthsISO(start, months) : null,
    missed_consumes: pack.missed_consumes !== false, late_cancel_consumes: pack.late_cancel_consumes !== false};
  if (pending) row.notes = RENEW_PENDING_PREFIX + months;
  if (studio.slotsAvailable) row.used_before = 0;
  if (studio.sharedAvailable && sharedIdsOf(pack).length) row.shared_with = sharedIdsOf(pack);
  return studioInsert("packs", row).then(function(r){
    if (r.error) return {error: r.error};
    var np = r.data, price = Number(pack.price) || 0;
    var charge = price > 0 ? studioInsert("payments", {student_id: pack.student_id, pack_id: np.id, amount: price, due_on: today}) : Promise.resolve({});
    return Promise.all([charge, attachExtrasToPack(np)]).then(function(res){ return {pack: np, moved: res[1], chargeError: res[0] && res[0].error, price: price, chargeId: res[0] && res[0].data ? res[0].data.id : null}; });
  });
}
// um clique: tira a validade ao pacote e conta nele as aulas dadas depois de ele caducar (o aluno parou e voltou)
function extendPackAndAttach(pack){
  return studioUpdate("packs", pack.id, {expires_on: null}).then(function(r){
    if (r.error) return {error: r.error};
    return attachExtrasToPack(pack).then(function(n){ return {n: n}; });
  });
}
function openSharePackModal(pack, onDone){
  var cur = sharedIdsOf(pack), owner = findStudent(pack.student_id);
  var cands = studentsForSharing(pack.student_id);
  cur.forEach(function(id){ var st = findStudent(id); if (st && !cands.some(function(c){ return c.id === id; })) cands.push(st); });
  var sheet = openModal("<div class=\"mtitle\">Partilhar pacote</div><p class=\"muted-p\" style=\"margin-bottom:10px;\">«" + escapeHtml(pack.name) + "» de " + escapeHtml(owner ? owner.name : "—") + ". Quem estiver marcado pode gastar aulas deste pacote (casais que treinam sozinhos e juntos com um só pagamento): as sessões de todos descontam ao mesmo conjunto e acabam ao mesmo tempo.</p>" +
    "<div class=\"student-search\" style=\"margin-bottom:10px;\"><span aria-hidden=\"true\">🔎</span><input type=\"search\" id=\"shFilter\" placeholder=\"Procurar aluno…\" aria-label=\"Procurar aluno\" autocomplete=\"off\"></div>" +
    "<div id=\"shList\" style=\"max-height:42vh; overflow:auto; margin-bottom:10px;\">" + (cands.length ? cands.map(function(st){
      return "<label class=\"history-row\" data-sh-name=\"" + escapeHtml(exLibFold(st.name)) + "\" style=\"display:flex; justify-content:flex-start; gap:12px; align-items:center; min-height:44px; cursor:pointer;\"><input type=\"checkbox\" style=\"width:22px; height:22px; accent-color:var(--accent); flex:none;\" data-sh-id=\"" + escapeHtml(st.id) + "\"" + (cur.indexOf(st.id) >= 0 ? " checked" : "") + "> <span>" + escapeHtml(st.name) + "</span></label>";
    }).join("") : "<p class=\"muted-p\">Não há outros alunos ativos.</p>") + "</div><p class=\"muted-p\" id=\"shEmpty\" style=\"display:none; margin-bottom:10px;\">Nenhum aluno com esse nome.</p>" +
    "<div style=\"position:sticky; bottom:0; background:var(--surface); padding-top:8px;\">" +   // «Guardar» fica sempre à vista, mesmo com uma lista comprida
    "<label style=\"display:flex; gap:8px; align-items:flex-start; margin-bottom:10px;\"><input type=\"checkbox\" id=\"shBack\" checked> <span class=\"muted-p\">Dar também a cada um acesso ao seu próprio pacote (partilha nos dois sentidos), para ambos gastarem do conjunto todo.</span></label>" +
    "<p class=\"muted-p\" id=\"shErr\" style=\"color:var(--critical); display:none;\"></p>" +
    "<button type=\"button\" class=\"btn primary\" id=\"shGo\" style=\"width:100%;\">Guardar</button></div>");
  var filter = sheet.querySelector("#shFilter");
  filter.addEventListener("input", function(){
    var q = exLibFold(filter.value);
    var shown = 0;
    sheet.querySelectorAll("[data-sh-name]").forEach(function(row){ var ok = !q || row.getAttribute("data-sh-name").indexOf(q) >= 0; row.style.display = ok ? "flex" : "none"; if (ok) shown++; });
    sheet.querySelector("#shEmpty").style.display = shown ? "none" : "block";
  });
  sheet.querySelector("#shGo").addEventListener("click", function(){
    var ids = [].slice.call(sheet.querySelectorAll("[data-sh-id]")).filter(function(c){ return c.checked; }).map(function(c){ return c.getAttribute("data-sh-id"); });
    var btn = sheet.querySelector("#shGo"); btn.disabled = true;
    studioSetPackSharing(pack, ids, sheet.querySelector("#shBack").checked).then(function(r){
      if (r.error){ var e = sheet.querySelector("#shErr"); e.textContent = r.error; e.style.display = "block"; btn.disabled = false; return; }
      closeModal(); showToast(ids.length ? "✓ Pacote partilhado com " + ids.length + (ids.length === 1 ? " aluno" : " alunos") : "✓ Pacote deixou de ser partilhado"); if (onDone) onDone();
    });
  });
}
// botões que existem na ficha e na visão geral
function wireStudioCommon(el, redraw){
  el.querySelectorAll("[data-renew-pack]").forEach(function(b){ b.addEventListener("click", function(){
    var pk = studio.packs.filter(function(x){ return x.id === b.getAttribute("data-renew-pack"); })[0];
    if (!pk) return;
    if (!window.confirm("Renovar «" + pk.name + "» de " + nameOf(pk.student_id) + "? Cria um pacote igual, com " + pk.total + " aulas" + (Number(pk.price) > 0 ? " e uma cobrança de " + eur(pk.price) + " por pagar" : "") + ".")) return;
    b.disabled = true;
    renewPack(pk).then(function(r){
      if (r.error){ showToast("⚠ " + r.error); b.disabled = false; return; }
      if (b.hasAttribute("data-renew-paid") && r.chargeId){ redraw(); updateStudioBadge(); openPayModal(r.chargeId, function(){ redraw(); updateStudioBadge(); }); return; }   // «já pagou»: abre logo o registo do pagamento
      showToast("✓ Pacote renovado" + (r.moved ? " · " + r.moved + (r.moved === 1 ? " aula já dada contada" : " aulas já dadas contadas") : "") + (r.chargeError ? " · ⚠ a cobrança não foi guardada" : r.price > 0 ? " · marca «Pago» quando receberes" : ""));
      redraw(); updateStudioBadge();
    });
  }); });
  el.querySelectorAll("[data-edit-pack]").forEach(function(b){ b.addEventListener("click", function(){
    var pk = studio.packs.filter(function(x){ return x.id === b.getAttribute("data-edit-pack"); })[0];
    if (pk) openEditPackModal(pk, redraw);
  }); });
  el.querySelectorAll("[data-extend-pack]").forEach(function(b){ b.addEventListener("click", function(){
    var pk = studio.packs.filter(function(x){ return x.id === b.getAttribute("data-extend-pack"); })[0];
    if (!pk) return;
    b.disabled = true;
    extendPackAndAttach(pk).then(function(r){ showToast(r.error ? "⚠ " + r.error : "✓ Pacote sem validade" + (r.n ? " · " + r.n + (r.n === 1 ? " aula contada" : " aulas contadas") : "")); redraw(); updateStudioBadge(); });
  }); });
  el.querySelectorAll("[data-share-pack]").forEach(function(b){ b.addEventListener("click", function(){
    var pk = studio.packs.filter(function(x){ return x.id === b.getAttribute("data-share-pack"); })[0];
    if (pk) openSharePackModal(pk, redraw);
  }); });
  el.querySelectorAll("[data-del-pack]").forEach(function(b){ b.addEventListener("click", function(){
    if (!window.confirm("Apagar este pacote? As sessões e cobranças registadas ficam, mas sem pacote.")) return;
    studioDelete("packs", b.getAttribute("data-del-pack")).then(function(r){ if (r.error) showToast("⚠ " + r.error); redraw(); });
  }); });
  el.querySelectorAll("[data-del-slot]").forEach(function(b){ b.addEventListener("click", function(){
    if (!window.confirm("Remover este horário? As sessões já contadas ficam.")) return;
    studioDelete("slots", b.getAttribute("data-del-slot")).then(function(r){ if (r.error) showToast("⚠ " + r.error); redraw(); });
  }); });
  el.querySelectorAll("[data-del-session]").forEach(function(b){ b.addEventListener("click", function(){
    studioDelete("sessions", b.getAttribute("data-del-session")).then(function(r){ if (r.error) showToast("⚠ " + r.error); redraw(); });
  }); });
  el.querySelectorAll("[data-del-payment]").forEach(function(b){ b.addEventListener("click", function(){
    if (!window.confirm("Apagar esta cobrança?")) return;
    studioDelete("payments", b.getAttribute("data-del-payment")).then(function(r){ if (r.error) showToast("⚠ " + r.error); redraw(); });
  }); });
  el.querySelectorAll("[data-pay]").forEach(function(b){ b.addEventListener("click", function(){ openPayModal(b.getAttribute("data-pay"), redraw); }); });
  el.querySelectorAll("[data-open-student]").forEach(function(b){ b.addEventListener("click", function(){
    state.proSelectedId = b.getAttribute("data-open-student"); state.proTab = "sessoes"; renderProShell(); try { window.scrollTo(0, 0); } catch (e) {}
  }); });
  el.querySelectorAll("[data-remind]").forEach(function(b){ b.addEventListener("click", function(){
    var p = studio.payments.filter(function(x){ return x.id === b.getAttribute("data-remind"); })[0], st = p && findStudent(p.student_id);
    if (st) openContactModal(st, "pagamento-atrasado", redraw);
  }); });
}

/* ---------- Contratos (área só do Tiago): lista, totais, ficha do contrato, financeiro e «Eu» ---------- */
var CONTRACT_MODALIDADES = {mensal: {label: "Mensal", months: 1}, trimestral: {label: "Trimestral", months: 3}, anual: {label: "Anual", months: 12}};
var contractMeta = {map: {}, loaded: false, available: true};
var CONTRACTS_LOCAL_KEY = "evolve.contractMeta";
function contractMetaClean(v){
  var out = {};
  if (v && typeof v === "object") Object.keys(v).forEach(function(k){
    var m = v[k]; if (!m || typeof m !== "object") return;
    var o = {};
    if (m.formato === "duo" || m.formato === "individual") o.formato = m.formato;
    if (CONTRACT_MODALIDADES[m.modalidade]) o.modalidade = m.modalidade;
    var mi = Number(m.minutos); if (mi >= 15 && mi <= 180) o.minutos = Math.round(mi);
    if (m.estado === "ativo" || m.estado === "suspenso" || m.estado === "cancelado") o.estado = m.estado;
    out[k] = o;
  });
  return out;
}
function loadContractMeta(){
  var fromRows = function(rows){
    contractMeta.map = contractMetaClean(rows && rows.contracts);
    contractMeta.loaded = true; return true;
  };
  if (!sbReady){ try { var l = JSON.parse(localStorage.getItem(CONTRACTS_LOCAL_KEY) || "null") || {}; return Promise.resolve(fromRows({contracts: l.map})); } catch (e) { return Promise.resolve(fromRows(null)); } }
  return Promise.resolve(sb.from("studio_settings").select("value").eq("key", "contracts").maybeSingle().then(function(r){ return r; })).then(function(r){
    if (r && r.error){ contractMeta.available = false; contractMeta.loaded = true; return false; }
    contractMeta.available = true;
    return fromRows({contracts: r && r.data ? r.data.value : null});
  }, function(){ contractMeta.available = false; contractMeta.loaded = true; return false; });
}
function saveContractMeta(){
  if (!sbReady){ try { localStorage.setItem(CONTRACTS_LOCAL_KEY, JSON.stringify({map: contractMeta.map})); } catch (e) {} return Promise.resolve({}); }
  var row = {key: "contracts", value: contractMetaClean(contractMeta.map), updated_at: new Date().toISOString()};
  return Promise.resolve(sb.from("studio_settings").upsert(row).then(function(r){ return r; })).then(function(res){
    return res && res.error ? {error: "Não foi possível guardar (a migração 0025 já foi corrida?)."} : {};
  }, function(){ return {error: "Não foi possível guardar — verifica a ligação."}; });
}
function contractMetaOf(id){
  var m = contractMeta.map[id] || {};
  return {formato: m.formato || "individual", modalidade: m.modalidade || "trimestral", minutos: m.minutos || 60, estado: m.estado || null};
}
function contractEstadoOf(st){ var m = contractMeta.map[st.id]; return (m && m.estado) || (isStudentActive(st) ? "ativo" : "cancelado"); }
var CONTRACT_ESTADO_LABEL = {ativo: "Ativo", suspenso: "Suspenso", cancelado: "Cancelado"};
function ordinalPt(n){ return n + ".º"; }
// um contrato por aluno; um duo (os dois marcados como duo e parceiros) conta uma vez
function contractUnits(today){
  today = today || localTodayISO();
  var studs = visibleStudentsForDashboard().filter(function(s){ return packsOf(s.id).length || contractMeta.map[s.id]; });
  var done = {}, units = [];
  studs.forEach(function(s){
    if (done[s.id]) return;
    var members = [s];
    if (contractMetaOf(s.id).formato === "duo"){
      partnersOf(s.id).forEach(function(pid){ var o = findStudent(pid); if (o && !done[pid] && contractMetaOf(pid).formato === "duo" && members.indexOf(o) < 0) members.push(o); });
    }
    members.forEach(function(m){ done[m.id] = true; });
    var ids = members.map(function(m){ return m.id; }), meta = contractMetaOf(s.id);
    var own = studio.packs.filter(function(p){ return ids.indexOf(p.student_id) >= 0; }).sort(function(a, b){ return a.starts_on < b.starts_on ? -1 : a.starts_on > b.starts_on ? 1 : 0; });
    var cur = own.length ? (function(){ var act = own.filter(function(p){ return packUsage(p, today).active; }); return act.length ? act[act.length - 1] : own[own.length - 1]; })() : null;
    var u = cur ? packUsage(cur, today) : null;
    var hours = ids.reduce(function(a, id){ return a + (hoursOf(id) || 0); }, 0);
    var price = cur && cur.price != null ? Number(cur.price) : null, total = cur ? Number(cur.total) || 0 : 0;
    var perSession = price != null && total ? price / total : null;
    var perMonthSessions = hours ? hours / (meta.minutos / 60) : 0;
    var weekly = perMonthSessions ? Math.max(1, Math.round(perMonthSessions / 4.33)) : members.reduce(function(a, m){ return a + weeklySlotsOf(m.id); }, 0);
    var k = cur ? own.indexOf(cur) + 1 : 0;
    var paidPacks = own.filter(function(p){ return studio.payments.some(function(y){ return y.pack_id === p.id && y.paid_on; }); }).length;
    var curPays = cur ? studio.payments.filter(function(y){ return y.pack_id === cur.id; }) : [];
    var unpaid = cur && curPays.length && !curPays.some(function(y){ return y.paid_on; });
    var packLabel = !cur ? "sem pacote" : unpaid ? ordinalPt(k) + " pack por pagar" : paidPacks > 1 ? ordinalPt(k) + " de " + paidPacks + " packs pagos" : ordinalPt(k) + " pack";
    units.push({key: ids.slice().sort().join("+"), members: members, ids: ids, name: members.map(function(m){ return m.name; }).join(" + "), meta: meta, estado: contractEstadoOf(s),
      cur: cur, u: u, packs: own, price: price, total: total, perSession: perSession, hours: hours, perMonthSessions: perMonthSessions,
      perMonth: perSession != null ? perSession * perMonthSessions : null, weekly: weekly, packLabel: packLabel, duo: members.length > 1});
  });
  return units;
}
function contractTotals(units){
  var act = units.filter(function(x){ return x.estado === "ativo"; });
  return {n: act.length, hours: act.reduce(function(a, x){ return a + x.hours; }, 0), revenue: act.reduce(function(a, x){ return a + (x.perMonth || 0); }, 0)};
}
function contractPlanLabel(x){
  return (x.weekly ? x.weekly + "×" : "") + x.meta.minutos + " · " + CONTRACT_MODALIDADES[x.meta.modalidade].label;
}
var contractsView = {tab: "contratos", filter: "todos", search: "", sort: "nome", open: null};
function renderProContractsMain(){
  var main = document.getElementById("proMain");
  if (!studio.loaded || !contractMeta.loaded){ main.innerHTML = "<p class=\"muted-p\">A carregar…</p>"; Promise.all([studioRefresh(), loadContractMeta()]).then(function(){ if (state.proView === "contracts" && !state.proSelectedId) renderProContractsMain(); }); return; }
  if (!studio.available){ main.innerHTML = studioUnavailableHtml(); return; }
  var today = localTodayISO();
  var html = "<div class=\"checkin-tabs\" style=\"display:flex; gap:8px; margin-bottom:12px;\">" + [["contratos", "Contratos"], ["financeiro", "Financeiro"]].map(function(t){
    return "<button type=\"button\" class=\"btn btn-sm" + (contractsView.tab === t[0] ? " primary" : "") + "\" data-ct-tab=\"" + t[0] + "\" style=\"flex:1; min-height:44px;\">" + t[1] + "</button>"; }).join("") + "</div>";
  if (contractsView.tab === "financeiro") html += contractsFinanceHtml(today);
  else if (contractsView.open) html += contractDetailHtml(contractsView.open, today);
  else html += contractsListHtml(today);
  main.innerHTML = html;
  wireContractsMain(main);
  if (contractsView.tab === "contratos" && !contractsView.open) applyContractsFilter();
}
function contractsListHtml(today){
  var units = contractUnits(today), t = contractTotals(units);
  var html = "<div class=\"pro-stat-row\" id=\"contractTotals\">" + proStat(t.hours ? fmtHours(t.hours) : "—", "Horas totais contratadas por mês") + proStat(t.n, "Contratos ativos · um duo conta uma vez") + proStat(t.revenue ? eur(t.revenue) : "—", "Receita recorrente por mês") + "</div>";
  var count = function(f){ return f === "todos" ? units.length : units.filter(function(x){ return x.estado === f; }).length; };
  html += "<div style=\"display:flex; gap:8px; flex-wrap:wrap; margin:10px 0;\">" + [["todos", "Todos"], ["ativo", "Ativo"], ["suspenso", "Suspenso"], ["cancelado", "Cancelado"]].map(function(f){
    return "<button type=\"button\" class=\"btn btn-sm" + (contractsView.filter === f[0] ? " primary" : "") + "\" data-ct-filter=\"" + f[0] + "\" style=\"min-height:44px;\">" + f[1] + " · " + count(f[0]) + "</button>"; }).join("") + "</div>";
  html += "<div class=\"student-tools\" id=\"contractTools\"><label class=\"student-search\"><span aria-hidden=\"true\">🔍</span><input type=\"search\" id=\"ctSearch\" placeholder=\"Procurar contrato…\" autocomplete=\"off\" autocapitalize=\"off\" aria-label=\"Procurar contrato\" value=\"" + escapeHtml(contractsView.search || "") + "\"></label>" +
    "<select id=\"ctSort\" class=\"mini-select\" aria-label=\"Ordenar contratos\">" + [["nome", "Nome A → Z"], ["nomeza", "Nome Z → A"], ["valor", "Maior valor"], ["restam", "Menos aulas por dar"], ["horas", "Mais horas"]].map(function(o){ return "<option value=\"" + o[0] + "\"" + (contractsView.sort === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></div>";
  html += "<div id=\"contractList\">";
  var rows = units.filter(function(x){ return contractsView.filter === "todos" || x.estado === contractsView.filter; });
  rows.forEach(function(x, i){
    var pct = x.u ? x.u.pct : 0;
    html += "<div class=\"card contract-row\" data-cname=\"" + escapeHtml(exLibFold(x.name)) + "\" data-val=\"" + (x.perMonth || 0) + "\" data-rem=\"" + (x.u ? x.u.remaining : 999) + "\" data-hrs=\"" + x.hours + "\" data-ord=\"" + i + "\" style=\"margin-bottom:10px; cursor:pointer;\" data-open-contract=\"" + escapeHtml(x.key) + "\">" +
      "<div style=\"display:flex; justify-content:space-between; gap:8px; align-items:flex-start;\"><div style=\"min-width:0;\"><div class=\"hlabel\" style=\"font-weight:700;\">" + escapeHtml(x.name) + "</div>" +
      "<div class=\"muted-p\" style=\"font-size:0.76rem;\">" + (x.duo ? "Duo" : "Individual") + " · " + escapeHtml(contractPlanLabel(x)) + (x.hours ? " · <span class=\"pill warn\">" + escapeHtml(fmtHours(x.hours)) + "</span>" : "") + "</div></div>" +
      "<div style=\"text-align:right; white-space:nowrap;\"><div class=\"hlabel\">" + (x.price != null ? escapeHtml(eurShort(x.price)) : "—") + "</div><span class=\"pill " + (x.estado === "ativo" ? "good" : x.estado === "suspenso" ? "warn" : "critical") + "\">" + CONTRACT_ESTADO_LABEL[x.estado] + "</span></div></div>" +
      (x.u ? "<div class=\"bar-track\" style=\"margin:8px 0 4px;\"><div class=\"bar-fill\" style=\"width:" + pct + "%\"></div></div><div class=\"muted-p\" style=\"font-size:0.78rem;\"><strong>" + x.u.used + " de " + x.u.total + "</strong> · " + escapeHtml(x.packLabel) + "</div>" : "<div class=\"muted-p\" style=\"font-size:0.78rem;\">" + escapeHtml(x.packLabel) + "</div>") + "</div>";
  });
  if (!rows.length) html += "<p class=\"muted-p\">Sem contratos neste estado.</p>";
  html += "</div><p class=\"muted-p\" id=\"ctInfo\" style=\"font-size:0.78rem;\">" + rows.length + " de " + units.length + "</p>";
  html += "<details class=\"perfil-section\" id=\"contractImport\" style=\"margin:14px 0;\"><summary class=\"eyebrow\">Importar formato, modalidade e estado dos contratos</summary>" +
    "<p class=\"muted-p\" style=\"margin:8px 0;\">Cola uma linha por contrato: <strong>Nome; modalidade; formato; estado</strong> (ex.: PT 60 - Ana Silva; Trimestral; Individual; Ativo). O «PT 45» ou «PT 60» do nome dá os minutos; em duos usa «A + B». Estado: Ativo, Suspenso ou Cancelado.</p>" +
    "<textarea id=\"ctImpText\" rows=\"5\" placeholder=\"PT 60 - Ana Silva; Trimestral; Individual; Ativo\"></textarea><p class=\"muted-p\" id=\"ctImpOut\" style=\"margin-top:6px;\"></p>" +
    "<button type=\"button\" class=\"btn primary btn-sm\" id=\"ctImpGo\" style=\"margin-top:8px;\">Importar</button></details>";
  return html;
}
function applyContractsFilter(){
  var list = document.getElementById("contractList");
  if (!list) return;
  var q = exLibFold(contractsView.search || ""), rows = [].slice.call(list.querySelectorAll("[data-cname]")), shown = 0;
  rows.forEach(function(r){ var ok = !q || nameStartsWithQuery(r.getAttribute("data-cname"), q); r.hidden = !ok; if (ok) shown++; });
  var sort = contractsView.sort, key = function(r){ return r.getAttribute("data-cname"); }, num = function(r, a){ return Number(r.getAttribute(a)); };
  rows.sort(function(a, b){
    if (sort === "nomeza") return key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : 0;
    if (sort === "valor") return num(b, "data-val") - num(a, "data-val") || (key(a) < key(b) ? -1 : 1);
    if (sort === "restam") return num(a, "data-rem") - num(b, "data-rem") || (key(a) < key(b) ? -1 : 1);
    if (sort === "horas") return num(b, "data-hrs") - num(a, "data-hrs") || (key(a) < key(b) ? -1 : 1);
    return key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0;
  });
  rows.forEach(function(r){ list.appendChild(r); });
  var info = document.getElementById("ctInfo"); if (info) info.textContent = shown + " de " + rows.length + (q ? " com «" + contractsView.search.trim() + "»" : "");
}
document.addEventListener("input", function(e){ var t = e.target; if (t && t.id === "ctSearch"){ contractsView.search = t.value; applyContractsFilter(); } });
document.addEventListener("keyup", function(e){ var t = e.target; if (t && t.id === "ctSearch" && t.value !== (contractsView.search || "")){ contractsView.search = t.value; applyContractsFilter(); } });
document.addEventListener("search", function(e){ var t = e.target; if (t && t.id === "ctSearch"){ contractsView.search = t.value; applyContractsFilter(); } });
document.addEventListener("change", function(e){ var t = e.target; if (t && t.id === "ctSort"){ contractsView.sort = t.value; applyContractsFilter(); } });

function contractDetailHtml(key, today){
  var x = contractUnits(today).filter(function(u){ return u.key === key; })[0];
  if (!x) return "<p class=\"muted-p\">Contrato não encontrado.</p><button type=\"button\" class=\"btn btn-sm\" id=\"ctBack\">← Voltar aos contratos</button>";
  var since = x.packs.length ? x.packs[0].starts_on : null;
  var html = "<button type=\"button\" class=\"btn btn-sm\" id=\"ctBack\" style=\"margin-bottom:10px; min-height:44px;\">← Voltar aos contratos</button>" +
    "<h2 style=\"margin:0 0 4px;\">PT " + x.meta.minutos + " - " + escapeHtml(x.name) + "</h2>" +
    "<p class=\"muted-p\" style=\"margin-bottom:10px;\"><span class=\"pill " + (x.estado === "ativo" ? "good" : x.estado === "suspenso" ? "warn" : "critical") + "\">" + CONTRACT_ESTADO_LABEL[x.estado] + "</span>" + (since ? " desde " + escapeHtml(fmtDateFullPt(since)) : "") + "</p>";
  html += "<div class=\"card\"><div class=\"eyebrow\" style=\"margin-bottom:8px;\">Termos</div><div class=\"assess-form-grid\">" +
    "<div class=\"f\"><div class=\"muted-p\">Formato</div><div class=\"hlabel\">" + (x.duo ? "Duo" : "Individual") + "</div></div>" +
    "<div class=\"f\"><div class=\"muted-p\">Modalidade</div><div class=\"hlabel\">" + escapeHtml(CONTRACT_MODALIDADES[x.meta.modalidade].label) + "</div></div>" +
    "<div class=\"f\"><div class=\"muted-p\">Plano</div><div class=\"hlabel\">" + (x.weekly ? x.weekly + "× por semana" : "—") + " · " + x.meta.minutos + " min</div></div>" +
    "<div class=\"f\"><div class=\"muted-p\">Horas por mês</div><div class=\"hlabel\">" + (x.hours ? escapeHtml(fmtHours(x.hours)) : "—") + "</div></div>" +
    "<div class=\"f\"><div class=\"muted-p\">Valor do ciclo</div><div class=\"hlabel\">" + (x.price != null ? escapeHtml(eur(x.price)) : "—") + "</div></div>" +
    "<div class=\"f\"><div class=\"muted-p\">Valor por mês</div><div class=\"hlabel\">" + (x.perMonth != null ? escapeHtml(eur(x.perMonth)) : "—") + (x.perSession != null ? " <span class=\"muted-p\" style=\"font-size:0.72rem;\">" + escapeHtml(eur(x.perSession)) + "/sessão</span>" : "") + "</div></div></div>" +
    (x.u ? "<p class=\"muted-p\" style=\"margin-top:10px;\">Sessões: <strong>" + escapeHtml(x.packLabel) + "</strong> · " + x.u.used + " de " + x.u.total + " gastas" + "</p>" : "") +
    "<div style=\"display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;\"><button type=\"button\" class=\"btn btn-sm\" id=\"ctEdit\" style=\"min-height:44px;\">Editar condições</button>" +
    (x.cur ? "<button type=\"button\" class=\"btn btn-sm primary\" data-renew-pack=\"" + escapeHtml(x.cur.id) + "\" style=\"min-height:44px;\">Renovar</button>" : "") + "</div></div>";
  html += "<div class=\"card\"><div class=\"eyebrow\" style=\"margin-bottom:8px;\">Participantes</div>" + x.members.map(function(m){
    return "<div class=\"history-row\" style=\"align-items:center;\"><div><button type=\"button\" class=\"wl-info\" data-open-student=\"" + escapeHtml(m.id) + "\">" + escapeHtml(m.name) + "</button> <span class=\"muted-p\">" + (isStudentActive(m) ? "ativo" : "inativo") + "</span></div></div>"; }).join("") +
    "<p class=\"muted-p\" style=\"margin-top:8px;\">" + (x.duo ? "Contrato duo: treinam os dois ao mesmo tempo e conta uma vez nos totais." : "Contrato individual. Para duplas que treinam juntas, «Editar condições» → formato duo (nos dois alunos). Para duas pessoas a gastar o mesmo pack em sessões individuais, usa «Partilhar» no pacote.") + "</p></div>";
  var ids = x.ids, nums = sessionNumberMap();
  var sess = studio.sessions.filter(function(s){ return ids.indexOf(s.student_id) >= 0; }).sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || "") < (b.time || "") ? -1 : 1; });
  var next = sess.filter(function(s){ return s.status === "agendada" && s.date >= today; }).slice(0, 6), last = sess.filter(function(s){ return !(s.status === "agendada" && s.date >= today); }).slice(-6).reverse();
  var srow = function(s){ return "<div style=\"padding:3px 0;\">" + escapeHtml(s.date.slice(8) + "/" + s.date.slice(5, 7)) + (s.time ? " · " + escapeHtml(s.time) : "") + (x.duo ? " · " + escapeHtml(nameOf(s.student_id)) : "") + " " + sessionNumberPill(nums[s.id]) + " <span class=\"muted-p\">" + escapeHtml(((SESSION_STATUS[s.status] || {}).label || s.status)) + "</span></div>"; };
  html += "<div class=\"card\"><div class=\"eyebrow\" style=\"margin-bottom:8px;\">Treinos</div><div style=\"display:grid; grid-template-columns:1fr 1fr; gap:12px;\"><div><div class=\"muted-p\" style=\"margin-bottom:4px;\">Próximos</div>" + (next.length ? next.map(srow).join("") : "<span class=\"muted-p\">—</span>") + "</div><div><div class=\"muted-p\" style=\"margin-bottom:4px;\">Últimos</div>" + (last.length ? last.map(srow).join("") : "<span class=\"muted-p\">—</span>") + "</div></div></div>";
  var pays = studio.payments.filter(function(p){ return ids.indexOf(p.student_id) >= 0; }).sort(function(a, b){ return a.due_on < b.due_on ? 1 : -1; });
  html += "<div class=\"card\"><div class=\"eyebrow\" style=\"margin-bottom:8px;\">Recebimentos</div>" + (pays.length ? pays.map(function(p){ return contractPaymentRowHtml(p, today); }).join("") : "<p class=\"muted-p\">Sem recebimentos.</p>") + "</div>";
  html += "<details class=\"perfil-section\" style=\"margin:10px 0;\"><summary class=\"eyebrow\">Arquivo de packs · " + x.packs.length + "</summary>" + (x.packs.length ? x.packs.slice().reverse().map(function(p){ return packBarHtml(p, packUsage(p, today), x.ids[0]); }).join("") : "<p class=\"muted-p\">Sem packs.</p>") + "</details>";
  return html;
}
function contractPaymentRowHtml(p, today){
  var st = paymentStatus(p, today), tone = {pago: "good", atrasado: "critical", "a vencer": "warn", futuro: ""}[st];
  var pk = studio.packs.filter(function(q){ return q.id === p.pack_id; })[0];
  return "<div class=\"history-row\" style=\"align-items:center;\"><div style=\"min-width:0;flex:1;\"><div class=\"hlabel\">" + escapeHtml(fmtDateFullPt(p.due_on)) + " · " + escapeHtml(pk ? pk.name : "Cobrança") + " · " + escapeHtml(nameOf(p.student_id)) + "</div>" +
    "<div class=\"muted-p\" style=\"font-size:0.76rem;\">" + (p.paid_on ? "pago a " + escapeHtml(fmtDateFullPt(p.paid_on)) + (p.method ? " (" + escapeHtml(PAYMENT_METHODS[p.method] || p.method) + ")" : "") : "por pagar") + "</div></div>" +
    "<span style=\"white-space:nowrap;\"><span class=\"hlabel\">" + escapeHtml(eur(p.amount)) + "</span> <span class=\"pill " + tone + "\">" + st + "</span> " +
    (p.paid_on ? "<button type=\"button\" class=\"btn btn-sm\" data-unpay=\"" + escapeHtml(p.id) + "\">Desmarcar</button>" : "<button type=\"button\" class=\"btn btn-sm primary\" data-pay=\"" + escapeHtml(p.id) + "\">Pago</button>") + "</span></div>";
}
function contractsFinanceHtml(today){
  if (!studioView.month) studioView.month = monthOf(today);
  var month = studioView.month, k = studioKpis(month, today);
  var inMonth = studio.payments.filter(function(p){ return monthOf(p.due_on) === month || (p.paid_on && monthOf(p.paid_on) === month); }).sort(function(a, b){ return a.due_on < b.due_on ? -1 : 1; });
  var html = "<div class=\"checkin-field\" style=\"max-width:200px;\"><label for=\"ctMonth\">Mês</label><input type=\"month\" id=\"ctMonth\" value=\"" + escapeHtml(month) + "\"></div>" +
    "<div class=\"pro-stat-row\" style=\"margin-top:10px;\">" + proStat(eurShort(k.received), "Recebido no mês (" + k.receivedN + ")") + proStat(eurShort(k.toCollect), "A receber no mês (" + k.toCollectN + ")") + proStat(eurShort(k.overdue), k.overdueN ? "Em atraso (" + k.overdueN + ")" : "Em atraso") + "</div>" +
    "<div class=\"card\" style=\"margin-top:10px;\"><div class=\"eyebrow\" style=\"margin-bottom:8px;\">Recebimentos do mês</div>" + (inMonth.length ? inMonth.map(function(p){ return contractPaymentRowHtml(p, today); }).join("") : "<p class=\"muted-p\">Sem recebimentos neste mês.</p>") + "</div>" +
    "<div style=\"display:flex; gap:8px; flex-wrap:wrap;\"><button type=\"button\" class=\"btn btn-sm\" id=\"ctCsv\">⬇ Recebimentos (CSV)</button></div>";
  return html;
}
function wireContractsMain(main){
  var redraw = function(){ renderProContractsMain(); };
  main.querySelectorAll("[data-ct-tab]").forEach(function(b){ b.addEventListener("click", function(){ contractsView.tab = b.getAttribute("data-ct-tab"); contractsView.open = null; redraw(); }); });
  main.querySelectorAll("[data-ct-filter]").forEach(function(b){ b.addEventListener("click", function(){ contractsView.filter = b.getAttribute("data-ct-filter"); redraw(); }); });
  main.querySelectorAll("[data-open-contract]").forEach(function(c){ c.addEventListener("click", function(){ contractsView.open = c.getAttribute("data-open-contract"); redraw(); try { window.scrollTo(0, 0); } catch (e) {} }); });
  var back = main.querySelector("#ctBack"); if (back) back.addEventListener("click", function(){ contractsView.open = null; redraw(); });
  var edit = main.querySelector("#ctEdit"); if (edit) edit.addEventListener("click", function(){ var x = contractUnits().filter(function(u){ return u.key === contractsView.open; })[0]; if (x) openContractEditModal(x, redraw); });
  main.querySelectorAll("[data-unpay]").forEach(function(b){ b.addEventListener("click", function(){ b.disabled = true; studioUpdate("payments", b.getAttribute("data-unpay"), {paid_on: null, method: null}).then(function(r){ if (r.error) showToast("⚠ " + r.error); redraw(); updateStudioBadge(); }); }); });
  var mon = main.querySelector("#ctMonth"); if (mon) mon.addEventListener("change", function(){ if (/^\d{4}-\d{2}$/.test(mon.value)){ studioView.month = mon.value; redraw(); } });
  var csv = main.querySelector("#ctCsv"); if (csv) csv.addEventListener("click", function(){ downloadText("recebimentos-" + studioView.month + ".csv", paymentsCsv(studioView.month)); });
  main.querySelectorAll("[data-open-student]").forEach(function(btn){ btn.addEventListener("click", function(e){ e.stopPropagation(); state.proSelectedId = btn.getAttribute("data-open-student"); state.proTab = "leitura"; renderProShell(); try { window.scrollTo(0, 0); } catch (err) {} }); });
  wireStudioCommon(main, redraw);   // Pago, Renovar, Editar/Partilhar/Apagar pacote
  var imp = main.querySelector("#ctImpGo");
  if (imp) imp.addEventListener("click", function(){
    var out = main.querySelector("#ctImpOut"); imp.disabled = true; out.textContent = "A importar…";
    studioImportContracts(main.querySelector("#ctImpText").value).then(function(rep){
      var msg = "✓ " + rep.saved + (rep.saved === 1 ? " contrato atualizado" : " contratos atualizados");
      if (rep.errors.length) msg += " · ⚠ " + rep.errors.slice(0, 6).join(" ") + (rep.errors.length > 6 ? " (+" + (rep.errors.length - 6) + ")" : "");
      out.textContent = msg; imp.disabled = false; if (rep.saved) redraw();
    });
  });
}
function openContractEditModal(x, onDone){
  var m = x.meta, hrs = x.hours ? String(Math.round(x.hours * 100) / 100).replace(".", ",") : "";
  var opt = function(map, cur){ return Object.keys(map).map(function(k){ return "<option value=\"" + k + "\"" + (cur === k ? " selected" : "") + ">" + escapeHtml(map[k].label || map[k]) + "</option>"; }).join(""); };
  var sheet = openModal("<div class=\"mtitle\">Editar condições</div><p class=\"muted-p\" style=\"margin-bottom:10px;\">" + escapeHtml(x.name) + "</p>" +
    "<div class=\"checkin-field\"><label for=\"ceFormato\">Formato</label><select id=\"ceFormato\" class=\"mini-select\" style=\"width:100%;\"><option value=\"individual\"" + (x.duo ? "" : " selected") + ">Individual</option><option value=\"duo\"" + (m.formato === "duo" ? " selected" : "") + ">Duo (treinam juntos)</option></select></div>" +
    "<div class=\"checkin-field\"><label for=\"ceMod\">Modalidade</label><select id=\"ceMod\" class=\"mini-select\" style=\"width:100%;\">" + opt(CONTRACT_MODALIDADES, m.modalidade) + "</select></div>" +
    "<div class=\"checkin-field\"><label for=\"ceMin\">Minutos por sessão</label><input type=\"number\" id=\"ceMin\" min=\"15\" max=\"180\" inputmode=\"numeric\" value=\"" + m.minutos + "\"></div>" +
    "<div class=\"checkin-field\"><label for=\"ceHrs\">Horas por mês (do contrato inteiro)</label><input type=\"text\" id=\"ceHrs\" inputmode=\"decimal\" value=\"" + escapeHtml(hrs) + "\" placeholder=\"ex.: 8,66\"></div>" +
    "<div class=\"checkin-field\"><label for=\"ceEstado\">Estado</label><select id=\"ceEstado\" class=\"mini-select\" style=\"width:100%;\">" + Object.keys(CONTRACT_ESTADO_LABEL).map(function(k){ return "<option value=\"" + k + "\"" + (x.estado === k ? " selected" : "") + ">" + CONTRACT_ESTADO_LABEL[k] + "</option>"; }).join("") + "</select></div>" +
    "<p class=\"muted-p\" id=\"ceErr\" style=\"color:var(--critical); display:none;\"></p><button type=\"button\" class=\"btn primary\" id=\"ceGo\" style=\"width:100%; margin-top:10px;\">Guardar</button>");
  sheet.querySelector("#ceGo").addEventListener("click", function(){
    var err = sheet.querySelector("#ceErr"), fail = function(t){ err.textContent = t; err.style.display = "block"; };
    var min = parseInt(sheet.querySelector("#ceMin").value, 10), hraw = sheet.querySelector("#ceHrs").value.trim(), h = hraw ? parseImportNumber(hraw) : 0;
    if (!(min >= 15 && min <= 180)) return fail("Os minutos por sessão têm de estar entre 15 e 180.");
    if (h == null || h < 0 || h > 400) return fail("Horas por mês inválidas (ex.: 8,66).");
    var patch = {formato: sheet.querySelector("#ceFormato").value, modalidade: sheet.querySelector("#ceMod").value, minutos: min, estado: sheet.querySelector("#ceEstado").value};
    var prevMap = JSON.parse(JSON.stringify(contractMeta.map)), prevHours = JSON.parse(JSON.stringify(monthlyHours.map));
    x.ids.forEach(function(id){ contractMeta.map[id] = Object.assign({}, contractMeta.map[id] || {}, patch); });
    // as horas são do contrato: repartem-se pelos participantes (um duo conta uma vez)
    if (h > 0) x.ids.forEach(function(id){ monthlyHours.map[id] = Math.round(h / x.ids.length * 100) / 100; });
    else x.ids.forEach(function(id){ delete monthlyHours.map[id]; });
    var btn = sheet.querySelector("#ceGo"); btn.disabled = true;
    Promise.all([saveContractMeta("contracts"), saveMonthlyHours()]).then(function(rs){
      var e = rs[0].error || rs[1].error;
      if (e){ contractMeta.map = prevMap; monthlyHours.map = prevHours; btn.disabled = false; return fail(e); }
      closeModal(); showToast("✓ Contrato atualizado");
      if (patch.formato === "duo") contractsView.open = null;   // a chave do contrato muda quando se junta/separa um duo
      if (onDone) onDone();
    });
  });
}
// «Nome; modalidade; formato; estado» — o «PT 45/60» do nome dá os minutos; duos «A + B»
function parseContractsImport(text){
  var rows = [], errors = [];
  String(text || "").split(/\r?\n/).forEach(function(line, i){
    if (!line.trim()) return;
    var cols = line.split(/\t|;/).map(function(c){ return c.trim(); });
    if (/^(nome|cliente|aluno)\b/i.test(cols[0]) && !CONTRACT_MODALIDADES[exLibFold(cols[1] || "")]) return;
    var pm = /^PT(?:\s+Duo)?\s+(\d{2,3})\b/i.exec(cols[0]), minutos = pm ? parseInt(pm[1], 10) : null;
    var name = cols[0].replace(/^PT(?:\s+[\w.]+)*?\s*[-–]\s*/i, "").trim();
    var mod = exLibFold(cols[1] || ""), fmt = exLibFold(cols[2] || ""), est = exLibFold(cols[3] || "");
    if (!name) errors.push("Linha " + (i + 1) + ": falta o nome.");
    else if (cols[1] && !CONTRACT_MODALIDADES[mod]) errors.push("Linha " + (i + 1) + " (" + name + "): modalidade inválida (Mensal, Trimestral ou Anual).");
    else if (cols[2] && fmt !== "individual" && fmt !== "duo") errors.push("Linha " + (i + 1) + " (" + name + "): formato inválido (Individual ou Duo).");
    else if (cols[3] && ["ativo", "suspenso", "cancelado"].indexOf(est) < 0) errors.push("Linha " + (i + 1) + " (" + name + "): estado inválido (Ativo, Suspenso ou Cancelado).");
    else rows.push({name: name, modalidade: cols[1] ? mod : null, formato: cols[2] ? fmt : (/\+/.test(name) || /^PT\s+Duo/i.test(cols[0]) ? "duo" : null), estado: cols[3] ? est : null, minutos: minutos});
  });
  return {rows: rows, errors: errors};
}
function studioImportContracts(text){
  var parsed = parseContractsImport(text), report = {saved: 0, errors: parsed.errors.slice()};
  var prev = JSON.parse(JSON.stringify(contractMeta.map));
  parsed.rows.forEach(function(r){
    var whole = matchStudentWholeName(r.name), names = whole ? [r.name] : r.name.split(/\s*\+\s*|\s+e\s+/i).filter(Boolean);
    names.forEach(function(nm){
      var st = whole || matchStudentByName(nm);
      if (!st){ report.errors.push(nm + ": não encontrei um aluno com este nome."); return; }
      var cur = Object.assign({}, contractMeta.map[st.id] || {});
      if (r.modalidade) cur.modalidade = r.modalidade;
      if (r.formato) cur.formato = r.formato;
      if (r.estado) cur.estado = r.estado;
      if (r.minutos) cur.minutos = r.minutos;
      contractMeta.map[st.id] = cur; report.saved++;
    });
  });
  if (!report.saved) return Promise.resolve(report);
  return saveContractMeta("contracts").then(function(r){ if (r.error){ contractMeta.map = prev; report.saved = 0; report.errors.push(r.error); } return report; });
}
/* lupa e ordem no Estúdio: filtra por nome (começa por…) todas as listas com alunos e ordena o resumo de treinos */
function applyStudioFilter(){
  var main = document.getElementById("proMain");
  if (!main || !main.querySelector("#studioTools")) return;
  var q = exLibFold(studioView.search || ""), rows = [].slice.call(main.querySelectorAll("[data-sname]")), seen = {}, shown = 0;
  rows.forEach(function(r){ var nm = r.getAttribute("data-sname"), ok = !q || nameStartsWithQuery(nm, q); r.hidden = !ok; if (ok && !seen[nm]){ seen[nm] = true; shown++; } });
  var box = main.querySelector("#studioSummary");
  if (box){
    var list = [].slice.call(box.querySelectorAll(".studio-row")), sort = studioView.sort || "urgencia";
    var key = function(r){ return r.getAttribute("data-sname"); };
    list.sort(function(a, b){
      if (sort === "az") return key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0;
      if (sort === "za") return key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : 0;
      if (sort === "menos") return (Number(a.getAttribute("data-rem")) - Number(b.getAttribute("data-rem"))) || (key(a) < key(b) ? -1 : 1);
      return Number(a.getAttribute("data-ord")) - Number(b.getAttribute("data-ord"));
    });
    list.forEach(function(r){ box.appendChild(r); });
  }
  var info = main.querySelector("#stInfo");
  if (info){ info.hidden = !q; info.textContent = q ? (shown ? shown + (shown === 1 ? " aluno" : " alunos") + " no estúdio" : "Nenhum aluno com «" + studioView.search.trim() + "» no estúdio.") : ""; }
}
document.addEventListener("input", function(e){ var t = e.target; if (t && t.id === "stSearch"){ studioView.search = t.value; applyStudioFilter(); } });
document.addEventListener("keyup", function(e){ var t = e.target; if (t && t.id === "stSearch" && t.value !== (studioView.search || "")){ studioView.search = t.value; applyStudioFilter(); } });
document.addEventListener("search", function(e){ var t = e.target; if (t && t.id === "stSearch"){ studioView.search = t.value; applyStudioFilter(); } });
document.addEventListener("change", function(e){ var t = e.target; if (t && t.id === "stSort"){ studioView.sort = t.value; applyStudioFilter(); var b = document.getElementById("studioSummary"); if (b && b.scrollIntoView){ try { b.scrollIntoView({block: "start", behavior: "smooth"}); } catch (err) { b.scrollIntoView(); } } } });
/* visão geral do estúdio (menu "Estúdio") */
var studioView = {month: null, date: null, search: "", sort: "urgencia"};
/* «Quem contactar» da Gestão: pagamento em atraso, pacote a acabar/terminado e faltas (estes avisos vivem aqui, não na app de Acompanhamento) */
function studioContactReasons(studentId, today){
  var out = [], ss = studentStudioSummary(studentId, today);
  if (ss.overdue.length){
    var owed = ss.overdue.reduce(function(a, p){ return a + (Number(p.amount) || 0); }, 0), first = ss.overdue[ss.overdue.length - 1];
    out.push({key: "pagamento-atrasado", label: "Pagamento em atraso (" + eur(owed) + ")", weight: 65, vars: {valor: eur(first.amount), data: fmtDateFullPt(first.due_on)}});
  }
  if (ss.ending.length){
    var u = ss.ending.slice().sort(function(a, b){ return a.u.remaining - b.u.remaining; })[0].u;
    var left = u.remaining <= PACK_ENDING_SESSIONS || u.daysLeft == null ? "restam " + u.remaining + (u.remaining === 1 ? " sessão" : " sessões") : "termina em " + u.daysLeft + " dias";
    out.push({key: "pacote-a-acabar", label: "Pacote a acabar (" + left + ")", weight: 45, vars: {restam: left}});
  } else if (ss.needsRenewal){
    out.push({key: "pacote-a-acabar", label: "Sem pacote a decorrer — renovar?", weight: 50, vars: {restam: "já terminou"}});
  }
  if (ss.absences >= ABSENCE_ALERT) out.push({key: "faltas", label: ss.absences + " faltas nos últimos " + ABSENCE_WINDOW_DAYS + " dias", weight: 40, vars: {}});
  return out.sort(function(a, b){ return b.weight - a.weight; });
}
function studioContactHtml(students, today){
  var rows = students.map(function(st){ return {st: st, reasons: studioContactReasons(st.id, today)}; }).filter(function(r){ return r.reasons.length; })
    .sort(function(a, b){ return b.reasons[0].weight - a.reasons[0].weight || String(a.st.name).localeCompare(String(b.st.name), "pt"); });
  if (!rows.length) return "";
  return "<div class=\"card\" id=\"studioContact\"><div class=\"eyebrow\" style=\"margin-bottom:6px;\">Quem contactar (" + rows.length + ")</div>" +
    rows.map(function(r){
      var wa = r.st.phone ? whatsappUrl(r.st.phone, contactMessageFor(r.reasons[0].key, r.st, r.reasons[0].vars)) : "";
      return "<div class=\"studio-row\" data-sname=\"" + escapeHtml(exLibFold(r.st.name)) + "\"><div class=\"sr-head\"><button type=\"button\" class=\"wl-info\" data-open-student=\"" + escapeHtml(r.st.id) + "\">" + escapeHtml(r.st.name) + "</button>" +
        (wa ? "<a class=\"btn btn-sm\" target=\"_blank\" rel=\"noopener\" href=\"" + escapeHtml(wa) + "\">WhatsApp</a>" : "") + "</div>" +
        "<div class=\"muted-p\" style=\"font-size:0.78rem;\">" + r.reasons.map(function(x){ return escapeHtml(x.label); }).join(" · ") + "</div></div>";
    }).join("") + "</div>";
}
function renderProStudioMain(){
  var main = document.getElementById("proMain");
  if (!studio.loaded){ main.innerHTML = "<p class=\"muted-p\">A carregar…</p>"; studioRefresh().then(function(){ if (state.proView === "studio" && !state.proSelectedId) renderProStudioMain(); }); return; }
  if (!studio.available){ main.innerHTML = studioUnavailableHtml(); return; }
  var today = localTodayISO(); if (!studioView.month) studioView.month = monthOf(today); if (!studioView.date) studioView.date = today;
  var k = studioKpis(studioView.month, today);
  var students = visibleStudentsForDashboard().filter(isStudentActive);
  var html = "<div class=\"pro-stat-row\" id=\"studioKpis\">" +
    proStat(eurShort(k.toCollect), "A cobrar este mês") + proStat(eurShort(k.overdue), k.overdueN ? "Em atraso (" + k.overdueN + ")" : "Em atraso") +
    proStat(k.endingN, "Pacotes a acabar") + proStat(k.attendance == null ? "—" : k.attendance + "%", "Presença no mês") + proStat(totalActiveHours() ? fmtHours(totalActiveHours()) : "—", "Horas mensais ativas") + "</div>";

  html += "<div class=\"student-tools\" id=\"studioTools\"><label class=\"student-search\"><span aria-hidden=\"true\">🔍</span><input type=\"search\" id=\"stSearch\" placeholder=\"Procurar aluno no estúdio…\" autocomplete=\"off\" autocapitalize=\"off\" aria-label=\"Procurar aluno no estúdio\" value=\"" + escapeHtml(studioView.search || "") + "\"></label>" +
    "<select id=\"stSort\" class=\"mini-select\" aria-label=\"Ordenar o resumo de treinos\">" + [["urgencia", "Por urgência"], ["az", "Nome A → Z"], ["za", "Nome Z → A"], ["menos", "Menos aulas primeiro"]].map(function(o){ return "<option value=\"" + o[0] + "\"" + (studioView.sort === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></div>" +
    "<p class=\"muted-p\" id=\"stInfo\" style=\"margin:-6px 0 12px; font-size:0.78rem;\" hidden></p>";

  try { html += calendarCardHtml(); } catch (e){ html += "<div class=\"card\"><div class=\"eyebrow\">Google Agenda</div><p class=\"muted-p\">Não foi possível mostrar o cartão. Atualiza a página e sincroniza outra vez.</p></div>"; }

  // resumo de treinos (o que o e-mail semanal mostrava): quem está a acabar, quem aguarda renovação, aulas extra
  var sumRows = studioSummaryRows(today), sumOrd = 0;
  html += "<div class=\"card\" id=\"studioSummary\"><div style=\"display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px;\"><div class=\"eyebrow\">Resumo de treinos</div><button type=\"button\" class=\"btn btn-sm\" id=\"fixPacks\" style=\"min-height:44px;\" title=\"Conta nos pacotes as aulas que ficaram sem pacote\">↻ Acertar pacotes</button></div>";
  if (!sumRows.length) html += "<p class=\"muted-p\">Ainda sem pacotes. Importa os que já estão a decorrer (no fim desta página) ou cria-os na ficha de cada aluno.</p>";
  sumRows.forEach(function(r){
    var flag = r.state === "renovar" ? "🔄 Aguarda renovação" + (r.extras.n ? " · +" + r.extras.n + (r.extras.n === 1 ? " aula extra" : " aulas extra") + " (desde " + escapeHtml(fmtDateFullPt(r.extras.since)) + ")" : "")
      : r.state === "acabar" ? "⚠️ A acabar" + (r.u.daysLeft != null && r.u.daysLeft <= PACK_ENDING_DAYS ? " · termina em " + r.u.daysLeft + " dias" : "")
      : r.state === "pendente" ? "Começa a " + escapeHtml(fmtDateFullPt(r.pack.starts_on)) : "";
    html += "<div class=\"studio-row " + r.state + "\" data-sname=\"" + escapeHtml(exLibFold(r.student.name)) + "\" data-ord=\"" + (sumOrd++) + "\" data-rem=\"" + r.u.remaining + "\"><div class=\"sr-head\"><button type=\"button\" class=\"wl-info\" data-open-student=\"" + escapeHtml(r.student.id) + "\">" + escapeHtml(r.student.name) + "</button>" +
      "<span class=\"muted-p\" style=\"white-space:nowrap;\">" + (r.pack.price != null ? escapeHtml(eurShort(r.pack.price)) + " · " : "") + r.u.total + " aulas</span></div>" +
      "<div class=\"bar-track\" style=\"margin:8px 0 4px;\"><div class=\"bar-fill\" style=\"width:" + (r.state === "pendente" ? 0 : r.u.pct) + "%\"></div></div>" +
      "<div class=\"muted-p\" style=\"font-size:0.78rem;\">" + (r.state === "pendente" ? 0 : r.u.used) + "/" + r.u.total + " feitas · <strong>faltam " + r.u.remaining + "</strong>" + (r.weekly ? " · " + r.weekly + "×/semana" : "") + "</div>" +
      (r.spendFrom ? "<div class=\"muted-p\" style=\"font-size:0.78rem;\">Pacote dela esgotado · a gastar o pacote de <strong>" + escapeHtml(r.spendFrom.ownerName) + "</strong> (" + (r.spendFrom.pack.price != null ? escapeHtml(eurShort(r.spendFrom.pack.price)) + " · " : "") + r.spendFrom.u.total + " aulas): restam <strong>" + r.spendFrom.u.remaining + "</strong></div>" : "") +
      (r.activeN > 1 ? "<div class=\"muted-p\" style=\"font-size:0.78rem;\">" + r.activeN + " pacotes ativos · no total <strong>restam " + r.activeRemaining + "</strong> (gastam-se primeiro as do pacote mais antigo)</div>" : "") +
      (r.pool.shared && r.others.length ? "<div class=\"muted-p\" style=\"font-size:0.78rem;\">👥 Partilha com " + escapeHtml(r.others.join(", ")) + " · " + (r.pool.remaining === 1 ? "no conjunto resta <strong>1</strong>" : "no conjunto restam <strong>" + r.pool.remaining + "</strong>") + " de " + r.pool.total + "</div>" : "") +
      (flag ? "<div class=\"sr-flag\">" + flag + "</div>" : "") +
      (r.state === "renovar" && !r.spendFrom && Number(r.pack.price) > 0 ? "<div style=\"display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;\"><button type=\"button\" class=\"btn btn-sm primary\" style=\"min-height:44px;\" data-renew-pack=\"" + escapeHtml(r.pack.id) + "\" data-renew-paid=\"1\" title=\"Cria o pacote novo e abre o registo do pagamento\">Renovar · já pagou</button><button type=\"button\" class=\"btn btn-sm\" style=\"min-height:44px;\" data-renew-pack=\"" + escapeHtml(r.pack.id) + "\" title=\"Cria o pacote novo e a cobrança por pagar\">Renovar · por pagar</button></div>" : "") + "</div>";
  });
  html += "</div>";
  html += studioContactHtml(students, today);
  // alunos ainda sem pacote: sem isto, na app de Gestão não havia como abrir a ficha deles para lhes criar o primeiro pacote
  var noPack = students.filter(function(st){ return !packsOf(st.id).length && !usablePacksOf(st.id).length; });
  if (noPack.length){
    html += "<div class=\"card\" id=\"studioNoPack\"><div class=\"eyebrow\" style=\"margin-bottom:6px;\">Alunos sem pacote (" + noPack.length + ")</div>" +
      noPack.map(function(st){ return "<div class=\"studio-row\" data-sname=\"" + escapeHtml(exLibFold(st.name)) + "\"><div class=\"sr-head\"><button type=\"button\" class=\"wl-info\" data-open-student=\"" + escapeHtml(st.id) + "\">" + escapeHtml(st.name) + "</button><span class=\"muted-p\" style=\"white-space:nowrap;\">Criar pacote →</span></div></div>"; }).join("") + "</div>";
  }

  // agenda do dia (horários semanais)
  if (studio.slotsAvailable){
    var agenda = studio.slots.filter(function(sl){ var st = findStudent(sl.student_id); return st && isStudentActive(st) && isoWeekday(studioView.date) === sl.weekday; }).sort(function(a, b){ return a.time < b.time ? -1 : 1; });
    html += "<div class=\"card\" id=\"studioAgenda\"><div class=\"eyebrow\" style=\"margin-bottom:6px;\">Agenda — " + escapeHtml(WEEKDAY_NAMES[isoWeekday(studioView.date)]) + ", " + escapeHtml(fmtDateFullPt(studioView.date)) + "</div>" +
      "<div class=\"checkin-field\" style=\"max-width:200px;\"><label for=\"qsDate\">Dia</label><input type=\"date\" id=\"qsDate\" value=\"" + studioView.date + "\"></div>";
    var agendaNums = sessionNumberMap();
    if (!agenda.length) html += "<p class=\"muted-p\">Nenhuma sessão neste dia." + (calUsesCalendar() ? " Sincroniza o Google Agenda para trazer as aulas." : " Define o horário semanal de cada aluno na ficha (separador Pacotes).") + "</p>";
    agenda.forEach(function(sl){
      var ses = studio.sessions.filter(function(x){ return x.student_id === sl.student_id && x.date === studioView.date && (!x.time || x.time === sl.time); })[0];
      var past = studioView.date < today || (studioView.date === today);
      html += "<div class=\"history-row\" data-sname=\"" + escapeHtml(exLibFold(nameOf(sl.student_id))) + "\" style=\"align-items:center; flex-wrap:wrap; gap:6px;\"><div style=\"min-width:0;flex:1 1 150px;\"><div class=\"hlabel\">" + escapeHtml(sl.time) + " · <button type=\"button\" class=\"wl-info\" data-open-student=\"" + escapeHtml(sl.student_id) + "\">" + escapeHtml(nameOf(sl.student_id)) + "</button> " + (ses ? sessionNumberPill(agendaNums[ses.id]) : "") + "</div>" +
        "<div class=\"muted-p\" style=\"font-size:0.76rem;\">" + (ses ? sessionStatusPill(ses.status) + (ses.source === "agenda" ? " contada pelo horário" : "") : (studioView.date > today ? "agendada" : "ainda por contar")) + "</div></div>" +
        "<select class=\"mini-select\" data-sched=\"" + escapeHtml(sl.id) + "\" aria-label=\"Alterar resultado\"><option value=\"\">Alterar…</option>" + Object.keys(SESSION_STATUS).map(function(k){ return "<option value=\"" + k + "\">" + SESSION_STATUS[k].label + "</option>"; }).join("") + "</select></div>";
    });
    html += "</div>";
  }

  // registo rápido
  var withPack = students.filter(function(st){ return pickPackForSession(st.id, studioView.date); });
  html += "<div class=\"card\" id=\"quickSessions\"><div class=\"eyebrow\" style=\"margin-bottom:6px;\">" + (studio.slotsAvailable ? "Sessão fora do horário" : "Registar sessões") + "</div>" +
    (studio.slotsAvailable ? "<p class=\"muted-p\" style=\"margin-bottom:8px;\">Para uma sessão extra ou mudada de dia (a data é a escolhida na agenda).</p>" : "<div class=\"checkin-field\" style=\"max-width:200px;\"><label for=\"qsDate\">Dia</label><input type=\"date\" id=\"qsDate\" value=\"" + studioView.date + "\"></div>");
  if (!withPack.length) html += "<p class=\"muted-p\">Nenhum aluno com pacote a decorrer neste dia. Cria pacotes na ficha do aluno (separador Pacotes).</p>";
  withPack.forEach(function(st){
    var existing = studio.sessions.filter(function(x){ return x.student_id === st.id && x.date === studioView.date; });
    var pk = pickPackForSession(st.id, studioView.date), u = pk ? packUsage(pk, studioView.date) : null;
    html += "<div class=\"history-row\" data-sname=\"" + escapeHtml(exLibFold(st.name)) + "\" style=\"align-items:center; flex-wrap:wrap; gap:6px;\"><div style=\"min-width:0;flex:1 1 140px;\"><div class=\"hlabel\"><button type=\"button\" class=\"wl-info\" data-open-student=\"" + escapeHtml(st.id) + "\">" + escapeHtml(st.name) + "</button></div>" +
      "<div class=\"muted-p\" style=\"font-size:0.76rem;\">" + (u ? "restam " + u.remaining + " de " + u.total : "") + "</div></div><span style=\"display:flex; gap:6px; flex-wrap:wrap;\">" +
      (existing.length ? existing.map(function(x){ return sessionStatusPill(x.status) + " <button type=\"button\" class=\"assess-del\" data-del-session=\"" + escapeHtml(x.id) + "\" aria-label=\"Anular registo\" title=\"Anular\">↶</button>"; }).join(" ")
        : Object.keys(SESSION_STATUS).filter(function(key){ return key !== "agendada"; }).map(function(key){ return "<button type=\"button\" class=\"btn btn-sm" + (key === "feita" ? " primary" : "") + "\" data-qs=\"" + escapeHtml(st.id) + ":" + key + "\">" + SESSION_STATUS[key].short + "</button>"; }).join("")) + "</span></div>";
  });
  html += "</div>";

  var unpaid = studio.payments.filter(function(p){ return !p.paid_on; }).sort(function(a, b){ return a.due_on < b.due_on ? -1 : 1; });
  html += "<div class=\"card\" id=\"studioPayments\"><div class=\"eyebrow\" style=\"margin-bottom:6px;\">Cobranças por receber</div>" +
    (unpaid.length ? unpaid.slice(0, 15).map(function(p){ return paymentRowHtml(p, today, true); }).join("") : "<p class=\"muted-p\">✓ Nada por receber.</p>") + "</div>";

  var ending = studio.packs.map(function(p){ return {p: p, u: packUsage(p, today), st: packActiveMember(p)}; }).filter(function(x){ return x.st && packEndingInPool(x.p, today); });
  html += "<div class=\"card\" id=\"studioEnding\"><div class=\"eyebrow\" style=\"margin-bottom:6px;\">Pacotes a acabar</div>" +
    (ending.length ? ending.map(function(x){ return "<div class=\"history-row\" data-sname=\"" + escapeHtml(exLibFold(x.st.name)) + "\" style=\"align-items:center;\"><div><div class=\"hlabel\"><button type=\"button\" class=\"wl-info\" data-open-student=\"" + escapeHtml(x.st.id) + "\">" + escapeHtml(x.st.name) + "</button></div><div class=\"muted-p\" style=\"font-size:0.76rem;\">" +
      escapeHtml(x.p.name) + " · restam " + x.u.remaining + (x.u.daysLeft != null ? " · termina em " + x.u.daysLeft + " d" : "") + "</div></div><button type=\"button\" class=\"btn btn-sm\" data-renew=\"" + escapeHtml(x.st.id) + "\">Lembrar renovação</button></div>"; }).join("") : "<p class=\"muted-p\">Nenhum pacote a acabar.</p>") + "</div>";

  html += "<details class=\"perfil-section\" id=\"studioImport\" style=\"margin-bottom:14px;\"><summary class=\"eyebrow\">Importar pacotes que já estão a decorrer</summary>" +
    "<p class=\"muted-p\" style=\"margin:8px 0;\">Cola uma linha por aluno, copiada da tua folha de cálculo: <strong>Nome; aulas do pacote; data de início; valor; aulas já dadas</strong> (e, se quiseres, uma sexta coluna com a validade em meses ou o tipo do pack — <em>Mensal</em> 3, <em>Trimestral</em> 6, <em>Semestral</em> 9, <em>Anual</em> 15 meses, ou seja, a duração + 3 meses; sem ela o pacote não caduca — e uma sétima com o aluno com quem o pacote é partilhado, para casais com um só pagamento). O nome tem de ser igual ao do aluno na app. Datas como 31/12/2026.</p>" +
    "<textarea id=\"impText\" rows=\"5\" placeholder=\"Ana Silva; 26; 01/10/2026; 520; 9; Trimestral; João Silva\"></textarea>" +
    "<p class=\"muted-p\" id=\"impOut\" style=\"margin-top:6px;\"></p>" +
    "<button type=\"button\" class=\"btn primary btn-sm\" id=\"impGo\" style=\"margin-top:8px;\">Importar</button></details>";
  html += "<details class=\"perfil-section\" id=\"studioImportHours\" style=\"margin-bottom:14px;\"><summary class=\"eyebrow\">Importar as horas mensais</summary>" +
    "<p class=\"muted-p\" style=\"margin:8px 0;\">Cola uma linha por aluno com a linha «Horas mensais» da folha «Dados»: <strong>Nome; horas</strong> (ex.: Ana Silva; 8,66). Aceita o nome como na folha («PT 60 - Ana Silva»). A soma dos alunos ativos aparece no cabeçalho.</p>" +
    "<textarea id=\"hrsText\" rows=\"5\" placeholder=\"Ana Silva; 8,66\"></textarea>" +
    "<p class=\"muted-p\" id=\"hrsOut\" style=\"margin-top:6px;\"></p>" +
    "<button type=\"button\" class=\"btn primary btn-sm\" id=\"hrsGo\" style=\"margin-top:8px;\">Importar horas</button></details>";
  html += "<details class=\"perfil-section\" id=\"studioImportSched\" style=\"margin-bottom:14px;\"><summary class=\"eyebrow\">Importar as datas previstas (agendadas)</summary>" +
    "<p class=\"muted-p\" style=\"margin:8px 0;\">Cola uma linha por aluno com as datas da folha «Treinos»: <strong>Nome; 20/07/2026; 21/07/2026; …</strong> (datas como 31/12/2026 ou 2026/12/31). Ficam como «agendada» na ficha do aluno, não gastam aulas do pacote, e quando o Google Agenda trouxer essa aula passam a «feita» ou «faltou». Importar duas vezes não duplica.</p>" +
    "<textarea id=\"schText\" rows=\"5\" placeholder=\"Ana Silva; 20/07/2026; 21/07/2026; 23/07/2026\"></textarea>" +
    "<p class=\"muted-p\" id=\"schOut\" style=\"margin-top:6px;\"></p>" +
    "<button type=\"button\" class=\"btn primary btn-sm\" id=\"schGo\" style=\"margin-top:8px;\">Importar datas</button></details>";
  html += "<div class=\"card\"><div class=\"eyebrow\" style=\"margin-bottom:6px;\">Exportar para a contabilidade</div><div class=\"checkin-field\" style=\"max-width:200px;\"><label for=\"stMonth\">Mês</label><input type=\"month\" id=\"stMonth\" value=\"" + studioView.month + "\"></div>" +
    "<p class=\"muted-p\" style=\"margin-bottom:8px;\">Recebido no mês: " + escapeHtml(eur(k.received)) + " (" + k.receivedN + "). A app só regista cobranças; a fatura certificada emite-se no teu programa de faturação.</p>" +
    "<div style=\"display:flex; gap:8px; flex-wrap:wrap;\"><button type=\"button\" class=\"btn btn-sm\" id=\"csvPayments\">⬇ Cobranças (CSV)</button><button type=\"button\" class=\"btn btn-sm\" id=\"csvSessions\">⬇ Sessões (CSV)</button></div></div>";
  var stHadFocus = document.activeElement && document.activeElement.id === "stSearch", stCaret = stHadFocus ? document.activeElement.selectionStart : null;
  main.innerHTML = html;
  applyStudioFilter();
  if (stHadFocus){ var stEl = main.querySelector("#stSearch"); if (stEl){ try { stEl.focus(); if (stCaret != null) stEl.setSelectionRange(stCaret, stCaret); } catch (e) {} } }

  var redraw = function(){ renderProStudioMain(); };
  wireStudioCommon(main, redraw);
  main.querySelector("#qsDate") && main.querySelector("#qsDate").addEventListener("change", function(e){ if (isIsoDate(e.target.value)){ studioView.date = e.target.value; redraw(); } });
  main.querySelectorAll("[data-sched]").forEach(function(sel){ sel.addEventListener("change", function(){
    var sl = studio.slots.filter(function(x){ return x.id === sel.getAttribute("data-sched"); })[0], status = sel.value;
    if (!sl || !status) return;
    sel.disabled = true;
    var ses = studio.sessions.filter(function(x){ return x.student_id === sl.student_id && x.date === studioView.date && (!x.time || x.time === sl.time); })[0];
    var done = ses ? studioUpdate("sessions", ses.id, ses.source === "calendario" ? {status: status, source: "manual"} : {status: status}) : (function(){ var pk = pickPackForSession(sl.student_id, studioView.date); return studioInsert("sessions", {student_id: sl.student_id, pack_id: pk ? pk.id : null, date: studioView.date, time: sl.time, status: status}); })();
    done.then(function(r){ if (r.error) showToast("⚠ " + r.error); redraw(); updateStudioBadge(); });
  }); });
  wireCalendarCard(main, redraw);
  var fixBtn = main.querySelector("#fixPacks");
  if (fixBtn) fixBtn.addEventListener("click", function(){
    fixBtn.disabled = true;
    autoFixPacks().then(function(fx){ showToast(fx.sessions || fx.aligned || fx.reassigned ? "✓ " + (fx.sessions ? fx.sessions + (fx.sessions === 1 ? " aula acertada" : " aulas acertadas") + " em " + fx.students + (fx.students === 1 ? " aluno" : " alunos") : "pacotes acertados") + (fx.aligned ? " · " + fx.aligned + (fx.aligned === 1 ? " renovação a contar da 1.ª aula" : " renovações a contar da 1.ª aula") : "") + (fx.reassigned ? " · " + fx.reassigned + (fx.reassigned === 1 ? " aula voltou ao pacote certo" : " aulas voltaram ao pacote certo") : "") + (fx.extended ? " · " + fx.extended + (fx.extended === 1 ? " pacote sem validade" : " pacotes sem validade") : "") : "Está tudo certo: nenhuma aula por acertar"); redraw(); updateStudioBadge(); });
  });
  var hrsGo = main.querySelector("#hrsGo");
  if (hrsGo) hrsGo.addEventListener("click", function(){
    var out = main.querySelector("#hrsOut"); hrsGo.disabled = true; out.textContent = "A importar…";
    studioImportHours(main.querySelector("#hrsText").value).then(function(rep){
      var msg = "✓ " + rep.saved + (rep.saved === 1 ? " aluno atualizado" : " alunos atualizados") + (rep.saved ? " · total ativo " + fmtHours(totalActiveHours()) : "");
      if (rep.errors.length) msg += " · ⚠ " + rep.errors.slice(0, 6).join(" ") + (rep.errors.length > 6 ? " (+" + (rep.errors.length - 6) + ")" : "");
      out.textContent = msg; hrsGo.disabled = false; if (rep.saved) redraw();
    });
  });
  var schGo = main.querySelector("#schGo");
  if (schGo) schGo.addEventListener("click", function(){
    var out = main.querySelector("#schOut"); schGo.disabled = true; out.textContent = "A importar…";
    studioImportSchedule(main.querySelector("#schText").value).then(function(rep){
      var msg = "✓ " + rep.created + (rep.created === 1 ? " sessão agendada criada" : " sessões agendadas criadas") + " (" + rep.students + (rep.students === 1 ? " aluno" : " alunos") + ")" + (rep.skipped ? " · " + rep.skipped + " já existiam" : "");
      if (rep.errors.length) msg += " · ⚠ " + rep.errors.slice(0, 6).join(" ") + (rep.errors.length > 6 ? " (+" + (rep.errors.length - 6) + ")" : "");
      out.textContent = msg; schGo.disabled = false; updateStudioBadge();
    });
  });
  var impGo = main.querySelector("#impGo");
  if (impGo) impGo.addEventListener("click", function(){
    var out = main.querySelector("#impOut"); impGo.disabled = true; out.textContent = "A importar…";
    studioImportPacks(main.querySelector("#impText").value).then(function(rep){
      impGo.disabled = false;
      var lines = [];
      if (rep.created) lines.push("✓ " + rep.created + (rep.created === 1 ? " pacote criado." : " pacotes criados."));
      if (rep.skipped.length) lines.push("Já existiam: " + rep.skipped.join(", ") + ".");
      rep.errors.forEach(function(e){ lines.push("⚠ " + e); });
      if (!lines.length) lines.push("Não encontrei nada para importar.");
      out.innerHTML = lines.map(escapeHtml).join("<br>");
      if (rep.created){ showToast("✓ Pacotes importados"); updateStudioBadge(); }
    });
  });
  main.querySelectorAll("[data-qs]").forEach(function(b){ b.addEventListener("click", function(){
    var parts = b.getAttribute("data-qs").split(":"); b.disabled = true;
    studioAddSession(parts[0], studioView.date, parts[1]).then(function(r){ if (r.error) showToast("⚠ " + r.error); redraw(); });
  }); });
  main.querySelectorAll("[data-renew]").forEach(function(b){ b.addEventListener("click", function(){ var st = findStudent(b.getAttribute("data-renew")); if (st) openContactModal(st, "pacote-a-acabar", redraw); }); });
  var mEl = main.querySelector("#stMonth"); if (mEl) mEl.addEventListener("change", function(){ if (/^\d{4}-\d{2}$/.test(mEl.value)){ studioView.month = mEl.value; redraw(); } });
  var m = function(){ var v = main.querySelector("#stMonth").value; return /^\d{4}-\d{2}$/.test(v) ? v : studioView.month; };
  main.querySelector("#csvPayments").addEventListener("click", function(){ if (!downloadText("cobrancas-" + m() + ".csv", paymentsCsv(m()))) showToast("Não foi possível gerar o ficheiro"); });
  main.querySelector("#csvSessions").addEventListener("click", function(){ if (!downloadText("sessoes-" + m() + ".csv", sessionsCsv(m()))) showToast("Não foi possível gerar o ficheiro"); });
}

/* ---------- ligação ao núcleo ---------- */
function gestaoEnter(view, closeContract){ state.proView = view; state.lastGestaoView = view; if (closeContract) contractsView.open = null; studio.loaded = false; if (view === "contracts") contractMeta.loaded = false; }
G.enter = gestaoEnter; G.studioNavLabel = studioNavLabel; G.studio = studio;
G.renderProStudioMain = renderProStudioMain; G.renderProContractsMain = renderProContractsMain;
G.tplProSessoes = tplProSessoes; G.wireProSessoes = wireProSessoes; G.studentStudioSummary = studentStudioSummary;
G.studioRefresh = studioRefresh; G.studioAutoSessions = studioAutoSessions; G.studioAfterAutoSessions = studioAfterAutoSessions;
G.loaded = true;
