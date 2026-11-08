-- EVOLVE NUTRITION — Fase 38 (Y1): versão otimista da ficha do aluno
-- Corre isto no SQL Editor do Supabase. É seguro voltar a correr. Aditivo: não muda nenhuma coluna existente.
--
-- Problema: o profissional com a app aberta em dois aparelhos (ou o aluno a gravar enquanto o profissional edita) podia
-- sobrescrever, sem aviso, a coluna que o outro acabou de mudar (a app envia só as colunas alteradas, mas cada coluna inteira).
-- Solução: cada ficha tem um contador `rev` que sobe em cada UPDATE. A app do profissional envia `update ... where rev = <o que leu>`;
-- se não alterar nenhuma linha, lê a ficha, vê se as colunas que quer gravar mudaram mesmo e, só nesse caso, pergunta.
--
-- O gatilho chama-se zz_… para correr DEPOIS de trg_enforce_student_column_permissions (os gatilhos BEFORE correm por ordem alfabética):
-- essa função recusa ao aluno qualquer coluna fora da lista, e `rev` não está nela, por isso o contador só pode subir depois da verificação.

alter table students add column if not exists rev bigint not null default 0;

create or replace function students_bump_rev()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.rev := coalesce(old.rev, 0) + 1; -- ignora qualquer valor enviado pelo cliente
  return new;
end;
$$;

drop trigger if exists zz_students_bump_rev on students;
create trigger zz_students_bump_rev
  before update on students
  for each row execute function students_bump_rev();

-- Verificação: select column_name from information_schema.columns where table_name='students' and column_name='rev';
