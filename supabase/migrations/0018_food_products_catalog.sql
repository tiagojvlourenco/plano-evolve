-- EVOLVE NUTRITION — Fase 34: catálogo de produtos de supermercado
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0017 já terem corrido.
--
-- Pedido do profissional: substituir os produtos de marca escritos
-- diretamente no código (Fase 30) por um catálogo próprio, apoiado em
-- Supabase — identificados por EAN, com fonte/data/estado de validação,
-- associáveis a vários supermercados, geridos numa área própria do
-- profissional. Mesmo padrão de segurança já usado em custom_foods (Fase
-- 17, ver 0015_custom_foods.sql): leitura ampla, escrita só para
-- profissionais.
--
-- Um produto só fica visível a um aluno depois de "verification_status"
-- passar a 'verified' — antes disso ('pending'/'rejected') só o
-- profissional o vê, para poder rever/corrigir no Catálogo.

create table if not exists food_products (
  id uuid primary key default gen_random_uuid(),
  ean text unique,
  name text not null,
  brand text not null,
  food_group text not null check (food_group in ('cereais','laticinios','carnes','fruta','vegetais','gorduras','snacks')),
  package_quantity numeric,
  package_unit text,
  nutrition_basis text not null default '100g' check (nutrition_basis in ('100g','100ml')),
  kcal numeric not null,
  protein numeric not null,
  carbs numeric not null,
  fat numeric not null,
  sugars numeric,
  fiber numeric,
  saturated_fat numeric,
  salt numeric,
  ingredients text,
  allergens text,
  source_url text,
  internal_note text,
  source_type text not null check (source_type in ('official','label','open_food_facts','legacy_phase30')),
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  verified_at timestamptz,
  verified_by uuid references professionals(user_id),
  created_by uuid references professionals(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists food_product_retailers (
  id uuid primary key default gen_random_uuid(),
  food_product_id uuid not null references food_products(id) on delete cascade,
  retailer text not null check (retailer in ('Continente','Pingo Doce','Mercadona','Auchan','Lidl')),
  retailer_product_url text,
  last_seen_at timestamptz not null default now(),
  unique(food_product_id, retailer)
);

create index if not exists food_products_verification_status_idx on food_products(verification_status);
create index if not exists food_product_retailers_product_idx on food_product_retailers(food_product_id);

alter table food_products enable row level security;

drop policy if exists "verified products readable by all, all statuses by professionals" on food_products;
create policy "verified products readable by all, all statuses by professionals" on food_products
  for select
  using (
    verification_status = 'verified'
    or exists (select 1 from professionals where user_id = auth.uid())
  );

drop policy if exists "professionals insert food products" on food_products;
create policy "professionals insert food products" on food_products
  for insert
  with check (exists (select 1 from professionals where user_id = auth.uid()));

drop policy if exists "professionals update food products" on food_products;
create policy "professionals update food products" on food_products
  for update
  using (exists (select 1 from professionals where user_id = auth.uid()));

drop policy if exists "professionals delete food products" on food_products;
create policy "professionals delete food products" on food_products
  for delete
  using (exists (select 1 from professionals where user_id = auth.uid()));

alter table food_product_retailers enable row level security;

drop policy if exists "retailers follow product visibility" on food_product_retailers;
create policy "retailers follow product visibility" on food_product_retailers
  for select
  using (
    exists (
      select 1 from food_products fp
      where fp.id = food_product_retailers.food_product_id
      and (fp.verification_status = 'verified' or exists (select 1 from professionals where user_id = auth.uid()))
    )
  );

drop policy if exists "professionals insert retailers" on food_product_retailers;
create policy "professionals insert retailers" on food_product_retailers
  for insert
  with check (exists (select 1 from professionals where user_id = auth.uid()));

drop policy if exists "professionals update retailers" on food_product_retailers;
create policy "professionals update retailers" on food_product_retailers
  for update
  using (exists (select 1 from professionals where user_id = auth.uid()));

drop policy if exists "professionals delete retailers" on food_product_retailers;
create policy "professionals delete retailers" on food_product_retailers
  for delete
  using (exists (select 1 from professionals where user_id = auth.uid()));

comment on table food_products is
  'Catálogo de produtos comerciais de supermercado (marca própria e de fabricante), identificados por EAN quando existe. Substitui gradualmente os produtos de marca antes escritos diretamente no código (Fase 30). Só "verified" fica visível aos alunos; "pending"/"rejected" só ao profissional, para rever no Catálogo.';
comment on column food_products.ean is 'Código de barras EAN, quando existe — chave de deduplicação preferencial (ver scripts/import-food-products.js). Preferível ficar null a guardar um código que não se tem a certeza que está correto.';
comment on column food_products.source_url is 'Fonte INDIVIDUAL e verificável deste produto específico — página oficial do fabricante/supermercado, ou a ficha da Open Food Facts correta para ESTE produto. Nunca um link genérico (ex.: um commit do GitHub) — isso vai em internal_note, não aqui. Sem source_url, o produto não deve ficar "verified" (ver verification_status).';
comment on column food_products.internal_note is 'Nota de auditoria interna (ex.: referência ao commit/sessão onde um lote foi originalmente revisto) — nunca conta como fonte nutricional do produto, só como rasto de como chegou à base. Nunca mostrado ao aluno.';
comment on column food_products.source_type is '''official'' = página oficial do fabricante/supermercado; ''label'' = rótulo físico fotografado/confirmado pelo profissional; ''open_food_facts'' = ficha individual da Open Food Facts, associada corretamente a este produto; ''legacy_phase30'' = migrado do código onde já estava antes deste catálogo existir (Fase 30) SEM uma fonte individual verificável guardada — fica sempre "pending" até se confirmar uma fonte real ou se rejeitar.';
comment on column food_products.verification_status is 'pending = importado/criado, ainda por confirmar; verified = confirmado pelo profissional, visível aos alunos; rejected = confirmado como incorreto/indisponível, nunca visível.';
comment on table food_product_retailers is 'Associação de um produto a um ou mais supermercados onde está disponível — um produto não é duplicado por estar em vários.';

-- ===================== Estado desta migração =====================
-- APLICADA em produção em 2026-09-30. Confirmado no SQL Editor com as
-- consultas 1, 2, 3 e 4 de supabase/verify_food_products_security.sql:
-- -> 8 políticas (4 em food_products, 4 em food_product_retailers);
-- -> 1 constraint unique em food_products.ean (food_products_ean_key);
-- -> CHECK de food_group com os 7 grupos da Fase 29;
-- -> food_products vazia (0 linhas), como esperado antes do seed.
-- Seed dos 114 produtos da Fase 30 (scripts/output-migrate-phase30.sql)
-- também aplicado em 2026-09-30: 114 linhas inseridas, todas "pending",
-- confirmado com select verification_status, count(*) from food_products
-- group by verification_status. Falta ainda: Teste funcional I (RLS com
-- sessões reais de aluno/profissional, por fazer).
