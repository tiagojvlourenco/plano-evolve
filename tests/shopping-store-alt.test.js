// Lista de compras: aviso quando o produto não se confirma na loja escolhida, alternativa à escolha (só na lista) e dias personalizados.
// O que não se vê aqui: o aspeto num telemóvel real.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var fs = require("fs"), path = require("path");
var _ls = {}; global.localStorage = {getItem: function(k){ return Object.prototype.hasOwnProperty.call(_ls, k) ? _ls[k] : null; }, setItem: function(k, v){ _ls[k] = String(v); }, removeItem: function(k){ delete _ls[k]; }, key: function(i){ return Object.keys(_ls)[i] || null; }, get length(){ return Object.keys(_ls).length; }};

// um produto de marca (não da loja) que não se confirma no Mercadona
var branded = Object.keys(FOOD_DB).filter(function(n){
  var st = storesOfFood(n); return st.kind === "any" && shopHasBrand(n) && !CATALOG_MERGED[n] && FOOD_DB[n].per === "100g" && FOOD_DB[n].kcal > 0 && !storeSuggestion("Mercadona", {name: n, grams: 100, ml: 0, units: 0, group: resolveGroup(groupOfFood(n))});
})[0];
check.check("0. Há produtos de marca sem confirmação no Mercadona para testar (" + branded + ")", !!branded);
var it = {name: branded, grams: 300, ml: 0, units: 0, free: false, group: resolveGroup(groupOfFood(branded))};
check.check("1. Um produto de marca que não se confirma na loja fica «unknown» (antes não dizia nada); um genérico sem marca continua «generic»", shopStoreInfo("Mercadona", it).status === "unknown" && shopStoreInfo("Mercadona", {name: "Arroz (cozido)", grams: 100, ml: 0, units: 0, group: "cereais"}).status !== "unknown");
check.check("1b. «(cozido)», «(peito)» e «(cru)» são pormenores do alimento e não marcas; «(Barilla)» e «(The Rustik Bakery)» são marcas", !shopHasBrand("Arroz (cozido)") && !shopHasBrand("Frango (peito)") && shopHasBrand("Penne Rigate (Barilla)") && shopHasBrand("Pão clássico (The Rustik Bakery)") && shopStoreInfo("Mercadona", {name: "Frango (peito)", grams: 100, ml: 0, units: 0, group: "carnes"}).status !== "unknown");
check.check("2. shopDaysOf aceita 1 a 30 e volta a 7 com valores inválidos", (function(){ var r = []; [2, 8, 30, 31, 0, "x", 3.4].forEach(function(v){ state.shopDays = v; r.push(shopDaysOf()); }); return r.join() === "2,8,30,7,7,7,3"; })());

function mk(){ var s = buildFullDemoStudent(); s.id = "sh1"; s.isDemo = false; s.meals[0].foods[0] = {name: branded, qty: "100 g", group: s.meals[0].foods[0].group, required: true}; return s; }
var s = mk();
var cands = shopAltCandidates("Mercadona", it);
check.check("3. Há alternativas parecidas (mesmo grupo), com a quantidade recalculada para as mesmas calorias, e o produto original não está entre elas", cands.length >= 1 && cands.every(function(c){ return c.name !== branded && /\d/.test(c.qty); }));
var before = JSON.stringify(shoppingListFor(s, 7, "Mercadona"));
shopAltSet(s, "Mercadona", (function(){ var m = {}; m[branded] = cands[0].name; return m; })());
var after = shoppingListFor(s, 7, "Mercadona"), flat = [].concat.apply([], after.map(function(g){ return g.items; }));
var swapped = flat.filter(function(i){ return i.replaces === branded; })[0];
check.check("4. Com a troca escolhida a lista mostra a alternativa no lugar do original (e diz «em vez de»); sem loja ou noutra loja nada muda", !!swapped && swapped.name === cands[0].name && JSON.stringify(shoppingListFor(s, 7, "Lidl")) !== JSON.stringify(after) && JSON.stringify(shoppingListFor(s, 7, "")) === JSON.stringify(shoppingListFor(mk(), 7, "")) && before !== JSON.stringify(after));
check.check("5. O texto para copiar leva a troca («em vez de») e o aviso de «não confirmado» nos outros", /em vez de/.test(shoppingListText(s, 7, "Mercadona")) && (function(){ shopAltSet(s, "Mercadona", {}); return /não confirmado no Mercadona/.test(shoppingListText(s, 7, "Mercadona")); })());
check.check("6. A troca é por aluno e por loja (outro aluno não a vê) e repor apaga-a", (function(){ var a = mk(), b = mk(); b.id = "sh2"; var m = {}; m[branded] = cands[0].name; shopAltSet(a, "Mercadona", m); var seen = Object.keys(shopAltGet(b, "Mercadona")).length === 0 && Object.keys(shopAltGet(a, "Lidl")).length === 0 && shopAltGet(a, "Mercadona")[branded] === cands[0].name; shopAltSet(a, "Mercadona", {}); return seen && Object.keys(shopAltGet(a, "Mercadona")).length === 0; })());

var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){ console.log("(ignorado o ecrã: Playwright/Chromium não disponíveis aqui)"); check.summarize(); }
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");
(async function(){
  authRole = "professional";
  var st = mk(); st.id = "ana"; st.name = "Ana"; st.active = true; st.photos = []; st.nutritionPhase = null;
  var row = JSON.parse(JSON.stringify(studentToRow(st)));
  var srv = await startStaticServer(path.join(__dirname, ".."));
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  var ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx.addInitScript(fakeSource({role: "student", userId: "user-ana", email: "ana@x.test", rows: [row]}));
  var pg = await ctx.newPage(); pg.setDefaultTimeout(6000); pg.on("pageerror", function(e){ errors.push(e.message); });
  await pg.goto(srv.url + "index.html");
  await pg.waitForSelector('.tabbar [data-tab="plano"]');
  await pg.click('.tabbar [data-tab="plano"]');
  await pg.click('[data-plano-sec="compras"]');
  await pg.waitForSelector("#shopStore");
  await pg.selectOption("#shopStore", "Mercadona");
  await pg.waitForSelector(".shop-warn");
  check.check("7. No Mercadona o produto de marca mostra o aviso «Não confirmado no Mercadona» com «Escolher alternativa»", /Não confirmado no Mercadona/.test(await pg.locator(".shop-warn").first().innerText()) && (await pg.locator(".shop-warn [data-shop-alt]").count()) >= 1);
  await pg.locator(".shop-warn [data-shop-alt]").first().click();
  await pg.waitForSelector("[data-alt-pick]");
  var firstAlt = (await pg.locator("[data-alt-pick] b").first().innerText()).trim();
  await pg.locator("[data-alt-pick]").first().click();
  await pg.waitForSelector("[data-shop-alt-undo]");
  var listTxt = await pg.locator("#alunoTabContent").innerText(); 
  check.check("8. Escolhida a alternativa, a lista mostra-a no lugar do original com «em vez de» e «Repor»", listTxt.toLowerCase().indexOf(firstAlt.toLowerCase()) >= 0 && /em vez de/i.test(listTxt));
  await pg.locator("[data-shop-alt-undo]").first().click();
  await pg.waitForSelector(".shop-warn");
  check.check("9. «Repor» volta ao produto original (e ao aviso)", (await pg.locator("[data-shop-alt-undo]").count()) === 0);
  // dias personalizados
  await pg.click("[data-shop-custom]");
  await pg.waitForSelector("#shopDaysCustom");
  await pg.click('[data-shop-step="1"]'); await pg.waitForSelector("#shopDaysCustom");
  await pg.click('[data-shop-step="1"]'); await pg.waitForSelector("#shopDaysCustom");
  check.check("10. «Personalizar» mostra − / número / + e o + sobe o número de dias (7 → 9) no título da lista", (await pg.locator("#shopDaysCustom").inputValue()) === "9" && /Para 9 dias/.test(await pg.locator("#alunoTabContent").innerText()));
  await pg.fill("#shopDaysCustom", "2"); await pg.locator("#shopDaysCustom").press("Enter"); await pg.locator("#shopDaysCustom").blur().catch(function(){});
  await pg.waitForFunction(function(){ return /Para 2 dias/.test(document.getElementById("alunoTabContent").innerText); });
  check.check("11. Escrever 2 no campo aplica 2 dias; os atalhos 3 / 5 / 7 continuam e saem do modo personalizado", (await pg.locator('[data-shop-days="5"]').count()) === 1);
  await pg.click('[data-shop-days="5"]');
  await pg.waitForFunction(function(){ return /Para 5 dias/.test(document.getElementById("alunoTabContent").innerText); });
  check.check("12. Depois de um atalho o seletor personalizado fecha", (await pg.locator("#shopDaysCustom").count()) === 0);
  await pg.click("[data-shop-custom]"); await pg.waitForSelector("#shopDaysCustom");
  await pg.fill("#shopDaysCustom", "99"); await pg.locator("#shopDaysCustom").dispatchEvent("change");
  await pg.waitForFunction(function(){ return /Para 30 dias/.test(document.getElementById("alunoTabContent").innerText); });
  check.check("13. Acima do máximo fica em 30 dias", true);
  if (errors.length) console.log("ERROS JS:", errors.join(" ## "));
  check.check("14. Sem erros de JavaScript", errors.length === 0);
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção " + (e && e.message)); process.exit(1); });
