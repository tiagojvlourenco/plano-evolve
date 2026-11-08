// Fase 37/38 — alerta de estagnação de peso: uma só decisão (a de signalWeight), ajuste sugerido e adiamento.
require("./setup")();
eval(require("./extract-app")());
var check = require("./check")();

function isoDaysAgo(n){ var d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); }
function series(daysAgoList, weights){ return daysAgoList.map(function(d, i){ return {date: isoDaysAgo(d), w: weights[i]}; }); }
function student(o){
  var base = {id:"x", name:"Aluno", goal:"Perda de peso", sex:"Masculino", height:178, age:30, weightCurrent:80,
    targets:{kcal:2200, protein:160, carbs:230, fat:70}, weights:[], checkins:[], planHistory:[], meals:[], alerts:[], assessments:[]};
  Object.keys(o||{}).forEach(function(k){ base[k] = o[k]; });
  return base;
}
var FLAT = [20,14,7,0], FLATW = [80,80.1,80,80];

// 1. Direção do objetivo
check.check("1. Perda de peso -> -1", plateauDirection(student({goal:"Perda de peso"})) === -1);
check.check("1. Ganho de massa -> +1", plateauDirection(student({goal:"Aumento de massa muscular"})) === 1);
check.check("1. Manutenção -> 0", plateauDirection(student({goal:"Manutenção corporal"})) === 0);
check.check("1. Peso objetivo concreto manda mais do que o texto", plateauDirection(student({goal:"Manutenção corporal", weightCurrent:70, weightGoal:80})) === 1);

// 2. Sem dados suficientes ou sem direção
(function(){
  check.check("2. Duas pesagens -> insuficiente (e sem alerta)", computeWeightPlateau(student({weights: series([14,0],[80,80])})).state === "insuficiente");
  check.check("2. Manutenção -> null (sem cartão)", computeWeightPlateau(student({goal:"Manutenção corporal", weights: series(FLAT, FLATW)})) === null && tplPlateauCard(student({goal:"Manutenção corporal", weights: series(FLAT, FLATW)})) === "");
})();

// 3. A decisão é a de signalWeight (uma só regra, o mesmo texto no painel, na Leitura e na Nutrição)
(function(){
  var s = student({weights: series(FLAT, FLATW)});
  var base = signalWeight(s), p = computeWeightPlateau(s);
  check.check("3. signalWeight marca estagnado com .stall", base.stall === true && base.status === "atencao");
  check.check("3. O cartão fica 'estagnado' pela mesma decisão", p.state === "estagnado" && p.text === base.text);
  var sig = signalWeightPlateau(s);
  check.check("3. O sinal do painel diz o mesmo que signalWeight e aponta para a Nutrição", sig.status === "atencao" && sig.text.indexOf(base.text) === 0 && sig.tab === "plano");
  var html = tplPlateauCard(s);
  check.check("3. O cartão repete o texto do sinal e tem os botões", html.indexOf("applyPlateauAdjust") >= 0 && html.indexOf("data-snooze-plateau=\"14\"") >= 0 && html.indexOf("data-snooze-plateau=\"21\"") >= 0 && html.replace(/&[a-z#0-9]+;/g, "").indexOf("estagnado") >= 0);
  var sug = suggestPlateauAdjustment(s, p);
  check.check("3. Sugere cerca de -125 kcal, sobretudo hidratos, proteína intacta", sug.type === "ajuste" && sug.delta <= -120 && sug.delta >= -130 && sug.newTargets.protein === 160 && (230 - sug.newTargets.carbs)*4 > (70 - sug.newTargets.fat)*9);
  check.check("3. kcal nova coerente com os macros novos", sug.newTargets.kcal === 2200 + 4*(sug.newTargets.carbs-230) + 9*(sug.newTargets.fat-70));
})();

// 4. A perder bem: nenhum alerta, nenhuma sugestão, nenhuma contradição
(function(){
  var s = student({weights: series([21,14,7,0],[81,80.8,80.5,80.2])});
  var base = signalWeight(s), p = computeWeightPlateau(s);
  check.check("4. signalWeight positivo, sem .stall", base.status === "positivo" && !base.stall);
  check.check("4. O cartão diz 'a evoluir' com o mesmo texto", p.state === "a_evoluir" && p.text === base.text && tplPlateauCard(s).indexOf("✓") >= 0);
  check.check("4. Sem sugestão", suggestPlateauAdjustment(s, p) === null);
  check.check("4. O painel não mostra estagnado", !/estagnad/i.test(signalWeightPlateau(s).text));
})();

// 5. Peso a subir numa perda não é «estagnado» (é outra situação): sem sugestão de ajuste de calorias
(function(){
  var s = student({weights: series([20,14,7,0],[80,80.8,81.5,82])});
  check.check("5. Peso a subir em perda -> outro (atenção do painel, sem cartão de ajuste)", computeWeightPlateau(s).state === "outro" && tplPlateauCard(s) === "");
  check.check("5. O painel mantém o aviso próprio", signalWeightPlateau(s).status === "atencao");
})();

// 6. Ganho de massa parado -> acrescenta calorias
(function(){
  var s = student({goal:"Aumento de massa muscular", weights: series(FLAT, [75,75.1,74.9,75]), weightCurrent:75});
  var p = computeWeightPlateau(s), sug = suggestPlateauAdjustment(s, p);
  check.check("6. Ganho parado -> estagnado", p.state === "estagnado" && p.dir === 1);
  check.check("6. Acrescenta cerca de 150 kcal e mantém a proteína", sug.type === "ajuste" && sug.delta >= 145 && sug.delta <= 155 && sug.newTargets.protein === 160);
})();

// 7. Ajuste de calorias recente: espera 14 dias antes de reavaliar (e o painel não alerta)
(function(){
  var s = student({weights: series(FLAT, FLATW), planHistory:[{type:"kcal", date: isoDaysAgo(6), before:2300, after:2200}]});
  var p = computeWeightPlateau(s);
  check.check("7. Ajuste há 6 dias -> aguarda", p.state === "aguarda");
  check.check("7. Cartão de espera sem botão de aplicar", tplPlateauCard(s).indexOf("applyPlateauAdjust") < 0 && tplPlateauCard(s).indexOf("Última alteração") >= 0);
  check.check("7. O painel não alerta durante a espera", signalWeightPlateau(s).status !== "atencao");
  var s2 = student({weights: series(FLAT, FLATW), planHistory:[{type:"kcal", date: isoDaysAgo(20), before:2300, after:2200}]});
  check.check("7. Ajuste há 20 dias -> volta a avaliar", computeWeightPlateau(s2).state === "estagnado");
})();

// 8. Adesão baixa (check-ins antigos): não mexe nas calorias
(function(){
  var s = student({weights: series(FLAT, FLATW),
    checkins:[{adherence:4,date:isoDaysAgo(21)},{adherence:5,date:isoDaysAgo(14)},{adherence:5,date:isoDaysAgo(7)},{adherence:4,date:isoDaysAgo(1)}]});
  var sug = suggestPlateauAdjustment(s, computeWeightPlateau(s));
  check.check("8. Adesão baixa -> recomenda rever adesão", sug.type === "adesao" && !sug.newTargets);
  check.check("8. Cartão sem botão de aplicar", tplPlateauCard(s).indexOf("applyPlateauAdjust") < 0);
})();

// 9. Piso de calorias
(function(){
  var s = student({weights: series(FLAT, FLATW), targets:{kcal:1700, protein:140, carbs:150, fat:50}});
  check.check("9. Perto do metabolismo basal -> não corta mais", suggestPlateauAdjustment(s, computeWeightPlateau(s)).type === "limite");
})();

// 10. Quem tem fase é tratado pela revisão de fase: nunca duas propostas nem dois «estagnados»
(function(){
  var s = student({weights: series(FLAT, FLATW), nutritionPhase:{phase:"cut", startDate: isoDaysAgo(60), startWeight:82, targetWeight:75, level:"B", stage:1, reviews:[]}});
  check.check("10. Com fase definida o estado é 'fase'", computeWeightPlateau(s).state === "fase");
  check.check("10. Sem cartão de estagnação (a revisão de fase manda)", tplPlateauCard(s) === "");
  check.check("10. Sem sugestão de calorias deste mecanismo", suggestPlateauAdjustment(s, computeWeightPlateau(s)) === null);
  check.check("10. O painel mostra o sinal normal de peso (sem remissão para o cartão)", signalWeightPlateau(s).tab === signalWeight(s).tab);
})();

// 11. Consistência: em qualquer série, «estagnado» no cartão <=> .stall no sinal de peso
(function(){
  var cases = [FLATW, [81,80.8,80.5,80.2], [80,80.8,81.5,82], [82,81,80,79], [80,80,80,80]], ok = true, n = 0;
  cases.forEach(function(w){
    ["Perda de peso", "Aumento de massa muscular"].forEach(function(g){
      var s = student({goal: g, weights: series(FLAT, w)}); n++;
      var stall = !!signalWeight(s).stall, card = computeWeightPlateau(s).state === "estagnado";
      if (stall !== card) ok = false;
    });
  });
  check.check("11. Cartão e sinal nunca discordam (" + n + " séries)", ok);
})();

// 12. Adiar (férias, doença…)
(function(){
  var s = student({weights: series(FLAT, FLATW)});
  var until = snoozePlateau(s, 14);
  check.check("12. Adiar 14 dias devolve a data certa e fica no histórico", until === isoDaysAgo(-14) && s.planHistory.some(function(e){ return e.type === "estagnacao_adiada" && e.after === until; }));
  var p = computeWeightPlateau(s);
  check.check("12. Durante o adiamento: estado adiado", p.state === "adiado" && p.until === until);
  check.check("12. Cartão mostra o adiamento e 'Retomar', sem aplicar nem adiar de novo", /Retomar agora/.test(tplPlateauCard(s)) && tplPlateauCard(s).indexOf("applyPlateauAdjust") < 0 && tplPlateauCard(s).indexOf("data-snooze-plateau") < 0);
  var sig = signalWeightPlateau(s);
  check.check("12. O sinal deixa de ser atenção e diz que está adiado", sig.status !== "atencao" && /adiado/i.test(sig.text));
  check.check("12. Também desaparece dos alertas do dashboard", !computeDashboardAlerts(s).some(function(a){ return /estagn/i.test(a.text); }));
  resumePlateau(s);
  check.check("12. Retomar volta a avaliar", computeWeightPlateau(s).state !== "adiado");
})();

// 13. Depois do adiamento: 14 dias de espera (as pesagens de viagem não contam)
(function(){
  var s = student({weights: series(FLAT, FLATW), planHistory:[{type:"estagnacao_adiada", date: isoDaysAgo(30), after: isoDaysAgo(3), summary:"x"}]});
  var p = computeWeightPlateau(s);
  check.check("13. Adiamento terminou há 3 dias -> aguarda (sem alerta imediato)", p.state === "aguarda" && p.since === isoDaysAgo(3));
  var s2 = student({weights: series(FLAT, FLATW), planHistory:[{type:"estagnacao_adiada", date: isoDaysAgo(40), after: isoDaysAgo(20), summary:"x"}]});
  check.check("13. Adiamento terminou há 20 dias -> volta a avaliar", computeWeightPlateau(s2).state === "estagnado");
})();

check.summarize();
