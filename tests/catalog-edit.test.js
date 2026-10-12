// Editar um produto do Catálogo: guarda em food_products e atualiza a lista local sem recarregar tudo da base de dados.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

(async function(){
  var realSb = sb, realReady = sbReady;
  // 1. o formulário traz os campos pedidos e vem preenchido
  var html = tplCatalogProductForm({id: "p1", name: "Iogurte", brand: "Marca", ean: "123", food_group: "laticinios", kcal: 60, protein: 5, carbs: 4, fat: 2, verification_status: "pending", nutrition_basis: "100g"});
  check.check("1. O formulário tem nome, marca, EAN, grupo, kcal/proteína/hidratos/gordura e estado, preenchidos",
    ["fpName", "fpBrand", "fpEan", "fpGroup", "fpKcal", "fpProtein", "fpCarbs", "fpFat", "fpStatus", "fpSave"].every(function(id){ return html.indexOf("id=\"" + id + "\"") >= 0; }) &&
    html.indexOf("value=\"Iogurte\"") >= 0 && html.indexOf("value=\"123\"") >= 0 && /<option value="pending" selected>/.test(html));
  check.check("2. O nome tplEditFoodForm continua a ser o do editor de alimentos do plano (sem colisão)", /^function tplEditFoodForm\(midx, fidx, f\)/m.test(appSource));

  // 2. guardar: UPDATE em food_products, substitui retalhistas, atualiza o estado local
  var vals = {"#fpEan": "999", "#fpName": "Iogurte grego", "#fpBrand": "Marca", "#fpGroup": "laticinios", "#fpPackageQty": "", "#fpPackageUnit": "", "#fpBasis": "100g", "#fpKcal": "70", "#fpProtein": "6", "#fpCarbs": "4", "#fpFat": "3", "#fpSugars": "", "#fpFiber": "", "#fpSatFat": "", "#fpSalt": "", "#fpIngredients": "", "#fpAllergens": "", "#fpSourceUrl": "", "#fpInternalNote": "", "#fpSourceType": "label", "#fpStatus": "verified"};
  var err = {style: {}, textContent: ""}, btn = {disabled: false};
  var sheet = {querySelector: function(sel){ if (sel === "#fpError") return err; if (sel === "#fpSave") return btn; return {value: vals[sel]}; }, querySelectorAll: function(){ return [{value: "Lidl"}]; }};
  var calls = [];
  sb = {from: function(t){
    return {
      update: function(row){ calls.push("update " + t + " " + row.name + " " + row.verification_status); return {eq: function(c, v){ calls.push(c + "=" + v); return {select: function(){ return Promise.resolve({data: [Object.assign({id: "p1"}, row)]}); }}; }}; },
      delete: function(){ return {eq: function(){ calls.push("delete " + t); return Promise.resolve({}); }}; },
      insert: function(rows){ calls.push("insert " + t + " " + JSON.stringify(rows)); return {select: function(){ return Promise.resolve({data: rows}); }}; }
    };
  }};
  sbReady = true;
  state.catalogProducts = [{id: "p0", name: "Arroz", brand: "X", ean: null, _k: "arroz\nx\n"}, {id: "p1", name: "Iogurte", brand: "Marca", ean: "123", verification_status: "pending", _k: "old"}];
  state.catalogSelected = {p1: true};
  var done = null;
  await new Promise(function(resolve){ saveEditedFoodProduct(sheet, state.catalogProducts[1], function(s){ done = s; resolve(); }); });
  check.check("3. Faz UPDATE em food_products e troca os supermercados", calls[0] === "update food_products Iogurte grego verified" && calls[1] === "id=p1" && calls[2] === "delete food_product_retailers" && /insert food_product_retailers .*"Lidl"/.test(calls[3]));
  var p = state.catalogProducts.filter(function(x){ return x.id === "p1"; })[0];
  check.check("4. O estado local fica atualizado (nome, estado, supermercados) sem duplicar o produto", state.catalogProducts.length === 2 && p.name === "Iogurte grego" && p.verification_status === "verified" && p.food_product_retailers[0].retailer === "Lidl" && done && done.id === "p1");
  check.check("5. A chave de pesquisa é refeita e a lista continua ordenada", p._k === "iogurte grego\nmarca\n999" && state.catalogProducts[0].name === "Arroz");
  check.check("6. Um produto que deixa de estar pendente sai da seleção", !state.catalogSelected.p1);
  state.catalogFilters = {q: "999"};
  check.check("7. A pesquisa já encontra o produto pelo novo EAN", catalogFilteredProducts().length === 1);

  // 3. erro da base de dados: mostra a mensagem e deixa tentar de novo
  sb = {from: function(){ return {update: function(){ return {eq: function(){ return {select: function(){ return Promise.resolve({error: {message: "dup"}}); }}; }}; }}; }};
  state.catalogProducts[1].name = "Iogurte grego";
  var called = false;
  await new Promise(function(resolve){ saveEditedFoodProduct(sheet, state.catalogProducts[1], function(){ called = true; }); setTimeout(resolve, 20); });
  check.check("8. Com erro mostra aviso, não chama onSaved e volta a ativar o botão", !called && err.style.display === "block" && /Não foi possível guardar/.test(err.textContent) && btn.disabled === false);
  sb = realSb; sbReady = realReady;
  check.summarize();
})();
