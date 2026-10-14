-- EVOLVE NUTRITION — Fase 39: sessões "agendadas" (as datas previstas da folha de cálculo de cada aluno)
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0026 já terem corrido. É seguro voltar a correr.
--
-- sessions.status passa a aceitar 'agendada' (sessão prevista, ainda por acontecer ou por confirmar; não gasta nenhuma aula do pacote).
-- sessions.source passa a aceitar 'folha' (sessão agendada importada da folha de cálculo). Quando o evento do Google Agenda desse
-- dia aparece, a sessão agendada passa a "feita"/"faltou" (a app trata disso ao sincronizar).

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'sessions'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%cancelada_tarde%'
  loop
    execute format('alter table sessions drop constraint %I', c.conname);
  end loop;
end $$;
alter table sessions add constraint sessions_status_values check (status in ('agendada', 'feita', 'faltou', 'cancelada', 'cancelada_tarde'));

alter table sessions drop constraint if exists sessions_source_values;
alter table sessions add constraint sessions_source_values check (source in ('manual', 'agenda', 'calendario', 'folha'));
