-- Limpa produtos repetidos criados pela importação do Open Food Facts quando o mesmo produto
-- já existia no catálogo (ex.: "Leite magro (Continente Equilíbrio)" migrado do código, sem EAN).
-- Compara nome + marca sem maiúsculas, acentos nem pontuação. Mantém sempre a linha mais antiga
-- (e, em empate, a que não vem do Open Food Facts) e marca as repetidas do Open Food Facts como
-- 'rejected' — nada é apagado e é reversível (volta a 'verified' no Catálogo, botão Editar/Aprovar).
--
-- Passo 1: corre só o SELECT e confirma a lista.
-- Passo 2: corre o UPDATE (o mesmo critério) e volta a correr o SELECT: deve vir vazio.

-- ===== PASSO 1: pré-visualização =====
with k as (
  select id, ean, name, brand, source_type, created_at,
    regexp_replace(translate(lower(name),  'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]+', '', 'g') as nk,
    regexp_replace(translate(lower(brand), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]+', '', 'g') as bk
  from food_products
  where verification_status = 'verified'
), ranked as (
  select *, row_number() over (partition by nk, bk order by (source_type = 'open_food_facts'), created_at, id) as rn,
            first_value(id) over (partition by nk, bk order by (source_type = 'open_food_facts'), created_at, id) as keep_id
  from k
)
select r.id as repetido_id, r.name, r.brand, r.ean, r.source_type,
       keep.id as fica_id, keep.name as fica_nome, keep.ean as fica_ean, keep.source_type as fica_fonte
from ranked r
join food_products keep on keep.id = r.keep_id
where r.rn > 1 and r.source_type = 'open_food_facts'
order by r.name;

-- ===== PASSO 2: rejeitar os repetidos (só depois de confirmares o passo 1) =====
with k as (
  select id, source_type, created_at,
    regexp_replace(translate(lower(name),  'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]+', '', 'g') as nk,
    regexp_replace(translate(lower(brand), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]+', '', 'g') as bk
  from food_products
  where verification_status = 'verified'
), ranked as (
  select id, source_type,
         row_number() over (partition by nk, bk order by (source_type = 'open_food_facts'), created_at, id) as rn
  from k
)
update food_products fp
set verification_status = 'rejected',
    verified_at = null,
    updated_at = now(),
    internal_note = coalesce(fp.internal_note || ' | ', '') || 'Rejeitado: repetido de um produto que já existia (limpeza de duplicados do Open Food Facts).'
from ranked
where fp.id = ranked.id and ranked.rn > 1 and ranked.source_type = 'open_food_facts';
