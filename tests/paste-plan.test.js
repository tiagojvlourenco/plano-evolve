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
  var d = draftPlanFromDailyText(folha);
  function f(meal, re){ var m = d.filter(function(x){ return x.mealName === meal; })[0]; return m && m.foods.filter(function(x){ return re.test(x.name); })[0]; }
  check.check("4. Skyr reconhecido, com os 150 g escritos (não 136 g pela proteína)", f("Meio da manhã", /skyr/i) && f("Meio da manhã", /skyr/i).qty === "150 g");
  check.check("4. Iogurte proteico reconhecido (nada por reconhecer no plano todo)", !!f("Lanche", /proteico/i) && d.every(function(x){ return x.unmatchedLines.length === 0; }));
  check.check("4. 'Arroz 70 g' é arroz cozido, 70 g (a comida pesa-se já feita)", f("Almoço", /Arroz/) && f("Almoço", /Arroz/).name === "Arroz (cozido)" && f("Almoço", /Arroz/).qty === "70 g");
  check.check("4. Cada 'OU' dá um só alimento (carne/peixe = 1, fruta = 1)", d.filter(function(x){ return x.mealName === "Almoço"; })[0].foods.length === 3 && d.filter(function(x){ return x.mealName === "Lanche"; })[0].foods.length === 2);
  check.check("4. Texto entre parênteses (variantes) não cria alimentos nem avisos", d.every(function(x){ return x.unmatchedLines.length === 0; }));
  // alvos a partir do plano
  var s = {targets:{kcal:2500, protein:50, carbs:300, fat:80}, meals:[]};
  d.forEach(function(x){ var m = meal(x.mealName, x.mealTime, []); x.foods.forEach(function(y){ m.foods.push(food(y.name, y.qty, y.group)); }); s.meals.push(m); });
  var el = {querySelector: function(sel){ return sel === "#pastedTargets" ? {checked:true} : (sel === "#pastedReplace" ? {checked:true} : null); }};
  setTargetsFromPlanIfAsked(el, s);
  var tot = foodsTotals(s.meals.reduce(function(a, m){ return a.concat(m.foods); }, []));
  check.check("4. Os alvos passam a ser exatamente o que o plano dá (sem 'ajustar quantidades')", s.targets.kcal === Math.round(tot.kcal) && s.targets.protein === Math.round(tot.p) && s.targets.carbs === Math.round(tot.c) && s.targets.fat === Math.round(tot.f));
    var s2 = {targets:{kcal:100}, meals:[meal("Antigo","12:00",[food("Ovos","2 unid.","carnes")])]};
  clearPlanIfReplacing({querySelector: function(){ return {checked:true}; }}, s2, d);
  check.check("4. 'Substituir o plano atual' apaga as refeições antigas", s2.meals.length === 0);
  var s3 = {targets:{kcal:100}, meals:[meal("Antigo","12:00",[])]};
  clearPlanIfReplacing({querySelector: function(){ return {checked:false}; }}, s3, d);
  check.check("4. Sem a opção, mantém as refeições", s3.meals.length === 1);
})();
// ---- 5. YoPRO de mirtilo (Danone, copo de 120 g, EAN 8410500030865: 54 kcal, 9,4 g proteína, 3,7 g hidratos, 0,1 g gordura por 100 g) ----
(function(){
  var n = "Iogurte proteico de mirtilo (YoPro Danone)";
  check.check("5. Existe na base com os valores por 100 g do rótulo", FOOD_DB[n] && FOOD_DB[n].kcal === 54 && FOOD_DB[n].p === 9.4 && FOOD_DB[n].c === 3.7 && FOOD_DB[n].f === 0.1);
  var copo = foodNutrition(n, "120 g");
  check.check("5. Um copo (120 g) dá ≈ 11 g de proteína e 65 kcal", Math.abs(copo.p - 11) < 0.5 && copo.kcal === 65);
  check.check("5. Está no grupo Lacticínios, com o copo de 120 g como quantidade-padrão", groupOfFood(n) === "laticinios" && defaultQtyForFood(n) === "120 g");
  check.check("5. '1 YoPRO mirtilo' e '1 iogurte proteico YoPRO de mirtilo' → o produto, 120 g (não Mirtilos 100 g)", [matchDraftPhrase("1 YoPRO mirtilo"), matchDraftPhrase("1 Iogurte Proteico YoPRO de mirtilo")].every(function(r){ return r && r.name === n && r.qty === "120 g"; }));
  check.check("5. 'Iogurte proteico' sem sabor continua a ser o genérico", matchDraftPhrase("1 Iogurte Proteico com 10-15g de Proteína").name === "Iogurte proteico");
})();
// ---- 6. Sem desperdício: produtos que se estragam depois de abertos usam embalagens inteiras ----
(function(){
  var n = "Iogurte proteico de mirtilo (YoPro Danone)";
  check.check("6. Iogurtes, queijo, leite, fiambre... contam como perecíveis depois de abertos", isPerishableAfterOpening("Iogurte skyr natural") && isPerishableAfterOpening("Queijo fresco magro") && isPerishableAfterOpening("Leite meio gordo") && !isPerishableAfterOpening("Arroz (cozido)"));
  check.check("6. Copo de 120 g: 200 g deixa 40 g por consumir; 120 g e 240 g não deixam nada", packLeftover(n, "200 g") === 40 && packLeftover(n, "120 g") === 0 && packLeftover(n, "240 g") === 0);
  check.check("6. Sem tamanho de embalagem conhecido não inventa desperdício", packLeftover("Iogurte skyr natural", "200 g") === 0);
  check.check("6. snapToWholePacks: 200 g → 240 g (2 copos), 100 g → 120 g (nunca menos de 1 copo)", snapToWholePacks(n, 200) === 240 && snapToWholePacks(n, 100) === 120);
  check.check("6. Texto '200 g de YoPRO mirtilo' vira embalagens inteiras (240 g), não 200 g", matchDraftPhrase("200g YoPRO mirtilo").qty === "240 g");
  var hint = packWasteHint({name:n, qty:"200 g"});
  check.check("6. O editor avisa do desperdício e sugere 120 g ou 240 g", /deixa 40 g por consumir/.test(hint) && /120 g ou 240 g/.test(hint) && packWasteHint({name:n, qty:"240 g"}) === "");
  var s = {targets:{kcal:1400, protein:110, carbs:150, fat:40}, meals:[meal("Lanche","17:00",[food(n,"120 g","laticinios"), food("Frango (peito)","100 g","carnes"), food("Arroz (cozido)","70 g","cereais")])]};
  autoAdjustPlanQuantities(s);
  check.check("6. O 'Ajustar quantidades' nunca mexe numa embalagem fechada (continua 120 g)", s.meals[0].foods[0].qty === "120 g");
  var real = {name:"Iogurte natural batido", brand:"Marca", food_group:"laticinios", kcal:60, protein:4, carbs:5, fat:3, package_quantity:125, package_unit:"g"};
  mergeFoodProduct(real, []);
  var nm = foodProductDisplayName(real, []);
  check.check("6. Produtos do catálogo perecíveis com embalagem individual (≤ 350 g) passam a ter embalagem conhecida", packSizeOf(nm) === 125);
  var multi = {name:"Iogurte pack família", brand:"Marca", food_group:"laticinios", kcal:60, protein:4, carbs:5, fat:3, package_quantity:480, package_unit:"g"};
  mergeFoodProduct(multi, []);
  check.check("6. Packs grandes (480 g = 4 copos) não são tratados como uma só embalagem", packSizeOf(foodProductDisplayName(multi, [])) === 0);
})();
// ---- 7. Queijo fresco Continente (4 x 62,5 g fechados): 50 g do plano → 1 unidade inteira ----
(function(){
  var n = "Queijo fresco longa duração light (Continente Equilíbrio)";
  check.check("7. Existe na base com os valores por 100 g (101 kcal, 11 g proteína, 4,9 g hidratos, 4 g gordura)", FOOD_DB[n] && FOOD_DB[n].kcal === 101 && FOOD_DB[n].p === 11 && FOOD_DB[n].c === 4.9 && FOOD_DB[n].f === 4);
  check.check("7. Unidade de 62,5 g: 63 g (1 unidade) e 125 g (2) sem sobras; 100 g deixa sobras", packLeftover(n, "63 g") === 0 && packLeftover(n, "125 g") === 0 && packLeftover(n, "100 g") > 0);
  var d = applyPreferredProducts(draftPlanFromDailyText("Refeição 1 (pequeno-almoço)\n1 Fatia Pão Integral\n50g Queijo Fresco Magro"));
  var q = d[0].foods.filter(function(f){ return /^Queijo/.test(f.name); })[0];
  var h = "Queijo fresco light (Hacendado)";
  check.check("7. No plano colado, 'queijo fresco magro' 50 g vira o queijo do Mercadona (Hacendado), 1 unidade (63 g)", q && q.name === h && q.qty === "63 g" && q.group === "laticinios");
  check.check("7. Hacendado: 99 kcal, 11 g proteína, 4,4 g hidratos, 4 g gordura por 100 g; unidades de 62,5 g", FOOD_DB[h].kcal === 99 && FOOD_DB[h].p === 11 && FOOD_DB[h].c === 4.4 && FOOD_DB[h].f === 4 && packSizeOf(h) === 62.5 && packLeftover(h, "63 g") === 0 && packLeftover(h, "50 g") > 0);
  var quest = draftPlanFromDailyText("Pequeno-almoço\n* 60 g queijo fresco magro")[0].foods.filter(function(f){ return /^Queijo/.test(f.name); })[0];
  check.check("7. No questionário do aluno continua o genérico (60 g), sem trocar de produto", quest && quest.name === "Queijo fresco magro" && quest.qty === "60 g");
})();
// ---- 8. "Iogurte proteico" no plano colado = o YoPRO de mirtilo que a aluna compra (1 copo de 120 g) ----
(function(){
  var d = applyPreferredProducts(draftPlanFromDailyText("Refeição 4 (meio da tarde)\n1 Iogurte Proteico com 10-15g de Proteína\n100g Morangos OU 100g Uvas"));
  var y = d[0].foods.filter(function(f){ return /YoPro/.test(f.name); })[0];
  check.check("8. '1 iogurte proteico (10-15 g proteína)' → YoPRO mirtilo, 1 copo (120 g, ≈ 11 g de proteína)", y && y.name === "Iogurte proteico de mirtilo (YoPro Danone)" && y.qty === "120 g" && y.group === "laticinios");
  var q = draftPlanFromDailyText("Meio da manhã\n1 iogurte proteico")[0].foods[0];
  check.check("8. No questionário do aluno continua o iogurte proteico genérico", q.name === "Iogurte proteico");
})();
// ---- 9. Notas manuscritas ("Leia ...") com várias linhas, gralha "logurte" e campos de hora que não saem do cartão ----
(function(){
  var base = "Refeição 4 (meio da tarde):\n1 logurte Proteico com 10-15g de Proteína\n100g Morangos OU 100g Uvas\nRefeição 5 (jantar):\n70g Arroz Basmati\n100g Carne Branca";
  var d = draftPlanFromDailyText(base + "\nHidratação → 3L Água\nLeia (caso seja preciso):\nIogurte Proteico com 10-15g de Proteína");
  function m(n){ return d.filter(function(x){ return x.mealName === n; })[0]; }
  check.check("9. 'logurte' (I maiúsculo lido como l) é lido como iogurte", m("Lanche").foods.some(function(f){ return /^Iogurte/.test(f.name); }));
  check.check("9. As linhas depois de 'Leia (...)' não acrescentam alimentos ao jantar", m("Jantar").foods.length === 2 && !m("Jantar").foods.some(function(f){ return /Iogurte/.test(f.name); }));
  var html = require("fs").readFileSync(require("path").join(__dirname, "..", "index.html"), "utf8");
  check.check("9. Campos de hora/data sem aspeto nativo e limitados à coluna (iOS)", /input\[type="time"\], input\[type="date"\]\{\s*-webkit-appearance:none; appearance:none; display:block;[^}]*width:100%; min-width:0; max-width:100%/.test(html));
})();
check.summarize();
