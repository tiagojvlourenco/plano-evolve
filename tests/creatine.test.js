// Creatina mono-hidratada em todos os planos: linha calculada pelo peso, sempre no pequeno-almoço, com a nota do horário.
require("./setup")();
eval(require("./extract-app")());
var check = require("./check")();
var fs = require("fs");
var store = {};
global.localStorage = {getItem: function(k){ return k in store ? store[k] : null; }, setItem: function(k, v){ store[k] = String(v); }, removeItem: function(k){ delete store[k]; }};

function student(extra){
  return Object.assign({
    id: "t1", name: "Teste", sex: "Masculino", age: 35, height: 178, weightCurrent: 80, weights: [], flexibility: 20, flexOverrides: {}, blockedFoods: [], planHistory: [],
    targets: {kcal: 2200, protein: 160, carbs: 250, fat: 70}, supplements: [],
    meals: [meal("Almoço", "13:00", [food("Arroz", "100 g")]), meal("Pequeno-almoço", "08:00", [food("Aveia", "50 g")]), meal("Jantar", "20:00", [food("Frango", "150 g")])]
  }, extra || {});
}

// ---- dose pelo peso ----
var table = {45: 3, 60: 3, 70: 4, 80: 4, 90: 5, 100: 5, 120: 5};
Object.keys(table).forEach(function(w){
  check.check("1. " + w + " kg (1,95 m: sem excesso de peso) → " + table[w] + " g", creatineDoseG({weightCurrent: +w, height: 195}) === table[w]);
});
check.check("2. Sem peso não há dose (em vez de adivinhar)", creatineDoseG({}) === null && creatineDoseG({weightCurrent: 0, weights: []}) === null);
check.check("3. Usa o último peso registado quando falta o peso atual", creatineDoseG({weights: [{date: "2026-01-01", w: 70}, {date: "2026-02-01", w: 90}]}) === 5);
check.check("4. Com excesso de peso usa o peso a IMC 25 (130 kg com 1,70 m → 72 kg → 4 g, não 5)", creatineDoseG({weightCurrent: 130, height: 170}) === 4);
check.check("5. A dose fica sempre entre 3 e 5 g", [30, 50, 65, 85, 105, 150, 200].every(function(w){ var g = creatineDoseG({weightCurrent: w}); return g >= 3 && g <= 5; }));

// ---- avisos de segurança ----
check.check("6. Menor de 18 anos pede confirmação", creatineCautions({age: 16}).length === 1 && creatineCautions({age: 18}).length === 0);
check.check("7. Rins, diálise, gravidez e amamentação na ficha pedem confirmação", ["Insuficiência renal crónica", "diálise", "rim único", "Grávida de 12 semanas", "está a amamentar", "Doença renal", "transplante renal"].every(function(t){ return creatineCautions({medicalConditions: t}).length === 1; }));
check.check("8. Textos normais não pedem confirmação (a palavra «primeira» não é «rim»)", creatineCautions({medicalConditions: "Rotura do menisco; tensão alta", currentMedication: "Ibuprofeno"}).length === 0 && creatineCautions({medicalConditions: "primeira consulta com ortopedista"}).length === 0);
check.check("9. A medicação também conta", creatineCautions({currentMedication: "Tratamento para a gravidez"}).length === 1);

// ---- estado ----
var s = student();
check.check("10. Aluno normal: ligada com 4 g", creatineStatus(s).state === "on" && creatineStatus(s).dose === 4 && creatineStatus(s).on === true);
check.check("11. Sem peso: não aparece, diz porquê", creatineStatus(student({weightCurrent: 0, weight: 0})).state === "sem-peso" && !creatineStatus(student({weightCurrent: 0})).on);
check.check("12. Retirada pelo profissional (blockedFoods): não aparece", creatineStatus(student({blockedFoods: ["Creatina mono-hidratada"]})).state === "off" && creatineStatus(student({blockedFoods: ["creatina MONO-hidratada"]})).on === false);
check.check("13. Com aviso e sem confirmação: não aparece ao aluno", creatineStatus(student({age: 16})).state === "confirmar" && creatineStatus(student({age: 16})).on === false);
check.check("14. Com aviso e confirmação do profissional: aparece", creatineStatus(student({age: 16, nutritionPhase: {creatineConfirmed: true}})).on === true);

// ---- onde aparece ----
check.check("15. Aparece no pequeno-almoço, mesmo não sendo a primeira refeição guardada", breakfastMealIndex(s.meals) === 1);
check.check("16. Sem refeição chamada pequeno-almoço, é a primeira por hora com alimentos", breakfastMealIndex([meal("Refeição A", "12:00", [food("Arroz", "100 g")]), meal("Refeição B", "09:30", [food("Pão", "50 g")]), meal("Refeição C", "07:00", [])]) === 1);
check.check("17. «Pequeno-almoço», «pequeno almoço» e «PEQUENO-ALMOCO» (sem acento) são reconhecidos", [["Pequeno-almoço"], ["pequeno almoço"], ["PEQUENO-ALMOCO"]].every(function(n){ return breakfastMealIndex([meal("Almoço", "07:00", [food("Arroz", "1 g")]), meal(n[0], "10:00", [food("Pão", "1 g")])]) === 1; }));
check.check("18. Plano sem alimentos: sem linha (não se cria uma refeição só com creatina)", breakfastMealIndex([meal("Pequeno-almoço", "08:00", [])]) === -1 && breakfastMealIndex([]) === -1);
check.check("19. A pequeno-almoço vazio ignora-se e usa-se a primeira refeição com alimentos", breakfastMealIndex([meal("Pequeno-almoço", "08:00", []), meal("Almoço", "13:00", [food("Arroz", "100 g")])]) === 1);

var html = tplPlano(studentView(s));
var count = (html.match(/Creatina mono-hidratada/g) || []).length;
check.check("20. O plano do aluno mostra a creatina uma só vez, com a dose e a nota do horário", count === 1 && /4 g/.test(html) && /Pode ser tomada em qualquer altura do dia\./.test(html));
var at = html.indexOf("Creatina mono-hidratada");
check.check("21. A linha fica dentro do cartão do pequeno-almoço (depois da Aveia, antes do cartão seguinte)", html.indexOf("Aveia") > 0 && at > html.indexOf("Aveia") && at < html.indexOf("Frango") && html.indexOf("Arroz") < html.indexOf("Aveia"));
var s2 = student({weightCurrent: 100, height: 200});
check.check("22. A dose acompanha o peso sozinha (100 kg → 5 g) sem tocar no plano guardado", /5 g/.test(creatineLineHtml(s2)) && s2.meals.every(function(m){ return m.foods.every(function(f){ return f.name !== "Creatina mono-hidratada"; }); }));
check.check("23. Retirada → não aparece nem no plano nem no detalhe", tplPlano(studentView(student({blockedFoods: [CREATINE_NAME]}))).indexOf("Creatina") < 0 && creatineLineHtml(student({age: 15})) === "");
check.check("24. Totais do dia não mudam (a creatina não entra nas calorias nem nos macros)", (function(){ var a = resolvedMealTotals(student(), student().meals[1]); return a.kcal === foodsTotals(student().meals[1].foods).kcal; })());
check.check("25. A lista de compras não leva a creatina (não está no plano guardado)", JSON.stringify(shoppingListFor(student(), 7)).indexOf("Creatina") < 0);

// ---- cartão do profissional ----
var card = tplCreatineCard(s);
check.check("26. O profissional vê a dose, a conta e o botão «Retirar do plano»", /4 g por dia/.test(card) && /0,05 g/.test(card) && /id="creatineToggle" data-on="0"/.test(card) && /não é gordura/.test(card));
check.check("27. Com excesso de peso o cartão diz que é peso de referência", /de referência/.test(tplCreatineCard(student({weightCurrent: 130, height: 170}))));
check.check("28. Retirada: o cartão oferece «Incluir no plano»", /id="creatineToggle" data-on="1"/.test(tplCreatineCard(student({blockedFoods: [CREATINE_NAME]}))));
check.check("29. Com aviso: o cartão diz o motivo e pede indicação médica", /menos de 18 anos/.test(tplCreatineCard(student({age: 16}))) && /id="creatineConfirm"/.test(tplCreatineCard(student({age: 16}))));
check.check("30. Se o aluno já toma creatina o cartão avisa para não duplicar", /já toma creatina/.test(tplCreatineCard(student({supplements: ["Creatina"]}))) && !/já toma creatina/.test(card));

// ---- ações do profissional ----
phaseColumnAvailable = true; sbReady = false;
var p = student();
setCreatineEnabled(p, false);
check.check("31. Retirar guarda o nome em blockedFoods, regista no histórico e marca o início/fim para a fase de peso", creatineBlocked(p) && p.planHistory.length === 1 && p.planHistory[0].type === "creatina" && p.nutritionPhase && p.nutritionPhase.creatineOn === false && /^\d{4}-\d{2}-\d{2}$/.test(p.nutritionPhase.creatineStartDate));
setCreatineEnabled(p, true);
check.check("32. Incluir outra vez tira-a de blockedFoods sem duplicar", !creatineBlocked(p) && p.blockedFoods.length === 0 && p.planHistory.length === 2 && p.nutritionPhase.creatineOn === true);
var q = student({age: 15});
confirmCreatine(q);
check.check("33. Confirmar com indicação médica liga-a e fica registado", creatineStatus(q).on === true && Array.isArray(q.nutritionPhase.creatineConfirmed) && q.nutritionPhase.creatineConfirmed.join() === "menor" && q.planHistory.length === 1 && /menos de 18 anos/.test(q.planHistory[0].summary));

// ---- guardar e ler ----
var row = studentToRow(Object.assign(student(), {nutritionPhase: {phase: "cut", creatineConfirmed: true}}));
check.check("34. studentToRow envia nutrition_phase", row.nutrition_phase && row.nutrition_phase.phase === "cut");
var back = rowToStudent(Object.assign({}, row, {id: "t1"}));
check.check("35. rowToStudent lê-a de volta e ignora lixo (array, texto)", back.nutritionPhase && back.nutritionPhase.creatineConfirmed === true && rowToStudent(Object.assign({}, row, {nutrition_phase: [1]})).nutritionPhase === null && rowToStudent(Object.assign({}, row, {nutrition_phase: "x"})).nutritionPhase === null);
phaseColumnAvailable = false;
check.check("36. Sem a migração 0029 a coluna não é enviada (o resto grava-se na mesma)", !("nutrition_phase" in studentToRow(student())));
phaseColumnAvailable = true;
var mig = fs.readFileSync(__dirname + "/../supabase/migrations/0029_nutrition_phase.sql", "utf8");
check.check("37. A migração 0029 junta nutrition_phase (jsonb) de forma repetível e sem apagar dados", /add column if not exists nutrition_phase jsonb/.test(mig) && /drop constraint if exists/.test(mig) && !/drop table|delete from/i.test(mig));

// ---- revisão adversarial: mais campos, acentos, idade, motivos, duplicados ----
check.check("38. Gravidez e rins também se detetam nas «Observações» e nas «Lesões ou limitações» da ficha médica", creatineCautions({medicalNotes: "Grávida de 12 semanas"}).length === 1 && creatineCautions({physicalLimitations: "Doença renal crónica"}).length === 1 && creatineStatus(student({medicalNotes: "está a amamentar"})).state === "confirmar");
check.check("39. Termos compostos e com acentos soltos (NFD) também apanham: hemodiálise, pielonefrite, glomerulonefrite, gestação, puérpera, aleitamento", ["Hemodiálise", "Pielonefrite de repetição", "Glomerulonefrite", "Gestação de risco", "puérpera", "aleitamento materno", "Dialise".normalize("NFD"), "grávida"].every(function(t){ return creatineCautions({medicalConditions: t}).length >= 1; }));
check.check("40. Sem falsos positivos: gravidade, lactato, lactase, gestão, primeira, circuito", ["gravidade moderada da lesão", "lactato elevado", "intolerância à lactase", "gestão do tempo", "primeira consulta", "treino em circuito"].every(function(t){ return creatineCautions({medicalConditions: t}).length === 0; }));
check.check("41. A idade vem da data de nascimento (e passa dos 18 sozinha): 17 anos guardados mas nascido há 25 anos = adulto", creatineCautions({age: 17, birthDate: "2001-01-01"}).length === 0 && creatineCautions({age: 30, birthDate: "2015-06-01"}).length === 1 && creatineCautions({age: 16}).length === 1);
// confirmação ligada ao motivo
var cm = student({age: 16}); confirmCreatine(cm);
check.check("42. A confirmação guarda os motivos vistos (menor): se aparece outro (gravidez), volta a pedir", creatineStatus(cm).on === true && (function(){ cm.medicalNotes = "Grávida"; return creatineStatus(cm).state === "confirmar" && creatineCautions(cm).length === 2; })());
check.check("43. Confirmações antigas (true) continuam a valer", creatineStatus(student({age: 16, nutritionPhase: {creatineConfirmed: true}})).on === true);
// plano com creatina escrita à mão
var hand = student(); hand.meals[1].foods.push(food("Creatina monohidratada", "5 g"));
check.check("44. Se o plano já tem creatina escrita à mão, a linha automática esconde-se (sem duplicar) e o cartão explica", creatineStatus(hand).state === "no-plano" && creatineLineHtml(hand) === "" && /escrita à mão/.test(tplCreatineCard(hand)) && creatineStatus(student({meals: [meal("Pequeno-almoço", "08:00", [food("Creatinina", "1 g")])]})).state === "on");
// incluir numa ficha por confirmar
var fl = student({age: 16, blockedFoods: [CREATINE_NAME]});
setCreatineEnabled(fl, true);
check.check("45. Desbloquear uma ficha por confirmar não diz «incluída» nem marca o relógio da creatina", creatineStatus(fl).state === "confirmar" && /a aguardar a confirmação/.test(fl.planHistory[0].summary) && fl.planHistory[0].after === "por confirmar" && !(fl.nutritionPhase && fl.nutritionPhase.creatineStartDate));
check.check("46. A data do relógio da creatina é a local (a mesma da revisão de peso)", (function(){ var x = student(); setCreatineEnabled(x, false); return x.nutritionPhase.creatineStartDate === localTodayISO(); })());
check.check("47. Sem a migração 0029 a confirmação não finge que gravou", (function(){ phaseColumnAvailable = false; var x = student({age: 16}); var r = confirmCreatine(x); phaseColumnAvailable = true; return !!r.error && /0029/.test(r.error) && creatineStatus(x).state === "confirmar"; })());
check.check("48. O cartão só diz que a revisão ignora o período da creatina quando há data de início", !/ignora esse período/.test(tplCreatineCard(student())) && /ignora esse período/.test(tplCreatineCard(student({nutritionPhase: {creatineStartDate: localTodayISO()}}))));

check.summarize();
