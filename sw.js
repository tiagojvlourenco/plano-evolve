/* EVOLVE — service worker: a app abre sem rede.
   - Navegação (index.html): rede primeiro (sempre a versão mais recente quando há ligação), cache como reserva.
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

function networkFirst(request){
  return new Promise(function(resolve){
    var settled = false;
    var timer = setTimeout(function(){
      // rede lenta: se há cópia guardada usa-a já (a rede continua a tentar e atualiza a cópia)
      caches.match("index.html").then(function(hit){ if (hit && !settled){ settled = true; resolve(hit); } });
    }, NAV_TIMEOUT_MS);
    fetch(request, {cache: "no-cache"}).then(function(res){
      clearTimeout(timer);
      if (res && res.ok){ var copy = res.clone(); caches.open(VERSION).then(function(c){ c.put("index.html", copy); }); }
      if (!settled){ settled = true; resolve(res); }
    }).catch(function(){
      clearTimeout(timer);
      caches.match("index.html").then(function(hit){
        if (!settled){ settled = true; resolve(hit || new Response("Sem ligação e sem cópia guardada. Abre a app uma vez com internet.", {status: 503, headers: {"Content-Type": "text/plain; charset=utf-8"}})); }
      });
    });
  });
}

function cacheFirst(request){
  return caches.match(request).then(function(hit){
    if (hit) return hit;
    return fetch(request).then(function(res){
      if (res && res.ok){ var copy = res.clone(); caches.open(VERSION).then(function(c){ c.put(request, copy); }); }
      return res;
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
  if (req.mode === "navigate"){ event.respondWith(networkFirst(req)); return; }
  event.respondWith(cacheFirst(req).catch(function(){ return Response.error(); }));
});
