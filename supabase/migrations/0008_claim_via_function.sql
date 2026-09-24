-- EVOLVE NUTRITION — reclamar o convite via função, não via UPDATE direto
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0007 já terem corrido.
--
-- Encontrado ao validar com uma conta de aluno real: mesmo com a policy
-- "student claims invited row" definida corretamente e com a condição
-- confirmada como verdadeira por uma função de diagnóstico
-- (auth_user_id is null and invite_email = auth.email() -> true), um UPDATE
-- direto via PostgREST na tabela students continuava a afetar 0 linhas. Não
-- foi possível confirmar a causa exata dessa discrepância entre RLS avaliado
-- via função vs. via UPDATE direto do PostgREST nesta sessão de diagnóstico.
-- Em vez de continuar a depender de uma UPDATE policy para esta operação
-- específica (reclamar um convite só acontece uma vez, uma única vez por
-- aluno), passa a ser feita através de uma função SECURITY DEFINER, que
-- corre com privilégios elevados e faz a própria validação internamente —
-- um padrão mais robusto e mais fácil de auditar para este tipo de operação
-- sensível (associar uma conta de login a um registo).

create or replace function claim_student_row()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_id text;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'message', 'Sem sessão autenticada.');
  end if;

  update students
  set auth_user_id = auth.uid()
  where invite_email = auth.email()
    and auth_user_id is null
  returning id into updated_id;

  if updated_id is null then
    return jsonb_build_object('success', false, 'message', 'Nenhum convite pendente para este email.');
  end if;

  return jsonb_build_object('success', true, 'id', updated_id);
end;
$$;

grant execute on function claim_student_row() to authenticated;
