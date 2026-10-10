-- EVOLVE NUTRITION — módulo de treino: programa (profissional) e registo de sessões (aluno)
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0018 já terem corrido.
--
-- training_program: {name, days:[{id, name, exercises:[{id, name, sets, reps, rpe, rest, notes}]}]} — só o profissional escreve.
-- workout_logs: [{id, date, dayId, dayName, rpe, notes, entries:[{exerciseId, name, sets:[{reps, load}]}]}]
--   o aluno só pode ACRESCENTAR sessões (nunca alterar nem apagar as já registadas), tal como substitution_history.
--
-- Até esta migração correr, a app continua a funcionar: guarda tudo o resto e avisa que o treino ainda não pode ser guardado.

alter table students add column if not exists training_program jsonb;
alter table students add column if not exists workout_logs jsonb not null default '[]';

comment on column students.training_program is 'Programa de treino definido pelo profissional (dias e exercícios). Só o profissional escreve.';
comment on column students.workout_logs is 'Sessões de treino registadas pelo aluno (append-only).';

create or replace function enforce_student_column_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_pro boolean;
  allowed_keys text[] := array[
    'meal_daily_state', 'meals_date', 'checkins', 'weights', 'weight_current',
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

  return new;
end;
$$;

drop trigger if exists trg_enforce_student_column_permissions on students;
create trigger trg_enforce_student_column_permissions
  before update on students
  for each row execute function enforce_student_column_permissions();

-- ===================== Verificação (corre depois) =====================
-- select column_name from information_schema.columns where table_name = 'students' and column_name in ('training_program','workout_logs');
-- deve devolver 2 linhas.
