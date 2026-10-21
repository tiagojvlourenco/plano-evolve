// Corrida (migração 0032) num Postgres REAL, local e descartável: isolamento aluno a aluno, RLS por papel, direitos de tabela, CHECKs, chave estrangeira
// composta, gatilhos (retirar o consentimento apaga tudo), cascatas, o gatilho REAL de colunas (0006 → 0019 → 0031) a impedir o aluno de ligar a
// Corrida a si próprio, a migração a correr várias vezes (também com dados) e dois pedidos em simultâneo (consentimento retirado ao mesmo tempo que se grava).
// O harness (tests/db/runs-permissions.sql) corre DUAS vezes, uma com os direitos por omissão ANTIGOS do Supabase e outra com os NOVOS (nada): os resultados
// têm de ser iguais. No fim corre também a simulação do bloco J-B de supabase/verify_security.sql para provar que o SCRIPT funciona.
// O que isto NÃO é: o Supabase real. auth.uid(), auth.email() e os papéis «authenticated» e «anon» são simulados; não há GoTrue, PostgREST, JWT, cache de
// esquema nem os direitos por omissão do projeto verdadeiro. Se não houver servidor Postgres nesta máquina, a parte do servidor é saltada e diz-se.
var fs = require("fs");
var path = require("path");
var cp = require("child_process");
var check = require("./check")();
var root = path.join(__dirname, "..");
var mig = path.join(root, "supabase", "migrations");

// ---- 1. ficheiros (sem servidor) ----
var harnessPath = path.join(__dirname, "db", "runs-permissions.sql");
var harness = fs.readFileSync(harnessPath, "utf8");
var verifySql = fs.readFileSync(path.join(root, "supabase", "verify_security.sql"), "utf8");
check.check("1. O harness usa o gatilho REAL (0006, 0019, 0031) e corre a 0032 duas vezes seguidas antes dos casos", /0006_append_only_history\.sql/.test(harness) && /0019_training_program\.sql/.test(harness) && /0031_weight_professional_only\.sql/.test(harness) && /\\i :migrations\/0032_corrida\.sql\s*\n\\i :migrations\/0032_corrida\.sql/.test(harness));
check.check("1. O harness simula os direitos por omissão antigos E os novos do Supabase", /\\if :old_defaults/.test(harness) && /alter default privileges in schema public grant all on tables to anon, authenticated/.test(harness));
check.check("1. O bloco J-B de verify_security.sql tem marcas de início e fim (o teste extrai-o e corre-o)", verifySql.indexOf("-- >>> J-B (início)") > 0 && verifySql.indexOf("-- <<< J-B (fim)") > verifySql.indexOf("-- >>> J-B (início)"));

// ---- o que se espera de cada caso do harness (id → resultado exato, expressão regular ou função) ----
function rls(tbl){ return "erro 42501 [] new row violates row-level security policy for table \"" + tbl + "\""; }
function denied(tbl){ return "erro 42501 [] permission denied for table " + tbl; }
function chk(name){ return new RegExp("^erro 23514 \\[" + name + "\\] "); }
var TRIG = "erro P0001 [] Só o profissional pode alterar estes dados do plano.";
function num(v){ return parseInt(v, 10); }
var groups = [];
function grp(title, items){ groups.push({title: title, items: items}); }

grp("3. Direitos de tabela: o aluno e o profissional (authenticated) só têm select, insert e delete; anónimo e PUBLIC nada; nada de truncate; RLS ligada e não forçada; a função do gatilho só do dono", [
  ["D01", "run_consents:delete,run_consents:insert,run_consents:select,run_tracks:delete,run_tracks:insert,run_tracks:select,runs:delete,runs:insert,runs:select"],
  ["D02", "0"], ["D03", "0"], ["D04", denied("runs")], ["D05", denied("run_tracks")], ["D06", denied("run_consents")], ["D07", denied("runs")], ["D08", denied("run_consents")],
  ["D09", denied("runs")], ["D10", denied("run_tracks")], ["D11", "{OWNER=X/OWNER}"], ["D12", "3"], ["D13", "0"]
]);
grp("4. A migração é segura com alunos que já existiam: todos ficam em 'off', sem perder nenhum, e a coluna é NOT NULL com CHECK", [
  ["J01", "7/7"], ["J02", "NO|'off'::text"], ["J03", /runs_mode = ANY \(ARRAY\['off'::text, 'import'::text, 'live'::text\]\)/]
]);
grp("5. runs_mode é só do profissional (gatilho REAL de 0031): o aluno não o muda para outro valor (nem para off, nem com outras colunas, nem inválido), a repetição do mesmo valor passa sem mudar nada, o profissional escreve, valor inválido e nulo recusados, ninguém lê o de outro, o convite por reclamar não é caminho", [
  ["M01", "0"], ["M02", "1"], ["M03", TRIG], ["M04", TRIG], ["M05", "ok 1"], ["M06", "ok 1"], ["M07", TRIG], ["M08", TRIG], ["M09", "ok 1"], ["M10", "import"],
  ["M11", TRIG], ["M12", TRIG], ["M13", TRIG], ["M14", chk("students_runs_mode_check")], ["M15", /^erro 23502 /], ["M16", "ok 0"], ["M17", "ok 1"],
  ["M18", "ok 0"], ["M19", "ok 1"], ["M20", "00000000-0000-0000-0000-0000000000c1/off"], ["M20b", TRIG], ["M21", rls("students")], ["M22", "ok 0"],
  ["M23", "s1=live,s2=import,s3=off,spt=off,sr1=off,sr2=off,su=off"]
]);
grp("6. Consentimento: o aluno dá o seu (nunca o de outro, nem o profissional), a data é do servidor, versão nova = linha nova, repetir = 23505, versão 0 recusada, cada um só vê o seu, sem update e sem o profissional a apagar", [
  ["C01", rls("runs")], ["C02", "ok 1"], ["C03", "true"], ["C04", rls("run_consents")], ["C05", rls("run_consents")], ["C06", "ok 1"], ["C07", "ok 1"],
  ["C08", /^erro 23505 \[run_consents_pkey\] /], ["C09", chk("run_consents_version_check")], ["C10", "ok 1"], ["C11", "ok 1"], ["C12", "ok 2"], ["C13", "ok 0"],
  ["C14", "ok 4"], ["C15", "ok 0"], ["C16", denied("run_consents")], ["C17", denied("run_consents")], ["C18", "ok 0"], ["C19", "ok 0"], ["C20", /^erro 23505 \[run_consents_pkey\] /]
]);
grp("7. Criar corrida: só a própria, com created_by = quem pede, com o modo ligado (live/native só com 'live'), com o consentimento da versão indicada; reenvio = 23505 (upsert com update recusado, «ignorar duplicados» não altera nada); sem sessão, anónimo e profissional recusados; created_at é do servidor", [
  ["R01", "ok 1"], ["R02", /^erro 23505 \[runs_pkey\] /], ["R03", rls("runs")], ["R04", rls("runs")], ["R05", "ok 1"], ["R06", rls("runs")], ["R07", rls("runs")],
  ["R08", "ok 1"], ["R09", "ok 1"], ["R10", "ok 1"], ["R11", chk("runs_source_check")], ["R12", rls("runs")], ["R13", rls("runs")], ["R14", denied("runs")],
  ["R15", rls("runs")], ["R16", rls("runs")], ["R17", rls("runs")], ["R18", rls("runs")], ["R20", "ok 1"], ["R21", /^erro 23503 \[runs_consent_fk\] /],
  ["R22", "ok 1"], ["R23", "ok 1"], ["R24", "ok 1"], ["R25", "0"], ["R26", rls("runs")], ["R27", "ok 1"], ["R28", "ok 1"], ["R29", "ok 1"], ["R30", rls("runs")],
  ["R31", denied("runs")], ["R32", "ok 0"], ["R33", "10000"]
]);
grp("8. Valores fora dos limites recusados pelo CHECK certo (e os limites exatos aceites): duração, tempo em movimento, distância, velocidade média, data, notas, RPE, lacunas, parciais", [
  ["K01", "ok 1"], ["K02", "ok 1"], ["K03", "ok 1"], ["K04", "ok 1"], ["K05", "ok 1"], ["K06", "ok 1"], ["K07", "ok 1"],
  ["K10", chk("runs_duration_s_check")], ["K11", chk("runs_duration_s_check")], ["K12", chk("runs_moving_s_check")], ["K13", chk("runs_moving_le_duration")],
  ["K14", chk("runs_distance_m_check")], ["K15", chk("runs_distance_m_check")], ["K16", chk("runs_speed_plausible")], ["K17", chk("runs_distance_m_check")],
  ["K18", chk("runs_started_at_check")], ["K19", chk("runs_started_at_check")], ["K20", chk("runs_notes_check")], ["K21", chk("runs_rpe_check")], ["K22", chk("runs_rpe_check")],
  ["K23", chk("runs_gaps_check")], ["K24", chk("runs_gap_s_check")], ["K25", chk("runs_hidden_s_check")], ["K26", chk("runs_hidden_s_check")], ["K27", chk("runs_source_check")],
  ["K30", "ok 1"], ["K31", chk("runs_splits_s_check")], ["K32", chk("runs_splits_s_check")], ["K33", chk("runs_splits_s_check")], ["K34", chk("runs_splits_s_check")],
  ["K35", chk("runs_splits_s_check")], ["K36", chk("runs_splits_s_check")], ["K37", chk("runs_splits_s_check")], ["K38", chk("runs_splits_s_check")], ["K39", chk("runs_splits_s_check")],
  ["K40", "ok 1"], ["K41", "ok 1"]
]);
grp("9. Leitura das corridas: cada aluno só as suas, outro aluno e sem sessão nada, o profissional todas; ninguém faz update (nem muda student_id)", [
  ["L01", /^só as dele \([1-9]\d*\)$/], ["L02", "ok 0"], ["L03", "ok 0"], ["L04", "ok 0"], ["L05", "ok 0"], ["L06", /^todas \([1-9]\d*\)$/], ["L07", "3"],
  ["L08", denied("runs")], ["L09", denied("runs")], ["L10", denied("runs")]
]);
grp("10. Percursos: só de uma corrida do mesmo aluno (chave estrangeira composta), reenvio = 23505, o profissional não os cria, 200 segmentos aceites e 201 recusados, o maior que cabe em 200000 bytes aceite e mais um ponto recusado, e só números nas coordenadas (texto, objetos, nulos e coordenadas impossíveis recusados)", [
  ["T01", "ok 1"], ["T02", /^erro 23505 \[run_tracks_pkey\] /], ["T02b", "ok 1"], ["T02c", "ok 1"], ["T03", /^erro 23503 \[run_tracks_run_id_student_id_fkey\] /], ["T04", rls("run_tracks")],
  ["T05", /^erro 23503 \[run_tracks_run_id_student_id_fkey\] /], ["T06", "ok 1"], ["T07", rls("run_tracks")], ["T08", chk("run_tracks_points_valid")], ["T09", "ok 1"], ["T10", "ok 1"],
  ["T11", chk("run_tracks_points_valid")], ["T12", chk("run_tracks_points_valid")], ["T13", chk("run_tracks_points_valid")],
  ["T14", /^71\d\d$/], ["T15", function(v){ var m = /^(\d+)<=200000<(\d+)$/.exec(v); return !!m && num(m[1]) <= 200000 && num(m[2]) > 200000; }],
  ["T16", "ok 1"], ["T17", "ok 1"], ["T18", chk("run_tracks_points_valid")], ["T19", chk("run_tracks_points_valid")],
  ["T20", chk("run_tracks_points_valid")], ["T21", chk("run_tracks_points_valid")], ["T22", chk("run_tracks_points_valid")], ["T23", chk("run_tracks_points_valid")],
  ["T24", chk("run_tracks_points_valid")], ["T25", chk("run_tracks_points_valid")], ["T26", chk("run_tracks_points_valid")], ["T27", chk("run_tracks_points_valid")],
  ["T28", chk("run_tracks_points_valid")], ["T29", chk("run_tracks_points_valid")], ["T30", chk("run_tracks_points_valid")], ["T31", chk("run_tracks_points_valid")],
  ["T32", chk("run_tracks_points_valid")], ["T33", chk("run_tracks_points_valid")], ["T34", chk("run_tracks_points_valid")],
  ["T35", chk("run_tracks_trim_m_check")], ["T36", chk("run_tracks_trim_m_check")], ["T37", chk("run_tracks_fmt_check")], ["T38", "ok 1"], ["T39", "ok 1"],
  ["T40", /^rápido ms=\d+$/]
]);
grp("11. Leitura dos percursos: cada aluno só os seus; o profissional lê os que existem (uma corrida sem percurso não tem linha para ele ver: só há percurso partilhado se houver linha); ninguém faz update; outro aluno não apaga", [
  ["V01", "ok 1"], ["V02", "ok 1"], ["V03", "ok 0"], ["V04", "ok 0"], ["V05", "ok 2"], ["V06", "ok 1"], ["V07", "ok 0"], ["V08", "ok 2"],
  ["V09", denied("run_tracks")], ["V10", denied("run_tracks")], ["V11", "ok 0"], ["V12", "2"]
]);
grp("12. Mesmo COM o direito de UPDATE concedido, não há política de update (aluno, profissional; corridas, percursos e consentimentos: 0 linhas); sem o direito, recusado; e se alguém acrescentar POR ENGANO uma política de update permissiva, o direito de tabela retirado falha primeiro", [
  ["U01", "ok 0"], ["U02", "ok 0"], ["U03", "ok 0"], ["U04", "ok 0"], ["U05", "ok 0"], ["U06", "ok 0"], ["U07", denied("runs")],
  ["U08", denied("runs")], ["U09", denied("run_tracks")], ["U10", denied("run_consents")], ["U11", denied("runs")]
]);
grp("13. Apagar: outro aluno e sem sessão não apagam; o profissional apaga corridas e percursos; apagar a corrida leva o percurso (também quando quem apaga não tem direito de delete nos percursos); só o percurso deixa a corrida; com a Corrida desligada o aluno ainda lê e apaga mas já não cria, e um percurso em reenvio ainda entra", [
  ["X01", "ok 0"], ["X02", "ok 0"], ["X03", "ok 0"], ["X04", "1"], ["X05", "ok 1"], ["X06", "0"], ["X07", "ok 1"], ["X08", "0"], ["X09", "ok 1"], ["X10", "1"],
  ["X11", "ok 1"], ["X12", "ok 1"], ["X13", rls("runs")], ["X14", "ok 1"], ["X15", "ok 1"], ["X16", "ok 1"], ["X17", "0"], ["X18", "ok 1"]
]);
grp("14. Retirar o consentimento apaga TODAS as corridas e percursos do aluno (também se só se apagar UMA das versões; também sem o aluno ter direito nem política de delete em runs), nunca as de outros, e depois o aluno já não cria; o profissional não retira consentimentos; a migração repara direitos e políticas em falta", [
  ["W01", /^\d+\/1\/1$/], ["W02", "3"], ["W03", "ok 1"], ["W04", "0/0/0"], ["W05", rls("runs")], ["W06", function(v, r){ return v === r.W02; }],
  ["W07", "ok 1"], ["W08", "ok 1"], ["W09", "5/3"], ["W10", "ok 1"], ["W11", "0/1"], ["W12", "ok 1"], ["W13", "ok 1"], ["W14", "ok 1"], ["W15", denied("runs")], ["W16", "2"],
  ["W17", "ok 2"], ["W18", "0/0"], ["W22", "true/5"], ["W19", "ok 1"], ["W20", "ok 0"], ["W21", "1"]
]);
grp("15. Apagar o aluno leva as corridas, os percursos e os consentimentos em cascata (o aluno não apaga a sua ficha; o profissional sim)", [
  ["Z01", "ok 1"], ["Z02", "ok 1"], ["Z03", "1/1/1"], ["Z04", "ok 0"], ["Z05", "ok 1"], ["Z06", "0/0/0"]
]);
grp("16. A 0032 volta a correr com dados lá dentro sem perder nem duplicar nada: mesmas contagens, 4/5/5 políticas, 3 gatilhos, 5 restrições, 4 funções", [
  ["I01", function(v, r){ return v === r.I02 && /^\d+\/\d+\/\d+\/\d+$/.test(v); }], ["I02", /^\d+\/\d+\/\d+\/\d+$/], ["I03", "run_consents=4,run_tracks=5,runs=5"],
  ["I04", "trg_run_consent_withdrawn,trg_run_consents_stamp,trg_runs_stamp"], ["I05", "5"], ["I06", "4"]
]);
grp("17. Os alunos e corridas dos pedidos em simultâneo ficam prontos", [
  ["Y01", "ok 2"], ["Y02", "ok 1"], ["Y03", "ok 1"], ["Y04", "ok 1"]
]);
var expectedIds = [];
groups.forEach(function(g){ g.items.forEach(function(it){ expectedIds.push(it[0]); }); });

// ---- 2. servidor ----
function pgBin(){ var d = "/usr/lib/postgresql"; try { var v = fs.readdirSync(d).sort(function(a, b){ return parseInt(a, 10) - parseInt(b, 10); }).pop(); var b = path.join(d, v, "bin"); return fs.existsSync(path.join(b, "initdb")) && fs.existsSync(path.join(b, "postgres")) ? b : null; } catch (e) { return null; } }
var bin = pgBin(), psqlOk = cp.spawnSync("psql", ["--version"]).status === 0;
if (!bin || !psqlOk){
  console.log("SALTADO: não há servidor Postgres/psql nesta máquina; as políticas, os CHECKs, os gatilhos e as cascatas da 0032 não foram exercitados (só o contrato estático, em corrida-migration.test.js).");
  check.summarize();
}
var isRoot = process.getuid && process.getuid() === 0;
var tmp = fs.mkdtempSync(path.join("/tmp", "evolve-pg-runs-"));
function run(cmd, args, opts){ return isRoot ? cp.spawnSync("runuser", ["-u", "postgres", "--", cmd].concat(args), opts) : cp.spawnSync(cmd, args, opts); }
function sleep(s){ cp.spawnSync("sleep", [String(s)]); }
function waitFor(file, seconds){ var n = Math.round(seconds / 0.05); for (var i = 0; i < n; i++){ if (fs.existsSync(file)) return true; sleep(0.05); } return fs.existsSync(file); }
if (isRoot) cp.spawnSync("chown", ["postgres", tmp]); else fs.chmodSync(tmp, 448);
var started = false, spawned = [];
function stopServer(){ if (started){ run(path.join(bin, "pg_ctl"), ["-D", path.join(tmp, "data"), "-m", "immediate", "stop"], {encoding: "utf8"}); started = false; } }
function finish(){ stopServer(); cp.spawnSync("rm", ["-rf", tmp]); check.summarize(); }
var init = run(path.join(bin, "initdb"), ["-D", path.join(tmp, "data"), "-A", "trust", "-E", "UTF8", "--no-locale"], {encoding: "utf8"});
var start = init.status === 0 && run(path.join(bin, "pg_ctl"), ["-D", path.join(tmp, "data"), "-o", "-k " + tmp + " -c listen_addresses='' -c fsync=off -c synchronous_commit=off", "-w", "start", "-l", path.join(tmp, "log")], {encoding: "utf8"});
if (!start || start.status !== 0){
  console.log("SALTADO: não foi possível arrancar um Postgres temporário (" + String((init.stderr || "") + (start && start.stderr || "")).trim().split("\n")[0] + ").");
  finish();
}
started = true;
function psql(db, args, opts){ return run("psql", ["-h", tmp, "-d", db, "-q", "-t", "-A"].concat(args), Object.assign({encoding: "utf8"}, opts || {})); }
function sql(db, text){ var o = psql(db, ["-v", "ON_ERROR_STOP=1", "-c", text]); return {out: String(o.stdout).trim(), err: String(o.stderr).trim(), status: o.status}; }

try {
  // o servidor corre como outro utilizador: copia os SQL para a pasta temporária (legível por ele)
  var sqlDir = path.join(tmp, "sql"); fs.mkdirSync(sqlDir);
  ["0006_append_only_history.sql", "0008_claim_via_function.sql", "0019_training_program.sql", "0031_weight_professional_only.sql", "0032_corrida.sql"].forEach(function(f){ fs.copyFileSync(path.join(mig, f), path.join(sqlDir, f)); });
  fs.copyFileSync(harnessPath, path.join(sqlDir, "harness.sql"));
  cp.spawnSync("chmod", ["-R", "a+rX", tmp]);

  function runHarness(db, oldDefaults, asOwner){
    var c = psql("postgres", ["-c", "create database " + db + " encoding 'UTF8' template template0"]);
    if (c.status !== 0) return {status: c.status, results: {}, stderr: String(c.stderr)};
    var out = psql(db, ["-v", "ON_ERROR_STOP=1", "-v", "migrations=" + sqlDir, "-v", "old_defaults=" + (oldDefaults ? 1 : 0), "-v", "as_owner=" + (asOwner ? 1 : 0), "-f", path.join(sqlDir, "harness.sql")]);
    var r = {};
    String(out.stdout).split("\n").filter(function(l){ return /^RES\|/.test(l); }).forEach(function(l){ var p = l.split("|"); r[p[1]] = p.slice(2).join("|"); });
    return {status: out.status, results: r, stderr: String(out.stderr).split("\n").filter(function(l){ return !/NOTICE/.test(l); }).join("\n")};
  }
  var oldMode = runHarness("h_old", true, false), newMode = runHarness("h_new", false, false), ownerMode = runHarness("h_owner", false, true);
  var norm = function(v){ return String(v).replace(/ms=\d+/, "ms=N"); };

  check.check("2. O harness correu até ao fim nos três modos (a 0032 aplicada 2 vezes seguidas sem erro, e outra vez com dados lá dentro)" + (oldMode.status !== 0 ? " — modo antigo: " + oldMode.stderr.slice(0, 300) : "") + (newMode.status !== 0 ? " — modo novo: " + newMode.stderr.slice(0, 300) : "") + (ownerMode.status !== 0 ? " — dono sem superutilizador: " + ownerMode.stderr.slice(0, 300) : ""), oldMode.status === 0 && newMode.status === 0 && ownerMode.status === 0);
  var ids = Object.keys(newMode.results);
  var missing = expectedIds.filter(function(i){ return ids.indexOf(i) < 0; }), extra = ids.filter(function(i){ return expectedIds.indexOf(i) < 0; });
  check.check("2. Não faltam casos nem há casos por explicar (" + expectedIds.length + " esperados)" + (missing.length ? " — em falta: " + missing.join(",") : "") + (extra.length ? " — a mais: " + extra.join(",") : ""), missing.length === 0 && extra.length === 0);
  var differ = ids.filter(function(i){ return norm(newMode.results[i]) !== norm(oldMode.results[i]); });
  check.check("2. Os resultados são idênticos com os direitos por omissão ANTIGOS e NOVOS do Supabase (a 0032 diz o que quer, não depende deles)" + (differ.length ? " — diferem: " + differ.join(",") : ""), differ.length === 0 && ids.length === Object.keys(oldMode.results).length);
  var differOwner = ids.filter(function(i){ return norm(newMode.results[i]) !== norm(ownerMode.results[i]); });
  check.check("2. … e idênticos quando tudo (tabelas, migrações, casos) corre como um dono SEM superutilizador, como o papel «postgres» do Supabase (a 0032 não precisa de privilégios de superutilizador)" + (differOwner.length ? " — diferem: " + differOwner.join(",") : ""), differOwner.length === 0 && ids.length === Object.keys(ownerMode.results).length);

  // a 0032 como UMA só instrução de texto (é assim que o SQL Editor do Supabase a envia) e numa única transação, repetida
  var one = psql("postgres", ["-c", "create database h_one encoding 'UTF8' template template0"]);
  psql("h_one", ["-v", "ON_ERROR_STOP=1", "-c", "create schema auth; create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$; create table professionals (user_id uuid primary key); create table students (id text primary key, auth_user_id uuid, name text not null); insert into students values ('s1', null, 'Um'), ('s2', null, 'Dois')"]);
  var migText = fs.readFileSync(path.join(mig, "0032_corrida.sql"), "utf8");
  var oneA = psql("h_one", ["-v", "ON_ERROR_STOP=1", "-c", migText]), oneB = psql("h_one", ["-v", "ON_ERROR_STOP=1", "-c", migText]);
  var oneC = psql("h_one", ["-v", "ON_ERROR_STOP=1", "-1", "-f", path.join(sqlDir, "0032_corrida.sql")]);
  var oneState = psql("h_one", ["-c", "select (select string_agg(runs_mode, ',') from students) || '/' || (select count(*) from pg_policies where tablename in ('run_consents', 'runs', 'run_tracks'))"]).stdout.trim();
  check.check("2. A 0032 corre como UMA só instrução de texto (como no SQL Editor do Supabase), duas vezes seguidas, e numa única transação, sobre uma tabela students com linhas: todas ficam em 'off' e há 14 políticas" + (oneA.status || oneB.status || oneC.status ? " — " + String(oneA.stderr || oneB.stderr || oneC.stderr).slice(0, 300) : ""), one.status === 0 && oneA.status === 0 && oneB.status === 0 && oneC.status === 0 && oneState === "off,off/14");

  function matches(exp, v, all){ return typeof exp === "string" ? v === exp : (typeof exp === "function" ? !!exp(v, all) : exp.test(v)); }
  groups.forEach(function(g){
    var bad = g.items.filter(function(it){ var v = newMode.results[it[0]]; return v === undefined || !matches(it[1], v, newMode.results); }).map(function(it){ return it[0] + "=" + JSON.stringify(newMode.results[it[0]]); });
    check.check(g.title + (bad.length ? " — FALHARAM: " + bad.join(" | ") : ""), bad.length === 0);
  });

  // ---- 3. pedidos em simultâneo (duas sessões) ----
  var raceDir = path.join(tmp, "race"); fs.mkdirSync(raceDir);
  var D1 = "00000000-0000-0000-0000-0000000000d1", D2 = "00000000-0000-0000-0000-0000000000d2";
  function script(uid, body, name, hold){
    return ["\\set ON_ERROR_STOP on", "begin;", "select set_config('request.jwt.claim.sub', '" + uid + "', true);", "set local role authenticated;", body,
      hold ? "\\! touch " + raceDir + "/" + name + "_ready" : "",
      hold ? "\\! i=0; while [ ! -f " + raceDir + "/go ] && [ $i -lt 600 ]; do sleep 0.05; i=$((i+1)); done" : "",
      "commit;", "\\! touch " + raceDir + "/" + name + "_done", ""].join("\n");
  }
  function clearRace(){ fs.readdirSync(raceDir).forEach(function(f){ try { fs.unlinkSync(path.join(raceDir, f)); } catch (e) {} }); cp.spawnSync("chmod", ["-R", "a+rwX", raceDir]); }
  function launch(name, text){
    var f = path.join(raceDir, name + ".sql"); fs.writeFileSync(f, text); cp.spawnSync("chmod", ["a+r", f]);
    var log = fs.openSync(path.join(raceDir, name + ".log"), "w");
    var args = ["-h", tmp, "-d", "h_new", "-q", "-t", "-A", "-f", f];
    var child = isRoot ? cp.spawn("runuser", ["-u", "postgres", "--", "psql"].concat(args), {stdio: ["ignore", log, log]}) : cp.spawn("psql", args, {stdio: ["ignore", log, log]});
    spawned.push(child);
  }
  function readLog(name){ try { return fs.readFileSync(path.join(raceDir, name + ".log"), "utf8").trim(); } catch (e) { return ""; } }
  // B grava (insere e fica à espera), A retira o consentimento no meio; devolve o que se viu
  function race(bBody, aBody, uid){
    clearRace();
    launch("b", script(uid, bBody, "b", true));
    var bReady = waitFor(path.join(raceDir, "b_ready"), 10);
    launch("a", script(uid, aBody, "a", false));
    // espera até A ficar bloqueado à espera de B (Lock) ou terminar sem esperar (sem a chave estrangeira); nunca por um tempo fixo
    var waiting = 0, aEarly = false;
    for (var k = 0; k < 100 && !waiting && !aEarly; k++){
      sleep(0.1);
      aEarly = fs.existsSync(path.join(raceDir, "a_done"));
      waiting = num(sql("h_new", "select count(*) from pg_stat_activity where datname = 'h_new' and wait_event_type = 'Lock'").out);
    }
    if (waiting) sleep(0.5);   // B continua parado, por isso A não pode acabar entretanto
    aEarly = fs.existsSync(path.join(raceDir, "a_done"));
    fs.writeFileSync(path.join(raceDir, "go"), ""); cp.spawnSync("chmod", ["a+rw", path.join(raceDir, "go")]);
    var bDone = waitFor(path.join(raceDir, "b_done"), 10), aDone = waitFor(path.join(raceDir, "a_done"), 10);
    return {bReady: bReady, aEarly: aEarly, waiting: waiting, bDone: bDone, aDone: aDone, logs: readLog("b") + readLog("a")};
  }
  function count(q){ return num(sql("h_new", q).out); }
  var uuid8 = "88888888-8888-8888-8888-888888888888";
  var insB = "insert into runs (id, student_id, started_at, source, duration_s, moving_s, distance_m, consent_v) values ('" + uuid8 + "', 'sr1', now() - interval '1 hour', 'gpx', 600, 600, 1500, 1);";
  var delA = "delete from run_consents where student_id = 'sr1';";
  function resetSr1(){ sql("h_new", "delete from run_consents where student_id = 'sr1'; delete from runs where student_id = 'sr1'; insert into run_consents (student_id, version) values ('sr1', 1)"); }
  var fkDef = sql("h_new", "select pg_get_constraintdef(oid) from pg_constraint where conname = 'runs_consent_fk'").out;

  // 3a. SEM a chave estrangeira (o desenho de partida): o problema era real — a corrida sobrevive ao consentimento retirado
  resetSr1();
  sql("h_new", "alter table runs drop constraint runs_consent_fk");
  var noFk = race(insB, delA, D1);
  var orphans = count("select count(*) from runs where student_id = 'sr1'"), consents = count("select count(*) from run_consents where student_id = 'sr1'");
  check.check("18. SEM a chave estrangeira consent_v → run_consents (prova do problema): retirar o consentimento ao mesmo tempo que se grava deixa uma corrida SEM consentimento" + (noFk.logs ? " — " + noFk.logs.slice(0, 200) : ""), noFk.bReady && noFk.aEarly && noFk.bDone && noFk.aDone && orphans === 1 && consents === 0);
  sql("h_new", "delete from runs where student_id = 'sr1'; alter table runs add constraint runs_consent_fk " + fkDef);
  check.check("18. (A restrição foi reposta com a definição da migração: foreign key (student_id, consent_v) → run_consents on delete cascade)", /FOREIGN KEY \(student_id, consent_v\) REFERENCES run_consents\(student_id, version\) ON DELETE CASCADE/.test(fkDef) && count("select count(*) from pg_constraint where conname = 'runs_consent_fk'") === 1);

  // 3b. COM a chave estrangeira: a retirada espera pela corrida e depois apaga-a; não sobra nada
  resetSr1();
  var withFk = race(insB, delA, D1);
  check.check("18. COM a chave estrangeira: retirar o consentimento espera pela corrida que está a ser gravada (pedido bloqueado enquanto o outro não termina)" + (withFk.logs ? " — " + withFk.logs.slice(0, 200) : ""), withFk.bReady && !withFk.aEarly && withFk.waiting >= 1 && withFk.bDone && withFk.aDone);
  check.check("18. … e no fim não fica nenhuma corrida nem consentimento do aluno (a corrida gravada a meio foi apagada com o consentimento)", count("select count(*) from runs where student_id = 'sr1'") === 0 && count("select count(*) from run_consents where student_id = 'sr1'") === 0);

  // 3c. percurso a ser gravado ao mesmo tempo que se retira o consentimento: nem corrida nem percurso ficam
  var insTrack = "insert into run_tracks (run_id, student_id, points) values ('77777777-7777-7777-7777-777777777777', 'sr2', '[[[38.7, -9.1, 0], [38.71, -9.11, 60]]]');";
  var trk = race(insTrack, "delete from run_consents where student_id = 'sr2';", D2);
  check.check("18. Percurso gravado ao mesmo tempo que se retira o consentimento: a retirada espera e depois leva a corrida e o percurso (0 e 0)" + (trk.logs ? " — " + trk.logs.slice(0, 200) : ""),
    trk.bReady && !trk.aEarly && trk.waiting >= 1 && trk.bDone && trk.aDone && count("select count(*) from runs where student_id = 'sr2'") === 0 && count("select count(*) from run_tracks where student_id = 'sr2'") === 0);

  // ---- 4. o script de simulação de verify_security.sql (bloco J-B): corre, passa tudo e não grava nada ----
  var a = verifySql.indexOf("-- >>> J-B (início)"), b = verifySql.indexOf("-- <<< J-B (fim)");
  fs.writeFileSync(path.join(sqlDir, "jb.sql"), verifySql.slice(a, b)); cp.spawnSync("chmod", ["a+r", path.join(sqlDir, "jb.sql")]);
  var snapQ = "select (select count(*) from runs) || '/' || (select count(*) from run_tracks) || '/' || (select count(*) from run_consents) || '/' || (select string_agg(id || runs_mode, ',' order by id) from students)";
  var declared = verifySql.match(/«J-B concluído \(nada foi gravado\): (\d+) ok, 0 falhas»/);
  [["h_new", null, "como superutilizador"], ["h_owner", "sbadmin", "como dono sem superutilizador (o mais perto do SQL Editor do Supabase)"]].forEach(function(c){
    var who = c[1] ? ["-U", c[1]] : [];
    var before = psql(c[0], who.concat(["-c", snapQ])).stdout.trim();
    var jb = psql(c[0], who.concat(["-v", "ON_ERROR_STOP=1", "-f", path.join(sqlDir, "jb.sql")]));
    var jbOut = String(jb.stderr) + String(jb.stdout);
    var after = psql(c[0], who.concat(["-c", snapQ])).stdout.trim();
    var m = /J-B concluído \(nada foi gravado\): (\d+) ok, (\d+) falhas/.exec(jbOut);
    check.check("19. A simulação J-B de verify_security.sql corre num Postgres real " + c[2] + " e passa todas as verificações" + (m ? " (" + m[1] + " ok, " + m[2] + " falhas)" : " — sem resultado: " + jbOut.slice(0, 300)) + (/FALHOU/.test(jbOut) ? " — " + jbOut.split("\n").filter(function(l){ return /FALHOU/.test(l); }).join(" | ") : ""), !!m && m[2] === "0" && num(m[1]) >= 30 && !/FALHOU/.test(jbOut));
    check.check("19. … o número de verificações anunciado no script é o que a simulação faz, e não deixou nada gravado (corridas, percursos, consentimentos e modos iguais antes e depois: terminou com erro de propósito)", !!m && !!declared && declared[1] === m[1] && before === after && jb.status !== 0 && before.length > 0);
  });
} finally {
  spawned.forEach(function(c){ try { c.kill(); } catch (e) {} });
  stopServer();
  cp.spawnSync("rm", ["-rf", tmp]);
}
check.summarize();
