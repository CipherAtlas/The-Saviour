# Reaper of the Hollow Crown — Art Production Pass

Status: approved art direction, representative samples, production, and runtime integration. The user approved the direction, canonical selections, representative package, and full asset production on 2026-07-18. Existing files were not deleted, moved, or renamed.

## 1. Purpose and entry rules

This pass records the bounded visual-production workflow used for the approved product specification. `DIRECTIONS.md`, `Instructions.md`, `docs/ART_DIRECTION.md`, and `docs/ASSET_MATRIX.md` control the work in that order. Future replacement waves remain subject to exact path ownership and review.

Art, narrative, combat, input, audio, and UI work may overlap only after their shared interfaces and entry criteria are approved. No specialist may infer a new story beat, character identity, combat event, font license, or asset right.

### Current state

- Art-direction bible: approved 2026-07-18.
- Asset matrix: approved 2026-07-18.
- Zephyr canonical design: variant C, right column, selected 2026-07-18.
- Elowen canonical design: variant A, left column, selected 2026-07-18.
- Witch canonical design: variant B, center column, selected 2026-07-18.
- Seven representative samples: produced, primary reviewed, and user approved 2026-07-18.
- Full narrative production: completed and integrated — 26 current-wave character PNGs, three accepted Wave 2 character states, and 41 narrative-background PNGs.
- Runtime legacy migration: completed without deleting baseline files. The approved Elowen A human cutout replaces `princess-world.webp`, and code-native geometry replaces the four legacy decal sheets.
- Unknown-provenance legacy WebPs: retained unreferenced because deletion was not authorized; they are not licensed or release assets.

## 2. Ownership and execution contract

Before every editing wave, the primary owner records:

| Field | Required value |
| --- | --- |
| Deliverable ID | Stable across retries. |
| Specialist | One named owner; replacement recorded if execution 3 is needed. |
| Paths | Exact files or narrow non-overlapping glob. |
| Operation | Create, edit, or read-only review. |
| Approval source | User message or approved milestone reference. |
| Baseline | Existing/untracked/modified status before work. |
| Start state | Entry checks and dependencies. |
| Runtime ceiling | Ten minutes by default; longer only with a written bounded asset-operation reason. |
| Checkpoint | At or before half the runtime ceiling. |
| Attempt | Execution 1, 2, or 3; maximum three total. |
| Release state | In progress, review, accepted, failed, blocked, or released. |

Rules:

- Editing ownership never overlaps. Reviewers may inspect any deliverable read-only.
- A task fails at its runtime ceiling; elapsed time does not reset the attempt count.
- Failed output is inspected before retry. The next contract records the observed failure and one targeted correction.
- Execution 3 uses a replacement specialist. There is no fourth attempt.
- A specialist completion claim is not acceptance. The primary owner inspects the artifact, verifies paths and provenance, and performs the stated checks.
- Shared-interface changes stop dependent work until the contract is updated and affected tasks are reassessed within their existing attempt budgets.

## 3. Production waves

### Wave 0 — Direction and contracts

Owner: art director/documentation owner.

Owned paths:

- `docs/ART_DIRECTION.md`
- `docs/ASSET_MATRIX.md`
- `docs/PRODUCTION_PASS.md`

Exit criteria:

1. Exact palette, origin grammar, character invariants, VN/UI/VFX/export rules, accessibility, provenance, and migration policy are complete.
2. The asset matrix covers every required principal state, story scene, player/enemy/boss action, effect, menu destination, and representative sample.
3. The user explicitly approves the document revision and the next exact production paths.

### Wave 1 — Three-specialist representative sample wave

The wave uses exactly three editing specialists. Each sample file is owned by one specialist and receives its own stable deliverable ID, ten-minute ceiling, five-minute checkpoint, and maximum of three executions.

| Specialist role | Deliverable IDs and exclusive paths | Success condition |
| --- | --- | --- |
| Character concept specialist | `ART-SMP-ZEP-001` → `docs/art-samples/zephyr-concept-variants.png`; `ART-SMP-ELO-001` → `docs/art-samples/elowen-concept-variants.png`; `ART-SMP-WIT-001` → `docs/art-samples/witch-concept-variants.png` | Three controlled variants per principal; stable identity anchors; no false canonical selection. |
| Combat VFX specialist | `ART-SMP-VFX-001` → `docs/art-samples/combat-vfx-sample.png` | Zephyr/Witch/Elowen shape, timing, blend, body-event, grayscale, and reduced-motion intent are distinct. |
| Scene and integration specialist | `ART-SMP-VN-001` → `docs/art-samples/vn-scene-sample.png`; `ART-SMP-MENU-001` → `docs/art-samples/menu-sample.png`; `ART-SMP-GAME-001` → `docs/art-samples/gameplay-integration-sample.png` | VN, menu, and orthographic gameplay samples share palette/light/material rules and preserve UI/readability zones. |

The art director and animation/visual-consistency auditor remain read-only during Wave 1. They review the full set after all three owners release their paths.

Wave 1 is sequential at its character dependency:

1. **Wave 1A:** the character concept specialist produces only the three concept boards. Primary review inspects them, then the user selects one canonical design per principal.
2. **Wave 1B:** only after those selections, the combat-VFX and scene/integration specialists produce their four boards using the selected concept images as identity references. The character specialist has no edit ownership in Wave 1B.

Wave 1 exit criteria:

1. All seven exact PNGs exist and were visually inspected at original resolution.
2. Every prompt's must-have and avoid constraints pass or the attempt is recorded as failed.
3. Concepts are compared at 160px silhouette size, in grayscale, and under common color-vision simulations.
4. VN and menu compositions pass 1920×1080 and 390×844 crop checks.
5. The gameplay sample is compared against an actual running-game capture; it is not accepted as an isolated illustration.
6. The Wave 1A character selections remain recorded, and the user explicitly approves the four representative integration samples.

### Wave 2 — Vertical slice

This wave begins only after Wave 1 approval and separate exact-file authorization. It proves the direction through one narrow runtime path before mass production:

- One Witch floor-projection VN scene with approved cutouts, expression change, background layers, text-safe area, desktop/mobile crops, and reduced motion.
- Zephyr's Reaper's Claim throw, outbound travel, hit, pull/resist, recall, catch, and empowered follow-up with the physical scythe, complete body animation, event-driven VFX, audio-event hooks, controller/keyboard/touch feedback, and Harvest HUD handoff.
- One Witch-origin summon/dismiss lifecycle and one Elowen-origin unstable summon/defeat lifecycle in the same representative chamber.
- One menu/title composition using approved hierarchy, ring illumination, parallax layers, loading/error states, and reduced motion.

Wave 2 exit criteria are defined in Section 8.

### Wave 3 — Full asset production

The user opened this wave after approving the art direction, canonical selections, and representative samples. Production used coordinated specialists with non-overlapping ownership:

1. Art direction and consistency owner.
2. Character portrait, expression, and VN-cutout owner.
3. Combat VFX and atlas owner.
4. Environment, story-background, menu, and UI-art owner.
5. Animation integration and visual-QA owner.

The completed wave stayed within `docs/ASSET_MATRIX.md` and produced the 26 current-wave character cutouts and 41 current backgrounds recorded in `public/assets/LICENSES.md`. Runtime mappings are data-driven in `src/game/narrativeAssetManifest.js`; the three accepted Wave 2 character states remain additive. This record does not promote the blocked menu cutout or the two undersized background candidates.

## 4. Shared sample constraints

These constraints apply verbatim to all seven prompts:

- Illustrated-gothic tragic fantasy; painterly illustrative realism for narrative art; readable low-poly diorama treatment for gameplay integration.
- Controlled chiaroscuro, shared warm high key from camera-right/front, subdued cool rim from camera-left/back, and restrained palette from `docs/ART_DIRECTION.md`.
- Preserve human faces, natural hands and grips, plausible materials, deliberate negative space, and a clear focal hierarchy.
- Do not include embedded words, UI copy, logos, watermarks, signatures, unrelated heraldry, modern objects, guns, sci-fi interface language, anime/cel shading, glossy plastic, generic rainbow neon, crushed-black focal faces, excessive bloom, or a generic dominant-purple wash.
- Do not depict a projectile, slash, spell, or detached effect as the actor's action while the actor is idle or in an unrelated pose.
- Do not add unapproved characters, props, story revelations, or character-specific physical traits beyond the locked brief.

Concept-board columns are positional: left=A, center=B, right=C. Do not render letters or labels inside the image. Review annotations are added outside the art, not baked into it.

## 5. Final representative-sample prompts

### `ART-SMP-ZEP-001` — `zephyr-concept-variants.png`

```text
Use case: stylized-concept
Asset type: principal game character concept review board
Output intent: 2048x1536 PNG saved exactly as docs/art-samples/zephyr-concept-variants.png
Primary request: three tightly controlled design variants of Zephyr, the same powerful but punishable reaper prince, for canonical selection
Scene/backdrop: plain warm-charcoal studio field with a faint neutral ground shadow and no scenery
Subject: the same adult male face, build, blackened plate armor, raised or open-faced story helmet, restrained torn oxblood mantle, visible wedding ring, and one consistent long crescent scythe in all three columns; variant A changes only helmet-crown architecture, variant B changes only mantle cut, variant C changes only armor-ornament density; gold core and restrained cyan power seams
Style/medium: painterly illustrative-realism character concept art with simplified material planes and visible midtone brushwork
Composition/framing: landscape 4:3 review board, three equal full-body three-quarter views, feet and entire scythe visible, matching scale and neutral stance; small face, ring-hand, and scythe-head detail insets aligned beneath each figure; left=A, center=B, right=C without labels
Lighting/mood: warm high key from camera-right/front, subdued cool rim from camera-left/back, grounded and tragic rather than triumphant
Color palette: #09080D, #F4EAD7, #D9AA52, #FFD985, #74E2FF, #28798D, restrained oxblood cloth
Materials/textures: rough blackened steel, worn leather, woven mantle, localized polished blade and wedding ring
Constraints: same identity, proportions, ring hand, scythe profile, armor center line, and shoulder angle in every variant; face fully visible; readable silhouette at 160px; generous margins; no embedded text
Avoid: closed anonymous story helmet, hidden face, floating scythe, implausible grip, oversized shoulders, sexualized armor, purple magic, skull overload, extra fingers or limbs, photoreal rendering, unrelated props
```

Acceptance: exactly three controlled variants; same face/build/ring/scythe; face visible; all silhouettes readable at 160px; gold/cyan does not resemble Elowen corruption; no variant is marked canonical before user selection.

### `ART-SMP-ELO-001` — `elowen-concept-variants.png`

```text
Use case: stylized-concept
Asset type: principal game character progression concept review board
Output intent: 3072x2048 PNG saved exactly as docs/art-samples/elowen-concept-variants.png
Primary request: three tightly controlled Elowen design variants, each showing the same woman at human baseline, a controlled midpoint, and fully corrupted endpoint
Scene/backdrop: plain warm-charcoal studio field with no scenery or story reveal props
Subject: the same adult female face, eye spacing, hairline, proportions, wedding-ring hand, and core garment neckline in every cell; human baseline wears ivory, oxblood, and restrained gold with a soft enclosed vertical silhouette; midpoint introduces one coherent asymmetric breach and branching intrusion; fully corrupted endpoint uses broken spirals, tendrils, violet/magenta fractures, and open negative space while preserving her recognizable face and ring hand; columns A/B/C vary only garment architecture and the path corruption takes through it
Style/medium: painterly illustrative-realism character concept art with controlled brushwork and natural facial acting
Composition/framing: landscape 3:2 review board arranged as three columns and three rows, columns left=A center=B right=C without labels, rows top=human middle=midpoint bottom=fully corrupted; matching full-body three-quarter framing, scale, pose family, and lighting; feet and hands visible
Lighting/mood: warm-neutral human key that becomes increasingly asymmetric and underlit only down the progression; tragic possession, not monster spectacle
Color palette: human #F4EAD7, oxblood, #D9AA52; corruption #7E4FA3, #D06CC9, #351641; no dominant violet in the human row
Materials/textures: woven ceremonial cloth, aged gold, natural hair and skin, corruption like invasive root and fractured mineral rather than smoke-only aura
Constraints: identity must remain stable in all nine cells; human row contains no skulls, undead anatomy, violet flame, necromantic aura, or explicit source clue; endpoint remains capable of a believable lucid human return; readable silhouette progression in grayscale; no embedded text
Avoid: generic princess redesign between cells, face drift, changing ethnicity or age, erased ring hand, replacement monster head, sexualized costume, generic evil sorceress, symmetrical corruption, extra limbs or fingers, unrelated props
```

Acceptance: three variants × three states; stable identity; human baseline does not expose necromancy; corruption advances through silhouette and negative space rather than color alone; final state preserves the final-plea face and ring.

### `ART-SMP-WIT-001` — `witch-concept-variants.png`

```text
Use case: stylized-concept
Asset type: principal game character concept review board
Output intent: 2048x1536 PNG saved exactly as docs/art-samples/witch-concept-variants.png
Primary request: three tightly controlled variants of the same extremely ancient Witch whose visual power is ordered containment rather than generic villainy
Scene/backdrop: plain deep-charcoal studio field with a restrained complete containment circle behind each figure
Subject: the same severe ancient female face, narrow approximately eight-head proportion, bilateral architectural silhouette, containment crown, repeated vertical robe or armor panels, and precise casting focus; variant A changes crown architecture, variant B changes shoulder and robe panel rhythm, variant C changes casting-focus construction; ivory, desaturated steel, and dark blue-charcoal replace dominant violet
Style/medium: painterly illustrative-realism character concept art, simplified material planes, selective sharp edges at face hands crown and focus
Composition/framing: landscape 4:3 review board, three equal full-body three-quarter views, matching scale and controlled clinical stance, feet hands and focus visible; face crown and focus detail insets; left=A center=B right=C without labels
Lighting/mood: cold-neutral frontal definition with a warm distant key and regular subdued rim; clinical, ancient, tragic, and controlled
Color palette: #09080D, #D7E4E8, #7093A0, #263840, restrained aged #D9AA52 only for history/crown detail
Materials/textures: matte layered cloth, brushed ritual steel, pale stone or pearl-like containment insets, localized aged gold
Constraints: bilateral and closed shapes; recognizable face; no dominant violet; silhouette distinct from Zephyr's diagonal crescent and Elowen's broken tendrils; no embedded text
Avoid: generic evil queen, skull regalia, chaotic spikes, exposed heart, purple flame, seductive pose, sexualized armor, ragged necromantic tendrils, exaggerated particle aura, extra limbs or fingers
```

Acceptance: exactly three controlled variants; ordered containment reads in grayscale; no Elowen visual language; ancient clinical character remains human-readable rather than a decorative villain archetype.

### `ART-SMP-VN-001` — `vn-scene-sample.png`

```text
Use case: illustration-story
Asset type: full-screen visual-novel staging sample
Output intent: 1920x1080 PNG saved exactly as docs/art-samples/vn-scene-sample.png
Input images: Image 1 selected Zephyr concept anchor; Image 2 selected Witch concept anchor; use both as identity references, not edit targets
Primary request: the threshold confrontation between Zephyr and the Witch as a production composition sample without dialogue text
Scene/backdrop: layered gothic dungeon threshold with foreground stone and chain silhouettes, a readable middle-stage floor, and deep containment architecture; no Elowen imagery or reveal clue
Subject: selected canonical Zephyr cutout staged on the left with visible face, raised helmet, ring hand, and grounded scythe; selected canonical Witch projection staged on the right with a precise containment gesture; both actors visibly perform their gesture
Style/medium: painterly illustrated-gothic visual-novel scene, controlled depth and selective brush detail
Composition/framing: 16:9 1920x1080 composition, large cutouts at 72–90% frame height, faces in upper 55%, at least 8% separation between speaking faces, bottom 28% deliberately quiet for a real code-rendered text box, small empty nameplate zone and control-safe corners, no baked UI or words
Lighting/mood: warm high key on Zephyr, cold-neutral ordered definition on the Witch, subdued cool rim, tense but readable threshold atmosphere
Color palette: shared void/ink/ring palette; Zephyr gold/cyan; Witch ivory/steel; no dominant violet
Materials/textures: rough blackened plate, worn stone, matte projection body with precise luminous line work
Constraints: desktop composition must admit a 390x844 crop by independently repositioning characters; faces, expressive hands, ring, scythe, and text-safe area remain separable; no embedded text
Avoid: small square portraits, centered modal panel, bright arch behind a face, Witch as purple evil queen, detached magic without casting gesture, excessive fog, background detail competing with text
```

Acceptance: desktop and mobile crop proof; bottom text region stays unobstructed; faces/gestures separate from background by value and edge; no pre-reveal leakage; code-native UI can overlay without repainting art.

### `ART-SMP-MENU-001` — `menu-sample.png`

```text
Use case: ui-mockup
Asset type: animated painterly main-menu composition sample without rendered interface text
Output intent: 1920x1080 PNG saved exactly as docs/art-samples/menu-sample.png
Input images: Image 1 selected Zephyr concept anchor; use as an identity reference, not an edit target
Primary request: a distinctive Reaper of the Hollow Crown title composition built around wedding-ring illumination, a scythe-cut diagonal, and the descent into a gothic containment domain
Scene/backdrop: deep layered gothic interior with separable foreground, middle chamber, and distant threshold; restrained dust and fog layers suitable for subtle parallax
Subject: the selected canonical Zephyr silhouette and physical scythe integrated into the right half, paired rings as a small luminous focal motif, no Witch or Elowen reveal portrait
Style/medium: painterly illustrated-gothic menu keyframe with strong editorial hierarchy and tactile material depth
Composition/framing: 16:9 1920x1080, right-weighted visual mass, 40–45% quiet negative space on the left for code-rendered title and primary navigation, safe center crop for 390x844, separable parallax layers, no baked buttons or words
Lighting/mood: restrained warm ring light against cool deep space, deliberate negative space, solemn invitation rather than battle poster
Color palette: #09080D, #040407, #F4EAD7, #D9AA52, #FFD985, restrained #74E2FF and oxblood
Materials/textures: worn stone, blackened steel, soft cloth, aged gold ring, subtle fixed grain
Constraints: ring remains a secondary motif, primary-action area is the highest readable UI zone once overlaid, title and navigation can remain code-native, reduced-motion version works as a static frame
Avoid: generic centered logo over wallpaper, portal queen reveal, dominant purple, excessive particles, fake buttons, embedded text, symmetrical empty poster layout, modern interface decoration
```

Acceptance: primary-action overlay area is strongest and uncluttered; desktop/mobile safe compositions exist; foreground/midground/background can move independently; static reduced-motion frame preserves hierarchy.

### `ART-SMP-VFX-001` — `combat-vfx-sample.png`

```text
Use case: stylized-concept
Asset type: combat VFX language and timing review board
Output intent: 2048x1536 PNG saved exactly as docs/art-samples/combat-vfx-sample.png
Input images: Image 1 selected Zephyr concept anchor; Image 2 selected Witch concept anchor; Image 3 selected Elowen concept anchor; Image 4 current gameplay capture for scale only; preserve character/origin identity without copying legacy effect style
Primary request: one coherent contact sheet proving distinct Zephyr, Witch, and Elowen effect languages plus body-event synchronization
Scene/backdrop: neutral #09080D grid field with no scenery and generous separation between effect families
Subject: top row Zephyr three-hit crescent progression, charge start and tier accumulation, perfect-release ring, and Reaper's Claim throw travel hit pull recall catch follow-up; middle row Witch closed summon seal, ward, projectile geometry, and clean dismissal; bottom row Elowen broken summon spiral, invasive corruption, unstable attack residue, and torn defeat; each sequence shows anticipation shape, contact or release frame, and decay silhouette beside a small grayscale duplicate
Style/medium: painted game VFX concept sheet with crisp readable cores, controlled particles, and explicit normal-alpha body versus additive luminous core
Composition/framing: landscape 4:3 board, three horizontal origin bands, evenly spaced sequences, clear black-free silhouettes suitable for later transparent extraction, no labels or words
Lighting/mood: luminous effects on a neutral dark review field; no scene lighting contamination
Color palette: Zephyr #D9AA52 #FFD985 #74E2FF #E3FBFF; Witch #D7E4E8 #7093A0 #263840; Elowen #7E4FA3 #D06CC9 #351641; danger and impact accents only where mechanically required
Constraints: Zephyr uses crescents and forward wedges, Witch uses complete circles grids and radial spokes, Elowen uses broken spirals branches and torn shards; every attack sequence begins at a visible limb weapon or focus marker and includes anticipation contact decay; readable in grayscale; restrained reduced-motion counterpart implied by static line state
Avoid: black matte as runtime assumption, circular explosion for every action, detached free-standing attacks, identical purple effects for Witch and Elowen, excessive bloom, clipped frames, visual clutter, text or watermark
```

Acceptance: all three origins identifiable without color; Claim stages complete; blend intent evident; effect never stands in for body pose; no black-matte dependency advances to runtime production.

### `ART-SMP-GAME-001` — `gameplay-integration-sample.png`

```text
Use case: stylized-concept
Asset type: representative gameplay integration target
Output intent: 1920x1080 PNG saved exactly as docs/art-samples/gameplay-integration-sample.png
Input images: Image 1 selected Zephyr concept anchor; Image 2 selected Witch concept anchor; Image 3 selected Elowen concept anchor; Image 4 current running-game capture as camera, scale, and low-poly environment reference, not an edit target
Primary request: one readable dark gothic combat chamber showing the approved hybrid direction at actual gameplay scale
Scene/backdrop: stylized low-poly dungeon arena using broad stone planes, restrained props, navigable floor boundaries, controlled fog, and no false hazards
Subject: Zephyr at center-left physically performing a scythe contact pose with attached gold/cyan trail; one ordered Witch-origin enemy with a complete geometric telegraph; one unstable Elowen-origin enemy with asymmetric corruption; one objective or portal marker; body poses, weapon contacts, telegraphs, and effects agree
Style/medium: readable stylized 3D diorama target with painterly color and light direction, not a cinematic splash illustration
Composition/framing: 16:9 1920x1080, orthographic high three-quarter gameplay camera matching the existing game, actor sizes and HUD-safe edges representative of 1280x720 play, small inset showing the same state with reduced particles and no camera motion
Lighting/mood: existing ACES-like warm key from camera-right/front, subdued cool rim from camera-left/back, biome fog one value group below active actors
Color palette: shared void/ink/ring palette; Zephyr gold/cyan; Witch ivory/steel closed geometry; Elowen violet/magenta broken geometry; danger red only on true hazards
Materials/textures: low-poly rough stone, roughness-forward armor and cloth, localized metal on blade ring and ritual fixtures, emissive only at semantic seams and contact points
Constraints: actors, hazard, telegraph, objective, and floor edge remain separable; attack performed by body and weapon; all major cues remain distinct in grayscale; restrained particle density; no baked HUD text
Avoid: low cinematic camera, photoreal environment, dense props hiding lanes, unreadable particle storm, idle actor with detached slash, all-purple scene, full-screen bloom, false floor hazards, unrelated enemies or props
```

Acceptance: compared side-by-side with a running-game capture at 1280×720; actor/telegraph/hazard/objective separation passes; 3D materials and VN palette feel related without imitating painterly cutouts; reduced-motion inset preserves mechanics.

## 6. Evaluation and retry ledger

Create one ledger row per execution. Never erase failed rows.

| Deliverable ID | Execution | Specialist | Start/end | Outcome | Failure category and evidence | Targeted correction | Reviewer | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ART-SMP-ZEP-001` | 1/3 | Character concept specialist | 2026-07-18; completed 13:14 IST | Failed | Process/tooling: initial conflicting task wording caused baked A/B/C glyphs; a local crop removed them outside the prescribed image-edit path | Use the untouched source as an edit reference; remove only glyphs; preserve composition; copy the new output unchanged | Primary owner | Superseded by execution 2 |
| `ART-SMP-ELO-001` | 1/3 | Character concept specialist | 2026-07-18; completed 13:18 IST | Failed | Scope/layout: output contained three human/corrupted pairs, omitting the required midpoint row | Require an exact regular 3×3 contact sheet, nine complete figures, clean human row, midpoint row, corrupted row | Primary owner | Superseded by execution 2 |
| `ART-SMP-WIT-001` | 1/3 | Character concept specialist | 2026-07-18; completed 13:20 IST | Accepted; variant B selected | Native review resolution and opaque separable field; no canon, identity, anatomy, text, or style failure | None for identity selection; rebuild a production master only after the sample gate | Primary owner | Use center-column anchor in Wave 1B |
| `ART-SMP-ELO-001` | 2/3 | Character concept specialist | 2026-07-18; completed 13:25 IST | Accepted; variant A selected | Exact 3×3 progression passes; bottom-left endpoint is slightly less invaded than its peers but remains visibly later than midpoint | No further retry; selected low-density shoulder-to-side corruption path remains canonical | Primary owner | Use left-column anchor in Wave 1B |
| `ART-SMP-ZEP-001` | 2/3 | Character concept specialist | 2026-07-18; completed 13:27 IST | Accepted; variant C selected | Controlled edit removed all glyphs and preserved the visual design; native review resolution and opaque field remain | No further retry; production export remains gated by the sample gate | Primary owner | Use right-column anchor in Wave 1B |
| `ART-SMP-VFX-001` | 1/3 | Combat VFX specialist | 2026-07-18; failed before generation | Failed | Environment/tooling: the specialist's isolated Browser context reported no available browser, so the required live-game scale reference could not be captured; no image was generated and no file changed | Move execution 2 to the primary context, capture the running game in memory, and use that capture with all three selected anchors | Primary owner | Superseded by execution 2 |
| `ART-SMP-GAME-001` | 1/3 | Scene and integration specialist | 2026-07-18; failed before generation | Failed | Environment/tooling: the specialist's isolated Browser context reported no available browser at the required live-reference checkpoint; no image was generated and no file changed | Move execution 2 to the primary context and retain the running 1280×720 capture as an in-memory scale/camera reference | Primary owner | Superseded by execution 2 |
| `ART-SMP-VN-001` | 1/3 | Scene and integration specialist | 2026-07-18; completed before 14:00 IST | Failed | Composition: native 1672×941 source left only about 12–14% clear at the bottom rather than the required uninterrupted 28% dialogue-safe band | Reframe both actors higher/smaller and require all detailed art to end above 72% of canvas height; use built-in image generation/editing only | Primary owner | Superseded by execution 2 |
| `ART-SMP-VFX-001` | 2/3 | Primary owner, environment recovery | 2026-07-18; completed 14:06 IST | Accepted; user approved 2026-07-18 | Native 1448×1086 review passes three distinct origin bands, body-event attachment, Claim stages, grayscale duplicates, reduced-motion intent, and no text or detached attacks | No retry; keep as a representative board, not a runtime atlas | Primary owner | Use as production reference through exact-file waves |
| `ART-SMP-MENU-001` | 1/3 | Scene and integration specialist | 2026-07-18; completed 14:07 IST | Accepted; user approved 2026-07-18 | Native 1672×941 review passes selected Zephyr identity, physical scythe grip, paired-ring secondary motif, layered depth, approximately half-frame quiet navigation space, mobile reframe, and static reduced-motion hierarchy | No retry; retain code-native title, navigation, focus, and motion layers during runtime production | Primary owner | Use as production reference through exact-file waves |
| `ART-SMP-GAME-001` | 2/3 | Primary owner, environment recovery | 2026-07-18; completed 14:10 IST | Accepted; user approved 2026-07-18 | Native 1672×941 target was compared side by side with the running 1280×720 boss chamber; orthographic scale, navigable lanes, Zephyr body/contact, ordered Witch telegraph, unstable Elowen manifestation, objective, and reduced-particle inset pass | No retry; runtime implementation remains gated by Wave 2 authorization | Primary owner | Use as production reference through exact-file waves |
| `ART-SMP-VN-001` | 2/3 | Scene and integration specialist | 2026-07-18; completed 14:13 IST | Accepted; user approved 2026-07-18 | Corrected native 1672×941 source ends actor and detailed scene art by approximately 61–64%; the full-width 72–100% band is uninterrupted and dark; selected identities, natural opposing gestures, face/hand/weapon readability, mobile reframe, and no-reveal constraints pass | No retry; keep dialogue UI code-native and preserve layer independence in runtime production | Primary owner | Use as production reference through exact-file waves |

### Wave 1A provenance and resolution record

These are concept-selection boards, not runtime masters. The production target
dimensions in Section 5 remain the eventual master/export contract; the review
tool returned native 1536×1024 PNGs, which are sufficient for identity and
direction selection but must not be promoted directly into runtime cutouts.

| Deliverable | Workspace master | SHA-256 | Creation / modification record | Rights and attribution record |
| --- | --- | --- | --- | --- |
| `ART-SMP-ZEP-001` | `docs/art-samples/zephyr-concept-variants.png` | `062a4a45b5e09d554ae07a391112fdb16a85fabb5a4a44d7ea3661b52bc5d1b4` | Original project concept; execution 2 used the untouched first source as a controlled edit reference, then copied the accepted output unchanged | Original project production; no external source art or third-party attribution dependency recorded |
| `ART-SMP-ELO-001` | `docs/art-samples/elowen-concept-variants.png` | `d6a4a5dd93c58b5aa15a9511c9515ac2cff52acf6dfe714ccc9b550e3b22bdce` | Original project concept; execution 2 replaced the rejected six-figure layout with a new nine-figure board and was copied unchanged | Original project production; no external source art or third-party attribution dependency recorded |
| `ART-SMP-WIT-001` | `docs/art-samples/witch-concept-variants.png` | `9505d15195fd200e6d1a1b13b0b55e03c35c77e2fec7deaf2d17eb22cff1e51b` | Original project concept; accepted first output copied unchanged | Original project production; no external source art or third-party attribution dependency recorded |

### Wave 1B provenance, resolution, and QA record

These files are representative direction targets, not runtime masters. Native production dimensions differ from the eventual export contracts in Section 5; every accepted source was copied unchanged, and each repository hash matches its accepted source hash.

| Deliverable | Workspace file | Native dimensions | SHA-256 | Primary evidence | Rights and attribution record |
| --- | --- | --- | --- | --- | --- |
| `ART-SMP-VN-001` | `docs/art-samples/vn-scene-sample.png` | 1672×941 RGB PNG | `4ca0fb04c84077973a9ca3db4248b5696a30545e4ffd6b95ecbefe2653ca7587` | Native inspection; full-width bottom 28% dialogue-safe; 390×844 Zephyr and Witch reframe proofs preserve faces and gestures | Original project production; no external source art or third-party attribution dependency recorded |
| `ART-SMP-MENU-001` | `docs/art-samples/menu-sample.png` | 1672×941 RGB PNG | `98651eaa8c01073e78754f23d0a0e927dc5ff80fed96364d53a1b3a7a9008ddb` | Native inspection; left navigation field and right subject survive independent 390×844 reframes; static frame preserves hierarchy | Original project production; no external source art or third-party attribution dependency recorded |
| `ART-SMP-VFX-001` | `docs/art-samples/combat-vfx-sample.png` | 1448×1086 RGB PNG | `1c2adb416ecc6a4704cdb05814949db5038297be7ab1da2a684ab8a1edc5d815` | Native inspection; origin grammar remains identifiable by crescents, closed geometry, or broken branches without color; grayscale/reduced strip remains legible | Original project production; no external source art or third-party attribution dependency recorded |
| `ART-SMP-GAME-001` | `docs/art-samples/gameplay-integration-sample.png` | 1672×941 RGB PNG | `aab00672df6554b738678dfda6abb0db9a4af9740ab937712e71de5d0c3a36c4` | Native inspection and in-memory side-by-side comparison with the running 1280×720 boss chamber; actor scale, camera, lanes, telegraph, objective, and reduced-particle state pass | Original project production; no external source art or third-party attribution dependency recorded |

The three character boards were also reviewed at 160-pixel silhouette scale, in grayscale, and under protanopia, deuteranopia, and tritanopia simulations. Character and transformation states remain separable by silhouette, value grouping, garment geometry, halo/scythe profile, and corruption topology rather than hue alone.

### Wave 2 raster-production ledger

The user authorized the six exact runtime paths and the three production-record
edits on 2026-07-18. Each producer had non-overlapping path ownership, a
ten-minute hard checkpoint, measurable acceptance, and no more than three
executions. Existing assets were not overwritten, moved, renamed, or deleted.

| Deliverable ID | Execution | Specialist | Outcome | Evidence / correction |
| --- | --- | --- | --- | --- |
| `ART-W2-VN-BG-001` | 1/3 | VN environment specialist | Candidate; dimensional gate failed | Empty Floor-1 containment background passes canon, composition, and dialogue-safe checks at 1672×941; below the 1920×1080 `BG` minimum. |
| `ART-W2-VN-BG-001` | 2/3 | VN environment specialist | Failed dimensional correction | A content-preserving higher-resolution request again returned 1672×941. No workspace overwrite occurred. The first visual candidate is retained but not released. |
| `ART-W2-VN-CHAR-001` | 1/3 | Character production specialist | Failed orientation | Zephyr identity/anatomy/scythe/padding passed, but head and torso read nearly frontal instead of camera-right. No workspace file was created. |
| `ART-W2-VN-CHAR-001` | 2/3 | Character production specialist | Timed out after targeted correction | Corrected Zephyr source passed right-facing nose, gaze, sternum, hips, lead-foot, identity, and handedness checks; Witch states and alpha conversion did not finish before the hard ceiling. |
| `ART-W2-VN-CHAR-001` | 3/3 | Replacement character specialist | Accepted | Reused the corrected Zephyr source, created both Witch states, converted all three cutouts, and passed identity, anatomy, complete-prop, transparent-border, coverage, and dark/light fringe checks. |
| `ART-W2-MENU-001` | 1/3 | Menu-art specialist | Partial; Zephyr alpha failed | Title background accepted at native 1672×941. Zephyr identity/anatomy/composition passed, but the converted cutout retained green on thin edges. |
| `ART-W2-MENU-001` | 2/3 | Menu-art specialist | Failed targeted matte contraction | One-pixel contraction left contamination and measurably eroded the alpha bounds. The candidate was kept outside the workspace. |
| `ART-W2-MENU-001` | 3/3 | Replacement character specialist | Blocked | A magenta-key edit preserved the subject, but bounded extraction/validation did not finish in the specialist window. Primary inspection of the prescribed extraction found magenta fringe and broad color damage. The existing menu cutout remains blocked; no fourth execution is allowed. |

| Workspace asset | Dimensions / alpha | SHA-256 | Release state |
| --- | --- | --- | --- |
| `public/assets/vn/floor01-witch-projection-bg.png` | 1672×941 RGB | `34633bdae805436e313352c7a5e7bb831f59e69f6189dbaf4274f58fc1122c23` | Retained unreferenced candidate; below the layered-master size gate |
| `public/assets/vn/zephyr-c-determined.png` | 1024×1536 RGBA | `5d42987989b9cd1702bc26ec9233883807ca41226141775153c6fd47132aeb0b` | Accepted and runtime-referenced |
| `public/assets/vn/witch-b-clinical.png` | 864×1821 RGBA | `06163bad693c46be87afcb407556d0d6f75f1e531582d3590eb418d46f304f9f` | Accepted and runtime-referenced |
| `public/assets/vn/witch-b-containment-gesture.png` | 1024×1536 RGBA | `f1adb1582f9626b6b1c1ac0b8d9c3492452e480a61543d12b6fec0877af6cdaa` | Accepted and runtime-referenced |
| `public/assets/menu/title-bg-01.png` | 1672×941 RGB | `3e2ed44b8e4e4bf70693ff8d24cfb6d4a0564f18252b74fbf0a9006527ed68d9` | Retained unreferenced candidate; below the layered-master size gate |
| `public/assets/menu/zephyr-c-title.png` | 1024×1536 RGBA | `009baec6bffe925819ccf1aa116589faaa39363803eecb6166252a1d9be36011` | Blocked from runtime by edge contamination |

This Wave 2 ledger remains the historical record of the first vertical-slice
attempt. Later approved production closed the integration gap without promoting
failed candidates: the three accepted character cutouts are runtime-referenced,
the blocked title cutout remains unreferenced, and current scenes/title use the
separately approved background wave. Final manual, accessibility, audio, and
performance results remain recorded by their dedicated QA artifacts rather than
being inferred from this raster ledger.

Evaluation order:

1. Confirm exact output path and no unowned changes.
2. Inspect original resolution for subject, composition, anatomy, hands/grips, edge quality, text/watermark absence, and must-avoid constraints.
3. Compare identity-sensitive output with approved anchors.
4. Review 160px silhouette, grayscale, and color-vision simulations.
5. Review required desktop/mobile/reduced-motion crops or gameplay scale.
6. Check provenance record and master/export readiness.
7. Classify failure as scope, canon, visual quality, animation, licensing, integration, tooling, timeout, or environment.

Retry rules:

- Execution 2 changes only the proven failure cause and repeats every invariant.
- If execution 2 fails, the primary owner records why the correction was insufficient.
- Execution 3 goes to a replacement specialist with the same stable deliverable ID, prior evidence, and a narrowed correction.
- After execution 3, the deliverable is accepted, blocked with evidence, or redesigned through a separately approved plan. There is no automatic fourth execution.

## 7. Legacy migration map

No row authorizes overwrite, removal, move, or rename. Existing assets remain user-owned baseline until a separately approved migration wave.

| Current asset | Current use | Provenance | Proposed successor/decision | Safe transition |
| --- | --- | --- | --- | --- |
| `public/assets/title-art.webp` | Unreferenced retained file | Unknown; not licensed | Current title uses `dungeon-threshold.png` and `zephyr-c-determined.png` | Retain unused; provenance required before any future reuse |
| `public/assets/princess-portrait.webp` | Unreferenced retained file | Unknown; not licensed | Current dialogue uses approved Elowen A cutouts | Retain unused; provenance required before any future reuse |
| `public/assets/evil-queen-portrait.webp` | Unreferenced retained file | Unknown; not licensed | Current dialogue uses approved Witch B cutouts | Retain unused; provenance required before any future reuse |
| `public/assets/sprites/princess-world.webp` | Former world sprite; runtime reference removed | Unknown; not licensed | `elowen-a-human.png` is loaded for the ending/world representation | Retain unused; denied by release packaging |
| `public/assets/sprites/queen-world.webp` | Unreferenced retained file | Unknown; not licensed | Current Witch presentation uses the licensed model/code-native presentation | Retain unused; provenance required before any future reuse |
| `public/assets/sprites/enemy-archetypes.webp` | Unreferenced retained file | Unknown; not licensed | Existing licensed actor models and code-native origin treatments remain active | Retain unused; provenance required before any future reuse |
| `public/assets/vfx/combat-vfx.webp` | Unreferenced retained file; no alpha | Unknown; not licensed | Current combat VFX are code-native | Retain unused; do not treat its black matte as alpha |
| `public/assets/sprites/keep-decals.webp` | Former runtime decal; reference removed | Unknown; not licensed | Deterministic `keep-ward` geometry | Retain unused; denied by release packaging |
| `public/assets/sprites/ossuary-decals.webp` | Former runtime decal; reference removed | Unknown; not licensed | Deterministic `ossuary-reliquary` geometry | Retain unused; denied by release packaging |
| `public/assets/sprites/foundry-decals.webp` | Former runtime decal; reference removed | Unknown; not licensed | Deterministic `foundry-vent` geometry | Retain unused; denied by release packaging |
| `public/assets/sprites/void-court-decals.webp` | Former runtime decal; reference removed | Unknown; not licensed | Deterministic `void-rune` geometry | Retain unused; denied by release packaging |
| `public/assets/dungeon-stone.webp` | Unreferenced retained file | Unknown; not licensed | Licensed dungeon models and materials remain active | Retain unused; provenance required before any future reuse |
| `public/assets/models/characters/knight.glb` | Zephyr gameplay model | KayKit CC0 documented | Retarget/augment or replace only after animation and concept compatibility review | Preserve working model; add compatible clips/material changes in approved wave |
| Skeleton character GLBs | Current enemy models | KayKit CC0 documented | Retain/augment through origin materials and complete action animation | Preserve files; validate every action and origin treatment |
| Dungeon environment GLBs | Current environment | KayKit CC0 documented | Retain as low-poly diorama foundation | Preserve files; adjust only through approved material/light integration |

For any new external asset, record creator, authoritative source, exact license, redistribution/modification terms, source URL, acquisition terms, modifications, and attribution before integration. Ambiguous, non-commercial, non-redistributable, contradictory, or missing terms fail the asset.

## 8. Vertical-slice gate

The slice passes only with recorded evidence for every item:

Current disposition: production and runtime integration are complete. The accepted Zephyr/Witch cutouts, current 26-state character wave, 41-background wave, code-native combat presentation, responsive VN/menu UI, and procedural biome decals are integrated without loading a blocked candidate or unknown-provenance WebP. Automated and running-game acceptance evidence is maintained by the dedicated test and manual-QA records; this section remains the visual integration checklist.

### Identity and composition

- Approved Zephyr face, armor, scythe, and ring match concept, VN cutout, and gameplay model adaptation.
- Approved Witch face/crown/focus match concept, projection, and boss actor adaptation.
- The VN scene passes 1920×1080 and 390×844 with text contrast, focus order, hide-UI, typewriter, auto, backlog, and reduced motion.

### Claim and body/VFX synchronization

- Zephyr visibly grips, throws, remains unarmed, recalls, catches, and follows with the physical scythe.
- Animation events drive outbound damage, recall damage, light-enemy pull, heavy/boss resist/poise, catch, and empowered follow-up.
- Gold/cyan VFX originate at scythe/ring/contact sockets and never resemble Elowen corruption.
- Harvest spend/gain and HUD state agree with action timing and remain readable without color.
- Keyboard, controller, and touch use the same action semantics.

### Enemy-origin integration

- Witch-origin summon, idle treatment, attack, defeat, and clean dismissal use ordered body animation and closed geometry.
- Elowen-origin summon, idle treatment, attack, defeat, and preserved post-Witch instability use asymmetric body/VFX behavior.
- Origin metadata survives enemy, projectile, hazard, combat-event, cleanup, and statistic paths.
- A representative authored clash is readable but cannot expose Elowen by name before the reveal.

### Menu and runtime quality

- Menu hierarchy, difficulty transition, loading, error, desktop/mobile, input focus, and reduced motion pass in the running game.
- No unbounded particle, number, or animated-layer increase breaks documented performance budgets.
- Assets preload/stream according to their loading groups without visible wrong-state flashes.
- No console errors, missing files, black sprite mattes, clipped cutouts, or unlicensed assets appear.
- Primary review records actual visual/gameplay inspection; compilation alone is insufficient.

## 9. Full-production gate record

The user opened Wave 3 on 2026-07-18 after approving the art direction, canonical character selections, representative samples, and use of those samples for all required assets. The following conditions remain the durable acceptance contract for this completed wave and any future extension:

1. The user explicitly approves a named revision of `docs/ART_DIRECTION.md`, `docs/ASSET_MATRIX.md`, and this file.
2. The seven representative PNGs pass the evaluation matrix.
3. The user explicitly selects one canonical Zephyr, Elowen, and Witch design.
4. The user explicitly approves the VN, menu, combat-VFX, and gameplay-integration samples.
5. Narrative/canon review confirms no pre-reveal leakage and approves the Elowen corruption progression.
6. The vertical slice in Section 8 passes automated, running-game, desktop/mobile, reduced-motion, accessibility, audio-event, and performance checks.
7. Every production row has exact owner, path, body events, socket/pivot, export, non-color cue, reduced-motion behavior, loading group, and provenance status.
8. Every retained or new external asset has authoritative rights evidence and attribution.
9. The ownership ledger is conflict-free and the next exact file operations have user approval.
10. The primary owner independently inspects and accepts the evidence.

## 10. No-deletion and release policy

- Do not delete, move, rename, overwrite, or silently repurpose any existing asset during concept, sample, vertical-slice, or mass-production work.
- New assets use new stable filenames until integration and replacement are verified.
- Replacing a runtime reference requires a separately approved implementation wave, a rollback path to the old reference, and running-game validation.
- Deleting a superseded file requires separate explicit approval after all references are removed, provenance/attribution obligations are preserved, and both runtime and repository searches confirm it is unused.
- A visually superior replacement is not sufficient grounds for deletion. Recoverability and user ownership remain controlling.
