import assert from "node:assert/strict";
import test from "node:test";
import {
  SPEEDRUN_LEADERBOARD_LIMIT,
  SPEEDRUN_RECORDS_KEY,
  SPEEDRUN_RECORDS_VERSION,
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
  assert.deepEqual(store.recordRun(run()), { recorded: true, newBest: true, leaderboardRank: 1 });
  assert.deepEqual(store.recordRun(run()), { recorded: false, newBest: false, leaderboardRank: null });
  assert.deepEqual(store.recordRun(run({ runId: "speedrun:2", seed: "SLOW", time: 100, terminal: { kind: "ending", id: "timeout" } })), {
    recorded: true,
    newBest: false,
    leaderboardRank: 2,
  });
  assert.deepEqual(store.recordRun(run({ runId: "speedrun:3", seed: "FAST", time: 80 })), {
    recorded: true,
    newBest: true,
    leaderboardRank: 1,
  });
  assert.deepEqual(store.recordRun(run({ runId: "speedrun:4", seed: "DEATH", time: 20, terminal: { kind: "death", cause: "wraith" } })), {
    recorded: true,
    newBest: false,
    leaderboardRank: null,
  });

  const snapshot = store.getSnapshot();
  assert.equal(snapshot.attempts, 4);
  assert.equal(snapshot.completions, 3);
  assert.deepEqual(snapshot.best, { timeSeconds: 80, seed: "FAST", ending: "kill" });
  assert.deepEqual(snapshot.leaderboard, [
    { timeSeconds: 80, seed: "FAST", ending: "kill" },
    { timeSeconds: 90, seed: "SPEED-SEED", ending: "kill" },
    { timeSeconds: 100, seed: "SLOW", ending: "timeout" },
  ]);
  assert.equal(Object.isFrozen(snapshot.best), true);
  assert.equal(Object.isFrozen(snapshot.leaderboard), true);
  assert.deepEqual(new SpeedrunRecordsStore(storage).getSnapshot(), snapshot);
});

test("the personal leaderboard retains only the fastest ten completed runs", () => {
  const store = new SpeedrunRecordsStore(new MemoryStorage());
  for (let index = 0; index < SPEEDRUN_LEADERBOARD_LIMIT; index += 1) {
    const time = 20 + index;
    assert.equal(store.recordRun(run({
      runId: `speedrun:${index}`,
      seed: `SEED-${index}`,
      time,
    })).leaderboardRank, index + 1);
  }

  const missed = store.recordRun(run({ runId: "speedrun:slow", seed: "SLOW", time: 40 }));
  assert.equal(missed.leaderboardRank, null);
  const qualified = store.recordRun(run({ runId: "speedrun:fast", seed: "FAST", time: 19 }));
  assert.equal(qualified.leaderboardRank, 1);
  assert.equal(qualified.newBest, true);

  const snapshot = store.getSnapshot();
  assert.equal(snapshot.attempts, 12);
  assert.equal(snapshot.completions, 12);
  assert.equal(snapshot.leaderboard.length, SPEEDRUN_LEADERBOARD_LIMIT);
  assert.deepEqual(snapshot.leaderboard.map(({ timeSeconds }) => timeSeconds), [19, 20, 21, 22, 23, 24, 25, 26, 27, 28]);
  assert.equal(snapshot.leaderboard.some(({ seed }) => seed === "SLOW"), false);
});

test("version one personal best data migrates into the leaderboard without changing the storage key", () => {
  const legacy = {
    version: 1,
    attempts: 3,
    completions: 1,
    best: { timeSeconds: 82.5, seed: "LEGACY-SEED", ending: "timeout" },
    recordedRunIds: ["legacy:1", "legacy:2", "legacy:3"],
  };
  const storage = new MemoryStorage({
    [SPEEDRUN_RECORDS_KEY]: JSON.stringify(legacy),
  });

  const snapshot = new SpeedrunRecordsStore(storage).getSnapshot();
  assert.equal(snapshot.version, SPEEDRUN_RECORDS_VERSION);
  assert.deepEqual(snapshot.leaderboard, [legacy.best]);
  assert.deepEqual(snapshot.best, legacy.best);
  const persisted = JSON.parse(storage.getItem(SPEEDRUN_RECORDS_KEY));
  assert.equal(persisted.version, SPEEDRUN_RECORDS_VERSION);
  assert.deepEqual(persisted.leaderboard, [legacy.best]);
  assert.equal(Object.hasOwn(persisted, "best"), false);
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

test("current records reject unsorted or oversized leaderboard data", () => {
  const base = {
    version: SPEEDRUN_RECORDS_VERSION,
    attempts: 11,
    completions: 11,
    leaderboard: [
      { timeSeconds: 20, seed: "FAST", ending: "kill" },
      { timeSeconds: 19, seed: "FASTER", ending: "timeout" },
    ],
    recordedRunIds: [],
  };
  assert.equal(validateSpeedrunRecords(base), null);
  assert.equal(validateSpeedrunRecords({
    ...base,
    completions: 1,
    leaderboard: [...base.leaderboard].reverse(),
  }), null);
  assert.equal(validateSpeedrunRecords({
    ...base,
    leaderboard: Array.from({ length: SPEEDRUN_LEADERBOARD_LIMIT + 1 }, (_, index) => ({
      timeSeconds: index,
      seed: `SEED-${index}`,
      ending: "kill",
    })),
  }), null);
});
