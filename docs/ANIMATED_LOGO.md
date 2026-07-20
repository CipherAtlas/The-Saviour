# Animated logo

The title and loading screens use `src/ui/AnimatedLogo.js`, a reusable DOM/CSS component built around the approved `public/assets/branding/the-saviour-icon.png` artwork.

## How it works

The original 1254×1254 PNG remains the visible base and canonical source. The component does not redraw, split, rotate, or deform the mark. Duplicate CSS layers use the same image as a luminance mask, which clips the metallic sweep, clockwise trace, vertical highlight, glow, and completion sweep to the gold artwork. Glints are clipped by the same mask. A small, fixed pool of DOM particles is created only when settings change; there is no per-frame JavaScript work.

No GIF, video, render target, WebGL post-processing pass, or additional material is required. The existing Three.js renderer continues to render the game world independently beneath the DOM UI.

## Modes

Create a component with one of the exported modes:

```js
const logo = new AnimatedLogo(host, {
  imageUrl: publicAssetUrl("assets/branding/the-saviour-icon.png"),
  mode: AnimatedLogo.MODES.MAIN_MENU,
});

logo.setMode(AnimatedLogo.MODES.LOADING);
```

`MAIN_MENU` uses a slower shimmer, quieter trace, softer glow, six particles at full effects density, a 1% scale pulse, and one glint approximately every 8.4 seconds. `LOADING` uses a faster trace and vertical highlight, nine particles at full density, and a maximum 1.2% scale pulse.

## Configuration

The constructor, `configure()`, and `setMode()` accept:

- `loopDuration`
- `shimmerSpeed`
- `shimmerWidth`
- `glowIntensity`
- `glowPulseSpeed`
- `particleAmount`
- `scalePulseStrength`
- `glintInterval`
- `completionDuration`
- `reducedMotion`
- `particlesEnabled`
- `bloomEnabled`

Values are clamped to restrained performance and motion limits. `setReducedMotion()`, `setParticlesEnabled()`, `setParticleAmount()`, and `setBloomEnabled()` are also available. Disabling glow or particles leaves the original logo and masked base animation intact.

The game maps Camera → Reduced motion, Accessibility → Reduced particles, and Graphics → Effects density onto both instances in `GameUi.applySettings()`.

## Loading progress and completion

Use `setProgress(ratio)` with a normalized `0–1` value for a determinate clockwise trace, or `setProgress(null)` for a seamless indeterminate trace. Initial critical-model loading uses the real `AssetCatalog` ratio. Per-room streaming does not expose a reliable normalized ratio, so it intentionally uses indeterminate motion.

`playCompletion()` runs one brighter masked sweep and returns a promise. Repeated calls during the same loading cycle share that promise, so the sweep resolves once. `resetCompletion()` begins a new loading cycle. On completion the component dispatches `animated-logo-complete` and invokes the optional `onComplete(detail)` callback. `GameUi` awaits the promise before revealing the title or the next room UI.

## Files

- `src/ui/AnimatedLogo.js` — component, presets, progress, completion event, and fixed particle data.
- `src/ui/GameUi.js` — title/loading integration and accessibility settings.
- `src/main.js` — renderer progress wiring and awaited initial completion sweep.
- `src/styles.css` — masked visual passes and animations.
- `tests/animatedLogo.test.js` — preset, constraint, masking, and integration contracts.
- `docs/art-samples/animated-logo-main-menu.png` — 1280×720 rendered menu capture.
- `docs/art-samples/animated-logo-loading.png` — 1280×720 icon-only loading capture.
- `docs/art-samples/animated-logo-completion.png` — 1280×720 completion-sweep capture.
