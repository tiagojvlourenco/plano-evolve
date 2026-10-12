// Open Food Facts: conversão dos dados, pesquisa (Portugal / EAN), gravação como 'verified' e pesquisa automática quando há poucos resultados locais.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

(async function(){
  var realSb = sb, realReady = sbReady, realFetch = global.fetch;
  var good = {code: "5601234567890", product_name: "Iogurte grego natural", brands: "Marca X, Outra", quantity: "4 x 125 g", product_quantity: "500", product_quantity_unit: "g",
    categories_tags: ["en:dairies", "en:yogurts"], stores_tags: ["pingo-doce", "lidl", "outra"], allergens_tags: ["en:milk"], ingredients_text_pt: "Leite <b>pasteurizado</b>",
    nutriments: {"energy-kcal_100g": 97, "proteins_100g": 9, "carbohydrates_100g": 4, "fat_100g": 5, "sugars_100g": 4, "fiber_100g": 0, "saturated-fat_100g": 3.4, "salt_100g": 0.1}};
  // 1. conversão
  var m = offMapProduct(good);
  check.check("1. Converte nome, marca (a primeira), EAN e macros por 100 g", m && m.name === "Iogurte grego natural" && m.brand === "Marca X" && m.ean === "5601234567890" && m.kcal === 97 && m.protein === 9 && m.carbs === 4 && m.fat === 5 && m.nutrition_basis === "100g");
  check.check("2. Grupo, embalagem, supermercados conhecidos, alergénios e ingredientes (sem HTML)", m.food_group === "laticinios" && m.package_quantity === 500 && m.package_unit === "g" && m.stores.join() === "Pingo Doce,Lidl" && m.allergens === "milk" && m.ingredients === "Leite pasteurizado");
  check.check("3. Fonte Open Food Facts com ligação individual ao produto", m.source_type === "open_food_facts" && m.source_url === "https://world.openfoodfacts.org/product/5601234567890");
  var liquid = offMapProduct(Object.assign({}, good, {code: "5600000000001", quantity: "1 l", product_quantity: "1", product_quantity_unit: "l", categories_tags: ["en:milks"]}));
  check.check("4. Líquidos ficam por 100 ml e a embalagem em ml", liquid.nutrition_basis === "100ml" && liquid.package_unit === "ml" && liquid.package_quantity === 1000);
  var kj = offMapProduct(Object.assign({}, good, {nutriments: {"energy_100g": 406, "proteins_100g": 9, "carbohydrates_100g": 4, "fat_100g": 5}}));
  check.check("5. Sem kcal usa kJ ÷ 4,184", kj && kj.kcal === 97);
  function bad(over){ return offMapProduct(Object.assign({}, good, over)); }
  function nut(over){ return {nutriments: Object.assign({}, good.nutriments, over)}; }
  check.check("6. Rejeita sem marca, sem nome, EAN inválido ou sem proteína", !bad({brands: ""}) && !bad({product_name: ""}) && !bad({code: "123"}) && !bad(nut({proteins_100g: null})));
  check.check("7. Rejeita valores impossíveis ou incoerentes (macros > 100 g, energia que não bate com os macros)", !bad(nut({fat_100g: 120})) && !bad(nut({proteins_100g: 60, carbohydrates_100g: 50})) && !bad(nut({"energy-kcal_100g": 600})));

  // 2. pesquisa
  var urls = [];
  global.fetch = function(u){ urls.push(u); return Promise.resolve({ok: true, json: function(){ return Promise.resolve(/api\/v2\/product/.test(u) ? {status: 1, product: good} : {products: [good, good, Object.assign({}, good, {code: "5601234567891", brands: ""})]}); }}); };
  var r1 = await offSearch("iogurte grego");
  check.check("8. A pesquisa por termo pede só produtos de Portugal e devolve os produtos válidos, sem repetidos", /cgi\/search\.pl\?search_terms=iogurte%20grego/.test(urls[0]) && /tag_0=portugal/.test(urls[0]) && r1.products.length === 1);
  await offSearch("Iogurte grego");
  check.check("9. Repetir a pesquisa usa a cache (um só pedido)", urls.length === 1);
  var r2 = await offSearch("5601234567890");
  check.check("10. Um código de barras usa o endpoint do produto", /api\/v2\/product\/5601234567890\.json/.test(urls[1]) && r2.products.length === 1);
  global.fetch = function(){ return Promise.reject(new Error("rede")); };
  var r3 = await offSearch("pesquisa falhada");
  check.check("11. Sem rede devolve erro (e não rebenta)", r3.error === true && r3.products.length === 0);

  // 3. gravação
  var calls = [], existing = null, sameName = null, mode = null;
  sb = {from: function(t){
    var api = {
      select: function(){ return api; },
      eq: function(c, v){ calls.push(t + " eq " + c + "=" + v); mode = "ean"; return api; },
      ilike: function(c, v){ calls.push(t + " ilike " + c + "=" + v); mode = "name"; return api; },
      limit: function(){ return Promise.resolve({data: mode === "ean" ? (existing ? [existing] : []) : (sameName || [])}); },
      insert: function(rows){ calls.push("insert " + t + " " + JSON.stringify(rows)); return {select: function(){ return Promise.resolve({data: Array.isArray(rows) ? rows : [Object.assign({id: "n1"}, rows)]}); }}; }
    };
    return api;
  }};
  sbReady = true;
  state.catalogProducts = [];
  var res = await offSaveProduct(m);
  var ins = JSON.parse(calls.filter(function(c){ return c.indexOf("insert food_products ") === 0; })[0].slice("insert food_products ".length));
  check.check("12. Grava em food_products como 'verified', fonte open_food_facts, com verified_at e nota de importação", ins.verification_status === "verified" && ins.source_type === "open_food_facts" && !!ins.verified_at && /Open Food Facts/.test(ins.internal_note) && ins.ean === m.ean && !("stores" in ins));
  check.check("13. Grava os supermercados reconhecidos", calls.some(function(c){ return /^insert food_product_retailers .*"Pingo Doce".*"Lidl"/.test(c); }));
  check.check("14. O produto fica logo nos alimentos da app e no Catálogo local", res.name === "Iogurte grego natural (Marca X)" && !!FOOD_DB[res.name] && FOOD_DB[res.name].p === 9 && state.catalogProducts.length === 1);
  existing = {id: "e1", name: "Iogurte grego natural", brand: "Marca X", verification_status: "pending"};
  var blocked = await offSaveProduct(m);
  check.check("15. Um EAN que já existe como pendente não é duplicado nem alterado", !!blocked.blocked && /Pendente|pendente/.test(blocked.blocked));
  existing.verification_status = "verified";
  var already = await offSaveProduct(m);
  check.check("16. Um EAN já verificado devolve o produto existente", already.existing === true);

  // 3b. repetidos sem EAN (produtos migrados do código) — o caso do "Leite magro (Continente Equilíbrio)"
  existing = null; calls = [];
  var milk = offMapProduct({code: "5601312507994", product_name: "Leite Magro", brands: "Continente Equilíbrio", categories_tags: ["en:milks"], nutriments: {"energy-kcal_100g": 35, "proteins_100g": 3.5, "carbohydrates_100g": 5, "fat_100g": 0.1}});
  FOOD_DB["Leite magro (Continente Equilíbrio)"] = {per: "100g", kcal: 35, p: 3.5, c: 5, f: 0.1};
  check.check("20. offKey ignora maiúsculas, acentos e pontuação", offProductKey("Leite Magro", "Continente Equilíbrio") === offProductKey("leite magro", "continente  equilibrio"));
  check.check("21. Um produto que a app já tem (sem EAN, outra capitalização) é reconhecido", offIsKnown(milk));
  var dupLocal = await offSaveProduct(milk);
  check.check("22. Escolhê-lo não cria uma linha nova: devolve o alimento existente", dupLocal.existing === true && dupLocal.name === "Leite magro (Continente Equilíbrio)" && !calls.some(function(c){ return c.indexOf("insert food_products ") === 0; }));
  delete FOOD_DB["Leite magro (Continente Equilíbrio)"];
  check.check("23. Sem esse alimento já não é conhecido", !offIsKnown(milk));
  sameName = [{id: "d1", name: "leite magro", brand: "Continente Equilibrio", verification_status: "rejected"}];
  var dupDb = await offSaveProduct(milk);
  check.check("24. Um nome+marca já na base de dados (mesmo rejeitado, acentos diferentes) não é duplicado", !!dupDb.blocked && !calls.some(function(c){ return c.indexOf("insert food_products ") === 0; }));
  sameName = [{id: "d2", name: "Leite Magro", brand: "Outra marca", verification_status: "verified"}];
  var other = await offSaveProduct(milk);
  check.check("25. A mesma designação com outra marca é outro produto e grava-se", other.name === "Leite Magro (Continente Equilíbrio)" && calls.some(function(c){ return c.indexOf("insert food_products ") === 0; }));
  sameName = null;

  // 4. pesquisa automática (só com poucos resultados locais)
  function fakeHost(){ var h = {children: [], _offSeq: 0, appendChild: function(c){ h.children.push(c); return c; }}; return h; }
  var realCreate = document.createElement;
  document.createElement = function(){ return {className: "", innerHTML: "", style: {}, classList: {add: function(){}, remove: function(){}}, remove: function(){}, appendChild: function(){}}; };
  var asked = 0;
  global.fetch = function(){ asked++; return Promise.resolve({ok: true, json: function(){ return Promise.resolve({products: [good]}); }}); };
  var picked = null;
  var hKnown = fakeHost(); offAutoSearch(hKnown, "iogurte grego", 1, function(){});
  await new Promise(function(r){ setTimeout(r, 800); });
  check.check("26. Produtos que a app já tem não voltam a ser oferecidos", /já estão no catálogo/.test(hKnown.children[0].innerHTML) && !/off-item/.test(hKnown.children[0].innerHTML));
  delete FOOD_DB["Iogurte grego natural (Marca X)"]; delete FOOD_DB["Leite Magro (Continente Equilíbrio)"]; state.catalogProducts = []; asked = 0;
  var h1 = fakeHost(); offAutoSearch(h1, "iogurte", OFF_MIN_LOCAL, function(){});
  var h2 = fakeHost(); offAutoSearch(h2, "io", 0, function(){});
  var h3 = fakeHost(); offAutoSearch(h3, "iogurte novo", 1, function(n){ picked = n; });
  await new Promise(function(r){ setTimeout(r, 800); });
  check.check("17. Com resultados locais suficientes, ou texto curto, não vai ao Open Food Facts", h1.children.length === 0 && h2.children.length === 0);
  var box = h3.children[0];
  check.check("18. Com poucos resultados mostra os produtos do Open Food Facts", asked === 1 && box && /off-item/.test(box.innerHTML) && /Iogurte grego natural/.test(box.innerHTML));
  existing = null; calls = [];
  box.onclick({target: {closest: function(){ return {getAttribute: function(a){ return a === "data-off" ? "0" : null; }, setAttribute: function(){}, removeAttribute: function(){}, style: {}}; }}});
  await new Promise(function(r){ setTimeout(r, 50); });
  check.check("19. Ao escolher grava e entrega o nome do alimento a quem pesquisou", picked === "Iogurte grego natural (Marca X)");
  document.createElement = realCreate;
  sb = realSb; sbReady = realReady; global.fetch = realFetch;
  check.summarize();
})();
