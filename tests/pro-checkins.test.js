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
// Perfil: cada secção mostra o essencial no resumo
var st = {name: "Ana Teste", age: 30, height: 170, weightCurrent: 65.5, phone: "912345678", work: "Escritório", allergies: ["Marisco", "Frutos secos"], waterIntake: "2 L", likes: [], dislikes: [], avoid: [], supplements: [], targets: {}, meals: [], medicalConditions: "Hipertensão"};
var m = perfilMetas(st);
check.check("8. Perfil: dados pessoais, contacto e dados médicos resumidos", m.pessoais === "30 anos · 170 cm · 65,5 kg" && m.contacto === "912345678" && m.medicos === "1 de 4 preenchidos");
check.check("9. Perfil: as alergias aparecem no resumo da Alimentação (e a falta delas também)", m.alimentacao === "2 alergias/restrições" && perfilMetas({allergies: []}).alimentacao === "sem alergias registadas");
check.check("10. Perfil: sem dados, resumos neutros", perfilMetas({}).contacto === "sem contacto" && perfilMetas({}).medicos === "por preencher" && perfilMetas({}).pessoais === "");
var sec = perfilSection("Rotina", false, "<p>x</p>", "<b>x</b>");
check.check("11. O resumo é escapado e a secção continua fechada por omissão", sec.indexOf("<b>x</b>") < 0 && /&lt;b&gt;/.test(sec) && !/ open>/.test(sec) && perfilSection("T", false, "x").indexOf("pm-sum-meta") < 0);
// Histórico: 10 mais recentes à vista, anteriores recolhidos
var ph = []; for (var q = 1; q <= 14; q++) ph.push({type: "x", summary: "alteração " + q, date: "2026-01-" + ("0" + q).slice(-2)});
var hh = tplProHistorico({planHistory: ph, adaptationHistory: []});
check.check("12. Histórico: 14 alterações = 10 à vista + 4 recolhidas, mais recentes primeiro", (hh.match(/history-row/g) || []).length === 14 && /data-fold="histAntigo"/.test(hh) && /4 alterações/.test(hh) && hh.indexOf("alteração 14") < hh.indexOf("alteração 4<"));
check.check("13. Histórico: com 10 ou menos não há bloco recolhido", tplProHistorico({planHistory: ph.slice(0, 10), adaptationHistory: []}).indexOf("histAntigo") < 0);
// Treino: dias recolhíveis, novo exercício e progressão/sessões em blocos
var src = appSource.slice(appSource.indexOf("function tplProTreino(s){"));
check.check("14. Treino: o dia lembra se estava aberto e o formulário de novo exercício vem recolhido", /data-fold="dia:\$\{escapeHtml\(d\.id\)\}"/.test(src) && /<summary class="btn btn-sm">\+ Adicionar exercício<\/summary>/.test(src) && /data-exform=/.test(src));
check.check("15. Treino: progressão de carga e sessões registadas em blocos recolhíveis", /proFold\("progCarga"/.test(src) && /proFold\("sessoesReg"/.test(src));
// Avaliações: marcas de fase (cut/bulk) na tabela e coluna da data fixa
var av = [{date: "2026-10-20", weight: 70}, {date: "2026-10-05", weight: 71}, {date: "2026-09-20", weight: 72}, {date: "2026-09-01", weight: 73}];
var stp = {assessments: av, planHistory: [{type: "fase_inicio", date: "2026-09-15", summary: "Fase Cut iniciada (objetivo 65 kg): 1800 kcal", after: "cut"}], nutritionPhase: null};
var tb = tplAssessTable(stp, false);
check.check("16. A tabela marca o início do Cut entre as avaliações antes e depois", /▶ Cut · [^<]*15\/09\/2026 · objetivo 65 kg/.test(tb) && tb.indexOf("▶ Cut") > tb.indexOf("20/09/2026") && tb.indexOf("▶ Cut") < tb.indexOf("01/09/2026"));
check.check("17. As avaliações dentro da fase levam a cor do Cut; a anterior não", (tb.match(/date-cell ph-cut/g) || []).length === 3 && (tb.match(/class="date-cell"/g) || []).length === 1);
var stb = {assessments: av, planHistory: [{type: "fase_inicio", date: "2026-09-15", summary: "Fase Cut iniciada", after: "cut"}, {type: "fase_inicio", date: "2026-10-10", summary: "Fase Bulk iniciada", after: "bulk"}]};
var tb2 = tplAssessTable(stb, false);
check.check("18. Duas fases: Cut e depois Bulk, cada uma no sítio certo e com a sua cor", tb2.indexOf("▶ Bulk") < tb2.indexOf("▶ Cut") && /date-cell ph-bulk/.test(tb2) && /date-cell ph-cut/.test(tb2));
check.check("19. Sem fase não há marcas", tplAssessTable({assessments: av}, false).indexOf("phase-mark") < 0);
check.check("20. A fase atual conta mesmo sem evento no histórico", /▶ Bulk/.test(tplAssessTable({assessments: av, planHistory: [], nutritionPhase: {phase: "bulk", startDate: "2026-09-10", targetWeight: 80}}, false)));
check.check("21. A data vem numa linha e a hora por baixo (coluna estreita)", /20\/10\/2026/.test(tplAssessTable({assessments: [{date: "2026-10-20", time: "08:00", weight: 70}]}, false)) && /<br><span class="atime">08:00<\/span>/.test(tplAssessTable({assessments: [{date: "2026-10-20", time: "08:00", weight: 70}]}, false)));
// Notas dentro do Perfil
var pf = tplProPerfil({name: "Ana", notes: "algo", likes: [], dislikes: [], avoid: [], allergies: [], supplements: [], targets: {}, meals: []});
check.check("22. As notas privadas passaram para uma secção do Perfil (com o campo e o botão)", /Notas privadas<span class="pm-sum-meta">com notas/.test(pf) && /id="proNotes"/.test(pf) && /id="saveNotes"/.test(pf) && /id="addDatedNote"/.test(pf));
check.check("23. O separador Notas deixou de existir na navegação", !/"perfil", "notas"/.test(appSource) && !/\["perfil", "notas"\]/.test(appSource));
// Imagem de antes e depois (estilo publicação): cabeçalho com peso e massa gorda, fotos lado a lado, barra laranja e marca
var sc = {assessments: [{date: "2026-01-10", weight: 73.4, bodyFat: 39.8}, {date: "2026-09-10", weight: 56.9, bodyFat: 19.5}], weights: []};
var hA = comparisonHeadFor(sc, "2026-01-10"), hB = comparisonHeadFor(sc, "2026-09-10");
check.check("24. O cabeçalho de cada lado traz o peso e a massa gorda da data", hA.weight === 73.4 && hA.fat === 39.8 && hB.weight === 56.9 && hB.fat === 19.5);
check.check("25. Sem medições o cabeçalho fica vazio (não inventa valores)", comparisonHeadFor({assessments: [], weights: []}, "2026-01-10").weight === null && comparisonHeadFor({assessments: [], weights: []}, "2026-01-10").fat === null);
var dsrc = appSource.slice(appSource.indexOf("function drawComparisonSlide"), appSource.indexOf("function comparisonHeadFor"));
check.check("26. A imagem é 1080×1350 com fundo preto, «Massa Gorda:», contador n/total, barra laranja e marca EVOLVE", /COMPARE_SLIDE_W = 1080, COMPARE_SLIDE_H = 1350/.test(appSource) && /#000000/.test(dsrc) && /Massa Gorda: /.test(dsrc) && /d\.index \+ "\/" \+ d\.total/.test(dsrc) && /#E85D2C/.test(dsrc) && /EVOLVE/.test(dsrc));
var dl = appSource.slice(appSource.indexOf("function downloadPhotoComparison"), appSource.indexOf("// O profissional carrega uma foto"));
check.check("27. Gera uma imagem por posição com foto (frente, lado, costas) e entrega-as todas de uma vez", /filter\(function\(x\)\{ return x\.pa \|\| x\.pb; \}\)/.test(dl) && /deliverComparisonImage\(items, null, s\.name\)/.test(dl));
check.check("28. «Nova avaliação» já não tem texto de resumo ao lado", /proFold\("novaAval", "Nova avaliação", ""/.test(appSource));
check.check("29. O logótipo vem de logo-evolve.jpg (com recurso a texto) e o ficheiro existe no projeto", /loadImageAsElement\("logo-evolve\.jpg"\)/.test(appSource) && /d\.logo/.test(appSource) && require("fs").existsSync(__dirname + "/../logo-evolve.jpg"));
var idx = require("fs").readFileSync(__dirname + "/../index.html", "utf8");
check.check("31. Na Gestão o logótipo fica escondido", /html\[data-app="gestao"\] \.brand-logo\{display:none;\}/.test(require("fs").readFileSync(__dirname + "/../app.css", "utf8")));
check.check("30. O logótipo aparece no ecrã de carregamento e no de entrada (ficheiro recortado existe)", (idx.match(/logo-evolve-wordmark\.jpg/g) || []).length === 2 && ["treino", "gestao"].every(function(n){ return (require("fs").readFileSync(__dirname + "/../" + n + ".html", "utf8").match(/logo-evolve-wordmark\.jpg/g) || []).length === 2; }) && require("fs").existsSync(__dirname + "/../logo-evolve-wordmark.jpg"));
check.summarize();
