-- EVOLVE NUTRITION — verificação manual das políticas do catálogo (Fase 34)
-- Corre isto DEPOIS de aplicares 0018_food_products_catalog.sql. Mesmo
-- formato de supabase/verify_security.sql: queries 1-4 confirmam
-- estrutura/políticas no SQL Editor (que corre com privilégios elevados,
-- sem RLS) — a aplicação REAL de RLS só é verificável com sessões reais,
-- por isso o Teste funcional I usa a consola do browser com uma sessão de
-- aluno e outra de profissional, tal como o Teste funcional H fez para as
-- fotografias.

-- 1. As 8 políticas esperadas existem (4 em food_products, 4 em food_product_retailers)?
select tablename, policyname, cmd
from pg_policies
where tablename in ('food_products', 'food_product_retailers')
order by tablename, cmd;
-- Esperado: food_products com select/insert/update/delete (4 linhas);
-- food_product_retailers com select/insert/update/delete (4 linhas).

-- 2. A restrição de EAN único existe?
select conname, contype
from pg_constraint
where conrelid = 'food_products'::regclass and contype = 'u';
-- Esperado: 1 linha (unique em "ean").

-- 3. Os grupos aceites em food_group correspondem aos 7 da Fase 29?
select pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'food_products'::regclass and conname like '%food_group%';
-- Esperado: CHECK com 'cereais','laticinios','carnes','fruta','vegetais','gorduras','snacks'.

-- 4. Estado atual do catálogo (vazio antes da primeira importação)
select verification_status, count(*) from food_products group by verification_status;
select retailer, count(*) from food_product_retailers group by retailer;
-- Esperado, antes de aplicares qualquer insert dos scripts de importação:
-- 0 linhas em ambas.

-- ===================== Teste funcional I: RLS do catálogo (Fase 34) =====================
-- Ainda não corrido em produção — corre isto depois de aplicares a migração
-- e pelo menos um insert de teste (ex.: um produto do lote da Fase 30). Usa
-- a consola do browser (F12), autenticado com cada conta indicada — nunca o
-- SQL Editor (que ignora RLS por correr como o dono da base de dados).
--
--   I1. Sessão de ALUNO — um produto "pending" nunca aparece:
--         var { data } = await sb.from("food_products").select("*");
--       Esperado: só produtos "verified" na lista (confirma comparando com
--       o resultado da query 4 acima, corrida como profissional).
--
--   I2. Sessão de ALUNO — não consegue criar, editar nem apagar um produto:
--         await sb.from("food_products").insert({name:"Teste",brand:"Teste",food_group:"snacks",kcal:1,protein:0,carbs:0,fat:0,source_type:"label"})
--       Esperado: erro de RLS / 0 linhas inseridas.
--         await sb.from("food_products").update({kcal:999}).eq("id","<id de um produto qualquer>")
--       Esperado: 0 linhas afetadas.
--         await sb.from("food_products").delete().eq("id","<id de um produto qualquer>")
--       Esperado: 0 linhas afetadas.
--
--   I3. Sessão de PROFISSIONAL — cria, aprova e associa a 2 supermercados:
--         var { data, error } = await sb.from("food_products").insert({name:"Teste EAN",brand:"Teste",food_group:"snacks",kcal:100,protein:1,carbs:1,fat:1,source_type:"label",ean:"9999999999999"}).select();
--       Esperado: sucesso, devolve 1 linha com verification_status "pending" (omissão).
--         await sb.from("food_product_retailers").insert([{food_product_id:data[0].id,retailer:"Continente"},{food_product_id:data[0].id,retailer:"Pingo Doce"}]);
--       Esperado: sucesso, 2 linhas.
--         await sb.from("food_products").update({verification_status:"verified"}).eq("id",data[0].id);
--       Esperado: sucesso.
--
--   I4. Sessão de PROFISSIONAL — o mesmo EAN não pode ser repetido:
--         await sb.from("food_products").insert({name:"Duplicado",brand:"Teste",food_group:"snacks",kcal:1,protein:0,carbs:0,fat:0,source_type:"label",ean:"9999999999999"});
--       Esperado: erro (unique constraint em "ean").
--
--   I5. Confirma na app: reabre a página (ou fecha/reabre o separador, para
--       não depender de cache) com uma sessão de aluno — o produto de I3
--       aparece agora na pesquisa de "+ Adicionar alimento" como
--       "Teste EAN (Teste) · Continente"? NÃO — com 2 retalhistas associados
--       (Continente e Pingo Doce) o nome fica SEM sufixo de loja: só
--       "Teste EAN (Teste)" (ver foodProductDisplayName em
--       evolve-nutrition.html e tests/phase34.test.js).
--
--   I6. Limpeza: apaga o produto de teste (sessão de profissional):
--         await sb.from("food_products").delete().eq("id","<id do produto de I3>");
--       Esperado: sucesso, e a linha correspondente em
--       food_product_retailers desaparece também (on delete cascade).
