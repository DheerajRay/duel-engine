# Changelog

All notable changes to `Duel Engine` should be recorded in this file.

The format is based on a simple release log with:

- `Unreleased` for in-progress work
- tagged versions for stable deployments

## Unreleased

- No unreleased entries yet.

## v1.3.5 - 2026-04-18

Patch release focused on removing the remaining boot-time loading stalls tied to cloud-backed user data.

Included in this release:

- hardened deck bootstrap so starter-deck selection falls back to local storage if Supabase user-deck sync is slow or unavailable
- hardened competition progress bootstrap so ladder resume falls back to local progress instead of blocking app startup on cloud reads
- replaced additional boot-time `getUser()` calls with persisted-session checks for user-data services
- added timeout protection around user deck and competition progress cloud sync paths to keep the app responsive during Supabase latency spikes

## v1.3.4 - 2026-04-18

Patch release focused on resilient app boot when Supabase is slow or unavailable.

Included in this release:

- changed auth bootstrap to use the locally persisted Supabase session instead of a network-dependent user fetch during initial app load
- hardened profile hydration so profile lookup failures no longer block the app from leaving the loading screen
- added a timeout around initial Supabase game-content fetches and forced fallback to bundled local content when cloud bootstrap stalls
- preserved the existing cloud-backed content path when Supabase responds normally while restoring reliable guest boot behavior during outages or latency spikes

## v1.3.3 - 2026-04-12

Patch release focused on the home-page auth action.

Included in this release:

- replaced the signed-in `Profile` button on the home page with a direct `Logout` action
- kept `Sign In` as the guest-state action on the same button slot
- preserved the dedicated sign-in screen and the launch-time auth prompt for full account management

## v1.3.2 - 2026-04-12

Patch release focused on the sign-in flow and launch-time auth prompt.

Included in this release:

- replaced Supabase magic-link auth with email/password sign-in
- added create-account support from the same auth screen
- added a launch-time sign-in prompt for guest users when the app opens
- kept guest access available through an explicit `Continue As Guest` action
- relied on Supabase persisted sessions for same-device auto-login instead of adding a custom local auth token
- updated the test suite to cover the guest auth prompt and the new boot flow

## v1.3.1 - 2026-04-12

Patch release focused on restoring the simpler card-detail presentation.

Included in this release:

- reverted duel card details to the earlier compact layout
- reverted deck-builder card details to the earlier compact layout
- removed the extra metadata presentation blocks such as passcode, page, and snapshot from the player-facing UI
- kept the underlying Supabase-backed card catalog and enriched DB fields intact

## v1.3.0 - 2026-04-12

Feature release focused on strengthening the card catalog, moving richer card metadata into Supabase, and removing the local card-content cache layer.

Included in this release:

- widened the card data model with richer catalog fields including provenance, support metadata, passcodes, type-line details, and additional rule text
- added a wiki-backed override sync pipeline to backfill missing card descriptions and strengthen incomplete card rows
- generated and applied Supabase migrations for:
  - enriched card fields
  - card governance metadata
  - refreshed game-content seed data
  - refreshed card descriptions and metadata
- populated the live `cards` table so all cards now have descriptions
- updated duel and deck-builder card details to render the richer catalog data
- updated deck-builder search to use the enriched card metadata
- removed the `localStorage` game-content cache so card content now comes from Supabase first with bundled local fallback only
- kept the full validation suite green after the data-layer and content refresh changes

## v1.2.0 - 2026-04-11

Feature release focused on cloud-ready app data, optional auth surfaces, history, and the first AI-assisted deck workflow.

Included in this release:

- added a Supabase-ready data layer for:
  - game catalog/config bootstrapping with local fallback
  - optional auth/profile handling
  - synced user decks
  - competition progress sync
  - duel history storage
- added a database migration for cards, predefined decks, competition stages, characters, profiles, user decks, competition progress, and duel history
- added new `Sign In` and `Game History` pages and wired them into the main app flow
- refactored app boot so content loads through a dedicated game-content service instead of relying only on bundled local data
- preserved the duel engine as fully local and deterministic while making content and user data cloud-ready
- expanded local duel narration with richer structured context for summon and battle events
- added a first-pass Deck Assistant integration with a server-side route and structured suggestion model, while keeping manual deck edits in the UI
- updated deck builder persistence to support local-only guest play and Supabase-backed signed-in play through one service layer
- updated tests to cover the new async competition boot flow and kept the suite green after the service-layer migration

## v1.1.0 - 2026-03-27

Feature release focused on a registry-backed duel engine and a stronger Competition Mode flow.

Included in this release:

- added a new local `src/effects` registry layer so card support status, summon legality, activation legality, target rules, effect resolution, and CPU weighting all come from one place
- made unsupported or partially supported cards explicit in the UI instead of letting them leak through generic action handling
- migrated spell/trap resolution and reactive trap handling onto the registry-backed flow
- added support-status details to duel and deck-builder card inspection panels
- deepened Competition Mode with:
  - a ladder progress entry overlay
  - signature-card metadata per duelist
  - local character preference profiles for CPU decision weighting
  - a streamlined duel-intro overlay focused on the character entrance quip
  - richer post-duel stage summaries with turns, LP, finishing card, and a notable-play line
- expanded automated coverage with effect-registry tests and updated competition-flow UI tests

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
