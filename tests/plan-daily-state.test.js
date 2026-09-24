// Correção pós-Fase 7: separa a estrutura do plano (meals, só o profissional)
// da execução diária do aluno (mealDailyState). Prova que nenhuma ação do
// aluno consegue alterar a estrutura do plano, e que a execução diária
// (concluir, adaptar, ignorar, marcar flexível, reagendar, escolhas do
// construtor, substituições dentro das opções permitidas) continua a funcionar.
require("./setup")();
eval(require("./extract-app")());
var check = require("./check")();

function freshStudent(){
  return {
    id:"x", flexibility:50, flexOverrides:{}, blockedFoods:[],
    substitutionHistory:[], adaptationHistory:[],
    meals:[
      meal("Almoço","13:00",[
        food("Frango (peito)","150 g","protein"),
        food("Arroz (cozido)","120 g","carb"),
        food("Brócolos","à vontade","veg"),
        food("Azeite","10 ml","fat", false)
      ]),
      meal("Jantar","20:00",[food("Pescada","170 g","protein")])
    ]
  };
}

function structureSnapshot(s){
  // só os campos estruturais — se algum dia "meal()" ganhar mais campos de
  // estado por omissão, este snapshot ainda assim só olha para o que interessa.
  return JSON.stringify(s.meals.map(function(m){
    return {name:m.name, time:m.time, foods:m.foods.map(function(f){ return {name:f.name, qty:f.qty, group:f.group, required:f.required}; })};
  }));
}

// 1. Cada ação do aluno passa pela vista resolvida, nunca por s.meals diretamente
(function(){
  var s = freshStudent();
  var before = structureSnapshot(s);

  // concluir
  var m0 = resolveMealsForToday(s)[0]; m0.done = true; commitMealView(s, m0);
  // adaptar
  var m1 = resolveMealsForToday(s)[1]; m1.adapted = true; commitMealView(s, m1);
  // ignorar
  skipMeal(s, resolveMealsForToday(s)[0]); commitMealView(s, resolveMealsForToday(s)[0]);
  // reagendar
  var m0b = resolveMealsForToday(s)[0]; rescheduleMeal(s, m0b, "14:30"); commitMealView(s, m0b);
  // flexível
  var m1b = resolveMealsForToday(s)[1]; markFlexible(s, m1b, "restaurante"); commitMealView(s, m1b);
  // liveChoice
  var m0c = resolveMealsForToday(s)[0]; m0c.liveChoice = {protein: 0}; commitMealView(s, m0c);
  // substituição de alimento
  var m0d = resolveMealsForToday(s)[0]; applySubstitution(s, m0d, 0, {name:"Peru (fatiado)", qty:"150 g"}); commitMealView(s, m0d);

  check.check("1. Depois de TODAS as ações possíveis do aluno, a estrutura do plano (meals) não mudou nem um byte",
    structureSnapshot(s) === before);
})();

// 2. A execução diária reflete corretamente cada ação (não fica tudo perdido)
(function(){
  var s = freshStudent();
  var m0 = resolveMealsForToday(s)[0];
  m0.done = true;
  commitMealView(s, m0);
  check.check("2. Concluir reflete-se na vista de hoje", resolveMealsForToday(s)[0].done === true);

  var m1 = resolveMealsForToday(s)[1];
  m1.adapted = true;
  commitMealView(s, m1);
  check.check("2. Adaptar reflete-se na vista de hoje", resolveMealsForToday(s)[1].adapted === true);
  check.check("2. Concluir a primeira refeição não afeta a segunda (estado por refeição)", resolveMealsForToday(s)[1].done === false);
})();

(function(){
  var s = freshStudent();
  var m = resolveMealsForToday(s)[0];
  skipMeal(s, m);
  commitMealView(s, m);
  var view = resolveMealsForToday(s)[0];
  check.check("3. Ignorar reflete-se na vista de hoje", view.status === "skipped");
  check.check("3. Refeição ignorada não conta para os totais", mealCountsToday(view) === false);
})();

(function(){
  var s = freshStudent();
  var m = resolveMealsForToday(s)[0];
  rescheduleMeal(s, m, "15:00");
  commitMealView(s, m);
  var view = resolveMealsForToday(s)[0];
  check.check("4. Reagendar reflete-se na vista de hoje", view.rescheduledTime === "15:00" && view.status === "rescheduled");
  check.check("4. O horário planeado na estrutura nunca muda", s.meals[0].time === "13:00");
})();

(function(){
  var s = freshStudent();
  var m = resolveMealsForToday(s)[1];
  markFlexible(s, m, "restaurante");
  commitMealView(s, m);
  var view = resolveMealsForToday(s)[1];
  check.check("5. Marcar flexível reflete-se na vista de hoje", view.status === "flexible");
  check.check("5. Refeição flexível conta para os totais", mealCountsToday(view) === true);
})();

(function(){
  var s = freshStudent();
  var m = resolveMealsForToday(s)[0];
  m.liveChoice = {protein: 1};
  commitMealView(s, m);
  check.check("6. Escolha do construtor reflete-se na vista de hoje", resolveMealsForToday(s)[0].liveChoice.protein === 1);
})();

// 7. Substituição: aparece na vista, nunca na estrutura; revert repõe a vista
(function(){
  var s = freshStudent();
  var view = resolveMealsForToday(s)[0];
  applySubstitution(s, view, 0, {name:"Peru (fatiado)", qty:"150 g"});
  commitMealView(s, view);
  check.check("7. Substituição aparece na vista de hoje", resolveMealsForToday(s)[0].foods[0].name === "Peru (fatiado)");
  check.check("7. Substituição NUNCA aparece na estrutura do plano", s.meals[0].foods[0].name === "Frango (peito)");

  var view2 = resolveMealsForToday(s)[0];
  revertMeal(view2);
  commitMealView(s, view2);
  check.check("7. Reverter repõe o alimento original na vista de hoje", resolveMealsForToday(s)[0].foods[0].name === "Frango (peito)");
})();

// 8. Um novo dia reinicia a execução diária sem tocar na estrutura do plano
(function(){
  var s = freshStudent();
  var m = resolveMealsForToday(s)[0];
  m.done = true;
  commitMealView(s, m);
  s.mealsDate = "2000-01-01";
  var structureBefore = structureSnapshot(s);
  ensureFreshDay(s);
  check.check("8. Novo dia reinicia done/adapted/status de todas as refeições", resolveMealsForToday(s).every(function(v){ return !v.done && !v.adapted && v.status === "planned"; }));
  check.check("8. Novo dia não altera a estrutura do plano", structureSnapshot(s) === structureBefore);
})();

// 9. Persistência: studentToRow nunca envia estado do dia dentro de "meals"
(function(){
  var s = freshStudent();
  var m = resolveMealsForToday(s)[0];
  m.done = true; m.adapted = true;
  applySubstitution(s, m, 0, {name:"Peru (fatiado)", qty:"150 g"});
  commitMealView(s, m);
  var row = studentToRow(s);
  check.check("9. meals gravado na BD não tem 'done'", row.meals[0].done === undefined);
  check.check("9. meals gravado na BD não tem 'adapted'", row.meals[0].adapted === undefined);
  check.check("9. meals gravado na BD não tem 'status'", row.meals[0].status === undefined);
  check.check("9. meals gravado na BD não tem 'liveChoice'", row.meals[0].liveChoice === undefined);
  check.check("9. Os alimentos gravados não têm 'original' (substituição aplicada)", row.meals[0].foods[0].original === undefined);
  check.check("9. Os alimentos gravados mantêm o nome estrutural original", row.meals[0].foods[0].name === "Frango (peito)");
  check.check("9. meal_daily_state é gravado separadamente com o estado real", row.meal_daily_state.entries["Almoço@13:00"].done === true);
})();

// 10. stripMealState defende mesmo que s.meals já venha "sujo" em memória
// (ex.: dados antigos carregados antes desta migração, ainda não normalizados)
(function(){
  var dirtyMeal = meal("Pequeno-almoço","08:00",[food("Ovos","2 unid.","protein")]);
  dirtyMeal.done = true; dirtyMeal.adapted = true; dirtyMeal.liveChoice = {protein:0};
  var clean = stripMealState(dirtyMeal);
  check.check("10. stripMealState remove todos os campos de estado", clean.done === undefined && clean.adapted === undefined && clean.liveChoice === undefined && clean.status === undefined && clean.rescheduledTime === undefined);
  check.check("10. stripMealState preserva nome/horário/alimentos", clean.name === "Pequeno-almoço" && clean.time === "08:00" && clean.foods.length === 1);
})();

// 11. Migração de dados antigos: estado embutido em "meals" (antes desta fase)
// é recuperado para mealDailyState na primeira leitura, sem perder o dia do aluno
(function(){
  var legacyRow = {
    id:"legacy", name:"Aluno Antigo", meals:[
      Object.assign(meal("Almoço","13:00",[
        {name:"Peru (fatiado)", qty:"150 g", group:"protein", original:{name:"Frango (peito)", qty:"150 g"}}
      ]), {done:false, adapted:true, status:"planned", rescheduledTime:null, liveChoice:null})
    ],
    meal_daily_state: null // ainda não existia nesta linha antiga
  };
  var s = rowToStudent(legacyRow);
  check.check("11. A estrutura fica limpa (sem estado residual)", s.meals[0].adapted === undefined && s.meals[0].foods[0].original === undefined);
  check.check("11. A estrutura recupera o nome original do alimento (não o substituído)", s.meals[0].foods[0].name === "Frango (peito)");
  check.check("11. O estado antigo foi migrado para mealDailyState", s.mealDailyState && s.mealDailyState.entries["Almoço@13:00"].adapted === true);
  check.check("11. A vista combinada mostra a substituição migrada", resolveMealsForToday(s)[0].foods[0].name === "Peru (fatiado)");
})();

// 12. Aluno sem nenhum estado residual não gera mealDailyState do nada
(function(){
  var row = { id:"novo", meals:[meal("Almoço","13:00",[food("Frango (peito)","150 g","protein")])], meal_daily_state: null };
  var s = rowToStudent(row);
  check.check("12. Sem estado residual, mealDailyState fica null (nada para migrar)", s.mealDailyState === null);
})();

check.summarize();
