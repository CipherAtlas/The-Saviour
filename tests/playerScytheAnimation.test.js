import assert from "node:assert/strict";
import test from "node:test";
import { SCYTHE_ATTACKS } from "../src/game/gameConfig.js";
import { samplePlayerScytheAnimation } from "../src/rendering/playerScytheAnimation.js";

function closeTo(actual, expected, tolerance = 0.000001) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`);
}

function sample(attack, time, comboIndex) {
  return samplePlayerScytheAnimation(attack, time, { attackKind: "light", comboIndex });
}

function peakAngularSpeed(attack, comboIndex, start, end) {
  const step = 0.001;
  let peak = 0;
  let previous = sample(attack, start, comboIndex).sweepAngle;
  for (let time = start + step; time <= end + 0.000001; time += step) {
    const angle = sample(attack, Math.min(time, end), comboIndex).sweepAngle;
    peak = Math.max(peak, Math.abs(angle - previous) / step);
    previous = angle;
  }
  return peak;
}

test("the physical scythe traverses the exact combat arc in the authored swing direction", () => {
  for (const [comboIndex, attack] of SCYTHE_ATTACKS.entries()) {
    const start = sample(attack, attack.activeStart, comboIndex);
    const end = sample(attack, attack.activeEnd, comboIndex);
    const swing = Math.sign(attack.swing ?? 1) || 1;

    closeTo(start.sweepAngle, swing * -attack.arc / 2);
    closeTo(end.sweepAngle, swing * attack.arc / 2);
    closeTo(end.sweepAngle - start.sweepAngle, swing * attack.arc);
  }

  assert.ok(sample(SCYTHE_ATTACKS[0], SCYTHE_ATTACKS[0].activeEnd, 0).sweepAngle
    > sample(SCYTHE_ATTACKS[0], SCYTHE_ATTACKS[0].activeStart, 0).sweepAngle);
  assert.ok(sample(SCYTHE_ATTACKS[1], SCYTHE_ATTACKS[1].activeEnd, 1).sweepAngle
    < sample(SCYTHE_ATTACKS[1], SCYTHE_ATTACKS[1].activeStart, 1).sweepAngle);
});

test("windup, active cut, and recovery have distinct readable pose contracts", () => {
  const attack = SCYTHE_ATTACKS[0];
  const rest = sample(attack, 0, 0);
  const windup = sample(attack, attack.activeStart * 0.65, 0);
  const cut = sample(attack, (attack.activeStart + attack.activeEnd) / 2, 0);
  const recovery = sample(attack, (attack.activeEnd + attack.duration) / 2, 0);
  const settled = sample(attack, attack.duration, 0);

  assert.equal(rest.phase, "windup");
  assert.equal(rest.poseWeight, 0);
  assert.equal(rest.trailStrength, 0);
  assert.ok(windup.poseWeight > 0 && windup.poseWeight < 1);
  assert.equal(cut.phase, "active");
  assert.equal(cut.poseWeight, 1);
  assert.ok(cut.trailStrength > 0.8);
  assert.equal(recovery.phase, "recovery");
  assert.ok(recovery.poseWeight > 0 && recovery.poseWeight < 1);
  assert.equal(settled.poseWeight, 0);
  assert.equal(settled.trailStrength, 0);
});

test("the cut carries much higher angular velocity than anticipation or recovery", () => {
  for (const [comboIndex, attack] of SCYTHE_ATTACKS.entries()) {
    const windupPeak = peakAngularSpeed(attack, comboIndex, 0, attack.activeStart);
    const activePeak = peakAngularSpeed(attack, comboIndex, attack.activeStart, attack.activeEnd);
    const recoveryPeak = peakAngularSpeed(attack, comboIndex, attack.activeEnd, attack.duration);
    assert.ok(activePeak > windupPeak * 3, `${attack.name} needs a decisive acceleration into active frames`);
    assert.ok(activePeak > recoveryPeak * 2, `${attack.name} needs a slower follow-through than its cut`);
  }
});

test("the finisher has stronger anticipation, overshoot, and scale emphasis", () => {
  const first = SCYTHE_ATTACKS[0];
  const finisher = SCYTHE_ATTACKS[2];
  const firstStart = sample(first, 0, 0);
  const finisherStart = sample(finisher, 0, 2);
  const firstEnd = sample(first, first.duration, 0);
  const finisherEnd = sample(finisher, finisher.duration, 2);
  const firstMid = sample(first, (first.activeStart + first.activeEnd) / 2, 0);
  const finisherMid = sample(finisher, (finisher.activeStart + finisher.activeEnd) / 2, 2);

  assert.ok(Math.abs(finisherStart.sweepAngle) - finisher.arc / 2
    > Math.abs(firstStart.sweepAngle) - first.arc / 2);
  assert.ok(Math.abs(finisherEnd.sweepAngle) - finisher.arc / 2
    > Math.abs(firstEnd.sweepAngle) - first.arc / 2);
  assert.ok(finisherMid.scaleMultiplier > firstMid.scaleMultiplier);
  assert.ok(finisherMid.bladeLift > firstMid.bladeLift);
});

test("an assisted ground arc uses the same sampler without changing combat data", () => {
  const attack = SCYTHE_ATTACKS[0];
  const originalArc = attack.arc;
  const assistedArc = attack.arc + 0.2;
  const start = samplePlayerScytheAnimation(attack, attack.activeStart, {
    attackKind: "light",
    comboIndex: 0,
    arcOverride: assistedArc,
  });
  const end = samplePlayerScytheAnimation(attack, attack.activeEnd, {
    attackKind: "light",
    comboIndex: 0,
    arcOverride: assistedArc,
  });

  closeTo(start.sweepAngle, -assistedArc / 2);
  closeTo(end.sweepAngle, assistedArc / 2);
  closeTo(attack.arc, originalArc);
});
