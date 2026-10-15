-- EVOLVE NUTRITION — Fase 41: fases bulk/cut com revisão periódica e creatina
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0028 já terem corrido. É seguro voltar a correr.
--
-- students.nutrition_phase — estado da fase nutricional do aluno, só o profissional escreve:
--   {phase: 'cut' | 'bulk' | 'manutencao', startDate, startWeight, targetWeight, deficitPct, stage, stageStartDate,
--    reviewEveryDays, lastReviewDate, nextReviewDate, snoozeUntil, creatineStartDate, creatineOn, creatineConfirmed (lista dos motivos confirmados: menor, renal, gravidez), reviews: [...]}
-- As propostas pendentes NÃO se guardam: calculam-se sempre a partir dos pesos, dos alvos e da fase; só ficam as decisões.
-- Os alunos não conseguem escrevê-la (o gatilho enforce_student_column_permissions só deixa os campos do diário).
--
-- Até esta migração correr, a app continua a funcionar: guarda tudo o resto e avisa que a fase ainda não pode ser guardada.

alter table students add column if not exists nutrition_phase jsonb;
alter table students drop constraint if exists students_nutrition_phase_object;
alter table students add constraint students_nutrition_phase_object
  check (nutrition_phase is null or jsonb_typeof(nutrition_phase) = 'object');

comment on column students.nutrition_phase is 'Fase nutricional (cut, bulk ou manutenção), revisões e creatina. Só o profissional escreve.';
