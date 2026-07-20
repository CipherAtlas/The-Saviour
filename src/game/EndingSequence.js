import { ENDING_TIMING } from "./gameConfig.js";

function requireTimestamp(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be a finite timestamp.`);
  return value;
}

function requireDuration(value, name) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be a non-negative duration.`);
  return value;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function immutableResult(id, resolvedAtMs) {
  return Object.freeze({ id, resolvedAtMs });
}

export class EndingSequence {
  constructor(timing = ENDING_TIMING) {
    this.decisionDurationMs = requireDuration(timing.decisionDurationMs, "decisionDurationMs");
    this.defaultFadeDurationMs = requireDuration(timing.fadeDurationMs, "fadeDurationMs");
    this.reset();
  }

  reset() {
    this.stage = "inactive";
    this.currentTimeMs = null;
    this.decisionStartedAtMs = null;
    this.decisionDeadlineMs = null;
    this.paused = false;
    this.pausedAtMs = null;
    this.pausedRemainingMs = null;
    this.result = null;
    this.fadeStartedAtMs = null;
    this.fadeDeadlineMs = null;
    this.fadeDurationMs = null;
    return this.snapshot();
  }

  startDecision(nowMs) {
    const now = requireTimestamp(nowMs, "nowMs");
    if (this.stage !== "inactive") return this.snapshot();
    this.stage = "decision";
    this.currentTimeMs = now;
    this.decisionStartedAtMs = now;
    this.decisionDeadlineMs = now + this.decisionDurationMs;
    return this.snapshot();
  }

  update(nowMs) {
    const now = this.observeTime(nowMs);
    if (this.stage === "decision" && !this.paused && now >= this.decisionDeadlineMs) {
      this.resolve("timeout", this.decisionDeadlineMs);
    } else if (this.stage === "fading" && now >= this.fadeDeadlineMs) {
      this.stage = "complete";
    }
    return this.snapshot();
  }

  tryKill(inputAtMs) {
    const inputAt = requireTimestamp(inputAtMs, "inputAtMs");
    if (this.stage !== "decision" || this.paused || inputAt <= this.decisionStartedAtMs) {
      return Object.freeze({ accepted: false, snapshot: this.snapshot() });
    }

    this.currentTimeMs = Math.max(this.currentTimeMs, inputAt);
    if (inputAt >= this.decisionDeadlineMs) {
      this.resolve("timeout", this.decisionDeadlineMs);
      return Object.freeze({ accepted: false, snapshot: this.snapshot() });
    }

    this.resolve("kill", inputAt);
    return Object.freeze({ accepted: true, snapshot: this.snapshot() });
  }

  pause(nowMs) {
    const now = this.observeTime(nowMs);
    if (this.stage !== "decision" || this.paused) return this.snapshot();
    if (now >= this.decisionDeadlineMs) {
      this.resolve("timeout", this.decisionDeadlineMs);
      return this.snapshot();
    }

    this.paused = true;
    this.pausedAtMs = now;
    this.pausedRemainingMs = this.decisionDeadlineMs - now;
    return this.snapshot();
  }

  resume(nowMs) {
    const now = this.observeTime(nowMs);
    if (this.stage !== "decision" || !this.paused) return this.snapshot();
    this.decisionDeadlineMs = now + this.pausedRemainingMs;
    this.paused = false;
    this.pausedAtMs = null;
    this.pausedRemainingMs = null;
    return this.snapshot();
  }

  startFade(nowMs, durationMs = this.defaultFadeDurationMs) {
    const now = this.observeTime(nowMs);
    const duration = requireDuration(durationMs, "durationMs");
    if (this.stage !== "resolved") return this.snapshot();

    this.stage = duration === 0 ? "complete" : "fading";
    this.fadeStartedAtMs = now;
    this.fadeDurationMs = duration;
    this.fadeDeadlineMs = now + duration;
    return this.snapshot();
  }

  snapshot() {
    const remainingMs = this.decisionRemainingMs();
    const progress = this.decisionStartedAtMs === null
      ? 0
      : clamp01(1 - remainingMs / Math.max(1, this.decisionDurationMs));
    const fadeProgress = this.fadeStartedAtMs === null
      ? 0
      : this.stage === "complete"
        ? 1
        : clamp01((this.currentTimeMs - this.fadeStartedAtMs) / Math.max(1, this.fadeDurationMs));

    const decision = this.decisionStartedAtMs === null ? null : Object.freeze({
      startedAtMs: this.decisionStartedAtMs,
      deadlineMs: this.decisionDeadlineMs,
      durationMs: this.decisionDurationMs,
      remainingMs,
      progress,
      urgency: progress ** 2,
    });
    const fade = this.fadeStartedAtMs === null ? null : Object.freeze({
      startedAtMs: this.fadeStartedAtMs,
      deadlineMs: this.fadeDeadlineMs,
      durationMs: this.fadeDurationMs,
      progress: fadeProgress,
    });

    return Object.freeze({
      stage: this.stage,
      paused: this.paused,
      decision,
      result: this.result,
      fade,
    });
  }

  observeTime(nowMs) {
    const now = requireTimestamp(nowMs, "nowMs");
    if (this.currentTimeMs !== null && now < this.currentTimeMs) {
      throw new RangeError("EndingSequence timestamps must be monotonic.");
    }
    this.currentTimeMs = now;
    return now;
  }

  decisionRemainingMs() {
    if (this.decisionStartedAtMs === null) return 0;
    if (this.paused) return this.pausedRemainingMs;
    if (this.result?.id === "timeout") return 0;
    if (this.result?.id === "kill") return Math.max(0, this.decisionDeadlineMs - this.result.resolvedAtMs);
    return Math.max(0, this.decisionDeadlineMs - this.currentTimeMs);
  }

  resolve(id, resolvedAtMs) {
    if (this.result) return this.result;
    this.stage = "resolved";
    this.paused = false;
    this.pausedAtMs = null;
    this.pausedRemainingMs = null;
    this.result = immutableResult(id, resolvedAtMs);
    return this.result;
  }
}
