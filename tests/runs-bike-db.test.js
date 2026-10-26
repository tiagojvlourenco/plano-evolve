// Migração 0033 (bicicleta) num Postgres real e descartável: corre a seguir à 0032, duas vezes, com corridas já guardadas; os limites de velocidade por atividade.
// Se não houver Postgres nesta máquina, é saltado e diz-se. Não é o Supabase real (sem políticas nem auth verdadeiros): só as restrições da tabela.
var fs = require("fs"), path = require("path"), cp = require("child_process");
var check = require("./check")();
var mig = path.join(__dirname, "..", "supabase", "migrations");
function pgBin(){ var d = "/usr/lib/postgresql"; try { var v = fs.readdirSync(d).sort(function(a, b){ return parseInt(a, 10) - parseInt(b, 10); }).pop(); var b = path.join(d, v, "bin"); return fs.existsSync(path.join(b, "initdb")) ? b : null; } catch (e) { return null; } }
var bin = pgBin();
if (!bin || cp.spawnSync("psql", ["--version"]).status !== 0){ console.log("SALTADO: não há Postgres/psql nesta máquina; a 0033 não foi exercitada."); check.summarize(); }
var isRoot = process.getuid && process.getuid() === 0, tmp = fs.mkdtempSync("/tmp/evolve-pg-bike-");
function run(cmd, args, opts){ return isRoot ? cp.spawnSync("runuser", ["-u", "postgres", "--", cmd].concat(args), opts) : cp.spawnSync(cmd, args, opts); }
if (isRoot) cp.spawnSync("chown", ["postgres", tmp]); else fs.chmodSync(tmp, 448);
var started = false;
function finish(){ if (started) run(path.join(bin, "pg_ctl"), ["-D", path.join(tmp, "data"), "-m", "immediate", "stop"], {encoding: "utf8"}); cp.spawnSync("rm", ["-rf", tmp]); check.summarize(); }
var init = run(path.join(bin, "initdb"), ["-D", path.join(tmp, "data"), "-A", "trust", "-E", "UTF8", "--no-locale"], {encoding: "utf8"});
var start = init.status === 0 && run(path.join(bin, "pg_ctl"), ["-D", path.join(tmp, "data"), "-o", "-k " + tmp + " -c listen_addresses='' -c fsync=off", "-w", "start", "-l", path.join(tmp, "log")], {encoding: "utf8"});
if (!start || start.status !== 0){ console.log("SALTADO: não arrancou um Postgres temporário."); finish(); }
started = true;
function psql(args){ return run("psql", ["-h", tmp, "-d", "bike", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1"].concat(args), {encoding: "utf8"}); }
function sql(t){ var o = psql(["-c", t]); return {out: String(o.stdout).trim(), err: String(o.stderr).trim(), status: o.status}; }
try {
  var sqlDir = path.join(tmp, "sql"); fs.mkdirSync(sqlDir);
  ["0032_corrida.sql", "0033_corrida_bike.sql"].forEach(function(f){ fs.copyFileSync(path.join(mig, f), path.join(sqlDir, f)); });
  cp.spawnSync("chmod", ["-R", "a+rX", tmp]);
  run("psql", ["-h", tmp, "-d", "postgres", "-q", "-c", "create database bike encoding 'UTF8' template template0"], {encoding: "utf8"});
  sql("create schema auth; create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$; create table professionals (user_id uuid primary key); create table students (id text primary key, auth_user_id uuid, name text not null); insert into students values ('s1', null, 'Um')");
  run("psql", ["-h", tmp, "-d", "postgres", "-q", "-c", "create role anon nologin; create role authenticated nologin"], {encoding: "utf8"});
  var a = psql(["-1", "-f", path.join(sqlDir, "0032_corrida.sql")]);
  sql("insert into run_consents (student_id, version) values ('s1', 1)");
  sql("insert into runs (created_by, student_id, started_at, source, duration_s, moving_s, distance_m, consent_v) values (gen_random_uuid(), 's1', now(), 'manual', 1800, 1800, 5000, 1)");
  var b = psql(["-1", "-f", path.join(sqlDir, "0033_corrida_bike.sql")]), c = psql(["-1", "-f", path.join(sqlDir, "0033_corrida_bike.sql")]);
  check.check("1. A 0033 corre a seguir à 0032, com uma corrida já guardada, e repete-se sem erro" + (b.status || c.status ? " — " + String(b.stderr || c.stderr).slice(0, 200) : ""), a.status === 0 && b.status === 0 && c.status === 0);
  check.check("2. A corrida que já existia fica com activity = 'run'", sql("select activity from runs").out === "run");
  function ins(act, dist, dur){ return sql("insert into runs (created_by, student_id, started_at, source, duration_s, moving_s, distance_m, consent_v" + (act ? ", activity" : "") + ") values (gen_random_uuid(), 's1', now(), 'manual', " + dur + ", " + dur + ", " + dist + ", 1" + (act ? ", '" + act + "'" : "") + ")"); }
  check.check("3. Uma corrida a 13 m/s é recusada (runs_speed_plausible), a 12 m/s passa", /runs_speed_plausible/.test(ins(null, 13000, 1000).err) && ins(null, 12000, 1000).status === 0);
  check.check("4. Uma bicicleta a 20 m/s (72 km/h) passa e a 26 m/s é recusada", ins("bike", 20000, 1000).status === 0 && /runs_speed_plausible/.test(ins("bike", 26000, 1000).err));
  check.check("5. Uma atividade inválida é recusada (runs_activity_check)", /runs_activity_check/.test(ins("swim", 1000, 1000).err));
  check.check("6. A migração não mexe nas políticas nem nos privilégios", !/policy|grant|revoke/i.test(fs.readFileSync(path.join(mig, "0033_corrida_bike.sql"), "utf8").replace(/--.*$/gm, "")));
} catch (e) { check.check("erro inesperado: " + e.message, false); }
finish();
