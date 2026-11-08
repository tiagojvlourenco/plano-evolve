// Fase 38 — Check-ins do profissional: resumo no topo, só os mais recentes à vista, anteriores recolhidos.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
function ci(n, adh){ return {date: todayISO().slice(0, 8) + ("0" + (n % 27 + 1)).slice(-2), weight: 70, hunger: 5, energy: 6, adherence: adh, notes: n === 1 ? "primeiro <b>" : ""}; }
var few = [ci(1, 7), ci(2, 8)];
var h = tplProCheckins({checkins: few});
check.check("1. Com poucos check-ins não há bloco de anteriores", h.indexOf("pro-fold") < 0 && /2 check-ins/.test(h));
check.check("2. O resumo traz as médias de adesão, energia e fome", /adesão <span class="num">7,5<\/span>/.test(h) && /energia <span class="num">6,0<\/span>/.test(h) && /fome <span class="num">5,0<\/span>/.test(h));
check.check("3. As notas continuam escapadas", h.indexOf("<b>") < 0 && /&lt;b&gt;/.test(h));
var many = []; for (var i = 1; i <= 10; i++) many.push(ci(i, i));
var hm = tplProCheckins({checkins: many});
check.check("4. Com 10 check-ins, 6 ficam à vista e 4 recolhidos", (hm.match(/history-row/g) || []).length === 10 && /data-fold="checkinsAntigos"/.test(hm) && /4 check-ins/.test(hm));
check.check("5. Os mais recentes estão antes do bloco recolhido", hm.indexOf("history-row") < hm.indexOf("data-fold=\"checkinsAntigos\""));
check.check("6. A média usa só os últimos 4 (adesão 7, 8, 9, 10 = 8,5)", /adesão <span class="num">8,5<\/span>/.test(hm));
check.check("7. Sem check-ins, mensagem simples e sem resumo", /Sem check-ins registados/.test(tplProCheckins({checkins: []})) && tplProCheckins({checkins: []}).indexOf("card") < 0);
check.summarize();
