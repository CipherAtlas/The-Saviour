import { NARRATIVE_TIMING, PLAYER_CONFIG } from "../game/gameConfig.js";

const HIT_DURATION = Object.freeze({ light: 0.24, heavy: 0.38 });
const HEAL_DURATION = 0.56;
const REVIVE_DURATION = 1.18;
const VICTORY_DURATION = 1.1;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function pulse(progress) {
  return Math.sin(clamp01(progress) * Math.PI);
}

function frozenRotation(x = 0, y = 0, z = 0) {
  return Object.freeze({ x, y, z });
}

function frozenPose(entries = {}) {
  const result = {};
  for (const [name, rotation] of Object.entries(entries ?? {})) {
    result[name] = frozenRotation(rotation.x, rotation.y, rotation.z);
  }
  return Object.freeze(result);
}

function contract({
  state,
  clip = "Idle",
  once = false,
  duration = null,
  progress = 0,
  model = null,
  bones = null,
  clipProgress = null,
}) {
  return Object.freeze({
    state,
    stateKey: state,
    clip,
    once,
    duration,
    progress: clamp01(progress),
    clipProgress: Number.isFinite(clipProgress) ? clamp01(clipProgress) : null,
    model: frozenRotation(model?.x, model?.y, model?.z),
    bones: frozenPose(bones),
  });
}

function attackProgress(combat) {
  return clamp01(combat.attackTime / Math.max(0.001, combat.attack?.duration ?? 1));
}

function attackPhase(combat) {
  const attack = combat.attack;
  if (!attack) return "idle";
  if (combat.attackTime < attack.activeStart) return "windup";
  if (combat.attackTime <= attack.activeEnd) return "active";
  return "recovery";
}

function attackWeight(combat) {
  const attack = combat.attack;
  if (!attack) return 0;
  if (combat.attackTime < attack.activeStart) {
    return smoothstep(combat.attackTime / Math.max(0.001, attack.activeStart));
  }
  if (combat.attackTime <= attack.activeEnd) return 1;
  return 1 - smoothstep(
    (combat.attackTime - attack.activeEnd) / Math.max(0.001, attack.duration - attack.activeEnd),
  );
}

function sampleLightAttack(combat) {
  const index = Math.max(0, Math.min(2, combat.comboIndex));
  const weight = attackWeight(combat);
  const progress = attackProgress(combat);
  const phase = attackPhase(combat);
  const cut = phase === "active" ? Math.sin(
    clamp01((combat.attackTime - combat.attack.activeStart)
      / Math.max(0.001, combat.attack.activeEnd - combat.attack.activeStart)) * Math.PI,
  ) : 0;
  const profiles = [
    { twist: -0.42, lean: 0.12, shoulder: -0.52, offhand: 0.3, stance: 0.08 },
    { twist: 0.48, lean: 0.08, shoulder: 0.34, offhand: -0.46, stance: -0.06 },
    { twist: -0.62, lean: 0.2, shoulder: -0.7, offhand: 0.5, stance: 0.18 },
  ];
  const profile = profiles[index];
  return contract({
    state: `combo-${index + 1}-${phase}`,
    clip: index === 1 ? "2H_Melee_Attack_Spin" : "2H_Melee_Attack_Spinning",
    once: true,
    duration: combat.attack.duration,
    progress,
    model: { x: profile.lean * weight + cut * 0.05, y: 0, z: profile.stance * weight },
    bones: {
      hips: { x: 0, y: -profile.twist * 0.45 * weight, z: 0 },
      spine: { x: -0.08 * weight, y: profile.twist * weight, z: profile.stance * weight },
      chest: { x: -0.06 * weight, y: profile.twist * 0.42 * weight, z: -profile.stance * 0.5 * weight },
      "upperarm.r": { x: profile.shoulder * weight, y: -0.18 * weight, z: 0.16 * weight },
      "lowerarm.r": { x: -0.24 * weight, y: 0, z: -0.12 * weight },
      "upperarm.l": { x: profile.offhand * weight, y: 0.12 * weight, z: -0.16 * weight },
      "upperleg.l": { x: profile.stance * weight, y: 0, z: 0.08 * weight },
      "upperleg.r": { x: -profile.stance * weight, y: 0, z: -0.08 * weight },
    },
  });
}

function sampleDashAttack(combat) {
  const progress = attackProgress(combat);
  const weight = attackWeight(combat);
  const phase = attackPhase(combat);
  const drive = Math.sin(progress * Math.PI);
  return contract({
    state: `dash-strike-${phase}`,
    clip: "Dodge_Forward",
    once: true,
    duration: combat.attack.duration,
    progress,
    model: { x: -0.34 * weight, y: 0, z: 0.12 * drive },
    bones: {
      hips: { x: -0.16 * weight, y: -0.24 * weight, z: 0 },
      spine: { x: -0.38 * weight, y: -0.3 * weight, z: 0.12 * weight },
      chest: { x: 0.08 * weight, y: -0.22 * weight, z: -0.08 * weight },
      "upperarm.r": { x: -0.78 * weight, y: -0.18 * weight, z: 0.18 * weight },
      "upperarm.l": { x: 0.54 * weight, y: 0.24 * weight, z: -0.2 * weight },
      "upperleg.l": { x: 0.42 * drive, y: 0, z: 0.12 * weight },
      "upperleg.r": { x: -0.36 * drive, y: 0, z: -0.12 * weight },
    },
  });
}

function sampleHeavyAttack(combat) {
  const progress = attackProgress(combat);
  const weight = attackWeight(combat);
  const phase = attackPhase(combat);
  const qualityScale = combat.attack?.chargeQuality === "perfect" ? 1.18
    : combat.attack?.chargeQuality === "full" ? 1.08 : 1;
  const orbit = Math.sin(progress * Math.PI * 2);
  return contract({
    state: `charged-reap-${combat.attack?.chargeQuality ?? "partial"}-${phase}`,
    clip: "2H_Melee_Attack_Spinning",
    once: true,
    duration: combat.attack.duration,
    progress,
    model: { x: (0.12 - pulse(progress) * 0.28) * weight, y: 0, z: orbit * 0.08 * weight },
    bones: {
      hips: { x: -0.12 * weight, y: -orbit * 0.34 * weight, z: 0 },
      spine: { x: -0.28 * weight * qualityScale, y: orbit * 0.48 * weight, z: 0 },
      chest: { x: -0.18 * weight, y: orbit * 0.3 * weight, z: 0 },
      "upperarm.r": { x: -0.9 * weight, y: -0.28 * weight, z: 0.22 * weight },
      "upperarm.l": { x: -0.58 * weight, y: 0.18 * weight, z: -0.22 * weight },
      "lowerarm.r": { x: -0.34 * weight, y: 0, z: 0 },
      "lowerarm.l": { x: -0.24 * weight, y: 0, z: 0 },
      "upperleg.l": { x: 0.22 * weight, y: 0, z: 0.16 * weight },
      "upperleg.r": { x: -0.2 * weight, y: 0, z: -0.16 * weight },
    },
  });
}

function sampleDash(combat) {
  const duration = PLAYER_CONFIG.dash.duration;
  const progress = clamp01(combat.dashElapsed / duration);
  const phase = progress < 0.22 ? "start" : progress < 0.78 ? "travel" : "recovery";
  const drive = phase === "start" ? smoothstep(progress / 0.22)
    : phase === "recovery" ? 1 - smoothstep((progress - 0.78) / 0.22) : 1;
  return contract({
    state: `dash-${phase}`,
    clip: "Dodge_Forward",
    once: true,
    duration,
    progress,
    clipProgress: 0.08 + progress * 0.84,
    model: { x: -0.46 * drive, y: 0, z: 0 },
    bones: {
      hips: { x: -0.2 * drive, y: 0, z: 0 },
      spine: { x: -0.32 * drive, y: 0, z: 0 },
      chest: { x: -0.12 * drive, y: 0, z: 0 },
      "upperarm.r": { x: -0.48 * drive, y: -0.2 * drive, z: 0.12 * drive },
      "upperarm.l": { x: 0.36 * drive, y: 0.18 * drive, z: -0.12 * drive },
      "upperleg.l": { x: 0.36 * drive, y: 0, z: 0 },
      "upperleg.r": { x: -0.4 * drive, y: 0, z: 0 },
    },
  });
}

function sampleCharge(combat, clockTime) {
  const ratio = clamp01(combat.heavyCharge / 0.9);
  const settle = smoothstep(Math.min(1, ratio / 0.25));
  const breath = Math.sin(clockTime * (4.2 + ratio * 1.8));
  const phase = ratio < 0.2 ? "start" : ratio < 0.8 ? "loop" : "ready";
  return contract({
    state: `charge-${phase}`,
    clip: "Idle",
    progress: ratio,
    model: { x: 0.08 * settle, y: 0, z: breath * 0.018 * settle },
    bones: {
      hips: { x: 0.12 * settle, y: -0.14 * settle, z: 0 },
      spine: { x: -0.18 * settle, y: -0.22 * settle, z: breath * 0.018 * settle },
      chest: { x: -0.12 * settle, y: -0.08 * settle, z: -breath * 0.014 * settle },
      "upperarm.r": { x: -0.62 * settle, y: -0.18 * settle, z: 0.22 * settle },
      "upperarm.l": { x: -0.28 * settle, y: 0.16 * settle, z: -0.18 * settle },
      "lowerarm.r": { x: -0.38 * settle, y: 0, z: 0 },
      "upperleg.l": { x: 0.18 * settle, y: 0, z: 0.12 * settle },
      "upperleg.r": { x: -0.16 * settle, y: 0, z: -0.12 * settle },
    },
  });
}

function sampleHit(transient, game) {
  const severity = transient.hit.severity;
  const duration = HIT_DURATION[severity] ?? HIT_DURATION.light;
  const progress = clamp01(1 - transient.hit.remaining / duration);
  const recoil = pulse(progress) * (severity === "heavy" ? 1.25 : 0.62);
  const incoming = transient.hit.direction;
  const facing = game.player?.aimAngle ?? 0;
  const rightX = -Math.sin(facing);
  const rightZ = Math.cos(facing);
  const side = Math.max(-1, Math.min(1, incoming.x * rightX + incoming.z * rightZ));
  return contract({
    state: `hit-${severity}-${side < -0.15 ? "left" : side > 0.15 ? "right" : "front"}`,
    clip: "Hit_A",
    once: true,
    duration,
    progress,
    model: { x: 0.24 * recoil, y: 0, z: side * 0.14 * recoil },
    bones: {
      hips: { x: 0.2 * recoil, y: -side * 0.18 * recoil, z: side * 0.08 * recoil },
      spine: { x: 0.34 * recoil, y: -side * 0.34 * recoil, z: side * 0.16 * recoil },
      chest: { x: 0.18 * recoil, y: -side * 0.2 * recoil, z: side * 0.12 * recoil },
      head: { x: -0.12 * recoil, y: side * 0.18 * recoil, z: -side * 0.12 * recoil },
      "upperarm.r": { x: 0.28 * recoil, y: 0, z: 0.22 * recoil },
      "upperarm.l": { x: 0.24 * recoil, y: 0, z: -0.22 * recoil },
    },
  });
}

function sampleHeal(transient) {
  const progress = clamp01(1 - transient.healRemaining / HEAL_DURATION);
  const rise = pulse(progress);
  return contract({
    state: "heal",
    clip: "Idle",
    duration: HEAL_DURATION,
    progress,
    model: { x: -0.06 * rise, y: 0, z: 0 },
    bones: {
      spine: { x: -0.12 * rise, y: 0, z: 0 },
      chest: { x: -0.16 * rise, y: 0, z: 0 },
      head: { x: 0.1 * rise, y: 0, z: 0 },
      "upperarm.r": { x: -0.28 * rise, y: -0.18 * rise, z: 0.16 * rise },
      "upperarm.l": { x: -0.28 * rise, y: 0.18 * rise, z: -0.16 * rise },
    },
  });
}

function sampleRevive(transient) {
  const progress = clamp01(1 - transient.reviveRemaining / REVIVE_DURATION);
  const collapse = 1 - smoothstep(Math.min(1, progress / 0.34));
  const rise = smoothstep(Math.max(0, (progress - 0.28) / 0.72));
  return contract({
    state: progress < 0.34 ? "revive-collapse" : "revive-rise",
    clip: progress < 0.34 ? "Death_A" : "Idle",
    once: progress < 0.34,
    duration: REVIVE_DURATION,
    progress,
    clipProgress: progress < 0.34 ? 0.7 + progress * 0.3 : null,
    model: { x: 0.72 * collapse - 0.12 * rise, y: 0, z: 0.14 * collapse },
    bones: {
      hips: { x: 0.46 * collapse - 0.12 * rise, y: 0, z: 0 },
      spine: { x: 0.62 * collapse - 0.18 * rise, y: 0, z: 0 },
      chest: { x: 0.28 * collapse - 0.12 * rise, y: 0, z: 0 },
      head: { x: 0.24 * collapse - 0.14 * rise, y: 0, z: 0 },
      "upperarm.r": { x: 0.34 * collapse - 0.28 * rise, y: 0, z: 0.2 * rise },
      "upperarm.l": { x: 0.34 * collapse - 0.28 * rise, y: 0, z: -0.2 * rise },
    },
  });
}

function sampleEndingStrike(game) {
  const strike = game.endingStrike;
  const timing = strike?.timing ?? NARRATIVE_TIMING.endingStrike;
  const elapsed = Math.max(0, strike?.elapsed ?? 0);
  const progress = clamp01(elapsed / timing.R);
  const phase = elapsed < timing.T ? "anticipation" : elapsed < timing.C ? "travel" : "recovery";
  const anticipation = elapsed < timing.T ? smoothstep(elapsed / timing.T) : 1;
  const travel = elapsed < timing.T ? 0 : smoothstep((elapsed - timing.T) / Math.max(0.001, timing.C - timing.T));
  const recovery = elapsed < timing.C ? 0 : smoothstep((elapsed - timing.C) / Math.max(0.001, timing.R - timing.C));
  const commitment = Math.max(anticipation * (1 - travel), travel * (1 - recovery));
  return contract({
    state: `ending-strike-${phase}`,
    clip: phase === "travel" ? "2H_Melee_Attack_Spin" : "Idle",
    once: phase === "travel",
    duration: timing.R,
    progress,
    clipProgress: phase === "travel" ? travel : null,
    model: { x: -0.42 * commitment + 0.12 * recovery, y: 0, z: 0.08 * commitment },
    bones: {
      hips: { x: -0.18 * commitment, y: -0.38 * commitment, z: 0 },
      spine: { x: -0.34 * commitment + 0.18 * recovery, y: -0.56 * commitment, z: 0.12 * commitment },
      chest: { x: -0.16 * commitment, y: -0.32 * commitment, z: -0.08 * commitment },
      head: { x: 0.08 * anticipation, y: 0.18 * anticipation, z: 0 },
      "upperarm.r": { x: -0.88 * commitment, y: -0.24 * commitment, z: 0.2 * commitment },
      "upperarm.l": { x: -0.38 * commitment, y: 0.18 * commitment, z: -0.2 * commitment },
      "upperleg.l": { x: 0.36 * commitment, y: 0, z: 0.14 * commitment },
      "upperleg.r": { x: -0.3 * commitment, y: 0, z: -0.14 * commitment },
    },
  });
}

function sampleVictory(transient, aftermath = false) {
  const progress = aftermath ? 1 : clamp01(1 - transient.victoryRemaining / VICTORY_DURATION);
  const settle = aftermath ? 0.55 : smoothstep(progress);
  return contract({
    state: aftermath ? "aftermath" : "victory",
    clip: "Idle",
    duration: aftermath ? null : VICTORY_DURATION,
    progress,
    model: { x: -0.04 * settle, y: 0, z: 0 },
    bones: {
      hips: { x: 0, y: -0.1 * settle, z: 0 },
      spine: { x: -0.12 * settle, y: -0.16 * settle, z: 0 },
      chest: { x: -0.18 * settle, y: -0.08 * settle, z: 0 },
      head: { x: 0.08 * settle, y: 0.12 * settle, z: 0 },
      "upperarm.r": { x: -0.34 * settle, y: -0.12 * settle, z: 0.16 * settle },
      "upperarm.l": { x: 0.18 * settle, y: 0.08 * settle, z: -0.12 * settle },
    },
  });
}

export class PlayerActorPresentation {
  constructor() {
    this.reset();
  }

  reset() {
    this.clockTime = 0;
    this.hit = null;
    this.healRemaining = 0;
    this.reviveRemaining = 0;
    this.victoryRemaining = 0;
  }

  handleEvent(event) {
    const type = event?.type;
    const detail = event?.detail ?? {};
    if (type === "runStarted" || (type === "phaseChanged" && detail.phase === "title")) {
      this.reset();
      return;
    }
    if (type === "playerHit") {
      const severity = detail.severity === "heavy" ? "heavy" : "light";
      this.hit = {
        remaining: HIT_DURATION[severity],
        severity,
        direction: {
          x: Number.isFinite(detail.direction?.x) ? detail.direction.x : 0,
          z: Number.isFinite(detail.direction?.z) ? detail.direction.z : 0,
        },
      };
      return;
    }
    if (type === "playerHealed") this.healRemaining = HEAL_DURATION;
    if (type === "playerRevived") {
      this.hit = null;
      this.healRemaining = 0;
      this.reviveRemaining = REVIVE_DURATION;
    }
    if (type === "endingStrikeCompleted") this.victoryRemaining = VICTORY_DURATION;
  }

  advance(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.clockTime += dt;
    if (this.hit) {
      this.hit.remaining = Math.max(0, this.hit.remaining - dt);
      if (this.hit.remaining <= 0) this.hit = null;
    }
    this.healRemaining = Math.max(0, this.healRemaining - dt);
    this.reviveRemaining = Math.max(0, this.reviveRemaining - dt);
    this.victoryRemaining = Math.max(0, this.victoryRemaining - dt);
  }

  sample(game, dt = 0) {
    this.advance(dt);
    const combat = game?.combat ?? {};
    if (game?.phase === "dead" || game?.flags?.princeKilledByPrincess) {
      return contract({ state: "dead", clip: "Death_A", once: true, duration: 0.9, progress: 1 });
    }
    if (game?.phase === "endingStrike" && game.endingStrike) return sampleEndingStrike(game);
    if (this.reviveRemaining > 0) return sampleRevive(this);
    if (this.hit) return sampleHit(this, game);
    if (combat.attackKind === "dash" && combat.attack) return sampleDashAttack(combat);
    if (combat.attackKind === "heavy" && combat.attack) return sampleHeavyAttack(combat);
    if (combat.attack && combat.comboIndex >= 0) return sampleLightAttack(combat);
    if (combat.isDashing) return sampleDash(combat);
    if (combat.chargingHeavy) return sampleCharge(combat, this.clockTime);
    if (this.healRemaining > 0) return sampleHeal(this);
    if (this.victoryRemaining > 0) return sampleVictory(this, false);
    if (["kill", "fade", "complete"].includes(game?.endingPresentationStage)) return sampleVictory(this, true);
    const moving = game?.player && Math.hypot(
      game.player.position.x - game.player.previousPosition.x,
      game.player.position.z - game.player.previousPosition.z,
    ) > 0.005;
    return contract({
      state: moving ? "run" : "idle",
      clip: moving ? "Running_A" : "Idle",
      duration: moving ? 0.78 : null,
      progress: moving ? this.clockTime % 0.78 / 0.78 : 0,
    });
  }
}

export const PLAYER_ACTOR_PRESENTATION_TIMING = Object.freeze({
  hit: HIT_DURATION,
  heal: HEAL_DURATION,
  revive: REVIVE_DURATION,
  victory: VICTORY_DURATION,
});
