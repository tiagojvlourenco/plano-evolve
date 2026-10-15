// Lê index.html (o build standalone, gerado a partir da mesma fonte publicada) e devolve o
// conteúdo interno do <script> da app como texto, pronto a avaliar com eval() no scope de
// topo de um ficheiro de teste. Não depende de nenhum caminho fora deste repositório.
//
// Duas transformações são feitas ao texto original:
//   1. Remove o wrapper IIFE + "use strict" do início e o "})();" do fim — sem isto, todas as
//      declarações ficariam presas dentro dessa função anónima e desapareceriam assim que ela
//      terminasse de executar, tornando-as inacessíveis ao teste.
//   2. Acrescenta o texto de gestao.js (código da Gestão, carregado à parte pelo profissional) antes do boot() final — assim os testes
//      veem o mesmo conjunto de funções que a app tem depois de carregar o módulo, e G.loaded fica a true.
//   3. Substitui a chamada final boot() por um comentário — boot() liga-se ao Supabase e
//      manipula o DOM da app real, o que não faz sentido (nem é seguro) correr durante os
//      testes. Todas as outras declarações de função/dados continuam disponíveis normalmente.
const fs = require("fs");
const path = require("path");

function extractApp(){
  const htmlPath = path.join(__dirname, "..", "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");

  const scripts = [];
  let pos = 0;
  while (true){
    const start = html.indexOf("<script", pos);
    if (start < 0) break;
    const tagEnd = html.indexOf(">", start);
    const end = html.indexOf("</script>", tagEnd);
    scripts.push({ tag: html.slice(start, tagEnd + 1), start: tagEnd + 1, end: end });
    pos = end + 1;
  }
  const inline = scripts.find(function (s) { return !/src=/.test(s.tag); });
  if (!inline) throw new Error("Não encontrei o <script> inline em index.html");
  const full = html.slice(inline.start, inline.end);

  const marker = 'use strict";';
  const innerStart = full.indexOf(marker) + marker.length;
  const innerEnd = full.lastIndexOf("})();");
  if (innerStart <= marker.length - 1 || innerEnd < 0){
    throw new Error("Não consegui identificar o wrapper IIFE do script — a estrutura de index.html pode ter mudado");
  }
  let inner = full.slice(innerStart, innerEnd);
  // gestao.js é avaliado dentro do mesmo scope que a app (na app real: eval direto dentro da IIFE). Entra antes do boot() final,
  // para G já estar carregado quando o arranque o pedir (na app real isto acontece logo a seguir, pela rede).
  const gestao = fs.readFileSync(path.join(__dirname, "..", "gestao.js"), "utf8");
  const bootAt = inner.lastIndexOf("\nboot();");
  inner = bootAt >= 0 ? inner.slice(0, bootAt) + "\n" + gestao + "\n" + inner.slice(bootAt) : inner + "\n" + gestao + "\n";
  inner = inner.replace("boot();", "/* boot() suprimido nos testes: liga-se ao Supabase real e mexe no DOM da app */");
  return inner;
}

module.exports = extractApp;
