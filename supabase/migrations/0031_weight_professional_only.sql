-- EVOLVE NUTRITION — o peso é do profissional: o aluno deixa de poder escrever weights e weight_current
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0030 já terem corrido. É seguro repetir.
--
-- Decisão: só o Personal Trainer regista o peso (avaliações profissionais, importação de pesagens). O ecrã do aluno já não tem
-- nenhum campo de peso, mas a lista de colunas que o aluno pode escrever (0004 → 0019) ainda incluía weights e weight_current,
-- herdadas do antigo check-in semanal. Quem fizesse um pedido direto à base de dados com a sua sessão podia por isso criar,
-- alterar ou substituir as pesagens que alimentam as revisões de fase e os indicadores.
--
-- O que muda: só a lista. A função é a de 0019 (a última definição), sem 'weights' nem 'weight_current'. Mantém-se tudo o resto:
-- o profissional continua a escrever tudo; o aluno continua a escrever meal_daily_state, meals_date, checkins, substitution_history,
-- adaptation_history, photos, workout_logs e updated_at (com o histórico só a acrescentar, como antes).
-- Um pedido do aluno que repita o valor atual de weights/weight_current continua a passar (não há alteração); só a mudança é recusada.
-- Não apaga nem altera dados: o histórico de pesagens fica exatamente como está. Os check-ins antigos (checkins[].weight) também ficam;
-- a app não os lê como pesagem.

create or replace function enforce_student_column_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_pro boolean;
  allowed_keys text[] := array[
    'meal_daily_state', 'meals_date', 'checkins',
    'substitution_history', 'adaptation_history', 'photos', 'workout_logs', 'updated_at'
  ];
begin
  is_pro := exists (select 1 from professionals where user_id = auth.uid());
  if is_pro then
    return new;
  end if;

  if old.auth_user_id is not null and old.auth_user_id is distinct from new.auth_user_id then
    raise exception 'Não é permitido alterar a associação da conta a este aluno.';
  end if;

  if (to_jsonb(old) - allowed_keys - 'auth_user_id')
     is distinct from
     (to_jsonb(new) - allowed_keys - 'auth_user_id')
  then
    raise exception 'Só o profissional pode alterar estes dados do plano.';
  end if;

  if new.substitution_history is distinct from old.substitution_history
     and not jsonb_array_is_append_only(old.substitution_history, new.substitution_history) then
    raise exception 'Não é permitido alterar ou remover histórico de substituições já registado.';
  end if;

  if new.adaptation_history is distinct from old.adaptation_history
     and not jsonb_array_is_append_only(old.adaptation_history, new.adaptation_history) then
    raise exception 'Não é permitido alterar ou remover histórico de adaptações já registado.';
  end if;

  if new.workout_logs is distinct from old.workout_logs
     and not jsonb_array_is_append_only(old.workout_logs, new.workout_logs) then
    raise exception 'Não é permitido alterar ou remover sessões de treino já registadas.';
  end if;

  if new.workout_logs is distinct from old.workout_logs
     and not workout_logs_appended_are_valid(old.workout_logs, new.workout_logs) then
    raise exception 'Sessão de treino com formato inválido (data AAAA-MM-DD, RPE 1-10, entries em lista).';
  end if;

  return new;
end;
$$;


-- O gatilho já existe (0004→0019) e passa a chamar esta versão; recria-se por segurança.
drop trigger if exists trg_enforce_student_column_permissions on students;
create trigger trg_enforce_student_column_permissions
  before update on students
  for each row execute function enforce_student_column_permissions();

-- ===================== Verificação (corre depois, ver também supabase/verify_security.sql, bloco I) =====================
-- select pg_get_functiondef('enforce_student_column_permissions'::regproc) not like '%''weights''%' as weights_fora_da_lista;
-- deve devolver true.
