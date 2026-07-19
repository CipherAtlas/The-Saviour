# Reaper of the Hollow Crown — Asset Matrix

Status: approved production and integration inventory. The user approved the art direction, Zephyr C/right, Elowen A/left, Witch B/center, the seven representative samples, and subsequent full asset production on 2026-07-18. Current production comprises 29 runtime character states (26 current-wave files plus three accepted Wave 2 states) and 41 runtime narrative backgrounds.

## 1. Matrix contract

This matrix is the source of truth for art, animation, VFX, story-background, and menu-art coverage. It records the completed 2026-07-18 production wave and remains the planning contract for future replacements. A future production owner must expand a row into a brief without changing its stable ID.

### Required record for every asset

Each production record must include:

- Stable asset ID and exact owner.
- Subsystem, actor/origin, action/state, and story scene or floor use.
- Body-animation contract: anticipation start, telegraph-readable event, contact/release event, sustain/return where relevant, and recovery-complete event.
- Named attachment socket or normalized pivot.
- Editable master path, runtime export path, dimensions, alpha, blend mode, frame count/cadence, palette tokens, and loading group.
- A non-color cue and reduced-motion/flash-reduction behavior.
- Creator, source/master, rights basis or exact license, source URL where applicable, modifications, and attribution requirement.
- Status, automated evidence, running-game visual evidence, reviewer, and review date.

No field may be silently omitted. `N/A` requires a reason. Integrated action rows below record their mechanical active window and recovery boundary directly from `src/game/gameConfig.js`; the named event and ordering remain mandatory if those values are retuned.

### Event notation

| Token | Meaning |
| --- | --- |
| `A0` | Actor anticipation begins; body leaves idle. |
| `T` | Telegraph reaches required readable shape/value. It must precede contact by the approved fair-read interval. |
| `C` | Mechanical contact/release event; damage, projectile, heal, pull, or state change fires here. |
| `S` | Sustain, travel, pull, channel, or recall interval where required. |
| `R` | Recovery completes and legal control/next action returns. |

Universal order is `A0 < T < C <= S < R`, except non-damaging state transitions where `C` is the visible state commit. VFX begins from a named animated socket or documented world pivot. Detached ground effects, projectiles, trails, or flashes do not satisfy `A0`, `C`, or `R`.

### Export shorthand

| Code | Export |
| --- | --- |
| `CUTOUT` | Transparent master, 1600–2400px high; alpha WebP/PNG runtime; full body and gesture uncropped. |
| `BG` | Layered 1920×1080 minimum master; WebP runtime; no baked UI. |
| `BOARD` | PNG review board in `docs/art-samples/`; not a runtime asset. |
| `ATLAS` | Transparent atlas ≤2048×2048; 8px padding, 2px extrusion; 12fps default, 18fps contact burst only. |
| `MODEL` | GLB plus named clips/events; material and socket manifest required. |
| `UI` | Code-native UI plus 128/256px raster master only where illustration is required. |

Every matrix row inherits the exact profile below unless its row states an override. This supplies dimensions, alpha/blend, cadence, loading, provenance, status, and QA without repeating identical columns hundreds of times.

| Profile | Dimensions | Alpha / blend | Cadence | Loading | Provenance / status | Minimum QA |
| --- | --- | --- | --- | --- | --- | --- |
| `CUTOUT` | Current-wave sizes recorded below; accepted Wave 2 sizes recorded per file; compatible crop derived at ≥512px | Straight alpha; normal blend | One still per state; beat transitions are code-driven | Current narrative scene; next required state prefetched | Project-original rights recorded; 29 runtime states integrated | Full body, responsive staging, identity, edge, and exact-manifest checks passed |
| `BG` | All 41 current runtime backgrounds are 1920×1080 | Opaque base; normal blend | Still base; code-native atmosphere where used | Scene group; next scene prefetched | Project-original rights recorded; 41 runtime backgrounds integrated | Desktop/mobile crop, text contrast, character separation, reduced-motion checks passed |
| `BOARD` | Final PNG dimensions specified by its prompt | Opaque review field; normal blend | Still | Documentation only; never runtime-loaded | Seven approved representative boards retained as review evidence | Original-resolution, silhouette, grayscale, constraint, and user review completed |
| `ATLAS` | Reference export profile only; no raster atlas is required by the released code-native VFX path | Normal body/fill; additive only for declared luminous core/trail | Mechanical `C` event controls every hit | Preallocated runtime effect pools | Current implementation uses code-native geometry and fixed pools; no pending atlas dependency | Origin, pivot, blend, gameplay scale, biome, reduced-motion, and pool-cap tests passed |
| `MODEL` | Existing licensed GLB scale with named clips and runtime sockets | Material-specific; transparent materials exceptional and documented | 60Hz event sampling; clip rate independent of mechanical event | Pre-run actor critical or room actor group | KayKit CC0 source and modifications recorded; runtime integrated | Clip/event/socket, cancellation, stress-LOD, and low/high frame-rate tests passed |
| `UI` | Code-native responsive layout; approved raster title/story art only | Normal blend; code alpha as implemented | Transform/opacity transitions; reduced-motion alternative | Boot/menu/HUD group by system | Project-original UI and raster rights recorded; runtime integrated | Focus, contrast, keyboard/mouse/controller/touch contracts, desktop/mobile, and reduced-motion checks passed |

### Universal status and QA baseline

Unless a row says otherwise:

- Status: integrated when referenced by the runtime; retained review evidence or reference-only profile when explicitly identified as such.
- Provenance: recorded in `public/assets/LICENSES.md` and `docs/PRODUCTION_PASS.md`; external work includes its authoritative source, license, and attribution.
- QA: automated contract checks plus running-game desktop/mobile, reduced-motion, readability, and representative visual inspection. Compilation alone never passes.

## 2. Principal concept and cutout coverage

### Concept gates

| ID | Coverage | Deliverable | Required invariants | Status / QA |
| --- | --- | --- | --- | --- |
| `CON-ZEP-001` | Zephyr variants A/B/C | `BOARD`; `docs/art-samples/zephyr-concept-variants.png` | Same face/build/ring/scythe; open/raised story helmet; vary only helmet crown, mantle cut, ornament density | Variant C/right selected by user on 2026-07-18; Wave 1B identity anchor; native 1536×1024 board is not a runtime master |
| `CON-ELO-001` | Elowen variants A/B/C in human, midpoint, corrupted endpoint | `BOARD`; `docs/art-samples/elowen-concept-variants.png` | Same face/ring/proportions; human has no explicit necromancy; corruption remains recognizable | Variant A/left selected by user on 2026-07-18; Wave 1B identity/progression anchor; native 1536×1024 board is not a runtime master |
| `CON-WIT-001` | Witch variants A/B/C | `BOARD`; `docs/art-samples/witch-concept-variants.png` | Same ancient face; bilateral containment architecture; no dominant violet or generic evil-queen shorthand | Variant B/center selected by user on 2026-07-18; Wave 1B identity anchor; native 1536×1024 board is not a runtime master |

### Wave 2 runtime-production record

These files were created under the user-authorized Wave 2 exact-file scope on
2026-07-18. They remain additive beside retained legacy files. Native production
dimensions are recorded without claiming an upscale or editable layered master
that does not exist. Later runtime integration used the accepted character files
and separately approved current-wave art; it did not promote the blocked or
undersized candidates.

| ID / use | Runtime path | Native export / SHA-256 | Current status and evidence |
| --- | --- | --- | --- |
| `VN-F01-WITCH`; Floor 1 projection background | `public/assets/vn/floor01-witch-projection-bg.png` | 1672×941 RGB PNG; `34633bdae805436e313352c7a5e7bb831f59e69f6189dbaf4274f58fc1122c23` | Retained, unreferenced visual candidate. It passed the recorded composition review but remains below the 1920×1080 layered-master gate; current scenes use the approved background-wave files instead. |
| `CHR-ZEP-DETERMINED` | `public/assets/vn/zephyr-c-determined.png` | 1024×1536 RGBA PNG; `5d42987989b9cd1702bc26ec9233883807ca41226141775153c6fd47132aeb0b` | Accepted and runtime-referenced for Zephyr dialogue and the title composition; selected C/right identity and alpha checks are recorded. |
| `CHR-WIT-CLINICAL` | `public/assets/vn/witch-b-clinical.png` | 864×1821 RGBA PNG; `06163bad693c46be87afcb407556d0d6f75f1e531582d3590eb418d46f304f9f` | Accepted and runtime-referenced for the clinical Witch state; selected B/center identity and alpha checks are recorded. |
| `CHR-WIT-WARNING`; containment gesture state | `public/assets/vn/witch-b-containment-gesture.png` | 1024×1536 RGBA PNG; `f1adb1582f9626b6b1c1ac0b8d9c3492452e480a61543d12b6fec0877af6cdaa` | Accepted and runtime-referenced for the Witch warning state; body gesture and alpha checks are recorded. |
| `MENU-TITLE-BASE` | `public/assets/menu/title-bg-01.png` | 1672×941 RGB PNG; `3e2ed44b8e4e4bf70693ff8d24cfb6d4a0564f18252b74fbf0a9006527ed68d9` | Retained, unreferenced visual candidate. It remains below the 1920×1080 layered-master gate; the running title uses `public/assets/vn/backgrounds/dungeon-threshold.png`. |
| `MENU-TITLE-ZEPHYR` | `public/assets/menu/zephyr-c-title.png` | 1024×1536 RGBA PNG; `009baec6bffe925819ccf1aa116589faaa39363803eecb6166252a1d9be36011` | **Blocked from runtime use.** Identity, anatomy, pose, full scythe, ring hand, and framing pass, but green contamination remains on crown/hair, scythe, and torn mantle edges. One-pixel contraction eroded the silhouette without clearing contamination; the replacement specialist's magenta-key attempt also failed edge/color validation. No fourth execution is permitted. |

### Current narrative production and integration record

- `public/assets/vn/characters/*.png`: exactly 26 project-original files — Zephyr C/right (8), Elowen A/left (14), and Witch B/center (4).
- `public/assets/vn/backgrounds/*.png`: exactly 41 project-original files — all 41 IDs in `NARRATIVE_BACKGROUND_IDS` are mapped as ready runtime assets.
- Native dimensions: 25 current-wave character cutouts are 1024×1536 RGBA; `witch-b-acceptance.png` is 887×1774 RGBA; every current background is 1920×1080 RGB.
- Together with the three accepted Wave 2 character states above, `CHARACTER_ART_ASSETS` exposes 29 runtime character states.
- Exact filenames and the common creator/date/rights record are maintained in `public/assets/LICENSES.md`; `src/game/narrativeAssetManifest.js` is the runtime mapping.
- Production and integration are complete. Automated and running-game evidence is recorded in `docs/FINAL_ACCEPTANCE.md` and `docs/MANUAL_NARRATIVE_QA.md`; this inventory does not substitute compilation for visual review.

### Zephyr story states

All rows use `CUTOUT`; actor event is the dialogue beat's pose/expression commit (`A0=beat transition`, `C=pose visible before line reveal`, `R=next permitted beat`). Pivot is bottom-center; ring-hand, scythe-grip, and face anchors are preserved. Palette is ring gold, blackened plate, oxblood cloth, and restrained Zephyr cyan. Load group is current narrative scene.

| ID | State | Required pose/expression evidence | Non-color / reduced motion |
| --- | --- | --- | --- |
| `CHR-ZEP-CALM` | Calm | Relaxed brow/jaw, grounded open stance | Head/shoulder shape; dissolve only |
| `CHR-ZEP-AFFECTIONATE` | Affectionate | Warm eye line, softened mouth, ring-hand gesture | Hand/face gesture; dissolve only |
| `CHR-ZEP-ALARMED` | Alarmed | Raised focus, protective scythe/arm transition | Open silhouette; direct cut allowed |
| `CHR-ZEP-DETERMINED` | Determined | Forward weight, deliberate grip, visible face | Diagonal weapon line; restrained slide |
| `CHR-ZEP-DOUBTFUL` | Doubtful | Broken eye line, guarded ring hand | Inward posture; dissolve only |
| `CHR-ZEP-INJURED` | Injured | Directional wound tension, supported weapon weight | Asymmetric posture; no repeated shake |
| `CHR-ZEP-ENRAGED` | Enraged | Controlled forward aggression, not feral distortion | Expanded scythe/shoulder silhouette; one emphasis |
| `CHR-ZEP-DEVASTATED` | Devastated | Collapsed center, face and ring still legible | Silhouette compression; dissolve only |
| `CHR-ZEP-RESOLVED` | Resolved | Stable eye line, ending-action readiness | Balanced stance; restrained state commit |
| `CHR-ZEP-CROP-SUITE` | Compatible portrait crops for all approved Zephyr states | Derived from the same cutout/face masters; never repainted identity | 512px check, left/right staging, ring/scythe handedness audit |

### Elowen story states

All rows use `CUTOUT`; pivot bottom-center. Identity anchors are face, eye spacing, hairline, ring hand, neckline, and height. Actor event is the dialogue beat pose/expression commit. Transition stages are silhouette states, not color filters.

| ID | State | Palette/silhouette requirement | Non-color / reduced motion |
| --- | --- | --- | --- |
| `CHR-ELO-HUMAN` | Human baseline | Ivory/oxblood/gold; closed soft silhouette; no overt violet aura | Clean bilateral outline; dissolve only |
| `CHR-ELO-CORRUPT-1` | Transition 1 | One controlled asymmetry; no source disclosure before allowed beat | Small broken contour; static reduced state |
| `CHR-ELO-CORRUPT-2` | Transition 2 | Two asymmetrical intrusions; face fully human-readable | Negative-space notch; static reduced state |
| `CHR-ELO-CORRUPT-3` | Transition 3 | Branching reaches torso/gesture; ring/face persist | Branch silhouette; no flicker |
| `CHR-ELO-CORRUPT-4` | Transition 4 | Major imbalance and open negative space; lucid return still plausible | Torn contour; one opacity pulse maximum |
| `CHR-ELO-CORRUPT-FULL` | Fully corrupted | Violet/magenta/abyss; recognizable face and ring hand | Broken spiral/tendril outline; static restrained state |
| `CHR-ELO-AFFECTIONATE` | Affectionate | Human palette; intimate eye/hand gesture | Gesture, not color; dissolve only |
| `CHR-ELO-FRIGHTENED` | Frightened | Recoiling shoulders/hands; no generic scream | Contracted silhouette; direct cut allowed |
| `CHR-ELO-STRAINED` | Strained | Conflicting face and body tension | Asymmetric tension; dissolve only |
| `CHR-ELO-COMMANDING` | Commanding | Upright certainty, open controlling hand | Expanded hand/torso line; restrained slide |
| `CHR-ELO-POSSESSIVE` | Possessive | Enclosing gesture, fixed eye line | Closing silhouette; no strobe |
| `CHR-ELO-LUCID` | Briefly lucid | Corruption remains, human face/gesture returns | Human eye/hand anchor; single opacity transition |
| `CHR-ELO-TRIUMPHANT` | Triumphant | Full corruption with elevated controlled gesture | High open silhouette; restrained rise |
| `CHR-ELO-FINAL-PLEA` | Final human plea | Human recognition inside corrupted body; ring visible | Direct eye line and open hand; no camera shake in reduced mode |
| `CHR-ELO-CROP-SUITE` | Compatible portrait crops for all approved Elowen states | Derived from the same cutout/face masters; identity and corruption stage cannot drift | 512px check, left/right staging, ring hand and stage audit |

### Witch story states

All rows use `CUTOUT`; pivot bottom-center or projection world anchor where staged. Palette is Witch ivory/steel/dark. Actor event is the dialogue beat pose/expression commit.

| ID | State | Required evidence | Non-color / reduced motion |
| --- | --- | --- | --- |
| `CHR-WIT-CLINICAL` | Clinical baseline | Bilateral stillness, readable ancient face | Closed vertical silhouette; dissolve only |
| `CHR-WIT-WARNING` | Warning | Exact hand/focus gesture, contained intensity | One raised geometric line; restrained state change |
| `CHR-WIT-OBSERVING` | Observing | Minimal gesture and direct appraisal | Still profile/hand position; dissolve only |
| `CHR-WIT-COMBAT` | Combat-ready | Body visibly establishes casting/dueling guard | Open focus/limb silhouette; direct cut allowed |
| `CHR-WIT-WOUNDED` | Wounded | Controlled damage, asymmetric break without Elowen tendrils | Broken posture, not violet; no repeated shake |
| `CHR-WIT-ACCEPTANCE` | Final acceptance | Relaxed resistance, tragic clarity, no theatrical villain collapse | Lowered focus/shoulders; dissolve only |
| `CHR-WIT-CROP-SUITE` | Compatible portrait crops for all approved Witch states | Derived from the same cutout/face masters; crown/focus cannot drift | 512px check, left/right staging, crown/focus handedness audit |

## 3. Story scene and background coverage

Each scene uses full-screen VN staging. Scene rows declare the background family and required character coverage; individual dialogue-beat mappings belong in the dialogue corpus. `C` is the scene's first fully composed frame before text begins. UI remains code-native and unbaked.

| ID | Scene coverage | Background/export | Characters/states | Load / special QA |
| --- | --- | --- | --- | --- |
| `VN-OPEN-DOMESTIC` | Warm domestic opening | `BG`; royal domestic interior, warm variant | Zephyr calm/affectionate; Elowen human/affectionate | Boot-to-opening; warmth without corruption tell |
| `VN-OPEN-DISAPPEAR` | Disappearance and ring pursuit | `BG`; domestic darkening plus pursuit transition | Zephyr alarmed/determined; Elowen human memory | Opening; ring path readable without numeric instruction |
| `VN-THRESHOLD` | Threshold confrontation | `BG`; dungeon threshold/projection plane | Zephyr determined; Witch warning/clinical | Pre-floor; no early source disclosure |
| `VN-FLOOR-PROJ-01` | Floor 1 Witch projection | `BG`; Forgotten Keep controlled treatment | Witch clinical; Zephyr determined | Floor 1 pre-combat; origin language introduced cleanly |
| `VN-FLOOR-PROJ-02` | Floor 2 Witch projection | `BG`; Forgotten Keep variation | Witch warning; Zephyr determined | Floor 2 pre-combat |
| `VN-FLOOR-PROJ-03` | Floor 3 Witch projection | `BG`; Keep/Ossuary controlled variation | Witch observing; Zephyr determined | Floor 3 pre-combat |
| `VN-FLOOR-PROJ-04` | Floor 4 Witch projection | `BG`; Ossuary controlled treatment | Witch clinical; Zephyr doubtful | Floor 4 pre-combat |
| `VN-FLOOR-PROJ-05` | Floor 5 Witch projection | `BG`; Ossuary/Foundry variation | Witch warning; Zephyr doubtful | Floor 5 pre-combat |
| `VN-FLOOR-PROJ-06` | Floor 6 Witch projection | `BG`; Foundry controlled treatment | Witch observing; Zephyr determined | Floor 6 pre-combat |
| `VN-FLOOR-PROJ-07` | Floor 7 Witch projection | `BG`; Foundry/Void variation | Witch warning; Zephyr doubtful | Floor 7; divided control perceptible, source unnamed |
| `VN-FLOOR-PROJ-08` | Floor 8 Witch projection | `BG`; Void Court controlled treatment | Witch wounded/warning; Zephyr enraged | Floor 8; no explicit Elowen source cue |
| `VN-FLOOR-PROJ-09` | Floor 9 Witch projection | `BG`; Void Court escalation | Witch wounded/observing; Zephyr enraged | Floor 9; readable instability without reveal |
| `VN-FLOOR-PROJ-10` | Floor 10 Witch projection | `BG`; Witch threshold | Witch combat/acceptance; Zephyr resolved | Boss preload |
| `VN-BOSS-CONFRONT` | Boss confrontation | `BG`; containment chamber | Zephyr resolved; Witch combat | Boss preload; gameplay continuity |
| `VN-WITCH-DEATH` | Final Witch dialogue and death | `BG`; containment chamber broken cleanly | Witch wounded/acceptance; Zephyr resolved/doubtful | Finale preload; Witch-origin cleanup readable |
| `VN-REVEAL-TRIUMPH` | Corrupted triumph | `BG`; Elowen prison/reveal | Elowen triumphant/full; Zephyr doubtful | Finale preload; reveal begins only here |
| `VN-REVEAL-REALIZE` | Zephyr's realization | Same layered reveal family | Zephyr devastated; Elowen full/strained | Finale preload |
| `VN-REVEAL-LUCID` | Lucid return and plea | Same family, face-value separation | Elowen lucid/final plea; Zephyr devastated | Finale preload; human face legible |
| `VN-ENDING-CHOICE` | Five-second circular nonnumeric choice | Controlled live-scene treatment plus code-native ring UI | Elowen final plea; Zephyr resolved | Finale preload; all input/reduced-motion states |
| `VN-ENDING-KILL` | Kill ending | `BG`; ending branch layered composition | Zephyr resolved/devastated; Elowen lucid | Finale preload; ending strike body animation required |
| `VN-ENDING-TIMEOUT` | Hesitation ending | `BG`; instability branch layered composition | Zephyr devastated; Elowen full | Finale preload; no numeric countdown |

### Upgrade encounter scenes

All 29 are separate full-screen scenes followed by a distinct upgrade-selection step. Each row uses a controlled graded/blurred/illustrated current-biome `BG`, Elowen's approved progression state, and the Zephyr state specified by the dialogue corpus. No scene receives an unrelated background style. `C` occurs before typewriter text; reduced motion freezes parallax and corruption drift.

The art IDs map one-to-one to the canonical narrative sequence IDs. This mapping is immutable unless a separately approved canon change updates both registries:

| Art ID | Narrative sequence ID | Art ID | Narrative sequence ID |
| --- | --- | --- | --- |
| `VN-UPG-01` | `floor.f01.upgrade.r01` | `VN-UPG-16` | `floor.f06.upgrade.r01` |
| `VN-UPG-02` | `floor.f01.upgrade.r02` | `VN-UPG-17` | `floor.f06.upgrade.r02` |
| `VN-UPG-03` | `floor.f01.upgrade.threshold` | `VN-UPG-18` | `floor.f06.upgrade.threshold` |
| `VN-UPG-04` | `floor.f02.upgrade.r01` | `VN-UPG-19` | `floor.f07.upgrade.r01` |
| `VN-UPG-05` | `floor.f02.upgrade.r02` | `VN-UPG-20` | `floor.f07.upgrade.r02` |
| `VN-UPG-06` | `floor.f02.upgrade.threshold` | `VN-UPG-21` | `floor.f07.upgrade.threshold` |
| `VN-UPG-07` | `floor.f03.upgrade.r01` | `VN-UPG-22` | `floor.f08.upgrade.r01` |
| `VN-UPG-08` | `floor.f03.upgrade.r02` | `VN-UPG-23` | `floor.f08.upgrade.r02` |
| `VN-UPG-09` | `floor.f03.upgrade.threshold` | `VN-UPG-24` | `floor.f08.upgrade.threshold` |
| `VN-UPG-10` | `floor.f04.upgrade.r01` | `VN-UPG-25` | `floor.f09.upgrade.r01` |
| `VN-UPG-11` | `floor.f04.upgrade.r02` | `VN-UPG-26` | `floor.f09.upgrade.r02` |
| `VN-UPG-12` | `floor.f04.upgrade.threshold` | `VN-UPG-27` | `floor.f09.upgrade.threshold` |
| `VN-UPG-13` | `floor.f05.upgrade.r01` | `VN-UPG-28` | `floor.f10.upgrade.r01` |
| `VN-UPG-14` | `floor.f05.upgrade.r02` | `VN-UPG-29` | `floor.f10.upgrade.r02` |
| `VN-UPG-15` | `floor.f05.upgrade.threshold` | — | — |

| Stable IDs | Coverage | Background/load | Required QA |
| --- | --- | --- | --- |
| `VN-UPG-01`, `VN-UPG-02`, `VN-UPG-03`, `VN-UPG-04`, `VN-UPG-05` | Upgrade encounters 1–5 | Current biome family; scene group | Human baseline/early state only; no necromancy disclosure |
| `VN-UPG-06`, `VN-UPG-07`, `VN-UPG-08`, `VN-UPG-09`, `VN-UPG-10` | Upgrade encounters 6–10 | Current biome family; scene group | Relationship advances; identity anchors stable |
| `VN-UPG-11`, `VN-UPG-12`, `VN-UPG-13`, `VN-UPG-14`, `VN-UPG-15` | Upgrade encounters 11–15 | Current biome family; scene group | Approved midpoint progression; no explicit source reveal |
| `VN-UPG-16`, `VN-UPG-17`, `VN-UPG-18`, `VN-UPG-19`, `VN-UPG-20` | Upgrade encounters 16–20 | Current biome family; scene group | Increasing strain/possession through silhouette and gesture |
| `VN-UPG-21`, `VN-UPG-22`, `VN-UPG-23`, `VN-UPG-24`, `VN-UPG-25` | Upgrade encounters 21–25 | Current biome family; scene group | Late corruption readable but source still unnamed by Zephyr |
| `VN-UPG-26`, `VN-UPG-27`, `VN-UPG-28`, `VN-UPG-29` | Upgrade encounters 26–29 | Void/boss-adjacent family; scene group | Final pre-reveal progression; continuity audit required |

## 4. Zephyr animation coverage

Every row exports as `MODEL` clips/events. Palette applies only to attached VFX. Root motion and cancel boundaries come from the approved combat design. `C` is the actual gameplay event, never an approximate visual frame.

| ID | Action/body contract | Socket/pivot | Attached VFX / non-color / reduced motion |
| --- | --- | --- | --- |
| `ANM-ZEP-IDLE-MOVE` | Idle, locomotion start, loop, stop, turn; no sliding feet | Root/feet | Mantle/ring restraint; direction and gait convey state; no camera bob in reduced mode |
| `ANM-ZEP-DASH-START` | `A0=coil`, `T=direction committed`, `C=dash impulse`, `R=travel clip handoff` | Root, feet | Gold/cyan forward wedge; directional silhouette; replace streak burst with one edge line |
| `ANM-ZEP-DASH-TRAVEL` | Body leads steerable travel; scythe carried with plausible weight | Root, scythe grip | Cyan afterimage; repeated silhouettes limited/removed in reduced mode |
| `ANM-ZEP-DASH-RECOVER` | Feet and torso absorb travel from `0.148s`; traversal/control lock ends at `R=0.19s` | Root/feet | Dust/contact accent; static foot marker in reduced mode |
| `ANM-ZEP-COMBO-1` | Distinct short reap: `A0=0`; readable windup `<0.075s`; `C=0.075–0.19s`; `R=0.31s` | Scythe blade contact | Crescent 1; arc direction and body pose identify hit |
| `ANM-ZEP-COMBO-2` | Distinct returning reap: `A0=0`; readable windup `<0.08s`; `C=0.08–0.22s`; `R=0.35s` | Scythe blade contact | Crescent 2; opposite arc direction, not recolor |
| `ANM-ZEP-COMBO-3` | Distinct committed finisher: `A0=0`; readable windup `<0.11s`; `C=0.11–0.30s`; `R=0.47s` | Scythe blade contact | Heavy crescent/contact; bounded hit-stop; reduced mode keeps pose/contact |
| `ANM-ZEP-DASH-STRIKE` | Dash momentum visibly enters strike: `A0=0`; readable windup `<0.025s`; `C=0.025–0.20s`; `R=0.28s` | Root + scythe blade | Long wedge/crescent; no detached slash |
| `ANM-ZEP-CHARGE-START` | Body lowers and scythe begins collecting power; `C=charge state entered` | Ring hand + scythe spine | Gold/cyan accumulation attached to actor; static tier marker reduced |
| `ANM-ZEP-CHARGE-LOOP` | Sustainable weight-bearing loop for hold/toggle modes | Ring hand + scythe spine | Tier accumulation, no detached ground-only effect |
| `ANM-ZEP-CHARGE-RELEASE` | Ordinary partial/full 360 reap after release classification: `A0=0`; readable windup `<0.20s`; `C=0.20–0.46s`; `R=0.72s` | Scythe blade path | Complete body rotation with code-native trail |
| `ANM-ZEP-CHARGE-PERFECT` | Perfect release has same mechanical base plus precise committed accent | Scythe blade + ring hand | Gold core/cyan rim and non-color notch; no rapid flash |
| `ANM-ZEP-CLAIM-THROW` | Physical scythe visibly leaves hands: `A0<T<C=release<R=unarmed handoff` | Scythe grip/release | Throw trail begins at blade; no free-standing spell cast |
| `ANM-ZEP-CLAIM-UNARMED` | Readable unarmed/recall interval; ring may channel through open hand | Ring hand + empty grip | Tether/trajectory cue; path line remains reduced |
| `ANM-ZEP-CLAIM-CATCH` | Hands and body receive returning weapon: `C=catch`, `R=control` | Scythe catch socket | Catch contact; no teleport into hand |
| `ANM-ZEP-CLAIM-FOLLOW` | Well-timed catch flows into empowered cleave: `A0=0`; readable windup `<0.08s`; `C=0.08–0.25s`; cleave ends `0.44s`; control returns after recovery at `R=0.62s` | Scythe blade | Empowered crescent; pose and arc identify timing |
| `ANM-ZEP-HIT-LIGHT` | Directional flinch without losing weapon continuity | Torso/root | Compact impact; silhouette direction remains in reduced mode |
| `ANM-ZEP-HIT-HEAVY` | Severe stagger/knockback blend with intentional recovery | Torso/root | Heavy impact and bounded trauma; no repeated shake |
| `ANM-ZEP-HEAL` | Ring/hand/body visibly perform recovery; `C=health applied` | Ring hand/chest | Green is paired with rising glyph/label; opacity-only reduced |
| `ANM-ZEP-DEATH-DEFIANCE` | Collapse interruption and forced recovery; `C=revive applied` | Root/chest/ring | Broken-to-complete ring cue; no full-screen strobe |
| `ANM-ZEP-DEFEAT` | Complete defeat state, weapon/body settle | Root/scythe | No celebratory VFX |
| `ANM-ZEP-ENDING-STRIKE` | Full anticipation, physical strike, contact, recovery/aftermath | Scythe blade + target contact | Ending effect follows body contact exactly |
| `ANM-ZEP-VICTORY` | Witch-defeat triumph contaminated by uncertainty | Root/scythe | Ordered cleanup plus surviving instability, no generic victory pose |
| `ANM-ZEP-AFTERMATH` | Branch-specific grief/resolve state | Root/ring/scythe | Minimal atmospheric state; reduced motion static |

## 5. Player VFX and feedback coverage

All effect rows use transparent `ATLAS` or code-native geometry. Additive is limited to luminous core/trail; body, fill, debris, and smoke use normal alpha. `C` is driven by the paired animation/mechanics event.

| ID | Effect/event contract | Socket/pivot | Palette / non-color / reduced motion |
| --- | --- | --- | --- |
| `VFX-ZEP-COMBO-1` | Trail follows `ANM-ZEP-COMBO-1`; contact at `C`; decay before `R` | Scythe blade path | Gold/cyan short crescent; clockwise/shape cue; shorten trail reduced |
| `VFX-ZEP-COMBO-2` | Trail follows combo 2 | Scythe blade path | Gold/cyan returning crescent; opposite arc cue |
| `VFX-ZEP-COMBO-3` | Finisher trail/contact/hit-stop accent | Blade + world contact | Wide notched crescent; bounded expansion reduced |
| `VFX-ZEP-DASH` | Start, travel afterimage, foot recovery | Root/feet | Forward cyan wedge; single line in reduced mode |
| `VFX-ZEP-DASH-STRIKE` | Travel resolves into attached strike/contact | Root + blade | Long wedge then crescent; no duplicate body silhouette reduced |
| `VFX-ZEP-CHARGE-START` | Accumulation begins at actor | Ring hand + scythe spine | Gold/cyan attached motes/line; static tier marker reduced |
| `VFX-ZEP-CHARGE-LEVELS` | Partial/full/perfect-ready tiers | Ring hand + scythe; HUD mirror | One/two/three notches plus line weight; restrained state transitions reduced |
| `VFX-ZEP-CHARGE-PERFECT-WINDOW` | Brief perfect state before release | Scythe spine + HUD | Bright gold seam, cyan brackets, unique notch; no strobe |
| `VFX-ZEP-CHARGE-RELEASE` | Ordinary 360 release/contact/decay | Scythe blade path | Complete cyan-edged gold ring with ordinary gap marker |
| `VFX-ZEP-CHARGE-PERFECT` | Perfect release/contact/decay | Scythe blade path | Sharper ring plus four cardinal breaks; restrained expansion reduced |
| `VFX-ZEP-CLAIM-THROW` | Physical release trail at throw `C` | Scythe blade | Forward crescent ribbon; direction line persists reduced |
| `VFX-ZEP-CLAIM-TRAVEL` | Outbound damaging travel | Scythe world pivot | Rotating blade-readable trail; path cue not color-only |
| `VFX-ZEP-CLAIM-HIT` | Outbound contact per target | Target contact | Compact crescent notch; no screen flash |
| `VFX-ZEP-CLAIM-PULL` | Recall pull begins after contact | Target root toward scythe | Directional tether/chevrons; heavy-resist lock marker |
| `VFX-ZEP-CLAIM-RECALL` | Inbound damaging travel | Scythe world pivot to catch socket | Reversed path and converging brackets |
| `VFX-ZEP-CLAIM-CATCH` | Catch contact at actor | Scythe catch + ring hand | Closed gold ring/cyan snap; opacity state reduced |
| `VFX-ZEP-CLAIM-FOLLOW` | Empowered follow-up anticipation/contact | Blade path | Split crescent with center notch; bounded trauma reduced |
| `VFX-HIT-NORMAL` | Compact per-target contact | Damaged actor contact | Small directional wedge; compact scale |
| `VFX-HIT-CRITICAL` | Larger contact and number support | Damaged actor contact | Gold four-point notch; size/shape conveys critical |
| `VFX-HIT-BLOCKED` | Muted deflection | Shield/contact | Desaturated closed bracket; no expansion |
| `VFX-HIT-HEAVY` | Poise/stagger contact | Damaged actor root/contact | Impact orange fractured wedge; single emphasis reduced |
| `VFX-ZEP-HEAL` | Heal commit at `ANM-ZEP-HEAL.C` | Ring hand/chest/root | Green plus upward cross/ring geometry; static glow reduced |
| `VFX-HARVEST-GAIN` | Segment gain and HUD/world handoff | Defeated/struck target to HUD | Green plus scythe-segment glyph; opacity fill reduced |
| `VFX-HARVEST-SPEND` | Segment consumed at Claim commit | HUD to ring/scythe | Segment closes into throw path; instant state reduced |
| `VFX-DEATH-DEFIANCE` | Revive commit | Zephyr root/ring/chest | Broken ring restores with label/icon; no full-screen flash |
| `UI-DAMAGE-NORMAL` | Spatial pooled number at actor | Actor head offset | Compact number; restrained fade/offset reduced |
| `UI-DAMAGE-CRITICAL` | Larger spatial number | Actor head offset | Gold plus star/notch style; size and label style distinguish |
| `UI-DAMAGE-PLAYER` | Player damage number | Zephyr head offset | Danger red plus downward offset/shape |
| `UI-DAMAGE-HEAL` | Healing number | Actor head offset | Green plus `+` glyph; restrained fade reduced |
| `UI-DAMAGE-BLOCKED` | Blocked/heavily mitigated | Actor head offset | Muted bracket/label; no pop expansion |

## 6. Origin, enemy, and boss coverage

### Origin lifecycle

| ID | Effect/body event | Socket/pivot | Palette / non-color / reduced motion |
| --- | --- | --- | --- |
| `VFX-WIT-SUMMON` | Actor/caster anticipation, closed seal `T`, spawn at `C`, clean settle `R` | Caster focus + spawn root | Witch closed radial seal; ordered line build; opacity state reduced |
| `VFX-WIT-DISMISS` | Witch-origin actor body resolves with clean ordered collapse | Actor root | Concentric inward rings; no ragged residue; direct fade reduced |
| `VFX-ELO-SUMMON` | Source/body anticipation, broken spiral `T`, spawn at `C`, unstable settle | Source focus + spawn root | Elowen broken spiral/tendril; irregular contour; static fracture reduced |
| `VFX-ELO-CORRUPT` | Corruption visibly propagates across actor/environment | Animated surface sockets/root | Branching violet/magenta; asymmetry; one-step state reduced |
| `VFX-ELO-DEFEAT` | Body defeat leaves unstable residue | Actor root/contact | Torn reverse pull and residue; no clean Witch collapse |
| `VFX-ORIGIN-CLASH` | Authored floors 7–10 interference only | Recorded encounter world pivots | Closed geometry interrupted by broken branch; static crossing marks reduced |

### Enemy attack families

All rows require a natural body clip with `A0`, `T`, `C=existing configured windup`, and a nonzero `R` defined by mechanics. Telegraph shape follows current attack geometry; VFX begins at the attacking limb/weapon/casting focus. Each attack receives Witch- and/or Elowen-origin treatment only where encounter data assigns that origin; the mechanical silhouette remains stable.

Common body coverage applies to every non-boss archetype and may share clips only after rig compatibility and visual inspection prove the motion is natural:

| ID | Coverage | Event/socket contract | Required origin/readability behavior |
| --- | --- | --- | --- |
| `ANM-ENM-IDLE-MOVE` | Idle, locomotion start/loop/stop/turn | Root/feet; no sliding | Witch movement ordered; Elowen movement gains approved asymmetry without changing collision readability |
| `ANM-ENM-SUMMON-WIT` | Witch-origin arrival | `A0=sealed pose`, `C=body becomes active`, `R=combat-ready`; root | Body resolves with `VFX-WIT-SUMMON`; no actor idle before activation |
| `ANM-ENM-SUMMON-ELO` | Elowen-origin arrival | `A0=unstable compression`, `C=body becomes active`, `R=combat-ready`; root | Body tears into active pose with `VFX-ELO-SUMMON`; no detached spawn effect only |
| `ANM-ENM-HIT-LIGHT` | Directional light reaction | Contact side + torso/root | Direction/severity readable without color; intentional blend back to action state |
| `ANM-ENM-HIT-HEAVY` | Poise/stagger reaction | Contact side + torso/root | Heavy/boss resistance still shows readable impact; no mandatory displacement |
| `ANM-ENM-DEFEAT-WIT` | Witch-origin defeat | `C=defeat state`, `R=ordered cleanup`; root | Body completes defeat before clean closed-geometry dismissal |
| `ANM-ENM-DEFEAT-ELO` | Elowen-origin defeat | `C=defeat state`, `R=residue handoff`; root | Body completes defeat before unstable residue; distinct silhouette from Witch cleanup |
| `ANM-ENM-DISMISS-WIT` | Forced Witch-origin cleanup after boss death | `A0=control severed`, `C=noninteractive`, `R=removed`; root | Ordered body collapse synchronized with `VFX-WIT-DISMISS`; Elowen actors unaffected |

| ID | Actor/action | Telegraph / socket | Required effect and cue |
| --- | --- | --- | --- |
| `ANM-THR-LUNGE` / `VFX-THR-LUNGE` | Grave Thrall lunge | Cone; weapon/hand | Forward body lunge and directional slash |
| `ANM-THR-CLEAVE` / `VFX-THR-CLEAVE` | Grave Thrall grave cleave | Wide cone; weapon | Weight-bearing cleave and broad ground-independent arc |
| `ANM-REA-DASH` / `VFX-REA-DASH` | Crypt Reaver dash lane | Lane; root/weapons | Coiled dash, lane travel, foot recovery |
| `ANM-REA-CROSSCUT` / `VFX-REA-CROSSCUT` | Crypt Reaver crosscut | Circle; both weapons | Distinct crossing arms/blades and center contact |
| `ANM-BON-SLAM` / `VFX-BON-SLAM` | Boneguard shield slam | Circle; shield/contact | Shield/torso impact, body recovery, blocked silhouette |
| `ANM-BON-CHARGE` / `VFX-BON-CHARGE` | Boneguard guard charge | Lane; shield/root | Shield-led acceleration, travel, braced recovery |
| `ANM-HEX-BOLT` / `VFX-HEX-BOLT` | Hexer aimed bolt | Lane; casting hand/focus | Visible aim, projectile release at `C`, hand recovery |
| `ANM-HEX-FAN` / `VFX-HEX-FAN` | Hexer projectile fan | Cone; casting hand/focus | Body sweep releases ordered fan at `C` |
| `ANM-HEX-RUNE` / `VFX-HEX-RUNE` | Hexer rune | Circle; casting focus + world pivot | Casting gesture traces rune before activation |
| `ANM-WRA-BLINK` / `VFX-WRA-BLINK` | Wraith blink flank | Blink marker; root | Compression, disappearance, arrival strike, recovery |
| `ANM-WRA-SWEEP` / `VFX-WRA-SWEEP` | Wraith veil sweep | Circle; limbs/body edge | Full-body sweep with readable contact edge |
| `ANM-BOM-LOB` / `VFX-BOM-LOB` | Bombardier lobbed bomb | Circle; throwing hand/projectile | Physical wind-up and release; travel marker |
| `ANM-BOM-BURST` / `VFX-BOM-BURST` | Bombardier cinder burst | Cone; bottle/focus | Body/focus performs burst release and recoil |

Each enemy row implies a paired `VFX-<same actor/action>` production record with transparent atlas/code geometry, normal-alpha telegraph, origin palette/shape override, non-color attack shape, reduced-motion static boundary, room loading group, provenance, and in-game event QA. Pairing does not permit reuse of one unrelated cast animation across all actions.

### Witch boss

The Witch also requires `ANM-WIT-IDLE-MOVE`, `ANM-WIT-HIT-LIGHT`, and `ANM-WIT-HIT-HEAVY` base clips. Idle/movement preserve bilateral control; hit clips show direction and severity without Elowen-style tendrils; heavy resistance may suppress displacement but never the readable impact pose.

| ID | Boss action/body contract | Telegraph/socket | VFX / non-color / reduced motion |
| --- | --- | --- | --- |
| `ANM-WIT-VOLLEY` / `VFX-WIT-VOLLEY` | Disciplined projectile volley | Ring; both focus hands | Closed radial spokes; projectile release at body `C` |
| `ANM-WIT-FAN` / `VFX-WIT-FAN` | Controlled projectile fan | Cone; casting focus | Symmetrical fan construction; static fan boundary reduced |
| `ANM-WIT-LANCE` / `VFX-WIT-LANCE` | Precise lance | Lane; focus/hand | Narrow sealed lane and release; no violet Elowen language |
| `ANM-WIT-SLAM` / `VFX-WIT-SLAM` | Dueling slam | Circle; weapon/limb contact | Body impact and closed shock ring |
| `ANM-WIT-DASH` / `VFX-WIT-DASH` | Controlled dash attack | Lane; root/weapon | Prepared movement, travel, braced recovery |
| `ANM-WIT-TELEPORT` / `VFX-WIT-TELEPORT` | Teleport | Origin/destination root | Closed seal collapse/re-form; static paired seals reduced |
| `ANM-WIT-WELL` / `VFX-WIT-WELL` | Containment well | Circle; casting focus + world pivot | Ordered closed field, normal-alpha boundary |
| `ANM-WIT-SUMMON` / `VFX-WIT-SUMMON-ACTION` | Ordered summon | Focus + spawn roots | Body command gesture and clean spawn seals |
| `ANM-WIT-PHASE-2` / `VFX-WIT-PHASE-2` | Keeper to Containment Breach | Root/crown/focus | Distinct body transition, ordered seal failure, music event handoff |
| `ANM-WIT-PHASE-3` / `VFX-WIT-PHASE-3` | Containment Breach to Last Measure | Root/crown/focus | Faster guard reset and controlled desperation; no particle storm |
| `ANM-WIT-DEFEAT` / `VFX-WIT-DEFEAT` | Wounded, final acceptance, death | Root/focus | Body resolves before clean origin dismissal; no detached collapse effect |

Each boss row requires paired `VFX-WIT-<action>` with Witch palette, closed geometry, normal-alpha telegraph boundary, and explicit phase loading. Phase 3 VFX shortens learned patterns rather than adding unreadable density. Summon pressure is dismissed or sharply reduced as required by the finished phase design.

## 7. Environment, portal, reward, HUD, and ending effects

| ID | Coverage/event | Pivot/export | Palette / accessibility / reduced motion |
| --- | --- | --- | --- |
| `VFX-ENV-HAZARD` | Every environmental hazard family; `T<C<R` matches damage | Authored world pivot; code/atlas | Danger boundary plus unique shape/pattern; static boundary reduced |
| `VFX-PORTAL-DESCENT` | Room/floor portal open, ready, traverse, close | Portal world center; code/atlas | Gold history plus biome field; ring state/arrow cue; freeze large motion reduced |
| `VFX-REWARD-DROP` | Reward reveal/availability/collect | Reward root/HUD target | Gold with category icon/shape; opacity handoff reduced |
| `UI-HARVEST-METER` | Three segments, empty-floor grant, gain, ready, spend, cap | Top-left HUD; `UI` | Green plus scythe icon, segment count/shape, label; restrained state reduced |
| `UI-CHARGE-PERFECT` | Hold/toggle charge tiers and perfect window | HUD plus actor | Gold/cyan with notch/pulse; static border state reduced |
| `VFX-END-WITCH-CLEANUP` | Dismiss Witch actors/effects after death | All Witch-origin roots | Ordered inward closure; origin identity not color-only |
| `VFX-END-ELO-INSTABILITY` | Preserve Elowen actors/effects and increase instability | Elowen roots/world layers | Broken spiral/branch, controlled density; static fracture reduced |
| `UI-END-RING-COUNTDOWN` | One five-second nonnumeric decision window | Screen center; code-native SVG/UI | Circular ring depletion plus fracture/state; no plain number; opacity/line state reduced |
| `VFX-END-KILL` | Ending strike contact and branch resolution | Zephyr blade + Elowen contact | Body-synchronized contact; no independent projectile |
| `VFX-END-TIMEOUT` | Timeout instability and branch resolution | Elowen/world roots | Increasing asymmetry without flash violation; stepped static states reduced |
| `VFX-END-FADE` | Controlled fade to black before post-ending UI | Full screen | `void-950`; opacity-only, idempotent resolution |

## 8. Menu, navigation, and UI-art coverage

Menu art is produced only after the canonical character direction passes. Text, buttons, focus, loading, and error states remain code-native.

| ID | Coverage | Export/layers | Required QA |
| --- | --- | --- | --- |
| `MENU-TITLE-BASE` | Animated painterly title composition | `BG`; foreground/midground/background separated | Zephyr/scythe/ring identity; desktop/mobile crop; provenance |
| `MENU-TITLE-RING` | Ring illumination/title motif | Transparent layer/code treatment | On/off/ready state; non-color luminance/shape; reduced static glow |
| `MENU-TITLE-PARTICLES` | Restrained atmosphere | Pooled/code or transparent atlas | Fixed cap; removable in reduced motion/effects settings |
| `MENU-TRANSITION-SCYTHE` | Scythe-cut authored transition | Code mask plus optional atlas | Transform/opacity only; ≤120ms opacity reduced alternative |
| `MENU-CONTINUE` | Continue destination when valid suspend exists | Code-native `UI` | Hidden when invalid; focus, loading, error |
| `MENU-NEW-DESCENT` | Primary action to difficulty screen | Code-native `UI` | Strongest hierarchy; never starts run directly |
| `MENU-DIFFICULTY` | Dedicated pre-run difficulty selection | Code-native `UI` plus approved ornament | Keyboard/mouse/controller/touch; readable behavior descriptions |
| `MENU-RECORDS` | Lifetime Records destination | Code-native `UI` | Empty/populated/reset states; high UI scale |
| `MENU-GLOSSARY` | Locked/unlocked glossary destination | Code-native `UI` | Lock not color-only; completion-only unlock semantics |
| `MENU-SETTINGS` | Settings destination | Code-native `UI` | Focus order; live scale/contrast/reduced-motion preview |
| `MENU-CREDITS` | Credits and attribution destination | Code-native `UI` | Complete licenses; scroll/focus/mobile |
| `MENU-QUIT` | Quit where supported | Code-native `UI` | Hidden when unsupported; confirmation and focus return |
| `MENU-LOAD-ERROR` | Loading and error presentation | Code-native `UI` plus shared ornament | Clear progress/error/retry; state not opacity-only |

## 9. Representative samples and integration records

| ID | Required file | Acceptance evidence |
| --- | --- | --- |
| `SMP-ZEP-CONCEPT` | `docs/art-samples/zephyr-concept-variants.png` | Three controlled variants; 160px silhouette; face/ring/scythe anchors |
| `SMP-ELO-CONCEPT` | `docs/art-samples/elowen-concept-variants.png` | Three variants across human/mid/full corruption; identity continuity |
| `SMP-WIT-CONCEPT` | `docs/art-samples/witch-concept-variants.png` | Three ordered variants; distinct from Elowen and Zephyr |
| `SMP-VN-SCENE` | `docs/art-samples/vn-scene-sample.png` | Desktop/mobile composition, text-safe region, contrast |
| `SMP-MENU` | `docs/art-samples/menu-sample.png` | Primary-action negative space, parallax layers, reduced-motion state |
| `SMP-COMBAT-VFX` | `docs/art-samples/combat-vfx-sample.png` | Origin grammar in color/grayscale; event stages; blend intent |
| `SMP-GAMEPLAY` | `docs/art-samples/gameplay-integration-sample.png` | Orthographic 3D continuity; body/VFX/telegraph readability |

All seven files exist, passed primary review, and were approved by the user on 2026-07-18. The character boards record the selected anchors: Zephyr C/right, Elowen A/left, and Witch B/center. None is a runtime master; production proceeds only through the bounded exact-file waves and validation gates in `docs/PRODUCTION_PASS.md`.

## 10. Retained legacy files and QA release

The existing `title-art.webp`, `dungeon-stone.webp`, both portrait WebPs, `enemy-archetypes.webp`, all four decal sheets, `princess-world.webp`, `queen-world.webp`, and `combat-vfx.webp` still have unknown provenance. They are retained only because deletion was not authorized and are not licensed, runtime-loaded, or release assets. The former `princess-world.webp` runtime use was replaced by the approved Elowen A human cutout; the four decal sheets were replaced by deterministic code-native geometry. A runtime-source search on 2026-07-18 found no loads of any of these WebPs; the release-packaging test intentionally names them as denied files, and the production build excludes them. Any future reuse reopens the provenance and integration gates.

An asset reaches `released` only when:

1. Its canonical dependency is approved.
2. Its event/socket contract is numeric and matches mechanics.
3. Master/export/provenance records are complete.
4. Automated loading and state checks pass where applicable.
5. Primary review inspects the diff and the asset itself.
6. Running-game visual review passes at required desktop/mobile/accessibility states.
7. For actions, actor animation, VFX, hit window, audio event, and recovery agree.
8. The release state and evidence links are recorded without overwriting or deleting the legacy asset.
