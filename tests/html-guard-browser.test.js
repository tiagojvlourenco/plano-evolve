// A rede de segurança de HTML corre no browser (usa o DOM): este teste abre a app num Chromium real se o Playwright existir
// (senão fica "ignorado" e conta como passado). Inclui payloads de "mutation XSS", que contornam sanitizadores que serializam e voltam a ler.
var check = require("./check")();
var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var fs = require("fs");
var path = require("path");
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){
  console.log("(ignorado: Playwright/Chromium não disponíveis aqui)");
  check.check("browser indisponível — teste ignorado", true);
  check.summarize();
}
(async function(){
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var page = await browser.newPage();
  await page.route(/jsdelivr|fonts\./, function(r){ return r.abort(); });
  await page.goto("file://" + path.join(__dirname, "..", "index.html"));
  var payloads = {
    plain: '<img src=x onerror="window.__x=1">',
    mxssA: '<noscript><style></noscript><img src=x onerror=window.__x=1></style></noscript>',
    mxssB: '<math><mtext><table><mglyph><style><img src=x onerror=window.__x=1>',
    mxssC: '<form><math><mtext></form><form><mglyph><style></math><img src onerror=window.__x=1>',
    js: '<a href="  JaVaScRiPt:window.__x=1" id="l">x</a>',
    svg: '<svg><circle onload="window.__x=1" r="3"/></svg>',
    iframe: '<iframe src="//example.com"></iframe><script>window.__x=1<\/script>',
    tmpl: '<template><img src=x onerror=window.__x=1></template>',
    dataHtml: '<object data="data:text/html,<script>window.__x=1<\/script>"></object><a href="data:text/html;base64,AA">d</a>'
  };
  var out = await page.evaluate(function(p){
    var res = {};
    Object.keys(p).forEach(function(k){
      window.__x = 0;
      var d = document.createElement("div"); document.body.appendChild(d);
      d.innerHTML = p[k];
      var risky = d.querySelectorAll("[onerror],[onload],script,iframe,object,embed,template,noscript").length;
      var jsLink = Array.prototype.some.call(d.querySelectorAll("a[href]"), function(a){ return /^\s*javascript:/i.test(a.getAttribute("href")) || /^data:text/i.test(a.getAttribute("href")); });
      res[k] = {risky: risky, jsLink: jsLink};
      d.remove();
    });
    // modo "innerHTML = array/objeto" também passa pela rede
    window.__x = 0; var d2 = document.createElement("div"); document.body.appendChild(d2); d2.innerHTML = ['<img src=x onerror=window.__x=1>'];
    res.array = {risky: d2.querySelectorAll("[onerror]").length, jsLink: false};
    var d3 = document.createElement("div"); document.body.appendChild(d3); d3.innerHTML = '<p id="p">a</p>'; d3.querySelector("#p").outerHTML = '<img src=x onerror=window.__x=1><b>ok</b>';
    res.outer = {risky: d3.querySelectorAll("[onerror]").length, jsLink: false, kept: !!d3.querySelector("b")};
    var d4 = document.createElement("div"); d4.innerHTML = '<details open><summary>s</summary><svg viewBox="0 0 4 4"><circle r="1"/></svg></details><img alt="a & b" src="data:image/png;base64,AAAA"><textarea>\n\nlinha</textarea><select><option value="1">1</option></select>';
    res.legit = {details: !!d4.querySelector("details[open]"), svg: !!d4.querySelector("svg circle"), img: d4.querySelector("img").getAttribute("src") === "data:image/png;base64,AAAA", ta: d4.querySelector("textarea").value, sel: d4.querySelector("select option").value};
    res.x = window.__x;
    return res;
  }, payloads);
  await new Promise(function(r){ setTimeout(r, 300); });
  var x = await page.evaluate(function(){ return window.__x; });
  Object.keys(payloads).forEach(function(k){ check.check("payload '" + k + "' fica sem handlers/scripts/links perigosos", out[k].risky === 0 && !out[k].jsLink); });
  check.check("payload via array e via outerHTML também", out.array.risky === 0 && out.outer.risky === 0 && out.outer.kept);
  check.check("nenhum payload executou código (window.__x continua 0)", out.x === 0 && x === 0);
  check.check("HTML legítimo fica intacto (details open, svg, imagem data:image, textarea com linhas em branco, select)", out.legit.details && out.legit.svg && out.legit.img && out.legit.ta === "\nlinha" && out.legit.sel === "1");
  await browser.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e); process.exit(1); });
