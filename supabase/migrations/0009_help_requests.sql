-- EVOLVE NUTRITION — Fase 8: Assistente Alimentar Guiado, pedidos de ajuda
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0008 já terem corrido.
--
-- Decisão de arquitetura: ao contrário do resto da app (que guarda quase tudo
-- em colunas JSONB dentro de "students"), os pedidos de ajuda ficam em
-- tabelas próprias. Motivo: a política de leitura do aluno ("student reads
-- own row") dá acesso à linha INTEIRA de students — não há forma de esconder
-- um campo específico dentro dessa linha só do aluno. Como o pedido exige
-- explicitamente que a nota privada do profissional nunca seja visível nem
-- alterável pelo aluno, essa nota fica numa tabela SEPARADA
-- (help_request_notes) sem NENHUMA política para o aluno — RLS bloqueia por
-- omissão quando não há política aplicável, o que aqui é exatamente o que
-- queremos.

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

-- O aluno só cria e lê os pedidos da SUA PRÓPRIA linha (via o auth_user_id do
-- aluno associado a student_id) — nunca pode alterar ou apagar depois de
-- criado: não há política de update/delete para ele.
drop policy if exists "student creates own help request" on help_requests;
create policy "student creates own help request" on help_requests
  for insert
  with check (
    exists (select 1 from students st where st.id = student_id and st.auth_user_id = auth.uid())
  );

drop policy if exists "student reads own help requests" on help_requests;
create policy "student reads own help requests" on help_requests
  for select
  using (
    exists (select 1 from students st where st.id = student_id and st.auth_user_id = auth.uid())
  );

-- O profissional gere tudo: ver todos os pedidos e marcar como tratado.
drop policy if exists "professional manages help requests" on help_requests;
create policy "professional manages help requests" on help_requests
  for all
  using (exists (select 1 from professionals where user_id = auth.uid()))
  with check (exists (select 1 from professionals where user_id = auth.uid()));

-- Notas privadas do profissional sobre um pedido — nunca visíveis nem
-- alteráveis pelo aluno (sem nenhuma política para ele nesta tabela).
create table if not exists help_request_notes (
  request_id uuid primary key references help_requests(id) on delete cascade,
  professional_note text,
  updated_at timestamptz not null default now()
);

alter table help_request_notes enable row level security;

drop policy if exists "professional manages help request notes" on help_request_notes;
create policy "professional manages help request notes" on help_request_notes
  for all
  using (exists (select 1 from professionals where user_id = auth.uid()))
  with check (exists (select 1 from professionals where user_id = auth.uid()));
