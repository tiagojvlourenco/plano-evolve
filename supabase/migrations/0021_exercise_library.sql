-- EVOLVE NUTRITION — Fase 36: biblioteca de exercícios partilhada pelo estúdio
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0020 já terem corrido.
--
-- A app traz uma lista base de exercícios por grupo muscular (no código, com ligação de pesquisa de vídeo).
-- Esta tabela guarda o que os profissionais acrescentam ou corrigem (por exemplo trocar a pesquisa por um
-- vídeo do estúdio). É partilhada: todos os profissionais leem e escrevem. Os alunos nunca a veem.
-- Um exercício guardado aqui com o mesmo nome de um da lista base substitui-o.

create table if not exists exercise_library (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  muscle_group text not null check (char_length(muscle_group) between 1 and 40),
  equipment text check (equipment is null or char_length(equipment) <= 60),
  demo text check (demo is null or (demo ~* '^https://[^[:space:]"''<>]+$' and char_length(demo) <= 500)),
  cues jsonb not null default '[]'::jsonb check (jsonb_typeof(cues) = 'array' and jsonb_array_length(cues) <= 3),
  note text check (note is null or char_length(note) <= 200),
  created_by uuid default auth.uid() references professionals(user_id),
  created_at timestamptz not null default now()
);

create unique index if not exists exercise_library_name_idx on exercise_library (lower(name));
create index if not exists exercise_library_group_idx on exercise_library (muscle_group);

alter table exercise_library enable row level security;

drop policy if exists "professionals read exercise library" on exercise_library;
create policy "professionals read exercise library" on exercise_library
  for select
  using (exists (select 1 from professionals where user_id = auth.uid()));

drop policy if exists "professionals insert exercise library" on exercise_library;
create policy "professionals insert exercise library" on exercise_library
  for insert
  with check (exists (select 1 from professionals where user_id = auth.uid()));

drop policy if exists "professionals update exercise library" on exercise_library;
create policy "professionals update exercise library" on exercise_library
  for update
  using (exists (select 1 from professionals where user_id = auth.uid()))
  with check (exists (select 1 from professionals where user_id = auth.uid()));

drop policy if exists "professionals delete exercise library" on exercise_library;
create policy "professionals delete exercise library" on exercise_library
  for delete
  using (exists (select 1 from professionals where user_id = auth.uid()));
