-- EVOLVE NUTRITION — Fase 17: alimentos personalizados (lidos de rótulos)
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0014 já terem corrido.
-- AINDA NÃO APLICADA nem validada com dados reais.
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

drop policy if exists "utilizadores autenticados leem alimentos personalizados" on custom_foods;
create policy "utilizadores autenticados leem alimentos personalizados" on custom_foods
  for select
  using (auth.uid() is not null);

drop policy if exists "profissional cria alimentos personalizados" on custom_foods;
create policy "profissional cria alimentos personalizados" on custom_foods
  for insert
  with check (exists (select 1 from professionals where user_id = auth.uid()));

drop policy if exists "profissional atualiza alimentos personalizados" on custom_foods;
create policy "profissional atualiza alimentos personalizados" on custom_foods
  for update
  using (exists (select 1 from professionals where user_id = auth.uid()));

drop policy if exists "profissional apaga alimentos personalizados" on custom_foods;
create policy "profissional apaga alimentos personalizados" on custom_foods
  for delete
  using (exists (select 1 from professionals where user_id = auth.uid()));

comment on table custom_foods is
  'Alimentos acrescentados pelo profissional (normalmente lidos de um rótulo por OCR no browser) que não existem na base do INSA. Carregados no arranque da app e fundidos com FOOD_DB/FOOD_GROUPS — ficam disponíveis para todos os alunos seguintes.';
comment on column custom_foods.name is 'Nome do alimento tal como vai aparecer na pesquisa — tem de ser único o suficiente para não colidir com nomes já existentes.';
comment on column custom_foods.kcal is 'Calorias por 100g, tal como os restantes alimentos da base.';
comment on column custom_foods.created_by is 'Profissional que acrescentou o alimento — só para auditoria, não restringe a leitura.';

-- ===================== Estado desta migração =====================
-- Ainda NÃO foi aplicada em produção. Depois de aplicada, confirma no SQL
-- Editor: select * from custom_foods; — deve devolver 0 linhas (tabela
-- nova, vazia). Testa a seguir criar um alimento personalizado de teste a
-- partir da app (nome claramente marcado como teste), confirma que aparece
-- na tabela, e remove-o depois: delete from custom_foods where name = '...';
