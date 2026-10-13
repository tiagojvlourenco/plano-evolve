// Biblioteca de exercícios partilhada: lista base por grupo, exercícios do estúdio (substituem a base), pesquisa e filtros.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var fs = require("fs");

var seed = exerciseSeedList();
check.check("1. Há exercícios em todos os 10 grupos musculares", EXERCISE_GROUPS.length === 10 && EXERCISE_GROUPS.every(function(g){ return seed.some(function(e){ return e.group === g; }); }));
check.check("2. A lista base tem pelo menos 80 exercícios", seed.length >= 80);
var names = seed.map(function(e){ return exLibFold(e.name); });
check.check("3. Não há nomes repetidos na lista base", names.length === new Set(names).size);
check.check("4. Todos têm 2 ou 3 pontos-chave, dentro do limite de tamanho", seed.every(function(e){ return e.cues.length >= 2 && e.cues.length <= 3 && e.cues.every(function(c){ return c.length <= 120; }); }));
check.check("5. A demonstração de cada um é uma ligação https aceite pela app", seed.every(function(e){ return cleanDemoUrl(e.demo) === e.demo; }));
check.check("6. A ligação procura o exercício pelo nome", /search_query=Supino%20reto%20com%20barra%20execu/.test(seed.filter(function(e){ return e.name === "Supino reto com barra"; })[0].demo));
check.check("7. Os da lista base não têm vídeo próprio", seed.every(function(e){ return e.ownDemo === false && e.seed === true; }));

// pesquisa e filtro (ignora acentos e maiúsculas)
var all = exerciseLibraryMerged([]);
check.check("8. Filtrar por grupo mostra só esse grupo", exerciseLibraryFilter(all, "Costas", "").length > 5 && exerciseLibraryFilter(all, "Costas", "").every(function(e){ return e.group === "Costas"; }));
check.check("9. Pesquisar 'gemeos' encontra 'Gémeos' sem acentos", exerciseLibraryFilter(all, "", "gemeos").length >= 3);
check.check("10. Pesquisar por equipamento funciona (cabo)", exerciseLibraryFilter(all, "", "cabo").length >= 8);
check.check("11. Grupo + pesquisa combinam", exerciseLibraryFilter(all, "Ombros", "lateral").every(function(e){ return e.group === "Ombros" && /lateral/i.test(e.name); }) && exerciseLibraryFilter(all, "Ombros", "lateral").length === 2);
check.check("12. Pesquisa sem resultados devolve lista vazia", exerciseLibraryFilter(all, "", "xyzzy").length === 0);
check.check("13. A lista vem ordenada por grupo (Peito primeiro, Core no fim)", all[0].group === "Peito" && all[all.length - 1].group === "Core");

// validação
check.check("14. Sem nome, a gravação é recusada", !!exLibClean({name: " ", group: "Peito"}).error);
check.check("15. Sem grupo válido, a gravação é recusada", !!exLibClean({name: "X", group: "Pescoço"}).error);
check.check("16. Ligação http (não https) é recusada", !!exLibClean({name: "X", group: "Peito", demo: "http://mau"}).error);
var okc = exLibClean({name: "  Press   especial ", group: "Peito", demo: "https://v.test/a.mp4", cues: "a\nb\nc\nd", equipment: "Cabo"});
check.check("17. Limpa espaços do nome, mantém o vídeo e corta os pontos-chave em 3", okc.entry && okc.entry.name === "Press especial" && okc.entry.demo === "https://v.test/a.mp4" && okc.entry.cues.length === 3);

// exercícios do estúdio
var custom = [
  {id: "c1", name: "Supino reto com barra", group: "Peito", demo: "https://estudio.test/supino.mp4", cues: ["Dica do estúdio"]},
  {id: "c2", name: "Remada do estúdio", group: "Costas", demo: "", cues: ["Costas retas", "Cotovelos atrás"]}
];
var merged = exerciseLibraryMerged(custom);
var sup = merged.filter(function(e){ return e.name === "Supino reto com barra"; })[0];
check.check("18. Um exercício do estúdio com o mesmo nome substitui o da base (sem duplicar)", merged.filter(function(e){ return exLibFold(e.name) === "supino reto com barra"; }).length === 1 && sup.demo === "https://estudio.test/supino.mp4" && sup.ownDemo === true && sup.overrides === true && sup.id === "c1");
check.check("19. A substituição usa os pontos-chave do estúdio", sup.cues.length === 1 && sup.cues[0] === "Dica do estúdio");
var rem = merged.filter(function(e){ return e.name === "Remada do estúdio"; })[0];
check.check("20. Um exercício novo entra no seu grupo, sem vídeo próprio usa a pesquisa", rem && rem.group === "Costas" && rem.ownDemo === false && /youtube\.com\/results/.test(rem.demo) && merged.length === seed.length + 1);
check.check("21. Entradas inválidas do estúdio são ignoradas, não rebentam", exerciseLibraryMerged([{name: "", group: "Peito"}, null, {name: "Y", group: "Nada"}]).length === seed.length);
check.check("22. Escolher um exercício preenche nome, demonstração e pontos-chave (um por linha)", (function(){ var f = exerciseLibraryFill(sup); return f.name === "Supino reto com barra" && f.demo === "https://estudio.test/supino.mp4" && f.cues === "Dica do estúdio"; })());

// armazenamento local (modo sem Supabase) partilhado dentro do browser
var store = {};
global.localStorage = {getItem: function(k){ return k in store ? store[k] : null; }, setItem: function(k, v){ store[k] = String(v); }, removeItem: function(k){ delete store[k]; }};
(async function(){
  var r1 = await exerciseLibrarySave({name: "Meu exercício", group: "Core", demo: "https://v.test/x.gif", cues: "um\ndois"}, null, []);
  var l1 = (await exerciseLibraryCustomList()).data;
  check.check("23. Guardar no modo local acrescenta ao estúdio", !r1.error && l1.length === 1 && l1[0].name === "Meu exercício" && l1[0].id);
  var r2 = await exerciseLibrarySave({name: "meu exercício", group: "Core"}, null, l1);
  check.check("24. Nome repetido de outro exercício do estúdio é recusado", !!r2.error && (await exerciseLibraryCustomList()).data.length === 1);
  var r3 = await exerciseLibrarySave({name: "Meu exercício", group: "Glúteos", demo: ""}, l1[0].id, l1);
  var l3 = (await exerciseLibraryCustomList()).data;
  check.check("25. Editar um exercício do estúdio atualiza-o sem o duplicar", !r3.error && l3.length === 1 && l3[0].group === "Glúteos" && l3[0].id === l1[0].id);
  await exerciseLibrarySave({name: "Supino reto com barra", group: "Peito", demo: "https://estudio.test/s.mp4"}, null, l3);
  var l4 = (await exerciseLibraryCustomList()).data;
  check.check("26. Guardar um da base cria a versão do estúdio; apagá-la repõe o original", l4.length === 2 && exerciseLibraryMerged(l4).filter(function(e){ return e.name === "Supino reto com barra"; })[0].ownDemo === true
    && await (async function(){ var id = l4.filter(function(c){ return c.name === "Supino reto com barra"; })[0].id; await exerciseLibraryDelete(id); var m = exerciseLibraryMerged((await exerciseLibraryCustomList()).data); return m.filter(function(e){ return e.name === "Supino reto com barra"; })[0].ownDemo === false; })());

  // ligação ao editor de treino
  check.check("27. O editor de treino tem o botão 'Escolher da biblioteca' em cada dia", /data-ex-lib/.test(appSource) && /Escolher da biblioteca/.test(appSource));
  check.check("28. Escolher da biblioteca preenche nome, vídeo e pontos-chave do formulário", /data-ex-lib[\s\S]{0,700}box\.querySelector\("\[data-ex-name\]"\)\.value = fill\.name[\s\S]{0,200}data-ex-demo[\s\S]{0,120}data-ex-cues/.test(appSource.slice(appSource.indexOf("function wireProTreino"))));
  check.check("29. A migração 0021 existe, só profissionais leem e escrevem, e o nome é único", (function(){ var m = fs.readFileSync(__dirname + "/../supabase/migrations/0021_exercise_library.sql", "utf8"); return /enable row level security/.test(m) && /for select/.test(m) && /for insert/.test(m) && /for update/.test(m) && /for delete/.test(m) && /unique index[\s\S]{0,80}lower\(name\)/.test(m) && !/to anon|using \(true\)/i.test(m); })());
  check.summarize();
})();
