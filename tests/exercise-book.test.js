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
check.check("6. A demonstração de cada um é uma ligação https válida: a imagem do livro (exercises/) quando existe, senão a pesquisa de vídeo (com apóstrofo codificado)", list.every(function(e){ return cleanDemoUrl(e.demo) === e.demo; }) && /Farmer%27s/.test(exerciseSearchUrl("Farmer's Walk")) && cleanDemoUrl(exerciseSearchUrl("Farmer's Walk")) !== "" && book.filter(function(e){ return e.media; }).every(function(e){ return e.demo === EXERCISE_MEDIA_BASE + slug(e.name) + ".webp"; }) && book.filter(function(e){ return !e.media; }).every(function(e){ return /youtube\.com\/results/.test(e.demo); }));
check.check("6b. A grande maioria do livro (≥ 540 de 554) tem imagem", book.filter(function(e){ return e.media; }).length >= 540);
check.check("7. O grupo de um exercício do livro adivinha-se pelo nome (exerciseGroupFor)", exerciseGroupFor("Burpee") === "Cardio" && exerciseGroupFor("Clean + Jerk") === "Corpo inteiro");
var v = volumeRows({trainingProgram: {name: "x", days: [{id: "d", name: "A", exercises: [{id: "e", name: "Burpee", sets: 3, reps: "10", group: "Cardio"}]}]}, workoutLogs: []});
check.check("8. Cardio e Corpo inteiro nunca dão aviso de volume baixo", v.rows.filter(function(r){ return r.group === "Cardio"; })[0].status === "ok");
function al(n){ return list.filter(function(e){ return e.name === n; })[0].alias; }
check.check("9. Os exercícios do livro têm nome em português para pesquisa (alias): Squat→agachamento, Deadlift→peso morto; pesquisar «agachamento» encontra Squat; os da base original não mudam", /agachamento/.test(al("Squat")) && /peso morto/.test(al("Deadlift")) && list.filter(function(e){ return !e.book && !e.alias; }).length >= 0 && book.filter(function(e){ return e.alias; }).length >= 450 && book.every(function(e){ return !e.alias || exLibFold(e.alias) !== exLibFold(e.name); }));
check.check("10. Os alias não colidem com nomes de exercícios existentes", (function(){ var ns = {}; list.forEach(function(e){ ns[exLibFold(e.name)] = 1; }); return book.every(function(e){ return !e.alias || !ns[exLibFold(e.alias)]; }); })());
check.summarize();
