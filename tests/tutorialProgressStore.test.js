import assert from "node:assert/strict";
import test from "node:test";
import {
  TUTORIAL_PROGRESS_KEY,
  TUTORIAL_PROGRESS_VERSION,
  TutorialProgressStore,
} from "../src/settings/TutorialProgressStore.js";

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

test("tutorial repeats by default and only explicit dismissal suppresses future runs", () => {
  const storage = new MemoryStorage();
  const progress = new TutorialProgressStore(storage);

  assert.equal(progress.shouldShow(), true);
  assert.equal(progress.dismissForever(), true);
  assert.equal(progress.isDismissed(), true);
  assert.equal(progress.dismissForever(), false);
  assert.deepEqual(JSON.parse(storage.getItem(TUTORIAL_PROGRESS_KEY)), {
    version: TUTORIAL_PROGRESS_VERSION,
    dontShowAgain: true,
  });
  assert.equal(new TutorialProgressStore(storage).shouldShow(), false);
});

test("legacy completion does not silently become an explicit don't-show-again choice", () => {
  const storage = new MemoryStorage({
    [TUTORIAL_PROGRESS_KEY]: JSON.stringify({ version: 1, completed: true }),
  });
  const migrated = new TutorialProgressStore(storage);

  assert.equal(migrated.shouldShow(), true);
  assert.deepEqual(JSON.parse(storage.getItem(TUTORIAL_PROGRESS_KEY)), {
    version: TUTORIAL_PROGRESS_VERSION,
    dontShowAgain: false,
  });
});

test("invalid or unavailable tutorial storage falls back safely", () => {
  const invalid = new TutorialProgressStore(new MemoryStorage({
    [TUTORIAL_PROGRESS_KEY]: JSON.stringify({ version: 99, completed: true }),
  }));
  assert.equal(invalid.shouldShow(), true);
  assert.equal(invalid.getStatus().storageError, "invalid");

  const sessionOnly = new TutorialProgressStore(null);
  assert.equal(sessionOnly.dismissForever(), true);
  assert.equal(sessionOnly.shouldShow(), false);
});
