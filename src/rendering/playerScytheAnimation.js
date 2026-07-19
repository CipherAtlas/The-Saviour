import { CLAIM_CONFIG } from "../game/gameConfig.js";

const PROFILES = Object.freeze({
  light: Object.freeze({ anticipation: 0.26, followThrough: 0.28, scalePulse: 0.035, lift: 0.04 }),
  return: Object.freeze({ anticipation: 0.34, followThrough: 0.34, scalePulse: 0.045, lift: 0.07 }),
  finisher: Object.freeze({ anticipation: 0.48, followThrough: 0.58, scalePulse: 0.085, lift: 0.14 }),
  dash: Object.freeze({ anticipation: 0.22, followThrough: 0.3, scalePulse: 0.05, lift: 0.035 }),
  heavy: Object.freeze({ anticipation: 0.62, followThrough: 0.72, scalePulse: 0.1, lift: 0.08 }),
});

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value) {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
}

function easeOutCubic(value) {
  return 1 - (1 - clamp01(value)) ** 3;
}

function profileFor(attack, attackKind, comboIndex) {
  if (attackKind === "heavy" || attack.name === "Death's Orbit") return PROFILES.heavy;
  if (attackKind === "dash" || attack.name === "Reaping Passage") return PROFILES.dash;
  if (comboIndex === 2 || attack.name === "Harvest Moon") return PROFILES.finisher;
  if (comboIndex === 1 || (attack.swing ?? 1) < 0) return PROFILES.return;
  return PROFILES.light;
}

export function samplePlayerScytheAnimation(attack, attackTime, options = {}) {
  const duration = Math.max(0.001, attack.duration);
  const activeStart = Math.max(0.001, Math.min(duration, attack.activeStart));
  const activeEnd = Math.max(activeStart + 0.001, Math.min(duration, attack.activeEnd));
  const time = clamp01(attackTime / duration) * duration;
  const arc = Math.max(0.001, options.arcOverride ?? attack.arc);
  const swing = Math.sign(attack.swing ?? 1) || 1;
  const profile = profileFor(attack, options.attackKind, options.comboIndex);
  const startAngle = -arc / 2;
  const endAngle = arc / 2;

  if (time < activeStart) {
    const progress = clamp01(time / activeStart);
    const eased = smoothstep(progress);
    return {
      phase: "windup",
      phaseProgress: progress,
      sweepProgress: 0,
      sweepAngle: swing * (startAngle - profile.anticipation * (1 - eased)),
      poseWeight: eased,
      scaleMultiplier: 1 + profile.scalePulse * 0.25 * eased,
      bladeLift: profile.lift * 0.45 * eased,
      trailStrength: 0,
    };
  }

  if (time <= activeEnd) {
    const progress = clamp01((time - activeStart) / Math.max(0.001, activeEnd - activeStart));
    const sweepProgress = easeOutCubic(progress);
    const pulse = Math.sin(progress * Math.PI);
    return {
      phase: "active",
      phaseProgress: progress,
      sweepProgress,
      sweepAngle: swing * (startAngle + arc * sweepProgress),
      poseWeight: 1,
      scaleMultiplier: 1 + profile.scalePulse * (0.35 + pulse * 0.65),
      bladeLift: profile.lift * pulse,
      trailStrength: 0.42 + pulse * 0.58,
    };
  }

  const progress = clamp01((time - activeEnd) / Math.max(0.001, duration - activeEnd));
  const eased = easeOutCubic(progress);
  return {
    phase: "recovery",
    phaseProgress: progress,
    sweepProgress: 1,
    sweepAngle: swing * (endAngle + profile.followThrough * eased),
    poseWeight: 1 - smoothstep(progress),
    scaleMultiplier: 1 + profile.scalePulse * 0.35 * (1 - progress),
    bladeLift: -profile.lift * 0.35 * smoothstep(progress),
    trailStrength: 0.3 * (1 - progress),
  };
}

const CLAIM_PHASES = new Set(["idle", "outbound", "recalling", "empoweredWindow", "empoweredCleave", "recovery"]);

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function claimDuration(phase) {
  if (phase === "outbound") return CLAIM_CONFIG.outbound.duration;
  if (phase === "recalling") return CLAIM_CONFIG.recall.duration;
  if (phase === "empoweredWindow") return CLAIM_CONFIG.empoweredWindow;
  if (phase === "empoweredCleave") return CLAIM_CONFIG.empoweredCleave.duration;
  if (phase === "recovery") return CLAIM_CONFIG.recoveryDuration;
  return 1;
}

function pointFrom(snapshot) {
  const point = snapshot?.scythePosition;
  const origin = snapshot?.origin;
  return {
    x: finite(point?.x, finite(origin?.x, 0)),
    z: finite(point?.z, finite(origin?.z, 0)),
  };
}

function directionFrom(snapshot) {
  const x = finite(snapshot?.direction?.x, 0);
  const z = finite(snapshot?.direction?.z, 1);
  const length = Math.hypot(x, z);
  return length > 0.001 ? { x: x / length, z: z / length } : { x: 0, z: 1 };
}

function claimBodyContract(phase, progress, spinningClip) {
  if (phase === "outbound") {
    if (progress < 0.24) {
      return { bodyPose: "throwAnticipation", bodyClip: spinningClip, bodyClipProgress: progress * 0.72, bodyLean: -0.16, weaponHeight: 1.32, weaponSpin: -0.45, trailStrength: 0 };
    }
    if (progress < 0.44) {
      const release = (progress - 0.24) / 0.2;
      return { bodyPose: "throwRelease", bodyClip: spinningClip, bodyClipProgress: 0.1728 + release * 0.35, bodyLean: 0.24, weaponHeight: 1.46, weaponSpin: Math.PI * (0.4 + release), trailStrength: 0.35 + release * 0.55 };
    }
    const followThrough = (progress - 0.44) / 0.56;
    return { bodyPose: "emptyHandFollowThrough", bodyClip: spinningClip, bodyClipProgress: 0.5228 + followThrough * 0.2, bodyLean: 0.18 * (1 - smoothstep(followThrough)), weaponHeight: 1.2, weaponSpin: Math.PI * (1.4 + followThrough * 1.8), trailStrength: 0.72 * (1 - smoothstep(followThrough)) };
  }
  if (phase === "recalling") {
    return { bodyPose: "recallTracking", bodyClip: "Idle", bodyClipProgress: 0.18 + progress * 0.26, bodyLean: -0.12 - Math.sin(progress * Math.PI) * 0.08, weaponHeight: 1.18 + Math.sin(progress * Math.PI) * 0.18, weaponSpin: Math.PI * (3.2 + progress * 4.5), trailStrength: 0.42 + Math.sin(progress * Math.PI) * 0.38 };
  }
  if (phase === "empoweredWindow") {
    return { bodyPose: "bracedCatch", bodyClip: "Dodge_Forward", bodyClipProgress: 0.42 + progress * 0.18, bodyLean: -0.26 * (1 - smoothstep(progress)), weaponHeight: 1.24, weaponSpin: Math.PI * 0.25 * (1 - progress), trailStrength: 0.2 * (1 - progress) };
  }
  if (phase === "empoweredCleave") {
    const activePulse = Math.sin(progress * Math.PI);
    return { bodyPose: "committedCleave", bodyClip: spinningClip, bodyClipProgress: progress, bodyLean: 0.28 * activePulse, weaponHeight: 1.3 + activePulse * 0.32, weaponSpin: Math.PI * 2.4 * easeOutCubic(progress), trailStrength: 0.36 + activePulse * 0.64 };
  }
  if (phase === "recovery") {
    return { bodyPose: "settledRecovery", bodyClip: "Idle", bodyClipProgress: 0.08 + progress * 0.12, bodyLean: 0.14 * (1 - smoothstep(progress)), weaponHeight: 1.16, weaponSpin: 0.18 * (1 - progress), trailStrength: 0.12 * (1 - progress) };
  }
  return { bodyPose: "idle", bodyClip: "Idle", bodyClipProgress: 0, bodyLean: 0, weaponHeight: 1.16, weaponSpin: 0, trailStrength: 0 };
}

export function sampleReapersClaimAnimation(previousSnapshot, currentSnapshot, alpha, options = {}) {
  const requestedPhase = currentSnapshot?.phase;
  const phase = CLAIM_PHASES.has(requestedPhase) ? requestedPhase : "idle";
  const elapsed = Math.max(0, finite(currentSnapshot?.elapsed, 0));
  const phaseProgress = phase === "idle" ? 0 : clamp01(elapsed / Math.max(0.001, claimDuration(phase)));
  const direction = directionFrom(currentSnapshot);
  const currentPoint = pointFrom(currentSnapshot);
  const previousPoint = pointFrom(previousSnapshot);
  const interpolationSafe = Number.isFinite(alpha)
    && currentSnapshot?.actionId != null
    && previousSnapshot?.actionId === currentSnapshot.actionId
    && previousSnapshot?.phase === currentSnapshot?.phase
    && Number.isFinite(previousSnapshot?.scythePosition?.x)
    && Number.isFinite(previousSnapshot?.scythePosition?.z)
    && Number.isFinite(currentSnapshot?.scythePosition?.x)
    && Number.isFinite(currentSnapshot?.scythePosition?.z);
  const interpolation = interpolationSafe ? clamp01(alpha) : 1;
  const weaponPosition = interpolationSafe
    ? {
        x: previousPoint.x + (currentPoint.x - previousPoint.x) * interpolation,
        z: previousPoint.z + (currentPoint.z - previousPoint.z) * interpolation,
      }
    : currentPoint;
  const spinningClip = options.spinningClip === "Spin" ? "Spin" : "2H_Melee_Attack_Spinning";
  const contract = claimBodyContract(phase, phaseProgress, spinningClip);
  const secondaryScale = options.reducedMotion ? 0.35 : 1;
  const weaponDetached = Boolean(currentSnapshot?.weaponDetached);
  const weaponState = weaponDetached
    ? "detached"
    : phase === "empoweredWindow" && phaseProgress < 0.35 ? "reattaching" : "held";

  return Object.freeze({
    actionId: currentSnapshot?.actionId ?? null,
    phase,
    phaseProgress,
    bodyPose: contract.bodyPose,
    bodyClip: contract.bodyClip,
    bodyClipProgress: clamp01(contract.bodyClipProgress),
    bodyClipLoop: phase === "idle" || phase === "recalling" || phase === "recovery",
    bodyYaw: Math.atan2(direction.z, direction.x),
    bodyLean: contract.bodyLean,
    weaponPosition: Object.freeze(weaponPosition),
    weaponHeight: 1.16 + (contract.weaponHeight - 1.16) * secondaryScale,
    weaponSpin: contract.weaponSpin * secondaryScale,
    trailStrength: clamp01(contract.trailStrength * secondaryScale),
    weaponDetached,
    weaponState,
    interpolatedPosition: interpolationSafe,
  });
}
