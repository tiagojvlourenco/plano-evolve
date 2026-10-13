// Antes vs Depois (fotos + medições), templates de plano (nutrição e treino) e check-in com qualidade do sono e digestão.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

function iso(daysAgo){ return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10); }

// ---------- 1. Antes vs Depois ----------
(function(){
  var s = {id: "x", weights: [{date: iso(60), w: 80}, {date: iso(30), w: 77}, {date: iso(0), w: 74.5}],
    photos: [{date: iso(60), position: "frente", path: "a"}],
    assessments: [
      {date: iso(60), weight: 80, bodyFat: 28, muscle: 30, waist: 96, hip: 108, chest: 104, arm: 34, thigh: 62},
      {date: iso(0), weight: 74.5, bodyFat: 24.5, muscle: 31, waist: 88, hip: 104, chest: 102, arm: 35, thigh: 60}
    ]};
  var dates = compareDates(s);
  check.check("1. As datas juntam fotos e avaliações, sem repetir e por ordem", dates.length === 2 && dates[0] === iso(60) && dates[1] === iso(0));
  check.check("2. Sem fotos mas com avaliações também há comparação", tplPhotoCompare({photos: [], assessments: s.assessments, weights: []}).indexOf("id=\"compareMetrics\"") > 0 && tplPhotoCompare({photos: [], assessments: [], weights: []}) === "");
  check.check("3. O cartão chama-se 'Antes vs Depois' e tem o espaço das medições", /Antes vs Depois/.test(tplPhotoCompare(s)) && /id="compareMetrics"/.test(tplPhotoCompare(s)));
  var rows = compareMetricRows(s, iso(60), iso(0)), by = {};
  rows.forEach(function(r){ by[r.label] = r; });
  check.check("4. Peso, massa gorda e muscular, e os 5 perímetros pedidos (cintura, anca, peito, braço, coxa)", ["Peso", "Massa gorda", "Massa muscular", "Cintura", "Anca", "Peito", "Braço relaxado", "Coxa"].every(function(k){ return by[k]; }));
  check.check("5. Os valores de cada data estão certos", by["Peso"].a === 80 && by["Peso"].b === 74.5 && by["Cintura"].a === 96 && by["Cintura"].b === 88 && by["Massa gorda"].b === 24.5);
  var html = compareMetricsHtml(s, iso(60), iso(0));
  check.check("6. A tabela mostra a diferença com seta (cintura ▼ 8 cm, peso ▼ 5,5 kg)", /▼ 8 cm/.test(html) && /▼ 5,5 kg/.test(html));
  var mid = compareMetricsHtml(s, iso(30), iso(0));
  check.check("7. Numa data sem avaliação usa a mais recente antes dela e diz qual (avaliação de ...)", /avaliação de/.test(mid) && by["Peso"].a === 80);
  check.check("8. O peso de uma data sem avaliação vem do registo de pesagens (77 kg)", compareMetricRows(s, iso(30), iso(0)).filter(function(r){ return r.label === "Peso"; })[0].a === 77);
  check.check("9. Sem medições nas datas, avisa em vez de mostrar tabela vazia", /Sem medições/.test(compareMetricsHtml({photos: [{date: iso(5), position: "frente"}], assessments: [], weights: []}, iso(5), iso(5))));
  check.check("10. O JavaScript atualiza as medições ao mudar as datas", /compareMetrics[\s\S]{0,300}compareMetricsHtml\(s, selA\.value, selB\.value\)/.test(appSource.slice(appSource.indexOf("function wirePhotoCompare"), appSource.indexOf("function wirePhotoCompare") + 800)));
})();

// ---------- 2. Templates ----------
(function(){
  var store = {};
  global.localStorage = {getItem: function(k){ return k in store ? store[k] : null; }, setItem: function(k, v){ store[k] = String(v); }, removeItem: function(k){ delete store[k]; }};
  var swapped = food("Pescada", "170 g", "carnes"); swapped.original = {name: "Frango (peito)", qty: "150 g"};
  var src = {id: "a", blockedFoods: [], meals: [meal("Almoço", "13:00", [swapped, food("Arroz (cozido)", "120 g", "cereais")]), meal("Jantar", "20:00", [food("Maçã", "1 unid.", "fruta")])],
    trainingProgram: {name: "Hipertrofia", days: [{id: "d1", name: "Treino A", exercises: [{id: "e1", name: "Supino", sets: 4, reps: "6-8", rpe: 8, rest: 120, notes: "pausa"}]}]}};
  var n = nutritionTemplateFrom(src);
  check.check("11. O template de nutrição guarda o plano base (a troca do dia não conta)", n.meals.length === 2 && n.meals[0].foods[0].name === "Frango (peito)" && n.meals[0].foods[0].qty === "150 g" && !("original" in n.meals[0].foods[0]));
  var t = trainingTemplateFrom(src);
  check.check("12. O template de treino guarda dias e exercícios sem ids", t.days.length === 1 && t.days[0].exercises[0].name === "Supino" && !("id" in t.days[0]) && !("id" in t.days[0].exercises[0]));
  check.check("13. Resumo do template", templateCounts("nutricao", n) === "2 refeições · 3 alimentos" && templateCounts("treino", t) === "1 dia · 1 exercícios");

  var dest = {id: "b", blockedFoods: ["Maçã"], meals: [meal("Antigo", "10:00", [food("Banana", "1 unid.", "fruta")])]};
  var r = applyNutritionTemplate(dest, n, "replace");
  check.check("14. Substituir troca as refeições e ordena por hora", dest.meals.length === 2 && dest.meals[0].name === "Almoço" && r.meals === 2);
  check.check("15. Alimentos bloqueados para o aluno ficam de fora e são avisados", dest.meals[1].foods.length === 0 && r.skipped.some(function(x){ return /Maçã.*bloqueado/.test(x); }));
  var withUnknown = {meals: [{name: "X", time: "08:00", foods: [{name: "Alimento que não existe", qty: "1 g", group: "carnes"}]}]};
  var r2 = applyNutritionTemplate(dest, withUnknown, "append");
  check.check("16. Acrescentar junta às atuais e ignora alimentos que a app já não conhece", dest.meals.length === 3 && r2.skipped.some(function(x){ return /não existe/.test(x); }));
  var student = {id: "c", trainingProgram: null};
  var tr = applyTrainingTemplate(student, t, "replace");
  var d = student.trainingProgram.days[0];
  check.check("17. O template de treino cria dias e exercícios novos com ids próprios", tr.days === 1 && d.id && d.id !== "d1" && d.exercises[0].id && d.exercises[0].name === "Supino" && d.exercises[0].sets === 4 && d.exercises[0].rest === 120 && student.trainingProgram.name === "Hipertrofia");
  applyTrainingTemplate(student, t, "append");
  check.check("18. Acrescentar não apaga os dias atuais", student.trainingProgram.days.length === 2);

  var saved, list;
  return planTemplateSave("nutricao", "  Défice 1800  ", n).then(function(x){ saved = x; return planTemplateSave("treino", "Hipertrofia", t); }).then(function(){ return planTemplateSave("nutricao", "   ", n); }).then(function(empty){
    check.check("19. Sem nome não guarda", !!empty.error);
    return planTemplatesList("nutricao");
  }).then(function(l){
    list = l.data;
    check.check("20. Guarda e lista por tipo (em modo local), com o nome limpo", list.length === 1 && list[0].name === "Défice 1800" && list[0].kind === "nutricao");
    return planTemplateDelete(list[0].id).then(function(){ return planTemplatesList("nutricao"); });
  }).then(function(l2){
    check.check("21. Apagar remove só esse template", l2.data.length === 0 && tplLocalRead().length === 1);
    var bar = tplTemplatesBar("treino");
    check.check("22. Os separadores Plano e Treino do profissional têm a barra de templates", /data-tpl-save="treino"/.test(bar) && /data-tpl-apply="treino"/.test(bar) && /tplTemplatesBar\("nutricao"\)/.test(appSource) && /tplTemplatesBar\("treino"\)/.test(appSource));
    delete global.localStorage;
  });
})().then(function(){
  // ---------- 3. Check-in ----------
  var html = tplCheckin({id: "z", checkins: [], weightCurrent: 70, meals: [], workoutLogs: []});
  check.check("23. O check-in pergunta a qualidade do sono e a digestão", /id="ciSleepQ"/.test(html) && /id="ciDigestion"/.test(html));
  var n = normalizeCheckins([{date: iso(1), weight: 70, hunger: 5, energy: 6, adherence: 7, workouts: 3, mealsOff: 0, notes: "", sleepQuality: 6, digestion: 4}])[0];
  check.check("24. Os novos campos sobrevivem à normalização", n.sleepQuality === 6 && n.digestion === 4);
  var low = {checkins: [{date: iso(1), sleepHours: 7.5, sleepQuality: 8, digestion: 3, stress: 4, recovery: 7}, {date: iso(8), sleepHours: 7.5, sleepQuality: 8, digestion: 4, stress: 4, recovery: 7}]};
  var sig = signalRecuperacao(low);
  check.check("25. Digestão baixa passa a ser um sinal de atenção e aparece no texto", sig.status === "atencao" && /digestão 3,5\/10/.test(sig.text) && /qualidade do sono 8,0\/10/.test(sig.text));
  var ok = signalRecuperacao({checkins: [{date: iso(1), sleepHours: 7.5, sleepQuality: 8, digestion: 8, stress: 4, recovery: 7}]});
  check.check("26. Com boas sensações continua positivo", ok.status === "positivo");
  var proRow = tplProCheckins({checkins: [{date: iso(1), weight: 70, hunger: 5, energy: 6, adherence: 7, sleepQuality: 6, digestion: 4}]});
  check.check("27. O profissional vê a qualidade do sono e a digestão no histórico", /qualidade do sono 6/.test(proRow) && /digestão 4/.test(proRow));
  check.check("28. O envio do check-in grava os novos campos", /sleepQuality: parseInt\(el\.querySelector\("#ciSleepQ"\)\.value,10\)/.test(appSource) && /digestion: parseInt\(el\.querySelector\("#ciDigestion"\)\.value,10\)/.test(appSource));
  check.summarize();
});
