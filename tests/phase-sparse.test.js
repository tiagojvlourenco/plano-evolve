// Revisão automática com avaliações profissionais espaçadas (4–6 semanas): 3+ avaliações, 28 dias da primeira à última, janela de 84 dias,
// última com 42 dias ou menos; o ritmo da reta e o do último intervalo têm de sair da banda no mesmo sentido; sem adesão fiável não se corta;
// a avaliação do momento da alteração é o ponto de partida; sem avaliação nova a revisão não se repete. O plano nunca muda sozinho.
require("./setup")();
eval(require("./extract-app")());
var check = require("./check")();
var store = {};
global.localStorage = {getItem: function(k){ return k in store ? store[k] : null; }, setItem: function(k, v){ store[k] = String(v); }, removeItem: function(k){ delete store[k]; }};
sbReady = false; authRole = "professional";
var today = localTodayISO();
function d(n){ return addDaysISO(today, n); }
var BASE = {sex: "Masculino", age: 35, height: 178, trainingsPerWeek: 3};
var M90 = computeMaintenanceKcal(Object.assign({weightCurrent: 90}, BASE)), CUT = Math.round(M90 * 0.9 / 25) * 25;
function good(){ var l = []; for (var i = 3; i >= 1; i--) l.push({date: d(-i * 7), adherence: 8, hunger: 4, energy: 7}); return l; }
// pts: [[diasAtrás, kg], ...] (avaliações do profissional: avaliação + weights, como a app grava)
function stu(pts, o){
  o = o || {};
  var first = pts.length ? pts[0][0] : 0, s = Object.assign({id: "sp", name: "Teste", sex: "Masculino", age: 35, height: 178, weightCurrent: 90, weightInitial: 90, weights: [], assessments: [], checkins: o.checkins || [],
    trainingsPerWeek: 3, active: true, planHistory: [], blockedFoods: [], flexibility: 50, meals: [], targets: {kcal: CUT, protein: 160, carbs: Math.round((CUT - 640 - 675) / 4), fat: 75}});
  pts.forEach(function(p){ s.weights.push({date: d(-p[0]), w: p[1]}); s.assessments.push({date: d(-p[0]), weight: p[1]}); s.weightCurrent = p[1]; });
  var change = o.change != null ? o.change : first;
  s.nutritionPhase = Object.assign({phase: o.phase || "cut", startDate: d(-(o.start != null ? o.start : first)), startWeight: 90, targetWeight: o.target || 82, level: "novato", stage: 0, lastChangeDate: d(-change), lastReviewDate: null, nextReviewDate: d(-1), reviewEveryDays: 28, reviews: []}, o.np || {});
  return s;
}
function R(pts, o){ return computePhaseReview(stu(pts, o), today); }
var noAdjust = function(r){ return r && !r.proposedTargets && r.deltaKcal === 0; };

// ---- avaliações a cada 4, 5 e 6 semanas, abaixo da banda, com adesão fiável: propõe reduzir ----
(function(){
  var a = R([[84, 90], [56, 89], [28, 88], [0, 87]], {checkins: good()});
  check.check("1. Avaliações a cada 4 semanas, ritmo abaixo da banda (confirmado no último intervalo): propõe reduzir", a.kind === "ajuste" && a.deltaKcal < 0 && a.proposedTargets && a.evidenceState === "suficiente-espaçadas" && a.fit.sparse === true);
  var b = R([[70, 90], [35, 88.4], [0, 86.8]], {checkins: good()});
  check.check("2. Avaliações a cada 5 semanas (3 pontos, 70 dias): propõe reduzir", b.kind === "ajuste" && b.deltaKcal < 0 && b.fit.n === 3 && b.fit.spanDays === 70);
  var c = R([[84, 90], [42, 88.5], [0, 87]], {checkins: good()});
  check.check("3. Avaliações a cada 6 semanas (3 pontos, 84 dias): propõe reduzir", c.kind === "ajuste" && c.deltaKcal < 0 && c.fit.spanDays === 84);
  check.check("4. As propostas são só propostas: os alvos do aluno não mudam", (function(){ var s = stu([[84, 90], [56, 89], [28, 88], [0, 87]], {checkins: good()}), before = JSON.stringify(s.targets); var r = computePhaseReview(s, today); return r.proposedTargets && JSON.stringify(s.targets) === before; })());
})();

// ---- tendência consistente dentro da banda e acima da banda ----
(function(){
  var ok = R([[84, 90], [56, 88], [28, 86], [0, 84]], {checkins: good()});
  check.check("5. Evolução consistente dentro da banda: em linha, nada a alterar", ok.kind === "em-linha" && noAdjust(ok));
  var fast = R([[84, 90], [56, 86], [28, 82]], {checkins: good(), target: 70});
  check.check("6. Perda consistente acima da banda: propõe SUBIR calorias um passo (sem exigir adesão)", fast.kind === "ajuste" && fast.deltaKcal > 0 && fast.deltaKcal <= 300);
})();

// ---- dados insuficientes / em observação / desatualizados ----
(function(){
  var one = R([[0, 90]]), two = R([[20, 90], [0, 89]], {start: 20}), three = R([[24, 90], [12, 89.5], [0, 89]], {start: 24});
  check.check("7. Uma só avaliação: dados insuficientes, nada proposto", one.kind === "dados" && one.evidenceState === "insuficiente" && noAdjust(one) && /uma pesagem/.test(one.text));
  check.check("8. Duas avaliações com menos de 21 dias: dados insuficientes", two.kind === "dados" && two.evidenceState === "insuficiente" && noAdjust(two));
  check.check("9. Três avaliações mas só 24 dias: tendência em observação, sem propor", three.kind === "dados" && three.evidenceState === "observacao" && noAdjust(three));
  var obs = R([[35, 90], [0, 88.5]], {start: 35});
  check.check("10. Duas avaliações a 35 dias: «tendência em observação», com a variação, sem propor", obs.kind === "dados" && obs.evidenceState === "observacao" && /Tendência em observação/.test(obs.text) && /-1,5|−1,5/.test(obs.text) && noAdjust(obs));
  var stale = R([[110, 90], [84, 89], [60, 88]], {start: 110, change: 110});
  check.check("11. Última avaliação há 60 dias: desatualizado — não é estagnação nem falta de adesão", stale.kind === "dados" && stale.evidenceState === "desatualizado" && noAdjust(stale) && /não indica estagnação nem falta de adesão/.test(stale.text) && !/estagnad[ao]/.test(stale.text));
  check.check("12. Sem avaliações: mensagem clara", R([]).text === WEIGHT_MISSING_TEXT);
})();

// ---- variação isolada, ponto discrepante, suspeitos ----
(function(){
  var iso = R([[84, 90], [56, 89.5], [28, 89], [0, 85]], {checkins: good()});
  check.check("13. Variação isolada no último intervalo (a reta e o último intervalo discordam): em observação, sem propor", iso.kind === "dados" && noAdjust(iso) && /último intervalo/.test(iso.text));
  var out = R([[84, 90], [56, 89], [28, 95], [0, 88]], {checkins: good()});
  check.check("14. Um ponto discrepante (+6 kg) não sustenta recomendação: pede para confirmar o peso", out.kind === "dados" && noAdjust(out) && /suspeita/.test(out.text));
  var jump = R([[84, 90], [56, 89], [28, 70], [0, 69]], {checkins: good()});
  check.check("15. Um salto impossível entre avaliações também é suspeito", jump.kind === "dados" && noAdjust(jump));
})();

// ---- alteração de calorias a meio do período ----
(function(){
  var s = stu([[84, 92], [56, 90], [40, 91], [29, 90], [14, 89.5], [0, 89]], {change: 28, start: 84, checkins: good()});
  var r = computePhaseReview(s, today);
  check.check("16. Só contam as avaliações a partir da alteração (e a de 1 dia antes como ponto de partida): 3 pontos", r.fit.sparse === true && r.fit.n === 3 && r.fit.pts[0].date === d(-29) && r.fit.pts.every(function(p){ return p.date >= d(-29); }));
  var onlyTwo = stu([[84, 92], [56, 90], [28, 88], [0, 87.5]], {change: 28, start: 84, checkins: good()});
  var r2 = computePhaseReview(onlyTwo, today);
  check.check("17. A avaliação do dia da alteração é o ponto de partida: com só 2 pontos desde então, em observação", r2.kind === "dados" && r2.evidenceState === "observacao" && noAdjust(r2) && r2.progress.n === 4);
  var older = stu([[84, 92], [40, 91], [10, 89]], {change: 28, start: 84, checkins: good()});
  check.check("18. Uma avaliação de 12 dias antes da alteração não é o ponto de partida", computePhaseReview(older, today).evidenceState !== "suficiente");
})();

// ---- não repetir a revisão sem avaliação nova ----
(function(){
  var pts = [[84, 90], [56, 89], [28, 88], [0, 87]];
  check.check("19. Revisão já feita depois da última avaliação: não volta a aparecer", R(pts, {checkins: good(), np: {lastReviewDate: d(0)}}) === null);
  var s = stu(pts, {checkins: good()});
  phaseColumnAvailable = true; postponePhaseReview(s, 7);
  check.check("20. Adiar guarda a última avaliação vista", s.nutritionPhase.seenWeighInDate === d(0));
  var later = addDaysISO(today, 8);
  check.check("21. Passado o adiamento, sem avaliação nova, não se repete como informação nova", computePhaseReview(s, later) === null || computePhaseReview(s, later).kind === "dados");
  var s2 = stu(pts, {checkins: good()}); phaseColumnAvailable = true; postponePhaseReview(s2, 7);
  s2.weights.push({date: d(0), w: 87}); // mesma avaliação
  check.check("22. A mesma avaliação não conta como nova", computePhaseReview(s2, later) === null || computePhaseReview(s2, later).kind !== "ajuste");
})();

// ---- adesão ----
(function(){
  var pts = [[84, 90], [56, 89], [28, 88], [0, 87]];
  var none = R(pts), old = R(pts, {checkins: [{date: d(-60), adherence: 9, hunger: 4, energy: 7}, {date: d(-67), adherence: 9, hunger: 4, energy: 7}]});
  check.check("23. Abaixo da banda sem dados de adesão: não reduz calorias, avisa o PT para confirmar", none.kind === "aderencia" && noAdjust(none) && /não há dados fiáveis de adesão/.test(none.text) && /Não sugiro reduzir/.test(none.text));
  check.check("24. Check-ins muito antigos (60+ dias) também não são dados fiáveis", old.kind === "aderencia" && noAdjust(old));
  var low = R(pts, {checkins: [{date: d(-14), adherence: 3, hunger: 4, energy: 7}, {date: d(-7), adherence: 4, hunger: 4, energy: 7}]});
  check.check("25. Adesão fiável mas baixa: mantém o aviso de adesão (regra de sempre)", low.kind === "aderencia" && noAdjust(low) && /adesão recente é baixa/.test(low.text));
  var ok = R(pts, {checkins: good()});
  check.check("26. Adesão fiável e boa: propõe reduzir", ok.kind === "ajuste" && ok.deltaKcal < 0);
  var bulk = R([[84, 70], [56, 70], [28, 70.1], [0, 70]], {phase: "bulk", target: 75});
  check.check("27. O aviso de adesão é só para reduzir calorias (cut); no bulk o passo de subir mantém-se", bulk.kind !== "aderencia");
})();

// ---- aviso urgente: só com 3+ avaliações e confirmado ----
(function(){
  var early = {np: {nextReviewDate: d(14)}, checkins: good()};
  var urgent = R([[56, 90], [28, 84], [0, 78]], early);
  check.check("28. Perda demasiado rápida confirmada em 3 avaliações: aviso urgente (+calorias) antes da data da revisão", urgent.kind === "ajuste" && urgent.urgent === true && urgent.deltaKcal > 0 && urgent.deltaKcal <= 300);
  var two = R([[28, 90], [0, 84]], Object.assign({start: 28}, early));
  check.check("29. Com só 2 avaliações não há aviso urgente (nem revisão antes da data)", two === null);
  var contra = R([[56, 90], [28, 84], [0, 83.5]], early);
  check.check("30. Se o último intervalo não confirma a rapidez, não há aviso urgente", !(contra && contra.urgent));
  var notDue = R([[84, 90], [56, 89], [28, 88], [0, 87]], early);
  check.check("31. Fora do urgente, antes da data da revisão não aparece nada", notDue === null);
})();

// ---- regressão: pesagens frequentes ----
(function(){
  var pts = []; for (var i = 28; i >= 0; i -= 2) pts.push([i, Math.round((90 - 0.2 * (28 - i) / 7) * 10) / 10]);
  var r = R(pts, {checkins: good(), start: 35, change: 35});
  check.check("32. Pesagens frequentes (a cada 2 dias, 28 dias): a regra de sempre, sem ser a via espaçada", r.fit.ok && !r.fit.sparse && r.evidenceState === "suficiente" && r.kind === "ajuste" && r.deltaKcal < 0);
  var few = []; for (var j = 10; j >= 0; j -= 5) few.push([j, 90]);
  var rf = R(few, {start: 10, change: 10});
  check.check("33. Poucas pesagens seguidas continuam a não dar proposta", rf.kind === "dados" && noAdjust(rf));
})();

// ---- manutenção ----
(function(){
  var drift = R([[84, 80], [56, 81], [28, 82.1], [0, 83.2]], {phase: "manutencao", checkins: good(), target: 80});
  check.check("34. Manutenção com deriva consistente em todos os intervalos: propõe retirar calorias", drift.kind === "ajuste" && drift.deltaKcal < 0);
  var mix = R([[84, 80], [56, 81.2], [28, 82.4], [0, 82.6]], {phase: "manutencao", checkins: good(), target: 80});
  check.check("35. Manutenção em que o último intervalo não confirma: em observação", mix.kind === "dados" && noAdjust(mix) && /último intervalo/.test(mix.text));
})();
check.summarize();
