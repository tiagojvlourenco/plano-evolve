// Fases de peso (cut / bulk / manutenção): calorias graduais, revisão periódica pela tendência do peso e aprovação com um só OK.
require("./setup")();
eval(require("./extract-app")());
var check = require("./check")();
var store = {};
global.localStorage = {getItem: function(k){ return k in store ? store[k] : null; }, setItem: function(k, v){ store[k] = String(v); }, removeItem: function(k){ delete store[k]; }};
sbReady = false; authRole = "professional";
var today = localTodayISO();
function d(n){ return addDaysISO(today, n); }
// pesagens de x em x dias ao longo de `days` dias, a variar `weeklyKg` por semana
function wts(startKg, weeklyKg, days, every){
  var out = []; for (var i = -days; i <= 0; i += (every || 2)) out.push({date: d(i), w: Math.round((startKg + weeklyKg * ((i + days) / 7)) * 10) / 10}); return out;
}
function checkins(adh, hunger, energy){ var l = []; for (var i = 4; i >= 1; i--) l.push({date: d(-i * 7), adherence: adh, hunger: hunger == null ? 4 : hunger, energy: energy == null ? 7 : energy}); return l; }
function plan(){ return [meal("Pequeno-almoço", "08:00", [food("Aveia", "100 g", "hidratos"), food("Iogurte grego natural", "300 g"), food("Banana", "2 unid.")]), meal("Almoço", "13:00", [food("Arroz (cozido)", "300 g", "hidratos"), food("Frango (peito)", "250 g"), food("Azeite", "15 ml")]), meal("Jantar", "20:00", [food("Batata-doce", "350 g", "hidratos"), food("Pescada", "250 g"), food("Azeite", "10 ml")])]; }
var BASE = {sex: "Masculino", age: 35, height: 178, trainingsPerWeek: 3};
function targetsFor(kcal, protein, fat){ return {kcal: kcal, protein: protein, carbs: Math.round((kcal - protein * 4 - fat * 9) / 4), fat: fat}; }
var BM = computeMaintenanceKcal(Object.assign({weightCurrent: 70}, BASE)), BK = Math.round(BM * 1.05 / 25) * 25;   // aluno de 70 kg num bulk (+5 %)
var M90 = computeMaintenanceKcal(Object.assign({weightCurrent: 90}, BASE)), CUT = Math.round(M90 * 0.9 / 25) * 25;   // aluno de 90 kg num cut (escalão B)
function stu(extra, phase){
  var s = Object.assign({id: "p1", name: "Teste", sex: "Masculino", age: 35, height: 178, weightCurrent: 90, weightInitial: 90, weights: [], checkins: checkins(8), trainingsPerWeek: 3, active: true, planHistory: [], blockedFoods: [], flexibility: 50, flexOverrides: {}, supplements: [],
    assessments: [], meals: plan(), targets: targetsFor(CUT, 160, 75)}, extra || {});
  s.nutritionPhase = Object.assign({phase: "cut", startDate: d(-35), startWeight: 90, targetWeight: 82, level: "novato", stage: 0, lastChangeDate: d(-35), lastReviewDate: null, nextReviewDate: d(-1), reviewEveryDays: 14, reviews: []}, phase || {});
  return s;
}

// ---- fase pelo objetivo ----
check.check("1. Objetivo abaixo = cut, acima = bulk, igual (menos de 0,5 kg) = manutenção", phaseTypeFor(80, 74) === "cut" && phaseTypeFor(70, 78) === "bulk" && phaseTypeFor(70, 70.3) === "manutencao" && phaseTypeFor(0, 70) === "manutencao" && phaseTypeFor(70, 0) === "manutencao");
check.check("2. O escalão do corte: IMC < 25 devagar (A), 25–30 (B), ≥ 30 (C); pouca gordura também é A", cutTierFor({height: 178, sex: "Masculino"}, 70) === "A" && cutTierFor({height: 178, sex: "Masculino"}, 85) === "B" && cutTierFor({height: 178, sex: "Masculino"}, 100) === "C" && cutTierFor({height: 178, sex: "Masculino", assessments: [{date: "2026-01-01", weight: 85, bodyFat: 12}]}, 85) === "A" && cutTierFor({sex: "Masculino"}, 85) === "B");

// ---- calorias de partida e passos ----
check.check("3. Cut começa a −10 % da manutenção (entre 150 e 300 kcal) e bulk a +5 % (entre 100 e 250)", phaseStartKcal("cut", 2700) === 2425 && phaseStartKcal("cut", 1500) === 1350 && phaseStartKcal("cut", 4000) === 3700 && phaseStartKcal("bulk", 2700) === 2825 && phaseStartKcal("bulk", 1500) === 1600 && phaseStartKcal("bulk", 6000) === 6250 && phaseStartKcal("manutencao", 2700) === 2700);
check.check("4. O passo de cada revisão é 5 % da manutenção, entre 100 e 200 kcal, em múltiplos de 25", phaseStepKcal(2700) === 125 && phaseStepKcal(1500) === 100 && phaseStepKcal(5000) === 200 && phaseStepKcal(2650) % 25 === 0);
// o cálculo inicial a partir do peso objetivo já não faz o salto de ~550 kcal
[{sex: "Masculino", weight: 100, height: 180, age: 35, trainingsPerWeek: 4, weightGoal: 85}, {sex: "Feminino", weight: 70, height: 165, age: 30, trainingsPerWeek: 3, weightGoal: 62}, {sex: "Masculino", weight: 130, height: 180, age: 45, trainingsPerWeek: 2, weightGoal: 95}].forEach(function(p, i){
  var t = computeSuggestedTargets(p), maint = Math.round(computeBMR(p.sex, p.weight, p.height, p.age) * activityFromTrainings(p.trainingsPerWeek));
  check.check("5." + (i + 1) + " Perder " + (p.weight - p.weightGoal) + " kg: o défice de partida é pequeno (" + (maint - t.kcal) + " kcal ≤ 300, nunca os 550 de uma vez)", maint - t.kcal <= 305 && maint - t.kcal >= 140);
});
(function(){
  var p = {sex: "Masculino", weight: 70, height: 175, age: 25, trainingsPerWeek: 4, weightGoal: 80}, t = computeSuggestedTargets(p), maint = Math.round(computeBMR(p.sex, p.weight, p.height, p.age) * activityFromTrainings(4));
  check.check("6. Ganhar peso: o excedente de partida é de +100 a +250 kcal", t.kcal - maint >= 95 && t.kcal - maint <= 255 && t.protein === 140);
})();

// ---- a tendência do peso ----
(function(){
  var f = phaseWeightFit(wts(90, -0.5, 28), d(-28), today);
  check.check("7. A regressão encontra a perda de 0,5 kg/semana (e fica ok com 15 pesagens)", Math.abs(f.slopeKgWk + 0.5) < 0.06 && f.ok && f.n >= 14 && f.spanDays === 28 && f.weeks >= 4);
  var many = wts(90, 0, 28).map(function(w, i){ return i === 6 ? {date: w.date, w: 90} : w; });
  check.check("8. Uma pesagem absurda (10 kg a mais) é descartada e não estraga a tendência", Math.abs(phaseWeightFit(many, d(-28), today).slopeKgWk) < 0.1);
  var same = phaseWeightFit([{date: d(-14), w: 80}, {date: d(-14), w: 82}, {date: d(-7), w: 81}, {date: d(-3), w: 81}, {date: d(0), w: 81}], d(-20), today);
  check.check("9. Várias pesagens no mesmo dia contam como uma (a média)", same.n === 4);
  check.check("10. Dados a menos (3 pesagens ou menos de 14 dias) não chegam, mas 3 pesagens em 8 dias servem para o aviso urgente; 2 pesagens não", phaseWeightFit(wts(90, -0.5, 8, 4), d(-8), today).ok === false && phaseWeightFit(wts(90, -0.5, 8, 4), d(-8), today).relaxed === true && phaseWeightFit([], d(-8), today).n === 0 && phaseWeightFit(wts(90, -0.5, 10, 10), d(-10), today).relaxed === false);
})();

// ---- a revisão: cut ----
var maint = computeMaintenanceKcal(stu());
check.check("10b. (o aluno de teste está num cut a ~10 % abaixo da manutenção, escalão B)", CUT < maint && cutTierFor(stu(), 90) === "B");
(function(){
  check.check("11. Sem fase, ou antes da data da revisão, ou adiada, ou aluno inativo/só de estúdio: nada a rever", computePhaseReview(Object.assign(stu(), {nutritionPhase: null}), today) === null && computePhaseReview(stu({weights: wts(90, 0, 28)}, {nextReviewDate: d(3)}), today) === null && computePhaseReview(stu({weights: wts(90, 0, 28)}, {snoozeUntil: d(2)}), today) === null && computePhaseReview(stu({weights: wts(90, 0, 28), active: false}), today) === null && computePhaseReview(stu({weights: wts(90, 0, 28), studioOnly: true}), today) === null);
  var ok = computePhaseReview(stu({weights: wts(90, -0.6, 28)}), today);
  check.check("12. Cut a perder 0,67 %/semana (dentro da banda do escalão B): em linha, sem alterações", ok.kind === "em-linha" && !ok.proposedTargets && !phaseNeedsAttention(ok));
  var stall = computePhaseReview(stu({weights: wts(90, 0, 28)}), today);
  var step = phaseStepKcal(maint);
  check.check("13. Peso estagnado, adesão boa: propõe tirar um passo pequeno (" + step + " kcal), nada de saltos", stall.kind === "ajuste" && stall.deltaKcal === -step && stall.proposedTargets.kcal === CUT - step && phaseNeedsAttention(stall));
  check.check("14. A proposta só mexe nos hidratos (Δkcal/4); proteína e gordura ficam", stall.proposedTargets.carbs === targetsFor(CUT, 160, 75).carbs - Math.round(step / 4) && stall.proposedTargets.protein === 160 && stall.proposedTargets.fat === 75);
  check.check("15. A proposta traz a evidência (tendência em kg/semana, pesagens) e o texto em português", /kg\/semana/.test(stall.evidence) && /pesagens em \d+ dias/.test(stall.evidence) && /reduzir \d+ kcal/.test(stall.text) && stall.band[0] === 0.5);
  var low = computePhaseReview(stu({weights: wts(90, 0, 28), checkins: checkins(4)}), today);
  check.check("16. Estagnado mas a adesão é baixa (4/10): não corta calorias, pede para confirmar a adesão", low.kind === "aderencia" && !low.proposedTargets && /adesão recente é baixa/.test(low.text));
  var hungry = computePhaseReview(stu({weights: wts(90, 0, 28), checkins: checkins(8, 8, 7)}), today);
  check.check("17. Fome alta (8/10): não propõe mais corte; sugere pausa na manutenção", hungry.kind === "limite" && !hungry.proposedTargets && /pausa de 1 semana/.test(hungry.text));
  var fast = computePhaseReview(stu({weights: wts(90, -1.2, 28)}), today);
  check.check("18. Perda rápida demais (1,5 %/semana): propõe subir um passo para proteger a massa magra", fast.kind === "ajuste" && fast.deltaKcal > 0 && fast.deltaKcal <= 300 && /acima/.test(fast.text));
  var urgent = computePhaseReview(stu({weights: wts(90, -1.8, 9, 3)}), today);
  check.check("19. Perda >1,5 %/semana com poucos dias de pesagens: aviso urgente (+300 kcal no máximo), sem esperar pelos 14 dias", urgent.kind === "ajuste" && urgent.urgent === true && urgent.deltaKcal > 0 && urgent.deltaKcal <= 300);
  check.check("20. Dados a menos: não propõe nada e diz o que falta", computePhaseReview(stu({weights: wts(90, 0, 6, 3)}), today).kind === "dados" && /mínimo 4/.test(computePhaseReview(stu({weights: wts(90, 0, 6, 3)}), today).text));
  var short = computePhaseReview(stu({weights: wts(90, -0.3, 16, 2)}, {lastChangeDate: d(-24)}), today);
  check.check("21. Com só 16 dias de pesagens e um desvio pequeno, deixa a decisão para a próxima revisão", short.kind === "em-linha" && /margem de erro/.test(short.text));
  // limites de segurança: teto de défice e piso
  var atCap = computePhaseReview(stu({weights: wts(90, 0, 28), targets: targetsFor(Math.ceil(maint * 0.75 / 25) * 25, 160, 70)}), today);
  check.check("22. No teto do défice do escalão (25 % da manutenção): não corta mais; sugere pausa, mais atividade ou rever o objetivo", atCap.kind === "limite" && !atCap.proposedTargets && /limite de segurança/.test(atCap.text));
  var small = stu({weightCurrent: 55, sex: "Feminino", height: 160, age: 30, weights: wts(55, 0, 28), targets: {kcal: 1330, protein: 110, carbs: 130, fat: 45}}, {startWeight: 55, targetWeight: 50});
  var smallRv = computePhaseReview(small, today);
  check.check("23. Nunca propõe calorias abaixo do piso (BMR e 1200/1500): " + (smallRv.proposedTargets ? smallRv.proposedTargets.kcal : "sem proposta"), !smallRv.proposedTargets || smallRv.proposedTargets.kcal >= Math.ceil(kcalFloorFor("Feminino", computeBMR(small), computeMaintenanceKcal(small))));
  var cum = computePhaseReview(stu({weights: wts(90, 0, 28)}, {reviews: [{date: d(-10), deltaKcal: -200}, {date: d(-20), deltaKcal: -200}]}), today);
  check.check("24. No máximo 400 kcal de alterações em 4 semanas: com 400 já feitas, espera", cum.kind === "limite" && /400/.test(cum.text));
})();

// ---- a creatina não é gordura ----
(function(){
  var rv = computePhaseReview(stu({weights: wts(90, 1, 28)}, {creatineStartDate: d(-5), creatineOn: true}), today);
  check.check("25. Cinco dias depois de começar a creatina, as pesagens dessas semanas são ignoradas e explica porquê (retenção de água)", rv.kind === "dados" && /creatina/.test(rv.text) && /água/.test(rv.text));
  var rv2 = computePhaseReview(stu({weights: wts(90, 0, 40)}, {creatineStartDate: d(-40), creatineOn: true}), today);
  check.check("26. Passadas as 2 semanas de creatina, a revisão volta a usar o peso (só desde esse dia, 26 dias)", rv2.kind !== "dados" && rv2.fit.n >= 10 && rv2.fit.spanDays <= 26 && rv2.fit.spanDays >= 24);
  var rv3 = computePhaseReview(stu({weights: wts(90, 0, 28)}, {lastChangeDate: d(-10)}), today);
  check.check("27. Depois de uma alteração, a primeira semana de pesagens não conta", rv3.fit.spanDays <= 21);
})();

// ---- bulk ----
(function(){
  var b = function(extra, phase){ return stu(Object.assign({targets: targetsFor(BK, 150, 75), weightCurrent: 70, weightInitial: 70, height: 178}, extra), Object.assign({phase: "bulk", startWeight: 70, targetWeight: 78}, phase)); };
  var bm = computeMaintenanceKcal(b());
  var stall = computePhaseReview(b({weights: wts(70, 0, 28)}), today);
  check.check("28. Bulk com o peso parado: propõe acrescentar um passo (100–200 kcal), por exemplo +125", stall.kind === "ajuste" && stall.deltaKcal >= 100 && stall.deltaKcal <= 200 && stall.proposedTargets.kcal === BK + stall.deltaKcal && /acrescentar/.test(stall.text));
  check.check("29. Num bulk os hidratos sobem Δkcal/4 e proteína/gordura ficam", stall.proposedTargets.carbs === targetsFor(BK, 150, 75).carbs + Math.round(stall.deltaKcal / 4) && stall.proposedTargets.protein === 150);
  var capped = computePhaseReview(b({weights: wts(70, 0, 28), targets: targetsFor(Math.floor(bm * 1.15 / 25) * 25, 150, 75)}), today);
  check.check("30. No teto do excedente (+15 %): não sobe mais; manda verificar adesão, proteína, treino e sono", capped.kind === "limite" && /teto do excedente/.test(capped.text));
  var inBand = computePhaseReview(b({weights: wts(70, 0.25, 28)}), today);
  check.check("31. Ganhar 0,36 %/semana (banda 0,25–0,5): em linha", inBand.kind === "em-linha");
  var tooFast = computePhaseReview(b({weights: wts(70, 0.8, 28)}), today);
  check.check("32. Ganhar 1,1 %/semana (demais): propõe reduzir para limitar a gordura", tooFast.kind === "ajuste" && tooFast.deltaKcal < 0 && /reduzir/.test(tooFast.text));
  var adv = computePhaseReview(b({weights: wts(70, 0.15, 28)}), today);
  var adv2 = computePhaseReview(b({weights: wts(70, 0.15, 28)}, {level: "avancado"}), today);
  check.check("33. Em avançados a banda é mais baixa (0,10–0,25): o mesmo ritmo que num novato pede mais calorias, num avançado está em linha", adv.kind === "ajuste" && adv2.kind === "em-linha" && adv2.band[0] === 0.10);
  var lowAdh = computePhaseReview(b({weights: wts(70, 0, 28), checkins: checkins(3)}), today);
  check.check("34. Bulk parado com adesão baixa: não sobe calorias", lowAdh.kind === "aderencia");
})();

// ---- objetivo atingido, manutenção ----
(function(){
  var done = stu({weightCurrent: 82.2, weights: wts(86, -0.9, 28)}, {targetWeight: 82.5});
  var rv = computePhaseReview(done, today);
  check.check("35. Chegou ao peso objetivo (±0,3 kg): propõe passar à manutenção (em 2 passos se havia défice)", rv.kind === "objetivo" && /chegou ao peso objetivo/.test(rv.text) && rv.exiting === true && rv.proposedTargets.kcal > CUT && rv.proposedTargets.kcal < computeMaintenanceKcal(done));
  var res = applyPhaseReview(done, rv);
  check.check("36. Ao aplicar passa a manutenção, marca a saída em curso e agenda a revisão para daí a 7 dias", !res.error && done.nutritionPhase.phase === "manutencao" && done.nutritionPhase.exiting === true && done.nutritionPhase.nextReviewDate === d(7));
  done.nutritionPhase.nextReviewDate = d(0); done.weights = done.weights.concat([{date: d(0), w: 82}]);
  var rv2 = computePhaseReview(done, today);
  check.check("37. Na revisão seguinte completa a saída: calorias de manutenção", rv2.kind === "ajuste" && rv2.completesExit === true && rv2.proposedTargets.kcal === computeMaintenanceKcal(done));
  applyPhaseReview(done, rv2);
  check.check("38. E a saída fica concluída", done.nutritionPhase.exiting === false && done.targets.kcal === computeMaintenanceKcal(done));
  var bulkDone = stu({weightCurrent: 77.9, weights: wts(75, 0.9, 28), height: 178, targets: targetsFor(BK, 150, 75)}, {phase: "bulk", targetWeight: 78});
  check.check("39. No bulk, chegar ao peso objetivo propõe a manutenção diretamente", computePhaseReview(bulkDone, today).kind === "objetivo");
  var drift = computePhaseReview(stu({weights: wts(90, 0.9, 28), targets: targetsFor(maint, 160, 75)}, {phase: "manutencao", targetWeight: null}), today);
  check.check("40. Na manutenção, uma subida de ≥ 0,25 %/semana durante 3 semanas propõe retirar 100 kcal", drift.kind === "ajuste" && drift.deltaKcal === -100);
  var steady = computePhaseReview(stu({weights: wts(90, 0.05, 28), targets: targetsFor(maint, 160, 75)}, {phase: "manutencao", targetWeight: null}), today);
  check.check("41. Manutenção estável: em linha", steady.kind === "em-linha");
})();

// ---- aplicar com um OK ----
(function(){
  var s = stu({weights: wts(90, 0, 28)});
  autoAdjustPlanQuantities(s); // o plano do aluno já bate com os alvos atuais
  var before = s.meals.reduce(function(a, m){ return a + foodsTotals(m.foods).kcal; }, 0), snapshot = JSON.stringify(s.meals);
  var rv = computePhaseReview(s, today);
  authRole = "student";
  var denied = applyPhaseReview(s, rv);
  authRole = "professional";
  check.check("42. Um aluno não consegue aplicar (só o profissional)", !!denied.error && s.targets.kcal === CUT && JSON.stringify(s.meals) === snapshot);
  var r = applyPhaseReview(s, rv);
  var after = s.meals.reduce(function(a, m){ return a + foodsTotals(m.foods).kcal; }, 0);
  check.check("43. O OK aplica os alvos novos de uma vez (calorias e hidratos)", !r.error && s.targets.kcal === rv.proposedTargets.kcal && s.targets.carbs === rv.proposedTargets.carbs && s.targets.protein === 160 && s.fromOnboarding === false && r.from === CUT && r.to === s.targets.kcal);
  check.check("44. …e reajusta as quantidades do plano do aluno sozinho (as refeições passam a somar menos ~" + Math.abs(rv.deltaKcal) + " kcal, como o alvo)", r.changed > 0 && JSON.stringify(s.meals) !== snapshot && after < before && Math.abs((after - before) - rv.deltaKcal) < 90);
  var np = s.nutritionPhase;
  check.check("45. A fase regista a revisão: etapa 1, última alteração hoje, próxima revisão daí a 14 dias, défice em % e o histórico", np.stage === 1 && np.lastChangeDate === today && np.nextReviewDate === d(14) && np.deficitPct < 0 && np.reviews.length === 1 && np.reviews[0].deltaKcal === rv.deltaKcal && np.reviews[0].kind === "ajuste");
  check.check("46. O histórico do plano guarda a revisão e as alterações de calorias", s.planHistory.some(function(e){ return e.type === "fase_revisao" && /Revisão Cut/.test(e.summary); }) && s.planHistory.some(function(e){ return e.type === "kcal"; }));
  check.check("47. Logo a seguir não há nova proposta (a revisão só volta daí a 14 dias)", computePhaseReview(s, today) === null);
  check.check("48. Uma revisão sem alterações (aderência) não se pode «aplicar»", !!applyPhaseReview(stu({weights: wts(90, 0, 28), checkins: checkins(3)}), computePhaseReview(stu({weights: wts(90, 0, 28), checkins: checkins(3)}), today)).error);
  var p = stu({weights: wts(90, 0, 28)});
  postponePhaseReview(p, 7);
  check.check("49. Adiar 7 dias esconde a proposta e não mexe no plano", p.nutritionPhase.snoozeUntil === d(7) && computePhaseReview(p, today) === null && p.targets.kcal === CUT && computePhaseReview(p, d(7)).kind === "ajuste");
})();

// ---- definir a fase ----
(function(){
  var s = stu({weightGoal: 82, weights: [], supplements: []});
  s.nutritionPhase = null;
  var r = startPhase(s, {type: "cut", targetWeight: 82, every: 21, applyStart: true});
  var mt = computeMaintenanceKcal(s);
  check.check("50. Definir a fase com calorias de partida: alvos de partida gradual, objetivo, intervalo de 21 dias e plano reajustado", !r.error && s.nutritionPhase.phase === "cut" && s.targets.kcal === phaseStartKcal("cut", mt) && s.weightGoal === 82 && s.nutritionPhase.reviewEveryDays === 21 && s.nutritionPhase.nextReviewDate === d(21) && s.nutritionPhase.stage === 0 && r.changed > 0);
  check.check("51. Como a creatina é nova, fica marcado o início (a revisão ignora a água dos primeiros dias)", s.nutritionPhase.creatineStartDate === today && s.nutritionPhase.creatineOn === true);
  var s2 = stu({supplements: ["Creatina"]}); s2.nutritionPhase = null;
  startPhase(s2, {type: "bulk", targetWeight: 98, applyStart: false, level: "avancado"});
  check.check("52. Sem aplicar a partida, os alvos ficam (a fase ancora-se neles); avançado revê de 28 em 28 dias", s2.targets.kcal === CUT && s2.nutritionPhase.level === "avancado" && s2.nutritionPhase.reviewEveryDays === 28);
  check.check("53. …e a creatina que o aluno já tomava não gera período de adaptação", !s2.nutritionPhase.creatineStartDate);
  var s3 = stu({weightGoal: 90, weightCurrent: 80, targets: {kcal: 2800, protein: 160, carbs: 330, fat: 75}}); s3.nutritionPhase = null;
  setPhaseFromGoal(s3);
  check.check("54. O peso objetivo define a fase sozinho (80 → 90 kg = bulk) com as calorias atuais como partida", s3.nutritionPhase.phase === "bulk" && s3.nutritionPhase.targetWeight === 90 && s3.nutritionPhase.startWeight === 80 && s3.nutritionPhase.deficitPct > 0);
  var s4 = stu({weightGoal: 70, weightCurrent: 80}); s4.nutritionPhase = null; setPhaseFromGoal(s4);
  var s5 = stu({weightGoal: 80.2, weightCurrent: 80}); s5.nutritionPhase = null; setPhaseFromGoal(s5);
  var s6 = stu({weightGoal: null}); s6.nutritionPhase = null; setPhaseFromGoal(s6);
  check.check("55. 80 → 70 kg = cut; 80 → 80,2 kg = manutenção; sem peso objetivo não define fase", s4.nutritionPhase.phase === "cut" && s5.nutritionPhase.phase === "manutencao" && s6.nutritionPhase === null);
  authRole = "student"; var den = startPhase(stu(), {type: "cut", targetWeight: 70}); authRole = "professional";
  check.check("56. Um aluno não consegue iniciar uma fase", !!den.error);
})();

// ---- ecrãs ----
(function(){
  var a = stu({name: "Ana <img src=x onerror=alert(1)>", weights: wts(90, 0, 28)}), b = stu({id: "p2", name: "Rui", weights: wts(90, -0.6, 28)});
  var saved = STUDENTS; STUDENTS = [a, b];
  var list = collectPhaseReviews(today), html = tplPhaseReviews();
  check.check("57. Só aparecem os alunos que pedem atenção (o que está em linha não aparece)", list.length === 1 && list[0].student.id === "p1" && (html.match(/data-phase-review/g) || []).length === 1);
  check.check("58. O cartão do painel mostra o nome sem executar HTML e a sugestão em kcal", html.indexOf("<img") < 0 && /&lt;img/.test(html) && /kcal\/dia sugeridas/.test(html) && /Revisões de plano · 1/.test(html));
  STUDENTS = [b]; check.check("59. Sem revisões à espera, o cartão não aparece", tplPhaseReviews() === "");
  STUDENTS = saved;
  var panel = tplPhasePanel(stu({weights: wts(90, 0, 28)}));
  check.check("60. O painel da Nutrição mostra fase, objetivo, calorias face à manutenção, a evidência e os botões", /Cut/.test(panel) && /82 kg/.test(panel) && /da manutenção de/.test(panel) && /kg\/semana/.test(panel) && /id="phaseReviewNow"/.test(panel) && /id="phaseStart"/.test(panel));
  var none = stu(); none.nutritionPhase = null;
  check.check("61. Sem fase, o painel convida a defini-la", /Sem fase definida/.test(tplPhasePanel(none)) && /id="phaseStart"/.test(tplPhasePanel(none)) && tplProPlano(none).indexOf("phaseCard") > 0);
})();

// ---- guardar ----
(function(){
  var s = stu({weights: wts(90, 0, 28)}), row = studentToRow(s);
  check.check("62. A fase vai na coluna nutrition_phase e volta igual", row.nutrition_phase.phase === "cut" && rowToStudent(Object.assign({id: "p1"}, row)).nutritionPhase.targetWeight === 82);
})();
check.summarize();
