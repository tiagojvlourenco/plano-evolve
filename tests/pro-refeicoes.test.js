// Fase 38 — ecrã de Nutrição do profissional: cada refeição é recolhível, com resumo numa linha e estado lembrado por refeição.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

var m1 = {name: "Almoço", time: "13:00", foods: [{name: "Arroz", qty: "100 g", group: "cereais"}, {name: "Frango", qty: "150 g", group: "carnes"}]};
var m2 = {name: "Jantar", time: "20:00", foods: []};
var h1 = tplPlanoMealEditor(m1, 0), h2 = tplPlanoMealEditor(m2, 1);
check.check("1. A refeição é um <details> fechado por omissão", /<details class="pm-details" data-midx="0">/.test(h1) && !/pm-details"[^>]* open/.test(h1));
check.check("2. O resumo mostra nome, hora, kcal e nº de alimentos", /pm-sum-name">Almoço</.test(h1) && /13:00 · \d+ kcal · 2 alimentos/.test(h1));
check.check("3. Sem alimentos o resumo diz 0 alimentos; com um diz «1 alimento»", /0 alimentos/.test(h2) && /1 alimento</.test(tplPlanoMealEditor({name: "X", time: "10:00", foods: [m1.foods[0]]}, 0)));
check.check("4. Os campos de edição continuam no DOM (nome, horário, remover, adicionar alimento)", /class="pm-name"/.test(h1) && /class="pm-time"/.test(h1) && /data-del-meal="0"/.test(h1) && /add-food-details/.test(h1));
PRO_MEAL_OPEN.add(m1);
check.check("5. Uma refeição marcada como aberta volta a abrir-se no redesenho", /pm-details" data-midx="0" open>/.test(tplPlanoMealEditor(m1, 0)));
check.check("6. O estado vai com a refeição, não com a posição (reordenar por horário não o troca)", /pm-details" data-midx="1" open>/.test(tplPlanoMealEditor(m1, 1)) && !/ open>/.test(tplPlanoMealEditor(m2, 0)));
check.check("7. O nome da refeição no resumo é escapado", /&lt;b&gt;/.test(tplPlanoMealEditor({name: "<b>", time: "9:00", foods: []}, 0)));
check.check("8. Ligação: o evento toggle regista o estado e a refeição nova abre-se", /querySelectorAll\("\.pm-details"\)[\s\S]{0,300}PRO_MEAL_OPEN\.add\(m\)/.test(appSource) && /PRO_MEAL_OPEN\.add\(newMeal\)/.test(appSource));
check.summarize();
