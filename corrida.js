/* =====================================================================================================================
   EVOLVE Treino — Corrida: ecrãs do aluno e do profissional (corrida.js)

   Avaliado com eval direto (modo estrito) dentro da IIFE de app.js, JUNTO com corrida-core.js (antes) e corrida-live.js (depois), num só eval
   (ver loadCorrida em app.js). Por isso: ES5 do projeto (var/function; sem arrow, let, const, async, template strings); só declarações de topo
   com o prefixo runUi / RUN_UI_ (o núcleo usa run* e RUN_*; o gravador usa os seus); a comunicação com os outros ficheiros é pelas funções run*
   do núcleo e pelo objeto RUN (já existe em app.js). Este ficheiro NÃO usa o GPS do telemóvel nem o armazenamento local: isso é do gravador.

   Contrato (o que este ficheiro define em RUN):
     RUN.v               estado da vista: {name: "home"|"import"|"manual"|"detail"|"consent"|"save"|"live", ...}
     RUN.go(name, params)   muda de vista e volta a desenhar o separador (só se o separador «Corrida» estiver aberto)
     RUN.screen(sv)      HTML do separador (delega em RUN.liveScreen(sv) na vista «live»)      RUN.wire(s, el)   eventos (idem RUN.liveWire)
     RUN.proTab(s, el)   separador «Corridas» da ficha do profissional
     RUN.consentVersion()  versão do aviso de privacidade (run_consents.version). Continua a 1: o texto único (RUN_UI_NOTICE) descreve TODOS os usos
                           (importar, à mão e gravar com GPS); se um uso novo mudar o que se recolhe, o texto e a versão sobem juntos (testes 137 a 140 do corrida-browser)
     RUN.ensureConsent(s, cb)  lê o consentimento no servidor; só chama cb() se o aluno aceitou (ou aceita agora) a versão atual. Só quando a leitura
                           falha por rede aceita o recibo local do gravador (RUN.consentCacheGet/Set/Clear, se existirem); o servidor decide sempre ao guardar
     RUN.submitRun(s, item)    item = {row, track|null} -> Promise<{ok:true, queued:false} | {ok:true, queued:true} | {ok:false, error, permanent}>;
                               NUNCA lança. Extra (aditivo): {ok:true, queued:false, trackFailed:true, error} = a corrida entrou mas o percurso não.
     RUN.saveFlow(s, prep)     ecrã «Confirma antes de guardar»; é o ÚNICO caminho de guardar. prep = {source, stats, segments, hiddenS, warnings,
                               fileDistM, startedAtMs} e, opcionais: onSaved(res) / onDone(res) (iguais: corrida guardada ou na fila), onCancel() (substitui «voltar ao início»),
                               cancelView {name, params}, noTime (a hora foi estimada), rpe/notes iniciais.
     RUN.flush()         por omissão devolve Promise.resolve() (o gravador sobrepõe-na)
     RUN.uiReset()       esquece tudo o que este ficheiro guarda em memória (RUN.reset é do gravador; por omissão aponta para aqui)
   Do gravador usa só com «typeof RUN.x === "function"»: liveOpen, liveScreen, liveWire, liveDraftBanner, liveWireBanner, liveBusy, queueAdd, queueClear,
   consentCacheGet, consentCacheSet, consentCacheClear, reset.
   Da app (app.js): RUN.dataMode = true com a Corrida desligada (runs_mode «off») é a vista de dados: ver, apagar e retirar o consentimento; nada de criar.

   Privacidade: nenhuma coordenada vai para consola, avisos, erros ou endereços; as mensagens de erro do servidor nunca são mostradas (só textos fixos);
   toda a linha lida da BD passa por runNormalizeRow e todo o percurso por runUiTrackFromDb antes de chegar ao ecrã; o SVG vem só de runTrackSvg;
   o texto que vem de dados (notas) só entra no HTML por escapeHtml.
   ===================================================================================================================== */

var RUN_UI_COLS = "id, student_id, started_at, source, duration_s, moving_s, distance_m, gaps, gap_s, hidden_s, splits_s, rpe, notes, consent_v, created_by";
var RUN_UI_COLS_LIGHT = "id, student_id, started_at, source, duration_s, moving_s, distance_m";
var RUN_UI_PAGE = 100;             // corridas por pedido
var RUN_UI_WEEKS = 8;              // semanas nos totais
var RUN_UI_STALE_MS = 60000;       // a lista em memória é lida outra vez ao voltar ao ecrã passado este tempo
var RUN_UI_TIMEOUT_MS = 15000;
var RUN_UI_QUICK_MS = 5000;        // a leitura do consentimento espera menos quando já há um recibo (ao ar livre, com rede fraca, ninguém espera 15 s)
var RUN_UI_TRIMS = [0, 100, 200, 500];   // metros escondidos no início e no fim do percurso partilhado
var RUN_UI_SRC = {live: "GPS no telemóvel", gpx: "Ficheiro GPX", tcx: "Ficheiro TCX", fit: "Ficheiro FIT", manual: "À mão", native: "App nativa"};
var RUN_UI_MODES = [["off", "Desligada"], ["import", "Importar e registar à mão"], ["live", "Também gravar com GPS (experimental)"]];

var RUN_UI_MSG = {
  missing: "Corrida indisponível por agora. Volta a tentar mais tarde.",
  missingPro: "Falta correr a migração 0032 no Supabase (docs/OPERACOES.md, secção 8u).",
  net: "Sem ligação. Nada foi perdido: tenta guardar outra vez.",
  generic: "Não foi possível guardar. Tenta outra vez.",
  rls: "Não foi possível guardar. A Corrida pode ter sido desativada para ti, ou o teu consentimento já não está registado: fala com o teu profissional.",
  consent: "O teu consentimento já não está registado. Aceita o aviso outra vez e volta a guardar.",
  check: "O servidor recusou esta corrida (valores fora do permitido).",
  saved: "Corrida guardada.",
  queued: "Sem ligação: a corrida ficou guardada neste telemóvel e será enviada quando houver ligação.",
  trackLost: "A corrida ficou guardada, mas o percurso não.",
  shortTrack: "A corrida é curta demais para mostrar o percurso com o início e o fim escondidos: guardámos só os números.",
  offDelete: "Para apagar corridas é preciso ligação à internet.",
  loadNet: "Sem ligação. Não consegui carregar as tuas corridas.",
  loadOther: "Não foi possível carregar as tuas corridas. Tenta outra vez.",
  previewOnly: "Só o aluno pode importar ou registar corridas.",
  dupAsk: "Já tens uma corrida parecida neste momento. Guardar mesmo assim?",
  empty: "Ainda não tens corridas. Importa um ficheiro ou regista a primeira à mão.",
  offIntro: "O teu profissional desligou a Corrida. Aqui só podes ver e apagar o que já tens guardado: não dá para importar, registar nem gravar corridas.",
  offEmpty: "Não tens corridas guardadas.",
  sensitive: "A localização é um dado sensível: não partilhes estas corridas com terceiros."
};

/* ---------- estado em memória (nada disto vai para o armazenamento do telemóvel) ---------- */
function runUiNewData(sid, uid){
  return {sid: sid, uid: uid, runs: [], weekRuns: null, loaded: false, loading: false, loadedAt: 0, err: "", more: false, raw: 0, tracks: {}, gen: 0};
}
// a lista em memória deixou de valer (guardou-se ou apagou-se algo): um pedido já a caminho também deixa de valer
function runUiInvalidate(d){ d.loaded = false; d.gen++; d.tracks = {}; d.weekRuns = null; }
var runUiData = runUiNewData("", "");       // o ecrã do aluno (e a pré-visualização do profissional)
var runUiProData = runUiNewData("", "");    // a ficha do aluno no profissional
var runUiConsentFor = "";                   // id do aluno cujo consentimento da versão atual já foi confirmado nesta sessão
var runUiConsentBusy = false;
var runUiGoSeq = 0;                         // conta as mudanças de vista (RUN.go)

function runUiUid(){ return typeof currentAuthUserId === "string" ? currentAuthUserId : ""; }
// o ecrã é de um aluno e de uma conta: se mudarem, esquece-se o que estava em memória
function runUiSync(sid){
  var uid = runUiUid();
  if (runUiData.sid !== sid || runUiData.uid !== uid){
    runUiData = runUiNewData(sid, uid);
    RUN.v = {name: "home"};
    if (runUiConsentFor !== sid) runUiConsentFor = "";
  }
}
function runUiReset(){
  runUiData = runUiNewData("", "");
  runUiProData = runUiNewData("", "");
  runUiConsentFor = "";
  runUiConsentBusy = false;
  RUN.uiMapOn = false;
  RUN.v = {name: "home"};
  RUN.dataMode = false;
}

/* ---------- servidor ---------- */
function runUiDb(){ return typeof sb !== "undefined" && sb ? sb : null; }
// um pedido com tempo limite (ms, por omissão 15 s) que nunca rejeita: {data, error, status}
function runUiCall(make, ms){
  var db = runUiDb(), p;
  if (!db) return Promise.resolve({data: null, error: {message: "sem ligação", code: ""}, status: 0});
  try { p = withTimeout(make(db), ms || RUN_UI_TIMEOUT_MS); } catch (e) { return Promise.resolve({data: null, error: {message: "falhou", code: ""}, status: 0}); }
  return p.then(function(res){
    return res && typeof res === "object" ? res : {data: null, error: {message: "vazio", code: ""}, status: 0};
  }, function(){ return {data: null, error: {message: "tempo esgotado", code: ""}, status: 0}; });
}
// "" (sem erro) | missing (tabela ou coluna em falta) | dup | rls | consent | check | net | other. As mensagens do servidor nunca são mostradas.
function runUiKind(res){
  var e = res && res.error;
  if (!e) return "";
  var code = String(e.code || ""), msg = String(e.message || "");
  if (code === "PGRST205" || code === "42P01" || /does not exist|schema cache/i.test(msg)) return "missing";
  if (code === "23505") return "dup";
  if (code === "42501" || res.status === 403) return "rls";
  if (code === "23503") return "consent";
  if (code === "23514" || code === "22003" || code === "22P02" || code === "22001") return "check";
  if (outboxErrorIsTransient(res)) return "net";
  return "other";
}
function runUiRows(res){ return Array.isArray(res && res.data) ? res.data : (res && res.data ? [res.data] : []); }

/* ---------- datas e números (locais; nunca toISOString para «hoje») ---------- */
function runUiPad(n){ return (n < 10 ? "0" : "") + n; }
function runUiDateStr(ms){ var d = new Date(ms); return runUiPad(d.getDate()) + "/" + runUiPad(d.getMonth() + 1) + "/" + d.getFullYear(); }
function runUiShortDate(ms){ var d = new Date(ms); return runUiPad(d.getDate()) + "/" + runUiPad(d.getMonth() + 1); }
function runUiTimeStr(ms){ var d = new Date(ms); return runUiPad(d.getHours()) + ":" + runUiPad(d.getMinutes()); }
function runUiIsoDay(ms){ var d = new Date(ms); return d.getFullYear() + "-" + runUiPad(d.getMonth() + 1) + "-" + runUiPad(d.getDate()); }
function runUiWeekStart(ms){ var d = new Date(ms), dow = (d.getDay() + 6) % 7; return new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow).getTime(); }
function runUiWeekStartAgo(ms, k){ var d = new Date(runUiWeekStart(ms)); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7 * k).getTime(); }
function runUiKmNum(m){ return runDistStr(m).replace(/ km$/, ""); }
function runUiNum1(v){ return String(Math.round(v * 10) / 10).replace(".", ","); }
function runUiInt(v, lo, hi){ var n = Math.round(Number(v)); return isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; }

/* ---------- percurso vindo da BD: números e tetos, senão não se mostra ---------- */
function runUiTrackFromDb(points){
  if (!Array.isArray(points) || points.length < 1 || points.length > 200) return null;
  var out = [], total = 0, i, j;
  for (i = 0; i < points.length; i++){
    var seg = points[i], o = [];
    if (!Array.isArray(seg) || seg.length > 5000) return null;
    for (j = 0; j < seg.length; j++){
      var p = seg[j];
      if (!Array.isArray(p) || p.length !== 3) return null;
      if (typeof p[0] !== "number" || typeof p[1] !== "number" || typeof p[2] !== "number") return null;
      if (!isFinite(p[0]) || !isFinite(p[1]) || !isFinite(p[2])) return null;
      if (p[0] < -90 || p[0] > 90 || p[1] < -180 || p[1] > 180 || p[2] < 0 || p[2] > 2592000) return null;
      o.push([p[0], p[1], p[2]]);
    }
    total += o.length;
    if (total > 8000) return null;
    if (o.length) out.push(o);
  }
  return out.length ? out : null;
}

/* ---------- ler as corridas ---------- */
// sem limite de idade: quem pode apagar uma corrida tem de a poder ver (só os totais das 8 semanas têm janela, mais abaixo)
var RUN_UI_ACT = {noCol: false};   // true quando o servidor ainda não tem a coluna activity (migração 0033 por correr): tudo se lê como corrida
function runUiActColErr(res){ return !!(res && res.error && /activity|42703|PGRST204/i.test(String(res.error.message || "") + " " + String(res.error.code || ""))); }
function runUiFetchRuns(sid, from, count){
  function go(cols){
    return runUiCall(function(db){
      return db.from("runs").select(cols).eq("student_id", sid).order("started_at", {ascending: false}).range(from, from + count - 1);
    });
  }
  if (RUN_UI_ACT.noCol) return go(RUN_UI_COLS);
  return go(RUN_UI_COLS + ", activity").then(function(res){
    if (!runUiActColErr(res)) return res;
    RUN_UI_ACT.noCol = true;
    return go(RUN_UI_COLS);
  });
}
function runUiNormalize(rows, sid){
  return runNormalizeRows(rows).filter(function(r){ return r.studentId === sid; });
}
function runUiMerge(a, b){
  var seen = {}, out = [];
  a.concat(b).forEach(function(r){ if (!seen[r.id]){ seen[r.id] = 1; out.push(r); } });
  out.sort(function(x, y){ return y.startedAtMs - x.startedAtMs; });
  return out;
}
// lê a 1.ª página (ou a seguinte) para d; done() corre no fim, com ou sem erro
function runUiLoad(d, sid, more, done){
  if (d.loading) return;
  d.loading = true;
  var from = more ? d.raw : 0, gen = d.gen;
  runUiFetchRuns(sid, from, RUN_UI_PAGE).then(function(res){
    d.loading = false;
    if (gen !== d.gen){ done(); return; }   // mudou entretanto: o ecrã volta a pedir
    d.loaded = true; d.loadedAt = Date.now();
    if (res.error){ d.err = runUiKind(res) === "missing" ? "missing" : runUiKind(res) === "net" ? "net" : "other"; done(); return; }
    var raw = runUiRows(res), rows = runUiNormalize(raw, sid);
    d.err = "";
    d.raw = from + raw.length;
    d.more = raw.length >= RUN_UI_PAGE;
    d.runs = more ? runUiMerge(d.runs, rows) : runUiMerge([], rows);
    d.weekRuns = null;
    var winStart = runUiWeekStartAgo(Date.now(), RUN_UI_WEEKS - 1);
    if (!more && d.more && d.runs.length && d.runs[d.runs.length - 1].startedAtMs >= winStart){
      // a página cheia ainda está toda dentro das 8 semanas: os totais precisam de ler o resto dessas semanas (colunas mínimas)
      runUiCall(function(db){
        return db.from("runs").select(RUN_UI_COLS_LIGHT + (RUN_UI_ACT.noCol ? "" : ", activity")).eq("student_id", sid).gte("started_at", new Date(winStart).toISOString()).order("started_at", {ascending: false}).range(0, 999);
      }).then(function(r2){
        if (!r2.error && gen === d.gen) d.weekRuns = runUiNormalize(runUiRows(r2), sid);
        done();
      });
      return;
    }
    done();
  });
}
function runUiLoadTrack(d, runId, done){
  var t = d.tracks[runId];
  if (t) return;
  d.tracks[runId] = {state: "loading"};
  var sid = d.sid;
  runUiCall(function(db){ return db.from("run_tracks").select("points, trim_m").eq("run_id", runId).maybeSingle(); }).then(function(res){
    if (res.error) d.tracks[runId] = {state: "err"};
    else if (!res.data) d.tracks[runId] = {state: "none"};
    else {
      var segs = runUiTrackFromDb(res.data.points);
      d.tracks[runId] = segs ? {state: "ok", segs: segs, trimM: runUiInt(res.data.trim_m, 0, 2000)} : {state: "err"};
    }
    if (sid === d.sid) done();
  });
}
function runUiFindRun(d, id){
  var i;
  for (i = 0; i < d.runs.length; i++) if (d.runs[i].id === id) return d.runs[i];
  return null;
}

/* ---------- redesenhar sem pisar o que o aluno está a fazer ---------- */
function runUiRedraw(s, name){
  try {
    if (APP_MODE !== "treino" || state.alunoTab !== "corrida" || String(state.alunoStudentId) !== String(s.id)) return;
    if (!RUN.v || RUN.v.name !== name) return;
    if (modalRoot && modalRoot.firstChild) return;
    renderAlunoTab(findStudent(state.alunoStudentId) || s);
  } catch (e) {}
}
function runUiRedrawPro(s){
  try {
    if (APP_MODE === "treino" || state.proSelectedId !== s.id || state.proTab !== "corridas") return;
    var el = document.getElementById("proTabContent");
    if (el) RUN.proTab(s, el);
  } catch (e) {}
}
function runUiAsk(msg){ try { return window.confirm(msg); } catch (e) { return false; } }
function runUiOnline(){ return !(typeof navigator !== "undefined" && navigator.onLine === false); }

/* ---------- totais por semana ---------- */
function runUiWeeks(rows, nowMs){
  var weeks = [], i;
  for (i = 0; i < RUN_UI_WEEKS; i++) weeks.push({start: runUiWeekStartAgo(nowMs, i), n: 0, distM: 0, movingS: 0, durationS: 0, nBike: 0, runDistM: 0, runMovingS: 0});
  rows.forEach(function(r){
    var k;
    for (k = 0; k < weeks.length; k++){
      if (r.startedAtMs >= weeks[k].start){ weeks[k].n++; weeks[k].distM += r.distM; weeks[k].movingS += r.movingS; weeks[k].durationS += r.durationS;
        if (r.activity === "bike") weeks[k].nBike++; else { weeks[k].runDistM += r.distM; weeks[k].runMovingS += r.movingS; }
        break; }
    }
  });
  return weeks;
}
function runUiKpi(label, value, unit){
  return '<div class="kpi"><div class="l">' + escapeHtml(label) + '</div><div class="v num">' + escapeHtml(value) + (unit ? '<small>' + escapeHtml(unit) + '</small>' : '') + '</div></div>';
}
function runUiWeeksHtml(d){
  var rows = d.weekRuns || d.runs, weeks = runUiWeeks(rows, Date.now()), tot = {n: 0, distM: 0, movingS: 0, durationS: 0, nBike: 0, runDistM: 0, runMovingS: 0}, maxM = 0;
  weeks.forEach(function(w){ tot.nBike += w.nBike; tot.runDistM += w.runDistM; tot.runMovingS += w.runMovingS; tot.n += w.n; tot.distM += w.distM; tot.movingS += w.movingS; tot.durationS += w.durationS; if (w.distM > maxM) maxM = w.distM; });
  var pace = runPaceOf(tot.runDistM, tot.runMovingS), mixed = tot.nBike > 0;   // o ritmo médio é só das corridas (a bicicleta não entra na conta)
  var h = '<div class="card run-weeks"><div class="eyebrow">Últimas ' + RUN_UI_WEEKS + ' semanas</div>' +
    '<div class="kpi-grid run-kpis">' + runUiKpi(mixed ? "Atividades" : "Corridas", String(tot.n), "") + runUiKpi("Distância", runUiKmNum(tot.distM), "km") +
    runUiKpi("Tempo", runDurStr(tot.durationS), "") + runUiKpi("Ritmo médio", runPaceStr(pace), pace ? "/km" : "") + '</div>';
  if (maxM > 0){
    h += '<div class="run-bars" role="img" aria-label="Quilómetros por semana, das mais antigas para a atual">';
    weeks.slice().reverse().forEach(function(w, idx){
      var pct = w.distM > 0 ? Math.max(6, Math.round(w.distM / maxM * 100)) : 0, last = idx === weeks.length - 1;
      h += '<div class="run-bar' + (last ? ' now' : '') + '"><span class="num">' + escapeHtml(w.distM > 0 ? runUiNum1(w.distM / 1000) : "") + '</span><i style="height:' + pct + '%"></i>' +
        '<small>' + escapeHtml(last ? "Esta" : runUiShortDate(w.start)) + '</small></div>';
    });
    h += '</div>';
  }
  var cur = weeks[0];
  h += '<p class="muted-p run-this">Esta semana: ' + escapeHtml(cur.n ? (cur.nBike ? plural(cur.n, "atividade", "atividades") : plural(cur.n, "corrida", "corridas")) + " · " + runDistStr(cur.distM) + " · " + runDurStr(cur.durationS) : "ainda sem corridas") + '.</p>';
  return h + '</div>';
}

/* ---------- linhas e detalhe ---------- */
function runUiRowHtml(r, attr){
  var bits = [runDurStr(r.durationS)], pace = runPaceStr(r.paceSPerKm), bike = r.activity === "bike";
  if (bike){ bits.unshift("Bicicleta"); if (r.speedKmh) bits.push(runUiNum1(r.speedKmh) + " km/h"); }
  else if (pace !== "–") bits.push(pace + "/km");
  if (r.rpe) bits.push("esforço " + r.rpe + "/10");
  if (r.gaps) bits.push(r.gaps === 1 ? "1 lacuna" : r.gaps + " lacunas");
  return '<button type="button" class="run-row" ' + attr + '="' + escapeHtml(r.id) + '">' +
    '<span class="run-row-top"><span class="run-row-date">' + escapeHtml(runUiDateStr(r.startedAtMs) + " · " + runUiTimeStr(r.startedAtMs)) + '</span>' +
    '<span class="run-row-src">' + escapeHtml(RUN_UI_SRC[r.source] || "") + '</span></span>' +
    '<span class="run-row-dist num">' + escapeHtml(runDistStr(r.distM)) + '</span>' +
    '<span class="run-row-sub">' + escapeHtml(bits.join(" · ")) + '</span>' +
    (r.notes ? '<span class="run-row-note">' + escapeHtml(r.notes) + '</span>' : '') + '</button>';
}
function runUiSplitsHtml(splits){
  if (!splits || !splits.length) return "";
  var fast = Math.min.apply(null, splits), slow = Math.max.apply(null, splits), h = '<div class="run-splits">';
  splits.forEach(function(sec, i){
    var w = slow > fast ? Math.round(50 + 50 * (slow - sec) / (slow - fast)) : 100;
    h += '<div class="run-split"><span class="run-split-km num">' + (i + 1) + '</span><span class="run-split-bar"><i style="width:' + w + '%"></i></span><span class="run-split-t num">' + escapeHtml(runDurStr(sec)) + '</span></div>';
  });
  return h + '</div>';
}

/* ---------- Mapa de fundo (opcional: o aluno e o profissional, só ao tocar) ----------
   O percurso é sempre desenhado sem mapa. Só quando o aluno toca em «Mostrar mapa» (e depois de ler o que isso implica) a página pede ao
   OpenStreetMap os quadrados do mapa da zona do percurso: o OpenStreetMap passa a saber a zona e o IP. Nada mais sai do telemóvel.
   O profissional também o pode ligar, mas só para percursos que o aluno partilhou (já aparados). Sem biblioteca: projeção Web Mercator e quadrados 256 px calculados aqui. */
var RUN_UI_MAP_W = 320, RUN_UI_MAP_H = 240, RUN_UI_MAP_PAD = 22;
function runUiMapPoints(segs){
  var out = [];
  if (!Array.isArray(segs)) return out;
  segs.forEach(function(seg){
    var o = [];
    (Array.isArray(seg) ? seg : []).forEach(function(p){
      var lat = p && (typeof p.lat === "number" ? p.lat : (Array.isArray(p) ? p[0] : NaN)), lon = p && (typeof p.lon === "number" ? p.lon : (Array.isArray(p) ? p[1] : NaN));
      if (typeof lat === "number" && typeof lon === "number" && isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 85 && Math.abs(lon) <= 180) o.push([lat, lon]);
    });
    if (o.length) out.push(o);
  });
  return out;
}
function runUiMerc(lat, lon, z){
  var n = 256 * Math.pow(2, z), r = lat * Math.PI / 180;
  return [(lon + 180) / 360 * n, (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n];
}
function runUiMapHtml(segs){
  var pts = runUiMapPoints(segs);
  var all = [].concat.apply([], pts);
  if (all.length < 2) return "";
  var minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  all.forEach(function(p){ minLat = Math.min(minLat, p[0]); maxLat = Math.max(maxLat, p[0]); minLon = Math.min(minLon, p[1]); maxLon = Math.max(maxLon, p[1]); });
  var z = 17, W = RUN_UI_MAP_W, H = RUN_UI_MAP_H, pad = RUN_UI_MAP_PAD, a, b;
  for (; z > 3; z--){
    a = runUiMerc(maxLat, minLon, z); b = runUiMerc(minLat, maxLon, z);
    if (b[0] - a[0] <= W - 2 * pad && b[1] - a[1] <= H - 2 * pad) break;
  }
  a = runUiMerc(maxLat, minLon, z); b = runUiMerc(minLat, maxLon, z);
  var ox = (a[0] + b[0]) / 2 - W / 2, oy = (a[1] + b[1]) / 2 - H / 2, n = Math.pow(2, z);
  var tiles = "", tx, ty;
  for (ty = Math.floor(oy / 256); ty <= Math.floor((oy + H) / 256); ty++){
    if (ty < 0 || ty >= n) continue;
    for (tx = Math.floor(ox / 256); tx <= Math.floor((ox + W) / 256); tx++){
      var wx = ((tx % n) + n) % n;
      tiles += '<img class="run-map-tile" alt="" width="256" height="256" draggable="false" src="https://tile.openstreetmap.org/' + z + '/' + wx + '/' + ty + '.png" style="left:' + ((tx * 256 - ox) / W * 100).toFixed(3) + '%;top:' + ((ty * 256 - oy) / H * 100).toFixed(3) + '%;width:' + (256 / W * 100).toFixed(3) + '%;height:' + (256 / H * 100).toFixed(3) + '%;">';
    }
  }
  var lines = "";
  pts.forEach(function(seg){
    var d = seg.map(function(p){ var m = runUiMerc(p[0], p[1], z); return (m[0] - ox).toFixed(1) + "," + (m[1] - oy).toFixed(1); }).join(" ");
    lines += '<polyline points="' + d + '" fill="none" stroke="#e8602c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>';
  });
  var f = pts[0][0], l = pts[pts.length - 1][pts[pts.length - 1].length - 1], mf = runUiMerc(f[0], f[1], z), ml = runUiMerc(l[0], l[1], z);
  lines += '<circle cx="' + (mf[0] - ox).toFixed(1) + '" cy="' + (mf[1] - oy).toFixed(1) + '" r="5.5" fill="#e8602c" stroke="#fff" stroke-width="2"/>' +
    '<circle cx="' + (ml[0] - ox).toFixed(1) + '" cy="' + (ml[1] - oy).toFixed(1) + '" r="5.5" fill="#fff" stroke="#e8602c" stroke-width="3"/>';
  return '<div class="run-map" role="img" aria-label="Percurso sobre o mapa">' + tiles +
    '<svg viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + lines + '</svg>' +
    '<a class="run-map-attr" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a></div>';
}
// o bloco do mapa: botão (com o aviso do que implica) ou o mapa já ligado
function runUiMapBlock(segs, pro){
  if (!runUiMapPoints(segs).length) return "";
  if (RUN.uiMapOn) return runUiMapHtml(segs) + '<p class="muted-p run-note"><button type="button" class="btn btn-sm" data-run-map="off">Esconder o mapa</button></p>';
  return '<div class="run-map-ask"><button type="button" class="btn btn-sm" data-run-map="on">Mostrar mapa</button>' +
    '<p class="muted-p run-note">Ao mostrar o mapa, o OpenStreetMap (um serviço de terceiros) fica a saber a zona do percurso e o teu endereço IP. Os teus números e o percurso continuam só entre ti e a EVOLVE.</p></div>';
}

function runUiTrackBlock(r, track, pro){
  if (r.source === "manual") return "";
  var h = '<div class="card run-track"><div class="eyebrow">Percurso</div>';
  if (!track || track.state === "loading") return h + '<p class="muted-p">A carregar o percurso…</p></div>';
  if (track.state === "err") return h + '<p class="muted-p">Não foi possível mostrar o percurso.</p></div>';
  if (track.state === "none") return h + '<p class="muted-p run-no-track">' + escapeHtml(pro ? "O aluno não partilhou o percurso." : "Não partilhaste o percurso: ficaram só os números.") + '</p></div>';
  var svg = runTrackSvg(track.segs, {width: 320, height: 220});
  if (!svg) return h + '<p class="muted-p">O percurso é curto demais para desenhar.</p></div>';
  return h + '<div class="run-svg-wrap">' + svg + '</div>' + runUiMapBlock(track.segs, pro) + '<p class="muted-p run-note">Este percurso foi aparado e simplificado antes de ser guardado' +
    (track.trimM ? ' (início e fim escondidos: pelo menos ' + track.trimM + ' m)' : '') + '.</p></div>';
}
function runUiDetailHtml(d, id, pro, preview, backId){
  var r = runUiFindRun(d, id);
  if (!r) return '<div class="card"><button type="button" class="btn btn-sm run-back" id="' + backId + '">← Corridas</button><p class="muted-p">Esta corrida já não existe.</p></div>';
  var track = d.tracks[id], kp = '';
  kp += runUiKpi("Tempo", runDurStr(r.durationS), "");
  if (r.activity === "bike") kp += runUiKpi("Velocidade média em movimento", r.speedKmh ? runUiNum1(r.speedKmh) : "–", r.speedKmh ? "km/h" : "");
  else kp += runUiKpi("Ritmo em movimento", runPaceStr(r.paceSPerKm), r.paceSPerKm ? "/km" : "");
  if (r.movingS && r.movingS < r.durationS) kp += runUiKpi("Tempo em movimento", runDurStr(r.movingS), "");
  if (r.rpe) kp += runUiKpi("Esforço", String(r.rpe), "/10");
  if (r.hiddenS) kp += runUiKpi("Em segundo plano", runDurStr(r.hiddenS), "");
  if (r.gaps) kp += runUiKpi("Lacunas", String(r.gaps), r.gapS ? runDurStr(r.gapS) + " sem posições" : "");
  var h = '<div class="run-detail"><button type="button" class="btn btn-sm run-back" id="' + backId + '">← ' + (pro ? "Corridas do aluno" : "Corridas") + '</button>' +
    '<div class="card"><div class="eyebrow">' + escapeHtml((r.activity === "bike" ? "Bicicleta · " : "") + runUiDateStr(r.startedAtMs) + " · " + runUiTimeStr(r.startedAtMs) + " · " + (RUN_UI_SRC[r.source] || "")) + '</div>' +
    '<div class="hero-num run-dist num">' + escapeHtml(runUiKmNum(r.distM)) + '<small>km</small></div><div class="kpi-grid run-kpis">' + kp + '</div>' +
    (r.notes ? '<p class="run-notes">' + escapeHtml(r.notes) + '</p>' : '') + '</div>';
  if (r.splitsS.length) h += '<div class="card"><div class="eyebrow">Parciais por quilómetro</div>' + runUiSplitsHtml(r.splitsS) + '</div>';
  h += runUiTrackBlock(r, track, pro);
  if (!preview){
    h += '<div class="card run-actions">';
    if (!pro && track && track.state === "ok") h += '<button type="button" class="btn run-btn" id="runExportSaved">Exportar GPX (percurso guardado)</button>';
    if (track && track.state === "ok") h += '<button type="button" class="btn run-btn run-danger" id="runDelTrack">Apagar só o percurso</button>';
    h += '<button type="button" class="btn run-btn run-danger" id="runDelRun">Apagar corrida</button></div>';
  }
  return h + '</div>';
}

/* ---------- texto fixo ---------- */
var RUN_UI_GUIDE = [
  ["Suunto", "na app, abre o treino, três pontos, GPX."],
  ["COROS", "na app, abre o treino, canto superior direito, Exportar dados, GPX."],
  ["Strava", "só no site, abre a atividade, menu «...», Exportar GPX."],
  ["Garmin Connect", "no site, abre a atividade, roda dentada, Exportar para GPX."],
  ["Polar Flow", "no site, abre a sessão, menu Exportar, GPX ou TCX."],
  ["Apple Fitness", "não exporta um treino sozinho; existem apps de terceiros (não as avaliámos); evita «Exportar todos os dados de saúde», que junta todo o teu histórico."],
  ["Nike Run Club", "não confirmámos nenhuma exportação."]
];
function runUiGuideHtml(){
  return '<details class="soft-details run-guide" id="runGuide"><summary>Como obter o ficheiro</summary>' +
    '<p class="muted-p">Segundo a documentação de cada fabricante; os menus podem mudar. Não testámos todas as apps.</p><ul class="run-guide-list">' +
    RUN_UI_GUIDE.map(function(g){ return '<li><b>' + escapeHtml(g[0]) + ':</b> ' + escapeHtml(g[1]) + '</li>'; }).join("") +
    '</ul><p class="muted-p">Se não conseguires, usa «Registar à mão».</p></details>';
}
// O aviso de privacidade é UM só (versão 1) e descreve todos os usos da Corrida: o que se aceita é o mesmo qualquer que seja o modo que o profissional
// ligue depois. Se um uso novo mudar o que se recolhe ou quem vê, este texto e RUN.consentVersion() sobem juntos (os testes 137 a 140 do corrida-browser prendem o texto às colunas
// que se gravam e às funcionalidades que existem). O consentimento e «Privacidade e dados» mostram estes mesmos parágrafos.
var RUN_UI_NOTICE = [
  "Podes trazer uma corrida de três maneiras: escolhes um ficheiro (GPX ou TCX) do relógio ou de outra app, registas a corrida à mão ou, se o teu profissional ligar essa opção, gravas aqui com o GPS do telemóvel. A EVOLVE lê o ficheiro no teu telemóvel e não o guarda.",
  "O GPS do telemóvel só liga depois de carregares em «Gravar com GPS» e em «Preparar GPS», e só enquanto a EVOLVE está aberta a gravar. Enquanto gravas, as posições ficam num rascunho neste telemóvel até guardares ou descartares a corrida. Com o ecrã bloqueado ou noutra aplicação o registo pode falhar e deixar lacunas.",
  "Fica guardado no servidor: a data e a hora de início, a origem (ficheiro GPX ou TCX, à mão ou GPS), a distância, o tempo total e o tempo em movimento (o ritmo calcula-se a partir deles), o tempo de cada quilómetro, as lacunas sem sinal, o tempo com a app em segundo plano, o esforço (1 a 10), as notas que escreveres e a versão deste aviso. O percurso só fica guardado se escolheres partilhá-lo, sem, pelo menos, os metros do início e do fim que escolheres esconder.",
  "Quem vê: tu e os profissionais da EVOLVE. As notas são texto livre: não escrevas moradas. Os dados ficam no serviço de alojamento da EVOLVE (Supabase). Não usamos mapas nem serviços de terceiros e não guardamos a frequência cardíaca.",
  "Podes apagar uma corrida, só o percurso ou todas, quando quiseres, mesmo que o teu profissional desligue a Corrida. Se retirares este consentimento, apagamos todas as tuas corridas."
];
function runUiNoticeHtml(cls){
  return RUN_UI_NOTICE.map(function(p){ return '<p' + (cls ? ' class="' + cls + '"' : '') + '>' + escapeHtml(p) + '</p>'; }).join("");
}
// outside: na vista de dados (Corrida desligada) os botões de apagar ficam à vista, fora do texto recolhido
function runUiPrivacyHtml(d, preview, outside){
  var btns = '';
  if (!preview){
    if (d.runs.length) btns += '<button type="button" class="btn run-btn run-danger" id="runDelAll">Apagar todas as corridas</button>';
    btns += '<button type="button" class="btn run-btn run-danger" id="runWithdraw">Retirar consentimento</button>';
  }
  return '<details class="soft-details run-privacy" id="runPrivacy"><summary>Privacidade e dados</summary>' + runUiNoticeHtml("muted-p") +
    '<p class="muted-p">' + escapeHtml(RUN_UI_MSG.sensitive) + '</p>' + (outside ? '' : btns) + '</details>' + (outside ? btns : '');
}

/* ---------- vista «home» ---------- */
function runUiBannerHtml(sv){
  try {
    if (typeof RUN.liveDraftBanner !== "function") return "";
    var h = RUN.liveDraftBanner(sv);
    return typeof h === "string" ? h : "";
  } catch (e) { return ""; }
}
// a lista (ou o estado em que está: a carregar, erro, vazia). Com totais (início) ou só a lista (vista de dados)
function runUiListHtml(d, o){
  if (!d.runs.length && !d.loaded) return '<div class="card run-state"><p class="muted-p" id="runLoading">A carregar as tuas corridas…</p></div>';
  if (d.err && !d.runs.length){
    return '<div class="card run-state" id="runLoadErr"><p class="muted-p">' + escapeHtml(d.err === "net" ? RUN_UI_MSG.loadNet : RUN_UI_MSG.loadOther) + '</p><button type="button" class="btn run-btn" id="runRetry">Tentar outra vez</button></div>';
  }
  if (!d.runs.length) return '<div class="card run-state"><p class="muted-p" id="runEmpty">' + escapeHtml(o.empty) + '</p></div>';
  return (o.weeks ? runUiWeeksHtml(d) : '') + '<div class="card run-list"><div class="eyebrow">As minhas corridas</div>' +
    d.runs.map(function(r){ return runUiRowHtml(r, "data-run"); }).join("") +
    (d.more ? '<p class="muted-p run-note">A mostrar as ' + d.runs.length + ' mais recentes.</p><button type="button" class="btn run-btn" id="runMore"' + (d.loading ? ' disabled' : '') + '>Ver mais</button>' : '') + '</div>';
}
function runUiMissingHtml(){
  return '<div class="card run-state" id="runMissing"><p class="muted-p">' + escapeHtml(RUN_UI_MSG.missing) + '</p><button type="button" class="btn run-btn" id="runRetry">Tentar outra vez</button></div>';
}
// Corrida desligada pelo profissional: o aluno só vê e apaga o que já tem (nada de importar, registar à mão nem gravar)
function runUiOffHtml(sv){
  var d = runUiData, preview = authRole !== "student";
  var h = '<div class="card run-off" id="runOff"><button type="button" class="btn btn-sm run-back" id="runOffBack">← Voltar</button>' +
    '<h3 class="run-h">A Corrida está desligada</h3><p class="muted-p">' + escapeHtml(RUN_UI_MSG.offIntro) + '</p></div>';
  if (d.loaded && d.err === "missing") return h + runUiMissingHtml();
  if (!preview) h += runUiBannerHtml(sv);
  h += runUiListHtml(d, {weeks: false, empty: RUN_UI_MSG.offEmpty});
  return h + '<div class="card run-priv">' + runUiPrivacyHtml(d, preview, true) + '</div>';
}
function runUiAct(){ return RUN.activity === "bike" ? "bike" : "run"; }
function runUiActHtml(){
  var a = runUiAct();
  return '<div class="run-seg" role="group" aria-label="Tipo de atividade">' +
    '<button type="button" class="run-seg-btn" id="runActRun" aria-pressed="' + (a === "run") + '">Corrida</button>' +
    '<button type="button" class="run-seg-btn" id="runActBike" aria-pressed="' + (a === "bike") + '">Bicicleta</button></div>';
}

/* ---------- plano de corrida (objetivo + frequência): o profissional define, o aluno vê a semana ---------- */
var RUN_UI_PLAN_TYPE = {easy: "Fácil", quality: "Qualidade", long: "Longão", race: "Prova"};
function runUiPlanDoneKm(rows, week){
  var end = runPlanAddDays(week.startDate, 6), m = 0;
  (rows || []).forEach(function(r){
    if (r.activity === "bike") return;
    var day = runUiIsoDay(r.startedAtMs);
    if (day >= week.startDate && day <= end) m += r.distM;
  });
  return m;
}
function runUiPlanHtml(sv, d){
  var built = runPlanBuild(trainingProgramOf(sv).runPlan);
  if (!built) return "";
  var cur = runPlanCurrent(built, runUiIsoDay(Date.now())), g = built.goal;
  var h = '<div class="card run-plan" id="runPlan"><div class="eyebrow">Plano · ' + escapeHtml(g.label) + '</div>';
  if (cur.state === "before") return h + '<p class="muted-p">O plano começa daqui a ' + plural(cur.daysToStart, "dia", "dias") + '.</p></div>';
  if (cur.state === "done") return h + '<p class="muted-p">O plano de ' + cur.weeks + ' semanas terminou. Fala com o teu profissional para o próximo.</p></div>';
  var raceLine = "";
  if (built.params.raceDate){
    var left = Math.round((Date.UTC(+built.params.raceDate.slice(0, 4), +built.params.raceDate.slice(5, 7) - 1, +built.params.raceDate.slice(8, 10)) - Date.UTC(+runUiIsoDay(Date.now()).slice(0, 4), +runUiIsoDay(Date.now()).slice(5, 7) - 1, +runUiIsoDay(Date.now()).slice(8, 10))) / 86400000);
    raceLine = '<p class="muted-p run-race">Prova a ' + escapeHtml(built.params.raceDate.split("-").reverse().join("/")) + (left > 0 ? ' · faltam ' + plural(left, "dia", "dias") : left === 0 ? ' · é hoje!' : '') + '</p>';
  }
  var w = cur.week, doneM = runUiPlanDoneKm((d && (d.weekRuns || d.runs)) || [], w), pct = Math.min(100, Math.round(doneM / (w.totalKm * 1000) * 100));
  h += '<h3 class="run-h">Semana ' + w.n + ' de ' + cur.weeks + ' · ' + escapeHtml(w.phase) + '</h3>' +
    raceLine + '<p class="muted-p">Previsto ' + escapeHtml(runUiNum1(w.totalKm)) + ' km · feito ' + escapeHtml(runUiKmNum(doneM)) + ' km</p>' +
    '<div class="run-plan-bar" role="img" aria-label="' + pct + '% do previsto"><i style="width:' + pct + '%"></i></div><ul class="run-plan-list">' +
    w.sessions.map(function(x){ return '<li><b>' + escapeHtml(RUN_UI_PLAN_TYPE[x.type] || "") + ' · ' + escapeHtml(runUiNum1(x.km)) + ' km</b><br><span class="muted-p">' + escapeHtml(x.desc) + '</span></li>'; }).join("") + '</ul>';
  return h + '<p class="muted-p run-note">Regras gerais por esforço (RPE), não ritmos. Se tens dores, para e fala com o teu profissional.</p></div>';
}
function runUiPlanForm(d, s){
  if (!d.planForm){
    var cur = runPlanNormalize(trainingProgramOf(s).runPlan);
    d.planForm = cur ? {goal: cur.goal, distanceKm: cur.distanceKm != null ? String(cur.distanceKm) : "8", raceDate: cur.raceDate || "", sessions: String(cur.sessions), weeks: String(cur.weeks), baseKm: String(cur.baseKm), startDate: cur.startDate} :
      {goal: "10k", distanceKm: "8", raceDate: "", sessions: "3", weeks: String(RUN_PLAN_GOALS["10k"].weeks), baseKm: "15", startDate: runUiIsoDay(Date.now())};
  }
  return d.planForm;
}
// pré-visualização desenhada com o DOM (createElement/textContent): o texto nunca passa por HTML
function runUiPlanPreviewInto(pv, f){
  if (!pv) return;
  while (pv.firstChild) pv.removeChild(pv.firstChild);
  var mk = function(tag, text, cls){ var e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
  var b = runPlanBuild(f);
  if (!b){ pv.appendChild(mk("p", "Preenche objetivo, sessões (2 a 5), semanas (6 a 20), km por semana (3 a 150) e a data de início.", "muted-p")); return; }
  if (b.params.raceDate) pv.appendChild(mk("p", "Prova a " + b.params.raceDate.split("-").reverse().join("/") + ": " + plural(b.params.weeks, "semana", "semanas") + " de preparação a partir de " + b.params.startDate.split("-").reverse().join("/") + ".", "muted-p run-note"));
  var wrap = mk("div", null, "assess-table-scroll"), table = mk("table", null, "assess-table"), head = mk("thead"), hr = mk("tr"), body = mk("tbody");
  ["Sem.", "Fase", "km"].forEach(function(t){ hr.appendChild(mk("th", t)); });
  head.appendChild(hr); table.appendChild(head);
  b.weeks.forEach(function(w){
    var tr = mk("tr");
    tr.appendChild(mk("td", String(w.n))); tr.appendChild(mk("td", w.phase)); tr.appendChild(mk("td", runUiNum1(w.totalKm)));
    body.appendChild(tr);
  });
  table.appendChild(body); wrap.appendChild(table); pv.appendChild(wrap);
  b.warnings.forEach(function(t){ pv.appendChild(mk("p", t, "muted-p run-note")); });
}
function runUiPlanProHtml(s, d){
  var f = runUiPlanForm(d, s), active = !!runPlanNormalize(trainingProgramOf(s).runPlan);
  return '<details class="card run-plan-pro" id="runPlanPro"' + (active ? ' open' : '') + '><summary class="eyebrow">Plano de corrida' + (active ? ' · ativo' : '') + '</summary>' +
    '<p class="muted-p">Regras gerais por objetivo e frequência (volume semanal, recuperação e afinação). O aluno vê a semana no separador Corrida.</p>' +
    '<div class="assess-form-grid"><div class="f" style="grid-column:1/-1;"><label for="rpGoal">Objetivo</label><select id="rpGoal" class="mini-select" style="width:100%;">' +
    Object.keys(RUN_PLAN_GOALS).map(function(k){ return '<option value="' + k + '"' + (k === f.goal ? ' selected' : '') + '>' + escapeHtml(k === "custom" ? "Outra distância…" : RUN_PLAN_GOALS[k].label) + '</option>'; }).join("") + '</select></div>' +
    '<div class="f"><label for="rpSessions">Sessões por semana</label><select id="rpSessions" class="mini-select">' + [2, 3, 4, 5].map(function(n){ return '<option value="' + n + '"' + (String(n) === f.sessions ? ' selected' : '') + '>' + n + '</option>'; }).join("") + '</select></div>' +
    '<div class="f' + (f.goal === "custom" ? '' : ' hidden') + '" id="rpDistBox"><label for="rpDist">Distância da prova (km)</label><input type="number" id="rpDist" min="1" max="100" step="0.1" value="' + escapeHtml(f.distanceKm) + '"></div>' +
    '<div class="f"><label for="rpRace">Data da prova (opcional)</label><input type="date" id="rpRace" value="' + escapeHtml(f.raceDate) + '"></div>' +
    '<div class="f"><label for="rpWeeks">Semanas' + (f.raceDate ? ' (pela prova)' : '') + '</label><input type="number" id="rpWeeks" min="6" max="20" value="' + escapeHtml(f.weeks) + '"' + (f.raceDate ? ' disabled' : '') + '></div>' +
    '<div class="f"><label for="rpBase">km por semana agora</label><input type="number" id="rpBase" min="3" max="150" step="0.5" value="' + escapeHtml(f.baseKm) + '"></div>' +
    '<div class="f"><label for="rpStart">Início</label><input type="date" id="rpStart" value="' + escapeHtml(f.startDate) + '"></div></div>' +
    '<div id="rpPreview"></div>' +
    '<div class="run-plan-actions"><button type="button" class="btn primary btn-sm" id="rpApply">' + (active ? 'Atualizar plano' : 'Aplicar plano') + '</button>' +
    (active ? '<button type="button" class="btn btn-sm" id="rpRemove">Remover plano</button>' : '') + '</div></details>';
}
function runUiPlanProWire(s, el, d){
  var box = el.querySelector("#runPlanPro");
  if (!box) return;
  var f = runUiPlanForm(d, s);
  runUiPlanPreviewInto(box.querySelector("#rpPreview"), f);
  function read(){ f.goal = box.querySelector("#rpGoal").value; f.distanceKm = box.querySelector("#rpDist").value; f.raceDate = box.querySelector("#rpRace").value; f.sessions = box.querySelector("#rpSessions").value; f.weeks = box.querySelector("#rpWeeks").value; f.baseKm = box.querySelector("#rpBase").value; f.startDate = box.querySelector("#rpStart").value; return f; }
  // «input» além de «change»: a pré-visualização muda enquanto se escreve, e não só ao sair do campo (senão tocar em «Aplicar» logo a seguir a escrever
  // mudava a altura da página entre o toque e o levantar do dedo, e o toque perdia-se)
  ["#rpGoal", "#rpDist", "#rpRace", "#rpSessions", "#rpWeeks", "#rpBase", "#rpStart"].forEach(function(sel){
    ["input", "change"].forEach(function(evt){
      box.querySelector(sel).addEventListener(evt, function(){
        var prevGoal = f.goal, nf = read();
        var gd = box.querySelector("#rpDistBox"), wk = box.querySelector("#rpWeeks"), dist = parseFloat(nf.distanceKm);
        if (gd) gd.classList.toggle("hidden", nf.goal !== "custom");
        wk.disabled = !!nf.raceDate;
        if ((sel === "#rpGoal" && nf.goal !== prevGoal) || (sel === "#rpDist" && nf.goal === "custom")){
          var prof = nf.goal === "custom" ? (dist >= 1 && dist <= 100 ? runPlanGoalOf({goal: "custom", distanceKm: dist}) : null) : RUN_PLAN_GOALS[nf.goal];
          if (prof){ nf.weeks = String(prof.weeks); wk.value = nf.weeks; }
        }
        runUiPlanPreviewInto(box.querySelector("#rpPreview"), nf);
      });
    });
  });
  runUiOn(box, "#rpApply", function(){
    var o = runPlanNormalize(read());
    if (!o){ showToast("Confirma os valores do plano"); return; }
    ensureTrainingProgram(s).runPlan = o;
    try { logPlanEvent(s, "treino_dia", "Plano de corrida definido", null, o.goal + " · " + o.sessions + " sessões · " + o.weeks + " semanas"); } catch (e) {}
    persistStudent(s); d.planForm = null; RUN.proTab(s, document.getElementById("proTabContent") || el); showToast("✓ Plano guardado: o aluno vê a semana na Corrida");
  });
  runUiOn(box, "#rpRemove", function(){
    var p = ensureTrainingProgram(s); delete p.runPlan; persistStudent(s); d.planForm = null; RUN.proTab(s, document.getElementById("proTabContent") || el); showToast("Plano removido");
  });
}

function runUiHomeHtml(sv){
  if (corridaModeOf(sv) === "off") return runUiOffHtml(sv);
  var d = runUiData, preview = authRole !== "student", live = sv.runsMode === "live" && typeof RUN.liveOpen === "function";
  var h = '<div class="tab-head run-head"><h2>Corrida</h2><p>' + escapeHtml(live ?
    "Grava a corrida aqui, com o GPS do telemóvel e a EVOLVE aberta, ou traz um ficheiro do relógio ou de outra app." :
    "A EVOLVE não usa o GPS do telemóvel: lê o ficheiro que trouxeres do relógio ou de outra app.") + '</p></div>';
  if (d.loaded && d.err === "missing") return h + runUiMissingHtml();
  if (!preview) h += runUiBannerHtml(sv);
  h += '<div class="card run-actions">';
  if (preview) h += '<p class="muted-p run-note" id="runPreviewNote">' + escapeHtml(RUN_UI_MSG.previewOnly) + '</p>';
  else {
    h += runUiActHtml() + '<button type="button" class="btn primary run-btn" id="runGoImport">Importar ficheiro (GPX ou TCX)</button>' +
      '<button type="button" class="btn run-btn" id="runGoManual">Registar à mão</button>';
    if (live){
      h += '<button type="button" class="btn run-btn" id="runGoLive">Gravar com GPS</button>' +
        '<p class="muted-p run-note" id="runLiveNote">Mantém a EVOLVE aberta e o ecrã ligado durante a corrida. Se o ecrã bloquear ou mudares de aplicação, o registo pode falhar e ficará uma lacuna no percurso. Ainda não testámos isto em todos os telemóveis.</p>';
    }
  }
  h += '</div>' + runUiPlanHtml(sv, d) + runUiListHtml(d, {weeks: true, empty: RUN_UI_MSG.empty});
  if (!preview) h += runUiGuideHtml();
  return h + '<div class="card run-priv">' + runUiPrivacyHtml(d, preview, false) + '</div>';
}

function runUiOn(el, sel, fn){
  var n = el.querySelector(sel);
  if (n) n.addEventListener("click", fn);
  return n;
}
function runUiWireHome(s, el){
  var d = runUiData, preview = authRole !== "student", off = corridaModeOf(s) === "off", redraw = function(){ runUiRedraw(s, "home"); };
  if (!d.loading && (!d.loaded || (Date.now() - d.loadedAt > RUN_UI_STALE_MS && d.raw <= RUN_UI_PAGE))) runUiLoad(d, s.id, false, redraw);   // quem já pediu mais páginas não vê a lista encolher
  runUiOn(el, "#runRetry", function(){ runUiInvalidate(d); d.err = ""; RUN.go("home"); });
  runUiOn(el, "#runMore", function(){ runUiLoad(d, s.id, true, redraw); redraw(); });
  el.querySelectorAll("[data-run]").forEach(function(b){
    b.addEventListener("click", function(){
      var id = b.getAttribute("data-run"), t = d.tracks[id];
      if (t && t.state === "err") delete d.tracks[id];
      RUN.go("detail", {id: id});
    });
  });
  runUiOn(el, "#runOffBack", function(){ RUN.dataMode = false; RUN.go("home"); });   // volta ao cartão «A Corrida ainda não está ativa para ti» (app.js)
  if (preview) return;
  runUiOn(el, "#runActRun", function(){ RUN.activity = "run"; RUN.go("home"); });
  runUiOn(el, "#runActBike", function(){ RUN.activity = "bike"; RUN.go("home"); });
  if (!off){   // com a Corrida desligada só se vê e apaga
    runUiOn(el, "#runGoImport", function(){ RUN.ensureConsent(s, function(){ RUN.go("import"); }); });
    runUiOn(el, "#runGoManual", function(){ RUN.ensureConsent(s, function(){ RUN.go("manual"); }); });
    runUiOn(el, "#runGoLive", function(){ RUN.ensureConsent(s, function(){ if (typeof RUN.liveOpen === "function") RUN.liveOpen(s); }); });
  }
  runUiOn(el, "#runDelAll", function(){
    var extra = runUiQueueCount() > 0 ? " Também apaga as corridas por enviar que estão neste telemóvel." : "";
    runUiDelete({ask: "Apagar todas as tuas corridas? Não dá para desfazer." + extra, allowEmpty: true, ok: "Corridas apagadas.",
      make: function(db){ return db.from("runs").delete().eq("student_id", s.id).select("id"); },
      after: function(){
        runUiQueueClear(s.id);   // uma corrida por enviar não pode voltar ao servidor depois de o aluno ter apagado tudo
        runUiData = runUiNewData(s.id, runUiUid()); RUN.go("home");
      }});
  });
  runUiOn(el, "#runWithdraw", function(){
    var extra = runPendingCount() > 0 ? " Também apaga a gravação por terminar e as corridas por enviar que estão neste telemóvel." : "";
    runUiDelete({ask: "Retirar o consentimento apaga todas as tuas corridas e percursos. Não dá para desfazer." + extra, allowEmpty: true, ok: "Consentimento retirado. As tuas corridas foram apagadas.",
      make: function(db){ return db.from("run_consents").delete().eq("student_id", s.id).select("student_id"); },
      after: function(){
        runUiConsentFor = "";
        runUiReceiptClear(s.id);
        runUiQueueClear(s.id);
        runUiData = runUiNewData(s.id, runUiUid());
        if (typeof RUN.reset === "function"){ try { RUN.reset(); } catch (e) {} }
        runWipeLocal();
        RUN.v = {name: "home"};
        RUN.go("home");
      }});
  });
  if (typeof RUN.liveWireBanner === "function"){ try { RUN.liveWireBanner(s, el); } catch (e2) {} }
}

// apagar com confirmação, só com ligação, e só dá por feito se o servidor disser que apagou (ou não havia nada)
function runUiDelete(o){
  if (!runUiOnline()){ showToast(RUN_UI_MSG.offDelete); return; }
  if (!runUiAsk(o.ask)) return;
  runUiCall(o.make).then(function(res){
    var none = Array.isArray(res.data) && !res.data.length;
    if (res.error || (none && !o.allowEmpty)){
      showToast(runUiKind(res) === "net" ? RUN_UI_MSG.offDelete : "Não foi possível apagar. Tenta outra vez.");
      return;
    }
    showToast(o.ok);
    o.after();
  });
}

/* ---------- consentimento ---------- */
// O recibo local (o gravador guarda-o: RUN.consentCacheGet/Set/Clear) só serve para COMEÇAR sem rede, ao ar livre: lê-se quando a leitura no servidor
// falha por rede. Quando o servidor responde, ele decide e o recibo acompanha (Set se aceitou, Clear se não); e o servidor continua a recusar o insert
// de uma corrida sem consentimento válido (RLS/FK). Sem as funções (gravador por carregar) não há recibo e tudo fica como antes.
function runUiReceiptGet(sid){
  try { if (typeof RUN.consentCacheGet === "function"){ var v = RUN.consentCacheGet(sid); return typeof v === "number" && isFinite(v) ? v : null; } } catch (e) {}
  return null;
}
function runUiReceiptSet(sid, version){ try { if (typeof RUN.consentCacheSet === "function") RUN.consentCacheSet(sid, version); } catch (e) {} }
function runUiReceiptClear(sid){ try { if (typeof RUN.consentCacheClear === "function") RUN.consentCacheClear(sid); } catch (e) {} }
// o servidor disse que o consentimento (ou a Corrida) já não vale: esquece-se o que se sabia
function runUiConsentLost(sid){ runUiConsentFor = ""; runUiReceiptClear(sid); }
// fila de envio do gravador: quantas entradas (por enviar ou recusadas) e apagá-las todas
function runUiQueueCount(){
  var n = 0;
  try {
    if (typeof RUN.queuePending === "function") n += Number(RUN.queuePending()) || 0;
    if (typeof RUN.queueFailed === "function") n += Number(RUN.queueFailed()) || 0;
  } catch (e) { n = 0; }
  return n;
}
function runUiQueueClear(sid){ try { if (typeof RUN.queueClear === "function") RUN.queueClear(sid); } catch (e) {} }
function runUiConsentRead(s){
  var v = RUN.consentVersion(), known = runUiConsentFor === s.id || runUiReceiptGet(s.id) === v;
  return runUiCall(function(db){ return db.from("run_consents").select("version").eq("student_id", s.id); }, known ? RUN_UI_QUICK_MS : 0).then(function(res){
    if (res.error){
      var k = runUiKind(res);
      if (k === "net" && known) return {ok: true, accepted: true};
      return {ok: false, kind: k};
    }
    var yes = runUiRows(res).some(function(r){ return r && Number(r.version) === v; });
    runUiConsentFor = yes ? s.id : "";
    if (yes) runUiReceiptSet(s.id, v); else runUiReceiptClear(s.id);
    return {ok: true, accepted: yes};
  });
}
function runUiConsentHtml(){
  return '<div class="card run-consent" id="runConsent"><div class="eyebrow">Corrida</div><h3 class="run-h">Corridas: antes de começares</h3>' + runUiNoticeHtml("") +
    '<p class="run-err" id="runCsErr" role="alert"></p>' +
    '<button type="button" class="btn primary run-btn" id="runCsAccept">Aceito e continuar</button>' +
    '<button type="button" class="btn run-btn" id="runCsDecline">Agora não</button></div>';
}
function runUiWireConsent(s, el){
  var v = RUN.v;
  var leave = function(){ RUN.go(v.back && v.back !== "consent" ? v.back : "home"); };
  runUiOn(el, "#runCsDecline", leave);
  runUiOn(el, "#runCsAccept", function(){
    if (v.busy) return;
    v.busy = true;
    var btn = el.querySelector("#runCsAccept"), err = el.querySelector("#runCsErr");
    if (btn){ btn.disabled = true; btn.textContent = "A guardar…"; }
    runUiCall(function(db){ return db.from("run_consents").insert({student_id: s.id, version: RUN.consentVersion()}); }).then(function(res){
      v.busy = false;
      var k = runUiKind(res);
      if (k && k !== "dup"){
        if (btn){ btn.disabled = false; btn.textContent = "Aceito e continuar"; }
        var e2 = document.getElementById("runCsErr") || err;
        if (e2) e2.textContent = k === "net" ? "Sem ligação. Tenta outra vez." : k === "missing" ? RUN_UI_MSG.missing : "Não foi possível registar o consentimento. Tenta outra vez.";
        return;
      }
      runUiConsentFor = s.id;
      runUiReceiptSet(s.id, RUN.consentVersion());
      var cb = v.cb, back = v.back && v.back !== "consent" ? v.back : "home", seq = runUiGoSeq;
      RUN.v = {name: back};
      try { if (typeof cb === "function") cb(); } catch (e) {}
      if (runUiGoSeq === seq) RUN.go(back);   // quem chamou não mudou de vista: sai-se do aviso para onde se estava
    });
  });
}
RUN.consentVersion = function(){ return 1; };
RUN.ensureConsent = function(s, cb){
  try {
    if (!s || authRole !== "student" || typeof cb !== "function" || runUiConsentBusy) return;
    runUiSync(s.id);
    runUiConsentBusy = true;
    runUiConsentRead(s).then(function(r){
      runUiConsentBusy = false;
      if (!r.ok){
        showToast(r.kind === "missing" ? RUN_UI_MSG.missing : r.kind === "net" ? "Sem ligação. Não consegui verificar o teu consentimento: tenta outra vez com ligação." : "Não foi possível verificar o teu consentimento. Tenta outra vez.");
        return;
      }
      if (r.accepted){ try { cb(); } catch (e) {} return; }
      RUN.go("consent", {cb: cb, back: RUN.v && RUN.v.name && RUN.v.name !== "consent" ? RUN.v.name : "home"});
    });
  } catch (e) { runUiConsentBusy = false; }
};

/* ---------- guardar na BD (a corrida e, se o aluno quis partilhar, o percurso) ---------- */
function runUiInsertRun(row){
  return runUiCall(function(db){ return db.from("runs").insert(row); }).then(function(res){
    var k = runUiKind(res);
    if (!k) return {ok: true};
    if (k !== "dup") return {ok: false, kind: k, actCol: runUiActColErr(res)};
    // já tinha chegado (reenvio): confirma que está lá
    return runUiCall(function(db){ return db.from("runs").select("id").eq("id", row.id).maybeSingle(); }).then(function(r2){
      return !r2.error && r2.data ? {ok: true} : {ok: false, kind: r2.error ? runUiKind(r2) : "other"};
    });
  });
}
function runUiInsertTrack(row, track){
  var rec = {run_id: row.id, student_id: row.student_id, fmt: 1, trim_m: track.trimM, points: track.segments};
  return runUiCall(function(db){ return db.from("run_tracks").insert(rec); }).then(function(res){
    var k = runUiKind(res);
    return !k || k === "dup" ? {ok: true} : {ok: false, kind: k};
  });
}
function runUiQueueOr(item, fallback){
  if (typeof RUN.queueAdd !== "function") return fallback;
  var ok = false;
  try { ok = RUN.queueAdd(item) !== false; } catch (e) { ok = false; }
  return ok ? {ok: true, queued: true} : fallback;
}
function runUiRunMsg(kind, sid){
  if (kind === "missing") return RUN_UI_MSG.missing;
  if (kind === "rls"){ runUiConsentLost(sid); return RUN_UI_MSG.rls; }
  if (kind === "consent"){ runUiConsentLost(sid); return RUN_UI_MSG.consent; }
  if (kind === "check") return RUN_UI_MSG.check;
  return RUN_UI_MSG.generic;
}
RUN.submitRun = function(s, item){
  try {
    if (!s || !item || !item.row || typeof item.row !== "object") return Promise.resolve({ok: false, error: "Corrida inválida.", permanent: true});
    var row = item.row, track = item.track || null;
    if (row.student_id !== s.id) return Promise.resolve({ok: false, error: "Corrida inválida.", permanent: true});
    return runUiInsertRun(row).then(function(r1){
      if (!r1.ok){
        if (r1.kind === "net") return runUiQueueOr(item, {ok: false, error: RUN_UI_MSG.net, permanent: false});
        if (row.activity === "bike" && r1.actCol) return {ok: false, error: "A bicicleta ainda não está ativa neste servidor: falta correr a migração 0033 no Supabase.", permanent: true};
        return {ok: false, error: runUiRunMsg(r1.kind, s.id), permanent: true};
      }
      if (!track || !Array.isArray(track.segments)) return {ok: true, queued: false};
      return runUiInsertTrack(row, track).then(function(r2){
        if (r2.ok) return {ok: true, queued: false};
        // a corrida entrou e o percurso não: com ligação em baixo vai para a fila (o envio tolera a corrida já existir); senão avisa-se
        var q = r2.kind === "net" ? runUiQueueOr(item, null) : null;
        return q || {ok: true, queued: false, trackFailed: true, error: RUN_UI_MSG.trackLost};
      });
    }).then(function(r){ return r; }, function(){ return {ok: false, error: RUN_UI_MSG.generic, permanent: false}; });
  } catch (e) {
    return Promise.resolve({ok: false, error: RUN_UI_MSG.generic, permanent: false});
  }
};
RUN.flush = function(){ return Promise.resolve(); };

/* ---------- exportar GPX (só para o aluno; o ficheiro nunca passa por nenhum servidor) ---------- */
function runUiSaveBlob(blob, name){
  var url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = name; a.style.display = "none";
  document.body.appendChild(a); a.click();
  setTimeout(function(){ try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch (e) {} }, 4000);
}
function runUiDownload(name, text){
  try {
    var blob = new Blob([text], {type: "application/gpx+xml"}), file = null;
    try { file = new File([blob], name, {type: "application/gpx+xml"}); } catch (e) { file = null; }
    if (file && navigator.canShare && navigator.share){
      var can = false;
      try { can = navigator.canShare({files: [file]}); } catch (e2) { can = false; }
      if (can){
        navigator.share({files: [file]}).then(null, function(err){ if (!err || err.name !== "AbortError") runUiSaveBlob(blob, name); });
        return;
      }
    }
    runUiSaveBlob(blob, name);
  } catch (e3) { showToast("Não foi possível exportar o ficheiro."); }
}
function runUiExport(startedAtMs, segments){
  var gpx = runToGpx({startedAtMs: startedAtMs}, segments);
  if (!gpx){ showToast("Não há percurso para exportar."); return; }
  runUiDownload("corrida-" + runUiIsoDay(startedAtMs) + ".gpx", gpx);
}

/* ---------- vista «import» ---------- */
function runUiImportHtml(){
  return '<div class="card run-form" id="runImport"><button type="button" class="btn btn-sm run-back" id="runBack">← Corridas</button>' +
    '<h3 class="run-h">Importar ficheiro</h3>' +
    '<p class="muted-p">Escolhe o ficheiro. Aceitamos .gpx e .tcx. O ficheiro fica no teu telemóvel: só é lido aqui.</p>' +
    '<label class="btn-file run-file" for="runFile">Escolher ficheiro<input type="file" id="runFile" style="display:none;"></label>' +
    '<p class="run-msg" id="runImpMsg" role="status" aria-live="polite"></p></div>' + runUiGuideHtml();
}
function runUiSetMsg(id, text, kind){
  var m = document.getElementById(id);
  if (!m) return;
  m.textContent = text;
  m.className = "run-msg" + (kind ? " " + kind : "");
}
function runUiReadText(file){
  if (typeof file.text === "function") return file.text();
  return new Promise(function(resolve, reject){
    var fr = new FileReader();
    fr.onload = function(){ resolve(String(fr.result || "")); };
    fr.onerror = function(){ reject(new Error("leitura")); };
    fr.readAsText(file);
  });
}
// ficheiro -> números. O nome e o conteúdo não ficam em lado nenhum; os pontos só vivem em memória até ao fim do ecrã de confirmação
function runUiImportFile(s, file, input){
  var v = RUN.v, name = typeof file.name === "string" ? file.name : "";
  var fail = function(text){ if (input) input.value = ""; runUiSetMsg("runImpMsg", text, "run-err"); };
  runUiSetMsg("runImpMsg", "A processar…", "");
  if (typeof file.size === "number" && file.size > RUN_CFG.maxFileBytes){ fail(RUN_MSG.toobig); return; }
  runUiReadText(file).then(function(text){
    if (input) input.value = "";
    if (RUN.v !== v) return;
    var act = runUiAct(), acfg = runActivityCfg(act);
    var r = runParseFile(name, text, act === "bike" ? {cfg: acfg} : null);
    if (!r.ok){ runUiSetMsg("runImpMsg", r.error, "run-err"); return; }
    var stats = runStats(r.segments, act === "bike" ? acfg : null, "import");
    if (!stats || stats.startedAtMs == null || stats.distM < 100 || stats.durationS < 30){ runUiSetMsg("runImpMsg", "Quase não há deslocação neste ficheiro (menos de 100 m ou 30 s).", "run-err"); return; }
    if (stats.distM > RUN_CFG.maxDistM){ runUiSetMsg("runImpMsg", "Esta corrida passa dos 300 km e não pode ser guardada.", "run-err"); return; }
    if (stats.distM > acfg.maxAvgSpeedMs * stats.durationS){ runUiSetMsg("runImpMsg", "A velocidade média é impossível para " + (act === "bike" ? "bicicleta" : "corrida") + ". Confirma o ficheiro.", "run-err"); return; }
    RUN.saveFlow(s, {activity: act, source: r.source, stats: stats, segments: r.segments, hiddenS: 0, warnings: r.warnings || [], fileDistM: (typeof r.declaredDistM === "number" && isFinite(r.declaredDistM) ? r.declaredDistM : null), startedAtMs: stats.startedAtMs, cancelView: {name: "import"}});
  }, function(){ fail(RUN_MSG.unreadable); });
}
function runUiWireImport(s, el){
  runUiOn(el, "#runBack", function(){ RUN.go("home"); });
  var input = el.querySelector("#runFile");
  if (input) input.addEventListener("change", function(){
    var f = input.files && input.files[0];
    if (f) runUiImportFile(s, f, input);
  });
}

/* ---------- vista «manual» ---------- */
function runUiManualHtml(){
  var f = RUN.v.form;
  return '<div class="card run-form" id="runManual"><button type="button" class="btn btn-sm run-back" id="runBack">← Corridas</button>' +
    '<h3 class="run-h">Registar à mão</h3><p class="muted-p">Para o tapete rolante, para corridas gravadas na app Fitness da Apple ou quando o GPS falhou.</p>' +
    '<div class="run-field run-quick"><label for="runManLine">Tudo numa linha (opcional)</label>' +
    '<textarea id="runManLine" rows="2" autocomplete="off" autocapitalize="off" maxlength="4000" placeholder="5,2 km 28:30  ·  ontem 18:30 5,23 km 27:58"></textarea>' +
    '<p class="muted-p run-note" id="runManFitHint">App Fitness da Apple: abre o treino, faz uma captura, abre-a em Fotografias, toca no ícone de Texto em Direto (canto inferior), «Copiar tudo» e cola aqui. Não testado em todos os iPhones: confirma sempre os números antes de guardar.</p>' +
    '<button type="button" class="btn btn-sm run-quick-btn" id="runManFill">Preencher</button>' +
    '<p class="muted-p run-note">Copia a distância e o tempo da app Fitness e escreve-os aqui. Também aceita «hoje», «ontem», «22/10 às 20:17» e «1h05».</p></div>' +
    '<div class="run-field"><label for="runManDate">Data</label><input type="date" id="runManDate" data-f="date" min="2000-01-01" max="' + escapeHtml(localTodayISO()) + '" value="' + escapeHtml(f.date) + '"></div>' +
    '<div class="run-field"><label for="runManTime">Hora de início (opcional)</label><input type="time" id="runManTime" data-f="time" value="' + escapeHtml(f.time) + '"></div>' +
    '<div class="run-field"><label for="runManKm">Distância (km)</label><input type="text" inputmode="decimal" autocomplete="off" id="runManKm" data-f="km" placeholder="5,2" value="' + escapeHtml(f.km) + '"></div>' +
    '<div class="run-field"><label for="runManDur">Tempo (h:mm:ss ou mm:ss)</label><input type="text" inputmode="text" autocomplete="off" id="runManDur" data-f="dur" placeholder="32:15" value="' + escapeHtml(f.dur) + '"></div>' +
    '<p class="run-err" id="runManErr" role="alert"></p>' +
    '<button type="button" class="btn primary run-btn" id="runManNext">Continuar</button></div>';
}
function runUiBindFields(el, form){
  el.querySelectorAll("[data-f]").forEach(function(inp){
    var key = inp.getAttribute("data-f");
    var upd = function(){
      if (inp.type === "checkbox") form[key] = inp.checked;
      else if (inp.type === "radio"){ if (inp.checked) form[key] = inp.value; }
      else form[key] = inp.value;
    };
    inp.addEventListener("input", upd);
    inp.addEventListener("change", upd);
  });
}
function runUiManualCheck(f){
  var errs = [], m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(f.date || "")), t = /^(\d{2}):(\d{2})$/.exec(String(f.time || ""));
  var startMs = NaN, noTime = !f.time, now = Date.now();
  if (!m || f.date < "2000-01-01") errs.push("Indica a data da corrida.");
  else if (f.date > localTodayISO()) errs.push("A data não pode ser no futuro.");
  else if (f.time && !t) errs.push("Indica a hora no formato hh:mm ou deixa-a vazia.");
  else {
    var dt = new Date(+m[1], +m[2] - 1, +m[3], t ? +t[1] : 12, t ? +t[2] : 0, 0, 0);
    startMs = dt.getTime();
    if (!isFinite(startMs) || dt.getMonth() !== +m[2] - 1 || dt.getDate() !== +m[3] || (t && (+t[1] > 23 || +t[2] > 59))) { startMs = NaN; errs.push("Indica a data da corrida."); }
    else if (t && startMs > now) { startMs = NaN; errs.push("A data não pode ser no futuro."); }
  }
  var km = runParseKm(f.km), dur = runParseDuration(f.dur);
  if (!isFinite(km) || km < 100) errs.push("Indica uma distância entre 0,1 e 300 km.");
  if (!isFinite(dur)) errs.push("Indica o tempo, por exemplo 32:15 ou 1:05:30.");
  if (isFinite(km) && isFinite(dur) && km >= 100 && km > runActivityCfg(runUiAct()).maxAvgSpeedMs * dur) errs.push("Esta combinação dá uma velocidade impossível. Confirma a distância e o tempo.");
  if (!errs.length && noTime && startMs > now) startMs = now - dur * 1000;   // hora vazia (12:00) ainda no futuro: foi agora mesmo
  return {errs: errs, startMs: startMs, distM: km, durS: dur, noTime: noTime};
}
function runUiWireManual(s, el){
  var v = RUN.v;
  runUiBindFields(el, v.form);
  runUiOn(el, "#runBack", function(){ RUN.go("home"); });
  runUiOn(el, "#runManFill", function(){
    var line = document.getElementById("runManLine"), box = document.getElementById("runManErr");
    var q = runParseQuick(line ? line.value : "");
    if (!q.ok){ if (box) box.textContent = q.error; return; }
    if (box) box.textContent = "";
    if (q.date) v.form.date = q.date;
    v.form.time = q.time || "";
    v.form.km = (q.distM / 1000).toFixed(2).replace(".", ",");
    v.form.dur = runDurStr(q.durS);
    [["runManDate", "date"], ["runManTime", "time"], ["runManKm", "km"], ["runManDur", "dur"]].forEach(function(p){
      var inp = document.getElementById(p[0]); if (inp) inp.value = v.form[p[1]];
    });
  });
  runUiOn(el, "#runManNext", function(){
    var c = runUiManualCheck(v.form), box = document.getElementById("runManErr");
    if (c.errs.length){ if (box) box.textContent = c.errs.join(" "); return; }
    if (box) box.textContent = "";
    RUN.saveFlow(s, {activity: runUiAct(), source: "manual", stats: runManualStats(c.startMs, c.distM, c.durS), segments: [], hiddenS: 0, warnings: [], fileDistM: null,
      startedAtMs: c.startMs, noTime: c.noTime, cancelView: {name: "manual", params: {form: v.form}}});
  });
}

/* ---------- ecrã «Confirma antes de guardar» ---------- */
function runUiHasTrack(prep){
  var i;
  if (!prep || !Array.isArray(prep.segments)) return false;
  for (i = 0; i < prep.segments.length; i++) if (Array.isArray(prep.segments[i]) && prep.segments[i].length > 1) return true;
  return false;
}
function runUiDupOf(prep){
  var st = prep.stats, start = prep.startedAtMs != null ? prep.startedAtMs : st.startedAtMs;
  return runDupCheck(runUiData.runs, {startedAtMs: start, distM: st.distM});
}
function runUiPrepWarnings(prep){
  var out = (prep.warnings || []).filter(function(w){ return typeof w === "string" && w; }), st = prep.stats;
  if (typeof prep.fileDistM === "number" && isFinite(prep.fileDistM) && prep.fileDistM > 0 && st.distM > 0 && Math.abs(prep.fileDistM - st.distM) / prep.fileDistM > 0.02){
    out.push("A app de origem indicava " + runUiKmNum(prep.fileDistM) + " km; a EVOLVE calculou " + runUiKmNum(st.distM) + " km. Pode diferir uns por cento.");
  }
  var pc = prep.activity === "bike" ? {ask: false} : runPaceCheck(st.distM, st.movingS, st.durationS);
  if (pc.ask) out.push(runUiPaceMsg(pc));
  return out;
}
function runUiPaceMsg(pc){
  return "Ritmo de " + runPaceStr(pc.paceSPerKm) + "/km (" + runUiNum1(pc.kmh) + " km/h): muito rápido para uma corrida. Se foi de carro, bicicleta ou transportes, não guardes como corrida.";
}
function runUiSaveHtml(sv){
  var v = RUN.v, f = v.form;
  if (v.saved){
    return '<div class="card run-form" id="runSaved"><div class="eyebrow">Corrida</div><h3 class="run-h">' + escapeHtml(RUN_UI_MSG.saved) + '</h3>' +
      '<p class="muted-p" id="runTrackLost">' + escapeHtml(RUN_UI_MSG.trackLost) + '</p><p class="run-err" id="runSvErr" role="alert"></p>' +
      '<button type="button" class="btn primary run-btn" id="runSvRetryTrack">Guardar o percurso</button>' +
      '<button type="button" class="btn run-btn" id="runSvSkipTrack">Continuar sem percurso</button></div>';
  }
  var prep = v.prep, st = prep.stats, start = prep.startedAtMs != null ? prep.startedAtMs : st.startedAtMs, hasTrack = runUiHasTrack(prep);
  var dl = function(k, val){ return '<div><dt>' + escapeHtml(k) + '</dt><dd class="num">' + escapeHtml(val) + '</dd></div>'; };
  var sum = dl("Data", runUiDateStr(start)) + (prep.noTime ? "" : dl("Hora de início", runUiTimeStr(start))) + dl("Distância", runDistStr(st.distM)) + dl("Tempo", runDurStr(st.durationS));
  if (st.movingS && st.movingS < st.durationS) sum += dl("Tempo em movimento", runDurStr(st.movingS));
  var pace = runPaceStr(runPaceOf(st.distM, st.movingS)), kmh = runSpeedKmh(st.distM, st.movingS);
  if (prep.activity === "bike"){ if (kmh) sum += dl("Velocidade média em movimento", runUiNum1(kmh) + " km/h"); }
  else if (pace !== "–") sum += dl("Ritmo em movimento", pace + "/km");
  if (prep.activity === "bike") sum = dl("Atividade", "Bicicleta") + sum;
  sum += dl("Origem", RUN_UI_SRC[prep.source] || "");
  var h = '<div class="card run-form" id="runSave"><div class="eyebrow">Corrida</div><h3 class="run-h">Confirma antes de guardar</h3><dl class="run-sum">' + sum + '</dl>';
  if (st.gaps) h += '<p class="muted-p run-gaps">Lacunas: ' + st.gaps + ' (' + escapeHtml(runDurStr(st.gapS)) + ' sem posições; não contam para a distância)</p>';
  if (st.splitsS && st.splitsS.length) h += '<div class="eyebrow">Parciais por quilómetro</div>' + runUiSplitsHtml(st.splitsS);
  if (hasTrack){
    if (v.svg === undefined){   // pré-visualização simplificada (um ficheiro grande teria dezenas de milhares de pontos para desenhar)
      var pv = runPrepareTrack(prep.segments, {trimM: 0});
      v.svg = pv ? runTrackSvg(pv.segments, {width: 320, height: 220}) : "";
      v.mapSegs = pv ? pv.segments : null;
    }
    if (v.svg) h += '<div class="run-svg-wrap">' + v.svg + '</div>' + runUiMapBlock(v.mapSegs, false);
  }
  var warns = runUiPrepWarnings(prep);
  h += '<ul class="run-warns" id="runSvWarns">' + warns.map(function(w){ return '<li>' + escapeHtml(w) + '</li>'; }).join("") + '</ul>';
  h += '<p class="run-warn' + (runUiDupOf(prep) ? '' : ' hidden') + '" id="runSvDup" role="alert">Já tens uma corrida parecida neste momento (mesma hora e distância).</p>';
  if (prep.source !== "manual") h += '<p class="muted-p run-note">A distância é calculada pela EVOLVE a partir dos pontos e pode diferir uns por cento da app de origem.</p>';
  if (hasTrack){
    var trim = parseInt(f.trim, 10);
    h += '<div class="run-share"><label class="run-check"><input type="checkbox" id="runSvShare" data-f="share"' + (f.share ? ' checked' : '') + '><span>Partilhar o percurso com o meu profissional</span></label>' +
      '<p class="muted-p run-note">Se não partilhares, o percurso apaga-se deste telemóvel ao guardar: ficam só os números. Exporta o GPX antes se o quiseres guardar.</p>' +
      '<div id="runSvShareOpts"' + (f.share ? '' : ' class="hidden"') + '><div class="eyebrow">Esconder o início e o fim do percurso</div><div class="run-opts" role="radiogroup" aria-label="Esconder o início e o fim do percurso">' +
      RUN_UI_TRIMS.map(function(m){
        return '<label class="run-opt"><input type="radio" name="runSvTrim" data-f="trim" value="' + m + '"' + (trim === m ? ' checked' : '') + '><span>' + (m === 0 ? "Não esconder" : m + " m" + (m === 200 ? " (recomendado)" : "")) + '</span></label>';
      }).join("") + '</div><p class="run-warn' + (trim === 0 ? '' : ' hidden') + '" id="runSvTrim0">O profissional vai ver exatamente onde começaste e acabaste.</p>' +
      '<p class="muted-p run-note">Os primeiros e últimos metros costumam estar perto de onde moras ou trabalhas. Isto reduz o risco, mas não o elimina. O que escolhes é o mínimo: a EVOLVE esconde um pouco mais, ao acaso. A distância e o tempo guardados são os da corrida inteira.</p></div></div>';
  }
  h += '<div class="run-field"><label for="runSvRpe">Esforço (1 a 10)</label><select id="runSvRpe" data-f="rpe"><option value="">–</option>';
  for (var i = 1; i <= 10; i++) h += '<option value="' + i + '"' + (String(f.rpe) === String(i) ? ' selected' : '') + '>' + i + '</option>';
  h += '</select></div><div class="run-field"><label for="runSvNotes">Notas (opcional, até 300 caracteres; não escrevas moradas)</label>' +
    '<textarea id="runSvNotes" data-f="notes" rows="3" maxlength="300">' + escapeHtml(f.notes) + '</textarea></div>';
  if (hasTrack) h += '<button type="button" class="btn run-btn" id="runSvExport">Exportar GPX (percurso completo, só para ti)</button>';
  h += '<p class="run-err" id="runSvErr" role="alert"></p>' +
    '<button type="button" class="btn primary run-btn" id="runSvSave"' + (v.saving ? ' disabled' : '') + '>' + (v.saving ? 'A guardar…' : 'Guardar corrida') + '</button>' +
    '<button type="button" class="btn run-btn" id="runSvCancel"' + (v.saving ? ' disabled' : '') + '>Cancelar</button></div>';
  return h;
}
function runUiSaveErr(text){
  var e = document.getElementById("runSvErr");
  if (e) e.textContent = text;
}
function runUiSaveBusy(on){
  var b = document.getElementById("runSvSave"), c = document.getElementById("runSvCancel");
  if (b){ b.disabled = on; b.textContent = on ? "A guardar…" : "Guardar corrida"; }
  if (c) c.disabled = on;
}
function runUiLeaveSave(v){
  var prep = v.prep;
  if (v.saved){ v.saved = null; }
  if (prep && typeof prep.onCancel === "function"){ v.prep = null; try { prep.onCancel(); } catch (e) {} return; }
  var to = prep && prep.cancelView && typeof prep.cancelView.name === "string" ? prep.cancelView : {name: "home"};
  v.prep = null;
  RUN.go(to.name, to.params);
}
function runUiSaveClick(s){
  var v = RUN.v, prep = v.prep, f = v.form;
  if (!prep || v.saving) return;
  var st = prep.stats, start = prep.startedAtMs != null ? prep.startedAtMs : st.startedAtMs, rpe = parseInt(f.rpe, 10);
  if (!v.runId) v.runId = runUuid();
  var run = {id: v.runId, studentId: s.id, source: prep.source, startedAtMs: start, durationS: st.durationS, movingS: st.movingS, distM: st.distM,
    gaps: st.gaps, gapS: st.gapS, splitsS: st.splitsS, activity: prep.activity === "bike" ? "bike" : "run", hiddenS: prep.hiddenS || 0, rpe: rpe >= 1 && rpe <= 10 ? rpe : null, notes: String(f.notes || ""), consentV: RUN.consentVersion()};
  var chk = runCheckRun(run, Date.now()), row = chk.ok ? runBuildInsert(run, Date.now()) : null;
  if (!row){ runUiSaveErr(chk.error || "Não foi possível preparar esta corrida."); return; }
  if (runUiDupOf(prep) && !runUiAsk(RUN_UI_MSG.dupAsk)) return;
  var pc = run.activity === "bike" ? {ask: false} : runPaceCheck(st.distM, st.movingS, st.durationS);
  if (pc.ask && !runUiAsk(runUiPaceMsg(pc) + " Guardar mesmo assim?")) return;
  var item = {row: row, track: null}, shortMsg = "";
  if (f.share === true && runUiHasTrack(prep)){
    var tr = runPrepareTrack(prep.segments, {trimM: parseInt(f.trim, 10), rnd: Math.random()});   // o raio escondido é o escolhido mais uma folga ao acaso (até 50 %)
    if (tr) item.track = {segments: tr.segments, trimM: tr.trimM};
    else shortMsg = RUN_UI_MSG.shortTrack;   // curto demais para aparar: só os números
  }
  v.saving = true; runUiSaveErr(""); runUiSaveBusy(true);
  RUN.submitRun(s, item).then(function(res){
    v.saving = false;
    if (!res || !res.ok){
      runUiSaveBusy(false);
      runUiSaveErr(res && res.error ? res.error : RUN_UI_MSG.generic);
      return;
    }
    runUiInvalidate(runUiData);   // a lista lê-se outra vez
    try { if (typeof prep.onSaved === "function") prep.onSaved(res); } catch (e1) {}
    try { if (typeof prep.onDone === "function") prep.onDone(res); } catch (e2) {}
    if (res.trackFailed){
      v.prep = null; v.saved = {row: row, track: item.track};
      if (RUN.v === v) runUiRedraw(s, "save");
      return;
    }
    v.prep = null;
    showToast((res.queued ? RUN_UI_MSG.queued : RUN_UI_MSG.saved) + (shortMsg ? " " + shortMsg : ""));
    if (RUN.v === v) RUN.go("home");
  });
}
function runUiWireSave(s, el){
  var v = RUN.v;
  if (v.saved){
    runUiOn(el, "#runSvSkipTrack", function(){ v.saved = null; RUN.go("home"); });
    runUiOn(el, "#runSvRetryTrack", function(){
      var b = document.getElementById("runSvRetryTrack");
      if (b) b.disabled = true;
      runUiInsertTrack(v.saved.row, v.saved.track).then(function(r){
        if (!r.ok){ if (b) b.disabled = false; runUiSaveErr(r.kind === "net" ? RUN_UI_MSG.net : "Não foi possível guardar o percurso."); return; }
        v.saved = null; showToast("Percurso guardado."); RUN.go("home");
      });
    });
    return;
  }
  var prep = v.prep;
  runUiBindFields(el, v.form);
  var share = el.querySelector("#runSvShare"), opts = el.querySelector("#runSvShareOpts"), z = el.querySelector("#runSvTrim0");
  if (share && opts) share.addEventListener("change", function(){ opts.classList.toggle("hidden", !share.checked); });
  el.querySelectorAll('input[name="runSvTrim"]').forEach(function(r){
    r.addEventListener("change", function(){ if (z) z.classList.toggle("hidden", parseInt(v.form.trim, 10) !== 0); });
  });
  runUiOn(el, "#runSvExport", function(){ runUiExport(prep.startedAtMs != null ? prep.startedAtMs : prep.stats.startedAtMs, prep.segments); });
  runUiOn(el, "#runSvCancel", function(){ runUiLeaveSave(v); });
  runUiOn(el, "#runSvSave", function(){ runUiSaveClick(s); });
  // o aviso de duplicado precisa da lista: se ainda não veio, atualiza-se só esse aviso quando chegar (sem desenhar o ecrã por cima do que se escreve)
  if (!runUiData.loaded && !runUiData.loading) runUiLoad(runUiData, s.id, false, function(){
    var box = document.getElementById("runSvDup");
    if (box && RUN.v === v && v.prep) box.classList.toggle("hidden", !runUiDupOf(v.prep));
  });
}
RUN.saveFlow = function(s, prep){
  try {
    if (!s || authRole !== "student" || !prep || !prep.stats || RUN_SOURCES.indexOf(prep.source) < 0) return;
    RUN.go("save", {prep: prep});
  } catch (e) {}
};

/* ---------- vista «detail» (aluno) ---------- */
function runUiWireDetail(s, el){
  var d = runUiData, v = RUN.v, id = v.id, preview = authRole !== "student", r = runUiFindRun(d, id);
  runUiOn(el, "#runBack", function(){ RUN.go("home"); });
  if (!r) return;
  runUiLoadTrack(d, id, function(){ runUiRedraw(s, "detail"); });
  runUiOn(el, "#runExportSaved", function(){
    var t = d.tracks[id];
    if (t && t.state === "ok") runUiExport(r.startedAtMs, t.segs);
  });
  if (preview) return;
  runUiOn(el, "#runDelTrack", function(){
    runUiDelete({ask: "Apagar só o percurso? Os números (distância, tempo, ritmo) ficam. Não dá para desfazer.", ok: "Percurso apagado.",
      make: function(db){ return db.from("run_tracks").delete().eq("run_id", id).select("run_id"); },
      after: function(){ d.tracks[id] = {state: "none"}; RUN.go("detail", {id: id}); }});
  });
  runUiOn(el, "#runDelRun", function(){
    runUiDelete({ask: "Apagar esta corrida e o percurso? Não dá para desfazer.", ok: "Corrida apagada.",
      make: function(db){ return db.from("runs").delete().eq("id", id).select("id"); },
      after: function(){
        d.runs = d.runs.filter(function(x){ return x.id !== id; }); runUiInvalidate(d);
        RUN.go("home");
      }});
  });
}

/* ---------- RUN.go / RUN.screen / RUN.wire ---------- */
function runUiMakeView(name, params){
  var v = {name: typeof name === "string" && name ? name : "home"}, k;
  if (params && typeof params === "object") for (k in params) if (Object.prototype.hasOwnProperty.call(params, k)) v[k] = params[k];
  if (v.name === "manual" && !v.form) v.form = {date: localTodayISO(), time: "", km: "", dur: ""};
  if (v.name === "save" && !v.form) v.form = {share: false, trim: 200, rpe: v.prep && v.prep.rpe ? String(v.prep.rpe) : "", notes: v.prep && typeof v.prep.notes === "string" ? v.prep.notes : ""};
  return v;
}
RUN.v = {name: "home"};
RUN.go = function(name, params){
  runUiGoSeq++;
  var s = findStudent(state.alunoStudentId);
  if (s) runUiSync(s.id);
  RUN.v = runUiMakeView(name, params);
  if (!s || APP_MODE !== "treino" || state.alunoTab !== "corrida") return;
  renderAlunoTab(s);
  try { window.scrollTo(0, 0); } catch (e) {}
};
// a vista «live» só é do aluno com o gravador ligado; mas uma gravação em curso (GPS ligado) não se esconde se o profissional mudar o modo entretanto:
// o ecrã do gravador decide o que mostrar (o aluno tem de a poder terminar ou descartar)
function runUiLiveView(s){
  if (authRole !== "student") return false;
  if (s.runsMode === "live") return typeof RUN.liveScreen === "function";
  try { return typeof RUN.liveBusy === "function" && typeof RUN.liveScreen === "function" && RUN.liveBusy() === true; } catch (e) { return false; }
}
RUN.screen = function(sv){
  try {
    runUiSync(sv.id);
    var v = RUN.v || (RUN.v = {name: "home"}), off = corridaModeOf(sv) === "off";
    if (!off) RUN.dataMode = false;
    if (v.name === "live"){
      if (runUiLiveView(sv)) return RUN.liveScreen(sv);
      RUN.v = v = {name: "home"};
    }
    // com a Corrida desligada só há a vista de dados (início e detalhe: ver e apagar): importar, à mão, consentimento e confirmar não existem
    if (off && v.name !== "detail") RUN.v = v = {name: "home"};
    if (v.name === "import" && authRole === "student") return runUiImportHtml();
    if (v.name === "manual" && authRole === "student") return runUiManualHtml();
    if (v.name === "consent" && authRole === "student") return runUiConsentHtml();
    if (v.name === "save" && authRole === "student" && (v.prep || v.saved)) return runUiSaveHtml(sv);
    if (v.name === "detail" && v.id) return runUiDetailHtml(runUiData, v.id, false, authRole !== "student", "runBack");
    if (v.name !== "home") RUN.v = {name: "home"};
    return runUiHomeHtml(sv);
  } catch (e) {
    return '<div class="card"><p class="muted-p">Não foi possível mostrar a Corrida. Fecha a app e volta a abri-la.</p></div>';
  }
};
RUN.wire = function(s, el){
  try {
    el.querySelectorAll("[data-run-map]").forEach(function(b){
      b.addEventListener("click", function(){ RUN.uiMapOn = b.getAttribute("data-run-map") === "on"; renderAlunoTab(s); });
    });
    var v = RUN.v || {name: "home"};
    if (v.name === "live" && runUiLiveView(s) && typeof RUN.liveWire === "function"){ RUN.liveWire(s, el); return; }
    if (v.name === "import") runUiWireImport(s, el);
    else if (v.name === "manual") runUiWireManual(s, el);
    else if (v.name === "consent") runUiWireConsent(s, el);
    else if (v.name === "save") runUiWireSave(s, el);
    else if (v.name === "detail") runUiWireDetail(s, el);
    else runUiWireHome(s, el);
  } catch (e) {}
};
RUN.uiReset = runUiReset;
RUN.reset = runUiReset;

/* =====================================================================================================================
   Profissional: separador «Corridas» da ficha do aluno
   ===================================================================================================================== */
function runUiProConsentLine(d){
  if (d.consentErr) return "Não foi possível ver se o aluno aceitou o aviso.";
  if (d.consent === undefined) return "A ver se o aluno aceitou o aviso…";
  if (!d.consent) return "Ainda não aceitou o aviso. Sem o aceitar, o aluno não consegue guardar corridas.";
  return "Aceitou o aviso em " + runUiDateStr(d.consent.ms) + " (versão " + d.consent.version + ").";
}
function runUiProLoad(s, d){
  var redraw = function(){ runUiRedrawPro(s); };
  if (d.consent === undefined && !d.consentBusy){
    d.consentBusy = true;
    runUiCall(function(db){ return db.from("run_consents").select("version, accepted_at").eq("student_id", s.id); }).then(function(res){
      d.consentBusy = false;
      if (res.error){ if (runUiKind(res) === "missing") d.err = "missing"; d.consentErr = true; d.consent = null; redraw(); return; }
      var best = null;
      runUiRows(res).forEach(function(r){
        var t = r && typeof r.accepted_at === "string" ? runParseTime(r.accepted_at) : null, ver = r ? Math.round(Number(r.version)) : NaN;
        if (t && isFinite(ver) && ver >= 1 && (!best || t.ms > best.ms)) best = {ms: t.ms, version: ver};
      });
      d.consentErr = false; d.consent = best;
      redraw();
    });
  }
  if (!d.loading && (!d.loaded || Date.now() - d.loadedAt > RUN_UI_STALE_MS)) runUiLoad(d, s.id, false, redraw);
}
function runUiProHtml(s, d){ return '<div class="run-pro">' + runUiProInner(s, d) + '</div>'; }
function runUiProInner(s, d){
  var h = '<div class="eyebrow">Corridas</div>';
  h += '<div class="card run-pro-mode"><div class="eyebrow">Corrida neste aluno</div><div class="run-modes" role="radiogroup" aria-label="Corrida neste aluno">' +
    RUN_UI_MODES.map(function(m){
      var on = corridaModeOf(s) === m[0];
      return '<button type="button" class="chip run-mode' + (on ? ' on' : '') + '" role="radio" aria-checked="' + (on ? 'true' : 'false') + '" data-run-mode="' + m[0] + '"' + (d.modeBusy ? ' disabled' : '') + '>' + escapeHtml(m[1]) + '</button>';
    }).join("") + '</div>' +
    '<p class="muted-p" id="runModeHelp">' + escapeHtml(corridaModeOf(s) === "off" ?
      "Com a Corrida desligada o aluno continua a ver o separador «Corrida», mas só com a indicação de que não está ativa: não importa, não regista nem grava. As corridas que já tem continuam guardadas e continuas a vê-las aqui; o aluno também as pode ver e apagar, e retirar o consentimento (o que apaga todas)." :
      corridaModeOf(s) === "live" ?
      "O aluno pode importar ficheiros GPX ou TCX, registar corridas à mão e gravar com o GPS do telemóvel (que só liga depois de ele carregar em «Preparar GPS»). A gravação é experimental: só está pensada para o ecrã ligado e a EVOLVE aberta, e o ecrã bloqueado ou noutra aplicação não está verificado em iPhone nem em Android. Vês as corridas que ele guardar; o aluno pode apagá-las." :
      "O aluno pode importar ficheiros GPX ou TCX e registar corridas à mão no separador «Corrida» da app EVOLVE Treino. Vês as corridas que ele guardar; o aluno pode apagá-las.") + '</p>' +
    '<p class="run-err" id="runModeErr" role="alert">' + escapeHtml(d.modeErr || "") + '</p></div>';
  if (d.err === "missing") return h + '<p class="muted-p" id="runProMissing">' + escapeHtml(RUN_UI_MSG.missingPro) + '</p>';
  h += '<div class="card"><div class="eyebrow">Consentimento</div><p class="muted-p" id="runProConsent">' + escapeHtml(runUiProConsentLine(d)) + '</p></div>';
  if (!d.detailId) h += runUiPlanProHtml(s, d);
  if (d.detailId){
    return h + runUiDetailHtml(d, d.detailId, true, false, "runProBack") + '<p class="muted-p run-note">' + escapeHtml(RUN_UI_MSG.sensitive) + '</p>';
  }
  if (!d.runs.length && !d.loaded) h += '<div class="card run-state"><p class="muted-p" id="runLoading">A carregar as corridas…</p></div>';
  else if (d.err && !d.runs.length) h += '<div class="card run-state"><p class="muted-p">Não foi possível carregar as corridas.</p><button type="button" class="btn run-btn" id="runProRetry">Tentar outra vez</button></div>';
  else if (!d.runs.length) h += '<div class="card run-state"><p class="muted-p" id="runEmpty">Este aluno ainda não registou corridas.</p></div>';
  else h += runUiWeeksHtml(d) + '<div class="card run-list"><div class="eyebrow">Corridas do aluno</div>' +
    d.runs.map(function(r){ return runUiRowHtml(r, "data-prun"); }).join("") +
    (d.more ? '<p class="muted-p run-note">A mostrar as ' + d.runs.length + ' mais recentes.</p><button type="button" class="btn run-btn" id="runProMore"' + (d.loading ? ' disabled' : '') + '>Ver mais</button>' : '') + '</div>';
  return h + '<p class="muted-p run-note" id="runProSensitive">' + escapeHtml(RUN_UI_MSG.sensitive) + '</p>';
}
function runUiProSetMode(s, d, mode){
  if (authRole !== "professional" || d.modeBusy || corridaModeOf(s) === mode) return;
  if (!runUiOnline()){ d.modeErr = "Sem ligação. Não foi possível mudar a Corrida deste aluno."; runUiRedrawPro(s); return; }
  d.modeBusy = true; d.modeErr = "";
  runUiRedrawPro(s);
  runUiCall(function(db){ return db.from("students").update({runs_mode: mode}).eq("id", s.id).select("id"); }).then(function(res){
    d.modeBusy = false;
    var k = runUiKind(res), none = Array.isArray(res.data) && !res.data.length;
    if (k || none){
      d.modeErr = k === "missing" ? RUN_UI_MSG.missingPro : k === "net" ? "Sem ligação. Não foi possível mudar a Corrida deste aluno." : "Não foi possível mudar a Corrida deste aluno. Tenta outra vez.";
    } else {
      s.runsMode = mode; s.runsColumn = true; d.modeErr = "";
      showToast(mode === "off" ? "Corrida desligada neste aluno." : "Corrida ligada neste aluno.");
    }
    runUiRedrawPro(s);
  });
}
function runUiProWire(s, el, d){
  runUiPlanProWire(s, el, d);
  el.querySelectorAll("[data-run-map]").forEach(function(b){
    b.addEventListener("click", function(){ RUN.uiMapOn = b.getAttribute("data-run-map") === "on"; RUN.proTab(s, document.getElementById("proTabContent") || el); });
  });
  runUiOn(el, "#runProRetry", function(){ runUiInvalidate(d); d.err = ""; d.consent = undefined; RUN.proTab(s, document.getElementById("proTabContent") || el); });
  runUiOn(el, "#runProMore", function(){ runUiLoad(d, s.id, true, function(){ runUiRedrawPro(s); }); runUiRedrawPro(s); });
  runUiOn(el, "#runProBack", function(){ d.detailId = null; RUN.proTab(s, document.getElementById("proTabContent") || el); });
  el.querySelectorAll("[data-run-mode]").forEach(function(b){
    b.addEventListener("click", function(){ runUiProSetMode(s, d, b.getAttribute("data-run-mode")); });
  });
  el.querySelectorAll("[data-prun]").forEach(function(b){
    b.addEventListener("click", function(){
      d.detailId = b.getAttribute("data-prun");
      var t = d.tracks[d.detailId];
      if (t && t.state === "err") delete d.tracks[d.detailId];
      RUN.proTab(s, document.getElementById("proTabContent") || el);
    });
  });
  if (d.detailId){
    var id = d.detailId;
    if (runUiFindRun(d, id)) runUiLoadTrack(d, id, function(){ if (d.detailId === id) runUiRedrawPro(s); });
    runUiOn(el, "#runDelRun", function(){
      runUiDelete({ask: "Apagar esta corrida do aluno? Não dá para desfazer.", ok: "Corrida apagada.",
        make: function(db){ return db.from("runs").delete().eq("id", id).select("id"); },
        after: function(){ d.runs = d.runs.filter(function(x){ return x.id !== id; }); runUiInvalidate(d); d.detailId = null; runUiRedrawPro(s); }});
    });
    runUiOn(el, "#runDelTrack", function(){
      runUiDelete({ask: "Apagar só o percurso deste aluno? Os números da corrida ficam. Não dá para desfazer.", ok: "Percurso apagado.",
        make: function(db){ return db.from("run_tracks").delete().eq("run_id", id).select("run_id"); },
        after: function(){ d.tracks[id] = {state: "none"}; runUiRedrawPro(s); }});
    });
  }
}
RUN.proTab = function(s, el){
  try {
    if (!s || !el) return;
    if (runUiProData.sid !== s.id){ runUiProData = runUiNewData(s.id, runUiUid()); runUiProData.consent = undefined; runUiProData.detailId = null; }
    var d = runUiProData;
    el.innerHTML = runUiProHtml(s, d);
    runUiProWire(s, el, d);
    if (d.err !== "missing") runUiProLoad(s, d);
  } catch (e) {}
};
