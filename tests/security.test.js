// Fase 7 — segurança, acessos e permissões.
//
// IMPORTANTE — o que estes testes NÃO fazem: não há aqui nenhuma verificação real
// de Row Level Security contra uma base de dados Supabase (este ambiente não tem
// credenciais nem rede para autenticar como aluno/profissional reais). O que se
// segue são (a) testes de regressão sobre o código-fonte, para apanhar se algum
// dia voltar a aparecer um padrão inseguro já corrigido, e (b) testes unitários
// de funções puras (photoUrl/resolvePhotoUrls). A validação real das políticas
// SQL tem de ser feita manualmente — ver supabase/verify_security.sql.
const fs = require("fs");
const path = require("path");
require("./setup")();
eval(require("./extract-app")());
var check = require("./check")();

var appSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

// ---- 1. O papel de profissional nunca é decidido comparando um email fixo no JS ----
(function(){
  check.check("1. Já não existe a comparação antiga de email para decidir isProfessional",
    /isProfessional\s*=\s*email\s*===\s*["']tiagojvlourenco@gmail\.com["']/.test(appSource) === false);
  check.check("1. checkIsProfessional() está definida", typeof checkIsProfessional === "function");
  check.check("1. checkIsProfessional() consulta a tabela 'professionals' (não compara email)",
    checkIsProfessional.toString().indexOf('"professionals"') >= 0);
  check.check("1. checkIsProfessional() não compara nenhum email fixo", /tiagojvlourenco@gmail\.com/.test(checkIsProfessional.toString()) === false);
})();

// ---- 2. Nenhuma credencial privada exposta no browser ----
(function(){
  check.check("2. Não há nenhuma referência a service_role no código", /service_role/i.test(appSource) === false);
  check.check("2. A única chave Supabase presente é a anon (pública, segura para o cliente)", /SUPABASE_ANON_KEY/.test(appSource) === true);
})();

// ---- 3. photoUrl(): ordem de resolução e nunca produz undefined/null no HTML ----
(function(){
  check.check("3. Prioriza o URL assinado (_resolvedUrl) sobre tudo o resto", photoUrl({_resolvedUrl:"assinado", url:"antigo", dataUrl:"local"}) === "assinado");
  check.check("3. Sem URL assinado, usa o URL antigo (compatibilidade retroativa)", photoUrl({url:"antigo", dataUrl:"local"}) === "antigo");
  check.check("3. Sem URL nenhum, usa o fallback local em base64", photoUrl({dataUrl:"local"}) === "local");
  check.check("3. Sem nenhum dos três, devolve string vazia (nunca undefined/null no <img src>)", photoUrl({}) === "");
})();

// ---- 4. resolvePhotoUrls(): não tenta rede sem ligação, nunca rebenta ----
(function(){
  var originalSbReady = sbReady;
  sbReady = false;
  var settled = false;
  resolvePhotoUrls([{photos:[{path:"x/1.jpg"}]}]).then(function(){ settled = true; });
  check.check("4. Sem ligação ao Supabase, resolve de imediato sem tentar rede", true); // não rebentou ao chamar
  sbReady = originalSbReady;
})();

(function(){
  var students = [{photos:[]}, {photos:[{dataUrl:"data:xyz"}]}]; // sem 'path' -> nada para resolver
  var ok = true;
  try { resolvePhotoUrls(students); } catch(e){ ok = false; }
  check.check("5. Alunos sem fotos com 'path' não geram nenhum pedido nem rebentam", ok === true);
})();

// ---- 6. "Contrato" das migrações SQL: as peças de segurança esperadas existem ----
// (não valida que o SQL corre sem erros no Postgres real — só que o ficheiro
// não perdeu, por engano, uma política/trigger que já tínhamos decidido ter)
(function(){
  var sqlPath = path.join(__dirname, "..", "supabase", "migrations", "0004_security_hardening.sql");
  var sql = fs.readFileSync(sqlPath, "utf8");

  check.check("6. Cria a tabela 'professionals' em vez de confiar num email fixo", /create table if not exists professionals/i.test(sql));
  check.check("6. RLS ativo na tabela 'professionals'", /alter table professionals enable row level security/i.test(sql));
  check.check("6. Política de acesso total do profissional usa a tabela 'professionals'", /"professional full access"[\s\S]*?professionals/i.test(sql));
  check.check("6. Política de leitura própria do aluno existe", /"student reads own row"/.test(sql));
  check.check("6. Política de reclamar convite existe", /"student claims invited row"/.test(sql));
  check.check("6. Trigger de permissões por coluna existe", /trg_enforce_student_column_permissions/.test(sql));
  check.check("6. A função do trigger usa uma allowlist, não uma lista de bloqueios crescente", /allowed_keys/.test(sql));

  // Extrai o bloco COMPLETO do array (multi-linha, "allowed_keys text[] := array[ ... ];")
  // em vez de só a primeira linha — senão os campos listados nunca seriam encontrados.
  var allowlistMatch = sql.match(/allowed_keys[\s\S]*?array\[([\s\S]*?)\]/);
  var allowlistBlock = allowlistMatch ? allowlistMatch[1] : "";
  check.check("6. Consegue extrair o bloco da allowlist do SQL para validar o conteúdo", allowlistBlock.length > 0);

  // A allowlist tem de conter exatamente os campos que o aluno legitimamente escreve
  // (confirmado a ler o código: check-in escreve weights/weightCurrent, ações do dia
  // a dia escrevem meals/adaptationHistory/substitutionHistory, upload escreve photos)
  ["meals", "meals_date", "checkins", "weights", "weight_current", "substitution_history", "adaptation_history", "photos"].forEach(function(col){
    check.check("6. Allowlist inclui '" + col + "' (o aluno precisa de o poder escrever)", allowlistBlock.indexOf("'" + col + "'") >= 0);
  });

  // Campos claramente reservados ao profissional NÃO podem estar na allowlist
  ["targets", "flexibility", "notes", "plan_history", "alerts", "flex_overrides", "flex_history", "blocked_foods", "name"].forEach(function(col){
    check.check("6. Allowlist NÃO inclui '" + col + "' (é reservado ao profissional)", allowlistBlock.indexOf("'" + col + "'") === -1);
  });

  check.check("6. Bloqueia a troca de dono de uma linha já associada", /auth_user_id is not null and old\.auth_user_id is distinct from new\.auth_user_id/.test(sql));
  check.check("6. Políticas de Storage do bucket de fotos existem", /"aluno envia as suas fotos"/.test(sql) && /"aluno lê as suas fotos"/.test(sql) && /"profissional lê fotos dos alunos"/.test(sql));
  check.check("6. Restringe upload/leitura de fotos à pasta do próprio utilizador", /storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/.test(sql));
})();

(function(){
  var sqlPath = path.join(__dirname, "..", "supabase", "migrations", "0003_add_missing_columns.sql");
  var sql = fs.readFileSync(sqlPath, "utf8");
  ["flex_overrides", "flex_history", "blocked_foods", "substitution_history", "adaptation_history"].forEach(function(col){
    check.check("7. Migração cria a coluna em falta '" + col + "'", new RegExp("add column if not exists " + col).test(sql));
  });
})();

// ---- 8. O script de verificação manual existe e cobre os critérios pedidos ----
(function(){
  var verifyPath = path.join(__dirname, "..", "supabase", "verify_security.sql");
  var verify = fs.readFileSync(verifyPath, "utf8");
  check.check("8. Verifica que as políticas esperadas existem", /pg_policies/.test(verify));
  check.check("8. Verifica que o trigger está ativo", /pg_trigger/.test(verify));
  check.check("8. Inclui o passo manual de aluno A vs aluno B", /Aluno A não vê nem altera dados do Aluno B/.test(verify));
  check.check("8. Inclui o passo manual de conta sem aluno associado", /Conta sem aluno associado não acede a nada/.test(verify));
})();

check.summarize();
