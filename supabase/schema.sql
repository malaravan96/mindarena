-- MindArena schema (MVP)

-- 1) Profiles (public display name)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_public"
on public.profiles for select
using (true);

create policy "profiles_upsert_own"
on public.profiles for insert
with check (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = id);

-- 2) Puzzles (one per day)
create table if not exists public.puzzles (
  id uuid primary key default gen_random_uuid(),
  date_key text not null unique, -- YYYY-MM-DD
  title text not null,
  prompt text not null,
  type text not null,
  options text[] not null,
  answer_index int not null check (answer_index >= 0),
  created_at timestamptz default now()
);

alter table public.puzzles enable row level security;

create policy "puzzles_read_all"
on public.puzzles for select
using (true);

-- 3) Attempts (user submissions)
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  puzzle_id uuid not null references public.puzzles(id) on delete cascade,
  ms_taken int not null check (ms_taken >= 0),
  is_correct boolean not null,
  selected_index int not null check (selected_index >= 0),
  created_at timestamptz default now()
);

create index if not exists attempts_puzzle_correct_time_idx
  on public.attempts (puzzle_id, is_correct, ms_taken);

alter table public.attempts enable row level security;

create policy "attempts_insert_own"
on public.attempts for insert
with check (auth.uid() = user_id);

create policy "attempts_select_public_leaderboard"
on public.attempts for select
using (true);

-- Optional: limit updates/deletes
create policy "attempts_no_update"
on public.attempts for update
using (false);

create policy "attempts_no_delete"
on public.attempts for delete
using (false);
