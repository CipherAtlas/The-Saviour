# Design QA

## Comparison targets

- Source visual truth:
  - `docs/art-samples/main-menu-redesign-v2.png`
  - `docs/art-samples/glossary-menu-redesign-v2.png`
  - `docs/art-samples/records-menu-redesign-v2.png`
  - `docs/art-samples/credits-menu-redesign-v2.png`
  - `docs/art-samples/settings-menu-redesign-v2.png`
- Browser-rendered implementation:
  - `/var/folders/kx/_0rmrf3144x8vw1kylhvtw2w0000gn/T/rogue-main-live-final.png`
  - `/var/folders/kx/_0rmrf3144x8vw1kylhvtw2w0000gn/T/rogue-glossary-live-final.png`
  - `/var/folders/kx/_0rmrf3144x8vw1kylhvtw2w0000gn/T/rogue-records-live-final2.png`
  - `/var/folders/kx/_0rmrf3144x8vw1kylhvtw2w0000gn/T/rogue-credits-live-final.png`
  - `/var/folders/kx/_0rmrf3144x8vw1kylhvtw2w0000gn/T/rogue-settings-live-final.png`
- Desktop viewport: `1672 × 941`.
- Responsive viewport: `390 × 844`.
- States: title ready with no suspended run; glossary unlocked preview with The Witch selected; empty records; credits; graphics settings; mobile title and settings.

## Full-view comparison evidence

Each source reference and its same-state browser capture was opened together in one comparison input. The final captures preserve the reference system's large high-contrast serif headings, restrained uppercase utility type, dark threshold imagery, warm ivory/gold palette, square archival panels, vertical indexes, thin rules, and low-radius controls. Runtime copy and statistics remain canonical instead of copying illustrative mock values.

Focused region comparisons were used for the title lockup, primary menu stack, settings category/control grid, and glossary index/detail split. Other regions did not require separate crops because the complete desktop frame kept their typography and dividers readable at original resolution.

## Comparison history

- [P2] Main title wrapped into four display lines and the background lost too much threshold detail.
  - Earlier evidence: `/var/folders/kx/_0rmrf3144x8vw1kylhvtw2w0000gn/T/rogue-main-live.png`.
  - Fix: widened the title composition, reduced the display scale, held `Hollow Crown` on one line at desktop width, removed the opaque content slab, and retuned the real background/cutout treatment.
  - Post-fix evidence: `/var/folders/kx/_0rmrf3144x8vw1kylhvtw2w0000gn/T/rogue-main-live-final.png` compared with `docs/art-samples/main-menu-redesign-v2.png`.
- [P2] Secondary panels either hid the requested art or allowed the underlying title text to ghost through.
  - Earlier evidence: `/var/folders/kx/_0rmrf3144x8vw1kylhvtw2w0000gn/T/rogue-records-live.png` and `/var/folders/kx/_0rmrf3144x8vw1kylhvtw2w0000gn/T/rogue-records-live-final.png`.
  - Fix: placed the approved `dungeon-threshold.png` asset directly on each archive panel with a dark multiply treatment.
  - Post-fix evidence: the final glossary, records, credits, and settings captures listed above.
- [P2] Arrow navigation on settings tabs could advance twice because both the tab widget and game-level input handler received the same event.
  - Fix: stopped propagation for handled tab and glossary arrow/Home/End keys while preserving gamepad menu navigation.
  - Post-fix evidence: one `ArrowDown` moved focus and selection exactly from `settings-tab-graphics` to `settings-tab-camera`; the glossary moved exactly from The Witch to Princess Elowen and updated its detail panel.
- [P2] Mobile settings controls could retain desktop intrinsic width and clip inside the scrollable content region.
  - Earlier evidence: `/var/folders/kx/_0rmrf3144x8vw1kylhvtw2w0000gn/T/rogue-settings-mobile-full.png`.
  - Fix: removed intrinsic minimum widths, constrained ranges/selects, reduced the mobile heading scale, and kept category tabs horizontally scrollable.
  - Post-fix evidence: `/var/folders/kx/_0rmrf3144x8vw1kylhvtw2w0000gn/T/rogue-settings-mobile-fit.png`; panel `369/369` client/scroll width and content `319/319` client/scroll width.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: existing Bodoni/Didot/Palatino and Avenir/Century Gothic stacks reproduce the display-versus-utility hierarchy without adding a dependency. Desktop wrapping and mobile scale were checked.
- Spacing and layout rhythm: title, metrics strip, three records chapters, numbered credits chapters, glossary split, and settings split follow the reference proportions with square surfaces and thin rules.
- Colors and tokens: existing gold, ivory, muted parchment, blood-danger, and void tokens map cleanly to the generated direction with readable contrast.
- Image quality and asset fidelity: the shipped threshold background and Zephyr cutout remain the only hero imagery. No placeholder illustration, custom SVG, CSS drawing, emoji, or text-glyph icon was introduced.
- Copy and content: the title, glossary, credits, records, and settings use canonical game text and real runtime values.
- Accessibility and behavior: dialog semantics, focus containment/restoration, Escape/back behavior, visible focus, roving tabs, keyboard/controller navigation, disabled glossary state, and mobile tap sizing were checked.
- Browser console: no errors or warnings in the final title state.

## Follow-up polish

- [P3] The generated references use more elaborate engraved corner and diamond ornaments than the implementation. The live build intentionally uses the project's existing thin-line system because no approved production ornament/icon assets exist and code-drawn substitutes would reduce asset fidelity.

## Primary interactions tested

- Open/close Records, Credits, Settings, and an unlocked Glossary preview.
- Change Settings category with arrow keys and verify selected/focused tab state.
- Change Glossary entry with arrow keys and verify selected/focused tab and detail content.
- Check desktop and mobile layout overflow.
- Start a Story descent, skip the opening sequences, and visually inspect the playable floor with actors rendered above the floor surface.

final result: passed
