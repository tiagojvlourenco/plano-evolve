// Texto escrito pelo aluno (nome, objetivo, notas de check-in) vai para o ecrã do profissional: nunca como HTML cru.
require("./setup")();
var fs = require("fs");
var path = require("path");
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

var EVIL = '<img src=x onerror=alert(1)>';

(function(){
  var s = {id:"x", name:EVIL, goal:EVIL, notes:'</textarea><script>alert(1)</script>', initials:"XX", checkins:[{date:"2026-01-01", adherence:8, hunger:5, energy:5, weight:70, workouts:3, mealsOff:0, notes:EVIL}], meals:[], weights:[], assessments:[], photos:[], targets:{kcal:2000, protein:100, carbs:200, fat:60}, alerts:[], trainingDays:[], flexibility:50, allowPhotos:false};
  var out = [];
  ["tplProCheckins", "tplProNotas"].forEach(function(fn){
    try { if (typeof eval(fn) === "function") out.push(eval(fn)(s)); } catch (e) { out.push(""); }
  });
  var html = out.join("\n");
  check.check("1. Notas do check-in e notas do profissional são escapadas (sem <img onerror> nem </textarea> soltos)", html.indexOf(EVIL) === -1 && html.indexOf("</textarea><script>") === -1);
})();

(function(){
  var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  check.check("2. Nome/objetivo do aluno nunca são concatenados sem escapeHtml", !/\+ s\.name \+|\+ s\.goal \+|\+ s\.name\.split\(" "\)\[0\] \+/.test(html.replace("\"Questionário inicial de \" + s.name + \":\"", "")));
  check.check("3. Notas do check-in e do profissional são escapadas", html.indexOf('"<div class=\\"muted-p\\">" + c.notes + "</div>"') === -1 && html.indexOf('">" + s.notes + "</textarea>"') === -1);
  check.check("4. Nomes de alimentos nas vistas do aluno são escapados", html.indexOf('"<span class=\\"fname\\">" + f.name + "</span>"') === -1 && html.indexOf('+ f.name + "</div>"') === -1);
})();
check.summarize();
