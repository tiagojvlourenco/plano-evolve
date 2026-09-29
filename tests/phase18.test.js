// Fase 18 — separador Plano confuso com várias refeições: o formulário de
// adicionar alimento ficava sempre aberto em todas as refeições ao mesmo
// tempo, e não havia separação visual clara entre refeições.
const fs = require("fs");
const path = require("path");
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

// ---- 1. Cada refeição tem um cartão visual próprio (não só uma linha a separar) ----

// 1. tplPlanoMealEditor usa a classe "card" (mesmo estilo já usado no resto da app)
(function(){
  var m = meal("Almoço", "13:00", [food("Frango (peito)","150 g","protein")]);
  var html = tplPlanoMealEditor(m, 0);
  check.check("1. O cartão da refeição tem a classe 'card'", /class="plano-meal-card card"/.test(html));
})();

// ---- 2. Formulário de adicionar alimento é recolhível (<details>), não sempre aberto ----

// 2. O formulário fica dentro de um <details> fechado por omissão
(function(){
  var m = meal("Almoço", "13:00", []);
  var html = tplPlanoMealEditor(m, 0);
  check.check("2. Está dentro de um <details class=\"add-food-details\">", html.indexOf('<details class="add-food-details">') >= 0);
  check.check("2. Não tem o atributo open (começa fechado)", !/add-food-details" open/.test(html));
  check.check("2. O <summary> mostra '+ Adicionar alimento'", html.indexOf('<summary class="btn btn-sm">+ Adicionar alimento</summary>') >= 0);
})();

// 3. Mesmo fechado, o conteúdo do formulário continua no HTML (só visualmente escondido por <details>)
// — importante: toda a lógica de pesquisa/wiring já existente depende disto continuar no DOM.
(function(){
  var m = meal("Almoço", "13:00", []);
  var html = tplPlanoMealEditor(m, 0);
  check.check("3. O input de pesquisa af-food está presente no HTML", html.indexOf('class="af-food"') >= 0);
  check.check("3. O botão de adicionar novo alimento está presente", html.indexOf("data-new-food") >= 0);
})();

// 4. O botão interno de submeter passa a dizer só "Adicionar" (não duplica "+ Adicionar alimento" com o summary)
(function(){
  var html = tplAddFoodForm(0);
  check.check("4. Botão interno diz 'Adicionar', sem repetir 'alimento' (já está no summary)", /data-add-food="0"[^>]*>Adicionar</.test(html));
})();

// ---- 3. wireProTab: abrir o <details> foca a pesquisa automaticamente ----

// 5. Liga o evento "toggle" do add-food-details a focar o input
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function wireProTab"), appSource.indexOf("function wireProTab") + 20000);
  check.check("5. Liga .add-food-details ao evento toggle", fnSrc.indexOf('querySelectorAll(".add-food-details")') >= 0 && fnSrc.indexOf('addEventListener("toggle"') >= 0);
  check.check("5. Só foca quando abre (details.open), não ao fechar", fnSrc.indexOf("if (!details.open) return;") >= 0);
  check.check("5. Foca o campo de pesquisa af-food dentro do details", /details\.querySelector\("\.af-food"\)/.test(fnSrc));
})();

// ---- 4. CSS: o <summary> perde o marcador nativo e fica centrado como um botão ----

// 6. Regras CSS presentes
(function(){
  var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  check.check("6. Remove o marcador nativo do <summary>", html.indexOf(".add-food-details summary::-webkit-details-marker{display:none;}") >= 0);
  check.check("6. Texto do summary centrado (parece um botão, não uma lista)", html.indexOf(".add-food-details summary{list-style:none; text-align:center;") >= 0);
})();

check.summarize();
