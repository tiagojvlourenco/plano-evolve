// Contrato estático da migração 0032 (Corrida): as peças de segurança que decidimos ter continuam lá. Molde: tests/security.test.js, secções 6 a 13.
// Isto só LÊ o ficheiro SQL: não prova que corre nem que as políticas fazem o que dizem (isso é tests/runs-db.test.js, num Postgres local, e
// supabase/verify_security.sql bloco J, no projeto real). Serve para apanhar uma política, um gatilho ou uma restrição perdidos por engano.
var fs = require("fs");
var path = require("path");
var check = require("./check")();
var root = path.join(__dirname, "..");
var migDir = path.join(root, "supabase", "migrations");
var file = "0032_corrida.sql";
var raw = fs.readFileSync(path.join(migDir, file), "utf8");
var code = raw.replace(/--.*$/gm, "");            // sem comentários de linha (não há «--» dentro de textos nesta migração)
var verify = fs.readFileSync(path.join(root, "supabase", "verify_security.sql"), "utf8");
var TABLES = ["run_consents", "runs", "run_tracks"];
function has(re){ return re.test(code); }
function count(re){ return (code.match(re) || []).length; }
function block(startRe, endRe){ var m = startRe.exec(code); if (!m) return ""; var rest = code.slice(m.index); var e = endRe.exec(rest.slice(m[0].length)); return e ? rest.slice(0, m[0].length + e.index + e[0].length) : rest; }

// ---- 1. é a migração de número mais alto e não mexe nas anteriores ----
(function(){
  var files = fs.readdirSync(migDir).filter(function(f){ return /^\d{4}_.*\.sql$/.test(f); }).sort();
  var nums = files.map(function(f){ return parseInt(f.slice(0, 4), 10); });
  check.check("1. A 0032 existe, é a de número mais alto e a numeração não tem buracos nem repetidos", files.indexOf(file) >= 0 && nums[nums.length - 1] >= 32 && files.filter(function(f){ return /^0032_/.test(f); }).length === 1 && nums.every(function(n, i){ return n === i + 1; }));
  check.check("1. Diz que corre DEPOIS de 0001-0031 e que é segura de repetir", /DEPOIS de 0001-0031/.test(raw) && /seguro voltar a correr/.test(raw));
})();

// ---- 2. tabelas, colunas e limites ----
(function(){
  TABLES.forEach(function(t){ check.check("2. Cria a tabela " + t + " com 'create table if not exists'", new RegExp("create table if not exists " + t + " \\(").test(code)); });
  check.check("2. Não há 'create table' sem 'if not exists' nem 'drop table', 'drop column', 'truncate' ou 'drop schema'", count(/create table (?!if not exists)/gi) === 0 && !has(/drop\s+table|drop\s+column|truncate\s+\w|drop\s+schema/i));
  check.check("2. Só apaga dados num sítio: o gatilho de retirar o consentimento (um único 'delete from', dentro da função) e nunca faz update a dados", count(/\bdelete\s+from\b/gi) === 1 && /delete from public\.runs where student_id = old\.student_id/.test(code) && !has(/\bupdate\s+\w+\s+set\b/i));
  check.check("2. students.runs_mode: coluna 'if not exists', NOT NULL, por omissão 'off', com CHECK ('off', 'import', 'live') recriado de forma segura", /alter table students add column if not exists runs_mode text not null default 'off'/.test(code) && /alter table students drop constraint if exists students_runs_mode_check;\s*alter table students add constraint students_runs_mode_check check \(runs_mode in \('off', 'import', 'live'\)\)/.test(code));
  var runs = block(/create table if not exists runs \(/, /\);\s*create index/);
  check.check("2. runs não guarda coordenadas (sem lat, lon nem points: o percurso está noutra tabela) e tem o resumo completo", !/\blat\b|\blon\b|points/.test(runs) && ["duration_s", "moving_s", "distance_m", "gaps", "gap_s", "hidden_s", "splits_s", "rpe", "notes", "consent_v", "created_by", "started_at", "source"].every(function(c){ return new RegExp("\\b" + c + "\\b").test(runs); }));
  check.check("2. created_by tem 'default auth.uid()' e NOT NULL; started_at tem limites (2000-01-01 e agora + 2 dias); source só aceita as 6 origens", /created_by uuid not null default auth\.uid\(\)/.test(runs) && /started_at >= timestamptz '2000-01-01 00:00:00\+00' and started_at <= now\(\) \+ interval '2 days'/.test(runs) && /source in \('live', 'gpx', 'tcx', 'fit', 'manual', 'native'\)/.test(runs));
  check.check("2. Limites do resumo: duração 1 a 86400 s, tempo em movimento até 86400 s, distância até 300000 m, lacunas até 1000, notas até 300 caracteres, RPE 1 a 10, consent_v >= 1", /duration_s integer not null check \(duration_s between 1 and 86400\)/.test(runs) && /moving_s integer not null check \(moving_s between 0 and 86400\)/.test(runs) && /distance_m integer not null check \(distance_m between 0 and 300000\)/.test(runs) && /gaps smallint not null default 0 check \(gaps between 0 and 1000\)/.test(runs) && /char_length\(notes\) <= 300/.test(runs) && /rpe between 1 and 10/.test(runs) && /consent_v smallint not null check \(consent_v >= 1\)/.test(runs));
  check.check("2. Restrições entre colunas: moving_s <= duration_s e velocidade média <= 12 m/s escrita sem divisão (distance_m <= 12 * duration_s)", /runs_moving_le_duration check \(moving_s <= duration_s\)/.test(runs) && /runs_speed_plausible check \(distance_m <= 12 \* duration_s\)/.test(runs));
  check.check("2. Os parciais passam por run_splits_are_valid (até 300 números, 0 a 86400: nada de texto nem objetos)", /splits_s jsonb check \(splits_s is null or run_splits_are_valid\(splits_s\)\)/.test(runs) && /create or replace function run_splits_are_valid/.test(code) && /jsonb_array_length\(s\) > 300/.test(code) && /v < 0 or v > 86400/.test(code));
  var tracks = block(/create table if not exists run_tracks \(/, /\);\s*create index/);
  check.check("2. run_tracks: um percurso por corrida (run_id chave primária), fmt só 1, trim_m 0 a 2000, points validado por run_points_are_valid", /run_id uuid primary key/.test(tracks) && /fmt smallint not null default 1 check \(fmt = 1\)/.test(tracks) && /trim_m between 0 and 2000/.test(tracks) && /constraint run_tracks_points_valid check \(run_points_are_valid\(points\)\)/.test(tracks));
  check.check("2. run_points_are_valid: tamanho (200000 bytes) verificado ANTES de percorrer os pontos, 1 a 200 segmentos, pontos com exatamente 3 números (lat ±90, lon ±180, segundos 0 a 2592000 (30 dias))", /octet_length\(p::text\) > 200000/.test(code) && code.indexOf("octet_length(p::text) > 200000") < code.indexOf("jsonb_array_length(p) < 1") && /jsonb_array_length\(p\) < 1 or jsonb_array_length\(p\) > 200/.test(code) && /jsonb_array_length\(pt\) <> 3/.test(code) && /lat < -90 or lat > 90/.test(code) && /lon < -180 or lon > 180/.test(code) && /sec < 0 or sec > 2592000/.test(code));
  check.check("2. As funções de validação são imutáveis e têm search_path fixo (e NÃO se lhes retira o EXECUTE: os CHECKs correm com os direitos de quem insere)", count(/language plpgsql immutable set search_path = pg_catalog, pg_temp/g) === 2 && !/revoke[^;]*run_(splits|points)_are_valid/i.test(code));
  check.check("2. Chave estrangeira composta (run_id, student_id) → runs (id, student_id): o percurso é sempre do dono da corrida; runs tem unique (id, student_id)", /foreign key \(run_id, student_id\) references runs \(id, student_id\) on delete cascade/.test(tracks) && /unique \(id, student_id\)/.test(runs));
  check.check("2. A corrida só existe com o consentimento: chave estrangeira (student_id, consent_v) → run_consents (student_id, version) on delete cascade", /constraint runs_consent_fk foreign key \(student_id, consent_v\) references run_consents \(student_id, version\) on delete cascade/.test(runs));
  check.check("2. As 3 tabelas apagam-se em cascata com o aluno", TABLES.every(function(t){ return new RegExp("create table if not exists " + t + " \\([\\s\\S]*?student_id text not null references students\\(id\\) on delete cascade").test(code); }));
  var consents = block(/create table if not exists run_consents \(/, /\);\s*create table/);
  check.check("2. run_consents: chave primária (student_id, version) — uma linha por versão aceite, repetir dá 23505 — e version >= 1", /primary key \(student_id, version\)/.test(consents) && /version smallint not null default 1 check \(version >= 1\)/.test(consents));
  check.check("2. Índices 'if not exists' para as listas e para as chaves estrangeiras (runs por aluno e data; run_tracks por aluno)", /create index if not exists runs_student_started_idx on runs \(student_id, started_at desc\)/.test(code) && /create index if not exists run_tracks_student_idx on run_tracks \(student_id\)/.test(code) && count(/create index (?!if not exists)/gi) === 0);
})();

// ---- 3. RLS e políticas ----
(function(){
  TABLES.forEach(function(t){ check.check("3. RLS ligada em " + t + " (e nunca forçada nem desligada: a cascata de apagar corre como dono e tem de passar por cima dela)", new RegExp("alter table " + t + " enable row level security").test(code)); });
  check.check("3. Nenhum 'force row level security' nem 'disable row level security'", !has(/force\s+row\s+level\s+security|disable\s+row\s+level\s+security/i));
  var pol = []; var re = /create policy "([^"]+)" on (\w+) for (select|insert|update|delete|all)/g, m;
  while ((m = re.exec(code))) pol.push({name: m[1], table: m[2], cmd: m[3]});
  var by = function(t){ return pol.filter(function(p){ return p.table === t; }); };
  var cmds = function(t){ return by(t).map(function(p){ return p.cmd; }).sort().join(","); };
  check.check("3. run_consents tem exatamente 4 políticas (select ×2, insert, delete)", by("run_consents").length === 4 && cmds("run_consents") === "delete,insert,select,select");
  check.check("3. runs tem exatamente 5 políticas (select ×2, insert, delete ×2)", by("runs").length === 5 && cmds("runs") === "delete,delete,insert,select,select");
  check.check("3. run_tracks tem exatamente 5 políticas (select ×2, insert, delete ×2)", by("run_tracks").length === 5 && cmds("run_tracks") === "delete,delete,insert,select,select");
  check.check("3. Há 14 políticas no total e nenhuma é 'for update' nem 'for all' (nem para o aluno nem para o profissional)", pol.length === 14 && pol.every(function(p){ return p.cmd !== "update" && p.cmd !== "all"; }) && !has(/for\s+update|for\s+all/i));
  check.check("3. Nomes das políticas: 4 + 5 + 5 pelo padrão do projeto ('student …' e 'professionals …')", pol.every(function(p){ return /^(student|professionals) /.test(p.name); }) && by("runs").filter(function(p){ return /^student/.test(p.name); }).length === 3);
  var bodies = code.match(/create policy "[^"]+" on \w+ for \w+[\s\S]*?;/g) || [];
  check.check("3. Cada 'create policy' tem 'drop policy if exists' do mesmo nome e tabela imediatamente antes", bodies.length === 14 && pol.every(function(p){ return new RegExp('drop policy if exists "' + p.name + '" on ' + p.table + ';\\s*create policy "' + p.name + '" on ' + p.table + ' ').test(code); }));
  check.check("3. Todas as políticas usam auth.uid() (nunca um valor fixo)", bodies.every(function(b){ return /auth\.uid\(\)/.test(b); }));
  var students = bodies.filter(function(b){ return /create policy "student /.test(b); }), pros = bodies.filter(function(b){ return /create policy "professionals /.test(b); });
  check.check("3. As políticas do aluno identificam-no por students.auth_user_id = auth.uid() (a sua ficha), nunca pelo email", students.length === 9 && students.every(function(b){ return /st\.auth_user_id = auth\.uid\(\)/.test(b) && /st\.id = \w+\.student_id/.test(b); }) && !has(/auth\.email\(\)|auth\.jwt\(\)|invite_email|@[a-z0-9-]+\.[a-z]{2,}/i));
  check.check("3. As políticas do profissional identificam-no pela tabela professionals (user_id = auth.uid()), como 0009 e 0023", pros.length === 5 && pros.every(function(b){ return /exists \(select 1 from professionals where user_id = auth\.uid\(\)\)/.test(b); }));
  check.check("3. Nenhuma política é aberta ('using (true)', 'with check (true)')", !has(/using\s*\(\s*true\s*\)|with check\s*\(\s*true\s*\)/i));
  var ins = bodies.filter(function(b){ return /for insert/.test(b); });
  check.check("3. O profissional não cria nada: só o aluno tem 'for insert' (3 políticas, todas 'student …')", ins.length === 3 && ins.every(function(b){ return /create policy "student /.test(b); }));
  var runIns = bodies.filter(function(b){ return /on runs for insert/.test(b); })[0] || "";
  check.check("3. Criar corrida exige: created_by = auth.uid(), runs_mode <> 'off', live/native só com 'live', e o consentimento da versão de consent_v", /created_by = auth\.uid\(\)/.test(runIns) && /st\.runs_mode <> 'off'/.test(runIns) && /runs\.source not in \('live', 'native'\) or st\.runs_mode = 'live'/.test(runIns) && /from run_consents c where c\.student_id = runs\.student_id and c\.version = runs\.consent_v/.test(runIns));
  var del = bodies.filter(function(b){ return /for delete/.test(b); });
  check.check("3. Apagar nunca depende do modo nem do consentimento (o aluno apaga sempre o que é seu): as políticas de delete do aluno não leem runs_mode", del.length === 5 && del.filter(function(b){ return /create policy "student /.test(b); }).every(function(b){ return !/runs_mode|from run_consents/.test(b); }));
})();

// ---- 4. gatilhos, funções e direitos ----
(function(){
  check.check("4. Não recria nem mexe em enforce_student_column_permissions (a coluna nova fica fora da lista do aluno por omissão) nem desliga gatilhos", !has(/enforce_student_column_permissions|disable\s+trigger/i));
  check.check("4. O gatilho trg_run_consent_withdrawn apaga as corridas do aluno depois de apagar uma linha de run_consents (após cada linha), com 'drop trigger if exists' antes", /drop trigger if exists trg_run_consent_withdrawn on run_consents;\s*create trigger trg_run_consent_withdrawn after delete on run_consents for each row execute function run_consent_withdrawn\(\)/.test(code));
  var fn = block(/create or replace function run_consent_withdrawn\(\)/, /end \$\$;/);
  check.check("4. A função do gatilho é SECURITY DEFINER com search_path fixo e só apaga as corridas de old.student_id (a garantia não depende dos direitos do aluno)", /security definer set search_path = public, pg_temp/.test(fn) && /delete from public\.runs where student_id = old\.student_id/.test(fn));
  check.check("4. A função do gatilho não fica chamável por anon, authenticated nem PUBLIC (revoke all … from public, anon, authenticated)", /revoke all on function run_consent_withdrawn\(\) from public, anon, authenticated/.test(code));
  check.check("4. Toda a função SECURITY DEFINER e toda a função da Corrida tem search_path fixo", count(/create or replace function/g) === 4 && count(/set search_path = /g) === 4 && count(/security definer/g) === 1);
  check.check("4. A data do consentimento e a de criação da corrida são postas pelo servidor (gatilhos 'before insert')", /new\.accepted_at := now\(\)/.test(code) && /new\.created_at := now\(\)/.test(code) && /create trigger trg_run_consents_stamp before insert on run_consents/.test(code) && /create trigger trg_runs_stamp before insert on runs/.test(code) && count(/drop trigger if exists/g) === 3 && count(/create trigger/g) === 3);
  check.check("4. Direitos: retira tudo a anon e a authenticated nas 3 tabelas…", /revoke all on run_consents, runs, run_tracks from anon, authenticated;/.test(code));
  var grants = code.match(/\bgrant\b[^;]*;/gi) || [];
  check.check("4. … e o ÚNICO grant é select, insert, delete a authenticated (nunca a anon nem a public; nunca update, truncate, references, trigger nem all)", grants.length === 1 && /^grant select, insert, delete on run_consents, runs, run_tracks to authenticated;$/.test(grants[0]) && !has(/grant[^;]*\b(anon|public)\b/i) && !has(/grant[^;]*\b(update|truncate|references|trigger|all)\b/i));
  check.check("4. Explica o porquê dos grants explícitos (o Supabase deixa de dar direitos por omissão às tabelas novas) e que isso foi lido mas não testado no projeto", /30\/10\/2026/.test(raw) && /changelog 45329/.test(raw) && /lido mas não testado/.test(raw));
  check.check("4. Cada tabela tem 'comment on table' a explicar o modelo de acesso (e a coluna runs_mode tem 'comment on column')", TABLES.every(function(t){ return new RegExp("comment on table " + t + " is '[^']{40,}'").test(code); }) && /comment on column students\.runs_mode is '/.test(code));
  check.check("4. Termina com notify pgrst, 'reload schema' (cache de esquema do PostgREST) e diz que isso não foi verificado no Supabase real", /notify pgrst, 'reload schema';/.test(code) && /Nada disto foi verificado no Supabase real/.test(raw));
  check.check("4. O cabeçalho separa o que está provado (Postgres local) do que NÃO está (Supabase real)", /tests\/runs-db\.test\.js/.test(raw) && /NÃO provadas no Supabase real/.test(raw));
})();

// ---- 5. verify_security.sql, bloco J ----
(function(){
  var j = verify.slice(verify.indexOf("Teste funcional J: Corrida"));
  check.check("5. verify_security.sql tem o bloco J (Corrida, migração 0032) com as partes J-A, J-B, J-C e J-D", verify.indexOf("Teste funcional J: Corrida (migração 0032)") > 0 && ["J-A", "J-B", "J-C", "J-D"].every(function(p){ return j.indexOf(p) > 0; }));
  check.check("5. J-A confirma as políticas (4/5/5, sem update), os direitos com has_table_privilege (authenticated e anon), a RLS ligada e não forçada, runs_mode e o gatilho de colunas", /pg_policies/.test(j) && (j.match(/has_table_privilege\('authenticated'/g) || []).length >= 5 && /has_table_privilege\('anon'/.test(j) && /relrowsecurity/.test(j) && /relforcerowsecurity/.test(j) && /students_runs_mode_check/.test(j) && /enforce_student_column_permissions/.test(j));
  check.check("5. J-B é uma simulação com contas reais já existentes que NÃO grava nada: termina SEMPRE com 'raise exception' (rollback garantido), mesmo se tudo passar", /do \$sim\$/.test(j) && /raise exception E'J-B concluído \(nada foi gravado\)/.test(j) && !/\bcommit\b/i.test(j.slice(0, j.indexOf("J-C. Passos manuais"))));
  check.check("5. J-B testa o aluno A contra o aluno B (corridas, percursos, consentimentos), o anónimo, o profissional, o gatilho do runs_mode, os CHECKs e retirar o consentimento", ["B não vê as corridas de A", "B não apaga corridas de A", "B não vê o percurso de A", "anónimo não lê corridas", "não liga a Corrida a si próprio", "velocidade impossível", "A retira o consentimento", "o profissional não cria corridas", "chave estrangeira composta"].every(function(t){ return j.indexOf(t) > 0; }));
  check.check("5. J-C tem os passos manuais J1 a J11 para 2 contas de aluno e a do profissional, e J12 (limpeza), com o resultado esperado de cada um", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].every(function(n){ return new RegExp("\\bJ" + n + "[\\.\\s(]").test(j); }) && (j.match(/Esperado/g) || []).length >= 20);
  check.check("5. O bloco assume-se como NÃO corrido ainda no Supabase real (só provado num Postgres local)", /no Supabase real ainda nunca foi corrido/.test(j));
})();

check.summarize();
