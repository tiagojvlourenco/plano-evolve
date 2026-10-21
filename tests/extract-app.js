// Lê app.js (o script da app, partilhado por index.html e gestao.html) e devolve o
// conteúdo interno do script da app como texto, pronto a avaliar com eval() no scope de
// topo de um ficheiro de teste. Não depende de nenhum caminho fora deste repositório.
//
// Estas transformações são feitas ao texto original:
//   1. Remove o wrapper IIFE + "use strict" do início e o "})();" do fim — sem isto, todas as
//      declarações ficariam presas dentro dessa função anónima e desapareceriam assim que ela
//      terminasse de executar, tornando-as inacessíveis ao teste.
//   2. Acrescenta o texto de gestao.js (código da Gestão, carregado à parte pelo profissional) antes do boot() final — assim os testes
//      veem o mesmo conjunto de funções que a app tem depois de carregar o módulo, e G.loaded fica a true.
//   3. Acrescenta também corrida-core.js e corrida.js (a Corrida, carregada à parte sob pedido) quando existem, nesta ordem e a seguir à Gestão
//      (na app real: um só eval com os dois ficheiros). Se ainda não existem, ficam de fora — os testes não dependem deles.
//   4. Substitui a chamada final boot() por um comentário — boot() liga-se ao Supabase e
//      manipula o DOM da app real, o que não faz sentido (nem é seguro) correr durante os
//      testes. Todas as outras declarações de função/dados continuam disponíveis normalmente.
const fs = require("fs");
const path = require("path");

function extractApp(){
  // o script da app está em app.js (partilhado por index.html e gestao.html)
  const full = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

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
  // a Corrida (núcleo + ecrãs): na app real é um eval só, com o núcleo primeiro; aqui entra o que existir
  const corrida = ["corrida-core.js", "corrida.js"].map(function (f) {
    const p = path.join(__dirname, "..", f);
    return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  }).join("\n");
  const extra = gestao + "\n" + corrida;
  const bootAt = inner.lastIndexOf("\nboot();");
  inner = bootAt >= 0 ? inner.slice(0, bootAt) + "\n" + extra + "\n" + inner.slice(bootAt) : inner + "\n" + extra + "\n";
  inner = inner.replace("boot();", "/* boot() suprimido nos testes: liga-se ao Supabase real e mexe no DOM da app */");
  return inner;
}

module.exports = extractApp;
