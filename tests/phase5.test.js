// Fase 5 — motor de adaptação.
require("./setup")();
eval(require("./extract-app")());
var check = require("./check")();

function freshStudent(flex){
  return {
    flexibility: flex == null ? 50 : flex,
    flexOverrides: {}, flexHistory: [], blockedFoods: [],
    substitutionHistory: [], adaptationHistory: []
  };
}
function freshMeal(){
  return meal("Almoço","13:00",[
    food("Frango (peito)","150 g","protein"),
    food("Arroz (cozido)","120 g","carb"),
    food("Brócolos","à vontade","veg"),
    food("Azeite","10 ml","fat", false)
  ]);
}

// 1. Substituição simples
(function(){
  var s = freshStudent(); var m = freshMeal();
  applySubstitution(s, m, 0, {name:"Peru (fatiado)", qty:"150 g"});
  check.check("1. Substituição simples troca o alimento", m.foods[0].name === "Peru (fatiado)");
  check.check("1. Substituição simples marca a refeição adaptada", m.adapted === true);
})();

// 2. Substituição definida pelo profissional (allowedSubs) tem prioridade
(function(){
  var f = food("Frango (peito)","150 g","protein");
  f.allowedSubs = [{name:"Peru (fatiado)", qty:"150 g"}];
  var opts = optionsFor(f);
  check.check("2. Substituição profissional restringe as opções às definidas", opts.length === 1 && opts[0].name === "Peru (fatiado)");
})();

// 3. Alimento indisponível: getAvailableActions inclui substituir quando há grupo
(function(){
  var s = freshStudent(); var m = freshMeal();
  var actions = getAvailableActions(s, m).map(function(a){ return a.action; });
  check.check("3. Alimento indisponível -> ação 'substitute' disponível", actions.indexOf("substitute") >= 0);
})();

// 4. Adaptação de refeição regista no histórico geral
(function(){
  var s = freshStudent(); var m = freshMeal();
  m.adapted = true;
  logAdaptation(s, m, "adaptacao", {reason:"Adaptação manual"});
  check.check("4. Adaptação de refeição fica registada no histórico geral", s.adaptationHistory.length === 1 && s.adaptationHistory[0].type === "adaptacao");
})();

// 5. Refeição fora de casa -> markFlexible
(function(){
  var s = freshStudent(); var m = freshMeal();
  markFlexible(s, m, "restaurante");
  check.check("5. markFlexible define o estado 'flexible'", m.status === "flexible");
  check.check("5. Refeição flexível conta como feita hoje (não é tratada como falha)", mealCountsToday(m) === true);
  check.check("5. Histórico regista o tipo 'refeicao_flexivel'", s.adaptationHistory.some(function(e){ return e.type === "refeicao_flexivel"; }));
})();

// 6. Refeição reagendada
(function(){
  var s = freshStudent(); var m = freshMeal();
  rescheduleMeal(s, m, "14:30");
  check.check("6. rescheduleMeal atualiza o horário efetivo", effectiveMealTime(m) === "14:30");
  check.check("6. rescheduleMeal preserva o horário planeado original", m.time === "13:00");
  check.check("6. Estado passa a 'rescheduled'", m.status === "rescheduled");
  check.check("6. Histórico regista o reagendamento com from/to", s.adaptationHistory.some(function(e){ return e.type === "reagendamento" && e.from === "13:00" && e.to === "14:30"; }));
})();

// 7. Refeição ignorada
(function(){
  var s = freshStudent(); var m = freshMeal();
  skipMeal(s, m);
  check.check("7. skipMeal define o estado 'skipped'", m.status === "skipped");
  check.check("7. Refeição ignorada não conta para os totais consumidos", mealCountsToday(m) === false);
  check.check("7. Ícone de refeição ignorada não usa símbolo de erro", mealStatusIcon(m) === "—");
  check.check("7. Label da refeição ignorada é neutro", mealStatusLabel(m) === "Refeição ignorada" && !/falhad/i.test(mealStatusLabel(m)));
})();

// 8. Reorganização do dia: getNextMeal ignora refeições ignoradas e já feitas
(function(){
  var s = freshStudent();
  s.meals = [
    meal("Pequeno-almoço","08:00",[food("Ovos","2 unid.","protein")]),
    meal("Almoço","13:00",[food("Frango (peito)","150 g","protein")]),
    meal("Jantar","20:00",[food("Pescada","170 g","protein")])
  ];
  skipMeal(s, s.meals[0]);
  var RealDate = Date;
  global.Date = class extends RealDate { constructor(...a){ if(a.length) super(...a); else super(2026,8,22,9,0);} getHours(){return 9;} getMinutes(){return 0;} };
  var nm = getNextMeal(s);
  global.Date = RealDate;
  check.check("8. Depois de ignorar o pequeno-almoço, a próxima refeição é o Almoço (não o pequeno-almoço)", nm.meal.name === "Almoço");
})();

// 9. Evento social reutiliza o sistema de cenários com marcação flexível
(function(){
  check.check("9. Cenário 'jantar_amigos' existe para eventos sociais", SCENARIOS.jantar_amigos != null);
  check.check("9. Cenário 'festa' existe para eventos sociais", SCENARIOS.festa != null);
})();

// 10. Viagem: arquitetura preparada (cenário existe, sem fluxo completo)
(function(){
  check.check("10. Cenário 'viagem' está preparado", SCENARIOS.viagem != null);
})();

// 11. Pouco tempo: reutiliza substituições autorizadas do próximo alimento com grupo
(function(){
  var s = freshStudent();
  s.meals = [meal("Almoço","13:00",[food("Frango (peito)","150 g","protein")])];
  var RealDate = Date;
  global.Date = class extends RealDate { constructor(...a){ if(a.length) super(...a); else super(2026,8,22,9,0);} getHours(){return 9;} getMinutes(){return 0;} };
  var nm = getNextMeal(s);
  global.Date = RealDate;
  var fi = nm.meal.foods.findIndex(function(f){ return f.group; });
  check.check("11. Existe um alimento substituível para o fluxo 'pouco tempo'", fi >= 0);
})();

// 12. Construtor de refeições continua ativo em flexibilidade elevada
(function(){
  var s = freshStudent(85);
  check.check("12. Score 85 mantém mealBuilderEnabled true", computeFlexibilityProfile(s).mealBuilderEnabled === true);
})();

// 13/14/15. Flexibilidade baixa/média/elevada afetam as ações disponíveis
(function(){
  var m1 = freshMeal();
  var sLow = freshStudent(20);
  var actionsLow = getAvailableActions(sLow, m1).map(function(a){ return a.action; });
  check.check("13. Flexibilidade baixa: sem ação 'adapt' (freeMealEnabled false)", actionsLow.indexOf("adapt") === -1);

  var m2 = freshMeal();
  var sMed = freshStudent(50);
  var actionsMed = getAvailableActions(sMed, m2).map(function(a){ return a.action; });
  check.check("14. Flexibilidade média: ação 'adapt' disponível", actionsMed.indexOf("adapt") >= 0);

  var m3 = freshMeal();
  var sHigh = freshStudent(85);
  var actionsHigh = getAvailableActions(sHigh, m3).map(function(a){ return a.action; });
  check.check("15. Flexibilidade elevada: ação 'adapt' disponível", actionsHigh.indexOf("adapt") >= 0);
})();

// 16. Restrição alimentar nunca é ignorada, mesmo com flexibilidade máxima
(function(){
  var s = freshStudent(100);
  s.blockedFoods = ["Peru (fatiado)"];
  var f = food("Frango (peito)","150 g","protein");
  var opts = optionsFor(f, s);
  check.check("16. Alimento bloqueado nunca aparece, mesmo com flexibilidade 100", opts.every(function(o){ return o.name !== "Peru (fatiado)"; }));
})();

// 17. Alimento bloqueado também filtra allowedSubs manuais
(function(){
  var s = freshStudent();
  s.blockedFoods = ["Peru (fatiado)"];
  var f = food("Frango (peito)","150 g","protein");
  f.allowedSubs = [{name:"Peru (fatiado)", qty:"150 g"}, {name:"Pescada", qty:"170 g"}];
  var opts = optionsFor(f, s);
  check.check("17. Bloqueio filtra também substituições manuais", opts.length === 1 && opts[0].name === "Pescada");
})();

// 18. Notificação reagendada não dispara no horário original
(function(){
  var s = freshStudent(); var m = freshMeal();
  check.check("18. Antes de reagendar, a refeição pode notificar", shouldNotifyForMeal(m) === true);
  rescheduleMeal(s, m, "15:00");
  check.check("18. Reagendar não impede notificação (ainda pendente, só noutro horário)", shouldNotifyForMeal(m) === true);
  var s2 = freshStudent(); var m2 = freshMeal();
  skipMeal(s2, m2);
  check.check("18. Refeição ignorada nunca deve notificar", shouldNotifyForMeal(m2) === false);
  var s3 = freshStudent(); var m3 = freshMeal();
  m3.done = true;
  check.check("18. Refeição já concluída não deve notificar", shouldNotifyForMeal(m3) === false);
})();

// 19. Próxima refeição nunca é uma refeição passada/concluída
(function(){
  var s = freshStudent();
  s.meals = [
    meal("Pequeno-almoço","08:00",[food("Ovos","2 unid.","protein")]),
    meal("Almoço","13:00",[food("Frango (peito)","150 g","protein")])
  ];
  s.meals[0].done = true;
  var RealDate = Date;
  global.Date = class extends RealDate { constructor(...a){ if(a.length) super(...a); else super(2026,8,22,9,0);} getHours(){return 9;} getMinutes(){return 0;} };
  var nm = getNextMeal(s);
  global.Date = RealDate;
  check.check("19. Refeição concluída nunca é mostrada como próxima", nm.meal.name !== "Pequeno-almoço");
  check.check("19. A próxima é a que falta", nm.meal.name === "Almoço");
})();

// 20. Histórico de adaptações: resumo por tipo nos últimos 7 dias
(function(){
  var s = freshStudent();
  var oldDate = new Date(); oldDate.setDate(oldDate.getDate() - 30);
  s.adaptationHistory = [
    {date: todayISO(), type:"substituicao"},
    {date: todayISO(), type:"substituicao"},
    {date: todayISO(), type:"refeicao_ignorada"},
    {date: oldDate.toISOString().slice(0,10), type:"substituicao"}
  ];
  var summary = computeAdaptationSummary(s, 7);
  check.check("20. Resumo conta só os últimos 7 dias", summary.substituicao === 2);
  check.check("20. Resumo inclui refeições ignoradas", summary.refeicao_ignorada === 1);
})();

// ---- Testes de segurança (secção 42) ----

// Plano original não é destruído por uma substituição
(function(){
  var s = freshStudent(); var m = freshMeal();
  var originalName = m.foods[0].name;
  applySubstitution(s, m, 0, {name:"Peru (fatiado)", qty:"150 g"});
  check.check("SEG: substituição preserva o alimento original para reversão", m.foods[0].original && m.foods[0].original.name === originalName);
  revertMeal(m);
  check.check("SEG: revertMeal repõe o alimento original", m.foods[0].name === originalName);
})();

// dailyPlanOverride: uma substituição de hoje não sobrevive à mudança de dia (ensureFreshDay reverte)
(function(){
  var s = freshStudent();
  s.meals = [freshMeal()];
  var originalName = s.meals[0].foods[0].name;
  applySubstitution(s, s.meals[0], 0, {name:"Peru (fatiado)", qty:"150 g"});
  s.mealsDate = "2000-01-01";
  ensureFreshDay(s);
  check.check("SEG: no dia seguinte, o alimento substituído volta ao plano original", s.meals[0].foods[0].name === originalName);
  check.check("SEG: no dia seguinte, o estado de adaptação é reposto", s.meals[0].adapted === false && s.meals[0].status === "planned");
})();

// Aluno não consegue alterar regras do profissional (não existe API aluno-facing para isso)
(function(){
  check.check("SEG: não existe função de escrita direta de flexOverrides exposta ao aluno", typeof window.studentSetOverride === "undefined");
})();

// Flexibilidade nunca elimina um alimento bloqueado
(function(){
  var s = freshStudent(100);
  s.blockedFoods = ["Frutos secos"];
  var f = food("Azeite","10 ml","fat");
  check.check("SEG: score 100 não faz o alimento bloqueado reaparecer", optionsFor(f, s).every(function(o){ return o.name !== "Frutos secos"; }));
})();

check.summarize();
