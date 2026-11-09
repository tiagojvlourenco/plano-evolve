// Apagar um aluno a partir da lista do painel (sem entrar na ficha): o botão abre a mesma janela de confirmação.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var src = appSource.slice(appSource.indexOf("function wireStudentList"), appSource.indexOf("function wireStudentList") + 1800);
check.check("1. Cada linha da lista tem um botão de apagar com o nome do aluno (acessível)", /data-del-student=/.test(appSource) && /aria-label=\\"Apagar " \+ escapeHtml\(st\.name\)/.test(appSource));
check.check("2. O botão não abre a ficha (para a propagação) e chama a janela de confirmação", /data-del-student[\s\S]{0,200}stopPropagation\(\)[\s\S]{0,200}openDeleteStudentModal\(st\)/.test(src));
check.check("3. A janela de confirmação continua a ser a única forma de apagar (Cancelar / Apagar)", /id=\\"delCancel\\"/.test(appSource) && /deleteStudentCompletely\(s\)\.then/.test(appSource));
check.summarize();
