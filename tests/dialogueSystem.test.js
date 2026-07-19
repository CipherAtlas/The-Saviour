import assert from "node:assert/strict";
import test from "node:test";
import {
  DialogueSystem,
  segmentGraphemes,
} from "../src/game/DialogueSystem.js";
import { NarrativeProgressStore } from "../src/settings/NarrativeProgressStore.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const CHARACTERS = deepFreeze({
  prince: { id: "prince", name: "Zephyr" },
  princess: { id: "princess-elowen", name: "Princess Elowen" },
});

const SEQUENCES = deepFreeze({
  "scene.one": {
    id: "scene.one",
    presentation: "vn",
    repeat: "oncePerRun",
    sceneRole: "test",
    beats: [
      {
        id: "scene.one.b01",
        speaker: "prince",
        text: "ABCD",
        expression: "calm",
        pose: "still",
        stage: "left",
        background: "test",
        artState: "prince.calm",
      },
      {
        id: "scene.one.b02",
        speaker: "princess",
        text: "Second",
        expression: "calm",
        pose: "still",
        stage: "right",
        background: "test",
        artState: "princess.human",
      },
      {
        id: "scene.one.b03",
        speaker: "prince",
        text: "Third",
        expression: "calm",
        pose: "still",
        stage: "left",
        background: "test",
        artState: "prince.calm",
      },
    ],
  },
  "scene.unicode": {
    id: "scene.unicode",
    presentation: "vn",
    repeat: "oncePerRun",
    sceneRole: "test",
    beats: [
      {
        id: "scene.unicode.b01",
        speaker: "prince",
        text: "A🙂e\u0301👨‍👩‍👧‍👦",
        expression: "calm",
        pose: "still",
        stage: "left",
        background: "test",
        artState: "prince.calm",
      },
    ],
  },
});

const TIMING = Object.freeze({
  textCharactersPerSecond: 10,
  fastForwardCharactersPerSecond: 100,
  autoDelayMs: 500,
});

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, value);
  }
}

function makeReader(progress = null, timing = TIMING) {
  return new DialogueSystem(SEQUENCES, CHARACTERS, progress, timing);
}

test("reader exposes immutable zero mid and fully revealed snapshots", () => {
  const progress = new NarrativeProgressStore(new MemoryStorage(), SEQUENCES);
  const dialogue = makeReader(progress);
  const zero = dialogue.start("scene.one", 0);

  assert.equal(zero.phase, "revealing");
  assert.equal(zero.speaker, "Zephyr");
  assert.equal(zero.position, 1);
  assert.equal(zero.total, 3);
  assert.equal(zero.revealedCount, 0);
  assert.equal(zero.revealedText, "");
  assert.equal(zero.nextBackground, "test");
  assert.equal(zero.nextArtState, "princess.human");
  assert.equal(Object.isFrozen(zero), true);
  assert.equal(Object.isFrozen(zero.history), true);

  const mid = dialogue.update(250);
  assert.equal(mid.phase, "revealing");
  assert.equal(mid.revealedCount, 2);
  assert.equal(mid.revealedText, "AB");
  assert.equal(progress.isBeatRead("scene.one.b01"), false);

  const full = dialogue.update(400);
  assert.equal(full.phase, "awaitingAdvance");
  assert.equal(full.revealedCount, 4);
  assert.equal(full.revealedText, "ABCD");
  assert.equal(full.isRead, true);
  assert.equal(progress.isBeatRead("scene.one.b01"), true);
  assert.deepEqual(full.history.map((beat) => beat.beatId), ["scene.one.b01"]);
});

test("first advance reveals only and the second advances exactly one beat", () => {
  const dialogue = makeReader();
  dialogue.start("scene.one", 0);
  dialogue.update(100);

  const revealed = dialogue.handleCommand("advance", 100);
  assert.equal(revealed.phase, "awaitingAdvance");
  assert.equal(revealed.position, 1);
  assert.equal(revealed.revealedText, "ABCD");

  const pending = dialogue.handleCommand("advance", 100);
  assert.equal(pending.phase, "transitioning");
  assert.equal(pending.position, 1);

  const next = dialogue.update(100);
  assert.equal(next.phase, "revealing");
  assert.equal(next.position, 2);
  assert.equal(next.revealedCount, 0);

  const unchanged = dialogue.update(100);
  assert.equal(unchanged.position, 2);
  assert.equal(unchanged.revealedCount, 0);
  assert.equal(unchanged.nextArtState, "prince.calm");
});

test("grapheme reveal never splits surrogate combining or joined emoji sequences", () => {
  assert.deepEqual(segmentGraphemes("A🙂e\u0301👨‍👩‍👧‍👦"), [
    "A",
    "🙂",
    "e\u0301",
    "👨‍👩‍👧‍👦",
  ]);

  const dialogue = makeReader(null, {
    textCharactersPerSecond: 1,
    fastForwardCharactersPerSecond: 10,
    autoDelayMs: 500,
  });
  dialogue.start("scene.unicode", 0);
  assert.equal(dialogue.update(1000).revealedText, "A");
  assert.equal(dialogue.update(2000).revealedText, "A🙂");
  assert.equal(dialogue.update(3000).revealedText, "A🙂e\u0301");
  assert.equal(dialogue.update(4000).revealedText, "A🙂e\u0301👨‍👩‍👧‍👦");
  assert.equal(dialogue.snapshot().phase, "awaitingAdvance");
  assert.equal(dialogue.snapshot().nextBackground, null);
  assert.equal(dialogue.snapshot().nextArtState, null);
});

test("auto waits after a visible full line and advances at most one beat per update", () => {
  const dialogue = makeReader();
  dialogue.start("scene.one", 0);
  dialogue.handleCommand("toggleAuto", 0);

  const full = dialogue.update(10_000);
  assert.equal(full.phase, "awaitingAdvance");
  assert.equal(full.position, 1);
  assert.equal(full.revealedText, "ABCD");

  assert.equal(dialogue.update(10_499).phase, "awaitingAdvance");
  assert.equal(dialogue.update(10_500).phase, "transitioning");

  const next = dialogue.update(50_000);
  assert.equal(next.phase, "revealing");
  assert.equal(next.position, 2);
  assert.equal(next.revealedCount, 0);

  const nextFull = dialogue.update(60_000);
  assert.equal(nextFull.phase, "awaitingAdvance");
  assert.equal(nextFull.position, 2);
});

test("backlog and skip confirmation pause clocks while hidden UI does not", () => {
  const dialogue = makeReader();
  dialogue.start("scene.one", 0);
  assert.equal(dialogue.update(100).revealedCount, 1);

  const backlog = dialogue.handleCommand("openBacklog", 100);
  assert.equal(backlog.backlogOpen, true);
  assert.equal(dialogue.update(1000).revealedCount, 1);
  dialogue.handleCommand("closeBacklog", 1000);
  assert.equal(dialogue.update(1100).revealedCount, 2);

  const confirmation = dialogue.handleCommand("requestSceneSkip", 1100);
  assert.equal(confirmation.skipConfirmationOpen, true);
  assert.equal(dialogue.update(2000).revealedCount, 2);
  dialogue.handleCommand("cancel", 2000);
  assert.equal(dialogue.snapshot().skipConfirmationOpen, false);

  const hidden = dialogue.handleCommand("toggleUi", 2000);
  assert.equal(hidden.uiHidden, true);
  assert.equal(dialogue.update(2100).revealedCount, 3);
});

test("backlog and confirmation also hold a pending beat transition", () => {
  const dialogue = makeReader();
  dialogue.start("scene.one", 0);
  dialogue.handleCommand("advance", 0);
  dialogue.handleCommand("advance", 0);
  assert.equal(dialogue.snapshot().phase, "transitioning");

  dialogue.handleCommand("openBacklog", 0);
  assert.equal(dialogue.update(1000).position, 1);
  dialogue.handleCommand("closeBacklog", 1000);
  assert.equal(dialogue.update(1000).position, 2);

  dialogue.handleCommand("advance", 1000);
  dialogue.handleCommand("advance", 1000);
  dialogue.handleCommand("requestSceneSkip", 1000);
  assert.equal(dialogue.update(2000).position, 2);
  dialogue.handleCommand("cancel", 2000);
  assert.equal(dialogue.update(2000).position, 3);
});

test("reader commands cannot leak through backlog or skip confirmation overlays", () => {
  const dialogue = makeReader();
  dialogue.start("scene.one", 0);
  dialogue.update(100);

  dialogue.handleCommand("openBacklog", 100);
  dialogue.handleCommand("advance", 200);
  dialogue.handleCommand("toggleAuto", 200);
  dialogue.handleCommand("fastForwardStart", 200);
  dialogue.handleCommand("toggleUi", 200);
  dialogue.handleCommand("requestSceneSkip", 200);
  const backlog = dialogue.snapshot();
  assert.equal(backlog.revealedCount, 1);
  assert.equal(backlog.autoEnabled, false);
  assert.equal(backlog.fastForwardHeld, false);
  assert.equal(backlog.uiHidden, false);
  assert.equal(backlog.skipConfirmationOpen, false);

  dialogue.handleCommand("closeBacklog", 200);
  dialogue.handleCommand("requestSceneSkip", 200);
  dialogue.handleCommand("advance", 300);
  dialogue.handleCommand("toggleAuto", 300);
  dialogue.handleCommand("fastForwardStart", 300);
  dialogue.handleCommand("toggleUi", 300);
  dialogue.handleCommand("openBacklog", 300);
  const confirmation = dialogue.snapshot();
  assert.equal(confirmation.revealedCount, 1);
  assert.equal(confirmation.autoEnabled, false);
  assert.equal(confirmation.fastForwardHeld, false);
  assert.equal(confirmation.uiHidden, false);
  assert.equal(confirmation.backlogOpen, false);
});

test("held fast-forward accelerates read beats but immediately gates unread beats", () => {
  const progress = new NarrativeProgressStore(new MemoryStorage(), SEQUENCES);
  progress.markRead("scene.one.b01");
  const dialogue = makeReader(progress);
  dialogue.start("scene.one", 0);
  dialogue.handleCommand("fastForwardStart", 0);

  const accelerated = dialogue.update(40);
  assert.equal(accelerated.phase, "awaitingAdvance");
  assert.equal(accelerated.revealedText, "ABCD");

  dialogue.handleCommand("advance", 40);
  const next = dialogue.update(40);
  assert.equal(next.position, 2);
  assert.equal(next.fastForwardHeld, true);
  assert.equal(next.isRead, false);

  const gated = dialogue.update(140);
  assert.equal(gated.revealedCount, 1);
  assert.equal(gated.revealedText, "S");
  dialogue.handleCommand("fastForwardEnd", 140);
  assert.equal(dialogue.snapshot().fastForwardHeld, false);
});

test("confirmed scene skip completes once without marking unseen beats read", () => {
  const progress = new NarrativeProgressStore(new MemoryStorage(), SEQUENCES);
  const dialogue = makeReader(progress);
  dialogue.start("scene.one", 0);
  dialogue.update(100);

  dialogue.handleCommand("requestSceneSkip", 100);
  const completed = dialogue.handleCommand("confirmSceneSkip", 100);
  assert.equal(completed.phase, "completed");
  assert.deepEqual(completed.completion, { sequenceId: "scene.one", skipped: true });
  assert.equal(progress.isBeatRead("scene.one.b01"), false);
  assert.equal(progress.isBeatRead("scene.one.b02"), false);
  assert.equal(progress.isSequenceCompleted("scene.one"), true);

  assert.deepEqual(dialogue.acknowledgeCompletion(), {
    sequenceId: "scene.one",
    skipped: true,
  });
  assert.equal(dialogue.acknowledgeCompletion(), null);
  assert.equal(dialogue.snapshot(), null);
});

test("background and pause intervals are excluded from reveal time", () => {
  const dialogue = makeReader();
  dialogue.start("scene.one", 0);

  assert.equal(dialogue.update(100, { activeForeground: false }).revealedCount, 1);
  assert.equal(dialogue.update(1000, { activeForeground: true }).revealedCount, 1);
  assert.equal(dialogue.update(1100).revealedCount, 2);
  assert.equal(dialogue.update(1200, { activeForeground: false }).revealedCount, 3);
  assert.equal(dialogue.update(5000, { activeForeground: true }).revealedCount, 3);
});

test("large jumps cannot skip an unread line or cross multiple beats", () => {
  const dialogue = makeReader();
  dialogue.start("scene.one", 0);
  dialogue.handleCommand("toggleAuto", 0);

  const firstJump = dialogue.update(1_000_000);
  assert.equal(firstJump.phase, "awaitingAdvance");
  assert.equal(firstJump.position, 1);

  const secondJump = dialogue.update(2_000_000);
  assert.equal(secondJump.phase, "transitioning");
  assert.equal(secondJump.position, 1);

  const thirdJump = dialogue.update(3_000_000);
  assert.equal(thirdJump.phase, "revealing");
  assert.equal(thirdJump.position, 2);
  assert.equal(thirdJump.revealedCount, 0);
});

test("normal completion is recorded and acknowledged exactly once", () => {
  const progress = new NarrativeProgressStore(new MemoryStorage(), SEQUENCES);
  let completionNotifications = 0;
  progress.subscribe((snapshot) => {
    if (snapshot.completedSequenceIds.includes("scene.unicode")) completionNotifications += 1;
  });
  const dialogue = makeReader(progress);
  dialogue.start("scene.unicode", 0);

  dialogue.handleCommand("advance", 0);
  dialogue.handleCommand("advance", 0);
  const completed = dialogue.update(0);
  assert.equal(completed.phase, "completed");
  assert.equal(completionNotifications, 1);

  dialogue.handleCommand("advance", 0);
  dialogue.update(10_000);
  assert.equal(completionNotifications, 1);
  assert.deepEqual(dialogue.acknowledgeCompletion(), {
    sequenceId: "scene.unicode",
    skipped: false,
  });
  assert.equal(dialogue.acknowledgeCompletion(), null);
});

test("compatibility view advance and readInline use the same reader state", () => {
  const dialogue = makeReader();
  dialogue.start("scene.one", 0);
  assert.deepEqual(dialogue.view(), dialogue.snapshot());

  const advanced = dialogue.advance();
  assert.equal(advanced.completed, false);
  assert.equal(advanced.view.position, 2);
  assert.equal(advanced.view.phase, "revealing");

  const before = dialogue.snapshot();
  const migrationBeats = dialogue.readInline("scene.unicode");
  assert.equal(migrationBeats, SEQUENCES["scene.unicode"].beats);
  assert.equal(Object.isFrozen(migrationBeats), true);
  assert.deepEqual(dialogue.snapshot(), before);
});

test("unknown identifiers commands and non-VN sequences fail explicitly", () => {
  const dialogue = makeReader();
  assert.throws(() => dialogue.start("missing"), /Unknown dialogue sequence/);
  assert.throws(() => dialogue.readInline("missing"), /Unknown dialogue sequence/);
  assert.throws(() => dialogue.handleCommand("unknown", 0), /Unknown dialogue command/);

  const legacy = deepFreeze({
    legacy: {
      id: "legacy",
      presentation: "modal",
      repeat: "oncePerRun",
      sceneRole: "test",
      beats: SEQUENCES["scene.one"].beats,
    },
  });
  const legacyReader = new DialogueSystem(legacy, CHARACTERS);
  assert.throws(() => legacyReader.start("legacy", 0), /not VN presentation/);
});
