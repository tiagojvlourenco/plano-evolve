// Hora da pesagem na composição corporal e fotos de progresso carregadas pelo profissional.
require("./setup")();
var fs = require("fs");
var path = require("path");
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function assess(over){ return Object.assign({date:"2026-09-01", weight:69, bodyFat:30, muscle:26, visceral:8, water:49}, over || {}); }

// ---- 1. Hora no formulário ----
(function(){
  var f = tplAssessForm({});
  check.check("1. O formulário tem o campo da hora (type=time)", /<input type="time" id="asTime"/.test(f));
  check.check("1. A hora vem preenchida com a hora atual (HH:MM)", /id="asTime" value="\d{2}:\d{2}"/.test(f));
  check.check("1. A hora aparece logo a seguir à data", f.indexOf('id="asDate"') < f.indexOf('id="asTime"') && f.indexOf('id="asTime"') < f.indexOf('id="asWeight"'));
  check.check("1. nowHHMM() tem sempre 5 caracteres HH:MM", /^\d{2}:\d{2}$/.test(nowHHMM()));
})();

// ---- 2. Hora na tabela, a seguir à data ----
(function(){
  var t = tplAssessTable({assessments:[assess({time:"08:30"})]}, false);
  check.check("2. A tabela mostra a hora a seguir à data", /01\/09\s*<span class="atime">· 08:30<\/span>/.test(t));
  var sem = tplAssessTable({assessments:[assess()]}, false);
  check.check("2. Avaliações antigas (sem hora) continuam a aparecer só com a data", sem.indexOf("atime") === -1 && sem.indexOf("01/09") >= 0);
  var xss = tplAssessTable({assessments:[assess({time:"<b>x</b>"})]}, false);
  check.check("2. A hora é escapada", xss.indexOf("<b>x</b>") === -1 && xss.indexOf("&lt;b&gt;") >= 0);
})();

// ---- 3. Ordem: mais recentes primeiro, e no mesmo dia pela hora ----
(function(){
  var list = [assess({time:"08:00", weight:70}), assess({time:"19:30", weight:71}), assess({date:"2026-09-02", weight:72}), assess({weight:73})];
  var sorted = list.slice().sort(compareAssessmentsDesc).map(function(a){ return a.weight; });
  check.check("3. Dia mais recente primeiro", sorted[0] === 72);
  check.check("3. No mesmo dia, a hora mais tarde primeiro", sorted[1] === 71 && sorted[2] === 70);
  check.check("3. Sem hora conta como início do dia (fica depois das que têm hora)", sorted[3] === 73);
  check.check("3. Tabela, indicadores e apagar usam todos a mesma ordenação (nenhuma antiga sobra)", html.indexOf("a.date<b.date?1:-1") === -1 && (html.match(/\.sort\(compareAssessmentsDesc\)/g) || []).length === 3);
})();

// ---- 4. A hora é guardada ----
(function(){
  check.check("4. O botão Adicionar lê #asTime e valida o formato HH:MM", /querySelector\("#asTime"\)/.test(appSource) && /\\d\{2\}:\\d\{2\}/.test(appSource));
  check.check("4. Só guarda 'time' quando existe", /if \(time\) entry\.time = time;/.test(appSource));
})();

// ---- 5. Fotos de progresso carregadas pelo profissional ----
(function(){
  var pro = tplPhotosSection({photos:[], allowPhotos:false}, {editable:true});
  check.check("5. O profissional tem 3 botões de upload (frente, lado, costas)", (pro.match(/class="pro-photo-upload-input"/g) || []).length === 3);
  check.check("5. As posições são as 3 fixas", /data-position="frente"/.test(pro) && /data-position="lado"/.test(pro) && /data-position="costas"/.test(pro));
  check.check("5. O upload do profissional está disponível mesmo com 'permitir ao aluno' desligado", pro.indexOf("pro-photo-upload-input") >= 0);
  var aluno = tplPhotosSection({photos:[], allowPhotos:true}, {editable:false});
  check.check("5. A vista do aluno não ganhou os botões do profissional", aluno.indexOf("pro-photo-upload-input") === -1 && aluno.indexOf("photo-upload-input") >= 0);
  check.check("5. O profissional liga os botões ao upload (wireProTab)", /\.pro-photo-upload-input"\)\.forEach/.test(appSource) && /uploadProgressPhotoAsPro\(s, file, position/.test(appSource));
})();

// ---- 5b. Os botões de carregar ficheiro têm aspeto de botão (a classe .btn-file nunca teve estilo) ----
(function(){
  var m = html.match(/\.btn-file\{([^}]*)\}/);
  check.check("5b. Existe uma regra .btn-file", !!m);
  check.check("5b. Tem cursor de clique e borda (parece um botão)", m && /cursor:pointer/.test(m[1]) && /border:1px solid/.test(m[1]));
  check.check("5b. Tem altura mínima de 44px para o toque no telemóvel", m && /min-height:44px/.test(m[1]));
  check.check("5b. Mostra foco quando o input escondido recebe foco", /\.btn-file:focus-within\{/.test(html));
})();

// ---- 6. authUserId: lido, nunca escrito de volta ----
(function(){
  var s = rowToStudent({id:"t1", name:"Teste", auth_user_id:"uid-123", meals:[], checkins:[], weights:[], assessments:[], photos:[]});
  check.check("6. rowToStudent lê o auth_user_id do aluno", s.authUserId === "uid-123");
  check.check("6. Sem conta ativada fica null", rowToStudent({id:"t2", name:"Teste", meals:[], checkins:[], weights:[], assessments:[], photos:[]}).authUserId === null);
  var row = studentToRow(s);
  check.check("6. studentToRow NUNCA envia auth_user_id (o trigger de segurança não o deixa mudar)", !("auth_user_id" in row) && JSON.stringify(row).indexOf("uid-123") === -1);
})();

// ---- 7. uploadProgressPhotoAsPro ----
var originalSb = sb, originalReady = sbReady, realToast = showToast, realResize = resizeImageFile;
var tests = [];

function fakeSb(calls){
  var chain = { eq: function(){ return chain; }, update: function(){ return chain; }, insert: function(){ return chain; },
    then: function(ok, ko){ return Promise.resolve({data:null, error:null}).then(ok, ko); } };
  return {
    from: function(){ return chain; },
    storage: { from: function(bucket){ return {
      upload: function(p, blob, opts){ calls.push({op:"upload", bucket:bucket, path:p}); return Promise.resolve({error:null}); },
      createSignedUrl: function(p){ calls.push({op:"sign", path:p}); return Promise.resolve({data:{signedUrl:"https://signed/"+p}}); }
    }; } }
  };
}

tests.push(function(){
  var toasts = []; showToast = function(m){ toasts.push(m); };
  var calls = []; sbReady = true; sb = fakeSb(calls);
  var s = {id:"t1", photos:[], authUserId:null};
  return uploadProgressPhotoAsPro(s, {name:"x.jpg"}, "frente").then(function(ok){
    check.check("7. Sem conta do aluno ativada: não carrega e avisa", ok === false && s.photos.length === 0 && calls.length === 0);
    check.check("7. O aviso explica porquê", toasts.some(function(m){ return /ainda não ativou a conta/.test(m); }));
  });
});

tests.push(function(){
  var toasts = []; showToast = function(m){ toasts.push(m); };
  var calls = []; sbReady = true; sb = fakeSb(calls);
  resizeImageFile = function(){ return Promise.resolve({blob:true}); };
  var s = {id:"t1", photos:[], authUserId:"uid-aluno", name:"T"};
  var done = 0;
  return uploadProgressPhotoAsPro(s, {name:"x.jpg"}, "lado", function(){ done++; }).then(function(ok){
    var up = calls.filter(function(c){ return c.op === "upload"; })[0];
    check.check("7. Com conta ativada, carrega para o bucket privado de fotos de progresso", ok === true && up && up.bucket === "progress-photos");
    check.check("7. O ficheiro vai para a pasta do ALUNO (para ele o conseguir ler)", up && up.path.indexOf("uid-aluno/") === 0 && /\.jpg$/.test(up.path));
    check.check("7. A foto fica registada com a posição e marcada como do profissional", s.photos.length === 1 && s.photos[0].position === "lado" && s.photos[0].by === "profissional" && s.photos[0].path === up.path);
    check.check("7. Guarda só o caminho (nunca um URL fixo) e traz o URL assinado para mostrar já", s.photos[0]._resolvedUrl === "https://signed/" + up.path && !("url" in s.photos[0]));
    check.check("7. Atualiza o ecrã depois de carregar", done === 1);
  });
});

tests.reduce(function(chain, t){ return chain.then(t); }, Promise.resolve()).then(function(){
  sb = originalSb; sbReady = originalReady; showToast = realToast; resizeImageFile = realResize;
  check.summarize();
}, function(e){ console.log("FAIL: exceção inesperada", e); process.exit(1); });
