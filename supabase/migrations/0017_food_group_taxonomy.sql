-- EVOLVE NUTRITION — Fase 29: 7 novos grupos de alimentos
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0016 já terem corrido.
--
-- Pedido do profissional: trocar os 5 grupos antigos (protein/carb/veg/fat/
-- fruit, pouco intuitivos — "arroz é hidrato, frango é proteína... e fruta,
-- barras de cereais, leite?") pelos 7 grupos explícitos que definiu:
-- cereais/laticinios/carnes/fruta/vegetais/gorduras/snacks (ver GROUP_LABELS
-- em evolve-nutrition.html para os rótulos completos com emoji).
--
-- custom_foods.food_group tinha um CHECK restrito aos 5 valores antigos —
-- isto alarga-o para aceitar TAMBÉM os 7 novos, sem deixar de aceitar os
-- antigos: qualquer alimento personalizado já guardado por um profissional
-- (com um valor antigo) continua válido tal como está, e a app já sabe
-- traduzir esse valor antigo para o grupo novo equivalente ao lê-lo
-- (resolveGroup() em evolve-nutrition.html) — não é preciso re-gravar nada
-- aqui na base de dados.

alter table custom_foods drop constraint if exists custom_foods_food_group_check;
alter table custom_foods add constraint custom_foods_food_group_check
  check (food_group in (
    'cereais','laticinios','carnes','fruta','vegetais','gorduras','snacks',
    'protein','carb','veg','fat','fruit'
  ));

comment on column custom_foods.food_group is
  'Grupo do alimento personalizado — um dos 7 grupos novos da Fase 29 (cereais/laticinios/carnes/fruta/vegetais/gorduras/snacks). Os 5 valores antigos (protein/carb/veg/fat/fruit) continuam aceites só para não invalidar alimentos já guardados antes desta migração; a app traduz-os para o grupo novo equivalente ao lê-los (ver resolveGroup()).';

-- ===================== Estado desta migração =====================
-- APLICADA e validada em produção em 2026-09-30. Confirmado no SQL Editor:
-- select conname, pg_get_constraintdef(oid) from pg_constraint where
-- conrelid = 'custom_foods'::regclass and contype = 'c';
-- -> devolveu o novo CHECK com os 12 valores esperados (7 novos + 5 antigos):
-- CHECK ((food_group = ANY (ARRAY['cereais','laticinios','carnes','fruta',
-- 'vegetais','gorduras','snacks','protein','carb','veg','fat','fruit']))).
