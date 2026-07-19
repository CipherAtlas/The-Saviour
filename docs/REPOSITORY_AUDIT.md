# Reaper of the Hollow Crown — Repository Audit

Audit date: 2026-07-18  
Scope: read-only repository, working-tree, architecture, requirement, reuse, and risk audit for the `DIRECTIONS.md` production pass.

## Baseline and change-control record

- Repository branch at audit: `main`.
- Initial production work began from a dirty working tree. The current audit snapshot contains 44 changed tracked paths and 60 untracked paths; those counts are descriptive and may change while approved specialists work.
- Every pre-existing and concurrent uncommitted change is user-owned baseline work. No audit conclusion authorizes discarding, resetting, overwriting, staging, committing, moving, renaming, or deleting it.
- The production pass reuses the existing package manager and dependencies. `package.json` contains only Three.js 0.185.1 and Vite 8.1.5; no dependency change is required by the current implementation.
- `DIRECTIONS.md` is the latest product specification. `Instructions.md` remains the narrative spine except for its four recorded supersessions: Zephyr's name, Elowen's motivation, 29 full-screen upgrade scenes, and the expanded 4,000–6,000-word corpus.

## Architecture map

| Area | Current responsibility | Primary evidence |
| --- | --- | --- |
| Boot and frame loop | Composes settings, persistence, input, audio, game state, renderer, UI, run session, optional autoplay, and benchmark modes; advances a fixed-step simulation and interpolated renderer | `src/main.js` |
| Core run state | Owns the phase machine, ten-floor/room progression, dialogue queueing, rewards, blessings, player state, boss-to-ending handoff, pause, and suspend snapshots | `src/game/Game.js`, `src/game/gameConfig.js` |
| Player combat | Combo, dash, charge, Harvest, Reaper's Claim, action coordination, hit stop, progression hooks, and collision contracts | `src/game/PlayerCombat.js`, `AttackCoordinator.js`, `HarvestState.js`, `ReapersClaim.js`, `HitStopClock.js` |
| Encounters and boss | Enemy pools and attacks, origin metadata, coordinated pressure, projectiles/hazards, phase-ordered Witch patterns, summons, and phase transitions | `src/game/EnemyDirector.js`, `bossPatterns.js`, `encounterPatterns.js`, `enemyArchetypes.js` |
| Narrative data and flow | Data-driven sequence registry, 29 upgrade IDs, floor projections, reader state, finale branches, glossary content, and art-state mapping | `src/game/dialogueContent.js`, `DialogueSystem.js`, `narrativeAssetManifest.js`, `glossaryContent.js` |
| Procedural rooms | Seeded arenas, layouts, biomes, models/props, and deterministic code-native biome decals | `src/generation/`, `src/rendering/BiomeRenderer.js` |
| 3D and effects | Three.js scene, camera, actors, synchronized body presentation, scythe, pooled VFX, damage numbers, Witch action presentation, and performance metrics | `src/rendering/` |
| VN, menu, and settings UI | Full-screen dialogue, title/difficulty/records/credits/glossary flows, HUD, settings, focus, and responsive presentation | `src/ui/`, `src/styles.css` |
| Music and sound | Adaptive cue selection, eight licensed music files, bounded decoded-buffer cache, combat/UI/ending sound event handling, and no voice acting | `src/audio/`, `public/assets/audio/`, `public/assets/LICENSES.md` |
| Persistence and records | Versioned narrative progress, settings, suspended run, run statistics, and lifetime statistics | `src/settings/`, `src/game/RunSessionController.js`, `RunStatsAccumulator.js` |
| Verification | Node test suites, syntax check, Vite production build, deterministic autoplay/reporting, runtime probe, and benchmark harness | `tests/`, `src/playtest/`, `src/benchmark/`, `package.json` |

The architecture remains a single-page ESM application. `Game` owns authoritative simulation state; rendering, UI, audio, persistence, autoplay, and reporting consume its snapshots/events. This event boundary is the main integration invariant: mechanics decide contacts and state commits, while actor animation, VFX, audio, and UI present the same action identifiers and timing.

## Current gameplay and narrative flow

1. The title UI exposes Continue when a valid suspended run exists, New Descent through difficulty selection, Records, completion-gated Glossary, Settings, and Credits.
2. A new run resets run-scoped state and begins the authored opening before combat.
3. Each floor projection and each of the 29 upgrade encounters resolves through the full-screen dialogue reader before gameplay or selection resumes.
4. Fixed-step combat advances rooms, room rewards, floor blessings, portals, and the next floor while preserving narrative ordering.
5. The Witch encounter enters ordered phase 1, phase 2, then phase 3 behavior; boss defeat starts the authored Witch-death and Elowen-reveal sequence rather than ending the run immediately.
6. The five-second circular decision resolves once to the kill branch or timeout branch, plays branch-specific narrative/presentation, fades, records the run, and unlocks completion-gated glossary progress.

This flow is observable in `Game` phase transitions and is exercised by unit/integration tests plus the separate browser autoplay harness. This audit records the integration shape; it does not substitute for the final manual gameplay record.

## Requirement inventory and disposition

| `DIRECTIONS.md` workstream | Current disposition | Reused or added implementation surfaces |
| --- | --- | --- |
| Canon and 4,000–6,000-word narrative | Implemented in data-driven content and canon/voice/continuity records; final canon review remains a release check | Existing dialogue event pipeline; expanded `dialogueContent.js` and narrative docs |
| Responsive combat, Harvest, Claim, charged reap, hit stop | Implemented with separate deterministic state objects and presentation contracts | Existing fixed-step combat/collision; focused combat modules and tests |
| Upgrades, three build paths, rerolls, difficulty | Implemented through validated progression definitions and behavior profiles | Existing reward/blessing flow; `progressionModel.js`, updated upgrade data |
| Enemy origins, coordination, Witch boss | Implemented in encounter metadata, action coordination, phase patterns, actor/VFX/audio presentation | Existing enemy director and licensed actor rigs; code-native presentation |
| Damage numbers and game feel | Implemented with a fixed-capacity DOM pool and event taxonomy | Existing combat events and camera; `DamageNumberLayer.js`, pooled effects |
| Full-screen VN and both endings | Implemented through the existing phase/event system with data-driven assets and an ending state machine | Existing dialogue and ending classes; expanded UI/reader/asset manifest |
| Art direction and production | Approved direction and selections; 26 current-wave character PNGs, three accepted Wave 2 states, and 41 backgrounds integrated | Approved in-repository samples; current assets documented in `public/assets/LICENSES.md` |
| Music, SFX, no voice acting | Eight externally licensed tracks documented and integrated; SFX remain code-native/event-driven | Existing Web Audio architecture; bounded licensed-track loader and cue map |
| Menu, suspension, settings, records | Implemented with versioned local persistence and validation | Existing settings store; new session/statistics stores and UI destinations |
| Accessibility and input | Settings and UI/input contracts cover keyboard, mouse, controller, touch, reduced motion, effects density, contrast, and scale | Existing `InputController`; responsive UI/settings extensions and tests |
| Performance and QA | Automated tests, syntax/build checks, autoplay reporting, and an explicit 35-enemy/200-particle benchmark harness exist | Existing Vite/Node scripts; no new dependency |

## Asset reuse and migration decisions

- KayKit Knight, Skeleton, and Dungeon Remastered assets remain the licensed CC0 low-poly gameplay foundation. Their authoritative sources, revisions, and terms are recorded in `public/assets/LICENSES.md`.
- The eight soundtrack files remain under Kevin MacLeod's CC BY 4.0 terms with direct authoritative track pages, attribution text, and runtime hashes in `public/assets/LICENSES.md`.
- Current narrative art is project-original production based on the approved in-repository direction: Zephyr C/right, Elowen A/left, and Witch B/center. Exact 26-character and 41-background inventories are recorded in `public/assets/LICENSES.md`.
- The three accepted Wave 2 cutouts are runtime-referenced. The two undersized Wave 2 backgrounds and contaminated menu cutout remain unreferenced candidates and were not promoted.
- Twelve legacy WebPs have unknown provenance. Runtime references to `princess-world.webp` and the four biome decal sheets were removed; all twelve are retained only because deletion was not authorized. They are not licensed, runtime-loaded, or copied into production builds; the packaging test intentionally keeps them on its denylist.
- Existing Three.js, Vite, system-font, Web Audio, DOM UI, and local-storage architecture was extended rather than replaced.

## Implemented file plan

| Workstream | Principal paths |
| --- | --- |
| Product/canon/design records | `DIRECTIONS.md`, `docs/NARRATIVE_BIBLE.md`, `docs/CHARACTER_VOICE_BIBLE.md`, `docs/FLOOR_DIALOGUE_PLAN.md`, `docs/DIALOGUE_CORPUS.md`, `docs/DIALOGUE_CONTINUITY_AUDIT.md`, `docs/NARRATIVE_TECHNICAL_DESIGN.md`, `docs/ART_DIRECTION.md`, `docs/ASSET_MATRIX.md`, `docs/PRODUCTION_PASS.md` |
| Mechanics and progression | `src/game/`, with focused new modules for Claim, Harvest, hit stop, coordination, progression, sessions, and statistics |
| Rendering and art integration | `src/rendering/`, `src/game/narrativeAssetManifest.js`, `public/assets/vn/`, `public/assets/menu/` |
| UI and accessibility | `src/ui/`, `src/styles.css`, `index.html`, settings/input modules |
| Audio | `src/audio/`, `public/assets/audio/`, `public/assets/LICENSES.md` |
| Persistence | `src/settings/`, `src/game/RunSessionController.js`, `src/game/RunStatsAccumulator.js` |
| Verification | `tests/`, `src/playtest/`, `src/benchmark/benchmarkHarness.js`, `vite.config.js`, manual QA records |

## Risk register

| Risk | Evidence | Current disposition |
| --- | --- | --- |
| Large user-owned dirty baseline | Audit snapshot contains 44 changed tracked paths and 60 untracked paths | Preserve all changes; review scoped diffs; no reset/stash/git write |
| Documentation can drift behind runtime | Earlier production records still described production as forbidden and legacy WebPs as runtime candidates | Corrected in `PRODUCTION_PASS.md`, `ASSET_MATRIX.md`, and `public/assets/LICENSES.md`; future QA should search for stale gate language |
| Unknown-provenance legacy files remain on disk | Twelve listed WebPs have no authoritative rights record | All runtime references removed; retained unused; future reuse prohibited without provenance |
| Raster and decoded-audio memory | 67 current VN PNGs plus eight music files are shipped | Scene-level asset mapping and a two-buffer soundtrack cache bound active decoded music; final device testing remains appropriate |
| Core orchestration files are large | `Game.js`, `GameUi.js`, `GameRenderer.js`, `EnemyDirector.js`, and `dialogueContent.js` carry cohesive but broad responsibilities | Preserve event/data boundaries; avoid unrelated refactors during release hardening |
| Browser/manual results are environment-specific | Autoplay and benchmark modes expose runtime reports, but unit/build success alone is insufficient | Keep automated gates and both-ending/manual visual/audio/accessibility evidence separate and explicit |
| Retained blocked candidates may be accidentally reintroduced | Files still exist by no-deletion policy | Runtime provenance test plus source search must remain release checks |

## Audit disposition

The repository has identifiable integration boundaries, existing test/build commands, data-driven narrative content, versioned persistence, and explicit runtime QA hooks. The approved pass extends those conventions without a dependency or package-manager change. This audit remains the implementation baseline; the completed test/build/diff, gameplay, visual, accessibility, technical-audio, performance, license, and both-ending evidence is recorded in `docs/FINAL_ACCEPTANCE.md`, with physical-controller and subjective-listening boundaries stated there rather than hidden.
