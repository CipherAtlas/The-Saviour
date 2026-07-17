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
