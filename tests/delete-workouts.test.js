// O profissional apaga sessões registadas (uma ou todas) e a progressão de carga sai com elas.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
function mk(){
  var s = buildFullDemoStudent(); s.id = "w1"; s.name = "Treino Teste"; s.isDemo = false; s.photos = [];
  var l1 = {id: "a1", date: "2025-03-01", dayId: "d1", dayName: "A", rpe: 7, notes: "", entries: [{exerciseId: "e1", name: "Supino", sets: [{reps: 8, load: 60}]}]};
  var l2 = {id: "a2", date: "2025-03-08", dayId: "d1", dayName: "A", rpe: 8, notes: "", entries: [{exerciseId: "e1", name: "Supino", sets: [{reps: 8, load: 65}]}]};
  s.workoutLogs = [l1, l2]; s.workoutLogsRaw = [Object.assign({}, l1), Object.assign({}, l2)];
  return s;
}
var s = mk();
check.check("1. O treino do profissional tem apagar por sessão e «apagar tudo»", /data-del-log=/.test(tplProTreino(s)) && /id="delAllLogs"/.test(tplProTreino(s)));
deleteWorkoutLogs(s, s.workoutLogs[0]);
check.check("2. Apagar uma sessão tira-a dos registos lidos e do que se grava", s.workoutLogs.length === 1 && s.workoutLogs[0].id === "a2" && workoutLogsForWrite(s).length === 1 && workoutLogsForWrite(s)[0].id === "a2");
deleteWorkoutLogs(s, "all");
check.check("3. «Apagar tudo» deixa zero sessões e sem progressão de carga", s.workoutLogs.length === 0 && workoutLogsForWrite(s).length === 0 && !/Progressão de carga<\/div><div class="assess-table-scroll"/.test(tplProTreino(s)));
// gravação: só a lista de sessões vai para o servidor
var calls = [];
var chain = { eq: function(c, v){ calls.push("eq " + c + "=" + v); return chain; }, then: function(ok, ko){ return Promise.resolve({error: null}).then(ok, ko); } };
var fake = { from: function(){ return { update: function(p){ calls.push("update " + Object.keys(p).join(",") + " n=" + p.workout_logs.length); return chain; } }; } };
var s2 = mk(); deleteWorkoutLogs(s2, s2.workoutLogs[1]);
var realSb = sb, realReady = sbReady; sb = fake; sbReady = true;
saveWorkoutLogsAsPro(s2).then(function(ok){
  sb = realSb; sbReady = realReady;
  check.check("4. A remoção grava só workout_logs, já sem a sessão apagada", ok === true && calls[0] === "update workout_logs n=1" && calls[1] === "eq id=w1");
  check.summarize();
});
