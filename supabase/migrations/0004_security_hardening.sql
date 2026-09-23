-- EVOLVE NUTRITION — Fase 7: reforço de segurança, acessos e permissões
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001, 0002 e 0003 já terem corrido.
-- Corre o ficheiro inteiro de uma vez (é seguro voltar a correr — todos os passos
-- usam "if exists"/"or replace"/"if not exists").
--
-- Problemas concretos que esta migração resolve (ver relatório de auditoria):
-- 1. As políticas de "students" identificavam o profissional comparando um email
--    fixo ('tiagojvlourenco@gmail.com') dentro da própria policy SQL. Funcionava
--    (é avaliado no servidor, não pode ser falsificado a partir do browser), mas
--    não escalava para mais do que um profissional e expunha o email no código.
--    Passa a existir uma tabela `professionals` própria.
-- 2. Um aluno autenticado conseguia fazer UPDATE em QUALQUER coluna da sua própria
--    linha (a policy só verificava a linha, nunca as colunas) — incluindo targets,
--    flexibilidade, notas privadas, histórico do plano e alertas profissionais.
--    Passa a existir um trigger que só deixa o aluno alterar os campos do dia a dia
--    (check-ins, peso, refeições/estado do plano, fotos) e bloqueia tudo o resto.
-- 3. O bucket de fotografias de progresso não tinha nenhuma política documentada.

/* ===================== 1. Tabela de profissionais ===================== */
-- Forma de identificar quem é profissional SEM depender de comparações de email
-- no JavaScript do browser nem de valores fixos espalhados por várias policies.
-- Vantagens sobre comparar auth.jwt()->>'email' diretamente:
--   - suporta mais do que um profissional no futuro, sem tocar em mais nada;
--   - o email do profissional deixa de estar escrito no código-fonte público;
--   - dá à app uma forma de PERGUNTAR ao servidor "sou profissional?" em vez de
--     decidir isso sozinha no browser (ver alteração em evolve-nutrition.html).
create table if not exists professionals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz default now()
);

alter table professionals enable row level security;

-- Um profissional só consegue ler o SEU PRÓPRIO registo (é só para a app
-- conseguir confirmar "este utilizador está nesta tabela?"). Não há política de
-- insert/update/delete: por omissão, sem política, essas operações ficam
-- bloqueadas para todos os utilizadores da API — só é possível gerir esta tabela
-- a partir do SQL Editor do Supabase (painel), nunca a partir da app.
drop policy if exists "professional reads own row" on professionals;
create policy "professional reads own row" on professionals
  for select
  using (user_id = auth.uid());

-- PASSO MANUAL (não pode ser feito por uma migração): associa a tua conta de
-- profissional já existente a esta tabela. Só funciona depois de já teres feito
-- signup/login pelo menos uma vez com esse email.
insert into professionals (user_id, email)
select id, email from auth.users where email = 'tiagojvlourenco@gmail.com'
on conflict (user_id) do nothing;

/* ===================== 2. Políticas de "students" ===================== */
drop policy if exists "prototype open access" on students;
drop policy if exists "professional full access" on students;
drop policy if exists "student reads own row" on students;
drop policy if exists "student updates own row" on students;
drop policy if exists "student claims invited row" on students;

-- Profissional autorizado: acesso total (ver/criar/editar/apagar todos os alunos).
create policy "professional full access" on students
  for all
  using (exists (select 1 from professionals where user_id = auth.uid()))
  with check (exists (select 1 from professionals where user_id = auth.uid()));

-- Aluno autenticado: só vê a linha que lhe está associada.
create policy "student reads own row" on students
  for select
  using (auth_user_id = auth.uid());

-- Aluno convidado (auth_user_id ainda null): pode "reclamar" a linha uma única
-- vez, desde que o email da conta que acabou de criar bata certo com o convite.
-- Depois de reclamada, esta política deixa de se aplicar (auth_user_id passa a
-- não ser null) e a política seguinte assume o controlo do dia a dia.
create policy "student claims invited row" on students
  for update
  using (auth_user_id is null and invite_email = auth.jwt() ->> 'email')
  with check (auth_user_id = auth.uid() and invite_email = auth.jwt() ->> 'email');

-- Aluno já associado: pode atualizar a sua própria linha. Quais colunas pode
-- realmente tocar é decidido pelo trigger a seguir, não por esta política —
-- RLS controla LINHAS, não colunas.
create policy "student updates own row" on students
  for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

/* ===================== 3. Trigger: colunas que o aluno pode alterar =====================
   O Postgres não tem uma forma nativa de dizer "este utilizador só pode mudar
   estas colunas desta linha" via RLS — RLS decide que LINHAS são visíveis/
   afetadas, não que COLUNAS. GRANT column-level também não serve aqui porque o
   profissional e o aluno usam o mesmo role do Postgres (authenticated) — só se
   distinguem pelo conteúdo do JWT, e GRANT não olha para isso.
   A solução correta é um trigger BEFORE UPDATE que compara a linha antiga com a
   nova: se quem está a escrever não é profissional, só deixa passar se as
   colunas fora da lista permitida ficarem exatamente iguais.
   É uma ALLOWLIST (lista do que É permitido), de propósito: qualquer coluna nova
   que venha a ser adicionada no futuro fica automaticamente bloqueada para o
   aluno até alguém decidir explicitamente libertá-la aqui — o oposto de uma
   lista de bloqueios, que exigiria lembrar sempre de a atualizar. */
create or replace function enforce_student_column_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_pro boolean;
  allowed_keys text[] := array[
    'meals', 'meals_date', 'checkins', 'weights', 'weight_current',
    'substitution_history', 'adaptation_history', 'photos', 'updated_at'
  ];
begin
  is_pro := exists (select 1 from professionals where user_id = auth.uid());
  if is_pro then
    return new; -- profissional: sem restrição de colunas (já restrito por linha, é sempre "all")
  end if;

  -- Ninguém, a não ser via "student claims invited row" (linha ainda não
  -- reclamada), pode mudar a que conta este aluno está associado.
  if old.auth_user_id is not null and old.auth_user_id is distinct from new.auth_user_id then
    raise exception 'Não é permitido alterar a associação da conta a este aluno.';
  end if;

  -- Compara tudo o resto: remove as colunas permitidas de ambos os lados e
  -- exige que o que sobra seja idêntico (targets, flexibilidade, notas,
  -- histórico do plano, alertas, dados pessoais, etc. nunca podem mudar aqui).
  if (to_jsonb(old) - allowed_keys - 'auth_user_id')
     is distinct from
     (to_jsonb(new) - allowed_keys - 'auth_user_id')
  then
    raise exception 'Só o profissional pode alterar estes dados do plano.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_student_column_permissions on students;
create trigger trg_enforce_student_column_permissions
  before update on students
  for each row execute function enforce_student_column_permissions();

/* ===================== 4. Fotografias de progresso (Storage) =====================
   O bucket "progress-photos" já é usado pela app (ver evolve-nutrition.html,
   sb.storage.from("progress-photos")) mas não tinha nenhuma política associada.
   Cada ficheiro é guardado com o caminho "<auth_user_id>/<timestamp>.jpg", por
   isso conseguimos restringir por PASTA: o primeiro segmento do caminho tem de
   ser o auth.uid() de quem está a fazer o pedido.

   IMPORTANTE — ação manual no painel (não é possível de forma fiável por SQL
   em todos os projetos Supabase): marca o bucket "progress-photos" como
   PRIVADO em Storage > progress-photos > Settings > Public bucket = OFF.
   Enquanto o bucket for público, qualquer pessoa com o URL de uma foto acede-
   lhe diretamente, INDEPENDENTEMENTE destas políticas — políticas de Storage só
   controlam pedidos autenticados feitos através da API/SDK (upload, listagem,
   URLs assinados), nunca o acesso direto a um ficheiro de um bucket público. */

drop policy if exists "aluno envia as suas fotos" on storage.objects;
create policy "aluno envia as suas fotos" on storage.objects
  for insert
  with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "aluno lê as suas fotos" on storage.objects;
create policy "aluno lê as suas fotos" on storage.objects
  for select
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "profissional lê fotos dos alunos" on storage.objects;
create policy "profissional lê fotos dos alunos" on storage.objects
  for select
  using (
    bucket_id = 'progress-photos'
    and exists (select 1 from professionals where user_id = auth.uid())
  );
