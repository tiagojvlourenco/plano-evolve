// Fase 29 — pedido do profissional: trocar os 5 grupos de alimentos antigos
// (protein/carb/veg/fat/fruit, pouco intuitivos: "arroz é hidrato, frango é
// proteína... e fruta, barras de cereais, leite?") pelos 7 grupos explícitos
// que enviou: Cereais/Pães e Acompanhamentos, Lacticínios e Alternativas
// Vegetais, Carnes/Peixe e Ovos, Frutas Frescas, Vegetais e Saladas,
// Gorduras e Óleos, Snacks e Processados. As ~1393 entradas do FOOD_DB/
// FOOD_GROUPS foram reclassificadas por palavras-chave (script à parte,
// não commitado) — aqui testa-se a estrutura resultante e, sobretudo, a
// retrocompatibilidade: um plano já guardado (Tiago, produção) tem f.group
// com uma chave ANTIGA gravada no JSONB — resolveGroup() garante que nunca
// perde alternativas/rótulos só por ainda não ter sido reaberto/gravado.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

var NEW_GROUPS = ["cereais","laticinios","carnes","fruta","vegetais","gorduras","bebidas","snacks"];

// 1. FOOD_GROUPS tem exatamente os 8 grupos, nenhum antigo sobrevive
(function(){
  var keys = Object.keys(FOOD_GROUPS);
  check.check("1. FOOD_GROUPS tem exatamente os 8 grupos", keys.length === 8 && NEW_GROUPS.every(function(g){ return keys.indexOf(g) >= 0; }));
  check.check("1. Nenhuma chave antiga (protein/carb/veg/fat/fruit) sobrevive em FOOD_GROUPS", ["protein","carb","veg","fat","fruit"].every(function(g){ return !FOOD_GROUPS[g]; }));
})();

// 2. GROUP_LABELS tem os rótulos com emoji pedidos, um por grupo novo
(function(){
  check.check("2. GROUP_LABELS cobre os 8 grupos", NEW_GROUPS.every(function(g){ return !!GROUP_LABELS[g]; }));
  check.check("2. Rótulo de 'cereais' tem o emoji e o nome pedidos", GROUP_LABELS.cereais.indexOf("🥖") >= 0 && GROUP_LABELS.cereais.indexOf("Cereais") >= 0);
  check.check("2. Rótulo de 'laticinios' tem o emoji e o nome pedidos", GROUP_LABELS.laticinios.indexOf("🥛") >= 0 && GROUP_LABELS.laticinios.indexOf("Lacticínios") >= 0);
  check.check("2. Rótulo de 'carnes' tem o emoji e o nome pedidos", GROUP_LABELS.carnes.indexOf("🥩") >= 0 && GROUP_LABELS.carnes.indexOf("Carnes") >= 0);
  check.check("2. Rótulo de 'fruta' tem o emoji e o nome pedidos", GROUP_LABELS.fruta.indexOf("🍎") >= 0 && GROUP_LABELS.fruta.indexOf("Frutas") >= 0);
  check.check("2. Rótulo de 'vegetais' tem o emoji e o nome pedidos", GROUP_LABELS.vegetais.indexOf("🟢") >= 0 && GROUP_LABELS.vegetais.indexOf("Vegetais") >= 0);
  check.check("2. Rótulo de 'gorduras' tem o emoji e o nome pedidos", GROUP_LABELS.gorduras.indexOf("🥑") >= 0 && GROUP_LABELS.gorduras.indexOf("Gorduras") >= 0);
  check.check("2. Rótulo de 'snacks' tem o emoji e o nome pedidos", GROUP_LABELS.snacks.indexOf("🍫") >= 0 && GROUP_LABELS.snacks.indexOf("Snacks") >= 0);
})();

// 3. Classificação: alguns alimentos óbvios ficam no grupo esperado
(function(){
  check.check("3. Frango (peito) -> carnes", groupOfFood("Frango (peito)") === "carnes");
  check.check("3. Arroz (cozido) -> cereais", groupOfFood("Arroz (cozido)") === "cereais");
  check.check("3. Leite meio gordo, UHT -> laticinios", groupOfFood("Leite meio gordo, UHT") === "laticinios");
  check.check("3. Banana -> fruta", groupOfFood("Banana") === "fruta");
  check.check("3. Brócolos -> vegetais", groupOfFood("Brócolos") === "vegetais");
  check.check("3. Azeite -> gorduras", groupOfFood("Azeite") === "gorduras");
  check.check("3. Bolacha Maria -> snacks", groupOfFood("Bolacha Maria") === "snacks");
  check.check("3. Ovos -> carnes (exemplo explícito do profissional)", groupOfFood("Ovos") === "carnes");
  check.check("3. Queijo flamengo -> laticinios", groupOfFood("Queijo flamengo") === "laticinios");
})();

// 4. groupOfFood: alimento desconhecido cai em 'carnes' (equivalente novo do antigo 'protein')
(function(){
  check.check("4. Alimento inexistente devolve 'carnes' como omissão", groupOfFood("Alimento Que Não Existe XPTO") === "carnes");
})();

// 5. resolveGroup: retrocompatibilidade com os 5 grupos antigos de planos já guardados
(function(){
  check.check("5. resolveGroup traduz 'protein' -> 'carnes'", resolveGroup("protein") === "carnes");
  check.check("5. resolveGroup traduz 'carb' -> 'cereais'", resolveGroup("carb") === "cereais");
  check.check("5. resolveGroup traduz 'veg' -> 'vegetais'", resolveGroup("veg") === "vegetais");
  check.check("5. resolveGroup traduz 'fat' -> 'gorduras'", resolveGroup("fat") === "gorduras");
  check.check("5. resolveGroup traduz 'fruit' -> 'fruta'", resolveGroup("fruit") === "fruta");
  check.check("5. resolveGroup mantém uma chave nova como está", resolveGroup("cereais") === "cereais");
  check.check("5. resolveGroup devolve o valor tal-e-qual se não reconhecer nada", resolveGroup("qualquer-coisa") === "qualquer-coisa");
})();

// 6. optionsFor/computeEquivalentAlternative continuam a funcionar para um
// alimento de um plano ANTIGO já guardado (f.group com chave antiga)
(function(){
  var fAntigo = food("Frango (peito)", "150 g", "protein");
  var opts = optionsFor(fAntigo);
  check.check("6. optionsFor devolve alternativas para f.group antigo ('protein')", opts === FOOD_GROUPS.carnes && opts.length > 0);
  var alt = computeEquivalentAlternative(fAntigo, {name:"Peru (fatiado)", qty:"100 g"});
  var origN = foodNutrition(fAntigo.name, fAntigo.qty);
  var altN = foodNutrition(alt.name, alt.qty);
  check.check("6. computeEquivalentAlternative preserva a proteína para f.group antigo", Math.abs(altN.p - origN.p) < origN.p * 0.15);
})();

// 7. GROUP_PRIORITY_KEY usa as 3 chaves novas macro-dominantes
(function(){
  check.check("7. GROUP_PRIORITY_KEY.carnes = p", GROUP_PRIORITY_KEY.carnes === "p");
  check.check("7. GROUP_PRIORITY_KEY.cereais = c", GROUP_PRIORITY_KEY.cereais === "c");
  check.check("7. GROUP_PRIORITY_KEY.gorduras = f", GROUP_PRIORITY_KEY.gorduras === "f");
})();

// 8. PRO_PLAN_GROUPS (editor do profissional) e CUSTOM_FOOD_GROUP_LABELS (alimento
// personalizado) usam os 8 grupos — o segundo reaproveita GROUP_LABELS
// diretamente, para nunca dessincronizar os rótulos entre os dois sítios
(function(){
  check.check("8. PRO_PLAN_GROUPS tem os 8 grupos", PRO_PLAN_GROUPS.length === 8 && NEW_GROUPS.every(function(g){ return PRO_PLAN_GROUPS.indexOf(g) >= 0; }));
  check.check("8. CUSTOM_FOOD_GROUP_LABELS é o mesmo objeto que GROUP_LABELS", CUSTOM_FOOD_GROUP_LABELS === GROUP_LABELS);
})();

// 9. mergeCustomFood continua a funcionar com um alimento personalizado já
// guardado com uma chave de grupo ANTIGA (custom_foods.food_group, produção)
(function(){
  var row = {name:"Barra XPTO Antiga", per:"100g", kcal:200, protein:10, carbs:20, fat:5, food_group:"protein"};
  var ok = mergeCustomFood(row);
  check.check("9. mergeCustomFood aceita food_group antigo sem rebentar", ok === true);
  check.check("9. Alimento acrescentado ao grupo novo equivalente ('carnes')", FOOD_GROUPS.carnes.some(function(o){ return o.name === "Barra XPTO Antiga"; }));
})();

// 10. Nenhum alimento se perdeu na reclassificação (o total nunca fica
// abaixo dos 1393 da reclassificação inicial — só cresce com o tempo,
// conforme se vão acrescentando produtos de marca, por isso não fixa um
// número exato)
(function(){
  var total = 0;
  NEW_GROUPS.forEach(function(g){ total += FOOD_GROUPS[g].length; });
  check.check("10. O total de alimentos nos 8 grupos nunca é inferior ao da reclassificação inicial (1393 + o de teste do ponto 9)", total >= 1394);
})();

check.summarize();
