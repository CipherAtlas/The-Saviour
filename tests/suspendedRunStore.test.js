import assert from "node:assert/strict";
import test from "node:test";
import { BLESSINGS, chooseBlessings, oathSlotOrderForSeed } from "../src/game/blessings.js";
import { applyProgressionChoice } from "../src/game/progressionModel.js";
import { RunStatsAccumulator } from "../src/game/RunStatsAccumulator.js";
import { SeededRandom } from "../src/generation/seededRandom.js";
import {
  SUSPENDED_RUN_KEY,
  SUSPENDED_RUN_VERSION,
  SuspendedRunStore,
  validateSuspendedRunSnapshot,
} from "../src/settings/SuspendedRunStore.js";

class MemoryStorage {
  constructor(initial = {}) { this.values = new Map(Object.entries(initial)); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

function playerState() {
  return {
    health: 140,
    maxHealth: 140,
    damageMultiplier: 1,
    reachMultiplier: 1,
    dashCooldownMultiplier: 1,
    criticalChance: 0.05,
    modifierRanks: {},
  };
}

function progressionFor(seed, count) {
  const ranks = new Map();
  const owned = new Set();
  const player = playerState();
  const slotOrder = oathSlotOrderForSeed(seed);
  const selections = [];
  for (let floor = 1; floor <= count; floor += 1) {
    const choice = chooseBlessings(
      new SeededRandom(`${seed}:blessing-${floor}`), ranks, 3, player,
      { floor, ownedOathIds: owned, slotOrder },
    )[0];
    const result = applyProgressionChoice(choice, player, ranks);
    owned.add(choice.id);
    selections.push(result);
  }
  return selections;
}

function snapshot({
  seed = "SUSPEND-OATH",
  difficultyId = "standard",
  runType = "normal",
  nextFloor = 1,
  nextRoom = 1,
} = {}) {
  const statistics = new RunStatsAccumulator({
    runId: `run:${seed}`,
    seed,
    difficultyId,
    startedAt: 10,
  });
  const selections = progressionFor(seed, nextFloor - 1);
  for (const selection of selections) statistics.record({ type: "blessingChosen", detail: selection });
  return {
    seed,
    difficultyId,
    runType,
    speedrun: runType === "speedrun"
      ? { elapsedSeconds: 12.5, finished: false }
      : { elapsedSeconds: 0, finished: false },
    nextFloor,
    nextRoom,
    player: { health: 100 },
    harvestUnits: 100,
    deathDefiance: { granted: 0, remaining: 0 },
    blessingIds: selections.map(({ id }) => id),
    runFlags: {},
    statisticsDraft: statistics.snapshotDraft(),
  };
}

test("version-five suspends preserve only legal Oath progression immutably", () => {
  const storage = new MemoryStorage();
  const store = new SuspendedRunStore(storage, { now: () => 123_456 });
  assert.equal(store.save(snapshot({ nextFloor: 7, nextRoom: 2 })), true);
  const loaded = store.loadValid();

  assert.equal(loaded.version, SUSPENDED_RUN_VERSION);
  assert.equal(loaded.savedAt, 123_456);
  assert.equal(loaded.blessingIds.length, 6);
  assert.deepEqual(Object.keys(loaded), [
    "version", "savedAt", "seed", "difficultyId", "runType", "speedrun", "nextFloor", "nextRoom",
    "player", "harvestUnits", "deathDefiance", "blessingIds", "runFlags", "statisticsDraft",
  ]);
  assert.equal(Object.isFrozen(loaded), true);
  assert.equal(Object.isFrozen(loaded.blessingIds), true);
});

test("version-four suspends keep Oath intent while discarding removed chamber systems", () => {
  const base = snapshot({ seed: "LEGACY-V4", nextFloor: 2 });
  const legacy = {
    ...base,
    version: 4,
    savedAt: 99,
    upgradeSelections: [{ upgradeId: "whetted-crescent", rankAfter: 1 }],
    upgradeRanks: [["whetted-crescent", 1]],
    rerollsUsedByFloor: [1, ...Array(9).fill(0)],
  };
  const storage = new MemoryStorage({ [SUSPENDED_RUN_KEY]: JSON.stringify(legacy) });
  const loaded = new SuspendedRunStore(storage).loadValid();

  assert.equal(loaded.version, 5);
  assert.equal("upgradeSelections" in loaded, false);
  assert.equal("upgradeRanks" in loaded, false);
  assert.equal("rerollsUsedByFloor" in loaded, false);
  assert.equal(loaded.statisticsDraft.rerollsUsed, 0);
  assert.deepEqual(loaded.statisticsDraft.selections.map(({ id }) => id), loaded.blessingIds);
});

test("legacy named blessings migrate by path into the seed-derived technique slot", () => {
  const base = snapshot({ seed: "LEGACY-NAMED", nextFloor: 2 });
  const legacy = {
    ...base,
    version: 3,
    savedAt: 99,
    blessingIds: ["far-reach"],
    upgradeSelections: [],
    upgradeRanks: [],
    rerollsUsedByFloor: Array(10).fill(0),
  };
  const storage = new MemoryStorage({ [SUSPENDED_RUN_KEY]: JSON.stringify(legacy) });
  const loaded = new SuspendedRunStore(storage).loadValid();
  const oath = BLESSINGS.find(({ id }) => id === loaded.blessingIds[0]);

  assert.equal(oath.path, "Reaper");
  assert.equal(oath.techniqueSlot, oathSlotOrderForSeed(legacy.seed)[0]);
});

test("unknown, mistimed, and effect-bearing snapshots fail closed", () => {
  const unknown = snapshot({ nextFloor: 2 });
  unknown.blessingIds[0] = "not-an-oath";
  assert.equal(validateSuspendedRunSnapshot({ ...unknown, version: 5, savedAt: 1 }), null);

  const missing = snapshot({ nextFloor: 3 });
  missing.blessingIds.pop();
  assert.equal(validateSuspendedRunSnapshot({ ...missing, version: 5, savedAt: 1 }), null);

  const defiance = snapshot();
  defiance.deathDefiance = { granted: 1, remaining: 1 };
  assert.equal(validateSuspendedRunSnapshot({ ...defiance, version: 5, savedAt: 1 }), null);
});

test("invalid stored data is removed and storage failures are contained", () => {
  const storage = new MemoryStorage({ [SUSPENDED_RUN_KEY]: "not-json" });
  const store = new SuspendedRunStore(storage);
  assert.equal(store.loadValid(), null);
  assert.equal(storage.getItem(SUSPENDED_RUN_KEY), null);
  assert.equal(store.getStatus().storageError, "invalid");

  const unavailable = new SuspendedRunStore({
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  });
  assert.equal(unavailable.loadValid(), null);
  assert.equal(unavailable.getStatus().storageError, "readUnavailable");
  assert.equal(unavailable.save(snapshot()), false);
  assert.equal(unavailable.getStatus().storageError, "writeUnavailable");
});
