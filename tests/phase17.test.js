// Fase 17 — alimentos personalizados lidos de rótulo (OCR no browser, sem
// servidor nem API paga) e guardados em custom_foods para ficarem
// disponíveis automaticamente a todos os alunos seguintes.
const fs = require("fs");
const path = require("path");
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

// ---- 1. parseNutritionLabelText: extrai valores de texto lido por OCR ----

// 1. Tabela nutricional europeia típica, bem formatada
(function(){
  var text = "Valor energético 1046 kJ / 250 kcal\nLípidos 8,0 g\ndos quais saturados 3,5 g\nHidratos de carbono 30 g\ndos quais açúcares 5,0 g\nFibra 2,0 g\nProteínas 10 g\nSal 0,8 g";
  var p = parseNutritionLabelText(text);
  check.check("1. Extrai kcal corretamente", p.kcal === 250);
  check.check("1. Extrai lípidos/gordura (linha principal, não 'dos quais saturados')", p.fat === 8);
  check.check("1. Extrai hidratos de carbono", p.carbs === 30);
  check.check("1. Extrai proteínas", p.protein === 10);
})();

// 2. Vírgulas decimais (formato português) são convertidas corretamente
(function(){
  var text = "Energia 500 kcal\nProteínas 12,5 g\nHidratos de carbono 45,3 g\nGordura 20,1 g";
  var p = parseNutritionLabelText(text);
  check.check("2. Vírgula decimal em proteína", p.protein === 12.5);
  check.check("2. Vírgula decimal em hidratos", p.carbs === 45.3);
  check.check("2. Vírgula decimal em gordura", p.fat === 20.1);
})();

// 3. Texto sem alguns campos devolve null só nesses, sem rebentar
(function(){
  var text = "Só um texto qualquer sem tabela nutricional nenhuma.";
  var p = parseNutritionLabelText(text);
  check.check("3. Sem kcal, devolve null", p.kcal === null);
  check.check("3. Sem proteína, devolve null", p.protein === null);
  check.check("3. Não rebenta com texto vazio", parseNutritionLabelText("").kcal === null);
  check.check("3. Não rebenta com null/undefined", parseNutritionLabelText(null).kcal === null && parseNutritionLabelText(undefined).kcal === null);
})();

// ---- 2. mergeCustomFood / loadCustomFoods ----

// 4. mergeCustomFood acrescenta ao FOOD_DB e ao FOOD_GROUPS certo
(function(){
  var row = {name:"Teste Barra Proteica XPTO", kcal:380, protein:30, carbs:35, fat:12, food_group:"protein"};
  var ok = mergeCustomFood(row);
  check.check("4. mergeCustomFood devolve true ao acrescentar", ok === true);
  check.check("4. Fica no FOOD_DB com os valores corretos", FOOD_DB["Teste Barra Proteica XPTO"].kcal === 380 && FOOD_DB["Teste Barra Proteica XPTO"].p === 30);
  check.check("4. Fica no FOOD_GROUPS.protein", FOOD_GROUPS.protein.some(function(o){ return o.name === "Teste Barra Proteica XPTO"; }));
})();

// 5. Nunca substitui um alimento já existente com o mesmo nome
(function(){
  var before = FOOD_DB["Frango (peito)"].kcal;
  var ok = mergeCustomFood({name:"Frango (peito)", kcal:9999, protein:1, carbs:1, fat:1, food_group:"protein"});
  check.check("5. mergeCustomFood devolve false quando o nome já existe", ok === false);
  check.check("5. Não altera o valor já existente", FOOD_DB["Frango (peito)"].kcal === before);
})();

// 6. mergeCustomFood não duplica no FOOD_GROUPS se chamado duas vezes (idempotente)
(function(){
  var row = {name:"Teste Idempotente ABC", kcal:100, protein:5, carbs:10, fat:2, food_group:"carb"};
  mergeCustomFood(row);
  var countAfterFirst = FOOD_GROUPS.carb.filter(function(o){ return o.name === "Teste Idempotente ABC"; }).length;
  // segunda chamada: já existe no FOOD_DB, por isso mergeCustomFood devolve false e não mexe em mais nada
  mergeCustomFood(row);
  var countAfterSecond = FOOD_GROUPS.carb.filter(function(o){ return o.name === "Teste Idempotente ABC"; }).length;
  check.check("6. Não duplica no FOOD_GROUPS ao chamar duas vezes", countAfterFirst === 1 && countAfterSecond === 1);
})();

// 7. loadCustomFoods não rebenta em modo local (sem sbReady)
(function(){
  var result = loadCustomFoods();
  check.check("7. Devolve uma Promise mesmo sem sbReady", result && typeof result.then === "function");
})();

// ---- 3. openCustomFoodModal: existe, tem os campos certos, e nunca guarda sem revisão ----

// 8. openCustomFoodModal existe
(function(){
  check.check("8. openCustomFoodModal existe", typeof openCustomFoodModal === "function");
  check.check("8. loadTesseractScript existe (OCR carregado só quando preciso)", typeof loadTesseractScript === "function");
})();

// 9. O formulário de revisão começa escondido — nunca aparece pré-preenchido sem passar pela leitura/preenchimento manual
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function openCustomFoodModal"), appSource.indexOf("function openCustomFoodModal") + 3000);
  check.check("9. cfForm começa com display:none", fnSrc.indexOf('id=\\"cfForm\\" style=\\"display:none;\\"') >= 0 || fnSrc.indexOf('id="cfForm" style="display:none;"') >= 0);
  check.check("9. Tem opção de preencher manualmente sem foto", fnSrc.indexOf("cfManual") >= 0);
  check.check("9. Pede confirmação/revisão dos valores (não são gravados direto da leitura)", fnSrc.indexOf("Confirma") >= 0 || appSource.indexOf("Confirma e corrige") >= 0);
})();

// 10. O guardar valida nome, duplicados e valores negativos antes de gravar
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function openCustomFoodModal"), appSource.indexOf("function openCustomFoodModal") + 6000);
  check.check("10. Exige nome preenchido", fnSrc.indexOf("Escreve o nome do alimento") >= 0);
  check.check("10. Rejeita nome já existente no FOOD_DB", fnSrc.indexOf("FOOD_DB[name]") >= 0 && fnSrc.toLowerCase().indexOf("já existe") >= 0);
  check.check("10. Rejeita valores negativos/em falta", fnSrc.indexOf("kcal >= 0") >= 0);
})();

// 11. Ao guardar com sucesso (sbReady), insere em custom_foods e funde de imediato no FOOD_DB local
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function openCustomFoodModal"), appSource.indexOf("function openCustomFoodModal") + 7000);
  check.check("11. Insere na tabela custom_foods", fnSrc.indexOf('sb.from("custom_foods").insert(row)') >= 0);
  check.check("11. Funde imediatamente com mergeCustomFood (disponível já nesta sessão)", fnSrc.indexOf("mergeCustomFood((res.data") >= 0);
  check.check("11. Em modo local (sem sbReady), funde localmente sem tentar gravar no Supabase", /else\s*\{[\s\S]{0,100}mergeCustomFood\(row\)/.test(fnSrc));
})();

// ---- 4. Botão "Não encontro o alimento" no formulário do profissional ----

// 12. tplAddFoodForm tem o botão de acrescentar novo alimento
(function(){
  var html = tplAddFoodForm(0);
  check.check("12. Tem o botão data-new-food", html.indexOf("data-new-food") >= 0);
})();

// 13. wireProTab liga [data-new-food] a abrir o modal, e atualiza a pesquisa/quantidade ao guardar
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function wireProTab"), appSource.indexOf("function wireProTab") + 20000);
  var block = fnSrc.slice(fnSrc.indexOf("data-new-food"), fnSrc.indexOf("data-new-food") + 800);
  check.check("13. Abre openCustomFoodModal", block.indexOf("openCustomFoodModal(") >= 0);
  check.check("13. Ao guardar, preenche o campo de pesquisa com o novo nome", block.indexOf("foodInput.value = name") >= 0);
  check.check("13. Atualiza a quantidade para o novo alimento", block.indexOf("tplAddFoodQty(name)") >= 0);
})();

// ---- 5. Migração 0015: tabela, RLS, e leitura aberta a alunos (não só profissional) ----

// 14. A migração cria a tabela e as políticas certas
(function(){
  var mig = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "0015_custom_foods.sql"), "utf8");
  check.check("14. Cria a tabela custom_foods", mig.indexOf("create table if not exists custom_foods") >= 0);
  check.check("14. RLS ativado", mig.indexOf("enable row level security") >= 0);
  check.check("14. Qualquer utilizador autenticado pode ler (aluno precisa de calcular macros do seu plano)", mig.indexOf("auth.uid() is not null") >= 0);
  check.check("14. Só profissional pode inserir", /profissional cria alimentos personalizados[\s\S]{0,200}exists \(select 1 from professionals/.test(mig));
  check.check("14. food_group restrito aos 5 grupos válidos", mig.indexOf("check (food_group in ('protein','carb','veg','fat','fruit'))") >= 0);
})();

check.summarize();
