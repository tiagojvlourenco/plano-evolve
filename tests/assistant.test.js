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

// ---- Auditoria: o que optionsFor() efetivamente filtra (pedido explícito de correção) ----

// 23. optionsFor() SÓ filtra blockedFoods — allergies/avoid/dislikes NÃO são lidos
(function(){
  var f = food("Frango (peito)","150 g","protein");
  var withoutRestrictions = optionsFor(f, freshStudent());
  var withAllergiesAndAvoid = optionsFor(f, freshStudent({allergies:["Sensibilidade à lactose"], avoid:["Marisco"], dislikes:["Peixe azul"]}));
  check.check("23. allergies/avoid/dislikes não alteram as opções devolvidas (comportamento real, não assumido)",
    JSON.stringify(withoutRestrictions) === JSON.stringify(withAllergiesAndAvoid));

  var withBlocked = optionsFor(f, freshStudent({blockedFoods:["Peru (fatiado)"]}));
  check.check("23. Só blockedFoods reduz de facto as opções", withBlocked.length < withoutRestrictions.length);
})();

// 24. hasUnmappedDietaryRisk(): deteta risco não mapeado sem tentar adivinhar QUAL alimento evitar
(function(){
  check.check("24. Sem allergies nem avoid -> sem risco assinalado", hasUnmappedDietaryRisk(freshStudent()) === false);
  check.check("24. Com allergies preenchidas -> risco assinalado", hasUnmappedDietaryRisk(freshStudent({allergies:["Sensibilidade à lactose"]})) === true);
  check.check("24. Com avoid preenchido -> risco assinalado", hasUnmappedDietaryRisk(freshStudent({avoid:["Marisco"]})) === true);
  check.check("24. Arrays vazios -> sem risco (não é 'tem o campo', é 'tem conteúdo')", hasUnmappedDietaryRisk(freshStudent({allergies:[], avoid:[]})) === false);
  check.check("24. Sem s (undefined) não rebenta", hasUnmappedDietaryRisk(undefined) === false);
})();

// 25. openSubstitution BLOQUEIA totalmente as alternativas quando há risco não
// mapeado — já não é só um aviso, a lista de alimentos nem chega a ser mostrada
// (correção sobre a versão anterior, que só avisava e continuava a sugerir)
(function(){
  var src = appSource;
  var fnStart = src.indexOf("function openSubstitution");
  var fnEnd = src.indexOf("function renderConfirm");
  var subFn = src.slice(fnStart, fnEnd);
  var guardIdx = subFn.indexOf("hasUnmappedDietaryRisk(s)");
  var returnIdx = subFn.indexOf("return sheet;");
  var renderListDefIdx = subFn.indexOf("function renderList");
  check.check("25. openSubstitution consulta hasUnmappedDietaryRisk logo no início", guardIdx >= 0 && guardIdx < renderListDefIdx);
  check.check("25. Sai da função (return) antes de definir/chamar renderList — nunca chega a montar a lista", returnIdx >= 0 && returnIdx < renderListDefIdx);
  check.check("25. Usa a mensagem de segurança única (não inventa outro texto)", subFn.indexOf("renderDietRiskBlocked(sheet, s, meal,") >= 0);
})();

// ---- RLS de help_requests / help_request_notes: os 5 critérios exatos pedidos ----

// 26. Critério 1: aluno só cria/lê os PRÓPRIOS pedidos (via students.auth_user_id)
(function(){
  var sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "0009_help_requests.sql"), "utf8");
  var insertPolicy = sql.slice(sql.indexOf('create policy "student creates own help request"'), sql.indexOf('create policy "student reads own help requests"'));
  var selectPolicy = sql.slice(sql.indexOf('create policy "student reads own help requests"'), sql.indexOf('create policy "professional manages help requests"'));
  check.check("26. Insert do aluno exige student_id ligado ao seu auth_user_id", /st\.auth_user_id = auth\.uid\(\)/.test(insertPolicy));
  check.check("26. Select do aluno exige o mesmo", /st\.auth_user_id = auth\.uid\(\)/.test(selectPolicy));
})();

// 27. Critério 2: NENHUMA política de update/delete para o aluno em help_requests
(function(){
  var sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "0009_help_requests.sql"), "utf8");
  var helpRequestsSection = sql.slice(sql.indexOf("create table if not exists help_requests"), sql.indexOf("create table if not exists help_request_notes"));
  var studentPolicies = helpRequestsSection.match(/create policy "student[^"]*"[^;]*;/gs) || [];
  check.check("27. Existem exatamente 2 políticas do aluno em help_requests (criar + ler)", studentPolicies.length === 2);
  check.check("27. Nenhuma delas é 'for update'", studentPolicies.every(function(p){ return !/for\s+update/i.test(p); }));
  check.check("27. Nenhuma delas é 'for delete'", studentPolicies.every(function(p){ return !/for\s+delete/i.test(p); }));
})();

// 28. Critério 3: ZERO políticas do aluno em help_request_notes (leitura/escrita/alteração/remoção)
(function(){
  var sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "0009_help_requests.sql"), "utf8");
  var notesSection = sql.slice(sql.indexOf("create table if not exists help_request_notes"));
  var allPolicies = notesSection.match(/create policy "[^"]*"/g) || [];
  check.check("28. help_request_notes tem exatamente 1 política no total", allPolicies.length === 1);
  check.check("28. Essa única política é do profissional, não do aluno", allPolicies[0].indexOf("professional") >= 0);
})();

// 29. Critério 4: profissional gere tudo (select+insert+update+delete = "for all") nas duas tabelas
(function(){
  var sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "0009_help_requests.sql"), "utf8");
  var proRequests = sql.slice(sql.indexOf('"professional manages help requests"'), sql.indexOf("comment on table help_requests"));
  var proNotes = sql.slice(sql.indexOf('"professional manages help request notes"'));
  check.check("29. Profissional tem 'for all' em help_requests (não só select)", /for all/.test(proRequests));
  check.check("29. Profissional tem 'for all' em help_request_notes (não só select)", /for all/.test(proNotes));
})();

// 30. Critério 5: a condição do aluno nunca permitiria ver dados de outro aluno
// (a subquery compara sempre contra o auth.uid() de QUEM PEDE, nunca contra um valor fixo)
(function(){
  var sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "0009_help_requests.sql"), "utf8");
  var helpRequestsSection = sql.slice(sql.indexOf("create table if not exists help_requests"), sql.indexOf("create table if not exists help_request_notes"));
  var studentPolicies = helpRequestsSection.match(/create policy "student[^"]*"[\s\S]*?;/g) || [];
  check.check("30. As duas políticas do aluno usam auth.uid() (identidade de quem pede), nunca um id fixo",
    studentPolicies.length === 2 && studentPolicies.every(function(p){ return /auth\.uid\(\)/.test(p) && !/auth\.uid\(\)\s*=\s*'/.test(p); }));
})();

// ---- Modo de segurança (correção): BLOQUEAR sugestões de alimentos, não só avisar ----
// Pedido explícito: enquanto houver allergies/avoid não mapeados, nenhum aluno
// pode receber alternativas, substituições automáticas, construtor de
// refeições ou dicas de restaurante — em nenhum nível de flexibilidade.

// 31. As 3 situações que recomendam alimentos ficam bloqueadas com allergies OU avoid,
// em qualquer nível de flexibilidade (o bloqueio não depende do perfil estruturado/equilibrado/flexível)
(function(){
  [20, 50, 80].forEach(function(flex){
    var sWithAllergies = freshStudent({flexibility: flex, allergies:["Sensibilidade à lactose"]});
    var sWithAvoid = freshStudent({flexibility: flex, avoid:["Marisco"]});
    ["sem_alimento","pouco_tempo","fora"].forEach(function(key){
      check.check("31. flex=" + flex + " '" + key + "' bloqueado com allergies", decideAssistantAction(sWithAllergies, key).action === "diet_risk_blocked");
      check.check("31. flex=" + flex + " '" + key + "' bloqueado com avoid", decideAssistantAction(sWithAvoid, key).action === "diet_risk_blocked");
    });
  });
})();

// 32. blockedFoods sozinho (sem allergies/avoid) é uma restrição MAPEADA pelo profissional
// para alimentos concretos — continua a permitir alternativas seguras, não é bloqueada
(function(){
  var s = freshStudent({blockedFoods:["Peru (fatiado)"]});
  check.check("32. 'sem_alimento' continua 'pick_food' só com blockedFoods", decideAssistantAction(s, "sem_alimento").action === "pick_food");
  check.check("32. 'pouco_tempo' continua 'low_time' só com blockedFoods", decideAssistantAction(s, "pouco_tempo").action === "low_time");
  check.check("32. 'fora' continua 'scenario_picker' só com blockedFoods", decideAssistantAction(s, "fora").action === "scenario_picker");
})();

// 33. "trocar" nunca é bloqueado na íntegra — só o sub-fluxo de substituir um alimento
// o é (via openSubstitution); "Adaptar a refeição toda" não recomenda nenhum alimento
(function(){
  var s = freshStudent({allergies:["Sensibilidade à lactose"]});
  check.check("33. 'trocar' continua 'swap_meal' mesmo com risco não mapeado", decideAssistantAction(s, "trocar").action === "swap_meal");
})();

// 34. handleAssistantSituation encaminha 'diet_risk_blocked' para o ecrã de segurança
(function(){
  var flat = appSource.replace(/\s+/g, " ");
  check.check("34. Existe o routing 'diet_risk_blocked' -> openAssistantDietRiskBlocked",
    /decision\.action === "diet_risk_blocked"\) return openAssistantDietRiskBlocked/.test(flat));
})();

// 35. openAssistantDietRiskBlocked reaproveita a MESMA função de bloqueio usada em
// openSubstitution — garante que a mensagem nunca diverge entre pontos da app
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function openAssistantDietRiskBlocked"), appSource.indexOf("function openAssistantPickFood"));
  check.check("35. openAssistantDietRiskBlocked chama renderDietRiskBlocked", fnSrc.indexOf("renderDietRiskBlocked(") >= 0);
})();

// 36. Construtor de refeições (tplMealChoice/tplMealBuilder): são funções puras (sem DOM),
// testáveis diretamente — confirmam que NENHUMA opção fica clicável quando há risco
(function(){
  var groupedMeal = meal("Almoço","13:00",[
    food("Frango (peito)","150 g","protein"),
    food("Arroz (cozido)","120 g","carb")
  ]);

  var sRisk = freshStudent({allergies:["Sensibilidade à lactose"]});
  var htmlLocked = tplMealChoice(groupedMeal, 0, sRisk);
  check.check("36. Com allergies, tplMealChoice não mostra nenhuma opção clicável (sem builder-opt)", htmlLocked.indexOf("builder-opt") === -1);
  check.check("36. Mostra a mensagem de segurança para cada grupo bloqueado (2 alimentos com grupo)", htmlLocked.split(DIET_RISK_SAFE_MESSAGE).length - 1 === 2);
  check.check("36. tplMealBuilder (usa tplMealChoice por dentro) também fica bloqueado", tplMealBuilder(groupedMeal, 0, sRisk).indexOf("builder-opt") === -1);

  var sSafe = freshStudent();
  var htmlOpen = tplMealChoice(groupedMeal, 0, sSafe);
  check.check("36. Sem allergies/avoid, as opções continuam clicáveis (sem regressão)", htmlOpen.indexOf("builder-opt") >= 0);

  var sBlockedOnly = freshStudent({blockedFoods:["Peru (fatiado)"]});
  var htmlBlockedOnly = tplMealChoice(groupedMeal, 0, sBlockedOnly);
  check.check("36. Só com blockedFoods (restrição mapeada), o construtor continua a mostrar alternativas seguras", htmlBlockedOnly.indexOf("builder-opt") >= 0);
})();

check.summarize();
