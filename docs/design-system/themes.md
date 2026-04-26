# Theme System

## Purpose

The theme system exists to let Duel Engine change visual identity without changing layout or gameplay structure. Themes may change:

- color roles
- surface hierarchy
- accent treatment
- typography family mapping
- tracking tone

Themes must not change:

- reducer behavior
- duel layout structure
- card artwork
- control sizing contracts

## Activation Model

Themes are applied through `data-theme` on `document.documentElement`.

Current theme ids:

- `obsidian`
- `ivory-ledger`
- `terminal-signal`
- `pharaoh-gold`

The active theme is resolved in `src/preferences/AppPreferencesProvider.tsx` and applied through `src/services/preferences.ts`.

## Core Token Families

Theme tokens are defined in `src/index.css`.

Color and surface tokens:

- `--app-bg`
- `--app-elevated`
- `--app-panel`
- `--app-panel-strong`
- `--app-border`
- `--app-border-strong`
- `--app-text-primary`
- `--app-text-secondary`
- `--app-text-muted`
- `--app-text-dim`
- `--app-accent`
- `--app-accent-contrast`
- `--app-muted-fill`
- `--app-positive`
- `--app-warning`
- `--app-danger`
- `--app-shadow`

Typography-family tokens:

- `--app-font-heading`
- `--app-font-body`
- `--app-font-mono`

Tracking tone tokens:

- `--ui-display-track`
- `--ui-section-title-track`
- `--ui-card-title-track`
- `--ui-eyebrow-track`

## Theme Intent

### `obsidian`

Intent:
- default noir baseline
- closest to the pre-theme Duel Engine look
- strongest contrast, least decorative

Use when:
- validating new UI work
- comparing regressions against the original visual baseline

### `ivory-ledger`

Intent:
- rules-manual / paper ledger look
- warm light surfaces with ink-like text
- serif-heavy presentation

Use when:
- testing contrast on light surfaces
- validating that structure survives outside the dark baseline

### `terminal-signal`

Intent:
- CRT / terminal feel
- mono-heavy identity
- green signal accent

Use when:
- checking that mono typography roles remain legible
- validating that accent-driven themes do not break control hierarchy

### `pharaoh-gold`

Intent:
- ceremonial dark theme with gold emphasis
- more dramatic than `obsidian`, but still restrained

Use when:
- validating accent-led dark themes
- checking serif-heading behavior on the shared scale

## Structural Reuse Rule

A theme should make the app feel different through token remapping, not through component-specific overrides.

Preferred:
- update a token in `:root[data-theme="..."]`
- let shared classes consume that token

Avoid:
- patching a single page with theme-specific Tailwind classes
- changing paddings or heights inside one theme only
- changing text scale per theme

## Extension Rule

When adding a new theme:

1. add the theme id to `src/types/preferences.ts`
2. add the label mapping in `src/i18n/messages/*`
3. add the token block in `src/index.css`
4. verify all major surfaces:
   - app shell
   - deck builder
   - history
   - help
   - sign-in
   - duel chrome
   - bottom sheets / dialogs / overlays
