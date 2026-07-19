import assert from "node:assert/strict";
import test from "node:test";
import { HIT_STOP_CONFIG } from "../src/game/gameConfig.js";
import { HitStopClock } from "../src/game/HitStopClock.js";

test("hit-stop policies and clock state are immutable and globally capped", () => {
  assert.equal(Object.isFrozen(HIT_STOP_CONFIG), true);
  assert.equal(Object.isFrozen(HIT_STOP_CONFIG.tiers), true);
  assert.equal(Object.isFrozen(HIT_STOP_CONFIG.policies), true);
  for (const policy of Object.values(HIT_STOP_CONFIG.policies)) assert.equal(Object.isFrozen(policy), true);

  const clock = new HitStopClock();
  const capped = clock.request(HIT_STOP_CONFIG.maxDuration * 4, "light");
  assert.equal(capped.accepted, true);
  assert.equal(capped.remaining, HIT_STOP_CONFIG.maxDuration);
  assert.equal(clock.remaining(), HIT_STOP_CONFIG.maxDuration);
  assert.equal(Object.isFrozen(capped), true);
  assert.equal(Object.isFrozen(capped.snapshot), true);
});

test("invalid, nonpositive, and unknown requests reject without mutation", () => {
  const clock = new HitStopClock();
  for (const [duration, tier, reason] of [
    [0, "light", "invalidDuration"],
    [-1, "light", "invalidDuration"],
    [Number.NaN, "light", "invalidDuration"],
    [0.05, "unknown", "unknownTier"],
  ]) {
    const result = clock.request(duration, tier);
    assert.equal(result.accepted, false);
    assert.equal(result.reason, reason);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(clock.remaining(), 0);
  }
});

test("concurrent requests retain the strongest tier and longest duration without summing", () => {
  const clock = new HitStopClock();
  clock.request(0.05, "medium");
  const stronger = clock.request(0.02, "heavy");
  assert.equal(stronger.accepted, true);
  assert.equal(stronger.tier, "heavy");
  assert.equal(stronger.remaining, 0.05);

  const longer = clock.request(0.08, "light");
  assert.equal(longer.accepted, true);
  assert.equal(longer.tier, "heavy");
  assert.equal(longer.remaining, 0.08);
  const unchanged = clock.request(0.03, "medium");
  assert.equal(unchanged.accepted, false);
  assert.equal(unchanged.reason, "unchanged");
  assert.equal(clock.remaining(), 0.08);
});

test("fixed updates consume only the impact clock and reset returns frozen empty state", () => {
  const clock = new HitStopClock();
  clock.request(0.05, "medium");
  const update = clock.update(0.02);
  assert.equal(update.accepted, true);
  assert.equal(update.elapsed, 0.02);
  assert.ok(Math.abs(clock.remaining() - 0.03) < 0.000001);
  assert.equal(Object.isFrozen(update), true);
  assert.equal(Object.isFrozen(update.snapshot), true);

  const invalid = clock.update(0);
  assert.equal(invalid.accepted, false);
  assert.ok(Math.abs(clock.remaining() - 0.03) < 0.000001);
  const reset = clock.reset();
  assert.equal(reset.accepted, true);
  assert.equal(reset.previous.active, true);
  assert.equal(clock.remaining(), 0);
  assert.deepEqual(clock.snapshot(), { active: false, tier: null, remaining: 0 });
  assert.equal(Object.isFrozen(reset), true);
  assert.equal(Object.isFrozen(reset.previous), true);
  assert.equal(Object.isFrozen(reset.snapshot), true);
});
