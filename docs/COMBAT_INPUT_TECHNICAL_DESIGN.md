# Combat and Input Technical Design

Status: implemented and accepted on 2026-07-18. This document records the released system behavior and ownership derived from `DIRECTIONS.md`.

## Purpose and implemented seams

The combat revision adds Reaper's Claim, Harvest, a skill-based charged reap, selective hit-stop, poise, coordinated enemies, controller support, touch aiming, and locked behavioral difficulty without weakening the deterministic combat loop.

The released implementation extends these seams rather than creating a parallel game:

- `src/main.js` owns the animation loop, fixed-step accumulation, pointer-to-world aim conversion, and dispatch to renderer, audio, UI, autoplay, and reporting.
- `src/game/Game.js` owns run phase, player state, room transitions, damage resolution, the event stream, and the integration between combat and encounters.
- `src/game/PlayerCombat.js` owns buffered player actions, combo commitment, dash cancellation, charge state, and attack snapshots.
- `src/game/InputController.js` owns named action state, timestamped press/release edges, canonical keyboard/mouse/gamepad/touch bindings, active-device tracking, automation, movement, and radial-deadzone aim.
- `src/settings/SettingsStore.js` v4 owns versioned settings, per-device binding conflict detection, charge mode, aim assist, touch behavior, and the remembered difficulty value.
- `src/game/EnemyDirector.js` owns enemy/projectile lifecycles, enemy attacks, damage, and the Witch boss.
- `src/rendering/ActorRenderer.js`, `src/rendering/GameRenderer.js`, and `src/rendering/EffectsPool.js` consume gameplay state and events. Effects are already pooled and instanced.
- `src/audio/AudioSystem.js` consumes the same event stream.
- `src/game/gameConfig.js` owns immutable tuning and `PERFORMANCE_BUDGET`.

Existing buffered light attacks, the three-hit combo, dash strike, post-commitment dash cancel, fixed-step simulation, origin metadata, object pools, and physical scythe posing are invariants to preserve.

## Architectural decisions

### Keep authority in fixed-step gameplay modules

**Problem.** Claim movement, perfect timing, Harvest spending, poise, and enemy leases would diverge if renderer or UI time controlled them.

**Constraints.** Mechanics must be independent of frame rate, inputs must remain buffered, and render/audio feedback must describe resolved outcomes rather than create them.

**Chosen approach.** `Game.updateFixed(dt)` remains the only mechanical clock. `PlayerCombat`, `ReapersClaim`, `HarvestState`, and `EnemyDirector` advance from the same fixed `dt`. They return snapshots or emit resolved events. Presentation modules consume those results.

**Real alternatives.** Driving Claim from animation callbacks would visually synchronize one renderer but make headless tests and low-frame-rate behavior unreliable. A general entity-component rewrite would centralize state but is unnecessary for this bounded feature.

**Why and trade-off.** The existing loop is already deterministic and tested. The cost is explicit snapshot/event plumbing, which is preferable to renderer-owned rules.

### Use deep modules for Claim and Harvest

**Problem.** Claim combines spending, projectile-like movement, per-pass hits, pull resistance, catch timing, and follow-up state. Harvest combines gain policy, fixed segments, floor grants, and persistence.

**Constraints.** Callers must not coordinate internal phases or reproduce resource rules.

**Chosen approach.** Add `src/game/ReapersClaim.js` and `src/game/HarvestState.js`. Each exposes a small interface and hides timing, phase transitions, hit tracking, clamping, and rejection rules.

**Real alternatives.** Adding all fields to `PlayerCombat` would avoid files but further mix combo, dash, charge, resource, and detached-weapon responsibilities. A generic ability framework would be broader than the approved scope.

**Why and trade-off.** These are durable gameplay concepts with independent tests and suspend/HUD consumers. Two focused modules improve locality without introducing a speculative framework.

### Preserve the named-action input model

**Problem.** Controller and touch support must not create device-specific combat branches.

**Constraints.** Existing settings store binding strings and conflict checking must migrate safely. Every action must work across supported devices.

**Chosen approach.** Extend `InputController` with gamepad polling, device tracking, and an aim interface while preserving `isDown`, `isPressed`, and `consumePressed`. Use canonical string tokens for buttons so settings v2 bindings can migrate additively. Movement and aim axes are normalized device inputs, not synthetic key presses.

**Real alternatives.** Structured binding objects would describe axes more richly but force a high-risk rewrite of settings, menu, tests, and touch bindings. Separate controller and touch controllers would duplicate buffering and active-device logic.

**Why and trade-off.** Canonical strings preserve existing storage and conflict behavior. Axis remapping is limited to what the current architecture can represent; button actions, including Claim and VN controls, remain remappable.

### Lock difficulty at run start

**Problem.** The baseline `Game.loadRoom()` reread `gameplay.difficulty`, so a mid-run settings change could alter the run.

**Constraints.** A difficulty screen is required before every run, settings remember the last highlight, and difficulty must change behavior as well as scalar values.

**Chosen approach.** `SettingsStore` v4 retains the remembered selection through mirrored `gameplay.lastDifficultyId` and `gameplay.difficulty` values. The difficulty screen validates and writes the selected ID before `startRun`; `Game.initializeRunState` copies it to the run-owned `difficultyId`, and later room/encounter construction uses that locked value.

**Real alternatives.** Reading settings on every room preserves the current code but violates run locking. Storing only an ID and resolving global config repeatedly is workable, but copying the frozen profile makes the snapshot and tests explicit.

**Why and trade-off.** Run behavior becomes reproducible and suspendable. Tuning changes between application versions require suspend-schema validation or migration.

### Centralize enemy attack leases

**Problem.** Independent enemy updates can create unfair overlapping melee, ranged, and area-denial attacks.

**Constraints.** Generation and update order must remain deterministic; difficulty must alter coordination behavior; telegraphs must still communicate committed attacks.

**Chosen approach.** Add a deep `AttackCoordinator` owned by `EnemyDirector`. Enemies request a lease for an attack family; the coordinator grants in stable enemy-ID order under immutable difficulty budgets.

**Real alternatives.** Per-enemy cooldown inflation reduces pressure without coordination. A global AI planner could optimize encounters but is unnecessarily broad.

**Why and trade-off.** One seam owns concurrency rules and is directly testable. Designers must tune a small set of budgets and release conditions.

### Use fixed-point Harvest and snapshot-driven presentation

**Problem.** Fractional resource gains and separately timed weapon/VFX animation can accumulate drift and display a state that mechanics did not resolve.

**Constraints.** Harvest has exactly three readable segments, Claim spending must be atomic, and every action requires synchronized body animation.

**Chosen approach.** Store Harvest as integer units and expose immutable Harvest/Claim snapshots. Renderer, audio, and HUD consume the same resolved action/resource events and never advance gameplay state.

**Real alternatives.** Floating segment fractions are convenient but make boundary and persistence comparisons fragile. Renderer-owned animation callbacks can appear synchronized locally but make headless and low-frame-rate mechanics nondeterministic.

**Why and trade-off.** Integer boundaries and one action timeline make tests and suspension exact. Presentation adapters need explicit interpolation and event plumbing.

## Durable named concepts

This project uses JavaScript rather than a compile-time shared type package. Named JSDoc records are justified only where a shape crosses meaningful module seams or persistence boundaries.

### `CombatHit`

- **Concept:** one resolved attempt to affect an enemy.
- **Fields:** `actionId`, `damage`, `critical`, `direction:{x,z}`, `knockback`, `poiseDamage`, `pullStrength`, `sourcePosition:{x,z}`, `origin`.
- **Location:** documented at the `EnemyDirector.damageEnemy(enemy, hit)` seam in `src/game/EnemyDirector.js`.
- **Export status:** no runtime export; the event payload and method interface are the shared contract.
- **Why named:** Game, enemy resolution, Claim, origin propagation, renderer/audio events, and statistics must not misalign positional arguments.
- **Rejected alternatives:** the existing positional arguments cannot carry Claim/poise/origin safely; a global contract-only file would be a shallow runtime module.

### `HarvestSnapshot`

- **Concept:** the complete externally observable Harvest resource.
- **Fields:** `units`, `maxUnits`, `unitsPerSegment`, `filledSegments`, `segmentProgress`.
- **Location:** `src/game/HarvestState.js`.
- **Export status:** returned by the module interface and included in Game/HUD/suspend snapshots; no mutable object is exported.
- **Why named:** gameplay, HUD, suspend, statistics, and tests consume the same state.
- **Rejected alternatives:** an inline integer hides segment interpretation and invites duplicate clamping.

### `ClaimSnapshot`

- **Concept:** the gameplay-authoritative state needed to animate and inspect a detached scythe action.
- **Fields:** `phase`, `elapsed`, `origin`, `direction`, `scythePosition`, `outboundProgress`, `recallProgress`, `empoweredRemaining`, `armed`.
- **Location:** `src/game/ReapersClaim.js`.
- **Export status:** immutable return from `snapshot()`; consumed by PlayerCombat, Game, renderer, HUD, suspend, and tests.
- **Why named:** mechanics and actor animation must share one action timeline.
- **Rejected alternatives:** renderer interpolation alone cannot determine hits or catch timing; generic attack snapshots do not represent detached ownership and two passes.

### `AimIntent`

- **Concept:** device-independent aim requested for the next simulation step.
- **Fields:** either `{kind:"worldPoint", x, z, device}` or `{kind:"direction", x, y, device}`.
- **Location:** `src/game/InputController.js`.
- **Export status:** returned from `aimIntent()`; consumed by `src/main.js`, which remains the camera/world adapter.
- **Why named:** pointer coordinates and analog directions have different conversion semantics and cross the input/main/Game seam.
- **Rejected alternatives:** a single anonymous `{x,y}` is ambiguous; forcing world coordinates into InputController would couple it to camera/rendering.

### `DifficultyProfile`

- **Concept:** immutable scalar and behavioral rules locked to a run.
- **Fields:** identity, enemy health/damage/speed, windup and cooldown factors, melee/ranged/area lease budgets, composition pressure, poise pressure, boss cadence, and accessibility-neutral rules.
- **Location:** JSDoc beside `DIFFICULTY` in `src/game/gameConfig.js`.
- **Export status:** profile values remain the existing exported frozen data; no separate runtime type export.
- **Why named:** Game, EnemyDirector, boss logic, suspend, events, and statistics require the same run-locked concept.
- **Rejected alternatives:** three unrelated multiplier bags cannot express behavioral difficulty; an inline Game shape would obscure the contract.

Simple event details, normalized vectors, and individual config scalars remain inline because they are obvious one-use structures.

## Harvest module interface

`HarvestState` exposes only:

```text
resetRun() -> HarvestSnapshot
gain(source, amount) -> { accepted, delta, snapshot }
trySpend(segments, reason) -> { accepted, delta, snapshot }
ensureFloorMinimum() -> { granted, delta, snapshot }
snapshot() -> HarvestSnapshot
```

Invariants:

- Use fixed-point integer units: `0..300`, with `100` units per segment. Float animation progress is derived.
- Claim costs exactly one filled segment and spends before its startup state.
- No cooldown exists in Harvest or Claim.
- Unspent units persist across rooms and floors.
- On entering a new floor, `ensureFloorMinimum()` grants exactly one segment only when units equal zero. It runs once per floor transition.
- Gain sources are explicit: `closeHit`, `critical`, `kill`, `perfectDash`, and approved upgrade modifiers. A resolved hit can apply each source bonus at most once.
- Gain values live in immutable `HARVEST_CONFIG`; callers provide the source, not arbitrary UI-derived values.
- Balance validation must yield approximately two to four Claim uses per typical chamber without farming inactive, dismissed, or already-defeated actors.
- HUD exposes all three segment boundaries, numeric/shape state, spend flash, and gain direction without relying on color.

Failures are ordinary results, not exceptions: invalid/non-positive gain, cap overflow, insufficient segments, duplicate event IDs, or an illegal phase return `accepted:false` and do not mutate state.

## Reaper's Claim state machine

```text
idle
  -- start accepted and one Harvest segment spent --> outbound
outbound
  -- authored outbound duration/distance reached --> recalling
recalling
  -- scythe reaches actor catch point --> empoweredWindow
empoweredWindow
  -- buffered follow-up accepted --> empoweredCleave
  -- window expires --> recovery
empoweredCleave
  -- attack commitment completes --> recovery
recovery
  -- recovery completes --> idle
```

Interface:

```text
requestStart({ origin, direction, inputTime }) -> { accepted, reason?, snapshot }
bufferFollowup(inputTime) -> { accepted, reason?, snapshot }
update(dt, collisionAdapter) -> readonly resolvedEvents[]
cancel(reason) -> ClaimSnapshot
snapshot() -> ClaimSnapshot
```

The collision adapter is an internal seam supplied by Game/EnemyDirector because tests and gameplay are two real adapters. It queries candidates and resolves a `CombatHit`; it never controls Claim phase.

Deterministic invariants:

- Origin and normalized aim direction freeze on accepted startup.
- The physical scythe leaves Zephyr's hands, follows the authoritative path, and is unavailable to light/charged attacks until caught.
- Outbound and recall each own a bounded target-ID set. A target is hit at most once per pass and may therefore be hit twice total.
- Recall damages before pull resolution. Light targets may be pulled. Heavy and boss targets reduce displacement by resistance class/current poise while still taking poise damage and showing impact response.
- The catch creates one bounded empowered-follow-up window. The press may be buffered, is consumed at most once, and starts a wide cleave with its own commitment.
- Dash cancellation follows the same authored commitment rule as existing attacks; it cannot create unlimited cancel safety or duplicate the weapon.
- Player death, room replacement, terminal ending, and explicit run reset cancel Claim, clear hit sets, and restore scythe ownership exactly once.
- Suspend is never captured during active Claim because suspension is limited to room boundaries.

Claim timing, distance, widths, damage, pull, poise damage, and window bounds live in immutable `CLAIM_CONFIG`. Tests assert configured boundaries, while playtests tune the values.

## Charged reap state machine

```text
idle -> charging -> releaseQueued -> partial | full | perfect -> committed -> recovery -> idle
```

- Hold mode begins on press and queues release on the release edge.
- Toggle mode begins on the first press and queues release on the second press.
- `minimumRelease`, `fullThreshold`, `perfectOpen`, `perfectClose`, and `forcedRelease` are immutable and ordered:
  `0 < minimumRelease < fullThreshold <= perfectOpen < perfectClose < forcedRelease`.
- Perfect is true only when the captured release timestamp falls in `[perfectOpen, perfectClose)` relative to charge start.
- A forced release after the perfect window is full, not perfect.
- Partial, full, and perfect attacks each have useful configured damage/range; perfect adds its approved reward and feedback rather than making all other releases failures.
- Pause freezes elapsed charge time. Backgrounding flushes stale edges and pauses the clock. Low-frame-rate evaluation uses captured timestamps plus fixed-step clamping.
- Charge quality is resolved once and emitted as `chargeReleased`; renderer/audio/HUD may not recalculate it.

## Selective hit-stop

`Game` owns a small fixed-step impact clock with `request(duration, tier)`, `update(dt)`, and `remaining()`.

- Only finisher, critical, charged, and Claim impact policies can request hit-stop.
- Ordinary crowd hits never request it.
- Concurrent requests select the strongest/longest remaining request; durations never sum.
- A global immutable cap prevents chaining into an unresponsive game.
- Mechanical movement, enemies, projectiles, and attack clocks freeze. Input edges continue to be captured and buffered; they are applied after the freeze.
- Pause freezes the hit-stop clock. Background frames do not consume it.
- Reduced-motion/flash/effects settings scale presentation layers. They do not silently change damage, invulnerability, poise, or hit windows. Any impact-pause accessibility control must be explicit rather than inferred from color/effects settings.

Failure mode: a hit-stop request with a non-qualifying tier, invalid duration, or during terminal state is ignored and reported only to diagnostics.

## Poise and stagger

Each active enemy owns `poise`, `maxPoise`, `poiseRecoveryDelay`, and `resistanceClass` as part of its existing runtime actor record; no separate public type is warranted.

```text
stable --poise damage--> pressured --poise <= 0--> staggered
staggered --duration--> recovering --delay/regen--> stable
```

- One `CombatHit` reduces health and poise once.
- Crossing zero emits one stagger, interrupts interruptible attacks, and releases any coordination lease.
- Recovery is fixed-step and cannot exceed `maxPoise`.
- Bosses and heavy enemies resist displacement but visibly acknowledge qualifying impact and poise pressure.
- Uninterruptible boss commitments must be explicit in boss pattern data; immunity is never inferred from animation alone.
- Death/dismissal clears leases and pending stagger without emitting duplicate defeats.

## Enemy coordination

`AttackCoordinator` exposes:

```text
beginStep(activeEnemyIds, difficultyProfile)
request({ enemyId, family, priority, telegraphDuration }) -> lease | null
release(leaseId, reason)
snapshot() -> readonly lease summaries
```

- Attack families are `melee`, `ranged`, and `area`.
- Requests are evaluated in stable enemy-ID order with a deterministic tie-breaker; wall-clock order and renderer distance do not decide grants.
- The locked difficulty profile controls family budgets, cadence pressure, and composition pressure. Relaxed leaves more recovery and fewer overlapping denial zones; Ruthless coordinates more aggressively through behavior rather than mainly health inflation.
- A granted lease becomes a visible telegraph commitment. Completion, interruption, death, dismissal, or actor recycling releases it exactly once.
- A denied enemy repositions or waits through its existing behavior; it does not start a hidden attack.
- Witch/Elowen origin remains attached through enemies, projectiles, hazards, resolved hits, dismissal, and statistics. Coordination cannot permit unrestricted friendly fire to decide a room.

## Input, controller, aim, and touch

### Device adapters

Keyboard/mouse, Gamepad API, touch, and automation are concrete adapters behind the existing named-action interface. Gamepad polling occurs once at the start of each animation frame; press edges persist until fixed-step consumption.

Active-device rules:

- Keyboard key, mouse button/movement, touch pointer, or gamepad button changes device immediately.
- Analog input changes device only after crossing the configured radial deadzone plus hysteresis.
- Disconnecting the active gamepad clears its held state, preserves keyboard/touch, and selects the next device only after meaningful input.
- Prompt changes emit `activeDeviceChanged` and never alter gameplay state.

Aim rules:

- Pointer adapter returns a world-point intent after `main.js` applies the current camera conversion.
- Gamepad and touch adapters return normalized screen-space directions; `main.js` converts camera-relative direction to the ground plane.
- Zero analog aim preserves the last non-zero aim. Aim assist remains a configured selection influence, not automatic action execution.
- Radial deadzone and response curve are applied once inside InputController.

Binding rules:

- Add named `claim` plus the VN bookend and menu actions required by the product design.
- Canonical gamepad button strings participate in existing conflict detection.
- Settings migration preserves existing v2 arrays and supplies defaults only for missing new actions.
- Runtime touch actions no longer mutate persisted binding arrays. Touch uses its own adapter state.
- Focused menus suppress gameplay actions; closing a modal flushes the actions used to close it to prevent bleed-through.

Touch layout must provide movement, aim, light, charged reap, dash, Claim, interact/advance, pause, and accessible menu navigation. Claim is a dedicated control. Coarse-pointer and minimum-viewport validation must prove that aim and action controls do not overlap critical HUD or VN text.

## Difficulty selection and run lock

```text
title/death/endingComplete -- new run or retry --> difficultySelect
difficultySelect -- confirm valid ID --> runStarting --> run
difficultySelect -- cancel --> previous menu
```

- The screen appears before every new run, including retry.
- Highlight changes stay local to the difficulty screen; confirmation writes the validated remembered selection and starts a run whose `game.difficultyId` remains fixed.
- `Game.loadRoom()` uses the run-owned difficulty ID and does not reread settings.
- `runStarted`, suspend snapshots, end-of-run statistics, Records, benchmark diagnostics, and all enemy/boss construction use the locked value.
- Difficulty changes enemy decisions, windups/cadence, attack leases, compositions, poise pressure, and boss escalation. Scalar health/damage/speed remain supporting parameters.
- Opening/ending bookends, rooms, endings, and upgrades are not removed on harder modes.

Invalid IDs fall back only before confirmation to the documented Standard profile and surface a recoverable UI error. A confirmed active run never changes silently.

## Animation, VFX, audio, and accessibility synchronization

Every action has one gameplay timeline and a natural actor response:

- `ClaimSnapshot` drives Zephyr throw, release, empty-hand recovery, recall tracking, catch, and empowered cleave body animation. A detached VFX arc cannot substitute for any pose.
- Enemy pull/stagger changes root motion and hit animation on the affected actor. Boss resistance still produces a synchronized readable body response.
- Attack hit windows, scythe transform, VFX origin, audio transient, camera trauma, hit-stop, and damage number all consume the same action/hit identifiers.
- The renderer may interpolate between fixed snapshots but cannot advance phases or resolve hits.
- Pool exhaustion drops least-important presentation only; it never drops damage, poise, input, or action completion.
- Harvest uses three segmented shapes plus text/marks, not color alone. Perfect charge uses shape/timing/audio layers and remains legible with particles reduced.
- Reduced motion scales camera trauma, trails, and screen movement. Flash reduction suppresses abrupt luminance. Neither setting removes mechanical feedback or actor animation.
- Damage numbers are pooled, spatial, capped, and prioritized; the old message-log damage readout is removed when the pool is integrated.

## Event contract

All events are immutable plain details emitted once from the authoritative module:

| Event | Required payload |
| --- | --- |
| `harvestChanged` | `{ previousUnits, units, delta, reason, floor, room }` |
| `harvestGainRejected` | `{ reason, sourceEventId }` |
| `claimRejected` | `{ reason, inputTime }` |
| `claimStarted` | `{ actionId, inputTime, origin, direction, harvestUnits }` |
| `claimHit` | `{ actionId, pass:"outbound"|"recall", targetId, hit:CombatHit }` |
| `claimRecallStarted` | `{ actionId, position }` |
| `claimPulled` | `{ actionId, targetId, requested, applied, resistanceClass }` |
| `claimCaught` | `{ actionId, position, empoweredWindow }` |
| `claimFollowupReady` | `{ actionId, remaining }` |
| `claimFollowupConsumed` | `{ actionId, inputTime }` |
| `claimCompleted` | `{ actionId, result:"cleave"|"expired"|"cancelled" }` |
| `chargeReleased` | `{ actionId, inputTime, elapsed, ratio, quality:"partial"|"full"|"perfect" }` |
| `hitStopRequested` | `{ sourceActionId, tier, requested, applied }` |
| `enemyPoiseChanged` | `{ enemyId, previous, current, max, sourceActionId }` |
| `enemyStaggered` | `{ enemyId, sourceActionId, duration, resistanceClass }` |
| `attackLeaseGranted` | `{ leaseId, enemyId, family, difficultyId }` |
| `attackLeaseReleased` | `{ leaseId, enemyId, reason }` |
| `activeDeviceChanged` | `{ previous, current }` |
| `difficultySelectionRequested` | `{ previousScreen, highlightedId }` |
| `runDifficultyLocked` | `{ difficultyId }` |

Events carry IDs and resolved values so UI, audio, renderer, product statistics, and `PlaytestReporter` can observe the same truth without sharing mutable objects.

## Performance contract

The existing documented budget is authoritative and cannot be relaxed without a reviewed measurement:

```text
cpuP95Ms       <= 6
gpuP95Ms       <= 8 when the GPU timer is reliable
drawCalls      <= 100
triangles      <= 200,000
stressEnemies  = 35
stressParticles = 200
longTasks      = 0
```

The harness must continue to report frame p95 and whether the display is refresh-capped. Frame p95 is a diagnostic alongside the authoritative pass/fail fields above; changing the benchmark's acceptance criteria requires a reviewed measurement.

Additional invariants:

- Preserve `RUN_CONFIG.fixedStep = 1/60` and `maxFixedSteps = 5`.
- Preserve current pools/instancing, including 320 particle slots, 40 telegraph slots, and 14 dash streak slots. `stressParticles=200` remains the benchmark load; capacity is not a relaxed budget.
- Add fixed caps in `gameConfig.js` for simultaneous damage numbers, Claim presentation sprites, hazards, and animated VN scene layers. Initial subsystem caps require stress measurement and must fit the global budget.
- Claim per-pass tracking is bounded by active enemies and reuses storage after warm-up.
- Coordinator work is deterministic and at most linear in active enemies per step after stable ordering.
- Gamepad polling occurs once per animation frame, never once per action.
- No new object is allocated per fixed step for Claim path samples, coordinator leases, damage numbers, poise, or aim state after pools warm.
- Re-run `src/benchmark/benchmarkHarness.js` after combat rendering, character animation, and audio integration.

## Deterministic verification matrix

| Area | Automated acceptance |
| --- | --- |
| Harvest | All gain sources, duplicate suppression, fixed cap, failed spend, exact one-segment Claim cost, chamber/floor persistence, one-time empty-floor grant, snapshot round-trip |
| Claim | Insufficient-resource rejection; immediate reuse after recovery; frozen path; outward/recall hit once each; light pull; heavy/boss resistance plus poise; buffered catch; expired window; cancellation restores scythe exactly once |
| Charge | Before/at/after both perfect boundaries; forced release; partial/full value; hold/toggle parity; pause, background, and low-frame timestamp behavior |
| Hit-stop | Qualifying-hit filter; max-not-sum; global cap; fixed-step pause; buffered input retained; ordinary crowd hit excluded |
| Poise | Single threshold stagger; attack interruption and lease release; recovery cap; uninterruptible authored boss action; death/dismissal idempotence |
| Coordination | Stable grants under reordered iteration; each family budget; Relaxed/Standard/Ruthless behavior; release on every terminal path; denied actor never attacks |
| Input | Keyboard/mouse, gamepad, touch, automation; pressed versus held; deadzone/hysteresis; device switches; disconnect; remap conflict; modal flush; vector/world aim equivalence |
| Difficulty | Selection before new/retry; last highlight persistence; invalid selection; run lock across rooms/settings changes/suspend; behavioral profile fields used |
| Origin | Enemy/projectile/hazard/hit/kill/stat origin propagation; Witch-only dismissal preserves Elowen-origin state |
| Presentation | One action ID links body animation, physical weapon, hit window, VFX, audio, hit-stop, and number; pool exhaustion preserves mechanics |
| Accessibility | Non-color Harvest/perfect cues; focus-visible device prompts; reduced motion/flash/particles without mechanical changes; coarse pointer/minimum viewport |
| Performance | Exact benchmark budget above at 35 enemies/200 particles; no long task; pool counters stay bounded |

Focused files include existing `tests/playerCombat.test.js`, `tests/combatRules.test.js`, `tests/inputController.test.js`, `tests/settingsStore.test.js`, `tests/encounterPatterns.test.js`, `tests/enemyOrigins.test.js`, `tests/playerScytheAnimation.test.js`, `tests/audioSystem.test.js`, and `tests/telegraphBatching.test.js`, plus narrowly named new module tests. Compilation alone is not gameplay, animation, visual, audio, or accessibility validation.

Manual validation must cover all devices, all difficulties, different five-Oath mixes and Rank-I/Rank-II loadouts, two-to-four Claim uses in a typical chamber, every affected enemy/boss response, high UI scale, high contrast, reduced motion, flash reduction, minimum viewport, and stress behavior.

## Non-overlapping implementation ownership

Only one writer owns each path at a time. A later owner starts after the prior owner releases its files and the integration owner accepts the interface.

1. **Input/settings owner:** `src/settings/SettingsStore.js`, `src/game/InputController.js`, `src/ui/SettingsMenu.js`, `tests/inputController.test.js`, `tests/settingsStore.test.js`.
2. **Combat-core owner:** `src/game/gameConfig.js`, `src/game/PlayerCombat.js`, new `src/game/HarvestState.js`, new `src/game/ReapersClaim.js`, and their focused tests.
3. **Enemy-system owner:** after combat records freeze, `src/game/EnemyDirector.js`, encounter/boss pattern files, and enemy/encounter tests.
4. **Game integration owner:** after owners 1–3 release, `src/game/Game.js`, `src/main.js`, and combat integration tests.
5. **Presentation owner:** after Game events freeze, `src/rendering/ActorRenderer.js`, `src/rendering/GameRenderer.js`, `src/rendering/EffectsPool.js`, `src/audio/AudioSystem.js`, and presentation/audio tests.
6. **Sole UI owner:** after input and event interfaces freeze, `src/ui/GameUi.js` and `src/styles.css`. Bookend UI work uses this same owner or begins only after release.
7. **QA/benchmark owner:** receives released source and owns only remaining acceptance harnesses and benchmark evidence.

No parallel owner may edit `Game.js`, `GameUi.js`, settings, shared config, render/audio files, or a test file already assigned above.

## Migration, failure containment, and rollback

- Settings v4 migrates earlier schemas additively: it preserves valid values/bindings, mirrors the remembered difficulty fields, retires the obsolete subtitles value, and adds missing actions/default controller bindings. Invalid fields use documented defaults; runtime touch state does not mutate bindings.
- `EnemyDirector.damageEnemy` migration from positional arguments to `CombatHit` must be one integration change across Game, Claim, boss logic, origin tests, audio/render events, playtest reporting, and product statistics. Do not support two long-lived damage paths.
- Existing event names may be observed by tests and presentation. Add new resolved events first; replace obsolete damage-message consumption only after all consumers move.
- Claim cancellation is the recovery path for run reset, actor death, room replacement, and terminal outcomes. It must be idempotent.
- If controller polling fails or no gamepad exists, keyboard/mouse/touch continue normally. Gamepad access is capability-detected; no dependency is required.
- If a presentation pool is exhausted, drop low-priority visuals and retain mechanics. Record exhaustion in diagnostics for tuning.
- A milestone rollback must restore source files and compatible settings behavior together. Rolling back to an older strict loader requires a non-destructive compatibility reader for newer records; no destructive storage migration is allowed.
- Suspended-run difficulty data is versioned and validated. Unknown profile IDs reject Continue rather than silently changing a run.

Implementation followed the ownership order above. Focused, full-suite, running-game, performance, and documented device/audio-boundary evidence is recorded in `docs/FINAL_ACCEPTANCE.md`.
