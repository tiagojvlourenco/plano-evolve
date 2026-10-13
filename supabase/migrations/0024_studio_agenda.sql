-- EVOLVE NUTRITION — Fase 39: horário semanal dos alunos (sessões contadas automaticamente) e aulas já realizadas
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0023 já terem corrido. É seguro voltar a correr.
--
-- session_slots            — o horário fixo de um aluno ("segundas às 18:00"). A app conta como feita cada sessão deste horário
--                            à medida que o dia passa (como contar os eventos do Google Calendar); só é preciso marcar as exceções
--                            (faltou, cancelou). counts_from = a partir de que dia se contam; generated_until = até que dia já se contou.
-- sessions.source          — 'manual' (registada à mão) ou 'agenda' (contada pelo horário). Uma sessão do horário nunca se repete no mesmo dia/hora.
-- session_packs.used_before — aulas do pacote já dadas antes de usares a app (para importares os pacotes que estão a meio).

alter table session_packs add column if not exists used_before integer not null default 0;
alter table session_packs drop constraint if exists session_packs_used_before_range;
alter table session_packs add constraint session_packs_used_before_range check (used_before >= 0 and used_before <= 500);

alter table sessions add column if not exists source text not null default 'manual';
alter table sessions drop constraint if exists sessions_source_values;
alter table sessions add constraint sessions_source_values check (source in ('manual', 'agenda'));
create unique index if not exists sessions_agenda_unique on sessions(student_id, date, time) where source = 'agenda';

create table if not exists session_slots (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references students(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),      -- 1 = segunda ... 7 = domingo
  time text not null check (time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  counts_from date not null default current_date,
  generated_until date,
  created_by uuid default auth.uid() references professionals(user_id),
  created_at timestamptz not null default now(),
  unique (student_id, weekday, time)
);
create index if not exists session_slots_student_idx on session_slots(student_id);

alter table session_slots enable row level security;
drop policy if exists "professionals manage session slots" on session_slots;
create policy "professionals manage session slots" on session_slots
  for all
  using (exists (select 1 from professionals where user_id = auth.uid()))
  with check (exists (select 1 from professionals where user_id = auth.uid()));
