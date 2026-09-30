-- Fase 34 — revisão do 1o lote OFF (235 produtos pending, source_type =
-- 'open_food_facts', cada um com source_url próprio para a sua ficha
-- individual na Open Food Facts). Aplicado em produção em 2026-09-30
-- pelo profissional, a pedido explícito ("analisa esses 342 pendentes
-- e aprova se for o caso"), a partir da revisão feita pela Claude:
-- consistência kcal vs macros (4P+4C+9F), adequação de categoria e de
-- grupo. FICHEIRO VERSIONADO — registo auditável do que foi decidido.
--
-- Os 107 produtos legacy_phase30 (Fase 30) NÃO foram tocados nesta
-- revisão — continuam pending, porque não têm fonte individual
-- verificável (só o link do commit onde foram originalmente revistos,
-- que já ficou estabelecido que não conta como fonte nutricional).
-- Ficam para o profissional aprovar/rejeitar individualmente no
-- Catálogo, com base no seu próprio conhecimento desses produtos.

-- 2 correções de categoria (erro objetivo de importação, não juízo
-- nutricional): amendoim é gordura/oleaginosa, não vegetal; pãezinhos
-- de leite são cereais (pão), não carne — vieram mal-categorizados da
-- Open Food Facts.
update food_products set food_group = 'gorduras' where ean = '3410280020150';
update food_products set food_group = 'cereais' where ean = '8410087335100';

-- 3 rejeitados: bebidas (café de chicória, sumo multivitamínico, shot
-- de gengibre/manga/lima) que a Open Food Facts categorizou em
-- "plant-based-beverages" -> laticínios, mas não são leite nem
-- alternativa vegetal ao leite — não se adequam a este grupo.
update food_products set verification_status = 'rejected'
where ean in ('20920210', '4000177158319', '4056489791799');

-- 229 aprovados (238 verified no total incluindo os 9 já aprovados
-- manualmente pelo profissional antes desta revisão): kcal consistente
-- com os macros, categoria e grupo corretos.
update food_products set verification_status = 'verified', verified_at = now()
where source_type = 'open_food_facts' and verification_status = 'pending'
and ean not in ('8480000180377', '8402001031076', '84164773');

-- 3 deixados pending — kcal indicado não bate com os macros (>30% de
-- desvio), não fica claro se é erro da Open Food Facts ou uma
-- característica real do produto (ex.: edulcorantes com menos kcal/g
-- do que açúcar). Precisam confirmação do profissional contra o rótulo
-- real antes de aprovar:
--   - 8480000180377 "Atum em molho de tomate" (Mercadona): 298 kcal
--     indicado vs 196 kcal calculado pelos macros.
--   - 8402001031076 "Cavala em azeite" (Hacendado): 202 kcal indicado
--     vs 308 kcal calculado — o inconsistente é o kcal parecer BAIXO
--     demais para a gordura indicada (26g).
--   - 84164773 "Mistura de citrinos" (Halls): 235 kcal indicado vs 385
--     kcal calculado pelos hidratos — só faz sentido se for a versão
--     sem açúcar do produto, e o nome não confirma isso.

-- ===================== Estado desta revisão =====================
-- APLICADO em produção em 2026-09-30 pelo profissional. Confirmado:
-- verified/open_food_facts: 238 | rejected/open_food_facts: 3 |
-- pending/open_food_facts: 3 | pending/legacy_phase30: 107 (inalterado)
-- | verified/legacy_phase30: 7 (inalterado, aprovados manualmente pelo
-- profissional antes desta revisão).
