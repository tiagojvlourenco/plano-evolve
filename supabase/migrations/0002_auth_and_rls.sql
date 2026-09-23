-- EVOLVE NUTRITION — adicionar autenticação
-- Corre isto no SQL Editor do Supabase (depois do schema inicial já correres)

-- 1. Novas colunas para ligar cada aluno à sua conta de login
alter table students add column if not exists invite_email text;
alter table students add column if not exists auth_user_id uuid references auth.users(id);

create unique index if not exists students_auth_user_id_idx on students(auth_user_id) where auth_user_id is not null;

-- 2. Substituir o acesso aberto por regras reais
drop policy if exists "prototype open access" on students;

-- O profissional (o teu email) vê e edita tudo
create policy "professional full access" on students
  for all
  using (auth.jwt() ->> 'email' = 'tiagojvlourenco@gmail.com')
  with check (auth.jwt() ->> 'email' = 'tiagojvlourenco@gmail.com');

-- Um aluno autenticado só vê/edita a sua própria linha
create policy "student reads own row" on students
  for select
  using (auth_user_id = auth.uid());

create policy "student updates own row" on students
  for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Um aluno novo (convidado) pode "reclamar" a linha criada para ele,
-- desde que o email da conta que acabou de criar corresponda ao email do convite.
-- Isto só funciona uma vez (auth_user_id começa a null e fica preenchido depois).
create policy "student claims invited row" on students
  for update
  using (auth_user_id is null and invite_email = auth.jwt() ->> 'email')
  with check (auth_user_id = auth.uid() and invite_email = auth.jwt() ->> 'email');
