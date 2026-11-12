-- QuizFiesta MVP schema. Run this file in Supabase > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'lobby' check (status in ('lobby','question','results','finished')),
  current_question integer not null default 0,
  question_started_at timestamptz,
  question_seconds integer not null default 20,
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  avatar text not null default '🦊',
  score integer not null default 0,
  joined_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  position integer not null,
  prompt text not null,
  options jsonb not null,
  correct_index integer not null,
  seconds integer not null default 20,
  unique(room_id, position)
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  option_index integer not null,
  answered_at timestamptz not null default now(),
  is_correct boolean not null default false,
  points integer not null default 0,
  unique(player_id, question_id)
);

-- Enable realtime updates for all game tables.
alter table public.rooms replica identity full;
alter table public.players replica identity full;
alter table public.questions replica identity full;
alter table public.answers replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.rooms;
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.players;
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.questions;
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.answers;
exception when duplicate_object then null; when others then null; end $$;

-- Open policies for a private MVP/test project only.
-- Before public launch, replace these with host/player authorization and server-side scoring.
alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;

drop policy if exists "mvp rooms access" on public.rooms;
create policy "mvp rooms access" on public.rooms for all to anon, authenticated using (true) with check (true);
drop policy if exists "mvp players access" on public.players;
create policy "mvp players access" on public.players for all to anon, authenticated using (true) with check (true);
drop policy if exists "mvp questions access" on public.questions;
create policy "mvp questions access" on public.questions for all to anon, authenticated using (true) with check (true);
drop policy if exists "mvp answers access" on public.answers;
create policy "mvp answers access" on public.answers for all to anon, authenticated using (true) with check (true);
