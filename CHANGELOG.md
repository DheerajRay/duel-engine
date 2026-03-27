# Changelog

All notable changes to `Duel Engine` should be recorded in this file.

The format is based on a simple release log with:

- `Unreleased` for in-progress work
- tagged versions for stable deployments

## Unreleased

- No unreleased entries yet.

## v1.0.2 - 2026-03-26

Patch release focused on clearer in-duel phase guidance.

Included in this release:

- updated the current-phase helper text so each duel phase shows its own specific instruction instead of always showing the draw-phase hint

## v1.0.1 - 2026-03-26

Patch release focused on announcement behavior and local preview consistency.

Included in this release:

- replaced remaining transient top-edge toasts with the shared centered announcement overlay
- added player turn phase announcements during duels
- routed deck builder feedback through the shared announcement system
- disabled service worker registration on local HTTP preview/LAN runs to avoid stale cached bundles during testing
- removed the unused `sonner` dependency

## v1.0.0 - 2026-03-26

Initial stable hosted release.

Included in this release:

- full local duel simulator with reducer-driven turn flow
- CPU Mode and Competition Mode
- deck builder with saved local decks and starter-deck bootstrap
- mobile-specific duel and deck-builder layouts
- centered duel announcements and improved log detail
- PWA support for installable iPhone home-screen use
- automated tests for core duel logic, log generation, card legality rules, and key UI flows
