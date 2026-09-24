-- EVOLVE NUTRITION — separa plano (profissional) de execução diária (aluno)
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0004 já terem corrido.
-- (0004 ainda não foi aplicada em produção nesta altura — corre 0001 a 0005
-- de uma vez, por ordem, a primeira vez que aplicares tudo isto.)
--
-- Problema encontrado depois de 0004: a allowlist do trigger de permissões
-- incluía "meals" para o aluno poder marcar refeições como feitas, adaptadas,
-- ignoradas ou reagendadas, e para o construtor de refeições e as substituições
-- funcionarem. Mas "meals" é UM ÚNICO JSONB com a estrutura inteira do plano —
-- nome, horário, alimentos e quantidades — por isso permitir o aluno escrever
-- ali significava também poder REESCREVER essa estrutura (trocar um alimento
-- por outro fora das opções permitidas, mudar quantidades, renomear ou
-- reagendar uma refeição do plano em definitivo), o que viola a regra de que só
-- o profissional edita o plano.
--
-- Correção: separa em duas colunas. "meals" volta a ser exclusiva do
-- profissional (nome/horário/alimentos/quantidades, nunca estado do dia).
-- "meal_daily_state" é nova e é o que o aluno pode escrever — só execução
-- diária: concluída, adaptada, ignorada, refeição flexível, hora reagendada,
-- escolhas do construtor de refeições e substituições dentro das opções
-- permitidas, e a data a que esse estado pertence. Ver resolveMealsForToday()/
-- commitMealView() em evolve-nutrition.html para como os dois se combinam só
-- para leitura, sem nunca escrever de volta em "meals".

alter table students add column if not exists meal_daily_state jsonb default '{}';

-- Recria o trigger de permissões com a allowlist correta: "meals" sai da lista
-- (deixa de ser algo que o aluno pode tocar), "meal_daily_state" entra.
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

  return new;
end;
$$;

-- (o trigger em si não muda, só a função que ele chama — mas recriar não
-- custa nada e garante que fica ligado à versão nova da função)
drop trigger if exists trg_enforce_student_column_permissions on students;
create trigger trg_enforce_student_column_permissions
  before update on students
  for each row execute function enforce_student_column_permissions();
