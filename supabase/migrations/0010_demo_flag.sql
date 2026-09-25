-- EVOLVE NUTRITION — Fase 9: distinguir alunos de demonstração de alunos reais
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0009 já terem corrido.
-- AINDA NÃO APLICADA nem validada com dados reais.
--
-- Problema encontrado na auditoria da Fase 9: não existe nenhuma forma
-- fiável de distinguir um aluno de demonstração (Maria/Rui/Sofia, dados de
-- exemplo do protótipo) de um aluno real convidado que ainda não reclamou o
-- convite — ambos têm auth_user_id nulo. Sem essa distinção, alunos de
-- demonstração ficam misturados com alunos reais na operação diária do
-- profissional.
--
-- is_demo é só uma flag de VISUALIZAÇÃO no dashboard do profissional — nunca
-- é usada em nenhuma política RLS nem afeta o acesso de ninguém. Só o
-- profissional a pode alterar (não está na allowlist de colunas que o aluno
-- pode escrever — ver enforce_student_column_permissions em
-- 0006_append_only_history.sql — por isso uma tentativa de um aluno a alterar
-- seria bloqueada pelo mesmo trigger, embora a app nunca lhe dê essa opção).

alter table students add column if not exists is_demo boolean not null default false;

-- Marca os alunos de demonstração/teste já existentes: maria/rui/sofia são
-- dados de exemplo do protótipo; tiago é a conta usada para validar RLS com
-- uma conta real (Fases 7-9) — nenhum destes é um aluno real. Ajusta esta
-- lista se tiveres outros ids de demonstração — isto NUNCA apaga nem altera
-- mais nenhum dado dos alunos marcados, só a flag is_demo.
update students set is_demo = true where id in ('maria', 'rui', 'sofia', 'tiago');

comment on column students.is_demo is
  'Aluno de demonstração/prototipagem — escondido por omissão do dashboard do profissional. Só o profissional (SQL Editor ou "for all" policy) pode alterar isto; não afeta RLS nem acesso.';

-- ===================== Como criar o primeiro aluno REAL =====================
-- 1. No dashboard do profissional, "+ Convidar aluno" → preencher o
--    questionário com o email real do aluno.
-- 2. Isto cria a linha em students com is_demo = false (o default) e
--    invite_email = esse email — o aluno NUNCA aparece marcado como
--    "demonstração" a não ser que o marques manualmente.
-- 3. Envia ao aluno o link da app e pede-lhe para criar conta com esse mesmo
--    email — a confirmação de email e o claim_student_row tratam do resto
--    (ver Fase 7/8, já validado com contas reais).
-- 4. Confirma no dashboard que o aluno aparece na lista principal (não
--    precisas de ativar "Mostrar contas de demonstração" para o ver).

-- ===================== Estado desta migração =====================
-- Ainda NÃO foi aplicada em produção. Depois de aplicada, confirma no SQL
-- Editor: select id, name, is_demo from students order by id; — deve mostrar
-- maria/rui/sofia com is_demo = true e qualquer aluno real com is_demo = false.
