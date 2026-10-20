(function(){
"use strict";
/* Duas apps no mesmo código: index.html (Acompanhamento: alunos, catálogo, «Eu») e gestao.html (Gestão: estúdio, packs, contratos; só o profissional).
   A página diz qual é com <html data-app="gestao">; sem isso é o Acompanhamento. */
var APP_MODE = (typeof document !== "undefined" && document.documentElement && document.documentElement.getAttribute && document.documentElement.getAttribute("data-app") === "gestao") ? "gestao" : "acomp";
/* ---------- Rede de segurança contra HTML injetado ----------
   O aluno consegue escrever JSON na sua própria linha (fotos, históricos, estado das refeições...) e esse texto acaba em
   templates do ecrã do profissional. Cada sítio deve usar escapeHtml, mas como defesa em profundidade TODO o HTML que a app
   escreve (innerHTML/outerHTML) passa por aqui: sem <script>/<iframe>/..., sem atributos on*="..." e sem javascript: URLs.
   Nenhum template da app usa handlers inline (todos os eventos são ligados com addEventListener), por isso nada legítimo muda. */
var UNSAFE_TAGS = {SCRIPT:1, IFRAME:1, FRAME:1, FRAMESET:1, OBJECT:1, EMBED:1, LINK:1, META:1, BASE:1, APPLET:1, TEMPLATE:1, NOSCRIPT:1};
var URL_ATTRS = {href:1, src:1, action:1, formaction:1, "xlink:href":1, data:1, poster:1, background:1, srcset:1};
function sanitizeHtmlNodeTree(root){
  var all = root.querySelectorAll("*");
  for (var i = all.length - 1; i >= 0; i--){
    var el = all[i];
    if (UNSAFE_TAGS[el.tagName.toUpperCase()]){ el.remove(); continue; }
    var attrs = Array.prototype.slice.call(el.attributes || []);
    attrs.forEach(function(a){
      var name = a.name.toLowerCase(), val = String(a.value).replace(/[\u0000-  ]+/g, "").toLowerCase();
      if (name.indexOf("on") === 0 || name === "srcdoc" || name === "style" && /expression\(|javascript:/.test(val)){ el.removeAttribute(a.name); return; }
      if (URL_ATTRS[name] && /^(javascript|vbscript):/.test(val)) el.removeAttribute(a.name);
      else if (URL_ATTRS[name] && /^data:/.test(val) && !/^data:image\/(png|jpe?g|gif|webp|avif);/.test(val)) el.removeAttribute(a.name);
    });
  }
}
// Sem DOM utilizável (testes em Node): nunca devolve markup por sanitizar — tira as tags.
function sanitizeHtmlString(html){
  if (typeof html !== "string") html = html == null ? "" : String(html);
  if (html.indexOf("<") === -1) return html;
  return html.replace(/<[^>]*>/g, "");
}
var NATIVE_INNER_HTML = null;
// No browser: o HTML é lido para um <template> (inerte), limpo, e SÃO OS PRÓPRIOS NÓS LIMPOS que se inserem. Nunca se volta a serializar
// e a ler (a releitura em contexto diferente é o que permite "mutation XSS": o que o parser lê de uma forma na 1.ª vez lê de outra na 2.ª).
function parseSanitized(html){
  var t = document.createElement("template");
  NATIVE_INNER_HTML.set.call(t, html);
  sanitizeHtmlNodeTree(t.content);
  return t.content;
}
(function installHtmlGuard(){
  if (typeof Element === "undefined" || !Element.prototype) return;
  var d = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
  if (!d || !d.set || !d.get) return;
  NATIVE_INNER_HTML = d;
  Object.defineProperty(Element.prototype, "innerHTML", {configurable: true, enumerable: d.enumerable, get: d.get, set: function(v){
    var str = typeof v === "string" ? v : (v == null ? "" : String(v));
    if (str.indexOf("<") === -1){ d.set.call(this, str); return; }
    var frag = parseSanitized(str);
    this.replaceChildren(frag);
  }});
  var o = Object.getOwnPropertyDescriptor(Element.prototype, "outerHTML");
  if (o && o.set && o.get) Object.defineProperty(Element.prototype, "outerHTML", {configurable: true, enumerable: o.enumerable, get: o.get, set: function(v){
    var str = typeof v === "string" ? v : (v == null ? "" : String(v));
    if (str.indexOf("<") === -1){ o.set.call(this, str); return; }
    this.replaceWith(parseSanitized(str));
  }});
})();


/* ===================== DATA ===================== */

var FOOD_GROUPS = {
  cereais: [
    {name:"Pão de forma 100% integral (Mercadona)", qty:"100 g"},
    {name:"Pão de forma com sementes e pevides (Hacendado)", qty:"100 g"},
    {name:"Pão de forma branco (Hacendado)", qty:"100 g"},
    {name:"Penne Rigate (Barilla)", qty:"100 g"},
    {name:"Esparguete integral (Milaneza)", qty:"100 g"},
    {name:"Esparguete (Milaneza)", qty:"100 g"},
    {name:"Fusilli de trigo integral (Continente)", qty:"100 g"},
    {name:"Esparguete de trigo integral (Continente)", qty:"100 g"},
    {name:"Arroz integral longo (Hacendado)", qty:"100 g"},
    {name:"Arroz basmati (Hacendado)", qty:"100 g"},
    {name:"Arroz carolino (Continente)", qty:"100 g"},
    {name:"Arroz vaporizado (Continente)", qty:"100 g"},
    {name:"Arroz basmati (Pingo Doce)", qty:"100 g"},
    {name:"Arroz integral (Pingo Doce)", qty:"100 g"},
    {name:"Flocos de aveia extra suaves (Brüggen)", qty:"100 g"},
    {name:"Muesli crocante (Mercadona)", qty:"100 g"},
    {name:"Farinha fina de milho (Hacendado)", qty:"100 g"},
    {name:"Farinha de milho branco pré-cozida (Hacendado)", qty:"100 g"},
    {name:"Farinha branca de neve fina (Branca de Neve)", qty:"100 g"},
    {name:"Farinha de aveia integral (Seara)", qty:"100 g"},
    {name:"Farinha de trigo tipo 55 sem fermento (Pingo Doce)", qty:"100 g"},
    {name:"Arroz (cozido)", qty:"150 g"},
    {name:"Massa (cozida)", qty:"150 g"},
    {name:"Batata", qty:"220 g"},
    {name:"Batata-doce", qty:"180 g"},
    {name:"Pão integral", qty:"70 g"},
    {name:"Couscous (cozido)", qty:"150 g"},
    {name:"Aveia", qty:"50 g"},
    {name:"Açafrão", qty:"100 g"},
    {name:"Açafrão-da-índia seco", qty:"100 g"},
    {name:"Açorda", qty:"100 g"},
    {name:"Açorda à alentejana", qty:"100 g"},
    {name:"Açorda de ovo", qty:"100 g"},
    {name:"Alecrim seco", qty:"100 g"},
    {name:"Arroz agulha cru", qty:"100 g"},
    {name:"Arroz carolino branqueado cru", qty:"100 g"},
    {name:"Arroz cozido simples", qty:"100 g"},
    {name:"Arroz de cabidela", qty:"100 g"},
    {name:"Arroz de ervilhas", qty:"100 g"},
    {name:"Arroz de feijão", qty:"100 g"},
    {name:"Arroz de tomate malandrinho", qty:"100 g"},
    {name:"Arroz doce", qty:"100 g"},
    {name:"Arroz integral cru", qty:"100 g"},
    {name:"Base em pó para bebida de ananás", qty:"100 g"},
    {name:"Base em pó para bebida de laranja", qty:"100 g"},
    {name:"Batata assada com pele, sem sal (só a polpa)", qty:"100 g"},
    {name:"Batata assada no forno", qty:"100 g"},
    {name:"Batata cozida", qty:"100 g"},
    {name:"Batata crua", qty:"100 g"},
    {name:"Batata doce assada", qty:"100 g"},
    {name:"Batata doce crua", qty:"100 g"},
    {name:"Batata, fécula", qty:"100 g"},
    {name:"Bulgur", qty:"100 g"},
    {name:"Canela moída", qty:"100 g"},
    {name:"Cardamomo verde", qty:"100 g"},
    {name:"Cereal de pequeno almoço à base de farelo de trigo (tipo \"All-Bran\")", qty:"100 g"},
    {name:"Cereal de pequeno almoço de trigo integral tipo \"Weetabix\"", qty:"100 g"},
    {name:"Colorau", qty:"100 g"},
    {name:"Condimento de mostarda", qty:"100 g"},
    {name:"Cravinho", qty:"100 g"},
    {name:"Ervilhas secas cozidas", qty:"100 g"},
    {name:"Ervilhas secas cruas", qty:"100 g"},
    {name:"Ervilhas, grão, congeladas cozidas", qty:"100 g"},
    {name:"Ervilhas, grão, congeladas cruas", qty:"100 g"},
    {name:"Ervilhas, grão, frescas cozidas", qty:"100 g"},
    {name:"Ervilhas, grão, frescas cruas", qty:"100 g"},
    {name:"Esparguete cozido", qty:"100 g"},
    {name:"Esparguete cru", qty:"100 g"},
    {name:"Estragão seco", qty:"100 g"},
    {name:"Farelo de trigo", qty:"100 g"},
    {name:"Farinha de aveia", qty:"100 g"},
    {name:"Farinha de centeio", qty:"100 g"},
    {name:"Farinha de centeio tipo 70", qty:"100 g"},
    {name:"Farinha de centeio tipo 85", qty:"100 g"},
    {name:"Farinha de cevada", qty:"100 g"},
    {name:"Farinha de espelta", qty:"100 g"},
    {name:"Farinha de milho tipo 70", qty:"100 g"},
    {name:"Farinha de pau (mandioca)", qty:"100 g"},
    {name:"Farinha de trigo (valor médio tipo 150 e tipo 55)", qty:"100 g"},
    {name:"Farinha de trigo com fermento", qty:"100 g"},
    {name:"Farinha de trigo integral", qty:"100 g"},
    {name:"Farinha de trigo tipo 150", qty:"100 g"},
    {name:"Farinha de trigo tipo 55", qty:"100 g"},
    {name:"Farinha de trigo tipo 65", qty:"100 g"},
    {name:"Farinha láctea 5 frutos tipo \"Cerelac\" (com farinha de trigo)", qty:"100 g"},
    {name:"Farinha láctea maçãs tipo \"Cerelac\" (com farinha de trigo)", qty:"100 g"},
    {name:"Farinha láctea tipo \"Cerelac\" (com farinha de trigo)", qty:"100 g"},
    {name:"Favas frescas cruas", qty:"100 g"},
    {name:"Favas secas cruas", qty:"100 g"},
    {name:"Favas secas, demolhadas, cozidas", qty:"100 g"},
    {name:"Feijão branco, demolhado, cozido", qty:"100 g"},
    {name:"Feijão branco, seco, cru", qty:"100 g"},
    {name:"Feijão catarino, seco, cru", qty:"100 g"},
    {name:"Feijão catarino, seco, demolhado, cozido", qty:"100 g"},
    {name:"Feijão encarnado, seco, cru", qty:"100 g"},
    {name:"Feijão encarnado, seco, demolhado, cozido", qty:"100 g"},
    {name:"Feijão frade, seco, cru", qty:"100 g"},
    {name:"Feijão frade, seco, demolhado, cozido", qty:"100 g"},
    {name:"Feijão preto, seco, cru", qty:"100 g"},
    {name:"Feijão preto, seco, demolhado, cozido", qty:"100 g"},
    {name:"Fermento em pó", qty:"100 g"},
    {name:"Flocos de arroz", qty:"100 g"},
    {name:"Flocos de aveia", qty:"100 g"},
    {name:"Flocos de centeio", qty:"100 g"},
    {name:"Flocos de cereais e frutos secos tipo \"Muesli\"", qty:"100 g"},
    {name:"Flocos de cevada", qty:"100 g"},
    {name:"Flocos de trigo", qty:"100 g"},
    {name:"Flocos de trigo com figos tipo \"Nestum\"", qty:"100 g"},
    {name:"Flocos de trigo com mel tipo \"Nestum\"", qty:"100 g"},
    {name:"Flocos de trigo e arroz enriquecidos com vitaminas, cálcio e ferro", qty:"100 g"},
    {name:"Flocos de trigo integral tipo \"All-Bran Flakes\"", qty:"100 g"},
    {name:"Gelatina preparada com ananás em conserva", qty:"100 g"},
    {name:"Gengibre fresco", qty:"100 g"},
    {name:"Gérmen de trigo", qty:"100 g"},
    {name:"Grão-de-bico, demolhado, cozido", qty:"100 g"},
    {name:"Grão-de-bico, seco, cru", qty:"100 g"},
    {name:"Inhame cru", qty:"100 g"},
    {name:"Lentilhas vermelhas, secas, cruas", qty:"100 g"},
    {name:"Lentilhas, secas, cruas", qty:"100 g"},
    {name:"Lentilhas, secas, demolhadas, cozidas", qty:"100 g"},
    {name:"Malagueta vermelha, desidratada", qty:"100 g"},
    {name:"Mandioca crua", qty:"100 g"},
    {name:"Manjerona seca", qty:"100 g"},
    {name:"Massa de pimentão", qty:"100 g"},
    {name:"Massa folhada, congelada", qty:"100 g"},
    {name:"Massa miúda crua", qty:"100 g"},
    {name:"Massa para lasanha cozida", qty:"100 g"},
    {name:"Massa para lasanha crua", qty:"100 g"},
    {name:"Milho, amido (pó)", qty:"100 g"},
    {name:"Milho, grão seco cru", qty:"100 g"},
    {name:"Millet, cru, seco", qty:"100 g"},
    {name:"Miso, pasta de soja fermentada com arroz integral e cevada", qty:"100 g"},
    {name:"Molho de soja", qty:"100 g"},
    {name:"Molho para francesinha", qty:"100 g"},
    {name:"Orégão seco", qty:"100 g"},
    {name:"Pão de centeio", qty:"100 g"},
    {name:"Pão de centeio integral", qty:"100 g"},
    {name:"Pão de forma, de trigo com passas", qty:"100 g"},
    {name:"Pão de forma, de trigo enriquecido", qty:"100 g"},
    {name:"Pão de ló", qty:"100 g"},
    {name:"Pão de milho", qty:"100 g"},
    {name:"Pão de mistura de trigo e centeio", qty:"100 g"},
    {name:"Pão de trigo", qty:"100 g"},
    {name:"Pão de trigo com redução de sal", qty:"100 g"},
    {name:"Pão de trigo integral", qty:"100 g"},
    {name:"Pão de trigo integral com passas", qty:"100 g"},
    {name:"Pão de trigo integral com soja", qty:"100 g"},
    {name:"Pão pita", qty:"100 g"},
    {name:"Pão ralado", qty:"100 g"},
    {name:"Peixinhos da horta", qty:"100 g"},
    {name:"Pimenta branca", qty:"100 g"},
    {name:"Pimenta moída", qty:"100 g"},
    {name:"Pimenta preta", qty:"100 g"},
    {name:"Puré de batata", qty:"100 g"},
    {name:"Salada de fruta", qty:"100 g"},
    {name:"Sêmola de milho", qty:"100 g"},
    {name:"Sobremesa à base de soja", qty:"100 g"},
    {name:"Sopa à lavrador", qty:"100 g"},
    {name:"Sopa de abóbora", qty:"100 g"},
    {name:"Sopa de agrião", qty:"100 g"},
    {name:"Sopa de cebola", qty:"100 g"},
    {name:"Sopa de cenoura", qty:"100 g"},
    {name:"Sopa de couve-branca", qty:"100 g"},
    {name:"Sopa de couve-lombarda", qty:"100 g"},
    {name:"Sopa de ervilhas", qty:"100 g"},
    {name:"Sopa de espinafres", qty:"100 g"},
    {name:"Sopa de favas", qty:"100 g"},
    {name:"Sopa de feijão-branco com couve-portuguesa, sem adição de sal", qty:"100 g"},
    {name:"Sopa de feijão-verde", qty:"100 g"},
    {name:"Sopa de feijão-verde e cenoura", qty:"100 g"},
    {name:"Sopa de grão à moda da avó", qty:"100 g"},
    {name:"Sopa de grão com arroz e espinafres", qty:"100 g"},
    {name:"Sopa de grão com arroz, espinafres e coentros", qty:"100 g"},
    {name:"Sopa de nabiças (ou de grelos de nabo)", qty:"100 g"},
    {name:"Sopa de tomate", qty:"100 g"},
    {name:"Sopa de vegetais", qty:"100 g"},
    {name:"Sopa juliana", qty:"100 g"},
    {name:"Sopa, caldo verde", qty:"100 g"},
    {name:"Sopa, creme de cenoura", qty:"100 g"},
    {name:"Sopa, puré de feijão", qty:"100 g"},
    {name:"Sopa, puré de vegetais", qty:"100 g"},
    {name:"Tamarindo cru", qty:"100 g"},
    {name:"Tapioca", qty:"100 g"},
    {name:"Tomilho seco", qty:"100 g"},
    {name:"Tosta de trigo", qty:"100 g"},
    {name:"Tosta de trigo integral", qty:"100 g"},
    {name:"Tosta de trigo sem sal", qty:"100 g"},
    {name:"Tosta de trigo simples", qty:"100 g"},
    {name:"Trigo Sarraceno (grão) cru", qty:"100 g"},
    {name:"Vinagre", qty:"100 g"},
    {name:"Wasabi, raiz crua", qty:"100 g"}
  ],
  laticinios: [
    {name:"Iogurte skyr natural", qty:"150 g"},
    {name:"Iogurte proteico", qty:"125 g"},
    {name:"Iogurte grego natural ligeiro (Continente Equilíbrio)", qty:"100 g"},
    {name:"Iogurte grego natural (Oikos)", qty:"100 g"},
    {name:"Iogurte proteico de baunilha (YoPro Danone)", qty:"100 g"},
    {name:"Iogurte proteico de mirtilo (YoPro Danone)", qty:"120 g"},
    {name:"Queijo fresco longa duração light (Continente Equilíbrio)", qty:"63 g"},
    {name:"Queijo fresco light (Hacendado)", qty:"63 g"},
    {name:"Iogurte proteico com manga e maracujá 0% (Mercadona)", qty:"100 g"},
    {name:"Iogurte com frutos do bosque (Mercadona)", qty:"100 g"},
    {name:"Iogurte 0% com fruta (Mercadona)", qty:"100 g"},
    {name:"Ricotta (Mercadona)", qty:"100 g"},
    {name:"Mozzarella (Hacendado)", qty:"100 g"},
    {name:"Grana Padano (Hacendado)", qty:"100 g"},
    {name:"Queijo feta (Mercadona)", qty:"100 g"},
    {name:"Queijo creme suave (Mercadona)", qty:"100 g"},
    {name:"Leite meio-gordo (Mimosa)", qty:"100 ml"},
    {name:"Leite meio-gordo (Continente)", qty:"100 ml"},
    {name:"Leite magro (Continente Equilíbrio)", qty:"100 ml"},
    {name:"Leite meio-gordo UHT (Pingo Doce)", qty:"100 ml"},
    {name:"Leite gordo (Mimosa)", qty:"100 ml"},
    {name:"Leite meio-gordo sem lactose (Mimosa)", qty:"100 ml"},
    {name:"Bebida de aveia (Liquats Vegetals)", qty:"100 ml"},
    {name:"Bebida de soja (Mercadona)", qty:"100 ml"},
    {name:"Água de coco (Mercadona)", qty:"100 ml"},
    {name:"Iogurte grego natural", qty:"250 g"},
    {name:"Iogurte grego magro natural", qty:"100 g"},
    {name:"Iogurte sem lactose magro, aromatizado, com pedaços e/ou polpa de fruta, com edulcorantes", qty:"100 g"},
    {name:"Kefir de cabra, magro, natural, sólido", qty:"100 ml"},
    {name:"Leite magro sem lactose, enriquecido com proteína, aromatizado, UHT", qty:"100 ml"},
    {name:"Queijo de vaca curado, magro", qty:"100 g"},
    {name:"Queijo fresco magro", qty:"100 g"},
    {name:"Queijo Quark natural magro", qty:"100 g"},
    {name:"Alternativa vegetal ao iogurte à base de soja", qty:"100 g"},
    {name:"Bacalhau com natas", qty:"100 g"},
    {name:"Bebida vegetal à base de amêndoa (alternativa ao leite)", qty:"100 ml"},
    {name:"Bebida vegetal à base de arroz (alternativa ao leite)", qty:"100 ml"},
    {name:"Bebida vegetal à base de aveia (alternativa ao leite)", qty:"100 ml"},
    {name:"Iogurte gordo, aromatizado, açucarado", qty:"100 g"},
    {name:"Iogurte gordo, com polpa e/ou pedaços de fruta e cereais açucarado", qty:"100 g"},
    {name:"Iogurte gordo, com polpa e/ou pedaços de fruta, açucarado", qty:"100 g"},
    {name:"Iogurte grego com fruta açucarado", qty:"100 g"},
    {name:"Iogurte líquido magro, aromatizado, açucarado", qty:"100 ml"},
    {name:"Iogurte líquido meio gordo, aromatizado, açucarado", qty:"100 ml"},
    {name:"Iogurte líquido meio gordo, natural, açucarado", qty:"100 ml"},
    {name:"Iogurte magro, aromatizado, açucarado", qty:"100 g"},
    {name:"Iogurte magro, com cereais e edulcorantes", qty:"100 g"},
    {name:"Iogurte magro, natural", qty:"100 g"},
    {name:"Iogurte magro, natural, com edulcorantes", qty:"100 g"},
    {name:"Iogurte meio gordo, aromatizado, açucarado", qty:"100 g"},
    {name:"Iogurte meio gordo, com polpa e/ou pedaços de fruta, açucarado", qty:"100 g"},
    {name:"Iogurte meio gordo, natural", qty:"100 g"},
    {name:"Iogurte meio gordo, natural, açucarado", qty:"100 g"},
    {name:"Iogurte sem lactose enriquecido em proteína, magro, aromatizado, com pedaços e/ou polpa de fruta, açucarado", qty:"100 g"},
    {name:"Iogurte sem lactose líquido, magro, aromatizado, com polpa de fruta, açucarado", qty:"100 g"},
    {name:"Iogurte sem lactose líquido, magro, aromatizado, com polpa de fruta, com edulcorantes", qty:"100 g"},
    {name:"Iogurte sem lactose líquido, meio gordo, aromatizado, açucarado", qty:"100 g"},
    {name:"Iogurte sem lactose líquido, meio gordo, aromatizado, com polpa de fruta, açucarado", qty:"100 g"},
    {name:"Iogurte sem lactose líquido, meio gordo, natural, açucarado", qty:"100 g"},
    {name:"Iogurte sem lactose magro, natural", qty:"100 g"},
    {name:"Iogurte sem lactose meio gordo, aromatizado, açucarado", qty:"100 g"},
    {name:"Iogurte sem lactose meio gordo, aromatizado, com frutos secos e cereais, açucarado", qty:"100 g"},
    {name:"Iogurte sem lactose meio gordo, aromatizado, com pedaços e/ou polpa de fruta, açucarado", qty:"100 g"},
    {name:"Iogurte sem lactose meio gordo, natural", qty:"100 g"},
    {name:"Iogurte sem lactose meio gordo, natural, açucarado", qty:"100 g"},
    {name:"Kefir, magro, natural, sólido", qty:"100 ml"},
    {name:"Kefir, parcialmente desnatado, açucarado, aromatizado, liquido", qty:"100 ml"},
    {name:"Kefir, parcialmente desnatado, aromatizado, liquido", qty:"100 ml"},
    {name:"Kefir, parcialmente desnatado, natural, liquido", qty:"100 ml"},
    {name:"Leite condensado", qty:"100 ml"},
    {name:"Leite creme", qty:"100 ml"},
    {name:"Leite fermentado (Bifidus) sem lactose enriquecido com fibra, magro, aromatizado, com pedaços e/ou polpa de fruta, com sementes e/ou cereais, com frutos secos e/ou de casca rija, com edulcorantes", qty:"100 ml"},
    {name:"Leite fermentado (Bifidus) sem lactose líquido, meio gordo, aromatizado, com pedaços e/ou polpa de fruta, açucarado", qty:"100 ml"},
    {name:"Leite fermentado (Bifidus) sem lactose magro, natural, com edulcorantes", qty:"100 ml"},
    {name:"Leite fermentado (Bifidus) sem lactose, magro, aromatizado, com pedaços e/ou polpa de fruta e/ou hortícolas, açucarado, com edulcorantes", qty:"100 ml"},
    {name:"Leite magro de pastagem, UHT", qty:"100 ml"},
    {name:"Leite magro sem lactose, UHT", qty:"100 ml"},
    {name:"Leite magro, pó", qty:"100 ml"},
    {name:"Leite magro, UHT", qty:"100 ml"},
    {name:"Leite meio gordo de pastagem, UHT", qty:"100 ml"},
    {name:"Leite meio gordo sem lactose, UHT", qty:"100 ml"},
    {name:"Leite meio gordo, pó", qty:"100 ml"},
    {name:"Leite meio gordo, UHT", qty:"100 ml"},
    {name:"Pão de leite (trigo)", qty:"100 ml"},
    {name:"Queijada de queijo fresco", qty:"100 g"},
    {name:"Queijada de queijo magro", qty:"100 g"},
    {name:"Queijada de requeijão", qty:"100 g"},
    {name:"Queijo fresco açucarado com sabor a fruta", qty:"100 g"},
    {name:"Queijo Quark açucarado magro com sabor a fruta", qty:"100 g"},
    {name:"Sopa de agrião com leite", qty:"100 ml"},
    {name:"Alternativa vegetal ao iogurte à base de coco, sem açúcar", qty:"100 g"},
    {name:"Bacalhau com natas, com queijo ralado", qty:"100 g"},
    {name:"Bebida vegetal à base de soja (alternativa ao leite)", qty:"100 ml"},
    {name:"Bebida vegetal à base de soja natural, sem açúcar e sem sal (alternativa ao leite)", qty:"100 ml"},
    {name:"Creme de camarão com natas", qty:"100 g"},
    {name:"Kefir de cabra, natural, sólido", qty:"100 ml"},
    {name:"Kefir, natural, liquido", qty:"100 ml"},
    {name:"Kefir, natural, sólido", qty:"100 ml"},
    {name:"Leite de cabra cru", qty:"100 ml"},
    {name:"Leite de coco, enlatado", qty:"100 ml"},
    {name:"Leite de ovelha cru", qty:"100 ml"},
    {name:"Leite evaporado", qty:"100 ml"},
    {name:"Leite fermentado (Bifidus) gordo, natural", qty:"100 ml"},
    {name:"Leite fermentado (Bifidus) sem lactose, gordo, natural", qty:"100 ml"},
    {name:"Leite gordo especial, pasteurizado", qty:"100 ml"},
    {name:"Leite gordo sem lactose, enriquecido com vitaminas A, D, E e B9 (ácido fólico), UHT", qty:"100 ml"},
    {name:"Leite gordo, pasteurizado", qty:"100 ml"},
    {name:"Leite gordo, pó", qty:"100 ml"},
    {name:"Leite gordo, UHT", qty:"100 ml"},
    {name:"Leite humano", qty:"100 ml"},
    {name:"Leite humano, colostro", qty:"100 ml"},
    {name:"Leite humano, transição", qty:"100 ml"},
    {name:"Nata maturada pasteurizada 30% gordura", qty:"100 g"},
    {name:"Nata para bater pasteurizada 34% gordura", qty:"100 g"},
    {name:"Nata pasteurizada 33% gordura", qty:"100 g"},
    {name:"Nata pasteurizada 36% gordura", qty:"100 g"},
    {name:"Nata UHT 35% gordura", qty:"100 g"},
    {name:"Ovo mexido com leite e margarina", qty:"100 ml"},
    {name:"Queijo Amarelo da Beira Baixa", qty:"100 g"},
    {name:"Queijo Brie", qty:"100 g"},
    {name:"Queijo Camembert", qty:"100 g"},
    {name:"Queijo Cheddar", qty:"100 g"},
    {name:"Queijo creme para barrar", qty:"100 g"},
    {name:"Queijo creme para barrar, alto teor polinsaturados", qty:"100 g"},
    {name:"Queijo de Azeitão", qty:"100 g"},
    {name:"Queijo de cabra \"Pure chèvre\"", qty:"100 g"},
    {name:"Queijo de cabra atabafado, curado", qty:"100 g"},
    {name:"Queijo de cabra atabafado, fresco", qty:"100 g"},
    {name:"Queijo de cabra curado", qty:"100 g"},
    {name:"Queijo de Castelo Branco", qty:"100 g"},
    {name:"Queijo de Évora", qty:"100 g"},
    {name:"Queijo de mistura (vaca, cabra e ovelha)", qty:"100 g"},
    {name:"Queijo de Nisa", qty:"100 g"},
    {name:"Queijo de ovelha curado", qty:"100 g"},
    {name:"Queijo de ovelha, amanteigado", qty:"100 g"},
    {name:"Queijo de vaca curado", qty:"100 g"},
    {name:"Queijo de vaca curado, meio gordo", qty:"100 g"},
    {name:"Queijo de vaca, amanteigado", qty:"100 g"},
    {name:"Queijo Emmental", qty:"100 g"},
    {name:"Queijo flamengo", qty:"100 g"},
    {name:"Queijo flamengo light (-50% gordura)", qty:"100 g"},
    {name:"Queijo fresco de cabra", qty:"100 g"},
    {name:"Queijo fresco de ovelha", qty:"100 g"},
    {name:"Queijo fresco meio gordo", qty:"100 g"},
    {name:"Queijo fundido 40% gordura", qty:"100 g"},
    {name:"Queijo Gouda", qty:"100 g"},
    {name:"Queijo Gruyère", qty:"100 g"},
    {name:"Queijo Mascarpone", qty:"100 g"},
    {name:"Queijo Mestiço de Tolosa", qty:"100 g"},
    {name:"Queijo Mozzarella fresco", qty:"100 g"},
    {name:"Queijo Parmesão", qty:"100 g"},
    {name:"Queijo Quark natural meio gordo", qty:"100 g"},
    {name:"Queijo Raclette", qty:"100 g"},
    {name:"Queijo Roquefort", qty:"100 g"},
    {name:"Queijo São Jorge", qty:"100 g"},
    {name:"Queijo Serpa", qty:"100 g"},
    {name:"Queijo Serra da Estrela", qty:"100 g"},
    {name:"Queijo Serra da Estrela, velho", qty:"100 g"},
    {name:"Requeijão de cabra", qty:"100 g"},
    {name:"Requeijão de mistura (ovelha e cabra)", qty:"100 g"},
    {name:"Requeijão de mistura (vaca, ovelha e cabra)", qty:"100 g"},
    {name:"Requeijão de ovelha", qty:"100 g"},
    {name:"Requeijão de vaca", qty:"100 g"},
    {name:"Sopa de agrião com requeijão", qty:"100 g"}
  ],
  carnes: [
    {name:"Peito de peru fatiado (Continente)", qty:"100 g"},
    {name:"Salsichas tipo Frankfurt (Nobre)", qty:"100 g"},
    {name:"Peito de frango fatias finas (Campofrio)", qty:"100 g"},
    {name:"Bacon em tiras fumado (Dulano)", qty:"100 g"},
    {name:"Fiambre de frango (Monells)", qty:"100 g"},
    {name:"Salsichas de aves (Continente)", qty:"100 g"},
    {name:"Bacon fumado (Continente)", qty:"100 g"},
    {name:"Fiambre da pá (Pingo Doce)", qty:"100 g"},
    {name:"Asas de frango crocantes (PorSi)", qty:"100 g"},
    {name:"Peito de peru (Dia)", qty:"100 g"},
    {name:"Bife de frango (Pingo Doce)", qty:"100 g"},
    {name:"Sardinhas portuguesas em azeite (Ramirez)", qty:"100 g"},
    {name:"Atum posta ao natural (Pingo Doce)", qty:"100 g"},
    {name:"Atum posta em óleo de girassol (Pingo Doce)", qty:"100 g"},
    {name:"Sardinha enlatada em azeite (Continente)", qty:"100 g"},
    {name:"Varinhas de pescada (Ocean Sea)", qty:"100 g"},
    {name:"Fatias de presunto (Nobre)", qty:"100 g"},
    {name:"Ovos frescos classe M (Pingo Doce)", qty:"100 g"},
    {name:"Ovos frescos (Continente)", qty:"100 g"},
    {name:"Clara de ovo (Continente)", qty:"100 g"},
    {name:"Frango (peito)", qty:"150 g"},
    {name:"Peru (fatiado)", qty:"150 g"},
    {name:"Pescada", qty:"170 g"},
    {name:"Atum (natural)", qty:"140 g"},
    {name:"Ovos", qty:"3 unid."},
    {name:"Tofu", qty:"180 g"},
    {name:"Abrótea cozida", qty:"100 g"},
    {name:"Abrótea crua", qty:"100 g"},
    {name:"Alheira cozida", qty:"100 g"},
    {name:"Alheira crua", qty:"100 g"},
    {name:"Alheira grelhada", qty:"100 g"},
    {name:"Amêijoa aberta ao natural sem sal", qty:"100 g"},
    {name:"Amêijoa crua", qty:"100 g"},
    {name:"Amêijoas à Bulhão Pato", qty:"100 g"},
    {name:"Arroz de frango com feijão e chouriço", qty:"100 g"},
    {name:"Arroz de pato", qty:"100 g"},
    {name:"Atum conserva em óleo", qty:"100 g"},
    {name:"Atum fresco cru", qty:"100 g"},
    {name:"Atum fresco grelhado", qty:"100 g"},
    {name:"Atum fresco, bife estufado com azeite e vinho", qty:"100 ml"},
    {name:"Bacalhau assado no forno com azeite", qty:"100 g"},
    {name:"Bacalhau cozido", qty:"100 g"},
    {name:"Bacalhau fresco cozido", qty:"100 g"},
    {name:"Bacalhau fresco cru", qty:"100 g"},
    {name:"Bacalhau grelhado", qty:"100 g"},
    {name:"Bacalhau seco e salgado, demolhado cru", qty:"100 g"},
    {name:"Bacalhau, filetes fritos", qty:"100 g"},
    {name:"Bacalhau, ovas cruas", qty:"100 g"},
    {name:"Bacon", qty:"100 g"},
    {name:"Bacon, grelhado", qty:"100 g"},
    {name:"Berbigão aberto ao natural sem sal", qty:"100 g"},
    {name:"Berbigão cru", qty:"100 g"},
    {name:"Besugo cru", qty:"100 g"},
    {name:"Borrego, perna no forno", qty:"100 g"},
    {name:"Borrego, perna ou costeleta assada com azeite e margarina", qty:"100 g"},
    {name:"Borrego, perna ou costeleta assada com margarina", qty:"100 g"},
    {name:"Borrego, perna ou costeleta assada com margarina, sem molho", qty:"100 g"},
    {name:"Borrego, perna ou costeleta assada sem molho", qty:"100 g"},
    {name:"Borrego, perna ou costeleta cozida", qty:"100 g"},
    {name:"Borrego, perna ou costeleta crua", qty:"100 g"},
    {name:"Borrego, perna ou costeleta estufada sem molho", qty:"100 g"},
    {name:"Borrego, perna ou costeleta grelhada", qty:"100 g"},
    {name:"Búzio cru", qty:"100 g"},
    {name:"Cabrito, costeleta crua", qty:"100 g"},
    {name:"Cabrito, costeleta grelhada", qty:"100 g"},
    {name:"Cabrito, peito cru", qty:"100 g"},
    {name:"Cabrito, peito estufado com azeite e margarina", qty:"100 g"},
    {name:"Cabrito, peito estufado com azeite e óleo alimentar", qty:"100 g"},
    {name:"Cabrito, peito estufado com manteiga e óleo alimentar", qty:"100 g"},
    {name:"Cabrito, peito estufado com margarina e óleo alimentar", qty:"100 g"},
    {name:"Cabrito, peito estufado, sem molho", qty:"100 g"},
    {name:"Cabrito, peito grelhado", qty:"100 g"},
    {name:"Cabrito, perna assada com azeite e margarina", qty:"100 g"},
    {name:"Cabrito, perna assada com óleo alimentar e margarina", qty:"100 g"},
    {name:"Cabrito, perna assada, sem molho", qty:"100 g"},
    {name:"Cabrito, perna crua", qty:"100 g"},
    {name:"Cação cru", qty:"100 g"},
    {name:"Cação frito", qty:"100 g"},
    {name:"Cachucho cru", qty:"100 g"},
    {name:"Caldeirada de cabrito com azeite e banha", qty:"100 g"},
    {name:"Caldeirada de cabrito com azeite e margarina", qty:"100 g"},
    {name:"Caldeirada de safio com amêijoas", qty:"100 g"},
    {name:"Camarão cozido", qty:"100 g"},
    {name:"Camarão cozido sem sal", qty:"100 g"},
    {name:"Camarão cru", qty:"100 g"},
    {name:"Canja de frango com aipo", qty:"100 g"},
    {name:"Canja de frango com massa", qty:"100 g"},
    {name:"Cantarilho (Redfish) com batata, no forno", qty:"100 g"},
    {name:"Cantarilho (Redfish) cozido", qty:"100 g"},
    {name:"Cantarilho (Redfish) cru", qty:"100 g"},
    {name:"Cantarilho (Redfish) no forno", qty:"100 g"},
    {name:"Caracol riscado, cozido", qty:"100 g"},
    {name:"Caracol, cru", qty:"100 g"},
    {name:"Carapau cru", qty:"100 g"},
    {name:"Carapau frito", qty:"100 g"},
    {name:"Carapau grelhado", qty:"100 g"},
    {name:"Carneiro, costeleta crua", qty:"100 g"},
    {name:"Carneiro, pá assada com azeite e margarina", qty:"100 g"},
    {name:"Carneiro, pá assada com margarina", qty:"100 g"},
    {name:"Carneiro, pá assada, sem molho", qty:"100 g"},
    {name:"Carneiro, pá cozida", qty:"100 g"},
    {name:"Carneiro, pá crua", qty:"100 g"},
    {name:"Carneiro, pá estufada sem molho", qty:"100 g"},
    {name:"Carneiro, peito gordo, cozido", qty:"100 g"},
    {name:"Carneiro, peito gordo, cru", qty:"100 g"},
    {name:"Carneiro, perna gorda, assada, sem molho", qty:"100 g"},
    {name:"Carneiro, perna gorda, crua", qty:"100 g"},
    {name:"Carneiro, perna gorda, estufada sem molho", qty:"100 g"},
    {name:"Carneiro, perna magra assada com azeite e margarina", qty:"100 g"},
    {name:"Carneiro, perna magra assada com margarina", qty:"100 g"},
    {name:"Carneiro, perna magra, assada, sem molho", qty:"100 g"},
    {name:"Carneiro, perna magra, crua", qty:"100 g"},
    {name:"Carneiro, perna magra, estufada com azeite e margarina", qty:"100 g"},
    {name:"Carneiro, perna magra, estufada sem molho", qty:"100 g"},
    {name:"Carneiro, perna ou costeleta magra frita com margarina, sem molho", qty:"100 g"},
    {name:"Carneiro, rim cru", qty:"100 g"},
    {name:"Carneiro, rim frito com margarina", qty:"100 g"},
    {name:"Caseína", qty:"100 g"},
    {name:"Cavala cozida", qty:"100 g"},
    {name:"Cavala crua", qty:"100 g"},
    {name:"Cavala em filetes, conserva em azeite", qty:"100 g"},
    {name:"Cavala grelhada", qty:"100 g"},
    {name:"Cavala no forno", qty:"100 g"},
    {name:"Cavalo, bife de alcatra crua", qty:"100 g"},
    {name:"Cavalo, bife de alcatra frita com manteiga", qty:"100 g"},
    {name:"Cavalo, bife de alcatra frita com margarina", qty:"100 g"},
    {name:"Cavalo, bife de alcatra frita, sem molho", qty:"100 g"},
    {name:"Cavalo, lombo ou pá assado com azeite e manteiga", qty:"100 g"},
    {name:"Cavalo, lombo ou pá assado com margarina", qty:"100 g"},
    {name:"Cavalo, lombo ou pá assado sem molho", qty:"100 g"},
    {name:"Cavalo, lombo ou pá cru", qty:"100 g"},
    {name:"Cavalo, lombo ou pá frito com manteiga", qty:"100 g"},
    {name:"Cavalo, lombo ou pá frito com margarina", qty:"100 g"},
    {name:"Cherne cozido", qty:"100 g"},
    {name:"Cherne cru", qty:"100 g"},
    {name:"Cherne grelhado", qty:"100 g"},
    {name:"Chicharro cozido", qty:"100 g"},
    {name:"Chicharro cru", qty:"100 g"},
    {name:"Chicharro grelhado", qty:"100 g"},
    {name:"Choco cru", qty:"100 g"},
    {name:"Choco grelhado", qty:"100 g"},
    {name:"Chouriço de carne de porco, cru", qty:"100 g"},
    {name:"Chouriço de carne de porco, gordo, cru", qty:"100 g"},
    {name:"Chouriço de carne de porco, magro, cozido sem adição de sal", qty:"100 g"},
    {name:"Chouriço de carne de porco, magro, cru", qty:"100 g"},
    {name:"Chouriço de carne de porco, magro, grelhado", qty:"100 g"},
    {name:"Chouriço de sangue cozido", qty:"100 g"},
    {name:"Chouriço de sangue, cru", qty:"100 g"},
    {name:"Clara de ovo de galinha, crua", qty:"100 g"},
    {name:"Clara de ovo de galinha, pasteurizada", qty:"100 g"},
    {name:"Codorniz carne sem pele, crua", qty:"100 g"},
    {name:"Codorniz com pele, crua", qty:"100 g"},
    {name:"Codorniz com pele, estufada com azeite", qty:"100 g"},
    {name:"Codorniz com pele, grelhada", qty:"100 g"},
    {name:"Coelho cru", qty:"100 g"},
    {name:"Coelho estufado", qty:"100 g"},
    {name:"Coelho estufado com azeite", qty:"100 g"},
    {name:"Coelho estufado com margarina", qty:"100 g"},
    {name:"Corvina cozida", qty:"100 g"},
    {name:"Corvina crua", qty:"100 g"},
    {name:"Creme de camarão", qty:"100 g"},
    {name:"Cubo de carne de vaca para caldo", qty:"100 g"},
    {name:"Dourada cozida", qty:"100 g"},
    {name:"Dourada crua", qty:"100 g"},
    {name:"Dourada grelhada", qty:"100 g"},
    {name:"Enguia crua", qty:"100 g"},
    {name:"Enguia frita", qty:"100 g"},
    {name:"Espadarte cru", qty:"100 g"},
    {name:"Espadarte grelhado", qty:"100 g"},
    {name:"Espadarte, bife estufado com azeite e vinho", qty:"100 ml"},
    {name:"Faneca crua", qty:"100 g"},
    {name:"Farinheira cozida", qty:"100 g"},
    {name:"Farinheira crua", qty:"100 g"},
    {name:"Favas frescas cozidas", qty:"100 g"},
    {name:"Fermento fresco de padeiro", qty:"100 g"},
    {name:"Fermento seco de padeiro", qty:"100 g"},
    {name:"Fiambre de aves", qty:"100 g"},
    {name:"Fiambre de porco", qty:"100 g"},
    {name:"Fiambre, pá", qty:"100 g"},
    {name:"Fiambre, peito de frango", qty:"100 g"},
    {name:"Fiambre, peito de peru", qty:"100 g"},
    {name:"Fiambre, perna", qty:"100 g"},
    {name:"Frango (1/4) peito e asa com pele, cozidos", qty:"100 g"},
    {name:"Frango (1/4) peito e asa com pele, estufados sem molho", qty:"100 g"},
    {name:"Frango (1/4) peito e asa com pele, grelhados", qty:"100 g"},
    {name:"Frango (1/4) perna com costa e pele, assada sem molho", qty:"100 g"},
    {name:"Frango (1/4) perna com costa e pele, cozida", qty:"100 g"},
    {name:"Frango (1/4) perna com costa e pele, estufada sem molho", qty:"100 g"},
    {name:"Frango (1/4), peito e asa com pele, crus", qty:"100 g"},
    {name:"Frango (1/4), perna com costa e pele, crua", qty:"100 g"},
    {name:"Frango (1/4), perna com costa e pele, grelhada", qty:"100 g"},
    {name:"Frango inteiro com pele, assado sem molho", qty:"100 g"},
    {name:"Frango inteiro com pele, cozido", qty:"100 g"},
    {name:"Frango inteiro com pele, cru", qty:"100 g"},
    {name:"Frango inteiro com pele, estufado sem molho", qty:"100 g"},
    {name:"Frango inteiro com pele, grelhado", qty:"100 g"},
    {name:"Frango inteiro sem pele, cozido", qty:"100 g"},
    {name:"Frango inteiro sem pele, cru", qty:"100 g"},
    {name:"Frango inteiro sem pele, estufado com azeite e margarina", qty:"100 g"},
    {name:"Frango inteiro sem pele, estufado com margarina", qty:"100 g"},
    {name:"Frango inteiro sem pele, estufado sem molho", qty:"100 g"},
    {name:"Frango inteiro sem pele, grelhado", qty:"100 g"},
    {name:"Frango, peito com pele, cozido", qty:"100 g"},
    {name:"Frango, peito com pele, cru", qty:"100 g"},
    {name:"Frango, peito com pele, estufado sem molho", qty:"100 g"},
    {name:"Frango, peito sem pele estufado com azeite e margarina", qty:"100 g"},
    {name:"Frango, peito sem pele estufado com margarina", qty:"100 g"},
    {name:"Frango, peito sem pele, cozido", qty:"100 g"},
    {name:"Frango, peito sem pele, cru", qty:"100 g"},
    {name:"Frango, peito sem pele, estufado sem molho", qty:"100 g"},
    {name:"Frango, pele crua", qty:"100 g"},
    {name:"Frango, perna sem pele, cozida", qty:"100 g"},
    {name:"Frango, perna sem pele, crua", qty:"100 g"},
    {name:"Frango, perna sem pele, estufada com azeite e margarina", qty:"100 g"},
    {name:"Frango, perna sem pele, estufada com margarina", qty:"100 g"},
    {name:"Frango, perna sem pele, estufada sem molho", qty:"100 g"},
    {name:"Galinha de angola com pele, crua", qty:"100 g"},
    {name:"Galinha, coração cru", qty:"100 g"},
    {name:"Galinha, fígado cru", qty:"100 g"},
    {name:"Gamba crua", qty:"100 g"},
    {name:"Garoupa cozida", qty:"100 g"},
    {name:"Garoupa crua", qty:"100 g"},
    {name:"Garoupa grelhada", qty:"100 g"},
    {name:"Gelatina desidratada (pó ou folha)", qty:"100 g"},
    {name:"Gema de ovo de galinha, crua", qty:"100 g"},
    {name:"Gema de ovo de galinha, pasteurizada", qty:"100 g"},
    {name:"Goraz assado com cebola, tomate, azeite e óleo alimentar", qty:"100 g"},
    {name:"Goraz cozido", qty:"100 g"},
    {name:"Goraz cru", qty:"100 g"},
    {name:"Goraz grelhado", qty:"100 g"},
    {name:"Goraz no forno", qty:"100 g"},
    {name:"Grilo doméstico, pó", qty:"100 g"},
    {name:"Imperador assado com cebola, tomate, azeite e óleo alimentar", qty:"100 g"},
    {name:"Imperador cozido", qty:"100 g"},
    {name:"Imperador cru", qty:"100 g"},
    {name:"Imperador grelhado", qty:"100 g"},
    {name:"Javali cru", qty:"100 g"},
    {name:"Lagosta cozida", qty:"100 g"},
    {name:"Lagosta crua", qty:"100 g"},
    {name:"Lagostim cozido", qty:"100 g"},
    {name:"Lagostim cru", qty:"100 g"},
    {name:"Lampreia crua", qty:"100 g"},
    {name:"Lapas cruas", qty:"100 g"},
    {name:"Larvas de Tenebrio molitor, desidratadas", qty:"100 g"},
    {name:"Lebre crua", qty:"100 g"},
    {name:"Linguado cru", qty:"100 g"},
    {name:"Linguado frito", qty:"100 g"},
    {name:"Linguado grelhado", qty:"100 g"},
    {name:"Linguiça", qty:"100 g"},
    {name:"Lula crua", qty:"100 g"},
    {name:"Lula estufada com cebola, tomate e azeite", qty:"100 g"},
    {name:"Lula grelhada", qty:"100 g"},
    {name:"Manjericão seco", qty:"100 g"},
    {name:"Maruca cozida", qty:"100 g"},
    {name:"Maruca crua", qty:"100 g"},
    {name:"Mexilhão cozido sem sal", qty:"100 g"},
    {name:"Mexilhão cru", qty:"100 g"},
    {name:"Morcela crua", qty:"100 g"},
    {name:"Mortadela", qty:"100 g"},
    {name:"Ostra, crua", qty:"100 g"},
    {name:"Ovo de codorniz, cru", qty:"100 g"},
    {name:"Ovo de galinha inteiro, cru", qty:"100 g"},
    {name:"Ovo de galinha líquido, pasteurizado", qty:"100 g"},
    {name:"Ovo de galinha, cozido", qty:"100 g"},
    {name:"Ovo de galinha, escalfado", qty:"100 g"},
    {name:"Ovo de galinha, estrelado", qty:"100 g"},
    {name:"Ovo de galinha, estrelado com azeite", qty:"100 g"},
    {name:"Ovo de galinha, estrelado com manteiga", qty:"100 g"},
    {name:"Ovo de galinha, estrelado com margarina", qty:"100 g"},
    {name:"Paio de lombo", qty:"100 g"},
    {name:"Paio de lombo entremeado", qty:"100 g"},
    {name:"Pargo legítimo assado com cebola, tomate e azeite", qty:"100 g"},
    {name:"Pargo legítimo cozido", qty:"100 g"},
    {name:"Pargo legítimo cru", qty:"100 g"},
    {name:"Pargo mulato cozido", qty:"100 g"},
    {name:"Pargo mulato cru", qty:"100 g"},
    {name:"Pasta de aves (paté), caseira", qty:"100 g"},
    {name:"Pasta de fígado de porco (paté)", qty:"100 g"},
    {name:"Pato com pele, assado sem molho", qty:"100 g"},
    {name:"Pato com pele, cru", qty:"100 g"},
    {name:"Pato sem pele, assado com margarina", qty:"100 g"},
    {name:"Pato sem pele, cru", qty:"100 g"},
    {name:"Peixe-espada-branco cru", qty:"100 g"},
    {name:"Peixe-espada-branco frito", qty:"100 g"},
    {name:"Peixe-espada-branco grelhado", qty:"100 g"},
    {name:"Peixe-espada-preto cru", qty:"100 g"},
    {name:"Peixe-espada-preto frito", qty:"100 g"},
    {name:"Peixe-espada-preto grelhado", qty:"100 g"},
    {name:"Percebes crus", qty:"100 g"},
    {name:"Perdiz crua", qty:"100 g"},
    {name:"Peru inteiro com pele, cru", qty:"100 g"},
    {name:"Peru, hambúrguer frito", qty:"100 g"},
    {name:"Peru, peito com pele, cru", qty:"100 g"},
    {name:"Peru, peito sem pele estufado com margarina", qty:"100 g"},
    {name:"Peru, peito sem pele panado", qty:"100 g"},
    {name:"Peru, peito sem pele, assado com margarina", qty:"100 g"},
    {name:"Peru, peito sem pele, cru", qty:"100 g"},
    {name:"Peru, perna com pele, assada com margarina", qty:"100 g"},
    {name:"Peru, perna com pele, crua", qty:"100 g"},
    {name:"Pescada cozida (valor médio)", qty:"100 g"},
    {name:"Pescada crua (valor médio)", qty:"100 g"},
    {name:"Pescada da África do Sul cozida", qty:"100 g"},
    {name:"Pescada da África do Sul crua", qty:"100 g"},
    {name:"Pescada da África do Sul frita", qty:"100 g"},
    {name:"Pescada do Chile cozida", qty:"100 g"},
    {name:"Pescada do Chile crua", qty:"100 g"},
    {name:"Pescada do Chile frita", qty:"100 g"},
    {name:"Pescada europeia cozida", qty:"100 g"},
    {name:"Pescada europeia crua", qty:"100 g"},
    {name:"Pescada europeia frita", qty:"100 g"},
    {name:"Pescada frita (valor médio)", qty:"100 g"},
    {name:"Pescada, ovas cruas", qty:"100 g"},
    {name:"Polvo cozido sem sal", qty:"100 g"},
    {name:"Polvo cru", qty:"100 g"},
    {name:"Pombo cru", qty:"100 g"},
    {name:"Porco, baço", qty:"100 g"},
    {name:"Porco, bife grelhado", qty:"100 g"},
    {name:"Porco, cabeça", qty:"100 g"},
    {name:"Porco, chispe", qty:"100 g"},
    {name:"Porco, coração cru", qty:"100 g"},
    {name:"Porco, costeleta gorda crua", qty:"100 g"},
    {name:"Porco, costeleta gorda grelhada", qty:"100 g"},
    {name:"Porco, costeleta grelhada", qty:"100 g"},
    {name:"Porco, costeleta meio gorda crua", qty:"100 g"},
    {name:"Porco, costeleta meio gorda estufada, sem molho", qty:"100 g"},
    {name:"Porco, costeleta meio gorda grelhada", qty:"100 g"},
    {name:"Porco, entrecosto cozido", qty:"100 g"},
    {name:"Porco, entrecosto cru", qty:"100 g"},
    {name:"Porco, entrecosto estufado sem molho", qty:"100 g"},
    {name:"Porco, entrecosto grelhado", qty:"100 g"},
    {name:"Porco, espetada grelhada", qty:"100 g"},
    {name:"Porco, fígado cru", qty:"100 g"},
    {name:"Porco, fígado frito com margarina e banha", qty:"100 g"},
    {name:"Porco, fígado frito sem molho", qty:"100 g"},
    {name:"Porco, fígado grelhado", qty:"100 g"},
    {name:"Porco, jarrete", qty:"100 g"},
    {name:"Porco, língua crua", qty:"100 g"},
    {name:"Porco, lombo assado", qty:"100 g"},
    {name:"Porco, lombo assado com azeite e margarina", qty:"100 g"},
    {name:"Porco, lombo assado com margarina", qty:"100 g"},
    {name:"Porco, lombo assado com óleo alimentar e margarina", qty:"100 g"},
    {name:"Porco, lombo assado, sem molho", qty:"100 g"},
    {name:"Porco, lombo cru", qty:"100 g"},
    {name:"Porco, lombo frito", qty:"100 g"},
    {name:"Porco, lombo frito com manteiga", qty:"100 g"},
    {name:"Porco, lombo frito com margarina", qty:"100 g"},
    {name:"Porco, lombo grelhado", qty:"100 g"},
    {name:"Porco, orelha crua", qty:"100 g"},
    {name:"Porco, pé cru", qty:"100 g"},
    {name:"Porco, perna gorda assada com azeite e margarina", qty:"100 g"},
    {name:"Porco, perna gorda assada com margarina", qty:"100 g"},
    {name:"Porco, perna gorda assada com óleo alimentar e margarina", qty:"100 g"},
    {name:"Porco, perna gorda assada, sem molho", qty:"100 g"},
    {name:"Porco, perna gorda crua", qty:"100 g"},
    {name:"Porco, perna gorda grelhada", qty:"100 g"},
    {name:"Porco, perna magra assada com azeite e margarina", qty:"100 g"},
    {name:"Porco, perna magra assada com margarina", qty:"100 g"},
    {name:"Porco, perna magra assada com óleo alimentar e margarina", qty:"100 g"},
    {name:"Porco, perna magra assada, sem molho", qty:"100 g"},
    {name:"Porco, perna magra crua", qty:"100 g"},
    {name:"Porco, perna magra estufada, sem molho", qty:"100 g"},
    {name:"Porco, perna magra grelhada", qty:"100 g"},
    {name:"Porco, pulmões crus", qty:"100 g"},
    {name:"Porco, rim cru", qty:"100 g"},
    {name:"Porco, rim frito com margarina", qty:"100 g"},
    {name:"Porco, sangue cru", qty:"100 g"},
    {name:"Porco, toucinho entremeado fresco, cru", qty:"100 g"},
    {name:"Porco, toucinho entremeado fresco, grelhado sem adição de sal", qty:"100 g"},
    {name:"Porco, toucinho entremeado ligeiramente salgado, cozido sem adição de sal", qty:"100 g"},
    {name:"Porco, toucinho entremeado ligeiramente salgado, cru", qty:"100 g"},
    {name:"Porco, toucinho entremeado magro", qty:"100 g"},
    {name:"Pota crua", qty:"100 g"},
    {name:"Presunto", qty:"100 g"},
    {name:"Proteína texturizada de soja", qty:"100 g"},
    {name:"Raia crua", qty:"100 g"},
    {name:"Robalo cozido", qty:"100 g"},
    {name:"Robalo cru", qty:"100 g"},
    {name:"Robalo grelhado", qty:"100 g"},
    {name:"Safio cru", qty:"100 g"},
    {name:"Salame", qty:"100 g"},
    {name:"Salmão cozido", qty:"100 g"},
    {name:"Salmão cru", qty:"100 g"},
    {name:"Salmão grelhado", qty:"100 g"},
    {name:"Salmonete cru", qty:"100 g"},
    {name:"Salpicão", qty:"100 g"},
    {name:"Salsa seca", qty:"100 g"},
    {name:"Salsicha fresca crua", qty:"100 g"},
    {name:"Salsicha tipo Frankfurt", qty:"100 g"},
    {name:"Sapateira crua", qty:"100 g"},
    {name:"Sarda cozida", qty:"100 g"},
    {name:"Sarda crua", qty:"100 g"},
    {name:"Sarda grelhada", qty:"100 g"},
    {name:"Sardinha frita", qty:"100 g"},
    {name:"Sardinha gorda crua", qty:"100 g"},
    {name:"Sardinha gorda frita", qty:"100 g"},
    {name:"Sardinha gorda grelhada", qty:"100 g"},
    {name:"Sardinha meio gorda conserva em água, sem espinha e sem pele", qty:"100 ml"},
    {name:"Sardinha meio gorda conserva em azeite", qty:"100 g"},
    {name:"Sardinha meio gorda conserva em azeite (escorrido)", qty:"100 g"},
    {name:"Sardinha meio gorda crua", qty:"100 g"},
    {name:"Sardinha meio gorda frita", qty:"100 g"},
    {name:"Sardinha meio gorda grelhada", qty:"100 g"},
    {name:"Seitan", qty:"100 g"},
    {name:"Soja, farinha com baixo teor de gordura", qty:"100 g"},
    {name:"Solha crua", qty:"100 g"},
    {name:"Solha frita", qty:"100 g"},
    {name:"Solha grelhada", qty:"100 g"},
    {name:"Tamboril cru", qty:"100 g"},
    {name:"Tamboril grelhado", qty:"100 g"},
    {name:"Tremoço cozido, sem sal", qty:"100 g"},
    {name:"Tremoço, cozido e salgado", qty:"100 g"},
    {name:"Tripa de porco fresca", qty:"100 g"},
    {name:"Tripa de vaca crua", qty:"100 g"},
    {name:"Truta arco-íris crua", qty:"100 g"},
    {name:"Truta arco-íris grelhada", qty:"100 g"},
    {name:"Vaca assada com azeite e margarina", qty:"100 g"},
    {name:"Vaca assada com azeite, margarina e óleo alimentar", qty:"100 g"},
    {name:"Vaca assada com margarina", qty:"100 g"},
    {name:"Vaca assada com óleo alimentar e margarina", qty:"100 g"},
    {name:"Vaca assada, sem molho", qty:"100 g"},
    {name:"Vaca magra cozida", qty:"100 g"},
    {name:"Vaca magra estufada, sem molho", qty:"100 g"},
    {name:"Vaca meio gorda estufada, sem molho", qty:"100 g"},
    {name:"Vaca para assar crua", qty:"100 g"},
    {name:"Vaca para cozer ou estufar magra crua", qty:"100 g"},
    {name:"Vaca para cozer ou estufar meio gorda crua", qty:"100 g"},
    {name:"Vaca, bife cru (valor médio de acém, alcatra e lombo)", qty:"100 g"},
    {name:"Vaca, bife frito com manteiga (valor médio de acém, alcatra e lombo)", qty:"100 g"},
    {name:"Vaca, bife frito, sem molho (valor médio de acém, alcatra e lombo)", qty:"100 g"},
    {name:"Vaca, bife grelhado (valor médio de acém, alcatra e lombo)", qty:"100 g"},
    {name:"Vaca, cachaço cru", qty:"100 g"},
    {name:"Vaca, coração cozido", qty:"100 g"},
    {name:"Vaca, coração cru", qty:"100 g"},
    {name:"Vaca, coração estufado com banha e margarina", qty:"100 g"},
    {name:"Vaca, espetada grelhada", qty:"100 g"},
    {name:"Vaca, fígado cru", qty:"100 g"},
    {name:"Vaca, fígado frito sem molho", qty:"100 g"},
    {name:"Vaca, hambúrguer cru", qty:"100 g"},
    {name:"Vaca, hambúrguer grelhado", qty:"100 g"},
    {name:"Vaca, língua crua", qty:"100 g"},
    {name:"Vaca, lombo magro assado com azeite e margarina", qty:"100 g"},
    {name:"Vaca, lombo magro assado com azeite, manteiga e óleo alimentar", qty:"100 g"},
    {name:"Vaca, lombo magro assado com margarina", qty:"100 g"},
    {name:"Vaca, lombo magro assado com óleo alimentar e margarina", qty:"100 g"},
    {name:"Vaca, lombo magro assado, sem molho", qty:"100 g"},
    {name:"Vaca, lombo magro cru", qty:"100 g"},
    {name:"Vaca, lombo magro no forno, com tomate, cebola, cenoura e alho", qty:"100 g"},
    {name:"Vaca, picanha grelhada", qty:"100 g"},
    {name:"Vaca, rim cru", qty:"100 g"},
    {name:"Veado cru", qty:"100 g"},
    {name:"Vieira, crua", qty:"100 g"},
    {name:"Vitela, bife cru", qty:"100 g"},
    {name:"Vitela, bife frito", qty:"100 g"},
    {name:"Vitela, chambão cru", qty:"100 g"},
    {name:"Vitela, coração cru", qty:"100 g"},
    {name:"Vitela, costeleta crua", qty:"100 g"},
    {name:"Vitela, costeleta frita com margarina", qty:"100 g"},
    {name:"Vitela, costeleta frita panada", qty:"100 g"},
    {name:"Vitela, costeleta frita sem molho", qty:"100 g"},
    {name:"Vitela, costeleta grelhada", qty:"100 g"},
    {name:"Vitela, fígado cru", qty:"100 g"},
    {name:"Vitela, fígado frito com margarina e banha", qty:"100 g"},
    {name:"Vitela, fígado frito sem molho", qty:"100 g"},
    {name:"Vitela, fígado grelhado", qty:"100 g"},
    {name:"Vitela, lombo assado com azeite e margarina", qty:"100 g"},
    {name:"Vitela, lombo assado com azeite, margarina e óleo alimentar", qty:"100 g"},
    {name:"Vitela, lombo assado com margarina e óleo alimentar", qty:"100 g"},
    {name:"Vitela, lombo assado, sem molho", qty:"100 g"},
    {name:"Vitela, lombo cru", qty:"100 g"},
    {name:"Vitela, lombo frito com margarina", qty:"100 g"},
    {name:"Vitela, lombo frito, sem molho", qty:"100 g"},
    {name:"Vitela, lombo grelhado", qty:"100 g"},
    {name:"Vitela, pá crua", qty:"100 g"},
    {name:"Vitela, peito magro cozido", qty:"100 g"},
    {name:"Vitela, peito magro cru", qty:"100 g"},
    {name:"Vitela, peito magro estufado, sem molho", qty:"100 g"},
    {name:"Açorda de marisco", qty:"100 g"},
    {name:"Almôndegas de porco", qty:"100 g"},
    {name:"Arroz de bacalhau", qty:"100 g"},
    {name:"Arroz de bacalhau com margarina", qty:"100 g"},
    {name:"Arroz de frango", qty:"100 g"},
    {name:"Arroz de gambas", qty:"100 g"},
    {name:"Arroz de lulas", qty:"100 g"},
    {name:"Arroz de marisco", qty:"100 g"},
    {name:"Arroz de peixe", qty:"100 g"},
    {name:"Arroz de peixe com ervilhas", qty:"100 g"},
    {name:"Arroz de polvo com azeite", qty:"100 g"},
    {name:"Arroz de tamboril malandrinho", qty:"100 g"},
    {name:"Caldeirada de bacalhau", qty:"100 g"},
    {name:"Caldeirada de safio", qty:"100 g"},
    {name:"Caldeirada de safio, raia e tamboril", qty:"100 g"},
    {name:"Empadão de pescada e camarão", qty:"100 g"},
    {name:"Hambúrguer de feijão manteiga frito com azeite", qty:"100 g"},
    {name:"Hambúrguer de feijão manteiga frito com óleo de milho", qty:"100 g"},
    {name:"Massa com ovo cozida", qty:"100 g"},
    {name:"Massa com ovo crua", qty:"100 g"},
    {name:"Meia-desfeita de bacalhau", qty:"100 g"},
    {name:"Sopa de carne de porco", qty:"100 g"},
    {name:"Sopa de peixe com massa", qty:"100 g"},
    {name:"Sopa, canja de galinha", qty:"100 g"},
    {name:"Vaca magra estufada à jardineira", qty:"100 g"},
    {name:"Cogumelos ostra (pleurotus)", qty:"100 g"},
    {name:"Espargos cozidos", qty:"100 g"},
    {name:"Espargos crus", qty:"100 g"},
    {name:"Açorda de bacalhau", qty:"100 g"},
    {name:"Almôndegas de vaca", qty:"100 g"},
    {name:"Almôndegas de vaca e porco", qty:"100 g"},
    {name:"Arroz de frango malandrinho à moda de Monção", qty:"100 g"},
    {name:"Arroz de polvo com tomate", qty:"100 g"},
    {name:"Arroz de polvo com tomate e vinho", qty:"100 ml"},
    {name:"Arroz de tamboril", qty:"100 g"},
    {name:"Atum de cebolada", qty:"100 g"},
    {name:"Bacalhau à Brás", qty:"100 g"},
    {name:"Bacalhau à Brás com azeite", qty:"100 g"},
    {name:"Bacalhau à Brás com azeite e azeitonas", qty:"100 g"},
    {name:"Bacalhau à Gomes de Sá", qty:"100 g"},
    {name:"Bacalhau à Gomes de Sá, com azeite", qty:"100 g"},
    {name:"Banha de porco", qty:"100 g"},
    {name:"Borrego, perna ou costeleta estufada com azeite e margarina", qty:"100 g"},
    {name:"Borrego, perna ou costeleta estufada com margarina", qty:"100 g"},
    {name:"Caldeirada de bacalhau com enchidos e massa", qty:"100 g"},
    {name:"Caldeirada de enguias", qty:"100 g"},
    {name:"Caldeirada de enguias à moda de Aveiro", qty:"100 g"},
    {name:"Caldeirada de pargo e peixe-espada-preto", qty:"100 g"},
    {name:"Caldeirada de peixe", qty:"100 g"},
    {name:"Caldo preparado com cubo de carne de galinha (diluição 2%)", qty:"100 g"},
    {name:"Caldo preparado com cubo de carne de vaca (diluição 2%)", qty:"100 g"},
    {name:"Cantarilho (Redfish) assado com cebola, tomate, azeite e bacon", qty:"100 g"},
    {name:"Carne à bolonhesa", qty:"100 g"},
    {name:"Carne à jardineira", qty:"100 g"},
    {name:"Carne de porco à alentejana", qty:"100 g"},
    {name:"Carne de porco à alentejana sem massa de pimentão", qty:"100 g"},
    {name:"Carneiro, perna magra, estufada com margarina", qty:"100 g"},
    {name:"Coelho à caçador", qty:"100 g"},
    {name:"Coelho em vinha de alhos", qty:"100 g"},
    {name:"Cubo de carne de galinha para caldo", qty:"100 g"},
    {name:"Empadão de atum", qty:"100 g"},
    {name:"Empadão de bacalhau", qty:"100 g"},
    {name:"Empadão de carne com manteiga", qty:"100 g"},
    {name:"Empadão de carne com margarina", qty:"100 g"},
    {name:"Empadão de carne guisada", qty:"100 g"},
    {name:"Feijoada com carne de porco", qty:"100 g"},
    {name:"Feijoada com carne de porco e de vaca", qty:"100 g"},
    {name:"Feijoada com enchidos e ovos", qty:"100 g"},
    {name:"Frango (1/4) peito e asa com pele, estufados com azeite e margarina", qty:"100 g"},
    {name:"Frango (1/4) peito e asa com pele, estufados com margarina", qty:"100 g"},
    {name:"Frango (1/4) perna com costa e pele, estufada com azeite e margarina", qty:"100 g"},
    {name:"Frango (1/4) perna com costa e pele, estufada com margarina", qty:"100 g"},
    {name:"Frango inteiro com pele, estufado com azeite e margarina", qty:"100 g"},
    {name:"Frango inteiro com pele, estufado com margarina", qty:"100 g"},
    {name:"Frango, peito com pele estufado com azeite e margarina", qty:"100 g"},
    {name:"Frango, peito com pele estufado com margarina", qty:"100 g"},
    {name:"Lasanha à bolonhesa", qty:"100 g"},
    {name:"Molho branco com caldo de carne de vaca", qty:"100 g"},
    {name:"Molho de carne de vaca assada com azeite e margarina", qty:"100 g"},
    {name:"Molho de carne de vaca assada com margarina", qty:"100 g"},
    {name:"Molho de carne de vaca estufada com azeite e margarina", qty:"100 g"},
    {name:"Molho de carne de vaca estufada com vegetais, azeite e margarina", qty:"100 g"},
    {name:"Molho de lombo de porco frito com banha", qty:"100 g"},
    {name:"Molho de lombo de porco frito com banha e margarina", qty:"100 g"},
    {name:"Molho de lombo de porco frito com margarina", qty:"100 g"},
    {name:"Molho de lombo de vaca frito com creme vegetal sem sal", qty:"100 g"},
    {name:"Molho de lombo de vaca frito com margarina", qty:"100 g"},
    {name:"Morcela grelhada", qty:"100 g"},
    {name:"Omelete", qty:"100 g"},
    {name:"Omelete com manteiga", qty:"100 g"},
    {name:"Omelete com margarina", qty:"100 g"},
    {name:"Ovo de galinha, mexido com manteiga", qty:"100 g"},
    {name:"Ovo de galinha, mexido com margarina", qty:"100 g"},
    {name:"Pargo mulato assado com cebola, tomate e azeite", qty:"100 g"},
    {name:"Pato sem pele, estufado com margarina", qty:"100 g"},
    {name:"Perdiz estufada com margarina", qty:"100 g"},
    {name:"Peru, perna com pele, estufada com margarina", qty:"100 g"},
    {name:"Porco, coração estufado com banha e margarina", qty:"100 g"},
    {name:"Porco, costeleta meio gorda estufada", qty:"100 g"},
    {name:"Porco, costeleta meio gorda estufada com azeite e banha", qty:"100 g"},
    {name:"Porco, costeleta meio gorda estufada com azeite e margarina", qty:"100 g"},
    {name:"Porco, costeleta meio gorda estufada com margarina", qty:"100 g"},
    {name:"Porco, costeleta meio gorda estufada com óleo alimentar e banha", qty:"100 g"},
    {name:"Porco, costeleta meio gorda frita panada", qty:"100 g"},
    {name:"Porco, entrecosto estufado com azeite e banha", qty:"100 g"},
    {name:"Porco, entrecosto estufado com azeite e margarina", qty:"100 g"},
    {name:"Porco, entrecosto estufado com margarina", qty:"100 g"},
    {name:"Porco, entrecosto estufado com óleo alimentar e banha", qty:"100 g"},
    {name:"Porco, hambúrguer frito, sem molho", qty:"100 g"},
    {name:"Porco, hambúrguer grelhado", qty:"100 g"},
    {name:"Porco, lombo frito panado", qty:"100 g"},
    {name:"Porco, perna magra estufada com azeite e banha", qty:"100 g"},
    {name:"Porco, perna magra estufada com azeite e margarina", qty:"100 g"},
    {name:"Porco, perna magra estufada com margarina", qty:"100 g"},
    {name:"Porco, perna magra estufada com óleo alimentar e banha", qty:"100 g"},
    {name:"Porco, rojões de carne gorda", qty:"100 g"},
    {name:"Porco, rojões de carne magra", qty:"100 g"},
    {name:"Rancho com carne de galinha, porco e vaca", qty:"100 g"},
    {name:"Rancho com carne de porco", qty:"100 g"},
    {name:"Robalo assado com cebola, azeite, banha e manteiga", qty:"100 g"},
    {name:"Salada de atum", qty:"100 g"},
    {name:"Salada de bacalhau com grão", qty:"100 g"},
    {name:"Salsicha de soja", qty:"100 g"},
    {name:"Salsicha fresca estufada com couve e azeite", qty:"100 g"},
    {name:"Salsicha fresca estufada com legumes e azeite", qty:"100 g"},
    {name:"Salsicha tipo Frankfurt frita (escorrido o óleo)", qty:"100 g"},
    {name:"Salsicha tipo Frankfurt grelhada", qty:"100 g"},
    {name:"Sopa de espinafres com ovos", qty:"100 g"},
    {name:"Sopa de peixe", qty:"100 g"},
    {name:"Tofu frito com azeite", qty:"100 g"},
    {name:"Tofu frito com óleo de milho", qty:"100 g"},
    {name:"Tofu simples", qty:"100 g"},
    {name:"Vaca magra estufada", qty:"100 g"},
    {name:"Vaca magra estufada com azeite e margarina", qty:"100 g"},
    {name:"Vaca magra estufada com margarina", qty:"100 g"},
    {name:"Vaca magra estufada com óleo alimentar e margarina", qty:"100 g"},
    {name:"Vaca meio gorda estufada", qty:"100 g"},
    {name:"Vaca meio gorda estufada com azeite e margarina", qty:"100 g"},
    {name:"Vaca meio gorda estufada com margarina", qty:"100 g"},
    {name:"Vaca meio gorda estufada com óleo alimentar e margarina", qty:"100 g"},
    {name:"Vaca, bife à Marrare com manteiga", qty:"100 g"},
    {name:"Vaca, bife à Marrare com margarina", qty:"100 g"},
    {name:"Vaca, bife com ovo a cavalo, frito com banha", qty:"100 g"},
    {name:"Vaca, bife com ovo a cavalo, frito com manteiga", qty:"100 g"},
    {name:"Vaca, hambúrguer frito", qty:"100 g"},
    {name:"Vaca, língua estufada, sem molho", qty:"100 g"},
    {name:"Vitela, peito magro estufado", qty:"100 g"},
    {name:"Vitela, peito magro estufado com azeite e margarina", qty:"100 g"},
    {name:"Vitela, peito magro estufado com azeite, margarina e óleo alimentar", qty:"100 g"},
    {name:"Vitela, peito magro estufado com margarina e óleo alimentar", qty:"100 g"}
  ],
  fruta: [
    {name:"Ameixas secas sem caroço (Mercadona)", qty:"100 g"},
    {name:"Tâmaras secas sem caroço (Mercadona)", qty:"100 g"},
    {name:"Tâmara seca (Continente)", qty:"100 g"},
    {name:"Tâmara seca com caroço (Pingo Doce)", qty:"100 g"},
    {name:"Bagas goji secas (Bio)", qty:"100 g"},
    {name:"Mirtilos (Pingo Doce)", qty:"100 g"},
    {name:"Mistura de frutos vermelhos secos (Origens)", qty:"100 g"},
    {name:"Maçã", qty:"1 unid."},
    {name:"Banana", qty:"1 unid."},
    {name:"Mirtilos", qty:"100 g"},
    {name:"Laranja", qty:"1 unid."},
    {name:"Alperce", qty:"100 g"},
    {name:"Alperce seco", qty:"100 g"},
    {name:"Ameixa branca", qty:"100 g"},
    {name:"Ameixa encarnada", qty:"100 g"},
    {name:"Ameixa rainha Cláudia", qty:"100 g"},
    {name:"Ameixa seca", qty:"100 g"},
    {name:"Amora silvestre", qty:"100 g"},
    {name:"Ananás", qty:"100 g"},
    {name:"Ananás desidratado", qty:"100 g"},
    {name:"Anona", qty:"100 g"},
    {name:"Anona desidratada", qty:"100 g"},
    {name:"Carambola", qty:"100 g"},
    {name:"Cereja (4 variedades)", qty:"100 g"},
    {name:"Cereja desidratada", qty:"100 g"},
    {name:"Cereja, cristalizada", qty:"100 g"},
    {name:"Clementina", qty:"100 g"},
    {name:"Dióspiro", qty:"100 g"},
    {name:"Dióspiro desidratado", qty:"100 g"},
    {name:"Farinha de alfarroba", qty:"100 g"},
    {name:"Feijoa (polpa)", qty:"100 g"},
    {name:"Figo (5 variedades)", qty:"100 g"},
    {name:"Figo cristalizado", qty:"100 g"},
    {name:"Figo seco", qty:"100 g"},
    {name:"Framboesa", qty:"100 g"},
    {name:"Framboesa desidratada", qty:"100 g"},
    {name:"Goiaba crua, polpa", qty:"100 g"},
    {name:"Groselha", qty:"100 g"},
    {name:"Laranja (3 variedades)", qty:"100 g"},
    {name:"Lichia fresca", qty:"100 g"},
    {name:"Lima", qty:"100 g"},
    {name:"Limão", qty:"100 g"},
    {name:"Maçã (média com e sem casca)", qty:"100 g"},
    {name:"Maçã assada sem açúcar", qty:"100 g"},
    {name:"Maçã com casca", qty:"100 g"},
    {name:"Maçã cozida sem açúcar", qty:"100 g"},
    {name:"Maçã desidratada", qty:"100 g"},
    {name:"Maçã seca", qty:"100 g"},
    {name:"Maçã sem casca", qty:"100 g"},
    {name:"Manga", qty:"100 g"},
    {name:"Manga desidratada", qty:"100 g"},
    {name:"Maracujá", qty:"100 g"},
    {name:"Marmelo", qty:"100 g"},
    {name:"Medronho", qty:"100 g"},
    {name:"Mirtilo", qty:"100 g"},
    {name:"Mirtilo desidratado", qty:"100 g"},
    {name:"Morango", qty:"100 g"},
    {name:"Morango desidratado", qty:"100 g"},
    {name:"Múcua (fruto do embondeiro, baobab)", qty:"100 g"},
    {name:"Nectarina", qty:"100 g"},
    {name:"Nêspera", qty:"100 g"},
    {name:"Papaia", qty:"100 g"},
    {name:"Papaia desidratada", qty:"100 g"},
    {name:"Pera (5 variedades)", qty:"100 g"},
    {name:"Pera cozida sem açúcar", qty:"100 g"},
    {name:"Pera cristalizada", qty:"100 g"},
    {name:"Pera desidratada", qty:"100 g"},
    {name:"Pêssego (2 variedades)", qty:"100 g"},
    {name:"Quivi, \"Kiwi\"", qty:"100 g"},
    {name:"Quivi, \"Kiwi\" desidratado", qty:"100 g"},
    {name:"Romã", qty:"100 g"},
    {name:"Sultanas", qty:"100 g"},
    {name:"Tâmara fresca", qty:"100 g"},
    {name:"Tâmara seca", qty:"100 g"},
    {name:"Tamarilho sem pele", qty:"100 g"},
    {name:"Tângera", qty:"100 g"},
    {name:"Tangerina", qty:"100 g"},
    {name:"Toranja", qty:"100 g"},
    {name:"Uva branca (5 variedades)", qty:"100 g"},
    {name:"Uva de mesa (branca e tinta)", qty:"100 g"},
    {name:"Uva seca (passas)", qty:"100 g"},
    {name:"Uva tinta (5 variedades)", qty:"100 g"}
  ],
  vegetais: [
    {name:"Tomate pelado em pedaços (Hacendado)", qty:"100 g"},
    {name:"Cenouras (Continente)", qty:"100 g"},
    {name:"Polpa de tomate (Pingo Doce)", qty:"100 g"},
    {name:"Polpa de tomate (Continente)", qty:"100 g"},
    {name:"Tomate em pedaços (Pingo Doce)", qty:"100 g"},
    {name:"Feijão verde (Compal)", qty:"100 g"},
    {name:"Tomate pelado inteiro (Pingo Doce)", qty:"100 g"},
    {name:"Pimentos assados vermelhos e verdes (Hacendado)", qty:"100 g"},
    {name:"Brócolos", qty:"150 g"},
    {name:"Salada mista", qty:"150 g"},
    {name:"Cenoura", qty:"150 g"},
    {name:"Courgette", qty:"150 g"},
    {name:"Espinafres", qty:"150 g"},
    {name:"Abóbora cristalizada", qty:"100 g"},
    {name:"Abóbora crua", qty:"100 g"},
    {name:"Acelga crua", qty:"100 g"},
    {name:"Agrião cru", qty:"100 g"},
    {name:"Aipo cru", qty:"100 g"},
    {name:"Alcachofra cozida", qty:"100 g"},
    {name:"Alcachofra crua", qty:"100 g"},
    {name:"Alcaparras (picles)", qty:"100 g"},
    {name:"Alecrim fresco", qty:"100 g"},
    {name:"Alface", qty:"100 g"},
    {name:"Alface roxa", qty:"100 g"},
    {name:"Algas nori", qty:"100 g"},
    {name:"Alho-francês cru", qty:"100 g"},
    {name:"Alho cru", qty:"100 g"},
    {name:"Alho em pó", qty:"100 g"},
    {name:"Bagas goji secas", qty:"100 g"},
    {name:"Beldroega crua", qty:"100 g"},
    {name:"Beringela crua", qty:"100 g"},
    {name:"Beterraba (raiz) cozida sem sal", qty:"100 g"},
    {name:"Beterraba (raiz) crua", qty:"100 g"},
    {name:"Brócolos cozidos", qty:"100 g"},
    {name:"Brócolos crus", qty:"100 g"},
    {name:"Canónigos crus", qty:"100 g"},
    {name:"Cebola cozida", qty:"100 g"},
    {name:"Cebola crua", qty:"100 g"},
    {name:"Cebola doce, crua", qty:"100 g"},
    {name:"Cebola roxa, crua", qty:"100 g"},
    {name:"Cebolinho fresco", qty:"100 g"},
    {name:"Cenoura baby crua", qty:"100 g"},
    {name:"Cenoura cozida", qty:"100 g"},
    {name:"Cenoura crua", qty:"100 g"},
    {name:"Cerefólio fresco", qty:"100 g"},
    {name:"Chicória crua", qty:"100 g"},
    {name:"Chuchu", qty:"100 g"},
    {name:"Chucrute", qty:"100 g"},
    {name:"Coentros crus", qty:"100 g"},
    {name:"Cogumelos enlatados, escorridos", qty:"100 g"},
    {name:"Cogumelos marron", qty:"100 g"},
    {name:"Cogumelos, genérico", qty:"100 g"},
    {name:"Couve-branca cozida", qty:"100 g"},
    {name:"Couve-branca crua", qty:"100 g"},
    {name:"Couve-de-Bruxelas cozida", qty:"100 g"},
    {name:"Couve-de-Bruxelas crua", qty:"100 g"},
    {name:"Couve-flor cozida", qty:"100 g"},
    {name:"Couve-flor crua", qty:"100 g"},
    {name:"Couve-galega cozida", qty:"100 g"},
    {name:"Couve-galega crua", qty:"100 g"},
    {name:"Couve-lombarda cozida", qty:"100 g"},
    {name:"Couve-lombarda crua", qty:"100 g"},
    {name:"Couve-portuguesa cozida", qty:"100 g"},
    {name:"Couve-portuguesa crua", qty:"100 g"},
    {name:"Couve-roxa crua", qty:"100 g"},
    {name:"Curgete crua", qty:"100 g"},
    {name:"Endívia crua", qty:"100 g"},
    {name:"Ervilhas, vagens cozidas", qty:"100 g"},
    {name:"Ervilhas, vagens cruas", qty:"100 g"},
    {name:"Espinafres crus", qty:"100 g"},
    {name:"Estragão fresco", qty:"100 g"},
    {name:"Feijão-verde fresco cozido", qty:"100 g"},
    {name:"Feijão-verde fresco cru", qty:"100 g"},
    {name:"Fisális", qty:"100 g"},
    {name:"Folhas de rabanete cruas", qty:"100 g"},
    {name:"Funcho fresco", qty:"100 g"},
    {name:"Grelos de couve cozidos", qty:"100 g"},
    {name:"Grelos de couve crus", qty:"100 g"},
    {name:"Grelos de nabo cozidos", qty:"100 g"},
    {name:"Grelos de nabo crus", qty:"100 g"},
    {name:"Hortelã fresca", qty:"100 g"},
    {name:"Malagueta vermelha fresca", qty:"100 g"},
    {name:"Manjericão fresco", qty:"100 g"},
    {name:"Melancia", qty:"100 g"},
    {name:"Melão (3 variedades)", qty:"100 g"},
    {name:"Meloa", qty:"100 g"},
    {name:"Milho doce em conserva", qty:"100 g"},
    {name:"Nabiça crua", qty:"100 g"},
    {name:"Nabiças cozidas", qty:"100 g"},
    {name:"Nabo (raiz) cozido", qty:"100 g"},
    {name:"Nabo (raiz) cru", qty:"100 g"},
    {name:"Pepino cru", qty:"100 g"},
    {name:"Picles de pepino", qty:"100 g"},
    {name:"Pimento cru", qty:"100 g"},
    {name:"Pimento grelhado", qty:"100 g"},
    {name:"Quiabo cru", qty:"100 g"},
    {name:"Rabanete cru", qty:"100 g"},
    {name:"Rábano cru", qty:"100 g"},
    {name:"Rebentos de alfalfa crus", qty:"100 g"},
    {name:"Rebentos de bambu crus", qty:"100 g"},
    {name:"Rebentos de feijão mungo", qty:"100 g"},
    {name:"Rebentos de soja crus", qty:"100 g"},
    {name:"Rúcula crua", qty:"100 g"},
    {name:"Salicórnia fresca", qty:"100 g"},
    {name:"Salsa fresca", qty:"100 g"},
    {name:"Tomate cherry cru", qty:"100 g"},
    {name:"Tomate concentrado", qty:"100 g"},
    {name:"Tomate cru", qty:"100 g"},
    {name:"Tomate em conserva ao natural", qty:"100 g"},
    {name:"Tomate seco", qty:"100 g"},
    {name:"Tomilho fresco", qty:"100 g"},
    {name:"Túbera (trufa) crua", qty:"100 g"}
  ],
  gorduras: [
    {name:"Azeite virgem extra (Hacendado)", qty:"100 g"},
    {name:"Azeite virgem extra (Pingo Doce)", qty:"100 g"},
    {name:"Azeite (Oliveira da Serra)", qty:"100 g"},
    {name:"Azeite Gallo (Gallo)", qty:"100 g"},
    {name:"Azeite (Continente)", qty:"100 g"},
    {name:"Azeite virgem extra (Herdade do Esporão)", qty:"100 g"},
    {name:"Óleo de coco virgem (Mercadona)", qty:"100 g"},
    {name:"Óleo de girassol (Fula)", qty:"100 g"},
    {name:"Óleo alimentar (Pingo Doce)", qty:"100 g"},
    {name:"Creme vegetal para barrar (Pingo Doce)", qty:"100 g"},
    {name:"Creme vegetal para barrar (Continente)", qty:"100 g"},
    {name:"Margarina vegetal (Vaqueiro)", qty:"100 g"},
    {name:"Nutella — creme de avelã e cacau (Nutella)", qty:"100 g"},
    {name:"Manteiga de amendoim 100% (Mercadona)", qty:"100 g"},
    {name:"Guacamole (Mercadona)", qty:"100 g"},
    {name:"Hummus clássico (Hacendado)", qty:"100 g"},
    {name:"Manteiga de amendoim cremosa (Maribel)", qty:"100 g"},
    {name:"Manteiga tradicional com sal (Mimosa)", qty:"100 g"},
    {name:"Nozes (Dia)", qty:"100 g"},
    {name:"Caju (Continente)", qty:"100 g"},
    {name:"Noz em metades (Continente)", qty:"100 g"},
    {name:"Anchova, conserva em óleo, escorrido", qty:"100 g"},
    {name:"Arroz de cenoura com azeite", qty:"100 g"},
    {name:"Arroz de manteiga", qty:"100 g"},
    {name:"Arroz de tomate com azeite", qty:"100 g"},
    {name:"Arroz de tomate com margarina", qty:"100 g"},
    {name:"Batata estufada com cebola, azeite e óleo alimentar", qty:"100 g"},
    {name:"Castanha assada com sal", qty:"100 g"},
    {name:"Castanha cozida sem sal", qty:"100 g"},
    {name:"Castanha pilada", qty:"100 g"},
    {name:"Castanha, miolo", qty:"100 g"},
    {name:"Esparguete estufado com cenoura e azeite", qty:"100 g"},
    {name:"Esparguete estufado com cenoura e margarina", qty:"100 g"},
    {name:"Feijão manteiga, demolhado, cozido", qty:"100 g"},
    {name:"Feijão manteiga, seco, cru", qty:"100 g"},
    {name:"Pão de trigo integral com sementes de sésamo", qty:"100 g"},
    {name:"Sopa de feijão-manteiga", qty:"100 g"},
    {name:"Beringela grelhada com azeite", qty:"100 g"},
    {name:"Cebola frita com óleo alimentar", qty:"100 g"},
    {name:"Cogumelos fritos com óleo alimentar", qty:"100 g"},
    {name:"Curgete frita com óleo alimentar", qty:"100 g"},
    {name:"Azeite", qty:"10 ml"},
    {name:"Abacate", qty:"50 g"},
    {name:"Frutos secos", qty:"20 g"},
    {name:"Manteiga de amendoim", qty:"15 g"},
    {name:"Amêndoa, miolo, com pele", qty:"100 g"},
    {name:"Amêndoa, miolo, torrada, sem pele", qty:"100 g"},
    {name:"Amendoim, miolo", qty:"100 g"},
    {name:"Amendoim, miolo, torrado com sal", qty:"100 g"},
    {name:"Amendoim, miolo, torrado sem sal", qty:"100 g"},
    {name:"Arroz à valenciana", qty:"100 g"},
    {name:"Avelã, miolo", qty:"100 g"},
    {name:"Azeite (4 marcas)", qty:"100 g"},
    {name:"Cacau em pó", qty:"100 g"},
    {name:"Caril em pó", qty:"100 g"},
    {name:"Castanha de caju torrada e salgada", qty:"100 g"},
    {name:"Castanha de caju torrada, sem sal", qty:"100 g"},
    {name:"Castanha do Brasil", qty:"100 g"},
    {name:"Coco seco, ralado", qty:"100 g"},
    {name:"Cominhos", qty:"100 g"},
    {name:"Cozido à portuguesa", qty:"100 g"},
    {name:"Cozido à portuguesa com grão", qty:"100 g"},
    {name:"Creme culinário", qty:"100 g"},
    {name:"Creme culinário líquido, 65% gordura, com sal", qty:"100 g"},
    {name:"Creme de ervilhas", qty:"100 g"},
    {name:"Creme para barrar de cacau e avelãs", qty:"100 g"},
    {name:"Creme vegetal culinário, 75% gordura, sem sal", qty:"100 g"},
    {name:"Creme vegetal de soja para barrar", qty:"100 g"},
    {name:"Creme vegetal de soja para culinária (alternativa à nata)", qty:"100 g"},
    {name:"Creme vegetal para barrar  72% gordura, 33% ácidos gordos polinsaturados", qty:"100 g"},
    {name:"Creme vegetal para barrar 35% gordura, com fitosteróis", qty:"100 g"},
    {name:"Creme vegetal para barrar 37% gordura", qty:"100 g"},
    {name:"Creme vegetal para barrar 58% gordura, com cálcio", qty:"100 g"},
    {name:"Creme vegetal para barrar 70% gordura, 53% ácidos gordos monoinsaturados", qty:"100 g"},
    {name:"Creme vegetal para barrar 70% gordura, com sal", qty:"100 g"},
    {name:"Ervilhas, grão, frescas, estufadas", qty:"100 g"},
    {name:"Favada à portuguesa", qty:"100 g"},
    {name:"Francesinha, com molho", qty:"100 g"},
    {name:"Manteiga com sal", qty:"100 g"},
    {name:"Manteiga sem sal", qty:"100 g"},
    {name:"Margarina", qty:"100 g"},
    {name:"Margarina 3/4, de girassol", qty:"100 g"},
    {name:"Margarina vegetal culinária, 80% gordura, com sal", qty:"100 g"},
    {name:"Margarina vegetal culinária, com alho e sal", qty:"100 g"},
    {name:"Minarina (meia margarina)", qty:"100 g"},
    {name:"Molho \"Béchamel\" com manteiga", qty:"100 g"},
    {name:"Molho \"Béchamel\" com margarina", qty:"100 g"},
    {name:"Molho branco com margarina", qty:"100 g"},
    {name:"Molho de bife frito com manteiga", qty:"100 g"},
    {name:"Molho de mostarda", qty:"100 g"},
    {name:"Molho de tomate", qty:"100 g"},
    {name:"Molho de vinagrete", qty:"100 g"},
    {name:"Molho verde", qty:"100 g"},
    {name:"Noz-moscada", qty:"100 g"},
    {name:"Noz macadâmia", qty:"100 g"},
    {name:"Noz pecan", qty:"100 g"},
    {name:"Noz, miolo", qty:"100 g"},
    {name:"Óleo \"Becel\"", qty:"100 g"},
    {name:"Óleo alimentar", qty:"100 g"},
    {name:"Óleo de amendoim", qty:"100 g"},
    {name:"Óleo de coco", qty:"100 g"},
    {name:"Óleo de girassol", qty:"100 g"},
    {name:"Óleo de linhaça", qty:"100 g"},
    {name:"Óleo de milho", qty:"100 g"},
    {name:"Óleo de palma", qty:"100 g"},
    {name:"Óleo de soja", qty:"100 g"},
    {name:"Pinhão, miolo", qty:"100 g"},
    {name:"Pistácio torrado e salgado", qty:"100 g"},
    {name:"Pistácio torrado, sem sal", qty:"100 g"},
    {name:"Salada de alface e tomate temperada com azeite e vinagre", qty:"100 g"},
    {name:"Salada russa", qty:"100 g"},
    {name:"Sementes de abóbora, cruas, secas, miolo", qty:"100 g"},
    {name:"Sementes de cânhamo secas", qty:"100 g"},
    {name:"Sementes de chia", qty:"100 g"},
    {name:"Sementes de coentro", qty:"100 g"},
    {name:"Sementes de girassol, cruas, secas, miolo", qty:"100 g"},
    {name:"Sementes de linhaça cruas", qty:"100 g"},
    {name:"Sementes de melão", qty:"100 g"},
    {name:"Sementes de mostarda", qty:"100 g"},
    {name:"Sementes de papoila", qty:"100 g"},
    {name:"Sementes de sésamo", qty:"100 g"},
    {name:"Shortening para restaurante", qty:"100 g"},
    {name:"Soja cozida sem sal", qty:"100 g"},
    {name:"Soja, grão seco, cru", qty:"100 g"},
    {name:"Sopa de cozido", qty:"100 g"},
    {name:"Sopa de feijão", qty:"100 g"},
    {name:"Sopa de feijão-manteiga com couve-lombarda", qty:"100 g"},
    {name:"Sopa de feijão-verde e nabo", qty:"100 g"},
    {name:"Sopa de grão com espinafres", qty:"100 g"},
    {name:"Tahini", qty:"100 g"},
    {name:"Abacate, Hass", qty:"100 g"},
    {name:"Azeitona", qty:"100 g"}
  ],
  bebidas: [
    {name:"Café, infusão - bica", qty:"100 ml"},
    {name:"Café, infusão - valor médio (bica 60% e café de cafeteira 40%)", qty:"100 ml"},
    {name:"Café, infusão - café de cafeteira", qty:"100 ml"},
    {name:"Café, infusão - carioca", qty:"100 ml"},
    {name:"Chá, infusão, preto", qty:"100 ml"},
    {name:"Chá, infusão, verde", qty:"100 ml"}
  ],
  snacks: [
    {name:"Nuggets de frango (Mercadona)", qty:"100 g"},
    {name:"Pringles original (Pringles)", qty:"100 g"},
    {name:"Sumol de laranja (Sumol)", qty:"100 g"},
    {name:"Guaraná Antarctica (Guaraná Antarctica)", qty:"100 g"},
    {name:"Coca-Cola original (Coca-Cola)", qty:"100 g"},
    {name:"Coca-Cola zero (Coca-Cola)", qty:"100 g"},
    {name:"Chocolate de leite (Milka)", qty:"100 g"},
    {name:"Chocolate negro 72% (Mercadona)", qty:"100 g"},
    {name:"Toblerone (Mondelez)", qty:"100 g"},
    {name:"Bolachas Nutella de avelã e cacau (Ferrero)", qty:"100 g"},
    {name:"Bolacha Maria 100% integral (Mercadona)", qty:"100 g"},
    {name:"Digestive de aveia (Mercadona)", qty:"100 g"},
    {name:"Batatas fritas ao forno com sal (Lay's)", qty:"100 g"},
    {name:"Batatas fritas originais (Lay's)", qty:"100 g"},
    {name:"Rebuçados de eucalipto e mentol 0% açúcar (Hacendado)", qty:"100 g"},
    {name:"Sortido de gomas (Pingo Doce)", qty:"100 g"},
    {name:"Compota de morango 0% açúcar (Mercadona)", qty:"100 g"},
    {name:"Achocolatado com alto teor de gordura, pó", qty:"100 g"},
    {name:"Achocolatado com baixo teor de gordura, pó", qty:"100 g"},
    {name:"Açúcar amarelo", qty:"100 g"},
    {name:"Açúcar branco", qty:"100 g"},
    {name:"Aguardente", qty:"100 ml"},
    {name:"Batata frita caseira (em palitos)", qty:"100 g"},
    {name:"Bebida refrigerante, cola", qty:"100 ml"},
    {name:"Bebida refrigerante, gasosa", qty:"100 ml"},
    {name:"Bebida refrigerante, laranja", qty:"100 ml"},
    {name:"Bebida vegetal à base de amêndoa, com aroma a chocolate (alternativa ao leite)", qty:"100 ml"},
    {name:"Bebida vegetal à base de aveia, 0% de açúcar (alternativa ao leite)", qty:"100 ml"},
    {name:"Bebida vegetal à base de soja com açúcar, sal e aromas (alternativa ao leite)", qty:"100 ml"},
    {name:"Biscoitos caseiros", qty:"100 g"},
    {name:"Biscoitos limão", qty:"100 g"},
    {name:"Biscoitos, argolas", qty:"100 g"},
    {name:"Biscoitos, línguas de gato", qty:"100 g"},
    {name:"Biscoitos, línguas de veado", qty:"100 g"},
    {name:"Biscoitos, palitos la Reine", qty:"100 g"},
    {name:"Bola de Berlim sem creme", qty:"100 g"},
    {name:"Bolacha \"Belga\"", qty:"100 g"},
    {name:"Bolacha \"Cream cracker\"", qty:"100 g"},
    {name:"Bolacha \"waffer\" baunilha", qty:"100 g"},
    {name:"Bolacha água e sal", qty:"100 ml"},
    {name:"Bolacha aveia", qty:"100 g"},
    {name:"Bolacha chocolate", qty:"100 g"},
    {name:"Bolacha integral (trigo)", qty:"100 g"},
    {name:"Bolacha manteiga", qty:"100 g"},
    {name:"Bolacha Maria", qty:"100 g"},
    {name:"Bolacha torrada", qty:"100 g"},
    {name:"Bolo-Rei", qty:"100 g"},
    {name:"Bolo de arroz", qty:"100 g"},
    {name:"Bolo de bolacha Maria", qty:"100 g"},
    {name:"Bolo de chocolate", qty:"100 g"},
    {name:"Bolo de coco", qty:"100 g"},
    {name:"Bolo ferradura", qty:"100 g"},
    {name:"Bolo inglês", qty:"100 g"},
    {name:"Brandy", qty:"100 g"},
    {name:"Café solúvel em pó", qty:"100 g"},
    {name:"Café solúvel, descafeinado, pó", qty:"100 ml"},
    {name:"Cerveja branca", qty:"100 ml"},
    {name:"Cerveja preta", qty:"100 ml"},
    {name:"Cerveja sem álcool", qty:"100 ml"},
    {name:"Chamuça", qty:"100 g"},
    {name:"Chocolate, pó", qty:"100 g"},
    {name:"Croissant", qty:"100 g"},
    {name:"Donut", qty:"100 g"},
    {name:"Donut recheado com doce de fruta", qty:"100 g"},
    {name:"Éclair de chocolate", qty:"100 g"},
    {name:"Flocos de milho tipo \"Corn Flakes\"", qty:"100 g"},
    {name:"Gelado caseiro com palitos la Reine", qty:"100 g"},
    {name:"Gelado de água (sorvete)", qty:"100 ml"},
    {name:"Gelatina preparada com laranja e sumo de laranja", qty:"100 ml"},
    {name:"Gin - Rum- Whisky", qty:"100 ml"},
    {name:"Gressino", qty:"100 g"},
    {name:"Jesuíta", qty:"100 g"},
    {name:"Leite achocolatado, sem lactose", qty:"100 ml"},
    {name:"Leite achocolatado, UHT", qty:"100 ml"},
    {name:"Licor beneditino", qty:"100 ml"},
    {name:"Licor de anis", qty:"100 ml"},
    {name:"Licor de ginja", qty:"100 ml"},
    {name:"Licor simples", qty:"100 ml"},
    {name:"Madalena", qty:"100 g"},
    {name:"Marmelada", qty:"100 g"},
    {name:"Massa para pizza", qty:"100 g"},
    {name:"Massa quebrada para quiche", qty:"100 g"},
    {name:"Mel", qty:"100 g"},
    {name:"Mel de cana", qty:"100 g"},
    {name:"Melaço", qty:"100 g"},
    {name:"Merengue", qty:"100 g"},
    {name:"Molho de tomate, \"ketchup\"", qty:"100 g"},
    {name:"Mousse de chocolate", qty:"100 g"},
    {name:"Néctar de \"tutti - frutti\"", qty:"100 ml"},
    {name:"Néctar de alperce", qty:"100 ml"},
    {name:"Néctar de ananás", qty:"100 ml"},
    {name:"Néctar de laranja", qty:"100 ml"},
    {name:"Néctar de maçã", qty:"100 ml"},
    {name:"Néctar de maçã, \"light\"", qty:"100 ml"},
    {name:"Néctar de pera", qty:"100 ml"},
    {name:"Néctar de pêssego", qty:"100 ml"},
    {name:"Néctar de pêssego, \"light\"", qty:"100 ml"},
    {name:"Pastel de feijão", qty:"100 g"},
    {name:"Pastel de nata", qty:"100 g"},
    {name:"Pastilha elástica", qty:"100 g"},
    {name:"Pizza de queijo e tomate", qty:"100 g"},
    {name:"Pizza de queijo, tomate e fiambre", qty:"100 g"},
    {name:"Pudim de leite e ovos", qty:"100 ml"},
    {name:"Pudim flan caseiro", qty:"100 g"},
    {name:"Pudim instantâneo em pó", qty:"100 g"},
    {name:"Pudim instantâneo preparado com leite magro", qty:"100 ml"},
    {name:"Pudim instantâneo preparado com leite meio gordo", qty:"100 ml"},
    {name:"Queque", qty:"100 g"},
    {name:"Rabanada", qty:"100 g"},
    {name:"Rebuçados", qty:"100 g"},
    {name:"Rissol", qty:"100 g"},
    {name:"Rissol de camarão", qty:"100 g"},
    {name:"Sidra (vinho de maçã)", qty:"100 ml"},
    {name:"Sonhos", qty:"100 g"},
    {name:"Sucedâneo de café, 20% de café, pó", qty:"100 ml"},
    {name:"Sucedâneo de café, pó", qty:"100 ml"},
    {name:"Sumo de ananás, 100%", qty:"100 ml"},
    {name:"Sumo de ananás, concentrado", qty:"100 ml"},
    {name:"Sumo de laranja, 100%", qty:"100 ml"},
    {name:"Sumo de laranja, concentrado", qty:"100 ml"},
    {name:"Sumo de limão, fresco (espremido)", qty:"100 ml"},
    {name:"Sumo de maçã, 100%", qty:"100 ml"},
    {name:"Sumo de pêssego, 100%", qty:"100 ml"},
    {name:"Sumo de tomate, 100%", qty:"100 ml"},
    {name:"Tarte de maçã", qty:"100 g"},
    {name:"Tarte de maçã e pêssego", qty:"100 g"},
    {name:"Tisana, infusão de ervas", qty:"100 g"},
    {name:"Torta de chocolate e chantilly", qty:"100 g"},
    {name:"Vinho branco de uvas sobreamadurecidas", qty:"100 ml"},
    {name:"Vinho da Madeira", qty:"100 ml"},
    {name:"Vinho do Porto, doce", qty:"100 ml"},
    {name:"Vinho do Porto, meio seco", qty:"100 g"},
    {name:"Vinho do Porto, seco", qty:"100 g"},
    {name:"Vinho espumante, Bruto", qty:"100 ml"},
    {name:"Vinho espumante, Doce", qty:"100 ml"},
    {name:"Vinho espumante, Extra bruto", qty:"100 ml"},
    {name:"Vinho espumante, Extra seco", qty:"100 g"},
    {name:"Vinho espumante, Meio seco", qty:"100 g"},
    {name:"Vinho espumante, Seco", qty:"100 g"},
    {name:"Vinho frisante", qty:"100 ml"},
    {name:"Vinho licoroso, teor alcoólico  ≥17 e <20%vol.", qty:"100 ml"},
    {name:"Vinho licoroso, teor alcoólico <17%vol.", qty:"100 ml"},
    {name:"Vinho licoroso, teor alcoólico ≥20% vol.", qty:"100 ml"},
    {name:"Vinho maduro branco, teor alcoólico <12,5% vol.", qty:"100 ml"},
    {name:"Vinho maduro branco, teor alcoólico ≥12,5% vol.", qty:"100 ml"},
    {name:"Vinho maduro palhete", qty:"100 ml"},
    {name:"Vinho maduro tinto, teor alcoólico <12,5% vol.", qty:"100 ml"},
    {name:"Vinho maduro tinto, teor alcoólico ≥12,5% vol.", qty:"100 ml"},
    {name:"Vinho rosé de uvas sobreamadurecidas", qty:"100 ml"},
    {name:"Vinho rosé, teor alcoólico <12,5% vol.", qty:"100 ml"},
    {name:"Vinho rosé, teor alcoólico ≥12,5% vol.", qty:"100 ml"},
    {name:"Vinho verde branco", qty:"100 ml"},
    {name:"Vinho verde tinto", qty:"100 ml"},
    {name:"Batata frita, de pacote (em rodelas)", qty:"100 g"},
    {name:"Bebida vegetal à base de amêndoa, 0% açúcares (alternativa ao leite)", qty:"100 ml"},
    {name:"Bebida vegetal à base de aveia, com açúcares adicionados (alternativa ao leite)", qty:"100 ml"},
    {name:"Bebida vegetal à base de soja com açúcar, com cálcio, sal e aromas (alternativa ao leite)", qty:"100 ml"},
    {name:"Chocolate culinária, tablete", qty:"100 g"},
    {name:"Chocolate de leite, tablete", qty:"100 ml"},
    {name:"Chocolate negro (aproximadamente 50% cacau)", qty:"100 g"},
    {name:"Croquete", qty:"100 g"},
    {name:"Empada", qty:"100 g"},
    {name:"Gelado caseiro com bolachas e natas", qty:"100 g"},
    {name:"Gelado de leite", qty:"100 ml"},
    {name:"Maionese caseira, com ovo e azeite", qty:"100 g"},
    {name:"Maionese caseira, com ovo e óleo de soja", qty:"100 g"},
    {name:"Margarina culinária para folhados, com sal", qty:"100 g"},
    {name:"Margarina industrial para pastelaria, com sal", qty:"100 g"},
    {name:"Nata pasteurizada para café, 15% gordura", qty:"100 ml"},
    {name:"Pastel de bacalhau", qty:"100 g"},
    {name:"Pastel folhado", qty:"100 g"},
    {name:"Quiche de espinafres", qty:"100 g"},
    {name:"Quiche de vegetais", qty:"100 g"},
    {name:"Quiche lorraine", qty:"100 g"},
    {name:"Shortening para pastelaria", qty:"100 g"},
    {name:"Vaca, bife à café", qty:"100 ml"},
    {name:"Alperce, conserva em calda de açúcar", qty:"100 g"},
    {name:"Ameixa, conserva em calda de açúcar", qty:"100 g"},
    {name:"Ananás, conserva em calda de açúcar", qty:"100 g"},
    {name:"Cereja, conserva em calda de açúcar", qty:"100 g"},
    {name:"Compota de alperce", qty:"100 g"},
    {name:"Compota de ameixa", qty:"100 g"},
    {name:"Compota de ananás", qty:"100 g"},
    {name:"Compota de cereja", qty:"100 g"},
    {name:"Compota de laranja", qty:"100 g"},
    {name:"Doce de alperce", qty:"100 g"},
    {name:"Doce de cereja", qty:"100 g"},
    {name:"Doce de framboesa", qty:"100 g"},
    {name:"Doce de ginja", qty:"100 g"},
    {name:"Doce de maçã", qty:"100 g"},
    {name:"Doce de morango", qty:"100 g"},
    {name:"Doce de pêssego", qty:"100 g"},
    {name:"Geleia de casca de laranja", qty:"100 g"},
    {name:"Ginja", qty:"100 g"},
    {name:"Maçã assada com açúcar", qty:"100 g"},
    {name:"Maçã cozida com açúcar", qty:"100 g"},
    {name:"Pera conserva em calda de açúcar", qty:"100 g"},
    {name:"Pera cozida com açúcar", qty:"100 g"},
    {name:"Pêssego, conserva em calda de açúcar", qty:"100 g"}
  ]
};

var SCENARIOS = {
  restaurante: {
    label:"🍽️ Vou a um restaurante", tips:[
      "Prioriza proteína magra e legumes como base do prato.",
      "Pede molhos e acompanhamentos à parte para controlares a quantidade.",
      "Se houver pão ou entradas, escolhe uma coisa em vez de tudo.",
      "Bebe água como bebida principal."
    ]
  },
  jantar_amigos: {
    label:"👥 Vou jantar com amigos", tips:[
      "Mantém as refeições anteriores do dia normalmente.",
      "Dá prioridade à proteína quando escolheres o prato.",
      "Come de acordo com a tua fome, sem pressa.",
      "Não precisas de compensar amanhã — volta ao plano na próxima refeição."
    ]
  },
  festa: {
    label:"🎉 Tenho uma festa", tips:[
      "Come uma refeição normal antes de saíres, para não chegares esfomeado(a).",
      "Escolhe 1-2 coisas que realmente te apetecem e aproveita-as com calma.",
      "Alterna bebida alcoólica com água, se beberes.",
      "Não é preciso recuperar nada amanhã — só voltar ao plano na refeição seguinte."
    ]
  },
  viagem: {
    label:"✈️ Estou a viajar", tips:[
      "Leva snacks práticos: fruta, frutos secos, barras proteicas.",
      "Mantém a proteína em cada refeição sempre que possível.",
      "Não tentes seguir o plano ao detalhe — foca-te nas escolhas gerais.",
      "Bebe água com regularidade, sobretudo em viagens de avião."
    ]
  },
  ferias: {
    label:"🏖️ Estou de férias", tips:[
      "Mantém alguma estrutura sem te preocupares com precisão total.",
      "Prioriza proteína e movimento sempre que for fácil.",
      "Aproveita a experiência — férias fazem parte de uma vida equilibrada.",
      "Quando voltares à rotina, volta ao plano com naturalidade."
    ]
  },
  fastfood: {
    label:"🍔 Quero fazer uma refeição diferente", tips:[
      "Opções grelhadas em vez de panadas tendem a ter menos gordura.",
      "Reduz o tamanho do menu se fizer sentido para ti.",
      "Prioriza proteína — hambúrguer simples ou frango grelhado, por exemplo.",
      "Uma refeição diferente não desfaz o teu progresso."
    ]
  },
  outra: {
    label:"✏️ Outra situação", freeText:true, tips:[
      "Mantém a proteína como prioridade sempre que conseguires.",
      "Come de acordo com a tua fome, sem regras rígidas.",
      "Volta ao plano com naturalidade na refeição seguinte.",
      "Uma situação diferente não é uma falha — é só um dia diferente."
    ]
  }
};

function meal(name, time, foods){
  return {name:name, time:time, foods:foods, liveChoice:null, done:false, adapted:false, status:"planned", rescheduledTime:null};
}

/* ---------- Escape de HTML: nome/horário da refeição já podem vir de texto escrito pelo profissional ---------- */
var HTML_ESCAPE_MAP = {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"};
function escapeHtml(str){
  return String(str == null ? "" : str).replace(/[&<>"']/g, function(c){ return HTML_ESCAPE_MAP[c]; });
}

/* ---------- Estado da refeição: além de concluída/adaptada, pode ser ignorada, reagendada ou flexível ---------- */
function mealStatusIcon(m){
  if (m.adapted) return "↻";
  if (m.done) return "✓";
  if (m.status === "skipped") return "—";
  if (m.status === "flexible") return "◆";
  return "";
}
function mealCountsToday(m){
  if (m.done || m.adapted) return true;
  if (m.status === "skipped") return false;
  return m.status === "flexible";
}
function mealStatusLabel(m){
  if (m.adapted) return "Refeição adaptada";
  if (m.done) return "Refeição concluída";
  if (m.status === "skipped") return "Refeição ignorada";
  if (m.status === "rescheduled") return "Reagendada para " + (m.rescheduledTime || m.time);
  if (m.status === "flexible") return "Refeição flexível";
  return "Por fazer";
}
function mealRowSuffix(m){
  if (m.adapted) return " · adaptada";
  if (m.status === "skipped") return " · ignorada";
  if (m.status === "rescheduled") return " · reagendada para " + (m.rescheduledTime || m.time);
  if (m.status === "flexible") return " · flexível";
  return "";
}
function effectiveMealTime(m){ return m.rescheduledTime || m.time; }
// o dia de hoje é o dia LOCAL (toISOString é UTC: perto da meia-noite em Portugal daria o dia anterior); as datas já gravadas não se tocam
function todayISO(){ return localTodayISO(); }

/* ===================== Plano vs. execução diária =====================
   s.meals é a ESTRUTURA do plano (nome, horário, alimentos, quantidades) — só o
   profissional a escreve. O que o aluno faz no dia a dia (concluir, adaptar,
   ignorar, reagendar, escolher dentro do construtor, substituir um alimento)
   nunca é gravado ali: fica em s.mealDailyState, um objeto separado indexado por
   refeição (mealKey = nome+horário, a mesma identidade que o resto da app já usa
   para uma refeição) e associado à data a que pertence.
   resolveMealsForToday() combina os dois só para leitura/renderização, devolvendo
   objetos com a mesma forma que o resto do código já espera (done/adapted/status/
   rescheduledTime/liveChoice/foods já com substituições aplicadas) — nada aqui
   muta s.meals. commitMealView() faz o caminho inverso: depois de uma função como
   applySubstitution/skipMeal/etc. mutar uma dessas vistas, grava o resultado de
   volta em mealDailyState. */
function mealKey(m){ return m.name + "@" + m.time; }

function emptyDailyStateEntry(){
  return {done:false, adapted:false, status:"planned", rescheduledTime:null, liveChoice:null, substitutions:{}};
}

function ensureFreshDailyState(s){
  var today = todayISO();
  if (!s.mealDailyState || s.mealDailyState.date !== today){
    s.mealDailyState = {date: today, entries: {}};
  }
  return s.mealDailyState;
}

function getDailyStateEntry(s, m){
  var state = ensureFreshDailyState(s);
  var key = mealKey(m);
  if (!state.entries[key]) state.entries[key] = emptyDailyStateEntry();
  return state.entries[key];
}

function resolveMealsForToday(s){
  var state = ensureFreshDailyState(s);
  return (s.meals || []).map(function(m){
    var entry = state.entries[mealKey(m)] || emptyDailyStateEntry();
    var foods = m.foods.map(function(f, fi){
      var sub = entry.substitutions[fi];
      if (!sub) return f;
      return {name: sub.name, qty: sub.qty, group: f.group, required: f.required, original: {name: f.name, qty: f.qty}};
    });
    return {
      name: m.name, time: m.time, foods: foods,
      done: entry.done, adapted: entry.adapted, status: entry.status,
      rescheduledTime: entry.rescheduledTime, liveChoice: entry.liveChoice
    };
  });
}

function commitMealView(s, mv){
  var entry = getDailyStateEntry(s, mv);
  entry.done = mv.done;
  entry.adapted = mv.adapted;
  entry.status = mv.status;
  entry.rescheduledTime = mv.rescheduledTime;
  entry.liveChoice = mv.liveChoice;
  var subs = {};
  mv.foods.forEach(function(f, fi){ if (f.original) subs[fi] = {name: f.name, qty: f.qty}; });
  entry.substitutions = subs;
}

// Um "student" com .meals já resolvido para hoje — para tudo o que só LÊ
// (tplHoje, tplPlano, getNextMeal, consumedTotals...). Nunca usar para escrever.
function studentView(s){
  var view = Object.assign({}, s);
  view.meals = resolveMealsForToday(s);
  return view;
}

function getNextMealView(s){
  return getNextMeal(studentView(s));
}

function ensureFreshDay(s){
  var today = todayISO();
  if (s.mealsDate !== today){
    s.mealsDate = today;
    s.mealDailyState = {date: today, entries: {}};
    persistStudent(s);
  }
}

function skipMeal(s, meal, reason){
  meal.status = "skipped";
  logAdaptation(s, meal, "refeicao_ignorada", {reason: reason || ""});
}

function rescheduleMeal(s, meal, newTime){
  logAdaptation(s, meal, "reagendamento", {from: meal.time, to: newTime});
  meal.rescheduledTime = newTime;
  meal.status = "rescheduled";
}

function markFlexible(s, meal, reason){
  meal.status = "flexible";
  logAdaptation(s, meal, "refeicao_flexivel", {reason: reason || ""});
}

function logAdaptation(s, meal, type, details){
  if (!s.adaptationHistory) s.adaptationHistory = [];
  var now = new Date();
  var entry = {
    date: todayISO(),
    time: String(now.getHours()).padStart(2,"0") + ":" + String(now.getMinutes()).padStart(2,"0"),
    timestamp: now.toISOString(),
    meal: meal ? meal.name : null,
    type: type
  };
  Object.keys(details || {}).forEach(function(k){ entry[k] = details[k]; });
  s.adaptationHistory.push(entry);
}

/* ---------- Pedidos de ajuda ao profissional (Assistente Alimentar Guiado) ----------
   Ao contrário do resto do estado do aluno, os pedidos não vivem em s.<campo> +
   persistStudent(s) — ficam em tabelas próprias (help_requests / help_request_notes)
   com a sua própria RLS, precisamente para que a nota privada do profissional
   nunca seja lida pelo aluno (impossível de garantir só com colunas dentro de
   students, já que a política de leitura do aluno dá acesso à linha inteira).
   Continuam a alimentar adaptationHistory (tipo "pedido_profissional"), para que
   os indicadores da Leitura profissional e o resumo do Histórico não percam
   nada — só o detalhe rico (texto livre, estado, nota) é que vive à parte. */
var HELP_REQUESTS_ENABLED = false; // os pedidos de ajuda foram retirados da app (o profissional fala com o aluno nos treinos)
var HELP_OFF_MSG = "Fala com o teu profissional no próximo treino.";
function createHelpRequest(s, meal, situation, note){
  if (!HELP_REQUESTS_ENABLED) return Promise.resolve(false);
  logAdaptation(s, meal, "pedido_profissional", {situation: situation, note: note || ""});
  persistStudent(s);
  if (!sbReady) return Promise.resolve({success:false, offline:true});
  // Os chamadores mostram logo "O teu profissional vai ver este pedido"; se a gravação
  // falhar, esse aviso seria falso — por isso é substituído por um erro visível.
  function insertFailed(detail){
    console.error("help_requests: falhou ao gravar o pedido", detail);
    document.querySelectorAll(".toast").forEach(function(t){ t.remove(); });
    showToast("Não foi possível enviar o pedido ao teu profissional. Tenta outra vez.");
    return {success:false, error:detail};
  }
  return Promise.resolve(sb.from("help_requests").insert({
    student_id: s.id,
    situation: situation,
    meal_name: meal ? meal.name : null,
    note: note || null
  })).then(function(res){
    if (res && res.error) return insertFailed(res.error);
    return res;
  }, insertFailed);
}

function loadHelpRequests(studentId){
  if (!sbReady) return Promise.resolve([]);
  return sb.from("help_requests")
    .select("*, help_request_notes(professional_note)")
    .eq("student_id", studentId)
    .order("created_at", {ascending:false})
    .then(function(res){
      var data = res.data || [];
      // Um erro não pode parecer "sem pedidos": segue como propriedade da lista.
      if (res.error){ console.error("help_requests: falhou a leitura", res.error); data.error = res.error; }
      return data;
    }, function(err){
      console.error("help_requests: falhou a leitura", err);
      var data = [];
      data.error = err || {message:"Sem resposta do servidor"};
      return data;
    });
}

// Pedidos de ajuda por tratar, de todos os alunos de uma vez (uma só consulta): alimenta o indicador na lista e no menu do aluno
function loadPendingHelpCounts(){
  if (!sbReady) return Promise.resolve({});
  return sb.from("help_requests").select("student_id").eq("status", "pendente").then(function(res){
    if (res.error){ console.error("help_requests: falhou a contagem de pendentes", res.error); return null; }
    var map = {};
    (res.data || []).forEach(function(r){ map[r.student_id] = (map[r.student_id] || 0) + 1; });
    return map;
  }, function(err){ console.error("help_requests: falhou a contagem de pendentes", err); return null; });
}
function pendingHelpFor(studentId){ if (!HELP_REQUESTS_ENABLED) return 0; return (state.pendingHelp && state.pendingHelp[studentId]) || 0; }
function refreshPendingHelp(){
  if (!HELP_REQUESTS_ENABLED) return Promise.resolve();
  return loadPendingHelpCounts().then(function(map){
    if (map && JSON.stringify(map) !== JSON.stringify(state.pendingHelp || {})){ state.pendingHelp = map; updatePendingBadges(); }
  });
}
// atualiza os indicadores sem redesenhar o que o profissional está a escrever; a lista de alunos (sem campos) redesenha-se
function updatePendingBadges(){
  if (state.mode !== "pro") return;
  if (state.proSelectedId){
    var n = pendingHelpFor(state.proSelectedId);
    proRoot.querySelectorAll("[data-sub=\"pedidos\"]").forEach(function(b){ b.textContent = "Pedidos" + (n ? " (" + n + ")" : ""); });
    proRoot.querySelectorAll("[data-g=\"resumo\"]").forEach(function(b){ b.classList.toggle("has-pending", n > 0); });
  } else if (state.proView === "dashboard" && proRoot.querySelector(".pro-stat-row")){
    renderProDashboardMain();
  }
}

function markHelpRequestHandled(requestId){
  return sb.from("help_requests").update({status:"tratado"}).eq("id", requestId);
}

function saveHelpRequestNote(requestId, professionalNote){
  return sb.from("help_request_notes").upsert({request_id: requestId, professional_note: professionalNote});
}

/* ---------- Camada de decisão: que ações fazem sentido para esta refeição, dado o perfil de flexibilidade ---------- */
function getAvailableActions(s, m){
  var profile = computeFlexibilityProfile(s);
  var actions = [{action:"complete", enabled:true}];
  if (profile.substitutionsEnabled && m.foods.some(function(f){ return f.group; })) actions.push({action:"substitute", enabled:true});
  if (profile.freeMealEnabled && !mealCountsToday(m)) actions.push({action:"adapt", enabled:true});
  if (!m.done) actions.push({action:"reschedule", enabled:true});
  if (!m.done && m.status !== "skipped") actions.push({action:"skip", enabled:true});
  if (mealHasRevertible(m)) actions.push({action:"revert", enabled:true});
  return actions;
}

function shouldNotifyForMeal(m){
  if (m.status === "skipped") return false;
  if (mealCountsToday(m)) return false;
  return true;
}

function isTrainingDayToday(s){
  if (!s.trainingDays || !s.trainingDays.length) return null; // lista vazia = dias por definir, nao "descanso" todos os dias
  return s.trainingDays.indexOf(new Date().getDay()) !== -1;
}

// Fase 23: mensagens mais compridas (ex.: listas de alimentos não
// reconhecidos) precisam de mais tempo para se lerem — 1800ms fixos
// chegavam para "Alimento removido" mas não para uma frase inteira. A
// caixa também deixou de ser "nowrap": num ecrã estreito, uma mensagem
// comprida centrada sem quebra de linha esticava para lá dos dois lados
// do ecrã (ver .toast, agora com max-width e quebra de linha normal).
function showToast(msg){
  var t = document.createElement("div");
  t.className = "toast" + (typeof modalRoot !== "undefined" && modalRoot && modalRoot.firstChild ? " toast-top" : "");   // com uma janela aberta, não tapa os botões dela
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(function(){ t.classList.add("show"); });
  var duration = Math.max(1800, Math.min(6000, msg.length * 60));
  setTimeout(function(){
    t.classList.remove("show");
    setTimeout(function(){ t.remove(); }, 300);
  }, duration);
}

function food(name, qty, group, required){ return {name:name, qty:qty, group:group, required: required!==false}; }

/* ---------- Auditoria (Fase 8): o que optionsFor() efetivamente filtra ----------
   Só blockedFoods — a lista concreta que o profissional define, comparada por
   nome exato (case-insensitive) contra a FOOD_DB. allergies/avoid/dislikes NÃO
   são lidos aqui nem em nenhuma outra função de seleção de alternativas
   (computeEquivalentAlternative só calcula quantidade equivalente). São campos
   de texto livre do perfil, só mostrados ao profissional em tplProPerfil —
   nunca convertidos automaticamente em bloqueios. Fazer essa conversão sem um
   mapeamento estruturado seria uma inferência não auditável sobre saúde, que a
   Fase 8 explicitamente proíbe. blockedFoods continua obrigatório para todos
   os alunos, mapeados ou não — é a única lista com garantia de segurança. Ver
   hasUnmappedDietaryRisk() para a diferença entre os dois casos. */
function optionsFor(f, s){
  var base = (f.allowedSubs && f.allowedSubs.length) ? f.allowedSubs : (FOOD_GROUPS[resolveGroup(f.group)] || []);
  var blocked = s && s.blockedFoods && s.blockedFoods.length ? s.blockedFoods.map(function(n){ return n.toLowerCase(); }) : null;
  if (!blocked) return base;
  return base.filter(function(o){ return blocked.indexOf(o.name.toLowerCase()) === -1; });
}

// true quando o aluno tem alergias/restrições registadas em texto livre que
// optionsFor() não consegue traduzir em bloqueios concretos. Não tenta
// adivinhar QUAIS alimentos evitar — sinaliza que existe um risco não coberto.
// Diferença fundamental entre os dois tipos de restrição:
//   - blockedFoods (mapeado pelo profissional para alimentos concretos):
//     permite alternativas seguras — optionsFor() filtra-os sempre, para
//     todos os alunos, com ou sem risco não mapeado.
//   - allergies/avoid (texto livre, sem mapeamento): BLOQUEIA recomendações
//     de alimentos até o profissional os mapear para blockedFoods. Nenhuma
//     função de sugestão de alimentos pode mostrar alternativas enquanto
//     isto for verdadeiro — ver DIET_RISK_SAFE_MESSAGE e renderDietRiskBlocked().
function hasUnmappedDietaryRisk(s){
  return !!(s && ((s.allergies && s.allergies.length) || (s.avoid && s.avoid.length)));
}

// Mensagem exata mostrada sempre que uma sugestão de alimentos é bloqueada por
// hasUnmappedDietaryRisk(s) — mantida como constante única para garantir que o
// texto é sempre igual em todos os pontos onde isto acontece.
var DIET_RISK_SAFE_MESSAGE = "Tens restrições registadas. Para garantir uma alternativa segura, pede ajuda ao teu profissional.";

// Renderiza, dentro de um sheet de modal já aberto, o ecrã de segurança que
// substitui QUALQUER sugestão de alimentos quando hasUnmappedDietaryRisk(s) é
// verdadeiro. Não lista alternativas, não mostra o construtor de refeições,
// não dá dicas de restaurante — só a mensagem e a única ação permitida que
// pode envolver comida: pedir ajuda ao profissional (que não é uma sugestão,
// é um pedido). Consultar o plano e reagendar continuam disponíveis fora
// deste ecrã, por não recomendarem nenhum alimento.
function renderDietRiskBlocked(sheet, s, meal, situation, note){
  var html = "<div class=\"mtitle\">Restrição registada</div>" +
    "<p class=\"muted-p\" style=\"margin-bottom:14px;\">" + escapeHtml(DIET_RISK_SAFE_MESSAGE) + "</p>" +
    (HELP_REQUESTS_ENABLED ? "<button type=\"button\" class=\"btn primary\" id=\"askProRisk\" style=\"width:100%;\">Pedir ajuda ao profissional</button>" : "<p class=\"muted-p\">" + HELP_OFF_MSG + "</p>");
  sheet.innerHTML = "<div class=\"mclose\"><button type=\"button\" aria-label=\"Fechar\">✕</button></div>" + html;
  sheet.querySelector(".mclose button").addEventListener("click", closeModal);
  var askRisk = sheet.querySelector("#askProRisk");
  if (askRisk) askRisk.addEventListener("click", function(){
    createHelpRequest(s, meal, situation, note || "Aluno tem alergias/restrições registadas — pedido de alternativa segura.");
    showToast("O teu profissional vai ver este pedido");
    closeModal();
  });
}

/* ---------- Perfil de flexibilidade: score é o valor principal, mas cada dimensão pode ser personalizada ---------- */
var FLEX_PRESET_DEFAULTS = {
  estruturado: { mealStructure:"high", foodChoice:"low", substitutionLevel:"low", mealBuilderEnabled:false, substitutionsEnabled:true, restaurantAdaptation:true, freeMealEnabled:false, macroTargetsVisible:false, calorieTargetsVisible:true },
  equilibrado: { mealStructure:"medium", foodChoice:"medium", substitutionLevel:"medium", mealBuilderEnabled:false, substitutionsEnabled:true, restaurantAdaptation:true, freeMealEnabled:true, macroTargetsVisible:false, calorieTargetsVisible:true },
  flexivel:    { mealStructure:"low", foodChoice:"high", substitutionLevel:"high", mealBuilderEnabled:true, substitutionsEnabled:true, restaurantAdaptation:true, freeMealEnabled:true, macroTargetsVisible:true, calorieTargetsVisible:true }
};
var SUBSTITUTION_LEVEL_MAX = { low:2, medium:4, high:Infinity };

function computeFlexibilityProfile(s){
  var preset = flexTier(s.flexibility);
  var base = FLEX_PRESET_DEFAULTS[preset];
  var overrides = s.flexOverrides || {};
  var profile = {};
  Object.keys(base).forEach(function(k){
    profile[k] = overrides[k] !== undefined ? overrides[k] : base[k];
  });
  profile.score = s.flexibility;
  profile.preset = preset;
  return profile;
}

/* ---------- Grupos de alimentos: compatibilidade com a taxonomia antiga ----------
   Fase 29: os 5 grupos antigos (protein/carb/veg/fat/fruit) deram lugar a 7
   grupos novos, mais úteis para o profissional organizar o dia-a-dia. Planos
   já guardados (na base de dados, em meals JSONB) podem ter f.group com uma
   chave antiga — resolveGroup() traduz para a chave nova equivalente em
   qualquer sítio que leia FOOD_GROUPS/GROUP_LABELS/GROUP_PRIORITY_KEY por
   f.group, para nunca perder alternativas/rótulos de um plano antigo só
   porque ainda não foi reaberto/gravado de novo. */
var OLD_GROUP_ALIASES = { protein:"carnes", carb:"cereais", veg:"vegetais", fat:"gorduras", fruit:"fruta" };
function resolveGroup(g){ return (g && FOOD_GROUPS[g]) ? g : (OLD_GROUP_ALIASES[g] || g); }

/* ---------- Equivalência nutricional para substituições ---------- */
var GROUP_PRIORITY_KEY = { carnes:"p", cereais:"c", gorduras:"f" };
var PRIORITY_LABEL = { p:"proteína", c:"hidratos", f:"gordura" };

// mode "kcal": iguala as calorias da linha (em vez do macro prioritário do grupo). Nos grupos sem macro prioritário
// (lacticínios, fruta, vegetais, snacks, bebidas) iguala sempre as calorias, para a troca não mudar o total da refeição.
function computeEquivalentAlternative(original, altBase, mode){
  var priorityKey = mode === "kcal" ? "kcal" : (GROUP_PRIORITY_KEY[resolveGroup(original.group)] || "kcal");
  var altDb = FOOD_DB[altBase.name];
  if (!altDb) return altBase;
  if (priorityKey === "kcal" && parseQtyAmount(original.qty).kind === "fixed") return altBase; // "à vontade" não se converte em gramas

  var originalNutri = foodNutrition(original.name, original.qty);
  var targetVal = originalNutri[priorityKey];
  if (!targetVal || targetVal <= 0) return altBase;

  if (altDb.per === "100g"){
    var perGram = altDb[priorityKey] / 100;
    if (perGram <= 0) return altBase;
    var grams = Math.max(10, Math.min(400, Math.round((targetVal/perGram)/5)*5));
    return { name: altBase.name, qty: grams + " g" };
  }
  if (altDb.per === "unit"){
    var perUnit = altDb[priorityKey];
    if (perUnit <= 0) return altBase;
    var units = Math.max(1, Math.round(targetVal/perUnit));
    return { name: altBase.name, qty: units + " unid." };
  }
  return altBase;
}

// Quão diferente é a alternativa (já na porção equivalente): calorias que "mudam de macro" + diferença de calorias, em fração das calorias da linha. Menor = mais parecida.
function substitutionDistance(original, alt){
  var a = foodNutrition(original.name, original.qty), b = foodNutrition(alt.name, alt.qty);
  var base = Math.max(a.kcal, 50);
  return (Math.abs(a.p - b.p) * 4 + Math.abs(a.c - b.c) * 4 + Math.abs(a.f - b.f) * 9 + Math.abs(a.kcal - b.kcal)) / base;
}
// "≈ 152 kcal (+3)" — calorias da alternativa na porção sugerida e diferença face ao alimento original
function substitutionKcalNote(original, alt){
  var a = Math.round(foodNutrition(original.name, original.qty).kcal), b = Math.round(foodNutrition(alt.name, alt.qty).kcal);
  if (!a && !b) return "";
  var d = b - a;
  return "≈ " + b + " kcal" + (d ? " (" + (d > 0 ? "+" : "−") + Math.abs(d) + ")" : "");
}

function logSubstitution(s, meal, from, to){
  if (!s.substitutionHistory) s.substitutionHistory = [];
  var now = new Date();
  s.substitutionHistory.push({
    date: todayISO(),
    time: String(now.getHours()).padStart(2,"0") + ":" + String(now.getMinutes()).padStart(2,"0"),
    meal: meal.name, from: from.name, fromQty: from.qty, to: to.name, toQty: to.qty
  });
}

function applySubstitution(s, meal, foodIdx, chosen){
  var f = meal.foods[foodIdx];
  var orig = f.original || {name:f.name, qty:f.qty};
  logSubstitution(s, meal, f, chosen);
  logAdaptation(s, meal, "substituicao", {from:f.name, fromQty:f.qty, to:chosen.name, toQty:chosen.qty});
  meal.foods[foodIdx] = {name:chosen.name, qty:chosen.qty, group:f.group, required:f.required, original:orig};
  meal.adapted = true;
}

function revertMeal(meal){
  meal.foods.forEach(function(f){
    if (f.original){ f.name = f.original.name; f.qty = f.original.qty; delete f.original; }
  });
  meal.adapted = false;
}

function mealHasRevertible(meal){
  return meal.foods.some(function(f){ return f.original; });
}

// Fase 21: pedido explícito — "tudo que seja bebidas quero em mililitros".
// Nenhum alimento tem "ml" gravado (a base do INSA, Fase 16, deu "100 g" a
// tudo sem distinção), por isso reconhece bebidas pelo NOME (heurística,
// nunca perfeita) em vez de por um campo próprio. Não muda o valor
// nutricional nem o arredondamento — só a etiqueta da unidade, já que a app
// trata 1 ml ≈ 1 g desde sempre (ver parseQtyAmount). Exclui explicitamente
// formas secas/em pó/em grão, que continuam em gramas.
// JS "\b" só reconhece [A-Za-z0-9_] como carácter de palavra — falha nas
// fronteiras junto a acentos (ex.: "\bágua\b" nunca acerta em "água", porque
// nem "á" nem o início da string contam como "palavra" para o \b nativo).
// Por isso a fronteira é feita à mão aqui, incluindo à-ÿ como carácter de
// palavra — o mesmo truque já usado em draftPlanFromDailyText.
function accentSafeWordRegex(innerPattern){
  return new RegExp("(^|[^a-zà-ÿ])(?:" + innerPattern + ")([^a-zà-ÿ]|$)", "i");
}
var BEVERAGE_NAME_SOURCES = [
  "água", "leite", "sumo", "n[ée]ctar", "refrigerante", "cerveja", "vinho", "licor",
  "aguardente", "whisky", "vodka", "gin", "rum", "ch[áa]", "caf[ée]", "capuccino",
  "cappuccino", "batido", "smoothie", "gasosa", "cola", "bebida", "kefir", "iogurte\\s+l[íi]quido"
];
var BEVERAGE_EXCLUDE_SOURCES = [
  "em\\s*p[óo]", "seco", "seca", "liofilizad[oa]", "desidratad[oa]", "mo[íi]d[oa]", "gr[ãa]os?"
];
function isBeverage(name){
  var lower = (name || "").toLowerCase();
  if (BEVERAGE_EXCLUDE_SOURCES.some(function(src){ return accentSafeWordRegex(src).test(lower); })) return false;
  return BEVERAGE_NAME_SOURCES.some(function(src){ return accentSafeWordRegex(src).test(lower); });
}
function qtyStringWithBeverageUnit(name, qty){
  if (isBeverage(name) && / g$/i.test(qty)) return qty.replace(/ g$/i, " ml");
  return qty;
}
(function normalizeBeverageDefaultQuantities(){
  Object.keys(FOOD_GROUPS).forEach(function(g){
    FOOD_GROUPS[g].forEach(function(o){ o.qty = qtyStringWithBeverageUnit(o.name, o.qty); });
  });
})();

/* ---------- Base de alimentos: fonte única de verdade nutricional ---------- */
var FOOD_DB = {
  // Fase 29 (continuação) — produtos de marca (marca própria e de
  // fabricante) dos principais supermercados portugueses, via Open Food
  // Facts, verificados e traduzidos à mão um a um antes de entrar aqui.
  "Pão de forma 100% integral (Mercadona)": {per:"100g", kcal:250, p:11.3, c:36, f:4.8},
  "Pão de forma com sementes e pevides (Hacendado)": {per:"100g", kcal:290.2, p:11, c:38, f:9.3},
  "Pão de forma branco (Hacendado)": {per:"100g", kcal:250, p:9, c:46, f:2.7},
  "Penne Rigate (Barilla)": {per:"100g", kcal:359, p:13, c:71, f:2},
  "Esparguete integral (Milaneza)": {per:"100g", kcal:348, p:13, c:66, f:1.7},
  "Esparguete (Milaneza)": {per:"100g", kcal:359, p:13, c:71, f:1.8},
  "Fusilli de trigo integral (Continente)": {per:"100g", kcal:135, p:4.4, c:26, f:0.8},
  "Esparguete de trigo integral (Continente)": {per:"100g", kcal:135, p:4.4, c:26, f:1.6},
  "Arroz integral longo (Hacendado)": {per:"100g", kcal:350, p:7.6, c:72, f:2.8},
  "Arroz basmati (Hacendado)": {per:"100g", kcal:355, p:9, c:78, f:0.6},
  "Arroz carolino (Continente)": {per:"100g", kcal:350, p:6.8, c:78, f:1.1},
  "Arroz vaporizado (Continente)": {per:"100g", kcal:355, p:7.5, c:78, f:1},
  "Arroz basmati (Pingo Doce)": {per:"100g", kcal:361, p:7.7, c:79, f:1},
  "Arroz integral (Pingo Doce)": {per:"100g", kcal:349, p:7, c:71, f:3.2},
  "Flocos de aveia extra suaves (Brüggen)": {per:"100g", kcal:375, p:14, c:59, f:7},
  "Muesli crocante (Mercadona)": {per:"100g", kcal:401, p:8.8, c:52, f:12},
  "Farinha fina de milho (Hacendado)": {per:"100g", kcal:359, p:0.3, c:90, f:0.5},
  "Farinha de milho branco pré-cozida (Hacendado)": {per:"100g", kcal:357, p:9.2, c:75, f:1.6},
  "Farinha branca de neve fina (Branca de Neve)": {per:"100g", kcal:349, p:9, c:74, f:1.2},
  "Farinha de aveia integral (Seara)": {per:"100g", kcal:370, p:14, c:56, f:7.6},
  "Farinha de trigo tipo 55 sem fermento (Pingo Doce)": {per:"100g", kcal:363, p:10, c:76, f:1.3},
  "Iogurte grego natural ligeiro (Continente Equilíbrio)": {per:"100g", kcal:55, p:5.3, c:3.9, f:2},
  "Iogurte grego natural (Oikos)": {per:"100g", kcal:62.7, p:3.4, c:4.4, f:7},
  "Iogurte proteico de baunilha (YoPro Danone)": {per:"100g", kcal:53.3, p:9.4, c:3.6, f:0.1},
  "Iogurte proteico de mirtilo (YoPro Danone)": {per:"100g", kcal:54, p:9.4, c:3.7, f:0.1},
  "Queijo fresco longa duração light (Continente Equilíbrio)": {per:"100g", kcal:101, p:11, c:4.9, f:4},
  "Queijo fresco light (Hacendado)": {per:"100g", kcal:99, p:11, c:4.4, f:4}, // embalagem de 2 unidades fechadas (125 g: 2 x 62,5 g) // 4 unidades de 62,5 g fechadas individualmente (250 g) // copo de 120 g = 11 g de proteína; EAN 8410500030865
  "Iogurte proteico com manga e maracujá 0% (Mercadona)": {per:"100g", kcal:56.7, p:8.3, c:5.8, f:0.2},
  "Iogurte com frutos do bosque (Mercadona)": {per:"100g", kcal:98, p:3.7, c:13.7, f:3.2},
  "Iogurte 0% com fruta (Mercadona)": {per:"100g", kcal:45, p:4.5, c:6.5, f:0.1},
  "Ricotta (Mercadona)": {per:"100g", kcal:179, p:9.7, c:3.8, f:14},
  "Mozzarella (Hacendado)": {per:"100g", kcal:202.4, p:17, c:2, f:14},
  "Grana Padano (Hacendado)": {per:"100g", kcal:398, p:33, c:0, f:29},
  "Queijo feta (Mercadona)": {per:"100g", kcal:276.7, p:16, c:1, f:23.2},
  "Queijo creme suave (Mercadona)": {per:"100g", kcal:244, p:4.2, c:3.7, f:23},
  "Leite meio-gordo (Mimosa)": {per:"100g", kcal:48, p:3.4, c:4.9, f:1.6},
  "Leite meio-gordo (Continente)": {per:"100g", kcal:48, p:3.4, c:4.9, f:1.6},
  "Leite magro (Continente Equilíbrio)": {per:"100g", kcal:35, p:3.5, c:5, f:0.1},
  "Leite meio-gordo UHT (Pingo Doce)": {per:"100g", kcal:49, p:3.4, c:5.3, f:1.6},
  "Leite gordo (Mimosa)": {per:"100g", kcal:63.2, p:3.2, c:4.7, f:3.5},
  "Leite meio-gordo sem lactose (Mimosa)": {per:"100g", kcal:47, p:3.3, c:4.9, f:1.6},
  "Bebida de aveia (Liquats Vegetals)": {per:"100g", kcal:47, p:1.6, c:8.2, f:0.7},
  "Bebida de soja (Mercadona)": {per:"100g", kcal:35, p:3.4, c:0.8, f:1.9},
  "Água de coco (Mercadona)": {per:"100g", kcal:20, p:0, c:5, f:0},
  "Peito de peru fatiado (Continente)": {per:"100g", kcal:92.3, p:13, c:4.7, f:2.3},
  "Salsichas tipo Frankfurt (Nobre)": {per:"100g", kcal:156, p:10, c:4.2, f:11},
  "Peito de frango fatias finas (Campofrio)": {per:"100g", kcal:83, p:14, c:3.8, f:1.3},
  "Bacon em tiras fumado (Dulano)": {per:"100g", kcal:278, p:15, c:0.5, f:24},
  "Fiambre de frango (Monells)": {per:"100g", kcal:156, p:11, c:10, f:8},
  "Salsichas de aves (Continente)": {per:"100g", kcal:151, p:10, c:4, f:11},
  "Bacon fumado (Continente)": {per:"100g", kcal:259, p:17, c:0.6, f:21},
  "Fiambre da pá (Pingo Doce)": {per:"100g", kcal:98, p:14, c:1.4, f:4},
  "Asas de frango crocantes (PorSi)": {per:"100g", kcal:163, p:16, c:2, f:10},
  "Peito de peru (Dia)": {per:"100g", kcal:88, p:15.5, c:2, f:2},
  "Bife de frango (Pingo Doce)": {per:"100g", kcal:98, p:23.6, c:0, f:0.4},
  "Sardinhas portuguesas em azeite (Ramirez)": {per:"100g", kcal:258, p:22.2, c:0, f:18.8},
  "Atum posta ao natural (Pingo Doce)": {per:"100g", kcal:100.9, p:23, c:0, f:0.7},
  "Atum posta em óleo de girassol (Pingo Doce)": {per:"100g", kcal:200, p:25, c:0, f:11},
  "Sardinha enlatada em azeite (Continente)": {per:"100g", kcal:212, p:23, c:0.5, f:13},
  "Varinhas de pescada (Ocean Sea)": {per:"100g", kcal:185, p:11.4, c:16, f:8.1},
  "Fatias de presunto (Nobre)": {per:"100g", kcal:212, p:30, c:0.5, f:10},
  "Ovos frescos classe M (Pingo Doce)": {per:"100g", kcal:131, p:13, c:1, f:8.3},
  "Ovos frescos (Continente)": {per:"100g", kcal:141, p:12, c:0.7, f:10},
  "Clara de ovo (Continente)": {per:"100g", kcal:47, p:11, c:0.7, f:0.2},
  "Ameixas secas sem caroço (Mercadona)": {per:"100g", kcal:240, p:2.2, c:57, f:0.4},
  "Tâmaras secas sem caroço (Mercadona)": {per:"100g", kcal:298, p:2, c:76.4, f:0.5},
  "Tâmara seca (Continente)": {per:"100g", kcal:321, p:2.3, c:74, f:0.1},
  "Tâmara seca com caroço (Pingo Doce)": {per:"100g", kcal:321, p:0.1, c:73.8, f:0.1},
  "Bagas goji secas (Bio)": {per:"100g", kcal:328, p:13, c:66, f:1.2},
  "Mirtilos (Pingo Doce)": {per:"100g", kcal:52, p:0.7, c:11, f:0},
  "Mistura de frutos vermelhos secos (Origens)": {per:"100g", kcal:44, p:0.4, c:9, f:0.2},
  "Tomate pelado em pedaços (Hacendado)": {per:"100g", kcal:31, p:1.1, c:6, f:0.1},
  "Cenouras (Continente)": {per:"100g", kcal:25, p:0.6, c:4.4, f:0},
  "Polpa de tomate (Pingo Doce)": {per:"100g", kcal:37, p:1.7, c:6.3, f:0.2},
  "Polpa de tomate (Continente)": {per:"100g", kcal:38, p:1.8, c:6.6, f:0.5},
  "Tomate em pedaços (Pingo Doce)": {per:"100g", kcal:25, p:0.6, c:2.8, f:0.8},
  "Feijão verde (Compal)": {per:"100g", kcal:14, p:0.9, c:1.8, f:0.5},
  "Tomate pelado inteiro (Pingo Doce)": {per:"100g", kcal:18, p:0.7, c:2.7, f:0.1},
  "Pimentos assados vermelhos e verdes (Hacendado)": {per:"100g", kcal:30, p:1, c:5.2, f:0.7},
  "Azeite virgem extra (Hacendado)": {per:"100g", kcal:824, p:0, c:0, f:91},
  "Azeite virgem extra (Pingo Doce)": {per:"100g", kcal:819, p:0, c:0, f:91},
  "Azeite (Oliveira da Serra)": {per:"100g", kcal:822, p:0, c:0, f:91},
  "Azeite Gallo (Gallo)": {per:"100g", kcal:819, p:0, c:0, f:91},
  "Azeite (Continente)": {per:"100g", kcal:821, p:0, c:0, f:91.2},
  "Azeite virgem extra (Herdade do Esporão)": {per:"100g", kcal:821, p:0, c:0, f:91.2},
  "Óleo de coco virgem (Mercadona)": {per:"100g", kcal:900, p:0, c:0, f:100},
  "Óleo de girassol (Fula)": {per:"100g", kcal:826, p:0, c:0, f:92},
  "Óleo alimentar (Pingo Doce)": {per:"100g", kcal:828, p:0, c:0, f:92},
  "Creme vegetal para barrar (Pingo Doce)": {per:"100g", kcal:450, p:0, c:0, f:50},
  "Creme vegetal para barrar (Continente)": {per:"100g", kcal:450, p:0, c:0, f:50},
  "Margarina vegetal (Vaqueiro)": {per:"100g", kcal:677, p:0.5, c:0.5, f:75},
  "Nutella — creme de avelã e cacau (Nutella)": {per:"100g", kcal:539, p:6.3, c:57.5, f:30.9},
  "Manteiga de amendoim 100% (Mercadona)": {per:"100g", kcal:606.7, p:30, c:12, f:46.7},
  "Guacamole (Mercadona)": {per:"100g", kcal:149, p:1.9, c:2, f:13.7},
  "Hummus clássico (Hacendado)": {per:"100g", kcal:311, p:6, c:11.1, f:25.8},
  "Manteiga de amendoim cremosa (Maribel)": {per:"100g", kcal:646.7, p:27, c:10, f:53},
  "Manteiga tradicional com sal (Mimosa)": {per:"100g", kcal:743, p:0.6, c:0.7, f:82},
  "Nozes (Dia)": {per:"100g", kcal:674, p:19.9, c:3.8, f:62.4},
  "Caju (Continente)": {per:"100g", kcal:619, p:23, c:18.2, f:48.8},
  "Noz em metades (Continente)": {per:"100g", kcal:716, p:15, c:14, f:65},
  "Nuggets de frango (Mercadona)": {per:"100g", kcal:230, p:10.4, c:16.6, f:13.4},
  "Pringles original (Pringles)": {per:"100g", kcal:528, p:6.2, c:54, f:31},
  "Sumol de laranja (Sumol)": {per:"100g", kcal:30, p:0.0, c:7.5, f:0},
  "Guaraná Antarctica (Guaraná Antarctica)": {per:"100g", kcal:40, p:0.0, c:10, f:0.0},
  "Coca-Cola original (Coca-Cola)": {per:"100g", kcal:42, p:0, c:10.6, f:0},
  "Coca-Cola zero (Coca-Cola)": {per:"100g", kcal:0.3, p:0, c:0, f:0},
  "Chocolate de leite (Milka)": {per:"100g", kcal:539, p:6.5, c:57, f:31},
  "Chocolate negro 72% (Mercadona)": {per:"100g", kcal:568, p:10, c:32, f:42},
  "Toblerone (Mondelez)": {per:"100g", kcal:535, p:5.6, c:60.5, f:29.5},
  "Bolachas Nutella de avelã e cacau (Ferrero)": {per:"100g", kcal:515, p:7.9, c:64, f:24.8},
  "Bolacha Maria 100% integral (Mercadona)": {per:"100g", kcal:410, p:8.7, c:66, f:10},
  "Digestive de aveia (Mercadona)": {per:"100g", kcal:477, p:7.5, c:61, f:21},
  "Batatas fritas ao forno com sal (Lay's)": {per:"100g", kcal:442, p:5.9, c:73, f:13},
  "Batatas fritas originais (Lay's)": {per:"100g", kcal:520, p:6.2, c:53.3, f:31.1},
  "Rebuçados de eucalipto e mentol 0% açúcar (Hacendado)": {per:"100g", kcal:250, p:0.7, c:97, f:0},
  "Sortido de gomas (Pingo Doce)": {per:"100g", kcal:315, p:4.1, c:74.7, f:0.1},
  "Compota de morango 0% açúcar (Mercadona)": {per:"100g", kcal:40, p:0.6, c:11.5, f:0},
  "Frango (peito)": {per:"100g", kcal:165, p:31, c:0, f:3.6},
  "Peru (fatiado)": {per:"100g", kcal:135, p:30, c:1, f:1},
  "Pescada": {per:"100g", kcal:90, p:18, c:0, f:1.5},
  "Atum (natural)": {per:"100g", kcal:116, p:26, c:0, f:1},
  "Carne vermelha magra": {per:"100g", kcal:182, p:27, c:0, f:8},
  "Carne magra": {per:"100g", kcal:182, p:27, c:0, f:8},
  "Tofu": {per:"100g", kcal:76, p:8, c:1.9, f:4.8},
  "Iogurte grego natural": {per:"100g", kcal:97, p:9, c:4, f:5},
  "Iogurte skyr natural": {per:"100g", kcal:63, p:11, c:4, f:0.2},
  "Iogurte proteico": {per:"100g", kcal:55, p:10, c:4, f:0.2},
  "Arroz (cozido)": {per:"100g", kcal:130, p:2.7, c:28, f:0.3},
  "Massa (cozida)": {per:"100g", kcal:131, p:5, c:25, f:1.1},
  "Batata": {per:"100g", kcal:87, p:2, c:20, f:0.1},
  "Batata-doce": {per:"100g", kcal:90, p:2, c:21, f:0.1},
  "Pão integral": {per:"100g", kcal:247, p:13, c:41, f:4.2},
  "Couscous (cozido)": {per:"100g", kcal:112, p:3.8, c:23, f:0.2},
  "Quinoa (cozida)": {per:"100g", kcal:120, p:4.4, c:21, f:1.9},
  "Aveia": {per:"100g", kcal:389, p:17, c:66, f:7},
  "Azeite": {per:"100g", kcal:884, p:0, c:0, f:100},
  "Abacate": {per:"100g", kcal:160, p:2, c:9, f:15},
  "Frutos secos": {per:"100g", kcal:607, p:20, c:21, f:54},
  "Manteiga de amendoim": {per:"100g", kcal:588, p:25, c:20, f:50},
  "Maçã": {per:"unit", kcal:95, p:0.5, c:25, f:0.3},
  "Banana": {per:"unit", kcal:105, p:1.3, c:27, f:0.4},
  "Laranja": {per:"unit", kcal:62, p:1.2, c:15, f:0.2},
  "Mirtilos": {per:"100g", kcal:57, p:0.7, c:14, f:0.3},
  "Ovos": {per:"unit", kcal:78, p:6.3, c:0.6, f:5.3},
  // Fase 23: pedido explícito — "à vontade" deixa de existir, todos os
  // alimentos passam a ter uma quantidade real (per:"100g"), tal como
  // qualquer outro alimento da base. Valores atualizados para os reais do
  // INSA (crus) onde existe equivalente direto; "Salada mista" não tem um
  // prato único correspondente no INSA, mantém a estimativa já usada
  // antes, só reinterpretada como valor por 100g em vez de nominal fixo.
  "Brócolos": {per:"100g", kcal:32, p:3.4, c:1.5, f:0.8},
  "Salada mista": {per:"100g", kcal:25, p:1.5, c:3, f:0.2},
  "Cenoura": {per:"100g", kcal:25, p:0.6, c:4.4, f:0.0},
  "Courgette": {per:"100g", kcal:19, p:1.6, c:2.0, f:0.3},
  "Espinafres": {per:"100g", kcal:27, p:2.6, c:0.8, f:0.9},
  "Fruta": {per:"unit", kcal:80, p:0.6, c:20, f:0.3},

  // ===================== Fase 16: base alargada do INSA =====================
  // Tabela da Composição de Alimentos do INSA (Instituto Nacional de Saúde
  // Doutor Ricardo Jorge), fonte pública oficial: https://portfir.insa.min-saude.pt/
  // Descarregada em 2026-09-29 (v7.1). Valores por 100g de parte edível,
  // exceto bebidas alcoólicas (100ml). "Iogurte grego natural" e "Banana" da
  // tabela original acima mantêm-se por serem usados como per:"unit" em
  // planos existentes — os equivalentes do INSA (per:"100g") foram omitidos
  // para não haver conflito de nome com semânticas de quantidade diferentes.
  "Abacate, Hass": {per:"100g", kcal:176, p:1.1, c:2.3, f:17.4},
  "Abóbora cristalizada": {per:"100g", kcal:293, p:0.0, c:72.4, f:0.2},
  "Abóbora crua": {per:"100g", kcal:11, p:0.3, c:1.7, f:0.2},
  "Abrótea cozida": {per:"100g", kcal:79, p:19.4, c:0.0, f:0.1},
  "Abrótea crua": {per:"100g", kcal:70, p:17.2, c:0.0, f:0.1},
  "Açafrão": {per:"100g", kcal:353, p:11.4, c:61.5, f:5.9},
  "Açafrão-da-índia seco": {per:"100g", kcal:312, p:6.7, c:44.1, f:7.0},
  "Acelga crua": {per:"100g", kcal:23, p:1.8, c:2.7, f:0.2},
  "Achocolatado com alto teor de gordura, pó": {per:"100g", kcal:428, p:12.0, c:70.6, f:10.6},
  "Achocolatado com baixo teor de gordura, pó": {per:"100g", kcal:395, p:6.5, c:86.2, f:2.5},
  "Açorda": {per:"100g", kcal:104, p:3.3, c:13.1, f:4.0},
  "Açorda à alentejana": {per:"100g", kcal:95, p:3.5, c:12.3, f:3.3},
  "Açorda de bacalhau": {per:"100g", kcal:69, p:3.4, c:5.7, f:3.5},
  "Açorda de marisco": {per:"100g", kcal:51, p:4.5, c:5.4, f:1.2},
  "Açorda de ovo": {per:"100g", kcal:108, p:3.6, c:14.0, f:4.0},
  "Açúcar amarelo": {per:"100g", kcal:390, p:0.0, c:97.5, f:0.0},
  "Açúcar branco": {per:"100g", kcal:397, p:0.0, c:99.3, f:0.0},
  "Agrião cru": {per:"100g", kcal:29, p:3.4, c:0.4, f:0.9},
  "Aguardente": {per:"100g", kcal:308, p:0.0, c:0.0, f:0.0},
  "Aipo cru": {per:"100g", kcal:15, p:1.1, c:1.5, f:0.1},
  "Alcachofra cozida": {per:"100g", kcal:46, p:3.0, c:5.3, f:0.2},
  "Alcachofra crua": {per:"100g", kcal:51, p:3.0, c:6.8, f:0.2},
  "Alcaparras (picles)": {per:"100g", kcal:44, p:2.4, c:4.9, f:0.9},
  "Alecrim fresco": {per:"100g", kcal:115, p:1.4, c:13.5, f:4.4},
  "Alecrim seco": {per:"100g", kcal:377, p:4.9, c:46.4, f:15.2},
  "Alface": {per:"100g", kcal:12, p:0.9, c:1.5, f:0.0},
  "Alface roxa": {per:"100g", kcal:12, p:0.9, c:1.5, f:0.0},
  "Algas nori": {per:"100g", kcal:256, p:30.8, c:9.2, f:2.6},
  "Alheira cozida": {per:"100g", kcal:269, p:8.3, c:26.8, f:14.0},
  "Alheira crua": {per:"100g", kcal:309, p:8.3, c:27.4, f:18.1},
  "Alheira grelhada": {per:"100g", kcal:302, p:8.1, c:28.5, f:17.0},
  "Alho-francês cru": {per:"100g", kcal:26, p:1.8, c:2.9, f:0.3},
  "Alho cru": {per:"100g", kcal:72, p:3.8, c:11.3, f:0.6},
  "Alho em pó": {per:"100g", kcal:310, p:17.6, c:52.3, f:1.2},
  "Almôndegas de porco": {per:"100g", kcal:234, p:8.0, c:29.2, f:8.9},
  "Almôndegas de vaca": {per:"100g", kcal:252, p:17.0, c:6.4, f:17.4},
  "Almôndegas de vaca e porco": {per:"100g", kcal:243, p:19.2, c:3.8, f:16.7},
  "Alperce": {per:"100g", kcal:48, p:0.8, c:8.5, f:0.1},
  "Alperce seco": {per:"100g", kcal:242, p:5.4, c:41.2, f:0.9},
  "Alperce, conserva em calda de açúcar": {per:"100g", kcal:163, p:0.5, c:39.3, f:0.1},
  "Alternativa vegetal ao iogurte à base de coco, sem açúcar": {per:"100g", kcal:89, p:0.7, c:6.6, f:6.5},
  "Alternativa vegetal ao iogurte à base de soja": {per:"100g", kcal:59, p:3.0, c:5.9, f:2.4},
  "Amêijoa aberta ao natural sem sal": {per:"100g", kcal:131, p:23.4, c:5.2, f:1.8},
  "Amêijoa crua": {per:"100g", kcal:65, p:11.7, c:2.6, f:0.9},
  "Amêijoas à Bulhão Pato": {per:"100g", kcal:89, p:12.8, c:3.2, f:2.5},
  "Ameixa branca": {per:"100g", kcal:40, p:0.6, c:7.8, f:0.2},
  "Ameixa encarnada": {per:"100g", kcal:41, p:0.8, c:7.4, f:0.2},
  "Ameixa rainha Cláudia": {per:"100g", kcal:57, p:0.8, c:11.8, f:0.1},
  "Ameixa seca": {per:"100g", kcal:198, p:2.9, c:37.8, f:0.3},
  "Ameixa, conserva em calda de açúcar": {per:"100g", kcal:115, p:0.2, c:27.5, f:0.2},
  "Amêndoa, miolo, com pele": {per:"100g", kcal:643, p:21.6, c:7.2, f:56.0},
  "Amêndoa, miolo, torrada, sem pele": {per:"100g", kcal:650, p:21.6, c:7.1, f:56.8},
  "Amendoim, miolo": {per:"100g", kcal:589, p:25.4, c:10.1, f:47.7},
  "Amendoim, miolo, torrado com sal": {per:"100g", kcal:622, p:27.3, c:6.0, f:51.0},
  "Amendoim, miolo, torrado sem sal": {per:"100g", kcal:622, p:27.3, c:6.0, f:51.0},
  "Amora silvestre": {per:"100g", kcal:43, p:1.4, c:4.5, f:0.9},
  "Ananás": {per:"100g", kcal:42, p:0.5, c:8.6, f:0.0},
  "Ananás desidratado": {per:"100g", kcal:363, p:3.8, c:72.8, f:1.5},
  "Ananás, conserva em calda de açúcar": {per:"100g", kcal:98, p:0.5, c:23.2, f:0.0},
  "Anchova, conserva em óleo, escorrido": {per:"100g", kcal:191, p:25.2, c:0.0, f:10.0},
  "Anona": {per:"100g", kcal:82, p:1.7, c:16.8, f:0.4},
  "Anona desidratada": {per:"100g", kcal:351, p:7.2, c:71.6, f:1.7},
  "Arroz à valenciana": {per:"100g", kcal:111, p:7.6, c:7.7, f:5.3},
  "Arroz agulha cru": {per:"100g", kcal:347, p:6.7, c:78.1, f:0.4},
  "Arroz carolino branqueado cru": {per:"100g", kcal:357, p:7.4, c:79.6, f:0.5},
  "Arroz cozido simples": {per:"100g", kcal:125, p:2.5, c:28.0, f:0.2},
  "Arroz de bacalhau": {per:"100g", kcal:90, p:3.1, c:15.3, f:1.6},
  "Arroz de bacalhau com margarina": {per:"100g", kcal:91, p:5.4, c:12.2, f:2.1},
  "Arroz de cabidela": {per:"100g", kcal:105, p:9.4, c:12.2, f:1.9},
  "Arroz de cenoura com azeite": {per:"100g", kcal:127, p:1.8, c:19.9, f:4.2},
  "Arroz de ervilhas": {per:"100g", kcal:85, p:2.3, c:18.0, f:0.2},
  "Arroz de feijão": {per:"100g", kcal:139, p:3.1, c:20.8, f:4.4},
  "Arroz de frango": {per:"100g", kcal:205, p:8.4, c:25.2, f:7.6},
  "Arroz de frango com feijão e chouriço": {per:"100g", kcal:116, p:10.9, c:8.8, f:3.4},
  "Arroz de frango malandrinho à moda de Monção": {per:"100g", kcal:132, p:10.5, c:9.3, f:5.8},
  "Arroz de gambas": {per:"100g", kcal:94, p:6.9, c:8.8, f:3.4},
  "Arroz de lulas": {per:"100g", kcal:66, p:4.8, c:6.7, f:2.1},
  "Arroz de manteiga": {per:"100g", kcal:265, p:3.8, c:44.4, f:7.7},
  "Arroz de marisco": {per:"100g", kcal:72, p:6.5, c:8.2, f:1.4},
  "Arroz de pato": {per:"100g", kcal:115, p:10.8, c:8.4, f:4.2},
  "Arroz de peixe": {per:"100g", kcal:125, p:7.0, c:15.5, f:3.7},
  "Arroz de peixe com ervilhas": {per:"100g", kcal:110, p:4.9, c:19.8, f:0.8},
  "Arroz de polvo com azeite": {per:"100g", kcal:127, p:10.2, c:10.9, f:4.6},
  "Arroz de polvo com tomate": {per:"100g", kcal:128, p:5.7, c:10.0, f:7.1},
  "Arroz de polvo com tomate e vinho": {per:"100g", kcal:90, p:6.5, c:6.9, f:3.6},
  "Arroz de tamboril": {per:"100g", kcal:87, p:5.7, c:7.1, f:3.8},
  "Arroz de tamboril malandrinho": {per:"100g", kcal:67, p:5.9, c:10.0, f:0.2},
  "Arroz de tomate com azeite": {per:"100g", kcal:129, p:2.0, c:20.1, f:4.2},
  "Arroz de tomate com margarina": {per:"100g", kcal:122, p:2.0, c:20.2, f:3.4},
  "Arroz de tomate malandrinho": {per:"100g", kcal:132, p:1.9, c:16.8, f:6.0},
  "Arroz doce": {per:"100g", kcal:233, p:4.4, c:45.2, f:3.8},
  "Arroz integral cru": {per:"100g", kcal:351, p:8.6, c:71.6, f:2.5},
  "Atum conserva em óleo": {per:"100g", kcal:214, p:24.3, c:0.0, f:13.0},
  "Atum de cebolada": {per:"100g", kcal:135, p:9.0, c:2.6, f:9.0},
  "Atum fresco cru": {per:"100g", kcal:138, p:30.7, c:0.0, f:1.7},
  "Atum fresco grelhado": {per:"100g", kcal:166, p:28.4, c:0.0, f:5.8},
  "Atum fresco, bife estufado com azeite e vinho": {per:"100g", kcal:196, p:23.1, c:0.2, f:10.1},
  "Avelã, miolo": {per:"100g", kcal:689, p:14.0, c:6.0, f:66.3},
  "Azeite (4 marcas)": {per:"100g", kcal:899, p:0.0, c:0.0, f:99.9},
  "Azeitona": {per:"100g", kcal:164, p:1.3, c:0.0, f:16.8},
  "Bacalhau à Brás": {per:"100g", kcal:164, p:9.5, c:8.3, f:10.1},
  "Bacalhau à Brás com azeite": {per:"100g", kcal:195, p:8.7, c:6.5, f:14.7},
  "Bacalhau à Brás com azeite e azeitonas": {per:"100g", kcal:93, p:8.0, c:6.5, f:3.6},
  "Bacalhau à Gomes de Sá": {per:"100g", kcal:139, p:6.7, c:13.1, f:6.3},
  "Bacalhau à Gomes de Sá, com azeite": {per:"100g", kcal:160, p:8.6, c:7.4, f:10.4},
  "Bacalhau assado no forno com azeite": {per:"100g", kcal:136, p:20.8, c:0.8, f:4.9},
  "Bacalhau com natas": {per:"100g", kcal:98, p:9.0, c:9.2, f:2.6},
  "Bacalhau com natas, com queijo ralado": {per:"100g", kcal:167, p:5.3, c:7.6, f:12.6},
  "Bacalhau cozido": {per:"100g", kcal:106, p:26.2, c:0.0, f:0.1},
  "Bacalhau fresco cozido": {per:"100g", kcal:84, p:19.1, c:0.0, f:0.8},
  "Bacalhau fresco cru": {per:"100g", kcal:76, p:17.8, c:0.0, f:0.5},
  "Bacalhau grelhado": {per:"100g", kcal:123, p:30.2, c:0.0, f:0.2},
  "Bacalhau seco e salgado, demolhado cru": {per:"100g", kcal:80, p:19.0, c:0.0, f:0.4},
  "Bacalhau, filetes fritos": {per:"100g", kcal:194, p:19.2, c:5.1, f:10.7},
  "Bacalhau, ovas cruas": {per:"100g", kcal:104, p:21.7, c:0.0, f:1.9},
  "Bacon": {per:"100g", kcal:367, p:13.8, c:0.0, f:34.6},
  "Bacon, grelhado": {per:"100g", kcal:372, p:22.2, c:0.0, f:31.5},
  "Bagas goji secas": {per:"100g", kcal:303, p:11.2, c:51.8, f:2.8},
  "Banha de porco": {per:"100g", kcal:896, p:0.0, c:0.0, f:99.5},
  "Base em pó para bebida de ananás": {per:"100g", kcal:369, p:0.0, c:89.5, f:0.0},
  "Base em pó para bebida de laranja": {per:"100g", kcal:375, p:0.0, c:88.9, f:0.0},
  "Batata assada com pele, sem sal (só a polpa)": {per:"100g", kcal:90, p:2.5, c:19.2, f:0.0},
  "Batata assada no forno": {per:"100g", kcal:159, p:3.2, c:24.8, f:4.8},
  "Batata cozida": {per:"100g", kcal:59, p:1.5, c:12.4, f:0.0},
  "Batata crua": {per:"100g", kcal:90, p:2.5, c:19.2, f:0.0},
  "Batata doce assada": {per:"100g", kcal:123, p:1.0, c:28.3, f:0.0},
  "Batata doce crua": {per:"100g", kcal:123, p:1.0, c:28.3, f:0.0},
  "Batata estufada com cebola, azeite e óleo alimentar": {per:"100g", kcal:97, p:2.0, c:14.5, f:3.1},
  "Batata frita caseira (em palitos)": {per:"100g", kcal:227, p:3.7, c:27.6, f:10.8},
  "Batata frita, de pacote (em rodelas)": {per:"100g", kcal:543, p:5.7, c:39.0, f:38.1},
  "Batata, fécula": {per:"100g", kcal:345, p:0.5, c:85.0, f:0.3},
  "Bebida refrigerante, cola": {per:"100g", kcal:32, p:0.0, c:7.9, f:0.0},
  "Bebida refrigerante, gasosa": {per:"100g", kcal:28, p:0.0, c:7.0, f:0.0},
  "Bebida refrigerante, laranja": {per:"100g", kcal:31, p:0.0, c:7.7, f:0.0},
  "Bebida vegetal à base de amêndoa (alternativa ao leite)": {per:"100g", kcal:29, p:0.4, c:3.7, f:1.3},
  "Bebida vegetal à base de amêndoa, 0% açúcares (alternativa ao leite)": {per:"100g", kcal:17, p:0.4, c:0.3, f:1.5},
  "Bebida vegetal à base de amêndoa, com aroma a chocolate (alternativa ao leite)": {per:"100g", kcal:49, p:0.7, c:8.4, f:1.4},
  "Bebida vegetal à base de arroz (alternativa ao leite)": {per:"100g", kcal:51, p:0.2, c:10.6, f:0.9},
  "Bebida vegetal à base de aveia (alternativa ao leite)": {per:"100g", kcal:46, p:0.6, c:8.2, f:1.2},
  "Bebida vegetal à base de aveia, 0% de açúcar (alternativa ao leite)": {per:"100g", kcal:36, p:0.2, c:6.0, f:1.2},
  "Bebida vegetal à base de aveia, com açúcares adicionados (alternativa ao leite)": {per:"100g", kcal:59, p:0.7, c:6.0, f:3.3},
  "Bebida vegetal à base de soja (alternativa ao leite)": {per:"100g", kcal:49, p:3.0, c:4.1, f:2.2},
  "Bebida vegetal à base de soja com açúcar, com cálcio, sal e aromas (alternativa ao leite)": {per:"100g", kcal:42, p:3.0, c:3.3, f:1.6},
  "Bebida vegetal à base de soja com açúcar, sal e aromas (alternativa ao leite)": {per:"100g", kcal:59, p:3.0, c:6.7, f:2.2},
  "Bebida vegetal à base de soja natural, sem açúcar e sem sal (alternativa ao leite)": {per:"100g", kcal:37, p:3.1, c:1.3, f:2.2},
  "Beldroega crua": {per:"100g", kcal:13, p:1.0, c:1.0, f:0.0},
  "Berbigão aberto ao natural sem sal": {per:"100g", kcal:118, p:21.0, c:5.4, f:1.4},
  "Berbigão cru": {per:"100g", kcal:59, p:10.5, c:2.7, f:0.7},
  "Beringela crua": {per:"100g", kcal:21, p:1.1, c:2.4, f:0.2},
  "Beringela grelhada com azeite": {per:"100g", kcal:99, p:2.0, c:4.3, f:7.1},
  "Besugo cru": {per:"100g", kcal:102, p:19.5, c:0.0, f:2.7},
  "Beterraba (raiz) cozida sem sal": {per:"100g", kcal:23, p:1.0, c:3.4, f:0.0},
  "Beterraba (raiz) crua": {per:"100g", kcal:23, p:1.0, c:3.5, f:0.0},
  "Biscoitos caseiros": {per:"100g", kcal:423, p:6.7, c:73.4, f:11.0},
  "Biscoitos limão": {per:"100g", kcal:382, p:6.7, c:77.9, f:4.4},
  "Biscoitos, argolas": {per:"100g", kcal:451, p:5.4, c:69.7, f:16.5},
  "Biscoitos, línguas de gato": {per:"100g", kcal:377, p:5.2, c:84.1, f:1.8},
  "Biscoitos, línguas de veado": {per:"100g", kcal:474, p:5.8, c:65.1, f:20.7},
  "Biscoitos, palitos la Reine": {per:"100g", kcal:381, p:11.5, c:66.6, f:7.2},
  "Bola de Berlim sem creme": {per:"100g", kcal:402, p:6.8, c:43.7, f:21.5},
  "Bolacha \"Belga\"": {per:"100g", kcal:487, p:7.1, c:70.1, f:19.6},
  "Bolacha \"Cream cracker\"": {per:"100g", kcal:442, p:10.8, c:61.6, f:16.2},
  "Bolacha \"waffer\" baunilha": {per:"100g", kcal:564, p:3.2, c:55.3, f:36.4},
  "Bolacha água e sal": {per:"100g", kcal:437, p:8.7, c:71.0, f:12.6},
  "Bolacha aveia": {per:"100g", kcal:443, p:10.0, c:57.5, f:18.3},
  "Bolacha chocolate": {per:"100g", kcal:510, p:6.0, c:67.3, f:23.4},
  "Bolacha integral (trigo)": {per:"100g", kcal:450, p:8.8, c:65.6, f:15.6},
  "Bolacha manteiga": {per:"100g", kcal:483, p:6.2, c:65.2, f:21.3},
  "Bolacha Maria": {per:"100g", kcal:436, p:8.4, c:72.0, f:12.2},
  "Bolacha torrada": {per:"100g", kcal:437, p:7.3, c:68.5, f:14.4},
  "Bolo-Rei": {per:"100g", kcal:407, p:7.9, c:57.4, f:14.9},
  "Bolo de arroz": {per:"100g", kcal:391, p:5.8, c:48.1, f:19.2},
  "Bolo de bolacha Maria": {per:"100g", kcal:389, p:3.9, c:46.3, f:20.7},
  "Bolo de chocolate": {per:"100g", kcal:463, p:7.4, c:47.0, f:26.4},
  "Bolo de coco": {per:"100g", kcal:454, p:4.2, c:37.8, f:31.0},
  "Bolo ferradura": {per:"100g", kcal:351, p:5.9, c:71.6, f:4.1},
  "Bolo inglês": {per:"100g", kcal:380, p:5.1, c:57.0, f:13.9},
  "Borrego, perna no forno": {per:"100g", kcal:168, p:21.9, c:0.4, f:7.6},
  "Borrego, perna ou costeleta assada com azeite e margarina": {per:"100g", kcal:234, p:23.3, c:0.0, f:15.6},
  "Borrego, perna ou costeleta assada com margarina": {per:"100g", kcal:224, p:23.3, c:0.0, f:14.5},
  "Borrego, perna ou costeleta assada com margarina, sem molho": {per:"100g", kcal:166, p:24.5, c:0.0, f:7.6},
  "Borrego, perna ou costeleta assada sem molho": {per:"100g", kcal:168, p:24.1, c:0.0, f:8.0},
  "Borrego, perna ou costeleta cozida": {per:"100g", kcal:157, p:26.5, c:0.0, f:5.7},
  "Borrego, perna ou costeleta crua": {per:"100g", kcal:124, p:19.7, c:0.0, f:5.0},
  "Borrego, perna ou costeleta estufada com azeite e margarina": {per:"100g", kcal:183, p:16.2, c:1.6, f:12.0},
  "Borrego, perna ou costeleta estufada com margarina": {per:"100g", kcal:175, p:16.2, c:1.6, f:11.1},
  "Borrego, perna ou costeleta estufada sem molho": {per:"100g", kcal:185, p:25.5, c:0.0, f:9.2},
  "Borrego, perna ou costeleta grelhada": {per:"100g", kcal:152, p:25.7, c:0.0, f:5.5},
  "Brandy": {per:"100g", kcal:246, p:0.0, c:0.0, f:0.0},
  "Brócolos cozidos": {per:"100g", kcal:29, p:2.9, c:2.2, f:0.3},
  "Brócolos crus": {per:"100g", kcal:32, p:3.4, c:1.5, f:0.8},
  "Bulgur": {per:"100g", kcal:344, p:12.1, c:65.6, f:1.9},
  "Búzio cru": {per:"100g", kcal:82, p:17.8, c:2.3, f:0.2},
  "Cabrito, costeleta crua": {per:"100g", kcal:120, p:23.9, c:0.0, f:2.7},
  "Cabrito, costeleta grelhada": {per:"100g", kcal:151, p:30.9, c:0.0, f:3.0},
  "Cabrito, peito cru": {per:"100g", kcal:116, p:20.5, c:0.0, f:3.8},
  "Cabrito, peito estufado com azeite e margarina": {per:"100g", kcal:173, p:23.3, c:0.8, f:8.4},
  "Cabrito, peito estufado com azeite e óleo alimentar": {per:"100g", kcal:176, p:23.3, c:0.7, f:8.8},
  "Cabrito, peito estufado com manteiga e óleo alimentar": {per:"100g", kcal:173, p:23.3, c:0.8, f:8.4},
  "Cabrito, peito estufado com margarina e óleo alimentar": {per:"100g", kcal:173, p:23.3, c:0.8, f:8.4},
  "Cabrito, peito estufado, sem molho": {per:"100g", kcal:153, p:28.4, c:0.0, f:4.4},
  "Cabrito, peito grelhado": {per:"100g", kcal:144, p:26.5, c:0.0, f:4.2},
  "Cabrito, perna assada com azeite e margarina": {per:"100g", kcal:180, p:21.7, c:0.2, f:10.0},
  "Cabrito, perna assada com óleo alimentar e margarina": {per:"100g", kcal:180, p:21.7, c:0.2, f:10.0},
  "Cabrito, perna assada, sem molho": {per:"100g", kcal:135, p:24.3, c:0.0, f:4.2},
  "Cabrito, perna crua": {per:"100g", kcal:113, p:19.3, c:0.0, f:4.0},
  "Cação cru": {per:"100g", kcal:82, p:20.0, c:0.0, f:0.2},
  "Cação frito": {per:"100g", kcal:170, p:24.0, c:2.7, f:7.0},
  "Cacau em pó": {per:"100g", kcal:358, p:19.6, c:11.1, f:23.4},
  "Cachucho cru": {per:"100g", kcal:80, p:18.3, c:0.0, f:0.7},
  "Café solúvel em pó": {per:"100g", kcal:272, p:14.9, c:41.1, f:0.5},
  "Café solúvel, descafeinado, pó": {per:"100g", kcal:274, p:14.7, c:42.6, f:0.2},
  "Café, infusão - bica": {per:"100g", kcal:4, p:0.4, c:0.3, f:0.1},
  "Café, infusão - café de cafeteira": {per:"100g", kcal:2, p:0.2, c:0.3, f:0.0},
  "Café, infusão - carioca": {per:"100g", kcal:2, p:0.2, c:0.3, f:0.0},
  "Café, infusão - valor médio (bica 60% e café de cafeteira 40%)": {per:"100g", kcal:3, p:0.3, c:0.3, f:0.1},
  "Caldeirada de bacalhau": {per:"100g", kcal:67, p:4.2, c:7.1, f:2.1},
  "Caldeirada de bacalhau com enchidos e massa": {per:"100g", kcal:146, p:7.0, c:9.7, f:8.5},
  "Caldeirada de cabrito com azeite e banha": {per:"100g", kcal:119, p:11.3, c:8.3, f:4.3},
  "Caldeirada de cabrito com azeite e margarina": {per:"100g", kcal:116, p:11.3, c:8.3, f:4.0},
  "Caldeirada de enguias": {per:"100g", kcal:171, p:6.6, c:8.2, f:11.9},
  "Caldeirada de enguias à moda de Aveiro": {per:"100g", kcal:245, p:7.4, c:5.3, f:21.4},
  "Caldeirada de pargo e peixe-espada-preto": {per:"100g", kcal:138, p:7.2, c:4.4, f:9.8},
  "Caldeirada de peixe": {per:"100g", kcal:84, p:7.5, c:4.4, f:3.5},
  "Caldeirada de safio": {per:"100g", kcal:81, p:4.5, c:7.2, f:3.1},
  "Caldeirada de safio com amêijoas": {per:"100g", kcal:80, p:6.9, c:5.8, f:2.7},
  "Caldeirada de safio, raia e tamboril": {per:"100g", kcal:98, p:7.0, c:9.8, f:2.9},
  "Caldo preparado com cubo de carne de galinha (diluição 2%)": {per:"100g", kcal:5, p:0.3, c:0.2, f:0.3},
  "Caldo preparado com cubo de carne de vaca (diluição 2%)": {per:"100g", kcal:4, p:0.4, c:0.2, f:0.2},
  "Camarão cozido": {per:"100g", kcal:99, p:22.6, c:0.4, f:0.8},
  "Camarão cozido sem sal": {per:"100g", kcal:92, p:20.2, c:0.3, f:1.1},
  "Camarão cru": {per:"100g", kcal:77, p:17.6, c:0.3, f:0.6},
  "Canela moída": {per:"100g", kcal:315, p:3.9, c:55.5, f:3.2},
  "Canja de frango com aipo": {per:"100g", kcal:56, p:7.8, c:2.3, f:1.7},
  "Canja de frango com massa": {per:"100g", kcal:61, p:10.8, c:2.1, f:1.0},
  "Canónigos crus": {per:"100g", kcal:24, p:2.0, c:2.0, f:0.4},
  "Cantarilho (Redfish) assado com cebola, tomate, azeite e bacon": {per:"100g", kcal:142, p:13.6, c:1.2, f:8.6},
  "Cantarilho (Redfish) com batata, no forno": {per:"100g", kcal:108, p:8.7, c:5.7, f:4.9},
  "Cantarilho (Redfish) cozido": {per:"100g", kcal:99, p:19.3, c:0.0, f:2.4},
  "Cantarilho (Redfish) cru": {per:"100g", kcal:101, p:18.6, c:0.0, f:2.9},
  "Cantarilho (Redfish) no forno": {per:"100g", kcal:114, p:17.3, c:1.1, f:2.7},
  "Caracol riscado, cozido": {per:"100g", kcal:89, p:10.0, c:3.5, f:3.9},
  "Caracol, cru": {per:"100g", kcal:85, p:16.1, c:2.0, f:1.4},
  "Carambola": {per:"100g", kcal:40, p:0.5, c:7.1, f:0.3},
  "Carapau cru": {per:"100g", kcal:105, p:19.7, c:0.0, f:2.9},
  "Carapau frito": {per:"100g", kcal:186, p:24.0, c:1.0, f:9.6},
  "Carapau grelhado": {per:"100g", kcal:139, p:26.3, c:0.0, f:3.7},
  "Cardamomo verde": {per:"100g", kcal:335, p:10.8, c:49.5, f:6.2},
  "Caril em pó": {per:"100g", kcal:342, p:12.7, c:25.2, f:13.8},
  "Carne à bolonhesa": {per:"100g", kcal:238, p:11.5, c:15.6, f:14.0},
  "Carne à jardineira": {per:"100g", kcal:140, p:9.7, c:5.6, f:8.1},
  "Carne de porco à alentejana": {per:"100g", kcal:229, p:14.6, c:1.8, f:16.9},
  "Carne de porco à alentejana sem massa de pimentão": {per:"100g", kcal:183, p:16.0, c:2.2, f:11.8},
  "Carneiro, costeleta crua": {per:"100g", kcal:151, p:20.8, c:0.0, f:7.5},
  "Carneiro, pá assada com azeite e margarina": {per:"100g", kcal:319, p:24.3, c:0.0, f:24.6},
  "Carneiro, pá assada com margarina": {per:"100g", kcal:310, p:24.3, c:0.0, f:23.6},
  "Carneiro, pá assada, sem molho": {per:"100g", kcal:202, p:25.1, c:0.0, f:11.3},
  "Carneiro, pá cozida": {per:"100g", kcal:238, p:27.6, c:0.0, f:14.2},
  "Carneiro, pá crua": {per:"100g", kcal:195, p:20.5, c:0.0, f:12.6},
  "Carneiro, pá estufada sem molho": {per:"100g", kcal:238, p:27.6, c:0.0, f:14.2},
  "Carneiro, peito gordo, cozido": {per:"100g", kcal:333, p:23.3, c:0.0, f:26.6},
  "Carneiro, peito gordo, cru": {per:"100g", kcal:396, p:16.8, c:0.0, f:36.5},
  "Carneiro, perna gorda, assada, sem molho": {per:"100g", kcal:285, p:24.3, c:0.0, f:20.9},
  "Carneiro, perna gorda, crua": {per:"100g", kcal:276, p:19.1, c:0.0, f:22.2},
  "Carneiro, perna gorda, estufada sem molho": {per:"100g", kcal:339, p:26.5, c:0.0, f:25.9},
  "Carneiro, perna magra assada com azeite e margarina": {per:"100g", kcal:242, p:23.5, c:0.0, f:16.4},
  "Carneiro, perna magra assada com margarina": {per:"100g", kcal:232, p:23.5, c:0.0, f:15.3},
  "Carneiro, perna magra, assada, sem molho": {per:"100g", kcal:178, p:24.2, c:0.0, f:9.0},
  "Carneiro, perna magra, crua": {per:"100g", kcal:130, p:19.8, c:0.0, f:5.6},
  "Carneiro, perna magra, estufada com azeite e margarina": {per:"100g", kcal:201, p:17.4, c:1.7, f:13.4},
  "Carneiro, perna magra, estufada com margarina": {per:"100g", kcal:193, p:17.4, c:1.7, f:12.5},
  "Carneiro, perna magra, estufada sem molho": {per:"100g", kcal:195, p:25.6, c:0.0, f:10.3},
  "Carneiro, perna ou costeleta magra frita com margarina, sem molho": {per:"100g", kcal:174, p:24.7, c:0.0, f:8.4},
  "Carneiro, rim cru": {per:"100g", kcal:92, p:16.2, c:0.0, f:3.0},
  "Carneiro, rim frito com margarina": {per:"100g", kcal:205, p:22.3, c:0.0, f:12.9},
  "Caseína": {per:"100g", kcal:358, p:86.2, c:0.0, f:1.5},
  "Castanha assada com sal": {per:"100g", kcal:222, p:3.5, c:45.5, f:1.3},
  "Castanha cozida sem sal": {per:"100g", kcal:175, p:2.8, c:35.9, f:1.0},
  "Castanha de caju torrada e salgada": {per:"100g", kcal:613, p:19.6, c:19.4, f:50.0},
  "Castanha de caju torrada, sem sal": {per:"100g", kcal:613, p:19.6, c:19.4, f:50.0},
  "Castanha do Brasil": {per:"100g", kcal:690, p:9.6, c:2.6, f:66.7},
  "Castanha pilada": {per:"100g", kcal:341, p:5.1, c:70.0, f:2.0},
  "Castanha, miolo": {per:"100g", kcal:194, p:3.1, c:39.8, f:1.1},
  "Cavala cozida": {per:"100g", kcal:192, p:20.5, c:0.0, f:12.2},
  "Cavala crua": {per:"100g", kcal:202, p:20.3, c:0.0, f:13.4},
  "Cavala em filetes, conserva em azeite": {per:"100g", kcal:182, p:24.0, c:0.0, f:9.6},
  "Cavala grelhada": {per:"100g", kcal:192, p:18.5, c:0.6, f:12.2},
  "Cavala no forno": {per:"100g", kcal:192, p:12.9, c:2.3, f:14.3},
  "Cavalo, bife de alcatra crua": {per:"100g", kcal:116, p:21.1, c:0.0, f:3.5},
  "Cavalo, bife de alcatra frita com manteiga": {per:"100g", kcal:177, p:23.3, c:0.0, f:9.3},
  "Cavalo, bife de alcatra frita com margarina": {per:"100g", kcal:176, p:23.3, c:0.0, f:9.2},
  "Cavalo, bife de alcatra frita, sem molho": {per:"100g", kcal:147, p:24.7, c:0.0, f:5.4},
  "Cavalo, lombo ou pá assado com azeite e manteiga": {per:"100g", kcal:167, p:22.7, c:0.1, f:8.0},
  "Cavalo, lombo ou pá assado com margarina": {per:"100g", kcal:161, p:22.7, c:0.1, f:7.3},
  "Cavalo, lombo ou pá assado sem molho": {per:"100g", kcal:136, p:24.2, c:0.0, f:4.3},
  "Cavalo, lombo ou pá cru": {per:"100g", kcal:99, p:19.6, c:0.0, f:2.3},
  "Cavalo, lombo ou pá frito com manteiga": {per:"100g", kcal:158, p:21.6, c:0.0, f:8.0},
  "Cavalo, lombo ou pá frito com margarina": {per:"100g", kcal:157, p:21.6, c:0.0, f:7.8},
  "Cebola cozida": {per:"100g", kcal:18, p:1.0, c:2.4, f:0.2},
  "Cebola crua": {per:"100g", kcal:20, p:0.9, c:3.1, f:0.2},
  "Cebola doce, crua": {per:"100g", kcal:25, p:0.8, c:4.9, f:0.0},
  "Cebola frita com óleo alimentar": {per:"100g", kcal:138, p:1.9, c:6.2, f:11.2},
  "Cebola roxa, crua": {per:"100g", kcal:43, p:0.7, c:8.6, f:0.0},
  "Cebolinho fresco": {per:"100g", kcal:28, p:2.8, c:1.7, f:0.6},
  "Cenoura baby crua": {per:"100g", kcal:29, p:0.6, c:4.9, f:0.1},
  "Cenoura cozida": {per:"100g", kcal:33, p:0.9, c:5.7, f:0.0},
  "Cenoura crua": {per:"100g", kcal:25, p:0.6, c:4.4, f:0.0},
  "Cereal de pequeno almoço à base de farelo de trigo (tipo \"All-Bran\")": {per:"100g", kcal:310, p:15.1, c:39.8, f:3.4},
  "Cereal de pequeno almoço de trigo integral tipo \"Weetabix\"": {per:"100g", kcal:364, p:10.7, c:71.5, f:2.0},
  "Cerefólio fresco": {per:"100g", kcal:80, p:4.0, c:12.0, f:1.0},
  "Cereja (4 variedades)": {per:"100g", kcal:67, p:0.8, c:13.3, f:0.7},
  "Cereja desidratada": {per:"100g", kcal:366, p:4.4, c:72.6, f:3.8},
  "Cereja, conserva em calda de açúcar": {per:"100g", kcal:120, p:0.4, c:28.7, f:0.2},
  "Cereja, cristalizada": {per:"100g", kcal:326, p:0.4, c:79.9, f:0.2},
  "Cerveja branca": {per:"100g", kcal:30, p:0.4, c:0.5, f:0.0},
  "Cerveja preta": {per:"100g", kcal:23, p:0.5, c:0.6, f:0.0},
  "Cerveja sem álcool": {per:"100g", kcal:7, p:0.3, c:1.5, f:0.0},
  "Chá, infusão, preto": {per:"100g", kcal:1, p:0.1, c:0.2, f:0.0},
  "Chá, infusão, verde": {per:"100g", kcal:1, p:0.1, c:0.2, f:0.0},
  "Chamuça": {per:"100g", kcal:344, p:9.1, c:39.3, f:16.3},
  "Cherne cozido": {per:"100g", kcal:124, p:18.9, c:0.0, f:5.4},
  "Cherne cru": {per:"100g", kcal:132, p:17.9, c:0.0, f:6.7},
  "Cherne grelhado": {per:"100g", kcal:153, p:24.1, c:0.0, f:6.3},
  "Chicharro cozido": {per:"100g", kcal:111, p:21.1, c:0.0, f:3.0},
  "Chicharro cru": {per:"100g", kcal:105, p:19.7, c:0.0, f:2.9},
  "Chicharro grelhado": {per:"100g", kcal:139, p:26.3, c:0.0, f:3.7},
  "Chicória crua": {per:"100g", kcal:14, p:1.0, c:0.9, f:0.1},
  "Choco cru": {per:"100g", kcal:79, p:18.9, c:0.0, f:0.4},
  "Choco grelhado": {per:"100g", kcal:109, p:25.8, c:0.0, f:0.6},
  "Chocolate culinária, tablete": {per:"100g", kcal:502, p:5.4, c:44.0, f:30.5},
  "Chocolate de leite, tablete": {per:"100g", kcal:552, p:8.0, c:53.1, f:33.9},
  "Chocolate negro (aproximadamente 50% cacau)": {per:"100g", kcal:530, p:5.2, c:52.6, f:31.7},
  "Chocolate, pó": {per:"100g", kcal:469, p:4.2, c:63.8, f:20.3},
  "Chouriço de carne de porco, cru": {per:"100g", kcal:476, p:20.0, c:0.0, f:44.1},
  "Chouriço de carne de porco, gordo, cru": {per:"100g", kcal:544, p:15.4, c:0.0, f:53.6},
  "Chouriço de carne de porco, magro, cozido sem adição de sal": {per:"100g", kcal:334, p:24.8, c:0.0, f:26.1},
  "Chouriço de carne de porco, magro, cru": {per:"100g", kcal:409, p:24.5, c:0.0, f:34.5},
  "Chouriço de carne de porco, magro, grelhado": {per:"100g", kcal:343, p:31.6, c:0.0, f:24.1},
  "Chouriço de sangue cozido": {per:"100g", kcal:263, p:11.2, c:0.0, f:24.2},
  "Chouriço de sangue, cru": {per:"100g", kcal:328, p:11.0, c:0.0, f:31.6},
  "Chuchu": {per:"100g", kcal:19, p:0.8, c:2.9, f:0.1},
  "Chucrute": {per:"100g", kcal:15, p:1.3, c:1.1, f:0.3},
  "Clara de ovo de galinha, crua": {per:"100g", kcal:47, p:11.0, c:0.0, f:0.3},
  "Clara de ovo de galinha, pasteurizada": {per:"100g", kcal:46, p:10.5, c:1.0, f:0.0},
  "Clementina": {per:"100g", kcal:53, p:0.8, c:11.1, f:0.2},
  "Coco seco, ralado": {per:"100g", kcal:648, p:5.6, c:6.4, f:62.0},
  "Codorniz carne sem pele, crua": {per:"100g", kcal:119, p:22.1, c:0.0, f:3.4},
  "Codorniz com pele, crua": {per:"100g", kcal:170, p:21.5, c:0.0, f:9.3},
  "Codorniz com pele, estufada com azeite": {per:"100g", kcal:234, p:25.6, c:0.7, f:13.4},
  "Codorniz com pele, grelhada": {per:"100g", kcal:202, p:24.5, c:0.0, f:11.6},
  "Coelho à caçador": {per:"100g", kcal:182, p:12.3, c:1.6, f:12.7},
  "Coelho cru": {per:"100g", kcal:117, p:20.3, c:0.0, f:4.0},
  "Coelho em vinha de alhos": {per:"100g", kcal:174, p:11.3, c:1.4, f:11.6},
  "Coelho estufado": {per:"100g", kcal:211, p:26.6, c:0.9, f:10.2},
  "Coelho estufado com azeite": {per:"100g", kcal:218, p:26.6, c:0.9, f:11.0},
  "Coelho estufado com margarina": {per:"100g", kcal:205, p:26.6, c:0.9, f:9.5},
  "Coentros crus": {per:"100g", kcal:28, p:2.4, c:1.8, f:0.6},
  "Cogumelos enlatados, escorridos": {per:"100g", kcal:17, p:2.1, c:0.0, f:0.4},
  "Cogumelos fritos com óleo alimentar": {per:"100g", kcal:163, p:2.4, c:0.3, f:16.2},
  "Cogumelos marron": {per:"100g", kcal:23, p:3.2, c:1.5, f:0.2},
  "Cogumelos ostra (pleurotus)": {per:"100g", kcal:27, p:2.4, c:2.7, f:0.2},
  "Cogumelos, genérico": {per:"100g", kcal:18, p:1.8, c:0.5, f:0.5},
  "Colorau": {per:"100g", kcal:358, p:14.8, c:35.0, f:13.0},
  "Cominhos": {per:"100g", kcal:427, p:18.0, c:34.0, f:22.0},
  "Compota de alperce": {per:"100g", kcal:239, p:0.4, c:58.9, f:0.0},
  "Compota de ameixa": {per:"100g", kcal:200, p:0.3, c:49.2, f:0.0},
  "Compota de ananás": {per:"100g", kcal:211, p:0.5, c:50.8, f:0.1},
  "Compota de cereja": {per:"100g", kcal:251, p:0.4, c:61.9, f:0.0},
  "Compota de laranja": {per:"100g", kcal:242, p:0.4, c:59.5, f:0.0},
  "Condimento de mostarda": {per:"100g", kcal:158, p:5.7, c:18.5, f:6.4},
  "Corvina cozida": {per:"100g", kcal:95, p:20.7, c:0.0, f:1.4},
  "Corvina crua": {per:"100g", kcal:94, p:20.4, c:0.0, f:1.4},
  "Couve-branca cozida": {per:"100g", kcal:17, p:0.7, c:1.7, f:0.4},
  "Couve-branca crua": {per:"100g", kcal:28, p:1.4, c:3.5, f:0.4},
  "Couve-de-Bruxelas cozida": {per:"100g", kcal:34, p:1.1, c:3.5, f:1.3},
  "Couve-de-Bruxelas crua": {per:"100g", kcal:50, p:3.5, c:4.0, f:1.4},
  "Couve-flor cozida": {per:"100g", kcal:21, p:1.6, c:2.0, f:0.3},
  "Couve-flor crua": {per:"100g", kcal:34, p:3.7, c:3.3, f:0.2},
  "Couve-galega cozida": {per:"100g", kcal:29, p:2.1, c:2.9, f:0.4},
  "Couve-galega crua": {per:"100g", kcal:32, p:2.4, c:3.1, f:0.4},
  "Couve-lombarda cozida": {per:"100g", kcal:22, p:2.2, c:1.4, f:0.2},
  "Couve-lombarda crua": {per:"100g", kcal:26, p:2.4, c:2.1, f:0.2},
  "Couve-portuguesa cozida": {per:"100g", kcal:25, p:1.6, c:2.5, f:0.4},
  "Couve-portuguesa crua": {per:"100g", kcal:31, p:2.2, c:3.5, f:0.4},
  "Couve-roxa crua": {per:"100g", kcal:30, p:2.0, c:3.9, f:0.0},
  "Cozido à portuguesa": {per:"100g", kcal:120, p:6.8, c:6.2, f:7.0},
  "Cozido à portuguesa com grão": {per:"100g", kcal:259, p:11.7, c:20.5, f:13.5},
  "Cravinho": {per:"100g", kcal:431, p:6.0, c:52.0, f:20.0},
  "Creme culinário": {per:"100g", kcal:531, p:0.0, c:0.0, f:59.0},
  "Creme culinário líquido, 65% gordura, com sal": {per:"100g", kcal:588, p:0.0, c:0.0, f:65.3},
  "Creme de camarão": {per:"100g", kcal:39, p:3.6, c:1.7, f:1.4},
  "Creme de camarão com natas": {per:"100g", kcal:51, p:3.5, c:1.9, f:2.9},
  "Creme de ervilhas": {per:"100g", kcal:43, p:2.6, c:3.0, f:1.9},
  "Creme para barrar de cacau e avelãs": {per:"100g", kcal:545, p:5.9, c:54.7, f:33.3},
  "Creme vegetal culinário, 75% gordura, sem sal": {per:"100g", kcal:677, p:0.1, c:0.4, f:75.0},
  "Creme vegetal de soja para barrar": {per:"100g", kcal:444, p:0.2, c:3.7, f:47.6},
  "Creme vegetal de soja para culinária (alternativa à nata)": {per:"100g", kcal:162, p:2.3, c:5.7, f:14.3},
  "Creme vegetal para barrar  72% gordura, 33% ácidos gordos polinsaturados": {per:"100g", kcal:651, p:0.1, c:0.4, f:72.1},
  "Creme vegetal para barrar 35% gordura, com fitosteróis": {per:"100g", kcal:328, p:0.1, c:3.2, f:35.0},
  "Creme vegetal para barrar 37% gordura": {per:"100g", kcal:343, p:1.4, c:0.2, f:37.4},
  "Creme vegetal para barrar 58% gordura, com cálcio": {per:"100g", kcal:525, p:0.3, c:0.5, f:58.0},
  "Creme vegetal para barrar 70% gordura, 53% ácidos gordos monoinsaturados": {per:"100g", kcal:632, p:0.1, c:0.5, f:70.0},
  "Creme vegetal para barrar 70% gordura, com sal": {per:"100g", kcal:632, p:0.1, c:0.3, f:70.0},
  "Croissant": {per:"100g", kcal:418, p:7.5, c:44.6, f:22.8},
  "Croquete": {per:"100g", kcal:316, p:13.2, c:23.1, f:18.8},
  "Cubo de carne de galinha para caldo": {per:"100g", kcal:236, p:15.4, c:9.0, f:15.4},
  "Cubo de carne de vaca para caldo": {per:"100g", kcal:183, p:19.8, c:8.0, f:8.0},
  "Curgete crua": {per:"100g", kcal:19, p:1.6, c:2.0, f:0.3},
  "Curgete frita com óleo alimentar": {per:"100g", kcal:64, p:2.0, c:2.5, f:4.8},
  "Dióspiro": {per:"100g", kcal:65, p:0.6, c:14.8, f:0.0},
  "Dióspiro desidratado": {per:"100g", kcal:353, p:3.3, c:80.8, f:0.0},
  "Doce de alperce": {per:"100g", kcal:233, p:0.5, c:57.4, f:0.0},
  "Doce de cereja": {per:"100g", kcal:262, p:0.2, c:64.9, f:0.0},
  "Doce de framboesa": {per:"100g", kcal:242, p:0.4, c:59.7, f:0.0},
  "Doce de ginja": {per:"100g", kcal:263, p:0.4, c:64.8, f:0.0},
  "Doce de maçã": {per:"100g", kcal:239, p:0.2, c:59.0, f:0.0},
  "Doce de morango": {per:"100g", kcal:245, p:0.2, c:60.5, f:0.0},
  "Doce de pêssego": {per:"100g", kcal:209, p:0.4, c:51.3, f:0.0},
  "Donut": {per:"100g", kcal:400, p:6.6, c:43.0, f:21.7},
  "Donut recheado com doce de fruta": {per:"100g", kcal:348, p:6.0, c:47.0, f:14.5},
  "Dourada cozida": {per:"100g", kcal:196, p:20.8, c:0.0, f:12.5},
  "Dourada crua": {per:"100g", kcal:167, p:19.7, c:0.0, f:9.8},
  "Dourada grelhada": {per:"100g", kcal:178, p:22.3, c:0.0, f:9.9},
  "Éclair de chocolate": {per:"100g", kcal:378, p:4.1, c:36.5, f:23.8},
  "Empada": {per:"100g", kcal:374, p:9.6, c:33.9, f:21.9},
  "Empadão de atum": {per:"100g", kcal:234, p:12.9, c:10.7, f:15.2},
  "Empadão de bacalhau": {per:"100g", kcal:118, p:6.9, c:10.9, f:5.0},
  "Empadão de carne com manteiga": {per:"100g", kcal:134, p:6.6, c:10.7, f:6.3},
  "Empadão de carne com margarina": {per:"100g", kcal:134, p:6.6, c:10.7, f:6.3},
  "Empadão de carne guisada": {per:"100g", kcal:167, p:9.4, c:10.9, f:9.3},
  "Empadão de pescada e camarão": {per:"100g", kcal:122, p:8.7, c:11.0, f:4.5},
  "Endívia crua": {per:"100g", kcal:19, p:1.8, c:1.2, f:0.4},
  "Enguia crua": {per:"100g", kcal:303, p:13.4, c:0.0, f:27.7},
  "Enguia frita": {per:"100g", kcal:267, p:14.8, c:3.2, f:21.6},
  "Ervilhas secas cozidas": {per:"100g", kcal:114, p:6.9, c:18.1, f:0.4},
  "Ervilhas secas cruas": {per:"100g", kcal:330, p:22.7, c:49.4, f:1.3},
  "Ervilhas, grão, congeladas cozidas": {per:"100g", kcal:72, p:5.6, c:7.5, f:0.5},
  "Ervilhas, grão, congeladas cruas": {per:"100g", kcal:68, p:5.3, c:7.0, f:0.5},
  "Ervilhas, grão, frescas cozidas": {per:"100g", kcal:72, p:6.2, c:7.9, f:0.7},
  "Ervilhas, grão, frescas cruas": {per:"100g", kcal:76, p:6.4, c:8.6, f:0.7},
  "Ervilhas, grão, frescas, estufadas": {per:"100g", kcal:113, p:5.1, c:9.6, f:5.1},
  "Ervilhas, vagens cozidas": {per:"100g", kcal:30, p:2.8, c:3.5, f:0.2},
  "Ervilhas, vagens cruas": {per:"100g", kcal:33, p:3.1, c:3.9, f:0.2},
  "Espadarte cru": {per:"100g", kcal:97, p:17.8, c:0.0, f:2.9},
  "Espadarte grelhado": {per:"100g", kcal:116, p:21.3, c:0.0, f:3.4},
  "Espadarte, bife estufado com azeite e vinho": {per:"100g", kcal:152, p:17.1, c:0.4, f:8.1},
  "Espargos cozidos": {per:"100g", kcal:16, p:1.0, c:2.2, f:0.0},
  "Espargos crus": {per:"100g", kcal:22, p:2.1, c:2.7, f:0.0},
  "Esparguete cozido": {per:"100g", kcal:102, p:3.4, c:19.9, f:0.6},
  "Esparguete cru": {per:"100g", kcal:360, p:12.1, c:71.1, f:1.9},
  "Esparguete estufado com cenoura e azeite": {per:"100g", kcal:121, p:3.0, c:17.6, f:3.9},
  "Esparguete estufado com cenoura e margarina": {per:"100g", kcal:115, p:3.0, c:17.6, f:3.2},
  "Espinafres crus": {per:"100g", kcal:27, p:2.6, c:0.8, f:0.9},
  "Estragão fresco": {per:"100g", kcal:55, p:3.4, c:6.3, f:1.1},
  "Estragão seco": {per:"100g", kcal:363, p:22.8, c:42.8, f:7.2},
  "Faneca crua": {per:"100g", kcal:82, p:19.0, c:0.1, f:0.6},
  "Farelo de trigo": {per:"100g", kcal:293, p:16.2, c:24.9, f:5.3},
  "Farinha de alfarroba": {per:"100g", kcal:368, p:3.2, c:85.6, f:0.3},
  "Farinha de aveia": {per:"100g", kcal:363, p:14.5, c:57.0, f:7.3},
  "Farinha de centeio": {per:"100g", kcal:370, p:7.8, c:77.3, f:1.2},
  "Farinha de centeio tipo 70": {per:"100g", kcal:364, p:6.6, c:78.5, f:1.1},
  "Farinha de centeio tipo 85": {per:"100g", kcal:375, p:9.0, c:76.0, f:1.3},
  "Farinha de cevada": {per:"100g", kcal:330, p:8.8, c:64.4, f:2.5},
  "Farinha de espelta": {per:"100g", kcal:339, p:14.0, c:61.8, f:2.3},
  "Farinha de milho tipo 70": {per:"100g", kcal:359, p:8.3, c:75.3, f:2.2},
  "Farinha de pau (mandioca)": {per:"100g", kcal:350, p:1.4, c:84.6, f:0.3},
  "Farinha de trigo (valor médio tipo 150 e tipo 55)": {per:"100g", kcal:349, p:8.5, c:73.7, f:1.5},
  "Farinha de trigo com fermento": {per:"100g", kcal:343, p:9.7, c:72.5, f:1.1},
  "Farinha de trigo integral": {per:"100g", kcal:338, p:9.6, c:65.2, f:2.4},
  "Farinha de trigo tipo 150": {per:"100g", kcal:352, p:9.1, c:73.0, f:1.8},
  "Farinha de trigo tipo 55": {per:"100g", kcal:344, p:7.8, c:74.3, f:1.1},
  "Farinha de trigo tipo 65": {per:"100g", kcal:341, p:13.6, c:67.6, f:1.0},
  "Farinha láctea 5 frutos tipo \"Cerelac\" (com farinha de trigo)": {per:"100g", kcal:408, p:15.0, c:65.0, f:9.0},
  "Farinha láctea maçãs tipo \"Cerelac\" (com farinha de trigo)": {per:"100g", kcal:412, p:15.0, c:66.0, f:9.0},
  "Farinha láctea tipo \"Cerelac\" (com farinha de trigo)": {per:"100g", kcal:416, p:15.0, c:68.0, f:9.0},
  "Farinheira cozida": {per:"100g", kcal:404, p:4.8, c:26.4, f:30.7},
  "Farinheira crua": {per:"100g", kcal:497, p:4.8, c:26.7, f:41.0},
  "Favada à portuguesa": {per:"100g", kcal:130, p:8.0, c:8.4, f:5.9},
  "Favas frescas cozidas": {per:"100g", kcal:82, p:7.7, c:7.7, f:0.5},
  "Favas frescas cruas": {per:"100g", kcal:80, p:7.4, c:8.5, f:0.5},
  "Favas secas cruas": {per:"100g", kcal:301, p:25.8, c:32.8, f:1.3},
  "Favas secas, demolhadas, cozidas": {per:"100g", kcal:90, p:7.9, c:10.7, f:0.6},
  "Feijão-verde fresco cozido": {per:"100g", kcal:27, p:1.3, c:3.5, f:0.3},
  "Feijão-verde fresco cru": {per:"100g", kcal:32, p:1.9, c:3.8, f:0.3},
  "Feijão branco, demolhado, cozido": {per:"100g", kcal:102, p:6.5, c:14.6, f:0.6},
  "Feijão branco, seco, cru": {per:"100g", kcal:308, p:21.3, c:43.9, f:0.1},
  "Feijão catarino, seco, cru": {per:"100g", kcal:302, p:20.3, c:47.9, f:0.1},
  "Feijão catarino, seco, demolhado, cozido": {per:"100g", kcal:88, p:6.0, c:14.1, f:0.0},
  "Feijão encarnado, seco, cru": {per:"100g", kcal:310, p:21.5, c:47.9, f:0.5},
  "Feijão encarnado, seco, demolhado, cozido": {per:"100g", kcal:90, p:6.2, c:13.8, f:0.1},
  "Feijão frade, seco, cru": {per:"100g", kcal:339, p:21.4, c:55.3, f:1.5},
  "Feijão frade, seco, demolhado, cozido": {per:"100g", kcal:123, p:8.8, c:18.1, f:0.7},
  "Feijão manteiga, demolhado, cozido": {per:"100g", kcal:99, p:6.4, c:14.0, f:0.6},
  "Feijão manteiga, seco, cru": {per:"100g", kcal:313, p:24.0, c:42.6, f:0.1},
  "Feijão preto, seco, cru": {per:"100g", kcal:318, p:22.4, c:47.9, f:1.0},
  "Feijão preto, seco, demolhado, cozido": {per:"100g", kcal:80, p:6.5, c:8.4, f:0.3},
  "Feijoa (polpa)": {per:"100g", kcal:52, p:0.9, c:9.8, f:0.5},
  "Feijoada com carne de porco": {per:"100g", kcal:187, p:13.6, c:13.3, f:7.2},
  "Feijoada com carne de porco e de vaca": {per:"100g", kcal:191, p:13.7, c:13.3, f:7.5},
  "Feijoada com enchidos e ovos": {per:"100g", kcal:240, p:9.0, c:14.1, f:15.1},
  "Fermento em pó": {per:"100g", kcal:156, p:4.7, c:34.4, f:0.0},
  "Fermento fresco de padeiro": {per:"100g", kcal:78, p:12.9, c:1.0, f:0.9},
  "Fermento seco de padeiro": {per:"100g", kcal:228, p:38.3, c:3.2, f:2.5},
  "Fiambre de aves": {per:"100g", kcal:83, p:13.8, c:2.7, f:1.6},
  "Fiambre de porco": {per:"100g", kcal:111, p:15.3, c:1.3, f:4.6},
  "Fiambre, pá": {per:"100g", kcal:112, p:14.0, c:1.3, f:5.1},
  "Fiambre, peito de frango": {per:"100g", kcal:82, p:13.7, c:2.8, f:1.3},
  "Fiambre, peito de peru": {per:"100g", kcal:85, p:13.8, c:2.6, f:1.9},
  "Fiambre, perna": {per:"100g", kcal:111, p:16.5, c:1.2, f:4.1},
  "Figo (5 variedades)": {per:"100g", kcal:79, p:0.9, c:16.3, f:0.5},
  "Figo cristalizado": {per:"100g", kcal:295, p:0.5, c:71.2, f:0.4},
  "Figo seco": {per:"100g", kcal:276, p:2.8, c:58.2, f:1.5},
  "Fisális": {per:"100g", kcal:68, p:1.8, c:11.7, f:0.6},
  "Flocos de arroz": {per:"100g", kcal:379, p:7.0, c:83.4, f:1.5},
  "Flocos de aveia": {per:"100g", kcal:366, p:13.5, c:61.7, f:5.8},
  "Flocos de centeio": {per:"100g", kcal:352, p:12.0, c:69.0, f:2.0},
  "Flocos de cereais e frutos secos tipo \"Muesli\"": {per:"100g", kcal:388, p:10.4, c:69.1, f:6.3},
  "Flocos de cevada": {per:"100g", kcal:324, p:8.3, c:64.4, f:2.0},
  "Flocos de milho tipo \"Corn Flakes\"": {per:"100g", kcal:374, p:7.9, c:81.1, f:1.1},
  "Flocos de trigo": {per:"100g", kcal:373, p:14.0, c:69.0, f:2.5},
  "Flocos de trigo com figos tipo \"Nestum\"": {per:"100g", kcal:370, p:9.0, c:76.3, f:1.5},
  "Flocos de trigo com mel tipo \"Nestum\"": {per:"100g", kcal:385, p:8.2, c:84.6, f:1.0},
  "Flocos de trigo e arroz enriquecidos com vitaminas, cálcio e ferro": {per:"100g", kcal:372, p:7.5, c:79.2, f:1.3},
  "Flocos de trigo integral tipo \"All-Bran Flakes\"": {per:"100g", kcal:349, p:10.2, c:64.2, f:1.9},
  "Folhas de rabanete cruas": {per:"100g", kcal:39, p:3.5, c:3.9, f:0.5},
  "Framboesa": {per:"100g", kcal:49, p:0.9, c:5.1, f:0.6},
  "Framboesa desidratada": {per:"100g", kcal:293, p:5.4, c:30.9, f:3.6},
  "Francesinha, com molho": {per:"100g", kcal:249, p:13.3, c:6.5, f:17.7},
  "Frango (1/4) peito e asa com pele, cozidos": {per:"100g", kcal:202, p:27.2, c:0.0, f:10.3},
  "Frango (1/4) peito e asa com pele, estufados com azeite e margarina": {per:"100g", kcal:204, p:18.5, c:1.7, f:13.5},
  "Frango (1/4) peito e asa com pele, estufados com margarina": {per:"100g", kcal:201, p:18.5, c:1.7, f:13.2},
  "Frango (1/4) peito e asa com pele, estufados sem molho": {per:"100g", kcal:223, p:29.2, c:0.0, f:11.8},
  "Frango (1/4) peito e asa com pele, grelhados": {per:"100g", kcal:235, p:28.7, c:0.0, f:13.4},
  "Frango (1/4) perna com costa e pele, assada sem molho": {per:"100g", kcal:231, p:26.9, c:0.0, f:13.7},
  "Frango (1/4) perna com costa e pele, cozida": {per:"100g", kcal:197, p:25.5, c:0.0, f:10.6},
  "Frango (1/4) perna com costa e pele, estufada com azeite e margarina": {per:"100g", kcal:203, p:17.3, c:1.7, f:13.8},
  "Frango (1/4) perna com costa e pele, estufada com margarina": {per:"100g", kcal:200, p:17.3, c:1.7, f:13.5},
  "Frango (1/4) perna com costa e pele, estufada sem molho": {per:"100g", kcal:215, p:26.9, c:0.0, f:11.9},
  "Frango (1/4), peito e asa com pele, crus": {per:"100g", kcal:196, p:20.4, c:0.0, f:12.7},
  "Frango (1/4), perna com costa e pele, crua": {per:"100g", kcal:195, p:19.1, c:0.0, f:13.0},
  "Frango (1/4), perna com costa e pele, grelhada": {per:"100g", kcal:231, p:26.9, c:0.0, f:13.7},
  "Frango inteiro com pele, assado sem molho": {per:"100g", kcal:239, p:27.6, c:0.0, f:14.3},
  "Frango inteiro com pele, cozido": {per:"100g", kcal:204, p:26.1, c:0.0, f:11.1},
  "Frango inteiro com pele, cru": {per:"100g", kcal:201, p:19.6, c:0.0, f:13.6},
  "Frango inteiro com pele, estufado com azeite e margarina": {per:"100g", kcal:224, p:19.1, c:1.8, f:15.4},
  "Frango inteiro com pele, estufado com margarina": {per:"100g", kcal:221, p:19.1, c:1.8, f:15.1},
  "Frango inteiro com pele, estufado sem molho": {per:"100g", kcal:233, p:28.8, c:0.0, f:13.1},
  "Frango inteiro com pele, grelhado": {per:"100g", kcal:239, p:27.6, c:0.0, f:14.3},
  "Frango inteiro sem pele, cozido": {per:"100g", kcal:169, p:32.8, c:0.0, f:4.2},
  "Frango inteiro sem pele, cru": {per:"100g", kcal:110, p:22.9, c:0.0, f:2.0},
  "Frango inteiro sem pele, estufado com azeite e margarina": {per:"100g", kcal:129, p:21.0, c:1.7, f:4.1},
  "Frango inteiro sem pele, estufado com margarina": {per:"100g", kcal:126, p:21.0, c:1.7, f:3.8},
  "Frango inteiro sem pele, estufado sem molho": {per:"100g", kcal:185, p:33.2, c:0.0, f:5.8},
  "Frango inteiro sem pele, grelhado": {per:"100g", kcal:168, p:31.0, c:0.0, f:4.9},
  "Frango, peito com pele estufado com azeite e margarina": {per:"100g", kcal:189, p:22.1, c:1.7, f:10.3},
  "Frango, peito com pele estufado com margarina": {per:"100g", kcal:187, p:22.1, c:1.7, f:10.0},
  "Frango, peito com pele, cozido": {per:"100g", kcal:194, p:32.1, c:0.0, f:7.3},
  "Frango, peito com pele, cru": {per:"100g", kcal:177, p:24.1, c:0.0, f:8.9},
  "Frango, peito com pele, estufado sem molho": {per:"100g", kcal:212, p:34.4, c:0.0, f:8.3},
  "Frango, peito sem pele estufado com azeite e margarina": {per:"100g", kcal:124, p:21.4, c:1.7, f:3.3},
  "Frango, peito sem pele estufado com margarina": {per:"100g", kcal:121, p:21.4, c:1.7, f:3.0},
  "Frango, peito sem pele, cozido": {per:"100g", kcal:148, p:34.5, c:0.0, f:1.1},
  "Frango, peito sem pele, cru": {per:"100g", kcal:108, p:24.1, c:0.0, f:1.2},
  "Frango, peito sem pele, estufado sem molho": {per:"100g", kcal:169, p:36.6, c:0.0, f:2.5},
  "Frango, pele crua": {per:"100g", kcal:474, p:9.7, c:0.0, f:48.3},
  "Frango, perna sem pele, cozida": {per:"100g", kcal:147, p:31.5, c:0.0, f:2.3},
  "Frango, perna sem pele, crua": {per:"100g", kcal:111, p:22.0, c:0.0, f:2.6},
  "Frango, perna sem pele, estufada com azeite e margarina": {per:"100g", kcal:124, p:19.1, c:1.6, f:4.4},
  "Frango, perna sem pele, estufada com margarina": {per:"100g", kcal:121, p:19.1, c:1.6, f:4.1},
  "Frango, perna sem pele, estufada sem molho": {per:"100g", kcal:180, p:32.9, c:0.0, f:5.4},
  "Funcho fresco": {per:"100g", kcal:32, p:2.8, c:2.6, f:0.4},
  "Galinha de angola com pele, crua": {per:"100g", kcal:152, p:23.4, c:0.0, f:6.5},
  "Galinha, coração cru": {per:"100g", kcal:149, p:15.6, c:0.7, f:9.3},
  "Galinha, fígado cru": {per:"100g", kcal:92, p:17.7, c:0.0, f:2.3},
  "Gamba crua": {per:"100g", kcal:88, p:21.5, c:0.0, f:0.2},
  "Garoupa cozida": {per:"100g", kcal:101, p:20.8, c:0.0, f:2.0},
  "Garoupa crua": {per:"100g", kcal:95, p:20.5, c:0.0, f:1.4},
  "Garoupa grelhada": {per:"100g", kcal:121, p:25.9, c:0.0, f:1.9},
  "Gelado caseiro com bolachas e natas": {per:"100g", kcal:358, p:5.1, c:36.5, f:21.2},
  "Gelado caseiro com palitos la Reine": {per:"100g", kcal:263, p:7.9, c:28.7, f:12.4},
  "Gelado de água (sorvete)": {per:"100g", kcal:132, p:0.4, c:32.6, f:0.0},
  "Gelado de leite": {per:"100g", kcal:199, p:3.6, c:21.7, f:10.9},
  "Gelatina desidratada (pó ou folha)": {per:"100g", kcal:349, p:87.0, c:0.0, f:0.1},
  "Gelatina preparada com ananás em conserva": {per:"100g", kcal:97, p:2.2, c:21.6, f:0.0},
  "Gelatina preparada com laranja e sumo de laranja": {per:"100g", kcal:84, p:2.6, c:17.4, f:0.1},
  "Geleia de casca de laranja": {per:"100g", kcal:275, p:0.3, c:68.0, f:0.0},
  "Gema de ovo de galinha, crua": {per:"100g", kcal:342, p:16.0, c:0.0, f:30.9},
  "Gema de ovo de galinha, pasteurizada": {per:"100g", kcal:294, p:15.3, c:1.3, f:25.2},
  "Gengibre fresco": {per:"100g", kcal:82, p:1.8, c:15.8, f:0.8},
  "Gérmen de trigo": {per:"100g", kcal:391, p:28.1, c:41.8, f:9.6},
  "Gin - Rum- Whisky": {per:"100g", kcal:222, p:0.0, c:0.0, f:0.0},
  "Ginja": {per:"100g", kcal:57, p:0.9, c:11.5, f:0.3},
  "Goiaba crua, polpa": {per:"100g", kcal:41, p:0.8, c:5.0, f:0.5},
  "Goraz assado com cebola, tomate, azeite e óleo alimentar": {per:"100g", kcal:117, p:14.8, c:1.5, f:5.1},
  "Goraz cozido": {per:"100g", kcal:108, p:19.2, c:0.0, f:3.5},
  "Goraz cru": {per:"100g", kcal:100, p:18.8, c:0.0, f:2.7},
  "Goraz grelhado": {per:"100g", kcal:118, p:22.4, c:0.0, f:3.2},
  "Goraz no forno": {per:"100g", kcal:110, p:18.7, c:0.7, f:2.7},
  "Grão-de-bico, demolhado, cozido": {per:"100g", kcal:119, p:6.8, c:15.1, f:2.1},
  "Grão-de-bico, seco, cru": {per:"100g", kcal:327, p:19.4, c:33.5, f:6.8},
  "Grelos de couve cozidos": {per:"100g", kcal:22, p:1.9, c:1.5, f:0.4},
  "Grelos de couve crus": {per:"100g", kcal:28, p:2.4, c:2.5, f:0.4},
  "Grelos de nabo cozidos": {per:"100g", kcal:20, p:1.8, c:1.3, f:0.4},
  "Grelos de nabo crus": {per:"100g", kcal:29, p:2.4, c:2.3, f:0.5},
  "Gressino": {per:"100g", kcal:396, p:10.7, c:67.0, f:8.7},
  "Grilo doméstico, pó": {per:"100g", kcal:506, p:58.3, c:0.1, f:28.9},
  "Groselha": {per:"100g", kcal:52, p:1.1, c:5.0, f:0.5},
  "Hambúrguer de feijão manteiga frito com azeite": {per:"100g", kcal:169, p:8.0, c:19.8, f:5.3},
  "Hambúrguer de feijão manteiga frito com óleo de milho": {per:"100g", kcal:169, p:8.0, c:19.8, f:5.3},
  "Hortelã fresca": {per:"100g", kcal:51, p:3.8, c:5.3, f:0.7},
  "Imperador assado com cebola, tomate, azeite e óleo alimentar": {per:"100g", kcal:94, p:13.7, c:1.4, f:3.1},
  "Imperador cozido": {per:"100g", kcal:84, p:19.9, c:0.0, f:0.5},
  "Imperador cru": {per:"100g", kcal:80, p:19.0, c:0.0, f:0.4},
  "Imperador grelhado": {per:"100g", kcal:97, p:23.0, c:0.0, f:0.5},
  "Inhame cru": {per:"100g", kcal:114, p:1.5, c:25.7, f:0.3},
  "Iogurte gordo, aromatizado, açucarado": {per:"100g", kcal:83, p:3.9, c:8.5, f:3.6},
  "Iogurte gordo, com polpa e/ou pedaços de fruta e cereais açucarado": {per:"100g", kcal:114, p:4.2, c:15.8, f:3.2},
  "Iogurte gordo, com polpa e/ou pedaços de fruta, açucarado": {per:"100g", kcal:96, p:4.2, c:12.4, f:3.2},
  "Iogurte grego com fruta açucarado": {per:"100g", kcal:113, p:2.7, c:13.7, f:5.0},
  "Iogurte grego magro natural": {per:"100g", kcal:56, p:5.3, c:3.9, f:2.0},
  "Iogurte líquido magro, aromatizado, açucarado": {per:"100g", kcal:62, p:3.2, c:11.6, f:0.3},
  "Iogurte líquido meio gordo, aromatizado, açucarado": {per:"100g", kcal:70, p:3.0, c:11.5, f:1.3},
  "Iogurte líquido meio gordo, natural, açucarado": {per:"100g", kcal:70, p:3.1, c:11.2, f:1.4},
  "Iogurte magro, aromatizado, açucarado": {per:"100g", kcal:69, p:5.0, c:11.8, f:0.1},
  "Iogurte magro, com cereais e edulcorantes": {per:"100g", kcal:50, p:4.3, c:5.7, f:0.4},
  "Iogurte magro, natural": {per:"100g", kcal:42, p:4.6, c:5.2, f:0.2},
  "Iogurte magro, natural, com edulcorantes": {per:"100g", kcal:47, p:5.0, c:6.3, f:0.1},
  "Iogurte meio gordo, aromatizado, açucarado": {per:"100g", kcal:79, p:4.3, c:11.3, f:1.8},
  "Iogurte meio gordo, com polpa e/ou pedaços de fruta, açucarado": {per:"100g", kcal:92, p:4.3, c:14.6, f:1.7},
  "Iogurte meio gordo, natural": {per:"100g", kcal:54, p:4.2, c:5.0, f:1.8},
  "Iogurte meio gordo, natural, açucarado": {per:"100g", kcal:91, p:4.7, c:13.1, f:2.1},
  "Iogurte sem lactose enriquecido em proteína, magro, aromatizado, com pedaços e/ou polpa de fruta, açucarado": {per:"100g", kcal:76, p:9.0, c:9.7, f:0.0},
  "Iogurte sem lactose líquido, magro, aromatizado, com polpa de fruta, açucarado": {per:"100g", kcal:78, p:3.1, c:16.0, f:0.2},
  "Iogurte sem lactose líquido, magro, aromatizado, com polpa de fruta, com edulcorantes": {per:"100g", kcal:34, p:3.3, c:5.0, f:0.1},
  "Iogurte sem lactose líquido, meio gordo, aromatizado, açucarado": {per:"100g", kcal:71, p:2.8, c:11.8, f:1.4},
  "Iogurte sem lactose líquido, meio gordo, aromatizado, com polpa de fruta, açucarado": {per:"100g", kcal:73, p:2.6, c:12.5, f:1.3},
  "Iogurte sem lactose líquido, meio gordo, natural, açucarado": {per:"100g", kcal:70, p:2.7, c:11.7, f:1.4},
  "Iogurte sem lactose magro, aromatizado, com pedaços e/ou polpa de fruta, com edulcorantes": {per:"100g", kcal:42, p:4.8, c:4.8, f:0.1},
  "Iogurte sem lactose magro, natural": {per:"100g", kcal:41, p:4.9, c:5.0, f:0.2},
  "Iogurte sem lactose meio gordo, aromatizado, açucarado": {per:"100g", kcal:76, p:3.5, c:12.0, f:1.5},
  "Iogurte sem lactose meio gordo, aromatizado, com frutos secos e cereais, açucarado": {per:"100g", kcal:98, p:3.7, c:16.1, f:1.6},
  "Iogurte sem lactose meio gordo, aromatizado, com pedaços e/ou polpa de fruta, açucarado": {per:"100g", kcal:83, p:3.7, c:13.6, f:1.3},
  "Iogurte sem lactose meio gordo, natural": {per:"100g", kcal:48, p:3.8, c:4.5, f:1.5},
  "Iogurte sem lactose meio gordo, natural, açucarado": {per:"100g", kcal:78, p:3.5, c:12.2, f:1.5},
  "Javali cru": {per:"100g", kcal:108, p:19.5, c:0.0, f:3.4},
  "Jesuíta": {per:"100g", kcal:518, p:4.1, c:54.0, f:31.2},
  "Kefir de cabra, magro, natural, sólido": {per:"100g", kcal:36, p:4.3, c:3.9, f:0.4},
  "Kefir de cabra, natural, sólido": {per:"100g", kcal:68, p:3.3, c:3.9, f:4.3},
  "Kefir, magro, natural, sólido": {per:"100g", kcal:30, p:3.4, c:3.6, f:0.1},
  "Kefir, natural, liquido": {per:"100g", kcal:62, p:3.3, c:4.4, f:3.3},
  "Kefir, natural, sólido": {per:"100g", kcal:65, p:4.1, c:3.9, f:3.5},
  "Kefir, parcialmente desnatado, açucarado, aromatizado, liquido": {per:"100g", kcal:69, p:3.3, c:10.0, f:1.6},
  "Kefir, parcialmente desnatado, aromatizado, liquido": {per:"100g", kcal:46, p:3.5, c:4.6, f:1.4},
  "Kefir, parcialmente desnatado, natural, liquido": {per:"100g", kcal:45, p:3.5, c:4.1, f:1.5},
  "Lagosta cozida": {per:"100g", kcal:90, p:20.6, c:0.2, f:0.8},
  "Lagosta crua": {per:"100g", kcal:79, p:18.2, c:0.1, f:0.7},
  "Lagostim cozido": {per:"100g", kcal:90, p:21.2, c:0.2, f:0.5},
  "Lagostim cru": {per:"100g", kcal:89, p:20.9, c:0.2, f:0.5},
  "Lampreia crua": {per:"100g", kcal:314, p:16.7, c:0.1, f:27.4},
  "Lapas cruas": {per:"100g", kcal:66, p:14.3, c:0.6, f:0.7},
  "Laranja (3 variedades)": {per:"100g", kcal:52, p:0.9, c:10.5, f:0.1},
  "Larvas de Tenebrio molitor, desidratadas": {per:"100g", kcal:500, p:52.7, c:3.1, f:29.3},
  "Lasanha à bolonhesa": {per:"100g", kcal:183, p:7.7, c:9.2, f:12.4},
  "Lebre crua": {per:"100g", kcal:113, p:21.6, c:0.0, f:3.0},
  "Leite achocolatado, sem lactose": {per:"100g", kcal:58, p:3.5, c:7.5, f:1.4},
  "Leite achocolatado, UHT": {per:"100g", kcal:65, p:3.4, c:9.7, f:1.3},
  "Leite condensado": {per:"100g", kcal:338, p:7.8, c:56.4, f:9.0},
  "Leite creme": {per:"100g", kcal:163, p:5.9, c:19.5, f:6.8},
  "Leite de cabra cru": {per:"100g", kcal:70, p:3.8, c:4.6, f:4.0},
  "Leite de coco, enlatado": {per:"100g", kcal:185, p:2.0, c:2.8, f:18.4},
  "Leite de ovelha cru": {per:"100g", kcal:93, p:5.1, c:4.2, f:6.2},
  "Leite evaporado": {per:"100g", kcal:136, p:6.6, c:9.8, f:7.8},
  "Leite fermentado (Bifidus) gordo, natural": {per:"100g", kcal:67, p:4.0, c:4.5, f:3.6},
  "Leite fermentado (Bifidus) sem lactose enriquecido com fibra, magro, aromatizado, com pedaços e/ou polpa de fruta, com sementes e/ou cereais, com frutos secos e/ou de casca rija, com edulcorantes": {per:"100g", kcal:57, p:4.2, c:6.6, f:0.8},
  "Leite fermentado (Bifidus) sem lactose líquido, meio gordo, aromatizado, com pedaços e/ou polpa de fruta, açucarado": {per:"100g", kcal:71, p:2.7, c:11.0, f:1.7},
  "Leite fermentado (Bifidus) sem lactose magro, natural, com edulcorantes": {per:"100g", kcal:51, p:5.3, c:6.2, f:0.4},
  "Leite fermentado (Bifidus) sem lactose, gordo, natural": {per:"100g", kcal:70, p:4.2, c:4.8, f:3.7},
  "Leite fermentado (Bifidus) sem lactose, magro, aromatizado, com pedaços e/ou polpa de fruta e/ou hortícolas, açucarado, com edulcorantes": {per:"100g", kcal:57, p:4.9, c:8.2, f:0.4},
  "Leite gordo especial, pasteurizado": {per:"100g", kcal:62, p:3.1, c:4.8, f:3.4},
  "Leite gordo sem lactose, enriquecido com vitaminas A, D, E e B9 (ácido fólico), UHT": {per:"100g", kcal:62, p:3.0, c:4.6, f:3.5},
  "Leite gordo, pasteurizado": {per:"100g", kcal:62, p:3.0, c:4.7, f:3.5},
  "Leite gordo, pó": {per:"100g", kcal:495, p:26.8, c:38.7, f:25.9},
  "Leite gordo, UHT": {per:"100g", kcal:62, p:3.0, c:4.7, f:3.5},
  "Leite humano": {per:"100g", kcal:66, p:1.4, c:7.5, f:3.4},
  "Leite humano, colostro": {per:"100g", kcal:60, p:2.3, c:6.3, f:2.8},
  "Leite humano, transição": {per:"100g", kcal:66, p:1.6, c:6.6, f:3.7},
  "Leite magro de pastagem, UHT": {per:"100g", kcal:33, p:3.1, c:4.9, f:0.1},
  "Leite magro sem lactose, enriquecido com proteína, aromatizado, UHT": {per:"100g", kcal:55, p:8.0, c:5.0, f:0.2},
  "Leite magro sem lactose, UHT": {per:"100g", kcal:36, p:3.4, c:5.1, f:0.2},
  "Leite magro, pó": {per:"100g", kcal:359, p:35.1, c:52.7, f:0.9},
  "Leite magro, UHT": {per:"100g", kcal:35, p:3.4, c:4.9, f:0.2},
  "Leite meio gordo de pastagem, UHT": {per:"100g", kcal:46, p:3.0, c:5.0, f:1.5},
  "Leite meio gordo sem lactose, UHT": {per:"100g", kcal:48, p:3.3, c:5.1, f:1.6},
  "Leite meio gordo, pó": {per:"100g", kcal:427, p:30.7, c:45.6, f:13.5},
  "Leite meio gordo, UHT": {per:"100g", kcal:47, p:3.3, c:4.9, f:1.6},
  "Lentilhas vermelhas, secas, cruas": {per:"100g", kcal:327, p:25.7, c:46.6, f:0.3},
  "Lentilhas, secas, cruas": {per:"100g", kcal:321, p:25.2, c:47.6, f:0.7},
  "Lentilhas, secas, demolhadas, cozidas": {per:"100g", kcal:115, p:9.1, c:16.7, f:0.3},
  "Lichia fresca": {per:"100g", kcal:70, p:0.9, c:14.8, f:0.4},
  "Licor beneditino": {per:"100g", kcal:352, p:0.0, c:34.8, f:0.0},
  "Licor de anis": {per:"100g", kcal:385, p:0.0, c:36.0, f:0.0},
  "Licor de ginja": {per:"100g", kcal:239, p:0.1, c:19.0, f:0.0},
  "Licor simples": {per:"100g", kcal:294, p:0.0, c:24.4, f:0.0},
  "Lima": {per:"100g", kcal:31, p:0.7, c:1.7, f:0.2},
  "Limão": {per:"100g", kcal:31, p:0.5, c:1.9, f:0.3},
  "Linguado cru": {per:"100g", kcal:82, p:20.1, c:0.0, f:0.2},
  "Linguado frito": {per:"100g", kcal:164, p:24.3, c:2.7, f:6.2},
  "Linguado grelhado": {per:"100g", kcal:94, p:23.1, c:0.0, f:0.2},
  "Linguiça": {per:"100g", kcal:437, p:21.5, c:0.0, f:39.0},
  "Lula crua": {per:"100g", kcal:71, p:15.8, c:0.0, f:0.9},
  "Lula estufada com cebola, tomate e azeite": {per:"100g", kcal:135, p:16.1, c:2.9, f:6.3},
  "Lula grelhada": {per:"100g", kcal:144, p:32.5, c:0.0, f:1.6},
  "Maçã (média com e sem casca)": {per:"100g", kcal:57, p:0.0, c:12.2, f:0.5},
  "Maçã assada com açúcar": {per:"100g", kcal:106, p:0.2, c:23.9, f:0.5},
  "Maçã assada sem açúcar": {per:"100g", kcal:75, p:0.3, c:15.7, f:0.5},
  "Maçã com casca": {per:"100g", kcal:64, p:0.2, c:13.4, f:0.5},
  "Maçã cozida com açúcar": {per:"100g", kcal:77, p:0.2, c:17.0, f:0.5},
  "Maçã cozida sem açúcar": {per:"100g", kcal:51, p:0.2, c:10.5, f:0.5},
  "Maçã desidratada": {per:"100g", kcal:354, p:1.1, c:74.5, f:2.9},
  "Maçã seca": {per:"100g", kcal:257, p:0.8, c:57.1, f:0.3},
  "Maçã sem casca": {per:"100g", kcal:61, p:0.2, c:12.7, f:0.5},
  "Madalena": {per:"100g", kcal:443, p:4.9, c:54.7, f:22.6},
  "Maionese caseira, com ovo e azeite": {per:"100g", kcal:657, p:4.0, c:0.0, f:71.2},
  "Maionese caseira, com ovo e óleo de soja": {per:"100g", kcal:644, p:3.9, c:0.0, f:69.8},
  "Malagueta vermelha fresca": {per:"100g", kcal:31, p:1.8, c:4.3, f:0.3},
  "Malagueta vermelha, desidratada": {per:"100g", kcal:317, p:10.6, c:41.2, f:5.8},
  "Mandioca crua": {per:"100g", kcal:145, p:1.0, c:33.8, f:0.3},
  "Manga": {per:"100g", kcal:59, p:0.5, c:11.7, f:0.3},
  "Manga desidratada": {per:"100g", kcal:340, p:2.9, c:67.4, f:1.7},
  "Manjericão fresco": {per:"100g", kcal:48, p:3.1, c:5.1, f:0.8},
  "Manjericão seco": {per:"100g", kcal:244, p:23.0, c:10.0, f:4.1},
  "Manjerona seca": {per:"100g", kcal:320, p:12.7, c:42.5, f:7.0},
  "Manteiga com sal": {per:"100g", kcal:739, p:0.1, c:0.7, f:81.8},
  "Manteiga sem sal": {per:"100g", kcal:750, p:0.1, c:0.7, f:83.0},
  "Maracujá": {per:"100g", kcal:52, p:2.6, c:5.7, f:0.4},
  "Margarina": {per:"100g", kcal:740, p:0.1, c:0.4, f:82.0},
  "Margarina 3/4, de girassol": {per:"100g", kcal:524, p:0.1, c:0.3, f:58.0},
  "Margarina culinária para folhados, com sal": {per:"100g", kcal:772, p:0.1, c:0.4, f:85.5},
  "Margarina industrial para pastelaria, com sal": {per:"100g", kcal:727, p:0.1, c:0.4, f:80.5},
  "Margarina vegetal culinária, 80% gordura, com sal": {per:"100g", kcal:722, p:0.1, c:0.4, f:80.0},
  "Margarina vegetal culinária, com alho e sal": {per:"100g", kcal:692, p:1.0, c:4.4, f:74.3},
  "Marmelada": {per:"100g", kcal:261, p:2.3, c:61.4, f:0.2},
  "Marmelo": {per:"100g", kcal:53, p:0.3, c:9.3, f:0.2},
  "Maruca cozida": {per:"100g", kcal:73, p:17.9, c:0.0, f:0.1},
  "Maruca crua": {per:"100g", kcal:70, p:17.2, c:0.0, f:0.1},
  "Massa com ovo cozida": {per:"100g", kcal:71, p:2.8, c:13.3, f:0.6},
  "Massa com ovo crua": {per:"100g", kcal:360, p:13.9, c:67.6, f:3.1},
  "Massa de pimentão": {per:"100g", kcal:44, p:2.6, c:4.4, f:1.0},
  "Massa folhada, congelada": {per:"100g", kcal:398, p:5.0, c:31.8, f:27.5},
  "Massa miúda crua": {per:"100g", kcal:356, p:12.4, c:70.0, f:1.8},
  "Massa para lasanha cozida": {per:"100g", kcal:115, p:4.0, c:22.6, f:0.7},
  "Massa para lasanha crua": {per:"100g", kcal:359, p:12.0, c:71.4, f:2.1},
  "Massa para pizza": {per:"100g", kcal:289, p:7.8, c:52.5, f:4.8},
  "Massa quebrada para quiche": {per:"100g", kcal:498, p:5.5, c:52.4, f:29.2},
  "Medronho": {per:"100g", kcal:150, p:1.2, c:31.4, f:0.6},
  "Meia-desfeita de bacalhau": {per:"100g", kcal:156, p:12.7, c:14.8, f:4.2},
  "Mel": {per:"100g", kcal:314, p:0.5, c:78.0, f:0.0},
  "Mel de cana": {per:"100g", kcal:311, p:0.3, c:77.4, f:0.0},
  "Melaço": {per:"100g", kcal:269, p:0.6, c:66.6, f:0.1},
  "Melancia": {per:"100g", kcal:32, p:0.6, c:7.3, f:0.0},
  "Melão (3 variedades)": {per:"100g", kcal:39, p:0.8, c:7.9, f:0.3},
  "Meloa": {per:"100g", kcal:39, p:1.0, c:8.2, f:0.0},
  "Merengue": {per:"100g", kcal:353, p:4.1, c:83.0, f:0.5},
  "Mexilhão cozido sem sal": {per:"100g", kcal:97, p:16.8, c:2.8, f:2.1},
  "Mexilhão cru": {per:"100g", kcal:70, p:12.1, c:2.0, f:1.5},
  "Milho doce em conserva": {per:"100g", kcal:110, p:2.9, c:18.4, f:1.9},
  "Milho, amido (pó)": {per:"100g", kcal:364, p:0.4, c:90.2, f:0.2},
  "Milho, grão seco cru": {per:"100g", kcal:368, p:9.3, c:70.3, f:4.9},
  "Millet, cru, seco": {per:"100g", kcal:362, p:11.1, c:71.2, f:3.2},
  "Minarina (meia margarina)": {per:"100g", kcal:380, p:0.9, c:0.4, f:41.6},
  "Mirtilo": {per:"100g", kcal:43, p:0.5, c:6.4, f:0.6},
  "Mirtilo desidratado": {per:"100g", kcal:317, p:3.7, c:46.8, f:4.4},
  "Miso, pasta de soja fermentada com arroz integral e cevada": {per:"100g", kcal:177, p:11.9, c:15.1, f:6.5},
  "Molho \"Béchamel\" com manteiga": {per:"100g", kcal:130, p:4.0, c:9.6, f:8.4},
  "Molho \"Béchamel\" com margarina": {per:"100g", kcal:140, p:3.6, c:9.9, f:9.5},
  "Molho branco com caldo de carne de vaca": {per:"100g", kcal:115, p:1.1, c:6.8, f:9.2},
  "Molho branco com margarina": {per:"100g", kcal:244, p:4.4, c:18.5, f:16.8},
  "Molho de bife frito com manteiga": {per:"100g", kcal:379, p:2.0, c:0.4, f:41.0},
  "Molho de carne de vaca assada com azeite e margarina": {per:"100g", kcal:586, p:2.1, c:0.3, f:64.0},
  "Molho de carne de vaca assada com margarina": {per:"100g", kcal:513, p:1.9, c:0.4, f:56.0},
  "Molho de carne de vaca estufada com azeite e margarina": {per:"100g", kcal:260, p:1.7, c:0.4, f:27.9},
  "Molho de carne de vaca estufada com vegetais, azeite e margarina": {per:"100g", kcal:267, p:1.3, c:1.3, f:28.5},
  "Molho de lombo de porco frito com banha": {per:"100g", kcal:551, p:2.2, c:0.0, f:60.2},
  "Molho de lombo de porco frito com banha e margarina": {per:"100g", kcal:498, p:2.3, c:0.1, f:54.3},
  "Molho de lombo de porco frito com margarina": {per:"100g", kcal:447, p:2.3, c:0.2, f:48.5},
  "Molho de lombo de vaca frito com creme vegetal sem sal": {per:"100g", kcal:350, p:2.2, c:0.2, f:37.8},
  "Molho de lombo de vaca frito com margarina": {per:"100g", kcal:372, p:2.2, c:0.2, f:40.3},
  "Molho de mostarda": {per:"100g", kcal:444, p:2.6, c:18.0, f:40.2},
  "Molho de soja": {per:"100g", kcal:89, p:4.7, c:17.3, f:0.0},
  "Molho de tomate": {per:"100g", kcal:107, p:1.1, c:4.9, f:8.8},
  "Molho de tomate, \"ketchup\"": {per:"100g", kcal:119, p:1.7, c:26.9, f:0.3},
  "Molho de vinagrete": {per:"100g", kcal:648, p:0.2, c:0.2, f:71.8},
  "Molho para francesinha": {per:"100g", kcal:74, p:1.1, c:4.8, f:2.6},
  "Molho verde": {per:"100g", kcal:246, p:0.7, c:2.3, f:25.6},
  "Morango": {per:"100g", kcal:32, p:0.6, c:6.0, f:0.2},
  "Morango desidratado": {per:"100g", kcal:322, p:5.8, c:50.9, f:3.8},
  "Morcela crua": {per:"100g", kcal:363, p:12.0, c:12.0, f:29.5},
  "Morcela grelhada": {per:"100g", kcal:339, p:12.9, c:13.1, f:25.9},
  "Mortadela": {per:"100g", kcal:379, p:18.3, c:1.7, f:33.2},
  "Mousse de chocolate": {per:"100g", kcal:285, p:9.5, c:31.0, f:13.1},
  "Múcua (fruto do embondeiro, baobab)": {per:"100g", kcal:212, p:2.8, c:16.3, f:0.1},
  "Nabiça crua": {per:"100g", kcal:17, p:2.0, c:1.2, f:0.0},
  "Nabiças cozidas": {per:"100g", kcal:16, p:2.1, c:0.7, f:0.0},
  "Nabo (raiz) cozido": {per:"100g", kcal:19, p:0.4, c:2.3, f:0.4},
  "Nabo (raiz) cru": {per:"100g", kcal:21, p:0.4, c:3.0, f:0.4},
  "Nata maturada pasteurizada 30% gordura": {per:"100g", kcal:306, p:1.9, c:2.7, f:32.0},
  "Nata para bater pasteurizada 34% gordura": {per:"100g", kcal:323, p:2.2, c:2.1, f:34.0},
  "Nata pasteurizada 33% gordura": {per:"100g", kcal:317, p:2.0, c:2.9, f:33.0},
  "Nata pasteurizada 36% gordura": {per:"100g", kcal:340, p:2.0, c:1.9, f:36.0},
  "Nata pasteurizada para café, 15% gordura": {per:"100g", kcal:153, p:2.0, c:2.4, f:15.0},
  "Nata UHT 35% gordura": {per:"100g", kcal:335, p:1.8, c:3.1, f:35.0},
  "Néctar de \"tutti - frutti\"": {per:"100g", kcal:46, p:0.1, c:10.8, f:0.1},
  "Néctar de alperce": {per:"100g", kcal:56, p:0.2, c:12.9, f:0.1},
  "Néctar de ananás": {per:"100g", kcal:46, p:0.2, c:10.5, f:0.1},
  "Néctar de laranja": {per:"100g", kcal:43, p:0.2, c:9.6, f:0.1},
  "Néctar de maçã": {per:"100g", kcal:48, p:0.1, c:11.3, f:0.1},
  "Néctar de maçã, \"light\"": {per:"100g", kcal:22, p:0.1, c:4.6, f:0.2},
  "Néctar de pera": {per:"100g", kcal:48, p:0.2, c:11.0, f:0.1},
  "Néctar de pêssego": {per:"100g", kcal:51, p:0.2, c:11.7, f:0.1},
  "Néctar de pêssego, \"light\"": {per:"100g", kcal:18, p:0.1, c:3.5, f:0.1},
  "Nectarina": {per:"100g", kcal:49, p:1.4, c:8.7, f:0.1},
  "Nêspera": {per:"100g", kcal:51, p:0.4, c:10.2, f:0.4},
  "Noz-moscada": {per:"100g", kcal:506, p:5.8, c:28.5, f:36.3},
  "Noz macadâmia": {per:"100g", kcal:752, p:8.0, c:5.1, f:76.0},
  "Noz pecan": {per:"100g", kcal:729, p:9.4, c:5.4, f:72.6},
  "Noz, miolo": {per:"100g", kcal:699, p:16.7, c:3.6, f:67.5},
  "Óleo \"Becel\"": {per:"100g", kcal:887, p:0.0, c:0.0, f:98.5},
  "Óleo alimentar": {per:"100g", kcal:896, p:0.0, c:0.0, f:99.5},
  "Óleo de amendoim": {per:"100g", kcal:887, p:0.0, c:0.0, f:98.5},
  "Óleo de coco": {per:"100g", kcal:900, p:0.0, c:0.0, f:100.0},
  "Óleo de girassol": {per:"100g", kcal:896, p:0.0, c:0.0, f:99.5},
  "Óleo de linhaça": {per:"100g", kcal:900, p:0.0, c:0.0, f:100.0},
  "Óleo de milho": {per:"100g", kcal:896, p:0.0, c:0.0, f:99.5},
  "Óleo de palma": {per:"100g", kcal:900, p:0.0, c:0.0, f:100.0},
  "Óleo de soja": {per:"100g", kcal:887, p:0.0, c:0.0, f:98.5},
  "Omelete": {per:"100g", kcal:136, p:12.0, c:0.2, f:9.5},
  "Omelete com manteiga": {per:"100g", kcal:199, p:13.0, c:0.0, f:16.3},
  "Omelete com margarina": {per:"100g", kcal:198, p:13.0, c:0.0, f:16.2},
  "Orégão seco": {per:"100g", kcal:265, p:9.0, c:26.4, f:4.3},
  "Ostra, crua": {per:"100g", kcal:65, p:8.6, c:3.9, f:1.7},
  "Ovo de codorniz, cru": {per:"100g", kcal:150, p:12.9, c:0.4, f:10.7},
  "Ovo de galinha inteiro, cru": {per:"100g", kcal:143, p:12.6, c:0.5, f:10.1},
  "Ovo de galinha líquido, pasteurizado": {per:"100g", kcal:131, p:11.9, c:0.0, f:9.3},
  "Ovo de galinha, cozido": {per:"100g", kcal:149, p:13.0, c:0.0, f:10.8},
  "Ovo de galinha, escalfado": {per:"100g", kcal:150, p:13.0, c:0.0, f:10.9},
  "Ovo de galinha, estrelado": {per:"100g", kcal:193, p:13.7, c:0.0, f:15.4},
  "Ovo de galinha, estrelado com azeite": {per:"100g", kcal:191, p:13.8, c:0.0, f:15.1},
  "Ovo de galinha, estrelado com manteiga": {per:"100g", kcal:194, p:13.7, c:0.0, f:15.5},
  "Ovo de galinha, estrelado com margarina": {per:"100g", kcal:194, p:13.7, c:0.0, f:15.5},
  "Ovo de galinha, mexido com manteiga": {per:"100g", kcal:197, p:13.0, c:0.0, f:16.1},
  "Ovo de galinha, mexido com margarina": {per:"100g", kcal:196, p:13.0, c:0.0, f:16.0},
  "Ovo mexido com leite e margarina": {per:"100g", kcal:213, p:11.0, c:0.9, f:18.3},
  "Paio de lombo": {per:"100g", kcal:288, p:29.2, c:0.0, f:19.0},
  "Paio de lombo entremeado": {per:"100g", kcal:361, p:22.8, c:0.0, f:30.0},
  "Pão de centeio": {per:"100g", kcal:268, p:5.9, c:56.4, f:0.8},
  "Pão de centeio integral": {per:"100g", kcal:229, p:7.7, c:41.3, f:2.1},
  "Pão de forma, de trigo com passas": {per:"100g", kcal:291, p:8.3, c:58.3, f:2.0},
  "Pão de forma, de trigo enriquecido": {per:"100g", kcal:284, p:8.7, c:54.5, f:2.7},
  "Pão de leite (trigo)": {per:"100g", kcal:259, p:7.7, c:51.4, f:1.9},
  "Pão de ló": {per:"100g", kcal:361, p:9.6, c:62.2, f:8.0},
  "Pão de milho": {per:"100g", kcal:188, p:5.3, c:37.2, f:1.2},
  "Pão de mistura de trigo e centeio": {per:"100g", kcal:272, p:9.0, c:53.8, f:1.4},
  "Pão de trigo": {per:"100g", kcal:290, p:8.4, c:57.3, f:2.2},
  "Pão de trigo com redução de sal": {per:"100g", kcal:248, p:7.0, c:51.0, f:1.2},
  "Pão de trigo integral": {per:"100g", kcal:232, p:7.6, c:39.9, f:3.0},
  "Pão de trigo integral com passas": {per:"100g", kcal:247, p:7.4, c:44.0, f:2.6},
  "Pão de trigo integral com sementes de sésamo": {per:"100g", kcal:256, p:7.7, c:43.2, f:4.0},
  "Pão de trigo integral com soja": {per:"100g", kcal:233, p:9.4, c:38.2, f:2.8},
  "Pão pita": {per:"100g", kcal:218, p:7.7, c:42.7, f:1.1},
  "Pão ralado": {per:"100g", kcal:359, p:11.2, c:71.6, f:2.3},
  "Papaia": {per:"100g", kcal:45, p:0.6, c:9.1, f:0.1},
  "Papaia desidratada": {per:"100g", kcal:361, p:4.8, c:73.3, f:0.8},
  "Pargo legítimo assado com cebola, tomate e azeite": {per:"100g", kcal:136, p:15.9, c:1.4, f:6.7},
  "Pargo legítimo cozido": {per:"100g", kcal:82, p:19.8, c:0.0, f:0.3},
  "Pargo legítimo cru": {per:"100g", kcal:79, p:19.4, c:0.0, f:0.2},
  "Pargo mulato assado com cebola, tomate e azeite": {per:"100g", kcal:137, p:15.2, c:1.4, f:7.1},
  "Pargo mulato cozido": {per:"100g", kcal:85, p:19.0, c:0.0, f:1.0},
  "Pargo mulato cru": {per:"100g", kcal:80, p:18.5, c:0.0, f:0.7},
  "Pasta de aves (paté), caseira": {per:"100g", kcal:288, p:26.9, c:4.7, f:17.5},
  "Pasta de fígado de porco (paté)": {per:"100g", kcal:363, p:10.0, c:3.2, f:34.5},
  "Pastel de bacalhau": {per:"100g", kcal:227, p:13.8, c:12.3, f:13.4},
  "Pastel de feijão": {per:"100g", kcal:322, p:6.8, c:52.0, f:9.4},
  "Pastel de nata": {per:"100g", kcal:275, p:4.7, c:38.3, f:10.6},
  "Pastel folhado": {per:"100g", kcal:415, p:7.1, c:37.4, f:26.0},
  "Pastilha elástica": {per:"100g", kcal:328, p:6.9, c:75.1, f:0.0},
  "Pato com pele, assado sem molho": {per:"100g", kcal:347, p:18.5, c:0.0, f:30.3},
  "Pato com pele, cru": {per:"100g", kcal:394, p:12.3, c:0.0, f:38.3},
  "Pato sem pele, assado com margarina": {per:"100g", kcal:276, p:36.2, c:0.0, f:14.6},
  "Pato sem pele, cru": {per:"100g", kcal:133, p:19.3, c:0.0, f:6.2},
  "Pato sem pele, estufado com margarina": {per:"100g", kcal:232, p:27.2, c:0.0, f:13.7},
  "Peixe-espada-branco cru": {per:"100g", kcal:117, p:20.3, c:0.0, f:4.0},
  "Peixe-espada-branco frito": {per:"100g", kcal:159, p:22.7, c:2.9, f:6.3},
  "Peixe-espada-branco grelhado": {per:"100g", kcal:123, p:20.2, c:0.0, f:4.7},
  "Peixe-espada-preto cru": {per:"100g", kcal:88, p:15.7, c:0.0, f:2.8},
  "Peixe-espada-preto frito": {per:"100g", kcal:259, p:24.2, c:3.2, f:16.6},
  "Peixe-espada-preto grelhado": {per:"100g", kcal:111, p:20.5, c:0.0, f:3.2},
  "Peixinhos da horta": {per:"100g", kcal:94, p:4.0, c:14.9, f:1.4},
  "Pepino cru": {per:"100g", kcal:19, p:1.4, c:1.7, f:0.6},
  "Pera (5 variedades)": {per:"100g", kcal:57, p:0.1, c:12.2, f:0.4},
  "Pera conserva em calda de açúcar": {per:"100g", kcal:121, p:0.2, c:28.9, f:0.3},
  "Pera cozida com açúcar": {per:"100g", kcal:67, p:0.3, c:14.5, f:0.4},
  "Pera cozida sem açúcar": {per:"100g", kcal:40, p:0.3, c:7.8, f:0.4},
  "Pera cristalizada": {per:"100g", kcal:285, p:0.2, c:69.8, f:0.1},
  "Pera desidratada": {per:"100g", kcal:300, p:1.9, c:59.9, f:2.6},
  "Percebes crus": {per:"100g", kcal:59, p:13.6, c:0.0, f:0.5},
  "Perdiz crua": {per:"100g", kcal:104, p:23.0, c:0.0, f:1.3},
  "Perdiz estufada com margarina": {per:"100g", kcal:212, p:24.7, c:0.7, f:11.4},
  "Peru inteiro com pele, cru": {per:"100g", kcal:137, p:20.5, c:0.0, f:6.1},
  "Peru, hambúrguer frito": {per:"100g", kcal:56, p:8.8, c:3.0, f:0.7},
  "Peru, peito com pele, cru": {per:"100g", kcal:134, p:23.0, c:0.0, f:4.7},
  "Peru, peito sem pele estufado com margarina": {per:"100g", kcal:163, p:23.1, c:1.3, f:7.1},
  "Peru, peito sem pele panado": {per:"100g", kcal:226, p:25.5, c:8.4, f:9.9},
  "Peru, peito sem pele, assado com margarina": {per:"100g", kcal:175, p:28.9, c:0.1, f:6.4},
  "Peru, peito sem pele, cru": {per:"100g", kcal:105, p:23.4, c:0.0, f:1.3},
  "Peru, perna com pele, assada com margarina": {per:"100g", kcal:212, p:24.4, c:0.0, f:12.5},
  "Peru, perna com pele, crua": {per:"100g", kcal:149, p:18.9, c:0.0, f:8.1},
  "Peru, perna com pele, estufada com margarina": {per:"100g", kcal:170, p:19.1, c:1.3, f:9.7},
  "Pescada cozida (valor médio)": {per:"100g", kcal:109, p:19.2, c:0.0, f:3.6},
  "Pescada crua (valor médio)": {per:"100g", kcal:83, p:17.6, c:0.0, f:1.4},
  "Pescada da África do Sul cozida": {per:"100g", kcal:110, p:18.9, c:0.0, f:3.8},
  "Pescada da África do Sul crua": {per:"100g", kcal:81, p:17.2, c:0.0, f:1.3},
  "Pescada da África do Sul frita": {per:"100g", kcal:175, p:23.2, c:1.7, f:8.4},
  "Pescada do Chile cozida": {per:"100g", kcal:108, p:19.5, c:0.0, f:3.3},
  "Pescada do Chile crua": {per:"100g", kcal:86, p:18.0, c:0.0, f:1.5},
  "Pescada do Chile frita": {per:"100g", kcal:171, p:20.3, c:2.6, f:8.8},
  "Pescada europeia cozida": {per:"100g", kcal:114, p:20.1, c:0.0, f:3.7},
  "Pescada europeia crua": {per:"100g", kcal:75, p:17.0, c:0.0, f:0.8},
  "Pescada europeia frita": {per:"100g", kcal:164, p:21.7, c:1.4, f:7.9},
  "Pescada frita (valor médio)": {per:"100g", kcal:173, p:21.7, c:2.1, f:8.6},
  "Pescada, ovas cruas": {per:"100g", kcal:83, p:14.3, c:0.0, f:2.9},
  "Pêssego (2 variedades)": {per:"100g", kcal:50, p:0.8, c:10.6, f:0.0},
  "Pêssego, conserva em calda de açúcar": {per:"100g", kcal:85, p:0.5, c:20.6, f:0.0},
  "Picles de pepino": {per:"100g", kcal:74, p:0.5, c:16.5, f:0.5},
  "Pimenta branca": {per:"100g", kcal:306, p:10.4, c:48.3, f:2.1},
  "Pimenta moída": {per:"100g", kcal:273, p:10.7, c:38.3, f:2.7},
  "Pimenta preta": {per:"100g", kcal:302, p:10.7, c:44.5, f:3.3},
  "Pimento cru": {per:"100g", kcal:27, p:1.6, c:2.7, f:0.6},
  "Pimento grelhado": {per:"100g", kcal:32, p:1.0, c:4.9, f:0.6},
  "Pinhão, miolo": {per:"100g", kcal:622, p:33.2, c:5.0, f:51.7},
  "Pistácio torrado e salgado": {per:"100g", kcal:616, p:18.0, c:12.6, f:53.0},
  "Pistácio torrado, sem sal": {per:"100g", kcal:616, p:18.0, c:12.6, f:53.0},
  "Pizza de queijo e tomate": {per:"100g", kcal:271, p:10.5, c:33.2, f:10.1},
  "Pizza de queijo, tomate e fiambre": {per:"100g", kcal:281, p:11.7, c:29.2, f:12.5},
  "Polvo cozido sem sal": {per:"100g", kcal:103, p:22.7, c:0.0, f:1.3},
  "Polvo cru": {per:"100g", kcal:73, p:15.6, c:0.0, f:1.2},
  "Pombo cru": {per:"100g", kcal:232, p:20.3, c:0.0, f:16.7},
  "Porco, baço": {per:"100g", kcal:107, p:17.8, c:0.4, f:3.8},
  "Porco, bife grelhado": {per:"100g", kcal:203, p:16.7, c:0.7, f:14.2},
  "Porco, cabeça": {per:"100g", kcal:355, p:14.3, c:0.3, f:32.9},
  "Porco, chispe": {per:"100g", kcal:369, p:16.1, c:0.2, f:33.8},
  "Porco, coração cru": {per:"100g", kcal:113, p:18.4, c:0.0, f:4.4},
  "Porco, coração estufado com banha e margarina": {per:"100g", kcal:193, p:20.9, c:1.0, f:10.5},
  "Porco, costeleta gorda crua": {per:"100g", kcal:355, p:17.3, c:0.0, f:31.8},
  "Porco, costeleta gorda grelhada": {per:"100g", kcal:305, p:24.3, c:0.0, f:23.1},
  "Porco, costeleta grelhada": {per:"100g", kcal:212, p:18.1, c:0.8, f:14.4},
  "Porco, costeleta meio gorda crua": {per:"100g", kcal:221, p:19.8, c:0.0, f:15.8},
  "Porco, costeleta meio gorda estufada": {per:"100g", kcal:277, p:21.1, c:0.7, f:20.5},
  "Porco, costeleta meio gorda estufada com azeite e banha": {per:"100g", kcal:280, p:21.1, c:0.7, f:20.7},
  "Porco, costeleta meio gorda estufada com azeite e margarina": {per:"100g", kcal:277, p:21.1, c:0.7, f:20.4},
  "Porco, costeleta meio gorda estufada com margarina": {per:"100g", kcal:272, p:21.1, c:0.7, f:19.9},
  "Porco, costeleta meio gorda estufada com óleo alimentar e banha": {per:"100g", kcal:280, p:21.1, c:0.7, f:20.7},
  "Porco, costeleta meio gorda estufada, sem molho": {per:"100g", kcal:284, p:26.9, c:0.0, f:19.6},
  "Porco, costeleta meio gorda frita panada": {per:"100g", kcal:341, p:22.1, c:8.6, f:24.1},
  "Porco, costeleta meio gorda grelhada": {per:"100g", kcal:261, p:27.0, c:0.0, f:17.0},
  "Porco, entrecosto cozido": {per:"100g", kcal:235, p:26.9, c:0.0, f:14.2},
  "Porco, entrecosto cru": {per:"100g", kcal:190, p:19.6, c:0.0, f:12.4},
  "Porco, entrecosto estufado com azeite e banha": {per:"100g", kcal:246, p:20.9, c:0.7, f:17.1},
  "Porco, entrecosto estufado com azeite e margarina": {per:"100g", kcal:244, p:20.9, c:0.7, f:16.8},
  "Porco, entrecosto estufado com margarina": {per:"100g", kcal:239, p:20.9, c:0.7, f:16.3},
  "Porco, entrecosto estufado com óleo alimentar e banha": {per:"100g", kcal:246, p:20.9, c:0.7, f:17.1},
  "Porco, entrecosto estufado sem molho": {per:"100g", kcal:245, p:26.6, c:0.0, f:15.4},
  "Porco, entrecosto grelhado": {per:"100g", kcal:243, p:26.8, c:0.0, f:15.1},
  "Porco, espetada grelhada": {per:"100g", kcal:285, p:13.6, c:1.3, f:24.8},
  "Porco, fígado cru": {per:"100g", kcal:129, p:20.9, c:0.0, f:5.0},
  "Porco, fígado frito com margarina e banha": {per:"100g", kcal:211, p:23.2, c:0.0, f:13.1},
  "Porco, fígado frito sem molho": {per:"100g", kcal:180, p:25.2, c:0.0, f:8.8},
  "Porco, fígado grelhado": {per:"100g", kcal:162, p:26.3, c:0.0, f:6.3},
  "Porco, hambúrguer frito, sem molho": {per:"100g", kcal:264, p:27.5, c:0.0, f:17.1},
  "Porco, hambúrguer grelhado": {per:"100g", kcal:261, p:27.8, c:0.0, f:16.6},
  "Porco, jarrete": {per:"100g", kcal:140, p:21.4, c:0.1, f:6.0},
  "Porco, língua crua": {per:"100g", kcal:220, p:16.3, c:0.0, f:17.2},
  "Porco, lombo assado": {per:"100g", kcal:220, p:27.5, c:0.2, f:11.3},
  "Porco, lombo assado com azeite e margarina": {per:"100g", kcal:219, p:27.5, c:0.2, f:11.1},
  "Porco, lombo assado com margarina": {per:"100g", kcal:208, p:28.2, c:0.0, f:10.6},
  "Porco, lombo assado com óleo alimentar e margarina": {per:"100g", kcal:219, p:27.5, c:0.2, f:11.1},
  "Porco, lombo assado, sem molho": {per:"100g", kcal:210, p:32.7, c:0.0, f:8.8},
  "Porco, lombo cru": {per:"100g", kcal:131, p:22.2, c:0.0, f:4.7},
  "Porco, lombo frito": {per:"100g", kcal:182, p:28.8, c:0.0, f:7.4},
  "Porco, lombo frito com manteiga": {per:"100g", kcal:180, p:28.8, c:0.0, f:7.2},
  "Porco, lombo frito com margarina": {per:"100g", kcal:184, p:28.8, c:0.0, f:7.6},
  "Porco, lombo frito panado": {per:"100g", kcal:249, p:25.3, c:8.5, f:12.5},
  "Porco, lombo grelhado": {per:"100g", kcal:189, p:29.1, c:0.0, f:8.1},
  "Porco, orelha crua": {per:"100g", kcal:128, p:26.0, c:0.3, f:2.5},
  "Porco, pé cru": {per:"100g", kcal:335, p:38.0, c:0.0, f:20.4},
  "Porco, perna gorda assada com azeite e margarina": {per:"100g", kcal:353, p:22.4, c:0.2, f:28.2},
  "Porco, perna gorda assada com margarina": {per:"100g", kcal:347, p:22.4, c:0.2, f:27.6},
  "Porco, perna gorda assada com óleo alimentar e margarina": {per:"100g", kcal:353, p:22.4, c:0.2, f:28.2},
  "Porco, perna gorda assada, sem molho": {per:"100g", kcal:283, p:27.6, c:0.0, f:19.2},
  "Porco, perna gorda crua": {per:"100g", kcal:239, p:18.1, c:0.0, f:18.5},
  "Porco, perna gorda grelhada": {per:"100g", kcal:287, p:25.5, c:0.0, f:20.6},
  "Porco, perna magra assada com azeite e margarina": {per:"100g", kcal:245, p:26.0, c:0.2, f:14.6},
  "Porco, perna magra assada com margarina": {per:"100g", kcal:239, p:26.0, c:0.2, f:14.0},
  "Porco, perna magra assada com óleo alimentar e margarina": {per:"100g", kcal:244, p:26.0, c:0.2, f:14.5},
  "Porco, perna magra assada, sem molho": {per:"100g", kcal:213, p:31.0, c:0.0, f:9.9},
  "Porco, perna magra crua": {per:"100g", kcal:152, p:21.0, c:0.0, f:7.5},
  "Porco, perna magra estufada com azeite e banha": {per:"100g", kcal:206, p:22.4, c:0.7, f:11.9},
  "Porco, perna magra estufada com azeite e margarina": {per:"100g", kcal:203, p:22.4, c:0.7, f:11.6},
  "Porco, perna magra estufada com margarina": {per:"100g", kcal:198, p:22.4, c:0.7, f:11.1},
  "Porco, perna magra estufada com óleo alimentar e banha": {per:"100g", kcal:206, p:22.4, c:0.7, f:11.9},
  "Porco, perna magra estufada, sem molho": {per:"100g", kcal:213, p:28.6, c:0.0, f:11.0},
  "Porco, perna magra grelhada": {per:"100g", kcal:215, p:27.5, c:0.0, f:11.7},
  "Porco, pulmões crus": {per:"100g", kcal:101, p:13.9, c:0.2, f:5.0},
  "Porco, rim cru": {per:"100g", kcal:95, p:17.0, c:0.0, f:3.0},
  "Porco, rim frito com margarina": {per:"100g", kcal:206, p:23.6, c:0.0, f:12.4},
  "Porco, rojões de carne gorda": {per:"100g", kcal:244, p:14.9, c:0.8, f:19.0},
  "Porco, rojões de carne magra": {per:"100g", kcal:140, p:11.1, c:8.7, f:5.6},
  "Porco, sangue cru": {per:"100g", kcal:72, p:16.6, c:0.4, f:0.4},
  "Porco, toucinho entremeado fresco, cru": {per:"100g", kcal:682, p:8.4, c:0.0, f:72.0},
  "Porco, toucinho entremeado fresco, grelhado sem adição de sal": {per:"100g", kcal:676, p:16.1, c:0.0, f:67.9},
  "Porco, toucinho entremeado ligeiramente salgado, cozido sem adição de sal": {per:"100g", kcal:372, p:16.7, c:0.0, f:33.9},
  "Porco, toucinho entremeado ligeiramente salgado, cru": {per:"100g", kcal:506, p:13.7, c:0.0, f:50.1},
  "Porco, toucinho entremeado magro": {per:"100g", kcal:333, p:17.4, c:0.5, f:29.1},
  "Pota crua": {per:"100g", kcal:75, p:16.3, c:0.0, f:1.1},
  "Presunto": {per:"100g", kcal:215, p:25.0, c:0.0, f:12.8},
  "Proteína texturizada de soja": {per:"100g", kcal:327, p:53.0, c:17.2, f:1.4},
  "Pudim de leite e ovos": {per:"100g", kcal:246, p:6.1, c:44.8, f:4.7},
  "Pudim flan caseiro": {per:"100g", kcal:211, p:6.2, c:36.3, f:4.5},
  "Pudim instantâneo em pó": {per:"100g", kcal:412, p:2.0, c:79.4, f:9.4},
  "Pudim instantâneo preparado com leite magro": {per:"100g", kcal:104, p:3.2, c:18.3, f:1.9},
  "Pudim instantâneo preparado com leite meio gordo": {per:"100g", kcal:113, p:3.1, c:18.3, f:3.0},
  "Puré de batata": {per:"100g", kcal:126, p:2.3, c:16.8, f:5.2},
  "Queijada de queijo fresco": {per:"100g", kcal:301, p:7.5, c:56.7, f:4.7},
  "Queijada de queijo magro": {per:"100g", kcal:292, p:6.7, c:55.4, f:4.7},
  "Queijada de requeijão": {per:"100g", kcal:311, p:7.2, c:40.8, f:13.1},
  "Queijo Amarelo da Beira Baixa": {per:"100g", kcal:361, p:20.5, c:1.5, f:30.0},
  "Queijo Brie": {per:"100g", kcal:321, p:18.8, c:0.0, f:27.3},
  "Queijo Camembert": {per:"100g", kcal:254, p:19.2, c:0.2, f:19.6},
  "Queijo Cheddar": {per:"100g", kcal:419, p:25.4, c:0.1, f:34.9},
  "Queijo creme para barrar": {per:"100g", kcal:263, p:9.3, c:6.9, f:22.0},
  "Queijo creme para barrar, alto teor polinsaturados": {per:"100g", kcal:263, p:9.3, c:6.9, f:22.0},
  "Queijo de Azeitão": {per:"100g", kcal:339, p:19.5, c:2.6, f:27.5},
  "Queijo de cabra \"Pure chèvre\"": {per:"100g", kcal:286, p:13.0, c:2.0, f:25.0},
  "Queijo de cabra atabafado, curado": {per:"100g", kcal:313, p:18.2, c:2.7, f:24.0},
  "Queijo de cabra atabafado, fresco": {per:"100g", kcal:202, p:13.0, c:2.5, f:15.4},
  "Queijo de cabra curado": {per:"100g", kcal:382, p:21.0, c:2.5, f:30.5},
  "Queijo de Castelo Branco": {per:"100g", kcal:356, p:20.8, c:1.8, f:29.2},
  "Queijo de Évora": {per:"100g", kcal:405, p:23.8, c:2.1, f:32.9},
  "Queijo de mistura (vaca, cabra e ovelha)": {per:"100g", kcal:329, p:19.6, c:2.4, f:26.7},
  "Queijo de Nisa": {per:"100g", kcal:451, p:23.4, c:2.6, f:38.0},
  "Queijo de ovelha curado": {per:"100g", kcal:401, p:22.8, c:2.4, f:33.0},
  "Queijo de ovelha, amanteigado": {per:"100g", kcal:361, p:19.7, c:1.6, f:30.3},
  "Queijo de vaca curado": {per:"100g", kcal:355, p:22.3, c:1.2, f:29.0},
  "Queijo de vaca curado, magro": {per:"100g", kcal:208, p:27.1, c:2.4, f:10.0},
  "Queijo de vaca curado, meio gordo": {per:"100g", kcal:280, p:23.0, c:1.7, f:20.1},
  "Queijo de vaca, amanteigado": {per:"100g", kcal:343, p:20.2, c:1.7, f:28.3},
  "Queijo Emmental": {per:"100g", kcal:384, p:28.9, c:0.0, f:29.7},
  "Queijo flamengo": {per:"100g", kcal:349, p:22.7, c:0.8, f:28.3},
  "Queijo flamengo light (-50% gordura)": {per:"100g", kcal:228, p:26.8, c:0.0, f:13.3},
  "Queijo fresco açucarado com sabor a fruta": {per:"100g", kcal:110, p:7.3, c:11.6, f:3.6},
  "Queijo fresco de cabra": {per:"100g", kcal:182, p:12.0, c:2.1, f:13.8},
  "Queijo fresco de ovelha": {per:"100g", kcal:204, p:11.3, c:3.9, f:15.6},
  "Queijo fresco magro": {per:"100g", kcal:96, p:13.0, c:6.9, f:1.8},
  "Queijo fresco meio gordo": {per:"100g", kcal:156, p:9.2, c:2.7, f:11.9},
  "Queijo fundido 40% gordura": {per:"100g", kcal:326, p:22.5, c:0.2, f:25.7},
  "Queijo Gouda": {per:"100g", kcal:380, p:25.3, c:0.0, f:30.6},
  "Queijo Gruyère": {per:"100g", kcal:415, p:27.2, c:1.4, f:33.3},
  "Queijo Mascarpone": {per:"100g", kcal:458, p:7.6, c:0.3, f:47.0},
  "Queijo Mestiço de Tolosa": {per:"100g", kcal:407, p:24.5, c:1.8, f:33.0},
  "Queijo Mozzarella fresco": {per:"100g", kcal:256, p:18.7, c:1.3, f:19.5},
  "Queijo Parmesão": {per:"100g", kcal:406, p:37.7, c:0.1, f:27.8},
  "Queijo Quark açucarado magro com sabor a fruta": {per:"100g", kcal:78, p:8.4, c:10.8, f:0.1},
  "Queijo Quark natural magro": {per:"100g", kcal:60, p:10.3, c:4.0, f:0.3},
  "Queijo Quark natural meio gordo": {per:"100g", kcal:125, p:8.1, c:3.9, f:8.5},
  "Queijo Raclette": {per:"100g", kcal:354, p:25.5, c:0.4, f:27.8},
  "Queijo Roquefort": {per:"100g", kcal:372, p:22.0, c:0.2, f:31.5},
  "Queijo São Jorge": {per:"100g", kcal:409, p:26.6, c:2.5, f:32.5},
  "Queijo Serpa": {per:"100g", kcal:375, p:22.0, c:2.4, f:30.5},
  "Queijo Serra da Estrela": {per:"100g", kcal:324, p:23.8, c:2.0, f:24.0},
  "Queijo Serra da Estrela, velho": {per:"100g", kcal:389, p:25.5, c:0.2, f:31.5},
  "Queque": {per:"100g", kcal:443, p:6.1, c:51.7, f:23.3},
  "Quiabo cru": {per:"100g", kcal:37, p:2.8, c:3.1, f:1.0},
  "Quiche de espinafres": {per:"100g", kcal:275, p:12.6, c:12.4, f:19.1},
  "Quiche de vegetais": {per:"100g", kcal:302, p:11.9, c:12.9, f:22.2},
  "Quiche lorraine": {per:"100g", kcal:374, p:14.4, c:23.5, f:24.5},
  "Quivi, \"Kiwi\"": {per:"100g", kcal:54, p:0.9, c:9.5, f:0.5},
  "Quivi, \"Kiwi\" desidratado": {per:"100g", kcal:333, p:6.1, c:60.6, f:2.8},
  "Rabanada": {per:"100g", kcal:294, p:4.7, c:31.3, f:16.6},
  "Rabanete cru": {per:"100g", kcal:15, p:1.0, c:1.9, f:0.2},
  "Rábano cru": {per:"100g", kcal:88, p:6.0, c:10.7, f:0.7},
  "Raia crua": {per:"100g", kcal:58, p:14.1, c:0.0, f:0.2},
  "Rancho com carne de galinha, porco e vaca": {per:"100g", kcal:84, p:5.1, c:6.5, f:3.9},
  "Rancho com carne de porco": {per:"100g", kcal:107, p:4.8, c:6.8, f:6.2},
  "Rebentos de alfalfa crus": {per:"100g", kcal:29, p:4.0, c:0.3, f:0.7},
  "Rebentos de bambu crus": {per:"100g", kcal:14, p:0.9, c:1.2, f:0.2},
  "Rebentos de feijão mungo": {per:"100g", kcal:21, p:2.0, c:2.1, f:0.2},
  "Rebentos de soja crus": {per:"100g", kcal:98, p:9.2, c:5.8, f:3.9},
  "Rebuçados": {per:"100g", kcal:381, p:0.3, c:95.0, f:0.0},
  "Requeijão de cabra": {per:"100g", kcal:197, p:10.7, c:3.4, f:15.5},
  "Requeijão de mistura (ovelha e cabra)": {per:"100g", kcal:136, p:7.8, c:3.7, f:10.0},
  "Requeijão de mistura (vaca, ovelha e cabra)": {per:"100g", kcal:179, p:13.6, c:4.9, f:11.7},
  "Requeijão de ovelha": {per:"100g", kcal:246, p:11.0, c:3.8, f:20.6},
  "Requeijão de vaca": {per:"100g", kcal:149, p:8.0, c:5.8, f:10.4},
  "Rissol": {per:"100g", kcal:280, p:7.3, c:31.8, f:13.4},
  "Rissol de camarão": {per:"100g", kcal:211, p:6.1, c:26.6, f:8.6},
  "Robalo assado com cebola, azeite, banha e manteiga": {per:"100g", kcal:192, p:20.4, c:0.6, f:11.8},
  "Robalo cozido": {per:"100g", kcal:182, p:21.0, c:0.0, f:10.9},
  "Robalo cru": {per:"100g", kcal:106, p:18.5, c:0.0, f:3.5},
  "Robalo grelhado": {per:"100g", kcal:209, p:23.0, c:0.0, f:13.0},
  "Romã": {per:"100g", kcal:60, p:0.4, c:12.0, f:0.4},
  "Rúcula crua": {per:"100g", kcal:29, p:2.6, c:2.2, f:0.7},
  "Safio cru": {per:"100g", kcal:109, p:17.7, c:0.0, f:4.2},
  "Salada de alface e tomate temperada com azeite e vinagre": {per:"100g", kcal:30, p:1.1, c:2.6, f:1.4},
  "Salada de atum": {per:"100g", kcal:104, p:6.9, c:8.4, f:4.3},
  "Salada de bacalhau com grão": {per:"100g", kcal:115, p:8.7, c:7.6, f:4.9},
  "Salada de fruta": {per:"100g", kcal:57, p:0.6, c:12.5, f:0.1},
  "Salada russa": {per:"100g", kcal:116, p:1.4, c:5.6, f:9.3},
  "Salame": {per:"100g", kcal:422, p:19.5, c:1.3, f:37.6},
  "Salicórnia fresca": {per:"100g", kcal:14, p:0.7, c:1.1, f:0.2},
  "Salmão cozido": {per:"100g", kcal:273, p:20.7, c:0.0, f:21.1},
  "Salmão cru": {per:"100g", kcal:262, p:16.2, c:0.0, f:21.9},
  "Salmão grelhado": {per:"100g", kcal:309, p:23.8, c:0.0, f:23.7},
  "Salmonete cru": {per:"100g", kcal:136, p:21.7, c:0.1, f:5.5},
  "Salpicão": {per:"100g", kcal:412, p:20.5, c:0.0, f:36.7},
  "Salsa fresca": {per:"100g", kcal:20, p:3.1, c:0.4, f:0.0},
  "Salsa seca": {per:"100g", kcal:244, p:15.8, c:14.5, f:7.0},
  "Salsicha de soja": {per:"100g", kcal:252, p:13.5, c:0.6, f:20.9},
  "Salsicha fresca crua": {per:"100g", kcal:210, p:15.5, c:0.0, f:16.4},
  "Salsicha fresca estufada com couve e azeite": {per:"100g", kcal:140, p:7.2, c:1.1, f:11.6},
  "Salsicha fresca estufada com legumes e azeite": {per:"100g", kcal:121, p:5.9, c:3.7, f:8.9},
  "Salsicha tipo Frankfurt": {per:"100g", kcal:178, p:9.0, c:2.4, f:14.7},
  "Salsicha tipo Frankfurt frita (escorrido o óleo)": {per:"100g", kcal:201, p:10.2, c:2.8, f:16.5},
  "Salsicha tipo Frankfurt grelhada": {per:"100g", kcal:211, p:12.0, c:3.2, f:16.7},
  "Sapateira crua": {per:"100g", kcal:104, p:19.5, c:0.0, f:2.9},
  "Sarda cozida": {per:"100g", kcal:174, p:19.7, c:0.0, f:10.6},
  "Sarda crua": {per:"100g", kcal:181, p:19.0, c:0.0, f:11.7},
  "Sarda grelhada": {per:"100g", kcal:191, p:22.5, c:0.0, f:11.2},
  "Sardinha frita": {per:"100g", kcal:300, p:22.5, c:8.7, f:19.4},
  "Sardinha gorda crua": {per:"100g", kcal:221, p:18.4, c:0.0, f:16.4},
  "Sardinha gorda frita": {per:"100g", kcal:247, p:23.0, c:3.5, f:15.6},
  "Sardinha gorda grelhada": {per:"100g", kcal:211, p:25.0, c:0.0, f:12.3},
  "Sardinha meio gorda conserva em água, sem espinha e sem pele": {per:"100g", kcal:174, p:22.0, c:0.0, f:9.6},
  "Sardinha meio gorda conserva em azeite": {per:"100g", kcal:202, p:22.7, c:0.8, f:12.0},
  "Sardinha meio gorda conserva em azeite (escorrido)": {per:"100g", kcal:189, p:26.3, c:0.8, f:9.0},
  "Sardinha meio gorda crua": {per:"100g", kcal:158, p:18.9, c:0.0, f:9.1},
  "Sardinha meio gorda frita": {per:"100g", kcal:174, p:20.0, c:0.5, f:10.2},
  "Sardinha meio gorda grelhada": {per:"100g", kcal:168, p:25.9, c:0.0, f:7.2},
  "Seitan": {per:"100g", kcal:139, p:25.0, c:5.4, f:1.7},
  "Sementes de abóbora, cruas, secas, miolo": {per:"100g", kcal:567, p:22.0, c:10.0, f:46.4},
  "Sementes de cânhamo secas": {per:"100g", kcal:424, p:29.5, c:2.4, f:27.9},
  "Sementes de chia": {per:"100g", kcal:456, p:14.4, c:4.6, f:34.4},
  "Sementes de coentro": {per:"100g", kcal:358, p:12.4, c:16.2, f:17.8},
  "Sementes de girassol, cruas, secas, miolo": {per:"100g", kcal:585, p:22.1, c:8.3, f:48.5},
  "Sementes de linhaça cruas": {per:"100g", kcal:487, p:25.0, c:18.1, f:31.0},
  "Sementes de melão": {per:"100g", kcal:590, p:28.5, c:9.0, f:47.7},
  "Sementes de mostarda": {per:"100g", kcal:449, p:25.5, c:15.9, f:28.8},
  "Sementes de papoila": {per:"100g", kcal:565, p:19.3, c:13.7, f:45.9},
  "Sementes de sésamo": {per:"100g", kcal:620, p:22.1, c:6.4, f:55.0},
  "Sêmola de milho": {per:"100g", kcal:350, p:8.8, c:73.8, f:1.1},
  "Shortening para pastelaria": {per:"100g", kcal:878, p:0.0, c:0.0, f:97.5},
  "Shortening para restaurante": {per:"100g", kcal:900, p:0.0, c:0.0, f:100.0},
  "Sidra (vinho de maçã)": {per:"100g", kcal:48, p:0.0, c:2.3, f:0.0},
  "Sobremesa à base de soja": {per:"100g", kcal:95, p:3.5, c:15.8, f:1.8},
  "Soja cozida sem sal": {per:"100g", kcal:151, p:12.5, c:5.6, f:7.5},
  "Soja, farinha com baixo teor de gordura": {per:"100g", kcal:314, p:44.0, c:21.8, f:2.6},
  "Soja, grão seco, cru": {per:"100g", kcal:407, p:32.8, c:18.3, f:19.3},
  "Solha crua": {per:"100g", kcal:90, p:19.0, c:0.0, f:1.6},
  "Solha frita": {per:"100g", kcal:147, p:23.0, c:8.9, f:2.0},
  "Solha grelhada": {per:"100g", kcal:104, p:21.9, c:0.0, f:1.8},
  "Sonhos": {per:"100g", kcal:389, p:8.7, c:29.2, f:26.2},
  "Sopa à lavrador": {per:"100g", kcal:51, p:1.2, c:7.6, f:1.5},
  "Sopa de abóbora": {per:"100g", kcal:33, p:0.6, c:4.0, f:1.5},
  "Sopa de agrião": {per:"100g", kcal:37, p:1.0, c:4.2, f:1.6},
  "Sopa de agrião com leite": {per:"100g", kcal:33, p:1.3, c:5.3, f:0.5},
  "Sopa de agrião com requeijão": {per:"100g", kcal:28, p:1.1, c:2.0, f:1.6},
  "Sopa de carne de porco": {per:"100g", kcal:60, p:4.0, c:7.3, f:0.9},
  "Sopa de cebola": {per:"100g", kcal:40, p:0.8, c:5.4, f:1.5},
  "Sopa de cenoura": {per:"100g", kcal:29, p:0.9, c:4.4, f:0.6},
  "Sopa de couve-branca": {per:"100g", kcal:40, p:0.8, c:5.4, f:1.5},
  "Sopa de couve-lombarda": {per:"100g", kcal:41, p:0.9, c:5.3, f:1.5},
  "Sopa de cozido": {per:"100g", kcal:36, p:2.6, c:2.9, f:1.4},
  "Sopa de ervilhas": {per:"100g", kcal:48, p:1.6, c:6.4, f:1.5},
  "Sopa de espinafres": {per:"100g", kcal:39, p:1.0, c:4.8, f:1.6},
  "Sopa de espinafres com ovos": {per:"100g", kcal:93, p:2.5, c:4.7, f:6.9},
  "Sopa de favas": {per:"100g", kcal:49, p:1.8, c:6.4, f:1.5},
  "Sopa de feijão": {per:"100g", kcal:51, p:2.5, c:4.1, f:2.1},
  "Sopa de feijão-branco com couve-portuguesa, sem adição de sal": {per:"100g", kcal:47, p:2.5, c:4.9, f:1.3},
  "Sopa de feijão-manteiga": {per:"100g", kcal:46, p:1.2, c:8.7, f:0.4},
  "Sopa de feijão-manteiga com couve-lombarda": {per:"100g", kcal:43, p:2.1, c:3.5, f:1.8},
  "Sopa de feijão-verde": {per:"100g", kcal:32, p:0.7, c:3.5, f:1.5},
  "Sopa de feijão-verde e cenoura": {per:"100g", kcal:42, p:0.9, c:5.8, f:1.5},
  "Sopa de feijão-verde e nabo": {per:"100g", kcal:36, p:0.7, c:3.4, f:1.9},
  "Sopa de grão à moda da avó": {per:"100g", kcal:107, p:4.7, c:15.1, f:2.3},
  "Sopa de grão com arroz e espinafres": {per:"100g", kcal:60, p:2.4, c:7.0, f:2.1},
  "Sopa de grão com arroz, espinafres e coentros": {per:"100g", kcal:45, p:2.1, c:5.3, f:1.3},
  "Sopa de grão com espinafres": {per:"100g", kcal:55, p:2.6, c:5.1, f:2.3},
  "Sopa de nabiças (ou de grelos de nabo)": {per:"100g", kcal:40, p:1.0, c:5.8, f:1.2},
  "Sopa de peixe": {per:"100g", kcal:17, p:1.3, c:1.3, f:0.6},
  "Sopa de peixe com massa": {per:"100g", kcal:46, p:2.8, c:5.8, f:1.1},
  "Sopa de tomate": {per:"100g", kcal:31, p:1.1, c:4.4, f:0.8},
  "Sopa de vegetais": {per:"100g", kcal:11, p:0.8, c:1.2, f:0.2},
  "Sopa juliana": {per:"100g", kcal:31, p:0.9, c:4.3, f:0.9},
  "Sopa, caldo verde": {per:"100g", kcal:43, p:1.3, c:5.3, f:1.7},
  "Sopa, canja de galinha": {per:"100g", kcal:40, p:2.0, c:5.8, f:0.9},
  "Sopa, creme de cenoura": {per:"100g", kcal:34, p:0.6, c:4.4, f:1.4},
  "Sopa, puré de feijão": {per:"100g", kcal:43, p:1.6, c:4.5, f:1.6},
  "Sopa, puré de vegetais": {per:"100g", kcal:42, p:1.0, c:5.5, f:1.5},
  "Sucedâneo de café, 20% de café, pó": {per:"100g", kcal:359, p:6.5, c:77.0, f:2.8},
  "Sucedâneo de café, pó": {per:"100g", kcal:375, p:5.0, c:81.0, f:3.4},
  "Sultanas": {per:"100g", kcal:304, p:2.7, c:69.4, f:0.4},
  "Sumo de ananás, 100%": {per:"100g", kcal:45, p:0.5, c:10.3, f:0.0},
  "Sumo de ananás, concentrado": {per:"100g", kcal:265, p:0.0, c:64.7, f:0.0},
  "Sumo de laranja, 100%": {per:"100g", kcal:45, p:0.5, c:10.3, f:0.0},
  "Sumo de laranja, concentrado": {per:"100g", kcal:272, p:0.1, c:64.9, f:0.7},
  "Sumo de limão, fresco (espremido)": {per:"100g", kcal:25, p:0.3, c:1.5, f:0.0},
  "Sumo de maçã, 100%": {per:"100g", kcal:44, p:0.5, c:10.3, f:0.0},
  "Sumo de pêssego, 100%": {per:"100g", kcal:50, p:0.5, c:11.5, f:0.0},
  "Sumo de tomate, 100%": {per:"100g", kcal:21, p:1.1, c:3.5, f:0.0},
  "Tahini": {per:"100g", kcal:661, p:18.5, c:11.6, f:58.9},
  "Tâmara fresca": {per:"100g", kcal:147, p:1.2, c:33.2, f:0.1},
  "Tâmara seca": {per:"100g", kcal:298, p:2.5, c:67.3, f:0.3},
  "Tamarilho sem pele": {per:"100g", kcal:34, p:2.0, c:4.6, f:0.3},
  "Tamarindo cru": {per:"100g", kcal:242, p:2.3, c:54.9, f:0.3},
  "Tamboril cru": {per:"100g", kcal:73, p:17.9, c:0.0, f:0.2},
  "Tamboril grelhado": {per:"100g", kcal:88, p:21.4, c:0.0, f:0.3},
  "Tângera": {per:"100g", kcal:41, p:0.7, c:7.8, f:0.1},
  "Tangerina": {per:"100g", kcal:44, p:0.7, c:8.7, f:0.1},
  "Tapioca": {per:"100g", kcal:356, p:0.3, c:87.5, f:0.2},
  "Tarte de maçã": {per:"100g", kcal:200, p:1.8, c:29.3, f:8.0},
  "Tarte de maçã e pêssego": {per:"100g", kcal:224, p:4.4, c:36.7, f:6.2},
  "Tisana, infusão de ervas": {per:"100g", kcal:1, p:0.0, c:0.2, f:0.0},
  "Tofu frito com azeite": {per:"100g", kcal:108, p:8.7, c:1.1, f:7.6},
  "Tofu frito com óleo de milho": {per:"100g", kcal:108, p:8.7, c:1.1, f:7.6},
  "Tofu simples": {per:"100g", kcal:77, p:8.5, c:0.7, f:4.4},
  "Tomate cherry cru": {per:"100g", kcal:30, p:1.0, c:4.0, f:0.8},
  "Tomate concentrado": {per:"100g", kcal:82, p:3.7, c:14.3, f:0.3},
  "Tomate cru": {per:"100g", kcal:21, p:0.8, c:3.1, f:0.3},
  "Tomate em conserva ao natural": {per:"100g", kcal:21, p:1.0, c:3.2, f:0.3},
  "Tomate seco": {per:"100g", kcal:296, p:10.5, c:46.0, f:3.9},
  "Tomilho fresco": {per:"100g", kcal:52, p:1.5, c:7.4, f:1.2},
  "Tomilho seco": {per:"100g", kcal:321, p:9.1, c:45.3, f:7.4},
  "Toranja": {per:"100g", kcal:36, p:0.9, c:6.0, f:0.1},
  "Torta de chocolate e chantilly": {per:"100g", kcal:369, p:8.0, c:29.6, f:23.9},
  "Tosta de trigo": {per:"100g", kcal:377, p:12.5, c:69.7, f:4.2},
  "Tosta de trigo integral": {per:"100g", kcal:373, p:15.4, c:62.6, f:5.1},
  "Tosta de trigo sem sal": {per:"100g", kcal:379, p:11.3, c:72.7, f:3.8},
  "Tosta de trigo simples": {per:"100g", kcal:379, p:11.3, c:72.7, f:3.8},
  "Tremoço cozido, sem sal": {per:"100g", kcal:124, p:16.0, c:7.2, f:2.4},
  "Tremoço, cozido e salgado": {per:"100g", kcal:115, p:15.7, c:3.7, f:2.4},
  "Trigo Sarraceno (grão) cru": {per:"100g", kcal:337, p:12.4, c:61.3, f:2.5},
  "Tripa de porco fresca": {per:"100g", kcal:180, p:7.6, c:0.0, f:16.6},
  "Tripa de vaca crua": {per:"100g", kcal:160, p:16.3, c:0.1, f:10.5},
  "Truta arco-íris crua": {per:"100g", kcal:92, p:17.8, c:0.0, f:2.3},
  "Truta arco-íris grelhada": {per:"100g", kcal:119, p:21.3, c:0.0, f:3.7},
  "Túbera (trufa) crua": {per:"100g", kcal:77, p:3.3, c:14.5, f:0.3},
  "Uva branca (5 variedades)": {per:"100g", kcal:78, p:0.3, c:17.3, f:0.5},
  "Uva de mesa (branca e tinta)": {per:"100g", kcal:73, p:0.6, c:15.7, f:0.5},
  "Uva seca (passas)": {per:"100g", kcal:300, p:3.0, c:68.2, f:0.8},
  "Uva tinta (5 variedades)": {per:"100g", kcal:83, p:0.3, c:18.6, f:0.5},
  "Vaca assada com azeite e margarina": {per:"100g", kcal:280, p:24.2, c:0.0, f:20.4},
  "Vaca assada com azeite, margarina e óleo alimentar": {per:"100g", kcal:280, p:24.2, c:0.0, f:20.4},
  "Vaca assada com margarina": {per:"100g", kcal:273, p:24.2, c:0.0, f:19.6},
  "Vaca assada com óleo alimentar e margarina": {per:"100g", kcal:280, p:24.2, c:0.0, f:20.4},
  "Vaca assada, sem molho": {per:"100g", kcal:192, p:26.9, c:0.0, f:9.4},
  "Vaca magra cozida": {per:"100g", kcal:259, p:33.7, c:0.0, f:13.8},
  "Vaca magra estufada": {per:"100g", kcal:226, p:21.8, c:1.2, f:14.2},
  "Vaca magra estufada à jardineira": {per:"100g", kcal:111, p:5.5, c:11.4, f:4.4},
  "Vaca magra estufada com azeite e margarina": {per:"100g", kcal:226, p:21.8, c:1.2, f:14.2},
  "Vaca magra estufada com margarina": {per:"100g", kcal:220, p:21.8, c:1.2, f:13.6},
  "Vaca magra estufada com óleo alimentar e margarina": {per:"100g", kcal:226, p:21.8, c:1.2, f:14.2},
  "Vaca magra estufada, sem molho": {per:"100g", kcal:234, p:31.5, c:0.0, f:12.0},
  "Vaca meio gorda estufada": {per:"100g", kcal:278, p:21.4, c:1.2, f:20.2},
  "Vaca meio gorda estufada com azeite e margarina": {per:"100g", kcal:278, p:21.4, c:1.2, f:20.2},
  "Vaca meio gorda estufada com margarina": {per:"100g", kcal:273, p:21.4, c:1.2, f:19.6},
  "Vaca meio gorda estufada com óleo alimentar e margarina": {per:"100g", kcal:278, p:21.4, c:1.2, f:20.2},
  "Vaca meio gorda estufada, sem molho": {per:"100g", kcal:280, p:31.8, c:0.0, f:17.0},
  "Vaca para assar crua": {per:"100g", kcal:174, p:19.4, c:0.0, f:10.7},
  "Vaca para cozer ou estufar magra crua": {per:"100g", kcal:175, p:21.7, c:0.0, f:9.8},
  "Vaca para cozer ou estufar meio gorda crua": {per:"100g", kcal:227, p:21.3, c:0.0, f:15.8},
  "Vaca, bife à café": {per:"100g", kcal:226, p:16.9, c:1.6, f:16.5},
  "Vaca, bife à Marrare com manteiga": {per:"100g", kcal:368, p:16.0, c:0.9, f:33.3},
  "Vaca, bife à Marrare com margarina": {per:"100g", kcal:363, p:16.0, c:0.8, f:32.8},
  "Vaca, bife com ovo a cavalo, frito com banha": {per:"100g", kcal:172, p:17.2, c:0.4, f:11.2},
  "Vaca, bife com ovo a cavalo, frito com manteiga": {per:"100g", kcal:155, p:17.4, c:0.5, f:9.2},
  "Vaca, bife cru (valor médio de acém, alcatra e lombo)": {per:"100g", kcal:122, p:20.9, c:0.0, f:4.3},
  "Vaca, bife frito com manteiga (valor médio de acém, alcatra e lombo)": {per:"100g", kcal:201, p:24.2, c:0.1, f:11.5},
  "Vaca, bife frito, sem molho (valor médio de acém, alcatra e lombo)": {per:"100g", kcal:183, p:28.8, c:0.0, f:7.5},
  "Vaca, bife grelhado (valor médio de acém, alcatra e lombo)": {per:"100g", kcal:163, p:26.4, c:0.0, f:6.4},
  "Vaca, cachaço cru": {per:"100g", kcal:137, p:21.3, c:0.3, f:5.6},
  "Vaca, coração cozido": {per:"100g", kcal:123, p:23.4, c:0.0, f:3.3},
  "Vaca, coração cru": {per:"100g", kcal:92, p:17.0, c:0.0, f:2.7},
  "Vaca, coração estufado com banha e margarina": {per:"100g", kcal:154, p:17.7, c:0.9, f:7.8},
  "Vaca, espetada grelhada": {per:"100g", kcal:213, p:23.5, c:0.8, f:12.8},
  "Vaca, fígado cru": {per:"100g", kcal:132, p:20.9, c:2.1, f:4.4},
  "Vaca, fígado frito sem molho": {per:"100g", kcal:171, p:24.5, c:2.5, f:7.0},
  "Vaca, hambúrguer cru": {per:"100g", kcal:142, p:20.2, c:0.0, f:6.8},
  "Vaca, hambúrguer frito": {per:"100g", kcal:207, p:19.1, c:1.2, f:13.8},
  "Vaca, hambúrguer grelhado": {per:"100g", kcal:183, p:27.3, c:0.0, f:8.2},
  "Vaca, língua crua": {per:"100g", kcal:199, p:15.9, c:0.0, f:15.0},
  "Vaca, língua estufada, sem molho": {per:"100g", kcal:267, p:19.8, c:0.0, f:20.9},
  "Vaca, lombo magro assado com azeite e margarina": {per:"100g", kcal:205, p:26.2, c:0.0, f:11.1},
  "Vaca, lombo magro assado com azeite, manteiga e óleo alimentar": {per:"100g", kcal:207, p:26.2, c:0.0, f:11.4},
  "Vaca, lombo magro assado com margarina": {per:"100g", kcal:198, p:26.2, c:0.0, f:10.4},
  "Vaca, lombo magro assado com óleo alimentar e margarina": {per:"100g", kcal:205, p:26.2, c:0.0, f:11.1},
  "Vaca, lombo magro assado, sem molho": {per:"100g", kcal:172, p:29.2, c:0.0, f:6.1},
  "Vaca, lombo magro cru": {per:"100g", kcal:114, p:21.0, c:0.0, f:3.3},
  "Vaca, lombo magro no forno, com tomate, cebola, cenoura e alho": {per:"100g", kcal:128, p:11.9, c:2.5, f:6.8},
  "Vaca, picanha grelhada": {per:"100g", kcal:194, p:21.7, c:0.0, f:11.9},
  "Vaca, rim cru": {per:"100g", kcal:92, p:18.0, c:0.0, f:2.2},
  "Veado cru": {per:"100g", kcal:112, p:20.6, c:0.0, f:3.3},
  "Vieira, crua": {per:"100g", kcal:83, p:18.5, c:0.0, f:1.0},
  "Vinagre": {per:"100g", kcal:22, p:0.3, c:0.6, f:0.0},
  "Vinho branco de uvas sobreamadurecidas": {per:"100g", kcal:110, p:0.0, c:10.3, f:0.0},
  "Vinho da Madeira": {per:"100g", kcal:147, p:0.0, c:7.5, f:0.0},
  "Vinho do Porto, doce": {per:"100g", kcal:167, p:0.1, c:14.0, f:0.0},
  "Vinho do Porto, meio seco": {per:"100g", kcal:141, p:0.1, c:6.5, f:0.0},
  "Vinho do Porto, seco": {per:"100g", kcal:138, p:0.1, c:4.0, f:0.0},
  "Vinho espumante, Bruto": {per:"100g", kcal:74, p:0.0, c:1.1, f:0.0},
  "Vinho espumante, Doce": {per:"100g", kcal:110, p:0.1, c:12.0, f:0.0},
  "Vinho espumante, Extra bruto": {per:"100g", kcal:71, p:0.0, c:0.7, f:0.0},
  "Vinho espumante, Extra seco": {per:"100g", kcal:76, p:0.0, c:2.2, f:0.0},
  "Vinho espumante, Meio seco": {per:"100g", kcal:80, p:0.0, c:4.1, f:0.0},
  "Vinho espumante, Seco": {per:"100g", kcal:77, p:0.0, c:3.1, f:0.0},
  "Vinho frisante": {per:"100g", kcal:68, p:0.0, c:2.0, f:0.0},
  "Vinho licoroso, teor alcoólico  ≥17 e <20%vol.": {per:"100g", kcal:126, p:0.0, c:6.1, f:0.0},
  "Vinho licoroso, teor alcoólico <17%vol.": {per:"100g", kcal:123, p:0.0, c:7.8, f:0.0},
  "Vinho licoroso, teor alcoólico ≥20% vol.": {per:"100g", kcal:147, p:0.0, c:7.5, f:0.0},
  "Vinho maduro branco, teor alcoólico <12,5% vol.": {per:"100g", kcal:74, p:0.0, c:1.1, f:0.0},
  "Vinho maduro branco, teor alcoólico ≥12,5% vol.": {per:"100g", kcal:98, p:0.0, c:1.1, f:0.0},
  "Vinho maduro palhete": {per:"100g", kcal:65, p:0.1, c:0.1, f:0.0},
  "Vinho maduro tinto, teor alcoólico <12,5% vol.": {per:"100g", kcal:72, p:0.0, c:0.9, f:0.0},
  "Vinho maduro tinto, teor alcoólico ≥12,5% vol.": {per:"100g", kcal:96, p:0.0, c:0.9, f:0.0},
  "Vinho rosé de uvas sobreamadurecidas": {per:"100g", kcal:107, p:0.0, c:9.3, f:0.0},
  "Vinho rosé, teor alcoólico <12,5% vol.": {per:"100g", kcal:71, p:0.0, c:1.3, f:0.0},
  "Vinho rosé, teor alcoólico ≥12,5% vol.": {per:"100g", kcal:103, p:0.0, c:0.9, f:0.0},
  "Vinho verde branco": {per:"100g", kcal:60, p:0.0, c:0.1, f:0.0},
  "Vinho verde tinto": {per:"100g", kcal:59, p:0.0, c:0.3, f:0.0},
  "Vitela, bife cru": {per:"100g", kcal:149, p:19.9, c:0.2, f:7.6},
  "Vitela, bife frito": {per:"100g", kcal:229, p:19.0, c:0.4, f:16.4},
  "Vitela, chambão cru": {per:"100g", kcal:195, p:20.3, c:0.2, f:12.6},
  "Vitela, coração cru": {per:"100g", kcal:100, p:16.8, c:0.0, f:3.6},
  "Vitela, costeleta crua": {per:"100g", kcal:121, p:20.0, c:0.0, f:4.5},
  "Vitela, costeleta frita com margarina": {per:"100g", kcal:183, p:23.4, c:0.0, f:9.9},
  "Vitela, costeleta frita panada": {per:"100g", kcal:148, p:19.7, c:3.4, f:5.3},
  "Vitela, costeleta frita sem molho": {per:"100g", kcal:159, p:24.3, c:0.0, f:6.9},
  "Vitela, costeleta grelhada": {per:"100g", kcal:131, p:25.2, c:0.0, f:3.3},
  "Vitela, fígado cru": {per:"100g", kcal:119, p:20.3, c:1.5, f:3.5},
  "Vitela, fígado frito com margarina e banha": {per:"100g", kcal:201, p:22.6, c:1.7, f:11.5},
  "Vitela, fígado frito sem molho": {per:"100g", kcal:179, p:24.6, c:1.5, f:8.3},
  "Vitela, fígado grelhado": {per:"100g", kcal:153, p:25.7, c:1.9, f:4.7},
  "Vitela, lombo assado com azeite e margarina": {per:"100g", kcal:225, p:23.0, c:0.2, f:14.4},
  "Vitela, lombo assado com azeite, margarina e óleo alimentar": {per:"100g", kcal:225, p:23.0, c:0.2, f:14.4},
  "Vitela, lombo assado com margarina e óleo alimentar": {per:"100g", kcal:225, p:23.0, c:0.2, f:14.4},
  "Vitela, lombo assado, sem molho": {per:"100g", kcal:151, p:25.1, c:0.0, f:5.6},
  "Vitela, lombo cru": {per:"100g", kcal:148, p:19.9, c:0.0, f:7.6},
  "Vitela, lombo frito com margarina": {per:"100g", kcal:217, p:23.5, c:0.0, f:13.7},
  "Vitela, lombo frito, sem molho": {per:"100g", kcal:195, p:24.9, c:0.0, f:10.6},
  "Vitela, lombo grelhado": {per:"100g", kcal:150, p:25.0, c:0.0, f:5.6},
  "Vitela, pá crua": {per:"100g", kcal:138, p:23.3, c:0.3, f:4.9},
  "Vitela, peito magro cozido": {per:"100g", kcal:171, p:24.8, c:0.0, f:8.0},
  "Vitela, peito magro cru": {per:"100g", kcal:147, p:19.6, c:0.0, f:7.6},
  "Vitela, peito magro estufado": {per:"100g", kcal:208, p:22.9, c:0.6, f:12.6},
  "Vitela, peito magro estufado com azeite e margarina": {per:"100g", kcal:208, p:22.9, c:0.6, f:12.6},
  "Vitela, peito magro estufado com azeite, margarina e óleo alimentar": {per:"100g", kcal:208, p:22.9, c:0.6, f:12.6},
  "Vitela, peito magro estufado com margarina e óleo alimentar": {per:"100g", kcal:208, p:22.9, c:0.6, f:12.6},
  "Vitela, peito magro estufado, sem molho": {per:"100g", kcal:179, p:26.0, c:0.0, f:8.3},
  "Wasabi, raiz crua": {per:"100g", kcal:100, p:4.8, c:15.8, f:0.6},
};

// Fase 17: alimentos personalizados (lidos de rótulo por OCR ou escritos à
// mão) acrescentados pelo profissional — guardados na tabela custom_foods
// e fundidos aqui a cada arranque, para ficarem disponíveis a todos os
// alunos seguintes, não só o que estava a ser editado quando foram criados.
// Nunca substitui um alimento já existente (INSA ou curado) com o mesmo
// nome — evita que um nome ambíguo escrito pelo profissional apague, por
// engano, um valor de referência já validado.
function mergeCustomFood(row){
  if (!row || !row.name || FOOD_DB[row.name]) return false;
  FOOD_DB[row.name] = {per: row.per || "100g", kcal: row.kcal, p: row.protein, c: row.carbs, f: row.fat};
  var group = FOOD_GROUPS[resolveGroup(row.food_group)];
  if (group && !group.some(function(o){ return o.name === row.name; })){
    group.push({name: row.name, qty: qtyStringWithBeverageUnit(row.name, "100 g")});
  }
  return true;
}

function loadCustomFoods(){
  if (!sbReady) return Promise.resolve();
  return sb.from("custom_foods").select("*").then(function(res){
    if (res.error || !res.data) return;
    res.data.forEach(mergeCustomFood);
  }).catch(function(){});
}

// Fase 34: catálogo de produtos de marca de supermercado (food_products),
// substitui gradualmente os produtos escritos diretamente no código na
// Fase 30. Só "verified" chega aqui (o pedido em loadFoodProducts já filtra
// por isso) — "pending"/"rejected" só aparecem no Catálogo do profissional.
// Nome final "Nome (Marca)", com "· Retalhista" a seguir só quando o
// produto está associado a exatamente 1 supermercado (0 ou 2+ retalhistas
// ficam sem sufixo, para não ser ambíguo nem repetir o mesmo nome duas
// vezes na pesquisa).
function foodProductDisplayName(row, retailers){
  var base = row.name + " (" + row.brand + ")";
  if (retailers && retailers.length === 1) return base + " · " + retailers[0].retailer;
  return base;
}

var FOOD_RETAILERS = {}; // nome do alimento -> supermercados associados no catálogo (food_product_retailers)
var CATALOG_MERGED = {}; // nomes que vieram do catálogo (duas linhas com o mesmo nome e marca não se misturam)
function mergeFoodProduct(row, retailers){
  if (!row || !row.name || !row.brand) return false;
  var name = foodProductDisplayName(row, retailers);
  var unit = String(row.package_unit || "").trim().toLowerCase(); // o editor aceita texto livre: "mL", "G"...
  var hasPack = (unit === "g" || unit === "ml") && row.package_quantity > 0;
  var wholePack = hasPack && row.package_quantity <= 350 && hasWholePackFood(row, name);
  if (FOOD_DB[name]){
    // nunca substitui um alimento já existente (INSA, curado, Fase 30 ou custom_foods); a um alimento da app (não de outra linha do catálogo)
    // só acrescenta o tamanho da embalagem se ainda não se conhecia, e a quantidade-padrão passa a ser a embalagem
    if (wholePack && !CATALOG_MERGED[name] && !(FOOD_PACKS[name] > 0)){
      FOOD_PACKS[name] = row.package_quantity;
      Object.keys(FOOD_GROUPS).forEach(function(g){
        FOOD_GROUPS[g].forEach(function(o){
          if (o.name === name && /^100 (g|ml)$/.test(o.qty)) o.qty = qtyStringWithBeverageUnit(name, row.package_quantity + " g");
        });
      });
    }
    return false;
  }
  CATALOG_MERGED[name] = true;
  if (retailers && retailers.length) FOOD_RETAILERS[name] = retailers.map(function(r){ return r.retailer; });
  FOOD_DB[name] = {per: "100g", kcal: row.kcal, p: row.protein, c: row.carbs, f: row.fat};
  if (wholePack) FOOD_PACKS[name] = row.package_quantity; // embalagem individual conhecida: o plano usa embalagens inteiras
  var group = FOOD_GROUPS[resolveGroup(row.food_group)];
  if (group && !group.some(function(o){ return o.name === name; })){
    // produtos de dose única (ex.: uma barra de 55 g, um iogurte de 160 g) propõem a embalagem como quantidade-padrão
    var single = hasPack && (row.package_quantity <= 150 || wholePack);
    group.push({name: name, qty: qtyStringWithBeverageUnit(name, single ? row.package_quantity + " g" : "100 g")});
  }
  return true;
}

/* O Supabase devolve no máximo 1000 linhas por pedido — o catálogo já tem milhares de produtos,
   por isso lê-se em páginas de 1000 (ordenadas por id para a paginação ser estável). */
function fetchAllFoodProductPages(makeQuery){
  var all = [];
  function next(from){
    return makeQuery().range(from, from + 999).then(function(res){
      if (res.error) return res;
      var rows = res.data || [];
      all = all.concat(rows);
      if (rows.length < 1000) return {data: all, error: null};
      return next(from + 1000);
    });
  }
  return next(0);
}

function loadFoodProducts(){
  if (!sbReady) return Promise.resolve();
  return fetchAllFoodProductPages(function(){ return sb.from("food_products").select("*, food_product_retailers(*)").eq("verification_status", "verified").order("id"); }).then(function(res){
    if (res.error || !res.data) return;
    res.data.forEach(function(row){ mergeFoodProduct(row, row.food_product_retailers); });
  }).catch(function(){});
}

function parseQtyAmount(qty){
  qty = (qty||"").trim();
  if (/vontade/i.test(qty)) return {kind:"fixed", value:1};
  var m = qty.match(/^([\d.]+)\s*colher(es)?\s*de\s*sopa/i); if (m) return {kind:"g", value:parseFloat(m[1])*15};
  m = qty.match(/^([\d.]+)\s*colher(es)?\s*de\s*ch[áa]/i); if (m) return {kind:"g", value:parseFloat(m[1])*5};
  m = qty.match(/^([\d.]+)\s*por[çc][ãa](o|es)/i); if (m) return {kind:"unit", value:parseFloat(m[1])};
  m = qty.match(/^(\d+)\s*unid/i); if (m) return {kind:"unit", value:parseInt(m[1],10)};
  m = qty.match(/^(\d+)\s*pe[çc]a/i); if (m) return {kind:"unit", value:parseInt(m[1],10)};
  m = qty.match(/^([\d.]+)\s*g\b/i); if (m) return {kind:"g", value:parseFloat(m[1])};
  m = qty.match(/^([\d.]+)\s*ml\b/i); if (m) return {kind:"g", value:parseFloat(m[1])};
  return {kind:"fixed", value:1};
}

function round1(n){ return Math.round(n*10)/10; }

function foodNutrition(name, qty){
  var db = FOOD_DB[name];
  if (!db) return {kcal:0, p:0, c:0, f:0};
  var amt = parseQtyAmount(qty);
  var scale = 1;
  if (db.per==="100g" && amt.kind==="g") scale = amt.value/100;
  else if (db.per==="unit" && amt.kind==="unit") scale = amt.value;
  else if (db.per==="fixed") scale = amt.value;
  return { kcal: Math.round(db.kcal*scale), p: round1(db.p*scale), c: round1(db.c*scale), f: round1(db.f*scale) };
}

// Fase 31: ao escolher/ajustar um alimento no editor de refeições, mostra
// logo a info nutricional — por 100g (ou por unidade, para alimentos como
// "Ovos") e para a dose que está de facto a ser adicionada — em vez de o
// profissional ter de adivinhar ou ir consultar a base à parte. Sem
// info para "à vontade" (per:"fixed"): não há dose nenhuma a mostrar.
function foodNutritionPreviewHtml(name, amount){
  var db = FOOD_DB[name];
  if (!db || db.per === "fixed") return "";
  var isUnit = db.per === "unit";
  var unit = isUnit ? "unid." : (isBeverage(name) ? "ml" : "g");
  var defaultAmt = isUnit ? 1 : 100;
  amount = (amount > 0) ? amount : defaultAmt;
  var qty = isUnit ? (Math.max(1, Math.round(amount)) + " unid.") : (Math.max(1, Math.round(amount)) + " " + unit);
  var dose = foodNutrition(name, qty);
  var baseLabel = isUnit ? "Por unidade" : ("Por 100" + unit);
  return "<div class=\"food-nutri-preview\">" +
    "<div class=\"muted-p\" style=\"font-size:0.72rem;\">" + baseLabel + ": " + Math.round(db.kcal) + " kcal · P " + round1(db.p) + "g · H " + round1(db.c) + "g · G " + round1(db.f) + "g</div>" +
    "<div class=\"muted-p\" style=\"font-size:0.72rem;\">Nesta dose (" + qty + "): " + dose.kcal + " kcal · P " + dose.p + "g · H " + dose.c + "g · G " + dose.f + "g</div>" +
  "</div>";
}

function sumNutrition(list){
  return list.reduce(function(acc,n){ acc.kcal+=n.kcal; acc.p+=n.p; acc.c+=n.c; acc.f+=n.f; return acc; }, {kcal:0,p:0,c:0,f:0});
}

function foodsTotals(foods){
  var t = sumNutrition(foods.map(function(f){ return foodNutrition(f.name, f.qty); }));
  return { kcal: Math.round(t.kcal), p: round1(t.p), c: round1(t.c), f: round1(t.f) };
}

// Fase 19: ajuste automático de quantidades aos alvos nutricionais.
// Pedido explícito: TODOS os alimentos contam, incluindo vegetais e fruta
// — não só os grupos "protein/carb/fat". Por isso o critério não é o
// f.group do alimento no plano, é o que cada alimento REALMENTE contribui
// mais (proteína, hidratos ou gordura, por calorias) — a mesma lógica já
// usada para classificar a base do INSA por grupo (Fase 16). Um vegetal
// com hidratos reais definidos (não "à vontade") entra na reescala de
// hidratos, tal como qualquer alimento do grupo "carb".
// Só fica de fora um alimento que não tem número nenhum para reescalar:
// per:"fixed" na base (ex.: brócolos "à vontade" por definição) ou com a
// quantidade atual escrita como "à vontade".
function priorityMacroForFood(name){
  var db = FOOD_DB[name];
  if (!db) return null;
  var calP = db.p * 4, calC = db.c * 4, calF = db.f * 9;
  var best = Math.max(calP, calC, calF);
  if (best <= 0) return null;
  if (best === calF) return "f";
  if (best === calP) return "p";
  return "c";
}

/* ---------- Sem desperdício: produtos que se estragam depois de abertos ----------
   Iogurtes, queijo, leite, fiambre, bebidas vegetais, molhos... vendem-se em embalagens fechadas.
   Se o plano pede 200 g de um iogurte de 300 g, sobram 100 g que o aluno não vai comer (e que estragam).
   Por isso, quando se conhece o tamanho da embalagem (FOOD_PACKS), as quantidades são sempre embalagens inteiras. */
var FOOD_PACKS = {
  "Iogurte proteico de mirtilo (YoPro Danone)": 120,
  "Queijo fresco longa duração light (Continente Equilíbrio)": 62.5, // cada unidade vem fechada: 4 x 62,5 g
  "Queijo fresco light (Hacendado)": 62.5 // 2 unidades por embalagem (62,5 g cada, como o Natural do Hacendado)
};
// o produto aparece nas 3 primeiras palavras do nome ("Mythos Iogurte Estilo Grego", "100% Sumo de Pera"); uma palavra de sabor mais à frente ("Nachos sabor a Queijo", "Chocolate de Leite") não conta
var PERISHABLE_AFTER_OPENING = /^(?:\S+\s+){0,2}(?:iogurte|yogurte|yogurt|yogur|skyr|quark|kefir|bifidus|petit[ -](?:suisse|queijinho|gervais)|estilo grego|pudim|pudding|flan|sobremesa|mousse|leite|bebida (?:vegetal|de |l[áa]ctea|[àa] base|biol[óo]gica)|batido|n[ée]ctar|nectar[íi]ssimo|queijo|requeij|cottage|moz{1,2}arel{1,2}a|burrata|ricotta|feta|camembert|brie|natas|fiambre|peru fatiado|presunto|paté|húmus|hummus|tofu|tempeh|seitan|sumo|margarina|manteiga|molho)/i;
// produtos que não se estragam depois de abertos, ainda que a palavra apareça ao início: "Pão de Leite", "Bolachas com manteiga", "Brioche de leite"
var NOT_PERISHABLE_HEAD = /^(?:\S+\s+)?(?:bolacha|biscoito|biscuit|batata|bolo|wafer|chocolate|p[ãa]o|brioche|barra|snack|tosta|gelado|doce|feij|cereais|granola|muesli|pastilha|caramelo|compota|cacau|palitos|palets)/i;
var NOT_PERISHABLE_ANYWHERE = /(?:manteiga|pasta|creme) de amendoim|leite de coco|leite condensado|leite em p[óo]|molho de soja|tempero|piri-?piri|pesto/i;
// se o nome COMEÇA pelo produto, a 2.ª palavra é sabor e não anula nada: "Iogurte Cereais", "Leite Chocolate", "Iogurte Biscuit"
var LEADS_WITH_PRODUCT = /^(?:iogurte|yogurte|yogurt|yogur|skyr|quark|kefir|leite|bebida|batido|queijo|pudim|pudding|flan|sumo)(?![a-zà-ú])/i;
function isPerishableAfterOpening(name){
  name = String(name || "");
  if (!PERISHABLE_AFTER_OPENING.test(name) || NOT_PERISHABLE_ANYWHERE.test(name)) return false;
  return LEADS_WITH_PRODUCT.test(name) || !NOT_PERISHABLE_HEAD.test(name);
}
// laticínios cujo nome é só o sabor ("Natural", "Morango", "Sem Lactose Magro") valem como doses individuais, salvo se forem queijo, manteiga, natas, molhos, pastas ou produtos em pó
var DAIRY_NOT_PACK = /queijo|requeij|manteiga|natas|creme|cremos|barrar|cunha|fatia|ralad|curad|por[çc]|portion|babybel|philadelphia|molho|pesto|tempero|pasta|em p[óo]|condensado|coco|gelado/i;
function hasWholePackFood(row, displayName){
  return isPerishableAfterOpening(displayName) || (resolveGroup(row.food_group) === "laticinios" && !DAIRY_NOT_PACK.test(String(row.name || "")) && !NOT_PERISHABLE_ANYWHERE.test(String(row.name || "")));
}
function packSizeOf(name){ return FOOD_PACKS[name] > 0 ? FOOD_PACKS[name] : 0; }
// gramas/ml que sobram (e se estragam) numa quantidade que não é um nº inteiro de embalagens; 0 se não há desperdício ou não se conhece a embalagem
function packLeftover(name, qty){
  var size = packSizeOf(name);
  if (!size) return 0;
  var a = parseQtyAmount(qty);
  if (a.kind !== "g") return 0;
  var rest = a.value % size;
  return rest < 1 || size - rest < 1 ? 0 : Math.round(size - rest); // tolera 1 g (as quantidades guardam-se arredondadas: 62,5 g → 63 g)
}
// arredonda para o nº de embalagens inteiras mais próximo (mínimo 1)
function snapToWholePacks(name, grams){
  var size = packSizeOf(name);
  if (!size) return grams;
  return Math.max(1, Math.round(grams / size)) * size;
}

// aviso no editor: "embalagem de 120 g — 200 g deixa 40 g por consumir"
function packWasteHint(f){
  var left = packLeftover(f.name, f.qty);
  if (!left) return "";
  var size = packSizeOf(f.name), amount = parseQtyAmount(f.qty).value;
  var lower = Math.max(1, Math.floor(amount / size)) * size, upper = Math.ceil(amount / size) * size;
  var unit = /\bml\b/i.test(String(f.qty)) ? "ml" : "g", fmt = function(n){ return String(Math.round(n * 100) / 100).replace(".", ",") + " " + unit; };
  var advice = lower === upper ? "Usa " + fmt(upper) + "." : "Usa " + fmt(lower) + " ou " + fmt(upper) + ".";
  return "<span class=\"pack-waste\" style=\"display:block; font-size:0.74rem; color:var(--warn);\">⚠ Embalagem de " + fmt(size) + ": " + escapeHtml(f.qty) + " deixa " + fmt(left) + " por consumir (desperdício). " + advice + "</span>";
}

function scaleFoodQty(name, qty, scale){
  var db = FOOD_DB[name];
  var amt = parseQtyAmount(qty);
  if (!db || db.per === "fixed" || amt.kind === "fixed") return qty;
  if (db.per === "unit" || amt.kind === "unit"){
    var newUnits = Math.max(1, Math.round(amt.value * scale));
    return newUnits + " unid.";
  }
  var unitMatch = qty.match(/([\d.]+)\s*(g|ml)\b/i);
  var suffix = unitMatch ? unitMatch[2] : "g";
  var newAmount = Math.max(5, Math.round((amt.value * scale) / 5) * 5);
  return newAmount + " " + suffix;
}

// Resolve o sistema linear Ax=b por eliminação de Gauss com pivô parcial.
// N é sempre pequeno aqui (no máximo 3 — proteína/hidratos/gordura), por
// isso não há necessidade de nada mais sofisticado. Devolve null se o
// sistema for singular (sem solução única — caso raro/degenerado).
function solveLinearSystem(A, b){
  var n = b.length;
  var M = A.map(function(row, i){ return row.slice().concat([b[i]]); });
  for (var col = 0; col < n; col++){
    var maxRow = col;
    for (var r = col + 1; r < n; r++){
      if (Math.abs(M[r][col]) > Math.abs(M[maxRow][col])) maxRow = r;
    }
    if (Math.abs(M[maxRow][col]) < 1e-9) return null;
    var tmp = M[col]; M[col] = M[maxRow]; M[maxRow] = tmp;
    for (var r2 = 0; r2 < n; r2++){
      if (r2 === col) continue;
      var factor = M[r2][col] / M[col][col];
      for (var c2 = col; c2 <= n; c2++) M[r2][c2] -= factor * M[col][c2];
    }
  }
  return M.map(function(row, i){ return row[n] / row[i]; });
}

// Devolve {changed, skippedMacros, untouched} — skippedMacros são macros
// com alvo definido mas sem nenhum alimento reescalável a contribuir para
// eles (nada para ajustar; o profissional tem de acrescentar alimentos ou
// definir uma quantidade real, não "à vontade"). untouched conta quantos
// alimentos ficaram de fora por serem mesmo fixos/"à vontade".
//
// Fase 22: a primeira versão (Fase 19) reescalava cada balde de macro por
// aproximação iterativa (4 passagens) — na prática, com planos reais onde
// vários alimentos contribuem significativamente para mais do que o seu
// macro "prioritário" (ex.: um alimento de gordura com hidratos a sério),
// isto convergia mal e podia ficar ~10% acima do alvo de calorias (caso
// reportado: 3411 kcal vs 3089 pedidos). A contribuição de cada balde para
// cada macro é uma função LINEAR do seu fator de escala — por isso agora
// resolve-se o sistema de equações exatamente (proteína/hidratos/gordura,
// até 3x3) em vez de aproximar, o que bate certo ao primeiro cálculo.
var AUTO_ADJUST_MAX_SCALE = 4;
function autoAdjustPlanQuantities(s){
  var t = s.targets || {};
  var targetFor = {
    p: t.protein,
    c: t.carbs != null ? t.carbs : t.carbsMax,
    f: t.fat != null ? t.fat : t.fatMax
  };
  var macroKeys = ["p","c","f"];
  var buckets = {p:[], c:[], f:[]};
  var untouched = 0;
  var startQty = [];
  var allFoods = [];
  s.meals.forEach(function(m){
    m.foods.forEach(function(f){
      allFoods.push(f);
      var db = FOOD_DB[f.name];
      var amt = parseQtyAmount(f.qty);
      if (!db || db.per === "fixed" || amt.kind === "fixed"){ untouched++; return; }
      if (db.kcal < 10){ untouched++; return; } // chá, café, água: sem energia, nunca se reescalam
      if (packSizeOf(f.name)){ untouched++; return; } // embalagem fechada que se estraga: nunca se reescala (sem desperdício)
      var macroKey = priorityMacroForFood(f.name);
      if (!macroKey) return;
      buckets[macroKey].push(f);
      startQty.push({food: f, qty: f.qty});
    });
  });
  var skippedMacros = [], clamped = [];
  var macroGroupLabel = {p:"protein", c:"carb", f:"fat"};
  macroKeys.forEach(function(macroKey){
    if (!buckets[macroKey].length && targetFor[macroKey] > 0) skippedMacros.push(macroGroupLabel[macroKey]);
  });

  // Só os baldes com alimentos reescaláveis E um alvo > 0 entram no
  // sistema — os restantes ficam fixos na quantidade atual (tal como
  // "à vontade"), tal como já acontecia antes desta fase.
  var active = macroKeys.filter(function(macroKey){ return buckets[macroKey].length && targetFor[macroKey] > 0; });

  if (active.length){
    var activeSet = {};
    active.forEach(function(k){ activeSet[k] = true; });
    var fixedFoods = allFoods.filter(function(f){
      var db = FOOD_DB[f.name];
      var amt = parseQtyAmount(f.qty);
      if (!db || db.per === "fixed" || amt.kind === "fixed" || db.kcal < 10 || packSizeOf(f.name)) return true;
      var macroKey = priorityMacroForFood(f.name);
      return !macroKey || !activeSet[macroKey];
    });
    function contributionOf(foodsList, macroKey){
      return foodsList.reduce(function(sum, f){ return sum + foodNutrition(f.name, f.qty)[macroKey]; }, 0);
    }
    var A = active.map(function(rowMacro){
      return active.map(function(colBucket){ return contributionOf(buckets[colBucket], rowMacro); });
    });
    var b = active.map(function(macroKey){ return targetFor[macroKey] - contributionOf(fixedFoods, macroKey); });
    var scales = solveLinearSystem(A, b);
    if (scales){
      active.forEach(function(bucketKey, i){
        var scale = scales[i];
        // Uma escala <= 0 significa que só os alimentos fixos já
        // ultrapassam o alvo deste macro — não há como um balde "negativo"
        // de comida corrigir isso, por isso fica por mexer (mesma regra
        // que já existia: nunca inventa uma redução impossível).
        if (scale > 0){
          // Nunca reduz/aumenta uma quantidade mais de 4x: fora disso os alvos não condizem com o plano
          // (ex.: 5 g de pão ou 900 g de iogurte) e o profissional deve rever alvos ou alimentos.
          var bounded = Math.min(AUTO_ADJUST_MAX_SCALE, Math.max(1 / AUTO_ADJUST_MAX_SCALE, scale));
          if (bounded !== scale) clamped.push(bucketKey);
          buckets[bucketKey].forEach(function(f){ f.qty = scaleFoodQty(f.name, f.qty, bounded); });
        }
      });
    }
  }

  var changed = startQty.filter(function(o){ return o.food.qty !== o.qty; }).length;
  return {changed: changed, skippedMacros: skippedMacros, untouched: untouched, clamped: clamped};
}

/* ---------- Flexibilidade: deriva a apresentação da refeição, não é só visual ---------- */
function flexTier(v){ if (v<34) return "estruturado"; if (v<67) return "equilibrado"; return "flexivel"; }
var GROUP_LABELS = {
  cereais:"🥖 Cereais, Pães e Acompanhamentos",
  laticinios:"🥛 Lacticínios e Alternativas Vegetais",
  carnes:"🥩 Carnes, Peixe e Ovos",
  fruta:"🍎 Frutas Frescas",
  vegetais:"🟢 Vegetais e Saladas",
  gorduras:"🥑 Gorduras e Óleos",
  bebidas:"☕ Bebidas (café e chá)",
  snacks:"🍫 Snacks e Processados"
};
function groupLabel(g){ return GROUP_LABELS[resolveGroup(g)] || g; }

/* ---------- Editor de plano (profissional): só usa alimentos/grupos/unidades já suportados pelo parser ---------- */
function foodOptionsForGroup(group){
  return (FOOD_GROUPS[resolveGroup(group)] || []).map(function(o){ return o.name; });
}

// Fase 32: pedido do profissional — a pesquisa de "+ Adicionar alimento"/
// "Editar alimento" estava restrita ao grupo selecionado, o que escondia
// alimentos reais (ex.: "Queijo fresco magro" ao pesquisar com o grupo em
// "Cereais"). Passa a pesquisar SEMPRE em todos os alimentos, ordenados
// alfabeticamente — o grupo passa a ser só a etiqueta gravada com o
// alimento (atualizada automaticamente para o grupo real assim que se
// escolhe um alimento na pesquisa, ver wireProTab). optionsFor()/
// foodOptionsForGroup() continuam por grupo — usados nas substituições e no
// "ver mais alimentos", onde faz sentido manter as alternativas dentro do
// mesmo grupo do alimento original.
// Ordenar milhares de nomes com localeCompare a cada abertura de "Nutrição" (uma vez por refeição e por alimento) deixava o separador lento
// no telemóvel: a lista fica em cache (refeita só quando o número de alimentos muda) e ordena com um Intl.Collator.
var foodNamesCache = {count: -1, names: null};
var FOOD_COLLATOR = (typeof Intl !== "undefined" && Intl.Collator) ? new Intl.Collator("pt") : null;
function allFoodNames(){
  var names = Object.keys(FOOD_DB);
  if (foodNamesCache.names && foodNamesCache.count === names.length) return foodNamesCache.names;
  names.sort(FOOD_COLLATOR ? FOOD_COLLATOR.compare : function(a, b){ return a.localeCompare(b, "pt"); });
  foodNamesCache = {count: names.length, names: names};
  return names;
}

// Fase 16: pesquisa partilhada sobre uma lista de nomes de alimentos —
// usada no "+ Adicionar alimento" do profissional, no "ver mais alimentos"
// do construtor de refeições, e na pesquisa dentro de "Substituir". Limite
// de resultados renderizados para nunca desenhar centenas de linhas de DOM
// de uma vez, mesmo com a pesquisa vazia.
var FOOD_SEARCH_RENDER_CAP = 40;

function filterFoodNames(names, query){
  query = (query || "").trim().toLowerCase();
  if (!query) return names;
  return names.filter(function(n){ return n.toLowerCase().indexOf(query) >= 0; });
}

function foodSearchResultsHtml(names, query){
  var filtered = filterFoodNames(names, query);
  if (!filtered.length) return "<div class=\"food-search-empty\">Sem alimentos com esse nome.</div>";
  var shown = filtered.slice(0, FOOD_SEARCH_RENDER_CAP);
  var html = shown.map(function(n){ return "<div class=\"food-search-item\" data-name=\"" + escapeHtml(n) + "\">" + escapeHtml(n) + "</div>"; }).join("");
  if (filtered.length > shown.length) html += "<div class=\"food-search-empty\">+" + (filtered.length - shown.length) + " mais — continua a escrever para afinar</div>";
  return html;
}

function unitKindFor(name){
  var db = FOOD_DB[name];
  return db ? db.per : null; // "100g" | "unit" | "fixed" | null (alimento desconhecido)
}

function buildQtyString(name, amount){
  var kind = unitKindFor(name);
  if (kind === "fixed") return "à vontade";
  if (kind === "unit") return Math.max(1, Math.round(amount) || 1) + " unid.";
  // "100g": gramas por omissão — "ml" só para bebidas (ver isBeverage), onde
  // a aproximação 1 ml ≈ 1 g é razoável. Continua em gramas para o resto
  // (ex.: azeite, cuja densidade ronda 0.92 g/ml, não é líquido "bebível").
  if (kind === "100g") return Math.max(1, Math.round(amount) || 1) + (isBeverage(name) ? " ml" : " g");
  return null; // alimento não reconhecido — não deve acontecer vindo de FOOD_GROUPS, mas nunca inventa uma quantidade
}

function sortMealsByTime(s){
  s.meals.sort(function(a,b){ return toMinutes(a.time) - toMinutes(b.time); });
}

function addMealToPlan(s){
  var m = meal("Nova refeição", "12:00", []);
  s.meals.push(m);
  sortMealsByTime(s);
  return m;
}

// Fase 12: esqueleto de plano a partir do questionário — pedido do
// profissional para "converter" a resposta do dia-a-dia alimentar num
// ponto de partida. Decisão explícita: só a estrutura (refeições e
// horários standard), nunca adivinhar alimentos a partir de texto livre —
// isso fica para o profissional decidir, com a resposta do aluno à mão
// (ver tplQuestionnaireCopy).
var PLAN_SKELETON_MEALS = [
  ["Pequeno-almoço", "07:30"],
  ["Meio da manhã", "10:30"],
  ["Almoço", "13:00"],
  ["Lanche", "17:00"],
  ["Jantar", "20:00"],
  ["Ceia", "22:30"]
];

function createPlanSkeleton(s){
  var added = PLAN_SKELETON_MEALS.map(function(pair){
    var m = meal(pair[0], pair[1], []);
    s.meals.push(m);
    return m;
  });
  sortMealsByTime(s);
  return added;
}

function removeMealFromPlan(s, targetMeal){
  s.meals = s.meals.filter(function(m){ return m !== targetMeal; });
}

// Fase 20: pedido para ir mais além do esqueleto (Fase 12) — tentar
// reconhecer, no próprio texto do "dia-a-dia alimentar" do questionário,
// que refeições e que alimentos (da nossa base) a pessoa já descreveu, e
// propor isso como plano de partida. Mantém a mesma cautela das Fases
// 12/17 com texto livre: nunca inventa um alimento fora da base (só
// reconhece o que já existe em FOOD_DB/FOOD_GROUPS), e nunca aplica nada ao
// plano sem o profissional rever a proposta e confirmar — ver
// draftPlanFromDailyText/renderDailyPlanDraft. (Fase 35: passou a ler as
// quantidades escritas no texto e a reconhecer por frase, não por palavra-chave.)
var DAILY_TEXT_MEAL_MARKERS = [
  {key:"Pequeno-almoço", re:/pequeno[\s-]?almo[çc]o/i},
  {key:"Meio da manhã", re:/meio[\s-]da[\s-]manh[ãa]/i},
  {key:"Almoço", re:/\balmo[çc]o\b/i},
  {key:"Lanche", re:/\blanche\b/i},
  {key:"Lanche", re:/meio[\s-]da[\s-]tarde/i},
  {key:"Lanche", re:/pr[ée][\s-]?treino/i},
  {key:"Jantar", re:/\bjantar\b/i},
  {key:"Ceia", re:/\bceia\b/i},
  {key:"Pós-treino", re:/p[óo]s[\s-]?treino/i}
];
// Fase 35: "Pós-treino" também é uma refeição do questionário (a seguir ao treino).
var DAILY_DRAFT_MEALS = PLAN_SKELETON_MEALS.concat([["Pós-treino", "19:00"]]);

function splitDailyTextByMeal(text){
  text = text || "";
  var claimed = [];
  function overlapsClaimed(idx, len){
    return claimed.some(function(r){ return idx < r[1] && (idx + len) > r[0]; });
  }
  var matches = [];
  DAILY_TEXT_MEAL_MARKERS.forEach(function(marker){
    // "Pequeno-almoço" é processado primeiro na lista acima e reserva o seu
    // troço do texto — sem isto, "\balmoço\b" também acertaria dentro de
    // "pequeno-almoço" (há fronteira de palavra a seguir ao hífen).
    var re = new RegExp(marker.re.source, "gi");
    var m;
    while ((m = re.exec(text))){
      if (!overlapsClaimed(m.index, m[0].length)){
        matches.push({key: marker.key, index: m.index});
        claimed.push([m.index, m.index + m[0].length]);
      }
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  });
  matches.sort(function(a,b){ return a.index - b.index; });
  var segments = {};
  for (var i=0;i<matches.length;i++){
    var start = matches[i].index;
    var end = i+1 < matches.length ? matches[i+1].index : text.length;
    var segText = text.slice(start, end);
    segments[matches[i].key] = (segments[matches[i].key] ? segments[matches[i].key] + " " : "") + segText;
  }
  return segments;
}

function defaultQtyForFood(name){
  for (var g in FOOD_GROUPS){
    var found = FOOD_GROUPS[g].find(function(o){ return o.name === name; });
    if (found) return found.qty;
  }
  var db = FOOD_DB[name];
  if (db && db.per === "unit") return "1 unid.";
  if (db && db.per === "fixed") return "à vontade";
  return isBeverage(name) ? "100 ml" : "100 g";
}

function groupOfFood(name){
  for (var g in FOOD_GROUPS){
    if (FOOD_GROUPS[g].some(function(o){ return o.name === name; })) return g;
  }
  return "carnes";
}

// Os nomes curados originais (anteriores à Fase 16/INSA) — mais simples e
// mais prováveis de corresponder ao que alguém escreve em texto livre
// ("arroz", "frango"). Ganham SEMPRE a chave de palavra, nunca perdem para
// uma variante do INSA: nem a ordem de grupo nem "o nome mais curto" chegam
// sozinhos (ex.: "Arroz doce" é mais curto que "Arroz (cozido)" mas é um
// prato completamente diferente).
var CURATED_FOOD_NAMES = [
  "Frango (peito)","Peru (fatiado)","Pescada","Atum (natural)","Ovos","Tofu","Iogurte grego natural",
  "Arroz (cozido)","Massa (cozida)","Batata","Batata-doce","Pão integral","Couscous (cozido)","Aveia",
  "Brócolos","Salada mista","Cenoura","Courgette","Espinafres",
  "Azeite","Abacate","Frutos secos","Manteiga de amendoim",
  "Maçã","Banana","Mirtilos","Laranja"
];

var _foodKeywordIndexCache = null;
function getFoodKeywordIndex(){
  if (_foodKeywordIndexCache) return _foodKeywordIndexCache;
  var index = {};
  function keyOf(name){
    var beforeQualifier = name.split(/[,(]/)[0].trim();
    var firstWord = (beforeQualifier.split(/\s+/)[0] || "").toLowerCase();
    // Mantém o hífen (ex.: "batata-doce") — sem isto, "\bdoce\b" também
    // acertava dentro de "batata-doce" (o hífen conta como fronteira de
    // palavra), e a chave de "Batata-doce" nunca conseguia corresponder ao
    // texto, que continua a ter o hífen.
    return firstWord.replace(/[^a-zà-ÿ-]/gi, "");
  }
  CURATED_FOOD_NAMES.forEach(function(name){
    var key = keyOf(name);
    if (key.length >= 3) index[key] = name;
  });
  var curatedKeySet = {};
  Object.keys(index).forEach(function(k){ curatedKeySet[k] = true; });
  // Segunda passagem, só para preencher chaves que nenhum curado ocupa —
  // aqui sim, entre variantes do INSA, o nome mais curto tende a ser o mais
  // genérico/comum.
  Object.keys(FOOD_DB).forEach(function(name){
    var key = keyOf(name);
    // Fase 35: um produto de marca ("Cereais Cookie Crisp (Nestlé)") nunca fica com a
    // chave genérica ("cereais") — só serve para reconhecer palavras conhecidas.
    if (key.length < 3 || curatedKeySet[key] || brandOfFoodName(name)) return;
    if (!index[key] || name.length < index[key].length) index[key] = name;
  });
  _foodKeywordIndexCache = index;
  return index;
}

// Fase 35: pedido do profissional depois de usar o "Gerar plano a partir do
// dia-a-dia" com um questionário real — muitos erros: "leite meio-gordo"
// virava "Leite creme" (uma sobremesa), "sem açúcar" acrescentava Açúcar
// branco, "2 fatias de pão" virava Fatias de presunto, "queijo fresco magro"
// virava Queijo Brie, "15 g proteína" virava Proteína texturizada de soja,
// as quantidades escritas no texto (200 ml, 60 g...) eram ignoradas, e
// "Meio da tarde / pré-treino" e "Pós-treino" nem eram reconhecidos como
// refeições (os alimentos caíam no Almoço). Causa comum: o reconhecimento
// olhava só para a PRIMEIRA palavra do nome do alimento. Agora reconhece por
// frase (as palavras que identificam o alimento têm de estar no texto),
// trata "sem X" como negação, só escolhe um produto de marca se a marca for
// mencionada, e lê as quantidades escritas. Continua a nunca inventar um
// alimento fora da base: o que não reconhece fica à vista, para acrescentar à mão.
var DRAFT_CONNECTORS = {
  de:1, da:1, do:1, das:1, dos:1, com:1, e:1, em:1, a:1, o:1, as:1, os:1, um:1, uma:1, uns:1, umas:1,
  ao:1, na:1, no:1, nas:1, nos:1, the:1, ou:1, para:1, por:1, pelo:1, pela:1, ate:1
};
// Atributos "suaves": podem faltar no texto sem tornar errado o alimento
// ("leite sem lactose" aceita "Leite magro sem lactose, UHT"), ao contrário do
// que identifica o alimento ("brie", "creme", "pita"...).
var DRAFT_SOFT_ATTRS = {meio:1, gordo:1, magro:1, desnatado:1, integral:1, natural:1, simples:1, fresco:1, branco:1, comum:1};
var DRAFT_PREFERRED_QUAL = {uht:1, pasteurizado:1, medio:1, valor:1};
var DRAFT_DISPREFERRED_QUAL = {po:1, condensado:1, evaporado:1, seco:1, desidratado:1, instantaneo:1, liofilizado:1, enlatado:1};
// Peso aproximado de medidas caseiras (g ou ml) — só para converter o que o
// texto diz ("2 fatias", "1 prato de sopa") quando o alimento está em gramas.
var DAILY_UNIT_GRAMS = {fatia:40, "colher de sopa":15, "colher de cha":5, "colher de sobremesa":10, colher:15, chavena:150, copo:200, prato:300, tigela:250, iogurte:125};
var DAILY_FOOD_ALIASES = [
  // descrições genéricas do dia-a-dia que não são o nome de nenhum alimento da base
  {words:["yopro","mirtilo"], food:"Iogurte proteico de mirtilo (YoPro Danone)", block:["liquido","bebivel"]},
  {words:["iogurte","proteico","mirtilo"], food:"Iogurte proteico de mirtilo (YoPro Danone)", block:["liquido","bebivel"]},
  {words:["peixe","branco"], food:"Pescada"},
  {words:["carne","branca"], food:"Frango (peito)"},
  {words:["carne","vermelha"], food:"Carne vermelha magra"},
  {words:["legume","verde"], food:"Brócolos"},
  // produtos concretos que os alunos descrevem de forma genérica (só valem se já estiverem na base, i.e. aprovados no Catálogo)
  {words:["iogurte","liquido","proteico"], food:"Iogurte líquido proteico sabor café (YoPro)"},
  {words:["pudim","proteico"], food:"Pudim proteico sabor chocolate (Continente)"},
  {words:["iogurte","proteico"], food:"Iogurte proteico PRO+ sabor baunilha (Lindahls)", block:["liquido","bebivel"]},
  {words:["iogurte","proteico"], food:"Iogurte proteico", block:["liquido","bebivel"]},
  {words:["iogurte","proteico"], food:"Iogurte grego natural", block:["liquido","bebivel"]},
  // palavras soltas — só quando nada mais específico reconheceu a frase
  {words:["legume"], food:"Brócolos", single:true},
  {words:["sopa"], food:"Sopa juliana", single:true},
  {words:["iogurte"], food:"Iogurte grego natural", single:true, block:["liquido","bebivel"]},
  {words:["carne"], food:"Carne magra", single:true},
  {words:["peixe"], food:"Pescada", single:true},
  {words:["salada"], food:"Salada mista", single:true}
];

function foldAccents(s){
  s = (s || "").toLowerCase();
  if (s.normalize) s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return s;
}

// Um "(Marca)" no fim do nome (com maiúscula inicial) identifica um produto de
// supermercado — os qualificadores do INSA são minúsculos ("Arroz (cozido)").
function brandOfFoodName(name){
  var m = (name || "").match(/\(([A-ZÀ-Ý][^()]*)\)\s*(?:·.*)?$/);
  return m ? m[1] : null;
}

function draftStem(t){
  return (t.length > 3 && t.charAt(t.length - 1) === "s") ? t.slice(0, -1) : t;
}

function draftTokens(s, keepConnectors){
  var f = foldAccents(s).replace(/\b(sem|zero)\s+([a-z0-9]+)/g, "$1_$2");
  return f.split(/[^a-z0-9_]+/).filter(function(t){
    return t && !/^\d+$/.test(t) && (keepConnectors || !DRAFT_CONNECTORS[t]);
  }).map(draftStem);
}

function withinOneEdit(a, b){
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  var i = 0, j = 0, diff = 0;
  while (i < a.length && j < b.length){
    if (a.charAt(i) === b.charAt(j)){ i++; j++; continue; }
    if (++diff > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else { i++; j++; }
  }
  return diff + (a.length - i) + (b.length - j) <= 1;
}

function draftTokenInLine(lineSet, t, fuzzy){
  if (lineSet[t]) return true;
  if (!fuzzy || t.length < 5) return false;
  for (var k in lineSet){ if (withinOneEdit(k, t)) return true; }
  return false;
}

var _draftEntriesCache = null, _draftEntriesCount = -1;
function getDraftFoodEntries(){
  var names = Object.keys(FOOD_DB);
  if (_draftEntriesCache && _draftEntriesCount === names.length) return _draftEntriesCache;
  var curated = {};
  CURATED_FOOD_NAMES.forEach(function(n){ curated[n] = true; });
  _draftEntriesCache = names.map(function(name){
    var brandStr = brandOfFoodName(name);
    var base = brandStr ? name.replace(/\s*\([^()]*\)\s*(?:·.*)?$/, "") : name;
    var cut = base.search(/[,(]/);
    return {
      name: name,
      head: draftTokens(cut >= 0 ? base.slice(0, cut) : base),
      qual: draftTokens(cut >= 0 ? base.slice(cut) : ""),
      brand: brandStr ? draftTokens(brandStr) : [],
      curated: !!curated[name]
    };
  }).filter(function(e){ return e.head.length; });
  _draftEntriesCount = names.length;
  return _draftEntriesCache;
}

// Procura, na base, o alimento que melhor descreve as palavras da frase.
// Regras que evitam os erros de antes:
//  - todas as palavras que identificam o alimento (a "cabeça" do nome, antes
//    da vírgula/parênteses) têm de estar na frase — menos atributos suaves;
//  - um produto de marca só entra se a marca (ou parte dela, com tolerância
//    a gralhas) for mencionada — "arroz basmati" nunca vira um pacote de
//    arroz cru de um supermercado;
//  - "sem açúcar" é uma palavra à parte ("sem_acucar"), nunca "açúcar".
function findFoodForTokens(tokens){
  var lineSet = {};
  tokens.forEach(function(t){ lineSet[t] = true; });
  var noise = getDraftNoise();
  var content = tokens.filter(function(t){ return !noise[t]; });
  function aliasMatch(wantSingle, exactOnly){
    for (var i = 0; i < DAILY_FOOD_ALIASES.length; i++){
      var a = DAILY_FOOD_ALIASES[i];
      if (!!a.single !== wantSingle || !FOOD_DB[a.food]) continue;
      if (!a.words.every(function(w){ return lineSet[w]; })) continue;
      if (a.block && a.block.some(function(w){ return lineSet[w]; })) continue;
      // descrição genérica pura ("sopa", "carne"): só vale se o texto não tiver mais nada que identifique o alimento
      if (exactOnly && !content.every(function(t){ return a.words.indexOf(t) >= 0; })) continue;
      return a.food;
    }
    return null;
  }
  var viaAlias = aliasMatch(false, false) || aliasMatch(true, true);
  if (viaAlias) return viaAlias;
  var best = null;
  getDraftFoodEntries().forEach(function(e){
    var covered = {}, missing = 0, softOnly = true, brandHits = 0;
    e.head.forEach(function(t){
      if (lineSet[t]) covered[t] = true;
      else { missing++; if (!DRAFT_SOFT_ATTRS[t]) softOnly = false; }
    });
    if (e.brand.length){
      e.brand.forEach(function(t){ if (draftTokenInLine(lineSet, t, true)){ brandHits++; covered["b:" + t] = true; } });
      if (brandHits < Math.ceil(e.brand.length / 2)) return;
      if (!e.head.some(function(t){ return lineSet[t]; })) return; // com a marca dita, basta uma palavra do nome
    } else if (!Object.keys(covered).length || (missing && !softOnly)){
      return;
    }
    var qualMissing = 0, penalty = 0;
    e.qual.forEach(function(t){
      if (lineSet[t]) covered[t] = true;
      else {
        qualMissing++;
        if (DRAFT_DISPREFERRED_QUAL[t]) penalty += 6;
        if (DRAFT_PREFERRED_QUAL[t]) penalty -= 2;
      }
    });
    var score = Object.keys(covered).length * 10 - missing * (e.brand.length ? 1 : 3) - qualMissing * 0.4 - penalty +
      (e.curated ? 8 : 0) - e.name.length * 0.02;
    if (!best || score > best.score) best = {name: e.name, score: score};
  });
  return best ? best.name : aliasMatch(true, false);
}

// Lê a quantidade escrita na frase: "200 ml", "60 g", "2 fatias", "1 prato",
// "15 g proteína" (gramas de PROTEÍNA a atingir, não do alimento) ou
// "Iogurte proteico com 25 g". Devolve também o texto que sobra, já sem isso.
function parseDailyQuantity(raw){
  var t = " " + foldAccents(raw) + " ";
  var out = {grams:null, count:null, unit:null, proteinG:null, rest:""};
  var m = t.match(/(\d+(?:[.,]\d+)?)\s*g\s*(?:de\s*)?proteinas?/);
  if (m){
    out.proteinG = parseFloat(m[1].replace(",", "."));
    t = t.replace(m[0], " ");
  } else if (/proteic[oa]/.test(t)){
    m = t.match(/\bcom\s+(\d+(?:[.,]\d+)?)\s*g\b/);
    if (m){
      out.proteinG = parseFloat(m[1].replace(",", "."));
      t = t.replace(m[0], " ");
    }
  }
  m = t.match(/(\d+(?:[.,]\d+)?)\s*(kg|gramas?|gr|g|ml|cl|dl|l)\b/);
  if (m){
    var v = parseFloat(m[1].replace(",", ".")), u = m[2];
    out.grams = (u === "kg" || u === "l") ? v * 1000 : (u === "cl" ? v * 10 : (u === "dl" ? v * 100 : v));
    t = t.replace(m[0], " ");
  } else {
    m = t.match(/(\d+(?:[.,]\d+)?)\s*(fatias?|colher(?:es)?(?:\s+de\s+(?:sopa|cha|sobremesa))?|chavenas?|copos?|pratos?|tigelas?|unidades?|unid)\b\.?/);
    if (m){
      out.count = parseFloat(m[1].replace(",", "."));
      var unit = m[2];
      if (/^fatia/.test(unit)) out.unit = "fatia";
      else if (/^colher/.test(unit)) out.unit = /sopa/.test(unit) ? "colher de sopa" : (/cha/.test(unit) ? "colher de cha" : (/sobremesa/.test(unit) ? "colher de sobremesa" : "colher"));
      else if (/^chavena/.test(unit)) out.unit = "chavena";
      else if (/^copo/.test(unit)) out.unit = "copo";
      else if (/^prato/.test(unit)) out.unit = "prato";
      else if (/^tigela/.test(unit)) out.unit = "tigela";
      else out.unit = "unidade";
      t = t.replace(m[0], " ");
    } else {
      m = t.match(/^\s*(\d+)\s+(?=[a-z])/);
      if (m){
        out.count = parseInt(m[1], 10);
        t = t.replace(m[0], " ");
      }
    }
  }
  out.rest = t;
  return out;
}

function resolveDraftQty(name, q){
  var db = FOOD_DB[name];
  if (!db) return defaultQtyForFood(name);
  if (db.per === "fixed") return "à vontade";
  if (db.per === "unit"){
    if (q.count != null && (!q.unit || q.unit === "unidade")) return Math.max(1, Math.round(q.count)) + " unid.";
    // uma peça de fruta ≈ 150 g (a base define "Fruta" como 1 unid. ≈ 80 kcal)
    if (q.grams != null && name === "Fruta") return Math.max(1, Math.round(q.grams / 150)) + " unid.";
    return defaultQtyForFood(name);
  }
  var grams = null;
  // "150g Iogurte Skyr com 15g de Proteína": a quantidade escrita manda; os gramas de proteína só servem quando não há quantidade
  if (q.grams != null) grams = q.grams;
  else if (q.proteinG && db.p >= 5) grams = Math.round(q.proteinG / db.p * 100 / 5) * 5;
  else if (q.count != null && q.unit === "iogurte" && brandOfFoodName(name) && parseQtyAmount(defaultQtyForFood(name)).kind === "g")
    grams = q.count * parseQtyAmount(defaultQtyForFood(name)).value; // "1 iogurte" de marca = 1 embalagem (ex.: copo YoPRO de 120 g)
  else if (q.count != null && q.unit && DAILY_UNIT_GRAMS[q.unit]) grams = q.count * DAILY_UNIT_GRAMS[q.unit];
  else if (q.count != null && !q.unit){
    // "1 barra", "2 maçãs": N vezes a dose-padrão do alimento
    var dq = parseQtyAmount(defaultQtyForFood(name));
    if (dq.kind === "g") grams = q.count * dq.value;
  }
  if (grams == null) return defaultQtyForFood(name);
  return buildQtyString(name, snapToWholePacks(name, Math.min(2000, Math.max(5, grams))));
}

var _draftNoise = null;
function getDraftNoise(){
  if (_draftNoise) return _draftNoise;
  var out = {};
  Object.keys(DRAFT_CONNECTORS).forEach(function(k){ out[k] = true; });
  Object.keys(DAILY_TEXT_STOPWORDS).forEach(function(k){ draftTokens(k, true).forEach(function(t){ out[t] = true; }); });
  ["pequeno","almoco","manha","meio","tarde","jantar","lanche","ceia","treino","pre","pos","noite","proteina","proteico","proteica",
   "fatia","grama","colher","prato","chavena","copo","tigela","unidade","unid","porcao"].forEach(function(k){ out[draftStem(k)] = true; });
  _draftNoise = out;
  return out;
}

// Uma frase só conta como "não reconhecida" se tiver palavras de conteúdo —
// títulos de refeição ("Almoço", "Meio da manhã") e conversa não contam.
function hasDraftContent(text){
  var noise = getDraftNoise();
  return draftTokens(parseDailyQuantity(text).rest).some(function(t){ return !noise[t]; });
}

function matchDraftPhrase(text){
  var q = parseDailyQuantity(text);
  var tokens = draftTokens(q.rest);
  if (!tokens.length) return null;
  if (q.count != null && !q.unit && tokens.indexOf("iogurte") >= 0) q.unit = "iogurte";
  var name = findFoodForTokens(tokens);
  if (!name) return null;
  // "iogurte líquido proteico" não é o iogurte proteico (colher): fica por reconhecer, nunca trocado
  if (name === "Iogurte proteico" && (tokens.indexOf("liquido") >= 0 || tokens.indexOf("bebivel") >= 0)) return null;
  // pediu-se uma dose de proteína ("20 g proteína") mas o alimento reconhecido quase não
  // tem proteína — não é o alimento certo, melhor deixar por reconhecer do que errar
  if (q.proteinG && FOOD_DB[name].per === "100g" && FOOD_DB[name].p < 5) return null;
  return {name: name, qty: resolveDraftQty(name, q)};
}

// Uma linha de lista ("* 60 g queijo fresco magro", ou a começar por número)
// é UMA frase (pode ter "com" no nome: "iogurte com pedaços de fruta"); texto
// corrido ("frango com arroz", "como ovos com pão integral e um café") parte-se
// pelos conetores, cada pedaço procurado à parte. Um "com 25 g" (quantidade)
// nunca separa a frase.
function splitDraftPhrases(line){
  var stripped = line.trim().replace(/^[*\-•▪●]+\s*/, "");
  var bulleted = stripped.length !== line.trim().length;
  var single = bulleted || /^\d/.test(stripped);
  if (single) return [{text: stripped, single: true}];
  return stripped.split(/\s*[,;]\s*|\s*\.(?=\s|$)\s*|\s+(?:e|com|mais)\s+(?!\d)|\s*\+\s*/i)
    .filter(function(p){ return p && p.trim(); })
    .map(function(p){ return {text: p.trim(), single: false}; });
}

// Fase 24: "150 g frango / peru / coelho" é uma escolha (um OU outro), não os
// três a somar; uma linha seguinte a começar por "ou" é mais uma alternativa
// ao mesmo grupo. Linhas com "/" (e as que se seguem a começar por "ou")
// formam um grupo de alternativas do qual só entra a PRIMEIRA que se
// reconhece; uma linha sem "/" continua a poder ter vários alimentos genuínos.
// Produtos que o profissional/aluno compra de facto: no plano colado, o alimento genérico passa para esse produto
// (e para embalagens inteiras: 4 x 62,5 g de queijo fresco, fechadas uma a uma).
var PREFERRED_PRODUCTS = {
  "Queijo fresco magro": "Queijo fresco light (Hacendado)",
  "Iogurte proteico": "Iogurte proteico de mirtilo (YoPro Danone)"
};
function applyPreferredProductsIf(pasted, draft){ return pasted ? applyPreferredProducts(draft) : draft; }
function applyPreferredProducts(draft){
  draft.forEach(function(d){
    d.foods.forEach(function(f){
      var pref = PREFERRED_PRODUCTS[f.name];
      if (!pref || !FOOD_DB[pref]) return;
      var a = parseQtyAmount(f.qty);
      f.name = pref;
      f.group = groupOfFood(pref);
      if (a.kind === "g") f.qty = buildQtyString(pref, snapToWholePacks(pref, a.value));
    });
  });
  return draft;
}

function draftPlanFromDailyText(text){
  // Linhas de hidratação e notas manuscritas ("Hidratação → 3L Água...", "Leia: ...") não são alimentos de nenhuma refeição
  // (da linha até à refeição seguinte ou ao fim: "Leia (caso seja preciso): ..." tem as linhas seguintes)
  text = String(text || "").replace(/\blogurte/gi, "iogurte") // gralha comum ao copiar do papel: "I" maiúsculo lido como "l"
    .replace(/^[ \t]*(?:hidrata[çc][ãa]o|leia|nota|notas|obs\.?|observa[çc][õo]es)\b[\s\S]*?(?=^[ \t]*refei[çc][ãa]o\b|(?![\s\S]))/gim, "");
  var segments = splitDailyTextByMeal(text);
  var draft = [];
  DAILY_DRAFT_MEALS.forEach(function(pair){
    var mealName = pair[0], mealTime = pair[1];
    var segText = segments[mealName];
    if (!segText) return;
    var found = [];
    var unmatchedLines = [];
    function addFound(res){
      if (!found.some(function(f){ return f.name === res.name; })) found.push(res);
    }
    function addUnmatched(t){
      var clean = t.trim().replace(/^[*\-•▪●]+\s*/, "").replace(/\s+/g, " ");
      if (clean && unmatchedLines.indexOf(clean) === -1) unmatchedLines.push(clean);
    }
    // texto entre parênteses sem números ("(verde / branco)", "(sem açúcar)", "(assada + deixar repousar)") só descreve variantes: não entra no reconhecimento
    var rawLines = segText.split(/\n+/).map(function(l){ return l.replace(/\([^()\d]*\)/g, " ").replace(/\s+/g, " ").trim(); }).filter(function(l){ return l; });
    var groups = [];
    rawLines.forEach(function(line){
      var startsWithOu = /^(\*\s*)?ou\b/i.test(line);
      if (startsWithOu && groups.length){
        groups[groups.length - 1].push(line);
      } else {
        groups.push([line]);
      }
    });
    groups.forEach(function(groupLines){
      var hasAlternatives = groupLines.length > 1 || groupLines[0].indexOf("/") >= 0 || /\sou\s/i.test(groupLines[0]);
      if (hasAlternatives){
        var alts = [];
        groupLines.forEach(function(l){
          l.split(/\s*\/\s*|\s+ou\s+/i).forEach(function(a){ if (a.trim()) alts.push(a.trim()); });
        });
        var picked = null;
        for (var i = 0; i < alts.length && !picked; i++) picked = matchDraftPhrase(alts[i]);
        if (picked) addFound(picked);
        else if (hasDraftContent(groupLines.join(" "))) addUnmatched(groupLines[0]);
      } else {
        splitDraftPhrases(groupLines[0]).forEach(function(p){
          var res = matchDraftPhrase(p.text);
          if (res) addFound(res);
          else if (p.single && hasDraftContent(p.text)) addUnmatched(p.text);
        });
      }
    });
    var foods = found.map(function(f){
      return {name: f.name, qty: f.qty, group: groupOfFood(f.name)};
    });
    draft.push({mealName: mealName, mealTime: mealTime, sourceText: segText.trim(), foods: foods, unmatchedLines: unmatchedLines});
  });
  return draft;
}

// Fase 20b: pedido explícito depois de usar a Fase 20 com dados reais — (1)
// dar para tirar um alimento mal reconhecido ANTES de aplicar (em vez de só
// poder corrigir depois, já no plano real) e (2) avisar quando uma palavra
// do texto parece ser um alimento mas não está na nossa base, em vez de a
// ignorar silenciosamente. A lista de palavras a ignorar (DAILY_TEXT_STOPWORDS)
// cobre artigos/preposições, verbos comuns neste contexto e confeções — nunca
// vai ser perfeita (é heurística sobre texto livre em português), por isso é
// sempre rotulada como "também mencionado", não como facto.
var DAILY_TEXT_STOPWORDS = {
  "a":1,"o":1,"as":1,"os":1,"um":1,"uma":1,"uns":1,"umas":1,"de":1,"do":1,"da":1,"dos":1,"das":1,
  "em":1,"no":1,"na":1,"nos":1,"nas":1,"com":1,"sem":1,"e":1,"ou":1,"mas":1,"para":1,"por":1,
  "que":1,"ao":1,"à":1,"às":1,"aos":1,"mais":1,"menos":1,"muito":1,"muita":1,"muitos":1,"muitas":1,
  "pouco":1,"pouca":1,"poucos":1,"poucas":1,
  "como":1,"comi":1,"comer":1,"comendo":1,"costumo":1,"costuma":1,"normalmente":1,"geralmente":1,
  "tenho":1,"tomo":1,"bebo":1,"faço":1,"vou":1,"gosto":1,"prefiro":1,"tento":1,"acabo":1,"acaba":1,
  "dia":1,"dias":1,"semana":1,"semanas":1,"vez":1,"vezes":1,"hoje":1,"sempre":1,"depois":1,"antes":1,"durante":1,
  "grelhado":1,"grelhada":1,"grelhados":1,"grelhadas":1,"cozido":1,"cozida":1,"cozidos":1,"cozidas":1,
  "assado":1,"assada":1,"assados":1,"assadas":1,"frito":1,"frita":1,"fritos":1,"fritas":1,"cru":1,"crua":1,
  "pequeno":1,"almoço":1,"almoco":1,"manhã":1,"manha":1,"meio":1,"lanche":1,"jantar":1,"ceia":1,"tarde":1,"noite":1,
  // formas com hífen: o tokenizador junta "pequeno-almoço" num só token (o
  // mesmo padrão que mantém "batata-doce" inteiro), por isso precisa da sua
  // própria entrada — as palavras separadas acima não chegam para o cobrir.
  "pequeno-almoço":1,"pequeno-almoco":1,"meio-da-manhã":1,"meio-da-manha":1
};

// Palavras do segmento que PARECEM alimento (não são conetores/verbos/confeção
// comuns) mas não corresponderam a nada reconhecido — recalculado a cada
// render a partir dos alimentos atuais do rascunho, para que remover um pill
// errado "devolva" a palavra correspondente à lista de não-reconhecidos.
function extractUnmatchedWords(segText, matchedNames, index, skipText){
  var words = (segText || "").toLowerCase().match(/[a-zà-ÿ]+(?:-[a-zà-ÿ]+)*/g) || [];
  var matchedNamesLower = matchedNames.map(function(n){ return n.toLowerCase(); });
  var matchedTokens = [];
  matchedNames.forEach(function(n){ draftTokens(n).forEach(function(t){ matchedTokens.push(t); }); });
  var skipLower = (skipText || "").toLowerCase();
  var noise = getDraftNoise();
  var seen = {};
  var out = [];
  words.forEach(function(w){
    if (w.length < 4 || DAILY_TEXT_STOPWORDS[w] || seen[w]) return;
    var folded = draftStem(foldAccents(w));
    if (noise[folded]) return; // medidas (fatias, gramas...), palavras de refeição, proteína/proteico
    if (index[w]) return; // é uma chave conhecida — já teria virado um alimento reconhecido
    if (matchedNamesLower.some(function(n){ return n.indexOf(w) >= 0; })) return; // faz parte do nome de um alimento já reconhecido
    // gralha na marca ("Rustic" em vez de "Rustik") ou palavra já listada como linha por reconhecer
    if (matchedTokens.some(function(t){ return t === folded || (folded.length >= 5 && withinOneEdit(t, folded)); })) return;
    if (skipLower && skipLower.indexOf(w) >= 0) return;
    // palavra com hífen ("meio-gordo") cujas partes já fazem parte do alimento reconhecido
    if (w.indexOf("-") >= 0 && foldAccents(w).split("-").every(function(p){ p = draftStem(p); return noise[p] || matchedTokens.indexOf(p) >= 0; })) return;
    seen[w] = true;
    out.push(w);
  });
  return out;
}

function renderDailyPlanDraft(draft){
  var totalFoods = draft.reduce(function(sum,d){ return sum + d.foods.length; }, 0);
  if (!draft.length){
    return "<p class=\"muted-p\" style=\"margin-top:8px;\">Não encontrei nenhuma refeição identificável no texto (pequeno-almoço/meio da manhã/almoço/lanche/jantar/ceia) — tenta reescrever com essas palavras, ou monta o plano manualmente com o texto acima como referência.</p>";
  }
  var index = getFoodKeywordIndex();
  var html = "<div class=\"card\" style=\"padding:12px; margin-top:8px;\">" +
    "<p class=\"muted-p\" style=\"margin-bottom:10px;\">Proposta a partir do texto do dia-a-dia — revê com atenção antes de aplicar, o reconhecimento de texto livre nunca é perfeito. Tira (×) o que não fizer sentido.</p>";
  draft.forEach(function(d, mi){
    var matchedNames = d.foods.map(function(f){ return f.name; });
    var unmatchedLines = d.unmatchedLines || [];
    var unmatchedWords = extractUnmatchedWords(d.sourceText, matchedNames, index, unmatchedLines.join(" "));
    html += "<div style=\"margin-bottom:10px;\">" +
      "<div style=\"font-weight:600; font-size:0.85rem;\">" + escapeHtml(d.mealName) + " <span class=\"muted-p\" style=\"font-weight:400;\">· " + d.mealTime + "</span></div>" +
      (d.foods.length ?
        "<div style=\"display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;\">" + d.foods.map(function(f, fi){
          return "<span class=\"pill\">" + escapeHtml(f.name) + " · " + escapeHtml(f.qty) +
            " <button type=\"button\" data-remove-draft-food=\"" + mi + "\" data-food-idx=\"" + fi + "\" aria-label=\"Remover " + escapeHtml(f.name) + "\" style=\"background:none; border:none; color:inherit; cursor:pointer; padding:0 0 0 6px; font-size:0.95em; line-height:1;\">×</button></span>";
        }).join("") + "</div>" :
        "<p class=\"muted-p\" style=\"font-size:0.8rem; margin-top:4px;\">Nenhum alimento reconhecido nesta refeição — acrescenta manualmente.</p>") +
      (unmatchedLines.length ?
        "<p style=\"font-size:0.76rem; margin-top:6px; color:var(--warn);\">⚠ Não consegui reconhecer (acrescenta à mão): <strong>" + unmatchedLines.map(function(l){ return "«" + escapeHtml(l) + "»"; }).join(", ") + "</strong></p>" : "") +
      (unmatchedWords.length ?
        "<p style=\"font-size:0.76rem; margin-top:6px; color:var(--warn);\">⚠ Também mencionado, mas não está na nossa base: <strong>" + unmatchedWords.map(function(w){ return escapeHtml(w); }).join(", ") + "</strong> — acrescenta manualmente se for relevante.</p>" : "") +
    "</div>";
  });
  html += totalFoods ?
    ("<button type=\"button\" class=\"btn primary btn-sm\" id=\"applyDailyPlanDraft\" style=\"width:100%;\">Aplicar ao plano</button>" +
    "<p class=\"muted-p\" style=\"font-size:0.76rem; margin-top:6px;\">Só cria/completa as refeições acima com os alimentos reconhecidos, nas quantidades escritas no texto (quando não há, a quantidade-padrão) — depois ajusta livremente (inclusive com o botão \"Ajustar quantidades aos alvos\", mais abaixo).</p>")
    : "<p class=\"muted-p\" style=\"font-size:0.8rem;\">Não reconheci nenhum alimento da nossa base no texto — monta o plano manualmente com o texto como referência.</p>";
  html += "</div>";
  return html;
}

function addFoodToMeal(targetMeal, name, group, amount){
  var qty = buildQtyString(name, amount);
  if (qty == null) return false;
  targetMeal.foods.push(food(name, qty, group));
  return true;
}

function removeFoodFromMeal(targetMeal, targetFood){
  targetMeal.foods = targetMeal.foods.filter(function(f){ return f !== targetFood; });
}

function ensureLiveChoiceDefaults(meal, s){
  if (!meal.liveChoice) meal.liveChoice = {};
  meal.foods.forEach(function(f){
    if (!f.group) return;
    if (meal.liveChoice[f.group] == null){
      var options = optionsFor(f, s);
      var di = options.findIndex(function(o){ return o.name===f.name; });
      meal.liveChoice[f.group] = di>=0 ? di : (options.length ? 0 : -1);
    }
  });
}

function liveChoiceTotals(meal, s){
  var groups = Object.keys(meal.liveChoice || {});
  var chosen = groups.map(function(g){
    var idx = meal.liveChoice[g];
    if (idx === -1) return {kcal:0,p:0,c:0,f:0};
    var srcFood = meal.foods.find(function(f){ return f.group===g; });
    var opts = srcFood ? optionsFor(srcFood, s) : (FOOD_GROUPS[resolveGroup(g)]||[]);
    var opt = opts[idx];
    return opt ? foodNutrition(opt.name, opt.qty) : {kcal:0,p:0,c:0,f:0};
  });
  var groupless = meal.foods.filter(function(f){ return !f.group; }).map(function(f){ return foodNutrition(f.name, f.qty); });
  return sumNutrition(chosen.concat(groupless));
}

function resolvedMealTotals(s, meal){
  var tier = flexTier(s.flexibility);
  if (tier !== "estruturado" && meal.liveChoice && Object.keys(meal.liveChoice).length){
    var t = liveChoiceTotals(meal, s);
    return { kcal: Math.round(t.kcal), p: round1(t.p), c: round1(t.c), f: round1(t.f) };
  }
  return foodsTotals(meal.foods);
}

function expectedKcalFromMacros(t){
  var carbs = t.carbs!=null ? t.carbs : (t.carbsMin!=null && t.carbsMax!=null ? (t.carbsMin+t.carbsMax)/2 : 0);
  var fat = t.fat!=null ? t.fat : (t.fatMin!=null && t.fatMax!=null ? (t.fatMin+t.fatMax)/2 : 0);
  return Math.round((t.protein||0)*4 + carbs*4 + fat*9);
}

function toMinutes(t){ var p=t.split(":"); return parseInt(p[0],10)*60+parseInt(p[1],10); }
function getNextMeal(s){
  if (!s.meals.length) return null;
  var now = new Date();
  var nowMin = now.getHours()*60 + now.getMinutes();
  var candidates = s.meals.filter(function(m){ return !mealCountsToday(m) && m.status !== "skipped"; });
  if (!candidates.length) return null;
  var sorted = candidates.slice().sort(function(a,b){ return toMinutes(effectiveMealTime(a))-toMinutes(effectiveMealTime(b)); });
  for (var i=0;i<sorted.length;i++){
    if (toMinutes(effectiveMealTime(sorted[i])) >= nowMin) return {meal:sorted[i], tomorrow:false};
  }
  return {meal:sorted[0], tomorrow:true};
}

function computeLastCheckinDaysAgo(s){
  if (!s.checkins || !s.checkins.length) return 999;
  var last = s.checkins[s.checkins.length-1];
  var days = Math.floor((new Date() - new Date(last.date + "T00:00:00")) / 86400000);
  return Math.max(0, days);
}

function computeAdherence(s){
  if (!s.checkins.length) return null;
  var recent = s.checkins.slice(-4);
  var avg = recent.reduce(function(a,c){ return a + c.adherence; }, 0) / recent.length;
  return avg/10;
}

var STUDENTS = [
  {
    id:"maria", isDemo:true, initials:"MS", name:"Maria Silva", age:32, sex:"Feminino", height:165,
    weightInitial:74.0, weightCurrent:68.0, weightGoal:64,
    goal:"Perda de gordura", trainingsPerWeek:4, trainingDays:[1,2,4,5], trainingType:"Musculação + cardio leve", trainingTime:"19:00",
    wakeTime:"07:00", sleepTime:"23:30",
    likes:["Frango","Iogurte grego","Batata-doce"], dislikes:["Peixe azul"], avoid:["Marisco"],
    allergies:["Sensibilidade à lactose"], mealsPreferred:5, budget:"Médio", cookTime:"20-30 min/dia",
    work:"Escritório (sentada)", weekendNote:"Janta fora ~1x por fim de semana",
    targets:{kcal:1700, protein:131, carbs:177, fat:52},
    flexibility:65,
    flexOverrides:{},
    flexHistory:[{date:"2026-08-11", from:30, to:50, note:"Boa adesão nas primeiras semanas — aumentar autonomia."},{date:"2026-09-01", from:50, to:65, note:"Continua consistente, pode escolher mais dentro do plano."}],
    blockedFoods:["Atum (natural)"],
    alerts:[{type:"warn", text:"Adesão abaixo de 85% esta semana"}],
    notes:"Prefere treinar ao final do dia. Sensível a lactose — evitar leite gordo, iogurte grego normalmente tolerado bem.",
    meals:[
      meal("Pequeno-almoço","07:30",[food("Iogurte grego natural","200 g","protein"),food("Aveia","40 g","carb"),food("Mirtilos","80 g","fruit")]),
      meal("Meio da manhã","10:30",[food("Maçã","1 unid.","fruit"),food("Frutos secos","15 g","fat")]),
      meal("Almoço","13:00",[food("Frango (peito)","150 g","protein"),food("Arroz (cozido)","120 g","carb"),food("Brócolos","à vontade","veg"),food("Azeite","10 ml","fat",false)]),
      meal("Lanche pré-treino","17:00",[food("Banana","1 unid.","fruit"),food("Ovos","2 unid.","protein")]),
      meal("Jantar","20:30",[food("Pescada","170 g","protein"),food("Batata-doce","150 g","carb"),food("Salada mista","à vontade","veg")])
    ],
    checkins:[
      {date:"2026-08-18", weight:70.4, hunger:6, energy:6, adherence:7, workouts:3, mealsOff:1, notes:"Semana ok, fim de semana mais difícil."},
      {date:"2026-08-25", weight:69.6, hunger:5, energy:7, adherence:8, workouts:4, mealsOff:0, notes:"Boa semana."},
      {date:"2026-09-01", weight:69.0, hunger:5, energy:7, adherence:8, workouts:4, mealsOff:1, notes:""},
      {date:"2026-09-08", weight:68.5, hunger:6, energy:6, adherence:7, workouts:3, mealsOff:2, notes:"Jantar de aniversário."},
      {date:"2026-09-15", weight:68.0, hunger:5, energy:7, adherence:8, workouts:4, mealsOff:1, notes:""}
    ],
    weights:[
      {date:"2026-07-21",w:74.0},{date:"2026-07-28",w:72.9},{date:"2026-08-04",w:72.1},{date:"2026-08-11",w:71.2},
      {date:"2026-08-18",w:70.4},{date:"2026-08-25",w:69.6},{date:"2026-09-01",w:69.0},{date:"2026-09-08",w:68.5},{date:"2026-09-15",w:68.0}
    ],
    assessments:[
      {date:"2026-08-04", weight:72.1, bodyFat:32.5, muscle:26.1, visceral:9, water:48.2},
      {date:"2026-09-01", weight:69.0, bodyFat:30.2, muscle:26.6, visceral:8, water:49.0}
    ],
    allowPhotos:true,
    photos:[],
    planHistory:[
      {date:"2026-07-21", kcal:2100, flex:30, label:"Plano 1"},
      {date:"2026-08-11", kcal:1950, flex:50, label:"Plano 2"},
      {date:"2026-09-01", kcal:1850, flex:65, label:"Plano 3"}
    ],
    lastCheckinDaysAgo:7
  },
  {
    id:"rui", isDemo:true, initials:"RC", name:"Rui Costa", age:26, sex:"Masculino", height:180,
    weightInitial:71.0, weightCurrent:74.5, weightGoal:80,
    goal:"Ganho de massa muscular", trainingsPerWeek:5, trainingDays:[1,2,3,4,5], trainingType:"Musculação (hipertrofia)", trainingTime:"07:00",
    wakeTime:"06:00", sleepTime:"23:00",
    likes:["Carne vermelha","Arroz","Batata"], dislikes:["Legumes verdes"], avoid:[],
    allergies:[], mealsPreferred:5, budget:"Alto", cookTime:"< 15 min/dia (meal prep ao fim de semana)",
    work:"Trabalho de terreno, ativo", weekendNote:"Treina normalmente ao sábado de manhã",
    targets:{kcal:3100, protein:262, carbs:292, fat:98},
    flexibility:30,
    alerts:[{type:"critical", text:"Sem check-in há 12 dias"},{type:"warn", text:"Peso sem evolução há 3 semanas"}],
    notes:"Motivado mas com pouco tempo para cozinhar durante a semana — depende muito do meal prep de domingo.",
    meals:[
      meal("Pequeno-almoço","06:30",[food("Ovos","4 unid.","protein"),food("Pão integral","90 g","carb"),food("Manteiga de amendoim","20 g","fat")]),
      meal("Pós-treino","09:00",[food("Iogurte grego natural","250 g","protein"),food("Aveia","70 g","carb"),food("Banana","1 unid.","fruit")]),
      meal("Almoço","13:30",[food("Frango (peito)","220 g","protein"),food("Arroz (cozido)","250 g","carb"),food("Azeite","15 ml","fat")]),
      meal("Lanche","17:00",[food("Atum (natural)","140 g","protein"),food("Pão integral","70 g","carb")]),
      meal("Jantar","20:00",[food("Carne vermelha magra","200 g","protein"),food("Batata","300 g","carb"),food("Brócolos","à vontade","veg")])
    ],
    checkins:[
      {date:"2026-08-11", weight:74.0, hunger:7, energy:7, adherence:7, workouts:5, mealsOff:2, notes:""},
      {date:"2026-08-25", weight:74.3, hunger:8, energy:6, adherence:6, workouts:4, mealsOff:3, notes:"Semana cheia de trabalho."}
    ],
    weights:[
      {date:"2026-07-14",w:71.0},{date:"2026-07-28",w:72.2},{date:"2026-08-11",w:74.0},{date:"2026-08-25",w:74.3},{date:"2026-09-08",w:74.5}
    ],
    assessments:[
      {date:"2026-07-14", weight:71.0, bodyFat:14.5, muscle:34.0, visceral:6, water:58.0},
      {date:"2026-08-25", weight:74.3, bodyFat:15.0, muscle:35.6, visceral:6, water:58.5}
    ],
    allowPhotos:false,
    photos:[],
    planHistory:[
      {date:"2026-07-14", kcal:2700, flex:25, label:"Plano 1"},
      {date:"2026-08-11", kcal:2900, flex:30, label:"Plano 2"}
    ],
    lastCheckinDaysAgo:12
  },
  {
    id:"sofia", isDemo:true, initials:"SM", name:"Sofia Martins", age:29, sex:"Feminino", height:170,
    weightInitial:63.0, weightCurrent:63.2, weightGoal:63,
    goal:"Manutenção / recomposição", trainingsPerWeek:3, trainingDays:[1,3,5], trainingType:"Treino funcional", trainingTime:"18:30",
    wakeTime:"07:30", sleepTime:"23:45",
    likes:["Peixe","Legumes variados","Quinoa"], dislikes:[], avoid:["Glúten (preferência, não celíaca)"],
    allergies:[], mealsPreferred:4, budget:"Médio-alto", cookTime:"30-40 min/dia, gosta de cozinhar",
    work:"Trabalho híbrido", weekendNote:"Muito social, janta fora com frequência",
    targets:{kcal:1800, protein:135, carbsMin:130, carbsMax:180, fatMin:55, fatMax:75},
    flexibility:85,
    alerts:[],
    notes:"Muito autónoma — beneficia mais de regras e intervalos do que de refeições fixas.",
    meals:[
      meal("Pequeno-almoço","08:00",[food("Ovos","2 unid.","protein"),food("Pão integral","80 g","carb"),food("Abacate","50 g","fat")]),
      meal("Almoço","13:00",[food("Frango (peito)","160 g","protein"),food("Arroz (cozido)","160 g","carb"),food("Salada mista","à vontade","veg"),food("Azeite","10 ml","fat")]),
      meal("Lanche","17:30",[food("Iogurte grego natural","200 g","protein"),food("Fruta","1 peça","fruit")]),
      meal("Jantar","20:00",[food("Pescada","190 g","protein"),food("Quinoa (cozida)","150 g","carb"),food("Salada mista","à vontade","veg"),food("Azeite","10 ml","fat")])
    ],
    checkins:[
      {date:"2026-08-25", weight:63.4, hunger:4, energy:8, adherence:9, workouts:3, mealsOff:1, notes:""},
      {date:"2026-09-01", weight:63.1, hunger:4, energy:8, adherence:9, workouts:3, mealsOff:2, notes:"Fim de semana fora."},
      {date:"2026-09-08", weight:63.3, hunger:5, energy:7, adherence:9, workouts:3, mealsOff:1, notes:""},
      {date:"2026-09-15", weight:63.2, hunger:4, energy:8, adherence:9, workouts:3, mealsOff:1, notes:""}
    ],
    weights:[
      {date:"2026-08-04",w:63.0},{date:"2026-08-11",w:63.2},{date:"2026-08-18",w:63.5},{date:"2026-08-25",w:63.4},
      {date:"2026-09-01",w:63.1},{date:"2026-09-08",w:63.3},{date:"2026-09-15",w:63.2}
    ],
    assessments:[
      {date:"2026-08-04", weight:63.0, bodyFat:24.0, muscle:24.5, visceral:5, water:52.0},
      {date:"2026-09-08", weight:63.3, bodyFat:23.4, muscle:24.9, visceral:5, water:52.4}
    ],
    allowPhotos:true,
    photos:[],
    planHistory:[
      {date:"2026-08-04", kcal:2050, flex:85, label:"Plano 1"}
    ],
    lastCheckinDaysAgo:0
  }
];

/* ---------- Aluna de demonstração completa ("Ana Demo") ----------
   Uma conta com 12 semanas de histórico (peso, check-ins, avaliações com perímetros e fotos, programa de treino com guia e RIR, sessões registadas)
   para percorrer toda a app em modo local e apanhar erros. As datas são sempre relativas a hoje. Perfil propositado: peso estagnado há 3 semanas apesar de
   treinar e aderir bem, digestão fraca, e dois exercícios prontos para subir carga. */
function buildFullDemoStudent(){
  function dAgo(n){ return addDaysISO(localTodayISO(), -n); }
  var IMG = {"antes0": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAABaCAIAAABrM6JiAAAAx0lEQVR42u3b2QlCMRAF0FTihxVYqGVYioVZgPrMMtl8B24BJzAMF4aky/W2XRI0NDT0Iujn4/6eddEfuT3oaZg40H1idKY4yg29EbpIHOI2HtD29D+ht+weWh40NDQ0dAu6okDHPuYc6HBxhRsaOgzdSVzqhoaOQXcVF7mhV0MPEOe7oaFb0cPEmW5o6Cb0YHGOG3oR9BTxTzc0dCV6ovjYDT0dPV184IaGLkYvIv7mdnOBhoaGhoaGhoaGhoaGht4B7btqTV46ujqXpFHbvQAAAABJRU5ErkJggg==", "antes1": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAABaCAIAAABrM6JiAAAAx0lEQVR42u3b2QlCMRAF0NTil5/WaB2WYnEWoD6zTDbfgVvACQzDhSHpcr1tlwQNDQ29CPr5uL9nXfRHbg96GiYOdJ8YnSmOckNvhC4Sh7iNB7Q9/U/oLbuHlgcNDQ0N3YKuKNCxjzkHOlxc4YaGDkN3Epe6oaFj0F3FRW7o1dADxPluaOhW9DBxphsaugk9WJzjhl4EPUX80w0NXYmeKD52Q09HTxcfuKGhi9GLiL+53VygoaGhoaGhoaGhoaGhoXdA+65akxdYsdjMMr0y+AAAAABJRU5ErkJggg==", "antes2": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAABaCAIAAABrM6JiAAAAx0lEQVR42u3b2QlCMRAF0NTil5+WaBVWYoEWoD6zTDbfgVvACQzDhSHperltlwQNDQ29CPr5uL9nXfRHbg96GiYOdJ8YnSmOckNvhC4Sh7iNB7Q9/U/oLbuHlgcNDQ0N3YKuKNCxjzkHOlxc4YaGDkN3Epe6oaFj0F3FRW7o1dADxPluaOhW9DBxphsaugk9WJzjhl4EPUX80w0NXYmeKD52Q09HTxcfuKGhi9GLiL+53VygoaGhoaGhoaGhoaGhoXdA+65akxd1dU+cH2ARpgAAAABJRU5ErkJggg==", "depois0": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAABaCAIAAABrM6JiAAAAuElEQVR42u3bwQnDMAwFUE+SQyfooB0jo3SwDJAerEQydvPgD/AExnwQatvrvVwaNDQ09CTo7/45Z170T24FvQ0TJ7ofjO4UZ7mhF0KHxCluzwPaP/1P6CW7h5YHDQ0NDX0HfaFA5w4DDQ29IjpdfMENDQ0NDQ0NHUcXiaNuaGho6HJ0qTjkhoZOQA8Q97uhp0IPE3e6oaFvoQeLe9ytdDNUtDeChoaGhoaGhoaGhoaGhn4u2rlqIAfJBUlZI6bECAAAAABJRU5ErkJggg==", "depois1": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAABaCAIAAABrM6JiAAAAuElEQVR42u3bwQnDMAwFUM+SU4+dsXNklA6XAdKDlUjGbh78AZ7AmA9CbXu9l0uDhoaGngT93T/nzIv+ya2gt2HiRPeD0Z3iLDf0QuiQOMXteUD7p/8JvWT30PKgoaGhoe+gLxTo3GGgoaFXRKeLL7ihoaGhoaGh4+gicdQNDQ0NXY4uFYfc0NAJ6AHifjf0VOhh4k43NPQt9GBxj7uVboaK9kbQ0NDQ0NDQ0NDQ0NDQ0M9FO1cN5ABHtBW9ml+DVAAAAABJRU5ErkJggg==", "depois2": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAABaCAIAAABrM6JiAAAAuElEQVR42u3bwQnDMAwFUM+SU48dsVNkkg6YAdKDlUjGbh78AZ7AmA9C7bW9l0uDhoaGngT93T/nzIv+ya2gt2HiRPeD0Z3iLDf0QuiQOMXteUD7p/8JvWT30PKgoaGhoe+gLxTo3GGgoaFXRKeLL7ihoaGhoaGh4+gicdQNDQ0NXY4uFYfc0NAJ6AHifjf0VOhh4k43NPQt9GBxj7uVboaK9kbQ0NDQ0NDQ0NDQ0NDQ0M9FO1cN5ABkyqD+VU/jGwAAAABJRU5ErkJggg=="};
  function ex(id, name, sets, reps, rest, cues, demo){ return {id: id, name: name, sets: sets, reps: reps, rpe: null, rest: rest, notes: "", demo: demo || null, cues: cues}; }
  var program = {name: "Hipertrofia 3 dias", days: [
    {id: "dA", name: "Treino A — Peito e costas", exercises: [
      ex("eA1", "Supino reto com barra", 3, "8-12", 120, ["Omoplatas juntas e para baixo", "Barra desce ao meio do peito", "Pés firmes no chão"], "https://www.youtube.com/results?search_query=supino+reto+t%C3%A9cnica"),
      ex("eA2", "Remada com barra", 3, "8-12", 90, ["Costas neutras, anca para trás", "Puxa a barra para o umbigo"]),
      ex("eA3", "Flexões de braços", 3, "10-15", 60, ["Corpo em prancha", "Cotovelos a 45°"])]},
    {id: "dB", name: "Treino B — Pernas", exercises: [
      ex("eB1", "Agachamento", 4, "6-8", 150, ["Joelhos na direção dos pés", "Desce até à paralela", "Peito aberto"]),
      ex("eB2", "Peso morto romeno", 3, "8-10", 120, ["Barra junto às pernas", "Anca para trás, joelhos ligeiramente fletidos"]),
      ex("eB3", "Elevação de gémeos", 3, "12-15", 60, ["Amplitude completa", "Pausa em cima"])]},
    {id: "dC", name: "Treino C — Ombros e braços", exercises: [
      ex("eC1", "Press de ombros com halteres", 3, "8-12", 90, ["Cotovelos ligeiramente à frente", "Não arquear as costas"]),
      ex("eC2", "Elevações laterais", 3, "12-15", 60, ["Sobe até à altura do ombro", "Controla a descida"]),
      ex("eC3", "Rosca de bíceps", 3, "10-12", 60, ["Cotovelos junto ao corpo", "Sem balançar"])]}
  ]};
  // sessão k (0 = a mais antiga) de cada exercício: [carga, [reps por série], [rir por série] (só nas últimas 4 sessões)]
  var plan = {
    eA1: [[50,[9,9,8]], [52.5,[10,9,9]], [52.5,[10,10,9],[3,3,2]], [55,[12,11,10],[2,2,1]], [55,[12,12,12],[2,1,1]], [55,[12,12,12],[1,1,0]]],
    eA2: [[40,[10,9,8]], [40,[11,10,9]], [42.5,[10,9,9],[3,2,2]], [42.5,[11,10,10],[2,2,2]], [45,[10,10,9],[2,2,1]], [45,[11,10,10],[2,1,1]]],
    eA3: [[0,[10,9,8]], [0,[11,10,9]], [0,[12,11,10],[3,2,2]], [0,[12,12,11],[2,2,2]], [0,[13,12,12],[2,2,1]], [0,[14,13,12],[2,1,1]]],
    eB1: [[70,[8,8,7,6]], [70,[8,8,8,7]], [75,[8,7,6,6],[2,1,1,0]], [75,[8,8,7,6],[2,1,1,0]], [75,[8,7,7,6],[2,1,1,0]], [75,[8,7,7,6],[2,1,0,0]]],
    eB2: [[60,[9,8,8]], [62.5,[9,9,8]], [62.5,[10,9,9],[3,2,2]], [65,[9,8,8],[3,2,2]], [65,[10,9,9],[2,2,1]], [67.5,[9,8,8],[2,2,1]]],
    eB3: [[30,[14,13,12]], [30,[15,14,13]], [32.5,[13,12,12],[3,2,2]], [32.5,[14,13,13],[3,2,2]], [32.5,[15,14,14],[2,2,2]], [35,[13,12,12],[2,2,1]]],
    eC1: [[20,[10,9,8]], [20,[11,10,9]], [22,[9,8,8],[3,2,2]], [22,[10,9,9],[3,2,2]], [24,[9,8,8],[2,2,1]], [24,[10,10,9],[2,2,1]]],
    eC2: [[8,[13,12,12]], [8,[14,13,12]], [8,[15,14,13],[3,2,2]], [10,[13,12,12],[3,2,2]], [10,[15,15,15],[2,2,1]], [10,[15,15,15],[2,1,1]]],
    eC3: [[12,[11,10,10]], [12,[12,11,10]], [14,[10,10,9],[3,2,2]], [14,[11,10,10],[3,2,2]], [14,[12,11,11],[2,2,1]], [16,[10,9,9],[2,2,1]]]
  };
  var logs = [], order = ["dA", "dB", "dC"], seen = {dA: 0, dB: 0, dC: 0};
  [41, 38, 36, 34, 31, 29, 27, 24, 22, 20, 17, 15, 13, 10, 8, 6, 3, 1].forEach(function(daysAgo, i){
    var day = program.days.filter(function(d){ return d.id === order[i % 3]; })[0], k = seen[day.id]++;
    logs.push({id: "wDemo" + i, date: dAgo(daysAgo), dayId: day.id, dayName: day.name, rpe: 7 + (i % 3 === 1 ? 1 : 0), notes: i === 17 ? "Boa sessão, senti-me forte." : "",
      entries: day.exercises.map(function(e){
        var p = plan[e.id][k];
        return {exerciseId: e.id, name: e.name, sets: p[1].map(function(r, si){ var set = {reps: r, load: p[0]}; if (p[2]) set.rir = p[2][si]; return set; })};
      })});
  });
  var weights = [[84,78.4],[77,77.8],[70,77.2],[63,76.6],[56,76.0],[49,75.4],[42,74.8],[35,74.3],[28,73.7],[21,73.2],[14,73.1],[7,73.1],[0,73.0]].map(function(p){ return {date: dAgo(p[0]), w: p[1]}; });
  // adesão, fome, energia, treinos, refeições fora, horas de sono, stress, recuperação, qualidade do sono, digestão (os últimos check-ins com digestão baixa)
  var ci = [[64,7,6,6,3,2,6.5,6,6,6,7],[57,8,6,7,4,1,7,5,6,6,7],[50,8,5,7,4,1,7,5,7,7,7],[43,8,5,7,3,1,7.5,5,7,7,6],[36,9,5,8,4,0,7,4,8,7,6],[29,9,5,8,4,1,7,4,8,8,6],[22,9,4,8,3,1,7,4,7,7,5],[15,9,4,8,4,0,7.5,4,8,8,5],[8,9,5,7,4,1,7,5,7,7,4],[1,9,4,8,4,1,7,4,8,8,4]];
  var checkins = ci.map(function(c){ return {date: dAgo(c[0]), weight: weights.filter(function(w){ return w.date <= dAgo(c[0]); }).pop().w, adherence: c[1], hunger: c[2], energy: c[3], workouts: c[4], mealsOff: c[5], sleepHours: c[6], stress: c[7], recovery: c[8], sleepQuality: c[9], digestion: c[10], notes: c[0] === 1 ? "Peso parado mas sinto-me forte. Barriga um pouco inchada ao fim do dia." : ""}; });
  function photo(daysAgo, pos, set, i){ return {date: dAgo(daysAgo), position: pos, dataUrl: IMG[set + i], by: "profissional"}; }
  var photos = [];
  ["frente", "lado", "costas"].forEach(function(pos, i){ photos.push(photo(84, pos, "antes", i)); photos.push(photo(7, pos, "depois", i)); });
  return {
    id: "demo-ana", isDemo: true, active: true, initials: "AD", name: "Ana Demo (completa)", age: 34, sex: "Feminino", height: 168,
    weightInitial: 78.4, weightCurrent: 73.0, weightGoal: 68, goal: "Perda de gordura", trainingsPerWeek: 3, trainingDays: [1, 3, 5], trainingType: "Musculação", trainingTime: "18:30",
    wakeTime: "07:00", sleepTime: "23:00", likes: ["Frango", "Ovos", "Batata-doce"], dislikes: ["Fígado"], avoid: [], allergies: [],
    mealsPreferred: 5, budget: "Médio", cookTime: "30 min/dia", work: "Escritório", weekendNote: "Almoço fora ao domingo",
    targets: {kcal: 1900, protein: 140, carbs: 190, fat: 62}, flexibility: 55, flexOverrides: {}, alerts: [],
    flexHistory: [{date: dAgo(42), from: 35, to: 45, note: "Boa adesão — mais escolha."}, {date: dAgo(14), from: 45, to: 55, note: "Adesão a 9/10 — autonomia maior."}],
    blockedFoods: [], notes: "Demonstração completa: peso estagnado há 3 semanas apesar de treinar e aderir bem; digestão em queda; Supino e Elevações laterais prontos para subir carga.",
    meals: [
      meal("Pequeno-almoço", "07:30", [food("Iogurte grego natural", "200 g", "laticinios"), food("Aveia", "60 g", "cereais"), food("Mirtilos", "80 g", "fruta")]),
      meal("Meio da manhã", "10:30", [food("Maçã", "1 unid.", "fruta"), food("Frutos secos", "15 g", "gorduras")]),
      meal("Almoço", "13:00", [food("Frango (peito)", "160 g", "carnes"), food("Arroz (cozido)", "180 g", "cereais"), food("Brócolos", "à vontade", "vegetais"), food("Azeite", "10 ml", "gorduras", false)]),
      meal("Lanche", "17:00", [food("Banana", "1 unid.", "fruta"), food("Ovos", "2 unid.", "carnes")]),
      meal("Jantar", "20:30", [food("Pescada", "180 g", "carnes"), food("Batata-doce", "220 g", "cereais"), food("Salada mista", "à vontade", "vegetais")])
    ],
    checkins: checkins, weights: weights,
    assessments: [
      {date: dAgo(84), weight: 78.4, bodyFat: 33.5, muscle: 27.0, visceral: 9, water: 47.5, waist: 92, hip: 108, chest: 100, arm: 31, thigh: 62},
      {date: dAgo(42), weight: 74.8, bodyFat: 31.2, muscle: 27.4, visceral: 8, water: 48.6, waist: 87.5, hip: 106, chest: 98.5, arm: 31, thigh: 61},
      {date: dAgo(7), weight: 73.1, bodyFat: 29.6, muscle: 27.9, visceral: 7, water: 49.8, waist: 84, hip: 104, chest: 97, arm: 31.5, thigh: 59.5}
    ],
    allowPhotos: true, photos: photos,
    planHistory: [{date: dAgo(84), kcal: 2100, flex: 35, label: "Plano 1"}, {date: dAgo(42), kcal: 1950, flex: 45, label: "Plano 2"}, {date: dAgo(14), kcal: 1900, flex: 55, label: "Plano 3"}],
    substitutionHistory: [], adaptationHistory: [], mealDailyState: null,
    trainingProgram: program, workoutLogs: logs, lastCheckinDaysAgo: 1
  };
}
STUDENTS.push(buildFullDemoStudent());

function findStudent(id){ for (var i=0;i<STUDENTS.length;i++) if (STUDENTS[i].id===id) return STUDENTS[i]; return null; }

/* ===================== SUPABASE (base de dados real) ===================== */
var SUPABASE_URL = "https://qjzmiucmzbsdkoaqrbxd.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqem1pdWNtemJzZGtvYXFyYnhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMDc3NzgsImV4cCI6MjEwNTY4Mzc3OH0.eo8C6iPc-7ldy3m6jVTKMByOccaMX3_qnTVkLc7N1eU";
var sb = null;
var sbReady = false;

function initSupabase(){
  try {
    if (window.supabase && typeof window.supabase.createClient === "function"){
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      sbReady = true;
    }
  } catch(e){ sbReady = false; }
  var label = document.getElementById("dbStatusLabel");
  if (label) label.textContent = sbReady ? "· ligado a uma base de dados real" : "· modo local (sem ligação à base de dados)";
}

// meals guarda só estrutura (nome/horário/alimentos) — nunca estado do dia nem
// substituições aplicadas pelo aluno, mesmo que por algum motivo estejam
// presentes em memória no momento de gravar.
function stripMealState(m){
  return {
    name: m.name, time: m.time,
    foods: (m.foods || []).map(function(f){
      var base = f.original || f; // se f vem de uma vista com substituição aplicada, o valor estrutural é o original
      return {name: base.name, qty: base.qty, group: f.group, required: f.required};
    })
  };
}

// Compatibilidade com dados de antes desta migração: nessa altura, o estado do
// dia (done/adapted/status/liveChoice/substituições) vinha embutido dentro de
// "meals". Se ainda não existir meal_daily_state para hoje mas "meals" trouxer
// esses campos residuais, aproveita-os uma vez para não apagar o dia do aluno.
function migrateLegacyMealState(rawMeals){
  var entries = {};
  var any = false;
  (rawMeals || []).forEach(function(m){
    var hasState = m.done || m.adapted || (m.status && m.status !== "planned") || m.rescheduledTime || m.liveChoice ||
      (m.foods || []).some(function(f){ return f.original; });
    if (!hasState) return;
    any = true;
    var entry = emptyDailyStateEntry();
    entry.done = !!m.done;
    entry.adapted = !!m.adapted;
    entry.status = m.status || "planned";
    entry.rescheduledTime = m.rescheduledTime || null;
    entry.liveChoice = m.liveChoice || null;
    (m.foods || []).forEach(function(f, fi){
      if (f.original) entry.substitutions[fi] = {name: f.name, qty: f.qty};
    });
    entries[mealKey(m)] = entry;
  });
  return any ? {date: todayISO(), entries: entries} : null;
}

// _resolvedUrl é um URL assinado TEMPORÁRIO (expira ao fim de horas — ver
// resolvePhotoUrls) calculado em memória a cada sessão; nunca deve ser
// escrito na base de dados, só o "path" é permanente. Sem este strip, uma
// gravação qualquer feita depois de resolvePhotoUrls() ter corrido gravava
// esse URL já expirado na coluna photos (Fase 9 — bug encontrado na auditoria).
function stripPhotoState(p){
  var c = Object.assign({}, p);
  delete c._resolvedUrl;
  return c;
}

/* ---------- Dados vindos da base de dados: nunca confiar na forma (o aluno escreve nas suas próprias linhas) ----------
   workout_logs e checkins são JSON que o aluno consegue acrescentar à mão: aqui ficam só campos conhecidos, com o tipo certo,
   para um valor forjado (HTML no RPE, data inválida, entries em vez de array...) nunca chegar ao ecrã nem partir os cálculos. */
function isIsoDate(v){ return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v); }
function finiteNum(v){ var n = typeof v === "number" ? v : (typeof v === "string" && v.trim() !== "" ? Number(v) : NaN); return isFinite(n) ? n : null; }
function shortStr(v, max){ return typeof v === "string" ? v.slice(0, max) : ""; }
// Só tipos/estrutura (nunca altera dados legítimos): um valor forjado de outro tipo não pode partir o login nem os ecrãs.
function objectsOnly(arr){ return Array.isArray(arr) ? arr.filter(function(x){ return x && typeof x === "object" && !Array.isArray(x); }) : []; }
function normalizeWeights(arr){ return objectsOnly(arr).filter(function(w){ return isIsoDate(w.date) && finiteNum(w.w) != null; }).map(function(w){ return Object.assign({}, w, {w: finiteNum(w.w)}); }); }
function normalizePhotos(arr){ return objectsOnly(arr).filter(function(p){ return isIsoDate(p.date); }); }
function isPlainObject(v){ return !!v && typeof v === "object" && !Array.isArray(v); }
var MEAL_STATUSES = ["planned", "skipped", "rescheduled", "flexible"];
// estado do dia: reconstrói cada entrada só com os campos e tipos que a app escreve (o aluno pode escrever o que quiser na sua linha)
function normalizeMealState(v){
  if (!isPlainObject(v) || typeof v.date !== "string" || !isPlainObject(v.entries)) return null; // forma errada: o estado do dia reconstrói-se
  var entries = {};
  Object.keys(v.entries).forEach(function(k){
    var e = v.entries[k];
    if (!isPlainObject(e)) return;
    var subs = {};
    if (isPlainObject(e.substitutions)) Object.keys(e.substitutions).forEach(function(i){
      var x = e.substitutions[i];
      if (!/^\d{1,3}$/.test(i) || !isPlainObject(x) || typeof x.name !== "string" || !x.name) return;
      var qty = typeof x.qty === "string" ? x.qty : (typeof x.qty === "number" && isFinite(x.qty) ? String(x.qty) : "");
      subs[i] = {name: x.name.slice(0, 400), qty: qty.slice(0, 120)}; // tetos só contra abuso: há nomes do catálogo com ~200 caracteres e cortá-los perde a informação nutricional
    });
    var live = null;
    if (isPlainObject(e.liveChoice)){
      live = {};
      Object.keys(e.liveChoice).forEach(function(g){ var n = e.liveChoice[g]; if (typeof n === "number" && isFinite(n) && Math.floor(n) === n && n >= -1 && n <= 100000) live[g] = n; }); // índice em optionsFor(): os grupos grandes passam das 600 opções
    }
    entries[k] = {
      done: e.done === true, adapted: e.adapted === true,
      status: MEAL_STATUSES.indexOf(e.status) >= 0 ? e.status : "planned",
      rescheduledTime: typeof e.rescheduledTime === "string" && /^([01]?\d|2[0-3]):[0-5]\d$/.test(e.rescheduledTime) ? e.rescheduledTime : null,
      liveChoice: live, substitutions: subs
    };
  });
  return Object.assign({}, v, {entries: entries});
}
function normalizeCheckins(arr){
  if (!Array.isArray(arr)) return [];
  return arr.filter(function(c){ return c && typeof c === "object" && isIsoDate(c.date); }).map(function(c){
    var out = {date: c.date, weight: finiteNum(c.weight) || 0, hunger: finiteNum(c.hunger) || 0, energy: finiteNum(c.energy) || 0,
      adherence: finiteNum(c.adherence) || 0, workouts: finiteNum(c.workouts) || 0, mealsOff: finiteNum(c.mealsOff) || 0, notes: shortStr(c.notes, 2000)};
    ["sleepHours", "stress", "recovery", "sleepQuality", "digestion"].forEach(function(k){ var v = finiteNum(c[k]); if (v != null) out[k] = v; });
    return out;
  });
}
function normalizeWorkoutLogs(arr){
  if (!Array.isArray(arr)) return [];
  return arr.filter(function(l){ return l && typeof l === "object" && isIsoDate(l.date); }).map(function(l){
    var rpe = finiteNum(l.rpe);
    return {
      id: shortStr(l.id, 40) || uidShort("w"), date: l.date, dayId: shortStr(l.dayId, 40) || null, dayName: shortStr(l.dayName, 80),
      rpe: rpe != null && rpe >= 1 && rpe <= 10 ? Math.round(rpe) : null, notes: shortStr(l.notes, 500),
      entries: (Array.isArray(l.entries) ? l.entries : []).slice(0, 60).filter(function(e){ return e && typeof e === "object"; }).map(function(e){
        return {exerciseId: shortStr(e.exerciseId, 40) || null, name: shortStr(e.name, 120),
          sets: (Array.isArray(e.sets) ? e.sets : []).slice(0, 40).map(function(x){
            var reps = finiteNum(x && x.reps), load = finiteNum(x && x.load);
            if (!(reps != null && reps >= 1 && reps <= 100)) return null;
            var o = {reps: Math.round(reps), load: load != null && load > 0 && load <= 1000 ? load : 0}, rir = finiteNum(x && x.rir);
            if (rir != null && rir >= 0 && rir <= 10) o.rir = Math.round(rir);
            return o;
          }).filter(Boolean)};
      })
    };
  });
}

function checkinsForWrite(s){ return Array.isArray(s.checkinsRaw) ? s.checkinsRaw : (s.checkins || []); }
function workoutLogsForWrite(s){ return Array.isArray(s.workoutLogsRaw) ? s.workoutLogsRaw : (s.workoutLogs || []); }
function pushCheckin(s, c){ s.checkins.push(c); if (Array.isArray(s.checkinsRaw)) s.checkinsRaw.push(c); }

function studentToRow(s){
  var row = {
    id: s.id, initials: s.initials, name: s.name, age: s.age, sex: s.sex, height: s.height,
    birth_date: s.birthDate || null,
    weight_initial: s.weightInitial, weight_current: s.weightCurrent, weight_goal: s.weightGoal,
    goal: s.goal, trainings_per_week: s.trainingsPerWeek, training_days: s.trainingDays || [], activity_level: s.activityLevel || null,
    training_type: s.trainingType, training_time: s.trainingTime, wake_time: s.wakeTime, sleep_time: s.sleepTime,
    likes: s.likes || [], dislikes: s.dislikes || [], avoid: s.avoid || [], allergies: s.allergies || [],
    meals_preferred: s.mealsPreferred, budget: s.budget, cook_time: s.cookTime, work: s.work, weekend_note: s.weekendNote,
    targets: s.targets || {}, flexibility: s.flexibility, alerts: s.alerts || [], notes: s.notes || "",
    meals: (s.meals || []).map(stripMealState), checkins: checkinsForWrite(s), weights: s.weights || [], assessments: s.assessments || [],
    allow_photos: !!s.allowPhotos, photos: (s.photos || []).map(stripPhotoState), plan_history: s.planHistory || [],
    meals_date: s.mealsDate || null, from_onboarding: !!s.fromOnboarding, invite_email: s.inviteEmail || null,
    flex_overrides: s.flexOverrides || {}, flex_history: s.flexHistory || [], blocked_foods: s.blockedFoods || [],
    substitution_history: s.substitutionHistory || [], adaptation_history: s.adaptationHistory || [],
    meal_daily_state: s.mealDailyState || null, is_demo: !!s.isDemo, active: s.active !== false,
    meals_at_work_ease: s.mealsAtWorkEase || null, uses_supplements: !!s.usesSupplements, supplements: s.supplements || [],
    daily_eating_description: s.dailyEatingDescription || null, overeating_meals_per_week: s.overeatingMealsPerWeek != null ? s.overeatingMealsPerWeek : null,
    hardest_food_to_resist: s.hardestFoodToResist || null, water_intake: s.waterIntake || null,
    medical_conditions: s.medicalConditions || null, current_medication: s.currentMedication || null,
    physical_limitations: s.physicalLimitations || null, medical_notes: s.medicalNotes || null,
    weight_log_photos: (s.weightLogPhotos || []).map(stripPhotoState)
  };
  // telefone e registo de contactos (migração 0022): só se a base de dados já as tem; só o profissional os altera
  if (contactColumnsAvailable){ row.phone = s.phone || null; row.contact_log = s.contactLog || []; }
  if (studioOnlyColumnAvailable) row.studio_only = !!s.studioOnly; // migração 0026
  if (noNutritionColumnAvailable) row.no_nutrition = !!s.noNutrition; // migração 0030 (aluno que não faz nutrição com o profissional)
  if (phaseColumnAvailable) row.nutrition_phase = s.nutritionPhase || null; // migração 0029 (fase bulk/cut e creatina)
  // colunas do módulo de treino (migração 0019): só se a base de dados já as tem
  // Cada papel só escreve o que é seu (uma cópia antiga nunca apaga sessões novas nem choca com o programa mudado):
  // o aluno envia as sessões e nunca o programa; o profissional envia o programa e nunca as sessões.
  if (trainingColumnsAvailable){
    if (authRole !== "student") row.training_program = s.trainingProgram || null;
    if (authRole !== "professional") row.workout_logs = workoutLogsForWrite(s);
  }
  return row;
}
var trainingColumnsAvailable = true;

function rowToStudent(r){
  return {
    id: r.id, initials: r.initials, name: r.name, age: r.age, sex: r.sex, height: r.height,
    birthDate: r.birth_date || null,
    authUserId: r.auth_user_id || null, // só leitura: pasta do aluno no Storage (nunca é gravado de volta)
    weightInitial: r.weight_initial, weightCurrent: r.weight_current, weightGoal: r.weight_goal,
    goal: r.goal, trainingsPerWeek: r.trainings_per_week, trainingDays: r.training_days || [], activityLevel: r.activity_level || null,
    trainingType: r.training_type, trainingTime: r.training_time, wakeTime: r.wake_time, sleepTime: r.sleep_time,
    likes: r.likes || [], dislikes: r.dislikes || [], avoid: r.avoid || [], allergies: r.allergies || [],
    mealsPreferred: r.meals_preferred, budget: r.budget, cookTime: r.cook_time, work: r.work, weekendNote: r.weekend_note,
    targets: r.targets || {}, flexibility: r.flexibility, alerts: r.alerts || [], notes: r.notes || "",
    meals: (r.meals || []).map(stripMealState), checkins: normalizeCheckins(r.checkins), weights: normalizeWeights(r.weights), assessments: r.assessments || [],
    allowPhotos: r.allow_photos, photos: normalizePhotos(r.photos), planHistory: r.plan_history || [],
    mealsDate: r.meals_date, fromOnboarding: !!r.from_onboarding, inviteEmail: r.invite_email || null,
    flexOverrides: r.flex_overrides || {}, flexHistory: r.flex_history || [], blockedFoods: r.blocked_foods || [],
    substitutionHistory: objectsOnly(r.substitution_history), adaptationHistory: objectsOnly(r.adaptation_history),
    mealDailyState: normalizeMealState(r.meal_daily_state) || migrateLegacyMealState(r.meals), isDemo: !!r.is_demo, active: r.active !== false,
    mealsAtWorkEase: r.meals_at_work_ease || null, usesSupplements: !!r.uses_supplements, supplements: r.supplements || [],
    dailyEatingDescription: r.daily_eating_description || null, overeatingMealsPerWeek: r.overeating_meals_per_week != null ? r.overeating_meals_per_week : null,
    hardestFoodToResist: r.hardest_food_to_resist || null, waterIntake: r.water_intake || null,
    medicalConditions: r.medical_conditions || null, currentMedication: r.current_medication || null,
    physicalLimitations: r.physical_limitations || null, medicalNotes: r.medical_notes || null,
    weightLogPhotos: normalizePhotos(r.weight_log_photos),
    studioOnly: !!r.studio_only,
    noNutrition: !!r.no_nutrition,
    nutritionPhase: r.nutrition_phase && typeof r.nutrition_phase === "object" && !Array.isArray(r.nutrition_phase) ? r.nutrition_phase : null,
    phone: r.phone || null, contactLog: Array.isArray(r.contact_log) ? r.contact_log : [], createdAt: r.created_at || null,
    trainingProgram: r.training_program || null,
    workoutLogs: normalizeWorkoutLogs(r.workout_logs),
    // cópia fiel do que está na base de dados: é ISTO que se grava de volta (a versão normalizada serve só para mostrar —
    // uma normalização que corte texto longo quebraria o "só acrescentar" do servidor e bloquearia todas as gravações do aluno)
    checkinsRaw: Array.isArray(r.checkins) ? r.checkins.slice() : [],
    workoutLogsRaw: Array.isArray(r.workout_logs) ? r.workout_logs.slice() : []
  };
}

// Encontrado na validação real da Fase 9: upsert() em "students" falha SEMPRE
// que é o próprio aluno a gravar (erro RLS "new row violates row-level
// security policy"), porque o aluno nunca teve nem deve ter uma política de
// INSERT — só "student reads own row" (select) e "student updates own row"/
// "student claims invited row" (update). O Postgres exige que a política de
// INSERT passe mesmo no ramo ON CONFLICT DO UPDATE de um upsert, e como essa
// política não existe para o aluno (de propósito: o aluno nunca deve poder
// criar uma linha), TODO upsert feito pelo aluno era silenciosamente
// rejeitado — isto impedia qualquer aluno real de gravar seja o que for
// (concluir refeição, check-in, fotos, etc.). A correção é usar update(),
// que só depende da política de UPDATE já existente. Criar um aluno novo é
// sempre feito pelo profissional, através de insertStudent() (insert
// explícito), nunca por aqui.
/* ---------- Gravação na base de dados: só o que mudou, agrupada e com fila (funciona sem rede) ----------
   Cada alteração entra primeiro numa fila guardada no telemóvel (localStorage) e só depois segue para o Supabase. Se não houver
   rede, a fila espera e é enviada quando a ligação voltar; nada se perde ao fechar a app. Só se enviam as colunas que mudaram
   (comparadas com a última versão aceite pelo servidor), por isso um aluno nunca reenvia — nem pode apagar — dados que só o
   profissional altera. O aluno também guarda uma cópia da sua ficha para conseguir abrir a app sem ligação. */
var PERSIST_DEBOUNCE_MS = 500;
var OUTBOX_KEY = "evolve_outbox_v1";
var SNAPSHOT_KEY = "evolve_snapshot_v1";
var OUTBOX_RETRY_MS = 15000;
var TRAINING_COLUMNS = ["training_program", "workout_logs"];
var CONTACT_COLUMNS = ["phone", "contact_log"];
var contactColumnsAvailable = true; // migração 0022 (telefone e registo de contactos)
var studioOnlyColumnAvailable = true; // migração 0026 (aluno só de estúdio)
var noNutritionColumnAvailable = true; // migração 0030 (aluno sem nutrição)
var phaseColumnAvailable = true; // migração 0029 (fase nutricional bulk/cut)
var outboxMem = null;
var persistTimers = {}, persistStudents = {};
var outboxFlushPromise = null, outboxRetryTimer = null;

function jsonOf(v){ try { return JSON.stringify(v === undefined ? null : v); } catch (e) { return "null"; } }
function rowBaseline(row){ var b = {}; Object.keys(row).forEach(function(k){ b[k] = jsonOf(row[k]); }); return b; }
// última versão de cada coluna aceite pelo servidor; não enumerável para nunca entrar em cópias nem em comparações da ficha
function setSyncBaseline(s, baseline){ try { Object.defineProperty(s, "_sync", {value: baseline, writable: true, configurable: true, enumerable: false}); } catch (e) {} }
function ensureSyncBaseline(s){ if (s && !s._sync){ try { setSyncBaseline(s, rowBaseline(studentToRow(s))); } catch (e) {} } }
function rowPatch(row, baseline){
  if (!baseline) return row;
  var p = {};
  Object.keys(row).forEach(function(k){ if (jsonOf(row[k]) !== baseline[k]) p[k] = row[k]; });
  return p;
}

function outboxRead(){
  if (outboxMem) return outboxMem;
  try { var v = JSON.parse(localStorage.getItem(OUTBOX_KEY) || "{}"); outboxMem = v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { outboxMem = {}; }
  return outboxMem;
}
var outboxStorageOk = true; // falso se o telemóvel não deixou guardar a fila (sem espaço / modo privado): as alterações só existem em memória
function outboxWrite(){ try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(outboxMem || {})); outboxStorageOk = true; } catch (e) { outboxStorageOk = false; } return outboxStorageOk; }
function cloneJson(v){ return JSON.parse(jsonOf(v)); } // cópia independente: a ficha continua a mudar enquanto o pedido segue
function outboxCount(){ return Object.keys(outboxRead()).length; }
function outboxAdd(id, patch, full){
  var ob = outboxRead(), cur = ob[id] || {cols: {}, full: false};
  Object.keys(patch).forEach(function(k){ cur.cols[k] = patch[k]; });
  cur.full = cur.full || !!full;
  cur.ts = Date.now();
  ob[id] = cur;
  outboxWrite();
}
// ao abrir a app com alterações ainda por enviar, a ficha mostra-as já (o servidor ainda não as tem)
function outboxOverlay(rows){
  var ob = outboxRead();
  return (rows || []).map(function(r){
    var e = ob[r.id];
    if (!e) return r;
    var copy = Object.assign({}, r);
    Object.keys(e.cols).forEach(function(k){ copy[k] = e.cols[k]; });
    return copy;
  });
}

// cópia da ficha do próprio aluno para abrir sem rede (nunca se guarda a lista de alunos do profissional neste dispositivo)
function snapshotRead(uid){
  try { var v = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || "null"); return v && v.uid === uid && Array.isArray(v.rows) ? v : null; } catch (e) { return null; }
}
function snapshotWrite(uid, rows){ try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({uid: uid, ts: Date.now(), rows: rows})); } catch (e) {} }
function snapshotApplyPatch(id, patch){
  if (authRole !== "student") return;
  try {
    var v = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || "null");
    if (!v || !Array.isArray(v.rows)) return;
    v.rows.forEach(function(r){ if (r.id === id) Object.keys(patch).forEach(function(k){ r[k] = patch[k]; }); });
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(v));
  } catch (e) {}
}
function offlineDataWipe(){ outboxMem = {}; try { localStorage.removeItem(OUTBOX_KEY); localStorage.removeItem(SNAPSHOT_KEY); } catch (e) {} syncPillUpdate(); }

// indicador discreto no topo: sem ligação / alterações por enviar
function syncPillUpdate(){
  var el = document.getElementById("syncPill");
  if (!el){
    el = document.createElement("div");
    el.id = "syncPill"; el.className = "sync-pill hidden";
    el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
    el.addEventListener("click", function(){ outboxFlush(); });
    document.body.appendChild(el);
  }
  var n = outboxCount() + Object.keys(persistStudents).filter(function(id){ return !outboxRead()[id]; }).length;
  var offline = typeof navigator !== "undefined" && navigator.onLine === false;
  var text = "";
  if (offline) text = "Sem ligação" + (n ? (outboxStorageOk ? " · " + n + (n === 1 ? " alteração guardada" : " alterações guardadas") + " neste telemóvel" : " · não feches a app: as alterações ainda não estão guardadas") : "");
  else if (n) text = outboxFlushPromise ? "A enviar…" : "⏳ " + n + (n === 1 ? " alteração por enviar" : " alterações por enviar");
  el.textContent = text;
  el.classList.toggle("hidden", !text || !sbReady);
}

function outboxErrorIsTransient(res){
  var e = (res && res.error) || {}, msg = String(e.message || ""), st = res && res.status;
  if (!st || st >= 500 || st === 401 || st === 408 || st === 429) return true; // sem resposta do servidor, sessão a renovar ou servidor ocupado
  return /failed to fetch|network|timeout|load failed|jwt/i.test(msg);
}
function withTimeout(promise, ms){
  return new Promise(function(resolve, reject){
    var t = setTimeout(function(){ reject(new Error("timeout")); }, ms);
    Promise.resolve(promise).then(function(v){ clearTimeout(t); resolve(v); }, function(e){ clearTimeout(t); reject(e); });
  });
}

// o pedido à fila: só as colunas que mudaram desde a última versão aceite (síncrono, é seguro chamar ao fechar a app)
function persistPrepare(id){
  var s = persistStudents[id];
  clearTimeout(persistTimers[id]); delete persistTimers[id]; delete persistStudents[id];
  if (!s) return;
  var row;
  try { row = studentToRow(s); } catch (e) { console.error("Supabase: não foi possível preparar a gravação", id, e); return; }
  var patch = rowPatch(row, s._sync);
  var pending = outboxRead()[id];
  if (pending) Object.keys(pending.cols).forEach(function(k){
    // uma alteração desfeita antes de seguir tem de substituir a que está na fila
    if (!(k in patch) && k in row && jsonOf(row[k]) !== jsonOf(pending.cols[k])) patch[k] = row[k];
  });
  if (!Object.keys(patch).length) return;
  // a ficha é alterada no sítio (marcar outra refeição, registar outro treino): a fila guarda cópias, nunca referências vivas
  Object.keys(patch).forEach(function(k){ patch[k] = cloneJson(patch[k]); });
  outboxAdd(id, patch, !s._sync);
  snapshotApplyPatch(id, patch);
}
function persistPrepareAll(){ Object.keys(persistStudents).forEach(persistPrepare); }

// devolve "queued" se já se sabe que não há rede (a alteração fica guardada no telemóvel), "sent" caso contrário
function persistStudent(s){
  if (!sbReady) return "local";
  lastLocalWriteAt = Date.now();
  persistStudents[s.id] = s;
  clearTimeout(persistTimers[s.id]);
  persistTimers[s.id] = setTimeout(function(){ persistPrepare(s.id); outboxFlush(); }, PERSIST_DEBOUNCE_MS);
  syncPillUpdate();
  return typeof navigator !== "undefined" && navigator.onLine === false ? "queued" : "sent";
}

function outboxAcked(id, cols){
  var ob = outboxRead(), entry = ob[id], s = findStudent(id);
  if (s){
    if (!s._sync && entry && entry.full) setSyncBaseline(s, rowBaseline(cols));
    else if (s._sync) Object.keys(cols).forEach(function(k){ s._sync[k] = jsonOf(cols[k]); });
  }
  if (entry){
    Object.keys(cols).forEach(function(k){ if (k in entry.cols && jsonOf(entry.cols[k]) === jsonOf(cols[k])) delete entry.cols[k]; });
    if (!Object.keys(entry.cols).length) delete ob[id];
  }
  outboxWrite();
}

// depois de a ficha mudar por causa do servidor, o ecrã atual mostra a versão certa (sem tocar numa janela aberta)
function redrawAfterSync(){
  try {
    if (modalRoot && modalRoot.firstChild) return;
    if (state.mode === "aluno") renderAlunoShell();
    else if (authRole === "professional") renderProShell();
  } catch (e) {}
}
// repõe a ficha com a versão do servidor (no próprio objeto, para o resto da app continuar a vê-la)
function reconcileStudentFromServer(id){
  return Promise.resolve(sb.from("students").select("*").eq("id", id).maybeSingle()).then(function(res){
    var row = res && res.data;
    var s = findStudent(id);
    if (!row || !s) return false;
    Object.assign(s, rowToStudent(row));
    setSyncBaseline(s, rowBaseline(studentToRow(s)));
    snapshotApplyPatch(id, row);
    redrawAfterSync();
    return true;
  }, function(){ return false; });
}
// treinos recusados porque outro aparelho já acrescentou sessões: junta por id (as do servidor primeiro) e reenvia
function mergeWorkoutLogsAndResend(id){
  var entry = outboxRead()[id];
  var local = entry && entry.cols.workout_logs;
  if (!Array.isArray(local)) return Promise.resolve(false);
  return Promise.resolve(sb.from("students").select("workout_logs").eq("id", id).maybeSingle()).then(function(res){
    var server = res && res.data && Array.isArray(res.data.workout_logs) ? res.data.workout_logs : null;
    if (!server) return false;
    var have = {};
    server.forEach(function(l){ if (l && l.id) have[l.id] = true; });
    var merged = server.concat(local.filter(function(l){ return l && l.id && !have[l.id]; }));
    return Promise.resolve(sb.from("students").update({workout_logs: merged}).eq("id", id).select("id")).then(function(r2){
      if (r2 && r2.error) return false;
      var s = findStudent(id);
      if (s){ s.workoutLogsRaw = merged.slice(); s.workoutLogs = normalizeWorkoutLogs(merged); if (!s._sync) ensureSyncBaseline(s); else s._sync.workout_logs = jsonOf(merged); }
      var e = outboxRead()[id];
      if (e){ delete e.cols.workout_logs; if (!Object.keys(e.cols).length) delete outboxRead()[id]; outboxWrite(); }
      snapshotApplyPatch(id, {workout_logs: merged});
      redrawAfterSync();
      return true;
    });
  }, function(){ return false; });
}

// envia as colunas pendentes de um aluno; resolve com true se ficou tudo enviado ou descartado e false se foi só um problema de ligação
function outboxSendCols(id, cols){
  if (!Object.keys(cols).length) return Promise.resolve(true);
  return Promise.resolve(sb.from("students").update(cols).eq("id", id).select("id")).then(function(res){
    if (res && !res.error && Array.isArray(res.data) && res.data.length === 0){
      // o servidor não alterou nenhuma linha (sem permissão ou ficha inexistente): não se pode dar como enviado
      res = {error: {message: "ficha não encontrada ou sem permissão", code: "0"}, status: 400};
    }
    if (!res || !res.error){ outboxAcked(id, cols); return true; }
    var msg = String(res.error.message || "");
    if (trainingColumnsAvailable && /training_program|workout_logs/.test(msg) && /column|schema|does not exist/i.test(msg)){
      // a migração 0019 ainda não foi aplicada: grava tudo o resto e avisa, em vez de perder as outras alterações
      trainingColumnsAvailable = false;
      showToast("⚠ O treino ainda não pode ser guardado: falta correr a migração 0019 no Supabase (SQL Editor). O resto foi guardado.");
      return outboxSendOne(id);
    }
    if (contactColumnsAvailable && /\bphone\b|contact_log/.test(msg) && /column|schema|does not exist/i.test(msg)){
      contactColumnsAvailable = false;
      showToast("⚠ O telefone e o registo de contactos ainda não podem ser guardados: falta correr a migração 0022 no Supabase.");
      return outboxSendOne(id);
    }
    if (noNutritionColumnAvailable && /no_nutrition/.test(msg) && /column|schema|does not exist/i.test(msg)){
      noNutritionColumnAvailable = false; // migração 0030 por aplicar: o resto grava-se na mesma
      showToast("⚠ «Não faz nutrição comigo» ainda não pode ser guardado: falta correr a migração 0030 no Supabase.");
      return outboxSendOne(id);
    }
    if (studioOnlyColumnAvailable && /studio_only/.test(msg) && /column|schema|does not exist/i.test(msg)){
      studioOnlyColumnAvailable = false; // migração 0026 por aplicar: o resto grava-se na mesma
      return outboxSendOne(id);
    }
    if (phaseColumnAvailable && /nutrition_phase/.test(msg) && /column|schema|does not exist/i.test(msg)){
      phaseColumnAvailable = false; // migração 0029 por aplicar: o resto grava-se na mesma
      showToast("⚠ A fase nutricional ainda não pode ser guardada: falta correr a migração 0029 no Supabase. O resto foi guardado.");
      return outboxSendOne(id);
    }
    if (outboxErrorIsTransient(res)) return false;
    var keys = Object.keys(cols);
    if (keys.length > 1){
      // uma coluna recusada não pode levar as outras consigo: reenvia-se uma a uma
      var chain = Promise.resolve(true);
      keys.forEach(function(k){ var one = {}; one[k] = cols[k]; chain = chain.then(function(ok){ return outboxSendCols(id, one).then(function(ok2){ return ok && ok2; }); }); });
      return chain;
    }
    // uma só coluna recusada pelo servidor
    var col = keys[0];
    var settle = col === "workout_logs" ? mergeWorkoutLogsAndResend(id) : Promise.resolve(false);
    return settle.then(function(merged){
      if (merged) return true;
      console.error("Supabase: gravação recusada", id, col, msg);
      var e = outboxRead()[id];
      if (e){ delete e.cols[col]; if (!Object.keys(e.cols).length) delete outboxRead()[id]; outboxWrite(); }
      showToast("⚠ Uma alteração não foi aceite pelo servidor (" + (msg || "recusada") + "). A ficha foi atualizada com a versão do servidor.");
      return reconcileStudentFromServer(id).then(function(){ return true; });
    });
  }, function(){ return false; });
}
function outboxSendOne(id){
  var entry = outboxRead()[id];
  if (!entry) return Promise.resolve(true);
  var cols = {};
  Object.keys(entry.cols).forEach(function(k){ cols[k] = entry.cols[k]; });
  if (!trainingColumnsAvailable) TRAINING_COLUMNS.forEach(function(c){ delete cols[c]; });
  if (!contactColumnsAvailable) CONTACT_COLUMNS.forEach(function(c){ delete cols[c]; });
  if (!studioOnlyColumnAvailable) delete cols.studio_only;
  if (!noNutritionColumnAvailable) delete cols.no_nutrition;
  if (!phaseColumnAvailable) delete cols.nutrition_phase;
  if (!Object.keys(cols).length){ delete outboxRead()[id]; outboxWrite(); return Promise.resolve(true); }
  return outboxSendCols(id, cols);
}

function outboxFlush(){
  if (!sbReady) return Promise.resolve(false);
  if (outboxFlushPromise) return outboxFlushPromise;
  if (typeof navigator !== "undefined" && navigator.onLine === false){ syncPillUpdate(); return Promise.resolve(false); }
  persistPrepareAll();
  var ids = Object.keys(outboxRead());
  if (!ids.length){ syncPillUpdate(); return Promise.resolve(true); }
  var allOk = true, chain = Promise.resolve();
  ids.forEach(function(id){ chain = chain.then(function(){ return outboxSendOne(id); }).then(function(ok){ if (!ok) allOk = false; }); });
  outboxFlushPromise = chain.then(function(){
    outboxFlushPromise = null;
    clearTimeout(outboxRetryTimer);
    // ficou alterações novas na fila enquanto se enviava: seguem já; se foi falha de ligação, repete-se mais tarde
    if (outboxCount()) outboxRetryTimer = setTimeout(function(){ outboxFlush(); }, allOk ? 50 : OUTBOX_RETRY_MS);
    syncPillUpdate();
    return allOk && !outboxCount();
  }, function(){ outboxFlushPromise = null; syncPillUpdate(); return false; });
  syncPillUpdate();
  return outboxFlushPromise;
}
// no arranque: tenta enviar o que ficou por enviar, sem esperar mais do que alguns segundos
function outboxFlushAndWait(){
  if (!outboxCount()) return Promise.resolve(true);
  return withTimeout(outboxFlush(), 8000).catch(function(){ return false; });
}

/* ---------- Dados frescos para o profissional ----------
   A lista de alunos só era lida ao entrar. Agora volta a ler-se quando o profissional regressa à app (no máximo de minuto a minuto)
   ou toca em "Atualizar". Nunca se troca a ficha de um aluno com alterações por enviar nem a que está aberta no ecrã. */
var lastStudentsLoad = 0, proRefreshPromise = null, lastLocalWriteAt = 0;
var PRO_REFRESH_MIN_MS = 60000;
function proRefreshStudents(force){
  if (authRole !== "professional" || !sbReady || (typeof navigator !== "undefined" && navigator.onLine === false)) return Promise.resolve(false);
  if (!force && Date.now() - lastStudentsLoad < PRO_REFRESH_MIN_MS) return Promise.resolve(false);
  if (modalRoot && modalRoot.firstChild) return Promise.resolve(false); // uma janela aberta pode ter referências às fichas
  if (proRefreshPromise) return proRefreshPromise;
  var started = Date.now();
  proRefreshPromise = withTimeout(sb.from("students").select("*"), 15000).then(function(res){
    proRefreshPromise = null;
    if (!res || res.error || !Array.isArray(res.data)) return false;
    // houve alterações locais durante a leitura, ou abriu-se uma janela: esta leitura já pode estar desatualizada
    if (lastLocalWriteAt > started || (modalRoot && modalRoot.firstChild)) return false;
    lastStudentsLoad = Date.now();
    var byId = {}, ob = outboxRead();
    STUDENTS.forEach(function(st){ byId[st.id] = st; });
    // as fichas já existentes atualizam-se no próprio objeto (o resto da app guarda referências para elas)
    STUDENTS = res.data.map(function(r){
      var cur = byId[r.id];
      if (!cur) return rowToStudent(r);
      if (persistStudents[r.id] || ob[r.id] || state.proSelectedId === r.id) return cur;
      Object.assign(cur, rowToStudent(r));
      setSyncBaseline(cur, null); // volta a tirar-se a versão de partida quando for aberta
      return cur;
    });
    return true;
  }, function(){ proRefreshPromise = null; return false; });
  return proRefreshPromise;
}
// redesenha só o que é seguro: a lista de alunos, e só se não houver nada a meio (ficha aberta, janela aberta)
// um re-desenho em segundo plano não pode tirar o foco da pesquisa (o teclado fecharia-se e as letras perdiam-se)
function dashSearchFocused(){ var e = document.activeElement; return !!(e && e.id === "stuSearch"); }
function proRefreshAndRender(force){
  return proRefreshStudents(force).then(function(changed){
    if (changed && authRole === "professional" && state.mode === "pro" && !state.proSelectedId && state.proView === "dashboard" && !modalRoot.firstChild && !dashSearchFocused()){
      renderProDashboardMain();
    }
    return changed;
  });
}

// Só usado para CRIAR um aluno novo (sempre pelo profissional, coberto pela
// política "professional full access" for all). Nunca chamar isto para
// atualizar um aluno já existente — usa persistStudent().
// devolve uma promessa (true = gravado) para quem precisa que o aluno exista antes de lhe ligar outras linhas (sessões)
function insertStudent(s){
  if (!sbReady) return Promise.resolve(true);
  var row = studentToRow(s);
  return Promise.resolve(sb.from("students").insert(row)).then(function(res){
    if (res && res.error){
      console.error("Supabase: falha ao criar aluno", s.id, res.error.message);
      if (trainingColumnsAvailable && /training_program|workout_logs/.test(res.error.message || "")){
        trainingColumnsAvailable = false; // migração 0019 por aplicar: cria o aluno sem as colunas de treino
        showToast("⚠ O treino ainda não pode ser guardado: falta correr a migração 0019 no Supabase (SQL Editor).");
        return insertStudent(s);
      }
      if (contactColumnsAvailable && /\bphone\b|contact_log/.test(res.error.message || "")){
        contactColumnsAvailable = false; // migração 0022 por aplicar: cria o aluno sem telefone nem registo de contactos
        return insertStudent(s);
      }
      if (noNutritionColumnAvailable && /no_nutrition/.test(res.error.message || "")){
        noNutritionColumnAvailable = false; // migração 0030 por aplicar: cria o aluno sem a marca
        return insertStudent(s);
      }
      if (studioOnlyColumnAvailable && /studio_only/.test(res.error.message || "")){
        studioOnlyColumnAvailable = false; // migração 0026 por aplicar: cria o aluno sem a marca "só estúdio"
        return insertStudent(s);
      }
      if (phaseColumnAvailable && /nutrition_phase/.test(res.error.message || "")){
        phaseColumnAvailable = false; // migração 0029 por aplicar: cria o aluno sem a fase nutricional
        return insertStudent(s);
      }
      showToast("⚠ Não foi possível criar o aluno — verifica a tua ligação");
      return false;
    }
    setSyncBaseline(s, rowBaseline(row));
    return true;
  }, function(){ showToast("⚠ Não foi possível criar o aluno — verifica a tua ligação"); return false; });
}

function flexZoneLabel(v){ return TIER_LABEL[flexTier(v)]; }
function fmtDateFullPt(iso){ return isIsoDate(iso) ? iso.slice(8) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "—"; }
function toggleAssessSort(key){
  var cur = state.assessSort || {key:"date", dir:"desc"};
  state.assessSort = cur.key === key ? {key:key, dir: cur.dir === "desc" ? "asc" : "desc"} : {key:key, dir:"desc"};
}
function fmtDatePt(iso){ var d=new Date(iso+"T00:00:00"); return d.toLocaleDateString("pt-PT",{day:"2-digit",month:"short"}); }

function activityFromTrainings(n){
  if (n<=1) return 1.2;
  if (n<=3) return 1.375;
  if (n<=5) return 1.55;
  return 1.725;
}

// Fase 27: pedido explícito — o nº de treinos de musculação/semana é uma
// aproximação fraca do nível de atividade real (alguém pode treinar pouco
// mas ter um trabalho fisicamente exigente, ou o contrário). Passa a haver
// uma pergunta direta no questionário ("Sedentário"/"Levemente ativo"/
// "Moderadamente ativo"/"Muito ativo", os mesmos 4 níveis e fatores da
// literatura de TDEE) — quando o profissional a preenche, usa-se essa
// resposta; para alunos antigos sem este campo, mantém-se o fallback pelo
// nº de treinos, sem quebrar nada do que já existia.
var ACTIVITY_LEVEL_FACTORS = {
  "Sedentário": 1.2,
  "Levemente ativo": 1.375,
  "Moderadamente ativo": 1.55,
  "Muito ativo": 1.725
};
var ACTIVITY_LEVEL_OPTIONS = Object.keys(ACTIVITY_LEVEL_FACTORS);
// Fase 28: pedido explícito — uma descrição breve por nível, para o
// profissional (ou o aluno, se um dia preencher isto diretamente) escolher
// sem ter de adivinhar o que cada nível quer dizer.
var ACTIVITY_LEVEL_DESCRIPTIONS = {
  "Sedentário": "pouco ou nenhum exercício",
  "Levemente ativo": "exercício leve 1 a 3 dias/semana",
  "Moderadamente ativo": "exercício moderado 3 a 5 dias/semana",
  "Muito ativo": "exercício intenso 6 a 7 dias/semana"
};

function activityFactor(p){
  if (p && p.activityLevel && ACTIVITY_LEVEL_FACTORS[p.activityLevel] != null) return ACTIVITY_LEVEL_FACTORS[p.activityLevel];
  return activityFromTrainings((p && p.trainingsPerWeek) || 0);
}

// Fase 28: altura como lista de escolha (scroll), não um número livre a
// digitar — intervalo generoso (120-220cm) para cobrir qualquer aluno real.
var HEIGHT_OPTIONS = (function(){
  var arr = [];
  for (var h = 120; h <= 220; h++) arr.push(h);
  return arr;
})();

// Calcula a idade a partir da data de nascimento (aniversário já feito
// este ano ou não) — usado para preencher "Idade" automaticamente assim
// que a data é escolhida, em vez de pedir os dois em separado.
function ageFromBirthDate(dateStr){
  if (!dateStr) return null;
  var birth = new Date(dateStr + "T00:00:00");
  if (isNaN(birth.getTime())) return null;
  var today = new Date();
  var age = today.getFullYear() - birth.getFullYear();
  var m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

// Fase 28: pedido explícito — o questionário passa a mostrar só 3 objetivos
// ("Perda de peso"/"Aumento de massa muscular"/"Manutenção corporal") em
// vez dos 5 originais. As chaves antigas ficam todas — nunca são removidas
// — para os alunos já existentes com um destes goals gravado continuarem a
// funcionar exatamente como antes; as 3 novas têm os mesmos valores das
// equivalentes antigas. ONBOARDING_GOAL_OPTIONS é só a lista reduzida
// mostrada no <select> do questionário.
var GOAL_ADJUST = {
  "Perda de gordura": -20,
  "Ganho de massa muscular": 15,
  "Manutenção / recomposição": 0,
  "Recomposição corporal": -10,
  "Performance / melhoria do rendimento": 5,
  "Perda de peso": -20,
  "Aumento de massa muscular": 15,
  "Manutenção corporal": 0
};
var ONBOARDING_GOAL_OPTIONS = ["Perda de peso", "Aumento de massa muscular", "Manutenção corporal"];

// Fase 11: ritmo de ganho/perda gradual quando há um peso objetivo concreto
// (pedido explícito: "70kg -> 90kg" deve gerar um excedente moderado e
// constante, não uma % abrupta do TDEE). 0.5 kg/semana é o ritmo confirmado
// com o profissional; 7700 kcal/kg é a aproximação padrão usada na indústria
// (1kg de massa corporal ≈ 7700 kcal, a mesma base da regra "3500kcal = 1lb").
var WEIGHT_GOAL_RATE_KG_PER_WEEK = 0.5;
var KCAL_PER_KG = 7700;

// Fórmula de Mifflin-St Jeor (a mesma já usada para sugerir alvos no
// onboarding) — devolve null se faltar algum dado do perfil para calcular.
function computeBMR(sexOrProfile, weight, height, age){
  var sex = sexOrProfile, w = weight, h = height, a = age;
  if (typeof sexOrProfile === "object" && sexOrProfile){
    sex = sexOrProfile.sex; w = sexOrProfile.weightCurrent != null ? sexOrProfile.weightCurrent : sexOrProfile.weight; h = sexOrProfile.height; a = sexOrProfile.age;
  }
  if (!(w > 0) || !(h > 0) || !(a > 0)) return null;
  var bmr = sex === "Masculino" ? (10*w + 6.25*h - 5*a + 5) : (10*w + 6.25*h - 5*a - 161);
  return isFinite(bmr) && bmr > 0 ? Math.round(bmr) : null;
}

// Fase 25b: pedido de correção — a diferença junto a "Calorias" deve
// comparar com a MANUTENÇÃO (metabolismo basal × nível de atividade,
// mesmo cálculo de activityFromTrainings já usado para sugerir alvos),
// não com o metabolismo basal puro — o basal sozinho não conta o gasto do
// treino nem da atividade do dia a dia, por isso dava sempre um "+" bem
// maior do que o excedente/défice real face à manutenção.
function computeMaintenanceKcal(s){
  var bmr = computeBMR(s);
  if (!bmr) return null;
  return Math.round(bmr * activityFactor(s));
}

/* ---------- Limites de segurança dos alvos (prescrição) ----------
   - Piso calórico: nunca abaixo do metabolismo basal nem de 1200 (F) / 1500 (M) kcal.
   - Ritmo de perda: no máximo 0,5 kg/semana e 0,75% do peso corporal por semana (pessoas leves não perdem 0,5 kg/sem em segurança).
   - Proteína: por kg de peso de referência (o peso real, mas no máximo o peso a IMC 25) — nunca 2 g/kg de 120 kg de peso total.
   - Gordura: pelo menos 0,6 g/kg do peso de referência (função hormonal). */
var KCAL_FLOOR_BY_SEX = {"Feminino":1200, "Masculino":1500};
var MAX_LOSS_PCT_PER_WEEK = 0.75;
var GAIN_PCT_PER_WEEK = 0.4;
var MAX_SURPLUS_FRACTION = 0.15;
var FAT_MIN_G_PER_KG = 0.6;
// massa magra (kg) da avaliação mais recente com peso e % de gordura; null se não há
function latestLeanMass(s){
  var list = (s && s.assessments || []).slice().sort(function(x, y){ return compareAssessmentsDesc(x, y); });
  for (var i = 0; i < list.length; i++){
    var a = list[i];
    if (a.weight > 0 && a.bodyFat > 0 && a.bodyFat < 70) return Math.round(a.weight * (1 - a.bodyFat / 100) * 10) / 10;
  }
  return null;
}
function kcalFloorFor(sex, bmr, maintenance){
  var byBmr = bmr || 0;
  var bySex = KCAL_FLOOR_BY_SEX[sex] || 1200;
  // pessoas muito pequenas/sedentárias têm manutenção abaixo do piso habitual: o piso nunca pode ficar acima da manutenção
  // (senão uma meta de "perda" daria mais calorias do que manter), mas continua a não descer do metabolismo basal
  if (maintenance > 0) bySex = Math.min(bySex, maintenance * 0.95);
  return Math.max(byBmr, bySex);
}
// peso a usar nos g/kg: o real, mas limitado ao peso a IMC 25 quando a altura é conhecida (e há excesso de peso)
function referenceWeightKg(weight, height, leanMass){
  if (leanMass > 0) return leanMass;
  if (height > 0){
    var upper = 25 * Math.pow(height/100, 2);
    if (weight > upper) return Math.round(upper * 10) / 10;
  }
  return weight;
}

function computeSuggestedTargets(p){
  var bmr = computeBMR(p.sex, p.weight, p.height, p.age) || 0;
  var activity = activityFactor(p);
  var tdee = bmr * activity;
  var kcal;
  var losing = false;
  if (p.weightGoal && Math.abs(p.weightGoal - p.weight) >= 0.5){
    var direction = p.weightGoal > p.weight ? 1 : -1;
    var rate = WEIGHT_GOAL_RATE_KG_PER_WEEK;
    if (direction < 0) rate = Math.min(rate, p.weight * MAX_LOSS_PCT_PER_WEEK / 100);
    else rate = Math.min(rate, p.weight * GAIN_PCT_PER_WEEK / 100); // ganho magro: ≈ 0,4% do peso por semana
    var legacyAdjust = direction * (rate * KCAL_PER_KG) / 7;
    // o ponto de partida é um passo pequeno e gradual (cut −10 % da manutenção, bulk +5 %): o ritmo completo nunca entra de uma vez,
    // só se chega lá com as revisões periódicas do peso (ver PHASE_CFG e computePhaseReview)
    var startAdjust = direction < 0 ? -clampN(round25(tdee * PHASE_CFG.startCutPct / 100), PHASE_CFG.startCutMin, PHASE_CFG.startCutMax)
      : clampN(round25(tdee * PHASE_CFG.startBulkPct / 100), PHASE_CFG.startBulkMin, PHASE_CFG.startBulkMax);
    var dailyAdjust = direction < 0 ? Math.max(legacyAdjust, startAdjust) : Math.min(legacyAdjust, startAdjust);
    if (direction > 0) dailyAdjust = Math.min(dailyAdjust, tdee * MAX_SURPLUS_FRACTION); // nunca mais de +15% da manutenção
    kcal = Math.max(0, Math.round(tdee + dailyAdjust));
    losing = direction < 0;
  } else {
    var adjust = GOAL_ADJUST[p.goal] || 0;
    kcal = Math.max(0, Math.round(tdee * (1 + adjust/100)));
    losing = adjust < 0;
  }
  if (bmr && losing) kcal = Math.max(kcal, Math.ceil(kcalFloorFor(p.sex, bmr, Math.round(tdee))));
  return macrosForKcal(p.weight, p.height, p.leanMass, kcal);
}

// Avisos de prescrição para um conjunto de alvos (kcal/macros) de um aluno. Devolve [{level:"critical"|"warn", text}]
function nutritionSafetyWarnings(s, t){
  var out = [];
  if (!s || !t || !(t.kcal > 0)) return out;
  var weight = s.weightCurrent || s.weight || 0;
  var bmr = computeBMR(s);
  var maint = computeMaintenanceKcal(s);
  var carbs = t.carbs != null ? t.carbs : t.carbsMax, fat = t.fat != null ? t.fat : t.fatMax;
  if (bmr){
    var floor = kcalFloorFor(s.sex, bmr, maint);
    if (t.kcal < bmr) out.push({level:"critical", text:"Alvo de " + t.kcal + " kcal abaixo do metabolismo basal (" + bmr + " kcal): risco de perda de massa magra e de défice de micronutrientes."});
    else if (t.kcal < floor) out.push({level:"warn", text:"Alvo de " + t.kcal + " kcal abaixo do mínimo habitual (" + Math.round(floor) + " kcal) para " + (s.sex === "Masculino" ? "homens" : "mulheres") + "."});
  }
  if (maint && weight){
    var weeklyKg = (maint - t.kcal) * 7 / KCAL_PER_KG;
    if (weeklyKg > weight * MAX_LOSS_PCT_PER_WEEK / 100 + 0.05) out.push({level:"warn", text:"Défice de " + (maint - t.kcal) + " kcal/dia ≈ " + weeklyKg.toFixed(2).replace(".", ",") + " kg/semana, acima de " + MAX_LOSS_PCT_PER_WEEK + "% do peso por semana."});
    if (t.kcal > maint * 1.2) out.push({level:"warn", text:"Excedente de " + (t.kcal - maint) + " kcal/dia (>" + "20% da manutenção): ganho de gordura provável."});
  }
  var ref = referenceWeightKg(weight, s.height, null); // g/kg de peso corporal (limitado ao de IMC 25), tal como o texto dos avisos
  if (ref > 0){
    if (fat != null && fat < FAT_MIN_G_PER_KG * ref - 0.5) out.push({level:"warn", text:"Gordura de " + fat + " g (" + (fat / ref).toFixed(2).replace(".", ",") + " g/kg) abaixo do mínimo de " + FAT_MIN_G_PER_KG + " g/kg."});
    if (t.protein != null && t.protein > 2.6 * ref) out.push({level:"warn", text:"Proteína de " + t.protein + " g (" + (t.protein / ref).toFixed(1).replace(".", ",") + " g/kg) acima do necessário; ≈ 1,6–2,2 g/kg chega."});
    if (t.protein != null && t.protein < 1.2 * ref) out.push({level:"warn", text:"Proteína de " + t.protein + " g (" + (t.protein / ref).toFixed(1).replace(".", ",") + " g/kg) abaixo de 1,2 g/kg: baixa para preservar massa magra."});
  }
  if (carbs != null && carbs < 50 && t.kcal > 0) out.push({level:"warn", text:"Hidratos de " + carbs + " g: muito baixos para treinar com qualidade."});
  return out;
}

/* ---------- Creatina mono-hidratada em todos os planos ----------
   A creatina é uma LINHA CALCULADA, nunca guardada em s.meals: aparece sempre no pequeno-almoço (ou na primeira refeição com alimentos),
   com a dose do peso atual do aluno, e acompanha o peso sozinha. Assim vale para todos os planos (novos e antigos), não há nada para
   migrar, não desloca os índices das substituições e os alunos (que não escrevem o plano) veem sempre a dose certa.
   Dose: 0,05 g por kg de peso corporal por dia, arredondada ao grama e limitada a 3–5 g. Base: a posição da ISSN (Kreider 2017) indica
   3–5 g/dia como manutenção (≈ 0,03 g/kg, que para 60–80 kg daria só 1,8–2,4 g, abaixo dos 3 g que saturam o músculo em ~4 semanas, Hultman 1996);
   Antonio 2021 refere 3–5 g/dia ou ≈ 0,1 g/kg. 0,05 g/kg com o intervalo 3–5 g é um compromisso prático dentro dessas posições, e não
   uma norma publicada. Sem fase de carga. O horário é indiferente: o que importa é tomá-la todos os dias (também nos dias sem treino).
   Pessoas com excesso de peso usam o peso a IMC 25 (como nos g/kg de proteína). */
var CREATINE_NAME = "Creatina mono-hidratada";
var CREATINE_NOTE = "Pode ser tomada em qualquer altura do dia.";
var CREATINE_G_PER_KG = 0.05;
var CREATINE_MIN_G = 3, CREATINE_MAX_G = 5;
// condições em que o profissional tem de confirmar antes de a creatina aparecer ao aluno (rins, gravidez e amamentação) — texto livre da ficha
var CREATINE_RENAL_RE = /(\b(rim|rins|renal|renais|irc|drc)(?![a-z])|nefr|dialis|transplant|creatinina)/;   // rins (texto já sem acentos)
var CREATINE_PREG_RE = /(gravid(?!ade)|gestante|gestac|amament|lactac|lactante|aleitament|puerper|pos-?parto)/;   // gravidez e amamentação
var CREATINE_CAUTION_FIELDS = ["medicalConditions", "currentMedication", "physicalLimitations", "medicalNotes"];   // os campos de texto livre da ficha médica
function creatineWeightKg(s){
  var w = Number(s && s.weightCurrent) || Number(s && s.weight) || 0;
  if (!(w > 0) && s && s.weights && s.weights.length) w = Number(s.weights[s.weights.length - 1].w) || 0;
  return w > 0 ? w : 0;
}
function creatineDoseG(s){
  var w = creatineWeightKg(s);
  if (!w) return null;
  var ref = referenceWeightKg(w, s.height, null);
  return Math.min(CREATINE_MAX_G, Math.max(CREATINE_MIN_G, Math.round(ref * CREATINE_G_PER_KG)));
}
// os motivos (chaves estáveis) por que a creatina pede a confirmação do profissional
function creatineCautionKeys(s){
  var out = [], age = ageAtDate(s, localTodayISO());
  if (age != null && age < 18) out.push("menor");
  var text = exLibFold(CREATINE_CAUTION_FIELDS.map(function(f){ return s && s[f]; }).filter(Boolean).join(" ; "));
  if (text && CREATINE_RENAL_RE.test(text)) out.push("renal");
  if (text && CREATINE_PREG_RE.test(text)) out.push("gravidez");
  return out;
}
var CREATINE_CAUTION_TEXT = {menor: "tem menos de 18 anos", renal: "a ficha refere problemas renais", gravidez: "a ficha refere gravidez ou amamentação"};
function creatineCautions(s){ return creatineCautionKeys(s).map(function(k){ return CREATINE_CAUTION_TEXT[k]; }); }
function creatineBlocked(s){
  return !!s && (s.blockedFoods || []).some(function(n){ return exLibFold(n) === exLibFold(CREATINE_NAME); });
}
// a confirmação vale para os motivos que o profissional viu (guardados como lista); se aparece um motivo novo (gravidez, por exemplo), volta a pedir
function creatineConfirmed(s){
  var c = s && s.nutritionPhase && s.nutritionPhase.creatineConfirmed;
  if (c === true) return true;   // valor antigo: sem lista de motivos
  if (!Array.isArray(c)) return false;
  return creatineCautionKeys(s).every(function(k){ return c.indexOf(k) >= 0; });
}
// o plano já traz creatina escrita à mão (um alimento): a linha automática ficaria duplicada
function planHasCreatineFood(s){
  return (s && s.meals || []).some(function(m){ return (m.foods || []).some(function(f){ return /creatin(?!in)/i.test(String(f.name || "")); }); });
}
// {on: aparece ao aluno, dose, cautions, state: 'on' | 'off' | 'sem-peso' | 'confirmar' | 'no-plano'}
function creatineStatus(s){
  var dose = creatineDoseG(s), cautions = creatineCautions(s);
  if (creatineBlocked(s)) return {on: false, dose: dose, cautions: cautions, state: "off"};
  if (planHasCreatineFood(s)) return {on: false, dose: dose, cautions: cautions, state: "no-plano"};
  if (dose == null) return {on: false, dose: null, cautions: cautions, state: "sem-peso"};
  if (cautions.length && !creatineConfirmed(s)) return {on: false, dose: dose, cautions: cautions, state: "confirmar"};
  return {on: true, dose: dose, cautions: cautions, state: "on"};
}
// a refeição onde a creatina aparece: o pequeno-almoço, ou a primeira (por hora) com alimentos; -1 se o plano ainda não tem alimentos
function breakfastMealIndex(meals){
  var cands = [];
  (meals || []).forEach(function(m, i){ if (m && m.foods && m.foods.length) cands.push({m: m, i: i}); });
  if (!cands.length) return -1;
  var named = cands.filter(function(x){ return /pequeno[\s-]*almo[cç]o/i.test(String(x.m.name || "")); })[0];
  if (named) return named.i;
  cands.sort(function(a, b){ return (toMinutes(String(a.m.time || "99:99")) - toMinutes(String(b.m.time || "99:99"))) || (a.i - b.i); });
  return cands[0].i;
}
function creatineLineHtml(s){
  var st = creatineStatus(s);
  if (!st.on) return "";
  return "<div class=\"food-item plano-supp\"><span class=\"fname\">" + escapeHtml(CREATINE_NAME) + "</span><span><span class=\"fqty\">" + st.dose + " g</span></span></div>" +
    "<p class=\"muted-p plano-supp-note\">" + escapeHtml(CREATINE_NOTE) + "</p>";
}
function setCreatineEnabled(s, on){
  ensureSyncBaseline(s);
  var before = creatineBlocked(s);
  s.blockedFoods = (s.blockedFoods || []).filter(function(n){ return exLibFold(n) !== exLibFold(CREATINE_NAME); });
  if (!on) s.blockedFoods.push(CREATINE_NAME);
  // se ainda falta a confirmação (menor, rins, gravidez), desbloquear não faz a creatina aparecer: não se regista como incluída
  var live = !on || creatineStatus(s).state === "on";
  logPlanEvent(s, "creatina", on ? (live ? "Creatina mono-hidratada incluída no plano" : "Creatina mono-hidratada desbloqueada, a aguardar a confirmação do profissional") : "Creatina mono-hidratada retirada do plano", before ? "desligada" : "ligada", on ? (live ? "ligada" : "por confirmar") : "desligada");
  if (live) startCreatineClock(s, on);
  persistStudent(s);
}
// a creatina retém 0,5–1,5 kg de água nas primeiras semanas: marca-se quando começa ou pára, para a fase de peso não confundir isso com gordura
function startCreatineClock(s, on){
  if (!s.nutritionPhase && !phaseColumnAvailable) return;
  s.nutritionPhase = Object.assign({}, s.nutritionPhase || {}, {creatineStartDate: localTodayISO(), creatineOn: !!on});
}
function confirmCreatine(s){
  if (!phaseColumnAvailable) return {error: PHASE_MIGRATION_MSG};
  ensureSyncBaseline(s);
  var keys = creatineCautionKeys(s);
  s.nutritionPhase = Object.assign({}, s.nutritionPhase || {}, {creatineConfirmed: keys, creatineStartDate: localTodayISO(), creatineOn: true});
  logPlanEvent(s, "creatina", "Creatina mono-hidratada confirmada pelo profissional apesar de: " + keys.map(function(k){ return CREATINE_CAUTION_TEXT[k]; }).join("; "), "por confirmar", "confirmada");
  persistStudent(s);
  return {};
}
function tplCreatineCard(s){
  var st = creatineStatus(s), w = creatineWeightKg(s), ref = w ? referenceWeightKg(w, s.height, null) : 0;
  var takes = (s.supplements || []).some(function(x){ return exLibFold(x) === "creatina"; });
  var html = "<div class=\"eyebrow section-gap\" style=\"margin-bottom:6px;\">Suplementação</div><div class=\"card\" id=\"creatineCard\" style=\"padding:12px 14px;\">";
  if (st.state === "sem-peso") html += "<p class=\"muted-p\"><strong>" + escapeHtml(CREATINE_NAME) + "</strong> — a dose calcula-se pelo peso corporal, que ainda não está registado.</p>";
  else if (st.state === "off") html += "<p class=\"muted-p\"><strong>" + escapeHtml(CREATINE_NAME) + "</strong> está retirada do plano deste aluno" + (st.dose ? " (a dose seria " + st.dose + " g por dia)" : "") + ".</p>" +
    "<button type=\"button\" class=\"btn btn-sm\" id=\"creatineToggle\" data-on=\"1\">Incluir no plano</button>";
  else if (st.state === "no-plano") html += "<p class=\"muted-p\"><strong>" + escapeHtml(CREATINE_NAME) + "</strong>: o plano já tem creatina escrita à mão, por isso a linha automática fica escondida. Retira esse alimento para a dose passar a acompanhar o peso.</p>";
  else if (st.state === "confirmar") html += "<p class=\"muted-p\"><strong>" + escapeHtml(CREATINE_NAME) + "</strong> não aparece ao aluno: " + escapeHtml(st.cautions.join("; ")) + ". Inclui-a só com indicação do médico.</p>" +
    "<button type=\"button\" class=\"btn btn-sm\" id=\"creatineConfirm\">Tenho indicação médica — incluir " + st.dose + " g</button>";
  else html += "<p class=\"muted-p\"><strong>" + escapeHtml(CREATINE_NAME) + " · " + st.dose + " g por dia</strong>, sempre no pequeno-almoço (≈ " + String(CREATINE_G_PER_KG).replace(".", ",") + " g × " + String(Math.round(ref * 10) / 10).replace(".", ",") + " kg de peso" + (ref < w ? " de referência" : "") + ", entre " + CREATINE_MIN_G + " e " + CREATINE_MAX_G + " g). " + escapeHtml(CREATINE_NOTE) + " A dose ajusta-se sozinha ao peso do aluno.</p>" +
    "<button type=\"button\" class=\"btn btn-sm\" id=\"creatineToggle\" data-on=\"0\">Retirar do plano</button>";
  if (takes) html += "<p class=\"muted-p\" style=\"font-size:0.78rem; margin-top:6px;\">O aluno disse que já toma creatina: confirma que não duplica a dose.</p>";
  html += "<p class=\"muted-p\" style=\"font-size:0.76rem; margin-top:6px;\">Nas primeiras semanas retém 0,5 a 1,5 kg de água: não é gordura." + (s.nutritionPhase && s.nutritionPhase.creatineStartDate ? " A revisão de peso ignora esse período." : "") + "</p></div>";
  return html;
}

/* ---------- Fases de peso (cut / bulk / manutenção) com calorias graduais e revisão periódica ----------
   O peso objetivo define a fase: abaixo do atual = cut, acima = bulk, igual = manutenção. As calorias NUNCA saltam de uma vez para o défice
   ou excedente total: começam com um passo pequeno (cut: −10 % da manutenção, entre 150 e 300 kcal; bulk: +5 %, entre 100 e 250 kcal) e só
   mudam quando a tendência REAL do peso o pede, em passos de 100–200 kcal, de 2 em 2 semanas (ou 3 ou 4, à escolha do profissional).
   Cada mudança é uma proposta que o profissional aprova com um só toque (OK): só então os alvos e as quantidades do plano se ajustam.
   Base (literatura): ritmo de perda de 0,5–1 % do peso por semana (Helms 2014); 0,7 %/sem preserva mais massa magra e força do que 1,4 %/sem
   (Garthe 2011); ganho de 0,25–0,5 %/sem em quem treina há menos de ~3 anos, mais lento e com menos excedente em avançados (Iraki 2019);
   a regra de 7700 kcal/kg sobrestima a perda a prazo porque a manutenção desce ~22 kcal/dia por kg perdido (Hall 2011), por isso o plano guarda-se
   como % da manutenção atual e a duração é só uma estimativa; ajustes graduais evitam a adaptação metabólica abrupta (Trexler 2014); disponibilidade
   energética nunca abaixo de ~30 kcal/kg de massa magra (Thomas 2016, Loucks 2011). Os escalões, os passos de 5 %, os tetos de défice (20/25/30 %),
   a banda de decisão e o limiar de dados são decisões de desenho a partir da prática dos treinadores e do ruído da pesagem (≈ 0,7 kg/dia),
   NÃO saem de um estudo único: estão aqui, com nome, para o profissional os poder ajustar. A decisão é sempre do profissional. */
var PHASE_CFG = {
  gapKg: 0.5,                                  // diferença mínima ao peso objetivo para haver cut ou bulk (o mesmo limiar de computeSuggestedTargets)
  cut: {A: {rate: 0.50, lo: 0.25, hi: 0.75, cap: 20}, B: {rate: 0.75, lo: 0.50, hi: 1.00, cap: 25}, C: {rate: 1.00, lo: 0.50, hi: 1.25, cap: 30}},   // % do peso/semana e teto de défice (% da manutenção)
  bulk: {novato: {rate: 0.375, lo: 0.25, hi: 0.50, cap: 15, review: 14}, avancado: {rate: 0.175, lo: 0.10, hi: 0.25, cap: 10, review: 28}},
  alertLoss: 1.5, alertGain: 0.75,             // acima disto o aviso é imediato (% do peso/semana)
  startCutPct: 10, startCutMin: 150, startCutMax: 300, startBulkPct: 5, startBulkMin: 100, startBulkMax: 250,
  stepPct: 5, stepMin: 100, stepMax: 200, safetyStep: 300, maxCum4wk: 400,
  reviewDays: 21, excludeAfterChange: 7, windowMax: 28, minWeighins: 4, minWeeks: 2, minSpan: 14, fullSpan: 21, shortSpanAct: 0.25, outlierKg: 2,
  minAdherence: 6, hungerStop: 7, energyStop: 4, goalTol: 0.3, creatineGraceDays: 14,
  maintDrift: 0.25, maintStep: 100, eaHard: 30
};
function round25(n){ return Math.round(n / 25) * 25; }
function clampN(v, lo, hi){ return Math.min(hi, Math.max(lo, v)); }
function pt2(n){ return String(Math.round(n * 100) / 100).replace(".", ","); }
function phaseLabel(p){ return p === "cut" ? "Cut" : p === "bulk" ? "Bulk" : "Manutenção"; }
function phaseOf(s){
  var np = s && s.nutritionPhase;
  return np && (np.phase === "cut" || np.phase === "bulk" || np.phase === "manutencao") && isIsoDate(np.startDate) ? np : null;
}
function phaseTypeFor(current, goal){
  if (!(current > 0) || !(goal > 0) || Math.abs(goal - current) < PHASE_CFG.gapKg) return "manutencao";
  return goal < current ? "cut" : "bulk";
}
function latestBodyFat(s){
  var list = (s && s.assessments || []).slice().sort(function(x, y){ return compareAssessmentsDesc(x, y); });
  for (var i = 0; i < list.length; i++) if (list[i].bodyFat > 0 && list[i].bodyFat < 70) return list[i].bodyFat;
  return null;
}
// escalão do corte: mais magro = mais devagar (A), IMC 25–30 (B), IMC ≥ 30 (C)
function cutTierFor(s, weight){
  var bmi = s.height > 0 && weight > 0 ? weight / Math.pow(s.height / 100, 2) : null, bf = latestBodyFat(s);
  if (bf != null && bf < (s.sex === "Feminino" ? 24 : 15)) return "A";
  if (bmi == null) return "B";
  return bmi >= 30 ? "C" : bmi >= 25 ? "B" : "A";
}
// intervalo entre revisões: a 1.ª semana depois de uma alteração não conta e a tendência pede 14 dias de pesagens, por isso nunca menos de 3 semanas
function phaseEveryDays(n){ return Math.max(PHASE_CFG.excludeAfterChange + PHASE_CFG.minSpan, n > 0 ? Number(n) : PHASE_CFG.reviewDays); }
function phaseStepKcal(maint){ return clampN(round25(maint * PHASE_CFG.stepPct / 100), PHASE_CFG.stepMin, PHASE_CFG.stepMax); }
// calorias do ponto de partida de cada fase (o primeiro passo, pequeno)
function phaseStartKcal(type, maint){
  if (type === "cut") return maint - clampN(round25(maint * PHASE_CFG.startCutPct / 100), PHASE_CFG.startCutMin, PHASE_CFG.startCutMax);
  if (type === "bulk") return maint + clampN(round25(maint * PHASE_CFG.startBulkPct / 100), PHASE_CFG.startBulkMin, PHASE_CFG.startBulkMax);
  return maint;
}
function dayNum(iso){ return Math.round(Date.parse(iso + "T00:00:00Z") / 86400000); }
// Pesagens do aluno para revisões e indicadores. A fonte é weights (as avaliações do profissional e as importações escrevem lá, e os
// check-ins antigos também escreveram na altura): checkins[].weight não se lê à parte, senão a mesma pesagem contava duas vezes.
// O peso de uma avaliação só entra se faltar em weights (dado antigo): nunca se há já pesagem nesse dia, nem quando repete o último peso
// conhecido (uma avaliação só de composição guarda o peso atual, não é uma pesagem nova).
function weighInsOf(s){
  var list = sortWeightsStable((s && s.weights || []).filter(function(w){ return w && isIsoDate(w.date) && Number(w.w) > 0; }).map(function(w){ return {date: w.date, w: Number(w.w)}; }));
  var extra = (s && s.assessments || []).filter(function(a){ return a && isIsoDate(a.date) && Number(a.weight) > 0; })
    .sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.time || "") < String(b.time || "") ? -1 : 1; });
  extra.forEach(function(a){
    var wt = Number(a.weight);
    if (list.some(function(x){ return x.date === a.date; })) return;
    var prev = null; list.forEach(function(x){ if (x.date <= a.date) prev = x; });
    if (prev && prev.w.toFixed(1) === wt.toFixed(1)) return;
    list.push({date: a.date, w: wt}); list = sortWeightsStable(list);
  });
  return list;
}
// Evolução do peso pelas datas reais das pesagens (uma por dia: a última do dia). Não pressupõe uma pesagem por semana nem conclui nada:
// só descreve. consolidated = pontos suficientes para falar de tendência (3 ou mais, a 14 dias ou mais do primeiro).
function weightProgress(s, today){
  today = today || localTodayISO();
  var byDay = {};
  weighInsOf(s).forEach(function(w){ if (w.date <= today) byDay[w.date] = w; });
  var pts = Object.keys(byDay).sort().map(function(d){ return byDay[d]; });
  var out = {n: pts.length, first: pts[0] || null, last: pts[pts.length - 1] || null, spanDays: 0, deltaKg: null, deltaPct: null, kgPerWeek: null, daysSinceLast: null, consolidated: false};
  if (!out.n) return out;
  out.daysSinceLast = Math.max(0, dayNum(today) - dayNum(out.last.date));
  if (out.n < 2) return out;
  out.spanDays = dayNum(out.last.date) - dayNum(out.first.date);
  out.deltaKg = Math.round((out.last.w - out.first.w) * 10) / 10;
  out.deltaPct = out.first.w > 0 ? Math.round((out.last.w - out.first.w) / out.first.w * 1000) / 10 : null;
  if (out.spanDays >= 14) out.kgPerWeek = Math.round((out.last.w - out.first.w) / out.spanDays * 7 * 100) / 100;
  out.consolidated = out.n >= 3 && out.spanDays >= 14;
  return out;
}
var WEIGHT_MISSING_TEXT = "Dados de peso insuficientes — regista o peso na próxima avaliação.";
function signedKg(n){ return (n > 0 ? "+" : n < 0 ? "−" : "") + pt2(Math.abs(n)); }
function weightProgressText(p){
  if (!p || !p.n) return WEIGHT_MISSING_TEXT;
  if (p.n === 1) return "Só há uma pesagem (" + pt2(p.last.w) + " kg a " + fmtDateFullPt(p.last.date) + "): ainda não há evolução nem tendência. Regista o peso na próxima avaliação.";
  var txt = "Peso: " + pt2(p.first.w) + " → " + pt2(p.last.w) + " kg (" + signedKg(p.deltaKg) + " kg" + (p.deltaPct != null ? ", " + signedKg(p.deltaPct) + " %" : "") + ") entre " + fmtDateFullPt(p.first.date) + " e " + fmtDateFullPt(p.last.date) + " (" + p.spanDays + " dias, " + p.n + " pesagens)";
  if (p.kgPerWeek != null) txt += ", ≈ " + signedKg(p.kgPerWeek) + " kg/semana";
  return txt + "." + (p.consolidated ? "" : " Ainda não é uma tendência consolidada.");
}
// tendência do peso: regressão linear (por data) sobre as pesagens da janela; ignora pesagens a mais de 2 kg da mediana e junta as do mesmo dia
function phaseWeightFit(weights, fromISO, toISO){
  var byDay = {};
  sortWeightsStable(weights || []).forEach(function(w){
    if (!w || !isIsoDate(w.date) || !(Number(w.w) > 0) || w.date < fromISO || w.date > toISO) return;
    (byDay[w.date] = byDay[w.date] || []).push(Number(w.w));
  });
  var pts = Object.keys(byDay).sort().map(function(d){ var a = byDay[d]; return {date: d, x: dayNum(d), w: a.reduce(function(p, c){ return p + c; }, 0) / a.length}; });
  if (pts.length >= 5){
    var sorted = pts.map(function(p){ return p.w; }).sort(function(a, b){ return a - b; }), mid = sorted.length >> 1;
    var med = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    pts = pts.filter(function(p){ return Math.abs(p.w - med) <= PHASE_CFG.outlierKg; });
  }
  var n = pts.length;
  if (n < 2) return {n: n, ok: false, relaxed: false, spanDays: 0, weeks: n ? 1 : 0, slopeKgWk: 0, meanW: n ? pts[0].w : 0, trendNow: n ? pts[0].w : 0};
  var x0 = pts[0].x, span = pts[n - 1].x - x0, weeks = {};
  pts.forEach(function(p){ weeks[Math.floor((p.x - x0) / 7)] = true; });
  var mx = pts.reduce(function(a, p){ return a + (p.x - x0); }, 0) / n, my = pts.reduce(function(a, p){ return a + p.w; }, 0) / n, sxx = 0, sxy = 0;
  pts.forEach(function(p){ sxx += (p.x - x0 - mx) * (p.x - x0 - mx); sxy += (p.x - x0 - mx) * (p.w - my); });
  var slope = sxx > 0 ? sxy / sxx : 0, nWeeks = Object.keys(weeks).length;
  return {n: n, spanDays: span, weeks: nWeeks, slopeKgWk: slope * 7, meanW: my, trendNow: my + slope * (span - mx),
    ok: n >= PHASE_CFG.minWeighins && nWeeks >= PHASE_CFG.minWeeks && span >= PHASE_CFG.minSpan, relaxed: n >= 3 && span >= 7};
}
// sem pesagens suficientes para a revisão automática: diz o que há (as avaliações do profissional) e não tira conclusões
function phaseDataGapText(progress, what){
  if (!progress || !progress.n) return WEIGHT_MISSING_TEXT;
  return weightProgressText(progress) + " Para " + what + " faltam pesagens: a revisão automática precisa de " + PHASE_CFG.minWeighins + " em " + PHASE_CFG.minWeeks + " semanas (últimos " + PHASE_CFG.windowMax + " dias). Sem elas não se conclui nada sobre estagnação nem ritmo — regista o peso na próxima avaliação.";
}
function phaseEvidenceText(fit, ratePct){
  var kg = (fit.slopeKgWk >= 0 ? "+" : "−") + pt2(Math.abs(fit.slopeKgWk)) + " kg/semana";
  return "Peso: " + kg + " (" + (ratePct >= 0 ? "+" : "−") + pt2(Math.abs(ratePct)) + " %/semana) com " + fit.n + " pesagens em " + fit.spanDays + " dias.";
}
// a mesma divisão de macros do cálculo inicial: proteína por kg de peso de referência, gordura ≥ 27 % das calorias e ≥ 0,6 g/kg, hidratos o resto
function macrosForKcal(weight, height, leanMass, kcal){
  var ref = referenceWeightKg(weight, height, leanMass);
  var protein = Math.round(2.0 * ref);
  var fat = Math.max(Math.round((kcal * 0.27) / 9), Math.round(FAT_MIN_G_PER_KG * ref));
  var carbs = Math.round(Math.max(0, kcal - protein * 4 - fat * 9) / 4);
  return {kcal: kcal, protein: protein, carbs: carbs, fat: fat};
}
function phaseStartTargets(s, type){
  var maint = computeMaintenanceKcal(s);
  if (!maint) return null;
  var kcal = phaseStartKcal(type, maint), bmr = computeBMR(s);
  if (type === "cut" && bmr) kcal = Math.max(kcal, Math.ceil(kcalFloorFor(s.sex, bmr, maint)));
  return macrosForKcal(creatineWeightKg(s), s.height, null, kcal);
}
function phaseDeficitPct(kcal, maint){ return maint > 0 ? Math.round((kcal - maint) / maint * 1000) / 10 : null; }

// A revisão: devolve null se ainda não há nada a rever; senão {kind, ...}. kinds: ajuste, objetivo, aderencia, limite (pedem atenção) · em-linha, dados (não pedem)
function computePhaseReview(s, today, opts){
  today = today || localTodayISO(); opts = opts || {};
  var np = phaseOf(s);
  if (!np || !isStudentActive(s) || isStudioOnly(s)) return null;
  var t = s.targets || {}, kcal = Number(t.kcal) || 0;
  if (!(kcal > 0)) return null;
  var every = phaseEveryDays(np.reviewEveryDays), early = false;
  if (!opts.force){
    var due = np.nextReviewDate || addDaysISO(np.lastReviewDate || np.startDate, every);
    if (np.snoozeUntil && today < np.snoozeUntil) return null;
    early = today < due;   // antes da data só pode sair o aviso urgente (perda/ganho demasiado rápidos)
  }
  var from = [np.startDate, np.lastChangeDate ? addDaysISO(np.lastChangeDate, PHASE_CFG.excludeAfterChange) : null,
    np.creatineStartDate ? addDaysISO(np.creatineStartDate, PHASE_CFG.creatineGraceDays) : null, addDaysISO(today, -PHASE_CFG.windowMax)]
    .filter(Boolean).sort().pop();
  var fit = phaseWeightFit(weighInsOf(s), from, today), progress = weightProgress(s, today);
  // a manutenção calcula-se com o peso da tendência (uma pesagem mal escrita não a pode deslocar)
  var sm = Object.assign({}, s, {weightCurrent: fit.n >= 3 ? Math.round(fit.trendNow * 10) / 10 : s.weightCurrent});
  var maint = computeMaintenanceKcal(sm);
  if (!maint) return null;
  var out = {studentId: s.id, name: s.name, phase: np.phase, kind: "dados", today: today, maint: maint, currentTargets: {kcal: kcal, protein: t.protein, carbs: t.carbs != null ? t.carbs : t.carbsMax, fat: t.fat != null ? t.fat : t.fatMax},
    fit: fit, progress: progress, warnings: [], deltaKcal: 0, proposedTargets: null, text: "", evidence: ""};
  var weightNow = fit.n ? fit.trendNow : (Number(s.weightCurrent) || 0);
  var ratePct = fit.meanW > 0 ? fit.slopeKgWk / fit.meanW * 100 : 0;
  out.ratePct = ratePct; out.evidence = fit.n >= 2 ? phaseEvidenceText(fit, ratePct) : (progress.n >= 2 ? weightProgressText(progress) : "");
  var wCur = Number(s.weightCurrent) || 0;
  if (fit.n >= 3 && (Math.abs(ratePct) > 3 || (wCur > 0 && Math.abs(wCur - fit.trendNow) > Math.max(3, 0.08 * fit.trendNow)))){
    out.kind = "dados"; out.text = "Pesagem suspeita: o peso registado (" + pt2(wCur) + " kg) ou a tendência (" + pt2(ratePct) + " %/semana) não são plausíveis. Confirma o peso com o aluno antes de rever o plano.";
    return out;
  }
  var target = Number(np.targetWeight) > 0 ? Number(np.targetWeight) : (Number(s.weightGoal) > 0 ? Number(s.weightGoal) : null);
  var step = phaseStepKcal(maint);
  // no máximo 400 kcal acumuladas em 4 semanas
  var cum = (np.reviews || []).filter(function(r){ return r.date >= addDaysISO(today, -28) && r.deltaKcal; }).reduce(function(a, r){ return a + Math.abs(r.deltaKcal); }, 0);
  var room = Math.max(0, PHASE_CFG.maxCum4wk - cum);

  function propose(newKcal, kind, text, extra){
    newKcal = Math.round(newKcal);
    var delta = newKcal - kcal;
    var nt = {kcal: newKcal, protein: out.currentTargets.protein, fat: out.currentTargets.fat, carbs: Math.max(0, Math.round((out.currentTargets.carbs || 0) + delta / 4))};
    out.kind = kind; out.deltaKcal = delta; out.proposedTargets = nt; out.text = text;
    out.warnings = nutritionSafetyWarnings(sm, nt);
    if (out.warnings.some(function(w){ return w.level === "critical"; })){
      out.kind = "limite"; out.proposedTargets = null; out.deltaKcal = 0;
      out.text = "Este ajuste ficaria abaixo do mínimo de segurança. Em vez de cortar mais, considera uma pausa de 1 semana na manutenção (" + maint + " kcal) ou mais atividade diária.";
    }
    if (extra) Object.keys(extra).forEach(function(k){ out[k] = extra[k]; });
    return out;
  }
  function info(kind, text){ out.kind = kind; out.text = text; return out; }
  function recentAdherence(){ var l = (s.checkins || []).slice(-4); return l.length ? l.reduce(function(a, c){ return a + (Number(c.adherence) || 0); }, 0) / l.length : null; }
  function hungerEnergyStop(){
    var l = (s.checkins || []).slice(-4); if (!l.length) return false;
    var h = l.reduce(function(a, c){ return a + (Number(c.hunger) || 0); }, 0) / l.length, e = l.reduce(function(a, c){ return a + (Number(c.energy) || 0); }, 0) / l.length;
    return h >= PHASE_CFG.hungerStop || e <= PHASE_CFG.energyStop;
  }
  var kgStr = function(n){ return pt2(Math.abs(n)); };
  var deficitPct = (maint - kcal) / maint * 100;  // > 0 em défice

  // --- objetivo atingido ---
  var wrongSide = np.startWeight > 0 && target && ((np.phase === "cut" && np.startWeight <= target + PHASE_CFG.gapKg) || (np.phase === "bulk" && np.startWeight >= target - PHASE_CFG.gapKg));
  if (target && !early && !wrongSide && fit.n >= PHASE_CFG.minWeighins){
    var reached = np.phase === "cut" ? weightNow <= target + PHASE_CFG.goalTol : np.phase === "bulk" ? weightNow >= target - PHASE_CFG.goalTol : false;
    if (reached){
      var firstStep = np.phase === "cut" && deficitPct > 3 ? round25(kcal + (maint - kcal) * 0.5) : maint;
      return propose(firstStep, "objetivo",
        s.name + " chegou ao peso objetivo (" + pt2(target) + " kg). Sugestão: passar à manutenção" + (firstStep !== maint ? " em 2 passos (esta semana " + firstStep + " kcal e depois " + maint + " kcal)." : " (" + maint + " kcal)."), {exiting: firstStep !== maint});
    }
  }
  // --- manutenção ---
  if (np.phase === "manutencao"){
    if (early) return null;
    if (np.exiting && Math.abs(maint - kcal) >= 50) return propose(maint, "ajuste", "Completar a passagem à manutenção: " + kcal + " → " + maint + " kcal (já com o peso atual).", {completesExit: true});
    if (!fit.ok) return info("dados", phaseDataGapText(progress, "rever a manutenção"));
    if (Math.abs(ratePct) >= PHASE_CFG.maintDrift && fit.spanDays >= PHASE_CFG.fullSpan){
      var dir = ratePct > 0 ? -1 : 1, mk = kcal + dir * PHASE_CFG.maintStep;
      if (dir < 0){   // retirar calorias nunca passa o piso de segurança
        var bmrM = computeBMR(sm), flM = bmrM ? Math.ceil(kcalFloorFor(s.sex, bmrM, maint)) : 0;
        mk = Math.max(mk, flM);
        if (mk >= kcal) return info("limite", "O peso está a subir na manutenção, mas as calorias já estão no mínimo de segurança (" + flM + " kcal). Em vez de cortar mais, revê a atividade diária ou a estimativa da manutenção.");
      }
      return propose(mk, "ajuste", "O peso está a " + (ratePct > 0 ? "subir" : "descer") + " " + pt2(Math.abs(ratePct)) + " %/semana na manutenção. Sugestão: " + (dir > 0 ? "acrescentar " : "retirar ") + Math.abs(mk - kcal) + " kcal/dia.");
    }
    return info("em-linha", "A manutenção está estável (" + pt2(ratePct) + " %/semana). Não é preciso alterar o plano.");
  }
  // --- cut e bulk ---
  var cfg = np.phase === "cut" ? PHASE_CFG.cut[cutTierFor(s, fit.meanW || weightNow)] : PHASE_CFG.bulk[np.level === "avancado" ? "avancado" : "novato"];
  var move = np.phase === "cut" ? -ratePct : ratePct;           // % do peso por semana na direção pretendida (negativo = vai ao contrário)
  var alert = np.phase === "cut" ? PHASE_CFG.alertLoss : PHASE_CFG.alertGain;
  out.band = [cfg.lo, cfg.hi]; out.targetRate = cfg.rate;
  // rápido de mais é sempre prioritário (e não espera pelos 14 dias de dados)
  if (fit.relaxed && move > alert){
    var back = np.phase === "cut" ? Math.min(kcal + PHASE_CFG.safetyStep, maint) : Math.max(kcal - step, maint);
    var wrongWay = np.phase === "cut" ? back <= kcal : back >= kcal;   // calorias do lado errado da manutenção: nada a subir (cut) nem a descer (bulk)
    if (wrongWay) return info("limite", (np.phase === "cut" ? "A perda está a ser de " : "O ganho está a ser de ") + pt2(move) + " %/semana, acima do limite, mas as calorias (" + kcal + " kcal) já estão " + (np.phase === "cut" ? "acima" : "abaixo") + " da manutenção estimada (" + maint + " kcal): não há " + (np.phase === "cut" ? "subida" : "descida") + " a propor. Confirma a adesão e se a manutenção está bem estimada.");
    return propose(back, "ajuste", (np.phase === "cut" ? "A perda está a ser de " : "O ganho está a ser de ") + pt2(move) + " %/semana, acima do limite de " + pt2(alert) + " %/semana. Sugestão: " + (np.phase === "cut" ? "aumentar " : "reduzir ") + Math.abs(back - kcal) + " kcal/dia (de " + kcal + " para " + back + ")" + (np.phase === "cut" ? " para proteger a massa magra." : " para limitar o ganho de gordura."), {urgent: true});
  }
  if (early) return null;
  if (!fit.ok){
    var cg = np.creatineStartDate && today < addDaysISO(np.creatineStartDate, PHASE_CFG.creatineGraceDays + PHASE_CFG.minSpan);
    return info("dados", cg ? "Há pouco que o aluno começou ou parou a creatina: a subida inicial de 0,5 a 1,5 kg é retenção de água, não gordura. A revisão espera por pesagens a partir de " + fmtDateFullPt(addDaysISO(np.creatineStartDate, PHASE_CFG.creatineGraceDays)) + "." :
      phaseDataGapText(progress, "propor um ajuste"));
  }
  var viol = move < cfg.lo ? cfg.lo - move : move > cfg.hi ? move - cfg.hi : 0;
  if (viol === 0) return info("em-linha", "A evolução está dentro do previsto (" + pt2(move) + " %/semana, banda " + pt2(cfg.lo) + "–" + pt2(cfg.hi) + "). Não é preciso alterar o plano.");
  if (fit.spanDays < PHASE_CFG.fullSpan && viol < PHASE_CFG.shortSpanAct) return info("em-linha", "Tendência ainda dentro da margem de erro (" + pt2(move) + " %/semana com " + fit.spanDays + " dias de pesagens). A decisão fica para a próxima revisão.");
  if (move > cfg.hi){
    var up = np.phase === "cut" ? Math.min(kcal + step, maint) : Math.max(kcal - step, maint);
    if (np.phase === "cut" ? up <= kcal : up >= kcal) return info("limite", "Acima da banda, mas as calorias (" + kcal + " kcal) já estão " + (kcal === maint ? "na" : np.phase === "cut" ? "acima da" : "abaixo da") + " manutenção estimada (" + maint + " kcal): não há o que ajustar. Confirma a adesão e se a manutenção está bem estimada.");
    return propose(up, "ajuste", (np.phase === "cut" ? "A perda está a ser de " : "O ganho está a ser de ") + pt2(move) + " %/semana, acima do previsto (" + pt2(cfg.rate) + " %/semana). Sugestão: " + (np.phase === "cut" ? "aumentar " : "reduzir ") + Math.abs(up - kcal) + " kcal/dia (de " + kcal + " para " + up + ").");
  }
  // abaixo da banda (estagnou ou vai ao contrário): primeiro a adesão, depois os limites, só então mais um passo
  var adh = recentAdherence();
  if (adh != null && adh < PHASE_CFG.minAdherence) return info("aderencia", "A adesão recente é baixa (" + pt2(adh) + "/10). Antes de mexer nas calorias, confirma se o plano está a ser cumprido: a estagnação por incumprimento não se corrige com mais " + (np.phase === "cut" ? "défice." : "excedente."));
  if (np.phase === "cut" && hungerEnergyStop()) return info("limite", "A fome está alta ou a energia baixa: não propor mais corte. Considera uma pausa de 1 semana na manutenção (" + maint + " kcal) para recuperar energia e adesão.");
  if (room < 50) return info("limite", "Já houve " + cum + " kcal de alterações nas últimas 4 semanas (máximo " + PHASE_CFG.maxCum4wk + "): esperar pela próxima revisão.");
  var stepNow = Math.min(step, room), nk;
  if (np.phase === "cut"){
    var capKcal = Math.ceil(maint * (1 - cfg.cap / 100) / 25) * 25, bmr0 = computeBMR(sm), floor = Math.ceil(kcalFloorFor(s.sex, bmr0 || 0, maint)), lean = latestLeanMass(s);
    var eaFloor = lean > 0 ? Math.ceil(PHASE_CFG.eaHard * lean) : 0, lowest = Math.max(capKcal, floor, eaFloor);
    if (kcal <= lowest) return info("limite", "Já estás no limite de segurança do défice (" + pt2(deficitPct) + " % da manutenção, mínimo " + lowest + " kcal). Em vez de cortar mais: pausa de 1 semana na manutenção, mais passos/atividade ou rever o peso objetivo.");
    nk = Math.max(kcal - stepNow, lowest);
    return propose(nk, "ajuste", "A perda está a ser de " + pt2(Math.max(0, move)) + " %/semana (" + (move < 0 ? "o peso está a subir, " : move === 0 ? "estagnada, " : "") + "abaixo do previsto de " + pt2(cfg.rate) + " %/semana). Sugestão: reduzir " + (kcal - nk) + " kcal/dia (de " + kcal + " para " + nk + "; os hidratos descem " + Math.round((kcal - nk) / 4) + " g).");
  }
  var capUp = Math.floor(maint * (1 + cfg.cap / 100) / 25) * 25;
  if (kcal >= capUp) return info("limite", "Já estás no teto do excedente (+" + pt2((kcal - maint) / maint * 100) + " % da manutenção). Antes de subir mais, confirma a adesão, a proteína, o treino e o sono; se persistir, revê o objetivo.");
  nk = Math.min(kcal + stepNow, capUp);
  return propose(nk, "ajuste", "O ganho de peso é de " + pt2(Math.max(0, move)) + " %/semana (" + (move < 0 ? "o peso está a descer, " : move === 0 ? "estagnado, " : "") + "abaixo do previsto de " + pt2(cfg.rate) + " %/semana). Sugestão: acrescentar " + (nk - kcal) + " kcal/dia (de " + kcal + " para " + nk + "; os hidratos sobem " + Math.round((nk - kcal) / 4) + " g).");
}
function phaseNeedsAttention(rv){ return !!rv && (rv.kind === "ajuste" || rv.kind === "objetivo" || rv.kind === "aderencia" || rv.kind === "limite"); }
function collectPhaseReviews(today){
  var out = [];
  (STUDENTS || []).forEach(function(st){
    if (st.isDemo && !state.showDemoStudents) return;
    if (noNutritionOf(st)) return;   // a nutrição é de outra pessoa: sem revisões de plano
    var rv; try { rv = computePhaseReview(st, today); } catch (e) { rv = null; }
    if (phaseNeedsAttention(rv)) out.push({student: st, review: rv});
  });
  return out;
}
// aplicar uma proposta (só o profissional): alvos, quantidades do plano, fase e histórico, tudo de uma vez
var PHASE_MIGRATION_MSG = "Para guardar a fase, as revisões e a confirmação da creatina falta correr a migração 0029 no SQL Editor do Supabase (ficheiro supabase/migrations/0029_nutrition_phase.sql) e recarregar a app.";
// a creatina nova retém água: marca o início (só se o aluno ainda não a tomava e a linha vai aparecer), para a revisão de peso ignorar as primeiras semanas
function phaseStampCreatine(s, np, today){
  var takes = (s.supplements || []).some(function(x){ return exLibFold(x) === "creatina"; });
  if (!np.creatineStartDate && !takes && creatineStatus(s).on){ np.creatineStartDate = today; np.creatineOn = true; }
}
// uma alteração manual dos alvos a meio da fase recomeça a janela de pesagens e conta para as 400 kcal em 4 semanas
function notePhaseManualChange(s, oldKcal, newKcal){
  var np = phaseOf(s);
  if (!np || !(oldKcal > 0) || Math.abs(newKcal - oldKcal) < 50) return;
  var today = localTodayISO();
  s.nutritionPhase = Object.assign({}, np, {lastChangeDate: today, reviews: (np.reviews || []).concat([{date: today, kind: "manual", deltaKcal: newKcal - oldKcal, rate: 0, n: 0}]).slice(-24)});
}
// guardar o peso objetivo com uma fase já em curso: só muda o objetivo (calorias, etapas e histórico ficam); devolve true se tratou do assunto
function keepRunningPhase(s, newGoal){
  if (Number(newGoal || 0) === Number(s.weightGoal || 0)){ showToast("O peso objetivo não mudou."); return true; }
  var np = phaseOf(s);
  if (!np) return false;
  ensureSyncBaseline(s);
  s.weightGoal = newGoal;
  s.nutritionPhase = Object.assign({}, np, {targetWeight: newGoal || null});
  persistStudent(s);
  showToast("Peso objetivo guardado. A fase e as calorias não mudam: para mudar de fase usa «Alterar fase» na Nutrição.");
  return true;
}
function applyPhaseReview(s, rv){
  if (authRole === "student") return {error: "Só o profissional pode aplicar uma revisão."};
  if (!rv || !rv.proposedTargets) return {error: "Esta revisão não tem alterações para aplicar."};
  if (!phaseColumnAvailable) return {error: PHASE_MIGRATION_MSG};
  ensureSyncBaseline(s);
  var today = localTodayISO(), np = Object.assign({}, s.nutritionPhase), old = s.targets, nt = rv.proposedTargets;
  logTargetsChange(s, old, nt);
  s.targets = {kcal: nt.kcal, protein: nt.protein, carbs: nt.carbs, fat: nt.fat};
  s.fromOnboarding = false;
  var res = (s.meals || []).length ? autoAdjustPlanQuantities(s) : null;
  logPlanEvent(s, "fase_revisao", "Revisão " + phaseLabel(np.phase) + ": " + old.kcal + " → " + nt.kcal + " kcal (" + (rv.deltaKcal > 0 ? "+" : "") + rv.deltaKcal + ")" + (res ? "; " + res.changed + " alimentos ajustados" : ""), old.kcal, nt.kcal);
  var every = phaseEveryDays(np.reviewEveryDays);
  np.stage = (np.stage || 0) + 1; np.lastChangeDate = today; np.lastReviewDate = today; np.snoozeUntil = null;
  np.nextReviewDate = addDaysISO(today, rv.kind === "objetivo" || rv.exiting || rv.completesExit ? 7 : every);
  np.deficitPct = phaseDeficitPct(nt.kcal, rv.maint);
  if (rv.kind === "objetivo"){ np.phase = "manutencao"; np.exiting = !!rv.exiting; } else if (rv.completesExit) np.exiting = false;
  np.reviews = (np.reviews || []).concat([{date: today, kind: rv.kind, deltaKcal: rv.deltaKcal, rate: Math.round((rv.ratePct || 0) * 100) / 100, n: rv.fit ? rv.fit.n : 0}]).slice(-24);
  s.nutritionPhase = np;
  persistStudent(s);
  return {changed: res ? res.changed : 0, from: old.kcal, to: nt.kcal};
}
function postponePhaseReview(s, days){
  if (!phaseColumnAvailable) return {error: PHASE_MIGRATION_MSG};
  ensureSyncBaseline(s);
  s.nutritionPhase = Object.assign({}, s.nutritionPhase, {snoozeUntil: addDaysISO(localTodayISO(), days || 7)});
  persistStudent(s);
  return {};
}
// iniciar (ou mudar) a fase; com applyStart usa os alvos de partida da fase, senão ancora-se nos alvos atuais
function startPhase(s, o){
  if (authRole === "student") return {error: "Só o profissional pode iniciar uma fase."};
  if (!phaseColumnAvailable) return {error: PHASE_MIGRATION_MSG};
  var type = o.type === "cut" || o.type === "bulk" ? o.type : "manutencao", today = localTodayISO(), curKg = creatineWeightKg(s);
  // o objetivo tem de ficar do lado certo do peso atual (um cut com objetivo acima do peso apagaria o défice sem avisar)
  if (curKg > 0 && o.targetWeight > 0 && ((type === "cut" && !(o.targetWeight < curKg - PHASE_CFG.gapKg)) || (type === "bulk" && !(o.targetWeight > curKg + PHASE_CFG.gapKg))))
    return {error: "O peso objetivo (" + pt2(o.targetWeight) + " kg) tem de ficar " + (type === "cut" ? "abaixo" : "acima") + " do peso atual (" + pt2(curKg) + " kg) para um " + phaseLabel(type) + "."};
  ensureSyncBaseline(s);
  if (!s.targets) s.targets = {kcal: 0, protein: 0, carbs: 0, fat: 0};
  if (o.targetWeight > 0) s.weightGoal = o.targetWeight;
  var old = s.nutritionPhase || {}, np = Object.assign({}, old, {phase: type, startDate: today, startWeight: creatineWeightKg(s) || null, targetWeight: o.targetWeight > 0 ? o.targetWeight : (s.weightGoal || null),
    level: o.level === "avancado" ? "avancado" : "novato", stage: 0, stageStartDate: today, lastChangeDate: today, lastReviewDate: null, snoozeUntil: null, exiting: false, reviews: []});
  var every = phaseEveryDays([21, 28].indexOf(Number(o.every)) >= 0 ? Number(o.every) : (type === "bulk" && np.level === "avancado" ? PHASE_CFG.bulk.avancado.review : PHASE_CFG.reviewDays));
  np.reviewEveryDays = every; np.nextReviewDate = addDaysISO(today, every);
  var res = null, maint = computeMaintenanceKcal(s);
  if (o.applyStart){
    var tg = phaseStartTargets(s, type);
    if (tg){
      logTargetsChange(s, s.targets, tg);
      s.targets = tg; s.fromOnboarding = false;
      if ((s.meals || []).length) res = autoAdjustPlanQuantities(s);
    }
  }
  np.deficitPct = phaseDeficitPct(s.targets.kcal, maint);
  phaseStampCreatine(s, np, today);
  s.nutritionPhase = np;
  logPlanEvent(s, "fase_inicio", "Fase " + phaseLabel(type) + " iniciada" + (np.targetWeight ? " (objetivo " + pt2(np.targetWeight) + " kg)" : "") + ": " + s.targets.kcal + " kcal" + (res ? "; " + res.changed + " alimentos ajustados" : ""), (old.phase || "—"), type);
  persistStudent(s);
  return {changed: res ? res.changed : 0};
}
// quando o aluno define o peso objetivo (questionário ou ficha), a fase fica definida logo, com as calorias do ponto de partida
function setPhaseFromGoal(s){
  var cur = Number(s.weightCurrent) || 0, goal = Number(s.weightGoal) || 0;
  if (!(cur > 0) || !(goal > 0)) return;
  var type = phaseTypeFor(cur, goal), today = localTodayISO(), maint = computeMaintenanceKcal(s);
  var np = Object.assign({}, s.nutritionPhase, {phase: type, startDate: today, startWeight: cur, targetWeight: goal, level: (s.nutritionPhase && s.nutritionPhase.level) || "novato", stage: 0, stageStartDate: today, lastChangeDate: today,
    lastReviewDate: null, snoozeUntil: null, exiting: false, reviews: [], reviewEveryDays: phaseEveryDays(s.nutritionPhase && s.nutritionPhase.reviewEveryDays)});
  np.nextReviewDate = addDaysISO(today, np.reviewEveryDays);
  phaseStampCreatine(s, np, today);
  np.deficitPct = s.targets && s.targets.kcal && maint ? phaseDeficitPct(s.targets.kcal, maint) : null;
  s.nutritionPhase = np;
}

// ---- ecrãs: cartão na Nutrição, janela de início, janela de revisão (um só OK) e aviso ao entrar ----
function tplPhasePanel(s){
  var np = phaseOf(s), cur = creatineWeightKg(s), maint = computeMaintenanceKcal(s);
  var html = "<div class=\"eyebrow section-gap\" style=\"margin-bottom:6px;\">Fase e objetivo de peso</div><div class=\"card\" id=\"phaseCard\" style=\"padding:12px 14px;\">";
  if (!np){
    var sug = phaseTypeFor(cur, Number(s.weightGoal) || 0);
    html += "<p class=\"muted-p\">Sem fase definida" + (s.weightGoal ? " (peso objetivo " + pt2(s.weightGoal) + " kg, o que dá " + phaseLabel(sug) + ")" : "") + ". A fase acompanha o peso de perto: as calorias mudam aos poucos, de " + PHASE_CFG.reviewDays + " em " + PHASE_CFG.reviewDays + " dias, e tu aprovas cada passo com um toque.</p>" +
      "<button type=\"button\" class=\"btn btn-sm primary\" id=\"phaseStart\">Definir fase</button></div>";
    return html;
  }
  var weeksIn = Math.max(0, Math.floor((dayNum(localTodayISO()) - dayNum(np.startDate)) / 7));
  html += "<div style=\"display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:6px;\"><span class=\"pill " + (np.phase === "cut" ? "warn" : np.phase === "bulk" ? "good" : "") + "\">" + phaseLabel(np.phase) + "</span><span class=\"muted-p\">desde " + escapeHtml(fmtDateFullPt(np.startDate)) + " · semana " + (weeksIn + 1) + "</span></div>" +
    "<p class=\"muted-p\">" + (np.startWeight ? "Peso inicial " + pt2(np.startWeight) + " kg" : "") + (np.targetWeight ? " → objetivo " + pt2(np.targetWeight) + " kg" : "") + (cur ? " · agora " + pt2(cur) + " kg" : "") + "</p>" +
    (maint && s.targets && s.targets.kcal ? "<p class=\"muted-p\">Calorias " + s.targets.kcal + " kcal (" + (s.targets.kcal >= maint ? "+" : "−") + Math.abs(s.targets.kcal - maint) + " kcal, " + pt2(Math.abs(phaseDeficitPct(s.targets.kcal, maint) || 0)) + " % " + (s.targets.kcal >= maint ? "acima" : "abaixo") + " da manutenção de " + maint + " kcal)</p>" : "");
  var rv = null; try { rv = computePhaseReview(s, localTodayISO(), {force: true}); } catch (e) {}
  if (rv && rv.evidence) html += "<p class=\"muted-p\">" + escapeHtml(rv.evidence) + "</p>";
  html += "<p class=\"muted-p\">Próxima revisão: " + escapeHtml(fmtDateFullPt(np.nextReviewDate || addDaysISO(np.startDate, np.reviewEveryDays || PHASE_CFG.reviewDays))) + (np.snoozeUntil ? " (adiada até " + escapeHtml(fmtDateFullPt(np.snoozeUntil)) + ")" : "") + "</p>";
  var last = (np.reviews || []).slice(-3).reverse();
  if (last.length) html += "<p class=\"muted-p\" style=\"font-size:0.78rem;\">Últimas revisões: " + last.map(function(r){ return escapeHtml(fmtDateFullPt(r.date)) + (r.deltaKcal ? " (" + (r.deltaKcal > 0 ? "+" : "") + r.deltaKcal + " kcal)" : ""); }).join(" · ") + "</p>";
  html += "<div style=\"display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;\"><button type=\"button\" class=\"btn btn-sm primary\" id=\"phaseReviewNow\">Rever agora</button><button type=\"button\" class=\"btn btn-sm\" id=\"phaseStart\">Alterar fase</button></div></div>";
  return html;
}
function openPhaseSetupModal(s, onDone){
  var np = phaseOf(s), cur = creatineWeightKg(s), goal = Number(s.weightGoal) || (np && np.targetWeight) || 0;
  var defType = np ? np.phase : phaseTypeFor(cur, goal), maint = computeMaintenanceKcal(s);
  var sheet = openModal("<div class=\"mtitle\">" + (np ? "Alterar fase" : "Definir fase") + "</div>" +
    "<p class=\"muted-p\" style=\"margin-bottom:10px;\">" + escapeHtml(s.name) + (cur ? " · peso atual " + pt2(cur) + " kg" : "") + (maint ? " · manutenção " + maint + " kcal" : "") + "</p>" +
    "<div class=\"checkin-field\"><label for=\"phType\">Fase</label><select id=\"phType\" class=\"mini-select\" style=\"width:100%;\"><option value=\"cut\"" + (defType === "cut" ? " selected" : "") + ">Cut (perder peso)</option><option value=\"bulk\"" + (defType === "bulk" ? " selected" : "") + ">Bulk (ganhar peso)</option><option value=\"manutencao\"" + (defType === "manutencao" ? " selected" : "") + ">Manutenção</option></select></div>" +
    "<div class=\"checkin-field\"><label for=\"phGoal\">Peso objetivo (kg)</label><input type=\"number\" id=\"phGoal\" step=\"0.5\" min=\"0\" value=\"" + (goal || "") + "\"></div>" +
    "<div class=\"checkin-field\"><label for=\"phEvery\">Rever o plano</label><select id=\"phEvery\" class=\"mini-select\" style=\"width:100%;\"><option value=\"21\">De 3 em 3 semanas (recomendado)</option><option value=\"28\">De 4 em 4 semanas</option></select></div>" +
    "<div class=\"checkin-field\" id=\"phLevelBox\"><label for=\"phLevel\">Experiência de treino (no bulk)</label><select id=\"phLevel\" class=\"mini-select\" style=\"width:100%;\"><option value=\"novato\">Menos de ~3 anos a treinar com regularidade</option><option value=\"avancado\">Avançado (mais de ~3 anos)</option></select></div>" +
    "<label style=\"display:flex; gap:8px; align-items:flex-start; margin:8px 0;\"><input type=\"checkbox\" id=\"phApply\" " + (np ? "" : "checked") + "> <span class=\"muted-p\">Aplicar já as calorias de partida da fase (ponto de partida pequeno e gradual). Se não, a fase começa nos alvos atuais.</span></label>" +
    "<div id=\"phPreview\" class=\"muted-p\" style=\"margin:6px 0 10px;\"></div>" +
    "<p class=\"muted-p\" id=\"phErr\" style=\"color:var(--critical); display:none;\"></p>" +
    "<button type=\"button\" class=\"btn primary\" id=\"phGo\" style=\"width:100%;\">✓ OK — " + (np ? "alterar" : "iniciar") + "</button>");
  function read(){ return {type: sheet.querySelector("#phType").value, targetWeight: parseFloat(sheet.querySelector("#phGoal").value) || 0, every: parseInt(sheet.querySelector("#phEvery").value, 10), level: sheet.querySelector("#phLevel").value, applyStart: sheet.querySelector("#phApply").checked}; }
  function preview(){
    var o = read(), tg = phaseStartTargets(s, o.type), box = sheet.querySelector("#phPreview");
    sheet.querySelector("#phLevelBox").style.display = o.type === "bulk" ? "" : "none";
    if (!tg || !maint){ box.textContent = "Faltam dados (peso, altura, idade) para calcular as calorias."; return; }
    var cfg = o.type === "cut" ? PHASE_CFG.cut[cutTierFor(s, cur)] : o.type === "bulk" ? PHASE_CFG.bulk[o.level === "avancado" ? "avancado" : "novato"] : null;
    box.innerHTML = (o.applyStart ? "Calorias de partida: <strong>" + tg.kcal + " kcal</strong> (" + (tg.kcal - maint >= 0 ? "+" : "−") + Math.abs(tg.kcal - maint) + " kcal face à manutenção; atualmente " + (s.targets && s.targets.kcal || "—") + " kcal)." : "As calorias atuais mantêm-se (" + (s.targets && s.targets.kcal || "—") + " kcal).") +
      (cfg ? " Ritmo previsto: " + pt2(cfg.rate) + " % do peso por semana; as calorias só mudam de " + o.every + " em " + o.every + " dias, em passos de 100–200 kcal, quando o peso o pedir e tu aprovares." : " Revisão a cada " + o.every + " dias; só mexe se o peso derivar.");
  }
  sheet.addEventListener("input", preview); sheet.addEventListener("change", preview);
  if (np && np.reviewEveryDays) sheet.querySelector("#phEvery").value = String(phaseEveryDays(np.reviewEveryDays) >= 28 ? 28 : 21);
  if (np && np.level) sheet.querySelector("#phLevel").value = np.level;
  preview();
  sheet.querySelector("#phGo").addEventListener("click", function(){
    var o = read();
    if (o.type !== "manutencao" && !(o.targetWeight > 0)){ var e = sheet.querySelector("#phErr"); e.textContent = "Indica o peso objetivo."; e.style.display = "block"; return; }
    var goBtn = sheet.querySelector("#phGo"); if (goBtn.disabled) return; goBtn.disabled = true;
    var r = startPhase(s, o);
    if (r.error){ goBtn.disabled = false; var e2 = sheet.querySelector("#phErr"); e2.textContent = r.error; e2.style.display = "block"; return; }
    closeModal(); showToast("✓ Fase " + phaseLabel(o.type) + " definida"); if (onDone) onDone();
  });
}
// janela de revisão: uma proposta de cada vez; o OK aplica tudo
function openPhaseReviewModal(items, i, onDone, q){
  items = items.filter(function(x){ return x && x.student; });
  if (!items.length){ if (onDone) onDone(); return; }
  i = i || 0; q = q || {acted: false};
  if (i >= items.length){ closeModal(); if (onDone) onDone(); return; }
  var it = items[i], s = it.student, rv = it.review, hasChange = !!rv.proposedTargets;
  var ct = rv.currentTargets, pt = rv.proposedTargets;
  var html = "<div class=\"mtitle\">Revisão do plano de " + escapeHtml(s.name) + "</div>" +
    "<p class=\"muted-p\" style=\"margin-bottom:8px;\">" + (items.length > 1 ? (i + 1) + " de " + items.length + " · " : "") + "Fase " + phaseLabel(rv.phase) + (rv.urgent ? " · <strong style=\"color:var(--critical);\">urgente</strong>" : "") + "</p>" +
    (rv.evidence ? "<p class=\"muted-p\" style=\"margin-bottom:8px;\">" + escapeHtml(rv.evidence) + (rv.band ? " Previsto " + pt2(rv.band[0]) + "–" + pt2(rv.band[1]) + " %/semana." : "") + "</p>" : "") +
    "<div class=\"card\" style=\"padding:12px 14px; margin-bottom:10px;\"><p style=\"margin:0;\">" + escapeHtml(rv.text) + "</p></div>";
  if (hasChange){
    html += "<div class=\"macro-target-grid\" style=\"margin-bottom:10px;\"><div class=\"f\"><label>Calorias</label><div class=\"v num\">" + ct.kcal + " → " + pt.kcal + "</div></div>" +
      "<div class=\"f\"><label>Hidratos</label><div class=\"v num\">" + ct.carbs + " → " + pt.carbs + " g</div></div>" +
      "<div class=\"f\"><label>Proteína</label><div class=\"v num\">" + pt.protein + " g</div></div><div class=\"f\"><label>Gordura</label><div class=\"v num\">" + pt.fat + " g</div></div></div>" +
      (rv.warnings.length ? "<ul class=\"muted-p\" style=\"padding-left:18px; margin-bottom:10px;\">" + rv.warnings.map(function(w){ return "<li>" + escapeHtml(w.text) + "</li>"; }).join("") + "</ul>" : "") +
      "<p class=\"muted-p\" style=\"font-size:0.78rem; margin-bottom:10px;\">Ao dares OK, os alvos mudam e as quantidades das refeições reajustam-se sozinhas. A decisão é sempre tua.</p>";
  }
  // sem alterações a aplicar, «OK» já adia a revisão: um segundo botão a fazer o mesmo só confundia
  html += "<div style=\"display:flex; flex-direction:column; gap:8px;\"><button type=\"button\" class=\"btn primary\" id=\"prOk\">" + (hasChange ? "✓ OK — aplicar" : "✓ OK — percebido") + "</button>" +
    (hasChange ? "<button type=\"button\" class=\"btn\" id=\"prLater\">Adiar 7 dias</button>" : "") + "<button type=\"button\" class=\"btn\" id=\"prOpen\">Ver o aluno</button></div>";
  var sheet = openModal(html);
  // um duplo toque no OK não pode aprovar já a proposta seguinte sem a ler: a janela nova só aceita toques passados 600 ms
  var openedAt = Date.now(), settling = function(){ return i > 0 && Date.now() - openedAt < 600; }, busy = false;
  var next = function(){ q.acted = true; openPhaseReviewModal(items, i + 1, onDone, q); };
  var closedEarly = function(){ if (q.acted && onDone) onDone(); };
  sheet.querySelector(".mclose button").addEventListener("click", closedEarly);
  if (sheet.parentNode) sheet.parentNode.addEventListener("click", function(e){ if (e.target === sheet.parentNode) closedEarly(); });
  sheet.querySelector("#prOk").addEventListener("click", function(){
    if (busy || settling()) return;
    busy = true;
    if (hasChange){
      var r = applyPhaseReview(s, rv);
      if (r.error){ busy = false; showToast("⚠ " + r.error); return; }
      showToast(["✓ Plano de ", s.name, " atualizado: ", r.from, " → ", r.to, " kcal/dia"].join(""));
    } else { var pr = postponePhaseReview(s, 7); if (pr.error){ busy = false; showToast("⚠ " + pr.error); return; } }
    next();
  });
  var laterBtn = sheet.querySelector("#prLater");
  if (laterBtn) laterBtn.addEventListener("click", function(){
    if (busy || settling()) return;
    busy = true;
    var pr = postponePhaseReview(s, 7);
    if (pr.error){ busy = false; showToast("⚠ " + pr.error); return; }
    next();
  });
  sheet.querySelector("#prOpen").addEventListener("click", function(){ closeModal(); state.proSelectedId = s.id; state.proTab = "plano"; renderProShell(); try { window.scrollTo(0, 0); } catch (e) {} });
}
function tplPhaseReviews(){
  var list = collectPhaseReviews();
  if (!list.length) return "";
  var shown = list.slice(0, PHASE_REVIEW_CARD_MAX);
  return "<div class=\"card\" id=\"phaseReviewsCard\"><div class=\"eyebrow\" style=\"margin-bottom:6px;\">Revisões de plano · " + list.length + "</div>" +
    shown.map(function(x){
      return "<div class=\"history-row\" style=\"align-items:center;\"><div style=\"min-width:0;flex:1;\"><div class=\"hlabel\">" + escapeHtml(x.student.name) + " <span class=\"pill\">" + phaseLabel(x.review.phase) + "</span></div><div class=\"muted-p\" style=\"font-size:0.78rem;\">" +
        escapeHtml(x.review.kind === "ajuste" || x.review.kind === "objetivo" ? (x.review.deltaKcal > 0 ? "+" : "") + x.review.deltaKcal + " kcal/dia sugeridas" : x.review.text) + "</div></div>" +
        "<button type=\"button\" class=\"btn btn-sm primary\" data-phase-review=\"" + escapeHtml(x.student.id) + "\" style=\"min-height:44px;\">Rever</button></div>";
    }).join("") + (list.length > shown.length ? "<p class=\"muted-p\" style=\"margin:8px 0 6px;\">+ " + (list.length - shown.length) + (list.length - shown.length === 1 ? " aluno à espera" : " alunos à espera") + "</p><button type=\"button\" class=\"btn btn-sm\" data-phase-review-all style=\"min-height:44px;\">Rever todas (" + list.length + ")</button>" : "") + "</div>";
}
var PHASE_REVIEW_CARD_MAX = 5;
function wirePhaseReviews(root, redraw){
  root.querySelectorAll("[data-phase-review]").forEach(function(b){ b.addEventListener("click", function(){
    var id = b.getAttribute("data-phase-review"), list = collectPhaseReviews(), idx = list.map(function(x){ return x.student.id; }).indexOf(id);
    if (idx >= 0) openPhaseReviewModal(list, idx, redraw); else if (redraw) redraw();   // já tratado noutro sítio: o cartão atualiza-se
  }); });
  root.querySelectorAll("[data-phase-review-all]").forEach(function(b){ b.addEventListener("click", function(){ openPhaseReviewModal(collectPhaseReviews(), 0, redraw); }); });
}
// ao entrar, o profissional vê logo as revisões à espera (uma vez por sessão)
function maybeOpenPhaseReviews(){
  if (authRole !== "professional" || state.phaseReviewShown || modalRoot.firstChild) return;
  var list = collectPhaseReviews();
  state.phaseReviewShown = true;
  if (list.length) openPhaseReviewModal(list, 0, function(){ if (state.mode === "pro" && !state.proSelectedId && state.proView === "dashboard" && !modalRoot.firstChild) renderProDashboardMain(); });
}

function slug(s){ return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,""); }
function initialsOf(name){ var parts=name.trim().split(/\s+/); return ((parts[0]||"")[0]||"") .toUpperCase()+ ((parts[parts.length-1]||"")[0]||"").toUpperCase(); }

/* ===================== STATE ===================== */
var state = { workoutDayId:null, mode:"aluno", alunoStudentId:"maria", alunoTab:"hoje", proSelectedId:null, proTab:"perfil", proView:"dashboard", showDemoStudents:false, dashboardListMode:"active", planoSection:"alimentacao", ciOpen:false, pendingHelp:{} };
var authRole = null; // 'professional' | 'student' | null
var currentAuthUserId = null;

/* ===================== MODAL ===================== */
var modalRoot = document.getElementById("modalRoot");
function closeModal(){ modalRoot.innerHTML=""; }
function openModal(innerHtml, opts){
  opts = opts || {};
  var overlay = document.createElement("div");
  overlay.className = "modal-overlay" + (opts.centered ? " centered" : "");
  overlay.addEventListener("click", function(e){ if (e.target===overlay) closeModal(); });
  var sheet = document.createElement("div");
  sheet.className = "modal-sheet";
  sheet.innerHTML = "<div class=\"mclose\"><button type=\"button\" aria-label=\"Fechar\">✕</button></div>" + innerHtml;
  sheet.querySelector(".mclose button").addEventListener("click", closeModal);
  overlay.appendChild(sheet);
  modalRoot.innerHTML = "";
  modalRoot.appendChild(overlay);
  return sheet;
}

function openSubstitution(f, onConfirm, s, meal, opts){
  var sheet = openModal("");
  var proMode = !!(opts && opts.pro); // o profissional também usa isto no editor do plano: sem o bloqueio do aluno nem o limite de alternativas

  // Trava central: nenhuma sugestão de alimento sai daqui (nem a lista de
  // alternativas nem o "não encontrei substituição, pergunta ao profissional")
  // enquanto houver alergias/restrições em texto livre não mapeadas. Todas as
  // chamadas a openSubstitution em toda a app (detalhe da refeição, plano,
  // "não tenho isto", pouco tempo, trocar refeição) passam por aqui, por isso
  // basta esta verificação para cobrir todas elas.
  if (s && hasUnmappedDietaryRisk(s) && !proMode){
    renderDietRiskBlocked(sheet, s, meal, "sem_alimento", "Pedido de alternativa segura para " + f.name + ".");
    return sheet;
  }

  var priorityKey = GROUP_PRIORITY_KEY[resolveGroup(f.group)];
  var usingManualList = !!(f.allowedSubs && f.allowedSubs.length);
  var baseOptions = optionsFor(f, s).filter(function(o){ return o.name !== f.name; });
  // "key": iguala o macro prioritário do grupo (como sempre); "kcal": iguala as calorias. Sem macro prioritário é sempre "kcal".
  var eqMode = priorityKey ? "key" : "kcal";
  var options = [], bestIdx = {};
  function buildOptions(){
    var scored = baseOptions.map(function(o){
      var alt = computeEquivalentAlternative(f, o, eqMode);
      return {alt: alt, d: substitutionDistance(f, alt)};
    });
    if (!usingManualList) scored.sort(function(a, b){ return a.d - b.d; }); // as mais parecidas primeiro (a lista manual do profissional mantém a ordem dele)
    if (!usingManualList && s && !proMode){
      var max = SUBSTITUTION_LEVEL_MAX[computeFlexibilityProfile(s).substitutionLevel];
      if (isFinite(max)) scored = scored.slice(0, max);
    }
    options = scored.map(function(x){ return x.alt; });
    bestIdx = {};
    scored.slice(0, 3).forEach(function(x, i){ if (!usingManualList && x.d < 0.6) bestIdx[i] = true; });
  }
  buildOptions();

  // Fase 16: a base do INSA pode tornar "options" muito maior do que antes
  // (alunos em nível "Flexível" não têm limite de alternativas — ver
  // SUBSTITUTION_LEVEL_MAX). Em vez de listar tudo, filtra por pesquisa e
  // limita sempre o que é desenhado de uma vez. optionsByIdx() só afeta a
  // apresentação — os índices usados em renderConfirm() continuam a
  // referir-se sempre ao array completo "options", nunca ao filtrado.
  function optionsHtml(term){
    var indices = [];
    options.forEach(function(o, idx){
      if (!term || o.name.toLowerCase().indexOf(term.toLowerCase()) >= 0) indices.push(idx);
    });
    var shown = indices.slice(0, FOOD_SEARCH_RENDER_CAP);
    var html = shown.map(function(idx){
      var o = options[idx];
      var badge = eqMode === "key" ? "≈ mesma " + PRIORITY_LABEL[priorityKey] : "≈ mesmas calorias";
      var note = substitutionKcalNote(f, o);
      return "<div class=\"food-item\" data-idx=\"" + idx + "\" style=\"cursor:pointer;\">" +
        "<span class=\"fname\">" + escapeHtml(o.name) + (bestIdx[idx] ? " <span class=\"pill good\" style=\"font-size:0.65rem;\">mais semelhante</span>" : "") + "</span>" +
        "<span><span class=\"fqty\">" + escapeHtml(o.qty) + "</span><span class=\"swap-hint\">" + badge + (note ? " · " + note : "") + "</span></span>" +
      "</div>";
    }).join("");
    if (indices.length > shown.length) html += "<p class=\"muted-p\" style=\"margin:4px 0;\">+" + (indices.length - shown.length) + " mais — continua a escrever para afinar</p>";
    if (!indices.length) html += "<p class=\"muted-p\" style=\"margin:4px 0;\">Sem alternativas com esse nome.</p>";
    return html;
  }

  function wireOptionsList(){
    sheet.querySelectorAll(".food-item[data-idx]").forEach(function(el){
      el.addEventListener("click", function(){
        renderConfirm(options[parseInt(el.getAttribute("data-idx"),10)]);
      });
    });
  }

  function renderList(){
    var html = "<div class=\"mtitle\">Substituir</div>" +
      "<div class=\"food-item\" style=\"border-bottom:2px solid var(--line); margin-bottom:10px; padding-bottom:10px;\">" +
        "<span class=\"fname\">" + escapeHtml(f.name) + "</span><span class=\"fqty\">" + escapeHtml(f.qty) + "</span>" +
      "</div>" +
      (proMode && s && hasUnmappedDietaryRisk(s) ? "<p class=\"muted-p\" style=\"margin-bottom:8px; color:var(--warn);\">⚠ Este aluno tem alergias/restrições em texto livre: confirma que a alternativa é segura.</p>" : "") +
      (priorityKey ? "<div class=\"seg\" style=\"margin-bottom:10px;\"><button type=\"button\" data-eq-mode=\"key\" class=\"" + (eqMode === "key" ? "on" : "") + "\">Igualar " + PRIORITY_LABEL[priorityKey] + "</button>" +
        "<button type=\"button\" data-eq-mode=\"kcal\" class=\"" + (eqMode === "kcal" ? "on" : "") + "\">Igualar calorias</button></div>" : "") +
      "<p class=\"muted-p\" style=\"margin-bottom:8px;\">Alternativas equivalentes (mais parecidas primeiro):</p>";
    if (!options.length){
      html += "<p class=\"muted-p\" style=\"margin-bottom:10px;\">Não encontrei uma substituição definida para este alimento.</p>" +
        (HELP_REQUESTS_ENABLED ? "<button type=\"button\" class=\"btn\" id=\"askProfessional\" style=\"width:100%;\">Perguntar ao profissional</button>" : "<p class=\"muted-p\">" + HELP_OFF_MSG + "</p>");
    } else {
      if (options.length > 8) html += "<input type=\"text\" id=\"subSearch\" placeholder=\"Pesquisar alternativa...\" autocomplete=\"off\" style=\"width:100%; border:1px solid var(--line-strong); border-radius:10px; padding:9px 11px; background:var(--bg); color:var(--ink); font-size:0.9rem; margin-bottom:8px;\">";
      html += "<div id=\"subOptionsList\">" + optionsHtml("") + "</div>";
    }
    sheet.innerHTML = "<div class=\"mclose\"><button type=\"button\" aria-label=\"Fechar\">✕</button></div>" + html;
    sheet.querySelector(".mclose button").addEventListener("click", closeModal);
    wireOptionsList();
    sheet.querySelectorAll("[data-eq-mode]").forEach(function(b){
      b.addEventListener("click", function(){ eqMode = b.getAttribute("data-eq-mode"); buildOptions(); renderList(); });
    });
    var searchInput = sheet.querySelector("#subSearch");
    if (searchInput) searchInput.addEventListener("input", function(){
      sheet.querySelector("#subOptionsList").innerHTML = optionsHtml(searchInput.value);
      wireOptionsList();
    });
    var askBtn = sheet.querySelector("#askProfessional");
    if (askBtn) askBtn.addEventListener("click", function(){
      if (s) createHelpRequest(s, meal, "sem_alimento", "Sem substituição disponível para " + f.name + ".");
      showToast("O teu profissional vai ver este pedido");
      closeModal();
    });
  }

  function renderConfirm(chosen){
    var html = "<div class=\"mtitle\">Substituir " + escapeHtml(f.name) + " por " + escapeHtml(chosen.name) + "?</div>" +
      "<div style=\"display:flex; align-items:center; gap:10px; margin:18px 0;\">" +
        "<div class=\"food-item\" style=\"flex:1; border:1px solid var(--line); border-radius:10px; padding:10px;\"><span class=\"fname\">" + escapeHtml(f.name) + "</span><span class=\"fqty\">" + escapeHtml(f.qty) + "</span></div>" +
        "<span style=\"color:var(--muted); font-weight:700;\">→</span>" +
        "<div class=\"food-item\" style=\"flex:1; border:1px solid var(--accent); border-radius:10px; padding:10px;\"><span class=\"fname\">" + escapeHtml(chosen.name) + "</span><span class=\"fqty\">" + escapeHtml(chosen.qty) + "</span></div>" +
      "</div>" +
      "<button type=\"button\" class=\"btn primary\" id=\"confirmSub\" style=\"width:100%; margin-bottom:8px;\">Confirmar</button>" +
      "<button type=\"button\" class=\"btn\" id=\"cancelSub\" style=\"width:100%;\">Cancelar</button>";
    sheet.innerHTML = "<div class=\"mclose\"><button type=\"button\" aria-label=\"Fechar\">✕</button></div>" + html;
    sheet.querySelector(".mclose button").addEventListener("click", closeModal);
    sheet.querySelector("#confirmSub").addEventListener("click", function(){ onConfirm(chosen); });
    sheet.querySelector("#cancelSub").addEventListener("click", renderList);
  }

  renderList();
}

// Fase 16: modal de pesquisa para o "Ver mais alimentos" do construtor de
// refeições — mesmo padrão de pesquisa usado em openSubstitution() e no
// "+ Adicionar alimento" do profissional. onPick recebe o índice real no
// array completo de opções (nunca o índice do subconjunto pesquisado).
function openMealOptionPicker(options, onPick){
  var sheet = openModal("");
  function renderResults(term){
    var indices = [];
    options.forEach(function(o, oi){
      if (!term || o.name.toLowerCase().indexOf(term.toLowerCase()) >= 0) indices.push(oi);
    });
    var shown = indices.slice(0, FOOD_SEARCH_RENDER_CAP);
    var listHtml = shown.map(function(oi){
      var o = options[oi];
      return "<div class=\"food-item\" data-oi=\"" + oi + "\" style=\"cursor:pointer;\"><span class=\"fname\">" + escapeHtml(o.name) + "</span><span class=\"fqty\">" + escapeHtml(o.qty) + "</span></div>";
    }).join("");
    if (indices.length > shown.length) listHtml += "<p class=\"muted-p\">+" + (indices.length - shown.length) + " mais — continua a escrever para afinar</p>";
    if (!indices.length) listHtml += "<p class=\"muted-p\">Sem alimentos com esse nome.</p>";
    sheet.querySelector("#mopList").innerHTML = listHtml;
    sheet.querySelectorAll("#mopList .food-item[data-oi]").forEach(function(el){
      el.addEventListener("click", function(){
        onPick(parseInt(el.getAttribute("data-oi"),10));
        closeModal();
      });
    });
  }
  sheet.innerHTML = "<div class=\"mclose\"><button type=\"button\" aria-label=\"Fechar\">✕</button></div>" +
    "<div class=\"mtitle\">Escolher alimento</div>" +
    "<input type=\"text\" id=\"mopSearch\" placeholder=\"Pesquisar alimento...\" autocomplete=\"off\" style=\"width:100%; border:1px solid var(--line-strong); border-radius:10px; padding:9px 11px; background:var(--bg); color:var(--ink); font-size:0.9rem; margin-bottom:8px;\">" +
    "<div id=\"mopList\"></div>";
  sheet.querySelector(".mclose button").addEventListener("click", closeModal);
  sheet.querySelector("#mopSearch").addEventListener("input", function(){ renderResults(this.value); });
  renderResults("");
  return sheet;
}

var RESTAURANT_GUIDANCE = {
  estruturado: "Procura uma opção próxima da estrutura da tua refeição.",
  equilibrado: "Escolhe uma fonte de proteína + acompanhamento + legumes.",
  flexivel: "Escolhe uma refeição que gostes e procura manter uma boa fonte de proteína e uma porção adequada de hidratos e gordura."
};

function openScenarioPicker(s){
  var nm = getNextMealView(s);
  var targetMeal = nm ? nm.meal : null;
  var html = "<div class=\"mtitle\">O que mudou?</div>" +
    "<p class=\"muted-p\" style=\"margin:4px 0 4px;\">Escolhe a situação — não é um prémio nem um castigo, é só adaptar.</p>" +
    "<div class=\"scenario-grid\">" +
    Object.keys(SCENARIOS).map(function(k){ return "<button type=\"button\" class=\"scenario-btn\" data-k=\"" + k + "\">" + SCENARIOS[k].label + "</button>"; }).join("") +
    "</div>";
  var sheet = openModal(html);
  sheet.querySelectorAll(".scenario-btn").forEach(function(btn){
    btn.addEventListener("click", function(){
      var k = btn.getAttribute("data-k");
      renderScenarioTips(SCENARIOS[k], k);
    });
  });

  function renderScenarioTips(sc, key){
    var extraField = sc.freeText ? "<textarea id=\"scenarioNote\" placeholder=\"Descreve a situação (opcional)\" style=\"width:100%; min-height:60px; border:1px solid var(--line-strong); border-radius:10px; padding:9px 11px; background:var(--bg); font-size:0.88rem; margin-bottom:12px;\"></textarea>" : "";
    var tips = sc.tips.slice();
    if (key === "restaurante") tips = [RESTAURANT_GUIDANCE[computeFlexibilityProfile(s).preset]].concat(tips);
    var canMarkFlexible = targetMeal && computeFlexibilityProfile(s).freeMealEnabled && !mealCountsToday(targetMeal);
    var tipsHtml = "<div class=\"eyebrow\" style=\"margin-bottom:4px;\">Hoje podes ser flexível</div>" +
      "<div class=\"mtitle\" style=\"margin-bottom:12px;\">" + sc.label + "</div>" +
      extraField +
      "<ul style=\"padding-left:18px; margin:0 0 14px;\">" +
      tips.map(function(t){ return "<li class=\"muted-p\" style=\"margin-bottom:8px;\">" + t + "</li>"; }).join("") + "</ul>" +
      (canMarkFlexible ?
        "<button type=\"button\" class=\"btn primary\" id=\"scenarioDone\" style=\"width:100%; margin-bottom:8px;\">Marcar " + targetMeal.name + " como flexível</button>" +
        "<button type=\"button\" class=\"btn\" id=\"scenarioSkip\" style=\"width:100%;\">Só ver as dicas</button>"
        : "<button type=\"button\" class=\"btn primary\" id=\"scenarioSkip\" style=\"width:100%;\">Percebido</button>");
    sheet.innerHTML = "<div class=\"mclose\"><button type=\"button\" aria-label=\"Fechar\">✕</button></div>" + tipsHtml;
    sheet.querySelector(".mclose button").addEventListener("click", closeModal);
    var doneBtn = sheet.querySelector("#scenarioDone");
    if (doneBtn) doneBtn.addEventListener("click", function(){
      var noteEl = sheet.querySelector("#scenarioNote");
      var note = noteEl ? noteEl.value : "";
      markFlexible(s, targetMeal, key + (note ? (": " + note) : ""));
      commitMealView(s, targetMeal);
      renderAlunoTab(s);
      persistStudent(s);
      showToast(targetMeal.name + " marcada como flexível");
      closeModal();
    });
    var skipBtn = sheet.querySelector("#scenarioSkip");
    if (skipBtn) skipBtn.addEventListener("click", closeModal);
  }
}

function openLowTime(s){
  var nm = getNextMealView(s);
  if (!nm){ showToast("Não há mais refeições previstas para hoje."); return; }
  var m = nm.meal;
  var fi = m.foods.findIndex(function(f){ return f.group; });
  if (fi < 0){ showToast("Sem alternativas rápidas definidas para " + m.name + "."); return; }
  openSubstitution(m.foods[fi], function(chosen){
    applySubstitution(s, m, fi, chosen);
    commitMealView(s, m);
    renderAlunoTab(s);
    persistStudent(s);
    showToast("Refeição adaptada");
    closeModal();
  }, s, m);
}

/* ===================== Assistente Alimentar Guiado =====================
   Um menu de situações reais que encaminha para os fluxos que já existem
   (substituição, adaptar, ignorar, reagendar, "hoje vai ser diferente") em
   vez de duplicar essa lógica — só "Já comi algo diferente" e "Tenho outra
   dúvida sobre o plano" são novos de facto. Nunca escreve em s.meals/targets/
   flexibility: tudo passa pelas mesmas funções que já só tocam em
   mealDailyState, ou cria um pedido de ajuda (fora do controlo do aluno
   depois de criado). Nunca sugere um alimento bloqueado pelo profissional
   (optionsFor() filtra blockedFoods, sempre, para todos os alunos).

   Modo de segurança para alergias/restrições não mapeadas: optionsFor() NÃO
   filtra allergies/avoid/dislikes (são texto livre, sem mapeamento seguro
   para alimentos concretos) — por isso, enquanto hasUnmappedDietaryRisk(s)
   for verdadeiro, "Não tenho este alimento" e "Tenho pouco tempo" nunca
   chegam a mostrar alternativas (ver o "diet_risk_blocked" abaixo e a trava
   em openSubstitution()), e "Vou comer fora" não mostra as dicas de
   restaurante. Em vez disso mostram DIET_RISK_SAFE_MESSAGE e só permitem
   pedir ajuda ao profissional — nunca uma sugestão de alimento. "Quero trocar
   uma refeição" continua disponível porque "Adaptar a refeição toda" não
   recomenda nenhum alimento concreto; só o seu sub-fluxo "Substituir um
   alimento" é bloqueado, pela mesma trava central em openSubstitution(). */
var ASSISTANT_SITUATIONS = [
  {key:"sem_alimento", label:"Não tenho este alimento"},
  {key:"pouco_tempo", label:"Tenho pouco tempo"},
  {key:"fora", label:"Vou comer fora"},
  {key:"horario", label:"Alterei o horário"},
  {key:"saltei", label:"Saltei uma refeição"},
  {key:"diferente", label:"Já comi algo diferente"},
  {key:"trocar", label:"Quero trocar uma refeição"},
  {key:"duvida", label:"Tenho outra dúvida sobre o plano"}
];

function openAssistant(s){
  var html = "<div class=\"mtitle\">Precisas de ajuda com a alimentação?</div>" +
    "<p class=\"muted-p\" style=\"margin:4px 0 14px;\">Escolhe a situação que descreve melhor o que se passa.</p>" +
    "<div style=\"display:flex; flex-direction:column; gap:8px;\">" +
    ASSISTANT_SITUATIONS.map(function(sit){
      return "<button type=\"button\" class=\"btn assistant-situation\" data-k=\"" + sit.key + "\" style=\"width:100%; text-align:left;\">" + escapeHtml(sit.label) + "</button>";
    }).join("") +
    "</div>";
  var sheet = openModal(html);
  sheet.querySelectorAll(".assistant-situation").forEach(function(btn){
    btn.addEventListener("click", function(){ handleAssistantSituation(s, btn.getAttribute("data-k")); });
  });
}

/* Decide o que fazer para cada situação, sem tocar em DOM/modais — é o que
   se testa diretamente. handleAssistantSituation só interpreta a decisão e
   abre o ecrã correspondente. Mantém a mesma lista de situações usável tanto
   para um aluno estruturado como equilibrado ou flexível: a diferença de
   perfil já é tratada dentro de cada função reaproveitada (optionsFor,
   computeFlexibilityProfile, etc.), não aqui. */
// Situações do menu do assistente que recomendariam um alimento concreto (ou
// dicas de escolha alimentar, no caso de "fora") — as únicas que o modo de
// segurança de hasUnmappedDietaryRisk() precisa de interceptar aqui. "trocar"
// fica de fora desta lista de propósito: "Adaptar a refeição toda" não
// recomenda nenhum alimento, só o sub-fluxo "Substituir um alimento" o faz, e
// esse já é bloqueado pela trava central em openSubstitution().
var ASSISTANT_FOOD_SUGGESTING_SITUATIONS = {sem_alimento:true, pouco_tempo:true, fora:true};

function decideAssistantAction(s, key){
  var meals = resolveMealsForToday(s);
  var nm = getNextMeal({meals: meals});

  if (ASSISTANT_FOOD_SUGGESTING_SITUATIONS[key] && hasUnmappedDietaryRisk(s)){
    return {action:"diet_risk_blocked", meal: nm ? nm.meal : null, situation:key};
  }

  if (key === "sem_alimento"){
    if (!nm) return {action:"no_meal", situation:key};
    var m = nm.meal;
    var swappable = m.foods.filter(function(f){ return f.group; });
    if (!swappable.length) return {action:"ask_professional", meal:m, situation:key, note:"Nenhum alimento substituível em " + m.name + "."};
    return {action:"pick_food", meal:m, swappable:swappable};
  }
  if (key === "pouco_tempo") return {action:"low_time"};
  if (key === "fora") return {action:"scenario_picker"};
  if (key === "horario"){
    if (!nm) return {action:"no_meal", situation:key};
    return {action:"reschedule", meal:nm.meal};
  }
  if (key === "saltei"){
    if (!nm) return {action:"no_meal", situation:key};
    return {action:"skip", meal:nm.meal};
  }
  if (key === "diferente") return {action:"different", meal: nm ? nm.meal : null};
  if (key === "trocar"){
    if (!nm) return {action:"no_meal", situation:key};
    return {action:"swap_meal", meal:nm.meal};
  }
  if (key === "duvida") return {action:"ask_professional", meal: nm ? nm.meal : null, situation:key, note:""};
  return {action:"unknown"};
}

function handleAssistantSituation(s, key){
  var decision = decideAssistantAction(s, key);
  var meals = resolveMealsForToday(s);
  function findIdx(mv){ return meals.findIndex(function(x){ return mealKey(x) === mealKey(mv); }); }

  if (decision.action === "no_meal") return openAssistantNoMeal(s, decision.situation);
  if (decision.action === "diet_risk_blocked") return openAssistantDietRiskBlocked(s, decision.meal, decision.situation);
  if (decision.action === "ask_professional") return openAssistantAskProfessional(s, decision.meal, decision.situation, decision.note);
  if (decision.action === "pick_food") return openAssistantPickFood(s, decision.meal, decision.swappable);
  if (decision.action === "low_time") return openLowTime(s);
  if (decision.action === "scenario_picker") return openScenarioPicker(s);
  if (decision.action === "reschedule") return openReschedule(s, decision.meal, findIdx(decision.meal));
  if (decision.action === "skip") return openSkipMeal(s, decision.meal, findIdx(decision.meal));
  if (decision.action === "different") return openAssistantDifferent(s, decision.meal);
  if (decision.action === "swap_meal") return openAssistantSwapMeal(s, decision.meal);
}

function openAssistantNoMeal(s, situation){
  var html = "<div class=\"mtitle\">Sem refeições previstas</div>" +
    "<p class=\"muted-p\" style=\"margin-bottom:14px;\">Não há mais refeições previstas para hoje. Se precisares mesmo de ajuda, fala com o teu profissional.</p>" +
    (HELP_REQUESTS_ENABLED ? "<button type=\"button\" class=\"btn primary\" id=\"askPro\" style=\"width:100%;\">Pedir ajuda ao profissional</button>" : "");
  var sheet = openModal(html);
  var askPro = sheet.querySelector("#askPro");
  if (askPro) askPro.addEventListener("click", function(){
    createHelpRequest(s, null, situation, "Sem refeições previstas para hoje.");
    showToast("O teu profissional vai ver este pedido");
    closeModal();
  });
}

// Ecrã do assistente para "sem_alimento"/"pouco_tempo"/"fora" quando
// hasUnmappedDietaryRisk(s) é verdadeiro — reaproveita renderDietRiskBlocked()
// para mostrar sempre a mesma mensagem e a mesma única ação (pedir ajuda),
// nunca uma sugestão de alimento.
function openAssistantDietRiskBlocked(s, meal, situation){
  var sheet = openModal("");
  renderDietRiskBlocked(sheet, s, meal, situation, "Aluno tem alergias/restrições registadas — pedido de alternativa segura.");
}

function openAssistantPickFood(s, m, swappable){
  var html = "<div class=\"mtitle\">Qual alimento não tens?</div>" +
    "<p class=\"muted-p\" style=\"margin-bottom:14px;\">" + escapeHtml(m.name) + "</p>" +
    swappable.map(function(f, i){
      return "<div class=\"food-item\" data-i=\"" + i + "\" style=\"cursor:pointer;\"><span class=\"fname\">" + escapeHtml(f.name) + "</span><span class=\"fqty\">" + escapeHtml(f.qty) + "</span></div>";
    }).join("");
  var sheet = openModal(html);
  sheet.querySelectorAll(".food-item[data-i]").forEach(function(el){
    el.addEventListener("click", function(){
      var f = swappable[parseInt(el.getAttribute("data-i"),10)];
      var fi = m.foods.indexOf(f);
      openSubstitution(f, function(chosen){
        applySubstitution(s, m, fi, chosen);
        commitMealView(s, m);
        renderAlunoTab(s);
        persistStudent(s);
        showToast("Refeição adaptada");
        closeModal();
      }, s, m);
    });
  });
}

function openAssistantAskProfessional(s, meal, situation, prefilledNote){
  if (!HELP_REQUESTS_ENABLED){ openModal("<div class=\"mtitle\">Precisas de ajuda?</div><p class=\"muted-p\">" + HELP_OFF_MSG + "</p>"); return; }
  var html = "<div class=\"mtitle\">Pedir ajuda ao profissional</div>" +
    "<p class=\"muted-p\" style=\"margin-bottom:10px;\">" + (meal ? "Sobre: " + escapeHtml(meal.name) : "Descreve a tua dúvida.") + "</p>" +
    "<textarea id=\"helpNote\" placeholder=\"Descreve a situação (opcional)\" style=\"width:100%; min-height:80px; border:1px solid var(--line-strong); border-radius:10px; padding:9px 11px; background:var(--bg); font-size:0.88rem; margin-bottom:12px;\">" + escapeHtml(prefilledNote || "") + "</textarea>" +
    "<button type=\"button\" class=\"btn primary\" id=\"sendHelp\" style=\"width:100%;\">Enviar pedido</button>";
  var sheet = openModal(html);
  sheet.querySelector("#sendHelp").addEventListener("click", function(){
    var note = sheet.querySelector("#helpNote").value;
    createHelpRequest(s, meal, situation, note);
    showToast("O teu profissional vai ver este pedido");
    closeModal();
  });
}

function openAssistantDifferent(s, meal){
  var canMarkFlexible = !!(meal && computeFlexibilityProfile(s).freeMealEnabled && !mealCountsToday(meal));
  var html = "<div class=\"mtitle\">Já comeste algo diferente?</div>" +
    "<p class=\"muted-p\" style=\"margin-bottom:14px;\">Sem problema — um momento diferente não desfaz o teu progresso. Retoma o plano com naturalidade na próxima refeição.</p>" +
    (canMarkFlexible ?
      "<button type=\"button\" class=\"btn primary\" id=\"markFlex\" style=\"width:100%; margin-bottom:8px;\">Marcar " + escapeHtml(meal.name) + " como flexível</button>" +
      "<button type=\"button\" class=\"btn\" id=\"gotIt\" style=\"width:100%;\">Percebido</button>"
      : "<button type=\"button\" class=\"btn primary\" id=\"gotIt\" style=\"width:100%;\">Percebido</button>");
  var sheet = openModal(html);
  var flexBtn = sheet.querySelector("#markFlex");
  if (flexBtn) flexBtn.addEventListener("click", function(){
    markFlexible(s, meal, "diferente");
    commitMealView(s, meal);
    renderAlunoTab(s);
    persistStudent(s);
    showToast(meal.name + " marcada como flexível");
    closeModal();
  });
  sheet.querySelector("#gotIt").addEventListener("click", closeModal);
}

function openAssistantSwapMeal(s, meal){
  var hasSwappableFood = meal.foods.some(function(f){ return f.group; });
  var html = "<div class=\"mtitle\">Trocar " + escapeHtml(meal.name) + "</div>" +
    "<p class=\"muted-p\" style=\"margin-bottom:14px;\">O que preferes fazer?</p>" +
    (hasSwappableFood ? "<button type=\"button\" class=\"btn primary\" id=\"swapFood\" style=\"width:100%; margin-bottom:8px;\">Substituir um alimento</button>" : "") +
    "<button type=\"button\" class=\"btn\" id=\"swapAdapt\" style=\"width:100%;\">Adaptar a refeição toda</button>";
  var sheet = openModal(html);
  var swapFoodBtn = sheet.querySelector("#swapFood");
  if (swapFoodBtn) swapFoodBtn.addEventListener("click", function(){
    openAssistantPickFood(s, meal, meal.foods.filter(function(f){ return f.group; }));
  });
  sheet.querySelector("#swapAdapt").addEventListener("click", function(){
    meal.adapted = true;
    logAdaptation(s, meal, "adaptacao", {reason:"Troca de refeição"});
    commitMealView(s, meal);
    renderAlunoTab(s);
    persistStudent(s);
    showToast("Refeição adaptada");
    closeModal();
  });
}

function openMealDetail(s, idx){
  var allMeals = resolveMealsForToday(s), m = allMeals[idx], creatineHere = breakfastMealIndex(allMeals) === idx;

  function render(){
    var profile = computeFlexibilityProfile(s);
    var totals = resolvedMealTotals(s, m);
    var substitutableIdx = profile.substitutionsEnabled ? m.foods.findIndex(function(f){ return f.group; }) : -1;
    var html = "<div class=\"mtitle\">" + escapeHtml(m.name.toUpperCase()) + "</div>" +
      "<p class=\"muted-p\" style=\"margin-bottom:14px;\">" + escapeHtml(effectiveMealTime(m)) + " · " + escapeHtml(mealStatusLabel(m)) + "</p>" +
      "<div class=\"macro-target-grid\" style=\"margin-bottom:14px;\">" +
        "<div class=\"f\"><label>Calorias</label><div class=\"v num\">" + totals.kcal + " kcal</div></div>" +
        "<div class=\"f\"><label>Proteína</label><div class=\"v num\">" + totals.p + " g</div></div>" +
        "<div class=\"f\"><label>Hidratos</label><div class=\"v num\">" + totals.c + " g</div></div>" +
        "<div class=\"f\"><label>Gordura</label><div class=\"v num\">" + totals.f + " g</div></div>" +
      "</div>" +
      "<div style=\"border-top:1px solid var(--line); padding-top:8px; margin-bottom:16px;\">" +
        m.foods.map(function(f, fi){
          var canSwap = f.group && profile.substitutionsEnabled;
          return "<div class=\"food-item\"" + (canSwap ? " data-fidx=\"" + fi + "\" style=\"cursor:pointer;\"" : "") + ">" +
            "<span class=\"fname\">" + escapeHtml(f.name) + "</span>" +
            "<span><span class=\"fqty\">" + escapeHtml(f.qty) + "</span>" + (canSwap ? "<span class=\"swap-hint\">não tenho isto</span>" : "") + "</span>" +
          "</div>";
        }).join("") + (creatineHere ? creatineLineHtml(s) : "") +
      "</div>" +
      "<div style=\"display:flex; flex-direction:column; gap:8px;\">" +
        "<button type=\"button\" class=\"btn primary\" id=\"mdComplete\">" + (m.done ? "✓ Concluída — toca para desfazer" : "✓ Marcar como concluída") + "</button>" +
        (substitutableIdx>=0 ? "<button type=\"button\" class=\"btn\" id=\"mdSubstitute\">↻ Substituir alimento</button>" : "") +
        (profile.freeMealEnabled ? "<button type=\"button\" class=\"btn\" id=\"mdAdapt\"" + (m.adapted?" disabled":"") + ">🍴 " + (m.adapted ? "Refeição já adaptada" : "Adaptar refeição") + "</button>" : "") +
        (!m.done ? "<button type=\"button\" class=\"btn\" id=\"mdReschedule\">🕐 Alterar horário</button>" : "") +
        (!m.done && m.status !== "skipped" ? "<button type=\"button\" class=\"btn\" id=\"mdSkip\">○ Não vou fazer esta refeição</button>" : "") +
        (mealHasRevertible(m) ? "<button type=\"button\" class=\"btn\" id=\"mdRevert\">↺ Repor plano original</button>" : "") +
      "</div>";
    sheet.innerHTML = "<div class=\"mclose\"><button type=\"button\" aria-label=\"Fechar\">✕</button></div>" + html;
    sheet.querySelector(".mclose button").addEventListener("click", closeModal);

    sheet.querySelectorAll(".food-item[data-fidx]").forEach(function(el){
      el.addEventListener("click", function(){
        var fi = parseInt(el.getAttribute("data-fidx"),10);
        openFoodUnavailable(s, m, fi, idx);
      });
    });
    var completeBtn = sheet.querySelector("#mdComplete");
    if (completeBtn) completeBtn.addEventListener("click", function(){
      m.done = !m.done;
      var wasCompleted = m.done;
      commitMealView(s, m);
      render();
      renderAlunoTab(s);
      persistStudent(s);
      if (wasCompleted) showToast("✓ " + m.name + " concluído");
    });
    var subBtn = sheet.querySelector("#mdSubstitute");
    if (subBtn) subBtn.addEventListener("click", function(){
      openSubstitution(m.foods[substitutableIdx], function(chosen){
        applySubstitution(s, m, substitutableIdx, chosen);
        commitMealView(s, m);
        renderAlunoTab(s);
        persistStudent(s);
        showToast("Refeição adaptada");
        openMealDetail(s, idx);
      }, s, m);
    });
    var adaptBtn = sheet.querySelector("#mdAdapt");
    if (adaptBtn) adaptBtn.addEventListener("click", function(){
      m.adapted = true;
      logAdaptation(s, m, "adaptacao", {reason:"Adaptação manual"});
      commitMealView(s, m);
      render();
      renderAlunoTab(s);
      persistStudent(s);
      showToast("Refeição adaptada");
    });
    var rescheduleBtn = sheet.querySelector("#mdReschedule");
    if (rescheduleBtn) rescheduleBtn.addEventListener("click", function(){ openReschedule(s, m, idx); });
    var skipBtn = sheet.querySelector("#mdSkip");
    if (skipBtn) skipBtn.addEventListener("click", function(){ openSkipMeal(s, m, idx); });
    var revertBtn = sheet.querySelector("#mdRevert");
    if (revertBtn) revertBtn.addEventListener("click", function(){
      revertMeal(m);
      commitMealView(s, m);
      render();
      renderAlunoTab(s);
      persistStudent(s);
      showToast("Plano original reposto");
    });
  }

  var sheet = openModal("");
  render();
}

function openFoodUnavailable(s, m, fi, idx){
  var f = m.foods[fi];
  var profile = computeFlexibilityProfile(s);
  var html = "<div class=\"mtitle\">Não tenho " + escapeHtml(f.name) + "</div>" +
    "<p class=\"muted-p\" style=\"margin-bottom:14px;\">O que queres fazer?</p>" +
    "<div style=\"display:flex; flex-direction:column; gap:8px;\">" +
      "<button type=\"button\" class=\"btn primary\" id=\"fuSubstitute\" style=\"width:100%;\">Substituir por outro alimento</button>" +
      (profile.freeMealEnabled ? "<button type=\"button\" class=\"btn\" id=\"fuAdapt\" style=\"width:100%;\">Adaptar a refeição</button>" : "") +
    "</div>";
  var sheet = openModal(html);
  sheet.querySelector("#fuSubstitute").addEventListener("click", function(){
    openSubstitution(f, function(chosen){
      applySubstitution(s, m, fi, chosen);
      commitMealView(s, m);
      renderAlunoTab(s);
      persistStudent(s);
      showToast("Refeição adaptada");
      openMealDetail(s, idx);
    }, s, m);
  });
  var adaptBtn = sheet.querySelector("#fuAdapt");
  if (adaptBtn) adaptBtn.addEventListener("click", function(){
    m.adapted = true;
    logAdaptation(s, m, "adaptacao", {reason:"Alimento indisponível: " + f.name});
    commitMealView(s, m);
    renderAlunoTab(s);
    persistStudent(s);
    showToast("Refeição adaptada");
    openMealDetail(s, idx);
  });
}

function openReschedule(s, m, idx){
  var html = "<div class=\"mtitle\">Alterar horário</div>" +
    "<p class=\"muted-p\" style=\"margin-bottom:14px;\">Planeado: " + escapeHtml(m.time) + "</p>" +
    "<div class=\"checkin-field\"><label for=\"rescheduleTime\">Novo horário</label><input type=\"time\" id=\"rescheduleTime\" value=\"" + escapeHtml(effectiveMealTime(m)) + "\"></div>" +
    "<button type=\"button\" class=\"btn primary\" id=\"rescheduleConfirm\" style=\"width:100%;\">Confirmar</button>";
  var sheet = openModal(html);
  sheet.querySelector("#rescheduleConfirm").addEventListener("click", function(){
    var val = sheet.querySelector("#rescheduleTime").value;
    if (val) rescheduleMeal(s, m, val);
    commitMealView(s, m);
    renderAlunoTab(s);
    persistStudent(s);
    showToast("Horário atualizado");
    openMealDetail(s, idx);
  });
}

function openSkipMeal(s, m, idx){
  var html = "<div class=\"mtitle\">Ignorar " + escapeHtml(m.name) + "?</div>" +
    "<p class=\"muted-p\" style=\"margin-bottom:14px;\">Sem problema — o resto do teu dia continua válido. Não precisas de compensar esta refeição mais tarde.</p>" +
    "<button type=\"button\" class=\"btn primary\" id=\"skipConfirm\" style=\"width:100%; margin-bottom:8px;\">Confirmar</button>" +
    "<button type=\"button\" class=\"btn\" id=\"skipCancel\" style=\"width:100%;\">Cancelar</button>";
  var sheet = openModal(html);
  sheet.querySelector("#skipConfirm").addEventListener("click", function(){
    skipMeal(s, m);
    commitMealView(s, m);
    renderAlunoTab(s);
    persistStudent(s);
    showToast(m.name + " marcada como ignorada");
    closeModal();
  });
  sheet.querySelector("#skipCancel").addEventListener("click", function(){ openMealDetail(s, idx); });
}

/* ===================== ALUNO RENDER ===================== */
var alunoRoot = document.getElementById("alunoApp");

function consumedTotals(student){
  var t = {kcal:0,p:0,c:0,f:0};
  student.meals.forEach(function(m){
    if (!mealCountsToday(m)) return;
    var mt = resolvedMealTotals(student, m);
    t.kcal+=mt.kcal; t.p+=mt.p; t.c+=mt.c; t.f+=mt.f;
  });
  return t;
}

// o profissional vê a app como o aluno a vê, mas o que registar fica na ficha desse aluno: avisa-se (sem bloquear)
function previewBannerHtml(s){
  return "<div class=\"preview-banner\" id=\"previewBanner\" role=\"note\"><span aria-hidden=\"true\">👁</span><span>A ver como <strong>" + escapeHtml(s.name) + "</strong>. O que registares fica guardado na ficha de " + escapeHtml(s.name.split(" ")[0]) + ".</span></div>";
}
function renderAlunoShell(){
  var s = findStudent(state.alunoStudentId);
  if (!s) return;
  ensureSyncBaseline(s); // antes de qualquer alteração do dia
  ensureFreshDay(s);
  var showSwitcher = authRole !== "student";
  var optsHtml = showSwitcher ? STUDENTS.map(function(st){ return "<option value=\"" + st.id + "\"" + (st.id===s.id?" selected":"") + ">" + escapeHtml(st.name) + "</option>"; }).join("") : "";
  var dateLine = "";
  try { dateLine = new Date().toLocaleDateString("pt-PT", {weekday: "long", day: "numeric", month: "long"}); dateLine = dateLine.charAt(0).toUpperCase() + dateLine.slice(1); } catch (e) { dateLine = ""; }
  // o ecrã de treino é uma etapa de "Hoje": o separador Hoje fica aceso
  var activeTab = state.alunoTab === "treino" ? "hoje" : state.alunoTab;
  var icon = function(paths){ return "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\">" + paths + "</svg>"; };
  alunoRoot.innerHTML =
    (showSwitcher ? previewBannerHtml(s) : "") +
    "<div class=\"phone-header\">" +
      "<div><div class=\"greet\">Olá, " + escapeHtml(s.name.split(" ")[0]) + "</div>" + (dateLine ? "<div class=\"sub\">" + escapeHtml(dateLine) + "</div>" : "") + "</div>" +
      (showSwitcher ? "<select class=\"student-switch\" id=\"alunoStudentSwitch\" aria-label=\"Pré-visualizar como\">" + optsHtml + "</select>" : "") +
    "</div>" +
    "<div class=\"aluno-tabs\" id=\"alunoTabContent\"></div>" +
    "<div class=\"tabbar\">" +
      "<button data-tab=\"hoje\" aria-label=\"Hoje\">" + icon("<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M8 12.5l2.7 2.7L16 9.5\"/>") + "<span>Hoje</span></button>" +
      "<button data-tab=\"plano\" aria-label=\"Plano de alimentação e treino\">" + icon("<path d=\"M9 6h12M9 12h12M9 18h12\"/><path d=\"M4 6h.01M4 12h.01M4 18h.01\"/>") + "<span>Plano</span></button>" +
      "<button data-tab=\"evolucao\" aria-label=\"Progresso\">" + icon("<path d=\"M3 17l6-6 4 4 8-8\"/><path d=\"M15 7h6v6\"/>") + "<span>Progresso</span></button>" +
    "</div>";
  var switcherEl = document.getElementById("alunoStudentSwitch");
  if (switcherEl) switcherEl.addEventListener("change", function(e){
    state.alunoStudentId = e.target.value; renderAlunoShell();
  });
  alunoRoot.querySelectorAll(".tabbar button").forEach(function(btn){
    if (btn.getAttribute("data-tab")===activeTab) btn.classList.add("active");
    btn.addEventListener("click", function(){
      state.alunoTab = btn.getAttribute("data-tab");
      state.ciOpen = false;
      renderAlunoShell();
      try { window.scrollTo(0, 0); } catch (e) {}
    });
  });
  renderAlunoTab(s);
}

// o separador é redesenhado em quase todas as ações: guarda que secções estavam abertas e o que estava escrito no check-in
function captureTabUi(el){
  var keep = {open: {}, fields: {}};
  el.querySelectorAll("details").forEach(function(d){
    var sm = d.querySelector("summary");
    keep.open[(d.id || "") + "|" + (sm ? sm.textContent.trim() : "")] = !!d.open;
  });
  el.querySelectorAll("[id^=ci]").forEach(function(f){ if (f.id && "value" in f) keep.fields[f.id] = f.value; });
  return keep;
}
function restoreTabUi(el, keep){
  if (!keep) return;
  el.querySelectorAll("details").forEach(function(d){
    var sm = d.querySelector("summary"), k = (d.id || "") + "|" + (sm ? sm.textContent.trim() : "");
    if (k in keep.open && keep.open[k]) d.open = true;
  });
  var ciOpen = keep.open["ciDetails|Check-in semanal Por fazer"] || keep.open["ciDetails|Check-in semanal Em dia"] || keep.open["ciDetails|Check-in semanal Ainda por fazer"];
  Object.keys(keep.fields).forEach(function(id){
    var f = el.querySelector("#" + id);
    if (!f || f.value === keep.fields[id]) return;
    f.value = keep.fields[id];
    var v = el.querySelector("#" + id + "Val");
    if (v) v.textContent = f.value;
    if (f.type === "range" && f.style && f.style.setProperty) f.style.setProperty("--p", rangeFill(f.value) + "%");
  });
}
function renderAlunoTab(s){
  var el = document.getElementById("alunoTabContent");
  var keep = captureTabUi(el);
  var sv = studentView(s); // leitura: meals já combinado com o estado do dia
  if (state.alunoTab==="hoje") el.innerHTML = tplHoje(sv);
  else if (state.alunoTab==="plano") el.innerHTML = tplPlanoTabs(sv);
  else if (state.alunoTab==="treino") el.innerHTML = tplTreinoScreen(sv);
  else {
    el.innerHTML = tplEvolucaoAluno(sv, {editable:false}); // Progresso: a evolução (o check-in semanal foi retirado: o profissional vê o aluno 2-3 vezes por semana)
    lazyPhotos(s, function(){ if (state.alunoStudentId === s.id && state.alunoTab === "evolucao" && !modalRoot.firstChild) renderAlunoTab(s); });
  }
  restoreTabUi(el, keep);
  wireAlunoTab(s); // escrita: sempre sobre o student real, nunca sobre a vista
}

// ---------- blocos de UI partilhados (design premium) ----------
function tabHead(title, sub){
  return "<div class=\"tab-head\"><h2>" + title + "</h2>" + (sub ? "<p>" + sub + "</p>" : "") + "</div>";
}
function kpiTile(label, value, unit, prev, goodWhen, digits, comma){
  var fmt = function(x){ var s = Number(x).toFixed(digits); return comma ? s.replace(".", ",") : s; };
  var d = (prev==null || value==null) ? null : value - prev;
  var cls = "flat", txt = "";
  if (d!=null){
    if (Math.abs(d) < Math.pow(10,-digits)/2){ txt = "sem alteração"; }
    else {
      var good = goodWhen==="down" ? d<0 : d>0;
      cls = good ? "good" : "bad";
      txt = (d<0?"▼ ":"▲ ") + fmt(Math.abs(d)) + " " + unit;
    }
  }
  return "<div class=\"kpi\"><div class=\"l\">" + label + "</div>" +
    "<div class=\"v num\">" + (value==null ? "—" : fmt(value)) + (value!=null && unit ? "<small>" + unit + "</small>" : "") + "</div>" +
    (txt ? "<div class=\"d " + cls + "\">" + txt + "</div>" : "") + "</div>";
}
function barsChart(items, max, extraCls){
  return "<div class=\"bars " + (extraCls||"") + "\">" + items.map(function(it){
    return "<div class=\"b\"><span>" + it.value + "</span><i style=\"height:" + Math.max(6, Math.round(it.value/max*100)) + "%\"></i></div>";
  }).join("") + "</div>" +
  "<div class=\"bar-labels\">" + items.map(function(it){ return "<span>" + it.label + "</span>"; }).join("") + "</div>";
}
// Peso atual + progresso até à meta (Resumo)
function tplProgressHero(s){
  if (s.weightCurrent==null) return "";
  var diff = s.weightCurrent - s.weightInitial;
  var hasGoal = s.weightGoal && s.weightGoal !== s.weightInitial;
  var pct = hasGoal ? Math.max(0, Math.min(100, Math.round(((s.weightCurrent - s.weightInitial) / (s.weightGoal - s.weightInitial)) * 100))) : null;
  var towardGoal = hasGoal ? ((s.weightGoal - s.weightInitial) * diff >= 0) : true;
  return "<div class=\"card\">" +
    "<div class=\"eyebrow\">Peso atual</div>" +
    "<div class=\"hero-row\"><div class=\"hero-num\">" + s.weightCurrent.toFixed(1) + "<small>kg</small></div>" +
      (Math.abs(diff) >= 0.05 ? "<span class=\"pill " + (towardGoal ? "good" : "warn") + "\">" + (diff<0?"▼ ":"▲ ") + Math.abs(diff).toFixed(1) + " kg desde o início</span>" : "") +
    "</div>" +
    (hasGoal ?
      "<div class=\"bar-track\" style=\"margin-top:16px;\"><div class=\"bar-fill\" style=\"width:" + pct + "%\"></div></div>" +
      "<div style=\"display:flex; justify-content:space-between; font-size:0.74rem; color:var(--muted); margin-top:8px; font-weight:600;\">" +
        "<span class=\"num\">" + s.weightInitial + " kg</span><span style=\"color:var(--accent-strong);\">" + pct + "% da meta</span><span class=\"num\">" + s.weightGoal + " kg</span></div>" : "") +
  "</div>";
}
// Metas diárias de calorias e macros (Alimentação)
function tplTargetsCard(s){
  var t = s.targets || {};
  if (!t.kcal) return "";
  function mac(label, v, mn, mx){
    var txt = v!=null ? Math.round(v) : (mn!=null && mx!=null ? Math.round(mn) + "–" + Math.round(mx) : "—");
    return "<div class=\"kpi\"><div class=\"l\">" + label + "</div><div class=\"v num\">" + txt + "<small>g</small></div></div>";
  }
  return "<div class=\"card\"><div class=\"eyebrow\">Meta diária</div>" +
    "<div class=\"hero-num\" style=\"margin-top:6px;\">" + Math.round(t.kcal) + "<small>kcal</small></div>" +
    "<div class=\"macro-target-row\">" + mac("Proteína", t.protein, t.proteinMin, t.proteinMax) + mac("Hidratos", t.carbs, t.carbsMin, t.carbsMax) + mac("Gordura", t.fat, t.fatMin, t.fatMax) + "</div></div>";
}
// Semana de treino + treinos/adesão dos últimos check-ins (Treino)
function tplTrainingOverview(s){
  var html = "";
  var names = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  var meta = [];
  if (s.trainingType) meta.push(escapeHtml(s.trainingType));
  if (s.trainingsPerWeek) meta.push(s.trainingsPerWeek + "× por semana");
  if (s.trainingTime && s.trainingTime !== "—") meta.push(escapeHtml(s.trainingTime));
  var hasDays = !!(s.trainingDays && s.trainingDays.length);
  if (hasDays || meta.length){
    html += "<div class=\"card\"><div class=\"eyebrow\">Semana de treino</div>" +
      (meta.length ? "<p class=\"muted-p\" style=\"margin-top:6px;\">" + meta.join(" · ") + "</p>" : "") +
      (!hasDays ? "<p class=\"muted-p\" style=\"margin-top:8px;\">Dias de treino por definir.</p>" : "") +
      (hasDays ? "<div class=\"week-chips\">" + [1,2,3,4,5,6,0].map(function(d){
        var on = s.trainingDays.indexOf(d) !== -1;
        return "<div class=\"week-chip" + (on?" on":"") + "\">" + names[d] + "<i></i></div>";
      }).join("") + "</div>" : "") + "</div>";
  }
  var recent = (s.checkins||[]).slice(-6);
  if (recent.length){
    var avgW = recent.reduce(function(a,c){ return a + (c.workouts||0); }, 0) / recent.length;
    var avgA = recent.reduce(function(a,c){ return a + (c.adherence||0); }, 0) / recent.length;
    var maxW = Math.max(s.trainingsPerWeek || 0, Math.max.apply(null, recent.map(function(c){ return c.workouts||0; })), 1);
    html += "<div class=\"card\"><div class=\"eyebrow\">Treinos por semana</div>" +
      "<div class=\"hero-row\"><div class=\"hero-num\">" + avgW.toFixed(1) + "<small>em média" + (s.trainingsPerWeek ? " / " + s.trainingsPerWeek : "") + "</small></div></div>" +
      barsChart(recent.map(function(c){ return {label:fmtDatePt(c.date), value:c.workouts||0}; }), maxW) + "</div>";
    html += "<div class=\"card\"><div class=\"eyebrow\">Adesão ao plano</div>" +
      "<div class=\"hero-row\"><div class=\"hero-num\">" + avgA.toFixed(1) + "<small>/ 10 em média</small></div></div>" +
      barsChart(recent.map(function(c){ return {label:fmtDatePt(c.date), value:c.adherence||0}; }), 10, "info") + "</div>";
  }
  return html;
}
// Composição corporal: última avaliação vs anterior (Avaliação)
// massa gorda / massa magra em kg de uma avaliação (null se faltar o peso ou a % de gordura)
function fatMassKg(a){ return a && a.weight > 0 && a.bodyFat > 0 ? Math.round(a.weight * a.bodyFat) / 100 : null; }
function leanMassKg(a){ var f = fatMassKg(a); return f == null ? null : Math.round((a.weight - f) * 10) / 10; }

// as duas avaliações mais recentes em que a métrica foi medida (> 0): uma visita só com perímetros não conta
function lastTwoWith(list, valueOf){
  var out = [];
  for (var i = 0; i < list.length && out.length < 2; i++){ var v = valueOf(list[i]); if (v != null && v > 0) out.push({a: list[i], v: v}); }
  return out;
}
function tplAssessKpis(s){
  var list = (s.assessments||[]).slice().sort(function(x, y){ return compareAssessmentsDesc(x, y); });
  if (!list.length) return "";
  function tile(label, unit, good, digits, valueOf){
    var two = lastTwoWith(list, valueOf);
    return two.length ? kpiTile(label, two[0].v, unit, two[1] ? two[1].v : null, good, digits) : "";
  }
  var html = "<div class=\"kpi-grid\">" +
    tile("Massa gorda", "%", "down", 1, function(a){ return a.bodyFat; }) +
    tile("Massa muscular", "kg", "up", 1, function(a){ return a.muscle; }) +
    tile("Visceral", "", "down", 0, function(a){ return a.visceral; }) +
    tile("Água", "%", "up", 1, function(a){ return a.water; }) +
    tile("Massa gorda (kg)", "kg", "down", 1, fatMassKg) +
    tile("Massa magra (kg)", "kg", "up", 1, leanMassKg) +
  "</div>";
  return html.indexOf("class=\"kpi\"") >= 0 ? html : "";
}

function deltaPt(curr, prev){ return assessDelta(curr, prev, "").replace(/(\d)\.(\d)/g, "$1,$2"); }
// valor anterior de uma medida: a primeira avaliação mais antiga (a lista vem da mais recente para a mais antiga) em que existe
function previousMeasure(list, idx, valueOf){
  for (var j = idx + 1; j < list.length; j++){ var v = valueOf(list[j]); if (v > 0) return v; }
  return null;
}
// a avaliação mais recente em que todas as chaves estão medidas
function latestAssessmentWith(list, keys){
  for (var i = 0; i < list.length; i++) if (keys.every(function(k){ return posNum(list[i][k]) > 0; })) return list[i];
  return null;
}
// Perímetros: razões de risco + tabela por zona do corpo (as últimas 4 medições) com a variação face à medição anterior
function tplPerimetersCard(s){
  var list = (s.assessments || []).filter(function(a){ return a && PERIMETER_FIELDS.some(function(f){ return posNum(a[f[0]]) > 0; }); })
    .sort(function(x, y){ return compareAssessmentsDesc(x, y); });
  if (!list.length) return "";
  var sexKey = sexKeyOf(s.sex);
  // os limiares da OMS/IDF e do NICE são para adultos: nos menores de 18 anos só se mostram os números; sem o sexo, não se classifica a cintura nem a razão cintura/anca
  var age = ageAtDate(s, todayISO()), adult = !(age > 0) || age >= 18;
  var noClass = !adult ? "classificação só para adultos (≥ 18 anos)" : null;
  var noSexClass = noClass || (!sexKey ? "classificação indisponível sem o sexo definido" : null); // neutro: nem o aluno nem o profissional podem alterar o sexo depois do registo
  var tiles = [];
  var forWaist = latestAssessmentWith(list, ["waist"]);
  if (forWaist){
    var wc = posNum(forWaist.waist), risk = noSexClass ? null : waistRiskLevel(sexKey, roundReading(wc)); // classifica o valor que se mostra (1 casa)
    tiles.push(kpiTileText("Cintura", ptNum(wc, 1) + "<small> cm</small>", risk == null ? "flat" : (risk === 0 ? "good" : "bad"),
      risk == null ? noSexClass : (risk === 0 ? "sem risco acrescido" : (risk === 1 ? "risco aumentado" : "risco substancialmente aumentado"))));
  }
  var forWhr = latestAssessmentWith(list, ["waist", "hip"]);
  if (forWhr){
    var whr = Math.round(posNum(forWhr.waist) / posNum(forWhr.hip) * 100) / 100, limit = sexKey === "M" ? 0.90 : 0.85; // classifica o valor que se mostra (2 casas)
    tiles.push(noSexClass ? kpiTileText("Cintura / anca", ptNum(whr, 2), "flat", noSexClass)
      : kpiTileText("Cintura / anca", ptNum(whr, 2), whr >= limit ? "bad" : "good", whr >= limit ? "a partir de " + ptNum(limit, 2) + ": risco aumentado" : "abaixo de " + ptNum(limit, 2)));
  }
  if (forWaist && posNum(s.height) > 0){
    var whtr = Math.round(posNum(forWaist.waist) / posNum(s.height) * 100) / 100;
    // NICE NG246: < 0,40 sem categoria (ler com o IMC e a composição corporal); 0,40–0,49 saudável; 0,50–0,59 aumentado; ≥ 0,60 elevado
    tiles.push(noClass ? kpiTileText("Cintura / altura", ptNum(whtr, 2), "flat", noClass)
      : kpiTileText("Cintura / altura", ptNum(whtr, 2), whtr < 0.4 ? "flat" : (whtr < 0.5 ? "good" : "bad"),
        whtr < 0.4 ? "valor baixo: ler com o IMC e a composição corporal" : (whtr < 0.5 ? "saudável (< 0,50)" : (whtr < 0.6 ? "adiposidade central aumentada" : "adiposidade central elevada"))));
  }
  var html = "<div class=\"card\"><div class=\"eyebrow\">Perímetros</div>";
  if (tiles.length) html += "<div class=\"kpi-grid\">" + tiles.join("") + "</div>";
  var cols = list.slice(0, 4);
  var rows = PERIMETER_FIELDS.filter(function(f){ return cols.some(function(a){ return posNum(a[f[0]]) > 0; }); });
  html += "<div class=\"assess-table-scroll\"><table class=\"assess-table\"><thead><tr><th>Perímetro (cm)</th>" + cols.map(function(a){ return "<th>" + fmtDateFullPt(a.date) + "</th>"; }).join("") + "</tr></thead><tbody>";
  PERIMETER_GROUPS.forEach(function(g, gi){
    var inGroup = rows.filter(function(f){ return f[3] === gi; });
    if (!inGroup.length) return;
    html += "<tr><td colspan=\"" + (cols.length + 1) + "\" class=\"assess-group\">" + g + "</td></tr>";
    inGroup.forEach(function(f){
      html += "<tr><td class=\"date-cell\">" + f[1] + "</td>" + cols.map(function(a, i){
        var v = posNum(a[f[0]]);
        var prev = v && i === 0 ? previousMeasure(list, i, function(x){ return posNum(x[f[0]]); }) : null; // variação só na medição mais recente
        return "<td>" + (v ? ptNum(v, 1) : "—") + (prev ? deltaPt(v, prev) : "") + "</td>";
      }).join("") + "</tr>";
    });
  });
  html += "</tbody></table></div>";
  if (cols.some(function(a){ return a.reads && typeof a.reads === "object" && Object.keys(a.reads).length; })) html += "<p class=\"muted-p\" style=\"margin-top:10px;\">Os valores com várias leituras são a média de 2 ou a mediana de 3.</p>";
  var diffs = PERIMETER_PAIRS.map(function(p){
    var a = latestAssessmentWith(list, [p[0], p[1]]);
    return a ? p[2] + " " + ptNum(Math.abs(posNum(a[p[0]]) - posNum(a[p[1]])), 1) + " cm" : null;
  }).filter(Boolean);
  if (diffs.length) html += "<p class=\"muted-p\" style=\"margin-top:10px;\">Diferença entre o lado direito e o esquerdo (última medição): " + diffs.join(" · ") + ".</p>";
  return html + "</div>";
}

// Pregas cutâneas: % de gordura pelo protocolo escolhido, massa gorda/magra, soma das pregas e tabela por prega (as últimas 4 medições)
function tplSkinfoldsCard(s, opts){
  var list = (s.assessments || []).filter(function(a){ return a && skinfoldValuesOf(a); }).sort(function(x, y){ return compareAssessmentsDesc(x, y); });
  if (!list.length) return "";
  var results = list.map(function(a){ return skinfoldResult(s, a); });
  var r0 = results[0], sexKey = r0.sexKey;
  // só se compara com medições feitas com o mesmo protocolo (e, por isso, as mesmas pregas)
  function prevSame(valueOf){
    for (var j = 1; j < list.length; j++) if (results[j] && results[j].protocol === r0.protocol && results[j].sexKey === r0.sexKey){ var v = valueOf(list[j], results[j]); if (v != null) return v; }
    return null;
  }
  function kgOf(a, r, lean){
    var w = weightForAssessment(s, a);
    if (!r || r.bodyFat == null || !w) return null;
    var fat = Math.round(w * r.bodyFat) / 100;
    return lean ? Math.round((w - fat) * 10) / 10 : fat;
  }
  var tiles = [];
  if (r0.protocol && r0.sum != null) tiles.push(kpiTile("Σ " + r0.sites.length + " pregas", r0.sum, "mm", prevSame(function(a, r){ return r.sum; }), "down", 1, true));
  if (r0.bodyFat != null){
    tiles.push(kpiTile("% gordura (pregas)", r0.bodyFat, "%", prevSame(function(a, r){ return r.bodyFat; }), "down", 1, true));
    var fat0 = kgOf(list[0], r0, false), lean0 = kgOf(list[0], r0, true);
    if (fat0 != null){
      tiles.push(kpiTile("Massa gorda (pregas)", fat0, "kg", prevSame(function(a, r){ return kgOf(a, r, false); }), "down", 1, true));
      tiles.push(kpiTile("Massa magra (pregas)", lean0, "kg", prevSame(function(a, r){ return kgOf(a, r, true); }), "up", 1, true));
    }
  }
  // áreas do braço: precisam do perímetro do braço relaxado e da tricipital na mesma avaliação
  var armIdx = -1;
  for (var i = 0; i < list.length; i++) if (posNum(list[i].arm) > 0 && posNum(list[i].skinfolds && list[i].skinfolds.triceps) > 0 && sexKey){ armIdx = i; break; }
  if (armIdx >= 0){
    var areas = function(a){ return armAreas(posNum(a.arm), posNum(a.skinfolds.triceps), sexKey); };
    var cur = areas(list[armIdx]), prevArea = null;
    for (var k = armIdx + 1; k < list.length; k++) if (posNum(list[k].arm) > 0 && posNum(list[k].skinfolds && list[k].skinfolds.triceps) > 0){ prevArea = areas(list[k]); break; }
    tiles.push(kpiTile("Área muscular do braço", cur.muscle, "cm²", prevArea ? prevArea.muscle : null, "up", 1, true));
    tiles.push(kpiTile("Área de gordura do braço", cur.fat, "cm²", prevArea ? prevArea.fat : null, "down", 1, true));
  }
  var html = "<div class=\"card\"><div class=\"eyebrow\">Pregas cutâneas</div>";
  if (r0.protocol) html += "<p class=\"muted-p\" style=\"margin-top:6px;\">Protocolo: <b>" + r0.label + "</b>" + (opts && opts.editable && r0.bodyFat != null && r0.age >= 18 && bodyFatCategory(sexKey, r0.bodyFat) ? " · " + bodyFatCategory(sexKey, r0.bodyFat) + " (ACE)" : "") /* a categoria é para o profissional: ao aluno mostram-se os números e a tendência */ + "</p>";
  if (tiles.length) html += "<div class=\"kpi-grid\">" + tiles.join("") + "</div>";
  if (opts && opts.editable) r0.warnings.forEach(function(w){ html += "<p class=\"muted-p\" style=\"margin-top:8px; color:var(--warn);\">⚠ " + escapeHtml(w) + "</p>"; }); // avisos de método: para quem mede
  var cols = list.slice(0, 4), rows = SKINFOLD_SITES.filter(function(site){ return cols.some(function(a){ return posNum(a.skinfolds[site[0]]) > 0; }); });
  html += "<div class=\"assess-table-scroll\"><table class=\"assess-table\"><thead><tr><th>Prega (mm)</th>" + cols.map(function(a){ return "<th>" + fmtDateFullPt(a.date) + "</th>"; }).join("") + "</tr></thead><tbody>";
  rows.forEach(function(site){
    html += "<tr><td class=\"date-cell\">" + site[1] + "</td>" + cols.map(function(a, i){
      var v = posNum(a.skinfolds[site[0]]);
      var prev = v && i === 0 ? previousMeasure(list, i, function(x){ return posNum(x.skinfolds && x.skinfolds[site[0]]); }) : null;
      return "<td>" + (v ? ptNum(v, 1) : "—") + (prev ? deltaPt(v, prev) : "") + "</td>";
    }).join("") + "</tr>";
  });
  html += "</tbody></table></div>";
  if (cols.some(function(a){ return a.sfReads && typeof a.sfReads === "object" && Object.keys(a.sfReads).length; })) html += "<p class=\"muted-p\" style=\"margin-top:10px;\">Os valores com várias leituras são a média de 2 ou a mediana de 3.</p>";
  // o erro de medição de cada prega ronda os 5 %: uma soma que varia menos do que isso pode ser só ruído
  var prevSum = prevSame(function(a, r){ return r.sum; });
  if (r0.sum != null && prevSum > 0 && Math.abs(r0.sum - prevSum) / prevSum < 0.05) html += "<p class=\"muted-p\" style=\"margin-top:10px;\">A soma das pregas variou menos de 5 %: pode ser apenas erro de medição, não uma mudança real.</p>";
  html += "<p class=\"muted-p\" style=\"margin-top:10px;\">" + (opts && opts.editable
    ? "Estimativa com erro típico de ±3–4 % de gordura: compara sempre medições do mesmo protocolo, feitas pela mesma pessoa e com o mesmo adipómetro. O que conta é a tendência, sobretudo a soma das pregas."
    : "Estimativa com margem de erro de ±3–4 %: o que conta é a tendência ao longo do tempo.") + "</p>";
  return html + "</div>";
}
function kpiTileText(label, value, cls, note){
  return "<div class=\"kpi\"><div class=\"l\">" + label + "</div><div class=\"v num\">" + value + "</div><div class=\"d " + cls + "\">" + note + "</div></div>";
}

// Gráfico de adesão: uma barra por check-in (últimos 8), vermelha abaixo do limiar de atenção
function tplAdherenceChart(s){
  var list = (s.checkins || []).slice(-8);
  if (!list.length) return "";
  var avg = list.reduce(function(a, c){ return a + (c.adherence || 0); }, 0) / list.length;
  return "<div class=\"card\"><div class=\"eyebrow\" style=\"margin-bottom:4px;\">Adesão por semana</div>" +
    "<p class=\"muted-p\" style=\"margin-bottom:6px;\">Média " + avg.toFixed(1).replace(".", ",") + "/10 nos últimos " + list.length + " check-ins · a vermelho: abaixo de " + SIGNAL_LOW_ADHERENCE + "</p>" +
    "<div class=\"bars\">" + list.map(function(c){
      var v = Number(c.adherence) || 0;
      return "<div class=\"b\"><span>" + v + "</span><i style=\"height:" + Math.max(6, v * 10) + "%;" + (v < SIGNAL_LOW_ADHERENCE ? " background:var(--critical);" : "") + "\"></i></div>";
    }).join("") + "</div>" +
    "<div class=\"bar-labels\">" + list.map(function(c){ return "<span>" + fmtDatePt(c.date) + "</span>"; }).join("") + "</div></div>";
}

/* ===================== AÇÃO DO DIA (aluno) =====================
   Ao abrir a app o aluno vê só o que tem para fazer hoje: o treino (Iniciar / Continuar / Feito) e as refeições, que se marcam com um toque. */
function plural(n, one, many){ return n + " " + (n === 1 ? one : many); }
function workoutDaysWithExercises(s){ return trainingProgramOf(s).days.filter(function(d){ return d.exercises.length; }); }
// treino proposto: o escolhido (state.workoutDayId) ou o que segue na rotação
function workoutDayFor(s){
  var days = workoutDaysWithExercises(s);
  if (!days.length) return null;
  var selected = days.filter(function(d){ return d.id === state.workoutDayId; })[0] || nextWorkoutDay(s) || days[0];
  return days.indexOf(selected) < 0 ? days[0] : selected;
}
function workoutSetCount(day){ return day.exercises.reduce(function(a, e){ return a + (parseInt(e.sets, 10) || 0); }, 0); }
function workoutDraftDone(s, day){
  var d = wlDraftGet(s, day.id), n = 0;
  day.exercises.forEach(function(e){ for (var i = 0; i < e.sets; i++){ var x = d.sets[e.id + ":" + i]; if (x && x.done) n++; } });
  return n;
}
// treino começado e por terminar (séries marcadas no rascunho): o mais recente
function workoutInProgress(s){
  var best = null;
  workoutDaysWithExercises(s).forEach(function(d){
    var n = workoutDraftDone(s, d), at = wlDraftGet(s, d.id).savedAt || 0;
    if (n > 0 && (!best || at > best.savedAt)) best = {day: d, done: n, savedAt: at};
  });
  return best;
}
function workoutLogsToday(s){ var t = todayISO(); return (s.workoutLogs || []).filter(function(l){ return l && l.date === t; }); }

function tplTodayWorkout(s){
  var inProg = workoutInProgress(s), day = inProg ? inProg.day : workoutDayFor(s);
  if (!day){
    return `<div class="card"><div class="eyebrow">Treino</div><p class="muted-p" style="margin-top:6px;">O teu programa de treino ainda está a ser preparado pelo profissional.</p></div>`;
  }
  var total = workoutSetCount(day), dayAttr = `data-day="${escapeHtml(day.id)}"`;
  if (inProg){
    return `<div class="card today-workout live"><div class="eyebrow">Treino em curso</div>` +
      `<div class="tw-name">${escapeHtml(day.name)}</div>` +
      `<div class="tw-progress"><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, Math.round(inProg.done / total * 100))}%"></div></div><span class="num">${inProg.done}/${total} séries</span></div>` +
      `<button type="button" class="btn primary big" id="startWorkout" ${dayAttr}>Continuar treino</button></div>`;
  }
  var logged = workoutLogsToday(s);
  if (logged.length){
    var last = logged[logged.length - 1], sets = (last.entries || []).reduce(function(a, e){ return a + ((e && e.sets) || []).length; }, 0);
    return `<div class="card today-workout complete"><div class="eyebrow">Treino de hoje</div>` +
      `<div class="tw-name"><span class="tw-tick" aria-hidden="true">✓</span>Feito${last.dayName ? " · " + escapeHtml(last.dayName) : ""}</div>` +
      `<p class="muted-p">${plural(sets, "série registada", "séries registadas")}${last.rpe ? " · esforço " + last.rpe + "/10" : ""}. Bom trabalho!</p>` +
      `<button type="button" class="btn" id="startWorkout" ${dayAttr}>Registar outro treino</button></div>`;
  }
  if (isTrainingDayToday(s) === false){
    return `<div class="card today-workout rest"><div class="eyebrow">Hoje</div><div class="tw-name">Dia de descanso</div>` +
      `<p class="muted-p">Hoje não tens treino marcado. Recupera bem. Próximo treino: <b>${escapeHtml(day.name)}</b>.</p>` +
      `<button type="button" class="btn" id="startWorkout" ${dayAttr}>Treinar mesmo assim</button></div>`;
  }
  var time = s.trainingTime && s.trainingTime !== "—" ? escapeHtml(s.trainingTime) : "";
  return `<div class="card today-workout"><div class="eyebrow">Treino de hoje${time ? " · " + time : ""}</div>` +
    `<div class="tw-name">${escapeHtml(day.name)}</div>` +
    `<p class="muted-p">${plural(day.exercises.length, "exercício", "exercícios")} · ${plural(total, "série", "séries")}</p>` +
    `<button type="button" class="btn primary big" id="startWorkout" ${dayAttr}>Iniciar treino</button></div>`;
}

// refeições por ordem de hora, cada uma com um botão grande para marcar como feita; a próxima fica destacada
function tplTodayMeals(s){
  var t = s.targets || {}, totals = consumedTotals(s);
  var order = s.meals.map(function(m, i){ return i; }).filter(function(i){ return s.meals[i].foods.length; }).sort(function(a, b){
    return (toMinutes(effectiveMealTime(s.meals[a])) || 0) - (toMinutes(effectiveMealTime(s.meals[b])) || 0) || a - b;
  });
  var planned = s.meals.filter(function(m){ return m.status !== "skipped" && m.foods.length; }); // uma refeição ainda vazia (o profissional está a montá-la) não aparece ao aluno
  var doneN = planned.filter(mealCountsToday).length;
  var nm = getNextMeal(s), nextIdx = nm && !nm.tomorrow ? s.meals.indexOf(nm.meal) : -1; // a mesma "próxima" que a assistente usa; depois da última refeição não há nenhuma
  var pct = t.kcal ? Math.min(100, Math.round((totals.kcal / t.kcal) * 100)) : 0;
  var html = `<div class="card today-meals"><div class="tm-head"><div class="eyebrow">Refeições de hoje</div><span class="tm-count num">${doneN}/${planned.length} feitas</span></div>`;
  if (t.kcal){
    html += `<div class="tm-kcal"><span class="num">${totals.kcal}</span><span class="tm-of">/ ${t.kcal} kcal</span></div>` +
      `<div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>`;
  }
  html += `<div class="tm-list">` + order.map(function(idx){
    var m = s.meals[idx], mt = resolvedMealTotals(s, m), icon = mealStatusIcon(m), counted = mealCountsToday(m);
    return `<div class="meal-row${idx === nextIdx ? " next" : ""}" data-midx="${idx}">` +
      `<button type="button" class="check-circle${m.done ? " done" : ""}${m.adapted ? " adapted" : ""}" data-circle="${idx}" aria-pressed="${counted ? "true" : "false"}" aria-label="${escapeHtml(m.name)}: marcar como feita">${icon}</button>` +
      `<div class="info"><div class="name">${escapeHtml(m.name)}</div><div class="time">${escapeHtml(effectiveMealTime(m))}${escapeHtml(mealRowSuffix(m))}${idx === nextIdx ? ` · <b class="tm-next">próxima</b>` : ""}</div></div>` +
      `<div class="kcal">${mt.kcal} kcal</div></div>`;
  }).join("") + `</div>`;
  html += `<details class="soft-details"><summary>Macros de hoje</summary><div class="macro-mini">` +
    macroMiniRow("Proteína", totals.p, t.protein, t.proteinMin, t.proteinMax) +
    macroMiniRow("Hidratos", totals.c, t.carbs, t.carbsMin, t.carbsMax) +
    macroMiniRow("Gordura", totals.f, t.fat, t.fatMin, t.fatMax) +
  `</div></details></div>`;
  return html;
}

function tplHoje(s){
  var html = tplTodayWorkout(s);
  if (noNutritionOf(s)) return html;   // faz a nutrição com outra pessoa: só treino
  if (!s.meals.length){
    return html + `<div class="card" style="text-align:center;">` +
      `<div class="eyebrow">Alimentação</div>` +
      `<div style="font-family:var(--display); font-weight:700; font-size:1.1rem; margin-top:8px;">O teu plano está a ser preparado</div>` +
      `<p class="muted-p" style="margin-top:8px;">O teu profissional já tem o teu questionário e vai definir o teu plano em breve.</p>` +
    `</div>`;
  }
  html += tplTodayMeals(s);
  var ciDays = computeLastCheckinDaysAgo(s);
  if (WEEKLY_CHECKIN_ENABLED && ciDays >= 7){
    html += `<div class="card ci-nudge"><div><div class="eyebrow">Check-in semanal</div><p class="muted-p" style="margin:4px 0 0;">${ciDays === 999 ? "Ainda não enviaste nenhum." : "O último foi " + daysAgoLabel(ciDays) + "."} Demora um minuto.</p></div>` +
      `<button type="button" class="btn" id="goCheckin">Fazer</button></div>`;
  }
  html += `<button type="button" class="btn ghost help-link" id="openAssistant">Precisas de ajuda com a alimentação?</button>`;
  return html;
}

function macroMiniRow(label, curr, target, min, max){
  if (target==null && min!=null && max!=null){
    var mid = (min+max)/2;
    var pct2 = Math.min(100, Math.round((curr/mid)*100));
    return "<div class=\"macro-mini-row\"><span class=\"lbl\">" + label + "</span>" +
      "<div class=\"bar-track\"><div class=\"bar-fill\" style=\"width:" + pct2 + "%\"></div></div>" +
      "<span class=\"amt\">" + Math.round(curr) + " / " + Math.round(min) + "–" + Math.round(max) + " g</span></div>";
  }
  var pct = target ? Math.min(100, Math.round((curr/target)*100)) : 0;
  return "<div class=\"macro-mini-row\"><span class=\"lbl\">" + label + "</span>" +
    "<div class=\"bar-track\"><div class=\"bar-fill\" style=\"width:" + pct + "%\"></div></div>" +
    "<span class=\"amt\">" + Math.round(curr) + " / " + Math.round(target) + " g</span></div>";
}

var TIER_LABEL = {estruturado:"Estruturado", equilibrado:"Equilibrado", flexivel:"Flexível"};
var TIER_HINT = {
  estruturado: "Segue esta refeição — toca num alimento para veres alternativas.",
  equilibrado: "Escolhe uma opção em cada grupo desta refeição.",
  flexivel: "Constrói a tua refeição dentro dos intervalos definidos."
};

function tplPlano(s){
  if (!s.meals.length){
    return "<div class=\"card\" style=\"text-align:center;\"><div class=\"eyebrow\">Plano</div>" +
      "<p class=\"muted-p\" style=\"margin-top:8px;\">O teu profissional ainda não construiu o teu plano alimentar.</p></div>";
  }
  var tier = flexTier(s.flexibility);
  var profile = computeFlexibilityProfile(s);
  var html = tabHead("Alimentação", "Nível " + TIER_LABEL[tier] + " · " + TIER_HINT[tier]);
  if (planReadyForExport(s)) html += "<div class=\"plano-actions\"><button type=\"button\" class=\"btn btn-sm\" id=\"exportPlanPdf\">⬇ Plano em PDF (imprimir)</button></div>";
  html += tplTargetsCard(s);
  var creatineIdx = breakfastMealIndex(s.meals);
  s.meals.forEach(function(m, idx){
    if (!m.foods.length) return; // refeição ainda vazia: só o profissional a vê
    var totals = resolvedMealTotals(s, m);
    html += "<div class=\"card plano-meal-card\">" +
      "<div class=\"plano-meal-head\"><span class=\"mname\">" + escapeHtml(m.name) + "</span><span class=\"mtime\">" + escapeHtml(m.time) + "</span></div>";
    if (profile.mealBuilderEnabled) html += tplMealBuilder(m, idx, s);
    else if (tier === "estruturado") html += tplMealFixed(m, idx, s);
    else html += tplMealChoice(m, idx, s);
    if (idx === creatineIdx) html += creatineLineHtml(s);
    html += "<div class=\"plano-meal-macros\">" + totals.kcal + " kcal · P " + totals.p + "g · H " + totals.c + "g · G " + totals.f + "g</div>";
    html += "</div>";
  });
  return html;
}

function tplMealFixed(m, idx, s){
  var canSwap = !s || computeFlexibilityProfile(s).substitutionsEnabled;
  return "<div>" + m.foods.map(function(f, fi){
    var swappable = f.group && canSwap;
    return "<div class=\"food-item\"" + (swappable ? " data-midx=\"" + idx + "\" data-fidx=\"" + fi + "\"" : "") + ">" +
      "<span class=\"fname\">" + escapeHtml(f.name) + "</span>" +
      "<span><span class=\"fqty\">" + escapeHtml(f.qty) + "</span>" + (swappable ? "<span class=\"swap-hint\">trocar</span>" : "") + "</span>" +
    "</div>";
  }).join("") + "</div>";
}

var INLINE_BUILDER_OPTIONS_MAX = 6;

function tplMealChoice(m, idx, s){
  ensureLiveChoiceDefaults(m, s);
  // Modo de segurança: com alergias/restrições em texto livre não mapeadas,
  // o construtor de refeições não pode oferecer escolha entre alimentos do
  // grupo — mostra o grupo de forma bloqueada, sem opções clicáveis, em vez
  // de recomendar alternativas potencialmente incompatíveis (ver
  // hasUnmappedDietaryRisk() e DIET_RISK_SAFE_MESSAGE).
  var locked = hasUnmappedDietaryRisk(s);
  var html = "";
  m.foods.forEach(function(f){
    if (!f.group){
      html += "<div class=\"food-item\"><span class=\"fname\">" + escapeHtml(f.name) + "</span><span class=\"fqty\">" + escapeHtml(f.qty) + "</span></div>";
      return;
    }
    if (locked){
      html += "<div class=\"builder-group\"><div class=\"gtitle\">" + groupLabel(f.group) + "</div>" +
        "<p class=\"muted-p\" style=\"margin:0 0 8px;\">" + escapeHtml(DIET_RISK_SAFE_MESSAGE) + "</p></div>";
      return;
    }
    var options = optionsFor(f, s);
    // Fase 16: a base do INSA pode tornar "options" muito maior do que cabe
    // como lista de rádios inline — mostra só as primeiras (mais a
    // escolhida atual, se estiver fora dessas), com "Ver mais" a abrir
    // pesquisa para o resto. data-oi continua sempre a indexar o array
    // completo "options", nunca o subconjunto mostrado.
    var selIdx = m.liveChoice[f.group];
    var shownIndices = [];
    for (var oi = 0; oi < options.length && shownIndices.length < INLINE_BUILDER_OPTIONS_MAX; oi++) shownIndices.push(oi);
    if (selIdx != null && selIdx >= 0 && options[selIdx] && shownIndices.indexOf(selIdx) === -1) shownIndices.push(selIdx);
    html += "<div class=\"builder-group\"><div class=\"gtitle\">" + groupLabel(f.group) + (f.required===false ? " — opcional" : " — escolhe 1") + "</div>";
    shownIndices.forEach(function(oi){
      var o = options[oi];
      var sel = selIdx===oi;
      html += "<div class=\"builder-opt" + (sel?" sel":"") + "\" data-midx=\"" + idx + "\" data-group=\"" + f.group + "\" data-oi=\"" + oi + "\"><span class=\"radio\"></span><span>" + escapeHtml(o.name) + " <span class=\"num\" style=\"color:var(--muted);\">(" + escapeHtml(o.qty) + ")</span></span></div>";
    });
    if (f.required===false){
      var noneSel = selIdx===-1;
      html += "<div class=\"builder-opt" + (noneSel?" sel":"") + "\" data-midx=\"" + idx + "\" data-group=\"" + f.group + "\" data-oi=\"-1\"><span class=\"radio\"></span><span>Nenhum (opcional)</span></div>";
    }
    if (options.length > shownIndices.length){
      html += "<button type=\"button\" class=\"btn btn-sm\" data-more-food-midx=\"" + idx + "\" data-more-food-group=\"" + f.group + "\" style=\"margin-top:4px;\">🔍 Ver mais alimentos (+" + (options.length - shownIndices.length) + ")</button>";
    }
    html += "</div>";
  });
  return html;
}

var MACRO_FEEDBACK = {
  p: {label:"proteína", low:"Falta proteína", high:"Tens mais proteína do que o habitual"},
  c: {label:"hidratos", low:"Falta um pouco de hidratos", high:"Reduz ligeiramente o hidrato"},
  f: {label:"gordura", low:"Falta um pouco de gordura", high:"Tens mais gordura do que o habitual"}
};

function builderFeedback(m, s){
  var base = foodsTotals(m.foods);
  var t = liveChoiceTotals(m, s);
  var msgs = [];
  ["p","c","f"].forEach(function(k){
    if (!base[k] || base[k] <= 0) return;
    if (t[k] < base[k]*0.7) msgs.push(MACRO_FEEDBACK[k].low);
    else if (t[k] > base[k]*1.3) msgs.push(MACRO_FEEDBACK[k].high);
  });
  return msgs;
}

function rangeTile(label, center){
  var lo = Math.max(0, Math.round(center*0.85));
  var hi = Math.round(center*1.15);
  return "<div class=\"f\"><label>" + label + "</label><div class=\"v num\">" + lo + "–" + hi + " g</div></div>";
}

function tplMealBuilder(m, idx, s){
  ensureLiveChoiceDefaults(m, s);
  var base = foodsTotals(m.foods);
  var html = "<div class=\"macro-target-grid\" style=\"margin-bottom:12px;\">" +
    rangeTile("Proteína", base.p) + rangeTile("Hidratos", base.c) + rangeTile("Gordura", base.f) +
  "</div>";
  var feedback = builderFeedback(m, s);
  if (feedback.length){
    html += "<div class=\"builder-feedback\" style=\"margin-bottom:12px;\">" +
      feedback.map(function(msg){ return "<p class=\"muted-p\" style=\"margin:0 0 4px;\">" + msg + "</p>"; }).join("") +
    "</div>";
  }
  return html + tplMealChoice(m, idx, s);
}

function tplCheckin(s){
  var days = computeLastCheckinDaysAgo(s), due = days >= 7;
  // treinos realizados: os registados nos últimos 7 dias (se ainda não há registos, o previsto no plano)
  var sessions7 = (s.workoutLogs || []).length ? sessionsInLastDays(s, 7).length : (s.trainingsPerWeek || 0);
  var html = "<details class=\"card ci-card\" id=\"ciDetails\"" + (state.ciOpen ? " open" : "") + ">" +
    "<summary class=\"ci-summary\"><span class=\"eyebrow\">Check-in semanal</span>" +
      (due ? "<span class=\"pill warn\">" + (days === 999 ? "Ainda por fazer" : "Por fazer") + "</span>" : "<span class=\"pill good\">Em dia</span>") + "</summary>" +
    "<div class=\"checkin-field\" style=\"margin-top:14px;\"><label for=\"ciWeight\">Peso atual (kg)</label><input type=\"number\" step=\"0.1\" min=\"0\" id=\"ciWeight\" value=\"" + s.weightCurrent + "\"></div>" +
    rangeField("ciHunger","Fome (1-10)",5) +
    rangeField("ciEnergy","Energia (1-10)",7) +
    rangeField("ciAdherence","Adesão ao plano (1-10)",8) +
    "<div class=\"checkin-field\"><label for=\"ciSleep\">Sono: horas por noite (média da semana)</label><input type=\"number\" step=\"0.5\" min=\"0\" max=\"14\" id=\"ciSleep\" value=\"7\"></div>" +
    rangeField("ciSleepQ","Qualidade do sono (1 = péssima, 10 = ótima)",7) +
    rangeField("ciDigestion","Digestão / conforto intestinal (1 = muito mau, 10 = ótimo)",7) +
    rangeField("ciStress","Stress (1-10)",4) +
    rangeField("ciRecovery","Recuperação / dores musculares (1 = muito cansado, 10 = ótima)",7) +
    "<div class=\"checkin-field\"><label for=\"ciWorkouts\">Treinos realizados</label><input type=\"number\" min=\"0\" id=\"ciWorkouts\" value=\"" + sessions7 + "\"></div>" +
    "<div class=\"checkin-field\"><label for=\"ciMealsOff\">Refeições fora do plano</label><input type=\"number\" min=\"0\" id=\"ciMealsOff\" value=\"0\"></div>" +
    "<div class=\"checkin-field\"><label for=\"ciNotes\">Dificuldades / observações</label><textarea id=\"ciNotes\" maxlength=\"2000\" placeholder=\"Opcional\"></textarea></div>" +
    "<p class=\"muted-p\" id=\"checkinError\" style=\"color:var(--critical); display:none; margin-bottom:10px;\"></p>" +
    "<button type=\"button\" class=\"btn primary big\" id=\"submitCheckin\">Enviar check-in</button>";
  var all = (s.checkins || []).slice().reverse();
  if (all.length){
    var row = function(c){ return "<div class=\"checkin-history-row\"><span>" + fmtDatePt(c.date) + "</span><span class=\"num\">" + c.weight + " kg · adesão " + c.adherence + "/10</span></div>"; };
    html += "<div class=\"eyebrow\" style=\"margin:18px 0 8px;\">Últimos check-ins</div>" + all.slice(0, 4).map(row).join("");
    if (all.length > 4) html += "<details class=\"soft-details\"><summary>Ver todos (" + all.length + ")</summary>" + all.slice(4).map(row).join("") + "</details>";
  }
  return html + "</details>";
}

// Plano: Alimentação | Treino (o seletor só aparece se há programa de treino)
/* ---------- Lista de compras por supermercado ----------
   A aluna escolhe onde vai comprar. Cada alimento é: "aqui" (marca própria desse supermercado, ligado a ele no catálogo, ou marca nacional que há em todo o lado),
   "noutra loja" (marca própria de outro supermercado: propõe-se o equivalente desta) ou genérico (propõe-se, se houver, um produto de marca própria parecido).
   A loja de uma marca própria deduz-se da marca (o catálogo quase não tem supermercados associados, a marca já o diz). */
var SHOP_STORES = ["Continente", "Pingo Doce", "Mercadona", "Auchan", "Lidl", "Aldi", "Intermarché"];
var STORE_BRANDS = {
  "Continente": ["continente", "equilibrio", "selecao"],
  "Pingo Doce": ["pingo doce"],
  "Mercadona": ["mercadona", "hacendado"],
  "Auchan": ["auchan"],
  "Lidl": ["lidl", "milbona", "sondey", "combino", "chef select", "solevita", "crownfield", "vemondo", "freshona", "alesto", "pilos", "italiamo", "dulano", "cien", "bio organic", "deluxe"],
  "Aldi": ["aldi", "milsani", "gutbio", "bellarom", "cucina"],
  "Intermarché": ["intermarche", "paturages", "chabrior", "top budget", "marque repere"]
};
function offWords(text){ return " " + String(text == null ? "" : text).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim() + " "; }
function shopBrandOf(name){ var m = String(name).replace(/\s·\s[^·]+$/, "").match(/\(([^()]+)\)\s*$/); return m ? m[1] : ""; }
// onde se compra este alimento: {kind: "explicit"|"own"|"any", stores: [...]}  ("any" = genérico ou marca nacional)
function storesOfFood(name){
  var ex = FOOD_RETAILERS[name];
  if (ex && ex.length) return {kind: "explicit", stores: ex.slice()};
  var suffix = String(name).match(/\s·\s([^·]+)$/);
  if (suffix) return {kind: "explicit", stores: [suffix[1].trim()]};
  var brand = offWords(shopBrandOf(name));
  if (brand.trim()){
    for (var i = 0; i < SHOP_STORES.length; i++){
      var tokens = STORE_BRANDS[SHOP_STORES[i]];
      for (var j = 0; j < tokens.length; j++) if (brand.indexOf(" " + tokens[j] + " ") >= 0) return {kind: "own", stores: [SHOP_STORES[i]]};
    }
  }
  return {kind: "any", stores: []};
}
var SHOP_STOPWORDS = {de: 1, da: 1, do: 1, com: 1, e: 1, em: 1, a: 1, o: 1, sem: 1, para: 1, ao: 1};
function shopNameTokens(name){
  var base = String(name).replace(/\s·\s[^·]+$/, "");
  var brand = shopBrandOf(base);
  if (brand && storesOfFood(name).kind !== "any") base = base.replace(/\([^()]+\)\s*$/, ""); // a marca própria não conta para comparar nomes
  return offWords(base).trim().split(" ").filter(function(w){ return w && !SHOP_STOPWORDS[w]; });
}
var storeIndexCache = {count: -1, byStore: {}};
function storeIndexFor(store){
  var n = Object.keys(FOOD_DB).length;
  if (storeIndexCache.count !== n) storeIndexCache = {count: n, byStore: {}};
  if (!storeIndexCache.byStore[store]){
    var list = [];
    Object.keys(FOOD_DB).forEach(function(name){
      var st = storesOfFood(name);
      if (st.kind !== "any" && st.stores.indexOf(store) >= 0 && FOOD_DB[name].per === "100g") list.push({name: name, tokens: shopNameTokens(name), group: resolveGroup(groupOfFood(name))});
    });
    storeIndexCache.byStore[store] = list;
  }
  return storeIndexCache.byStore[store];
}
// o produto de marca própria deste supermercado mais parecido (mesmo grupo, nome parecido, macros parecidos) com o alimento e a quantidade total pedidos
function storeSuggestion(store, it){
  var amount = it.grams > 0 ? it.grams : (it.ml > 0 ? it.ml : 0);
  var db = FOOD_DB[it.name];
  if (!(amount > 0) || !db || db.per !== "100g" || !(db.kcal > 0)) return null; // unidades e "à vontade" ficam como estão
  var tokens = shopNameTokens(it.name);
  if (!tokens.length) return null;
  var liquid = !(it.grams > 0), best = null;
  storeIndexFor(store).forEach(function(c){
    if (c.group !== it.group || c.name === it.name) return;
    var shared = tokens.filter(function(t){ return c.tokens.indexOf(t) >= 0; }).length;
    var overlap = shared / Math.max(tokens.length, c.tokens.length);
    if (!shared || overlap < 0.5) return;
    var cdb = FOOD_DB[c.name];
    if (!(cdb.kcal > 0)) return;
    var factor = db.kcal / cdb.kcal; // quantidade do produto da loja que dá as mesmas calorias
    var dist = substitutionDistance({name: it.name, qty: "100 g"}, {name: c.name, qty: Math.round(100 * factor) + " g"});
    if (dist > 0.35) return;
    var score = overlap - dist;
    if (!best || score > best.score) best = {score: score, name: c.name, factor: factor};
  });
  if (!best) return null;
  var scaled = amount * best.factor;
  return {name: best.name, qty: shopLine({name: best.name, grams: liquid ? 0 : scaled, ml: liquid ? scaled : 0, units: 0, free: false})};
}
function shopStoreInfo(store, it){
  var st = storesOfFood(it.name);
  if (st.kind !== "any") return st.stores.indexOf(store) >= 0 ? {status: "here"} : {status: "other", only: st.stores.join(", "), suggestion: storeSuggestion(store, it)};
  if (CATALOG_MERGED[it.name]) return {status: "here"}; // marca nacional do catálogo: há em todo o lado
  var sg = storeSuggestion(store, it);
  return sg ? {status: "generic", suggestion: sg} : {status: "generic"};
}

/* ---------- Lista de compras semanal ----------
   Soma, por alimento, o que o plano ativo pede em N dias (o plano repete-se todos os dias) e arredonda a embalagens inteiras quando se
   conhece o tamanho. Usa o plano e não a troca do dia (f.original). Os "comprados" ficam guardados neste telemóvel e recomeçam a cada semana. */
var SHOP_DAY_CHOICES = [3, 5, 7];
function shopWeekKey(){
  var d = new Date(); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // segunda-feira desta semana
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function shopStoreKey(s){ return "evolve_shop_v1:" + s.id + ":" + shopWeekKey(); }
function shopLoadChecked(s){
  try { var v = JSON.parse(localStorage.getItem(shopStoreKey(s)) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; }
}
function shopSaveChecked(s, checked){
  try {
    localStorage.setItem(shopStoreKey(s), JSON.stringify(checked));
    var prefix = "evolve_shop_v1:" + s.id + ":";
    for (var i = localStorage.length - 1; i >= 0; i--){ // semanas antigas já não servem
      var k = localStorage.key(i);
      if (k && k.indexOf(prefix) === 0 && k !== shopStoreKey(s)) localStorage.removeItem(k);
    }
  } catch (e) {}
}
function shopStoreKeyFor(s){ return "evolve_shop_store_v1:" + s.id; }
function shopStoreGet(s){
  var v = "";
  try { v = localStorage.getItem(shopStoreKeyFor(s)) || ""; } catch (e) {}
  return SHOP_STORES.indexOf(v) >= 0 ? v : "";
}
function shopStoreSet(s, store){
  try { if (store) localStorage.setItem(shopStoreKeyFor(s), store); else localStorage.removeItem(shopStoreKeyFor(s)); } catch (e) {}
}
// a lista em texto simples (para copiar para as notas ou enviar por mensagem), já com o supermercado escolhido
function shoppingListText(s, days, store){
  var lines = ["Lista de compras" + (store ? " — " + store : "") + " (" + days + " dias)"];
  shoppingListFor(s, days, store).forEach(function(g){
    lines.push("", g.label.toUpperCase());
    g.items.forEach(function(it){
      var sg = it.info && it.info.suggestion;
      if (sg && it.info.status === "other") lines.push("- " + sg.name + ": " + sg.qty + " (em vez de " + it.name + ")");
      else if (sg) lines.push("- " + it.name + ": " + it.qty + " → sugestão " + store + ": " + sg.name + ", " + sg.qty);
      else lines.push("- " + it.name + ": " + it.qty);
    });
  });
  return lines.join("\n");
}
function shopFmtAmount(n, unit){
  n = Math.round(n);
  if (unit === "g" && n >= 1000) return String(Math.round(n / 100) / 10).replace(".", ",") + " kg";
  if (unit === "ml" && n >= 1000) return String(Math.round(n / 100) / 10).replace(".", ",") + " L";
  return n + " " + unit;
}
function shopLine(it){
  var parts = [], size = packSizeOf(it.name);
  [["grams", "g"], ["ml", "ml"]].forEach(function(p){
    var total = it[p[0]];
    if (!(total > 0)) return;
    if (size > 0){ // embalagem conhecida: compra-se em embalagens inteiras
      var packs = Math.ceil(total / size - 0.0001);
      parts.push(packs + (packs === 1 ? " embalagem" : " embalagens") + " de " + shopFmtAmount(size, p[1]) + " (" + shopFmtAmount(packs * size, p[1]) + ")");
    } else parts.push(shopFmtAmount(total, p[1]));
  });
  if (it.units > 0) parts.push(Math.round(it.units) + " unid.");
  if (!parts.length && it.free) parts.push("à vontade");
  return parts.join(" + ");
}
function shoppingListFor(s, days, store){
  days = days > 0 ? days : 7;
  var map = {};
  (s.meals || []).forEach(function(m){ (m.foods || []).forEach(function(f0){
    var f = f0.original || f0, a = parseQtyAmount(f.qty);
    var it = map[f.name] || (map[f.name] = {name: f.name, group: resolveGroup(f.group || groupOfFood(f.name)), grams: 0, ml: 0, units: 0, free: false});
    if (a.kind === "fixed") it.free = true;
    else if (a.kind === "unit") it.units += a.value * days;
    else if (/\bml\b/i.test(String(f.qty))) it.ml += a.value * days;
    else it.grams += a.value * days;
  }); });
  var cmp = FOOD_COLLATOR ? FOOD_COLLATOR.compare : function(a, b){ return a.localeCompare(b, "pt"); };
  var groups = {};
  Object.keys(map).forEach(function(n){ (groups[map[n].group] = groups[map[n].group] || []).push(map[n]); });
  var order = Object.keys(FOOD_GROUPS).filter(function(g){ return groups[g]; }).concat(Object.keys(groups).filter(function(g){ return !FOOD_GROUPS[g]; }));
  return order.map(function(g){
    return {group: g, label: groupLabel(g), items: groups[g].sort(function(a, b){ return cmp(a.name, b.name); }).map(function(it){ return {name: it.name, qty: shopLine(it), info: store ? shopStoreInfo(store, it) : null}; })};
  });
}
function tplShoppingList(s){
  var days = SHOP_DAY_CHOICES.indexOf(state.shopDays) >= 0 ? state.shopDays : 7;
  var store = shopStoreGet(s);
  var list = shoppingListFor(s, days, store);
  var html = tabHead("Lista de compras", "Para " + days + " dias, com base no teu plano de alimentação atual" + (store ? " · " + store : ""));
  if (!list.length) return html + "<div class=\"card\" style=\"text-align:center;\"><p class=\"muted-p\">Ainda não há alimentos no teu plano para compor uma lista.</p></div>";
  var checked = shopLoadChecked(s), total = 0, done = 0;
  list.forEach(function(g){ g.items.forEach(function(it){ total++; if (checked[it.name]) done++; }); });
  var withProduct = 0, without = 0;
  list.forEach(function(g){ g.items.forEach(function(it){ if (!it.info) return; if (it.info.suggestion || it.info.status === "here") withProduct++; else if (it.info.status === "other") without++; }); });
  html += "<div class=\"checkin-field\"><label for=\"shopStore\">Onde vais comprar?</label><select id=\"shopStore\" class=\"mini-select\" style=\"width:100%;\"><option value=\"\">Qualquer supermercado</option>" +
    SHOP_STORES.map(function(n){ return "<option value=\"" + escapeHtml(n) + "\"" + (n === store ? " selected" : "") + ">" + escapeHtml(n) + "</option>"; }).join("") + "</select>" +
    (store ? "<p class=\"muted-p\" style=\"margin-top:6px;\">" + withProduct + (withProduct === 1 ? " item encontrado" : " itens encontrados") + " nesta loja" + (without ? " · " + without + (without === 1 ? " sem equivalente (só existe noutra loja)" : " sem equivalente (só existem noutra loja)") : "") + ". As sugestões são produtos de marca própria parecidos — confirma na prateleira.</p>" : "") + "</div>";
  html += "<div class=\"seg\" style=\"margin-bottom:10px;\">" + SHOP_DAY_CHOICES.map(function(d){
    return "<button type=\"button\" data-shop-days=\"" + d + "\" aria-pressed=\"" + (d === days) + "\" class=\"" + (d === days ? "on" : "") + "\">" + d + " dias</button>";
  }).join("") + "</div>" +
    "<div style=\"display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px;\"><span class=\"muted-p\" id=\"shopProgress\">" + done + " de " + total + " comprados</span>" +
    "<span style=\"display:flex; gap:6px;\"><button type=\"button\" class=\"btn btn-sm\" id=\"shopCopy\">📋 Copiar</button><button type=\"button\" class=\"btn btn-sm\" id=\"shopClear\">Limpar</button></span></div>";
  list.forEach(function(g){
    html += "<div class=\"card\" style=\"margin-bottom:10px;\"><div class=\"eyebrow\" style=\"margin-bottom:6px;\">" + escapeHtml(g.label) + "</div>" + g.items.map(function(it){
      var inf = it.info, sub = "";
      if (inf && inf.status === "other") sub = "<span class=\"shop-sub\">Só no " + escapeHtml(inf.only) + (inf.suggestion ? " — no " + escapeHtml(store) + ": <b>" + escapeHtml(inf.suggestion.name) + "</b>, " + escapeHtml(inf.suggestion.qty) : " — sem equivalente no " + escapeHtml(store)) + "</span>";
      else if (inf && inf.status === "generic" && inf.suggestion) sub = "<span class=\"shop-sub\">Sugestão " + escapeHtml(store) + ": <b>" + escapeHtml(inf.suggestion.name) + "</b>, " + escapeHtml(inf.suggestion.qty) + "</span>";
      return "<label class=\"food-item shop-item" + (checked[it.name] ? " done" : "") + "\"><span class=\"fname\"><input type=\"checkbox\" data-shop=\"" + escapeHtml(it.name) + "\"" + (checked[it.name] ? " checked" : "") + "> " + escapeHtml(it.name) + "</span><span class=\"fqty\">" + escapeHtml(it.qty) + "</span>" + sub + "</label>";
    }).join("") + "</div>";
  });
  return html;
}

/* ---------- PDF do plano alimentar (para imprimir ou pôr no frigorífico) ----------
   Escrito à mão, sem bibliotecas: um PDF 1.4 simples com Helvetica (as letras acentuadas do português estão todas no WinAnsi),
   o logótipo EVOLVE desenhado em vetor a partir do mesmo desenho do SVG da app, e as cores da marca (tinta #0D0F12, laranja #E85D2C).
   Funciona offline, é síncrono (importante para o navigator.share no iPhone, que exige o toque do utilizador) e não pesa na app.
   As larguras abaixo são as da Helvetica/Helvetica-Bold (AFM) para os carateres ASCII 32–126; os acentuados usam a largura da letra base. */
var PDF_PAGE_W = 595.28, PDF_PAGE_H = 841.89;
var PDF_W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278, 556,556,556,556,556,556,556,556,556,556, 278,278,584,584,584,556,1015,
  667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611, 278,278,278,469,556,333,
  556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500, 334,260,334,584];
var PDF_W_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278, 556,556,556,556,556,556,556,556,556,556, 333,333,584,584,584,611,975,
  722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611, 333,278,333,584,556,333,
  556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500, 389,280,389,584];
var PDF_SPECIAL = {8211: 150, 8212: 151, 8226: 149, 8364: 128, 8220: 147, 8221: 148, 8216: 145, 8217: 146, 8230: 133, 8776: 126};
var PDF_INK = [13, 15, 18], PDF_ORANGE = [232, 93, 44], PDF_MUTED = [105, 112, 126], PDF_LINE = [214, 218, 224], PDF_SOFT = [244, 245, 247], PDF_WHITE = [255, 255, 255];
// texto em WinAnsi (um byte por carácter); o que não existe passa à letra base ou a «?»
function pdfWinAnsi(str){
  var out = "";
  var txt = String(str == null ? "" : str);
  if (txt.normalize) txt = txt.normalize("NFC");   // «a» + acento solto passa a «á» (nomes copiados de outras apps)
  txt.split("").forEach(function(ch){
    var c = ch.charCodeAt(0);
    if ((c >= 32 && c <= 126) || (c >= 160 && c <= 255)) out += ch;
    else if (PDF_SPECIAL[c] != null) out += String.fromCharCode(PDF_SPECIAL[c]);
    else if (c === 9 || c === 10 || c === 13) out += " ";
    else { var base = ch.normalize("NFD").charAt(0), b = base.charCodeAt(0); out += b >= 32 && b <= 126 ? base : "?"; }
  });
  return out;
}
function pdfCharW(code, bold){
  var tbl = bold ? PDF_W_BOLD : PDF_W_REG;
  if (code >= 32 && code <= 126) return tbl[code - 32];
  if (code >= 160 && code <= 255){ var b = String.fromCharCode(code).normalize("NFD").charAt(0).charCodeAt(0); return b >= 32 && b <= 126 ? tbl[b - 32] : (bold ? 611 : 556); }
  return 500;
}
function pdfTextW(str, size, bold){
  var t = pdfWinAnsi(str), w = 0;
  for (var i = 0; i < t.length; i++) w += pdfCharW(t.charCodeAt(i), bold);
  return w * size / 1000;
}
function pdfWrap(str, maxW, size, bold){
  var words = String(str == null ? "" : str).split(/\s+/).filter(Boolean), lines = [], cur = "";
  words.forEach(function(w){
    var test = cur ? cur + " " + w : w;
    if (!cur || pdfTextW(test, size, bold) <= maxW) cur = test; else { lines.push(cur); cur = w; }
  });
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}
// o documento: páginas com operadores de desenho (origem no canto superior esquerdo, em pontos) e a montagem final do ficheiro
function pdfDoc(){
  var pages = [], cur = null;
  function n(v){ return String(Math.round(v * 100) / 100); }
  function Y(y){ return n(PDF_PAGE_H - y); }
  function P(x, y){ return n(x) + " " + Y(y); }
  function col(c){ return (c[0] / 255).toFixed(3) + " " + (c[1] / 255).toFixed(3) + " " + (c[2] / 255).toFixed(3); }
  function esc(t){ return t.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
  function roundPath(x, y, w, h, r){
    var k = r * 0.5523;
    return [P(x + r, y) + " m", P(x + w - r, y) + " l", P(x + w - r + k, y) + " " + P(x + w, y + r - k) + " " + P(x + w, y + r) + " c", P(x + w, y + h - r) + " l",
      P(x + w, y + h - r + k) + " " + P(x + w - r + k, y + h) + " " + P(x + w - r, y + h) + " c", P(x + r, y + h) + " l",
      P(x + r - k, y + h) + " " + P(x, y + h - r + k) + " " + P(x, y + h - r) + " c", P(x, y + r) + " l", P(x, y + r - k) + " " + P(x + r - k, y) + " " + P(x + r, y) + " c h"].join(" ");
  }
  var api = {
    addPage: function(){ cur = []; pages.push(cur); return pages.length - 1; },
    page: function(i){ cur = pages[i]; },
    count: function(){ return pages.length; },
    fillRect: function(x, y, w, h, c){ cur.push(col(c) + " rg " + n(x) + " " + Y(y + h) + " " + n(w) + " " + n(h) + " re f"); },
    // cartão com cantos redondos: preenchimento e/ou contorno
    card: function(x, y, w, h, r, fill, stroke, lw){
      cur.push((fill ? col(fill) + " rg " : "") + (stroke ? col(stroke) + " RG " + n(lw || 0.8) + " w " : "") + roundPath(x, y, w, h, r) + (fill && stroke ? " B" : fill ? " f" : " S"));
    },
    line: function(x1, y1, x2, y2, c, lw){ cur.push(col(c) + " RG " + n(lw) + " w 0 J " + P(x1, y1) + " m " + P(x2, y2) + " l S"); },
    polyline: function(pts, c, lw){ cur.push(col(c) + " RG " + n(lw) + " w 0 J 0 j " + pts.map(function(p, i){ return P(p[0], p[1]) + (i ? " l" : " m"); }).join(" ") + " S"); },
    circle: function(cx, cy, r, c, lw){
      var k = r * 0.5523;
      cur.push(col(c) + " RG " + n(lw) + " w " + P(cx + r, cy) + " m " + P(cx + r, cy + k) + " " + P(cx + k, cy + r) + " " + P(cx, cy + r) + " c " + P(cx - k, cy + r) + " " + P(cx - r, cy + k) + " " + P(cx - r, cy) + " c " +
        P(cx - r, cy - k) + " " + P(cx - k, cy - r) + " " + P(cx, cy - r) + " c " + P(cx + k, cy - r) + " " + P(cx + r, cy - k) + " " + P(cx + r, cy) + " c h S");
    },
    // font: "r" normal, "b" negrito, "i" itálico; align: "l", "r" ou "c" (x é a esquerda, a direita ou o centro)
    text: function(str, x, y, size, font, c, align){
      var t = pdfWinAnsi(str), w = pdfTextW(str, size, font === "b"), px = align === "r" ? x - w : align === "c" ? x - w / 2 : x;
      cur.push("BT /" + (font === "b" ? "F2" : font === "i" ? "F3" : "F1") + " " + n(size) + " Tf " + col(c) + " rg " + P(px, y) + " Td (" + esc(t) + ") Tj ET");
    },
    // o ficheiro PDF (cada carácter da cadeia é um byte)
    output: function(title){
      var out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", offsets = [];
      function add(body){ offsets.push(out.length); out += offsets.length + " 0 obj\n" + body + "\nendobj\n"; }
      var kids = pages.map(function(p, i){ return (7 + 2 * i) + " 0 R"; }).join(" ");
      add("<< /Type /Catalog /Pages 2 0 R >>");
      add("<< /Type /Pages /Kids [" + kids + "] /Count " + pages.length + " >>");
      ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique"].forEach(function(f){ add("<< /Type /Font /Subtype /Type1 /BaseFont /" + f + " /Encoding /WinAnsiEncoding >>"); });
      var tt = String(title || "Plano alimentar EVOLVE"), th = "FEFF";   // o título de um PDF é UTF-16 (em hexadecimal): aceita qualquer nome
      for (var q = 0; q < tt.length; q++) th += ("0000" + tt.charCodeAt(q).toString(16)).slice(-4);
      add("<< /Title <" + th + "> /Producer (EVOLVE) /Creator (EVOLVE) >>");
      pages.forEach(function(ops, i){
        var stream = ops.join("\n");
        add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + n(PDF_PAGE_W) + " " + n(PDF_PAGE_H) + "] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents " + (8 + 2 * i) + " 0 R >>");
        add("<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream");
      });
      var xref = out.length, pad = function(v){ return ("0000000000" + v).slice(-10); };
      out += "xref\n0 " + (offsets.length + 1) + "\n0000000000 65535 f \n" + offsets.map(function(o){ return pad(o) + " 00000 n \n"; }).join("") +
        "trailer\n<< /Size " + (offsets.length + 1) + " /Root 1 0 R /Info 6 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
      var bytes = new Uint8Array(out.length);
      for (var i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
      return bytes;
    }
  };
  return api;
}
// o logótipo EVOLVE em vetor (mesma geometria do SVG do cabeçalho da app, 1160 × 320)
function pdfLogo(doc, x, y, w, c){
  var k = w / 1160, pt = function(px, py){ return [x + px * k, y + py * k]; };
  [[0, 80], [0, 150], [0, 220], [1000, 80], [1000, 150], [1000, 220]].forEach(function(r){ doc.fillRect(x + r[0] * k, y + r[1] * k, 160 * k, 20 * k, c); });
  doc.polyline([[240, 80], [320, 240], [400, 80]].map(function(p){ return pt(p[0], p[1]); }), c, 20 * k);
  doc.polyline([[760, 80], [840, 240], [920, 80]].map(function(p){ return pt(p[0], p[1]); }), c, 20 * k);
  doc.circle(x + 580 * k, y + 160 * k, 90 * k, c, 20 * k);
  doc.line(x + 580 * k, y, x + 580 * k, y + 320 * k, c, 20 * k);
}

// ---- o conteúdo (puro, sem DOM: testa-se em Node) ----
// o plano só se exporta quando já tem refeições com alimentos (não há um estado «finalizado» no plano)
function planReadyForExport(s){ return !!(s && (s.meals || []).some(function(m){ return m && m.foods && m.foods.length; })); }
function localFileDate(){ var d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
function buildPlanDoc(s){
  var risk = hasUnmappedDietaryRisk(s), canSwap = !risk && computeFlexibilityProfile(s).substitutionsEnabled;
  // cópia ordenada por hora (sortMealsByTime mexeria no plano guardado)
  var meals = (s.meals || []).filter(function(m){ return m && m.foods && m.foods.length; }).slice()
    .sort(function(a, b){ return toMinutes(String(a.time || "99:99")) - toMinutes(String(b.time || "99:99")); });
  var cr = creatineStatus(s), crIdx = cr.on ? breakfastMealIndex(meals) : -1, hasSwap = false;
  var t = s.targets || {};
  function mac(v, mn, mx){ return v != null ? String(Math.round(v)) : (mn != null && mx != null ? Math.round(mn) + "–" + Math.round(mx) : ""); }
  var out = {
    name: s.name || "", dateLabel: new Date().toLocaleDateString("pt-PT", {day: "numeric", month: "long", year: "numeric"}), risk: risk,
    targets: t.kcal > 0 ? {kcal: Math.round(t.kcal), protein: mac(t.protein, t.proteinMin, t.proteinMax), carbs: mac(t.carbs, t.carbsMin, t.carbsMax), fat: mac(t.fat, t.fatMin, t.fatMax)} : null,
    meals: meals.map(function(m, i){
      var totals = foodsTotals(m.foods);
      return {name: m.name, time: m.time, kcal: totals.kcal, p: totals.p, c: totals.c, f: totals.f,
        foods: m.foods.map(function(f){ var sw = !!f.group && canSwap; if (sw) hasSwap = true; return {name: f.name, qty: f.qty, swap: sw}; }),
        creatine: i === crIdx ? {g: cr.dose, note: CREATINE_NOTE} : null};
    })
  };
  out.hasSwap = hasSwap;
  return out;
}

function renderPlanPdf(plan){
  var doc = pdfDoc(), W = PDF_PAGE_W, H = PDF_PAGE_H, M = 36, CW = W - 2 * M, GAP = 14, cardW = (CW - GAP) / 2, PAD = 12, FS = 10.5, LH = 13, TS = 12.5, NS = 8.5;
  var y = 0;
  // a letra cresce (até 1,4×) enquanto o plano couber numa só página: é para ler à distância, no frigorífico
  function setScale(sc){ FS = 10.5 * sc; LH = 13 * sc; TS = 12.5 * sc; NS = Math.max(8.5, 8.5 * sc * 0.95); }
  function continuation(){
    doc.addPage();
    pdfLogo(doc, M, 22, 70, PDF_INK);
    doc.text(plan.name, W - M, 34, 9, "r", PDF_MUTED, "r");
    doc.fillRect(M, 44, CW, 1.5, PDF_ORANGE);
    y = 62;
  }
  // primeira página: faixa escura com o logótipo, a data e o nome do aluno
  doc.addPage();
  doc.fillRect(0, 0, W, 84, PDF_INK);
  pdfLogo(doc, M, 26, 118, PDF_WHITE);
  doc.text("PLANO ALIMENTAR", W - M, 40, 12, "b", PDF_WHITE, "r");
  doc.text(plan.dateLabel, W - M, 57, 9.5, "r", [184, 191, 204], "r");
  doc.fillRect(0, 84, W, 4, PDF_ORANGE);
  var nameSz = 22;
  while (nameSz > 12 && pdfTextW(plan.name, nameSz, true) > CW) nameSz -= 0.5;   // nomes compridos encolhem em vez de saírem da página
  doc.text(plan.name, M, 124, nameSz, "b", PDF_INK, "l");
  y = 140;
  if (plan.targets){
    doc.card(M, y, CW, 60, 10, PDF_SOFT, null);
    doc.text(String(plan.targets.kcal), M + 16, y + 38, 28, "b", PDF_ORANGE, "l");
    var kw = pdfTextW(String(plan.targets.kcal), 28, true);
    doc.text("kcal por dia", M + 16 + kw + 6, y + 38, 9.5, "r", PDF_MUTED, "l");
    [["Proteína", plan.targets.protein], ["Hidratos", plan.targets.carbs], ["Gordura", plan.targets.fat]].forEach(function(m, i){
      var cx = M + 232 + i * 98;
      doc.text(m[0], cx, y + 24, 9, "r", PDF_MUTED, "l");
      doc.text(m[1] ? m[1] + " g" : "—", cx, y + 43, 15, "b", PDF_INK, "l");
    });
    y += 60 + 18;
  } else y += 6;

  // altura de um cartão de refeição
  function measure(m){
    var iw = cardW - 2 * PAD, h = PAD + TS + 11;
    m.foods.forEach(function(f){
      var qw = pdfTextW(f.qty, FS, true), lines = pdfWrap(f.name + (f.swap ? " *" : ""), iw - qw - 10, FS, false);
      h += lines.length * LH + 4;
    });
    if (m.creatine){
      h += LH + 4 + pdfWrap(m.creatine.note, iw, NS, false).length * (NS + 2.5) + 4;
    }
    return h + 18 + PAD;
  }
  function drawCard(m, x, top, h){
    var iw = cardW - 2 * PAD, ty = top + PAD;
    doc.card(x, top, cardW, h, 8, PDF_WHITE, PDF_LINE, 0.9);
    doc.text(pdfWrap(m.name, iw - 50 * TS / 12.5, TS, true)[0], x + PAD, ty + TS * 0.9, TS, "b", PDF_INK, "l");
    doc.text(m.time || "", x + cardW - PAD, ty + TS * 0.9, TS * 0.9, "b", PDF_ORANGE, "r");
    ty += TS + 4.5;
    doc.line(x + PAD, ty, x + cardW - PAD, ty, PDF_LINE, 0.8);
    ty += 6;
    m.foods.forEach(function(f){
      var qw = pdfTextW(f.qty, FS, true), lines = pdfWrap(f.name + (f.swap ? " *" : ""), iw - qw - 10, FS, false);
      lines.forEach(function(l, i){ doc.text(l, x + PAD, ty + FS * 0.95 + i * LH, FS, "r", PDF_INK, "l"); });
      doc.text(f.qty, x + cardW - PAD, ty + FS * 0.95, FS, "b", PDF_INK, "r");
      ty += lines.length * LH + 4;
    });
    if (m.creatine){
      doc.line(x + PAD, ty - 1, x + cardW - PAD, ty - 1, PDF_LINE, 0.5);
      doc.text("Creatina mono-hidratada", x + PAD, ty + FS * 0.95, FS, "r", PDF_INK, "l");
      doc.text(m.creatine.g + " g", x + cardW - PAD, ty + FS * 0.95, FS, "b", PDF_ORANGE, "r");
      ty += LH + 4;
      var noteLines = pdfWrap(m.creatine.note, iw, NS, false);
      noteLines.forEach(function(l, i){ doc.text(l, x + PAD, ty + NS * 0.75 + i * (NS + 2.5), NS, "i", PDF_MUTED, "l"); });
      ty += noteLines.length * (NS + 2.5) + 4;
    }
    doc.text(Math.round(m.kcal) + " kcal · P " + Math.round(m.p) + " g · H " + Math.round(m.c) + " g · G " + Math.round(m.f) + " g", x + PAD, top + h - PAD - 2, 8.5, "r", PDF_MUTED, "l");
  }
  var bottom = H - 56;
  function rowHeights(){ var hs = []; for (var k = 0; k < plan.meals.length; k += 2) hs.push(Math.max(measure(plan.meals[k]), plan.meals[k + 1] ? measure(plan.meals[k + 1]) : 0)); return hs; }
  var scales = [1.4, 1.3, 1.2, 1.1, 1], chosen = 1;
  for (var si = 0; si < scales.length; si++){
    setScale(scales[si]);
    var need = rowHeights().reduce(function(a, h){ return a + h + 12; }, 0);
    if (y + need <= bottom + 12){ chosen = scales[si]; break; }
  }
  setScale(chosen);
  for (var i = 0; i < plan.meals.length; i += 2){
    var a = plan.meals[i], b = plan.meals[i + 1], rowH = Math.max(measure(a), b ? measure(b) : 0);
    if (y + rowH > bottom) continuation();
    drawCard(a, M, y, rowH);
    if (b) drawCard(b, M + cardW + GAP, y, rowH);
    y += rowH + 12;
  }
  // rodapé em todas as páginas
  var total = doc.count();
  for (var p = 0; p < total; p++){
    doc.page(p);
    doc.line(M, H - 40, W - M, H - 40, PDF_LINE, 0.8);
    doc.text(plan.risk ? "Este plano não tem alimentos alternativos: fala com o teu profissional antes de trocar." : plan.hasSwap ? "* Podes trocar este alimento por um equivalente na app." : "Em caso de dúvida, fala com o teu profissional.", M, H - 26, 8, "r", PDF_MUTED, "l");
    doc.text("EVOLVE · Página " + (p + 1) + " de " + total, W - M, H - 26, 8, "b", PDF_MUTED, "r");
  }
  return doc.output("Plano alimentar EVOLVE - " + plan.name);
}

// entrega: no telemóvel abre a folha de partilha (imprimir, guardar nos Ficheiros, WhatsApp); no computador descarrega
var pdfLastTap = 0, pdfLastUrl = null;
function exportPlanPdf(s){
  if (!planReadyForExport(s)){ showToast("O plano ainda não tem refeições com alimentos."); return false; }
  var nowTap = Date.now();
  if (nowTap - pdfLastTap < 1500) return false;   // um duplo toque não gera (nem descarrega) dois PDFs
  pdfLastTap = nowTap;
  var bytes;
  try { bytes = renderPlanPdf(buildPlanDoc(s)); } catch (e) { showToast("⚠ Não foi possível gerar o PDF"); return false; }
  var name = "plano-alimentar-" + slug(s.name || "aluno") + "-" + localFileDate() + ".pdf";
  var blob = new Blob([bytes], {type: "application/pdf"}), file = null;
  try { file = new File([blob], name, {type: "application/pdf"}); } catch (e) {}
  // a folha de partilha é para o telemóvel (imprimir, Ficheiros, WhatsApp); no computador descarrega-se
  var touchFirst = !window.matchMedia || window.matchMedia("(pointer: coarse)").matches;
  if (touchFirst && file && navigator.share && navigator.canShare && navigator.canShare({files: [file]})){
    navigator.share({files: [file], title: "Plano alimentar EVOLVE"}).catch(function(e){ if (!e || (e.name !== "AbortError" && e.name !== "InvalidStateError")) pdfDeliver(blob, name); });
    return true;
  }
  pdfDeliver(blob, name);
  return true;
}
function pdfDeliver(blob, name){
  var url = URL.createObjectURL(blob);
  var standalone = (window.navigator && window.navigator.standalone === true) || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  if (standalone){
    // numa app instalada no iPhone, um descarregamento abre o PDF sem botão de voltar: dá-se uma ligação para tocar
    if (pdfLastUrl){ try { URL.revokeObjectURL(pdfLastUrl); } catch (e) {} }
    pdfLastUrl = url;   // só se liberta quando houver outro PDF (a janela pode ficar aberta o tempo que for)
    openModal("<div class=\"mtitle\">PDF pronto</div><p class=\"muted-p\" style=\"margin-bottom:12px;\">Abre o PDF e usa o botão de partilha do telemóvel para imprimir ou guardar.</p>" +
      "<a class=\"btn primary\" id=\"pdfOpenLink\" style=\"display:block; text-align:center;\" href=\"" + url + "\" target=\"_blank\" rel=\"noopener\">Abrir PDF</a>");
  } else {
    var a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ try { URL.revokeObjectURL(url); } catch (e) {} }, 120000);
  }
}

function tplPlanoTabs(s){
  if (noNutritionOf(s)){   // só o programa de treino
    return workoutDaysWithExercises(s).length ? tplTrainingProgramCard(s) : "<div class=\"card\" style=\"text-align:center;\"><div class=\"eyebrow\">Treino</div><p class=\"muted-p\" style=\"margin-top:8px;\">O teu programa de treino ainda não foi definido.</p></div>";
  }
  var hasProgram = workoutDaysWithExercises(s).length > 0, hasMeals = (s.meals || []).length > 0;
  var sec = hasProgram && state.planoSection === "treino" ? "treino" : (hasMeals && state.planoSection === "compras" ? "compras" : "alimentacao");
  function segBtn(id, label){ return "<button type=\"button\" data-plano-sec=\"" + id + "\" aria-pressed=\"" + (sec === id) + "\" class=\"" + (sec === id ? "on" : "") + "\">" + label + "</button>"; }
  var seg = hasProgram || hasMeals ? "<div class=\"seg\">" + segBtn("alimentacao", "Alimentação") + (hasProgram ? segBtn("treino", "Treino") : "") + (hasMeals ? segBtn("compras", "Compras") : "") + "</div>" : "";
  return seg + (sec === "treino" ? tplTrainingProgramCard(s) : sec === "compras" ? tplShoppingList(s) : tplPlano(s));
}

// Plano > Treino: o programa da semana, com um botão para iniciar qualquer dia
function tplTrainingProgramCard(s){
  var days = workoutDaysWithExercises(s);
  if (!days.length) return "";
  var names = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"], hasDays = !!(s.trainingDays && s.trainingDays.length);
  return "<div class=\"card\"><div class=\"eyebrow\">Programa de treino</div>" +
    (hasDays ? "<div class=\"week-chips\">" + [1,2,3,4,5,6,0].map(function(d){ return "<div class=\"week-chip" + (s.trainingDays.indexOf(d) !== -1 ? " on" : "") + "\">" + names[d] + "<i></i></div>"; }).join("") + "</div>" : "") +
    days.map(function(d){
      return "<div class=\"prog-day\"><div class=\"pd-row\"><div class=\"pd-info\"><div class=\"pd-name\">" + escapeHtml(d.name) + "</div><div class=\"pd-meta\">" + plural(d.exercises.length, "exercício", "exercícios") + " · " + plural(workoutSetCount(d), "série", "séries") + "</div></div>" +
        "<button type=\"button\" class=\"btn btn-sm\" data-start-day=\"" + escapeHtml(d.id) + "\">Iniciar</button></div>" +
        "<details class=\"soft-details\"><summary>Ver exercícios</summary><ul class=\"pd-ex\">" + d.exercises.map(function(e){ return "<li><button type=\"button\" class=\"wl-info\" data-ex-info=\"" + escapeHtml(e.id) + "\">" + escapeHtml(e.name) + " <span aria-hidden=\"true\">ⓘ</span></button> <span class=\"num\">" + escapeHtml(String(e.sets)) + " × " + escapeHtml(String(e.reps)) + "</span></li>"; }).join("") + "</ul></details></div>";
    }).join("") + "</div>";
}

// ecrã de treino: um passo de "Hoje" (volta atrás com ← Hoje), com o progresso das séries no topo
function tplTreinoScreen(s){
  var head = "<div class=\"treino-head\"><button type=\"button\" class=\"btn btn-sm\" id=\"backToHoje\">← Hoje</button><div class=\"eyebrow\">Treino</div></div>";
  var day = workoutDayFor(s);
  if (!day) return head + tplWorkoutLogger(s);
  var total = workoutSetCount(day), done = workoutDraftDone(s, day);
  return head + "<div class=\"wl-progress\"><div class=\"tw-name\">" + escapeHtml(day.name) + "</div>" +
    "<div class=\"tw-progress\"><div class=\"bar-track\"><div class=\"bar-fill\" id=\"wlProgressFill\" style=\"width:" + (total ? Math.round(done / total * 100) : 0) + "%\"></div></div><span class=\"num\" id=\"wlProgressText\">" + done + "/" + total + " séries</span></div></div>" +
    tplWorkoutLogger(s);
}

// ligações entre "Hoje", "Plano" e o ecrã de treino
function wireTrainingNav(s, el){
  function go(tab, dayId){
    if (dayId) state.workoutDayId = dayId;
    state.alunoTab = tab;
    renderAlunoShell();
    try { window.scrollTo(0, 0); } catch (e) {}
  }
  var start = el.querySelector("#startWorkout");
  if (start) start.addEventListener("click", function(){ go("treino", start.getAttribute("data-day")); });
  el.querySelectorAll("[data-start-day]").forEach(function(b){ b.addEventListener("click", function(){ go("treino", b.getAttribute("data-start-day")); }); });
  wireExerciseInfo(s, el);
  var back = el.querySelector("#backToHoje");
  if (back) back.addEventListener("click", function(){ go("hoje"); });
  el.querySelectorAll("[data-plano-sec]").forEach(function(b){
    b.addEventListener("click", function(){ state.planoSection = b.getAttribute("data-plano-sec"); renderAlunoTab(s); });
  });
  el.querySelectorAll("[data-shop-days]").forEach(function(b){
    b.addEventListener("click", function(){ state.shopDays = parseInt(b.getAttribute("data-shop-days"), 10); renderAlunoTab(s); });
  });
  function shopRefreshProgress(){
    var boxes = el.querySelectorAll("[data-shop]"), n = 0;
    boxes.forEach(function(cb){ if (cb.checked) n++; });
    var p = el.querySelector("#shopProgress");
    if (p) p.textContent = n + " de " + boxes.length + " comprados";
  }
  el.querySelectorAll("[data-shop]").forEach(function(cb){
    cb.addEventListener("change", function(){
      var checked = shopLoadChecked(s), name = cb.getAttribute("data-shop");
      if (cb.checked) checked[name] = 1; else delete checked[name];
      shopSaveChecked(s, checked);
      var row = cb.closest ? cb.closest(".shop-item") : null;
      if (row) row.classList.toggle("done", cb.checked);
      shopRefreshProgress();
    });
  });
  var shopStoreSel = el.querySelector("#shopStore");
  if (shopStoreSel) shopStoreSel.addEventListener("change", function(){ shopStoreSet(s, shopStoreSel.value); renderAlunoTab(s); });
  var pdfBtn = el.querySelector("#exportPlanPdf");
  if (pdfBtn) pdfBtn.addEventListener("click", function(){ exportPlanPdf(s); });
  var shopCopy = el.querySelector("#shopCopy");
  if (shopCopy) shopCopy.addEventListener("click", function(){
    var text = shoppingListText(s, SHOP_DAY_CHOICES.indexOf(state.shopDays) >= 0 ? state.shopDays : 7, shopStoreGet(s));
    var done = function(){ showToast("✓ Lista copiada"); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function(){ showToast("⚠ Não foi possível copiar"); });
    else showToast("⚠ O teu browser não deixa copiar");
  });
  var shopClear = el.querySelector("#shopClear");
  if (shopClear) shopClear.addEventListener("click", function(){
    shopSaveChecked(s, {});
    el.querySelectorAll("[data-shop]").forEach(function(cb){ cb.checked = false; var row = cb.closest ? cb.closest(".shop-item") : null; if (row) row.classList.remove("done"); });
    shopRefreshProgress();
  });
  var ci = el.querySelector("#goCheckin");
  if (ci) ci.addEventListener("click", function(){ state.ciOpen = true; go("evolucao"); });
}

/* ===================== TREINO: programa, registo por sessão e progressão de carga =====================
   trainingProgram (só o profissional escreve): {name, days:[{id, name, exercises:[{id, name, sets, reps, rpe, rest, notes}]}]}
   workoutLogs (o aluno só acrescenta): [{id, date, dayId, dayName, rpe, notes, entries:[{exerciseId, name, sets:[{reps, load}]}]}]
   Carga estimada (1RM) pela fórmula de Epley: carga × (1 + reps/30). */
function uidShort(prefix){ return (prefix || "id") + "_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3); }
function trainingProgramOf(s){ var p = s && s.trainingProgram; return p && Array.isArray(p.days) ? p : {name:"", days:[]}; }
function ensureTrainingProgram(s){ if (!s.trainingProgram || !Array.isArray(s.trainingProgram.days)) s.trainingProgram = {name:"Programa de treino", days:[]}; return s.trainingProgram; }
function addTrainingDay(s, name){
  name = String(name || "").trim();
  if (!name) return null;
  var d = {id: uidShort("d"), name: name.slice(0, 80), exercises: []};
  ensureTrainingProgram(s).days.push(d);
  return d;
}
function removeTrainingDay(s, dayId){ var p = ensureTrainingProgram(s); p.days = p.days.filter(function(d){ return d.id !== dayId; }); }
function addProgramExercise(s, dayId, ex){
  var day = ensureTrainingProgram(s).days.filter(function(d){ return d.id === dayId; })[0];
  var name = String(ex && ex.name || "").trim();
  if (!day || !name) return null;
  var sets = Math.min(20, Math.max(1, parseInt(ex.sets, 10) || 3));
  var rpe = parseFloat(ex.rpe), rest = parseInt(ex.rest, 10);
  var e = {id: uidShort("e"), name: name.slice(0, 120), sets: sets, reps: String(ex.reps || "8-12").trim().slice(0, 20),
    rpe: rpe >= 1 && rpe <= 10 ? rpe : null, rest: rest >= 0 && rest <= 900 ? rest : null, notes: String(ex.notes || "").trim().slice(0, 200),
    demo: cleanDemoUrl(ex.demo) || null, cues: parseCues(ex.cues), group: EXERCISE_GROUPS.indexOf(ex.group) >= 0 ? ex.group : (exerciseGroupFor(name) || null)};
  day.exercises.push(e);
  return e;
}
// atualiza a demonstração e os pontos-chave de um exercício já existente; devolve false se a ligação não for um https válido
function updateProgramExerciseGuide(s, dayId, exId, guide){
  var day = ensureTrainingProgram(s).days.filter(function(d){ return d.id === dayId; })[0];
  var ex = day ? day.exercises.filter(function(e){ return e.id === exId; })[0] : null;
  if (!ex) return false;
  var raw = String(guide && guide.demo || "").trim();
  if (raw && !cleanDemoUrl(raw)) return false;
  ex.demo = raw ? cleanDemoUrl(raw) : null;
  ex.cues = parseCues(guide && guide.cues);
  if (guide && guide.group !== undefined) ex.group = EXERCISE_GROUPS.indexOf(guide.group) >= 0 ? guide.group : (exerciseGroupFor(ex.name) || null);
  return true;
}
function removeProgramExercise(s, dayId, exId){
  ensureTrainingProgram(s).days.forEach(function(d){ if (d.id === dayId) d.exercises = d.exercises.filter(function(e){ return e.id !== exId; }); });
}
function firstRepsOf(reps){ var m = String(reps || "").match(/\d+/); return m ? parseInt(m[0], 10) : 0; }
function epley1RM(load, reps){
  if (!(load > 0) || !(reps > 0)) return 0;
  reps = Math.min(reps, 12); // Epley só é fiável até ~12 repetições: séries de 30 repetições não "sobem" o máximo
  return Math.round((reps === 1 ? load : load * (1 + reps / 30)) * 10) / 10;
}
function workoutEntryStats(entry){
  var sets = ((entry && entry.sets) || []).filter(function(x){ return x && x.reps > 0; });
  var best = null, bestRank = 0, volume = 0, topLoad = 0, topReps = 0;
  sets.forEach(function(x){
    if (x.reps > topReps) topReps = x.reps;
    var load = x.load > 0 ? x.load : 0;
    volume += x.reps * load;
    if (load > topLoad) topLoad = load;
    var e = epley1RM(load, x.reps);
    if (!best || e > best.e1rm || (e === best.e1rm && x.reps > best.reps)) best = {load: load, reps: x.reps, e1rm: e};
    // só para a progressão: acima de 12 repetições o Epley deixa de subir, e cada repetição a mais conta um pouco (desempate)
    var rank = x.reps > 12 ? e * (1 + 0.01 * (x.reps - 12)) : e;
    if (rank > bestRank) bestRank = rank;
  });
  var est = best ? best.e1rm : 0;
  // métrica de progressão: 1RM estimado (kind "load"); sem carga (peso do corpo) conta o máximo de repetições numa série (kind "reps")
  var kind = est > 0 ? "load" : "reps";
  return {sets: sets.length, volume: Math.round(volume), topLoad: topLoad, est1RM: est, topReps: topReps, kind: kind,
    score: kind === "load" ? Math.round(bestRank * 10) / 10 : topReps, topSet: best};
}
function exerciseHistory(s, exerciseId, name){
  var key = String(name || "").trim().toLowerCase();
  return (s.workoutLogs || []).slice().sort(function(a, b){ return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); }).map(function(log){
    var entry = (log.entries || []).filter(function(e){ return (exerciseId && e.exerciseId === exerciseId) || String(e.name || "").trim().toLowerCase() === key; })[0];
    if (!entry) return null;
    var st = workoutEntryStats(entry);
    return st.sets ? Object.assign({date: log.date}, st) : null;
  }).filter(Boolean);
}
// "progrediu" (novo máximo), "estagnado" (3 sessões sem novo máximo), "regrediu" (≥ 7% abaixo do melhor), "estável"; null se há menos de 2 sessões
function sameKindHistory(hist){ var k = hist.length ? hist[hist.length - 1].kind : null; return hist.filter(function(h){ return !h.kind || h.kind === k; }); }
function progressionStatus(hist){
  if (!hist || !hist.length) return null;
  // nunca mistura kg (1RM) com repetições: só se comparam sessões do mesmo tipo que a última (mudar de peso do corpo para carga recomeça a série)
  var kind = hist[hist.length - 1].kind;
  hist = hist.filter(function(h){ return !h.kind || h.kind === kind; });
  if (hist.length < 2) return null;
  var last = hist[hist.length - 1];
  var prior = hist.slice(0, -1).map(function(h){ return h.score; });
  var priorBest = Math.max.apply(null, prior);
  if (last.score > priorBest * 1.01) return "progrediu";
  // queda clara: mais grave que estagnar (com repetições, uma só repetição a menos não é regressão: exige ≥ 2)
  if (last.score < priorBest * 0.93 && (kind !== "reps" || priorBest - last.score >= 2)) return "regrediu";
  if (hist.length >= 4){
    var before = Math.max.apply(null, hist.slice(0, -3).map(function(h){ return h.score; }));
    var recent = Math.max.apply(null, hist.slice(-3).map(function(h){ return h.score; }));
    if (recent <= before * 1.005) return "estagnado";
  }
  return "estável";
}
function sessionsInLastDays(s, days){
  return (s.workoutLogs || []).filter(function(l){ var d = daysSinceDate(l.date); return d != null && d < days; });
}
function logWorkout(s, data){
  var entries = (data.entries || []).map(function(e){
    return {exerciseId: shortStr(String(e.exerciseId || ""), 40) || null, name: shortStr(String(e.name || ""), 120),
      sets: (e.sets || []).map(function(x){ var o = {reps: Math.round(Number(x.reps)), load: x.load > 0 ? Math.round(x.load * 10) / 10 : 0}; var ri = Number(x.rir); if (x.rir != null && x.rir !== "" && ri >= 0 && ri <= 10) o.rir = Math.round(ri); return o; })
        .filter(function(x){ return x.reps >= 1 && x.reps <= 100 && x.load <= 1000; })};
  }).filter(function(e){ return e.sets.length; });
  if (!entries.length) return null;
  var rpe = parseInt(data.rpe, 10);
  var log = {id: uidShort("w"), date: data.date || todayISO(), dayId: shortStr(String(data.dayId || ""), 40) || null, dayName: shortStr(String(data.dayName || ""), 80),
    rpe: rpe >= 1 && rpe <= 10 ? rpe : null, notes: String(data.notes || "").trim().slice(0, 500), entries: entries};
  if (!s.workoutLogs) s.workoutLogs = [];
  s.workoutLogs.push(log);
  if (Array.isArray(s.workoutLogsRaw)) s.workoutLogsRaw.push(log); // o que se grava é o original + as sessões novas
  return log;
}
// Profissional a registar um treino (pré-visualização / o próprio profissional que treina): nunca envia a lista da sua cópia —
// lê a lista atual do servidor, acrescenta esta sessão e grava (assim não apaga sessões que o aluno tenha registado entretanto)
// o profissional apaga sessões registadas (e, com elas, a progressão de carga, que sai dos registos)
function sameWorkoutLog(raw, log){
  if (!raw || !log) return false;
  if (raw.id) return raw.id === log.id;
  return raw.date === log.date && (raw.dayId || null) === (log.dayId || null) && String(raw.notes || "").slice(0, 500) === String(log.notes || "");
}
function deleteWorkoutLogs(s, which){   // which: uma sessão ou "all"
  var keep = function(l){ return which !== "all" && !(which && (l === which || sameWorkoutLog(l, which))); };
  s.workoutLogs = (s.workoutLogs || []).filter(function(l){ return which === "all" ? false : l !== which && l.id !== which.id; });
  s.workoutLogsRaw = (Array.isArray(s.workoutLogsRaw) ? s.workoutLogsRaw : []).filter(function(l){ return which === "all" ? false : !sameWorkoutLog(l, which); });
  return keep && true;
}
// o profissional nunca grava workout_logs pela gravação normal (não apagar sessões que o aluno registe entretanto): a remoção grava a lista já sem as sessões apagadas
function saveWorkoutLogsAsPro(s){
  if (!sbReady) { persistStudent(s); return Promise.resolve(true); }
  if (!trainingColumnsAvailable) return Promise.resolve(false);
  return Promise.resolve(sb.from("students").update({workout_logs: workoutLogsForWrite(s)}).eq("id", s.id)).then(function(res){ return !(res && res.error); }, function(){ return false; });
}
function undoWorkoutLog(s, log){
  s.workoutLogs = (s.workoutLogs || []).filter(function(l){ return l !== log; });
  if (Array.isArray(s.workoutLogsRaw)) s.workoutLogsRaw = s.workoutLogsRaw.filter(function(l){ return l !== log; });
}
function appendWorkoutLogAsPro(s, log){
  if (!sbReady) return Promise.resolve(true);
  if (!trainingColumnsAvailable) return Promise.resolve(false);
  return sb.from("students").select("workout_logs").eq("id", s.id).single().then(function(res){
    if (res.error) throw res.error;
    var current = Array.isArray(res.data && res.data.workout_logs) ? res.data.workout_logs : [];
    var merged = current.some(function(x){ return x && x.id === log.id; }) ? current : current.concat([log]);
    return sb.from("students").update({workout_logs: merged}).eq("id", s.id).then(function(r2){
      if (r2.error) throw r2.error;
      s.workoutLogsRaw = merged;
      return true;
    });
  });
}
function nextWorkoutDay(s){
  var days = trainingProgramOf(s).days;
  if (!days.length) return null;
  var logs = s.workoutLogs || [];
  if (!logs.length) return days[0];
  var lastDayId = logs[logs.length - 1].dayId;
  var idx = days.findIndex(function(d){ return d.id === lastDayId; });
  return days[(idx + 1) % days.length];
}
function fmtLoadSet(top){ return top ? (top.load > 0 ? String(top.load).replace(".", ",") + " kg × " + top.reps : top.reps + " reps (peso do corpo)") : "—"; }

/* ---------- Cronómetro de descanso ----------
   Contagem decrescente entre séries (por exercício usa o descanso prescrito; ou 30 s a 3 min à escolha), com
   -15/+15 s, pausa, reiniciar e, a zero, som + vibração + painel a piscar; depois conta o tempo a mais (+0:12).
   Usa o relógio (Date.now) e não "ticks", por isso continua certo se o ecrã apagar ou a página ficar em segundo plano. */
var REST_PRESETS = [30, 45, 60, 90, 120, 180];
var REST_DEFAULT_SECONDS = 90;
var REST_AUTO_CLOSE_MS = 10 * 60 * 1000;
var restTimer = null; // {total, endsAt, label, pausedLeft, notified}
var restTimerInterval = null;
var restAudioCtx = null;
function fmtClock(sec){ sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ":" + ("0" + (sec % 60)).slice(-2); }
function restTimerLeftMs(t, now){ if (!t) return 0; return t.pausedLeft != null ? t.pausedLeft : t.endsAt - now; }
function restTimerStart(seconds, label, now){
  seconds = Math.min(3600, Math.max(5, Math.round(seconds) || REST_DEFAULT_SECONDS));
  now = now == null ? Date.now() : now;
  restTimer = {total: seconds, endsAt: now + seconds * 1000, label: label || "Descanso", pausedLeft: null, notified: false};
  unlockRestAudio();
  startRestTicker();
  renderRestTimer(now);
  return restTimer;
}
function restTimerAdjust(deltaSec, now){
  if (!restTimer) return;
  now = now == null ? Date.now() : now;
  if (restTimer.pausedLeft != null) restTimer.pausedLeft = Math.max(0, restTimer.pausedLeft + deltaSec * 1000);
  else restTimer.endsAt += deltaSec * 1000;
  restTimer.total = Math.max(5, restTimer.total + deltaSec);
  if (restTimerLeftMs(restTimer, now) > 0) restTimer.notified = false;
  renderRestTimer(now);
}
function restTimerTogglePause(now){
  if (!restTimer) return;
  now = now == null ? Date.now() : now;
  if (restTimer.pausedLeft != null){ restTimer.endsAt = now + restTimer.pausedLeft; restTimer.pausedLeft = null; }
  else restTimer.pausedLeft = Math.max(0, restTimer.endsAt - now);
  renderRestTimer(now);
}
function restTimerRestart(now){
  if (!restTimer) return;
  restTimerStart(restTimer.total, restTimer.label, now);
}
function restTimerStop(){
  restTimer = null;
  if (restTimerInterval){ clearInterval(restTimerInterval); restTimerInterval = null; }
  renderRestTimer();
}
function startRestTicker(){
  if (restTimerInterval) return;
  restTimerInterval = setInterval(function(){ restTimerTick(Date.now()); }, 250);
}
function restTimerTick(now){
  if (!restTimer) return;
  if (restTimer.pausedLeft == null && restTimerLeftMs(restTimer, now) < -REST_AUTO_CLOSE_MS){ restTimerStop(); return; } // esquecido há mais de 10 min
  if (restTimerLeftMs(restTimer, now) <= 0 && !restTimer.notified && restTimer.pausedLeft == null){
    restTimer.notified = true;
    restTimerAlert();
  }
  renderRestTimer(now);
}
function unlockRestAudio(){
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!restAudioCtx) restAudioCtx = new AC();
    if (restAudioCtx.state === "suspended") restAudioCtx.resume();
  } catch (e) {}
}
function restTimerAlert(){
  try {
    if (restAudioCtx){
      var t0 = restAudioCtx.currentTime;
      [0, 0.28, 0.56].forEach(function(d){
        var o = restAudioCtx.createOscillator(), g = restAudioCtx.createGain();
        o.type = "sine"; o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, t0 + d);
        g.gain.exponentialRampToValueAtTime(0.4, t0 + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.22);
        o.connect(g); g.connect(restAudioCtx.destination);
        o.start(t0 + d); o.stop(t0 + d + 0.24);
      });
    }
  } catch (e) {}
  try { if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]); } catch (e) {}
}
function restTimerHtml(now){
  var t = restTimer;
  var left = restTimerLeftMs(t, now);
  var over = left < 0;
  var secs = Math.ceil(Math.abs(left) / 1000);
  var pct = restTimerProgress(t, left);
  var paused = t.pausedLeft != null;
  return `<div class="rt-head"><span class="rt-label">⏱ ${escapeHtml(t.label)}${paused ? " · em pausa" : ""}</span><button type="button" data-rt="close" aria-label="Fechar cronómetro">✕</button></div>` +
    `<div class="rt-time${over ? " over" : ""}" role="timer">${over ? "+" : ""}${fmtClock(secs)}</div>` +
    `<div class="rt-bar"><i style="width:${pct.toFixed(1)}%"></i></div>` +
    `<div class="rt-status" aria-live="polite">${over ? "Descanso terminado — próxima série!" : ""}</div>` +
    `<div class="rt-actions"><button type="button" data-rt="-15">−15 s</button><button type="button" data-rt="pause">${paused ? "Continuar" : "Pausa"}</button><button type="button" data-rt="+15">+15 s</button><button type="button" data-rt="restart">Reiniciar</button></div>`;
}
// Desenha o painel de raiz só quando a estrutura muda (início, pausa, fim, outro exercício); a cada "tick" só atualiza
// o número e a barra no sítio — reconstruir os botões 4×/s fazia perder o foco e engolia cliques.
function restTimerProgress(t, left){
  return left < 0 ? 100 : Math.min(100, Math.max(0, (1 - left / (t.total * 1000)) * 100));
}
function renderRestTimer(now){
  var el = document.getElementById("restTimer");
  if (!el) return;
  var app = document.getElementById("alunoApp");
  var visible = !!restTimer && state.mode === "aluno" && !(app && app.classList.contains("hidden"));
  el.classList.toggle("hidden", !visible);
  if (app) app.classList.toggle("rt-open", visible);
  if (!visible){ el.innerHTML = ""; el._rtKey = null; return; }
  now = now == null ? Date.now() : now;
  var left = restTimerLeftMs(restTimer, now), over = left < 0, paused = restTimer.pausedLeft != null;
  el.classList.toggle("done", left <= 0 && !paused);
  var key = [restTimer.label, paused, over].join("|");
  if (el._rtKey !== key){
    el.innerHTML = restTimerHtml(now);
    el._rtKey = key;
    return;
  }
  var timeEl = el.querySelector(".rt-time"), bar = el.querySelector(".rt-bar i");
  if (timeEl) timeEl.textContent = (over ? "+" : "") + fmtClock(Math.ceil(Math.abs(left) / 1000));
  if (bar) bar.style.width = restTimerProgress(restTimer, left).toFixed(1) + "%";
}
(function wireRestTimer(){
  var el = document.getElementById("restTimer");
  if (!el) return;
  el.addEventListener("click", function(e){
    var b = e.target.closest ? e.target.closest("[data-rt]") : null;
    if (!b) return;
    var a = b.getAttribute("data-rt");
    if (a === "close") restTimerStop();
    else if (a === "pause") restTimerTogglePause();
    else if (a === "restart") restTimerRestart();
    else if (a === "-15") restTimerAdjust(-15);
    else if (a === "+15") restTimerAdjust(15);
  });
})();

// ---------- Aluno: registar a sessão ----------
// Rascunho do treino em curso: sobrevive a mudar de separador/re-desenhar e (se o browser deixar) a recarregar a página
var WL_DRAFT_KEY = "evolve_wl_draft_v1";
var WL_DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000;
function wlDraftStore(){
  if (!state.wlDraft){
    state.wlDraft = {};
    try { var raw = window.localStorage && window.localStorage.getItem(WL_DRAFT_KEY); if (raw) state.wlDraft = JSON.parse(raw) || {}; } catch (e) { state.wlDraft = {}; }
    // rascunhos de há mais de 12 h (ou sem data) são de um treino abandonado: não reaparecem como "séries feitas"
    Object.keys(state.wlDraft).forEach(function(k){ var d = state.wlDraft[k]; if (!d || !(Date.now() - d.savedAt < WL_DRAFT_MAX_AGE_MS)) delete state.wlDraft[k]; });
  }
  return state.wlDraft;
}
function wlDraftKey(s, dayId){ return String(s.id) + "|" + String(dayId); }
function wlDraftGet(s, dayId){
  var all = wlDraftStore(), k = wlDraftKey(s, dayId);
  if (all[k] && all[k].savedAt && !(Date.now() - all[k].savedAt < WL_DRAFT_MAX_AGE_MS)) delete all[k]; // a página ficou aberta e o rascunho envelheceu
  if (!all[k]) all[k] = {sets: {}, rpe: null, notes: ""};
  return all[k];
}
function wlDraftSave(dayDraft){ if (dayDraft) dayDraft.savedAt = Date.now(); try { window.localStorage && window.localStorage.setItem(WL_DRAFT_KEY, JSON.stringify(wlDraftStore())); } catch (e) {} }
function wlDraftClear(s, dayId){ delete wlDraftStore()[wlDraftKey(s, dayId)]; wlDraftSave(); }
function wlDraftWipe(){ state.wlDraft = {}; try { window.localStorage && window.localStorage.removeItem(WL_DRAFT_KEY); } catch (e) {} }

/* ---------- Exercícios: demonstração, pontos-chave, RIR, histórico de cargas e sugestão de sobrecarga ----------
   exercício (só o profissional escreve): demo = ligação https para um GIF/imagem/vídeo (ou página), cues = até 3 pontos-chave de execução.
   série registada pelo aluno: {reps, load, rir?}. A sugestão de sobrecarga segue a dupla progressão: meta superior de repetições, à mesma carga,
   em todas as séries principais das últimas OVERLOAD_SESSIONS sessões -> sobe a carga (≥ 2 kg ou 5 %). */
var EX_CUES_MAX = 3, EX_CUE_LEN = 120;
var OVERLOAD_SESSIONS = 2;
var OVERLOAD_MIN_INCREMENT_KG = 2;
var OVERLOAD_PCT = 0.05;
function cleanDemoUrl(u){
  u = String(u == null ? "" : u).trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(u) && u.length <= 500 ? u : "";
}
function demoKindOf(u){
  return /\.(gif|png|jpe?g|webp|avif)(\?|#|$)/i.test(u) ? "image" : /\.(mp4|webm|mov)(\?|#|$)/i.test(u) ? "video" : "link";
}
function parseCues(input){
  var list = Array.isArray(input) ? input : String(input == null ? "" : input).split(/\r?\n|;/);
  return list.map(function(c){ return String(c).replace(/^[\s\-•*·]+/, "").trim().slice(0, EX_CUE_LEN); }).filter(Boolean).slice(0, EX_CUES_MAX);
}
function exerciseMediaHtml(demo){
  var u = cleanDemoUrl(demo);
  if (!u) return "";
  var k = demoKindOf(u);
  if (k === "image") return "<img class=\"ex-demo\" src=\"" + escapeHtml(u) + "\" alt=\"Demonstração do exercício\" loading=\"lazy\">";
  if (k === "video") return "<video class=\"ex-demo\" src=\"" + escapeHtml(u) + "\" autoplay loop muted playsinline controls></video>";
  return "<a class=\"btn btn-sm\" href=\"" + escapeHtml(u) + "\" target=\"_blank\" rel=\"noopener noreferrer\">▶ Ver demonstração</a>";
}
function fmtKg(n){ return String(Math.round(n * 100) / 100).replace(".", ","); }
// as últimas n sessões em que o exercício foi feito, da mais recente para a mais antiga, com as séries (reps/carga/RIR)
function exerciseSessions(s, ex, n){
  var key = String(ex.name || "").trim().toLowerCase(), out = [];
  (s.workoutLogs || []).slice().sort(function(a, b){ return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }).forEach(function(l){
    if (out.length >= n) return;
    var e = (l.entries || []).filter(function(x){ return (ex.id && x.exerciseId === ex.id) || String(x.name || "").trim().toLowerCase() === key; })[0];
    var sets = e ? (e.sets || []).filter(function(x){ return x && x.reps > 0; }) : [];
    if (sets.length) out.push({date: l.date, sets: sets});
  });
  return out;
}
function repsRangeOf(reps){
  var m = String(reps || "").match(/(\d+)\s*(?:-|–|a|à)\s*(\d+)/);
  if (m && parseInt(m[2], 10) >= parseInt(m[1], 10)) return {lo: parseInt(m[1], 10), hi: parseInt(m[2], 10)};
  var n = firstRepsOf(reps);
  return n ? {lo: n, hi: n} : null;
}
function overloadSuggestion(s, ex){
  var range = repsRangeOf(ex.reps);
  if (!range) return null;
  var sess = exerciseSessions(s, ex, OVERLOAD_SESSIONS);
  if (sess.length < OVERLOAD_SESSIONS) return null;
  var load = null, rirs = [];
  for (var i = 0; i < sess.length; i++){
    var sets = sess[i].sets.filter(function(x){ return x.load > 0; });
    if (!sets.length) return null; // peso do corpo: não há carga para subir
    var top = Math.max.apply(null, sets.map(function(x){ return x.load; }));
    var atTop = sets.filter(function(x){ return Math.abs(x.load - top) < 0.01; });
    if (atTop.length < Math.min(ex.sets || 1, 2)) return null;           // uma série isolada não chega
    if (atTop.some(function(x){ return x.reps < range.hi; })) return null; // todas as séries à carga máxima na meta superior
    if (load != null && Math.abs(load - top) >= 0.01) return null;       // mesma carga nas duas sessões
    load = top;
    if (i === 0) atTop.forEach(function(x){ if (x.rir != null) rirs.push(x.rir); });
  }
  var inc = Math.max(OVERLOAD_MIN_INCREMENT_KG, Math.round(load * OVERLOAD_PCT * 2) / 2);
  var rirAvg = rirs.length ? rirs.reduce(function(a, b){ return a + b; }, 0) / rirs.length : null;
  return {from: load, to: Math.round((load + inc) * 2) / 2, inc: inc, pct: Math.round(inc / load * 1000) / 10, rirAvg: rirAvg, tough: rirAvg != null && rirAvg < 1, range: range};
}
function overloadText(sg){ return "Subir carga: " + fmtKg(sg.to) + " kg (+" + fmtKg(sg.inc) + " kg)"; }
function overloadDetail(sg){
  return "Fizeste " + sg.range.hi + (sg.range.lo !== sg.range.hi ? " (meta máxima)" : "") + " repetições em todas as séries com " + fmtKg(sg.from) + " kg nas últimas " + OVERLOAD_SESSIONS + " sessões. Sobe " + fmtKg(sg.inc) + " kg (≈ " + String(sg.pct).replace(".", ",") + " %) e volta às repetições mais baixas do intervalo." +
    (sg.tough ? " Atenção: as últimas séries ficaram no limite (RIR médio " + String(Math.round(sg.rirAvg * 10) / 10).replace(".", ",") + ") — só sobe se a técnica estiver sólida." : "");
}
function overloadBadgeHtml(sg){ return sg ? "<span class=\"pill good ex-overload\" title=\"" + escapeHtml(overloadDetail(sg)) + "\">📈 " + escapeHtml(overloadText(sg)) + "</span>" : ""; }
function fmtSetDetail(x){ return (x.load > 0 ? fmtKg(x.load) + " kg × " + x.reps : x.reps + " reps") + (x.rir != null ? " · RIR " + x.rir : ""); }
function findProgramExercise(s, exId){
  var out = null;
  trainingProgramOf(s).days.forEach(function(d){ d.exercises.forEach(function(e){ if (e.id === exId) out = e; }); });
  return out;
}
/* ---------- Volume semanal por grupo muscular, deload e recordes ----------
   O grupo de cada exercício vem da biblioteca (ou escolhe-se à mão; os antigos adivinham-se pelo nome). O volume é contado em séries por
   semana, por grupo principal (sem somar os músculos auxiliares): "previstas" = séries do programa (cada dia uma vez por semana) e
   "feitas" = séries registadas pelo aluno nos últimos 7 dias. As zonas são pontos de partida e dependem do objetivo do aluno. */
var VOLUME_ZONES = {
  massa: {lo: 10, hi: 20, label: "ganho de massa"},
  recomp: {lo: 8, hi: 16, label: "recomposição / perda de gordura"},
  manutencao: {lo: 6, hi: 10, label: "manutenção"}
};
var DELOAD_AFTER_WEEKS = 5;      // sem deload há tanto tempo, com treino regular, já se pode considerar um
var DELOAD_MIN_GAP_DAYS = 21;    // depois de um deload não se volta a sugerir durante este tempo
var DELOAD_VOLUME_CUT = 40;      // % de séries a cortar na semana de deload
var MAIN_GROUPS = ["Peito", "Costas", "Ombros", "Quadríceps", "Posteriores"];
// por ordem de prioridade (o primeiro que encaixar ganha): "Lying Leg Curl" é Posteriores e não Bíceps; "Leg Press Calf Raise" é Gémeos
var GROUP_KEYWORDS = [
  ["Gémeos", /calf|g[eé]meo|panturrilha/i],
  ["Core", /plank|prancha|crunch|abdomin|dead ?bug|pallof|\bcore\b|leg raise|eleva[cç][aã]o de pernas|rollout|roda abdominal|ab wheel|bird dog|russian/i],
  ["Posteriores", /deadlift|peso morto|rom[eê]no|romanian|leg curl|curl femoral|hamstring|good morning|hiperext|back extension|nordic/i],
  ["Glúteos", /hip thrust|glute|gl[uú]te|abdu[cç][aã]o|abduction|kickback|coice|ponte de|sumo|reverse lunge|rear lunge|passada reversa/i],
  ["Tríceps", /tr[ií]ceps|pushdown|skull|franc[eê]s|close-?grip bench|press fechado|bench dips|fundos em banco|acima da cabe[cç]a/i],
  ["Bíceps", /curl|rosca|b[ií]ceps/i],
  ["Quadríceps", /agachamento|squat|leg press|extens[aã]o de pernas|leg extension|hack|lunge|afundo|passada|step-?up|b[uú]lgaro|bulgarian/i],
  ["Ombros", /ombro|shoulder|lateral raise|eleva[cç][aã]o (lateral|frontal)|front raise|arnold|face pull|military|overhead press|press militar|rear delt|reverse pec|crucifixo inverso|landmine|rota[cç][aã]o externa|external rotation/i],
  ["Costas", /remada|\brow\b|puxada|pulldown|pull-?up|chin-?up|barra fixa|\blat\b|pullover|shrug|encolhimento|costas|t-bar/i],
  ["Peito", /supino|bench press|incline.*press|press inclinado|peito|chest|\bfly\b|flyes?|crucifixo|crossover|flex[oõ]es|push-?ups?|\bdips?\b|fundos|pec deck|peck/i]
];
var groupIndexCache = null;
function exerciseGroupIndex(){
  var custom = typeof exLibCustomCache !== "undefined" ? exLibCustomCache : null;
  if (groupIndexCache && groupIndexCache.custom === custom) return groupIndexCache.map;
  var map = {};
  exerciseLibraryMerged(custom || []).forEach(function(e){ map[exLibFold(e.name)] = e.group; if (e.alias) map[exLibFold(e.alias)] = e.group; });
  groupIndexCache = {custom: custom, map: map};
  return map;
}
function exerciseGroupFor(name){
  var n = String(name || "").trim();
  if (!n) return "";
  var hit = exerciseGroupIndex()[exLibFold(n)];
  if (hit) return hit;
  for (var i = 0; i < GROUP_KEYWORDS.length; i++) if (GROUP_KEYWORDS[i][1].test(n)) return GROUP_KEYWORDS[i][0];
  return "";
}
function exerciseGroupOf(ex){ return ex && EXERCISE_GROUPS.indexOf(ex.group) >= 0 ? ex.group : exerciseGroupFor(ex && ex.name); }

function volumeZoneFor(s){
  var g = exLibFold(s && s.goal);
  if (/massa|hipertrof|ganho|volume/.test(g)) return VOLUME_ZONES.massa;
  if (/manut/.test(g)) return VOLUME_ZONES.manutencao;
  return VOLUME_ZONES.recomp;
}
function weeklyVolume(s){
  var planned = {}, done = {}, groupById = {}, groupByName = {};
  trainingProgramOf(s).days.forEach(function(d){ d.exercises.forEach(function(e){
    var g = exerciseGroupOf(e) || "Sem grupo";
    planned[g] = (planned[g] || 0) + (Number(e.sets) || 0);
    groupById[e.id] = g; groupByName[exLibFold(e.name)] = g;
  }); });
  sessionsInLastDays(s, 7).forEach(function(l){ (l.entries || []).forEach(function(en){
    var g = groupById[en.exerciseId] || groupByName[exLibFold(en.name)] || exerciseGroupFor(en.name) || "Sem grupo";
    var n = (en.sets || []).filter(function(x){ return x && x.reps > 0; }).length;
    if (n) done[g] = (done[g] || 0) + n;
  }); });
  return {planned: planned, done: done};
}
// uma linha por grupo com trabalho previsto ou feito; estado face à zona do objetivo (previstas) — "baixo" / "ok" / "alto"
function volumeRows(s){
  var v = weeklyVolume(s), z = volumeZoneFor(s), groups = EXERCISE_GROUPS.concat(["Sem grupo"]);
  var rows = groups.filter(function(g){ return v.planned[g] || v.done[g]; }).map(function(g){
    var p = v.planned[g] || 0, status = g === "Sem grupo" ? "" : (p === 0 ? "" : p < z.lo ? "baixo" : p > z.hi ? "alto" : "ok");
    // gémeos e core têm volume próprio mais baixo: só se avisa por excesso
    if ((g === "Gémeos" || g === "Core") && status === "baixo") status = "ok";
    return {group: g, planned: p, done: v.done[g] || 0, status: status};
  });
  var days = trainingProgramOf(s).days.filter(function(d){ return d.exercises.length; }).length;
  var missing = days >= 2 ? MAIN_GROUPS.filter(function(g){ return !v.planned[g]; }) : [];
  return {rows: rows, zone: z, missing: missing, hasProgram: days > 0};
}

function deloadDates(s){
  var p = trainingProgramOf(s);
  return (Array.isArray(p.deloads) ? p.deloads : []).map(function(d){ return d && d.date; }).filter(isIsoDate).sort();
}
function entryAvgRir(en){
  var r = (en.sets || []).filter(function(x){ return x && x.reps > 0 && x.rir != null && isFinite(Number(x.rir)); }).map(function(x){ return Number(x.rir); });
  return r.length >= 2 ? r.reduce(function(a, b){ return a + b; }, 0) / r.length : null;
}
// {level: "sugerir"|"considerar", reasons:[...]} ou null: junta sinais que o app já recolhe (RIR, regressões, energia/sono, semanas sem deload)
function deloadSuggestion(s){
  var logs = (s.workoutLogs || []).slice().sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  if (logs.length < 4) return null;
  var last = deloadDates(s).slice(-1)[0] || null;
  if (last && daysSinceDate(last) < DELOAD_MIN_GAP_DAYS) return null;
  var lastSession = daysSinceDate(logs[logs.length - 1].date);
  if (lastSession != null && lastSession > 14) return null; // já está parado: não é caso de deload
  var reasons = [], strong = 0;
  var hard = logs.slice(-2).map(function(l){ return (l.entries || []).filter(function(en){ var a = entryAvgRir(en); return a != null && a < 1; }).length; });
  if (hard.length === 2 && hard[0] >= 3 && hard[1] >= 3){ reasons.push("RIR médio abaixo de 1 em 3 ou mais exercícios nas últimas 2 sessões"); strong++; }
  var seen = {}, regressed = [];
  logs.forEach(function(l){ (l.entries || []).forEach(function(en){
    var k = exLibFold(en.name); if (seen[k]) return; seen[k] = true;
    var h = exerciseHistory(s, en.exerciseId, en.name);
    if (!h.length || daysSinceDate(h[h.length - 1].date) > SIGNAL_LOAD_WINDOW_DAYS) return;
    if (progressionStatus(baselineHistory(h)) === "regrediu") regressed.push(en.name);
  }); });
  if (regressed.length >= 2){ reasons.push("Cargas a recuar em " + regressed.slice(0, 3).join(", ")); strong++; }
  var ci = (s.checkins || []).slice(-2);
  if (ci.length === 2){
    var vals = [];
    ci.forEach(function(c){ ["energy", "recovery", "sleepQuality"].forEach(function(k){ var v = Number(c[k]); if (v > 0) vals.push(v); }); });
    if (vals.length >= 3 && vals.reduce(function(a, b){ return a + b; }, 0) / vals.length <= 4){ reasons.push("Energia, sono e recuperação baixos nos últimos 2 check-ins"); strong++; }
  }
  var ref = last || logs[0].date, weeks = Math.floor((daysSinceDate(ref) || 0) / 7);
  if (weeks >= DELOAD_AFTER_WEEKS) reasons.push(weeks + " semanas de treino" + (last ? " desde o último deload" : " sem nenhum deload registado"));
  if (!reasons.length) return null;
  return {level: strong >= 2 || (strong >= 1 && weeks >= DELOAD_AFTER_WEEKS) ? "sugerir" : "considerar", reasons: reasons};
}
function registerDeload(s, date){
  var prog = ensureTrainingProgram(s);
  var d = isIsoDate(date) ? date : todayISO();
  if (!Array.isArray(prog.deloads)) prog.deloads = [];
  if (prog.deloads.some(function(x){ return x && x.date === d; })) return false;
  prog.deloads = prog.deloads.concat([{date: d}]).slice(-20);
  return true;
}

// Novo recorde: melhor marca de sempre num exercício (1RM estimado, ou repetições se não há carga), com pelo menos 2 sessões anteriores
function detectRecords(s, log){
  var before = {workoutLogs: (s.workoutLogs || []).filter(function(l){ return l !== log && l.id !== log.id; })};
  var out = [];
  (log.entries || []).forEach(function(en){
    var st = workoutEntryStats(en);
    if (!st.sets) return;
    var hist = exerciseHistory(before, en.exerciseId, en.name).filter(function(h){ return h.kind === st.kind; });
    if (hist.length < 2) return;
    var best = Math.max.apply(null, hist.map(function(h){ return h.score; }));
    if (st.score > best) out.push({name: en.name, kind: st.kind, top: st.topSet, score: st.score});
  });
  return out;
}
function recordMessage(records){
  if (!records.length) return "";
  var r = records[0], what = r.kind === "load" ? fmtLoadSet(r.top) : r.score + " repetições";
  return "🏆 Novo recorde" + (records.length > 1 ? " (+" + (records.length - 1) + ")" : "") + ": " + r.name + " — " + what;
}

function tplVolumeAndDeload(s){
  var vr = volumeRows(s), dl = deloadSuggestion(s);
  if (!vr.hasProgram && !(s.workoutLogs || []).length) return "";
  var html = "<div class=\"eyebrow\" style=\"margin:22px 0 8px;\">Volume semanal (séries por grupo)</div>";
  if (vr.rows.length){
    var pill = {"baixo": "warn", "ok": "good", "alto": "critical", "": ""}, txt = {"baixo": "abaixo", "ok": "na zona", "alto": "acima", "": "—"};
    html += "<p class=\"muted-p\" style=\"margin-bottom:8px;\">Zona de referência para " + escapeHtml(vr.zone.label) + ": " + vr.zone.lo + "–" + vr.zone.hi + " séries por grupo e por semana (compara com as previstas no programa).</p>" +
      "<div class=\"assess-table-scroll\"><table class=\"assess-table\" id=\"volumeTable\"><thead><tr><th>Grupo</th><th>Previstas</th><th>Feitas (7 d)</th><th>Estado</th></tr></thead><tbody>" +
      vr.rows.map(function(r){ return "<tr><td class=\"date-cell\" style=\"white-space:normal;\">" + escapeHtml(r.group) + "</td><td>" + r.planned + "</td><td>" + r.done + "</td><td>" + (r.status ? "<span class=\"pill " + pill[r.status] + "\">" + txt[r.status] + "</span>" : "—") + "</td></tr>"; }).join("") +
      "</tbody></table></div>";
    if (vr.missing.length) html += "<p class=\"muted-p\" style=\"margin-top:8px;\">Sem trabalho previsto para: " + escapeHtml(vr.missing.join(", ")) + ".</p>";
  } else html += "<p class=\"muted-p\">Ainda sem exercícios no programa nem sessões registadas.</p>";
  html += "<div class=\"eyebrow\" style=\"margin:22px 0 8px;\">Deload</div>";
  var dates = deloadDates(s), lastD = dates[dates.length - 1];
  if (dl){
    html += "<div class=\"card\" id=\"deloadCard\" style=\"margin-bottom:10px;\"><p style=\"margin-bottom:6px;\"><span class=\"pill " + (dl.level === "sugerir" ? "warn" : "") + "\">" + (dl.level === "sugerir" ? "Sugerir deload" : "Considerar deload") + "</span></p>" +
      "<ul class=\"muted-p\" style=\"margin:0 0 8px 18px;\">" + dl.reasons.map(function(r){ return "<li>" + escapeHtml(r) + "</li>"; }).join("") + "</ul>" +
      "<p class=\"muted-p\" style=\"margin-bottom:10px;\">Semana de deload: mantém os exercícios e as cargas, corta cerca de " + DELOAD_VOLUME_CUT + "% das séries, pára 3 repetições antes da falha (RIR 3) e prioriza sono e recuperação. Depois volta ao plano normal.</p>" +
      "<button type=\"button\" class=\"btn btn-sm primary\" id=\"registerDeload\">Registar deload a começar hoje</button></div>";
  } else html += "<p class=\"muted-p\">" + (lastD ? "Último deload: " + escapeHtml(fmtDateFullPt(lastD)) + ". " : "") + "Sem sinais de fadiga acumulada neste momento.</p>";
  return html;
}

function exerciseInfoHtml(s, ex){
  var cues = parseCues(ex.cues), sg = overloadSuggestion(s, ex), sess = exerciseSessions(s, ex, 6);
  var html = "<div class=\"mtitle\">" + escapeHtml(ex.name) + "</div>" +
    "<p class=\"muted-p\" style=\"margin-bottom:10px;\">" + ex.sets + " × " + escapeHtml(ex.reps) + (ex.rpe ? " · RPE " + ex.rpe : "") + (ex.rest != null ? " · descanso " + ex.rest + " s" : "") + "</p>" +
    exerciseMediaHtml(ex.demo);
  if (cues.length) html += "<div class=\"eyebrow\" style=\"margin:12px 0 6px;\">Pontos-chave</div><ol class=\"ex-cues\">" + cues.map(function(c){ return "<li>" + escapeHtml(c) + "</li>"; }).join("") + "</ol>";
  else if (!cleanDemoUrl(ex.demo)) html += "<p class=\"muted-p\" style=\"margin-top:10px;\">O profissional ainda não acrescentou demonstração nem pontos-chave a este exercício.</p>";
  if (ex.notes) html += "<p class=\"muted-p\" style=\"margin-top:10px;\">" + escapeHtml(ex.notes) + "</p>";
  if (sg) html += "<div style=\"margin-top:12px;\">" + overloadBadgeHtml(sg) + "<p class=\"muted-p\" style=\"margin-top:6px;\">" + escapeHtml(overloadDetail(sg)) + "</p></div>";
  html += "<div class=\"eyebrow\" style=\"margin:16px 0 6px;\">Histórico de cargas</div>";
  if (!sess.length) html += "<p class=\"muted-p\">Ainda sem sessões registadas deste exercício.</p>";
  else html += sess.map(function(x){
    return "<div class=\"history-row\" style=\"align-items:flex-start;\"><div class=\"hlabel\">" + escapeHtml(fmtDatePt(x.date)) + "</div><div class=\"hval\" style=\"text-align:right; font-size:0.78rem;\">" + x.sets.map(function(st){ return escapeHtml(fmtSetDetail(st)); }).join("<br>") + "</div></div>";
  }).join("");
  var hist = sameKindHistory(exerciseHistory(s, ex.id, ex.name));
  if (hist.length >= 2) html += "<div class=\"muted-p\" style=\"margin:12px 0 4px; font-size:0.74rem;\">Evolução (" + (hist[hist.length - 1].kind === "load" ? "1RM estimado, kg" : "repetições máximas") + ")</div><div class=\"weight-chart-wrap\">" + weightSvg(hist.map(function(h){ return {date: h.date, w: h.score}; })) + "</div>";
  return html;
}
function openExerciseInfo(s, exId){
  var ex = findProgramExercise(s, exId);
  return ex ? openModal(exerciseInfoHtml(s, ex)) : null;
}
function wireExerciseInfo(s, el){
  el.querySelectorAll("[data-ex-info]").forEach(function(b){
    b.addEventListener("click", function(){ openExerciseInfo(s, b.getAttribute("data-ex-info")); });
  });
}

function tplWorkoutLogger(s){
  var days = workoutDaysWithExercises(s);
  if (!days.length){
    return `<div class="card"><div class="eyebrow">Treino</div><p class="muted-p" style="margin-top:6px;">O teu programa de treino ainda está a ser preparado pelo profissional.</p></div>`;
  }
  var selected = workoutDayFor(s);
  var draft = wlDraftGet(s, selected.id);
  var html = `<div class="card wl-card">` +
    `<div class="checkin-field"${days.length < 2 ? " hidden" : ""}><label for="wlDay">Mudar de treino</label><select id="wlDay" class="mini-select" style="width:100%;">` +
      days.map(function(d){ return `<option value="${escapeHtml(d.id)}"${d.id === selected.id ? " selected" : ""}>${escapeHtml(d.name)}</option>`; }).join("") +
    `</select></div>` +
    `<p class="muted-p wl-hint">Toca em ✓ ao acabar cada série: o descanso começa sozinho.</p>`;
  selected.exercises.forEach(function(e){
    var hist = exerciseHistory(s, e.id, e.name), last = hist[hist.length - 1];
    var presc = e.sets + " × " + escapeHtml(e.reps) + (e.rpe ? " · RPE " + e.rpe : "") + (e.rest != null ? " · descanso " + e.rest + " s" : "");
    html += `<div class="wl-ex" data-ex="${escapeHtml(e.id)}">` +
      `<div class="wl-ex-name"><button type="button" class="wl-info" data-ex-info="${escapeHtml(e.id)}" aria-label="Ver demonstração de ${escapeHtml(e.name)}">${escapeHtml(e.name)} <span aria-hidden="true">ⓘ</span></button></div>` +
      `<div class="muted-p wl-ex-presc">${presc}</div>` +
      (e.notes ? `<div class="muted-p wl-ex-note">${escapeHtml(e.notes)}</div>` : "") +
      (last ? `<div class="wl-ex-last">Última vez (${fmtDatePt(last.date)}): ${escapeHtml(fmtLoadSet(last.topSet))}</div>` : "");
    var overload = overloadSuggestion(s, e);
    if (overload) html += `<div class="wl-ex-overload">${overloadBadgeHtml(overload)}</div>`;
    var prefillLoad = overload ? overload.to : (last && last.topSet && last.topSet.load > 0 ? last.topSet.load : "");
    var restSec = e.rest != null ? e.rest : REST_DEFAULT_SECONDS;
    for (var i = 0; i < e.sets; i++){
      var key = escapeHtml(e.id) + ":" + i, d = draft.sets[e.id + ":" + i] || {};
      var repsVal = d.reps !== undefined ? d.reps : (firstRepsOf(e.reps) || ""), loadVal = d.load !== undefined ? d.load : prefillLoad, rirVal = d.rir !== undefined ? d.rir : "";
      var step = function(kind, delta, label){ return `<button type="button" class="wl-step" data-step-kind="${kind}" data-step-key="${key}" data-step-delta="${delta}" aria-label="${label} na série ${i + 1}">${delta < 0 ? "−" : "+"}</button>`; };
      html += `<div class="wl-set${d.done ? " done" : ""}">` +
        `<div class="wl-fields">` +
          `<div class="wl-field"><span class="wl-lbl">kg</span>` + step("load", -2.5, "Menos 2,5 kg") +
            `<input type="number" inputmode="decimal" step="0.5" min="0" placeholder="kg" aria-label="Carga em kg da série ${i + 1}" data-wl-load="${key}" value="${escapeHtml(loadVal)}">` +
            step("load", 2.5, "Mais 2,5 kg") + `</div>` +
          `<div class="wl-field"><span class="wl-lbl">reps</span>` + step("reps", -1, "Menos uma repetição") +
            `<input type="number" inputmode="numeric" min="0" max="100" placeholder="reps" aria-label="Repetições da série ${i + 1}" data-wl-reps="${key}" value="${escapeHtml(repsVal)}">` +
            step("reps", 1, "Mais uma repetição") + `</div>` +
          `<div class="wl-field"><span class="wl-lbl">rir</span>` + step("rir", -1, "Menos 1 de RIR") +
            `<input type="number" inputmode="numeric" min="0" max="10" placeholder="RIR" aria-label="RIR (repetições em reserva) da série ${i + 1}" data-wl-rir="${key}" value="${escapeHtml(rirVal)}">` +
            step("rir", 1, "Mais 1 de RIR") + `</div>` +
        `</div>` +
        `<label class="wl-done"><input type="checkbox" data-wl-done="${key}" data-rest-start="${restSec}" data-rest-label="${escapeHtml(e.name)}" aria-label="Série ${i + 1} feita"${d.done ? " checked" : ""}><span class="wl-tick" aria-hidden="true">✓</span><small>Série ${i + 1}</small></label>` +
      `</div>`;
    }
    html += `</div>`;
  });
  html += `<details class="soft-details wl-timer"><summary>Cronómetro de descanso livre</summary><div class="rt-presets">` +
      REST_PRESETS.map(function(sec){ return `<button type="button" data-rest-start="${sec}" data-rest-label="Descanso">${sec >= 60 && sec % 60 === 0 ? (sec / 60) + " min" : sec + " s"}</button>`; }).join("") +
    `</div></details>` +
    `<div style="margin-top:18px;">` + rangeField("wlRpe", "Esforço da sessão (RPE 1-10)", draft.rpe || 7) + `</div>` +
    `<details class="soft-details"${draft.notes ? " open" : ""}><summary>Como correu? (opcional)</summary><div class="checkin-field" style="margin-top:8px;"><label for="wlNotes" class="sr-only">Como correu?</label><textarea id="wlNotes" maxlength="500" placeholder="Dores, sensações, o que mudar...">${escapeHtml(draft.notes || "")}</textarea></div></details>` +
    `<p class="muted-p" id="wlError" style="color:var(--critical); display:none; margin-bottom:10px;"></p>` +
    `<button type="button" class="btn primary big" id="wlSave">Terminar treino</button></div>`;
  return html;
}

var uiTapGuardUntil = 0; // depois de terminar o treino ignora toques rápidos que cairiam em 'Hoje'
var wlSaving = {}; // alunos com uma gravação de treino em curso (id → true): impede duplo toque enquanto o pedido está a meio
function wireWorkoutLogger(s, el, rerender){
  var daySel = el.querySelector("#wlDay");
  if (daySel) daySel.addEventListener("change", function(){ state.workoutDayId = daySel.value; rerender(); });
  wireExerciseInfo(s, el);
  var save = el.querySelector("#wlSave");
  var dayId = daySel ? daySel.value : null;
  // cada alteração fica no rascunho (séries, esforço, notas) — sobrevive a mudar de separador
  function recordDraft(target){
    if (!dayId) return;
    var draft = wlDraftGet(s, dayId);
    var r = target.getAttribute && target.getAttribute("data-wl-reps"), l = target.getAttribute && target.getAttribute("data-wl-load"), d = target.getAttribute && target.getAttribute("data-wl-done"), ri = target.getAttribute && target.getAttribute("data-wl-rir");
    if (r){ (draft.sets[r] = draft.sets[r] || {}).reps = target.value; }
    else if (ri){ (draft.sets[ri] = draft.sets[ri] || {}).rir = target.value; }
    else if (l){ (draft.sets[l] = draft.sets[l] || {}).load = target.value; }
    else if (d){ (draft.sets[d] = draft.sets[d] || {}).done = !!target.checked; }
    else if (target.id === "wlRpe") draft.rpe = parseInt(target.value, 10) || null;
    else if (target.id === "wlNotes") draft.notes = target.value;
    wlDraftSave(draft);
  }
  // ligado a cada campo (o contentor #alunoTabContent é reutilizado entre desenhos: um listener nele acumular-se-ia)
  el.querySelectorAll("[data-wl-reps], [data-wl-load], [data-wl-rir], [data-wl-done], #wlRpe, #wlNotes").forEach(function(field){
    ["input", "change"].forEach(function(evt){ field.addEventListener(evt, function(){ recordDraft(field); }); });
  });
  // o tamanho da série muda com os botões − / + (carga de 2,5 em 2,5 kg; repetições de 1 em 1) e fica no rascunho
  el.querySelectorAll("[data-step-key]").forEach(function(b){
    b.addEventListener("click", function(){
      var kind = b.getAttribute("data-step-kind"), key = b.getAttribute("data-step-key"), delta = parseFloat(b.getAttribute("data-step-delta"));
      var input = el.querySelector('[data-wl-' + kind + '="' + key + '"]');
      if (!input || !isFinite(delta)) return;
      var cur = parseFloat(input.value), next = Math.max(0, Math.round(((isFinite(cur) ? cur : 0) + delta) * 10) / 10);
      if (kind === "reps") next = Math.min(100, Math.round(next));
      if (kind === "rir") next = Math.min(10, Math.round(next));
      input.value = String(next);
      recordDraft(input);
    });
  });
  // ✓ numa série: marca-a, avança o progresso e começa sozinho o descanso prescrito (desmarcar não faz nada)
  function updateProgress(){
    var boxes = el.querySelectorAll("[data-wl-done]"), n = 0;
    boxes.forEach(function(b){ if (b.checked) n++; });
    var fill = el.querySelector("#wlProgressFill"), txt = el.querySelector("#wlProgressText");
    if (fill) fill.style.width = (boxes.length ? Math.round(n / boxes.length * 100) : 0) + "%";
    if (txt) txt.textContent = n + "/" + boxes.length + " séries";
  }
  el.querySelectorAll("[data-wl-done]").forEach(function(box){
    box.addEventListener("change", function(){
      var row = box.closest ? box.closest(".wl-set") : null;
      if (row) row.classList.toggle("done", !!box.checked);
      updateProgress();
      if (!box.checked) return;
      var secs = parseInt(box.getAttribute("data-rest-start"), 10);
      if (secs >= 5) restTimerStart(secs, box.getAttribute("data-rest-label")); // descanso 0 s: só marca a série como feita
    });
  });
  // atalhos do cronómetro livre (30 s a 3 min)
  el.querySelectorAll("button[data-rest-start]").forEach(function(b){
    b.addEventListener("click", function(){
      var secs = parseInt(b.getAttribute("data-rest-start"), 10);
      if (secs >= 5) restTimerStart(secs, b.getAttribute("data-rest-label"));
    });
  });
  if (!save) return;
  var rpeInput = el.querySelector("#wlRpe");
  if (rpeInput) rpeInput.addEventListener("input", function(){ el.querySelector("#wlRpeVal").textContent = rpeInput.value; rpeInput.style.setProperty("--p", rangeFill(rpeInput.value) + "%"); });
  save.addEventListener("click", function(){
    var err = el.querySelector("#wlError");
    if (wlSaving[s.id]){ err.textContent = "A guardar o treino… aguarda um instante."; err.style.display = "block"; return; } // duplo toque / formulário reconstruído durante o pedido
    var day = trainingProgramOf(s).days.filter(function(d){ return d.id === daySel.value; })[0];
    if (!day) return;
    var entries = day.exercises.map(function(e){
      var sets = [];
      for (var i = 0; i < e.sets; i++){
        var box = el.querySelector('[data-wl-done="' + e.id + ':' + i + '"]');
        if (!box || !box.checked) continue; // só as séries marcadas como feitas
        var r = parseFloat((el.querySelector('[data-wl-reps="' + e.id + ':' + i + '"]') || {}).value);
        var l = parseFloat((el.querySelector('[data-wl-load="' + e.id + ':' + i + '"]') || {}).value);
        var ri = parseInt((el.querySelector('[data-wl-rir="' + e.id + ':' + i + '"]') || {}).value, 10);
        if (r > 0){ var one = {reps: r, load: l > 0 ? l : 0}; if (ri >= 0 && ri <= 10) one.rir = ri; sets.push(one); }
      }
      return {exerciseId: e.id, name: e.name, sets: sets};
    });
    var invalid = entries.some(function(e){ return e.sets.some(function(x){ return x.reps > 100 || x.load > 1000; }); });
    if (invalid){ err.textContent = "Verifica os valores: máx. 100 repetições e 1000 kg."; err.style.display = "block"; return; }
    var log = logWorkout(s, {date: todayISO(), dayId: day.id, dayName: day.name, rpe: rpeInput.value, notes: el.querySelector("#wlNotes").value, entries: entries});
    if (!log){ err.textContent = "Marca ✓ pelo menos uma série feita, com repetições."; err.style.display = "block"; return; }
    err.style.display = "none";
    var records = detectRecords(s, log), recordMsg = recordMessage(records);
    function finish(){
      if (recordMsg) setTimeout(function(){ showToast(recordMsg); }, 1800); // depois do "Treino guardado"
      // treino feito: nenhum dia fica 'em curso' (o rascunho abandonado de outro dia seria enganador)
      trainingProgramOf(s).days.forEach(function(d){ if (d.id !== day.id) wlDraftClear(s, d.id); });
      wlDraftClear(s, day.id);
      restTimerStop(); // o treino acabou: o descanso já não faz sentido
      state.workoutDayId = null;
      // o pedido é assíncrono (profissional): só se redesenha se este aluno e este separador ainda estiverem no ecrã
      if (state.alunoTab === "treino" && (authRole !== "professional" || !state.alunoStudentId || String(state.alunoStudentId) === String(s.id))){
        state.alunoTab = "hoje"; // terminado: volta a "Hoje", onde aparece "Treino feito"
        uiTapGuardUntil = Date.now() + 700;
        try { window.scrollTo(0, 0); } catch (e) {}
        rerender();
      }
    }
    if (authRole === "professional" && sbReady){
      // só se dá como guardado (e só se apaga o rascunho) depois de o servidor aceitar; se falhar, desfaz-se e o rascunho fica
      var idleLabel = save.textContent;
      wlSaving[s.id] = true; save.disabled = true; save.textContent = "A guardar…";
      Promise.resolve().then(function(){ return appendWorkoutLogAsPro(s, log); }).then(function(ok){
        if (!ok) throw new Error("columns");
        delete wlSaving[s.id];
        showToast("✓ Treino guardado"); finish();
      }).catch(function(e){
        delete wlSaving[s.id];
        undoWorkoutLog(s, log);
        save.disabled = false; save.textContent = idleLabel;
        showToast(e && e.message === "columns" ? "⚠ O treino ainda não pode ser guardado: falta correr a migração 0019 no Supabase." : "⚠ Não foi possível guardar o treino — verifica a tua ligação");
      });
      return;
    }
    var how = persistStudent(s);
    showToast(how === "queued" ? "✓ Treino guardado neste telemóvel — segue assim que houver rede" : "✓ Treino guardado");
    finish();
  });
}

/* ---------- Biblioteca de exercícios (partilhada pelo estúdio) ----------
   Lista base no código, por grupo muscular; a demonstração é uma pesquisa de vídeo (o PT pode trocá-la por um vídeo do estúdio).
   O que os profissionais acrescentam ou corrigem fica na tabela exercise_library (partilhada por todos); em modo local, neste browser.
   Um exercício guardado com o mesmo nome de um da lista base substitui-o; apagá-lo repõe o original. */
var EXERCISE_GROUPS = ["Peito", "Costas", "Ombros", "Bíceps", "Tríceps", "Quadríceps", "Posteriores", "Glúteos", "Gémeos", "Core"];
var EX_LIB_LOCAL_KEY = "evolve_exercise_library_v1";
var exLibCustomCache = null; // exercícios do estúdio já lidos (para adivinhar o grupo de um exercício pelo nome)
// animações de 2 fotogramas (Free Exercise DB, domínio público) guardadas na pasta exercises/ do site
var EXERCISE_MEDIA_BASE = "https://tiagojvlourenco.github.io/plano-evolve/exercises/";
// [nome em inglês, equipamento, "ponto 1|ponto 2|ponto 3", nota, nome em português (só para a pesquisa), 1 = tem animação em exercises/]
var EXERCISE_SEED = {
  "Peito": [
    ["Barbell Bench Press", "Barra", "Omoplatas juntas e para baixo|Barra desce ao meio do peito, cotovelos a ~45°|Pés firmes no chão", "", "Supino reto com barra", 1],
    ["Dumbbell Bench Press", "Halteres", "Omoplatas fixas no banco|Desce com controlo até ao alongamento do peito|Junta os halteres sem os bater em cima", "", "Supino reto com halteres", 1],
    ["Incline Dumbbell Press", "Halteres", "Banco a 30°, omoplatas juntas|Pega neutra ou semi-neutra, cotovelos a ~45°|Não deixes os ombros subirem para as orelhas", "Bom para ombro sensível com pega neutra", "Supino inclinado com halteres", 1],
    ["Incline Barbell Press", "Barra", "Banco a 30°, peito alto|Barra desce à parte alta do peito|Empurra em linha reta, sem arquear em excesso", "", "Supino inclinado com barra", 1],
    ["Machine Chest Press", "Máquina", "Ajusta o banco: pegas à altura do peito|Empurra sem bloquear os cotovelos|Contrai o peito no fim", "Estável e seguro para ombro sensível", "Press de peito na máquina", 1],
    ["Smith Machine Incline Press", "Smith", "Omoplatas juntas e para baixo|Desce à parte alta do peito|Pés bem apoiados", "", "Press inclinado na máquina Smith", 1],
    ["Low Cable Fly", "Cabo", "Cotovelo ligeiramente fletido e fixo|Faz um arco como se abraçasses|Termina à altura do peito", "", "Crucifixo no cabo (baixo para cima)", 1],
    ["Pec Deck Fly", "Máquina", "Peito aberto, omoplatas atrás|Cotovelos ligeiramente fletidos|Controla a volta, sem deixar o peso bater", "", "Crucifixo na máquina (peck deck)", 1],
    ["Cable Crossover", "Cabo", "Peito aberto, tronco ligeiramente inclinado|Cotovelos ligeiramente fletidos|Junta as mãos à frente do peito", "", "Crossover no cabo (alto para baixo)", 1],
    ["Push-Up", "Peso corporal", "Corpo em linha, glúteo e abdómen contraídos|Cotovelos a ~45° do tronco|Peito desce até perto do chão", "", "Flexões", 1],
    ["Incline Push-Up", "Peso corporal", "Mãos num banco ou barra|Corpo em linha reta|Desce com controlo e empurra com força", "Regressão das flexões e boa para o ombro", "Flexões com apoio elevado", 1],
    ["Chest Dips", "Paralelas", "Tronco ligeiramente inclinado à frente|Desce até onde o ombro estiver confortável|Sem balançar", "Evitar com dor no ombro", "Fundos nas paralelas (peito)", 1]
  ],
  "Costas": [
    ["Wide-Grip Lat Pulldown", "Cabo", "Peito ao puxador, ombros longe das orelhas|Cotovelos para as ancas|Sem balançar o tronco", "", "Puxada à frente (pega aberta)", 1],
    ["Neutral-Grip Lat Pulldown", "Cabo", "Peito ao puxador|Cotovelos para as ancas|Alonga em cima sem largar as omoplatas", "Pega neutra: mais amiga do ombro", "Puxada com pega neutra (em V)", 1],
    ["Pull-Up", "Barra fixa", "Começa por baixar as omoplatas|Cotovelos para as ancas|Desce até ao alongamento completo", "", "Barra fixa", 1],
    ["Seated Cable Row", "Cabo", "Peito aberto, costas neutras|Puxa com os cotovelos, não com as mãos|Pausa de 1 s com as omoplatas juntas", "", "Remada sentada no cabo", 1],
    ["Single-Arm Lat Pulldown", "Cabo", "Ombro baixo, tronco firme|Cotovelo para a anca|Alonga a omoplata em cima sem a largar", "Boa para corrigir assimetrias", "Puxada unilateral no cabo", 1],
    ["Chest-Supported Machine Row", "Máquina", "Peito colado ao apoio|Deprime as omoplatas antes de puxar|Cotovelos junto ao tronco", "Muito estável, boa para ombro sensível", "Remada com apoio no peito (máquina)", 1],
    ["Barbell Bent-Over Row", "Barra", "Tronco a ~45°, costas neutras|Barra sobe ao umbigo|Sem usar o balanço das ancas", "", "Remada com barra", 1],
    ["One-Arm Dumbbell Row", "Halteres", "Mão e joelho apoiados, costas planas|Cotovelo vai para a anca|Alonga a omoplata em baixo", "", "Remada com haltere apoiada no banco", 1],
    ["T-Bar Row", "Barra T", "Costas neutras, peito alto|Puxa com os cotovelos|Aperta as omoplatas no topo", "", "Remada em T (T-bar)", 1],
    ["Cable Straight-Arm Pulldown", "Cabo", "Braços quase esticados|Desce em arco até às coxas|Costelas baixas, sem arquear a lombar", "", "Pullover no cabo", 1],
    ["Dumbbell Shrug", "Halteres", "Sobe os ombros em linha reta, sem rodar|Pausa de 1 s em cima|Desce devagar", "", "Encolhimentos com halteres", 1]
  ],
  "Ombros": [
    ["Seated Dumbbell Shoulder Press", "Halteres", "Costas encostadas, abdómen firme|Cotovelos ligeiramente à frente do corpo|Sobe sem encolher os ombros", "Evitar com dor acima da cabeça", "Press de ombros com halteres sentado", 1],
    ["Machine Shoulder Press", "Máquina", "Costas encostadas ao banco|Empurra sem bloquear os cotovelos|Desce até onde o ombro estiver confortável", "", "Press de ombros na máquina", 1],
    ["Landmine Press", "Barra (landmine)", "Empurra para cima e ligeiramente para a frente|Glúteo contraído, tronco firme|Omoplata a deslizar, sem encolher", "Alternativa amiga do ombro ao press vertical", "Landmine press", 0],
    ["Dumbbell Lateral Raise", "Halteres", "Sobe o cotovelo, não a mão|Para à altura do ombro|Sem balançar o tronco", "", "Elevação lateral com halteres", 1],
    ["Cable Lateral Raise", "Cabo", "Tensão constante desde o início|Sobe o cotovelo, não a mão|Para abaixo da linha do ombro", "", "Elevação lateral no cabo", 1],
    ["Arnold Press", "Halteres", "Começa com as palmas viradas para ti|Roda os punhos ao subir|Costas encostadas, sem arquear", "Evitar com dor acima da cabeça", "Press Arnold", 1],
    ["Cable Front Raise", "Cabo", "Braço quase esticado|Sobe até à altura do ombro|Sem inclinar o tronco para trás", "", "Elevação frontal com cabo", 1],
    ["Face Pull", "Cabo", "Puxa a corda à altura do rosto|Cotovelos altos, abrem para os lados|Roda os punhos para fora no fim", "Excelente para saúde do ombro", "Face pull", 1],
    ["Reverse Pec Deck Fly", "Máquina", "Peito apoiado, ombros baixos|Abre os braços com os cotovelos|Sem encolher os ombros", "", "Crucifixo inverso na máquina", 1],
    ["Cable External Rotation", "Cabo", "Cotovelo colado ao tronco a 90°|Roda o antebraço para fora, devagar|Carga leve, séries limpas", "Aquecimento e prevenção do ombro", "Rotação externa no cabo", 1]
  ],
  "Bíceps": [
    ["Barbell Curl", "Barra", "Cotovelos fixos ao lado do tronco|Sem balançar o corpo|Desce com controlo até esticar", "", "Rosca direta com barra", 1],
    ["Alternating Dumbbell Curl", "Halteres", "Palmas viradas para cima|Cotovelo fixo|Roda o punho ao subir", "", "Rosca alternada com halteres", 1],
    ["Hammer Curl", "Halteres", "Pega neutra, cotovelos fixos|Sem inclinar o tronco|Controla a descida", "", "Rosca martelo", 1],
    ["Incline Dumbbell Curl", "Halteres", "Banco a 45°, braços a pender|Cotovelo para trás do tronco|Alongamento completo em baixo", "", "Rosca inclinada com halteres", 1],
    ["Cable Curl", "Cabo", "Cotovelos fixos|Tensão constante|Pausa de 1 s em cima", "", "Rosca no cabo", 1],
    ["Cable Hammer Curl", "Cabo", "Cotovelo fixo ao lado do tronco|Pega neutra com corda|Pausa de 1 s em cima", "", "Rosca martelo no cabo", 1],
    ["Machine Preacher Curl", "Máquina", "Axilas bem apoiadas no banco|Não deixes o cotovelo sair do apoio|Desce devagar, sem largar o peso", "", "Rosca Scott na máquina", 1]
  ],
  "Tríceps": [
    ["Triceps Pushdown", "Cabo", "Cotovelos colados ao tronco|Bloqueio completo em baixo|Só o antebraço se mexe", "", "Extensão de tríceps na polia", 1],
    ["Single-Arm Triceps Pushdown", "Cabo", "Cotovelo colado ao tronco|Bloqueio completo em baixo|Só o antebraço se mexe", "", "Extensão de tríceps unilateral na polia", 1],
    ["Overhead Cable Triceps Extension", "Cabo", "Cotovelos apontados para a frente|Alonga bem o tríceps em baixo|Costelas baixas, sem arquear", "", "Extensão acima da cabeça no cabo", 1],
    ["EZ-Bar Skullcrusher", "Barra EZ", "Cotovelos apontam ao teto, fixos|Desce atrás da cabeça com controlo|Estende sem abrir os cotovelos", "", "Press francês com barra EZ", 1],
    ["Close-Grip Bench Press", "Barra", "Pega à largura dos ombros|Cotovelos junto ao tronco|Empurra em linha reta", "", "Press fechado", 1],
    ["Bench Dips", "Peso corporal", "Ombros afastados das orelhas|Cotovelos para trás, juntos|Desce só até onde o ombro estiver confortável", "Evitar com dor no ombro", "Fundos em banco", 1],
    ["Triceps Dips", "Paralelas", "Tronco vertical|Cotovelos junto ao corpo|Estende por completo em cima", "Evitar com dor no ombro", "Fundos nas paralelas (tríceps)", 1]
  ],
  "Quadríceps": [
    ["Barbell Back Squat", "Barra", "Peito alto, abdómen firme|Joelhos na direção dos pés|Desce com controlo até à amplitude que mantiveres limpa", "", "Agachamento livre com barra", 1],
    ["Barbell Front Squat", "Barra", "Cotovelos altos, barra apoiada nos ombros|Tronco vertical|Joelhos para a frente, calcanhares no chão", "", "Agachamento frontal", 1],
    ["Goblet Squat", "Haltere", "Haltere junto ao peito, cotovelos dentro dos joelhos|Tronco vertical|Pés todos apoiados", "", "Agachamento goblet", 1],
    ["Leg Press", "Máquina", "Lombar colada ao banco|Joelhos na direção dos pés|Amplitude máxima sem a bacia levantar", "", "Leg press 45°", 1],
    ["Single-Leg Press", "Máquina", "Bacia e lombar coladas ao banco|Joelho alinhado com o pé|Amplitude controlada", "", "Leg press unilateral", 0],
    ["Hack Squat", "Máquina", "Costas e bacia coladas ao apoio|Pés à largura dos ombros|Desce até onde mantiveres a lombar colada", "", "Hack squat", 1],
    ["Bulgarian Split Squat", "Halteres", "Tronco ligeiramente inclinado à frente|Pé da frente todo apoiado|Desce na vertical, não para a frente", "", "Agachamento búlgaro", 0],
    ["Leg Extension", "Máquina", "Bacia colada ao banco|Pausa de 1 s em cima|Desce devagar", "", "Extensão de pernas", 1],
    ["Walking Lunge", "Halteres", "Passos largos, tronco firme|Joelho da frente alinhado com o pé|Desce na vertical", "", "Passada andante", 1],
    ["Dumbbell Step-Up", "Halteres", "Pé todo apoiado no banco|Empurra com a perna da frente|Desce com controlo", "", "Step-up", 1]
  ],
  "Posteriores": [
    ["Romanian Deadlift", "Barra ou halteres", "Empurra a anca para trás|Barra colada às pernas, costas neutras|Para quando sentires o alongamento atrás da coxa", "", "Peso morto romeno", 1],
    ["Single-Leg Romanian Deadlift", "Halteres", "Anca para trás, perna de trás em linha com o tronco|Costas neutras|Mantém a bacia nivelada", "", "Peso morto unilateral com haltere", 1],
    ["Conventional Deadlift", "Barra", "Costas neutras, peito alto|Empurra o chão com os pés|Barra sempre colada ao corpo", "", "Peso morto convencional", 1],
    ["Lying Leg Curl", "Máquina", "Bacia colada ao banco|Sobe sem levantar a anca|Desce em 3 s", "", "Curl femoral deitado", 1],
    ["Seated Leg Curl", "Máquina", "Anca fixa no banco|Controla a fase de volta com 3 s|Amplitude completa", "", "Curl femoral sentado", 1],
    ["45° Back Extension", "Banco romano", "Costas neutras, não hiperestendas|Sobe com os glúteos e posteriores|Cruza os braços ao peito", "", "Hiperextensão a 45°", 1],
    ["Nordic Hamstring Curl", "Peso corporal", "Joelhos fixos e corpo em linha|Desce o mais devagar possível|Usa as mãos para ajudar a subir", "", "Nordic curl", 1]
  ],
  "Glúteos": [
    ["Barbell Hip Thrust", "Barra", "Queixo para o peito, costelas baixas|Empurra pelos calcanhares|Pausa de 2 s com glúteo contraído", "", "Hip thrust", 1],
    ["Dumbbell Reverse Lunge", "Halteres", "Passo largo para trás|Tronco ligeiramente inclinado à frente|Empurra pelo calcanhar da frente", "", "Passada reversa", 1],
    ["Glute Bridge", "Peso corporal", "Pés perto do glúteo|Sobe a bacia sem arquear a lombar|Contrai no topo", "", "Ponte de glúteos", 1],
    ["Machine Hip Abduction", "Máquina", "Tronco ligeiramente inclinado à frente|Abre com os glúteos, não com o balanço|Controla a volta", "", "Abdução na máquina", 1],
    ["Cable Hip Abduction", "Cabo", "Tronco ligeiramente inclinado|Sem rodar a bacia|Pausa de 1 s no fim", "", "Abdução no cabo", 0],
    ["Cable Glute Kickback", "Cabo", "Lombar neutra|Estende a anca sem arquear as costas|Contrai o glúteo no fim", "", "Coice no cabo (kickback)", 1],
    ["Dumbbell Sumo Squat", "Haltere", "Pés largos, pontas para fora|Joelhos na direção dos pés|Tronco vertical", "", "Agachamento sumo", 1]
  ],
  "Gémeos": [
    ["Standing Calf Raise", "Máquina ou Smith", "Pausa de 2 s no alongamento|Sobe até à ponta dos pés|Amplitude completa", "", "Elevação de gémeos em pé", 1],
    ["Seated Calf Raise", "Máquina", "Joelhos a 90°|Pausa de 2 s em baixo|Sobe sem balançar", "", "Elevação de gémeos sentado", 1],
    ["Leg Press Calf Raise", "Máquina", "Só as pontas dos pés na plataforma|Joelhos quase esticados, sem bloquear|Amplitude completa", "", "Elevação de gémeos no leg press", 1]
  ],
  "Core": [
    ["Plank", "Peso corporal", "Corpo em linha, glúteos contraídos|Cotovelos sob os ombros|Respira sem perder a posição", "", "Prancha", 1],
    ["Side Plank", "Peso corporal", "Corpo em linha, anca alta|Cotovelo sob o ombro|Não deixes a bacia cair", "", "Prancha lateral", 1],
    ["Dead Bug", "Peso corporal", "Zona lombar colada ao chão|Expira ao estender o braço e a perna|Movimento lento e controlado", "", "Dead bug", 1],
    ["Crunch", "Peso corporal", "Lombar colada ao chão|Sobe as costelas em direção à bacia|Pescoço relaxado, olhar ao teto", "", "Crunch abdominal no chão", 1],
    ["Pallof Press", "Cabo", "Resiste à rotação do tronco|Costelas fechadas, glúteos firmes|Respira sem perder a postura", "", "Pallof press", 1],
    ["Lying Leg Raise", "Peso corporal", "Lombar colada ao chão|Sobe as pernas esticadas, sem balançar|Desce devagar sem tocar no chão", "", "Elevação de pernas deitado", 1],
    ["Cable Crunch", "Cabo", "Enrola a coluna, não dobres só a anca|Cotovelos para as coxas|Expira no fim", "", "Crunch no cabo", 1],
    ["Hanging Leg Raise", "Barra fixa", "Sobe a bacia no fim, não só as pernas|Sem balançar|Desce devagar", "", "Elevação de pernas suspenso", 1],
    ["Ab Wheel Rollout", "Roda", "Costelas baixas, lombar neutra|Vai até onde mantiveres o controlo|Volta com o abdómen, não com a anca", "", "Roda abdominal", 1],
    ["Bird Dog", "Peso corporal", "Costas neutras, bacia estável|Estende braço e perna opostos|Pausa de 2 s e volta devagar", "", "Bird dog", 0]
  ]
};
function exLibFold(s){ return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim(); }
function exerciseSearchUrl(name){ return "https://www.youtube.com/results?search_query=" + encodeURIComponent(String(name) + " exercise proper form"); }
function exerciseMediaUrl(name){ return EXERCISE_MEDIA_BASE + slug(name) + ".webp"; }
function exerciseSeedList(){
  var out = [];
  EXERCISE_GROUPS.forEach(function(g){
    (EXERCISE_SEED[g] || []).forEach(function(r){
      out.push({name: r[0], group: g, equipment: r[1] || "", cues: parseCues(String(r[2] || "").split("|")), note: r[3] || "", alias: r[4] || "", media: !!r[5], demo: r[5] ? exerciseMediaUrl(r[0]) : exerciseSearchUrl(r[0]), ownDemo: false, seed: true, id: null});
    });
  });
  return out;
}
// limpa e valida um exercício escrito pelo profissional; devolve {entry} ou {error}
function exLibClean(raw){
  raw = raw || {};
  var name = String(raw.name || "").trim().replace(/\s+/g, " ").slice(0, 120);
  if (!name) return {error: "Dá um nome ao exercício."};
  var group = EXERCISE_GROUPS.indexOf(raw.group) >= 0 ? raw.group : "";
  if (!group) return {error: "Escolhe o grupo muscular."};
  var demoRaw = String(raw.demo || "").trim();
  if (demoRaw && !cleanDemoUrl(demoRaw)) return {error: "A ligação do vídeo tem de começar por https:// (e não ter espaços)."};
  return {entry: {name: name, group: group, equipment: String(raw.equipment || "").trim().slice(0, 60), demo: demoRaw ? cleanDemoUrl(demoRaw) : "", cues: parseCues(raw.cues), note: String(raw.note || "").trim().slice(0, 200)}};
}
// lista base + o que o estúdio acrescentou/corrigiu (a versão do estúdio substitui a base com o mesmo nome)
function exerciseLibraryMerged(custom){
  var byKey = {}, order = [];
  exerciseSeedList().forEach(function(e){ byKey[exLibFold(e.name)] = e; order.push(exLibFold(e.name)); });
  (custom || []).forEach(function(c){
    var cl = exLibClean(c);
    if (!cl.entry) return;
    var k = exLibFold(cl.entry.name), base = byKey[k];
    var e = {name: cl.entry.name, group: cl.entry.group, equipment: cl.entry.equipment || (base ? base.equipment : ""), cues: cl.entry.cues.length ? cl.entry.cues : (base ? base.cues : []), note: cl.entry.note || (base ? base.note : ""),
      alias: base ? base.alias : "", media: base ? base.media : false, demo: cl.entry.demo || (base ? base.demo : exerciseSearchUrl(cl.entry.name)), ownDemo: !!cl.entry.demo, seed: false, overrides: !!base, id: c.id || null};
    if (!base) order.push(k);
    byKey[k] = e;
  });
  var list = order.map(function(k){ return byKey[k]; });
  list.sort(function(a, b){
    var ga = EXERCISE_GROUPS.indexOf(a.group), gb = EXERCISE_GROUPS.indexOf(b.group);
    return ga !== gb ? ga - gb : a.name.localeCompare(b.name, "pt");
  });
  return list;
}
function exerciseLibraryFilter(list, group, query){
  var q = exLibFold(query);
  return list.filter(function(e){
    return (!group || e.group === group) && (!q || exLibFold(e.name + " " + (e.alias || "") + " " + e.equipment + " " + e.group + " " + e.note).indexOf(q) >= 0);
  });
}
function exLibLocalRead(){ try { var v = JSON.parse(localStorage.getItem(EX_LIB_LOCAL_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function exLibLocalWrite(list){ try { localStorage.setItem(EX_LIB_LOCAL_KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }
function exerciseLibraryCustomList(){
  if (!sbReady) return Promise.resolve({data: exLibLocalRead()});
  return sb.from("exercise_library").select("id,name,muscle_group,equipment,demo,cues,note").order("name").then(function(res){
    if (res.error) return {error: true};
    return {data: (res.data || []).map(function(r){ return {id: r.id, name: r.name, group: r.muscle_group, equipment: r.equipment, demo: r.demo, cues: r.cues, note: r.note}; })};
  }).catch(function(){ return {error: true}; });
}
// guarda (cria ou atualiza) um exercício do estúdio; editId = id de um exercício do estúdio já existente
function exerciseLibrarySave(raw, editId, existingCustom){
  var cl = exLibClean(raw);
  if (!cl.entry) return Promise.resolve({error: cl.error});
  var e = cl.entry, k = exLibFold(e.name);
  var clash = (existingCustom || []).filter(function(c){ return exLibFold(c.name) === k && c.id !== editId; })[0];
  if (clash) return Promise.resolve({error: "Já existe um exercício do estúdio com esse nome."});
  if (!sbReady){
    var list = exLibLocalRead().filter(function(c){ return c.id !== editId && exLibFold(c.name) !== k; });
    list.push({id: editId || uidShort("x"), name: e.name, group: e.group, equipment: e.equipment, demo: e.demo, cues: e.cues, note: e.note});
    return Promise.resolve(exLibLocalWrite(list) ? {} : {error: "Não foi possível guardar neste browser."});
  }
  var row = {name: e.name, muscle_group: e.group, equipment: e.equipment || null, demo: e.demo || null, cues: e.cues, note: e.note || null};
  var q = editId ? sb.from("exercise_library").update(row).eq("id", editId) : sb.from("exercise_library").insert(row);
  return q.then(function(res){
    return res.error ? {error: "Não foi possível guardar (a migração 0021 já foi corrida no Supabase?)."} : {};
  }).catch(function(){ return {error: "Não foi possível guardar — tenta novamente."}; });
}
function exerciseLibraryDelete(id){
  if (!sbReady){ exLibLocalWrite(exLibLocalRead().filter(function(c){ return c.id !== id; })); return Promise.resolve({}); }
  return sb.from("exercise_library").delete().eq("id", id).then(function(res){ return res.error ? {error: true} : {}; }).catch(function(){ return {error: true}; });
}
// o que o editor de treino preenche ao escolher um exercício
function exerciseLibraryFill(e){ return {name: e.name, demo: e.demo, cues: e.cues.join("\n"), group: e.group}; }
function openExerciseLibrary(onPick){
  var sheet = openModal("<div class=\"mtitle\">Biblioteca de exercícios</div>" +
    "<p class=\"muted-p\" style=\"margin:4px 0 10px;\">Partilhada por todo o estúdio. Escolhe um exercício para o preencher no treino, com animação e pontos-chave.</p><div id=\"exLibBody\"><p class=\"muted-p\">A carregar…</p></div>");
  var body = sheet.querySelector("#exLibBody");
  var custom = [], group = "", query = "";
  function listView(){
    var all = exerciseLibraryMerged(custom), shown = exerciseLibraryFilter(all, group, query);
    body.innerHTML = "<div class=\"checkin-field\"><input type=\"search\" id=\"exLibQ\" placeholder=\"Procurar exercício…\" value=\"" + escapeHtml(query) + "\" aria-label=\"Procurar exercício\"></div>" +
      "<div style=\"display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;\"><button type=\"button\" class=\"chip" + (group ? "" : " on") + "\" data-lib-group=\"\">Todos</button>" +
      EXERCISE_GROUPS.map(function(g){ return "<button type=\"button\" class=\"chip" + (group === g ? " on" : "") + "\" data-lib-group=\"" + escapeHtml(g) + "\">" + escapeHtml(g) + "</button>"; }).join("") + "</div>" +
      "<div id=\"exLibList\">" + (shown.length ? shown.map(function(e, i){
        return "<div class=\"food-item\" style=\"cursor:default;\">" + (e.media && !e.ownDemo ? "<img src=\"" + escapeHtml(e.demo) + "\" alt=\"\" loading=\"lazy\" width=\"56\" height=\"56\" style=\"width:56px; height:56px; object-fit:cover; border-radius:10px; margin-right:10px; flex:none;\">" : "") + "<span class=\"fname\" style=\"flex:1; min-width:0;\"><button type=\"button\" class=\"wl-info\" data-lib-pick=\"" + i + "\">" + escapeHtml(e.name) + "</button>" +
          (e.seed ? "" : " <span class=\"pill\" style=\"font-size:0.62rem;\">estúdio</span>") +
          "<span class=\"muted-p\" style=\"display:block; font-size:0.74rem;\">" + escapeHtml(e.group + (e.equipment ? " · " + e.equipment : "") + (e.ownDemo ? " · vídeo próprio" : "")) + (e.note ? " · " + escapeHtml(e.note) : "") + "</span></span>" +
          "<span style=\"white-space:nowrap;\"><a class=\"assess-del\" href=\"" + escapeHtml(e.demo) + "\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"Ver vídeo\" title=\"Ver vídeo\" style=\"text-decoration:none;\">▶</a> " +
          "<button type=\"button\" class=\"assess-del\" data-lib-edit=\"" + i + "\" aria-label=\"Editar exercício\" title=\"Editar\">✎</button></span></div>";
      }).join("") : "<p class=\"muted-p\">Nenhum exercício encontrado.</p>") + "</div>" +
      "<button type=\"button\" class=\"btn btn-sm\" id=\"exLibNew\" style=\"margin-top:12px; width:100%;\">+ Novo exercício</button>";
    var q = body.querySelector("#exLibQ");
    q.addEventListener("input", function(){
      query = q.value;
      var pos = q.selectionStart; // a lista é refeita, por isso repõe-se o foco na pesquisa
      listView();
      var nq = body.querySelector("#exLibQ"); nq.focus(); try { nq.setSelectionRange(pos, pos); } catch (err) {}
    });
    body.querySelectorAll("[data-lib-group]").forEach(function(b){ b.addEventListener("click", function(){ group = b.getAttribute("data-lib-group"); listView(); }); });
    body.querySelectorAll("[data-lib-pick]").forEach(function(b){ b.addEventListener("click", function(){ var e = shown[parseInt(b.getAttribute("data-lib-pick"), 10)]; closeModal(); onPick(exerciseLibraryFill(e), e); }); });
    body.querySelectorAll("[data-lib-edit]").forEach(function(b){ b.addEventListener("click", function(){ formView(shown[parseInt(b.getAttribute("data-lib-edit"), 10)]); }); });
    body.querySelector("#exLibNew").addEventListener("click", function(){ formView(null); });
  }
  function formView(e){
    var isNew = !e, locked = e && e.seed; // um da lista base: o nome fica fixo (guardar cria a versão do estúdio)
    body.innerHTML = "<div class=\"checkin-field\"><label for=\"exlName\">Nome</label><input type=\"text\" id=\"exlName\" maxlength=\"120\" value=\"" + escapeHtml(e ? e.name : "") + "\"" + (locked || (e && e.overrides) ? " readonly" : "") + "></div>" +
      "<div class=\"checkin-field\"><label for=\"exlGroup\">Grupo muscular</label><select id=\"exlGroup\" class=\"mini-select\" style=\"width:100%;\">" + EXERCISE_GROUPS.map(function(g){ return "<option" + (e && e.group === g ? " selected" : "") + ">" + escapeHtml(g) + "</option>"; }).join("") + "</select></div>" +
      "<div class=\"checkin-field\"><label for=\"exlEquip\">Equipamento (opcional)</label><input type=\"text\" id=\"exlEquip\" maxlength=\"60\" value=\"" + escapeHtml(e ? e.equipment : "") + "\"></div>" +
      "<div class=\"checkin-field\"><label for=\"exlDemo\">Vídeo ou GIF (ligação https)</label><input type=\"url\" id=\"exlDemo\" maxlength=\"500\" placeholder=\"https://…\" value=\"" + escapeHtml(e && e.ownDemo ? e.demo : "") + "\"><p class=\"muted-p\" style=\"font-size:0.74rem;\">Vazio = animação da biblioteca (ou pesquisa no YouTube se não houver).</p></div>" +
      "<div class=\"checkin-field\"><label for=\"exlCues\">Pontos-chave (um por linha, até " + EX_CUES_MAX + ")</label><textarea id=\"exlCues\" rows=\"3\">" + escapeHtml(e ? e.cues.join("\n") : "") + "</textarea></div>" +
      "<div class=\"checkin-field\"><label for=\"exlNote\">Nota (opcional)</label><input type=\"text\" id=\"exlNote\" maxlength=\"200\" value=\"" + escapeHtml(e ? e.note : "") + "\" placeholder=\"Ex.: amigo do ombro sensível\"></div>" +
      "<p class=\"muted-p\" id=\"exlErr\" style=\"color:var(--critical); display:none;\"></p>" +
      "<button type=\"button\" class=\"btn primary\" id=\"exlSave\" style=\"width:100%; margin-bottom:8px;\">Guardar para o estúdio</button>" +
      (e && !e.seed ? "<button type=\"button\" class=\"btn\" id=\"exlDel\" style=\"width:100%; margin-bottom:8px;\">" + (e.overrides ? "Repor o original" : "Apagar do estúdio") + "</button>" : "") +
      "<button type=\"button\" class=\"btn\" id=\"exlBack\" style=\"width:100%;\">Voltar</button>";
    function fail(m){ var er = body.querySelector("#exlErr"); er.textContent = m; er.style.display = "block"; }
    body.querySelector("#exlBack").addEventListener("click", listView);
    body.querySelector("#exlSave").addEventListener("click", function(){
      var go = body.querySelector("#exlSave"); go.disabled = true;
      exerciseLibrarySave({name: body.querySelector("#exlName").value, group: body.querySelector("#exlGroup").value, equipment: body.querySelector("#exlEquip").value,
        demo: body.querySelector("#exlDemo").value, cues: body.querySelector("#exlCues").value, note: body.querySelector("#exlNote").value}, e && e.id, custom).then(function(r){
        if (r.error){ fail(r.error); go.disabled = false; return; }
        showToast("✓ Exercício guardado"); reload();
      });
    });
    var del = body.querySelector("#exlDel");
    if (del) del.addEventListener("click", function(){
      if (!window.confirm(e.overrides ? "Repor o exercício original da lista base?" : "Apagar este exercício da biblioteca do estúdio? Os treinos já montados não mudam.")) return;
      exerciseLibraryDelete(e.id).then(function(r){ if (r.error) showToast("⚠ Não foi possível apagar"); reload(); });
    });
  }
  function reload(){
    exerciseLibraryCustomList().then(function(r){
      if (r.error){ custom = []; listView(); body.insertAdjacentHTML("afterbegin", "<p class=\"muted-p\" style=\"color:var(--critical); margin-bottom:8px;\">Não foi possível carregar os exercícios do estúdio (a migração 0021 já foi corrida no Supabase?). A lista base está disponível.</p>"); return; }
      custom = r.data; exLibCustomCache = custom; listView();
    });
  }
  reload();
}

/* ---------- Templates de plano (nutrição e treino) ----------
   O profissional guarda a estrutura de um plano e aplica-a a outro aluno (substituindo ou acrescentando); depois edita à vontade.
   Com Supabase vai para a tabela plan_templates (só profissionais); em modo local fica neste browser. */
var TPL_LOCAL_KEY = "evolve_plan_templates_v1";
function tplLocalRead(){
  try { var v = JSON.parse(localStorage.getItem(TPL_LOCAL_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
function tplLocalWrite(list){ try { localStorage.setItem(TPL_LOCAL_KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }
function planTemplatesList(kind){
  if (!sbReady) return Promise.resolve({data: tplLocalRead().filter(function(t){ return t.kind === kind; })});
  return sb.from("plan_templates").select("id,kind,name,data,created_at").eq("kind", kind).order("created_at", {ascending: false}).then(function(res){
    return res.error ? {error: true} : {data: res.data || []};
  }).catch(function(){ return {error: true}; });
}
function planTemplateSave(kind, name, data){
  name = String(name || "").trim().slice(0, 80);
  if (!name) return Promise.resolve({error: "Dá um nome ao template."});
  if (!sbReady){
    var list = tplLocalRead();
    list.unshift({id: uidShort("t"), kind: kind, name: name, data: data, created_at: new Date().toISOString()});
    return Promise.resolve(tplLocalWrite(list) ? {} : {error: "Não foi possível guardar o template neste browser."});
  }
  return sb.from("plan_templates").insert({kind: kind, name: name, data: data}).select().then(function(res){
    return res.error || !res.data || !res.data[0] ? {error: "Não foi possível guardar o template (a migração 0020 já foi corrida no Supabase?)."} : {data: res.data[0]};
  }).catch(function(){ return {error: "Não foi possível guardar o template — tenta novamente."}; });
}
function planTemplateDelete(id){
  if (!sbReady){ tplLocalWrite(tplLocalRead().filter(function(t){ return t.id !== id; })); return Promise.resolve({}); }
  return sb.from("plan_templates").delete().eq("id", id).then(function(res){ return res.error ? {error: true} : {}; }).catch(function(){ return {error: true}; });
}
// o plano base, nunca a troca do dia (f.original)
function nutritionTemplateFrom(s){
  return {meals: (s.meals || []).map(function(m){
    return {name: m.name, time: m.time, foods: (m.foods || []).map(function(f0){ var f = f0.original || f0; return {name: f.name, qty: f.qty, group: f.group, required: f.required !== false}; })};
  })};
}
function trainingTemplateFrom(s){
  var p = trainingProgramOf(s);
  return {name: p.name || "", days: p.days.map(function(d){
    return {name: d.name, exercises: d.exercises.map(function(e){ return {name: e.name, sets: e.sets, reps: e.reps, rpe: e.rpe, rest: e.rest, notes: e.notes, demo: e.demo || null, cues: parseCues(e.cues), group: e.group || null}; })};
  })};
}
function templateCounts(kind, data){
  if (kind === "treino"){
    var days = (data && data.days) || [];
    return days.length + (days.length === 1 ? " dia" : " dias") + " · " + days.reduce(function(a, d){ return a + ((d.exercises || []).length); }, 0) + " exercícios";
  }
  var meals = (data && data.meals) || [];
  return meals.length + (meals.length === 1 ? " refeição" : " refeições") + " · " + meals.reduce(function(a, m){ return a + ((m.foods || []).length); }, 0) + " alimentos";
}
// Aplica um template de nutrição ao aluno. mode "append" junta às refeições atuais; senão substitui. Alimentos que a app já não conhece
// ou que estão bloqueados para este aluno ficam de fora (e são devolvidos em "skipped").
function applyNutritionTemplate(s, data, mode){
  var blocked = (s.blockedFoods || []).map(function(n){ return String(n).toLowerCase(); }), skipped = [];
  var meals = ((data && data.meals) || []).filter(function(m){ return m && m.name; }).map(function(m){
    var foods = (m.foods || []).filter(function(f){
      if (!f || !f.name) return false;
      if (!FOOD_DB[f.name]){ skipped.push(f.name + " (já não existe)"); return false; }
      if (blocked.indexOf(String(f.name).toLowerCase()) >= 0){ skipped.push(f.name + " (bloqueado para este aluno)"); return false; }
      return true;
    }).map(function(f){ return food(f.name, String(f.qty), f.group, f.required !== false); });
    return meal(String(m.name).slice(0, 80), /^\d{2}:\d{2}$/.test(String(m.time)) ? m.time : "12:00", foods);
  });
  s.meals = mode === "append" ? (s.meals || []).concat(meals) : meals;
  sortMealsByTime(s);
  return {meals: meals.length, skipped: skipped};
}
function applyTrainingTemplate(s, data, mode){
  var days = ((data && data.days) || []).filter(function(d){ return d && String(d.name || "").trim(); }).map(function(d){
    return {id: uidShort("d"), name: String(d.name).trim().slice(0, 80), exercises: (d.exercises || []).filter(function(e){ return e && String(e.name || "").trim(); }).map(function(e){
      var rpe = parseFloat(e.rpe), rest = parseInt(e.rest, 10);
      return {id: uidShort("e"), name: String(e.name).trim().slice(0, 120), sets: Math.min(20, Math.max(1, parseInt(e.sets, 10) || 3)), reps: String(e.reps || "8-12").slice(0, 20),
        rpe: rpe >= 1 && rpe <= 10 ? rpe : null, rest: rest >= 0 && rest <= 900 ? rest : null, notes: String(e.notes || "").slice(0, 200),
        demo: cleanDemoUrl(e.demo) || null, cues: parseCues(e.cues), group: EXERCISE_GROUPS.indexOf(e.group) >= 0 ? e.group : (exerciseGroupFor(e.name) || null)};
    })};
  });
  var prog = ensureTrainingProgram(s);
  prog.days = mode === "append" ? prog.days.concat(days) : days;
  if (mode !== "append" && data && data.name) prog.name = String(data.name).slice(0, 80);
  return {days: days.length};
}
function tplTemplatesBar(kind){
  return "<details class=\"perfil-section\" style=\"margin:14px 0;\"><summary class=\"eyebrow\">Templates de " + (kind === "treino" ? "treino" : "alimentação") + "</summary>" +
    "<p class=\"muted-p\" style=\"margin:8px 0 10px;\">Guarda a estrutura deste plano para reutilizares com outros alunos, ou aplica um template guardado — depois editas tudo normalmente.</p>" +
    "<div style=\"display:flex; gap:8px; flex-wrap:wrap;\"><button type=\"button\" class=\"btn btn-sm\" data-tpl-save=\"" + kind + "\">💾 Guardar como template</button>" +
    "<button type=\"button\" class=\"btn primary btn-sm\" data-tpl-apply=\"" + kind + "\">📋 Aplicar template</button></div></details>";
}
function wireTemplates(s, el){
  function after(msg){ closeModal(); persistStudent(s); renderProTabContent(s); showToast(msg); }
  el.querySelectorAll("[data-tpl-save]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var kind = btn.getAttribute("data-tpl-save");
      var data = kind === "treino" ? trainingTemplateFrom(s) : nutritionTemplateFrom(s);
      if (!(kind === "treino" ? data.days.length : data.meals.length)){ showToast("Ainda não há nada neste plano para guardar"); return; }
      var sheet = openModal("<div class=\"mtitle\">Guardar como template</div>" +
        "<p class=\"muted-p\" style=\"margin-bottom:10px;\">" + escapeHtml(templateCounts(kind, data)) + "</p>" +
        "<div class=\"checkin-field\"><label for=\"tplName\">Nome do template</label><input type=\"text\" id=\"tplName\" maxlength=\"80\" placeholder=\"" + (kind === "treino" ? "Ex.: Hipertrofia 4 dias" : "Ex.: Défice 1800 kcal, 4 refeições") + "\"></div>" +
        "<p class=\"muted-p\" id=\"tplErr\" style=\"color:var(--critical); display:none;\"></p>" +
        "<button type=\"button\" class=\"btn primary\" id=\"tplSaveGo\" style=\"width:100%;\">Guardar template</button>");
      sheet.querySelector("#tplSaveGo").addEventListener("click", function(){
        var go = sheet.querySelector("#tplSaveGo"); go.disabled = true;
        planTemplateSave(kind, sheet.querySelector("#tplName").value, data).then(function(r){
          if (r.error){ var e = sheet.querySelector("#tplErr"); e.textContent = r.error; e.style.display = "block"; go.disabled = false; return; }
          closeModal(); showToast("✓ Template guardado");
        });
      });
    });
  });
  el.querySelectorAll("[data-tpl-apply]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var kind = btn.getAttribute("data-tpl-apply");
      var sheet = openModal("<div class=\"mtitle\">Aplicar template</div><div id=\"tplBody\"><p class=\"muted-p\">A carregar…</p></div>");
      var body = sheet.querySelector("#tplBody");
      function currentCount(){ return kind === "treino" ? trainingProgramOf(s).days.length : (s.meals || []).length; }
      function renderConfirm(t){
        var has = currentCount() > 0;
        body.innerHTML = "<p style=\"margin-bottom:6px;\"><strong>" + escapeHtml(t.name) + "</strong></p><p class=\"muted-p\" style=\"margin-bottom:12px;\">" + escapeHtml(templateCounts(kind, t.data)) + "</p>" +
          (has ? "<div class=\"seg\" style=\"margin-bottom:10px;\"><button type=\"button\" data-tpl-mode=\"replace\" class=\"on\">Substituir o atual</button><button type=\"button\" data-tpl-mode=\"append\">Acrescentar</button></div>" +
            "<p class=\"muted-p\" id=\"tplModeHint\" style=\"margin-bottom:12px;\">Substitui " + currentCount() + (kind === "treino" ? " dia(s) de treino" : " refeição(ões)") + " deste aluno." + (kind === "treino" ? " As sessões já registadas ficam guardadas." : "") + "</p>" : "") +
          "<button type=\"button\" class=\"btn primary\" id=\"tplApplyGo\" style=\"width:100%; margin-bottom:8px;\">Aplicar ao aluno</button><button type=\"button\" class=\"btn\" id=\"tplBack\" style=\"width:100%;\">Voltar</button>";
        var mode = "replace";
        body.querySelectorAll("[data-tpl-mode]").forEach(function(b){
          b.addEventListener("click", function(){
            mode = b.getAttribute("data-tpl-mode");
            body.querySelectorAll("[data-tpl-mode]").forEach(function(x){ x.classList.toggle("on", x === b); });
            var hint = body.querySelector("#tplModeHint"); if (hint) hint.style.display = mode === "replace" ? "block" : "none";
          });
        });
        body.querySelector("#tplBack").addEventListener("click", renderList);
        body.querySelector("#tplApplyGo").addEventListener("click", function(){
          if (kind === "treino"){
            var r = applyTrainingTemplate(s, t.data, mode);
            logPlanEvent(s, "template", "Template de treino aplicado: " + t.name, null, null);
            after("✓ Template aplicado (" + r.days + (r.days === 1 ? " dia" : " dias") + ")");
          } else {
            var before = (s.meals || []).length;
            var rn = applyNutritionTemplate(s, t.data, mode);
            logPlanEvent(s, "template", "Template de alimentação aplicado: " + t.name, before, rn.meals);
            after("✓ Template aplicado (" + rn.meals + (rn.meals === 1 ? " refeição" : " refeições") + ")" + (rn.skipped.length ? " · de fora: " + rn.skipped.slice(0, 2).join(", ") + (rn.skipped.length > 2 ? " (+" + (rn.skipped.length - 2) + ")" : "") : ""));
          }
        });
      }
      function renderList(){
        planTemplatesList(kind).then(function(r){
          if (r.error){ body.innerHTML = "<p class=\"muted-p\" style=\"color:var(--critical);\">Não foi possível carregar os templates (a migração 0020 já foi corrida no Supabase?).</p>"; return; }
          if (!r.data.length){ body.innerHTML = "<p class=\"muted-p\">Ainda não guardaste nenhum template. Monta um plano e usa \"Guardar como template\".</p>"; return; }
          body.innerHTML = r.data.map(function(t, i){
            return "<div class=\"food-item\" style=\"cursor:default;\"><span class=\"fname\">" + escapeHtml(t.name) + "<span class=\"muted-p\" style=\"display:block; font-size:0.74rem;\">" + escapeHtml(templateCounts(kind, t.data)) + "</span></span>" +
              "<span><button type=\"button\" class=\"btn btn-sm primary\" data-tpl-pick=\"" + i + "\">Escolher</button> <button type=\"button\" class=\"btn btn-sm\" data-tpl-del=\"" + i + "\" aria-label=\"Apagar template\">🗑</button></span></div>";
          }).join("");
          body.querySelectorAll("[data-tpl-pick]").forEach(function(b){ b.addEventListener("click", function(){ renderConfirm(r.data[parseInt(b.getAttribute("data-tpl-pick"), 10)]); }); });
          body.querySelectorAll("[data-tpl-del]").forEach(function(b){
            b.addEventListener("click", function(){
              var t = r.data[parseInt(b.getAttribute("data-tpl-del"), 10)];
              if (!window.confirm("Apagar o template \"" + t.name + "\"? Os planos dos alunos que já o usaram não mudam.")) return;
              planTemplateDelete(t.id).then(function(x){ if (x.error) showToast("⚠ Não foi possível apagar"); renderList(); });
            });
          });
        });
      }
      renderList();
    });
  });
}

// ---------- Profissional: programa, progressão e sessões ----------
function tplProTreino(s){
  var prog = trainingProgramOf(s);
  var html = `<div class="eyebrow" style="margin-bottom:4px;">Programa de treino</div>` +
    `<p class="muted-p" style="margin-bottom:12px;">Define os dias e os exercícios (séries, repetições, RPE alvo e descanso). O aluno regista cada sessão e tu vês a progressão de carga.</p>`;
  html += tplTemplatesBar("treino");
  if (!prog.days.length) html += `<p class="muted-p" style="margin-bottom:12px;">Ainda sem dias de treino. Acrescenta o primeiro (ex.: "Treino A — Superior").</p>`;
  prog.days.forEach(function(d){
    html += `<details class="perfil-section" open style="margin-bottom:12px;"><summary class="eyebrow">${escapeHtml(d.name)} · ${d.exercises.length} exercícios</summary>`;
    d.exercises.forEach(function(e){
      html += `<div class="food-item" style="cursor:default;"><span class="fname"><button type="button" class="wl-info" data-ex-info="${escapeHtml(e.id)}">${escapeHtml(e.name)} <span aria-hidden="true">ⓘ</span></button>${cleanDemoUrl(e.demo) || parseCues(e.cues).length ? ' <span class="pill" style="font-size:0.62rem;">guia</span>' : ""}<span class="muted-p" style="display:block; font-size:0.74rem;">${exerciseGroupOf(e) ? escapeHtml(exerciseGroupOf(e)) + " · " : ""}${e.sets} × ${escapeHtml(e.reps)}${e.rpe ? " · RPE " + e.rpe : ""}${e.rest != null ? " · " + e.rest + " s" : ""}${e.notes ? " · " + escapeHtml(e.notes) : ""}</span></span>` +
        `<span><button type="button" class="assess-del" data-edit-guide="${escapeHtml(d.id)}:${escapeHtml(e.id)}" aria-label="Editar demonstração e pontos-chave" title="Demonstração e pontos-chave">🎬</button> ` +
        `<button type="button" class="assess-del" data-del-ex="${escapeHtml(d.id)}:${escapeHtml(e.id)}" aria-label="Remover exercício">✕</button></span></div>`;
    });
    html += `<div class="assess-form-grid" style="margin-top:10px;" data-exform="${escapeHtml(d.id)}">` +
      `<div class="f" style="grid-column:1/-1;"><button type="button" class="btn btn-sm" data-ex-lib style="width:100%;">📚 Escolher da biblioteca</button></div>` +
      `<div class="f" style="grid-column:1/-1;"><label>Exercício</label><input type="text" data-ex-name maxlength="120" placeholder="Ex.: Supino com barra"></div>` +
      `<div class="f"><label>Séries</label><input type="number" min="1" max="20" value="3" data-ex-sets></div>` +
      `<div class="f"><label>Repetições</label><input type="text" value="8-12" data-ex-reps></div>` +
      `<div class="f"><label>RPE alvo</label><input type="number" min="1" max="10" step="0.5" data-ex-rpe></div>` +
      `<div class="f"><label>Descanso (s)</label><input type="number" min="0" max="900" step="15" value="90" data-ex-rest></div>` +
      `<div class="f" style="grid-column:1/-1;"><label>Grupo muscular (conta para o volume semanal)</label><select data-ex-group class="mini-select" style="width:100%;"><option value="">Automático (pelo nome)</option>${EXERCISE_GROUPS.map(function(g){ return `<option>${escapeHtml(g)}</option>`; }).join("")}</select></div>` +
      `<div class="f" style="grid-column:1/-1;"><label>Notas (opcional)</label><input type="text" data-ex-notes placeholder="Tempo 3-1-1, pausa no peito..."></div>` +
      `<div class="f" style="grid-column:1/-1;"><label>GIF / vídeo demonstrativo (ligação https, opcional)</label><input type="url" data-ex-demo maxlength="500" placeholder="https://…/supino.gif"></div>` +
      `<div class="f" style="grid-column:1/-1;"><label>Pontos-chave de execução (um por linha, até 3)</label><textarea data-ex-cues rows="3" placeholder="Omoplatas juntas&#10;Barra desce ao peito&#10;Pés firmes no chão"></textarea></div>` +
      `<div class="f"><button type="button" class="btn primary btn-sm" data-add-ex="${escapeHtml(d.id)}" style="width:100%;">+ Exercício</button></div>` +
    `</div>` +
    `<button type="button" class="btn btn-sm" data-del-day="${escapeHtml(d.id)}" style="margin-top:10px;">🗑 Remover este dia</button></details>`;
  });
  html += `<div class="assess-form-grid" style="margin-top:6px;"><div class="f" style="grid-column:1/-1;"><label>Novo dia de treino</label><input type="text" id="newDayName" maxlength="80" placeholder="Ex.: Treino B — Inferior"></div>` +
    `<div class="f"><button type="button" class="btn primary btn-sm" id="addTrainingDay" style="width:100%;">+ Dia</button></div></div>`;

  html += tplVolumeAndDeload(s);

  // Progressão de carga por exercício
  var names = [];
  prog.days.forEach(function(d){ d.exercises.forEach(function(e){ if (!names.some(function(n){ return n.key === e.name.toLowerCase(); })) names.push({key: e.name.toLowerCase(), id: e.id, name: e.name}); }); });
  (s.workoutLogs || []).forEach(function(l){ (l.entries || []).forEach(function(e){ if (!names.some(function(n){ return n.key === String(e.name || "").toLowerCase(); })) names.push({key: String(e.name || "").toLowerCase(), id: e.exerciseId, name: e.name}); }); });
  var rows = names.map(function(n){ var h = exerciseHistory(s, n.id, n.name); return {n: n, h: h, status: progressionStatus(baselineHistory(h))}; }).filter(function(r){ return r.h.length; });
  html += `<div class="eyebrow" style="margin:22px 0 8px;">Progressão de carga</div>`;
  if (!rows.length) html += `<p class="muted-p">Ainda sem sessões registadas pelo aluno.</p>`;
  else {
    var pill = {"progrediu": "good", "estável": "", "estagnado": "warn", "regrediu": "critical"};
    html += `<div class="assess-table-scroll"><table class="assess-table"><thead><tr><th>Exercício</th><th>Última</th><th>1RM est. / reps</th><th>Tendência</th></tr></thead><tbody>` + rows.map(function(r){
      var last = r.h[r.h.length - 1];
      return `<tr><td class="date-cell" style="white-space:normal;">${escapeHtml(r.n.name)}${(function(){ var pe = findProgramExercise(s, r.n.id); return pe ? overloadBadgeHtml(overloadSuggestion(s, pe)) : ""; })()}</td><td>${escapeHtml(fmtLoadSet(last.topSet))}</td><td>${last.est1RM > 0 ? last.est1RM + " kg" : (last.topReps > 0 ? last.topReps + " reps" : "—")}</td><td>${r.status ? `<span class="pill ${pill[r.status]}">${r.status}</span>` : "—"}</td></tr>`;
    }).join("") + `</tbody></table></div>`;
    var chartRow = rows.filter(function(r){ var k = sameKindHistory(r.h); return k.length >= 2 && k[k.length - 1].score > 0; })[0];
    html += `<div class="checkin-field" style="margin-top:12px;"><label for="exChartSel">Gráfico de progressão (1RM estimado; repetições se não há carga)</label><select id="exChartSel" class="mini-select" style="width:100%;">` +
      rows.map(function(r, i){ return `<option value="${i}"${chartRow && chartRow === r ? " selected" : ""}>${escapeHtml(r.n.name)}</option>`; }).join("") + `</select></div>` +
      `<div id="exChart" class="weight-chart-wrap">${chartRow ? weightSvg(sameKindHistory(chartRow.h).map(function(h){ return {date: h.date, w: h.score}; })) : weightSvg([])}</div>`;
  }

  // Sessões recentes e volume
  var logs = (s.workoutLogs || []).slice().sort(function(a, b){ return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); });
  var wk = sessionsInLastDays(s, 7);
  html += `<div class="eyebrow" style="margin:22px 0 8px;">Sessões registadas</div>`;
  if (!logs.length) html += `<p class="muted-p">Sem sessões registadas.</p>`;
  else {
    var sets7 = wk.reduce(function(a, l){ return a + (l.entries || []).reduce(function(b, e){ return b + (e.sets || []).length; }, 0); }, 0);
    html += `<p class="muted-p" style="margin-bottom:8px;">Últimos 7 dias: ${wk.length} ${wk.length === 1 ? "sessão" : "sessões"}${s.trainingsPerWeek ? " (previstas: " + s.trainingsPerWeek + ")" : ""} · ${sets7} ${sets7 === 1 ? "série" : "séries"}.</p>`;
    logs.slice(0, 8).forEach(function(l){
      html += `<div class="history-row" style="align-items:flex-start;"><div><div class="hlabel">${escapeHtml(fmtDateFullPt(l.date))} · ${escapeHtml(l.dayName || "Treino")}</div>` +
        (l.notes ? `<div class="muted-p">${escapeHtml(l.notes)}</div>` : "") +
        `<div class="muted-p" style="font-size:0.74rem;">${(l.entries || []).map(function(e){ var st = workoutEntryStats(e); return escapeHtml(e.name) + " " + escapeHtml(fmtLoadSet(st.topSet)); }).join(" · ")}</div></div>` +
        `<div class="hval">${Number(l.rpe) > 0 ? "RPE " + Number(l.rpe) : "—"}<br><button type="button" class="assess-del" data-del-log="${escapeHtml(l.id)}" aria-label="Apagar esta sessão" title="Apagar esta sessão">✕</button></div></div>`;
    });
  }
  if (logs.length) html += `<button type="button" class="btn btn-sm" id="delAllLogs" style="margin-top:14px; border-color:var(--critical); color:var(--critical);">Apagar todas as sessões e a progressão de carga</button>`;
  return html;
}

function wireProTreino(s, el){
  wireExerciseInfo(s, el);
  el.querySelectorAll("[data-edit-guide]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var parts = btn.getAttribute("data-edit-guide").split(":"), ex = findProgramExercise(s, parts[1]);
      if (!ex) return;
      var sheet = openModal("<div class=\"mtitle\">" + escapeHtml(ex.name) + "</div>" +
        "<div class=\"checkin-field\"><label for=\"guideDemo\">GIF / vídeo demonstrativo (ligação https)</label><input type=\"url\" id=\"guideDemo\" maxlength=\"500\" value=\"" + escapeHtml(ex.demo || "") + "\" placeholder=\"https://…/supino.gif\"></div>" +
        "<div class=\"checkin-field\"><label for=\"guideCues\">Pontos-chave de execução (um por linha, até " + EX_CUES_MAX + ")</label><textarea id=\"guideCues\" rows=\"4\">" + escapeHtml(parseCues(ex.cues).join("\n")) + "</textarea></div>" +
        "<div class=\"checkin-field\"><label for=\"guideGroup\">Grupo muscular</label><select id=\"guideGroup\" class=\"mini-select\" style=\"width:100%;\"><option value=\"\">Automático (pelo nome)</option>" + EXERCISE_GROUPS.map(function(g){ return "<option" + (ex.group === g ? " selected" : "") + ">" + escapeHtml(g) + "</option>"; }).join("") + "</select></div>" +
        "<p class=\"muted-p\" id=\"guideErr\" style=\"color:var(--critical); display:none;\"></p>" +
        "<button type=\"button\" class=\"btn primary\" id=\"guideSave\" style=\"width:100%;\">Guardar</button>");
      sheet.querySelector("#guideSave").addEventListener("click", function(){
        if (!updateProgramExerciseGuide(s, parts[0], parts[1], {demo: sheet.querySelector("#guideDemo").value, cues: sheet.querySelector("#guideCues").value, group: sheet.querySelector("#guideGroup").value})){
          var e = sheet.querySelector("#guideErr"); e.textContent = "A ligação tem de começar por https:// (e não ter espaços)."; e.style.display = "block"; return;
        }
        closeModal(); persistStudent(s); renderProTabContent(s); showToast("✓ Guia do exercício guardado");
      });
    });
  });
  var regDl = el.querySelector("#registerDeload");
  if (regDl) regDl.addEventListener("click", function(){
    if (registerDeload(s)){ logPlanEvent(s, "treino_dia", "Deload registado", null, todayISO()); persistStudent(s); showToast("✓ Deload registado — não volta a ser sugerido nas próximas semanas"); renderProTabContent(s); }
  });
  var addDay = el.querySelector("#addTrainingDay");
  if (addDay) addDay.addEventListener("click", function(){
    if (!addTrainingDay(s, el.querySelector("#newDayName").value)){ showToast("Dá um nome ao dia de treino"); return; }
    logPlanEvent(s, "treino_dia", "Dia de treino adicionado", null, el.querySelector("#newDayName").value);
    persistStudent(s); renderProTabContent(s);
  });
  el.querySelectorAll("[data-ex-lib]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var box = btn.closest("[data-exform]");
      openExerciseLibrary(function(fill){
        if (!box) return;
        box.querySelector("[data-ex-name]").value = fill.name;
        box.querySelector("[data-ex-demo]").value = fill.demo;
        box.querySelector("[data-ex-cues]").value = fill.cues;
        var gSel = box.querySelector("[data-ex-group]"); if (gSel) gSel.value = fill.group || "";
      });
    });
  });
  el.querySelectorAll("[data-add-ex]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var box = el.querySelector('[data-exform="' + btn.getAttribute("data-add-ex") + '"]');
      function v(sel){ return box.querySelector(sel).value; }
      var ex = addProgramExercise(s, btn.getAttribute("data-add-ex"), {name: v("[data-ex-name]"), sets: v("[data-ex-sets]"), reps: v("[data-ex-reps]"), rpe: v("[data-ex-rpe]"), rest: v("[data-ex-rest]"), notes: v("[data-ex-notes]"), demo: v("[data-ex-demo]"), cues: v("[data-ex-cues]"), group: v("[data-ex-group]")});
      if (!ex){ showToast("Dá um nome ao exercício"); return; }
      if (v("[data-ex-demo]").trim() && !ex.demo) showToast("A ligação da demonstração tem de começar por https:// — guardei o exercício sem ela");
      persistStudent(s); renderProTabContent(s);
    });
  });
  el.querySelectorAll("[data-del-ex]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var parts = btn.getAttribute("data-del-ex").split(":");
      removeProgramExercise(s, parts[0], parts[1]);
      persistStudent(s); renderProTabContent(s);
    });
  });
  el.querySelectorAll("[data-del-day]").forEach(function(btn){
    btn.addEventListener("click", function(){
      if (!window.confirm("Remover este dia de treino e os seus exercícios? (As sessões já registadas ficam guardadas.)")) return;
      removeTrainingDay(s, btn.getAttribute("data-del-day"));
      persistStudent(s); renderProTabContent(s);
    });
  });
  el.querySelectorAll("[data-del-log]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var log = (s.workoutLogs || []).filter(function(l){ return l.id === btn.getAttribute("data-del-log"); })[0];
      if (!log || !window.confirm("Apagar esta sessão (" + fmtDateFullPt(log.date) + ")? A progressão de carga é recalculada sem ela.")) return;
      deleteWorkoutLogs(s, log); renderProTabContent(s);
      saveWorkoutLogsAsPro(s).then(function(ok){ if (!ok) showToast("⚠ Não foi possível guardar a remoção — verifica a ligação"); });
    });
  });
  var delAll = el.querySelector("#delAllLogs");
  if (delAll) delAll.addEventListener("click", function(){
    if (!window.confirm("Apagar TODAS as sessões registadas e a progressão de carga deste aluno? Não dá para desfazer.")) return;
    deleteWorkoutLogs(s, "all"); renderProTabContent(s);
    saveWorkoutLogsAsPro(s).then(function(ok){ showToast(ok ? "✓ Sessões e progressão apagadas" : "⚠ Não foi possível guardar a remoção — verifica a ligação"); });
  });
  var sel = el.querySelector("#exChartSel");
  if (sel) sel.addEventListener("change", function(){
    var names = [], prog = trainingProgramOf(s);
    prog.days.forEach(function(d){ d.exercises.forEach(function(e){ if (!names.some(function(n){ return n.key === e.name.toLowerCase(); })) names.push({key: e.name.toLowerCase(), id: e.id, name: e.name}); }); });
    (s.workoutLogs || []).forEach(function(l){ (l.entries || []).forEach(function(e){ if (!names.some(function(n){ return n.key === String(e.name || "").toLowerCase(); })) names.push({key: String(e.name || "").toLowerCase(), id: e.exerciseId, name: e.name}); }); });
    var rows = names.filter(function(n){ return exerciseHistory(s, n.id, n.name).length; });
    var n = rows[parseInt(sel.value, 10)];
    if (n) el.querySelector("#exChart").innerHTML = weightSvg(sameKindHistory(exerciseHistory(s, n.id, n.name)).map(function(h){ return {date: h.date, w: h.score}; }));
  });
}

// Indicadores de treino registado
function signalSessoes(s){
  if (!(s.workoutLogs || []).length) return signal("sessoes", "Sessões de treino", "insuficiente", "Sem sessões de treino registadas pelo aluno.", "Desde sempre", "treino");
  var last = s.workoutLogs.slice().sort(function(a, b){ return a.date < b.date ? 1 : -1; })[0];
  var days = daysSinceDate(last.date), week = sessionsInLastDays(s, 7).length, planned = s.trainingsPerWeek || 0;
  if (days >= 10) return signal("sessoes", "Sessões de treino", "atencao", "Sem sessões registadas há " + days + " dias.", "Desde a última sessão", "treino", days >= 21 ? "high" : "normal");
  return signal("sessoes", "Sessões de treino", week >= planned || !planned ? "positivo" : "atencao",
    "Últimos 7 dias: " + week + (planned ? " de " + planned + " sessões previstas" : " sessões") + ".", "Últimos 7 dias", "treino");
}
var SIGNAL_LOAD_WINDOW_DAYS = 56;
var SIGNAL_LOAD_BASELINE_DAYS = 120;
function baselineHistory(h){ return h.filter(function(x){ return daysSinceDate(x.date) <= SIGNAL_LOAD_BASELINE_DAYS; }); }
function signalProgressaoCarga(s){
  if (!(s.workoutLogs || []).length) return signal("progressao_carga", "Progressão de carga", "insuficiente", "Sem sessões suficientes para avaliar a progressão.", "Sessões registadas", "treino");
  var seen = {}, stalled = [], progressed = 0, evaluated = 0;
  s.workoutLogs.forEach(function(l){ (l.entries || []).forEach(function(e){ var k = String(e.name || "").toLowerCase(); if (seen[k]) return; seen[k] = true;
    var h = exerciseHistory(s, e.exerciseId, e.name);
    if (!h.length || daysSinceDate(h[h.length - 1].date) > SIGNAL_LOAD_WINDOW_DAYS) return; // exercícios antigos/abandonados não contam
    h = baselineHistory(h); // quem está a recomeçar não é comparado com o recorde de há um ano
    var st = progressionStatus(h);
    if (!st) return; evaluated++;
    if (st === "estagnado" || st === "regrediu") stalled.push(e.name); else if (st === "progrediu") progressed++;
  }); });
  if (!evaluated) return signal("progressao_carga", "Progressão de carga", "insuficiente", "Precisa de pelo menos 2 sessões do mesmo exercício.", "Sessões registadas", "treino");
  if (stalled.length >= 2 || (stalled.length && !progressed)) return signal("progressao_carga", "Progressão de carga", "atencao", "Sem progressão (ou a recuar) em: " + stalled.slice(0, 4).join(", ") + ".", "Sessões registadas", "treino");
  return signal("progressao_carga", "Progressão de carga", "positivo", progressed + " de " + evaluated + " exercícios com nova carga.", "Sessões registadas", "treino");
}

function rangeFill(v){ return Math.round((Number(v) - 1) / 9 * 100); }
function rangeField(id, label, val){
  return "<div class=\"checkin-field\"><label for=\"" + id + "\">" + label + " <span class=\"range-value\" id=\"" + id + "Val\">" + val + "</span></label>" +
    "<input type=\"range\" min=\"1\" max=\"10\" id=\"" + id + "\" value=\"" + val + "\" style=\"--p:" + rangeFill(val) + "%\"></div>";
}

function computeWeeklyTrend(weights){
  if (weights.length < 2) return null;
  var last = weights[weights.length-1];
  var lastT = new Date(last.date).getTime();
  // Janela das últimas 8 semanas: com histórico longo (anos de pesagens importadas), primeiro→último
  // daria uma média sem sentido. Se a janela tiver menos de 7 dias de dados, usa o histórico todo.
  var recent = weights.filter(function(x){ return lastT - new Date(x.date).getTime() <= 56 * 86400000; });
  var set = (recent.length >= 2 && lastT - new Date(recent[0].date).getTime() >= 7 * 86400000) ? recent : weights;
  var first = set[0];
  var days = (lastT - new Date(first.date).getTime()) / 86400000;
  if (days < 7) return null;
  return (last.w - first.w) / (days/7);
}

function tplEvolucaoAluno(s, opts){
  opts = opts || {};
  var noWeight = s.weightCurrent == null || s.weightInitial == null; // aluno só de estúdio, ainda sem peso
  var diff = noWeight ? null : (s.weightCurrent - s.weightInitial).toFixed(1);
  var trend = computeWeeklyTrend(s.weights);
  var html = (opts.editable ? "" : tabHead("Progresso", "Peso e composição corporal ao longo do tempo.")) + "<div class=\"card\">" +
    "<div class=\"eyebrow\">Evolução de peso</div>" +
    "<div class=\"hero-row\"><div class=\"hero-num\">" + (s.weightCurrent == null ? "—" : Number(s.weightCurrent).toFixed(1) + "<small>kg</small>") + "</div></div>" +
    "<div class=\"weight-chart-wrap\">" + weightSvg(s.weights) + "</div>" +
    "<div class=\"stat-grid-4\">" +
      statTile("Inicial", s.weightInitial == null ? "—" : s.weightInitial + " kg") +
      statTile("Atual", s.weightCurrent == null ? "—" : s.weightCurrent + " kg") +
      statTile("Objetivo", (s.weightGoal || "—") + (s.weightGoal ? " kg":"")) +
      statTile("Diferença", diff == null ? "—" : (diff>0?"+":"") + diff + " kg") +
    "</div>" +
    (trend!=null ? "<p class=\"muted-p\" style=\"margin-top:12px;\">Tendência recente: <span class=\"num\" style=\"color:var(--ink); font-weight:600;\">" + (trend>0?"+":"") + trend.toFixed(2) + " kg/semana</span></p>" : "") +
  "</div>";

  html += "<div class=\"card\">" +
    "<div class=\"eyebrow\">Composição corporal</div>" + tplAssessKpis(s) +
    (opts.editable ? tplAssessForm(s) + tplImportWeighIns(s) : "<p class=\"muted-p\" style=\"margin-top:6px;\">Registada pelo teu profissional em cada avaliação.</p>") +
    tplAssessTable(s, opts.editable) +
  "</div>";

  html += tplPerimetersCard(s);
  html += tplSkinfoldsCard(s, opts);

  html += tplPhotosSection(s, opts);

  html += tplAdherenceChart(s);
  return html;
}

function assessDelta(curr, prev, unit){
  if (!(curr > 0) || !(prev > 0)) return "";
  var d = curr - prev;
  if (Math.abs(d) < 0.05) return "<span class=\"assess-delta\">=</span>";
  return "<span class=\"assess-delta\">" + (d>0?"▲":"▼") + " " + Math.abs(d).toFixed(1) + unit + "</span>";
}

// Mais recentes primeiro: por data e, no mesmo dia, pela hora da pesagem (se existir).
function assessmentKey(a){ return (a.date || "") + " " + (a.time || "00:00"); }
function compareAssessmentsDesc(a, b){ var ka = assessmentKey(a), kb = assessmentKey(b); return ka < kb ? 1 : (ka > kb ? -1 : 0); }
function nowHHMM(){ var d = new Date(); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }

// ---------- Importar pesagens do bloco de notas ----------
// Formato aceite (uma pesagem por bloco, linhas em branco são ignoradas):
//   24/08/2020 - 7:00 (jejum) - NOVA DIETA            data, hora opcional (7:00, 07:00, 13h, 14:30; "jejum" sem hora = 06:00), notas opcionais
//   Calorias: 1500 kcal                               linhas de texto livre ficam como nota
//   72.4 kg / 13.9 % / 59.2 kg / GV 3 / H2O 61.3 %    peso / gordura / massa muscular / gordura visceral / água
//   69.9 kg                                           só o peso
function parseWeighInNum(str){ return parseFloat(String(str).replace(",", ".")); }

function parseWeighInTime(rest, defaultTime){
  var m = String(rest || "").match(/^(\d{1,2})\s*[:h]\s*(\d{2})?(?=\s|$|\()/i);
  var time = "", after = String(rest || "");
  if (m){
    var hh = parseInt(m[1], 10), mm = m[2] ? parseInt(m[2], 10) : 0;
    if (hh <= 23 && mm <= 59){ time = ("0" + hh).slice(-2) + ":" + ("0" + mm).slice(-2); after = after.slice(m[0].length); }
  }
  // "jejum" sem hora conta como 06:00 (o jejum em si já não é guardado nem mostrado)
  if (!time && /jejum/i.test(after)) time = defaultTime || "06:00";
  if (!time && defaultTime) time = defaultTime;
  var note = after.replace(/\bjejum\b/gi, "").replace(/[()]/g, " ").replace(/\s+/g, " ").replace(/^[\s\-–—·,;]+|[\s\-–—·,;]+$/g, "");
  return {time: time, note: note};
}

function parseWeighInMeasures(line){
  if (!/\d/.test(line)) return null;
  // GV e H2O (ou H20) podem vir sem "/" antes
  line = line.replace(/\s*\b(GV|H\s*2\s*[O0])/gi, " / $1");
  var parts = line.split("/"), out = {}, plain = [];
  for (var i = 0; i < parts.length; i++){
    var t = parts[i].trim();
    if (!t) continue;
    var gv = t.match(/^GV\s*([\d.,]+)$/i), h2o = t.match(/^H\s*2\s*[O0]\s*([\d.,]+)\s*%?$/i);
    if (gv) out.visceral = parseWeighInNum(gv[1]);
    else if (h2o) out.water = parseWeighInNum(h2o[1]);
    else if (/^[\d.,]+\s*%$/.test(t)) out.bodyFat = parseWeighInNum(t);
    else if (/^[\d.,]+\s*(kg)?$/i.test(t)) plain.push(parseWeighInNum(t));
    else return null;
  }
  if (!plain.length || plain.length > 2) return null;
  out.weight = plain[0];
  if (plain.length === 2) out.muscle = plain[1];
  return out;
}

function parseWeighInNotes(text, opts){
  var defaultTime = (opts && /^\d{2}:\d{2}$/.test(opts.defaultTime || "")) ? opts.defaultTime : "";
  var out = {name: "", entries: [], warnings: []};
  var cur = null, pending = [];
  var dateRe = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})\s*(?:[-–—]\s*)?(.*)$/;
  function pad(n){ return ("0" + n).slice(-2); }
  String(text || "").split(/\r?\n/).forEach(function(raw, i){
    var line = raw.replace(/\s+/g, " ").trim();
    if (!line) return;
    var d = line.match(dateRe);
    if (d){
      var day = parseInt(d[1], 10), mon = parseInt(d[2], 10), yr = parseInt(d[3], 10);
      if (d[3].length === 2) yr += 2000;
      var dt = new Date(Date.UTC(yr, mon - 1, day));
      if (yr < 2000 || yr > 2100 || dt.getUTCFullYear() !== yr || dt.getUTCMonth() !== mon - 1 || dt.getUTCDate() !== day){
        out.warnings.push("Linha " + (i + 1) + ": data inválida (" + line.slice(0, 40) + ")");
        cur = null; pending = [];
        return;
      }
      var info = parseWeighInTime(d[4], defaultTime);
      cur = {date: yr + "-" + pad(mon) + "-" + pad(day), time: info.time,
             note: [pending.join(" · "), info.note].filter(Boolean).join(" · "), line: i + 1, hasMeasures: false};
      pending = [];
      out.entries.push(cur);
      return;
    }
    var m = parseWeighInMeasures(line);
    if (!m && /^[\d\s.,]+$/.test(line) && /\d/.test(line)){
      out.warnings.push("Linha " + (i + 1) + ": números sem data nem unidades — ignorada (" + line.slice(0, 40) + ")");
      return;
    }
    if (m){
      if (!cur || cur.hasMeasures){ out.warnings.push("Linha " + (i + 1) + ": medidas sem data — ignorada (" + line.slice(0, 40) + ")"); return; }
      Object.keys(m).forEach(function(k){ cur[k] = m[k]; });
      cur.hasMeasures = true;
      return;
    }
    // texto livre: o nome no início, notas antes da data seguinte ou entre a data e as medidas
    if (!out.name && !cur && !pending.length && !out.entries.length && /^[A-Za-zÀ-ÿ' .\-]{2,60}$/.test(line)){ out.name = line; return; }
    if (cur && !cur.hasMeasures) cur.note = [cur.note, line].filter(Boolean).join(" · ");
    else pending.push(line);
  });
  var ranges = {bodyFat: [1, 70], muscle: [10, 200], visceral: [0, 60], water: [20, 90]};
  out.entries = out.entries.filter(function(e){
    var when = e.date.slice(8) + "/" + e.date.slice(5, 7) + "/" + e.date.slice(0, 4);
    if (!e.hasMeasures){ out.warnings.push("Linha " + e.line + ": " + when + " sem medidas — ignorada"); return false; }
    if (!(e.weight >= 20 && e.weight <= 400)){ out.warnings.push("Linha " + e.line + ": " + when + " peso fora do intervalo (" + e.weight + ") — ignorada"); return false; }
    var have = 0, bad = false;
    Object.keys(ranges).forEach(function(k){
      if (e[k] == null || isNaN(e[k])) return;
      if (e[k] >= ranges[k][0] && e[k] <= ranges[k][1]) have++; else bad = true;
    });
    e.complete = !bad && have === 4;
    if (e.muscle != null && e.weight > 0 && (e.muscle / e.weight < 0.6 || e.muscle / e.weight > 0.95))
      out.warnings.push("Linha " + e.line + ": " + when + " massa muscular (" + e.muscle + " kg) parece estranha para um peso de " + e.weight + " kg — confirma");
    if (!e.complete && have > 0) out.warnings.push("Linha " + e.line + ": " + when + (bad ? " valores fora do intervalo" : " medidas incompletas") + " — fica só o peso");
    return true;
  });
  return out;
}

// Junta as pesagens ao aluno sem duplicar (mesma data+hora+peso). Completas → avaliação + peso; só peso → só peso.
// apply=false só conta (pré-visualização); apply=true grava no objeto do aluno.
function mergeWeighIns(s, entries, apply){
  var assessKeys = {}, weightKeys = {};
  (s.assessments || []).forEach(function(a){ assessKeys[a.date + "|" + (a.time || "") + "|" + Number(a.weight).toFixed(1)] = 1; });
  (s.weights || []).forEach(function(w){ weightKeys[w.date + "|" + Number(w.w).toFixed(1)] = 1; });
  var res = {full: 0, weightOnly: 0, duplicates: 0, newInitial: null}, newAssess = [], newWeights = [];
  function weightEntry(e){
    var w = {date: e.date, w: e.weight};
    if (e.time) w.time = e.time;
    if (e.note) w.note = e.note;
    return w;
  }
  entries.forEach(function(e){
    var wk = e.date + "|" + e.weight.toFixed(1);
    if (e.complete){
      var ak = e.date + "|" + (e.time || "") + "|" + e.weight.toFixed(1);
      if (assessKeys[ak]){ res.duplicates++; return; }
      assessKeys[ak] = 1; res.full++;
      var a = {date: e.date, weight: e.weight, bodyFat: e.bodyFat, muscle: e.muscle, visceral: e.visceral, water: e.water};
      if (e.time) a.time = e.time;
      if (e.note) a.note = e.note;
      newAssess.push(a);
      if (!weightKeys[wk]){ weightKeys[wk] = 1; newWeights.push(weightEntry(e)); }
    } else {
      if (weightKeys[wk]){ res.duplicates++; return; }
      weightKeys[wk] = 1; res.weightOnly++;
      newWeights.push(weightEntry(e));
    }
  });
  // O peso inicial passa a ser a pesagem mais antiga, se a importação trouxer datas anteriores a tudo o que já existia.
  var prevEarliest = (s.weights || []).reduce(function(m, w){ return (!m || w.date < m) ? w.date : m; }, "");
  var earliestNew = newWeights.slice().sort(function(a, b){
    var ka = a.date + " " + (a.time || ""), kb = b.date + " " + (b.time || "");
    return ka < kb ? -1 : (ka > kb ? 1 : 0);
  })[0];
  if (earliestNew && (!prevEarliest || earliestNew.date < prevEarliest) && earliestNew.w !== s.weightInitial) res.newInitial = {date: earliestNew.date, w: earliestNew.w};
  if (apply && res.newInitial) s.weightInitial = res.newInitial.w;
  if (apply && (newAssess.length || newWeights.length)){
    var prevLatest = (s.weights || []).reduce(function(m, w){ return w.date > m ? w.date : m; }, "");
    s.assessments = (s.assessments || []).concat(newAssess);
    s.weights = (s.weights || []).concat(newWeights).map(function(w, i){ return {w: w, i: i}; })
      .sort(function(a, b){ return a.w.date < b.w.date ? -1 : (a.w.date > b.w.date ? 1 : a.i - b.i); })
      .map(function(x){ return x.w; });
    var latestNew = newWeights.slice().sort(function(a, b){
      var ka = a.date + " " + (a.time || ""), kb = b.date + " " + (b.time || "");
      return ka < kb ? 1 : (ka > kb ? -1 : 0);
    })[0];
    if (latestNew && (!prevLatest || latestNew.date > prevLatest)) s.weightCurrent = latestNew.w;
  }
  return res;
}

function tplImportWeighIns(s){
  return '<details class="perfil-section" style="margin-top:14px;"><summary class="eyebrow">Importar pesagens do bloco de notas</summary>' +
    '<p class="muted-p" style="margin:8px 0;">Cola o texto das pesagens: cada bloco tem a data (e a hora, se quiseres), e a linha com os valores, por exemplo <span class="num">72.4 kg / 13.9 % / 59.2 kg / GV 3 / H2O 61.3 %</span> (peso, gordura, massa muscular, gordura visceral, água) ou só o peso. Vês o que foi percebido antes de gravar; pesagens que já existem não são repetidas.</p>' +
    '<div class="checkin-field"><label for="importWeighDefaultTime">Hora por omissão (para pesagens sem hora; opcional)</label><input type="time" id="importWeighDefaultTime"></div>' +
    '<div class="checkin-field"><textarea id="importWeighText" rows="8" placeholder="24/08/2020 - 7:00 (jejum)&#10;72.4 kg / 13.9 % / 59.2 kg / GV 3 / H2O 61.3 %"></textarea></div>' +
    '<button type="button" class="btn btn-sm" id="importWeighPreview">Ver pré-visualização</button>' +
    '<div id="importWeighResult" style="margin-top:12px;"></div>' +
  '</details>';
}

function tplImportPreview(s, parsed, plan){
  function pt(iso){ return iso.slice(8) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4); }
  var html = "";
  var firstName = String(s.name || "").split(" ")[0];
  if (parsed.name && s.name && parsed.name.toLowerCase().replace(/\s+/g, " ") !== String(s.name).toLowerCase().replace(/\s+/g, " ")){
    html += '<p class="muted-p" role="alert" style="color:var(--warn); margin-bottom:8px;">⚠ O texto parece ser de “' + escapeHtml(parsed.name) + '”, mas estás a importar para “' + escapeHtml(s.name) + '”.</p>';
  }
  var n = parsed.entries.length;
  if (!n){
    html += '<p class="muted-p">Não percebi nenhuma pesagem. Confirma que cada bloco tem a data (dd/mm/aaaa) e a linha com o peso.</p>';
  } else {
    var dates = parsed.entries.map(function(e){ return e.date; }).sort();
    var fresh = plan.full + plan.weightOnly;
    html += '<p style="margin-bottom:8px;"><strong>' + n + ' pesagens</strong> entre ' + pt(dates[0]) + ' e ' + pt(dates[dates.length - 1]) +
      ' — ' + parsed.entries.filter(function(e){ return e.complete; }).length + ' completas, ' + parsed.entries.filter(function(e){ return !e.complete; }).length + ' só com o peso.</p>' +
      '<p class="muted-p" style="margin-bottom:8px;">A importar: <strong>' + fresh + '</strong>' + (plan.duplicates ? ' · já existiam (ignoradas): ' + plan.duplicates : '') + '</p>' +
      (plan.newInitial ? '<p class="muted-p" style="margin-bottom:8px;">O <strong>peso inicial</strong> passa a ser <strong>' + plan.newInitial.w.toFixed(1) + ' kg</strong> (pesagem de ' + pt(plan.newInitial.date) + ').</p>' : '');
    var sample = parsed.entries.length <= 6 ? parsed.entries : parsed.entries.slice(0, 3).concat(parsed.entries.slice(-3));
    html += '<div class="assess-table-scroll"><table class="assess-table"><thead><tr><th>Data</th><th>Peso</th><th>M. gorda</th><th>M. muscular</th><th>Visceral</th><th>Água</th></tr></thead><tbody>' +
      sample.map(function(e){
        return '<tr><td class="date-cell">' + pt(e.date) + (e.time ? ' <span class="atime">· ' + escapeHtml(e.time) + '</span>' : '') + '</td>' +
          '<td>' + e.weight.toFixed(1) + 'kg</td>' +
          '<td>' + (e.complete ? e.bodyFat.toFixed(1) + '%' : '—') + '</td><td>' + (e.complete ? e.muscle.toFixed(1) + 'kg' : '—') + '</td>' +
          '<td>' + (e.complete ? e.visceral : '—') + '</td><td>' + (e.complete ? e.water.toFixed(1) + '%' : '—') + '</td></tr>';
      }).join("") + '</tbody></table></div>' +
      (parsed.entries.length > 6 ? '<p class="muted-p" style="font-size:0.76rem; margin-top:4px;">Mostradas as 3 primeiras e as 3 últimas.</p>' : '');
  }
  if (parsed.warnings.length){
    html += '<p class="muted-p" style="margin-top:10px; font-weight:600;">Avisos (' + parsed.warnings.length + '):</p><ul class="qa-list" style="font-size:0.8rem; color:var(--muted);">' +
      parsed.warnings.slice(0, 8).map(function(w){ return '<li>' + escapeHtml(w) + '</li>'; }).join("") +
      (parsed.warnings.length > 8 ? '<li>… e mais ' + (parsed.warnings.length - 8) + '</li>' : '') + '</ul>';
  }
  if (n && plan.full + plan.weightOnly > 0){
    html += '<button type="button" class="btn primary btn-sm" id="importWeighConfirm" style="margin-top:10px;">Importar ' + (plan.full + plan.weightOnly) + ' pesagens para ' + escapeHtml(firstName) + '</button>';
  } else if (n){
    html += '<p class="muted-p" style="margin-top:10px;">Tudo isto já existe — nada a importar.</p>';
  }
  return html;
}

// ---------- Antropometria: perímetros e pregas cutâneas ----------
// Perímetros em cm: [chave, rótulo, sufixo do id, grupo, mínimo, máximo]. Mede-se o lado direito (ISAK); "(E)" é o esquerdo, para ver assimetrias.
// As chaves antigas (waist, hip, chest, arm, thigh) mantêm-se, por isso as avaliações já gravadas continuam a aparecer.
var PERIMETER_GROUPS = ["Tronco", "Membros superiores", "Membros inferiores"];
var PERIMETER_FIELDS = [
  ["neck", "Pescoço", "Neck", 0, 22, 70, 28, 55, "logo acima da cartilagem tiroideia, fita perpendicular ao pescoço, sem encolher os ombros"],
  ["shoulders", "Ombros", "Shoulders", 0, 70, 200, 85, 160, "fita horizontal no ponto de maior saliência dos deltoides, braços relaxados"],
  ["chest", "Peito", "Chest", 0, 55, 220, 70, 160, "ao nível do mesoesternal (linha dos mamilos), no fim de uma expiração normal"],
  ["waist", "Cintura", "Waist", 0, 45, 230, 55, 160, "ponto médio entre a última costela e a crista ilíaca, no fim de uma expiração normal (é o que os limiares da OMS assumem)"],
  ["abdomen", "Abdómen", "Abdomen", 0, 45, 240, 55, 170, "ao nível do umbigo, abdómen relaxado, no fim de uma expiração normal"],
  ["hip", "Anca", "Hip", 0, 60, 230, 70, 170, "perímetro máximo sobre os glúteos, pés juntos"],
  ["arm", "Braço relaxado (D)", "Arm", 1, 12, 75, 17, 55, "ponto médio entre o acrómio e o rádio, braço pendente e relaxado"],
  ["armL", "Braço relaxado (E)", "ArmL", 1, 12, 75, 17, 55, "igual ao direito, no lado esquerdo"],
  ["armFlexed", "Braço contraído (D)", "ArmFlexed", 1, 14, 85, 19, 62, "braço à frente na horizontal, bíceps em contração máxima, perímetro máximo"],
  ["armFlexedL", "Braço contraído (E)", "ArmFlexedL", 1, 14, 85, 19, 62, "igual ao direito, no lado esquerdo"],
  ["forearm", "Antebraço (D)", "Forearm", 1, 13, 55, 17, 42, "perímetro máximo, braço pendente com a palma para a frente"],
  ["forearmL", "Antebraço (E)", "ForearmL", 1, 13, 55, 17, 42, "igual ao direito, no lado esquerdo"],
  ["wrist", "Punho", "Wrist", 1, 9, 30, 12, 23, "perímetro mínimo, logo abaixo das apófises estiloides"],
  ["thigh", "Coxa (D)", "Thigh", 2, 25, 120, 33, 95, "ponto médio entre o trocânter e o bordo lateral da tíbia, em pé com o peso repartido pelos dois pés"],
  ["thighL", "Coxa (E)", "ThighL", 2, 25, 120, 33, 95, "igual à direita, no lado esquerdo"],
  ["calf", "Gémeo (D)", "Calf", 2, 17, 75, 24, 58, "perímetro máximo da perna, em pé com o peso repartido"],
  ["calfL", "Gémeo (E)", "CalfL", 2, 17, 75, 24, 58, "igual ao direito, no lado esquerdo"],
  ["ankle", "Tornozelo", "Ankle", 2, 13, 45, 16, 32, "perímetro mínimo, logo acima do maléolo interno"]
];
// pares direito/esquerdo para mostrar a diferença entre lados
var PERIMETER_PAIRS = [["arm", "armL", "Braço relaxado"], ["armFlexed", "armFlexedL", "Braço contraído"], ["forearm", "forearmL", "Antebraço"], ["thigh", "thighL", "Coxa"], ["calf", "calfL", "Gémeo"]];
function perimeterField(key){ return PERIMETER_FIELDS.filter(function(f){ return f[0] === key; })[0] || null; }

// Pregas cutâneas em mm: [chave, rótulo, sufixo do id, onde medir]
var SKINFOLD_SITES = [
  ["triceps", "Tricipital", "Triceps", "vertical, face posterior do braço, a meio entre o acrómio e o olécrano, braço relaxado", 55],
  ["biceps", "Bicipital", "Biceps", "vertical, face anterior do braço sobre o bíceps, ao nível da tricipital", 45],
  ["subscapular", "Subescapular", "Subscapular", "oblíqua (cerca de 45°), uns 2 cm abaixo do ângulo inferior da omoplata", 60],
  ["suprailiac", "Suprailíaca", "Suprailiac", "oblíqua, logo acima da crista ilíaca, na linha axilar anterior", 65],
  ["abdominal", "Abdominal", "Abdominal", "vertical, 2 cm ao lado do umbigo", 75],
  ["chest", "Peitoral", "Chest", "oblíqua; nos homens a meio entre a prega axilar anterior e o mamilo, nas mulheres a um terço", 50],
  ["midaxillary", "Axilar média", "Midaxillary", "vertical, na linha axilar média, ao nível do apêndice xifoide", 60],
  ["thigh", "Coxa", "Thigh", "vertical, face anterior, a meio entre a prega inguinal e a rótula", 75],
  ["calf", "Geminal", "Calf", "vertical, face interna da perna, no maior perímetro", 55]
];
var SKINFOLD_MIN_MM = 1, SKINFOLD_MAX_MM = 80, SKINFOLD_SOFT_MIN_MM = 2.5; // fora disto é gralha ou unidade errada; entre o aviso e o limite só se avisa
// Equações de densidade corporal → % de gordura pela equação de Siri. Idades de validação: Jackson-Pollock 18–61 (homens) e 18–55 (mulheres); Durnin-Womersley 16–72.
var SKINFOLD_PROTOCOLS = {
  jp7: {label: "Jackson-Pollock 7 pregas", short: "JP7", sites: ["chest", "midaxillary", "triceps", "subscapular", "abdominal", "suprailiac", "thigh"], ages: {M: [18, 61], F: [18, 55]}},
  jp3: {label: "Jackson-Pollock 3 pregas", short: "JP3", sites: {M: ["chest", "abdominal", "thigh"], F: ["triceps", "suprailiac", "thigh"]}, ages: {M: [18, 61], F: [18, 55]}},
  dw4: {label: "Durnin-Womersley 4 pregas", short: "D-W4", sites: ["biceps", "triceps", "subscapular", "suprailiac"], ages: {M: [16, 72], F: [16, 72]}}
};
var SKINFOLD_PROTOCOL_ORDER = ["jp7", "jp3", "dw4"]; // "automático": a mais completa que as pregas medidas permitirem
// Durnin-Womersley (1974): D = c − m·log10(Σ4); [idade mínima, c, m] por escalão (a partir de 17; aos 16 usa-se o primeiro)
var DURNIN_WOMERSLEY = {
  M: [[0, 1.1620, 0.0630], [20, 1.1631, 0.0632], [30, 1.1422, 0.0544], [40, 1.1620, 0.0700], [50, 1.1715, 0.0779]],
  F: [[0, 1.1549, 0.0678], [20, 1.1599, 0.0717], [30, 1.1423, 0.0632], [40, 1.1333, 0.0612], [50, 1.1339, 0.0645]]
};
// Leituras repetidas (ISAK): com duas leituras usa-se a média; se diferirem mais do que a tolerância (1 % nos perímetros, 5 % nas pregas),
// faz-se uma terceira e usa-se a mediana das três
var READING_TOLERANCE_PCT = {perimeter: 1, skinfold: 5};
function roundReading(x){ return Math.round(x * 10 + 1e-7) / 10; } // meio para cima também quando o binário dá 12,149999...
function combineReadings(values, tolerancePct){
  var v = (values || []).map(Number).filter(function(x){ return isFinite(x) && x > 0; }).slice(0, 3).sort(function(a, b){ return a - b; });
  if (!v.length) return null;
  var n = v.length, mean = v.reduce(function(a, b){ return a + b; }, 0) / n;
  // uma única leitura fica como foi escrita; média e mediana arredondam a 0,1
  var value = n === 1 ? v[0] : roundReading(n === 2 ? mean : v[1]);
  // a decisão usa a mesma percentagem que a mensagem mostra (1 casa decimal): "diferem 5,0 % (mais de 5 %)" nunca acontece
  var spreadPct = n > 1 ? roundReading((v[n - 1] - v[0]) / mean * 100) : 0;
  return {value: value, n: n, spreadPct: spreadPct, method: n === 1 ? "única" : (n === 2 ? "média" : "mediana"),
    needsThird: n === 2 && spreadPct > tolerancePct, scattered: n === 3 && spreadPct > tolerancePct * 2};
}
function sexKeyOf(sex){ return sex === "Masculino" ? "M" : (sex === "Feminino" ? "F" : null); }
function ptNum(n, digits){ return Number(n).toFixed(digits).replace(".", ","); }
function posNum(v){ var n = Number(v); return isFinite(n) && n > 0 ? n : 0; }
function skinfoldSitesOf(protocol, sexKey){
  var p = SKINFOLD_PROTOCOLS[protocol];
  if (!p) return null;
  return Array.isArray(p.sites) ? p.sites : (sexKey ? p.sites[sexKey] : null);
}
function skinfoldSum(sf, sites){
  if (!sf || !sites || !sites.length) return null;
  var sum = 0;
  for (var i = 0; i < sites.length; i++){ var v = posNum(sf[sites[i]]); if (!v) return null; sum += v; }
  return sum;
}
// densidade corporal (g/mL) a partir da soma das pregas; null se a combinação não existir
function bodyDensityFromSkinfolds(protocol, sexKey, age, sum){
  if (!(sum > 0) || !sexKey || !(age > 0)) return null;
  if (protocol === "jp3") return sexKey === "M"
    ? 1.10938 - 0.0008267 * sum + 0.0000016 * sum * sum - 0.0002574 * age
    : 1.0994921 - 0.0009929 * sum + 0.0000023 * sum * sum - 0.0001392 * age;
  if (protocol === "jp7") return sexKey === "M"
    ? 1.112 - 0.00043499 * sum + 0.00000055 * sum * sum - 0.00028826 * age
    : 1.097 - 0.00046971 * sum + 0.00000056 * sum * sum - 0.00012828 * age;
  if (protocol === "dw4"){
    var rows = DURNIN_WOMERSLEY[sexKey], row = rows[0];
    for (var i = 0; i < rows.length; i++) if (age >= rows[i][0]) row = rows[i];
    return row[1] - row[2] * Math.log10(sum);
  }
  return null;
}
function siriBodyFat(density){ return density > 0 ? 495 / density - 450 : null; } // sempre a partir da densidade sem arredondar
// idade na data da avaliação (a data de nascimento é mais certa do que a idade guardada, que envelhece)
function ageAtDate(s, iso){
  if (s && s.birthDate && isIsoDate(s.birthDate) && isIsoDate(iso)){
    var b = new Date(s.birthDate + "T00:00:00"), d = new Date(iso + "T00:00:00");
    var age = d.getFullYear() - b.getFullYear();
    if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) age--;
    if (age >= 0 && age < 120) return age;
  }
  var a = Number(s && s.age);
  return a > 0 && a < 120 ? a : null;
}
function skinfoldValuesOf(a){
  var sf = a && a.skinfolds;
  if (!sf || typeof sf !== "object" || Array.isArray(sf)) return null;
  var out = {}, any = false;
  SKINFOLD_SITES.forEach(function(site){ var v = posNum(sf[site[0]]); if (v) { out[site[0]] = v; any = true; } });
  return any ? out : null;
}
// protocolo usado: o escolhido (se as pregas o permitirem) ou o mais completo possível
function resolveSkinfoldProtocol(sf, sexKey, wanted, age){
  if (wanted && wanted !== "auto" && skinfoldSum(sf, skinfoldSitesOf(wanted, sexKey)) != null) return wanted;
  var first = null;
  for (var i = 0; i < SKINFOLD_PROTOCOL_ORDER.length; i++){
    var k = SKINFOLD_PROTOCOL_ORDER[i];
    if (skinfoldSum(sf, skinfoldSitesOf(k, sexKey)) == null) continue;
    if (first == null) first = k;
    // a equação tem de ter sido validada para a idade (JP 18–61/55; D-W 16–72): senão tenta a seguinte
    var range = sexKey && SKINFOLD_PROTOCOLS[k].ages[sexKey];
    if (!(age > 0) || !range || (age >= range[0] && age <= range[1])) return k;
  }
  return first;
}
// resultado das pregas de uma avaliação: {protocol, label, short, sites, sum, density, bodyFat, warnings}; null sem pregas
function skinfoldResult(s, a, wantedProtocol){
  var sf = skinfoldValuesOf(a);
  if (!sf) return null;
  var sexKey = sexKeyOf(s && s.sex) || (a.sfSex === "M" || a.sfSex === "F" ? a.sfSex : null);
  var age = ageAtDate(s, a.date);
  var protocol = resolveSkinfoldProtocol(sf, sexKey, wantedProtocol || a.sfProtocol, age);
  var res = {protocol: protocol, label: null, short: null, sites: null, sum: null, density: null, bodyFat: null, warnings: [], sexKey: sexKey, age: age};
  if (!protocol){
    res.warnings.push(sexKey ? "Faltam pregas para calcular a % de gordura (JP7: 7, JP3: 3, D-W4: 4)." : "Indica o sexo para aplicar as equações.");
    return res;
  }
  var p = SKINFOLD_PROTOCOLS[protocol];
  res.label = p.label; res.short = p.short; res.sites = skinfoldSitesOf(protocol, sexKey); res.sum = skinfoldSum(sf, res.sites);
  if (!sexKey){ res.warnings.push("Indica o sexo para aplicar as equações."); return res; } // os coeficientes dependem do sexo (mesmo na D-W4)
  if (!(res.age > 0)){ res.warnings.push("Falta a idade (ou a data de nascimento) do aluno."); return res; }
  var range = p.ages[sexKey];
  if (res.age < range[0] || res.age > range[1]) res.warnings.push("Idade fora do intervalo de validação desta equação (" + range[0] + "–" + range[1] + " anos): usa o resultado com cautela.");
  else if (protocol !== "dw4" && sexKey === "F" && res.age > 40) res.warnings.push("As equações de Jackson-Pollock foram validadas em mulheres dos 18 aos 55 anos e os autores avisam que, a partir dos 40, a estimativa é menos fiável.");
  res.density = bodyDensityFromSkinfolds(protocol, sexKey, res.age, res.sum);
  var pct = res.density ? siriBodyFat(res.density) : null;
  if (pct != null && pct >= 2 && pct <= 60) res.bodyFat = Math.round(pct * 10) / 10;
  else if (pct != null) res.warnings.push("O resultado (" + ptNum(pct, 1) + " %) não é plausível: confirma as medições.");
  return res;
}
// avisos (não bloqueiam): valores possíveis mas invulgares, ou combinações que não batem certo entre si
function anthroPlausibilityWarnings(perims, sfs, heightCm){
  var out = [];
  PERIMETER_FIELDS.forEach(function(f){
    var v = perims[f[0]];
    if (v == null) return;
    if (v < f[6]) out.push(f[1] + " " + ptNum(v, 1) + " cm é muito baixo: confirma a medição.");
    else if (v > f[7]) out.push(f[1] + " " + ptNum(v, 1) + " cm é muito alto: confirma a medição.");
  });
  function has(k){ return perims[k] > 0; }
  [["armFlexed", "arm", ""], ["armFlexedL", "armL", " (E)"]].forEach(function(p){
    if (has(p[0]) && has(p[1]) && (perims[p[0]] < perims[p[1]] - 1 || perims[p[0]] > perims[p[1]] + 12)) out.push("Braço contraído" + p[2] + " e relaxado" + p[2] + " não batem certo (o contraído costuma ser 1–12 cm maior).");
  });
  if (has("waist") && has("hip")){ var r = perims.waist / perims.hip; if (r < 0.55 || r > 1.3) out.push("A razão cintura/anca (" + ptNum(r, 2) + ") é invulgar: confirma as medidas."); }
  if (has("waist") && heightCm > 0){ var rh = perims.waist / heightCm; if (rh < 0.3 || rh > 0.9) out.push("A razão cintura/altura (" + ptNum(rh, 2) + ") é invulgar: confirma a cintura."); }
  if (has("neck") && has("waist") && perims.neck >= perims.waist) out.push("O pescoço não pode ser maior do que a cintura.");
  if (has("wrist") && has("forearm") && perims.wrist >= perims.forearm) out.push("O punho é maior do que o antebraço: confirma as medidas.");
  if (has("forearm") && has("arm") && perims.forearm >= perims.arm) out.push("O antebraço é maior do que o braço relaxado: confirma as medidas.");
  if (has("ankle") && has("calf") && perims.ankle >= perims.calf) out.push("O tornozelo é maior do que o gémeo: confirma as medidas.");
  if (has("calf") && has("thigh") && perims.calf >= perims.thigh) out.push("O gémeo é maior do que a coxa: confirma as medidas.");
  SKINFOLD_SITES.forEach(function(site){
    var v = sfs[site[0]];
    if (v == null) return;
    if (v < SKINFOLD_SOFT_MIN_MM) out.push("Prega " + site[1].toLowerCase() + " de " + ptNum(v, 1) + " mm é muito baixa: confirma a leitura.");
    else if (v > site[4]) out.push("Prega " + site[1].toLowerCase() + " de " + ptNum(v, 1) + " mm é muito alta: confirma a leitura.");
  });
  return out;
}
// peso de uma avaliação: o da própria, ou a pesagem desse dia
function weightForAssessment(s, a){
  if (posNum(a.weight)) return Number(a.weight);
  var same = (s.weights || []).filter(function(w){ return w && w.date === a.date && posNum(w.w); });
  return same.length ? Number(same[same.length - 1].w) : null;
}
// categorias da % de gordura (American Council on Exercise)
var BODY_FAT_BANDS = {
  M: [[2, "abaixo do essencial"], [6, "gordura essencial"], [14, "atleta"], [18, "em forma"], [25, "aceitável"], [999, "obesidade"]],
  F: [[10, "abaixo do essencial"], [14, "gordura essencial"], [21, "atleta"], [25, "em forma"], [32, "aceitável"], [999, "obesidade"]]
};
function bodyFatCategory(sexKey, pct){
  var bands = BODY_FAT_BANDS[sexKey];
  if (!bands || !(pct > 0)) return null;
  for (var i = 0; i < bands.length; i++) if (pct < bands[i][0]) return bands[i][1];
  return null;
}
// áreas do braço (Frisancho/Heymsfield): perímetro do braço relaxado (cm) + prega tricipital (mm). A muscular é corrigida (−10 cm² homens, −6,5 cm² mulheres).
function armAreas(armCm, tricepsMm, sexKey){
  if (!(armCm > 0) || !(tricepsMm > 0) || !sexKey) return null;
  var t = tricepsMm / 10;
  var muscle = Math.pow(armCm - Math.PI * t, 2) / (4 * Math.PI) - (sexKey === "M" ? 10 : 6.5);
  var fat = armCm * t / 2 - Math.PI * t * t / 4;
  return {muscle: Math.max(0, Math.round(muscle * 10) / 10), fat: Math.round(fat * 10) / 10};
}
// risco pela circunferência da cintura (OMS/IDF): 0 sem risco acrescido, 1 aumentado, 2 muito aumentado
function waistRiskLevel(sexKey, waistCm){
  if (!sexKey || !(waistCm > 0)) return null;
  var t = sexKey === "M" ? [94, 102] : [80, 88];
  return waistCm >= t[1] ? 2 : (waistCm >= t[0] ? 1 : 0);
}
// A bioimpedância varia com a hidratação e o momento do dia: registar as condições torna as pesagens comparáveis.
var WEIGH_CONTEXTS = ["Em jejum", "Pós-refeição", "Pós-treino", "Desidratado / muito hidratado"];
function fmtPos(v, digits, unit){ return v > 0 ? Number(v).toFixed(digits) + unit : "—"; }

function tplAssessForm(s){
  var sexKnown = !!sexKeyOf(s.sex);
  // um campo por local; com o interruptor "2–3 leituras" ligado aparecem mais dois (ids terminados em _2 e _3)
  function readFields(id, unit, step, site){
    var who = site ? site + ", " : "";
    return "<div class=\"reads\"><input type=\"number\" inputmode=\"decimal\" step=\"" + step + "\" min=\"0\" id=\"" + id + "\" placeholder=\"" + unit + "\">" +
      "<input type=\"number\" inputmode=\"decimal\" step=\"" + step + "\" min=\"0\" id=\"" + id + "_2\" class=\"extra-read\" placeholder=\"2.ª\" aria-label=\"" + who + "2.ª leitura\">" +
      "<input type=\"number\" inputmode=\"decimal\" step=\"" + step + "\" min=\"0\" id=\"" + id + "_3\" class=\"extra-read\" placeholder=\"3.ª\" aria-label=\"" + who + "3.ª leitura\"></div>";
  }
  function perimInput(f){ return "<div class=\"f\"><label for=\"as" + f[2] + "\">" + f[1] + "</label>" + readFields("as" + f[2], "cm", "0.1", f[1]) + "</div>"; }
  return "<div class=\"assess-form-grid\">" +
    "<div class=\"f\"><label>Data</label><input type=\"date\" id=\"asDate\"></div>" +
    "<div class=\"f\"><label>Hora da pesagem</label><input type=\"time\" id=\"asTime\" value=\"" + nowHHMM() + "\"></div>" +
    "<div class=\"f\"><label>Peso (kg)</label><input type=\"number\" step=\"0.1\" min=\"0\" id=\"asWeight\"></div>" +
    "<div class=\"f\"><label>Massa gorda (%)</label><input type=\"number\" step=\"0.1\" min=\"0\" max=\"100\" id=\"asBodyFat\"></div>" +
    "<div class=\"f\"><label>Massa muscular (kg)</label><input type=\"number\" step=\"0.1\" min=\"0\" id=\"asMuscle\"></div>" +
    "<div class=\"f\"><label>Gordura visceral</label><input type=\"number\" step=\"1\" min=\"0\" id=\"asVisceral\"></div>" +
    "<div class=\"f\"><label>Água (%)</label><input type=\"number\" step=\"0.1\" min=\"0\" max=\"100\" id=\"asWater\"></div>" +
    "<details class=\"assess-extra\" style=\"grid-column:1/-1;\"><summary class=\"eyebrow\" style=\"cursor:pointer;\">Perímetros (cm) e condições da pesagem (opcional)</summary>" +
      "<p class=\"muted-p\" style=\"margin-top:8px;\">Mede do lado direito, com a fita justa mas sem apertar. Para ver assimetrias, regista também o lado esquerdo (E). Mede duas vezes: a média fica como valor final; se diferirem mais de 1 %, mede uma terceira e usa a mediana das três (o interruptor abaixo calcula-o por ti).</p>" +
      "<details class=\"assess-howto\"><summary>Como medir</summary><ul>" + PERIMETER_FIELDS.filter(function(f){ return !/\(E\)/.test(f[1]); }).map(function(f){ return "<li><b>" + f[1].replace(" (D)", "") + ":</b> " + f[8] + "</li>"; }).join("") + "</ul></details>" +
      "<label class=\"multi-toggle\"><input type=\"checkbox\" id=\"mrPerim\"> Registar 2–3 leituras por local (média de 2 ou mediana de 3)</label>" +
      "<div class=\"meas-grid\" style=\"display:grid; grid-template-columns:repeat(auto-fill,minmax(100px,1fr)); gap:10px; margin-top:10px;\">" +
        PERIMETER_GROUPS.map(function(g, gi){
          return "<div class=\"assess-subhead\" style=\"grid-column:1/-1;\">" + g + "</div>" + PERIMETER_FIELDS.filter(function(f){ return f[3] === gi; }).map(perimInput).join("");
        }).join("") +
        "<div class=\"f\" style=\"grid-column:1/-1;\"><label>Condições da pesagem</label><select id=\"asContext\" class=\"mini-select\" style=\"width:100%;\"><option value=\"\">—</option>" +
          WEIGH_CONTEXTS.map(function(c){ return "<option value=\"" + c + "\">" + c + "</option>"; }).join("") +
        "</select></div>" +
      "</div>" +
    "</details>" +
    "<details class=\"assess-extra\" style=\"grid-column:1/-1;\"><summary class=\"eyebrow\" style=\"cursor:pointer;\">Pregas cutâneas (mm) (opcional)</summary>" +
      "<p class=\"muted-p\" style=\"margin-top:8px;\">Mede do lado direito com o adipómetro, ao fim de cerca de 2 s depois de largar a pressão, duas vezes por prega: a média fica como valor final; se diferirem mais de 5 %, mede uma terceira e usa a mediana das três (o interruptor abaixo calcula-o por ti). As equações dão uma estimativa da % de gordura (erro típico de ±3–4 %): o importante é medir sempre da mesma forma.</p>" +
      "<details class=\"assess-howto\"><summary>Onde medir</summary><ul>" + SKINFOLD_SITES.map(function(site){ return "<li><b>" + site[1] + ":</b> " + escapeHtml(site[3]) + "</li>"; }).join("") + "</ul></details>" +
      "<label class=\"multi-toggle\"><input type=\"checkbox\" id=\"mrSkin\"> Registar 2–3 leituras por prega (média de 2 ou mediana de 3)</label>" +
      "<div class=\"meas-grid\" style=\"display:grid; grid-template-columns:repeat(auto-fill,minmax(100px,1fr)); gap:10px; margin-top:10px;\">" +
        SKINFOLD_SITES.map(function(site){ return "<div class=\"f\"><label for=\"sf" + site[2] + "\">" + site[1] + "</label>" + readFields("sf" + site[2], "mm", "0.1", site[1]) + "</div>"; }).join("") +
        "<div class=\"f\" style=\"grid-column:1/-1;\"><label>Protocolo</label><select id=\"sfProtocol\" class=\"mini-select\" style=\"width:100%;\"><option value=\"auto\">Automático (o mais completo possível)</option>" +
          SKINFOLD_PROTOCOL_ORDER.map(function(k){ return "<option value=\"" + k + "\">" + SKINFOLD_PROTOCOLS[k].label + "</option>"; }).join("") +
        "</select></div>" +
        (sexKnown ? "" : "<div class=\"f\" style=\"grid-column:1/-1;\"><label>Aplicar equações de</label><select id=\"sfSex\" class=\"mini-select\" style=\"width:100%;\"><option value=\"\">—</option><option value=\"M\">Homens</option><option value=\"F\">Mulheres</option></select></div>") +
        "<p class=\"muted-p\" id=\"sfPreview\" style=\"grid-column:1/-1; margin:0;\"></p>" +
      "</div>" +
    "</details>" +
    "<p class=\"muted-p\" id=\"assessWarn\" style=\"color:var(--warn); grid-column:1/-1; margin:0;\"></p>" +
    "<div class=\"f\"><button type=\"button\" class=\"btn primary btn-sm\" id=\"addAssessment\" style=\"width:100%;\">Adicionar</button></div>" +
    "<p class=\"muted-p\" id=\"assessError\" style=\"color:var(--critical); display:none; grid-column:1/-1; margin:0;\"></p>" +
  "</div>";
}

function tplAssessTable(s, editable){
  var list = (s.assessments||[]).slice().sort(compareAssessmentsDesc);
  if (!list.length) return "<p class=\"muted-p\" style=\"margin-top:10px;\">Ainda sem avaliações registadas.</p>";
  // Ordenação por coluna (clicar no cabeçalho): data, peso, gordura, músculo, visceral, água.
  // "list" fica sempre por data (mais recente primeiro): é daí que vêm a variação (▲▼) e o índice de apagar.
  var sort = state.assessSort || {key:"date", dir:"desc"};
  var COLS = [["date","Data"],["weight","Peso"],["bodyFat","M. gorda"],["muscle","M. muscular"],["visceral","Visceral"],["water","Água"]];
  var shown = list.slice();
  if (sort.key !== "date"){
    shown.sort(function(a,b){ var d = (a[sort.key]||0) - (b[sort.key]||0); return sort.dir === "asc" ? d : -d; });
  } else if (sort.dir === "asc") shown.reverse();
  var html = "<div class=\"assess-table-scroll\"><table class=\"assess-table\"><thead><tr>" + COLS.map(function(c){
    var on = sort.key === c[0];
    return "<th" + (on ? " aria-sort=\"" + (sort.dir === "asc" ? "ascending" : "descending") + "\"" : "") + "><button type=\"button\" class=\"sort-th" + (on ? " on" : "") + "\" data-sort=\"" + c[0] + "\">" + c[1] + (on ? (sort.dir === "asc" ? " ▲" : " ▼") : "") + "</button></th>";
  }).join("") + (editable?"<th></th>":"") + "</tr></thead><tbody>";
  var LIMIT = 10, collapsed = list.length > LIMIT && !state.assessShowAll;
  (collapsed ? shown.slice(0, LIMIT) : shown).forEach(function(a){
    var idx = list.indexOf(a);
    var prev = list[idx+1];
    html += "<tr>" +
      "<td class=\"date-cell\">" + fmtDateFullPt(a.date) + (a.time ? " <span class=\"atime\">· " + escapeHtml(a.time) + "</span>" : "") + (a.context ? " <span class=\"atime\">· " + escapeHtml(a.context) + "</span>" : "") + (function(){ var tags = []; if (PERIMETER_FIELDS.some(function(f){ return posNum(a[f[0]]) > 0; })) tags.push("perímetros"); if (skinfoldValuesOf(a)) tags.push("pregas"); return tags.length ? "<br><span class=\"atime\">" + tags.join(" · ") + "</span>" : ""; })() + "</td>" +
      "<td>" + fmtPos(a.weight, 1, "kg") + (prev?assessDelta(a.weight,prev.weight,"kg"):"") + "</td>" +
      "<td>" + fmtPos(a.bodyFat, 1, "%") + (prev?assessDelta(a.bodyFat,prev.bodyFat,"%"):"") + "</td>" +
      "<td>" + fmtPos(a.muscle, 1, "kg") + (prev?assessDelta(a.muscle,prev.muscle,"kg"):"") + "</td>" +
      "<td>" + (a.visceral > 0 ? a.visceral : "—") + (prev?assessDelta(a.visceral,prev.visceral,""):"") + "</td>" +
      "<td>" + fmtPos(a.water, 1, "%") + (prev?assessDelta(a.water,prev.water,"%"):"") + "</td>" +
      (editable ? "<td><button type=\"button\" class=\"assess-del\" data-idx=\"" + idx + "\" aria-label=\"Remover\">✕</button></td>" : "") +
    "</tr>";
  });
  html += "</tbody></table></div>";
  if (list.length > LIMIT){
    html += "<button type=\"button\" class=\"btn btn-sm\" id=\"assessToggleAll\" style=\"margin-top:10px;\">" +
      (collapsed ? "Mostrar todas (" + list.length + ")" : "Mostrar só as " + LIMIT + " primeiras") + "</button>";
  }
  return html;
}

function resizeImageFile(file, maxWidth){
  return new Promise(function(resolve, reject){
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function(){
      URL.revokeObjectURL(url);
      var scale = Math.min(1, maxWidth / img.width);
      var canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      var ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(function(blob){
        if (blob) resolve(blob); else reject(new Error("Falha ao processar imagem"));
      }, "image/jpeg", 0.85);
    };
    img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error("Falha ao ler imagem")); };
    img.src = url;
  });
}

/* ---------- URL de uma foto de progresso ----------
   O bucket "progress-photos" é privado (protegido por RLS no Storage), por isso
   não há um URL público fixo a guardar: photoUrl() resolve, por esta ordem,
   um URL já assinado (_resolvedUrl, obtido antecipadamente — ver resolvePhotoUrls),
   um URL antigo gravado antes desta migração (p.url, compatibilidade retroativa),
   ou o fallback local em base64 (p.dataUrl, quando não há ligação ao Storage). */
function safeImageUrl(u){
  u = typeof u === "string" ? u : "";
  return /^(https:\/\/|http:\/\/|blob:|data:image\/(png|jpe?g|gif|webp|avif);base64,)/i.test(u) ? u : "";
}
function photoUrl(p){ return p ? safeImageUrl(p._resolvedUrl) || safeImageUrl(p.url) || safeImageUrl(p.dataUrl) : ""; }

function resolvePhotoUrls(students, expirySeconds){
  if (!sbReady) return Promise.resolve();
  var jobs = [];
  (students || []).forEach(function(s){
    try {
    (Array.isArray(s.photos) ? s.photos : []).concat(Array.isArray(s.weightLogPhotos) ? s.weightLogPhotos : []).forEach(function(p){
      if (p && typeof p.path === "string" && p.path && !p._resolvedUrl){
        jobs.push(
          sb.storage.from("progress-photos").createSignedUrl(p.path, expirySeconds || 21600).then(function(res){
            p._resolvedUrl = (res.data && res.data.signedUrl) || null;
          }).catch(function(){ p._resolvedUrl = null; })
        );
      }
    });
    } catch (e) { /* um aluno com dados mal formados nunca pode impedir o login do profissional */ }
  });
  return Promise.all(jobs);
}

// Os URLs temporários das fotos só se pedem quando a evolução do aluno é aberta (antes eram pedidos para todos os alunos no arranque).
// _resolvedUrl === undefined = ainda não pedido; null = pedido e falhou (não se repete, para não entrar em ciclo).
var photoResolving = {};
function hasUnresolvedPhotos(s){
  return (Array.isArray(s.photos) ? s.photos : []).concat(Array.isArray(s.weightLogPhotos) ? s.weightLogPhotos : []).some(function(p){
    return p && typeof p.path === "string" && p.path && p._resolvedUrl === undefined;
  });
}
function lazyPhotos(s, redraw){
  if (!sbReady || photoResolving[s.id] || !hasUnresolvedPhotos(s)) return;
  photoResolving[s.id] = true;
  resolvePhotoUrls([s]).then(function(){ delete photoResolving[s.id]; redraw(); }, function(){ delete photoResolving[s.id]; });
}

// data-path identifica a foto a remover (removePhoto() apaga do Storage e do
// registo do aluno). Uma foto só sem "path" (fallback dataUrl do modo local)
// não tem nada para remover no Storage — nesse caso o botão só tira do array.
// As 3 posições fixas em que o profissional tira sempre fotografia
// (frente/lado/costas) — usadas para etiquetar cada foto no upload e para a
// grelha de comparação (2 momentos × 3 posições = até 6 fotos).
var PHOTO_POSITIONS = [
  {key:"frente", label:"Frente"},
  {key:"lado", label:"Lado"},
  {key:"costas", label:"Costas"}
];
var PHOTO_POSITION_LABEL = PHOTO_POSITIONS.reduce(function(a,p){ a[p.key]=p.label; return a; }, {});

function photoGridHtml(s){
  if (!s.photos.length) return "<p class=\"muted-p\" style=\"margin-top:6px;\">Ainda sem fotografias.</p>";
  return "<div class=\"photo-grid\">" + s.photos.map(function(p, i){
    return "<div class=\"photo-thumb\"><img src=\"" + escapeHtml(photoUrl(p)) + "\" alt=\"Foto de progresso de " + escapeHtml(fmtDatePt(p.date)) + "\">" +
      "<span class=\"pdate\">" + fmtDatePt(p.date) + (p.position ? " · " + PHOTO_POSITION_LABEL[p.position] : "") + "</span>" +
      "<button type=\"button\" class=\"photo-remove\" data-idx=\"" + i + "\" title=\"Remover fotografia\" aria-label=\"Remover fotografia\">✕</button></div>";
  }).join("") + "</div>";
}

// Remove uma foto de progresso: apaga o objeto no Storage (se tiver path —
// bucket privado, exige a política de delete do aluno/profissional) e só
// depois tira do array e grava. Pedido explícito da Fase 9: o aluno deve
// poder pedir a remoção de uma fotografia, com as permissões corretas.
// Apaga um aluno de vez: fotografias no Storage, a ficha (e, em cascata, pedidos, pacotes, sessões e cobranças) e deixa de existir
// na lista. Sem ficha, a conta do aluno já não tem nada a que aceder («Conta sem aluno associado»).
function deleteStudentCompletely(s){
  var id = s.id;
  var paths = (Array.isArray(s.photos) ? s.photos : []).concat(Array.isArray(s.weightLogPhotos) ? s.weightLogPhotos : []).map(function(p){ return p && p.path; }).filter(Boolean);
  var local = function(){
    clearTimeout(persistTimers[id]); delete persistTimers[id]; delete persistStudents[id];
    try { var ob = outboxRead(); if (ob[id]){ delete ob[id]; outboxWrite(); } } catch (e) {}
    var i = STUDENTS.indexOf(s); if (i >= 0) STUDENTS.splice(i, 1);
    if (state.proSelectedId === id) state.proSelectedId = null;
    if (state.alunoStudentId === id) state.alunoStudentId = STUDENTS[0] ? STUDENTS[0].id : null;
    return {};
  };
  if (!sbReady) return Promise.resolve(local());
  var fail = {error: "Não foi possível apagar — verifica a ligação."};
  var removeFiles = paths.length ? Promise.resolve(sb.storage.from("progress-photos").remove(paths)).catch(function(){ return null; }) : Promise.resolve();
  return removeFiles.then(function(){ return Promise.resolve(sb.from("students").delete().eq("id", id)); }).then(function(res){
    if (!res || res.error) return fail;
    return local();
  }, function(){ return fail; });
}
function openDeleteStudentModal(s){
  var sheet = openModal("<div class=\"mtitle\">Apagar " + escapeHtml(s.name) + "?</div>" +
    "<p class=\"muted-p\" style=\"margin-bottom:14px;\">Vai apagar a ficha, as fotografias, os pacotes e as cobranças, e o aluno deixa de ter acesso à app. <strong>Não dá para desfazer.</strong></p>" +
    "<p class=\"muted-p\" id=\"delErr\" style=\"color:var(--critical); display:none; margin-bottom:8px;\"></p>" +
    "<div style=\"display:flex; gap:10px;\"><button type=\"button\" class=\"btn\" id=\"delCancel\" style=\"flex:1;\">Cancelar</button>" +
    "<button type=\"button\" class=\"btn primary\" id=\"delGo\" style=\"flex:1; background:var(--critical); border-color:var(--critical); color:#fff;\">Apagar</button></div>");
  sheet.querySelector("#delCancel").addEventListener("click", closeModal);
  var go = sheet.querySelector("#delGo");
  go.addEventListener("click", function(){
    go.disabled = true;
    deleteStudentCompletely(s).then(function(r){
      if (r.error){ var e = sheet.querySelector("#delErr"); e.textContent = r.error; e.style.display = "block"; go.disabled = false; return; }
      closeModal(); showToast("✓ Aluno apagado");
      state.proView = "dashboard"; renderProShell();
    });
  });
}
function removePhoto(s, idx, onDone){
  var photo = s.photos[idx];
  if (!photo) return;
  var afterRemove = function(){
    s.photos.splice(idx, 1);
    persistStudent(s);
    if (onDone) onDone();
  };
  if (photo.path && sbReady){
    sb.storage.from("progress-photos").remove([photo.path]).then(function(res){
      if (res.error){ showToast("⚠ Não foi possível remover a fotografia"); return; }
      afterRemove();
    }).catch(function(){ showToast("⚠ Não foi possível remover a fotografia"); });
  } else {
    afterRemove();
  }
}

function wirePhotoRemove(s, el, onDone){
  el.querySelectorAll(".photo-remove").forEach(function(btn){
    btn.addEventListener("click", function(){
      if (!window.confirm("Remover esta fotografia? Não é possível desfazer.")) return;
      removePhoto(s, parseInt(btn.getAttribute("data-idx"), 10), onDone);
    });
  });
}

// Datas distintas com pelo menos uma fotografia, por ordem crescente —
// usadas para preencher os dois seletores de "momento" da comparação.
function distinctPhotoDates(s){
  var seen = {};
  (s.photos||[]).forEach(function(p){ seen[p.date] = true; });
  return Object.keys(seen).sort();
}

function findPhotoByDateAndPosition(s, date, position){
  return (s.photos||[]).filter(function(p){ return p.date===date && p.position===position; })[0] || null;
}

// datas com fotos ou com avaliações: qualquer par serve de "antes" e "depois"
function compareDates(s){
  var seen = {};
  (s.photos || []).forEach(function(p){ if (p.date) seen[p.date] = true; });
  (s.assessments || []).forEach(function(a){ if (a && a.date) seen[a.date] = true; });
  return Object.keys(seen).sort();
}
// a avaliação dessa data, ou a mais recente antes dela (se não houver, a primeira depois)
function assessmentForDate(s, date){
  var list = (s.assessments || []).filter(function(a){ return a && a.date; }).slice().sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  return list.filter(function(a){ return a.date <= date; }).pop() || list[0] || null;
}
function weightForDate(s, date, a){
  var logged = (s.weights || []).filter(function(w){ return w.date <= date && w.w > 0; }).sort(function(x, y){ return x.date < y.date ? -1 : x.date > y.date ? 1 : 0; }).pop();
  if (logged && (!a || a.date !== date || !(a.weight > 0))) return logged.w;
  return a && a.weight > 0 ? a.weight : (logged ? logged.w : null);
}
var COMPARE_MAIN_PERIMETERS = ["waist", "hip", "chest", "arm", "thigh"];
function compareMetricRows(s, dateA, dateB){
  var aA = assessmentForDate(s, dateA), aB = assessmentForDate(s, dateB), rows = [];
  function add(label, unit, va, vb){ var x = va > 0 ? va : null, y = vb > 0 ? vb : null; if (x == null && y == null) return; rows.push({label: label, unit: unit, a: x, b: y}); }
  add("Peso", "kg", weightForDate(s, dateA, aA), weightForDate(s, dateB, aB));
  add("Massa gorda", "%", aA && aA.bodyFat, aB && aB.bodyFat);
  add("Massa muscular", "kg", aA && aA.muscle, aB && aB.muscle);
  COMPARE_MAIN_PERIMETERS.concat(PERIMETER_FIELDS.map(function(f){ return f[0]; }).filter(function(k){ return COMPARE_MAIN_PERIMETERS.indexOf(k) < 0; })).forEach(function(k){
    var f = PERIMETER_FIELDS.filter(function(x){ return x[0] === k; })[0];
    if (f) add(f[1].replace(" (D)", ""), "cm", aA && aA[k], aB && aB[k]);
  });
  return rows;
}
function compareMetricsHtml(s, dateA, dateB){
  var rows = compareMetricRows(s, dateA, dateB);
  if (!rows.length) return "<p class=\"muted-p\" style=\"margin-top:10px;\">Sem medições registadas nestas datas.</p>";
  function fmt(n){ return String(Math.round(n * 10) / 10).replace(".", ","); }
  var aA = assessmentForDate(s, dateA), aB = assessmentForDate(s, dateB);
  function src(a, d){ return a && a.date !== d ? "<div class=\"muted-p\" style=\"font-size:0.68rem;\">avaliação de " + escapeHtml(fmtDatePt(a.date)) + "</div>" : ""; }
  return "<div class=\"eyebrow\" style=\"margin:14px 0 6px;\">Evolução das medições</div><div class=\"assess-table-scroll\"><table class=\"assess-table compare-table\"><thead><tr><th>Medida</th><th>" + escapeHtml(fmtDatePt(dateA)) + src(aA, dateA) + "</th><th>" + escapeHtml(fmtDatePt(dateB)) + src(aB, dateB) + "</th><th>Δ</th></tr></thead><tbody>" +
    rows.map(function(r){
      var d = r.a != null && r.b != null ? r.b - r.a : null;
      var dTxt = d == null ? "—" : Math.abs(d) < 0.05 ? "sem alteração" : (d < 0 ? "▼ " : "▲ ") + fmt(Math.abs(d)) + " " + r.unit;
      return "<tr><td class=\"date-cell\" style=\"white-space:normal;\">" + escapeHtml(r.label) + "</td><td>" + (r.a != null ? fmt(r.a) + " " + r.unit : "—") + "</td><td>" + (r.b != null ? fmt(r.b) + " " + r.unit : "—") + "</td><td>" + dTxt + "</td></tr>";
    }).join("") + "</tbody></table></div>";
}

function tplPhotoCompare(s){
  var dates = compareDates(s);
  if (dates.length < 1) return "";
  var lastIdx = dates.length-1;
  var optsA = dates.map(function(d){ return "<option value=\"" + d + "\">" + fmtDatePt(d) + "</option>"; }).join("");
  var optsB = dates.map(function(d,i){ return "<option value=\"" + d + "\"" + (i===lastIdx?" selected":"") + ">" + fmtDatePt(d) + "</option>"; }).join("");
  return "<div class=\"photo-compare\" style=\"margin-top:14px; padding-top:14px; border-top:1px solid var(--line);\">" +
    "<div class=\"eyebrow\" style=\"margin-bottom:8px;\">Antes vs Depois</div>" +
    "<p class=\"muted-p\" style=\"margin-bottom:10px;\">Escolhe duas datas — mostra frente, lado e costas lado a lado (mesmo que falte alguma foto) e a evolução do peso e das medições.</p>" +
    "<div style=\"display:flex; gap:10px; margin-bottom:12px;\">" +
      "<select class=\"mini-select\" id=\"compareA\" style=\"flex:1;\">" + optsA + "</select>" +
      "<select class=\"mini-select\" id=\"compareB\" style=\"flex:1;\">" + optsB + "</select>" +
    "</div>" +
    "<div class=\"compare-grid\" id=\"compareGrid\"></div>" +
    "<div id=\"compareMetrics\"></div>" +
    "<button type=\"button\" class=\"btn btn-sm\" id=\"downloadCompare\" style=\"margin-top:10px;\">⬇ Descarregar / enviar ao aluno</button>" +
    "<p class=\"muted-p\" id=\"compareDownloadError\" style=\"color:var(--critical); display:none; margin-top:8px;\"></p>" +
  "</div>";
}

function compareGridHtml(s, dateA, dateB){
  var html = "<div class=\"compare-grid-head\"><span></span><span>" + fmtDatePt(dateA) + "</span><span>" + fmtDatePt(dateB) + "</span></div>";
  PHOTO_POSITIONS.forEach(function(pos){
    var pa = findPhotoByDateAndPosition(s, dateA, pos.key);
    var pb = findPhotoByDateAndPosition(s, dateB, pos.key);
    html += "<div class=\"compare-grid-row\">" +
      "<span class=\"compare-grid-label\">" + pos.label + "</span>" +
      "<span class=\"compare-cell\">" + (pa ? "<img src=\"" + escapeHtml(photoUrl(pa)) + "\" alt=\"" + pos.label + " " + escapeHtml(fmtDatePt(dateA)) + "\">" : "<span class=\"compare-empty\">Sem foto</span>") + "</span>" +
      "<span class=\"compare-cell\">" + (pb ? "<img src=\"" + escapeHtml(photoUrl(pb)) + "\" alt=\"" + pos.label + " " + escapeHtml(fmtDatePt(dateB)) + "\">" : "<span class=\"compare-empty\">Sem foto</span>") + "</span>" +
    "</div>";
  });
  return html;
}

function wirePhotoCompare(s, el){
  var selA = el.querySelector("#compareA");
  var selB = el.querySelector("#compareB");
  var grid = el.querySelector("#compareGrid");
  if (!selA || !selB || !grid) return;
  var metrics = el.querySelector("#compareMetrics");
  function update(){
    grid.innerHTML = compareGridHtml(s, selA.value, selB.value);
    if (metrics) metrics.innerHTML = compareMetricsHtml(s, selA.value, selB.value);
  }
  selA.addEventListener("change", update);
  selB.addEventListener("change", update);
  update();
  var downloadBtn = el.querySelector("#downloadCompare");
  if (downloadBtn) downloadBtn.addEventListener("click", function(){
    var errEl = el.querySelector("#compareDownloadError");
    downloadBtn.disabled = true;
    var originalText = downloadBtn.textContent;
    downloadBtn.textContent = "A gerar imagem...";
    downloadPhotoComparison(s, selA.value, selB.value, errEl).then(function(){
      downloadBtn.disabled = false;
      downloadBtn.textContent = originalText;
    });
  });
}

// Busca cada foto por fetch()+blob (não por img.crossOrigin) para o canvas
// nunca ficar "tainted" mesmo que o cabeçalho CORS do URL assinado varie —
// uma vez que o ficheiro já chegou como blob local, desenhar no canvas nunca
// é bloqueado por origem cruzada.
function loadImageAsElement(url){
  return fetch(url).then(function(res){
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.blob();
  }).then(function(blob){
    return new Promise(function(resolve, reject){
      var objectUrl = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function(){ URL.revokeObjectURL(objectUrl); resolve(img); };
      img.onerror = function(){ URL.revokeObjectURL(objectUrl); reject(new Error("Falha ao carregar imagem")); };
      img.src = objectUrl;
    });
  });
}

function drawImageCover(ctx, img, x, y, w, h){
  var iw = img.naturalWidth, ih = img.naturalHeight;
  var scale = Math.max(w/iw, h/ih);
  var sw = w/scale, sh = h/scale;
  var sx = (iw-sw)/2, sy = (ih-sh)/2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// Gera uma única imagem PNG com a grelha 2 momentos × 3 posições (até 6
// fotos), pronta a descarregar e a enviar ao aluno. Pedido explícito: uma
// imagem combinada, não os ficheiros separados.
// entrega a imagem da comparação: no telemóvel abre a folha de partilha (WhatsApp, Mensagens, Fotografias);
// numa app instalada sem partilha mostra a imagem para guardar; no computador descarrega
function deliverComparisonImage(blob, name, studentName){
  var file = null;
  try { file = new File([blob], name, {type: "image/png"}); } catch (e) {}
  var touchFirst = !window.matchMedia || window.matchMedia("(pointer: coarse)").matches;
  var url = URL.createObjectURL(blob);
  var fallback = function(){
    var standalone = (window.navigator && window.navigator.standalone === true) || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
    if (standalone){
      openModal("<div class=\"mtitle\">Comparação pronta</div><p class=\"muted-p\" style=\"margin-bottom:10px;\">Mantém o dedo carregado na imagem para a guardar ou partilhar.</p>" +
        "<img src=\"" + url + "\" alt=\"Comparação de fotografias\" style=\"width:100%; border-radius:12px; background:#fff;\">");
    } else {
      var a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ try { URL.revokeObjectURL(url); } catch (e) {} }, 60000);
    }
  };
  if (touchFirst && file && navigator.share && navigator.canShare && navigator.canShare({files: [file]})){
    navigator.share({files: [file], title: "Evolução" + (studentName ? " — " + studentName : "")}).catch(function(e){ if (!e || (e.name !== "AbortError" && e.name !== "InvalidStateError")) fallback(); });
    return;
  }
  fallback();
}
function downloadPhotoComparison(s, dateA, dateB, errEl){
  if (errEl) errEl.style.display = "none";
  var cellW = 280, cellH = 360, labelW = 90, gap = 14, headerH = 46, titleH = 46, pad = 24;
  var colX = [pad+labelW, pad+labelW+cellW+gap];
  var canvasW = pad*2 + labelW + cellW*2 + gap;
  var canvasH = pad*2 + titleH + headerH + PHOTO_POSITIONS.length*cellH + (PHOTO_POSITIONS.length-1)*gap;

  var cells = [];
  PHOTO_POSITIONS.forEach(function(pos, ri){
    var y = pad + titleH + headerH + ri*(cellH+gap);
    [dateA, dateB].forEach(function(d, ci){
      cells.push({pos:pos, x:colX[ci], y:y, photo: findPhotoByDateAndPosition(s, d, pos.key)});
    });
  });

  var loadJobs = cells.map(function(c){
    if (!c.photo) return Promise.resolve();
    return loadImageAsElement(photoUrl(c.photo)).then(function(img){ c.img = img; }).catch(function(){ c.loadFailed = true; });
  });

  return Promise.all(loadJobs).then(function(){
    var canvas = document.createElement("canvas");
    canvas.width = canvasW;
    canvas.height = canvasH;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.fillStyle = "#111111";
    ctx.font = "bold 20px -apple-system, sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(s.name + " — evolução", pad, pad + 22);

    ctx.font = "600 14px -apple-system, sans-serif";
    ctx.fillStyle = "#555555";
    ctx.textAlign = "center";
    ctx.fillText(fmtDatePt(dateA), colX[0]+cellW/2, pad+titleH+headerH-16);
    ctx.fillText(fmtDatePt(dateB), colX[1]+cellW/2, pad+titleH+headerH-16);
    ctx.textAlign = "left";

    ctx.font = "700 13px -apple-system, sans-serif";
    ctx.fillStyle = "#111111";
    ctx.textBaseline = "middle";
    PHOTO_POSITIONS.forEach(function(pos, ri){
      var y = pad + titleH + headerH + ri*(cellH+gap);
      ctx.fillText(pos.label, pad, y+cellH/2);
    });
    ctx.textBaseline = "alphabetic";

    cells.forEach(function(c){
      if (c.img){
        drawImageCover(ctx, c.img, c.x, c.y, cellW, cellH);
      } else {
        ctx.fillStyle = "#eeeeee";
        ctx.fillRect(c.x, c.y, cellW, cellH);
        ctx.fillStyle = "#999999";
        ctx.font = "13px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(c.loadFailed ? "Erro ao carregar" : "Sem foto", c.x+cellW/2, c.y+cellH/2);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }
    });

    return new Promise(function(resolve){ canvas.toBlob(resolve, "image/png"); });
  }).then(function(blob){
    if (!blob) throw new Error("Não foi possível gerar a imagem.");
    deliverComparisonImage(blob, "evolucao-" + slug(s.name || s.id) + "-" + dateA + "-vs-" + dateB + ".png", s.name);
  }).catch(function(err){
    if (errEl){
      errEl.textContent = "⚠ Não foi possível gerar a imagem de comparação — tenta novamente.";
      errEl.style.display = "block";
    }
    console.error("Falha ao gerar comparação de fotos", err);
  });
}

// O profissional carrega uma foto de progresso em nome do aluno. Com ligação, o ficheiro vai para a
// pasta do ALUNO no Storage (a política de leitura do aluno só deixa ler a própria pasta; o profissional
// pode inserir em qualquer uma) — por isso o aluno também vê a foto. Sem a conta do aluno ativada
// (sem auth_user_id) não há pasta onde a guardar: avisa em vez de falhar em silêncio.
function uploadProgressPhotoAsPro(s, file, position, onDone, date){
  if (!file) return Promise.resolve(false);
  var photoDate = isIsoDate(date) && date <= todayISO() ? date : todayISO();   // permite carregar fotos antigas com a data em que foram tiradas
  if (sbReady){
    // sem a conta do aluno ativada, a foto fica numa pasta do estúdio (só o profissional a vê); com conta, na pasta do aluno
    var uploadedPath = (s.authUserId ? s.authUserId : "sem-conta/" + s.id) + "/" + Date.now() + ".jpg";
    return resizeImageFile(file, 1280).then(function(blob){
      return sb.storage.from("progress-photos").upload(uploadedPath, blob, {contentType:"image/jpeg"});
    }).then(function(res){
      if (res.error){ showToast("⚠ Falha ao enviar foto: " + (res.error.message || "erro de acesso")); return false; }
      return sb.storage.from("progress-photos").createSignedUrl(uploadedPath, 21600).then(function(signedRes){
        var photo = { date: photoDate, path: uploadedPath, position: position, by: "profissional" };
        photo._resolvedUrl = (signedRes.data && signedRes.data.signedUrl) || null;
        s.photos.push(photo);
        if (onDone) onDone();
        persistStudent(s);
        return true;
      });
    }).catch(function(err){ showToast("⚠ Falha ao enviar foto" + (err && err.message ? ": " + err.message : "")); return false; });
  }
  return new Promise(function(resolve){
    var reader = new FileReader();
    reader.onload = function(){
      s.photos.push({date: photoDate, dataUrl: reader.result, position: position, by: "profissional"});
      if (onDone) onDone();
      persistStudent(s);
      resolve(true);
    };
    reader.readAsDataURL(file);
  });
}

function tplPhotosSection(s, opts){
  var html = "<div class=\"card\"><div class=\"eyebrow\">Fotografias de progresso</div>";
  if (opts.editable){
    html += "<label style=\"display:flex; align-items:center; gap:8px; font-size:0.85rem; cursor:pointer; margin:10px 0;\">" +
      "<input type=\"checkbox\" id=\"togglePhotos\"" + (s.allowPhotos?" checked":"") + "> Permitir que o aluno carregue fotos de progresso</label>" +
      photoGridHtml(s) +
      "<div class=\"muted-p\" style=\"margin:10px 0 6px;\">Carregar foto de progresso (tirada por ti). Escolhe primeiro a data em que foi tirada:</div>" +
      "<div class=\"checkin-field\" style=\"max-width:200px; margin-bottom:8px;\"><label for=\"proPhotoDate\">Data da foto</label><input type=\"date\" id=\"proPhotoDate\" value=\"" + todayISO() + "\" max=\"" + todayISO() + "\"></div>" +
      "<div style=\"display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap;\">" +
        PHOTO_POSITIONS.map(function(p){
          return "<label class=\"btn-file\">" + p.label + "<input type=\"file\" accept=\"image/*\" class=\"pro-photo-upload-input\" data-position=\"" + p.key + "\" style=\"display:none;\"></label>";
        }).join("") +
      "</div>" +
      tplPhotoCompare(s);
  } else if (!s.allowPhotos){
    html += "<p class=\"muted-p\" style=\"margin-top:8px;\">O teu profissional ainda não ativou fotografias de progresso para ti.</p>";
  } else {
    html += photoGridHtml(s) +
      "<div style=\"display:flex; gap:8px; margin:10px 0; flex-wrap:wrap;\">" +
        PHOTO_POSITIONS.map(function(p){
          return "<label class=\"btn-file\">" + p.label + "<input type=\"file\" accept=\"image/*\" class=\"photo-upload-input\" data-position=\"" + p.key + "\" style=\"display:none;\"></label>";
        }).join("") +
      "</div>" +
      tplPhotoCompare(s);
  }
  html += "</div>";
  return html;
}

function statTile(label, val){
  return "<div class=\"stat-tile\"><div class=\"v\">" + val + "</div><div class=\"l\">" + label + "</div></div>";
}

function weightSvg(weights){
  if (weights.length < 2){
    return "<p class=\"muted-p\" style=\"text-align:center; padding:6px 0 2px;\">Ainda não há dados suficientes para mostrar a evolução.</p>";
  }
  var w = 380, h = 120, pad = 18;
  var vals = weights.map(function(x){ return x.w; });
  var min = Math.min.apply(null, vals) - 0.5, max = Math.max.apply(null, vals) + 0.5;
  var n = weights.length;
  function x(i){ return pad + (i/(n-1)) * (w - pad*2); }
  function y(v){ return h - pad - ((v-min)/(max-min)) * (h - pad*2); }
  var pts = weights.map(function(pt,i){ return x(i) + "," + y(pt.w); }).join(" ");
  var areaPts = pts + " " + x(n-1) + "," + (h-pad) + " " + x(0) + "," + (h-pad);
  var last = weights[n-1];
  return "<svg viewBox=\"0 0 " + w + " " + h + "\" xmlns=\"http://www.w3.org/2000/svg\">" +
    "<polygon points=\"" + areaPts + "\" fill=\"var(--accent-soft)\"></polygon>" +
    "<polyline points=\"" + pts + "\" fill=\"none\" stroke=\"var(--accent)\" stroke-width=\"2.5\"></polyline>" +
    "<circle cx=\"" + x(n-1) + "\" cy=\"" + y(last.w) + "\" r=\"4\" fill=\"var(--ink)\"></circle>" +
    "<text x=\"" + x(0) + "\" y=\"" + (h-2) + "\" font-size=\"9\" fill=\"var(--muted)\" font-family=\"var(--mono)\">" + fmtDatePt(weights[0].date) + "</text>" +
    "<text x=\"" + (x(n-1)-24) + "\" y=\"" + (h-2) + "\" font-size=\"9\" fill=\"var(--muted)\" font-family=\"var(--mono)\">" + fmtDatePt(last.date) + "</text>" +
  "</svg>";
}

function wireAlunoTab(s){
  var el = document.getElementById("alunoTabContent");
  wireWorkoutLogger(s, el, function(){ renderAlunoTab(s); });
  wireTrainingNav(s, el);

  el.querySelectorAll(".meal-row[data-midx]").forEach(function(row){
    row.addEventListener("click", function(){
      if (Date.now() < uiTapGuardUntil) return;
      openMealDetail(s, parseInt(row.getAttribute("data-midx"),10));
    });
  });
  el.querySelectorAll(".check-circle[data-circle]").forEach(function(c){
    c.addEventListener("click", function(e){
      e.stopPropagation();
      if (Date.now() < uiTapGuardUntil) return;
      var idx = parseInt(c.getAttribute("data-circle"),10);
      var m = resolveMealsForToday(s)[idx];
      m.done = !m.done;
      commitMealView(s, m);
      renderAlunoTab(s);
      var again = el.querySelector('.check-circle[data-circle="' + idx + '"]');
      if (again && again.focus) { try { again.focus({preventScroll: true}); } catch (e2) {} } // o teclado continua no mesmo botão
      persistStudent(s);
      if (m.done) showToast("✓ " + m.name + " concluído");
    });
  });

  var nmSub = el.querySelector("#nmSubstitute");
  if (nmSub) nmSub.addEventListener("click", function(){
    var m = resolveMealsForToday(s)[parseInt(nmSub.getAttribute("data-midx"),10)];
    var fi = m.foods.findIndex(function(f){ return f.group; });
    if (fi<0) return;
    openSubstitution(m.foods[fi], function(chosen){
      applySubstitution(s, m, fi, chosen);
      commitMealView(s, m);
      renderAlunoTab(s);
      persistStudent(s);
      showToast("Refeição adaptada");
      closeModal();
    }, s, m);
  });
  var nmAdapt = el.querySelector("#nmAdapt");
  if (nmAdapt) nmAdapt.addEventListener("click", function(){
    var m = resolveMealsForToday(s)[parseInt(nmAdapt.getAttribute("data-midx"),10)];
    m.adapted = true;
    logAdaptation(s, m, "adaptacao", {reason:"Adaptação manual"});
    commitMealView(s, m);
    renderAlunoTab(s);
    persistStudent(s);
    showToast("Refeição adaptada");
  });

  var goBtn = el.querySelector("#goToMeal");
  if (goBtn) goBtn.addEventListener("click", function(){ openMealDetail(s, parseInt(goBtn.getAttribute("data-midx"),10)); });

  var assistantBtn = el.querySelector("#openAssistant");
  if (assistantBtn) assistantBtn.addEventListener("click", function(){ openAssistant(s); });

  el.querySelectorAll(".food-item[data-fidx]").forEach(function(item){
    item.addEventListener("click", function(){
      var midx = parseInt(item.getAttribute("data-midx"),10);
      var fidx = parseInt(item.getAttribute("data-fidx"),10);
      var m = resolveMealsForToday(s)[midx];
      var f = m.foods[fidx];
      openSubstitution(f, function(chosen){
        applySubstitution(s, m, fidx, chosen);
        commitMealView(s, m);
        renderAlunoTab(s);
        persistStudent(s);
        showToast("Refeição adaptada");
        closeModal();
      }, s, m);
    });
  });

  el.querySelectorAll(".builder-opt").forEach(function(opt){
    opt.addEventListener("click", function(){
      var midx = parseInt(opt.getAttribute("data-midx"),10);
      var group = opt.getAttribute("data-group");
      var oi = parseInt(opt.getAttribute("data-oi"),10);
      var m = resolveMealsForToday(s)[midx];
      if (!m.liveChoice) m.liveChoice = {};
      m.liveChoice[group] = oi;
      commitMealView(s, m);
      renderAlunoTab(s);
      persistStudent(s);
    });
  });

  el.querySelectorAll("[data-more-food-midx]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var midx = parseInt(btn.getAttribute("data-more-food-midx"),10);
      var group = btn.getAttribute("data-more-food-group");
      var m = resolveMealsForToday(s)[midx];
      var f = m.foods.find(function(x){ return x.group === group; });
      if (!f) return;
      openMealOptionPicker(optionsFor(f, s), function(oi){
        if (!m.liveChoice) m.liveChoice = {};
        m.liveChoice[group] = oi;
        commitMealView(s, m);
        renderAlunoTab(s);
        persistStudent(s);
      });
    });
  });

  ["ciHunger","ciEnergy","ciAdherence","ciStress","ciRecovery"].forEach(function(id){
    var input = el.querySelector("#"+id);
    if (input) input.addEventListener("input", function(){
      el.querySelector("#"+id+"Val").textContent = input.value;
      input.style.setProperty("--p", rangeFill(input.value) + "%");
    });
  });

  el.querySelectorAll(".photo-upload-input").forEach(function(photoInput){
    photoInput.addEventListener("change", function(e){
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var position = photoInput.getAttribute("data-position");
      if (sbReady && currentAuthUserId){
        var uploadedPath;
        resizeImageFile(file, 1280).then(function(blob){
          uploadedPath = currentAuthUserId + "/" + Date.now() + ".jpg";
          return sb.storage.from("progress-photos").upload(uploadedPath, blob, {contentType:"image/jpeg"});
        }).then(function(res){
          if (res.error){ showToast("⚠ Falha ao enviar foto"); return; }
          // bucket privado: guardamos só o caminho, nunca um URL público fixo — a
          // leitura é sempre feita depois via URL assinado (ver resolvePhotoUrls).
          return sb.storage.from("progress-photos").createSignedUrl(uploadedPath, 21600).then(function(signedRes){
            var photo = { date: todayISO(), path: uploadedPath, position: position };
            photo._resolvedUrl = (signedRes.data && signedRes.data.signedUrl) || null;
            s.photos.push(photo);
            renderAlunoTab(s);
            persistStudent(s);
          });
        }).catch(function(){ showToast("⚠ Falha ao enviar foto"); });
      } else {
        var reader = new FileReader();
        reader.onload = function(){
          s.photos.push({date: todayISO(), dataUrl: reader.result, position: position});
          renderAlunoTab(s);
          persistStudent(s);
        };
        reader.readAsDataURL(file);
      }
      photoInput.value = "";
    });
  });
  wirePhotoCompare(s, el);
  wirePhotoRemove(s, el, function(){ renderAlunoTab(s); });
  var toggleAllAluno = el.querySelector("#assessToggleAll");
  if (toggleAllAluno) toggleAllAluno.addEventListener("click", function(){ state.assessShowAll = !state.assessShowAll; renderAlunoTab(s); });
  el.querySelectorAll(".sort-th").forEach(function(b){ b.addEventListener("click", function(){ toggleAssessSort(b.getAttribute("data-sort")); renderAlunoTab(s); }); });

  var submitBtn = el.querySelector("#submitCheckin");
  if (submitBtn) submitBtn.addEventListener("click", function(){
    var errEl = el.querySelector("#checkinError");
    var wRaw = parseFloat(el.querySelector("#ciWeight").value);
    if (!isNaN(wRaw) && wRaw <= 0){
      if (errEl){ errEl.textContent = "O peso tem de ser superior a 0."; errEl.style.display = "block"; }
      return;
    }
    // uma gralha (8,2 em vez de 82,2) estragaria a tendência de peso e as propostas de calorias: pede para confirmar
    if (!isNaN(wRaw) && (wRaw < 25 || wRaw > 350)){
      if (errEl){ errEl.textContent = "Confirma o peso: tem de estar entre 25 e 350 kg."; errEl.style.display = "block"; }
      return;
    }
    if (!isNaN(wRaw) && s.weightCurrent > 0 && Math.abs(wRaw - s.weightCurrent) / s.weightCurrent > 0.15 && !window.confirm("O peso (" + String(wRaw).replace(".", ",") + " kg) é muito diferente do último (" + String(s.weightCurrent).replace(".", ",") + " kg). Está certo?")) return;
    if (errEl) errEl.style.display = "none";
    var w = wRaw || s.weightCurrent;
    var today = localTodayISO();
    pushCheckin(s, {
      date: today, weight: w,
      hunger: parseInt(el.querySelector("#ciHunger").value,10),
      energy: parseInt(el.querySelector("#ciEnergy").value,10),
      adherence: parseInt(el.querySelector("#ciAdherence").value,10),
      workouts: Math.max(0, parseInt(el.querySelector("#ciWorkouts").value,10) || 0),
      mealsOff: Math.max(0, parseInt(el.querySelector("#ciMealsOff").value,10) || 0),
      sleepHours: Math.min(14, Math.max(0, parseFloat(el.querySelector("#ciSleep").value) || 0)),
      stress: parseInt(el.querySelector("#ciStress").value,10),
      recovery: parseInt(el.querySelector("#ciRecovery").value,10),
      sleepQuality: parseInt(el.querySelector("#ciSleepQ").value,10),
      digestion: parseInt(el.querySelector("#ciDigestion").value,10),
      notes: el.querySelector("#ciNotes").value
    });
    s.weights.push({date: today, w: w});
    s.weightCurrent = w;
    state.ciOpen = false;
    renderAlunoTab(s);
    persistStudent(s);
    showToast("✓ Check-in enviado");
  });
}

/* ===================== PROFISSIONAL RENDER ===================== */
var proRoot = document.getElementById("proApp");

// Menu horizontal do profissional (telemóvel). Posições RELATIVAS ao próprio menu:
// offsetLeft é medido a partir da página, por isso incluía a margem do menu e desviava o centrar.
function stripPositions(container, active){
  var cLeft = container.getBoundingClientRect().left;
  function rel(el){ return el.getBoundingClientRect().left - cLeft + container.scrollLeft; }
  var first = container.querySelector(".pro-nav-item[data-t]");
  var student = container.querySelector(".pro-sidebar-student");
  var activeLeft = rel(active);
  var firstLeft = first ? rel(first) : 0;
  return {
    center: activeLeft + active.offsetWidth / 2,
    right: activeLeft + active.offsetWidth,
    firstTabLeft: firstLeft,
    studentLeft: student ? rel(student) : firstLeft
  };
}

// Onde deixar o scroll do menu:
// - se o separador ativo cabe a seguir ao aluno, o menu começa no aluno (inteiro);
// - senão centra o ativo, mas nunca deixa o aluno a meio: salta já para o primeiro separador.
function stripScrollLeft(pos, containerWidth){
  var startAtStudent = Math.max(0, pos.studentLeft - 10);
  if (pos.right - startAtStudent <= containerWidth - 16) return startAtStudent;
  var left = pos.center - containerWidth / 2;
  var minLeft = Math.max(0, pos.firstTabLeft - 2);
  return left < minLeft ? minLeft : left;
}

function renderProShell(){
  var selected = state.proSelectedId ? findStudent(state.proSelectedId) : null;
  // Fase 34: "Catálogo" é uma área ao mesmo nível do "Dashboard" — não é um
  // PRO_TABS (esses são por aluno) nem entra na página principal, como
  // pedido. Só um de "Dashboard"/"Catálogo" fica ativo de cada vez, e
  // qualquer aluno selecionado tem sempre prioridade sobre os dois.
  // com a ficha aberta, cada app mostra só o seu separador (Gestão: Pacotes; Acompanhamento: tudo menos Pacotes)
  if (selected && APP_MODE === "gestao") state.proTab = "sessoes";
  else if (selected && state.proTab === "sessoes") state.proTab = "perfil";
  if (selected && (state.proTab === "leitura" || state.proTab === "checkins" || state.proTab === "historico")) state.proTab = "perfil";   // separadores retirados
  if (selected && noNutritionOf(selected) && state.proTab === "plano") state.proTab = "perfil";
  var sidebar = "<div class=\"pro-sidebar" + (selected ? " pro-sidebar-student-open" : "") + "\">";
  if (!selected){
    if (APP_MODE === "gestao"){
      // app da Gestão: Estúdio e Contratos (as duas apps são independentes: sem ligações entre elas)
      if (state.proView !== "studio" && state.proView !== "contracts") state.proView = "studio";
      sidebar += "<button type=\"button\" class=\"pro-nav-item" + (state.proView==="studio" ? " active" : "") + "\" id=\"navStudio\">" + (G.loaded ? G.studioNavLabel() : "Hoje") + "</button>" +
        "<button type=\"button\" class=\"pro-nav-item" + (state.proView==="contracts" ? " active" : "") + "\" id=\"navContracts\">Contratos</button>";
    } else {
      if (state.proView === "studio" || state.proView === "contracts") state.proView = "dashboard";
      sidebar += "<button type=\"button\" class=\"pro-nav-item" + (state.proView==="dashboard" ? " active" : "") + "\" id=\"navDashboard\">Alunos</button>" +
        "<button type=\"button\" class=\"pro-nav-item" + (state.proView==="catalog" ? " active" : "") + "\" id=\"navCatalog\">Catálogo</button>" +
        "";
    }
  } else {
    // com um aluno aberto o menu são só as áreas desse aluno; voltar à lista é o botão "← Alunos" do cabeçalho
    sidebar += proStudentNavHtml();
  }
  sidebar += "</div>";

  proRoot.innerHTML = "<div class=\"pro-shell\">" + sidebar + "<div class=\"pro-main\" id=\"proMain\"></div></div>";

  var navDash = document.getElementById("navDashboard"), navCat = document.getElementById("navCatalog");
  if (navDash) navDash.addEventListener("click", function(){ state.proSelectedId=null; state.proView="dashboard"; renderProShell(); });
  if (navCat) navCat.addEventListener("click", function(){ state.proSelectedId=null; state.proView="catalog"; renderProShell(); });
  var navContracts = document.getElementById("navContracts");
  if (navContracts) navContracts.addEventListener("click", function(){ gestaoGo("contracts", true); });
  var navMe = document.getElementById("navMe");
  if (navMe) navMe.addEventListener("click", function(){ loadMe().then(goToMe); });
  var navStudio = document.getElementById("navStudio");
  if (navStudio) navStudio.addEventListener("click", function(){ gestaoGo("studio"); }); // lê os dados de novo de cada vez que se abre
  proRoot.querySelectorAll(".pro-sidebar [data-t]").forEach(function(btn){
    btn.addEventListener("click", function(){ state.proTab = btn.getAttribute("data-t"); renderProShell(); });
  });

  // No telemóvel o menu lateral vira uma fila horizontal com scroll (ver
  // @media max-width:760px em .pro-sidebar) — sem isto, um separador tocado
  // perto da margem fica meio cortado. Centra sempre o separador ativo depois
  // de o sidebar ser reconstruído.
  // Adiado: chamado logo a seguir a innerHTML=..., na mesma execução síncrona,
  // a geometria do layout recém-inserido ainda não está pronta (confirmado a
  // falhar sem isto). setTimeout em vez de requestAnimationFrame porque rAF
  // fica suspenso em separadores em segundo plano (nunca dispara).
  //
  // Fase 14: scrollIntoView({inline:"center"}) foi trocado por
  // container.scrollTo() — confirmado num telemóvel real que scrollIntoView
  // deslocava a PÁGINA inteira (não só este menu) ao tentar "ajudar" a
  // centrar o elemento, cortando o resto do ecrã. scrollTo() chamado no
  // próprio contentor nunca escapa a ele (ao contrário de scrollIntoView).
  // Continua a precisar de behavior:"instant" explícito — confirmado que
  // mesmo a atribuição direta a .scrollLeft herda scroll-behavior:smooth do
  // CSS neste motor de browser, o que reintroduziria o problema original
  // (animação smooth iniciada por código nunca progride em segundo plano).
  setTimeout(function(){
    var container = proRoot.querySelector(".pro-sidebar");
    var activeNavItem = container && container.querySelector(".pro-nav-item.active");
    if (container && activeNavItem){
      var pos = stripPositions(container, activeNavItem);
      var targetCenter = pos.center; // centro relativo ao menu (offsetLeft é relativo à página)
      container.scrollTo({left: stripScrollLeft(pos, container.clientWidth), behavior: "instant"});
    }
  }, 0);

  if (selected) renderProDetailMain(selected);
  else if (state.proView === "catalog") renderProCatalogMain();
  else if (state.proView === "studio" || state.proView === "contracts") renderGestaoMain(state.proView);
  else renderProDashboardMain();
}

function daysAgoLabel(n){ if (n===0) return "hoje"; if (n===1) return "há 1 dia"; return "há " + n + " dias"; }

// Alunos de demonstração (is_demo) ficam fora da operação diária por
// omissão — o profissional só os vê se pedir explicitamente (Fase 9). Isto é
// só um filtro de visualização: RLS/acesso nunca dependem de is_demo, e o
// profissional continua a poder abrir o perfil de um aluno de demo pelo id.
function visibleStudentsForDashboard(){
  return state.showDemoStudents ? STUDENTS : STUDENTS.filter(function(s){ return !s.isDemo; });
}

// "Ativo" é um estado novo e independente de is_demo (demonstração): um aluno
// real pode estar ativo ou inativo (ex. parou de treinar contigo, mas
// mantém-se o histórico). Por omissão todos os alunos são ativos — só fica
// inativo quem o profissional marcar explicitamente.
function isStudentActive(s){ return s.active !== false; }
// aluno criado a partir da agenda que não usa a app: não há registos a esperar dele (migração 0026); com convite ou conta deixa de o ser
// aluno que faz a nutrição com outra pessoa: a app esconde-lhe (e esconde ao profissional) tudo o que é alimentação
function noNutritionOf(s){ return !!(s && s.noNutrition); }
function isStudioOnly(s){ return !!(s && s.studioOnly && !s.inviteEmail && !s.authUserId); }
// dias sem check-in para o painel (quem não usa a app nunca está "em atraso")
function dashLateDays(s){ return isStudioOnly(s) ? 0 : computeLastCheckinDaysAgo(s); }

// linhas da lista de alunos: filtradas pela pesquisa (sem distinguir maiúsculas/acentos) e ordenadas por atenção ou por nome
// «br» encontra «Bruno Costa» e «Ana Brito»: o nome, ou qualquer palavra dele, começa pelas letras escritas
function nameStartsWithQuery(name, q){
  var n = exLibFold(name);
  return n.indexOf(q) === 0 || (" " + n).indexOf(" " + q) >= 0;
}
var dashRowsCache = [];
function redrawDashList(){
  var box = document.getElementById("studentListBox");
  if (!box) return;
  box.innerHTML = studentListRowsHtml(dashRowsCache); wireStudentList(box);
  var q = String(state.dashSearch || "").trim(), extras = document.getElementById("dashExtras"), head = document.getElementById("studentListHead");
  if (extras) extras.hidden = !!q;
  if (head){ var n = box.querySelectorAll(".student-row").length; head.setAttribute("data-label", head.getAttribute("data-label") || head.textContent); head.textContent = head.getAttribute("data-label") + (q ? " · " + n + (n === 1 ? " resultado" : " resultados") : ""); }
}
// a ordem muda uma lista que pode estar longe do ecrã: levá-la à vista para o toque ter efeito visível
function showDashListHead(){ var h = document.getElementById("studentListHead"); if (h && h.scrollIntoView){ try { h.scrollIntoView({block: "start", behavior: "smooth"}); } catch (e) { h.scrollIntoView(); } } }
// ligado ao documento uma só vez: um redesenho do ecrã em segundo plano não pode deixar a lupa sem ouvinte
document.addEventListener("input", function(e){ var t = e.target; if (t && t.id === "stuSearch"){ state.dashSearch = t.value; redrawDashList(); } });
document.addEventListener("keyup", function(e){ var t = e.target; if (t && t.id === "stuSearch" && t.value !== (state.dashSearch || "")){ state.dashSearch = t.value; redrawDashList(); } });
document.addEventListener("compositionend", function(e){ var t = e.target; if (t && t.id === "stuSearch"){ state.dashSearch = t.value; redrawDashList(); } });
document.addEventListener("search", function(e){ var t = e.target; if (t && t.id === "stuSearch"){ state.dashSearch = t.value; redrawDashList(); } });
document.addEventListener("change", function(e){ var t = e.target; if (t && t.id === "stuSort"){ state.dashSort = t.value; redrawDashList(); showDashListHead(); } });
function studentListRowsHtml(allRows){
  var q = exLibFold(state.dashSearch || ""), sort = state.dashSort || "atencao";
  var rows = allRows.filter(function(r){ return !q || nameStartsWithQuery(r.s.name, q); });
  var byName = function(a, b){ return String(a.s.name).localeCompare(String(b.s.name), "pt", {sensitivity: "base"}); };
  rows.sort(sort === "az" ? byName : sort === "za" ? function(a, b){ return byName(b, a); } :
    function(a, b){ return (b.pending - a.pending) || (b.crit - a.crit) || (b.alerts.length - a.alerts.length) || (b.days - a.days) || byName(a, b); });
  var html = "";
  rows.forEach(function(r){
    var st = r.s;
    var badges = (r.pending ? "<span class=\"pill critical\">" + plural(r.pending, "pedido de ajuda", "pedidos de ajuda") + "</span>" : "") + (r.alerts.length ? "<span class=\"pill " + (r.crit ? "critical" : "warn") + "\">" + r.alerts.length + (r.alerts.length === 1 ? " alerta" : " alertas") + "</span>" : "") +
      (r.days >= 7 ? "<span class=\"pill\">check-in " + (r.days === 999 ? "nunca" : daysAgoLabel(r.days)) + "</span>" : "") + coachBadgesHtml(r.coach);
    html += "<div class=\"card student-row\" data-id=\"" + st.id + "\">" +
      "<div class=\"student-row-main\" data-open=\"" + st.id + "\">" +
        "<div class=\"avatar\">" + escapeHtml(st.initials) + "</div>" +
        "<div><div class=\"sname\">" + escapeHtml(st.name) + (st.isDemo ? " <span class=\"pill\" style=\"font-size:0.65rem;\">demonstração</span>" : "") + "</div><div class=\"sgoal\">" + (isStudioOnly(st) ? "Só estúdio" : escapeHtml(st.goal)) + "</div>" +
        (badges ? "<div class=\"sr-badges\">" + badges + "</div>" : "") + "</div>" +
      "</div>" +
      "<label class=\"switch\" title=\"" + (isStudentActive(st) ? "Ativo" : "Inativo") + "\">" +
        "<input type=\"checkbox\" data-active-toggle=\"" + st.id + "\"" + (isStudentActive(st) ? " checked" : "") + ">" +
        "<span class=\"switch-track\"><span class=\"switch-thumb\"></span></span>" +
      "</label>" +
    "</div>";
  });
  if (!rows.length) html += "<p class=\"muted-p\">" + (q ? "Nenhum aluno com «" + escapeHtml(state.dashSearch) + "»." : "Nenhum aluno para mostrar.") + "</p>";
  return html;
}
function wireStudentList(root){
  root.querySelectorAll("[data-open]").forEach(function(el){
    el.addEventListener("click", function(){ state.proSelectedId = el.getAttribute("data-open"); state.proTab="perfil"; renderProShell(); try { window.scrollTo(0, 0); } catch (e) {} });
  });
  root.querySelectorAll("[data-active-toggle]").forEach(function(input){
    input.addEventListener("click", function(e){ e.stopPropagation(); });
    input.addEventListener("change", function(){
      var s = findStudent(input.getAttribute("data-active-toggle"));
      if (!s) return;
      ensureSyncBaseline(s); // antes de alterar: só se grava a coluna "active"
      s.active = input.checked;
      persistStudent(s);
      renderProDashboardMain();
    });
  });
}

var APP_BUILD = "2026-10-15 · lupa 4";   // sobe quando mudar algo visível: serve para ver se o browser tem a versão mais recente
function renderProDashboardMain(){
  var main = document.getElementById("proMain"), dashAllRows = [];
  var hadSearchFocus = dashSearchFocused(), searchCaret = hadSearchFocus ? document.activeElement.selectionStart : null;
  var visible = visibleStudentsForDashboard();
  var demoCount = STUDENTS.filter(function(s){ return s.isDemo; }).length;
  var activeStudents = visible.filter(isStudentActive);
  var pendingCheckins = activeStudents.filter(function(s){ return dashLateDays(s)>=7; }).length;
  var alertCount = activeStudents.reduce(function(a,s){ return a + computeDashboardAlerts(s).length; }, 0);

  // a lupa e a ordem ficam no topo, à vista (antes ficavam por baixo dos cartões e perdiam-se no telemóvel)
  var toolsHtml = state.dashboardListMode ? (
"<div class=\"student-tools\"><label class=\"student-search\"><span aria-hidden=\"true\">🔍</span><input type=\"search\" id=\"stuSearch\" placeholder=\"Procurar aluno…\" autocomplete=\"off\" autocapitalize=\"off\" aria-label=\"Procurar aluno\" value=\"" + escapeHtml(state.dashSearch || "") + "\"></label>" +
      "<select id=\"stuSort\" class=\"mini-select\" aria-label=\"Ordenar alunos\">" + [["atencao", "Por atenção"], ["az", "Nome A → Z"], ["za", "Nome Z → A"]].map(function(o){ return "<option value=\"" + o[0] + "\"" + ((state.dashSort || "atencao") === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></div>") : "";
  var html = toolsHtml + "<div class=\"pro-stat-row\">" +
    proStat(activeStudents.length, "Alunos ativos", "active") +
    (WEEKLY_CHECKIN_ENABLED ? proStat(pendingCheckins, "Check-ins", "checkins") : "") +
    (DASH_ALERTS_ENABLED ? proStat(alertCount, "Alertas", "alerts") : "") +
    proStat(visible.length, "Total de alunos", "total") +
  "</div>";

  html += "<div style=\"display:flex; flex-wrap:wrap; gap:10px; align-items:stretch; margin-bottom:14px;\">" +
    (demoCount ? "<button type=\"button\" class=\"btn btn-sm\" id=\"toggleDemo\" style=\"flex:1 1 150px; min-height:44px;\">" + (state.showDemoStudents ? "Ocultar contas de demonstração" : "Mostrar contas de demonstração (" + demoCount + ")") + "</button>" : "") +
    "<button type=\"button\" class=\"btn btn-sm\" id=\"btnRefresh\" style=\"flex:0 1 110px; min-height:44px;\" aria-label=\"Atualizar a lista de alunos\">↻ Atualizar</button>" +
    "<button type=\"button\" class=\"btn primary\" id=\"btnInvite\" style=\"flex:1 1 150px; min-height:44px;\">+ Convidar aluno</button>" +
  "</div>";

  // Retenção: quem contactar hoje, alunos novos e pulso do estúdio (só com alunos reais ativos)
  // com texto na lupa estes cartões escondem-se: a lista (que fica por baixo deles) passa a estar logo debaixo do teclado
  html += "<div id=\"dashExtras\"" + (String(state.dashSearch || "").trim() ? " hidden" : "") + ">" + tplPhaseReviews() + (HELP_REQUESTS_ENABLED ? tplContactQueue(activeStudents) : "") + (ONBOARDING_CARD_ENABLED ? tplOnboardingCard(activeStudents) : "") + (STUDIO_PULSE_ENABLED ? tplStudioPulse(activeStudents) : "") + "</div>";

  // A lista de alunos está sempre à vista, por ordem de atenção (alertas críticos primeiro, depois quem está há mais tempo sem check-in).
  // Os quatro blocos de contagem filtram a lista: "Alunos ativos" (por omissão), "Check-ins" em atraso, "Alertas" e "Total de alunos"
  // (incluindo inativos, para poderes reativar alguém); cada linha tem o interruptor ativo/inativo.
  if (state.dashboardListMode){
    var mode = state.dashboardListMode;
    var listStudents = mode === "total" ? visible : activeStudents.filter(function(st){
      if (mode === "checkins") return dashLateDays(st) >= 7;
      if (mode === "alerts") return computeDashboardAlerts(st).length > 0;
      return true;
    });
    var allRows = dashAllRows = listStudents.map(function(st){
      var al = computeDashboardAlerts(st);
      return {s: st, alerts: al, coach: computeCoachBadges(st), crit: al.filter(function(x){ return x.type === "critical"; }).length, days: dashLateDays(st), pending: pendingHelpFor(st.id)};
    });
    var modeLabel = {active: "Alunos ativos", total: "Todos os alunos", checkins: "Check-ins em atraso", alerts: "Alunos com alertas"}[mode] || "Alunos";
    html += "<div class=\"eyebrow\" id=\"studentListHead\" style=\"margin-bottom:10px;\">" + modeLabel + "</div>";
    html += "<div class=\"student-list\" id=\"studentListBox\">" + studentListRowsHtml(allRows) + "</div>";
  }

  html += "<p class=\"muted-p\" id=\"appBuild\" style=\"font-size:0.7rem; text-align:center; margin:18px 0 6px;\">Versão " + APP_BUILD + "</p>";
  main.innerHTML = html;
  dashRowsCache = dashAllRows;
  var listBox = main.querySelector("#studentListBox");
  if (listBox) redrawDashList();
  if (hadSearchFocus){ var se = main.querySelector("#stuSearch"); if (se){ try { se.focus(); if (searchCaret != null) se.setSelectionRange(searchCaret, searchCaret); } catch (e) {} } }
  var cqToggle = main.querySelector("#contactToggle");
  if (cqToggle) cqToggle.addEventListener("click", function(){
    var body = main.querySelector("#contactBody"), nowOpen = body.hidden;   // hidden → abrir
    body.hidden = !nowOpen; setContactQueueOpen(nowOpen);
    cqToggle.setAttribute("aria-expanded", nowOpen ? "true" : "false");
    var chev = cqToggle.lastElementChild; if (chev) chev.style.transform = "rotate(" + (nowOpen ? 90 : 0) + "deg)";
  });
  wirePhaseReviews(main, function(){ renderProDashboardMain(); });
  main.querySelectorAll("[data-contact]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var st = findStudent(btn.getAttribute("data-contact"));
      if (st) openContactModal(st, btn.getAttribute("data-reason"), function(){ renderProDashboardMain(); });
    });
  });
  main.querySelectorAll("[data-open-student]").forEach(function(btn){
    btn.addEventListener("click", function(){ state.proSelectedId = btn.getAttribute("data-open-student"); state.proTab = "perfil"; renderProShell(); try { window.scrollTo(0, 0); } catch (e) {} });
  });
  main.querySelectorAll("[data-stat-key]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var key = btn.getAttribute("data-stat-key");
      state.dashboardListMode = key; // os blocos filtram a lista; ficam sempre com um selecionado
      renderProDashboardMain();
    });
  });
  document.getElementById("btnInvite").addEventListener("click", openInviteModal);
  document.getElementById("btnRefresh").addEventListener("click", function(){
    proRefreshAndRender(true).then(function(ok){ showToast(ok ? "✓ Lista atualizada" : "Não foi possível atualizar — verifica a ligação"); });
  });
  var toggleDemoBtn = document.getElementById("toggleDemo");
  if (toggleDemoBtn) toggleDemoBtn.addEventListener("click", function(){
    state.showDemoStudents = !state.showDemoStudents;
    renderProDashboardMain();
  });
  refreshPendingHelp(); // pedidos por tratar: a lista volta a desenhar-se só se a contagem mudou
}

/* ---------- Convite / questionário inicial ---------- */

function openInviteModal(){
  var link = window.location.origin + window.location.pathname;
  var html = "<div class=\"mtitle\">Convidar novo aluno</div>" +
    "<p class=\"muted-p\" style=\"margin-top:6px;\">1. Preenche o questionário do aluno abaixo (com o email dele). 2. Envia-lhe este link e diz-lhe para criar conta com esse mesmo email.</p>" +
    "<div class=\"invite-link-box\"><span class=\"num\">" + link + "</span><button type=\"button\" class=\"btn btn-sm\" id=\"copyLink\">Copiar</button></div>" +
    "<button type=\"button\" class=\"btn primary\" id=\"simulateFill\" style=\"width:100%; margin-top:8px;\">Preencher questionário do aluno</button>";
  var sheet = openModal(html, {centered:true});
  var copyBtn = sheet.querySelector("#copyLink");
  copyBtn.addEventListener("click", function(){
    try {
      navigator.clipboard.writeText(link);
      copyBtn.textContent = "Copiado ✓";
      setTimeout(function(){ copyBtn.textContent = "Copiar"; }, 1400);
    } catch(e){}
  });
  sheet.querySelector("#simulateFill").addEventListener("click", openOnboardingForm);
}

// Alinhado byte a byte às secções e perguntas do questionário real
// (Google Forms "Avaliação de Hábitos Alimentares, Rotina e Sono") — só as
// perguntas de Objetivo/Treino/Peso ficam fora dele, porque são preenchidas
// pelo profissional (nunca pelo aluno) e alimentam o cálculo automático de
// sugestão de calorias/macros (computeSuggestedTargets).
var SUPPLEMENT_OPTIONS = ["Proteína", "Creatina"];
var WORK_MEALS_EASE_OPTIONS = ["Muito fácil", "Fácil", "Difícil", "Muito Difícil"];
var WATER_INTAKE_OPTIONS = ["Menos de 1L", "Entre 1L e 2L", "Entre 2L e 3L", "Mais de 3L"];

function openOnboardingForm(){
  var html = "<div class=\"mtitle\">Questionário inicial</div>" +
    "<p class=\"muted-p\" style=\"margin-top:4px; margin-bottom:14px;\">A preencher como se fosses o novo aluno no teu telemóvel.</p>" +

    "<div class=\"onb-section-title\">Informações pessoais</div>" +
    "<div class=\"onb-field\"><label>Nome completo</label><input type=\"text\" id=\"obName\" placeholder=\"Nome completo\"></div>" +
    "<div class=\"onb-field\"><label>Email (para o aluno criar a conta)</label><input type=\"email\" id=\"obEmail\" placeholder=\"email@exemplo.com\"></div>" +
    "<label style=\"display:flex; align-items:center; gap:8px; font-size:0.85rem; cursor:pointer; margin:4px 0 12px;\"><input type=\"checkbox\" id=\"obNoNutrition\"> Não faz nutrição comigo (fica sem o bloco de alimentação)</label>" +
    "<div class=\"onb-field\"><label>Telefone / WhatsApp (opcional)</label><input type=\"tel\" id=\"obPhone\" placeholder=\"912 345 678\" autocomplete=\"off\"></div>" +
    "<p class=\"muted-p\" id=\"obError\" style=\"color:var(--critical); display:none; margin:-6px 0 10px;\"></p>" +
    "<div class=\"onb-field\"><label>Género</label><select id=\"obSex\"><option>Masculino</option><option>Feminino</option><option>Outro</option><option>Prefiro não dizer</option></select></div>" +
    "<div class=\"onb-row\">" +
      "<div class=\"onb-field\"><label>Data de nascimento</label><input type=\"date\" id=\"obBirthDate\"></div>" +
      "<div class=\"onb-field\"><label>Idade</label><input type=\"number\" min=\"0\" id=\"obAge\" value=\"30\"></div>" +
    "</div>" +
    "<div class=\"onb-field\"><label>Altura (cm)</label><select id=\"obHeight\">" +
      HEIGHT_OPTIONS.map(function(h){ return "<option" + (h===170?" selected":"") + ">" + h + "</option>"; }).join("") +
    "</select></div>" +

    "<div class=\"onb-section-title\">Objetivo e treino</div>" +
    "<p class=\"muted-p\" style=\"margin-top:-6px; margin-bottom:10px;\">Esta secção preenches tu — não está no questionário do aluno, mas o plano precisa dela.</p>" +
    "<div class=\"onb-field\"><label>Peso atual (kg)</label><input type=\"number\" step=\"0.1\" min=\"0\" id=\"obWeight\" value=\"70\"></div>" +
    "<div class=\"onb-field\"><label>O que procura?</label><select id=\"obGoal\">" +
      ONBOARDING_GOAL_OPTIONS.map(function(g){ return "<option>" + g + "</option>"; }).join("") +
    "</select></div>" +
    "<div class=\"onb-row\">" +
      "<div class=\"onb-field\"><label>Treinos por semana</label><select id=\"obTrainings\">" +
        [0,1,2,3,4,5,6,7].map(function(n){ return "<option" + (n===4?" selected":"") + ">" + n + "</option>"; }).join("") +
      "</select></div>" +
      "<div class=\"onb-field\"><label>Horário habitual de treino</label><input type=\"time\" id=\"obTrainTime\"></div>" +
    "</div>" +
    "<div class=\"onb-field\"><label>Tipo de treino</label><input type=\"text\" id=\"obTrainType\" placeholder=\"Ex: Musculação\"></div>" +
    "<div class=\"onb-field\"><label>Nível de atividade física fora do treino</label><select id=\"obActivityLevel\">" +
      "<option value=\"\">— usa o nº de treinos como aproximação —</option>" +
      ACTIVITY_LEVEL_OPTIONS.map(function(o){ return "<option value=\"" + o + "\">" + o + " — " + ACTIVITY_LEVEL_DESCRIPTIONS[o] + "</option>"; }).join("") +
    "</select></div>" +
    "<div class=\"onb-row\">" +
      "<div class=\"onb-field\"><label>Acorda</label><input type=\"time\" id=\"obWake\"></div>" +
      "<div class=\"onb-field\"><label>Dorme</label><input type=\"time\" id=\"obSleep\"></div>" +
    "</div>" +

    "<div class=\"onb-section-title\">Rotina de trabalho e alimentação</div>" +
    "<div class=\"onb-field\"><label>Horário de trabalho</label><input type=\"text\" id=\"obWork\" placeholder=\"Ex: 9h-18h, Turnos...\"></div>" +
    "<div class=\"onb-field\"><label>Facilidade de fazer refeições no local de trabalho</label><select id=\"obMealsAtWorkEase\">" +
      WORK_MEALS_EASE_OPTIONS.map(function(o){ return "<option>" + o + "</option>"; }).join("") +
    "</select></div>" +
    "<div class=\"onb-field\"><label>Utiliza algum tipo de suplemento?</label><select id=\"obUsesSupplements\"><option>Não</option><option>Sim</option></select></div>" +
    "<div class=\"onb-field\" id=\"obSupplementsField\" style=\"display:none;\"><label>Que suplementos utiliza?</label>" +
      "<div class=\"onb-checkbox-row\">" +
        SUPPLEMENT_OPTIONS.map(function(o){ return "<label><input type=\"checkbox\" class=\"obSupplementOpt\" value=\"" + o + "\">" + o + "</label>"; }).join("") +
        "<label><input type=\"checkbox\" id=\"obSupplementOther\">Outra:</label>" +
        "<input type=\"text\" id=\"obSupplementOtherText\" placeholder=\"qual?\">" +
      "</div>" +
    "</div>" +

    "<div class=\"onb-section-title\">Horário e refeições</div>" +
    "<div class=\"onb-field\"><label>Descreva o dia-a-dia alimentar (refeições, horários, quantidades aproximadas)</label>" +
      "<textarea id=\"obDailyEating\" placeholder=\"Ex: 8h – Pequeno-almoço: 2 ovos, 1 fatia de pão integral e 1 copo de leite; 13h – Almoço: 1/4 prato de frango, 1/2 prato de arroz, 1/4 prato de salada e 1 fruta; etc.\"></textarea>" +
    "</div>" +
    "<div class=\"onb-field\"><label>Nº de refeições exageradas por semana</label><select id=\"obOvereating\">" +
      [0,1,2,3,4,5,6,7].map(function(n){ return "<option" + (n===0?" selected":"") + ">" + n + "</option>"; }).join("") +
    "</select></div>" +
    "<div class=\"onb-field\"><label>Alimentos que nunca consome ou é alérgico/a</label><textarea id=\"obAllergies\" placeholder=\"Liste todos os alimentos que não consome por opção ou por alergia, separados por vírgula\"></textarea></div>" +
    "<div class=\"onb-field\"><label>Alimento ou grupo de alimentos que mais lhe custa controlar ou resistir</label><textarea id=\"obHardestFood\"></textarea></div>" +

    "<div class=\"onb-section-title\">Hidratação</div>" +
    "<div class=\"onb-field\"><label>Quantidade de água ingerida em 24h</label><select id=\"obWaterIntake\">" +
      WATER_INTAKE_OPTIONS.map(function(o){ return "<option>" + o + "</option>"; }).join("") +
    "</select></div>" +

    "<button type=\"button\" class=\"btn primary\" id=\"submitOnboarding\" style=\"width:100%; margin-top:6px;\">Enviar questionário</button>";

  var sheet = openModal(html, {centered:true});

  // "Que suplementos utiliza?" só faz sentido depois de responder "Sim" —
  // mesma lógica condicional do questionário real do Google Forms (a secção
  // 4 só aparece a quem respondeu Sim na secção 3).
  var suppSelect = sheet.querySelector("#obUsesSupplements");
  var suppField = sheet.querySelector("#obSupplementsField");
  function syncSupplementsVisibility(){ suppField.style.display = suppSelect.value === "Sim" ? "" : "none"; }
  suppSelect.addEventListener("change", syncSupplementsVisibility);
  syncSupplementsVisibility();

  // Fase 28: pedido explícito — ao escolher a data de nascimento, a idade
  // preenche-se sozinha (deixa de ser preciso responder às duas perguntas
  // em separado). O campo "Idade" continua editável à mão, para o caso de
  // não se saber a data exata.
  var birthDateInput = sheet.querySelector("#obBirthDate");
  birthDateInput.addEventListener("change", function(){
    var age = ageFromBirthDate(birthDateInput.value);
    if (age != null) sheet.querySelector("#obAge").value = age;
  });

  sheet.querySelector("#submitOnboarding").addEventListener("click", function(){
    var errEl = sheet.querySelector("#obError");
    errEl.style.display = "none";
    var name = sheet.querySelector("#obName").value.trim();
    if (!name){
      errEl.textContent = "Indica o nome do aluno.";
      errEl.style.display = "block";
      sheet.querySelector("#obName").focus();
      return;
    }
    var inviteEmail = sheet.querySelector("#obEmail").value.trim().toLowerCase();
    if (!inviteEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)){
      errEl.textContent = "Indica um email válido — é com ele que o aluno vai criar a conta. Sem email, o aluno nunca vai conseguir associar-se a este perfil.";
      errEl.style.display = "block";
      sheet.querySelector("#obEmail").focus();
      return;
    }
    var ageRaw = sheet.querySelector("#obAge").value.trim();
    var heightRaw = sheet.querySelector("#obHeight").value.trim();
    var weightRaw = sheet.querySelector("#obWeight").value.trim();
    var ageVal = ageRaw ? parseInt(ageRaw,10) : 30;
    var heightVal = heightRaw ? parseFloat(heightRaw) : 170;
    var weightVal = weightRaw ? parseFloat(weightRaw) : 70;
    if (ageVal <= 0 || heightVal <= 0 || weightVal <= 0){
      errEl.textContent = "Idade, altura e peso têm de ser valores superiores a 0.";
      errEl.style.display = "block";
      sheet.querySelector(ageVal<=0 ? "#obAge" : (heightVal<=0 ? "#obHeight" : "#obWeight")).focus();
      return;
    }

    var usesSupplements = sheet.querySelector("#obUsesSupplements").value === "Sim";
    var supplements = [];
    if (usesSupplements){
      sheet.querySelectorAll(".obSupplementOpt:checked").forEach(function(cb){ supplements.push(cb.value); });
      if (sheet.querySelector("#obSupplementOther").checked){
        var otherText = sheet.querySelector("#obSupplementOtherText").value.trim();
        supplements.push(otherText ? "Outra: " + otherText : "Outra");
      }
    }
    var overeatingRaw = sheet.querySelector("#obOvereating").value.trim();

    var profile = {
      name:name,
      age: ageVal,
      birthDate: sheet.querySelector("#obBirthDate").value || null,
      sex: sheet.querySelector("#obSex").value,
      height: heightVal,
      weight: weightVal,
      goal: sheet.querySelector("#obGoal").value,
      trainingsPerWeek: Math.max(0, parseInt(sheet.querySelector("#obTrainings").value,10) || 0),
      trainingTime: sheet.querySelector("#obTrainTime").value,
      trainingType: sheet.querySelector("#obTrainType").value,
      activityLevel: sheet.querySelector("#obActivityLevel").value || null,
      wakeTime: sheet.querySelector("#obWake").value,
      sleepTime: sheet.querySelector("#obSleep").value,
      work: sheet.querySelector("#obWork").value,
      mealsAtWorkEase: sheet.querySelector("#obMealsAtWorkEase").value,
      usesSupplements: usesSupplements,
      supplements: supplements,
      dailyEatingDescription: sheet.querySelector("#obDailyEating").value.trim(),
      overeatingMealsPerWeek: overeatingRaw ? Math.max(0, parseInt(overeatingRaw,10) || 0) : null,
      allergies: sheet.querySelector("#obAllergies").value.split(/[,\n]/).map(function(x){return x.trim();}).filter(Boolean),
      hardestFoodToResist: sheet.querySelector("#obHardestFood").value.trim(),
      waterIntake: sheet.querySelector("#obWaterIntake").value
    };

    var suggested = computeSuggestedTargets(profile);
    var today = localTodayISO();
    var baseId = slug(name) || ("aluno-" + Date.now());
    var id = baseId;
    var n = 2;
    while (findStudent(id)){ id = baseId + "-" + n; n++; }

    var newStudent = {
      id:id, initials:initialsOf(name), name:name, age:profile.age, birthDate:profile.birthDate, sex:profile.sex, height:profile.height,
      weightInitial:profile.weight, weightCurrent:profile.weight, weightGoal:null,
      goal:profile.goal, trainingsPerWeek:profile.trainingsPerWeek, trainingType:profile.trainingType||"—", trainingTime:profile.trainingTime||"—",
      activityLevel:profile.activityLevel,
      wakeTime:profile.wakeTime||"—", sleepTime:profile.sleepTime||"—",
      likes:[], dislikes:[], avoid:[], allergies:profile.allergies,
      mealsPreferred:5, budget:"—", cookTime:"—",
      work:profile.work||"—", weekendNote:"—",
      mealsAtWorkEase:profile.mealsAtWorkEase, usesSupplements:profile.usesSupplements, supplements:profile.supplements,
      dailyEatingDescription:profile.dailyEatingDescription, overeatingMealsPerWeek:profile.overeatingMealsPerWeek,
      hardestFoodToResist:profile.hardestFoodToResist, waterIntake:profile.waterIntake,
      targets:{kcal:suggested.kcal, protein:suggested.protein, carbs:suggested.carbs, fat:suggested.fat},
      flexibility:50,
      flexOverrides:{},
      flexHistory:[],
      blockedFoods:[],
      substitutionHistory:[],
      adaptationHistory:[],
      alerts:[{type:"warn", text:"Plano ainda por definir"}],
      notes:"",
      meals:[],
      checkins:[],
      weights:[{date:today, w:profile.weight}],
      assessments:[],
      allowPhotos:false,
      photos:[],
      weightLogPhotos:[],
      planHistory:[],
      lastCheckinDaysAgo:0,
      fromOnboarding:true,
      inviteEmail: inviteEmail || null,
      noNutrition: !!sheet.querySelector("#obNoNutrition").checked,
      phone: normalizePhone(sheet.querySelector("#obPhone").value).ok ? sheet.querySelector("#obPhone").value.trim().slice(0, 30) : null,
      createdAt: new Date().toISOString()
    };

    STUDENTS.push(newStudent);
    insertStudent(newStudent);
    closeModal();
    state.proSelectedId = id;
    state.proTab = "plano";
    renderProShell();
  });
}

function proStat(v, l, key){
  var active = key && state.dashboardListMode === key;
  var tag = key ? "button type=\"button\"" : "div";
  var closeTag = key ? "button" : "div";
  return "<" + tag + " class=\"pro-stat-card" + (key ? " pro-stat-card-clickable" : "") + (active ? " active" : "") + "\"" + (key ? " data-stat-key=\"" + key + "\"" : "") + "><div class=\"v num\">" + v + "</div><div class=\"l\">" + l + "</div></" + closeTag + ">";
}

// Fase 25: o separador chama-se "Nutrição" na interface, mas a key interna
// continua "plano" (routing/estado e todo o resto do código já dependem
// dela) — só o rótulo visível muda, pedido explícito.
// Navegação do profissional por aluno: quatro entradas (cada separador continua a ter a sua key; os de uma mesma entrada ficam juntos em atalhos)
// Acompanhamento: as 4 áreas do aluno; Gestão: só os pacotes (aulas, recebimentos) do aluno
var PRO_NAV = APP_MODE === "gestao" ? [
  {id: "pacotes", label: "Pacotes", tabs: ["sessoes"]}
] : [
  {id: "resumo", label: "Resumo", tabs: HELP_REQUESTS_ENABLED ? ["pedidos", "perfil", "notas"] : ["perfil", "notas"]},
  {id: "nutricao", label: "Nutrição", tabs: ["plano"]},
  {id: "treino", label: "Treino", tabs: ["treino"]},
  {id: "avaliacao", label: "Avaliação", tabs: ["evolucao"]}
];
// as 4 áreas do aluno aberto (o ponto vermelho em "Resumo" avisa que há pedidos de ajuda por tratar)
function proStudentNavHtml(){
  var curGroup = proNavGroupOf(state.proTab);
  var stu = findStudent(state.proSelectedId);
  return PRO_NAV.filter(function(g){ return !(g.id === "nutricao" && noNutritionOf(stu)); }).map(function(g){
    var on = g === curGroup, pend = g.id === "resumo" && pendingHelpFor(state.proSelectedId) > 0;
    return "<button type=\"button\" class=\"pro-nav-item" + (on ? " active" : "") + (pend ? " has-pending" : "") + "\" data-g=\"" + g.id + "\" data-t=\"" + (on ? state.proTab : g.tabs[0]) + "\">" + g.label + "</button>";
  }).join("");
}
function proNavGroupOf(tabKey){ return PRO_NAV.filter(function(g){ return g.tabs.indexOf(tabKey) >= 0; })[0] || PRO_NAV[0]; }
function proTabLabel(key){ var t = PRO_TABS.filter(function(x){ return x[0] === key; })[0]; return t ? t[1] : key; }
var PRO_TABS = [["perfil","Perfil"],["leitura","Leitura"],["pedidos","Pedidos"],["plano","Nutrição"],["treino","Treino"],["evolucao","Avaliação"],["checkins","Check-ins"],["sessoes","Pacotes"],["notas","Notas"],["historico","Histórico"]];

function renderProDetailMain(s){
  ensureSyncBaseline(s);
  var main = document.getElementById("proMain");
  var group = proNavGroupOf(state.proTab);
  var subtabs = group.tabs.length > 1 ? "<div class=\"pro-subtabs\">" + group.tabs.map(function(k){
    return "<button type=\"button\" class=\"chip" + (k === state.proTab ? " on" : "") + "\" data-sub=\"" + k + "\" aria-pressed=\"" + (k === state.proTab) + "\">" + proTabLabel(k) + (k === "pedidos" && pendingHelpFor(s.id) ? " (" + pendingHelpFor(s.id) + ")" : "") + "</button>";
  }).join("") + "</div>" : "";
  main.innerHTML = "<div class=\"detail-header\">" +
      "<button type=\"button\" class=\"btn pro-back\" id=\"proBack\" aria-label=\"Voltar à lista de alunos\">←</button>" +
      "<div class=\"avatar\">" + escapeHtml(s.initials) + "</div>" +
      "<div><div class=\"sname\">" + escapeHtml(s.name) + "</div><div class=\"muted-p\">" + escapeHtml(s.goal) + "</div></div>" +
    "</div>" +
    (APP_MODE === "gestao" ? "" : "<div class=\"quick-actions\">" +
      "<button type=\"button\" class=\"chip\" data-qa=\"aluno\">Ver como aluno</button>" +
    "</div>") + subtabs +
    "<div id=\"proTabContent\" class=\"card\"></div>";
  wireProDetailNav(main);
  renderProTabContent(s);
}

// voltar à lista, atalhos de ação e separadores da mesma área
function wireProDetailNav(main){
  var back = main.querySelector("#proBack");
  if (back) back.addEventListener("click", function(){ state.proSelectedId = null; state.proView = APP_MODE === "gestao" ? (state.lastGestaoView || "studio") : "dashboard"; renderProShell(); try { window.scrollTo(0, 0); } catch (e) {} });
  main.querySelectorAll("[data-sub]").forEach(function(b){
    b.addEventListener("click", function(){ state.proTab = b.getAttribute("data-sub"); renderProShell(); });
  });
  main.querySelectorAll("[data-qa]").forEach(function(b){
    b.addEventListener("click", function(){
      var act = b.getAttribute("data-qa");
      if (act === "aluno"){ setMode("aluno"); return; }
      if (act === "trocareu"){ meState.id = null; saveMe().then(function(){ state.proSelectedId = null; renderProShell(); openMeModal(); }); return; }
      state.proTab = act === "avaliar" ? "evolucao" : "plano";
      renderProShell();
      // leva o ecrã até ao formulário (sem scrollIntoView: nos telemóveis arrastava a página inteira)
      setTimeout(function(){
        var target = document.getElementById(act === "avaliar" ? "asWeight" : "tKcal");
        if (!target) return;
        window.scrollTo({top: Math.max(0, target.getBoundingClientRect().top + (window.pageYOffset || 0) - 90), behavior: (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) ? "auto" : "smooth"});
      }, 60);
    });
  });
}

function renderProTabContent(s){
  var el = document.getElementById("proTabContent");
  if (state.proTab==="pedidos"){
    el.innerHTML = "<p class=\"muted-p\">A carregar pedidos...</p>";
    loadHelpRequests(s.id).then(function(reqs){
      if (state.proTab !== "pedidos") return; // o profissional já mudou de separador
      if (!reqs.error){ state.pendingHelp[s.id] = reqs.filter(function(r){ return r.status !== "tratado"; }).length; if (!state.pendingHelp[s.id]) delete state.pendingHelp[s.id]; updatePendingBadges(); }
      el.innerHTML = tplProPedidos(s, reqs);
      if (reqs.error){
        var retry = document.getElementById("retryHelpRequests");
        if (retry) retry.addEventListener("click", function(){ renderProTabContent(s); });
        return;
      }
      wireProPedidos(s, reqs);
    });
    return;
  }
  if (state.proTab==="perfil") el.innerHTML = tplProPerfil(s);
  else if (state.proTab==="leitura") el.innerHTML = tplProLeitura(s);
  else if (state.proTab==="plano") el.innerHTML = tplProPlano(s);
  else if (state.proTab==="treino") el.innerHTML = tplProTreino(s);
  else if (state.proTab==="evolucao"){
    el.innerHTML = tplEvolucaoAluno(s, {editable:true});
    lazyPhotos(s, function(){ if (state.proSelectedId === s.id && state.proTab === "evolucao" && !modalRoot.firstChild) renderProTabContent(s); });
  }
  else if (state.proTab==="checkins") el.innerHTML = tplProCheckins(s);
  else if (state.proTab==="sessoes"){
    if (!G.loaded){
      el.innerHTML = "<p class=\"muted-p\">A carregar…</p>";
      loadGestao().then(gestaoWithData).then(function(ok){ if (ok && state.proSelectedId === s.id && state.proTab === "sessoes") renderProTabContent(s); else if (!ok) el.innerHTML = "<p class=\"muted-p\">Não foi possível abrir os pacotes. Verifica a ligação.</p>"; });
    } else { el.innerHTML = G.tplProSessoes(s); if (G.studio.available) G.wireProSessoes(s, el); }
  }
  else if (state.proTab==="notas") el.innerHTML = tplProNotas(s);
  else el.innerHTML = tplProHistorico(s);
  wireProTab(s);
}

function fRow(label, val){ return "<div class=\"f\"><label>" + label + "</label><div class=\"v\">" + val + "</div></div>"; }

function tplNoNutritionToggle(s){
  return "<div class=\"card\" style=\"margin-bottom:12px;\"><label style=\"display:flex; align-items:flex-start; gap:8px; font-size:0.88rem; cursor:pointer;\"><input type=\"checkbox\" id=\"noNutritionToggle\" style=\"margin-top:3px;\"" + (s.noNutrition ? " checked" : "") + "> <span><strong>Não faz nutrição comigo</strong><br><span class=\"muted-p\">O aluno (e tu) deixam de ver plano alimentar, refeições, compras e PDF; ficam o treino, as avaliações e as fotos.</span></span></label></div>";
}
function tplProPerfil(s){
  // Fase 10: o perfil já não é uma lista contínua de secções — cada uma é um
  // <details> recolhível (nativo, sem JS a mais). Fase 11: todas começam
  // fechadas, incluindo "Dados pessoais" — pedido explícito para não ter
  // informação sempre à vista, igual ao resto das secções.
  var html = tplNoNutritionToggle(s) + perfilSection("Dados pessoais", false, "<div class=\"field-row\">" +
    fRow("Idade", s.age == null ? "—" : s.age + " anos") + fRow("Data de nascimento", s.birthDate ? fmtDatePt(s.birthDate) : "—") + fRow("Sexo", s.sex || "—") + fRow("Altura", s.height == null ? "—" : s.height + " cm") +
    fRow("Peso atual", s.weightCurrent == null ? "—" : s.weightCurrent + " kg") + fRow("Peso inicial", s.weightInitial == null ? "—" : s.weightInitial + " kg") +
    fRow("Objetivo", s.goal) + fRow("Treinos / semana", s.trainingsPerWeek) + fRow("Tipo de treino", s.trainingType) +
    fRow("Horário de treino", s.trainingTime) + fRow("Acorda", s.wakeTime) + fRow("Dorme", s.sleepTime) +
    fRow("Nível de atividade", s.activityLevel || "— (a usar treinos/semana como aproximação)") +
  "</div>" +
  "<div class=\"checkin-field\" style=\"margin-top:14px; max-width:220px;\"><label for=\"weightGoalInput\">Peso objetivo (kg)</label>" +
    "<input type=\"number\" step=\"0.5\" min=\"0\" id=\"weightGoalInput\" value=\"" + (s.weightGoal != null ? s.weightGoal : "") + "\" placeholder=\"Ex.: 90\"></div>" +
  "<p class=\"muted-p\" style=\"margin-top:6px;\">Ao guardar, os alvos nutricionais são recalculados com um ritmo gradual (~" + WEIGHT_GOAL_RATE_KG_PER_WEEK + " kg/semana) em vez do ajuste fixo por objetivo — revê-os depois no separador Plano.</p>" +
  "<button type=\"button\" class=\"btn primary btn-sm\" id=\"saveWeightGoal\" style=\"margin-top:8px;\">Guardar peso objetivo</button>" +
  "<div class=\"checkin-field\" style=\"margin-top:14px; max-width:260px;\"><label for=\"activityLevelInput\">Nível de atividade física fora do treino</label>" +
    "<select id=\"activityLevelInput\">" +
      "<option value=\"\"" + (!s.activityLevel ? " selected" : "") + ">— usa o nº de treinos como aproximação —</option>" +
      ACTIVITY_LEVEL_OPTIONS.map(function(o){ return "<option value=\"" + o + "\"" + (s.activityLevel===o?" selected":"") + ">" + o + " — " + ACTIVITY_LEVEL_DESCRIPTIONS[o] + "</option>"; }).join("") +
    "</select></div>" +
  "<p class=\"muted-p\" style=\"margin-top:6px;\">Usado para calcular a manutenção (separador Nutrição) e sugerir alvos — mais preciso do que só o nº de treinos.</p>" +
  "<button type=\"button\" class=\"btn primary btn-sm\" id=\"saveActivityLevel\" style=\"margin-top:8px;\">Guardar nível de atividade</button>");

  html += perfilSection("Contacto", false,
    "<div class=\"field-row\">" + fRow("Email do convite", s.inviteEmail ? escapeHtml(s.inviteEmail) : "—") + "</div>" +
    "<div class=\"checkin-field\" style=\"margin-top:10px; max-width:260px;\"><label for=\"contactPhone\">Telefone / WhatsApp</label>" +
      "<input type=\"tel\" id=\"contactPhone\" value=\"" + escapeHtml(s.phone || "") + "\" placeholder=\"912 345 678 ou +351…\" autocomplete=\"off\"></div>" +
    "<p class=\"muted-p\" id=\"contactPhoneErr\" style=\"color:var(--critical); display:none;\"></p>" +
    "<button type=\"button\" class=\"btn primary btn-sm\" id=\"saveContactPhone\" style=\"margin-top:8px;\">Guardar telefone</button>" +
    (contactEntries(s, "contacto").length ? "<div class=\"eyebrow\" style=\"margin:16px 0 6px;\">Últimos contactos</div>" + contactEntries(s, "contacto").slice(-5).reverse().map(function(e){
      return "<div class=\"history-row\"><div class=\"hlabel\">" + escapeHtml(fmtDateFullPt(e.date)) + " · " + escapeHtml(CONTACT_CHANNEL_LABELS[e.channel] || "Contacto") + "</div><div class=\"muted-p\">" + escapeHtml((CONTACT_REASONS[e.reason] || CONTACT_REASONS.generico).label) + "</div></div>"; }).join("") : ""));

  html += perfilSection("Dados médicos", false,
    "<div class=\"checkin-field\"><label for=\"medConditions\">Condições médicas / patologias</label>" +
      "<textarea id=\"medConditions\" placeholder=\"Ex.: hipertensão, diabetes tipo 2...\">" + escapeHtml(s.medicalConditions || "") + "</textarea></div>" +
    "<div class=\"checkin-field\"><label for=\"medCurrent\">Medicação atual</label>" +
      "<textarea id=\"medCurrent\" placeholder=\"Fármacos que o aluno toma regularmente (não inclui suplementos)\">" + escapeHtml(s.currentMedication || "") + "</textarea></div>" +
    "<div class=\"checkin-field\"><label for=\"medLimitations\">Lesões ou limitações físicas</label>" +
      "<textarea id=\"medLimitations\" placeholder=\"Ex.: hérnia discal, lesão no joelho...\">" + escapeHtml(s.physicalLimitations || "") + "</textarea></div>" +
    "<div class=\"checkin-field\"><label for=\"medNotes\">Observações</label>" +
      "<textarea id=\"medNotes\" placeholder=\"Qualquer outra informação relevante\">" + escapeHtml(s.medicalNotes || "") + "</textarea></div>" +
    "<button type=\"button\" class=\"btn primary btn-sm\" id=\"saveMedical\">Guardar dados médicos</button>");

  // Alinhado ao questionário real (Google Forms): horário de trabalho +
  // facilidade de fazer refeições no local de trabalho + suplementação.
  html += perfilSection("Rotina de trabalho", false, "<div class=\"field-row\">" +
    fRow("Horário de trabalho", s.work || "—") + fRow("Facilidade de refeições no trabalho", s.mealsAtWorkEase || "—") +
    fRow("Utiliza suplementos?", s.usesSupplements ? "Sim" : "Não") +
  "</div>" +
    (s.usesSupplements && s.supplements && s.supplements.length ?
      "<div style=\"margin-top:10px;\"><div class=\"muted-p\">Suplementos:</div><div class=\"tag-list\">" + s.supplements.map(function(x){return "<span class=\"tag\">"+escapeHtml(x)+"</span>";}).join("") + "</div></div>" : ""));

  html += perfilSection("Alimentação", false, "<div class=\"field-row\">" +
    fRow("Refeições exageradas / semana", s.overeatingMealsPerWeek != null ? s.overeatingMealsPerWeek : "—") +
    (s.mealsPreferred ? fRow("Nº refeições preferido", s.mealsPreferred) : "") +
    "</div>" +
    (s.dailyEatingDescription ? "<div style=\"margin-top:10px;\"><div class=\"muted-p\">Dia-a-dia alimentar:</div><p style=\"margin-top:4px; white-space:pre-wrap;\">" + escapeHtml(s.dailyEatingDescription) + "</p></div>" : "") +
    (s.hardestFoodToResist ? "<div style=\"margin-top:10px;\"><div class=\"muted-p\">Mais custa controlar/resistir:</div><p style=\"margin-top:4px; white-space:pre-wrap;\">" + escapeHtml(s.hardestFoodToResist) + "</p></div>" : "") +
    "<div style=\"margin-top:10px;\">" +
      (s.likes.length? "<div class=\"muted-p\">Gosta de:</div><div class=\"tag-list\">" + s.likes.map(function(x){return "<span class=\"tag\">"+x+"</span>";}).join("") + "</div>" : "") +
      (s.dislikes.length? "<div class=\"muted-p\" style=\"margin-top:8px;\">Não gosta:</div><div class=\"tag-list\">" + s.dislikes.map(function(x){return "<span class=\"tag\">"+x+"</span>";}).join("") + "</div>" : "") +
      (s.avoid.length? "<div class=\"muted-p\" style=\"margin-top:8px;\">Não quer consumir:</div><div class=\"tag-list\">" + s.avoid.map(function(x){return "<span class=\"tag\">"+x+"</span>";}).join("") + "</div>" : "") +
      (s.allergies.length? "<div class=\"muted-p\" style=\"margin-top:8px;\">Não consome / alérgico/a:</div><div class=\"tag-list\">" + s.allergies.map(function(x){return "<span class=\"tag\">"+escapeHtml(x)+"</span>";}).join("") + "</div>" : "") +
    "</div>");

  html += perfilSection("Hidratação", false, "<div class=\"field-row\">" +
    fRow("Água ingerida em 24h", s.waterIntake || "—") +
  "</div>");

  if (s.weekendNote && s.weekendNote !== "—"){
    html += perfilSection("Contexto", false, "<div class=\"field-row\">" +
      fRow("Fins de semana", s.weekendNote) +
    "</div>");
  }

  var flexProfile = computeFlexibilityProfile(s);
  html += perfilSection("Personalizar comportamento do plano", false,
    "<p class=\"muted-p\" style=\"margin-bottom:10px;\">Estas opções controlam o que " + escapeHtml(s.name.split(" ")[0]) + " vê e pode fazer no plano — têm sempre prioridade sobre o comportamento padrão.</p>" +
    FLEX_OVERRIDE_CHECKBOXES.map(function(pair){
      var key = pair[0], label = pair[1];
      return "<div style=\"display:flex; align-items:center; gap:8px; margin-bottom:8px;\">" +
        "<input type=\"checkbox\" id=\"ov_" + key + "\" data-key=\"" + key + "\"" + (flexProfile[key] ? " checked" : "") + ">" +
        "<label for=\"ov_" + key + "\" style=\"font-size:0.85rem;\">" + label + "</label>" +
      "</div>";
    }).join(""));

  html += "<details class=\"perfil-section\" style=\"margin-top:22px;\"><summary class=\"eyebrow\">Apagar aluno</summary><p class=\"muted-p\" style=\"margin:8px 0;\">Apaga a ficha, as fotografias e tudo o que está ligado a " + escapeHtml(s.name) + ", e o aluno deixa de ter acesso à app. Não dá para desfazer. Se só queres arrumá-lo, usa o interruptor ativo/inativo na lista de alunos.</p>" +
    "<button type=\"button\" class=\"btn btn-sm\" id=\"stuDeleteBtn\" style=\"border-color:var(--critical); color:var(--critical);\">Apagar " + escapeHtml(s.name) + "</button></details>";
  return html;
}

function perfilSection(title, openByDefault, innerHtml){
  return "<details class=\"perfil-section\"" + (openByDefault ? " open" : "") + "><summary class=\"eyebrow\">" + title + "</summary>" + innerHtml + "</details>";
}

// Fase 11: pedido do profissional — ao reajustar o plano, poder ver/copiar
// rapidamente o que o aluno respondeu no questionário inicial (não uma cópia
// automática do plano de outro aluno, que seria imprecisa).
function hasQuestionnaireAnswers(s){
  return !!(s.dailyEatingDescription || s.hardestFoodToResist || s.overeatingMealsPerWeek != null ||
    s.waterIntake || s.mealsAtWorkEase || (s.usesSupplements && s.supplements && s.supplements.length) ||
    (s.allergies && s.allergies.length));
}

function questionnaireAnswersText(s){
  var lines = ["Questionário inicial de " + s.name + ":"];
  if (s.dailyEatingDescription) lines.push("Dia-a-dia alimentar: " + s.dailyEatingDescription);
  if (s.overeatingMealsPerWeek != null) lines.push("Refeições exageradas/semana: " + s.overeatingMealsPerWeek);
  if (s.hardestFoodToResist) lines.push("Mais custa controlar/resistir: " + s.hardestFoodToResist);
  if (s.allergies && s.allergies.length) lines.push("Não consome / alérgico/a: " + s.allergies.join(", "));
  if (s.waterIntake) lines.push("Água ingerida em 24h: " + s.waterIntake);
  if (s.mealsAtWorkEase) lines.push("Facilidade de refeições no trabalho: " + s.mealsAtWorkEase);
  if (s.usesSupplements && s.supplements && s.supplements.length) lines.push("Suplementos: " + s.supplements.join(", "));
  return lines.join("\n");
}


// Texto livre do questionário (com linhas "* item") em parágrafos e listas, tudo escapado.
function bulletedText(text){
  if (!String(text || "").trim()) return "";
  var out = "", inList = false;
  String(text || "").split("\n").forEach(function(line){
    var m = line.match(/^\s*[*\-•]\s+(.*)$/);
    if (m){
      if (!inList){ out += "<ul class=\"qa-list\">"; inList = true; }
      out += "<li>" + escapeHtml(m[1]) + "</li>";
    } else {
      if (inList){ out += "</ul>"; inList = false; }
      out += line.trim() ? "<p class=\"qa-line\">" + escapeHtml(line) + "</p>" : "<div class=\"qa-gap\"></div>";
    }
  });
  if (inList) out += "</ul>";
  return out;
}

function tplQuestionnaireCopy(s){
  if (!hasQuestionnaireAnswers(s)) return "";
  // Fase 15: ao contrário das secções do Perfil (informação passiva, por
  // isso todas fechadas), este bloco é diretamente acionável mesmo quando
  // se está a montar o plano — fechado por omissão tornava-o fácil de nem
  // reparar que existia. Começa aberto.
  return "<details class=\"perfil-section\" open style=\"margin-bottom:14px;\"><summary class=\"eyebrow\">Respostas do questionário inicial</summary>" +
    "<div class=\"muted-p qa-text\" style=\"margin-top:8px;\">" + bulletedText(questionnaireAnswersText(s)) + "</div>" +
    "<div style=\"display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;\">" +
      "<button type=\"button\" class=\"btn btn-sm\" id=\"createPlanSkeleton\">Criar esqueleto de plano</button>" +
      (s.dailyEatingDescription ? "<button type=\"button\" class=\"btn btn-sm\" id=\"draftFromDailyText\">🍽️ Gerar plano a partir do dia-a-dia</button>" : "") +
    "</div>" +
    "<p class=\"muted-p\" style=\"font-size:0.78rem; margin-top:6px;\">O esqueleto cria só a estrutura (" + PLAN_SKELETON_MEALS.map(function(p){return p[0];}).join("/") + ", sem alimentos) — os alimentos ficam ao teu critério, com a resposta acima como referência." +
      (s.dailyEatingDescription ? " Já o \"Gerar plano\" tenta reconhecer alimentos da nossa base no texto do dia-a-dia — é só uma proposta para reveres, nunca aplica nada sem confirmares." : "") +
    "</p>" +
    (s.dailyEatingDescription ? "<div id=\"dailyPlanDraftResult\"></div>" : "") +
  "</details>";
}

function tplProPlano(s){
  var t = s.targets;
  var html = tplQuestionnaireCopy(s);
  if (s.fromOnboarding){
    html += "<div class=\"suggestion-banner\">🧾 Sugestão calculada a partir do questionário inicial — confirma ou ajusta antes de montares as refeições.</div>";
  }
  html += "<div class=\"eyebrow\">Alvos nutricionais</div>" +
    "<div class=\"macro-target-grid\">" +
    "<div class=\"f\"><label>Calorias <span class=\"num target-extra\" id=\"tKcalDiff\"></span></label><input type=\"number\" min=\"0\" id=\"tKcal\" value=\"" + t.kcal + "\"></div>" +
    "<div class=\"f\"><label>Proteína (g) <span class=\"num target-extra\" id=\"tProteinPct\"></span></label><input type=\"number\" min=\"0\" id=\"tProtein\" value=\"" + t.protein + "\"></div>" +
    "<div class=\"f\"><label>Hidratos (g) <span class=\"num target-extra\" id=\"tCarbsPct\"></span></label><input type=\"number\" min=\"0\" id=\"tCarbs\" value=\"" + (t.carbs!=null?t.carbs:t.carbsMax) + "\"></div>" +
    "<div class=\"f\"><label>Gordura (g) <span class=\"num target-extra\" id=\"tFatPct\"></span></label><input type=\"number\" min=\"0\" id=\"tFat\" value=\"" + (t.fat!=null?t.fat:t.fatMax) + "\"></div>" +
    "</div>" +
    "<div id=\"targetWarning\"></div>" +
    "<button type=\"button\" class=\"btn primary btn-sm\" id=\"saveTargets\" style=\"margin-top:12px;\">Guardar alvos</button>";

  html += tplPhasePanel(s);
  html += tplCreatineCard(s);

  html += "<details class=\"perfil-section\" style=\"margin-top:14px;\"><summary class=\"eyebrow\">Colar um plano em texto</summary>" +
    "<p class=\"muted-p\" style=\"margin:8px 0;\">Cola o plano alimentar (por exemplo \"Refeição 1 (pequeno-almoço)\" seguido dos alimentos, com \"OU\" nas alternativas). Reconheço as refeições e os alimentos da nossa base e mostro uma proposta para reveres antes de aplicar.</p>" +
    "<div class=\"checkin-field\"><textarea id=\"pastedPlanText\" rows=\"8\" placeholder=\"Refeição 1 (pequeno-almoço)&#10;1 fatia de pão integral&#10;50g queijo fresco magro\"></textarea></div>" +
    "<label class=\"check-line\" style=\"display:flex; gap:8px; align-items:center; margin:8px 0; font-size:0.85rem;\"><input type=\"checkbox\" id=\"pastedReplace\" checked> Substituir o plano atual (apaga as refeições existentes)</label>" +
    "<label class=\"check-line\" style=\"display:flex; gap:8px; align-items:center; margin:8px 0; font-size:0.85rem;\"><input type=\"checkbox\" id=\"pastedTargets\" checked> Definir os alvos (kcal e macros) a partir deste plano</label>" +
    "<button type=\"button\" class=\"btn btn-sm\" id=\"draftFromPastedPlan\">🍽️ Gerar proposta</button>" +
    "<div id=\"pastedPlanResult\"></div>" +
  "</details>";

  html += tplTemplatesBar("nutricao");
  sortMealsByTime(s);
  html += "<div class=\"section-gap eyebrow\" style=\"margin-bottom:4px;\">Refeições do plano</div>" +
    "<p class=\"muted-p\" style=\"margin-bottom:10px;\">Nível " + TIER_LABEL[flexTier(s.flexibility)] + " — o aluno vê: " + TIER_HINT[flexTier(s.flexibility)].toLowerCase() + ". As refeições ordenam-se sempre pelo horário.</p>";
  if (!s.meals.length){
    html += "<p class=\"muted-p\">Ainda sem refeições definidas — confirma os alvos acima e começa a montar o plano deste aluno.</p>";
  }
  var mealsSum = 0;
  s.meals.forEach(function(m, midx){
    var totals = foodsTotals(m.foods);
    mealsSum += totals.kcal;
    html += tplPlanoMealEditor(m, midx);
  });
  if (s.meals.length){
    var mealsDiffPct = t.kcal ? Math.abs(mealsSum - t.kcal)/t.kcal : 0;
    html += "<p class=\"muted-p\" style=\"margin-top:4px;\">Soma das refeições: <span class=\"num\">" + mealsSum + " kcal</span>" +
      (mealsDiffPct > 0.05 ? " <span class=\"pill warn\">⚠ " + Math.round(mealsDiffPct*100) + "% de diferença face ao alvo</span>" : " ✓ coerente com o alvo") +
    "</p>";
  }
  html += "<button type=\"button\" class=\"btn primary btn-sm\" id=\"addMealBtn\" style=\"width:100%; margin-top:10px;\">+ Adicionar refeição</button>";
  if (s.meals.length){
    html += "<button type=\"button\" class=\"btn btn-sm\" id=\"proExportPdf\" style=\"width:100%; margin-top:8px;\">⬇ Exportar o plano em PDF (como o aluno o vê)</button>" +
      "<button type=\"button\" class=\"btn btn-sm\" id=\"autoAdjustBtn\" style=\"width:100%; margin-top:8px;\">⚖️ Ajustar quantidades aos alvos</button>" +
      "<p class=\"muted-p\" style=\"font-size:0.78rem; margin-top:6px;\">Reescala as quantidades de todos os alimentos (mantendo as proporções entre eles) para a soma do dia bater certo com os alvos acima — inclui vegetais e fruta, só não mexe em alimentos marcados como \"à vontade\".</p>";
  }
  return html;
}

function tplPlanoMealEditor(m, midx){
  var totals = foodsTotals(m.foods);
  // Fase 18: cartão próprio por refeição (fundo/contorno, como o resto da
  // app), em vez de só uma linha fina a separar — pedido explícito: com
  // várias refeições, era difícil perceber onde uma acaba e a outra
  // começa. O horário e as macros no topo/fundo do cartão ajudam a
  // identificar cada refeição sem teres de abrir nada.
  var html = "<div class=\"plano-meal-card card\" style=\"margin-bottom:14px;\">" +
    "<div class=\"onb-row\" style=\"align-items:end; margin-bottom:8px;\">" +
      "<div class=\"onb-field\" style=\"margin-bottom:0;\"><label>Nome da refeição</label>" +
        "<select class=\"pm-name\" data-midx=\"" + midx + "\">" +
          PLAN_SKELETON_MEALS.map(function(pair){
            return "<option" + (m.name === pair[0] ? " selected" : "") + ">" + escapeHtml(pair[0]) + "</option>";
          }).join("") +
          (PLAN_SKELETON_MEALS.some(function(pair){ return pair[0] === m.name; }) ? "" :
            "<option selected>" + escapeHtml(m.name) + "</option>") +
        "</select></div>" +
      "<div class=\"onb-field\" style=\"margin-bottom:0;\"><label>Horário</label>" +
        "<input type=\"time\" class=\"pm-time\" data-midx=\"" + midx + "\" value=\"" + escapeHtml(m.time) + "\"></div>" +
    "</div>" +
    "<button type=\"button\" class=\"btn btn-sm\" data-del-meal=\"" + midx + "\" style=\"margin-bottom:10px;\">🗑 Remover refeição</button>";

  if (!m.foods.length){
    html += "<p class=\"muted-p\" style=\"margin-bottom:8px;\">Ainda sem alimentos nesta refeição.</p>";
  }
  // Fase 21: antes só dava para apagar um alimento e voltar a acrescentar do
  // zero — pedido explícito para dar para trocar o alimento ou ajustar a
  // quantidade sem esse rodeio. O formulário de edição fica sempre no DOM
  // (escondido com .hidden), tal como o "+ Adicionar alimento" da Fase 18,
  // para reaproveitar a mesma pesquisa/wiring sem duplicar lógica.
  html += m.foods.map(function(f, fidx){
    return "<div class=\"food-item\" style=\"cursor:default;\">" +
      "<span class=\"fname\">" + escapeHtml(f.name) + (f.group ? " <span class=\"muted-p\" style=\"font-size:0.72rem;\">(" + escapeHtml(groupLabel(f.group)) + ")</span>" : "") + packWasteHint(f) + "</span>" +
      "<span><span class=\"fqty\">" + escapeHtml(f.qty) + "</span>" +
        "<button type=\"button\" class=\"assess-del\" data-suggest-food=\"" + midx + "\" data-fidx=\"" + fidx + "\" style=\"margin-left:8px;\" aria-label=\"Sugerir alternativas\" title=\"Sugerir alternativas\">🔄</button>" +
        "<button type=\"button\" class=\"assess-del\" data-edit-food=\"" + midx + "\" data-fidx=\"" + fidx + "\" style=\"margin-left:4px;\" aria-label=\"Editar alimento\">✏️</button>" +
        "<button type=\"button\" class=\"assess-del\" data-del-food=\"" + midx + "\" data-fidx=\"" + fidx + "\" style=\"margin-left:4px;\" aria-label=\"Remover alimento\">✕</button>" +
      "</span>" +
    "</div>" + tplEditFoodForm(midx, fidx, f);
  }).join("");

  // Fase 18: o formulário de adicionar alimento passa a recolhível — antes
  // ficava sempre aberto em todas as refeições ao mesmo tempo (com 5-6
  // refeições, isso empilhava 5-6 formulários completos, a maior parte
  // inativos). <details> mantém o conteúdo no DOM mesmo fechado, por isso
  // toda a lógica de pesquisa/wiring existente continua a funcionar sem
  // alterações.
  html += "<details class=\"add-food-details\"><summary class=\"btn btn-sm\">+ Adicionar alimento</summary>" + tplAddFoodForm(midx) + "</details>";
  html += "<div class=\"plano-meal-macros\" style=\"margin-top:10px;\">" + totals.kcal + " kcal · P " + totals.p + "g · H " + totals.c + "g · G " + totals.f + "g</div>";
  html += "</div>";
  return html;
}

var PRO_PLAN_GROUPS = ["cereais","laticinios","carnes","fruta","vegetais","gorduras","bebidas","snacks"];

// Fase 17: leitura de tabela nutricional por OCR (Tesseract.js, corre no
// próprio browser — sem servidor, sem API paga, sem chave para esconder).
// Carregado só quando é mesmo preciso (primeiro uso), não no arranque.
var tesseractLoadPromise = null;
function loadTesseractScript(){
  if (window.Tesseract) return Promise.resolve();
  if (tesseractLoadPromise) return tesseractLoadPromise;
  tesseractLoadPromise = new Promise(function(resolve, reject){
    var script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.onload = function(){ resolve(); };
    script.onerror = function(){ tesseractLoadPromise = null; reject(new Error("Falha ao carregar o leitor de imagem")); };
    document.head.appendChild(script);
  });
  return tesseractLoadPromise;
}

// Tenta extrair kcal/proteína/hidratos/gordura do texto lido por OCR de uma
// tabela nutricional europeia. Nunca 100% fiável (por isso o ecrã seguinte
// é sempre de revisão, nunca grava automaticamente) — procura o primeiro
// número a seguir a cada rótulo, o que corresponde à linha principal
// ("Lípidos", não "dos quais saturados", que só aparece depois no texto).
function parseNutritionLabelText(text){
  text = (text || "").replace(/,(\d)/g, ".$1");
  function findNum(regex){
    var m = text.match(regex);
    return m ? parseFloat(m[1]) : null;
  }
  return {
    kcal: findNum(/(\d+(?:\.\d+)?)\s*kcal/i),
    protein: findNum(/prote[íi]nas?\D{0,15}?(\d+(?:\.\d+)?)/i),
    carbs: findNum(/hidratos\s*(?:de\s*carbono)?\D{0,15}?(\d+(?:\.\d+)?)/i),
    fat: findNum(/(?:l[íi]pidos|gorduras?)\D{0,15}?(\d+(?:\.\d+)?)/i)
  };
}

var CUSTOM_FOOD_GROUP_LABELS = GROUP_LABELS;

// Modal de acrescentar um alimento personalizado. Guarda em custom_foods
// (fica disponível para todos os alunos seguintes, não só este) e funde no
// FOOD_DB/FOOD_GROUPS em memória de imediato, para poder ser usado já
// nesta refeição. onSaved(name) é chamado com o nome guardado.
function openCustomFoodModal(defaultGroup, onSaved){
  var sheet = openModal(
    "<div class=\"mtitle\">Acrescentar alimento</div>" +
    "<p class=\"muted-p\" style=\"margin:4px 0 10px;\">Carrega uma foto da tabela nutricional do rótulo — a leitura é automática, mas revês sempre os valores antes de guardar.</p>" +
    "<label class=\"btn-file\" style=\"display:block; text-align:center; margin-bottom:6px;\">📷 Carregar foto do rótulo<input type=\"file\" accept=\"image/*\" capture=\"environment\" id=\"cfPhoto\" style=\"display:none;\"></label>" +
    "<button type=\"button\" class=\"btn btn-sm\" id=\"cfManual\" style=\"width:100%; margin-bottom:8px;\">Preencher manualmente, sem foto</button>" +
    "<p id=\"cfStatus\" class=\"muted-p\"></p>" +
    "<div id=\"cfForm\" style=\"display:none;\">" +
      "<div class=\"checkin-field\"><label for=\"cfName\">Nome do alimento</label><input type=\"text\" id=\"cfName\" placeholder=\"Ex.: Barra de proteína XYZ\"></div>" +
      "<div class=\"checkin-field\"><label for=\"cfGroup\">Grupo</label><select id=\"cfGroup\">" +
        Object.keys(CUSTOM_FOOD_GROUP_LABELS).map(function(g){ return "<option value=\"" + g + "\"" + (g===defaultGroup?" selected":"") + ">" + CUSTOM_FOOD_GROUP_LABELS[g] + "</option>"; }).join("") +
      "</select></div>" +
      "<p class=\"muted-p\" style=\"margin:10px 0 6px;\">Valores por 100g — confirma que correspondem à coluna certa do rótulo:</p>" +
      "<div class=\"field-row\">" +
        "<div class=\"f\"><label>Calorias (kcal)</label><input type=\"number\" id=\"cfKcal\" min=\"0\"></div>" +
        "<div class=\"f\"><label>Proteína (g)</label><input type=\"number\" id=\"cfProtein\" min=\"0\" step=\"0.1\"></div>" +
        "<div class=\"f\"><label>Hidratos (g)</label><input type=\"number\" id=\"cfCarbs\" min=\"0\" step=\"0.1\"></div>" +
        "<div class=\"f\"><label>Gordura (g)</label><input type=\"number\" id=\"cfFat\" min=\"0\" step=\"0.1\"></div>" +
      "</div>" +
      "<p class=\"muted-p\" id=\"cfError\" style=\"color:var(--critical); display:none; margin:8px 0;\"></p>" +
      "<button type=\"button\" class=\"btn primary\" id=\"cfSave\" style=\"width:100%; margin-top:10px;\">Guardar alimento</button>" +
    "</div>"
  );

  function showForm(){ sheet.querySelector("#cfForm").style.display = "block"; }

  sheet.querySelector("#cfManual").addEventListener("click", function(){
    sheet.querySelector("#cfStatus").textContent = "";
    showForm();
  });

  sheet.querySelector("#cfPhoto").addEventListener("change", function(e){
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var statusEl = sheet.querySelector("#cfStatus");
    statusEl.textContent = "A carregar leitor de imagem...";
    loadTesseractScript().then(function(){
      statusEl.textContent = "A ler a foto — pode demorar alguns segundos...";
      return Tesseract.recognize(file, "por");
    }).then(function(result){
      var parsed = parseNutritionLabelText(result.data.text);
      statusEl.textContent = "Confirma e corrige os valores abaixo — a leitura automática nem sempre acerta tudo.";
      showForm();
      if (parsed.kcal != null) sheet.querySelector("#cfKcal").value = parsed.kcal;
      if (parsed.protein != null) sheet.querySelector("#cfProtein").value = parsed.protein;
      if (parsed.carbs != null) sheet.querySelector("#cfCarbs").value = parsed.carbs;
      if (parsed.fat != null) sheet.querySelector("#cfFat").value = parsed.fat;
    }).catch(function(){
      statusEl.textContent = "⚠ Não foi possível ler a foto — preenche os valores manualmente.";
      showForm();
    });
  });

  sheet.querySelector("#cfSave").addEventListener("click", function(){
    var name = sheet.querySelector("#cfName").value.trim();
    var group = sheet.querySelector("#cfGroup").value;
    var kcal = parseFloat(sheet.querySelector("#cfKcal").value);
    var protein = parseFloat(sheet.querySelector("#cfProtein").value);
    var carbs = parseFloat(sheet.querySelector("#cfCarbs").value);
    var fat = parseFloat(sheet.querySelector("#cfFat").value);
    var errEl = sheet.querySelector("#cfError");
    errEl.style.display = "none";
    if (!name){ errEl.textContent = "Escreve o nome do alimento."; errEl.style.display = "block"; return; }
    if (FOOD_DB[name]){ errEl.textContent = "Já existe um alimento com este nome — escolhe outro nome."; errEl.style.display = "block"; return; }
    if (!(kcal >= 0) || !(protein >= 0) || !(carbs >= 0) || !(fat >= 0)){ errEl.textContent = "Preenche todos os valores (podem ser 0, nunca negativos)."; errEl.style.display = "block"; return; }
    var row = {name: name, kcal: Math.round(kcal), protein: protein, carbs: carbs, fat: fat, food_group: group};
    if (sbReady){
      sb.from("custom_foods").insert(row).select().then(function(res){
        if (res.error){ errEl.textContent = "⚠ Não foi possível guardar — tenta novamente."; errEl.style.display = "block"; return; }
        mergeCustomFood((res.data && res.data[0]) || row);
        showToast("✓ Alimento guardado — já disponível para todos os alunos");
        closeModal();
        onSaved(name);
      }).catch(function(){ errEl.textContent = "⚠ Não foi possível guardar — tenta novamente."; errEl.style.display = "block"; });
    } else {
      mergeCustomFood(row);
      showToast("✓ Alimento guardado (modo local)");
      closeModal();
      onSaved(name);
    }
  });

  return sheet;
}

/* ==================== Fase 34: Catálogo de alimentos (área do profissional) ====================
   Área própria (ver renderProShell/state.proView), independente da página
   principal do dashboard. Gere food_products/food_product_retailers
   diretamente no Supabase — os dados só chegam a FOOD_DB (e por isso à
   pesquisa de alimentos de um plano) depois de "verified", via
   loadFoodProducts() no arranque (ver mais acima). */
var RETAILERS = ["Continente","Pingo Doce","Mercadona","Auchan","Lidl"];
var VERIFICATION_STATUS_LABELS = {pending:"Pendente", verified:"Verificado", rejected:"Rejeitado"};
var SOURCE_TYPE_LABELS = {official:"Página oficial", label:"Rótulo físico", open_food_facts:"Open Food Facts", legacy_phase30:"Migrado do código (sem fonte individual)"};

function renderProCatalogMain(){
  var main = document.getElementById("proMain");
  if (!state.catalogFilters) state.catalogFilters = {q:"", retailer:"", group:"", status:""};
  if (!state.catalogSelected) state.catalogSelected = {};
  var f = state.catalogFilters;

  main.innerHTML =
    "<div style=\"display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;\">" +
      "<h2 style=\"margin:0;\">Catálogo de alimentos</h2>" +
      "<button type=\"button\" class=\"btn primary btn-sm\" id=\"catalogNewProduct\">+ Novo produto</button>" +
    "</div>" +
    "<div class=\"card\" style=\"margin-bottom:14px;\">" +
      "<div class=\"field-row\">" +
        "<div class=\"f\"><label>Pesquisar (nome, marca ou EAN)</label><input type=\"text\" id=\"catalogSearch\" value=\"" + escapeHtml(f.q) + "\"></div>" +
        "<div class=\"f\"><label>Retalhista</label><select id=\"catalogRetailerFilter\"><option value=\"\">Todos</option>" +
          RETAILERS.map(function(r){ return "<option value=\"" + r + "\"" + (f.retailer===r?" selected":"") + ">" + r + "</option>"; }).join("") +
        "</select></div>" +
        "<div class=\"f\"><label>Grupo</label><select id=\"catalogGroupFilter\"><option value=\"\">Todos</option>" +
          PRO_PLAN_GROUPS.map(function(g){ return "<option value=\"" + g + "\"" + (f.group===g?" selected":"") + ">" + groupLabel(g) + "</option>"; }).join("") +
        "</select></div>" +
        "<div class=\"f\"><label>Estado</label><select id=\"catalogStatusFilter\"><option value=\"\">Ativos (sem rejeitados)</option>" +
          Object.keys(VERIFICATION_STATUS_LABELS).map(function(st){ return "<option value=\"" + st + "\"" + (f.status===st?" selected":"") + ">" + VERIFICATION_STATUS_LABELS[st] + "</option>"; }).join("") +
          "<option value=\"todos\"" + (f.status==="todos"?" selected":"") + ">Todos, incluindo rejeitados</option>" +
        "</select></div>" +
      "</div>" +
    "</div>" +
    "<div id=\"catalogBulkBar\" style=\"display:none; align-items:center; gap:10px; margin-bottom:10px;\">" +
      "<label style=\"display:flex; align-items:center; gap:6px; cursor:pointer;\"><input type=\"checkbox\" id=\"catalogSelectAll\"> Selecionar todos os pendentes visíveis</label>" +
      "<span id=\"catalogSelectedCount\" class=\"muted-p\"></span>" +
      "<button type=\"button\" class=\"btn btn-sm\" id=\"catalogApproveSelected\">✓ Aprovar selecionados</button>" +
    "</div>" +
    "<div id=\"catalogList\"><p class=\"muted-p\">A carregar...</p></div>";

  state.catalogLimit = CATALOG_PAGE;
  wireProCatalog(main);
  if (state.catalogProducts && state.catalogProducts.length) renderCatalogList(main); // já carregado antes: mostra de imediato e atualiza por baixo
  loadCatalogProducts(main);
}

function loadCatalogProducts(main){
  if (!sbReady){
    main.querySelector("#catalogList").innerHTML = "<p class=\"muted-p\">Sem ligação à base de dados.</p>";
    return;
  }
  fetchAllFoodProductPages(function(){ return sb.from("food_products").select("*, food_product_retailers(*)").order("id"); }).then(function(res){
    if (res.error){ main.querySelector("#catalogList").innerHTML = "<p class=\"muted-p\">⚠ Não foi possível carregar o catálogo.</p>"; return; }
    var cmp = FOOD_COLLATOR ? FOOD_COLLATOR.compare : function(a, b){ return a.localeCompare(b, "pt"); };
    state.catalogProducts = (res.data || []).slice().sort(function(a, b){ return cmp(a.name, b.name); });
    state.catalogProducts.forEach(function(p){ p._k = catalogSearchKey(p); }); // chave de pesquisa calculada uma vez
    renderCatalogList(main);
  }).catch(function(){ main.querySelector("#catalogList").innerHTML = "<p class=\"muted-p\">⚠ Não foi possível carregar o catálogo.</p>"; });
}

function catalogFilteredProducts(){
  var f = state.catalogFilters || {};
  var q = (f.q || "").trim().toLowerCase();
  return (state.catalogProducts || []).filter(function(p){
    if (q && (p._k || (p.name + "\n" + p.brand + "\n" + (p.ean || "")).toLowerCase()).indexOf(q) === -1) return false;
    if (f.group && p.food_group !== f.group) return false;
    // por omissão os rejeitados (ex.: repetidos limpos) ficam escondidos; aparecem em "Rejeitado" ou "Todos, incluindo rejeitados"
    if (!f.status && p.verification_status === "rejected") return false;
    if (f.status && f.status !== "todos" && p.verification_status !== f.status) return false;
    if (f.retailer && !(p.food_product_retailers || []).some(function(r){ return r.retailer === f.retailer; })) return false;
    return true;
  });
}

function catalogStatusColor(status){
  if (status === "verified") return "var(--accent-strong)";
  if (status === "rejected") return "var(--critical)";
  return "var(--warn)";
}

function renderCatalogList(main){
  var listEl = main.querySelector("#catalogList");
  var items = catalogFilteredProducts();
  var bulkBar = main.querySelector("#catalogBulkBar");
  var pendingInView = items.filter(function(p){ return p.verification_status === "pending"; });
  if (!pendingInView.length){
    bulkBar.style.display = "none";
  } else {
    bulkBar.style.display = "flex";
    main.querySelector("#catalogSelectAll").checked = pendingInView.every(function(p){ return !!state.catalogSelected[p.id]; });
    var selectedCount = Object.keys(state.catalogSelected).filter(function(id){ return state.catalogSelected[id]; }).length;
    main.querySelector("#catalogSelectedCount").textContent = selectedCount ? (selectedCount + " selecionado" + (selectedCount > 1 ? "s" : "")) : "";
  }
  var catQ = ((state.catalogFilters || {}).q || "").trim();
  function offIntoCatalog(){ offAutoSearch(listEl, catQ, items.length, function(){ renderCatalogList(main); }); }
  if (!items.length){ listEl.innerHTML = "<p class=\"muted-p\">Sem produtos com estes filtros.</p>"; offIntoCatalog(); return; }
  // o catálogo tem milhares de produtos: desenhar todos de uma vez bloqueava a app (e a cada letra da pesquisa); mostram-se 40 de cada vez
  var limit = state.catalogLimit || CATALOG_PAGE;
  var shown = items.slice(0, limit);
  listEl.innerHTML = "<p class=\"muted-p\" style=\"margin-bottom:8px;\">" + items.length + (items.length === 1 ? " produto" : " produtos") + "</p>" + shown.map(function(p){
    var retailers = (p.food_product_retailers || []).map(function(r){ return r.retailer; }).join(", ");
    return "<div class=\"card\" style=\"margin-bottom:8px; display:flex; align-items:flex-start; gap:10px;\">" +
      (p.verification_status === "pending" ? "<input type=\"checkbox\" class=\"catalog-select\" data-id=\"" + p.id + "\"" + (state.catalogSelected[p.id] ? " checked" : "") + " style=\"margin-top:4px;\">" : "<span style=\"width:16px; display:inline-block;\"></span>") +
      "<div style=\"flex:1; min-width:0;\">" +
        "<div><strong>" + escapeHtml(p.name) + "</strong> <span class=\"muted-p\">(" + escapeHtml(p.brand) + ")</span> " +
          "<span class=\"tag\" style=\"border-color:" + catalogStatusColor(p.verification_status) + "; color:" + catalogStatusColor(p.verification_status) + ";\">" + (VERIFICATION_STATUS_LABELS[p.verification_status] || p.verification_status) + "</span></div>" +
        "<div class=\"muted-p\" style=\"font-size:0.78rem; margin-top:2px;\">" + groupLabel(p.food_group) + (p.ean ? " · EAN " + escapeHtml(p.ean) : "") + (retailers ? " · " + escapeHtml(retailers) : "") + "</div>" +
        "<div class=\"muted-p\" style=\"font-size:0.78rem;\">" + p.kcal + " kcal · P " + p.protein + "g · H " + p.carbs + "g · G " + p.fat + "g (por " + (p.nutrition_basis || "100g") + ") · fonte: " + (SOURCE_TYPE_LABELS[p.source_type] || p.source_type) + (p.source_url ? "" : " (sem link)") + "</div>" +
        (p.internal_note ? "<div class=\"muted-p\" style=\"font-size:0.72rem; font-style:italic;\">" + escapeHtml(p.internal_note) + "</div>" : "") +
      "</div>" +
      "<div style=\"display:flex; flex-direction:column; gap:4px; flex-shrink:0;\">" +
        "<button type=\"button\" class=\"btn btn-sm\" data-catalog-edit=\"" + p.id + "\">Editar</button>" +
        (p.verification_status !== "verified" ? "<button type=\"button\" class=\"btn btn-sm\" data-catalog-approve=\"" + p.id + "\">Aprovar</button>" : "") +
        (p.verification_status !== "rejected" ? "<button type=\"button\" class=\"btn btn-sm\" data-catalog-reject=\"" + p.id + "\">Rejeitar</button>" : "") +
      "</div>" +
    "</div>";
  }).join("") + (items.length > shown.length ? "<button type=\"button\" class=\"btn\" id=\"catalogMore\" style=\"width:100%; min-height:48px;\">Mostrar mais (" + (items.length - shown.length) + " por mostrar)</button>" : "");
  var more = listEl.querySelector("#catalogMore");
  if (more) more.addEventListener("click", function(){ state.catalogLimit = limit + CATALOG_PAGE; renderCatalogList(main); });
  wireCatalogListActions(main);
  offIntoCatalog();
}
var CATALOG_PAGE = 40;

function catalogUpdateProductStatus(main, id, status){
  if (!sbReady) return;
  sb.from("food_products").update({verification_status: status, verified_at: status === "verified" ? new Date().toISOString() : null}).eq("id", id).then(function(res){
    if (res.error){ showToast("⚠ Não foi possível atualizar — tenta novamente"); return; }
    var p = (state.catalogProducts || []).find(function(x){ return x.id === id; });
    if (p) p.verification_status = status;
    delete state.catalogSelected[id];
    showToast(status === "verified" ? "✓ Produto aprovado" : "Produto rejeitado");
    renderCatalogList(main);
  }).catch(function(){ showToast("⚠ Não foi possível atualizar — tenta novamente"); });
}

function wireCatalogListActions(main){
  main.querySelectorAll("[data-catalog-approve]").forEach(function(btn){
    btn.addEventListener("click", function(){ catalogUpdateProductStatus(main, btn.getAttribute("data-catalog-approve"), "verified"); });
  });
  main.querySelectorAll("[data-catalog-reject]").forEach(function(btn){
    btn.addEventListener("click", function(){ catalogUpdateProductStatus(main, btn.getAttribute("data-catalog-reject"), "rejected"); });
  });
  main.querySelectorAll("[data-catalog-edit]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var id = btn.getAttribute("data-catalog-edit");
      var p = (state.catalogProducts || []).find(function(x){ return x.id === id; });
      if (p) openFoodProductModal(p, function(){ renderCatalogList(main); });
    });
  });
  main.querySelectorAll(".catalog-select").forEach(function(cb){
    cb.addEventListener("change", function(){
      state.catalogSelected[cb.getAttribute("data-id")] = cb.checked;
      main.querySelector("#catalogSelectAll").checked = catalogFilteredProducts().filter(function(p){ return p.verification_status === "pending"; }).every(function(p){ return !!state.catalogSelected[p.id]; });
      var selectedCount = Object.keys(state.catalogSelected).filter(function(id){ return state.catalogSelected[id]; }).length;
      main.querySelector("#catalogSelectedCount").textContent = selectedCount ? (selectedCount + " selecionado" + (selectedCount > 1 ? "s" : "")) : "";
    });
  });
}

function wireProCatalog(main){
  main.querySelector("#catalogNewProduct").addEventListener("click", function(){
    openFoodProductModal(null, function(){ renderCatalogList(main); });
  });
  var searchTimer = null;
  main.querySelector("#catalogSearch").addEventListener("input", function(){
    var el = this;
    state.catalogFilters.q = el.value;
    state.catalogLimit = CATALOG_PAGE;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function(){ renderCatalogList(main); }, 250); // só pesquisa quando paras de escrever
  });
  main.querySelector("#catalogRetailerFilter").addEventListener("change", function(){
    state.catalogFilters.retailer = this.value;
    state.catalogLimit = CATALOG_PAGE;
    renderCatalogList(main);
  });
  main.querySelector("#catalogGroupFilter").addEventListener("change", function(){
    state.catalogFilters.group = this.value;
    state.catalogLimit = CATALOG_PAGE;
    renderCatalogList(main);
  });
  main.querySelector("#catalogStatusFilter").addEventListener("change", function(){
    state.catalogFilters.status = this.value;
    state.catalogLimit = CATALOG_PAGE;
    renderCatalogList(main);
  });
  main.querySelector("#catalogSelectAll").addEventListener("change", function(){
    var checked = this.checked;
    catalogFilteredProducts().forEach(function(p){
      if (p.verification_status === "pending") state.catalogSelected[p.id] = checked;
    });
    renderCatalogList(main);
  });
  main.querySelector("#catalogApproveSelected").addEventListener("click", function(){
    var ids = Object.keys(state.catalogSelected).filter(function(id){ return state.catalogSelected[id]; });
    if (!ids.length || !sbReady) return;
    sb.from("food_products").update({verification_status:"verified", verified_at: new Date().toISOString()}).in("id", ids).then(function(res){
      if (res.error){ showToast("⚠ Não foi possível aprovar — tenta novamente"); return; }
      ids.forEach(function(id){
        var p = (state.catalogProducts || []).find(function(x){ return x.id === id; });
        if (p) p.verification_status = "verified";
        delete state.catalogSelected[id];
      });
      showToast("✓ " + ids.length + " produto(s) aprovado(s)");
      renderCatalogList(main);
    }).catch(function(){ showToast("⚠ Não foi possível aprovar — tenta novamente"); });
  });
}

// Cria ou edita um produto do catálogo (product === null -> criar). Guarda
// primeiro em food_products, depois substitui por completo as linhas de
// food_product_retailers desse produto pelas marcadas no formulário — mais
// simples do que calcular a diferença, e a tabela é sempre pequena por
// produto (no máximo 5 retalhistas).
function tplCatalogProductForm(product){
  var p = product || {};
  var currentRetailers = (p.food_product_retailers || []).map(function(r){ return r.retailer; });
  return (
    "<div class=\"mtitle\">" + (product ? "Editar produto" : "Novo produto") + "</div>" +
    "<div class=\"field-row\">" +
      "<div class=\"f\"><label>EAN (código de barras)</label><input type=\"text\" id=\"fpEan\" value=\"" + escapeHtml(p.ean || "") + "\"></div>" +
      "<div class=\"f\"><label>Nome comercial</label><input type=\"text\" id=\"fpName\" value=\"" + escapeHtml(p.name || "") + "\"></div>" +
      "<div class=\"f\"><label>Marca</label><input type=\"text\" id=\"fpBrand\" value=\"" + escapeHtml(p.brand || "") + "\"></div>" +
      "<div class=\"f\"><label>Grupo</label><select id=\"fpGroup\">" +
        PRO_PLAN_GROUPS.map(function(g){ return "<option value=\"" + g + "\"" + (p.food_group===g?" selected":"") + ">" + groupLabel(g) + "</option>"; }).join("") +
      "</select></div>" +
      "<div class=\"f\"><label>Tamanho de uma embalagem individual</label><input type=\"number\" id=\"fpPackageQty\" min=\"0\" step=\"0.1\" value=\"" + (p.package_quantity != null ? p.package_quantity : "") + "\"></div>" +
      "<div class=\"f\"><label>Unidade da embalagem</label><input type=\"text\" id=\"fpPackageUnit\" placeholder=\"g, ml, unid.\" value=\"" + escapeHtml(p.package_unit || "") + "\"></div>" +
      "<p class=\"muted-p\" style=\"grid-column:1/-1; margin:0;\">Num pack de várias unidades fechadas uma a uma (ex.: 4 × 125 g) indica o tamanho de UMA unidade (125 g). Em iogurtes, queijo, fiambre, leite e semelhantes, a app usa-o para o plano levar embalagens inteiras e não deixar sobras.</p>" +
      "<div class=\"f\"><label>Valores por</label><select id=\"fpBasis\">" +
        "<option value=\"100g\"" + (p.nutrition_basis!=="100ml"?" selected":"") + ">100 g</option>" +
        "<option value=\"100ml\"" + (p.nutrition_basis==="100ml"?" selected":"") + ">100 ml</option>" +
      "</select></div>" +
      "<div class=\"f\"><label>Calorias (kcal)</label><input type=\"number\" id=\"fpKcal\" min=\"0\" value=\"" + (p.kcal != null ? p.kcal : "") + "\"></div>" +
      "<div class=\"f\"><label>Proteína (g)</label><input type=\"number\" id=\"fpProtein\" min=\"0\" step=\"0.1\" value=\"" + (p.protein != null ? p.protein : "") + "\"></div>" +
      "<div class=\"f\"><label>Hidratos (g)</label><input type=\"number\" id=\"fpCarbs\" min=\"0\" step=\"0.1\" value=\"" + (p.carbs != null ? p.carbs : "") + "\"></div>" +
      "<div class=\"f\"><label>Gordura (g)</label><input type=\"number\" id=\"fpFat\" min=\"0\" step=\"0.1\" value=\"" + (p.fat != null ? p.fat : "") + "\"></div>" +
      "<div class=\"f\"><label>Açúcares (g)</label><input type=\"number\" id=\"fpSugars\" min=\"0\" step=\"0.1\" value=\"" + (p.sugars != null ? p.sugars : "") + "\"></div>" +
      "<div class=\"f\"><label>Fibra (g)</label><input type=\"number\" id=\"fpFiber\" min=\"0\" step=\"0.1\" value=\"" + (p.fiber != null ? p.fiber : "") + "\"></div>" +
      "<div class=\"f\"><label>Gordura saturada (g)</label><input type=\"number\" id=\"fpSatFat\" min=\"0\" step=\"0.1\" value=\"" + (p.saturated_fat != null ? p.saturated_fat : "") + "\"></div>" +
      "<div class=\"f\"><label>Sal (g)</label><input type=\"number\" id=\"fpSalt\" min=\"0\" step=\"0.1\" value=\"" + (p.salt != null ? p.salt : "") + "\"></div>" +
    "</div>" +
    "<div class=\"checkin-field\"><label for=\"fpIngredients\">Ingredientes</label><textarea id=\"fpIngredients\" rows=\"2\">" + escapeHtml(p.ingredients || "") + "</textarea></div>" +
    "<div class=\"checkin-field\"><label for=\"fpAllergens\">Alergénios</label><input type=\"text\" id=\"fpAllergens\" value=\"" + escapeHtml(p.allergens || "") + "\"></div>" +
    "<div class=\"checkin-field\"><label>Disponível em</label><div style=\"display:flex; flex-wrap:wrap; gap:10px;\">" +
      RETAILERS.map(function(r){ return "<label style=\"display:flex; align-items:center; gap:4px; font-size:0.85rem; white-space:nowrap;\"><input type=\"checkbox\" class=\"fp-retailer\" value=\"" + r + "\"" + (currentRetailers.indexOf(r) >= 0 ? " checked" : "") + ">" + r + "</label>"; }).join("") +
    "</div></div>" +
    "<div class=\"field-row\">" +
      "<div class=\"f\"><label>Fonte</label><select id=\"fpSourceType\">" +
        Object.keys(SOURCE_TYPE_LABELS).map(function(k){ return "<option value=\"" + k + "\"" + (p.source_type===k?" selected":"") + ">" + SOURCE_TYPE_LABELS[k] + "</option>"; }).join("") +
      "</select></div>" +
      "<div class=\"f\"><label>Estado</label><select id=\"fpStatus\">" +
        Object.keys(VERIFICATION_STATUS_LABELS).map(function(k){ return "<option value=\"" + k + "\"" + ((p.verification_status||"pending")===k?" selected":"") + ">" + VERIFICATION_STATUS_LABELS[k] + "</option>"; }).join("") +
      "</select></div>" +
    "</div>" +
    "<div class=\"checkin-field\"><label for=\"fpSourceUrl\">Link da fonte (individual, deste produto — nunca um link genérico)</label><input type=\"text\" id=\"fpSourceUrl\" value=\"" + escapeHtml(p.source_url || "") + "\"></div>" +
    "<div class=\"checkin-field\"><label for=\"fpInternalNote\">Nota de auditoria interna (nunca mostrada ao aluno, nunca conta como fonte)</label><textarea id=\"fpInternalNote\" rows=\"2\">" + escapeHtml(p.internal_note || "") + "</textarea></div>" +
    "<p class=\"muted-p\" id=\"fpError\" style=\"color:var(--critical); display:none; margin:8px 0;\"></p>" +
    "<button type=\"button\" class=\"btn primary\" id=\"fpSave\" style=\"width:100%; margin-top:6px;\">Guardar produto</button>"
  );
}

// Abre o formulário de edição (product === null -> criar). "onSaved" corre depois de guardar e de o estado local já estar atualizado.
function openFoodProductModal(product, onSaved){
  var sheet = openModal(tplCatalogProductForm(product));
  sheet.querySelector("#fpSave").addEventListener("click", function(){ saveEditedFoodProduct(sheet, product, onSaved); });
  return sheet;
}

// Chave de pesquisa do Catálogo (nome, marca, EAN) — calculada uma vez por produto, não a cada letra escrita.
function catalogSearchKey(p){ return (p.name + "\n" + p.brand + "\n" + (p.ean || "")).toLowerCase(); }

// Mete um produto acabado de guardar no estado local (substitui ou acrescenta), refaz a chave de pesquisa e mantém a ordem alfabética.
function catalogApplySavedProduct(saved){
  var list = state.catalogProducts || (state.catalogProducts = []);
  var idx = -1;
  list.forEach(function(x, i){ if (x.id === saved.id) idx = i; });
  saved._k = catalogSearchKey(saved);
  if (idx >= 0) list[idx] = saved; else list.push(saved);
  if (saved.verification_status !== "pending" && state.catalogSelected) delete state.catalogSelected[saved.id];
  var cmp = FOOD_COLLATOR ? FOOD_COLLATOR.compare : function(a, b){ return a.localeCompare(b, "pt"); };
  list.sort(function(a, b){ return cmp(a.name, b.name); });
}

/* ---------- Open Food Facts (Portugal): pesquisa externa e importação ----------
   Quando a pesquisa local dá poucos resultados, consulta a API pública do Open Food Facts (produtos vendidos em Portugal, ou um código
   de barras), converte cada produto para a estrutura de food_products e, ao escolher um, grava-o em food_products como "verified"
   (fonte "open_food_facts") — fica logo disponível e guardado para as próximas vezes. Só o profissional vê isto (a escrita exige RLS de profissional). */
var OFF_MIN_LOCAL = 5;      // abaixo deste número de resultados locais, procura também no Open Food Facts
var OFF_MIN_CHARS = 3;
var OFF_FIELDS = "code,product_name,product_name_pt,brands,nutriments,quantity,product_quantity,product_quantity_unit,categories_tags,ingredients_text,ingredients_text_pt,allergens_tags,stores_tags";
var OFF_CACHE = {};
var OFF_STORES = {"continente": "Continente", "pingo-doce": "Pingo Doce", "mercadona": "Mercadona", "auchan": "Auchan", "lidl": "Lidl"};

function offNum(v){
  if (v == null || v === "") return null;
  var n = parseFloat(String(v).replace(",", "."));
  return isFinite(n) ? n : null;
}
function offRound(n){ return n == null ? null : Math.round(n * 10) / 10; }
function offClean(t){ return String(t == null ? "" : t).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); }
function offIsEan(q){ return /^\d{8,14}$/.test(String(q || "").trim()); }

// categorias do Open Food Facts -> os 7 grupos aceites por food_products (bebidas sem leite ficam em "snacks", como no resto do catálogo)
function offGuessGroup(tags){
  var t = (tags || []).join(" ");
  function has(re){ return re.test(t); }
  if (has(/en:(oils|vegetable-oils|olive-oils|fats|nuts|seeds|nut-butters|margarines)\b/)) return "gorduras";
  if (has(/en:(dairies|milks|cheeses|yogurts|butters|creams|dairy-desserts|fermented-milk)/)) return "laticinios";
  if (has(/en:(meats|poultries|fishes|seafood|eggs|sausages|hams|canned-fishes|tunas|charcuteries|meat-based)/)) return "carnes";
  if (has(/en:(fruits|fresh-fruits|dried-fruits|fruit-based)/) && !has(/en:(beverages|juices|sodas)/)) return "fruta";
  if (has(/en:(vegetables|legumes|pulses|fresh-vegetables|canned-vegetables|salads)/)) return "vegetais";
  if (has(/en:(cereals|breads|pastas|rices|flours|breakfast-cereals|cereal-grains|potatoes|biscuits-and-cakes|crackers)/)) return "cereais";
  return "snacks";
}

// Converte um produto bruto do Open Food Facts para uma linha de food_products. Devolve null se faltar algo essencial
// (nome, marca, EAN, kcal/proteína/hidratos/gordura) ou se os valores não fizerem sentido.
function offMapProduct(raw){
  if (!raw) return null;
  var ean = String(raw.code || "").replace(/\D/g, "");
  if (ean.length < 8 || ean.length > 14) return null;
  var name = offClean(raw.product_name_pt || raw.product_name);
  var brand = offClean(String(raw.brands || "").split(",")[0]);
  if (name.length < 2 || !brand) return null;
  var n = raw.nutriments || {};
  var kcal = offNum(n["energy-kcal_100g"]);
  if (kcal == null){ var kj = offNum(n["energy_100g"]); if (kj != null) kcal = kj / 4.184; }
  var protein = offNum(n["proteins_100g"]), carbs = offNum(n["carbohydrates_100g"]), fat = offNum(n["fat_100g"]);
  if (kcal == null || protein == null || carbs == null || fat == null) return null;
  if (kcal < 0 || kcal > 900 || protein < 0 || carbs < 0 || fat < 0 || protein > 100 || carbs > 100 || fat > 100) return null;
  if (protein + carbs + fat > 102) return null; // macros por 100 g nunca passam 100 g
  var calc = 4 * protein + 4 * carbs + 9 * fat;
  if (Math.abs(kcal - calc) > Math.max(60, 0.5 * Math.max(kcal, calc))) return null; // energia incompatível com os macros: dado de má qualidade
  // base: líquidos vêm por 100 ml
  var qtyStr = String(raw.quantity || "").toLowerCase();
  var unit = String(raw.product_quantity_unit || "").toLowerCase();
  var liquid = unit === "ml" || unit === "cl" || unit === "l" || /\d\s*(ml|cl|l)\b/.test(qtyStr);
  var pq = offNum(raw.product_quantity);
  var packQty = null, packUnit = null;
  if (pq != null && pq > 0){
    if (liquid){ packQty = unit === "l" ? pq * 1000 : (unit === "cl" ? pq * 10 : pq); packUnit = "ml"; }
    else { packQty = unit === "kg" ? pq * 1000 : pq; packUnit = "g"; }
    packQty = offRound(packQty);
  }
  var stores = [];
  (raw.stores_tags || []).forEach(function(tg){ var r = OFF_STORES[String(tg).toLowerCase().replace(/^[a-z]{2}:/, "")]; if (r && stores.indexOf(r) < 0) stores.push(r); });
  var allergens = (raw.allergens_tags || []).map(function(a){ return String(a).replace(/^[a-z]{2}:/, ""); }).filter(Boolean).join(", ");
  var ingredients = offClean(raw.ingredients_text_pt || raw.ingredients_text).slice(0, 1000);
  return {
    ean: ean, name: name, brand: brand,
    food_group: offGuessGroup(raw.categories_tags),
    package_quantity: packQty, package_unit: packUnit,
    nutrition_basis: liquid ? "100ml" : "100g",
    kcal: offRound(kcal), protein: offRound(protein), carbs: offRound(carbs), fat: offRound(fat),
    sugars: offRound(offNum(n["sugars_100g"])), fiber: offRound(offNum(n["fiber_100g"])),
    saturated_fat: offRound(offNum(n["saturated-fat_100g"])), salt: offRound(offNum(n["salt_100g"])),
    ingredients: ingredients || null, allergens: allergens || null,
    source_url: "https://world.openfoodfacts.org/product/" + ean,
    source_type: "open_food_facts",
    stores: stores
  };
}

function offFetchJson(url){
  var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
  var timer = ctrl ? setTimeout(function(){ ctrl.abort(); }, 9000) : null;
  return fetch(url, ctrl ? {signal: ctrl.signal} : undefined).then(function(r){
    if (timer) clearTimeout(timer);
    if (!r.ok) throw new Error("off " + r.status);
    return r.json();
  }, function(e){ if (timer) clearTimeout(timer); throw e; });
}

// Pesquisa por termo (só produtos vendidos em Portugal) ou por código de barras. Devolve {products:[linhas já convertidas]}; em erro, {error:true}.
function offSearch(query){
  var q = String(query || "").trim();
  var key = q.toLowerCase();
  if (OFF_CACHE[key]) return Promise.resolve(OFF_CACHE[key]);
  var url = offIsEan(q)
    ? "https://world.openfoodfacts.org/api/v2/product/" + q + ".json?fields=" + OFF_FIELDS
    : "https://world.openfoodfacts.org/cgi/search.pl?search_terms=" + encodeURIComponent(q) + "&search_simple=1&action=process&json=1&page_size=24&sort_by=unique_scans_n" +
      "&tagtype_0=countries&tag_contains_0=contains&tag_0=portugal&fields=" + OFF_FIELDS;
  return offFetchJson(url).then(function(data){
    var raws = offIsEan(q) ? (data && data.status === 1 && data.product ? [data.product] : []) : ((data && data.products) || []);
    var seen = {}, products = [];
    raws.forEach(function(r){
      var m = offMapProduct(r);
      if (m && !seen[m.ean]){ seen[m.ean] = true; products.push(m); }
    });
    var res = {products: products};
    OFF_CACHE[key] = res;
    return res;
  }).catch(function(){ return {error: true, products: []}; });
}

// Chave que ignora maiúsculas, acentos e pontuação: "Leite magro (Continente Equilíbrio)" == "Leite Magro" + "Continente Equilíbrio".
// Os produtos antigos (migrados do código) não têm EAN, por isso só a comparação por nome+marca apanha os repetidos.
function offKey(text){
  var t = String(text == null ? "" : text).toLowerCase();
  if (t.normalize) t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return t.replace(/[^a-z0-9]+/g, "");
}
function offProductKey(name, brand){ return offKey(name + " (" + brand + ")"); }
// o que a app já conhece: nomes dos alimentos (sem o sufixo "· Supermercado") e EANs do Catálogo carregado
function offKnownIndex(){
  var idx = {names: {}, eans: {}};
  Object.keys(FOOD_DB).forEach(function(n){ idx.names[offKey(n.replace(/\s·\s[^·]+$/, ""))] = n; });
  (state.catalogProducts || []).forEach(function(p){
    if (p.ean) idx.eans[p.ean] = true;
    if (p.name && p.brand) idx.names[offProductKey(p.name, p.brand)] = idx.names[offProductKey(p.name, p.brand)] || foodProductDisplayName(p, p.food_product_retailers);
  });
  return idx;
}
function offIsKnown(m, idx){ idx = idx || offKnownIndex(); return !!(idx.eans[m.ean] || idx.names[offProductKey(m.name, m.brand)]); }
function offIlikeEscape(t){ return String(t).replace(/[\\%_]/g, function(c){ return "\\" + c; }); }

// Grava o produto escolhido em food_products (verified) e nos supermercados, e junta-o já aos alimentos da app.
// Devolve {name} (nome nos alimentos da app), {existing:true,name} se o EAN já está no catálogo, ou {error}/{blocked}.
function offSaveProduct(m){
  if (!sbReady) return Promise.resolve({error: "Sem ligação à base de dados."});
  return sb.from("food_products").select("id,name,brand,verification_status").eq("ean", m.ean).limit(1).then(function(ex){
    if (ex.error) return {error: "Não foi possível guardar — tenta novamente."};
    var found = ex.data && ex.data[0];
    if (found){
      if (found.verification_status === "verified") return {existing: true, name: foodProductDisplayName(found, null), foundRow: found};
      return {blocked: "Este EAN já está no catálogo como " + (VERIFICATION_STATUS_LABELS[found.verification_status] || found.verification_status).toLowerCase() + " — revê-o no Catálogo."};
    }
    // já existe o mesmo produto sem EAN (ex.: migrado do código) ou com outro EAN? Não se duplica.
    var known = offKnownIndex().names[offProductKey(m.name, m.brand)];
    if (known) return {existing: true, name: known};
    return sb.from("food_products").select("id,name,brand,verification_status").ilike("name", offIlikeEscape(m.name)).limit(20).then(function(same){
      if (same.error) return {error: "Não foi possível guardar — tenta novamente."};
      var dup = (same.data || []).filter(function(r){ return offProductKey(r.name, r.brand) === offProductKey(m.name, m.brand); })[0];
      if (dup){
        if (dup.verification_status === "verified") return {existing: true, name: foodProductDisplayName(dup, null), foundRow: dup};
        return {blocked: "Este produto já está no catálogo como " + (VERIFICATION_STATUS_LABELS[dup.verification_status] || dup.verification_status).toLowerCase() + " — revê-o no Catálogo."};
      }
      return offInsertProduct(m);
    });
  }).catch(function(){ return {error: "Não foi possível guardar — tenta novamente."}; });
}

function offInsertProduct(m){
  return Promise.resolve().then(function(){
    var now = new Date().toISOString();
    var row = {};
    ["ean","name","brand","food_group","package_quantity","package_unit","nutrition_basis","kcal","protein","carbs","fat","sugars","fiber","saturated_fat","salt","ingredients","allergens","source_url","source_type"].forEach(function(k){ row[k] = m[k]; });
    row.verification_status = "verified";
    row.verified_at = now;
    row.internal_note = "Importado automaticamente do Open Food Facts em " + now.slice(0, 10) + " (valores não confirmados no rótulo).";
    return sb.from("food_products").insert(row).select().then(function(res){
      var saved = res.data && res.data[0];
      if (res.error || !saved) return {error: "Não foi possível guardar — tenta novamente."};
      var addRetailers = m.stores && m.stores.length
        ? sb.from("food_product_retailers").insert(m.stores.map(function(r){ return {food_product_id: saved.id, retailer: r}; })).select()
        : Promise.resolve({data: []});
      return addRetailers.then(function(rr){
        var retailers = (rr && rr.data) || [];
        saved.food_product_retailers = retailers;
        mergeFoodProduct(saved, retailers);
        if (state.catalogProducts) catalogApplySavedProduct(saved);
        return {name: foodProductDisplayName(saved, retailers), saved: saved};
      });
    });
  }).catch(function(){ return {error: "Não foi possível guardar — tenta novamente."}; });
}

// Mostra, dentro de "host", os resultados do Open Food Facts quando a pesquisa local deu poucos (localCount < OFF_MIN_LOCAL).
// onPick(nome) corre depois de o produto escolhido ficar guardado. "seq" descarta respostas de pesquisas antigas.
function offAutoSearch(host, query, localCount, onPick){
  var q = String(query || "").trim();
  host._offSeq = (host._offSeq || 0) + 1;
  var seq = host._offSeq;
  clearTimeout(host._offTimer);
  if (!sbReady || localCount >= OFF_MIN_LOCAL || !(offIsEan(q) || q.length >= OFF_MIN_CHARS)) return;
  var box = document.createElement("div");
  box.className = "off-box";
  box.innerHTML = "<div class=\"food-search-empty\">A procurar no Open Food Facts…</div>";
  host.appendChild(box);
  host._offTimer = setTimeout(function(){
    offSearch(q).then(function(res){
      if (host._offSeq !== seq) return;
      if (res.error){ box.innerHTML = "<div class=\"food-search-empty\">Open Food Facts indisponível — tenta mais tarde.</div>"; return; }
      if (!res.products.length){ box.innerHTML = "<div class=\"food-search-empty\">Sem resultados no Open Food Facts (Portugal).</div>"; return; }
      var idx = offKnownIndex();
      res = {products: res.products.filter(function(m){ return !offIsKnown(m, idx); })}; // os que a app já tem (mesmo EAN ou mesmo nome+marca) não se oferecem outra vez
      if (!res.products.length){ box.innerHTML = "<div class=\"food-search-empty\">Os produtos encontrados no Open Food Facts já estão no catálogo.</div>"; return; }
      box.innerHTML = "<div class=\"food-search-empty\">Open Food Facts (Portugal) — ao escolher, fica guardado no catálogo como verificado:</div>" +
        res.products.map(function(m, i){
          return "<div class=\"food-search-item off-item\" data-off=\"" + i + "\">" + escapeHtml(m.name) + " <span class=\"muted-p\">(" + escapeHtml(m.brand) + ") · " + m.kcal + " kcal · P " + m.protein + " · H " + m.carbs + " · G " + m.fat + " (por " + (m.nutrition_basis === "100ml" ? "100 ml" : "100 g") + ")</span></div>";
        }).join("");
      box.onclick = function(e){
        var item = e.target.closest ? e.target.closest(".off-item") : null;
        if (!item || item.getAttribute("data-busy")) return;
        var m = res.products[parseInt(item.getAttribute("data-off"), 10)];
        if (!m) return;
        item.setAttribute("data-busy", "1");
        item.style.opacity = "0.5";
        showToast("A guardar no catálogo…");
        offSaveProduct(m).then(function(r){
          item.removeAttribute("data-busy");
          item.style.opacity = "";
          if (r.error || r.blocked){ showToast("⚠ " + (r.error || r.blocked)); return; }
          if (r.foundRow) mergeFoodProduct(r.foundRow, null);
          showToast(r.existing ? "Já estava no catálogo" : "✓ Guardado no catálogo como verificado");
          if (FOOD_DB[r.name]) onPick(r.name);
        });
      };
    });
  }, 600); // espera que pares de escrever antes de ir à rede
}

// Lê o formulário, valida, faz o UPDATE (ou INSERT) em food_products e substitui os supermercados do produto.
function saveEditedFoodProduct(sheet, product, onSaved){
  var errEl = sheet.querySelector("#fpError");
  errEl.style.display = "none";
  var name = sheet.querySelector("#fpName").value.trim();
  var brand = sheet.querySelector("#fpBrand").value.trim();
  var kcal = parseFloat(sheet.querySelector("#fpKcal").value);
  var protein = parseFloat(sheet.querySelector("#fpProtein").value);
  var carbs = parseFloat(sheet.querySelector("#fpCarbs").value);
  var fat = parseFloat(sheet.querySelector("#fpFat").value);
  if (!name || !brand){ errEl.textContent = "Preenche o nome e a marca."; errEl.style.display = "block"; return; }
  if (!(kcal >= 0) || !(protein >= 0) || !(carbs >= 0) || !(fat >= 0)){ errEl.textContent = "Preenche kcal/proteína/hidratos/gordura (podem ser 0, nunca negativos)."; errEl.style.display = "block"; return; }
  if (!sbReady){ errEl.textContent = "Sem ligação à base de dados."; errEl.style.display = "block"; return; }

  function numOrNull(id){ var v = parseFloat(sheet.querySelector(id).value); return isFinite(v) ? v : null; }
  var row = {
    ean: sheet.querySelector("#fpEan").value.trim() || null,
    name: name, brand: brand,
    food_group: sheet.querySelector("#fpGroup").value,
    package_quantity: numOrNull("#fpPackageQty"),
    package_unit: sheet.querySelector("#fpPackageUnit").value.trim() || null,
    nutrition_basis: sheet.querySelector("#fpBasis").value,
    kcal: kcal, protein: protein, carbs: carbs, fat: fat,
    sugars: numOrNull("#fpSugars"), fiber: numOrNull("#fpFiber"),
    saturated_fat: numOrNull("#fpSatFat"), salt: numOrNull("#fpSalt"),
    ingredients: sheet.querySelector("#fpIngredients").value.trim() || null,
    allergens: sheet.querySelector("#fpAllergens").value.trim() || null,
    source_url: sheet.querySelector("#fpSourceUrl").value.trim() || null,
    internal_note: sheet.querySelector("#fpInternalNote").value.trim() || null,
    source_type: sheet.querySelector("#fpSourceType").value,
    verification_status: sheet.querySelector("#fpStatus").value,
    updated_at: new Date().toISOString()
  };
  var selectedRetailers = Array.from(sheet.querySelectorAll(".fp-retailer:checked")).map(function(cb){ return cb.value; });

  var saveBtn = sheet.querySelector("#fpSave");
  function fail(msg){ errEl.textContent = msg; errEl.style.display = "block"; saveBtn.disabled = false; }
  saveBtn.disabled = true; // evita guardar duas vezes com um duplo toque

  var save = product
    ? sb.from("food_products").update(row).eq("id", product.id).select()
    : sb.from("food_products").insert(row).select();

  save.then(function(res){
    if (res.error || !res.data || !res.data[0]){ fail("⚠ Não foi possível guardar — verifica se o EAN já existe noutro produto."); return; }
    var saved = res.data[0];
    return sb.from("food_product_retailers").delete().eq("food_product_id", saved.id).then(function(){
      if (!selectedRetailers.length) return {data: []};
      return sb.from("food_product_retailers").insert(selectedRetailers.map(function(r){ return {food_product_id: saved.id, retailer: r}; })).select();
    }).then(function(rr){
      if (rr && rr.error){ fail("⚠ Produto guardado, mas não foi possível atualizar os supermercados — tenta novamente."); return; }
      saved.food_product_retailers = (rr && rr.data) || [];
      catalogApplySavedProduct(saved);
      showToast("✓ Produto guardado");
      closeModal();
      if (onSaved) onSaved(saved);
    });
  }).catch(function(){ fail("⚠ Não foi possível guardar — tenta novamente."); });
}

function tplAddFoodForm(midx){
  var defaultGroup = PRO_PLAN_GROUPS[0];
  return "<div style=\"margin-top:10px;\">" +
    "<div class=\"onb-row\" style=\"align-items:end;\">" +
      "<div class=\"onb-field\" style=\"margin-bottom:0;\"><label>Grupo</label>" +
        "<select class=\"af-group\" data-midx=\"" + midx + "\">" +
          PRO_PLAN_GROUPS.map(function(g){ return "<option value=\"" + g + "\">" + groupLabel(g) + "</option>"; }).join("") +
        "</select></div>" +
      "<div class=\"onb-field food-search-wrap\" style=\"margin-bottom:0;\"><label>Alimento</label>" +
        "<input type=\"text\" class=\"af-food\" data-midx=\"" + midx + "\" value=\"\" autocomplete=\"off\" placeholder=\"Pesquisar alimento...\">" +
        "<div class=\"food-search-results\" data-midx=\"" + midx + "\">" + foodSearchResultsHtml(allFoodNames(), "") + "</div>" +
      "</div>" +
    "</div>" +
    "<div class=\"onb-row\" style=\"margin-top:8px; align-items:end;\">" +
      "<div class=\"onb-field af-qty-wrap\" data-midx=\"" + midx + "\" style=\"margin-bottom:0;\">" + tplAddFoodQty("") + "</div>" +
      "<div class=\"onb-field\" style=\"margin-bottom:0;\">" +
        "<button type=\"button\" class=\"btn primary btn-sm\" data-add-food=\"" + midx + "\" style=\"width:100%;\">Adicionar</button>" +
      "</div>" +
    "</div>" +
    "<button type=\"button\" class=\"btn btn-sm\" data-new-food=\"" + midx + "\" style=\"width:100%; margin-top:8px;\">📷 Não encontro o alimento — acrescentar novo</button>" +
  "</div>";
}

function tplAddFoodQty(name){
  var kind = unitKindFor(name);
  if (kind === "fixed"){
    return "<label>Quantidade</label><div class=\"v\" style=\"padding:9px 0; color:var(--muted); font-size:0.85rem;\">À vontade — sem quantidade a definir</div>";
  }
  if (kind === "unit"){
    return "<label>Quantidade (unid.)</label><input type=\"number\" class=\"af-qty-num\" min=\"1\" step=\"1\" value=\"1\">" + foodNutritionPreviewHtml(name, 1);
  }
  var unitLabel = isBeverage(name) ? "ml" : "g";
  return "<label>Quantidade (" + unitLabel + ")</label><input type=\"number\" class=\"af-qty-num\" min=\"1\" step=\"1\" value=\"100\">" + foodNutritionPreviewHtml(name, 100);
}

// Fase 21: igual a tplAddFoodQty, mas pré-preenchido com a quantidade ATUAL
// do alimento (em vez do valor por omissão 100/1) — usado no formulário de
// editar um alimento já no plano.
function tplEditFoodQty(name, currentAmount){
  var kind = unitKindFor(name);
  if (kind === "fixed"){
    return "<label>Quantidade</label><div class=\"v\" style=\"padding:9px 0; color:var(--muted); font-size:0.85rem;\">À vontade — sem quantidade a definir</div>";
  }
  if (kind === "unit"){
    var units = Math.max(1, Math.round(currentAmount || 1));
    return "<label>Quantidade (unid.)</label><input type=\"number\" class=\"ef-qty-num\" min=\"1\" step=\"1\" value=\"" + units + "\">" + foodNutritionPreviewHtml(name, units);
  }
  var unitLabel = isBeverage(name) ? "ml" : "g";
  var grams = Math.max(1, Math.round(currentAmount || 100));
  return "<label>Quantidade (" + unitLabel + ")</label><input type=\"number\" class=\"ef-qty-num\" min=\"1\" step=\"1\" value=\"" + grams + "\">" + foodNutritionPreviewHtml(name, grams);
}

function tplEditFoodForm(midx, fidx, f){
  var group = f.group ? resolveGroup(f.group) : PRO_PLAN_GROUPS[0];
  var amt = parseQtyAmount(f.qty);
  return "<div class=\"food-edit-form hidden\" data-edit-form=\"" + midx + "-" + fidx + "\" style=\"margin:-4px 0 10px; padding:10px; border:1px solid var(--line-strong); border-radius:10px; background:var(--surface-2);\">" +
    "<div class=\"onb-row\" style=\"align-items:end;\">" +
      "<div class=\"onb-field\" style=\"margin-bottom:0;\"><label>Grupo</label>" +
        "<select class=\"ef-group\" data-midx=\"" + midx + "\" data-fidx=\"" + fidx + "\">" +
          PRO_PLAN_GROUPS.map(function(g){ return "<option value=\"" + g + "\"" + (g === group ? " selected" : "") + ">" + groupLabel(g) + "</option>"; }).join("") +
        "</select></div>" +
      "<div class=\"onb-field food-search-wrap\" style=\"margin-bottom:0;\"><label>Alimento</label>" +
        "<input type=\"text\" class=\"ef-food\" data-midx=\"" + midx + "\" data-fidx=\"" + fidx + "\" value=\"" + escapeHtml(f.name) + "\" autocomplete=\"off\">" +
        "<div class=\"food-search-results\" data-midx=\"" + midx + "\" data-fidx=\"" + fidx + "\">" + foodSearchResultsHtml(allFoodNames(), "") + "</div>" +
      "</div>" +
    "</div>" +
    "<div class=\"onb-row\" style=\"margin-top:8px; align-items:end;\">" +
      "<div class=\"onb-field ef-qty-wrap\" data-midx=\"" + midx + "\" data-fidx=\"" + fidx + "\" style=\"margin-bottom:0;\">" + tplEditFoodQty(f.name, amt.value) + "</div>" +
      "<div class=\"onb-field\" style=\"display:flex; gap:6px; flex-wrap:wrap; margin-bottom:0;\">" +
        "<button type=\"button\" class=\"btn primary btn-sm\" data-save-food-edit=\"" + midx + "\" data-fidx=\"" + fidx + "\" style=\"flex:1 1 80px; min-width:0;\">Guardar</button>" +
        "<button type=\"button\" class=\"btn btn-sm\" data-cancel-food-edit=\"" + midx + "\" data-fidx=\"" + fidx + "\" style=\"flex:1 1 80px; min-width:0;\">Cancelar</button>" +
      "</div>" +
    "</div>" +
  "</div>";
}

// Fase 25 (corrigido na 25b): além do aviso de coerência já existente,
// mostra também — ao lado de cada label — a % de calorias que cada macro
// representa (P/H em 4 kcal/g, G em 9 kcal/g) e, junto a "Calorias", a
// diferença face à MANUTENÇÃO do aluno (metabolismo basal × nível de
// atividade, não o basal puro — o basal sozinho não conta o gasto do
// treino/atividade do dia, por isso dava sempre um "+" bem maior do que o
// excedente/défice real): "+500 kcal" se o alvo está acima da manutenção
// (fase de ganho), "-500 kcal" se está abaixo (fase de perda). Sem dados
// suficientes no perfil (idade/sexo/altura/peso/treinos), fica em branco.
// avisos de prescrição (piso calórico, défice excessivo, proteína/gordura fora de gama) como pílulas
function safetyWarningsHtml(s, t){
  var ws = nutritionSafetyWarnings(s ? Object.assign({}, s, {leanMass: latestLeanMass(s)}) : s, t);
  return ws.map(function(w){ return "<div class=\"pill " + (w.level === "critical" ? "critical" : "warn") + "\" style=\"margin-top:8px; display:block; white-space:normal;\">" + (w.level === "critical" ? "⛔ " : "⚠ ") + escapeHtml(w.text) + "</div>"; }).join("");
}

function renderTargetWarning(el, s){
  var box = el.querySelector("#targetWarning");
  if (!box) return;
  var kcal = parseFloat(el.querySelector("#tKcal").value) || 0;
  var protein = parseFloat(el.querySelector("#tProtein").value) || 0;
  var carbs = parseFloat(el.querySelector("#tCarbs").value) || 0;
  var fat = parseFloat(el.querySelector("#tFat").value) || 0;

  var pctEl = el.querySelector("#tProteinPct"), cEl = el.querySelector("#tCarbsPct"), fEl = el.querySelector("#tFatPct");
  if (kcal > 0){
    if (pctEl) pctEl.textContent = "· " + Math.round(protein*4/kcal*100) + "%";
    if (cEl) cEl.textContent = "· " + Math.round(carbs*4/kcal*100) + "%";
    if (fEl) fEl.textContent = "· " + Math.round(fat*9/kcal*100) + "%";
  } else {
    if (pctEl) pctEl.textContent = "";
    if (cEl) cEl.textContent = "";
    if (fEl) fEl.textContent = "";
  }

  var diffEl = el.querySelector("#tKcalDiff");
  if (diffEl){
    var maintenance = s ? computeMaintenanceKcal(s) : null;
    diffEl.textContent = maintenance ? "· " + (kcal >= maintenance ? "+" : "−") + Math.abs(Math.round(kcal - maintenance)) + " kcal vs. manutenção" : "";
  }

  if (kcal <= 0 || protein < 0 || carbs < 0 || fat < 0){
    box.innerHTML = "<div class=\"pill critical\" style=\"margin-top:10px;\">⚠ As calorias têm de ser superiores a 0 e os macros não podem ser negativos</div>";
    return;
  }
  var expected = expectedKcalFromMacros({protein:protein, carbs:carbs, fat:fat});
  var diffPct = kcal ? Math.abs(expected - kcal)/kcal : 0;
  box.innerHTML = diffPct > 0.05
    ? "<div class=\"pill warn\" style=\"margin-top:10px;\">⚠ Estes macros correspondem a ~" + expected + " kcal, mas o alvo indicado é " + kcal + " kcal</div>"
    : "<div class=\"pill good\" style=\"margin-top:10px;\">✓ Macros coerentes com o alvo (~" + expected + " kcal)</div>";
  box.innerHTML += safetyWarningsHtml(s, {kcal:kcal, protein:protein, carbs:carbs, fat:fat});
}

var FLEX_OVERRIDE_CHECKBOXES = [
  ["mealBuilderEnabled", "Permitir construtor de refeições"],
  ["substitutionsEnabled", "Permitir substituições"],
  ["freeMealEnabled", "Permitir refeições flexíveis"],
  ["restaurantAdaptation", "Permitir adaptação em restaurantes"]
];


function tplProCheckins(s){
  var html = "<div class=\"eyebrow\" style=\"margin-bottom:8px;\">Histórico de check-ins</div>";
  s.checkins.slice().reverse().forEach(function(c){
    html += "<div class=\"history-row\"><div><div class=\"hlabel\">" + fmtDatePt(c.date) + "</div>" +
      (c.notes ? "<div class=\"muted-p\">" + escapeHtml(c.notes) + "</div>" : "") + "</div>" +
      "<div class=\"hval\">" + c.weight + " kg<br><span style=\"color:var(--muted); font-size:0.75rem;\">fome " + c.hunger + " · energia " + c.energy + " · adesão " + c.adherence + (c.sleepHours > 0 ? " · sono " + String(c.sleepHours).replace(".", ",") + "h" : "") + (c.stress > 0 ? " · stress " + c.stress : "") + (c.recovery > 0 ? " · recuperação " + c.recovery : "") + (c.sleepQuality > 0 ? " · qualidade do sono " + c.sleepQuality : "") + (c.digestion > 0 ? " · digestão " + c.digestion : "") + "</span></div></div>";
  });
  if (!s.checkins.length) html += "<p class=\"muted-p\">Sem check-ins registados.</p>";
  return html;
}

// "[10/10/2026 21:30] texto" no topo das notas: mais recente primeiro, nunca apaga as anteriores
function prependDatedNote(existing, text){
  var d = new Date();
  var stamp = ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + d.getFullYear() + " " + nowHHMM();
  var line = "[" + stamp + "] " + String(text).trim();
  return existing && String(existing).trim() ? line + "\n\n" + existing : line;
}

function tplProNotas(s){
  return "<div class=\"eyebrow\" style=\"margin-bottom:10px;\">Notas privadas</div>" +
    "<p class=\"muted-p\" style=\"margin-bottom:10px;\">Visíveis apenas para a equipa Evolve — o aluno não tem acesso.</p>" +
    "<textarea class=\"notes-area\" id=\"proNotes\">" + escapeHtml(s.notes) + "</textarea>" +
    "<button type=\"button\" class=\"btn primary btn-sm\" id=\"saveNotes\" style=\"margin-top:10px;\">Guardar notas</button>" +
    "<div style=\"margin-top:18px;\"><div class=\"eyebrow\" style=\"margin-bottom:6px;\">Nova nota datada</div>" +
      "<p class=\"muted-p\" style=\"margin-bottom:8px;\">Fica no topo das notas com a data e a hora — o histórico da evolução do aluno.</p>" +
      "<textarea id=\"proNoteNew\" placeholder=\"Ex.: Aumentei 100 kcal, queixa-se de pouca energia nos treinos\" style=\"width:100%; min-height:70px; border:1px solid var(--line-strong); border-radius:11px; padding:10px 12px; background:var(--bg);\"></textarea>" +
      "<button type=\"button\" class=\"btn btn-sm\" id=\"addDatedNote\" style=\"margin-top:8px;\">Acrescentar nota datada</button></div>";
}

var HELP_SITUATION_LABEL = {};
ASSISTANT_SITUATIONS.forEach(function(sit){ HELP_SITUATION_LABEL[sit.key] = sit.label; });

function tplProPedidos(s, reqs){
  var html = "<div class=\"eyebrow\" style=\"margin-bottom:8px;\">Pedidos de ajuda</div>" +
    "<p class=\"muted-p\" style=\"margin-bottom:14px;\">Situações que " + escapeHtml(s.name.split(" ")[0]) + " assinalou através do assistente — a resposta e a decisão são sempre tuas. A nota abaixo de cada pedido é privada, o aluno nunca a vê.</p>";
  if (reqs.error){
    var detail = (reqs.error && (reqs.error.message || reqs.error.code)) || String(reqs.error);
    return html + "<div class=\"card\" role=\"alert\" style=\"border-color:var(--critical);\">" +
      "<div class=\"eyebrow\" style=\"color:var(--critical); margin-bottom:6px;\">Não foi possível carregar os pedidos</div>" +
      "<p class=\"muted-p\" style=\"margin-bottom:8px;\">Isto não quer dizer que não haja pedidos — só que não foi possível lê-los.</p>" +
      "<p class=\"muted-p\" style=\"font-size:0.76rem; margin-bottom:12px; word-break:break-word;\">Detalhe: " + escapeHtml(String(detail)) + "</p>" +
      "<button type=\"button\" class=\"btn btn-sm\" id=\"retryHelpRequests\">Tentar de novo</button>" +
    "</div>";
  }
  if (!reqs.length){
    html += "<p class=\"muted-p\">Ainda sem pedidos de ajuda.</p>";
    return html;
  }
  html += reqs.map(function(r){
    var noteObj = Array.isArray(r.help_request_notes) ? r.help_request_notes[0] : r.help_request_notes;
    var existingNote = (noteObj && noteObj.professional_note) || "";
    var isHandled = r.status === "tratado";
    return "<div class=\"card\" style=\"margin-bottom:10px;\">" +
      "<div style=\"display:flex; justify-content:space-between; align-items:flex-start; gap:8px;\">" +
        "<div>" +
          "<div class=\"hlabel\">" + escapeHtml(HELP_SITUATION_LABEL[r.situation] || r.situation) + "</div>" +
          (r.meal_name ? "<div class=\"muted-p\" style=\"font-size:0.78rem;\">Refeição: " + escapeHtml(r.meal_name) + "</div>" : "") +
          "<div class=\"muted-p\" style=\"font-size:0.72rem; margin-top:2px;\">" + fmtDatePt(r.created_at.slice(0,10)) + " · " + r.created_at.slice(11,16) + "</div>" +
        "</div>" +
        "<span class=\"pill " + (isHandled ? "good" : "warn") + "\">" + (isHandled ? "Tratado" : "Pendente") + "</span>" +
      "</div>" +
      (r.note ? "<p class=\"muted-p\" style=\"margin-top:8px;\">" + escapeHtml(r.note) + "</p>" : "") +
      "<div style=\"margin-top:10px;\">" +
        "<label style=\"font-size:0.78rem; color:var(--muted);\">Nota privada (só a equipa vê)</label>" +
        "<textarea class=\"pedido-nota\" data-id=\"" + r.id + "\" style=\"width:100%; min-height:50px; border:1px solid var(--line-strong); border-radius:10px; padding:8px 10px; background:var(--bg); font-size:0.85rem; margin-top:4px;\">" + escapeHtml(existingNote) + "</textarea>" +
      "</div>" +
      "<div style=\"display:flex; gap:8px; margin-top:8px;\">" +
        "<button type=\"button\" class=\"btn btn-sm pedido-save\" data-id=\"" + r.id + "\">Guardar nota</button>" +
        (!isHandled ? "<button type=\"button\" class=\"btn primary btn-sm pedido-tratado\" data-id=\"" + r.id + "\">Marcar como tratado</button>" : "") +
      "</div>" +
    "</div>";
  }).join("");
  return html;
}

function wireProPedidos(s, reqs){
  var el = document.getElementById("proTabContent");
  el.querySelectorAll(".pedido-save").forEach(function(btn){
    btn.addEventListener("click", function(){
      var id = btn.getAttribute("data-id");
      var note = el.querySelector(".pedido-nota[data-id=\"" + id + "\"]").value;
      saveHelpRequestNote(id, note).then(function(){ showToast("Nota guardada"); });
    });
  });
  el.querySelectorAll(".pedido-tratado").forEach(function(btn){
    btn.addEventListener("click", function(){
      var id = btn.getAttribute("data-id");
      markHelpRequestHandled(id).then(function(){
        showToast("Pedido marcado como tratado");
        renderProTabContent(s);
      });
    });
  });
}

var ADAPTATION_TYPE_LABEL = {
  substituicao: "Substituições", adaptacao: "Refeições adaptadas",
  refeicao_flexivel: "Refeições flexíveis", refeicao_ignorada: "Refeições ignoradas",
  reagendamento: "Refeições reagendadas", pedido_profissional: "Pedidos de ajuda ao profissional"
};

function computeAdaptationSummary(s, days){
  days = days || 7;
  var cutoffISO = addDaysISO(localTodayISO(), -days);
  var counts = Object.create(null); // sem protótipo: um tipo forjado como "constructor" ou "__proto__" é só mais uma chave
  (s.adaptationHistory || []).forEach(function(e){
    if (!e || typeof e.type !== "string" || typeof e.date !== "string" || e.date < cutoffISO) return;
    counts[e.type] = (counts[e.type] || 0) + 1;
  });
  return counts;
}

/* ===================== SINAIS DO ALUNO (leitura profissional) =====================
   Indicadores objetivos calculados em tempo real a partir de dados já existentes
   (checkins, weights, adaptationHistory, meals, targets) — nunca guardados no aluno.
   Cada indicador tem um estado (atencao | positivo | insuficiente), um texto factual,
   um período de referência explícito e o separador onde consultar a origem dos dados.
   A app organiza a leitura; a interpretação e a decisão continuam a ser do profissional. */
var SIGNAL_CHECKIN_LATE_DAYS = 7;      // mesmo limiar já usado no dashboard para "check-ins pendentes"
var SIGNAL_CHECKIN_CRITICAL_DAYS = 14; // atraso considerado mais grave (pill "critical")
var SIGNAL_RECENT_CHECKINS = 4;        // mesma janela já usada por computeAdherence
var SIGNAL_WEIGHT_TREND_WEEKS = 3;     // período de referência da tendência de peso recente
var SIGNAL_ADAPTATION_DAYS = 7;        // mesma janela já usada por computeAdaptationSummary
var SIGNAL_LOW_ADHERENCE = 6;          // adesão média (0-10) abaixo disto merece atenção
var SIGNAL_HIGH_HUNGER = 7;            // fome média (0-10) acima disto merece atenção
var SIGNAL_LOW_ENERGY = 4;             // energia média (0-10) abaixo disto merece atenção
var SIGNAL_MEALS_OFF_LIMIT = 3;        // refeições fora do plano na janela recente
var SIGNAL_ADAPTATION_LIMIT = 5;       // adaptações na janela recente

function signal(key, title, status, text, period, tab, severity){
  return {key:key, title:title, status:status, text:text, period:period, tab:tab, severity: severity || "normal"};
}

function recentCheckins(s, n){
  if (!s.checkins || !s.checkins.length) return [];
  return s.checkins.slice(-(n || SIGNAL_RECENT_CHECKINS));
}

function signalCheckin(s){
  if (!s.checkins || !s.checkins.length){
    return signal("checkin", "Check-in", "insuficiente", "Sem check-ins registados.", "Desde sempre", "checkins");
  }
  var days = computeLastCheckinDaysAgo(s);
  if (days >= SIGNAL_CHECKIN_LATE_DAYS){
    return signal("checkin", "Check-in", "atencao", "Check-in em atraso há " + days + " dias.",
      "Desde o último check-in", "checkins", days >= SIGNAL_CHECKIN_CRITICAL_DAYS ? "high" : "normal");
  }
  return signal("checkin", "Check-in", "positivo", "Último check-in " + daysAgoLabel(days) + ".", "Desde o último check-in", "checkins");
}

// por data; no mesmo dia mantém a ordem de inserção (a última pesagem do dia é a que conta, como em weightCurrent)
function sortWeightsStable(weights){
  return weights.map(function(w, i){ return {w: w, i: i}; }).sort(function(a, b){ return a.w.date < b.w.date ? -1 : (a.w.date > b.w.date ? 1 : a.i - b.i); }).map(function(x){ return x.w; });
}
function computeRecentWeightChange(weights, weeks){
  weeks = weeks || SIGNAL_WEIGHT_TREND_WEEKS;
  if (!weights || weights.length < 2) return null;
  var sorted = sortWeightsStable(weights);
  var last = sorted[sorted.length-1];
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeks*7);
  if (new Date(last.date+"T00:00:00") < cutoff) return null; // sem registos de peso dentro da janela
  var before = sorted.filter(function(w){ return new Date(w.date+"T00:00:00") <= cutoff; });
  // sem pesagem antes da janela: a mais antiga que existe (várias nesse dia: a última, como em 'last' e em weightCurrent)
  var first = before.length ? before[before.length-1] : sorted.filter(function(w){ return w.date === sorted[0].date; }).pop();
  if (first === last) return null; // só há um ponto disponível — nada para comparar
  return { diff: last.w - first.w, from: first.date, to: last.date };
}

// direção pretendida: "perda" | "ganho" | "manutencao" — pelo peso objetivo, ou pelo objetivo escrito
function goalDirection(s){
  var cur = s.weightCurrent;
  if (s.weightGoal && cur && Math.abs(s.weightGoal - cur) >= 0.5) return s.weightGoal < cur ? "perda" : "ganho";
  var g = s.goal || "";
  if (/perda|défice|emagrec|gordura/i.test(g) && !/ganho|aumento/i.test(g)) return "perda";
  if (/ganho|aumento|hipertrofia|massa muscular/i.test(g)) return "ganho";
  return "manutencao";
}

function signalWeight(s){
  var ins = weighInsOf(s);   // pesagens do profissional (avaliações), sem repetir a mesma em duas estruturas
  var change = computeRecentWeightChange(ins, SIGNAL_WEIGHT_TREND_WEEKS);
  if (change == null){
    return signal("peso", "Peso", "insuficiente", ins.length ? "Sem pesagens recentes para avaliar a tendência — regista o peso na próxima avaliação." : WEIGHT_MISSING_TEXT,
      "Últimas " + SIGNAL_WEIGHT_TREND_WEEKS + " semanas", "evolucao");
  }
  // o intervalo real entre as duas pesagens (pode ser bem menos que 3 semanas): limiares e texto escalam com ele
  var spanDays = Math.round((new Date(change.to + "T00:00:00") - new Date(change.from + "T00:00:00")) / 86400000);
  if (!(spanDays >= SIGNAL_WEIGHT_MIN_SPAN_DAYS)){
    return signal("peso", "Peso", "insuficiente", "Pesagens com menos de " + SIGNAL_WEIGHT_MIN_SPAN_DAYS + " dias de intervalo: ainda cedo para avaliar a tendência.",
      "Últimas " + SIGNAL_WEIGHT_TREND_WEEKS + " semanas", "evolucao");
  }
  if (spanDays > SIGNAL_WEIGHT_MAX_SPAN_DAYS){
    // pesagem de referência antiga: tenta a mais antiga dentro da janela recente, se der pelo menos 14 dias de intervalo
    var cutoffISO = addDaysISO(localTodayISO(), -SIGNAL_WEIGHT_MAX_SPAN_DAYS);
    var sortedW = sortWeightsStable(ins);
    var win = sortedW.filter(function(w){ return w.date >= cutoffISO && w.date < change.to; });
    var inWin = win.length ? win.filter(function(w){ return w.date === win[0].date; }).pop() : null; // várias no mesmo dia: a última, como no cálculo principal
    var lastW = sortedW.filter(function(w){ return w.date === change.to; }).pop();
    var altSpan = inWin && lastW ? Math.round((new Date(change.to + "T00:00:00") - new Date(inWin.date + "T00:00:00")) / 86400000) : 0;
    if (altSpan >= SIGNAL_WEIGHT_MIN_SPAN_DAYS){
      change = {diff: lastW.w - inWin.w, from: inWin.date, to: change.to};
      spanDays = altSpan;
    }
  }
  if (spanDays > SIGNAL_WEIGHT_MAX_SPAN_DAYS){
    return signal("peso", "Peso", "insuficiente", "A pesagem anterior é de há " + spanDays + " dias: não chega para avaliar a tendência recente — regista o peso na próxima avaliação.",
      "Últimas " + SIGNAL_WEIGHT_TREND_WEEKS + " semanas", "evolucao");
  }
  // duas pesagens dão uma variação, não uma tendência: sem um ponto intermédio não se fala de estagnação nem de ritmo
  var inSpan = new Set(ins.filter(function(w){ return w.date >= change.from && w.date <= change.to; }).map(function(w){ return w.date; })).size;
  if (inSpan < 3){
    return signal("peso", "Peso", "insuficiente", "Peso: " + (change.diff >= 0 ? "+" : "") + change.diff.toFixed(1).replace(".", ",") + " kg em " + spanDays + " dias, com só " + inSpan + " pesagens — ainda não é uma tendência.",
      "Últimas " + SIGNAL_WEIGHT_TREND_WEEKS + " semanas", "evolucao");
  }
  var weeks = spanDays / 7, nWeeks = Math.min(SIGNAL_WEIGHT_TREND_WEEKS, Math.max(1, Math.round(weeks)));
  var diffStr = (change.diff>=0?"+":"") + change.diff.toFixed(1).replace(".", ",");
  var base = "Peso: " + diffStr + " kg nas últimas " + nWeeks + " semanas";
  var period = "Últimas " + nWeeks + " semanas";
  var dir = goalDirection(s), d = change.diff;
  var weight = s.weightCurrent || (ins.length ? ins[ins.length - 1].w : 0);
  var fastKg = weight ? weight * MAX_LOSS_PCT_PER_WEEK / 100 * weeks : 0.5 * weeks;
  var stallKg = Math.max(0.1 * weeks, 0.3);   // 0,3 kg em 3 semanas; nunca abaixo do "ruído" normal de uma pesagem
  var wrongKg = Math.max(weeks / 3, 0.6);     // 1 kg em 3 semanas: viragem clara no sentido contrário
  if (dir === "perda"){
    if (d > stallKg) return signal("peso", "Peso", "atencao", base + " — o objetivo é perder peso e o peso subiu.", period, "evolucao", d > wrongKg ? "high" : "normal");
    if (d > -stallKg) return signal("peso", "Peso", "atencao", base + " — estagnado face ao objetivo de perda.", period, "evolucao");
    if (-d > fastKg) return signal("peso", "Peso", "atencao", base + " — perda acima de " + MAX_LOSS_PCT_PER_WEEK + "% do peso por semana: confirma energia, fome e massa muscular.", period, "evolucao");
  } else if (dir === "ganho"){
    if (d < -stallKg) return signal("peso", "Peso", "atencao", base + " — o objetivo é ganhar massa e o peso desceu.", period, "evolucao", -d > wrongKg ? "high" : "normal");
    if (d < stallKg) return signal("peso", "Peso", "atencao", base + " — estagnado face ao objetivo de ganho.", period, "evolucao");
    if (d > fastKg) return signal("peso", "Peso", "atencao", base + " — ganho rápido: possível excesso de gordura, revê o excedente calórico.", period, "evolucao");
  } else if (Math.abs(d) > 0.5 * weeks){
    return signal("peso", "Peso", "atencao", base + " — acima do esperado para manutenção.", period, "evolucao");
  }
  return signal("peso", "Peso", "positivo", base + ".", period, "evolucao");
}

// Sono, stress e recuperação (só para quem já os registou nos check-ins recentes)
var SIGNAL_LOW_SLEEP_HOURS = 6.5;
var SIGNAL_HIGH_STRESS = 7;
var SIGNAL_LOW_RECOVERY = 4;
var SIGNAL_LOW_FEELING = 5; // qualidade do sono ou digestão
function signalRecuperacao(s){
  var recent = recentCheckins(s).filter(function(c){ return c.sleepHours > 0 || c.stress > 0 || c.recovery > 0 || c.sleepQuality > 0 || c.digestion > 0; });
  if (!recent.length) return signal("recuperacao", "Sono e recuperação", "insuficiente", "Sem registos de sono, stress ou recuperação nos check-ins.", "Últimos " + SIGNAL_RECENT_CHECKINS + " check-ins", "checkins");
  function avg(key){ var v = recent.filter(function(c){ return c[key] > 0; }); return v.length ? v.reduce(function(a, c){ return a + c[key]; }, 0) / v.length : null; }
  var sleep = avg("sleepHours"), stress = avg("stress"), rec = avg("recovery"), sleepQ = avg("sleepQuality"), dig = avg("digestion");
  var parts = [];
  if (sleep != null) parts.push("sono " + sleep.toFixed(1).replace(".", ",") + " h");
  if (sleepQ != null) parts.push("qualidade do sono " + sleepQ.toFixed(1).replace(".", ",") + "/10");
  if (dig != null) parts.push("digestão " + dig.toFixed(1).replace(".", ",") + "/10");
  if (stress != null) parts.push("stress " + stress.toFixed(1).replace(".", ",") + "/10");
  if (rec != null) parts.push("recuperação " + rec.toFixed(1).replace(".", ",") + "/10");
  var attention = (sleep != null && sleep < SIGNAL_LOW_SLEEP_HOURS) || (stress != null && stress > SIGNAL_HIGH_STRESS) || (rec != null && rec < SIGNAL_LOW_RECOVERY) || (sleepQ != null && sleepQ < SIGNAL_LOW_FEELING) || (dig != null && dig < SIGNAL_LOW_FEELING);
  return signal("recuperacao", "Sono e recuperação", attention ? "atencao" : "positivo",
    "Média: " + parts.join(" · ") + (attention ? " — sono curto, stress alto ou má recuperação explicam fome, estagnação e quebras de treino." : "."),
    "Últimos " + recent.length + " check-ins", "checkins");
}

// Inatividade: sem pesagem há muito tempo, ou duas semanas seguidas sem treinos registados
var SIGNAL_WEIGH_LATE_DAYS = 21;
var SIGNAL_WEIGHT_MIN_SPAN_DAYS = 14; // menos que isto é oscilação de água, não tendência
var SIGNAL_WEIGHT_MAX_SPAN_DAYS = 28; // a tendência recente não se julga contra uma pesagem de há meses
function daysSinceDate(iso){
  if (!iso) return null;
  var d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}
function signalPesagem(s){
  var p = weightProgress(s);
  if (!p.n) return signal("pesagem", "Pesagem", "insuficiente", WEIGHT_MISSING_TEXT, "Desde sempre", "evolucao");
  // o peso é registado pelo profissional nas avaliações: uma avaliação antiga é um lembrete, não uma falha do aluno
  if (p.daysSinceLast >= SIGNAL_WEIGH_LATE_DAYS) return signal("pesagem", "Pesagem", "insuficiente", "Última pesagem (avaliação) há " + p.daysSinceLast + " dias — regista o peso na próxima avaliação.", "Desde a última pesagem", "evolucao");
  return signal("pesagem", "Pesagem", "positivo", "Última pesagem " + daysAgoLabel(p.daysSinceLast) + ".", "Desde a última pesagem", "evolucao");
}
// Atividade de treino a partir das sessões registadas (workoutLogs), sem depender de check-ins
var SIGNAL_TRAINING_IDLE_DAYS = 14;    // sem sessões registadas há este tempo, depois de já ter registado alguma
function trainingActivity(s){
  var today = localTodayISO(), from7 = addDaysISO(today, -6);
  var dates = (s.workoutLogs || []).filter(function(l){ return l && isIsoDate(l.date); }).map(function(l){ return l.date; }).sort();
  var last = dates.length ? dates[dates.length - 1] : null;
  return {total: dates.length, last: last, daysSince: last ? Math.max(0, dayNum(today) - dayNum(last)) : null,
    week: dates.filter(function(d){ return d >= from7 && d <= today; }).length,
    hasProgram: trainingProgramOf(s).days.length > 0};
}
function signalInatividadeTreino(s){
  var a = trainingActivity(s);
  if (!a.total){
    // «sem registos» (há programa ou treinos previstos, ninguém registou) ≠ «sem dados» (nada com que comparar); nenhum dos dois é inatividade
    var comparable = a.hasProgram || s.trainingsPerWeek > 0;
    return signal("inatividade_treino", "Inatividade de treino", "insuficiente",
      comparable ? "Sem sessões de treino registadas na app — não quer dizer que o aluno não treine." : "Sem programa de treino nem sessões registadas: não há dados suficientes para avaliar.",
      "Sessões registadas", "treino");
  }
  if (a.daysSince >= SIGNAL_TRAINING_IDLE_DAYS){
    return signal("inatividade_treino", "Inatividade de treino", "atencao", "Sem sessões de treino registadas há " + a.daysSince + " dias (última a " + fmtDateFullPt(a.last) + ").",
      "Última sessão registada", "treino", "high");
  }
  return signal("inatividade_treino", "Inatividade de treino", "positivo", "Última sessão de treino registada " + daysAgoLabel(a.daysSince) + ".", "Última sessão registada", "treino");
}

function signalAdherence(s){
  var recent = recentCheckins(s);
  if (!recent.length){
    return signal("adesao", "Adesão", "insuficiente", "Sem check-ins suficientes para calcular a adesão.",
      "Últimos " + SIGNAL_RECENT_CHECKINS + " check-ins", "checkins");
  }
  var avg = recent.reduce(function(a,c){ return a + c.adherence; }, 0) / recent.length;
  return signal("adesao", "Adesão", avg < SIGNAL_LOW_ADHERENCE ? "atencao" : "positivo",
    "Adesão média: " + avg.toFixed(1).replace(".", ",") + "/10 nos últimos " + recent.length + " check-ins.",
    "Últimos " + recent.length + " check-ins", "checkins");
}

function signalHungerEnergy(s){
  var recent = recentCheckins(s);
  if (!recent.length){
    return signal("fome_energia", "Fome e energia", "insuficiente", "Sem check-ins suficientes para avaliar fome e energia.",
      "Últimos " + SIGNAL_RECENT_CHECKINS + " check-ins", "checkins");
  }
  var avgHunger = recent.reduce(function(a,c){ return a + c.hunger; }, 0) / recent.length;
  var avgEnergy = recent.reduce(function(a,c){ return a + c.energy; }, 0) / recent.length;
  var attention = avgHunger > SIGNAL_HIGH_HUNGER || avgEnergy < SIGNAL_LOW_ENERGY;
  return signal("fome_energia", "Fome e energia", attention ? "atencao" : "positivo",
    "Fome média: " + avgHunger.toFixed(1).replace(".",",") + "/10 · Energia média: " + avgEnergy.toFixed(1).replace(".",",") + "/10 nos últimos " + recent.length + " check-ins.",
    "Últimos " + recent.length + " check-ins", "checkins");
}

function signalTreinos(s){
  var planned = s.trainingsPerWeek || 0, a = trainingActivity(s);
  if (!planned) return signal("treinos", "Treinos", "insuficiente", "Sem treinos planeados definidos.", "Últimos 7 dias", "treino");
  if (!a.total) return signal("treinos", "Treinos", "insuficiente", "Sem sessões de treino registadas para comparar com os " + planned + " treinos previstos por semana.", "Últimos 7 dias", "treino");
  return signal("treinos", "Treinos", a.week < planned ? "atencao" : "positivo",
    "Treinos: " + a.week + " de " + planned + " previstos nos últimos 7 dias.", "Últimos 7 dias", "treino");
}

function signalMealsOff(s){
  var recent = recentCheckins(s);
  if (!recent.length){
    return signal("refeicoes_fora_plano", "Refeições fora do plano", "insuficiente",
      "Sem check-ins suficientes para avaliar refeições fora do plano.",
      "Últimos " + SIGNAL_RECENT_CHECKINS + " check-ins", "checkins");
  }
  var total = recent.reduce(function(a,c){ return a + (c.mealsOff||0); }, 0);
  return signal("refeicoes_fora_plano", "Refeições fora do plano", total > SIGNAL_MEALS_OFF_LIMIT ? "atencao" : "positivo",
    total + " refeições fora do plano nos últimos " + recent.length + " check-ins.",
    "Últimos " + recent.length + " check-ins", "checkins");
}

function signalAdaptacoes(s){
  // Estas contagens vêm de ações que o próprio aluno registou (substituir,
  // ignorar, reagendar, marcar flexível) — são um autorrelato, não uma
  // auditoria: útil para perceber o dia a dia, não uma verdade inquestionável.
  var summary = computeAdaptationSummary(s, SIGNAL_ADAPTATION_DAYS);
  var total = Object.keys(summary).reduce(function(a,k){ return a + summary[k]; }, 0);
  return signal("adaptacoes", "Padrões de adaptação", total >= SIGNAL_ADAPTATION_LIMIT ? "atencao" : "positivo",
    total > 0 ? (total + " ações de adaptação registadas pelo aluno nos últimos " + SIGNAL_ADAPTATION_DAYS + " dias.") : ("Sem ações de adaptação registadas pelo aluno nos últimos " + SIGNAL_ADAPTATION_DAYS + " dias."),
    "Últimos " + SIGNAL_ADAPTATION_DAYS + " dias", "historico");
}

function signalPlanoAtivo(s){
  if (!s.meals || !s.meals.length){
    return signal("plano_ativo", "Plano ativo", "atencao", "Sem refeições definidas no plano.", "Estado atual do plano", "plano", "high");
  }
  if (!s.targets || !(s.targets.kcal > 0)){
    return signal("plano_ativo", "Plano ativo", "atencao", "Sem alvo de calorias definido.", "Estado atual do plano", "plano", "high");
  }
  return signal("plano_ativo", "Plano ativo", "positivo", "Plano ativo com " + s.meals.length + " refeições definidas.", "Estado atual do plano", "plano");
}

// um indicador que rebente (dados antigos ou mal formados) nunca pode deitar abaixo o dashboard inteiro
function safeSignal(fn, s){
  try { return fn(s); }
  catch (e) { return signal("erro", "Indicador indisponível", "insuficiente", "Não foi possível calcular este indicador com os dados registados.", "—", "perfil"); }
}
function computeStudentSignals(s){
  return [
    WEEKLY_CHECKIN_ENABLED ? safeSignal(signalCheckin, s) : null,
    safeSignal(signalPlanoAtivo, s),
    safeSignal(signalAdherence, s),
    safeSignal(signalWeight, s),
    safeSignal(signalHungerEnergy, s),
    safeSignal(signalTreinos, s),
    safeSignal(signalPesagem, s),
    safeSignal(signalInatividadeTreino, s),
    safeSignal(signalRecuperacao, s),
    safeSignal(signalSessoes, s),
    safeSignal(signalProgressaoCarga, s),
    safeSignal(signalMealsOff, s),
    safeSignal(signalAdaptacoes, s)
  ].filter(Boolean);
}

var DASH_ALERTS_ENABLED = false; // os alertas das linhas e do quadrado «Alertas» foram retirados do painel
function computeDashboardAlerts(s){
  if (!DASH_ALERTS_ENABLED) return [];
  if (isStudioOnly(s)) return s.alerts || []; // sem app, não há sinais de uso a avaliar
  var computed = computeStudentSignals(s).filter(function(sig){ return sig.status === "atencao"; }).map(function(sig){
    return { type: sig.severity === "high" ? "critical" : "warn", text: sig.text };
  });
  return (s.alerts || []).concat(computed);
}

/* ---------- Badges de ação no dashboard do profissional ----------
   Regras sobre os sinais já calculados (computeStudentSignals) e sobre os registos do aluno, para o profissional ver de relance
   quem precisa de contacto, quem está encalhado apesar de treinar bem e quem está pronto para progredir. */
var BADGE_NO_RECORD_WARN_DAYS = 7;
var BADGE_NO_RECORD_CRITICAL_DAYS = 14;
var BADGE_HIGH_ADHERENCE = 8.5;
var BADGE_ADHERENCE_DROP = 1.5;
// dias desde o registo mais recente do aluno (check-in, pesagem ou sessão de treino); null se nunca registou nada
function daysSinceLastRecord(s){
  var dates = (s.checkins || []).map(function(c){ return c.date; })
    .concat((s.weights || []).map(function(w){ return w.date; }))
    .concat((s.workoutLogs || []).map(function(l){ return l.date; })).filter(Boolean).sort();
  return dates.length ? daysSinceDate(dates[dates.length - 1]) : null;
}
function avgAdherence(list){ return list.length ? list.reduce(function(a, c){ return a + (Number(c.adherence) || 0); }, 0) / list.length : null; }
function computeCoachBadges(s){
  if (isStudioOnly(s)) return [];
  var by = {};
  computeStudentSignals(s).forEach(function(x){ by[x.key] = x; });
  var out = [], idle = daysSinceLastRecord(s);
  if (idle == null) out.push({key: "sem-registos", label: "Sem registos", tone: "", hint: "O aluno ainda não registou check-ins, pesagens nem treinos."});
  else if (idle >= BADGE_NO_RECORD_WARN_DAYS) out.push({key: "sem-registos", label: "Sem registos há " + idle + " d", tone: idle >= BADGE_NO_RECORD_CRITICAL_DAYS ? "critical" : "warn", hint: "Último check-in, pesagem ou treino registado " + daysAgoLabel(idle) + ". Vale a pena contactar."});
  var stalled = !!(by.peso && by.peso.status === "atencao" && /estagnad/.test(by.peso.text));
  var training = (by.progressao_carga && by.progressao_carga.status === "positivo") || (by.sessoes && by.sessoes.status === "positivo");
  if (stalled && training) out.push({key: "estagnado-a-treinar", label: "Peso estagnado, treino a evoluir", tone: "warn", hint: "O treino está a correr bem mas o peso não se mexe: revê as calorias ou considera recomposição corporal."});
  else if (stalled) out.push({key: "estagnado", label: "Peso estagnado", tone: "warn", hint: by.peso.text});
  var recent = (s.checkins || []).slice(-3), before = (s.checkins || []).slice(-6, -3);
  var now = avgAdherence(recent), prev = avgAdherence(before);
  if (now != null && prev != null && prev - now >= BADGE_ADHERENCE_DROP) out.push({key: "adesao-a-cair", label: "Adesão a cair", tone: "warn", hint: "Adesão média de " + prev.toFixed(1).replace(".", ",") + " para " + now.toFixed(1).replace(".", ",") + " /10 nos últimos check-ins."});
  else if (now != null && recent.length >= 2 && now >= BADGE_HIGH_ADHERENCE && (idle == null || idle < BADGE_NO_RECORD_WARN_DAYS)) out.push({key: "alta-adesao", label: "Alta adesão", tone: "good", hint: "Adesão média de " + now.toFixed(1).replace(".", ",") + "/10: bom momento para dar mais autonomia ou progredir."});
  var dl = deloadSuggestion(s);
  if (dl) out.push({key: "deload", label: dl.level === "sugerir" ? "Sugerir deload" : "Considerar deload", tone: dl.level === "sugerir" ? "warn" : "", hint: dl.reasons.join("; ")});
  var ready = trainingProgramOf(s).days.reduce(function(n, d){ return n + d.exercises.filter(function(e){ return overloadSuggestion(s, e); }).length; }, 0);
  if (ready) out.push({key: "sobrecarga", label: ready === 1 ? "Pronto para subir carga" : ready + " exercícios para subir carga", tone: "good", hint: "Atingiu a meta superior de repetições nas últimas sessões: vê a sugestão de sobrecarga em Treino."});
  return out;
}
function coachBadgesHtml(badges){
  return (badges || []).map(function(b){ return "<span class=\"pill " + b.tone + "\" title=\"" + escapeHtml(b.hint) + "\">" + escapeHtml(b.label) + "</span>"; }).join("");
}

/* ---------- Pequenos auxiliares partilhados (o núcleo e a Gestão usam-nos) ---------- */
var PACK_ENDING_SESSIONS = 2;        // "a acabar": restam estas sessões ou menos...
var ABSENCE_WINDOW_DAYS = 30, ABSENCE_ALERT = 2;
function eur(n){ return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace(".", ",") + " €"; }
function pad2(n){ return (n < 10 ? "0" : "") + n; }
function localTodayISO(){ var d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }

/* ---------- «Eu»: a minha ficha (alimentação e treino), na app de Acompanhamento ---------- */
var ME_LOCAL_KEY = "evolve.me";
var meState = {id: null, loaded: false};
function loadMe(){
  if (meState.loaded) return Promise.resolve(true);
  var done = function(id){ meState.id = typeof id === "string" ? id : null; meState.loaded = true; return true; };
  var fail = function(){ meState.id = null; return false; }; // falhou a leitura: não fica em cache (tenta de novo no próximo toque)
  if (!sbReady){ try { return Promise.resolve(done(localStorage.getItem(ME_LOCAL_KEY))); } catch (e) { return Promise.resolve(done(null)); } }
  return Promise.resolve(sb.from("studio_settings").select("value").eq("key", "personal").maybeSingle().then(function(r){ return r; })).then(function(r){
    if (r && r.error) return fail();
    return done(r && r.data && r.data.value ? r.data.value.studentId : null);
  }, fail);
}
function saveMe(){
  if (!sbReady){ try { localStorage.setItem(ME_LOCAL_KEY, meState.id || ""); } catch (e) {} return Promise.resolve({}); }
  var row = {key: "personal", value: {studentId: meState.id || null}, updated_at: new Date().toISOString()};
  return Promise.resolve(sb.from("studio_settings").upsert(row).then(function(r){ return r; })).then(function(res){
    return res && res.error ? {error: "Não foi possível guardar (a migração 0025 já foi corrida?)."} : {};
  }, function(){ return {error: "Não foi possível guardar — verifica a ligação."}; });
}
function openMeModal(){
  var studs = visibleStudentsForDashboard().slice().sort(function(a, b){ return String(a.name).localeCompare(String(b.name), "pt"); });
  var sheet = openModal("<div class=\"mtitle\">Quem és tu na app?</div><p class=\"muted-p\" style=\"margin-bottom:10px;\">Escolhe a tua própria ficha para teres a tua alimentação e o teu treino aqui. Se ainda não tens ficha, usa «Convidar aluno» no menu Alunos com o teu e-mail e volta aqui.</p>" +
    "<div class=\"student-search\" style=\"margin-bottom:10px;\"><span aria-hidden=\"true\">🔎</span><input type=\"search\" id=\"meFilter\" placeholder=\"Procurar…\" autocomplete=\"off\" aria-label=\"Procurar ficha\"></div>" +
    "<div id=\"meList\" style=\"max-height:48vh; overflow:auto;\">" + studs.map(function(st){ return "<button type=\"button\" class=\"btn\" data-me=\"" + escapeHtml(st.id) + "\" data-mename=\"" + escapeHtml(exLibFold(st.name)) + "\" style=\"width:100%; text-align:left; min-height:44px; margin-bottom:6px;\">" + escapeHtml(st.name) + "</button>"; }).join("") + "</div>");
  sheet.querySelector("#meFilter").addEventListener("input", function(e){ var q = exLibFold(e.target.value); sheet.querySelectorAll("[data-me]").forEach(function(b){ b.hidden = !!q && !nameStartsWithQuery(b.getAttribute("data-mename"), q); }); });
  sheet.querySelectorAll("[data-me]").forEach(function(b){ b.addEventListener("click", function(){
    meState.id = b.getAttribute("data-me");
    saveMe().then(function(r){ if (r.error){ showToast("⚠ " + r.error); return; } closeModal(); goToMe(); });
  }); });
}
function goToMe(){
  var st = meState.id ? findStudent(meState.id) : null;
  if (!st){ openMeModal(); return; }
  state.proSelectedId = st.id; state.proTab = "plano"; renderProShell(); try { window.scrollTo(0, 0); } catch (e) {}
}


/* ---------- Gestão (gestao.js): carregada à parte e só pelo profissional ----------
   O ficheiro tem o código do Estúdio e dos Contratos. É avaliado aqui dentro (eval direto) para usar o mesmo scope da app; o que o núcleo
   precisa de chamar fica em G. Os alunos nunca o descarregam. Se falhar (sem rede na primeira vez), a Gestão fica indisponível e o resto da app funciona. */
var G = {loaded: false};
var gestaoPromise = null;
function loadGestao(){
  if (G.loaded) return Promise.resolve(true);
  if (gestaoPromise) return gestaoPromise;
  gestaoPromise = Promise.resolve().then(function(){ return fetch("gestao.js", {cache: "no-cache"}); }).then(function(r){
    if (!r || !r.ok) throw new Error("gestao.js " + (r && r.status));
    return r.text();
  }).then(function(code){
    eval(code + "\n//# sourceURL=gestao.js");
    return !!G.loaded;
  }).catch(function(){ gestaoPromise = null; return false; });
  return gestaoPromise;
}
// depois de carregar tarde (o arranque não a conseguiu): lê também os dados do estúdio, senão os ecrãs mostravam «sem pacotes»
function gestaoWithData(ok){
  if (!ok || G.studio.loaded) return Promise.resolve(ok);
  return G.studioRefresh().then(function(){ return true; }, function(){ return true; });
}
// corre fn() com a Gestão pronta: de imediato se já estiver carregada, senão depois de a carregar (nada acontece se falhar)
function whenGestao(fn){
  if (G.loaded) return Promise.resolve(fn());
  return loadGestao().then(function(ok){ return ok ? fn() : null; });
}
// abre uma vista da Gestão (carrega gestao.js na primeira vez)
function gestaoGo(view, closeContract){
  state.proSelectedId = null;
  loadGestao().then(function(ok){
    if (!ok){ showToast("Não foi possível abrir a Gestão — verifica a ligação."); return; }
    G.enter(view, closeContract); renderProShell();
  });
}
function renderGestaoMain(view){
  var main = document.getElementById("proMain");
  if (!G.loaded){
    main.innerHTML = "<p class=\"muted-p\">A carregar…</p>";
    loadGestao().then(function(ok){
      if (!ok){ main.innerHTML = "<p class=\"muted-p\">Não foi possível abrir a Gestão. Verifica a ligação e volta a tentar.</p><button type=\"button\" class=\"btn btn-sm\" id=\"gestaoRetry\">Tentar outra vez</button>"; var rb = document.getElementById("gestaoRetry"); if (rb) rb.addEventListener("click", function(){ renderGestaoMain(view); }); return; }
      if (state.proView === view && !state.proSelectedId) renderProShell();
    });
    return;
  }
  if (view === "contracts") G.renderProContractsMain(); else G.renderProStudioMain();
}


/* ---------- Retenção: quem contactar hoje, onboarding de alunos novos e pulso do estúdio ----------
   Tudo calculado no telemóvel/computador a partir dos dados que a app já tem (registos, check-ins, treinos, pedidos de ajuda).
   O telefone e o registo de contactos (migração 0022) servem para não contactar duas vezes a mesma pessoa e para abrir o WhatsApp
   com a mensagem já escrita — a app nunca envia mensagens sozinha. */
var CONTACT_RECENT_DAYS = 3;       // quem foi contactado há menos disto não volta à lista
var CONTACT_SNOOZE_DAYS = 7;
var CONTACT_QUEUE_MAX = 8;
var CONTACT_LOG_MAX = 50;
var ONBOARDING_WINDOW_DAYS = 30;   // um aluno é "novo" durante este tempo
var ONBOARDING_STALL_DAYS = 7;     // sem nenhum registo passado este tempo = onboarding parado
var PLAN_OLD_DAYS = 42;
var CHECKIN_LATE_DAYS = 10;
var WEEKLY_CHECKIN_ENABLED = false; // o check-in semanal foi retirado da app (os dados antigos continuam no histórico)

var CONTACT_REASONS = {
  "pedido-ajuda": {label: "Pedido de ajuda por tratar", template: "Olá {nome}! Recebi o teu pedido na app e já estou a tratar disso. Respondo-te ainda hoje."},
  "onboarding": {label: "Onboarding parado", template: "Olá {nome}! Bem-vindo(a) à EVOLVE! Já conseguiste abrir a app e ver o teu plano? Se tiveres alguma dúvida nesta primeira semana, diz-me — estou aqui para ajudar."},
  "sem-registos": {label: "Sem registos", template: "Olá {nome}! Reparei que há uns dias não registas nada na app. Está tudo bem? Se precisares de ajustar o plano ou de ajuda para retomar, diz-me."},
  "adesao-a-cair": {label: "Adesão a cair", template: "Olá {nome}! Vi que as últimas semanas têm sido mais difíceis de cumprir. Queres que ajustemos alguma coisa para ficar mais fácil de manter?"},
  "sem-checkin": {label: "Check-in em atraso", template: "Olá {nome}! Falta o check-in desta semana na app — demora 1 minuto e ajuda-me a ajustar o teu plano à tua semana."},
  "estagnado": {label: "Peso estagnado", template: "Olá {nome}! O peso está parado há algumas semanas. Vamos rever o plano juntos? Diz-me quando te dá jeito falar."},
  "plano-antigo": {label: "Plano sem ajustes há semanas", template: "Olá {nome}! Já passaram algumas semanas desde o último ajuste do teu plano. Queres marcar uma revisão rápida?"},
  "aniversario": {label: "Faz anos hoje", template: "Parabéns, {nome}! 🎉 Que este novo ano venha cheio de saúde e energia. Um abraço da equipa EVOLVE!"},
  "boa-noticia": {label: "Boa notícia para partilhar", template: "Olá {nome}! Só para te dizer que estás a fazer um excelente trabalho — os teus registos mostram uma evolução muito boa. Continua assim! 💪"},
  "pagamento-atrasado": {label: "Pagamento em atraso", template: "Olá {nome}! Só um lembrete simpático: o pagamento de {valor}, com vencimento a {data}, ainda está por regularizar. Podes fazê-lo por MB WAY ou transferência. Qualquer dúvida, diz-me!"},
  "pacote-a-acabar": {label: "Pacote a acabar", template: "Olá {nome}! O teu pacote está quase a acabar ({restam}). Queres que prepare a renovação para não perderes o ritmo?"},
  "faltas": {label: "Faltas seguidas", template: "Olá {nome}! Notei que faltaste a algumas sessões nas últimas semanas. Está tudo bem? Se precisares de mudar os horários, ajusto contigo."},
  "generico": {label: "Contacto", template: "Olá {nome}! Como estás a correr a semana? Diz-me se precisas de alguma coisa."}
};

function studentFirstName(s){ return String(s && s.name || "").trim().split(/\s+/)[0] || ""; }
// 9 dígitos portugueses (fixo 2xx ou móvel 9xx) ganham o indicativo 351; com + ou 00 mantém-se o país indicado
function normalizePhone(raw){
  var t = String(raw == null ? "" : raw).trim();
  if (!t) return {ok: false, digits: ""};
  var plus = /^\+/.test(t) || /^00/.test(t);
  var d = t.replace(/\D/g, "");
  if (/^00/.test(t)) d = d.replace(/^00/, "");
  if (!plus && /^[29]\d{8}$/.test(d)) d = "351" + d;
  return {ok: d.length >= 9 && d.length <= 15, digits: d};
}
function whatsappUrl(phone, text){
  var n = normalizePhone(phone);
  return n.ok ? "https://wa.me/" + n.digits + (text ? "?text=" + encodeURIComponent(text) : "") : "";
}
function contactMessageFor(reasonKey, s, vars){
  var r = CONTACT_REASONS[reasonKey] || CONTACT_REASONS.generico;
  vars = vars || {};
  return r.template.replace(/\{nome\}/g, studentFirstName(s)).replace(/\{(valor|data|restam)\}/g, function(m, k){ return vars[k] != null ? vars[k] : ""; });
}

function contactEntries(s, kind){ return (Array.isArray(s.contactLog) ? s.contactLog : []).filter(function(e){ return e && e.kind === kind && isIsoDate(e.date); }); }
function lastContactOf(s){
  var list = contactEntries(s, "contacto").sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  var e = list[list.length - 1];
  return e ? {date: e.date, daysAgo: daysSinceDate(e.date), channel: e.channel || "", reason: e.reason || ""} : null;
}
function isSnoozed(s, today){
  return contactEntries(s, "adiado").some(function(e){ return isIsoDate(e.until) && e.until >= today; });
}
function addDaysISO(iso, n){ var d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function contactLogAdd(s, entry){
  ensureSyncBaseline(s); // antes de alterar, para só se gravar a coluna do registo de contactos
  var log = (Array.isArray(s.contactLog) ? s.contactLog : []).concat([Object.assign({date: todayISO()}, entry)]);
  s.contactLog = log.slice(-CONTACT_LOG_MAX);
  persistStudent(s);
}

// Onboarding: o que falta fazer a um aluno novo (só alunos com data de criação conhecida, nos primeiros 30 dias)
function onboardingOf(s){
  if (isStudioOnly(s)) return {steps: [], done: 0, total: 0, complete: true, daysSince: null, inOnboarding: false, stalled: false};
  var hasProgram = trainingProgramOf(s).days.some(function(d){ return d.exercises.length > 0; });
  var steps = [
    {key: "plano", label: "Plano de alimentação", done: (s.meals || []).length > 0},
    {key: "treino", label: "Programa de treino", done: hasProgram},
    {key: "convite", label: "Conta criada pelo aluno", done: !!s.authUserId, na: !s.inviteEmail},
    {key: "pesagem", label: "Primeira pesagem", done: (s.weights || []).length > 0},
    {key: "checkin", label: "Primeiro check-in", done: (s.checkins || []).length > 0},
    {key: "sessao", label: "Primeira sessão de treino", done: (s.workoutLogs || []).length > 0, na: !hasProgram},
    {key: "fotos", label: "Fotos iniciais", done: (s.photos || []).length > 0, na: !s.allowPhotos}
  ];
  var counted = steps.filter(function(x){ return !x.na; });
  var done = counted.filter(function(x){ return x.done; }).length;
  var created = s.createdAt ? String(s.createdAt).slice(0, 10) : null;
  var days = isIsoDate(created) ? daysSinceDate(created) : null;
  var complete = done === counted.length;
  var inOnboarding = days != null && days <= ONBOARDING_WINDOW_DAYS && !complete;
  var records = (s.checkins || []).length + (s.workoutLogs || []).length;
  return {steps: steps, done: done, total: counted.length, complete: complete, daysSince: days, inOnboarding: inOnboarding,
    stalled: inOnboarding && days >= ONBOARDING_STALL_DAYS && records === 0};
}

function isBirthdayToday(s, today){
  return isIsoDate(s.birthDate) && s.birthDate.slice(5) === today.slice(5);
}
function lastPlanChangeDays(s){
  var dates = (s.planHistory || []).map(function(h){ return h && h.date; }).filter(isIsoDate).sort();
  return dates.length ? daysSinceDate(dates[dates.length - 1]) : null;
}
// Motivos para contactar um aluno, do mais urgente para o menos urgente: [{key, label, weight, hint}]
function contactReasonsFor(s, today){
  var out = [], badges = computeCoachBadges(s), by = {};
  badges.forEach(function(b){ by[b.key] = b; });
  var ob = onboardingOf(s), idle = daysSinceLastRecord(s);
  var help = pendingHelpFor(s.id);
  if (help) out.push({key: "pedido-ajuda", label: help === 1 ? "1 pedido de ajuda por tratar" : help + " pedidos de ajuda por tratar", weight: 100, hint: "O aluno pediu ajuda na app."});
  if (ob.stalled) out.push({key: "onboarding", label: "Sem nenhum registo há " + ob.daysSince + " dias (aluno novo)", weight: 85, hint: "Ainda não fez nenhum check-in nem treino."});
  if (by["sem-registos"] && !ob.inOnboarding){
    var crit = by["sem-registos"].tone === "critical" || idle == null;
    out.push({key: "sem-registos", label: idle == null ? "Nunca registou nada" : "Sem registos há " + idle + " dias", weight: crit ? 90 : 55, hint: by["sem-registos"].hint});
  }
  if (by["adesao-a-cair"] && !noNutritionOf(s)) out.push({key: "adesao-a-cair", label: "Adesão a cair", weight: 50, hint: by["adesao-a-cair"].hint});
  var late = isStudioOnly(s) ? 999 : computeLastCheckinDaysAgo(s);
  if (WEEKLY_CHECKIN_ENABLED && late !== 999 && late >= CHECKIN_LATE_DAYS && !by["sem-registos"]) out.push({key: "sem-checkin", label: "Check-in há " + late + " dias", weight: 35, hint: "Último check-in há " + late + " dias."});
  if (!noNutritionOf(s) && (by["estagnado"] || by["estagnado-a-treinar"])) out.push({key: "estagnado", label: "Peso estagnado", weight: by["estagnado"] ? 35 : 25, hint: (by["estagnado"] || by["estagnado-a-treinar"]).hint});
  var planDays = isStudioOnly(s) ? null : lastPlanChangeDays(s);
  if (planDays != null && planDays >= PLAN_OLD_DAYS && !ob.inOnboarding && !noNutritionOf(s)) out.push({key: "plano-antigo", label: "Plano sem ajustes há " + Math.floor(planDays / 7) + " semanas", weight: 20, hint: "Última alteração ao plano há " + planDays + " dias."});
  if (isBirthdayToday(s, today)) out.push({key: "aniversario", label: "Faz anos hoje", weight: 25, hint: "Um parabéns fortalece a relação."});
  if (by["sobrecarga"] || by["alta-adesao"]) out.push({key: "boa-noticia", label: by["sobrecarga"] ? "Pronto para subir carga" : "Adesão muito boa", weight: 15, hint: "Uma mensagem positiva também retém alunos."});
  return out.sort(function(a, b){ return b.weight - a.weight; });
}

// A lista "quem contactar hoje": exclui inativos, quem foi contactado há pouco e quem foi adiado
function computeContactQueue(students, today){
  today = today || todayISO();
  var items = [], recent = 0, snoozed = 0;
  students.forEach(function(s){
    if (!isStudentActive(s)) return;
    var reasons = contactReasonsFor(s, today);
    if (!reasons.length) return;
    if (isSnoozed(s, today)){ snoozed++; return; }
    var last = lastContactOf(s);
    var urgent = reasons[0].weight >= 100;
    if (last && last.daysAgo != null && last.daysAgo < CONTACT_RECENT_DAYS && !urgent){ recent++; return; }
    var idle = daysSinceLastRecord(s);
    items.push({s: s, reasons: reasons, score: reasons[0].weight + Math.min(10, (reasons.length - 1) * 3), idle: idle == null ? 999 : idle, last: last});
  });
  // empate: quem está há mais tempo sem registar primeiro
  items.sort(function(a, b){ return b.score - a.score || b.idle - a.idle || String(a.s.name).localeCompare(String(b.s.name), "pt"); });
  return {items: items, shown: items.slice(0, CONTACT_QUEUE_MAX), more: Math.max(0, items.length - CONTACT_QUEUE_MAX), recent: recent, snoozed: snoozed};
}

// Pulso do estúdio: poucos números que dizem se a retenção está saudável
function studioPulse(students, today){
  today = today || todayISO();
  var active = students.filter(isStudentActive).filter(function(s){ return !isStudioOnly(s); }); // só conta quem usa a app
  var withRecords = 0, atRisk = 0, adh = [], sessions = 0, newcomers = 0, activated = 0;
  active.forEach(function(s){
    var idle = daysSinceLastRecord(s);
    if (idle != null && idle <= 7) withRecords++;
    var reasons = contactReasonsFor(s, today);
    if (reasons.some(function(r){ return r.key === "onboarding" || r.key === "adesao-a-cair" || (r.key === "sem-registos" && r.weight >= 55); })) atRisk++;
    var a = avgAdherence((s.checkins || []).slice(-3));
    if (a != null) adh.push(a);
    sessions += sessionsInLastDays(s, 7).length;
    var ob = onboardingOf(s);
    if (ob.daysSince != null && ob.daysSince <= ONBOARDING_WINDOW_DAYS){
      newcomers++;
      var firstLog = (s.workoutLogs || []).map(function(l){ return l.date; }).filter(isIsoDate).sort()[0];
      var created = String(s.createdAt).slice(0, 10);
      if (firstLog && Math.round((new Date(firstLog + "T00:00:00Z") - new Date(created + "T00:00:00Z")) / 86400000) <= 7) activated++;
    }
  });
  return {
    active: active.length,
    recordsPct: active.length ? Math.round(withRecords / active.length * 100) : null,
    atRisk: atRisk,
    adherence: adh.length ? Math.round(adh.reduce(function(x, y){ return x + y; }, 0) / adh.length * 10) / 10 : null,
    sessions7d: sessions,
    newcomers: newcomers, activated: activated
  };
}

var CONTACT_CHANNEL_LABELS = {whatsapp: "WhatsApp", telefone: "Telefone", presencial: "Presencial", outro: "Outro"};
function tplContactQueue(students){
  var q = computeContactQueue(students);
  var open = contactQueueOpen();
  var html = "<div class=\"card contact-queue\" id=\"contactQueue\"><button type=\"button\" id=\"contactToggle\" aria-expanded=\"" + (open ? "true" : "false") + "\" style=\"display:flex; align-items:center; gap:10px; width:100%; background:none; border:0; padding:0; min-height:44px; cursor:pointer; color:inherit; text-align:left;\">" +
    "<span class=\"eyebrow\" style=\"flex:1; margin:0;\">Hoje: quem contactar</span>" +
    (q.shown.length ? "<span class=\"pill critical\" id=\"contactCount\">" + q.items.length + "</span>" : "<span class=\"pill good\">0</span>") +
    "<span aria-hidden=\"true\" style=\"display:inline-block; transition:transform .15s; transform:rotate(" + (open ? "90" : "0") + "deg);\">›</span></button>" +
    "<div id=\"contactBody\"" + (open ? "" : " hidden") + " style=\"margin-top:6px;\">";
  if (!q.shown.length){
    html += "<p class=\"muted-p\">✓ Ninguém precisa de contacto hoje.</p>";
  } else {
    html += "<p class=\"muted-p\" style=\"margin-bottom:10px;\">" + plural(q.items.length, "aluno a precisar", "alunos a precisar") + " de uma mensagem, do mais urgente para o menos urgente.</p>";
    q.shown.forEach(function(it){
      var top = it.reasons[0];
      html += "<div class=\"history-row contact-row\" style=\"align-items:center;\"><div style=\"min-width:0;flex:1;\">" +
        "<div class=\"hlabel\"><button type=\"button\" class=\"wl-info\" data-open-student=\"" + escapeHtml(it.s.id) + "\">" + escapeHtml(it.s.name) + "</button></div>" +
        "<div class=\"muted-p\" style=\"font-size:0.76rem;\">" + escapeHtml(top.label) + (it.reasons.length > 1 ? " · +" + (it.reasons.length - 1) : "") +
        (it.last ? " · contactado há " + (it.last.daysAgo === 0 ? "0 dias" : it.last.daysAgo + (it.last.daysAgo === 1 ? " dia" : " dias")) : "") + "</div></div>" +
        "<button type=\"button\" class=\"btn btn-sm primary\" data-contact=\"" + escapeHtml(it.s.id) + "\" data-reason=\"" + escapeHtml(top.key) + "\">Contactar</button></div>";
    });
    if (q.more) html += "<p class=\"muted-p\" style=\"margin-top:8px;\">+ " + plural(q.more, "aluno", "alunos") + " na lista de alertas abaixo.</p>";
  }
  var notes = [];
  if (q.recent) notes.push(plural(q.recent, "contactado", "contactados") + " nos últimos " + CONTACT_RECENT_DAYS + " dias");
  if (q.snoozed) notes.push(plural(q.snoozed, "adiado", "adiados"));
  if (notes.length) html += "<p class=\"muted-p\" style=\"margin-top:8px; font-size:0.74rem;\">Fora da lista: " + notes.join(" · ") + ".</p>";
  return html + "</div></div>";
}
var CONTACT_OPEN_KEY = "evolve.contactQueueOpen";
function contactQueueOpen(){ if (typeof state.contactQueueOpen === "boolean") return state.contactQueueOpen; try { state.contactQueueOpen = localStorage.getItem(CONTACT_OPEN_KEY) === "1"; } catch (e) { state.contactQueueOpen = false; } return state.contactQueueOpen; }
function setContactQueueOpen(v){ state.contactQueueOpen = !!v; try { localStorage.setItem(CONTACT_OPEN_KEY, v ? "1" : "0"); } catch (e) {} }
var ONBOARDING_CARD_ENABLED = false; // a lista «Alunos novos» foi retirada do painel
function tplOnboardingCard(students){
  var rows = students.filter(isStudentActive).map(function(s){ return {s: s, ob: onboardingOf(s)}; }).filter(function(r){ return r.ob.inOnboarding; })
    .sort(function(a, b){ return (b.ob.stalled - a.ob.stalled) || (a.ob.done / a.ob.total) - (b.ob.done / b.ob.total); });
  if (!rows.length) return "";
  var html = "<div class=\"card\" id=\"onboardingCard\"><div class=\"eyebrow\" style=\"margin-bottom:4px;\">Alunos novos (primeiros " + ONBOARDING_WINDOW_DAYS + " dias)</div>";
  rows.forEach(function(r){
    var missing = r.ob.steps.filter(function(x){ return !x.na && !x.done; }).slice(0, 3).map(function(x){ return x.label; });
    html += "<div class=\"history-row\" style=\"align-items:center;\"><div style=\"min-width:0;flex:1;\">" +
      "<div class=\"hlabel\"><button type=\"button\" class=\"wl-info\" data-open-student=\"" + escapeHtml(r.s.id) + "\">" + escapeHtml(r.s.name) + "</button>" +
      (r.ob.stalled ? " <span class=\"pill critical\">parado</span>" : "") + "</div>" +
      "<div class=\"muted-p\" style=\"font-size:0.76rem;\">Há " + r.ob.daysSince + (r.ob.daysSince === 1 ? " dia" : " dias") + " · falta: " + escapeHtml(missing.join(", ")) + "</div>" +
      "<div class=\"bar-track\" style=\"margin-top:6px;\"><div class=\"bar-fill\" style=\"width:" + Math.round(r.ob.done / r.ob.total * 100) + "%\"></div></div></div>" +
      "<div class=\"hval\">" + r.ob.done + "/" + r.ob.total + "</div></div>";
  });
  return html + "</div>";
}
var STUDIO_PULSE_ENABLED = false; // o «Pulso do estúdio» foi retirado do painel
function tplStudioPulse(students){
  var p = studioPulse(students);
  if (!p.active) return "";
  function kpi(label, value, hint){ return "<div class=\"pulse-kpi\" title=\"" + escapeHtml(hint) + "\"><div class=\"num\" style=\"font-size:1.25rem; font-weight:700;\">" + value + "</div><div class=\"muted-p\" style=\"font-size:0.72rem;\">" + label + "</div></div>"; }
  return "<details class=\"perfil-section\" id=\"studioPulse\" style=\"margin-bottom:14px;\"><summary class=\"eyebrow\">Pulso do estúdio</summary>" +
    "<div class=\"pulse-grid\" style=\"display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:12px; margin-top:12px;\">" +
      kpi("com registos (7 dias)", p.recordsPct == null ? "—" : p.recordsPct + "%", "Alunos ativos com algum registo (peso, check-in ou treino) nos últimos 7 dias.") +
      kpi("em risco", String(p.atRisk), "Sem registos há mais de uma semana, adesão a cair ou onboarding parado.") +
      kpi("adesão média", p.adherence == null ? "—" : String(p.adherence).replace(".", ",") + "/10", "Média da adesão dos 3 últimos check-ins de cada aluno.") +
      kpi("sessões (7 dias)", String(p.sessions7d), "Treinos registados pelos alunos na última semana.") +
      (p.newcomers ? kpi("alunos novos ativados", p.activated + "/" + p.newcomers, "Alunos dos últimos 30 dias que fizeram o 1.º treino na primeira semana.") : "") +
    "</div></details>";
}

function openContactModal(s, reasonKey, onDone){
  var reasons = contactReasonsFor(s, todayISO());
  var reason = CONTACT_REASONS[reasonKey] ? reasonKey : "generico";
  var label = (reasons.filter(function(r){ return r.key === reason; })[0] || {label: CONTACT_REASONS[reason].label}).label;
  var hasPhone = normalizePhone(s.phone).ok;
  var sheet = openModal("<div class=\"mtitle\">Contactar " + escapeHtml(s.name) + "</div>" +
    "<p class=\"muted-p\" style=\"margin-bottom:10px;\">" + escapeHtml(label) + "</p>" +
    "<div class=\"checkin-field\"><label for=\"ctMsg\">Mensagem (podes editar)</label><textarea id=\"ctMsg\" rows=\"5\">" + escapeHtml(contactMessageFor(reason, s, (reasons.filter(function(r){ return r.key === reason; })[0] || {}).vars)) + "</textarea></div>" +
    (hasPhone ? "<a class=\"btn primary\" id=\"ctWa\" href=\"#\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"display:block; text-align:center; text-decoration:none; margin-bottom:8px;\">Abrir no WhatsApp</a>"
      : "<div class=\"checkin-field\"><label for=\"ctPhone\">Sem telefone na ficha — acrescenta para abrir o WhatsApp</label><input type=\"tel\" id=\"ctPhone\" placeholder=\"912 345 678 ou +351…\" autocomplete=\"off\"></div>" +
        "<button type=\"button\" class=\"btn btn-sm\" id=\"ctSavePhone\" style=\"margin-bottom:8px;\">Guardar telefone</button>") +
    "<p class=\"muted-p\" id=\"ctErr\" style=\"color:var(--critical); display:none;\"></p>" +
    "<div class=\"checkin-field\"><label for=\"ctChannel\">Já contactei por</label><select id=\"ctChannel\" class=\"mini-select\" style=\"width:100%;\">" +
      Object.keys(CONTACT_CHANNEL_LABELS).map(function(k){ return "<option value=\"" + k + "\">" + CONTACT_CHANNEL_LABELS[k] + "</option>"; }).join("") + "</select></div>" +
    "<button type=\"button\" class=\"btn\" id=\"ctDone\" style=\"width:100%; margin-bottom:8px;\">✓ Marcar como contactado</button>" +
    "<button type=\"button\" class=\"btn\" id=\"ctSnooze\" style=\"width:100%;\">Adiar " + CONTACT_SNOOZE_DAYS + " dias</button>");
  var msg = sheet.querySelector("#ctMsg");
  function finish(text){ closeModal(); showToast(text); if (onDone) onDone(); }
  var wa = sheet.querySelector("#ctWa");
  if (wa){
    var sync = function(){ wa.setAttribute("href", whatsappUrl(s.phone, msg.value.trim())); };
    sync(); msg.addEventListener("input", sync);
    wa.addEventListener("click", function(){
      sync();
      contactLogAdd(s, {kind: "contacto", channel: "whatsapp", reason: reason});
      setTimeout(function(){ finish("✓ Contacto registado"); }, 300);
    });
  }
  var savePhone = sheet.querySelector("#ctSavePhone");
  if (savePhone) savePhone.addEventListener("click", function(){
    var raw = sheet.querySelector("#ctPhone").value, n = normalizePhone(raw), err = sheet.querySelector("#ctErr");
    if (!n.ok){ err.textContent = "Número inválido: indica 9 dígitos (ex.: 912 345 678) ou com indicativo (+351…)."; err.style.display = "block"; return; }
    ensureSyncBaseline(s);
    s.phone = raw.trim().slice(0, 30); persistStudent(s);
    closeModal(); openContactModal(s, reasonKey, onDone);
  });
  sheet.querySelector("#ctDone").addEventListener("click", function(){
    contactLogAdd(s, {kind: "contacto", channel: sheet.querySelector("#ctChannel").value, reason: reason});
    finish("✓ Contacto registado");
  });
  sheet.querySelector("#ctSnooze").addEventListener("click", function(){
    contactLogAdd(s, {kind: "adiado", reason: reason, until: addDaysISO(todayISO(), CONTACT_SNOOZE_DAYS)});
    finish("Adiado " + CONTACT_SNOOZE_DAYS + " dias");
  });
}


function signalPillClass(sig){
  if (sig.status === "atencao") return sig.severity === "high" ? "critical" : "warn";
  if (sig.status === "positivo") return "good";
  return "";
}
function signalStatusLabel(status){
  if (status === "atencao") return "Atenção";
  if (status === "positivo") return "Informação positiva";
  return "Dados insuficientes";
}

function tplProLeitura(s){
  var signals = computeStudentSignals(s);
  var html = "<div class=\"eyebrow\" style=\"margin-bottom:4px;\">Leitura do aluno</div>" +
    "<p class=\"muted-p\" style=\"margin-bottom:14px;\">Indicadores objetivos calculados a partir dos dados já registados — a interpretação e a decisão são sempre tuas.</p>";
  html += signals.map(function(sig){
    var tabLabel = (PRO_TABS.find(function(t){ return t[0] === sig.tab; }) || [null, sig.tab])[1];
    return "<div class=\"history-row\" style=\"align-items:flex-start; cursor:pointer;\" data-goto-tab=\"" + sig.tab + "\">" +
      "<div>" +
        "<div class=\"hlabel\">" + escapeHtml(sig.title) + "</div>" +
        "<div class=\"muted-p\" style=\"margin-top:2px;\">" + escapeHtml(sig.text) + "</div>" +
        "<div class=\"muted-p\" style=\"font-size:0.72rem; margin-top:2px;\">" + escapeHtml(sig.period) + " · ver em " + escapeHtml(tabLabel) + "</div>" +
      "</div>" +
      "<span class=\"pill " + signalPillClass(sig) + "\">" + signalStatusLabel(sig.status) + "</span>" +
    "</div>";
  }).join("");
  return html;
}

/* ---------- Histórico automático do plano: regista alterações feitas pelo profissional ----------
   planHistory guarda dois formatos, para não apagar os registos antigos:
   - legado (snapshot): {date, kcal, flex, label} — como já existia
   - evento (novo): {date, time, timestamp, type, summary, before, after}
   Só é preenchido a partir de ações explícitas do profissional (nunca a partir de renders). */
function logPlanEvent(s, type, summary, before, after){
  if (before !== undefined && after !== undefined && before === after) return; // sem alteração real: não duplica
  if (!s.planHistory) s.planHistory = [];
  var now = new Date();
  s.planHistory.push({
    date: todayISO(),
    time: String(now.getHours()).padStart(2,"0") + ":" + String(now.getMinutes()).padStart(2,"0"),
    timestamp: now.toISOString(),
    type: type,
    summary: summary,
    before: before,
    after: after
  });
}

function logMealAdded(s, m){
  logPlanEvent(s, "refeicao_criada", "Refeição adicionada: " + m.name + " — " + m.time, null, m.name + " — " + m.time);
}
function logMealRemoved(s, label){
  logPlanEvent(s, "refeicao_removida", "Refeição removida: " + label, label, null);
}
function logMealRenamed(s, oldName, newName){
  logPlanEvent(s, "refeicao_nome", "Nome alterado: " + oldName + " → " + newName, oldName, newName);
}
function logMealRescheduled(s, mealName, oldTime, newTime){
  logPlanEvent(s, "refeicao_horario", "Horário alterado: " + mealName + ", " + oldTime + " → " + newTime, oldTime, newTime);
}
function logFoodAdded(s, mealName, f){
  logPlanEvent(s, "alimento_adicionado", "Alimento adicionado: " + f.name + ", " + f.qty + ", " + mealName, null, f.name + ", " + f.qty);
}
function logFoodRemoved(s, mealName, f){
  logPlanEvent(s, "alimento_removido", "Alimento removido: " + f.name + ", " + f.qty + ", " + mealName, f.name + ", " + f.qty, null);
}
function logFoodEdited(s, mealName, oldFood, newFood){
  logPlanEvent(s, "alimento_editado", "Alimento alterado em " + mealName + ": " + oldFood.name + ", " + oldFood.qty + " → " + newFood.name + ", " + newFood.qty, oldFood.name + ", " + oldFood.qty, newFood.name + ", " + newFood.qty);
}
// Plano colado em texto: "Substituir o plano atual" apaga as refeições antes de aplicar a proposta
function clearPlanIfReplacing(el, s, draft){
  var box = el.querySelector("#pastedReplace");
  if (box && box.checked && draft.some(function(d){ return d.foods.length; })) s.meals = [];
}

// O plano colado é a referência: os alvos passam a ser o que o plano dá (nada a "ajustar" depois)
function setTargetsFromPlanIfAsked(el, s){
  var box = el.querySelector("#pastedTargets");
  if (!box || !box.checked) return;
  var tot = foodsTotals(s.meals.reduce(function(a, m){ return a.concat(m.foods); }, []));
  var newTargets = { kcal: Math.round(tot.kcal), protein: Math.round(tot.p), carbs: Math.round(tot.c), fat: Math.round(tot.f) };
  logTargetsChange(s, s.targets, newTargets);
  notePhaseManualChange(s, s.targets.kcal, newTargets.kcal);
  s.targets = newTargets;
  s.fromOnboarding = false;
  var ws = nutritionSafetyWarnings(Object.assign({}, s, {leanMass: latestLeanMass(s)}), newTargets);
  if (ws.length) showToast((ws[0].level === "critical" ? "⛔ " : "⚠ ") + ws[0].text);
}

function logTargetsChange(s, oldTargets, newTargets){
  var oldCarbs = oldTargets.carbs != null ? oldTargets.carbs : oldTargets.carbsMax;
  var oldFat = oldTargets.fat != null ? oldTargets.fat : oldTargets.fatMax;
  logPlanEvent(s, "kcal", "Calorias: " + oldTargets.kcal + " → " + newTargets.kcal + " kcal", oldTargets.kcal, newTargets.kcal);
  logPlanEvent(s, "protein", "Proteína: " + oldTargets.protein + " → " + newTargets.protein + " g", oldTargets.protein, newTargets.protein);
  logPlanEvent(s, "carbs", "Hidratos: " + oldCarbs + " → " + newTargets.carbs + " g", oldCarbs, newTargets.carbs);
  logPlanEvent(s, "fat", "Gordura: " + oldFat + " → " + newTargets.fat + " g", oldFat, newTargets.fat);
}
function logOverrideChange(s, key, oldChecked, newChecked){
  var pair = FLEX_OVERRIDE_CHECKBOXES.find(function(p){ return p[0] === key; });
  var label = pair ? pair[1] : key;
  logPlanEvent(s, "personalizacao", "Personalização: " + label + " → " + (newChecked ? "ativada" : "desativada"), !!oldChecked, !!newChecked);
}

function tplProHistorico(s){
  var html = "";
  var summary = computeAdaptationSummary(s, 7);
  var summaryKeys = Object.keys(summary);
  if (summaryKeys.length){
    html += "<div class=\"eyebrow\" style=\"margin-bottom:8px;\">Adaptações — últimos 7 dias</div>" +
      "<p class=\"muted-p\" style=\"margin-bottom:10px;\">Ações que o próprio aluno registou (substituir, ignorar, reagendar, marcar flexível) — um autorrelato para perceberes o dia a dia, não uma auditoria nem um problema por si só.</p>" +
      summaryKeys.map(function(k){
        return "<div class=\"history-row\"><div class=\"hlabel\">" + escapeHtml(Object.prototype.hasOwnProperty.call(ADAPTATION_TYPE_LABEL, k) ? ADAPTATION_TYPE_LABEL[k] : k) + "</div><div class=\"hval\">" + summary[k] + "</div></div>";
      }).join("") +
      "<div class=\"section-gap\"></div>";
  }
  html += "<div class=\"eyebrow\" style=\"margin-bottom:8px;\">Histórico de alterações ao plano</div>";
  var planEntries = (s.planHistory || []).slice().reverse(); // mais recentes primeiro
  if (!planEntries.length){
    html += "<p class=\"muted-p\">Ainda sem alterações registadas.</p>";
  }
  planEntries.forEach(function(p){
    if (p.type){
      html += "<div class=\"history-row\"><div><div class=\"hlabel\">" + escapeHtml(p.summary) + "</div></div>" +
        "<div class=\"hdate\">" + fmtDatePt(p.date) + (p.time ? " · " + p.time : "") + "</div></div>";
    } else {
      html += "<div class=\"history-row\"><div><div class=\"hlabel\">" + escapeHtml(p.label) + "</div><div class=\"hdate\">" + fmtDatePt(p.date) + "</div></div>" +
        "<div class=\"hval\">" + p.kcal + " kcal<br><span style=\"color:var(--muted); font-size:0.75rem;\">Flexibilidade " + p.flex + "</span></div></div>";
    }
  });
  return html;
}

// lê um conjunto de medidas do formulário. Com o modo "2–3 leituras" ligado cada local tem até 3 campos (_2 e _3 são as leituras extra):
// devolve o valor final (média de 2 ou mediana de 3), todas as leituras e os avisos de discrepância
function readMeasureSet(el, defs, prefix, tolerancePct, multiOn, unitLabel){
  var out = {values: {}, reads: {}, issues: []};
  defs.forEach(function(d){
    var ids = [prefix + d[2]];
    if (multiOn) ids.push(prefix + d[2] + "_2", prefix + d[2] + "_3");
    var nums = ids.map(function(id){ var inp = el.querySelector("#" + id); return inp ? parseFloat(inp.value) : NaN; }).filter(function(v){ return !isNaN(v); });
    if (!nums.length) return;
    out.reads[d[0]] = nums;
    var c = combineReadings(nums, tolerancePct);
    out.values[d[0]] = c ? c.value : nums[0]; // sem nenhuma leitura positiva fica o valor escrito, para a validação o recusar
    if (c && c.needsThird) out.issues.push(d[1] + ": as 2 leituras diferem " + ptNum(c.spreadPct, 1) + " % (mais de " + tolerancePct + " %): faz uma 3.ª medição e usa a mediana.");
    if (c && c.scattered) out.issues.push(d[1] + ": as 3 leituras estão muito dispersas (" + ptNum(c.spreadPct, 1) + " %): confirma a técnica.");
  });
  return out;
}
function multiReadOn(el, sel){ var cb = el.querySelector(sel); return !!(cb && cb.checked); }
function readSkinfoldSet(el){ return readMeasureSet(el, SKINFOLD_SITES, "sf", READING_TOLERANCE_PCT.skinfold, multiReadOn(el, "#mrSkin")); }
function readPerimeterSet(el){ return readMeasureSet(el, PERIMETER_FIELDS, "as", READING_TOLERANCE_PCT.perimeter, multiReadOn(el, "#mrPerim")); }
// valores finais (só os preenchidos)
function readSkinfoldInputs(el){ return readSkinfoldSet(el).values; }
function readPerimeterInputs(el){ return readPerimeterSet(el).values; }
// avisos de valores invulgares enquanto se escreve (não impedem de guardar)
function updateAnthroWarnings(s, el){
  var out = el.querySelector("#assessWarn");
  if (!out) return;
  var perims = readPerimeterInputs(el), sfs = readSkinfoldInputs(el);
  // os valores fora dos limites rígidos já são recusados ao guardar: aqui só os "invulgares"
  var inRange = {};
  Object.keys(perims).forEach(function(k){ var f = perimeterField(k); if (f && perims[k] >= f[4] && perims[k] <= f[5]) inRange[k] = perims[k]; });
  var sfOk = {};
  Object.keys(sfs).forEach(function(k){ if (sfs[k] >= SKINFOLD_MIN_MM && sfs[k] <= SKINFOLD_MAX_MM) sfOk[k] = sfs[k]; });
  var warns = readPerimeterSet(el).issues.concat(readSkinfoldSet(el).issues, anthroPlausibilityWarnings(inRange, sfOk, s.height));
  out.textContent = warns.length ? "⚠ " + warns.join(" ") : "";
}
// mostra, enquanto se escreve, que protocolo se aplica e a % de gordura estimada
function updateSkinfoldPreview(s, el){
  var out = el.querySelector("#sfPreview");
  if (!out) return;
  var sfs = readSkinfoldInputs(el);
  if (!Object.keys(sfs).length){ out.textContent = ""; return; }
  var sexSel = el.querySelector("#sfSex");
  var fake = {date: (el.querySelector("#asDate") || {}).value || todayISO(), skinfolds: sfs, sfProtocol: (el.querySelector("#sfProtocol") || {}).value, sfSex: sexSel ? sexSel.value : ""};
  var r = skinfoldResult(s, fake);
  if (!r) { out.textContent = ""; return; }
  var txt = r.protocol ? r.label + (r.bodyFat != null ? ": " + ptNum(r.bodyFat, 1) + " % de gordura (Σ " + ptNum(r.sum, 1) + " mm)" : "") : "";
  if (r.warnings.length) txt += (txt ? " · " : "") + r.warnings[0];
  out.textContent = txt;
}

// botões da ficha de Nutrição que não são do plano em si: fase de peso, creatina e PDF
function wireProPlanExtras(s, el){
  el.querySelectorAll("#phaseStart").forEach(function(b){ b.addEventListener("click", function(){ openPhaseSetupModal(s, function(){ renderProTabContent(s); }); }); });
  var phNow = el.querySelector("#phaseReviewNow");
  if (phNow) phNow.addEventListener("click", function(){
    var rv = computePhaseReview(s, localTodayISO(), {force: true});
    if (!rv){ showToast("Sem fase definida."); return; }
    if (!phaseNeedsAttention(rv)){ showToast(rv.text || "Nada a rever por agora."); return; }
    openPhaseReviewModal([{student: s, review: rv}], 0, function(){ renderProTabContent(s); });
  });
  var proPdf = el.querySelector("#proExportPdf");
  if (proPdf) proPdf.addEventListener("click", function(){ exportPlanPdf(s); });
  var crToggle = el.querySelector("#creatineToggle");
  if (crToggle) crToggle.addEventListener("click", function(){ setCreatineEnabled(s, crToggle.getAttribute("data-on") === "1"); renderProTabContent(s); });
  var crConfirm = el.querySelector("#creatineConfirm");
  if (crConfirm) crConfirm.addEventListener("click", function(){ var r = confirmCreatine(s); if (r.error){ showToast("⚠ " + r.error); return; } renderProTabContent(s); });
}
function wireProTab(s){
  var el = document.getElementById("proTabContent");
  wireProPlanExtras(s, el);

  el.querySelectorAll("[data-goto-tab]").forEach(function(row){
    row.addEventListener("click", function(){
      state.proTab = row.getAttribute("data-goto-tab");
      renderProShell();
    });
  });


  var skeletonBtn = el.querySelector("#createPlanSkeleton");
  if (skeletonBtn) skeletonBtn.addEventListener("click", function(){
    if (s.meals.length && !window.confirm("Já existem refeições no plano. Adicionar mais " + PLAN_SKELETON_MEALS.length + " refeições vazias (" + PLAN_SKELETON_MEALS.map(function(p){return p[0];}).join("/") + ")?")) return;
    var added = createPlanSkeleton(s);
    added.forEach(function(m){ logMealAdded(s, m); });
    renderProTabContent(s);
    persistStudent(s);
    showToast("Esqueleto de plano criado — adiciona os alimentos de cada refeição");
  });

  ["#draftFromDailyText", "#draftFromPastedPlan"].forEach(function(sel){
  var draftBtn = el.querySelector(sel), pasted = sel === "#draftFromPastedPlan";
  if (draftBtn) draftBtn.addEventListener("click", function(){
    var draft = applyPreferredProductsIf(pasted, draftPlanFromDailyText(pasted ? el.querySelector("#pastedPlanText").value : s.dailyEatingDescription));
    var resultEl = el.querySelector(pasted ? "#pastedPlanResult" : "#dailyPlanDraftResult");

    function renderAndWireDraft(){
      resultEl.innerHTML = renderDailyPlanDraft(draft);
      // Fase 20b: cada pill tem um × para tirar um alimento mal reconhecido
      // ANTES de aplicar ao plano, em vez de só dar para corrigir depois.
      resultEl.querySelectorAll("[data-remove-draft-food]").forEach(function(btn){
        btn.addEventListener("click", function(){
          var mi = parseInt(btn.getAttribute("data-remove-draft-food"), 10);
          var fi = parseInt(btn.getAttribute("data-food-idx"), 10);
          draft[mi].foods.splice(fi, 1);
          renderAndWireDraft();
        });
      });
      var applyBtn = resultEl.querySelector("#applyDailyPlanDraft");
      if (applyBtn) applyBtn.addEventListener("click", function(){
        var createdMeals = 0, addedFoods = 0;
        if (pasted) clearPlanIfReplacing(el, s, draft);
        draft.forEach(function(d){
          if (!d.foods.length) return;
          var targetMeal = s.meals.find(function(m){ return m.name === d.mealName; });
          if (!targetMeal){
            targetMeal = meal(d.mealName, d.mealTime, []);
            s.meals.push(targetMeal);
            logMealAdded(s, targetMeal);
            createdMeals++;
          }
          d.foods.forEach(function(f){
            if (targetMeal.foods.some(function(existing){ return existing.name === f.name; })) return;
            targetMeal.foods.push(food(f.name, f.qty, f.group));
            addedFoods++;
          });
        });
        sortMealsByTime(s);
        if (pasted && addedFoods > 0) setTargetsFromPlanIfAsked(el, s);
        // Fase 21: pedido explícito — mostrar os "não reconhecidos" no
        // momento de aplicar (não só no rascunho, que desaparece a seguir).
        // Regista no histórico do plano (fica consultável no separador
        // Histórico) e mostra já na notificação, para nenhum se perder.
        var index = getFoodKeywordIndex();
        var allUnmatchedWords = [];
        draft.forEach(function(d){
          var matchedNames = d.foods.map(function(fo){ return fo.name; });
          var lines = d.unmatchedLines || [];
          extractUnmatchedWords(d.sourceText, matchedNames, index, lines.join(" ")).forEach(function(w){
            if (allUnmatchedWords.indexOf(w) === -1) allUnmatchedWords.push(w);
          });
          lines.forEach(function(l){
            if (allUnmatchedWords.indexOf(l) === -1) allUnmatchedWords.push(l);
          });
        });
        var summary = "Plano gerado a partir " + (pasted ? "de um plano em texto" : "do dia-a-dia alimentar") + " (" + addedFoods + " alimentos, " + createdMeals + " refeições novas)" +
          (allUnmatchedWords.length ? " — não reconhecidos: " + allUnmatchedWords.join(", ") : "");
        if (addedFoods > 0 || allUnmatchedWords.length) logPlanEvent(s, "plano_gerado_texto", summary);
        renderProTabContent(s);
        persistStudent(s);
        var toastMsg = addedFoods > 0 ? "✓ Plano gerado: " + createdMeals + " refeições novas, " + addedFoods + " alimentos — revê e ajusta" : "Nada para aplicar — nenhum alimento novo reconhecido";
        if (allUnmatchedWords.length) toastMsg += ". Não reconhecidos (acrescenta à mão): " + allUnmatchedWords.join(", ");
        showToast(toastMsg);
      });
    }
    renderAndWireDraft();
  });
  });

  var saveT = el.querySelector("#saveTargets");
  if (saveT) {
    renderTargetWarning(el, s);
    ["tKcal","tProtein","tCarbs","tFat"].forEach(function(id){
      el.querySelector("#"+id).addEventListener("input", function(){ renderTargetWarning(el, s); });
    });
    saveT.addEventListener("click", function(){
      var newKcal = parseInt(el.querySelector("#tKcal").value,10);
      var newProtein = parseInt(el.querySelector("#tProtein").value,10);
      var newCarbs = parseInt(el.querySelector("#tCarbs").value,10);
      var newFat = parseInt(el.querySelector("#tFat").value,10);
      if (!(newKcal > 0) || !(newProtein >= 0) || !(newCarbs >= 0) || !(newFat >= 0)){
        showToast("⚠ Verifica os alvos — as calorias têm de ser superiores a 0 e os macros não podem ser negativos");
        return;
      }
      var newTargets = { kcal: newKcal, protein: newProtein, carbs: newCarbs, fat: newFat };
      logTargetsChange(s, s.targets, newTargets);
      notePhaseManualChange(s, s.targets.kcal, newTargets.kcal);
      s.targets = newTargets;
      s.fromOnboarding = false;
      var banner = el.querySelector(".suggestion-banner");
      if (banner) banner.remove();
      saveT.textContent = "Guardado ✓";
      persistStudent(s);
      setTimeout(function(){ saveT.textContent = "Guardar alvos"; }, 1400);
    });
  }

  var addMealBtn = el.querySelector("#addMealBtn");
  if (addMealBtn) addMealBtn.addEventListener("click", function(){
    var newMeal = addMealToPlan(s);
    logMealAdded(s, newMeal);
    renderProTabContent(s);
    persistStudent(s);
    showToast("Refeição adicionada");
  });

  var autoAdjustBtn = el.querySelector("#autoAdjustBtn");
  if (autoAdjustBtn) autoAdjustBtn.addEventListener("click", function(){
    if (!window.confirm("Isto vai reescalar as quantidades de todos os alimentos do plano (inclui vegetais e fruta) para bater certo com os alvos definidos acima — mantém as proporções entre alimentos. Alimentos \"à vontade\" não são alterados. Continuar?")) return;
    var result = autoAdjustPlanQuantities(s);
    if (result.changed > 0){
      logPlanEvent(s, "ajuste_quantidades", "Quantidades ajustadas automaticamente aos alvos (" + result.changed + " alimentos)");
      renderProTabContent(s);
      persistStudent(s);
    }
    if (result.changed === 0 && !result.skippedMacros.length){
      showToast("Nada para ajustar — já bate certo ou são todos alimentos \"à vontade\"");
    } else if (result.clamped && result.clamped.length){
      showToast("⚠ Ajuste limitado a 1/4 ou 4× as quantidades: os alvos não condizem bem com este plano. Revê os alvos ou os alimentos de " + result.clamped.map(function(k){ return {p:"proteína", c:"hidratos", f:"gordura"}[k]; }).join(", "));
    } else if (result.skippedMacros.length){
      showToast("Ajustados " + result.changed + " alimentos — falta acrescentar alimentos de " + result.skippedMacros.map(groupLabel).join(", ") + " para bater certo com esse alvo");
    } else {
      showToast("✓ " + result.changed + " alimentos ajustados aos alvos");
    }
  });

  el.querySelectorAll(".pm-name").forEach(function(select){
    select.addEventListener("change", function(){
      var midx = parseInt(select.getAttribute("data-midx"),10);
      var m = s.meals[midx];
      var newName = select.value;
      if (newName === m.name) return;
      var oldName = m.name;
      m.name = newName;
      logMealRenamed(s, oldName, newName);
      persistStudent(s);
    });
  });

  el.querySelectorAll(".pm-time").forEach(function(input){
    input.addEventListener("change", function(){
      var midx = parseInt(input.getAttribute("data-midx"),10);
      var m = s.meals[midx];
      if (!input.value || input.value === m.time){ input.value = m.time; return; }
      var oldTime = m.time;
      m.time = input.value;
      logMealRescheduled(s, m.name, oldTime, m.time);
      renderProTabContent(s);
      persistStudent(s);
      showToast("Horário atualizado");
    });
  });

  el.querySelectorAll("[data-del-meal]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var midx = parseInt(btn.getAttribute("data-del-meal"),10);
      var m = s.meals[midx];
      if (!window.confirm("Remover \"" + m.name + "\" do plano deste aluno?")) return;
      var removedLabel = m.name + " — " + m.time;
      removeMealFromPlan(s, m);
      logMealRemoved(s, removedLabel);
      renderProTabContent(s);
      persistStudent(s);
      showToast("Refeição removida");
    });
  });

  el.querySelectorAll("[data-del-food]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var midx = parseInt(btn.getAttribute("data-del-food"),10);
      var fidx = parseInt(btn.getAttribute("data-fidx"),10);
      var m = s.meals[midx];
      var f = m.foods[fidx];
      removeFoodFromMeal(m, f);
      logFoodRemoved(s, m.name, f);
      renderProTabContent(s);
      persistStudent(s);
      showToast("Alimento removido");
    });
  });

  // Fase 21: editar um alimento já no plano (trocar o alimento ou ajustar a
  // quantidade) em vez de só dar para apagar e acrescentar de novo. Mesmo
  // padrão de pesquisa/wiring do "+ Adicionar alimento" (Fase 16/18), só que
  // com as classes "ef-*" e chave midx+fidx (há um formulário por alimento,
  // não um só por refeição).
  el.querySelectorAll("[data-edit-food]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var midx = btn.getAttribute("data-edit-food");
      var fidx = btn.getAttribute("data-fidx");
      var formEl = el.querySelector("[data-edit-form=\"" + midx + "-" + fidx + "\"]");
      if (formEl) formEl.classList.toggle("hidden");
    });
  });

  el.querySelectorAll("[data-cancel-food-edit]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var midx = btn.getAttribute("data-cancel-food-edit");
      var fidx = btn.getAttribute("data-fidx");
      var formEl = el.querySelector("[data-edit-form=\"" + midx + "-" + fidx + "\"]");
      if (formEl) formEl.classList.add("hidden");
    });
  });

  // Fase 32: mudar o grupo aqui já não filtra a pesquisa (é sempre global,
  // ver allFoodNames()). Fase 33: mas se o alimento já escolhido não
  // pertencer ao grupo novo, limpa o campo "Alimento" — fica confuso deixar
  // lá um alimento que já não corresponde à categoria selecionada.
  el.querySelectorAll(".ef-group").forEach(function(sel){
    sel.addEventListener("change", function(){
      var midx = sel.getAttribute("data-midx"), fidx = sel.getAttribute("data-fidx");
      var foodInput = el.querySelector(".ef-food[data-midx=\"" + midx + "\"][data-fidx=\"" + fidx + "\"]");
      if (foodInput.value && groupOfFood(foodInput.value) !== sel.value){
        foodInput.value = "";
        var qtyWrap = el.querySelector(".ef-qty-wrap[data-midx=\"" + midx + "\"][data-fidx=\"" + fidx + "\"]");
        if (qtyWrap) qtyWrap.innerHTML = tplEditFoodQty("", null);
      }
    });
  });

  el.querySelectorAll(".ef-food").forEach(function(input){
    var midx = input.getAttribute("data-midx"), fidx = input.getAttribute("data-fidx");
    // Fase 33: nunca ir buscar por data-midx sozinho — uma refeição com mais
    // de um alimento tem vários ".food-search-results" com o mesmo midx (um
    // por cada "Editar alimento" já existente, todos com data-fidx próprio),
    // e o seletor apanhava sempre o primeiro (o de outro alimento, escondido)
    // em vez do deste. O resultado é sempre o próximo irmão do input no DOM.
    var resultsEl = input.nextElementSibling;
    function pick(name){
      input.value = name;
      resultsEl.classList.remove("open");
      var qtyWrap = el.querySelector(".ef-qty-wrap[data-midx=\"" + midx + "\"][data-fidx=\"" + fidx + "\"]");
      qtyWrap.innerHTML = tplEditFoodQty(name, 100);
      var groupSel = el.querySelector(".ef-group[data-midx=\"" + midx + "\"][data-fidx=\"" + fidx + "\"]");
      if (groupSel) groupSel.value = groupOfFood(name);
    }
    function refresh(){
      resultsEl.innerHTML = foodSearchResultsHtml(allFoodNames(), input.value);
      resultsEl.classList.add("open");
      offAutoSearch(resultsEl, input.value, filterFoodNames(allFoodNames(), input.value).length, pick);
    }
    input.addEventListener("input", refresh);
    input.addEventListener("focus", refresh);
    resultsEl.addEventListener("click", function(e){
      var item = e.target.closest(".food-search-item");
      if (!item || item.classList.contains("off-item")) return;
      pick(item.getAttribute("data-name"));
    });
    document.addEventListener("click", function(e){
      if (e.target !== input && !resultsEl.contains(e.target)) resultsEl.classList.remove("open");
    });
  });

  wireTemplates(s, el);

  // Sugerir alternativas (profissional): mesmas alternativas do aluno, mais parecidas primeiro e com a porção recalculada; ao escolher troca o alimento no plano
  el.querySelectorAll("[data-suggest-food]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var midx = parseInt(btn.getAttribute("data-suggest-food"), 10), fidx = parseInt(btn.getAttribute("data-fidx"), 10);
      var m = s.meals[midx], oldFood = m && m.foods[fidx];
      if (!oldFood) return;
      openSubstitution(oldFood, function(chosen){
        m.foods[fidx] = food(chosen.name, chosen.qty, oldFood.group, oldFood.required);
        logFoodEdited(s, m.name, oldFood, m.foods[fidx]);
        closeModal();
        renderProTabContent(s);
        persistStudent(s);
        showToast("✓ Alimento substituído");
      }, s, m, {pro: true});
    });
  });

  el.querySelectorAll("[data-save-food-edit]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var midx = parseInt(btn.getAttribute("data-save-food-edit"),10);
      var fidx = parseInt(btn.getAttribute("data-fidx"),10);
      var m = s.meals[midx];
      var oldFood = m.foods[fidx];
      var groupSel = el.querySelector(".ef-group[data-midx=\"" + midx + "\"][data-fidx=\"" + fidx + "\"]");
      var foodInput = el.querySelector(".ef-food[data-midx=\"" + midx + "\"][data-fidx=\"" + fidx + "\"]");
      var group = groupSel.value;
      var name = foodInput.value;
      if (!name){ showToast("⚠ Escolhe um alimento"); return; }
      var qtyWrap = el.querySelector(".ef-qty-wrap[data-midx=\"" + midx + "\"][data-fidx=\"" + fidx + "\"]");
      var numInput = qtyWrap.querySelector(".ef-qty-num");
      var amount = numInput ? parseFloat(numInput.value) : 1;
      if (numInput && !(amount > 0)){ showToast("⚠ A quantidade tem de ser superior a 0"); return; }
      var qty = buildQtyString(name, amount);
      if (qty == null){ showToast("⚠ Este alimento não é reconhecido — escolhe outro"); return; }
      m.foods[fidx] = food(name, qty, group);
      logFoodEdited(s, m.name, oldFood, m.foods[fidx]);
      renderProTabContent(s);
      persistStudent(s);
      showToast("✓ Alimento atualizado");
    });
  });

  // Fase 31: a info nutricional (por 100g/unidade + nesta dose) já vem
  // embutida sempre que tplAddFoodQty/tplEditFoodQty são chamados de novo
  // (troca de grupo, escolha de alimento na pesquisa, alimento personalizado
  // guardado) — só falta atualizá-la ao vivo enquanto o profissional escreve
  // uma quantidade diferente. Delegado em "el" (não nos inputs individuais,
  // que são recriados de cada vez que a quantidade/grupo mudam) para nunca
  // precisar de ser religado.
  el.addEventListener("input", function(e){
    if (!e.target.classList || !(e.target.classList.contains("af-qty-num") || e.target.classList.contains("ef-qty-num"))) return;
    var wrap = e.target.closest(".af-qty-wrap, .ef-qty-wrap");
    if (!wrap) return;
    var preview = wrap.querySelector(".food-nutri-preview");
    if (!preview) return;
    var midx = wrap.getAttribute("data-midx");
    var fidx = wrap.getAttribute("data-fidx");
    var nameInput = fidx != null
      ? el.querySelector(".ef-food[data-midx=\"" + midx + "\"][data-fidx=\"" + fidx + "\"]")
      : el.querySelector(".af-food[data-midx=\"" + midx + "\"]");
    if (!nameInput) return;
    preview.outerHTML = foodNutritionPreviewHtml(nameInput.value, parseFloat(e.target.value));
  });

  // Fase 32: mudar o grupo aqui já não filtra a pesquisa (é sempre global,
  // ver allFoodNames()). Fase 33: mas se o alimento já escolhido não
  // pertencer ao grupo novo, limpa o campo "Alimento" — fica confuso deixar
  // lá um alimento que já não corresponde à categoria selecionada.
  el.querySelectorAll(".af-group").forEach(function(sel){
    sel.addEventListener("change", function(){
      var midx = sel.getAttribute("data-midx");
      var foodInput = el.querySelector(".af-food[data-midx=\"" + midx + "\"]");
      if (foodInput.value && groupOfFood(foodInput.value) !== sel.value){
        foodInput.value = "";
        var qtyWrap = el.querySelector(".af-qty-wrap[data-midx=\"" + midx + "\"]");
        if (qtyWrap) qtyWrap.innerHTML = tplAddFoodQty("");
      }
    });
  });

  // Fase 16: .af-food passou de <select> a pesquisa de texto (base do INSA
  // tem centenas de alimentos por grupo — um <select> nativo ainda funciona,
  // mas <datalist> tem suporte pouco fiável no iOS, daí uma lista própria).
  // Fase 32: pesquisa sempre em todos os alimentos (não só os do grupo
  // selecionado) e sem alimento pré-preenchido — só mostra a lista
  // ordenada ao focar/escrever, nunca escolhe nada sozinho.
  el.querySelectorAll(".af-food").forEach(function(input){
    var midx = input.getAttribute("data-midx");
    // Fase 33: mesmo motivo do bloco .ef-food acima — não ir buscar por
    // data-midx sozinho (colide com os ".food-search-results" de cada
    // "Editar alimento" já existente na mesma refeição, que têm o mesmo
    // midx). O resultado é sempre o próximo irmão do input no DOM.
    var resultsEl = input.nextElementSibling;
    function pick(name){
      input.value = name;
      resultsEl.classList.remove("open");
      var qtyWrap = el.querySelector(".af-qty-wrap[data-midx=\"" + midx + "\"]");
      qtyWrap.innerHTML = tplAddFoodQty(name);
      var groupSel = el.querySelector(".af-group[data-midx=\"" + midx + "\"]");
      if (groupSel) groupSel.value = groupOfFood(name);
    }
    function refresh(){
      resultsEl.innerHTML = foodSearchResultsHtml(allFoodNames(), input.value);
      resultsEl.classList.add("open");
      offAutoSearch(resultsEl, input.value, filterFoodNames(allFoodNames(), input.value).length, pick);
    }
    input.addEventListener("input", refresh);
    input.addEventListener("focus", refresh);
    resultsEl.addEventListener("click", function(e){
      var item = e.target.closest(".food-search-item");
      if (!item || item.classList.contains("off-item")) return;
      pick(item.getAttribute("data-name"));
    });
    document.addEventListener("click", function(e){
      if (e.target !== input && !resultsEl.contains(e.target)) resultsEl.classList.remove("open");
    });
  });

  el.querySelectorAll("[data-add-food]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var midx = parseInt(btn.getAttribute("data-add-food"),10);
      var m = s.meals[midx];
      var groupSel = el.querySelector(".af-group[data-midx=\"" + midx + "\"]");
      var foodSel = el.querySelector(".af-food[data-midx=\"" + midx + "\"]");
      var group = groupSel.value;
      var name = foodSel.value;
      if (!name){ showToast("⚠ Escolhe um alimento"); return; }
      var qtyWrap = el.querySelector(".af-qty-wrap[data-midx=\"" + midx + "\"]");
      var numInput = qtyWrap.querySelector(".af-qty-num");
      var amount = numInput ? parseFloat(numInput.value) : 1;
      if (numInput && !(amount > 0)){ showToast("⚠ A quantidade tem de ser superior a 0"); return; }
      var ok = addFoodToMeal(m, name, group, amount);
      if (!ok){ showToast("⚠ Este alimento não é reconhecido — escolhe outro"); return; }
      var added = m.foods[m.foods.length - 1];
      logFoodAdded(s, m.name, added);
      renderProTabContent(s);
      persistStudent(s);
      showToast("Alimento adicionado");
    });
  });

  el.querySelectorAll(".add-food-details").forEach(function(details){
    details.addEventListener("toggle", function(){
      if (!details.open) return;
      var input = details.querySelector(".af-food");
      if (input) input.focus();
    });
  });

  el.querySelectorAll("[data-new-food]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var midx = btn.getAttribute("data-new-food");
      var groupSel = el.querySelector(".af-group[data-midx=\"" + midx + "\"]");
      openCustomFoodModal(groupSel ? groupSel.value : PRO_PLAN_GROUPS[0], function(name){
        var foodInput = el.querySelector(".af-food[data-midx=\"" + midx + "\"]");
        if (foodInput) foodInput.value = name;
        var qtyWrap = el.querySelector(".af-qty-wrap[data-midx=\"" + midx + "\"]");
        if (qtyWrap) qtyWrap.innerHTML = tplAddFoodQty(name);
        if (groupSel) groupSel.value = groupOfFood(name);
      });
    });
  });

  el.querySelectorAll("[data-key]").forEach(function(cb){
    cb.addEventListener("change", function(){
      if (!s.flexOverrides) s.flexOverrides = {};
      var key = cb.getAttribute("data-key");
      var oldVal = s.flexOverrides[key];
      logOverrideChange(s, key, oldVal, cb.checked);
      s.flexOverrides[key] = cb.checked;
      persistStudent(s);
    });
  });

  var saveN = el.querySelector("#saveNotes");
  if (saveN) saveN.addEventListener("click", function(){
    s.notes = el.querySelector("#proNotes").value;
    saveN.textContent = "Guardado ✓";
    persistStudent(s);
    setTimeout(function(){ saveN.textContent = "Guardar notas"; }, 1400);
  });

  var delBtn = el.querySelector("#stuDeleteBtn");
  if (delBtn) delBtn.addEventListener("click", function(){ openDeleteStudentModal(s); });
  var nnToggle = el.querySelector("#noNutritionToggle");
  if (nnToggle) nnToggle.addEventListener("change", function(){
    s.noNutrition = nnToggle.checked;
    if (s.noNutrition && state.proTab === "plano") state.proTab = "perfil";
    persistStudent(s);
    showToast(s.noNutrition ? "✓ Sem nutrição para este aluno" : "✓ Nutrição ativa para este aluno");
    renderProShell();
  });
  var saveWG = el.querySelector("#saveWeightGoal");
  if (saveWG) saveWG.addEventListener("click", function(){
    var raw = el.querySelector("#weightGoalInput").value;
    var newGoal = raw === "" ? null : parseFloat(raw);
    if (newGoal != null && !(newGoal > 0)){
      showToast("⚠ O peso objetivo tem de ser superior a 0");
      return;
    }
    if (keepRunningPhase(s, newGoal)) return;
    s.weightGoal = newGoal;
    var suggested = computeSuggestedTargets({
      sex: s.sex, weight: s.weightCurrent, height: s.height, age: s.age,
      trainingsPerWeek: s.trainingsPerWeek, activityLevel: s.activityLevel, goal: s.goal, weightGoal: s.weightGoal,
      leanMass: null
    });
    var newTargets = {kcal:suggested.kcal, protein:suggested.protein, carbs:suggested.carbs, fat:suggested.fat};
    logTargetsChange(s, s.targets, newTargets);
    s.targets = newTargets;
    s.fromOnboarding = true; // reaparece o banner "confirma ou ajusta" no Plano
    if (s.weightGoal) setPhaseFromGoal(s); // o peso objetivo define a fase (cut, bulk ou manutenção)
    saveWG.textContent = "Guardado ✓";
    persistStudent(s);
    showToast("Peso objetivo guardado — alvos recalculados, revê no separador Plano");
    setTimeout(function(){ saveWG.textContent = "Guardar peso objetivo"; }, 1400);
  });

  // Fase 27: nível de atividade física — mais preciso do que o nº de treinos
  // sozinho para calcular a manutenção/TDEE. Só grava o valor; não força um
  // recálculo automático dos alvos (o profissional decide quando ajustar,
  // tal como já acontece para o resto do perfil).
  var saveAL = el.querySelector("#saveActivityLevel");
  if (saveAL) saveAL.addEventListener("click", function(){
    var raw = el.querySelector("#activityLevelInput").value;
    s.activityLevel = raw || null;
    saveAL.textContent = "Guardado ✓";
    persistStudent(s);
    showToast("Nível de atividade guardado");
    setTimeout(function(){ saveAL.textContent = "Guardar nível de atividade"; }, 1400);
  });

  var savePh = el.querySelector("#saveContactPhone");
  if (savePh) savePh.addEventListener("click", function(){
    var raw = el.querySelector("#contactPhone").value.trim(), err = el.querySelector("#contactPhoneErr");
    if (raw && !normalizePhone(raw).ok){ err.textContent = "Número inválido: indica 9 dígitos (ex.: 912 345 678) ou com indicativo (+351…)."; err.style.display = "block"; return; }
    err.style.display = "none";
    s.phone = raw ? raw.slice(0, 30) : null;
    persistStudent(s);
    showToast("Telefone guardado");
  });

  var saveMed = el.querySelector("#saveMedical");
  if (saveMed) saveMed.addEventListener("click", function(){
    s.medicalConditions = el.querySelector("#medConditions").value.trim();
    s.currentMedication = el.querySelector("#medCurrent").value.trim();
    s.physicalLimitations = el.querySelector("#medLimitations").value.trim();
    s.medicalNotes = el.querySelector("#medNotes").value.trim();
    saveMed.textContent = "Guardado ✓";
    persistStudent(s);
    setTimeout(function(){ saveMed.textContent = "Guardar dados médicos"; }, 1400);
  });

  var togglePhotos = el.querySelector("#togglePhotos");
  if (togglePhotos) togglePhotos.addEventListener("change", function(){
    s.allowPhotos = togglePhotos.checked;
    renderProTabContent(s);
    persistStudent(s);
  });
  el.querySelectorAll(".pro-photo-upload-input").forEach(function(photoInput){
    photoInput.addEventListener("change", function(e){
      var file = e.target.files && e.target.files[0];
      var position = photoInput.getAttribute("data-position");
      var dEl = el.querySelector("#proPhotoDate");
      uploadProgressPhotoAsPro(s, file, position, function(){ renderProTabContent(s); }, dEl && dEl.value);
      photoInput.value = "";
    });
  });
  wirePhotoCompare(s, el);
  wirePhotoRemove(s, el, function(){ renderProTabContent(s); });

  var toggleAll = el.querySelector("#assessToggleAll");
  if (toggleAll) toggleAll.addEventListener("click", function(){ state.assessShowAll = !state.assessShowAll; renderProTabContent(s); });
  el.querySelectorAll(".sort-th").forEach(function(b){ b.addEventListener("click", function(){ toggleAssessSort(b.getAttribute("data-sort")); renderProTabContent(s); }); });

  var importPreviewBtn = el.querySelector("#importWeighPreview");
  if (importPreviewBtn) importPreviewBtn.addEventListener("click", function(){
    var parsed = parseWeighInNotes(el.querySelector("#importWeighText").value, {defaultTime: el.querySelector("#importWeighDefaultTime").value});
    var plan = mergeWeighIns(s, parsed.entries, false);
    var resultEl = el.querySelector("#importWeighResult");
    resultEl.innerHTML = tplImportPreview(s, parsed, plan);
    var confirmBtn = resultEl.querySelector("#importWeighConfirm");
    if (confirmBtn) confirmBtn.addEventListener("click", function(){
      var done = mergeWeighIns(s, parsed.entries, true);
      state.assessShowAll = false;
      showToast("Importadas " + (done.full + done.weightOnly) + " pesagens");
      renderProTabContent(s);
      persistStudent(s);
    });
  });

  function refreshAnthroFeedback(){ updateSkinfoldPreview(s, el); updateAnthroWarnings(s, el); }
  el.querySelectorAll(".meas-grid input").forEach(function(inp){ inp.addEventListener("input", refreshAnthroFeedback); });
  ["#mrPerim", "#mrSkin"].forEach(function(sel){
    var cb = el.querySelector(sel);
    if (cb) cb.addEventListener("change", function(){
      var grid = cb.closest("details") && cb.closest("details").querySelector(".meas-grid");
      if (grid) grid.classList.toggle("multi-read", cb.checked);
      refreshAnthroFeedback();
    });
  });
  ["#sfProtocol", "#sfSex", "#asDate"].forEach(function(sel){ var inp = el.querySelector(sel); if (inp) inp.addEventListener("change", function(){ updateSkinfoldPreview(s, el); }); });
  var addAs = el.querySelector("#addAssessment");
  if (addAs) addAs.addEventListener("click", function(){
    var errEl = el.querySelector("#assessError");
    var date = el.querySelector("#asDate").value || localTodayISO();
    var timeEl = el.querySelector("#asTime");
    var time = (timeEl && /^\d{2}:\d{2}$/.test(timeEl.value)) ? timeEl.value : "";
    var weight = parseFloat(el.querySelector("#asWeight").value);
    var bodyFat = parseFloat(el.querySelector("#asBodyFat").value);
    var muscle = parseFloat(el.querySelector("#asMuscle").value);
    var visceral = parseFloat(el.querySelector("#asVisceral").value);
    var water = parseFloat(el.querySelector("#asWater").value);
    var perims = {};
    var perimSet = readPerimeterSet(el), skinSet = readSkinfoldSet(el);
    perims = perimSet.values;
    var sfs = skinSet.values;
    var ctxEl = el.querySelector("#asContext"), context = ctxEl ? ctxEl.value : "";
    if ([weight,bodyFat,muscle,visceral,water].every(function(v){ return isNaN(v); }) && !Object.keys(perims).length && !Object.keys(sfs).length) return;
    // cada leitura tem de estar dentro dos limites (não só o valor final)
    var badPerim = PERIMETER_FIELDS.filter(function(f){ return (perimSet.reads[f[0]] || []).some(function(v){ return v < f[4] || v > f[5]; }); })[0];
    if (badPerim){
      errEl.textContent = badPerim[1] + ": o perímetro tem de estar entre " + badPerim[4] + " e " + badPerim[5] + " cm (confirma a unidade).";
      errEl.style.display = "block";
      return;
    }
    var badSkin = SKINFOLD_SITES.filter(function(site){ return (skinSet.reads[site[0]] || []).some(function(v){ return v < SKINFOLD_MIN_MM || v > SKINFOLD_MAX_MM; }); })[0];
    if (badSkin){
      errEl.textContent = "Prega " + badSkin[1].toLowerCase() + ": o valor tem de estar entre " + SKINFOLD_MIN_MM + " e " + SKINFOLD_MAX_MM + " mm.";
      errEl.style.display = "block";
      return;
    }
    var sfSexEl = el.querySelector("#sfSex"), sfSex = sfSexEl ? sfSexEl.value : "";
    var sfWanted = (el.querySelector("#sfProtocol") || {}).value || "auto";
    var sfSexKey = sexKeyOf(s.sex) || (sfSex === "M" || sfSex === "F" ? sfSex : null);
    if (Object.keys(sfs).length && sfWanted !== "auto"){
      var need = skinfoldSitesOf(sfWanted, sfSexKey);
      if (!need){
        errEl.textContent = "Escolhe se aplicas as equações de homens ou de mulheres.";
        errEl.style.display = "block";
        return;
      }
      var missing = need.filter(function(k){ return !(sfs[k] > 0); });
      if (missing.length){
        errEl.textContent = SKINFOLD_PROTOCOLS[sfWanted].label + ": faltam as pregas " + missing.map(function(k){ return SKINFOLD_SITES.filter(function(x){ return x[0] === k; })[0][1].toLowerCase(); }).join(", ") + ".";
        errEl.style.display = "block";
        return;
      }
    }
    var negative = [weight,muscle,visceral].some(function(v){ return !isNaN(v) && v < 0; });
    var outOfPercentRange = [bodyFat,water].some(function(v){ return !isNaN(v) && (v < 0 || v > 100); });
    if (negative || outOfPercentRange){
      errEl.textContent = "Verifica os valores — não podem ser negativos, e percentagens têm de estar entre 0 e 100.";
      errEl.style.display = "block";
      return;
    }
    if (errEl) errEl.style.display = "none";
    if (!s.assessments) s.assessments = [];
    var hasComposition = [weight,bodyFat,muscle,visceral,water].some(function(v){ return !isNaN(v); });
    // só perímetros/pregas: não houve pesagem — não se inventa um peso (ficaria como medição e estragaria os indicadores)
    var entry = {date:date, weight: hasComposition ? (weight||s.weightCurrent) : 0, bodyFat:bodyFat||0, muscle:muscle||0, visceral:visceral||0, water:water||0};
    if (time) entry.time = time;
    Object.keys(perims).forEach(function(k){ entry[k] = perims[k]; });
    // leituras brutas (só onde houve 2 ou mais): o valor guardado no campo é a média ou a mediana
    var perimReads = {}; Object.keys(perimSet.reads).forEach(function(k){ if (perimSet.reads[k].length > 1) perimReads[k] = perimSet.reads[k]; });
    if (Object.keys(perimReads).length) entry.reads = perimReads;
    var skinReads = {}; Object.keys(skinSet.reads).forEach(function(k){ if (skinSet.reads[k].length > 1) skinReads[k] = skinSet.reads[k]; });
    if (Object.keys(skinReads).length) entry.sfReads = skinReads;
    if (Object.keys(sfs).length){
      entry.skinfolds = sfs;
      // o protocolo fica fixo na avaliação: assim a evolução compara sempre as mesmas equações
      var usedProtocol = resolveSkinfoldProtocol(sfs, sfSexKey, sfWanted, ageAtDate(s, date));
      if (usedProtocol) entry.sfProtocol = usedProtocol;
      if (!sexKeyOf(s.sex) && sfSexKey) entry.sfSex = sfSexKey;
    }
    if (context) entry.context = context;
    s.assessments.push(entry);
    if (!isNaN(weight)){ s.weightCurrent = weight; s.weights.push({date:date, w:weight}); }
    var softWarns = perimSet.issues.concat(skinSet.issues, anthroPlausibilityWarnings(perims, sfs, s.height));
    renderProTabContent(s);
    persistStudent(s);
    if (softWarns.length) showToast("Guardado. Confirma: " + softWarns[0] + (softWarns.length > 1 ? " (+" + (softWarns.length - 1) + ")" : ""));
  });
  el.querySelectorAll(".assess-del[data-idx]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var sorted = s.assessments.slice().sort(compareAssessmentsDesc);
      var idx = parseInt(btn.getAttribute("data-idx"),10);
      var target = sorted[idx];
      s.assessments = s.assessments.filter(function(a){ return a!==target; });
      // a avaliação também pode ter criado uma entrada em weights (mesma data e peso) — reverter os dois juntos
      var weightEntry = s.weights.find(function(w){ return w.date === target.date && w.w === target.weight; });
      if (weightEntry) s.weights = s.weights.filter(function(w){ return w !== weightEntry; });
      if (s.weights.length){
        var latest = s.weights.slice().sort(function(a,b){ return a.date<b.date?-1:1; })[s.weights.length-1];
        s.weightCurrent = latest.w;
      }
      renderProTabContent(s);
      persistStudent(s);
    });
  });

  wireProTreino(s, el);

  var addNote = el.querySelector("#addDatedNote");
  if (addNote) addNote.addEventListener("click", function(){
    var text = el.querySelector("#proNoteNew").value.trim();
    if (!text) return;
    var area = el.querySelector("#proNotes");
    if (area) s.notes = area.value; // não perde o que já estava escrito e ainda não guardado
    s.notes = prependDatedNote(s.notes, text);
    persistStudent(s);
    renderProTabContent(s);
    showToast("Nota acrescentada");
  });
}

/* ===================== MODE SWITCH / BOOT ===================== */
function setMode(mode){
  state.mode = mode;
  document.querySelectorAll("#modeSwitch button").forEach(function(b){ b.classList.toggle("active", b.getAttribute("data-mode")===mode); });
  document.getElementById("alunoApp").classList.toggle("hidden", mode!=="aluno");
  document.getElementById("proApp").classList.toggle("hidden", mode!=="pro");
  if (mode==="aluno"){
    if (state.proSelectedId) state.alunoStudentId = state.proSelectedId;
    renderAlunoShell();
  } else {
    renderProShell();
  }
  renderRestTimer();
}

document.querySelectorAll("#modeSwitch button").forEach(function(b){
  b.addEventListener("click", function(){ setMode(b.getAttribute("data-mode")); });
});

/* ===================== AUTENTICAÇÃO ===================== */
var authFormMode = "signin";
var SCREEN_IDS = ["appLoading","authScreen","recoveryScreen","connectionErrorScreen","noStudentScreen","alunoApp","proApp"];

function hideAllScreens(){
  SCREEN_IDS.forEach(function(id){ document.getElementById(id).classList.add("hidden"); });
}

function showLoading(text){
  hideAllScreens();
  document.getElementById("appLoading").classList.remove("hidden");
  document.getElementById("appLoadingText").textContent = text || "A carregar...";
}

// Terceiro modo, além de "signin"/"signup": "recover" pede o email e envia o
// link de recuperação (sb.auth.resetPasswordForEmail) — não troca a password
// aqui, isso só acontece no ecrã "recoveryScreen", depois de o aluno confirmar
// o link recebido por email (ver o evento PASSWORD_RECOVERY em boot()).
function setAuthMode(mode){
  authFormMode = mode;
  var pw = document.getElementById("authPassword");
  var pwField = document.getElementById("authPasswordField");
  var errEl = document.getElementById("authError");
  var forgotWrap = document.getElementById("authForgotWrap");
  errEl.style.display = "none";
  errEl.style.color = "var(--critical)";
  if (mode === "signup"){
    document.getElementById("authTitle").textContent = "Criar conta";
    document.getElementById("authSubtitle").textContent = "Usa o email para o qual foste convidado (ou o teu, se és o profissional).";
    document.getElementById("authSubmit").textContent = "Criar conta";
    document.getElementById("authToggle").textContent = "Já tens conta? Entrar";
    document.getElementById("authToggle").style.display = "";
    forgotWrap.style.display = "none";
    pwField.style.display = "";
    pw.required = true;
    pw.setAttribute("autocomplete","new-password");
  } else if (mode === "recover"){
    document.getElementById("authTitle").textContent = "Recuperar password";
    document.getElementById("authSubtitle").textContent = "Escreve o teu email — enviamos-te um link para criares uma password nova.";
    document.getElementById("authSubmit").textContent = "Enviar link";
    document.getElementById("authToggle").textContent = "Voltar a entrar";
    document.getElementById("authToggle").style.display = "";
    forgotWrap.style.display = "none";
    pwField.style.display = "none";
    pw.required = false;
  } else {
    document.getElementById("authTitle").textContent = "Entrar";
    document.getElementById("authSubtitle").textContent = "Acede à tua conta Evolve.";
    document.getElementById("authSubmit").textContent = "Entrar";
    document.getElementById("authToggle").textContent = "Ainda não tens conta? Criar conta";
    document.getElementById("authToggle").style.display = "";
    forgotWrap.style.display = "";
    pwField.style.display = "";
    pw.required = true;
    pw.setAttribute("autocomplete","current-password");
  }
}

function showAuthScreen(mode){
  hideAllScreens();
  document.getElementById("authScreen").classList.remove("hidden");
  document.getElementById("signOutBtn").classList.add("hidden");
  document.getElementById("modeSwitch").classList.add("hidden");
  setAuthMode(mode || "signin");
}

function translateAuthError(msg){
  if (/already registered|already exists/i.test(msg)) return "Já existe uma conta com este email — tenta entrar.";
  if (/invalid login credentials/i.test(msg)) return "Email ou password incorretos.";
  if (/password should be/i.test(msg)) return "A password deve ter pelo menos 6 caracteres.";
  if (/email not confirmed/i.test(msg)) return "Confirma o teu email antes de entrares (verifica a caixa de entrada).";
  if (/for security purposes|only request this/i.test(msg)) return "Já pediste isto há pouco tempo — espera um pouco antes de tentar de novo.";
  if (/failed to fetch|network/i.test(msg)) return "Não foi possível ligar — verifica a tua ligação e tenta novamente.";
  return msg;
}

function offerToSaveCredential(email, password){
  try {
    if (window.PasswordCredential){
      var cred = new window.PasswordCredential({ id: email, password: password, name: email });
      navigator.credentials.store(cred).catch(function(){});
    }
  } catch(e){}
}

/* ---------- Papel de profissional: nunca decidido por comparar o email no browser ----------
   A app pergunta ao servidor "esta conta está na tabela professionals?" — essa
   tabela só é legível pela própria conta (RLS) e só é escrita manualmente pelo
   dono do projeto Supabase, nunca pela app. Mesmo que alguém force isProfessional
   a true na consola do browser, todas as políticas RLS/trigger no servidor
   continuam a verificar a MESMA tabela de forma independente — o pior que
   acontece é a UI mostrar o ecrã errado, sem nenhum dado real a fugir. */
function checkIsProfessional(){
  // true/false; null = não foi possível perguntar (sem rede) — nesse caso o aluno pode abrir a cópia guardada neste telemóvel
  return withTimeout(sb.from("professionals").select("user_id").maybeSingle(), 10000).then(function(res){
    if (res && res.error && outboxErrorIsTransient(res)) return null;
    return !!(res && res.data);
  }).catch(function(){ return null; });
}

// Sem ligação ao servidor: o aluno abre a última cópia da sua ficha (a fila de alterações por enviar já está lá incluída);
// o profissional nunca guarda dados dos alunos no dispositivo, por isso vê o ecrã de "sem ligação" com o botão de tentar de novo.
function bootFromSnapshot(session, isProfessional){
  var snap = isProfessional === true ? null : snapshotRead(session.user.id);
  if (!snap){
    hideAllScreens();
    document.getElementById("connectionErrorScreen").classList.remove("hidden");
    return Promise.resolve();
  }
  showToast("Sem ligação: a mostrar a última cópia guardada neste telemóvel");
  return finishBoot(outboxOverlay(snap.rows), false, true); // a fila é idempotente: se a cópia já a incluía, nada muda
}

// Entra na app com as fichas já lidas (do servidor ou da cópia guardada)
function finishBoot(rows, isProfessional, offline){
  STUDENTS = rows.map(rowToStudent);
  lastStudentsLoad = Date.now();
  // a primeira ligação pode ser lenta: o catálogo extra não pode prender o arranque. As fotos vêm só quando se abre a evolução.
  var extras = offline ? Promise.resolve() : withTimeout(Promise.all([loadCustomFoods(), loadFoodProducts()]), 12000).catch(function(){});
  return extras.then(function(){
    document.getElementById("signOutBtn").classList.remove("hidden");
    if (isProfessional){
      authRole = "professional";
      hideAllScreens();
      if (APP_MODE === "gestao"){ // app da Gestão: só a parte do profissional, sem o interruptor Aluno/Profissional
        document.getElementById("modeSwitch").classList.add("hidden");
        document.getElementById("proApp").classList.remove("hidden");
        state.proView = "studio";
      } else {
        document.getElementById("modeSwitch").classList.remove("hidden");
        document.getElementById("alunoApp").classList.remove("hidden");
        document.getElementById("proApp").classList.remove("hidden");
      }
      state.alunoStudentId = STUDENTS[0] ? STUDENTS[0].id : null;
      setMode("pro");
    } else if (APP_MODE === "gestao"){ // uma conta de aluno não tem nada a fazer na Gestão
      authRole = STUDENTS.length ? "student" : null;
      hideAllScreens();
      document.getElementById("modeSwitch").classList.add("hidden");
      var ns = document.getElementById("noStudentScreen");
      ns.innerHTML = "<div class=\"eyebrow\" style=\"margin-bottom:8px;\">Só para o profissional</div><p class=\"muted-p\">Esta é a app de gestão do estúdio. A tua app de treino e alimentação está noutro endereço.</p><a class=\"btn\" href=\"index.html\" style=\"margin-top:14px; display:inline-block;\">Abrir a app EVOLVE</a><br><button type=\"button\" class=\"btn\" id=\"noStudentSignOut\" style=\"margin-top:14px;\">Sair</button>";
      var nso = document.getElementById("noStudentSignOut"); if (nso) nso.addEventListener("click", doSignOut);
      ns.classList.remove("hidden");
      document.getElementById("signOutBtn").classList.remove("hidden");
    } else if (STUDENTS.length){
      authRole = "student";
      STUDENTS.forEach(ensureSyncBaseline); // versão de partida: daqui em diante só se enviam as colunas que mudarem
      hideAllScreens();
      document.getElementById("modeSwitch").classList.add("hidden");
      document.getElementById("alunoApp").classList.remove("hidden");
      state.alunoStudentId = STUDENTS[0].id;
      state.mode = "aluno";
      document.getElementById("protoRibbon").classList.add("hidden"); // o aluno não precisa do aviso de protótipo
      renderAlunoShell();
    } else {
      authRole = null;
      hideAllScreens();
      document.getElementById("noStudentScreen").classList.remove("hidden");
      document.getElementById("signOutBtn").classList.remove("hidden");
    }
    syncPillUpdate();
    if (!offline) outboxFlush();
    if (isProfessional && APP_MODE !== "gestao") setTimeout(maybeOpenPhaseReviews, 500); // as revisões de plano à espera aparecem logo ao entrar
  });
}

function handleSession(session){
  if (!session){ currentAuthUserId = null; showAuthScreen("signin"); return; }
  currentAuthUserId = session.user.id;
  showLoading("A preparar a tua conta...");
  var email = session.user.email;

  checkIsProfessional().then(function(isProfessional){
    if (isProfessional === null) return bootFromSnapshot(session, null);
    // Reclamar o convite passa por uma função no servidor (claim_student_row),
    // não por um UPDATE direto: confirmámos que um UPDATE direto na tabela,
    // mesmo com a política RLS correta e a condição validada como verdadeira,
    // não afetava a linha de forma fiável via PostgREST. A função corre com
    // privilégios elevados e faz a mesma validação internamente.
    var claim = isProfessional ? Promise.resolve() : sb.rpc("claim_student_row");

    return Promise.resolve(claim).then(function(){
      return outboxFlushAndWait(); // alterações feitas sem rede seguem antes de se ler a ficha
    }).then(function(){
      return withTimeout(sb.from("students").select("*"), 15000);
    }).then(function(res){
      if (!res || res.error) return bootFromSnapshot(session, isProfessional);
      var rows = outboxOverlay(res.data || []);
      if (!isProfessional) snapshotWrite(session.user.id, rows);
      return finishBoot(rows, isProfessional, false);
    }, function(){ return bootFromSnapshot(session, isProfessional); });
  }).catch(function(err){
    showLoading("Erro ao carregar a tua conta: " + (err && err.message ? err.message : "tenta novamente."));
  });
}

document.getElementById("authToggle").addEventListener("click", function(e){
  e.preventDefault();
  if (authFormMode === "recover") setAuthMode("signin");
  else setAuthMode(authFormMode === "signin" ? "signup" : "signin");
});

document.getElementById("authForgot").addEventListener("click", function(e){
  e.preventDefault();
  setAuthMode("recover");
});

document.getElementById("authForm").addEventListener("submit", function(e){
  e.preventDefault();
  var email = document.getElementById("authEmail").value.trim();
  var password = document.getElementById("authPassword").value;
  var errEl = document.getElementById("authError");
  errEl.style.display = "none";
  var submitBtn = document.getElementById("authSubmit");
  submitBtn.disabled = true;

  if (authFormMode === "recover"){
    sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname }).then(function(res){
      submitBtn.disabled = false;
      // Nunca confirmamos aqui se o email existe ou não (evita revelar quais
      // emails têm conta) — a mensagem é sempre a mesma, exceto para erros de
      // ligação/limite de pedidos, que não revelam nada sobre contas.
      if (res.error && /failed to fetch|network/i.test(res.error.message)){
        errEl.style.color = "var(--critical)";
        errEl.textContent = translateAuthError(res.error.message);
      } else {
        errEl.style.color = "var(--accent-strong)";
        errEl.textContent = "Se existir uma conta com este email, foi enviado um link para criares uma password nova.";
      }
      errEl.style.display = "block";
    }).catch(function(){
      submitBtn.disabled = false;
      errEl.style.color = "var(--critical)";
      errEl.textContent = "Não foi possível ligar — tenta novamente.";
      errEl.style.display = "block";
    });
    return;
  }

  var action = authFormMode === "signup"
    ? sb.auth.signUp({ email: email, password: password })
    : sb.auth.signInWithPassword({ email: email, password: password });

  action.then(function(res){
    submitBtn.disabled = false;
    if (res.error){
      errEl.style.color = "var(--critical)";
      errEl.textContent = translateAuthError(res.error.message);
      errEl.style.display = "block";
      return;
    }
    if (authFormMode === "signup" && res.data && !res.data.session){
      errEl.style.color = "var(--accent-strong)";
      errEl.textContent = "Conta criada — verifica o teu email para confirmar antes de entrares.";
      errEl.style.display = "block";
      return;
    }
    offerToSaveCredential(email, password);
    handleSession(res.data.session);
  }).catch(function(){
    submitBtn.disabled = false;
    errEl.style.color = "var(--critical)";
    errEl.textContent = "Não foi possível ligar — tenta novamente.";
    errEl.style.display = "block";
  });
});

document.getElementById("recoveryForm").addEventListener("submit", function(e){
  e.preventDefault();
  var password = document.getElementById("recoveryPassword").value;
  var errEl = document.getElementById("recoveryError");
  errEl.style.display = "none";
  var submitBtn = document.getElementById("recoverySubmit");
  submitBtn.disabled = true;
  sb.auth.updateUser({ password: password }).then(function(res){
    submitBtn.disabled = false;
    if (res.error){
      errEl.style.color = "var(--critical)";
      errEl.textContent = translateAuthError(res.error.message);
      errEl.style.display = "block";
      return;
    }
    showToast("Password atualizada");
    sb.auth.getSession().then(function(sessRes){ handleSession(sessRes.data && sessRes.data.session); });
  }).catch(function(){
    submitBtn.disabled = false;
    errEl.style.color = "var(--critical)";
    errEl.textContent = "Não foi possível ligar — tenta novamente.";
    errEl.style.display = "block";
  });
});

function doSignOut(){
  persistPrepareAll();
  if (outboxCount() && !window.confirm("Há alterações que ainda não foram enviadas e perder-se-iam ao sair. Sair mesmo assim?")) return;
  offlineDataWipe(); // a cópia da ficha e a fila ficam só enquanto a sessão estiver iniciada
  restTimerStop();
  wlDraftWipe();
  meState.id = null; meState.loaded = false; // a escolha do «Eu» é de cada conta
  state.proSelectedId = null; if (G.loaded) G.enter("studio"); // a Gestão volta a ler tudo ao entrar
  sb.auth.signOut().then(function(){ authRole = null; showAuthScreen("signin"); });
}
document.getElementById("signOutBtn").addEventListener("click", doSignOut);
document.getElementById("noStudentSignOut").addEventListener("click", doSignOut);
document.getElementById("connectionRetry").addEventListener("click", function(){ boot(); });

// Verifica sessão e liga-se aos eventos de auth. Um evento PASSWORD_RECOVERY
// chega quando o aluno clica no link do email de recuperação — nesse momento
// a Supabase já lhe deu uma sessão temporária só para trocar a password (ver
// recoveryScreen acima), por isso nunca o mandamos para o ecrã de login normal
// nesse caso, mesmo que handleSession() também possa correr em paralelo.
// Falha de rede aqui é distinta de "sem sessão": mostra connectionErrorScreen
// em vez de cair silenciosamente no ecrã de login, que pareceria uma sessão
// perdida em vez de uma falha de ligação.
function boot(){
  initSupabase();
  if (!sbReady){
    hideAllScreens();
    document.getElementById("alunoApp").classList.remove("hidden");
    document.getElementById("proApp").classList.remove("hidden");
    if (APP_MODE === "gestao"){ // modo local (demonstração) da app de Gestão
      document.getElementById("alunoApp").classList.add("hidden");
      state.proView = "studio";
      whenGestao(function(){ return G.studioRefresh(); });
      setMode("pro");
      return;
    }
    document.getElementById("modeSwitch").classList.remove("hidden");
    setMode("aluno");
    return;
  }
  showLoading("A verificar sessão...");
  sb.auth.getSession().then(function(res){
    handleSession(res.data && res.data.session);
  }).catch(function(){
    hideAllScreens();
    document.getElementById("connectionErrorScreen").classList.remove("hidden");
  });
  sb.auth.onAuthStateChange(function(event){
    if (event === "SIGNED_OUT") showAuthScreen("signin");
    if (event === "PASSWORD_RECOVERY"){
      hideAllScreens();
      document.getElementById("recoveryScreen").classList.remove("hidden");
    }
  });
}

// ligação/rede: enviar a fila quando volta, avisar quando se perde, e atualizar a lista do profissional ao regressar à app
window.addEventListener("online", function(){ syncPillUpdate(); outboxFlush(); proRefreshAndRender(false); });
window.addEventListener("offline", function(){ syncPillUpdate(); });
window.addEventListener("pagehide", function(){ persistPrepareAll(); });
document.addEventListener("visibilitychange", function(){
  if (document.visibilityState === "hidden"){ persistPrepareAll(); outboxFlush(); return; }
  outboxFlush();
  proRefreshAndRender(false);
  if (authRole === "professional" && G.loaded && G.studio.loaded) G.studioAutoSessions().then(G.studioAfterAutoSessions); // um dia novo: as sessões de ontem já passaram
});
if (typeof navigator !== "undefined" && "serviceWorker" in navigator && /^https?:$/.test(location.protocol)){
  window.addEventListener("load", function(){ navigator.serviceWorker.register("sw.js").catch(function(){}); });
}

boot();

})();
