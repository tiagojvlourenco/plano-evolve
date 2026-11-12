// Enviar a evolução ao aluno: resumo, mensagem de WhatsApp e imagem 1080×1350 (+ botão e janela).
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var hoje = localTodayISO(), ha = function(n){ return addDaysISO(hoje, -n); };
var W = []; for (var i = 120; i >= 0; i -= 2) W.push({date: ha(i), w: 58.5 - (120 - i) * 0.04});
var s = {name: "Diana Lourenço", weightInitial: 58.5, weightCurrent: 53.7, weightGoal: 51, weights: W, assessments: [{date: ha(5), weight: 53.7, bodyFat: 25.1}], sex: "Feminino", age: 36};
var sum = evolutionSummary(s, 0);
check.check("1. Resumo: peso atual, inicial, objetivo, diferença, primeiro nome e período", sum && sum.cur === 53.7 && sum.init === 58.5 && sum.goal === 51 && sum.diff === -4.8 && sum.first === "Diana" && sum.from === ha(120) && sum.to === ha(0) && sum.bf === 25.1);
check.check("2. O período corta as pesagens (3 meses = últimos 90 dias); com menos de 2 pesagens não há resumo", evolutionSummary(s, 90).pts.every(function(p){ return p.x >= dayNum(ha(0)) - 90; }) && evolutionSummary({weights: [{date: ha(1), w: 60}]}, 0) === null && evolutionSummary(s, 1) === null);
var m = evolutionMessage(sum);
check.check("3. Mensagem: cumprimenta pelo nome, peso, variação desde o início, objetivo (faltam) e tendência", /^Olá Diana! Aqui está a tua evolução: peso atual 53,7 kg \(−4,8 kg desde o início\)\. Objetivo: 51,0 kg \(faltam 2,7 kg\)\./.test(m) && /Tendência recente: [−+][\d,]+ kg\/semana\./.test(m) && /Segue o plano, estou contigo\.$/.test(m));
check.check("4. Objetivo atingido diz «atingido!»; sem objetivo não fala dele", /atingido!/.test(evolutionMessage(Object.assign({}, sum, {goal: 53.7}))) && !/Objetivo/.test(evolutionMessage(Object.assign({}, sum, {goal: null}))));
// desenho com um contexto que regista as chamadas
var calls = [], texts = [];
var ctx = new Proxy({}, {get: function(t, k){ if (k === "measureText") return function(x){ return {width: String(x).length * 10}; }; if (k === "canvas") return null; return function(){ if (k === "fillText") texts.push(arguments[0]); calls.push(k); }; }, set: function(){ return true; }});
var cv = {getContext: function(){ return ctx; }};
drawEvolutionSlide(cv, Object.assign({logo: null}, sum));
check.check("5. Imagem 1080×1350 com o peso grande, a variação, as datas e a marca EVOLVE (sem logótipo, em texto)", cv.width === 1080 && cv.height === 1350 && texts.indexOf("53,7 KG") >= 0 && texts.indexOf("−4,8 kg desde o início") >= 0 && texts.indexOf("A EVOLUÇÃO DE DIANA") >= 0 && texts.indexOf("≡EVOLVE≡") >= 0 && texts.some(function(t){ return /→/.test(t) && /tendência/.test(t); }));
check.check("6. Imagem: quadros inicial/atual/diferença/objetivo e o objetivo no gráfico; linha de tendência desenhada", ["INICIAL", "ATUAL", "DIFERENÇA", "OBJETIVO"].every(function(t){ return texts.indexOf(t) >= 0; }) && texts.indexOf("objetivo 51,0") >= 0 && calls.indexOf("stroke") >= 0 && calls.indexOf("arc") >= 0);
texts = []; drawEvolutionSlide(cv, Object.assign({logo: null}, sum, {goal: null, init: null, diff: null}));
check.check("7. Sem objetivo e sem peso inicial a imagem não inventa quadros (mostra massa gorda se houver)", texts.indexOf("OBJETIVO") < 0 && texts.indexOf("INICIAL") < 0 && texts.indexOf("MASSA GORDA") >= 0 && texts.indexOf("25,1 %") >= 0);
var ev = tplEvolucaoAluno(Object.assign({photos: [], planHistory: []}, s), {editable: true}), al = tplEvolucaoAluno(Object.assign({photos: [], planHistory: []}, s), {editable: false});
check.check("8. Botão «Enviar evolução ao aluno» só no ecrã do profissional (e só com pesagens)", /id="sendEvolution"/.test(ev) && !/id="sendEvolution"/.test(al) && !/id="sendEvolution"/.test(tplEvolucaoAluno({weights: [], photos: [], planHistory: []}, {editable: true})));
var fn = appSource.slice(appSource.indexOf("function openEvolutionShare"), appSource.indexOf("function comparisonHeadFor"));
check.check("9. Janela: períodos, pré-visualização, «Enviar imagem» (folha de partilha), mensagem editável e WhatsApp com registo do contacto", /data-evr/.test(fn) && /deliverComparisonImage\(\[\{blob: blobNow/.test(fn) && /whatsappUrl\(s\.phone, msg\.value\.trim\(\)\)/.test(fn) && /contactLogAdd\(s, \{kind: "contacto", channel: "whatsapp", reason: "generico"\}\)/.test(fn) && /Sem telefone na ficha/.test(fn) && /openEvolutionShare\(s\)/.test(appSource));

// «Enviar imagem»: a mensagem vai como texto da partilha (se o aparelho aceitar) e fica copiada para colar como legenda no WhatsApp
var navSaved = global.navigator, shared = null;
function withShare(canText){
  Object.defineProperty(global, "navigator", {configurable: true, writable: true, value: {canShare: function(d){ return !!d.files && (canText || !("text" in d)); }, share: function(d){ shared = d; return Promise.resolve(); }}});
}
var png = new Blob([new Uint8Array([137, 80, 78, 71])], {type: "image/png"});
withShare(true); shared = null; deliverComparisonImage([{blob: png, name: "evolucao.png"}], null, "Diana", "Olá Diana! Aqui está a tua evolução.");
check.check("10. A imagem vai para a folha de partilha com o título e a mensagem como texto (o WhatsApp pode usá-la como legenda)", shared && shared.files.length === 1 && shared.files[0].type === "image/png" && /Diana/.test(shared.title) && shared.text === "Olá Diana! Aqui está a tua evolução.");
withShare(false); shared = null; deliverComparisonImage([{blob: png, name: "evolucao.png"}], null, "Diana", "Olá!");
check.check("11. Se o aparelho não aceita imagem com texto, a imagem vai na mesma (sem o texto)", shared && shared.files.length === 1 && !("text" in shared));
withShare(true); shared = null; deliverComparisonImage([{blob: png, name: "evolucao.png"}], null, "Diana");
check.check("12. Sem mensagem (comparações de fotografias) nada muda: só imagem e título", shared && !("text" in shared));
Object.defineProperty(global, "navigator", {configurable: true, writable: true, value: navSaved});
check.check("13. «Enviar imagem» copia a mensagem (aviso «Mensagem copiada») e a nota explica que o WhatsApp não abre a conversa já com a imagem", /navigator\.clipboard\.writeText\(text\)/.test(fn) && /Mensagem copiada: cola-a como legenda/.test(fn) && /não tem ligação que abra a conversa de um número já com uma imagem/.test(fn) && /deliverComparisonImage\(\[\{blob: blobNow[\s\S]*?, null, s\.name, text\)/.test(fn));

check.summarize();
