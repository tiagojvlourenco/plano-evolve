// Supabase simulado para testes no browser: guarda as fichas em memória (window.__fake), regista cada gravação e
// deixa simular a falta de rede. Não é o Supabase real: reproduz só o que a app usa (select/update/insert/eq/maybeSingle/rpc/storage)
// e a regra do servidor que só deixa o aluno alterar as colunas do dia a dia.
module.exports = function fakeSupabaseSource(initial){
  return "(" + function(INIT){
    var STUDENT_ALLOWED = ["meal_daily_state", "meals_date", "checkins", "weights", "weight_current", "substitution_history", "adaptation_history", "photos", "workout_logs", "updated_at"];
    var F = window.__fake = {
      role: INIT.role, userId: INIT.userId, rows: INIT.rows, writes: [], selects: [], signedUrls: [], failNext: 0, blockHost: false,
      other: {}
    };
    function offline(){ return navigator.onLine === false || F.blockHost; }
    function netFail(){ return {data: null, error: {message: "TypeError: Failed to fetch", details: "", hint: "", code: ""}, status: 0}; }
    function clone(v){ return v === undefined ? v : JSON.parse(JSON.stringify(v)); }
    function Builder(table){
      this.table = table; this.op = "select"; this.payload = null; this.filters = []; this.single = false;
    }
    Builder.prototype.select = function(){ if (this.op === "select") this.op = "select"; return this; };
    Builder.prototype.update = function(p){ this.op = "update"; this.payload = p; return this; };
    Builder.prototype.insert = function(p){ this.op = "insert"; this.payload = p; return this; };
    Builder.prototype.upsert = function(p){ this.op = "upsert"; this.payload = p; return this; };
    Builder.prototype.delete = function(){ this.op = "delete"; return this; };
    Builder.prototype.eq = function(c, v){ this.filters.push([c, v]); return this; };
    Builder.prototype.in = function(){ return this; };
    Builder.prototype.neq = function(){ return this; };
    ["order", "range", "or", "ilike", "like", "is", "not", "gte", "lte", "gt", "lt", "contains", "textSearch", "filter", "match"].forEach(function(m){ Builder.prototype[m] = function(){ return this; }; });
    Builder.prototype.limit = function(){ return this; };
    Builder.prototype.maybeSingle = function(){ this.single = true; return this; };
    Builder.prototype.then = function(res, rej){ return Promise.resolve(this.run()).then(res, rej); };
    Builder.prototype.run = function(){
      var self = this;
      return new Promise(function(resolve){
        setTimeout(function(){
          if (offline()) return resolve(netFail());
          if (F.failNext > 0){ F.failNext--; return resolve({data: null, error: {message: "boom", code: "XX000"}, status: 500}); }
          resolve(self.exec());
        }, 5);
      });
    };
    Builder.prototype.exec = function(){
      var t = this.table;
      if (t === "professionals"){
        F.selects.push("professionals");
        return {data: F.role === "professional" ? {user_id: F.userId} : null, error: null, status: 200};
      }
      if (t === "students"){
        if (this.op === "select"){
          F.selects.push("students");
          return {data: clone(F.rows), error: null, status: 200};
        }
        var id = (this.filters.filter(function(f){ return f[0] === "id"; })[0] || [])[1];
        if (this.op === "update"){
          var row = F.rows.filter(function(r){ return r.id === id; })[0];
          F.writes.push({table: t, op: "update", id: id, cols: Object.keys(this.payload), payload: clone(this.payload)});
          if (!row) return {data: null, error: null, status: 200};
          var bad = null;
          if (F.role !== "professional"){
            Object.keys(this.payload).forEach(function(k){
              if (STUDENT_ALLOWED.indexOf(k) < 0 && JSON.stringify(row[k] === undefined ? null : row[k]) !== JSON.stringify(this.payload[k] === undefined ? null : this.payload[k])) bad = k;
            }, this);
          }
          if (bad) return {data: null, error: {message: "Só o profissional pode alterar estes dados do plano.", code: "P0001"}, status: 400};
          Object.keys(this.payload).forEach(function(k){ row[k] = clone(this.payload[k]); }, this);
          return {data: null, error: null, status: 204};
        }
        if (this.op === "insert"){ F.rows.push(clone(this.payload)); F.writes.push({table: t, op: "insert", id: this.payload.id, cols: Object.keys(this.payload)}); return {data: null, error: null, status: 201}; }
      }
      F.selects.push(t);
      return {data: this.single ? null : [], error: null, status: 200};
    };
    var client = {
      from: function(t){ return new Builder(t); },
      rpc: function(){ return Promise.resolve({data: {success: true}, error: null}); },
      auth: {
        getSession: function(){ return Promise.resolve({data: {session: {user: {id: INIT.userId, email: INIT.email || "x@y.test"}}}}); },
        onAuthStateChange: function(){ return {data: {subscription: {unsubscribe: function(){}}}}; },
        signOut: function(){ return Promise.resolve({}); }
      },
      storage: { from: function(){ return {
        createSignedUrl: function(path){ F.signedUrls.push(path); return Promise.resolve({data: {signedUrl: "https://signed.test/" + path}, error: null}); },
        upload: function(){ return Promise.resolve({data: {}, error: null}); }, remove: function(){ return Promise.resolve({}); }
      }; } },
      channel: function(){ return {on: function(){ return this; }, subscribe: function(){ return this; }}; }
    };
    // a biblioteca real (vendor/supabase.js) também corre e tenta definir window.supabase: ignora-se, fica o simulado
    var fake = { createClient: function(){ return client; } };
    Object.defineProperty(window, "supabase", { get: function(){ return fake; }, set: function(){}, configurable: true });
  }.toString() + ")(" + JSON.stringify(initial) + ");";
};
