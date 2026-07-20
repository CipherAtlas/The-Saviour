# Asset licenses and provenance

## Music by Kevin MacLeod / Incompetech

The following instrumental tracks are licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). Runtime copies were transcoded from the official MP3 downloads to 128 kbps, 44.1 kHz stereo and stripped of source metadata for web delivery; no musical content was added.

Required attribution:

> "<Track Title>" Kevin MacLeod (incompetech.com)
>
> Licensed under Creative Commons: By Attribution 4.0
>
> https://creativecommons.org/licenses/by/4.0/

| Runtime file | Track / authoritative source | Runtime SHA-256 |
|---|---|---|
| `assets/audio/music/lamentation.mp3` | [Lamentation](https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100607) | `78bc8803e115da64417d38f0f25893423f1b7a7c3ffedf2e12aab9c0064fb30a` |
| `assets/audio/music/darkest-child.mp3` | [Darkest Child](https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100783) | `f95973de91d7d5cde7b545fe8a95f8d0ce52e0ecd78e78fc4ea1f411789b0221` |
| `assets/audio/music/darkest-child-var-a.mp3` | [Darkest Child var A](https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100784) | `6d7be5acfc7ecc1d89d53b3fa3781655e3c93ab5cd464637a5d43395a57c9c89` |
| `assets/audio/music/constancy-part-two.mp3` | [Constancy Part Two](https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100773) | `6085129867040d5165717be282e23c33b47f25107d6687f0ca7ed06c41484e80` |
| `assets/audio/music/constancy-part-one.mp3` | [Constancy Part One](https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100775) | `3276c8a1079ef442b2f6f8da3f0d1119a052ab7d7237a81d513a5f5f039307b8` |
| `assets/audio/music/constancy-part-three.mp3` | [Constancy Part Three](https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100774) | `760de765f50569904d03b8e3d800fe669fd821fc2c86c647582005c7b0b462fc` |
| `assets/audio/music/death-of-kings.mp3` | [Death of Kings](https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100876) | `0e0963879464247de91dd78727f2007656af85ba8b8ead706b9b5d9eb1b56c7e` |
| `assets/audio/music/unlight.mp3` | [Unlight](https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100878) | `5f3c118a4786eb39e9749c1f1f6f72f7712bd22f93b11b804f20e66139b2301b` |

## Combat sound effects — CC0 source recordings

All runtime files under `assets/audio/sfx/combat/` are derivative mixes of the
following [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
recordings. Attribution is not legally required, but the creators and source
pages are retained here for provenance.

| Source collection | Creator | Used for |
|---|---|---|
| [Swish — bamboo stick weapon swooshes](https://opengameart.org/content/swish-bamboo-stick-weapon-swhoshes) | qubodup | Player combo, Q, Grave Line, Claim, and enemy movement layers |
| [Swishes Sound Pack](https://opengameart.org/content/swishes-sound-pack) | artisticdude | Player dash variations |
| [Battle Sound Effects](https://opengameart.org/content/battle-sound-effects) | artisticdude, submitted by Ogrebane | Physical Q, Grave Line, and Claim blade movement |
| [Air whoosh](https://opengameart.org/content/air-whoosh) | pyranostudios | Q and Grave Line charge beds |
| [Erase / Escape](https://opengameart.org/content/erase-escape) | Fupi | Claim recall air layer |
| [Wood and Metal Sound Effects: Volume 2](https://opengameart.org/content/wood-and-metal-sound-effects-volume-2) | Ogrebane | Q, Grave Line, Claim catch, and cleave contact layers |
| [20 Sword Sound Effects](https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes) | StarNinjas | Scythe impact, enemy blade, shield, and Queen attack layers |
| [RPG Sound Pack](https://opengameart.org/content/rpg-sound-pack) | artisticdude | Monster, heavy enemy, Grave Line blade scrape, and impact layers |
| [Spell sounds](https://opengameart.org/content/spell-sounds) | Augmentality (Brandon Morris), submitted by HaelDB | Hexer, Wraith, Bombardier, and Queen magic layers |

Runtime derivatives were cropped from individual takes or larger source files,
silence-trimmed, equalized, filtered, compressed, layered where appropriate,
faded, and peak-matched. Some return and charge textures were reversed. The two
Bombardier explosions also contain project-created filtered noise and sine
layers. Final delivery files are 44.1 kHz stereo MP3s encoded for low-latency web
playback; no unmodified source recording is distributed.

## Project-original title, bookend, and gameplay UI art

- Creator: project production team
- Creation date: 2026-07-18
- Source references: the approved in-repository concept and representative-scene direction under `docs/art-samples/`; retained character selections are Zephyr C and Elowen A
- Rights basis: project-original production; no external source art or third-party attribution dependency
- Modifications: character exports use transparent alpha-matte cleanup; backgrounds are opaque native-resolution exports
- Attribution requirement: none

### Gameplay UI framework

- `assets/ui/upgrade-scythe-dial-framework.png`: project-original scythe-dial framework retained for the Technique Oath overlay; derived from the approved in-project visual direction and used behind live interface text and controls
- `assets/ui/upgrade-scythe-dial-background.png`: project-original static dial background, generated from the approved framework with the three interactive blade stations removed so the stations can animate independently
- `assets/ui/upgrade-option-reaper-sprite.png`, `assets/ui/upgrade-option-shade-sprite.png`, `assets/ui/upgrade-option-grave-sprite.png`: project-original transparent interactive blade, medallion, and selector layers extracted from the approved scythe-dial direction
- `assets/ui/upgrade-option-reaper-stud.png`, `assets/ui/upgrade-option-shade-stud.png`, `assets/ui/upgrade-option-grave-stud.png`: project-original isolated selector artwork used for the direct gold, cyan, and violet hover/focus illumination

### Retained VN and title inventory — 21 PNGs

All retained files are runtime-used title, opening, boss-confrontation, ending,
or Elowen world-actor art. The unused floor, biome, and expression inventory was
removed on 2026-07-20; the approved Witch set and containment-heart background
were restored when the boss confrontation returned to the product flow.

- Zephyr (3): `assets/vn/zephyr-c-determined.png`, `assets/vn/characters/zephyr-c-alarmed.png`, `assets/vn/characters/zephyr-c-devastated.png`
- Elowen (5): `assets/vn/characters/elowen-a-corrupt-full.png`, `assets/vn/characters/elowen-a-final-plea.png`, `assets/vn/characters/elowen-a-human.png`, `assets/vn/characters/elowen-a-lucid.png`, `assets/vn/characters/elowen-a-triumphant.png`
- Witch (5): `assets/vn/witch-b-clinical.png`, `assets/vn/witch-b-containment-gesture.png`, `assets/vn/characters/witch-b-acceptance.png`, `assets/vn/characters/witch-b-combat.png`, `assets/vn/characters/witch-b-wounded.png`
- Backgrounds (8): `assets/vn/backgrounds/containment-heart.png`, `assets/vn/backgrounds/containment-heart-broken.png`, `assets/vn/backgrounds/dungeon-threshold.png`, `assets/vn/backgrounds/prison-collapse-quiet.png`, `assets/vn/backgrounds/prison-collapse-violent.png`, `assets/vn/backgrounds/prison-open-unstable.png`, `assets/vn/backgrounds/ring-void.png`, `assets/vn/backgrounds/witch-domain-approach.png`

### Retained blocked menu candidates

- `assets/menu/title-bg-01.png` remains an unreferenced rejected title candidate.
- `assets/menu/zephyr-c-title.png` remains an unreferenced rejected character candidate with unaccepted alpha edges.

### Retained legacy WebPs with unknown provenance

The following existing files have no documented rights basis and are not licensed by this record: `assets/title-art.webp`, `assets/dungeon-stone.webp`, `assets/princess-portrait.webp`, `assets/evil-queen-portrait.webp`, `assets/sprites/enemy-archetypes.webp`, `assets/sprites/foundry-decals.webp`, `assets/sprites/keep-decals.webp`, `assets/sprites/ossuary-decals.webp`, `assets/sprites/princess-world.webp`, `assets/sprites/queen-world.webp`, `assets/sprites/void-court-decals.webp`, and `assets/vfx/combat-vfx.webp`.

No runtime source loads those WebPs as of 2026-07-18. The release-packaging test intentionally lists them as denied files. The former runtime reference to `princess-world.webp` now uses the approved Elowen A human cutout, and the four former decal-sheet references now use deterministic code-native geometry. The files remain in the repository only because deletion was not authorized and are excluded from production builds. Reusing any of them requires authoritative provenance and a new review.

## KayKit Character Pack: Adventures 1.0

- Creator: Kay Lousberg / KayKit
- Source: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
- Revision: `672074b73ba276876a19e8816ecdc5241817ab47`
- License: CC0 1.0 Universal
- Used asset: Knight

## KayKit Character Pack: Skeletons 1.0

- Creator: Kay Lousberg / KayKit
- Source: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0
- Revision: `15b62b9bad122f72926c10fb14d622c73819fa54`
- License: CC0 1.0 Universal
- Used assets: Skeleton Minion, Rogue, Warrior, and Mage

## KayKit Dungeon Remastered 1.0

- Creator: Kay Lousberg / KayKit
- Source: https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0
- Revision: `b0ca9bd96a8072ab36a3a5464f00ed1e06a16d07`
- License: CC0 1.0 Universal
- Used assets: selected modular floors, walls, pillars, rubble, furniture, lighting, and dungeon props

The character files have been pruned to the animation clips used by the game and optimized for web delivery. The models remain available under their original CC0 terms.
