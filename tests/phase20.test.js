// Fase 20 — botão para gerar uma proposta de plano a partir do texto livre do
// "dia-a-dia alimentar" do questionário. Pedido explícito: "tipo ter um botão
// que eu carregava e aparecia logo em baixo o plano que a pessoa fazia...
// (caso dê!)". Mantém a mesma cautela das Fases 12/17 com texto livre: só
// reconhece alimentos que já existem na base (nunca inventa), usa sempre a
// quantidade-padrão (nunca lê gramagens do texto), e nunca aplica nada ao
// plano sem o profissional confirmar a proposta.
const fs = require("fs");
const path = require("path");
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

function freshStudent(overrides){
  var base = {
    id:"x", name:"Teste Aluno", flexibility:50, flexOverrides:{}, blockedFoods:[],
    substitutionHistory:[], adaptationHistory:[], photos:[], weightLogPhotos:[],
    likes:[], dislikes:[], avoid:[], allergies:[],
    targets:{kcal:2000, protein:150, carbs:200, fat:60},
    meals:[], planHistory:[]
  };
  Object.keys(overrides || {}).forEach(function(k){ base[k] = overrides[k]; });
  return base;
}

// ---- 1. splitDailyTextByMeal: segmenta o texto pelos marcadores de refeição ----

// 1. Segmenta corretamente 3 refeições distintas
(function(){
  var text = "Ao pequeno-almoço como ovos e pão. Ao almoço como frango com arroz. Ao jantar como peixe com batata.";
  var segs = splitDailyTextByMeal(text);
  check.check("1. Identifica Pequeno-almoço", segs["Pequeno-almoço"] && segs["Pequeno-almoço"].indexOf("ovos") >= 0);
  check.check("1. Identifica Almoço", segs["Almoço"] && segs["Almoço"].indexOf("frango") >= 0);
  check.check("1. Identifica Jantar", segs["Jantar"] && segs["Jantar"].indexOf("peixe") >= 0);
})();

// 2. "pequeno-almoço" nunca é lido também como um "Almoço" à parte (bug óbvio de substring)
(function(){
  var text = "Ao pequeno-almoço como iogurte.";
  var segs = splitDailyTextByMeal(text);
  check.check("2. Só existe segmento Pequeno-almoço", segs["Pequeno-almoço"] !== undefined);
  check.check("2. Não cria um segmento 'Almoço' falso a partir de 'pequeno-almoço'", segs["Almoço"] === undefined);
})();

// 3. Texto sem nenhum marcador de refeição devolve objeto vazio
(function(){
  var segs = splitDailyTextByMeal("Como de tudo um pouco ao longo do dia, sem horários fixos.");
  check.check("3. Sem marcadores, devolve {} (nenhuma chave)", Object.keys(segs).length === 0);
})();

// 4. Duas menções à mesma refeição juntam-se no mesmo segmento
(function(){
  var text = "Ao lanche como fruta. Mais tarde, outro lanche com iogurte.";
  var segs = splitDailyTextByMeal(text);
  check.check("4. Junta as duas menções de Lanche no mesmo segmento", segs["Lanche"].indexOf("fruta") >= 0 && segs["Lanche"].indexOf("iogurte") >= 0);
})();

// ---- 2. defaultQtyForFood / groupOfFood: nunca inventa quantidade nem grupo ----

// 5. Usa a quantidade-padrão já definida em FOOD_GROUPS para alimentos curados
(function(){
  check.check("5. Frango (peito) usa a quantidade padrão de FOOD_GROUPS", defaultQtyForFood("Frango (peito)") === "150 g");
  check.check("5. Ovos usa a quantidade padrão em unidades", defaultQtyForFood("Ovos") === "3 unid.");
})();

// 6. groupOfFood devolve o grupo correto (não confunde com priorityMacroForFood)
(function(){
  check.check("6. Frango (peito) pertence ao grupo carnes", groupOfFood("Frango (peito)") === "carnes");
  check.check("6. Maçã pertence ao grupo fruta (não cereais, mesmo dominando em hidratos)", groupOfFood("Maçã") === "fruta");
})();

// ---- 3. getFoodKeywordIndex: prioriza os nomes curados/simples sobre variantes do INSA ----

// 7. A chave "frango" aponta para o nome curado simples, não para uma variante composta do INSA
(function(){
  var index = getFoodKeywordIndex();
  check.check("7. Chave 'frango' existe", !!index["frango"]);
  check.check("7. Aponta para o nome curado 'Frango (peito)'", index["frango"] === "Frango (peito)");
})();

// ---- 4. draftPlanFromDailyText: reconhece alimentos conhecidos por refeição ----

// 8. Cenário completo: reconhece alimentos em duas refeições distintas
(function(){
  var text = "Ao pequeno-almoço como ovos com pão. Ao almoço como frango com arroz e brócolos.";
  var draft = draftPlanFromDailyText(text);
  var peq = draft.find(function(d){ return d.mealName === "Pequeno-almoço"; });
  var almoco = draft.find(function(d){ return d.mealName === "Almoço"; });
  check.check("8. Reconhece 'Ovos' no pequeno-almoço", peq && peq.foods.some(function(f){ return f.name === "Ovos"; }));
  check.check("8. Reconhece 'Frango (peito)' no almoço", almoco && almoco.foods.some(function(f){ return f.name === "Frango (peito)"; }));
  check.check("8. Reconhece 'Arroz (cozido)' no almoço", almoco && almoco.foods.some(function(f){ return f.name === "Arroz (cozido)"; }));
  check.check("8. Cada alimento reconhecido já vem com quantidade-padrão", almoco.foods.every(function(f){ return !!f.qty; }));
})();

// 9. Refeições não mencionadas no texto não aparecem no draft (nunca cria as 6 todas às cegas)
(function(){
  var text = "Ao almoço como frango.";
  var draft = draftPlanFromDailyText(text);
  check.check("9. Só devolve a refeição mencionada", draft.length === 1 && draft[0].mealName === "Almoço");
})();

// 10. Sem nenhum marcador de refeição, devolve draft vazio (nunca adivinha)
(function(){
  var draft = draftPlanFromDailyText("Como pouco e sem grande estrutura ao longo do dia.");
  check.check("10. Draft vazio quando não há refeições identificáveis", draft.length === 0);
})();

// 11. Nunca inventa alimentos fora da base — texto com um alimento desconhecido não gera nada para ele
(function(){
  var draft = draftPlanFromDailyText("Ao jantar como xyzalimentoinventado123 com água.");
  var jantar = draft.find(function(d){ return d.mealName === "Jantar"; });
  check.check("11. Não reconhece um alimento que não existe na base", !jantar.foods.some(function(f){ return f.name.indexOf("xyzalimentoinventado") >= 0; }));
})();

// ---- 5. renderDailyPlanDraft: mostra sempre para revisão, nunca aplica direto ----

// 12. Sem refeições reconhecidas, mostra mensagem clara em vez de um botão de aplicar
(function(){
  var html = renderDailyPlanDraft([]);
  check.check("12. Mostra mensagem quando não há nada reconhecido", html.indexOf("Não encontrei") >= 0);
  check.check("12. Não mostra botão de aplicar", html.indexOf("applyDailyPlanDraft") === -1);
})();

// 13. Com alimentos reconhecidos, mostra o botão de aplicar e avisa para rever antes
(function(){
  var draft = draftPlanFromDailyText("Ao almoço como frango com arroz.");
  var html = renderDailyPlanDraft(draft);
  check.check("13. Mostra o botão de aplicar ao plano", html.indexOf("applyDailyPlanDraft") >= 0);
  check.check("13. Avisa que é uma proposta a rever, não algo definitivo", html.toLowerCase().indexOf("rev") >= 0);
  check.check("13. Mostra o nome dos alimentos reconhecidos", html.indexOf("Frango (peito)") >= 0);
})();

// ---- 6. UI: o botão só aparece quando há texto de dia-a-dia alimentar ----

// 14. tplQuestionnaireCopy só mostra o botão "Gerar plano" quando dailyEatingDescription existe
(function(){
  var comTexto = freshStudent({dailyEatingDescription:"Ao almoço como frango."});
  var semTexto = freshStudent({hardestFoodToResist:"Chocolate"}); // tem outras respostas, mas não esta
  check.check("14. Com dailyEatingDescription, mostra o botão", tplQuestionnaireCopy(comTexto).indexOf("draftFromDailyText") >= 0);
  check.check("14. Sem dailyEatingDescription, não mostra o botão", tplQuestionnaireCopy(semTexto).indexOf("draftFromDailyText") === -1);
})();

// ---- 7. wireProTab: liga o botão a gerar a proposta, e o "Aplicar" cria refeições/alimentos e regista no histórico ----

// 15. wireProTab tem a lógica de wiring esperada (existência das ligações certas)
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function wireProTab"), appSource.indexOf("function wireProTab") + 20000);
  var block = fnSrc.slice(fnSrc.indexOf("draftFromDailyText"), fnSrc.indexOf("draftFromDailyText") + 4000);
  check.check("15. Chama draftPlanFromDailyText(s.dailyEatingDescription)", block.indexOf("draftPlanFromDailyText(pasted ? el.querySelector(\"#pastedPlanText\").value : s.dailyEatingDescription)") >= 0);
  check.check("15. Preenche #dailyPlanDraftResult com renderDailyPlanDraft", block.indexOf("renderDailyPlanDraft(draft)") >= 0);
  check.check("15. Ao aplicar, regista no histórico com logPlanEvent", block.indexOf('logPlanEvent(s, "plano_gerado_texto"') >= 0);
  check.check("15. Ao aplicar, persiste e volta a renderizar", block.indexOf("persistStudent(s)") >= 0 && block.indexOf("renderProTabContent(s)") >= 0);
})();

// 16. Aplicar ao plano (simulado diretamente): cria refeição nova + acrescenta alimentos sem duplicar
(function(){
  var s = freshStudent({dailyEatingDescription:"Ao almoço como frango com arroz."});
  var draft = draftPlanFromDailyText(s.dailyEatingDescription);
  // replica a lógica de aplicação do wireProTab, para testar o comportamento sem DOM
  var createdMeals = 0, addedFoods = 0;
  draft.forEach(function(d){
    if (!d.foods.length) return;
    var targetMeal = s.meals.find(function(m){ return m.name === d.mealName; });
    if (!targetMeal){
      targetMeal = meal(d.mealName, d.mealTime, []);
      s.meals.push(targetMeal);
      createdMeals++;
    }
    d.foods.forEach(function(f){
      if (targetMeal.foods.some(function(existing){ return existing.name === f.name; })) return;
      targetMeal.foods.push(food(f.name, f.qty, f.group));
      addedFoods++;
    });
  });
  check.check("16. Cria 1 refeição nova (Almoço)", createdMeals === 1 && s.meals.length === 1);
  check.check("16. Acrescenta os alimentos reconhecidos (Frango e Arroz)", addedFoods >= 2);
  check.check("16. Os alimentos ficam na refeição certa", s.meals[0].name === "Almoço" && s.meals[0].foods.some(function(f){ return f.name === "Frango (peito)"; }));
})();

// 17. Aplicar duas vezes seguidas não duplica alimentos já existentes na mesma refeição
(function(){
  var s = freshStudent({dailyEatingDescription:"Ao almoço como frango."});
  s.meals = [meal("Almoço", "13:00", [food("Frango (peito)","150 g","protein")])];
  var draft = draftPlanFromDailyText(s.dailyEatingDescription);
  var addedFoods = 0;
  draft.forEach(function(d){
    var targetMeal = s.meals.find(function(m){ return m.name === d.mealName; });
    d.foods.forEach(function(f){
      if (targetMeal.foods.some(function(existing){ return existing.name === f.name; })) return;
      targetMeal.foods.push(food(f.name, f.qty, f.group));
      addedFoods++;
    });
  });
  check.check("17. Não duplica um alimento já presente na refeição", addedFoods === 0 && s.meals[0].foods.length === 1);
})();

// ---- 8. Fase 20b: avisar sobre palavras que parecem alimento mas não estão na base ----

// 18. Uma palavra desconhecida (não é conetor/verbo/confeção comum) fica marcada como não reconhecida
(function(){
  var index = getFoodKeywordIndex();
  var unmatched = extractUnmatchedWords("almoço como frango com azeitonas e passas", ["Frango (peito)"], index);
  check.check("18. 'azeitonas' fica por reconhecer (não está na base)", unmatched.indexOf("azeitonas") >= 0);
  check.check("18. 'passas' fica por reconhecer (não está na base)", unmatched.indexOf("passas") >= 0);
  check.check("18. 'frango' não aparece (já está reconhecido)", unmatched.indexOf("frango") === -1);
})();

// 19. Conetores, verbos comuns e palavras de confeção nunca aparecem como "não reconhecidos"
(function(){
  var index = getFoodKeywordIndex();
  var unmatched = extractUnmatchedWords("como sempre frango grelhado com muito pouco azeite", ["Frango (peito)","Azeite"], index);
  check.check("19. Não sinaliza verbos/conetores comuns", unmatched.indexOf("como") === -1 && unmatched.indexOf("sempre") === -1 && unmatched.indexOf("muito") === -1);
  check.check("19. Não sinaliza palavras de confeção", unmatched.indexOf("grelhado") === -1);
})();

// 20b. A própria palavra do marcador de refeição (ex.: "pequeno-almoço") nunca é sinalizada como não reconhecida
(function(){
  var draft = draftPlanFromDailyText("Ao pequeno-almoço como ovos.");
  var html = renderDailyPlanDraft(draft);
  check.check("20b. 'pequeno-almoço' não aparece como aviso de não reconhecido", html.indexOf("Também mencionado") === -1);
})();

// 20. Palavras curtas (menos de 4 letras) nunca são sinalizadas — reduz falsos positivos
(function(){
  var index = getFoodKeywordIndex();
  var unmatched = extractUnmatchedWords("bebo chá e como um ovo", [], index);
  check.check("20. Palavra com 3 letras ('chá') não é sinalizada", unmatched.indexOf("chá") === -1);
})();

// 21. renderDailyPlanDraft mostra o aviso de "também mencionado" quando há palavras por reconhecer
(function(){
  var draft = draftPlanFromDailyText("Ao almoço como frango com kombucha.");
  var html = renderDailyPlanDraft(draft);
  check.check("21. Mostra o aviso com a palavra não reconhecida", html.indexOf("kombucha") >= 0 && html.toLowerCase().indexOf("não está na nossa base") >= 0);
})();

// 22. Cada pill de alimento tem um botão de remover (×) com os índices certos
(function(){
  var draft = draftPlanFromDailyText("Ao almoço como frango com arroz.");
  var html = renderDailyPlanDraft(draft);
  check.check("22. Cada pill tem data-remove-draft-food e data-food-idx", /data-remove-draft-food="0"[^>]*data-food-idx="0"/.test(html) && /data-remove-draft-food="0"[^>]*data-food-idx="1"/.test(html));
})();

// 23. wireProTab liga o botão de remover a tirar o alimento do draft e voltar a renderizar (sem aplicar nada ao plano)
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function wireProTab"), appSource.indexOf("function wireProTab") + 20000);
  var block = fnSrc.slice(fnSrc.indexOf("draftFromDailyText"), fnSrc.indexOf("draftFromDailyText") + 2600);
  check.check("23. Liga [data-remove-draft-food] a um clique", block.indexOf('querySelectorAll("[data-remove-draft-food]")') >= 0);
  check.check("23. Remove o alimento do draft com splice, sem mexer em s.meals", block.indexOf("draft[mi].foods.splice(fi, 1)") >= 0);
  check.check("23. Volta a renderizar o rascunho depois de remover (renderAndWireDraft)", block.indexOf("renderAndWireDraft()") >= 0);
})();

check.summarize();
