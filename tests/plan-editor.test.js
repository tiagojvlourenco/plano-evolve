// Editor de refeições/alimentos (profissional) — CRUD, prevenção de "ml", escapeHtml/XSS.
require("./setup")();
eval(require("./extract-app")());
var check = require("./check")();

function freshStudent(){
  return { meals: [], flexibility: 50, flexOverrides: {}, blockedFoods: [] };
}

// 1. Adicionar refeição — insere e ordena por horário
(function(){
  var s = freshStudent();
  s.meals.push(meal("Jantar","20:00",[]));
  addMealToPlan(s); // "Nova refeição" às 12:00
  check.check("1. Nova refeição inserida", s.meals.length === 2);
  check.check("1. Fica ordenada por horário (12:00 antes de 20:00)", s.meals[0].time === "12:00" && s.meals[1].time === "20:00");
})();

// 2. Remover refeição por referência (nunca por índice, evita apagar a errada)
(function(){
  var s = freshStudent();
  var a = meal("Pequeno-almoço","08:00",[]);
  var b = meal("Almoço","13:00",[]);
  s.meals.push(a, b);
  removeMealFromPlan(s, a);
  check.check("2. Remove exatamente a refeição indicada", s.meals.length === 1 && s.meals[0] === b);
})();

// 3. sortMealsByTime reordena sempre que o horário muda, sem perder identidade
(function(){
  var s = freshStudent();
  var a = meal("Almoço","13:00",[]);
  var b = meal("Jantar","20:00",[]);
  s.meals.push(a, b);
  b.time = "07:00"; // aluno passou o "Jantar" para de manhã (caso extremo, mas válido)
  sortMealsByTime(s);
  check.check("3. Reordena corretamente após mudança de horário", s.meals[0] === b && s.meals[1] === a);
})();

// 4. foodOptionsForGroup só devolve nomes de FOOD_GROUPS (nunca texto livre)
(function(){
  var opts = foodOptionsForGroup("protein");
  check.check("4. Devolve todas as proteínas definidas", opts.indexOf("Frango (peito)") >= 0 && opts.indexOf("Ovos") >= 0);
  check.check("4. Grupo inexistente devolve lista vazia, não rebenta", foodOptionsForGroup("inexistente").length === 0);
})();

// 5. unitKindFor reflete o FOOD_DB real
(function(){
  check.check("5. Frango (peito) é 100g", unitKindFor("Frango (peito)") === "100g");
  check.check("5. Ovos é unit", unitKindFor("Ovos") === "unit");
  check.check("5. Brócolos é fixed", unitKindFor("Brócolos") === "fixed");
  check.check("5. Alimento desconhecido devolve null", unitKindFor("Alimento Inventado") === null);
})();

// 6. buildQtyString nunca inventa uma quantidade para alimento desconhecido, e NUNCA produz "ml"
(function(){
  check.check("6. 100g é sempre em gramas", buildQtyString("Frango (peito)", 150) === "150 g");
  check.check("6. Alimento líquido (Azeite, 100g) também fica em gramas, nunca ml", buildQtyString("Azeite", 15) === "15 g");
  check.check("6. unit usa sempre 'unid.'", buildQtyString("Ovos", 3) === "3 unid.");
  check.check("6. fixed ignora amount e devolve 'à vontade'", buildQtyString("Brócolos", 999) === "à vontade");
  check.check("6. alimento desconhecido devolve null (nunca inventa quantidade)", buildQtyString("Alimento Inventado", 100) === null);
  check.check("6. amount <=0 nunca produz '0 g' ou negativo", buildQtyString("Frango (peito)", 0) === "1 g");
  check.check("6. amount negativo é sempre tratado como mínimo 1", buildQtyString("Frango (peito)", -50) === "1 g");
  check.check("6. Um 3º argumento (ex.: tentativa de forçar 'ml') é sempre ignorado", buildQtyString("Azeite", 15, "ml") === "15 g");
})();

// 7. addFoodToMeal só adiciona quando a quantidade é resolvível; nunca corrompe o array em caso de falha
(function(){
  var m = meal("Almoço","13:00",[]);
  var ok = addFoodToMeal(m, "Frango (peito)", "protein", 150);
  check.check("7. addFoodToMeal devolve true em caso de sucesso", ok === true);
  check.check("7. Alimento fica com nome/grupo/quantidade corretos", m.foods.length === 1 && m.foods[0].name === "Frango (peito)" && m.foods[0].qty === "150 g" && m.foods[0].group === "protein");

  var m2 = meal("Almoço","13:00",[]);
  var failOk = addFoodToMeal(m2, "Alimento Inventado", "protein", 150);
  check.check("8. addFoodToMeal recusa alimento desconhecido (devolve false)", failOk === false);
  check.check("8. Nada é adicionado quando a quantidade não é resolvível", m2.foods.length === 0);
})();

// 9. removeFoodFromMeal remove por referência, não por índice (evita apagar o alimento errado)
(function(){
  var m = meal("Almoço","13:00",[]);
  addFoodToMeal(m, "Frango (peito)", "protein", 150);
  addFoodToMeal(m, "Arroz (cozido)", "carb", 120, "g");
  var target = m.foods[0];
  removeFoodFromMeal(m, target);
  check.check("9. Remove exatamente o alimento indicado", m.foods.length === 1 && m.foods[0].name === "Arroz (cozido)");
})();

// 10. Nutrição do alimento adicionado é calculada corretamente pelo motor já existente (sem 0 kcal silencioso)
(function(){
  var m = meal("Almoço","13:00",[]);
  addFoodToMeal(m, "Frango (peito)", "protein", 150, "g");
  var totals = foodsTotals(m.foods);
  check.check("10. Frango (peito) 150g dá ~248 kcal (165*1.5)", Math.abs(totals.kcal - 248) <= 2);
  check.check("10. Nunca fica em 0 kcal para um alimento válido", totals.kcal > 0);
})();

// 11. Fluxo completo: criar refeição, adicionar 2 alimentos, remover 1, remover a refeição — sem afetar outras
(function(){
  var s = freshStudent();
  s.meals.push(meal("Jantar","20:00",[food("Pescada","170 g","protein")]));
  addMealToPlan(s);
  var novaRefeicao = s.meals.find(function(m){ return m.name === "Nova refeição"; });
  addFoodToMeal(novaRefeicao, "Ovos", "protein", 2, null);
  addFoodToMeal(novaRefeicao, "Pão integral", "carb", 70, "g");
  check.check("11. Refeição nova tem 2 alimentos", novaRefeicao.foods.length === 2);
  removeFoodFromMeal(novaRefeicao, novaRefeicao.foods[0]);
  check.check("11. Depois de remover 1, fica só com 1", novaRefeicao.foods.length === 1 && novaRefeicao.foods[0].name === "Pão integral");
  removeMealFromPlan(s, novaRefeicao);
  check.check("11. Remover a refeição não afeta a refeição 'Jantar' já existente", s.meals.length === 1 && s.meals[0].name === "Jantar" && s.meals[0].foods.length === 1);
})();

// 12. Substituições/flexibilidade não foram tocadas — continuam a funcionar exatamente como antes
(function(){
  var s = { flexibility: 50, flexOverrides: {}, blockedFoods: [] };
  var m = meal("Almoço","13:00",[food("Frango (peito)","150 g","protein")]);
  applySubstitution(s, m, 0, {name:"Peru (fatiado)", qty:"150 g"});
  check.check("12. applySubstitution continua a funcionar sem alterações", m.foods[0].name === "Peru (fatiado)" && m.adapted === true);
})();

// 13. escapeHtml neutraliza os caracteres que quebram HTML/atributos, sem alterar texto normal
(function(){
  check.check("13. Escapa < e >", escapeHtml("<script>alert(1)</script>") === "&lt;script&gt;alert(1)&lt;/script&gt;");
  check.check("13. Escapa aspas duplas (quebrariam um value=\"...\")", escapeHtml('Refeição "especial"') === "Refeição &quot;especial&quot;");
  check.check("13. Escapa aspas simples", escapeHtml("O aluno's plano") === "O aluno&#39;s plano");
  check.check("13. Escapa &", escapeHtml("Frango & Arroz") === "Frango &amp; Arroz");
  check.check("13. Texto normal fica inalterado", escapeHtml("Pequeno-almoço") === "Pequeno-almoço");
  check.check("13. null/undefined nunca rebentam, tratados como string vazia", escapeHtml(null) === "" && escapeHtml(undefined) === "");
})();

// 14. Um nome de refeição com HTML/aspas embutido nunca quebra o value="" do editor do profissional
(function(){
  var m = meal('Almoço <img src=x onerror=alert(1)> "teste"', "13:00", []);
  var html = tplPlanoMealEditor(m, 0);
  check.check("14. O HTML gerado não contém a tag <img> em bruto", html.indexOf("<img src=x") === -1);
  check.check("14. As aspas do nome não escapam do atributo value", html.indexOf('value="Almoço &lt;img') >= 0);
})();

check.summarize();
