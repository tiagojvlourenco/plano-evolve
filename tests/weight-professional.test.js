// O peso é registado só pelo profissional (avaliações): revisões de fase e indicadores funcionam com essas pesagens e com as sessões
// de treino registadas, sem check-ins semanais, sem contar a mesma pesagem duas vezes e sem conclusões falsas quando faltam dados.
// O último bloco corre num processo à parte com TZ=Europe/Lisbon e relógio fixo (não depende da hora a que os testes correm).
var fs = require("fs");
var path = require("path");

if (process.argv[2] === "child-clock"){
  // relógio fixo: um instante UTC dado; new Date() e Date.now() devolvem-no
  var fixed = Date.parse(process.argv[3]), RealDate = Date;
  global.Date = class extends RealDate {
    constructor(){ if (arguments.length) super(...arguments); else super(fixed); }
    static now(){ return fixed; }
  };
  require("./setup")();
  eval(require("./extract-app")());
  var today = todayISO();
  var s = {goal: "Perda de peso", trainingsPerWeek: 3, weights: [{date: today, w: 80}], workoutLogs: [{date: today, entries: []}], assessments: [], checkins: []};
  var log = logWorkout({workoutLogs: []}, {entries: [{name: "Agachamento", sets: [{reps: 8, load: 50}]}]});
  console.log(JSON.stringify({today: today, local: localTodayISO(), logDate: log.date, daysSinceLast: weightProgress(s).daysSinceLast, week: trainingActivity(s).week, wDate: weightProgress(s).last.date,
    tomorrow: addDaysISO(today, 1)}));
  return;
}

require("./setup")();
eval(require("./extract-app")());
var check = require("./check")();
var cp = require("child_process");

sbReady = false; authRole = "professional";
var today = localTodayISO();
function d(n){ return addDaysISO(today, n); }
function stu(extra){
  return Object.assign({id: "w1", name: "Teste", sex: "Masculino", age: 35, height: 178, weightCurrent: 90, weightInitial: 90, goal: "Perda de peso", weightGoal: 82,
    weights: [], assessments: [], checkins: [], workoutLogs: [], trainingsPerWeek: 3, active: true, planHistory: [], blockedFoods: [], flexibility: 50,
    meals: [], targets: {kcal: 2300, protein: 160, carbs: 250, fat: 75},
    nutritionPhase: {phase: "cut", startDate: d(-60), startWeight: 90, targetWeight: 82, level: "novato", stage: 0, lastChangeDate: d(-60), lastReviewDate: null, nextReviewDate: d(-1), reviewEveryDays: 14, reviews: []}}, extra || {});
}
// uma avaliação do profissional como a app a grava: avaliação + entrada em weights
function assess(s, daysAgo, kg){
  s.assessments.push({date: d(-daysAgo), weight: kg, bodyFat: 0, muscle: 0, visceral: 0, water: 0});
  s.weights.push({date: d(-daysAgo), w: kg});
  s.weightCurrent = kg;
  return s;
}
function plain(t){ return String(t).replace(/−/g, "-"); }

// ---- 1. sem pesagens e sem check-ins ----
(function(){
  var s = stu(), r = computePhaseReview(s, today);
  check.check("1. Sem pesagens: a revisão é «dados» e diz o que falta", r && r.kind === "dados" && r.text === WEIGHT_MISSING_TEXT && /regista o peso na próxima avaliação/.test(r.text));
  check.check("1. Sem conclusões: nada proposto, nada de estagnação", !r.proposedTargets && r.deltaKcal === 0 && !/estagn|perda|ganho/i.test(r.text));
  check.check("1. O indicador de peso diz o mesmo, sem atenção", signalWeight(s).status === "insuficiente" && signalWeight(s).text === WEIGHT_MISSING_TEXT && signalPesagem(s).status === "insuficiente");
  var sig = computeStudentSignals(s);
  check.check("1. Os restantes indicadores continuam a calcular-se (plano, treinos)", sig.some(function(x){ return x.key === "plano_ativo"; }) && sig.some(function(x){ return x.key === "treinos"; }));
})();

// ---- 2. uma só avaliação ----
(function(){
  var s = assess(stu(), 3, 89.5), r = computePhaseReview(s, today), p = weightProgress(s, today);
  check.check("2. Uma avaliação: mostra o valor disponível", p.n === 1 && p.last.w === 89.5 && p.daysSinceLast === 3 && /89,5 kg/.test(weightProgressText(p)));
  check.check("2. …mas não fala de tendência nem de variação", p.deltaKg === null && !p.consolidated && /ainda não há evolução nem tendência/.test(weightProgressText(p)));
  check.check("2. A revisão fica em «dados», sem proposta", r.kind === "dados" && !r.proposedTargets && /uma pesagem/.test(r.text) && !/estagnad|estagnou/i.test(r.text));
  check.check("2. O indicador de peso não avalia com um só ponto", signalWeight(s).status === "insuficiente");
})();

// ---- 3. várias avaliações ----
(function(){
  var s = stu(); assess(s, 56, 90); assess(s, 28, 88.6); assess(s, 14, 88); assess(s, 0, 87.2);
  var p = weightProgress(s, today);
  check.check("3. Variação absoluta e percentual pelas datas reais", p.n === 4 && p.deltaKg === -2.8 && p.deltaPct === -3.1 && p.spanDays === 56);
  check.check("3. Ritmo por semana calculado sobre o intervalo real (56 dias = 8 semanas)", p.kgPerWeek === -0.35 && p.consolidated === true);
  var txt = plain(weightProgressText(p));
  check.check("3. O texto traz as datas, o intervalo e o número de pesagens", /90 -> 87,2 kg \(-2,8 kg, -3,1 %\)/.test(plain(txt).replace("→", "->")) && /56 dias, 4 pesagens/.test(txt) && txt.indexOf(fmtDateFullPt(d(-56))) >= 0 && txt.indexOf(fmtDateFullPt(d(0))) >= 0);
})();

// ---- 4. avaliações espaçadas por várias semanas ----
(function(){
  var s = stu(); assess(s, 70, 90); assess(s, 35, 89); assess(s, 0, 88.4);
  var r = computePhaseReview(s, today), p = weightProgress(s, today);
  check.check("4. Não exige pesagem semanal: três avaliações a cada 5 semanas descrevem a evolução", p.n === 3 && p.deltaKg === -1.6 && p.consolidated === true);
  check.check("4. …mas a revisão automática não conclui nada (sem estagnação, sem ajuste)", r.kind === "dados" && !r.proposedTargets && r.deltaKcal === 0 && !/estagnad|estagnou/i.test(r.text));
  check.check("4. O texto explica o que a revisão precisa e pede o peso na próxima avaliação", /precisa de 4/.test(r.text) && /próxima avaliação/.test(r.text) && r.evidence.length > 0);
  var old = stu(); assess(old, 60, 90); assess(old, 40, 89.8);
  check.check("4. A falta de avaliação recente não vira estagnação nem falha do aluno", signalWeight(old).status === "insuficiente" && signalPesagem(old).status === "insuficiente" && computePhaseReview(old, today).kind === "dados");
  var two = stu(); assess(two, 20, 90); assess(two, 0, 90);
  check.check("4. Duas pesagens iguais: ainda sem estagnação (só 2 pontos)", signalWeight(two).status === "insuficiente" && /ainda não é uma tendência/.test(signalWeight(two).text));
})();

// ---- 5. avaliações e treinos, sem check-ins ----
(function(){
  var s = stu(); assess(s, 27, 90.0); assess(s, 18, 89.4); assess(s, 9, 88.8); assess(s, 0, 88.1);
  s.workoutLogs = [{id: "a", date: d(-1), entries: []}, {id: "b", date: d(-3), entries: []}, {id: "c", date: d(-5), entries: []}];
  var r = computePhaseReview(s, today);
  check.check("5. A revisão de peso funciona com as avaliações (sem check-ins)", r.fit.ok && r.kind !== "dados" && s.checkins.length === 0);
  var t = signalTreinos(s), i = signalInatividadeTreino(s);
  check.check("5. Treinos a partir das sessões: 3 de 3 nos últimos 7 dias", t.status === "positivo" && /3 de 3/.test(t.text));
  check.check("5. Inatividade a partir das sessões: última há 1 dia", i.status === "positivo" && /há 1 dia/.test(i.text));
  var late = stu({workoutLogs: [{id: "z", date: d(-30), entries: []}]});
  check.check("5. Sem sessões há 30 dias (já registou antes) → atenção", signalInatividadeTreino(late).status === "atencao" && /30 dias/.test(signalInatividadeTreino(late).text));
  var few = stu({workoutLogs: [{id: "y", date: d(-2), entries: []}]});
  check.check("5. Menos sessões que o previsto nos últimos 7 dias → atenção", signalTreinos(few).status === "atencao" && /1 de 3/.test(signalTreinos(few).text));
})();

// ---- 6. sem registos de treino ----
(function(){
  var withProgram = stu({trainingProgram: {name: "P", days: [{id: "d1", name: "A", exercises: []}]}});
  var a = signalInatividadeTreino(withProgram), b = signalInatividadeTreino(stu({trainingsPerWeek: 0}));
  check.check("6. Sem sessões mas com treinos previstos: «sem registos», não é inatividade", a.status === "insuficiente" && /Sem sessões de treino registadas/.test(a.text) && /não quer dizer/.test(a.text));
  check.check("6. Sem programa nem treinos nem sessões: «dados insuficientes» (outra mensagem)", b.status === "insuficiente" && /não há dados suficientes/.test(b.text) && b.text !== a.text);
  check.check("6. Check-ins sem treinos não tornam o aluno inativo", signalInatividadeTreino(stu({checkins: [{date: d(-14), workouts: 0}, {date: d(-7), workouts: 0}]})).status === "insuficiente");
})();

// ---- 7. o mesmo peso em várias estruturas ----
(function(){
  var s = stu({weights: [{date: d(-10), w: 70}], assessments: [{date: d(-10), weight: 70}], checkins: [{date: d(-10), weight: 70}]});
  check.check("7. weights + avaliação + check-in com o mesmo peso: uma só pesagem", weighInsOf(s).length === 1 && weightProgress(s, today).n === 1);
  var legacy = stu({weights: [{date: d(-20), w: 70}], assessments: [{date: d(-20), weight: 70}, {date: d(-8), weight: 71.2}]});
  check.check("7. Avaliação antiga que falta em weights entra uma vez", weighInsOf(legacy).length === 2 && weighInsOf(legacy)[1].w === 71.2);
  var phantom = stu({weights: [{date: d(-20), w: 70}], assessments: [{date: d(-20), weight: 70}, {date: d(-5), weight: 70}]});
  check.check("7. Avaliação só de composição (repete o peso atual) não cria pesagem nova", weighInsOf(phantom).length === 1);
  var dup = stu({weights: [{date: d(-6), w: 80}, {date: d(-6), w: 80}, {date: d(-3), w: 79.5}, {date: d(-1), w: 79}, {date: d(0), w: 79}]});
  check.check("7. Entradas repetidas no mesmo dia contam como um dia", phaseWeightFit(weighInsOf(dup), d(-28), today).n === 4);
  var fx = stu({weights: [{date: d(-27), w: 90}, {date: d(-27), w: 90}, {date: d(-18), w: 89.4}, {date: d(-9), w: 88.8}, {date: d(0), w: 88.1}], assessments: [{date: d(-27), weight: 90}]});
  var single = computePhaseReview(fx, today);
  check.check("7. Pesagem duplicada não infla o número de pesagens da revisão", single.fit.n === 4 && weightProgress(fx, today).n === 4);
})();

// ---- 8. o aluno não cria nem altera o peso das avaliações ----
(function(){
  var sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", fs.readdirSync(path.join(__dirname, "..", "supabase", "migrations")).filter(function(f){ return /^0019/.test(f); })[0]), "utf8");
  var allowed = sql.match(/allowed_keys text\[\] := array\[([\s\S]*?)\]/)[1];
  check.check("8. O trigger de colunas não deixa o aluno escrever as avaliações", allowed.indexOf("'assessments'") < 0 && allowed.indexOf("'weights'") >= 0 /* herdado do check-in: ver relatório */);
  authRole = "student";
  var s = stu(); assess(s, 0, 80);
  var html = tplEvolucaoAluno(studentView ? s : s, {editable: false});
  authRole = "professional";
  check.check("8. O ecrã do aluno não tem campos de peso nem de avaliação", !/id="asWeight"|id="ciWeight"|id="asSave"/.test(html) && !/<input[^>]*type="number"/.test(html));
  check.check("8. O check-in semanal (a outra porta para o peso) continua desligado", WEEKLY_CHECKIN_ENABLED === false);
})();

// ---- 9. uma avaliação antiga não ganha a uma mais recente ----
(function(){
  var s = stu({weights: [{date: d(0), w: 87}, {date: d(-30), w: 90}, {date: d(-15), w: 88.5}], assessments: [{date: d(0), weight: 87}, {date: d(-30), weight: 90}]});
  var p = weightProgress(s, today), ins = weighInsOf(s);
  check.check("9. As pesagens ficam ordenadas por data, venha a ordem que vier", ins.map(function(w){ return w.date; }).join() === [d(-30), d(-15), d(0)].join());
  check.check("9. A mais recente é a última (não a que foi inserida por último)", p.last.date === d(0) && p.last.w === 87 && p.first.date === d(-30) && p.deltaKg === -3);
  var sameDay = stu({weights: [{date: d(-2), w: 80.4}, {date: d(-2), w: 80.0}]});
  check.check("9. No mesmo dia conta a última pesagem registada", weightProgress(sameDay, today).last.w === 80.0);
  var future = stu({weights: [{date: d(-10), w: 80}, {date: d(5), w: 70}]});
  check.check("9. Uma data futura não passa por «a mais recente»", weightProgress(future, today).last.w === 80);
})();

// ---- 10. data local de Portugal diferente da UTC (verão e inverno), sem depender da hora do teste ----
function clock(iso){
  var r = cp.spawnSync(process.execPath, [__filename, "child-clock", iso], {env: Object.assign({}, process.env, {TZ: "Europe/Lisbon"}), encoding: "utf8"});
  try { return JSON.parse(String(r.stdout).trim().split("\n").pop()); } catch (e) { return {error: r.stderr || r.stdout}; }
}
(function(){
  var summer = clock("2026-07-15T23:30:00Z");   // 00:30 de 16 de julho em Lisboa (UTC+1): em UTC ainda é dia 15
  check.check("10. Verão, 00:30 em Lisboa: hoje é o dia 16 (e não o 15 UTC)", summer.today === "2026-07-16" && summer.local === "2026-07-16" && summer.logDate === "2026-07-16");
  check.check("10. …o treino e a pesagem de «hoje» contam como hoje", summer.daysSinceLast === 0 && summer.week === 1 && summer.wDate === "2026-07-16");
  var spring = clock("2026-03-28T23:30:00Z");   // ainda horário de inverno (UTC+0): sem diferença
  check.check("10. Última noite de inverno (23:30 UTC = 23:30 local): hoje é o dia 28", spring.today === "2026-03-28");
  var dstDay = clock("2026-03-29T01:30:00Z");   // 02:30 locais, já com a hora de verão
  check.check("10. No dia da mudança para a hora de verão o dia local é o 29", dstDay.today === "2026-03-29" && dstDay.tomorrow === "2026-03-30");
  var autumn = clock("2026-10-24T23:30:00Z");   // 00:30 de 25 de outubro, ainda UTC+1
  check.check("10. Noite da mudança para a hora de inverno: 00:30 local já é dia 25", autumn.today === "2026-10-25");
  var winter = clock("2026-01-15T23:30:00Z");
  check.check("10. Inverno 23:30: dia 15 nos dois (UTC = local)", winter.today === "2026-01-15" && winter.local === "2026-01-15");
  var src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  check.check("10. todayISO deixou de usar toISOString (UTC)", /function todayISO\(\)\{ return localTodayISO\(\); \}/.test(src));
})();

check.summarize();
