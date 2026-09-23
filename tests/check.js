// Auxiliar de asserção mínimo, partilhado por todos os ficheiros de teste.
// Cada ficheiro cria o seu próprio contador (evita estado partilhado entre ficheiros
// quando correm em processos separados via run-all.js).
function makeChecker(){
  var passed = 0, failed = 0;
  function check(desc, cond){
    if (cond) passed++;
    else { failed++; console.log("FAIL:", desc); }
  }
  function summarize(){
    console.log("\n" + passed + " passaram, " + failed + " falharam");
    process.exit(failed ? 1 : 0);
  }
  return { check: check, summarize: summarize };
}

module.exports = makeChecker;
