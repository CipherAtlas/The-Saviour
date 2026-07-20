# The Saviour — Gameplay-First Direction

Status: authoritative product direction as of 2026-07-20.

## Goal

Build a pure gameplay-focused action roguelite with a compact VN frame around
the run. Combat, movement, builds, procedural rooms, the Witch fight, records,
and replay speed are the product. The VN presentation establishes the descent,
frames the Witch confrontation, and resolves its final action.

## Run contract

- Ten floors, three generated combat chambers per floor.
- Automatic health recovery at each cleared chamber threshold; portals continue
  directly without a choice screen.
- One Technique Oath choice after floors 1–5, covering each of the five core
  techniques once; floors 6–9 offer a compact mastery choice among owned Oaths.
- Five owned Oaths maximum, two ranks per Oath, with no Rune layer or rerolls.
- Deterministic generation from the displayed seed.
- Fast scythe combat built around light combos, Grave Line, Reap, Claim, dash,
  Harvest management, telegraphs, and coordinated enemy pressure.
- Stable and volatile enemy variants retain their mechanical differences without
  plot-facing labels.
- The tenth floor ends with the Witch, a five-second strike-or-hesitate action,
  one of two outcomes, and a run summary.

## VN boundary

Standard descents use the existing full-screen illustrated interface for:

- a three-line opening;
- one confrontation when Zephyr enters the boss room;
- the Witch's dying explanation and Elowen's lucid plea;
- the selected expanded kill or timeout resolution.

No VN layer appears during floors, portals, Oath choices, deaths,
or ordinary transitions. The retained interface has one Continue action;
reader history, auto-advance, fast-forward, skip confirmation, hiding, terms,
and archive controls are outside the product.

Speedrun bypasses all VN sequences. The final five-second action remains, and
the competitive clock freezes at Witch defeat.

## Gameplay priorities

1. Responsive input and readable attack commitment.
2. Clear enemy telegraphs, pressure roles, and arena navigation.
3. Distinct Oath tradeoffs with concise, low-friction selection.
4. Stable fixed-step simulation and deterministic generation.
5. Legible HUD resources, damage response, portals, and end-state feedback.
6. Accessible controls, scalable UI, reduced-effects options, and touch support.
7. Fast restart, suspend-at-safe-boundary behavior, and separate speed records.

## Presentation priorities

- Keep the illustrated-gothic identity across title, HUD, Oath choices, gameplay, and
  bookends.
- Reserve character portraits and painted VN backgrounds for the title,
  opening, boss confrontation, and endings.
- Use gameplay effects, animation, lighting, and sound to carry the middle of
  the run without explanatory text scenes.
- Keep all licensed music instrumental and retain attribution.

## Persistence

- Settings, statistics, speed records, and suspended runs remain versioned and
  validated independently.
- New schemas must accept safe legacy data and discard obsolete presentation
  fields.
- Ending completion may be recorded for statistics, but it must not unlock a
  separate content system.

## Acceptance criteria

- A standard run opens with the retained three-line VN sequence and reaches play.
- A standard run pauses once on entering the boss room, completes the
  confrontation, and begins combat only afterward.
- No mid-run text scene can interrupt any of the 30 chambers or their thresholds.
- The Witch's final explanation establishes the two enemy sources, Elowen's
  necromancy, and why only Zephyr's paired-ring bond can destroy the corruption.
- Both final action branches resolve once and reach the correct summary.
- Speedrun skips bookend VN while preserving the timed final action.
- Old saved settings, statistics, and suspended runs migrate safely.
- Relevant tests, static checks, and the optimized build pass.
- Visual or gameplay claims come from the running game or the gameplay harness,
  never compilation alone.
