// Dias de calendário na mudança de hora (Fase 38). Em Portugal o relógio recua a última domingo de outubro; na semana a seguir, depois das 23 h,
// contar «milissegundos / 24 h» desde a meia-noite local dava um dia a mais (6 dias contavam como 7 e o check-in aparecia «em atraso»).
process.env.TZ = "Europe/Lisbon";
require("./setup")();
var RealDate = Date;
function freezeNow(iso){
  var fixed = new RealDate(iso).getTime();
  global.Date = class extends RealDate {
    constructor(){ if (arguments.length === 0) super(fixed); else super(...arguments); }
    static now(){ return fixed; }
  };
}
freezeNow("2026-10-26T23:04:00Z");   // segunda-feira 26/10/2026, 23:04 (hora de Lisboa já é UTC+0; a 20/10 ainda era UTC+1)
eval(require("./extract-app")());
var check = require("./check")();

check.check("0. O fuso do teste é Lisboa", new RealDate("2026-10-20T00:00:00").getTimezoneOffset() === -60 && new RealDate("2026-10-26T00:00:00").getTimezoneOffset() === 0);

function s(date){ return {checkins: [{date: date}]}; }
check.check("1. 20/10 às 23:04 de 26/10 -> 6 dias (não 7)", computeLastCheckinDaysAgo(s("2026-10-20")) === 6);
check.check("2. Hoje -> 0 dias", computeLastCheckinDaysAgo(s("2026-10-26")) === 0);
check.check("3. Ontem -> 1 dia", computeLastCheckinDaysAgo(s("2026-10-25")) === 1);
check.check("4. Sem check-ins -> 999", computeLastCheckinDaysAgo({checkins: []}) === 999);
check.check("5. Data inválida não rebenta (999)", computeLastCheckinDaysAgo(s("lixo")) === 999);

// o mesmo dia a uma hora da tarde dá o mesmo resultado
freezeNow("2026-10-26T14:00:00Z");
check.check("6. Às 14:00 também 6 dias", computeLastCheckinDaysAgo(s("2026-10-20")) === 6);

// mudança de hora da primavera (29/03/2026, 00:00 -> 01:00): às 00:30 de 30/03, ontem é 29/03
freezeNow("2026-03-30T00:30:00Z");
check.check("7. Primavera: 29/03 visto de 30/03 -> 1 dia", computeLastCheckinDaysAgo(s("2026-03-29")) === 1);
check.check("8. Primavera: 23/03 visto de 30/03 -> 7 dias", computeLastCheckinDaysAgo(s("2026-03-23")) === 7);
check.summarize();
