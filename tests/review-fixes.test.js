// Correções da revisão adversarial: cada defeito confirmado tem aqui o seu teste.
require("./setup")();
var fs = require("fs");
var path = require("path");
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
function daysAgo(n){ return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10); }

// ---- 1. Cronómetro: desenha uma vez e atualiza no sítio (sem perder o foco nem cliques) ----
(function(){
  var writes = 0, timeText = "", barWidth = "", cls = {};
  var timeEl = {set textContent(v){ timeText = v; }, get textContent(){ return timeText; }, className: ""};
  var bar = {style: {}};
  var el = {_rtKey: null, set innerHTML(v){ writes++; this._h = v; }, get innerHTML(){ return this._h; },
    classList: {toggle: function(k, on){ cls[k] = on; }, add: function(){}, remove: function(){}, contains: function(){ return false; }},
    querySelector: function(sel){ return sel === ".rt-time" ? timeEl : (sel === ".rt-bar i" ? bar : null); }};
  var realGet = document.getElementById;
  document.getElementById = function(id){ return id === "restTimer" ? el : realGet(id); };
  state.mode = "aluno";
  var t0 = 5000000;
  restTimerStart(60, "Supino", t0);
  var afterStart = writes;
  restTimerTick(t0 + 250); restTimerTick(t0 + 500); restTimerTick(t0 + 1000);
  check.check("1. Início: o painel é desenhado de raiz", afterStart >= 1 && /data-rt="pause"/.test(el.innerHTML));
  check.check("1. Nos ticks seguintes NÃO se reescreve o HTML (os botões mantêm o foco)", writes === afterStart);
  check.check("1. Nos ticks atualiza o número e a barra no sítio (0:59 → 0:59/0:58)", /^0:5[89]$/.test(timeText) && /%$/.test(bar.style.width));
  restTimerTogglePause(t0 + 2000);
  check.check("1. Mudar de estado (pausa) redesenha a estrutura uma vez", writes === afterStart + 1 && /Continuar/.test(el.innerHTML));
  restTimerTogglePause(t0 + 3000);
  var w = writes;
  restTimerTick(t0 + 61000); restTimerTick(t0 + 62000);
  check.check("1. A zero redesenha uma vez ('terminado') e mostra o tempo a mais com +", writes === w + 1 && /\+0:01/.test(el.innerHTML));
  var w2 = writes;
  restTimerTick(t0 + 64000);
  check.check("1. Em atraso continua sem reescrever o HTML", writes === w2);
  restTimerTick(t0 + 60000 + 11 * 60 * 1000);
  check.check("1. Esquecido há mais de 10 minutos, fecha sozinho", restTimer === null);
  document.getElementById = realGet;
  restTimerStop();
})();

// ---- 2. Registo: só séries marcadas; rascunho sobrevive a re-desenhar ----
(function(){
  var store = {};
  global.window.localStorage = {getItem: function(k){ return store[k] || null; }, setItem: function(k, v){ store[k] = v; }};
  state.wlDraft = null;
  var s = {id:"aluno1", trainingsPerWeek:3, workoutLogs:[], trainingProgram:{name:"P", days:[{id:"d1", name:"A", exercises:[{id:"e1", name:"Supino", sets:2, reps:"8", rest:60}]}]}};
  var h = tplWorkoutLogger(s);
  check.check("2. Cada série tem uma caixa ✓ (desmarcada por omissão) — só as marcadas contam", (h.match(/data-wl-done=/g) || []).length === 2 && !/data-wl-done="[^"]*"[^>]* checked/.test(h));
  check.check("2. Os campos de série têm nome acessível", /aria-label="Repetições da série 1"/.test(h) && /aria-label="Carga em kg da série 1"/.test(h) && /aria-label="Série 1 feita"/.test(h));
  check.check("2. O ⏱ de cada série marca-a como feita", /el\.querySelector\('\[data-wl-done="' \+ setKey \+ '"\]'\)/.test(appSource) && /box\.checked = true/.test(appSource));
  check.check("2. O envio só lê séries com ✓ e dá erro claro se nenhuma", /if \(!box \|\| !box\.checked\) continue/.test(appSource) && /Marca ✓ pelo menos uma série feita/.test(appSource));
  var d = wlDraftGet(s, "d1");
  d.sets["e1:0"] = {done:true, reps:"10", load:"62.5"}; d.rpe = 9; d.notes = "ombro a doer";
  wlDraftSave();
  var h2 = tplWorkoutLogger(s);
  check.check("2. Ao re-desenhar (mudar de separador) a série marcada, as repetições, a carga, o RPE e as notas mantêm-se", /data-wl-done="e1:0"[^>]* checked/.test(h2) && /data-wl-reps="e1:0"[^>]*value="10"/.test(h2) && /data-wl-load="e1:0"[^>]*value="62.5"/.test(h2) && /id="wlRpeVal">9</.test(h2) && /ombro a doer/.test(h2));
  state.wlDraft = null;
  check.check("2. E sobrevive a recarregar a página (localStorage)", wlDraftGet(s, "d1").sets["e1:0"].reps === "10");
  wlDraftClear(s, "d1"); state.wlDraft = null;
  check.check("2. Depois de guardar o treino o rascunho é apagado", !wlDraftGet(s, "d1").sets["e1:0"]);
  check.check("2. Os listeners ficam nos campos (não acumulam no contentor reutilizado)", /querySelectorAll\("\[data-wl-reps\], \[data-wl-load\], \[data-wl-done\], #wlRpe, #wlNotes"\)/.test(appSource));
})();

// ---- 3. Peso do corpo: progressão por repetições ----
(function(){
  var logs = [10, 11, 12, 13].map(function(r, i){ return {date:daysAgo(30 - i * 7), entries:[{exerciseId:"e1", name:"Flexões", sets:[{reps:r, load:0}]}]}; });
  var s = {workoutLogs: logs};
  var hist = exerciseHistory(s, "e1", "Flexões");
  check.check("3. Sem carga, a métrica são as repetições máximas (10,11,12,13)", hist.map(function(h){ return h.score; }).join() === "10,11,12,13");
  check.check("3. 10→13 repetições = progrediu (antes: 'estagnado' para sempre)", progressionStatus(hist) === "progrediu");
  var flat = [10, 10, 10, 10].map(function(r, i){ return {date:daysAgo(30 - i * 7), entries:[{exerciseId:"e1", name:"Flexões", sets:[{reps:r, load:0}]}]}; });
  check.check("3. Sempre 10 repetições durante 4 sessões = estagnado (de verdade)", progressionStatus(exerciseHistory({workoutLogs: flat}, "e1", "Flexões")) === "estagnado");
  check.check("3. Com carga continua o 1RM estimado", workoutEntryStats({sets:[{reps:5, load:100}]}).score === 116.7);
  check.check("3. A tabela do profissional mostra repetições quando não há carga", /last\.topReps \+ " reps"/.test(appSource));
})();

// ---- 4. Visita só com perímetros ----
(function(){
  var s = {sex:"Feminino", height:165, weightCurrent:60, weights:[{date:daysAgo(2), w:60}], assessments:[
    {date:daysAgo(30), weight:60, bodyFat:30, muscle:45, visceral:5, water:50},
    {date:daysAgo(1), weight:0, bodyFat:0, muscle:0, visceral:0, water:0, waist:80, hip:98}
  ]};
  var k = tplAssessKpis(s);
  check.check("4. Os indicadores ignoram a visita sem composição (continuam 30 % e 45 kg, sem 'queda' falsa)", /30\.0/.test(k) && /45\.0/.test(k) && !/(^|[^\d.])0\.0<small>%/.test(k) && !/▼ 30\.0/.test(k));
  check.check("4. Uma visita só com perímetros não conta como pesagem", signalPesagem(Object.assign({}, s, {weights:[]})).text.indexOf("há 30 dias") >= 0);
  check.check("4. O botão Adicionar não inventa o peso quando só há perímetros", /weight: hasComposition \? \(weight\|\|s\.weightCurrent\) : 0/.test(appSource));
  check.check("4. Sem nenhuma composição medida não há indicadores", tplAssessKpis({assessments:[{date:daysAgo(1), weight:0, bodyFat:0, waist:80}]}) === "");
})();

// ---- 5. Ganho de peso: gerador e avisos coerentes ----
(function(){
  [{sex:"Masculino", weight:70, height:175, age:25, trainingsPerWeek:3, weightGoal:75}, {sex:"Feminino", weight:55, height:165, age:30, trainingsPerWeek:3, weightGoal:60}, {sex:"Feminino", weight:60, height:165, age:30, trainingsPerWeek:3, weightGoal:65}].forEach(function(p, i){
    var t = computeSuggestedTargets(p);
    var s = {sex:p.sex, weightCurrent:p.weight, height:p.height, age:p.age, trainingsPerWeek:p.trainingsPerWeek};
    var warns = nutritionSafetyWarnings(s, t).filter(function(w){ return /Excedente|Proteína/.test(w.text); });
    check.check("5. Alvo de ganho gerado pela app " + (i + 1) + " não dispara os próprios avisos de excedente/proteína (" + t.kcal + " kcal)", warns.length === 0);
  });
  var gain = computeSuggestedTargets({sex:"Masculino", weight:70, height:175, age:25, trainingsPerWeek:3, weightGoal:75});
  var maint = Math.round(computeBMR("Masculino", 70, 175, 25) * activityFromTrainings(3));
  check.check("5. O excedente nunca passa de +15 % da manutenção", gain.kcal <= maint * 1.151);
  var sig = signalWeight({goal:"Aumento de massa muscular", weightCurrent:61.5, weights:[{date:daysAgo(21), w:60}, {date:daysAgo(0), w:60.8}]});
  check.check("5. Ganhar o que a app prescreve (≈0,25 kg/semana) não dá 'ganho rápido'", sig.status === "positivo");
})();

// ---- 6. Proteína por kg de peso (não de massa magra) ----
(function(){
  var s = {sex:"Masculino", weightCurrent:70, height:175, age:30, trainingsPerWeek:4, leanMass:59.5};
  var w = nutritionSafetyWarnings(s, {kcal:2300, protein:160, carbs:230, fat:70});
  check.check("6. 160 g para 70 kg (2,3 g/kg) não é 'proteína a mais', mesmo havendo massa magra conhecida", !w.some(function(x){ return /Proteína/.test(x.text); }));
  var low = nutritionSafetyWarnings(s, {kcal:2300, protein:75, carbs:230, fat:70});
  check.check("6. 75 g (1,07 g/kg) avisa sempre de proteína baixa", low.some(function(x){ return /abaixo de 1,2 g\/kg/.test(x.text); }));
})();

// ---- 7. Tendência do peso: escala com o intervalo real ----
(function(){
  check.check("7. Duas pesagens com 7 dias: 'cedo para avaliar' (não alerta por água)", signalWeight({goal:"Perda de peso", weightCurrent:81.2, weights:[{date:daysAgo(7), w:80}, {date:daysAgo(0), w:81.2}]}).status === "insuficiente");
  check.check("7. 2 dias de intervalo também", signalWeight({goal:"Perda de peso", weightCurrent:80, weights:[{date:daysAgo(2), w:80.1}, {date:daysAgo(0), w:80}]}).status === "insuficiente");
  var sig = signalWeight({goal:"Perda de peso", weightCurrent:79, weights:[{date:daysAgo(14), w:80}, {date:daysAgo(0), w:79}]});
  check.check("7. 14 dias, −1 kg, em perda → positivo, e o texto diz 2 semanas", sig.status === "positivo" && /últimas 2 semanas/.test(sig.text));
  check.check("7. 14 dias e +0,6 kg em perda → atenção (limiar 0,2 kg para 2 semanas)", signalWeight({goal:"Perda de peso", weightCurrent:80.6, weights:[{date:daysAgo(14), w:80}, {date:daysAgo(0), w:80.6}]}).status === "atencao");
})();

// ---- 8. Dados forjados/mal formados ----
(function(){
  var evil = '<img src=x onerror=alert(1)>';
  var row = {id:"x", name:"T", meals:[], weights:[], assessments:[], photos:[],
    workout_logs:[
      {id:"w9", date:"0000-00-" + evil, rpe:evil, entries:[]},                       // data inválida: descartada
      {id:"w8", date:"2026-10-01", rpe:evil, dayName:evil, notes:evil, entries:"não é array"},
      {id:"w7", date:"2026-10-02", rpe:99, entries:[{name:evil, sets:[{reps:evil, load:1}, {reps:8, load:"abc"}, null, 5]}, null, 7]},
      null, 42, "x"
    ],
    checkins:[{date:"2026-10-01", weight:evil, hunger:evil, energy:7, adherence:evil, workouts:2, notes:evil, sleepHours:evil, stress:4}, {date:evil}, null]};
  var s = rowToStudent(row);
  check.check("8. workout_logs: descarta o que não é objeto ou não tem data válida (6 → 2)", s.workoutLogs.length === 2);
  check.check("8. RPE forjado vira null / fora de 1-10 vira null; entries inválido vira []", s.workoutLogs[0].rpe === null && s.workoutLogs[0].entries.length === 0 && s.workoutLogs[1].rpe === null);
  check.check("8. Séries inválidas descartadas (só fica reps 8 com carga 0)", s.workoutLogs[1].entries.length === 1 && s.workoutLogs[1].entries[0].sets.length === 1 && s.workoutLogs[1].entries[0].sets[0].load === 0);
  check.check("8. checkins: números forjados viram 0/ausentes e datas inválidas são descartadas", s.checkins.length === 1 && s.checkins[0].weight === 0 && s.checkins[0].adherence === 0 && s.checkins[0].sleepHours === undefined && s.checkins[0].stress === 4);
  var html = tplProTreino(s) + tplProCheckins(s) + tplAdherenceChart(s) + tplProLeitura(s);
  check.check("8. Nada de <img onerror> nos ecrãs do profissional com dados forjados", html.indexOf("<img src=x") === -1);
  check.check("8. Os indicadores não rebentam com dados forjados", computeStudentSignals(s).length === 13);
  check.check("8. fmtDateFullPt tolera lixo", fmtDateFullPt(20261001) === "—" && fmtDateFullPt(evil) === "—" && fmtDateFullPt("2026-10-01") === "01/10/2026");
  var boom = safeSignal(function(){ throw new Error("x"); }, {});
  check.check("8. Um indicador que rebente não deita abaixo os outros (devolve 'indicador indisponível')", boom.status === "insuficiente" && /indisponível/.test(boom.title));
})();

// ---- 9. Cada papel escreve só as suas colunas ----
(function(){
  var s = {id:"x", name:"T", trainingProgram:{name:"P", days:[]}, workoutLogs:[{id:"w", date:"2026-10-01", entries:[]}], meals:[], checkins:[], weights:[], assessments:[], photos:[], weightLogPhotos:[], targets:{}};
  authRole = "professional";
  var pro = studentToRow(s);
  authRole = "student";
  var al = studentToRow(s);
  authRole = null;
  var local = studentToRow(s);
  check.check("9. Profissional: envia o programa e NUNCA as sessões (uma cópia antiga não apaga sessões novas)", "training_program" in pro && !("workout_logs" in pro));
  check.check("9. Aluno: envia as sessões e NUNCA o programa (um programa alterado não rejeita a gravação do aluno)", "workout_logs" in al && !("training_program" in al));
  check.check("9. Modo local/demo: ambos", "training_program" in local && "workout_logs" in local);
})();

// ---- 10. Ecrãs baixos ----
(function(){
  var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  check.check("10. Em ecrãs baixos (paisagem/teclado) o painel do cronómetro encolhe", /@media \(max-height:560px\)\{\s*#restTimer\{bottom:calc\(76px/.test(html));
  check.check("10. A animação de alerta pisca poucas vezes (não para sempre)", /animation:rtPulse 1s ease-in-out 8;/.test(html));
})();
// ---- 11. Achados de menor gravidade ----
(function(){
  var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  check.check("11. Descanso prescrito de 0 s só marca a série (não arranca 90 s)", /if \(secs >= 5\) restTimerStart\(secs/.test(appSource));
  check.check("11. Guardar o treino fecha o cronómetro", /wlDraftClear\(s, day\.id\);\s*restTimerStop\(\);/.test(appSource));
  check.check("11. 'Acrescentar nota datada' não perde o texto ainda não guardado", /if \(area\) s\.notes = area\.value;/.test(appSource));
  check.check("11. Alvos de toque do cronómetro ≥ 44 px e toques rápidos sem zoom (touch-action)", /rt-head button\{[^}]*min-height:44px[^}]*touch-action:manipulation/.test(html) && /rt-actions button\{touch-action:manipulation; min-height:44px/.test(html));
  check.check("11. Epley limitado a 12 repetições: uma série de 30 não 'sobe' o máximo", epley1RM(70, 30) === epley1RM(70, 12));
  function hist(arr){ return arr.map(function(v, i){ return {date:daysAgo(60 - i * 7), score:v}; }); }
  check.check("11. Queda de 30 % depois de estagnar é 'regrediu' (antes: 'estagnado')", progressionStatus(hist([100, 100, 100, 100, 70])) === "regrediu");
  var old = [0, 1, 2, 3].map(function(i){ return {date:daysAgo(300 - i * 7), entries:[{exerciseId:"a", name:"Antigo A", sets:[{reps:1, load:100}]}, {exerciseId:"b", name:"Antigo B", sets:[{reps:1, load:100}]}]}; });
  check.check("11. Exercícios abandonados há meses não geram alerta de progressão", signalProgressaoCarga({workoutLogs: old}).status !== "atencao");
  var tiny = computeSuggestedTargets({sex:"Feminino", weight:40, height:150, age:60, trainingsPerWeek:0, weightGoal:38});
  var maint = Math.round(computeBMR("Feminino", 40, 150, 60) * 1.2);
  check.check("11. Meta de perda nunca dá mais calorias do que a manutenção (" + tiny.kcal + " ≤ " + maint + ")", tiny.kcal <= maint);
  var warns = nutritionSafetyWarnings({sex:"Feminino", weightCurrent:40, height:150, age:60, trainingsPerWeek:0}, {kcal:maint, protein:70, carbs:100, fat:30});
  check.check("11. Manter o peso à manutenção não é acusado de 'abaixo do mínimo'", !warns.some(function(w){ return /mínimo habitual|metabolismo basal/.test(w.text); }));
})();
check.summarize();
