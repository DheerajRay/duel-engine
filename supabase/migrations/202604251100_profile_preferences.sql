alter table public.profiles
  add column if not exists language text not null default 'en',
  add column if not exists theme text not null default 'obsidian';

alter table public.profiles
  drop constraint if exists profiles_language_check,
  add constraint profiles_language_check
    check (language in ('en', 'es', 'hi', 'ja'));

alter table public.profiles
  drop constraint if exists profiles_theme_check,
  add constraint profiles_theme_check
    check (theme in ('obsidian', 'ivory-ledger', 'terminal-signal', 'pharaoh-gold'));
