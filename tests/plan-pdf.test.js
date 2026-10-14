// PDF do plano alimentar: conteúdo (puro), ficheiro válido (estrutura, xref, texto acentuado), paginação e entrega.
require("./setup")();
eval(require("./extract-app")());
var check = require("./check")();

function student(extra){
  return Object.assign({
    id: "t1", name: "Tiago Lourenço", sex: "Masculino", age: 33, height: 178, weightCurrent: 80, weights: [], flexibility: 20, flexOverrides: {}, blockedFoods: [], planHistory: [],
    notes: "NOTA PRIVADA DA EQUIPA", medicalConditions: "", supplements: [],
    targets: {kcal: 2200, protein: 160, carbs: 250, fat: 70},
    meals: [meal("Almoço", "13:00", [food("Arroz (cozido)", "180 g", "hidratos")]), meal("Pequeno-almoço", "08:00", [food("Aveia", "50 g", "hidratos"), food("Ovos", "2 unid.")]), meal("Jantar", "20:00", [food("Frango (peito)", "150 g")]), meal("Ceia", "22:00", [])]
  }, extra || {});
}
function bin(bytes){ var t = ""; for (var i = 0; i < bytes.length; i++) t += String.fromCharCode(bytes[i]); return t; }

// ---- pronto para exportar ----
check.check("1. Só se exporta com refeições com alimentos", planReadyForExport(student()) && !planReadyForExport(student({meals: []})) && !planReadyForExport(student({meals: [meal("Almoço", "13:00", [])]})) && !planReadyForExport(null));

// ---- conteúdo ----
var s = student(), before = JSON.stringify(s.meals);
var plan = buildPlanDoc(s);
check.check("2. As refeições vão por ordem da hora, sem as vazias, e o plano guardado não é alterado", plan.meals.map(function(m){ return m.name; }).join("|") === "Pequeno-almoço|Almoço|Jantar" && JSON.stringify(s.meals) === before);
check.check("3. Leva o nome, a data por extenso e os alvos do dia", plan.name === "Tiago Lourenço" && /\d{4}/.test(plan.dateLabel) && plan.targets.kcal === 2200 && plan.targets.protein === "160" && plan.targets.carbs === "250" && plan.targets.fat === "70");
check.check("4. Alvos em intervalo saem como «140–160»; sem alvos não há faixa", buildPlanDoc(student({targets: {kcal: 2000, proteinMin: 140, proteinMax: 160, carbs: 200, fat: 60}})).targets.protein === "140–160" && buildPlanDoc(student({targets: {kcal: 0, protein: 0, carbs: 0, fat: 0}})).targets === null);
check.check("5. A creatina vai só no pequeno-almoço, com a dose e a nota do horário", plan.meals[0].creatine && plan.meals[0].creatine.g === 4 && /qualquer altura do dia/.test(plan.meals[0].creatine.note) && !plan.meals[1].creatine && !plan.meals[2].creatine);
check.check("6. Retirada (ou por confirmar), a creatina não vai no PDF", buildPlanDoc(student({blockedFoods: [CREATINE_NAME]})).meals[0].creatine === null && buildPlanDoc(student({age: 16})).meals[0].creatine === null);
check.check("7. Os alimentos trocáveis levam asterisco; os fixos não; e há legenda", plan.meals[0].foods[0].swap === true && plan.meals[0].foods[1].swap === false && plan.hasSwap === true);
var risk = buildPlanDoc(student({allergies: "frutos secos"}));
check.check("8. Com restrições por mapear não se sugerem trocas (nada de asterisco)", risk.risk === true && risk.hasSwap === false && risk.meals.every(function(m){ return m.foods.every(function(f){ return !f.swap; }); }));
check.check("9. O que é privado (notas da equipa) nunca vai no documento", JSON.stringify(plan).indexOf("PRIVADA") < 0);
check.check("10. Os totais da refeição vêm dos alimentos", plan.meals[0].kcal === foodsTotals(s.meals[1].foods).kcal);

// ---- codificação e medidas ----
check.check("11. Acentos do português passam a um byte (ç, ã, é, ó) e travessão, ponto-médio e «≈» têm correspondência", pdfWinAnsi("Lourenço ão é ó") === "Louren\xE7o \xE3o \xE9 \xF3" && pdfWinAnsi("a–b") === "a\x96b" && pdfWinAnsi("a·b") === "a\xB7b" && pdfWinAnsi("≈") === "~");
check.check("12. O que não existe em WinAnsi passa à letra base ou a «?» (nunca quebra)", pdfWinAnsi("ń") === "n" && pdfWinAnsi("🙂") === "??" && pdfWinAnsi("a\tb") === "a b");
check.check("13. Larguras da Helvetica: 'i' é mais estreito que 'm'; negrito é mais largo; acentuada = letra base", pdfTextW("i", 10, false) < pdfTextW("m", 10, false) && pdfTextW("Aveia", 10, true) > pdfTextW("Aveia", 10, false) && pdfTextW("ã", 10, false) === pdfTextW("a", 10, false) && Math.abs(pdfTextW("Hello", 10, false) - 22.78) < 0.01);
var wrapped = pdfWrap("Alimento muito comprido com várias palavras para partir em linhas", 100, 10.5, false);
check.check("14. O texto parte-se em linhas dentro da largura (uma palavra mais larga fica sozinha)", wrapped.length >= 3 && wrapped.slice(0, -1).every(function(l){ return pdfTextW(l, 10.5, false) <= 100; }) && pdfWrap("", 100, 10, false).join("") === "");

// ---- o ficheiro ----
var bytes = renderPlanPdf(plan), raw = bin(bytes);
check.check("15. É um PDF (cabeçalho, fim de ficheiro) e pequeno", /^%PDF-1\.4/.test(raw) && /%%EOF\n$/.test(raw) && bytes.length < 40000 && bytes instanceof Uint8Array);
// a tabela xref aponta mesmo para cada objeto
var xrefPos = parseInt(/startxref\n(\d+)\n/.exec(raw)[1], 10), table = raw.slice(xrefPos);
var count = parseInt(/^xref\n0 (\d+)\n/.exec(table)[1], 10), entries = table.split("\n").slice(2, 2 + count).filter(function(l){ return /n $/.test(l); });
check.check("16. A tabela xref é coerente: cada entrada aponta para «N 0 obj»", entries.length === count - 1 && entries.every(function(l, i){ return raw.slice(parseInt(l.slice(0, 10), 10), parseInt(l.slice(0, 10), 10) + 20).indexOf((i + 1) + " 0 obj") === 0; }));
check.check("17. Tem Catalog, Pages, 3 tipos de letra (WinAnsi) e uma página", /\/Type \/Catalog/.test(raw) && /\/Count 1 /.test(raw) && /\/BaseFont \/Helvetica-Bold/.test(raw) && /\/BaseFont \/Helvetica-Oblique/.test(raw) && (raw.match(/\/Type \/Page /g) || []).length === 1 && /WinAnsiEncoding/.test(raw));
check.check("18. O comprimento declarado de cada stream é o real", (function(){ var ok = true; raw.replace(/\/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g, function(m, len, body){ if (+len !== body.length) ok = false; return m; }); return ok; })());
check.check("19. O texto (acentuado) está no ficheiro: nome, refeições, quantidades, creatina, nota do horário", raw.indexOf("(Tiago Louren\xE7o)") > 0 && raw.indexOf("(Pequeno-almo\xE7o)") > 0 && raw.indexOf("(Creatina mono-hidratada)") > 0 && raw.indexOf("(Pode ser tomada em qualquer altura do dia.)") > 0 && raw.indexOf("(180 g)") > 0 && raw.indexOf("(2200)") > 0);
check.check("20. Cores da marca: laranja #E85D2C e tinta #0D0F12 (RGB 0–1)", raw.indexOf("0.910 0.365 0.173 rg") > 0 && raw.indexOf("0.051 0.059 0.071 rg") > 0);
check.check("21. O logótipo EVOLVE desenha-se em vetor (círculo com 4 curvas, linhas e barras)", (raw.match(/ c /g) || []).length >= 4 && /h S/.test(raw) && /0 J 0 j/.test(raw));
check.check("22. Não leva dados privados nem notas", raw.indexOf("PRIVADA") < 0);
check.check("23. O rodapé diz a página e a legenda do asterisco", raw.indexOf("(EVOLVE \xB7 P\xE1gina 1 de 1)") > 0 && raw.indexOf("(* Podes trocar este alimento por um equivalente na app.)") > 0);

// plano grande: passa a duas páginas, sem partir cartões, com cabeçalho nas seguintes
var bigMeals = []; for (var i = 0; i < 9; i++){ var foods = []; for (var j = 0; j < 6; j++) foods.push(food("Alimento comprido número " + j + " com descrição longa", (100 + j) + " g")); bigMeals.push(meal("Refeição " + (i + 1), (7 + i) + ":00", foods)); }
var bigRaw = bin(renderPlanPdf(buildPlanDoc(student({meals: bigMeals}))));
check.check("24. Um plano grande paginar-se em mais páginas, todas com rodapé «Página X de Y»", (bigRaw.match(/\/Type \/Page /g) || []).length >= 2 && bigRaw.indexOf("P\xE1gina 2 de ") > 0 && bigRaw.indexOf("P\xE1gina 1 de ") > 0);
check.check("25. O texto cresce enquanto o plano cabe numa página (plano pequeno com letra maior que o grande)", (function(){ var m = /\/F2 ([\d.]+) Tf[^\n]*\(Pequeno-almo/.exec(raw), g = /\/F2 ([\d.]+) Tf[^\n]*\(Refei\xE7\xE3o 1\)/.exec(bigRaw); return m && g && parseFloat(m[1]) > parseFloat(g[1]); })());
check.check("26. Um único cartão alto continua a caber numa linha da página (nenhum cartão fica de fora)", (bigRaw.match(/\(Refei\xE7\xE3o \d\)/g) || []).length === 9);

// ---- entrega ----
var shared = null;
// (no Node 22 «navigator» é uma propriedade só de leitura: define-se à força)
Object.defineProperty(global, "navigator", {configurable: true, writable: true, value: {canShare: function(d){ return !!(d && d.files && d.files.length); }, share: function(d){ shared = d; return Promise.resolve(); }}});
check.check("27. No telemóvel, entrega o ficheiro à folha de partilha (imprimir, Ficheiros, WhatsApp)", exportPlanPdf(s) === true && shared && shared.files[0].type === "application/pdf" && /^plano-alimentar-tiago-lourenco-\d{4}-\d{2}-\d{2}\.pdf$/.test(shared.files[0].name));
check.check("28. Sem plano, avisa em vez de gerar um PDF vazio", (function(){ shared = null; var r = exportPlanPdf(student({meals: []})); return r === false && shared === null; })());
check.check("29. A data do nome do ficheiro é a local (não UTC)", (function(){ var d = new Date(); return localFileDate() === d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); })());
check.summarize();
