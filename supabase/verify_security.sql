-- EVOLVE NUTRITION — verificação manual das políticas (Fase 7)
-- Corre isto no SQL Editor do Supabase DEPOIS de aplicares 0001-0005.
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
