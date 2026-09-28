// Fase 9 — preparação para utilização real.
const fs = require("fs");
const path = require("path");
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

function freshStudent(overrides){
  var base = {
    id:"x", flexibility:50, flexOverrides:{}, blockedFoods:[],
    substitutionHistory:[], adaptationHistory:[], photos:[],
    targets:{kcal:2000, protein:150, carbs:200, fat:60},
    meals:[]
  };
  Object.keys(overrides || {}).forEach(function(k){ base[k] = overrides[k]; });
  return base;
}

// ---- 1. Bug corrigido: _resolvedUrl (URL assinado temporário) nunca é persistido ----

// 1. studentToRow nunca inclui _resolvedUrl nas fotografias, só o path/date permanentes
(function(){
  var s = freshStudent({photos: [
    {date:"2026-09-01", path:"user1/a.jpg", _resolvedUrl:"https://signed.example/a.jpg?token=abc"},
    {date:"2026-09-02", path:"user1/b.jpg"}
  ]});
  var row = studentToRow(s);
  check.check("1. studentToRow() produz 2 fotos", row.photos.length === 2);
  check.check("1. Nenhuma foto persistida tem _resolvedUrl", row.photos.every(function(p){ return !("_resolvedUrl" in p); }));
  check.check("1. O path permanece intacto", row.photos[0].path === "user1/a.jpg" && row.photos[1].path === "user1/b.jpg");
  check.check("1. stripPhotoState não muta o objeto original (continua com _resolvedUrl em memória)", "_resolvedUrl" in s.photos[0]);
})();

// 2. stripPhotoState isolado: remove só _resolvedUrl, preserva o resto (incluindo dataUrl do modo local)
(function(){
  var p = {date:"2026-09-01", dataUrl:"data:image/jpeg;base64,xxx", _resolvedUrl:"https://x"};
  var stripped = stripPhotoState(p);
  check.check("2. Remove _resolvedUrl", !("_resolvedUrl" in stripped));
  check.check("2. Mantém dataUrl (fallback do modo local)", stripped.dataUrl === p.dataUrl);
  check.check("2. Mantém date", stripped.date === p.date);
})();

// ---- 2. Flag is_demo: alunos de demonstração distintos de alunos reais ----

// 3. studentToRow/rowToStudent fazem round-trip correto de isDemo
(function(){
  var demo = studentToRow(freshStudent({isDemo:true}));
  var real = studentToRow(freshStudent({isDemo:false}));
  var semFlag = studentToRow(freshStudent());
  check.check("3. is_demo=true persiste como true", demo.is_demo === true);
  check.check("3. is_demo=false persiste como false", real.is_demo === false);
  check.check("3. Sem isDemo definido, assume false (nunca undefined/null)", semFlag.is_demo === false);

  var backFromDb = rowToStudent({id:"x", is_demo:true, meals:[], photos:[], likes:[], dislikes:[], avoid:[], allergies:[]});
  check.check("3. rowToStudent traduz is_demo:true para isDemo:true", backFromDb.isDemo === true);
  var backSemCampo = rowToStudent({id:"x", meals:[], photos:[], likes:[], dislikes:[], avoid:[], allergies:[]});
  check.check("3. rowToStudent sem is_demo assume isDemo:false", backSemCampo.isDemo === false);
})();

// 4. visibleStudentsForDashboard(): esconde alunos de demonstração por omissão, mostra quando pedido
(function(){
  STUDENTS = [
    freshStudent({id:"a", isDemo:true, name:"Demo A"}),
    freshStudent({id:"b", isDemo:false, name:"Real B"}),
    freshStudent({id:"c", name:"Real C (sem flag)"})
  ];
  state.showDemoStudents = false;
  var hidden = visibleStudentsForDashboard();
  check.check("4. Por omissão esconde alunos de demonstração", hidden.length === 2);
  check.check("4. Os que ficam são os não-demo", hidden.every(function(s){ return !s.isDemo; }));

  state.showDemoStudents = true;
  var shown = visibleStudentsForDashboard();
  check.check("4. Com showDemoStudents=true mostra todos", shown.length === 3);
  state.showDemoStudents = false; // repõe o estado para não afetar outros testes
})();

// ---- 3. Recuperação de password e mensagens de erro mais claras ----

// 5. translateAuthError cobre os novos casos (limite de pedidos, falha de rede)
(function(){
  check.check("5. Traduz erro de limite de pedidos da Supabase", /espera um pouco/i.test(translateAuthError("For security purposes, you can only request this after 34 seconds")));
  check.check("5. Traduz falha de rede", /ligação/i.test(translateAuthError("Failed to fetch")));
  check.check("5. Continua a traduzir email não confirmado (regressão)", /confirma o teu email/i.test(translateAuthError("Email not confirmed")));
})();

// 6. O fluxo de recuperação de password existe no código-fonte
(function(){
  check.check("6. Existe um link/ação para pedir recuperação de password", appSource.indexOf('getElementById("authForgot")') >= 0);
  check.check("6. Chama sb.auth.resetPasswordForEmail", appSource.indexOf("resetPasswordForEmail") >= 0);
  check.check("6. Trata o evento PASSWORD_RECOVERY do Supabase", appSource.indexOf("PASSWORD_RECOVERY") >= 0);
  check.check("6. Permite definir a password nova via sb.auth.updateUser", appSource.indexOf("auth.updateUser({ password:") >= 0);
})();

// 7. Falha de ligação no arranque tem um ecrã próprio (não cai silenciosamente no login)
(function(){
  check.check("7. Existe o ecrã de erro de ligação", appSource.indexOf("connectionErrorScreen") >= 0);
  var bootFn = appSource.slice(appSource.indexOf("function boot("), appSource.indexOf("function boot(") + 800);
  check.check("7. boot() mostra connectionErrorScreen quando getSession() falha", bootFn.indexOf("connectionErrorScreen") >= 0);
})();

// 8. "Conta sem plano associado" foi corrigido — já não confunde com "sem aluno associado"
// (o markup vive fora do <script>, por isso lemos o HTML completo, não appSource)
(function(){
  var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  check.check("8. Já não usa o título antigo e confuso", html.indexOf(">Conta sem plano associado<") === -1);
  check.check("8. Usa o título correto: sem ALUNO associado", html.indexOf(">Conta sem aluno associado<") >= 0);
})();

// ---- 4. Remoção de fotografias ----

// 9. removePhoto(): em modo local (sbReady=false), remove do array e não rebenta
(function(){
  var s = freshStudent({photos:[{date:"2026-09-01", path:"u/a.jpg"}, {date:"2026-09-02", dataUrl:"data:x"}]});
  check.check("9. sbReady está false no ambiente de teste (pré-condição)", sbReady === false);
  removePhoto(s, 1);
  check.check("9. Remove a foto do índice indicado", s.photos.length === 1 && s.photos[0].path === "u/a.jpg");
  removePhoto(s, 0);
  check.check("9. Remove também a última foto restante", s.photos.length === 0);
})();

// 10. photoGridHtml mostra um botão de remover por cada fotografia, com o índice certo
(function(){
  var s = freshStudent({photos:[{date:"2026-09-01", path:"u/a.jpg"}, {date:"2026-09-02", path:"u/b.jpg"}]});
  var html = photoGridHtml(s);
  check.check("10. Tem 2 botões de remover", (html.match(/photo-remove/g) || []).length === 2);
  check.check("10. Os índices correspondem às fotos (data-idx 0 e 1)", html.indexOf('data-idx="0"') >= 0 && html.indexOf('data-idx="1"') >= 0);
})();

// ---- 5. Migrações novas desta fase ----

// 11. 0010_demo_flag.sql: coluna, backfill e comentário
(function(){
  var sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "0010_demo_flag.sql"), "utf8");
  check.check("11. Adiciona a coluna is_demo com default false", /add column if not exists is_demo boolean not null default false/.test(sql));
  check.check("11. Marca maria/rui/sofia/tiago como demo", /update students set is_demo = true where id in \('maria', 'rui', 'sofia', 'tiago'\)/.test(sql));
  check.check("11. Documenta como criar o primeiro aluno real", /primeiro aluno REAL/.test(sql));
})();

// 12. 0011_photo_deletion.sql: as duas políticas de delete, no padrão de pasta por utilizador
(function(){
  var sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "0011_photo_deletion.sql"), "utf8");
  check.check("12. Cria a política de delete do aluno", /"aluno remove as suas fotos"[\s\S]*?for delete/.test(sql));
  check.check("12. Cria a política de delete do profissional", /"profissional remove fotos dos alunos"[\s\S]*?for delete/.test(sql));
  check.check("12. A política do aluno restringe à própria pasta (auth.uid())", /"aluno remove as suas fotos"[\s\S]*?storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/.test(sql));
})();

// 13. manage_professionals.sql existe e documenta adicionar/remover sem editar migrações
(function(){
  var sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "manage_professionals.sql"), "utf8");
  check.check("13. Documenta o insert para adicionar um profissional", /insert into professionals/.test(sql));
  check.check("13. Documenta o delete para remover um profissional", /delete from professionals/.test(sql));
})();

// ---- 6. Bug crítico encontrado na validação ao vivo (Fase 9): upsert() em
// students falhava SEMPRE que o próprio aluno gravava (RLS rejeita o ramo
// ON CONFLICT DO UPDATE porque o aluno nunca tem política de INSERT) —
// impedia qualquer aluno real de gravar seja o que for. ----

// 14. persistStudent() já não usa upsert() em students — usa update().eq("id", ...)
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function persistStudent"), appSource.indexOf("function insertStudent"));
  check.check("14. persistStudent() não chama upsert()", fnSrc.indexOf(".upsert(") === -1);
  check.check("14. persistStudent() usa update().eq(\"id\", s.id)", /\.update\(studentToRow\(s\)\)\.eq\("id",\s*s\.id\)/.test(fnSrc));
})();

// 15. insertStudent() existe, para o único caso legítimo de criar um aluno (o profissional)
(function(){
  check.check("15. insertStudent() existe", typeof insertStudent === "function");
  var fnSrc = appSource.slice(appSource.indexOf("function insertStudent"), appSource.indexOf("function insertStudent") + 400);
  check.check("15. insertStudent() usa insert(), não upsert()/update()", fnSrc.indexOf(".insert(studentToRow(s))") >= 0 && fnSrc.indexOf(".upsert(") === -1);
})();

// 16. A criação de um novo aluno (openOnboardingForm) usa insertStudent(), não persistStudent()
(function(){
  var pushIdx = appSource.indexOf("STUDENTS.push(newStudent)");
  check.check("16. STUDENTS.push(newStudent) existe no código", pushIdx >= 0);
  var afterPush = appSource.slice(pushIdx, pushIdx + 120);
  check.check("16. É seguido de insertStudent(newStudent), não persistStudent(newStudent)", /insertStudent\(newStudent\)/.test(afterPush) && !/persistStudent\(newStudent\)/.test(afterPush));
})();

// 17. Nenhuma outra chamada a upsert() ficou esquecida em "students" (só help_request_notes, tabela diferente, deve usar upsert)
(function(){
  var studentsUpsertCalls = (appSource.match(/from\("students"\)\.upsert\(/g) || []).length;
  check.check("17. Zero chamadas a students'.upsert( restantes no código", studentsUpsertCalls === 0);
})();

check.summarize();
