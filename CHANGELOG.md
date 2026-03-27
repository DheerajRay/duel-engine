# Changelog

All notable changes to `Duel Engine` should be recorded in this file.

The format is based on a simple release log with:

- `Unreleased` for in-progress work
- tagged versions for stable deployments

## Unreleased

- No unreleased entries yet.

## v1.0.4 - 2026-03-27

Documentation release focused on deployment and mobile install guidance.

Included in this release:

- added Vercel hosting guidance to the README
- documented the live deployment URL pattern and GitHub-to-Vercel production flow
- expanded the iPhone PWA install notes and update behavior guidance
- updated the README gameplay flow to match the current `CPU Mode` and `Competition Mode` structure

## v1.0.3 - 2026-03-27

Patch release focused on competition continuity and cleaner in-duel exits.

Included in this release:

- added local competition-stage persistence so the ladder resumes from the last unlocked opponent instead of always restarting from Stage 1
- added an in-duel forfeit confirmation when opening the menu mid-match
- gave the competition forfeit prompt character-specific voice and matched CPU mode prompts to the app's sassier duel tone
- added regression coverage for competition resume and forfeit behavior

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
