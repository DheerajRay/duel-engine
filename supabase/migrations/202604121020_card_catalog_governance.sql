alter table public.cards
  add column if not exists source_type text not null default 'unknown' check (source_type in ('official', 'anime', 'custom', 'unknown')),
  add column if not exists text_source text not null default 'csv' check (text_source in ('csv', 'manual', 'external_api', 'mixed')),
  add column if not exists verification_status text not null default 'unverified' check (verification_status in ('verified', 'needs_review', 'unverified')),
  add column if not exists last_verified_at timestamptz,
  add column if not exists notes text;

create table if not exists public.card_engine_metadata (
  card_id text primary key references public.cards(id) on delete cascade,
  effect_support_status text,
  effect_support_note text,
  engine_behavior_key text,
  is_playable_in_engine boolean not null default true,
  requires_manual_targeting boolean not null default false,
  has_hidden_information_impact boolean not null default false,
  ai_priority_weight integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.card_review_queue (
  card_id text primary key references public.cards(id) on delete cascade,
  missing_description boolean not null default false,
  missing_passcode boolean not null default false,
  missing_monster_type_line boolean not null default false,
  suggested_source_type text not null default 'unknown' check (suggested_source_type in ('official', 'anime', 'custom', 'unknown')),
  review_status text not null default 'needs_review' check (review_status in ('needs_review', 'in_progress', 'verified', 'ignored')),
  review_notes text,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists card_review_queue_review_status_idx on public.card_review_queue (review_status);
create index if not exists card_review_queue_suggested_source_type_idx on public.card_review_queue (suggested_source_type);

alter table public.card_engine_metadata enable row level security;
alter table public.card_review_queue enable row level security;

drop policy if exists "public read card engine metadata" on public.card_engine_metadata;
create policy "public read card engine metadata" on public.card_engine_metadata for select using (true);

drop policy if exists "public read card review queue" on public.card_review_queue;
create policy "public read card review queue" on public.card_review_queue for select using (true);
