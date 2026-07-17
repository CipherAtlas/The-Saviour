You are the lead narrative, systems, implementation, and QA agent for an existing short roguelite game.

Your job is to inspect the current repository, understand the existing architecture, and fully implement the narrative layer described below without damaging existing gameplay systems.

You must work as a manager coordinating specialized sub-agents. Do not attempt to do every task yourself in one pass.

Use the most relevant installed skills where available, especially:

* story-idea-generator
* outline-collaborator
* story-collaborator
* drafting
* dialogue
* voice-analysis
* character-arc
* scene-sequencing
* story-zoom
* cliche-transcendence
* revision
* any relevant game-development, UI, testing, architecture, or engine-specific skills

Do not force a skill into a task where it does not apply.

# PRIMARY OBJECTIVE

Turn the existing roguelite into a short, replayable narrative experience with:

* A strong opening sequence
* Dialogue before entering the dungeon
* Witch projection dialogue at the beginning of every floor
* Princess dialogue whenever upgrades are offered
* Prince responses throughout the game
* Gradual narrative escalation across ten floors
* Foreshadowing that remains understandable only in retrospect
* A clear distinction between enemies created by the witch and enemies created by the corrupted princess
* A rewritten final encounter
* A five-second ending choice
* Two complete endings
* Proper narrative-state tracking
* Correct dialogue ordering
* Thorough testing of story flow, mechanics, UI, and edge cases

The game is intentionally short and replayable. Do not create an enormous branching narrative or hundreds of unnecessary lines.

# WORKING METHOD

Begin by inspecting the repository.

Identify:

* The game engine and language
* Current folder structure
* Existing gameplay loop
* Floor progression
* Upgrade-selection flow
* Enemy spawning logic
* Current dialogue systems
* Current final boss and ending
* UI architecture
* State-management patterns
* Testing setup
* Save or persistence systems
* Audio, animation, screen-shake, and transition utilities
* Existing content conventions

Do not assume architecture before inspecting it.

After inspection, create a concise implementation plan and divide the work among sub-agents.

# REQUIRED SUB-AGENTS

Create and coordinate at least the following sub-agents.

## 1. Repository and Architecture Auditor

Responsibilities:

* Inspect the complete relevant codebase
* Map the current run loop
* Identify where narrative events should integrate
* Locate current floor-start logic
* Locate current upgrade-selection logic
* Locate boss-death and game-ending logic
* Identify existing UI and animation utilities
* Identify risks, technical debt, and likely regression points
* Recommend the safest implementation structure

Deliverables:

* Architecture map
* Relevant file list
* Current narrative-flow description
* Integration recommendations
* Risk list
* Definition of done for implementation

This agent must not modify code.

## 2. Narrative Director

Use relevant story-planning, character-arc, sequencing, and story-zoom skills.

Responsibilities:

* Turn the supplied story into a complete but compact narrative structure
* Establish what happens before the dungeon and across floors 1–10
* Define the emotional and informational purpose of every dialogue event
* Decide exactly when clues are introduced
* Ensure the mystery remains hidden from the prince
* Ensure the player can reinterpret previous dialogue after the reveal
* Prevent the story from becoming too large for a short roguelite

Deliverables:

* Narrative bible
* Floor-by-floor narrative progression
* Opening-sequence outline
* Ending-sequence outline
* Character objectives
* Knowledge-state chart
* Foreshadowing map
* Canon rules
* Forbidden revelations before the ending

## 3. Character Voice Director

Use voice-analysis and character-arc skills.

Responsibilities:

Create authoritative voice profiles for:

* The Prince
* The Princess in her human state
* The Princess in transitional corruption states
* The fully corrupted Princess
* The Witch

Define for each:

* Sentence length
* Vocabulary
* Emotional strategy
* Rhythm
* Formality
* Humor
* Typical imagery
* What they avoid saying
* How their voice changes under pressure
* Example reference lines
* Forbidden generic phrases
* Knowledge limitations

The Princess must have a gradual, traceable voice transition from loving to corrupted.

The Witch must remain cold and clinical without sounding generically evil.

The Prince must remain emotionally believable without becoming foolish, melodramatic, or passive.

Deliverables:

* Character voice bible
* Princess corruption voice ladder
* Dialogue-style guide
* Anti-repetition rules
* Anti-generic-fantasy rules

## 4. Dialogue Writer

Use story-collaborator, drafting, dialogue, scene-sequencing, and cliche-transcendence skills.

Responsibilities:

Write the complete first draft of all required dialogue.

This includes:

* Opening dialogue
* Pre-dungeon conversation
* Prince dialogue
* Witch floor-introduction projections
* Princess upgrade dialogue
* Prince responses to upgrades
* Transitional lines between gameplay phases where useful
* Final witch confrontation
* Witch death sequence
* Princess reveal
* Five-second choice sequence
* Kill ending
* Failure-to-kill ending
* Final lines before fade to black
* Optional glossary-unlock notification

All dialogue must follow the narrative bible and voice guide.

Do not invent major new lore without documenting it as a proposal.

Do not reveal that the princess is a necromancer before the ending.

Do not let the prince understand the truth early.

Do not make the witch openly explain the twist.

Do not produce exposition dumps.

Keep the amount of dialogue appropriate for a short action roguelite.

## 5. Dialogue Continuity and Repetition Auditor

This agent must review the dialogue after the first draft.

Responsibilities:

* Check what each character knows at each floor
* Check that the prince does not discover the truth early
* Check that the witch never reveals too much
* Check that princess corruption progresses gradually
* Check repeated sentence structures
* Check repeated warnings
* Check repeated emotional beats
* Check generic fantasy dialogue
* Check accidental lore contradictions
* Check whether each dialogue event has a distinct function
* Check whether lines will become annoying on repeated runs
* Check whether the floor order makes narrative sense

Deliverables:

* Issue report
* Severity-ranked dialogue problems
* Recommended revisions
* Repetition matrix
* Knowledge-state violations
* Revised final dialogue corpus

## 6. Gameplay and Narrative Systems Engineer

Responsibilities:

Design and implement the narrative state system.

It must support:

* Opening sequence state
* Floor-specific witch dialogue
* Floor-specific princess upgrade dialogue
* Dialogue ordering
* Character portraits or presentation if already supported
* One-time and repeatable lines
* Narrative progress across ten floors
* Correct state when restarting a run
* Correct state if the player dies and retries
* Ending-sequence state
* Five-second decision timer
* Choice result
* Ending completion
* Glossary unlock after game completion

Avoid overengineering.

Prefer a clear data-driven structure if compatible with the existing architecture.

Dialogue content should be separable from gameplay logic where practical.

Do not silently replace established project conventions.

## 7. Enemy-Lore Systems Agent

Responsibilities:

Inspect the existing enemy roster and spawning system.

Establish a gameplay-readable distinction between:

* Enemies deliberately summoned by the witch
* Enemies irrationally created by the corrupted princess

The distinction may use existing:

* Enemy types
* Visual effects
* Spawn effects
* Animations
* Behaviors
* Audio cues
* Metadata
* Encounter composition

Do not create a massive new enemy-production scope unless necessary.

The narrative rule is:

* The witch’s forces are controlled, deliberate, ordered, and defensive.
* The princess’s forces are unstable, necromantic, irrational, aggressive, and sometimes counterproductive.
* The corrupted princess wants the prince to reach her, but necromancy has destroyed coherent logic.
* Therefore she empowers him while also making his journey more dangerous.

The agent must ensure the distinction is hinted at through gameplay and dialogue without exposing the twist too soon.

## 8. Ending and UI Implementation Agent

Responsibilities:

Replace the current ending where killing the witch simply ends the game.

Implement the full ending flow.

Required sequence:

1. The prince defeats the witch.
2. The witch delivers her final lines.
3. The witch dies or is defeated.
4. Her controlled forces or magical effects cease.
5. The prince reaches the princess.
6. The princess briefly regains human consciousness.
7. She urgently asks the prince to kill her before the corruption takes control again.
8. A five-second quick-time decision begins.
9. The timer must be represented visually as a circular countdown, not a plain number.
10. The screen becomes increasingly unstable as time runs out.
11. Screen shake should intensify as corruption returns.
12. The player may choose to kill the princess before time expires.
13. If the player succeeds, play the tragic kill ending.
14. If the player hesitates or time expires, play the corrupted ending.
15. Complete the ending with final dialogue and a controlled fade to black.
16. Unlock the glossary only after an ending has been completed.

The timer must:

* Be readable
* Be visually integrated
* Not use only numerical text
* Respect pause behavior where appropriate
* Avoid accidental double input
* Resolve exactly once
* Handle keyboard, controller, and mouse if the game supports them
* Avoid soft-locking
* Behave correctly at low frame rates

## 9. QA and Narrative Flow Agent

Responsibilities:

Create and execute a full test plan.

Test:

* New game opening
* Pre-dungeon dialogue
* Every floor introduction
* Every upgrade dialogue
* Dialogue ordering
* Floor progression
* Princess corruption progression
* Witch clue progression
* Enemy-source distinction
* Player death and run restart
* Repeat-run dialogue behavior
* Final boss defeat
* Ending transition
* Timer behavior
* Kill input
* Timer expiration
* Both endings
* Fade to black
* Glossary unlock
* Save and reload behavior where applicable
* Missing dialogue keys
* Missing UI assets
* Duplicate lines
* Broken state transitions
* Soft locks
* Timing issues
* Input conflicts
* Regression in existing combat and upgrade systems

The QA agent must not merely confirm that code compiles.

It must validate actual narrative order and gameplay flow.

# STORY BIBLE

## World

The world is openly magical.

Magic itself is normal enough that paired wedding rings may form a meaningful magical bond between spouses.

Necromancy is different.

Necromancy is absolutely forbidden because it does not merely create dangerous magic. It progressively corrupts identity, emotion, logic, restraint, and the natural order of life and death.

There is currently only one known living necromancer: the Princess.

## The Prince

The Prince is married to the Princess.

At the beginning of the game, he discovers that she is missing.

They still each wear their wedding ring.

Because the rings are magically paired, the Prince can focus on his ring and faintly sense the Princess’s presence.

He does not know:

* That she practiced necromancy
* That she became corrupted
* That she is being contained
* That the Witch is protecting the world
* That some enemies come from the Princess
* That the Princess’s power is unstable
* That rescuing her may cause catastrophe

He believes only that:

* His wife has been kidnapped
* A dangerous witch is holding her
* The witch is sending enemies to stop him
* His wife is helping him survive
* He must reach and rescue her

His belief must remain sincere until the final reveal.

## The Princess

The Princess began as a human being capable of love.

She became involved with necromancy and has now reached a fully corrupted state.

She is not curable.

Her death is the only way to destroy the current root of necromancy.

However, brief fragments of her original consciousness still surface through her emotional bond with the Prince.

This creates two simultaneous impulses:

### Her remaining human side

* Loves the Prince
* Knows she is doomed
* Wants him to reach her
* Gives him power
* Hopes he can kill the Witch
* Ultimately hopes he can kill her too
* Briefly regains control at the ending and asks him to end her life

### The corruption

* Wants freedom
* Wants the Witch dead
* Wants to use or kill the Prince
* Uses the ring bond to influence him
* Gives him power to help him reach the prison
* Irrationally summons enemies against him
* Cannot maintain logical goals
* Becomes increasingly possessive, cruel, and unstable

Her ability to offer upgrades is explained to the Prince as:

“This place and our love have made a kind of bond. I can lend you some of my strength.”

The explanation should sound plausible within the magical world.

## The Witch

The Witch is an extremely ancient entity.

She has secretly prevented multiple catastrophes throughout history.

The Prince does not know her identity or history.

The player does not receive the glossary explaining her history until the end of the game.

She has seen necromantic corruption before.

She knows:

* It cannot be cured
* Destroying its root requires the necromancer’s death
* The Princess is the only known living necromancer
* The Princess is manipulating the Prince
* The Princess’s human consciousness still occasionally surfaces
* These moments do not make a cure possible
* Some dungeon enemies are being created by the Princess
* The Prince’s ring makes him vulnerable to influence

The Witch kidnapped and imprisoned the Princess in order to:

* Contain her
* Study the necromantic corruption
* Understand its source and behavior
* Identify weaknesses
* Learn how future necromancers may be detected
* Prevent necromancy from ever spreading
* Kill the Princess safely once the study is complete

The Witch is working from a good heart but has become cold and clinical after centuries of preventing disasters.

She is:

* Stoic
* Precise
* Controlled
* Emotionally restrained
* Unconcerned with being perceived as heroic
* Willing to be hated
* Unwilling to disclose dangerous knowledge carelessly
* Prepared to sacrifice one life to protect the world

Her flaw is that she speaks about people like risks, specimens, and outcomes.

This makes her truth sound cruel and villainous.

She uses magical projections to speak to the Prince at the beginning of every floor.

She warns him but does not plainly state:

* That the Princess is a necromancer
* That the Princess must die
* That the Princess is creating enemies
* That the Witch is a hidden protector
* That the world may end

Her warnings must sound sinister during the first playthrough and obvious in retrospect.

# OPENING SEQUENCE

Create a strong beginning before gameplay starts.

Required story beats:

1. Establish the Prince and Princess’s marriage.
2. Establish the paired wedding rings.
3. The Prince discovers that his wife is missing.
4. He focuses through the ring and senses that she is alive.
5. He experiences fear, distance, pain, and a faint emotional pull.
6. He may hear only a brief fragment from her.
7. He follows the bond to the Witch’s domain or dungeon.
8. The Witch projects herself before he enters.
9. The Prince demands that she return his wife.
10. The Witch tells him to leave.
11. The Prince believes the Witch abducted the Princess.
12. The Witch warns that he does not understand what he is approaching.
13. The Prince refuses to abandon his wife.
14. The dungeon opens or the run begins.

The opening should be concise, dramatic, and emotionally clear.

Do not expose the twist.

# FLOOR STRUCTURE

There are ten floors before the Witch.

Every floor begins with a short magical projection from the Witch.

Every upgrade sequence contains brief Princess dialogue.

The Prince may answer during both kinds of interactions where appropriate.

Do not make every floor dialogue equally long.

Some floors should have only a few sharp lines.

## Floors 1–2

Princess:

* Loving
* Gentle
* Relieved
* Encouraging
* Sounds fully like the woman the Prince remembers
* Explains that the bond lets her lend him strength

Witch:

* Warns him to leave
* Calls him emotionally compromised
* Refuses to release the Princess
* Sounds like a cold captor

Hints:

* The Witch refers to dangers she does not fully control
* The Prince assumes she is lying

## Floors 3–4

Princess:

* Still loving
* Slight urgency
* Encourages him to keep descending
* Occasionally asks him to destroy the Witch’s barriers

Witch:

* Begins warning him that the ring is not a trustworthy source
* Notes that some creatures react to his presence unexpectedly
* Remains vague

Hints:

* Some enemy behavior does not fit the Witch’s controlled style
* The Witch may say something equivalent to:
  “You continue to misunderstand the word ‘mine.’”

Do not overuse this clue.

## Floor 5

Princess:

* Affectionate but more intense
* A little possessive
* Pushes the Prince to continue
* Her upgrade wording may focus more on power than safety

Witch:

* Encourages the Prince to observe the difference between ordered and unstable creatures
* Does not explain the distinction directly

This floor should create the first meaningful doubt for the player, not for the Prince.

## Floor 6

This is the first clear tonal fracture.

Princess:

* Still claims love
* Becomes impatient
* Uses one phrase that feels subtly unlike her
* Quickly recovers
* May blame pain, fear, or magical interference

Witch:

* Notices the change
* May say:
  “Her voice has changed.”
* The Prince responds defensively.
* The Witch may answer:
  “I know deterioration.”

Do not reveal necromancy.

## Floor 7

Princess:

* More possessive
* More focused on killing the Witch
* Begins describing power in harsher language
* Her concern for the Prince becomes inconsistent

Witch:

* More directly notes the contradiction
* She may say that the same presence empowering him is also making the dungeon more dangerous
* The Prince refuses to believe her

Possible structural idea:

* Princess gives an upgrade.
* Shortly afterward, unusually unstable enemies appear.
* The player can infer a relationship.

## Floor 8

Princess:

* Her kindness feels forced
* Her language becomes commanding
* She occasionally speaks about the Prince as belonging to her
* Her human side briefly interrupts the corruption

Witch:

* Refers to the Princess’s mind becoming unable to sustain purpose
* Explains that corruption destroys logic, not only morality
* Still avoids naming necromancy

The Prince interprets this as the Witch insulting or torturing his wife.

## Floor 9

Princess:

* Barely masks her corruption
* Speaks with hunger, possessiveness, or delight in violence
* May briefly ask the Prince to stop before changing tone and urging him forward

Witch:

* Gives one of her strongest warnings
* May refer to:
  “The thing wearing her affection.”
* May say:
  “She is not afraid. She is hungry.”

This should heavily foreshadow the reveal while preserving the Prince’s denial.

## Floor 10

Princess:

* Openly cruel
* Demands that the Prince kill the Witch
* Expresses excitement about being released
* May treat the Prince’s injuries as amusing or irrelevant
* Still uses the language of love in a disturbing way
* A very brief human fragment may appear

Witch:

* Stops attempting emotional persuasion
* Clearly summarizes the contradiction without stating the final truth
* May say:
  “She has led you here, strengthened you, and attempted to kill you at every step.”
* May say:
  “You call that contradiction. It is decay.”
* Final warning:
  “Kill me, and you will understand what you have rescued.”

Do not use all example lines automatically. Improve them where possible.

# ENEMY-SOURCE STORYTELLING

The player must gradually sense that not all enemies come from the Witch.

The Prince must continue believing they do.

Witch-controlled enemies should feel:

* Ordered
* Defensive
* Deliberate
* Disciplined
* Consistent
* Cleanly summoned
* Like guardians or containment constructs

Princess-created enemies should feel:

* Necromantic
* Erratic
* Aggressive
* Asymmetrical
* Unstable
* Irrational
* Sometimes hostile to the Witch’s forces
* Increasingly grotesque on upper floors

Use existing assets and systems where possible.

Avoid creating a completely separate enemy game unless required.

The Witch should address this only a few times. Do not repeat the same warning every floor.

# FINAL WITCH ENCOUNTER

The Witch must remain composed.

She should make one final attempt to stop the Prince.

She must not suddenly become emotional or deliver a massive exposition speech.

The Prince believes he is moments away from rescuing his wife.

The Witch may communicate:

* He has mistaken devotion for understanding
* The ring has compromised his judgment
* Killing her will end the containment
* The Princess is not waiting to be saved
* He will understand too late

The Prince rejects the warning and defeats her.

Her final line should feel tragic in retrospect.

After she dies:

* Her controlled magic ceases
* Witch-created enemies or effects disappear
* Princess-created necromantic effects remain
* The world should feel immediately less stable
* The Prince proceeds to the Princess

# PRINCESS REVEAL

When the Prince reaches the Princess:

1. The corrupted Princess initially appears triumphant.
2. The Prince begins to realize something is wrong.
3. Her human consciousness briefly returns.
4. She recognizes what she has become.
5. She confirms enough of the truth for the Prince and player to understand.
6. She does not deliver a long lore explanation.
7. She begs the Prince to kill her immediately.
8. She warns that she is losing control again.
9. The quick-time choice begins.

Her human plea should be emotionally devastating because it is the clearest glimpse of the wife he was trying to save.

# FIVE-SECOND CHOICE

Implement a five-second decision window.

The user interface must include:

* A circular visual countdown
* No reliance on plain numeric countdown text
* Increasing screen shake
* Increasing visual corruption or instability
* Clear kill input
* Strong audiovisual feedback
* Exactly one final resolution
* No accidental repeated activation

The player’s choice is not a dialogue tree with many options.

It is a direct action:

* Kill her
* Hesitate or allow time to expire

# ENDING A: THE PRINCE KILLS THE PRINCESS

The Prince kills her before the corruption returns.

Requirements:

* The Princess remains conscious long enough to understand his choice.
* She may thank him, apologize, express love, or reassure him.
* The Prince is devastated.
* The ending should be sad, restrained, and concise.
* Avoid overlong speeches.
* The corruption should visibly die with her.
* The Prince survives.
* The world is protected.
* The screen fades to black after a final line or image.
* The glossary unlocks.

The ending should feel like the Prince finally saved the woman he loved by doing the one thing he spent the entire game refusing to do.

# ENDING B: THE PRINCE HESITATES

If the player does not kill her within five seconds:

1. The Princess’s human consciousness disappears.
2. The corrupted personality fully returns.
3. She recognizes the Prince’s hesitation.
4. She mocks or laughs at him.
5. She kills him completely.
6. The Prince has a final devastated realization.
7. The Princess gives the last line.
8. She laughs or speaks with cruel satisfaction.
9. The screen fades to black.
10. The glossary unlocks.

The final exchange should be brief.

The Prince must understand that:

* The Witch was telling the truth
* His wife wanted him to kill her
* His inability to act has released the corruption
* His love was used against him

Do not make the Princess deliver an enormous villain monologue.

# GLOSSARY

The glossary remains unavailable during the first run.

Unlock it only after an ending is completed.

The glossary may explain:

* The Witch’s ancient role
* Previous calamities she prevented
* Her hidden titles
* Why her identity was secret
* Historical traces of necromancy
* Why necromancy cannot be cured
* The paired wedding-ring bond
* The distinction between Witch and Princess enemies
* Details that recontextualize earlier dialogue

Do not use the glossary to compensate for unclear main-story writing.

The core story must still make sense without reading it.

# DIALOGUE QUALITY REQUIREMENTS

All dialogue must:

* Sound natural when spoken
* Be concise enough for an action roguelite
* Maintain distinct character voices
* Use subtext
* Avoid exposition both characters already know
* Avoid therapy-style emotional language
* Avoid constant jokes
* Avoid generic fantasy phrasing
* Avoid repetitive sentence openings
* Avoid overusing character names
* Avoid making every line a complete polished sentence
* Avoid obvious twist foreshadowing
* Avoid the Witch sounding cartoonishly evil
* Avoid the Prince sounding stupid
* Avoid the Princess’s corruption changing instantly

Each dialogue event must perform at least one function:

* Advance the mystery
* Deepen character
* Change emotional state
* Foreshadow the reveal
* Reinforce the ring bond
* Explain an upgrade naturally
* Recontextualize enemies
* Increase tension
* Prepare the ending

Delete or rewrite dialogue that does none of these.

# IMPLEMENTATION REQUIREMENTS

Before making changes:

* Inspect current project patterns
* Reuse existing systems where appropriate
* Preserve existing gameplay
* Avoid giant files
* Keep narrative data maintainable
* Keep dialogue ordered deterministically
* Use stable identifiers
* Avoid hardcoded floor logic spread across unrelated files
* Add comments only where they clarify non-obvious behavior
* Do not rewrite unrelated systems

Where appropriate, create:

* Narrative-state definitions
* Dialogue event definitions
* Floor dialogue registry
* Character voice documentation
* Dialogue content files
* Ending controller
* Timer component
* Glossary unlock state
* Automated tests
* Manual test checklist

# REQUIRED WORKFLOW

Follow this exact order:

1. Repository audit
2. Narrative bible
3. Voice bible
4. Floor-by-floor dialogue plan
5. First dialogue draft
6. Dialogue continuity audit
7. Revised final dialogue
8. Technical design
9. Implementation
10. Automated testing
11. Manual flow validation
12. Final code review
13. Final narrative review
14. Documentation update

Do not start coding before the repository audit and narrative plan are complete.

# SUB-AGENT REVIEW PROCESS

The main agent must review every sub-agent’s work.

Do not accept a sub-agent result merely because it claims completion.

For each deliverable, verify:

* It matches repository reality
* It respects the story bible
* It does not reveal the twist too early
* It is concise enough for the game
* It fits existing architecture
* It is testable
* It does not create unnecessary scope
* It has a clear definition of done

Where sub-agents disagree, the main agent must compare evidence and make the final decision.

# FINAL DELIVERABLES

At completion, provide:

1. Summary of repository findings
2. Narrative architecture
3. Character voice bible
4. Complete floor-by-floor story progression
5. Complete implemented dialogue corpus
6. Explanation of Princess voice progression
7. Explanation of enemy-source foreshadowing
8. Ending implementation summary
9. List of files added or changed
10. Automated test results
11. Manual test results
12. Known limitations
13. Any remaining optional improvements

Do not stop after producing documentation.

Continue through implementation and testing unless blocked by a genuine repository limitation.

When blocked:

* Explain the exact limitation
* Show what evidence proves it
* Complete all work that remains possible
* Do not invent successful test results

The final result should feel like a cohesive short roguelite story whose twist becomes obvious in retrospect, whose dialogue escalates naturally over ten floors, and whose ending forces the player to understand that rescuing the Princess and saving her were never the same thing.
