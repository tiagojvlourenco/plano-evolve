// Ecrã de arranque (Phi + anel laranja): HTML igual nas três páginas, CSS, imagens de arranque do iPhone e a lógica que o dissolve.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var fs = require("fs");
var read = function(f){ return fs.readFileSync(__dirname + "/../" + f, "utf8"); };
var pages = {index: read("index.html"), treino: read("treino.html"), gestao: read("gestao.html")};
var css = read("app.css");
var splashOf = function(h){ var m = /<div id="evSplash"[\s\S]*?<\/svg><\/div><\/div>/.exec(h); return m ? m[0] : null; };

check.check("1. As três páginas têm o ecrã de arranque #evSplash (escondido dos leitores de ecrã) logo a seguir ao <body>", ["index", "treino", "gestao"].every(function(k){ return /<body>\s*<div id="evSplash" aria-hidden="true">/.test(pages[k]); }));
check.check("2. O HTML do arranque é exatamente o mesmo nas três páginas (o corpo das três tem de ser igual)", !!splashOf(pages.index) && splashOf(pages.index) === splashOf(pages.treino) && splashOf(pages.index) === splashOf(pages.gestao));
check.check("3. O desenho é o Phi do logótipo (círculo r=90 + barra de 20 numa caixa 200x320) e um anel fino", /<circle cx="100" cy="160" r="90"><\/circle><rect x="90" y="0" width="20" height="320"><\/rect>/.test(pages.index) && /class="ev-sp-ring" viewBox="0 0 100 100"/.test(pages.index));
check.check("4. CSS: fundo preto por cima de tudo, dissolução de 0,27 s a abrandar no fim, anel a alargar e Phi a crescer 5 %", /#evSplash\{[^}]*position:fixed[^}]*z-index:100000[^}]*background:#0a0a0a/.test(css) && /#evSplash\.out\{opacity:0; pointer-events:none; transition:opacity \.27s ease;\}/.test(css) && /\.out \.ev-sp-ring\{transform:scale\(1\.42\)/.test(css) && /\.out \.ev-sp-mark\{transform:scale\(1\.05\)/.test(css));
check.check("5. CSS: o anel é laranja a 65 % e o Phi branco; tamanhos do vídeo de referência (Phi 78 px, anel 79 px)", /stroke:#e85d26; stroke-opacity:\.65/.test(css) && /\.ev-sp-phi\{[^}]*width:48\.75px; height:78px/.test(css) && /\.ev-sp-mark\{[^}]*width:79px; height:79px/.test(css));
check.check("6. CSS: sai sozinho ao fim de 6 s mesmo sem JavaScript (se a app falhar a arrancar não fica a tapar tudo)", /animation:evSplashFailsafe \.01s linear 6s forwards/.test(css) && /@keyframes evSplashFailsafe\{to\{opacity:0; visibility:hidden; pointer-events:none;\}\}/.test(css));
check.check("7. CSS: escondido na Gestão e com «reduzir movimento» não alarga nem cresce", /html\[data-app="gestao"\] #evSplash\{display:none;\}/.test(css) && /prefers-reduced-motion:reduce\)\{ #evSplash\.out\{transition-duration:\.12s;\}/.test(css));

// imagens de arranque do iPhone (só EVOLVE e Treino): existem, têm o tamanho certo e a regra de media bate certo com o tamanho
function pngSize(file){ var b = fs.readFileSync(__dirname + "/../" + file); return b.slice(0, 8).toString("hex") === "89504e470d0a1a0a" ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; }
function startupLinks(h){ var out = [], re = /<link rel="apple-touch-startup-image" media="\(device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\) and \(orientation: portrait\)" href="([^"]+)">/g, m; while ((m = re.exec(h))) out.push({w: +m[1], h: +m[2], k: +m[3], href: m[4]}); return out; }
var li = startupLinks(pages.index), lt = startupLinks(pages.treino);
check.check("8. EVOLVE e Treino têm as mesmas 12 imagens de arranque (iPhone SE a 16 Pro Max); a Gestão não tem", li.length === 12 && JSON.stringify(li) === JSON.stringify(lt) && !/apple-touch-startup-image/.test(pages.gestao));
check.check("9. Cada imagem existe, é PNG e mede exatamente largura×escala por altura×escala do aparelho", li.every(function(l){ var s = pngSize(l.href); return s && s[0] === l.w * l.k && s[1] === l.h * l.k; }));
check.check("10. O iPhone 15 Pro / 16 (393×852 a 3×) está coberto e há um pedido por aparelho (sem repetidos)", li.some(function(l){ return l.w === 393 && l.h === 852 && l.k === 3; }) && new Set(li.map(function(l){ return l.href; })).size === 12);
check.check("11. O gerador das imagens está no projeto (scripts/gerar-ecras-arranque.py) com as mesmas medidas da página", /PHI_H = 78\.0/.test(read("scripts/gerar-ecras-arranque.py")) && /RING_D = 79\.0/.test(read("scripts/gerar-ecras-arranque.py")));

// lógica: o arranque só dissolve quando a app deixa de estar «a carregar», uma única vez
var ids = ["appLoading", "authScreen", "recoveryScreen", "connectionErrorScreen", "noStudentScreen", "alunoApp", "proApp", "evSplash"];
var cls = {}, removed = 0, outAdds = 0;
ids.forEach(function(id){ cls[id] = {}; });
global.document.getElementById = function(id){
  if (!cls[id]) cls[id] = {};
  return {
    style: {}, innerHTML: "", value: "", addEventListener: function(){}, setAttribute: function(){}, getAttribute: function(){ return null; },
    parentNode: id === "evSplash" ? {removeChild: function(){ removed++; }} : null,
    classList: {
      add: function(c){ cls[id][c] = true; if (id === "evSplash" && c === "out") outAdds++; },
      remove: function(c){ delete cls[id][c]; },
      toggle: function(){}, contains: function(c){ return !!cls[id][c]; }
    }
  };
};
global.matchMedia = function(){ return {matches: true}; }; // «reduzir movimento»: sem espera mínima, para o teste ser rápido
var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
(async function(){
  showLoading("A verificar sessão...");
  await sleep(30);
  check.check("12. Enquanto a app está «a carregar» o arranque continua por cima (nada de dissolver)", outAdds === 0 && !cls.evSplash.out);
  showLoading("A preparar a tua conta...");
  await sleep(30);
  check.check("13. Um segundo «a carregar» seguido também não o dissolve", outAdds === 0);
  hideAllScreens(); // o ecrã seguinte (entrada ou app) vai ser mostrado
  cls.authScreen.hidden = false;
  await sleep(40);
  check.check("14. Quando já não está «a carregar», o arranque dissolve (classe «out») exatamente uma vez", outAdds === 1 && cls.evSplash.out === true);
  hideAllScreens(); hideAllScreens(); splashRelease();
  await sleep(40);
  check.check("15. Chamadas seguintes não o repetem", outAdds === 1);
  await sleep(560);
  check.check("16. Depois da dissolução o elemento é retirado da página (não fica nada a tapar)", removed === 1);
  check.check("17. Sem o elemento (Gestão escondida ou já retirada) a função não falha", (function(){ var ok = true; try { var el = document.getElementById; document.getElementById = function(){ return null; }; var d = splashDone; splashDone = false; splashRelease(); splashDone = d; document.getElementById = el; } catch (e) { ok = false; } return ok; })());
  check.summarize();
})();
