-- EVOLVE NUTRITION — Fase 10: alinhar o questionário inicial ao formulário real
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0012 já terem corrido.
-- APLICADA e validada em produção em 2026-09-28.
--
-- O questionário inicial (openOnboardingForm) foi reescrito para corresponder
-- exatamente às perguntas do questionário real em Google Forms ("Avaliação
-- de Hábitos Alimentares, Rotina e Sono") que o profissional já usa com os
-- alunos. Estas colunas guardam as perguntas que não tinham correspondência
-- nos campos já existentes:
--
--   meals_at_work_ease        — "Facilidade de fazer refeições no local de
--                                trabalho" (Muito fácil/Fácil/Difícil/Muito
--                                Difícil)
--   uses_supplements          — "Utiliza algum tipo de Suplemento?" (Sim/Não)
--   supplements                — "Que Suplementos utiliza?" (Proteína/
--                                Creatina/Outra: texto)
--   daily_eating_description  — "Descreva o seu dia-a-dia alimentar..."
--                                (texto longo)
--   overeating_meals_per_week — "Número de refeições exageradas por semana"
--   hardest_food_to_resist    — "Alimento ou grupo de alimentos que mais lhe
--                                custa controlar ou resistir"
--   water_intake               — "Quantidade de Água ingerida em 24h"
--                                (Menos de 1L/Entre 1L e 2L/Entre 2L e 3L/
--                                Mais de 3L)
--
-- "Alimentos que nunca consome ou é alérgico/a" não precisa de coluna nova —
-- mapeia para a coluna allergies já existente.
--
-- Os campos de Objetivo/Treinos/Tipo de treino/Acorda/Dorme e Peso NÃO estão
-- no formulário real (são preenchidos pelo profissional, não pelo aluno) —
-- continuam a usar as colunas já existentes (goal, trainings_per_week, etc.).

alter table students add column if not exists meals_at_work_ease text;
alter table students add column if not exists uses_supplements boolean not null default false;
alter table students add column if not exists supplements jsonb not null default '[]';
alter table students add column if not exists daily_eating_description text;
alter table students add column if not exists overeating_meals_per_week integer;
alter table students add column if not exists hardest_food_to_resist text;
alter table students add column if not exists water_intake text;

comment on column students.meals_at_work_ease is
  'Facilidade de fazer refeições no local de trabalho (questionário inicial).';
comment on column students.uses_supplements is
  'Se o aluno utiliza algum suplemento (questionário inicial).';
comment on column students.supplements is
  'Lista de suplementos utilizados (questionário inicial).';
comment on column students.daily_eating_description is
  'Descrição em texto livre do dia-a-dia alimentar (questionário inicial).';
comment on column students.overeating_meals_per_week is
  'Número de refeições exageradas por semana, autorreportado (questionário inicial).';
comment on column students.hardest_food_to_resist is
  'Alimento ou grupo de alimentos que o aluno reporta ser mais difícil de controlar (questionário inicial).';
comment on column students.water_intake is
  'Faixa de quantidade de água ingerida em 24h (questionário inicial).';

-- ===================== Estado desta migração =====================
-- APLICADA e validada em produção em 2026-09-28. Confirmado no SQL Editor:
-- select id, meals_at_work_ease, uses_supplements, supplements,
--   daily_eating_description, overeating_meals_per_week,
--   hardest_food_to_resist, water_intake from students order by id;
-- Os 4 alunos existentes vieram todos com os defaults corretos:
-- meals_at_work_ease/daily_eating_description/overeating_meals_per_week/
-- hardest_food_to_resist/water_intake = NULL, uses_supplements = false,
-- supplements = []. O fluxo de preenchimento do questionário novo (com
-- estas colunas) já tinha sido validado visualmente em modo local antes
-- desta aplicação — ver commit "Fase 10: alinha questionário inicial...".
