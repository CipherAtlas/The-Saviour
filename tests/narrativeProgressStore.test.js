import assert from "node:assert/strict";
import test from "node:test";
import { SettingsStore } from "../src/settings/SettingsStore.js";
import {
  NARRATIVE_PROGRESS_KEY,
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

test("glossary progress is locked by default and persists after unlock", () => {
  const storage = new MemoryStorage();
  const first = new NarrativeProgressStore(storage);

  assert.equal(first.isGlossaryUnlocked(), false);
  assert.equal(first.unlockGlossary(), true);
  assert.equal(first.isGlossaryUnlocked(), true);

  const second = new NarrativeProgressStore(storage);
  assert.equal(second.isGlossaryUnlocked(), true);
});

test("unlock is idempotent and notifies subscribers only on change", () => {
  const storage = new MemoryStorage();
  const progress = new NarrativeProgressStore(storage);
  const snapshots = [];
  const unsubscribe = progress.subscribe((value) => snapshots.push(value));

  assert.equal(progress.unlockGlossary(), true);
  assert.equal(progress.unlockGlossary(), false);
  unsubscribe();
  assert.equal(progress.unlockGlossary(), false);

  assert.equal(storage.writeCount, 1);
  assert.deepEqual(snapshots, [{ version: 1, glossaryUnlocked: true }]);
  assert.equal(Object.isFrozen(snapshots[0]), true);
});

test("malformed and incompatible progress fall back to locked", () => {
  const malformed = new NarrativeProgressStore(new MemoryStorage({
    [NARRATIVE_PROGRESS_KEY]: "not-json",
  }));
  const incompatible = new NarrativeProgressStore(new MemoryStorage({
    [NARRATIVE_PROGRESS_KEY]: JSON.stringify({ version: 99, glossaryUnlocked: true }),
  }));

  assert.equal(malformed.isGlossaryUnlocked(), false);
  assert.equal(incompatible.isGlossaryUnlocked(), false);
});

test("storage read and write failures do not escape or lose in-session progress", () => {
  const storage = {
    getItem() { throw new Error("read blocked"); },
    setItem() { throw new Error("write blocked"); },
  };
  const progress = new NarrativeProgressStore(storage);

  assert.equal(progress.isGlossaryUnlocked(), false);
  assert.doesNotThrow(() => progress.unlockGlossary());
  assert.equal(progress.isGlossaryUnlocked(), true);
});

test("resetting settings does not clear narrative progress", () => {
  const storage = new MemoryStorage();
  const progress = new NarrativeProgressStore(storage);
  const settings = new SettingsStore(storage);
  progress.unlockGlossary();

  settings.reset();

  assert.equal(new NarrativeProgressStore(storage).isGlossaryUnlocked(), true);
});
