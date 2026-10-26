// Fase 37 — alerta de estagnação de peso + sugestão de ajuste de calorias.
require("./setup")();
eval(require("./extract-app")());
var check = require("./check")();

function isoDaysAgo(n){ var d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0,10); }
function series(daysAgoList, weights){ return daysAgoList.map(function(d, i){ return {date: isoDaysAgo(d), w: weights[i]}; }); }
function student(o){
  var base = {id:"x", name:"Aluno", goal:"Perda de peso", sex:"Masculino", height:178, age:30, weightCurrent:80,
    targets:{kcal:2200, protein:160, carbs:230, fat:70}, weights:[], checkins:[], planHistory:[], meals:[], alerts:[]};
  Object.keys(o||{}).forEach(function(k){ base[k] = o[k]; });
  return base;
}

// 1. Direção do objetivo
check.check("1. Perda de peso -> -1", plateauDirection(student({goal:"Perda de peso"})) === -1);
check.check("1. Ganho de massa -> +1", plateauDirection(student({goal:"Aumento de massa muscular"})) === 1);
check.check("1. Manutenção -> 0", plateauDirection(student({goal:"Manutenção corporal"})) === 0);
check.check("1. Peso objetivo concreto manda mais do que o texto", plateauDirection(student({goal:"Manutenção corporal", weightCurrent:70, weightGoal:80})) === 1);

// 2. Sem dados suficientes
(function(){
  var p = computeWeightPlateau(student({weights: series([2,0],[80,80])}));
  check.check("2. Dois pontos -> insuficiente", p.state === "insuficiente");
  p = computeWeightPlateau(student({weights: series([9,5,0],[80,80,80])}));
  check.check("2. Menos de 14 dias -> insuficiente", p.state === "insuficiente");
  check.check("2. Manutenção -> null", computeWeightPlateau(student({goal:"Manutenção corporal", weights: series([20,10,0],[80,80,80])})) === null);
})();

// 3. Estagnado em perda: 20 dias praticamente igual
(function(){
  var s = student({weights: series([20,14,7,0],[80.1,80.0,80.2,80.0])});
  var p = computeWeightPlateau(s);
  check.check("3. Perda parada -> estagnado", p.state === "estagnado" && p.dir === -1);
  var sug = suggestPlateauAdjustment(s, p);
  check.check("3. Sugestão de ajuste", sug && sug.type === "ajuste");
  check.check("3. Corta cerca de 125 kcal", sug.delta <= -120 && sug.delta >= -130);
  check.check("3. Proteína intacta", sug.newTargets.protein === 160);
  check.check("3. kcal nova coerente com os macros novos",
    sug.newTargets.kcal === 2200 + 4*(sug.newTargets.carbs-230) + 9*(sug.newTargets.fat-70));
  check.check("3. Hidratos descem mais do que a gordura", (230 - sug.newTargets.carbs)*4 > (70 - sug.newTargets.fat)*9);
  var sig = signalWeightPlateau(s);
  check.check("3. Sinal de atenção a apontar para o Plano", sig.status === "atencao" && sig.tab === "plano" && /estagnado/i.test(sig.text));
  var html = tplPlateauCard(s);
  check.check("3. Cartão tem o botão de aplicar", html.indexOf("applyPlateauAdjust") >= 0 && html.indexOf("125") >= 0 || html.indexOf("applyPlateauAdjust") >= 0);
})();

// 4. A perder bem: -0,5 kg/semana
(function(){
  var s = student({weights: series([21,14,7,0],[82,81,80.5,80])});
  var p = computeWeightPlateau(s);
  check.check("4. A perder 0,5 kg/sem -> a_evoluir", p.state === "a_evoluir" && p.rateKgWeek < -0.4);
  check.check("4. Sem sugestão quando está a evoluir", suggestPlateauAdjustment(s, p) === null);
  check.check("4. Sinal de peso fica o normal (não estagnado)", !/estagnado/i.test(signalWeightPlateau(s).text));
})();

// 5. Peso a subir durante uma perda também é "estagnado"
(function(){
  var s = student({weights: series([20,14,7,0],[80,80.4,80.7,81])});
  check.check("5. Peso a subir em perda -> estagnado", computeWeightPlateau(s).state === "estagnado");
})();

// 6. Ganho de massa parado -> aumenta calorias
(function(){
  var s = student({goal:"Aumento de massa muscular", weights: series([20,14,7,0],[75,75.1,74.9,75])});
  var p = computeWeightPlateau(s);
  var sug = suggestPlateauAdjustment(s, p);
  check.check("6. Ganho parado -> estagnado", p.state === "estagnado" && p.dir === 1);
  check.check("6. Acrescenta cerca de 150 kcal", sug.type === "ajuste" && sug.delta >= 145 && sug.delta <= 155);
  check.check("6. Proteína intacta", sug.newTargets.protein === 160);
})();

// 7. Ajuste de calorias recente: só conta pesagens depois dele
(function(){
  var s = student({weights: series([30,24,18,12,6,0],[80.5,80.3,80.0,80.0,80.1,80.0]),
    planHistory:[{type:"kcal", date: isoDaysAgo(6), before:2300, after:2200}]});
  var p = computeWeightPlateau(s);
  check.check("7. Ajuste há 6 dias -> aguarda", p.state === "aguarda");
  check.check("7. Cartão de espera sem botão", tplPlateauCard(s).indexOf("applyPlateauAdjust") < 0 && tplPlateauCard(s).indexOf("Calorias ajustadas") >= 0);
  var s2 = student({weights: series([40,33,26,20,14,7,0],[81,80.6,80.2,80.0,80.1,80.0,80.1]),
    planHistory:[{type:"kcal", date: isoDaysAgo(26), before:2300, after:2200}]});
  var p2 = computeWeightPlateau(s2);
  check.check("7. Ajuste há 26 dias + parado desde então -> estagnado (ignora pesagens antigas)", p2.state === "estagnado" && p2.n === 5 && p2.from === isoDaysAgo(26));
})();

// 8. Adesão baixa: não mexe nas calorias
(function(){
  var s = student({weights: series([20,14,7,0],[80,80,80,80]),
    checkins:[{adherence:4,date:isoDaysAgo(21)},{adherence:5,date:isoDaysAgo(14)},{adherence:5,date:isoDaysAgo(7)},{adherence:4,date:isoDaysAgo(1)}]});
  var sug = suggestPlateauAdjustment(s, computeWeightPlateau(s));
  check.check("8. Adesão baixa -> recomenda rever adesão", sug.type === "adesao" && !sug.newTargets);
  check.check("8. Cartão sem botão de aplicar", tplPlateauCard(s).indexOf("applyPlateauAdjust") < 0);
})();

// 9. Piso de calorias
(function(){
  var s = student({weights: series([20,14,7,0],[80,80,80,80]), targets:{kcal:1700, protein:140, carbs:150, fat:50}});
  var sug = suggestPlateauAdjustment(s, computeWeightPlateau(s));
  check.check("9. Perto do metabolismo basal -> não corta mais", sug.type === "limite");
})();

// 10. Alertas do dashboard: sem duplicar
(function(){
  var s = student({weights: series([20,14,7,0],[80,80,80,80])});
  var sigs = computeStudentSignals(s);
  var peso = sigs.filter(function(x){ return x.key === "peso"; });
  check.check("10. Continua a haver 1 só sinal de peso", peso.length === 1 && peso[0].status === "atencao");
})();

// 11. Adiar o alerta (férias, doença…)
(function(){
  var s = student({weights: series([20,14,7,0],[80,80,80,80])});
  check.check("11. Antes de adiar: estagnado, com botões de adiar", computeWeightPlateau(s).state === "estagnado" && /data-snooze-plateau="14"/.test(tplPlateauCard(s)) && /data-snooze-plateau="21"/.test(tplPlateauCard(s)));
  var until = snoozePlateau(s, 14);
  check.check("11. Adiar 14 dias devolve a data certa", until === isoDaysAgo(-14));
  check.check("11. Fica registado no histórico do plano", s.planHistory.some(function(e){ return e.type === "estagnacao_adiada" && e.after === until; }));
  var p = computeWeightPlateau(s);
  check.check("11. Durante o adiamento: estado adiado", p.state === "adiado" && p.until === until);
  check.check("11. Cartão mostra o adiamento e o botão de retomar, sem botão de aplicar",
    /Retomar agora/.test(tplPlateauCard(s)) && tplPlateauCard(s).indexOf("applyPlateauAdjust") < 0 && tplPlateauCard(s).indexOf("data-snooze-plateau") < 0);
  var sig = signalWeightPlateau(s);
  check.check("11. O sinal de peso deixa de ser atenção durante o adiamento", sig.status !== "atencao" && /adiado/i.test(sig.text));
  check.check("11. Também desaparece dos alertas do dashboard", !computeDashboardAlerts(s).some(function(a){ return /estagn|Peso/i.test(a.text); }));
  // retomar
  resumePlateau(s);
  check.check("11. Retomar volta a avaliar", computeWeightPlateau(s).state !== "adiado");
})();

// 12. Depois do adiamento terminar só contam pesagens posteriores (as de férias não contam)
(function(){
  var s = student({weights: series([30,25,20,15,10,4,0],[80,80,80,80,80,80,80]),
    planHistory:[{type:"estagnacao_adiada", date: isoDaysAgo(30), after: isoDaysAgo(3), summary:"x"}]});
  var p = computeWeightPlateau(s);
  check.check("12. Só 1 pesagem desde o fim do adiamento -> insuficiente (nada de alerta imediato)", p.state === "insuficiente" && p.n === 1);
  var s2 = student({weights: series([40,34,28,21,15,8,1],[80,80,80,80,79.2,78.4,77.6]),
    planHistory:[{type:"estagnacao_adiada", date: isoDaysAgo(40), after: isoDaysAgo(20), summary:"x"}]});
  var p2 = computeWeightPlateau(s2);
  check.check("12. Pesagens depois do adiamento a descer -> a evoluir", p2.state === "a_evoluir" && p2.from === isoDaysAgo(15));
})();

check.summarize();
