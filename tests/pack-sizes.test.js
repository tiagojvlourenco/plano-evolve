// Tamanho da embalagem individual dos produtos perecíveis: leitura do texto "Embalagem", decisão e geração do SQL do catálogo.
require("./setup")();
var fs = require("fs");
var os = require("os");
var path = require("path");
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var P = require("../scripts/lib/pack-size.js");
var G = require("../scripts/generate-pack-sizes.js");

// ---- 1. Leitura do texto "Embalagem" ----
(function(){
  function sz(raw){ var r = P.parsePackaging(raw); return r.ok ? r.size + r.unit + (r.form === "multi" ? "×" + r.count : "") : "–"; }
  var cases = [
    ["150 g", "150g"], ["150g", "150g"], ["100 gram", "100g"], ["0,140 kg", "140g"], ["1 kg", "1000g"], ["163 ml", "163ml"], ["200ml", "200ml"], ["1 l", "1000ml"], ["1,5L", "1500ml"], ["1 litro", "1000ml"], ["25 cl", "250ml"],
    ["4 x 125 g", "125g×4"], ["4x125g", "125g×4"], ["1 x 125 g", "125g×1"], ["2 x 62,5 g", "62.5g×2"], ["115 g x 4", "115g×4"], ["8 x 1L", "1000ml×8"],
    ["500 g (4 x 125 g)", "125g×4"], ["600 g (6 x 100 g)", "100g×6"], ["300g (6x50g)", "50g×6"], ["1 kg (8 x 125 g)", "125g×8"], ["92g (4x23g)", "23g×4"],
    ["125 g (1 x 125 g) / 500 g (4 x 125 g)", "125g×1"], ["680 g (4 x 170 g) / 632 ml (4 x 158 ml)", "170g×4"], ["280 g / 267 ml", "280g"], ["170 g (159 ml)", "170g"], ["200 ml (220 g)", "200ml"],
    ["~150 g", "–"], ["Variável, ~1,000 kg", "–"], ["125 g (210 g)", "–"], ["550 g (550 g + 40 g)", "–"], ["250", "–"], ["", "–"], [null, "–"], ["sem informação", "–"]
  ];
  cases.forEach(function(c){ check.check("1. '" + c[0] + "' → " + c[1], sz(c[0]) === c[1]); });
  check.check("1. Duas alternativas multi-pack com tamanhos diferentes na mesma unidade → ambíguo", P.parsePackaging("4 x 125 g / 6 x 100 g").ok === false);
})();

// ---- 2. Decisão por produto (doses individuais de produtos que se estragam depois de abertos) ----
(function(){
  function d(name, emb){ var r = P.packForProduct(name, emb); return r.ok ? r.packageQuantity + r.packageUnit : "–"; }
  check.check("2. Iogurte em pack de 4 × 125 g → 125 g (cada copo vem fechado)", d("Iogurte Natural", "500 g (4 x 125 g)") === "125g");
  check.check("2. Queijo fresco 2 × 62,5 g → 62,5 g", d("Queijo fresco light", "125 g (2 x 62,5 g)") === "62.5g");
  check.check("2. Leite de 200 ml → 200 ml; leite de 1 l → ignorado (não é uma dose)", d("Leite Meio-Gordo", "200ml") === "200ml" && d("Leite Meio-Gordo", "1 l") === "–");
  check.check("2. Pote de 250 g e iogurte líquido de 680 g → ignorados (acima de 200 g/ml)", d("Queijo Quark", "250 g") === "–" && d("Iogurte Líquido", "680 g (4 x 170 g) / 632 ml (4 x 158 ml)") === "170g");
  check.check("2. Fronteiras: 200 g aceite, 201 g recusado; 10 g aceite, 9 g recusado", d("Iogurte", "200 g") === "200g" && d("Iogurte", "201 g") === "–" && d("Manteiga", "10 g") === "10g" && d("Manteiga", "9 g") === "–");
  check.check("2. Produtos que não se estragam depois de abertos ficam de fora: pão de leite, bolachas com manteiga, chocolate de leite, batatas fritas sabor presunto, feijão-manteiga, manteiga de amendoim", ["Pão de Leite", "Bolachas Biológicas de Espelta com Manteiga", "Chocolate de leite", "Batatas Fritas Presunto", "Feijão-Manteiga Cozido", "Manteiga de amendoim 100%"].every(function(n){ return d(n, "100 g") === "–"; }));
  check.check("2. Mas 'Iogurte com chocolate' e 'Iogurte com cereais' continuam a contar (a palavra não é a do produto)", d("Iogurte com chocolate", "125 g") === "125g" && d("Iogurte com cereais", "125 g") === "125g");
  check.check("2. Mozzarella, cottage, quark, tofu e tempeh passam a ser reconhecidos", ["Mozzarella light", "Cottage cheese", "Quark natural", "Tofu natural", "Tempeh de soja"].every(function(n){ return d(n, "100 g") === "100g"; }));
  check.check("2. Peso variável, ambíguo ou sem embalagem → nada a preencher", d("Queijo Brie", "Variável, ~0,180 kg") === "–" && d("Iogurte", "125 g (210 g)") === "–" && d("Iogurte", "") === "–");
})();

// ---- 3. Expressões iguais às da app (index.html) ----
(function(){
  var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  function literal(src, varName){ var m = new RegExp("var " + varName + " = (/.*/i?);").exec(src); return m && m[1]; }
  ["PERISHABLE_AFTER_OPENING", "NOT_PERISHABLE_HEAD", "NOT_PERISHABLE_ANYWHERE"].forEach(function(v){
    var lib = literal(fs.readFileSync(path.join(__dirname, "..", "scripts", "lib", "pack-size.js"), "utf8"), v);
    check.check("3. " + v + " é igual na app e no gerador de SQL", !!lib && lib === literal(html, v));
  });
  var names = ["Iogurte Natural", "Pão de Leite", "Bolachas com Manteiga", "Iogurte com chocolate", "Queijo cottage", "Chocolate de leite (Milka)", "Mozzarella light", "Feijão-Manteiga Cozido", "Manteiga de amendoim 100% (Mercadona)", "Leite meio-gordo (Mimosa)", "Skyr natural", "Batatas Fritas Presunto", "Hummus clássico (Hacendado)", "Tofu natural", "Arroz", "Peito de frango", "", null, undefined, 42];
  check.check("3. A app e o gerador decidem o mesmo para todos os nomes de teste (incluindo vazio, null e número)", names.every(function(n){ return isPerishableAfterOpening(n) === P.isPerishableAfterOpening(n); }));
})();

// ---- 4. A app usa o tamanho de embalagem que vem do catálogo ----
(function(){
  var rows = [
    {name: "Iogurte Natural", brand: "TesteA", food_group: "laticinios", kcal: 60, protein: 4, carbs: 5, fat: 2, package_quantity: 125, package_unit: "g"},
    {name: "Iogurte Líquido", brand: "TesteB", food_group: "laticinios", kcal: 60, protein: 4, carbs: 8, fat: 1, package_quantity: 170, package_unit: "ml"},
    {name: "Bolachas com Manteiga", brand: "TesteC", food_group: "snacks", kcal: 450, protein: 6, carbs: 70, fat: 15, package_quantity: 150, package_unit: "g"},
    {name: "Arroz", brand: "TesteD", food_group: "cereais", kcal: 350, protein: 7, carbs: 78, fat: 1, package_quantity: 125, package_unit: "g"}
  ];
  rows.forEach(function(r){ mergeFoodProduct(r, []); });
  check.check("4. Iogurte de 125 g e iogurte líquido de 170 ml do catálogo passam a ter embalagem conhecida", packSizeOf("Iogurte Natural (TesteA)") === 125 && packSizeOf("Iogurte Líquido (TesteB)") === 170);
  check.check("4. Bolachas com manteiga e arroz não ficam presos a embalagens inteiras (não se estragam depois de abertos)", packSizeOf("Bolachas com Manteiga (TesteC)") === 0 && packSizeOf("Arroz (TesteD)") === 0);
  check.check("4. O plano arredonda para embalagens inteiras: 100 g → 125 g; 250 g de iogurte líquido → 255 ml (1 e 2 embalagens de 170)", snapToWholePacks("Iogurte Natural (TesteA)", 100) === 125 && snapToWholePacks("Iogurte Líquido (TesteB)", 250) === 340 || snapToWholePacks("Iogurte Líquido (TesteB)", 250) === 170);
  check.check("4. O editor do catálogo explica que se indica o tamanho de UMA unidade de um pack", /Tamanho de uma embalagem individual/.test(appSource) && /UMA unidade/.test(appSource));
})();

// ---- 5. Gerador de SQL ----
(function(){
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), "packs-"));
  fs.writeFileSync(path.join(dir, "lista-a.csv"), [
    "EAN,Nome,Marca,Grupo,Embalagem,kcal/100g",
    '1000111,"Iogurte Natural","Marca",laticinios,"500 g (4 x 125 g)",60',
    '1000222,"Pão de Leite","Marca",cereais,"350g",300',
    '1000333,"Queijo Quark","Marca",laticinios,"250 g",90',
    '1000444,"Leite Magro","Marca",laticinios,"1 l",35',
    '1000555,"Skyr d\'Ouro","Marca",laticinios,"150g",60',
    '1000666,"Iogurte Grego","Marca",laticinios,"4 x 115 g",80',
    '1000777,"Queijo Brie","Marca",laticinios,"Variável, ~0,180 kg",300',
    '1000888,"Iogurte Sem Embalagem","Marca",laticinios,"",60',
    ""].join("\n"));
  fs.writeFileSync(path.join(dir, "lista-b.csv"), [
    "EAN,Nome (como vem),Marca,Grupo,Embalagem,kcal/100g",
    '1000666,"Greek Yogurt","Marca",laticinios,"115 g x 4",80',
    '1000999,"Yogur proteínas","Marca",laticinios,"4 x 125 g",50',
    '1000999,"Yogur proteínas","Marca",laticinios,"6 x 100 g",50',
    ""].join("\n"));
  fs.writeFileSync(path.join(dir, "output-import-teste.sql"), "insert into food_products (ean, name, brand, food_group, nutrition_basis, kcal, protein, carbs, fat, source_url, internal_note, source_type, verification_status) values ('1000999', 'Iogurte proteico natural', 'Marca', 'laticinios', '100g', 50, 8, 4, 0.1, 'x', null, 'open_food_facts', 'pending') on conflict (ean) do nothing;\n");
  var recs = G.run(dir), by = {}; recs.forEach(function(r){ by[r.ean] = r; });
  check.check("5. Lê todas as listas e junta pelo EAN (666 e 999 aparecem em duas)", recs.length === 9);
  check.check("5. EAN com plica à frente ('5601...) fica só com dígitos; lixo e EAN curto são ignorados", G.normalizeEan("'5601002123626") === "5601002123626" && G.normalizeEan(" 560 100 ") === "560100" && G.normalizeEan("abc") === "" && G.normalizeEan("123") === "" && G.normalizeEan(null) === "" && G.normalizeEan("12345678901234567") === "");
  check.check("5. Pack de 4 × 125 g → 125 g; 4 × 115 g → 115 g (mesmo EAN nas duas listas, formatos diferentes, mesmo resultado)", by["1000111"].decision.packageQuantity === 125 && by["1000666"].decision.packageQuantity === 115);
  check.check("5. Pão de leite, quark de 250 g, leite de 1 l, queijo de peso variável e linha sem embalagem não geram UPDATE", ["1000222", "1000333", "1000444", "1000777", "1000888"].every(function(e){ return !by[e].decision.ok; }));
  check.check("5. Usa o nome tal como está no catálogo quando existe (999: 'Iogurte proteico natural'); EAN com tamanhos diferentes entre listas → ignorado para decidir à mão", by["1000999"].name === "Iogurte proteico natural" && by["1000999"].decision.ok === false && /tamanhos diferentes/.test(by["1000999"].decision.reason));
  check.check("5. Nomes com apóstrofo não rebentam", by["1000555"].decision.packageQuantity === 150);
})();

// ---- 6. Dados reais do repositório ----
(function(){
  var recs = G.run(path.join(__dirname, "..", "scripts"));
  var ok = recs.filter(function(r){ return r.decision.ok; });
  check.check("6. Das listas do repositório saem centenas de embalagens (≥ 400), todas entre 10 e 200 g/ml", ok.length >= 400 && ok.every(function(r){ return r.decision.packageQuantity >= 10 && r.decision.packageQuantity <= 200 && (r.decision.packageUnit === "g" || r.decision.packageUnit === "ml"); }));
  check.check("6. Nenhum EAN repetido nem vazio", new Set(ok.map(function(r){ return r.ean; })).size === ok.length && ok.every(function(r){ return /^\d+$/.test(r.ean); }));
  check.check("6. Todos os produtos escolhidos são reconhecidos como perecíveis pela app", ok.every(function(r){ return isPerishableAfterOpening(r.name); }));
  var sql = fs.readFileSync(path.join(__dirname, "..", "scripts", "output-pack-sizes.sql"), "utf8");
  var lines = sql.split("\n").filter(function(l){ return l && l.indexOf("--") !== 0; });
  check.check("6. O ficheiro SQL tem só UPDATEs com 'package_quantity is null' (nunca sobrescreve) e um por produto escolhido", lines.length === ok.length && lines.every(function(l){ return /^update food_products set package_quantity = [\d.]+, package_unit = '(g|ml)' where ean = '\d+' and package_quantity is null;/.test(l); }));
})();
check.summarize();
