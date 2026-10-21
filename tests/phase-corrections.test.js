// Correções finais da revisão de fase: pesagem discrepante nunca descartada em silêncio, 7 dias entre a avaliação vista e a nova (nas duas vias),
// adiamento que não reaparece sem informação nova, «Rever agora» sem avaliação nova, pesagens futuras, fome/energia com janela de 42 dias e desde a
// última alteração, confirmação profissional da adesão (cumprida · parcial · não cumprida) e reduções de calorias só com adesão confirmada.
require("./setup")();
eval(require("./extract-app")());
var check = require("./check")();
var store = {};
global.localStorage = {getItem: function(k){ return k in store ? store[k] : null; }, setItem: function(k, v){ store[k] = String(v); }, removeItem: function(k){ delete store[k]; }};
sbReady = false; authRole = "professional"; phaseColumnAvailable = true;
var today = localTodayISO();
function d(n){ return addDaysISO(today, n); }
var BASE = {sex: "Masculino", age: 35, height: 178, trainingsPerWeek: 3};
var M90 = computeMaintenanceKcal(Object.assign({weightCurrent: 90}, BASE)), CUT = Math.round(M90 * 0.9 / 25) * 25;
var M70 = computeMaintenanceKcal(Object.assign({weightCurrent: 70}, BASE)), BULK = Math.round(M70 * 1.05 / 25) * 25;
var M80 = computeMaintenanceKcal(Object.assign({weightCurrent: 80}, BASE));
function ck(adh, hunger, energy, days){ return days.map(function(n){ return {date: d(-n), adherence: adh, hunger: hunger, energy: energy}; }); }
function good(){ return ck(8, 4, 7, [21, 14, 7]); }
function stu(pts, o){
  o = o || {};
  var first = pts.length ? pts[0][0] : 0;
  var s = {id: "pc", name: "Teste", sex: "Masculino", age: 35, height: 178, weightCurrent: 90, weightInitial: 90, weights: [], assessments: [], checkins: o.checkins || [],
    trainingsPerWeek: 3, active: true, planHistory: [], blockedFoods: [], flexibility: 50, meals: []};
  var kcal = o.kcal || (o.phase === "bulk" ? BULK : o.phase === "manutencao" ? M80 : CUT);
  s.targets = {kcal: kcal, protein: 160, carbs: Math.round((kcal - 640 - 675) / 4), fat: 75};
  pts.forEach(function(p){ s.weights.push({date: d(-p[0]), w: p[1]}); s.assessments.push({date: d(-p[0]), weight: p[1]}); s.weightCurrent = p[1]; });
  var change = o.change != null ? o.change : first;
  s.nutritionPhase = Object.assign({phase: o.phase || "cut", startDate: d(-(o.start != null ? o.start : first)), startWeight: 90, targetWeight: o.target || (o.phase === "bulk" ? 80 : o.phase === "manutencao" ? 80 : 82), level: "novato", stage: 0, lastChangeDate: d(-change), lastReviewDate: null, nextReviewDate: d(-1), reviewEveryDays: 28, reviews: []}, o.np || {});
  return s;
}
var noAdjust = function(r){ return r && !r.proposedTargets && r.deltaKcal === 0; };
var SPARSE = [[84, 90], [56, 89], [28, 88], [0, 87]];   // abaixo da banda do cut, a cada 4 semanas

// ---- 1. pesagem discrepante: fica no histórico, bloqueia a proposta, com 4, 5 e mais avaliações ----
(function(){
  var cases = [
    ["4 avaliações", [[84, 90], [56, 89], [28, 95], [0, 88]], d(-28)],
    ["5 avaliações", [[84, 90], [63, 89.3], [42, 95], [21, 88], [0, 87.3]], d(-42)],
    ["7 avaliações", [[84, 90], [70, 89.6], [56, 89.1], [42, 95.2], [28, 88.4], [14, 88], [0, 87.5]], d(-42)]
  ];
  cases.forEach(function(c){
    var s = stu(c[1], {checkins: good()}), n = s.weights.length, r = computePhaseReview(s, today);
    check.check("1. " + c[0] + " com um ponto de +6 kg: peso suspeito, nenhuma proposta de calorias", r.kind === "dados" && r.evidenceState === "suspeita" && noAdjust(r) && /suspeita/.test(r.text));
    check.check("1. " + c[0] + ": a mensagem diz qual é a pesagem e que fica no histórico", r.suspect && r.suspect.date === c[2] && r.text.indexOf(fmtDateFullPt(c[2])) >= 0 && /fica no histórico/.test(r.text));
    check.check("1. " + c[0] + ": a pesagem continua nos dados (nada foi apagado nem descartado)", s.weights.length === n && s.weights.some(function(w){ return w.date === c[2] && w.w > 94; }));
  });
  var fixed = stu([[84, 90], [63, 89.3], [42, 88.7], [21, 88], [0, 87.3]], {checkins: good()}), rf = computePhaseReview(fixed, today);
  check.check("1. Corrigida a pesagem, a revisão volta a propor (o bloqueio era só por ela)", rf.kind === "ajuste" && rf.deltaKcal < 0);
})();

// ---- 2. avaliação repetida ou a menos de 7 dias depois da vista: não reabre a decisão ----
(function(){
  var s = stu(SPARSE, {checkins: good()}); postponePhaseReview(s, 7);
  check.check("2. O adiamento guarda a avaliação vista (a última válida)", s.nutritionPhase.seenWeighInDate === d(0));
  var plus = function(n, w){ var c = stu(SPARSE, {checkins: good()}); postponePhaseReview(c, 7); c.weights.push({date: d(n), w: w}); c.assessments.push({date: d(n), weight: w}); return computePhaseReview(c, d(n)); };
  check.check("2. Uma avaliação 1 dia depois (repetição): não reaparece", plus(1, 86.9) === null);
  check.check("2. Mesmo peso repetido 3 dias depois: não reaparece", plus(3, 87) === null);
  check.check("2. Uma avaliação 6 dias depois: ainda não", plus(6, 86.5) === null);
  var ok = plus(7, 86.4);
  check.check("2. Uma avaliação 7 dias depois da vista: reavalia", !!ok && ok.kind !== "sem-novidade" && ok.evidenceState === "suficiente-espaçadas");
  // aplicada: o mesmo
  var a = stu(SPARSE, {checkins: good()}), rv = computePhaseReview(a, today); applyPhaseReview(a, rv);
  check.check("2. Aplicar guarda a avaliação vista e limpa a confirmação anterior", a.nutritionPhase.seenWeighInDate === d(0) && a.nutritionPhase.adherenceConfirmed === null);
  a.weights.push({date: d(3), w: 86.8});
  check.check("2. Depois de aplicar, uma avaliação 3 dias depois não reabre a decisão", computePhaseReview(a, d(40)) === null);
})();

// ---- 3. adiamento também nas pesagens frequentes (15 pesagens em 28 dias) ----
(function(){
  var pts = []; for (var i = 28; i >= 0; i -= 2) pts.push([i, Math.round((90 - 0.2 * (28 - i) / 7) * 10) / 10]);
  var base = stu(pts, {checkins: good(), start: 35, change: 35}), r0 = computePhaseReview(base, today);
  check.check("3. 15 pesagens em 28 dias, sem adiar: a proposta de sempre (via frequente)", pts.length === 15 && r0.fit.ok && !r0.fit.sparse && r0.kind === "ajuste" && r0.deltaKcal < 0);
  var s = stu(pts, {checkins: good(), start: 35, change: 35}); postponePhaseReview(s, 7);
  check.check("3. Adiada: escondida durante o adiamento", computePhaseReview(s, d(3)) === null);
  check.check("3. Passado o adiamento, sem pesagem nova, não reaparece", computePhaseReview(s, d(8)) === null);
  s.weights.push({date: d(5), w: 89.9});
  check.check("3. Uma pesagem 5 dias depois da vista ainda não reabre", computePhaseReview(s, d(8)) === null);
  s.weights.push({date: d(7), w: 89.9}); s.weights.push({date: d(8), w: 89.8});
  var back = computePhaseReview(s, d(8));
  check.check("3. Com pesagens 7+ dias depois da vista, volta (via frequente)", !!back && back.kind !== "sem-novidade");
})();

// ---- 4. «Rever agora» sem avaliação nova ----
(function(){
  var s = stu(SPARSE, {checkins: good()}); postponePhaseReview(s, 7);
  var f = computePhaseReview(s, today, {force: true});
  check.check("4. «Rever agora» sem avaliação nova: devolve a fase (não null) com a mensagem certa", !!f && f.kind === "sem-novidade" && f.text === "Sem avaliação nova desde a última revisão.");
  check.check("4. …não pede atenção, não propõe nada e preserva o painel de evidência", !phaseNeedsAttention(f) && noAdjust(f) && f.evidence.length > 0);
  check.check("4. Sem fase definida continua a ser null", computePhaseReview({id: "x", name: "x", active: true, targets: {kcal: 2000}, weights: []}, today, {force: true}) === null);
  check.check("4. O automático (sem force) continua a não mostrar nada", computePhaseReview(s, today) === null);
})();

// ---- 5. pesagem com data futura ----
(function(){
  var s = stu(SPARSE, {checkins: good()}); s.weights.push({date: d(20), w: 80}); s.assessments.push({date: d(20), weight: 80});
  postponePhaseReview(s, 7);
  check.check("5. A pesagem futura não é a «última vista» (conta a de hoje)", s.nutritionPhase.seenWeighInDate === d(0));
  check.check("5. …e continua no histórico", s.weights.some(function(w){ return w.date === d(20); }));
  s.weights.push({date: d(8), w: 86.5}); s.assessments.push({date: d(8), weight: 86.5});
  var r = computePhaseReview(s, d(8));
  check.check("5. Uma revisão legítima 8 dias depois não fica bloqueada pela pesagem futura", !!r && r.kind !== "sem-novidade");
  check.check("5. A pesagem futura não entra na análise de hoje", latestWeighInDate(s, today) === d(0) && weightProgress(s, today).last.date === d(0));
})();

// ---- B. fome e energia: 42 dias, desde a última alteração, sem dados ≠ normal ----
(function(){
  var recentHigh = [{date: d(-10), adherence: 8, hunger: 9, energy: 6}, {date: d(-5), adherence: 8, hunger: 9, energy: 6}];
  var oldLow = [{date: d(-300), adherence: 8, hunger: 3, energy: 8}, {date: d(-290), adherence: 8, hunger: 3, energy: 8}];
  var r = computePhaseReview(stu(SPARSE, {checkins: oldLow.concat(recentHigh)}), today);
  check.check("B. Fome alta recente + fome baixa antiga: os antigos não escondem o sinal — não propõe mais corte", r.kind === "limite" && noAdjust(r) && /fome está alta/.test(r.text));
  var rOld = computePhaseReview(stu(SPARSE, {checkins: [{date: d(-300), adherence: 8, hunger: 9, energy: 2}, {date: d(-290), adherence: 8, hunger: 9, energy: 2}].concat(ck(8, 4, 7, [14, 7]))}), today);
  check.check("B. Fome alta antiga (há mais de 42 dias) não trava a proposta atual", rOld.kind === "ajuste" && rOld.deltaKcal < 0);
  var pre = computePhaseReview(stu(SPARSE, {change: 28, start: 84, checkins: ck(8, 9, 2, [40, 35]).concat(ck(8, 4, 7, [21, 14, 7]))}), today);
  check.check("B. Check-ins anteriores à última alteração de calorias não contam para a fase atual", pre.evidenceState !== "x" && phaseHungerEnergy(stu(SPARSE, {change: 28, start: 84, checkins: ck(8, 9, 2, [40, 35]).concat(ck(8, 4, 7, [21, 14, 7]))}), stu(SPARSE, {change: 28}).nutritionPhase, today).hunger === 4);
  var unk = computePhaseReview(stu(SPARSE, {checkins: ck(8, 0, 0, [21, 14, 7])}), today);
  check.check("B. Adesão fiável mas sem fome/energia preenchidas: propõe com um aviso (falta de dados ≠ sem fome)", unk.kind === "ajuste" && unk.warnings.some(function(w){ return /Sem registos recentes de fome e energia/.test(w.text); }));
  var sOld = { goal: "x", checkins: [{date: d(-100), adherence: 9, hunger: 2, energy: 9}, {date: d(-90), adherence: 9, hunger: 2, energy: 9}] };
  check.check("B. O indicador de fome e energia com só check-ins antigos: dados insuficientes", signalHungerEnergy(sOld).status === "insuficiente" && signalAdherence(sOld).status === "insuficiente");
  var mix = { checkins: [{date: d(-100), adherence: 9, hunger: 2, energy: 9}, {date: d(-6), adherence: 5, hunger: 9, energy: 3}] };
  var he = signalHungerEnergy(mix);
  check.check("B. O indicador só usa o recente: fome 9 e energia 3 → atenção (o antigo não dilui)", he.status === "atencao" && /9,0\/10/.test(he.text) && /3,0\/10/.test(he.text));
  check.check("B. Valores por preencher (0) não são «adesão nula» nem «fome zero»: insuficiente", signalHungerEnergy({checkins: [{date: d(-3), adherence: 0, hunger: 0, energy: 0}]}).status === "insuficiente" && signalAdherence({checkins: [{date: d(-3), adherence: 0, hunger: 0, energy: 0}]}).status === "insuficiente");
})();

// ---- C. confirmação profissional da adesão ----
(function(){
  var withConf = function(level, daysAgo, o){ return computePhaseReview(stu(SPARSE, Object.assign({np: {adherenceConfirmed: {date: d(-daysAgo), level: level}}}, o || {})), today); };
  var cumprida = withConf("cumprida", 0);
  check.check("C. Confirmação «cumprida» válida, sem check-ins: continua a avaliação e propõe (para o PT validar)", cumprida.kind === "ajuste" && cumprida.deltaKcal < 0 && !!cumprida.proposedTargets);
  var parcial = withConf("parcial", 2), nao = withConf("não cumprida", 2);
  check.check("C. «parcial» mantém o aviso e não propõe reduzir", parcial.kind === "aderencia" && noAdjust(parcial) && /«parcial»/.test(parcial.text) && parcial.needsAdherence === true);
  check.check("C. «não cumprida» mantém o aviso e não propõe reduzir", nao.kind === "aderencia" && noAdjust(nao) && /«não cumprida»/.test(nao.text));
  var expired = withConf("cumprida", 50);
  check.check("C. Confirmação com mais de 42 dias já não é válida", expired.kind === "aderencia" && noAdjust(expired) && /Não há dados fiáveis/.test(expired.text));
  var beforeChange = computePhaseReview(stu(SPARSE, {change: 28, start: 84, np: {adherenceConfirmed: {date: d(-35), level: "cumprida"}}}), today);
  check.check("C. Confirmação anterior à última alteração de calorias não é válida", beforeChange.kind !== "ajuste" || beforeChange.deltaKcal >= 0);
  var sc = stu(SPARSE, {change: 28, start: 84, np: {adherenceConfirmed: {date: d(-35), level: "cumprida"}}});
  check.check("C. …(a leitura direta confirma: sem adesão conhecida)", phaseAdherence(sc, sc.nutritionPhase, today).known === false);
  check.check("C. Nível desconhecido não vale", phaseAdherence(stu(SPARSE, {np: {adherenceConfirmed: {date: d(0), level: "ótima"}}}), stu(SPARSE, {np: {adherenceConfirmed: {date: d(0), level: "ótima"}}}).nutritionPhase, today).known === false);
  var s = stu(SPARSE), snap = JSON.stringify(s.targets), ws = JSON.stringify(s.weights), as = JSON.stringify(s.assessments);
  var res = confirmPhaseAdherence(s, "cumprida");
  check.check("C. Registar a confirmação: guarda {date, level} na fase e não mexe em alvos, pesagens nem avaliações", !res.error && s.nutritionPhase.adherenceConfirmed.level === "cumprida" && s.nutritionPhase.adherenceConfirmed.date === today && JSON.stringify(s.targets) === snap && JSON.stringify(s.weights) === ws && JSON.stringify(s.assessments) === as);
  check.check("C. Um nível inválido é recusado", !!confirmPhaseAdherence(s, "boa").error);
  authRole = "student"; check.check("C. O aluno não pode registar a confirmação", !!confirmPhaseAdherence(stu(SPARSE), "cumprida").error); authRole = "professional";
  // invalidada ao alterar as calorias
  var a = stu(SPARSE, {np: {adherenceConfirmed: {date: d(0), level: "cumprida"}}}); var rv = computePhaseReview(a, today); applyPhaseReview(a, rv);
  check.check("C. Aplicar uma revisão invalida a confirmação anterior", a.nutritionPhase.adherenceConfirmed === null && phaseAdherence(a, a.nutritionPhase, today).known === false);
  var m = stu(SPARSE, {np: {adherenceConfirmed: {date: d(0), level: "cumprida"}}}); notePhaseManualChange(m, CUT, CUT - 150);
  check.check("C. Uma alteração manual das calorias também a invalida", m.nutritionPhase.adherenceConfirmed === null);
  // persistência pelo mecanismo existente
  var p = stu(SPARSE); outboxMem = null; try { localStorage.removeItem("evolve_outbox"); } catch (e) {}
  sbReady = true; authRole = "professional"; setSyncBaseline(p, rowBaseline(studentToRow(p)));
  confirmPhaseAdherence(p, "parcial"); persistPrepare(p.id);
  var e = outboxRead()[p.id]; sbReady = false;
  check.check("C. A confirmação segue pela fila de gravação existente (coluna nutrition_phase)", !!e && !!e.cols.nutrition_phase && e.cols.nutrition_phase.adherenceConfirmed.level === "parcial" && e.cols.nutrition_phase.adherenceConfirmed.date === today && Object.keys(e.cols).join() === "nutrition_phase");
  var back = rowToStudent(Object.assign({id: "pc", name: "x"}, {nutrition_phase: JSON.parse(JSON.stringify(e.cols.nutrition_phase))}));
  check.check("C. E volta intacta ao ler a ficha", back.nutritionPhase.adherenceConfirmed.level === "parcial");
})();

// ---- D. reduções de calorias só com adesão confirmada; aumentos nunca bloqueados ----
(function(){
  var conf = function(l){ return {adherenceConfirmed: {date: d(0), level: l}}; };
  // cut abaixo da banda
  var cut = computePhaseReview(stu(SPARSE), today), cutOk = computePhaseReview(stu(SPARSE, {np: conf("cumprida")}), today);
  check.check("D. Cut abaixo da banda sem confirmação: aviso, nada de reduzir; com «cumprida»: propõe", cut.kind === "aderencia" && noAdjust(cut) && cutOk.kind === "ajuste" && cutOk.deltaKcal < 0);
  // manutenção a subir (retirar calorias)
  var MA = [[84, 80], [56, 81], [28, 82.1], [0, 83.2]];
  var man = computePhaseReview(stu(MA, {phase: "manutencao"}), today), manParc = computePhaseReview(stu(MA, {phase: "manutencao", np: conf("parcial")}), today), manOk = computePhaseReview(stu(MA, {phase: "manutencao", np: conf("cumprida")}), today);
  check.check("D. Manutenção com o peso a subir, sem confirmação: pede ao PT que verifique o contexto antes de retirar calorias", man.kind === "aderencia" && noAdjust(man) && /manutenção/.test(man.text) && man.needsAdherence === true);
  check.check("D. …«parcial» também não reduz; «cumprida» deixa propor retirar calorias", manParc.kind === "aderencia" && noAdjust(manParc) && manOk.kind === "ajuste" && manOk.deltaKcal < 0);
  var manDown = computePhaseReview(stu([[84, 83.2], [56, 82.1], [28, 81], [0, 80]], {phase: "manutencao"}), today);
  check.check("D. Manutenção com o peso a descer (acrescentar calorias) não precisa de confirmação", manDown.kind === "ajuste" && manDown.deltaKcal > 0);
  // bulk acima da banda (reduzir excedente) e urgente
  var BU = [[84, 70], [56, 72], [28, 74]];
  var bulk = computePhaseReview(stu(BU, {phase: "bulk"}), today), bulkOk = computePhaseReview(stu(BU, {phase: "bulk", np: conf("cumprida")}), today);
  check.check("D. Bulk a ganhar acima da banda: reduzir o excedente exige adesão confirmada", bulk.kind === "aderencia" && noAdjust(bulk) && bulkOk.kind === "ajuste" && bulkOk.deltaKcal < 0);
  var BUU = [[56, 70], [28, 73], [0, 76]], early = {phase: "bulk", np: {nextReviewDate: d(14)}};
  var bu = computePhaseReview(stu(BUU, early), today), buOk = computePhaseReview(stu(BUU, Object.assign({}, early, {np: {nextReviewDate: d(14), adherenceConfirmed: {date: d(0), level: "cumprida"}}})), today);
  check.check("D. Aviso urgente de bulk (reduzir) também exige a confirmação; confirmado, é urgente", bu.kind === "aderencia" && noAdjust(bu) && buOk.kind === "ajuste" && buOk.urgent === true && buOk.deltaKcal < 0);
  // bulk parado (subir) sem dados de adesão: mantém-se
  var stuck = computePhaseReview(stu([[84, 70], [56, 70], [28, 70.1], [0, 70]], {phase: "bulk"}), today);
  check.check("D. Bulk parado (subir calorias) sem dados de adesão: continua a propor (não é redução)", stuck.kind === "ajuste" && stuck.deltaKcal > 0);
  // perda demasiado rápida: aumentar calorias, sem exigir adesão
  var fast = computePhaseReview(stu([[84, 90], [56, 86], [28, 82]], {target: 70}), today);
  check.check("D. Cut a perder depressa demais (acima da banda): sobe calorias sem exigir adesão", fast.kind === "ajuste" && fast.deltaKcal > 0);
  var urg = computePhaseReview(stu([[56, 90], [28, 84], [0, 78]], {np: {nextReviewDate: d(14)}, target: 70}), today);
  check.check("D. Aviso urgente de perda rápida: sobe calorias sem exigir adesão", urg.kind === "ajuste" && urg.urgent === true && urg.deltaKcal > 0 && urg.deltaKcal <= 300);
  // frequente: continua igual
  var pts = []; for (var i = 28; i >= 0; i -= 2) pts.push([i, Math.round((90 - 0.2 * (28 - i) / 7) * 10) / 10]);
  var fr = computePhaseReview(stu(pts, {checkins: good(), start: 35, change: 35}), today), frNo = computePhaseReview(stu(pts, {start: 35, change: 35}), today);
  check.check("D. Via frequente: com check-ins, a regra de sempre; sem adesão, o mesmo travão", fr.kind === "ajuste" && fr.deltaKcal < 0 && frNo.kind === "aderencia" && noAdjust(frNo));
})();

// ---- E. resumo do peso só da fase atual ----
(function(){
  var s = stu([[120, 100], [84, 95], [28, 88], [14, 87.5], [0, 87]], {change: 28, start: 120}), r = computePhaseReview(s, today);
  check.check("E. O resumo começa no ponto de partida da fase (a pesagem do dia da alteração), não no histórico antigo", r.progress.first.date === d(-28) && r.progress.n === 3 && r.text.indexOf(fmtDateFullPt(d(-120))) < 0 && r.text.indexOf(fmtDateFullPt(d(-84))) < 0);
  check.check("E. O histórico não foi tocado e o resumo geral continua a ver tudo", s.weights.length === 5 && weightProgress(s, today).n === 5);
  var ant = stu([[120, 100], [30, 91], [28, 88], [0, 87]], {change: 28, start: 120});
  check.check("E. Uma pesagem 2 dias antes da alteração é o ponto de partida; a de 90 dias antes não", computePhaseReview(ant, today).progress.first.date === d(-30));
})();

// ---- os alvos nunca mudam sem ação explícita do PT ----
(function(){
  var scenarios = [stu(SPARSE), stu(SPARSE, {checkins: good()}), stu([[84, 90], [56, 89], [28, 95], [0, 88]], {checkins: good()}), stu([[56, 90], [28, 84], [0, 78]], {np: {nextReviewDate: d(14)}, target: 70}), stu([[84, 70], [56, 72], [28, 74]], {phase: "bulk", checkins: good()})];
  var ok = scenarios.every(function(s){
    var snap = JSON.stringify([s.targets, s.meals, s.weights, s.assessments, s.checkins]);
    computePhaseReview(s, today); computePhaseReview(s, today, {force: true}); confirmPhaseAdherence(s, "cumprida"); computePhaseReview(s, today); postponePhaseReview(s, 7);
    return JSON.stringify([s.targets, s.meals, s.weights, s.assessments, s.checkins]) === snap;
  });
  check.check("Rever, confirmar a adesão e adiar nunca alteram alvos, refeições, pesagens, avaliações nem check-ins", ok);
  var s = stu(SPARSE, {checkins: good()}), rv = computePhaseReview(s, today), before = s.targets.kcal;
  applyPhaseReview(s, rv);
  check.check("Só aplicar (ação explícita do PT) muda os alvos", s.targets.kcal === rv.proposedTargets.kcal && s.targets.kcal !== before);
})();
check.summarize();
