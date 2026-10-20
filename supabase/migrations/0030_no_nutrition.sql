-- EVOLVE — alunos que NÃO fazem nutrição com o profissional (fazem com uma nutricionista)
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0029 já terem corrido. É seguro voltar a correr.
--
-- Com esta marca ligada, a app esconde todo o bloco de nutrição (plano alimentar, refeições, compras, PDF) ao aluno e ao profissional;
-- o aluno fica só com treino, avaliações, fotografias e evolução. Só o profissional a altera: o trigger de permissões do aluno (0019)
-- só deixa o aluno mudar uma lista fixa de colunas.

alter table students add column if not exists no_nutrition boolean not null default false;
