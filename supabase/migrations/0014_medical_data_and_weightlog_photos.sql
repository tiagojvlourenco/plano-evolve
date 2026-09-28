-- EVOLVE NUTRITION — Fase 11: dados médicos + fotos de pesagem de referência
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0013 já terem corrido.
-- APLICADA e validada em produção em 2026-09-28.
--
-- Pedido do profissional: (1) um separador "Dados médicos" no Perfil, para
-- registar condições médicas, medicação, lesões/limitações e observações —
-- preenchido só por ele, nunca pelo aluno (como Objetivo/Peso); (2) uma
-- forma de carregar prints de pesagens (balança/app) associados a um aluno,
-- para depois pedir à Claude, no chat, que leia os valores e os adicione
-- por data — um fluxo manual, não OCR automático dentro da app.
--
-- weight_log_photos segue exatamente o mesmo formato de "photos" (array de
-- {date, path, dataUrl} — nunca um URL público fixo, sempre resolvido por
-- URL assinado, ver resolvePhotoUrls() em evolve-nutrition.html), guardado
-- no mesmo bucket privado "progress-photos", só que sob a pasta do
-- PROFISSIONAL (não do aluno) — porque quem carrega estas fotos é sempre o
-- profissional, e um aluno convidado pode ainda nem ter conta associada
-- (auth_user_id nulo) quando o profissional quer carregar a primeira foto.

alter table students add column if not exists medical_conditions text;
alter table students add column if not exists current_medication text;
alter table students add column if not exists physical_limitations text;
alter table students add column if not exists medical_notes text;
alter table students add column if not exists weight_log_photos jsonb not null default '[]';

comment on column students.medical_conditions is
  'Condições médicas / patologias do aluno (Perfil → Dados médicos). Só o profissional edita.';
comment on column students.current_medication is
  'Medicação atual do aluno, não inclui suplementos (Perfil → Dados médicos). Só o profissional edita.';
comment on column students.physical_limitations is
  'Lesões ou limitações físicas do aluno (Perfil → Dados médicos). Só o profissional edita.';
comment on column students.medical_notes is
  'Observações médicas livres (Perfil → Dados médicos). Só o profissional edita.';
comment on column students.weight_log_photos is
  'Fotos/prints de pesagens carregados pelo profissional para referência própria (separador Evolução) — nunca visíveis ao aluno. Mesmo formato de "photos".';

-- Nota de segurança: nenhuma destas colunas está na allowlist de
-- enforce_student_column_permissions() (0004_security_hardening.sql), por
-- isso já ficam automaticamente bloqueadas para escrita pelo aluno — só o
-- profissional (que tem bypass total dessa trigger) as pode alterar. Não é
-- preciso mexer na trigger.

-- O bucket "progress-photos" já tinha política de insert só para o aluno
-- (a sua própria pasta). Falta uma para o profissional poder carregar fotos
-- de pesagem — sem restrição de pasta, tal como já acontece nas políticas
-- de select/delete do profissional, porque ele carrega para pastas de
-- alunos (ou para a própria, no caso de weight-log), nunca só a sua.
drop policy if exists "profissional envia fotos" on storage.objects;
create policy "profissional envia fotos" on storage.objects
  for insert
  with check (
    bucket_id = 'progress-photos'
    and exists (select 1 from professionals where user_id = auth.uid())
  );

-- ===================== Estado desta migração =====================
-- APLICADA e validada em produção em 2026-09-28. Confirmado no SQL Editor
-- que o único aluno real existente (tiago-lourenco, o próprio profissional)
-- ficou com todas as colunas novas a NULL / '[]', como esperado — nenhum
-- dado existente foi alterado. A política "profissional envia fotos" foi
-- criada com sucesso. O upload/leitura de fotos de pesagem em si já tinha
-- sido validado em modo local (sem ligação real ao Storage) antes desta
-- aplicação — ver commit "Fase 11: dados médicos, remove Flexibilidade,
-- fotos de pesagem de referência".
