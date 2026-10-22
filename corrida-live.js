/* =====================================================================================================================
   EVOLVE Treino — Corrida ao vivo (corrida-live.js): gravador GPS em primeiro plano (ecrã ligado), rascunho e fila de envio.

   Avaliado com eval direto (modo estrito) dentro da IIFE de app.js, DEPOIS de corrida-core.js e corrida.js e no MESMO eval (ver loadCorrida).
   Por isso: ES5 no estilo do projeto (var/function; sem arrow, let, const, async, template strings); só declarações de topo com prefixo
   run / RUN_ (os nomes runL... são INTERNOS deste ficheiro; os runLive... são puros e testados em Node); a comunicação com corrida.js é por RUN.*.
   Este ficheiro é o ÚLTIMO e acaba com RUN.loaded = true. Não faz pedidos de rede (a fila fala com o Supabase do núcleo, tal como RUN.submitRun),
   nunca escreve coordenadas em consola, avisos ou erros, e só usa o localStorage nas duas chaves que o núcleo já declara (RUN_DRAFT_KEY, RUN_OUTBOX_KEY).

   ---------------------------------------------------------------------------------------------------------------------
   API (contrato com corrida.js; o que este ficheiro DEFINE em RUN)
   ---------------------------------------------------------------------------------------------------------------------
     RUN.liveOpen(s)             muda para a vista ao vivo (RUN.go("live")). Só o aluno, e só com a Corrida em modo «live».
     RUN.liveScreen(sv)          HTML do separador quando RUN.v.name === "live" (corrida.js delega aqui em RUN.screen).
     RUN.liveWire(s, el)         liga os eventos desse HTML (corrida.js delega aqui em RUN.wire). O estado NUNCA vive no DOM: está em RUN.live.
     RUN.liveDraftBanner(s)      HTML do topo da vista «home»: gravação a decorrer / rascunho por terminar / corridas por enviar. "" se não houver nada.
     RUN.liveWireBanner(s, el)   liga os botões desse HTML e tenta enviar a fila (uma vez por abertura).
     RUN.queueAdd(item)          guarda na fila local {row, track}: SÓ o que seria enviado (nunca os pontos brutos). true se ficou guardado.
     RUN.queuePending()          nº de corridas da fila (do utilizador atual) à espera de envio.   RUN.queueFailed() → nº das recusadas.
     RUN.flush()                 envia a fila em série (runs e depois run_tracks); 23505 = já chegou; erro transitório mantém; recusa permanente marca.
     RUN.reset()                 pára o GPS, os relógios e o Wake Lock e esquece o estado em memória (sair da conta). Não toca no armazenamento.
     RUN.gps                     adaptador injetável {start(onFix, onErr), stop()}; fix = {lat, lon, acc, t(ms), speed|null}; onErr({code}).
     RUN.live                    o estado em memória (fases «intro», «prep», «rec», «end»).
   Do que corrida.js define e este ficheiro USA: RUN.v, RUN.go(name, params), RUN.ensureConsent(s, cb), RUN.saveFlow(s, prep), RUN.submitRun(s, item),
   RUN.uiReset() (chamado por RUN.reset). RUN.saveFlow recebe prep = {source:"live", stats, segments (cópia dos pontos todos), hiddenS, warnings, fileDistM:null,
   startedAtMs, cancelView:{name:"live"}, onSaved(res)}: o rascunho só se apaga depois de a corrida ficar guardada ou na fila (RUN.submitRun é embrulhado aqui
   para o saber; se corrida.js chamar prep.onSaved(res) também serve, e é indiferente quem chega primeiro). «Cancelar» no ecrã de guardar volta ao resumo (cancelView).

   Pontos puros (testados em Node, exportados por nome): runLiveDraftBuild/Serialize/Parse/Choices, runLiveQueueItem/Parse/Add, runLiveFixFromPosition,
   runLiveSignalInfo, runLiveWarnings.

   ---------------------------------------------------------------------------------------------------------------------
   O que está verificado e o que NÃO está
   ---------------------------------------------------------------------------------------------------------------------
   Verificado (tests/corrida-live.test.js em Node e tests/corrida-live-browser.test.js em Chromium), SÓ com adaptador de GPS injetado, séries
   sintéticas e um Supabase simulado: a máquina de estados, o rascunho (formato, validação, teto), a fila (ordem, limites, deduplicação, 23505,
   offline→online), o vigia, o Wake Lock simulado, a lacuna por ecrã oculto simulada, o bloqueio de toques, o adaptador padrão com a geolocalização
   do Playwright, e que nada vai a terceiros nem coordenadas à consola.
   NÃO verificado: nenhum telemóvel real. Não se sabe se, com o ecrã bloqueado ou noutra aplicação, o iPhone ou o Android continuam a entregar posições
   (por isso a app diz que pode falhar), nem se o Wake Lock funciona em todos os iPhones, nem a precisão do GPS, nem o consumo de bateria, nem o texto
   de ajuda de permissões do iOS (vem de relatos, está escrito com reservas).
   ===================================================================================================================== */

var RUN_LIVE_CFG = {
  tickMs: 1000,              // relógio do ecrã (o valor vem de Date.now(), não da contagem de ticks)
  draftEveryMs: 10000,       // rascunho: no máximo uma escrita periódica de 10 em 10 s (as mudanças de estado escrevem logo)
  noFixWarnS: 8,             // sem posições há mais de N s: avisa no ecrã
  firstFixHelpS: 30,         // o 1.º fix demora mais de N s: mostra a ajuda de permissões
  watchdogS: 20,             // visível, a gravar e sem posições há N s: reinicia o watch
  watchdogMax: 3,            // no máximo N reinícios por janela
  watchdogWindowMs: 600000,  // janela de 10 min
  timeoutRestart: 3,         // erros do tipo 3 (timeout) seguidos que reiniciam o watch
  pauseReleaseMs: 600000,    // em pausa há 10 min: liberta o GPS (retomar volta a pedi-lo)
  resumeMaxMs: 21600000,     // retomar um rascunho só até 6 h depois da última posição
  staleFixMs: 30000,         // um fix mais de 30 s anterior ao toque em «Iniciar» não conta
  hiddenNoticeMinS: 3,       // só avisa «página oculta» a partir de N s
  lockHoldMs: 1500,          // pressão longa para desbloquear os toques
  maxDraftPoints: 10000,     // teto de pontos do rascunho
  maxDraftChars: 2500000,    // teto do texto do rascunho (o localStorage é pequeno e partilhado com o resto da app)
  outboxMax: 20,             // corridas na fila, por utilizador
  outboxMaxChars: 1500000,   // texto máximo da fila inteira
  sendTimeoutMs: 20000       // espera máxima por cada pedido ao enviar a fila
};
var RUN_LIVE_GEO = {enableHighAccuracy: true, maximumAge: 0, timeout: 30000};
var RUN_LIVE_ROW_KEYS = ["id", "student_id", "started_at", "source", "duration_s", "moving_s", "distance_m", "gaps", "gap_s", "hidden_s", "splits_s", "rpe", "notes", "consent_v"];

/* ---------- auxiliares puros ---------- */
function runLFin(v){ return typeof v === "number" && isFinite(v); }
function runLPad2(n){ return (n < 10 ? "0" : "") + n; }
function runLIsUuid(s){ return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s); }
function runLInt(v, lo, hi){
  if (!runLFin(v)) return lo;
  var n = Math.round(v);
  return n < lo ? lo : n > hi ? hi : n;
}
function runLCopy(o){ return JSON.parse(JSON.stringify(o)); }
function runLCountPts(segs){
  var n = 0, i;
  if (!Array.isArray(segs)) return 0;
  for (i = 0; i < segs.length; i++) if (Array.isArray(segs[i])) n += segs[i].length;
  return n;
}
// «23 s», «4 min 5 s», «1 h 2 min»
function runLDurWords(sec){
  var s = Math.max(0, Math.round(runLFin(sec) ? sec : 0)), m, r, h;
  if (s < 60) return s + " s";
  m = Math.floor(s / 60); r = s % 60;
  if (m < 60) return m + " min" + (r ? " " + r + " s" : "");
  h = Math.floor(m / 60); m = m % 60;
  return h + " h" + (m ? " " + m + " min" : "");
}
// «22/10/2026 às 07:42» na hora local do telemóvel
function runLWhen(ms){
  if (!runLFin(ms)) return "";
  var d = new Date(ms);
  return runLPad2(d.getDate()) + "/" + runLPad2(d.getMonth() + 1) + "/" + d.getFullYear() + " às " + runLPad2(d.getHours()) + ":" + runLPad2(d.getMinutes());
}
function runLPlural(n, one, many){ return n + " " + (n === 1 ? one : many); }

/* ---------- fix normalizado a partir do GeolocationPosition ---------- */
function runLiveFixFromPosition(pos){
  if (!pos || !pos.coords) return null;
  var c = pos.coords, t = pos.timestamp;
  if (!runLFin(c.latitude) || !runLFin(c.longitude) || !runLFin(t)) return null;
  return {lat: c.latitude, lon: c.longitude, acc: runLFin(c.accuracy) ? c.accuracy : null, t: t, speed: runLFin(c.speed) ? c.speed : null};
}

/* ---------- aviso de sinal (texto e estado) ---------- */
// o = {err, paused, hasCb, sinceCbS, waitedS, acc, accMax}
function runLiveSignalInfo(o){
  var warn = RUN_LIVE_CFG.noFixWarnS, n;
  if (o.err === "denied") return {kind: "none", text: "A localização foi recusada."};
  if (o.err === "unsupported") return {kind: "none", text: "Este navegador não consegue dar a localização."};
  if (o.paused) return {kind: "paused", text: "Em pausa."};
  if (!o.hasCb) {
    n = Math.max(0, Math.floor(o.waitedS || 0));
    return n >= warn ? {kind: "none", text: "Sem posições há " + n + " s. Mantém o ecrã ligado."} : {kind: "wait", text: "A procurar sinal…"};
  }
  n = Math.max(0, Math.floor(o.sinceCbS || 0));
  if (n >= warn) return {kind: "none", text: "Sem posições há " + n + " s. Mantém o ecrã ligado."};
  if (!runLFin(o.acc) || o.acc > o.accMax) return {kind: "weak", text: "Sinal fraco" + (runLFin(o.acc) ? " (±" + Math.round(o.acc) + " m)" : "") + "."};
  return {kind: "good", text: "Sinal bom (±" + Math.round(o.acc) + " m)."};
}

/* ---------- avisos para o ecrã de guardar ---------- */
function runLiveWarnings(stats, hiddenS, restarts){
  var w = [];
  if (stats && stats.gaps > 0) w.push("Houve " + runLPlural(stats.gaps, "lacuna", "lacunas") + " de sinal (" + runLDurWords(stats.gapS) + " sem posições): esses períodos não contam para a distância.");
  if (hiddenS > 0) w.push("A página esteve oculta " + runLDurWords(hiddenS) + " durante a corrida: o percurso pode ter lacunas.");
  if (restarts > 0) w.push("O GPS foi reiniciado " + runLPlural(restarts, "vez", "vezes") + " durante a corrida.");
  return w;
}

/* ---------- rascunho: formato, validação, teto ---------- */
// st = estado do reducer (JSON simples). o = {uid, hiddenS, ended, restarts, nowMs}
function runLiveDraftBuild(st, o){
  o = o || {};
  return {
    v: 1, uid: o.uid, ts: runLFin(o.nowMs) ? o.nowMs : Date.now(), view: "live", ended: o.ended === true,
    hiddenS: runLInt(o.hiddenS, 0, 86400), restarts: runLInt(o.restarts, 0, 1000), st: st
  };
}
// {ok:true, text} | {ok:false, reason:"shape"|"points"|"size"|"json"}
function runLiveDraftSerialize(draft){
  var st = draft && draft.st, text;
  if (!st || typeof st !== "object" || !Array.isArray(st.segs)) return {ok: false, reason: "shape"};
  if (runLCountPts(st.segs) > RUN_LIVE_CFG.maxDraftPoints) return {ok: false, reason: "points"};
  try { text = JSON.stringify(draft); } catch (e) { return {ok: false, reason: "json"}; }
  if (typeof text !== "string") return {ok: false, reason: "json"};
  if (text.length > RUN_LIVE_CFG.maxDraftChars) return {ok: false, reason: "size"};
  return {ok: true, text: text};
}
// raw = texto guardado; uid = conta atual. Devolve
//   {ok:true, st, ended, hiddenS, restarts, ts, points, stats, lastT, startedAtMs}  rascunho do utilizador atual com posições
//   {ok:false, reason:"none"}      nada guardado
//   {ok:false, reason:"corrupt"}   texto que não é um rascunho (não se sabe de quem é: ignora-se)
//   {ok:false, reason:"other"}     de outra conta (ignora-se, nunca se mostra nem se usa)
//   {ok:false, reason:"unusable"}  do utilizador atual mas sem posições aproveitáveis (mostra-se, só dá para descartar)
function runLiveDraftParse(raw, uid){
  var d, st, stats;
  if (raw == null || raw === "") return {ok: false, reason: "none"};
  if (typeof raw !== "string" || raw.length > RUN_LIVE_CFG.maxDraftChars * 2) return {ok: false, reason: "corrupt"};
  try { d = JSON.parse(raw); } catch (e) { return {ok: false, reason: "corrupt"}; }
  if (!d || typeof d !== "object" || Array.isArray(d) || typeof d.uid !== "string" || !d.uid) return {ok: false, reason: "corrupt"};
  if (!uid || d.uid !== uid) return {ok: false, reason: "other"};
  st = d.v === 1 && d.st && typeof d.st === "object" && Array.isArray(d.st.segs) ? runFeedRestore(d.st) : null;
  if (!st || st.nPts < 1) return {ok: false, reason: "unusable"};
  stats = runStats(st.segs, null, "live");
  return {
    ok: true, st: st, ended: d.ended === true, hiddenS: runLInt(d.hiddenS, 0, 86400), restarts: runLInt(d.restarts, 0, 1000),
    ts: runLFin(d.ts) ? d.ts : null, points: st.nPts, stats: stats, lastT: st.lastGoodT, startedAtMs: st.startedAtMs
  };
}
// O que o aluno pode fazer com um rascunho: retomar (só se não terminou, a Corrida ao vivo está ligada e passaram <= 6 h) ou guardar o que há
// (só se dá uma corrida válida). Descartar pode sempre. why = explicação em PT-PT quando falta uma opção.
function runLiveDraftChoices(info, nowMs, mode){
  var out = {resume: false, save: false, discard: true, why: "", saveError: ""}, chk, age;
  if (!info || !info.ok) return out;
  if (mode !== "live") { out.why = "A gravação com GPS não está ligada para ti neste momento, por isso não dá para retomar nem guardar esta corrida. Podes descartá-la."; return out; }
  chk = runCheckRun({id: "00000000-0000-4000-8000-000000000000", studentId: "x", source: "live", startedAtMs: info.stats.startedAtMs, durationS: info.stats.durationS,
    movingS: info.stats.movingS, distM: info.stats.distM, gaps: info.stats.gaps, gapS: info.stats.gapS, hiddenS: info.hiddenS, consentV: 1}, nowMs);
  out.save = info.stats.points >= 2 && chk.ok;
  if (!chk.ok) out.saveError = chk.error;
  age = nowMs - info.lastT;
  if (!info.ended) {
    if (age <= RUN_LIVE_CFG.resumeMaxMs) out.resume = true;
    else out.why = "Passaram mais de 6 horas desde a última posição: já não dá para retomar" + (out.save ? ", mas podes guardar o que há." : ".");
  }
  return out;
}

/* ---------- fila de envio: validação, limites, deduplicação ---------- */
function runLiveTrackClean(tr){
  var segs = [], i, j, seg, p, out, pts = 0;
  if (!tr || typeof tr !== "object" || !Array.isArray(tr.segments)) return null;
  if (!tr.segments.length || tr.segments.length > RUN_CFG.maxSegments) return null;
  for (i = 0; i < tr.segments.length; i++) {
    seg = tr.segments[i];
    if (!Array.isArray(seg) || !seg.length) return null;
    out = [];
    for (j = 0; j < seg.length; j++) {
      p = seg[j];
      if (!Array.isArray(p) || p.length !== 3 || !runLFin(p[0]) || !runLFin(p[1]) || !runLFin(p[2])) return null;
      if (p[0] < -90 || p[0] > 90 || p[1] < -180 || p[1] > 180 || p[2] < 0 || p[2] > 2592000) return null;
      out.push([p[0], p[1], p[2]]);
    }
    pts += out.length;
    segs.push(out);
  }
  if (pts > RUN_CFG.maxTrackPoints || runTrackBytes(segs) > RUN_CFG.maxTrackBytes) return null;
  return {segments: segs, trimM: runLInt(tr.trimM, 0, RUN_CFG.maxTrimM)};
}
// item = {row, track}. Devolve {row, track} só com o que seria enviado (colunas conhecidas; percurso já aparado), ou null se for lixo.
function runLiveQueueItem(item){
  var r, row = {}, i, k, v, numKeys = ["duration_s", "moving_s", "distance_m", "gaps", "gap_s", "hidden_s", "consent_v"], track = null;
  if (!item || typeof item !== "object" || !item.row || typeof item.row !== "object" || Array.isArray(item.row)) return null;
  r = item.row;
  for (i = 0; i < RUN_LIVE_ROW_KEYS.length; i++) {
    k = RUN_LIVE_ROW_KEYS[i];
    if (Object.prototype.hasOwnProperty.call(r, k)) row[k] = r[k];
  }
  if (!runLIsUuid(row.id)) return null;
  if (typeof row.student_id !== "string" || !row.student_id || row.student_id.length > 100) return null;
  if (typeof row.started_at !== "string" || !isFinite(Date.parse(row.started_at))) return null;
  if (RUN_SOURCES.indexOf(row.source) < 0) return null;
  for (i = 0; i < numKeys.length; i++) { v = row[numKeys[i]]; if (!runLFin(v) || v < 0) return null; }
  if (row.rpe != null && (!runLFin(row.rpe) || row.rpe < 1 || row.rpe > 10)) return null;
  if (row.notes != null && (typeof row.notes !== "string" || row.notes.length > RUN_CFG.maxNotes)) return null;
  if (row.splits_s != null) {
    if (!Array.isArray(row.splits_s) || row.splits_s.length > RUN_CFG.maxSplits) return null;
    for (i = 0; i < row.splits_s.length; i++) if (!runLFin(row.splits_s[i]) || row.splits_s[i] < 0) return null;
    row.splits_s = row.splits_s.slice();
  } else row.splits_s = null;
  if (row.rpe == null) row.rpe = null;
  if (row.notes == null) row.notes = null;
  if (item.track != null) { track = runLiveTrackClean(item.track); if (!track) return null; }
  return {row: row, track: track};
}
// raw = texto da fila (lista, ou {items: [...]}). Devolve {list, dropped}: só entradas válidas (de qualquer conta), já normalizadas.
function runLiveQueueParse(raw){
  var data, arr, list = [], dropped = 0, i, e, item;
  if (raw == null || raw === "") return {list: [], dropped: 0};
  if (typeof raw !== "string") return {list: [], dropped: 0, bad: true};
  try { data = JSON.parse(raw); } catch (err) { return {list: [], dropped: 0, bad: true}; }
  arr = Array.isArray(data) ? data : (data && typeof data === "object" && Array.isArray(data.items) ? data.items : null);
  if (!arr) return {list: [], dropped: 0, bad: true};
  for (i = 0; i < arr.length; i++) {
    e = arr[i];
    if (!e || typeof e !== "object" || Array.isArray(e) || typeof e.uid !== "string" || !e.uid || !runLIsUuid(e.id)) { dropped++; continue; }
    item = runLiveQueueItem(e.item);
    if (!item || item.row.id !== e.id) { dropped++; continue; }
    list.push({
      id: e.id, uid: e.uid, ts: runLFin(e.ts) ? e.ts : 0, state: e.state === "failed" ? "failed" : "pending",
      err: typeof e.err === "string" ? e.err.slice(0, 200) : "", item: item
    });
  }
  return {list: list, dropped: dropped};
}
// Junta item à lista (sem mexer na original). {ok:true, dup, list, text} | {ok:false, reason:"invalid"|"full"|"size"|"json"}
function runLiveQueueAdd(list, item, uid, nowMs){
  var clean = runLiveQueueItem(item), out = Array.isArray(list) ? list.slice() : [], own = 0, i, text;
  if (!clean || !uid) return {ok: false, reason: "invalid"};
  for (i = 0; i < out.length; i++) {
    if (out[i].uid === uid) {
      if (out[i].id === clean.row.id) return {ok: true, dup: true, list: out};
      own++;
    }
  }
  if (own >= RUN_LIVE_CFG.outboxMax) return {ok: false, reason: "full"};
  out.push({id: clean.row.id, uid: uid, ts: runLFin(nowMs) ? nowMs : Date.now(), state: "pending", err: "", item: clean});
  try { text = JSON.stringify(out); } catch (e) { return {ok: false, reason: "json"}; }
  if (text.length > RUN_LIVE_CFG.outboxMaxChars) return {ok: false, reason: "size"};
  return {ok: true, dup: false, list: out, text: text};
}

/* ---------- estado em memória (RUN.live) ---------- */
function runLNew(){
  return {
    sid: 0, phase: "intro", uid: null, stu: null,
    st: null, ended: false, hiddenS: 0, hiddenAt: null, notice: "", restarts: 0, restartLog: [],
    gpsOn: false, watching: false, err: null, prepGood: false, prepStartMs: null, watchStartMs: null, lastCbMs: null, lastAcc: null, seq3: 0, tapMs: null, visibleAt: 0,
    wlWanted: false, wlSentinel: null, wlPending: false, wl: "",
    tickId: null, pauseTimer: null, lockTimer: null, locked: false, unlockPending: false,
    lastDraftMs: 0, dirty: false, draftOk: null,
    consentAt: 0, saving: false, pendStart: null, flushP: null, lastOpenFlush: 0, notesHtml: ""
  };
}
RUN.live = runLNew();

/* ---------- armazenamento local (nunca lança) ---------- */
function runLStore(){ try { return window.localStorage || null; } catch (e) { return null; } }
function runLGet(key){ try { var s = runLStore(); return s ? s.getItem(key) : null; } catch (e) { return null; } }
function runLSet(key, text){ try { var s = runLStore(); if (!s) return false; s.setItem(key, text); return true; } catch (e) { return false; } }
function runLDel(key){ try { var s = runLStore(); if (s) s.removeItem(key); } catch (e) {} }
function runLUid(){ return typeof currentAuthUserId === "string" && currentAuthUserId ? currentAuthUserId : null; }
function runLHidden(){
  try { return typeof document !== "undefined" && (document.visibilityState === "hidden" || (document.visibilityState === undefined && document.hidden === true)); } catch (e) { return false; }
}
function runLDisplayed(){
  try { return typeof document !== "undefined" && !!document.getElementById("runLive") && !!RUN.v && RUN.v.name === "live"; } catch (e) { return false; }
}
// volta a desenhar a vista ao vivo (só se estiver mesmo no ecrã: nunca puxa o aluno de outro separador)
function runLRender(){
  if (runLDisplayed() && typeof RUN.go === "function") { try { RUN.go("live"); } catch (e) {} }
}
// desenha sempre (a pedido do aluno, que está nesta vista ou a chegar a ela)
function runLRenderForce(){
  if (typeof RUN.go === "function") { try { RUN.go("live"); } catch (e) {} }
}
function runLToast(msg){ try { if (typeof showToast === "function") showToast(msg); } catch (e) {} }
function runLMode(s){ return typeof corridaModeOf === "function" ? corridaModeOf(s) : "off"; }

/* ---------- rascunho: ler, escrever, apagar ---------- */
function runLDraftInfo(){ return runLiveDraftParse(runLGet(RUN_DRAFT_KEY), runLUid()); }
function runLDraftClear(){ runLDel(RUN_DRAFT_KEY); }
// Escreve o rascunho (no máximo de 10 em 10 s, ou já com force). Sem posições aceites não há rascunho: a chave apaga-se.
function runLDraftWrite(force){
  var L = RUN.live, now = Date.now(), uid = runLUid(), res;
  if (!L.st || L.uid !== uid || !uid) return false;
  if (L.phase !== "rec" && L.phase !== "end") return false;
  if (!force && now - L.lastDraftMs < RUN_LIVE_CFG.draftEveryMs) return false;
  L.lastDraftMs = now;
  if (L.st.nPts < 1) { runLDraftClear(); L.draftOk = null; L.dirty = false; return true; }
  var hid = L.hiddenS + (L.hiddenAt != null ? Math.max(0, (now - L.hiddenAt) / 1000) : 0);
  res = runLiveDraftSerialize(runLiveDraftBuild(L.st, {uid: uid, hiddenS: hid, ended: L.ended, restarts: L.restarts, nowMs: now}));
  L.draftOk = res.ok && runLSet(RUN_DRAFT_KEY, res.text);
  if (L.draftOk) L.dirty = false;
  return L.draftOk;
}

/* ---------- Wake Lock ---------- */
function runLWakeAcquire(){
  var L = RUN.live, sid = L.sid, nav = typeof navigator !== "undefined" ? navigator : null, req;
  if (!L.wlWanted) return;
  if (!nav || !nav.wakeLock || typeof nav.wakeLock.request !== "function") { L.wl = "unsupported"; return; }
  if (L.wlSentinel && !L.wlSentinel.released) return;   // já temos um
  if (L.wlPending || runLHidden()) return;               // sem pedidos duplicados; escondida a página o pedido falharia
  L.wlPending = true;
  try { req = nav.wakeLock.request("screen"); } catch (e) { L.wlPending = false; L.wl = "denied"; return; }
  Promise.resolve(req).then(function(sent){
    L.wlPending = false;
    if (!sent) { L.wl = "denied"; return; }
    if (sid !== L.sid || !L.wlWanted) { try { sent.release(); } catch (e) {} return; }
    L.wlSentinel = sent; L.wl = "on";
    try { sent.addEventListener("release", function(){ if (L.wlSentinel === sent) { L.wlSentinel = null; L.wl = "off"; } }); } catch (e) {}
  }, function(){ L.wlPending = false; L.wl = "denied"; });
}
function runLWakeRelease(){
  var L = RUN.live, sent = L.wlSentinel;
  L.wlWanted = false; L.wlSentinel = null; L.wlPending = false;
  if (sent) { try { sent.release(); } catch (e) {} }
}

/* ---------- GPS: adaptador padrão e arranque/paragem ---------- */
function runLMakeGps(){
  var watchId = null;
  return {
    start: function(onFix, onErr){
      var g = typeof navigator !== "undefined" ? navigator.geolocation : null;
      if (watchId != null) { try { g.clearWatch(watchId); } catch (e) {} watchId = null; }
      if (!g || typeof g.watchPosition !== "function") { onErr({code: -1, unsupported: true}); return; }
      watchId = g.watchPosition(function(pos){
        var fix = runLiveFixFromPosition(pos);
        if (fix) onFix(fix);
      }, function(err){
        onErr({code: err && runLFin(err.code) ? err.code : 0});
      }, {enableHighAccuracy: RUN_LIVE_GEO.enableHighAccuracy, maximumAge: RUN_LIVE_GEO.maximumAge, timeout: RUN_LIVE_GEO.timeout});
    },
    stop: function(){
      if (watchId == null) return;
      try { navigator.geolocation.clearWatch(watchId); } catch (e) {}
      watchId = null;
    }
  };
}
RUN.gps = runLMakeGps();

function runLGpsStart(){
  var L = RUN.live, sid = L.sid, g = RUN.gps;
  L.watchStartMs = Date.now(); L.seq3 = 0;
  if (!g || typeof g.start !== "function") { L.err = "unsupported"; L.watching = false; return false; }
  try {
    L.watching = true;   // antes de chamar: um adaptador pode responder (ou falhar) de imediato
    g.start(function(fix){ runLOnFix(sid, fix); }, function(err){ runLOnErr(sid, err); });
    return true;
  } catch (e) { L.watching = false; L.err = "gps"; return false; }
}
function runLGpsStop(){
  var L = RUN.live;
  L.watching = false;
  try { if (RUN.gps && typeof RUN.gps.stop === "function") RUN.gps.stop(); } catch (e) {}
}
// reinicia o watch (vigia e erros de timeout); no máximo watchdogMax por janela de 10 min
function runLRestartWatch(){
  var L = RUN.live, now = Date.now(), keep = [], i;
  for (i = 0; i < L.restartLog.length; i++) if (now - L.restartLog[i] < RUN_LIVE_CFG.watchdogWindowMs) keep.push(L.restartLog[i]);
  L.restartLog = keep;
  if (keep.length >= RUN_LIVE_CFG.watchdogMax) { L.watchStartMs = now; return false; }
  L.restartLog.push(now); L.restarts++;
  runLGpsStop();
  runLGpsStart();
  L.dirty = true;
  return true;
}

/* ---------- relógio, vigia e pintura em cima do DOM existente ---------- */
function runLTickStart(){
  var L = RUN.live;
  if (L.tickId != null) return;
  L.tickId = setInterval(runLTick, RUN_LIVE_CFG.tickMs);
}
function runLTickStop(){
  var L = RUN.live;
  if (L.tickId != null) { clearInterval(L.tickId); L.tickId = null; }
}
function runLTick(){
  var L = RUN.live, now = Date.now();
  if (L.phase !== "rec" && !(L.phase === "prep" && L.gpsOn)) { runLTickStop(); return; }
  // vigia: com a página visível, a gravar e sem posições há watchdogS s, reinicia o watch
  if (L.watching && !L.err && !runLHidden() && !(L.phase === "rec" && L.st && L.st.paused)) {
    var ref = Math.max(L.lastCbMs || 0, L.watchStartMs || 0, L.visibleAt || 0);
    if (now - ref >= RUN_LIVE_CFG.watchdogS * 1000) runLRestartWatch();
  }
  if (L.phase === "rec" && L.dirty) runLDraftWrite(false);
  runLPaint(now);
}
function runLSetText(id, text){
  var e = document.getElementById(id);
  if (e && e.textContent !== text) e.textContent = text;
}
function runLSetClass(id, cls){
  var e = document.getElementById(id);
  if (e && e.className !== cls) e.className = cls;
}
function runLNotesHtml(){
  var L = RUN.live, h = "";
  if (L.notice) h += "<div class=\"run-live-note\" role=\"status\"><span>" + escapeHtml(L.notice) + "</span><button type=\"button\" class=\"btn btn-sm\" data-act=\"dismiss\">Fechar</button></div>";
  if (L.draftOk === false) h += "<div class=\"run-live-note warn\" role=\"alert\"><span>Não feches a app: a corrida ainda não está guardada neste telemóvel.</span></div>";
  if (L.wl === "unsupported" || L.wl === "denied") h += "<div class=\"run-live-note warn\" role=\"status\"><span>Não consegui manter o ecrã ligado. Não deixes o ecrã bloquear e, se for preciso, aumenta o tempo de bloqueio automático do telemóvel.</span></div>";
  if (L.restarts > 0) h += "<div class=\"run-live-note\" role=\"status\"><span>O GPS foi reiniciado " + escapeHtml(runLPlural(L.restarts, "vez", "vezes")) + ".</span></div>";
  return h;
}
function runLPaint(now){
  var L = RUN.live, view, sig, hasCb = L.lastCbMs != null, vis = L.visibleAt || 0, waitFrom;
  if (typeof document === "undefined") return;
  // «sem posições há N s» conta só o tempo com a página visível (o tempo oculto já tem o seu aviso)
  waitFrom = Math.max(vis, L.prepStartMs != null ? L.prepStartMs : (L.watchStartMs || 0));
  sig = runLiveSignalInfo({
    err: L.err, paused: !!(L.st && L.st.paused), hasCb: hasCb, sinceCbS: hasCb ? (now - Math.max(L.lastCbMs, vis)) / 1000 : 0,
    waitedS: L.watchStartMs != null ? (now - waitFrom) / 1000 : 0, acc: L.lastAcc, accMax: RUN_CFG.accMaxM
  });
  runLSetText("runLiveSignal", sig.text);
  runLSetClass("runLiveSignal", "run-live-signal " + sig.kind);
  if (L.phase === "prep") {
    runLSetText("runLiveAcc", L.lastAcc != null && hasCb ? "Precisão: ±" + Math.round(L.lastAcc) + " m" : "Precisão: –");
    var btn = document.getElementById("runLiveStart");
    if (btn) btn.disabled = !(L.prepGood && L.watching && !L.err);
    var help = document.getElementById("runLiveHelp");
    if (help) {
      var showHelp = !!L.err || (!hasCb && L.prepStartMs != null && (now - waitFrom) / 1000 > RUN_LIVE_CFG.firstFixHelpS);
      help.classList.toggle("hidden", !showHelp);
    }
    return;
  }
  if (L.phase !== "rec" || !L.st) return;
  view = runLiveView(L.st, now);
  runLSetText("runLiveTime", runDurStr(view.elapsedS));
  runLSetText("runLiveDist", runDistStr(view.distM));
  runLSetText("runLivePace", runPaceStr(view.paceSPerKm));
  runLSetText("runLiveGaps", "Lacunas: " + view.gaps + (view.gaps ? " (" + runLDurWords(view.gapS) + " sem posições)" : ""));
  var notes = document.getElementById("runLiveNotes");
  if (notes) {
    var nh = runLNotesHtml();
    if (nh !== L.notesHtml) { L.notesHtml = nh; notes.innerHTML = nh; }
  }
}

/* ---------- posições e erros do GPS ---------- */
function runLOnFix(sid, fix){
  var L = RUN.live, now = Date.now(), info, before;
  if (sid !== L.sid || !fix || typeof fix !== "object") return;
  if (L.phase !== "prep" && L.phase !== "rec") return;
  L.lastCbMs = now; L.seq3 = 0;
  if (L.err === "gps") L.err = null;
  L.lastAcc = runLFin(fix.acc) ? fix.acc : null;
  if (L.phase === "prep") {
    L.prepGood = runLFin(fix.acc) && fix.acc <= RUN_CFG.accMaxM;
    runLPaint(now);
    return;
  }
  if (!L.st) return;
  if (L.tapMs != null && runLFin(fix.t) && fix.t < L.tapMs - RUN_LIVE_CFG.staleFixMs) return;   // posição antiga (cache), anterior ao toque
  before = L.st.nPts;
  info = runFeed(L.st, fix);
  if (info.added || info.gap) L.dirty = true;
  if (before < 1 && L.st.nPts >= 1) runLDraftWrite(true);      // primeira posição aceite: já há corrida para perder
  else if (info.gap) runLDraftWrite(true);                      // mudança de estado
  else if (L.dirty) runLDraftWrite(false);
  runLPaint(now);
}
function runLOnErr(sid, err){
  var L = RUN.live, code = err && runLFin(err.code) ? err.code : 0;
  if (sid !== L.sid) return;
  if (L.phase !== "prep" && L.phase !== "rec") return;
  if (code === 1) { runLDenied(); return; }
  if (err && err.unsupported) { runLFatal("unsupported"); return; }
  if (code === 3) {
    L.seq3++;
    if (L.seq3 >= RUN_LIVE_CFG.timeoutRestart) { L.seq3 = 0; if (!(L.st && L.st.paused)) runLRestartWatch(); }
  }
  // código 2 (posição indisponível) e outros: não são fatais; o aviso «sem posições há N s» fala por si
}
function runLFatal(kind){
  var L = RUN.live;
  if (L.phase === "rec") runLDraftWrite(true);
  runLGpsStop();
  L.err = kind;
  if (runLDisplayed()) runLRender(); else runLToast(kind === "denied" ? "A localização foi recusada: a gravação parou." : "Este navegador não consegue dar a localização.");
}
// permissão recusada: grava o rascunho primeiro, pára e explica
function runLDenied(){ runLFatal("denied"); }

/* ---------- visibilidade, fecho da página, ligação ---------- */
function runLOnVisibility(){
  var L = RUN.live, now = Date.now();
  if (L.phase !== "rec" && !(L.phase === "prep" && L.gpsOn)) return;
  if (runLHidden()) {
    if (L.phase === "rec" && L.st && !L.st.paused && L.hiddenAt == null) L.hiddenAt = now;
    if (L.phase === "rec") runLDraftWrite(true);
    return;
  }
  L.visibleAt = now;
  if (L.hiddenAt != null) {
    var secs = Math.max(0, (now - L.hiddenAt) / 1000);
    L.hiddenAt = null;
    L.hiddenS = Math.min(86400, L.hiddenS + secs);
    if (secs >= RUN_LIVE_CFG.hiddenNoticeMinS) L.notice = "A página esteve oculta " + runLDurWords(secs) + ": o percurso pode ter lacuna.";
    L.dirty = true;
  }
  runLWakeAcquire();
  runLPaint(now);
}
function runLOnPageHide(){
  var L = RUN.live;
  if (L.phase === "rec") runLDraftWrite(true);
}
function runLOnOnline(){
  if (runLOwnCount(true) > 0) RUN.flush();
}
function runLInstallListeners(){
  try { if (typeof document !== "undefined" && document.addEventListener) document.addEventListener("visibilitychange", runLOnVisibility); } catch (e) {}
  try { if (typeof window !== "undefined" && window.addEventListener) { window.addEventListener("pagehide", runLOnPageHide); window.addEventListener("online", runLOnOnline); } } catch (e) {}
}

/* ---------- ciclo da gravação ---------- */
// pára tudo o que corre (GPS, relógios, Wake Lock) sem mexer no armazenamento
function runLHardStop(){
  var L = RUN.live;
  runLGpsStop(); runLTickStop(); runLWakeRelease();
  if (L.pauseTimer != null) { clearTimeout(L.pauseTimer); L.pauseTimer = null; }
  if (L.lockTimer != null) { clearTimeout(L.lockTimer); L.lockTimer = null; }
}
// esquece o estado em memória (mantém o objeto RUN.live; o sid sobe para que callbacks antigos sejam ignorados)
function runLResetState(){
  var L = RUN.live, fresh = runLNew(), k, sid = L.sid + 1, flushP = L.flushP;
  for (k in L) if (Object.prototype.hasOwnProperty.call(L, k)) delete L[k];
  for (k in fresh) if (Object.prototype.hasOwnProperty.call(fresh, k)) L[k] = fresh[k];
  L.sid = sid; L.flushP = flushP;
}
// uma gravação de outra conta ficou em memória (sessão que mudou sem sair): esquece-a, sem escrever nada
function runLCheckUser(){
  var L = RUN.live, uid = runLUid();
  if (L.uid && L.uid !== uid) { runLHardStop(); runLResetState(); }
}
function runLBeginSession(s){
  var L = RUN.live;
  L.uid = runLUid(); L.stu = s || L.stu;
}
function runLStartPrepare(){
  var L = RUN.live;
  L.phase = "prep"; L.gpsOn = true; L.err = null; L.prepGood = false; L.lastCbMs = null; L.lastAcc = null; L.prepStartMs = Date.now();
  L.wlWanted = true;
  runLWakeAcquire();
  runLGpsStart();
  runLTickStart();
}
function runLStartRecording(){
  var L = RUN.live;
  L.st = runFeedInit(); L.phase = "rec"; L.ended = false; L.hiddenS = 0; L.hiddenAt = null; L.notice = ""; L.restarts = 0; L.restartLog = [];
  L.tapMs = Date.now(); L.dirty = false; L.draftOk = null; L.lastDraftMs = 0; L.notesHtml = "";
  L.wlWanted = true;
  runLWakeAcquire();
  runLTickStart();
}
function runLPause(){
  var L = RUN.live, now = Date.now();
  if (!L.st || L.st.paused || L.ended) return;
  runPause(L.st, now);
  if (L.hiddenAt != null) { L.hiddenS = Math.min(86400, L.hiddenS + Math.max(0, (now - L.hiddenAt) / 1000)); L.hiddenAt = null; }
  L.dirty = true;
  runLDraftWrite(true);
  if (L.pauseTimer != null) clearTimeout(L.pauseTimer);
  L.pauseTimer = setTimeout(function(){
    L.pauseTimer = null;
    if (L.st && L.st.paused && L.phase === "rec") runLGpsStop();     // parado há muito tempo: liberta o GPS (retomar volta a pedi-lo)
  }, RUN_LIVE_CFG.pauseReleaseMs);
  runLPaint(now);
}
function runLResume(){
  var L = RUN.live, now = Date.now();
  if (!L.st || !L.st.paused || L.ended) return;
  if (L.pauseTimer != null) { clearTimeout(L.pauseTimer); L.pauseTimer = null; }
  runResume(L.st, now);
  L.dirty = true;
  L.tapMs = now;
  if (!L.watching && !L.err) runLGpsStart();
  runLWakeAcquire();
  runLTickStart();
  runLDraftWrite(true);
  runLPaint(now);
}
function runLEndNow(){
  var L = RUN.live, now = Date.now();
  if (!L.st || L.ended) return;
  if (L.hiddenAt != null) { L.hiddenS = Math.min(86400, L.hiddenS + Math.max(0, (now - L.hiddenAt) / 1000)); L.hiddenAt = null; }
  runLGpsStop(); runLTickStop(); runLWakeRelease();
  if (L.pauseTimer != null) { clearTimeout(L.pauseTimer); L.pauseTimer = null; }
  L.ended = true; L.phase = "end"; L.locked = false; L.err = null;
  runLDraftWrite(true);
}
// descarta a gravação (rascunho incluído)
function runLDiscardAll(){
  runLHardStop();
  runLDraftClear();
  runLResetState();
}
// a corrida ficou guardada (ou na fila): o rascunho já não faz falta
function runLAfterSaved(){
  var L = RUN.live;
  if (!L.saving) return;
  runLHardStop();
  runLDraftClear();
  runLResetState();
}
// retoma um rascunho do utilizador atual (toque do aluno): o próximo fix aceite abre uma lacuna
function runLResumeDraft(s){
  var info = runLDraftInfo(), L = RUN.live, now = Date.now();
  if (!info.ok) return false;
  if (!runLiveDraftChoices(info, now, runLMode(s)).resume) return false;
  runLHardStop(); runLResetState();
  L = RUN.live;
  L.uid = runLUid(); L.stu = s;
  L.st = info.st; L.hiddenS = info.hiddenS; L.restarts = info.restarts; L.ended = false;
  L.phase = "rec"; L.gpsOn = true; L.tapMs = now; L.dirty = true; L.prepStartMs = now;
  L.wlWanted = true;
  runLWakeAcquire();
  if (!L.st.paused) runLGpsStart();
  runLTickStart();
  runLDraftWrite(true);
  return true;
}
// termina o que há num rascunho e segue para guardar
function runLDraftToEnd(s){
  var info = runLDraftInfo(), L = RUN.live;
  if (!info.ok) return false;
  if (!runLiveDraftChoices(info, Date.now(), runLMode(s)).save) return false;
  runLHardStop(); runLResetState();
  L = RUN.live;
  L.uid = runLUid(); L.stu = s;
  L.st = info.st; L.hiddenS = info.hiddenS; L.restarts = info.restarts; L.ended = true; L.phase = "end";
  return true;
}
function runLRunFromState(studentId, consentV){
  var L = RUN.live, stats = runStats(L.st.segs, null, "live");
  return {stats: stats, run: {
    id: "00000000-0000-4000-8000-000000000000", studentId: studentId || "x", source: "live", startedAtMs: stats.startedAtMs, durationS: stats.durationS, movingS: stats.movingS,
    distM: stats.distM, gaps: stats.gaps, gapS: stats.gapS, splitsS: stats.splitsS, hiddenS: Math.round(L.hiddenS), consentV: consentV || 1
  }};
}
// segue para RUN.saveFlow (o único caminho de guardar)
function runLReview(s){
  var L = RUN.live, built, chk, prep;
  s = s || L.stu;
  if (!L.st || !s) return;
  built = runLRunFromState(s.id, 1);
  chk = runCheckRun(built.run, Date.now());
  if (!chk.ok) { runLToast(chk.error); return; }
  if (typeof RUN.saveFlow !== "function") { runLToast("Não foi possível abrir o ecrã de guardar. Tenta outra vez."); return; }
  prep = {
    source: "live", stats: built.stats, segments: runLCopy(L.st.segs), hiddenS: Math.round(L.hiddenS),
    warnings: runLiveWarnings(built.stats, Math.round(L.hiddenS), L.restarts), fileDistM: null, startedAtMs: built.stats.startedAtMs,
    onSaved: function(res){ if (!res || res.ok !== false) runLAfterSaved(); },
    cancelView: {name: "live"}      // «Cancelar» no ecrã de guardar volta ao resumo da corrida (nunca a perde)
  };
  L.saving = true; L.pendStart = built.stats.startedAtMs;
  try { RUN.saveFlow(s, prep); } catch (e) { runLToast("Não foi possível abrir o ecrã de guardar. Tenta outra vez."); }
}

/* ---------- ecrãs ---------- */
var RUN_LIVE_MUSIC = "Põe a música a tocar ANTES de carregar em Iniciar e volta aqui.";
function runLCard(phase, inner){ return "<div class=\"run-live\" id=\"runLive\" data-phase=\"" + phase + "\">" + inner + "</div>"; }
function runLHead(label, backId){
  return "<div class=\"treino-head\">" + (backId ? "<button type=\"button\" class=\"btn btn-sm\" id=\"" + backId + "\">← Corrida</button>" : "<span></span>") + "<div class=\"eyebrow\">" + label + "</div></div>";
}
function runLIntroHtml(){
  return runLCard("intro", runLHead("Gravar com GPS", "runLiveBack") +
    "<div class=\"card run-live-card\"><h2 class=\"run-live-h\">Antes de começares</h2>" +
    "<p class=\"run-live-p\">Mantém a EVOLVE aberta e o ecrã ligado durante a corrida. Se o ecrã bloquear ou mudares de aplicação, o registo pode falhar e ficará uma lacuna no percurso. Ainda não testámos isto em todos os telemóveis.</p>" +
    "<p class=\"run-live-p run-live-strong\">Não garantimos que o registo continue com o ecrã bloqueado ou noutra aplicação.</p>" +
    "<p class=\"run-live-p\">" + RUN_LIVE_MUSIC + "</p>" +
    "<div class=\"run-live-btns\"><button type=\"button\" class=\"btn primary run-live-btn\" id=\"runLiveGo\">Continuar</button></div></div>");
}
function runLPrepHtml(){
  var L = RUN.live, h = runLHead("Preparar o GPS", L.gpsOn ? "" : "runLiveBack");
  if (!L.gpsOn) {
    h += "<div class=\"card run-live-card\"><h2 class=\"run-live-h\">Preparar o GPS</h2>" +
      "<p class=\"run-live-p\">Vamos pedir acesso à localização do telemóvel. Quando aparecer o pedido, escolhe «Permitir» (no iPhone, «Ao usar a app»). A localização só é usada durante esta corrida.</p>" +
      "<p class=\"run-live-p\">" + RUN_LIVE_MUSIC + "</p>" +
      "<div class=\"run-live-btns\"><button type=\"button\" class=\"btn primary run-live-btn\" id=\"runLivePrepare\">Preparar GPS</button></div></div>";
    return runLCard("prep", h);
  }
  h += "<div class=\"card run-live-card\"><h2 class=\"run-live-h\">À espera de sinal</h2>" +
    "<div id=\"runLiveSignal\" class=\"run-live-signal wait\" role=\"status\" aria-live=\"polite\">A procurar sinal…</div>" +
    "<div id=\"runLiveAcc\" class=\"run-live-acc num\">Precisão: –</div>" +
    "<p class=\"run-live-p\">Fica em campo aberto até aparecer «Sinal bom». Depois carrega em Iniciar e começa a correr.</p>" +
    "<div id=\"runLiveHelp\" class=\"run-live-help hidden\" role=\"note\"><b>Ainda sem posição?</b> Verifica as permissões de localização." +
    "<br>iPhone: Definições → Privacidade e segurança → Serviços de Localização → «Sites do Safari» (ou a EVOLVE no ecrã principal) em «Ao usar a app», com Localização Precisa ligada. Isto vem de relatos e não está confirmado em todos os iPhones." +
    "<br>Android: Definições → Localização ligada e, no navegador, Permissões do site → Localização → Permitir.</div>" +
    "<p class=\"run-live-p\">" + RUN_LIVE_MUSIC + "</p>" +
    "<div class=\"run-live-btns\"><button type=\"button\" class=\"btn primary run-live-btn\" id=\"runLiveStart\" disabled>Iniciar</button>" +
    "<button type=\"button\" class=\"btn run-live-btn\" id=\"runLiveCancel\">Cancelar</button></div>" +
    (L.err ? "<div class=\"run-live-note warn\" role=\"alert\"><span>" + (L.err === "denied" ? "A localização foi recusada. Ativa-a nas definições e tenta outra vez." : "Não consegui ligar o GPS.") + "</span></div>" +
      "<div class=\"run-live-btns\"><button type=\"button\" class=\"btn run-live-btn\" id=\"runLiveRetry\">Tentar outra vez</button></div>" : "") +
    "</div>";
  return runLCard("prep", h);
}
function runLRecHtml(){
  var L = RUN.live, now = Date.now(), v = runLiveView(L.st, now), paused = v.paused, h = "", btns = "";
  if (L.err) {
    var canSave = L.st.nPts >= 2;
    btns = "<div class=\"run-live-note warn\" role=\"alert\"><span>" + (L.err === "denied" ?
        "A localização foi recusada e a gravação parou. O que já foi gravado está guardado neste telemóvel. Ativa a localização nas definições e tenta outra vez." :
        "O GPS deixou de funcionar. O que já foi gravado está guardado neste telemóvel.") + "</span></div>" +
      "<div class=\"run-live-btns\"><button type=\"button\" class=\"btn primary run-live-btn\" id=\"runLiveRetry\">Tentar outra vez</button>" +
      (canSave ? "<button type=\"button\" class=\"btn run-live-btn\" id=\"runLiveEnd\">Terminar e guardar o que há</button>" : "") +
      "<button type=\"button\" class=\"btn run-live-btn\" id=\"runLiveDiscard\">Descartar</button></div>";
  } else {
    btns = "<div class=\"run-live-btns\"><button type=\"button\" class=\"btn primary run-live-btn\" id=\"runLivePause\">" + (paused ? "Retomar" : "Pausa") + "</button>" +
      "<button type=\"button\" class=\"btn run-live-btn run-live-end\" id=\"runLiveEnd\">Terminar</button></div>" +
      "<div class=\"run-live-btns\"><button type=\"button\" class=\"btn run-live-btn\" id=\"runLiveLockBtn\">Bloquear toques</button></div>";
  }
  h += runLHead("A gravar" + (paused ? " · em pausa" : ""), "");
  h += "<div id=\"runLiveSignal\" class=\"run-live-signal wait\" role=\"status\" aria-live=\"polite\">A procurar sinal…</div>";
  h += "<div class=\"run-live-big\">" +
    "<div class=\"run-live-tile\"><div class=\"run-live-label\">Tempo</div><div class=\"run-live-num run-live-time num\" id=\"runLiveTime\">" + escapeHtml(runDurStr(v.elapsedS)) + "</div></div>" +
    "<div class=\"run-live-tile\"><div class=\"run-live-label\">Distância</div><div class=\"run-live-num num\" id=\"runLiveDist\">" + escapeHtml(runDistStr(v.distM)) + "</div></div>" +
    "<div class=\"run-live-tile\"><div class=\"run-live-label\">Ritmo médio (min/km)</div><div class=\"run-live-num num\" id=\"runLivePace\">" + escapeHtml(runPaceStr(v.paceSPerKm)) + "</div></div></div>";
  h += "<div class=\"run-live-gaps\" id=\"runLiveGaps\">Lacunas: " + v.gaps + (v.gaps ? " (" + escapeHtml(runLDurWords(v.gapS)) + " sem posições)" : "") + "</div>";
  L.notesHtml = runLNotesHtml();
  h += "<div id=\"runLiveNotes\" aria-live=\"polite\">" + L.notesHtml + "</div>";
  h += btns;
  h += "<p class=\"run-live-foot\">" + RUN_LIVE_MUSIC + " Se mudares de aplicação, o registo pode falhar.</p>";
  if (L.locked) {
    h += "<div class=\"run-live-lock\" id=\"runLiveLock\" role=\"dialog\" aria-label=\"Toques bloqueados\"><div class=\"run-live-lock-msg\"><b>Toques bloqueados</b><span>Mantém o dedo premido cerca de 1,5 s para desbloquear.</span><i class=\"run-live-lock-bar\"></i></div></div>";
  }
  return runLCard("rec", h);
}
function runLEndHtml(){
  var L = RUN.live, built = runLRunFromState(L.stu ? L.stu.id : "x", 1), stats = built.stats, chk = runCheckRun(built.run, Date.now()), h = "", warns;
  h += runLHead("Corrida terminada", "");
  h += "<div class=\"card run-live-card\"><h2 class=\"run-live-h\">Resumo</h2><div class=\"run-live-big\">" +
    "<div class=\"run-live-tile\"><div class=\"run-live-label\">Distância</div><div class=\"run-live-num num\">" + escapeHtml(runDistStr(stats.distM)) + "</div></div>" +
    "<div class=\"run-live-tile\"><div class=\"run-live-label\">Tempo</div><div class=\"run-live-num num\">" + escapeHtml(runDurStr(stats.durationS)) + "</div></div>" +
    "<div class=\"run-live-tile\"><div class=\"run-live-label\">Ritmo médio (min/km)</div><div class=\"run-live-num num\">" + escapeHtml(runPaceStr(runPaceOf(stats.distM, stats.movingS))) + "</div></div></div>";
  warns = runLiveWarnings(stats, Math.round(L.hiddenS), L.restarts);
  warns.forEach(function(w){ h += "<p class=\"run-live-p run-live-warn\">" + escapeHtml(w) + "</p>"; });
  if (stats.points < 2) h += "<p class=\"run-live-p run-live-warn\" role=\"alert\">Não houve posições suficientes para guardar esta corrida.</p>";
  else if (!chk.ok) h += "<p class=\"run-live-p run-live-warn\" role=\"alert\">Esta corrida não pode ser guardada: " + escapeHtml(chk.error) + "</p>";
  h += "<div class=\"run-live-btns\">" + (chk.ok && stats.points >= 2 ? "<button type=\"button\" class=\"btn primary run-live-btn\" id=\"runLiveReview\">Rever e guardar</button>" : "") +
    "<button type=\"button\" class=\"btn run-live-btn\" id=\"runLiveDiscard\">Descartar</button></div></div>";
  return runLCard("end", h);
}
function runLiveScreen(sv){
  var L = RUN.live, info;
  if (typeof authRole !== "undefined" && authRole === "professional") {
    return runLCard("preview", "<div class=\"card run-live-card\"><div class=\"eyebrow\">Gravar com GPS</div><p class=\"muted-p\">Pré-visualização: só o aluno pode gravar corridas.</p></div>");
  }
  if (runLMode(sv) !== "live") {
    return runLCard("off", runLHead("Gravar com GPS", "runLiveBack") + "<div class=\"card run-live-card\"><p class=\"muted-p\">A gravação com GPS não está ligada para ti. O teu profissional liga-a quando for altura.</p></div>");
  }
  runLCheckUser();
  if (L.phase === "rec" && L.st) return runLRecHtml();
  if (L.phase === "end" && L.st) return runLEndHtml();
  if (L.phase === "prep") return runLPrepHtml();
  info = runLDraftInfo();   // há uma corrida por terminar neste telemóvel: não se começa outra por cima (nunca se apaga em silêncio)
  if (info.ok || info.reason === "unusable") {
    return runLCard("draft", runLHead("Gravar com GPS", "runLiveBack") +
      "<p class=\"run-live-p\">Antes de gravares outra corrida, resolve a que ficou por terminar neste telemóvel.</p>" + runLiveDraftBanner(sv));
  }
  return runLIntroHtml();
}

/* ---------- ligação dos eventos do ecrã ---------- */
function runLOn(el, id, fn){
  var b = el && el.querySelector ? el.querySelector("#" + id) : null;
  if (b) b.addEventListener("click", fn);
  return b;
}
function runLAskEnd(s){
  var sheet = openModal("<div class=\"mtitle\">Terminar a corrida?</div><p class=\"muted-p\">Vais passar ao resumo para a guardares. Se ainda não acabaste, continua a correr.</p>" +
    "<div class=\"run-live-btns\"><button type=\"button\" class=\"btn run-live-btn\" id=\"runLiveContinue\">Continuar a correr</button>" +
    "<button type=\"button\" class=\"btn primary run-live-btn\" id=\"runLiveEndOk\">Terminar</button></div>", {centered: true});
  sheet.querySelector("#runLiveContinue").addEventListener("click", closeModal);
  sheet.querySelector("#runLiveEndOk").addEventListener("click", function(){
    closeModal();
    runLEndNow();
    runLRenderForce();
  });
}
function runLAskDiscard(){
  if (!window.confirm("Descartar esta corrida? Não dá para desfazer.")) return false;
  runLDiscardAll();
  return true;
}
function runLWireLock(lk){
  var L = RUN.live;
  function stopHold(){
    if (L.lockTimer != null) { clearTimeout(L.lockTimer); L.lockTimer = null; }
    lk.classList.remove("holding");
    if (L.unlockPending) {      // largou o dedo depois dos ~1,5 s: desbloqueia sem deixar o toque chegar aos botões de baixo
      L.unlockPending = false; L.locked = false;
      setTimeout(function(){ if (lk.parentNode) lk.parentNode.removeChild(lk); }, 80);
    }
  }
  function startHold(e){
    if (e && e.preventDefault) e.preventDefault();
    if (L.lockTimer != null) clearTimeout(L.lockTimer);
    lk.classList.add("holding");
    L.lockTimer = setTimeout(function(){
      L.lockTimer = null; L.unlockPending = true;
      lk.classList.remove("holding"); lk.classList.add("released");
    }, RUN_LIVE_CFG.lockHoldMs);
  }
  lk.addEventListener("pointerdown", startHold);
  lk.addEventListener("pointerup", stopHold);
  lk.addEventListener("pointercancel", stopHold);
  lk.addEventListener("pointerleave", stopHold);
  lk.addEventListener("contextmenu", function(e){ e.preventDefault(); });
}
function runLiveWire(s, el){
  var L = RUN.live, notes;
  if (!el) return;
  L.stu = s;
  runLOn(el, "runLiveBack", function(){ if (L.phase === "prep" && L.gpsOn) return; if (L.phase === "prep") L.phase = "intro"; RUN.go("home"); });
  runLOn(el, "runLiveGo", function(){
    var now = Date.now(), sid = L.sid;
    if (now - L.consentAt < 600) return;      // duplo toque
    L.consentAt = now;
    if (typeof RUN.ensureConsent !== "function") { runLToast("Não foi possível abrir a Corrida. Tenta outra vez."); return; }
    try {
      RUN.ensureConsent(s, function(){
        if (sid !== RUN.live.sid || RUN.live.phase !== "intro") return;
        runLBeginSession(s);
        RUN.live.phase = "prep";
        runLRenderForce();
      });
    } catch (e) { runLToast("Não foi possível abrir a Corrida. Tenta outra vez."); }
  });
  runLOn(el, "runLivePrepare", function(){ runLBeginSession(s); runLStartPrepare(); runLRenderForce(); });
  runLOn(el, "runLiveCancel", function(){ runLHardStop(); runLResetState(); RUN.go("home"); });
  runLOn(el, "runLiveRetry", function(){
    L.err = null;
    if (L.phase === "prep") { L.lastCbMs = null; L.prepStartMs = Date.now(); }
    L.wlWanted = true; runLWakeAcquire();
    runLGpsStart(); runLTickStart(); runLRenderForce();
  });
  runLOn(el, "runLiveStart", function(){
    if (!(L.prepGood && L.watching && !L.err)) return;
    runLStartRecording();
    runLRenderForce();
  });
  runLOn(el, "runLivePause", function(){
    if (L.st && L.st.paused) runLResume(); else runLPause();
    runLRenderForce();
  });
  runLOn(el, "runLiveEnd", function(){ runLAskEnd(s); });
  runLOn(el, "runLiveLockBtn", function(){ L.locked = true; runLRenderForce(); });
  runLOn(el, "runLiveReview", function(){ runLReview(s); });
  runLOn(el, "runLiveDiscard", function(){ if (runLAskDiscard()) RUN.go("home"); });
  notes = el.querySelector ? el.querySelector("#runLiveNotes") : null;
  if (notes) notes.addEventListener("click", function(e){
    var t = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
    if (t && t.getAttribute("data-act") === "dismiss") { L.notice = ""; runLPaint(Date.now()); }
  });
  var lk = el.querySelector ? el.querySelector("#runLiveLock") : null;
  if (lk) runLWireLock(lk);
  if (el.querySelector && el.querySelector("#runLiveBanner")) RUN.liveWireBanner(s, el);
  if (L.phase === "rec" || (L.phase === "prep" && L.gpsOn)) { runLTickStart(); runLPaint(Date.now()); }
}

/* ---------- fila de envio (armazenamento, envio, aviso) ---------- */
function runLQueueRead(){ return runLiveQueueParse(runLGet(RUN_OUTBOX_KEY)).list; }
function runLQueueWrite(list){
  var text;
  try { text = JSON.stringify(list); } catch (e) { return false; }
  if (!list.length) { runLDel(RUN_OUTBOX_KEY); return true; }
  return runLSet(RUN_OUTBOX_KEY, text);
}
// entradas do utilizador atual; onlyPending = true deixa de fora as recusadas (state «failed»)
function runLOwn(onlyPending){
  var uid = runLUid(), out = [], list = runLQueueRead(), i;
  if (!uid) return out;
  for (i = 0; i < list.length; i++) if (list[i].uid === uid && (!onlyPending || list[i].state !== "failed")) out.push(list[i]);
  return out;
}
function runLOwnCount(onlyPending){ return runLOwn(!!onlyPending).length; }
function runLQueueHas(id){
  var own = runLOwn(false), i;
  for (i = 0; i < own.length; i++) if (own[i].id === id) return true;
  return false;
}
function runLQueueRemove(id){
  var uid = runLUid(), list = runLQueueRead(), out = [], i;
  for (i = 0; i < list.length; i++) if (!(list[i].id === id && list[i].uid === uid)) out.push(list[i]);
  runLQueueWrite(out);
}
function runLQueueMark(id, state, err){
  var uid = runLUid(), list = runLQueueRead(), i;
  for (i = 0; i < list.length; i++) if (list[i].id === id && list[i].uid === uid) { list[i].state = state; list[i].err = err || ""; }
  runLQueueWrite(list);
}
function runLErrText(e){
  var code = e && e.code ? String(e.code) : "";
  if (code === "42501") return "A Corrida pode ter sido desativada para ti ou falta o consentimento. Fala com o teu profissional.";
  if (code === "23503") return "Falta o consentimento da Corrida.";
  if (code === "PGRST205" || code === "42P01") return "Corrida indisponível por agora. Volta a tentar mais tarde.";
  if (code === "23514" || code === "22001" || code === "22003" || code === "22P02") return "O servidor recusou esta corrida (valores fora do permitido).";
  return "O servidor recusou esta corrida.";
}
// «ok» | «dup» (23505: já chegou) | «transient» | «permanent»
function runLClassify(res){
  var e = res && res.error, tr;
  if (!e) return {kind: "ok"};
  if (e.code === "23505") return {kind: "dup"};
  tr = typeof outboxErrorIsTransient === "function" ? outboxErrorIsTransient(res) : (!res.status || res.status >= 500 || res.status === 401 || res.status === 408 || res.status === 429);
  return tr ? {kind: "transient"} : {kind: "permanent", text: runLErrText(e)};
}
function runLCall(builder){
  var p;
  try { p = typeof withTimeout === "function" ? withTimeout(builder, RUN_LIVE_CFG.sendTimeoutMs) : Promise.resolve(builder); } catch (e) { return Promise.resolve({error: {message: "failed", code: ""}, status: 0}); }
  return p.then(function(r){ return r || {error: {message: "sem resposta", code: ""}, status: 0}; }, function(){ return {error: {message: "timeout", code: ""}, status: 0}; });
}
// {ok:true} | {ok:false, transient:true} | {ok:false, transient:false, error}
function runLSendEntry(entry){
  var row = entry.item.row, tr = entry.item.track, first;
  try { first = runLCall(sb.from("runs").insert(row)); } catch (e) { return Promise.resolve({ok: false, transient: true}); }
  return first.then(function(r1){
    var c1 = runLClassify(r1);
    if (c1.kind === "transient") return {ok: false, transient: true};
    if (c1.kind === "permanent") return {ok: false, transient: false, error: c1.text};
    if (!tr) return {ok: true};
    var second;
    try { second = runLCall(sb.from("run_tracks").insert({run_id: row.id, student_id: row.student_id, fmt: 1, trim_m: tr.trimM, points: tr.segments})); } catch (e) { return {ok: false, transient: true}; }
    return second.then(function(r2){
      var c2 = runLClassify(r2);
      if (c2.kind === "transient") return {ok: false, transient: true};
      return {ok: true, trackLost: c2.kind === "permanent"};
    });
  });
}
// entradas da fila que não se poderiam enviar nunca (lixo): tiram-se, para o aviso do núcleo («corrida por enviar») não ficar a contá-las
function runLQueueRepair(){
  var raw = runLGet(RUN_OUTBOX_KEY), parsed;
  if (raw == null || raw === "") return;
  parsed = runLiveQueueParse(raw);
  if (!parsed.bad && parsed.dropped > 0) runLQueueWrite(parsed.list);
}
function runLFlushRun(){
  var uid = runLUid(), sent = 0, failed = 0, lost = 0;
  runLQueueRepair();
  if (!uid || typeof sb === "undefined" || !sb || typeof sbReady === "undefined" || !sbReady) return Promise.resolve({sent: 0, failed: 0, left: runLOwnCount(true), reason: "nosb"});
  if (typeof navigator !== "undefined" && navigator.onLine === false) return Promise.resolve({sent: 0, failed: 0, left: runLOwnCount(true), reason: "offline"});
  function next(){
    var own = runLOwn(true), entry = own.length ? own[0] : null;
    if (!entry) return Promise.resolve();
    return runLSendEntry(entry).then(function(r){
      if (r.ok) { runLQueueRemove(entry.id); sent++; if (r.trackLost) lost++; return next(); }
      if (r.transient) return null;     // sem ligação ou servidor ocupado: mantém e pára
      runLQueueMark(entry.id, "failed", r.error); failed++;
      return next();
    });
  }
  return next().then(function(){
    if (lost) runLToast("A corrida foi enviada, mas o percurso não.");
    else if (sent) runLToast(sent === 1 ? "Corrida enviada." : sent + " corridas enviadas.");
    return {sent: sent, failed: failed, left: runLOwnCount(true)};
  });
}
function runLiveFlush(){
  var L = RUN.live;
  if (L.flushP) return L.flushP;
  var p;
  try { p = runLFlushRun(); } catch (e) { p = Promise.resolve({sent: 0, failed: 0, left: 0, reason: "error"}); }
  L.flushP = p.then(function(r){ RUN.live.flushP = null; runLRefreshBanner(); return r; }, function(){ RUN.live.flushP = null; return {sent: 0, failed: 0, left: 0, reason: "error"}; });
  return L.flushP;
}
function runLiveQueueAddPublic(item){
  var uid = runLUid(), res, ok;
  if (!uid) return false;
  res = runLiveQueueAdd(runLQueueRead(), item, uid, Date.now());
  if (!res.ok) return false;
  if (res.dup) return true;
  ok = runLQueueWrite(res.list);
  return ok && runLQueueHas(res.list[res.list.length - 1].id);
}

/* ---------- aviso no topo da vista «home» ---------- */
function runLRunSummary(stats){
  return "<b>" + escapeHtml(runDistStr(stats.distM)) + "</b> em <b>" + escapeHtml(runDurStr(stats.durationS)) + "</b>";
}
function runLBannerSession(s){
  var L = RUN.live, now = Date.now(), v, built, h = "";
  if (L.phase === "rec" && L.st) {
    v = runLiveView(L.st, now);
    h = "<div class=\"card run-live-banner\" data-kind=\"active\"><div class=\"eyebrow\">Corrida a decorrer</div>" +
      "<p class=\"muted-p\">Estás a gravar uma corrida neste telemóvel" + (v.paused ? " (em pausa)" : "") + ": " + runLRunSummary({distM: v.distM, durationS: v.elapsedS}) + ".</p>" +
      "<div class=\"run-live-btns\"><button type=\"button\" class=\"btn primary run-live-btn\" data-act=\"back\">Voltar à gravação</button></div></div>";
  } else if (L.phase === "end" && L.st) {
    built = runLRunFromState(s ? s.id : "x", 1);
    h = "<div class=\"card run-live-banner\" data-kind=\"ended\"><div class=\"eyebrow\">Corrida por guardar</div>" +
      "<p class=\"muted-p\">Terminaste uma corrida que ainda não foi guardada: " + runLRunSummary(built.stats) + ".</p>" +
      "<div class=\"run-live-btns\"><button type=\"button\" class=\"btn primary run-live-btn\" data-act=\"review\">Rever e guardar</button>" +
      "<button type=\"button\" class=\"btn run-live-btn\" data-act=\"discard\">Descartar</button></div></div>";
  } else if (L.phase === "prep" && L.gpsOn) {
    h = "<div class=\"card run-live-banner\" data-kind=\"prep\"><div class=\"eyebrow\">Corrida</div><p class=\"muted-p\">O GPS está a ser preparado para uma corrida.</p>" +
      "<div class=\"run-live-btns\"><button type=\"button\" class=\"btn primary run-live-btn\" data-act=\"back\">Voltar</button></div></div>";
  }
  return h;
}
function runLBannerDraft(s){
  var info = runLDraftInfo(), ch, h;
  if (info.ok) {
    ch = runLiveDraftChoices(info, Date.now(), runLMode(s));
    h = "<div class=\"card run-live-banner\" data-kind=\"draft\"><div class=\"eyebrow\">Há uma corrida por terminar</div>" +
      "<p class=\"muted-p\">" + (info.ended ? "Terminaste uma corrida" : "Ficou uma corrida a meio") + " neste telemóvel que ainda não foi guardada: " + runLRunSummary(info.stats) +
      (info.startedAtMs != null ? ", começada a " + escapeHtml(runLWhen(info.startedAtMs)) : "") + ".</p>" +
      (ch.why ? "<p class=\"muted-p\">" + escapeHtml(ch.why) + "</p>" : "") +
      (!ch.save && ch.saveError && runLMode(s) === "live" ? "<p class=\"muted-p\">Não dá para guardar o que há: " + escapeHtml(ch.saveError) + "</p>" : "") +
      "<div class=\"run-live-btns\">" +
      (ch.resume ? "<button type=\"button\" class=\"btn primary run-live-btn\" data-act=\"resume\">Retomar</button>" : "") +
      (ch.save ? "<button type=\"button\" class=\"btn" + (ch.resume ? "" : " primary") + " run-live-btn\" data-act=\"save\">Guardar o que há</button>" : "") +
      "<button type=\"button\" class=\"btn run-live-btn\" data-act=\"discard\">Descartar</button></div></div>";
    return h;
  }
  if (info.reason === "unusable") {
    return "<div class=\"card run-live-banner\" data-kind=\"unusable\"><div class=\"eyebrow\">Há uma corrida por terminar</div>" +
      "<p class=\"muted-p\">O registo guardado neste telemóvel não tem posições aproveitáveis e não dá para o recuperar.</p>" +
      "<div class=\"run-live-btns\"><button type=\"button\" class=\"btn run-live-btn\" data-act=\"discard\">Descartar</button></div></div>";
  }
  return "";
}
function runLBannerQueue(){
  var own = runLOwn(false), pending = 0, h = "", i, e, row;
  for (i = 0; i < own.length; i++) if (own[i].state !== "failed") pending++;
  if (pending) {
    h += "<div class=\"card run-live-banner\" data-kind=\"queue\"><div class=\"eyebrow\">Corridas por enviar</div>" +
      "<p class=\"muted-p\">" + escapeHtml(runLPlural(pending, "corrida está", "corridas estão")) + " guardada" + (pending === 1 ? "" : "s") + " neste telemóvel à espera de ligação para ser" + (pending === 1 ? "" : "em") + " enviada" + (pending === 1 ? "" : "s") + ".</p>" +
      "<div class=\"run-live-btns\"><button type=\"button\" class=\"btn run-live-btn\" data-act=\"retry\">Tentar enviar agora</button></div></div>";
  }
  for (i = 0; i < own.length; i++) {
    e = own[i];
    if (e.state !== "failed") continue;
    row = e.item.row;
    h += "<div class=\"card run-live-banner\" data-kind=\"failed\" data-id=\"" + escapeHtml(e.id) + "\"><div class=\"eyebrow\">Não foi possível guardar</div>" +
      "<p class=\"muted-p\">Uma corrida de " + escapeHtml(runLWhen(Date.parse(row.started_at))) + " (" + escapeHtml(runDistStr(row.distance_m)) + ", " + escapeHtml(runDurStr(row.duration_s)) + ") não foi aceite." +
      (e.err ? " " + escapeHtml(e.err) : "") + "</p>" +
      "<div class=\"run-live-btns\"><button type=\"button\" class=\"btn run-live-btn\" data-act=\"del\" data-id=\"" + escapeHtml(e.id) + "\">Apagar</button></div></div>";
  }
  return h;
}
function runLBannerInner(s){
  var session = runLBannerSession(s);
  return (session || runLBannerDraft(s)) + runLBannerQueue();
}
function runLiveDraftBanner(s){
  var inner = runLBannerInner(s);
  return inner ? "<div id=\"runLiveBanner\" class=\"run-live-banner-wrap\">" + inner + "</div>" : "";
}
// põe o aviso em dia no sítio (depois de enviar a fila); se ainda não havia aviso e o aluno está na vista «home», desenha-a de novo
function runLRefreshBanner(){
  var s = RUN.live.stu, root, inner;
  try {
    if (typeof document === "undefined") return;
    root = document.getElementById("runLiveBanner");
    if (!s && typeof findStudent === "function" && typeof state !== "undefined") s = findStudent(state.alunoStudentId);
    inner = runLBannerInner(s);
    if (root) {
      if (inner) root.innerHTML = inner;
      else if (root.parentNode) root.parentNode.removeChild(root);
    } else if (inner && RUN.v && RUN.v.name === "home" && typeof RUN.go === "function" && typeof APP_MODE !== "undefined" && APP_MODE === "treino" && state.alunoTab === "corrida") {
      RUN.go("home");
    }
  } catch (e) {}
}
function runLiveWireBanner(s, el){
  var root = el && el.querySelector ? el.querySelector("#runLiveBanner") : null, L = RUN.live, now = Date.now();
  if (root) root.addEventListener("click", function(e){
    var t = e.target && e.target.closest ? e.target.closest("[data-act]") : null, act = t ? t.getAttribute("data-act") : "";
    if (!act) return;
    if (act === "back") { RUN.go("live"); return; }
    if (act === "review") { runLReview(s); return; }
    if (act === "resume") { if (runLResumeDraft(s)) RUN.go("live"); else { runLToast("Não foi possível retomar esta corrida."); runLRefreshBanner(); } return; }
    if (act === "save") {
      if (runLDraftToEnd(s)) runLReview(s); else { runLToast("Não foi possível guardar o que há."); runLRefreshBanner(); }
      return;
    }
    if (act === "discard") {
      if (!window.confirm("Descartar esta corrida? Não dá para desfazer.")) return;
      runLHardStop(); runLDraftClear(); runLResetState();
      RUN.go(RUN.v && RUN.v.name ? RUN.v.name : "home");
      return;
    }
    if (act === "del") {
      if (!window.confirm("Apagar esta corrida que não foi possível guardar? Não dá para desfazer.")) return;
      runLQueueRemove(t.getAttribute("data-id"));
      runLRefreshBanner();
      return;
    }
    if (act === "retry") { RUN.flush(); return; }
  });
  if (runLOwnCount(true) > 0 && !L.flushP && now - L.lastOpenFlush > 3000) { L.lastOpenFlush = now; RUN.flush(); }
}

/* ---------- embrulho de RUN.submitRun: saber quando a corrida ao vivo ficou guardada ---------- */
function runLSameRun(row){
  var L = RUN.live, t = row && typeof row.started_at === "string" ? Date.parse(row.started_at) : NaN;
  return L.saving && L.pendStart != null && isFinite(t) && Math.abs(t - L.pendStart) < 2000;
}
function runLAfterSubmit(item, res){
  var row = item && item.row;
  if (res && res.ok === true && row) {
    if (res.queued === true && !runLQueueHas(row.id)) {
      return {ok: false, permanent: false, error: "Sem ligação e sem espaço para guardar esta corrida neste telemóvel. Não feches a app e tenta outra vez."};
    }
    if (row.source === "live" && runLSameRun(row)) runLAfterSaved();
  }
  return res;
}
function runLWrapSubmit(){
  var orig = RUN.submitRun;
  if (typeof orig !== "function" || orig.runLiveWrapped) return;
  var wrapped = function(s, item){
    var p;
    try { p = orig.call(RUN, s, item); } catch (e) { return Promise.resolve({ok: false, permanent: false, error: "Não foi possível guardar. Tenta outra vez."}); }
    return Promise.resolve(p).then(function(res){ return runLAfterSubmit(item, res); }, function(){ return {ok: false, permanent: false, error: "Não foi possível guardar. Tenta outra vez."}; });
  };
  wrapped.runLiveWrapped = true;
  RUN.submitRun = wrapped;
}

/* ---------- API ---------- */
RUN.liveOpen = function(s){
  if (typeof authRole !== "undefined" && authRole === "professional") { runLToast("Só o aluno pode gravar corridas."); return; }
  if (runLMode(s) !== "live") { runLToast("A gravação com GPS não está ligada para ti."); return; }
  RUN.live.stu = s;
  runLCheckUser();
  if (typeof RUN.go === "function") RUN.go("live");
};
RUN.liveScreen = runLiveScreen;
RUN.liveWire = runLiveWire;
RUN.liveDraftBanner = runLiveDraftBanner;
RUN.liveWireBanner = runLiveWireBanner;
RUN.queueAdd = runLiveQueueAddPublic;
RUN.queuePending = function(){ return runLOwnCount(true); };
RUN.queueFailed = function(){ return runLOwnCount(false) - runLOwnCount(true); };
RUN.flush = runLiveFlush;
RUN.reset = function(){
  runLHardStop();
  runLResetState();
  try { if (typeof RUN.uiReset === "function") RUN.uiReset(); } catch (e) {}      // o que corrida.js guarda em memória também se esquece (por omissão RUN.reset era isto)
  try { if (RUN.v && RUN.v.name === "live") RUN.v = {name: "home"}; } catch (e) {}
};
runLWrapSubmit();
runLInstallListeners();
RUN.loaded = true;
