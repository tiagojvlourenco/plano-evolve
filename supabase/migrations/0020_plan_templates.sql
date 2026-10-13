-- EVOLVE NUTRITION — Fase 35: templates de plano (nutrição e treino) reutilizáveis
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0019 já terem corrido.
--
-- O profissional guarda a estrutura de um plano (refeições com alimentos, ou dias de treino com
-- exercícios) como template e aplica-o a outros alunos, editando depois à vontade. Só profissionais
-- leem e escrevem esta tabela; os alunos nunca a veem.
--
-- kind: 'nutricao' -> data = {meals:[{name, time, foods:[{name, qty, group, required}]}]}
--       'treino'   -> data = {name, days:[{name, exercises:[{name, sets, reps, rpe, rest, notes}]}]}

create table if not exists plan_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('nutricao','treino')),
  name text not null check (char_length(name) between 1 and 80),
  data jsonb not null,
  created_by uuid default auth.uid() references professionals(user_id),
  created_at timestamptz not null default now()
);

create index if not exists plan_templates_kind_idx on plan_templates(kind, created_at desc);

alter table plan_templates enable row level security;

drop policy if exists "professionals read plan templates" on plan_templates;
create policy "professionals read plan templates" on plan_templates
  for select
  using (exists (select 1 from professionals where user_id = auth.uid()));

drop policy if exists "professionals insert plan templates" on plan_templates;
create policy "professionals insert plan templates" on plan_templates
  for insert
  with check (exists (select 1 from professionals where user_id = auth.uid()));

drop policy if exists "professionals delete plan templates" on plan_templates;
create policy "professionals delete plan templates" on plan_templates
  for delete
  using (exists (select 1 from professionals where user_id = auth.uid()));
