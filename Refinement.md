# Gameplay Density and Dungeon Shape Refinement

Status: approved product specification for the next implementation goal<br>
Date: 2026-07-20

## 1. Objective

Make every descent substantially busier, harder, more varied, and more
movement-driven without sacrificing deterministic generation, readable combat,
touch support, or the retained opening and endings.

The finished game should combine controlled horde combat with tactical pressure:
Zephyr cuts through larger groups while tanks, ranged specialists, mobile enemies,
and area-denial enemies force movement and target prioritization. Chambers should
use genuinely different, larger, non-rectangular walkable silhouettes instead of
rectangles whose only variation is obstacle placement.

This document is the authoritative specification for that refinement. Where an
exact scalar is not fixed, use the stated starting target, measure it through the
gameplay harness, and tune toward the acceptance criteria rather than treating
the first number as permanent.

## 2. Current baseline

- A run has ten floors and three generated combat chambers per floor.
- Non-boss encounter plans currently contain 3-12 enemies in 1-3 strictly
  sequential waves. A new wave starts only when every active enemy is dead.
- The five normal layout families and the boss court all use rectangular outer
  collision, floors, walls, navigation bounds, and camera bounds. Their current
  family names describe obstacle arrangements, not true room silhouettes.
- Normal arena bounds are approximately 34-42 units wide and 24-34 units deep.
- Attack coordination currently permits 3 simultaneous committed attacks on
  Relaxed, 5 on Standard, and 6 on Ruthless.
- The existing browser benchmark stress-spawns 35 enemies. This is a performance
  stress case, not a target normal encounter population.
- Harvest gains 34 units per kill, and health-on-kill builds also benefit from
  additional bodies.
- The Witch can currently sustain up to five summoned guards.

## 3. Product decisions

### 3.1 Combat identity

- Use controlled horde combat, not only small tactical squads.
- Increase difficulty through population, overlapping reinforcement thresholds,
  stronger compositions, more simultaneous attack pressure, larger and more
  demanding geometry, and stronger enemy statistics.
- Do not make every chamber use the same wave behavior. Deterministically select
  an encounter recipe for each chamber from several recipe families.
- Early chambers remain the shortest and most forgiving. Reinforcement thresholds, total
  population, specialist pressure, and chamber duration rise through the run.
- Mid-game encounters require fewer kills between reinforcements and last longer than early encounters.
- Late encounters use the most aggressive reinforcement overlap, the largest populations, and
  intentionally longer fights with some prolonged cleanup.

### 3.2 Starting population targets

Use these as initial tuning bands for Standard difficulty:

| Run band | Floors | Total enemies per non-boss chamber | Typical active population |
| --- | --- | ---: | ---: |
| Early | 1-3 | 5-9 | 5-6 |
| Middle | 4-6 | 8-13 | 7-9 |
| Late | 7-10 | 12-18 | 10-12 |

- Room number must still matter: room one introduces the floor's pressure, room
  two mixes it, and room three is the non-boss peak.
- Twelve living enemies is the initial normal gameplay ceiling. A horde recipe
  may place its entire roster at once only when its roster respects that ceiling.
- Reinforcement recipes may contain up to 18 total late-game enemies while
  limiting the active population.
- The 35-enemy benchmark remains a stress test.
- Difficulty population starts at approximately 80% of the Standard roster on
  Relaxed, 100% on Standard, and 115% on Ruthless. Apply deterministic rounding
  and preserve required encounter roles.

### 3.3 Encounter recipe families

Every recipe must be deterministic for the run seed, floor, and room. Horde is
a minority random outcome, not the default encounter. Start with an approximate
12% horde chance in early chambers, 18% in middle chambers, and 24% in late
chambers. Resolve that seeded chance first; when it does not trigger, select from
the death-triggered, population-pressure, and hybrid recipes. Do not allow horde
recipes in back-to-back chambers. Tune these weights from run-level occurrence
reports, but
keep horde below a 25% per-chamber chance so it remains an event.

1. **Horde:** On the minority seeded chance described above, spawn a large,
   mostly lower-threat roster together. Use fewer specialists than other recipes
   so the simultaneous crowd remains playable.
2. **Death-triggered reinforcements:** Begin with a squad, then spawn new batches
   when a configured number or percentage of allies has died. The initial target
   is to trigger at roughly 25-35% of the current batch remaining.
3. **Population pressure:** Spawn each new batch when the preceding batch falls
   to a configured remaining-enemy threshold. Use a higher threshold than the
   death-triggered recipe so batches overlap while still accelerating immediately
   when the player clears enemies quickly.
4. **Hybrid escalation:** Begin with a normal squad, introduce an earlier
   population-pressure surge, and reserve a final lower-threshold batch.

Recipes may spawn a complete batch or stream members one by one. Floor band,
room number, difficulty, roster threat, and the chosen layout must inform batch
size and cadence.

### 3.4 Spawn presentation and rules

- Every reinforcement uses a clear diegetic animation in which the enemy rises
  from the dead or otherwise materializes from the floor.
- Reuse or extend the existing approximately 0.56-second renderer rise animation.
  Simulation and presentation must read the emergence duration from one shared
  contract so the visible animation and gameplay lock cannot drift apart.
- The animation itself is the warning. Do not add explanatory text, banners,
  countdown labels, or other mid-run narrative/UI announcements.
- A positional sound may reinforce the animation if it remains diegetic and
  does not replace the visual tell.
- Reinforcement triggers must not depend on Zephyr entering a combat zone or
  reaching any other location. Use only remaining-enemy counts or ratios.
- An enemy in the spawning state cannot move, attack, obtain an attack lease,
  deal contact damage, block movement, or be damaged. It becomes interactive
  only when the animation completes.
- Spawns may appear directly beside the player. Do not enforce the existing
  seven-unit player-clearance rule for reinforcement points. Never place an
  enemy directly overlapping the player's collision circle or outside the
  walkable shape.
- Nearby and surrounding spawns are acceptable sources of stress because the
  non-interactive spawning animation provides the response window.
- Horde members may rise together; streamed recipes may stagger their animation
  starts.

### 3.5 Enemy composition

- Most added population should come from lower-threat frontline and mobile
  enemies so Zephyr has groups to reap through.
- Also increase the absolute number of boneguards, ranged specialists, and
  area-denial enemies. The current game has too few of them, including on
  Ruthless.
- Use threat budgets and role quotas rather than independently rolling every
  slot. Higher floors and later rooms receive larger specialist allowances.
- Cap any one specialist family per active batch to prevent degenerate rosters,
  but do not keep the existing low absolute specialist counts.
- Late encounter recipes should normally contain frontline, mobile, ranged, and
  area-denial pressure when those roles are eligible.
- Keep all six existing non-boss enemy families. Adding a seventh family is not
  part of this refinement.

### 3.6 Simultaneous attack budgets

Use these initial total committed-attack budgets:

| Difficulty | Total | Melee starting target | Ranged starting target | Area starting target |
| --- | ---: | ---: | ---: | ---: |
| Relaxed | 3 | 2 | 1 | 1 |
| Standard | 7 | 4 | 3 | 2 |
| Ruthless | 10 | 5 | 4 | 3 |

- Relaxed's current total cap remains unchanged.
- Standard must rise from 5 to 7.
- Ruthless should begin at 10, the upper end of the requested 9-10 range.
- Family budgets are ceilings within the total budget, not additive promises.
- Telegraphs, cooldowns, and attack leases must still prevent unavoidable damage.
  Higher stress is intended; invisible or mechanically impossible overlaps are
  not.

### 3.7 Enemy health, damage, speed, and tracking

- Increase enemy durability and combat statistics. The current enemies die too
  easily, and stronger opposition is needed for damage, survival, and hybrid
  builds to feel meaningfully different.
- Do not apply one unexamined global multiplier to every family. Start with
  explicit difficulty and floor-band scalars, then tune family outliers through
  deterministic combat scenarios.
- As a first tuning pass, raise Standard non-boss health by approximately
  15-25%, damage by 5-10%, and speed by 5-8% over the current Standard profile.
- Ruthless should remain a material step above the new Standard profile. Begin
  near 35-45% health, 20-25% damage, and 12-16% speed above the old Standard
  baseline, then validate rather than blindly stacking the old Ruthless values.
- Preserve Relaxed's attack cap and forgiving identity. It may use the richer
  roster at reduced population and its current slower, lower-damage behavior.
- Larger maps require more than raw speed. Improve shape-aware pursuit,
  navigation refresh, target tracking, and spawn distribution so enemies do not
  waste time crossing empty space or get trapped in another lobe.
- Do not use hidden rubber-banding or teleport ordinary active enemies to the
  player.

### 3.8 Build and resource consequences

- Keep the additional Harvest generated by extra kills. Frequent access to
  Zephyr's crowd-clearing tools supports the intended horde rhythm.
- Preserve health-on-kill initially. Reduce or threat-weight it only if measured
  runs show that it removes attrition from late chambers.
- Add deterministic comparison scenarios for an unupgraded baseline, a
  damage-focused build, and a survival-focused build. Damage investment must
  measurably reduce time-to-kill, while survival investment must measurably
  improve damage tolerance or recovery.
- Avoid balancing solely around a fully upgraded damage build. Early and
  low-synergy runs must remain capable of clearing encounters through good play.

## 4. Dungeon generation decisions

### 4.1 True walkable shapes

- Replace rectangle-only arena collision with an authoritative representation
  of the actual walkable silhouette. A cell mask, union of authored regions, or
  equivalent boundary representation is acceptable.
- The same shape data must drive floor tiles, exterior wall segments, collision,
  reachability validation, enemy navigation, line-of-sight queries, spawn
  placement, projectile containment/despawn, props, objectives, camera clamping,
  and autoplay navigation.
- `width` and `depth` may remain as the outer bounding box for rendering and
  broad-phase work, but they must no longer define walkability by themselves.
- Do not fake shapes using invisible walls or decorative blockers inside an
  otherwise valid rectangle.
- Movement, dash, knockback, Claim pull, boss relocation, summons, and actor
  separation must all revalidate containment. Resolving actor-to-actor overlap
  must not push an actor into an exterior void at a concave corner.

### 4.2 Layout families

Create authored procedural families with seeded dimension, connector, obstacle,
objective, and spawn variations. The initial global family pool is:

- open courtyard;
- long hall;
- L-shape;
- T-shape;
- cruciform;
- hourglass;
- offset twin chambers connected by a broad passage;
- broken-ring court with at least one broad opening or bridge.

No family is the default or standard room. Courtyard is one equal option among
many. Generation should feel like selecting among substantially different
architectures, not attaching small appendages to a recurring courtyard.

Avoid mazes. A player should understand the usable space while fighting without
needing a minimap.

### 4.3 Remove biome-driven generation

- Remove biomes as a gameplay and progression concept.
- Layout-family selection must use one global deterministic pool rather than
  biome layout weights or floor-gated biome identities.
- Encounter composition must not use biome encounter biases.
- Existing environment model, palette, and prop bundles may be retained only as
  independently selected cosmetic environment themes if that preserves useful
  asset variety. They must not control mechanics or imply a progression system.
- If retained as cosmetic themes, rename/refactor the contract so gameplay code
  does not depend on a `biome` identity. The visual selection must be apparent
  enough to add variety but requires no dialogue or text announcement.

### 4.4 Size, movement, and progression

Shaped arenas should be physically larger so Zephyr's movement and dash kit have
room to matter. Start with these outer-bound ranges and tune from traversal data:

| Run band | Suggested outer width | Suggested outer depth |
| --- | ---: | ---: |
| Early | 40-48 | 30-38 |
| Middle | 46-56 | 34-44 |
| Late | 54-66 | 40-50 |

- The non-rectangular walkable area may use only part of the outer bounds, but
  every family must still feel larger and more traversable than the current
  rectangle-only arenas.
- All layout families may appear throughout the run. Increase complexity through
  larger variants, additional connected lobes, cover, crossfire potential, and
  encounter recipes rather than treating one family as the late-game shape.
- Room one is comparatively open, room two adds mixed routing, and room three
  uses the floor's most demanding shape variant.
- Keep the fixed three-quarter camera identity. Make camera clamping shape-aware
  and adjust follow/zoom only where needed to prevent invalid or unreadable views.

### 4.5 Traversal and fairness constraints

- Major passages should be approximately 8 world units wide or wider.
- Primary combat lobes should be at least 12 world units across.
- Major combat regions need at least two traversal routes. Shallow tactical
  alcoves are allowed; deep body-blocking dead ends are not.
- Use approximately 2-5 meaningful collision blockers per combat region, scaled
  to room size. Each blocker should create cover, sightline, or routing decisions
  while leaving multiple paths around it.
- Keep the entire chamber as one continuous encounter. Connected lobes do not
  introduce doors, loading transitions, or separate mini-room completion gates.
- Spawn points, combat zones, player entry, reward position, and portal must all
  be reachable for the actual actor clearance they require.
- The portal should be central to the main usable region, but it does not need to
  remain at world coordinate `(0, 0)`. Place entry and reward positions on a
  readable route through the shaped arena.

### 4.6 Flat-world scope

- Keep all playable geometry flat.
- Do not add ramps, upper levels, platforming, or playable elevation.
- Do not add damaging environmental hazards, traps, lava, or spikes in this pass.
- Do not add destructible walls, breakable cover, or exploding props in this pass.
- Decorative height and non-blocking presentation remain allowed.

### 4.7 Witch arena

- Preserve a large, open central Witch fighting space. Her teleports, volleys,
  slams, persistent hazards, and up to five summoned guards require readable
  central room.
- The boss court may receive a larger footprint and shaped perimeter or safe
  alcoves only if every Witch pattern and phase remains valid.
- Do not force the boss arena to use the full irregular-layout pool.
- Preserve the phase-three summon dismissal and summon prohibition.

## 5. Pacing targets

Capture current fixed-seed clear-time baselines before tuning. Then target:

- Early floors: similar to current median clear time or no more than roughly 10%
  longer despite the richer population.
- Middle floors: approximately 15-30% longer, with faster reinforcement cadence.
- Late floors: approximately 30-50% longer, with the fastest cadence, the largest
  rosters, and deliberate cleanup pressure.
- Keep individual rooms within a practical upper bound. Update the playtest
  reporter's single 8-55 second assumption to floor-band targets so it can detect
  both trivial rooms and accidental multi-minute grinds.
- Speedrun remains fixed to Ruthless. Re-baseline records and automated completion
  expectations, but do not change the rule that its competitive clock stops when
  the Witch dies.

These are initial empirical targets, not permission to manipulate reports. If
the combat feels unreadable or a low-synergy build cannot finish, fix the design
and retest.

## 6. Architecture and compatibility requirements

- Preserve deterministic generation from the displayed seed.
- Preserve the ten-floor, three-chamber route.
- Preserve the standard opening, Witch plea, five-second action window, kill
  ending, timeout ending, and Speedrun bookend behavior exactly.
- Do not add mid-run text scenes, encounter announcements, or lore UI.
- Preserve stable and volatile enemy variants as mechanical profiles.
- Preserve settings, rebinding, pause behavior, accessibility, touch controls,
  statistics, speed records, and suspended-run validation.
- If arena or pending-wave data becomes persistent, version and validate the
  suspended-run schema. Prefer regenerating deterministic arena/encounter state
  from seed and location over storing redundant geometry.
- Do not add dependencies, change infrastructure, or alter deployment as part of
  this refinement unless separately approved.

## 7. Implementation milestones and fast feedback loops

### Milestone 0: Baseline evidence

Before behavior changes, capture:

- targeted existing arena, encounter, difficulty, director, navigation, autoplay,
  and benchmark test results;
- fixed-seed encounter rosters and clear-time reports for early, middle, and late
  Standard/Ruthless rooms;
- the current optimized-preview 35-enemy benchmark;
- at least one current autoplay completion for each ending.

Store concise machine-readable fixtures or reports where they will support
before/after comparisons. Do not spend hours recording subjective footage before
the implementation has a runnable vertical slice.

### Milestone 1: Shape contract and one vertical slice

- Define the authoritative walkable-shape contract.
- Implement one non-rectangular family end to end through generation, collision,
  reachability, navigation, rendering, camera, spawning, objectives, and autoplay.
- Add focused deterministic tests and a seed sweep before implementing every
  family.
- Run the vertical slice in the browser. Compilation alone is not validation.

This milestone prevents all layout families from being built on an unsuitable
geometry contract.

The contract should expose shared queries rather than duplicate boundary math in
consumers: point/circle membership, boundary clearance, nearest valid point,
line containment or sight obstruction, deterministic navigation cells, floor
regions, and perimeter wall segments.

### Milestone 2: Encounter recipes and spawning state

- Introduce deterministic encounter recipe data and lifecycle state.
- Implement horde, death-triggered, population-pressure, and hybrid recipes.
- Implement the non-interactive rising spawn state and its presentation contract.
- Apply active-population and attack-family budgets.
- Verify no room can clear while pending or spawning enemies remain.

### Milestone 3: Full layout pool and global themes

- Add the remaining authored shape families on the proven contract.
- Remove biome-dependent layout and encounter selection.
- Retain visual environment bundles only as independent cosmetic themes if used.
- Add anti-repetition selection and floor/room complexity scaling.

### Milestone 4: Difficulty, pursuit, and build tuning

- Apply count, attack-budget, health, damage, and speed starting values.
- Improve navigation and pursuit for larger connected arenas.
- Run fixed-seed baseline, damage-build, and survival-build scenarios.
- Tune clear time, damage taken, idle pursuit time, and specialist pressure from
  evidence rather than intuition.

### Milestone 5: Integrated acceptance

- Run targeted tests after each atomic change; run the full suite only at stable
  milestones.
- Run syntax checks and the production build.
- Run large generation seed sweeps across every layout family, floor, and room.
- Run autoplay through complete Standard and Speedrun routes and validate both
  endings.
- Run the optimized-preview 35-enemy benchmark.
- Perform a real browser gameplay pass covering early, middle, late, horde,
  streamed reinforcement, every layout family, touch/coarse-pointer controls,
  and the Witch fight.

## 8. Recommended harness improvements

Add a focused command, such as `npm run test:refinement`, that runs only the
arena, navigation, encounter, attack-coordination, difficulty, autoplay, and
benchmark-contract tests. It must complete quickly enough to use after every
small edit. The current focused arena/encounter/difficulty/director baseline is
fast enough to preserve as a sub-five-second inner loop.

Extend deterministic diagnostics to record:

- encounter recipe and layout family;
- total, spawning, living, and maximum simultaneous enemies;
- wave trigger type and trigger timestamp;
- roster roles, threat, stable/volatile counts, and specialist maxima;
- active and denied attack leases by family;
- spawn-animation duration and minimum spawn distance from the player;
- room clear time, damage dealt/taken, deaths, and build profile;
- player/enemy distance travelled, pursuit idle time, stuck recovery, and
  unreachable-path events;
- actual walkable area, connector widths, objective reachability, and escape-route
  checks;
- frame, CPU, GPU, draw-call, triangle, telegraph, actor, and damage-number peaks.

Add deterministic scenario coverage for:

- every recipe in early, middle, and late bands;
- a horde at the normal active ceiling;
- a population-pressure encounter where elapsed time alone releases nothing;
- a reinforcement encounter where fast kills release the next batch immediately;
- adjacent spawns during player movement and attack;
- each layout family at its minimum and maximum dimensions;
- player and enemy navigation between every pair of major lobes;
- portal and reward traversal in non-centered layouts;
- the Witch and five guards in the revised boss court;
- Relaxed, Standard, Ruthless, and fixed-Ruthless Speedrun;
- baseline, damage-focused, and survival-focused builds;
- kill and timeout ending completion.

Seed sweeps should fail with the exact seed, floor, room, layout, recipe, and
invariant so a failure is reproducible immediately. Use a modest sweep in the
fast loop and a larger sweep at milestones.

Add a rendering-free deterministic scheduler harness that advances encounter
time, alive counts, and kills directly. Use it for most recipe and spawn-state
testing instead of waiting for full browser runs. Run browser autoplay at an
accelerated simulation rate where supported, with a bounded wall-clock timeout
and a captured report. After two identical full-run failures, stop retrying the
entire route and reduce the failure to a fixed-seed focused scenario.

Update the browser benchmark to exercise the largest new silhouette and a
35-enemy burst. Preserve the existing CPU, GPU, draw-call, triangle, damage-number,
and long-task budgets rather than weakening them to make the new content pass.

## 9. Concurrency strategy

Use sub-agents for independent file ownership, with the primary agent responsible
for the shared contracts, integration, diff review, and final validation.

Recommended staged work split:

1. **Primary agent first:** freeze the arena geometry/query contract and the
   encounter recipe/batch/spawn-state contract.
2. **Parallel wave A — arena owner:** implement shape data, generation,
   reachability, and focused generation tests without editing encounter files.
3. **Parallel wave A — encounter owner:** implement recipe planning, population,
   composition, and difficulty data/tests without editing `EnemyDirector.js`.
4. **Parallel wave A — harness owner:** implement reporter diagnostics and the
   rendering-free scheduler tests without editing shared runtime entry points.
5. **Integration owner:** update collision, navigation, `EnemyDirector.js`, and
   `Game.js` against the frozen contracts. One owner handles these tightly coupled
   runtime surfaces.
6. **Parallel wave B — presentation owner:** update floor/wall rendering, camera,
   and emergence presentation after the geometry and spawn contracts are stable.
7. **Parallel wave B — harness owner:** adapt autoplay, browser probes, and the
   largest-layout benchmark while the encounter owner performs isolated balance
   tuning.
8. **Primary agent last:** review every diff, resolve integration issues, run full
   verification, validate both endings, and record actual gameplay evidence.

Do not let agents edit the same shared contract concurrently. Each agent should
return a concise handoff containing files changed, contract assumptions, commands
run, results, and unresolved risks. Start dependent work only after the relevant
contract is available; concurrency should reduce idle time, not create merge
conflicts.

Only one agent may own `EnemyDirector.js`, `Game.js`, `main.js`, `gameConfig.js`,
each renderer file, and each test file at a time. The working tree may already
contain unrelated user changes; agents must preserve them and must not reset,
stash, or overwrite them.

## 10. Acceptance criteria

The goal is complete only when all of the following are true:

- Every normal chamber is observably busier than the current implementation.
- All four encounter recipe families occur deterministically across seed sweeps
  and function at early, middle, and late progression bands. Horde remains a
  minority random outcome and never occurs in adjacent chambers.
- Horde and streamed reinforcement encounters both work.
- Reinforcements can appear beside the player but cannot act during their clear
  rising animation.
- No text or narrative UI announces reinforcement spawns.
- Standard supports 7 and Ruthless supports 10 simultaneous committed attacks;
  Relaxed remains at 3.
- Enemy durability and pressure make damage, survival, and hybrid build choices
  measurably distinct.
- Absolute specialist counts rise without producing single-family degenerate
  batches.
- At least eight genuinely distinct walkable-shape families exist, with no
  default courtyard template.
- Arena collision, walls, navigation, spawns, objectives, camera, and autoplay
  all respect the actual non-rectangular silhouette.
- Arenas use the larger progression bands and enemies can pursue effectively
  through every connected lobe.
- Gameplay remains flat and adds no hazards, destructibles, or elevation.
- Generation is deterministic and large seed sweeps find no unreachable
  objectives, invalid spawns, trapped combat zones, or missing escape routes.
- Chamber pacing increases through the run without accidental multi-minute
  grinds.
- Touch controls, accessibility, pause, suspension, statistics, and records
  remain functional.
- The optimized 35-enemy benchmark passes its configured budgets.
- Targeted tests, the full test suite, syntax checks, and production build pass.
- Automated gameplay validates the standard opening, uninterrupted run flow,
  Witch fight, kill ending, timeout ending, and Speedrun behavior.
- A real gameplay pass validates visual clarity, spawn readability, movement,
  combat feel, every layout family, and both endings. Compilation alone is not
  accepted as visual or gameplay validation.

## 11. Explicit non-goals

- New enemy families.
- Environmental damage hazards.
- Destructible or explosive dungeon geometry.
- Ramps, platforms, vertical navigation, or upper floors.
- Mid-run dialogue, lore, text scenes, or spawn announcements.
- Changes to bookend canon, ending text, or the five-second final decision.
- Dependency, package-manager, infrastructure, deployment, authentication, or
  persistence redesign unrelated to the required deterministic arena state.
