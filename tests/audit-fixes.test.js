// Correções da auditoria de código — guarda contra 0/1 registos em weightSvg.
require("./setup")();
eval(require("./extract-app")());
var check = require("./check")();

check.check("weightSvg com 0 registos não rebenta", (function(){ try { weightSvg([]); return true; } catch(e){ return false; } })());
check.check("weightSvg com 0 registos mostra mensagem em vez de SVG partido", /Ainda não há dados/.test(weightSvg([])));
check.check("weightSvg com 1 registo não rebenta", (function(){ try { weightSvg([{date:"2026-09-01", w:70}]); return true; } catch(e){ return false; } })());
check.check("weightSvg com 1 registo mostra mensagem em vez de NaN nas coordenadas", /Ainda não há dados/.test(weightSvg([{date:"2026-09-01", w:70}])));
check.check("weightSvg com 2+ registos continua a produzir SVG normalmente", /<svg/.test(weightSvg([{date:"2026-09-01", w:70},{date:"2026-09-08", w:69}])));

check.summarize();
