// Supabase simulado para testes no browser: guarda as fichas em memória (window.__fake), regista cada gravação e
// deixa simular a falta de rede. Não é o Supabase real: reproduz só o que a app usa (select/update/insert/eq/maybeSingle/rpc/storage)
// e a regra do servidor que só deixa o aluno alterar as colunas do dia a dia.
//
// Corrida (migração 0032): tabelas runs, run_tracks e run_consents (insert com 23505 se o id/chave já existe, select com eq/gte/range/maybeSingle e
// só as colunas pedidas, delete com eq e as cascatas do servidor: apagar o consentimento apaga as corridas dele, apagar uma corrida apaga o percurso,
// apagar o aluno apaga tudo). A coluna students.runs_mode é opcional por fixture: o select("*") devolve-a se a linha a tiver (é o sinal de «migração
// aplicada») e o profissional escreve-a por update; o aluno não (como o gatilho do servidor). Opções de INIT (todas opcionais):
//   missingTables: true (todas as tabelas extra em falta) ou uma LISTA de nomes (ex.: ["runs"]); missingTableCode: "PGRST205" para o erro do PostgREST
//   runsRls: true liga as regras de INSERT do servidor (modo ligado, live só com 'live', consentimento da versão, só o aluno cria): sem isto aceita tudo
// Não simula: ordem (order/limit/in não filtram: ordena-se no cliente), CHECKs de valores, leitura por papel, contagens.
module.exports = function fakeSupabaseSource(initial){
  return "(" + function(INIT){
    var STUDENT_ALLOWED = ["meal_daily_state", "meals_date", "checkins", "weights", "weight_current", "substitution_history", "adaptation_history", "photos", "workout_logs", "updated_at"];
    var F = window.__fake = {
      role: INIT.role, userId: INIT.userId, rows: INIT.rows, writes: [], selects: [], selectCols: [], signedUrls: [], failNext: 0, blockHost: false,
      other: {}, tables: {session_packs: [], sessions: [], payments: [], session_slots: [], studio_settings: [], runs: [], run_tracks: [], run_consents: []}, missingTables: INIT.missingTables || false
    };
    var RUN_TABLES = {runs: 1, run_tracks: 1, run_consents: 1};
    function tableMissing(t){ var m = F.missingTables; return Array.isArray(m) ? m.indexOf(t) >= 0 : !!m; }
    function missingError(t){
      if (INIT.missingTableCode === "PGRST205") return {message: "Could not find the table 'public." + t + "' in the schema cache", code: "PGRST205", details: null, hint: null};
      return {message: 'relation "public.' + t + '" does not exist', code: "42P01"};
    }
    // só as colunas pedidas (como o PostgREST); «*» ou nada = a linha toda. Só nas tabelas da Corrida (as outras sempre devolveram a linha toda)
    function project(rows, cols){
      if (typeof cols !== "string" || cols.indexOf("*") >= 0) return rows;
      var names = cols.split(",").map(function(n){ return n.trim(); }).filter(Boolean);
      if (!names.length) return rows;
      return rows.map(function(r){ var o = {}; names.forEach(function(n){ if (n in r) o[n] = r[n]; }); return o; });
    }
    // apaga corridas (e os percursos delas): a chave estrangeira do servidor
    function dropRuns(pred){
      var gone = F.tables.runs.filter(pred), ids = gone.map(function(r){ return r.id; });
      F.tables.runs = F.tables.runs.filter(function(r){ return !pred(r); });
      F.tables.run_tracks = F.tables.run_tracks.filter(function(k){ return ids.indexOf(k.run_id) < 0; });
    }
    function rlsDenied(t){ return {data: null, error: {message: 'new row violates row-level security policy for table "' + t + '"', code: "42501"}, status: 403}; }
    function offline(){ return navigator.onLine === false || F.blockHost; }
    function netFail(){ return {data: null, error: {message: "TypeError: Failed to fetch", details: "", hint: "", code: ""}, status: 0}; }
    function clone(v){ return v === undefined ? v : JSON.parse(JSON.stringify(v)); }
    function Builder(table){
      this.table = table; this.op = "select"; this.payload = null; this.filters = []; this.single = false; this.rangeFrom = null; this.rangeTo = null;
    }
    Builder.prototype.select = function(cols){ if (this.op === "select") this.cols = cols; return this; };
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
          ["sessions", "session_packs", "payments", "session_slots", "run_tracks", "runs", "run_consents"].forEach(function(k){ if (F.tables[k]) F.tables[k] = F.tables[k].filter(function(r){ return r.student_id !== id; }); });
          F.writes.push({table: t, op: "delete", id: id});
          return {data: null, error: null, status: 204};
        }
      }
      if (F.tables[t]){
        if (tableMissing(t)) return {data: null, error: missingError(t), status: 404};
        var rows = F.tables[t], filters = this.filters;
        var match = function(r){ return filters.every(function(f){ return f[2] === "gte" ? String(r[f[0]]) >= String(f[1]) : r[f[0]] === f[1]; }); };
        if (this.op === "insert"){
          var list = Array.isArray(this.payload) ? this.payload : [this.payload], made = [];
          if (RUN_TABLES[t]){
            var keyOf = function(r){ return t === "runs" ? r.id : t === "run_tracks" ? r.run_id : r.student_id + "|" + (r.version == null ? 1 : r.version); };
            var seen = {}, dupRun = list.filter(function(p0){ var k = keyOf(p0); if (rows.some(function(r){ return keyOf(r) === k; }) || seen[k]) return true; seen[k] = 1; return false; })[0];
            if (dupRun) return {data: null, error: {message: 'duplicate key value violates unique constraint "' + t + '_pkey"', code: "23505"}, status: 409};
            if (INIT.runsRls){
              var denied = F.role !== "student" || list.some(function(p0){
                var st = F.rows.filter(function(r){ return r.id === p0.student_id; })[0];
                if (!st) return true;
                if (t === "run_consents") return false;
                if (t === "run_tracks") return !F.tables.runs.some(function(r){ return r.id === p0.run_id && r.student_id === p0.student_id; });
                var mode = st.runs_mode || "off";
                return mode === "off" || ((p0.source === "live" || p0.source === "native") && mode !== "live") || (p0.created_by != null && p0.created_by !== F.userId) ||
                  !F.tables.run_consents.some(function(c){ return c.student_id === p0.student_id && (c.version == null ? 1 : c.version) === p0.consent_v; });
              });
              if (denied) return rlsDenied(t);
            }
            list.forEach(function(p0){
              var row = clone(p0);
              if (t === "runs"){ row.created_by = row.created_by || F.userId; row.created_at = new Date().toISOString(); }   // do servidor, não do telemóvel
              if (t === "run_consents"){ if (row.version == null) row.version = 1; row.accepted_at = new Date().toISOString(); }
              rows.push(row); made.push(clone(row));
            });
            F.writes.push({table: t, op: "insert", cols: Object.keys(list[0] || {}), payload: clone(this.payload), n: list.length});
            return {data: made, error: null, status: 201};
          }
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
        if (this.op === "delete"){
          var gone = rows.filter(match);
          F.tables[t] = rows.filter(function(r){ return !match(r); });
          if (t === "run_consents") gone.forEach(function(c){ dropRuns(function(r){ return r.student_id === c.student_id && r.consent_v === (c.version == null ? 1 : c.version); }); }); // retirar o consentimento apaga as corridas dele
          if (t === "runs"){ var goneIds = gone.map(function(r){ return r.id; }); F.tables.run_tracks = F.tables.run_tracks.filter(function(k){ return goneIds.indexOf(k.run_id) < 0; }); }
          F.writes.push({table: t, op: "delete", n: gone.length});
          return {data: null, error: null, status: 204};
        }
        F.selects.push(t);
        F.selectCols.push({table: t, cols: this.cols == null ? "*" : this.cols});
        var cut = function(list){ return RUN_TABLES[t] ? project(list, this.cols) : list; }.bind(this);
        if (this.single) return {data: rows.filter(match).length ? clone(cut([rows.filter(match)[0]])[0]) : null, error: null, status: 200};
        var found = rows.filter(match);
        if (this.rangeFrom != null) found = found.slice(this.rangeFrom, this.rangeTo + 1);
        found = found.slice(0, F.maxRows || 1000); // como o servidor real: no máximo ~1000 linhas por pedido
        return {data: clone(cut(found)), error: null, status: 200};
      }
      F.selects.push(t);
      return {data: this.single ? null : [], error: null, status: 200};
    };
    var client = {
      from: function(t){ return new Builder(t); },
      rpc: function(){ return Promise.resolve({data: {success: true}, error: null}); },
      // convite por link: INIT.noSession = arranca sem sessão; INIT.inviteTokens = {token: {type, email}} (cada token só serve uma vez)
      functions: { invoke: function(name, opts){
        F.invokes = F.invokes || []; F.invokes.push({name: name, body: clone(opts && opts.body)});
        if (INIT.functionMissing) return Promise.resolve({data: null, error: {message: "Function not found", context: {json: function(){ return Promise.resolve({code: "NOT_FOUND", message: "Requested function was not found"}); }}}});
        var email = opts && opts.body && opts.body.email, mine = F.rows.filter(function(r){ return r.invite_email === email; })[0];
        if (F.role !== "professional") return Promise.resolve({data: null, error: {message: "403", context: {json: function(){ return Promise.resolve({erro: "Só o profissional pode gerar links de convite."}); }}}});
        if (!mine) return Promise.resolve({data: null, error: {message: "404", context: {json: function(){ return Promise.resolve({erro: "Não há nenhum aluno convidado com este email. Cria primeiro a ficha do aluno.", codigo: "sem_convite"}); }}}});
        var tok = "tok" + Math.random().toString(36).slice(2) + "ABCDEFGHIJ", tipo = mine.auth_user_id ? "recovery" : "invite";
        F.issued = F.issued || {}; F.issued[tok] = {type: tipo, email: email};
        return Promise.resolve({data: {tipo: tipo, token_hash: tok, email: email}, error: null});
      } },
      auth: {
        getSession: function(){ if (INIT.noSession && !F.signedIn) return Promise.resolve({data: {session: null}}); return Promise.resolve({data: {session: {user: {id: INIT.userId, email: INIT.email || "x@y.test"}}}}); },
        onAuthStateChange: function(){ return {data: {subscription: {unsubscribe: function(){}}}}; },
        signOut: function(){ return Promise.resolve({}); },
        verifyOtp: function(p){
          F.verifies = (F.verifies || 0) + 1;
          var tk = (F.issued || {})[p.token_hash] || (INIT.inviteTokens || {})[p.token_hash];
          if (!tk || tk.used || tk.type !== p.type) return Promise.resolve({data: {session: null}, error: {message: "Email link is invalid or has expired"}});
          tk.used = true; F.signedIn = true; F.passwordSet = false;
          return Promise.resolve({data: {session: {user: {id: INIT.userId, email: tk.email}}}, error: null});
        },
        updateUser: function(p){
          if (!F.signedIn) return Promise.resolve({data: null, error: {message: "Auth session missing!"}});
          if (!p.password || p.password.length < 6) return Promise.resolve({data: null, error: {message: "Password should be at least 6 characters"}});
          F.passwordSet = true; F.lastPassword = p.password;
          return Promise.resolve({data: {user: {id: INIT.userId}}, error: null});
        }
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
