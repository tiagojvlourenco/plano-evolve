// Supabase simulado para testes no browser: guarda as fichas em memória (window.__fake), regista cada gravação e
// deixa simular a falta de rede. Não é o Supabase real: reproduz só o que a app usa (select/update/insert/eq/maybeSingle/rpc/storage)
// e a regra do servidor que só deixa o aluno alterar as colunas do dia a dia.
module.exports = function fakeSupabaseSource(initial){
  return "(" + function(INIT){
    var STUDENT_ALLOWED = ["meal_daily_state", "meals_date", "checkins", "weights", "weight_current", "substitution_history", "adaptation_history", "photos", "workout_logs", "updated_at"];
    var F = window.__fake = {
      role: INIT.role, userId: INIT.userId, rows: INIT.rows, writes: [], selects: [], signedUrls: [], failNext: 0, blockHost: false,
      other: {}, tables: {session_packs: [], sessions: [], payments: [], session_slots: [], studio_settings: []}, missingTables: INIT.missingTables || false
    };
    function offline(){ return navigator.onLine === false || F.blockHost; }
    function netFail(){ return {data: null, error: {message: "TypeError: Failed to fetch", details: "", hint: "", code: ""}, status: 0}; }
    function clone(v){ return v === undefined ? v : JSON.parse(JSON.stringify(v)); }
    function Builder(table){
      this.table = table; this.op = "select"; this.payload = null; this.filters = []; this.single = false; this.rangeFrom = null; this.rangeTo = null;
    }
    Builder.prototype.select = function(){ if (this.op === "select") this.op = "select"; return this; };
    Builder.prototype.update = function(p){ this.op = "update"; this.payload = p; return this; };
    Builder.prototype.insert = function(p){ this.op = "insert"; this.payload = p; return this; };
    Builder.prototype.upsert = function(p){ this.op = "upsert"; this.payload = p; return this; };
    Builder.prototype.delete = function(){ this.op = "delete"; return this; };
    Builder.prototype.eq = function(c, v){ this.filters.push([c, v, "eq"]); return this; };
    Builder.prototype.gte = function(c, v){ this.filters.push([c, v, "gte"]); return this; };
    Builder.prototype.in = function(){ return this; };
    Builder.prototype.neq = function(){ return this; };
    ["order", "or", "ilike", "like", "is", "not", "lte", "gt", "lt", "contains", "textSearch", "filter", "match"].forEach(function(m){ Builder.prototype[m] = function(){ return this; }; });
    Builder.prototype.range = function(a, b){ this.rangeFrom = a; this.rangeTo = b; return this; };
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
      // migrações por correr: INIT.missingCols = {students: ["nutrition_phase"], session_packs: ["shared_with"]} recusa as gravações que levam essas colunas (como o PostgREST)
      if (INIT.missingCols && INIT.missingCols[t] && (this.op === "update" || this.op === "insert" || this.op === "upsert") && this.payload){
        var first = Array.isArray(this.payload) ? (this.payload[0] || {}) : this.payload, absent = INIT.missingCols[t].filter(function(c){ return c in first; })[0];
        if (absent){
          F.writes.push({table: t, op: this.op + "-REJECTED", cols: Object.keys(first)});
          return {data: null, error: {message: "Could not find the '" + absent + "' column of '" + t + "' in the schema cache", code: "PGRST204"}, status: 400};
        }
      }
      if (t === "professionals"){
        F.selects.push("professionals");
        return {data: F.role === "professional" ? {user_id: F.userId} : null, error: null, status: 200};
      }
      if (t === "students"){
        if (this.op === "select"){
          F.selects.push("students");
          var eqId = (this.filters.filter(function(f){ return f[0] === "id"; })[0] || [])[1];
          if (eqId !== undefined){ var one = F.rows.filter(function(r){ return r.id === eqId; })[0]; return {data: one ? clone(one) : null, error: null, status: 200}; }
          return {data: clone(F.rows), error: null, status: 200};
        }
        var id = (this.filters.filter(function(f){ return f[0] === "id"; })[0] || [])[1];
        if (this.op === "update"){
          var row = F.rows.filter(function(r){ return r.id === id; })[0];
          F.writes.push({table: t, op: "update", id: id, cols: Object.keys(this.payload), payload: clone(this.payload)});
          if (!row) return {data: [], error: null, status: 200};
          var bad = null;
          if (F.role !== "professional"){
            Object.keys(this.payload).forEach(function(k){
              if (STUDENT_ALLOWED.indexOf(k) < 0 && JSON.stringify(row[k] === undefined ? null : row[k]) !== JSON.stringify(this.payload[k] === undefined ? null : this.payload[k])) bad = k;
            }, this);
          }
          if (bad) return {data: null, error: {message: "Só o profissional pode alterar estes dados do plano.", code: "P0001"}, status: 400};
          Object.keys(this.payload).forEach(function(k){ row[k] = clone(this.payload[k]); }, this);
          return {data: [{id: id}], error: null, status: 200};
        }
        if (this.op === "insert"){ F.rows.push(clone(this.payload)); F.writes.push({table: t, op: "insert", id: this.payload.id, cols: Object.keys(this.payload)}); return {data: null, error: null, status: 201}; }
        if (this.op === "delete"){
          F.rows = F.rows.filter(function(r){ return r.id !== id; });
          ["sessions", "session_packs", "payments", "session_slots"].forEach(function(k){ if (F.tables[k]) F.tables[k] = F.tables[k].filter(function(r){ return r.student_id !== id; }); });
          F.writes.push({table: t, op: "delete", id: id});
          return {data: null, error: null, status: 204};
        }
      }
      if (F.tables[t]){
        if (F.missingTables) return {data: null, error: {message: 'relation "public.' + t + '" does not exist', code: "42P01"}, status: 404};
        var rows = F.tables[t], filters = this.filters;
        var match = function(r){ return filters.every(function(f){ return f[2] === "gte" ? String(r[f[0]]) >= String(f[1]) : r[f[0]] === f[1]; }); };
        if (this.op === "insert"){
          var list = Array.isArray(this.payload) ? this.payload : [this.payload], made = [];
          if (t === "sessions"){
            var dup = list.filter(function(p0){ return p0.source === "calendario" && p0.external_id && rows.some(function(r){ return r.source === "calendario" && r.external_id === p0.external_id; }); })[0];
            if (dup) return {data: null, error: {message: 'duplicate key value violates unique constraint "sessions_calendar_unique"', code: "23505"}, status: 409};
          }
          list.forEach(function(p0){ var row = Object.assign({id: t + "-" + (rows.length + 1)}, clone(p0)); rows.push(row); made.push(clone(row)); });
          F.writes.push({table: t, op: "insert", cols: Object.keys(list[0] || {}), payload: clone(this.payload), n: list.length});
          return {data: made, error: null, status: 201};
        }
        if (this.op === "upsert"){
          var pl = clone(this.payload), at = rows.filter(function(r){ return r.key !== undefined && r.key === pl.key; })[0];
          if (at) Object.assign(at, pl); else rows.push(Object.assign({id: t + "-" + (rows.length + 1)}, pl));
          F.writes.push({table: t, op: "upsert", cols: Object.keys(pl), payload: pl});
          return {data: null, error: null, status: 201};
        }
        if (this.op === "update"){ var hit = rows.filter(match); hit.forEach(function(r){ Object.assign(r, clone(this.payload)); }, this); F.writes.push({table: t, op: "update", cols: Object.keys(this.payload), payload: clone(this.payload)}); return {data: clone(hit), error: null, status: 200}; }
        if (this.op === "delete"){ F.tables[t] = rows.filter(function(r){ return !match(r); }); F.writes.push({table: t, op: "delete"}); return {data: null, error: null, status: 204}; }
        F.selects.push(t);
        if (this.single) return {data: rows.filter(match).length ? clone(rows.filter(match)[0]) : null, error: null, status: 200};
        var found = rows.filter(match);
        if (this.rangeFrom != null) found = found.slice(this.rangeFrom, this.rangeTo + 1);
        found = found.slice(0, F.maxRows || 1000); // como o servidor real: no máximo ~1000 linhas por pedido
        return {data: clone(found), error: null, status: 200};
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
