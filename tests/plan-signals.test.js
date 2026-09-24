// Fase 6 — leitura profissional: indicadores objetivos calculados em tempo real.
require("./setup")();
eval(require("./extract-app")());
var check = require("./check")();

function isoDaysAgo(n){
  var d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0,10);
}

function freshStudent(overrides){
  var base = {
    id:"x", name:"Aluno Teste", goal:"Perda de gordura", trainingsPerWeek:4,
    weights:[], checkins:[], adaptationHistory:[], meals:[], targets:{kcal:1800},
    weightInitial:80, weightCurrent:80, alerts:[]
  };
  Object.keys(overrides || {}).forEach(function(k){ base[k] = overrides[k]; });
  return base;
}

// ---- signalCheckin ----
(function(){
  var s = freshStudent({checkins:[]});
  var sig = signalCheckin(s);
  check.check("1. Sem check-ins -> insuficiente", sig.status === "insuficiente");
  check.check("1. Texto factual sem check-ins", sig.text === "Sem check-ins registados.");
})();

(function(){
  var s = freshStudent({checkins:[{date:isoDaysAgo(9), weight:80, hunger:5, energy:5, adherence:7, workouts:2, mealsOff:1}]});
  var sig = signalCheckin(s);
  check.check("2. 9 dias -> atencao (limiar 7)", sig.status === "atencao");
  check.check("2. Texto no formato do exemplo do pedido", sig.text === "Check-in em atraso há 9 dias.");
})();

(function(){
  var s = freshStudent({checkins:[{date:isoDaysAgo(6), weight:80, hunger:5, energy:5, adherence:7, workouts:2, mealsOff:1}]});
  check.check("3. Fronteira: 6 dias ainda não é atraso", signalCheckin(s).status === "positivo");
  var s2 = freshStudent({checkins:[{date:isoDaysAgo(7), weight:80, hunger:5, energy:5, adherence:7, workouts:2, mealsOff:1}]});
  check.check("3. Fronteira: exatamente 7 dias já conta como atraso", signalCheckin(s2).status === "atencao");
})();

(function(){
  var s = freshStudent({checkins:[{date:isoDaysAgo(20), weight:80, hunger:5, energy:5, adherence:7, workouts:2, mealsOff:1}]});
  check.check("4. >=14 dias marca severidade alta (pill crítico)", signalCheckin(s).severity === "high");
})();

// ---- computeRecentWeightChange / signalWeight ----
(function(){
  var s = freshStudent({weights:[]});
  check.check("5. Sem pesos -> insuficiente", signalWeight(s).status === "insuficiente");
  var s1 = freshStudent({weights:[{date:isoDaysAgo(5), w:80}]});
  check.check("5. Um único peso -> insuficiente (nada para comparar)", signalWeight(s1).status === "insuficiente");
})();

(function(){
  var s = freshStudent({weights:[{date:isoDaysAgo(60), w:82}, {date:isoDaysAgo(50), w:81.5}]});
  check.check("6. Último peso fora da janela de 3 semanas -> insuficiente", signalWeight(s).status === "insuficiente");
})();

(function(){
  // exemplo exato do pedido: -0,8 kg nas últimas 3 semanas
  var s = freshStudent({goal:"Perda de gordura", weights:[
    {date:isoDaysAgo(25), w:80.8}, {date:isoDaysAgo(20), w:80.5}, {date:isoDaysAgo(0), w:80.0}
  ]});
  var sig = signalWeight(s);
  check.check("7. Formato exato do exemplo do pedido", sig.text === "Peso: -0,8 kg nas últimas 3 semanas.");
  check.check("7. Mudança real de peso com objetivo de perda -> positivo (há informação objetiva)", sig.status === "positivo");
})();

(function(){
  // objetivo implica mudança mas o peso ficou estagnado (<0.3kg) -> atencao
  var s = freshStudent({goal:"Ganho de massa muscular", weights:[
    {date:isoDaysAgo(21), w:75.0}, {date:isoDaysAgo(0), w:75.1}
  ]});
  check.check("8. Estagnado com objetivo de mudança -> atencao", signalWeight(s).status === "atencao");
})();

(function(){
  // objetivo de manutenção: pequena variação não é motivo de atenção
  var s = freshStudent({goal:"Manutenção / recomposição", weights:[
    {date:isoDaysAgo(21), w:63.0}, {date:isoDaysAgo(0), w:63.1}
  ]});
  check.check("9. Pequena variação com objetivo de manutenção -> não é atencao", signalWeight(s).status === "positivo");
})();

// ---- signalAdherence (exemplo exato do pedido) ----
(function(){
  var s = freshStudent({checkins:[]});
  check.check("10. Sem check-ins -> insuficiente", signalAdherence(s).status === "insuficiente");

  var s2 = freshStudent({checkins:[
    {date:isoDaysAgo(21), adherence:7, hunger:5, energy:5, workouts:2, mealsOff:0},
    {date:isoDaysAgo(14), adherence:8, hunger:5, energy:5, workouts:2, mealsOff:0},
    {date:isoDaysAgo(7), adherence:7, hunger:5, energy:5, workouts:2, mealsOff:0},
    {date:isoDaysAgo(0), adherence:8, hunger:5, energy:5, workouts:2, mealsOff:0}
  ]});
  var sig = signalAdherence(s2);
  check.check("10. Formato exato do exemplo do pedido", sig.text === "Adesão média: 7,5/10 nos últimos 4 check-ins.");
  check.check("10. Adesão >= 6 -> positivo", sig.status === "positivo");
})();

(function(){
  var s = freshStudent({checkins:[
    {date:isoDaysAgo(3), adherence:4, hunger:5, energy:5, workouts:1, mealsOff:2},
    {date:isoDaysAgo(1), adherence:3, hunger:5, energy:5, workouts:1, mealsOff:2}
  ]});
  check.check("11. Adesão média abaixo de 6 -> atencao", signalAdherence(s).status === "atencao");
})();

(function(){
  // mais de 4 check-ins: só os últimos 4 (SIGNAL_RECENT_CHECKINS) entram na média
  var s = freshStudent({checkins:[
    {date:isoDaysAgo(40), adherence:1, hunger:5, energy:5, workouts:2, mealsOff:0}, // fora da janela
    {date:isoDaysAgo(21), adherence:8, hunger:5, energy:5, workouts:2, mealsOff:0},
    {date:isoDaysAgo(14), adherence:8, hunger:5, energy:5, workouts:2, mealsOff:0},
    {date:isoDaysAgo(7), adherence:8, hunger:5, energy:5, workouts:2, mealsOff:0},
    {date:isoDaysAgo(0), adherence:8, hunger:5, energy:5, workouts:2, mealsOff:0}
  ]});
  check.check("12. Só considera os últimos 4 check-ins, ignora o 5º mais antigo", signalAdherence(s).status === "positivo" && signalAdherence(s).text.indexOf("8,0/10") >= 0);
})();

// ---- signalHungerEnergy ----
(function(){
  var s = freshStudent({checkins:[]});
  check.check("13. Sem check-ins -> insuficiente", signalHungerEnergy(s).status === "insuficiente");

  var s2 = freshStudent({checkins:[{date:isoDaysAgo(0), adherence:8, hunger:8, energy:3, workouts:2, mealsOff:0}]});
  var sig = signalHungerEnergy(s2);
  check.check("14. Fome alta (>7) OU energia baixa (<4) -> atencao", sig.status === "atencao");

  var s3 = freshStudent({checkins:[{date:isoDaysAgo(0), adherence:8, hunger:5, energy:7, workouts:2, mealsOff:0}]});
  check.check("15. Fome/energia normais -> positivo", signalHungerEnergy(s3).status === "positivo");
})();

// ---- signalTreinos (exemplo exato do pedido) ----
(function(){
  var s = freshStudent({trainingsPerWeek:4, checkins:[{date:isoDaysAgo(0), adherence:7, hunger:5, energy:5, workouts:2, mealsOff:0}]});
  var sig = signalTreinos(s);
  check.check("16. Formato exato do exemplo do pedido", sig.text === "Treinos: 2 de 4 previstos no último check-in.");
  check.check("16. Fez menos que o previsto -> atencao", sig.status === "atencao");

  var s2 = freshStudent({trainingsPerWeek:4, checkins:[{date:isoDaysAgo(0), adherence:7, hunger:5, energy:5, workouts:4, mealsOff:0}]});
  check.check("17. Cumpriu o previsto -> positivo", signalTreinos(s2).status === "positivo");

  var s3 = freshStudent({trainingsPerWeek:0, checkins:[{date:isoDaysAgo(0), adherence:7, hunger:5, energy:5, workouts:0, mealsOff:0}]});
  check.check("18. Sem treinos planeados -> insuficiente (não inventa comparação)", signalTreinos(s3).status === "insuficiente");

  var s4 = freshStudent({trainingsPerWeek:4, checkins:[]});
  check.check("19. Sem check-ins -> insuficiente", signalTreinos(s4).status === "insuficiente");
})();

// ---- signalMealsOff ----
(function(){
  var s = freshStudent({checkins:[]});
  check.check("20. Sem check-ins -> insuficiente", signalMealsOff(s).status === "insuficiente");

  var s2 = freshStudent({checkins:[
    {date:isoDaysAgo(0), adherence:7, hunger:5, energy:5, workouts:2, mealsOff:2},
    {date:isoDaysAgo(7), adherence:7, hunger:5, energy:5, workouts:2, mealsOff:2}
  ]});
  var sig = signalMealsOff(s2);
  check.check("21. Soma corretamente as refeições fora do plano", sig.text === "4 refeições fora do plano nos últimos 2 check-ins.");
  check.check("21. 4 > limiar (3) -> atencao", sig.status === "atencao");

  var s3 = freshStudent({checkins:[{date:isoDaysAgo(0), adherence:7, hunger:5, energy:5, workouts:2, mealsOff:1}]});
  check.check("22. Dentro do limiar -> positivo", signalMealsOff(s3).status === "positivo");
})();

// ---- signalAdaptacoes ----
// O texto deixa explícito que são ações que o próprio aluno registou
// (autorrelato), não uma auditoria — pedido explícito do utilizador depois de
// ver o painel: "apresenta adaptações como ações registadas pelo aluno, não
// como dados invioláveis".
(function(){
  var s = freshStudent({adaptationHistory:[]});
  var sig = signalAdaptacoes(s);
  check.check("23. Sem adaptações -> texto factual, não é 'atencao'", sig.text === "Sem ações de adaptação registadas pelo aluno nos últimos 7 dias." && sig.status === "positivo");

  var s2 = freshStudent({adaptationHistory:[
    {date:isoDaysAgo(1), type:"substituicao"},
    {date:isoDaysAgo(2), type:"substituicao"},
    {date:isoDaysAgo(3), type:"refeicao_flexivel"},
    {date:isoDaysAgo(4), type:"refeicao_ignorada"},
    {date:isoDaysAgo(5), type:"reagendamento"},
    {date:isoDaysAgo(40), type:"substituicao"} // fora da janela de 7 dias
  ]});
  var sig2 = signalAdaptacoes(s2);
  check.check("24. Texto deixa claro que é autorrelato do aluno (só conta os últimos 7 dias)", sig2.text === "5 ações de adaptação registadas pelo aluno nos últimos 7 dias.");
  check.check("24. >= limiar (5) -> atencao", sig2.status === "atencao");
})();

// ---- signalPlanoAtivo ----
(function(){
  var s = freshStudent({meals:[], targets:{kcal:1800}});
  var sig = signalPlanoAtivo(s);
  check.check("25. Sem refeições -> atencao com severidade alta", sig.status === "atencao" && sig.severity === "high");

  var s2 = freshStudent({meals:[meal("Almoço","13:00",[])], targets:{kcal:0}});
  check.check("26. Sem alvo de calorias -> atencao", signalPlanoAtivo(s2).status === "atencao");

  var s3 = freshStudent({meals:[meal("Almoço","13:00",[]), meal("Jantar","20:00",[])], targets:{kcal:1800}});
  var sig3 = signalPlanoAtivo(s3);
  check.check("27. Plano com refeições e alvo -> positivo", sig3.status === "positivo" && sig3.text === "Plano ativo com 2 refeições definidas.");
})();

// ---- computeStudentSignals: agrega os 8 indicadores ----
(function(){
  var maria = findStudent("maria");
  var signals = computeStudentSignals(maria);
  check.check("28. Devolve exatamente 8 indicadores", signals.length === 8);
  check.check("28. Todos têm os campos obrigatórios (estado, texto, período, separador)",
    signals.every(function(sig){ return sig.status && sig.text && sig.period && sig.tab; }));
  check.check("28. Todos os estados são válidos", signals.every(function(sig){ return ["atencao","positivo","insuficiente"].indexOf(sig.status) >= 0; }));
})();

// ---- computeDashboardAlerts: mantém compatibilidade com s.alerts estático e soma os computados ----
(function(){
  var s = freshStudent({alerts:[{type:"warn", text:"Alerta manual antigo"}], checkins:[{date:isoDaysAgo(9), adherence:7, hunger:5, energy:5, workouts:2, mealsOff:0}]});
  var alerts = computeDashboardAlerts(s);
  check.check("29. Mantém o alerta estático legado", alerts.some(function(a){ return a.text === "Alerta manual antigo"; }));
  check.check("29. Adiciona o alerta computado (check-in em atraso)", alerts.some(function(a){ return a.text === "Check-in em atraso há 9 dias."; }));
})();

(function(){
  // não depende de arrays fixos: um aluno sem s.alerts definido (undefined) não rebenta
  var s = freshStudent({alerts: undefined, meals:[]});
  var alerts = computeDashboardAlerts(s);
  check.check("30. Funciona mesmo sem s.alerts definido", Array.isArray(alerts) && alerts.length > 0);
})();

// ---- tplProLeitura: renderiza os 8 indicadores, nunca muta o aluno, escapa texto livre ----
(function(){
  var maria = findStudent("maria");
  var before = JSON.stringify(maria);
  var html = tplProLeitura(maria);
  var after = JSON.stringify(maria);
  check.check("31. Renderizar a Leitura nunca altera dados do aluno", before === after);
  check.check("31. Mostra o título de cada indicador", html.indexOf("Check-in") >= 0 && html.indexOf("Padrões de adaptação") >= 0);
})();

(function(){
  // todos os separadores de destino (data-goto-tab) têm de existir em PRO_TABS, senão o rótulo "ver em ..." fica "undefined"
  var maria = findStudent("maria");
  var html = tplProLeitura(maria);
  check.check("32. Nunca mostra 'undefined' no rótulo do separador de destino", html.indexOf("undefined") === -1);
})();

check.summarize();
