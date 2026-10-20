// Apagar aluno de vez (ficha + fotos) e o painel sem «Eu» nem alertas.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

function mk(extra){ var s = buildFullDemoStudent(); s.id = "n1"; s.name = "Nuno Teste"; s.isDemo = false; s.active = true; s.photos = []; return Object.assign(s, extra || {}); }
var calls = [];
var chain = { eq: function(c, v){ calls.push("delete students " + c + "=" + v); return chain; }, then: function(ok, ko){ return Promise.resolve({error: null}).then(ok, ko); } };
var fake = { from: function(){ return { delete: function(){ return chain; } }; }, storage: { from: function(b){ return { remove: function(paths){ calls.push("remove " + b + " " + paths.join(",")); return Promise.resolve({error: null}); } }; } } };
var s = mk({id: "del1", name: "Apagar Teste", photos: [{date: "2025-01-01", path: "uid/1.jpg", position: "frente"}], weightLogPhotos: [{date: "2025-01-02", path: "uid/2.jpg"}]});
STUDENTS = [s, mk({id: "outro"})];
var realSb = sb, realReady = sbReady; sb = fake; sbReady = true;
deleteStudentCompletely(s).then(function(r){
  sb = realSb; sbReady = realReady;
  check.check("1. Apagar aluno: remove as fotos do Storage, apaga a linha do aluno e tira-o da lista", !r.error && calls[0] === "remove progress-photos uid/1.jpg,uid/2.jpg" && calls[1] === "delete students id=del1" && STUDENTS.length === 1 && STUDENTS[0].id === "outro");
  check.check("2. O perfil tem «Apagar aluno» ", /id="stuDeleteBtn"/.test(tplProPerfil(mk())) && typeof openDeleteStudentModal === "function");
  check.check("3. O painel já não tem «Eu», «Alertas» nem alertas nas linhas", DASH_ALERTS_ENABLED === false && computeDashboardAlerts(mk({alerts: [{type: "critical", text: "x"}]})).length === 0 && !/id="navMe">Eu/.test(appSource));
  check.summarize();
});
