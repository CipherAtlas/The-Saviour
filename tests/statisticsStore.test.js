import assert from "node:assert/strict";
import test from "node:test";
import { RunStatsAccumulator } from "../src/game/RunStatsAccumulator.js";
import {
  STATISTICS_KEY,
  StatisticsStore,
  deriveStatisticsView,
  validateLifetimeStatistics,
} from "../src/settings/StatisticsStore.js";

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
    this.writeCount = 0;
  }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.writeCount += 1; this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

function completedRun({ runId, difficultyId = "standard", ending = "kill", duration = 20 } = {}) {
  const stats = new RunStatsAccumulator({
    runId,
    seed: `${runId}-seed`,
    difficultyId,
  });
  stats.record({ type: "roomReady", detail: { floor: 6 } });
  stats.record({ type: "enemyHit", detail: { hitOrigin: "player", damage: 44, critical: true } });
  stats.record({ type: "enemyDefeated", detail: { type: "wraith", origin: "volatile" } });
  stats.record({ type: "playerHit", detail: { appliedAmount: 12 } });
  stats.record({ type: "playerHealed", detail: { amount: 8 } });
  stats.record({ type: "dash" });
  stats.record({ type: "perfectDash" });
  stats.record({ type: "chargeReleased", detail: { quality: "full" } });
  stats.record({ type: "claimStarted" });
  stats.record({ type: "roomRewardChosen", detail: {
    id: "whetted-crescent", path: "Reaper", rank: 1,
  } });
  stats.record({ type: "bossCombatStarted" });
  stats.sampleTime(duration, "playing", true);
  stats.record({ type: "bossDefeated" });
  return stats.finalize({ completed: true, ending });
}

test("lifetime statistics aggregate finalized runs once and preserve difficulty comparisons", () => {
  const storage = new MemoryStorage();
  const store = new StatisticsStore(storage);
  const first = completedRun({ runId: "run-1", difficultyId: "standard", ending: "kill", duration: 20 });
  const second = completedRun({ runId: "run-2", difficultyId: "relaxed", ending: "timeout", duration: 30 });

  store.recordActivePlaytime(75);
  assert.equal(store.recordCompletedRun(first), true);
  assert.equal(store.recordCompletedRun(first), false);
  assert.equal(store.recordCompletedRun(second), true);
  const value = store.getSnapshot();

  assert.equal(value.totalActivePlaytimeSeconds, 75);
  assert.equal(value.attempts, 2);
  assert.equal(value.completions.standard.kill, 1);
  assert.equal(value.completions.relaxed.timeout, 1);
  assert.equal(value.bestCompletionTimeSeconds.standard, 20);
  assert.equal(value.bestCompletionTimeSeconds.relaxed, 30);
  assert.equal(value.deepestFloor.standard, 6);
  assert.equal(value.kills.byType.wraith, 2);
  assert.equal(value.kills.byOrigin.volatile, 2);
  assert.equal(value.damageDealt, 88);
  assert.equal(value.damageTaken, 24);
  assert.equal(value.healingReceived, 16);
  assert.equal(value.criticalHits, 2);
  assert.equal(value.highestHit, 44);
  assert.equal(value.actions.claims, 2);
  assert.deepEqual(value.boss, { attempts: 2, clears: 2 });
  assert.equal(value.upgradeHistory["whetted-crescent"].selections, 2);
  assert.equal(value.pathHistory.Reaper.runsSelected, 2);
  assert.equal(Object.isFrozen(value), true);
  assert.deepEqual(value.recordedRunIds, ["run-1", "run-2"]);
});

test("records derive favorites and completion rate from primitive aggregates", () => {
  const store = new StatisticsStore(new MemoryStorage());
  store.recordCompletedRun(completedRun({ runId: "derived-1" }));
  const view = deriveStatisticsView(store.getSnapshot());

  assert.equal(view.attempts, 1);
  assert.equal(view.completions, 1);
  assert.equal(view.completionRate, 1);
  assert.equal(view.favoriteMajorAction, "chargedReaps");
  assert.equal(view.mostSelectedUpgrade, "whetted-crescent");
  assert.equal(view.preferredPath, "Reaper");
});

test("invalid storage falls back to an empty local record with a nonblocking status", () => {
  const store = new StatisticsStore(new MemoryStorage({
    [STATISTICS_KEY]: JSON.stringify({ version: 99, attempts: 999 }),
  }));
  assert.equal(store.getSnapshot().attempts, 0);
  assert.equal(store.getStatus().storageError, "invalid");

  const withDiagnostics = structuredClone(new StatisticsStore(new MemoryStorage()).getSnapshot());
  withDiagnostics.timeline = [{ type: "autoplayIntent" }];
  assert.equal(validateLifetimeStatistics(withDiagnostics), null);
});

test("upgrade rank history aggregates final run ranks instead of summing intermediate previews", () => {
  const run = new RunStatsAccumulator({
    runId: "rank-history",
    seed: "RANK-HISTORY",
    difficultyId: "standard",
  });
  run.record({ type: "roomRewardChosen", detail: {
    id: "whetted-crescent", path: "Reaper", rank: 1,
  } });
  run.record({ type: "roomRewardChosen", detail: {
    id: "whetted-crescent", path: "Reaper", rank: 2,
  } });
  const store = new StatisticsStore(new MemoryStorage());
  store.recordCompletedRun(run.finalize({ completed: false, cause: "defeated" }));

  assert.equal(store.getSnapshot().upgradeHistory["whetted-crescent"].selections, 2);
  assert.equal(store.getSnapshot().upgradeHistory["whetted-crescent"].totalRanks, 2);
});

test("reset removes only statistics and write failures preserve valid in-session results", () => {
  const storage = new MemoryStorage({ "hollow-crown-progress": "preserved" });
  const store = new StatisticsStore(storage);
  store.recordCompletedRun(completedRun({ runId: "failure-safe" }));
  storage.setItem = () => { throw new Error("quota"); };
  store.recordActivePlaytime(5);
  assert.equal(store.flush(), false);
  assert.equal(store.getSnapshot().totalActivePlaytimeSeconds, 5);
  assert.equal(store.getStatus().storageError, "writeUnavailable");

  store.reset();
  assert.equal(store.getSnapshot().attempts, 0);
  assert.equal(storage.getItem("hollow-crown-progress"), "preserved");
});
