import assert from "node:assert/strict";
import test from "node:test";
import { CLAIM_CONFIG, SCYTHE_ATTACKS } from "../src/game/gameConfig.js";
import { samplePlayerScytheAnimation, sampleReapersClaimAnimation } from "../src/rendering/playerScytheAnimation.js";

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

function claimSnapshot(phase, elapsed = 0, overrides = {}) {
  const weaponDetached = phase === "outbound" || phase === "recalling";
  return Object.freeze({
    actionId: phase === "idle" ? null : "claim-1",
    phase,
    elapsed,
    origin: Object.freeze({ x: 1, z: 2 }),
    direction: Object.freeze({ x: 1, z: 0 }),
    scythePosition: Object.freeze({ x: 4, z: 6 }),
    weaponDetached,
    ...overrides,
  });
}

function sampleClaim(phase, elapsed = 0, overrides = {}, options = {}) {
  const current = claimSnapshot(phase, elapsed, overrides);
  return sampleReapersClaimAnimation(current, current, 1, options);
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

test("Claim phase boundaries and midpoints seek distinct synchronized body contracts", () => {
  const phases = [
    ["outbound", CLAIM_CONFIG.outbound.duration, "emptyHandFollowThrough", "2H_Melee_Attack_Spinning"],
    ["recalling", CLAIM_CONFIG.recall.duration, "recallTracking", "Idle"],
    ["empoweredWindow", CLAIM_CONFIG.empoweredWindow, "bracedCatch", "Dodge_Forward"],
    ["empoweredCleave", CLAIM_CONFIG.empoweredCleave.duration, "committedCleave", "2H_Melee_Attack_Spinning"],
    ["recovery", CLAIM_CONFIG.recoveryDuration, "settledRecovery", "Idle"],
  ];

  const idle = sampleClaim("idle");
  assert.equal(idle.bodyPose, "idle");
  assert.equal(idle.bodyClip, "Idle");
  assert.equal(idle.phaseProgress, 0);
  assert.equal(idle.weaponState, "held");

  for (const [phase, duration, midpointPose, clip] of phases) {
    const start = sampleClaim(phase, 0);
    const midpoint = sampleClaim(phase, duration / 2);
    const end = sampleClaim(phase, duration);
    closeTo(start.phaseProgress, 0);
    closeTo(midpoint.phaseProgress, 0.5);
    closeTo(end.phaseProgress, 1);
    assert.equal(midpoint.bodyPose, midpointPose);
    assert.equal(midpoint.bodyClip, clip);
    assert.ok(midpoint.bodyClipProgress >= 0 && midpoint.bodyClipProgress <= 1);
  }

  assert.equal(sampleClaim("outbound", 0).bodyPose, "throwAnticipation");
  assert.equal(sampleClaim("outbound", CLAIM_CONFIG.outbound.duration * 0.32).bodyPose, "throwRelease");
  assert.equal(sampleClaim("outbound", CLAIM_CONFIG.outbound.duration * 0.8).bodyPose, "emptyHandFollowThrough");
});

test("Claim weapon ownership follows the authoritative snapshot through recall and catch", () => {
  const outbound = sampleClaim("outbound", CLAIM_CONFIG.outbound.duration / 2);
  const recalling = sampleClaim("recalling", CLAIM_CONFIG.recall.duration / 2);
  const catchStart = sampleClaim("empoweredWindow", 0);
  const catchSettled = sampleClaim("empoweredWindow", CLAIM_CONFIG.empoweredWindow / 2);
  const cleave = sampleClaim("empoweredCleave", CLAIM_CONFIG.empoweredCleave.duration / 2);

  assert.equal(outbound.weaponDetached, true);
  assert.equal(outbound.weaponState, "detached");
  assert.equal(recalling.weaponDetached, true);
  assert.equal(catchStart.weaponDetached, false);
  assert.equal(catchStart.weaponState, "reattaching");
  assert.equal(catchSettled.weaponState, "held");
  assert.equal(cleave.weaponState, "held");
});

test("Claim scythe X/Z interpolates only across matching action and phase continuity", () => {
  const previous = claimSnapshot("outbound", 0.08, { scythePosition: Object.freeze({ x: 2, z: 4 }) });
  const current = claimSnapshot("outbound", 0.16, { scythePosition: Object.freeze({ x: 10, z: 12 }) });
  const interpolated = sampleReapersClaimAnimation(previous, current, 0.25);
  assert.deepEqual(interpolated.weaponPosition, { x: 4, z: 6 });
  assert.equal(interpolated.interpolatedPosition, true);
  closeTo(interpolated.phaseProgress, 0.16 / CLAIM_CONFIG.outbound.duration);

  const differentAction = claimSnapshot("outbound", 0.16, { actionId: "claim-2", scythePosition: Object.freeze({ x: 10, z: 12 }) });
  assert.deepEqual(sampleReapersClaimAnimation(previous, differentAction, 0.25).weaponPosition, { x: 10, z: 12 });
  const differentPhase = claimSnapshot("recalling", 0.04, { scythePosition: Object.freeze({ x: 8, z: 9 }) });
  assert.deepEqual(sampleReapersClaimAnimation(previous, differentPhase, 0.25).weaponPosition, { x: 8, z: 9 });
  assert.deepEqual(sampleReapersClaimAnimation(previous, current, Number.NaN).weaponPosition, { x: 10, z: 12 });
  const invalidPrevious = claimSnapshot("outbound", 0.08, { scythePosition: Object.freeze({ x: Number.NaN, z: 4 }) });
  assert.deepEqual(sampleReapersClaimAnimation(invalidPrevious, current, 0.25).weaponPosition, { x: 10, z: 12 });
});

test("reduced motion scales only secondary weapon motion and preserves body synchronization", () => {
  const elapsed = CLAIM_CONFIG.empoweredCleave.duration / 2;
  const normal = sampleClaim("empoweredCleave", elapsed);
  const reduced = sampleClaim("empoweredCleave", elapsed, {}, { reducedMotion: true, spinningClip: "Spin" });

  assert.equal(reduced.bodyPose, normal.bodyPose);
  assert.equal(reduced.bodyClipProgress, normal.bodyClipProgress);
  assert.equal(reduced.phaseProgress, normal.phaseProgress);
  assert.equal(reduced.bodyYaw, normal.bodyYaw);
  assert.equal(reduced.bodyLean, normal.bodyLean);
  assert.equal(reduced.weaponDetached, normal.weaponDetached);
  assert.deepEqual(reduced.weaponPosition, normal.weaponPosition);
  assert.equal(reduced.bodyClip, "Spin");
  assert.ok(Math.abs(reduced.weaponSpin) < Math.abs(normal.weaponSpin));
  assert.ok(reduced.trailStrength < normal.trailStrength);
});

test("Claim sampling is deterministic, frozen, and never mutates frozen snapshots", () => {
  const previous = claimSnapshot("recalling", 0.1, { scythePosition: Object.freeze({ x: 5, z: 7 }) });
  const current = claimSnapshot("recalling", 0.2, { scythePosition: Object.freeze({ x: 3, z: 2 }) });
  const beforePrevious = structuredClone(previous);
  const beforeCurrent = structuredClone(current);
  const first = sampleReapersClaimAnimation(previous, current, 0.4);
  const second = sampleReapersClaimAnimation(previous, current, 0.4);

  assert.deepEqual(first, second);
  assert.deepEqual(previous, beforePrevious);
  assert.deepEqual(current, beforeCurrent);
  assert.equal(Object.isFrozen(previous), true);
  assert.equal(Object.isFrozen(current), true);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.weaponPosition), true);
});
