# Final Acceptance Record

Date: 2026-07-20
Target: gameplay-first conversion with VN presentation only at the standard
opening and endings.

## Product evidence

- Standard runs use the retained three-line VN opening.
- All floor, chamber, portal, Oath, and Witch-combat progression is
  free of mid-run text scenes.
- Chamber thresholds resolve their automatic recovery immediately, and
  floor-end Oath selections are immediately available.
- Stable and volatile enemy variants retain their encounter mechanics without
  plot-facing labels.
- The final plea leads to one strict five-second action window.
- Strike and timeout each resolve once, use their correct short VN ending in a
  standard run, and reach the run summary.
- Speedrun bypasses all VN sequences, freezes its competitive clock at Witch
  defeat, and retains the timed final action.

## Automated verification

- `npm run check`: passed.
- `npm test`: 482 tests passed; 0 failed.
- `npm run build`: passed with 68 modules transformed.
- `git diff --check`: passed.
- Release output contains exactly the 15 retained VN/title images.
- `tests/bookendFlow.test.js` exercised a standard opening, uninterrupted
  mid-run progression, the strike branch, the timeout branch, and Speedrun's VN
  bypass through the real `Game` phase machine.

## Validation boundary

Deterministic gameplay tests validate the standard opening and both complete
ending branches. Compilation alone is not treated as gameplay or visual proof.
No fresh subjective visual, controller-hardware, touch-device, or monitor-output
audio session is claimed by this conversion pass.
