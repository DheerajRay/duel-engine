# Shared Component Primitives

## Purpose

Shared component primitives keep mobile and desktop surfaces visually aligned even when their layouts differ.

The primitives live in `src/index.css` as semantic classes, and feature components should consume them instead of rebuilding local color and control rules repeatedly.

## Surface Primitives

### `ui-shell`

Use for:
- page backgrounds
- app-shell containers

### `ui-panel`

Use for:
- normal content cards
- list items
- dialog bodies
- duel chrome sections

### `ui-panel-elevated`

Use for:
- nested controls
- secondary cards inside a larger panel
- chip clusters or utility groups

### `ui-divider`

Use for:
- border separators
- app-bar / sheet / section dividers

### `ui-overlay`

Use for:
- modal backdrops
- non-field overlays

## Control Primitives

### `ui-button`

Use for:
- primary actions
- confirm actions
- sheet CTA buttons

### `ui-button-subtle`

Use for:
- secondary actions
- reset / restart / less prominent commands

### `ui-chip`

Use for:
- inactive segmented buttons
- status chips
- passive shell pills

### `ui-chip-active`

Use for:
- active tab/chip states
- selected segmented controls

### `ui-input`

Use for:
- text inputs
- selects
- textareas

### `ui-sheet`

Use for:
- bottom-sheet container surfaces
- any shared slide-up mobile secondary surface

## Mobile Density Rule

Mobile should feel compact, not compressed.

Preferred:
- reuse the shared component height tokens
- use `ui-eyebrow`, `ui-mono-label`, and `ui-helper` for small shell text
- keep app-bar, tab-bar, and sheet-header heights on the shared tokens

Avoid:
- growing one screen by adding bespoke `py-4`, `text-base`, and wider tracking while the rest of the app remains denser
- creating separate mobile-only color logic per page

## Desktop Rule

Desktop may use larger gaps and longer lines, but should still use the same tokenized surfaces and text roles where practical.

Desktop-specific layout is acceptable.
Desktop-specific visual primitives are not preferred.

## Localization Rule

Any player-facing string rendered inside a shared primitive should come from:

- `src/i18n/messages/*`
- centralized localized content sources
- language-aware card content loaders

Avoid embedding English strings directly inside:

- app bars
- tab bars
- bottom sheets
- buttons
- helper/empty states

## Anti-Patterns

Avoid these patterns in new work:

- page-specific redefinitions of black/zinc/white shells
- one-off tracking/size values repeated across multiple components
- theme-specific Tailwind classes applied directly in feature components
- inline English helper text inside mobile chrome
