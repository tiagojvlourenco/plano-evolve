-- EVOLVE NUTRITION — Fase 40: pacotes de sessões partilhados (casais e duplas que pagam um só pacote)
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0027 já terem corrido. É seguro voltar a correr.
--
-- session_packs.shared_with — lista de ids de alunos que também podem usar este pacote, além do dono (student_id).
-- Uma sessão de qualquer um deles desconta ao pacote que caduca primeiro (entre os pacotes de cada um e os partilhados),
-- por isso, mesmo que um tenha 13 aulas e o outro 26, as aulas são de ambos e acabam sempre ao mesmo tempo.
-- Só profissionais leem e escrevem (as políticas de session_packs já são só para profissionais).

alter table session_packs add column if not exists shared_with jsonb not null default '[]'::jsonb;
alter table session_packs drop constraint if exists session_packs_shared_with_array;
alter table session_packs add constraint session_packs_shared_with_array check (jsonb_typeof(shared_with) = 'array' and jsonb_array_length(shared_with) <= 10);
