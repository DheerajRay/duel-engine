# Changelog

All notable changes to `Duel Engine` should be recorded in this file.

The format is based on a simple release log with:

- `Unreleased` for in-progress work
- tagged versions for stable deployments

## Unreleased

- No unreleased entries yet.

## v1.6.3 - 2026-04-26

Patch release focused on simplifying the mobile play header and reducing home-screen/footer chrome.

Included in this release:

- removed the mobile username bubble styling and switched the account label to the same understated heading style as the app title
- replaced the mobile play-home shortcuts block with a compact win / loss / forfeit record summary
- refreshed the duel record summary automatically from duel history so the play home reflects recent matches
- tightened the duel mobile inspector again with a simpler single-row header, smaller labels, and a more compact floating drawer footprint

## v1.6.2 - 2026-04-26

Patch release focused on tightening oversized mobile controls and making the duel info surface work as a compact overlay instead of a clipped footer.

Included in this release:

- reduced the size of the mobile account chip, home action icons, shortcut buttons, bottom-tab chrome, deck-builder header controls, history filter pills, and help navigation tabs
- tightened mobile search, filter, and segmented-control typography so the app reads closer to the original compact redesign
- converted the duel card-info / duel-log mobile area into a floating bottom drawer with a smaller header and more compact text sizing
- reduced mobile card-detail text and stat blocks inside the duel info drawer so detail content fits without overwhelming the field
- added extra bottom breathing room for the duel field so the floating info drawer no longer visually clips into the battlefield

## v1.6.1 - 2026-04-26

Patch release focused on stabilizing the post-theme-foundation UI so active themes apply consistently across the full app.

Included in this release:

- tightened the mobile shell density further across `Play`, `Deck Builder`, `History`, `Help`, and the duel info drawer
- fixed the mobile help tab row and history filters so they no longer overflow horizontally on phone layouts
- added a compatibility layer that maps remaining legacy `black / zinc / white` utility surfaces onto the active design-system theme tokens
- fixed themed sheets and overlays so popups, drawers, and page transitions no longer visibly fall back to the default black surface
- aligned duel chrome, modal backdrops, card-detail drawers, and other shared surfaces more closely with the active theme
- removed the phase-tracker motion warning by keeping color theme-driven and animating only position emphasis

## v1.6.0 - 2026-04-26

Foundation release focused on turning theme, typography, and localization into first-class app systems instead of partial UI patches.

Included in this release:

- rebuilt the styling base around centralized theme, surface, typography, spacing, radius, and control-size tokens in the shared CSS layer
- added formal design-system documentation for themes, typography, and reusable UI components under `docs/design-system/`
- split localization into per-language message modules with proper Unicode handling and English fallback
- translated more of the app shell, duel chrome, deck-builder flows, history, help, auth messaging, prompts, and competition surfaces through the shared message layer
- added centralized competition-flavor content and localized log-formatting helpers so duel/history rendering can be language-aware
- added card-localization infrastructure plus a Supabase migration for `card_localizations`, with English fallback behavior in the client content loader
- added regression coverage for message fallback and card-localization fallback and updated deck-builder tests for the current mobile/desktop controls

## v1.5.1 - 2026-04-25

Patch release focused on stabilizing the new preference UI and restoring the default visual baseline.

Included in this release:

- fixed the preference provider so language and theme changes are no longer overwritten by profile hydration
- removed the desktop home-page preference selectors that were disrupting the existing launcher layout
- kept the preference controls on account-focused surfaces where they fit the app flow
- softened the default obsidian theme helpers so the app keeps its prior spacing, font feel, and control styling more closely
- tightened the signed-in account page so language and theme selectors render without breaking the mobile layout

## v1.5.0 - 2026-04-25

Feature release focused on app-wide preferences for theme and language.

Included in this release:

- added a shared app preference layer for `language` and `theme` with local guest persistence and signed-in profile sync
- extended `profiles` in Supabase with `language` and `theme` fields and applied the remote migration
- added a typed translation layer and translated the main UI chrome across the shell, auth, history, help, deck-builder chrome, and key duel surfaces
- added four global themes:
  - `obsidian`
  - `ivory-ledger`
  - `terminal-signal`
  - `pharaoh-gold`
- moved shared app styling toward semantic theme tokens applied through the root `data-theme`
- added desktop and mobile preference selectors to the account controls
- applied cached preferences before React mount so returning users do not see a theme/language flash on startup
- added regression coverage for preference persistence and updated existing app/component tests for the shared preferences provider

## v1.4.1 - 2026-04-25

Patch release focused on cleaning the mobile home surface and locking the app-shell viewport on phones.

Included in this release:

- removed the redundant `Play First` hero block from the mobile `Play` tab since account identity is already shown in the app bar
- disabled pinch-zoom through the mobile viewport settings so the phone shell keeps its intended app-like framing

## v1.4.0 - 2026-04-24

Feature release focused on the mobile-first app shell overhaul and production bundle cleanup.

Included in this release:

- replaced the old mobile launcher-first flow with a true mobile app shell built around `Play`, `Decks`, `History`, and `Help`
- added shared mobile chrome and sheet patterns for the app bar, bottom tab bar, and bottom-sheet secondary surfaces
- rebuilt mobile Deck Builder around a library-first flow with sheet-based card details, deck management, and AI assist
- converted mobile History and Help into app-like page layouts that fit the new shell instead of desktop stacks squeezed into phone width
- kept desktop behavior intact while preserving the immersive duel screen outside the mobile tab shell
- added mobile regression coverage for shell navigation
- split heavy local game-content and duel-engine modules into separate Rollup chunks so the main entry bundle no longer trips Vite's 500 kB warning

## v1.3.12 - 2026-04-18

Patch release focused on removing the guest sign-in flash during saved-session restoration.

Included in this release:

- prevented the auth listener from opening the guest sign-in flow before the initial account bootstrap has actually resolved
- extended the startup auth gate so persisted sessions have time to restore before the app decides the user is a guest
- hydrated the saved profile during the initial auth pass so returning users go from `Loading account` directly to the menu
- added regression coverage for the specific race where a temporary null auth callback previously caused the guest modal to flash

## v1.3.11 - 2026-04-18

Patch release focused on preventing the guest prompt from flashing before persisted account restoration completes.

Included in this release:

- added an explicit auth-check-complete gate so the guest sign-in modal cannot render while the saved session is still being restored
- replaced the guest-modal flash with a short loading-account overlay until the initial account lookup resolves or times out
- kept the direct signed-in landing behavior so returning users go straight to the menu once the saved session is detected

## v1.3.10 - 2026-04-18

Patch release focused on faster startup and removing the post-load account dialog for returning users.

Included in this release:

- removed the app-level loading screen so the home menu renders immediately from bundled local content
- moved initial content refresh and account sync work fully into the background instead of blocking first render
- removed the returning-user session dialog so existing signed-in users now land directly on the menu
- shortened the initial auth grace window so persisted sessions resolve faster before the guest prompt is shown

## v1.3.9 - 2026-04-18

Patch release focused on cleaning user-facing account/source copy on the home and sign-in surfaces.

Included in this release:

- removed the home-screen content source label so the menu now shows only the user identity or guest status
- removed remaining player-facing backend references from the account flow and replaced them with neutral product copy
- kept the account behavior and sync wiring intact while simplifying what the user sees

## v1.3.8 - 2026-04-18

Patch release focused on fixing the signed-in prompt flow and reducing startup blocking on the home screen.

Included in this release:

- changed the post-boot auth prompt so returning users are asked whether to use the current account or sign in with a different account
- removed the confusing flow where an already signed-in user had to open the sign-in screen only to be shown account-management controls
- moved noncritical cloud sync work such as starter-deck seeding, competition progress refresh, and full profile hydration out of the critical first-render path
- added regression coverage for the existing-session auth prompt behavior

## v1.3.7 - 2026-04-18

Patch release focused on recovering clients stuck behind stale PWA caches.

Included in this release:

- switched the generated service worker to a self-destroying recovery mode so previously installed stale workers unregister themselves and clear cached assets
- restored the web deployment path as the priority by forcing clients back onto the latest network-served bundle instead of continuing to load an old precached app shell
- kept the core duel app code intact while disabling the broken cache layer that was serving outdated hashed bundles in production

## v1.3.6 - 2026-04-18

Patch release focused on guaranteeing the app leaves the loading screen even when authenticated boot paths stall.

Included in this release:

- added timeout protection around auth session lookup and profile hydration so signed-in startup no longer waits indefinitely on Supabase auth/profile calls
- added a top-level app boot guard so content load, user lookup, starter deck seeding, competition progress lookup, and profile hydration all fall back instead of blocking the initial render forever
- preserved normal cloud-backed behavior when Supabase responds in time while forcing local fallback when startup calls hang

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
