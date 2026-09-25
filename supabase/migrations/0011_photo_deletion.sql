-- EVOLVE NUTRITION — Fase 9: permitir remover fotografias de progresso
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0010 já terem corrido.
-- AINDA NÃO APLICADA nem validada com dados reais.
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
-- Ainda NÃO foi aplicada em produção. Depois de aplicada, valida com uma
-- conta de aluno real: fazer upload de uma foto de teste, confirmar que
-- aparece, remover, e confirmar que sb.storage.from("progress-photos").list()
-- já não a lista e que students.photos já não tem essa entrada.
