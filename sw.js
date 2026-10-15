/* EVOLVE — service worker: a app abre sem rede.
   - Navegação (index.html): rede primeiro (sempre a versão mais recente quando há ligação), cache como reserva.
   - gestao.js (código da Gestão, só descarregado pelo profissional): rede primeiro, cache como reserva — nunca fica uma versão antiga a mandar.
   - Ficheiros do próprio site (fontes, ícones, Supabase local, animações dos exercícios): cache primeiro.
   - Tudo o que é de outro servidor (Supabase, Open Food Facts, YouTube...) passa direto: nunca se guarda em cache
     (dados de saúde, sessões e fotos não ficam na cache do service worker).
   Subir VERSION sempre que mudar um ficheiro de vendor/, fonts/ ou ícones (index.html atualiza-se sozinho). */
var VERSION = "evolve-v1";
var SHELL = [
  "./", "index.html", "manifest.json",
  "vendor/supabase.js",
  "fonts/manrope-latin-wght-normal.woff2", "fonts/jura-latin-400-normal.woff2", "fonts/jura-latin-500-normal.woff2",
  "fonts/jura-latin-600-normal.woff2", "fonts/jura-latin-700-normal.woff2",
  "icon-32.png", "icon-120.png", "icon-152.png", "icon-180.png", "icon-192.png", "icon-512.png"
];
var NAV_TIMEOUT_MS = 4000;

self.addEventListener("install", function(event){
  event.waitUntil(caches.open(VERSION).then(function(cache){
    // um ficheiro em falta não pode impedir a instalação do resto
    return Promise.all(SHELL.map(function(u){ return cache.add(u).catch(function(){}); }));
  }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener("activate", function(event){
  event.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== VERSION; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

// só se guarda como "a página" uma resposta boa, em HTML e da app (um portal de Wi-Fi ou uma página de erro nunca substituem a cópia boa)
function isAppPage(res, text){ return res && res.ok && /text\/html/i.test(res.headers.get("Content-Type") || "") && text.indexOf('id="alunoApp"') >= 0; }

function networkFirst(event){
  var request = event.request;
  return new Promise(function(resolve){
    var settled = false;
    function fallback(){
      return caches.match("index.html").then(function(hit){
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
        if (isAppPage(res, text)) return caches.open(VERSION).then(function(c){ return c.put("index.html", new Response(text, {headers: copy.headers})); });
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

// código da Gestão: sempre a versão mais recente quando há ligação; sem rede usa a última guardada (não está no SHELL: os alunos nunca o descarregam)
function networkFirstFile(event){
  var request = event.request;
  return fetch(request, {cache: "no-cache"}).then(function(res){
    if (res && res.ok){ var copy = res.clone(); event.waitUntil(caches.open(VERSION).then(function(c){ return c.put(request, copy); }).catch(function(){})); return res; }
    return caches.match(request).then(function(hit){ return hit || res; });
  }).catch(function(){
    return caches.match(request).then(function(hit){ return hit || Response.error(); });
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
  if (/\/gestao\.js$/.test(url.pathname)){ event.respondWith(networkFirstFile(event)); return; }
  event.respondWith(cacheFirst(event).catch(function(){ return Response.error(); }));
});
