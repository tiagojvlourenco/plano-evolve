// Fase 1 — base e cálculos nutricionais.
require("./setup")();
eval(require("./extract-app")());
var check = require("./check")();

// ---- 1. Soma das calorias das refeições + 2. Coerência calorias/macros ----
STUDENTS.forEach(function (s) {
  var sum = s.meals.reduce(function (a, m) { return a + foodsTotals(m.foods).kcal; }, 0);
  var diffPct = Math.abs(sum - s.targets.kcal) / s.targets.kcal;
  check.check(s.name + ": soma das refeições (" + sum + ") coerente com o alvo (" + s.targets.kcal + "), diff " + (diffPct*100).toFixed(1) + "%", diffPct <= 0.05);

  var expected = expectedKcalFromMacros(s.targets);
  var diffPct2 = Math.abs(expected - s.targets.kcal) / s.targets.kcal;
  check.check(s.name + ": kcal do alvo (" + s.targets.kcal + ") coerente com macros (~" + expected + "), diff " + (diffPct2*100).toFixed(1) + "%", diffPct2 <= 0.05);
});

// ---- 3. Próxima refeição dependendo da hora ----
(function () {
  var maria = findStudent("maria");
  var RealDate = Date;
  function mockNow(h, m) {
    global.Date = class extends RealDate {
      constructor(...args) { if (args.length) super(...args); else super(2026, 8, 22, h, m); }
      getHours() { return h; }
      getMinutes() { return m; }
    };
  }
  mockNow(20, 7);
  var nm = getNextMeal(maria);
  check.check("às 20:07, próxima refeição é Jantar (20:30)", nm.meal.name === "Jantar" && !nm.tomorrow);

  mockNow(23, 50);
  var nm2 = getNextMeal(maria);
  check.check("às 23:50 (todas passaram), rola para amanhã, primeira refeição do dia", nm2.tomorrow === true && nm2.meal.name === "Pequeno-almoço");

  mockNow(6, 0);
  var nm3 = getNextMeal(maria);
  check.check("às 06:00, próxima é Pequeno-almoço (07:30) hoje", nm3.meal.name === "Pequeno-almoço" && !nm3.tomorrow);

  global.Date = RealDate;
})();

// ---- 4/5/6/7. Flexibilidade 0-100 e tiers ----
check.check("flexTier(0) = estruturado", flexTier(0) === "estruturado");
check.check("flexTier(33) = estruturado", flexTier(33) === "estruturado");
check.check("flexTier(34) = equilibrado", flexTier(34) === "equilibrado");
check.check("flexTier(66) = equilibrado", flexTier(66) === "equilibrado");
check.check("flexTier(67) = flexivel", flexTier(67) === "flexivel");
check.check("flexTier(100) = flexivel", flexTier(100) === "flexivel");

// ---- 8. Substituições (dados nutricionais existem e variam) ----
(function () {
  var opts = FOOD_GROUPS.protein;
  var known = opts.every(function (o) { return FOOD_DB[o.name] != null; });
  check.check("todas as alternativas de proteína têm dados nutricionais", known);
  var n1 = foodNutrition(opts[0].name, opts[0].qty);
  var n2 = foodNutrition(opts[1].name, opts[1].qty);
  check.check("alternativas de substituição têm valores nutricionais distintos (não todas zero)", n1.kcal > 0 && n2.kcal > 0);
})();

// ---- 9. Estado de refeições concluídas ----
(function () {
  var rui = findStudent("rui");
  rui.meals.forEach(function (m) { m.done = false; });
  var t0 = consumedTotals(rui);
  check.check("nenhuma refeição concluída -> consumido = 0 kcal", t0.kcal === 0);

  rui.meals.forEach(function (m) { m.done = true; });
  var t1 = consumedTotals(rui);
  var expectedAll = rui.meals.reduce(function (a, m) { return a + foodsTotals(m.foods).kcal; }, 0);
  check.check("todas as refeições concluídas -> consumido = soma das refeições (" + t1.kcal + " = " + expectedAll + ")", t1.kcal === expectedAll);
  rui.meals.forEach(function (m) { m.done = false; }); // reset
})();

// ---- 10. Dados fictícios vs reais (adesão) ----
(function () {
  var sofia = findStudent("sofia");
  var adh = computeAdherence(sofia);
  check.check("Sofia tem check-ins -> adesão calculada (" + Math.round(adh*100) + "%)", adh !== null && adh > 0 && adh <= 1);

  var fake = { checkins: [] };
  check.check("aluno sem check-ins -> adesão = null (sem dados, não inventa número)", computeAdherence(fake) === null);
})();

// ---- Estados extremos ----
(function () {
  var empty = { meals: [] };
  check.check("nenhuma refeição configurada -> getNextMeal = null", getNextMeal(empty) === null);

  var m = meal("Teste", "12:00", [food("Frango (peito)", "100 g", "protein")]);
  var t = foodsTotals(m.foods);
  check.check("refeição de teste com 100g frango dá ~165 kcal", Math.abs(t.kcal - 165) <= 2);
})();

check.summarize();
