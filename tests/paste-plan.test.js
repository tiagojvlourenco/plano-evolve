// Colar um plano alimentar em texto no separador Plano do profissional (dados sintéticos).
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

var txt = [
  "Refeição 1 (pequeno-almoço):", "1 Fatia Pão Integral", "50g Queijo Fresco Magro",
  "Refeição 3 (almoço):", "70g Arroz Basmati / Massa Integral / Batata Doce", "100g Carne Branca (Peru / Frango) OU 100g Peixe Branco (Pescada)", "150g Legumes Verdes (Brócolos / Couve-Flor)",
  "Refeição 4 (meio da tarde):", "100g Morangos OU 100g Uvas",
  "Refeição 5 (jantar):", "70g Arroz Basmati / Quinoa", "100g Carne Branca OU 100g Peixe Branco"
].join("\n");
var d = draftPlanFromDailyText(txt);
function m(n){ return d.filter(function(x){ return x.mealName === n; })[0]; }
check.check("1. Reconhece pequeno-almoço, almoço, lanche (meio da tarde) e jantar", !!m("Pequeno-almoço") && !!m("Almoço") && !!m("Lanche") && !!m("Jantar"));
check.check("1. Lê as quantidades escritas (50 g de queijo, 70 g de arroz, 150 g de legumes)", m("Pequeno-almoço").foods.some(function(f){ return /Queijo/.test(f.name) && f.qty === "50 g"; }) && m("Almoço").foods.some(function(f){ return /Arroz/.test(f.name) && f.qty === "70 g"; }) && m("Almoço").foods.some(function(f){ return f.qty === "150 g"; }));
check.check("1. Alternativas (OU, /) ficam num só alimento por grupo, não somadas", m("Almoço").foods.length === 3);
var f = tplProPlano({targets:{kcal:1500,protein:100,carbs:150,fat:50}, meals:[], flexibility:3, fromOnboarding:false, dailyEatingDescription:""});
check.check("2. O separador Plano tem sempre a caixa 'Colar um plano em texto'", /id="pastedPlanText"/.test(f) && /id="draftFromPastedPlan"/.test(f));
check.check("2. O botão está ligado ao mesmo gerador de proposta", /#draftFromPastedPlan/.test(appSource));
// ---- 3. Hidratação/notas não viram alimentos; chá/café não são "Snacks"; o ajuste automático não gera disparates ----
(function(){
  var full = txt + "\nHidratação → 3L Água (2L água + 1L chá)\nLeia: iogurte proteico";
  var d2 = draftPlanFromPlanSheet(full);
  var jantar = d2.filter(function(x){ return x.mealName === "Jantar"; })[0];
  check.check("3. A linha de hidratação/notas não acrescenta alimentos ao jantar", jantar.foods.length === 2 && !jantar.foods.some(function(f){ return /Chá|Água/.test(f.name); }) && jantar.unmatchedLines.length === 0);
  check.check("3. Chá e café ficam num grupo próprio (Bebidas), não em Snacks", groupOfFood("Chá, infusão, verde") === "bebidas" && groupOfFood("Café, infusão - bica") === "bebidas" && GROUP_LABELS.bebidas.indexOf("Bebidas") >= 0);
  var s = {targets:{kcal:1300, protein:90, carbs:120, fat:45}, meals:[meal("Almoço","13:00",[food("Chá, infusão, verde","100 ml","bebidas"), food("Pão integral","40 g","cereais"), food("Frango (peito)","100 g","carnes")])]};
  var r = autoAdjustPlanQuantities(s);
  check.check("3. O chá nunca é reescalado pelo ajuste automático", s.meals[0].foods[0].qty === "100 ml");
  s.meals[0].foods.forEach(function(f){ var q = parseFloat(f.qty); check.check("3. Ajuste automático nunca passa de 4x nem desce de 1/4 (" + f.name + " " + f.qty + ")", f.name.indexOf("Chá") === 0 || (q >= 10 && q <= 400)); });
})();
// ---- 4. Plano em folha do nutricionista: tudo automático (quantidades da folha, OU, alvos a partir do plano) ----
(function(){
  var folha = [
    "Refeição 1 (pequeno-almoço):", "Café (sem açúcar) OU Chá (verde / branco)", "1 Fatia Pão Integral OU 1 Fatia Pão de forma", "50g Queijo Fresco Magro",
    "Refeição 2 (meio da manhã):", "150g Iogurte Skyr com 15g de Proteína",
    "Refeição 3 (almoço):", "70g Arroz Basmati / Massa Integral / Quinoa (assada + deixar repousar)", "100g Carne Branca (Peru / Frango) OU 100g Peixe Branco (Robalo / Pescada)", "150g Legumes Verdes (Brócolos / Couve-Flor)",
    "Refeição 4 (meio da tarde):", "1 Iogurte Proteico com 10-15g de Proteína", "100g Morangos OU 100g Uvas OU 100g Tangerina",
    "Refeição 5 (jantar):", "70g Arroz Basmati / Massa Integral", "100g Carne Branca OU 100g Peixe Branco", "100g Legumes Verdes",
    "Hidratação → 3L Água"
  ].join("\n");
  var d = draftPlanFromPlanSheet(folha);
  function f(meal, re){ var m = d.filter(function(x){ return x.mealName === meal; })[0]; return m && m.foods.filter(function(x){ return re.test(x.name); })[0]; }
  check.check("4. Skyr reconhecido, com os 150 g escritos (não 136 g pela proteína)", f("Meio da manhã", /skyr/i) && f("Meio da manhã", /skyr/i).qty === "150 g");
  check.check("4. Iogurte proteico reconhecido (nada por reconhecer no plano todo)", !!f("Lanche", /proteico/i) && d.every(function(x){ return x.unmatchedLines.length === 0; }));
  check.check("4. 'Arroz 70 g' num plano de nutricionista é arroz cru (70 g), não cozido", f("Almoço", /Arroz/) && f("Almoço", /Arroz/).name === "Arroz (cru)" && f("Almoço", /Arroz/).qty === "70 g");
  check.check("4. No questionário do aluno continua a ser arroz cozido", draftPlanFromDailyText("Almoço\n70g Arroz Basmati")[0].foods[0].name === "Arroz (cozido)");
  check.check("4. Cada 'OU' dá um só alimento (carne/peixe = 1, fruta = 1)", d.filter(function(x){ return x.mealName === "Almoço"; })[0].foods.length === 3 && d.filter(function(x){ return x.mealName === "Lanche"; })[0].foods.length === 2);
  check.check("4. Texto entre parênteses (variantes) não cria alimentos nem avisos", d.every(function(x){ return x.unmatchedLines.length === 0; }));
  // alvos a partir do plano
  var s = {targets:{kcal:2500, protein:50, carbs:300, fat:80}, meals:[]};
  d.forEach(function(x){ var m = meal(x.mealName, x.mealTime, []); x.foods.forEach(function(y){ m.foods.push(food(y.name, y.qty, y.group)); }); s.meals.push(m); });
  var el = {querySelector: function(sel){ return sel === "#pastedTargets" ? {checked:true} : (sel === "#pastedReplace" ? {checked:true} : null); }};
  setTargetsFromPlanIfAsked(el, s);
  var tot = foodsTotals(s.meals.reduce(function(a, m){ return a.concat(m.foods); }, []));
  check.check("4. Os alvos passam a ser exatamente o que o plano dá (sem 'ajustar quantidades')", s.targets.kcal === Math.round(tot.kcal) && s.targets.protein === Math.round(tot.p) && s.targets.carbs === Math.round(tot.c) && s.targets.fat === Math.round(tot.f));
  check.check("4. Os alvos são realistas (1000 a 2000 kcal) para este plano", s.targets.kcal > 1000 && s.targets.kcal < 2000);
  var s2 = {targets:{kcal:100}, meals:[meal("Antigo","12:00",[food("Ovos","2 unid.","carnes")])]};
  clearPlanIfReplacing({querySelector: function(){ return {checked:true}; }}, s2, d);
  check.check("4. 'Substituir o plano atual' apaga as refeições antigas", s2.meals.length === 0);
  var s3 = {targets:{kcal:100}, meals:[meal("Antigo","12:00",[])]};
  clearPlanIfReplacing({querySelector: function(){ return {checked:false}; }}, s3, d);
  check.check("4. Sem a opção, mantém as refeições", s3.meals.length === 1);
})();
check.summarize();
