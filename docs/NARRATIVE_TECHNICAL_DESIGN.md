# Narrative, Persistence, Statistics, and Menu Technical Design

Status: implemented and accepted on 2026-07-18. This is the as-built design record derived from `DIRECTIONS.md`, `Instructions.md`, and the current source. `DIRECTIONS.md` supersedes older presentation decisions; the narrative spine and reveal order in `Instructions.md` remain locked.

## Purpose and implemented seams

The implementation turns the former beat-by-beat modal/inline dialogue into a full-screen visual-novel reader, adds persistent read state, the domestic prologue, all 29 full-screen upgrade encounters, the complete ending controller, safe run suspension, product statistics, Records, difficulty selection, and accessible menu navigation.

The released seams are:

- `src/game/dialogueContent.js` is the frozen data registry for characters, 49 full-screen VN sequences, stable sequence IDs, and 339 stable beat IDs.
- `src/game/DialogueSystem.js` validates IDs and speakers and owns the authoritative reader state: sequence, beat, reveal clock, history, auto, fast-forward, skip confirmation, and immutable snapshots. Compatibility `view`/`advance` calls route through that same state.
- `src/game/Game.js` owns the narrative queue, once-per-run sequence tracking, phase transitions, completion callbacks, room reward flow, and ending ordering.
- `src/game/EndingSequence.js` is an existing deep module with deterministic monotonic timestamps, pause/resume, strict deadline ownership, idempotent resolution, fade, and immutable snapshots.
- `src/settings/NarrativeProgressStore.js` v2 stores validated read-sequence state and persistent glossary access while preserving valid in-session state when storage fails.
- `src/settings/SettingsStore.js` v4 stores presentation/accessibility values, device bindings, and the remembered difficulty selection.
- `src/ui/GameUi.js` owns menu/modal DOM, focus handoff, current dialogue rendering, upgrade cards, touch controls, glossary, and ending presentation.
- `src/playtest/PlaytestReporter.js` remains diagnostic-only; `RunStatsAccumulator`, `StatisticsStore`, `SuspendedRunStore`, and `RunSessionController` own validated product persistence.

The existing stable IDs, data-driven content, deterministic queue order, Witch-origin dismissal order, strict five-second ending logic, controlled fade, glossary grant timing, and storage-failure behavior are invariants to preserve.

## Required 49-scene registry

The approved first-run registry contains exactly 49 full-screen VN sequences:

| Category | Count | IDs/rule |
| --- | ---: | --- |
| Warm domestic prologue | 1 | `opening.domestic` |
| Pursuit and threshold | 2 | `opening.ring`, `opening.threshold` |
| Witch floor projections | 10 | existing `floor.f01.witch` through `floor.f10.witch` |
| Upgrade encounters | 29 | `UPGRADE_SEQUENCE_IDS`; all use full-screen VN presentation |
| Boss confrontation | 1 | `boss.confrontation` |
| Witch death/reveal/endings | 6 | `ending.witch-death`, `ending.princess-reveal`, `ending.princess-human`, `ending.kill`, `ending.timeout`, `ending.timeout-final` |
| **Total** | **49** | exact invariant |

The domestic scene is the single addition to the former 48-sequence registry. Its content follows `DIRECTIONS.md`: lived-in marriage, paired rings, concealed unease without necromancy disclosure, and a memory worth carrying into the descent.

All sequences use one `presentation:"vn"` mode. Upgrade flow is explicitly:

```text
room clear -> full-screen upgrade sequence -> sequence completion -> reward screen -> mechanical choice
```

The scene itself never makes or pretends to make a branch. The only narrative branch remains the final kill-or-hesitate action. The complete first-run corpus remains approximately 4,000–6,000 words and 20–30 distributed minutes; scene length varies by dramatic purpose.

## Architectural decisions

### Deepen `DialogueSystem` into the reader authority

**Problem.** Typewriter timing, first-input reveal, auto, backlog, hide, fast-forward, read gating, and scene skip would become inconsistent if split between Game and DOM listeners.

**Constraints.** Content remains data-driven, Game owns world phase/order, UI is presentation only, and headless tests must exercise the same interface as production.

**Chosen approach.** Deepen the existing `DialogueSystem` rather than layer a second reader over it. It owns the active sequence, beat, reveal count, reader clock, modes, history, and command interpretation behind `start`, `handleCommand`, `update`, `snapshot`, and `reset`.

**Real alternatives.** A new `VNReader` wrapping `DialogueSystem` would preserve the old class but create a shallow pass-through and two sources of position state. UI-owned typewriter logic would be quick but untestable through the gameplay seam and vulnerable to duplicate input.

**Why and trade-off.** The existing module is the natural content/reader seam. Its implementation grows, while callers learn fewer methods and receive one authoritative snapshot.

### Keep Game responsible for sequence order, not reader mechanics

**Problem.** Sequence completion triggers room play, rewards, Witch dismissal, reveal, decision, and ending fade.

**Constraints.** Reader modes must not alter canon order, and callbacks cannot be persisted safely.

**Chosen approach.** Game queues stable sequence IDs plus an internal completion intent enum. `DialogueSystem` reports completion; Game resolves the intent and next phase. Reader commands never call reward, origin, or ending code directly.

**Real alternatives.** Keeping arbitrary closure callbacks is concise but not inspectable or serializable. Encoding world transitions in dialogue content would conflate narrative data and gameplay authority.

**Why and trade-off.** Stable intent IDs make ordering testable and future suspend validation possible. Game gains an explicit transition table instead of opaque callbacks.

### Extend narrative progress for read state

**Problem.** Fast-forward and skip-read behavior requires persistent beat identity while glossary access must survive settings/statistics resets.

**Constraints.** Stable beat IDs already exist; storage can be malformed, unavailable, or from v1.

**Chosen approach.** Migrate `NarrativeProgressStore` to v2 with `glossaryUnlocked`, `readBeatIds`, and `completedSequenceIds`. Validate against the content registry and keep in-session state on write failure.

**Real alternatives.** A separate read-state key isolates write frequency but splits one narrative-progress concept across stores. Storing text hashes breaks after copy edits. Storing only sequence completion cannot gate individual lines.

**Why and trade-off.** One store owns durable narrative knowledge and existing reset isolation. Sets serialize as arrays and are rewritten after completed beats/scenes, which is acceptable at this scale.

### Add an explicit room-boundary resume point

**Problem.** Live enemies, projectiles, modal callbacks, and in-progress endings cannot be serialized safely.

**Constraints.** Suspension is allowed only at stable room boundaries, must restore deterministic run state, and must never expose Continue for invalid data.

**Chosen approach.** Add an explicit `roomBoundary` Game phase after chamber/floor resolution and before the next room is loaded. Save the deterministic next-room state there. The slot is refreshed at each boundary and may be resumed after an application exit.

**Real alternatives.** Serializing arbitrary in-room actors would require versioning every AI/projectile/animation state. Saving only on explicit quit risks loss when the app closes unexpectedly. Saving at room start can collide with modal opening sequences.

**Why and trade-off.** The boundary snapshot is small, reconstructible, and safe. A crash during combat returns to the previous boundary rather than the exact frame, which is the deliberate persistence contract.

### Separate product statistics from diagnostics

**Problem.** `PlaytestReporter` contains timeline, navigation, performance, and autoplay details that are unsuitable for local player Records.

**Constraints.** DIRECTIONS defines exact time semantics and minimum run/lifetime fields; storage is local-only and separately resettable.

**Chosen approach.** Add a deep `RunStatsAccumulator` consuming canonical Game events and active-time samples, plus a versioned `StatisticsStore` that aggregates one finalized run exactly once. Records derives presentation summaries from primitive aggregates.

**Real alternatives.** Persisting the reporter is expedient but violates privacy/presentation requirements and couples schema to diagnostics. Letting UI count events duplicates rules and loses headless runs.

**Why and trade-off.** Product semantics stay stable while reporter instrumentation can evolve. Game must emit a few richer resolved events, especially damage, origin, upgrades, and terminal cause.

### Use one focus/navigation layer for every menu and VN screen

**Problem.** Difficulty, upgrades, Records, backlog, confirmation dialogs, endings, and pause must work without a mouse and must not leak input into combat.

**Constraints.** Existing `GameUi` owns DOM and focus; keyboard, controller, and touch share named actions.

**Chosen approach.** `GameUi` remains the sole UI owner and maps named UI actions to semantic commands. Each screen declares its focus order, initial focus, focus trap, and restoration target. Opening a modal pushes a focus return; closing flushes its activation actions.

**Real alternatives.** Per-screen key handlers are simple but duplicate direction/confirm/cancel behavior. A new UI framework or dependency is unnecessary.

**Why and trade-off.** One navigation implementation supports all inputs and accessibility audits. The monolithic UI file remains a serialization point for ownership until a real responsibility seam justifies splitting it.

### Preserve `EndingSequence` as the ending-clock authority

**Problem.** Reader integration adds new presentation and input paths around a deadline whose strict-before semantics already work.

**Constraints.** Pause, backgrounding, stale input, large frame jumps, fade, and exactly-once resolution cannot regress.

**Chosen approach.** Keep `EndingSequence` as the sole decision/fade clock. Game starts it only after the final human plea, and presentation consumes its immutable snapshot.

**Real alternatives.** Moving the countdown into DialogueSystem would couple a one-off terminal branch to general reader timing. CSS/renderer countdown completion would make the deadline frame-dependent.

**Why and trade-off.** The existing deep module and tests remain authoritative. Reader/Game integration must adapt to its clock instead of gaining a unified but less reliable narrative timer.

## Durable named concepts

Named JSDoc records are used only where the shape crosses multiple module seams or is validated/persisted.

### `ReaderSnapshot`

- **Concept:** complete immutable reader state required by UI and tests.
- **Fields:** sequence/beat IDs, speaker, text, background/staging/expression/pose fields, position/total, revealed character count, reader phase, auto/fast-forward/backlog/UI-hidden flags, and skip-confirmation state.
- **Location:** `src/game/DialogueSystem.js`.
- **Export status:** immutable return from `snapshot()` and event payload; no mutable reader object escapes.
- **Why named:** Game, GameUi, audio, autoplay, accessibility tests, and narrative tests need one synchronized view.
- **Rejected alternatives:** the existing public beat is insufficient; independent inline UI shapes would recalculate reader state.

### `NarrativeProgressSnapshot`

- **Concept:** persistent player knowledge independent of a run.
- **Fields:** `version`, `glossaryUnlocked`, sorted `readBeatIds`, sorted `completedSequenceIds`.
- **Location:** `src/settings/NarrativeProgressStore.js`.
- **Export status:** immutable return from `getSnapshot()` and subscription payload.
- **Why named:** reader gating, glossary, Records/menu presentation, tests, and storage migration consume it.
- **Rejected alternatives:** reusing settings conflates reset domains; an inline pair of sets omits schema/version semantics.

### `SuspendedRunSnapshot`

- **Concept:** validated pure-data checkpoint for deterministic room-boundary resume.
- **Fields:** specified in the suspension schema below.
- **Location:** new `src/settings/SuspendedRunStore.js` with construction owned by Game.
- **Export status:** immutable validated value from `loadValid()`; raw storage candidates never escape.
- **Why named:** Game, main menu Continue, storage validation, migration, and tests must agree on every field.
- **Rejected alternatives:** serializing `Game` leaks mutable actors/callbacks; an anonymous JSON blob cannot be validated or migrated responsibly.

### `RunStatistics`

- **Concept:** one immutable finalized product record from run start to one terminal result.
- **Location:** new `src/game/RunStatsAccumulator.js`.
- **Export status:** immutable result of `finalize(terminalEvent)`; passed once to `StatisticsStore` and end-run UI.
- **Why named:** its time and counter semantics cross Game, storage, summary, Records, and tests.
- **Rejected alternatives:** `PlaytestReporter` has the wrong retention/privacy semantics; UI-derived counters miss nonvisual events.

### `LifetimeStatistics`

- **Concept:** validated versioned primitive aggregates for Records.
- **Location:** new `src/settings/StatisticsStore.js`.
- **Export status:** immutable snapshot from the store. Derived favorite/preferred labels are not stored in the record.
- **Why named:** storage migration, records grouping, reset, and aggregate tests require one schema.
- **Rejected alternatives:** persisting derived labels risks drift; reusing `RunStatistics[]` indefinitely creates unbounded retention not required by the product.

`DifficultyProfile` is already defined at the combat/input seam in `gameConfig.js`; this design references it rather than duplicating a type. Reader command strings, focus directions, and one-use event details remain inline.

## Visual-novel reader interface and state machine

Public interface:

```text
sequence(id) -> immutable sequence or throws configuration error
start(sequenceId, nowMs) -> ReaderSnapshot
handleCommand(command, nowMs) -> { accepted, effect, snapshot }
update(nowMs) -> { events, snapshot }
snapshot() -> ReaderSnapshot | null
reset(reason) -> null
```

Reader state:

```text
closed
  -- start valid sequence --> revealing
revealing
  -- reveal clock reaches end --> awaitingAdvance
  -- advance command --> awaitingAdvance (reveal completes; beat does not change)
awaitingAdvance
  -- advance/eligible auto --> transitioning
transitioning
  -- next beat installed --> revealing
  -- no next beat --> completed
completed
  -- Game acknowledges --> closed
```

Orthogonal modes are `autoEnabled`, `fastForwardHeld`, `backlogOpen`, `uiHidden`, and `skipConfirmationOpen`. Modes do not replace the canonical reader phase.

Command contract:

- `advance`: while revealing, reveals the full current beat and marks it read; while awaiting, advances exactly once.
- `toggleAuto`: auto reveals at selected text speed and advances only after full reveal plus configured readable delay. New text is shown normally and never bypassed.
- `fastForwardStart`/`fastForwardEnd`: acceleration applies only when the active beat is already in persistent read state. Unread text immediately returns to normal reveal speed.
- `openBacklog`/`closeBacklog`: pauses auto/reveal progression, renders previously presented beats, and does not alter canonical position.
- `toggleUi`: hides/restores presentation chrome without advancing. A minimal accessible restore control remains available.
- `requestSceneSkip`: opens confirmation; it never skips immediately.
- `confirmSceneSkip`: completes the scene with `skipped:true` only when policy permits. Previously unread beats are not silently marked read.
- `cancel`: closes backlog/confirmation first; it does not skip or exit a required scene.

Timing invariants:

- Text speed and auto delay are validated settings. Reveal uses Unicode code points/grapheme-safe segmentation rather than splitting surrogate pairs.
- Reader time advances only in active foreground narrative, excluding pause and background time.
- At most one text-node update occurs per render frame. A large frame may reveal multiple characters but cannot advance more than one beat without an explicit/eligible auto transition.
- A beat is persisted as read when its full text has been visibly revealed, whether by time or first advance.
- Audio ticks are rate-limited and never play human voice, breaths, efforts, or barks.

Invalid sequence/speaker/beat/staging asset keys are content configuration failures: reject startup, emit a diagnostic with IDs, and show a recoverable narrative error screen rather than deadlock Game in `dialogue`.

## Scene data contract

Each frozen sequence contains stable `id`, `presentation:"vn"`, repeat policy, scene role, and non-empty beats. Each beat retains stable `id`, speaker, and text and adds only data-driven presentation keys needed by the approved art bible: background key/variant, stage position, expression, pose, transition, and optional nonverbal direction.

- Character, background, expression, pose, and transition keys must resolve through readiness manifests before a run.
- Presentation metadata cannot disclose Elowen's origin or necromancy before the approved reveal.
- Background variations remain coherent with the current biome and preserve text/silhouette contrast.
- Missing optional art may use an approved same-character fallback. Missing required character/background keys fail readiness tests; they may not silently display unrelated art.
- Upgrade scene completion and mechanical selection are separate phases and events.
- The sequence registry is frozen, IDs are unique, beat IDs are globally stable, and the exact counts are 49 total/29 upgrades.

## Narrative order and Game phase contract

Game replaces callback closures with stable completion intents such as `requestRoomPlay`, `offerRoomReward`, `dismissWitchOrigin`, `revealPrincess`, `beginEndingDecision`, and `beginEndingFade`. These values remain internal to Game; no named type is necessary because they do not cross a module seam.

First-run ordering begins:

```text
opening.domestic -> opening.ring -> opening.threshold -> floor.f01.witch -> play
```

Each later floor begins with its projection. Each of the 29 reward placements opens its corresponding full-screen upgrade sequence before `reward` or `blessing` selection. Once-per-run IDs remain deterministic and reset on a new run.

Ending ordering is immutable:

```text
Witch health reaches zero
-> ending.witch-death fully completes
-> dismiss Witch-origin actors/effects
-> emit witchMagicCeased
-> ending.princess-reveal
-> ending.princess-human
-> flush stale actions
-> one five-second ending decision
-> ending.kill OR ending.timeout -> ending.timeout-final
-> controlled fade
-> endingCompleted
-> persistent glossary unlock
-> runEnded exactly once
```

Elowen-origin actors/instability survive Witch-only dismissal. The decision accepts the explicit kill action from every device strictly before the deadline; the deadline belongs to timeout. Pause/background freezes remaining time unless the deadline was already reached, in which case timeout resolves at the exact deadline. Large frame jumps, stale input, and repeated input cannot resolve twice. The circular visual countdown is nonnumeric; accessible text may describe urgency without making a plain number the sole representation.

## Read-state persistence

`NarrativeProgressStore` v2 schema:

```text
{
  version: 2,
  glossaryUnlocked: boolean,
  readBeatIds: string[],
  completedSequenceIds: string[]
}
```

- v1 migrates by preserving `glossaryUnlocked` and initializing both arrays empty.
- Arrays are deduplicated, bounded to IDs present in the current frozen registry, and serialized in stable order.
- Unknown/removed IDs are ignored; newly added IDs are therefore unread.
- Beat completion and sequence completion writes are idempotent and notify subscribers only on change.
- Failed reads use a valid default. Failed writes preserve the current in-session snapshot and surface a nonblocking storage warning.
- Glossary unlock remains false through ordinary death, settings reset, statistics reset, suspended-run deletion, and incomplete endings. Either fully completed ending unlocks it exactly once.
- Scene skip does not mark unseen beats read. A scene is added to `completedSequenceIds` only after normal completion or an explicitly confirmed allowed skip.

## Difficulty, menu, focus, and input flow

Main navigation states:

```text
loading -> title
title -> continueLoading | difficultySelect | records | glossary | settings | credits
difficultySelect -> runStarting | title
pause -> resume | settings | suspendAndTitle | confirmedAbandon
terminalSummary -> difficultySelect(retry) | records | title
```

- Required title destinations are Continue, New Descent, Records, Glossary, Settings, Credits, and Quit where supported.
- Continue is rendered and focusable only when `SuspendedRunStore.loadValid()` returns a valid snapshot.
- New Descent and Retry always enter difficulty selection. The last highlighted difficulty is remembered, while the active run uses the immutable lock defined in the combat design.
- Starting New Descent while a valid suspended run exists requires confirmation that the old run will be abandoned/replaced.
- Every screen has a semantic heading, initial focus, visible focus state, directional order, confirm/cancel action, focus trap when modal, and restoration target.
- Controller and touch invoke the same named UI commands as keyboard/mouse. No screen, upgrade, ending, backlog, Records action, or confirmation requires a pointer.
- Opening or closing a screen flushes the confirm/cancel/combat actions used for that transition. Gameplay actions remain suppressed while a menu/VN modal owns focus.
- UI scale, high contrast, text speed, auto speed, reduced motion, flash reduction, subtitle/text settings, and particle/effects controls apply without clipping at the minimum viewport or coarse-pointer layouts.

## Room-boundary suspension and Continue

### Eligibility

`Game.canSuspend()` is true only in the explicit `roomBoundary` phase after all chamber combat, portal traversal, narrative, reward/blessing selection, and completion intents have resolved, and before the next arena loads. It is false during combat, room loading, dialogue, reward, blessing, pause-over-modal, active Claim, boss resolution, ending choice, ending dialogue/fade, death, or any terminal state.

The slot may be refreshed automatically on reaching a valid boundary. `Suspend and Return to Title` is offered only there. Exiting during combat resumes from the most recent completed boundary, not the interrupted frame.

### `SuspendedRunSnapshot` schema

```text
{
  version,
  savedAt,
  seed,
  difficultyId,
  nextFloor,
  nextRoom,
  player: {
    health
  },
  harvestUnits,
  deathDefiance: { granted, remaining },
  upgradeSelections: [{ upgradeId, rankAfter }],
  upgradeRanks: [[upgradeId, rank]],
  blessingIds: string[],
  rerollsUsedByFloor: number[],
  runFlags: validated boolean record,
  seenRunSequenceIds: string[],
  completedUpgradeSequenceIds: string[],
  statisticsDraft: validated run-accumulator snapshot
}
```

Only fields required to reproduce approved run behavior are added. Position, enemies, projectiles, hazards, active attacks, Claim, renderer/audio/input state, DOM, promises, functions, arbitrary callbacks, and modal reader state are forbidden.

Validation invariants:

- Version must be supported; seed and difficulty must be valid; floor/room/ranks/resources are bounded; every content/upgrade/blessing ID exists.
- Death Defiance `granted` and `remaining` are separate, nonnegative, and granted never exceeds the approved total cap of two.
- Player combat modifiers and maximum health are derived by replaying validated upgrade/blessing selections from the normal run baseline; they are not trusted as duplicate persisted values. Stored current health is clamped to the rebuilt maximum. `upgradeRanks` is a validation checksum for the ordered selection history, not a second authority.
- The next room is regenerated from seed and deterministic run progression. Reward/room random streams cannot depend on resume wall time.
- `statisticsDraft` must match run identity and cannot already be finalized.
- Loading returns a deep immutable copy. Raw storage objects never become Game state.

On malformed, incompatible, or semantically impossible data, `loadValid()` returns null, Continue stays hidden, and the bad record is removed on a best-effort basis without touching other stores. Storage exceptions do not crash the menu.

Resume flow is `title -> continueLoading -> validate again -> construct locked run -> restore pure progression -> load next deterministic room -> queue required narrative -> playing/dialogue`. Failure returns to title with an actionable local error and leaves no half-restored Game.

The slot clears after ordinary terminal death, either fully completed ending, or separately confirmed abandon/replace. Settings reset, narrative reset logic, glossary unlock, and Reset Statistics cannot clear it.

## Product statistics

### Clock semantics

- **Run time:** combat and narrative time from run start to terminal outcome, excluding pause and background-tab time.
- **Combat time:** active time in combat phases only.
- **Total playtime:** active foreground time in menus, narrative, and gameplay, excluding pauses and background-tab time.
- Boss clear time is active boss-combat time, excluding pause/background time.

`main.js` supplies foreground/visibility and elapsed time; `RunStatsAccumulator` classifies it by authoritative Game phase. DOM or renderer frames do not infer combat.

### Exact `RunStatistics` fields

- seed and locked difficulty
- duration and combat time
- deepest floor and rooms cleared
- exactly one terminal result: ending or cause of death
- enemies killed by type and by Witch/Elowen origin
- damage dealt and damage taken
- healing received
- critical hits
- highest hit, defined as highest damage dealt by one resolved player hit
- dashes and perfect dashes
- charged reaps and perfect releases
- Reaper's Claim uses
- Harvest generated and spent
- Death Defiance activations granted and consumed
- ordered upgrades/blessings with resulting ranks, final ranks, rerolls used, and final Reaper/Shade/Grave path totals
- boss attempted and boss clear time, null when not cleared

Do not substitute largest hit received, generic “deaths,” preferred difficulty, or diagnostic timeline fields for any approved run statistic.

### Exact `LifetimeStatistics` semantics

Persist primitive aggregates sufficient to provide:

- total active playtime
- attempts
- completions grouped by ending and difficulty
- best completion time by difficulty
- deepest floor by difficulty
- aggregate kills, damage dealt, damage taken, healing, criticals, and highest single hit dealt
- aggregate use of major combat actions
- boss attempts and clears
- upgrade and path-selection history sufficient to summarize preferred builds

Aggregate major actions include dashes/perfect dashes, charged reaps/perfect releases, and Reaper's Claim. Upgrade history stores selection counts and ranks by stable ID; path history stores final Reaper/Shade/Grave totals per run or bounded aggregate distributions. Completion rate, favorites, and preferred-build labels are derived views, not independently persisted values that can drift.

### Product event mapping

| Source | Recorded effect |
| --- | --- |
| `runStarted` | seed, locked difficulty, attempt identity |
| active foreground phase samples | run, combat, and total-playtime clocks under the approved semantics |
| room entered/cleared | deepest floor and rooms cleared |
| enemy defeated | type and origin kill maps |
| resolved player/enemy damage | damage dealt/taken, critical count, highest player hit |
| healing resolved | actual post-clamp healing received |
| dash/perfect-dash events | separate counters |
| `chargeReleased` | charged reap and perfect-release counters |
| `claimStarted` | accepted Claim use counter |
| `harvestChanged` | positive generated and negative spent deltas |
| Death Defiance grant/consume events | separate activation counters |
| upgrade/blessing/reroll events | ordered selection, resulting rank, reroll, final path data |
| boss combat start/defeat | attempt and active clear duration |
| `runEnded` | one idempotent terminal result with ending or cause |

The accumulator exposes `record(event)`, `sampleTime(dt, phase, foreground)`, `snapshotDraft()`, and `finalize(terminal)`. `finalize` rejects a second call. `StatisticsStore.recordCompletedRun(runStatistics)` deduplicates by a run ID derived from seed/start identity and writes lifetime state once.

## Records and run summary

- Show a concise run summary after ordinary death and both endings, using finalized `RunStatistics`.
- Records is a title destination showing lifetime totals and difficulty-specific comparisons where combining Story, Standard, and Ruthless would mislead.
- Records may derive completion rate, favorite major action, most selected upgrades, and preferred path/build summaries only from the approved primitive history.
- Empty Records has clear local-only copy and a direct route back; it does not fabricate sample runs.
- Reset Statistics requires a second explicit confirmation and deletes only the statistics key. The current in-session summary may remain visible until leaving the terminal screen.
- No external telemetry is sent.
- Timeline, navigation, performance samples, autoplay commands, and other `PlaytestReporter` diagnostics are never persisted or exposed as product Records.

## Storage isolation and failure contract

Use independent versioned keys and modules:

- settings: existing `SettingsStore`
- narrative knowledge/glossary: `NarrativeProgressStore`
- one suspended run: `SuspendedRunStore`
- product aggregates: `StatisticsStore`

Each store parses into a candidate, validates every required field/range/ID, and only then replaces its in-memory state. Writes are wrapped because browser storage can be unavailable or full. There is no false claim of filesystem-style atomic rename in localStorage.

Failure behavior:

- Invalid suspend: Continue hidden; other stores unaffected.
- Invalid statistics: Records uses a valid empty aggregate and shows a nonblocking local-storage warning; current run remains in memory.
- Invalid narrative v2: use a safe locked/empty default unless a valid v1 migration is possible; never grant glossary from malformed data.
- Write failure: keep the valid in-session snapshot, notify once without a modal loop, and retry only on the next meaningful stable write.
- Reset operations affect exactly their named key and notify their own subscribers only.

Persistence happens after a beat/sequence becomes read, at a valid room boundary, and at terminal statistics aggregation—not every frame or fixed step.

## VN presentation, audio, accessibility, and performance

- GameUi renders large staged character cutouts, expression/pose changes, layered backgrounds, nameplate, readable text box, backlog, auto/fast-forward/hide state, and clear controls from `ReaderSnapshot`.
- Renderer/UI may interpolate or animate transitions but cannot advance reader phase. One scene/beat ID links art, text, audio, and read state.
- Background/portrait assets are preloaded or streamed before the scene that requires them. Missing readiness keys fail before entering the scene, preventing combat or narrative stutter.
- VN sound covers text, advance, backlog, auto, skip, and transition actions without recorded/synthesized human vocal performance.
- Text contrast, silhouette separation, high UI scale, high contrast, reduced motion, flash reduction, and minimum/coarse-pointer layouts are required.
- Backlog retains the run's presented beats as data but renders at most 100 DOM rows at once; older rows are paged/windowed rather than discarded.
- Typewriter changes one existing text node at most once per render frame. It never creates a DOM element per character.
- Animated scene layers, particles, hazards, and sprite effects receive fixed caps in shared config. Narrative presentation must remain inside the authoritative combat benchmark budget: CPU p95 6 ms, reliable GPU p95 8 ms, 100 draw calls, 200,000 triangles, with stress 35 enemies/200 particles. A reviewed measurement is required before any budget change.
- Reduced motion replaces parallax, shake, aggressive transition motion, and ending instability movement with restrained opacity/grade/shape changes while preserving the circular urgency and story meaning.

## Event contract

| Event | Required payload |
| --- | --- |
| `narrativeStarted` | `{ sequenceId, sceneRole, reader:ReaderSnapshot }` |
| `narrativeUpdated` | `{ effect, reader:ReaderSnapshot }` |
| `narrativeBeatRead` | `{ sequenceId, beatId }` |
| `narrativeCompleted` | `{ sequenceId, skipped, completionIntent }` |
| `narrativeError` | `{ sequenceId, beatId?, reason }` |
| `difficultySelectionRequested` | `{ previousScreen, highlightedId }` |
| `runDifficultyLocked` | `{ difficultyId }` |
| `runBoundaryReached` | `{ floor, room, nextFloor, nextRoom }` |
| `suspendedRunSaved` | `{ seed, difficultyId, nextFloor, nextRoom }` |
| `suspendedRunRejected` | `{ reason }` without raw storage data |
| `suspendedRunCleared` | `{ reason:"death"|"ending"|"abandon"|"replace" }` |
| `runStatisticsFinalized` | `{ runId, statistics:RunStatistics }` |
| `lifetimeStatisticsChanged` | `{ version }` |

During migration, existing `dialogueStarted`, `dialogueAdvanced`, and `dialogueCompleted` may remain compatibility events with their current ordering. New consumers use reader snapshots; compatibility events are removed only after all tests/audio/UI consumers migrate in one approved milestone.

## Deterministic verification matrix

| Area | Automated acceptance |
| --- | --- |
| Registry | Exactly 49 unique sequence IDs, 29 unique upgrade IDs, unique beat IDs, all `presentation:"vn"`, non-empty beats, valid character/art/staging keys, first-run word count report |
| Order | Domestic/ring/threshold/floor order; ten floor projections; all 29 upgrade scene-before-choice transitions; deterministic repeat rules; new run clears run-only ordering |
| Reader | First input reveals, second advances; zero/mid/end timing; Unicode-safe reveal; auto delay; backlog pause; hide/restore; read-only fast-forward; unread protection; confirmed skip; no duplicate completion |
| Read state | v1-to-v2 glossary preservation; beat/sequence idempotence; unknown ID filtering; malformed/newer data; read/write failure; settings/stat/suspend reset isolation |
| Ending | Witch final line before dismissal; Witch-only cleanup; reveal order; stale-input flush; strict-before-deadline kill; deadline timeout; pause/background/large jump; exactly-once result/fade/run end/glossary grant; both complete branches |
| Difficulty/menu | New/Retry always selects; last highlight versus run lock; Continue validity; all destinations; focus trap/restore; no-mouse keyboard/controller/touch flows; action bleed prevention |
| Suspend | Every eligibility rejection; save at multiple floors; upgrades/ranks/rerolls; Harvest; separate Death Defiance fields/cap; difficulty; narrative ordering; deterministic next room; malformed IDs/ranges/version; storage failure; terminal/confirmed clear only |
| Run statistics | Every required field above; highest hit is player damage dealt; kill type/origin; exact time exclusion; boss attempt/clear; upgrades/ranks/rerolls/path totals; terminal aggregation exactly once |
| Lifetime statistics | attempts; ending+difficulty completions; per-difficulty best/deepest; all aggregates; major actions; boss attempts/clears; preferred-build source history; deduplication; reset isolation |
| Records | Empty/error/populated states; difficulty grouping; summary after death/both endings; confirmed reset; no reporter-only fields; all-device focus/navigation |
| Performance/accessibility | One text mutation/frame; backlog render cap; asset preload; animated-layer caps; exact global budgets; UI scale/contrast/reduced motion/flash/minimum viewport/coarse pointer |

Focused suites include `tests/dialogueSystem.test.js`, `tests/narrativeContent.test.js`, `tests/narrativeFlow.test.js`, `tests/narrativeProgressStore.test.js`, `tests/progression.test.js`, `tests/settingsStore.test.js`, `tests/inputController.test.js`, `tests/GameUiMenu.test.js`, `tests/RunSessionController.test.js`, `tests/statisticsStore.test.js`, `tests/suspendedRunStore.test.js`, `tests/vnUiContract.test.js`, and `tests/narrativeImageReadiness.test.js`. The full suite, exact asset readiness, release packaging, both autoplay routes, and benchmark are recorded in `docs/FINAL_ACCEPTANCE.md`.

Manual validation must inspect all 49 scenes on desktop and mobile/coarse-pointer layouts; keyboard, controller, and touch; every upgrade transition; both ending branches; pause/background timing; valid/invalid Continue; representative suspend points; Records/reset; high UI scale/contrast; reduced motion/flash; scene art continuity; audio transitions; and complete fade/post-ending UI. Compilation and autoplay alone are insufficient.

## Non-overlapping implementation ownership

This ownership order also respects `COMBAT_INPUT_TECHNICAL_DESIGN.md`. Shared files cannot be edited concurrently.

1. **Narrative content owner:** after approved narrative/art bibles, `src/game/dialogueContent.js`, `docs/NARRATIVE_BIBLE.md`, and content/readiness tests. No reader/UI edits.
2. **Reader/progress owner:** after content IDs freeze, `src/game/DialogueSystem.js`, `src/settings/NarrativeProgressStore.js`, `tests/dialogueSystem.test.js`, and `tests/narrativeProgressStore.test.js`.
3. **Persistence/statistics owner:** new `src/settings/SuspendedRunStore.js`, new `src/game/RunStatsAccumulator.js`, new `src/settings/StatisticsStore.js`, and their focused tests. No Game/UI edits.
4. **Game integration owner:** after combat Game ownership releases, `src/game/Game.js`, `src/main.js`, `tests/narrativeFlow.test.js`, `tests/endingFlow.test.js`, `tests/progression.test.js`, and suspend/statistics integration tests.
5. **Presentation/audio owner:** after reader/Game events freeze, narrative-specific renderer/art-loading files and `src/audio/AudioSystem.js`; this begins only after combat presentation ownership releases shared files.
6. **Sole UI owner:** `src/ui/GameUi.js`, `src/ui/SettingsMenu.js`, and `src/styles.css`. This is the same serialized UI ownership named in the combat design; one owner integrates difficulty, VN, HUD, menu, Records, focus, and touch, or sequential owners explicitly release the files between milestones.
7. **QA owner:** after source release, owns remaining acceptance harnesses, asset-readiness coverage, benchmark evidence, and manual validation records only.

No writer may concurrently edit `Game.js`, `main.js`, `GameUi.js`, `SettingsMenu.js`, `styles.css`, `AudioSystem.js`, shared settings/config, or any assigned test file.

## Migration, rollback, and risk notes

- **Scene migration:** the baseline registry had 48 sequences and 29 inline upgrades. The released registry adds only `opening.domestic`, preserves all prior stable IDs, and presents every sequence as `presentation:"vn"`. Any rollback must restore the former presentation readers and room-reward flow together.
- **Reader events:** UI, audio, and tests consume reader snapshots and dialogue events. Compatibility `view`/`advance` calls use the same authoritative reader state and remain only for existing consumers.
- **Completion intents:** replace closure callbacks only after tests prove identical room, boss, and ending order. Do not persist or stringify functions.
- **Narrative progress v2:** v1 migrates forward without losing glossary access. A source rollback to v1 is unsafe unless its reader is patched to accept v2's `glossaryUnlocked`; document and test that compatibility before deployment rollback.
- **Suspend:** the first schema has no arbitrary-state migration. Unknown/newer versions reject Continue. Tuning/profile/content IDs used by a snapshot must remain resolvable or receive an explicit reviewed migration.
- **Statistics:** aggregate schema migration must preserve primitives and recompute derived views. Never guess unavailable historical fields. A schema rollback keeps the last valid in-session run result and must not overwrite a newer record with an empty older default.
- **One-slot replacement:** New Descent cannot clear a valid suspend until the user confirms replacement. A failed new save leaves the previous valid slot intact.
- **Storage isolation:** no reset or malformed candidate may cascade across keys. Avoid a shared “reset all” helper.
- **Ending risk:** the existing `EndingSequence` is already deep and tested. Extend presentation around its snapshot; do not rewrite its deadline logic during the reader migration.
- **Asset risk:** the released 49-scene conversion depends on the exact 29-state/41-background readiness manifest. Unknown keys and decode failures fail closed instead of silently substituting blocked or legacy art.
- **No dependencies:** browser storage, Gamepad/input, DOM, and the existing Three.js/Vite stack are sufficient. This design introduces no package or external telemetry requirement.

Implementation evidence is recorded in `docs/MANUAL_NARRATIVE_QA.md` and `docs/FINAL_ACCEPTANCE.md`; device and subjective-audio boundaries remain explicit there.
