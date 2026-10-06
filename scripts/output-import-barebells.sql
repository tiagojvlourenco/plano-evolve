-- Fase 35 — produto pedido pelo profissional (aparece no questionário de um
-- aluno e não existia na base): Barebells Cookies & Cream, versão europeia
-- (EAN 7340001800470, vendida em FR/ES/SE/UK — não a versão norte-americana
-- 0850000429116, que tem outra tabela nutricional).
-- Entra como 'pending', com a ficha individual da Open Food Facts como fonte —
-- o profissional aprova no Catálogo. package_quantity = 55 g (1 barra), que a
-- app usa como dose-padrão.
insert into food_products (ean, name, brand, food_group, package_quantity, package_unit, nutrition_basis, kcal, protein, carbs, fat, sugars, fiber, saturated_fat, salt, source_url, source_type, verification_status)
values ('7340001800470', 'Barra proteica Cookies & Cream', 'Barebells', 'snacks', 55, 'g', '100g', 346, 37, 31, 12, 2.5, 6.5, 5.6, 0.2, 'https://world.openfoodfacts.org/product/7340001800470', 'open_food_facts', 'pending')
on conflict (ean) do nothing;
