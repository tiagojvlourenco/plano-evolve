// Fase 4 — sistema de flexibilidade.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

function freshStudent(flex){
  return {
    flexibility: flex,
    flexOverrides: {},
    flexHistory: [],
    blockedFoods: []
  };
}

// 1-9. Fronteiras de score (secção 25)
[
  [0,"estruturado"],[20,"estruturado"],[33,"estruturado"],
  [34,"equilibrado"],[50,"equilibrado"],[66,"equilibrado"],
  [67,"flexivel"],[80,"flexivel"],[100,"flexivel"]
].forEach(function(pair){
  check.check("Score " + pair[0] + " -> " + pair[1], flexTier(pair[0]) === pair[1]);
});

// 10. Perfil derivado do score (sem overrides)
(function(){
  var s = freshStudent(20);
  var p = computeFlexibilityProfile(s);
  check.check("10. Score 20 -> mealBuilderEnabled false", p.mealBuilderEnabled === false);
  check.check("10. Score 20 -> freeMealEnabled false", p.freeMealEnabled === false);
  check.check("10. Score 20 -> substitutionsEnabled true (permite substituir, mas poucas opções)", p.substitutionsEnabled === true);
  check.check("10. Score 20 -> substitutionLevel low", p.substitutionLevel === "low");

  var s2 = freshStudent(50);
  var p2 = computeFlexibilityProfile(s2);
  check.check("10. Score 50 -> freeMealEnabled true", p2.freeMealEnabled === true);
  check.check("10. Score 50 -> mealBuilderEnabled false", p2.mealBuilderEnabled === false);
  check.check("10. Score 50 -> substitutionLevel medium", p2.substitutionLevel === "medium");

  var s3 = freshStudent(85);
  var p3 = computeFlexibilityProfile(s3);
  check.check("10. Score 85 -> mealBuilderEnabled true", p3.mealBuilderEnabled === true);
  check.check("10. Score 85 -> substitutionLevel high", p3.substitutionLevel === "high");
})();

// 11. Override do profissional tem prioridade sobre o score (secção 11)
(function(){
  var s = freshStudent(20); // estruturado
  s.flexOverrides = { mealBuilderEnabled: true };
  var p = computeFlexibilityProfile(s);
  check.check("11. Override mealBuilderEnabled=true vence o preset estruturado", p.mealBuilderEnabled === true);
  check.check("11. Preset continua 'estruturado' apesar do override (não muda o rótulo)", p.preset === "estruturado");

  var s2 = freshStudent(85); // flexivel
  s2.flexOverrides = { mealBuilderEnabled: false, freeMealEnabled: false };
  var p2 = computeFlexibilityProfile(s2);
  check.check("11. Override pode desligar construtor mesmo em score elevado", p2.mealBuilderEnabled === false);
  check.check("11. Override pode desligar refeição flexível mesmo em score elevado", p2.freeMealEnabled === false);
})();

// 12. Dois alunos com mesmo score podem ter experiências diferentes (secção 28)
(function(){
  var a = freshStudent(50); // Aluno A: sem overrides
  var b = freshStudent(50); // Aluno B: mesmo score, mas com construtor forçado
  b.flexOverrides = { mealBuilderEnabled: true };
  var pa = computeFlexibilityProfile(a), pb = computeFlexibilityProfile(b);
  check.check("12. Mesmo score (50) pode gerar mealBuilderEnabled diferente por aluno", pa.mealBuilderEnabled !== pb.mealBuilderEnabled);
})();

// 13. Score não pode ser alterado pelo aluno — não há função de escrita fora do fluxo profissional
(function(){
  check.check("13. Não existe função aluno-facing para editar flexibilidade", typeof window.alunoSetFlexibility === "undefined");
})();

// 14. Histórico de flexibilidade
(function(){
  var s = freshStudent(35);
  logFlexChange(s, 35, 50, "Boa autonomia demonstrada.");
  check.check("14. logFlexChange regista uma entrada", s.flexHistory.length === 1);
  check.check("14. Histórico guarda from/to corretos", s.flexHistory[0].from === 35 && s.flexHistory[0].to === 50);
  check.check("14. Histórico guarda nota opcional", s.flexHistory[0].note === "Boa autonomia demonstrada.");
  logFlexChange(s, 50, 50, "");
  check.check("14. Não regista mudança quando from === to", s.flexHistory.length === 1);
})();

// 15. Restrições: alimento bloqueado nunca aparece, independentemente do score (secções 16/21/26)
(function(){
  var s = freshStudent(100); // score máximo
  s.blockedFoods = ["Peru (fatiado)"];
  var f = food("Frango (peito)","150 g","protein");
  var opts = optionsFor(f, s);
  check.check("15. Alimento bloqueado não aparece mesmo com score 100", opts.every(function(o){ return o.name !== "Peru (fatiado)"; }));
  var optsNoStudent = optionsFor(f);
  check.check("15. Sem contexto de aluno, optionsFor devolve a lista completa (compat retro)", optsNoStudent.some(function(o){ return o.name === "Peru (fatiado)"; }));
})();

// 16. Bloqueio funciona também com allowedSubs manuais
(function(){
  var s = freshStudent(50);
  s.blockedFoods = ["Peru (fatiado)"];
  var f = food("Frango (peito)","150 g","protein");
  f.allowedSubs = [{name:"Peru (fatiado)", qty:"150 g"}, {name:"Pescada", qty:"170 g"}];
  var opts = optionsFor(f, s);
  check.check("16. Bloqueio filtra também substituições manuais definidas pelo profissional", opts.length === 1 && opts[0].name === "Pescada");
})();

// 17. Nível de substituição limita o número de alternativas (score baixo = poucas opções)
(function(){
  var maxLow = SUBSTITUTION_LEVEL_MAX.low;
  var maxMedium = SUBSTITUTION_LEVEL_MAX.medium;
  var maxHigh = SUBSTITUTION_LEVEL_MAX.high;
  check.check("17. Nível baixo permite poucas alternativas (<=2)", maxLow <= 2);
  check.check("17. Nível médio permite mais que o baixo", maxMedium > maxLow);
  check.check("17. Nível alto não tem limite artificial", !isFinite(maxHigh));
})();

// 18. Score 0 -> máxima estrutura; Score 100 -> máxima liberdade dentro das regras (secção 26)
(function(){
  var s0 = freshStudent(0);
  var s100 = freshStudent(100);
  var p0 = computeFlexibilityProfile(s0), p100 = computeFlexibilityProfile(s100);
  check.check("18. Score 0 é o preset mais restritivo (builder desligado, refeição flexível desligada)", p0.mealBuilderEnabled === false && p0.freeMealEnabled === false);
  check.check("18. Score 100 é o preset mais permissivo (builder ligado)", p100.mealBuilderEnabled === true);
  s100.blockedFoods = ["Frutos secos"];
  var f = food("Azeite","10 ml","fat");
  check.check("18. Mesmo com score 100, alimento bloqueado continua a não aparecer", optionsFor(f, s100).every(function(o){ return o.name !== "Frutos secos"; }));
})();

// 19. Refeição flexível/adaptada nunca usa linguagem de prémio/castigo (secção 18, regressão)
(function(){
  check.check("19. Nenhuma referência a 'dia do lixo' no código", /dia do lixo/i.test(appSource) === false);
})();

// 20. Perfil sempre inclui score e preset coerentes com o valor do aluno
(function(){
  var s = freshStudent(72);
  var p = computeFlexibilityProfile(s);
  check.check("20. profile.score reflete o valor do aluno", p.score === 72);
  check.check("20. profile.preset coerente com flexTier", p.preset === flexTier(72));
})();

check.summarize();
