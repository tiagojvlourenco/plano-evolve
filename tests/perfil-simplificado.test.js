// Perfil e Resumo: dados médicos com Sim/Não, idade a partir da data de nascimento, peso em linhas separadas, sem Notas privadas/Apagar no Perfil.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var base = {id: "p1", name: "Ana", initials: "AN", likes: [], dislikes: [], avoid: [], allergies: [], supplements: [], targets: {}, meals: []};
var vazio = tplProPerfil(base), cheio = tplProPerfil(Object.assign({}, base, {medicalConditions: "hipertensão", currentMedication: "", physicalLimitations: "joelho", medicalNotes: "obs"}));
var box = function(h, id){ var i = h.indexOf('data-yn="' + id + '"'); return h.slice(i, h.indexOf("</textarea></div>", i)); };

check.check("1. Dados médicos: as três perguntas têm «Não» e «Sim» (sem texto, fica «Não» e o campo escondido)", ["medConditions", "medCurrent", "medLimitations"].every(function(id){ var b = box(vazio, id); return /data-yn-val="0" aria-pressed="true"/.test(b) && /data-yn-val="1" aria-pressed="false"/.test(b) && / hidden>/.test(b); }));
check.check("2. Com texto guardado a resposta aparece como «Sim» e o campo visível com o texto", /data-yn-val="1" aria-pressed="true"/.test(box(cheio, "medConditions")) && !/ hidden>/.test(box(cheio, "medConditions")) && /hipertensão/.test(box(cheio, "medConditions")) && /data-yn-val="0" aria-pressed="true"/.test(box(cheio, "medCurrent")));
check.check("3. Perguntas em linguagem direta e Observações como opcional", /Tem alguma condição médica ou patologia\?/.test(vazio) && /Toma medicação\?/.test(vazio) && /Tem lesões ou limitações físicas\?/.test(vazio) && /Observações \(opcional\)/.test(vazio));
var fn = appSource.slice(appSource.indexOf("function wireProTab"), appSource.indexOf("\nfunction ", appSource.indexOf("function wireProTab") + 1));
check.check("4. Guardar: «Não» guarda vazio e «Sim» sem texto não grava (avisa)", /yes \? el\.querySelector\("#" \+ id\)\.value\.trim\(\) : ""/.test(fn) && /Nas respostas «Sim», diz o quê/.test(fn) && /s\.medicalConditions = c\.text/.test(fn) && /s\.currentMedication = m\.text/.test(fn) && /s\.physicalLimitations = l\.text/.test(fn));
check.check("5. Resumo do Perfil: contagem de respostas «Sim», «só observações» ou «sem registos»", perfilMetas(base).medicos === "sem registos" && perfilMetas({medicalNotes: "x"}).medicos === "só observações" && perfilMetas({medicalConditions: "a", physicalLimitations: "b"}).medicos === "2 de 3 com registo");

// idade
var hoje = new Date(), y = hoje.getFullYear(), mm = ("0" + (hoje.getMonth() + 1)).slice(-2), dd = ("0" + hoje.getDate()).slice(-2);
check.check("6. A idade calcula-se da data de nascimento (aniversário hoje = já fez os anos; amanhã = ainda não)", ageFromBirthDate((y - 30) + "-" + mm + "-" + dd) === 30 && ageFromBirthDate((y - 30) + "-" + mm + "-" + ("0" + Math.min(28, hoje.getDate())).slice(-2)) !== null);
var rs = rowToStudent({id: "r1", name: "Rita", initials: "RI", age: 20, birth_date: (y - 35) + "-01-01", targets: {}});
check.check("7. Ao ler a ficha a idade acompanha a data de nascimento (a guardada, 20, é ignorada)", rs.age === 35);
check.check("8. Sem data de nascimento mantém a idade guardada", rowToStudent({id: "r2", name: "Rui", initials: "RU", age: 41, targets: {}}).age === 41);
check.check("9. O Perfil tem o campo de data (não pode ser futura) e o botão; a idade aparece calculada", /id="birthDateInput" value=""[^>]* max="\d{4}-\d{2}-\d{2}"/.test(vazio) && /id="saveBirthDate"/.test(vazio) && /atualiza-se em cada aniversário/.test(vazio) && /30 anos/.test(tplProPerfil(Object.assign({}, base, {age: 30}))));
check.check("10. Guardar a data atualiza a idade, grava e avisa; datas impossíveis são recusadas", /s\.birthDate = v \|\| null;\s*if \(age != null\) s\.age = age;\s*persistStudent\(s\);/.test(fn) && /age < 5 \|\| age > 110/.test(fn) && /Idade atualizada: /.test(fn));

// Resumo: peso em linhas
var L = function(s){ return proEstadoRows(s).filter(function(r){ return /Peso|Objetivo|Nesta fase/.test(r.label); }).map(function(r){ return r.label + "=" + r.text; }); };
var cut = L({weightCurrent: 53.5, weightInitial: 58.5, weightGoal: 51});
check.check("11. Peso em linhas separadas: peso atual, objetivo (faltam) e peso perdido desde o início", JSON.stringify(cut) === JSON.stringify(["Peso atual=53,5 kg", "Objetivo=51,0 kg · faltam 2,5 kg", "Peso perdido=5,0 kg desde o início"]));
check.check("12. Se o peso sobe, a linha passa sozinha a «Peso ganho»; objetivo atingido diz «atingido»", JSON.stringify(L({weightCurrent: 80, weightInitial: 74, weightGoal: 80})) === JSON.stringify(["Peso atual=80,0 kg", "Objetivo=80,0 kg · atingido", "Peso ganho=6,0 kg desde o início"]));
var bulk = L({weightCurrent: 55.2, weightInitial: 58.5, weightGoal: 60, nutritionPhase: {phase: "bulk", startDate: "2026-12-02", startWeight: 54}});
check.check("13. Numa fase (ex.: Bulk depois do Cut) aparece «Nesta fase» a contar desde o início da fase, com o objetivo novo", bulk.length === 4 && /^Objetivo=60,0 kg · faltam 4,8 kg$/.test(bulk[1]) && /^Nesta fase=ganhos 1,2 kg desde /.test(bulk[3]));
check.check("14. Sem fase iniciada depois do início não há linha «Nesta fase»", L({weightCurrent: 53.5, weightInitial: 58.5, weightGoal: 51, nutritionPhase: {phase: "cut", startDate: "2026-04-22", startWeight: 58.5}}).length === 3);

// sem Notas privadas nem Apagar aluno no Perfil
check.check("15. O Perfil já não tem «Notas privadas» nem «Apagar aluno» e o código das notas datadas saiu", !/Notas privadas|Apagar aluno|stuDeleteBtn|proNotes/.test(vazio) && !/addDatedNote|prependDatedNote|function tplProNotas/.test(appSource));
check.check("16. Apagar continua na lista de alunos (botão com confirmação)", /data-del-student=/.test(appSource) && typeof openDeleteStudentModal === "function");
check.summarize();
