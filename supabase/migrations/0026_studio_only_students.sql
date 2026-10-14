-- EVOLVE NUTRITION — Fase 38: alunos "só estúdio" (criados a partir da agenda, sem conta na app)
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0025 já terem corrido. É seguro voltar a correr.
--
-- Ao criar alunos a partir dos nomes do Google Agenda, muitos só treinam no estúdio e nunca vão usar a app.
-- Esta coluna marca-os, para o painel de retenção não os tratar como "alunos sem registos" (não há registos a esperar deles).
-- Só o profissional a altera: o trigger de permissões do aluno (0019) só deixa o aluno mudar uma lista fixa de colunas.
-- Um aluno marcado só deixa de contar como "só estúdio" quando recebe um convite (email) ou cria conta.

alter table students add column if not exists studio_only boolean not null default false;
