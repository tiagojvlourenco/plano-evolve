// Segunda ronda da revisão adversarial: regressões das correções e defesas que faltavam.
require("./setup")();
var fs = require("fs");
var path = require("path");
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
function daysAgo(n){ return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10); }
var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

// ---- 1. O que se grava de volta é o original (a normalização é só para mostrar) ----
(function(){
  var longDay = "Treino A — " + new Array(90).join("x");            // > 80 caracteres
  var longName = new Array(131).join("y");                          // > 120 caracteres
  var storedLogs = [{id:"w1", date:"2026-10-01", dayId:"d1", dayName:longDay, rpe:7, notes:"", entries:[{exerciseId:"e1", name:longName, sets:[{reps:8, load:50}, {reps:0.4, load:10}]}]}];
  var storedCheckins = [{date:"2026-10-01", weight:60, hunger:5, energy:5, adherence:8, workouts:2, mealsOff:0, notes:new Array(2500).join("n")}];
  var s = rowToStudent({id:"x", name:"T", meals:[], weights:[], assessments:[], photos:[], workout_logs:storedLogs, checkins:storedCheckins});
  authRole = "student";
  var row = studentToRow(s);
  authRole = null;
  check.check("1. workout_logs gravado de volta é IGUAL ao da base de dados (nome longo, reps 0,4), por isso o 'só acrescentar' do servidor não rejeita", JSON.stringify(row.workout_logs) === JSON.stringify(storedLogs));
  check.check("1. checkins gravados de volta mantêm as notas longas (sem cortar a 2000)", row.checkins[0].notes.length === 2499);
  check.check("1. A cópia para mostrar continua limitada (nome a 80/120)", s.workoutLogs[0].dayName.length === 80 && s.workoutLogs[0].entries[0].name.length === 120);
  var log = logWorkout(s, {date:"2026-10-02", dayId:"d1", dayName:longDay, rpe:"8", notes:"ok", entries:[{exerciseId:"e1", name:longName, sets:[{reps:"8", load:"50"}, {reps:0.4, load:10}, {reps:12.6, load:0}]}]});
  check.check("1. Uma sessão nova já nasce dentro dos limites (80/120) e sem séries de 0,4 repetições", log.dayName.length === 80 && log.entries[0].name.length === 120 && log.entries[0].sets.length === 2 && log.entries[0].sets[1].reps === 13);
  check.check("1. E é ponto fixo da normalização (gravar → ler → gravar dá o mesmo)", JSON.stringify(normalizeWorkoutLogs([log])[0]) === JSON.stringify(log));
  authRole = "student";
  var after = studentToRow(s).workout_logs;
  authRole = null;
  check.check("1. O envio do aluno = originais + sessão nova (2 elementos), na ordem", after.length === 2 && after[1].id === log.id && JSON.stringify(after[0]) === JSON.stringify(storedLogs[0]));
  pushCheckin(s, {date:"2026-10-03", weight:61});
  authRole = "student"; var ci = studentToRow(s).checkins; authRole = null;
  check.check("1. pushCheckin acrescenta à cópia para mostrar e à original", s.checkins.length === 2 && ci.length === 2 && ci[1].weight === 61);
  var local = {id:"loc", workoutLogs:[{id:"a"}], checkins:[{date:"2026-01-01"}], meals:[], weights:[], assessments:[], photos:[], weightLogPhotos:[], targets:{}};
  check.check("1. Sem cópia original (modo local/demo) usa as listas normais", workoutLogsForWrite(local) === local.workoutLogs && checkinsForWrite(local) === local.checkins);
})();

// ---- 2. Profissional a registar treino (pré-visualização): junta à lista do servidor, não envia a sua cópia ----
(function(){
  var writes = [], serverLogs = [{id:"serverA", date:"2026-10-01", entries:[]}, {id:"serverB", date:"2026-10-02", entries:[]}];
  function builder(table){
    var b = {_op:"select", _payload:null};
    ["select","eq","single"].forEach(function(m){ b[m] = function(){ return b; }; });
    b.update = function(p){ b._op = "update"; b._payload = p; return b; };
    b.then = function(ok, ko){
      if (b._op === "update"){ writes.push(b._payload); serverLogs = b._payload.workout_logs; return Promise.resolve({error:null}).then(ok, ko); }
      return Promise.resolve({data:{workout_logs: serverLogs}, error:null}).then(ok, ko);
    };
    return b;
  }
  var realSb = sb, realReady = sbReady;
  sb = {from: builder}; sbReady = true;
  var s = {id:"x", workoutLogs:[{id:"mine"}], workoutLogsRaw:[{id:"stale"}]};
  var log = {id:"new1", date:"2026-10-03", entries:[]};
  return appendWorkoutLogAsPro(s, log).then(function(ok){
    check.check("2. Lê a lista atual do servidor e acrescenta só a sessão nova (não a cópia antiga do profissional)", ok === true && writes.length === 1 && writes[0].workout_logs.map(function(l){ return l.id; }).join() === "serverA,serverB,new1");
    check.check("2. A escrita só leva workout_logs (nunca o resto da linha)", Object.keys(writes[0]).join() === "workout_logs");
    check.check("2. A cópia local passa a ser a lista junta", s.workoutLogsRaw.length === 3);
    return appendWorkoutLogAsPro(s, log);
  }).then(function(){
    check.check("2. Repetir o mesmo envio não duplica a sessão (id já existe)", serverLogs.length === 3);
    check.check("2. O profissional só mostra 'guardado' depois de a escrita acabar", /appendWorkoutLogAsPro\(s, log\)\.then\(function\(\)\{ showToast\("✓ Treino guardado"\)/.test(appSource));
    sb = realSb; sbReady = realReady;
  });
})().then(function(){

// ---- 3. Colunas que o aluno escreve: tipos garantidos, nunca rebentam o login ----
var evil = '<img src=x onerror=alert(1)>';
(function(){
  var s = rowToStudent({id:"x", name:"T", meals:[], assessments:[], checkins:[], workout_logs:[],
    photos:{a:1}, weight_log_photos:"x", weights:[null, {date:"2026-01-01", w:"70.5"}, {date:evil, w:1}, {date:"2026-01-02", w:evil}],
    substitution_history:[null, 3, {type:"x"}], adaptation_history:"nope", meal_daily_state:[1,2]});
  check.check("3. photos/weightLogPhotos que não são listas viram []", Array.isArray(s.photos) && s.photos.length === 0 && s.weightLogPhotos.length === 0);
  check.check("3. weights: só entradas com data ISO e peso numérico (70,5 passa a número)", s.weights.length === 1 && s.weights[0].w === 70.5);
  check.check("3. Históricos: só objetos; formas erradas viram []", s.substitutionHistory.length === 1 && s.adaptationHistory.length === 0);
  check.check("3. meal_daily_state que não é objeto é ignorado", !Array.isArray(s.mealDailyState));
  var realSb = sb, realReady = sbReady;
  sbReady = true; sb = {storage:{from:function(){ return {createSignedUrl:function(){ return Promise.resolve({data:{signedUrl:"https://s/x"}}); }}; }}};
  var threw = false;
  try { resolvePhotoUrls([{photos:{}, weightLogPhotos:null}, {photos:[null, {path:5}, {path:"ok.jpg"}], weightLogPhotos:"x"}, {photos:"z"}]); } catch (e) { threw = true; }
  check.check("3. resolvePhotoUrls aguenta fotos mal formadas sem deitar abaixo o login do profissional", threw === false);
  sb = realSb; sbReady = realReady;
  check.check("3. photoUrl só devolve https/http/blob/data:image (nunca javascript:, nem aspas para sair do atributo)", photoUrl({url:'x" onerror="1'}) === "" && photoUrl({dataUrl:"javascript:1"}) === "" && photoUrl({url:"https://a/b.jpg?x=1&y=2"}) === "https://a/b.jpg?x=1&y=2");
  var grid = photoGridHtml({photos:[{date:"2026-10-01", url:"https://a/b.jpg?x=1&y=\"2"}], allowPhotos:true});
  check.check("3. O URL da foto entra escapado no atributo src", grid.indexOf('src="https://a/b.jpg?x=1&amp;y=&quot;2"') >= 0);
})();

// ---- 4. Rede de segurança de HTML ----
(function(){
  check.check("4. innerHTML/outerHTML passam por sanitizeHtmlString (instalado no arranque, só em browsers)", /Object\.defineProperty\(Element\.prototype, "innerHTML"/.test(appSource) && /Object\.defineProperty\(Element\.prototype, "outerHTML"/.test(appSource));
  check.check("4. Remove on*, javascript:, <script>/<iframe>... e data: que não seja imagem", /name\.indexOf\("on"\) === 0/.test(appSource) && /UNSAFE_TAGS = \{SCRIPT:1, IFRAME:1/.test(appSource) && /\^\(javascript\|vbscript\):/.test(appSource) && /data:image\\\/\(png\|jpe\?g\|gif\|webp\|avif\)/.test(appSource));
  check.check("4. Sem DOM utilizável nunca devolve markup por sanitizar (fallback: tira as tags)", sanitizeHtmlString('<b onclick="x">olá</b>') === "olá");
  check.check("4. Texto sem '<' passa intacto", sanitizeHtmlString("a & b") === "a & b" && sanitizeHtmlString(42) === 42);
  check.check("4. A app não usa handlers inline (a rede de segurança não parte nada legítimo)", !/on(click|change|input|error|load|submit)=/.test(html.replace(/"use strict";[\s\S]{0,6000}?installHtmlGuard/, "")));
})();

// ---- 5. Piso calórico: gerador e aviso usam a mesma definição ----
(function(){
  var bad = 0, n = 0, seed = 12345;
  function rnd(){ seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  for (var i = 0; i < 4000; i++){
    var sex = rnd() < 0.5 ? "Feminino" : "Masculino";
    var h = 148 + Math.round(rnd() * 45), bmi = 18.5 + rnd() * 18, w = Math.round(bmi * Math.pow(h / 100, 2) * 10) / 10;
    var p = {sex:sex, weight:w, height:h, age:18 + Math.round(rnd() * 55), trainingsPerWeek:Math.round(rnd() * 6), goal:"Perda de peso"};
    if (rnd() < 0.5) p.weightGoal = Math.round((w - 1 - rnd() * 8) * 10) / 10;
    var t = computeSuggestedTargets(p);
    var warns = nutritionSafetyWarnings({sex:sex, weightCurrent:w, height:h, age:p.age, trainingsPerWeek:p.trainingsPerWeek}, t).filter(function(x){ return /mínimo habitual|metabolismo basal/.test(x.text); });
    n++; if (warns.length) bad++;
  }
  check.check("5. 4000 perfis de perda: nenhum alvo gerado dispara o aviso de piso/basal (" + bad + " de " + n + ")", bad === 0);
  var t1 = computeSuggestedTargets({sex:"Feminino", weight:50.6, height:150, age:56, trainingsPerWeek:5, activityLevel:"Sedentário", goal:"Perda de peso"});
  check.check("5. O caso concreto da revisão (1143 vs 1144) já não contradiz", nutritionSafetyWarnings({sex:"Feminino", weightCurrent:50.6, height:150, age:56, trainingsPerWeek:5, activityLevel:"Sedentário"}, t1).length === 0 || !nutritionSafetyWarnings({sex:"Feminino", weightCurrent:50.6, height:150, age:56, trainingsPerWeek:5, activityLevel:"Sedentário"}, t1).some(function(x){ return /mínimo habitual/.test(x.text); }));
})();

// ---- 6. Progressão: nunca mistura kg com repetições ----
(function(){
  function hist(arr){ return arr.map(function(v, i){ return {date:daysAgo(60 - i * 7), score:v[0], kind:v[1]}; }); }
  check.check("6. Flexões 12 reps e depois 8 reps com 5 kg não é 'regrediu' (mudou de tipo: recomeça a série)", progressionStatus(hist([[12, "reps"], [6.3, "load"]])) === null);
  check.check("6. 60 kg × 8 e depois 8 reps sem carga (esqueceu-se do peso) não é 'regrediu' de 76 para 8", progressionStatus(hist([[76, "load"], [8, "reps"]])) === null);
  check.check("6. De peso do corpo para carga também não vira 'progrediu' por magia", progressionStatus(hist([[8, "reps"], [76, "load"]])) === null);
  check.check("6. Dentro do mesmo tipo funciona (10 → 13 reps = progrediu)", progressionStatus(hist([[10, "reps"], [11, "reps"], [13, "reps"]])) === "progrediu");
  check.check("6. Perder UMA repetição (12 → 11) não é 'regrediu'; perder 3 (12 → 9) é", progressionStatus(hist([[12, "reps"], [12, "reps"], [11, "reps"]])) !== "regrediu" && progressionStatus(hist([[12, "reps"], [12, "reps"], [9, "reps"]])) === "regrediu");
  var light = workoutEntryStats({sets:[{reps:30, load:70}]}), heavy = workoutEntryStats({sets:[{reps:8, load:100}]});
  check.check("6. Séries de 30 repetições continuam a valer menos do que uma série pesada (" + light.score + " < " + heavy.score + ")", light.score < heavy.score);
  var a = workoutEntryStats({sets:[{reps:15, load:60}]}).score, b = workoutEntryStats({sets:[{reps:20, load:60}]}).score;
  check.check("6. Com a mesma carga, mais repetições acima de 12 contam como progressão", b > a);
  var oldBest = [150, 150, 150, 150].map(function(v, i){ return {date:daysAgo(400 - i * 7), entries:[{exerciseId:"e", name:"Agachamento", sets:[{reps:1, load:v}]}]}; });
  var recent = [100, 105].map(function(v, i){ return {date:daysAgo(14 - i * 7), entries:[{exerciseId:"e", name:"Agachamento", sets:[{reps:1, load:v}]}]}; });
  check.check("6. Quem recomeça (recorde de há mais de um ano) não é 'regrediu' face a esse recorde", signalProgressaoCarga({workoutLogs: oldBest.concat(recent)}).status !== "atencao");
})();

// ---- 7. Tendência do peso: só julga com pesagens do período certo ----
(function(){
  check.check("7. 10 dias de intervalo já é pouco (mínimo 14)", signalWeight({goal:"Perda de peso", weightCurrent:81, weights:[{date:daysAgo(10), w:80}, {date:daysAgo(0), w:81}]}).status === "insuficiente");
  var old = signalWeight({goal:"Perda de peso", weightCurrent:79, weights:[{date:daysAgo(90), w:85}, {date:daysAgo(0), w:79}]});
  check.check("7. Pesagem anterior de há 90 dias: 'faltam pesagens regulares', não 'últimas 3 semanas'", old.status === "insuficiente" && /há 90 dias/.test(old.text));
  check.check("7. 16 dias e +0,25 kg em perda: dentro do ruído de uma pesagem, não alerta", signalWeight({goal:"Perda de peso", weightCurrent:80.25, weights:[{date:daysAgo(16), w:80}, {date:daysAgo(0), w:80.25}]}).status !== "atencao" || /estagnado/.test(signalWeight({goal:"Perda de peso", weightCurrent:80.25, weights:[{date:daysAgo(16), w:80}, {date:daysAgo(0), w:80.25}]}).text));
  var ok = signalWeight({goal:"Perda de peso", weightCurrent:79.2, weights:[{date:daysAgo(21), w:80.5}, {date:daysAgo(0), w:79.2}]});
  check.check("7. 21 dias, −1,3 kg: positivo, 'últimas 3 semanas'", ok.status === "positivo" && /últimas 3 semanas/.test(ok.text));
})();
check.summarize();
});
