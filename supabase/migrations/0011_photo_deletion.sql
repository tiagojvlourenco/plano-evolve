-- EVOLVE NUTRITION — Fase 9: permitir remover fotografias de progresso
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0010 já terem corrido.
-- APLICADA e validada em produção em 2026-09-28 (teste funcional H, com uma
-- fotografia sintética criada só para o teste — nunca uma fotografia real).
--
-- Encontrado na auditoria da Fase 9: existiam políticas de insert e select
-- para "progress-photos", mas NENHUMA de delete — não havia forma de um
-- aluno pedir a remoção de uma fotografia (nem sequer o profissional a
-- conseguia apagar do Storage, só deixar de a listar, o que não é o mesmo
-- que apagar). Isto acrescenta as duas políticas em falta, seguindo
-- exatamente o mesmo padrão de pasta por utilizador já usado nas políticas
-- de insert/select em 0004_security_hardening.sql.

drop policy if exists "aluno remove as suas fotos" on storage.objects;
create policy "aluno remove as suas fotos" on storage.objects
  for delete
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "profissional remove fotos dos alunos" on storage.objects;
create policy "profissional remove fotos dos alunos" on storage.objects
  for delete
  using (
    bucket_id = 'progress-photos'
    and exists (select 1 from professionals where user_id = auth.uid())
  );

-- ===================== Procedimento de remoção a pedido do aluno =====================
-- Via app (preferido): o aluno abre "Evolução" → toca no "✕" sobre a
-- fotografia → confirma. Isto chama sb.storage.from("progress-photos").remove()
-- e depois grava students.photos sem essa entrada — ambos os passos exigem
-- as políticas acima.
-- Via profissional: o mesmo botão "✕" existe na vista do profissional
-- (separador Evolução do aluno), para quando o aluno pede a remoção por
-- outro canal (mensagem, chamada) em vez de o fazer ele mesmo.
-- Via painel Supabase (last resort, sem precisar destas políticas): Storage →
-- progress-photos → apagar o ficheiro manualmente. Nesse caso confirma
-- também que removes a entrada correspondente em students.photos (JSON),
-- para não ficar um "path" morto a apontar para um ficheiro inexistente.

-- ===================== Estado desta migração =====================
-- APLICADA e validada em produção em 2026-09-28, com uma fotografia
-- sintética criada só para o teste (nunca uma fotografia real): upload
-- confirmado, remoção via storage.remove() sem erro, students.photos sem a
-- entrada a seguir, sem resíduos deixados na base de dados nem no Storage.
--
-- Esta validação encontrou um bug crítico não relacionado com esta migração:
-- persistStudent() usava upsert(), que falhava sempre que era o PRÓPRIO
-- ALUNO a gravar (RLS rejeita o ramo ON CONFLICT DO UPDATE por não haver
-- política de INSERT para o aluno — e não deve haver). Isto impedia
-- qualquer aluno real de gravar seja o que for (concluir refeição, check-in,
-- fotos, etc.), não só a remoção de fotografias. Corrigido trocando
-- persistStudent() para update().eq("id", s.id); a criação de alunos (só o
-- profissional) passou a usar uma função separada, insertStudent().
