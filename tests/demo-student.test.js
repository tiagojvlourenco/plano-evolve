// Aluna de demonstração completa ("Ana Demo"): garante que o perfil de teste continua a cobrir as funcionalidades e que nenhum ecrã
// de nenhum aluno de demonstração gera texto partido (undefined, NaN, [object ...]).
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

var ana = findStudent("demo-ana");
check.check("1. A aluna de demonstração existe, está marcada como demonstração e ativa", !!ana && ana.isDemo === true && ana.active === true && /Ana Demo/.test(ana.name));
check.check("2. Tem 12 semanas de peso, 10 check-ins, 3 avaliações e fotos de antes e depois nas 3 posições", ana.weights.length === 13 && ana.checkins.length === 10 && ana.assessments.length === 3 && ana.photos.length === 6 && PHOTO_POSITIONS.every(function(p){ return ana.photos.filter(function(f){ return f.position === p.key; }).length === 2; }));
check.check("3. As fotos são imagens válidas para a app", ana.photos.every(function(p){ return photoUrl(p) !== ""; }));
check.check("4. Tem um programa de 3 dias com guia (pontos-chave) e 18 sessões com RIR nas mais recentes", trainingProgramOf(ana).days.length === 3 && trainingProgramOf(ana).days.every(function(d){ return d.exercises.every(function(e){ return parseCues(e.cues).length >= 2; }); }) && ana.workoutLogs.length === 18 && ana.workoutLogs[17].entries[0].sets[0].rir != null);
var keys = computeCoachBadges(ana).map(function(b){ return b.key; });
check.check("5. O dashboard mostra: peso estagnado a treinar, alta adesão e exercícios para subir carga", ["estagnado-a-treinar", "alta-adesao", "sobrecarga"].every(function(k){ return keys.indexOf(k) >= 0; }));
var supino = findProgramExercise(ana, "eA1"), laterais = findProgramExercise(ana, "eC2");
check.check("6. O Supino e as Elevações laterais estão prontos para subir carga (e o Agachamento não)", !!overloadSuggestion(ana, supino) && !!overloadSuggestion(ana, laterais) && overloadSuggestion(ana, findProgramExercise(ana, "eB1")) === null);
var sigs = {}; computeStudentSignals(ana).forEach(function(x){ sigs[x.key] = x; });
check.check("7. O sinal de peso é 'estagnado' e o de sono/recuperação aponta a digestão baixa", sigs.peso.status === "atencao" && /estagnad/.test(sigs.peso.text) && sigs.recuperacao.status === "atencao" && /digestão/.test(sigs.recuperacao.text));
var rows = compareMetricRows(ana, ana.assessments[0].date, ana.assessments[2].date), by = {};
rows.forEach(function(r){ by[r.label] = r; });
check.check("8. O Antes vs Depois tem peso, % gordura e os perímetros pedidos", ["Peso", "Massa gorda", "Cintura", "Anca", "Peito", "Braço relaxado", "Coxa"].every(function(k){ return by[k]; }) && by["Cintura"].a > by["Cintura"].b);
var lista = shoppingListFor(ana, 7);
check.check("9. A lista de compras tem alimentos de vários grupos", lista.length >= 4 && lista.every(function(g){ return g.items.every(function(i){ return i.qty && !/undefined|NaN/.test(i.qty); }); }));
var meals = ana.meals, sum = 0; meals.forEach(function(m){ sum += foodsTotals(m.foods).kcal; });
check.check("10. As refeições somam perto do alvo calórico (±5 %)", Math.abs(sum - ana.targets.kcal) / ana.targets.kcal <= 0.05);

// ---------- todos os ecrãs de todos os alunos de demonstração ----------
var BAD = /undefined|NaN|\[object|Infinity/;
function noBad(label, html){ var m = String(html).match(BAD); if (m) console.log("  texto suspeito em " + label + ": ..." + String(html).slice(Math.max(0, String(html).search(BAD) - 60), String(html).search(BAD) + 40).replace(/\s+/g, " ")); return !m; }
STUDENTS.forEach(function(s){
  var ok = true, errors = [];
  var screens = {
    leitura: function(){ return tplProLeitura(s); }, checkins: function(){ return tplProCheckins(s); }, plano: function(){ return tplProPlano(s); },
    treino: function(){ return tplProTreino(s); }, perfil: function(){ return tplProPerfil(s); }, historico: function(){ return tplProHistorico(s); },
    notas: function(){ return tplProNotas(s); }, pedidos: function(){ return tplProPedidos(s, []); },
    evolucaoPT: function(){ return tplEvolucaoAluno(s, {editable: true}); }, evolucaoAluno: function(){ return tplEvolucaoAluno(studentView(s), {editable: false}); },
    checkin: function(){ return tplCheckin(studentView(s)); }, hoje: function(){ return tplHoje(studentView(s)); },
    planoAluno: function(){ state.planoSection = "alimentacao"; return tplPlanoTabs(studentView(s)); },
    treinoPlano: function(){ state.planoSection = "treino"; return tplPlanoTabs(studentView(s)); },
    compras: function(){ state.planoSection = "compras"; return tplPlanoTabs(studentView(s)); },
    logger: function(){ return tplWorkoutLogger(studentView(s)); }
  };
  Object.keys(screens).forEach(function(k){
    try { var html = screens[k](); if (!noBad(s.name + " / " + k, html)) ok = false; } catch (e) { ok = false; errors.push(k + ": " + e.message); }
  });
  state.planoSection = "alimentacao";
  if (errors.length) console.log("  erros em " + s.name + ": " + errors.join(" | "));
  check.check("Todos os ecrãs de " + s.name + " desenham sem erros nem texto partido", ok);
});
check.summarize();
