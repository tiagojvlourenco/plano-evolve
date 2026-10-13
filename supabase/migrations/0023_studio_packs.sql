-- EVOLVE NUTRITION — Fase 38: pacotes de sessões, presenças/faltas e cobranças
-- Corre isto no SQL Editor do Supabase, DEPOIS de 0001-0022 já terem corrido. É seguro voltar a correr.
--
-- session_packs — um pacote de sessões vendido a um aluno (ex.: "Pack 10 sessões"), com validade e regras próprias:
--                 missed_consumes     = faltar sem aviso gasta uma sessão
--                 late_cancel_consumes = cancelar tarde gasta uma sessão
-- sessions      — uma sessão marcada/feita: feita | faltou | cancelada (a tempo, nunca gasta) | cancelada_tarde
-- payments      — uma cobrança (valor, vencimento, quando e como foi paga). A app regista e avisa; não cobra nem emite faturas.
--
-- Só profissionais leem e escrevem estas tabelas; os alunos nunca as veem. Se um aluno for apagado, apaga-se também o seu histórico aqui.

create table if not exists session_packs (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references students(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  total integer not null check (total between 1 and 500),
  price numeric(8,2) check (price is null or price >= 0),
  starts_on date not null default current_date,
  expires_on date,
  missed_consumes boolean not null default true,
  late_cancel_consumes boolean not null default true,
  notes text check (notes is null or char_length(notes) <= 300),
  created_by uuid default auth.uid() references professionals(user_id),
  created_at timestamptz not null default now(),
  check (expires_on is null or expires_on >= starts_on)
);
create index if not exists session_packs_student_idx on session_packs(student_id, starts_on desc);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references students(id) on delete cascade,
  pack_id uuid references session_packs(id) on delete set null,
  date date not null,
  time text check (time is null or time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  status text not null check (status in ('feita', 'faltou', 'cancelada', 'cancelada_tarde')),
  notes text check (notes is null or char_length(notes) <= 300),
  created_by uuid default auth.uid() references professionals(user_id),
  created_at timestamptz not null default now()
);
create index if not exists sessions_student_date_idx on sessions(student_id, date desc);
create index if not exists sessions_date_idx on sessions(date desc);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references students(id) on delete cascade,
  pack_id uuid references session_packs(id) on delete set null,
  amount numeric(8,2) not null check (amount > 0),
  due_on date not null,
  paid_on date,
  method text check (method is null or method in ('mbway', 'transferencia', 'multibanco', 'numerario', 'outro')),
  notes text check (notes is null or char_length(notes) <= 300),
  created_by uuid default auth.uid() references professionals(user_id),
  created_at timestamptz not null default now()
);
create index if not exists payments_student_idx on payments(student_id, due_on desc);
create index if not exists payments_unpaid_idx on payments(due_on) where paid_on is null;

alter table session_packs enable row level security;
alter table sessions enable row level security;
alter table payments enable row level security;

drop policy if exists "professionals manage session packs" on session_packs;
create policy "professionals manage session packs" on session_packs
  for all
  using (exists (select 1 from professionals where user_id = auth.uid()))
  with check (exists (select 1 from professionals where user_id = auth.uid()));

drop policy if exists "professionals manage sessions" on sessions;
create policy "professionals manage sessions" on sessions
  for all
  using (exists (select 1 from professionals where user_id = auth.uid()))
  with check (exists (select 1 from professionals where user_id = auth.uid()));

drop policy if exists "professionals manage payments" on payments;
create policy "professionals manage payments" on payments
  for all
  using (exists (select 1 from professionals where user_id = auth.uid()))
  with check (exists (select 1 from professionals where user_id = auth.uid()));
