-- EVOLVE NUTRITION — regista atividade do aluno sem permitir reescrever o histórico
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0005 já terem corrido.
--
-- Problema encontrado depois de 0005: substitution_history e adaptation_history
-- continuam na allowlist do aluno (têm de continuar — é o próprio aluno que gera
-- estes eventos ao substituir um alimento, ignorar/reagendar/adaptar uma refeição
-- ou marcá-la como flexível). Mas a allowlist só controla QUE COLUNAS podem
-- mudar, não COMO — o aluno tinha UPDATE livre sobre a coluna inteira, incluindo
-- apagar entradas antigas ou inserir entradas falsas. Isso deixa de ser só um
-- problema de "o aluno mexe no plano": estas colunas alimentam os indicadores
-- do profissional (Leitura, "Padrões de adaptação") e o separador Histórico —
-- um aluno mal-intencionado podia distorcer a leitura que o profissional faz do
-- seu próprio comportamento.
--
-- Não faz sentido mover isto para meal_daily_state: essa coluna é só o estado de
-- HOJE (reinicia todos os dias em ensureFreshDay), e este histórico tem de
-- acumular ao longo de semanas para os indicadores de "últimos N dias"
-- (computeAdaptationSummary, o indicador "Padrões de adaptação"). A correção é
-- dar ao aluno um "modo de escrita" seguro sobre a coluna que já usa: só pode
-- ACRESCENTAR eventos ao fim do array, nunca alterar ou remover os que já lá
-- estão. É exatamente o que o código cliente já faz (sempre um .push() antes de
-- gravar) — isto só impede fazer o mesmo de propósito, de forma maliciosa, pela
-- consola do browser.

-- Verifica se new_arr é "old_arr com zero ou mais elementos acrescentados ao
-- fim": mesmo comprimento ou maior, e todas as posições que já existiam em
-- old_arr continuam com o mesmo valor, na mesma posição, em new_arr.
create or replace function jsonb_array_is_append_only(old_arr jsonb, new_arr jsonb)
returns boolean
language sql
immutable
as $$
  select
    coalesce(jsonb_typeof(new_arr) = 'array', false)
    and coalesce(jsonb_array_length(new_arr), 0) >= coalesce(jsonb_array_length(old_arr), 0)
    and (
      coalesce(jsonb_array_length(old_arr), 0) = 0
      or not exists (
        select 1 from generate_series(0, jsonb_array_length(old_arr) - 1) as i
        where new_arr -> i is distinct from old_arr -> i
      )
    );
$$;

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
    'substitution_history', 'adaptation_history', 'photos', 'updated_at'
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

  -- Dentro do que É permitido, substitution_history e adaptation_history só
  -- podem crescer por acréscimo — o aluno regista o que fez, nunca reescreve
  -- o que já tinha registado.
  if new.substitution_history is distinct from old.substitution_history
     and not jsonb_array_is_append_only(old.substitution_history, new.substitution_history) then
    raise exception 'Não é permitido alterar ou remover histórico de substituições já registado.';
  end if;

  if new.adaptation_history is distinct from old.adaptation_history
     and not jsonb_array_is_append_only(old.adaptation_history, new.adaptation_history) then
    raise exception 'Não é permitido alterar ou remover histórico de adaptações já registado.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_student_column_permissions on students;
create trigger trg_enforce_student_column_permissions
  before update on students
  for each row execute function enforce_student_column_permissions();
