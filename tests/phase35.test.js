// Fase 35 — "Gerar plano a partir do dia-a-dia" com um questionário real tinha
// muitos erros (reportado com capturas de ecrã do questionário e do plano
// gerado): "leite meio-gordo" virava Leite creme (uma sobremesa), "sem
// açúcar" acrescentava Açúcar branco, "2 fatias de pão" virava Fatias de
// presunto, "queijo fresco magro" virava Queijo Brie, "15 g proteína" virava
// Proteína texturizada de soja, as quantidades escritas no texto eram
// ignoradas, e "Meio da tarde / pré-treino" e "Pós-treino" não eram
// reconhecidos como refeições (os alimentos caíam no Almoço). Causa comum: o
// reconhecimento olhava só para a primeira palavra do nome do alimento.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

var TEXTO = [
  "🍳 Pequeno-almoço", "",
  "* 200 ml leite meio-gordo",
  "* Café Delta Cereais sem açúcar",
  "* 2 fatias de pão The Rustic Bakery",
  "* 60 g queijo fresco magro",
  "* 100g mirtilos", "",
  "🥛 Meio da manhã", "",
  "* 1 iogurte proteico — 15 g proteína",
  "* 1 Barebells Cookies & Cream", "",
  "🍚 Almoço", "",
  "* 159 g arroz basmati / massa integral / quinoa / batata-doce",
  "* 150 g frango / peru / coelho",
  "* ou 150 g peixe branco",
  "* 100 g legumes verdes", "",
  "🍮 Meio da tarde / pré-treino", "",
  "* 1 pudim proteico — 20 g proteína",
  "* 150g fruta", "",
  "🥤 Pós-treino", "",
  "* Iogurte Líquido Proteico com 25 g", "",
  "🍽️ Jantar", "",
  "* 150 g arroz basmati / massa integral / quinoa / batata-doce",
  "* 150 g carne branca",
  "* ou 150 g peixe branco",
  "* 1 Prato Sopa"
].join("\n");

function mealOf(draft, name){ return draft.find(function(d){ return d.mealName === name; }); }
function namesOf(d){ return d.foods.map(function(f){ return f.name; }); }
function qtyOf(d, name){ var f = d.foods.find(function(x){ return x.name === name; }); return f && f.qty; }

// Produtos do catálogo que já estão verificados em produção e que o texto menciona/podia confundir
function mergeCatalogSample(){
  [
    {name:"Pão clássico", brand:"The Rustik Bakery", food_group:"cereais", kcal:319, protein:9.4, carbs:45, fat:1.5},
    {name:"Pão de fermentação natural com cereais", brand:"The Rustik Bakery", food_group:"cereais", kcal:273, protein:11, carbs:38, fat:3.8},
    {name:"Cereais Cookie Crisp", brand:"Nestlé", food_group:"cereais", kcal:393, protein:6.7, carbs:78, fat:5.2},
    {name:"Fatias finas de peito de frango", brand:"Hacendado", food_group:"carnes", kcal:83, protein:16, carbs:2.1, fat:1}
  ].forEach(function(r){ mergeFoodProduct(r, []); });
}

// ---- 1. Pequeno-almoço: os erros da captura de ecrã ----
(function(){
  var peq = mealOf(draftPlanFromDailyText(TEXTO), "Pequeno-almoço");
  var n = namesOf(peq);
  check.check("1. 'leite meio-gordo' → leite meio-gordo (não Leite creme, a sobremesa)",
    n.some(function(x){ return /^Leite meio gordo/.test(x); }) && n.indexOf("Leite creme") === -1);
  check.check("1. 200 ml de leite lidos do texto", /^200 ml$/.test(qtyOf(peq, n.find(function(x){ return /^Leite meio gordo/.test(x); }))));
  check.check("1. 'sem açúcar' NÃO acrescenta Açúcar branco", n.indexOf("Açúcar branco") === -1);
  check.check("1. 'Café Delta' não vira Café solúvel em pó (100 g de pó)", n.indexOf("Café solúvel em pó") === -1 && n.some(function(x){ return /^Café, infusão/.test(x); }));
  check.check("1. 'fatias de pão' NÃO vira Fatias de presunto", n.indexOf("Fatias de presunto (Nobre)") === -1);
  check.check("1. 'queijo fresco magro' → Queijo fresco magro (não Queijo Brie), com os 60 g do texto",
    n.indexOf("Queijo fresco magro") >= 0 && n.indexOf("Queijo Brie") === -1 && qtyOf(peq, "Queijo fresco magro") === "60 g");
  check.check("1. 100g mirtilos → Mirtilos 100 g", qtyOf(peq, "Mirtilos") === "100 g");
  check.check("1. Sem produtos de marca escolhidos ao calhas (nenhum nome de marca no resultado sem a marca ser dita)",
    !n.some(function(x){ return brandOfFoodName(x); }));
})();

// ---- 2. Produtos de marca só entram se a marca for mencionada (e a gralha "Rustic" não impede) ----
(function(){
  mergeCatalogSample();
  _foodKeywordIndexCache = null;
  var peq = mealOf(draftPlanFromDailyText(TEXTO), "Pequeno-almoço");
  var n = namesOf(peq);
  check.check("2. 'pão The Rustic Bakery' (com gralha) → produto da Rustik Bakery",
    n.some(function(x){ return /^Pão clássico \(The Rustik Bakery\)/.test(x); }));
  check.check("2. 2 fatias de pão → 80 g (≈ 40 g por fatia)", qtyOf(peq, n.find(function(x){ return /Rustik Bakery/.test(x); })) === "80 g");
  check.check("2. 'Café Delta Cereais' não vira o produto 'Cereais Cookie Crisp (Nestlé)'", n.indexOf("Cereais Cookie Crisp (Nestlé)") === -1);
  var semMarca = namesOf(mealOf(draftPlanFromDailyText("Pequeno-almoço\n* 2 fatias de pão"), "Pequeno-almoço"));
  check.check("2. 'pão' sem marca → o genérico (Pão integral), não um produto de marca", semMarca.indexOf("Pão integral") >= 0 && !semMarca.some(function(x){ return brandOfFoodName(x); }));
  var idx = getFoodKeywordIndex();
  check.check("2. A chave genérica 'cereais' nunca aponta para um produto de marca", idx["cereais"] !== "Cereais Cookie Crisp (Nestlé)");
  check.check("2. Um produto de marca com a marca dita é encontrado após ser fundido na base (cache atualiza)",
    namesOf(mealOf(draftPlanFromDailyText("Almoço\n* 80 g fatias finas de peito de frango hacendado"), "Almoço")).some(function(x){ return /Hacendado/.test(x); }));
})();

// ---- 3. Quantidades e proteína ----
(function(){
  var draft = draftPlanFromDailyText(TEXTO);
  var manha = mealOf(draft, "Meio da manhã");
  check.check("3. '1 iogurte proteico — 15 g proteína' → iogurte, nunca Proteína texturizada de soja",
    namesOf(manha).indexOf("Proteína texturizada de soja") === -1 && namesOf(manha).indexOf("Iogurte grego natural") >= 0);
  var g = parseInt(qtyOf(manha, "Iogurte grego natural"), 10);
  var proteina = FOOD_DB["Iogurte grego natural"].p * g / 100;
  check.check("3. A quantidade do iogurte dá ≈ 15 g de proteína (" + proteina.toFixed(1) + " g)", Math.abs(proteina - 15) <= 1);
  check.check("3. Barebells (não existe na base) fica SINALIZADO, não substituído por outra coisa",
    manha.unmatchedLines.some(function(l){ return /Barebells/i.test(l); }) && namesOf(manha).length === 1);
})();

// ---- 4. Refeições: "Meio da tarde / pré-treino" e "Pós-treino" ----
(function(){
  var draft = draftPlanFromDailyText(TEXTO);
  var lanche = mealOf(draft, "Lanche");
  check.check("4. 'Meio da tarde / pré-treino' vira a refeição Lanche", !!lanche && namesOf(lanche).indexOf("Fruta") >= 0);
  check.check("4. '150g fruta' → Fruta 1 unid.", qtyOf(lanche, "Fruta") === "1 unid.");
  check.check("4. 'pudim proteico' (não existe na base) fica sinalizado, não vira Pudim flan", namesOf(lanche).indexOf("Pudim flan caseiro") === -1 && lanche.unmatchedLines.some(function(l){ return /pudim/i.test(l); }));
  var almoco = mealOf(draft, "Almoço");
  check.check("4. Os alimentos do lanche já NÃO caem no Almoço", namesOf(almoco).indexOf("Fruta") === -1 && namesOf(almoco).indexOf("Pudim flan caseiro") === -1);
  var pos = mealOf(draft, "Pós-treino");
  check.check("4. 'Pós-treino' é uma refeição própria (19:00)", !!pos && pos.mealTime === "19:00");
  check.check("4. 'Iogurte líquido proteico com 25 g' não vira um iogurte açucarado de 100 ml — fica sinalizado",
    namesOf(pos).length === 0 && pos.unmatchedLines.some(function(l){ return /l[ií]quido/i.test(l); }));
})();

// ---- 5. Almoço e Jantar: alternativas, quantidades e descrições genéricas ----
(function(){
  var draft = draftPlanFromDailyText(TEXTO);
  var almoco = mealOf(draft, "Almoço");
  check.check("5. Almoço: 159 g de arroz (cozido) lidos do texto — nunca um pacote de arroz cru de marca",
    qtyOf(almoco, "Arroz (cozido)") === "159 g" && !namesOf(almoco).some(function(x){ return brandOfFoodName(x); }));
  check.check("5. Almoço: 150 g de frango; peru/coelho/peixe são alternativas, não somam",
    qtyOf(almoco, "Frango (peito)") === "150 g" && namesOf(almoco).indexOf("Pescada") === -1 && namesOf(almoco).indexOf("Peru (fatiado)") === -1);
  check.check("5. Almoço: '100 g legumes verdes' reconhecido (Brócolos 100 g)", qtyOf(almoco, "Brócolos") === "100 g");
  check.check("5. Almoço: nenhuma linha por reconhecer", almoco.unmatchedLines.length === 0);
  var jantar = mealOf(draft, "Jantar");
  check.check("5. Jantar: 'carne branca' → Frango (peito) 150 g", qtyOf(jantar, "Frango (peito)") === "150 g");
  check.check("5. Jantar: '1 Prato Sopa' → sopa, 300 g", qtyOf(jantar, "Sopa juliana") === "300 g");
})();

// ---- 6. Negações e especificidade ----
(function(){
  function foods(texto){ return namesOf(mealOf(draftPlanFromDailyText(texto), "Pequeno-almoço")); }
  check.check("6. 'sem açúcar' nunca vira Açúcar", foods("Pequeno-almoço\n* café sem açúcar").indexOf("Açúcar branco") === -1);
  check.check("6. 'açúcar' sozinho continua a ser reconhecido", foods("Pequeno-almoço\n* 5 g açúcar").indexOf("Açúcar branco") >= 0);
  check.check("6. 'leite sem lactose' escolhe um leite SEM lactose", foods("Pequeno-almoço\n* 200 ml leite sem lactose").some(function(x){ return /sem lactose/.test(x); }));
  check.check("6. 'arroz basmati' → Arroz (cozido), não 'Arroz basmati (Hacendado)' (cru, ~350 kcal/100 g)",
    foods("Pequeno-almoço\n* 100 g arroz basmati").indexOf("Arroz (cozido)") >= 0);
  check.check("6. 'batata' ≠ 'batata-doce' e vice-versa",
    foods("Pequeno-almoço\n* batata").indexOf("Batata") >= 0 && foods("Pequeno-almoço\n* batata-doce").indexOf("Batata-doce") >= 0 && foods("Pequeno-almoço\n* batata-doce").indexOf("Batata") === -1);
  check.check("6. Texto corrido sem marcadores ainda reconhece vários alimentos ('frango com arroz')",
    namesOf(mealOf(draftPlanFromDailyText("Ao almoço como frango com arroz"), "Almoço")).length === 2);
})();

// ---- 7. Funções auxiliares ----
(function(){
  check.check("7. brandOfFoodName: '(Marca)' no fim", brandOfFoodName("Leite magro (Continente Equilíbrio)") === "Continente Equilíbrio");
  check.check("7. brandOfFoodName: qualificador em minúsculas não é marca", brandOfFoodName("Arroz (cozido)") === null);
  check.check("7. brandOfFoodName: com sufixo de loja", brandOfFoodName("Pão clássico (The Rustik Bakery) · Continente") === "The Rustik Bakery");
  var q = parseDailyQuantity("* 200 ml leite");
  check.check("7. parseDailyQuantity: 200 ml", q.grams === 200);
  q = parseDailyQuantity("2 fatias de pão");
  check.check("7. parseDailyQuantity: 2 fatias", q.count === 2 && q.unit === "fatia" && q.grams === null);
  q = parseDailyQuantity("1 pudim proteico — 20 g proteína");
  check.check("7. parseDailyQuantity: '20 g proteína' é proteína, não gramas do alimento", q.proteinG === 20 && q.grams === null);
  q = parseDailyQuantity("1,5 l água");
  check.check("7. parseDailyQuantity: vírgula decimal e litros", q.grams === 1500);
  check.check("7. withinOneEdit: rustic ≈ rustik, mas não rústico↔padaria", withinOneEdit("rustic", "rustik") && !withinOneEdit("rustic", "bakery"));
})();

// ---- 8. UI: as linhas por reconhecer aparecem no rascunho e no resumo ao aplicar ----
(function(){
  var html = renderDailyPlanDraft(draftPlanFromDailyText(TEXTO));
  check.check("8. O rascunho mostra 'Não consegui reconhecer' com a linha do Barebells", html.indexOf("Não consegui reconhecer") >= 0 && html.indexOf("Barebells") >= 0);
  check.check("8. O rascunho mostra a quantidade lida do texto na pill", html.indexOf("200 ml") >= 0 && html.indexOf("159 g") >= 0);
  var fnSrc = appSource.slice(appSource.indexOf("function wireProTab"), appSource.indexOf("function wireProTab") + 22000);
  var block = fnSrc.slice(fnSrc.indexOf("draftFromDailyText"), fnSrc.indexOf("draftFromDailyText") + 4800);
  check.check("8. Ao aplicar, as linhas por reconhecer entram no resumo/histórico (d.unmatchedLines)", block.indexOf("d.unmatchedLines") >= 0);
  var htmlLeite = renderDailyPlanDraft(draftPlanFromDailyText("Pequeno-almoço\n* 200 ml leite meio-gordo"));
  check.check("8. 'meio-gordo' (já parte do leite reconhecido) NÃO aparece como palavra fora da base", htmlLeite.indexOf("Também mencionado") === -1);
  check.check("8. O texto de ajuda já não diz que as quantidades são sempre as padrão", html.indexOf("em quantidades-padrão") === -1 && html.indexOf("quantidades escritas no texto") >= 0);
})();

// ---- 9. Produto de dose única (Barebells, 55 g) e "N unidades" sem unidade ----
(function(){
  mergeFoodProduct({name:"Barra proteica Cookies & Cream", brand:"Barebells", food_group:"snacks", kcal:346, protein:37, carbs:31, fat:12, package_quantity:55, package_unit:"g"}, []);
  var n = "Barra proteica Cookies & Cream (Barebells)";
  check.check("9. mergeFoodProduct: dose-padrão = embalagem (55 g) quando é dose única", FOOD_GROUPS.snacks.some(function(o){ return o.name === n && o.qty === "55 g"; }));
  var meio = mealOf(draftPlanFromDailyText("Meio da manhã\n* 1 Barebells Cookies & Cream"), "Meio da manhã");
  check.check("9. '1 Barebells Cookies & Cream' → a barra, 55 g", namesOf(meio).indexOf(n) >= 0 && qtyOf(meio, n) === "55 g" && meio.unmatchedLines.length === 0);
  var dois = mealOf(draftPlanFromDailyText("Meio da manhã\n* 2 Barebells Cookies & Cream"), "Meio da manhã");
  check.check("9. '2 Barebells Cookies & Cream' → 110 g (2 × a dose-padrão)", qtyOf(dois, n) === "110 g");
  check.check("9. Sem dizer a marca, 'barra proteica' não escolhe a barra de marca", namesOf(mealOf(draftPlanFromDailyText("Meio da manhã\n* 1 barra proteica"), "Meio da manhã")).indexOf(n) === -1);
})();

// ---- 10. Pudim proteico (Continente) e iogurte líquido proteico (YoPro) — descritos sem marca no questionário ----
(function(){
  var draft0 = draftPlanFromDailyText(TEXTO);
  check.check("10. Antes de existirem na base, continuam sinalizados (nunca trocados por outra coisa)",
    mealOf(draft0, "Lanche").unmatchedLines.some(function(l){ return /pudim/i.test(l); }) && mealOf(draft0, "Pós-treino").unmatchedLines.length === 1);
  mergeFoodProduct({name:"Pudim proteico sabor baunilha", brand:"Continente", food_group:"laticinios", kcal:83, protein:10, carbs:7.4, fat:1.5, package_quantity:200, package_unit:"g"}, []);
  mergeFoodProduct({name:"Iogurte líquido proteico sabor café", brand:"YoPro", food_group:"laticinios", kcal:59, protein:8.3, carbs:5.3, fat:0.4, package_quantity:300, package_unit:"g"}, []);
  var draft = draftPlanFromDailyText(TEXTO);
  var lanche = mealOf(draft, "Lanche"), pos = mealOf(draft, "Pós-treino");
  check.check("10. '1 pudim proteico — 20 g proteína' → pudim Continente, 200 g (= 20 g de proteína)", qtyOf(lanche, "Pudim proteico sabor baunilha (Continente)") === "200 g");
  check.check("10. 'Iogurte Líquido Proteico com 25 g' → YoPro, 300 ml (≈ 25 g de proteína)", qtyOf(pos, "Iogurte líquido proteico sabor café (YoPro)") === "300 ml" && pos.unmatchedLines.length === 0);
  check.check("10. O iogurte proteico (não líquido) continua a ser o iogurte grego", namesOf(mealOf(draft, "Meio da manhã")).indexOf("Iogurte grego natural") >= 0);
})();

check.summarize();
