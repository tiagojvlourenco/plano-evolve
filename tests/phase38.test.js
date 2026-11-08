// Fase 38 — arranque: o catálogo lê-se em paralelo, com menos colunas, e não se pede na Gestão nem no Treino.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

function rowsOf(total){ var r = []; for (var i = 0; i < total; i++) r.push({id: "id" + i, name: "P" + i, brand: "M", food_group: "cereais", kcal: 100, protein: 5, carbs: 10, fat: 1, food_product_retailers: []}); return r; }

// um «Supabase» mínimo: conta, páginas por range, e o registo do que foi pedido
function fakeSb(total, opts){
  opts = opts || {};
  var all = rowsOf(total), log = {countCalls: 0, ranges: [], selects: [], started: 0, maxParallel: 0, running: 0};
  return {log: log, from: function(t){
    var q = {_cols: null, _head: false, _range: null};
    q.select = function(cols, o){ q._cols = cols; q._head = !!(o && o.head); log.selects.push(cols); return q; };
    q.eq = function(){ return q; };
    q.order = function(){ return q; };
    q.range = function(a, b){ q._range = [a, b]; return q; };
    q.then = function(res, rej){
      var p;
      if (q._head){ log.countCalls++; p = Promise.resolve(opts.countError ? {error: {message: "x"}, count: null} : {error: null, count: total}); }
      else {
        var r = q._range || [0, 999]; log.ranges.push(r);
        log.running++; log.maxParallel = Math.max(log.maxParallel, log.running);
        var fail = opts.failRange && r[0] === opts.failRange && !opts.failedOnce; if (fail) opts.failedOnce = true;
        p = new Promise(function(ok){ setTimeout(function(){ log.running--; ok(fail ? {error: {message: "boom"}, data: null} : {error: null, data: all.slice(r[0], r[1] + 1)}); }, 15); });
      }
      return p.then(res, rej);
    };
    return q;
  }};
}
function makeQuery(sbFake){ return function(){ return sbFake.from("food_products").select(FOOD_PRODUCT_COLS).eq("verification_status", "verified").order("id"); }; }

(async function(){
  // 1. 2500 produtos -> 3 páginas pedidas ao mesmo tempo
  var f1 = fakeSb(2500); sb = f1;
  var r1 = await fetchFoodProductsFast(makeQuery(f1));
  check.check("1. Devolve os 2500 produtos, em ordem", r1.data.length === 2500 && r1.data[0].id === "id0" && r1.data[2499].id === "id2499");
  check.check("1. Pediu a contagem uma vez e 3 páginas (0-999, 1000-1999, 2000-2499)", f1.log.countCalls === 1 && JSON.stringify(f1.log.ranges) === JSON.stringify([[0,999],[1000,1999],[2000,2499]]));
  check.check("1. As páginas foram pedidas em paralelo (3 ao mesmo tempo)", f1.log.maxParallel === 3);

  // 2. uma página com erro -> cai na leitura em série e não perde nada
  var f2 = fakeSb(2500, {failRange: 1000}); sb = f2;
  var r2 = await fetchFoodProductsFast(makeQuery(f2));
  check.check("2. Uma página falha -> volta a ler tudo em série (2500 produtos, sem duplicados)", r2.data.length === 2500 && new Set(r2.data.map(function(x){ return x.id; })).size === 2500);

  // 3. contagem indisponível -> leitura em série
  var f3 = fakeSb(1500, {countError: true}); sb = f3;
  var r3 = await fetchFoodProductsFast(makeQuery(f3));
  check.check("3. Sem contagem -> leitura em série de sempre (1500 produtos)", r3.data.length === 1500 && f3.log.maxParallel === 1);

  // 4. catálogo vazio / pequeno
  var f4 = fakeSb(0); sb = f4;
  var r4 = await fetchFoodProductsFast(makeQuery(f4));
  check.check("4. Catálogo vazio não rebenta", Array.isArray(r4.data) && r4.data.length === 0);
  var f5 = fakeSb(37); sb = f5;
  var r5 = await fetchFoodProductsFast(makeQuery(f5));
  check.check("4. 37 produtos -> 1 página", r5.data.length === 37 && f5.log.ranges.length === 1);

  // 5. colunas: só as que o merge usa
  check.check("5. Não pede ingredientes, alergénios, notas internas nem fontes", !/ingredients|allergens|internal_note|source_url|source_type|verified_by/.test(FOOD_PRODUCT_COLS));
  check.check("5. Pede o que mergeFoodProduct precisa", ["name","brand","food_group","kcal","protein","carbs","fat","package_quantity","package_unit","food_product_retailers(retailer)"].every(function(c){ return FOOD_PRODUCT_COLS.indexOf(c) >= 0; }));
  // um produto lido com estas colunas entra na base de alimentos
  var before = Object.keys(FOOD_DB).length;
  mergeFoodProduct({id: "z", name: "Iogurte teste fase 38", brand: "Marca", food_group: "laticinios", kcal: 60, protein: 4, carbs: 5, fat: 2, package_quantity: 125, package_unit: "g"}, [{retailer: "Lidl"}]);
  check.check("5. O produto entra em FOOD_DB com as colunas pedidas", Object.keys(FOOD_DB).length === before + 1 && !!FOOD_DB["Iogurte teste fase 38 (Marca) · Lidl"]);

  // 6. a Gestão e o Treino não pedem o catálogo no arranque
  var src = appSource.slice(appSource.indexOf("function finishBoot"), appSource.indexOf("\nfunction ", appSource.indexOf("function finishBoot") + 1));
  check.check("6. finishBoot só pede o catálogo quando a app mostra alimentos", /needsFoods\s*=\s*APP_MODE !== "gestao" && APP_MODE !== "treino"/.test(src) && /offline \|\| !needsFoods/.test(src));

  // 7. alimentos bloqueados (o mesmo critério dos templates, agora também no plano a partir do texto)
  var sb1 = {blockedFoods: ["Atum (natural)", "Leite meio gordo"]};
  check.check("7. Bloqueado, sem distinguir maiúsculas", isFoodBlockedFor(sb1, "atum (natural)") && isFoodBlockedFor(sb1, "LEITE MEIO GORDO"));
  check.check("7. Não bloqueia o que não está na lista e aguenta aluno sem lista", !isFoodBlockedFor(sb1, "Frango (peito)") && !isFoodBlockedFor({}, "Atum (natural)") && !isFoodBlockedFor(null, "x") && !isFoodBlockedFor({blockedFoods: []}, "x"));

  // 8. números em PT-PT: vírgula, e uma casa decimal só quando existe
  check.check("8. ptDec", ptDec(28.8) === "28,8" && ptDec(14) === "14" && ptDec(14.04) === "14" && ptDec("3.25") === "3,3");
  var demo = buildFullDemoStudent();
  var html = tplEvolucaoAluno(demo, {});
  var hero = html.slice(html.indexOf("Evolução de peso"), html.indexOf("Composição corporal"));
  check.check("8. O peso do ecrã Progresso usa vírgula (sem '73.0kg')", !/\d\.\d/.test(hero.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")));

  // 9. filtros rápidos do painel: quem precisa de quê, sem abrir cada ficha
  function dIso(n){ var d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); }
  function mk(id, over){ var st = buildFullDemoStudent(); st.id = id; st.isDemo = false; st.active = true; st.assessments = []; st.nutritionPhase = null; Object.keys(over || {}).forEach(function(k){ st[k] = over[k]; }); return st; }
  var recent = mk("recente", {weights: [{date: dIso(21), w: 81}, {date: dIso(14), w: 80.8}, {date: dIso(7), w: 80.5}, {date: dIso(2), w: 80.2}], weightCurrent: 80.2, goal: "Perda de peso"});
  var velha = mk("velha", {weights: [{date: dIso(90), w: 82}, {date: dIso(60), w: 81}], weightCurrent: 81, goal: "Perda de peso"});
  var nunca = mk("nunca", {weights: [], weightCurrent: null, goal: "Perda de peso"});
  var parada = mk("parada", {weights: [{date: dIso(20), w: 80}, {date: dIso(14), w: 80.1}, {date: dIso(7), w: 80}, {date: dIso(1), w: 80}], weightCurrent: 80, goal: "Perda de peso"});
  var soEstudio = mk("estudio", {weights: [], weightCurrent: null, studioOnly: true, inviteEmail: "", authUserId: null});
  var inativo = mk("inativo", {weights: [], weightCurrent: null, active: false});
  STUDENTS = [recent, velha, nunca, parada, soEstudio, inativo];
  var q = dashQuickFilters(STUDENTS);
  check.check("9. Avaliação em atraso: a de há 60 dias e quem nunca teve; não a recente, nem o aluno só de estúdio, nem o inativo", q.avaliacao.indexOf("velha") >= 0 && q.avaliacao.indexOf("nunca") >= 0 && q.avaliacao.indexOf("recente") < 0 && q.avaliacao.indexOf("estudio") < 0 && q.avaliacao.indexOf("inativo") < 0);
  check.check("9. Fora do objetivo: o peso parado; não o que está a descer bem", q.objetivo.indexOf("parada") >= 0 && q.objetivo.indexOf("recente") < 0);
  check.check("9. Sem fase definida não há revisões de plano a decidir", q.revisao.length === 0);
  check.check("9. Aguenta lista vazia", JSON.stringify(dashQuickFilters([])) === JSON.stringify({avaliacao: [], revisao: [], objetivo: []}));

  // 10. estado do aluno no Resumo
  var rowsRecent = proEstadoRows(recent), labels = rowsRecent.map(function(r){ return r.label; }).join(",");
  check.check("10. Peso, avaliação e fase aparecem", /Peso/.test(labels) && /Avaliação/.test(labels) && /Fase/.test(labels));
  check.check("10. Aluno com a avaliação recente não tem aviso de avaliação", !rowsRecent.filter(function(r){ return r.label === "Avaliação"; })[0].warn);
  var rowsVelha = proEstadoRows(velha);
  check.check("10. Avaliação de há 60 dias leva aviso", rowsVelha.filter(function(r){ return r.label === "Avaliação"; })[0].warn === true);
  check.check("10. Sem avaliações -> diz-o e avisa", /Ainda sem avaliações/.test(proEstadoRows(nunca).filter(function(r){ return r.label === "Avaliação"; })[0].text));
  var cardHtml = tplProEstado(parada);
  check.check("10. O cartão lista o que precisa de atenção (peso parado) e não rebenta", /O que precisa de ti/.test(cardHtml) && /estagnad/i.test(cardHtml));
  check.check("10. Sem nada a pedir atenção diz-o", /Nada a pedir/.test(tplProEstado(mk("calmo", {weights: [{date: dIso(21), w: 81}, {date: dIso(14), w: 80.8}, {date: dIso(7), w: 80.5}, {date: dIso(2), w: 80.2}], weightCurrent: 80.2, goal: "Perda de peso", workoutLogs: [], trainingProgram: null}))) || /O que precisa de ti/.test(tplProEstado(mk("calmo", {}))));
  check.check("10. Nunca mostra 'undefined' nem 'NaN'", !/undefined|NaN/.test(cardHtml + tplProEstado(nunca) + tplProEstado(soEstudio)));

  check.summarize();
})();
