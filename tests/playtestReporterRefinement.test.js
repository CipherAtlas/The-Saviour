import assert from "node:assert/strict";
import test from "node:test";
import { PlaytestReporter } from "../src/playtest/PlaytestReporter.js";

test("refinement diagnostics retain encounter, emergence, navigation, geometry, and peak data", () => {
  const reporter = new PlaytestReporter();
  reporter.beginRun({ seed: "DIAGNOSTIC-SEED", difficulty: "ruthless" });
  reporter.recordEvent({ type: "runStarted", detail: { seed: "DIAGNOSTIC-SEED", buildProfile: "damage" } });
  reporter.recordEvent({
    type: "arenaChanged",
    detail: {
      floor: 8,
      room: 3,
      arena: {
        layoutFamily: "lShape",
        walkableArea: 812,
        connectorWidths: [8, 10],
        objectiveReachable: true,
        escapeRoutesValid: true,
      },
    },
  });
  reporter.recordEvent({
    type: "encounterStarted",
    detail: {
      recipe: {
        id: "late-hybrid",
        type: "hybrid",
        totalPopulation: 6,
        threat: 11.5,
        roles: { frontline: 3, mobile: 1, ranged: 1, area: 1 },
        originCounts: { stable: 4, volatile: 2 },
      },
    },
  });
  reporter.sample({
    dt: 0,
    state: { floor: 8, room: 3, player: { position: { x: 0, z: 0 }, health: 120, maxHealth: 120 }, enemies: [] },
  });
  reporter.recordEvent({
    type: "encounterBatchTriggered",
    detail: {
      batchId: "surge",
      batchIndex: 1,
      triggerType: "remaining",
      triggerTimestamp: 1.25,
      spawnMode: "streamed",
      entries: [{ type: "hexer" }, { type: "bombardier" }],
    },
  }, 1.25);
  reporter.recordEvent({
    type: "enemyEmergenceStarted",
    detail: {
      enemyId: "e1", type: "hexer", role: "ranged", origin: "stable", threat: 1.75,
      position: { x: 0.6, z: 0 }, durationSeconds: 0.56,
    },
  });
  reporter.recordEvent({
    type: "enemyEmergenceStarted",
    detail: {
      enemyId: "e2", type: "bombardier", role: "area", origin: "volatile", threat: 2.25,
      position: { x: 4, z: 0 }, durationSeconds: 0.56,
    },
  });
  reporter.recordEvent({ type: "enemyEmergenceCompleted", detail: { enemyId: "e1", durationSeconds: 0.56 } }, 1.81);
  reporter.recordEvent({ type: "enemyEmergenceCompleted", detail: { enemyId: "e2", durationSeconds: 0.56 } }, 2.01);
  reporter.recordEvent({ type: "attackLeaseGranted", detail: { leaseId: "a1", enemyId: "e1", family: "ranged" } });
  reporter.recordEvent({ type: "attackLeaseGranted", detail: { leaseId: "a2", enemyId: "e2", family: "area" } });
  reporter.recordEvent({ type: "attackLeaseDenied", detail: { enemyId: "e3", family: "area", reason: "familyBudget" } });
  reporter.recordEvent({ type: "attackLeaseReleased", detail: { leaseId: "a2" } });
  reporter.sample({
    dt: 1,
    state: {
      floor: 8,
      room: 3,
      phase: "playing",
      encounter: { totalPopulation: 6, pending: 4 },
      player: { position: { x: 1, z: 0 }, health: 110, maxHealth: 120 },
      enemies: [
        { id: "e1", type: "hexer", active: true, position: { x: 2, z: 0 }, attackLeaseFamily: "ranged" },
        { id: "e2", type: "bombardier", active: true, position: { x: 4, z: 1 }, pursuitIdle: true },
      ],
    },
    performance: {
      fps: 66, frameMs: 18, cpuMs: 7, gpuMs: 9, drawCalls: 88, triangles: 145000,
      activeTelegraphs: 4, activeActors: 15, damageNumberCount: 12,
    },
  });
  reporter.sample({
    dt: 1,
    state: {
      floor: 8,
      room: 3,
      phase: "playing",
      player: { position: { x: 2, z: 0 }, health: 110, maxHealth: 120 },
      enemies: [
        { id: "e1", type: "hexer", active: true, position: { x: 3, z: 0 } },
        { id: "e2", type: "bombardier", active: true, position: { x: 4, z: 2 } },
      ],
    },
  });
  reporter.recordDiagnostic({ type: "navigationUnreachable", actor: "enemy", region: "east-lobe" });
  reporter.recordDiagnostic({ type: "pursuitIdle", seconds: 0.25 });
  reporter.recordDiagnostic({ type: "emergenceInteractionViolation", enemyId: "e2", action: "lease" });
  reporter.recordEvent({ type: "roomCleared", detail: { floor: 8, room: 3 } }, 40);

  const report = reporter.finalize();
  const room = report.progression.rooms[0];
  assert.equal(room.layoutFamily, "lShape");
  assert.equal(room.recipeType, "hybrid");
  assert.equal(room.buildProfile, "damage");
  assert.equal(room.population.total, 6);
  assert.equal(room.population.maximumSpawning, 2);
  assert.equal(room.population.maximumLiving, 2);
  assert.equal(room.batchTriggers[0].triggerType, "remaining");
  assert.equal(room.batchTriggers[0].timestamp, 1.25);
  assert.deepEqual(room.roster.origins, { stable: 4, volatile: 2 });
  assert.deepEqual(room.roster.specialistMaxima, { hexer: 1, bombardier: 1 });
  assert.equal(report.encounters.emergence.durationSeconds, 0.56);
  assert.equal(report.encounters.emergence.minimumSpawnDistance, 0.6);
  assert.equal(report.encounters.emergence.interactionLockViolations, 1);
  assert.equal(report.encounters.attackLeases.grantedByFamily.ranged, 1);
  assert.equal(report.encounters.attackLeases.deniedByFamily.area, 1);
  assert.equal(report.encounters.attackLeases.peakActiveTotal, 2);
  assert.equal(report.navigation.enemyDistanceTravelled, 2);
  assert.equal(report.navigation.pursuitIdleSeconds, 1.25);
  assert.equal(report.navigation.unreachablePathEvents, 1);
  assert.deepEqual(report.encounters.geometry.walkableAreaByRoom, { "8-3": 812 });
  assert.equal(report.encounters.geometry.minimumConnectorWidth, 8);
  assert.equal(report.performance.frameTimePeakMs, 18);
  assert.equal(report.performance.telegraphsPeak, 4);
  assert.equal(report.performance.actorsPeak, 15);
  assert.equal(report.performance.damageNumbersPeak, 12);
  assert.doesNotThrow(() => JSON.parse(reporter.serialize()));
});

test("room pacing uses distinct early, middle, and late target bands", () => {
  const reporter = new PlaytestReporter();
  reporter.recordEvent({ type: "arenaChanged", detail: { floor: 1, room: 1 } }, 0);
  reporter.recordEvent({ type: "roomCleared", detail: { floor: 1, room: 1 } }, 7);
  reporter.recordEvent({ type: "arenaChanged", detail: { floor: 4, room: 1 } }, 8);
  reporter.recordEvent({ type: "roomCleared", detail: { floor: 4, room: 1 } }, 75);
  reporter.recordEvent({ type: "arenaChanged", detail: { floor: 8, room: 1 } }, 76);
  reporter.recordEvent({ type: "roomCleared", detail: { floor: 8, room: 1 } }, 160);

  const pacing = reporter.finalize().pacing;
  assert.deepEqual(pacing.targetsByBand, {
    early: { min: 8, max: 61 },
    middle: { min: 10, max: 72 },
    late: { min: 12, max: 83 },
  });
  assert.deepEqual(pacing.roomsTooFast, ["1-1"]);
  assert.deepEqual(pacing.roomsTooSlow, ["8-1"]);
  assert.deepEqual(pacing.roomTargets.map(({ band }) => band), ["early", "middle", "late"]);
});

test("scoped director diagnostics emitted before arenaChanged attach to the incoming room", () => {
  const reporter = new PlaytestReporter();
  reporter.recordEvent({
    type: "encounterStarted",
    detail: { floor: 4, room: 2, recipeId: "queued-pressure", recipeType: "populationPressure", totalPopulation: 9 },
  });
  reporter.recordEvent({
    type: "encounterBatchTriggered",
    detail: { floor: 4, room: 2, batchId: "initial", triggerType: "initial", triggerTimestamp: 0 },
  });
  reporter.recordEvent({
    type: "enemyEmergenceStarted",
    detail: { floor: 4, room: 2, enemyId: "queued-1", type: "thrall", durationSeconds: 0.56 },
  });
  reporter.recordEvent({ type: "arenaChanged", detail: { floor: 4, room: 2, arena: { layoutFamily: "tShape" } } });

  const room = reporter.finalize().progression.rooms[0];
  assert.equal(room.recipeType, "populationPressure");
  assert.equal(room.population.total, 9);
  assert.equal(room.population.spawning, 1);
  assert.equal(room.batchTriggers[0].triggerType, "initial");
  assert.equal(room.layoutFamily, "tShape");
});
