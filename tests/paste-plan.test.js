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
check.summarize();
