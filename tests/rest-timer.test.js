// Cronómetro de descanso do treino.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

var alerts = 0;
var realAlert = restTimerAlert;
restTimerAlert = function(){ alerts++; };

check.check("1. fmtClock: 90 → 1:30, 5 → 0:05, 3599 → 59:59, negativo → 0:00", fmtClock(90) === "1:30" && fmtClock(5) === "0:05" && fmtClock(3599) === "59:59" && fmtClock(-4) === "0:00");

var t0 = 1000000;
var t = restTimerStart(90, "Supino", t0);
check.check("2. Start: 90 s, termina daqui a 90 000 ms, com o nome do exercício", t.total === 90 && restTimerLeftMs(t, t0) === 90000 && t.label === "Supino" && t.pausedLeft === null);
check.check("2. Passados 30 s faltam 60 s", restTimerLeftMs(restTimer, t0 + 30000) === 60000);
restTimerStop();
check.check("2. Stop limpa o cronómetro", restTimer === null);

restTimerStart(2, "x", t0);
check.check("3. Mínimo de 5 s (e máximo de 3600 s)", restTimer.total === 5);
restTimerStart(99999, "x", t0);
check.check("3. Máximo de 3600 s", restTimer.total === 3600);
restTimerStart(NaN, "", t0);
check.check("3. Valor inválido usa 90 s e o rótulo 'Descanso'", restTimer.total === 90 && restTimer.label === "Descanso");

restTimerStart(60, "A", t0);
restTimerAdjust(15, t0 + 10000);
check.check("4. +15 s soma ao tempo que falta (50 + 15 = 65 s)", restTimerLeftMs(restTimer, t0 + 10000) === 65000);
restTimerAdjust(-30, t0 + 10000);
check.check("4. −30 s (65 − 30 = 35 s)", restTimerLeftMs(restTimer, t0 + 10000) === 35000);

restTimerStart(60, "A", t0);
restTimerTogglePause(t0 + 20000);
check.check("5. Pausa guarda o tempo que faltava (40 s) e deixa de contar", restTimer.pausedLeft === 40000 && restTimerLeftMs(restTimer, t0 + 999999) === 40000);
restTimerTogglePause(t0 + 100000);
check.check("5. Continuar retoma com os 40 s a partir de agora", restTimer.pausedLeft === null && restTimerLeftMs(restTimer, t0 + 100000) === 40000);
restTimerStart(60, "A", t0);
restTimerTogglePause(t0 + 10000);
restTimerAdjust(15, t0 + 10000);
check.check("5. Ajustar em pausa mexe no tempo pausado (50 + 15 = 65 s)", restTimer.pausedLeft === 65000);

restTimerStart(30, "A", t0);
restTimerTick(t0 + 29000);
check.check("6. Antes do fim não avisa", alerts === 0 && !restTimer.notified);
restTimerTick(t0 + 30500);
restTimerTick(t0 + 31000);
restTimerTick(t0 + 40000);
check.check("6. A zero avisa UMA só vez (som + vibração), e continua a contar o tempo a mais", alerts === 1 && restTimer.notified && restTimerLeftMs(restTimer, t0 + 40000) === -10000);
var html = restTimerHtml(t0 + 40000);
check.check("6. Depois de zero mostra '+0:10' e 'Descanso terminado'", /\+0:10/.test(html) && /Descanso terminado/.test(html) && /rt-time over/.test(html));
restTimerAdjust(30, t0 + 40000);
restTimerTick(t0 + 70500);
check.check("6. Se somares tempo depois do fim, volta a avisar no novo fim", alerts === 2);
restTimerRestart(t0 + 80000);
check.check("6. Reiniciar repõe o tempo total (e volta a poder avisar)", restTimerLeftMs(restTimer, t0 + 80000) === restTimer.total * 1000 && restTimer.notified === false);

var h = restTimerHtml(t0 + 80000);
check.check("7. O painel tem fechar, −15, pausa, +15, reiniciar e a barra", ["close", "-15", "pause", "+15", "restart"].every(function(a){ return h.indexOf('data-rt="' + a + '"') >= 0; }) && /rt-bar/.test(h));
check.check("7. O nome do exercício é escapado", restTimerHtml(t0).indexOf("<b>") === -1 && (restTimerStart(60, "<b>x</b>", t0), restTimerHtml(t0).indexOf("<b>x</b>") === -1));
check.check("7. Em pausa o painel diz 'em pausa' e o botão passa a 'Continuar'", (restTimerTogglePause(t0), /em pausa/.test(restTimerHtml(t0)) && />Continuar</.test(restTimerHtml(t0))));
restTimerStop();

// ---- 8. Integração no registo de treino ----
var s = {trainingProgram:{name:"P", days:[{id:"d1", name:"A", exercises:[{id:"e1", name:"Supino", sets:2, reps:"8", rest:120}, {id:"e2", name:"Remada", sets:1, reps:"8"}]}]}, workoutLogs:[]};
var logger = tplWorkoutLogger(s);
check.check("8. O registo tem atalhos de 30 s a 3 min", [30, 45, 60, 90, 120, 180].every(function(sec){ return logger.indexOf('data-rest-start="' + sec + '"') >= 0; }));
check.check("8. Cada série tem o botão ⏱ com o descanso prescrito (120 s) e 90 s por omissão", (logger.match(/data-rest-start="120" data-rest-label="Supino"/g) || []).length === 2 && /data-rest-start="90" data-rest-label="Remada"/.test(logger));
check.check("8. O cronómetro está ligado aos botões e existe um painel #restTimer", /\[data-rest-start\]/.test(appSource) && fsHas("id=\"restTimer\""));
check.check("8. É parado ao terminar sessão e escondido fora do modo aluno", /restTimerStop\(\);\s*\n\s*wlDraftWipe\(\);\s*\n\s*sb\.auth\.signOut/.test(appSource) && /state\.mode === "aluno" && !\(app && app\.classList\.contains\("hidden"\)\)/.test(appSource));
function fsHas(x){ return require("fs").readFileSync(require("path").join(__dirname, "..", "index.html"), "utf8").indexOf(x) >= 0; }
check.check("8. Respeita 'reduzir animação' e tem alvos de toque ≥ 44 px", fsHas("prefers-reduced-motion:reduce){ #restTimer.done{animation:none;}") && /\.rt-presets button, \.wl-rest\{min-height:44px; min-width:44px/.test(require("fs").readFileSync(require("path").join(__dirname, "..", "index.html"), "utf8")));

restTimerAlert = realAlert;
restTimerStop();
check.summarize();
