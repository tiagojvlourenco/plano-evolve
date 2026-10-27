// Volume semanal por grupo muscular, deload e recordes.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
function iso(d){ return new Date(Date.now() - d * 86400000).toISOString().slice(0, 10); }
function clone(x){ return JSON.parse(JSON.stringify(x)); }

// ---- grupo de cada exercício ----
check.check("1. Os exercícios da biblioteca têm o grupo da biblioteca (nome inglês)", exerciseGroupFor("Barbell Bench Press") === "Peito" && exerciseGroupFor("Lying Leg Curl") === "Posteriores" && exerciseGroupFor("Leg Press Calf Raise") === "Gémeos");
check.check("2. O nome em português também serve (alias)", exerciseGroupFor("Supino reto com barra") === "Peito" && exerciseGroupFor("Remada com barra") === "Costas" && exerciseGroupFor("Prancha") === "Core");
check.check("3. Nomes escritos à mão são adivinhados pelas palavras", exerciseGroupFor("Rosca martelo com corda") === "Bíceps" && exerciseGroupFor("Extensão de tríceps em V") === "Tríceps" && exerciseGroupFor("Press de ombros Arnold") === "Ombros" && exerciseGroupFor("Curl femoral unilateral") === "Posteriores");
check.check("4. Um nome desconhecido fica sem grupo", exerciseGroupFor("Xpto especial") === "" && exerciseGroupFor("") === "");
var wrong = [];
exerciseSeedList().forEach(function(e){ [e.name, e.book ? "" : e.alias].forEach(function(n){ if (n && exerciseGroupFor(n) !== e.group) wrong.push(n); }); });
check.check("5. Todos os exercícios e alias da lista base dão o grupo certo", wrong.length === 0);
check.check("6. O grupo escolhido à mão tem prioridade sobre o adivinhado", exerciseGroupOf({name: "Barbell Bench Press", group: "Tríceps"}) === "Tríceps" && exerciseGroupOf({name: "Barbell Bench Press"}) === "Peito");

// ---- programa e volume ----
var s = {id: "v", goal: "Perda de gordura", trainingProgram: {name: "P", days: [
  {id: "d1", name: "A", exercises: [
    {id: "e1", name: "Barbell Bench Press", sets: 4, reps: "6-8"}, {id: "e2", name: "Seated Cable Row", sets: 3, reps: "8-12"}, {id: "e3", name: "Dumbbell Lateral Raise", sets: 3, reps: "12-15"}]},
  {id: "d2", name: "B", exercises: [
    {id: "e4", name: "Incline Dumbbell Press", sets: 3, reps: "8-10"}, {id: "e5", name: "Wide-Grip Lat Pulldown", sets: 4, reps: "8-12"}, {id: "e6", name: "Hammer Curl", sets: 3, reps: "10-12"}]}]},
  workoutLogs: [{id: "l1", date: iso(2), dayId: "d1", dayName: "A", entries: [
    {exerciseId: "e1", name: "Barbell Bench Press", sets: [{reps: 8, load: 60}, {reps: 7, load: 60}, {reps: 6, load: 60}]},
    {exerciseId: "e2", name: "Seated Cable Row", sets: [{reps: 10, load: 40}, {reps: 10, load: 40}]}]},
    {id: "l0", date: iso(20), dayId: "d1", dayName: "A", entries: [{exerciseId: "e1", name: "Barbell Bench Press", sets: [{reps: 8, load: 55}, {reps: 8, load: 55}]}]}]};
var v = weeklyVolume(s);
check.check("7. Séries previstas por grupo somam os dias do programa (Peito 4+3 = 7)", v.planned["Peito"] === 7 && v.planned["Costas"] === 7 && v.planned["Ombros"] === 3 && v.planned["Bíceps"] === 3);
check.check("8. Séries feitas contam só os últimos 7 dias", v.done["Peito"] === 3 && v.done["Costas"] === 2 && !v.done["Ombros"]);
var rows = volumeRows(s);
check.check("9. A zona vem do objetivo (perda de gordura = 8–16)", rows.zone.lo === 8 && rows.zone.hi === 16);
check.check("10. Peito com 7 séries previstas está abaixo da zona; ombros e bíceps também", ["Peito", "Ombros", "Bíceps"].every(function(g){ return rows.rows.filter(function(r){ return r.group === g; })[0].status === "baixo"; }));
check.check("11. Aponta os grupos principais sem trabalho previsto (quadríceps e posteriores)", rows.missing.join(",") === "Quadríceps,Posteriores");
var big = clone(s); big.goal = "Ganho de massa muscular"; big.trainingProgram.days[0].exercises[0].sets = 20;
var br = volumeRows(big);
check.check("12. Ganho de massa usa a zona 10–20 e avisa quando se passa", br.zone.hi === 20 && br.rows.filter(function(r){ return r.group === "Peito"; })[0].status === "alto");
check.check("13. Manutenção usa a zona 6–10", volumeZoneFor({goal: "Manutenção do peso"}).hi === 10);
var core = {goal: "x", trainingProgram: {days: [{id: "d", name: "A", exercises: [{id: "c", name: "Prancha", sets: 3, reps: "30s"}]}]}, workoutLogs: []};
check.check("14. Core e gémeos com poucas séries não são marcados como baixos", volumeRows(core).rows[0].group === "Core" && volumeRows(core).rows[0].status === "ok");
check.check("15. Sem programa nem sessões não há cartão de volume", tplVolumeAndDeload({goal: "x", trainingProgram: null, workoutLogs: []}) === "");
var html = tplVolumeAndDeload(s);
check.check("16. A tabela mostra os grupos, previstas e feitas", /id="volumeTable"/.test(html) && /Peito<\/td><td>7<\/td><td>3<\/td>/.test(html));

// ---- deload ----
function trainee(){
  var t = {id: "t", goal: "x", checkins: [], trainingProgram: {name: "P", days: [{id: "d", name: "A", exercises: [{id: "e", name: "Squat", sets: 3, reps: "6-8"}]}]}, workoutLogs: []};
  return t;
}
function addLog(t, daysAgo, entries){ t.workoutLogs.push({id: "l" + t.workoutLogs.length, date: iso(daysAgo), dayId: "d", dayName: "A", entries: entries}); }
function hardEntries(n, rir){ var a = []; for (var i = 0; i < n; i++) a.push({exerciseId: "x" + i, name: "Ex " + i, sets: [{reps: 8, load: 50, rir: rir}, {reps: 8, load: 50, rir: rir}]}); return a; }
var t = trainee(); addLog(t, 6, hardEntries(1, 2)); addLog(t, 4, hardEntries(1, 2)); addLog(t, 2, hardEntries(1, 2));
check.check("17. Com menos de 4 sessões não há sugestão", deloadSuggestion(t) === null);
addLog(t, 1, hardEntries(1, 2));
check.check("18. Sessões recentes sem sinais de fadiga: sem sugestão", deloadSuggestion(t) === null);
var h = trainee(); addLog(h, 9, hardEntries(4, 2)); addLog(h, 7, hardEntries(4, 2)); addLog(h, 3, hardEntries(4, 0)); addLog(h, 1, hardEntries(4, 0.5));
var dh = deloadSuggestion(h);
check.check("19. RIR médio abaixo de 1 em vários exercícios nas últimas 2 sessões é um sinal", dh && dh.reasons.some(function(r){ return /RIR/.test(r); }));
h.checkins = [{date: iso(8), weight: 70, energy: 3, recovery: 4, sleepQuality: 3}, {date: iso(1), weight: 70, energy: 4, recovery: 3, sleepQuality: 4}];
dh = deloadSuggestion(h);
check.check("20. Dois sinais fortes (RIR + energia/sono baixos) = sugerir", dh.level === "sugerir" && dh.reasons.length >= 2);
var old = trainee(); for (var i = 0; i < 8; i++) addLog(old, 50 - i * 6, hardEntries(1, 2)); // 7 semanas de treino regular, sem deload
var d7 = deloadSuggestion(old);
check.check("21. 5 ou mais semanas sem deload (só isso) = considerar", d7 && d7.level === "considerar" && /semanas/.test(d7.reasons[0]));
registerDeload(old, iso(2));
check.check("22. Depois de registar um deload deixa de ser sugerido", deloadSuggestion(old) === null && deloadDates(old).length === 1);
check.check("23. Não se regista o mesmo dia duas vezes", registerDeload(old, iso(2)) === false && old.trainingProgram.deloads.length === 1);
var stopped = trainee(); for (var j = 0; j < 8; j++) addLog(stopped, 90 - j * 6, hardEntries(1, 2));
check.check("24. Quem parou de treinar há semanas não leva sugestão de deload", deloadSuggestion(stopped) === null);
var badges = computeCoachBadges(Object.assign({}, h, {meals: [], weights: [], assessments: [], targets: {}, flexibility: 0}));
check.check("25. A sugestão aparece nas etiquetas do aluno", badges.some(function(b){ return b.key === "deload" && /deload/i.test(b.label); }));
check.check("26. O cartão tem o botão para registar o deload", /id="registerDeload"/.test(tplVolumeAndDeload(h)) && /id="deloadCard"/.test(tplVolumeAndDeload(h)));

// ---- recordes ----
var r = trainee(); r.workoutLogs = [
  {id: "a", date: iso(14), dayId: "d", dayName: "A", entries: [{exerciseId: "e", name: "Squat", sets: [{reps: 8, load: 80}]}]},
  {id: "b", date: iso(7), dayId: "d", dayName: "A", entries: [{exerciseId: "e", name: "Squat", sets: [{reps: 8, load: 85}]}]}];
var logNew = {id: "c", date: iso(0), dayId: "d", dayName: "A", entries: [{exerciseId: "e", name: "Squat", sets: [{reps: 8, load: 90}]}]};
r.workoutLogs.push(logNew);
var rec = detectRecords(r, logNew);
check.check("27. Uma carga acima de tudo o que fez antes é recorde", rec.length === 1 && rec[0].name === "Squat");
check.check("28. A mensagem diz o exercício e a carga", /🏆 Novo recorde: Squat — 90 kg × 8/.test(recordMessage(rec)));
var lowLog = {id: "d", date: iso(0), dayId: "d", dayName: "A", entries: [{exerciseId: "e", name: "Squat", sets: [{reps: 8, load: 70}]}]};
r.workoutLogs.push(lowLog);
check.check("29. Uma sessão pior não é recorde", detectRecords(r, lowLog).length === 0);
var first = trainee(); var l1 = {id: "x", date: iso(0), dayId: "d", dayName: "A", entries: [{exerciseId: "e", name: "Squat", sets: [{reps: 8, load: 40}]}]}; first.workoutLogs = [l1];
check.check("30. Sem pelo menos 2 sessões anteriores não há recorde (a 1.ª vez não conta)", detectRecords(first, l1).length === 0);
var bw = trainee(); bw.workoutLogs = [{id: "1", date: iso(10), dayId: "d", dayName: "A", entries: [{exerciseId: "p", name: "Push-Up", sets: [{reps: 10}]}]}, {id: "2", date: iso(5), dayId: "d", dayName: "A", entries: [{exerciseId: "p", name: "Push-Up", sets: [{reps: 12}]}]}];
var lb = {id: "3", date: iso(0), dayId: "d", dayName: "A", entries: [{exerciseId: "p", name: "Push-Up", sets: [{reps: 15}]}]}; bw.workoutLogs.push(lb);
check.check("31. Sem carga, o recorde são as repetições", /15 repetições/.test(recordMessage(detectRecords(bw, lb))));

// ---- integração ----
var ex = addProgramExercise({trainingProgram: {name: "P", days: [{id: "d", name: "A", exercises: []}]}}, "d", {name: "Hammer Curl", sets: 3, reps: "10"});
check.check("32. Um exercício novo recebe o grupo pelo nome", ex.group === "Bíceps");
var ex2 = addProgramExercise({trainingProgram: {name: "P", days: [{id: "d", name: "A", exercises: []}]}}, "d", {name: "Barbell Bench Press", sets: 3, reps: "10", group: "Tríceps"});
check.check("33. O grupo escolhido à mão é respeitado", ex2.group === "Tríceps");
var tpl = trainingTemplateFrom({trainingProgram: {name: "P", days: [{id: "d", name: "A", exercises: [{id: "x", name: "Hammer Curl", sets: 3, reps: "10", group: "Bíceps"}]}]}});
check.check("34. Os templates guardam o grupo", tpl.days[0].exercises[0].group === "Bíceps");
var dest = {id: "z"}; applyTrainingTemplate(dest, {days: [{name: "A", exercises: [{name: "Seated Cable Row"}]}]}, "replace");
check.check("35. Ao aplicar um template antigo (sem grupo) o grupo é adivinhado", dest.trainingProgram.days[0].exercises[0].group === "Costas");
check.check("36. Aplicar um template em modo substituir não apaga os deloads registados", (function(){ var q = {id: "q", trainingProgram: {name: "P", days: [], deloads: [{date: iso(3)}]}}; applyTrainingTemplate(q, {days: [{name: "A", exercises: []}]}, "replace"); return q.trainingProgram.deloads.length === 1; })());
check.check("37. O formulário e o editor do guia têm o seletor de grupo", /data-ex-group/.test(appSource) && /id=\\"guideGroup\\"/.test(appSource));
check.check("38. O aviso de recorde aparece depois do 'Treino guardado'", /setTimeout\(function\(\)\{ showToast\(recordMsg\); \}, 1800\)/.test(appSource));
check.summarize();
