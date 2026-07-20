# The Saviour — Gameplay-First Production Pass

Status: implemented; final verification recorded in `docs/FINAL_ACCEPTANCE.md`.

## Approved change

The previous mid-run text layer was retired on 2026-07-20. The existing VN
presentation was reduced to a compact standard-run opening and the two endings.
Combat mechanics, procedural progression, rewards, the Witch fight, accessibility,
records, and speedrun behavior remain the center of production.

## Runtime work

- Removed floor and reward scene scheduling, reader tools, terms/archive state,
  and presentation progress persistence.
- Made rewards and blessings available immediately after combat.
- Preserved encounter variety as stable and volatile mechanical profiles.
- Added a small data-driven bookend sequence and image manifest.
- Preserved the strict five-second final action and both outcomes.
- Kept Speedrun free of VN sequences while retaining the final action.
- Added legacy migrations that discard retired fields and map old labels to the
  current gameplay schema.

## Asset work

- Kept only title, opening, ending, and world-actor VN images used at runtime.
- Removed obsolete floor, biome, Witch-portrait, and unused character-state VN
  production files.
- Retained licensed music, game models, effects, branding, and gameplay UI art.

## Verification gates

- Static checks and full automated tests.
- Optimized production build.
- Gameplay-harness coverage for standard opening, uninterrupted mid-run flow,
  strike ending, timeout ending, and Speedrun bypass.
- Diff review for retired imports, files, terms, and accidental unrelated edits.
