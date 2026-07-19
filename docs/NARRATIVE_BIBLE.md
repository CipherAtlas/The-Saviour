# Narrative Bible

## Canon hierarchy

`DIRECTIONS.md` is authoritative. This bible records its approved narrative
contract. The integrated `src/game/dialogueContent.js` and editor-facing
`DIALOGUE.md` implement this contract; neither may override it. The following
superseded material must not be restored without a recorded canon change:

- The Fallen Knight encounter.
- The royal-blood gate and ancient court-war explanation.
- The Hollow Queen identity and title for the antagonist; she is displayed as **The Witch**.
- The `homecoming`, `sealed`, and `wardens` endings.

The Princess is **Princess Elowen**. The Prince is canonically **Zephyr**. The
runtime may retain `prince` as his internal character key, but story text and
nameplates identify him as Zephyr. Elowen uses his name intimately; the Witch
usually calls him “Prince” or omits direct address.

## Story spine

After one warm domestic memory, Zephyr follows the magical bond between paired
wedding rings into a ten-floor prison, believing the Witch abducted his wife.
Elowen uses the bond to guide and strengthen him. The Witch warns that the bond,
the creatures, and Elowen's changing voice are not what he assumes. After
Zephyr kills the Witch, Elowen briefly regains human control and identifies her
own incurable necromancy. Zephyr has five seconds to kill her or allow the
corruption to return.

The core theme is that devotion is not understanding. Rescuing Elowen means opening the prison; saving her means honoring her final request to die.

## World rules

- Magic is ordinary enough for wedding rings to form a recognized bond between spouses.
- The rings can carry presence, emotion, speech, power, and influence. Connection does not authenticate which part of a damaged mind is speaking.
- Necromancy progressively corrupts identity, emotion, restraint, logic, and the natural order. It is absolutely forbidden.
- Elowen is the only known living necromancer. She began by secretly studying
  how to preserve consciousness at the moment of death because she could not
  accept that an openly magical society still treated death as untouchable. An
  apparent early success convinced her that continuing was a moral duty. Her
  compassion hardened into certainty, and “no one should be lost” decayed into
  “nothing is permitted to leave me.” This explains but does not excuse her.
- Elowen cannot be cured. Her death is the only way to destroy the current root.
- Genuine fragments of Elowen's human consciousness remain, but they become shorter and increasingly filtered or hijacked.
- The Witch's forces arrive in stable ranks with clean summoning effects and controlled visual motion.
- Elowen's forces use irregular placement, necromantic color, stronger pulse and sway, and increasingly frequent representation across later floors. Both origins retain the existing enemy behavior roster and target Zephyr.
- Elowen's power always supplies the upgrades. The shifting dialogue reflects changing agency; upgrades do not mechanically corrupt or punish the player.

## Character objectives and voices

### Zephyr

**Objective:** Reach and rescue his wife.

**False belief:** Love, the ring, and Elowen's recognizable voice give him reliable understanding of what she needs.

**Voice:** Direct, grounded, and emotionally contained. He uses short declarative sentences and concrete demands. He does not posture like a storybook hero, joke through danger, or articulate the theme. His denial must remain emotionally credible: he attributes Elowen's changes to pain, magical interference, or the Witch's treatment.

**Ending arc:** Killing Elowen means he finally listens to her rather than the
corrupted desire carried through the ring. Hesitation means he continues
demanding an answer compatible with rescue and is destroyed by that refusal.
The kill branch completes a positive change arc; the timeout branch is the
failed form of that same arc, not a knowledge failure.

### Princess Elowen

**Human objective:** Bring Zephyr close enough to end the Witch's containment and, in a final lucid interval, kill her.

**Corrupted objective:** Escape, kill the Witch, possess or use Zephyr, and spread. Corruption prevents these impulses from remaining logically consistent.

**Voice progression:**

1. **Floors 1–2:** Warm, attentive, familiar, and concerned with survival.
2. **Floors 3–4:** Still loving; urgency shifts toward breaking seals and descending.
3. **Floor 5:** Intensity and possessiveness emerge; power begins to matter more than cost.
4. **Floor 6:** One clear fracture, immediately blamed on the Witch; later lines remain impatient but do not add another fracture.
5. **Floor 7:** Concrete knowledge of the dungeon and an explicit demand to kill the Witch.
6. **Floor 8:** Commands, ownership, one human interruption, then the sting of obedience.
7. **Floor 9:** She distinguishes the Witch's careful forces, briefly asks him to stop, then hijacks the plea.
8. **Floor 10:** Open cruelty, impatience with his wounds, and a final filtered human urgency.
9. **Reveal:** Corruption first celebrates how it steered love through the ring. Human Elowen names necromancy once, claims responsibility, confirms the Witch's containment, rejects cure, and asks for death.

Elowen should never become a generic seductress or deliver a villain monologue. Her human fragments are real, not a separate curable personality.

### The Witch

**Objective:** Contain Elowen, study the corruption so future practitioners can be detected, and kill the current root safely.

**Voice:** Precise, clinical, restrained, and unconcerned with appearing heroic. She speaks in observations, conditions, risks, and outcomes. Her flaw is treating people like cases. She does not taunt, plead, boast, explain her history, or reveal the twist outright.

Her language moves from warnings about compromised judgment to observable evidence: inconsistent responses, ordered arrivals, magical residue, shortening lucid intervals, and the keeper/prison distinction.

## Character voice reference

### Zephyr

- **Sentence length and rhythm:** Usually one short sentence or a two-part demand. He answers evidence directly and leaves emotion compressed between words.
- **Vocabulary and formality:** Plain, concrete, and lightly formal. He names actions—leave, release, hurt, reach—rather than abstract ideas.
- **Emotional strategy:** Turn fear into commitment. When challenged, he narrows the conversation to the next thing he can do.
- **Humor and imagery:** Dry familiarity may surface sparingly in the domestic opening and early low-pressure ring exchanges; never as combat banter or once the corruption turns openly coercive. Figurative language remains rare. The ring, Elowen's voice, and physical distance are his recurring concrete anchors.
- **Under pressure:** Becomes shorter and more absolute, never grander. Doubt appears as a question before he forces it back into the rescue explanation.
- **Avoid:** Heroic proclamations, speeches about destiny or darkness, self-analysis, contempt for Elowen, and statements that solve the mystery early.
- **Knowledge limit:** Until the reveal, he knows only that Elowen is missing, alive through the ring, apparently imprisoned, and able to lend him power.
- **Reference line:** “I understand that she is alive and you are keeping her.”

### Princess Elowen — human

- **Sentence length and rhythm:** Brief, intimate phrases with room for breath. Requests sound chosen rather than imposed.
- **Vocabulary and formality:** Familiar domestic words—breathe, hand, hurt, love—without pet-name excess or courtly language.
- **Emotional strategy:** Protect Zephyr, reduce his fear, and preserve enough agency to make one final request.
- **Humor and imagery:** Gentle understatement is possible in the domestic opening and a few early low-pressure ring exchanges, then disappears as danger and coercion intensify. Imagery stays tactile: breath, hands, distance, and the thread of the ring.
- **Under pressure:** Stops softening the truth. At the reveal she uses clipped facts, accepts responsibility, and gives an imperative because time is gone.
- **Avoid:** Saintly self-erasure, elaborate apologies, cure language, lore exposition, and treating corruption as a separate innocent person.
- **Knowledge limit:** She knows what she practiced and what the Witch contained, but the ring transmits only fragments until the ending.
- **Reference line:** “It was necromancy. Mine. She was containing me. There is no cure—kill me. Now.”

### Princess Elowen — transitional corruption

- **Sentence length and rhythm:** Human warmth remains at the start of a line, while commands and sharper clauses begin to interrupt it.
- **Vocabulary and formality:** Familiar language shifts toward force, cost, breaking, obedience, and ownership. Floors 6, 8, 9, and 10 each permit one conspicuous fracture; the surrounding lines must not compete with it.
- **Emotional strategy:** Make urgency resemble love. The corruption reframes possession as closeness and power as protection.
- **Humor and imagery:** No banter. Physical care becomes transactional; distance, breath, and hands acquire controlling meanings.
- **Under pressure:** Corrects herself too quickly, exposes knowledge she should not have, or lets a genuine warning break through before hijacking it.
- **Avoid:** An instant personality switch, seductive-villain clichés, constant snarling, repeated “hurry” beats, and explicit necromantic terminology.
- **Knowledge limit:** Corruption knows the prison and its creatures; the transmitted voice must reveal that knowledge only as anomalies, never as a confession.
- **Reference line:** “You belong with me. I—please, don't trust my voice—keep going.”

### Princess Elowen — fully corrupted

- **Sentence length and rhythm:** Clean, cruel statements followed by abrupt imperatives. Her calm certainty is more threatening than shouting.
- **Vocabulary and formality:** Ownership, appetite, convenience, steering, and release. She reuses the language of love only to expose how she weaponized it.
- **Emotional strategy:** Treat Zephyr's devotion as a tool, then punish hesitation as proof that he still wants the lie.
- **Humor and imagery:** Amusement is dry and personal, never comic. The paired ring becomes an image of control and, in the final line, the removal of all separation.
- **Under pressure:** Drops concern for his body, delights in obedience, and turns human interruptions into commands.
- **Avoid:** A long villain speech, universal conquest claims, generic hunger metaphors, sexualized possession, and explanations of the Witch's history.
- **Knowledge limit:** She knows she manipulated the bond and that the Witch contained her. She reveals only what Zephyr must understand at the ending.
- **Reference line:** “And you named every pull love.”

### The Witch

- **Sentence length and rhythm:** One measured observation at a time. Parallel clauses are acceptable when they classify evidence; contractions and emotional interjections are rare.
- **Vocabulary and formality:** Clinical but readable: exposure, response, control, residue, condition, interval, outcome, keeper, prison.
- **Emotional strategy:** Replace persuasion with evidence. She accepts being hated and never argues that she is good.
- **Humor and imagery:** None. Metaphor appears only when it compresses a technical distinction, such as keeper versus prison.
- **Under pressure:** Becomes more exact, not louder. Her final lines remain diagnostic and concede only that her part is over.
- **Avoid:** Taunts, threats for pleasure, ancient titles, personal history, appeals for sympathy, “you fool,” and open statements of the twist.
- **Knowledge limit:** She knows the whole truth but discloses only observable risk before the reveal; the glossary alone records her history.
- **Reference line:** “Observation requires no trust.”

## Dialogue style and repetition rules

- Each sequence must change evidence, relationship, urgency, or interpretation. A warning that merely repeats “leave” is not enough.
- Do not repeat the same clue on adjacent floors. Ring reliability belongs to floor 3, divided control to floors 2 and 4, origin contrast to floors 5, 7, and 9, and mental deterioration to floors 6 and 8.
- Reserve “love” for the bond explanation, meaningful reassurance, and ending recontextualization. Reserve “hurry” for late-stage loss of control.
- Vary openings among observations, questions, imperatives, sensory contact, and direct rebuttals. Avoid successive lines beginning with character names or “You must.”
- Do not use generic fantasy abstractions such as darkness, destiny, evil, taint, chosen blood, ancient prophecy, or power beyond imagining.
- Do not repeat an emotional beat in the same exchange. If Zephyr denies evidence, his next line must act, question, or reframe rather than deny again.
- Full-screen upgrade scenes remain readable during repeat runs: each performs a
  distinct narrative function, introduces no second choice, and hands off to the
  mechanical selection only after the scene completes.

## Knowledge-state chart

| Stage | Zephyr believes | Player can infer | Elowen can express | Witch may disclose |
|---|---|---|---|---|
| Domestic opening | His marriage is loving and secure. | Elowen's warmth is genuine, while her unease around loss and unfinished obligations is concealed. | Lived-in affection, dry familiarity, and one unforced ring beat. | Not present. |
| Absence and threshold | Elowen was abducted and the ring proves she needs rescue. | The ring carries genuine contact but not necessarily complete truth. | One authentic sign of life and fear. | She took Elowen, release is unsafe, and Zephyr lacks understanding. |
| Floors 1–2 | The Witch controls the dungeon and Elowen is helping him survive it. | Some hostile responses may not belong to the Witch. | Warm concern and the plausible bond explanation. | Emotional compromise and incomplete control. |
| Floors 3–4 | The Witch is attacking the credibility of his marriage. | The signal and creature patterns are unreliable evidence. | Urgency, seal-breaking, and proximity. | Signal risk, inconsistent responses, and ambiguous ownership. |
| Floor 5 | The Witch is staging another trick. | Ordered and unstable arrivals imply two sources. | Possessive concern and preference for power over cost. | Observable differences only. |
| Floor 6 | Pain or the Witch altered Elowen's words. | Elowen's agency is fractured. | One clear verbal rupture followed by recovery. | Deterioration is distinct from pain. |
| Floor 7 | The Witch is lying about Elowen's gift. | Upgrades and unstable enemies share a magical source. | Foreknowledge and an explicit demand to kill the Witch. | Matching residue and loss of coherent purpose. |
| Floor 8 | The Witch is torturing or insulting Elowen. | Love, ownership, and a genuine warning are competing in one voice. | Command, possession, one human interruption, and hijack. | Clarity intervals are shortening and the process does not reverse. |
| Floor 9 | A real Elowen is fighting the Witch's interference. | The human fragment is fighting Elowen's own corruption. | Origin distinction, a plea to stop, and immediate reversal. | The affectionate voice is being worn by something else. |
| Floor 10 | Rescue remains possible if the Witch dies. | Elowen guided, strengthened, and hunted him; killing the Witch opens containment. | Open cruelty plus one filtered human urgency. | The complete contradiction, but not its necromantic name. |
| Reveal | The rescue model collapses. | Elowen is the incurable necromancer and the Witch was containing her. | Ownership of the crime, no cure, and the request to die. | No further exposition is required. |
| Ending | Acting is listening; hesitation is refusal. | Saving Elowen and freeing her were opposing goals. | Lucid gratitude on kill, or weaponized affection on timeout. | Her ordered magic is already gone. |

## Event and progression rules

- `opening.domestic` establishes the lived-in marriage, a shared memory, the
  paired rings, and Elowen's concealed unease without exposing its cause.
- `opening.ring` covers Elowen's disappearance, the ring contact, and Zephyr's
  pursuit to the Witch's domain.
- `opening.threshold` establishes the Witch as apparent captor and Zephyr's commitment.
- Every floor begins with one Witch projection. Projection order is deterministic.
- Rooms 1 and 2 on every floor trigger a separate full-screen Elowen upgrade
  scene before the offer is shown.
- Room 3 on floors 1–9 maps to a separate full-screen threshold-upgrade scene.
- Floor 10 room 3 is the Witch encounter and has no upgrade exchange.
- Dialogue before the ending never branches. Gameplay choice remains in the upgrade selection.
- The only narrative branch is the five-second physical decision: kill Elowen or hesitate.
- Dialogue state resets on a new run. Clue order never randomizes.

## Corpus and scene registry

The final corpus contains 49 dialogue sequences: three opening sequences, ten
Witch projections, 29 upgrade scenes, and seven boss/reveal/ending sequences.
`ending.decision` is a stable non-dialogue controller state and is not counted as
a dialogue sequence. The revised corpus contains 4,353 unique displayed words;
the complete kill route contains 4,237 and the complete timeout route 4,266.
Only displayed story dialogue counts, not identifiers, metadata, controls,
upgrade cards, or glossary entries.

Every dialogue sequence and beat has a stable identifier. Each beat also carries
an expression, pose, stage position, and background key. The presentation layer
may change those visual values without changing the beat's identity or text.

## Floor progression and purpose

| Floor | Witch purpose | Elowen purpose | Player knowledge target |
|---|---|---|---|
| 1 | Identify emotional compromise. | Explain the bond and establish loving baseline. | Rescue model feels secure. |
| 2 | State that control is incomplete. | Reinforce warmth and concern. | First weak anomaly. |
| 3 | Challenge signal reliability. | Consolidate the command to break seals and descend. | The ring becomes contested evidence. |
| 4 | Note inconsistency without naming another source. | Focus on barriers and proximity. | Dual-source suspicion begins. |
| 5 | Contrast ordered and tearing arrivals. | Value power and arrival over cost. | First meaningful doubt. |
| 6 | Name deterioration, not pain. | Deliver one fracture and a controlled recovery. | Voice drift is undeniable but explainable. |
| 7 | Match upgrade magic to unstable residue. | Show concrete foreknowledge and demand the Witch's death. | Empowerment and danger share a source. |
| 8 | Give a worsening prognosis. | Show ownership, one human interruption, and obedience. | Contradictory agency becomes legible. |
| 9 | Identify the brief human interval. | Distinguish careful forces, ask him to stop, then hijack the plea. | Player can infer the rescue frame is false. |
| 10 | Recap that she guided, strengthened, and hunted him. | Drop the loving mask. | Exact truth remains unnamed, but denial is no longer supported. |

## Foreshadowing map

| Cue | First-run reading | Retrospective truth |
|---|---|---|
| Paired ring | Proof that Elowen is alive and helping. | A conduit that corruption can steer. |
| Incomplete control | The Witch evades blame. | Two creators operate in the dungeon. |
| Ordered versus tearing arrivals | Different enemy styles. | Containment guardians versus necromantic creations. |
| Requests to break seals | Steps toward rescue. | Elowen is dismantling her prison. |
| Upgrade magic and unstable residue | The Witch attacks Elowen's gift. | The same source strengthens and endangers him. |
| Short human interruptions | Elowen fighting magical interference. | Genuine consciousness surfacing inside incurable corruption. |
| “Keeper” and “prison” | The Witch reframes her crime. | Killing her ends containment. |
| Ordered lights fail while instability remains | The dungeon destabilizes after victory. | The Witch's death removes only controlled magic. |

## Pre-reveal prohibitions

Before `ending.princess-human`, no dialogue, UI label, enemy label, or narration may state:

- That Elowen is a necromancer.
- That Elowen creates enemies.
- That Elowen must die or cannot be cured.
- That the Witch is an ancient protector.
- That Elowen is the current root of necromancy.
- Why Elowen began practicing necromancy.

Pre-reveal motivation hints may show her aversion to loss or certainty through
ordinary behavior. They may not mention her research, preserving consciousness,
an experimental success, or a moral duty connected to death.

Zephyr may notice contradictions but cannot solve the truth early. The Witch may describe evidence and prognosis but cannot provide a lore explanation. The glossary remains locked until either ending completes.

## Ending canon

The Witch dies. Her controlled magic ceases while necromantic instability remains. Corrupted Elowen initially celebrates; human Elowen then returns briefly and says: “It was necromancy. Mine. She was containing me. There is no cure—kill me. Now.”

- **Kill ending:** Zephyr strikes within five seconds. Elowen remains lucid as she dies, owns the choice, thanks him, and takes the corruption with her. Zephyr survives.
- **Timeout ending:** Zephyr hesitates. Corruption returns and confirms the ring manipulation, then kills him. His final realization and Elowen's “nothing between us” cruelty follow the fatal strike.

Both endings fade to black and unlock the glossary. Ordinary run death does not.

## Recorded canon changes

- `DIRECTIONS.md`: the Prince is named Zephyr.
- `DIRECTIONS.md`: Elowen's original motivation is compassion corrupted by
  certainty, with preservation becoming ownership.
- `DIRECTIONS.md`: all 29 upgrade encounters use separate full-screen VN scenes.
- `DIRECTIONS.md`: the first-completed-run corpus target is 4,000–6,000 words.

No other `Instructions.md` canon is superseded by this revision.
