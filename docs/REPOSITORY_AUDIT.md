# The Saviour — Repository Audit

Audit date: 2026-07-20

## Current architecture

| Area | Ownership |
|---|---|
| Run state and progression | `src/game/Game.js`, `src/game/gameConfig.js` |
| Bookend content and timing | `src/game/BookendSequence.js`, `src/game/bookendContent.js`, `src/game/EndingSequence.js` |
| Encounters and enemy variants | `src/game/EnemyDirector.js`, `src/game/encounterPatterns.js`, `src/game/enemyArchetypes.js` |
| Combat | `src/game/PlayerCombat.js`, collision and attack modules under `src/game/` |
| Rendering | `src/rendering/` |
| Menus, HUD, Oath choices, VN bookends | `src/ui/`, `src/styles.css` |
| Audio | `src/audio/` |
| Settings, statistics, speed records, suspension | `src/settings/`, `src/game/RunSessionController.js`, `src/game/RunStatsAccumulator.js` |
| Deterministic verification | `tests/`, including `tests/bookendFlow.test.js` |

## Current flow

1. Title and run-type selection.
2. Standard opening VN, or immediate play for Speedrun.
3. Ten floors of uninterrupted combat and portals, with automatic chamber
   recovery and one Oath decision after floors 1–9.
4. Witch encounter.
5. Standard final plea VN, then the five-second action; Speedrun enters the action
   immediately after its clock freezes.
6. Branch resolution, optional standard ending VN, and run summary.

## Retired surface

The runtime no longer contains a general-purpose reader, floor/upgrade text
queues, term/archive data, presentation progress storage, or the large unused VN
asset inventory. Legacy local data is migrated only at persistence boundaries.

## Risks and controls

- `Game.js` and `GameUi.js` remain broad orchestration points. Keep new work
  scoped and preserve their event boundaries.
- Persistence schemas are independently versioned. Migration tests must accompany
  schema changes.
- Both final branches are stateful and time-sensitive. Keep deterministic harness
  coverage for resolution-once, pause behavior, and summary handoff.
- The working tree may contain user-owned work. Inspect status and diffs before
  edits; never discard unrelated changes.
