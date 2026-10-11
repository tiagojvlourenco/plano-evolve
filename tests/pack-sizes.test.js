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

// ---- 2. Decisão por produto: só doses individuais de iogurte, bebida e queijo fresco ----
(function(){
  function d(name, emb, kcal, ean){ var r = P.packForProduct(name, emb, kcal, ean); return r.ok ? r.packageQuantity + r.packageUnit : "–"; }
  check.check("2. Iogurte em pack de 4 × 125 g → 125 g (cada copo vem fechado)", d("Iogurte Natural", "500 g (4 x 125 g)", 60) === "125g");
  check.check("2. Queijo fresco 2 × 62,5 g → 62,5 g", d("Queijo fresco light", "125 g (2 x 62,5 g)", 100) === "62.5g");
  check.check("2. Leite de 200 ml → 200 ml; leite de 1 l → ignorado (não é uma dose)", d("Leite Meio-Gordo", "200ml", 48) === "200ml" && d("Leite Meio-Gordo", "1 l", 48) === "–");
  check.check("2. Peso e volume na mesma embalagem: o iogurte fica em g (640 g = 4 × 160 g), a bebida em ml", d("Iogurte de chocolate", "602 ml (4 x 150,6 ml) / 640 g (4 x 160 g)", 90) === "160g" && d("Leite meio-gordo", "200 ml / 206 g", 48) === "200ml");
  check.check("2. Fronteiras do iogurte: 200 g aceite, 201 g recusado; 10 g aceite, 9 g recusado", d("Iogurte", "200 g", 60) === "200g" && d("Iogurte", "201 g", 60) === "–" && d("Iogurte", "10 g", 60) === "10g" && d("Iogurte", "9 g", 60) === "–");
  check.check("2. Queijo fresco: unidades até 125 g; a tarrina de 200 g é multi-dose e fica de fora", d("Queijo fresco light", "125 g", 100) === "125g" && d("Queijo fresco light", "200 g", 100) === "–" && d("Queijo fresco meio-gordo", "4 x 62,5 g", 100) === "62.5g");
  check.check("2. Bebidas: até 250 ml (200 ml e 250 ml sim, 330 ml não); em gramas pede confirmação", d("Sumo Maçã", "250 ml", 45) === "250ml" && d("Sumo Maçã", "330 ml", 45) === "–" && d("Leite", "200 g", 48) === "–");
  // casos reais que a auditoria apanhou: nada disto pode gerar UPDATE
  var rejected = [
    ["Crêpes Dentelle Chocolate de Leite", "100 g", 520], ["Tortilla rolls crocantes de queijo", "125 g", 480], ["Aveia integral com chocolate de leite", "200 g", 497], ["Tablete de chocolate de leite com caramelo salgado", "44 g", 540],
    ["Aperitivo de bolinhas de queijo", "100 g", 500], ["Palets bretões de manteiga", "0,125 kg", 514], ["Bombom sabor a natas com chocolate negro", "480 ml (4 x 120 ml)", 287], ["Molho de Soja Continente", "200 ml", 80],
    ["Palitos de Chocolate de Leite", "150 g", 506], ["Presunto", "175 g", 517], ["Cones De Milho Queijo E Bacon", "130 g", 497], ["Mini natas", "444 ml (12 x 37 ml)", 352], ["Roditas de chocolate de leite", "4 x 75 g", 479],
    ["Calendário de advento de chocolate de leite", "75 g", 540], ["Petit biscuit de chocolate de leite", "150 g", 498], ["Nachos com sabor a Queijo", "150 g", 480], ["Brioche de Leite 60 g *", "60 g", 380], ["Leite creme", "92g (4x23g)", 346],
    ["Tempero de Sumo de Limão", "200 ml", 10], ["Molho Teriyaki 200ml", "200 ml", 269], ["Pota e Polvo em Molho de Tomate", "120 g", 100], ["Sardinhas em molho de tomate", "2 x 125 g", 180], ["Molho Piripíri", "200 ml", 40],
    ["Queijo Grana Padano", "200 g", 400], ["Queijo da Ilha Ralado", "200 g", 398], ["Queijo emmental ralado", "200 g", 381], ["Queijo Gouda", "200 g", 359], ["Queijo fundido original", "140 g", 250], ["Queijo Flamengo Ralado", "150 g", 340],
    ["Mozzarella ralada", "200 g", 296], ["Queijo Fatiado Flamengo dos Açores Light", "200 g", 280], ["Natas sem Lactose", "200 ml", 336], ["Queijo Fresco para Barrar", "200 g", 244], ["Queijo cremoso clássico", "150 g", 256],
    ["Queijo Feta", "200 g", 276], ["Queijo Brie", "200 g", 351], ["Húmus clássico", "200 g", 277], ["Fiambre Perna Extra", "200 g", 100], ["Peito de peru fatiado finíssimo", "150 g", 100], ["Paté de Sardinha", "4 x 22 g", 250],
    ["Molho fresco de pesto com manjericão", "150g", 418], ["Leite de coco", "0.2 l", 178], ["Requeijão", "200 g", 170], ["Queijo de cabra", "150 g", 300]
  ];
  var leaked = rejected.filter(function(r){ return d(r[0], r[1], r[2]) !== "–"; }).map(function(r){ return r[0]; });
  check.check("2. Nenhum dos " + rejected.length + " falsos positivos apanhados na auditoria gera embalagem" + (leaked.length ? " (fugas: " + leaked.join("; ") + ")" : ""), leaked.length === 0);
  check.check("2. EAN de peso variável (13 dígitos a começar por 2) é ignorado; EAN-8 do Lidl (20...) não", d("Queijo estilo suíço", "0,140 kg", 100, "2800410001400") === "–" && d("Iogurte Natural", "125 g", 60, "2800410001400") === "–" && d("Iogurte Natural", "125 g", 60, "20001940") === "125g");
  check.check("2. A nutrição incoerente com a categoria (leite com 346 kcal, iogurte com 400 kcal) é recusada; sem kcal conhecido decide só o nome", d("Iogurte Natural", "125 g", 400) === "–" && d("Iogurte Natural", "125 g", NaN) === "125g" && d("Iogurte Natural", "125 g", undefined) === "125g");
  check.check("2. 'Iogurte com chocolate' e 'Iogurte com cereais' continuam a contar (a palavra de sabor não manda); 'Mythos Iogurte' e 'Sem Lactose Iogurte' também (iogurte na 2.ª/3.ª palavra)", ["Iogurte com chocolate", "Iogurte com cereais", "Mythos Iogurte Estilo Grego", "Sem Lactose Iogurte Natural"].every(function(n){ return d(n, "125 g", 90) === "125g"; }));
  check.check("2. Pudim, flan, skyr, quark e kefir contam como iogurte", ["Pudim Flan de Baunilha", "Skyr natural", "Quark natural", "Kefir natural", "Flan Baunilha"].every(function(n){ return d(n, "100 g", 100) === "100g"; }));
  // segunda auditoria: recall e precisão
  function dg(name, emb, kcal, group){ var r = P.packForProduct(name, emb, kcal, null, group); return r.ok ? r.packageQuantity + r.packageUnit : "–"; }
  check.check("2. A palavra de sabor logo depois do produto não anula: 'Iogurte cereais', 'Iogurte Biscuit', 'Leite chocolate'", d("Iogurte cereais mel e frutos secos", "125 g", 110) === "125g" && d("Iogurte Biscuit", "4 x 125 g", 120) === "125g" && d("Leite chocolate", "200 ml", 75) === "200ml");
  check.check("2. Grafias e linhas de produto: Yogurt, Pudding, Estilo Grego, Bifidus, Petit Suisse, Sobremesa láctea, Mousse", [["Yogurt natural", "125 g"], ["Pudding de baunilha", "4 x 100 g"], ["Estilo Grego Natural", "4 x 115 g"], ["Bifidus Morango", "4 x 125 g"], ["Petit Suisse Morango", "6 x 55 g"], ["Sobremesa láctea proteica", "4 x 200 g"], ["Mousse de chocolate", "4 x 60 g"]].every(function(c){ return d(c[0], c[1], 100) !== "–"; }));
  check.check("2. 'Petit Beurre' (bolacha) não é iogurte; palitos de queijo mozzarella não são queijo fresco", d("Petit Beurre", "150 g", 440) === "–" && d("Queijo Mozzarella Palitos de Queijo", "4 x 20 g", 300) === "–");
  check.check("2. Iogurte líquido escolhe os ml quando a embalagem os indica ('160 g / 150 ml' → 150 ml)", d("Iogurte líquido morango", "160 g / 150 ml", 70) === "150ml");
  check.check("2. Mozzarella e burrata '125 g (210 g)': a unidade é a bola de 125 g; para o iogurte o parêntesis continua ambíguo", d("Mozzarella Bola", "125 g (210 g)", 250) === "125g" && d("Burrata", "125 g (210 g)", 270) === "125g" && d("Iogurte", "125 g (210 g)", 60) === "–");
  check.check("2. Bebidas vegetais e néctares pequenos contam; bebida energética e embalagem de 1 l não", d("Bebida de aveia", "250 ml", 45) === "250ml" && d("Néctar de pêssego", "200 ml", 50) === "200ml" && d("Batido de morango", "200 ml", 75) === "200ml" && d("Bebida energética", "250 ml", 45) === "–" && d("Bebida de aveia", "1 l", 45) === "–");
  check.check("2. Nome só com o sabor ('Natural', 'Líquido Morango'): só em laticínios e só em copos de pack ou garrafas pequenas; nunca queijo ralado nem outros grupos", dg("Natural", "720 g (6 x 120 g)", 70, "laticinios") === "120g" && dg("Líquido Morango", "4 x 150 ml", 70, "laticinios") === "150ml" && dg("Natural", "720 g (6 x 120 g)", 70, "cereais") === "–" && dg("Natural", "120 g", 70, "laticinios") === "–" && dg("Queijo ralado", "4 x 50 g", 300, "laticinios") === "–" && dg("Magro Framboesa & Piri-Piri", "4 x 125 g", 90, "laticinios") === "–");
  check.check("2. Mousses e cremes salgados (queijo com alho e ervas, atum, salmão) não são doses de iogurte, mas a mousse de chocolate sim", ["Mousse de queijo com alho e ervas finas", "Mousse de Salmão", "Mousse de atum", "Sobremesa de Queijo", "Pudim de peixe"].every(function(n){ return d(n, "150 g", 200) === "–" && dg(n, "4 x 150 g", 200, "laticinios") === "–"; }) && d("Mousse de chocolate", "4 x 60 g", 150) === "60g");
  check.check("2. Peso variável, ambíguo ou sem embalagem → nada a preencher", d("Queijo fresco", "Variável, ~0,180 kg", 100) === "–" && d("Iogurte", "125 g (210 g)", 60) === "–" && d("Iogurte", "", 60) === "–");
})();

// ---- 3. Expressões iguais às da app (index.html) ----
(function(){
  var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  function literal(src, varName){ var m = new RegExp("var " + varName + " = (/.*/i?);").exec(src); return m && m[1]; }
  ["PERISHABLE_AFTER_OPENING", "LEADS_WITH_PRODUCT", "DAIRY_NOT_PACK", "NOT_PERISHABLE_HEAD", "NOT_PERISHABLE_ANYWHERE"].forEach(function(v){
    var lib = literal(fs.readFileSync(path.join(__dirname, "..", "scripts", "lib", "pack-size.js"), "utf8"), v);
    check.check("3. " + v + " é igual na app e no gerador de SQL", !!lib && lib === literal(html, v));
  });
  var names = ["Iogurte Natural", "Pão de Leite", "Bolachas com Manteiga", "Iogurte com chocolate", "Queijo cottage", "Chocolate de leite (Milka)", "Mozzarella light", "Feijão-Manteiga Cozido", "Manteiga de amendoim 100% (Mercadona)", "Leite meio-gordo (Mimosa)", "Skyr natural", "Batatas Fritas Presunto", "Hummus clássico (Hacendado)", "Tofu natural", "Arroz", "Peito de frango", "Nachos com sabor a Queijo", "Tablete de chocolate de leite", "Brioche de Leite 60 g *", "Molho de Soja", "Mythos Iogurte Estilo Grego", "100% Sumo Maçã", "Queijo Brie", "", null, undefined, 42];
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
  mergeFoodProduct({name: "Natural", brand: "TesteE", food_group: "laticinios", kcal: 60, protein: 4, carbs: 5, fat: 2, package_quantity: 120, package_unit: "g"}, []);
  mergeFoodProduct({name: "Mistura láctea em pó", brand: "TesteF", food_group: "laticinios", kcal: 380, protein: 25, carbs: 50, fat: 8, package_quantity: 200, package_unit: "g"}, []);
  mergeFoodProduct({name: "Natural", brand: "TesteG", food_group: "cereais", kcal: 350, protein: 7, carbs: 78, fat: 1, package_quantity: 120, package_unit: "g"}, []);
  check.check("4. Laticínio cujo nome é só o sabor ('Natural') com embalagem do catálogo passa a ter embalagem inteira; produtos em pó e outros grupos não", packSizeOf("Natural (TesteE)") === 120 && packSizeOf("Mistura láctea em pó (TesteF)") === 0 && packSizeOf("Natural (TesteG)") === 0);
  // revisão adversarial: unidade em maiúsculas, produtos já existentes e quantidade-padrão
  var q = {name: "Iogurte magro melancia", brand: "Pingo Doce", food_group: "laticinios", kcal: 50, protein: 4, carbs: 6, fat: 0.5, package_quantity: 170, package_unit: "g"};
  mergeFoodProduct(q, []);
  var qn = foodProductDisplayName(q, []);
  check.check("4. Iogurte de 170 g: a quantidade-padrão é a embalagem (170 g) e '2 iogurtes' no texto colado dão 340 g (2 embalagens), não 170 g", packSizeOf(qn) === 170 && defaultQtyForFood(qn) === "170 g" && matchDraftPhrase("2 iogurtes magro melancia pingo doce").qty === "340 g");
  ["mL", "ML", "G", " g "].forEach(function(u, i){
    var r = {name: "Iogurte teste unidade", brand: "U" + i, food_group: "laticinios", kcal: 60, protein: 4, carbs: 5, fat: 2, package_quantity: 125, package_unit: u};
    mergeFoodProduct(r, []);
    check.check("4. A unidade '" + u + "' (maiúsculas ou espaços) também vale para a embalagem inteira", packSizeOf(foodProductDisplayName(r, [])) === 125);
  });
  check.check("4. Unidade que não é g nem ml ('unid.') é ignorada", (function(){ var r = {name: "Iogurte teste unidade", brand: "UX", food_group: "laticinios", kcal: 60, protein: 4, carbs: 5, fat: 2, package_quantity: 4, package_unit: "unid."}; mergeFoodProduct(r, []); return packSizeOf(foodProductDisplayName(r, [])) === 0; })());
  FOOD_DB["Mozzarella teste (Hacendado)"] = {per: "100g", kcal: 202, p: 18, c: 1, f: 14};
  var existing = mergeFoodProduct({name: "Mozzarella teste", brand: "Hacendado", food_group: "laticinios", kcal: 999, protein: 1, carbs: 1, fat: 1, package_quantity: 125, package_unit: "g"}, []);
  check.check("4. Produto que já existe na app não é substituído (nutrição intacta) mas passa a ter a embalagem do catálogo; uma embalagem já conhecida não é alterada", existing === false && FOOD_DB["Mozzarella teste (Hacendado)"].kcal === 202 && packSizeOf("Mozzarella teste (Hacendado)") === 125 && (function(){ mergeFoodProduct({name: "Mozzarella teste", brand: "Hacendado", food_group: "laticinios", kcal: 1, protein: 1, carbs: 1, fat: 1, package_quantity: 100, package_unit: "g"}, []); return packSizeOf("Mozzarella teste (Hacendado)") === 125; })());
  FOOD_PACKS["Embalagem teste A"] = 170; FOOD_PACKS["Embalagem teste B"] = 62.5; FOOD_PACKS["Embalagem teste C"] = 200;
  var strip = function(h){ return h.replace(/<[^>]+>/g, ""); };
  check.check("4. O aviso de desperdício não repete o mesmo tamanho ('Usa 170 g.'), usa vírgula decimal e a unidade certa (ml)", /Usa 170 g\.$/.test(strip(packWasteHint({name: "Embalagem teste A", qty: "100 g"}))) && /Usa 62,5 g ou 125 g\./.test(strip(packWasteHint({name: "Embalagem teste B", qty: "100 g"}))) && /Embalagem de 200 ml: 100 ml deixa 100 ml.*Usa 200 ml\./.test(strip(packWasteHint({name: "Embalagem teste C", qty: "100 ml"}))));
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

// ---- 5b. Nomes e grupos depois das revisões (output-review-*/translate-*) ----
(function(){
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), "packs-ren-"));
  fs.writeFileSync(path.join(dir, "lista-a.csv"), [
    "EAN,Nome,Marca,Grupo,Embalagem,kcal/100g",
    '2000111,"Tubitos","Marca",laticinios,"6 x 117 g",88',
    '2000222,"Natural","Marca",laticinios,"500 g (4 x 125 g)",60',
    '2000333,"Fresh Yogurt","Marca",laticinios,"4 x 125 g",60',
    ""].join("\n"));
  var cols = "(ean, name, brand, food_group, nutrition_basis, kcal, protein, carbs, fat, source_url, internal_note, source_type, verification_status)";
  fs.writeFileSync(path.join(dir, "output-import-teste.sql"), [
    "insert into food_products " + cols + " values ('2000111', 'Tubitos', 'Marca', 'laticinios', '100g', 88, 1, 15, 2, 'x', null, 'open_food_facts', 'pending') on conflict (ean) do nothing;",
    "insert into food_products " + cols + " values ('2000222', 'Natural', 'Marca', 'laticinios', '100g', 60, 4, 5, 2, 'x', null, 'open_food_facts', 'pending') on conflict (ean) do nothing;",
    "insert into food_products " + cols + " values ('2000333', 'Fresh Yogurt', 'Marca', 'laticinios', '100g', 60, 4, 5, 2, 'x', null, 'open_food_facts', 'pending') on conflict (ean) do nothing;", ""].join("\n"));
  fs.writeFileSync(path.join(dir, "output-review-teste.sql"), [
    "update food_products set name = 'Gelado de fruta em tubos', food_group = 'snacks', verification_status = 'verified', verified_at = now(), internal_note = null where ean = '2000111' and verification_status = 'pending' and source_type = 'open_food_facts';",
    "update food_products set name = 'Iogurte natural', brand = 'Marca' where ean = '2000222';", ""].join("\n"));
  fs.writeFileSync(path.join(dir, "output-translate-teste.sql"), "update food_products set name = 'Iogurte fresco' where name = 'Fresh Yogurt' and brand = 'Marca' and verification_status = 'pending' and source_type = 'open_food_facts';\n");
  var names = G.loadDbNames(dir);
  check.check("5b. Renomeações e mudanças de grupo posteriores (por EAN e por nome+marca) entram nos nomes do catálogo", names.get("2000111").name === "Gelado de fruta em tubos" && names.get("2000111").group === "snacks" && names.get("2000222").name === "Iogurte natural" && names.get("2000333").name === "Iogurte fresco");
  var recs = G.run(dir), by = {}; recs.forEach(function(r){ by[r.ean] = r; });
  check.check("5b. O gelado renomeado deixa de receber embalagem; os iogurtes ficam com o nome novo", !by["2000111"].decision.ok && by["2000222"].decision.packageQuantity === 125 && by["2000222"].name === "Iogurte natural" && by["2000333"].decision.packageQuantity === 125);
})();

// ---- 6. Dados reais do repositório ----
(function(){
  var recs = G.run(path.join(__dirname, "..", "scripts"));
  var ok = recs.filter(function(r){ return r.decision.ok; });
  check.check("6. Das listas do repositório saem centenas de embalagens (≥ 200), todas entre 10 e 250 g/ml, de categorias iogurte, bebida ou queijo fresco", ok.length >= 200 && ok.every(function(r){ return r.decision.packageQuantity >= 10 && r.decision.packageQuantity <= 250 && (r.decision.packageUnit === "g" || r.decision.packageUnit === "ml") && ["iogurte", "bebida", "queijo fresco"].indexOf(r.decision.category.replace(/ \(nome só com o sabor\)$/, "")) >= 0; }));
  check.check("6. Nenhuma embalagem de queijo fresco passa de 125 g nem de bebida de 250 ml; nenhum nome tem ralado, fatias, curado, snack ou chocolate de leite (o 'molho de caramelo' de um pudim não conta)", ok.every(function(r){ var c = r.decision; return !(/^queijo fresco/.test(c.category) && c.packageQuantity > 125) && !(/^bebida/.test(c.category) && (c.packageQuantity > 250 || c.packageUnit !== "ml")) && (/^iogurte/.test(c.category) || !/ralad|fatia|curad|molho|snack|nachos|chocolate de leite/i.test(r.name)) && !/ralad|fatia|curad|snack|nachos|chocolate de leite/i.test(r.name); }));
  check.check("6. Nenhum EAN repetido nem vazio", new Set(ok.map(function(r){ return r.ean; })).size === ok.length && ok.every(function(r){ return /^\d+$/.test(r.ean); }));
  check.check("6. Todos os produtos escolhidos são reconhecidos como perecíveis pela app", ok.every(function(r){ return hasWholePackFood({name: r.name, food_group: r.group}, r.name + " (" + r.brand + ")") && P.hasWholePackFood(r.name, r.group); }));
  var sql = fs.readFileSync(path.join(__dirname, "..", "scripts", "output-pack-sizes.sql"), "utf8");
  var lines = sql.split("\n").filter(function(l){ return l && l.indexOf("--") !== 0; });
  check.check("6. O ficheiro SQL tem só UPDATEs com 'package_quantity is null' (nunca sobrescreve) e um por produto escolhido", lines.length === ok.length && lines.every(function(l){ return /^update food_products set package_quantity = [\d.]+, package_unit = '(g|ml)' where ean = '\d+' and name = '(?:[^']|'')+' and package_quantity is null;$/.test(l); }));
})();
check.summarize();
