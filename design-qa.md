# Design QA

## Current scope

The obsolete archive/terms menu comparison is retired with the removed mid-run
text system. Current visual QA covers the title, pause menu, combat HUD, Oath
screen, bookend VN layout, final timer, and summaries.

No fresh visual-session claim is made by the gameplay-first conversion. Existing
deterministic UI contracts cover layout state, keyboard/controller focus, mobile
overflow, reduced effects, and bookend art transitions.

## Oath screen design QA

Status: pending a fresh visual capture after the Oath-only progression simplification.

The previous chamber-choice screen has been retired. Floors 1–5 now present
three Oaths using only identity, gain, and tradeoff; floors 6–9 use a compact
owned-Oath mastery list. Keyboard focus, mobile overflow, and the simplified
Current Build ledger must be rechecked before this section can be marked passed.

## Pause menu design QA

### Grounding

- Source visual truth: `/Users/sabar/Documents/learning/Rogue-game/docs/art-samples/pause-menu-redesign.png`
- Browser-rendered implementation: `/Users/sabar/Documents/learning/Rogue-game/docs/art-samples/pause-menu-implementation.png`
- Full-view comparison: `/Users/sabar/Documents/learning/Rogue-game/docs/art-samples/pause-menu-qa-comparison.png`
- Viewport: 1280 × 720 desktop
- State: paused gameplay with the menu open. The source shows Resume as the default emphasis; the final implementation capture retains that primary treatment while also showing the expected Abandon Run focus state after the tested confirmation-cancel flow.

### Full-view comparison evidence

- The implementation matches the selected stacked-center composition, compact square-cornered panel, double aged-gold frame, large ivory serif title, four full-width vertical options, and restrained wine-red danger treatment.
- The gameplay remains visible only as a dark, blurred backdrop. All pause options remain inside one box and no eyebrow, descriptive copy, shortcut legend, or status subtext is present.
- The implementation is slightly more restrained than the generated source at the corners: it uses the existing game's straight double-line frame rather than recreating the source's small decorative corner glyphs. This is a P3 simplification and does not change hierarchy or usability.
- No focused-region crop was needed because the 1280 × 720 capture and the 2560 × 720 side-by-side comparison keep the title, borders, labels, spacing, and focus treatments fully legible.

### Required fidelity surfaces

- Fonts and typography: the existing Bodoni/Didot-style display stack reproduces the source's high-contrast PAUSED heading; menu labels use the established uppercase sans stack with matching tracking and no wrapping or truncation.
- Spacing and layout rhythm: the panel is centered, all four rows have equal width and height, gaps are consistent, and the responsive rules retain 44 px-plus targets without rounded corners.
- Colors and visual tokens: the existing soot, ivory, aged-gold, and blood-red tokens map directly to the source palette with sufficient contrast.
- Image quality and asset fidelity: the real paused game render supplies the backdrop and the existing dungeon artwork supplies the panel texture; there are no placeholders, fake icons, SVG stand-ins, or generated assets left outside the workspace.
- Copy and content: visible labels match the selected source exactly: Paused, Resume, Suspend Run, Settings, and Abandon Run.

### Comparison history

1. The first browser capture exposed active damage numbers above the pause panel (P1). The combat overlay now hides and clears on the paused phase, and the final capture contains no combat-number bleed; cleared numbers do not reappear after Resume.
2. Raising the pause layer initially caused its later DOM position to intercept the Abandon confirmation (P1). The pause layer now sits above combat feedback and the Speedrun timer but below menu and Settings overlays. Abandon → Cancel and Settings → Done were re-tested successfully.

### Interaction and browser checks

- Resume returns to live gameplay.
- Settings opens above pause and Done returns to the pause menu.
- Abandon Run opens its confirmation above pause; Cancel preserves the active run and returns focus.
- Active combat numbers disappear immediately on pause and remain cleared after resume.
- Browser console: no warnings or errors.
- Automated verification: 422 tests passed, JavaScript syntax checks passed, and the production build passed. The suite includes both kill and timeout ending flows.

### Findings

- No actionable P0, P1, or P2 differences remain.

### Follow-up polish

- P3: add a dedicated raster corner-ornament asset only if the more decorative generated frame is preferred over the current simpler main-menu language.

final result: passed

## Tutorial carousel and handbook design QA

### Grounding

- First-run carousel reference: `/Users/sabar/.codex/generated_images/019f7f0e-f617-7771-9cc2-dfa87c8a3e38/exec-7c2a5909-15ab-4966-975d-2ed5adf8d223.png`
- Pause-handbook reference: `/Users/sabar/.codex/generated_images/019f7f0e-f617-7771-9cc2-dfa87c8a3e38/exec-4cbc7c16-1131-439e-b4f0-bab662031ec8.png`
- Carousel implementation: `/Users/sabar/Documents/learning/Rogue-game/docs/art-samples/tutorial-carousel-implementation.png`
- Handbook implementation: `/Users/sabar/Documents/learning/Rogue-game/docs/art-samples/tutorial-handbook-implementation.png`
- Carousel comparison: `/Users/sabar/Documents/learning/Rogue-game/docs/art-samples/tutorial-carousel-qa-comparison.png`
- Handbook comparison: `/Users/sabar/Documents/learning/Rogue-game/docs/art-samples/tutorial-handbook-qa-comparison.png`
- Responsive captures: `/Users/sabar/Documents/learning/Rogue-game/docs/art-samples/tutorial-carousel-mobile.png` and `/Users/sabar/Documents/learning/Rogue-game/docs/art-samples/tutorial-handbook-mobile.png`
- Viewports: 1280 × 720 first-run carousel, 1672 × 941 Pause handbook, and 390 × 844 responsive checks
- States: first-run step 1, Move & Aim; handbook step 4, Harvest

### Visual comparison

- The first-run flow matches the approved centered sequence: an aged-gold double frame, large ivory serif heading, step counter, one dominant gameplay visual, compact controls, progress marks, and restrained Back, Next, and Skip actions.
- The Pause handbook matches the approved wider reference: six-topic rail, active-topic treatment, focused lesson content, authentic game capture, compact facts, and a clear footer action.
- Both layouts use the current game itself as visual truth. The tutorial images show the shipped low-poly dungeon, Zephyr, scythe effects, Dash state, and current HUD instead of generated approximations.
- Copy was deliberately reduced after review. Each card now has one short instruction, the necessary control labels or meter gains, and at most one punchy tip. The Harvest card keeps only the five actual gain values beside the live meter.
- Typography, square corners, soot texture, parchment ivory, aged brass, double-line borders, and focus treatments are inherited from the existing Pause menu.
- The carousel reference was normalized to the implementation's 1280 × 720 viewport before comparison. The handbook comparison uses the exact 1672 × 941 reference viewport and matching Harvest state.
- No actionable P0, P1, or P2 visual mismatch remains. The use of real gameplay captures in place of the generated reference's illustrative control drawings is intentional product fidelity.

### Interaction and browser checks

- A fresh Standard descent shows the retained opening first, then pauses and opens the six-step tutorial before player control.
- Back, Next, direct handbook topic selection, Skip, Begin Descent, Close, Escape, and gamepad-back behavior were exercised.
- Completing or skipping the first-run sequence persists completion and resumes play. It does not reappear on subsequent runs.
- Pause → Tutorial opens the handbook; Close returns to Pause and restores focus to Tutorial.
- Speedrun, autoplay, showcase, and benchmark modes skip the first-run interruption while retaining Pause-menu access.
- The underlying Pause layer is inert and hidden from the accessibility tree while the tutorial is open.
- At 390 × 844, both layouts fit without panel or document overflow. The handbook topic rail scrolls horizontally while lesson content and footer actions remain visible.
- Browser console: no warnings or errors.

### Verification

- Tutorial, menu, input, settings, bookend, and ending-flow tests: 60 passed.
- JavaScript checks: passed.
- Production build: passed. Vite reports only the existing large-chunk advisory.
- Full automated suite: 478 of 484 passed. The six remaining failures are pre-existing, unrelated combat/balance expectation mismatches in `claimIntegration`, `playerCombat`, and `refinementBalanceModel`; all tutorial and retained-bookend coverage passed.

### Findings

- No actionable P0, P1, or P2 differences remain for the approved desktop and responsive tutorial scope.

final result: passed

## Confirmation menu design QA

### Grounding

- Approved Abandon Run source: `/Users/sabar/.codex/generated_images/019f7f48-0158-7a51-b81c-e01aec34fded/exec-85c54b7e-24cc-4b68-a200-3a97a783c39a.png`
- Approved Reset Records source: `/Users/sabar/.codex/generated_images/019f7f48-0158-7a51-b81c-e01aec34fded/exec-1f01f3dc-a9e0-4b03-b462-e328d4af43b8.png`
- Browser-rendered Abandon Run state: `/tmp/the-saviour-confirm-abandon-refined.png`
- Browser-rendered Reset Records state: `/tmp/the-saviour-confirm-reset-refined.png`
- Full-view comparisons: `/tmp/confirmation-abandon-qa-full-final.png` and `/tmp/confirmation-reset-qa-full-final.png`
- Focused comparisons: `/tmp/confirmation-abandon-qa-focus-final.png` and `/tmp/confirmation-reset-qa-focus-final.png`
- Viewport: 1672 × 941 desktop

### Full-view comparison evidence

- Both confirmations use the pause menu's soot-black texture, square double aged-gold frame, centered ivory display heading, gold divider, restrained parchment copy, and full-width stacked controls.
- Abandon Run overlays the live gameplay view. Reset Records preserves the live Records menu beneath the modal. The underlying surface is blurred, dimmed, removed from the accessibility tree, and made inert while the confirmation is open.
- Cancel is the first and initially focused control. The destructive action remains visually distinct through a dark wine surface and oxblood border without competing with the safe action.
- No placeholder imagery, custom SVG, CSS-drawn ornament, new asset, or dependency was introduced. The implementation retains the game's real backgrounds and existing panel texture.

### Required fidelity surfaces

- Typography: large uppercase high-contrast serif headings, readable centered body copy, and tracked uppercase control labels match the approved hierarchy.
- Spacing: the final panel, divider, copy, and two 76 px controls align closely with the generated composition at the approved desktop viewport.
- Color: parchment ivory, tarnished gold, soot black, and restrained oxblood reuse the pause menu's established palette.
- Copy: the Abandon Run warning explicitly states that the suspended threshold will be cleared and the attempt recorded as abandoned. Reset Records states that all stored records will be erased and cannot be undone.

### Comparison history

1. The first browser comparison found smaller body and control typography, a panel roughly 26 px shorter than the source, and a backdrop that obscured too much of the underlying scene (P2). Body/control sizes, panel padding, vertical gaps, and overlay opacity were adjusted before the final comparison.
2. Nested Records cancellation initially returned focus to the generic Close control instead of the Reset Records trigger (P2 accessibility). The confirmation now remembers the exact trigger and restores focus to it after Cancel or Escape.
3. Post-fix comparisons found no remaining actionable P0, P1, or P2 mismatch. The live gameplay and Records backdrops intentionally replace the generated approximations with the product's actual surfaces.

### Interaction and browser checks

- Cancel is initially focused and precedes the destructive control in DOM and keyboard order.
- Cancel and Escape close the confirmation without executing the destructive action.
- Cancel returns to Pause with focus restored to Abandon Run; nested confirmation cancellation returns to Records with focus restored to Reset Records.
- The underlying overlay is inert and `aria-hidden` only while the confirmation is open; those attributes are removed on return.
- The modal exposes `role="alertdialog"`, `aria-modal="true"`, and labelled title/copy relationships.
- Browser console: no warnings or errors.
- Destructive controls were deliberately not activated during browser QA.
- Targeted confirmation-menu tests: 12 passed.
- Full automated suite: 475 passed, including both kill and timeout ending flows.
- JavaScript syntax checks and the production build passed. Vite reports only the existing advisory about large chunks.

### Findings

- P3: the live panel keeps the pause menu's more literal double inset and real texture, which is intentionally more product-specific than the generated approximation.
- No actionable P0, P1, or P2 differences remain for the approved PC scope.

final result: passed

## Scythe Reliquary HUD design QA

### Grounding

- Source visual truth: `/Users/sabar/.codex/generated_images/019f7f48-0158-7a51-b81c-e01aec34fded/exec-135ee0e0-4829-487b-bfbd-7cc190b18a7b.png`
- Active implementation capture: `/tmp/the-saviour-hud-final-active.png`
- Settled implementation capture: `/tmp/the-saviour-hud-final-idle.png`
- Full-view comparison: `/tmp/the-saviour-hud-qa-active-full.png`
- Focused top-left comparison: `/tmp/the-saviour-hud-qa-active-focus.png`
- Viewport: 1672 × 941 desktop
- State: deterministic Witch showcase, with a real dash input used to exercise the attention state

### Visual comparison

- The implemented hierarchy matches the selected Scythe Reliquary direction: cropped brass scythe arc, narrow left spine, floor/chamber line, Life, Dash, three Harvest reliquaries, readiness text, and objective footer.
- The complete status stack is anchored to the bottom-left. At the 1280 × 720 desktop gameplay viewport its bounds do not intersect either the top-centered Witch health bar or the bottom-right control hint.
- The real shipped scythe-dial artwork supplies the ornamental arc. No placeholder, CSS-drawn illustration, custom SVG, new asset, or dependency was introduced.
- The arc no longer presents as an opaque rectangular image cap: its dark pixels screen-blend into the live scene, its lower edge dissolves through an opacity mask, and the floor/chamber label remains independently legible above it.
- Life and Dash use square, double-line gothic tracks with solid wine-red and aged-brass fills. They remain rectangular at full, partial, and empty values and preserve the live progressbar semantics.
- The soot-black surface now dissolves into gameplay along its right edge, with a second fade across the objective footer. The brass left spine stays crisp so the panel retains a deliberate anchor.
- The reference's isolated finials are a P3 asset difference. The implementation keeps the existing product's simpler brass-spine language rather than approximating them with code-drawn ornaments.

### Opacity and interaction behavior

- The bottom-left HUD is fully opaque whenever health, Dash, Harvest, Claim, room, or floor information changes.
- A real Shift dash changed the live Dash state to `Dashing`, filled the partial track, applied the `is-awake` state, and raised computed opacity to `1`.
- After Dash returned to `Ready` and 1.8 seconds passed without another relevant change, the HUD removed `is-awake` and eased to computed opacity `0.72`.
- High-contrast mode holds the HUD at full opacity. Reduced-motion mode inherits the project's global near-instant transition policy.
- The Witch boss bar remains fully opaque and independent from the top-left fade.
- Browser console: no warnings or errors.

### Viewport scaling

- The complete bottom-left HUD scales uniformly from a bottom-left transform origin, so typography, meters, spacing, and ornament retain their proportions.
- The scale is selected from both viewport width and height, with the smaller axis winning and a readability floor for low-resolution PC layouts.
- Browser measurements: 408 × 324 at 1920 × 1080, approximately 335 × 266 at 1280 × 720, and approximately 294 × 194 at 1024 × 576.
- The Witch bar shares the same viewport scale: 576 × 64 at 1920 × 1080, approximately 472 × 52 at 1280 × 720, and approximately 253 × 46 in the short-screen top-right fallback at 1024 × 576.
- At all three measured viewports, the status stack intersects neither the Witch health bar nor the bottom-right control hint.

### Verification

- Targeted HUD tests: 6 passed.
- Full automated suite: 475 passed, including both kill and timeout ending flows.
- JavaScript syntax checks: passed.
- Production build: passed. Vite reports only the existing advisory about large chunks.

### Findings

- No actionable P0, P1, or P2 differences remain for the approved desktop scope.

final result: passed

## Difficulty menu design QA

### Grounding

- Source visual truth: `/Users/sabar/Documents/learning/Rogue-game/docs/art-samples/difficulty-menu-redesign-1280x720.png`
- Original generated reference: `/Users/sabar/Documents/learning/Rogue-game/docs/art-samples/difficulty-menu-redesign.png`
- Browser-rendered implementation: `/Users/sabar/Documents/learning/Rogue-game/docs/art-samples/difficulty-menu-implementation.png`
- Full-view comparison: `/Users/sabar/Documents/learning/Rogue-game/docs/art-samples/difficulty-menu-qa-comparison.png`
- Mobile capture: `/Users/sabar/Documents/learning/Rogue-game/docs/art-samples/difficulty-menu-mobile.png`
- Viewport: 1280 × 720 desktop, with a 390 × 844 responsive check
- State: title-screen Difficulty dialog with Standard remembered, selected, and keyboard-focused

### Full-view comparison evidence

- The implementation matches the selected centered composition, compact square-cornered panel, double aged-gold frame, large ivory serif heading, three stacked choices, inset selected-state border, restrained Ruthless accent, and full-width Back control.
- All three descriptions are one plain sentence. The former eyebrow, introductory paragraph, and all uppercase timing/pressure tags are absent.
- The live title scene remains the backdrop, intentionally preserving the product's actual character and dungeon assets rather than substituting the generated reference's approximation.
- No focused-region crop was needed: the normalized 1280 × 720 source and implementation remain fully legible in the 2576 × 720 side-by-side comparison, including fonts, borders, labels, and selection treatment.

### Required fidelity surfaces

- Fonts and typography: the established Bodoni/Didot-style display stack matches the high-contrast serif reference; short sans-serif summaries remain readable and untruncated at desktop and mobile sizes.
- Spacing and layout rhythm: the panel and rows align with the normalized reference, option gaps are consistent, the Back control stays inside the frame, and the 390 × 844 layout has no overflow or internal scrolling.
- Colors and visual tokens: soot black, parchment ivory, tarnished gold, warm umber, and restrained oxblood reuse the game's existing tokens and preserve strong selected/focus contrast.
- Image quality and asset fidelity: the live product uses the existing title artwork and panel texture; no placeholder imagery, fake icons, custom SVG stand-ins, or CSS-drawn illustration substitutes were introduced.
- Copy and content: visible copy is exactly Difficulty, Relaxed — More recovery. Fewer threats., Standard — The intended experience., Ruthless — Faster threats. Less mercy., and Back.

### Comparison history

1. The first comparison found the option rows and Back control taller than the normalized source (P2), making the panel about 41 px too tall. Their minimum heights were reduced, and the post-fix panel is within roughly 9 px of the reference height while keeping practical targets and the intended breathing room.
2. The post-fix comparison found no remaining actionable P0, P1, or P2 mismatch. The implementation's use of the exact live title art instead of the generated backdrop approximation is expected product fidelity, not design drift.

### Interaction and browser checks

- Back closes the dialog and restores the title screen.
- The remembered difficulty controls the initial highlight; changing it through Settings to Standard updates the next-open state.
- Selecting Standard closes the dialog and advances into the retained Zephyr opening bookend.
- Keyboard focus is visible and coincides with the selected treatment.
- At 390 × 844, the panel fits without horizontal overflow, clipped text, clipped controls, or scrolling; all choices and Back remain visible.
- Browser console: no errors.
- Automated verification: 425 tests passed, JavaScript syntax checks passed, and the production build passed. The suite includes both kill and timeout ending flows.

### Findings

- No actionable P0, P1, or P2 differences remain.

### Follow-up polish

- P3: the generated reference has marginally softer photographic blur in the backdrop; the live version keeps the product's existing title-scene blur for consistency.

final result: passed
