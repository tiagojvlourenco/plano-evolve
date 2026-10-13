// Substituição inteligente (porção recalculada, mais parecidas primeiro), badges de ação no dashboard do PT e lista de compras semanal.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

function iso(daysAgo){ var d = new Date(Date.now() - daysAgo * 86400000); return d.toISOString().slice(0, 10); }
function kcalOf(it){ return foodNutrition(it.name, it.qty).kcal; }

// ---------- 1. substituição inteligente ----------
(function(){
  var orig = {name: "Frango (peito)", qty: "150 g", group: "carnes"};
  var alt = {name: "Peru (fatiado)", qty: "100 g"};
  var byKey = computeEquivalentAlternative(orig, alt);
  var byKcal = computeEquivalentAlternative(orig, alt, "kcal");
  var tol = 0.05 * foodNutrition(orig.name, orig.qty).kcal + 8; // arredondamento a 5 g
  check.check("1. Por omissão continua a igualar o macro prioritário (proteína nas carnes)", Math.abs(foodNutrition(byKey.name, byKey.qty).p - foodNutrition(orig.name, orig.qty).p) < 0.06 * foodNutrition(orig.name, orig.qty).p + 2);
  check.check("2. Em modo 'kcal' iguala as calorias da linha", Math.abs(kcalOf(byKcal) - kcalOf(orig)) <= tol);
  var dairy = {name: "Iogurte grego natural", qty: "200 g", group: "laticinios"};
  var dairyAlt = FOOD_GROUPS.laticinios.filter(function(o){ return o.name !== dairy.name && FOOD_DB[o.name] && FOOD_DB[o.name].per === "100g" && FOOD_DB[o.name].kcal > 20; })[0];
  var eq = computeEquivalentAlternative(dairy, dairyAlt);
  check.check("3. Em grupos sem macro prioritário (lacticínios) a porção iguala as calorias", FOOD_DB[dairy.name] && Math.abs(kcalOf(eq) - kcalOf(dairy)) <= 0.06 * kcalOf(dairy) + 8);
  var veg = computeEquivalentAlternative({name: "Brócolos", qty: "à vontade", group: "vegetais"}, {name: "Espinafres", qty: "à vontade"});
  check.check("4. 'à vontade' continua 'à vontade' (nada a recalcular)", veg.qty === "à vontade");

  var near = computeEquivalentAlternative(orig, {name: "Peru (fatiado)", qty: "100 g"});
  var far = computeEquivalentAlternative(orig, {name: "Azeite", qty: "10 ml"}, "kcal");
  check.check("5. A distância é menor para a alternativa com macros parecidos", FOOD_DB["Azeite"] ? substitutionDistance(orig, near) < substitutionDistance(orig, far) : true);
  check.check("6. A nota mostra as calorias da alternativa e a diferença", /^≈ \d+ kcal( \([+−]\d+\))?$/.test(substitutionKcalNote(orig, near)));

  var src = appSource.slice(appSource.indexOf("function openSubstitution"), appSource.indexOf("function openMealOptionPicker"));
  check.check("7. O modo profissional não usa o bloqueio de restrições do aluno nem o limite de alternativas", /hasUnmappedDietaryRisk\(s\) && !proMode/.test(src) && /!usingManualList && s && !proMode/.test(src));
  check.check("8. A lista ordena por semelhança (e a lista manual do profissional mantém a ordem)", /if \(!usingManualList\) scored\.sort/.test(src) && /data-eq-mode/.test(src));
  check.check("9. O editor do plano tem o botão de sugerir alternativas ligado a openSubstitution em modo pro", /data-suggest-food/.test(tplPlanoMealEditor(meal("Almoço", "13:00", [food("Frango (peito)", "150 g", "carnes")]), 0)) && /openSubstitution\(oldFood[\s\S]{0,700}\{pro: true\}/.test(appSource));
})();

// ---------- 2. badges de ação ----------
(function(){
  function base(over){
    return Object.assign({id: "t", name: "T", initials: "T", goal: "Perda de gordura", trainingsPerWeek: 4, weightCurrent: 70, weightGoal: 65, checkins: [], weights: [], workoutLogs: [], meals: [], alerts: []}, over);
  }
  function keys(s){ return computeCoachBadges(s).map(function(b){ return b.key; }).join(); }
  check.check("10. Sem nenhum registo: badge neutro 'Sem registos'", keys(base({})) === "sem-registos");
  var old = base({checkins: [{date: iso(30), adherence: 8, workouts: 3}], weights: [{date: iso(31), w: 70}]});
  var bOld = computeCoachBadges(old).filter(function(b){ return b.key === "sem-registos"; })[0];
  check.check("11. Sem registos há 30 dias: badge crítico", bOld && bOld.tone === "critical" && /30/.test(bOld.label));
  var warn = computeCoachBadges(base({checkins: [{date: iso(9), adherence: 8, workouts: 3}]})).filter(function(b){ return b.key === "sem-registos"; })[0];
  check.check("12. Sem registos há 9 dias: aviso (não crítico)", warn && warn.tone === "warn");

  var stalled = [{date: iso(21), w: 70}, {date: iso(14), w: 70.1}, {date: iso(7), w: 70}, {date: iso(0), w: 70}];
  var logs = [0, 1, 2, 3].map(function(i){ return {id: "l" + i, date: iso(i), dayId: "d", dayName: "A", entries: []}; });
  var sTrain = base({weights: stalled, workoutLogs: logs, checkins: [{date: iso(1), adherence: 7, workouts: 4}]});
  check.check("13. Peso estagnado com sessões em dia: 'estagnado-a-treinar'", keys(sTrain).indexOf("estagnado-a-treinar") >= 0);
  var sStall = base({weights: stalled, checkins: [{date: iso(1), adherence: 7, workouts: 0}]});
  check.check("14. Peso estagnado sem treino a evoluir: só 'estagnado'", keys(sStall).split(",").indexOf("estagnado") >= 0 && keys(sStall).indexOf("estagnado-a-treinar") < 0);
  var high = base({checkins: [{date: iso(14), adherence: 9, workouts: 4}, {date: iso(7), adherence: 9, workouts: 4}, {date: iso(1), adherence: 9, workouts: 4}]});
  check.check("15. Adesão média ≥ 8,5 e registos em dia: 'alta-adesao' (tom positivo)", computeCoachBadges(high).filter(function(b){ return b.key === "alta-adesao" && b.tone === "good"; }).length === 1);
  var drop = base({checkins: [9, 9, 9, 6, 6, 6].map(function(a, i){ return {date: iso(35 - i * 7), adherence: a, workouts: 3}; })});
  drop.checkins[5].date = iso(1);
  check.check("16. Adesão que cai 3 pontos: 'adesao-a-cair' e não 'alta-adesao'", keys(drop).indexOf("adesao-a-cair") >= 0 && keys(drop).indexOf("alta-adesao") < 0);
  check.check("17. O HTML dos badges escapa o texto e mostra a dica", /title=/.test(coachBadgesHtml([{key: "x", label: "<b>x</b>", tone: "warn", hint: "dica \"a\""}])) && coachBadgesHtml([{key: "x", label: "<b>x</b>", tone: "warn", hint: "h"}]).indexOf("<b>") < 0);
  check.check("18. O dashboard mostra os badges em cada aluno", /coachBadgesHtml\(r\.coach\)/.test(appSource) && /coach: computeCoachBadges\(st\)/.test(appSource));
})();

// ---------- 3. lista de compras ----------
(function(){
  var store = {};
  global.localStorage = {getItem: function(k){ return k in store ? store[k] : null; }, setItem: function(k, v){ store[k] = String(v); }, removeItem: function(k){ delete store[k]; }, key: function(i){ return Object.keys(store)[i] || null; }, get length(){ return Object.keys(store).length; }};
  FOOD_PACKS["Iogurte de teste (Marca)"] = 125; FOOD_DB["Iogurte de teste (Marca)"] = {per: "100g", kcal: 60, p: 5, c: 4, f: 2};
  var swapped = food("Pescada", "170 g", "carnes"); swapped.original = {name: "Frango (peito)", qty: "150 g"};
  var s = {id: "alu1", meals: [
    meal("Almoço", "13:00", [food("Frango (peito)", "150 g", "carnes"), food("Brócolos", "à vontade", "vegetais"), food("Maçã", "1 unid.", "fruta"), food("Iogurte de teste (Marca)", "200 g", "laticinios")]),
    meal("Jantar", "20:00", [swapped, food("Maçã", "2 unid.", "fruta"), food("Leite magro", "250 ml", "laticinios")])
  ]};
  var list = shoppingListFor(s, 7), flat = {};
  list.forEach(function(g){ g.items.forEach(function(it){ flat[it.name] = it.qty + "|" + g.group; }); });
  check.check("19. Soma o mesmo alimento entre refeições e usa o plano e não a troca do dia (150 g + 150 g × 7 = 2,1 kg)", /^2,1 kg\|/.test(flat["Frango (peito)"]) && !flat["Pescada"]);
  check.check("20. Unidades somadas (1 + 2) × 7 = 21 unid.", /^21 unid\./.test(flat["Maçã"]));
  check.check("21. 'à vontade' aparece sem quantidade", /^à vontade/.test(flat["Brócolos"]));
  check.check("22. Com embalagem conhecida compra em embalagens inteiras (1400 g → 12 × 125 g)", /^12 embalagens de 125 g \(1,5 kg\)/.test(flat["Iogurte de teste (Marca)"]));
  check.check("23. Líquidos em ml/L (250 ml × 7 = 1,8 L)", /^1,8 L/.test(flat["Leite magro"]));
  check.check("24. Menos dias, menos quantidade (3 dias)", /^900 g|^0,9 kg/.test((function(){ var r; shoppingListFor(s, 3).forEach(function(g){ g.items.forEach(function(it){ if (it.name === "Frango (peito)") r = it.qty; }); }); return r; })()));
  check.check("25. Agrupa por grupo alimentar com etiqueta", list.length >= 3 && list.every(function(g){ return g.label && g.items.length; }));

  shopSaveChecked(s, {"Maçã": 1});
  check.check("26. Os comprados guardam-se e leem-se por aluno e semana", shopLoadChecked(s)["Maçã"] === 1 && shopLoadChecked({id: "outro"})["Maçã"] === undefined);
  store["evolve_shop_v1:alu1:2000-01-03"] = "{\"x\":1}";
  shopSaveChecked(s, {"Maçã": 1});
  check.check("27. As semanas antigas são apagadas", !("evolve_shop_v1:alu1:2000-01-03" in store));
  var broken = {id: "b"}; store[shopStoreKey(broken)] = "isto não é json";
  check.check("28. Dados guardados estragados não rebentam", JSON.stringify(shopLoadChecked(broken)) === "{}");

  state.planoSection = "compras"; state.shopDays = 5;
  var html = tplPlanoTabs(s);
  check.check("29. O Plano tem o separador Compras e mostra a lista (5 dias) com caixas de marcar", /data-plano-sec="compras"/.test(html) && /Para 5 dias/.test(html) && /data-shop="Ma/.test(html) && /1 de \d+ comprados/.test(html));
  state.planoSection = "alimentacao"; state.shopDays = 7;
  check.check("30. Sem alimentos no plano não há separador Compras", !/data-plano-sec="compras"/.test(tplPlanoTabs({id: "v", meals: []})));
  delete global.localStorage;
})();
check.summarize();
