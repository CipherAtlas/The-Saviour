import assert from "node:assert/strict";
import test from "node:test";
import { RunStatsAccumulator } from "../src/game/RunStatsAccumulator.js";
import {
  SUSPENDED_RUN_KEY,
  SUSPENDED_RUN_VERSION,
  SuspendedRunStore,
} from "../src/settings/SuspendedRunStore.js";

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
  }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

function snapshot(overrides = {}) {
  const statistics = new RunStatsAccumulator({
    runId: "suspend-run-001",
    seed: "SUSPEND-SEED",
    difficultyId: "standard",
    startedAt: 10,
  });
  statistics.record({
    type: "roomRewardChosen",
    detail: { id: "whetted-crescent", path: "Reaper", rank: 1 },
  });
  statistics.record({
    type: "roomRewardChosen",
    detail: { id: "quickened-step", path: "Shade", rank: 1 },
  });
  statistics.record({ type: "deathDefianceGranted", detail: { amount: 1 } });
  statistics.record({
    type: "blessingChosen",
    detail: { id: "final-mercy", path: "Grave", rank: 1 },
  });
  statistics.record({ type: "upgradeRerolled" });
  const statisticsDraft = statistics.snapshotDraft();
  return {
    seed: "SUSPEND-SEED",
    difficultyId: "standard",
    nextFloor: 2,
    nextRoom: 1,
    player: { health: 104 },
    harvestUnits: 176,
    deathDefiance: { granted: 1, remaining: 1 },
    upgradeSelections: [
      { upgradeId: "whetted-crescent", rankAfter: 1 },
      { upgradeId: "quickened-step", rankAfter: 1 },
    ],
    upgradeRanks: [["quickened-step", 1], ["whetted-crescent", 1]],
    blessingIds: ["final-mercy"],
    rerollsUsedByFloor: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    runFlags: {},
    statisticsDraft,
    ...overrides,
  };
}

test("suspended runs are stamped, validated, persisted, and returned deeply immutable", () => {
  const storage = new MemoryStorage();
  const store = new SuspendedRunStore(storage, { now: () => 123_456 });

  assert.equal(store.save(snapshot()), true);
  const loaded = store.loadValid();
  assert.equal(loaded.version, SUSPENDED_RUN_VERSION);
  assert.equal(loaded.runType, "normal");
  assert.deepEqual(loaded.speedrun, { elapsedSeconds: 0, finished: false });
  assert.equal(loaded.savedAt, 123_456);
  assert.equal(loaded.seed, "SUSPEND-SEED");
  assert.deepEqual(loaded.upgradeRanks, [["quickened-step", 1], ["whetted-crescent", 1]]);
  assert.equal(Object.isFrozen(loaded), true);
  assert.equal(Object.isFrozen(loaded.statisticsDraft.actions), true);
  assert.throws(() => { loaded.player.health = 1; }, TypeError);
});

test("version-two legacy suspends migrate without retired presentation state or lost progress", () => {
  const legacy = {
    version: 2,
    savedAt: 99,
    ...snapshot(),
    difficultyId: "story",
    runType: "normal",
    speedrun: { elapsedSeconds: 0, finished: false },
    seenRunSequenceIds: ["opening.ring"],
    completedUpgradeSequenceIds: [],
  };
  legacy.statisticsDraft = { ...legacy.statisticsDraft, version: 1, difficultyId: "story" };
  const storage = new MemoryStorage({ [SUSPENDED_RUN_KEY]: JSON.stringify(legacy) });
  const store = new SuspendedRunStore(storage);
  const loaded = store.loadValid();
  assert.equal(loaded.version, SUSPENDED_RUN_VERSION);
  assert.equal(loaded.runType, "normal");
  assert.equal(loaded.difficultyId, "relaxed");
  assert.deepEqual(loaded.speedrun, { elapsedSeconds: 0, finished: false });
});

test("room-boundary progression counts must match the next floor and room", () => {
  const store = new SuspendedRunStore(new MemoryStorage(), { now: () => 1 });
  const missingChamber = snapshot({
    upgradeSelections: [{ upgradeId: "whetted-crescent", rankAfter: 1 }],
    upgradeRanks: [["whetted-crescent", 1]],
  });
  assert.equal(store.save(missingChamber), false);

  assert.equal(store.save(snapshot({ nextRoom: 2 })), false);
  assert.equal(store.save(snapshot({ blessingIds: [] })), false);
});

test("draft selections must exactly match the authoritative chamber and blessing histories", () => {
  const store = new SuspendedRunStore(new MemoryStorage(), { now: () => 1 });
  const statisticsDraft = structuredClone(snapshot().statisticsDraft);
  statisticsDraft.selections[0].id = "long-haft";
  statisticsDraft.finalRanks = {
    "long-haft": 1,
    "quickened-step": 1,
    "final-mercy": 1,
  };

  assert.equal(store.save(snapshot({ statisticsDraft })), false);
});

test("draft final ranks must equal merged chamber and blessing ranks", () => {
  const store = new SuspendedRunStore(new MemoryStorage(), { now: () => 1 });
  const statisticsDraft = structuredClone(snapshot().statisticsDraft);
  statisticsDraft.finalRanks["final-mercy"] = 2;

  assert.equal(store.save(snapshot({ statisticsDraft })), false);
});

test("invalid IDs and contradictory authoritative fields remove only the bad suspend slot", () => {
  const storage = new MemoryStorage({ "hollow-crown-settings": "keep" });
  const store = new SuspendedRunStore(storage, { now: () => 1 });
  assert.equal(store.save(snapshot()), true);

  const candidate = JSON.parse(storage.getItem(SUSPENDED_RUN_KEY));
  candidate.upgradeRanks = [["whetted-crescent", 2]];
  storage.setItem(SUSPENDED_RUN_KEY, JSON.stringify(candidate));
  assert.equal(store.loadValid(), null);
  assert.equal(storage.getItem(SUSPENDED_RUN_KEY), null);
  assert.equal(storage.getItem("hollow-crown-settings"), "keep");
  assert.equal(store.getStatus().storageError, "invalid");

  assert.equal(store.save(snapshot({ blessingIds: ["unknown-blessing"] })), false);
  assert.equal(store.save(snapshot({ deathDefiance: { granted: 3, remaining: 3 } })), false);
});

test("statistics identity and unfinished state are required for resume", () => {
  const storage = new MemoryStorage();
  const store = new SuspendedRunStore(storage, { now: () => 2 });
  const wrongSeedDraft = structuredClone(snapshot().statisticsDraft);
  wrongSeedDraft.seed = "OTHER-SEED";
  assert.equal(store.save(snapshot({ statisticsDraft: wrongSeedDraft })), false);

  const finalized = new RunStatsAccumulator({
    runId: "finished",
    seed: "SUSPEND-SEED",
    difficultyId: "standard",
  }).finalize({ completed: false, cause: "defeated" });
  assert.equal(store.save(snapshot({ statisticsDraft: finalized })), false);
});

test("a failed replacement write leaves the previous valid slot intact", () => {
  const storage = new MemoryStorage();
  const first = new SuspendedRunStore(storage, { now: () => 10 });
  assert.equal(first.save(snapshot()), true);
  const previous = storage.getItem(SUSPENDED_RUN_KEY);
  storage.setItem = () => { throw new Error("quota"); };

  const replacement = new SuspendedRunStore(storage, { now: () => 20 });
  assert.equal(replacement.save(snapshot({ player: { health: 103 } })), false);
  assert.equal(storage.getItem(SUSPENDED_RUN_KEY), previous);
  assert.equal(replacement.getStatus().storageError, "writeUnavailable");
});

test("clearing suspension is isolated and storage failures never escape", () => {
  const storage = new MemoryStorage({ other: "preserved" });
  const store = new SuspendedRunStore(storage, { now: () => 1 });
  assert.equal(store.save(snapshot()), true);
  assert.equal(store.clear(), true);
  assert.equal(storage.getItem(SUSPENDED_RUN_KEY), null);
  assert.equal(storage.getItem("other"), "preserved");

  const unavailable = new SuspendedRunStore({
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  });
  assert.doesNotThrow(() => unavailable.loadValid());
  assert.equal(unavailable.save(snapshot()), false);
  assert.equal(unavailable.clear(), false);
});
