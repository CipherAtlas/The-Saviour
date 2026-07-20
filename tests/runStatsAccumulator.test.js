import assert from "node:assert/strict";
import test from "node:test";
import {
  RunStatsAccumulator,
  validateRunStatistics,
  validateRunStatisticsDraft,
} from "../src/game/RunStatsAccumulator.js";

function event(type, detail = {}) {
  return { type, detail };
}

test("run statistics consume canonical combat, progression, origin, and terminal events", () => {
  const stats = new RunStatsAccumulator({
    runId: "run-standard-001",
    seed: "STATS-SEED",
    difficultyId: "standard",
    startedAt: 100,
  });

  stats.record(event("roomReady", { floor: 7 }));
  stats.record(event("roomCleared", { floor: 7, room: 2 }));
  stats.record(event("enemyHit", { hitOrigin: "player", damage: 42, critical: true }));
  stats.record(event("enemyHit", { hitOrigin: "stable", damage: 900, critical: true }));
  stats.record(event("enemyDefeated", { type: "wraith", origin: "volatile" }));
  stats.record(event("playerHit", { amount: 99, appliedAmount: 17 }));
  stats.record(event("playerHealed", { amount: 12 }));
  stats.record(event("dash"));
  stats.record(event("perfectDash"));
  stats.record(event("chargeReleased", { quality: "perfect" }));
  stats.record(event("claimStarted"));
  stats.record(event("harvestChanged", { delta: 28 }));
  stats.record(event("harvestChanged", { delta: -100 }));
  stats.record(event("deathDefianceGranted", { amount: 1 }));
  stats.record(event("playerRevived"));
  stats.record(event("blessingChosen", {
    id: "falling-moon", path: "Reaper", rank: 1,
  }));
  stats.record(event("blessingChosen", {
    id: "falling-moon", path: "Reaper", rank: 2,
  }));
  stats.record(event("blessingChosen", {
    id: "ghost-cadence", path: "Shade", rank: 1,
  }));

  stats.sampleTime(10, "playing", true);
  stats.sampleTime(5, "bookend", true);
  stats.sampleTime(2, "roomLoading", true);
  stats.sampleTime(8, "paused", true);
  stats.sampleTime(8, "playing", false);
  stats.record(event("bossCombatStarted"));
  stats.sampleTime(4, "playing", true);
  stats.record(event("enemyDefeated", { type: "queen", origin: "stable" }));

  const result = stats.finalize(event("runEnded", {
    completed: true,
    victory: true,
    ending: "kill",
  }));

  assert.deepEqual(validateRunStatistics(result), result);
  assert.deepEqual(result.terminal, { kind: "ending", id: "kill" });
  assert.equal(result.deepestFloor, 7);
  assert.equal(result.roomsCleared, 1);
  assert.deepEqual(result.enemiesKilled, {
    byType: { wraith: 1, queen: 1 },
    byOrigin: { volatile: 1, stable: 1 },
  });
  assert.equal(result.damageDealt, 42);
  assert.equal(result.damageTaken, 17);
  assert.equal(result.healingReceived, 12);
  assert.equal(result.criticalHits, 1);
  assert.equal(result.highestHit, 42);
  assert.deepEqual(result.actions, {
    dashes: 1,
    perfectDashes: 1,
    chargedReaps: 1,
    perfectReleases: 1,
    claims: 1,
  });
  assert.deepEqual(result.harvest, { generated: 28, spent: 100 });
  assert.deepEqual(result.deathDefiance, { granted: 1, consumed: 1 });
  assert.deepEqual(result.finalRanks, { "falling-moon": 2, "ghost-cadence": 1 });
  assert.deepEqual(result.pathTotals, { Reaper: 2, Shade: 1, Grave: 0 });
  assert.equal(result.rerollsUsed, 0);
  assert.equal(result.durationSeconds, 19);
  assert.equal(result.combatSeconds, 14);
  assert.equal(result.activePlaytimeSeconds, 21);
  assert.deepEqual(result.boss, {
    attempted: true,
    active: false,
    activeSeconds: 4,
    cleared: true,
    clearTimeSeconds: 4,
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.actions), true);
});

test("drafts round-trip for suspension while finalized runs reject resume and duplicate finalize", () => {
  const stats = new RunStatsAccumulator({
    runId: "run-relaxed-001",
    seed: "RESUME-SEED",
    difficultyId: "relaxed",
  });
  stats.record(event("dash"));
  stats.sampleTime(2.5, "playing", true);
  const draft = stats.snapshotDraft();

  assert.deepEqual(validateRunStatisticsDraft(draft), draft);
  const resumed = RunStatsAccumulator.fromDraft(draft);
  resumed.sampleTime(1.5, "bookend", true);
  const result = resumed.finalize({ completed: false, cause: "boneguard" });
  assert.deepEqual(result.terminal, { kind: "death", cause: "boneguard" });
  assert.equal(result.durationSeconds, 4);
  assert.throws(() => resumed.finalize({ completed: false }), /already been finalized/);
  assert.throws(() => RunStatsAccumulator.fromDraft(result), /Invalid resumable/);
});

test("validation rejects contradictory counters and invalid terminal data", () => {
  const stats = new RunStatsAccumulator({
    runId: "run-ruthless-001",
    seed: "INVALID-SEED",
    difficultyId: "ruthless",
  });
  stats.record(event("dash"));
  const draft = structuredClone(stats.snapshotDraft());
  draft.actions.perfectDashes = 2;
  assert.equal(validateRunStatisticsDraft(draft), null);

  const mismatchedProgression = structuredClone(stats.snapshotDraft());
  mismatchedProgression.finalRanks["invented-rank"] = 1;
  assert.equal(validateRunStatisticsDraft(mismatchedProgression), null);

  assert.throws(
    () => stats.finalize({ completed: true, ending: "secret" }),
    /kill or timeout/,
  );
});
