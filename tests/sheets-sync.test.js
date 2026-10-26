// Folhas «Cliente …» do Google: ler a aba «Dados», montar as importações (pacotes, contratos, horas) e não duplicar pacotes já renovados na app.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var store = {};
global.localStorage = {getItem: function(k){ return k in store ? store[k] : null; }, setItem: function(k, v){ store[k] = String(v); }, removeItem: function(k){ delete store[k]; }};
STUDENTS = [{id: "d", name: "Duarte Guedes", active: true}, {id: "m", name: "Maria João", active: true}, {id: "j", name: "Joana Almeida", active: true}];
var duarte = parseClientSheet([["Nome:", "PT 60 - Duarte Guedes", "", "ESTADO"], ["Contrato:", "26", "", "Ativo"], ["Data de inicio:", "19/10/2026"], ["Valor:", "940,50 €", "", "ANGARIAÇÃO"], ["Modalidade:", "Trimestral", "", "Interno"], ["Horas mensais:", "8,66"], ["INDIVIDUAL /DUO", "Individual"], ["Valor Hora a Pagar:", "36,17 €"]]);
check.check("1. Lê a folha de um aluno: nome sem «PT 60 - », aulas, início, valor, modalidade, horas, formato, estado e minutos",
  duarte && duarte.name === "Duarte Guedes" && duarte.total === 26 && duarte.start === "2026-10-19" && duarte.price === 940.5 && duarte.modalidade === "trimestral" && duarte.hours === 8.66 && duarte.formato === "individual" && duarte.estado === "ativo" && duarte.minutos === 60);
var duo = parseClientSheet([["Nome:", "PT Duo 60 - Maria João + Joana Almeida", "", "ESTADO"], ["Contrato:", "26", "", "Activo"], ["Data de inicio:", "01/10/2026"], ["Valor:", "1200 €"], ["Modalidade:", "Mensal"], ["Horas mensais:", "4,33"], ["INDIVIDUAL /DUO", "Duo"]]);
check.check("2. Uma folha de duo fica «duo» e «Activo» (com c) vale «ativo»", duo && duo.formato === "duo" && duo.estado === "ativo" && duo.name === "Maria João + Joana Almeida" && duo.minutos === 60);
check.check("3. Folhas sem «Nome» ou com campos inválidos não rebentam", parseClientSheet([]) === null && parseClientSheet([["Nome:", "PT 60 - X"], ["Contrato:", "abc"], ["Data de inicio:", "32/13/2026"]]).total === null && parseClientSheet([["Nome:", "PT 60 - X"], ["Data de inicio:", "32/13/2026"]]).start === null);
var t = sheetImportTexts([duarte, duo]);
check.check("4. Linhas de pacotes: o duo leva o 2.º nome na coluna da partilha e a validade fica vazia",
  t.packs.split("\n")[0] === "Duarte Guedes; 26; 19/10/2026; 940,5; 0" && t.packs.split("\n")[1] === "Maria João; 26; 01/10/2026; 1200; 0; ; Joana Almeida");
check.check("5. Linhas de contratos e horas", /^PT 60 - Duarte Guedes; Trimestral; Individual; Ativo$/m.test(t.contracts) && /^PT 60 - Maria João \+ Joana Almeida; Mensal; Duo; Ativo$/m.test(t.contracts) && /^Duarte Guedes; 8,66$/m.test(t.hours));
// as linhas são aceites pelas importações que já existem
var pp = parsePackImport(t.packs), pc = parseContractsImport(t.contracts), ph = parseHoursImport(t.hours);
check.check("6. As importações existentes aceitam estas linhas sem erros", pp.errors.length === 0 && pp.rows.length === 2 && pc.errors.length === 0 && pc.rows.length === 2 && ph.errors.length === 0);
studio.packs = [{id: "p1", student_id: "d", total: 26, starts_on: "2026-10-15", price: 940.5}]; studio.loaded = true;
check.check("7. Um pacote igual já existente (início a 4 dias) conta como já existente; outro com 30 dias de diferença não",
  sheetPackExists(duarte) === true && sheetPackExists({name: "Duarte Guedes", total: 26, start: "2026-11-20"}) === false && sheetPackExists({name: "Duarte Guedes", total: 13, start: "2026-10-19"}) === false);
check.summarize();
