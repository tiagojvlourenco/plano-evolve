-- Endurecimento apontado pelos avisos de segurança do Supabase (get_advisors).
-- 1) search_path fixo nas três funções puras de validação do diário de treino (sem mudar o comportamento).
alter function public.jsonb_array_is_append_only(jsonb, jsonb) set search_path = public, pg_temp;
alter function public.workout_log_is_valid(jsonb) set search_path = public, pg_temp;
alter function public.workout_logs_appended_are_valid(jsonb, jsonb) set search_path = public, pg_temp;

-- 2) claim_student_row só é chamada por quem já tem sessão (aluno a reclamar o convite): anon não precisa.
revoke execute on function public.claim_student_row() from public, anon;
grant execute on function public.claim_student_row() to authenticated;

-- 3) enforce_student_column_permissions é função de trigger: dispara sem precisar de EXECUTE do cliente.
revoke execute on function public.enforce_student_column_permissions() from public, anon, authenticated;
