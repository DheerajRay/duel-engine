# Duel Engine

Browser-based Yu-Gi-Oh-inspired duel simulator built with React, TypeScript, Vite, and Tailwind CSS.

## What This App Is

`Duel Engine` is a single-page duel simulator focused on an original-series-style Duel Monsters ruleset. It includes:

- A start screen with quick play options
- A local deck builder
- A "How to Play" rules reference page
- A full in-browser duel board with turn phases, battle resolution, graveyards, and logs
- A simple scripted computer opponent
- PWA support so the site can be installed to a phone home screen like an app

There is no active gameplay backend. The duel runs in the browser, and saved decks are stored in `localStorage`.

## How To Run Locally

### Prerequisites

- Node.js installed
- npm available

### Local setup

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open the local URL shown by Vite.

The `dev` script is:

```bash
vite --port=3000 --host=0.0.0.0
```

So the app will typically be available on port `3000`.

### Test on an iPhone during development

1. Make sure your iPhone and development machine are on the same Wi-Fi network.
2. Run:

```bash
npm run dev
```

3. Open the LAN URL shown by Vite in Safari on the iPhone.

This is enough for layout, touch, and gameplay testing.

### Install as an iPhone app

To get the installable app-style experience, deploy the site to an HTTPS host first.

Recommended static hosts:

- Vercel
- Netlify
- GitHub Pages
- Cloudflare Pages

After deployment:

1. Open the HTTPS URL in Safari on the iPhone.
2. Tap `Share`.
3. Tap `Add to Home Screen`.
4. Launch `Duel Engine` from the new home-screen icon.

The installed app uses standalone display mode, so it opens without normal browser chrome.

### Production build

```bash
npm run build
```

This outputs the production bundle to `dist/`.
The production build also generates the PWA manifest and service worker.

### Preview production build locally

```bash
npm run preview
```

### Type-check the codebase

```bash
npm run lint
```

In this project, `lint` runs:

```bash
tsc --noEmit
```

### Run the automated test suite

```bash
npm run test
```

### Run tests in watch mode

```bash
npm run test:watch
```

### Generate a coverage report

```bash
npm run test:coverage
```

### Environment variables

No environment variables or API keys are required to run the current app locally.

## Versioning And Releases

The current baseline release is:

- `v1.0.0`

Version history should be tracked in:

- `package.json` for the current app version
- `CHANGELOG.md` for human-readable release notes
- Git tags such as `v1.0.0`, `v1.1.0`, `v1.1.1`

Recommended release flow:

1. Create a feature branch for the change.
2. Make and test the change locally.
3. Merge the branch into `main` after validation.
4. Bump the version in `package.json`.
5. Add release notes to `CHANGELOG.md`.
6. Create and push a Git tag for that release.
7. Let Vercel deploy `main`.

Suggested versioning model:

- `v1.0.0` for the current stable production baseline
- `v1.1.0` for new features
- `v1.1.1` for bug-fix-only releases
- `v2.0.0` for major breaking or structural changes

Recommended Git commands for a release:

```bash
git checkout main
git pull
git tag v1.0.0
git push origin main --tags
```

Using Git tags plus Vercel deployment history gives you two rollback paths:

- quick redeploy rollback in Vercel
- exact source rollback by checking out a previous Git tag

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS v4 via `@tailwindcss/vite`
- `vite-plugin-pwa` for installability and offline asset caching
- `motion` for animations
- `lucide-react` for icons
- shared centered announcement overlays for transient UI feedback
- `papaparse` for parsing the card CSV into an in-memory card database

## High-Level Application Flow

At runtime the app works like this:

1. `src/main.tsx` mounts the React app and handles PWA registration logic.
2. `src/App.tsx` controls top-level navigation between:
   - start screen
   - duel screen
   - deck builder
   - how-to-play page
3. Card data is loaded from `src/resource/original_yugioh_cards.csv` through `src/utils/cardParser.ts`.
4. Duel state is managed with `useReducer(...)` using `src/engine/reducer.ts`.
5. A local scripted opponent is driven by a `useEffect(...)` in `src/App.tsx`.
6. Saved decks and the selected primary deck are persisted in browser `localStorage`.

Once the bundle is loaded, the duel itself is fully local.

### Offline / installed behavior

The app now includes a service worker and manifest so that:

- built assets are cached after the first successful load
- the app can be installed from supported mobile browsers
- previously cached builds can reopen offline

Saved decks still remain local to the device/browser install because the app uses `localStorage`.

## How the Duel Engine Works

### 1. Card database

`src/utils/cardParser.ts` parses `src/resource/original_yugioh_cards.csv` and builds `CARD_DB`.

For each row it derives:

- `id`
- `name`
- `type` (`Monster`, `Spell`, `Trap`)
- `description`
- monster stats such as `attribute`, `level`, `atk`, `def`
- spell/trap property subtype where available
- fusion metadata for monsters marked as Fusion monsters

Fusion materials are inferred from CSV text using a simple parser, so fusion matching is approximate rather than a full official-rules parser.

### 2. Core game state

`src/types.ts` defines the main game model:

- player/opponent LP
- main deck
- extra deck
- hand
- graveyard
- 5 monster zones
- 5 spell/trap zones
- current turn
- current phase
- duel winner
- normal summon usage
- duel log

Each live card instance gets a unique `instanceId` so duplicate copies can be tracked independently.

### 3. Starting a game

From the start screen, the player can choose:

- `Random Deck`
- `Custom Deck`
- `Deck Builder`
- `How to Play`

#### Random Deck

Random mode:

- generates a curated 40-card main deck for both players
- generates a curated extra deck for both players
- shuffles both decks
- deals 5 cards to each player

#### Custom Deck

Custom mode:

- reads `ygo_custom_deck` and `ygo_custom_extra_deck` from browser storage
- requires at least 40 cards in the saved main deck
- uses the saved player deck against a generated opponent deck

If no valid saved custom deck exists, the UI blocks game start and tells the user to use the deck builder.

### 4. Reducer-driven duel state changes

`src/engine/reducer.ts` is the main rules engine. It handles actions such as:

- `START_GAME`
- `DRAW_CARD`
- `NEXT_PHASE`
- `SUMMON_MONSTER`
- `FUSION_SUMMON`
- `CHANGE_POSITION`
- `DECLARE_ATTACK`
- `ACTIVATE_SPELL`
- `ACTIVATE_TRAP`
- `SET_SPELL_TRAP`

The reducer is responsible for:

- moving cards between zones
- tribute handling
- battle damage
- monster destruction
- trap reactions
- draw-loss handling when a deck is empty
- end-of-turn resets like `hasAttacked`, `justSummoned`, and `changedPosition`

### 5. Turn structure

The implemented phase order is:

- `DP` - Draw Phase
- `M1` - Main Phase 1
- `BP` - Battle Phase
- `M2` - Main Phase 2
- `EP` - End Phase

The first player cannot attack on turn 1. In the current implementation, when the player advances from `M1` on the first turn, the app skips battle phase and main phase 2.

### 6. Player interactions

In `src/App.tsx`, the player interacts directly with cards and zones:

- click a hand card to summon, set, or activate it
- click a monster to change battle position during a main phase
- click the attack action on a monster during battle phase
- click a spell/trap already on the field to activate it
- click graveyards for `Monster Reborn` targeting
- click opposing cards when selecting attack or effect targets

Transient UI state such as tribute selection, attack targeting, discard selection, and fusion material selection is stored in a local `uiState` union in `src/App.tsx`.

### 7. Opponent logic

The opponent is a local scripted routine.

It currently does things like:

- draw automatically in draw phase
- activate certain spells when conditions are met
- try to fusion summon when it has valid materials
- summon the strongest available monster it can legally play
- set traps from hand when slots are open
- attack favorable or direct targets during battle phase
- advance phases automatically with short delays

This is rule-based local logic, not a model-backed opponent.

### 8. Logging and announcements

`src/utils/logGenerator.ts` creates stylized duel log messages for events like:

- duel start
- draws
- summons
- spell/trap activations
- attacks
- battle damage
- destruction
- turn changes

`src/App.tsx` also mirrors new log entries into the centered announcement overlay and uses the same announcement system for action prompts, validation feedback, and deck-builder status messages.

## Deck Builder

`src/pages/DeckBuilder.tsx` provides a local deck management UI with:

- card search
- card type filtering
- sorting
- add/remove card controls
- main deck and extra deck tracking
- save support
- primary deck selection
- multiple saved decks
- predefined character decks

### Deck rules enforced in the builder

- main deck minimum: 40 cards
- main deck maximum: 60 cards
- extra deck maximum: 15 cards
- maximum copies per card: 3

### Predefined character decks

The app ships with local predefined decks in `src/utils/characterDecks.ts` for:

- Yugi Muto
- Seto Kaiba
- Joey Wheeler
- Maximillion Pegasus
- Mai Valentine

These are read-only templates in the UI.

### Browser storage keys

The deck builder and game use the following browser `localStorage` keys:

- `ygo_saved_decks`
- `ygo_primary_deck_id`
- `ygo_custom_deck`
- `ygo_custom_extra_deck`

## Supported Gameplay Features

The current codebase supports these major mechanics in working form:

- starting LP at 8000
- draw phase
- normal summon
- set monster
- tribute summon logic
- battle position changes
- battle resolution
- direct attacks
- deck-out loss
- graveyard handling
- set spell/trap cards
- a subset of spell effects
- a subset of trap effects
- fusion summoning with extra deck monsters

## Implemented Card Effects

The reducer contains explicit logic for a limited set of named cards.

### Spells with implemented effect logic

- `Dark Hole`
- `Raigeki`
- `Fissure`
- `Hinotama`
- `Pot of Greed`
- `Tribute to the Doomed`
- `Monster Reborn`
- `Polymerization`

### Traps with implemented effect logic

- `Dust Tornado`
- `Trap Hole`
- `Mirror Force`
- `Magic Cylinder`

Notes:

- `Trap Hole`, `Mirror Force`, and `Magic Cylinder` are handled as reactions in battle and summon flow
- `Dust Tornado` is the main manually targetable trap in the current UI

## Important Limitations

### 1. Most monster effects are not implemented

Even if a monster is an effect monster in the CSV, it is usually treated as a stat block unless the engine contains special-case logic for it. In practice, most monsters currently behave like vanilla monsters.

### 2. Many spells and traps exist in the card database but do not have engine logic

The CSV and deck builder expose many cards, but only a smaller subset has reducer behavior. If an unsupported spell/trap is activated, it may:

- be placeable in the UI
- move to the graveyard
- produce log output
- not perform its intended effect

This matters especially for some predefined character decks, which include flavorful cards whose effects are not yet coded.

### 3. Rules scope is partial

The repository includes `src/resource/Rules.txt`, which appears to be a broad reference/spec for an original-era rules system, but the reducer does not implement all of that scope.

Notable gaps include:

- ritual summoning
- chain resolution as a full generic system
- full spell speed handling
- equip spell behavior
- field spell behavior
- continuous effect persistence
- full effect monster support
- a large number of individual card effects

### 4. Graveyard targeting is simplified

For `Monster Reborn`, clicking a graveyard currently chooses the most recent monster in that graveyard rather than opening a selector modal.

### 5. Fusion material parsing is heuristic-based

Fusion materials are parsed from CSV text and matched using simple string checks plus a few special cases. This is enough for basic play, but it is not a complete official card-text parser.

## File and Folder Guide

### Root

- `package.json` - scripts and dependencies
- `vite.config.ts` - Vite config
- `README.md` - project documentation
- `index.html` - SPA HTML shell
- `metadata.json` - minimal metadata file

### Source

- `src/main.tsx` - React entry point
- `src/App.tsx` - main app flow, duel UI, local opponent logic, routing between screens
- `src/types.ts` - core TypeScript models
- `src/constants.ts` - re-export of card database
- `src/index.css` - Tailwind import

### Engine and utilities

- `src/engine/reducer.ts` - duel rules and state transitions
- `src/utils/cardParser.ts` - CSV-to-card-database parser
- `src/utils/deckGenerator.ts` - random curated main/extra deck generation
- `src/utils/logGenerator.ts` - themed duel log messages
- `src/utils/characterDecks.ts` - predefined local decks

### UI

- `src/components/CardView.tsx` - reusable card renderer
- `src/pages/DeckBuilder.tsx` - deck creation and management page
- `src/pages/HowToPlay.tsx` - in-app rules/help page

### Data

- `src/resource/original_yugioh_cards.csv` - main card dataset
- `src/resource/Rules.txt` - rules/reference document

## How To Play Locally

1. Run the app with `npm run dev`
2. Open the start screen
3. Choose `Random Deck` for a quick match, or open `Deck Builder` first
4. In the deck builder, save a deck with at least 40 cards if you want to use `Custom Deck`
5. Start the duel
6. Click your deck during draw phase to draw
7. Use hand cards during main phases
8. Use the arrow button on the right side of the board to advance phases
9. Attack during battle phase using the attack action on eligible monsters

## Deployment Notes

This is a static front-end app from a gameplay perspective. The current codebase does not require:

- a database
- a running API server
- auth setup
- provider configuration

The app can be deployed anywhere a Vite-built React SPA can be hosted.

## Verification Summary

I checked the codebase and confirmed:

- gameplay is reducer-driven and browser-local
- no API keys are required by the current app
- `npm run lint` passes
- `npm run build` succeeds

The current build emits a Vite warning about a large JS chunk, but the build completes successfully.
