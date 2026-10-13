-- EVOLVE NUTRITION — Fase 40: leitura do Google Agenda (sessões contadas a partir dos eventos do calendário)
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0024 já terem corrido. É seguro voltar a correr.
--
-- studio_settings        — definições do estúdio (só profissionais). Chave 'google_calendar': {clientId, calendarId, useAsSource, aliases, lastSync}.
--                          Nunca guarda palavras-passe nem tokens: a autorização do Google é pedida de cada vez que se sincroniza.
-- sessions.source        — passa a aceitar 'calendario' (sessão vinda de um evento do Google Agenda)
-- sessions.external_id   — o id do evento no Google Agenda (para atualizar/remover se o evento mudar)

create table if not exists studio_settings (
  key text primary key check (char_length(key) between 1 and 60),
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table studio_settings enable row level security;
drop policy if exists "professionals manage studio settings" on studio_settings;
create policy "professionals manage studio settings" on studio_settings
  for all
  using (exists (select 1 from professionals where user_id = auth.uid()))
  with check (exists (select 1 from professionals where user_id = auth.uid()));

alter table sessions add column if not exists external_id text check (external_id is null or char_length(external_id) <= 200);
alter table sessions drop constraint if exists sessions_source_values;
alter table sessions add constraint sessions_source_values check (source in ('manual', 'agenda', 'calendario'));
create unique index if not exists sessions_calendar_unique on sessions(external_id) where source = 'calendario';
