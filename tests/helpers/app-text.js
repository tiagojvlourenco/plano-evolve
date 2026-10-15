// Texto completo da app para os testes que analisam o código-fonte: HTML + CSS + núcleo (app.js) + Gestão (gestao.js),
// pela ordem em que apareciam quando estava tudo em index.html. Os testes de comportamento usam extract-app.js.
const fs = require("fs");
const path = require("path");
module.exports = function appText(){
  return ["index.html", "app.css", "app.js", "gestao.js"].map(function (f) {
    return fs.readFileSync(path.join(__dirname, "..", "..", f), "utf8");
  }).join("\n");
};
