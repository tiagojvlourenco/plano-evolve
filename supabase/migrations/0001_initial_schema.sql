-- EVOLVE NUTRITION — esquema Supabase
-- Corre isto no SQL Editor do teu projeto Supabase (Database > SQL Editor > New query)

create table if not exists students (
  id text primary key,
  initials text,
  name text not null,
  age int,
  sex text,
  height numeric,
  weight_initial numeric,
  weight_current numeric,
  weight_goal numeric,
  goal text,
  trainings_per_week int,
  training_days jsonb default '[]',
  training_type text,
  training_time text,
  wake_time text,
  sleep_time text,
  likes jsonb default '[]',
  dislikes jsonb default '[]',
  avoid jsonb default '[]',
  allergies jsonb default '[]',
  meals_preferred int,
  budget text,
  cook_time text,
  work text,
  weekend_note text,
  targets jsonb default '{}',
  flexibility int default 50,
  alerts jsonb default '[]',
  notes text default '',
  meals jsonb default '[]',
  checkins jsonb default '[]',
  weights jsonb default '[]',
  assessments jsonb default '[]',
  allow_photos boolean default false,
  photos jsonb default '[]',
  plan_history jsonb default '[]',
  meals_date date,
  from_onboarding boolean default false,
  updated_at timestamptz default now()
);

-- Row Level Security: acesso aberto via chave anon (sem login nesta fase)
-- IMPORTANTE: isto significa que qualquer pessoa com o URL e a chave anon
-- consegue ler e escrever todos os registos. Aceitável para protótipo/teste,
-- deve ser substituído por políticas reais quando houver autenticação (Supabase Auth).
alter table students enable row level security;

drop policy if exists "prototype open access" on students;
create policy "prototype open access" on students
  for all using (true) with check (true);

-- Dados de exemplo (Maria, Rui, Sofia) — mesmos dados que já estavam no protótipo
insert into students (id, initials, name, age, sex, height, weight_initial, weight_current, weight_goal, goal, trainings_per_week, training_days, training_type, training_time, wake_time, sleep_time, likes, dislikes, avoid, allergies, meals_preferred, budget, cook_time, work, weekend_note, targets, flexibility, alerts, notes, meals, checkins, weights, assessments, allow_photos, photos, plan_history, meals_date, from_onboarding) values ('maria', 'MS', 'Maria Silva', 32, 'Feminino', 165, 74, 68, 64, 'Perda de gordura', 4, '[1,2,4,5]'::jsonb, 'Musculação + cardio leve', '19:00', '07:00', '23:30', '["Frango","Iogurte grego","Batata-doce"]'::jsonb, '["Peixe azul"]'::jsonb, '["Marisco"]'::jsonb, '["Sensibilidade à lactose"]'::jsonb, 5, 'Médio', '20-30 min/dia', 'Escritório (sentada)', 'Janta fora ~1x por fim de semana', '{"kcal":1700,"protein":131,"carbs":177,"fat":52}'::jsonb, 65, '[{"type":"warn","text":"Adesão abaixo de 85% esta semana"}]'::jsonb, 'Prefere treinar ao final do dia. Sensível a lactose — evitar leite gordo, iogurte grego normalmente tolerado bem.', '[{"name":"Pequeno-almoço","time":"07:30","foods":[{"name":"Iogurte grego natural","qty":"200 g","group":"protein"},{"name":"Aveia","qty":"40 g","group":"carb"},{"name":"Mirtilos","qty":"80 g","group":"fruit"}],"liveChoice":null,"done":false,"adapted":false},{"name":"Meio da manhã","time":"10:30","foods":[{"name":"Maçã","qty":"1 unid.","group":"fruit"},{"name":"Frutos secos","qty":"15 g","group":"fat"}],"liveChoice":null,"done":false,"adapted":false},{"name":"Almoço","time":"13:00","foods":[{"name":"Frango (peito)","qty":"150 g","group":"protein"},{"name":"Arroz (cozido)","qty":"120 g","group":"carb"},{"name":"Brócolos","qty":"à vontade","group":"veg"},{"name":"Azeite","qty":"10 ml","group":"fat"}],"liveChoice":null,"done":false,"adapted":false},{"name":"Lanche pré-treino","time":"17:00","foods":[{"name":"Banana","qty":"1 unid.","group":"fruit"},{"name":"Ovos","qty":"2 unid.","group":"protein"}],"liveChoice":null,"done":false,"adapted":false},{"name":"Jantar","time":"20:30","foods":[{"name":"Pescada","qty":"170 g","group":"protein"},{"name":"Batata-doce","qty":"150 g","group":"carb"},{"name":"Salada mista","qty":"à vontade","group":"veg"}],"liveChoice":null,"done":false,"adapted":false}]'::jsonb, '[{"date":"2026-08-18","weight":70.4,"hunger":6,"energy":6,"adherence":7,"workouts":3,"mealsOff":1,"notes":"Semana ok, fim de semana mais difícil."},{"date":"2026-08-25","weight":69.6,"hunger":5,"energy":7,"adherence":8,"workouts":4,"mealsOff":0,"notes":"Boa semana."},{"date":"2026-09-01","weight":69,"hunger":5,"energy":7,"adherence":8,"workouts":4,"mealsOff":1,"notes":""},{"date":"2026-09-08","weight":68.5,"hunger":6,"energy":6,"adherence":7,"workouts":3,"mealsOff":2,"notes":"Jantar de aniversário."},{"date":"2026-09-15","weight":68,"hunger":5,"energy":7,"adherence":8,"workouts":4,"mealsOff":1,"notes":""}]'::jsonb, '[{"date":"2026-07-21","w":74},{"date":"2026-07-28","w":72.9},{"date":"2026-08-04","w":72.1},{"date":"2026-08-11","w":71.2},{"date":"2026-08-18","w":70.4},{"date":"2026-08-25","w":69.6},{"date":"2026-09-01","w":69},{"date":"2026-09-08","w":68.5},{"date":"2026-09-15","w":68}]'::jsonb, '[{"date":"2026-08-04","weight":72.1,"bodyFat":32.5,"muscle":26.1,"visceral":9,"water":48.2},{"date":"2026-09-01","weight":69,"bodyFat":30.2,"muscle":26.6,"visceral":8,"water":49}]'::jsonb, true, '[]'::jsonb, '[{"date":"2026-07-21","kcal":2100,"flex":30,"label":"Plano 1"},{"date":"2026-08-11","kcal":1950,"flex":50,"label":"Plano 2"},{"date":"2026-09-01","kcal":1850,"flex":65,"label":"Plano 3"}]'::jsonb, null, false) on conflict (id) do nothing;

insert into students (id, initials, name, age, sex, height, weight_initial, weight_current, weight_goal, goal, trainings_per_week, training_days, training_type, training_time, wake_time, sleep_time, likes, dislikes, avoid, allergies, meals_preferred, budget, cook_time, work, weekend_note, targets, flexibility, alerts, notes, meals, checkins, weights, assessments, allow_photos, photos, plan_history, meals_date, from_onboarding) values ('rui', 'RC', 'Rui Costa', 26, 'Masculino', 180, 71, 74.5, 80, 'Ganho de massa muscular', 5, '[1,2,3,4,5]'::jsonb, 'Musculação (hipertrofia)', '07:00', '06:00', '23:00', '["Carne vermelha","Arroz","Batata"]'::jsonb, '["Legumes verdes"]'::jsonb, '[]'::jsonb, '[]'::jsonb, 5, 'Alto', '< 15 min/dia (meal prep ao fim de semana)', 'Trabalho de terreno, ativo', 'Treina normalmente ao sábado de manhã', '{"kcal":3100,"protein":262,"carbs":292,"fat":98}'::jsonb, 30, '[{"type":"critical","text":"Sem check-in há 12 dias"},{"type":"warn","text":"Peso sem evolução há 3 semanas"}]'::jsonb, 'Motivado mas com pouco tempo para cozinhar durante a semana — depende muito do meal prep de domingo.', '[{"name":"Pequeno-almoço","time":"06:30","foods":[{"name":"Ovos","qty":"4 unid.","group":"protein"},{"name":"Pão integral","qty":"90 g","group":"carb"},{"name":"Manteiga de amendoim","qty":"20 g","group":"fat"}],"liveChoice":null,"done":false,"adapted":false},{"name":"Pós-treino","time":"09:00","foods":[{"name":"Iogurte grego natural","qty":"250 g","group":"protein"},{"name":"Aveia","qty":"70 g","group":"carb"},{"name":"Banana","qty":"1 unid.","group":"fruit"}],"liveChoice":null,"done":false,"adapted":false},{"name":"Almoço","time":"13:30","foods":[{"name":"Frango (peito)","qty":"220 g","group":"protein"},{"name":"Arroz (cozido)","qty":"250 g","group":"carb"},{"name":"Azeite","qty":"15 ml","group":"fat"}],"liveChoice":null,"done":false,"adapted":false},{"name":"Lanche","time":"17:00","foods":[{"name":"Atum (natural)","qty":"140 g","group":"protein"},{"name":"Pão integral","qty":"70 g","group":"carb"}],"liveChoice":null,"done":false,"adapted":false},{"name":"Jantar","time":"20:00","foods":[{"name":"Carne vermelha magra","qty":"200 g","group":"protein"},{"name":"Batata","qty":"300 g","group":"carb"},{"name":"Brócolos","qty":"à vontade","group":"veg"}],"liveChoice":null,"done":false,"adapted":false}]'::jsonb, '[{"date":"2026-08-11","weight":74,"hunger":7,"energy":7,"adherence":7,"workouts":5,"mealsOff":2,"notes":""},{"date":"2026-08-25","weight":74.3,"hunger":8,"energy":6,"adherence":6,"workouts":4,"mealsOff":3,"notes":"Semana cheia de trabalho."}]'::jsonb, '[{"date":"2026-07-14","w":71},{"date":"2026-07-28","w":72.2},{"date":"2026-08-11","w":74},{"date":"2026-08-25","w":74.3},{"date":"2026-09-08","w":74.5}]'::jsonb, '[{"date":"2026-07-14","weight":71,"bodyFat":14.5,"muscle":34,"visceral":6,"water":58},{"date":"2026-08-25","weight":74.3,"bodyFat":15,"muscle":35.6,"visceral":6,"water":58.5}]'::jsonb, false, '[]'::jsonb, '[{"date":"2026-07-14","kcal":2700,"flex":25,"label":"Plano 1"},{"date":"2026-08-11","kcal":2900,"flex":30,"label":"Plano 2"}]'::jsonb, null, false) on conflict (id) do nothing;

insert into students (id, initials, name, age, sex, height, weight_initial, weight_current, weight_goal, goal, trainings_per_week, training_days, training_type, training_time, wake_time, sleep_time, likes, dislikes, avoid, allergies, meals_preferred, budget, cook_time, work, weekend_note, targets, flexibility, alerts, notes, meals, checkins, weights, assessments, allow_photos, photos, plan_history, meals_date, from_onboarding) values ('sofia', 'SM', 'Sofia Martins', 29, 'Feminino', 170, 63, 63.2, 63, 'Manutenção / recomposição', 3, '[1,3,5]'::jsonb, 'Treino funcional', '18:30', '07:30', '23:45', '["Peixe","Legumes variados","Quinoa"]'::jsonb, '[]'::jsonb, '["Glúten (preferência, não celíaca)"]'::jsonb, '[]'::jsonb, 4, 'Médio-alto', '30-40 min/dia, gosta de cozinhar', 'Trabalho híbrido', 'Muito social, janta fora com frequência', '{"kcal":1800,"protein":135,"carbsMin":130,"carbsMax":180,"fatMin":55,"fatMax":75}'::jsonb, 85, '[]'::jsonb, 'Muito autónoma — beneficia mais de regras e intervalos do que de refeições fixas.', '[{"name":"Pequeno-almoço","time":"08:00","foods":[{"name":"Ovos","qty":"2 unid.","group":"protein"},{"name":"Pão integral","qty":"80 g","group":"carb"},{"name":"Abacate","qty":"50 g","group":"fat"}],"liveChoice":null,"done":false,"adapted":false},{"name":"Almoço","time":"13:00","foods":[{"name":"Frango (peito)","qty":"160 g","group":"protein"},{"name":"Arroz (cozido)","qty":"160 g","group":"carb"},{"name":"Salada mista","qty":"à vontade","group":"veg"},{"name":"Azeite","qty":"10 ml","group":"fat"}],"liveChoice":null,"done":false,"adapted":false},{"name":"Lanche","time":"17:30","foods":[{"name":"Iogurte grego natural","qty":"200 g","group":"protein"},{"name":"Fruta","qty":"1 peça","group":"fruit"}],"liveChoice":null,"done":false,"adapted":false},{"name":"Jantar","time":"20:00","foods":[{"name":"Pescada","qty":"190 g","group":"protein"},{"name":"Quinoa (cozida)","qty":"150 g","group":"carb"},{"name":"Salada mista","qty":"à vontade","group":"veg"},{"name":"Azeite","qty":"10 ml","group":"fat"}],"liveChoice":null,"done":false,"adapted":false}]'::jsonb, '[{"date":"2026-08-25","weight":63.4,"hunger":4,"energy":8,"adherence":9,"workouts":3,"mealsOff":1,"notes":""},{"date":"2026-09-01","weight":63.1,"hunger":4,"energy":8,"adherence":9,"workouts":3,"mealsOff":2,"notes":"Fim de semana fora."},{"date":"2026-09-08","weight":63.3,"hunger":5,"energy":7,"adherence":9,"workouts":3,"mealsOff":1,"notes":""},{"date":"2026-09-15","weight":63.2,"hunger":4,"energy":8,"adherence":9,"workouts":3,"mealsOff":1,"notes":""}]'::jsonb, '[{"date":"2026-08-04","w":63},{"date":"2026-08-11","w":63.2},{"date":"2026-08-18","w":63.5},{"date":"2026-08-25","w":63.4},{"date":"2026-09-01","w":63.1},{"date":"2026-09-08","w":63.3},{"date":"2026-09-15","w":63.2}]'::jsonb, '[{"date":"2026-08-04","weight":63,"bodyFat":24,"muscle":24.5,"visceral":5,"water":52},{"date":"2026-09-08","weight":63.3,"bodyFat":23.4,"muscle":24.9,"visceral":5,"water":52.4}]'::jsonb, true, '[]'::jsonb, '[{"date":"2026-08-04","kcal":2050,"flex":85,"label":"Plano 1"}]'::jsonb, null, false) on conflict (id) do nothing;
