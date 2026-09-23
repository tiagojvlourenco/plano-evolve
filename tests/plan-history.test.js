// Histórico automático do plano — regista ações do profissional em s.planHistory.
require("./setup")();
eval(require("./extract-app")());
var check = require("./check")();

function freshStudent(){
  return { meals: [], flexibility: 50, flexOverrides: {}, blockedFoods: [], planHistory: [] };
}

// 1. logPlanEvent regista um evento com os campos esperados
(function(){
  var s = freshStudent();
  logPlanEvent(s, "kcal", "Calorias: 1700 → 1850 kcal", 1700, 1850);
  check.check("1. Evento adicionado a planHistory", s.planHistory.length === 1);
  var e = s.planHistory[0];
  check.check("1. Evento tem data (YYYY-MM-DD)", /^\d{4}-\d{2}-\d{2}$/.test(e.date));
  check.check("1. Evento tem hora (HH:MM)", /^\d{2}:\d{2}$/.test(e.time));
  check.check("1. Evento tem timestamp ISO", typeof e.timestamp === "string" && e.timestamp.indexOf("T") > 0);
  check.check("1. Evento guarda o tipo", e.type === "kcal");
  check.check("1. Evento guarda o resumo legível", e.summary === "Calorias: 1700 → 1850 kcal");
  check.check("1. Evento guarda valor antes", e.before === 1700);
  check.check("1. Evento guarda valor depois", e.after === 1850);
})();

// 2. logPlanEvent não duplica quando não há alteração real (before === after)
(function(){
  var s = freshStudent();
  logPlanEvent(s, "kcal", "Calorias: 1700 → 1700 kcal", 1700, 1700);
  check.check("2. Sem alteração real (before===after) não regista nada", s.planHistory.length === 0);
})();

// 3. Cria planHistory se ainda não existir (aluno antigo sem o campo)
(function(){
  var s = { meals: [], flexibility: 50 };
  logPlanEvent(s, "flexibilidade", "Flexibilidade: 30 → 50", 30, 50);
  check.check("3. Cria planHistory automaticamente quando ausente", Array.isArray(s.planHistory) && s.planHistory.length === 1);
})();

// 4. Refeição adicionada
(function(){
  var s = freshStudent();
  var m = addMealToPlan(s);
  check.check("4. addMealToPlan devolve a refeição criada", m && m.name === "Nova refeição" && m.time === "12:00");
  logMealAdded(s, m);
  check.check("4. Regista 'Refeição adicionada' com nome e horário", s.planHistory[0].summary === "Refeição adicionada: Nova refeição — 12:00");
  check.check("4. Tipo correto", s.planHistory[0].type === "refeicao_criada");
})();

// 5. Refeição removida
(function(){
  var s = freshStudent();
  s.meals.push(meal("Lanche","17:00",[]));
  var label = s.meals[0].name + " — " + s.meals[0].time;
  removeMealFromPlan(s, s.meals[0]);
  logMealRemoved(s, label);
  check.check("5. Regista 'Refeição removida' com nome e horário", s.planHistory[0].summary === "Refeição removida: Lanche — 17:00");
  check.check("5. Tipo correto", s.planHistory[0].type === "refeicao_removida");
})();

// 6. Nome da refeição alterado
(function(){
  var s = freshStudent();
  logMealRenamed(s, "Jantar", "Jantar de sexta");
  check.check("6. Regista 'Nome alterado' com antes/depois", s.planHistory[0].summary === "Nome alterado: Jantar → Jantar de sexta");
  check.check("6. before/after corretos", s.planHistory[0].before === "Jantar" && s.planHistory[0].after === "Jantar de sexta");
})();

// 7. Horário da refeição alterado (exemplo do pedido)
(function(){
  var s = freshStudent();
  logMealRescheduled(s, "Jantar", "20:30", "21:00");
  check.check("7. Regista 'Horário alterado' exatamente como no exemplo", s.planHistory[0].summary === "Horário alterado: Jantar, 20:30 → 21:00");
})();

// 8. Alimento adicionado (exemplo do pedido)
(function(){
  var s = freshStudent();
  var m = meal("Pequeno-almoço","08:00",[]);
  addFoodToMeal(m, "Aveia", "carb", 50);
  var added = m.foods[0];
  logFoodAdded(s, m.name, added);
  check.check("8. Regista 'Alimento adicionado' exatamente como no exemplo", s.planHistory[0].summary === "Alimento adicionado: Aveia, 50 g, Pequeno-almoço");
})();

// 9. Alimento removido
(function(){
  var s = freshStudent();
  var m = meal("Almoço","13:00",[food("Frango (peito)","150 g","protein")]);
  var f = m.foods[0];
  removeFoodFromMeal(m, f);
  logFoodRemoved(s, m.name, f);
  check.check("9. Regista 'Alimento removido' com nome/qtd/refeição", s.planHistory[0].summary === "Alimento removido: Frango (peito), 150 g, Almoço");
})();

// 10. Alteração de calorias/proteína/hidratos/gordura — só regista o que muda
(function(){
  var s = freshStudent();
  var oldTargets = {kcal:1850, protein:131, carbs:177, fat:52};
  var newTargets = {kcal:1700, protein:131, carbs:160, fat:52}; // só kcal e carbs mudam
  logTargetsChange(s, oldTargets, newTargets);
  check.check("10. Regista só os macros que mudaram (kcal + carbs = 2 eventos)", s.planHistory.length === 2);
  check.check("10. Calorias no formato do exemplo do pedido", s.planHistory.some(function(e){ return e.summary === "Calorias: 1850 → 1700 kcal"; }));
  check.check("10. Hidratos com antes/depois corretos", s.planHistory.some(function(e){ return e.type === "carbs" && e.summary === "Hidratos: 177 → 160 g"; }));
  check.check("10. Não regista proteína nem gordura (não mudaram)", !s.planHistory.some(function(e){ return e.type === "protein" || e.type === "fat"; }));
})();

// 11. logTargetsChange usa carbsMax/fatMax quando o aluno usa intervalo (ex.: Sofia)
(function(){
  var s = freshStudent();
  var oldTargets = {kcal:1800, protein:135, carbsMax:180, fatMax:75};
  var newTargets = {kcal:1800, protein:135, carbs:150, fat:75};
  logTargetsChange(s, oldTargets, newTargets);
  check.check("11. Compara hidratos com carbsMax quando não há 'carbs' direto", s.planHistory.length === 1 && s.planHistory[0].type === "carbs" && s.planHistory[0].before === 180);
})();

// 12. Alteração de flexibilidade (exemplo do pedido)
(function(){
  var s = freshStudent();
  logFlexibilityChange(s, 50, 65);
  check.check("12. Regista 'Flexibilidade' exatamente como no exemplo", s.planHistory[0].summary === "Flexibilidade: 50 → 65");
})();

// 13. Alteração de personalizações de flexibilidade
(function(){
  var s = freshStudent();
  logOverrideChange(s, "mealBuilderEnabled", false, true);
  check.check("13. Regista personalização ativada com o rótulo legível", s.planHistory[0].summary === "Personalização: Permitir construtor de refeições → ativada");
  logOverrideChange(s, "mealBuilderEnabled", true, false);
  check.check("13. Regista também quando é desativada", s.planHistory[1].summary === "Personalização: Permitir construtor de refeições → desativada");
})();

// 14. Renderizar o separador Histórico nunca cria entradas (só ações guardadas criam)
(function(){
  var s = freshStudent();
  s.adaptationHistory = [];
  logPlanEvent(s, "kcal", "Calorias: 1700 → 1800 kcal", 1700, 1800);
  var before = s.planHistory.length;
  tplProHistorico(s);
  tplProHistorico(s);
  renderProTabContent && true; // renderProTabContent não é chamado aqui por depender de mais DOM; testamos a função de template diretamente
  check.check("14. Chamar tplProHistorico repetidamente não adiciona entradas", s.planHistory.length === before);
})();

// 15. Histórico mostra os eventos mais recentes primeiro
(function(){
  var s = freshStudent();
  s.adaptationHistory = [];
  logPlanEvent(s, "kcal", "Calorias: 1000 → 1100 kcal", 1000, 1100);
  logPlanEvent(s, "flexibilidade", "Flexibilidade: 20 → 40", 20, 40);
  var html = tplProHistorico(s);
  var idxFirst = html.indexOf("Calorias: 1000");
  var idxSecond = html.indexOf("Flexibilidade: 20");
  check.check("15. O evento mais recente (Flexibilidade) aparece antes do mais antigo (Calorias)", idxSecond >= 0 && idxFirst >= 0 && idxSecond < idxFirst);
})();

// 16. Registos antigos (snapshot legado) continuam a ser mostrados sem alterações
(function(){
  var maria = findStudent("maria");
  var html = tplProHistorico(maria);
  check.check("16. Snapshot legado 'Plano 3' continua visível", html.indexOf("Plano 3") >= 0);
  check.check("16. Snapshot legado mostra as calorias guardadas", html.indexOf("1850 kcal") >= 0);
})();

// 17. Segurança: o resumo de um evento é escapado antes de ir para o HTML (nomes de refeição/alimento vêm de texto livre)
(function(){
  var s = freshStudent();
  s.adaptationHistory = [];
  logMealRenamed(s, "Jantar", 'Jantar <img src=x onerror=alert(1)> "especial"');
  var html = tplProHistorico(s);
  check.check("17. Não injeta a tag <img> em bruto no histórico", html.indexOf("<img src=x") === -1);
  check.check("17. O texto aparece escapado", html.indexOf("&lt;img src=x") >= 0);
})();

// 18. Sem eventos registados, mostra mensagem em vez de secção vazia
(function(){
  var s = freshStudent();
  s.adaptationHistory = [];
  var html = tplProHistorico(s);
  check.check("18. Mensagem de histórico vazio quando não há eventos", /Ainda sem alterações registadas/.test(html));
})();

check.summarize();
