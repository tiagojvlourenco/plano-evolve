/* EVOLVE — service worker: a app abre sem rede.
   - Navegação (index.html): rede primeiro (sempre a versão mais recente quando há ligação), cache como reserva.
   - app.js, app.css, gestao.js e corrida.js (o código): rede primeiro, cache como reserva — nunca fica uma versão antiga a mandar.
   - Três apps no mesmo site: index.html (Acompanhamento: alimentação e avaliações), treino.html (EVOLVE Treino: musculação e corrida) e
     gestao.html (Gestão, só o profissional); cada uma guarda a sua página.
   - Ficheiros do próprio site (fontes, ícones, Supabase local, animações dos exercícios): cache primeiro.
   - Tudo o que é de outro servidor (Supabase, Open Food Facts, YouTube...) passa direto: nunca se guarda em cache
     (dados de saúde, sessões e fotos não ficam na cache do service worker).
   Subir VERSION sempre que mudar um ficheiro de vendor/, fonts/ ou ícones (as páginas e o código atualizam-se sozinhos).
   v2 (duas apps): o service worker antigo guardava QUALQUER página da app como «index.html»; quem abrisse gestao.html antes da atualização
   deixava a Gestão no lugar do EVOLVE. Mudar o nome apaga essa cache e a cópia antiga de index.html (script inline). */
var VERSION = "evolve-v5";
var SHELL = [
  "./", "index.html", "gestao.html", "treino.html", "app.css", "app.js", "corrida.js", "manifest.json", "manifest-gestao.json", "manifest-treino.json",
  "vendor/supabase.js",
  "fonts/manrope-latin-wght-normal.woff2", "fonts/jura-latin-400-normal.woff2", "fonts/jura-latin-500-normal.woff2",
  "fonts/jura-latin-600-normal.woff2", "fonts/jura-latin-700-normal.woff2", "fonts/jura-latin-300-normal.woff2",
  "icon-32.png", "icon-120.png", "icon-152.png", "icon-180.png", "icon-192.png", "icon-512.png",
  "icon-gestao-180.png", "icon-gestao-192.png", "icon-gestao-512.png",
  "icon-treino-180.png", "icon-treino-192.png", "icon-treino-512.png"
];
var NAV_TIMEOUT_MS = 4000;

self.addEventListener("install", function(event){
  event.waitUntil(caches.open(VERSION).then(function(cache){
    // um ficheiro em falta não pode impedir a instalação do resto
    // cache:"reload" ignora a cache HTTP do browser (senão podia guardar uma cópia anterior à atualização)
    return Promise.all(SHELL.map(function(u){ return cache.add(new Request(u, {cache: "reload"})).catch(function(){}); }));
  }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener("activate", function(event){
  event.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== VERSION; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

// só se guarda como "a página" uma resposta boa, em HTML e da app (um portal de Wi-Fi ou uma página de erro nunca substituem a cópia boa)
function isAppPage(res, text){ return res && res.ok && /text\/html/i.test(res.headers.get("Content-Type") || "") && text.indexOf('id="alunoApp"') >= 0; }

// cada página (index.html, gestao.html, treino.html) tem a sua cópia guardada; «/» é o index.html
function pageKey(request){
  var p = new URL(request.url).pathname;
  return /\/gestao\.html$/.test(p) ? "gestao.html" : /\/treino\.html$/.test(p) ? "treino.html" : "index.html";
}

function networkFirst(event){
  var request = event.request;
  var key = pageKey(request);
  return new Promise(function(resolve){
    var settled = false;
    function fallback(){
      return caches.match(key).then(function(hit){
        if (hit && !settled){ settled = true; resolve(hit); }
        return !!hit;
      });
    }
    var timer = setTimeout(fallback, NAV_TIMEOUT_MS); // rede lenta: usa já a cópia guardada, se existir
    fetch(request, {cache: "no-cache"}).then(function(res){
      clearTimeout(timer);
      if (settled) return;
      if (!res || res.status >= 500){ // servidor com problemas: a cópia boa vale mais
        return fallback().then(function(had){ if (!had && !settled){ settled = true; resolve(res); } });
      }
      var copy = res.clone();
      event.waitUntil(copy.text().then(function(text){
        if (isAppPage(res, text)) return caches.open(VERSION).then(function(c){ return c.put(key, new Response(text, {headers: copy.headers})); });
      }).catch(function(){}));
      settled = true; resolve(res);
    }).catch(function(){
      clearTimeout(timer);
      fallback().then(function(had){
        if (!had && !settled){ settled = true; resolve(new Response("Sem ligação e sem cópia guardada. Abre a app uma vez com internet.", {status: 503, headers: {"Content-Type": "text/plain; charset=utf-8"}})); }
      });
    });
  });
}

function cacheFirst(event){
  var request = event.request;
  return caches.match(request).then(function(hit){
    if (hit) return hit;
    return fetch(request).then(function(res){
      if (res && res.ok){ var copy = res.clone(); event.waitUntil(caches.open(VERSION).then(function(c){ return c.put(request, copy); }).catch(function(){})); }
      return res;
    });
  });
}

// código da app (app.js, app.css), da Gestão (gestao.js) e da Corrida (corrida.js): sempre a versão mais recente quando há ligação; sem rede usa a última guardada (não está no SHELL: os alunos nunca o descarregam)
function networkFirstFile(event){
  var request = event.request;
  return new Promise(function(resolve){
    var settled = false;
    function fromCache(last){
      return caches.match(request).then(function(hit){
        if (settled) return;
        if (hit){ settled = true; resolve(hit); } else if (last){ settled = true; resolve(last); }
      });
    }
    var timer = setTimeout(function(){ fromCache(null); }, NAV_TIMEOUT_MS); // rede lenta: usa já a cópia guardada, se existir
    fetch(request, {cache: "no-cache"}).then(function(res){
      clearTimeout(timer);
      // só um JavaScript a sério substitui a cópia boa (um portal de Wi-Fi devolve HTML com 200)
      var want = /\.css$/.test(new URL(request.url).pathname) ? /css/i : /javascript/i;
      var good = res && res.ok && want.test(res.headers.get("Content-Type") || "");
      if (settled) { if (good) event.waitUntil(caches.open(VERSION).then(function(c){ return c.put(request, res.clone()); }).catch(function(){})); return; }
      if (good){ var copy = res.clone(); event.waitUntil(caches.open(VERSION).then(function(c){ return c.put(request, copy); }).catch(function(){})); settled = true; resolve(res); return; }
      return fromCache(res).then(function(){ if (!settled){ settled = true; resolve(res); } });
    }).catch(function(){
      clearTimeout(timer);
      fromCache(Response.error()).then(function(){ if (!settled){ settled = true; resolve(Response.error()); } });
    });
  });
}

self.addEventListener("fetch", function(event){
  var req = event.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  // as animações dos exercícios são servidas pelo mesmo site mas com endereço absoluto (EXERCISE_MEDIA_BASE)
  var sameSite = url.origin === self.location.origin;
  if (!sameSite) return;
  if (req.mode === "navigate"){ event.respondWith(networkFirst(event)); return; }
  if (/\/(gestao|corrida|app)\.(js|css)$/.test(url.pathname)){ event.respondWith(networkFirstFile(event)); return; }
  event.respondWith(cacheFirst(event).catch(function(){ return Response.error(); }));
});
