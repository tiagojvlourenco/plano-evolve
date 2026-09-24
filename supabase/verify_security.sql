-- EVOLVE NUTRITION — verificação manual das políticas (Fases 7 e 8)
-- Corre as queries 1-8 e os testes A-F DEPOIS de aplicares 0001-0008 — já
-- foram validados com dados reais (conta de profissional real + conta de
-- aluno criada via convite) em 2026-09-24. Ficam aqui para poderes repetir a
-- validação sempre que quiseres, ex. depois de uma alteração às políticas ou
-- ao trigger.
--
-- As queries 9-10 e o bloco de testes G são da Fase 8 (help_requests /
-- help_request_notes) — só correm depois de 0009_help_requests.sql, que
-- AINDA NÃO FOI APLICADA nem validada com dados reais. Não publiques nada
-- desta fase antes de correr o bloco G com sucesso.
-- Cada bloco tem uma pergunta e o resultado esperado. Não altera dados.

-- 1. As políticas esperadas existem?
select schemaname, tablename, policyname, cmd
from pg_policies
where tablename in ('students', 'professionals')
order by tablename, policyname;
-- Esperado: "professionals" tem 1 política (select, própria linha);
-- "students" tem 4 (professional full access / student reads own row /
-- student claims invited row / student updates own row). Nenhuma política
-- antiga "prototype open access" deve aparecer.

-- 2. O trigger de colunas está ativo?
select tgname, tgrelid::regclass, tgenabled
from pg_trigger
where tgname = 'trg_enforce_student_column_permissions';
-- Esperado: 1 linha, tgenabled = 'O' (ativo).

-- 3. A tua conta de profissional está associada?
select p.user_id, p.email, u.email as auth_email
from professionals p join auth.users u on u.id = p.user_id;
-- Esperado: pelo menos 1 linha com o teu email. Se vier vazio, confirma que já
-- fizeste login pelo menos uma vez com essa conta e volta a correr o "insert"
-- da secção 1 de 0004_security_hardening.sql.

-- 4. Colunas em falta ficaram mesmo criadas?
select column_name from information_schema.columns
where table_name = 'students'
  and column_name in ('flex_overrides','flex_history','blocked_foods','substitution_history','adaptation_history','meal_daily_state')
order by column_name;
-- Esperado: as 6 colunas listadas (as 5 da auditoria inicial + meal_daily_state,
-- a coluna que separa a execução diária do aluno da estrutura do plano em "meals").

-- 5. Políticas de Storage do bucket de fotos existem?
select policyname, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname in ('aluno envia as suas fotos', 'aluno lê as suas fotos', 'profissional lê fotos dos alunos');
-- Esperado: as 3 políticas.

-- 6. O bucket de fotos está privado?
select id, public from storage.buckets where id = 'progress-photos';
-- Esperado: public = false. Se vier "true" (ou o bucket nem existir ainda),
-- confirma/cria em Storage > progress-photos > Settings no painel — este é o
-- único passo que não é garantido só por SQL em todos os projetos.

-- 7. A função de verificação "append-only" existe?
select routine_name from information_schema.routines
where routine_name = 'jsonb_array_is_append_only';
-- Esperado: 1 linha. Protege substitution_history/adaptation_history contra
-- reescrita — o aluno só pode acrescentar eventos, nunca alterar/remover os
-- que já lá estavam (ver bloco F mais abaixo para o teste funcional).

-- 8. A função de reclamar o convite existe e está acessível ao aluno?
select routine_name, security_type
from information_schema.routines
where routine_name = 'claim_student_row';
select grantee, privilege_type
from information_schema.role_routine_grants
where routine_name = 'claim_student_row';
-- Esperado: 1 linha com security_type = 'DEFINER', e um grant de EXECUTE
-- para "authenticated". Um UPDATE direto na tabela para esta operação
-- específica não se mostrou fiável (ver nota histórica no fim do ficheiro);
-- a app usa sb.rpc("claim_student_row") em vez disso.

-- 9. Políticas de help_requests / help_request_notes existem, com o desenho certo?
-- (Fase 8 — AINDA NÃO APLICADA. Corre isto só depois de 0009_help_requests.sql.)
select schemaname, tablename, policyname, cmd
from pg_policies
where tablename in ('help_requests', 'help_request_notes')
order by tablename, policyname;
-- Esperado: "help_requests" tem 3 políticas (professional manages help
-- requests / student creates own help request / student reads own help
-- requests) — nenhuma de update/delete para o aluno. "help_request_notes"
-- tem EXATAMENTE 1 política (professional manages help request notes) — se
-- aparecer qualquer política com "student" no nome aqui, é uma regressão
-- grave: o aluno passaria a poder tocar em notas privadas.

-- 10. Confirma explicitamente que o aluno não tem NENHUMA política de
-- update/delete em help_requests, nem NENHUMA política (de qualquer tipo)
-- em help_request_notes.
select tablename, cmd, count(*)
from pg_policies
where tablename in ('help_requests','help_request_notes')
  and policyname ilike '%student%'
group by tablename, cmd;
-- Esperado: só duas linhas — help_requests / INSERT / 1 (a de criar) e
-- help_requests / SELECT / 1 (a de ler). NUNCA deve aparecer help_requests
-- com cmd UPDATE ou DELETE, nem NENHUMA linha para help_request_notes.

-- ===================== Testes funcionais (fazer com 2 contas reais) =====================
-- Estes não são queries SQL — são passos manuais na app, porque head de duas
-- sessões de browser autenticadas com utilizadores diferentes para teres
-- confiança real de que a RLS está a bloquear e não só a aparência da UI:
--
-- A. Aluno A não vê nem altera dados do Aluno B:
--    1. Inicia sessão como Aluno A (email de convite da Maria, por exemplo).
--    2. Abre a consola do browser (F12) e corre:
--         await sb.from("students").select("*")
--       Esperado: só vem a linha do Aluno A.
--         await sb.from("students").update({notes:"teste"}).eq("id","<id do aluno B>")
--       Esperado: 0 linhas afetadas (RLS bloqueia — não é a linha do Aluno A).
--
-- B. Aluno não altera plano nem notas do PRÓPRIO registo:
--    Ainda com sessão de Aluno A, na consola:
--         await sb.from("students").update({notes:"tentativa"}).eq("id","<id do próprio aluno>")
--       Esperado: erro "Só o profissional pode alterar estes dados do plano."
--    Isto confirma que o trigger bloqueia mesmo dentro da própria linha.
--
-- C. Profissional autorizado gere alunos normalmente:
--    Inicia sessão como profissional, confirma que vês todos os alunos e que
--    guardar alvos/notas/plano/flexibilidade continua a funcionar sem erros.
--
-- D. Conta sem aluno associado não acede a nada:
--    Cria uma conta nova com um email que NUNCA foi usado como invite_email
--    de nenhum aluno. Depois de login, a app deve mostrar o ecrã "sem aluno
--    associado" — e na consola, "await sb.from('students').select('*')"
--    deve devolver uma lista vazia.
--
-- E. Plano (meals) é rejeitado, execução diária (meal_daily_state) é aceite:
--    Ainda com sessão de Aluno A, na consola:
--         await sb.from("students").update({meals: []}).eq("id","<id do próprio aluno>")
--       Esperado: erro "Só o profissional pode alterar estes dados do plano."
--       — meals já não está na allowlist, mesmo dentro da própria linha.
--         await sb.from("students").update({meal_daily_state: {date:"2099-01-01", entries:{}}}).eq("id","<id do próprio aluno>")
--       Esperado: sucesso (0 ou mais linhas, sem erro) — esta é a coluna que o
--       aluno usa no dia a dia (concluir, adaptar, ignorar, reagendar, escolhas
--       do construtor, substituições dentro das opções permitidas).
--       Na app, confirma visualmente: marcar uma refeição como concluída e
--       recarregar a página mantém o estado; o profissional continua a poder
--       editar nome/horário/alimentos/quantidades das refeições sem qualquer
--       erro (a política dele nunca passa pelo trigger de colunas).
--
-- F. O aluno pode acrescentar ao histórico de adaptações, mas não reescrevê-lo:
--    Ainda com sessão de Aluno A, na consola, lê primeiro o histórico atual:
--         var { data } = await sb.from("students").select("adaptation_history").eq("id","<id do próprio aluno>").single()
--       Depois tenta apagar tudo:
--         await sb.from("students").update({adaptation_history: []}).eq("id","<id do próprio aluno>")
--       Esperado: erro "Não é permitido alterar ou remover histórico de
--       adaptações já registado." (a não ser que data.adaptation_history já
--       estivesse vazio — nesse caso usa a app para gerar um evento primeiro,
--       ex.: ignora uma refeição, e repete o teste).
--       Depois tenta ACRESCENTAR um evento a seguir aos existentes:
--         await sb.from("students").update({adaptation_history: data.adaptation_history.concat([{date:"2099-01-01", type:"teste"}])}).eq("id","<id do próprio aluno>")
--       Esperado: sucesso — acrescentar ao fim é permitido.
--       Repete o mesmo raciocínio para substitution_history se quiseres.
--
-- G. Pedidos de ajuda (Fase 8 — AINDA NÃO APLICADA/VALIDADA):
--    Precisas de duas contas de aluno (A e B) e a conta de profissional.
--
--    G1. Aluno A cria e lê o próprio pedido:
--        Sessão de Aluno A, na consola:
--          await sb.from("help_requests").insert({student_id:"<id do próprio aluno>", situation:"duvida", note:"teste"})
--        Esperado: sucesso.
--          await sb.from("help_requests").select("*").eq("student_id","<id do próprio aluno>")
--        Esperado: vem o pedido que acabou de criar.
--
--    G2. Aluno A NUNCA vê pedidos do Aluno B:
--        Ainda como Aluno A:
--          await sb.from("help_requests").select("*").eq("student_id","<id do aluno B>")
--        Esperado: lista vazia (mesmo que B tenha pedidos reais).
--
--    G3. Aluno A não consegue criar um pedido em nome do Aluno B:
--          await sb.from("help_requests").insert({student_id:"<id do aluno B>", situation:"duvida"})
--        Esperado: 0 linhas inseridas / erro de RLS.
--
--    G4. Aluno A não altera nem apaga o próprio pedido depois de criado:
--        Usa o "id" devolvido pelo insert de G1:
--          await sb.from("help_requests").update({status:"tratado"}).eq("id","<id do pedido>")
--        Esperado: 0 linhas afetadas (sem policy de update para o aluno).
--          await sb.from("help_requests").delete().eq("id","<id do pedido>")
--        Esperado: 0 linhas afetadas.
--
--    G5. Aluno A NUNCA lê nem escreve notas privadas — nem sequer as do
--        próprio pedido:
--          await sb.from("help_request_notes").select("*").eq("request_id","<id do pedido>")
--        Esperado: lista vazia (não é erro — é RLS a agir como se a tabela
--        estivesse sempre vazia para ele).
--          await sb.from("help_request_notes").insert({request_id:"<id do pedido>", professional_note:"tentativa"})
--        Esperado: erro de RLS / 0 linhas inseridas.
--
--    G6. Profissional lê o pedido, cria uma nota privada e marca como tratado:
--        Sessão de profissional:
--          await sb.from("help_requests").select("*, help_request_notes(*)").eq("student_id","<id do aluno A>")
--        Esperado: vem o pedido de G1.
--          await sb.from("help_request_notes").upsert({request_id:"<id do pedido>", professional_note:"Respondido por telefone."})
--        Esperado: sucesso.
--          await sb.from("help_requests").update({status:"tratado"}).eq("id","<id do pedido>")
--        Esperado: sucesso.
--        Confirma também na app: separador "Pedidos" do aluno A mostra o
--        pedido como "Tratado" com a nota visível — e que a MESMA nota nunca
--        aparece em lado nenhum da experiência de Aluno.
--
-- ===================== Nota histórica: reclamar o convite =====================
-- Ao validar o fluxo D (conta nova, sem aluno associado) com uma conta de
-- aluno real criada via convite, um UPDATE direto na tabela para associar
-- auth_user_id (a política "student claims invited row", mesmo corrigida
-- para usar auth.email() e com a condição confirmada como verdadeira por uma
-- função de diagnóstico) continuava a afetar 0 linhas quando feito via
-- PostgREST. Não foi isolada a causa exata dessa discrepância nesta sessão.
-- A solução foi mover essa operação específica para uma função
-- (claim_student_row, SECURITY DEFINER — ver 0008_claim_via_function.sql),
-- que foi confirmada a funcionar com essa mesma conta real. A app já usa
-- sb.rpc("claim_student_row") em vez de um UPDATE direto (ver handleSession
-- em evolve-nutrition.html). A política "student claims invited row" continua
-- a existir (não faz mal manter), mas deixou de ser o caminho usado pela app.
