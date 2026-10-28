// «Acrescentar nota datada» sem texto não fica calado: avisa e põe o cursor no campo.
require("./setup")();
var src = require("./extract-app")();
var check = require("./check")();
check.check("1. Sem texto, «Acrescentar nota datada» avisa («Escreve primeiro a nota») e foca o campo, em vez de não fazer nada", /if \(!text\)\{ showToast\("Escreve primeiro a nota"\); try \{ el\.querySelector\("#proNoteNew"\)\.focus\(\); \} catch \(e\) \{\} return; \}/.test(src));
check.summarize();
