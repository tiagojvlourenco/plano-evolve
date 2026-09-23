-- EVOLVE NUTRITION — colunas em falta no schema documentado
-- Corre isto no SQL Editor do Supabase, depois de 0001 e 0002 já terem corrido.
--
-- Encontrado na auditoria de segurança (Fase 7): o código já lê/escreve estas
-- colunas (flexOverrides, flexHistory, blockedFoods, substitutionHistory,
-- adaptationHistory — ver studentToRow/rowToStudent em evolve-nutrition.html)
-- mas nenhuma migração documentada as criava. Provavelmente foram adicionadas
-- manualmente no painel Supabase nalgum momento anterior. Este ficheiro só
-- garante que o esquema fica completo e reproduzível a partir do zero;
-- se as colunas já existirem, "if not exists" torna isto inofensivo.

alter table students add column if not exists flex_overrides jsonb default '{}';
alter table students add column if not exists flex_history jsonb default '[]';
alter table students add column if not exists blocked_foods jsonb default '[]';
alter table students add column if not exists substitution_history jsonb default '[]';
alter table students add column if not exists adaptation_history jsonb default '[]';

-- Reforço de integridade: evita que o profissional convide dois alunos com o
-- mesmo email por engano (o que faria o primeiro login "reclamar" as duas linhas).
create unique index if not exists students_invite_email_idx
  on students(invite_email) where invite_email is not null;
