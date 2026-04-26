create table if not exists public.card_localizations (
  card_id text not null references public.cards(id) on delete cascade,
  language text not null,
  name text not null,
  description text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (card_id, language),
  constraint card_localizations_language_check check (language in ('en', 'es', 'hi', 'ja'))
);

insert into public.card_localizations (card_id, language, name, description)
select id, 'en', name, description
from public.cards
on conflict (card_id, language) do update
set
  name = excluded.name,
  description = excluded.description,
  updated_at = timezone('utc', now());
