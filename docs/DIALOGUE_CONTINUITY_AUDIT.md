# Dialogue Continuity Audit

## Decision

**Accepted for technical design and structured-content implementation.** The
revised corpus contains 49 dialogue sequences, ten Witch projections, and 29
full-screen upgrade scenes. The unique corpus and both playable routes fall
inside 4,000–6,000 displayed words. No unresolved narrative blocker remains.

This acceptance covers story structure, canon, voice, progression, and prose. It
does not claim that VN UI, art, runtime ordering, or gameplay presentation has
already been implemented or manually validated.

## Review method

Each scene was drafted from `FLOOR_DIALOGUE_PLAN.md`, then reviewed in this order:

1. structure and scene purpose;
2. character arc and knowledge state;
3. originality and genre-default avoidance;
4. dialogue text, subtext, context, and speaker differentiation;
5. prose clarity, rhythm, and economy.

No scene exceeded two internal iterations. The first corpus pass was structurally
complete but measured below the required route minimum. The second pass added
character-specific reactions and relationship changes rather than exposition or
repeated warnings. Downstream dialogue and prose checks were rerun after those
changes.

## Measured registry and length

Displayed dialogue is the final table column in `DIALOGUE_CORPUS.md`.

| Check | Result | Status |
|---|---:|---|
| Dialogue sequence sections | 49 | Pass |
| Opening sequences | 3 | Pass |
| Witch floor projections | 10 | Pass |
| Full-screen upgrade scenes | 29 | Pass |
| Boss/reveal/ending dialogue sequences | 7 | Pass |
| Nondialogue decision states | 1 (`ending.decision`) | Pass |
| Unique displayed words | 4,353 | Pass |
| Kill-branch words | 87 | Pass |
| Timeout-branch words | 116 | Pass |
| Complete kill route | 4,237 | Pass |
| Complete timeout route | 4,266 | Pass |

Both routes are long enough for the approved distributed narrative target while
remaining below 6,000 words. Branch counts differ because the timeout outcome is
split across a pre-strike and post-strike exchange.

## Scene pass register

| Scene set | Stable IDs covered | Iterations | Structure | Arc / knowledge | Originality | Dialogue | Prose |
|---|---|---:|---|---|---|---|---|
| Opening | `opening.domestic`, `opening.ring`, `opening.threshold` | 2 | Pass | Pass | Pass | Pass | Pass |
| Floor 1 | `floor.f01.witch`, `floor.f01.upgrade.r01`, `floor.f01.upgrade.r02`, `floor.f01.upgrade.threshold` | 2 | Pass | Pass | Pass | Pass | Pass |
| Floor 2 | `floor.f02.witch`, `floor.f02.upgrade.r01`, `floor.f02.upgrade.r02`, `floor.f02.upgrade.threshold` | 2 | Pass | Pass | Pass | Pass | Pass |
| Floor 3 | `floor.f03.witch`, `floor.f03.upgrade.r01`, `floor.f03.upgrade.r02`, `floor.f03.upgrade.threshold` | 2 | Pass | Pass | Pass | Pass | Pass |
| Floor 4 | `floor.f04.witch`, `floor.f04.upgrade.r01`, `floor.f04.upgrade.r02`, `floor.f04.upgrade.threshold` | 2 | Pass | Pass | Pass | Pass | Pass |
| Floor 5 | `floor.f05.witch`, `floor.f05.upgrade.r01`, `floor.f05.upgrade.r02`, `floor.f05.upgrade.threshold` | 2 | Pass | Pass | Pass | Pass | Pass |
| Floor 6 | `floor.f06.witch`, `floor.f06.upgrade.r01`, `floor.f06.upgrade.r02`, `floor.f06.upgrade.threshold` | 2 | Pass | Pass | Pass | Pass | Pass |
| Floor 7 | `floor.f07.witch`, `floor.f07.upgrade.r01`, `floor.f07.upgrade.r02`, `floor.f07.upgrade.threshold` | 2 | Pass | Pass | Pass | Pass | Pass |
| Floor 8 | `floor.f08.witch`, `floor.f08.upgrade.r01`, `floor.f08.upgrade.r02`, `floor.f08.upgrade.threshold` | 2 | Pass | Pass | Pass | Pass | Pass |
| Floor 9 | `floor.f09.witch`, `floor.f09.upgrade.r01`, `floor.f09.upgrade.r02`, `floor.f09.upgrade.threshold` | 2 | Pass | Pass | Pass | Pass | Pass |
| Floor 10 | `floor.f10.witch`, `floor.f10.upgrade.r01`, `floor.f10.upgrade.r02` | 2 | Pass | Pass | Pass | Pass | Pass |
| Boss and shared reveal | `boss.confrontation`, `ending.witch-death`, `ending.princess-reveal`, `ending.princess-human` | 2 | Pass | Pass | Pass | Pass | Pass |
| Kill branch | `ending.kill` | 2 | Pass | Pass | Pass | Pass | Pass |
| Timeout branch | `ending.timeout`, `ending.timeout-final` | 2 | Pass | Pass | Pass | Pass | Pass |

## Knowledge-state and forbidden-disclosure audit

The pre-reveal boundary ends when `ending.princess-human` begins.

| Prohibited pre-reveal disclosure | Result |
|---|---|
| Elowen's forbidden practice is named | Absent |
| Elowen's research or preservation experiment is described | Absent |
| Elowen is identified as the creator of enemies | Absent |
| Elowen is said to be incurable or required to die | Absent |
| Elowen is identified as the current root | Absent |
| Witch is identified as an ancient protector | Absent |
| Zephyr accepts the true rescue/containment model | Absent |

Allowed clues remain indirect: incomplete control, signal unreliability, ordered
versus tearing arrivals, matching residue, shortening lucid intervals, and the
keeper/prison distinction. Floor 10 states that the same influence drew unstable
dead through the wards, but neither character names the practice, its history,
or Elowen as a deliberate enemy commander. Zephyr continues to demand the answer
from Elowen.

`ending.princess-human` contains the first direct disclosure. Elowen identifies
her act, compresses compassion → apparent success → certainty into a brief
confession, confirms the Witch's containment, rejects a cure, and requests death.
The scene makes her responsible without turning the lucid fragment into an
innocent passenger.

## Elowen progression audit

| Stage | Evidence | Result |
|---|---|---|
| Domestic | Genuine warmth, practical compassion, guarded certainty around a damaged book. | Pass |
| Floors 1–2 | Care centers Zephyr's survival and leaves him agency. | Pass |
| Floors 3–4 | Warmth carries seal-breaking and movement requests. | Pass |
| Floor 5 | Cost gives way to possession and intolerance of loss. | Pass |
| Floor 6 | `f06.r01` has the only conspicuous fracture; later scenes overcorrect without a second grotesque rupture. | Pass |
| Floor 7 | Foreknowledge, harsher language, and explicit demand for Witch's death. | Pass |
| Floor 8 | Command, ownership, genuine warning, hijack, and obedience sting. | Pass |
| Floor 9 | Origin distinction, two-tap human plea, reversal, and breath-as-control. | Pass |
| Floor 10 | Wounds become inconvenient; Witch's death outranks Zephyr; one filtered warning survives. | Pass |
| Reveal | Corruption celebrates steering; human Elowen accepts responsibility and requests death. | Pass |

The progression is cumulative. Human fragments interrupt it without implying a
reversal or secret cure.

## Voice differentiation

| Speaker | Beats | Displayed words | Average words per beat | Questions | Distinguishing behavior |
|---|---:|---:|---:|---:|---|
| Zephyr | 165 | 1,756 | 10.6 | 19 | Short concrete questions, refusals, decisions, and physical facts. |
| Princess Elowen | 128 | 1,852 | 14.5 | 11 | Domestic observation shifts into redirection, command, and ownership. |
| The Witch | 46 | 745 | 16.2 | 0 | Measured classifications and conclusions; no emotional interrogation. |

The Witch's zero-question pattern is intentional: she observes rather than asks
Zephyr to supply exposition. Zephyr's shorter average reflects his pressure
response. Elowen's longer average carries intimacy, evasion, and later control.

## Repetition matrix

| Element | Distribution | Decision |
|---|---|---|
| “Two taps. Come home.” | `opening.ring.b03` and `ending.kill.b07` | Approved exact callback; the domestic ritual becomes an alarm, then Zephyr's final act of listening. |
| Ring/thread | Opening and early floors; becomes steering at reveal | Approved transformed motif. |
| Breath | Early care, later surveillance, final five-second urgency | Approved transformed motif. |
| Broken book/page | Domestic opening and kill ending | Approved thematic closure, not repeated exposition. |
| “Love” | Bond explanation, limited reassurance, reveal/ending recontextualization | Controlled. |
| “Hurry” | Reserved for late-stage urgency | Controlled. |
| Witch warnings | Exposure → control → signal → ownership → arrivals → deterioration → residue → prognosis → hijack → consequence | No adjacent duplicate function. |
| Zephyr denial | Each denial is followed by an action, question, or narrower claim | No static repetition. |

No other exact displayed line is duplicated. Opening-word counts are led by
pronouns because the corpus is direct conversation, but no neighboring exchange
uses the same syntactic opening as a refrain without changed meaning.

## Ending-order audit

Required order is preserved:

1. `boss.confrontation` completes before combat.
2. `ending.witch-death` completes before Witch-origin cleanup.
3. Ordered magic ceases while unstable forces remain.
4. `ending.princess-reveal` presents corrupted triumph and Zephyr's realization.
5. `ending.princess-human` ends with the final human plea.
6. `ending.decision` begins once, with no dialogue.
7. Kill: strike first, then `ending.kill`, corruption ends, fade, completion.
8. Timeout: `ending.timeout`, fatal strike, `ending.timeout-final`, fade,
   completion.
9. Glossary access follows completed fade/outcome, never ordinary death.

## Resolved issue ledger

| ID | Severity | First-pass issue | Resolution | Recheck |
|---|---|---|---|---|
| NAR-001 | Blocker | Existing canon called the Prince unnamed and left Elowen's motive unspecified. | Updated narrative bible to record only the approved supersessions. | Pass |
| NAR-002 | Blocker | Existing plan described upgrade exchanges as inline. | Defined all 29 as separate full-screen scenes preceding offers. | Pass |
| NAR-003 | Blocker | Initial complete corpus measured 3,572 unique words; both routes were below 4,000. | Added character-specific reaction, subtext, and relationship beats across the route. Final routes are 4,237 and 4,266 words. | Pass |
| NAR-004 | High | Expanded dialogue risked repeating warnings to satisfy length. | Gave every projection a different evidentiary function and expanded reactions rather than explanations. | Pass |
| NAR-005 | High | Motivation could leak through the domestic opening. | Limited opening hints to compassion, secrecy, and aversion to giving up on damaged things. Research appears only in the finale. | Pass |
| NAR-006 | High | Floor-six fracture could become a sudden personality switch. | Limited conspicuous violent language to `f06.r01`; following scenes show overcorrection and impatience. | Pass |
| NAR-007 | Medium | Exact “Two taps. Come home.” line is duplicated. | Retained as the single intentional verbatim callback; its context changes from ritual to alarm. | Accepted |
| NAR-008 | High | Finale confession risked becoming a lore dump. | Reduced it to personal action, mistaken evidence, escalating certainty, responsibility, and immediate need. Witch history remains absent. | Pass |
| NAR-009 | High | Timeout could imply Zephyr lacked information rather than failed to act. | Elowen states that he heard clearly and waited for a rescuing answer; his final realization confirms refusal. | Pass |
| NAR-010 | Medium | Full-screen staging metadata was absent from legacy content. | Every final beat now has expression, pose, stage, and background metadata. | Pass |
| NAR-011 | High | The scene-card contract incorrectly implied every planning field was duplicated inside the corpus. | Clarified the implementation record split: runtime-facing beats and staging live in the corpus; purpose, progression, knowledge change, budgets, and deterministic next-state rules live in the floor plan. | Pass |
| NAR-012 | High | The Witch's final spoken beat used a dissolving pose before her line had completed. | Kept her in `final-speaking-kneel`; body dissolution and ordered-light cleanup begin only after the scene completion boundary. | Pass |

## Acceptance closure

- Runtime content preserves the audited IDs and ending order; `DIALOGUE.md` is the exact editor-facing mirror.
- Every expression, pose, stage, art state, and background key resolves through the approved 29-state/41-background manifest.
- Automated tests cover the 49-sequence registry, 29 upgrade scenes, route lengths, disclosure boundary, reader rules, and exactly-once ending behavior.
- Executed production-preview layout, input, route, and both-ending evidence is recorded in `docs/MANUAL_NARRATIVE_QA.md` and `docs/FINAL_ACCEPTANCE.md`.
