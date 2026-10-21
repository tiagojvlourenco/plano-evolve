// O peso é só do profissional: o aluno não escreve weights nem weight_current (migração 0031), o profissional escreve tudo.
// Parte 1: lê as migrações. Parte 2: cliente (a fila de gravação do aluno nunca leva o peso). Parte 3: gatilho num Postgres REAL, local e
// descartável (tests/db/weight-permissions.sql, com auth.uid() simulado). Se não houver servidor Postgres na máquina a parte 3 é saltada
// e diz-se: NÃO substitui a validação no projeto Supabase real (ver supabase/verify_security.sql, bloco I).
var fs = require("fs");
var path = require("path");
var cp = require("child_process");
var os = require("os");
require("./setup")();
eval(require("./extract-app")());
var check = require("./check")();
var root = path.join(__dirname, "..");
var mig = path.join(root, "supabase", "migrations");

// ---- 1. migrações ----
function allowedOf(file){ return fs.readFileSync(path.join(mig, file), "utf8").match(/allowed_keys text\[\] := array\[([\s\S]*?)\]/)[1].match(/'[a-z_]+'/g).map(function(x){ return x.slice(1, -1); }); }
var m19 = allowedOf("0019_training_program.sql"), m31 = allowedOf("0031_weight_professional_only.sql");
check.check("1. A 0019 (já aplicada) não foi editada: continua com weights e weight_current", m19.indexOf("weights") >= 0 && m19.indexOf("weight_current") >= 0);
check.check("1. A 0031 tira só weights e weight_current da lista do aluno", m19.filter(function(k){ return m31.indexOf(k) < 0; }).sort().join() === "weight_current,weights" && m31.every(function(k){ return m19.indexOf(k) >= 0; }));
check.check("1. …e mantém as colunas legítimas do aluno", ["meal_daily_state", "meals_date", "checkins", "substitution_history", "adaptation_history", "photos", "workout_logs", "updated_at"].every(function(k){ return m31.indexOf(k) >= 0; }));
check.check("1. As avaliações nunca estiveram na lista do aluno", m19.indexOf("assessments") < 0 && m31.indexOf("assessments") < 0);
var sql31 = fs.readFileSync(path.join(mig, "0031_weight_professional_only.sql"), "utf8");
check.check("1. A 0031 não apaga nem altera dados (sem delete/update/drop table/drop column)", !/\bdelete\s+from\b|\bupdate\s+students\b|drop\s+table|drop\s+column|truncate/i.test(sql31.replace(/--.*$/gm, "")));
check.check("1. A 0031 mantém a verificação append-only e a validação das sessões da 0019", /jsonb_array_is_append_only/.test(sql31) && /workout_logs_appended_are_valid/.test(sql31) && /Só o profissional pode alterar estes dados do plano/.test(sql31));

// ---- 2. cliente ----
(function(){
  var store = {};
  global.localStorage = {getItem: function(k){ return k in store ? store[k] : null; }, setItem: function(k, v){ store[k] = String(v); }, removeItem: function(k){ delete store[k]; }};
  function colsAfter(role, mutate){
    var s = rowToStudent({id: "c1", name: "Aluno", weights: [{date: "2026-09-01", w: 80}], weight_current: 80, workout_logs: [], checkins: [], assessments: []});
    outboxMem = null; try { localStorage.removeItem("evolve_outbox"); } catch (e) {}
    sbReady = true; authRole = role;
    setSyncBaseline(s, rowBaseline(studentToRow(s)));
    mutate(s);
    persistStudents[s.id] = s; persistPrepare(s.id);
    var e = outboxRead()[s.id];
    sbReady = false;
    return e ? Object.keys(e.cols) : [];
  }
  var student = colsAfter("student", function(s){ s.weights.push({date: "2026-10-01", w: 50}); s.weightCurrent = 50; logWorkout(s, {date: "2026-10-01", entries: [{name: "Agachamento", sets: [{reps: 8, load: 50}]}]}); });
  check.check("2. Aluno: o peso alterado não entra na fila de gravação", student.indexOf("weights") < 0 && student.indexOf("weight_current") < 0);
  check.check("2. Aluno: o resto (sessão de treino) grava-se normalmente", student.indexOf("workout_logs") >= 0);
  var pro = colsAfter("professional", function(s){ s.weights.push({date: "2026-10-01", w: 79}); s.weightCurrent = 79; });
  check.check("2. Profissional: o peso grava-se", pro.indexOf("weights") >= 0 && pro.indexOf("weight_current") >= 0);
  authRole = "professional";
})();

// ---- 3. gatilho num Postgres real ----
function pgBin(){ var d = "/usr/lib/postgresql"; try { var v = fs.readdirSync(d).sort().pop(); var b = path.join(d, v, "bin"); return fs.existsSync(path.join(b, "initdb")) && fs.existsSync(path.join(b, "postgres")) ? b : null; } catch (e) { return null; } }
var bin = pgBin(), psqlOk = cp.spawnSync("psql", ["--version"]).status === 0;
if (!bin || !psqlOk){
  console.log("SALTADO: não há servidor Postgres/psql nesta máquina; o gatilho não foi exercitado (só a leitura das migrações).");
} else {
  var isRoot = process.getuid && process.getuid() === 0;
  var tmp = fs.mkdtempSync(path.join("/tmp", "evolve-pg-"));
  var run = function(cmd, args, opts){ return isRoot ? cp.spawnSync("runuser", ["-u", "postgres", "--", cmd].concat(args), opts) : cp.spawnSync(cmd, args, opts); };
  if (isRoot) cp.spawnSync("chown", ["postgres", tmp]);
  else fs.chmodSync(tmp, 0o700);
  var init = run(path.join(bin, "initdb"), ["-D", path.join(tmp, "data"), "-A", "trust"], {encoding: "utf8"});
  var start = init.status === 0 && run(path.join(bin, "pg_ctl"), ["-D", path.join(tmp, "data"), "-o", "-k " + tmp + " -c listen_addresses=''", "-w", "start", "-l", path.join(tmp, "log")], {encoding: "utf8"});
  if (!start || start.status !== 0){
    console.log("SALTADO: não foi possível arrancar um Postgres temporário (" + String((init.stderr || "") + (start && start.stderr || "")).trim().split("\n")[0] + ").");
  } else {
    try {
      // o servidor corre como outro utilizador: copia os SQL para a pasta temporária (legível por ele)
      var sqlDir = path.join(tmp, "sql"); fs.mkdirSync(sqlDir);
      ["0006_append_only_history.sql", "0019_training_program.sql", "0031_weight_professional_only.sql"].forEach(function(f){ fs.copyFileSync(path.join(mig, f), path.join(sqlDir, f)); });
      fs.copyFileSync(path.join(__dirname, "db", "weight-permissions.sql"), path.join(sqlDir, "harness.sql"));
      cp.spawnSync("chmod", ["-R", "a+rX", tmp]);
      var out = run("psql", ["-h", tmp, "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-v", "migrations=" + sqlDir, "-q", "-t", "-A", "-f", path.join(sqlDir, "harness.sql")], {encoding: "utf8"});
      var r = {};
      String(out.stdout).split("\n").filter(function(l){ return /^RES\|/.test(l); }).forEach(function(l){ var p = l.split("|"); r[p[1] + "|" + p[2]] = p.slice(3).join("|"); });
      var ok = function(k){ return /^ok [1-9]/.test(r[k] || ""); }, refused = function(k){ return /^erro: Só o profissional pode alterar/.test(r[k] || ""); };
      check.check("3. O harness correu até ao fim", out.status === 0 && Object.keys(r).length === 26);
      check.check("3. ANTES da 0031 o aluno conseguia escrever weights e weight_current (o problema era real)", ok("antes|aluno escreve weights") && ok("antes|aluno escreve weight_current"));
      check.check("3. DEPOIS da 0031 o aluno não escreve weights", refused("depois|aluno escreve weights"));
      check.check("3. DEPOIS da 0031 o aluno não escreve weight_current", refused("depois|aluno escreve weight_current"));
      check.check("3. O aluno continua sem escrever assessments nem weight_initial", refused("depois|aluno escreve assessments") && refused("depois|aluno escreve weight_initial"));
      check.check("3. O aluno continua a registar o dia, check-ins, adaptações e sessões de treino", ok("depois|aluno regista meal_daily_state") && ok("depois|aluno escreve checkins") && ok("depois|aluno acrescenta adaptation_history") && ok("depois|aluno acrescenta workout_logs"));
      check.check("3. Um pedido do aluno que repete o peso atual (sem o alterar) continua a passar", ok("depois|aluno repete weights iguais"));
      check.check("3. O histórico de sessões continua só a acrescentar", /^erro: Não é permitido alterar ou remover sessões/.test(r["depois|aluno apaga workout_logs"] || ""));
      check.check("3. O aluno não toca na linha de outro aluno", /^ok 0/.test(r["depois|aluno escreve na linha de outro"] || ""));
      check.check("3. O profissional continua a escrever e a apagar pesagens e avaliações", ok("depois|profissional escreve weights + weight_current + assessments") && ok("depois|profissional apaga uma pesagem"));
      var d1 = String(out.stdout).split("\n").filter(function(l){ return /^DADOS\|s1\|/.test(l); })[0] || "";
      check.check("3. Os dados existentes ficaram intactos (só mudaram as escritas do profissional)", /"w": 80, "date": "2026-09-01"/.test(d1) && !/"w": 50/.test(d1));
      check.check("3. A migração pode correr duas vezes", out.status === 0);
    } finally {
      run(path.join(bin, "pg_ctl"), ["-D", path.join(tmp, "data"), "-m", "immediate", "stop"], {encoding: "utf8"});
      cp.spawnSync("rm", ["-rf", tmp]);
    }
  }
}
check.summarize();
