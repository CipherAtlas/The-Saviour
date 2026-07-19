import { HIT_STOP_CONFIG } from "./gameConfig.js";

const EPSILON = 0.000001;

function frozenResult(result, snapshot) {
  return Object.freeze({ ...result, snapshot });
}

export class HitStopClock {
  constructor(config = HIT_STOP_CONFIG) {
    this.config = config;
    this.timeRemaining = 0;
    this.activeTier = null;
  }

  request(duration, tier) {
    if (!Number.isFinite(duration) || duration <= 0) {
      return frozenResult({ accepted: false, reason: "invalidDuration" }, this.snapshot());
    }
    if (!Object.hasOwn(this.config.tiers, tier)) {
      return frozenResult({ accepted: false, reason: "unknownTier" }, this.snapshot());
    }

    const requested = Math.min(duration, this.config.maxDuration);
    const previousRemaining = this.timeRemaining;
    const previousTier = this.activeTier;
    const previousStrength = previousTier === null ? -Infinity : this.config.tiers[previousTier];
    const requestedStrength = this.config.tiers[tier];
    const nextTier = requestedStrength > previousStrength ? tier : previousTier;
    const nextRemaining = Math.min(this.config.maxDuration, Math.max(previousRemaining, requested));
    const tierChanged = nextTier !== previousTier;
    const durationExtended = nextRemaining > previousRemaining + EPSILON;

    if (!tierChanged && !durationExtended) {
      return frozenResult({
        accepted: false,
        reason: "unchanged",
        requested: duration,
        applied: previousRemaining,
      }, this.snapshot());
    }

    this.activeTier = nextTier;
    this.timeRemaining = nextRemaining;
    const reason = previousRemaining <= EPSILON
      ? "started"
      : tierChanged && !durationExtended ? "replaced" : "extended";
    return frozenResult({
      accepted: true,
      reason,
      requested: duration,
      applied: nextRemaining,
      tier: this.activeTier,
      remaining: this.timeRemaining,
    }, this.snapshot());
  }

  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) {
      return frozenResult({ accepted: false, reason: "invalidDelta", elapsed: 0 }, this.snapshot());
    }
    const elapsed = Math.min(dt, this.timeRemaining);
    this.timeRemaining = Math.max(0, this.timeRemaining - elapsed);
    if (this.timeRemaining <= EPSILON) {
      this.timeRemaining = 0;
      this.activeTier = null;
    }
    return frozenResult({ accepted: true, elapsed }, this.snapshot());
  }

  remaining() {
    return this.timeRemaining;
  }

  reset() {
    const previous = this.snapshot();
    this.timeRemaining = 0;
    this.activeTier = null;
    return frozenResult({ accepted: previous.active, previous }, this.snapshot());
  }

  snapshot() {
    return Object.freeze({
      active: this.timeRemaining > 0,
      tier: this.activeTier,
      remaining: this.timeRemaining,
    });
  }
}
