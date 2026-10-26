// Livro de exercícios do estúdio (importado de um Excel, só texto): grupos, repetidos, equipamento.
require("./setup")();
eval(require("./extract-app")());
var check = require("./check")();
var list = exerciseSeedList(), book = list.filter(function(e){ return e.book; });
var names = list.map(function(e){ return exLibFold(e.name); });
check.check("1. O livro acrescenta 554 exercícios à base de 84 (572 do Excel entram, 18 já existiam)", book.length === 554 && list.length === 638);
check.check("2. Não há nomes repetidos na lista completa", names.length === new Set(names).size);
check.check("3. Todos os grupos do livro existem na app e Corpo inteiro e Cardio têm exercícios", book.every(function(e){ return EXERCISE_GROUPS.indexOf(e.group) >= 0; }) && book.some(function(e){ return e.group === "Corpo inteiro"; }) && book.some(function(e){ return e.group === "Cardio"; }));
function g(n){ return list.filter(function(e){ return e.name === n; })[0].group; }
check.check("4. Exemplos nos grupos certos: Burpee→Cardio, Clean + Jerk→Corpo inteiro, Plank→Core, Hyperextension→Posteriores, Bridge→Glúteos, Pullover (barra)→Costas, Upright Row (barra)→Ombros", g("Burpee") === "Cardio" && g("Clean + Jerk") === "Corpo inteiro" && g("Plank") === "Core" && g("Hyperextension") === "Posteriores" && g("Bridge") === "Glúteos" && g("Pullover (barra)") === "Costas" && g("Upright Row (barra)") === "Ombros");
check.check("5. O equipamento sai do nome: (barra)→Barra, Kettlebell Swing→Kettlebell, Push Up→Peso corporal", list.filter(function(e){ return e.name === "Bent Over Row (barra)"; })[0].equipment === "Barra" && list.filter(function(e){ return /^Single Arm Kettlebell Swing$/.test(e.name); })[0].equipment === "Kettlebell" && list.filter(function(e){ return e.name === "Pike Push Up"; })[0].equipment === "Peso corporal");
check.check("6. A demonstração de cada um liga a uma pesquisa https válida (também com apóstrofo)", list.every(function(e){ return cleanDemoUrl(e.demo) === e.demo; }) && /Farmer%27s/.test(list.filter(function(e){ return e.name === "Farmer's Walk"; })[0].demo));
check.check("7. O grupo de um exercício do livro adivinha-se pelo nome (exerciseGroupFor)", exerciseGroupFor("Burpee") === "Cardio" && exerciseGroupFor("Clean + Jerk") === "Corpo inteiro");
var v = volumeRows({trainingProgram: {name: "x", days: [{id: "d", name: "A", exercises: [{id: "e", name: "Burpee", sets: 3, reps: "10", group: "Cardio"}]}]}, workoutLogs: []});
check.check("8. Cardio e Corpo inteiro nunca dão aviso de volume baixo", v.rows.filter(function(r){ return r.group === "Cardio"; })[0].status === "ok");
check.summarize();
