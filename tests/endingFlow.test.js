import assert from "node:assert/strict";
import test from "node:test";
import { EndingSequence } from "../src/game/EndingSequence.js";
import { NARRATIVE_TIMING } from "../src/game/gameConfig.js";
import { endingCorruptionUrgency } from "../src/rendering/GameRenderer.js";

test("kill is accepted strictly before the five-second deadline", () => {
  const ending = new EndingSequence();
  const started = ending.startDecision(0);

  assert.equal(started.stage, "decision");
  assert.equal(started.decision.deadlineMs, 5_000);
  assert.equal(ending.tryKill(4_999).accepted, true);
  assert.deepEqual(ending.snapshot().result, { id: "kill", resolvedAtMs: 4_999 });
});

test("the deadline belongs to timeout", () => {
  const ending = new EndingSequence();
  ending.startDecision(0);

  assert.equal(ending.tryKill(5_000).accepted, false);
  assert.deepEqual(ending.snapshot().result, { id: "timeout", resolvedAtMs: 5_000 });
});

test("stale and repeated input cannot resolve the ending twice", () => {
  const ending = new EndingSequence();
  ending.startDecision(1_000);

  assert.equal(ending.tryKill(900).accepted, false);
  assert.equal(ending.tryKill(1_000).accepted, false);
  assert.equal(ending.snapshot().stage, "decision");
  assert.equal(ending.tryKill(1_001).accepted, true);
  assert.equal(ending.tryKill(1_002).accepted, false);
  assert.deepEqual(ending.snapshot().result, { id: "kill", resolvedAtMs: 1_001 });
});

test("a large frame jump resolves timeout at the exact deadline", () => {
  const ending = new EndingSequence();
  ending.startDecision(10_000);
  ending.update(18_000);

  assert.deepEqual(ending.snapshot().result, { id: "timeout", resolvedAtMs: 15_000 });
  ending.update(20_000);
  assert.equal(ending.tryKill(14_999).accepted, false);
  assert.deepEqual(ending.snapshot().result, { id: "timeout", resolvedAtMs: 15_000 });
});

test("pause freezes remaining time and resume rebuilds the deadline", () => {
  const ending = new EndingSequence();
  ending.startDecision(0);
  const paused = ending.pause(2_000);

  assert.equal(paused.paused, true);
  assert.equal(paused.decision.remainingMs, 3_000);
  ending.update(100_000);
  assert.equal(ending.snapshot().decision.remainingMs, 3_000);

  const resumed = ending.resume(100_000);
  assert.equal(resumed.paused, false);
  assert.equal(resumed.decision.deadlineMs, 103_000);
  ending.update(102_999);
  assert.equal(ending.snapshot().stage, "decision");
  ending.update(103_000);
  assert.deepEqual(ending.snapshot().result, { id: "timeout", resolvedAtMs: 103_000 });
});

test("pausing at expiry resolves timeout instead of preserving time", () => {
  const ending = new EndingSequence();
  ending.startDecision(0);
  ending.pause(5_000);

  assert.equal(ending.snapshot().paused, false);
  assert.deepEqual(ending.snapshot().result, { id: "timeout", resolvedAtMs: 5_000 });
});

test("snapshots expose bounded progress and accelerating urgency", () => {
  const ending = new EndingSequence();
  ending.startDecision(0);
  const halfway = ending.update(2_500);

  assert.equal(halfway.decision.progress, 0.5);
  assert.equal(halfway.decision.urgency, 0.25);
  assert.equal(halfway.decision.remainingMs, 2_500);
});

test("fade completes once and reset restores the inactive state", () => {
  const ending = new EndingSequence();
  ending.startDecision(0);
  ending.tryKill(1_000);
  const fading = ending.startFade(2_000);

  assert.equal(fading.stage, "fading");
  assert.equal(fading.fade.deadlineMs, 2_000 + NARRATIVE_TIMING.fadeDurationMs);
  ending.update(fading.fade.deadlineMs - 1);
  assert.equal(ending.snapshot().stage, "fading");
  ending.update(fading.fade.deadlineMs);
  assert.equal(ending.snapshot().stage, "complete");
  assert.deepEqual(ending.snapshot().result, { id: "kill", resolvedAtMs: 1_000 });
  assert.equal(ending.startFade(fading.fade.deadlineMs + 1).stage, "complete");

  const reset = ending.reset();
  assert.equal(reset.stage, "inactive");
  assert.equal(reset.result, null);
  assert.equal(reset.decision, null);
  assert.equal(reset.fade, null);
});

test("narrative timing defaults are immutable millisecond contracts", () => {
  assert.equal(Object.isFrozen(NARRATIVE_TIMING), true);
  assert.equal(NARRATIVE_TIMING.decisionDurationMs, 5_000);
  assert.ok(NARRATIVE_TIMING.fadeDurationMs > 0);
});

test("corruption urgency clears after a kill and persists through the timeout presentation", () => {
  const game = {
    phase: "endingChoice",
    ending: { snapshot: () => ({ decision: { urgency: 0.81 }, result: null }) },
  };
  assert.equal(endingCorruptionUrgency(game), 0.81);

  game.phase = "dialogue";
  game.ending.snapshot = () => ({ decision: { urgency: 0.81 }, result: { id: "kill" } });
  assert.equal(endingCorruptionUrgency(game), 0);

  game.ending.snapshot = () => ({ decision: { urgency: 1 }, result: { id: "timeout" } });
  assert.equal(endingCorruptionUrgency(game), 1);
  game.phase = "endingFade";
  assert.equal(endingCorruptionUrgency(game), 1);
  game.phase = "endingComplete";
  assert.equal(endingCorruptionUrgency(game), 0);
});
