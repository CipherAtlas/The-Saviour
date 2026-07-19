# Floor Dialogue Plan

## Route contract

Narrative order is deterministic until the physical ending decision. A new run
plays `opening.domestic`, `opening.ring`, `opening.threshold`, then the floor-one
projection. Every floor starts with its Witch projection. Each cleared reward
room plays its full-screen Elowen scene to completion before showing the
mechanical offer. Floors 1–9 have two room upgrades and one threshold blessing;
floor 10 has two room upgrades followed by the boss.

The only branch is `ending.decision`: strike strictly before the five-second
deadline or hesitate. It is a controller state, not a dialogue sequence.

## Combined scene-card contract

Every implementation scene is defined by the combined record in this plan and
`DIALOGUE_CORPUS.md`. Together they record:

- stable sequence and beat IDs;
- trigger and narrative purpose;
- full-screen presentation;
- speaker, expression, pose, stage position, and background per beat;
- the knowledge state before and after the scene, expressed by this plan's
  knowledge-change and progression columns;
- one relationship or interpretive change;
- a word budget;
- the next narrative or mechanical state, expressed by the deterministic route
  contract and each corpus trigger.

The corpus carries runtime-facing beat text and staging metadata; this plan
carries purpose, progression, knowledge change, and drafting budgets. Runtime
integration must preserve both halves without duplicating prose-only planning
fields into every beat record.

Background keys describe authored visual needs; they do not authorize asset
production. Expression and pose keys must map to the approved art matrix before
runtime integration.

## Opening

| ID | Goal, conflict, outcome | Knowledge change | Budget |
|---|---|---|---:|
| `opening.domestic` | Zephyr wants Elowen to rest; she wants to finish private work without exposing it. Their ordinary disagreement reveals affection, competence, certainty, and the paired rings. They part warmly, but she keeps one thing unsaid. | Player sees concealed unease; Zephyr sees only familiar stubbornness. | 420 |
| `opening.ring` | Zephyr finds her missing, tests the ring, receives one genuine fragment, and follows its painful pull. | Elowen is alive and distant; contact is real but unauthenticated. | 260 |
| `opening.threshold` | Zephyr demands release; Witch refuses and warns; he commits to entry. | Witch took Elowen and considers release unsafe. Zephyr concludes abduction. | 220 |

## Floor progression

| Floor | Witch projection purpose | Elowen's three-step movement | Player inference target | Projection words |
|---:|---|---|---|---:|
| 1 | Classify Zephyr's devotion as exposure. | Bond explanation → practical care → breath/memory anchor. | Rescue model feels secure. | 70 |
| 2 | State that control below is incomplete. | Injury concern → shared ring thread → unusually precise proximity. | First weak anomaly. | 65 |
| 3 | Separate contact from trustworthy meaning. | Defend bond → close distance → break seals. | Ring becomes contested evidence. | 70 |
| 4 | Point to inconsistent responses and ambiguous ownership. | Familiar care → barrier urgency → intimacy attached to broken locks. | Dual-source suspicion begins. | 65 |
| 5 | Contrast ordered arrivals with tearing arrivals. | Possessive concern → reject cost → fear further loss. | First meaningful player doubt. | 80 |
| 6 | Distinguish deterioration from pain. | One fracture → overcorrected warmth → impatient necessity. | Voice drift is undeniable but explainable to Zephyr. | 80 |
| 7 | Match Elowen's gift to unstable residue. | Foreknowledge → harsher force → demand Witch's death. | Empowerment and danger share a source. | 85 |
| 8 | State that lucid intervals shorten and do not reverse. | Command → ownership/human warning/hijack → obedience sting. | Contradictory agency becomes legible. | 90 |
| 9 | Identify the brief human interval. | Name careful forces → stop/reversal → possessive surveillance. | Rescue frame is almost untenable. | 95 |
| 10 | Summarize guided, strengthened, and hunted. | Wounds as inconvenience → last-breath demand with human fragment. | Truth remains unnamed, but denial lacks evidence. | 100 |

## Twenty-nine upgrade scenes

| ID | Scene purpose and relationship shift | Budget |
|---|---|---:|
| `floor.f01.upgrade.r01` | Elowen explains the bond plausibly and uses Zephyr's name with real relief; he accepts help as proof of rescue. | 75 |
| `floor.f01.upgrade.r02` | She notices his injuries through the bond; he reassures her with familiar understatement. | 70 |
| `floor.f01.upgrade.threshold` | She recalls how he hides fatigue; memory restores intimacy before the next descent. | 75 |
| `floor.f02.upgrade.r01` | Her practical care governs the choice; he remains the person deciding. | 75 |
| `floor.f02.upgrade.r02` | The ring becomes a thread both claim to hold; connection feels reciprocal. | 75 |
| `floor.f02.upgrade.threshold` | Her awareness of his breath is slightly too exact, but reads as closeness. | 75 |
| `floor.f03.upgrade.r01` | She frames the Witch's warning as an attack on their marriage; he rejects doubt. | 80 |
| `floor.f03.upgrade.r02` | Warmth and urgency coexist; she measures distance rather than his condition. | 80 |
| `floor.f03.upgrade.threshold` | She asks him to break seals, making prison damage sound like reunion. | 85 |
| `floor.f04.upgrade.r01` | A domestic observation about fatigue restores trust after the projection. | 80 |
| `floor.f04.upgrade.r02` | She pressures him to move before barriers recover; care starts serving speed. | 85 |
| `floor.f04.upgrade.threshold` | Hand imagery attaches intimacy to opening another lock. | 85 |
| `floor.f05.upgrade.r01` | She worries about how much of him will reach her, not what the journey costs him. | 90 |
| `floor.f05.upgrade.r02` | She dismisses cost; Zephyr notices a change and accepts her fear as explanation. | 90 |
| `floor.f05.upgrade.threshold` | Her inability to tolerate further loss hints at the original flaw without disclosing it. | 90 |
| `floor.f06.upgrade.r01` | The only conspicuous floor-six fracture; she recovers and blames the Witch. | 100 |
| `floor.f06.upgrade.r02` | She deliberately reenacts tenderness to prove continuity; Zephyr wants the proof. | 90 |
| `floor.f06.upgrade.threshold` | Impatience returns in ordinary language, with no competing fracture. | 90 |
| `floor.f07.upgrade.r01` | She knows the next chamber before Zephyr sees it; his first direct question goes unanswered. | 95 |
| `floor.f07.upgrade.r02` | Power and breaking displace safety; he acts rather than resolves his doubt. | 100 |
| `floor.f07.upgrade.threshold` | She explicitly orders the Witch's death and rejects bargaining. | 105 |
| `floor.f08.upgrade.r01` | The scene opens with a command and makes concern conditional on obedience. | 100 |
| `floor.f08.upgrade.r02` | Possession breaks into one genuine warning, then corruption hijacks the line. | 115 |
| `floor.f08.upgrade.threshold` | She treats his continued descent as remembered obedience, changing intimacy into hierarchy. | 95 |
| `floor.f09.upgrade.r01` | She identifies the Witch's disciplined forces while refusing to name the others. | 110 |
| `floor.f09.upgrade.r02` | A lucid plea to stop is immediately reversed into a demand to approach. | 120 |
| `floor.f09.upgrade.threshold` | She measures every breath and pause as withheld possession. | 100 |
| `floor.f10.upgrade.r01` | His wounds are inconvenient because they delay release; he finally hears the cruelty plainly. | 90 |
| `floor.f10.upgrade.r02` | She demands the Witch's last breath; one filtered human urgency survives without explanation. | 90 |
|  | **Total** | **2,610** |

## Boss and endings

| ID | Goal, conflict, outcome | Budget |
|---|---|---:|
| `boss.confrontation` | Witch offers final evidence; Zephyr demands a human answer from Elowen and chooses combat. | 220 |
| `ending.witch-death` | Witch's last observation completes before ordered magic ceases. | 130 |
| `ending.princess-reveal` | Corrupted Elowen celebrates steering the ring; Zephyr's abduction model breaks. | 160 |
| `ending.princess-human` | Human Elowen claims responsibility, confirms containment and incurability, and asks for immediate death. | 140 |
| `ending.decision` | Nondialogue five-second circular decision; stale input flushed and result accepted once. | 0 |
| `ending.kill` | The strike precedes dialogue; Elowen remains lucid, owns the choice, and dies with the corruption. | 160 |
| `ending.timeout` | Corruption returns and names Zephyr's refusal before the fatal strike. | 90 |
| `ending.timeout-final` | The strike precedes Zephyr's realization and Elowen's final intimacy-as-erasure line. | 70 |

## Word totals

| Scope | Words |
|---|---:|
| Opening | 900 |
| Witch projections | 800 |
| Upgrade scenes | 2,610 |
| Shared boss/reveal scenes | 650 |
| Kill branch | 160 |
| Timeout branch | 160 |
| Unique corpus target | 5,280 |
| Either playable route target | 5,120 |

The plan permits a final variance inside 4,000–6,000 after dialogue revision.
The final measured totals in `DIALOGUE_CORPUS.md` and
`DIALOGUE_CONTINUITY_AUDIT.md` supersede these drafting allocations.

### Final measured corpus

| Scope | Displayed words |
|---|---:|
| Unique corpus | 4,353 |
| Complete kill route | 4,237 |
| Complete timeout route | 4,266 |

The final corpus remains inside the approved range. Its shorter result preserves
the full route and every scene purpose without padding exchanges to their maximum
drafting allocations.

## Structural acceptance

- Every scene changes evidence, relationship, urgency, or interpretation.
- No two adjacent projections make the same warning.
- Every upgrade scene is distinct and completes before the offer appears.
- Elowen's progression is traceable across all 29 scenes.
- Floor 6 contains one conspicuous fracture.
- Zephyr does not accept the truth before `ending.princess-reveal`.
- The Witch never provides the twist or her history.
- No pre-reveal scene names the forbidden practice, research, root, cure,
  required death, or Elowen as an enemy creator.
- Both branches complete a controlled fade before glossary access.
