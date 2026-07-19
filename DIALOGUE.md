# Dialogue

This file is the editor-facing mirror of every displayed dialogue beat in the game. The runtime source of truth is `src/game/dialogueContent.js`.

- Keep sequence IDs, beat IDs, row order, and metadata columns intact.
- Edit only the text in the **Displayed dialogue** column for ordinary dialogue revisions.
- Future implementation work should reconcile edits by stable **Beat ID**, never by row number or text matching.
- Speaker keys map to display names as follows: `prince` → Zephyr, `princess` → Princess Elowen, and `witch` → The Witch.
- `ending.decision` is a nondialogue gameplay decision and is intentionally excluded from this 49-sequence registry.

**Coverage:** 49 sequences · 339 dialogue beats

## `opening.domestic`

- Presentation: `vn`
- Repeat: `oncePerRun`
- Scene role: `domestic`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| opening.domestic.b01 | prince | fond | doorway-relaxed | left | royal-study-evening | prince.affectionate | The west corridor is dark, the supper tray is cold, and my wife is hiding from sleep behind a tower of books. A remarkable mystery. |
| opening.domestic.b02 | princess | absorbed | seated-repairing-book | right | royal-study-evening | princess.human | Hiding suggests I expect sleep to search intelligently. It has never shown that kind of initiative. |
| opening.domestic.b03 | prince | amused | crossing-arms | left | royal-study-evening | prince.affectionate | You said one page. That was before the second lamp burned down. |
| opening.domestic.b04 | princess | wry | showing-torn-page | right | royal-study-evening | princess.affectionate | It was one page when I said it. Then the binding confessed to several related crimes. |
| opening.domestic.b05 | prince | affectionate | leaning-over-chair | center-left | royal-study-evening | prince.affectionate | Give it to the bindery tomorrow. They have glue, thread, and the useful habit of going home at night. |
| opening.domestic.b06 | princess | gentle | shielding-book | right | royal-study-evening | princess.affectionate | This belonged to Mara's mother. The child remembers the pressed flowers, not the words. If I replace the page, she keeps both. |
| opening.domestic.b07 | prince | soft | touching-book-edge | center-left | royal-study-evening | prince.affectionate | You cannot personally rescue every broken thing in the palace. |
| opening.domestic.b08 | princess | distant | looking-at-page | right | royal-study-evening | princess.human | No. But “broken” is too often what people call something before they stop trying. |
| opening.domestic.b09 | prince | watchful | straightening | left | royal-study-evening | prince.alarmed | That sounded less like a book and more like an argument you have not invited me to. |
| opening.domestic.b10 | princess | brightening | closing-book | right | royal-study-evening | princess.affectionate | I invited you to supper. You arrived after the potatoes surrendered. Let us finish one dispute at a time. |
| opening.domestic.b11 | prince | dry | offering-hand | center-left | royal-study-evening | prince.calm | The potatoes had poor discipline. I accept no responsibility. Come to bed. |
| opening.domestic.b12 | princess | tender | taking-hand | center | royal-study-evening | princess.affectionate | In a moment. Your ring is warm again. You were worrying at it during council. |
| opening.domestic.b13 | prince | embarrassed | turning-ring | center-left | royal-study-evening | prince.calm | It pulls when you shut me out. Very dignified magic for a royal marriage. |
| opening.domestic.b14 | princess | affectionate | touching-rings | center | royal-study-evening | princess.affectionate | It carries presence, not accusations. The accusations are entirely your craftsmanship. |
| opening.domestic.b15 | prince | fond | tapping-ring-twice | center-left | royal-study-evening | prince.affectionate | Two taps means come home. We agreed. |
| opening.domestic.b16 | princess | strained | holding-his-hand | center | royal-study-evening | princess.human | We agreed it means I am here. Home is a larger promise. |
| opening.domestic.b17 | prince | concerned | searching-her-face | center-left | royal-study-evening | prince.alarmed | Elowen. What have you taken on? |
| opening.domestic.b18 | princess | evasive-warm | resting-forehead-to-hand | center | royal-study-evening | princess.affectionate | A torn book, a defeated supper, and a husband who believes questions become lighter if he asks them standing up. Sit with me. |
| opening.domestic.b19 | prince | affectionate | sitting-beside | center-left | royal-study-evening | prince.affectionate | Until the lamp goes out. Then I carry you upstairs and scandalize the night guard. |
| opening.domestic.b20 | princess | relieved | leaning-against-him | center | royal-study-evening | princess.affectionate | Let him be scandalized. Just stay until I close this page. |
| opening.domestic.b21 | prince | content | arm-around-her | center-left | royal-study-evening | prince.affectionate | I can do that. But if dawn finds us here, I am blaming the book in the official record. |

## `opening.ring`

- Presentation: `vn`
- Repeat: `oncePerRun`
- Scene role: `ringPursuit`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| opening.ring.b01 | prince | waking-alarmed | reaching-across-bed | left | royal-chamber-dawn | prince.alarmed | Elowen? Your side is cold. |
| opening.ring.b02 | prince | searching | holding-folded-blanket | center-left | royal-chamber-dawn | prince.alarmed | No cloak. No note. The study door open, the book still under the lamp. You never leave a page unfinished. |
| opening.ring.b03 | prince | focused | tapping-ring-twice | center | royal-chamber-dawn | prince.determined | Two taps. Come home. |
| opening.ring.b04 | princess | frightened | distant-cutout | right | ring-void | princess.frightened | Zephyr— |
| opening.ring.b05 | prince | shocked | braced | center-left | ring-void | prince.alarmed | I hear you. Hold the thread. Tell me where. |
| opening.ring.b06 | princess | pained | reaching-through-dark | right | ring-void | princess.frightened | Below. So far below. She—please— |
| opening.ring.b07 | prince | urgent | hand-to-ring | center-left | ring-void | prince.alarmed | Who has you? Elowen, answer me. |
| opening.ring.b08 | princess | fading | hand-lowering | right | ring-void | princess.frightened | Follow. |
| opening.ring.b09 | prince | determined | fastening-armor | left | royal-armory-morning | prince.determined | The pull runs north beneath the old road. Every step away tightens it. You are alive. That is enough to begin. |
| opening.ring.b10 | prince | grim | mounting-scythe | center | witch-domain-approach | prince.determined | Whoever took you left me a path. I will make them regret the courtesy. |
| opening.ring.b11 | prince | tender-resolved | tapping-ring-twice | center | witch-domain-approach | prince.affectionate | Two taps, Elowen. I am coming home by the road you left me, and I am bringing you with me. |

## `opening.threshold`

- Presentation: `vn`
- Repeat: `oncePerRun`
- Scene role: `threshold`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| opening.threshold.b01 | witch | clinical | projection-still | right | dungeon-threshold | witch.clinical | The road remains open behind you. The threshold ahead will not offer the same courtesy. |
| opening.threshold.b02 | prince | determined | scythe-lowered | left | dungeon-threshold | prince.determined | Where is my wife? |
| opening.threshold.b03 | witch | unreadable | hands-folded | right | dungeon-threshold | witch.clinical | Contained beyond your reach. Leave while distance can still protect your judgment. |
| opening.threshold.b04 | prince | angry-contained | stepping-forward | left | dungeon-threshold | prince.enraged | You took her from our rooms. Release her. |
| opening.threshold.b05 | witch | clinical | projection-still | right | dungeon-threshold | witch.clinical | I took her. I will not release her. |
| opening.threshold.b06 | prince | resolute | gripping-scythe | left | dungeon-threshold | prince.resolved | Then I open the way myself. |
| opening.threshold.b07 | witch | warning | one-hand-raised | right | dungeon-threshold | witch.warning | You have contact, fear, and a direction. You have mistaken that collection for understanding. |
| opening.threshold.b08 | prince | wounded | hand-over-ring | left | dungeon-threshold | prince.injured | I have her voice. I felt her pain. |
| opening.threshold.b09 | witch | severe | lowering-hand | right | dungeon-threshold | witch.warning | Contact is not consent. Pain is not instruction. Turn back. |
| opening.threshold.b10 | prince | absolute | scythe-ready | left | dungeon-threshold | prince.resolved | She is alive. You are keeping her. I am coming through. |
| opening.threshold.b11 | witch | resigned | projection-fading | right | dungeon-threshold | witch.acceptance | Then observe what resists you. It may be the last honest counsel you accept. |
| opening.threshold.b12 | prince | cold | entering-threshold | left | dungeon-threshold | prince.resolved | Counsel begins with a reason. You gave me a threat and expected obedience. |

## `floor.f01.witch`

- Presentation: `vn`
- Repeat: `oncePerRun`
- Scene role: `floorProjection`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f01.witch.b01 | witch | clinical | projection-still | right | biome-crypt-graded | witch.clinical | Your pulse rises when the ring warms. Your grip tightens before her voice finishes. That is exposure, not resolve. |
| floor.f01.witch.b02 | prince | dismissive | scythe-shouldered | left | biome-crypt-graded | prince.resolved | You mistake devotion for a weakness you can measure. |
| floor.f01.witch.b03 | witch | precise | hands-folded | right | biome-crypt-graded | witch.clinical | I measure its effect. You surrender judgment to anything that sounds like hope. |
| floor.f01.witch.b04 | prince | determined | turning-away | left | biome-crypt-graded | prince.determined | Then stop talking and watch me reach her. |
| floor.f01.witch.b05 | witch | unreadable | projection-fading | right | biome-crypt-graded | witch.clinical | I will watch. Observation is the one service you cannot refuse from me. |

## `floor.f01.upgrade.r01`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f01.upgrade.r01.b01 | princess | relieved | reaching-forward | right | biome-crypt-soft | princess.affectionate | Zephyr. There you are. I could feel you at the threshold, but not whether you crossed it standing. |
| floor.f01.upgrade.r01.b02 | prince | relieved-contained | hand-to-ring | left | biome-crypt-soft | prince.calm | I am standing. Tell me how you reached me. |
| floor.f01.upgrade.r01.b03 | princess | gentle | touching-ring | right | biome-crypt-soft | princess.affectionate | This place presses on the bond between our rings. Our love gives it shape. I can send a little strength back along the thread. |
| floor.f01.upgrade.r01.b04 | prince | focused | offering-ring-hand | left | biome-crypt-soft | prince.resolved | Will it hurt you? |
| floor.f01.upgrade.r01.b05 | princess | reassuring | open-palm | right | biome-crypt-soft | princess.human | Less than hearing you fight empty-handed. Choose what keeps you moving, and let me carry one part of the weight. |
| floor.f01.upgrade.r01.b06 | prince | tender | slight-nod | left | biome-crypt-soft | prince.affectionate | Only one part. I am still coming for the rest. |
| floor.f01.upgrade.r01.b07 | princess | affectionate | palm-over-heart | right | biome-crypt-soft | princess.affectionate | I know. That certainty used to frighten ministers. Today it is the sound I needed. |

## `floor.f01.upgrade.r02`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f01.upgrade.r02.b01 | princess | concerned | studying-him | right | biome-crypt-soft | princess.frightened | Your left shoulder drops when you are hurt. It has since the winter tournament. |
| floor.f01.upgrade.r02.b02 | prince | dry | rolling-shoulder | left | biome-crypt-soft | prince.calm | An excellent marriage. Even captivity has not spared me observation. |
| floor.f01.upgrade.r02.b03 | princess | fond | almost-smiling | right | biome-crypt-soft | princess.affectionate | Captivity has improved my view of your bad habits. Take something that lets the shoulder rest. |
| floor.f01.upgrade.r02.b04 | prince | affectionate | adjusting-grip | left | biome-crypt-soft | prince.affectionate | Then I will weigh rest against ending the next fight sooner. A compromise. |
| floor.f01.upgrade.r02.b05 | princess | warm | nodding | right | biome-crypt-soft | princess.affectionate | A familiar word from you, used incorrectly as ever. Still—choose. |
| floor.f01.upgrade.r02.b06 | prince | fond | reaching-to-offer | left | biome-crypt-soft | prince.affectionate | If the choice works, history will forgive my definition. It has endured worse from our court. |

## `floor.f01.upgrade.threshold`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f01.upgrade.threshold.b01 | princess | gentle | listening | right | crypt-threshold-soft | princess.affectionate | You are breathing through your teeth. Stop before the next stair. |
| floor.f01.upgrade.threshold.b02 | prince | tired | scythe-grounded | left | crypt-threshold-soft | prince.injured | If I stop, the distance notices. |
| floor.f01.upgrade.threshold.b03 | princess | affectionate | seated-memory | right | crypt-threshold-soft | princess.affectionate | The distance has no authority here. Remember the study? You stayed until I closed the page. Let me stay while you catch your breath. |
| floor.f01.upgrade.threshold.b04 | prince | softened | sitting | left | crypt-threshold-soft | prince.affectionate | The lamp went out first. You claimed that counted. |
| floor.f01.upgrade.threshold.b05 | princess | wry | hand-to-ring | right | crypt-threshold-soft | princess.affectionate | I was right. I am also right now. Breathe, choose, then come closer. |
| floor.f01.upgrade.threshold.b06 | prince | steadied | rising | left | crypt-threshold-soft | prince.resolved | Better. Keep the memory warm. I will need it when the next room tries to sound like the last. |

## `floor.f02.witch`

- Presentation: `vn`
- Repeat: `oncePerRun`
- Scene role: `floorProjection`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f02.witch.b01 | witch | clinical | projection-observing | right | biome-catacomb-graded | witch.clinical | Her release remains an unacceptable outcome. Your presence has also produced responses below that I did not order. |
| floor.f02.witch.b02 | prince | accusatory | scythe-forward | left | biome-catacomb-graded | prince.enraged | Your dead claw at me, and you call them an observation. |
| floor.f02.witch.b03 | witch | precise | indicating-arena | right | biome-catacomb-graded | witch.clinical | Some arrive in formation. Others arrive as if formation itself offended them. I advise you to notice the difference. |
| floor.f02.witch.b04 | prince | dismissive | turning-away | left | biome-catacomb-graded | prince.resolved | I notice every path leads through you. |
| floor.f02.witch.b05 | witch | restrained | projection-fading | right | biome-catacomb-graded | witch.clinical | A path can cross a keeper without originating from her. That distinction will matter whether you accept it or not. |

## `floor.f02.upgrade.r01`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f02.upgrade.r01.b01 | princess | worried | hand-to-chest | right | biome-catacomb-soft | princess.frightened | That last blow reached me through the ring. Not the pain exactly—the shock after it. |
| floor.f02.upgrade.r01.b02 | prince | reassuring | checking-wound | left | biome-catacomb-soft | prince.affectionate | A shallow cut. It looks dramatic because armor enjoys gossip. |
| floor.f02.upgrade.r01.b03 | princess | restrained-amusement | exhaling | right | biome-catacomb-soft | princess.affectionate | Your armor learned from you. Choose defense this time. Humor me. |
| floor.f02.upgrade.r01.b04 | prince | fond | open-hand | left | biome-catacomb-soft | prince.affectionate | I will consider defense among the available ways to end danger. |
| floor.f02.upgrade.r01.b05 | princess | tender | touching-ring | right | biome-catacomb-soft | princess.affectionate | Consider quickly, stubborn man. I would like all of you to arrive. |
| floor.f02.upgrade.r01.b06 | prince | reassuring | securing-armor | left | biome-catacomb-soft | prince.affectionate | Then all of me will. The shoulder, the armor, and the bad judgment you insist belongs to both. |

## `floor.f02.upgrade.r02`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f02.upgrade.r02.b01 | princess | calm | holding-ring-hand | right | biome-catacomb-soft | princess.human | The thread steadies when you are still. I can hold it while you decide. |
| floor.f02.upgrade.r02.b02 | prince | watchful | lowering-scythe | left | biome-catacomb-soft | prince.alarmed | I thought I was holding it for you. |
| floor.f02.upgrade.r02.b03 | princess | warm | open-palm | right | biome-catacomb-soft | princess.affectionate | Both can be true. That was the point of the rings, unless you slept through the vows. |
| floor.f02.upgrade.r02.b04 | prince | dry | slight-smile | left | biome-catacomb-soft | prince.calm | I remember correcting the officiant's map of the eastern marches. |
| floor.f02.upgrade.r02.b05 | princess | amused | head-tilt | right | biome-catacomb-soft | princess.affectionate | During the vows. Yes. I married you despite compelling evidence. Choose. |
| floor.f02.upgrade.r02.b06 | prince | affectionate | hand-over-ring | left | biome-catacomb-soft | prince.affectionate | And I married the only witness willing to correct me before the ceremony ended. Hold the thread. |

## `floor.f02.upgrade.threshold`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f02.upgrade.threshold.b01 | princess | intent | eyes-closed-listening | right | catacomb-threshold-soft | princess.strained | Closer. I can hear the catch between your breaths now, just before you pretend you are not tired. |
| floor.f02.upgrade.threshold.b02 | prince | surprised | glancing-around | left | catacomb-threshold-soft | prince.alarmed | You could never hear that across a room. |
| floor.f02.upgrade.threshold.b03 | princess | gentle | touching-ring | right | catacomb-threshold-soft | princess.affectionate | The bond is sharper here. Everything is. I would trade the clarity for one ordinary room. |
| floor.f02.upgrade.threshold.b04 | prince | softened | hand-over-ring | left | catacomb-threshold-soft | prince.affectionate | Keep listening. I will give you a door instead. |
| floor.f02.upgrade.threshold.b05 | princess | hopeful | reaching-forward | right | catacomb-threshold-soft | princess.corrupt-1 | Then take what opens it. |
| floor.f02.upgrade.threshold.b06 | prince | resolute | facing-stair | left | catacomb-threshold-soft | prince.resolved | The door first. The ordinary room after. I have not surrendered either promise. |

## `floor.f03.witch`

- Presentation: `vn`
- Repeat: `oncePerRun`
- Scene role: `floorProjection`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f03.witch.b01 | witch | clinical | projection-still | right | biome-ossuary-graded | witch.clinical | A signal proves contact. It does not prove that every impulse crossing it belongs to the person you remember. |
| floor.f03.witch.b02 | prince | guarded | hand-over-ring | left | biome-ossuary-graded | prince.resolved | You cannot make me distrust my wife because your prison frightens her. |
| floor.f03.witch.b03 | witch | precise | one-hand-open | right | biome-ossuary-graded | witch.clinical | Trust is not the variable. Contamination does not require your consent, only an open channel. |
| floor.f03.witch.b04 | prince | cold | stepping-past | left | biome-ossuary-graded | prince.resolved | Then you should not have given me a reason to keep it open. |
| floor.f03.witch.b05 | witch | grave | projection-dimming | right | biome-ossuary-graded | witch.clinical | I did not give you the reason. I am telling you that the reason has learned how to use the opening. |

## `floor.f03.upgrade.r01`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f03.upgrade.r01.b01 | princess | hurt | arms-close | right | biome-ossuary-soft | princess.frightened | She spoke about the ring again. As if our life together were an exposed wound she could classify. |
| floor.f03.upgrade.r01.b02 | prince | reassuring | facing-her | left | biome-ossuary-soft | prince.affectionate | She spoke. I kept walking. |
| floor.f03.upgrade.r01.b03 | princess | searching | reaching-halfway | right | biome-ossuary-soft | princess.frightened | Is that all? No doubt at all? |
| floor.f03.upgrade.r01.b04 | prince | honest | hand-to-ring | left | biome-ossuary-soft | prince.calm | I doubt only her account. Not that you are frightened, not that she took you, and not that I know your voice. |
| floor.f03.upgrade.r01.b05 | princess | relieved | lowering-shoulders | right | biome-ossuary-soft | princess.affectionate | Good. Hold to that. Choose something she cannot turn into another delay. |
| floor.f03.upgrade.r01.b06 | prince | protective | lifting-scythe | left | biome-ossuary-soft | prince.resolved | Whatever she says, you do not have to defend our marriage from her. I will do that by reaching you. |

## `floor.f03.upgrade.r02`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f03.upgrade.r02.b01 | princess | intent | leaning-forward | right | biome-ossuary-soft | princess.strained | The distance folded when that chamber fell. I felt you arrive before the last echo stopped. |
| floor.f03.upgrade.r02.b02 | prince | concerned | wiping-blade | left | biome-ossuary-soft | prince.alarmed | You are measuring floors now. Yesterday you could barely speak. |
| floor.f03.upgrade.r02.b03 | princess | reassuring | hand-to-ring | right | biome-ossuary-soft | princess.corrupt-1 | The bond strengthens as you descend. Let one mercy live in this place. |
| floor.f03.upgrade.r02.b04 | prince | resolved | sheathing-scythe | left | biome-ossuary-soft | prince.resolved | A mercy would be knowing what she has done to you. |
| floor.f03.upgrade.r02.b05 | princess | evasive | looking-aside | right | biome-ossuary-soft | princess.corrupt-1 | Reach me first. Questions will survive the distance. I am less certain we will. |
| floor.f03.upgrade.r02.b06 | prince | concerned | searching-her-face | left | biome-ossuary-soft | prince.alarmed | We survived years of questions. Do not make the distance sound hungrier than it is. |

## `floor.f03.upgrade.threshold`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f03.upgrade.threshold.b01 | princess | urgent | palm-against-barrier | right | ossuary-threshold-soft | princess.frightened | The next seal is thicker. I feel it pressing back whenever the ring warms. |
| floor.f03.upgrade.threshold.b02 | prince | focused | examining-door | left | ossuary-threshold-soft | prince.resolved | Can you weaken it from your side? |
| floor.f03.upgrade.threshold.b03 | princess | strained | pushing-palm | right | ossuary-threshold-soft | princess.strained | Not without losing the thread. Break it from yours, and I can keep the opening from closing. |
| floor.f03.upgrade.threshold.b04 | prince | suspicious | studying-her | left | ossuary-threshold-soft | prince.doubtful | You know the locks well for a prisoner. |
| floor.f03.upgrade.threshold.b05 | princess | pained | withdrawing-hand | right | ossuary-threshold-soft | princess.frightened | I know what has pressed against me. Please, Zephyr. Choose, then break it. |
| floor.f03.upgrade.threshold.b06 | prince | resolved-uneasy | touching-seal | left | ossuary-threshold-soft | prince.doubtful | I will break the lock. When I reach you, we begin with the questions you keep postponing. |

## `floor.f04.witch`

- Presentation: `vn`
- Repeat: `oncePerRun`
- Scene role: `floorProjection`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f04.witch.b01 | witch | observing | projection-turned | right | biome-ruins-graded | witch.observing | The responses below are losing consistency. Some defend thresholds. Others abandon position merely to reach you. |
| floor.f04.witch.b02 | prince | accusatory | scythe-forward | left | biome-ruins-graded | prince.enraged | Call them off. |
| floor.f04.witch.b03 | witch | clinical | hands-folded | right | biome-ruins-graded | witch.clinical | You continue to misunderstand the word “mine.” |
| floor.f04.witch.b04 | prince | grim | stepping-forward | left | biome-ruins-graded | prince.resolved | I understand that every answer from you protects the same locked door. |
| floor.f04.witch.b05 | witch | exact | projection-fading | right | biome-ruins-graded | witch.clinical | Correct. You have not yet asked what the door protects from what. |

## `floor.f04.upgrade.r01`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f04.upgrade.r01.b01 | princess | attentive | studying-posture | right | biome-ruins-soft | princess.corrupt-1 | You are putting more weight on the scythe between steps. Your knees hurt. |
| floor.f04.upgrade.r01.b02 | prince | dry | standing-straight | left | biome-ruins-soft | prince.calm | My knees have filed no complaint. |
| floor.f04.upgrade.r01.b03 | princess | fond | hands-on-hips | right | biome-ruins-soft | princess.affectionate | They complained through an entire harvest festival. I remember because you blamed the ceremonial boots. |
| floor.f04.upgrade.r01.b04 | prince | affectionate | slight-smile | left | biome-ruins-soft | prince.affectionate | The boots were an act of war. |
| floor.f04.upgrade.r01.b05 | princess | warm | open-palm | right | biome-ruins-soft | princess.affectionate | Then prepare for another. Choose what lets you move without borrowing pain from tomorrow. |
| floor.f04.upgrade.r01.b06 | prince | softened | hand-to-ring | left | biome-ruins-soft | prince.affectionate | There you are. For one breath, this sounds like our study instead of her prison. |

## `floor.f04.upgrade.r02`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f04.upgrade.r02.b01 | princess | urgent | looking-behind | right | biome-ruins-soft | princess.frightened | The barrier behind you is knitting itself closed. She is buying time with every pause. |
| floor.f04.upgrade.r02.b02 | prince | alert | glancing-back | left | biome-ruins-soft | prince.alarmed | It opened after the room fell. Why close it now? |
| floor.f04.upgrade.r02.b03 | princess | tense | gripping-ring | right | biome-ruins-soft | princess.frightened | Because you are closer than she expected. Do not let her repair what you have broken. |
| floor.f04.upgrade.r02.b04 | prince | searching | facing-her | left | biome-ruins-soft | prince.alarmed | You sound as if you can see it. |
| floor.f04.upgrade.r02.b05 | princess | evasive | eyes-down | right | biome-ruins-soft | princess.corrupt-2 | I feel every lock between us. Take the quickest answer and move. |
| floor.f04.upgrade.r02.b06 | prince | guarded | turning-to-door | left | biome-ruins-soft | prince.resolved | I will move. I will also remember that you answered the lock and not the question. |

## `floor.f04.upgrade.threshold`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f04.upgrade.threshold.b01 | princess | yearning | reaching-forward | right | ruins-threshold-soft | princess.corrupt-2 | When this one opens, the pull should be strong enough to feel like a hand. |
| floor.f04.upgrade.threshold.b02 | prince | tender | lifting-ring-hand | left | ruins-threshold-soft | prince.affectionate | Yours? |
| floor.f04.upgrade.threshold.b03 | princess | intimate | palm-raised | right | ruins-threshold-soft | princess.corrupt-2 | Who else's would you follow this far? |
| floor.f04.upgrade.threshold.b04 | prince | quiet | matching-palm | left | ruins-threshold-soft | prince.calm | No one's. That is why the Witch's warnings fail. |
| floor.f04.upgrade.threshold.b05 | princess | intent | fingers-closing | right | ruins-threshold-soft | princess.strained | Then choose. Break the lock. Put your hand back in mine. |
| floor.f04.upgrade.threshold.b06 | prince | devoted | matching-grip | left | ruins-threshold-soft | prince.affectionate | It never left. That is why I can feel how hard you are pulling. |

## `floor.f05.witch`

- Presentation: `vn`
- Repeat: `oncePerRun`
- Scene role: `floorProjection`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f05.witch.b01 | witch | observing | indicating-ranks | right | biome-charnel-graded | witch.observing | Watch their arrivals. Mine enter where the ward permits, in ranks, facing outward. The others tear through wherever your presence draws them. |
| floor.f05.witch.b02 | prince | skeptical | scythe-lowered | left | biome-charnel-graded | prince.doubtful | Another distinction only you can verify. Convenient. |
| floor.f05.witch.b03 | witch | clinical | projection-still | right | biome-charnel-graded | witch.clinical | The floor verifies it. Spacing, posture, residue. Observation requires no trust. |
| floor.f05.witch.b04 | prince | guarded | looking-past | left | biome-charnel-graded | prince.resolved | And what conclusion have you prepared for me? |
| floor.f05.witch.b05 | witch | precise | hands-folded | right | biome-charnel-graded | witch.clinical | None. A conclusion you are given can be refused. A pattern you notice must be carried. |
| floor.f05.witch.b06 | prince | unsettled | looking-at-arena | left | biome-charnel-graded | prince.doubtful | I will carry what I see. Do not mistake that for carrying your judgment with it. |

## `floor.f05.upgrade.r01`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f05.upgrade.r01.b01 | princess | intense | inspecting-him | right | biome-charnel-soft | princess.strained | Hold still. The ring keeps losing the edges of you whenever you bleed. |
| floor.f05.upgrade.r01.b02 | prince | concerned | checking-ring | left | biome-charnel-soft | prince.alarmed | Losing them to what? |
| floor.f05.upgrade.r01.b03 | princess | possessive-soft | reaching-forward | right | biome-charnel-soft | princess.possessive | Distance. Her wards. All the little things trying to decide how much of you reaches me. |
| floor.f05.upgrade.r01.b04 | prince | reassuring | squaring-shoulders | left | biome-charnel-soft | prince.affectionate | Enough will reach you. |
| floor.f05.upgrade.r01.b05 | princess | fixed | hand-closing | right | biome-charnel-soft | princess.possessive | I do not want enough. Choose something that leaves nothing behind. |
| floor.f05.upgrade.r01.b06 | prince | uneasy | drawing-hand-back | left | biome-charnel-soft | prince.doubtful | Nothing left behind is not a promise anyone can make. Let me arrive before you ask it. |

## `floor.f05.upgrade.r02`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f05.upgrade.r02.b01 | princess | impatient | open-palm | right | biome-charnel-soft | princess.commanding | Stop weighing every cost. Choose what ends the next fight before it begins. |
| floor.f05.upgrade.r02.b02 | prince | taken-aback | lowering-hand | left | biome-charnel-soft | prince.doubtful | You used to say a cost ignored becomes someone else's wound. |
| floor.f05.upgrade.r02.b03 | princess | strained | looking-away | right | biome-charnel-soft | princess.strained | I used to say that in rooms with windows. Here, caution is another hand on the door. |
| floor.f05.upgrade.r02.b04 | prince | watchful | studying-her | left | biome-charnel-soft | prince.alarmed | Fear never made you careless. |
| floor.f05.upgrade.r02.b05 | princess | defensive-warm | hand-to-heart | right | biome-charnel-soft | princess.corrupt-2 | It made me tired of losing things while careful people explained the necessity. Please. Take the stronger answer. |
| floor.f05.upgrade.r02.b06 | prince | troubled | considering-offer | left | biome-charnel-soft | prince.doubtful | I will choose for the room ahead because it is real. We will speak about the rest where I can see you. |

## `floor.f05.upgrade.threshold`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f05.upgrade.threshold.b01 | princess | haunted | holding-ring | right | charnel-threshold-soft | princess.frightened | This place has taken enough time from us. I can feel every closed door like a thing being carried away. |
| floor.f05.upgrade.threshold.b02 | prince | gentle | scythe-grounded | left | charnel-threshold-soft | prince.affectionate | Time is not gone because we cannot touch it. |
| floor.f05.upgrade.threshold.b03 | princess | distant | looking-through-him | right | charnel-threshold-soft | princess.corrupt-2 | That is what people say when they have decided loss is natural. |
| floor.f05.upgrade.threshold.b04 | prince | concerned | stepping-closer | left | charnel-threshold-soft | prince.alarmed | Elowen. Look at me. |
| floor.f05.upgrade.threshold.b05 | princess | recovering | meeting-his-gaze | right | charnel-threshold-soft | princess.strained | I am. I see you descending when every sensible part of you should turn back. Choose before the next door takes more. |
| floor.f05.upgrade.threshold.b06 | prince | gentle-firm | lifting-ring-hand | left | charnel-threshold-soft | prince.affectionate | The door takes distance. It does not take the years behind us. Let that be enough until I arrive. |

## `floor.f06.witch`

- Presentation: `vn`
- Repeat: `oncePerRun`
- Scene role: `floorProjection`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f06.witch.b01 | witch | observing | projection-close | right | biome-vault-graded | witch.observing | Her voice has changed. The pauses shorten, the imperatives multiply, and concern follows only after she hears herself. |
| floor.f06.witch.b02 | prince | defensive | scythe-between | left | biome-vault-graded | prince.resolved | You hurt her, then describe the sound as evidence. |
| floor.f06.witch.b03 | witch | clinical | hands-folded | right | biome-vault-graded | witch.clinical | Pain disrupts a person. Deterioration rearranges what the person values. I know the difference. |
| floor.f06.witch.b04 | prince | angry-contained | stepping-past | left | biome-vault-graded | prince.enraged | You know conditions. You do not know Elowen. |
| floor.f06.witch.b05 | witch | severe | projection-fading | right | biome-vault-graded | witch.warning | Then listen for the moment she stops knowing you. |
| floor.f06.witch.b06 | prince | resolute | moving-on | left | biome-vault-graded | prince.resolved | I will listen to her, not to the verdict you have prepared around her. |

## `floor.f06.upgrade.r01`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f06.upgrade.r01.b01 | princess | impatient | thrusting-hand | right | biome-vault-soft | princess.commanding | Take the sharpest gift. Strip them to the bone and make the walls remember— |
| floor.f06.upgrade.r01.b02 | princess | horrified | covering-mouth | right | biome-vault-soft | princess.frightened | No. Zephyr, no. That was not what I meant to say. |
| floor.f06.upgrade.r01.b03 | prince | shaken | lowering-scythe | left | biome-vault-soft | prince.doubtful | I heard you. |
| floor.f06.upgrade.r01.b04 | princess | pleading | hands-open | right | biome-vault-soft | princess.frightened | She catches my words and bends them before they reach the ring. You know how I speak. You know what I would never ask. |
| floor.f06.upgrade.r01.b05 | prince | protective | gripping-ring | left | biome-vault-soft | prince.resolved | I know. Hold to my voice instead. |
| floor.f06.upgrade.r01.b06 | princess | fragile | nodding | right | biome-vault-soft | princess.frightened | I am trying. Choose something clean. Something you can still call your own. |
| floor.f06.upgrade.r01.b07 | prince | steadying-her | hand-over-ring | left | biome-vault-soft | prince.affectionate | My choice, my hand, my road. Hold to those facts until I can reach you. |

## `floor.f06.upgrade.r02`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f06.upgrade.r02.b01 | princess | deliberately-gentle | seated-memory | right | biome-vault-soft | princess.corrupt-3 | Do you remember the rain inside the east gallery? Every roof tile sound, no leak anywhere. |
| floor.f06.upgrade.r02.b02 | prince | cautious | scythe-grounded | left | biome-vault-soft | prince.doubtful | You made the guards move twelve paintings. The rain was a nesting bird. |
| floor.f06.upgrade.r02.b03 | princess | soft | small-smile | right | biome-vault-soft | princess.corrupt-3 | You complained for hours and moved the heaviest one yourself. See? I remember. I am still here. |
| floor.f06.upgrade.r02.b04 | prince | tender-uneasy | hand-to-ring | left | biome-vault-soft | prince.affectionate | You never had to prove that before. |
| floor.f06.upgrade.r02.b05 | princess | strained | open-palm | right | biome-vault-soft | princess.strained | I never had to speak through her walls. Let this gift be gentler than the last. |
| floor.f06.upgrade.r02.b06 | prince | uneasy-tender | hand-to-ring | left | biome-vault-soft | prince.affectionate | I remember the gallery. I also remember you never asking me to prove that I remembered. |

## `floor.f06.upgrade.threshold`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f06.upgrade.threshold.b01 | princess | tired | listening-away | right | vault-threshold-soft | princess.frightened | The next stair is open. Do not spend long deciding. |
| floor.f06.upgrade.threshold.b02 | prince | watchful | arms-lowered | left | vault-threshold-soft | prince.alarmed | A moment ago you wanted me careful. |
| floor.f06.upgrade.threshold.b03 | princess | controlled | clasping-hands | right | vault-threshold-soft | princess.strained | Careful, yes. Motionless, no. The walls settle around hesitation. |
| floor.f06.upgrade.threshold.b04 | prince | probing | slight-step | left | vault-threshold-soft | prince.doubtful | Is that what they do, or what you fear? |
| floor.f06.upgrade.threshold.b05 | princess | impatient-soft | reaching | right | vault-threshold-soft | princess.commanding | Does the difference help us? Choose. I need you moving again. |
| floor.f06.upgrade.threshold.b06 | prince | guarded | facing-stair | left | vault-threshold-soft | prince.resolved | It helps me know which answer is yours. I am moving, but I will keep asking. |

## `floor.f07.witch`

- Presentation: `vn`
- Repeat: `oncePerRun`
- Scene role: `floorProjection`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f07.witch.b01 | witch | clinical | holding-residue-light | right | biome-depths-graded | witch.clinical | The force strengthening you leaves the same residue as the unstable dead. It does not match my wards. |
| floor.f07.witch.b02 | prince | angry | scythe-ready | left | biome-depths-graded | prince.enraged | She would never send those things against me. |
| floor.f07.witch.b03 | witch | precise | releasing-residue | right | biome-depths-graded | witch.clinical | That answer assumes she can still choose one purpose and keep it. The evidence does not support your assumption. |
| floor.f07.witch.b04 | prince | defensive | hand-over-ring | left | biome-depths-graded | prince.resolved | The same bond lets her help me. You are making similarity carry your accusation. |
| floor.f07.witch.b05 | witch | severe | projection-still | right | biome-depths-graded | witch.warning | No. You are making affection erase a measurement. |
| floor.f07.witch.b06 | prince | unsettled | studying-residue | left | biome-depths-graded | prince.doubtful | A measurement is not a motive. Similar marks do not tell me who meant harm. |

## `floor.f07.upgrade.r01`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f07.upgrade.r01.b01 | princess | intent | looking-beyond-him | right | biome-depths-soft | princess.strained | Take something with reach. The next chamber opens narrow, then widens behind the second pillar. They will crowd the mouth. |
| floor.f07.upgrade.r01.b02 | prince | suspicious | glancing-back | left | biome-depths-soft | prince.doubtful | I have not opened that door. |
| floor.f07.upgrade.r01.b03 | princess | too-calm | touching-ring | right | biome-depths-soft | princess.possessive | I feel the shape of every obstacle between us. |
| floor.f07.upgrade.r01.b04 | prince | probing | stepping-closer | left | biome-depths-soft | prince.doubtful | Obstacles do not tell you where enemies will stand. How do you know? |
| floor.f07.upgrade.r01.b05 | princess | impatient | hand-closing | right | biome-depths-soft | princess.commanding | Because this place repeats its cruelties. Choose reach, Zephyr. You can question the room after you survive it. |
| floor.f07.upgrade.r01.b06 | prince | watchful | scythe-grounded | left | biome-depths-soft | prince.alarmed | I will survive it. Your answer will still be waiting when I do. |

## `floor.f07.upgrade.r02`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f07.upgrade.r02.b01 | princess | fierce | fist-closed | right | biome-depths-soft | princess.commanding | They keep reforming behind you because you leave too much standing. Break the center, and the rest will fold. |
| floor.f07.upgrade.r02.b02 | prince | guarded | wiping-blade | left | biome-depths-soft | prince.resolved | You speak as if the fighting matters more than where it leads. |
| floor.f07.upgrade.r02.b03 | princess | cold-briefly | leaning-forward | right | biome-depths-soft | princess.possessive | The fighting is the only language these halls respect. |
| floor.f07.upgrade.r02.b04 | prince | quiet | watching-her | left | biome-depths-soft | prince.calm | That was never your language. |
| floor.f07.upgrade.r02.b05 | princess | strained-warm | open-palm | right | biome-depths-soft | princess.strained | It is the one I have been forced to learn. Give me the mercy of learning it well. Choose what breaks them. |
| floor.f07.upgrade.r02.b06 | prince | conflicted | weighing-offer | left | biome-depths-soft | prince.doubtful | Mercy should leave something standing. I will choose what opens a path, not what pleases this place. |

## `floor.f07.upgrade.threshold`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f07.upgrade.threshold.b01 | princess | commanding | standing-tall | right | depths-threshold-soft | princess.commanding | When you reach the bottom, do not bargain with her. Do not ask for terms. Kill the Witch. |
| floor.f07.upgrade.threshold.b02 | prince | startled | scythe-lowered | left | depths-threshold-soft | prince.alarmed | I came to bring you home, not execute someone on command. |
| floor.f07.upgrade.threshold.b03 | princess | intense | stepping-forward | right | depths-threshold-soft | princess.strained | She will use every breath you give her to close another door. You cannot negotiate with a hand around my throat. |
| floor.f07.upgrade.threshold.b04 | prince | firm | meeting-gaze | left | depths-threshold-soft | prince.resolved | I decide what the scythe does. |
| floor.f07.upgrade.threshold.b05 | princess | possessive-soft | touching-ring | right | depths-threshold-soft | princess.possessive | Then decide for us. Choose strength now, and leave her no final measure of me. |
| floor.f07.upgrade.threshold.b06 | prince | firm | hand-away-from-ring | left | depths-threshold-soft | prince.resolved | I will decide when I see her. Until then, you are asking and I am listening. Keep that difference. |

## `floor.f08.witch`

- Presentation: `vn`
- Repeat: `oncePerRun`
- Scene role: `floorProjection`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f08.witch.b01 | witch | grave-clinical | projection-close | right | biome-sanctum-graded | witch.clinical | Her condition is progressive. The intervals in which intention and speech agree are shortening. |
| floor.f08.witch.b02 | prince | furious-contained | scythe-forward | left | biome-sanctum-graded | prince.enraged | You call her a condition because it saves you from calling her a person. |
| floor.f08.witch.b03 | witch | accepting | hands-open | right | biome-sanctum-graded | witch.acceptance | A fair indictment. It does not alter the prognosis. |
| floor.f08.witch.b04 | prince | hurt | hand-over-ring | left | biome-sanctum-graded | prince.devastated | You do not know what can return once she is free of you. |
| floor.f08.witch.b05 | witch | exact | projection-still | right | biome-sanctum-graded | witch.clinical | I know this process does not reverse. Hope is not contrary evidence. |
| floor.f08.witch.b06 | prince | defiant-shaken | moving-past | left | biome-sanctum-graded | prince.doubtful | Then your evidence will have to survive the person you reduced to it. |

## `floor.f08.upgrade.r01`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f08.upgrade.r01.b01 | princess | commanding | palm-up | right | biome-sanctum-soft | princess.commanding | Choose the strongest gift. Now. |
| floor.f08.upgrade.r01.b02 | prince | guarded | remaining-still | left | biome-sanctum-soft | prince.resolved | Ask me. |
| floor.f08.upgrade.r01.b03 | princess | irritated | fingers-curling | right | biome-sanctum-soft | princess.corrupt-4 | We have no time for ceremony. |
| floor.f08.upgrade.r01.b04 | prince | firm | arms-at-sides | left | biome-sanctum-soft | prince.resolved | It was not ceremony when you still cared whether I chose. |
| floor.f08.upgrade.r01.b05 | princess | recalibrating | forced-softness | right | biome-sanctum-soft | princess.strained | Please, then. Choose what makes you stronger. I care whether you arrive; must I decorate every necessity? |
| floor.f08.upgrade.r01.b06 | prince | uneasy | looking-at-ring | left | biome-sanctum-soft | prince.doubtful | No. But I am beginning to hear what you leave bare. |
| floor.f08.upgrade.r01.b07 | princess | coldly-pleased | slight-smile | right | biome-sanctum-soft | princess.possessive | Good. Hear it while you choose. Strength needs less decoration than fear does. |

## `floor.f08.upgrade.r02`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f08.upgrade.r02.b01 | princess | possessive | both-hands-reaching | right | biome-sanctum-soft | princess.possessive | You belong with me. Every door you break only proves the world cannot keep what is mine. |
| floor.f08.upgrade.r02.b02 | prince | shocked | stepping-back | left | biome-sanctum-soft | prince.alarmed | Elowen— |
| floor.f08.upgrade.r02.b03 | princess | lucid-frightened | recoiling-from-self | right | biome-sanctum-soft | princess.lucid | Zephyr, please. Do not trust my voice. Do not follow when it sounds most certain. |
| floor.f08.upgrade.r02.b04 | prince | desperate | reaching-forward | left | biome-sanctum-soft | prince.devastated | That was you. Stay with me. Tell me what she is doing. |
| floor.f08.upgrade.r02.b05 | princess | hijacked-calm | chin-lifting | right | biome-sanctum-soft | princess.possessive | She is delaying you. I said not to trust the voice that asks you to stop. Keep going. |
| floor.f08.upgrade.r02.b06 | prince | shaken | hand-falling | left | biome-sanctum-soft | prince.doubtful | You changed inside the same breath. |
| floor.f08.upgrade.r02.b07 | princess | commanding | open-palm | right | biome-sanctum-soft | princess.commanding | Then do not waste the next one. Choose. |
| floor.f08.upgrade.r02.b08 | prince | shaken-resolute | hand-lowering | left | biome-sanctum-soft | prince.doubtful | I will choose. I will not pretend the voice asking is whole. |

## `floor.f08.upgrade.threshold`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f08.upgrade.threshold.b01 | princess | pleased-cold | watching-him | right | sanctum-threshold-soft | princess.possessive | Good. You came despite the frightened little interruption. You still remember how to obey. |
| floor.f08.upgrade.threshold.b02 | prince | wounded | scythe-grounded | left | sanctum-threshold-soft | prince.injured | I remember how to keep a promise. |
| floor.f08.upgrade.threshold.b03 | princess | possessive-soft | touching-ring | right | sanctum-threshold-soft | princess.possessive | Call it whatever lets you continue. A promise, a pull, a hand at your back. The result is what matters. |
| floor.f08.upgrade.threshold.b04 | prince | suspicious | lifting-gaze | left | sanctum-threshold-soft | prince.doubtful | You never spoke about us as a result. |
| floor.f08.upgrade.threshold.b05 | princess | impatient | gesturing-downward | right | sanctum-threshold-soft | princess.commanding | We had the luxury of other words. Choose, and earn them back. |
| floor.f08.upgrade.threshold.b06 | prince | wary | facing-stair | left | sanctum-threshold-soft | prince.alarmed | Words are not wages. If I reach you, they return because you mean them. |

## `floor.f09.witch`

- Presentation: `vn`
- Repeat: `oncePerRun`
- Scene role: `floorProjection`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f09.witch.b01 | witch | grave | projection-still | right | biome-abyss-graded | witch.clinical | That was not fear speaking for most of the exchange. Fear asked you to stop. Something else corrected it. |
| floor.f09.witch.b02 | prince | defensive-shaken | gripping-ring | left | biome-abyss-graded | prince.doubtful | I heard Elowen warn me. That proves she is still fighting you. |
| floor.f09.witch.b03 | witch | precise | one-hand-raised | right | biome-abyss-graded | witch.clinical | It proves one lucid interval survived a breath. Then the thing wearing her affection used your hope to reverse it. |
| floor.f09.witch.b04 | prince | angry | scythe-forward | left | biome-abyss-graded | prince.enraged | You speak as if her love were a costume. |
| floor.f09.witch.b05 | witch | restrained | projection-dimming | right | biome-abyss-graded | witch.clinical | No. Her love is real. That is why it is useful to what cannot sustain its own purpose. |
| floor.f09.witch.b06 | prince | pained | hand-over-ring | left | biome-abyss-graded | prince.injured | If it is real, there is something left to reach. You have admitted more than you intended. |

## `floor.f09.upgrade.r01`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f09.upgrade.r01.b01 | princess | knowing | indicating-distant-ranks | right | biome-abyss-soft | princess.possessive | The careful ones are hers. See how neatly they hold the door, shields turned outward, every gap measured? |
| floor.f09.upgrade.r01.b02 | prince | wary | following-gesture | left | biome-abyss-soft | prince.alarmed | And the ones that tore through their line to reach me? |
| floor.f09.upgrade.r01.b03 | princess | evasive-cold | hand-lowering | right | biome-abyss-soft | princess.possessive | Does a corpse need a pedigree before you cut it down? |
| floor.f09.upgrade.r01.b04 | prince | insistent | stepping-forward | left | biome-abyss-soft | prince.resolved | You knew the room before I opened it. Now you know which creatures answer her. What are the others? |
| floor.f09.upgrade.r01.b05 | princess | impatient | open-palm | right | biome-abyss-soft | princess.commanding | In your way. Choose what removes them. Names are another delay. |
| floor.f09.upgrade.r01.b06 | prince | troubled | looking-at-ring | left | biome-abyss-soft | prince.doubtful | That sounds like her. The answer does not. |
| floor.f09.upgrade.r01.b07 | princess | dismissive | turning-away | right | biome-abyss-soft | princess.possessive | Then listen to the useful part. The next door does not care which voice satisfies you. |

## `floor.f09.upgrade.r02`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f09.upgrade.r02.b01 | princess | strained-commanding | reaching | right | biome-abyss-soft | princess.commanding | Another door. Break it quickly. I can almost feel the air move around you. |
| floor.f09.upgrade.r02.b02 | prince | gentle-desperate | hand-to-ring | left | biome-abyss-soft | prince.devastated | Elowen, if any part of you can hear without answering, tap the ring twice. |
| floor.f09.upgrade.r02.b03 | princess | lucid-terrified | tapping-ring-twice | right | biome-abyss-soft | princess.lucid | Stop. Please, do not come any closer. I cannot keep— |
| floor.f09.upgrade.r02.b04 | princess | hijacked-intense | gripping-ring | right | biome-abyss-soft | princess.possessive | Keep waiting. That is what she wants. Come to me now. |
| floor.f09.upgrade.r02.b05 | prince | devastated | frozen | left | biome-abyss-soft | prince.devastated | You gave me both answers. |
| floor.f09.upgrade.r02.b06 | princess | cold | palm-up | right | biome-abyss-soft | princess.possessive | I gave you the one that moves your feet. Choose, Zephyr. |
| floor.f09.upgrade.r02.b07 | prince | grief-hardened | hand-over-ring | left | biome-abyss-soft | prince.enraged | I heard the other one too. I am carrying both, whether you permit it or not. |

## `floor.f09.upgrade.threshold`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f09.upgrade.threshold.b01 | princess | possessive | listening | right | abyss-threshold-soft | princess.possessive | Your breath pauses every time doubt reaches the ring. I feel each pause as if you were pulling your hand from mine. |
| floor.f09.upgrade.threshold.b02 | prince | guarded | hand-away-from-ring | left | abyss-threshold-soft | prince.resolved | Perhaps I need my hand free. |
| floor.f09.upgrade.threshold.b03 | princess | sharp | reaching | right | abyss-threshold-soft | princess.commanding | For what? She has shown you doors, dead things, and a practiced expression of concern. I have shown you the way to me. |
| floor.f09.upgrade.threshold.b04 | prince | quiet | meeting-gaze | left | abyss-threshold-soft | prince.calm | You have shown me more than one way. |
| floor.f09.upgrade.threshold.b05 | princess | commanding | fingers-closing | right | abyss-threshold-soft | princess.commanding | Then choose the one that ends the distance. I can feel every breath you waste. |
| floor.f09.upgrade.threshold.b06 | prince | controlled | taking-one-breath | left | abyss-threshold-soft | prince.resolved | This breath is mine. So is the choice. Wait for me without trying to own either. |

## `floor.f10.witch`

- Presentation: `vn`
- Repeat: `oncePerRun`
- Scene role: `floorProjection`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f10.witch.b01 | witch | final-warning | projection-full | right | biome-containment-graded | witch.warning | She guided you here. She strengthened you. The same influence drew unstable dead across my wards and placed them in your path. |
| floor.f10.witch.b02 | prince | shaken-angry | scythe-ready | left | biome-containment-graded | prince.doubtful | You placed armies in every room. Do not divide your guilt now. |
| floor.f10.witch.b03 | witch | precise | hands-open | right | biome-containment-graded | witch.clinical | My forces held lines. The others broke those lines to reach you. One purpose defended containment. The other could not remain coherent long enough to preserve you. |
| floor.f10.witch.b04 | prince | defensive | hand-over-ring | left | biome-containment-graded | prince.resolved | She warned me. She is still in there. |
| floor.f10.witch.b05 | witch | grave | projection-still | right | biome-containment-graded | witch.clinical | Yes. Briefly. That does not make release survivable. It makes your part in it more painful. |
| floor.f10.witch.b06 | prince | absolute | stepping-forward | left | biome-containment-graded | prince.resolved | I will hear the answer from her. |
| floor.f10.witch.b07 | witch | resigned | projection-fading | right | biome-containment-graded | witch.acceptance | Kill me, and you will understand what you have freed. Understanding will arrive after it can help you. |
| floor.f10.witch.b08 | prince | grim | entering-final-floor | left | biome-containment-graded | prince.resolved | Then stop standing between me and the answer. |

## `floor.f10.upgrade.r01`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f10.upgrade.r01.b01 | princess | cold | inspecting-wounds | right | biome-containment-soft | princess.possessive | You are bleeding again. How inconvenient. |
| floor.f10.upgrade.r01.b02 | prince | hurt | looking-up | left | biome-containment-soft | prince.devastated | Inconvenient? |
| floor.f10.upgrade.r01.b03 | princess | impatient | palm-up | right | biome-containment-soft | princess.commanding | It slows you. Do not ask the wound to become a moral lesson. Close it, ignore it, or spend enough power that nothing touches you again. |
| floor.f10.upgrade.r01.b04 | prince | searching | lowering-scythe | left | biome-containment-soft | prince.alarmed | You once noticed pain before purpose. |
| floor.f10.upgrade.r01.b05 | princess | unmoved | fingers-curling | right | biome-containment-soft | princess.possessive | Purpose is what brings you to me. Choose. |
| floor.f10.upgrade.r01.b06 | prince | devastated-contained | weighing-offer | left | biome-containment-soft | prince.devastated | I will choose because I still believe someone behind that voice needs me. Do not make me regret being right. |

## `floor.f10.upgrade.r02`

- Presentation: `vn`
- Repeat: `perOffer`
- Scene role: `upgradeEncounter`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| floor.f10.upgrade.r02.b01 | princess | triumphant | arms-open | right | containment-antechamber-soft | princess.triumphant | One chamber remains. Give me the Witch's last breath, love, and I will give you every stolen morning back. |
| floor.f10.upgrade.r02.b02 | prince | anguished | hand-to-ring | left | containment-antechamber-soft | prince.devastated | You speak about her death as if it were a gift waiting to be opened. |
| floor.f10.upgrade.r02.b03 | princess | commanding | stepping-forward | right | containment-antechamber-soft | princess.commanding | It is the lock. Break it. |
| floor.f10.upgrade.r02.b04 | princess | lucid-strained | clutching-head | right | containment-antechamber-soft | princess.lucid | Zephyr—when the lights go out, do not trust what welcomes you. Please. Be quicker than I was. |
| floor.f10.upgrade.r02.b05 | prince | alarmed | reaching-forward | left | containment-antechamber-soft | prince.alarmed | Quicker than what? Stay. Tell me. |
| floor.f10.upgrade.r02.b06 | princess | hijacked-calm | hand-extended | right | containment-antechamber-soft | princess.possessive | Quicker than her next ward. Take the last gift. Bring me her silence. |
| floor.f10.upgrade.r02.b07 | prince | resolved | lifting-scythe | left | containment-antechamber-soft | prince.resolved | I will end the fight. What waits after it will answer in its own voice. |

## `boss.confrontation`

- Presentation: `vn`
- Repeat: `oncePerRun`
- Scene role: `bossConfrontation`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| boss.confrontation.b01 | witch | combat-ready | staff-grounded | right | containment-heart | witch.combat | You have mistaken the keeper for the prison from the first threshold. There is no useful warning left to soften. |
| boss.confrontation.b02 | prince | exhausted-determined | scythe-ready | left | containment-heart | prince.injured | Then do not soften it. Release Elowen. |
| boss.confrontation.b03 | witch | clinical | ward-forming | right | containment-heart | witch.clinical | Her release ends every ordered restraint you crossed. The forces that ignored those restraints will remain. |
| boss.confrontation.b04 | prince | angry-contained | stepping-forward | left | containment-heart | prince.enraged | You built a cage, filled it with dead guards, and ask me to admire the distinction. |
| boss.confrontation.b05 | witch | severe | staff-raised | right | containment-heart | witch.warning | I ask you to survive recognizing it. The ring has made your judgment unusable because it carries truth and influence through the same channel. |
| boss.confrontation.b06 | prince | shaken | gripping-ring | left | containment-heart | prince.doubtful | I heard her tell me to stop. She is still waiting behind whatever you have done. |
| boss.confrontation.b07 | witch | grave | ward-brightening | right | containment-heart | witch.clinical | She is not waiting to be saved. A lucid breath is not a restored mind. Killing me will spend the last barrier between desire and consequence. |
| boss.confrontation.b08 | prince | absolute | scythe-lifted | left | containment-heart | prince.resolved | Then she can tell me herself. |
| boss.confrontation.b09 | witch | accepting | battle-stance | right | containment-heart | witch.acceptance | Yes. That answer has always been the only one you would accept. Come, Prince. Learn what it costs. |
| boss.confrontation.b10 | prince | final-commitment | battle-stance | left | containment-heart | prince.resolved | I have paid in every room. I will not leave without seeing what the payment bought. |

## `ending.witch-death`

- Presentation: `vn`
- Repeat: `oncePerRun`
- Scene role: `witchDeath`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| ending.witch-death.b01 | prince | exhausted | scythe-lowered | left | containment-heart-broken | prince.injured | It is over. Open the way. |
| ending.witch-death.b02 | witch | wounded | kneeling-with-staff | right | containment-heart-broken | witch.wounded | Yes. My part is over. The rest was never mine to end from here. |
| ending.witch-death.b03 | prince | urgent | stepping-forward | left | containment-heart-broken | prince.alarmed | Elowen. Where is she? |
| ending.witch-death.b04 | witch | final-acceptance | releasing-staff | right | containment-heart-broken | witch.acceptance | Beyond the last ward. When the ordered lights fail, watch what remains. Do not call survival cruelty merely because it arrives too late. |
| ending.witch-death.b05 | prince | conflicted | looking-at-ward | left | containment-heart-broken | prince.doubtful | You could have told me. |
| ending.witch-death.b06 | witch | fading | eyes-closing | right | containment-heart-broken | witch.acceptance | You required innocence from one of us. I had none to offer. |
| ending.witch-death.b07 | witch | final-acceptance | final-speaking-kneel | right | containment-heart-broken | witch.acceptance | Remember only this: when my lights vanish, their absence is not your victory. It is your evidence. |

## `ending.princess-reveal`

- Presentation: `vn`
- Repeat: `oncePerRun`
- Scene role: `princessReveal`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| ending.princess-reveal.b01 | princess | triumphant-corrupted | arms-open | right | prison-open-unstable | princess.triumphant | You did it. Every ward dark, every careful hand gone. I felt the whole prison exhale. |
| ending.princess-reveal.b02 | prince | horrified | scythe-lowered | left | prison-open-unstable | prince.alarmed | Elowen? The lights died, but those things are still moving. |
| ending.princess-reveal.b03 | princess | delighted-cold | touching-ring | right | prison-open-unstable | princess.possessive | Of course they are. Did you think her discipline made them all hers? Some appetites do not understand when a battle is finished. |
| ending.princess-reveal.b04 | prince | reeling | looking-at-ring | left | prison-open-unstable | prince.doubtful | The rooms she did not control. The power around them. Your gifts. |
| ending.princess-reveal.b05 | princess | possessive | hand-extended | right | prison-open-unstable | princess.possessive | One current, carried so sweetly through our rings. I pulled; you named it longing. I pointed; you named it trust. |
| ending.princess-reveal.b06 | prince | devastated | stepping-back | left | prison-open-unstable | prince.devastated | You sent me into them. You heard me bleed. |
| ending.princess-reveal.b07 | princess | intimate-cruel | fingers-closing | right | prison-open-unstable | princess.possessive | And you kept coming. Love made you wonderfully easy to steer. |
| ending.princess-reveal.b08 | prince | horrified | tearing-ring-hand-away | left | prison-open-unstable | prince.alarmed | The pull was never proof that you wanted rescue. It was only proof that something wanted me here. |

## `ending.princess-human`

- Presentation: `vn`
- Repeat: `oncePerRun`
- Scene role: `princessHuman`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| ending.princess-human.b01 | princess | lucid-horrified | recoiling-from-ring | right | prison-open-unstable | princess.lucid | No. Not that voice. Zephyr, listen before it takes the words again. |
| ending.princess-human.b02 | prince | desperate | reaching-forward | left | prison-open-unstable | prince.devastated | I am here. Tell me what she did to you. |
| ending.princess-human.b03 | princess | ashamed | hands-open | right | prison-open-unstable | princess.lucid | I did it. I could not accept that magic reached everywhere except the moment a mind was lost. I tried to hold one at the edge of death. |
| ending.princess-human.b04 | princess | grief-stricken | looking-at-hands | right | prison-open-unstable | princess.lucid | It answered once. I called that mercy. Then proof. Then duty. Every name made it easier to continue. |
| ending.princess-human.b05 | prince | shattered | hand-falling | left | prison-open-unstable | prince.devastated | What was it? What is speaking through you? |
| ending.princess-human.b06 | princess | resolved | meeting-his-gaze | right | prison-open-unstable | princess.lucid | Necromancy. Mine. The Witch was containing me, studying what I became before she ended it safely. I killed her through you. |
| ending.princess-human.b07 | prince | pleading | stepping-forward | left | prison-open-unstable | prince.devastated | We can close the prison. Find another way. |
| ending.princess-human.b08 | princess | final-human-plea | offering-heart | right | prison-open-unstable | princess.final-plea | There is no cure and no other way. I can feel it taking my hands. Kill me before I use them. Now. |
| ending.princess-human.b09 | princess | fading-lucid | holding-his-gaze | right | prison-open-unstable | princess.lucid | Do not wait for a kinder answer. That is how I began. Five seconds, Zephyr. Save what I would not let go. |

## `ending.kill`

- Presentation: `vn`
- Repeat: `oncePerRun`
- Scene role: `endingKill`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| ending.kill.b01 | prince | devastated | catching-her | left | prison-collapse-quiet | prince.devastated | Forgive me. |
| ending.kill.b02 | princess | lucid-pained | held-upright | right | prison-collapse-quiet | princess.lucid | No. Do not make forgiveness another burden you carry for me. |
| ending.kill.b03 | prince | breaking | holding-her-hand | left | prison-collapse-quiet | prince.devastated | I came to bring you home. |
| ending.kill.b04 | princess | tender | touching-his-ring | right | prison-collapse-quiet | princess.lucid | You came because I pulled. You saved me when you finally stopped following. |
| ending.kill.b05 | prince | grief-stricken | forehead-to-hers | left | prison-collapse-quiet | prince.devastated | I should have known you. |
| ending.kill.b06 | princess | peaceful | faint-smile | right | prison-collapse-quiet | princess.lucid | You knew the part that loved you. I hid the part that believed love could forbid every leaving. That choice was mine. |
| ending.kill.b07 | prince | tearful-contained | tapping-rings-twice | left | prison-collapse-quiet | prince.devastated | Two taps. Come home. |
| ending.kill.b08 | princess | fading-human | closing-eyes | right | prison-collapse-quiet | princess.lucid | I am here. Thank you, Zephyr. Close the page. |
| ending.kill.b09 | prince | alone | holding-stilled-ring | left | prison-collapse-quiet | prince.devastated | The page is closed. I will carry the words you left me, not the pull. |

## `ending.timeout`

- Presentation: `vn`
- Repeat: `oncePerRun`
- Scene role: `endingTimeout`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| ending.timeout.b01 | princess | corrupted-return | straightening | right | prison-collapse-violent | princess.full | There. I wondered whether she could make you do it. |
| ending.timeout.b02 | prince | desperate | scythe-trembling | left | prison-collapse-violent | prince.devastated | Elowen, come back. You were here. |
| ending.timeout.b03 | princess | amused-cold | touching-wound | right | prison-collapse-violent | princess.full | She was clear. You heard every word. You simply waited for an answer that preserved you. |
| ending.timeout.b04 | prince | horrified | gripping-ring | left | prison-collapse-violent | prince.alarmed | The ring pulled me here. You made me believe— |
| ending.timeout.b05 | princess | triumphant | hand-closing | right | prison-collapse-violent | princess.full | I gave your belief a direction. You supplied the devotion, the excuses, and the blade. |
| ending.timeout.b06 | princess | predatory-calm | striking-pose | right | prison-collapse-violent | princess.full | Now give me the last thing you kept from me. |
| ending.timeout.b07 | prince | final-defiance | raising-scythe-too-late | left | prison-collapse-violent | prince.enraged | No. I know what you are now. |

## `ending.timeout-final`

- Presentation: `vn`
- Repeat: `oncePerRun`
- Scene role: `endingTimeoutFinal`

| Beat ID | Speaker | Expression | Pose | Stage | Background | Art state | Displayed dialogue |
|---|---|---|---|---|---|---|---|
| ending.timeout-final.b01 | prince | dying-realization | collapsed | left | prison-collapse-violent | prince.devastated | The Witch was keeping you here. You asked me to end it, and I freed it instead. |
| ending.timeout-final.b02 | princess | intimate-cruel | kneeling-over-him | right | prison-collapse-violent | princess.full | You wanted rescue more than you wanted her truth. |
| ending.timeout-final.b03 | prince | devastated | ring-hand-falling | left | prison-collapse-violent | prince.devastated | Elowen... |
| ending.timeout-final.b04 | princess | final-corrupted | touching-rings | right | prison-collapse-violent | princess.full | No doors. No distance. Nothing between us now. |
| ending.timeout-final.b05 | princess | triumphant-still | closing-his-eyes | right | prison-collapse-violent | princess.full | You always wanted that promise to be simple. |


