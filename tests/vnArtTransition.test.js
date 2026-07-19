import assert from "node:assert/strict";
import test from "node:test";
import { GameUi } from "../src/ui/GameUi.js";

class FakeClassList {
  constructor(...names) {
    this.names = new Set(names);
  }

  add(...names) {
    for (const name of names) this.names.add(name);
  }

  remove(...names) {
    for (const name of names) this.names.delete(name);
  }

  contains(name) {
    return this.names.has(name);
  }
}

class FakeImage {
  constructor(src = null) {
    this.attributes = new Map(src ? [["src", src]] : []);
    this.classList = new FakeClassList();
    this.className = "";
    this.dataset = {};
    this.alt = "";
    this.replace = null;
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  replaceWith(image) {
    this.replace?.(image);
  }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function transitionHarness() {
  const screen = { dataset: { artState: "ready", backgroundReady: "true" } };
  const slots = new Map(["left", "center-left", "center", "right"].map((stage) => {
    const slot = {
      classList: new FakeClassList(stage === "left" ? "active" : undefined),
      dataset: stage === "left" ? { character: "prince" } : {},
      image: new FakeImage(stage === "left" ? "/old-cutout.png" : null),
      querySelector: () => slot.image,
    };
    slot.classList.names.delete(undefined);
    slot.image.replace = (image) => {
      slot.image = image;
      image.replace = (replacement) => { slot.image = replacement; };
    };
    return [stage, slot];
  }));
  let background = new FakeImage("/old-background.png");
  background.dataset.dialogue = "background";
  background.replace = (image) => {
    background = image;
    image.replace = (replacement) => { background = replacement; };
  };
  const root = {
    querySelector(selector) {
      if (selector === "[data-screen='dialogue']") return screen;
      if (selector === "[data-dialogue='background']") return background;
      const stage = selector.match(/^\[data-vn-stage='(.+)'\]$/)?.[1];
      return stage ? slots.get(stage) : null;
    },
    querySelectorAll(selector) {
      return selector === "[data-vn-stage]" ? [...slots.values()] : [];
    },
  };
  const ui = {
    root,
    dialogueArtToken: 0,
    dialogueArtBeatId: "old.beat",
    hideDialogueArt() {
      throw new Error("outgoing ready art must not be cleared while replacement images are pending");
    },
  };
  return { ui, screen, slots, background: () => background };
}

test("VN transition retains outgoing art until both exact staging images are ready", async () => {
  const harness = transitionHarness();
  const backgroundReady = deferred();
  const cutoutReady = deferred();
  const paths = [];
  harness.ui.loadDialogueImage = (path) => {
    paths.push(path);
    return paths.length === 1 ? backgroundReady.promise : cutoutReady.promise;
  };

  const transition = GameUi.prototype.prepareDialogueArt.call(harness.ui, {
    beatId: "next.beat",
    background: "royal-study-evening",
    artState: "princess.human",
    stage: "right",
  });

  assert.equal(harness.screen.dataset.artState, "transitioning");
  assert.equal(harness.background().getAttribute("src"), "/old-background.png");
  assert.equal(harness.slots.get("left").classList.contains("active"), true);
  assert.equal(harness.slots.get("right").classList.contains("active"), false);

  const nextBackground = new FakeImage("/new-background.png");
  backgroundReady.resolve(nextBackground);
  await Promise.resolve();
  assert.equal(harness.background().getAttribute("src"), "/old-background.png");
  assert.equal(harness.slots.get("left").classList.contains("active"), true);

  const nextCutout = new FakeImage("/new-cutout.png");
  cutoutReady.resolve(nextCutout);
  await transition;

  assert.equal(harness.background(), nextBackground);
  assert.equal(harness.slots.get("right").image, nextCutout);
  assert.equal(harness.slots.get("left").classList.contains("active"), false);
  assert.equal(harness.slots.get("right").classList.contains("active"), true);
  assert.equal(harness.screen.dataset.artState, "ready");
  assert.equal(harness.screen.dataset.backgroundReady, "true");
});

test("failed replacement retains the outgoing complete composition", async () => {
  const harness = transitionHarness();
  harness.ui.loadDialogueImage = async () => { throw new Error("decode failed"); };

  await GameUi.prototype.prepareDialogueArt.call(harness.ui, {
    beatId: "failed.beat",
    background: "royal-study-evening",
    artState: "princess.human",
    stage: "right",
  });

  assert.equal(harness.background().getAttribute("src"), "/old-background.png");
  assert.equal(harness.slots.get("left").classList.contains("active"), true);
  assert.equal(harness.screen.dataset.artState, "error");
});

test("a newer pending beat retains outgoing art and makes an older completion stale", async () => {
  const harness = transitionHarness();
  const olderBackground = deferred();
  const olderCutout = deferred();
  let olderLoadCount = 0;
  harness.ui.loadDialogueImage = () => {
    olderLoadCount += 1;
    return olderLoadCount === 1 ? olderBackground.promise : olderCutout.promise;
  };

  const olderTransition = GameUi.prototype.prepareDialogueArt.call(harness.ui, {
    beatId: "older.beat",
    background: "royal-study-evening",
    artState: "princess.human",
    stage: "right",
  });
  assert.equal(harness.screen.dataset.artState, "transitioning");

  const newestBackground = new FakeImage("/newest-background.png");
  const newestCutout = new FakeImage("/newest-cutout.png");
  let newestLoadCount = 0;
  harness.ui.loadDialogueImage = async () => {
    newestLoadCount += 1;
    return newestLoadCount === 1 ? newestBackground : newestCutout;
  };
  await GameUi.prototype.prepareDialogueArt.call(harness.ui, {
    beatId: "newest.beat",
    background: "ring-void",
    artState: "prince.resolved",
    stage: "center",
  });

  olderBackground.resolve(new FakeImage("/stale-background.png"));
  olderCutout.resolve(new FakeImage("/stale-cutout.png"));
  await olderTransition;

  assert.equal(harness.background(), newestBackground);
  assert.equal(harness.slots.get("center").image, newestCutout);
  assert.equal(harness.slots.get("center").classList.contains("active"), true);
  assert.equal(harness.slots.get("right").classList.contains("active"), false);
  assert.equal(harness.screen.dataset.artState, "ready");
});
