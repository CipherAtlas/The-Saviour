# Manual Narrative QA

## Test setup

- Start from a new run with no narrative flags carried from a previous attempt.
- Record every sequence ID in presentation order.
- Confirm modal dialogue blocks combat and inline upgrade dialogue does not create a second choice layer.
- Confirm displayed speakers are exactly `Prince`, `Princess Elowen`, and `The Witch`.
- Confirm no Fallen Knight, Hollow Queen, gate-war explanation, or legacy ending appears.

## Opening

- `opening.ring` plays before the dungeon and establishes the paired-ring contact.
- `opening.threshold` follows and ends with the Prince committed to entering.
- Neither event names necromancy, cure, Elowen's enemy creation, or the Witch's protective history.

## Floor-by-floor route

For each floor, verify the Witch projection plays once at room 1 before combat. Verify room rewards use the matching inline sequence and remain ordered even after pausing.

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

At no point before the ending may the Prince state or accept the true explanation. Upgrade choices must grant only their advertised mechanical effects; Elowen's voice shift must not add corruption penalties.

## Boss and reveal

1. `boss.confrontation` plays before the Witch fight.
2. Defeating the Witch does not immediately end the run.
3. `ending.witch-death` completes and the Witch dies.
4. Ordered guardians, sigils, or controlled effects cease; unstable necromantic presentation remains.
5. `ending.princess-reveal` begins with Elowen triumphant and explicitly recontextualizes the ring as manipulation.
6. `ending.princess-human` names necromancy once, states it was Elowen's, confirms containment, rejects cure, and asks for immediate death.
7. The five-second circular choice begins once. It has a clear kill input and no dialogue-tree alternative.

## Kill ending

- Trigger the kill input before the circle closes.
- Confirm the decision resolves once even if keyboard, mouse, and touch inputs are repeated together.
- `ending.kill` plays in order.
- The strike occurs before `ending.kill`; Elowen remains lucid as she dies, owns the choice, and thanks the Prince.
- The corruption dies with her; the Prince survives.
- Fade to black completes before the glossary unlock notification appears.
- Restart and confirm the glossary remains unlocked.

## Timeout ending

- Allow the circle to close without kill input.
- Confirm `ending.timeout` plays once before the fatal strike.
- Confirm corrupted Elowen kills the Prince before `ending.timeout-final` begins.
- Confirm `ending.timeout-final` contains the Prince's final realization and Elowen's final line.
- Confirm “nothing between us” resolves the earlier promise as a threat.
- Fade to black completes before the glossary unlock notification appears.
- Restart and confirm the glossary remains unlocked.

## State, retry, and edge cases

- Die on an ordinary floor: glossary remains locked and a retry starts at `opening.ring`.
- Die and retry after hearing later-floor dialogue: the new run restarts the progression at floor 1.
- Pause during a projection, inline offer, reveal, and five-second choice; ordering remains deterministic.
- Retry the same seed and a new seed; narrative IDs and clue order remain identical.
- Confirm floor 10 room 3 never requests an upgrade sequence.
- Confirm missing sequence IDs fail visibly during development rather than silently skipping dialogue.
- Confirm all text remains readable at minimum supported viewport, high UI scale, high contrast, and reduced motion.
- Complete both endings independently and confirm each unlocks the same seven glossary entries.
