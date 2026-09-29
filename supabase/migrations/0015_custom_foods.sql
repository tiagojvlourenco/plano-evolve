-- EVOLVE NUTRITION — Fase 17: alimentos personalizados (lidos de rótulos)
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0014 já terem corrido.
-- APLICADA e validada em produção em 2026-09-29.
--
-- Pedido do profissional: além da base do INSA (Fase 16), poder acrescentar
-- um alimento que não existe na base, lendo a tabela nutricional de um
-- rótulo (foto, com OCR no próprio browser — sem servidor, sem API paga).
-- Depois de guardado uma vez, fica disponível automaticamente para todos os
-- alunos seguintes — daí uma tabela própria, carregada no arranque da app
-- e fundida com FOOD_DB/FOOD_GROUPS (ver loadCustomFoods() em
-- evolve-nutrition.html), em vez de guardado só no aluno atual.
--
-- Leitura aberta a qualquer utilizador autenticado (aluno ou profissional):
-- um aluno pode ter, no seu próprio plano, uma refeição com um alimento
-- personalizado que o profissional acrescentou — a app dele precisa de o
-- conseguir ler para calcular os macros corretamente. Escrita só para
-- profissionais, tal como todo o resto do conteúdo do plano.

create table if not exists custom_foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kcal integer not null,
  protein numeric not null,
  carbs numeric not null,
  fat numeric not null,
  food_group text not null check (food_group in ('protein','carb','veg','fat','fruit')),
  created_by uuid references professionals(user_id),
  created_at timestamptz not null default now()
);

alter table custom_foods enable row level security;

drop policy if exists "authenticated users read custom foods" on custom_foods;
create policy "authenticated users read custom foods" on custom_foods
  for select
  using (auth.uid() is not null);

drop policy if exists "professionals insert custom foods" on custom_foods;
create policy "professionals insert custom foods" on custom_foods
  for insert
  with check (exists (select 1 from professionals where user_id = auth.uid()));

drop policy if exists "professionals update custom foods" on custom_foods;
create policy "professionals update custom foods" on custom_foods
  for update
  using (exists (select 1 from professionals where user_id = auth.uid()));

drop policy if exists "professionals delete custom foods" on custom_foods;
create policy "professionals delete custom foods" on custom_foods
  for delete
  using (exists (select 1 from professionals where user_id = auth.uid()));

comment on table custom_foods is
  'Alimentos acrescentados pelo profissional (normalmente lidos de um rótulo por OCR no browser) que não existem na base do INSA. Carregados no arranque da app e fundidos com FOOD_DB/FOOD_GROUPS — ficam disponíveis para todos os alunos seguintes.';
comment on column custom_foods.name is 'Nome do alimento tal como vai aparecer na pesquisa — tem de ser único o suficiente para não colidir com nomes já existentes.';
comment on column custom_foods.kcal is 'Calorias por 100g, tal como os restantes alimentos da base.';
comment on column custom_foods.created_by is 'Profissional que acrescentou o alimento — só para auditoria, não restringe a leitura.';

-- ===================== Estado desta migração =====================
-- APLICADA e validada em produção em 2026-09-29. Confirmado no SQL Editor:
-- select count(*) from custom_foods; -> 0 (tabela nova, vazia); select
-- policyname, cmd from pg_policies where tablename = 'custom_foods'; -> as
-- 4 políticas (SELECT/INSERT/UPDATE/DELETE) todas presentes. Os nomes das
-- políticas foram escritos em inglês na aplicação real (sem acentos, mais
-- fiável a escrever via automação do browser) em vez dos nomes em
-- português acima — funcionalmente idênticos, só o texto do nome difere.
-- O fluxo de criar/ler um alimento personalizado em si já tinha sido
-- validado em modo local antes desta aplicação — ver commit "Fase 17:
-- acrescentar alimentos personalizados lendo o rótulo (OCR no browser)".
