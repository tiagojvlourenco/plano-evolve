// Avaliação física: perímetros, condições da pesagem, massa gorda/magra em kg, gráfico de adesão, check-in com sono/stress/recuperação, notas datadas.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
function daysAgo(n){ return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10); }

// ---- 1. Formulário ----
(function(){
  var f = tplAssessForm({});
  check.check("1. O formulário tem os 5 perímetros (cintura, anca, peito, braço, coxa)", ["asWaist", "asHip", "asChest", "asArm", "asThigh"].every(function(id){ return f.indexOf('id="' + id + '"') >= 0; }));
  check.check("1. O formulário tem as condições da pesagem (jejum, pós-refeição, pós-treino...)", /id="asContext"/.test(f) && /Em jejum/.test(f) && /Pós-treino/.test(f));
  check.check("1. Os perímetros estão numa secção recolhida (não pesam na pesagem rápida)", /<details class="assess-extra"/.test(f));
  check.check("1. O botão Adicionar lê perímetros e condições e valida 20–250 cm", /PERIMETER_FIELDS\.forEach\(function\(f\)\{ var v = parseFloat\(el\.querySelector\("#as" \+ f\[2\]\)/.test(appSource) && /perímetros têm de estar entre 20 e 250 cm/.test(appSource));
})();

// ---- 2. Tabela robusta + condições ----
(function(){
  var s = {assessments:[
    {date:"2026-09-01", weight:60, bodyFat:25, muscle:40, visceral:3, water:52, context:"Em jejum"},
    {date:"2026-09-15", weight:60, bodyFat:0, muscle:0, visceral:0, water:0, waist:70, hip:95}
  ]};
  var t = tplAssessTable(s, true);
  check.check("2. Uma avaliação só com perímetros não rebenta e mostra '—' nos valores em falta", t.indexOf("—") >= 0 && t.indexOf("0.0%") === -1);
  check.check("2. A condição da pesagem aparece ao lado da data, escapada", /· Em jejum/.test(t) && tplAssessTable({assessments:[{date:"2026-09-01", weight:60, bodyFat:25, muscle:40, visceral:3, water:52, context:"<b>x</b>"}]}, false).indexOf("<b>x</b>") === -1);
})();

// ---- 3. Massa gorda e magra em kg ----
(function(){
  var a = {weight:80, bodyFat:25, muscle:36, visceral:5, water:50}, b = {weight:76, bodyFat:20, muscle:37, visceral:4, water:52};
  check.check("3. Massa gorda = 20 kg e magra = 60 kg (80 kg a 25%)", fatMassKg(a) === 20 && leanMassKg(a) === 60);
  check.check("3. Sem % de gordura não calcula (null)", fatMassKg({weight:80, bodyFat:0}) === null && leanMassKg({weight:80}) === null);
  var k = tplAssessKpis({assessments:[Object.assign({date:"2026-09-01"}, b), Object.assign({date:"2026-08-01"}, a)]});
  check.check("3. Os indicadores mostram massa gorda (kg) e massa magra (kg) com a variação", /Massa gorda \(kg\)/.test(k) && /Massa magra \(kg\)/.test(k) && /▼ 4\.8 kg/.test(k));
})();

// ---- 4. Perímetros + razões de risco ----
(function(){
  var s = {sex:"Feminino", height:160, assessments:[
    {date:"2026-09-15", weight:60, waist:84, hip:96, chest:90, arm:28, thigh:55},
    {date:"2026-08-15", weight:62, waist:88, hip:97, chest:91, arm:28.5, thigh:56}
  ]};
  var h = tplPerimetersCard(s);
  check.check("4. Mostra a tabela de perímetros com variação e as razões", /Perímetros/.test(h) && /Cintura \/ anca/.test(h) && /Cintura \/ altura/.test(h) && /▼ 4\.0/.test(h));
  check.check("4. Cintura/altura 84/160 = 0,53 → risco aumentado; cintura/anca 0,88 > 0,85 (mulher) → acima", /≥ 0,50: risco aumentado/.test(h) && /acima de 0,85/.test(h));
  check.check("4. Sem perímetros, o cartão não aparece", tplPerimetersCard({assessments:[{date:"2026-09-01", weight:60, bodyFat:20}]}) === "");
})();

// ---- 5. Gráfico de adesão ----
(function(){
  var s = {checkins:[1,2,3,4,5,6,7,8,9].map(function(i){ return {date:daysAgo(70 - i * 7), adherence: i < 3 ? 4 : 8}; })};
  var h = tplAdherenceChart(s);
  check.check("5. Mostra só os últimos 8 check-ins, com a média", (h.match(/class="b"/g) || []).length === 8 && /Média/.test(h));
  check.check("5. Barras abaixo do limiar ficam a vermelho", /background:var\(--critical\)/.test(h));
  check.check("5. Sem check-ins não desenha nada", tplAdherenceChart({checkins:[]}) === "");
})();

// ---- 6. Check-in: sono, stress, recuperação ----
(function(){
  var f = tplCheckin({weightCurrent:60, trainingsPerWeek:3, checkins:[], meals:[], trainingDays:[]});
  check.check("6. O check-in pede sono (horas), stress e recuperação", /id="ciSleep"/.test(f) && /id="ciStress"/.test(f) && /id="ciRecovery"/.test(f));
  check.check("6. O envio grava sleepHours, stress e recovery", /sleepHours: Math\.min\(14/.test(appSource) && /stress: parseInt\(el\.querySelector\("#ciStress"\)/.test(appSource) && /recovery: parseInt\(el\.querySelector\("#ciRecovery"\)/.test(appSource));
  var ruim = signalRecuperacao({checkins:[{date:daysAgo(14), sleepHours:5.5, stress:8, recovery:3}, {date:daysAgo(7), sleepHours:6, stress:8, recovery:4}]});
  check.check("6. Sono curto + stress alto + má recuperação → atenção", ruim.status === "atencao" && /sono 5,8 h/.test(ruim.text));
  var bom = signalRecuperacao({checkins:[{date:daysAgo(7), sleepHours:7.5, stress:3, recovery:8}]});
  check.check("6. Valores bons → positivo", bom.status === "positivo");
  check.check("6. Check-ins antigos sem estes campos → dados insuficientes (não alerta)", signalRecuperacao({checkins:[{date:daysAgo(7), adherence:8}]}).status === "insuficiente");
})();

// ---- 7. Notas datadas ----
(function(){
  var n1 = prependDatedNote("", "Primeira");
  check.check("7. A nota fica com data e hora [dd/mm/aaaa hh:mm]", /^\[\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}\] Primeira$/.test(n1));
  var n2 = prependDatedNote(n1, "Segunda");
  check.check("7. A mais recente fica no topo e a anterior é preservada", n2.indexOf("Segunda") < n2.indexOf("Primeira") && n2.indexOf("Primeira") > 0);
  check.check("7. A aba Notas tem o campo de nota datada, escapado", /id="addDatedNote"/.test(tplProNotas({notes:'<img src=x onerror=alert(1)>'})) && tplProNotas({notes:'<img src=x onerror=alert(1)>'}).indexOf("<img") === -1);
})();
check.summarize();
