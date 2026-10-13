// Aviso no modo Aluno do profissional: o que registar fica na ficha do aluno que está a ver (só avisa, não bloqueia).
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

var html = previewBannerHtml({name: "Maria Silva"});
check.check("1. O aviso diz com que aluno se está a ver a app", /A ver como <strong>Maria Silva<\/strong>/.test(html));
check.check("2. O aviso diz que o registo fica na ficha desse aluno", /fica guardado na ficha de Maria/.test(html));
check.check("3. O nome é escapado (sem HTML injetado)", previewBannerHtml({name: "<img src=x onerror=1>"}).indexOf("<img") < 0);
var shell = appSource.slice(appSource.indexOf("function renderAlunoShell"), appSource.indexOf("function renderAlunoShell") + 1600);
check.check("4. O aviso só aparece quando quem vê não é o próprio aluno (showSwitcher)", /showSwitcher \? previewBannerHtml\(s\) : ""/.test(shell) && /var showSwitcher = authRole !== "student"/.test(shell));
check.check("5. O aviso não bloqueia nada: é só texto (sem botões nem desativar guardar)", html.indexOf("<button") < 0 && html.indexOf("disabled") < 0);
check.summarize();
