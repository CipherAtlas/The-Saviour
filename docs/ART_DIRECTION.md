# Reaper of the Hollow Crown — Art Direction

Status: approved production bible. The user approved the selected character anchors and representative-sample package on 2026-07-18. Asset production remains governed by the exact-file wave and review gates in `docs/PRODUCTION_PASS.md`.

## 1. Authority and locked constraints

`DIRECTIONS.md` is authoritative. `Instructions.md` supplies the preserved narrative spine except where `DIRECTIONS.md` explicitly supersedes it. The following constraints are immutable during this production pass:

- The product is an illustrated-gothic hybrid: painterly narrative, menu, and ending art joined to readable stylized 3D gameplay presented as a dark gothic diorama.
- Zephyr sincerely believes Elowen was abducted. Visuals may foreshadow divided control, but may not reveal Elowen as the source before the post-Witch reveal.
- Zephyr uses gold/cyan power language. Elowen's explicit necromantic corruption owns violet/magenta. Witch containment must remain visually ordered and distinct from both.
- Zephyr's face is visible in visual-novel scenes. His story art uses an open-faced or raised helmet, keeps the wedding ring legible when framing permits, and matches the gameplay armor and scythe.
- Every gameplay action is visibly performed by the actor. VFX may emphasize anticipation, contact, release, and recovery; it may never replace body animation.
- No spoken dialogue, breaths, efforts, or combat barks are part of this pass.
- Existing art remains in place until a replacement is approved, integrated, and verified. Deletion always requires separate authorization.
- External assets require proven redistribution and modification rights plus a complete entry in `public/assets/LICENSES.md`.

## 2. Visual thesis

The visual thesis is **love held inside a machine built to survive grief**. The work should feel intimate before it feels spectacular. Every layer uses the same three visual pillars:

1. **Tragic intimacy:** visible faces, readable hands, rings, restrained gestures, human-scale light, and negative space around decisions.
2. **Ordered containment:** bilateral structures, closed circles, repeated verticals, matte stone and steel, and light that clarifies rather than dazzles.
3. **Corrupt possession:** broken circles, invasive branching, asymmetric growth, unstable negative space, and light that appears to come from beneath the surface.

The narrative layer carries brushwork, facial acting, and controlled detail. The gameplay layer reduces those ideas into silhouette, material, light, and motion that remain legible at combat scale. Coherence comes from shared rules rather than identical rendering.

### Negative definition

The game is not generic purple dark fantasy, photoreal horror, high-saturation arcade neon, ornate visual noise, anime cel shading, plastic 3D, or a collection of unrelated dramatic illustrations. Gothic ornament is structural and sparse. Spectacle never obscures input, timing, or expression.

## 3. Canonical palette and semantic ownership

All values are sRGB hex. Values may be shaded by scene lighting, but their semantic ownership cannot be reassigned.

| Token | Value | Owner and use |
| --- | --- | --- |
| `void-900` | `#09080D` | Primary canvas and gameplay night field. |
| `void-950` | `#040407` | Deep fade and maximum separation. |
| `panel-900` | `#110E16` | Opaque-equivalent panel base; runtime may use 94% alpha. |
| `ink-100` | `#F4EAD7` | Primary dialogue and UI text. |
| `ink-300` | `#D5C9B4` | Long-form secondary copy. |
| `ink-500` | `#B7A990` | Muted labels only; never the sole critical cue. |
| `ring-500` | `#D9AA52` | Marriage, crown history, borders, and Zephyr's gold core. |
| `ring-300` | `#FFD985` | Focus, active ring light, perfect timing, and highlighted gold. |
| `ring-700` | `#8F6938` | Inactive gold, aged metal, and completed meter segments. |
| `zephyr-300` | `#74E2FF` | Zephyr power edge, movement, and Harvest readiness. |
| `zephyr-100` | `#E3FBFF` | Zephyr contact core and strongest readable highlight. |
| `zephyr-700` | `#28798D` | Zephyr power shadow and inactive cyan. |
| `harvest-300` | `#C9FFD9` | Harvest ready highlight and accessible high-value edge. |
| `harvest-500` | `#65D98A` | Harvest segment fill and dedicated touch action. |
| `harvest-700` | `#287A50` | Inactive/earned-segment shadow; never the sole state cue. |
| `witch-200` | `#D7E4E8` | Witch containment core, clean runes, and projection highlights. |
| `witch-500` | `#7093A0` | Witch ordered secondary light and defensive fields. |
| `witch-800` | `#263840` | Witch field body and dark geometric structure. |
| `elowen-500` | `#7E4FA3` | Elowen corruption body. |
| `elowen-300` | `#D06CC9` | Elowen unstable edge and exposed corruption. |
| `elowen-800` | `#351641` | Elowen corruption shadow and residue. |
| `danger-500` | `#B83F53` | Health loss, universal danger, and ending urgency. |
| `danger-300` | `#DF5A68` | Immediate danger highlight. |
| `impact-400` | `#FFB15C` | Heavy/critical contact accent; not an origin identity. |

### Semantic combinations

- **Zephyr:** `ring-500` core plus `zephyr-300` edge. White is reserved for a brief contact peak. Never use violet in his base kit.
- **Harvest:** `harvest-500` fill with a scythe-segment shape, label/icon, and one/two/three-segment structure. Claim itself remains Zephyr gold/cyan; green communicates the earned resource, not the thrown weapon's origin.
- **Witch:** `witch-200` core, `witch-500` body, and `witch-800` structure. Thin, regular geometry distinguishes her from Zephyr even where both appear cool.
- **Elowen:** `elowen-500` body plus `elowen-300` unstable edge and `elowen-800` residue. Violet may appear in environments, but explicit tendril/broken-spiral behavior identifies her control.
- **Danger:** red must be paired with a hazard shape, icon, line pattern, or temporal pulse. It cannot be the only warning channel.
- **Ring/crown gold:** shared gold expresses love, office, and history. Context and shape determine ownership; gold alone never identifies an origin.

### Biome fields

The current biome fields remain valid atmosphere anchors:

| Biome | Sky | Fog | Key | Accent |
| --- | --- | --- | --- | --- |
| Forgotten Keep | `#090C12` | `#111823` | `#FFD49A` | `#4C9BD6` |
| Ossuary of Saints | `#070D0F` | `#102226` | `#E7D6AD` | `#55C4BF` |
| Ember Foundry | `#120806` | `#2B120D` | `#FFB15C` | `#FF4D1F` |
| Court Beyond the Veil | `#090511` | `#1B0D28` | `#F0C6FF` | `#A64DFF` |

Biome accent is environmental. Actor origin, telegraph, hit, Harvest, and Claim effects retain their semantic palette. In the Void Court, Elowen effects must separate through brighter hot-magenta edges, broken geometry, and active motion rather than color alone.

## 4. Lighting, value, and contrast

### Shared light logic

- Primary key: warm-neutral, high and 35–45 degrees camera-right/front.
- Secondary rim: cool, subdued, camera-left/back. It separates silhouettes without outlining every edge.
- Faces, hands, ring, active weapon edge, and the current narrative focal object receive the sharpest value separation.
- Background focal contrast must remain at least one value group below the active face or combat actor.
- Fog groups distance; it cannot flatten telegraphs, hazards, or navigable floor edges.

### Narrative lighting

- Domestic scenes use warm key, low contrast at the eyes, and soft falloff. Concealed unease appears through framing and gesture, not violet underlight.
- Witch projections use cold-neutral frontal definition with a regular rim and no dominant violet wash.
- Elowen corruption introduces asymmetric underlight only after the approved progression permits it.
- A character's face must retain a readable eye line and mouth shape at the final VN crop.
- Text regions use a controlled scrim. Body text targets WCAG contrast 4.5:1; large display text and essential graphical boundaries target at least 3:1.

### Gameplay lighting

Preserve the existing ACES Filmic pipeline and exposure `1.05` unless measured integration evidence justifies a change. The current warm directional key and cool rim are the baseline. Character or VFX additions must be tested in all four biome fields rather than tuned only in the Void Court.

Use three value groups at gameplay scale:

1. Floor and noninteractive environment: darkest, lowest local contrast.
2. Actors and traversal boundaries: mid-value, distinct silhouettes.
3. Active telegraph, contact, objective, and interactable: highest local contrast for the required duration.

## 5. Painterly rendering rules

- Use illustrative realism with simplified forms and visible midtone brushwork. Preserve material planes rather than airbrushing every transition.
- Hardest edges belong to the active face, eyes, hands, ring, weapon contact, or current story object. Secondary costume edges are mixed; background contours are lost or softened.
- Detail density follows narrative importance: face/hands/ring/weapon first, silhouette breakpoints second, fabric/armor motifs third, background ornament last.
- Skin keeps natural texture and temperature variation without photoreal pore rendering. Metal uses broad planar reflections with selective sharp nicks. Cloth uses directional folds, not texture noise.
- Avoid uniform edge sharpness, uniform micro-detail, glossy skin, black-crushed faces, excessive bloom, and decorative particles with no story or gameplay function.

## 6. Stylized 3D diorama rules

### Camera and scale

- Gameplay stays orthographic with the existing high three-quarter pitch and aim look-ahead. Concept samples must match that projection rather than a low cinematic action camera.
- Read all action silhouettes at the minimum supported gameplay scale. Weapon arcs and casting limbs must remain outside the torso mass at anticipation and contact.
- Environment props may frame lanes but cannot create false hazards or hide telegraph rims.

### Materials

- Preserve low-poly faceting and broad material groups.
- Default roughness target: `0.55–0.85`. Use values below `0.35` only for small wet corruption, polished blade, ring, or ritual-metal accents.
- Metalness is localized to armor, scythe, ring, chains, and ritual fixtures. Stone, bone, leather, cloth, and most corruption remain nonmetallic.
- Emissive is limited to semantic seams, eyes where canon permits, contact points, containment glyphs, and corruption fractures. Large emissive surfaces require gameplay-scale readability evidence.
- Texture detail must not erase silhouette or compete with telegraph geometry. Prefer hue/value blocking over dense surface noise.

## 7. Character silhouette and proportion system

All principal concept boards use consistent front, three-quarter, and side measurements before pose production. On 2026-07-18 the user selected Zephyr variant C (right), Elowen variant A (left), and Witch variant B (center) as the canonical identity anchors for representative-sample production. These selections approve identity direction, not mass production or direct promotion of the review boards to runtime masters.

### Zephyr

- Proportion: heroic but human, approximately 7.5 heads tall; broad shoulder mass with a visible waist and grounded boots.
- Primary silhouette: inverted triangle crossed by a long diagonal crescent scythe.
- Identity anchors: same adult face, raised/open story helmet, blackened plate, restrained oxblood mantle, gold/cyan seams, wedding ring, and one canonical crescent-blade profile.
- Selected anchor: variant C, the right-column concept. Preserve its higher armor-ornament density, narrow torn oxblood mantle, visible severe face, crown profile, ring hand, and crescent scythe as one identity system.
- Story armor and gameplay armor may simplify differently, but share helmet brow, shoulder angle, breastplate center line, mantle attachment, scythe head, and ring hand.
- He must read powerful while anticipation and recovery expose punishable weight. No floating weapon, oversized pauldrons that hide the face, or anonymous closed helm in VN scenes.

### Elowen

- Proportion: approximately 7.25 heads tall with an initially soft, enclosed, vertical silhouette.
- Identity anchors across all states: face, eye spacing, hairline, ring hand, core garment neckline, and overall height.
- Human baseline uses ivory, oxblood, and restrained gold. It contains no explicit necromantic aura, skull motif, violet flame, or visible undead anatomy.
- Four transition stages progressively break bilateral balance, open negative space, and introduce branching intrusion. Each stage must be distinguishable in silhouette and grayscale, not only by added violet.
- Fully corrupted Elowen remains recognizably the same person. Corruption cannot become a generic monster replacement that erases the final lucid return.
- Selected anchor: variant A, the left-column progression. Preserve its ivory/oxblood/gold garment architecture and the asymmetric corruption path beginning at the shoulder and advancing down one side while face, hairline, proportions, and ring hand remain stable.

### The Witch

- Proportion: approximately 8 heads tall, narrow and vertically dominant.
- Primary silhouette: bilateral, architectural, closed, and still. Repeated vertical panels and complete circular containment forms replace ragged tendrils.
- Identity anchors: same ancient severe face, containment-crown architecture, shoulder/robe rhythm, casting focus, and ivory/steel/dark palette.
- Selected anchor: variant B, the center-column concept. Preserve its stepped shoulder construction, centered circular containment crown, repeated vertical panel cadence, severe ancient face, and integrated elongated casting focus.
- Avoid skull regalia, exposed-heart clichés, dominant violet, chaotic spikes, sexualized armor, and generic evil-queen posing. Her threat comes from control and age.

## 8. Origin grammar

| Origin | Shape | Timing | Surface behavior | Motion signature | Audio handoff note |
| --- | --- | --- | --- | --- | --- |
| Zephyr | Crescent, forward wedge, paired ring | Fast anticipation, decisive contact, clean recovery | Gold core/cyan edge, sparse white peak | Sweeps toward aim, recalls along a readable path | Clear transient plus controlled tail. |
| Witch | Closed circle, grid, radial spoke, vertical seal | Measured build, exact lock, clean dismissal | Ivory/steel, even line weight, low residue | Symmetrical convergence and ordered collapse | Precise, dry, restrained resonance. |
| Elowen | Broken spiral, branching tendril, torn shard | Irregular acceleration, secondary twitch, lingering residue | Violet/magenta with dark body | Asymmetric propagation, reverse pull, unstable decay | Layered unstable tail without voices. |

Enemy origin must be visible in summon, idle accent, attack anticipation, projectile/hazard, defeat, dismissal, and post-Witch cleanup. Zephyr may perceive the inconsistency without identifying Elowen before the reveal.

## 9. Visual-novel composition

### Masters and staging

- Background master: 16:9, authored at 1920×1080 or larger with foreground, midground, and background separation.
- Cutout master: transparent, 1600–2400 pixels high, full body including feet and all extended gestures.
- Character height in a 16:9 scene: 72–92% of frame. Face remains within the upper 55%; feet may fall behind the text box but remain in the source master.
- Text-safe region: bottom 24–30%. Do not place a face, ring gesture, weapon contact, or story-critical object behind it.
- Desktop staging uses left, center, and right thirds. Maintain at least 8% frame separation between speaking faces where two cutouts overlap.
- Use controlled background families and graded variants. Do not create a new unrelated rendering language for each of the 29 upgrade scenes.

### Mobile crop

Every scene receives a 390×844 crop proof. Mobile may reposition and scale layers independently; it may not simply center-crop the desktop composite. Preserve the active face, expressive hand/weapon, nameplate, body text, and controls. At least 24 CSS pixels remain between interactive controls and safe-area edges.

### Expressions and poses

Pose and expression changes attach to dialogue beats. A new expression must change brows, eyes, mouth, head angle, or tension meaningfully; color grading alone is not an expression. Mirror support must be validated for handed props, ring placement, scythe direction, text, asymmetrical damage, and lighting before use.

### Background/character/text separation

- Do not place a bright arch, window, or VFX core directly behind a face or nameplate.
- Use value, temperature, edge, and depth separation; a blur filter alone is insufficient.
- Background animation is limited to independently controllable layers: fog, candle/fire, dust, projection instability, ring light, and restrained parallax.
- Reduced motion freezes parallax and large drift while retaining static depth and necessary state changes.

## 10. UI typography, ornament, and interaction

### Typography

No new font is approved. Retain licensed system stacks:

- Display and names: `"Bodoni 72", Didot, "Palatino Linotype", Georgia, serif`.
- UI and long-form copy: `"Avenir Next", "Century Gothic", "Trebuchet MS", sans-serif`.

Minimum dialogue size is 20 CSS pixels on desktop and 18 CSS pixels on mobile at UI scale 1.0. Body line height is 1.45–1.65. All-caps is limited to labels, names, and short actions with `0.08–0.18em` tracking. Never set paragraphs in blackletter, script, or all caps.

### Hierarchy and ornament

- Primary actions use gold value contrast, placement, and scale; destructive ending actions use danger red plus explicit wording and shape.
- Ornament uses thin gold rules, broken-circle/ring motifs, restrained diamond terminals, and scythe-cut diagonals. It cannot reduce text width below comfortable reading or imitate focus rings.
- Cards and panels use nested value planes or fine inner highlights rather than generic gray outlines and heavy shadows.
- Focus-visible treatment: 2 CSS pixel `ring-300` outline, 3 CSS pixel offset, and a simultaneous non-color change such as underline, inset marker, or shape shift.
- Minimum touch target: 44×44 CSS pixels. Loading, disabled, invalid, and error states must remain visually distinct without relying on opacity alone.

### Motion

Use transform and opacity for UI transitions. Default authored curve: `cubic-bezier(0.32, 0.72, 0, 1)`. Short confirmation: 120–180ms; panel/scene reveal: 320–520ms; title parallax settle: 600–900ms. Reduced motion uses ≤120ms opacity changes and removes parallax, shake, blur interpolation, and large positional travel.

## 11. VFX and action synchronization

### Non-negotiable action contract

Every asset brief records these actor events:

1. **Anticipation start:** body, weapon, limb, or casting focus prepares the action.
2. **Telegraph readable:** gameplay warning reaches required shape/value before damage.
3. **Contact/release:** damage, projectile, heal, pull, or state change fires at the matching animated event.
4. **Sustain/return:** only where mechanics require travel, pull, channel, or recall.
5. **Recovery complete:** actor visibly exits commitment and regains legal control.

VFX origin is a named animated socket or recorded world pivot. A screen flash, ground sprite, projectile, trail, or camera shake cannot satisfy a missing actor event. If the rig lacks a required motion, the animation is authored or retargeted before the action ships.

### Geometry, blend, and density

- Additive blending is reserved for luminous cores, short trails, and contact peaks. Smoke, corruption body, debris, shadows, and readable fill use normal alpha.
- A telegraph uses normal alpha for its body/rim so it remains legible against bright floors. Additive bloom cannot be the only boundary.
- Effects expose a clear leading edge, contact center, and decay direction. Avoid circular explosions for every action.
- Major hit hierarchy comes from synchronized body pose, one primary shape, one secondary fragment family, sound, and bounded camera trauma—not from uncontrolled particle count.
- Color values are sampled from the semantic palette. Per-biome grading may shift luminance by at most one value group while preserving origin identity.

### Reduced motion and flash reduction

- Replace large radial expansion with a restrained line-weight or opacity state change.
- Replace repeated shake with one static directional emphasis and persistent mechanical marker.
- Replace rapid flicker with a single rise/hold/fall whose full-screen luminance change does not flash more than three times per second.
- Keep hit confirmation, perfect-window state, hazard boundary, Harvest availability, Claim trajectory, and ending deadline mechanically clear.

## 12. Sprite, master, and export rules

### Source masters

- Retain layered/editable masters when available. Preserve uncropped character bodies and effect overscan.
- Concept/review boards export as PNG in `docs/art-samples/`.
- Runtime cutouts and effects require validated alpha. Do not ship black-matte sprite sheets.
- Every export has an asset-matrix row and provenance record before integration.

### Runtime exports

| Asset | Master/export rule |
| --- | --- |
| Story background | 1920×1080 minimum master; runtime WebP; no baked UI text. |
| VN cutout | 1600–2400px high transparent master; runtime alpha WebP or PNG after edge validation. |
| Portrait crop | Derive from canonical cutout/face master; do not repaint identity. |
| Menu art | 1920×1080 layered master; separable foreground/midground/background for parallax. |
| VFX atlas | Maximum 2048×2048; transparent; power-of-two preferred; 8px cell padding and 2px edge extrusion. |
| UI icon | 128×128 or 256×256 master; verify at 24 and 32 CSS pixels. |

Default VFX cadence is 12fps. A brief contact burst may use 18fps when it materially improves timing. Mechanical contact uses the animation event time, not a presumed frame number. Atlas origin is normalized bottom-center for ground effects, center for radial effects, or the documented weapon/socket contact point for attached effects.

Naming:

- `char_<character>_<state>_<pose>_<variant>`
- `bg_<location>_<state>_<variant>`
- `vfx_<origin>_<action>_<phase>_<variant>_<frame>`
- `ui_<system>_<function>_<state>`
- `anim_<actor>_<action>_<phase>`

No spaces, dates, `final`, or ambiguous numeric-only filenames.

### Loading groups

- Boot: title/menu base, shared UI ornament, loading/error assets.
- Pre-run: difficulty art and Zephyr combat-critical model/animation/VFX.
- Room/floor: current biome and origin-specific encounter assets.
- Narrative scene: current background, active cutouts, next scene's required expression set.
- Finale: Witch death, reveal, both ending branches, and glossary completion art preloaded before boss resolution.

## 13. Reusable briefs and negative constraints

Every production brief must include: stable asset ID; intended scene/action; canon timing; subject; silhouette; palette role; material; lighting; camera/framing; body-animation event contract; socket/pivot; output/master requirements; accessibility cue; reduced-motion version; references by role; provenance; and acceptance evidence.

Universal negative constraints:

- No text, logo, watermark, signature, or unrelated heraldry baked into raster art.
- No unapproved principal-character redesign, face drift, costume drift, scythe drift, or ring-hand drift.
- No dominant purple outside approved Elowen corruption or environmental context.
- No generic skull-and-spike shorthand for the Witch.
- No sexualized armor, implausible weapon grip, extra limbs/fingers, hidden story faces, or unreadable hands.
- No modern objects, guns, sci-fi interface language, glossy plastic, excessive bloom, crushed-black focal features, or neon rainbow effects.
- No detached VFX performing an action while its actor is idle or in an unrelated pose.
- No unique unrelated rendering style for a single scene, upgrade, or menu destination.
- No ambiguous licensing or unrecorded source material.

## 14. Accessibility and readability acceptance

- Text contrast: 4.5:1 minimum; large text and essential boundaries: 3:1 minimum.
- Critical state is communicated through at least two of color, shape, position, label/icon, line pattern, motion, or sound.
- Character and VFX samples receive grayscale review plus simulated common color-vision-deficiency review.
- Harvest availability, perfect release, Witch/Elowen origin, telegraph type, blocked/critical/heavy hit, and ending urgency remain distinguishable without color.
- Desktop review: 1920×1080 and 1280×720. Mobile review: 390×844. Minimum supported viewport, high UI scale, high contrast, reduced motion, and flash reduction each receive recorded evidence.
- Visual review includes actual running-game inspection. Compilation and isolated asset review are not sufficient.

## 15. Existing-art migration and provenance

`public/assets/LICENSES.md` documents the KayKit CC0 character/dungeon GLBs, project-original VN/menu production, and the disposition of retained legacy files. The twelve legacy WebPs below have no authoritative rights record, are not runtime-referenced, and are excluded from production builds:

- `public/assets/title-art.webp`
- `public/assets/dungeon-stone.webp`
- `public/assets/princess-portrait.webp`
- `public/assets/evil-queen-portrait.webp`
- `public/assets/sprites/enemy-archetypes.webp`
- `public/assets/sprites/princess-world.webp`
- `public/assets/sprites/queen-world.webp`
- `public/assets/sprites/keep-decals.webp`
- `public/assets/sprites/ossuary-decals.webp`
- `public/assets/sprites/foundry-decals.webp`
- `public/assets/sprites/void-court-decals.webp`
- `public/assets/vfx/combat-vfx.webp`

The released title uses `dungeon-threshold.png` and the approved Zephyr C/right cutout; current Witch B/center and Elowen A/left production preserves their distinct palettes and silhouettes. Approved character/background art, code-native VFX, and procedural decals replaced all former runtime uses without deleting the retained files. Release packaging and provenance tests fail if a denied file is reintroduced.

The completed migration order was: provenance audit; art-bible and canonical-character approval; representative VN/menu/VFX/gameplay samples; vertical-slice integration under new filenames; running-game identity/readability/performance/desktop/mobile validation; runtime reference replacement; production denylisting. Deletion remains separately permissioned and was not performed.

## 16. Review matrix and mass-production gate

| Area | Passing evidence |
| --- | --- |
| Character concepts | Three controlled variants per principal; identity anchors stable; silhouette readable at 160px; one variant explicitly selected by the user. |
| Palette | Exact tokens used; Zephyr/Witch/Elowen remain distinguishable in grayscale by shape and timing. |
| VN | 1920×1080 and 390×844 crops preserve face, gesture, text-safe region, and contrast. |
| Menu | Primary action is the strongest interactive hierarchy; desktop/mobile/reduced-motion compositions pass. |
| VFX | Transparent export, no clipped cells, declared blend and pivot, correct body event, readable gameplay-scale contact. |
| Gameplay | Actor, telegraph, target, hazard, and objective remain distinct at 1280×720 in every biome. |
| Coherence | Face, costume, scythe, ring, palette, and light match concept, VN, and 3D adaptations. |
| Provenance | Creator/source/rights/modifications/attribution fields complete; no ambiguous terms. |
| Integration | Representative assets inspected in the running game; automated checks plus visual evidence recorded. |

Mass production is forbidden until all of the following are true:

1. The user explicitly approves a specific revision of this art-direction file.
2. The user inspects three controlled variants for Zephyr, Elowen, and the Witch and selects one canonical design for each.
3. The VN, menu, combat-VFX, and gameplay-integration samples pass the review matrix and receive explicit approval.
4. `docs/ASSET_MATRIX.md` has complete coverage, event/socket contracts, export rules, non-color cues, reduced-motion alternatives, loading groups, and provenance status.
5. The narrative/canon owner confirms that concept and sample art does not reveal Elowen early.
6. One vertical slice proves concept-to-VN-to-3D identity plus body-animation/VFX synchronization.
7. Every production asset has acceptable provenance and rights evidence.
8. The editing-wave ownership ledger is conflict-free and exact paths are approved.
9. The legacy replacement map is approved; no legacy file is overwritten or deleted prematurely.
10. Primary review independently inspects specialist output and records acceptance rather than relying on a completion claim.
