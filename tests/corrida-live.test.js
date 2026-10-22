// Corrida ao vivo (corrida-live.js): as partes puras (rascunho, fila, avisos, escolhas) e a máquina de estados do gravador, em Node, SEM browser.
// A máquina corre dentro de uma caixa: o núcleo (corrida-core.js) e o gravador avaliados juntos em modo estrito, com um relógio e temporizadores
// falsos (avançam à mão), um adaptador de GPS injetado com séries sintéticas, um localStorage em memória, um Supabase simulado e um DOM mínimo.
// O que isto prova: a lógica (estados, rascunho, fila, vigia, erros, lacunas, privacidade). O que NÃO prova: o DOM real, o Chromium (tests/corrida-live-browser.test.js)
// nem nenhum telemóvel: nada aqui diz se o GPS continua com o ecrã bloqueado.
var fs = require("fs"), path = require("path");
var check = require("./check")();
var root = path.join(__dirname, "..");
var n = 0;
function ck(desc, cond){ n++; if (parseInt(desc, 10) !== n) console.log("AVISO: verificação numerada " + parseInt(desc, 10) + " na posição " + n); check.check(desc, !!cond); }
function read(f){ return fs.readFileSync(path.join(root, f), "utf8"); }

var coreSrc = read("corrida-core.js"), liveSrc = read("corrida-live.js");
var RealDate = Date;
var T0 = Date.UTC(2026, 9, 22, 7, 0, 0);          // 22/10/2026 07:00 UTC
var LAT0 = 38.7, LON0 = -9.1, M_LAT = Math.PI / 180 * 6371008.8;
var U1 = "user-1", U2 = "user-2";
var RID1 = "11111111-1111-4111-8111-111111111111", RID2 = "22222222-2222-4222-8222-222222222222", RID3 = "33333333-3333-4333-8333-333333333333", RID4 = "44444444-4444-4444-8444-444444444444";

// ---------------------------------------------------------------- caixa
function memStore(init, o){
  var d = {}, k, st;
  o = o || {};
  for (k in (init || {})) d[k] = init[k];
  st = {
    sets: 0, setKeys: [], d: d,
    getItem: function(key){ return Object.prototype.hasOwnProperty.call(d, key) ? d[key] : null; },
    setItem: function(key, v){ if (st.failSet) throw new Error("QuotaExceededError"); st.sets++; st.setKeys.push(key); d[key] = String(v); },
    removeItem: function(key){ delete d[key]; }
  };
  return st;
}
// elemento falso: guarda os ouvintes e deixa «carregar»
function makeEl(id, html){
  var re = new RegExp("id=\"" + id + "\"[^>]*>"), m = re.exec(html), tag = m ? m[0] : "", cls = /class="([^"]*)"/.exec(tag);
  var el = {
    id: id, textContent: "", innerHTML: "", className: cls ? cls[1] : "", disabled: /\sdisabled(\s|>|=)/.test(tag), listeners: {}, removed: false, hiddenClass: false,
    addEventListener: function(t, f){ (el.listeners[t] = el.listeners[t] || []).push(f); },
    classList: {
      toggle: function(c, on){ if (c === "hidden") el.hiddenClass = !!on; },
      add: function(c){ el.className += " " + c; }, remove: function(c){ el.className = el.className.split(" ").filter(function(x){ return x !== c; }).join(" "); }
    },
    fire: function(t, ev){ (el.listeners[t] || []).forEach(function(f){ f(ev || {preventDefault: function(){}}); }); },
    click: function(){ el.fire("click"); },
    parentNode: null
  };
  el.parentNode = {removeChild: function(){ el.removed = true; }};
  return el;
}
function fakeRoot(html){
  var els = {}, re = /id="([A-Za-z0-9_-]+)"/g, m;
  while ((m = re.exec(html))) els[m[1]] = makeEl(m[1], html);
  return {html: html, els: els, querySelector: function(sel){ return sel.charAt(0) === "#" ? (els[sel.slice(1)] || null) : null; }, querySelectorAll: function(){ return []; }};
}
function fakeGps(){
  var g = {starts: 0, stops: 0, onFix: null, onErr: null, log: [],
    start: function(a, b){ g.starts++; g.onFix = a; g.onErr = b; g.log.push("start"); },
    stop: function(){ g.stops++; g.onFix = null; g.onErr = null; g.log.push("stop"); }};
  return g;
}
var PURE = ["runLiveDraftBuild", "runLiveDraftSerialize", "runLiveDraftParse", "runLiveDraftChoices", "runLiveTrackClean", "runLiveQueueItem", "runLiveQueueParse", "runLiveQueueAdd",
  "runLiveFixFromPosition", "runLiveSignalInfo", "runLiveWarnings", "runLDurWords", "runLWhen", "runFeedInit", "runFeed", "runStats", "runBuildInsert", "runPrepareTrack", "runUuid", "runHav", "runCheckRun",
  "runLiveFlush", "runLiveScreen", "runLiveWire", "runLiveDraftBanner", "runLiveWireBanner", "RUN_LIVE_CFG", "RUN_CFG",
  "runLiveClampT", "runLiveDraftPeek", "runLiveDraftOwner", "runLiveCutOffer", "runCutAtLastGap", "runLInst"];
var PARAMS = ["RUN", "currentAuthUserId", "authRole", "escapeHtml", "showToast", "openModal", "closeModal", "corridaModeOf", "sb", "sbReady", "outboxErrorIsTransient", "withTimeout", "findStudent", "state", "APP_MODE",
  "RUN_DRAFT_KEY", "RUN_OUTBOX_KEY", "RUN_CONSENT_KEY", "window", "document", "navigator", "Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "console"];
var BUILD = new Function(PARAMS.join(","), "\"use strict\";\n" + coreSrc + "\n" + liveSrc + "\nreturn {" + PURE.map(function(x){ return x + ": " + x; }).join(", ") +
  ", setUid: function(v){ currentAuthUserId = v; }, setMode: function(v){ authRole = v; }, setSb: function(v){ sb = v; }, setSbReady: function(v){ sbReady = v; }};");

function makeBox(o){
  o = o || {};
  var clock = {now: o.now != null ? o.now : T0}, timers = {seq: 0, list: []};
  var FD = function(){ var a = [].slice.call(arguments); return a.length ? new (Function.prototype.bind.apply(RealDate, [null].concat(a)))() : new RealDate(clock.now); };
  FD.now = function(){ return clock.now; }; FD.parse = RealDate.parse; FD.UTC = RealDate.UTC;
  function fSetTimeout(fn, ms){ var id = ++timers.seq; timers.list.push({id: id, at: clock.now + (ms || 0), fn: fn, every: 0}); return id; }
  function fSetInterval(fn, ms){ var id = ++timers.seq; timers.list.push({id: id, at: clock.now + ms, fn: fn, every: ms}); return id; }
  function fClear(id){ timers.list = timers.list.filter(function(t){ return t.id !== id; }); }
  var box = {clock: clock, timers: timers, store: o.store || memStore(), toasts: [], consoleCalls: [], dialogs: [], confirmAnswer: true, goCalls: [], saveFlows: [], consents: [], modals: [],
    handlers: {}, winHandlers: {}, wl: {requests: 0, sentinels: [], deny: false}, gps: fakeGps(), student: {id: "s1", name: "Ana", runsColumn: true, runsMode: o.mode || "live"}, mode: o.mode || "live",
    consentCb: null, consentAuto: o.consentAuto !== false, cur: null, rendered: 0, sbCalls: [], sbBehavior: {}, online: true, onLine: true};
  box.adv = function(ms){
    var target = clock.now + ms, next;
    for (;;) {
      next = timers.list.filter(function(t){ return t.at <= target; }).sort(function(a, b){ return a.at - b.at || a.id - b.id; })[0];
      if (!next) break;
      if (next.at > clock.now) clock.now = next.at;
      if (next.every) next.at += next.every; else fClear(next.id);
      next.fn();
    }
    clock.now = target;
  };
  box.setNow = function(ms){ clock.now = ms; };
  var doc = {visibilityState: "visible", hidden: false,
    addEventListener: function(t, f){ (box.handlers[t] = box.handlers[t] || []).push(f); },
    getElementById: function(id){ return box.cur ? (box.cur.els[id] && !box.cur.els[id].removed ? box.cur.els[id] : null) : null; }};
  var store = box.store;
  var win = {localStorage: store, addEventListener: function(t, f){ (box.winHandlers[t] = box.winHandlers[t] || []).push(f); }, confirm: function(m){ box.dialogs.push(m); return box.confirmAnswer; }};
  var nav = {geolocation: o.geo || {}, get onLine(){ return box.onLine; }, wakeLock: o.noWakeLock ? undefined : {request: function(){
    box.wl.requests++;
    if (box.wl.deny) return Promise.reject(new Error("NotAllowedError"));
    var s = {released: false, rel: null, release: function(){ s.released = true; if (s.rel) s.rel(); return Promise.resolve(); }, addEventListener: function(t, f){ s.rel = f; }};
    box.wl.sentinels.push(s);
    return Promise.resolve(s);
  }}};
  var RUN = {loaded: false, failed: false};
  box.RUN = RUN;
  RUN.v = {name: "home"};
  RUN.go = function(name, params){
    box.goCalls.push(name); RUN.v = {name: name, params: params};
    if (name === "live") box.render(); else box.cur = null;
  };
  RUN.uiReset = function(){ box.uiResets = (box.uiResets || 0) + 1; RUN.v = {name: "home"}; };
  RUN.ensureConsent = function(s, cb){ box.consents.push(s.id); box.consentCb = cb; if (box.consentAuto) cb(); };
  RUN.saveFlow = function(s, prep){ box.saveFlows.push({s: s, prep: prep}); RUN.v = {name: "save", prep: prep}; box.cur = null; };
  RUN.submitRun = function(s, item){
    box.submits = (box.submits || 0) + 1;
    if (box.submitResult) return Promise.resolve(box.submitResult(item));
    return Promise.resolve({ok: true, queued: false});
  };
  var sbObj = {from: function(table){
    return {insert: function(row){
      box.sbCalls.push({table: table, row: row});
      var beh = box.sbBehavior[table];
      var res = beh ? beh(row) : {error: null, status: 201, data: [row]};
      return Promise.resolve(res);
    }};
  }};
  var api = BUILD(RUN, o.uid === undefined ? U1 : o.uid, o.role || "student",
    function(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"}[c]; }); },
    function(m){ box.toasts.push(m); }, function(html){
      var sheet = fakeRoot(html); box.modals.push(sheet); box.sheet = sheet; return sheet;
    }, function(){ box.sheet = null; }, function(s){ return s && s.runsColumn && (s.runsMode === "import" || s.runsMode === "live") ? s.runsMode : "off"; },
    o.noSb ? null : sbObj, o.noSb ? false : true, function(res){
      var e = (res && res.error) || {}, msg = String(e.message || ""), st = res && res.status;
      if (!st || st >= 500 || st === 401 || st === 408 || st === 429) return true;
      return /failed to fetch|network|timeout|load failed|jwt/i.test(msg);
    }, function(p){ return Promise.resolve(p); }, function(id){ return box.student; }, {alunoStudentId: "s1", alunoTab: "corrida"}, "treino",
    "evolve_run_draft_v1", "evolve_runs_outbox_v1", "evolve_run_consent_v1", win, doc, nav, FD, fSetTimeout, fClear, fSetInterval, fClear,
    {log: function(){ box.consoleCalls.push([].slice.call(arguments).join(" ")); }, warn: function(){ box.consoleCalls.push([].slice.call(arguments).join(" ")); }, error: function(){ box.consoleCalls.push([].slice.call(arguments).join(" ")); }});
  box.api = api; box.doc = doc; box.nav = nav;
  box.defaultGps = RUN.gps;   // o adaptador padrão que o ficheiro cria ao carregar
  RUN.gps = box.gps;      // adaptador injetado
  box.live = RUN.live;
  box.sv = function(){ var v = {}; for (var k in box.student) v[k] = box.student[k]; return v; };
  box.render = function(){
    var html = RUN.liveScreen(box.sv());
    box.cur = fakeRoot(html); box.rendered++;
    RUN.liveWire(box.student, box.cur);
    return html;
  };
  box.el = function(id){ return box.cur && box.cur.els[id] && !box.cur.els[id].removed ? box.cur.els[id] : null; };
  box.click = function(id){ var e = box.el(id); if (!e) throw new Error("sem elemento " + id); e.click(); };
  box.opens = function(){ RUN.liveOpen(box.student); return box.cur ? box.cur.html : ""; };
  // fix sintético de uma reta para norte a v m/s, 1 Hz, instante i (s) depois de T0
  box.fix = function(i, v, acc){ return {lat: LAT0 + (v == null ? 3 : v) * i / M_LAT, lon: LON0, acc: acc == null ? 5 : acc, t: T0 + i * 1000, speed: null}; };
  box.emit = function(i, v, acc){ if (!box.gps.onFix) throw new Error("GPS parado"); clock.now = Math.max(clock.now, T0 + i * 1000); box.gps.onFix(box.fix(i, v, acc)); };
  box.setHidden = function(h){ doc.visibilityState = h ? "hidden" : "visible"; doc.hidden = !!h; (box.handlers.visibilitychange || []).forEach(function(f){ f(); }); };
  box.pagehide = function(){ (box.winHandlers.pagehide || []).forEach(function(f){ f(); }); };
  box.goOnline = function(){ box.onLine = true; (box.winHandlers.online || []).forEach(function(f){ f(); }); };
  // do ecrã inicial até estar a gravar, com o 1.º fix aos T0
  box.startRun = function(){
    box.opens(); box.click("runLiveGo"); box.click("runLivePrepare");
    box.emit(0);                      // sinal bom
    box.click("runLiveStart");
    box.emit(1);                      // 1.º fix depois do toque: abre o percurso
  };
  return box;
}
function mt(){ return new Promise(function(r){ setTimeout(r, 0); }); }   // deixa correr as promessas pendentes (Wake Lock)
function draftOf(box){ return JSON.parse(box.store.getItem("evolve_run_draft_v1")); }
function textOf(html){ return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "); }

// ================================================================ ficheiro e contrato
var liveTop = [], mm, reTop = /^(?:function\s+(\w+)|var\s+(\w+))/gm;
while ((mm = reTop.exec(liveSrc))) liveTop.push(mm[1] || mm[2]);
var otherSrc = ["app.js", "gestao.js", "corrida-core.js"].concat(fs.existsSync(path.join(root, "corrida.js")) ? ["corrida.js"] : []).map(read);
var clash = liveTop.filter(function(x){ return otherSrc.some(function(src){ return new RegExp("(?:^|\\n)\\s*(?:function\\s+|(?:var|let|const)\\s+)" + x + "\\b").test(src); }); });
var noComments = liveSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
ck("1. O gravador avalia-se em modo estrito com o núcleo e acaba com RUN.loaded = true (a última instrução)", /RUN\.loaded = true;\s*$/.test(liveSrc) && (function(){ var b = makeBox(); return b.RUN.loaded === true; })());
ck("2. Todos os nomes de topo levam o prefixo run / RUN_ e nenhum se chama RUN", liveTop.length > 60 && liveTop.every(function(x){ return /^(run[A-Z]|RUN_)/.test(x); }));
ck("3. Nenhum nome de topo repete um de app.js, gestao.js, corrida-core.js ou corrida.js" + (clash.length ? " (repetidos: " + clash.join(", ") + ")" : ""), clash.length === 0);
ck("4. Não menciona o diagnóstico de GPS antigo", !/gps-teste/i.test(liveSrc));
ck("5. Só ES5 (sem arrow, let, const, async, await, template strings, classes)", !/=>|`|\b(let|const|async|await|class)\s/.test(noComments));
ck("6. Nenhum pedido de rede próprio (fetch, XHR, sendBeacon, WebSocket, importScripts), nenhuma consola, nenhum eval", !/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|importScripts|eval)\b|\bconsole\b/.test(noComments));
ck("7. O localStorage só se toca num sítio (runLStore) e as chaves não se redeclaram (RUN_DRAFT_KEY e RUN_OUTBOX_KEY vêm de app.js)", (noComments.match(/localStorage/g) || []).length === 1 && !/(var|function)\s+RUN_(DRAFT|OUTBOX)_KEY/.test(noComments));
ck("8. Define o contrato em RUN: liveOpen, liveScreen, liveWire, liveDraftBanner, liveWireBanner, queueAdd, queuePending, flush, reset, gps, live", ["liveOpen", "liveScreen", "liveWire", "liveDraftBanner", "liveWireBanner", "queueAdd", "queuePending", "flush", "reset"].every(function(k){ return new RegExp("RUN\\." + k + " = ").test(liveSrc); }) && /RUN\.gps = /.test(liveSrc) && /RUN\.live = /.test(liveSrc));
ck("9. Sem linha de música nem os três botões (Spotify, Apple Music, YouTube Music) no gravador", !/playlistRowHtml|MUSIC_APPS|Spotify|Apple Music|YouTube Music|data-music/.test(liveSrc));
ck("10. Os textos fixos do desenho estão lá (aviso inicial, música antes de Iniciar, Terminar a corrida?, Sem posições há, página oculta, não feches a app)",
  ["Mantém a EVOLVE aberta e o ecrã ligado durante a corrida. Se o ecrã bloquear ou mudares de aplicação, o registo pode falhar e ficará uma lacuna no percurso. Ainda não testámos isto em todos os telemóveis.",
    "Põe a música a tocar ANTES de carregar em Iniciar e volta aqui.", "Terminar a corrida?", "Continuar a correr", "Sem posições há ", "A página esteve oculta ", "Não feches a app: a corrida ainda não está guardada",
    "Guardar o que há", "Retomar", "Descartar", "Bloquear toques"].every(function(t){ return liveSrc.indexOf(t) >= 0; }));

// ================================================================ funções puras
var P = makeBox().api;
var fixPos = P.runLiveFixFromPosition({coords: {latitude: 38.7, longitude: -9.1, accuracy: 6.4, speed: null, heading: null}, timestamp: T0});
ck("11. Fix normalizado a partir da posição do navegador: {lat, lon, acc, t, speed|null}", fixPos && fixPos.lat === 38.7 && fixPos.lon === -9.1 && fixPos.acc === 6.4 && fixPos.t === T0 && fixPos.speed === null);
ck("12. Posições sem coordenadas ou sem hora são recusadas; precisão em falta fica null; velocidade finita passa", P.runLiveFixFromPosition(null) === null && P.runLiveFixFromPosition({coords: {}}) === null &&
  P.runLiveFixFromPosition({coords: {latitude: 1, longitude: 2}, timestamp: NaN}) === null && P.runLiveFixFromPosition({coords: {latitude: 1, longitude: 2, accuracy: undefined, speed: 3.2}, timestamp: 5}).acc === null &&
  P.runLiveFixFromPosition({coords: {latitude: 1, longitude: 2, accuracy: 5, speed: 3.2}, timestamp: 5}).speed === 3.2);
var sg = function(o){ return P.runLiveSignalInfo(o); };
ck("13. Aviso de sinal: a procurar → sem posições há N s → sinal fraco → sinal bom; pausa, recusada e sem suporte têm texto próprio",
  sg({hasCb: false, waitedS: 2, accMax: 30}).kind === "wait" && sg({hasCb: false, waitedS: 12, accMax: 30}).text === "Sem posições há 12 s. Mantém o ecrã ligado." &&
  sg({hasCb: true, sinceCbS: 9, acc: 5, accMax: 30}).text === "Sem posições há 9 s. Mantém o ecrã ligado." && sg({hasCb: true, sinceCbS: 1, acc: 45, accMax: 30}).kind === "weak" &&
  sg({hasCb: true, sinceCbS: 1, acc: 8.4, accMax: 30}).text === "Sinal bom (±8 m)." && sg({paused: true, hasCb: true, sinceCbS: 1, acc: 5, accMax: 30}).kind === "paused" &&
  /recusada/.test(sg({err: "denied"}).text) && /não consegue/.test(sg({err: "unsupported"}).text));
var wn = P.runLiveWarnings({gaps: 2, gapS: 95}, 40, 1);
ck("14. Avisos para guardar: lacunas (com a duração), página oculta e reinícios do GPS; nada quando está tudo bem", wn.length === 3 && /2 lacunas/.test(wn[0]) && /1 min 35 s/.test(wn[0]) && /oculta 40 s/.test(wn[1]) && /1 vez/.test(wn[2]) && P.runLiveWarnings({gaps: 0, gapS: 0}, 0, 0).length === 0);
ck("15. Duração por extenso e data local (não UTC)", P.runLDurWords(0) === "0 s" && P.runLDurWords(59) === "59 s" && P.runLDurWords(60) === "1 min" && P.runLDurWords(3725) === "1 h 2 min" && /^\d\d\/\d\d\/\d{4} às \d\d:\d\d$/.test(P.runLWhen(T0)));

// rascunho
function stRun(points, v){
  var st = P.runFeedInit(), i;
  for (i = 0; i < points; i++) P.runFeed(st, {lat: LAT0 + (v || 3) * i * 6 / M_LAT, lon: LON0, acc: 5, t: T0 + i * 6000});
  return st;
}
var st30 = stRun(30);
var d1 = P.runLiveDraftBuild(st30, {uid: U1, hiddenS: 12.4, ended: false, restarts: 2, nowMs: T0 + 999});
ck("16. Formato do rascunho: {v:1, uid, ts, view, ended, hiddenS (inteiro), restarts, st (estado do reducer)}", d1.v === 1 && d1.uid === U1 && d1.ts === T0 + 999 && d1.view === "live" && d1.ended === false && d1.hiddenS === 12 && d1.restarts === 2 && d1.st === st30);
var ser = P.runLiveDraftSerialize(d1), back = P.runLiveDraftParse(ser.text, U1);
ck("17. O rascunho vai e volta por JSON com os mesmos totais (distância, pontos, início), e a retoma marca a lacuna no seguinte", ser.ok && back.ok && back.points === st30.nPts && Math.round(back.st.distM) === Math.round(st30.distM) &&
  back.startedAtMs === T0 && back.stats.distM === P.runStats(st30.segs, null, "live").distM && back.hiddenS === 12 && back.restarts === 2 && back.ended === false && back.st.brk === "gap");
ck("18. Rascunho de OUTRA conta ignora-se; sem conta ignora-se; nada guardado dá «none»", P.runLiveDraftParse(ser.text, U2).reason === "other" && P.runLiveDraftParse(ser.text, null).reason === "other" && P.runLiveDraftParse(null, U1).reason === "none" && P.runLiveDraftParse("", U1).reason === "none");
var junk = ["{isto não é json", "5", "\"texto\"", "null", "[]", "{\"uid\":5}", "{}", "[1,2,3]"].map(function(t){ return P.runLiveDraftParse(t, U1); });
ck("19. Lixo no lugar do rascunho (JSON mau, números, texto, listas, objeto sem uid) dá «corrupt» e nunca lança", junk.every(function(r){ return r.ok === false && r.reason === "corrupt"; }));
ck("20. Rascunho do utilizador atual sem posições aproveitáveis (estado vazio, versão errada, pontos inválidos) dá «unusable» (aparece, só dá para descartar)",
  P.runLiveDraftParse(JSON.stringify({v: 1, uid: U1, st: {segs: []}}), U1).reason === "unusable" && P.runLiveDraftParse(JSON.stringify({v: 2, uid: U1, st: st30}), U1).reason === "unusable" &&
  P.runLiveDraftParse(JSON.stringify({v: 1, uid: U1, st: {segs: [[{lat: 999, lon: 0, t: 5}, {lat: "x", lon: 0, t: 6}, null]]}}), U1).reason === "unusable" && P.runLiveDraftParse(JSON.stringify({v: 1, uid: U1}), U1).reason === "unusable");
var dirty = JSON.parse(ser.text); dirty.st.segs[0].splice(5, 0, {lat: NaN, lon: 1, t: 2}, {lat: 40, lon: -9, t: 1}, null); dirty.hiddenS = "abc"; dirty.ended = "sim";
var back2 = P.runLiveDraftParse(JSON.stringify(dirty), U1);
ck("21. Pontos estragados dentro do rascunho são deixados de fora, números maus viram 0 e «ended» só vale com true", back2.ok && back2.points === st30.nPts && back2.hiddenS === 0 && back2.ended === false);
var big = P.runFeedInit(); big.segs = [[]];
for (var bi = 0; bi < P.RUN_LIVE_CFG.maxDraftPoints + 1; bi++) big.segs[0].push({lat: LAT0, lon: LON0, t: T0 + bi, acc: 5});
ck("22. Teto de pontos: com mais de 10 000 pontos o rascunho não se escreve («points»); com exatamente 10 000 passa se couber no tamanho", P.runLiveDraftSerialize(P.runLiveDraftBuild(big, {uid: U1})).reason === "points" &&
  (function(){ big.segs[0].pop(); var r = P.runLiveDraftSerialize(P.runLiveDraftBuild(big, {uid: U1})); return r.ok && r.text.length < P.RUN_LIVE_CFG.maxDraftChars; })());
ck("23. Teto de tamanho do texto; sem segmentos ou estado inválido não se escreve; JSON circular não lança", (function(){
  var fat = {segs: [[{lat: 1, lon: 1, t: 1, acc: 1, x: new Array(2600000).join("a")}]]};
  var circ = {segs: [[]]}; circ.self = circ;
  return P.runLiveDraftSerialize({st: fat}).reason === "size" && P.runLiveDraftSerialize({st: null}).reason === "shape" && P.runLiveDraftSerialize({}).reason === "shape" && P.runLiveDraftSerialize({st: circ}).reason === "json";
})());

// escolhas: retomar / guardar o que há / descartar
var info30 = P.runLiveDraftParse(ser.text, U1), lastT = info30.lastT;
var cA = P.runLiveDraftChoices(info30, lastT + 600000, "live");
ck("24. Escolhas de um rascunho recente em modo «live»: pode retomar, guardar o que há e descartar", cA.resume && cA.save && cA.discard && cA.why === "");
var cB = P.runLiveDraftChoices(info30, lastT + 7 * 3600000, "live");
ck("25. Passadas mais de 6 h já não se retoma, mas guarda-se o que há (com explicação); exatamente 6 h ainda retoma", !cB.resume && cB.save && /6 horas/.test(cB.why) && P.runLiveDraftChoices(info30, lastT + 21600000, "live").resume);
var infoEnd = P.runLiveDraftParse(JSON.stringify(Object.assign({}, JSON.parse(ser.text), {ended: true})), U1);
ck("26. Uma corrida já terminada (ended) nunca se retoma, só se guarda ou descarta", (function(){ var c = P.runLiveDraftChoices(infoEnd, lastT + 1000, "live"); return !c.resume && c.save && c.discard; })());
var cC = P.runLiveDraftChoices(info30, lastT + 1000, "import"), cD = P.runLiveDraftChoices(info30, lastT + 1000, "off");
ck("27. Com a Corrida ao vivo desligada (import/off) só se descarta, e diz porquê", !cC.resume && !cC.save && cC.discard && /não está ligada/.test(cC.why) && !cD.resume && !cD.save);
var one = P.runFeedInit(); P.runFeed(one, {lat: LAT0, lon: LON0, acc: 5, t: T0});
var infoOne = P.runLiveDraftParse(P.runLiveDraftSerialize(P.runLiveDraftBuild(one, {uid: U1})).text, U1), cE = P.runLiveDraftChoices(infoOne, T0 + 5000, "live");
ck("28. Com um só ponto (sem tempo nem distância) retoma-se mas não se guarda (a corrida não seria válida)", infoOne.ok && cE.resume && !cE.save && cE.saveError.length > 0);
ck("29. Sem rascunho aproveitável as escolhas são só descartar", (function(){ var c = P.runLiveDraftChoices({ok: false, reason: "unusable"}, T0, "live"); return !c.resume && !c.save && c.discard; })());

// fila
function rowOf(id, o){
  o = o || {};
  var st = o.st || st30, stats = P.runStats(st.segs, null, "live");
  return P.runBuildInsert({id: id, studentId: "s1", source: o.source || "live", startedAtMs: stats.startedAtMs, durationS: stats.durationS, movingS: stats.movingS, distM: stats.distM, gaps: stats.gaps, gapS: stats.gapS,
    splitsS: stats.splitsS, hiddenS: 3, rpe: 6, notes: "ok", consentV: 1}, T0 + 3600000);
}
function trackOf(){
  var segs = st30.segs, t = P.runPrepareTrack(segs, {trimM: 0});
  return {segments: t.segments, trimM: t.trimM};
}
var item1 = {row: rowOf(RID1), track: trackOf()};
var cl = P.runLiveQueueItem(Object.assign({}, item1, {segments: st30.segs, rawPoints: [1, 2], hiddenInRow: 1}));
ck("30. A fila guarda SÓ o que seria enviado: linha com as colunas conhecidas e percurso já aparado; campos a mais (pontos brutos) ficam de fora", cl && Object.keys(cl).sort().join() === "row,track" &&
  Object.keys(cl.row).sort().join() === "consent_v,distance_m,duration_s,gap_s,gaps,hidden_s,id,moving_s,notes,rpe,source,splits_s,started_at,student_id" && !("t" in cl.track.segments[0][0]) && JSON.stringify(cl).indexOf("\"acc\"") < 0);
var rowX = Object.assign({}, item1.row, {coords: [[38.7, -9.1]], lat: 38.7});
ck("31. Colunas desconhecidas na linha (coords, lat...) também ficam de fora", (function(){ var c = P.runLiveQueueItem({row: rowX, track: null}); return c && !("coords" in c.row) && !("lat" in c.row) && c.track === null; })());
var bad = [null, 5, "x", {}, {row: null}, {row: {}}, {row: Object.assign({}, item1.row, {id: "abc"})}, {row: Object.assign({}, item1.row, {student_id: ""})}, {row: Object.assign({}, item1.row, {source: "tele"})},
  {row: Object.assign({}, item1.row, {distance_m: "5000"})}, {row: Object.assign({}, item1.row, {started_at: "ontem"})}, {row: Object.assign({}, item1.row, {rpe: 11})}, {row: Object.assign({}, item1.row, {notes: new Array(302).join("n")})},
  {row: item1.row, track: {segments: [[[38.7, -9.1]]], trimM: 0}}, {row: item1.row, track: {segments: [[[38.7, -9.1, "x"]]], trimM: 0}}, {row: item1.row, track: {segments: [], trimM: 0}}, {row: item1.row, track: {segments: [[[99, -9.1, 0]]], trimM: 0}},
  {row: item1.row, track: {segments: [[{lat: 38.7, lon: -9.1, t: 5}]], trimM: 0}}];
ck("32. Itens inválidos (lixo, uuid mau, aluno vazio, origem desconhecida, números em texto, data inválida, nota longa, percurso sem tempo, fora de gama, com objetos) são recusados sem lançar", bad.every(function(b){ var r; try { r = P.runLiveQueueItem(b); } catch (e) { return false; } return r === null; }));
var q1 = P.runLiveQueueAdd([], item1, U1, T0), q1b = P.runLiveQueueAdd(q1.list, item1, U1, T0 + 5);
ck("33. Deduplicação por id: o mesmo id duas vezes não duplica (devolve dup) e a lista fica igual", q1.ok && !q1.dup && q1.list.length === 1 && q1b.ok && q1b.dup && q1b.list.length === 1 && q1.list[0].ts === T0 && q1.list[0].state === "pending");
var lst = [], qi;
for (qi = 0; qi < 20; qi++) lst = P.runLiveQueueAdd(lst, {row: rowOf("aaaaaaaa-aaaa-4aaa-8aaa-0000000000" + (10 + qi)), track: null}, U1, T0 + qi).list;
var q21 = P.runLiveQueueAdd(lst, {row: rowOf(RID2), track: null}, U1, T0 + 99), q21b = P.runLiveQueueAdd(lst, {row: rowOf(RID2), track: null}, U2, T0 + 99);
ck("34. Teto de 20 itens por utilizador: o 21.º é recusado («full»), a ordem mantém-se, e outro utilizador ainda pode juntar", lst.length === 20 && !q21.ok && q21.reason === "full" && lst[0].ts === T0 && lst[19].ts === T0 + 19 && q21b.ok && q21b.list.length === 21);
ck("35. Teto de ~1,5 MB: uma fila que passaria do tamanho é recusada («size»)", (function(){
  var fat = P.runLiveQueueItem(item1), r; fat.row.notes = new Array(300).join("n");
  var list = [], i = 0; var segs = []; for (i = 0; i < 40; i++) segs.push([[38.7, -9.1, 0]]);
  var cfg = P.RUN_LIVE_CFG, keep = cfg.outboxMaxChars; cfg.outboxMaxChars = 500;
  r = P.runLiveQueueAdd(list, {row: fat.row, track: fat.track}, U1, T0); cfg.outboxMaxChars = keep;
  return !r.ok && r.reason === "size" && P.runLiveQueueAdd(list, {row: fat.row, track: fat.track}, U1, T0).ok;
})());
var multi = JSON.stringify(q21b.list.slice(18).concat([{id: "x"}, null, 5, {id: RID3, uid: "", item: item1}, {id: RID3, uid: U1, item: {row: Object.assign({}, item1.row, {id: RID4})}}]));
var pq = P.runLiveQueueParse(multi);
ck("36. Ler a fila: entradas de qualquer conta válidas ficam, as inválidas (lixo, sem uid, id que não bate com a linha) saem e conta-se quantas", pq.list.length === 3 && pq.dropped === 5 && pq.list[2].uid === U2);
ck("37. A fila aceita também {items: [...]}; JSON mau ou forma errada dá lista vazia (bad) sem lançar", P.runLiveQueueParse(JSON.stringify({items: q1.list})).list.length === 1 && P.runLiveQueueParse("{[").bad === true && P.runLiveQueueParse("5").bad === true && P.runLiveQueueParse(null).list.length === 0 && P.runLiveQueueParse("").list.length === 0);
ck("38. Ler a fila normaliza o estado (só «pending» ou «failed») e corta mensagens longas", (function(){
  var t = JSON.parse(JSON.stringify(q1.list)); t[0].state = "qualquer"; t[0].err = new Array(500).join("e");
  var r = P.runLiveQueueParse(JSON.stringify(t)).list[0]; return r.state === "pending" && r.err.length === 200;
})());

// ================================================================ máquina de estados
(async function(){
var S = makeBox();
var introHtml = S.opens();
ck("39. Ao abrir: aviso inicial (ecrã ligado, pode falhar, não testado em todos os telemóveis), música ANTES de Iniciar, sem os botões de música e SEM pedir o GPS", /Mantém a EVOLVE aberta e o ecrã ligado durante a corrida/.test(introHtml) && /pode falhar/.test(introHtml) &&
  /Ainda não testámos isto em todos os telemóveis/.test(introHtml) && /Não garantimos que o registo continue com o ecrã bloqueado/.test(introHtml) && /Põe a música a tocar ANTES de carregar em Iniciar e volta aqui\./.test(introHtml) &&
  !/data-music|Spotify|Apple Music|YouTube Music|playlist/.test(introHtml) && S.gps.starts === 0 && S.wl.requests === 0 && S.live.phase === "intro");
S.click("runLiveGo");
ck("40. «Continuar» pede o consentimento (RUN.ensureConsent) e só depois passa a «Preparar»; o GPS continua parado", S.consents.length === 1 && S.live.phase === "prep" && S.gps.starts === 0 && !!S.el("runLivePrepare") && /Preparar GPS/.test(S.cur.html));
(function(){
  var C = makeBox({consentAuto: false});
  C.opens(); C.click("runLiveGo");
  var held = C.live.phase;
  C.consentCb();
  ck("41. Sem consentimento aceite nada avança (a fase só muda quando corrida.js chama o cb)", held === "intro" && C.live.phase === "prep" && C.consents.length === 1);
  var D = makeBox({consentAuto: false});
  D.opens(); D.click("runLiveGo"); D.live.sid++; D.consentCb();
  ck("42. Um consentimento que chega depois de a sessão mudar (reset) é ignorado", D.live.phase === "intro");
})();
S.click("runLivePrepare");
ck("43. Só depois do toque em «Preparar GPS» arranca o GPS (uma vez) e pede-se o Wake Lock (uma vez)", S.gps.starts === 1 && S.wl.requests === 1 && S.live.gpsOn && S.live.phase === "prep" && !!S.el("runLiveStart") && S.el("runLiveStart").disabled === true);
S.box = S;
S.emit(0, 3, 55);
S.el("runLiveStart").click();
ck("44. Com precisão fraca (55 m) o botão Iniciar fica desligado (e um toque nele não faz nada) e o estado diz «Sinal fraco»", S.el("runLiveStart").disabled === true && S.live.phase === "prep" && !S.live.st && /Sinal fraco \(±55 m\)/.test(S.el("runLiveSignal").textContent) && /Precisão: ±55 m/.test(S.el("runLiveAcc").textContent));
S.emit(1, 3, 8);
ck("45. Com precisão boa (8 m) diz «Sinal bom» e liga o Iniciar", S.el("runLiveStart").disabled === false && /Sinal bom \(±8 m\)/.test(S.el("runLiveSignal").textContent) && S.live.prepGood);
S.adv(2000);
S.click("runLiveStart");
ck("46. «Iniciar» passa a gravar (com estado novo do reducer); ainda não há rascunho porque ainda não há posições aceites", S.live.phase === "rec" && S.live.st && S.live.st.nPts === 0 && S.store.getItem("evolve_run_draft_v1") === null && !!S.el("runLivePause") && !!S.el("runLiveEnd"));
var recHtml = S.cur.html;
ck("47. Ecrã de gravação: tempo, distância e ritmo grandes, lacunas, botões Pausa/Terminar/Bloquear toques, e SEM linha de música (só o aviso «Põe a música a tocar ANTES...»)", /id="runLiveTime"/.test(recHtml) && /id="runLiveDist"/.test(recHtml) && /id="runLivePace"/.test(recHtml) && /Lacunas: 0/.test(recHtml) &&
  />Pausa</.test(recHtml) && />Terminar</.test(recHtml) && />Bloquear toques</.test(recHtml) && !/data-music|Spotify|Apple Music|YouTube Music|playlist/.test(recHtml) && /Põe a música a tocar ANTES de carregar em Iniciar e volta aqui\./.test(recHtml));
S.emit(3, 3, 5);       // 1.º fix depois do toque (os anteriores eram de «preparar»)
ck("48. O 1.º fix aceite fixa o início da corrida e escreve logo o rascunho (uid, estado, vista)", S.live.st.nPts === 1 && S.live.st.startedAtMs === T0 + 3000 && draftOf(S).uid === U1 && draftOf(S).st.nPts === 1 && draftOf(S).view === "live" && S.live.draftOk === true);
var setsBefore = S.store.sets;
for (var fi = 4; fi <= 12; fi++) S.emit(fi);
ck("49. O rascunho escreve-se no máximo de 10 em 10 s: 9 posições em 9 s só juntam uma escrita periódica no máximo", S.store.sets - setsBefore <= 1);
for (fi = 13; fi <= 60; fi++) S.emit(fi);
var wr = S.store.sets - setsBefore;
ck("50. Em 57 s de gravação houve pelo menos 4 e no máximo 7 escritas do rascunho (cadência de ~10 s, não uma por posição)", wr >= 4 && wr <= 7);
S.adv(1000);
ck("51. Os números vêm dos timestamps: depois de ~57 s a 3 m/s há ~170 m e o relógio mostra o tempo desde o 1.º fix", /^0,1[5-9] km$/.test(S.el("runLiveDist").textContent) && S.el("runLiveTime").textContent === "0:58" && /^5:\d\d$/.test(S.el("runLivePace").textContent) && /Sinal bom/.test(S.el("runLiveSignal").textContent));
S.box = S;
// pausa e retoma
S.click("runLivePause");
var pausedSegs = S.live.st.segs.length;
ck("52. Pausa: o estado fica em pausa, o botão passa a «Retomar», o rascunho escreve-se logo e as posições seguintes são ignoradas", S.live.st.paused === true && />Retomar</.test(S.cur.html) && draftOf(S).st.paused === true && (function(){ var d0 = S.live.st.distM; S.emit(61); S.emit(62); return S.live.st.distM === d0 && S.live.st.nPts === S.live.st.segs.reduce(function(a, s){ return a + s.length; }, 0); })());
var elapsedAtPause = S.el("runLiveTime") ? S.el("runLiveTime").textContent : "";
S.adv(30000);
var timeAfterPause = S.el("runLiveTime").textContent;
S.click("runLivePause");
ck("53. Retomar: o relógio não anda durante a pausa (30 s de pausa não contam) e o 1.º fix seguinte abre um segmento «pause» (não é lacuna)", timeAfterPause === elapsedAtPause && /^\d+:\d\d$/.test(timeAfterPause) && S.live.st.paused === false && (function(){
  S.emit(95); S.emit(96);
  var segs = S.live.st.segs, last = segs[segs.length - 1];
  return segs.length === pausedSegs + 1 && last[0].b === "pause" && S.live.st.gaps === 0;
})());
// terminar
S.click("runLiveEnd");
ck("54. «Terminar» pede confirmação («Terminar a corrida?», «Continuar a correr» / «Terminar») e não termina sozinho", S.modals.length === 1 && /Terminar a corrida\?/.test(S.sheet.html) && !!S.sheet.els.runLiveContinue && !!S.sheet.els.runLiveEndOk && S.live.phase === "rec");
var stopsAtAsk = S.gps.stops;
S.sheet.els.runLiveContinue.click();
ck("55. «Continuar a correr» fecha a pergunta e a gravação segue (sem parar o GPS)", S.live.phase === "rec" && S.gps.stops === stopsAtAsk);
S.click("runLiveEnd");
var gpsStopsBefore = S.gps.stops;
S.sheet.els.runLiveEndOk.click();
await mt();
ck("56. «Terminar» pára o GPS, os relógios e o Wake Lock, e mostra o resumo com «Rever e guardar» e «Descartar»", S.live.phase === "end" && S.gps.stops === gpsStopsBefore + 1 && S.live.tickId === null && S.wl.sentinels.every(function(s){ return s.released; }) &&
  !!S.el("runLiveReview") && !!S.el("runLiveDiscard") && /Resumo/.test(S.cur.html));
var dEnd = draftOf(S);
ck("57. Ao terminar o rascunho fica marcado como terminado (continua guardado até a corrida ser guardada ou descartada)", dEnd.ended === true && dEnd.st.nPts === S.live.st.nPts);
S.click("runLiveReview");
var sf = S.saveFlows[0], expectStats = P.runStats(S.live.st.segs, null, "live");
ck("58. «Rever e guardar» chama RUN.saveFlow uma vez com source «live», stats = runStats dos pontos todos, os segmentos completos, hiddenS inteiro, avisos, fileDistM null e a hora de início", S.saveFlows.length === 1 && sf.prep.source === "live" &&
  JSON.stringify(sf.prep.stats) === JSON.stringify(expectStats) && sf.prep.segments.length === S.live.st.segs.length && sf.prep.segments[0].length === S.live.st.segs[0].length && sf.prep.hiddenS === 0 && Array.isArray(sf.prep.warnings) &&
  sf.prep.fileDistM === null && sf.prep.startedAtMs === expectStats.startedAtMs && sf.s === S.student);
ck("59. saveFlow leva uma cópia dos pontos (não o estado vivo), cancelView para o resumo e onSaved; o rascunho continua guardado", sf.prep.segments !== S.live.st.segs && sf.prep.segments[0] !== S.live.st.segs[0] && sf.prep.cancelView.name === "live" && typeof sf.prep.onSaved === "function" && S.store.getItem("evolve_run_draft_v1") !== null);
sf.prep.onSaved({ok: false});
ck("60. onSaved com falha não apaga nada", S.store.getItem("evolve_run_draft_v1") !== null && S.live.phase === "end");
sf.prep.onSaved({ok: true, queued: false});
ck("61. Quando a corrida fica guardada (onSaved ok) o rascunho apaga-se e o estado em memória limpa-se", S.store.getItem("evolve_run_draft_v1") === null && S.live.phase === "intro" && S.live.st === null);

// ---- guardar pelo embrulho de RUN.submitRun
var W = makeBox();
W.startRun();
for (fi = 2; fi <= 30; fi++) W.emit(fi);
W.click("runLiveEnd"); W.sheet.els.runLiveEndOk.click(); W.click("runLiveReview");
var wprep = W.saveFlows[0].prep, wstats = wprep.stats;
var wrow = P.runBuildInsert({id: RID1, studentId: "s1", source: "live", startedAtMs: wstats.startedAtMs, durationS: wstats.durationS, movingS: wstats.movingS, distM: wstats.distM, gaps: wstats.gaps, gapS: wstats.gapS, splitsS: wstats.splitsS, hiddenS: 0, consentV: 1}, T0 + 3600000);
var wres;
W.submitResult = function(){ return {ok: false, error: "x", permanent: false}; };
wres = null;
var pW1 = W.RUN.submitRun(W.student, {row: wrow, track: null}).then(function(r){ wres = r; });
// (a promessa resolve-se mais abaixo, na parte assíncrona)

// ---- lacunas, vigia e erros
var G = makeBox();
G.startRun();
for (fi = 2; fi <= 20; fi++) G.emit(fi);
var gapsBefore = G.live.st.gaps, setsG = G.store.sets;
G.adv(25000);
G.emit(46);       // 25 s sem posições: abre uma lacuna
ck("62. Uma lacuna de sinal (>15 s sem posições) conta-se no contador, escreve o rascunho de imediato e não soma distância em linha reta", G.live.st.gaps === gapsBefore + 1 && G.store.sets > setsG && draftOf(G).st.gaps === gapsBefore + 1 && (function(){
  var segs = G.live.st.segs, last = segs[segs.length - 1];
  return last[0].b === "gap" && G.live.st.distM < 20 * 3 + 5;
})());
ck("63. O ecrã mostra «Lacunas: 1 (N s sem posições)»", /Lacunas: 1 \(\d+ s sem posições\)/.test(G.el("runLiveGaps").textContent));

var V = makeBox();
V.startRun();
for (fi = 2; fi <= 10; fi++) V.emit(fi);
V.adv(9000);
ck("64. Sem posições há mais de 8 s o ecrã diz «Sem posições há N s. Mantém o ecrã ligado.»", /^Sem posições há \d+ s\. Mantém o ecrã ligado\.$/.test(V.el("runLiveSignal").textContent) && /none/.test(V.el("runLiveSignal").className));
V.adv(12000);   // 21 s sem posições, página visível
ck("65. Vigia: visível e sem posições há mais de 20 s, o watch é parado e iniciado de novo (uma vez) e fica registado", V.gps.starts === 2 && V.gps.stops === 1 && V.live.restarts === 1 && V.live.restartLog.length === 1 && V.live.watching);
V.adv(60000);
ck("66. O vigia não reinicia em loop: espera mais 20 s antes da seguinte e para ao fim de 3 reinícios por 10 min", V.gps.starts === 4 && V.live.restarts === 3 && (function(){ V.adv(120000); return V.gps.starts === 4 && V.live.restarts === 3; })());
V.adv(600000);
ck("67. Passados os 10 min o vigia volta a poder reiniciar", V.gps.starts > 4);

var H = makeBox();
H.startRun();
for (fi = 2; fi <= 10; fi++) H.emit(fi);
H.setHidden(true);
H.adv(60000);
ck("68. Com a página oculta o vigia não reinicia o GPS", H.gps.starts === 1 && H.gps.stops === 0);
var hSets = H.store.sets;
H.setHidden(false);
ck("69. Ao voltar de oculta o vigia espera 20 s (não reinicia logo) e o aviso de página oculta aparece", H.gps.starts === 1 && /A página esteve oculta 1 min: o percurso pode ter lacuna\./.test(H.el("runLiveNotes") ? (H.el("runLiveNotes").innerHTML || "") : "") === true);
var sigAtReturn = H.el("runLiveSignal").textContent;
H.adv(10000);
ck("70. O «sem posições há N s» só conta o tempo com a página visível: ao voltar de 60 s oculta não diz «há 60 s» (diz «Sinal bom»), e 10 s depois diz «há 10 s»", /Sinal bom/.test(sigAtReturn) && /^Sem posições há 10 s\. Mantém o ecrã ligado\.$/.test(H.el("runLiveSignal").textContent));
ck("71. Se ao fim de 20 s depois de voltar continua sem posições, reinicia", H.gps.starts === 1);
H.adv(12000);
ck("72. (continuação) passados os 20 s reinicia", H.gps.starts === 2);

var H2 = makeBox();
H2.startRun();
for (fi = 2; fi <= 10; fi++) H2.emit(fi);
var h2Sets = H2.store.sets;
H2.setHidden(true);
ck("73. Ao ficar oculta a página força a escrita do rascunho (mesmo dentro dos 10 s)", H2.store.sets === h2Sets + 1 && draftOf(H2).st.nPts === H2.live.st.nPts);
H2.adv(45000);
H2.setHidden(false);
ck("74. Ao voltar conta hiddenS (45 s) e mostra «A página esteve oculta 45 s: o percurso pode ter lacuna.»", H2.live.hiddenS === 45 && H2.live.notice === "A página esteve oculta 45 s: o percurso pode ter lacuna." && H2.live.hiddenAt === null);
H2.emit(70);
H2.adv(5000);
var stillThere = H2.live.notice !== "" && /Fechar/.test(H2.el("runLiveNotes").innerHTML);
H2.el("runLiveNotes").fire("click", {target: {closest: function(){ return {getAttribute: function(){ return "dismiss"; }}; }}});
ck("75. O aviso de página oculta não some sozinho; o botão «Fechar» dispensa-o", stillThere && H2.live.notice === "" && !/Fechar/.test(H2.el("runLiveNotes").innerHTML));
var H3 = makeBox();
H3.startRun();
for (fi = 2; fi <= 10; fi++) H3.emit(fi);
H3.click("runLivePause");
H3.setHidden(true); H3.adv(30000); H3.setHidden(false);
ck("76. Em pausa o tempo oculto não conta para hiddenS; menos de 3 s oculta também não gera aviso", H3.live.hiddenS === 0 && H3.live.notice === "" && (function(){
  var H4 = makeBox(); H4.startRun(); H4.emit(2); H4.setHidden(true); H4.adv(2000); H4.setHidden(false); return H4.live.notice === "" && H4.live.hiddenS === 2;
})());
var H5 = makeBox();
H5.startRun(); H5.emit(2); H5.setHidden(true); H5.adv(20000); H5.setHidden(false);
var h5Sets = H5.store.sets; H5.pagehide();
ck("77. Em pagehide força a escrita do rascunho; o hiddenS que vai para o rascunho inclui o intervalo ainda aberto", H5.store.sets === h5Sets + 1 && (function(){
  H5.setHidden(true); H5.adv(7000); H5.pagehide(); return draftOf(H5).hiddenS >= 27;
})());

// erros do watch
var E = makeBox();
E.startRun();
for (fi = 2; fi <= 8; fi++) E.emit(fi);
var eStarts = E.gps.starts, onErr = E.gps.onErr;
onErr({code: 2});
ck("78. Erro 2 (posição indisponível) não é fatal: nada pára nem reinicia", E.live.watching && E.live.err === null && E.gps.starts === eStarts);
onErr({code: 3}); onErr({code: 3});
ck("79. Dois erros 3 seguidos ainda não reiniciam", E.gps.starts === eStarts);
E.gps.onFix(E.fix(9));
onErr({code: 3}); onErr({code: 3});
ck("80. Uma posição entre erros interrompe a sequência (2+2 erros 3 não reiniciam)", E.gps.starts === eStarts);
onErr({code: 3});
ck("81. Três erros 3 seguidos reiniciam o watch (e ficam registados)", E.gps.starts === eStarts + 1 && E.live.restarts === 1);
var E2 = makeBox();
E2.startRun();
for (fi = 2; fi <= 8; fi++) E2.emit(fi);
var e2Sets = E2.store.sets, e2Err = E2.gps.onErr, e2Stops = E2.gps.stops;
e2Err({code: 1});
ck("82. Permissão recusada (código 1): grava o rascunho primeiro, pára o GPS e explica", E2.store.sets === e2Sets + 1 && E2.gps.stops === e2Stops + 1 && E2.live.err === "denied" && !E2.live.watching && draftOf(E2).st.nPts === E2.live.st.nPts &&
  /A localização foi recusada e a gravação parou/.test(E2.cur.html) && !!E2.el("runLiveRetry") && !!E2.el("runLiveDiscard") && !!E2.el("runLiveEnd"));
E2.click("runLiveRetry");
ck("83. «Tentar outra vez» volta a pedir o GPS (só com um toque)", E2.live.err === null && E2.gps.starts === 2 && E2.live.watching);
var E3 = makeBox();
E3.opens(); E3.click("runLiveGo"); E3.click("runLivePrepare");
E3.gps.onErr({code: 1});
ck("84. Recusada ainda na preparação: explica as permissões e oferece «Tentar outra vez»; nunca começou a gravar", E3.live.err === "denied" && E3.live.phase === "prep" && !!E3.el("runLiveRetry") && /recusada/.test(E3.cur.html) && E3.store.getItem("evolve_run_draft_v1") === null);
var E4 = makeBox();
E4.gps.start = function(a, b){ E4.gps.starts++; b({code: -1, unsupported: true}); };
E4.opens(); E4.click("runLiveGo"); E4.click("runLivePrepare");
ck("85. Navegador sem geolocalização: diz que não consegue e não rebenta", E4.live.err === "unsupported" && !E4.live.watching);
var E5 = makeBox();
E5.gps.start = function(){ throw new Error("boom"); };
E5.opens(); E5.click("runLiveGo");
var threw5 = false; try { E5.click("runLivePrepare"); } catch (e) { threw5 = true; }
ck("86. Um adaptador de GPS que lança não rebenta a app (fica com erro e sem a observar)", !threw5 && !E5.live.watching && E5.live.err === "gps");

// adaptador de GPS padrão (navigator.geolocation.watchPosition)
var dgCalls = {watch: [], clear: []}, dgCbs = [], dgGeo = {watchPosition: function(ok, bad, opts){ dgCalls.watch.push(opts); dgCbs.push({ok: ok, bad: bad}); return 100 + dgCalls.watch.length; }, clearWatch: function(id){ dgCalls.clear.push(id); }};
var DG = makeBox({geo: dgGeo}), dgFixes = [], dgErrs = [];
DG.defaultGps.start(function(f){ dgFixes.push(f); }, function(e){ dgErrs.push(e); });
dgCbs[0].ok({coords: {latitude: 38.7, longitude: -9.1, accuracy: 12.5, speed: 2.5, heading: 90}, timestamp: T0});
dgCbs[0].ok({coords: {latitude: NaN, longitude: -9.1, accuracy: 12.5}, timestamp: T0 + 1000});
dgCbs[0].bad({code: 1, message: "User denied Geolocation at 38.7,-9.1"});
dgCbs[0].bad({code: 3});
dgCbs[0].bad({});
ck("87. O adaptador padrão usa watchPosition com enableHighAccuracy, maximumAge 0 e timeout de 30 s; entrega {lat, lon, acc, t = hora da posição, speed}; ignora posições sem coordenadas; os erros só levam o código (nunca a mensagem)",
  dgCalls.watch.length === 1 && dgCalls.watch[0].enableHighAccuracy === true && dgCalls.watch[0].maximumAge === 0 && dgCalls.watch[0].timeout === 30000 && dgFixes.length === 1 &&
  JSON.stringify(dgFixes[0]) === JSON.stringify({lat: 38.7, lon: -9.1, acc: 12.5, t: T0, speed: 2.5}) && JSON.stringify(dgErrs) === JSON.stringify([{code: 1}, {code: 3}, {code: 0}]));
DG.defaultGps.start(function(){}, function(){});
DG.defaultGps.stop(); DG.defaultGps.stop();
ck("88. Voltar a arrancar o adaptador limpa primeiro o watch anterior; parar limpa o atual uma só vez (parar duas vezes não faz nada)", dgCalls.clear.join() === "101,102" && dgCalls.watch.length === 2);
var DU = makeBox({geo: {}}), duErrs = [];
DU.defaultGps.start(function(){}, function(e){ duErrs.push(e); });
var DN = makeBox({geo: null}); DN.nav.geolocation = null; var dnErrs = [];
DN.defaultGps.start(function(){}, function(e){ dnErrs.push(e); });
ck("89. Sem geolocalização no navegador o adaptador padrão responde «sem suporte» (código -1) em vez de lançar", duErrs.length === 1 && duErrs[0].unsupported === true && duErrs[0].code === -1 && dnErrs.length === 1 && dnErrs[0].unsupported === true);

// cancelar a preparação
var Cp = makeBox();
Cp.opens(); Cp.click("runLiveGo"); Cp.click("runLivePrepare"); await mt();
Cp.click("runLiveCancel"); await mt();
ck("90. «Cancelar» na preparação pára o GPS e o Wake Lock, esquece tudo e volta ao início da Corrida", Cp.gps.stops === 1 && Cp.live.phase === "intro" && !Cp.live.gpsOn && Cp.wl.sentinels.every(function(x){ return x.released; }) && Cp.goCalls[Cp.goCalls.length - 1] === "home" && Cp.store.getItem("evolve_run_draft_v1") === null);

// primeira posição demora: ajuda de permissões
var F1 = makeBox();
F1.opens(); F1.click("runLiveGo"); F1.click("runLivePrepare");
F1.adv(10000);
var helpEarly = F1.el("runLiveHelp").hiddenClass;
F1.adv(25000);
ck("91. Se o 1.º fix demora mais de 30 s mostra a ajuda de permissões (iPhone: Serviços de Localização, Sites do Safari, Ao usar a app, Localização Precisa; com reservas)", helpEarly === true && F1.el("runLiveHelp").hiddenClass === false &&
  /Sites do Safari/.test(F1.cur.html) && /Ao usar a app/.test(F1.cur.html) && /Localização Precisa/.test(F1.cur.html) && /relatos/.test(F1.cur.html) && /não está confirmado/.test(F1.cur.html));

// Wake Lock
var K = makeBox();
K.opens(); K.click("runLiveGo"); K.click("runLivePrepare");
await mt();
K.setHidden(true); K.setHidden(false);
ck("92. Wake Lock: pedido uma vez; ao voltar visível com o pedido ainda ativo não se pede outra vez", K.wl.requests === 1);
K.wl.sentinels[0].release();
K.setHidden(true); K.setHidden(false);
await mt();
ck("93. Se o sistema o libertou (com a página visível) pede-se de novo logo (uma vez); ao voltar de oculta não há pedidos duplicados", K.wl.requests === 2);
K.setHidden(true); K.setHidden(false); K.setHidden(true); K.setHidden(false);
await mt();
ck("94. Várias idas e voltas sem perder o bloqueio não geram pedidos novos", K.wl.requests === 2);
var K2 = makeBox({noWakeLock: true});
K2.startRun(); K2.emit(2);
ck("95. Sem Wake Lock no navegador (ou recusado) avisa que não consegue manter o ecrã ligado, mas grava na mesma", K2.live.wl === "unsupported" && /Não consegui manter o ecrã ligado/.test(K2.el("runLiveNotes").innerHTML || K2.cur.html) && K2.live.st.nPts >= 1);
var K3 = makeBox();
K3.wl.deny = true; K3.startRun(); K3.emit(2);
await mt();
K3.adv(1000);
ck("96. Wake Lock recusado: avisa, e grava", K3.live.wl === "denied" && /Não consegui manter o ecrã ligado/.test(K3.el("runLiveNotes").innerHTML || ""));
var K4 = makeBox();
K4.startRun();
await mt();
K4.click("runLiveEnd"); K4.sheet.els.runLiveEndOk.click();
await mt();
ck("97. Terminar liberta o Wake Lock", K4.wl.sentinels.length === 1 && K4.wl.sentinels[0].released);

// rascunho que falha
var R1 = makeBox();
R1.store.failSet = true;
R1.startRun(); R1.emit(2);
ck("98. Se o localStorage recusa a escrita aparece «Não feches a app: a corrida ainda não está guardada» e a gravação continua", R1.live.draftOk === false && /Não feches a app: a corrida ainda não está guardada/.test(R1.el("runLiveNotes").innerHTML) && R1.live.st.nPts >= 1);
R1.store.failSet = false; R1.adv(11000); R1.emit(13);
ck("99. Quando a escrita volta a funcionar o aviso desaparece sozinho", R1.live.draftOk === true && !/Não feches a app/.test(R1.el("runLiveNotes").innerHTML));
var R2 = makeBox();
R2.startRun(); for (fi = 2; fi <= 6; fi++) R2.emit(fi);
var cfgR2 = R2.api.RUN_LIVE_CFG, keepMax = cfgR2.maxDraftPoints; cfgR2.maxDraftPoints = 1;
R2.adv(11000); R2.emit(20); R2.adv(11000); R2.emit(32);
ck("100. Acima do teto de pontos do rascunho deixa de escrever e avisa (a gravação em memória continua completa)", R2.live.draftOk === false && R2.live.st.nPts > 1);
cfgR2.maxDraftPoints = keepMax;

// bloquear toques
var B = makeBox();
B.startRun(); B.emit(2);
B.click("runLiveLockBtn");
ck("101. «Bloquear toques» põe uma camada por cima com instruções, e a gravação continua", B.live.locked === true && !!B.el("runLiveLock") && /Toques bloqueados/.test(B.cur.html) && /1,5 s/.test(B.cur.html));
var lock = B.el("runLiveLock");
lock.fire("pointerdown");
B.adv(800);
lock.fire("pointerup");
ck("102. Largar antes de ~1,5 s não desbloqueia", B.live.locked === true && !lock.removed && !B.live.unlockPending);
lock.fire("pointerdown");
B.adv(1600);
ck("103. Depois de ~1,5 s com o dedo premido fica pronto a desbloquear (a camada ainda cobre, para o toque de largar não acertar nos botões)", B.live.unlockPending === true && B.live.locked === true && !lock.removed);
lock.fire("pointerup");
B.adv(100);
ck("104. Ao largar desbloqueia e tira a camada", B.live.locked === false && lock.removed === true && B.live.unlockPending === false);
B.click("runLiveLockBtn");
var lock2 = B.el("runLiveLock");
lock2.fire("pointerdown"); B.adv(500); lock2.fire("pointerleave"); B.adv(2000);
ck("105. Se o dedo sai da camada antes do tempo, o relógio de pressão cancela-se", B.live.locked === true && B.live.lockTimer === null);
B.render();
ck("106. Redesenhar o separador (RUN.go) com os toques bloqueados mantém o bloqueio (o estado é da memória, não do DOM)", B.live.locked === true && !!B.el("runLiveLock"));

// estado em memória: redesenhar não perde nada
var M = makeBox();
M.startRun(); for (fi = 2; fi <= 20; fi++) M.emit(fi);
var distBefore = M.live.st.distM;
M.render(); M.render(); M.render();
ck("107. Redesenhar o separador várias vezes não perde o estado nem duplica relógios (um só intervalo ativo)", M.live.st.distM === distBefore && M.timers.list.filter(function(t){ return t.every; }).length === 1 && M.live.phase === "rec");
M.adv(1000);
ck("108. O cronómetro atualiza no sítio pelo relógio (o elemento existe e o texto muda sem novo desenho)", (function(){ var r = M.rendered, t0 = M.el("runLiveTime").textContent; M.adv(5000); return M.rendered === r && M.el("runLiveTime").textContent !== t0; })());

// sair da conta
var X = makeBox();
X.startRun(); for (fi = 2; fi <= 8; fi++) X.emit(fi);
await mt();
var xDraft = X.store.getItem("evolve_run_draft_v1"), xStarts = X.gps.starts;
X.RUN.reset();
await mt();
ck("109. RUN.reset pára o GPS, os relógios e o Wake Lock e esquece o estado em memória; não mexe no armazenamento", X.gps.stops >= 1 && X.live.tickId === null && X.live.st === null && X.live.phase === "intro" && X.wl.sentinels.every(function(s){ return s.released; }) &&
  X.timers.list.length === 0 && X.store.getItem("evolve_run_draft_v1") === xDraft && X.uiResets === 1 && X.RUN.v.name === "home");
var xSets = X.store.sets;
X.setHidden(true); X.pagehide(); X.adv(60000);
ck("110. Depois de RUN.reset nenhum evento (oculta, pagehide, tempo) volta a escrever o rascunho nem a pedir o GPS", X.store.sets === xSets && X.gps.starts === xStarts);
var X2 = makeBox();
X2.startRun(); X2.emit(2);
var staleFix = X2.gps.onFix, staleErr = X2.gps.onErr, x2Sets = X2.store.sets;
X2.RUN.reset();
staleFix(X2.fix(9)); staleFix(X2.fix(30)); staleErr({code: 1});
ck("111. Uma posição (ou erro) atrasada de um GPS que já foi parado é ignorada: não mexe no estado nem escreve o rascunho (sessão antiga)", X2.store.sets === x2Sets && X2.live.st === null && X2.live.err === null && X2.live.phase === "intro");
var X3 = makeBox();
X3.startRun(); X3.emit(2);
X3.api; X3.setUidViaApi = function(v){ X3.api.setUid(v); };
X3.setUidViaApi(U2);
X3.render();
ck("112. Se a conta mudou sem sair, a gravação de outra conta em memória esquece-se (sem escrever nada) e o ecrã é o inicial", X3.live.phase === "intro" && X3.live.st === null && /Antes de começares/.test(X3.cur.html));

var X4 = makeBox();
X4.startRun(); X4.emit(2);
var x4Before = X4.store.getItem("evolve_run_draft_v1");
X4.api.setUid(U2);
X4.emit(10); X4.adv(15000); X4.emit(30); X4.setHidden(true); X4.pagehide();
ck("113. Se a conta mudou sem sair, a gravação de outra conta que ainda está em memória nunca escreve o rascunho em nome da conta nova (o rascunho fica como estava, da conta antiga)", JSON.parse(X4.store.getItem("evolve_run_draft_v1")).uid === U1 && X4.store.getItem("evolve_run_draft_v1") === x4Before);

// retomar, guardar o que há e descartar depois de «recarregar» a página
var P1 = makeBox();
P1.startRun(); for (fi = 2; fi <= 40; fi++) P1.emit(fi);
P1.setHidden(true);      // como num telemóvel real: ao sair da página o rascunho escreve-se à força
P1.pagehide();           // ...e ao recarregar a página despede-se (rel), para a nova poder retomá-lo logo
var savedDraft = P1.store.getItem("evolve_run_draft_v1"), distP1 = Math.round(P1.live.st.distM);
function reopen(o){
  var store = memStore({"evolve_run_draft_v1": savedDraft});
  var b = makeBox(Object.assign({store: store, now: T0 + 60000}, o || {}));
  return b;
}
var Q = reopen();
var bannerHtml = Q.RUN.liveDraftBanner(Q.student);
ck("114. Com um rascunho do utilizador atual o banner oferece «Retomar», «Guardar o que há» e «Descartar» e diz o que há (distância, tempo, quando começou)", /id="runLiveBanner"/.test(bannerHtml) && /Retomar/.test(bannerHtml) && /Guardar o que há/.test(bannerHtml) && /Descartar/.test(bannerHtml) && /0,\d\d km/.test(bannerHtml) && /começada a \d\d\/\d\d\/\d{4} às \d\d:\d\d/.test(bannerHtml));
ck("115. Sem rascunho (ou de outra conta) o banner é vazio", makeBox().RUN.liveDraftBanner({id: "s1", runsColumn: true, runsMode: "live"}) === "" && reopen({uid: U2}).RUN.liveDraftBanner(Q.student) === "");
function bannerRoot(box){
  var html = box.RUN.liveDraftBanner(box.student), r = fakeRoot(html), handler = null;
  var root = {listeners: [], addEventListener: function(t, f){ if (t === "click") handler = f; }, innerHTML: ""};
  r.els.runLiveBanner = root;
  var wrap = {querySelector: function(sel){ return sel === "#runLiveBanner" ? root : null; }};
  box.RUN.liveWireBanner(box.student, wrap);
  box.bannerClick = function(act, id){ handler({target: {closest: function(){ return {getAttribute: function(n){ return n === "data-act" ? act : id; }}; }}}); };
  return html;
}
bannerRoot(Q);
Q.bannerClick("resume");
ck("116. «Retomar» recria o estado do rascunho (mesma distância e pontos), arranca o GPS só agora, marca o próximo ponto como lacuna e abre a vista ao vivo em gravação", Q.live.phase === "rec" && Math.round(Q.live.st.distM) === distP1 && Q.gps.starts === 1 && Q.live.st.brk === "gap" && Q.goCalls[Q.goCalls.length - 1] === "live" && !!Q.el("runLivePause"));
Q.emit(100, 3, 5);
ck("117. O 1.º ponto a seguir à retoma abre um segmento «gap» (a lacuna entre o último ponto guardado e agora) e não soma distância através dela", Q.live.st.gaps === 1 && (function(){ var segs = Q.live.st.segs; return segs[segs.length - 1][0].b === "gap" && Math.round(Q.live.st.distM) === distP1; })());
var Q2 = reopen();
bannerRoot(Q2);
Q2.bannerClick("save");
ck("118. «Guardar o que há» segue para RUN.saveFlow com os pontos do rascunho (source live, stats dos pontos guardados) sem arrancar o GPS; o rascunho continua guardado, agora desta janela e marcado como terminado", Q2.saveFlows.length === 1 && Q2.saveFlows[0].prep.source === "live" && Q2.saveFlows[0].prep.stats.distM === distP1 && Q2.gps.starts === 0 && Q2.live.phase === "end" &&
  draftOf(Q2).iid === Q2.api.runLInst && draftOf(Q2).ended === true && draftOf(Q2).st.nPts === JSON.parse(savedDraft).st.nPts);
var Q3 = reopen();
bannerRoot(Q3);
Q3.confirmAnswer = false;
Q3.bannerClick("discard");
ck("119. «Descartar» pergunta primeiro; se o aluno diz que não, nada se apaga", Q3.dialogs.length === 1 && /Descartar esta corrida\?/.test(Q3.dialogs[0]) && Q3.store.getItem("evolve_run_draft_v1") === savedDraft);
Q3.confirmAnswer = true;
Q3.bannerClick("discard");
ck("120. Confirmando, o rascunho apaga-se e a vista redesenha-se", Q3.store.getItem("evolve_run_draft_v1") === null && Q3.live.phase === "intro" && Q3.goCalls.length >= 1);
var Q4 = makeBox({store: memStore({"evolve_run_draft_v1": savedDraft}), now: T0 + 8 * 3600000});
var qb4 = Q4.RUN.liveDraftBanner(Q4.student);
ck("121. Passadas mais de 6 h o banner já não oferece «Retomar» (diz porquê) mas mantém «Guardar o que há»", !/Retomar/.test(qb4) && /Guardar o que há/.test(qb4) && /6 horas/.test(qb4));
var Q5 = makeBox({mode: "import", store: memStore({"evolve_run_draft_v1": savedDraft}), now: T0 + 60000});
var qb5 = Q5.RUN.liveDraftBanner(Q5.student);
ck("122. Com a Corrida ao vivo desligada pelo profissional o banner só oferece «Descartar» (e explica); nunca apaga sozinho", !/Retomar/.test(qb5) && !/Guardar o que há/.test(qb5) && /Descartar/.test(qb5) && /não está ligada/.test(qb5) && Q5.store.getItem("evolve_run_draft_v1") === savedDraft);
var Q6 = makeBox({store: memStore({"evolve_run_draft_v1": JSON.stringify({v: 1, uid: U1, st: {segs: []}})}), now: T0});
var qb6 = Q6.RUN.liveDraftBanner(Q6.student);
ck("123. Um rascunho estragado do utilizador atual aparece, só com «Descartar» (nunca se apaga em silêncio)", /Descartar/.test(qb6) && !/Retomar/.test(qb6) && !/Guardar o que há/.test(qb6) && /não tem posições aproveitáveis/.test(qb6) && Q6.store.getItem("evolve_run_draft_v1") !== null);
var Q7 = reopen();
var scr7 = Q7.opens();
ck("124. Abrir «Gravar com GPS» com um rascunho por resolver mostra as escolhas em vez de começar outra corrida por cima", /resolve a que ficou por terminar/.test(scr7) && /Retomar/.test(scr7) && !/id="runLiveGo"/.test(scr7) && Q7.store.getItem("evolve_run_draft_v1") === savedDraft);
var Q8 = makeBox();
Q8.startRun(); Q8.emit(2);
var ban8 = Q8.RUN.liveDraftBanner(Q8.student);
ck("125. Com uma gravação a decorrer o banner diz «Corrida a decorrer» e oferece «Voltar à gravação» (nada de retomar o rascunho)", /Corrida a decorrer/.test(ban8) && /Voltar à gravação/.test(ban8) && !/Retomar/.test(ban8));
Q8.click("runLiveEnd"); Q8.sheet.els.runLiveEndOk.click();
var ban8b = Q8.RUN.liveDraftBanner(Q8.student);
ck("126. Depois de terminar e antes de guardar o banner diz «Corrida por guardar» com «Rever e guardar» e «Descartar»", /Corrida por guardar/.test(ban8b) && /Rever e guardar/.test(ban8b) && /Descartar/.test(ban8b));

// professional e outras situações do ecrã
var Pro = makeBox({role: "professional"});
ck("127. O profissional (pré-visualização) não grava: o ecrã diz que só o aluno grava e RUN.liveOpen só avisa", /Só o aluno|só o aluno/.test(Pro.RUN.liveScreen(Pro.student)) && (function(){ Pro.RUN.liveOpen(Pro.student); return Pro.goCalls.length === 0 && Pro.toasts.length === 1; })());
var Imp = makeBox({mode: "import"});
Imp.RUN.liveOpen(Imp.student);
ck("128. Com a Corrida em modo «import» não se abre a gravação (aviso) e o ecrã explica que não está ligada", Imp.goCalls.length === 0 && Imp.toasts.length === 1 && /não está ligada/.test(Imp.RUN.liveScreen(Imp.student)));
var Esc = makeBox();
Esc.student.name = "<img src=x onerror=alert(1)>";
ck("129. Nada do que vem de dados entra sem escape no HTML do ecrã ao vivo", !/<img/.test(Esc.opens() + Esc.RUN.liveDraftBanner(Esc.student)));
var Sum = makeBox();
Sum.opens(); Sum.click("runLiveGo"); Sum.click("runLivePrepare"); Sum.emit(0); Sum.click("runLiveStart");
Sum.click("runLiveEnd"); Sum.sheet.els.runLiveEndOk.click();
ck("130. Terminar sem nenhuma posição aceite: o resumo diz que não houve posições suficientes, não deixa guardar (só descartar) e não deixa rascunho", /Não houve posições suficientes/.test(Sum.cur.html) && !Sum.el("runLiveReview") && !!Sum.el("runLiveDiscard") && Sum.store.getItem("evolve_run_draft_v1") === null);
Sum.confirmAnswer = false; Sum.click("runLiveDiscard");
ck("131. «Descartar» no resumo pede confirmação; sem confirmação nada muda", Sum.dialogs.length === 1 && Sum.live.phase === "end");
Sum.confirmAnswer = true; Sum.click("runLiveDiscard");
ck("132. Confirmando, descarta tudo e volta ao início da Corrida", Sum.live.phase === "intro" && Sum.live.st === null && Sum.goCalls[Sum.goCalls.length - 1] === "home");
var Stale = makeBox();
Stale.opens(); Stale.click("runLiveGo"); Stale.click("runLivePrepare"); Stale.emit(0); Stale.click("runLiveStart");
var tapMs = Stale.live.tapMs;
Stale.gps.onFix({lat: LAT0 + 0.01, lon: LON0, acc: 5, t: tapMs - 45000});
var staleIgnored = Stale.live.st.nPts === 0 && Stale.live.st.startedAtMs === null;
Stale.emit(2);
ck("133. Uma posição de cache anterior ao toque em Iniciar (mais de 30 s) não conta nem fixa o início da corrida; a seguinte, sim", staleIgnored && Stale.live.st.nPts === 1 && Stale.live.st.startedAtMs === T0 + 2000);

// ================================================================ privacidade
var allText = [].concat(S.toasts, G.toasts, E2.toasts, Q.toasts, X.toasts, E.toasts).join(" ") + " " + [S, G, E2, E, Q, V, H, X].map(function(b){ return b.consoleCalls.join(" "); }).join(" ");
var htmlAll = recHtml + S.cur;
ck("134. Nenhuma coordenada em toasts nem na consola durante os fluxos", !/38\.7|-9\.1|38,7|-9,1/.test(allText) && S.consoleCalls.length === 0 && G.consoleCalls.length === 0 && E2.consoleCalls.length === 0);
ck("135. Nenhuma coordenada no HTML dos ecrãs de gravação, resumo e banner", (function(){
  var all = [recHtml, bannerHtml, qb4, qb5, Q.cur ? Q.cur.html : "", G.cur ? G.cur.html : "", E2.cur ? E2.cur.html : ""].join(" ");
  return !/38\.7\d|-9\.1\d|38,7\d|-9,1\d/.test(all);
})());

// ================================================================ fila: envio
var net = function(){ return {error: {message: "TypeError: Failed to fetch", code: ""}, status: 0}; };
function seedBox(entries, o){
  var q = []; entries.forEach(function(e){ q = P.runLiveQueueAdd(q, e.item, e.uid || U1, e.ts || T0).list; });
  entries.forEach(function(e, i){ if (e.state) { q[i].state = e.state; if (e.state === "failed") q[i].fat = e.fat != null ? e.fat : T0; } if (e.code) q[i].code = e.code; });
  return makeBox(Object.assign({store: memStore({"evolve_runs_outbox_v1": JSON.stringify(q)})}, o || {}));
}
function itemOf(id, withTrack){ return {row: rowOf(id), track: withTrack ? trackOf() : null}; }
function queueOf(box){ return JSON.parse(box.store.getItem("evolve_runs_outbox_v1") || "[]"); }

  // submitRun embrulhado (parte assíncrona preparada acima)
  await pW1;
  ck("136. Se a corrida ao vivo NÃO ficou guardada (erro), o rascunho mantém-se", wres.ok === false && W.store.getItem("evolve_run_draft_v1") !== null && W.live.phase === "end");
  W.submitResult = function(){ return {ok: true, queued: false}; };
  var okOther = await W.RUN.submitRun(W.student, {row: Object.assign({}, wrow, {id: RID2, started_at: new Date(T0 - 99999999).toISOString()}), track: null});
  ck("137. Guardar OUTRA corrida (hora de início diferente) não apaga o rascunho desta", okOther.ok && W.store.getItem("evolve_run_draft_v1") !== null);
  var okRes = await W.RUN.submitRun(W.student, {row: wrow, track: null});
  ck("138. Quando RUN.submitRun diz ok para esta corrida (mesma hora de início) o rascunho apaga-se e o estado limpa-se", okRes.ok && W.store.getItem("evolve_run_draft_v1") === null && W.live.phase === "intro");

  var W2 = makeBox();
  W2.startRun(); for (fi = 2; fi <= 30; fi++) W2.emit(fi);
  W2.click("runLiveEnd"); W2.sheet.els.runLiveEndOk.click(); W2.click("runLiveReview");
  W2.submitResult = function(){ return {ok: true, queued: true}; };
  var qs = W2.saveFlows[0].prep.stats, qrow = P.runBuildInsert({id: RID3, studentId: "s1", source: "live", startedAtMs: qs.startedAtMs, durationS: qs.durationS, movingS: qs.movingS, distM: qs.distM, consentV: 1}, T0 + 3600000);
  var rq = await W2.RUN.submitRun(W2.student, {row: qrow, track: null});
  ck("139. Se submitRun diz «na fila» mas a fila não guardou a corrida, o aluno é avisado e o rascunho fica (nunca se perde)", rq.ok === false && /Não feches a app|sem espaço/.test(rq.error) && W2.store.getItem("evolve_run_draft_v1") !== null);
  W2.RUN.queueAdd({row: qrow, track: null});
  var rq2 = await W2.RUN.submitRun(W2.student, {row: qrow, track: null});
  ck("140. Com a corrida mesmo na fila, ok+queued é aceite e o rascunho apaga-se", rq2.ok && rq2.queued === true && W2.store.getItem("evolve_run_draft_v1") === null && queueOf(W2).length === 1);

  // queueAdd público
  var A = makeBox();
  ck("141. RUN.queueAdd guarda só o que seria enviado, com uid e estado; devolve true; repetir o id devolve true sem duplicar", A.RUN.queueAdd(itemOf(RID1, true)) === true && A.RUN.queueAdd(itemOf(RID1, true)) === true && queueOf(A).length === 1 && queueOf(A)[0].uid === U1 && queueOf(A)[0].state === "pending" && A.RUN.queuePending() === 1);
  ck("142. RUN.queueAdd recusa lixo (false) e sem conta (false) e não escreve nada", A.RUN.queueAdd({row: {}}) === false && A.RUN.queueAdd(null) === false && makeBox({uid: null}).RUN.queueAdd(itemOf(RID1)) === false && queueOf(A).length === 1);
  var fullBox = makeBox();
  for (qi = 0; qi < 20; qi++) fullBox.RUN.queueAdd({row: rowOf("bbbbbbbb-bbbb-4bbb-8bbb-0000000000" + (10 + qi)), track: null});
  ck("143. Fila cheia (20): o 21.º é recusado (false) e a fila fica como estava", fullBox.RUN.queueAdd(itemOf(RID2)) === false && queueOf(fullBox).length === 20);
  var failStore = makeBox(); failStore.store.failSet = true;
  ck("144. Se o armazenamento recusa a escrita queueAdd devolve false", failStore.RUN.queueAdd(itemOf(RID1)) === false);
  var otherUser = seedBox([{item: itemOf(RID1), uid: U2}, {item: itemOf(RID2), uid: U1}]);
  ck("145. Entradas de outra conta ignoram-se: contam e enviam-se só as do utilizador atual", otherUser.RUN.queuePending() === 1);
  var fo = await otherUser.RUN.flush();
  ck("146. O envio só toca nas do utilizador atual (a de outra conta fica intacta na fila)", fo.sent === 1 && otherUser.sbCalls.length === 1 && otherUser.sbCalls[0].row.id === RID2 && queueOf(otherUser).length === 1 && queueOf(otherUser)[0].uid === U2);

  // ordem, percurso, 23505, transitório, permanente
  var O = seedBox([{item: itemOf(RID1, true), ts: T0}, {item: itemOf(RID2, false), ts: T0 + 1}, {item: itemOf(RID3, true), ts: T0 + 2}]);
  var fr = await O.RUN.flush();
  ck("147. RUN.flush envia em série, pela ordem da fila, corrida e depois percurso (só se houver), e esvazia a fila", fr.sent === 3 && fr.left === 0 && O.sbCalls.map(function(c){ return c.table + ":" + (c.row.id || c.row.run_id).slice(0, 2); }).join() === "runs:11,run_tracks:11,runs:22,runs:33,run_tracks:33" && O.store.getItem("evolve_runs_outbox_v1") === null);
  var trk = O.sbCalls[1].row;
  ck("148. O percurso vai com fmt 1, trim_m e os pontos já preparados (3 números cada), nada mais", trk.fmt === 1 && trk.trim_m === 0 && Array.isArray(trk.points) && trk.points[0][0].length === 3 && Object.keys(trk).sort().join() === "fmt,points,run_id,student_id,trim_m");
  var D1 = seedBox([{item: itemOf(RID1, true)}]);
  D1.sbBehavior.runs = function(){ return {error: {code: "23505", message: "duplicate key"}, status: 409}; };
  var fd1 = await D1.RUN.flush();
  ck("149. 23505 na corrida = já chegou: não é erro, tira da fila e ainda tenta o percurso (que pode ter ficado por enviar)", fd1.sent === 1 && queueOf(D1).length === 0 && D1.sbCalls.map(function(c){ return c.table; }).join() === "runs,run_tracks");
  D1 = seedBox([{item: itemOf(RID1, true)}]);
  D1.sbBehavior.runs = function(){ return {error: {code: "23505"}, status: 409}; }; D1.sbBehavior.run_tracks = function(){ return {error: {code: "23505"}, status: 409}; };
  var fd2 = await D1.RUN.flush();
  ck("150. 23505 também no percurso é «já chegou»", fd2.sent === 1 && queueOf(D1).length === 0);
  var T1 = seedBox([{item: itemOf(RID1, false), ts: T0}, {item: itemOf(RID2, false), ts: T0 + 1}]);
  T1.sbBehavior.runs = net;
  var ft = await T1.RUN.flush();
  ck("151. Erro transitório (sem rede/5xx): mantém tudo na fila, pára de insistir nesta passagem (uma só tentativa) e nada é marcado", ft.sent === 0 && ft.failed === 0 && T1.sbCalls.length === 1 && queueOf(T1).length === 2 && queueOf(T1).every(function(e){ return e.state === "pending"; }));
  [{code: "", status: 503, message: "x"}, {code: "", status: 401, message: "JWT expired"}, {code: "", status: 429, message: "x"}, {code: "", status: 408, message: "x"}].forEach(function(e0, i){ });
  var tr5 = [503, 401, 408, 429], okTr = true;
  for (qi = 0; qi < tr5.length; qi++) {
    var T2 = seedBox([{item: itemOf(RID1, false)}]);
    T2.sbBehavior.runs = (function(st){ return function(){ return {error: {code: "", message: "x"}, status: st}; }; })(tr5[qi]);
    await T2.RUN.flush();
    if (queueOf(T2)[0].state !== "pending") okTr = false;
  }
  ck("152. 503, 401, 408 e 429 também são transitórios (a corrida fica à espera)", okTr);
  var Pm = seedBox([{item: itemOf(RID1, false), ts: T0}, {item: itemOf(RID2, false), ts: T0 + 1}]);
  Pm.sbBehavior.runs = function(row){ return row.id === RID1 ? {error: {code: "42501", message: "new row violates row-level security policy"}, status: 403} : {error: null, status: 201}; };
  var fpm = await Pm.RUN.flush();
  var qpm = queueOf(Pm);
  ck("153. Recusa permanente (RLS 42501): marca essa corrida como «failed» com explicação, fica na fila (o aluno decide) e as seguintes continuam a enviar-se", fpm.sent === 1 && fpm.failed === 1 && qpm.length === 1 && qpm[0].id === RID1 && qpm[0].state === "failed" && /desativada|consentimento/.test(qpm[0].err) && Pm.RUN.queuePending() === 0 && Pm.RUN.queueFailed() === 1);
  var codes = {"23514": /valores fora do permitido/, "23503": /consentimento/, "PGRST205": /indisponível/, "42P01": /indisponível/, "99999": /recusou/}, okCodes = true;
  for (var cc in codes) {
    var Pc = seedBox([{item: itemOf(RID1, false)}]);
    Pc.sbBehavior.runs = (function(code){ return function(){ return {error: {code: code, message: "m"}, status: 400}; }; })(cc);
    await Pc.RUN.flush();
    var qc = queueOf(Pc)[0];
    if (!(qc.state === "failed" && codes[cc].test(qc.err))) okCodes = false;
  }
  ck("154. Cada código permanente (CHECK, chave estrangeira, tabela em falta PGRST205/42P01, desconhecido) dá a sua explicação em PT-PT e nunca o texto do servidor", okCodes);
  var fAgain = await Pm.RUN.flush();
  var callsRid1 = function(b){ return b.sbCalls.filter(function(c){ return c.table === "runs" && c.row.id === RID1; }).length; };
  var c1 = callsRid1(Pm);
  await Pm.RUN.flush(); await Pm.RUN.flush();
  ck("155. Uma corrida recusada por uma causa que pode passar (42501) volta a tentar-se UMA vez por sessão, sozinha (2 pedidos no total); depois não se volta a enviar sozinha", fAgain.sent === 0 && c1 === 2 && callsRid1(Pm) === 2 && queueOf(Pm).length === 1 && queueOf(Pm)[0].state === "failed");
  var Tl = seedBox([{item: itemOf(RID1, true)}]);
  Tl.sbBehavior.run_tracks = function(){ return {error: {code: "23514", message: "m"}, status: 400}; };
  var ftl = await Tl.RUN.flush();
  ck("156. Se a corrida entra e o percurso é recusado de vez, a corrida sai da fila (já está guardada) e o aluno é avisado", ftl.sent === 1 && queueOf(Tl).length === 0 && Tl.toasts.some(function(t){ return /o percurso não/.test(t); }));
  var Tt = seedBox([{item: itemOf(RID1, true)}]);
  Tt.sbBehavior.run_tracks = net;
  var ftt = await Tt.RUN.flush();
  ck("157. Se a corrida entra e o percurso falha por rede, a corrida fica na fila (o envio seguinte tolera 23505 e só falta o percurso)", ftt.sent === 0 && queueOf(Tt).length === 1);
  var Off = seedBox([{item: itemOf(RID1, false)}]);
  Off.onLine = false;
  var fof = await Off.RUN.flush();
  ck("158. Sem ligação (navigator.onLine falso) não faz nenhum pedido", fof.sent === 0 && Off.sbCalls.length === 0 && queueOf(Off).length === 1);
  var NoSb = seedBox([{item: itemOf(RID1, false)}], {noSb: true});
  var fns = await NoSb.RUN.flush();
  ck("159. Sem cliente Supabase (modo local) não faz nenhum pedido nem lança", fns.sent === 0 && queueOf(NoSb).length === 1);
  var Sf = seedBox([{item: itemOf(RID1, false)}]);
  var p1 = Sf.RUN.flush(), p2 = Sf.RUN.flush();
  ck("160. Duas chamadas seguidas a RUN.flush partilham o mesmo envio (nada é enviado duas vezes)", p1 === p2);
  await p1;
  ck("161. ...e foi enviada uma vez só", Sf.sbCalls.length === 1);
  var On = seedBox([{item: itemOf(RID1, false)}]);
  On.onLine = false; On.goOnline();
  await new Promise(function(r){ setTimeout(r, 20); });
  ck("162. O evento «online» envia a fila (um só envio)", On.sbCalls.length === 1 && queueOf(On).length === 0);
  var On2 = makeBox();
  On2.goOnline();
  ck("163. O evento «online» sem nada na fila não faz nada", On2.sbCalls.length === 0);
  var Ban = seedBox([{item: itemOf(RID1, false), state: "failed"}, {item: itemOf(RID2, false)}]);
  var bh = Ban.RUN.liveDraftBanner(Ban.student);
  ck("164. O aviso da vista «home» mostra as corridas por enviar e as recusadas («Não foi possível guardar») com «Apagar», sem mostrar texto do servidor", /Corridas por enviar/.test(bh) && /Não foi possível guardar/.test(bh) && /data-act="del"/.test(bh) && /data-act="retry"/.test(bh) && !/violates|row-level/.test(bh));
  bannerRoot(Ban);
  Ban.confirmAnswer = false; Ban.bannerClick("del", RID1);
  var keptAfterNo = queueOf(Ban).length;
  Ban.confirmAnswer = true; Ban.bannerClick("del", RID1);
  ck("165. «Apagar» uma recusada pergunta primeiro; só com confirmação sai da fila (a outra fica)", keptAfterNo === 2 && Ban.dialogs.length === 2 && queueOf(Ban).length === 1 && queueOf(Ban)[0].id === RID2);
  var Op = seedBox([{item: itemOf(RID1, false)}]);
  bannerRoot(Op);
  await new Promise(function(r){ setTimeout(r, 20); });
  ck("166. Ao abrir a vista «home» (liveWireBanner) tenta-se enviar a fila uma vez", Op.sbCalls.length === 1 && queueOf(Op).length === 0);
  var Cn = seedBox([{item: itemOf(RID1, false)}], {uid: U1});
  Cn.api.setUid(null);
  var fcn = await Cn.RUN.flush();
  ck("167. Sem sessão (sem uid) não envia nada nem lança", fcn.sent === 0 && Cn.sbCalls.length === 0);

  // abre a vista da fila nos erros de RUN.liveWire com elementos em falta
  var Mw = makeBox();
  var threwWire = false; try { Mw.RUN.liveWire(Mw.student, {querySelector: function(){ return null; }}); Mw.RUN.liveWire(Mw.student, null); } catch (e) { threwWire = true; }
  ck("168. liveWire com um ecrã sem os elementos esperados (ou sem ecrã) não rebenta", !threwWire);


  // ================================================================ revisão: relógio dos fixes (achados 7 e 19)
  var CL = P.runLiveClampT;
  ck("169. Hora de um fix limitada ao relógio: até 2 s à frente passa; à frente por mais (até 5 min) fica a 2 s do relógio (uma posição não é do futuro); a mais de 5 min para qualquer lado usa a hora do relógio; atrasada até 5 min mantém-se; lixo usa o relógio",
    CL(T0 + 1000, T0) === T0 + 1000 && CL(T0 + 30000, T0) === T0 + 2000 && CL(T0 + 4 * 60000, T0) === T0 + 2000 && CL(T0 + 86400000, T0) === T0 && CL(T0 - 10 * 60000, T0) === T0 && CL(T0 - 4 * 60000, T0) === T0 - 240000 &&
    CL(NaN, T0) === T0 && CL(null, T0) === T0 && CL(T0, NaN) === T0 && CL(NaN, NaN) === null);
  function runWithBadFix(badT){
    var b = makeBox();
    b.startRun();
    for (fi = 2; fi <= 20; fi++) b.emit(fi);
    if (badT != null) { b.clock.now = T0 + 21000; b.gps.onFix({lat: LAT0 + 3 * 21 / M_LAT, lon: LON0, acc: 5, t: badT(b.clock.now), speed: null}); }
    for (fi = badT != null ? 22 : 21; fi <= 60; fi++) b.emit(fi);
    return b;
  }
  var clean = runWithBadFix(null), poisoned = runWithBadFix(function(now){ return now + 86400000; }), early = runWithBadFix(function(now){ return now + 3 * 60000; }), near = runWithBadFix(function(now){ return now + 12000; });
  ck("170. UM fix com a hora adiantada (12 s, 3 min ou 1 dia) não envenena a gravação: a distância fica perto da de uma corrida sem esse fix e só se perdem 2 posições por «hora repetida» (os 12 s, dentro da lacuna de 15 s, o núcleo sozinho não os apanha: recusava-se o que vinha a seguir durante 12 s)",
    clean.live.st.distM > 150 && poisoned.live.st.distM > 0.9 * clean.live.st.distM && early.live.st.distM > 0.9 * clean.live.st.distM && near.live.st.distM > 0.9 * clean.live.st.distM &&
    poisoned.live.st.rej.time <= 3 && early.live.st.rej.time <= 3 && near.live.st.rej.time <= 3 && poisoned.live.badRun === 0 && near.live.badRun === 0);
  var oldFix = makeBox();
  oldFix.startRun(); oldFix.emit(2); oldFix.emit(3);
  var nBeforeOld = oldFix.live.st.nPts;
  oldFix.gps.onFix({lat: LAT0 + 0.002, lon: LON0, acc: 5, t: oldFix.clock.now - 10 * 60000, speed: null});
  ck("171. Uma posição de cache de há 10 min (anterior ao toque) continua a não contar (não se lhe dá a hora do relógio) e fica contada como «posição que não serve»", oldFix.live.st.nPts === nBeforeOld && oldFix.live.badRun === 1);
  var BR = makeBox();
  BR.startRun(); for (fi = 2; fi <= 10; fi++) BR.emit(fi);
  var lastOk = BR.live.st.maxT, brHtmlBefore = BR.el("runLiveSignal").textContent;
  for (var bi2 = 0; bi2 < 5; bi2++) BR.gps.onFix({lat: LAT0 + 0.0003, lon: LON0, acc: 5, t: lastOk, speed: null});   // a hora não cresce: «time»
  var brSig = BR.el("runLiveSignal").textContent, brWrapHidden = BR.el("runLiveRestartWrap").hiddenClass;
  BR.emit(11);
  ck("172. Cinco posições seguidas que o registo não aproveita (hora que não cresce) deixam de dizer «Sinal bom»: o ecrã avisa («A receber posições que o registo não consegue usar») e mostra «Reiniciar GPS»; uma posição boa limpa o aviso",
    /Sinal bom/.test(brHtmlBefore) && /A receber posições que o registo não consegue usar/.test(brSig) && brWrapHidden === false && BR.live.badRun === 0 && /Sinal bom/.test(BR.el("runLiveSignal").textContent) && BR.el("runLiveRestartWrap").hiddenClass === true);
  ck("173. runLiveSignalInfo: com badRun >= 5 diz que não consegue usar as posições (kind none); com 4 não; a pausa e a permissão recusada têm prioridade",
    P.runLiveSignalInfo({hasCb: true, sinceCbS: 1, acc: 5, accMax: 30, badRun: 5}).kind === "none" && /não consegue usar/.test(P.runLiveSignalInfo({hasCb: true, sinceCbS: 1, acc: 5, accMax: 30, badRun: 9}).text) &&
    P.runLiveSignalInfo({hasCb: true, sinceCbS: 1, acc: 5, accMax: 30, badRun: 4}).kind === "good" && P.runLiveSignalInfo({paused: true, badRun: 9, hasCb: true, sinceCbS: 1, accMax: 30}).kind === "paused" &&
    P.runLiveSignalInfo({err: "denied", badRun: 9}).text === "A localização foi recusada.");

  // ================================================================ revisão: recibo local do consentimento (achados 11, 16 e 21)
  var CC = makeBox(), ccKey = "evolve_run_consent_v1";
  ck("174. Recibo do consentimento (RUN.consentCacheSet/Get/Clear): guarda {uid, studentId, version, at} em evolve_run_consent_v1 e devolve a versão só para esse aluno e essa conta",
    CC.RUN.consentCacheGet("s1") === null && CC.RUN.consentCacheSet("s1", 1) === true && CC.RUN.consentCacheGet("s1") === 1 && (function(){ var r = JSON.parse(CC.store.getItem(ccKey)); return r.uid === U1 && r.studentId === "s1" && r.version === 1 && typeof r.at === "number"; })() &&
    CC.RUN.consentCacheGet("s2") === null && CC.RUN.consentCacheGet("") === null && CC.RUN.consentCacheGet(null) === null);
  CC.api.setUid(U2);
  ck("175. O recibo de outra conta nunca vale (nem sem sessão); com a conta de volta vale outra vez", CC.RUN.consentCacheGet("s1") === null && (CC.api.setUid(null), CC.RUN.consentCacheGet("s1") === null) && (CC.api.setUid(U1), CC.RUN.consentCacheGet("s1") === 1));
  ck("176. Versões inválidas (0, negativa, fracionária, texto, NaN) nem se guardam; sem sessão não se guarda", CC.RUN.consentCacheSet("s1", 0) === false && CC.RUN.consentCacheSet("s1", -1) === false && CC.RUN.consentCacheSet("s1", 1.5) === false && CC.RUN.consentCacheSet("s1", "1") === false &&
    CC.RUN.consentCacheSet("s1", NaN) === false && CC.RUN.consentCacheSet("", 1) === false && CC.RUN.consentCacheGet("s1") === 1 && (CC.api.setUid(null), CC.RUN.consentCacheSet("s1", 1) === false) && (CC.api.setUid(U1), true));
  CC.RUN.consentCacheClear("s2");
  var keptOther = CC.RUN.consentCacheGet("s1");
  CC.RUN.consentCacheClear("s1");
  ck("177. Limpar o recibo de OUTRO aluno não toca neste; limpar o deste apaga-o", keptOther === 1 && CC.RUN.consentCacheGet("s1") === null && CC.store.getItem(ccKey) === null);
  var CJ = makeBox({store: memStore({"evolve_run_consent_v1": "{isto não é json"})}), cjThrew = false, cj = null;
  try { cj = CJ.RUN.consentCacheGet("s1"); CJ.RUN.consentCacheClear("s1"); } catch (e) { cjThrew = true; }
  var CK = makeBox({store: memStore({"evolve_run_consent_v1": JSON.stringify([1, 2])})}), CT = makeBox();
  CT.store.getItem = function(){ throw new Error("SecurityError"); };
  var ctVal = "x"; try { ctVal = CT.RUN.consentCacheGet("s1"); } catch (e) { ctVal = "lançou"; }
  var CF = makeBox(); CF.store.failSet = true;
  ck("178. JSON mau ou forma errada dá null (sem lançar) e o recibo estragado apaga-se ao limpar; localStorage que lança na leitura dá null; na escrita dá false", !cjThrew && cj === null && CJ.store.getItem(ccKey) === null && CK.RUN.consentCacheGet("s1") === null && ctVal === null && CF.RUN.consentCacheSet("s1", 1) === false);
  var CR = makeBox();
  CR.RUN.consentCacheSet("s1", 1); CR.startRun(); CR.RUN.reset();
  ck("179. RUN.reset (sair da conta) não mexe no recibo (quem o apaga é runWipeLocal, em app.js); o recibo não leva coordenadas nem o nome do aluno", CR.RUN.consentCacheGet("s1") === 1 && !/38\.7|-9\.1|Ana/.test(CR.store.getItem(ccKey)));

  // ================================================================ revisão: fila — recusadas (achados 14, 46 e 49)
  var AR = seedBox([{item: itemOf(RID1, true), state: "failed", code: "PGRST205"}]);
  var far = await AR.RUN.flush();
  ck("180. Uma corrida recusada de vez por «tabela em falta» (PGRST205, logo a seguir à migração) volta a tentar-se sozinha uma vez na sessão seguinte: se a causa passou, é enviada e sai da fila", far.sent === 1 && queueOf(AR).length === 0 && AR.sbCalls.map(function(c){ return c.table; }).join() === "runs,run_tracks");
  var A42 = seedBox([{item: itemOf(RID1, false), state: "failed", code: "42501"}]);
  A42.sbBehavior.runs = function(){ return {error: {code: "42501", message: "rls"}, status: 403}; };
  await A42.RUN.flush(); await A42.RUN.flush(); await A42.RUN.flush();
  var n42 = A42.sbCalls.length;
  var bn = bannerRoot(A42);
  ck("181. Se continua recusada, a retentativa automática é uma só por sessão (não há ciclo); o banner passa a oferecer «Tentar outra vez» e «Apagar»", n42 === 1 && /data-act="reopen"/.test(bn) && /data-act="del"/.test(bn) && /Tentar outra vez/.test(bn) && queueOf(A42)[0].state === "failed" && queueOf(A42)[0].code === "42501");
  A42.bannerClick("reopen", RID1);
  await new Promise(function(r){ setTimeout(r, 20); });
  ck("182. «Tentar outra vez» numa recusada volta a pô-la na fila e envia-a (aqui foi recusada de novo e o aluno vê-a outra vez)", A42.sbCalls.length === 2 && queueOf(A42)[0].state === "failed");
  A42.sbBehavior.runs = null; delete A42.sbBehavior.runs;
  A42.bannerClick("reopen", RID1);
  await new Promise(function(r){ setTimeout(r, 20); });
  ck("183. Com a causa resolvida, «Tentar outra vez» envia a corrida e a fila fica vazia", queueOf(A42).length === 0 && A42.sbCalls.length === 3);
  var T23 = seedBox([{item: itemOf(RID1, false), state: "failed", code: "23514"}]);
  T23.sbBehavior.runs = function(){ return {error: {code: "23514"}, status: 400}; };
  await T23.RUN.flush();
  var b23 = T23.RUN.liveDraftBanner(T23.student);
  ck("184. Uma recusa por valores fora do permitido (23514, 22xxx) é terminal: nunca se reenvia sozinha e o banner só oferece «Apagar»; e o texto diz que fica no máximo 30 dias", T23.sbCalls.length === 0 && !/data-act="reopen"/.test(b23) && /data-act="del"/.test(b23) && /no máximo 30 dias/.test(b23));
  var U9 = seedBox([{item: itemOf(RID1, false), state: "failed", code: "99999"}]);
  ck("185. Um código desconhecido também deixa tentar outra vez (o aluno decide), mas não se reenvia sozinho", /data-act="reopen"/.test(U9.RUN.liveDraftBanner(U9.student)) && (await U9.RUN.flush(), U9.sbCalls.length === 0));
  var EX = seedBox([{item: itemOf(RID1, true), state: "failed", code: "23514", fat: T0 - 31 * 86400000}, {item: itemOf(RID2, false), state: "failed", code: "23514", fat: T0 - 29 * 86400000}, {item: itemOf(RID3, false), state: "failed", code: "23514", fat: 0}]);
  await EX.RUN.flush();
  var qex = queueOf(EX);
  ck("186. As recusadas expiram ao fim de 30 dias (o percurso partilhado não fica para sempre no telemóvel): a de 31 dias sai e avisa; a de 29 fica; uma antiga sem data passa a contar a partir de agora", qex.length === 2 && qex.map(function(e){ return e.id; }).join() === RID2 + "," + RID3 && qex[1].fat === T0 && EX.toasts.some(function(t){ return /Apaguei deste telemóvel uma corrida recusada há mais de 30 dias/.test(t); }));
  var PD = seedBox([{item: itemOf(RID1, true), ts: T0}, {item: itemOf(RID2, false), ts: T0 + 1}]);
  PD.onLine = false;
  var pdBan = bannerRoot(PD);
  await mt();
  ck("187. Cada corrida por enviar tem o seu «Apagar» (o aluno pode desistir de partilhar o percurso antes de ele sair do telemóvel)", (pdBan.match(/data-act="delpend"/g) || []).length === 2 && /Tentar enviar agora/.test(pdBan));
  PD.confirmAnswer = false; PD.bannerClick("delpend", RID1);
  var keptPd = queueOf(PD).length;
  PD.confirmAnswer = true; PD.bannerClick("delpend", RID1);
  ck("188. «Apagar» uma por enviar pergunta primeiro; só com confirmação sai da fila (a outra fica); com o servidor não chegou nada", keptPd === 2 && queueOf(PD).length === 1 && queueOf(PD)[0].id === RID2 && /ainda não foi enviada/.test(PD.dialogs[1]) && PD.sbCalls.length === 0);
  var PF = seedBox([{item: itemOf(RID1, false)}, {item: itemOf(RID2, false)}]);
  PF.sbBehavior.runs = function(){ return new Promise(function(){}) === null ? null : {error: null, status: 201}; };
  bannerRoot(PF);
  var pfFlush = PF.RUN.flush();
  PF.bannerClick("delpend", RID2);
  ck("189. Enquanto a fila está a ser enviada não se apaga nada (aviso «A enviar neste momento»): o pedido em curso não pode ser desfeito", queueOf(PF).length >= 1 && PF.toasts.some(function(t){ return /A enviar neste momento/.test(t); }) && PF.dialogs.length === 0);
  await pfFlush;
  // envio da fila sem ciclo infinito se a escrita local falhar
  var LF = seedBox([{item: itemOf(RID1, false), ts: T0}, {item: itemOf(RID2, false), ts: T0 + 1}]);
  var lfCalls = 0;
  LF.sbBehavior.runs = function(){ lfCalls++; if (lfCalls > 40) return {error: {message: "Failed to fetch"}, status: 0}; return {error: null, status: 201}; };
  LF.store.failSet = true;
  var flf = await LF.RUN.flush();
  ck("190. Se a fila local não se deixa escrever depois de enviar, o envio pára (um pedido por corrida, sem ciclo), diz-no ao aluno e devolve reason «local» (antes: centenas de pedidos por segundo)", lfCalls === 1 && flf.reason === "local" && flf.sent === 0 && LF.toasts.some(function(t){ return /Não consegui atualizar as corridas por enviar/.test(t); }));
  var LM = seedBox([{item: itemOf(RID1, false)}, {item: itemOf(RID2, false)}]);
  var lmCalls = 0;
  LM.sbBehavior.runs = function(){ lmCalls++; if (lmCalls > 40) return {error: {message: "Failed to fetch"}, status: 0}; return {error: {code: "42501"}, status: 403}; };
  LM.store.failSet = true;
  var flm = await LM.RUN.flush();
  ck("191. O mesmo ao marcar uma recusada (a escrita local falha): para sem ciclo", lmCalls === 1 && flm.reason === "local");
  var QC = seedBox([{item: itemOf(RID1, false)}, {item: itemOf(RID2, true), state: "failed"}, {item: itemOf(RID3, false), uid: U2}]);
  var cleared = QC.RUN.queueClear("s1"), left = JSON.parse(QC.store.getItem("evolve_runs_outbox_v1"));
  ck("192. RUN.queueClear(studentId) apaga as corridas por enviar e as recusadas desse aluno (da conta atual) e devolve quantas; as de outra conta ficam", cleared === 2 && left.length === 1 && left[0].uid === U2 && QC.RUN.queuePending() === 0 && QC.RUN.queueClear("s1") === 0 && QC.RUN.queueClear("outro") === 0);

  // ================================================================ revisão: «Terminar no último ponto bom» (achado 15)
  function forgotState(gapS){
    var st = P.runFeedInit(), k;
    for (k = 0; k <= 300; k++) P.runFeed(st, {lat: LAT0 + 3 * k * 6 / M_LAT, lon: LON0, acc: 5, t: T0 + k * 6000});
    P.runFeed(st, {lat: LAT0 + 3 * 300 * 6 / M_LAT, lon: LON0, acc: 5, t: T0 + 300 * 6000 + gapS * 1000});
    return st;
  }
  var fg5 = forgotState(5 * 3600), fg30 = forgotState(30 * 3600), fgShort = forgotState(120);
  var offer5 = P.runLiveCutOffer(fg5, 0, T0 + 40 * 3600000), offer30 = P.runLiveCutOffer(fg30, 0, T0 + 40 * 3600000);
  ck("193. runLiveCutOffer: com uma lacuna final de 5 h oferece cortar (o que fica é a corrida de ~30 min e ~5,4 km; diz quanto se perde); com 2 min não oferece; sem pontos válidos não oferece",
    offer5 && offer5.kept.durationS >= 1790 && offer5.kept.durationS <= 1810 && offer5.kept.distM > 5000 && offer5.cutS > 17000 && offer5.cutPoints === 1 && P.runLiveCutOffer(fgShort, 0, T0 + 40 * 3600000) === null && P.runLiveCutOffer(null, 0, T0) === null && P.runLiveCutOffer(P.runFeedInit(), 0, T0) === null);
  function draftInfoOf(st, ended){ return P.runLiveDraftParse(P.runLiveDraftSerialize(P.runLiveDraftBuild(st, {uid: U1, ended: ended === true, nowMs: T0 + 300 * 6000 + 60000, iid: "x", rel: true})).text, U1); }
  var ch30 = P.runLiveDraftChoices(draftInfoOf(fg30, true), T0 + 31 * 3600000 + 5000000, "live", "z"), ch5 = P.runLiveDraftChoices(draftInfoOf(fg5, true), T0 + 6 * 3600000, "live", "z");
  ck("194. Num rascunho com uma lacuna final de 30 h (inguardável acima de 24 h) «Descartar» deixa de ser a única opção: oferece «terminar no último ponto bom»; com 5 h (guardável) oferece as duas", !ch30.save && !!ch30.cut && ch30.discard && ch5.save && !!ch5.cut && ch30.cut.kept.distM > 5000);
  ck("195. Em modo «import»/«off» (ou com outra janela a gravar) não se oferece cortar", P.runLiveDraftChoices(draftInfoOf(fg30, true), T0 + 31 * 3600000 + 5000000, "import", "z").cut === null && P.runLiveDraftChoices(draftInfoOf(fg30, true), T0 + 31 * 3600000 + 5000000, "off", "z").cut === null);
  function forgotBox(gapS){
    var b = makeBox();
    b.startRun();
    for (var k = 2; k <= 300; k++) b.emit(k * 6, 3);
    b.setNow(T0 + 300 * 6000 + gapS * 1000);
    b.gps.onFix({lat: LAT0 + 3 * 300 * 6 / M_LAT, lon: LON0, acc: 5, t: b.clock.now, speed: null});
    b.click("runLiveEnd"); b.sheet.els.runLiveEndOk.click();
    return b;
  }
  var FG = forgotBox(5 * 3600), fgHtml = FG.cur.html;
  ck("196. Esqueceu-se de terminar (lacuna final de 5 h): o resumo mostra o tempo inflado, explica o que perde e o que fica («Terminar no último ponto bom») e mantém «Rever e guardar» e «Descartar»", /id="runLiveCut"/.test(fgHtml) && /id="runLiveReview"/.test(fgHtml) && /id="runLiveDiscard"/.test(fgHtml) && /Há uma lacuna grande no fim da corrida/.test(fgHtml) && /em vez de/.test(fgHtml) && /5:\d\d:\d\d/.test(fgHtml));
  FG.click("runLiveCut");
  var fgStats = P.runStats(FG.live.st.segs, null, "live");
  ck("197. «Terminar no último ponto bom» corta a lacuna: o resumo passa a ~30 min e ~5,4 km, diz o que se tirou, deixa de oferecer o corte e o rascunho fica atualizado (terminado)", fgStats.durationS >= 1790 && fgStats.durationS <= 1810 && fgStats.distM > 5000 && FG.live.phase === "end" && /Terminaste no último ponto bom/.test(FG.cur.html) && !FG.el("runLiveCut") && draftOf(FG).ended === true && draftOf(FG).st.nPts === FG.live.st.nPts && !/5:\d\d:\d\d/.test(FG.cur.html));
  FG.click("runLiveReview");
  ck("198. Rever e guardar depois de cortar leva a corrida cortada (duração ~30 min, 1 só segmento, sem lacuna) ao ecrã de guardar", FG.saveFlows.length === 1 && FG.saveFlows[0].prep.stats.durationS >= 1790 && FG.saveFlows[0].prep.stats.durationS <= 1810 && FG.saveFlows[0].prep.stats.gaps === 0 && FG.saveFlows[0].prep.segments.length === 1);
  var FH = forgotBox(30 * 3600), fhHtml = FH.cur.html;
  ck("199. Lacuna de 30 h (acima das 24 h): o resumo diz que não se pode guardar mas já não deixa só «Descartar»: oferece «Terminar no último ponto bom» (e depois já se pode rever e guardar)", /Esta corrida não pode ser guardada/.test(fhHtml) && !/id="runLiveReview"/.test(fhHtml) && /id="runLiveCut"/.test(fhHtml) && /id="runLiveDiscard"/.test(fhHtml) && (FH.click("runLiveCut"), !!FH.el("runLiveReview")));
  var FD2 = makeBox({store: memStore({"evolve_run_draft_v1": P.runLiveDraftSerialize(P.runLiveDraftBuild(fg30, {uid: U1, ended: true, nowMs: T0 + 301 * 6000, iid: "old", rel: true})).text}), now: T0 + 40 * 3600000});
  var fdBan = bannerRoot(FD2);
  ck("200. O banner de um rascunho inguardável oferece «Terminar no último ponto bom» (e «Descartar»); não oferece «Guardar o que há»", /data-act="savecut"/.test(fdBan) && /Terminar no último ponto bom/.test(fdBan) && !/data-act="save"/.test(fdBan) && /data-act="discard"/.test(fdBan));
  FD2.bannerClick("savecut");
  ck("201. Tocar nisso pede o consentimento, corta, escreve o rascunho (agora desta janela) e segue para guardar com a corrida cortada", FD2.consents.length === 1 && FD2.saveFlows.length === 1 && FD2.saveFlows[0].prep.stats.durationS < 1900 && FD2.saveFlows[0].prep.stats.durationS >= 1790 && draftOf(FD2).iid === FD2.api.runLInst && draftOf(FD2).st.segs.length === 1);

  // ================================================================ revisão: duas janelas na mesma app (achado 18)
  var dOwner = function(o, now, own){ return P.runLiveDraftOwner(o, now, own); };
  ck("202. Quem tem o rascunho: esta janela («mine»); outra com batimento recente («busy»); outra que se despediu, com batimento antigo (> 60 s) ou de um relógio muito adiantado, ou um rascunho sem id («free»)",
    dOwner({ok: true, iid: "a", ts: T0, rel: false}, T0 + 5000, "a") === "mine" && dOwner({ok: true, iid: "a", ts: T0, rel: false}, T0 + 5000, "b") === "busy" && dOwner({ok: true, iid: "a", ts: T0, rel: true}, T0 + 5000, "b") === "free" &&
    dOwner({ok: true, iid: "a", ts: T0, rel: false}, T0 + 61000, "b") === "free" && dOwner({ok: true, iid: "a", ts: T0 + 3 * 3600000, rel: false}, T0, "b") === "free" && dOwner({ok: true, iid: "", ts: T0, rel: false}, T0, "b") === "free" && dOwner({ok: false}, T0, "b") === "free");
  var pk = P.runLiveDraftPeek(P.runLiveDraftSerialize(P.runLiveDraftBuild(st30, {uid: U1, iid: "abc", rel: true, nowMs: 12345})).text);
  ck("203. runLiveDraftPeek lê só o princípio do texto: uid, iid, rel e ts; texto sem isso dá zeros; nunca lança", pk.uid === U1 && pk.iid === "abc" && pk.rel === true && pk.ts === 12345 && P.runLiveDraftPeek(null) === null && P.runLiveDraftPeek("lixo").iid === "" && P.runLiveDraftPeek("{\"uid\":5}").uid === "");
  var shared = memStore();
  var JA = makeBox({store: shared});
  JA.startRun(); for (fi = 2; fi <= 30; fi++) JA.emit(fi);
  var jaDraft = draftOf(JA);
  ck("204. O rascunho leva o id desta janela e o batimento (ts) e começa por não estar «despedido»", jaDraft.iid === JA.api.runInst || jaDraft.iid === JA.api.runLInst && jaDraft.rel === false && jaDraft.ts >= T0 + 20000 && /^i[a-z0-9]{8,}$/.test(jaDraft.iid));
  var JB = makeBox({store: shared, now: JA.clock.now + 5000});
  var jbBan = JB.RUN.liveDraftBanner(JB.student), jbScr = JB.opens();
  ck("205. Noutra janela, com a primeira a gravar, o banner NÃO oferece Retomar, Guardar o que há nem Descartar: diz que a corrida está a ser gravada noutra janela (e deixa «Tentar outra vez»); o ecrã «Gravar com GPS» também não deixa começar outra por cima",
    /Corrida a ser gravada/.test(jbBan) && /noutra janela ou noutro aparelho/.test(jbBan) && !/Retomar|Guardar o que há|data-act="discard"|data-act="resume"|data-act="save"/.test(jbBan) && /data-act="refresh"/.test(jbBan) && !/id="runLiveGo"/.test(jbScr) && /Corrida a ser gravada/.test(jbScr));
  JB.RUN.liveWireBanner; bannerRoot(JB);
  JB.bannerClick("resume");
  ck("206. Mesmo que um toque em «Retomar» chegasse (botão escondido), nada começa: não há GPS, nem Wake Lock, nem estado", JB.gps.starts === 0 && JB.live.phase === "intro" && JB.wl.requests === 0);
  JA.pagehide();
  var jbBan2 = JB.RUN.liveDraftBanner(JB.student);
  ck("207. Quando a primeira janela se despede (pagehide: fecha ou recarrega) o rascunho fica livre e a outra já pode retomar ou guardar", draftOf(JA).rel === true && /data-act="resume"/.test(jbBan2) && /data-act="save"/.test(jbBan2) && /data-act="discard"/.test(jbBan2));
  JA.setHidden(false); (JA.winHandlers.pageshow || []).forEach(function(f){ f(); });
  ck("208. Se a página voltar da cache (pageshow), a janela volta a ser a dona (rel limpo)", draftOf(JA).rel === false);
  var shared2 = memStore();
  var KA = makeBox({store: shared2});
  KA.startRun(); for (fi = 2; fi <= 30; fi++) KA.emit(fi);
  var tA = KA.clock.now;
  var KB = makeBox({store: shared2, now: tA + 61000});
  bannerRoot(KB);
  var kbBan = KB.RUN.liveDraftBanner(KB.student);
  ck("209. Sem batimento há mais de 60 s (a primeira janela foi suspensa ou morreu sem se despedir) a outra pode retomar", /data-act="resume"/.test(kbBan) && !/Corrida a ser gravada/.test(kbBan));
  KB.bannerClick("resume");
  ck("210. Retomar noutra janela toma o rascunho (passa a ter o id dela) e arranca o GPS lá", KB.live.phase === "rec" && KB.gps.starts === 1 && draftOf(KB).iid === KB.api.runLInst && draftOf(KB).iid !== draftOf(KA).iid + "x" && KB.consents.length === 1);
  KA.setNow(tA + 62000);
  var ka0 = KA.gps.stops, kaSets = shared2.sets;
  KA.adv(11000); await mt();
  ck("211. A primeira janela, ao acordar, vê que outra pegou na corrida: pára o GPS e o Wake Lock, esquece a sua cópia, avisa, e NÃO escreve por cima do rascunho da outra", KA.live.phase === "intro" && KA.live.st === null && KA.gps.stops > ka0 && KA.wl.sentinels.every(function(w){ return w.released; }) && KA.toasts.some(function(t){ return /continua noutra janela/.test(t); }) && draftOf(KB).iid === KB.api.runLInst && draftOf(KB).iid !== undefined);
  var shared3 = memStore();
  var MA = makeBox({store: shared3});
  MA.startRun(); for (fi = 2; fi <= 30; fi++) MA.emit(fi);
  var mDraft = shared3.getItem("evolve_run_draft_v1");
  var other = JSON.parse(mDraft); other.iid = "outra-janela"; other.ts = MA.clock.now + 1000; var otherTxt = JSON.stringify(other);
  var mSets = shared3.sets;
  (MA.winHandlers.storage || []).forEach(function(f){ f({key: "evolve_run_draft_v1", newValue: otherTxt}); });
  ck("212. O evento «storage» (outra janela escreveu o rascunho com o seu id) faz esta ceder já, sem esperar pela escrita seguinte; o de outra chave, ou do mesmo id, não faz nada", MA.live.phase === "intro" && MA.live.st === null && (function(){
    var NA = makeBox({store: memStore()}); NA.startRun(); NA.emit(2);
    (NA.winHandlers.storage || []).forEach(function(f){ f({key: "outra_chave", newValue: otherTxt}); f({key: "evolve_run_draft_v1", newValue: NA.store.getItem("evolve_run_draft_v1")}); });
    return NA.live.phase === "rec";
  })());
  var shared4 = memStore();
  var OA = makeBox({store: shared4});
  OA.startRun(); for (fi = 2; fi <= 30; fi++) OA.emit(fi);
  var OB = makeBox({store: shared4, now: OA.clock.now + 2000});
  OB.opens();
  var obHadBusy = /Corrida a ser gravada/.test(OB.cur.html);
  OA.click("runLiveEnd"); OA.sheet.els.runLiveEndOk.click(); OA.click("runLiveDiscard");
  (OB.winHandlers.storage || []).forEach(function(f){ f({key: "evolve_run_draft_v1", newValue: null}); });
  ck("213. O evento «storage» põe o banner em dia: depois de a outra janela descartar a corrida, o aviso desaparece aqui", obHadBusy && shared4.getItem("evolve_run_draft_v1") === null && (function(){ var s2 = OB.RUN.liveDraftBanner(OB.student); return s2 === ""; })());
  var EA = makeBox();
  EA.startRun(); EA.emit(2); EA.click("runLiveEnd"); EA.sheet.els.runLiveEndOk.click();
  var eaTs = draftOf(EA).ts;
  EA.adv(25000);
  ck("214. Com a corrida já terminada, à espera de guardar, o batimento continua (o rascunho é reescrito a cada ~10 s) para nenhuma outra janela lhe mexer; ao descartar pára", draftOf(EA).ts >= eaTs + 20000 && (function(){ EA.click("runLiveDiscard"); return EA.timers.list.length === 0; })());

  // ================================================================ revisão: o modo deixa de ser «live» a meio (achado 42)
  var ML = makeBox();
  ML.startRun(); for (fi = 2; fi <= 12; fi++) ML.emit(fi);
  ck("215. RUN.liveBusy(): falso no início; verdadeiro a preparar, a gravar e em pausa; falso no resumo e depois de RUN.reset",
    (function(){ var Z = makeBox(); var r = [Z.RUN.liveBusy()]; Z.opens(); Z.click("runLiveGo"); r.push(Z.RUN.liveBusy()); Z.click("runLivePrepare"); r.push(Z.RUN.liveBusy()); Z.emit(0); Z.click("runLiveStart"); Z.emit(1); r.push(Z.RUN.liveBusy());
      Z.click("runLivePause"); r.push(Z.RUN.liveBusy()); Z.click("runLivePause"); Z.click("runLiveEnd"); Z.sheet.els.runLiveEndOk.click(); r.push(Z.RUN.liveBusy()); Z.RUN.reset(); r.push(Z.RUN.liveBusy());
      return r.join() === "false,false,true,true,true,false,false"; })() && ML.RUN.liveBusy() === true);
  ML.student.runsMode = "import";
  var mlStops = ML.gps.stops;
  ML.adv(1500); await mt();
  var mlHtml = ML.cur ? ML.cur.html : "";
  ck("216. Se o profissional desliga a gravação com GPS a meio, a gravação não fica órfã: o GPS, o Wake Lock e o relógio param, passa ao resumo (rascunho terminado), avisa, e RUN.liveBusy() é falso",
    ML.live.phase === "end" && ML.gps.stops === mlStops + 1 && ML.live.tickId === null && ML.wl.sentinels.every(function(w){ return w.released; }) && ML.RUN.liveBusy() === false && draftOf(ML).ended === true && ML.toasts.some(function(t){ return /desligada pelo teu profissional: a gravação parou/.test(t); }));
  ck("217. O resumo nesse caso explica (guardada só neste telemóvel; só se guarda se o profissional voltar a ligar) e oferece «Descartar»; NÃO oferece «Rever e guardar» (o servidor recusa uma corrida «live» sem a gravação ligada)", /desligada pelo teu profissional: a gravação parou aqui/.test(mlHtml) && /id="runLiveDiscard"/.test(mlHtml) && !/id="runLiveReview"/.test(mlHtml) && /Resumo/.test(mlHtml));
  var mlBan = ML.RUN.liveDraftBanner(ML.student);
  ML.student.runsMode = "live";
  ck("218. O banner em modo «import» só oferece «Descartar» (e explica); se o modo volta a «live» o resumo volta a oferecer «Rever e guardar»", /Corrida por guardar/.test(mlBan) && !/data-act="review"/.test(mlBan) && /data-act="discard"/.test(mlBan) && (ML.render(), !!ML.el("runLiveReview")));
  var MP = makeBox();
  MP.opens(); MP.click("runLiveGo"); MP.click("runLivePrepare");
  MP.student.runsMode = "off";
  MP.adv(1500); await mt();
  ck("219. O mesmo a preparar o GPS: pára tudo e esquece o estado", MP.live.phase === "intro" && !MP.live.gpsOn && MP.gps.stops >= 1 && MP.wl.sentinels.every(function(w){ return w.released; }) && MP.RUN.liveBusy() === false);
  var MR = makeBox();
  MR.startRun(); for (fi = 2; fi <= 12; fi++) MR.emit(fi);
  MR.student.runsMode = "off";
  var mrStops = MR.gps.stops, mrHtml = MR.RUN.liveScreen(MR.sv());
  ck("220. Também ao desenhar o ecrã (RUN.liveScreen) com o modo desligado: pára tudo em vez de mostrar «não está ligada» com o GPS a correr", MR.live.phase === "end" && MR.gps.stops === mrStops + 1 && /Resumo/.test(mrHtml) && /desligada pelo teu profissional/.test(mrHtml));
  var MX = makeBox({role: "professional"});
  ck("221. A pré-visualização do profissional nunca pára nada nem avisa", (MX.RUN.liveScreen(MX.student), MX.toasts.length === 0));

  // ================================================================ revisão: Wake Lock libertado com a página visível (achado 43)
  var WK = makeBox();
  WK.startRun(); await mt();
  var wkReq = WK.wl.requests;
  WK.wl.sentinels[0].release();
  await mt();
  ck("222. O sistema libertou o Wake Lock com a página visível: pede-se de novo logo e o ecrã não fica sem aviso (nenhum aviso enquanto o novo estiver ativo)", WK.wl.requests === wkReq + 1 && WK.live.wl === "on" && !/Não consegui manter o ecrã ligado/.test(WK.el("runLiveNotes").innerHTML || "") && WK.wl.sentinels.length === 2);
  WK.setHidden(true);
  WK.wl.sentinels[1].release();
  await mt();
  var wkHidden = WK.wl.requests;
  WK.setHidden(false); await mt();
  ck("223. Libertado com a página oculta (o normal): não se pede nada oculta; ao voltar pede-se uma vez", wkHidden === wkReq + 1 && WK.wl.requests === wkReq + 2 && WK.live.wl === "on");
  var WD = makeBox();
  WD.startRun(); await mt();
  WD.wl.deny = true;
  WD.wl.sentinels[0].release();
  await mt(); WD.adv(1000);
  ck("224. Se o novo pedido falha, aparece o mesmo aviso («Não consegui manter o ecrã ligado») e a gravação continua", WD.live.wl === "denied" && /Não consegui manter o ecrã ligado/.test(WD.el("runLiveNotes").innerHTML) && WD.live.phase === "rec");
  var WL = makeBox();
  WL.startRun(); await mt();
  for (var wi = 0; wi < 5; wi++) { WL.wl.sentinels[WL.wl.sentinels.length - 1].release(); await mt(); }
  WL.adv(1000);
  ck("225. Se o sistema o tira sempre, não há ciclo de pedidos: no máximo 3 por minuto e fica o aviso", WL.wl.requests === 1 + 3 && WL.live.wl === "off" && /Não consegui manter o ecrã ligado/.test(WL.el("runLiveNotes").innerHTML));

  // ================================================================ revisão: Retomar e Guardar o que há pedem o consentimento (achado 44)
  function reopenDraft(o){ return makeBox(Object.assign({store: memStore({"evolve_run_draft_v1": savedDraft}), now: T0 + 60000}, o || {})); }
  var CN = reopenDraft({consentAuto: false});
  bannerRoot(CN);
  CN.bannerClick("resume");
  var cnHeld = CN.live.phase === "intro" && CN.gps.starts === 0 && CN.wl.requests === 0;
  CN.consentCb();
  ck("226. «Retomar» passa por RUN.ensureConsent: até o servidor confirmar o consentimento o GPS não arranca; confirmado, retoma", cnHeld && CN.consents.length === 1 && CN.live.phase === "rec" && CN.gps.starts === 1);
  var CS = reopenDraft({consentAuto: false});
  bannerRoot(CS);
  CS.bannerClick("save");
  var csHeld = CS.live.phase === "intro" && CS.saveFlows.length === 0;
  CS.consentCb();
  ck("227. «Guardar o que há» também: sem consentimento confirmado não segue para guardar", csHeld && CS.consents.length === 1 && CS.saveFlows.length === 1 && CS.live.phase === "end");
  var CX = reopenDraft();
  CX.RUN.ensureConsent = undefined;
  bannerRoot(CX);
  CX.bannerClick("resume");
  ck("228. Sem RUN.ensureConsent (corrida.js por carregar) não se retoma nada e o aluno é avisado", CX.live.phase === "intro" && CX.gps.starts === 0 && CX.toasts.some(function(t){ return /Não foi possível abrir a Corrida/.test(t); }));

  // ================================================================ revisão: texto do erro do GPS (achado 45)
  var GE = makeBox();
  GE.store.failSet = true;
  GE.startRun(); for (fi = 2; fi <= 8; fi++) GE.emit(fi);
  GE.gps.onErr({code: 1});
  var geTxt = textOf(GE.cur.html);
  var GO = makeBox();
  GO.startRun(); for (fi = 2; fi <= 8; fi++) GO.emit(fi);
  GO.gps.onErr({code: 1});
  var goTxt = textOf(GO.cur.html);
  ck("229. Com o rascunho a falhar, o erro do GPS NÃO diz que o que se gravou está guardado: diz «Não feches a app»; com o rascunho escrito diz que está guardado", GE.live.draftOk === false && !/O que já foi gravado está guardado/.test(geTxt) && /Não feches a app: o que já foi gravado ainda não está guardado/.test(geTxt) && GO.live.draftOk === true && /O que já foi gravado está guardado neste telemóvel/.test(goTxt));

  // ================================================================ revisão: reiniciar o GPS, preparar, pausa longa (achados 47, 48 e 50)
  var RS = makeBox();
  RS.startRun(); for (fi = 2; fi <= 10; fi++) RS.emit(fi);
  RS.adv(70000);
  var rsStarts = RS.gps.starts, rsAuto = RS.live.restarts;
  RS.adv(60000);
  ck("230. O vigia gasta os 3 reinícios automáticos e pára; «Reiniciar GPS» aparece quando não chegam posições", rsAuto === 3 && RS.gps.starts === rsStarts && RS.el("runLiveRestartWrap").hiddenClass === false);
  RS.click("runLiveRestart");
  ck("231. «Reiniciar GPS» reinicia o watch mesmo com os reinícios automáticos esgotados (conta nos reinícios do resumo, não no limite do vigia)", RS.gps.starts === rsStarts + 1 && RS.live.restarts === 4 && RS.live.restartLog.length === 3 && RS.live.watching);
  var RP = makeBox();
  RP.startRun(); for (fi = 2; fi <= 6; fi++) RP.emit(fi);
  RP.click("runLivePause");
  var rpStarts = RP.gps.starts;
  RP.emit(7); RP.click("runLivePause");
  var freshKept = RP.gps.starts === rpStarts;
  RP.click("runLivePause");
  RP.adv(30000);
  var rpStarts2 = RP.gps.starts;
  RP.click("runLivePause");
  ck("232. Retomar não reinicia o GPS se ainda chegam posições (a pausa não as pára); se o watch ficou mudo (> 8 s sem posições) reinicia-o, em vez de o deixar morto", freshKept && RP.gps.starts === rpStarts2 + 1 && RP.live.watching && RP.live.phase === "rec");
  var PP = makeBox();
  PP.opens(); PP.click("runLiveGo"); PP.click("runLivePrepare"); await mt();
  PP.emit(0); PP.adv(RP.api.RUN_LIVE_CFG.prepMaxMs - 20000);
  var ppStillOn = PP.live.phase === "prep" && PP.live.gpsOn;
  PP.adv(25000);
  ck("233. Preparar o GPS e não começar: ao fim de 5 min cancela-se sozinho (GPS, Wake Lock e relógio parados) e avisa (poupa bateria)", ppStillOn && PP.live.phase === "intro" && !PP.live.gpsOn && PP.gps.stops >= 1 && PP.wl.sentinels.every(function(w){ return w.released; }) && PP.timers.list.length === 0 && PP.toasts.some(function(t){ return /Cancelei a preparação do GPS/.test(t); }));
  var LP = makeBox();
  LP.startRun(); for (fi = 2; fi <= 8; fi++) LP.emit(fi);
  await mt();
  LP.click("runLivePause");
  var lpStops = LP.gps.stops;
  LP.adv(LP.api.RUN_LIVE_CFG.pauseReleaseMs + 1000);
  ck("234. Pausa longa (10 min): liberta o GPS e o Wake Lock (a pausa esquecida não esgota a bateria) e diz-no", LP.gps.stops === lpStops + 1 && !LP.live.watching && LP.wl.sentinels.every(function(w){ return w.released; }) && /Pausa longa/.test(LP.live.notice));
  var lpReq = LP.wl.requests, lpStarts = LP.gps.starts;
  LP.click("runLivePause");
  await mt();
  ck("235. Ao retomar volta a pedir o GPS e o Wake Lock, e o aviso de sinal não diz «Sem posições há 661 s» (conta a partir de agora)", LP.gps.starts === lpStarts + 1 && LP.wl.requests === lpReq + 1 && LP.live.wl === "on" && !/há \d{3,} s/.test(LP.el("runLiveSignal").textContent) && /A procurar sinal/.test(LP.el("runLiveSignal").textContent));
  var IN = makeBox();
  IN.opens(); IN.click("runLiveGo"); IN.click("runLivePrepare");
  IN.emit(0, 3, 6);
  var inOk = IN.el("runLiveStart").disabled === false;
  IN.adv(9000);
  var inDisabled = IN.el("runLiveStart").disabled === true;
  IN.click("runLiveStart");
  ck("236. «Iniciar» só vale com sinal bom E recente: com o último fix bom há mais de 8 s fica desligado (e um toque nele não faz nada)", inOk && inDisabled && IN.live.phase === "prep" && /Sem posições há/.test(IN.el("runLiveSignal").textContent));

  // a despedida (pagehide) não se desfaz com o «oculta» que o navegador dispara logo a seguir; ao voltar a ver a página, sim
  var PH = makeBox();
  PH.startRun(); for (fi = 2; fi <= 12; fi++) PH.emit(fi);
  PH.pagehide(); PH.setHidden(true);
  var phRel = draftOf(PH).rel;
  PH.setHidden(false);
  ck("237. A despedida do rascunho (rel) mantém-se com o «oculta» que vem a seguir ao pagehide e só se desfaz quando a página volta a ser vista", phRel === true && draftOf(PH).rel === false && PH.live.phase === "rec");
  // vista de dados (Corrida desligada, RUN.dataMode): o banner funciona sem Retomar nem Guardar
  var DM = makeBox({mode: "off", store: memStore({"evolve_run_draft_v1": savedDraft}), now: T0 + 60000});
  var dmBan = DM.RUN.liveDraftBanner(DM.student);
  var DM2 = makeBox({mode: "off"});
  DM2.student.runsMode = "live"; DM2.startRun(); for (fi = 2; fi <= 10; fi++) DM2.emit(fi);
  DM2.student.runsMode = "off"; DM2.adv(1500); await mt();
  var dm2Ban = DM2.RUN.liveDraftBanner(DM2.student);
  ck("238. Com a Corrida desligada (vista de dados) o banner de um rascunho só oferece «Descartar» (e explica); o de uma corrida terminada em memória também, sem «Rever e guardar»; nada se apaga sozinho", /id="runLiveBanner"/.test(dmBan) && !/data-act="resume"|data-act="save"|data-act="savecut"/.test(dmBan) && /data-act="discard"/.test(dmBan) && /não está ligada/.test(dmBan) && DM.store.getItem("evolve_run_draft_v1") === savedDraft &&
    /Corrida por guardar/.test(dm2Ban) && !/data-act="review"/.test(dm2Ban) && /data-act="discard"/.test(dm2Ban) && /não está ligada/.test(dm2Ban) && DM2.store.getItem("evolve_run_draft_v1") !== null);

  // ================================================================ contrato novo e documentação
  ck("239. O contrato novo está em RUN: liveBusy, queueClear, consentCacheGet, consentCacheSet, consentCacheClear (e RUN_CONSENT_KEY vem de app.js: não se redeclara)", ["liveBusy", "queueClear", "consentCacheGet", "consentCacheSet", "consentCacheClear"].every(function(k){ return typeof makeBox().RUN[k] === "function"; }) && !/(var|function)\s+RUN_CONSENT_KEY/.test(noComments));

  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", String(e && e.stack || e).split("\n").slice(0, 5).join(" | ")); process.exit(1); });
