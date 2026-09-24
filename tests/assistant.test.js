// Fase 8 — Assistente Alimentar Guiado.
const fs = require("fs");
const path = require("path");
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

function freshStudent(overrides){
  var base = {
    id:"x", flexibility:50, flexOverrides:{}, blockedFoods:[],
    substitutionHistory:[], adaptationHistory:[],
    targets:{kcal:2000, protein:150, carbs:200, fat:60},
    meals:[
      meal("Almoço","13:00",[
        food("Frango (peito)","150 g","protein"),
        food("Arroz (cozido)","120 g","carb"),
        food("Brócolos","à vontade","veg")
      ])
    ]
  };
  Object.keys(overrides || {}).forEach(function(k){ base[k] = overrides[k]; });
  return base;
}

function structureSnapshot(s){
  return JSON.stringify({meals: s.meals, targets: s.targets, flexibility: s.flexibility});
}

// 1. As 8 situações pedidas, nem mais nem menos
(function(){
  var keys = ASSISTANT_SITUATIONS.map(function(sit){ return sit.key; });
  check.check("1. Tem exatamente 8 situações", keys.length === 8);
  ["sem_alimento","pouco_tempo","fora","horario","saltei","diferente","trocar","duvida"].forEach(function(k){
    check.check("1. Inclui a situação '" + k + "'", keys.indexOf(k) >= 0);
  });
})();

// 2. "Não tenho este alimento" com alimentos substituíveis -> escolher alimento
(function(){
  var s = freshStudent();
  var d = decideAssistantAction(s, "sem_alimento");
  check.check("2. Com alimentos substituíveis, decide 'pick_food'", d.action === "pick_food");
  check.check("2. A lista de alternativas inclui todos os alimentos com grupo", d.swappable.length === 3);
})();

// 3. Sem NENHUM alimento substituível -> não há resposta segura, encaminha para o profissional
(function(){
  var s = freshStudent({meals:[meal("Almoço","13:00",[{name:"Água", qty:"500 ml", group:null, required:true}])]});
  var d = decideAssistantAction(s, "sem_alimento");
  check.check("3. Sem alimentos substituíveis, decide 'ask_professional'", d.action === "ask_professional");
  check.check("3. A nota explica a situação", /Água|Nenhum alimento substituível/.test(d.note));
})();

// 4. Sem refeições previstas -> todas as situações dependentes de refeição caem em "no_meal"
(function(){
  var s = freshStudent({meals:[]});
  ["sem_alimento","horario","saltei","trocar"].forEach(function(k){
    check.check("4. Sem refeições, '" + k + "' cai em 'no_meal'", decideAssistantAction(s, k).action === "no_meal");
  });
})();

// 5. "Tenho pouco tempo" e "Vou comer fora" reaproveitam os fluxos já existentes
(function(){
  var s = freshStudent();
  check.check("5. 'pouco_tempo' encaminha para o fluxo já existente (openLowTime)", decideAssistantAction(s, "pouco_tempo").action === "low_time");
  check.check("5. 'fora' encaminha para o fluxo já existente (openScenarioPicker)", decideAssistantAction(s, "fora").action === "scenario_picker");
})();

// 6. "Alterei o horário" / "Saltei uma refeição" / "Quero trocar uma refeição" com refeição disponível
(function(){
  var s = freshStudent();
  check.check("6. 'horario' com refeição -> reschedule", decideAssistantAction(s, "horario").action === "reschedule");
  check.check("6. 'saltei' com refeição -> skip", decideAssistantAction(s, "saltei").action === "skip");
  check.check("6. 'trocar' com refeição -> swap_meal", decideAssistantAction(s, "trocar").action === "swap_meal");
})();

// 7. "Já comi algo diferente" funciona com e sem próxima refeição (nunca rebenta)
(function(){
  var s = freshStudent();
  var d1 = decideAssistantAction(s, "diferente");
  check.check("7. Com refeição disponível, devolve a refeição", d1.action === "different" && d1.meal != null);
  var s2 = freshStudent({meals:[]});
  var d2 = decideAssistantAction(s2, "diferente");
  check.check("7. Sem refeições, ainda funciona (meal null, sem rebentar)", d2.action === "different" && d2.meal === null);
})();

// 8. "Tenho outra dúvida sobre o plano" está sempre disponível, mesmo sem plano definido
(function(){
  var s = freshStudent({meals:[]});
  var d = decideAssistantAction(s, "duvida");
  check.check("8. 'duvida' nunca fica bloqueada", d.action === "ask_professional");
})();

// 9. Funciona igualmente para aluno estruturado, equilibrado e flexível
(function(){
  [25, 50, 85].forEach(function(flex){
    var s = freshStudent({flexibility: flex});
    var tierName = flexTier(flex);
    var d = decideAssistantAction(s, "sem_alimento");
    check.check("9. Nível " + tierName + " (" + flex + "): 'sem_alimento' decide 'pick_food'", d.action === "pick_food");
    check.check("9. Nível " + tierName + ": 'pouco_tempo' continua disponível", decideAssistantAction(s, "pouco_tempo").action === "low_time");
  });
})();

// 10. createHelpRequest regista um evento completo em adaptationHistory
(function(){
  var s = freshStudent();
  var m = s.meals[0];
  createHelpRequest(s, m, "duvida", "Tenho uma dúvida sobre o azeite.");
  check.check("10. Regista uma entrada em adaptationHistory", s.adaptationHistory.length === 1);
  var entry = s.adaptationHistory[0];
  check.check("10. Tipo 'pedido_profissional' (alimenta a Leitura profissional já existente)", entry.type === "pedido_profissional");
  check.check("10. Guarda a situação escolhida", entry.situation === "duvida");
  check.check("10. Guarda o texto livre", entry.note === "Tenho uma dúvida sobre o azeite.");
  check.check("10. Guarda o nome da refeição associada", entry.meal === "Almoço");
})();

// 11. createHelpRequest funciona sem refeição associada (dúvida genérica)
(function(){
  var s = freshStudent();
  createHelpRequest(s, null, "duvida", "Dúvida geral sobre o plano.");
  check.check("11. Sem refeição associada, meal fica null (não rebenta)", s.adaptationHistory[0].meal === null);
})();

// 12. SEGURANÇA: nenhuma ação possível do assistente altera a estrutura do plano
(function(){
  var s = freshStudent();
  var before = structureSnapshot(s);

  var m0 = resolveMealsForToday(s)[0];
  markFlexible(s, m0, "diferente"); commitMealView(s, m0);

  var m1 = resolveMealsForToday(s)[0];
  skipMeal(s, m1); commitMealView(s, m1);

  var m2 = resolveMealsForToday(s)[0];
  rescheduleMeal(s, m2, "14:00"); commitMealView(s, m2);

  var m3 = resolveMealsForToday(s)[0];
  applySubstitution(s, m3, 0, {name:"Peru (fatiado)", qty:"150 g"}); commitMealView(s, m3);

  var m4 = resolveMealsForToday(s)[0];
  m4.adapted = true; logAdaptation(s, m4, "adaptacao", {reason:"Troca de refeição"}); commitMealView(s, m4);

  createHelpRequest(s, resolveMealsForToday(s)[0], "duvida", "teste");

  check.check("12. Depois de TODAS as ações do assistente, a estrutura do plano (meals/targets/flexibility) não mudou nem um byte",
    structureSnapshot(s) === before);
})();

// 13. Nunca sugere um alimento bloqueado como alternativa, mesmo através do assistente
(function(){
  var s = freshStudent({blockedFoods:["Peru (fatiado)"]});
  var d = decideAssistantAction(s, "sem_alimento");
  var f = d.swappable[0]; // Frango (peito)
  var opts = optionsFor(f, s);
  check.check("13. As alternativas do assistente nunca incluem um alimento bloqueado", opts.every(function(o){ return o.name !== "Peru (fatiado)"; }));
})();

// 14. Marcar como tratado e guardar nota são ações independentes (uma não faz a outra)
(function(){
  check.check("14. markHelpRequestHandled só muda o status, nunca escreve em help_request_notes", markHelpRequestHandled.toString().indexOf("help_request_notes") === -1);
  check.check("14. saveHelpRequestNote só escreve a nota, nunca muda o status", saveHelpRequestNote.toString().indexOf('"tratado"') === -1 && saveHelpRequestNote.toString().indexOf("status") === -1);
})();

// 15. HELP_SITUATION_LABEL cobre todas as situações com o mesmo texto do menu
(function(){
  ASSISTANT_SITUATIONS.forEach(function(sit){
    check.check("15. HELP_SITUATION_LABEL tem o label certo para '" + sit.key + "'", HELP_SITUATION_LABEL[sit.key] === sit.label);
  });
})();

// 16. Nunca sugere jejum, punição, compensação extrema ou "dia do lixo" (regra 2)
(function(){
  var start = appSource.indexOf("var ASSISTANT_SITUATIONS");
  var end = appSource.indexOf("function openMealDetail");
  var assistantCode = appSource.slice(start, end);
  check.check("16. Encontrou o bloco de código do assistente para analisar", start >= 0 && end > start);
  check.check("16. Não sugere jejum, castigo, punição, compensação nem 'dia do lixo'",
    /jejum|castigo|puni[çc][ãa]o|compensar|compensação|dia do lixo/i.test(assistantCode) === false);
})();

// ---- Lado profissional: tplProPedidos ----

// 17. Escapa texto livre do aluno (nunca injeta HTML em bruto)
(function(){
  var s = {id:"x", name:"Aluno Teste"};
  var reqs = [{
    id:"r1", situation:"duvida", meal_name:null,
    note:'<img src=x onerror=alert(1)>', status:"pendente",
    created_at:"2026-09-24T10:00:00Z", help_request_notes:null
  }];
  var html = tplProPedidos(s, reqs);
  check.check("17. Não injeta <img> em bruto vindo do texto livre do aluno", html.indexOf("<img src=x") === -1);
  check.check("17. Mostra o label da situação escolhida", html.indexOf("Tenho outra dúvida sobre o plano") >= 0);
  check.check("17. Mostra o pedido como 'Pendente'", html.indexOf("Pendente") >= 0);
})();

// 18. Sem pedidos, mostra mensagem clara em vez de secção vazia
(function(){
  var html = tplProPedidos({id:"x", name:"Aluno"}, []);
  check.check("18. Sem pedidos mostra mensagem clara", /Ainda sem pedidos/.test(html));
})();

// 19. Um pedido já tratado não mostra o botão de marcar como tratado outra vez
(function(){
  var reqs = [{id:"r1", situation:"pouco_tempo", meal_name:"Almoço", note:"", status:"tratado", created_at:"2026-09-24T10:00:00Z", help_request_notes:{professional_note:"Já foi resolvido por telefone."}}];
  var html = tplProPedidos({id:"x", name:"Aluno"}, reqs);
  check.check("19. Mostra 'Tratado'", html.indexOf("Tratado") >= 0);
  check.check("19. Não mostra botão de marcar como tratado outra vez", html.indexOf("pedido-tratado") === -1);
  check.check("19. Mostra a nota privada já existente no campo (só o profissional vê este ecrã)", html.indexOf("Já foi resolvido por telefone.") >= 0);
})();

// 20. PRO_TABS inclui a nova aba "Pedidos"
(function(){
  var keys = PRO_TABS.map(function(t){ return t[0]; });
  check.check("20. PRO_TABS inclui 'pedidos'", keys.indexOf("pedidos") >= 0);
})();

// 21. "Ok, mas" — o fallback de "sem alternativa segura" já existente (dentro da substituição) usa a nova estrutura
(function(){
  check.check("21. openSubstitution chama createHelpRequest no fallback (não só logAdaptation solto)", appSource.indexOf("createHelpRequest(s, meal, \"sem_alimento\"") >= 0);
})();

// ---- Contrato da migração SQL ----

// 22. Migração cria as tabelas e a RLS esperadas, incluindo o isolamento da nota privada
(function(){
  var sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "0009_help_requests.sql"), "utf8");
  check.check("22. Cria a tabela help_requests", /create table if not exists help_requests/.test(sql));
  check.check("22. Cria a tabela help_request_notes", /create table if not exists help_request_notes/.test(sql));
  check.check("22. RLS ativo em help_requests", /alter table help_requests enable row level security/.test(sql));
  check.check("22. RLS ativo em help_request_notes", /alter table help_request_notes enable row level security/.test(sql));
  check.check("22. Aluno pode criar o próprio pedido (insert)", /"student creates own help request"/.test(sql));
  check.check("22. Aluno pode ler os próprios pedidos (select)", /"student reads own help requests"/.test(sql));
  check.check("22. Não existe NENHUMA política para o aluno em help_request_notes", (function(){
    var notesSection = sql.slice(sql.indexOf("create table if not exists help_request_notes"));
    return notesSection.indexOf("professional manages help request notes") >= 0 && notesSection.match(/create policy/g).length === 1;
  })());
  check.check("22. Profissional gere tudo em help_requests", /"professional manages help requests"/.test(sql));
})();

check.summarize();
