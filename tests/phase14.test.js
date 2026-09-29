// Fase 14 — mais correções encontradas ao testar no telemóvel real:
// (1) scrollIntoView do menu do profissional deslocava a página inteira;
// (2) copiar respostas do questionário continuava a falhar mesmo com o
//     fallback da Fase 13; (3) "Nome da refeição" passa a lista de escolha.
const fs = require("fs");
const path = require("path");
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

function freshStudent(overrides){
  var base = {
    id:"x", name:"Teste Aluno", flexibility:50, flexOverrides:{}, blockedFoods:[],
    substitutionHistory:[], adaptationHistory:[], photos:[], weightLogPhotos:[],
    likes:[], dislikes:[], avoid:[], allergies:[],
    targets:{kcal:2000, protein:150, carbs:200, fat:60},
    meals:[], planHistory:[]
  };
  Object.keys(overrides || {}).forEach(function(k){ base[k] = overrides[k]; });
  return base;
}

// ---- 1. Auto-centrar separador ativo sem deslocar a página inteira ----

// 1. renderProShell calcula scrollLeft manualmente, sem scrollIntoView
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function renderProShell"), appSource.indexOf("function renderProShell") + 3000);
  check.check("1. Já não usa scrollIntoView (confirmado a deslocar a página toda num telemóvel real)", fnSrc.indexOf(".scrollIntoView(") === -1);
  check.check("1. Lê container = .pro-sidebar", fnSrc.indexOf('querySelector(".pro-sidebar")') >= 0);
  check.check("1. Calcula o centro do separador ativo (offsetLeft + offsetWidth/2)", /activeNavItem\.offsetLeft\s*\+\s*activeNavItem\.offsetWidth\s*\/\s*2/.test(fnSrc));
  check.check("1. Usa container.scrollTo() em vez de atribuição direta a scrollLeft (nunca escala a ancestrais)", /container\.scrollTo\(\{/.test(fnSrc));
  // Confirmado ao vivo: mesmo container.scrollLeft = x herda scroll-behavior:smooth
  // do CSS neste motor de browser — só scrollTo({behavior:"instant"}) é garantidamente imediato.
  check.check("1. Força behavior:\"instant\" explicitamente (scrollLeft= sozinho não bastou)", /behavior:\s*"instant"/.test(fnSrc));
  check.check("1. Continua adiado com setTimeout (layout do DOM recém-inserido)", /setTimeout\(function\(\)\{[\s\S]*?container\.scrollTo/.test(fnSrc));
})();

// ---- 2. Copiar respostas do questionário: mostra sempre o texto, nunca depende só de deteção de erro ----

// 2. tryBackgroundCopy tenta a API moderna e o fallback clássico, sempre em segundo plano (nunca bloqueia)
(function(){
  check.check("2. tryBackgroundCopy existe", typeof tryBackgroundCopy === "function");
  check.check("2. legacyCopyFallback continua a existir (usado como fallback silencioso)", typeof legacyCopyFallback === "function");
  check.check("2. showCopyTextModal existe (via principal, não só fallback de erro)", typeof showCopyTextModal === "function");
  check.check("2. Funções antigas da Fase 13 foram removidas (não há duas vias em paralelo)", typeof copyTextToClipboard === "undefined" && typeof showCopyFallbackModal === "undefined");
})();

// 3. O clique em copyQuestionnaire mostra SEMPRE o modal, independentemente do resultado do clipboard
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function wireProTab"), appSource.indexOf("function wireProTab") + 20000);
  var block = fnSrc.slice(fnSrc.indexOf("copyQuestionnaire"), fnSrc.indexOf("copyQuestionnaire") + 300);
  check.check("3. Chama tryBackgroundCopy(text)", block.indexOf("tryBackgroundCopy(text)") >= 0);
  check.check("3. Chama showCopyTextModal(text) incondicionalmente (não dentro de .then/.catch)", block.indexOf("showCopyTextModal(text)") >= 0 && block.indexOf(".then(") === -1 && block.indexOf(".catch(") === -1);
})();

// 4. showCopyTextModal mostra o texto completo, já selecionado, sem alegar "não foi possível" (não sabemos se falhou)
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function showCopyTextModal"), appSource.indexOf("function showCopyTextModal") + 700);
  check.check("4. Usa openModal", fnSrc.indexOf("openModal(") >= 0);
  check.check("4. Textarea readonly com o texto", fnSrc.indexOf("readonly") >= 0);
  check.check("4. Seleciona o texto automaticamente", fnSrc.indexOf("ta.select()") >= 0);
  check.check("4. Já não afirma falha automática (não sabemos se a cópia em fundo resultou)", fnSrc.indexOf("Não foi possível copiar automaticamente") === -1);
})();

// ---- 3. "Nome da refeição" passa a ser uma lista de escolha (6 opções fixas) ----

// 5. tplPlanoMealEditor gera um <select> com as 6 refeições standard, pré-selecionando a atual
(function(){
  var m = meal("Almoço", "13:00", []);
  var html = tplPlanoMealEditor(m, 0);
  check.check("5. Usa <select> em vez de <input> para o nome", /<select class="pm-name"/.test(html));
  PLAN_SKELETON_MEALS.forEach(function(pair){
    check.check("5. Opção '" + pair[0] + "' presente", html.indexOf("<option" + (pair[0]==="Almoço"?" selected":"") + ">" + pair[0] + "</option>") >= 0);
  });
})();

// 6. Uma refeição com nome fora da lista (dado antigo/custom) não desaparece — vira opção extra selecionada
(function(){
  var m = meal("Refeição da tarde", "16:00", []);
  var html = tplPlanoMealEditor(m, 0);
  check.check("6. O nome custom aparece como opção extra selecionada", html.indexOf("<option selected>Refeição da tarde</option>") >= 0);
  check.check("6. As 6 opções standard continuam todas presentes", PLAN_SKELETON_MEALS.every(function(pair){ return html.indexOf(">" + pair[0] + "</option>") >= 0; }));
})();

// 7. wireProTab liga o <select> ao evento "change" (não "blur", que não existe da mesma forma num select)
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function wireProTab"), appSource.indexOf("function wireProTab") + 20000);
  check.check("7. Regista rename no evento change do .pm-name", /querySelectorAll\("\.pm-name"\)\.forEach\(function\(select\)\{\s*select\.addEventListener\("change"/.test(fnSrc));
  check.check("7. Continua a registar a mudança com logMealRenamed", /pm-name[\s\S]{0,400}logMealRenamed/.test(fnSrc));
})();

// 8. Nome com HTML/aspas continua seguro dentro do <option> (mesma proteção da Fase anterior, estrutura diferente)
(function(){
  var m = meal('Almoço <img src=x onerror=alert(1)>', "13:00", []);
  var html = tplPlanoMealEditor(m, 0);
  check.check("8. Sem tag <img> em bruto no HTML gerado", html.indexOf("<img src=x") === -1);
  check.check("8. Nome escapado aparece dentro do <option>", html.indexOf("Almoço &lt;img src=x onerror=alert(1)&gt;") >= 0);
})();

check.summarize();
