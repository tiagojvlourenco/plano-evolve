-- EVOLVE NUTRITION — Fase 37: telefone, registo de contactos e data de criação do aluno
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0021 já terem corrido. É seguro voltar a correr.
--
-- Para o painel de retenção do profissional ("Hoje: quem contactar", onboarding de alunos novos):
--   phone        — telefone/WhatsApp do aluno (só o profissional o escreve)
--   contact_log  — registo de contactos e adiamentos feitos pelo profissional, para não contactar a mesma pessoa duas vezes
--                  [{date:'AAAA-MM-DD', kind:'contacto'|'adiado', channel?, reason?, until?}] (a app guarda os últimos 50)
--   created_at   — quando a ficha foi criada. As fichas que já existem ficam com a data vazia (não contam como "alunos novos");
--                  as novas ficam com a data de hoje.
-- O trigger de permissões do aluno (0019) só deixa o aluno alterar uma lista fixa de colunas do dia a dia, por isso estas
-- três colunas novas ficam automaticamente protegidas: um aluno nunca as consegue alterar.

alter table students add column if not exists phone text;
alter table students add column if not exists contact_log jsonb not null default '[]'::jsonb;
alter table students add column if not exists created_at timestamptz;
alter table students alter column created_at set default now();

alter table students drop constraint if exists students_phone_len;
alter table students add constraint students_phone_len check (phone is null or char_length(phone) <= 30);

alter table students drop constraint if exists students_contact_log_array;
alter table students add constraint students_contact_log_array check (jsonb_typeof(contact_log) = 'array' and jsonb_array_length(contact_log) <= 200);
