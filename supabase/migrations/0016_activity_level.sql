-- EVOLVE NUTRITION — Fase 27: nível de atividade física
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0015 já terem corrido.
--
-- Pedido do profissional depois de analisar uma pesquisa sobre cálculo de
-- TDEE: o nº de treinos de musculação/semana é uma aproximação fraca do
-- nível de atividade real (alguém pode treinar pouco mas ter um trabalho
-- fisicamente exigente, ou o contrário) — passa a haver uma pergunta direta
-- no questionário, com os 4 níveis clássicos da literatura de TDEE.
--
-- Nullable e sem valor por omissão: um aluno sem esta resposta continua a
-- usar o fallback pelo nº de treinos (ver activityFactor() em
-- evolve-nutrition.html) — nada muda para alunos já existentes até o
-- profissional preencher isto manualmente no separador Perfil.

alter table students add column if not exists activity_level text
  check (activity_level in ('Sedentário','Levemente ativo','Moderadamente ativo','Muito ativo'));

comment on column students.activity_level is
  'Nível de atividade física fora do treino (Sedentário/Levemente ativo/Moderadamente ativo/Muito ativo), usado para calcular a manutenção/TDEE com mais precisão do que só o nº de treinos. NULL = usa o nº de treinos como aproximação (comportamento anterior, sem quebrar alunos já existentes).';

-- ===================== Estado desta migração =====================
-- NÃO APLICADA — por aplicar quando o profissional confirmar.
