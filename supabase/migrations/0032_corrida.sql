-- EVOLVE — Corrida: corridas do aluno (importadas de GPX/TCX, registadas à mão ou gravadas com GPS e a app aberta)
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0031 já terem corrido. É seguro voltar a correr
-- (só cria o que falta e volta a pôr políticas, gatilhos e direitos no estado certo; não apaga nem altera dados).
--
-- Modelo:
--   * students.runs_mode  — o profissional liga a Corrida aluno a aluno: 'off' (escondida, por omissão) | 'import' (importar / à mão) | 'live' (também gravar com GPS).
--                           Só o profissional a altera: o gatilho do aluno (0006/0019/0031) só deixa o aluno escrever uma lista fixa de colunas
--                           e esta não está lá (nem tem de estar: não é preciso recriar a função).
--   * run_consents        — o aluno aceitou o aviso de privacidade da Corrida (versão e data; uma linha por versão aceite).
--                           A data é posta pelo servidor. Apagar uma linha (retirar o consentimento) apaga TODAS as corridas e percursos desse aluno.
--   * runs                — o resumo de cada corrida (números; sem coordenadas). Leve: é só isto que as listas leem.
--                           consent_v é a versão do aviso que o aluno aceitou ao guardar e TEM de existir em run_consents (chave estrangeira).
--   * run_tracks          — o percurso, já aparado e simplificado no telemóvel. SÓ existe se o aluno escolheu partilhá-lo com o profissional:
--                           uma linha aqui = percurso partilhado. Sem linha = o percurso nunca saiu do telemóvel.
--   * Aluno: lê, cria e APAGA as suas linhas. Ninguém faz UPDATE (para corrigir apaga-se e grava-se outra).
--   * Profissional: lê e apaga. Não cria nem altera (importar em nome do aluno exigiria uma regra de consentimento própria: fora desta versão).
--   * Sem coluna JSON em students: o select("*") lê tudo no arranque do aluno e de todos os alunos no profissional, e a cópia offline copiaria os percursos.
--
-- Garantias que o servidor impõe (provadas por tests/runs-db.test.js num Postgres local e descartável, com auth.uid() e os papéis simulados;
-- NÃO provadas no Supabase real, ver o fim do ficheiro):
--   1. Um aluno só lê, cria e apaga as SUAS linhas; o profissional lê tudo e apaga, mas não cria nem altera corridas; anónimo não toca em nada.
--   2. Criar uma corrida exige: created_by = quem pede, a ficha do próprio aluno com runs_mode ligado (live/native só com 'live') e o consentimento
--      da versão indicada em consent_v. Apagar nunca depende do modo (o aluno apaga sempre o que é seu).
--   3. Valores absurdos ficam à porta (CHECKs): distâncias, durações, velocidade média, datas, notas, RPE, parciais e o percurso (forma, n.º de
--      segmentos e tamanho). O percurso e os parciais só podem conter números (o profissional lê-os; a nota de 300 caracteres é texto livre e a app escapa-a).
--   4. Retirar o consentimento apaga tudo, mesmo que alguém grave uma corrida ao mesmo tempo (a chave estrangeira bloqueia essa corrida de pedidos).
--   5. Sem UPDATE pela API (anon e authenticated): nem política nem direito de tabela. Não há quota por aluno (um aluno com sessão válida pode inserir muitas linhas).

-- ---------- students.runs_mode ----------
alter table students add column if not exists runs_mode text not null default 'off';
alter table students drop constraint if exists students_runs_mode_check;
alter table students add constraint students_runs_mode_check check (runs_mode in ('off', 'import', 'live'));
comment on column students.runs_mode is 'Corrida ligada pelo profissional: off (escondida) | import (importar e registar à mão) | live (também gravar com GPS). O aluno não a escreve (gatilho de colunas).';

-- ---------- validações do conteúdo JSON (puras; um CHECK não aceita subconsultas) ----------
-- Parciais por km: lista de até 300 números (segundos por km completo), 0 a 86400. Nada de texto, objetos nem listas lá dentro.
create or replace function run_splits_are_valid(s jsonb) returns boolean
language plpgsql immutable set search_path = pg_catalog, pg_temp as $$
declare el jsonb; v numeric;
begin
  if s is null or jsonb_typeof(s) <> 'array' then return false; end if;
  if jsonb_array_length(s) > 300 then return false; end if;
  for el in select value from jsonb_array_elements(s) loop
    if jsonb_typeof(el) <> 'number' then return false; end if;
    v := (el #>> '{}')::numeric;
    if v < 0 or v > 86400 then return false; end if;
  end loop;
  return true;
exception when others then
  return false;
end $$;

-- Percurso (fmt 1): [ [ [lat, lon, seg], ... ], ... ] = 1 a 200 segmentos, cada um com pelo menos 1 ponto de EXATAMENTE 3 números:
-- lat -90..90, lon -180..180, seg 0..2592000 = 30 dias (segundos desde started_at; só impede números absurdos). Texto do jsonb até 200000 bytes. O tamanho verifica-se primeiro,
-- para que um pedido enorme seja recusado sem percorrer os pontos.
create or replace function run_points_are_valid(p jsonb) returns boolean
language plpgsql immutable set search_path = pg_catalog, pg_temp as $$
declare seg jsonb; pt jsonb; lat numeric; lon numeric; sec numeric;
begin
  if p is null then return false; end if;
  if octet_length(p::text) > 200000 then return false; end if;
  if jsonb_typeof(p) <> 'array' then return false; end if;
  if jsonb_array_length(p) < 1 or jsonb_array_length(p) > 200 then return false; end if;
  for seg in select value from jsonb_array_elements(p) loop
    if jsonb_typeof(seg) <> 'array' then return false; end if;
    if jsonb_array_length(seg) < 1 then return false; end if;
    for pt in select value from jsonb_array_elements(seg) loop
      if jsonb_typeof(pt) <> 'array' then return false; end if;
      if jsonb_array_length(pt) <> 3 then return false; end if;
      if jsonb_typeof(pt -> 0) <> 'number' then return false; end if;
      if jsonb_typeof(pt -> 1) <> 'number' then return false; end if;
      if jsonb_typeof(pt -> 2) <> 'number' then return false; end if;
      lat := (pt ->> 0)::numeric; lon := (pt ->> 1)::numeric; sec := (pt ->> 2)::numeric;
      if lat < -90 or lat > 90 then return false; end if;
      if lon < -180 or lon > 180 then return false; end if;
      if sec < 0 or sec > 2592000 then return false; end if;
    end loop;
  end loop;
  return true;
exception when others then
  return false;
end $$;

-- ---------- tabelas ----------
create table if not exists run_consents (
  student_id text not null references students(id) on delete cascade,
  version smallint not null default 1 check (version >= 1),   -- versão do aviso aceite; um aviso novo = uma linha nova (nunca há update)
  accepted_at timestamptz not null default now(),             -- o servidor volta a escrevê-la no insert (gatilho abaixo): é a prova da data
  primary key (student_id, version)
);

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),        -- gerado no telemóvel: reenviar a mesma corrida dá 23505 (já chegou)
  student_id text not null references students(id) on delete cascade,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),        -- o servidor volta a escrevê-la no insert (gatilho abaixo)
  started_at timestamptz not null check (started_at >= timestamptz '2000-01-01 00:00:00+00' and started_at <= now() + interval '2 days'),
  source text not null check (source in ('live', 'gpx', 'tcx', 'fit', 'manual', 'native')),   -- 'fit' e 'native' reservados (não existem na v1)
  duration_s integer not null check (duration_s between 1 and 86400),       -- tempo total, sem as pausas pedidas pelo aluno
  moving_s integer not null check (moving_s between 0 and 86400),           -- tempo em movimento
  distance_m integer not null check (distance_m between 0 and 300000),
  gaps smallint not null default 0 check (gaps between 0 and 1000),         -- lacunas de sinal (não inclui pausas)
  gap_s integer not null default 0 check (gap_s between 0 and 86400),       -- segundos sem posições dentro das lacunas
  hidden_s integer not null default 0 check (hidden_s between 0 and 86400), -- segundos com a página em segundo plano durante a gravação
  splits_s jsonb check (splits_s is null or run_splits_are_valid(splits_s)), -- segundos de cada km completo: até 300 números (0 a 86400)
  rpe smallint check (rpe is null or rpe between 1 and 10),
  notes text check (notes is null or char_length(notes) <= 300),
  consent_v smallint not null check (consent_v >= 1),                       -- versão do aviso que o aluno aceitou ao guardar
  unique (id, student_id),
  constraint runs_moving_le_duration check (moving_s <= duration_s),
  constraint runs_speed_plausible check (distance_m <= 12 * duration_s),    -- 12 m/s = 43 km/h de média: só apanha lixo evidente (sem divisões)
  -- A corrida só existe enquanto existir o consentimento que a autorizou. Além de tornar consent_v verdadeiro, a chave estrangeira bloqueia
  -- (FOR KEY SHARE) o apagar do consentimento enquanto uma corrida desse aluno estiver a ser gravada: sem ela, apagar o consentimento
  -- ao mesmo tempo que se grava uma corrida deixava essa corrida para trás, sem consentimento.
  constraint runs_consent_fk foreign key (student_id, consent_v) references run_consents (student_id, version) on delete cascade
);
create index if not exists runs_student_started_idx on runs (student_id, started_at desc);

create table if not exists run_tracks (
  run_id uuid primary key,
  student_id text not null references students(id) on delete cascade,
  fmt smallint not null default 1 check (fmt = 1),                          -- formato de points; 2 a 9 ficam reservados para um formato futuro
  trim_m smallint not null default 0 check (trim_m between 0 and 2000),     -- metros aparados no início e no fim antes de enviar
  points jsonb not null constraint run_tracks_points_valid check (run_points_are_valid(points)),
  foreign key (run_id, student_id) references runs (id, student_id) on delete cascade   -- o percurso é sempre do dono da corrida
);
create index if not exists run_tracks_student_idx on run_tracks (student_id);

alter table run_consents enable row level security;
alter table runs enable row level security;
alter table run_tracks enable row level security;

-- ---------- run_consents ----------
drop policy if exists "student reads own run consent" on run_consents;
create policy "student reads own run consent" on run_consents for select
  using (exists (select 1 from students st where st.id = run_consents.student_id and st.auth_user_id = auth.uid()));
-- O consentimento pode ficar registado mesmo com a Corrida desligada: é inofensivo (sem modo ligado nenhuma corrida entra) e o servidor não
-- consegue provar que o aluno viu o aviso, só que a conta dele o disse.
drop policy if exists "student gives own run consent" on run_consents;
create policy "student gives own run consent" on run_consents for insert
  with check (exists (select 1 from students st where st.id = run_consents.student_id and st.auth_user_id = auth.uid()));
drop policy if exists "student withdraws own run consent" on run_consents;
create policy "student withdraws own run consent" on run_consents for delete
  using (exists (select 1 from students st where st.id = run_consents.student_id and st.auth_user_id = auth.uid()));
drop policy if exists "professionals read run consents" on run_consents;
create policy "professionals read run consents" on run_consents for select
  using (exists (select 1 from professionals where user_id = auth.uid()));

-- ---------- runs ----------
drop policy if exists "student reads own runs" on runs;
create policy "student reads own runs" on runs for select
  using (exists (select 1 from students st where st.id = runs.student_id and st.auth_user_id = auth.uid()));
drop policy if exists "student creates own runs" on runs;
create policy "student creates own runs" on runs for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from students st
      where st.id = runs.student_id and st.auth_user_id = auth.uid()
        and st.runs_mode <> 'off'
        and (runs.source not in ('live', 'native') or st.runs_mode = 'live')
    )
    and exists (select 1 from run_consents c where c.student_id = runs.student_id and c.version = runs.consent_v)
  );
drop policy if exists "student deletes own runs" on runs;
create policy "student deletes own runs" on runs for delete
  using (exists (select 1 from students st where st.id = runs.student_id and st.auth_user_id = auth.uid()));
drop policy if exists "professionals read runs" on runs;
create policy "professionals read runs" on runs for select
  using (exists (select 1 from professionals where user_id = auth.uid()));
drop policy if exists "professionals delete runs" on runs;
create policy "professionals delete runs" on runs for delete
  using (exists (select 1 from professionals where user_id = auth.uid()));

-- ---------- run_tracks (todas as linhas são percursos partilhados) ----------
-- O insert do percurso NÃO exige o modo ligado nem o consentimento: a corrida (que já existe, é do aluno e passou essas regras) é a prova;
-- assim um reenvio parcial nunca fica preso se o profissional desligar a Corrida entretanto.
drop policy if exists "student reads own run tracks" on run_tracks;
create policy "student reads own run tracks" on run_tracks for select
  using (exists (select 1 from students st where st.id = run_tracks.student_id and st.auth_user_id = auth.uid()));
drop policy if exists "student creates own run tracks" on run_tracks;
create policy "student creates own run tracks" on run_tracks for insert
  with check (exists (select 1 from students st where st.id = run_tracks.student_id and st.auth_user_id = auth.uid()));
drop policy if exists "student deletes own run tracks" on run_tracks;
create policy "student deletes own run tracks" on run_tracks for delete
  using (exists (select 1 from students st where st.id = run_tracks.student_id and st.auth_user_id = auth.uid()));
drop policy if exists "professionals read run tracks" on run_tracks;
create policy "professionals read run tracks" on run_tracks for select
  using (exists (select 1 from professionals where user_id = auth.uid()));
drop policy if exists "professionals delete run tracks" on run_tracks;
create policy "professionals delete run tracks" on run_tracks for delete
  using (exists (select 1 from professionals where user_id = auth.uid()));

-- ---------- gatilhos ----------
-- A data do consentimento e a de criação da corrida são do servidor, não do telemóvel (que pode ter o relógio errado ou mentir).
create or replace function run_stamp_server_time() returns trigger language plpgsql set search_path = pg_catalog, pg_temp as $$
begin
  if tg_table_name = 'run_consents' then new.accepted_at := now(); else new.created_at := now(); end if;
  return new;
end $$;
drop trigger if exists trg_run_consents_stamp on run_consents;
create trigger trg_run_consents_stamp before insert on run_consents for each row execute function run_stamp_server_time();
drop trigger if exists trg_runs_stamp on runs;
create trigger trg_runs_stamp before insert on runs for each row execute function run_stamp_server_time();

-- Retirar o consentimento = apagar tudo. SECURITY DEFINER de propósito: a garantia não pode depender de o aluno ter política ou direito de
-- DELETE em runs (se um dia alguém os tirar, a retirada do consentimento continuaria a apagar). Só apaga as corridas de old.student_id e só
-- corre depois de a política de DELETE de run_consents ter deixado passar o pedido. Os percursos saem por cascata.
create or replace function run_consent_withdrawn() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.runs where student_id = old.student_id;
  return old;
end $$;
-- Uma função de gatilho não precisa de EXECUTE para disparar (só quem cria o gatilho); retira-se para não aparecer como função chamável na API.
-- As funções run_splits_are_valid e run_points_are_valid NÃO levam revoke: os CHECKs avaliam-nas com os direitos de quem insere.
revoke all on function run_consent_withdrawn() from public, anon, authenticated;
drop trigger if exists trg_run_consent_withdrawn on run_consents;
create trigger trg_run_consent_withdrawn after delete on run_consents for each row execute function run_consent_withdrawn();

-- ---------- direitos de tabela ----------
-- Até agora o Supabase dava a anon e authenticated todos os direitos nas tabelas novas e as migrações confiavam nisso. A partir de 30/10/2026
-- (projetos existentes; changelog 45329 do Supabase, lido mas não testado neste projeto) as tabelas novas deixam de os ter por omissão. Por isso
-- a migração diz o que quer, qualquer que seja o ponto de partida: o aluno e o profissional (ambos «authenticated») têm só select, insert e delete
-- (as políticas decidem quem faz o quê); anon não tem nada; ninguém tem update, truncate (que passa por cima da RLS), references nem trigger.
revoke all on run_consents, runs, run_tracks from anon, authenticated;
grant select, insert, delete on run_consents, runs, run_tracks to authenticated;

comment on table run_consents is 'Consentimento do aluno para a Corrida (versão do aviso e data posta pelo servidor). Aluno: insert/select/delete; profissional: só lê. Apagar uma linha apaga todas as corridas do aluno (gatilho).';
comment on table runs is 'Resumo de cada corrida (sem coordenadas). Aluno: select/insert (com runs_mode ligado e o consentimento de consent_v)/delete; nunca update. Profissional: select/delete.';
comment on table run_tracks is 'Percurso aparado e simplificado [[[lat, lon, segundos], ...], ...] (fmt 1). Uma linha = o aluno escolheu partilhá-lo com o profissional; sem linha o percurso nunca saiu do telemóvel. Aluno: select/insert/delete; profissional: select/delete.';

-- Se a app mostrar «Corrida indisponível» logo a seguir a aplicar (cache de esquema do PostgREST). O Supabase costuma recarregá-la sozinho
-- depois de DDL; isto é um reforço inofensivo. Nada disto foi verificado no Supabase real.
notify pgrst, 'reload schema';

-- Verificação depois de aplicar (esperado nas 3 linhas: sel, ins e del = true; upd, trunc e anon_sel = false):
--   select t, has_table_privilege('authenticated', t, 'select') as sel, has_table_privilege('authenticated', t, 'insert') as ins,
--          has_table_privilege('authenticated', t, 'delete') as del, has_table_privilege('authenticated', t, 'update') as upd,
--          has_table_privilege('authenticated', t, 'truncate') as trunc, has_table_privilege('anon', t, 'select') as anon_sel
--   from unnest(array['runs', 'run_tracks', 'run_consents']) t;
-- O bloco J de supabase/verify_security.sql repete isto e testa o isolamento com contas reais.
