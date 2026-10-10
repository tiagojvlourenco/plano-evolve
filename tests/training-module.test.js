// Módulo de treino: programa, registo por sessão, progressão de carga, persistência tolerante e migração.
require("./setup")();
var fs = require("fs");
var path = require("path");
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
function daysAgo(n){ return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10); }

// ---- 1. Programa ----
(function(){
  var s = {};
  var d = addTrainingDay(s, "  Treino A  ");
  check.check("1. Cria um dia com o nome aparado e sem exercícios", d && d.name === "Treino A" && d.exercises.length === 0 && trainingProgramOf(s).days.length === 1);
  check.check("1. Nome vazio não cria dia", addTrainingDay(s, "   ") === null);
  var e = addProgramExercise(s, d.id, {name:"Supino", sets:"4", reps:"6-8", rpe:"8", rest:"120", notes:"pausa"});
  check.check("1. Exercício: séries, repetições, RPE alvo, descanso e notas", e && e.sets === 4 && e.reps === "6-8" && e.rpe === 8 && e.rest === 120 && e.notes === "pausa");
  var e2 = addProgramExercise(s, d.id, {name:"Remada", sets:"99", rpe:"15", rest:"-5"});
  check.check("1. Valores fora de gama ficam limitados (20 séries, sem RPE/descanso inválidos)", e2.sets === 20 && e2.rpe === null && e2.rest === null);
  check.check("1. Sem nome ou dia inexistente → null", addProgramExercise(s, d.id, {name:""}) === null && addProgramExercise(s, "nope", {name:"X"}) === null);
  removeProgramExercise(s, d.id, e.id);
  check.check("1. Remover exercício", trainingProgramOf(s).days[0].exercises.length === 1);
  removeTrainingDay(s, d.id);
  check.check("1. Remover dia", trainingProgramOf(s).days.length === 0);
})();

// ---- 2. Cálculos ----
(function(){
  check.check("2. Epley: 100 kg × 5 = 116,7; 1 rep = a própria carga; sem carga = 0", epley1RM(100, 5) === 116.7 && epley1RM(100, 1) === 100 && epley1RM(0, 8) === 0);
  var st = workoutEntryStats({sets:[{reps:8, load:60}, {reps:6, load:70}, {reps:0, load:80}]});
  check.check("2. Estatísticas: séries válidas, volume, carga máxima, melhor série por 1RM estimado", st.sets === 2 && st.volume === 8 * 60 + 6 * 70 && st.topLoad === 70 && st.topSet.load === 70 && st.topSet.reps === 6);
  check.check("2. Exercício com peso do corpo (carga 0) não rebenta", workoutEntryStats({sets:[{reps:12, load:0}]}).sets === 1 && fmtLoadSet({load:0, reps:12}) === "12 reps (peso do corpo)");
  check.check("2. Primeiro número das repetições ('8-12' → 8)", firstRepsOf("8-12") === 8 && firstRepsOf("até à falha") === 0);
})();

// ---- 3. Registo e histórico ----
(function(){
  var s = {trainingProgram:{name:"P", days:[{id:"d1", name:"A", exercises:[{id:"e1", name:"Supino", sets:3, reps:"8"}]}, {id:"d2", name:"B", exercises:[{id:"e2", name:"Agachamento", sets:3, reps:"8"}]}]}, workoutLogs:[]};
  check.check("3. O primeiro treino sugerido é o primeiro dia", nextWorkoutDay(s).id === "d1");
  var l1 = logWorkout(s, {date:daysAgo(14), dayId:"d1", dayName:"A", rpe:"7", notes:"ok", entries:[{exerciseId:"e1", name:"Supino", sets:[{reps:8, load:50}, {reps:8, load:50}, {reps:"", load:0}]}]});
  check.check("3. Guarda só as séries com repetições", l1.entries[0].sets.length === 2 && l1.rpe === 7);
  check.check("3. Sem nenhuma série válida não regista", logWorkout(s, {entries:[{exerciseId:"e1", name:"Supino", sets:[{reps:0, load:50}]}]}) === null && s.workoutLogs.length === 1);
  check.check("3. Depois do dia A, sugere o B (rotação)", nextWorkoutDay(s).id === "d2");
  var rpeBad = logWorkout(s, {date:daysAgo(10), dayId:"d1", dayName:"A", rpe:"99", entries:[{exerciseId:"e1", name:"Supino", sets:[{reps:8, load:52.5}]}]});
  check.check("3. RPE fora de 1-10 fica null", rpeBad.rpe === null);
  var h = exerciseHistory(s, "e1", "Supino");
  check.check("3. Histórico por exercício por ordem de data", h.length === 2 && h[0].date < h[1].date && h[1].topLoad === 52.5);
  check.check("3. Também encontra pelo nome (programa alterado)", exerciseHistory(s, "outro-id", "supino").length === 2);
})();

// ---- 4. Progressão ----
(function(){
  function hist(arr){ return arr.map(function(v, i){ return {date:daysAgo(60 - i * 7), est1RM:v, score:v}; }); }
  check.check("4. Menos de 2 sessões → sem tendência", progressionStatus(hist([100])) === null);
  check.check("4. Novo máximo → progrediu", progressionStatus(hist([100, 100, 105])) === "progrediu");
  check.check("4. 3 sessões sem novo máximo (≥ 4 sessões) → estagnado", progressionStatus(hist([100, 100, 100, 99])) === "estagnado");
  check.check("4. Queda de ≥ 7% → regrediu", progressionStatus(hist([100, 102, 90])) === "regrediu");
  check.check("4. Pequena oscilação → estável", progressionStatus(hist([100, 102, 101])) === "estável");
})();

// ---- 5. Indicadores ----
(function(){
  check.check("5. Sem sessões → dados insuficientes (nada de alertas para quem não usa o módulo)", signalSessoes({workoutLogs:[]}).status === "insuficiente" && signalProgressaoCarga({workoutLogs:[]}).status === "insuficiente");
  var parado = signalSessoes({trainingsPerWeek:3, workoutLogs:[{date:daysAgo(25), entries:[]}]});
  check.check("5. Última sessão há 25 dias → atenção grave", parado.status === "atencao" && parado.severity === "high" && /25 dias/.test(parado.text));
  var ok = signalSessoes({trainingsPerWeek:2, workoutLogs:[{date:daysAgo(1), entries:[]}, {date:daysAgo(3), entries:[]}]});
  check.check("5. 2 sessões na semana de 2 previstas → positivo", ok.status === "positivo");
  var logs = [100, 100, 100, 99].map(function(v, i){ return {date:daysAgo(40 - i * 7), entries:[{exerciseId:"e1", name:"Supino", sets:[{reps:1, load:v}]}]}; });
  var stalled = signalProgressaoCarga({workoutLogs:logs});
  check.check("5. Exercício estagnado → atenção com o nome", stalled.status === "atencao" && /Supino/.test(stalled.text));
})();

// ---- 6. Vistas e escape ----
(function(){
  var s = {trainingsPerWeek:3, workoutLogs:[], trainingProgram:{name:"P", days:[{id:"d1", name:"<img src=x onerror=1>", exercises:[{id:"e1", name:"<b>Supino</b>", sets:2, reps:"8", rpe:8, rest:90, notes:"<i>x</i>"}]}]}};
  var pro = tplProTreino(s), aluno = tplWorkoutLogger(s);
  check.check("6. Pro: o programa mostra dias e exercícios, escapados", pro.indexOf("<img") === -1 && pro.indexOf("<b>Supino") === -1 && /Programa de treino/.test(pro) && /data-add-ex="d1"/.test(pro));
  check.check("6. Aluno: o registo tem séries por exercício, esforço da sessão e botão guardar, escapado", aluno.indexOf("<b>Supino") === -1 && (aluno.match(/data-wl-reps=/g) || []).length === 2 && /id="wlRpe"/.test(aluno) && /id="wlSave"/.test(aluno));
  check.check("6. Aluno sem programa vê que está a ser preparado", /ainda está a ser preparado/.test(tplWorkoutLogger({trainingProgram:null})));
  check.check("6. O separador Treino existe no menu do profissional", PRO_TABS.some(function(t){ return t[0] === "treino"; }));
})();

// ---- 7. Persistência e migração ----
(function(){
  var s = {id:"x", name:"T", trainingProgram:{name:"P", days:[]}, workoutLogs:[{id:"w1", date:"2026-01-02", entries:[]}], meals:[], checkins:[], weights:[], assessments:[], photos:[], weightLogPhotos:[], targets:{}};
  var row = studentToRow(s);
  check.check("7. A linha leva training_program e workout_logs", row.training_program && row.training_program.name === "P" && row.workout_logs.length === 1);
  var back = rowToStudent(Object.assign({}, row, {meals:[], checkins:[], weights:[], assessments:[], photos:[]}));
  check.check("7. Lê-os de volta; sem as colunas fica null/[]", back.trainingProgram.name === "P" && back.workoutLogs.length === 1 && rowToStudent({meals:[], checkins:[], weights:[], assessments:[], photos:[]}).workoutLogs.length === 0);
  check.check("7. Se a migração 0019 não foi aplicada, a gravação repete sem essas colunas e avisa", /trainingColumnsAvailable = false/.test(appSource) && /training_program\|workout_logs/.test(appSource) && /migração 0019/.test(appSource));
  var sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "0019_training_program.sql"), "utf8");
  check.check("7. A migração acrescenta as colunas, deixa o aluno acrescentar workout_logs e exige append-only", /add column if not exists training_program jsonb/.test(sql) && /add column if not exists workout_logs jsonb/.test(sql) && /'workout_logs'/.test(sql) && /jsonb_array_is_append_only\(old\.workout_logs, new\.workout_logs\)/.test(sql));
  check.check("7. training_program NÃO está na lista de colunas que o aluno pode alterar", !/allowed_keys text\[\] := array\[[^\]]*training_program/.test(sql));
})();
check.summarize();
