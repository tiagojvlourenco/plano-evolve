-- EVOLVE NUTRITION — Fase 8: Assistente Alimentar Guiado, pedidos de ajuda
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0008 já terem corrido.
-- AINDA NÃO APLICADA nem validada com dados reais — ver nota no fim do ficheiro.
--
-- Decisão de arquitetura: ao contrário do resto da app (que guarda quase tudo
-- em colunas JSONB dentro de "students"), os pedidos de ajuda ficam em
-- tabelas próprias. Motivo: a política de leitura do aluno ("student reads
-- own row") dá acesso à linha INTEIRA de students — não há forma de esconder
-- um campo específico dentro dessa linha só do aluno. Como é exigido que a
-- nota privada do profissional nunca seja visível nem alterável pelo aluno,
-- essa nota fica numa tabela SEPARADA (help_request_notes) sem NENHUMA
-- política para o aluno — RLS bloqueia por omissão quando não há política
-- aplicável, o que aqui é exatamente o comportamento pretendido.
--
-- Os 5 critérios pedidos, e a policy exata que cada um cobre:
--   1. Aluno só cria e lê os PRÓPRIOS pedidos
--        -> "student creates own help request" (insert) e
--           "student reads own help requests" (select), ambas abaixo.
--   2. Aluno NUNCA altera nem apaga pedidos (nem os próprios)
--        -> não existe NENHUMA policy de update/delete para o aluno em
--           help_requests. Confirmado explicitamente no fim do ficheiro.
--   3. Aluno NUNCA lê, cria, altera ou apaga notas privadas
--        -> help_request_notes só tem UMA policy, exclusiva do profissional.
--           Zero políticas para o aluno = bloqueado por omissão em todas as
--           operações (select/insert/update/delete).
--   4. Profissional autorizado lê pedidos, cria notas, marca como tratado
--        -> "professional manages help requests" e
--           "professional manages help request notes", ambas "for all"
--           (select+insert+update+delete), abaixo.
--   5. Nenhum utilizador lê pedidos/notas de OUTROS alunos
--        -> a condição de aluno usa sempre "st.auth_user_id = auth.uid()"
--           contra a linha de students referida por student_id: um pedido
--           de outro aluno nunca satisfaz essa condição.

create table if not exists help_requests (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references students(id) on delete cascade,
  created_at timestamptz not null default now(),
  situation text not null,
  meal_name text,
  note text,
  status text not null default 'pendente' check (status in ('pendente','tratado'))
);

create index if not exists help_requests_student_id_idx on help_requests(student_id);

alter table help_requests enable row level security;

-- Critério 1a: o aluno só consegue INSERIR um pedido cujo student_id aponte
-- para a SUA PRÓPRIA linha em students (auth_user_id = auth.uid()). Tentar
-- criar um pedido com o student_id de outro aluno falha esta condição.
drop policy if exists "student creates own help request" on help_requests;
create policy "student creates own help request" on help_requests
  for insert
  with check (
    exists (select 1 from students st where st.id = student_id and st.auth_user_id = auth.uid())
  );

-- Critério 1b + 5 (metade aluno): o aluno só consegue LER pedidos cujo
-- student_id aponte para a sua própria linha — os de outros alunos nunca
-- satisfazem esta condição, logo ficam invisíveis (não é um erro, é 0 linhas).
drop policy if exists "student reads own help requests" on help_requests;
create policy "student reads own help requests" on help_requests
  for select
  using (
    exists (select 1 from students st where st.id = student_id and st.auth_user_id = auth.uid())
  );

-- Critério 2: intencionalmente NÃO existe nenhuma policy "for update" nem
-- "for delete" para o aluno nesta tabela. Em RLS, a ausência de uma policy
-- aplicável a uma operação bloqueia essa operação por omissão — não é preciso
-- escrever uma policy que "proíba" update/delete: simplesmente não se
-- concede nenhuma. Ver verify_security.sql para o teste que confirma isto.

-- Critério 4 (metade help_requests): o profissional vê e gere TODOS os
-- pedidos — for all cobre select/insert/update/delete, incluindo marcar como
-- tratado (update status).
drop policy if exists "professional manages help requests" on help_requests;
create policy "professional manages help requests" on help_requests
  for all
  using (exists (select 1 from professionals where user_id = auth.uid()))
  with check (exists (select 1 from professionals where user_id = auth.uid()));

comment on table help_requests is
  'Pedidos de ajuda do Assistente Alimentar Guiado. Aluno: insert+select das próprias linhas (via students.auth_user_id), nunca update/delete. Profissional: acesso total.';

-- Critério 3: notas privadas do profissional sobre um pedido. NUNCA visíveis
-- nem alteráveis pelo aluno — a tabela só tem UMA política, exclusiva do
-- profissional; zero políticas para o aluno bloqueia select/insert/update/
-- delete por omissão.
create table if not exists help_request_notes (
  request_id uuid primary key references help_requests(id) on delete cascade,
  professional_note text,
  updated_at timestamptz not null default now()
);

alter table help_request_notes enable row level security;

-- Critério 4 (metade notas): profissional cria/edita a nota privada.
drop policy if exists "professional manages help request notes" on help_request_notes;
create policy "professional manages help request notes" on help_request_notes
  for all
  using (exists (select 1 from professionals where user_id = auth.uid()))
  with check (exists (select 1 from professionals where user_id = auth.uid()));

comment on table help_request_notes is
  'Notas privadas sobre um pedido de ajuda. NENHUMA política para o aluno — RLS bloqueia por omissão em todas as operações. Só o profissional (tabela professionals) tem acesso.';

-- ===================== Estado desta migração =====================
-- Ainda NÃO foi aplicada em produção nem validada com uma conta de aluno
-- real. A Fase 7 mostrou que uma condição logicamente correta (confirmada até
-- por uma função de diagnóstico) pode ainda assim falhar de forma inesperada
-- via PostgREST num UPDATE direto (ver 0008_claim_via_function.sql) — por
-- isso esta migração só deve ser aplicada e depois validada com os testes
-- funcionais de supabase/verify_security.sql (bloco G), com uma conta de
-- aluno e uma de profissional reais, antes de qualquer publicação.
