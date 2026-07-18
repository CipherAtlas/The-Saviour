# Reaper of the Hollow Crown

A browser-based, real-time action roguelite built with Three.js. A prince carrying a long-reach scythe follows the bond between paired wedding rings through ten procedural dungeon floors to rescue Princess Elowen from an ancient Witch.

## Run locally

```bash
npm install
npm run dev
```

Create and preview the optimized production build:

```bash
npm run build
npm run preview
```

## Controls

- `WASD` / arrow keys — move
- Mouse — aim
- Left mouse — three-strike scythe combo
- `Q` / middle mouse — charge and release a full-circle reap
- `Shift` / `Space` / right mouse — dash with brief invulnerability
- Walk into the center portal — enter the next chamber
- Left mouse / `E` during the ending decision — strike
- `Escape` — pause

Bindings can be changed from Settings. Touch controls appear automatically on coarse-pointer devices and can be forced on or off.

## Run structure

- Ten floors with three generated combat chambers each.
- Deterministic room generation from the displayed run seed across the Forgotten Keep, Ossuary, Ember Foundry, and Void Court.
- Post-floor blessings improve reach, damage, maximum health, room recovery, critical chance, life-on-kill, dash recovery, or grant a Death Defiance charge for the current descent.
- A deterministic narrative queue presents the opening, one Witch projection per floor, and brief Princess/Prince dialogue at all 29 upgrade offers.
- Two visually distinct enemy-origin profiles—ordered and unstable—foreshadow the late-game reveal without labeling their source during play.
- Death resets the run. The tenth floor ends with the Witch encounter, a five-second action decision, and one of two complete endings.
- Completing either ending unlocks a persistent glossary without changing first-run story state.

## Combat and presentation

- The knight uses an animated 3D rig with a hand-mounted scythe, three-hit sweeping combo, charged circular reap, dash strike, hit reactions, and visible weapon trails.
- Six enemy families cover lunging melee, mobile dash lanes, shield defense, aimed and fan magic, blink flanks, runes, and lobbed area denial. The Witch adds phase changes, summons, teleports, volleys, slams, and royal dashes.
- Enemy presentation uses category-specific illustrated sprites with state-driven spawn, movement, attack, hit, and defeat motion while retaining one instanced draw per family.
- Camera-facing enemy health bars use two shared instanced layers, while the HUD shows the knight's live dash-energy recharge.
- Real dungeon props, walls, floors, decals, lighting palettes, and generated layouts vary by biome without changing collision readability.
- The adaptive 132 BPM score layers lute, dulcimer, strings, flute, bass, percussion, horns, bells, and choir textures as exploration turns into combat and boss phases.

## Architecture

- A 60 Hz fixed simulation step keeps combat and collision stable; rendering interpolates between simulation states.
- Enemy bodies and projectiles use `InstancedMesh`; dungeon walls and obstacles are also instanced.
- Combat effects use fixed-size pools to avoid allocation spikes.
- Critical assets load first; biome models and textures stream progressively before their rooms are displayed.
- Web Audio is split into Master, Music, SFX, UI, and Voice buses. Procedural layers react to exploration, combat, dialogue, and boss state.
- Settings and narrative completion use separate validated, versioned `localStorage` schemas.
- Narrative content is data-driven with stable sequence and beat identifiers; ending timing is managed by an idempotent, pause-aware timestamp state machine.
- The camera is a fixed three-quarter orthographic rig with aim look-ahead, arena clamping, boss zoom, and additive trauma shake.

## Verification

```bash
npm test
npm run check
npm run build
```

The automated browser benchmark is available at:

```text
http://127.0.0.1:4173/?benchmark=1
```

Focused browser routes are also available:

```text
http://127.0.0.1:4173/?showcase=ending
http://127.0.0.1:4173/?autoplay=1&ending=kill
http://127.0.0.1:4173/?autoplay=1&ending=timeout
```

The narrative canon, voice ladder, floor progression, and manual acceptance matrix live in `docs/NARRATIVE_BIBLE.md` and `docs/MANUAL_NARRATIVE_QA.md`.

It warms up, runs a stress encounter with 35 enemies, and exposes results as `window.__ROGUE_BENCHMARK__.result`. It records frame intervals, CPU frame cost, GPU timer-query cost when supported, draw calls, triangles, long tasks, and resource transfer size.

The final desktop-browser stress sample measured roughly 111 FPS at the 95th-percentile frame interval, 2.4 ms CPU p95, 64 draw calls, 37,388 triangles, zero long tasks, and 2.29 MB cold transfer. The timer query measured 8.34 ms GPU p95 against an 8 ms stretch budget. Results vary by display refresh rate and hardware.

## Settings

Graphics, camera, audio, gameplay, controls, and accessibility each have their own menu. Resolution scale, shadow quality, effects density, frame-rate cap, camera zoom/look-ahead/shake, bus volumes, difficulty, aim assistance, charge behavior, bindings, UI scale, contrast, palette, flashes, subtitles, and particle density are configurable. Antialiasing applies on the next reload because it is selected when the WebGL context is created.

Third-party asset attribution and licenses are documented in `public/assets/LICENSES.md`.
