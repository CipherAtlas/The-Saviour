import assert from "node:assert/strict";
import test from "node:test";
import {
  SPEEDRUN_RECORDS_KEY,
  SpeedrunRecordsStore,
  validateSpeedrunRecords,
} from "../src/settings/SpeedrunRecordsStore.js";

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
  }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

function run({
  runId = "speedrun:1",
  seed = "SPEED-SEED",
  time = 90,
  terminal = { kind: "ending", id: "kill" },
  finished = terminal.kind === "ending",
} = {}) {
  return {
    runId,
    seed,
    runType: "speedrun",
    speedrunTimeSeconds: time,
    speedrunFinished: finished,
    terminal,
  };
}

test("Speedrun records persist attempts and replace the best only with a faster completed run", () => {
  const storage = new MemoryStorage();
  const store = new SpeedrunRecordsStore(storage);
  assert.deepEqual(store.recordRun(run()), { recorded: true, newBest: true });
  assert.deepEqual(store.recordRun(run()), { recorded: false, newBest: false });
  assert.deepEqual(store.recordRun(run({ runId: "speedrun:2", seed: "SLOW", time: 100, terminal: { kind: "ending", id: "timeout" } })), {
    recorded: true,
    newBest: false,
  });
  assert.deepEqual(store.recordRun(run({ runId: "speedrun:3", seed: "FAST", time: 80 })), {
    recorded: true,
    newBest: true,
  });
  assert.deepEqual(store.recordRun(run({ runId: "speedrun:4", seed: "DEATH", time: 20, terminal: { kind: "death", cause: "wraith" } })), {
    recorded: true,
    newBest: false,
  });

  const snapshot = store.getSnapshot();
  assert.equal(snapshot.attempts, 4);
  assert.equal(snapshot.completions, 3);
  assert.deepEqual(snapshot.best, { timeSeconds: 80, seed: "FAST", ending: "kill" });
  assert.equal(Object.isFrozen(snapshot.best), true);
  assert.deepEqual(new SpeedrunRecordsStore(storage).getSnapshot(), snapshot);
});

test("invalid persisted records fail closed and reset removes only the Speedrun key", () => {
  const storage = new MemoryStorage({
    [SPEEDRUN_RECORDS_KEY]: JSON.stringify({ version: 1, attempts: -1 }),
    unrelated: "preserved",
  });
  const store = new SpeedrunRecordsStore(storage);
  assert.equal(store.getSnapshot().attempts, 0);
  assert.equal(store.getStatus().storageError, "invalid");
  assert.equal(validateSpeedrunRecords({}), null);
  store.reset();
  assert.equal(storage.getItem(SPEEDRUN_RECORDS_KEY), null);
  assert.equal(storage.getItem("unrelated"), "preserved");
});
