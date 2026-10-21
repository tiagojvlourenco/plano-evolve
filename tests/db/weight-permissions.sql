-- Harness mínimo para testar o gatilho de colunas (migrações 0006 → 0019 → 0031) num Postgres real.
-- Não é o projeto Supabase: auth.uid() e o role «authenticated» são simulados e as políticas de linha são as de 0004.
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create role authenticated nologin;
create table professionals (user_id uuid primary key, email text);
create table students (
  id text primary key, auth_user_id uuid, invite_email text, name text not null,
  weights jsonb default '[]', weight_current numeric, weight_initial numeric, assessments jsonb default '[]', checkins jsonb default '[]',
  meal_daily_state jsonb, meals_date date, substitution_history jsonb default '[]', adaptation_history jsonb default '[]',
  photos jsonb default '[]', notes text default '', targets jsonb default '{}', updated_at timestamptz default now()
);
alter table students enable row level security;
grant usage on schema auth, public to authenticated;
grant select, update on students to authenticated;
grant select on professionals to authenticated;
create policy "professional full access" on students for all
  using (exists (select 1 from professionals where user_id = auth.uid()))
  with check (exists (select 1 from professionals where user_id = auth.uid()));
create policy "student reads own row" on students for select using (auth_user_id = auth.uid());
create policy "student updates own row" on students for update using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

insert into professionals values ('00000000-0000-0000-0000-0000000000aa', 'pt@example.test');
insert into students (id, auth_user_id, name, weights, weight_current, assessments, checkins) values
  ('s1', '00000000-0000-0000-0000-0000000000b1', 'Aluno Um', '[{"date":"2026-09-01","w":80}]', 80, '[{"date":"2026-09-01","weight":80}]', '[]'),
  ('s2', '00000000-0000-0000-0000-0000000000b2', 'Aluno Dois', '[{"date":"2026-09-02","w":70}]', 70, '[]', '[]');

\i :migrations/0006_append_only_history.sql
\i :migrations/0019_training_program.sql

-- tenta uma instrução como o utilizador dado; devolve «ok N» ou a mensagem de erro
create function run_as(uid text, stmt text) returns text language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', uid, true);
  set local role authenticated;
  execute stmt;
  get diagnostics n = row_count;
  reset role;
  return 'ok ' || n;
exception when others then
  reset role;
  return 'erro: ' || sqlerrm;
end $$;

create temp table res (fase text, caso text, resultado text);
grant all on res to public;
create function cases(fase text) returns void language plpgsql as $$
declare s1 text := '00000000-0000-0000-0000-0000000000b1'; pt text := '00000000-0000-0000-0000-0000000000aa';
begin
  insert into res values
   (fase, 'aluno escreve weights',        run_as(s1, $q$update students set weights = '[{"date":"2026-01-01","w":50}]' where id = 's1'$q$)),
   (fase, 'aluno escreve weight_current', run_as(s1, $q$update students set weight_current = 50 where id = 's1'$q$)),
   (fase, 'aluno escreve assessments',    run_as(s1, $q$update students set assessments = '[]' where id = 's1'$q$)),
   (fase, 'aluno escreve weight_initial', run_as(s1, $q$update students set weight_initial = 50 where id = 's1'$q$)),
   (fase, 'aluno repete weights iguais',  run_as(s1, $q$update students set weights = weights, weight_current = weight_current, updated_at = now() where id = 's1'$q$)),
   (fase, 'aluno regista meal_daily_state', run_as(s1, $q$update students set meal_daily_state = '{"date":"2026-10-01","entries":{}}' where id = 's1'$q$)),
   (fase, 'aluno escreve checkins',       run_as(s1, $q$update students set checkins = '[{"date":"2026-10-01"}]' where id = 's1'$q$)),
   (fase, 'aluno acrescenta adaptation_history', run_as(s1, $q$update students set adaptation_history = adaptation_history || '[{"type":"x","date":"2026-10-01"}]'::jsonb where id = 's1'$q$)),
   (fase, 'aluno acrescenta workout_logs', run_as(s1, $q$update students set workout_logs = workout_logs || '[{"id":"w1","date":"2026-10-01","entries":[]}]'::jsonb where id = 's1'$q$)),
   (fase, 'aluno apaga workout_logs',     run_as(s1, $q$update students set workout_logs = '[]' where id = 's1'$q$)),
   (fase, 'aluno escreve na linha de outro', run_as(s1, $q$update students set weights = '[]' where id = 's2'$q$)),
   (fase, 'profissional escreve weights + weight_current + assessments', run_as(pt, $q$update students set weights = weights || '[{"date":"2026-10-02","w":79}]'::jsonb, weight_current = 79, assessments = assessments || '[{"date":"2026-10-02","weight":79}]'::jsonb where id = 's1'$q$)),
   (fase, 'profissional apaga uma pesagem', run_as(pt, $q$update students set weights = '[]', weight_current = null where id = 's2'$q$));
end $$;

-- antes da 0031 (estado atual em produção)
select cases('antes');
-- repor os dados que os casos «antes» possam ter alterado (o superutilizador não tem auth.uid(): desliga-se o gatilho só para repor)
alter table students disable trigger trg_enforce_student_column_permissions;
update students set weights = '[{"date":"2026-09-01","w":80}]', weight_current = 80, assessments = '[{"date":"2026-09-01","weight":80}]', checkins = '[]', meal_daily_state = null, adaptation_history = '[]', workout_logs = '[]' where id = 's1';
update students set weights = '[{"date":"2026-09-02","w":70}]', weight_current = 70 where id = 's2';
alter table students enable trigger trg_enforce_student_column_permissions;

\i :migrations/0031_weight_professional_only.sql
\i :migrations/0031_weight_professional_only.sql
select cases('depois');
select 'DADOS|' || id || '|' || weights::text || '|' || coalesce(weight_current::text, 'null') || '|' || assessments::text from students order by id;
select 'RES|' || fase || '|' || caso || '|' || resultado from res order by fase desc, caso;
