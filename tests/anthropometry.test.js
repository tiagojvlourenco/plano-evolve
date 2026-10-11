// Perímetros do corpo e dobras cutâneas: equações (com casos de teste verificados de forma independente), validações e cartões.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
function daysAgo(n){ return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10); }
function near(a, b, tol){ return a != null && Math.abs(a - b) <= tol; }

// ---- 1. Equações: 8 casos calculados em Python por dois agentes independentes (densidade ±0,00005; Siri ±0,05) ----
(function(){
  var V = [
    ["V1 JP3 homem 30a", "jp3", "M", 30, ["chest", "abdominal", "thigh"], [10, 20, 15], 1.0676965, 13.6149],
    ["V2 JP3 mulher 28a", "jp3", "F", 28, ["triceps", "suprailiac", "thigh"], [18, 15, 25], 1.0457435, 23.3474],
    ["V3 JP7 homem 35a", "jp7", "M", 35, ["chest", "midaxillary", "triceps", "subscapular", "abdominal", "suprailiac", "thigh"], [10, 12, 11, 14, 20, 15, 15], 1.06489182, 14.836],
    ["V4 JP7 mulher 40a", "jp7", "F", 40, ["chest", "midaxillary", "triceps", "subscapular", "abdominal", "suprailiac", "thigh"], [8, 10, 20, 18, 25, 18, 30], 1.04059517, 25.6893],
    ["V5 D-W homem 25a", "dw4", "M", 25, ["biceps", "triceps", "subscapular", "suprailiac"], [6, 10, 14, 12], 1.06051064, 16.7563],
    ["V6 D-W mulher 45a", "dw4", "F", 45, ["biceps", "triceps", "subscapular", "suprailiac"], [12, 22, 20, 18], 1.01963125, 35.4696],
    ["V7 D-W homem 18a", "dw4", "M", 18, ["biceps", "triceps", "subscapular", "suprailiac"], [5, 8, 9, 7], 1.06986893, 12.6735],
    ["V8 D-W mulher 55a", "dw4", "F", 55, ["biceps", "triceps", "subscapular", "suprailiac"], [14, 24, 24, 22], 1.00978399, 40.2039]
  ];
  V.forEach(function(v){
    var sf = {}; v[4].forEach(function(k, i){ sf[k] = v[5][i]; });
    var sum = skinfoldSum(sf, skinfoldSitesOf(v[1], v[2]));
    var d = bodyDensityFromSkinfolds(v[1], v[2], v[3], sum);
    check.check("1. " + v[0] + ": densidade " + v[6].toFixed(4) + " e " + v[7].toFixed(1) + " % de gordura", near(d, v[6], 0.00005) && near(siriBodyFat(d), v[7], 0.05));
  });
  // o arredondamento da densidade a 4 casas mudaria o V2 de 23,3 para 23,4: tem de se converter a partir do valor exato
  check.check("1. Converte a partir da densidade sem arredondar (V2 → 23,3 e não 23,4)", Math.round(siriBodyFat(bodyDensityFromSkinfolds("jp3", "F", 28, 58)) * 10) / 10 === 23.3);
  // escalões de Durnin-Womersley: 17–19, 20–29, 30–39, 40–49, 50+ (aos 16 usa o primeiro)
  var ref = {M: [[16, 1.1620, 0.0630], [19, 1.1620, 0.0630], [20, 1.1631, 0.0632], [29, 1.1631, 0.0632], [30, 1.1422, 0.0544], [39, 1.1422, 0.0544], [40, 1.1620, 0.0700], [49, 1.1620, 0.0700], [50, 1.1715, 0.0779], [72, 1.1715, 0.0779]],
             F: [[16, 1.1549, 0.0678], [19, 1.1549, 0.0678], [20, 1.1599, 0.0717], [29, 1.1599, 0.0717], [30, 1.1423, 0.0632], [39, 1.1423, 0.0632], [40, 1.1333, 0.0612], [49, 1.1333, 0.0612], [50, 1.1339, 0.0645], [72, 1.1339, 0.0645]]};
  var okBands = true;
  ["M", "F"].forEach(function(sx){ ref[sx].forEach(function(r){ var d = bodyDensityFromSkinfolds("dw4", sx, r[0], 40); if (!near(d, r[1] - r[2] * Math.log10(40), 1e-12)) okBands = false; }); });
  check.check("1. Os escalões de idade de Durnin-Womersley (homens e mulheres) usam os coeficientes certos nas fronteiras", okBands);
  check.check("1. Sem soma, idade ou sexo não calcula (null)", bodyDensityFromSkinfolds("jp3", "M", 30, 0) === null && bodyDensityFromSkinfolds("jp3", null, 30, 40) === null && bodyDensityFromSkinfolds("jp3", "M", 0, 40) === null && bodyDensityFromSkinfolds("xx", "M", 30, 40) === null);
})();

// ---- 2. Escolha do protocolo e resultado ----
(function(){
  var M = {sex: "Masculino", age: 30}, F = {sex: "Feminino", age: 28};
  var all7 = {chest: 10, midaxillary: 12, triceps: 11, subscapular: 14, abdominal: 20, suprailiac: 15, thigh: 15, biceps: 6};
  check.check("2. Com as 7 dobras o automático usa JP7", skinfoldResult(M, {date: "2026-10-01", skinfolds: all7}).protocol === "jp7");
  check.check("2. Só com chest/abdominal/thigh (homem) usa JP3", skinfoldResult(M, {date: "2026-10-01", skinfolds: {chest: 10, abdominal: 20, thigh: 15}}).protocol === "jp3");
  check.check("2. As dobras do JP3 mudam com o sexo (mulher: tricipital, suprailíaca, coxa)", skinfoldResult(F, {date: "2026-10-01", skinfolds: {triceps: 18, suprailiac: 15, thigh: 25}}).protocol === "jp3" && skinfoldResult(F, {date: "2026-10-01", skinfolds: {chest: 10, abdominal: 20, thigh: 15}}).protocol === null);
  check.check("2. Só com as 4 de Durnin-Womersley usa D-W4", skinfoldResult(M, {date: "2026-10-01", skinfolds: {biceps: 6, triceps: 10, subscapular: 14, suprailiac: 12}}).protocol === "dw4");
  var wanted = skinfoldResult(M, {date: "2026-10-01", skinfolds: all7, sfProtocol: "dw4"});
  check.check("2. Um protocolo escolhido (D-W4) é respeitado quando as dobras o permitem", wanted.protocol === "dw4" && wanted.sum === 6 + 11 + 14 + 15);
  var fallback = skinfoldResult(M, {date: "2026-10-01", skinfolds: {chest: 10, abdominal: 20, thigh: 15}, sfProtocol: "jp7"});
  check.check("2. Se faltam dobras do protocolo guardado, cai para o possível (JP3)", fallback.protocol === "jp3");
  var partial = skinfoldResult(M, {date: "2026-10-01", skinfolds: {triceps: 12}});
  check.check("2. Dobras insuficientes: sem % de gordura e com explicação", partial.protocol === null && partial.bodyFat === null && partial.warnings.length === 1);
  var noSex = skinfoldResult({age: 30}, {date: "2026-10-01", skinfolds: {biceps: 6, triceps: 10, subscapular: 14, suprailiac: 12}});
  check.check("2. D-W4 é igual nos dois sexos mas o coeficiente depende do sexo: sem sexo não calcula e pede-o", noSex.bodyFat === null && /sexo/.test(noSex.warnings.join(" ")));
  var viaForm = skinfoldResult({age: 30, sex: "Outro"}, {date: "2026-10-01", skinfolds: {biceps: 6, triceps: 10, subscapular: 14, suprailiac: 12}, sfSex: "M"});
  check.check("2. Para 'Outro', o sexo escolhido no formulário (sfSex) aplica as equações", viaForm.bodyFat != null && viaForm.sexKey === "M");
  check.check("2. Dobras vazias, a zero, negativas ou texto → sem resultado", skinfoldResult(M, {date: "2026-10-01", skinfolds: {triceps: 0, biceps: -3, chest: "abc"}}) === null && skinfoldResult(M, {date: "2026-10-01"}) === null && skinfoldResult(M, {date: "2026-10-01", skinfolds: [1, 2]}) === null && skinfoldResult(M, {date: "2026-10-01", skinfolds: "x"}) === null);
  // idade: pela data de nascimento na data da avaliação; senão a idade guardada
  var byBirth = skinfoldResult({sex: "Masculino", age: 99, birthDate: "1990-06-15"}, {date: "2026-06-14", skinfolds: all7});
  check.check("2. A idade vem da data de nascimento na data da avaliação (35, não a idade guardada)", byBirth.age === 35 && skinfoldResult({sex: "Masculino", age: 41}, {date: "2026-06-14", skinfolds: all7}).age === 41);
  // validade das equações
  var young = skinfoldResult({sex: "Masculino", age: 16}, {date: "2026-10-01", skinfolds: all7, sfProtocol: "jp7"}), old = skinfoldResult({sex: "Masculino", age: 70}, {date: "2026-10-01", skinfolds: all7, sfProtocol: "jp7"});
  check.check("2. Um protocolo JP escolhido à mão fora da idade de validação (18–61) avisa mas calcula", /fora do intervalo/.test(young.warnings.join(" ")) && young.bodyFat != null && /fora do intervalo/.test(old.warnings.join(" ")));
  var autoYoung = skinfoldResult({sex: "Masculino", age: 16}, {date: "2026-10-01", skinfolds: all7}), autoOld = skinfoldResult({sex: "Masculino", age: 70}, {date: "2026-10-01", skinfolds: all7}), autoMid = skinfoldResult({sex: "Masculino", age: 35}, {date: "2026-10-01", skinfolds: all7});
  check.check("2. O automático prefere a equação validada para a idade: D-W4 aos 16 e aos 70 anos (JP7 só aos 18–61), JP7 aos 35", autoYoung.protocol === "dw4" && autoOld.protocol === "dw4" && autoMid.protocol === "jp7" && autoYoung.warnings.length === 0);
  check.check("2. Se só há dobras de um protocolo fora da idade, usa-o mesmo assim (com aviso)", skinfoldResult({sex: "Masculino", age: 66}, {date: "2026-10-01", skinfolds: {chest: 10, abdominal: 20, thigh: 15}}).protocol === "jp3" && /fora do intervalo/.test(skinfoldResult({sex: "Masculino", age: 66}, {date: "2026-10-01", skinfolds: {chest: 10, abdominal: 20, thigh: 15}}).warnings.join(" ")));
  check.check("2. D-W aceita 16 e 72 anos sem avisar", skinfoldResult({sex: "Masculino", age: 16}, {date: "2026-10-01", skinfolds: {biceps: 6, triceps: 10, subscapular: 14, suprailiac: 12}}).warnings.length === 0 && skinfoldResult({sex: "Feminino", age: 72}, {date: "2026-10-01", skinfolds: {biceps: 6, triceps: 10, subscapular: 14, suprailiac: 12}}).warnings.length === 0);
  check.check("2. Mulheres com mais de 40 anos em JP: aviso de menor fiabilidade", /a partir dos 40/.test(skinfoldResult({sex: "Feminino", age: 45}, {date: "2026-10-01", skinfolds: {triceps: 18, suprailiac: 15, thigh: 25}}).warnings.join(" ")));
  var implausible = skinfoldResult(M, {date: "2026-10-01", skinfolds: {chest: 1, abdominal: 1, thigh: 1}});
  check.check("2. Resultado implausível (< 2 %) não é apresentado como % de gordura e avisa", implausible.bodyFat === null && /não é plausível/.test(implausible.warnings.join(" ")));
})();

// ---- 3. Categorias, áreas do braço, risco da cintura ----
(function(){
  check.check("3. ACE homens: 5,9 → essencial; 6 → atleta; 14 → em forma; 18 → aceitável; 25 → obesidade", bodyFatCategory("M", 5.9) === "gordura essencial" && bodyFatCategory("M", 6) === "atleta" && bodyFatCategory("M", 14) === "em forma" && bodyFatCategory("M", 18) === "aceitável" && bodyFatCategory("M", 25) === "obesidade" && bodyFatCategory("M", 1.5) === "abaixo do essencial");
  check.check("3. ACE mulheres: 13,9 → essencial; 14 → atleta; 21 → em forma; 25 → aceitável; 32 → obesidade", bodyFatCategory("F", 13.9) === "gordura essencial" && bodyFatCategory("F", 14) === "atleta" && bodyFatCategory("F", 21) === "em forma" && bodyFatCategory("F", 25) === "aceitável" && bodyFatCategory("F", 32) === "obesidade" && bodyFatCategory("F", 9) === "abaixo do essencial");
  check.check("3. Sem sexo ou sem valor não classifica", bodyFatCategory(null, 20) === null && bodyFatCategory("M", 0) === null);
  // braço 30 cm, tricipital 15 mm: AMA = (30 − π·1,5)²/(4π) = 50,889 cm²; AFA = 30·1,5/2 − π·1,5²/4 = 20,733 cm²
  var m = armAreas(30, 15, "M"), f = armAreas(30, 15, "F");
  check.check("3. Área muscular corrigida: −10 cm² nos homens (40,9) e −6,5 nas mulheres (44,4); área de gordura 20,7 (sem correção)", m.muscle === 40.9 && f.muscle === 44.4 && m.fat === 20.7 && f.fat === 20.7);
  check.check("3. Sem perímetro, dobra ou sexo → null; a área muscular nunca é negativa", armAreas(0, 15, "M") === null && armAreas(30, 0, "M") === null && armAreas(30, 15, null) === null && armAreas(12, 40, "M").muscle === 0);
  check.check("3. Cintura (OMS/IDF): homens 93,9 / 94 / 101,9 / 102; mulheres 79,9 / 80 / 87,9 / 88", [93.9, 94, 101.9, 102].map(function(w){ return waistRiskLevel("M", w); }).join() === "0,1,1,2" && [79.9, 80, 87.9, 88].map(function(w){ return waistRiskLevel("F", w); }).join() === "0,1,1,2" && waistRiskLevel(null, 90) === null && waistRiskLevel("M", 0) === null);
})();

// ---- 4. Avisos de plausibilidade ----
(function(){
  check.check("4. Valores normais não geram avisos", anthroPlausibilityWarnings({waist: 80, hip: 100, neck: 36, arm: 30, armFlexed: 33, forearm: 26, wrist: 16, thigh: 55, calf: 37, ankle: 22}, {triceps: 14, thigh: 20}, 170).length === 0);
  var w = anthroPlausibilityWarnings({neck: 60, wrist: 11}, {triceps: 2, biceps: 70}, 170).join(" | ");
  check.check("4. Perímetros e dobras invulgares avisam (pescoço 60, punho 11, tricipital 2, bicipital 70)", /Pescoço 60,0 cm é muito alto/.test(w) && /Punho 11,0 cm é muito baixo/.test(w) && /tricipital de 2,0 mm é muito baixa/.test(w) && /bicipital de 70,0 mm é muito alta/.test(w));
  check.check("4. Braço contraído menor do que o relaxado, ou 13 cm maior, avisa", anthroPlausibilityWarnings({arm: 32, armFlexed: 30}, {}, 170).length === 1 && anthroPlausibilityWarnings({arm: 28, armFlexed: 42}, {}, 170).length === 1 && anthroPlausibilityWarnings({arm: 28, armFlexed: 33}, {}, 170).length === 0);
  check.check("4. Cintura maior do que a anca NÃO avisa (é frequente na obesidade central): só uma razão cintura/anca fora de 0,55–1,30", anthroPlausibilityWarnings({waist: 112, hip: 105}, {}, 0).length === 0 && anthroPlausibilityWarnings({waist: 140, hip: 90}, {}, 0).some(function(x){ return /cintura\/anca/.test(x); }));
  check.check("4. Pescoço ≥ cintura, tornozelo ≥ gémeo, gémeo ≥ coxa avisam", anthroPlausibilityWarnings({neck: 60, waist: 58}, {}, 0).some(function(x){ return /pescoço/.test(x); }) && anthroPlausibilityWarnings({ankle: 30, calf: 28}, {}, 0).some(function(x){ return /tornozelo/.test(x); }) && anthroPlausibilityWarnings({calf: 50, thigh: 48}, {}, 0).some(function(x){ return /gémeo é maior/.test(x); }));
  check.check("4. Razão cintura/altura invulgar (0,25) avisa", anthroPlausibilityWarnings({waist: 45}, {}, 180).some(function(x){ return /cintura\/altura/.test(x); }));
  check.check("4. Os limites rígidos de cada perímetro cobrem valores reais de punho e tornozelo (a antiga regra 20–250 cm rejeitava-os)", perimeterField("wrist")[4] <= 14 && perimeterField("ankle")[4] <= 18 && perimeterField("neck")[4] < 30);
  check.check("4. Cada limite está ordenado: rejeitar-min < avisar-min < avisar-max < rejeitar-max", PERIMETER_FIELDS.every(function(f){ return f[4] < f[6] && f[6] < f[7] && f[7] < f[5]; }));
})();

// ---- 5. Cartão de perímetros ----
(function(){
  var s = {sex: "Masculino", height: 180, assessments: [
    {date: "2026-10-10", weight: 80, waist: 92, hip: 100, neck: 40, arm: 33, armL: 32, thigh: 58, thighL: 56.5},
    {date: "2026-09-10", weight: 0, waist: 95, arm: 32.5, calf: 38},
    {date: "2026-08-10", weight: 82, waist: 99, hip: 101, chest: 104}
  ]};
  var h = tplPerimetersCard(s);
  check.check("5. Mostra as zonas do corpo e só os perímetros medidos", /Tronco/.test(h) && /Membros superiores/.test(h) && /Membros inferiores/.test(h) && /Pescoço/.test(h) && /Gémeo \(D\)/.test(h) && !/Ombros/.test(h) && !/Punho/.test(h));
  check.check("5. Mostra as últimas medições em colunas, da mais recente para a mais antiga", h.indexOf("10/10/2026") < h.indexOf("10/09/2026") && h.indexOf("10/09/2026") < h.indexOf("10/08/2026"));
  check.check("5. A variação é face à medição anterior DESSE perímetro (cintura 92 vs 95 = ▼ 3,0; anca 100 vs 101 — a visita de 10/09 não a mediu)", /▼ 3,0/.test(h) && /▼ 1,0/.test(h) && !/▼ 3\.0/.test(h));
  check.check("5. Cintura 92 cm (homem) → sem risco acrescido; razão cintura/anca 0,92 → risco; cintura/altura 0,51 → aumentada", /sem risco acrescido/.test(h) && /a partir de 0,90: risco aumentado/.test(h) && /adiposidade central aumentada/.test(h));
  check.check("5. Mostra a diferença D/E da última medição (braço 1,0 cm; coxa 1,5 cm)", /Braço relaxado 1,0 cm/.test(h) && /Coxa 1,5 cm/.test(h));
  var minor = tplPerimetersCard({sex: "Feminino", age: 14, height: 160, assessments: [{date: "2026-09-15", waist: 84, hip: 97}]});
  check.check("5. Menores de 18 anos: só os números, com a nota 'classificação só para adultos', sem vermelho nem 'risco'", /só para adultos/.test(minor) && !/risco aumentado/.test(minor) && !/adiposidade central/.test(minor) && !/class="d bad"/.test(minor));
  var noSex = tplPerimetersCard({sex: "Prefiro não dizer", age: 30, height: 160, assessments: [{date: "2026-09-15", waist: 92, hip: 104}]});
  check.check("5. Sem sexo definido não classifica nem a cintura nem a razão cintura/anca (já não usa o limiar feminino em silêncio); a cintura/altura classifica-se", (noSex.match(/indica o sexo para classificar/g) || []).length === 2 && /adiposidade central aumentada/.test(noSex));
  var legacy = tplPerimetersCard({sex: "Feminino", height: 160, assessments: [{date: "2026-09-15", weight: 60, waist: 84, hip: 96, chest: 90, arm: 28, thigh: 55}]});
  check.check("5. Avaliações antigas (waist, hip, chest, arm, thigh) continuam a aparecer, com o lado direito indicado", /Braço relaxado \(D\)/.test(legacy) && /Coxa \(D\)/.test(legacy) && /Peito/.test(legacy));
  var levels = [0.38, 0.45, 0.55, 0.65].map(function(r){ return tplPerimetersCard({sex: "Masculino", height: 100, assessments: [{date: "2026-09-15", waist: r * 100}]}); });
  check.check("5. Cintura/altura em 4 níveis (NICE): < 0,40 neutro; 0,40–0,49 saudável; 0,50–0,59 aumentada; ≥ 0,60 elevada", /valor baixo/.test(levels[0]) && /saudável/.test(levels[1]) && /aumentada/.test(levels[2]) && /elevada/.test(levels[3]));
  var edge = tplPerimetersCard({sex: "Feminino", height: 165, assessments: [{date: "2026-09-15", waist: 82, hip: 91.1}]});
  check.check("5. A classificação usa o valor mostrado: 82/165 = 0,497 aparece como 0,50 e é 'aumentada', não 'saudável (< 0,50)'", /0,50/.test(edge) && /adiposidade central aumentada/.test(edge) && !/saudável/.test(edge));
  var junk = tplPerimetersCard({sex: "Masculino", height: "x", assessments: [{date: "2026-09-15", waist: "abc", hip: NaN, neck: -5, arm: "30"}, null, {date: "2026-09-01", waist: 90}]});
  check.check("5. Valores inválidos (texto, NaN, negativos, null) não rebentam e são ignorados", /Braço relaxado/.test(junk) && !/abc|NaN/.test(junk));
  check.check("5. Sem perímetros não há cartão; uma visita só com dobras também não conta", tplPerimetersCard({assessments: [{date: "2026-09-01", weight: 60, bodyFat: 20}]}) === "" && tplPerimetersCard({assessments: [{date: "2026-09-01", skinfolds: {triceps: 10}}]}) === "");
})();

// ---- 6. Cartão de dobras ----
(function(){
  var s = {sex: "Masculino", age: 30, assessments: [
    {date: "2026-10-10", weight: 80, skinfolds: {chest: 9, abdominal: 18, thigh: 14}, sfProtocol: "jp3", arm: 30, skinfolds2: 1},
    {date: "2026-09-10", weight: 0, skinfolds: {chest: 10, abdominal: 20, thigh: 15}, sfProtocol: "jp3"},
    {date: "2026-08-10", weight: 82, skinfolds: {biceps: 6, triceps: 10, subscapular: 14, suprailiac: 12}, sfProtocol: "dw4"}
  ], weights: [{date: "2026-09-10", w: 81}]};
  s.assessments[0].skinfolds.triceps = 12; // para a área do braço
  var h = tplSkinfoldsCard(s);
  check.check("5b. Mostra o protocolo, a soma das dobras, a % de gordura (dobras) e as massas em kg", /Jackson-Pollock 3 dobras/.test(h) && /Σ 3 dobras/.test(h) && /% gordura \(dobras\)/.test(h) && /Massa gorda \(dobras\)/.test(h) && /Massa magra \(dobras\)/.test(h));
  var r1 = skinfoldResult(s, s.assessments[0]), r2 = skinfoldResult(s, s.assessments[1]);
  check.check("5b. A variação compara com a medição anterior do MESMO protocolo (JP3 de 10/09, não o D-W4 de agosto)", r1.protocol === "jp3" && r2.protocol === "jp3" && /▼ 4,0|▼ 4\.0 mm/.test(h.replace(/<[^>]+>/g, " ")) || /▼ 4\.0/.test(h));
  var hPro = tplSkinfoldsCard(s, {editable: true});
  check.check("5b. A categoria ACE só aparece ao profissional (o aluno vê os números e a tendência); o aviso do erro aparece a ambos", /\(ACE\)/.test(hPro) && !/\(ACE\)/.test(h) && /±3–4 %/.test(h) && /±3–4 %/.test(hPro));
  check.check("5b. A tabela tem as dobras medidas e as datas", /Tricipital/.test(h) && /Peitoral/.test(h) && /Bicipital/.test(h) && /10\/10\/2026/.test(h));
  check.check("5b. Com perímetro do braço e tricipital na mesma avaliação mostra as áreas do braço", /Área muscular do braço/.test(h) && /Área de gordura do braço/.test(h));
  check.check("5b. A massa em kg usa o peso da avaliação, ou a pesagem desse dia (81 kg a 10/09)", weightForAssessment(s, s.assessments[0]) === 80 && weightForAssessment(s, s.assessments[1]) === 81 && weightForAssessment(s, {date: "2000-01-01"}) === null);
  var small = tplSkinfoldsCard({sex: "Masculino", age: 30, assessments: [
    {date: "2026-10-10", skinfolds: {chest: 10, abdominal: 20, thigh: 15}, sfProtocol: "jp3"}, {date: "2026-09-10", skinfolds: {chest: 10.5, abdominal: 20, thigh: 15}, sfProtocol: "jp3"}]});
  check.check("5b. Soma das dobras com variação inferior a 5 %: avisa que pode ser só erro de medição", /variou menos de 5 %/.test(small));
  var big = tplSkinfoldsCard({sex: "Masculino", age: 30, assessments: [
    {date: "2026-10-10", skinfolds: {chest: 9, abdominal: 18, thigh: 13.5}, sfProtocol: "jp3"}, {date: "2026-09-10", skinfolds: {chest: 10, abdominal: 20, thigh: 15}, sfProtocol: "jp3"}]});
  check.check("5b. Uma descida de 10 % em todas as dobras (soma 45 → 40,5) não é apresentada como ruído", !/variou menos de 5 %/.test(big));
  check.check("5b. Sem pesagem não inventa kg (apenas % e soma)", !/Massa gorda \(dobras\)/.test(small) && /% gordura \(dobras\)/.test(small));
  check.check("5b. Sem dobras, nada; protocolo desconhecido e texto malicioso não entram no HTML", tplSkinfoldsCard({assessments: [{date: "2026-09-01", weight: 60}]}) === "" && tplSkinfoldsCard({sex: "Masculino", age: 30, assessments: [{date: "2026-09-01", skinfolds: {chest: 10, abdominal: 20, thigh: 15}, sfProtocol: "<img src=x onerror=1>", sfSex: "<b>"}]}).indexOf("<img") === -1);
  var junk = tplSkinfoldsCard({sex: "Feminino", age: "x", assessments: [{date: "2026-09-01", skinfolds: {triceps: "12", suprailiac: "abc", thigh: null}}, {date: "2026-08-01", skinfolds: null}, null]}, {editable: true});
  check.check("5b. Valores inválidos (texto, null) não rebentam: ficam só as dobras válidas e o aviso de que faltam dobras", /Tricipital/.test(junk) && /Faltam dobras/.test(junk) && !/abc/.test(junk));
  var noAge = skinfoldResult({sex: "Feminino", age: "x"}, {date: "2026-09-01", skinfolds: {biceps: 6, triceps: 10, subscapular: 14, suprailiac: 12}});
  check.check("5b. Idade desconhecida: não calcula e avisa que falta a idade", noAge.bodyFat === null && /idade/.test(noAge.warnings.join(" ")) && /idade/.test(tplSkinfoldsCard({sex: "Feminino", age: "x", assessments: [{date: "2026-09-01", skinfolds: {biceps: 6, triceps: 10, subscapular: 14, suprailiac: 12}}]}, {editable: true})));
  var stuView = tplSkinfoldsCard({sex: "Feminino", age: 70, assessments: [{date: "2026-09-01", skinfolds: {triceps: 18, suprailiac: 15, thigh: 25}, sfProtocol: "jp3"}]});
  check.check("5b. O aluno não vê avisos de método (idade fora do intervalo, falta de sexo...) nem conselhos de medição; vê uma nota curta e neutra", !/⚠/.test(stuView) && !/mesma pessoa/.test(stuView) && /margem de erro de ±3–4 %/.test(stuView) && /⚠/.test(tplSkinfoldsCard({sex: "Feminino", age: 70, assessments: [{date: "2026-09-01", skinfolds: {triceps: 18, suprailiac: 15, thigh: 25}, sfProtocol: "jp3"}]}, {editable: true})));
  // alunos com sexo diferente nas equações (sexo 'Outro'): não se compara a tendência entre equações e dobras diferentes
  var mixed = tplSkinfoldsCard({sex: "Outro", age: 30, assessments: [
    {date: "2026-10-10", skinfolds: {chest: 8, abdominal: 14, thigh: 12}, sfProtocol: "jp3", sfSex: "M"},
    {date: "2026-09-01", skinfolds: {triceps: 18, suprailiac: 15, thigh: 25}, sfProtocol: "jp3", sfSex: "F"}]});
  check.check("5b. Visitas de sexos diferentes nas equações (sexo 'Outro') não geram variação entre si", /Σ 3 dobras/.test(mixed) && !/▼|▲/.test(mixed.replace(/<table[\s\S]*<\/table>/, "")));
})();

// ---- 7. Formulário e tabela de avaliações ----
(function(){
  var f = tplAssessForm({sex: "Masculino"});
  check.check("7. O formulário tem as 9 dobras, o protocolo e a ajuda de onde medir", SKINFOLD_SITES.length === 9 && SKINFOLD_SITES.every(function(site){ return f.indexOf('id="sf' + site[2] + '"') >= 0; }) && /id="sfProtocol"/.test(f) && /Onde medir/.test(f) && /Como medir/.test(f));
  check.check("7. Quando o sexo é conhecido não pergunta de que sexo aplicar as equações", f.indexOf('id="sfSex"') === -1 && tplAssessForm({sex: "Outro"}).indexOf('id="sfSex"') >= 0 && tplAssessForm({}).indexOf('id="sfSex"') >= 0);
  check.check("7. O protocolo oferece Automático, JP7, JP3 e D-W4", /value="auto"/.test(f) && /value="jp7"/.test(f) && /value="jp3"/.test(f) && /value="dw4"/.test(f));
  var t = tplAssessTable({assessments: [{date: "2026-09-15", weight: 0, waist: 80}, {date: "2026-09-16", weight: 0, skinfolds: {triceps: 10}}, {date: "2026-09-17", weight: 60, bodyFat: 20}]}, true);
  check.check("7. A tabela de avaliações indica quando uma visita tem perímetros ou dobras, numa segunda linha (não alarga a coluna da data)", /<br><span class="atime">perímetros<\/span>/.test(t) && /<br><span class="atime">dobras<\/span>/.test(t) && (t.match(/perímetros/g) || []).length === 1);
  check.check("7. Uma visita com perímetros e dobras junta as duas etiquetas na mesma linha", /<br><span class="atime">perímetros · dobras<\/span>/.test(tplAssessTable({assessments: [{date: "2026-09-15", weight: 0, waist: 80, skinfolds: {triceps: 10}}]}, true)));
  check.check("7. Os cartões entram no separador de avaliação do profissional e do aluno", /html \+= tplPerimetersCard\(s\);\s*html \+= tplSkinfoldsCard\(s, opts\);/.test(appSource));
})();
check.summarize();
