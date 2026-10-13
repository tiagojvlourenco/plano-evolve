// Treino: demonstração e pontos-chave por exercício, RIR por série, histórico de cargas e sugestão de sobrecarga progressiva.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

function iso(daysAgo){ return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10); }
function log(daysAgo, exId, name, sets){ return {id: "w" + daysAgo, date: iso(daysAgo), dayId: "d1", dayName: "A", rpe: 7, notes: "", entries: [{exerciseId: exId, name: name, sets: sets}]}; }
function rep3(load, reps, rir){ return [0, 1, 2].map(function(){ var o = {reps: reps, load: load}; if (rir != null) o.rir = rir; return o; }); }

// ---------- 1. demonstração e pontos-chave ----------
(function(){
  check.check("1. Só aceita ligações https sem espaços ou aspas", cleanDemoUrl("https://x.pt/a.gif") === "https://x.pt/a.gif" && cleanDemoUrl("http://x.pt/a.gif") === "" && cleanDemoUrl("javascript:alert(1)") === "" && cleanDemoUrl("https://x.pt/a b") === "" && cleanDemoUrl("https://x.pt/\"onload=1") === "" && cleanDemoUrl("") === "");
  check.check("2. Distingue imagem/GIF, vídeo e página", demoKindOf("https://x/a.GIF") === "image" && demoKindOf("https://x/a.webp?x=1") === "image" && demoKindOf("https://x/a.mp4") === "video" && demoKindOf("https://youtu.be/abc") === "link");
  check.check("3. Os pontos-chave: uma linha cada, sem marcadores, no máximo 3 e 120 caracteres", JSON.stringify(parseCues("- Omoplatas juntas\n• Barra ao peito\n\n  Pés firmes ;  quarto ponto\n")) === JSON.stringify(["Omoplatas juntas", "Barra ao peito", "Pés firmes"]) && parseCues("x".repeat(300))[0].length === 120 && parseCues(null).length === 0);
  var img = exerciseMediaHtml("https://x.pt/s.gif"), vid = exerciseMediaHtml("https://x.pt/s.mp4"), lnk = exerciseMediaHtml("https://youtu.be/abc");
  check.check("4. A demonstração aparece como imagem, vídeo em ciclo ou ligação segura", /<img class="ex-demo" src="https:\/\/x\.pt\/s\.gif"/.test(img) && /<video[^>]*loop[^>]*muted/.test(vid) && /rel="noopener noreferrer"/.test(lnk) && exerciseMediaHtml("javascript:alert(1)") === "");

  var s = {id: "a", trainingProgram: {name: "P", days: [{id: "d1", name: "A", exercises: []}]}};
  var ex = addProgramExercise(s, "d1", {name: "Supino", sets: 3, reps: "8-12", demo: "https://x.pt/s.gif", cues: "A\nB\nC\nD"});
  check.check("5. O exercício guarda demonstração e até 3 pontos-chave", ex.demo === "https://x.pt/s.gif" && ex.cues.length === 3);
  var ex2 = addProgramExercise(s, "d1", {name: "Remo", demo: "http://inseguro"});
  check.check("6. Uma ligação inválida fica de fora, o exercício guarda-se na mesma", ex2 && ex2.demo === null && ex2.cues.length === 0);
  check.check("7. Editar o guia: guarda, limpa e recusa ligações inválidas", updateProgramExerciseGuide(s, "d1", ex2.id, {demo: "https://x.pt/r.mp4", cues: "Costas retas"}) && ex2.demo === "https://x.pt/r.mp4" && ex2.cues[0] === "Costas retas" && !updateProgramExerciseGuide(s, "d1", ex2.id, {demo: "ftp://x", cues: ""}) && ex2.demo === "https://x.pt/r.mp4" && updateProgramExerciseGuide(s, "d1", ex2.id, {demo: "", cues: ""}) && ex2.demo === null);
  var tpl = trainingTemplateFrom(s), s2 = {id: "b"};
  applyTrainingTemplate(s2, tpl, "replace");
  check.check("8. Os templates de treino levam a demonstração e os pontos-chave", s2.trainingProgram.days[0].exercises[0].demo === "https://x.pt/s.gif" && s2.trainingProgram.days[0].exercises[0].cues.length === 3);
})();

// ---------- 2. RIR e histórico ----------
(function(){
  var s = {id: "a", workoutLogs: []};
  var l = logWorkout(s, {date: iso(0), dayId: "d1", dayName: "A", entries: [{exerciseId: "e1", name: "Supino", sets: [{reps: 10, load: 60, rir: 2}, {reps: 9, load: 60, rir: "1"}, {reps: 8, load: 60, rir: 15}, {reps: 8, load: 60}]}]});
  var sets = l.entries[0].sets;
  check.check("9. O RIR guarda-se por série (0 a 10) e é opcional", sets[0].rir === 2 && sets[1].rir === 1 && !("rir" in sets[2]) && !("rir" in sets[3]));
  var n = normalizeWorkoutLogs([{date: iso(0), entries: [{name: "X", sets: [{reps: 8, load: 50, rir: 3}, {reps: 8, load: 50, rir: -1}, {reps: 8, load: 50}]}]}])[0].entries[0].sets;
  check.check("10. Ao ler da base de dados o RIR mantém-se, e valores inválidos são ignorados", n[0].rir === 3 && !("rir" in n[1]) && !("rir" in n[2]));
  var ex = {id: "e1", name: "Supino"};
  var s3 = {id: "c", workoutLogs: [log(14, "e1", "Supino", rep3(50, 8)), log(0, "e1", "Supino", rep3(55, 8)), log(7, "e1", "Supino", rep3(52.5, 8))]};
  var sess = exerciseSessions(s3, ex, 2);
  check.check("11. As últimas sessões vêm da mais recente para a mais antiga, com as séries", sess.length === 2 && sess[0].date === iso(0) && sess[1].date === iso(7) && sess[0].sets.length === 3);
  check.check("12. O detalhe de cada série mostra carga, repetições e RIR", fmtSetDetail({load: 60, reps: 10, rir: 2}) === "60 kg × 10 · RIR 2" && fmtSetDetail({load: 0, reps: 12}) === "12 reps");
})();

// ---------- 3. sobrecarga progressiva ----------
(function(){
  function prog(reps, sets){ return {id: "e1", name: "Supino", sets: sets || 3, reps: reps}; }
  function stu(logs){ return {id: "x", workoutLogs: logs}; }
  var ok = stu([log(7, "e1", "Supino", rep3(60, 12)), log(0, "e1", "Supino", rep3(60, 12))]);
  var sg = overloadSuggestion(ok, prog("8-12"));
  check.check("13. Meta superior (12) em todas as séries nas 2 últimas sessões à mesma carga: sobe 5 % (60 → 63 kg)", sg && sg.from === 60 && sg.to === 63 && sg.inc === 3);
  check.check("14. O aumento nunca é menor que 2 kg (20 kg → 22 kg) e arredonda a 0,5 (50 kg → 52,5)", overloadSuggestion(stu([log(7, "e1", "Supino", rep3(20, 12)), log(0, "e1", "Supino", rep3(20, 12))]), prog("8-12")).to === 22 && overloadSuggestion(stu([log(7, "e1", "Supino", rep3(50, 12)), log(0, "e1", "Supino", rep3(50, 12))]), prog("8-12")).to === 52.5);
  check.check("15. Com uma só sessão não sugere", overloadSuggestion(stu([log(0, "e1", "Supino", rep3(60, 12))]), prog("8-12")) === null);
  check.check("16. Se uma série ficou abaixo da meta, não sugere", overloadSuggestion(stu([log(7, "e1", "Supino", rep3(60, 12)), log(0, "e1", "Supino", [{reps: 12, load: 60}, {reps: 12, load: 60}, {reps: 10, load: 60}])]), prog("8-12")) === null);
  check.check("17. Se a carga mudou entre as sessões, não sugere", overloadSuggestion(stu([log(7, "e1", "Supino", rep3(57.5, 12)), log(0, "e1", "Supino", rep3(60, 12))]), prog("8-12")) === null);
  check.check("18. Em peso do corpo (sem carga) não há carga para subir", overloadSuggestion(stu([log(7, "e1", "Supino", rep3(0, 15)), log(0, "e1", "Supino", rep3(0, 15))]), prog("8-12")) === null);
  check.check("19. Um intervalo simples (10) conta como meta", overloadSuggestion(stu([log(7, "e1", "Supino", rep3(40, 10)), log(0, "e1", "Supino", rep3(40, 10))]), prog("10")).to === 42);
  check.check("20. Duas séries à carga máxima chegam num exercício de 4 séries, uma só não", !!overloadSuggestion(stu([log(7, "e1", "Supino", [{reps: 12, load: 60}, {reps: 12, load: 60}, {reps: 8, load: 50}]), log(0, "e1", "Supino", [{reps: 12, load: 60}, {reps: 12, load: 60}, {reps: 8, load: 50}])]), prog("8-12", 4)) && overloadSuggestion(stu([log(7, "e1", "Supino", [{reps: 12, load: 60}, {reps: 8, load: 50}]), log(0, "e1", "Supino", [{reps: 12, load: 60}, {reps: 8, load: 50}])]), prog("8-12", 4)) === null);
  var tough = overloadSuggestion(stu([log(7, "e1", "Supino", rep3(60, 12, 0)), log(0, "e1", "Supino", rep3(60, 12, 0))]), prog("8-12"));
  check.check("21. Com RIR médio abaixo de 1 avisa que as séries ficaram no limite", tough.tough === true && /limite/.test(overloadDetail(tough)) && !overloadSuggestion(ok, prog("8-12")).tough);
  check.check("22. O texto e o selo mostram a nova carga e o aumento", overloadText(sg) === "Subir carga: 63 kg (+3 kg)" && /📈 Subir carga: 63 kg/.test(overloadBadgeHtml(sg)) && overloadBadgeHtml(null) === "");
  var ex = {id: "e1", name: "Supino", sets: 3, reps: "8-12", cues: ["Omoplatas juntas"], demo: "https://x.pt/s.gif"};
  var info = exerciseInfoHtml(ok, ex);
  check.check("23. O detalhe do exercício junta demonstração, pontos-chave, sugestão e histórico", /ex-demo/.test(info) && /Omoplatas juntas/.test(info) && /Subir carga: 63 kg/.test(info) && /Histórico de cargas/.test(info) && /60 kg × 12/.test(info));
  check.check("24. Sem guia nem sessões o detalhe explica o que falta", /ainda não acrescentou/.test(exerciseInfoHtml(stu([]), {id: "z", name: "Y", sets: 3, reps: "10"})) && /Ainda sem sessões/.test(exerciseInfoHtml(stu([]), {id: "z", name: "Y", sets: 3, reps: "10"})));

  var full = {id: "x", workoutLogs: ok.workoutLogs, trainingProgram: {name: "P", days: [{id: "d1", name: "A", exercises: [{id: "e1", name: "Supino", sets: 3, reps: "8-12", rpe: null, rest: 90, notes: ""}]}]}};
  var html = tplWorkoutLogger(full);
  check.check("25. O registo do treino tem o nome clicável, o campo RIR por série e o selo de sobrecarga", /data-ex-info="e1"/.test(html) && (html.match(/data-wl-rir=/g) || []).length === 3 && /Subir carga: 63 kg/.test(html));
  check.check("26. A carga já vem preenchida com a sugerida (63 kg)", /data-wl-load="e1:0"[^>]*value="63"/.test(html));
  check.check("27. O profissional vê no dashboard que há exercícios prontos para subir carga", computeCoachBadges(full).some(function(b){ return b.key === "sobrecarga" && b.tone === "good"; }));
  check.check("28. O envio do treino grava o RIR da série", /data-wl-rir="' \+ e\.id/.test(appSource) && /one\.rir = ri/.test(appSource));
})();
check.summarize();
