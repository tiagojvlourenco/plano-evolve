// Fase 2 — experiência do aluno.
require("./setup")();
eval(require("./extract-app")());
var check = require("./check")();

var RealDate = Date;
function mockNow(y, mo, d, h, mi) {
  global.Date = class extends RealDate {
    constructor(...args) { if (args.length) super(...args); else super(y, mo, d, h, mi); }
    getHours() { return h; }
    getMinutes() { return mi; }
    getDay() { return new RealDate(y, mo, d).getDay(); }
  };
}
function resetDate(){ global.Date = RealDate; }

// FLUXO 1: abre às 08:00 -> primeira refeição
(function(){
  mockNow(2026,8,22, 8,0);
  var maria = findStudent("maria");
  maria.mealsDate = null; maria.meals.forEach(function(m){ m.done=false; m.adapted=false; });
  var nm = getNextMeal(maria);
  check.check("FLUXO 1: às 08:00 a próxima é Pequeno-almoço (07:30 já passou -> Meio da manhã é a seguinte real)", nm.meal.name === "Meio da manhã" || nm.meal.name === "Pequeno-almoço");
  resetDate();
})();

// FLUXO 2: abre às 17:00 -> próxima refeição correta
(function(){
  mockNow(2026,8,22, 17,0);
  var maria = findStudent("maria");
  var nm = getNextMeal(maria);
  check.check("FLUXO 2: às 17:00 a próxima é Lanche pré-treino (17:00) ou Jantar", nm.meal.time >= "17:00");
  resetDate();
})();

// FLUXO 3: marcar almoço concluído atualiza totais
(function(){
  var maria = findStudent("maria");
  maria.meals.forEach(function(m){ m.done=false; m.adapted=false; });
  var before = consumedTotals(maria);
  var almoco = maria.meals.find(function(m){ return m.name==="Almoço"; });
  almoco.done = true;
  var after = consumedTotals(maria);
  check.check("FLUXO 3: marcar Almoço concluído aumenta o total consumido", after.kcal > before.kcal);
  almoco.done = false;
})();

// FLUXO 4: substituir frango por outra proteína -> refeição adaptada, ainda contabilizada
(function(){
  var maria = findStudent("maria");
  var almoco = maria.meals.find(function(m){ return m.name==="Almoço"; });
  var fi = almoco.foods.findIndex(function(f){ return f.group==="protein"; });
  var original = almoco.foods[fi];
  almoco.foods[fi] = { name:"Peru (fatiado)", qty:"150 g", group:"protein" };
  almoco.adapted = true;
  check.check("FLUXO 4: refeição fica marcada como adaptada", mealStatusIcon(almoco) === "↻");
  check.check("FLUXO 4: refeição adaptada continua a contar nos totais", mealCountsToday(almoco) === true);
  var totals = resolvedMealTotals(maria, almoco);
  check.check("FLUXO 4: totais recalculados com a nova proteína (>0 kcal)", totals.kcal > 0);
  almoco.foods[fi] = original; almoco.adapted = false;
})();

// FLUXO 5/6/7: comportamento por nível de flexibilidade
check.check("FLUXO 5: flexibilidade baixa (25) -> tier estruturado", flexTier(25) === "estruturado");
check.check("FLUXO 6: flexibilidade média (50) -> tier equilibrado", flexTier(50) === "equilibrado");
check.check("FLUXO 7: flexibilidade alta (85) -> tier flexivel", flexTier(85) === "flexivel");

// FLUXO 8: cenário "outra situação" tem tips e campo de texto livre
check.check("FLUXO 8: cenário 'outra' existe com tips neutros", SCENARIOS.outra && SCENARIOS.outra.tips.length > 0 && SCENARIOS.outra.freeText === true);
check.check("FLUXO 8: nenhum texto culpabilizador nos tips", JSON.stringify(SCENARIOS).match(/falhaste|estragaste|pecaste|dia do lixo/i) === null);

// FLUXO 9: todas as refeições concluídas -> estado do dia
(function(){
  var rui = findStudent("rui");
  rui.meals.forEach(function(m){ m.done = true; });
  var allDone = rui.meals.every(function(m){ return mealCountsToday(m); });
  check.check("FLUXO 9: todas concluídas -> app reconhece o dia completo", allDone === true);
  rui.meals.forEach(function(m){ m.done = false; });
})();

// FLUXO 10: novo dia reinicia estados
(function(){
  var sofia = findStudent("sofia");
  sofia.meals.forEach(function(m){ m.done = true; m.adapted = true; });
  sofia.mealsDate = "2000-01-01"; // dia antigo
  ensureFreshDay(sofia);
  var allReset = sofia.meals.every(function(m){ return !m.done && !m.adapted; });
  check.check("FLUXO 10: novo dia reinicia done/adapted de todas as refeições", allReset === true);
  check.check("FLUXO 10: mealsDate atualizada para hoje", sofia.mealsDate === todayISO());
})();

// Extra: dia de treino / descanso não inventa dados
(function(){
  var maria = findStudent("maria"); // tem trainingDays
  var result = isTrainingDayToday(maria);
  check.check("Treino: aluno com trainingDays definido devolve true/false (não null)", result === true || result === false);
  var fake = { trainingDays: undefined };
  check.check("Treino: aluno sem trainingDays não inventa informação (null)", isTrainingDayToday(fake) === null);
})();

check.summarize();
