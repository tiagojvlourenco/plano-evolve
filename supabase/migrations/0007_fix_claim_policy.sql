-- EVOLVE NUTRITION — corrige a política de "reclamar" o convite
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0006 já terem corrido.
--
-- Encontrado ao validar com uma conta de aluno real: a policy usava
-- auth.jwt() ->> 'email' para comparar com invite_email. Confirmámos byte a
-- byte que o invite_email gravado e o email do JWT decodificado no cliente
-- eram idênticos, mas o UPDATE de "claim" continuava a afetar 0 linhas — ou
-- seja, do lado do servidor, auth.jwt() ->> 'email' não estava a resolver
-- para o valor esperado nesta sessão. auth.email() é a função dedicada do
-- Supabase para isto, e é a forma recomendada (mais fiável do que extrair o
-- claim diretamente do JWT, que pode não estar sempre populado da mesma
-- forma dependendo de como/quando a sessão foi emitida ou atualizada).

drop policy if exists "student claims invited row" on students;
create policy "student claims invited row" on students
  for update
  using (auth_user_id is null and invite_email = auth.email())
  with check (auth_user_id = auth.uid() and invite_email = auth.email());
