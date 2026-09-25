-- EVOLVE NUTRITION — gerir a tabela "professionals"
--
-- NÃO é uma migração numerada (não faz parte do schema, é um procedimento a
-- correr manualmente sempre que precisares de adicionar/remover um
-- profissional). Corre-o no SQL Editor do Supabase, um bloco de cada vez.
--
-- Porque é assim: "professionals" não tem NENHUMA política de insert/update/
-- delete (ver 0004_security_hardening.sql) — de propósito, para que gerir
-- quem é profissional nunca dependa da app nem de nenhum código no browser.
-- A única forma de adicionar ou remover um profissional é aqui, com acesso
-- directo à base de dados.

-- ===================== Adicionar um profissional =====================
-- 1. A pessoa tem de ter feito signup/login na app PELO MENOS UMA VEZ com o
--    email dela (mesmo que a app lhe mostre "Conta sem aluno associado" —
--    isso é esperado, ainda não é profissional nem aluno nesse momento).
-- 2. Substitui o email abaixo pelo da pessoa e corre:

insert into professionals (user_id, email)
select id, email from auth.users where email = 'SUBSTITUI_PELO_EMAIL@exemplo.com'
on conflict (user_id) do nothing;

-- 3. Confirma que resultou:
select p.user_id, p.email, u.email as auth_email
from professionals p join auth.users u on u.id = p.user_id
where p.email = 'SUBSTITUI_PELO_EMAIL@exemplo.com';
-- Esperado: 1 linha. Se vier vazio, confirma que o email está escrito
-- exatamente igual (maiúsculas/minúsculas importam) e que a pessoa já fez
-- login pelo menos uma vez.
-- 4. A pessoa só vê o dashboard de profissional depois de sair e voltar a
--    entrar na app (ou recarregar a página) — a app decide o papel no
--    arranque de cada sessão.

-- ===================== Remover um profissional =====================
-- Isto tira o acesso de profissional; NÃO apaga a conta de autenticação nem
-- nenhum dado de alunos. Substitui o email e corre:

delete from professionals where email = 'SUBSTITUI_PELO_EMAIL@exemplo.com';

-- Confirma:
select * from professionals where email = 'SUBSTITUI_PELO_EMAIL@exemplo.com';
-- Esperado: 0 linhas.

-- Se além de remover o acesso quiseres apagar a conta de autenticação por
-- completo, isso faz-se no dashboard: Authentication → Users → procurar o
-- email → "Delete user". É irreversível — confirma que é mesmo isso que
-- queres antes de o fazer.

-- ===================== Listar profissionais atuais =====================
select p.user_id, p.email, p.created_at
from professionals p
order by p.created_at;
