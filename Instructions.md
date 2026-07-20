# The Saviour — Product Instructions

## Product identity

The Saviour is a gameplay-first browser action roguelite. Its center is a fast,
build-driven ten-floor scythe run. Player control should be interrupted only by
menus, floor-end Oath choices, the opening VN sequence, the boss-room confrontation, and the
closing VN sequences.

## Required run flow

1. Show a short, three-line full-screen VN opening for a standard descent.
2. After the opening, show the Field Guide over the first playable chamber on
   every standard descent until the player chooses **Don't show again**. Keep
   the guide available from the pause menu after automatic display is disabled.
3. Recover health automatically when a chamber clears and let its portal continue
   directly. After floors 1–5, choose one Oath for a previously untouched core
   technique. After floors 6–9, master one owned Oath to Rank II from a compact list.
4. Preserve stable and volatile enemy variants as mechanical encounter
   profiles. They do not carry plot labels or trigger text scenes.
5. When Zephyr enters the boss room, show the confrontation before combat begins.
6. After the Witch is defeated, show her final explanation followed by Elowen's
   lucid plea.
7. Present a strict five-second action window. Strike resolves the kill ending;
   allowing the timer to expire resolves the timeout ending.
8. Show only the selected ending sequence, then the run summary.

Speedrun uses the same ten-floor route and the same timed final action. It skips
the opening and closing VN sequences, and its competitive clock stops when the
Witch dies.

## Bookend canon

- The playable character is Zephyr.
- Princess Elowen is missing, and their magically paired wedding rings lead
  Zephyr below.
- Elowen practiced necromancy in an attempt to preserve a dying mind. The magic
  corrupted her judgment and control.
- The Witch is an ancient protector who confined Elowen to study and eradicate
  the corruption. Her ordered forces and Elowen's unstable necromantic forces
  both oppose Zephyr.
- Killing Elowen by ordinary means would release the corruption. A fatal strike
  made by Zephyr through their open bond of chosen love holds the necromancy to
  Elowen and severs them together. The Witch cannot perform that bond-bound act.
- Zephyr descends to reach Elowen and defeats the Witch.
- Elowen asks Zephyr to strike before she loses herself.
- Striking and hesitating remain distinct, complete endings.

The exact approved text and image states live in `src/game/bookendContent.js` and
`src/game/bookendAssetManifest.js`. Record any future change to these facts or
lines in this file and in the related tests.

## Product boundaries

- Do not add floor-start scenes, companion commentary, upgrade conversations,
  lore unlocks, reader tools, or text archives.
- Keep the VN interface available only during the standard opening, the single
  boss-room confrontation, and the endings.
- Do not gate mechanics, Oaths, settings, or records on bookend completion.
- Keep presentation state out of suspended-run data unless resuming that state
  is an explicit product requirement.
- Preserve accessibility, rebinding, pause behavior, and deterministic run
  generation.

## Engineering and acceptance

- Preserve established architecture and data-drive the small retained bookends.
- Maintain migrations for older local data without keeping obsolete runtime
  systems alive.
- Run relevant automated tests after implementation.
- Validate the standard opening, boss-room confrontation, Witch-death reveal,
  kill ending, and timeout ending through the gameplay harness or a real play
  session.
- Never claim visual or gameplay validation based only on compilation.
