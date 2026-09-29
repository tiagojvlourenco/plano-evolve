// Fase 11 — melhorias reportadas pelo profissional após uso real.
const fs = require("fs");
const path = require("path");
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

function freshStudent(overrides){
  var base = {
    id:"x", name:"Teste Aluno", flexibility:50, flexOverrides:{}, blockedFoods:[],
    substitutionHistory:[], adaptationHistory:[], photos:[], weightLogPhotos:[],
    likes:[], dislikes:[], avoid:[], allergies:[],
    targets:{kcal:2000, protein:150, carbs:200, fat:60},
    meals:[]
  };
  Object.keys(overrides || {}).forEach(function(k){ base[k] = overrides[k]; });
  return base;
}

// ---- 1. Separador Flexibilidade removido; Personalizar movido para o Perfil ----

// 1. PRO_TABS já não inclui "flex"
(function(){
  check.check("1. PRO_TABS não tem a entrada 'flex'", !PRO_TABS.some(function(t){ return t[0] === "flex"; }));
})();

// 2. tplProFlex, presetBtn, logFlexChange e logFlexibilityChange deixaram de existir
(function(){
  check.check("2. tplProFlex removida", typeof tplProFlex === "undefined");
  check.check("2. presetBtn removida", typeof presetBtn === "undefined");
  check.check("2. logFlexChange removida", typeof logFlexChange === "undefined");
  check.check("2. logFlexibilityChange removida", typeof logFlexibilityChange === "undefined");
})();

// 3. Personalizar (checkboxes de override) vive agora dentro do Perfil
(function(){
  var s = freshStudent();
  var html = tplProPerfil(s);
  check.check("3. Perfil mostra a secção Personalizar", html.indexOf("Personalizar comportamento do plano") >= 0);
  FLEX_OVERRIDE_CHECKBOXES.forEach(function(pair){
    check.check("3. Checkbox '" + pair[0] + "' presente com data-key", html.indexOf("data-key=\"" + pair[0] + "\"") >= 0);
  });
})();

// 4. O estado do checkbox reflete computeFlexibilityProfile (default do tier quando não há override explícito)
(function(){
  var s = freshStudent({flexOverrides:{mealBuilderEnabled:false}});
  var html = tplProPerfil(s);
  var idx = html.indexOf("data-key=\"mealBuilderEnabled\"");
  var tagStart = html.lastIndexOf("<input", idx);
  var tagEnd = html.indexOf(">", idx);
  var tag = html.slice(tagStart, tagEnd);
  check.check("4. Override explícito (false) não aparece 'checked'", tag.indexOf("checked") === -1);
})();

// 5. wireProTab já não tem wiring de #flexSlider / .preset-btn (código morto removido)
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function wireProTab"), appSource.indexOf("function wireProTab") + 30000);
  check.check("5. Sem referência a flexSlider no wiring", fnSrc.indexOf("flexSlider") === -1);
  check.check("5. Sem referência a preset-btn no wiring", fnSrc.indexOf("preset-btn") === -1);
  check.check("5. Continua a ligar os checkboxes [data-key] (Personalizar)", fnSrc.indexOf("[data-key]") >= 0);
})();

// ---- 2. Dados médicos no Perfil ----

// 6. Secção "Dados médicos" existe, com os 4 campos e botão de guardar
(function(){
  var s = freshStudent({medicalConditions:"Hipertensão", currentMedication:"Losartan 50mg", physicalLimitations:"Hérnia discal L4-L5", medicalNotes:"Evitar exercícios de alto impacto"});
  var html = tplProPerfil(s);
  check.check("6. Secção Dados médicos presente", html.indexOf("Dados médicos") >= 0);
  check.check("6. Mostra condições médicas guardadas", html.indexOf("Hipertensão") >= 0);
  check.check("6. Mostra medicação atual guardada", html.indexOf("Losartan 50mg") >= 0);
  check.check("6. Mostra limitações físicas guardadas", html.indexOf("Hérnia discal L4-L5") >= 0);
  check.check("6. Mostra observações guardadas", html.indexOf("Evitar exercícios de alto impacto") >= 0);
  check.check("6. Tem o botão Guardar dados médicos", html.indexOf("id=\"saveMedical\"") >= 0 || html.indexOf("id=\\\"saveMedical\\\"") >= 0);
})();

// 7. wireProTab liga o botão saveMedical aos 4 campos corretos
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function wireProTab"), appSource.indexOf("function wireProTab") + 30000);
  check.check("7. Liga saveMedical", fnSrc.indexOf("saveMedical") >= 0);
  ["medConditions","medCurrent","medLimitations","medNotes"].forEach(function(id){
    check.check("7. Lê o campo " + id, fnSrc.indexOf(id) >= 0);
  });
  check.check("7. Atribui a s.medicalConditions", fnSrc.indexOf("s.medicalConditions") >= 0);
  check.check("7. Atribui a s.currentMedication", fnSrc.indexOf("s.currentMedication") >= 0);
  check.check("7. Atribui a s.physicalLimitations", fnSrc.indexOf("s.physicalLimitations") >= 0);
  check.check("7. Atribui a s.medicalNotes", fnSrc.indexOf("s.medicalNotes") >= 0);
})();

// 8. studentToRow/rowToStudent fazem round-trip dos 4 campos médicos
(function(){
  var s = freshStudent({medicalConditions:"Asma", currentMedication:"Ventolin", physicalLimitations:"—", medicalNotes:"Nota livre"});
  var row = studentToRow(s);
  check.check("8. studentToRow mapeia medical_conditions", row.medical_conditions === "Asma");
  check.check("8. studentToRow mapeia current_medication", row.current_medication === "Ventolin");
  check.check("8. studentToRow mapeia physical_limitations", row.physical_limitations === "—");
  check.check("8. studentToRow mapeia medical_notes", row.medical_notes === "Nota livre");
  var back = rowToStudent(row);
  check.check("8. rowToStudent recupera medicalConditions", back.medicalConditions === "Asma");
  check.check("8. rowToStudent recupera currentMedication", back.currentMedication === "Ventolin");
  check.check("8. rowToStudent recupera physicalLimitations", back.physicalLimitations === "—");
  check.check("8. rowToStudent recupera medicalNotes", back.medicalNotes === "Nota livre");

  var empty = freshStudent();
  var emptyRow = studentToRow(empty);
  check.check("8. Sem dados médicos, grava null (não undefined nem string vazia)", emptyRow.medical_conditions === null && emptyRow.current_medication === null);
  var fromEmptyDbRow = rowToStudent({id:"y"});
  check.check("8. Linha da BD sem estas colunas não rebenta rowToStudent", fromEmptyDbRow.medicalConditions === null);
})();

// 9. Migração 0014 acrescenta as colunas médicas e não altera a allowlist do aluno em 0004
(function(){
  var mig = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "0014_medical_data_and_weightlog_photos.sql"), "utf8");
  ["medical_conditions","current_medication","physical_limitations","medical_notes","weight_log_photos"].forEach(function(col){
    check.check("9. Migração 0014 acrescenta " + col, mig.indexOf(col) >= 0);
  });
  var trigger = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "0004_security_hardening.sql"), "utf8");
  check.check("9. allowlist do aluno em 0004 não inclui colunas médicas (permanecem só-profissional)", trigger.indexOf("medical_conditions") === -1);
})();

// ---- 3. Fotos de pesagem de referência (Evolução) ----

// 10. Secção só aparece na vista editável (profissional), nunca ao aluno
(function(){
  var s = freshStudent({weights:[{date:"2026-01-01", w:70}], weightInitial:70, weightCurrent:70, assessments:[], checkins:[], allowPhotos:false});
  var proHtml = tplEvolucaoAluno(s, {editable:true});
  var alunoHtml = tplEvolucaoAluno(s, {editable:false});
  check.check("10. Vista do profissional mostra a secção de fotos de pesagem", proHtml.indexOf("Fotos de pesagem") >= 0);
  check.check("10. Vista do aluno nunca mostra a secção de fotos de pesagem", alunoHtml.indexOf("Fotos de pesagem") === -1);
})();

// 11. Grelha vazia mostra mensagem; com fotos, mostra data e botão de remover
(function(){
  var vazio = freshStudent();
  check.check("11. Sem fotos, mostra mensagem 'ainda sem'", weightLogPhotoGridHtml(vazio).indexOf("Ainda sem") >= 0);

  var comFoto = freshStudent({weightLogPhotos:[{date:"2026-02-14", dataUrl:"data:image/jpeg;base64,xxx"}]});
  var grid = weightLogPhotoGridHtml(comFoto);
  check.check("11. Com foto, mostra a data formatada", grid.indexOf(fmtDatePt("2026-02-14")) >= 0);
  check.check("11. Com foto, tem botão de remover com data-idx", grid.indexOf("weightlog-photo-remove") >= 0 && grid.indexOf("data-idx=\"0\"") >= 0);
})();

// 12. Upload não depende de position (diferente de PHOTO_POSITIONS/photos) — é um único input, sem posições
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function tplWeightLogPhotosSection"), appSource.indexOf("function tplWeightLogPhotosSection") + 1000);
  check.check("12. Tem um único input de upload (id weightLogUpload)", fnSrc.indexOf("weightLogUpload") >= 0);
  check.check("12. Não usa PHOTO_POSITIONS (sem frente/lado/costas)", fnSrc.indexOf("PHOTO_POSITIONS") === -1);
})();

// 13. wireProTab liga o upload à pasta do profissional (não do aluno) e inclui o id do aluno no caminho
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function wireProTab"), appSource.indexOf("function wireProTab") + 30000);
  check.check("13. Liga o input weightLogUpload", fnSrc.indexOf("weightLogUpload") >= 0);
  check.check("13. Caminho de upload inclui '/weight-log/' + s.id", fnSrc.indexOf("/weight-log/\" + s.id") >= 0);
  check.check("13. Usa currentAuthUserId (pasta do profissional) como raiz", /currentAuthUserId \+ "\/weight-log\//.test(fnSrc));
  check.check("13. Faz fallback para dataUrl em modo local (sem sbReady)", fnSrc.indexOf("s.weightLogPhotos.push({date: todayISO(), dataUrl: reader.result})") >= 0);
})();

// 14. removeWeightLogPhoto apaga do Storage quando tem path, e sempre do array
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function removeWeightLogPhoto"), appSource.indexOf("function removeWeightLogPhoto") + 700);
  check.check("14. Usa o bucket progress-photos para remover", fnSrc.indexOf('"progress-photos"') >= 0);
  check.check("14. Faz splice no array weightLogPhotos", fnSrc.indexOf("s.weightLogPhotos.splice") >= 0);
})();

// 15. studentToRow/rowToStudent fazem round-trip de weightLogPhotos (via stripPhotoState, sem _resolvedUrl)
(function(){
  var s = freshStudent({weightLogPhotos:[{date:"2026-02-14", path:"pro-id/weight-log/x/123.jpg", _resolvedUrl:"https://signed.example/x"}]});
  var row = studentToRow(s);
  check.check("15. studentToRow mapeia weight_log_photos", row.weight_log_photos.length === 1 && row.weight_log_photos[0].path === "pro-id/weight-log/x/123.jpg");
  check.check("15. studentToRow nunca grava _resolvedUrl (é sempre recalculado)", row.weight_log_photos[0]._resolvedUrl === undefined);
  var back = rowToStudent(row);
  check.check("15. rowToStudent recupera weightLogPhotos", back.weightLogPhotos.length === 1 && back.weightLogPhotos[0].date === "2026-02-14");
  var semColuna = rowToStudent({id:"y"});
  check.check("15. Linha sem a coluna dá array vazio, não undefined", Array.isArray(semColuna.weightLogPhotos) && semColuna.weightLogPhotos.length === 0);
})();

// 16. resolvePhotoUrls (fora de modo local) também resolve weightLogPhotos, não só photos
(function(){
  var fnSrc = appSource.slice(appSource.indexOf("function resolvePhotoUrls"), appSource.indexOf("function resolvePhotoUrls") + 700);
  check.check("16. Junta photos e weightLogPhotos antes de resolver URLs assinados", fnSrc.indexOf("s.weightLogPhotos") >= 0);
})();

check.summarize();
