-- Harness da Corrida (migração 0032) num Postgres REAL, local e descartável. Corre com tests/runs-db.test.js, que compara CADA linha RES| com o esperado.
-- Não é o projeto Supabase: auth.uid(), auth.email() e os papéis «authenticated» e «anon» são simulados (sem GoTrue nem PostgREST); a tabela students
-- e as suas políticas são cópias mínimas de 0002/0004/0007; o gatilho de colunas é o REAL (migrações 0006, 0019 e 0031 do repositório).
-- Variáveis do psql: migrations = pasta com os SQL; old_defaults = 1 simula os direitos por omissão ANTIGOS do Supabase (tudo para anon e
-- authenticated nas tabelas novas), 0 simula os NOVOS (nada: a 0032 tem de dizer o que quer). as_owner = 1 faz tudo (tabelas, migrações, casos) como um dono
-- SEM superutilizador, como o papel «postgres» do Supabase (que não é superutilizador mas tem bypassrls e é membro de authenticated e anon). Os resultados
-- têm de ser iguais em todos os modos.

\set ON_ERROR_STOP on
\encoding UTF8

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
end $$;

create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.email() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.email', true), '') $$;

\if :as_owner
  do $$ begin if not exists (select 1 from pg_roles where rolname = 'sbadmin') then create role sbadmin login createrole createdb bypassrls; end if; end $$;
  grant authenticated, anon to sbadmin;
  grant all on schema public to sbadmin;
  grant usage on schema auth to sbadmin;
  set session authorization sbadmin;
\endif

-- 0004: professionals com RLS (cada um só lê a sua linha)
create table professionals (user_id uuid primary key, email text, created_at timestamptz default now());
alter table professionals enable row level security;
create policy "professional reads own row" on professionals for select using (user_id = auth.uid());

create table students (
  id text primary key, auth_user_id uuid, invite_email text, name text not null,
  weights jsonb default '[]', weight_current numeric, weight_initial numeric, assessments jsonb default '[]', checkins jsonb default '[]',
  meal_daily_state jsonb, meals_date date, substitution_history jsonb default '[]', adaptation_history jsonb default '[]',
  photos jsonb default '[]', notes text default '', targets jsonb default '{}', updated_at timestamptz default now()
);
alter table students enable row level security;
grant usage on schema auth, public to authenticated, anon;
-- os direitos que as tabelas JÁ EXISTENTES têm no Supabase (a mudança de 30/10/2026 só afeta tabelas novas)
grant all on students, professionals to authenticated;
-- 0002/0004/0007: as políticas de students
create policy "professional full access" on students for all
  using (exists (select 1 from professionals where user_id = auth.uid()))
  with check (exists (select 1 from professionals where user_id = auth.uid()));
create policy "student reads own row" on students for select using (auth_user_id = auth.uid());
create policy "student updates own row" on students for update using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
create policy "student claims invited row" on students for update
  using (auth_user_id is null and invite_email = auth.email())
  with check (auth_user_id = auth.uid() and invite_email = auth.email());

insert into professionals values ('00000000-0000-0000-0000-0000000000aa', 'pt@example.test');
-- alunos que já existem ANTES da 0032 (caso j: a migração é segura com linhas)
insert into students (id, auth_user_id, invite_email, name) values
  ('s1',  '00000000-0000-0000-0000-0000000000b1', null, 'Aluno Um'),
  ('s2',  '00000000-0000-0000-0000-0000000000b2', null, 'Aluno Dois'),
  ('s3',  '00000000-0000-0000-0000-0000000000b3', null, 'Aluno Tres'),
  ('spt', '00000000-0000-0000-0000-0000000000aa', null, 'Profissional como aluno'),
  ('su',  null, 'novo@example.test', 'Aluno convidado ainda sem conta'),
  ('sr1', '00000000-0000-0000-0000-0000000000d1', null, 'Corrida de pedidos 1'),
  ('sr2', '00000000-0000-0000-0000-0000000000d2', null, 'Corrida de pedidos 2');

\i :migrations/0006_append_only_history.sql
\i :migrations/0019_training_program.sql
\i :migrations/0031_weight_professional_only.sql
\i :migrations/0008_claim_via_function.sql

\if :old_defaults
  alter default privileges in schema public grant all on tables to anon, authenticated;
\endif

\i :migrations/0032_corrida.sql
\i :migrations/0032_corrida.sql

-- ---------- ferramentas ----------
-- tenta uma instrução como o papel e o utilizador dados; devolve «ok N» ou «erro CÓDIGO [restrição] mensagem»
create function run_as(uid text, stmt text, rl text default 'authenticated', mail text default null) returns text language plpgsql as $$
declare n int; st text; msg text; cons text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  perform set_config('request.jwt.claim.email', coalesce(mail, ''), true);
  execute 'set local role ' || rl;
  execute stmt;
  get diagnostics n = row_count;
  reset role;
  return 'ok ' || n;
exception when others then
  get stacked diagnostics st = returned_sqlstate, msg = message_text, cons = constraint_name;
  reset role;
  return 'erro ' || st || ' [' || coalesce(cons, '-') || '] ' || left(msg, 90);
end $$;

create temp table res (n serial, id text, resultado text);
grant all on res to public;
grant all on res_n_seq to public;
create function t(id text, r text) returns void language sql as $$ insert into res(id, resultado) values (id, r) $$;

-- monta um INSERT como o PostgREST: só as colunas presentes no objeto (as restantes ficam com o valor por omissão)
create function ins(tbl text, obj jsonb) returns text language sql as $$
  select format('insert into %I (%s) select %s from jsonb_populate_record(null::%I, %L::jsonb)', tbl,
    (select string_agg(quote_ident(k), ', ') from jsonb_object_keys(obj) k),
    (select string_agg(quote_ident(k), ', ') from jsonb_object_keys(obj) k), tbl, obj::text) $$;
create function rbase(stu text, uid text) returns jsonb language sql as $$
  select jsonb_build_object('id', gen_random_uuid(), 'student_id', stu, 'started_at', (now() - interval '1 day')::text, 'source', 'gpx',
    'duration_s', 3000, 'moving_s', 2900, 'distance_m', 10000, 'consent_v', 1, 'created_by', uid) $$;
-- n pontos todos iguais, num só segmento, com o tamanho de texto do jsonb
create function pts_n(n int) returns jsonb language sql as $$
  select jsonb_build_array((select jsonb_agg(jsonb_build_array(38.12345, -9.12345, 1000)) from generate_series(1, n))) $$;
create function ms_points(n int) returns int language plpgsql as $$
declare t0 timestamptz; ok boolean; j jsonb;
begin
  j := pts_n(n); t0 := clock_timestamp(); ok := run_points_are_valid(j);
  if not ok then return -1; end if;
  return (extract(epoch from clock_timestamp() - t0) * 1000)::int;
end $$;
create function cnt(q text) returns text language plpgsql as $$ declare r text; begin execute q into r; return r; end $$;

\o /dev/null
-- ============ D. direitos de tabela (e anónimo) ============
select t('D01', cnt($q$select string_agg(t || ':' || p, ',' order by t collate "C", p collate "C") from (values ('run_consents'), ('runs'), ('run_tracks')) a(t),
  (values ('select'), ('insert'), ('delete'), ('update'), ('truncate'), ('references'), ('trigger')) b(p)
  where has_table_privilege('authenticated', t, p)$q$));
select t('D02', cnt($q$select count(*) from (values ('run_consents'), ('runs'), ('run_tracks')) a(t),
  (values ('select'), ('insert'), ('delete'), ('update'), ('truncate'), ('references'), ('trigger')) b(p)
  where has_table_privilege('anon', t, p)$q$));
select t('D03', cnt($q$select count(*) from pg_class c cross join lateral aclexplode(c.relacl) a
  where a.grantee = 0 and c.relname in ('run_consents', 'runs', 'run_tracks')$q$));
select t('D04', run_as(null, 'select * from runs', 'anon'));
select t('D05', run_as(null, 'select * from run_tracks', 'anon'));
select t('D06', run_as(null, 'select * from run_consents', 'anon'));
select t('D07', run_as(null, 'delete from runs', 'anon'));
select t('D08', run_as(null, ins('run_consents', '{"student_id":"s1"}'), 'anon'));
select t('D09', run_as('00000000-0000-0000-0000-0000000000b1', 'truncate runs'));
select t('D10', run_as('00000000-0000-0000-0000-0000000000aa', 'truncate run_tracks'));
select t('D11', cnt($q$select replace(proacl::text, proowner::regrole::text, 'OWNER') from pg_proc where proname = 'run_consent_withdrawn'$q$));
select t('D12', cnt($q$select count(*) from pg_class where relname in ('run_consents', 'runs', 'run_tracks') and relrowsecurity$q$));
select t('D13', cnt($q$select count(*) from pg_class where relname in ('run_consents', 'runs', 'run_tracks') and relforcerowsecurity$q$));

-- ============ J. a migração é segura com alunos que já existiam ============
select t('J01', cnt($q$select count(*) || '/' || count(*) filter (where runs_mode = 'off') from students$q$));
select t('J02', cnt($q$select is_nullable || '|' || column_default from information_schema.columns where table_name = 'students' and column_name = 'runs_mode'$q$));
select t('J03', cnt($q$select pg_get_constraintdef(oid) from pg_constraint where conname = 'students_runs_mode_check'$q$));

-- ============ M. runs_mode: só o profissional (gatilho REAL de 0031) ============
select t('M01', cnt($q$select position('runs_mode' in pg_get_functiondef('enforce_student_column_permissions'::regproc))$q$));
select t('M02', cnt($q$select count(*) from pg_trigger where tgname = 'trg_enforce_student_column_permissions' and tgenabled = 'O'$q$));
select t('M03', run_as('00000000-0000-0000-0000-0000000000b3', $q$update students set runs_mode = 'import' where id = 's3'$q$));
select t('M04', run_as('00000000-0000-0000-0000-0000000000b3', $q$update students set runs_mode = 'live' where id = 's3'$q$));
select t('M05', run_as('00000000-0000-0000-0000-0000000000aa', $q$update students set runs_mode = 'live' where id = 's1'$q$));
select t('M06', run_as('00000000-0000-0000-0000-0000000000aa', $q$update students set runs_mode = 'import' where id = 's2'$q$));
select t('M07', run_as('00000000-0000-0000-0000-0000000000b2', $q$update students set runs_mode = 'off' where id = 's2'$q$));
select t('M08', run_as('00000000-0000-0000-0000-0000000000b2', $q$update students set runs_mode = 'live' where id = 's2'$q$));
select t('M09', run_as('00000000-0000-0000-0000-0000000000b2', $q$update students set runs_mode = 'import' where id = 's2'$q$));
select t('M10', cnt($q$select runs_mode from students where id = 's2'$q$));
select t('M11', run_as('00000000-0000-0000-0000-0000000000b2', $q$update students set runs_mode = 'xpto' where id = 's2'$q$));
select t('M12', run_as('00000000-0000-0000-0000-0000000000b2', $q$update students set runs_mode = default where id = 's2'$q$));
select t('M13', run_as('00000000-0000-0000-0000-0000000000b2', $q$update students set runs_mode = 'live', updated_at = now(), checkins = '[]' where id = 's2'$q$));
select t('M14', run_as('00000000-0000-0000-0000-0000000000aa', $q$update students set runs_mode = 'xpto' where id = 's3'$q$));
select t('M15', run_as('00000000-0000-0000-0000-0000000000aa', $q$update students set runs_mode = null where id = 's3'$q$));
select t('M16', run_as('00000000-0000-0000-0000-0000000000b2', $q$select runs_mode from students where id = 's1'$q$));
select t('M17', run_as('00000000-0000-0000-0000-0000000000b2', $q$select runs_mode from students where id = 's2'$q$));
-- convite ainda por reclamar: por UPDATE direto a linha nem é visível ao utilizador (a política de leitura só mostra a sua), por isso não há como mexer em runs_mode;
-- pela função claim_student_row (0008) só se escreve auth_user_id, e depois já é um aluno comum
select t('M18', run_as('00000000-0000-0000-0000-0000000000c1', $q$update students set auth_user_id = '00000000-0000-0000-0000-0000000000c1', runs_mode = 'live' where id = 'su'$q$, 'authenticated', 'novo@example.test'));
select t('M19', run_as('00000000-0000-0000-0000-0000000000c1', $q$select claim_student_row()$q$, 'authenticated', 'novo@example.test'));
select t('M20', cnt($q$select auth_user_id || '/' || runs_mode from students where id = 'su'$q$));
select t('M20b', run_as('00000000-0000-0000-0000-0000000000c1', $q$update students set runs_mode = 'import' where id = 'su'$q$, 'authenticated', 'novo@example.test'));
select t('M21', run_as('00000000-0000-0000-0000-0000000000b3', $q$insert into students (id, name, runs_mode) values ('sx', 'Falso', 'live')$q$));
select t('M22', run_as('00000000-0000-0000-0000-0000000000b3', $q$delete from students where id = 's3'$q$));
select t('M23', cnt($q$select string_agg(id || '=' || runs_mode, ',' order by id) from students$q$));

-- ============ C. consentimento ============
select t('C01', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', (rbase('s1', '00000000-0000-0000-0000-0000000000b1') || '{"source":"live"}'))));
select t('C02', run_as('00000000-0000-0000-0000-0000000000b1', ins('run_consents', '{"student_id":"s1","version":1,"accepted_at":"2001-01-01T00:00:00Z"}')));
select t('C03', cnt($q$select (abs(extract(epoch from now() - accepted_at)) < 120)::text from run_consents where student_id = 's1'$q$));
select t('C04', run_as('00000000-0000-0000-0000-0000000000b1', ins('run_consents', '{"student_id":"s2"}')));
select t('C05', run_as('00000000-0000-0000-0000-0000000000aa', ins('run_consents', '{"student_id":"s2"}')));
select t('C06', run_as('00000000-0000-0000-0000-0000000000b2', ins('run_consents', '{"student_id":"s2"}')));
select t('C07', run_as('00000000-0000-0000-0000-0000000000b2', ins('run_consents', '{"student_id":"s2","version":2}')));
select t('C08', run_as('00000000-0000-0000-0000-0000000000b2', ins('run_consents', '{"student_id":"s2","version":2}')));
select t('C09', run_as('00000000-0000-0000-0000-0000000000b3', ins('run_consents', '{"student_id":"s3","version":0}')));
select t('C10', run_as('00000000-0000-0000-0000-0000000000b3', ins('run_consents', '{"student_id":"s3"}')));
select t('C11', run_as('00000000-0000-0000-0000-0000000000b1', 'select * from run_consents'));
select t('C12', run_as('00000000-0000-0000-0000-0000000000b2', 'select * from run_consents'));
select t('C13', run_as('00000000-0000-0000-0000-0000000000b2', $q$select * from run_consents where student_id = 's1'$q$));
select t('C14', run_as('00000000-0000-0000-0000-0000000000aa', 'select * from run_consents'));
select t('C15', run_as(null, 'select * from run_consents'));
select t('C16', run_as('00000000-0000-0000-0000-0000000000b1', 'update run_consents set version = 9'));
select t('C17', run_as('00000000-0000-0000-0000-0000000000aa', 'update run_consents set version = 9'));
select t('C18', run_as('00000000-0000-0000-0000-0000000000aa', 'delete from run_consents'));
select t('C19', run_as('00000000-0000-0000-0000-0000000000b2', $q$delete from run_consents where student_id = 's1'$q$));
select t('C20', run_as('00000000-0000-0000-0000-0000000000b1', ins('run_consents', '{"student_id":"s1","version":1}')));

-- ============ R. criar corridas: quem, onde e em que modo ============
select t('R01', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', '00000000-0000-0000-0000-0000000000b1') || '{"id":"11111111-1111-1111-1111-111111111111"}')));
select t('R02', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', '00000000-0000-0000-0000-0000000000b1') || '{"id":"11111111-1111-1111-1111-111111111111"}')));
select t('R03', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s2', '00000000-0000-0000-0000-0000000000b1'))));
select t('R04', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', '00000000-0000-0000-0000-0000000000b2'))));
select t('R05', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by')));
select t('R06', run_as('00000000-0000-0000-0000-0000000000b2', ins('runs', rbase('s2', 'x') - 'created_by' || '{"source":"live"}')));
select t('R07', run_as('00000000-0000-0000-0000-0000000000b2', ins('runs', rbase('s2', 'x') - 'created_by' || '{"source":"native"}')));
select t('R08', run_as('00000000-0000-0000-0000-0000000000b2', ins('runs', rbase('s2', 'x') - 'created_by' || '{"source":"tcx","id":"22222222-2222-2222-2222-222222222222"}')));
select t('R09', run_as('00000000-0000-0000-0000-0000000000b2', ins('runs', rbase('s2', 'x') - 'created_by' || '{"source":"fit"}')));
select t('R10', run_as('00000000-0000-0000-0000-0000000000b2', ins('runs', rbase('s2', 'x') - 'created_by' || '{"source":"manual"}')));
select t('R11', run_as('00000000-0000-0000-0000-0000000000b2', ins('runs', rbase('s2', 'x') - 'created_by' || '{"source":"strava"}')));
select t('R12', run_as('00000000-0000-0000-0000-0000000000b3', ins('runs', rbase('s3', 'x') - 'created_by' || '{"source":"manual"}')));
select t('R13', run_as(null, ins('runs', rbase('s1', '00000000-0000-0000-0000-0000000000b1'))));
select t('R14', run_as(null, ins('runs', rbase('s1', '00000000-0000-0000-0000-0000000000b1')), 'anon'));
select t('R15', run_as('00000000-0000-0000-0000-0000000000aa', ins('runs', rbase('s1', '00000000-0000-0000-0000-0000000000aa'))));
select t('R16', run_as('00000000-0000-0000-0000-0000000000b2', ins('runs', rbase('s2', 'x') - 'created_by' || '{"consent_v":3}')));
select t('R17', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"consent_v":2}')));
select t('R18', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"consent_v":0}')));
-- o consentimento da versão 2 só existe para s2: o mesmo consent_v que passa para s2 não passa para s1
select t('R20', run_as('00000000-0000-0000-0000-0000000000b2', ins('runs', rbase('s2', 'x') - 'created_by' || '{"consent_v":2}')));
-- a chave estrangeira apanha o que a política não apanharia (quem passa por cima da RLS)
select t('R21', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', '00000000-0000-0000-0000-0000000000b1') || '{"consent_v":7}'), session_user::text));
select t('R22', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', jsonb_build_object('id', gen_random_uuid(), 'student_id', 's1', 'started_at', (now() - interval '1 day')::text, 'source', 'live',
  'duration_s', 1800, 'moving_s', 1700, 'distance_m', 5000, 'gaps', 2, 'gap_s', 220, 'hidden_s', 95, 'splits_s', '[360,355,350,352,348]'::jsonb, 'rpe', 6, 'notes', 'ok', 'consent_v', 1))));
select t('R23', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into runs (student_id, started_at, source, duration_s, moving_s, distance_m, consent_v, splits_s, rpe, notes)
  select 's1', now() - interval '2 days', 'gpx', 3000, 2900, 10000, 1, null, null, null$q$));
select t('R24', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"created_at":"2001-01-01T00:00:00Z","splits_s":null,"rpe":null,"notes":null}')));
select t('R25', cnt($q$select count(*) from runs where created_at < now() - interval '1 hour'$q$));
-- o profissional também é aluno («Eu»): vale a regra de aluno, só na SUA ficha
select t('R26', run_as('00000000-0000-0000-0000-0000000000aa', ins('runs', rbase('spt', '00000000-0000-0000-0000-0000000000aa'))));
select t('R27', run_as('00000000-0000-0000-0000-0000000000aa', $q$update students set runs_mode = 'import' where id = 'spt'$q$));
select t('R28', run_as('00000000-0000-0000-0000-0000000000aa', ins('run_consents', '{"student_id":"spt"}')));
select t('R29', run_as('00000000-0000-0000-0000-0000000000aa', ins('runs', rbase('spt', '00000000-0000-0000-0000-0000000000aa'))));
select t('R30', run_as('00000000-0000-0000-0000-0000000000aa', ins('runs', rbase('s2', '00000000-0000-0000-0000-0000000000aa'))));
-- upsert: o que o projeto já descobriu (app.js, gravar como aluno) vale aqui; «ignorar duplicados» não precisa de update
select t('R31', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into runs (id, student_id, started_at, source, duration_s, moving_s, distance_m, consent_v)
  values ('11111111-1111-1111-1111-111111111111', 's1', now(), 'gpx', 600, 600, 1500, 1) on conflict (id) do update set distance_m = 1$q$));
select t('R32', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into runs (id, student_id, started_at, source, duration_s, moving_s, distance_m, consent_v)
  values ('11111111-1111-1111-1111-111111111111', 's1', now(), 'gpx', 600, 600, 1500, 1) on conflict (id) do nothing$q$));
select t('R33', cnt($q$select distance_m from runs where id = '11111111-1111-1111-1111-111111111111'$q$));

-- ============ K. valores fora dos limites (todos com um aluno e uma ficha válidos, para que seja o CHECK a falar) ============
-- aceites no limite
select t('K01', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"duration_s":86400,"moving_s":86400,"distance_m":300000}')));
select t('K02', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"duration_s":1000,"moving_s":1000,"distance_m":12000}')));
select t('K03', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"started_at":"2000-01-01T00:00:00Z"}')));
select t('K04', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || jsonb_build_object('started_at', (now() + interval '1 day')::text))));
select t('K05', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || jsonb_build_object('notes', repeat(chr(227), 300)))));
select t('K06', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"rpe":1,"gaps":1000,"gap_s":86400,"hidden_s":86400}')));
select t('K07', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"rpe":10}')));
-- recusadas
select t('K10', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"duration_s":0,"moving_s":0}')));
select t('K11', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"duration_s":86401,"moving_s":100}')));
select t('K12', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"moving_s":-1}')));
select t('K13', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"duration_s":100,"moving_s":101,"distance_m":100}')));
select t('K14', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"distance_m":-1}')));
select t('K15', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"duration_s":86400,"moving_s":86400,"distance_m":300001}')));
select t('K16', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"duration_s":1000,"moving_s":1000,"distance_m":12001}')));
select t('K17', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"duration_s":100,"moving_s":100,"distance_m":600000}')));
select t('K18', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"started_at":"1999-12-31T23:59:59Z"}')));
select t('K19', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || jsonb_build_object('started_at', (now() + interval '3 days')::text))));
select t('K20', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || jsonb_build_object('notes', repeat(chr(227), 301)))));
select t('K21', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"rpe":0}')));
select t('K22', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"rpe":11}')));
select t('K23', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"gaps":1001}')));
select t('K24', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"gap_s":86401}')));
select t('K25', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"hidden_s":-1}')));
select t('K26', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"hidden_s":86401}')));
select t('K27', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"source":"strava"}')));
-- parciais
select t('K30', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || jsonb_build_object('splits_s', (select jsonb_agg(300) from generate_series(1, 300))))));
select t('K31', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || jsonb_build_object('splits_s', (select jsonb_agg(300) from generate_series(1, 301))))));
select t('K32', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"splits_s":{"a":1}}')));
select t('K33', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"splits_s":["360","355"]}')));
select t('K34', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"splits_s":[360,-1]}')));
select t('K35', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"splits_s":[360,86401]}')));
select t('K36', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"splits_s":[360,null]}')));
select t('K37', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"splits_s":[360,[1]]}')));
select t('K38', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"splits_s":[1e400]}')));
select t('K39', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || jsonb_build_object('splits_s', jsonb_build_array(repeat('x', 100000))))));
select t('K40', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"splits_s":[]}')));
select t('K41', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', 'x') - 'created_by' || '{"splits_s":[360.5,0,86400]}')));

-- ============ L. leitura e isolamento das corridas ============
select t('L01', case when run_as('00000000-0000-0000-0000-0000000000b1', 'select * from runs') = 'ok ' || (select count(*) from runs where student_id = 's1')
  then 'só as dele (' || (select count(*) from runs where student_id = 's1') || ')' else 'DIFERENTE' end);
select t('L02', run_as('00000000-0000-0000-0000-0000000000b1', $q$select * from runs where student_id <> 's1'$q$));
select t('L03', run_as('00000000-0000-0000-0000-0000000000b2', $q$select * from runs where student_id = 's1'$q$));
select t('L04', run_as('00000000-0000-0000-0000-0000000000b3', 'select * from runs'));
select t('L05', run_as(null, 'select * from runs'));
select t('L06', case when run_as('00000000-0000-0000-0000-0000000000aa', 'select * from runs') = 'ok ' || (select count(*) from runs)
  then 'todas (' || (select count(*) from runs) || ')' else 'DIFERENTE' end);
select t('L07', cnt($q$select count(distinct student_id) from runs$q$));
select t('L08', run_as('00000000-0000-0000-0000-0000000000b1', 'update runs set distance_m = 9999'));
select t('L09', run_as('00000000-0000-0000-0000-0000000000aa', $q$update runs set notes = 'pt'$q$));
select t('L10', run_as('00000000-0000-0000-0000-0000000000b2', $q$update runs set student_id = 's2' where student_id = 's1'$q$));

-- ============ T. percursos ============
-- uma corrida de s1 que fica SEM percurso (para a chave estrangeira composta e para os casos do profissional)
insert into runs (id, student_id, created_by, started_at, source, duration_s, moving_s, distance_m, consent_v)
  values ('33333333-3333-3333-3333-333333333333', 's1', '00000000-0000-0000-0000-0000000000b1', now() - interval '3 days', 'gpx', 600, 600, 1500, 1);
select t('T01', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, trim_m, points) values
  ('11111111-1111-1111-1111-111111111111', 's1', 200, '[[[38.7,-9.1,0],[38.71,-9.11,60]]]')$q$));
select t('T02', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, points) values ('11111111-1111-1111-1111-111111111111', 's1', '[[[38.7,-9.1,0]]]')$q$));
select t('T02b', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's1', '[[[1,1,0]]]')$q$));
select t('T02c', run_as('00000000-0000-0000-0000-0000000000b1', $q$delete from run_tracks where run_id = '33333333-3333-3333-3333-333333333333'$q$));
select t('T03', run_as('00000000-0000-0000-0000-0000000000b2', $q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's2', '[[[1,1,0]]]')$q$));
select t('T04', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, points) values ('22222222-2222-2222-2222-222222222222', 's2', '[[[1,1,0]]]')$q$));
select t('T05', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, points) values ('22222222-2222-2222-2222-222222222222', 's1', '[[[1,1,0]]]')$q$));
select t('T06', run_as('00000000-0000-0000-0000-0000000000b2', $q$insert into run_tracks (run_id, student_id, trim_m, fmt, points) values ('22222222-2222-2222-2222-222222222222', 's2', 0, 1, '[[[38.7,-9.1,0],[38.71,-9.11,60]]]')$q$));
select t('T07', run_as('00000000-0000-0000-0000-0000000000aa', $q$insert into run_tracks (run_id, student_id, points) values ('11111111-1111-1111-1111-111111111111', 's1', '[[[1,1,0]]]')$q$));
select t('T08', run_as('00000000-0000-0000-0000-0000000000b1', format($q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's1', %L)$q$,
  (select jsonb_agg('[[1,1,0]]'::jsonb) from generate_series(1, 201))::text)));
select t('T09', run_as('00000000-0000-0000-0000-0000000000b1', format($q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's1', %L)$q$,
  (select jsonb_agg('[[1,1,0]]'::jsonb) from generate_series(1, 200))::text)));
select t('T10', run_as('00000000-0000-0000-0000-0000000000b1', $q$delete from run_tracks where run_id = '33333333-3333-3333-3333-333333333333'$q$));
select t('T11', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's1', '[]')$q$));
select t('T12', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's1', '{"a":1}')$q$));
select t('T13', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's1', 'null')$q$));
-- tamanho: o maior percurso que cabe em 200000 bytes de texto entra, mais um ponto já não
create temp table tnmax as select max(g) as n from generate_series(7100, 7200) g where octet_length(pts_n(g)::text) <= 200000;
select t('T14', cnt($q$select n from tnmax$q$));
select t('T15', cnt($q$select octet_length(pts_n((select n from tnmax))::text) || '<=200000<' || octet_length(pts_n(1 + (select n from tnmax))::text)$q$));
select t('T16', run_as('00000000-0000-0000-0000-0000000000b1', format($q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's1', %L)$q$,
  pts_n((select n from tnmax))::text)));
select t('T17', run_as('00000000-0000-0000-0000-0000000000b1', $q$delete from run_tracks where run_id = '33333333-3333-3333-3333-333333333333'$q$));
select t('T18', run_as('00000000-0000-0000-0000-0000000000b1', format($q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's1', %L)$q$,
  pts_n(1 + (select n from tnmax))::text)));
select t('T19', run_as('00000000-0000-0000-0000-0000000000b1', format($q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's1', %L)$q$,
  jsonb_build_array(jsonb_build_array(jsonb_build_array(1, 1, 0, repeat('x', 300000))))::text)));
-- forma
select t('T20', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's1', '[[1,2]]')$q$));
select t('T21', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's1', '[[[1,2]]]')$q$));
select t('T22', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's1', '[[[1,2,3,4]]]')$q$));
select t('T23', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's1', '[[["38.7","-9.1","0"]]]')$q$));
select t('T24', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's1', '[[["<img src=x onerror=alert(1)>",-9.1,0]]]')$q$));
select t('T25', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's1', '[[[null,-9.1,0]]]')$q$));
select t('T26', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's1', '[[{"lat":1,"lon":2,"t":3}]]')$q$));
select t('T27', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's1', '[[]]')$q$));
select t('T28', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's1', '[[[91,0,0]]]')$q$));
select t('T29', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's1', '[[[-91,0,0]]]')$q$));
select t('T30', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's1', '[[[0,181,0]]]')$q$));
select t('T31', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's1', '[[[0,-181,0]]]')$q$));
select t('T32', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's1', '[[[0,0,-1]]]')$q$));
select t('T33', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's1', '[[[0,0,2592001]]]')$q$));
select t('T34', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's1', '[[[1e400,0,0]]]')$q$));
select t('T35', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, trim_m, points) values ('33333333-3333-3333-3333-333333333333', 's1', 2001, '[[[1,1,0]]]')$q$));
select t('T36', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, trim_m, points) values ('33333333-3333-3333-3333-333333333333', 's1', -1, '[[[1,1,0]]]')$q$));
select t('T37', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, fmt, points) values ('33333333-3333-3333-3333-333333333333', 's1', 2, '[[[1,1,0]]]')$q$));
select t('T38', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, points) values ('33333333-3333-3333-3333-333333333333', 's1', '[[[90,180,2592000],[-90,-180,0],[38.12345,-9.12345,3600.5]],[[0,0,0]]]')$q$));
select t('T39', run_as('00000000-0000-0000-0000-0000000000b1', $q$delete from run_tracks where run_id = '33333333-3333-3333-3333-333333333333'$q$));
-- tempo: o maior percurso válido entra depressa (a validação percorre todos os pontos)
select t('T40', (select case when ms < 0 then 'INVÁLIDO' when ms < 1500 then 'rápido ms=' || ms else 'LENTO ms=' || ms end from (select ms_points(7142) as ms) y));

-- ============ V. leitura de percursos e o que o profissional vê ============
select t('V01', run_as('00000000-0000-0000-0000-0000000000b1', 'select * from run_tracks'));
select t('V02', run_as('00000000-0000-0000-0000-0000000000b2', 'select * from run_tracks'));
select t('V03', run_as('00000000-0000-0000-0000-0000000000b3', 'select * from run_tracks'));
select t('V04', run_as(null, 'select * from run_tracks'));
select t('V05', run_as('00000000-0000-0000-0000-0000000000aa', 'select * from run_tracks'));
-- a corrida 3333 existe e não tem percurso: o profissional vê a corrida e não vê percurso nenhum dela
select t('V06', run_as('00000000-0000-0000-0000-0000000000aa', $q$select * from runs where id = '33333333-3333-3333-3333-333333333333'$q$));
select t('V07', run_as('00000000-0000-0000-0000-0000000000aa', $q$select * from run_tracks where run_id = '33333333-3333-3333-3333-333333333333'$q$));
select t('V08', run_as('00000000-0000-0000-0000-0000000000aa', $q$select r.id from runs r join run_tracks k on k.run_id = r.id$q$));
select t('V09', run_as('00000000-0000-0000-0000-0000000000b1', 'update run_tracks set trim_m = 0'));
select t('V10', run_as('00000000-0000-0000-0000-0000000000aa', 'update run_tracks set trim_m = 0'));
select t('V11', run_as('00000000-0000-0000-0000-0000000000b2', 'delete from run_tracks where student_id = ''s1'''));
select t('V12', cnt($q$select count(*) from run_tracks$q$));

-- ============ U. com o direito de UPDATE concedido, continua a não haver política (0 linhas) ============
grant update on runs, run_tracks, run_consents to authenticated;
select t('U01', run_as('00000000-0000-0000-0000-0000000000b1', $q$update runs set distance_m = 9999 where student_id = 's1'$q$));
select t('U02', run_as('00000000-0000-0000-0000-0000000000aa', $q$update runs set notes = 'pt'$q$));
select t('U03', run_as('00000000-0000-0000-0000-0000000000b1', $q$update run_tracks set trim_m = 5$q$));
select t('U04', run_as('00000000-0000-0000-0000-0000000000aa', $q$update run_tracks set trim_m = 5$q$));
select t('U05', run_as('00000000-0000-0000-0000-0000000000b1', $q$update run_consents set version = 9$q$));
select t('U06', run_as('00000000-0000-0000-0000-0000000000aa', $q$update run_consents set version = 9$q$));
revoke update on runs, run_tracks, run_consents from authenticated;
select t('U07', run_as('00000000-0000-0000-0000-0000000000b1', $q$update runs set distance_m = 9999$q$));
-- defesa em profundidade: se alguém acrescentar POR ENGANO uma política de update permissiva, o direito de tabela (retirado) falha primeiro
create policy "teste: update por engano" on runs for update using (true) with check (true);
create policy "teste: update por engano" on run_tracks for update using (true) with check (true);
create policy "teste: update por engano" on run_consents for update using (true) with check (true);
select t('U08', run_as('00000000-0000-0000-0000-0000000000b1', $q$update runs set distance_m = 9999$q$));
select t('U09', run_as('00000000-0000-0000-0000-0000000000b1', $q$update run_tracks set trim_m = 5$q$));
select t('U10', run_as('00000000-0000-0000-0000-0000000000b1', $q$update run_consents set version = 9$q$));
select t('U11', run_as('00000000-0000-0000-0000-0000000000aa', $q$update runs set notes = 'pt'$q$));
drop policy "teste: update por engano" on runs;
drop policy "teste: update por engano" on run_tracks;
drop policy "teste: update por engano" on run_consents;

-- ============ X. apagar ============
select t('X01', run_as('00000000-0000-0000-0000-0000000000b2', $q$delete from runs where student_id = 's1'$q$));
select t('X02', run_as(null, $q$delete from runs$q$));
select t('X03', run_as('00000000-0000-0000-0000-0000000000b3', $q$delete from runs$q$));
-- o profissional apaga uma corrida com percurso: o percurso vai por cascata
select t('X04', cnt($q$select count(*) from run_tracks where run_id = '11111111-1111-1111-1111-111111111111'$q$));
select t('X05', run_as('00000000-0000-0000-0000-0000000000aa', $q$delete from runs where id = '11111111-1111-1111-1111-111111111111'$q$));
select t('X06', cnt($q$select count(*) from run_tracks where run_id = '11111111-1111-1111-1111-111111111111'$q$));
-- o aluno apaga uma corrida com percurso SEM ter direito de delete em run_tracks: a cascata não depende dos direitos de quem apaga
insert into run_tracks (run_id, student_id, points) values ('22222222-2222-2222-2222-222222222222', 's2', '[[[1,1,0]]]') on conflict do nothing;
revoke delete on run_tracks from authenticated;
select t('X07', run_as('00000000-0000-0000-0000-0000000000b2', $q$delete from runs where id = '22222222-2222-2222-2222-222222222222'$q$));
select t('X08', cnt($q$select count(*) from run_tracks where run_id = '22222222-2222-2222-2222-222222222222'$q$));
grant delete on run_tracks to authenticated;
-- só o percurso: a corrida fica
insert into runs (id, student_id, created_by, started_at, source, duration_s, moving_s, distance_m, consent_v)
  values ('44444444-4444-4444-4444-444444444444', 's1', '00000000-0000-0000-0000-0000000000b1', now() - interval '4 days', 'gpx', 600, 600, 1500, 1);
insert into run_tracks (run_id, student_id, points) values ('44444444-4444-4444-4444-444444444444', 's1', '[[[1,1,0]]]');
select t('X09', run_as('00000000-0000-0000-0000-0000000000b1', $q$delete from run_tracks where run_id = '44444444-4444-4444-4444-444444444444'$q$));
select t('X10', cnt($q$select count(*) from runs where id = '44444444-4444-4444-4444-444444444444'$q$));
-- o profissional apaga um percurso
insert into run_tracks (run_id, student_id, points) values ('44444444-4444-4444-4444-444444444444', 's1', '[[[1,1,0]]]');
select t('X11', run_as('00000000-0000-0000-0000-0000000000aa', $q$delete from run_tracks where run_id = '44444444-4444-4444-4444-444444444444'$q$));
-- com a Corrida desligada, o aluno ainda lê e apaga o que tem (mas já não cria)
select t('X12', run_as('00000000-0000-0000-0000-0000000000aa', $q$update students set runs_mode = 'off' where id = 's1'$q$));
select t('X13', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', '00000000-0000-0000-0000-0000000000b1'))));
select t('X14', run_as('00000000-0000-0000-0000-0000000000b1', $q$select * from runs where id = '44444444-4444-4444-4444-444444444444'$q$));
-- reenvio parcial: a corrida entrou com o modo ligado, o modo desliga-se, o percurso ainda entra
select t('X15', run_as('00000000-0000-0000-0000-0000000000b1', $q$insert into run_tracks (run_id, student_id, points) values ('44444444-4444-4444-4444-444444444444', 's1', '[[[2,2,0]]]')$q$));
select t('X16', run_as('00000000-0000-0000-0000-0000000000b1', $q$delete from runs where id = '44444444-4444-4444-4444-444444444444'$q$));
select t('X17', cnt($q$select count(*) from run_tracks where run_id = '44444444-4444-4444-4444-444444444444'$q$));
select t('X18', run_as('00000000-0000-0000-0000-0000000000aa', $q$update students set runs_mode = 'live' where id = 's1'$q$));

-- ============ W. retirar o consentimento = apagar tudo ============
-- s1: 2 corridas com percurso e uma sem; retira o consentimento
insert into runs (id, student_id, created_by, started_at, source, duration_s, moving_s, distance_m, consent_v)
  values ('55555555-5555-5555-5555-555555555555', 's1', '00000000-0000-0000-0000-0000000000b1', now() - interval '5 days', 'gpx', 600, 600, 1500, 1);
insert into run_tracks (run_id, student_id, points) values ('55555555-5555-5555-5555-555555555555', 's1', '[[[1,1,0]]]');
select t('W01', cnt($q$select (select count(*) from runs where student_id = 's1') || '/' || (select count(*) from run_tracks where student_id = 's1') || '/' || (select count(*) from run_consents where student_id = 's1')$q$));
select t('W02', cnt($q$select count(*) from runs where student_id = 's2'$q$));
select t('W03', run_as('00000000-0000-0000-0000-0000000000b1', $q$delete from run_consents where student_id = 's1'$q$));
select t('W04', cnt($q$select (select count(*) from runs where student_id = 's1') || '/' || (select count(*) from run_tracks where student_id = 's1') || '/' || (select count(*) from run_consents where student_id = 's1')$q$));
select t('W05', run_as('00000000-0000-0000-0000-0000000000b1', ins('runs', rbase('s1', '00000000-0000-0000-0000-0000000000b1'))));
-- as corridas dos outros alunos ficam
select t('W06', cnt($q$select count(*) from runs where student_id = 's2'$q$));
-- s2 tem 2 versões e corridas de ambas: apagar SÓ uma linha apaga tudo (regra estrita)
select t('W07', run_as('00000000-0000-0000-0000-0000000000b2', ins('runs', rbase('s2', 'x') - 'created_by' || '{"consent_v":2,"source":"gpx"}')));
select t('W08', run_as('00000000-0000-0000-0000-0000000000b2', ins('runs', rbase('s2', 'x') - 'created_by' || '{"consent_v":1,"source":"gpx"}')));
select t('W09', cnt($q$select count(*) || '/' || count(*) filter (where consent_v = 1) from runs where student_id = 's2'$q$));
select t('W10', run_as('00000000-0000-0000-0000-0000000000b2', $q$delete from run_consents where student_id = 's2' and version = 2$q$));
select t('W11', cnt($q$select (select count(*) from runs where student_id = 's2') || '/' || (select count(*) from run_consents where student_id = 's2')$q$));
-- a retirada apaga mesmo sem o aluno ter direito nem política de delete em runs (gatilho SECURITY DEFINER)
select t('W12', run_as('00000000-0000-0000-0000-0000000000b2', ins('runs', rbase('s2', 'x') - 'created_by' || '{"source":"gpx"}')));
select t('W13', run_as('00000000-0000-0000-0000-0000000000b2', ins('run_consents', '{"student_id":"s2","version":2}')));
select t('W14', run_as('00000000-0000-0000-0000-0000000000b2', ins('runs', rbase('s2', 'x') - 'created_by' || '{"consent_v":2,"source":"gpx"}')));
revoke delete on runs from authenticated;
drop policy "student deletes own runs" on runs;
select t('W15', run_as('00000000-0000-0000-0000-0000000000b2', $q$delete from runs where student_id = 's2'$q$));
select t('W16', cnt($q$select count(*) from runs where student_id = 's2'$q$));
select t('W17', run_as('00000000-0000-0000-0000-0000000000b2', $q$delete from run_consents where student_id = 's2'$q$));
select t('W18', cnt($q$select (select count(*) from runs where student_id = 's2') || '/' || (select count(*) from run_consents where student_id = 's2')$q$));
-- (repõe o que se tirou para os casos seguintes; a 0032 volta a pô-lo, como no caso I01)
\i :migrations/0032_corrida.sql
-- profissional não consegue apagar consentimentos (sem política): o aluno pode, ninguém por ele
select t('W22', cnt($q$select has_table_privilege('authenticated', 'runs', 'delete') || '/' || (select count(*) from pg_policies where tablename = 'runs')$q$));
select t('W19', run_as('00000000-0000-0000-0000-0000000000b2', ins('run_consents', '{"student_id":"s2"}')));
select t('W20', run_as('00000000-0000-0000-0000-0000000000aa', $q$delete from run_consents where student_id = 's2'$q$));
select t('W21', cnt($q$select count(*) from run_consents where student_id = 's2'$q$));

-- ============ Z. apagar o aluno leva tudo ============
select t('Z01', run_as('00000000-0000-0000-0000-0000000000b2', ins('runs', rbase('s2', 'x') - 'created_by' || '{"source":"gpx","id":"66666666-6666-6666-6666-666666666666"}')));
select t('Z02', run_as('00000000-0000-0000-0000-0000000000b2', $q$insert into run_tracks (run_id, student_id, points) values ('66666666-6666-6666-6666-666666666666', 's2', '[[[1,1,0]]]')$q$));
select t('Z03', cnt($q$select (select count(*) from runs where student_id = 's2') || '/' || (select count(*) from run_tracks where student_id = 's2') || '/' || (select count(*) from run_consents where student_id = 's2')$q$));
select t('Z04', run_as('00000000-0000-0000-0000-0000000000b2', $q$delete from students where id = 's2'$q$));
select t('Z05', run_as('00000000-0000-0000-0000-0000000000aa', $q$delete from students where id = 's2'$q$));
select t('Z06', cnt($q$select (select count(*) from runs where student_id = 's2') || '/' || (select count(*) from run_tracks where student_id = 's2') || '/' || (select count(*) from run_consents where student_id = 's2')$q$));

-- ============ I. a migração a correr outra vez, com dados lá dentro ============
select t('I01', cnt($q$select (select count(*) from runs) || '/' || (select count(*) from run_tracks) || '/' || (select count(*) from run_consents) || '/' || (select count(*) from students)$q$));
\i :migrations/0032_corrida.sql
select t('I02', cnt($q$select (select count(*) from runs) || '/' || (select count(*) from run_tracks) || '/' || (select count(*) from run_consents) || '/' || (select count(*) from students)$q$));
select t('I03', cnt($q$select string_agg(tablename || '=' || c, ',' order by tablename collate "C") from (select tablename, count(*) c from pg_policies where tablename in ('run_consents', 'runs', 'run_tracks') group by tablename) x$q$));
select t('I04', cnt($q$select string_agg(tgname, ',' order by tgname) from pg_trigger where tgrelid in ('run_consents'::regclass, 'runs'::regclass, 'run_tracks'::regclass) and not tgisinternal$q$));
select t('I05', cnt($q$select count(*) from pg_constraint where conname in ('runs_consent_fk', 'run_tracks_points_valid', 'runs_speed_plausible', 'runs_moving_le_duration', 'students_runs_mode_check')$q$));
select t('I06', cnt($q$select count(*) from pg_proc where proname in ('run_splits_are_valid', 'run_points_are_valid', 'run_consent_withdrawn', 'run_stamp_server_time')$q$));

-- ============ fixtures para os testes de pedidos em simultâneo (feitos pelo tests/runs-db.test.js em duas sessões) ============
select t('Y01', run_as('00000000-0000-0000-0000-0000000000aa', $q$update students set runs_mode = 'live' where id in ('sr1', 'sr2')$q$));
select t('Y02', run_as('00000000-0000-0000-0000-0000000000d1', ins('run_consents', '{"student_id":"sr1"}')));
select t('Y03', run_as('00000000-0000-0000-0000-0000000000d2', ins('run_consents', '{"student_id":"sr2"}')));
select t('Y04', run_as('00000000-0000-0000-0000-0000000000d2', ins('runs', rbase('sr2', 'x') - 'created_by' || '{"id":"77777777-7777-7777-7777-777777777777"}')));

\o
select 'RES|' || id || '|' || coalesce(resultado, 'NULL') from res order by n;
