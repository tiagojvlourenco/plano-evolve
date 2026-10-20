// «Não faz nutrição comigo» (migração 0030) e fim do check-in semanal: o aluno sem nutrição só vê treino; o profissional deixa de ver o bloco de nutrição.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var fs = require("fs"), path = require("path");

function mk(extra){ var s = buildFullDemoStudent(); s.id = "n1"; s.name = "Nuno Teste"; s.isDemo = false; s.active = true; s.photos = []; return Object.assign(s, extra || {}); }
var on = mk({noNutrition: true}), off = mk();

var mig = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "0030_no_nutrition.sql"), "utf8");
check.check("1. A migração 0030 acrescenta a coluna no_nutrition (boolean, falso por omissão), segura de repetir", /add column if not exists no_nutrition boolean not null default false/.test(mig));
check.check("2. A marca grava-se e lê-se (studentToRow / rowToStudent)", studentToRow(on).no_nutrition === true && studentToRow(off).no_nutrition === false && rowToStudent(Object.assign(studentToRow(on), {id: "n1"})).noNutrition === true);

// aluno
var hoje = tplHoje(studentView(on)), hojeOff = tplHoje(studentView(off));
check.check("3. «Hoje» do aluno sem nutrição não mostra refeições nem ajuda de alimentação; o normal mostra", !/Alimentação|refeição|alimenta/i.test(hoje.replace(/Precisas de ajuda/g, "")) && /openAssistant/.test(hojeOff));
var plano = tplPlanoTabs(studentView(on));
check.check("4. «Plano» do aluno sem nutrição não tem Alimentação nem Compras (só o treino)", !/data-plano-sec/.test(plano) && !/Compras/.test(plano) && /Treino|treino/.test(plano));
check.check("5. O aluno com nutrição continua a ter Alimentação no Plano", /data-plano-sec="alimentacao"/.test(tplPlanoTabs(studentView(off))));

// profissional
STUDENTS = [on, off];
state.proSelectedId = "n1"; state.proTab = "plano";
check.check("6. O menu da ficha do aluno sem nutrição não tem o grupo Nutrição (e o normal tem)", !/data-g="nutricao"/.test(proStudentNavHtml()) && (state.proSelectedId = "n1", true));
state.proSelectedId = off.id = "n2"; STUDENTS = [on, off];
check.check("7. O menu da ficha de um aluno normal tem o grupo Nutrição", /data-g="nutricao"/.test(proStudentNavHtml()));
check.check("8. O perfil tem o interruptor «Não faz nutrição comigo» (só do profissional)", /id="noNutritionToggle"/.test(tplProPerfil(on)) && /checked/.test(tplProPerfil(on).match(/<input type="checkbox" id="noNutritionToggle"[^>]*>/)[0]) && !/id="noNutritionToggle"/.test(tplHoje(studentView(off))));
check.check("9. Sem nutrição não há revisões de plano nem motivos de contacto de alimentação", (function(){ var reasons = contactReasonsFor(on, localTodayISO()).map(function(r){ return r.key; }); return reasons.indexOf("adesao-a-cair") < 0 && reasons.indexOf("estagnado") < 0 && reasons.indexOf("plano-antigo") < 0; })() && collectPhaseReviews().every(function(r){ return r.student.id !== "n1"; }));

// check-in semanal retirado
check.check("10. O Progresso do aluno já não pede o check-in semanal e o painel não o conta", WEEKLY_CHECKIN_ENABLED === false && !/id="submitCheckin"/.test(tplEvolucaoAluno(studentView(off), {editable: false})) && !contactReasonsFor(off, localTodayISO()).some(function(r){ return r.key === "sem-checkin"; }));
check.check("11. O «Pulso do estúdio» saiu do painel", STUDIO_PULSE_ENABLED === false);
check.summarize();
