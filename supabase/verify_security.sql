-- EVOLVE NUTRITION — verificação manual das políticas (Fases 7 e 8)
-- Corre as queries 1-8 e os testes A-F DEPOIS de aplicares 0001-0008 — já
-- foram validados com dados reais (conta de profissional real + conta de
-- aluno criada via convite) em 2026-09-24. Ficam aqui para poderes repetir a
-- validação sempre que quiseres, ex. depois de uma alteração às políticas ou
-- ao trigger.
--
-- As queries 9-10 e o bloco de testes G são da Fase 8 (help_requests /
-- help_request_notes) — 0009_help_requests.sql já foi APLICADA e validada em
-- 2026-09-25, com duas contas de aluno reais e uma de profissional (os 6
-- testes do bloco G passaram). Ficam aqui para repetires a validação sempre
-- que quiseres.
-- Cada bloco tem uma pergunta e o resultado esperado. Não altera dados.

-- 1. As políticas esperadas existem?
select schemaname, tablename, policyname, cmd
from pg_policies
where tablename in ('students', 'professionals')
order by tablename, policyname;
-- Esperado: "professionals" tem 1 política (select, própria linha);
-- "students" tem 4 (professional full access / student reads own row /
-- student claims invited row / student updates own row). Nenhuma política
-- antiga "prototype open access" deve aparecer.

-- 2. O trigger de colunas está ativo?
select tgname, tgrelid::regclass, tgenabled
from pg_trigger
where tgname = 'trg_enforce_student_column_permissions';
-- Esperado: 1 linha, tgenabled = 'O' (ativo).

-- 3. A tua conta de profissional está associada?
select p.user_id, p.email, u.email as auth_email
from professionals p join auth.users u on u.id = p.user_id;
-- Esperado: pelo menos 1 linha com o teu email. Se vier vazio, confirma que já
-- fizeste login pelo menos uma vez com essa conta e volta a correr o "insert"
-- da secção 1 de 0004_security_hardening.sql.

-- 4. Colunas em falta ficaram mesmo criadas?
select column_name from information_schema.columns
where table_name = 'students'
  and column_name in ('flex_overrides','flex_history','blocked_foods','substitution_history','adaptation_history','meal_daily_state')
order by column_name;
-- Esperado: as 6 colunas listadas (as 5 da auditoria inicial + meal_daily_state,
-- a coluna que separa a execução diária do aluno da estrutura do plano em "meals").

-- 5. Políticas de Storage do bucket de fotos existem?
select policyname, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname in ('aluno envia as suas fotos', 'aluno lê as suas fotos', 'profissional lê fotos dos alunos');
-- Esperado: as 3 políticas.

-- 6. O bucket de fotos está privado?
select id, public from storage.buckets where id = 'progress-photos';
-- Esperado: public = false. Se vier "true" (ou o bucket nem existir ainda),
-- confirma/cria em Storage > progress-photos > Settings no painel — este é o
-- único passo que não é garantido só por SQL em todos os projetos.

-- 7. A função de verificação "append-only" existe?
select routine_name from information_schema.routines
where routine_name = 'jsonb_array_is_append_only';
-- Esperado: 1 linha. Protege substitution_history/adaptation_history contra
-- reescrita — o aluno só pode acrescentar eventos, nunca alterar/remover os
-- que já lá estavam (ver bloco F mais abaixo para o teste funcional).

-- 8. A função de reclamar o convite existe e está acessível ao aluno?
select routine_name, security_type
from information_schema.routines
where routine_name = 'claim_student_row';
select grantee, privilege_type
from information_schema.role_routine_grants
where routine_name = 'claim_student_row';
-- Esperado: 1 linha com security_type = 'DEFINER', e um grant de EXECUTE
-- para "authenticated". Um UPDATE direto na tabela para esta operação
-- específica não se mostrou fiável (ver nota histórica no fim do ficheiro);
-- a app usa sb.rpc("claim_student_row") em vez disso.

-- 9. Políticas de help_requests / help_request_notes existem, com o desenho certo?
-- (Fase 8 — aplicada e validada em 2026-09-25.)
select schemaname, tablename, policyname, cmd
from pg_policies
where tablename in ('help_requests', 'help_request_notes')
order by tablename, policyname;
-- Esperado: "help_requests" tem 3 políticas (professional manages help
-- requests / student creates own help request / student reads own help
-- requests) — nenhuma de update/delete para o aluno. "help_request_notes"
-- tem EXATAMENTE 1 política (professional manages help request notes) — se
-- aparecer qualquer política com "student" no nome aqui, é uma regressão
-- grave: o aluno passaria a poder tocar em notas privadas.

-- 10. Confirma explicitamente que o aluno não tem NENHUMA política de
-- update/delete em help_requests, nem NENHUMA política (de qualquer tipo)
-- em help_request_notes.
select tablename, cmd, count(*)
from pg_policies
where tablename in ('help_requests','help_request_notes')
  and policyname ilike '%student%'
group by tablename, cmd;
-- Esperado: só duas linhas — help_requests / INSERT / 1 (a de criar) e
-- help_requests / SELECT / 1 (a de ler). NUNCA deve aparecer help_requests
-- com cmd UPDATE ou DELETE, nem NENHUMA linha para help_request_notes.

-- ===================== Testes funcionais (fazer com 2 contas reais) =====================
-- Estes não são queries SQL — são passos manuais na app, porque head de duas
-- sessões de browser autenticadas com utilizadores diferentes para teres
-- confiança real de que a RLS está a bloquear e não só a aparência da UI:
--
-- A. Aluno A não vê nem altera dados do Aluno B:
--    1. Inicia sessão como Aluno A (email de convite da Maria, por exemplo).
--    2. Abre a consola do browser (F12) e corre:
--         await sb.from("students").select("*")
--       Esperado: só vem a linha do Aluno A.
--         await sb.from("students").update({notes:"teste"}).eq("id","<id do aluno B>")
--       Esperado: 0 linhas afetadas (RLS bloqueia — não é a linha do Aluno A).
--
-- B. Aluno não altera plano nem notas do PRÓPRIO registo:
--    Ainda com sessão de Aluno A, na consola:
--         await sb.from("students").update({notes:"tentativa"}).eq("id","<id do próprio aluno>")
--       Esperado: erro "Só o profissional pode alterar estes dados do plano."
--    Isto confirma que o trigger bloqueia mesmo dentro da própria linha.
--
-- C. Profissional autorizado gere alunos normalmente:
--    Inicia sessão como profissional, confirma que vês todos os alunos e que
--    guardar alvos/notas/plano/flexibilidade continua a funcionar sem erros.
--
-- D. Conta sem aluno associado não acede a nada:
--    Cria uma conta nova com um email que NUNCA foi usado como invite_email
--    de nenhum aluno. Depois de login, a app deve mostrar o ecrã "sem aluno
--    associado" — e na consola, "await sb.from('students').select('*')"
--    deve devolver uma lista vazia.
--
-- E. Plano (meals) é rejeitado, execução diária (meal_daily_state) é aceite:
--    Ainda com sessão de Aluno A, na consola:
--         await sb.from("students").update({meals: []}).eq("id","<id do próprio aluno>")
--       Esperado: erro "Só o profissional pode alterar estes dados do plano."
--       — meals já não está na allowlist, mesmo dentro da própria linha.
--         await sb.from("students").update({meal_daily_state: {date:"2099-01-01", entries:{}}}).eq("id","<id do próprio aluno>")
--       Esperado: sucesso (0 ou mais linhas, sem erro) — esta é a coluna que o
--       aluno usa no dia a dia (concluir, adaptar, ignorar, reagendar, escolhas
--       do construtor, substituições dentro das opções permitidas).
--       Na app, confirma visualmente: marcar uma refeição como concluída e
--       recarregar a página mantém o estado; o profissional continua a poder
--       editar nome/horário/alimentos/quantidades das refeições sem qualquer
--       erro (a política dele nunca passa pelo trigger de colunas).
--
-- F. O aluno pode acrescentar ao histórico de adaptações, mas não reescrevê-lo:
--    Ainda com sessão de Aluno A, na consola, lê primeiro o histórico atual:
--         var { data } = await sb.from("students").select("adaptation_history").eq("id","<id do próprio aluno>").single()
--       Depois tenta apagar tudo:
--         await sb.from("students").update({adaptation_history: []}).eq("id","<id do próprio aluno>")
--       Esperado: erro "Não é permitido alterar ou remover histórico de
--       adaptações já registado." (a não ser que data.adaptation_history já
--       estivesse vazio — nesse caso usa a app para gerar um evento primeiro,
--       ex.: ignora uma refeição, e repete o teste).
--       Depois tenta ACRESCENTAR um evento a seguir aos existentes:
--         await sb.from("students").update({adaptation_history: data.adaptation_history.concat([{date:"2099-01-01", type:"teste"}])}).eq("id","<id do próprio aluno>")
--       Esperado: sucesso — acrescentar ao fim é permitido.
--       Repete o mesmo raciocínio para substitution_history se quiseres.
--
-- G. Pedidos de ajuda (Fase 8 — validado com 2 contas de aluno reais e 1 de profissional em 2026-09-25):
--    Precisas de duas contas de aluno (A e B) e a conta de profissional.
--
--    G1. Aluno A cria e lê o próprio pedido:
--        Sessão de Aluno A, na consola:
--          await sb.from("help_requests").insert({student_id:"<id do próprio aluno>", situation:"duvida", note:"teste"})
--        Esperado: sucesso.
--          await sb.from("help_requests").select("*").eq("student_id","<id do próprio aluno>")
--        Esperado: vem o pedido que acabou de criar.
--
--    G2. Aluno A NUNCA vê pedidos do Aluno B:
--        Ainda como Aluno A:
--          await sb.from("help_requests").select("*").eq("student_id","<id do aluno B>")
--        Esperado: lista vazia (mesmo que B tenha pedidos reais).
--
--    G3. Aluno A não consegue criar um pedido em nome do Aluno B:
--          await sb.from("help_requests").insert({student_id:"<id do aluno B>", situation:"duvida"})
--        Esperado: 0 linhas inseridas / erro de RLS.
--
--    G4. Aluno A não altera nem apaga o próprio pedido depois de criado:
--        Usa o "id" devolvido pelo insert de G1:
--          await sb.from("help_requests").update({status:"tratado"}).eq("id","<id do pedido>")
--        Esperado: 0 linhas afetadas (sem policy de update para o aluno).
--          await sb.from("help_requests").delete().eq("id","<id do pedido>")
--        Esperado: 0 linhas afetadas.
--
--    G5. Aluno A NUNCA lê nem escreve notas privadas — nem sequer as do
--        próprio pedido:
--          await sb.from("help_request_notes").select("*").eq("request_id","<id do pedido>")
--        Esperado: lista vazia (não é erro — é RLS a agir como se a tabela
--        estivesse sempre vazia para ele).
--          await sb.from("help_request_notes").insert({request_id:"<id do pedido>", professional_note:"tentativa"})
--        Esperado: erro de RLS / 0 linhas inseridas.
--
--    G6. Profissional lê o pedido, cria uma nota privada e marca como tratado:
--        Sessão de profissional:
--          await sb.from("help_requests").select("*, help_request_notes(*)").eq("student_id","<id do aluno A>")
--        Esperado: vem o pedido de G1.
--          await sb.from("help_request_notes").upsert({request_id:"<id do pedido>", professional_note:"Respondido por telefone."})
--        Esperado: sucesso.
--          await sb.from("help_requests").update({status:"tratado"}).eq("id","<id do pedido>")
--        Esperado: sucesso.
--        Confirma também na app: separador "Pedidos" do aluno A mostra o
--        pedido como "Tratado" com a nota visível — e que a MESMA nota nunca
--        aparece em lado nenhum da experiência de Aluno.
--
-- 11. Flag is_demo existe e os alunos de demonstração/teste estão marcados?
-- (Fase 9 — aplicada e validada em 2026-09-28.)
select id, name, is_demo from students order by id;
-- Esperado: maria/rui/sofia/tiago com is_demo = true; qualquer aluno real
-- (convidado depois desta migração) com is_demo = false.

-- 12. As políticas de remoção de fotografias existem?
-- (Fase 9 — aplicada e validada em 2026-09-28.)
select policyname, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname in ('aluno remove as suas fotos', 'profissional remove fotos dos alunos');
-- Esperado: as 2 políticas, ambas com cmd = DELETE.

-- ===================== Teste funcional H: remoção de fotografias (Fase 9) =====================
-- Validado em 2026-09-28 com a conta real do Tiago e uma fotografia
-- sintética criada só para o teste (nunca uma fotografia real). Encontrou e
-- levou à correção de um bug crítico não relacionado com esta migração:
-- persistStudent() usava upsert(), que falha sempre que é o PRÓPRIO ALUNO a
-- gravar (RLS rejeita o ramo ON CONFLICT DO UPDATE por não haver política de
-- INSERT para o aluno) — impedia qualquer aluno real de gravar seja o que
-- for. Corrigido para update().eq("id", s.id); ver evolve-nutrition.html.
-- Sessão de um aluno real com allowPhotos ativo:
--   H1. Faz upload de uma fotografia pela app (separador Evolução).
--   H2. Na consola: var { data } = await sb.storage.from("progress-photos").list(sb.auth.getUser() then .data.user.id)
--       Esperado: aparece o ficheiro que acabaste de enviar.
--   H3. Na app, toca no "✕" sobre a fotografia e confirma a remoção.
--   H4. Repete o list() do passo H2 — Esperado: o ficheiro já não aparece.
--   H5. Confirma que students.photos (SQL Editor, select photos from students
--       where id = '<id do aluno>') já não tem essa entrada.

-- ===================== Nota histórica: reclamar o convite =====================
-- Ao validar o fluxo D (conta nova, sem aluno associado) com uma conta de
-- aluno real criada via convite, um UPDATE direto na tabela para associar
-- auth_user_id (a política "student claims invited row", mesmo corrigida
-- para usar auth.email() e com a condição confirmada como verdadeira por uma
-- função de diagnóstico) continuava a afetar 0 linhas quando feito via
-- PostgREST. Não foi isolada a causa exata dessa discrepância nesta sessão.
-- A solução foi mover essa operação específica para uma função
-- (claim_student_row, SECURITY DEFINER — ver 0008_claim_via_function.sql),
-- que foi confirmada a funcionar com essa mesma conta real. A app já usa
-- sb.rpc("claim_student_row") em vez de um UPDATE direto (ver handleSession
-- em evolve-nutrition.html). A política "student claims invited row" continua
-- a existir (não faz mal manter), mas deixou de ser o caminho usado pela app.

-- ===================== Teste funcional I: o peso é só do profissional (migração 0031) =====================
-- Corre DEPOIS de 0031. Não validado ainda no projeto Supabase real: faz estes passos com a conta de um aluno real e com a do profissional.
--   I1. select pg_get_functiondef('enforce_student_column_permissions'::regproc) like '%''weights''%';
--       Esperado: false (nem 'weights' nem 'weight_current' na lista de colunas do aluno).
--   I2. Sessão do ALUNO, na consola do browser:
--         await sb.from('students').update({weights: [{date:'2026-01-01', w: 50}]}).eq('id', '<id do aluno>').select('id')
--       Esperado: erro «Só o profissional pode alterar estes dados do plano.»
--   I3. Idem com {weight_current: 50} — Esperado: o mesmo erro.
--   I4. Sessão do ALUNO: {assessments: []} — Esperado: o mesmo erro (já era assim).
--   I5. Sessão do ALUNO: registar uma refeição/um treino na app — Esperado: grava normalmente (colunas autorizadas).
--   I6. Sessão do PROFISSIONAL: guardar uma avaliação com peso — Esperado: grava (weights, weight_current e assessments).

-- ===================== Teste funcional J: Corrida (migração 0032) =====================
-- Corre DEPOIS de 0032_corrida.sql e ANTES de ligar a Corrida ('import' ou 'live') a qualquer aluno real. Quatro partes:
--   J-A  consultas de estado (políticas, direitos de tabela, RLS, gatilhos): só leem.
--   J-B  simulação completa no SQL Editor, com as contas reais já existentes (1 profissional + 2 alunos com conta), sem gravar NADA:
--        termina sempre com um erro de propósito, que desfaz tudo (é assim que se garante o «rollback final»).
--   J-C  passos manuais pela consola da app, com as 2 contas de aluno e a do profissional REAIS (PostgREST e GoTrue verdadeiros).
--   J-D  limpeza.
-- O que a simulação J-B NÃO prova: ela fixa o utilizador por set_config, não passa por GoTrue nem PostgREST nem pelo JWT. Só a parte J-C o faz.
-- O mesmo SQL de J-B corre também, contra um Postgres local descartável, em tests/runs-db.test.js (aí prova-se que o script funciona);
-- no Supabase real ainda nunca foi corrido.

-- J-A. 13. As políticas esperadas existem, sem nenhuma de update nem «all»?
select tablename, count(*) as politicas, string_agg(cmd, ', ' order by cmd) as comandos
from pg_policies
where tablename in ('run_consents', 'runs', 'run_tracks')
group by tablename
order by tablename;
-- Esperado: run_consents 4 (DELETE, INSERT, SELECT, SELECT); run_tracks 5 (DELETE, DELETE, INSERT, SELECT, SELECT);
-- runs 5 (DELETE, DELETE, INSERT, SELECT, SELECT). NUNCA aparece UPDATE nem ALL. Se aparecer, é uma regressão grave.

-- J-A. 14. Direitos de tabela (has_table_privilege). A 0032 tira tudo a anon e a authenticated e dá a authenticated só select, insert e delete.
select t as tabela,
       has_table_privilege('authenticated', t, 'select')   as aluno_pt_select,
       has_table_privilege('authenticated', t, 'insert')   as aluno_pt_insert,
       has_table_privilege('authenticated', t, 'delete')   as aluno_pt_delete,
       has_table_privilege('authenticated', t, 'update')   as aluno_pt_update,
       has_table_privilege('authenticated', t, 'truncate') as aluno_pt_truncate,
       has_table_privilege('anon', t, 'select')            as anon_select,
       has_table_privilege('anon', t, 'insert')            as anon_insert,
       has_table_privilege('anon', t, 'delete')            as anon_delete
from unnest(array['run_consents', 'runs', 'run_tracks']) t
order by t;
-- Esperado nas 3 linhas: true, true, true, false, false, false, false, false.
-- (O Supabase anuncia que a partir de 30/10/2026 as tabelas novas deixam de receber direitos por omissão em projetos existentes. A 0032 não depende
-- disso porque concede e retira explicitamente; esta consulta confirma o resultado no projeto real.)

-- J-A. 15. RLS ligada nas 3 tabelas, e NÃO forçada (a cascata de apagar corre como dono e tem de passar por cima da RLS)?
select relname, relrowsecurity as rls_ligada, relforcerowsecurity as rls_forcada
from pg_class
where relname in ('run_consents', 'runs', 'run_tracks') and relkind = 'r'
order by relname;
-- Esperado nas 3 linhas: true, false.

-- J-A. 16. A coluna runs_mode, o seu CHECK, o gatilho de colunas do aluno (0031, NÃO recriado) e os gatilhos/restrições da Corrida.
select column_name, data_type, is_nullable, column_default from information_schema.columns where table_name = 'students' and column_name = 'runs_mode';
-- Esperado: 1 linha, text, NO, 'off'::text. Alunos que já existiam ficam todos em 'off':
select runs_mode, count(*) from students group by runs_mode order by runs_mode;
select pg_get_constraintdef(oid) as restricao from pg_constraint where conname = 'students_runs_mode_check';
-- Esperado: CHECK ((runs_mode = ANY (ARRAY['off'::text, 'import'::text, 'live'::text]))).
select position('runs_mode' in pg_get_functiondef('enforce_student_column_permissions'::regproc)) = 0 as runs_mode_fora_da_lista_do_aluno;
-- Esperado: true (runs_mode NÃO está na lista de colunas que o aluno pode escrever; é o gatilho de 0031 que o impede de a mudar).
select tgrelid::regclass as tabela, tgname, tgenabled from pg_trigger
where tgrelid in ('run_consents'::regclass, 'runs'::regclass, 'run_tracks'::regclass) and not tgisinternal order by 1, 2;
-- Esperado: run_consents trg_run_consent_withdrawn (O) e trg_run_consents_stamp (O); runs trg_runs_stamp (O).
select conname, conrelid::regclass as tabela from pg_constraint
where conname in ('runs_consent_fk', 'run_tracks_points_valid', 'runs_speed_plausible', 'runs_moving_le_duration') order by conname;
-- Esperado: as 4 restrições.
select proacl::text from pg_proc where proname = 'run_consent_withdrawn';
-- Esperado: só o dono ({postgres=X/postgres}); a função do gatilho não fica chamável por anon nem authenticated.

-- J-B. Simulação completa, sem gravar nada. Corre TUDO o que está entre as marcas «>>> J-B» e «<<< J-B» de uma só vez (as duas funções temporárias e o
-- bloco DO vão juntos: selecionar tudo e Run; se disser que pg_temp.j_as não existe, é porque foram executados em separado). Precisa de 1 profissional e
-- de 2 alunos com conta (students.auth_user_id) já existentes: usa os dois primeiros por ordem de id, só dentro da transação que o erro final desfaz.
-- Usa a versão de aviso 32000 para nunca colidir com um consentimento real. O resultado aparece na MENSAGEM DE ERRO final («J-B concluído ... n ok, 0 falhas»).
-- Nota: retirar o consentimento apaga TODAS as corridas do aluno A, por isso a simulação também as apaga, mas só até ao rollback automático do erro final.
-- >>> J-B (início)
create or replace function pg_temp.j_as(uid uuid, stmt text, rl text default 'authenticated') returns text language plpgsql as $f$
declare n int; st text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  perform set_config('request.jwt.claims', case when uid is null then '' else json_build_object('sub', uid, 'role', rl)::text end, true);
  execute 'set local role ' || rl;
  execute stmt;
  get diagnostics n = row_count;
  reset role;
  return 'ok ' || n;
exception when others then
  get stacked diagnostics st = returned_sqlstate;
  reset role;
  return 'erro ' || st;
end $f$;

create or replace function pg_temp.j_line(name text, got text, expected text) returns text language sql as $f$
  select case when (expected = 'ok+' and got ~ '^ok [1-9]') or (expected <> 'ok+' and got = expected)
    then 'OK      ' || name || E'\n'
    else 'FALHOU  ' || name || ' (esperado ' || expected || ', obtido ' || got || E')\n' end
$f$;

do $sim$
declare
  pt uuid; a_id text; a_uid uuid; b_id text; b_uid uuid;
  v constant smallint := 32000;
  r1 uuid := gen_random_uuid(); r2 uuid := gen_random_uuid();
  rep text := ''; got text; n_ok int; n_bad int;
  ins text := 'insert into runs (id, student_id, created_by, started_at, source, duration_s, moving_s, distance_m, consent_v) values (%L, %L, %L, now() - interval ''1 hour'', %L, 1800, 1700, 5000, %s)';
  trk text := 'insert into run_tracks (run_id, student_id, trim_m, points) values (%L, %L, 200, ''[[[38.7, -9.1, 0], [38.71, -9.11, 60]]]'')';
begin
  select user_id into pt from professionals order by user_id limit 1;
  select id, auth_user_id into a_id, a_uid from students where auth_user_id is not null and auth_user_id <> pt order by id limit 1;
  select id, auth_user_id into b_id, b_uid from students where auth_user_id is not null and auth_user_id <> pt and id <> a_id order by id limit 1;
  if pt is null or a_id is null or b_id is null then
    raise exception 'J-B: faltam contas. Precisa de 1 profissional (tabela professionals) e de 2 alunos com conta (students.auth_user_id).';
  end if;
  rep := rep || format(E'Aluno A = %s, aluno B = %s\n', a_id, b_id);

  -- direitos
  rep := rep || pg_temp.j_line('S01 direitos: authenticated select/insert/delete sim, update/truncate não; anon nada nas 3 tabelas',
    (select string_agg(has_table_privilege('authenticated', t, 'select')::text || has_table_privilege('authenticated', t, 'insert')::text || has_table_privilege('authenticated', t, 'delete')::text
      || has_table_privilege('authenticated', t, 'update')::text || has_table_privilege('authenticated', t, 'truncate')::text
      || has_table_privilege('anon', t, 'select')::text || has_table_privilege('anon', t, 'insert')::text || has_table_privilege('anon', t, 'delete')::text, ',')
     from unnest(array['run_consents', 'runs', 'run_tracks']) t),
    'truetruetruefalsefalsefalsefalsefalse,truetruetruefalsefalsefalsefalsefalse,truetruetruefalsefalsefalsefalsefalse');

  -- o profissional liga A e B (fica desfeito no fim)
  rep := rep || pg_temp.j_line('S02 o profissional liga A e B a import', pg_temp.j_as(pt, format('update students set runs_mode = ''import'' where id in (%L, %L)', a_id, b_id)), 'ok 2');
  rep := rep || pg_temp.j_line('S03 A sem consentimento não cria corrida', pg_temp.j_as(a_uid, format(ins, r1, a_id, a_uid, 'gpx', v)), 'erro 42501');
  rep := rep || pg_temp.j_line('S04 A dá o consentimento', pg_temp.j_as(a_uid, format('insert into run_consents (student_id, version) values (%L, %s)', a_id, v)), 'ok 1');
  rep := rep || pg_temp.j_line('S05 repetir o consentimento = já existe (23505)', pg_temp.j_as(a_uid, format('insert into run_consents (student_id, version) values (%L, %s)', a_id, v)), 'erro 23505');
  rep := rep || pg_temp.j_line('S06 A não dá consentimento em nome de B', pg_temp.j_as(a_uid, format('insert into run_consents (student_id, version) values (%L, %s)', b_id, v)), 'erro 42501');
  rep := rep || pg_temp.j_line('S07 A cria a sua corrida (gpx)', pg_temp.j_as(a_uid, format(ins, r1, a_id, a_uid, 'gpx', v)), 'ok 1');
  rep := rep || pg_temp.j_line('S08 corrida live com o modo import = recusada', pg_temp.j_as(a_uid, format(ins, gen_random_uuid(), a_id, a_uid, 'live', v)), 'erro 42501');
  rep := rep || pg_temp.j_line('S09 corrida para o aluno B = recusada', pg_temp.j_as(a_uid, format(ins, gen_random_uuid(), b_id, a_uid, 'gpx', v)), 'erro 42501');
  rep := rep || pg_temp.j_line('S10 corrida com created_by de outro = recusada', pg_temp.j_as(a_uid, format(ins, gen_random_uuid(), a_id, b_uid, 'gpx', v)), 'erro 42501');
  rep := rep || pg_temp.j_line('S11 corrida com consent_v que A não aceitou = recusada', pg_temp.j_as(a_uid, format(ins, gen_random_uuid(), a_id, a_uid, 'gpx', v + 1)), 'erro 42501');
  rep := rep || pg_temp.j_line('S12 velocidade impossível = recusada (CHECK)', pg_temp.j_as(a_uid, format('insert into runs (student_id, started_at, source, duration_s, moving_s, distance_m, consent_v) values (%L, now(), ''gpx'', 100, 100, 5000, %s)', a_id, v)), 'erro 23514');

  -- isolamento
  rep := rep || pg_temp.j_line('S13 B não vê as corridas de A', pg_temp.j_as(b_uid, format('select * from runs where student_id = %L', a_id)), 'ok 0');
  rep := rep || pg_temp.j_line('S14 B não apaga corridas de A', pg_temp.j_as(b_uid, format('delete from runs where student_id = %L', a_id)), 'ok 0');
  rep := rep || pg_temp.j_line('S15 B não vê o consentimento de A', pg_temp.j_as(b_uid, format('select * from run_consents where student_id = %L', a_id)), 'ok 0');
  rep := rep || pg_temp.j_line('S16 B não retira o consentimento de A', pg_temp.j_as(b_uid, format('delete from run_consents where student_id = %L', a_id)), 'ok 0');
  rep := rep || pg_temp.j_line('S17 anónimo não lê corridas', pg_temp.j_as(null, 'select * from runs', 'anon'), 'erro 42501');

  -- sem update, e runs_mode só do profissional
  rep := rep || pg_temp.j_line('S18 A não faz update às corridas', pg_temp.j_as(a_uid, format('update runs set distance_m = 1 where student_id = %L', a_id)), 'erro 42501');
  rep := rep || pg_temp.j_line('S19 A não liga a Corrida a si próprio (live) — gatilho 0031', pg_temp.j_as(a_uid, format('update students set runs_mode = ''live'' where id = %L', a_id)), 'erro P0001');
  rep := rep || pg_temp.j_line('S20 A não a desliga nem a repõe a off', pg_temp.j_as(a_uid, format('update students set runs_mode = ''off'' where id = %L', a_id)), 'erro P0001');

  -- percursos
  rep := rep || pg_temp.j_line('S21 A partilha o percurso da sua corrida', pg_temp.j_as(a_uid, format(trk, r1, a_id)), 'ok 1');
  rep := rep || pg_temp.j_line('S22 o profissional vê o percurso', pg_temp.j_as(pt, format('select * from run_tracks where run_id = %L', r1)), 'ok 1');
  rep := rep || pg_temp.j_line('S23 B não vê o percurso de A', pg_temp.j_as(b_uid, format('select * from run_tracks where run_id = %L', r1)), 'ok 0');
  rep := rep || pg_temp.j_line('S24 A apaga só o percurso', pg_temp.j_as(a_uid, format('delete from run_tracks where run_id = %L', r1)), 'ok 1');
  rep := rep || pg_temp.j_line('S25 … e a corrida fica', (select 'ok ' || count(*) from runs where id = r1), 'ok 1');
  rep := rep || pg_temp.j_line('S26 percurso com texto escondido nas coordenadas = recusado (CHECK)', pg_temp.j_as(a_uid, format('insert into run_tracks (run_id, student_id, points) values (%L, %L, ''[[["<b>x</b>", 1, 0]]]'')', r1, a_id)), 'erro 23514');
  rep := rep || pg_temp.j_line('S27 B anexa percurso a corrida de A (student_id de B) = chave estrangeira composta', pg_temp.j_as(b_uid, format(trk, r1, b_id)), 'erro 23503');

  -- profissional: lê e apaga, não cria
  rep := rep || pg_temp.j_line('S28 o profissional não cria corridas', pg_temp.j_as(pt, format(ins, gen_random_uuid(), a_id, pt, 'manual', v)), 'erro 42501');
  rep := rep || pg_temp.j_line('S29 o profissional não altera corridas', pg_temp.j_as(pt, format('update runs set notes = ''x'' where id = %L', r1)), 'erro 42501');
  rep := rep || pg_temp.j_line('S30 o profissional lê a corrida de A', pg_temp.j_as(pt, format('select * from runs where id = %L', r1)), 'ok 1');
  rep := rep || pg_temp.j_line('S31 o profissional lê o consentimento de A', pg_temp.j_as(pt, format('select * from run_consents where student_id = %L', a_id)), 'ok+');
  rep := rep || pg_temp.j_line('S32 o profissional não retira consentimentos', pg_temp.j_as(pt, format('delete from run_consents where student_id = %L and version = %s', a_id, v)), 'ok 0');
  rep := rep || pg_temp.j_line('S33 A cria a 2.ª corrida', pg_temp.j_as(a_uid, format(ins, r2, a_id, a_uid, 'tcx', v)), 'ok 1');
  rep := rep || pg_temp.j_line('S34 A cria o percurso da 2.ª', pg_temp.j_as(a_uid, format(trk, r2, a_id)), 'ok 1');
  rep := rep || pg_temp.j_line('S35 o profissional apaga a 2.ª corrida', pg_temp.j_as(pt, format('delete from runs where id = %L', r2)), 'ok 1');
  rep := rep || pg_temp.j_line('S36 … e o percurso foi por cascata', (select 'ok ' || count(*) from run_tracks where run_id = r2), 'ok 0');

  -- retirar o consentimento = apagar tudo
  rep := rep || pg_temp.j_line('S37 A retira o consentimento', pg_temp.j_as(a_uid, format('delete from run_consents where student_id = %L and version = %s', a_id, v)), 'ok 1');
  rep := rep || pg_temp.j_line('S38 … e não ficou nenhuma corrida de A', (select 'ok ' || count(*) from runs where student_id = a_id), 'ok 0');
  rep := rep || pg_temp.j_line('S39 … nem nenhum percurso de A', (select 'ok ' || count(*) from run_tracks where student_id = a_id), 'ok 0');
  rep := rep || pg_temp.j_line('S40 sem consentimento, A já não cria corridas', pg_temp.j_as(a_uid, format(ins, gen_random_uuid(), a_id, a_uid, 'gpx', v)), 'erro 42501');

  n_ok := (length(rep) - length(replace(rep, 'OK      ', ''))) / 8;
  n_bad := (length(rep) - length(replace(rep, 'FALHOU  ', ''))) / 8;
  -- erro de propósito: desfaz TUDO o que esta simulação fez (a lista de resultados vai na mensagem)
  raise exception E'J-B concluído (nada foi gravado): % ok, % falhas\n%', n_ok, n_bad, rep;
end $sim$;
-- <<< J-B (fim)
-- Esperado: um erro cuja mensagem começa por «J-B concluído (nada foi gravado): 40 ok, 0 falhas» e em que nenhuma linha começa por FALHOU.

-- J-C. Passos manuais J1 a J11 com 2 contas de aluno (A e B) e a do profissional, REAIS, pela consola do browser (F12) da app EVOLVE Treino.
--    Esta é a única parte que prova o isolamento através do PostgREST e do GoTrue verdadeiros. Faz tudo com alunos de teste e liga a Corrida
--    SÓ a um aluno de teste ('import'); só depois, e se tudo passar, a alunos reais, um de cada vez.
--    J1. Direitos: a consulta 14 acima (Esperado: true, true, true, false, false, false, false, false).
--    J2. Sessão do PROFISSIONAL: await sb.from('students').update({runs_mode:'import'}).eq('id','<id do aluno A>').select('id')
--        Esperado: 1 linha. Sessão do aluno A, SEM consentimento ainda:
--          await sb.from('runs').insert({student_id:'<id de A>', started_at:new Date().toISOString(), source:'gpx', duration_s:1800, moving_s:1700, distance_m:5000, consent_v:1})
--        Esperado: erro 42501 (row-level security).
--    J3. Sessão de A: await sb.from('run_consents').insert({student_id:'<id de A>', version:1}) — Esperado: sucesso. Repetir — Esperado: erro 23505.
--    J4. Sessão de A: repetir o insert de J2 com id:crypto.randomUUID() — Esperado: sucesso. Com source:'live' — Esperado: erro 42501 (modo import).
--        Com student_id:'<id de B>' — Esperado: erro 42501. Com consent_v:2 — Esperado: erro 42501.
--    J5. Sessão de B: await sb.from('runs').select('*').eq('student_id','<id de A>') — Esperado: lista vazia.
--        await sb.from('runs').delete().eq('student_id','<id de A>').select('id') — Esperado: lista vazia (0 linhas).
--        await sb.from('run_tracks').select('*') e await sb.from('run_consents').select('*') — Esperado: nada de A.
--    J6. Sessão de A: await sb.from('runs').update({notes:'x'}).eq('student_id','<id de A>') — Esperado: erro 42501 (permission denied).
--        await sb.from('students').update({runs_mode:'live'}).eq('id','<id de A>') — Esperado: erro «Só o profissional pode alterar estes dados do plano.»
--    J7. Sessão de A, com o id da corrida de J4: await sb.from('run_tracks').insert({run_id:'<id>', student_id:'<id de A>', trim_m:200, points:[[[38.7,-9.1,0],[38.71,-9.11,60]]]})
--        Esperado: sucesso. Sessão do PROFISSIONAL: await sb.from('run_tracks').select('*').eq('run_id','<id>') — Esperado: 1 linha. Sessão de B: lista vazia.
--    J8. Sessão de A: await sb.from('run_tracks').delete().eq('run_id','<id>').select('run_id') — Esperado: 1 linha; a corrida continua a existir.
--        Depois: await sb.from('runs').delete().eq('id','<id>').select('id') — Esperado: 1 linha.
--    J9. Sessão do PROFISSIONAL: o insert de J4 com created_by do profissional — Esperado: erro 42501. Apagar uma corrida de A (criar outra
--        primeiro) — Esperado: 1 linha apagada.
--    J10. Sessão de A, com 1 corrida e 1 percurso gravados: await sb.from('run_consents').delete().eq('student_id','<id de A>').select('version')
--        Esperado: 1 linha; e depois await sb.from('runs').select('id') e await sb.from('run_tracks').select('run_id') devolvem listas vazias.
--    J11. Antes de aplicar a 0032 (em projeto de teste, ou lendo o erro que a app mostra): await sb.from('runs').select('id').limit(1)
--        Esperado: erro de tabela em falta (documentado como PGRST205; anotar o código real). Depois de aplicar: sucesso.
--        Se, logo a seguir a aplicar, a app disser «Corrida indisponível»: é a cache de esquema do PostgREST; esperar um minuto ou executar
--        notify pgrst, 'reload schema';
-- J12 (J-D). Limpeza: repõe o aluno de teste e apaga o que sobrou (como profissional):
--    update students set runs_mode = 'off' where id in ('<id de A>', '<id de B>');
--    delete from runs where student_id in ('<id de A>', '<id de B>');   -- os percursos saem por cascata
--    delete from run_consents where student_id in ('<id de A>', '<id de B>');
