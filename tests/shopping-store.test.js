// Lista de compras por supermercado: marcas próprias, produto equivalente na loja escolhida, texto para copiar e escolha guardada.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

var store = {};
global.localStorage = {getItem: function(k){ return k in store ? store[k] : null; }, setItem: function(k, v){ store[k] = String(v); }, removeItem: function(k){ delete store[k]; }, key: function(i){ return Object.keys(store)[i] || null; }, get length(){ return Object.keys(store).length; }};

// 1. de que loja é cada alimento
check.check("1. Marca própria dá a loja (Continente Equilíbrio, Hacendado, Milbona, Milsani, Pâturages)", storesOfFood("Leite magro (Continente Equilíbrio)").stores[0] === "Continente" && storesOfFood("Pão (Hacendado)").stores[0] === "Mercadona" && storesOfFood("Iogurte (Milbona)").stores[0] === "Lidl" && storesOfFood("Leite (Milsani)").stores[0] === "Aldi" && storesOfFood("Leite (Pâturages)").stores[0] === "Intermarché");
check.check("2. Genéricos e marcas nacionais não têm loja", storesOfFood("Frango (peito)").kind === "any" && storesOfFood("Iogurte (Danone)").kind === "any");
check.check("3. O sufixo '· Retalhista' e a lista do catálogo contam como loja explícita", storesOfFood("Cereais (Nestlé) · Lidl").stores[0] === "Lidl" && (function(){ FOOD_RETAILERS["Atum X (Marca)"] = ["Lidl", "Aldi"]; return storesOfFood("Atum X (Marca)").kind === "explicit" && storesOfFood("Atum X (Marca)").stores.length === 2; })());

// 2. catálogo simulado: o mesmo iogurte em duas lojas, uma marca nacional e um produto só no Lidl
var base = FOOD_DB["Iogurte grego natural"];
function prod(name, brand, extra){ return Object.assign({name: name, brand: brand, food_group: "laticinios", kcal: base.kcal, protein: base.p, carbs: base.c, fat: base.f, package_quantity: 125, package_unit: "g"}, extra || {}); }
mergeFoodProduct(prod("Iogurte grego natural", "Pingo Doce"), []);
mergeFoodProduct(prod("Iogurte grego natural", "Continente"), []);
mergeFoodProduct(prod("Iogurte grego natural", "Danone"), []);
check.check("4. Os produtos do catálogo ficam nos alimentos da app com a loja deduzida da marca", !!FOOD_DB["Iogurte grego natural (Pingo Doce)"] && storesOfFood("Iogurte grego natural (Continente)").stores[0] === "Continente");

var s = {id: "alu", meals: [meal("Lanche", "17:00", [food("Iogurte grego natural", "200 g", "laticinios"), food("Iogurte grego natural (Continente)", "125 g", "laticinios"), food("Iogurte grego natural (Danone)", "125 g", "laticinios"), food("Frango (peito)", "150 g", "carnes")])]};
function find(list, name){ var r = null; list.forEach(function(g){ g.items.forEach(function(it){ if (it.name === name) r = it; }); }); return r; }
var pd = shoppingListFor(s, 7, "Pingo Doce");
check.check("5. Genérico + loja com produto parecido: sugere a marca própria dessa loja", find(pd, "Iogurte grego natural").info.status === "generic" && find(pd, "Iogurte grego natural").info.suggestion.name === "Iogurte grego natural (Pingo Doce)");
check.check("6. Marca própria de outra loja: diz onde é e propõe o equivalente", find(pd, "Iogurte grego natural (Continente)").info.status === "other" && find(pd, "Iogurte grego natural (Continente)").info.only === "Continente" && find(pd, "Iogurte grego natural (Continente)").info.suggestion.name === "Iogurte grego natural (Pingo Doce)");
check.check("7. Marca nacional do catálogo há em todo o lado", find(pd, "Iogurte grego natural (Danone)").info.status === "here" || find(pd, "Iogurte grego natural (Danone)").info.status === "generic");
check.check("8. Sem produto parecido na loja o genérico fica genérico, sem sugestão", find(pd, "Frango (peito)").info.status === "generic" && !find(pd, "Frango (peito)").info.suggestion);
var co = shoppingListFor(s, 7, "Continente");
check.check("9. Na loja certa a marca própria está 'aqui'", find(co, "Iogurte grego natural (Continente)").info.status === "here");
check.check("10. Sem loja escolhida a lista é a de sempre (sem informação extra)", find(shoppingListFor(s, 7), "Iogurte grego natural").info === null);
var sg = find(pd, "Iogurte grego natural (Continente)").info.suggestion;
check.check("11. A sugestão traz a quantidade em embalagens inteiras da loja (125 g → 7 embalagens)", /embalagens? de 125 g/.test(sg.qty));
var mercadona = shoppingListFor(s, 7, "Mercadona");
check.check("12. Numa loja sem equivalente a marca própria de outra loja fica 'sem equivalente'", find(mercadona, "Iogurte grego natural (Continente)").info.status === "other" && !find(mercadona, "Iogurte grego natural (Continente)").info.suggestion);

// 3. texto, escolha guardada e ecrã
var txt = shoppingListText(s, 7, "Pingo Doce");
check.check("13. O texto para copiar leva o título, os grupos e as trocas por produto da loja", /^Lista de compras — Pingo Doce \(7 dias\)/.test(txt) && /em vez de Iogurte grego natural \(Continente\)/.test(txt) && /sugestão Pingo Doce: Iogurte grego natural \(Pingo Doce\)/.test(txt) && /- Frango \(peito\): /.test(txt));
check.check("14. Sem loja o texto não fala de lojas", !/sugestão|em vez de/.test(shoppingListText(s, 7, "")) && /^Lista de compras \(7 dias\)/.test(shoppingListText(s, 7, "")));
check.check("15. A escolha da loja guarda-se por aluno e ignora valores inválidos", shopStoreGet(s) === "" && (shopStoreSet(s, "Lidl"), shopStoreGet(s) === "Lidl") && shopStoreGet({id: "outra"}) === "" && (store[shopStoreKeyFor(s)] = "Loja inventada", shopStoreGet(s) === "") && (shopStoreSet(s, ""), !(shopStoreKeyFor(s) in store)));
shopStoreSet(s, "Pingo Doce");
state.shopDays = 7; state.planoSection = "compras";
var html = tplPlanoTabs(s);
check.check("16. O ecrã tem o seletor com as 7 lojas, o resumo e as notas por item", /id="shopStore"/.test(html) && SHOP_STORES.every(function(n){ return html.indexOf(">" + n + "</option>") > 0; }) && /<option value="Pingo Doce" selected>/.test(html) && /Só no Continente/.test(html) && /Sugestão Pingo Doce/.test(html) && /id="shopCopy"/.test(html));
shopStoreSet(s, "");
check.check("17. Sem loja não há notas nem resumo", !/shop-sub/.test(tplPlanoTabs(s)) && /Qualquer supermercado/.test(tplPlanoTabs(s)));
state.planoSection = "alimentacao";
delete global.localStorage;
check.summarize();
