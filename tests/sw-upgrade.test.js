// Caminho de upgrade do service worker (PWAs já instaladas com a versão de uma só página):
// a cache antiga (com o index.html de script inline, ou com a Gestão guardada como «index.html» pelo service worker antigo) é apagada,
// a nova guarda as páginas e o código (também o da Corrida, corrida-core.js e corrida.js, quando existem no site), e os ficheiros da shell são pedidos
// sem passar pela cache HTTP. Um ficheiro da shell em falta (a Corrida ainda não publicada, por exemplo) não impede a instalação do resto.
var check = require("./check")();
var fs = require("fs");
var path = require("path");
var vm = require("vm");
var src = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");

function makeCaches(initial, absent){
  var stores = {};
  Object.keys(initial).forEach(function(k){ stores[k] = Object.assign({}, initial[k]); });
  function store(name){
    return {
      add: function(req){ var u = req.url || String(req); if ((absent || []).indexOf(u) >= 0) return Promise.reject(new Error("404 " + u)); stores[name][u] = {fetched: req}; return Promise.resolve(); },
      put: function(req, res){ stores[name][req.url || String(req)] = res; return Promise.resolve(); },
      match: function(req){ var u = req.url || String(req); return Promise.resolve(stores[name][u]); }
    };
  }
  return {
    stores: stores,
    open: function(name){ if (!stores[name]) stores[name] = {}; return Promise.resolve(store(name)); },
    keys: function(){ return Promise.resolve(Object.keys(stores)); },
    delete: function(name){ var had = !!stores[name]; delete stores[name]; return Promise.resolve(had); },
    match: function(){ return Promise.resolve(undefined); }
  };
}

// instala o service worker numa cache nova (ou com a antiga) e devolve a cache onde ficou tudo; absent = ficheiros que o servidor não tem (o pedido falha)
async function install(initial, absent){
  var listeners = {};
  var caches = makeCaches(initial, absent);
  var ctx = {
    self: {addEventListener: function(t, f){ listeners[t] = f; }, skipWaiting: function(){ return Promise.resolve(); }, clients: {claim: function(){ return Promise.resolve(); }}, location: {origin: "https://x.test"}},
    caches: caches, Promise: Promise, URL: URL, Response: function(){}, console: console, setTimeout: setTimeout, clearTimeout: clearTimeout,
    Request: function(u, o){ this.url = u; this.cache = o && o.cache; }
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  function fire(type){ var p; listeners[type]({waitUntil: function(x){ p = x; }}); return p; }
  await fire("install");
  await fire("activate");
  return caches;
}

(async function(){
  var caches = await install({"evolve-v1": {"index.html": "GESTAO-GUARDADA-COMO-INDEX", "vendor/supabase.js": "x"}});
  var keys = Object.keys(caches.stores);
  check.check("1. Depois da atualização só existe a cache nova (a antiga, com a página trocada, foi apagada)", keys.length === 1 && keys[0] !== "evolve-v1");
  var cur = caches.stores[keys[0]];
  ["index.html", "gestao.html", "treino.html", "app.js", "app.css", "manifest-gestao.json", "manifest-treino.json", "icon-gestao-192.png", "icon-treino-192.png", "corrida-core.js", "corrida.js", "corrida-live.js"].forEach(function(f, i){
    check.check("2." + (i + 1) + ". A cache nova guarda " + f, !!cur[f]);
  });
  check.check("3. Nenhuma cópia antiga de index.html sobrevive", !JSON.stringify(cur["index.html"] && cur["index.html"].fetched).includes("GESTAO"));
  check.check("4. A shell é pedida sem a cache HTTP do browser (cache: reload)", Object.keys(cur).every(function(k){ return cur[k].fetched && cur[k].fetched.cache === "reload"; }));
  // 5. a Corrida ainda não está no servidor (404): a instalação acaba na mesma e o resto fica guardado
  var caches2 = await install({}, ["corrida.js", "corrida-core.js", "corrida-live.js"]);
  var cur2 = caches2.stores[Object.keys(caches2.stores)[0]] || {};
  check.check("5. Sem corrida.js nem corrida-core.js no servidor a instalação conclui-se e o resto da shell fica guardado", !cur2["corrida.js"] && !cur2["corrida-core.js"] && !cur2["corrida-live.js"] && !!cur2["index.html"] && !!cur2["treino.html"] && !!cur2["app.js"]);
  check.summarize();
})();
