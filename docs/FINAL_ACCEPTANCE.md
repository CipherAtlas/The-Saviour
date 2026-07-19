# Final Acceptance Record

Date: 2026-07-18  
Target: optimized production preview at `http://127.0.0.1:4174`

This record separates automated, browser-observed, and technical media evidence. It does not treat compilation as visual, gameplay, or audio validation.

## Automated release gates

- `npm test`: 417 tests passed.
- `npm run check`: passed.
- `npm run build`: passed without a bundle-size warning.
- `git diff --check`: passed.
- Narrative mirror: 49 sequences, 339 unique beats, exact runtime metadata/text equality.
- Release packaging: 110 allowed public files copied; 15 rejected or unknown-provenance files excluded from the production bundle while retained in the source tree.

## Gameplay and endings

- Keyboard/mouse combat was exercised in the Witch showcase. Light strike, charged Reap, Claim, and Dash produced actor motion, spatial effects, damage numbers, health changes, and no browser errors.
- The Witch phase trace reached phases 1, 2, and 3. Observed actions included royal volley, slam, fan, lance, summon, teleport, void well, and royal dash. Phase 2 introduced attendants; phase 3 returned to the Witch alone and continued the faster no-summon action set.
- Story and Ruthless boss showcases both entered active combat. The observed maximum Witch health changed from 1,742 on Story to 2,443 on Ruthless, while behavioral-difficulty tests verify timing, coordination, and pressure differences beyond health scaling.
- Reward presentation displayed one Reaper, Shade, and Grave offer with before/after values. The deterministic reroll replaced all three choices, became unavailable for the floor, and selecting Long Haft closed the modal and raised Reaper to rank 1.
- Full Standard kill route: seed `FINAL-PROD-MERCY`, 10 floors, 30 chambers, zero deaths, all seven enemy categories, 273 telegraphs, 100% telegraph coverage, no stuck or recovery events, correct **You found her** ending.
- Full Standard timeout route: seed `FINAL-PROD-RELEASE`, 10 floors, 30 chambers, zero deaths, five-second unresolved choice, no stuck or recovery events, correct **Love opened the cage** ending.

## Visual, input, and accessibility

- The approved title composition, full-screen reader, reward modal, boss encounter, and both result screens were inspected in the running optimized preview.
- Reader checks covered desktop, `320×568`, and `568×320`; document width stayed within the viewport and text/action hierarchy remained readable.
- Focused-button handling preserved canonical gameplay bindings: reader hide, skip confirmation, confirmation cancel, pause, and resume worked without pointer input or narrative reordering.
- High contrast was enabled and visually applied, then Reset Defaults restored the baseline. Automated coverage additionally verifies UI scale, reduced motion/particles, palette-independent Harvest states, flashes, touch actions, controller focus/edges, and keyboard-only menu flows.
- Damage-number stress held exactly 48 active/projected DOM nodes, aggregated overflow, and recorded no dropped or replaced messages.
- A physical controller was not attached. Controller behavior is supported by deterministic Gamepad API and focus-navigation tests; this record does not claim a hardware-session check.

## Audio and licensing

- The production browser unlocked and exercised the event-driven audio path during combat, rewards, narrative, boss phases, and both ending routes without decode/playback warnings.
- All eight music files are 44.1 kHz stereo MP3s. Their SHA-256 hashes match `public/assets/LICENSES.md`, which links each cue to the authoritative Kevin MacLeod page and CC BY 4.0 license.
- Source and release scans found no voice, speech, bark, breath, or vocal-effort asset. The runtime has no voice-performance path.
- The decoded soundtrack cache is bounded to two buffers; transitions, ducking, bus controls, Claim/Harvest/boss/ending cues, cancellation, and layer limits have automated coverage.
- Static media checks cover duration, channel/sample format, peak headroom, and file integrity. The execution environment does not expose monitor output for subjective acoustic listening, so this is a technical in-context playback validation rather than a claim of human mix approval.

## Performance

The final 35-enemy/200-particle optimized-preview benchmark passed:

| Metric | Result | Budget |
| --- | ---: | ---: |
| Display refresh | 59.9 Hz, refresh-capped | Capped path allowed |
| Frame p95 | 17.6 ms | Refresh-capped path |
| CPU p95 | 2.9 ms | ≤ 6 ms |
| GPU p95 | 4.44 ms | ≤ 8 ms |
| Draw calls | 69 | ≤ 100 |
| Triangles | 76,112 | ≤ 200,000 |
| Active actors | 35 | 35 stress actors |
| Damage numbers | 48 active / 48 capacity | Exact bounded stress target |
| Long tasks | 0 | 0 |

The benchmark also observed 18 skinned meshes, two active animation mixers, four telegraphs, 1,814 samples, and 11,201 transferred bytes after cache warm-up.

## Release and provenance

- Current runtime art inventory: 29 approved character states and 41 narrative backgrounds.
- The release build excludes rejected menu/background candidates and all retained unknown-provenance legacy WebPs. Runtime source scans contain no reference to those files.
- Project-original art rights, third-party music attribution and candidate research, model/decal provenance, migration status, and excluded-file disposition are recorded in `public/assets/LICENSES.md`, `docs/MUSIC_RESEARCH.md`, `docs/ASSET_MATRIX.md`, `docs/PRODUCTION_PASS.md`, and `docs/REPOSITORY_AUDIT.md`.
- `DIALOGUE.md` is the complete editor-facing dialogue mirror. Future text revisions can be reconciled mechanically by stable beat ID without searching gameplay code by prose.

## Remaining manual-only release checks

The implementation and deterministic evidence are complete, but this environment cannot honestly substitute automation for the following manual acceptance sessions required by `DIRECTIONS.md`:

- Physical-controller play and coarse-pointer touch play.
- Subjective monitor-output listening for balance, loop seams, clipping, transitions, and all bus controls.
- Separate weak, coherent, high-synergy, Reaper, Shade, Grave, and hybrid build-feel runs.
- Hands-on review of every enemy attack plus representative early/late Witch-versus-Elowen origin interference.
- Suspend/resume at representative later floors and an actual background-tab timing pass.
- Running-game high UI scale, reduced-motion/flash configurations, every principal expression/corruption stage, and every VN scene on both desktop and mobile.

Automated contracts exist for each corresponding system, but this record does not mislabel them as those manual sessions.
