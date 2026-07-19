import assert from "node:assert/strict";
import test from "node:test";
import { SettingsStore } from "../src/settings/SettingsStore.js";
import {
  NARRATIVE_PROGRESS_KEY,
  NARRATIVE_PROGRESS_VERSION,
  NarrativeProgressStore,
} from "../src/settings/NarrativeProgressStore.js";

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
    this.writeCount = 0;
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.writeCount += 1;
    this.values.set(key, value);
  }
}

test("v2 defaults are locked empty immutable progress", () => {
  const progress = new NarrativeProgressStore(new MemoryStorage());
  const current = progress.getSnapshot();

  assert.equal(NARRATIVE_PROGRESS_VERSION, 2);
  assert.deepEqual(current, {
    version: 2,
    glossaryUnlocked: false,
    readBeatIds: [],
    completedSequenceIds: [],
  });
  assert.equal(Object.isFrozen(current), true);
  assert.equal(Object.isFrozen(current.readBeatIds), true);
  assert.equal(Object.isFrozen(current.completedSequenceIds), true);
});

test("read sequence and glossary mutations persist sorted and idempotently", () => {
  const storage = new MemoryStorage();
  const progress = new NarrativeProgressStore(storage);
  const snapshots = [];
  progress.subscribe((value) => snapshots.push(value));

  assert.equal(progress.markRead("opening.ring.b02"), true);
  assert.equal(progress.markRead("opening.domestic.b01"), true);
  assert.equal(progress.markRead("opening.ring.b02"), false);
  assert.equal(progress.markRead("unknown.beat"), false);
  assert.equal(progress.markCompleted("opening.ring"), true);
  assert.equal(progress.markCompleted("opening.domestic"), true);
  assert.equal(progress.markCompleted("opening.ring"), false);
  assert.equal(progress.markCompleted("unknown.sequence"), false);
  assert.equal(progress.unlockGlossary(), true);
  assert.equal(progress.unlockGlossary(), false);

  assert.equal(storage.writeCount, 5);
  assert.equal(snapshots.length, 5);
  assert.deepEqual(progress.getSnapshot(), {
    version: 2,
    glossaryUnlocked: true,
    readBeatIds: ["opening.domestic.b01", "opening.ring.b02"],
    completedSequenceIds: ["opening.domestic", "opening.ring"],
  });
  assert.equal(progress.isBeatRead("opening.ring.b02"), true);
  assert.equal(progress.isSequenceCompleted("opening.domestic"), true);
  assert.equal(progress.isGlossaryUnlocked(), true);

  const reloaded = new NarrativeProgressStore(storage);
  assert.deepEqual(reloaded.getSnapshot(), progress.getSnapshot());
});

test("v1 migration preserves glossary and starts read state empty", () => {
  const progress = new NarrativeProgressStore(new MemoryStorage({
    [NARRATIVE_PROGRESS_KEY]: JSON.stringify({
      version: 1,
      glossaryUnlocked: true,
    }),
  }));

  assert.deepEqual(progress.getSnapshot(), {
    version: 2,
    glossaryUnlocked: true,
    readBeatIds: [],
    completedSequenceIds: [],
  });
});

test("v2 load filters unknown IDs and deduplicates accepted IDs", () => {
  const progress = new NarrativeProgressStore(new MemoryStorage({
    [NARRATIVE_PROGRESS_KEY]: JSON.stringify({
      version: 2,
      glossaryUnlocked: false,
      readBeatIds: [
        "opening.ring.b02",
        "removed.beat",
        "opening.domestic.b01",
        "opening.ring.b02",
      ],
      completedSequenceIds: [
        "ending.kill",
        "removed.sequence",
        "opening.domestic",
        "ending.kill",
      ],
    }),
  }));

  assert.deepEqual(progress.getSnapshot(), {
    version: 2,
    glossaryUnlocked: false,
    readBeatIds: ["opening.domestic.b01", "opening.ring.b02"],
    completedSequenceIds: ["ending.kill", "opening.domestic"],
  });
});

test("malformed older and newer records use the safe locked default", () => {
  const candidates = [
    "not-json",
    JSON.stringify({ version: 0, glossaryUnlocked: true }),
    JSON.stringify({ version: 99, glossaryUnlocked: true, readBeatIds: [], completedSequenceIds: [] }),
    JSON.stringify({ version: 2, glossaryUnlocked: "yes", readBeatIds: [], completedSequenceIds: [] }),
    JSON.stringify({ version: 2, glossaryUnlocked: true, readBeatIds: "bad", completedSequenceIds: [] }),
    JSON.stringify({ version: 2, glossaryUnlocked: true, readBeatIds: [42], completedSequenceIds: [] }),
  ];

  for (const candidate of candidates) {
    const progress = new NarrativeProgressStore(new MemoryStorage({
      [NARRATIVE_PROGRESS_KEY]: candidate,
    }));
    assert.deepEqual(progress.getSnapshot(), {
      version: 2,
      glossaryUnlocked: false,
      readBeatIds: [],
      completedSequenceIds: [],
    });
  }
});

test("storage read and write failures preserve valid in-session progress", () => {
  const storage = {
    getItem() {
      throw new Error("read blocked");
    },
    setItem() {
      throw new Error("write blocked");
    },
  };
  const progress = new NarrativeProgressStore(storage);

  assert.doesNotThrow(() => progress.markRead("opening.domestic.b01"));
  assert.doesNotThrow(() => progress.markCompleted("opening.domestic"));
  assert.doesNotThrow(() => progress.unlockGlossary());
  assert.deepEqual(progress.getSnapshot(), {
    version: 2,
    glossaryUnlocked: true,
    readBeatIds: ["opening.domestic.b01"],
    completedSequenceIds: ["opening.domestic"],
  });
});

test("read-state reset is isolated and preserves glossary access", () => {
  const storage = new MemoryStorage();
  const progress = new NarrativeProgressStore(storage);
  progress.markRead("opening.domestic.b01");
  progress.markCompleted("opening.domestic");
  progress.unlockGlossary();

  assert.equal(progress.resetReadState(), true);
  assert.equal(progress.resetReadState(), false);
  assert.deepEqual(progress.getSnapshot(), {
    version: 2,
    glossaryUnlocked: true,
    readBeatIds: [],
    completedSequenceIds: [],
  });

  const reloaded = new NarrativeProgressStore(storage);
  assert.equal(reloaded.isGlossaryUnlocked(), true);
  assert.equal(reloaded.isBeatRead("opening.domestic.b01"), false);
});

test("resetting settings cannot clear narrative progress", () => {
  const storage = new MemoryStorage();
  const progress = new NarrativeProgressStore(storage);
  const settings = new SettingsStore(storage);
  progress.markRead("opening.domestic.b01");
  progress.markCompleted("opening.domestic");
  progress.unlockGlossary();

  settings.reset();

  assert.deepEqual(new NarrativeProgressStore(storage).getSnapshot(), {
    version: 2,
    glossaryUnlocked: true,
    readBeatIds: ["opening.domestic.b01"],
    completedSequenceIds: ["opening.domestic"],
  });
});
