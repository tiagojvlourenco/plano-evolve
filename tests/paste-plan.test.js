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
  var d2 = draftPlanFromDailyText(full);
  var jantar = d2.filter(function(x){ return x.mealName === "Jantar"; })[0];
  check.check("3. A linha de hidratação/notas não acrescenta alimentos ao jantar", jantar.foods.length === 2 && !jantar.foods.some(function(f){ return /Chá|Água/.test(f.name); }) && jantar.unmatchedLines.length === 0);
  check.check("3. Chá e café ficam num grupo próprio (Bebidas), não em Snacks", groupOfFood("Chá, infusão, verde") === "bebidas" && groupOfFood("Café, infusão - bica") === "bebidas" && GROUP_LABELS.bebidas.indexOf("Bebidas") >= 0);
  var s = {targets:{kcal:1300, protein:90, carbs:120, fat:45}, meals:[meal("Almoço","13:00",[food("Chá, infusão, verde","100 ml","bebidas"), food("Pão integral","40 g","cereais"), food("Frango (peito)","100 g","carnes")])]};
  var r = autoAdjustPlanQuantities(s);
  check.check("3. O chá nunca é reescalado pelo ajuste automático", s.meals[0].foods[0].qty === "100 ml");
  s.meals[0].foods.forEach(function(f){ var q = parseFloat(f.qty); check.check("3. Ajuste automático nunca passa de 4x nem desce de 1/4 (" + f.name + " " + f.qty + ")", f.name.indexOf("Chá") === 0 || (q >= 10 && q <= 400)); });
})();
check.summarize();
