import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { animatedLogoConfig, AnimatedLogo } from "../src/ui/AnimatedLogo.js";

const source = readFileSync(new URL("../src/ui/AnimatedLogo.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const uiSource = readFileSync(new URL("../src/ui/GameUi.js", import.meta.url), "utf8");

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
}

class FakeNode {
  constructor(ownerDocument) {
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.dataset = {};
    this.style = { values: new Map(), setProperty: (key, value) => this.style.values.set(key, value) };
    this.classList = new FakeClassList();
    this.listeners = new Map();
    this.events = [];
  }

  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = [...children]; }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type, listener) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }
  dispatchEvent(event) { this.events.push(event); return true; }
  remove() { this.removed = true; }
}

function fakeHost() {
  const document = {
    defaultView: { CustomEvent: class CustomEvent { constructor(type, options) { this.type = type; this.detail = options.detail; } } },
    createElement() { return new FakeNode(document); },
  };
  return new FakeNode(document);
}

test("animated logo exposes restrained menu and loading presets", () => {
  const menu = animatedLogoConfig(AnimatedLogo.MODES.MAIN_MENU);
  const loading = animatedLogoConfig(AnimatedLogo.MODES.LOADING);

  assert.equal(menu.loopDuration, 7.2);
  assert.equal(loading.loopDuration, 6.4);
  assert.ok(menu.scalePulseStrength <= 0.015);
  assert.ok(loading.scalePulseStrength <= 0.015);
  assert.ok(loading.shimmerSpeed < menu.shimmerSpeed);
  assert.ok(loading.particleAmount > menu.particleAmount);
  assert.ok(menu.glintInterval >= 6 && menu.glintInterval <= 10);
});

test("animated logo configuration clamps costly or distracting effects", () => {
  const config = animatedLogoConfig(AnimatedLogo.MODES.LOADING, {
    particleAmount: 1_000,
    scalePulseStrength: 0.5,
    glowIntensity: 4,
    glintInterval: 0.2,
  });

  assert.equal(config.particleAmount, 12);
  assert.equal(config.scalePulseStrength, 0.015);
  assert.equal(config.glowIntensity, 0.55);
  assert.equal(config.glintInterval, 6);
});

test("effects remain image-masked, CSS-driven, and reduced-motion aware", () => {
  assert.match(styles, /-webkit-mask: var\(--animated-logo-mask\) center \/ contain no-repeat/);
  assert.match(styles, /mask-mode: luminance/);
  assert.match(styles, /animated-logo-clockwise-trace/);
  assert.match(styles, /animated-logo-complete-sweep/);
  assert.match(styles, /data-reduced-motion="true"/);
  assert.doesNotMatch(source, /requestAnimationFrame|setInterval/);
});

test("loading progress and completion are reusable integration contracts", () => {
  assert.match(source, /setProgress\(progress = null\)/);
  assert.match(source, /this\.element\.dataset\.progress = "determinate"/);
  assert.match(source, /new EventConstructor\("animated-logo-complete"/);
  assert.match(source, /if \(this\.completionPromise\) return this\.completionPromise/);
  assert.match(uiSource, /this\.loadingLogo\.setProgress\(normalized\)/);
  assert.match(uiSource, /this\.visiblePhase === "roomLoading"[\s\S]*finishLoadingTransition/);
});

test("reduced-motion completion resolves and emits exactly once per loading cycle", async () => {
  const host = fakeHost();
  const completions = [];
  const logo = new AnimatedLogo(host, {
    imageUrl: "/logo.png",
    mode: AnimatedLogo.MODES.LOADING,
    reducedMotion: true,
    onComplete: (detail) => completions.push(detail),
  });

  logo.setProgress(2);
  const first = logo.playCompletion();
  assert.equal(logo.playCompletion(), first);
  await first;
  assert.equal(completions.length, 1);
  assert.equal(logo.element.events.filter((event) => event.type === "animated-logo-complete").length, 1);
  assert.equal(logo.loadingProgress, 1);

  logo.resetCompletion();
  await logo.playCompletion();
  assert.equal(completions.length, 2);
});
