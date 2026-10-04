// Fase 23 — dois pedidos depois de testar as Fases 19-22 com dados reais:
// (1) "à vontade" deixa de existir — todos os alimentos passam a ter uma
// quantidade real, tal como qualquer outro; (2) a notificação (toast)
// ficava ilegível num ecrã de telemóvel real com mensagens compridas
// (esticava para fora do ecrã, sem quebra de linha, e desaparecia
// depressa demais para se ler).
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

// ---- 1. "À vontade" deixa de existir na base — os 5 vegetais curados têm quantidade real ----

// 1. Nenhum alimento na base é per:"fixed"
(function(){
  var fixedNames = Object.keys(FOOD_DB).filter(function(n){ return FOOD_DB[n].per === "fixed"; });
  check.check("1. Não sobra nenhum alimento per:\"fixed\" na base", fixedNames.length === 0);
})();

// 2. Os 5 vegetais curados são agora per:"100g", com valores nutricionais reais
(function(){
  ["Brócolos","Salada mista","Cenoura","Courgette","Espinafres"].forEach(function(name){
    check.check("2. '" + name + "' é per:100g", unitKindFor(name) === "100g");
  });
  check.check("2. Brócolos com valor real do INSA (32 kcal/100g cru)", FOOD_DB["Brócolos"].kcal === 32);
})();

// 3. FOOD_GROUPS.vegetais já não sugere "à vontade" por omissão — sugere uma quantidade real
(function(){
  var brocolos = FOOD_GROUPS.vegetais.find(function(o){ return o.name === "Brócolos"; });
  check.check("3. Quantidade sugerida é real (150 g), não 'à vontade'", brocolos && brocolos.qty === "150 g");
})();

// 4. Um alimento novo de "Brócolos" adicionado ao plano fica com quantidade normal, reescalável
(function(){
  var m = meal("Almoço", "13:00", []);
  var ok = addFoodToMeal(m, "Brócolos", "veg", 150);
  check.check("4. Adiciona com sucesso", ok === true);
  check.check("4. Fica com quantidade em gramas, não 'à vontade'", m.foods[0].qty === "150 g");
})();

// 5. O ajuste automático agora RESCALA Brócolos como qualquer outro alimento (participa nos alvos)
(function(){
  var s = freshStudent({targets:{kcal:1000, protein:0, carbs:0, fat:0}});
  // proteína/hidratos/gordura sem alvo (0) — só testa que Brócolos entra no balde certo e é reescalável
  s.meals = [meal("Almoço","13:00",[food("Brócolos","150 g","veg")])];
  var beforeKcal = foodNutrition("Brócolos","150 g").kcal;
  check.check("5. Brócolos contribui um valor real de calorias (não é ignorado)", beforeKcal > 0);
  check.check("5. priorityMacroForFood consegue classificar Brócolos (tem macro dominante)", priorityMacroForFood("Brócolos") !== null);
})();

// 6. Retrocompatibilidade: um plano já guardado com "à vontade" (texto antigo) continua a
// funcionar sem rebentar — não é reescalado (mesmo comportamento de sempre para esse registo),
// até o profissional o editar manualmente para uma quantidade real.
(function(){
  var s = freshStudent({targets:{kcal:2000, protein:100, carbs:0, fat:0}});
  s.meals = [meal("Jantar","20:00",[
    food("Frango (peito)","100 g","protein"),
    food("Brócolos","à vontade","veg")
  ])];
  var result;
  check.check("6. Não rebenta com um registo antigo 'à vontade'", (function(){ try { result = autoAdjustPlanQuantities(s); return true; } catch(e){ return false; } })());
  check.check("6. O registo antigo continua 'à vontade' (nunca reescalado até ser editado)", s.meals[0].foods[1].qty === "à vontade");
  check.check("6. Continua a contar como alimento fixo/untouched para efeitos do ajuste", result.untouched === 1);
})();

// ---- 2. Notificação (toast): legível em ecrã estreito, tempo proporcional ao tamanho ----

// 7. CSS do toast já não força uma só linha nem ultrapassa a largura do ecrã
(function(){
  var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  var toastCss = html.slice(html.indexOf(".toast{"), html.indexOf(".toast{") + 600);
  check.check("7. Já não tem white-space:nowrap (permite quebra de linha)", toastCss.indexOf("white-space:nowrap") === -1);
  check.check("7. Tem um max-width que respeita a largura do ecrã", toastCss.indexOf("max-width:calc(100vw") >= 0);
  check.check("7. Respeita a área segura no fundo do ecrã (iPhone com home indicator)", toastCss.indexOf("env(safe-area-inset-bottom") >= 0);
})();

// 8. showToast mostra mensagens compridas durante mais tempo (nunca menos que antes)
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function showToast"), appSource.indexOf("function showToast") + 700);
  check.check("8. A duração já não é um número fixo — depende do tamanho da mensagem", fnSrc.indexOf("msg.length") >= 0);
  check.check("8. Nunca é mais curta que o mínimo original (1800ms)", fnSrc.indexOf("Math.max(1800") >= 0);
})();

check.summarize();
