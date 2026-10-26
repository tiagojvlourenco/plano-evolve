-- 0033: a Corrida também guarda passeios de bicicleta (activity = 'bike'). As corridas existentes ficam 'run'.
-- Só acrescenta uma coluna e troca a verificação de velocidade: nada se apaga, nada muda nas políticas (RLS) nem nos privilégios.
alter table runs add column if not exists activity text not null default 'run';
alter table runs drop constraint if exists runs_activity_check;
alter table runs add constraint runs_activity_check check (activity in ('run', 'bike'));

-- corrida: média até 12 m/s (43 km/h); bicicleta: até 25 m/s (90 km/h). Só apanha lixo evidente.
alter table runs drop constraint if exists runs_speed_plausible;
alter table runs add constraint runs_speed_plausible check (distance_m <= (case when activity = 'bike' then 25 else 12 end) * duration_s);
