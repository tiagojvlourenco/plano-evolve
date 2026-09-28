-- EVOLVE NUTRITION — Fase 10: estado ativo/inativo do aluno + data de nascimento
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0011 já terem corrido.
-- AINDA NÃO APLICADA nem validada com dados reais.
--
-- Dois campos novos, independentes um do outro e de is_demo:
--
-- 1. active (boolean, default true): permite ao profissional marcar um aluno
--    real como inativo (ex. parou de treinar) sem apagar nada do histórico.
--    É só uma flag de visualização no dashboard — nunca é usada em nenhuma
--    política RLS. Como o default é true, adicionar a coluna já marca todos
--    os alunos existentes como ativos, sem precisar de um UPDATE separado
--    (por isso não há aqui o mesmo problema de trigger que 0010_demo_flag.sql
--    teve — não há UPDATE nenhum a correr, só o ALTER TABLE).
--
-- 2. birth_date (date, nullable): dado pessoal pedido no onboarding.

alter table students add column if not exists active boolean not null default true;
alter table students add column if not exists birth_date date;

comment on column students.active is
  'Aluno ativo (a treinar atualmente) ou inativo. Só o profissional altera isto; não afeta RLS nem acesso — é só visualização no dashboard.';
comment on column students.birth_date is
  'Data de nascimento do aluno, recolhida no questionário inicial.';

-- ===================== Estado desta migração =====================
-- Ainda NÃO foi aplicada em produção. Depois de aplicada, confirma no SQL
-- Editor: select id, name, active, birth_date from students order by id; —
-- active deve vir true para todos os alunos existentes.
