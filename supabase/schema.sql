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
  created_at timestamptz default now(),
  -- Ensure one attempt per user per puzzle
  unique(user_id, puzzle_id)
);

-- Indexes for performance
create index if not exists attempts_puzzle_correct_time_idx
  on public.attempts (puzzle_id, is_correct, ms_taken);

create index if not exists attempts_user_id_idx
  on public.attempts (user_id);

create index if not exists attempts_created_at_idx
  on public.attempts (created_at desc);

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

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, updated_at)
  values (new.id, new.email, now());
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call the function when a new user is created
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
