create extension if not exists "pgcrypto";

create table if not exists public.cards (
  id text primary key,
  name text not null,
  type text not null,
  description text not null,
  attribute text,
  level integer,
  atk integer,
  def integer,
  sub_type text,
  is_fusion boolean default false,
  fusion_materials text[] default '{}'::text[],
  effect_support_status text,
  effect_support_note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.characters (
  id text primary key,
  name text not null,
  intro_line text not null,
  forfeit_line text not null,
  stage_clear_line text not null,
  defeat_line text not null,
  signature_card_ids text[] not null default '{}'::text[],
  ai_profile jsonb not null default '{}'::jsonb,
  voice_profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.predefined_decks (
  id text primary key,
  name text not null,
  kind text not null check (kind in ('starter', 'character')),
  main_deck text[] not null,
  extra_deck text[] not null default '{}'::text[],
  character_id text references public.characters(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.competition_stages (
  stage_number integer primary key,
  character_id text not null references public.characters(id) on delete cascade,
  summary_order integer not null default 0
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_decks (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  main_deck text[] not null,
  extra_deck text[] not null default '{}'::text[],
  is_primary boolean not null default false,
  kind text not null default 'user' check (kind in ('starter', 'character', 'user')),
  character_id text references public.characters(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_competition_progress (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  current_stage_index integer not null default 0,
  last_cleared_stage integer not null default -1,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.duel_history (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('cpu_random', 'cpu_custom', 'competition')),
  opponent_label text not null,
  stage_index integer,
  result text not null check (result in ('win', 'loss', 'forfeit')),
  turn_count integer not null,
  lp_remaining integer not null,
  finishing_card text,
  notable_play text not null,
  summary text not null,
  logs_payload jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.cards enable row level security;
alter table public.characters enable row level security;
alter table public.predefined_decks enable row level security;
alter table public.competition_stages enable row level security;
alter table public.profiles enable row level security;
alter table public.user_decks enable row level security;
alter table public.user_competition_progress enable row level security;
alter table public.duel_history enable row level security;

drop policy if exists "public read cards" on public.cards;
create policy "public read cards" on public.cards for select using (true);

drop policy if exists "public read characters" on public.characters;
create policy "public read characters" on public.characters for select using (true);

drop policy if exists "public read predefined decks" on public.predefined_decks;
create policy "public read predefined decks" on public.predefined_decks for select using (true);

drop policy if exists "public read competition stages" on public.competition_stages;
create policy "public read competition stages" on public.competition_stages for select using (true);

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles for select using (auth.uid() = id);

drop policy if exists "users upsert own profile" on public.profiles;
create policy "users upsert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);

drop policy if exists "users manage own decks" on public.user_decks;
create policy "users read own decks" on public.user_decks for select using (auth.uid() = user_id);
create policy "users insert own decks" on public.user_decks for insert with check (auth.uid() = user_id);
create policy "users update own decks" on public.user_decks for update using (auth.uid() = user_id);
create policy "users delete own decks" on public.user_decks for delete using (auth.uid() = user_id);

drop policy if exists "users manage own competition progress" on public.user_competition_progress;
create policy "users read own competition progress" on public.user_competition_progress for select using (auth.uid() = user_id);
create policy "users insert own competition progress" on public.user_competition_progress for insert with check (auth.uid() = user_id);
create policy "users update own competition progress" on public.user_competition_progress for update using (auth.uid() = user_id);
create policy "users delete own competition progress" on public.user_competition_progress for delete using (auth.uid() = user_id);

drop policy if exists "users manage own duel history" on public.duel_history;
create policy "users read own duel history" on public.duel_history for select using (auth.uid() = user_id);
create policy "users insert own duel history" on public.duel_history for insert with check (auth.uid() = user_id);
create policy "users update own duel history" on public.duel_history for update using (auth.uid() = user_id);
create policy "users delete own duel history" on public.duel_history for delete using (auth.uid() = user_id);
