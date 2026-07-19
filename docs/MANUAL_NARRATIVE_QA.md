# Manual Narrative QA

## Test setup

- Start from a new run with no narrative flags carried from a previous attempt.
- Record every sequence ID in presentation order.
- Confirm every narrative scene blocks combat and other state transitions until
  it completes or an allowed skip is confirmed.
- Confirm every upgrade encounter is a full-screen scene followed by a distinct
  mechanical offer. The dialogue itself must not create a second choice layer.
- Confirm displayed speakers are exactly `Zephyr`, `Princess Elowen`, and `The Witch`.
- Confirm no Fallen Knight, Hollow Queen, gate-war explanation, or legacy ending appears.
- Confirm there is no spoken dialogue, synthesized voice, vocal effort, or
  placeholder voice asset.
- Record the expression, pose, stage, and background key used for every beat;
  missing keys are failures, not silent fallbacks.

## Opening

- `opening.domestic` plays first and establishes a lived-in marriage, dry
  familiarity, paired rings, Elowen's compassion, concealed unease, and the
  two-tap memory.
- `opening.ring` follows with Elowen missing, one genuine ring fragment, and
  Zephyr's pursuit to the domain.
- `opening.threshold` follows and ends with Zephyr committed to entering.
- No opening event names Elowen's forbidden practice, research, enemy creation,
  required death, incurability, or the Witch's protective history.
- Confirm the opening uses full-screen staging and does not read like a lore
  lecture or tutorial conversation.

## Floor-by-floor route

For each floor, verify the Witch projection plays once at room 1 before combat.
For every reward, verify the matching Elowen sequence plays full-screen before
the offer appears. Complete or skip the scene, then confirm exactly one offer is
shown and that pause/resume cannot reorder either step.

| Floor | Start | Room 1 offer | Room 2 offer | Room 3 / threshold | Required progression |
|---|---|---|---|---|---|
| 1 | `floor.f01.witch` | `floor.f01.upgrade.r01` | `floor.f01.upgrade.r02` | `floor.f01.upgrade.threshold` | Loving baseline and bond explanation. |
| 2 | `floor.f02.witch` | `floor.f02.upgrade.r01` | `floor.f02.upgrade.r02` | `floor.f02.upgrade.threshold` | Warmth plus incomplete-control clue. |
| 3 | `floor.f03.witch` | `floor.f03.upgrade.r01` | `floor.f03.upgrade.r02` | `floor.f03.upgrade.threshold` | Ring reliability challenged; seal-breaking command consolidated. |
| 4 | `floor.f04.witch` | `floor.f04.upgrade.r01` | `floor.f04.upgrade.r02` | `floor.f04.upgrade.threshold` | Soft dual-source clue; no explicit creator. |
| 5 | `floor.f05.witch` | `floor.f05.upgrade.r01` | `floor.f05.upgrade.r02` | `floor.f05.upgrade.threshold` | Ordered/unstable contrast and first meaningful doubt. |
| 6 | `floor.f06.witch` | `floor.f06.upgrade.r01` | `floor.f06.upgrade.r02` | `floor.f06.upgrade.threshold` | Exactly one clear Elowen fracture. |
| 7 | `floor.f07.witch` | `floor.f07.upgrade.r01` | `floor.f07.upgrade.r02` | `floor.f07.upgrade.threshold` | Shared magical residue, foreknowledge, and demand to kill the Witch. |
| 8 | `floor.f08.witch` | `floor.f08.upgrade.r01` | `floor.f08.upgrade.r02` | `floor.f08.upgrade.threshold` | Worsening prognosis, one human interruption, obedience sting. |
| 9 | `floor.f09.witch` | `floor.f09.upgrade.r01` | `floor.f09.upgrade.r02` | `floor.f09.upgrade.threshold` | Careful-force distinction, human stop, immediate hijack. |
| 10 | `floor.f10.witch` | `floor.f10.upgrade.r01` | `floor.f10.upgrade.r02` | **No offer** | Guided/strengthened/hunted recap; corrupted mask nearly gone. |

At no point before `ending.princess-reveal` may Zephyr state or accept the true
explanation. Before `ending.princess-human`, no scene may name the practice,
research, current root, incurability, required death, Elowen's enemy creation,
or the Witch's ancient protective role. Upgrade choices must grant only their
advertised mechanical effects; Elowen's voice shift must not add corruption
penalties.

## Corpus and voice validation

- Confirm exactly 49 dialogue sequences are registered: three openings, ten
  projections, 29 upgrades, and seven boss/reveal/ending sequences.
- Confirm `ending.decision` is a stable nondialogue state and is not counted as a
  fiftieth dialogue sequence.
- Count only displayed dialogue. Confirm the unique corpus and each completed
  route remain between 4,000 and 6,000 words. The approved document baseline is
  4,353 unique, 4,237 on the kill route, and 4,266 on the timeout route.
- Confirm every sequence and beat ID is unique and stable.
- Confirm every beat resolves a valid speaker, expression, pose, stage, and
  background key.
- Hide nameplates during a review pass. Zephyr should remain identifiable by
  short concrete questions and decisions; Elowen by intimate observation that
  shifts toward command; Witch by measured classification without questions.
- Confirm “Two taps. Come home.” is the only exact repeated displayed line, at
  `opening.ring.b03` and `ending.kill.b07`, completing the domestic ritual's
  change from alarm to final listening.
- Confirm adjacent Witch projections do not repeat the same warning or evidence.
- Confirm floor 6 has exactly one conspicuous Elowen fracture, in
  `floor.f06.upgrade.r01`.
- Confirm floor 8 contains ownership, one human warning, and immediate hijack;
  floor 9 contains the two-tap stop plea and reversal; floor 10 contains cruelty
  and one filtered human warning without disclosure.
- Read every scene aloud. Flag wooden complete-sentence rhythm, repeated
  openings, generic fantasy language, therapy phrasing, exposition, or unclear
  subtext.

## Boss and reveal

1. `boss.confrontation` plays before the Witch fight.
2. Defeating the Witch does not immediately end the run.
3. `ending.witch-death` completes and the Witch dies.
4. Ordered guardians, sigils, or controlled effects cease; unstable necromantic presentation remains.
5. `ending.princess-reveal` begins with Elowen triumphant, preserves unstable
   forces, and explicitly recontextualizes the ring as manipulation.
6. `ending.princess-human` provides the first direct disclosure: Elowen claims
   her research and choices, names necromancy, confirms containment, rejects
   cure, and asks for immediate death without a lore speech.
7. The five-second circular choice begins once. It has a clear kill input and no dialogue-tree alternative.

## Kill ending

- Trigger the kill input before the circle closes.
- Confirm the decision resolves once even if keyboard, mouse, and touch inputs are repeated together.
- `ending.kill` plays in order.
- The strike occurs before `ending.kill`; Elowen remains lucid as she dies, owns the choice, and thanks Zephyr.
- The corruption dies with her; Zephyr survives.
- Fade to black completes before the glossary unlock notification appears.
- Restart and confirm the glossary remains unlocked.

## Timeout ending

- Allow the circle to close without kill input.
- Confirm `ending.timeout` plays once before the fatal strike.
- Confirm corrupted Elowen kills Zephyr before `ending.timeout-final` begins.
- Confirm `ending.timeout-final` contains Zephyr's final realization and Elowen's final line.
- Confirm “nothing between us” resolves the earlier promise as a threat.
- Fade to black completes before the glossary unlock notification appears.
- Restart and confirm the glossary remains unlocked.

## State, retry, and edge cases

- Die on an ordinary floor: glossary remains locked and a retry starts at `opening.domestic`.
- Die and retry after hearing later-floor dialogue: the new run restarts the progression at floor 1.
- Pause during a projection, full-screen upgrade scene, mechanical offer, reveal,
  and five-second choice; ordering remains deterministic.
- Retry the same seed and a new seed; narrative IDs and clue order remain identical.
- Confirm every new run starts with `opening.domestic`; no later-floor beat or
  queued callback survives the reset.
- Confirm floor 10 room 3 never requests an upgrade sequence.
- Confirm missing sequence IDs fail visibly during development rather than silently skipping dialogue.
- Confirm all text remains readable at minimum supported viewport, high UI scale, high contrast, and reduced motion.
- Confirm typewriter completion and advance are distinct inputs, then test auto,
  backlog, hide UI, hold-to-fast-forward, previously-read skip, new-text
  protection, and scene-skip confirmation with keyboard, mouse, controller, and
  touch.
- Complete both endings independently and confirm each unlocks the same seven glossary entries.

## Executed acceptance record — 2026-07-18

The optimized production preview was exercised at `http://127.0.0.1:4174` after the final build.

### Corpus and flow

- Independent source comparison confirmed 49 unique sequences and 339 unique beats. `DIALOGUE.md` matches every runtime ID, metadata field, order, and displayed line in `src/game/dialogueContent.js`; canonical comparison SHA-256: `13507fa16444b7e500c3ab119128a4829fb4e87dbdf8663aa90cc7e45139573a`.
- A fresh browser run began in `opening.domestic`, then presented `opening.ring`, `opening.threshold`, and `floor.f01.witch` in order. The first five domestic beats changed stage and art state atomically without a missing-art frame.
- The complete Standard kill route (`FINAL-PROD-MERCY`) visited all 30 chambers and presented the expected 47 route-specific dialogue sequences, including every opening, projection, upgrade encounter, boss/reveal scene, and `ending.kill`. It ended at **You found her** with zero deaths and no browser warnings or errors.
- The independent Standard timeout route (`FINAL-PROD-RELEASE`) visited all 30 chambers and presented the expected 48 route-specific dialogue sequences, including `ending.timeout` and `ending.timeout-final`. The decision remained unresolved for five simulation seconds and ended at **Love opened the cage** with zero deaths and no browser warnings or errors.
- Both route reports place the last mechanical upgrade scene at `floor.f10.upgrade.r02`; floor 10 room 3 proceeds to `boss.confrontation` without requesting a thirtieth offer.

### Reader, state, and layout

- With the Continue button focused, `W` hid and restored the reader, `S` opened the skip confirmation, and `Escape` canceled the confirmation, paused the clear reader, and resumed it without changing sequence order.
- Portrait `320×568`, landscape `568×320`, and desktop `1280×720` checks had no document overflow. Character art, background, reader text, primary action, and compact controls remained usable; the shared responsive layout covers all registered beats while asset-readiness tests cover every mapped character/background pair.
- Title, difficulty, Records, Credits, Settings, high contrast, and reset-to-defaults flows were exercised in the production preview. Automated focus and persistence tests cover backlog, auto, fast-forward, previously-read skip, new-text protection, controller edges, touch actions, retry, glossary lock/unlock, and malformed storage.

### Scope boundary

- Keyboard and mouse interactions were exercised in the production browser. No physical gamepad was attached to this environment; controller polling, edge handling, contextual VN actions, focus navigation, settings controls, and disconnect behavior are covered by deterministic tests rather than a claim of hardware testing.
