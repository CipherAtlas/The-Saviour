import assert from "node:assert/strict";
import test from "node:test";
import { HARVEST_CONFIG } from "../src/game/gameConfig.js";
import { HarvestState } from "../src/game/HarvestState.js";

test("Harvest uses fixed integer units and immutable segmented snapshots", () => {
  const harvest = new HarvestState();
  const result = harvest.gain({ type: "closeHit", eventId: "hit-1" });
  assert.equal(result.accepted, true);
  assert.equal(result.delta, HARVEST_CONFIG.gainUnits.closeHit);
  assert.equal(Number.isInteger(result.snapshot.units), true);
  assert.equal(result.snapshot.filledSegments, 0);
  assert.equal(result.snapshot.segmentProgress, HARVEST_CONFIG.gainUnits.closeHit / 100);
  assert.equal(Object.isFrozen(result.snapshot), true);
});

test("Harvest rejects duplicate events, invalid sources, and cap overflow without mutation", () => {
  const harvest = new HarvestState();
  harvest.gain({ type: "critical", eventId: "same-hit" });
  const duplicate = harvest.gain({ type: "critical", eventId: "same-hit" });
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.reason, "duplicateEvent");
  assert.equal(harvest.gain("unknown", 10).accepted, false);

  for (let index = 0; index < 7; index += 1) {
    assert.equal(harvest.gain({ type: "kill", eventId: `enemy-${index}` }).accepted, true);
  }
  assert.equal(harvest.gain("perfectDash").accepted, true);
  const before = harvest.snapshot().units;
  const overflow = harvest.gain("closeHit");
  assert.equal(overflow.accepted, false);
  assert.equal(overflow.reason, "capOverflow");
  assert.equal(harvest.snapshot().units, before);
});

test("Harvest rejects caller amount overrides and retains configured source values", () => {
  const harvest = new HarvestState();
  const rejected = harvest.gain("kill", HARVEST_CONFIG.gainUnits.kill + 1);
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.reason, "invalidGain");
  assert.equal(harvest.snapshot().units, 0);
  assert.equal(harvest.gain("kill", HARVEST_CONFIG.gainUnits.kill).delta, HARVEST_CONFIG.gainUnits.kill);
});

test("Harvest spends whole segments atomically and grants only an empty floor minimum", () => {
  const harvest = new HarvestState();
  assert.deepEqual(harvest.ensureFloorMinimum(), {
    granted: true,
    delta: 100,
    snapshot: harvest.snapshot(),
  });
  const spend = harvest.trySpend(1, "claim");
  assert.equal(spend.accepted, true);
  assert.equal(spend.delta, -100);
  assert.equal(harvest.trySpend(1, "claim").reason, "insufficientUnits");
  assert.equal(harvest.ensureFloorMinimum().granted, true);
  assert.equal(harvest.ensureFloorMinimum().granted, false);
});

test("resetRun clears units and remembered event IDs", () => {
  const harvest = new HarvestState();
  harvest.gain({ type: "kill", eventId: "enemy-1" });
  harvest.resetRun();
  assert.equal(harvest.snapshot().units, 0);
  assert.equal(harvest.gain({ type: "kill", eventId: "enemy-1" }).accepted, true);
});
