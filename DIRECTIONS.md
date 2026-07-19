# Reaper of the Hollow Crown — Implementation Directions

## 1. Purpose and status

This document is the authoritative implementation specification for the next full production pass of **Reaper of the Hollow Crown**. It consolidates the decisions made after reviewing `Improvements.md`, the existing repository, and the narrative requirements in `Instructions.md`.

The goal is a short, replayable game with two equally serious pillars:

1. A fast, responsive, build-driven scythe combat system.
2. A polished, full-screen visual-novel story with strong character acting and a controlled gothic tragedy.

Neither pillar may be treated as filler for the other. Combat must remain enjoyable when dialogue is skipped, and the narrative must remain coherent and emotionally effective without relying on the glossary.

This document describes required outcomes. It does not bypass the approval, file-ownership, dependency, safety, or verification rules in the applicable `AGENTS.md` files.

## 2. Authority, baseline, and change control

Use the following authority rules:

1. Applicable global and repository `AGENTS.md` files govern safety, permissions, workflow, and engineering discipline.
2. `DIRECTIONS.md` records the user's latest approved product decisions, implementation workstreams, and acceptance criteria.
3. `Instructions.md` defines the locked narrative spine, canon, and mandatory narrative workflow except where a later decision is explicitly recorded below.
4. `Improvements.md` remains the original improvement checklist and historical input.

`DIRECTIONS.md` does not broadly replace `Instructions.md`. It supersedes only these explicitly approved older details:

- The previously unnamed Prince is now canonically **Zephyr**.
- Elowen's original reason for studying necromancy is now established as compassion corrupted by certainty.
- The previous inline-only upgrade presentation is replaced by 29 separate full-screen visual-novel scenes.
- The older very-short dialogue target is expanded to a 4,000–6,000-word corpus while retaining the prohibitions against filler, repetition, exposition dumps, and oversized branching.

Update `docs/NARRATIVE_BIBLE.md`, structured narrative content, tests, and other canon records to reflect these changes during the approved narrative milestone. In every other narrative conflict, preserve `Instructions.md` and report the issue before changing canon.

### Baseline rules

- Treat the current working tree as user-owned baseline work.
- Inspect `git status` and relevant diffs before proposing edits.
- Preserve existing working behavior and architectural conventions unless a documented decision in this file requires a change.
- Do not discard, reset, overwrite, or silently absorb unrelated working-tree changes.
- Do not make undocumented canon changes.
- Do not add, remove, upgrade, or replace dependencies without the explicit approval required by `AGENTS.md`.
- New external music, art, fonts, models, samples, and other assets require verified usage rights and updated attribution.

## 3. Locked product decisions

The following decisions are approved and must not be reopened without a genuine implementation conflict or new user direction.

### Game identity

- The game is a strong combat game attached to a proper visual-novel-like story.
- Combat should make Zephyr feel like a **powerful but punishable reaper**.
- Movement, input buffering, cancels, and crowd-cleaving attacks should feel fast and responsive.
- Greedy or poorly timed play must remain punishable through coordinated enemy pressure and committed attack windows.
- The visual identity is an intentional **illustrated-gothic hybrid**:
  - Painterly character art, menus, visual-novel scenes, and endings.
  - Readable stylized 3D gameplay presented like a dark gothic diorama.
  - A shared palette, silhouette language, lighting logic, typography, ornament, and VFX vocabulary across both layers.

### Canon

- The Prince's canonical name is **Zephyr**.
- Elowen uses his name intimately; the Witch usually calls him “Prince” or omits direct address.
- `Instructions.md` remains the locked story spine.
- Zephyr sincerely believes Elowen was abducted.
- The Witch is containing Elowen rather than tormenting her.
- Elowen is the only known living necromancer and is incurably corrupted.
- The paired rings carry genuine love, presence, power, and manipulation.
- Witch-created and Elowen-created enemies foreshadow divided control.
- Zephyr learns the truth only after defeating the Witch.
- The final action remains killing Elowen within five seconds or hesitating.
- There is no secret cure or hidden perfect ending.

### Elowen's original motivation

Elowen began from compassion corrupted by certainty. She could not accept that an openly magical society still treated death as untouchable. She secretly researched how to preserve consciousness at the moment of death, not how to build an undead army or resurrect one convenient lost relative. An early apparent success convinced her that continuing was a moral duty. Over time, “no one should be lost” decayed into “nothing is permitted to leave me.”

This motivation must deepen her tragedy without excusing her choices. It may be hinted at before the reveal through her attitudes toward loss, but the necromantic research and its full meaning are disclosed only during the finale and unlocked glossary.

### Voice acting

- Do not add spoken dialogue or voice acting in this pass.
- Do not add recorded or synthesized human vocal performances, including breaths, efforts, or combat barks.
- Do not add placeholder voices that will ship accidentally.
- Concentrate audio-production effort on music, combat sound, UI sound, ambience, and musical storytelling.
- Non-vocal character-specific text sounds may be used only if restrained, accessible, and easy to disable.

## 4. Mandatory implementation order and gates

Implement in staged, playable milestones. Do not attempt one giant unreviewed pass. Independent art, combat, narrative, audio, and UI workstreams may overlap only after their shared interfaces and entry criteria are approved.

The narrative workstream must preserve the exact order required by `Instructions.md`:

1. Repository audit.
2. Narrative bible.
3. Voice bible.
4. Floor-by-floor dialogue plan.
5. First dialogue draft.
6. Dialogue continuity audit.
7. Revised final dialogue.
8. Technical design.
9. Implementation.
10. Automated testing.
11. Manual flow validation.
12. Final code review.
13. Final narrative review.
14. Documentation update.

The broader production milestones are:

1. Repository, working-tree, current-gameplay, and current-visual audit.
2. Approved narrative planning through the revised final dialogue; approved art direction and canonical character concepts; approved combat and input technical design.
3. Core combat, Harvest meter, Reaper's Claim, and complete matching animation.
4. Upgrade redesign, difficulty behavior, enemy-origin integration, enemy coordination, and boss redesign.
5. Visual-novel technical design, implementation, complete dialogue integration, ending/glossary flow, and narrative tests.
6. Character animation, combat VFX, portraits, scene art, and visual integration.
7. Music research, licensing verification, adaptive soundtrack integration, and SFX pass.
8. Main-menu redesign, difficulty flow, Records, statistics, and run suspension.
9. Integrated automated tests and performance benchmarks.
10. Manual combat, visual, audio, accessibility, narrative, and both-ending validation.
11. Final code, canon, license, performance, scope, and documentation review.

Each milestone must have:

- Documented entry criteria.
- A file-ownership ledger for its editing wave.
- An exit checklist and verification record.
- A list of accepted limitations.
- An explicit `accepted` or `blocked` decision from the primary agent.

Later dependent work must not begin while a prerequisite milestone is blocked. Each accepted milestone must leave the game runnable. Do not stack multiple unverified systems and postpone integration until the end.

## 5. Subagent operating model

The primary agent is responsible for orchestration, final decisions, repository safety, and reviewing every subagent result. Subagents are specialized workers, not autonomous owners of product direction.

### 5.1 Required task contract

Every subagent assignment must state:

- A stable deliverable ID used by every attempt and replacement agent.
- A concrete objective.
- The exact documents and repository areas to inspect.
- Whether the task is read-only or may perform exact file operations already authorized by the user and passed down by the primary agent.
- Exact file ownership if edits are allowed.
- Required deliverables.
- A measurable success state.
- A bounded failure state.
- Verification commands or inspection steps.
- A fixed maximum number of attempts.
- A maximum runtime, checkpoint interval of no more than five minutes, and maximum checkpoint count.

Do not assign vague tasks such as “improve combat,” “make art,” or “fix the story.”

### 5.2 Concurrency and file ownership

- Use parallel subagents only for genuinely independent work.
- Respect the concurrency limit of the active environment. Run additional specialists in waves.
- Never allow two editing agents to own the same file simultaneously.
- Prefer read-only auditors in parallel with one bounded implementation owner.
- Subagents never infer edit permission. The primary agent must pass down the exact authorized operation and path. Newly discovered file operations return to the primary agent for the approval required by `AGENTS.md`.
- Before each editing wave, maintain an ownership ledger containing deliverable ID, agent, exact paths or narrow globs, allowed operation, approval source, baseline status, start state, and release state.
- No editing agent starts until the ledger is conflict-free. New files belong to the declaring owner until review and release.
- Give each shared interface one owner. Finish and verify that interface, freeze its contract for the wave, and only then dispatch consumers.
- If a shared interface must change, stop dependent tasks, update the contract, and reassess or restart affected deliverables within their existing attempt budgets.
- Subagents must not broaden their assigned scope or modify unlisted files.
- The primary agent must inspect the working tree after every editing wave.

### 5.3 Review and retry loop

Use at most **three executions per stable deliverable ID**. Keep an attempt ledger. Renaming, splitting, rewording, changing agents, or trying a new approach does not reset the budget. Reset it only after the user approves a material scope change.

1. **Initial attempt:** Give one bounded task contract and collect the result, evidence, diff, and verification output.
2. **Targeted correction:** If the result fails review, diagnose the failure before retrying. Amend the task contract with missing context, the exact failed acceptance criteria, and prohibited repetition of the failed approach. Prefer the same agent when the failure is local and understood.
3. **Replacement attempt:** If the correction still fails, stop reusing the same approach. Review all prior output, classify the failure, and redeploy a replacement specialist with a revised contract that explicitly removes the known failure conditions.

After three failed executions, stop the loop. Mark the deliverable blocked, preserve useful evidence, and ask the user for direction. Never retry indefinitely.

Classify failure before retrying:

- **Specification failure:** The task was ambiguous or omitted a product invariant.
- **Context failure:** The agent lacked required files, interfaces, canon, or repository evidence.
- **Implementation failure:** The approach was understood but introduced bugs or failed tests.
- **Validation failure:** The result may work but lacks sufficient proof.
- **Visual-quality failure:** The asset or UI violates the approved art direction or does not read correctly in context.
- **Animation failure:** The character action is not visibly performed by the character rig or synchronized with gameplay.
- **License failure:** Usage rights, attribution, source, or redistribution terms are unclear.
- **Tooling failure:** A tool or environment cannot produce the required artifact reliably.
- **Scope failure:** The agent changed unrelated files or introduced unauthorized work.

Do not call a deliverable successful merely because an agent says it is complete.

### 5.4 Runtime discipline

- Subagents must make observable progress rather than wait passively.
- Do not use long sleeps or repeated unchanged polling.
- If a task runs for several minutes, it should be because it is performing bounded inspection, asset work, test execution, or a documented research matrix.
- Every task contract must set a hard maximum runtime. Use ten minutes as the default ceiling; longer budgets require a written reason tied to a bounded asset operation, integration run, or test suite.
- Checkpoint intervals may not exceed five minutes, and every contract must cap the total checkpoint count.
- Every checkpoint and final return must report: status, newly completed criteria, new evidence, files touched, checks run and their results, remaining criteria, blocker, and next action.
- If two consecutive checkpoints satisfy no new acceptance criterion, terminate the execution and diagnose rather than waiting longer.
- At the runtime ceiling, interrupt the agent and collect partial evidence. Count the execution as failed or blocked; elapsed time never resets its attempt budget.
- A ten-minute or longer task is acceptable only when the task contract explains why the work requires it and the output justifies the time.
- Every unsuccessful report must state the observable failure, evidence gathered, assumptions that proved wrong, and the smallest useful next step. The primary agent reviews this report and the actual output before constructing a retry; hidden reasoning is never treated as evidence.

### 5.5 Primary-agent acceptance loop

For every subagent result, the primary agent must:

1. Compare claims with repository reality.
2. Inspect every changed file and relevant diff.
3. Confirm only approved files were touched.
4. Run or independently verify the promised checks. Use focused checks per editing owner, integration checks once per wave, and both-ending validation for ending-, narrative-, or persistence-affecting waves plus final acceptance.
5. Compare narrative work with `Instructions.md` and the canon in this file.
6. Compare visual work with the approved art-direction artifacts.
7. Compare music candidates with their license evidence and intended scene function.
8. Confirm the deliverable integrates with preceding milestones.
9. Record accepted limitations rather than hiding them.

### 5.6 Specialist waves

Use the role requirements in `Instructions.md` for the narrative implementation. Add the following cross-discipline waves as needed.

#### Audit and architecture wave

- Repository and architecture auditor — read-only.
- Combat and balance auditor — read-only.
- Presentation, accessibility, and performance auditor — read-only.

Success: evidence-backed architecture maps, integration points, risk lists, and definitions of done.

#### Narrative wave

- Narrative director.
- Character voice director.
- Dialogue writer.
- Continuity, foreshadowing, repetition, and knowledge-state auditor.
- Narrative QA specialist.

Use relevant installed skills such as story analysis, story zoom, character arc, dialogue, scene sequencing, drafting, cliché transcendence, revision, and sensitivity checking. The primary agent must read and follow every selected skill itself before delegating work influenced by it.

Success: a coherent 4,000–6,000-word corpus with stable scene identifiers, a deliberate 29-step Elowen progression, no early twist disclosure, distinct voices, and no filler scenes.

#### Combat and systems wave

- Player-combat and input specialist.
- Upgrade and build-systems specialist.
- Enemy coordination and boss specialist.
- Enemy-origin integration owner across encounter data, runtime metadata, narrative, animation, VFX, and audio.
- Combat-feel and animation-integration auditor.
- Combat QA and balance specialist.

Use relevant installed skills such as game feel, input systems, physics tuning, camera systems, performance optimization, and audio design.

Success: responsive combat with deterministic rules, meaningful builds, behavior-driven difficulty, synchronized animation, an end-to-end enemy-origin acceptance package, and evidence from tests plus actual play.

#### Art and asset wave

Use three to five art specialists in waves, never exceeding available concurrency:

1. Art director and style-bible owner.
2. Character concept, portrait, expression, and VN-cutout specialist.
3. Combat VFX and sprite-atlas specialist.
4. Environment, scene-background, menu, and UI-art specialist.
5. Animation integration and visual-consistency auditor.

Use the relevant image-generation, brand, visual-design, creative-production, game UI/UX, and frontend-design skills. Do not force unrelated skills into the workflow.

Success: approved art bible, consistent assets, complete provenance, natural action animation, and in-game visual inspection across representative scenes.

#### Music and audio wave

- Music-direction and cue-map specialist.
- Royalty-free music research specialist for dramatic and narrative scenes.
- Royalty-free music research specialist for biomes, exploration, combat, and boss states.
- License and attribution auditor.
- Adaptive-audio integration and SFX specialist.

Research agents may browse the internet, but must return direct source links, license text or authoritative license pages, attribution requirements, download formats, loop suitability, stem availability, and scene fit. Search results, reposts, and unsourced download mirrors are not sufficient evidence.

Prefer tracks available at no cost with clear redistribution and modification rights. “Royalty-free” does not automatically mean free to download, safe to redistribute, or licensed for adaptation. Record candidate price, acquisition terms, and source-download terms. Paid libraries, subscriptions, and one-off licenses require separate user approval before selection or acquisition.

Success: a cohesive, legally usable soundtrack mapped to scenes and adaptive states, with no ambiguous licenses.

#### UI, persistence, and QA wave

- Visual-novel and menu UI specialist.
- Statistics and persistence specialist.
- Accessibility and responsive-layout auditor.
- Automated-test specialist.
- Manual gameplay, narrative, audio, and visual QA specialist.

Success: production-quality UI, validated storage, complete input support, passing tests, both endings validated, and no unsupported quality claims.

## 6. Combat specification

### 6.1 Combat feel

Zephyr should feel powerful, fast, and deliberate rather than weightless or invulnerable.

- Preserve or improve responsive input buffering.
- Preserve fast movement and steerable dashing.
- Permit deliberate dash cancels after meaningful commitment points.
- Do not allow unrestricted animation cancellation that removes risk from every attack.
- Keep the three-hit scythe combo, dash strike, and charged circular reap as the reliable core kit.
- Attacks must have readable anticipation, active, and recovery phases that match their actual hit windows.
- Enemies must punish repeated greedy strings, bad positioning, and panic dashing.
- Avoid damage-sponge balance as the primary difficulty tool.

### 6.2 Selective impact feedback

- Add tiny, bounded hit-stop to combo finishers, critical hits, charged reaps, and Reaper's Claim recalls.
- Do not apply noticeable hit-stop to every light hit; crowd combat must remain fluid.
- Give enemies weight- or poise-based stagger behavior.
- Heavy enemies and bosses may resist displacement while still showing a readable impact response.
- Use stronger camera trauma, weapon trails, layered sound, and VFX for major hits.
- Reduced-motion and camera-shake settings must reduce or remove these effects without reducing mechanical feedback.

### 6.3 Reaper's Claim

Add **Reaper's Claim** as Zephyr's signature resource-powered special.

Required behavior:

- Zephyr visibly throws the physical scythe along the aimed path.
- The outward path damages enemies.
- Recall damages enemies again.
- Light enemies are pulled into striking range on recall.
- Heavy enemies and bosses resist the pull but take stagger or poise damage.
- A well-timed follow-up becomes an empowered cleave.
- The move must read as supernatural weapon mastery, not free-standing spellcasting.
- The ring may channel power through the scythe.
- Prince power uses gold/cyan visual language and must not resemble Elowen's violet/necromantic corruption.

Default controls:

- Keyboard: `R`.
- Controller: right bumper.
- Touch: dedicated green Harvest/Claim action.
- Mouse: optional remappable side-button binding where supported.
- All bindings must use the existing remapping and conflict-resolution conventions.

### 6.4 Harvest meter

Add a three-segment green **Harvest** meter to the top-left HUD beside health and dash energy.

- Reaper's Claim costs one segment.
- Close-range attacks fill it steadily.
- Critical hits, kills, and well-timed dashes fill it faster.
- Relevant upgrades may increase generation further.
- Target ordinary availability at roughly two to four uses per chamber.
- The move is limited by earned segments and its animation, not an additional cooldown.
- Unused segments persist between chambers.
- Harvest is capped at three segments.
- If Harvest is empty at a new floor, grant one segment.
- The UI must use segments, iconography, labels, fill motion, and state changes so it does not rely on green alone.
- Reduced-motion mode replaces energetic fill animation with a restrained state transition.

### 6.5 Charged reap

- Retain the charged 360-degree scythe reap.
- Add a brief perfect-release window near full charge.
- A perfect release increases stagger and Harvest generation.
- An ordinary partial or full release must remain valuable.
- Hold and toggle charge modes must both behave correctly.
- The animation and VFX must show charge accumulation on Zephyr and the scythe, not only as a detached ground effect.

### 6.6 Action-animation invariant

Every gameplay action requires a matching natural character animation.

For Zephyr, this includes at minimum:

- Idle and movement transitions.
- Dash start, travel, and recovery.
- Three distinct combo attacks.
- Dash strike.
- Charge start, charge loop, ordinary release, and perfect release.
- Reaper's Claim throw, unarmed/recall interval, catch, and empowered follow-up.
- Hit reactions by direction or severity where practical.
- Healing and Death Defiance recovery.
- Defeat, ending strike, and victory/aftermath states.

VFX may emphasize an action but may not replace the body animation. A projectile, slash sprite, or detached effect appearing while the character remains in an unrelated idle/cast pose is a failed implementation.

## 7. Upgrade and build specification

### 7.1 Build philosophy

Builds should be flexible, highly impactful, and capable of becoming spectacular. Flexibility does not mean protection from poor choices. Incoherent or weak builds should be punished in late floors.

- Do not hard-lock the player into a class.
- Every offer should present one Reaper, one Shade, and one Grave option when valid options exist.
- Cross-path combinations must remain viable.
- Synergies should reward specialization without making mixed builds inherently weak.
- Reserve hard exclusions for mechanics that are genuinely incompatible.
- No respecs are allowed during a run.
- Allow one free, non-stackable reroll per floor.

### 7.2 Path identities

#### Reaper

- Scythe reach.
- Combo finishers.
- Charged-reap control.
- Stronger Reaper's Claim pulls and recalls.
- Stagger, cleave, and execution behavior.

#### Shade

- Critical strikes.
- Dash attacks and cancel mastery.
- Afterimages and mobility-driven damage.
- Perfect-dash rewards.
- Rapid Harvest generation.

#### Grave

- Aggressive healing and life recovery.
- Poise or stagger resistance.
- Retaliation and wounded-state bonuses.
- Death Defiance.
- Survival through continued engagement rather than passive health stacking alone.

### 7.3 Upgrade tiers

- Chamber upgrades should produce clearly felt improvements and reinforce the chosen path.
- Floor blessings should be build-defining transformations rather than larger versions of chamber percentages.
- Transformations may add pulls, afterimages, executes, spectral follow-throughs, combo changes, perfect-action rewards, retaliation, or resource interactions.
- Keep the base kit reliable even when a particular transformation is not offered.
- Review every existing upgrade and blessing to confirm its effect reaches live gameplay.
- Add focused contract tests for every upgrade's advertised behavior.

### 7.4 Upgrade-card truthfulness

Every upgrade card must show:

- Current rank and maximum rank.
- Exact before-and-after values.
- Mechanical tags.
- Prerequisites and exclusions.
- Relevant synergy indicators.
- A precise description that matches the actual calculation.

Do not use vague wording such as “slightly faster” when an exact value can be shown. Correct descriptions whose percentage language does not match multiplicative cooldown behavior.

### 7.5 Death Defiance cap

- A run may grant no more than **two total Death Defiance activations**.
- The cap applies to total activations granted during the run, not only charges currently held.
- Consuming a charge does not reopen eligibility.
- Once two activations have been granted, remove every Death Defiance option from all future offer pools for that run.
- Always provide valid alternatives.
- Persist and test granted-count and remaining-charge state separately.

## 8. Difficulty and encounter specification

### 8.1 Difficulty selection

- Starting a new run must first open a dedicated difficulty-selection screen.
- Present Story, Standard, and Ruthless as clear cards with behavioral descriptions.
- Remember the last highlighted selection, but always show the screen.
- Lock the selected difficulty for the run.
- Record it in run and lifetime statistics.
- Never remove narrative content on easier modes.

### 8.2 Completion targets

#### Story

- Accessible to players primarily following the narrative.
- Preserve full mechanics and telegraphs.
- Avoid making the mode feel like non-interactive invulnerability.

#### Standard

- A competent new player should usually reach floors 5–7 on the first run.
- Most players should win after roughly three to five attempts.
- Skilled players may win immediately through execution and a coherent build.

#### Ruthless

- Require both a coherent build and mechanical mastery.
- Increase aggression, coordination, pattern pressure, and composition complexity.
- Do not rely mainly on health inflation or cheap one-shot damage.

### 8.3 Mixed-squad pressure

- Fodder should create crowd-cleaving opportunities.
- One or two specialists should control space, flank, defend, deny areas, or punish committed attacks.
- Scale attack frequency, coordinated timing, compositions, movement behavior, and late-floor variants.
- Use an explicit coordination or attack-slot policy where necessary to keep pressure fair and readable.
- Enemy movement should feel purposeful rather than every actor independently chasing the same point.
- Preserve clear counterplay and telegraphs even on Ruthless.

### 8.4 Enemy-origin storytelling

- Witch forces remain ordered, defensive, disciplined, and cleanly summoned.
- Elowen forces remain unstable, aggressive, necromantic, asymmetrical, and increasingly irrational.
- From floors 7–10, use rare authored clashes or interference between origins.
- Do not enable unrestricted systemic friendly fire that makes room outcomes arbitrary.
- Zephyr must not identify the true source before the reveal.

## 9. Witch boss specification

The Witch must become faster, stronger, and more complex through behavior, not only health.

Target roughly three minutes on Standard for a coherent build. Ordinary defeat restarts the run; do not add a boss checkpoint.

### Phase 1 — The Keeper

- Precise wards.
- Disciplined projectiles.
- Controlled movement.
- Punishable dueling attacks.
- Establish the Witch's ordered combat language.

### Phase 2 — Containment Breach

- Teleports.
- Ordered summons.
- Arena hazards and space control.
- Carefully bounded overlapping patterns.
- A readable phase transition with a distinct animation and musical change.

### Phase 3 — Last Measure

- Dismiss or sharply reduce add pressure.
- Make the Witch dramatically faster.
- Combine shortened versions of learned patterns.
- Turn the final phase into a dangerous duel rather than an unreadable particle storm.
- Preserve controlled desperation; do not drift into arbitrary bullet-hell clutter.

### Boss acceptance criteria

- Each phase must have a distinct gameplay identity.
- Every boss action must have a matching body animation and synchronized telegraph.
- Phase 3 must be measurably more dangerous than phase 2 in tempo and combinations.
- Difficulty modifiers may affect windups, cooldowns, projectile behavior, and coordination within fair bounds.
- Health changes alone do not satisfy the improvement.
- Validate the boss against weak, coherent, and high-synergy builds on all difficulties.

## 10. Damage numbers and combat readability

Replace the current lower-HUD damage messages with spatial animated damage numbers.

- Numbers appear at the damaged actor.
- Each number pops in, expands outward, and fades quickly.
- Normal enemy damage remains compact.
- Critical damage is larger and gold.
- Player damage is red.
- Healing is green.
- Blocked or heavily mitigated damage is muted.
- Rapid hits spread or aggregate within a small readability window.
- Multiple simultaneous targets must not overwrite one another.
- Use object pooling and a fixed on-screen cap.
- Reduced-motion mode uses a restrained fade/offset treatment.
- The old damage-message behavior must be removed so both systems never appear together.
- Keep the HUD message area for rewards, objectives, and system information.

## 11. Narrative and character specification

### 11.1 Narrative scale

- Target approximately **4,000–6,000 words** for a first completed run.
- Target roughly 20–30 minutes of distributed first-run narrative.
- Do not make every scene the same length.
- Every scene must advance mystery, relationship, character, emotional state, foreshadowing, or gameplay meaning.
- Do not use length as a substitute for depth.
- Maintain the knowledge-state restrictions and reveal order in `Instructions.md`.

### 11.2 Opening expansion

Begin with a short, warm domestic scene showing Zephyr and Elowen together before her disappearance.

The opening must:

- Make the marriage feel lived-in rather than merely stated.
- Establish their conversational rhythm and genuine affection.
- Establish the paired rings naturally.
- Hint at Elowen's concealed unease without exposing necromancy.
- Give Zephyr a memory of Elowen worth carrying through the descent.
- Transition to her absence, the ring's pull, pursuit, and threshold confrontation.
- Avoid a lore lecture or disposable tutorial dialogue.

### 11.3 Tone and voices

Use restrained adult gothic tragedy with genuine marital warmth and occasional dry familiarity.

#### Zephyr

- Direct, grounded, emotionally contained, and active.
- Devoted without being foolish.
- Converts fear into action.
- His flaw is treating devotion as sufficient understanding.
- Under pressure he becomes shorter and more absolute, not grander.

#### Elowen

- Brilliant, compassionate, secretive, and accustomed to making consequential decisions.
- Her human warmth must be real.
- Corruption turns preservation into ownership and certainty into domination.
- The progression must be traceable across all ten floors and all 29 upgrade scenes.
- Do not turn her into a generic seductress, screaming villain, or innocent passenger with no responsibility.

#### The Witch

- Ancient, clinical, precise, restrained, and willing to be hated.
- Replaces persuasion with observable evidence.
- Never begs for sympathy, boasts, taunts, or explains the twist early.
- Her flaw is treating people like cases, risks, and outcomes.

### 11.4 Branching

- Keep narrative progression deterministic until the final five-second action.
- Do not add cosmetic dialogue choices that pretend to branch.
- Upgrade selection remains the mechanical choice following its scene.
- The only ending branch remains kill or hesitate.

## 12. Full-screen visual-novel system

### 12.1 Scene coverage

Use full-screen visual-novel staging for:

- The domestic opening.
- The disappearance and ring pursuit.
- The threshold confrontation.
- Every Witch floor projection.
- **All 29 upgrade encounters as separate full-screen scenes.**
- Pivotal corruption scenes.
- Boss confrontation and Witch death.
- Princess reveal.
- Both endings.

After an upgrade scene completes, transition to the corresponding upgrade selection as a distinct step.

### 12.2 Presentation requirements

- Large character cutouts rather than small square portraits.
- Left/right/center speaker staging.
- Per-beat expression and pose changes.
- Layered illustrated backgrounds or controlled live-scene treatments.
- Speaker nameplate and readable text box.
- Typewriter animation.
- First advance input completes the current typewriter line; the next advances.
- Adjustable text speed and auto speed.
- Auto mode.
- Dialogue history/backlog.
- Hide-UI control.
- Hold-to-fast-forward.
- Skip previously read text.
- Scene skip with confirmation.
- Persistent read-state tracking.
- New text must never be automatically skipped.
- Keyboard, mouse, controller, and touch support.
- Accessible focus order, scaling, contrast, and reduced-motion behavior.

### 12.3 Background strategy

- Create a controlled set of authored illustrated backgrounds for major story locations.
- Use coherent variations rather than generating a unique unrelated background for every scene.
- Upgrade scenes may use art-directed, blurred, graded, or illustrated treatments of the current biome.
- Backgrounds must preserve text contrast and character silhouette separation.

### 12.4 Ending choice and glossary

Implement the complete ending state machine and presentation required by `Instructions.md`.

- Defeating the Witch must not end the run immediately.
- Complete the Witch's final dialogue before her defeat presentation resolves.
- Dismiss Witch-origin forces and controlled effects while preserving Elowen-origin instability.
- Present the corrupted triumph, Zephyr's realization, Elowen's lucid return, and her request for death in the approved order.
- Begin one five-second decision window only after the final human plea completes.
- Represent time with a circular, nonnumeric visual countdown; do not rely on plain countdown text.
- Increase visual corruption, instability, and camera trauma as time expires, with reduced-motion alternatives.
- Accept the explicit kill action from every supported input type strictly before the deadline.
- Freeze or resolve timing correctly across pause, backgrounding, low frame rates, and large frame jumps.
- Flush stale input before the choice and prevent accidental double activation.
- Resolve the result exactly once.
- Play the complete kill ending after a valid strike.
- Play the complete timeout ending after hesitation or expiry.
- Complete a controlled fade to black before presenting post-ending UI.
- Keep the glossary locked during ordinary runs, deaths, and incomplete endings.
- Unlock the glossary persistently only after either ending fully completes.
- Keep settings reset, statistics reset, run suspension, and ordinary death from clearing or incorrectly granting glossary access.

## 13. Art direction and asset-production specification

### 13.1 Required art-direction artifacts

Before mass asset production, create and obtain approval for:

- `docs/ART_DIRECTION.md` or an equally explicit approved art-direction file.
- Exact palette values and semantic color roles.
- Lighting and contrast rules.
- Material and texture language.
- Character proportion and silhouette rules.
- Painterly rendering, edge, and detail rules.
- VN composition and portrait-framing rules.
- Gameplay readability rules.
- UI typography and ornament rules.
- VFX shape, timing, additive/blend, and color rules.
- Sprite-atlas dimensions, padding, frame cadence, origin, naming, and export rules.
- Reusable asset briefs and negative constraints.
- Approved reference sheets and representative in-game mockups.

“Gothic” or “painterly” alone is not a sufficient art direction.

### 13.2 Character concept gate

Produce three tightly controlled concept variants for each principal character:

- Zephyr.
- Elowen in human and corrupted design language.
- The Witch.

Do not mass-produce portraits, poses, or scene art until one canonical design per character is approved.

### 13.3 Zephyr presentation

- His face is fully visible in visual-novel scenes.
- Use an open-faced or raised helmet as part of his recognizable silhouette.
- The gameplay model may lower or close the helmet for combat readability.
- Keep the wedding ring visually legible in close story art when composition permits.
- His scythe, armor, and portrait must describe the same character.

### 13.4 Character-art coverage

At minimum, provide:

#### Zephyr

- Calm.
- Affectionate.
- Alarmed.
- Determined.
- Doubtful.
- Injured.
- Enraged.
- Devastated.
- Resolved.

#### Elowen

- Human baseline.
- Four readable transitional corruption stages.
- Fully corrupted state.
- Affectionate.
- Frightened.
- Strained.
- Commanding.
- Possessive.
- Briefly lucid.
- Triumphant.
- Final human plea.

#### The Witch

- Clinical baseline.
- Warning.
- Observing.
- Combat-ready.
- Wounded.
- Final acceptance.

Provide full-body VN cutouts, compatible portrait crops, left/right staging support, and consistent scale and lighting.

### 13.5 VFX and sprite-atlas coverage

Create a documented asset matrix before production. It must cover at least:

- Scythe combo trails for all three attacks.
- Dash and dash-strike afterimages.
- Charge start, levels, perfect window, ordinary release, and perfect release.
- Reaper's Claim throw, travel, hit, pull, recall, catch, and empowered follow-up.
- Normal, critical, blocked, and heavy hit effects.
- Healing, Harvest gain/spend, and Death Defiance.
- Witch-origin clean summoning and dismissal.
- Elowen-origin unstable summoning, corruption, and defeat.
- Every enemy attack family.
- Every Witch boss action and phase transition.
- Environmental hazards, portals, rewards, and ending effects.

Sprite effects must be synchronized to the real action animation and mechanical timing.

### 13.6 Natural animation requirement

An actor may not appear idle while detached effects perform its attack.

For every player, enemy, boss, and story-world action:

- The actor's body must anticipate the action.
- The weapon, limb, or casting focus must visibly perform it.
- The telegraph must lead into the actual motion.
- The damage or projectile release must occur at the correct animation event.
- Recovery must communicate the action's risk.
- VFX must originate from the animated contact point.
- Hit reactions and state transitions must interrupt or blend intentionally.

If an existing 3D model lacks the required animation, add, retarget, or author a compatible animation before shipping the action. Do not hide missing animation behind a sprite, projectile, screen flash, or camera shake.

### 13.7 Existing art migration

- Replace the current title and character portrait suite only after the new direction and canonical designs are approved.
- Do not leave an inconsistent mixture of old and new principal-character art in the final build.
- Preserve existing assets until replacement is verified and deletion is separately authorized.
- Audit currently unused sprite sheets before deciding whether to integrate or retire them.

### 13.8 Provenance and licensing

- Use only original work or assets with clear redistribution and modification rights.
- Retain editable masters where available.
- Record the source, creator, license, source URL, modifications, and attribution requirements.
- Update `public/assets/LICENSES.md` for every external asset.
- Reject assets with unclear, contradictory, non-commercial, non-redistributable, or missing terms unless the intended distribution explicitly permits them and the user approves.

## 14. Music and sound direction

### 14.1 Music objective

The current procedural oscillator score is not sufficient as the final soundtrack. Replace or substantially supplement it with polished, memorable, legally usable music sourced through careful research.

Keep the useful adaptive architecture where practical:

- Biome identity.
- Exploration/combat/boss states.
- Musically timed transitions.
- Dialogue ducking.
- Intensity control.
- Separate audio buses.

### 14.2 Music research process

Use multiple bounded research agents for different cue groups rather than one unstructured web search.

For every candidate, record:

- Direct source page.
- Creator and track title.
- Exact license and authoritative license evidence.
- Price and acquisition terms.
- Whether modification, redistribution, and commercial use are permitted.
- Attribution text.
- Available formats and quality.
- Loop points or edit suitability.
- Stem availability.
- Tempo and approximate key where discoverable.
- Intended scene, biome, or gameplay state.
- Why the track supports the narrative or combat function.

Reject candidates when license terms cannot be proven. Do not download from repost mirrors when an authoritative source exists. Do not purchase or subscribe to music services without explicit user approval.

### 14.3 Musical identity

Prefer a cohesive gothic chamber palette rather than unrelated “dramatic” tracks.

Develop or select music around three recurring motifs:

1. Paired-ring devotion.
2. The Witch's ordered containment.
3. Elowen's corruption.

Allow motifs to overlap and change meaning near the finale. A theme first heard as romantic may later reveal harmonic or instrumental corruption.

Required cue functions include:

- Main menu/title.
- Domestic opening.
- Absence and ring pursuit.
- Witch projections.
- Upgrade intimacy and corruption progression.
- Four biome exploration/combat identities.
- Witch boss phases.
- Witch death and unstable aftermath.
- Elowen reveal.
- Five-second decision.
- Kill ending.
- Timeout ending.
- Credits or post-ending reflection.

One track may serve multiple closely related functions through stems or arrangement, but each transition must feel deliberate.

### 14.4 Sound-effects pass

Create cohesive layered sound for:

- Every scythe attack and impact class.
- Charge levels and perfect release.
- Reaper's Claim throw, travel, pull, recall, catch, and follow-up.
- Harvest gain, full state, spend, and insufficient-resource feedback.
- Dash, perfect dash, critical hit, block, healing, and Death Defiance.
- Enemy weight classes and attack families.
- Witch and Elowen origin identities.
- Boss phases and arena hazards.
- Visual-novel text, advance, backlog, auto, skip, and scene transitions.
- Main-menu navigation and difficulty selection.

Do not add full spoken dialogue.

## 15. Main menu and navigation

Redesign the main menu within the approved illustrated-gothic direction.

Required destinations:

- Continue, only when a valid suspended run exists.
- New Descent.
- Records.
- Glossary.
- Settings.
- Credits.
- Quit where supported.

Presentation should include:

- Animated painterly title composition.
- Subtle parallax.
- Restrained atmospheric particles.
- Ring illumination.
- Title motif.
- Scythe-cut or similarly authored transitions.
- Strong primary-action hierarchy.
- Responsive layouts.
- Reduced-motion alternatives.
- Clear loading and error states.

`New Descent` must lead to difficulty selection before starting the run.

## 16. Run suspension

Add a local room-boundary suspend system because the expanded combat and narrative increase run length.

- Allow suspension only at stable room-boundary states outside combat, modal transitions, and the ending choice.
- Persist enough deterministic state to resume safely.
- Validate and version the schema.
- Reject malformed or incompatible state safely.
- Never offer Continue for invalid state.
- Clear the suspended state after terminal run completion or an explicitly confirmed abandon action.
- Do not conflate suspended-run data with settings, narrative unlocks, or lifetime statistics.
- Test save/reload across floors, upgrade states, Harvest, Death Defiance, difficulty, and narrative ordering.

## 17. Statistics and Records

### 17.1 Time semantics

- **Run time:** Combat and narrative time from start to terminal outcome, excluding pauses and background-tab time.
- **Combat time:** Time actively spent in combat phases.
- **Total playtime:** Active foreground time in menus, narrative, and gameplay, excluding pauses and background-tab time.

### 17.2 Run statistics

Track at minimum:

- Seed and difficulty.
- Duration and combat time.
- Deepest floor and rooms cleared.
- Ending or cause of death.
- Enemies killed by type and origin.
- Damage dealt and taken.
- Healing received.
- Critical hits and highest hit.
- Dashes and perfect dashes.
- Charged reaps and perfect releases.
- Reaper's Claim uses.
- Harvest generated and spent.
- Death Defiance activations granted and consumed.
- Upgrades, ranks, rerolls, and final path totals.
- Boss attempt and clear time.

### 17.3 Lifetime statistics

Track at minimum:

- Total active playtime.
- Attempts.
- Completions by ending and difficulty.
- Best completion time by difficulty.
- Deepest floor by difficulty.
- Aggregate kills, damage, healing, criticals, and highest hit.
- Aggregate use of major combat actions.
- Boss attempts and clears.
- Upgrade and path-selection history sufficient to summarize preferred builds.

### 17.4 Presentation and privacy

- Show a concise run summary after ordinary death or either ending.
- Show detailed lifetime Records from the main menu.
- Separate difficulty-specific records where comparison would otherwise be misleading.
- Store statistics locally in a validated, versioned schema.
- Do not send external telemetry.
- Provide a separately confirmed Reset Statistics action.
- Storage failures must not crash the game or discard valid in-session results.

Do not persist the diagnostic-heavy autoplay reporter schema directly as player-facing statistics. Reuse concepts and event sources while creating a stable product-facing model.

## 18. Accessibility and input

- Preserve keyboard/mouse, controller, and touch support.
- Make every new action remappable where the current input architecture permits.
- Add conflict detection for Reaper's Claim and new VN controls.
- Ensure all VN scenes, difficulty selection, upgrades, Records, pause, and endings work without a mouse.
- Preserve UI scale, contrast, reduced motion, flash reduction, subtitle/text settings, and particle/effects controls.
- Damage numbers and Harvest state must not rely on color alone.
- Provide readable focus states and correct modal focus management.
- Test minimum supported viewport and coarse-pointer layouts.

## 19. Performance requirements

- Preserve the existing fixed-step simulation and rendering separation.
- Preserve pooling and instancing where appropriate.
- Pool damage numbers and transient VFX.
- Define caps for simultaneous numbers, sprite effects, particles, hazards, and animated scene layers.
- Keep combat mechanics independent of frame rate.
- Asset loading must not introduce avoidable combat stutter.
- Stream or preload large story and audio assets according to when they are required.
- Maintain the existing documented performance budgets unless a reviewed measurement justifies a change.
- Re-run stress benchmarks after each high-impact rendering or audio milestone.

## 20. Workstream deliverables and success criteria

### 20.1 Repository audit

Deliverables:

- Architecture map.
- Working-tree ownership map.
- Current behavior inventory against every requirement in this file.
- Reuse/replace recommendations.
- File-level implementation plan.
- Risk register.

Success:

- Claims have file and runtime evidence.
- Existing partial implementations are identified rather than rebuilt blindly.
- Proposed edits comply with approval rules.

Failure:

- Assuming architecture.
- Treating README claims as gameplay proof.
- Ignoring working-tree changes.

### 20.2 Art direction

Deliverables:

- Approved art-direction file.
- Palettes, silhouettes, typography, materials, VFX language, and export rules.
- Canonical character concept sheets.
- Representative VN scene, menu, combat VFX, and gameplay integration samples.
- Asset matrix and provenance template.

Success:

- A new specialist can create an asset without inventing a different style.
- Representative samples look coherent in the running game.

Failure:

- Mood adjectives without exact rules.
- Mass generation before approval.
- Character or VFX inconsistency.

### 20.3 Combat

Deliverables:

- Combat-state and input design.
- Reaper's Claim implementation.
- Harvest meter and HUD.
- Perfect charged-reap release.
- Selective hit-stop and poise/stagger.
- Complete matching animations and synchronized effects.
- Focused automated tests and playtest measurements.

Success:

- Inputs are buffered and deterministic.
- Every action has readable commitment and feedback.
- Claim is useful two to four times per typical chamber.
- Animation, hit windows, audio, and VFX agree.

Failure:

- Detached effects perform attacks while actors remain visually idle.
- Unlimited cancel safety.
- Resource gain is unclear or unusable.
- Compilation-only validation.

### 20.4 Upgrades and difficulty

Deliverables:

- Complete upgrade audit.
- Redesigned chamber upgrades and floor blessings.
- Exact card values and synergy UI.
- Reroll system.
- Death Defiance total-grant cap.
- Difficulty selection and behavior profiles.
- Encounter-coordination changes.
- Balance telemetry and tests.

Success:

- Every advertised upgrade works.
- Strong builds feel transformative.
- Weak builds are punishable without RNG making coherent builds impossible.
- Standard and Ruthless differ behaviorally.

Failure:

- Mostly tiny percentage changes.
- Hidden or dishonest calculations.
- Death Defiance offered after its cap.
- Difficulty achieved mainly through health inflation.

### 20.5 Enemy-origin integration

Assign one integration owner across encounter planning, runtime state, rendering, animation, audio, and narrative QA.

Deliverables:

- Stable Witch/Elowen origin metadata carried through enemies, projectiles, hazards, combat events, dismissals, and statistics.
- Floor-by-floor origin quotas and encounter progression.
- Distinct spawn, movement, attack, hit, defeat, and dismissal presentation contracts for both origins.
- An authored floors 7–10 clash/interference plan that preserves combat fairness.
- Dialogue and knowledge-state checks proving Zephyr does not identify the true source before the reveal.
- Cross-system automated tests and a manual acceptance matrix.

Success:

- Players can gradually perceive two controlling forces through consistent behavior, animation, VFX, and audio.
- Origin state survives every relevant runtime boundary and is reported accurately.
- Witch-origin cleanup preserves Elowen-origin actors and instability.
- Authored clashes are readable and never decide rooms arbitrarily.

Failure:

- Origin exists only as hidden metadata with no perceptible language.
- Visual/audio cues expose Elowen explicitly before the reveal.
- Projectiles, summons, statistics, or cleanup lose their origin.
- Unrestricted friendly fire creates unpredictable encounters.

### 20.6 Narrative and VN

Deliverables:

- Updated narrative and voice bibles.
- Scene-by-scene outline.
- Knowledge-state and foreshadowing maps.
- Complete 4,000–6,000-word dialogue corpus.
- All 29 full-screen upgrade scenes.
- VN presentation, read-state, backlog, auto, fast-forward, and skip systems.
- Ending controller with circular five-second choice, idempotent input resolution, pause/low-frame-rate correctness, escalating instability, both complete outcomes, and controlled fade.
- Persistent glossary lock/unlock flow that grants access only after a completed ending.
- Narrative continuity audit and revision.

Success:

- Proper visual-novel presentation.
- Distinct character voices.
- Smooth Elowen progression.
- Twist protected until the reveal.
- Repeat runs remain usable.
- Both endings resolve exactly once and the glossary remains locked until completion.

Failure:

- Exposition dumps.
- Generic fantasy dialogue.
- Repeated warnings or emotional beats.
- Small-panel presentation or inline-only upgrade dialogue.
- Early canon disclosure.
- Immediate victory on Witch defeat, numeric-only countdown, late/double input acceptance, soft lock, or premature glossary access.

### 20.7 Music and audio

Deliverables:

- Cue map.
- Candidate research matrix.
- License evidence and attribution.
- Selected soundtrack plan.
- Integrated adaptive transitions.
- Complete combat/UI/VN SFX pass.
- Audio settings and failure behavior.

Success:

- Music is cohesive, memorable, scene-appropriate, and legally usable.
- Transitions respond naturally to exploration, combat, dialogue, boss phases, and endings.
- No voice acting is introduced.

Failure:

- Ambiguous license.
- Unrelated tracks selected only because they are “dramatic.”
- Hard cuts without musical intent.
- Replacing one repetitive loop with another.

### 20.8 Menu, persistence, and statistics

Deliverables:

- Redesigned title flow.
- Difficulty selection.
- Suspend/Continue system.
- Run and lifetime statistics stores.
- End-of-run summary.
- Records UI.
- Storage migrations/validation and tests.

Success:

- Navigation is polished across input types.
- Suspended runs restore deterministic state safely.
- Statistics match documented semantics.
- Invalid storage never soft-locks the game.

Failure:

- Continue appears for invalid data.
- Paused/background time pollutes timing.
- Diagnostic telemetry is exposed directly as product UI.

## 21. Verification matrix

### Automated verification

Run the smallest relevant tests during each milestone and the full suite before final acceptance.

Required coverage includes:

- Input buffering and rebinding.
- Harvest generation, bonuses, cap, persistence, and spend.
- Reaper's Claim outward, recall, pull resistance, stagger, and follow-up.
- Charged-reap perfect-release timing.
- Hit-stop bounds and pause/frame-rate behavior.
- Every upgrade and blessing contract.
- Upgrade offer path coverage, exclusions, rerolls, and fallbacks.
- Death Defiance total-grant cap and offer removal.
- Difficulty selection and locking.
- Encounter coordination and deterministic generation.
- Enemy-origin propagation through actors, projectiles, hazards, events, dismissal, and statistics.
- Floor origin quotas, late-floor authored clashes, and Witch-only cleanup behavior.
- Boss phase identity and escalation.
- Damage-number pooling and old-message removal.
- Every narrative scene identifier and ordering rule.
- All 29 upgrade scenes.
- Read-state, auto, backlog, fast-forward, skip, and input behavior.
- Circular five-second ending progress without numeric-only reliance.
- Ending pause, backgrounding, low-frame-rate, stale-input, deadline, and exactly-once resolution behavior.
- Both complete ending branches, controlled fade, glossary lock before completion, and persistent unlock afterward.
- Suspend/resume state.
- Run and lifetime statistics.
- Malformed local storage.
- Asset readiness and missing-key failures.
- License manifest coverage where it can be validated mechanically.

### Manual gameplay validation

Compilation, unit tests, or autoplay alone do not validate game feel.

Manually validate:

- Keyboard/mouse, controller, and touch.
- Story, Standard, and Ruthless.
- Weak, coherent, and high-synergy builds.
- Reaper, Shade, Grave, and hybrid paths.
- Reaper's Claim usability and animation.
- Every enemy attack and boss action.
- Witch/Elowen origin readability and fair authored interference across representative early and late floors.
- Both endings.
- Pause and background-tab behavior.
- Suspend and resume at representative floors.
- Minimum viewport, high UI scale, high contrast, and reduced motion.

### Manual visual validation

Inspect in the running game:

- Character design continuity between VN art and 3D actors.
- Every principal expression and corruption stage.
- All major action animations.
- VFX origin, timing, blending, and readability.
- Damage-number density.
- Harvest readability without color.
- Menu hierarchy and transitions.
- Every VN layout on desktop and mobile.
- Background/character/text separation.
- Boss phases and ending instability.
- Ordered-force dismissal versus preserved necromantic instability after the Witch dies.

### Manual audio validation

Listen in context for:

- Main-menu start behavior after browser audio unlock.
- Scene-to-combat transitions.
- Dialogue ducking and restoration.
- Biome identity.
- Boss phase changes.
- Reaper's Claim and Harvest states.
- Both ending cues.
- Master/music/SFX/UI controls.
- No clipping, runaway sources, abrupt looping, or missing attribution.

## 22. Final definition of done

The complete direction is implemented only when:

- All approved systems and content in this document exist in the running game.
- Combat is responsive, powerful, and punishable.
- Reaper's Claim and Harvest are complete across input, HUD, animation, audio, VFX, upgrades, tests, and accessibility.
- Upgrade paths produce flexible, impactful, punishable builds.
- Death Defiance can never exceed two total grants per run or reappear afterward.
- Difficulty is selected before every run and differs through behavior as well as statistics.
- The Witch uses three distinct escalating phases and is validated against the finished power curve.
- Animated spatial damage numbers fully replace old damage messages.
- Zephyr, Elowen, and the Witch have approved coherent designs and complete required story art.
- Every gameplay action is visibly and naturally performed by its actor.
- All required combat and story sprite/VFX assets are integrated and synchronized.
- Every required narrative event, including all 29 upgrade encounters, uses full-screen VN presentation.
- The dialogue corpus meets the approved scope, canon, quality, and progression.
- The soundtrack is cohesive, scene-appropriate, and legally documented.
- No voice acting is added.
- The redesigned menu, difficulty flow, suspend/Continue, Records, glossary, settings, and credits are production-ready.
- Run and lifetime statistics use the approved semantics and local-only storage.
- Automated tests pass.
- Manual gameplay, visual, audio, accessibility, and both-ending validation are recorded honestly.
- Performance remains within documented budgets or any variance is measured and explicitly approved.
- License and attribution records are complete.
- The final diff contains no unrelated changes, placeholder content, dead scaffolding, or undocumented canon edits.

## 23. Prohibited shortcuts

Do not consider the work complete by:

- Increasing enemy or boss health without behavioral changes.
- Adding more particles without matching character animation.
- Playing a projectile or sprite while the actor remains visually idle.
- Making every upgrade a small percentage increase.
- Claiming upgrades work without testing every effect.
- Calling centered small-panel dialogue a full visual-novel presentation.
- Expanding dialogue through exposition or repetition.
- Using unrelated royalty-free tracks without a cohesive cue plan.
- Using music with ambiguous rights.
- Mixing inconsistent principal-character art.
- Using color as the only information channel.
- Persisting autoplay diagnostics directly as player records.
- Claiming visual, audio, balance, or gameplay quality from compilation alone.
- Letting subagents retry indefinitely or accepting their completion claims without primary-agent review.
