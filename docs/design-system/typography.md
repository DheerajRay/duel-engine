# Typography And Sizing

## Purpose

Typography and sizing are standardized so themes can swap tone without causing layout drift.

The system is defined in `src/index.css` through shared variables and role classes.

## Text Roles

### `ui-display`

Use for:
- major splash headings
- winner overlays
- full-screen title moments

Contract:
- heading family
- uppercase
- widest tracking
- largest shared size

### `ui-section-title`

Use for:
- section headers
- sheet titles
- page-level secondary titles

Contract:
- heading family
- moderate tracking
- stable cross-theme size

### `ui-card-title`

Use for:
- card/panel titles
- option-card headers
- compact content blocks

### `ui-eyebrow`

Use for:
- meta labels
- top-of-panel context labels
- shell chrome labels

Contract:
- heading family
- uppercase
- smallest high-tracking style

### `ui-body-sm`

Use for:
- dense descriptive copy
- option-card descriptions
- compact helper paragraphs

### `ui-body-md`

Use for:
- normal paragraphs
- help copy
- longer instructions

### `ui-mono-label`

Use for:
- tabs
- chips
- compact control labels
- button labels when mono styling is desired

### `ui-mono-stat`

Use for:
- LP values
- compact numeric emphasis
- small dashboard stats

### `ui-log-text`

Use for:
- duel logs
- history summaries

### `ui-helper`

Use for:
- empty states
- supporting notes
- minor secondary explanations

## Component Size Contracts

Defined in `src/index.css`:

- `--ui-app-bar-height`
- `--ui-tab-height`
- `--ui-chip-height`
- `--ui-button-height`
- `--ui-input-height`
- `--ui-sheet-header-height`

Spacing tokens:

- `--ui-space-1` to `--ui-space-6`
- `--ui-section-pad-mobile`
- `--ui-section-pad-desktop`
- `--ui-card-gap-mobile`
- `--ui-card-gap-desktop`

Radius tokens:

- `--ui-radius-xs`
- `--ui-radius-sm`
- `--ui-radius-md`
- `--ui-radius-lg`

## Theme Interaction

Themes may change:

- heading family
- body family
- mono family
- tracking tone

Themes may not change:

- the base semantic role mapping
- button height rules
- input height rules
- sheet-header height rules

If a screen needs to become denser or roomier, prefer changing the shared sizing tokens instead of editing local component classes one by one.

## Reuse Rule

Preferred:
- pick the nearest text role and reuse it
- use a size token for shell/control height

Avoid:
- hardcoding `text-[9px]`, `tracking-[0.24em]`, and custom heights repeatedly in feature components unless that value is promoted into the token system first
