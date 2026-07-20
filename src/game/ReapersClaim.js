import { CLAIM_CONFIG } from "./gameConfig.js";

const ACTIVE_PHASES = new Set(["outbound", "recalling", "empoweredWindow", "empoweredCleave", "recovery"]);
const COLLISION_CONTINUES = Object.freeze({ ownershipChanged: false, terminatePass: false });
const COLLISION_TERMINATED = Object.freeze({ ownershipChanged: false, terminatePass: true });
const COLLISION_OWNERSHIP_CHANGED = Object.freeze({ ownershipChanged: true, terminatePass: true });

function finitePoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.z);
}

function frozenPoint(point) {
  return Object.freeze({ x: point.x, z: point.z });
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function outboundTravelProgress(elapsed, config = CLAIM_CONFIG) {
  const travelDuration = config.outbound.duration - config.outbound.releaseAt;
  return clamp01((elapsed - config.outbound.releaseAt) / travelDuration);
}

function resolvedClaimConfig(overrides = {}) {
  return Object.freeze({
    ...CLAIM_CONFIG,
    ...overrides,
    outbound: Object.freeze({ ...CLAIM_CONFIG.outbound, ...overrides.outbound }),
    recall: Object.freeze({ ...CLAIM_CONFIG.recall, ...overrides.recall }),
    empoweredCleave: Object.freeze({ ...CLAIM_CONFIG.empoweredCleave, ...overrides.empoweredCleave }),
  });
}

function immutableValue(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return Object.freeze(value.map(immutableValue));
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, immutableValue(entry)])));
}

function immutableEvent(type, detail) {
  return Object.freeze({ type, detail: immutableValue(detail) });
}

function targetId(candidate) {
  return candidate?.targetId ?? candidate?.id ?? candidate?.target?.id ?? null;
}

/**
 * @typedef {Readonly<{
 *   actionId: string|null,
 *   phase: "idle"|"outbound"|"recalling"|"empoweredWindow"|"empoweredCleave"|"recovery",
 *   elapsed: number,
 *   origin: Readonly<{x:number,z:number}>,
 *   direction: Readonly<{x:number,z:number}>,
 *   scythePosition: Readonly<{x:number,z:number}>,
 *   outboundProgress: number,
 *   recallProgress: number,
 *   empoweredRemaining: number,
 *   armed: boolean,
 *   weaponDetached: boolean,
 * }>} ClaimSnapshot
 */

export class ReapersClaim {
  constructor(emit = () => {}) {
    this.emit = emit;
    this.config = resolvedClaimConfig();
    this.actionSerial = 0;
    this.outboundHitIds = new Set();
    this.recallHitIds = new Set();
    this.cleaveHitIds = new Set();
    this.resetState();
  }

  setConfig(overrides = {}) {
    this.config = resolvedClaimConfig(overrides);
    return this.config;
  }

  validateRequest({ origin, direction, inputTime } = {}) {
    if (this.phase !== "idle") return Object.freeze({ accepted: false, reason: "illegalPhase" });
    if (!finitePoint(origin) || !finitePoint(direction) || !Number.isFinite(inputTime)) {
      return Object.freeze({ accepted: false, reason: "invalidRequest" });
    }
    const length = Math.hypot(direction.x, direction.z);
    if (length <= 0.001) return Object.freeze({ accepted: false, reason: "invalidDirection" });
    return Object.freeze({ accepted: true });
  }

  requestStart({ origin, direction, inputTime, harvestUnits = 0 } = {}) {
    const validation = this.validateRequest({ origin, direction, inputTime });
    if (!validation.accepted) return this.rejectStart(validation.reason, inputTime);
    const length = Math.hypot(direction.x, direction.z);

    this.actionSerial += 1;
    this.actionId = `claim-${this.actionSerial}`;
    this.phase = "outbound";
    this.elapsed = 0;
    this.origin = { x: origin.x, z: origin.z };
    this.direction = { x: direction.x / length, z: direction.z / length };
    this.scythePosition = { ...this.origin };
    this.followupInputTime = null;
    this.outboundHitIds.clear();
    this.recallHitIds.clear();
    this.cleaveHitIds.clear();
    this.publish("claimStarted", {
      actionId: this.actionId,
      inputTime,
      releaseAt: this.config.outbound.releaseAt,
      duration: this.config.outbound.duration,
      origin: frozenPoint(this.origin),
      direction: frozenPoint(this.direction),
      harvestUnits,
    });
    return Object.freeze({ accepted: true, snapshot: this.snapshot() });
  }

  bufferFollowup(inputTime) {
    if (!Number.isFinite(inputTime)) {
      return Object.freeze({ accepted: false, reason: "invalidInputTime", snapshot: this.snapshot() });
    }
    if (this.followupInputTime !== null || this.phase === "empoweredCleave") {
      return Object.freeze({ accepted: false, reason: "alreadyConsumed", snapshot: this.snapshot() });
    }
    if (this.phase === "recalling") {
      const remaining = this.config.recall.duration - this.elapsed;
      if (remaining > this.config.recall.followupBuffer) {
        return Object.freeze({ accepted: false, reason: "windowClosed", snapshot: this.snapshot() });
      }
      this.followupInputTime = inputTime;
      return Object.freeze({ accepted: true, snapshot: this.snapshot() });
    }
    if (this.phase !== "empoweredWindow") {
      return Object.freeze({ accepted: false, reason: "windowClosed", snapshot: this.snapshot() });
    }
    this.followupInputTime = inputTime;
    this.startEmpoweredCleave();
    return Object.freeze({ accepted: true, snapshot: this.snapshot() });
  }

  update(dt, collisionAdapter) {
    const events = [];
    if (!Number.isFinite(dt) || dt <= 0 || this.phase === "idle") return Object.freeze(events);
    this.stepEvents = events;
    let remaining = dt;
    let guard = 0;
    while (remaining > 0.000001 && this.phase !== "idle" && guard < 8) {
      guard += 1;
      if (this.phase === "outbound") remaining = this.advanceOutbound(remaining, collisionAdapter);
      else if (this.phase === "recalling") remaining = this.advanceRecall(remaining, collisionAdapter);
      else if (this.phase === "empoweredWindow") remaining = this.advanceEmpoweredWindow(remaining);
      else if (this.phase === "empoweredCleave") remaining = this.advanceCleave(remaining, collisionAdapter);
      else remaining = this.advanceRecovery(remaining);
    }
    this.stepEvents = null;
    return Object.freeze(events);
  }

  cancel(reason) {
    if (this.phase === "idle") return this.snapshot();
    const actionId = this.actionId;
    const completionPublished = this.completionPublished;
    this.resetState();
    if (!completionPublished) this.publish("claimCompleted", { actionId, result: "cancelled", reason });
    return this.snapshot();
  }

  snapshot() {
    const outboundProgress = this.phase === "outbound"
      ? outboundTravelProgress(this.elapsed, this.config)
      : this.phase === "idle" ? 0 : 1;
    const recallProgress = this.phase === "recalling"
      ? clamp01(this.elapsed / this.config.recall.duration)
      : ["empoweredWindow", "empoweredCleave", "recovery"].includes(this.phase) ? 1 : 0;
    const empoweredRemaining = this.phase === "empoweredWindow"
      ? Math.max(0, this.config.empoweredWindow - this.elapsed)
      : 0;
    return Object.freeze({
      actionId: this.actionId,
      phase: this.phase,
      elapsed: this.elapsed,
      origin: frozenPoint(this.origin),
      direction: frozenPoint(this.direction),
      scythePosition: frozenPoint(this.scythePosition),
      outboundProgress,
      recallProgress,
      empoweredRemaining,
      armed: this.phase === "empoweredWindow" || this.phase === "empoweredCleave",
      weaponDetached: this.phase === "outbound" || this.phase === "recalling",
    });
  }

  get blocksWeaponActions() {
    return ACTIVE_PHASES.has(this.phase);
  }

  get canCancelToDash() {
    if (this.phase === "empoweredWindow" || this.phase === "recovery") return true;
    return this.phase === "empoweredCleave" && this.elapsed >= this.config.empoweredCleave.cancelToDashAt;
  }

  advanceOutbound(dt, adapter) {
    const available = this.config.outbound.duration - this.elapsed;
    const consumed = Math.min(dt, available);
    const from = { ...this.scythePosition };
    this.elapsed += consumed;
    const progress = outboundTravelProgress(this.elapsed, this.config);
    this.scythePosition.x = this.origin.x + this.direction.x * this.config.outbound.distance * progress;
    this.scythePosition.z = this.origin.z + this.direction.z * this.config.outbound.distance * progress;
    if (this.elapsed > this.config.outbound.releaseAt && progress > 0) {
      const collisionStatus = this.resolveCollisions("outbound", from, this.scythePosition, this.outboundHitIds, adapter);
      if (collisionStatus.ownershipChanged) return 0;
    }
    if (this.elapsed + 0.000001 >= this.config.outbound.duration) {
      this.phase = "recalling";
      this.elapsed = 0;
      this.publish("claimRecallStarted", { actionId: this.actionId, position: frozenPoint(this.scythePosition) });
    }
    return dt - consumed;
  }

  advanceRecall(dt, adapter) {
    const available = this.config.recall.duration - this.elapsed;
    const consumed = Math.min(dt, available);
    const from = { ...this.scythePosition };
    this.elapsed += consumed;
    const progress = clamp01(this.elapsed / this.config.recall.duration);
    const distance = this.config.outbound.distance * (1 - progress);
    this.scythePosition.x = this.origin.x + this.direction.x * distance;
    this.scythePosition.z = this.origin.z + this.direction.z * distance;
    const collisionStatus = this.resolveCollisions("recall", from, this.scythePosition, this.recallHitIds, adapter);
    if (collisionStatus.ownershipChanged) return 0;
    if (this.elapsed + 0.000001 >= this.config.recall.duration) this.catchScythe();
    return dt - consumed;
  }

  catchScythe() {
    this.phase = "empoweredWindow";
    this.elapsed = 0;
    this.scythePosition = { ...this.origin };
    this.publish("claimCaught", {
      actionId: this.actionId,
      position: frozenPoint(this.scythePosition),
      empoweredWindow: this.config.empoweredWindow,
    });
    this.publish("claimFollowupReady", {
      actionId: this.actionId,
      remaining: this.config.empoweredWindow,
      buffered: this.followupInputTime !== null,
    });
    if (this.followupInputTime !== null) this.startEmpoweredCleave();
  }

  advanceEmpoweredWindow(dt) {
    const available = this.config.empoweredWindow - this.elapsed;
    const consumed = Math.min(dt, available);
    this.elapsed += consumed;
    if (this.elapsed + 0.000001 >= this.config.empoweredWindow) this.enterRecovery("expired");
    return dt - consumed;
  }

  startEmpoweredCleave() {
    this.phase = "empoweredCleave";
    this.elapsed = 0;
    this.publish("claimFollowupConsumed", {
      actionId: this.actionId,
      inputTime: this.followupInputTime,
      activeStart: this.config.empoweredCleave.activeStart,
    });
  }

  advanceCleave(dt, adapter) {
    const available = this.config.empoweredCleave.duration - this.elapsed;
    const consumed = Math.min(dt, available);
    const previous = this.elapsed;
    this.elapsed += consumed;
    if (this.elapsed >= this.config.empoweredCleave.activeStart && previous <= this.config.empoweredCleave.activeEnd) {
      const collisionStatus = this.resolveCollisions("cleave", this.origin, this.origin, this.cleaveHitIds, adapter);
      if (collisionStatus.ownershipChanged) return 0;
    }
    if (this.elapsed + 0.000001 >= this.config.empoweredCleave.duration) this.enterRecovery("cleave");
    return dt - consumed;
  }

  enterRecovery(result) {
    this.phase = "recovery";
    this.elapsed = 0;
    this.completionPublished = true;
    this.publish("claimCompleted", { actionId: this.actionId, result });
  }

  advanceRecovery(dt) {
    const available = this.config.recoveryDuration - this.elapsed;
    const consumed = Math.min(dt, available);
    this.elapsed += consumed;
    if (this.elapsed + 0.000001 >= this.config.recoveryDuration) this.resetState();
    return dt - consumed;
  }

  resolveCollisions(pass, from, to, hitIds, adapter) {
    if (!adapter || hitIds.size >= this.config.maxTargetsPerPass) return COLLISION_CONTINUES;
    const actionId = this.actionId;
    const phase = this.phase;
    const activePass = pass;
    const direction = frozenPoint(this.direction);
    const query = {
      actionId,
      pass: activePass,
      from: frozenPoint(from),
      to: frozenPoint(to),
      radius: activePass === "outbound" ? this.config.outbound.radius
        : activePass === "recall" ? this.config.recall.radius
          : this.config.empoweredCleave.radius,
      arc: activePass === "cleave" ? this.config.empoweredCleave.arc : null,
      direction,
    };
    const querySweep = typeof adapter === "function" ? adapter : adapter.querySweep?.bind(adapter);
    const candidates = querySweep?.(Object.freeze(query)) ?? [];
    if (this.actionId !== actionId || this.phase !== phase) return COLLISION_OWNERSHIP_CHANGED;
    for (const candidate of candidates) {
      if (this.actionId !== actionId || this.phase !== phase) return COLLISION_OWNERSHIP_CHANGED;
      const id = targetId(candidate);
      if (id === null || hitIds.has(id) || hitIds.size >= this.config.maxTargetsPerPass) continue;
      hitIds.add(id);
      const definition = activePass === "outbound" ? this.config.outbound
        : activePass === "recall" ? this.config.recall
          : this.config.empoweredCleave;
      const resolution = typeof adapter === "object" && adapter.resolveHit
        ? adapter.resolveHit(Object.freeze({ actionId, pass: activePass, target: candidate.target ?? candidate, definition }))
        : candidate;
      if (this.actionId !== actionId || this.phase !== phase) return COLLISION_OWNERSHIP_CHANGED;
      const terminatePass = resolution?.terminatePass === true;
      if (activePass !== "cleave") {
        this.publish("claimHit", {
          actionId,
          pass: activePass,
          targetId: id,
          hit: resolution?.hit ?? resolution ?? null,
        });
        if (this.actionId !== actionId || this.phase !== phase) return COLLISION_OWNERSHIP_CHANGED;
      }
      const pull = resolution?.pull;
      if (activePass === "recall" && pull) {
        this.publish("claimPulled", {
          actionId,
          targetId: id,
          requested: pull.requested,
          applied: pull.applied,
          resistanceClass: pull.resistanceClass,
        });
        if (this.actionId !== actionId || this.phase !== phase) return COLLISION_OWNERSHIP_CHANGED;
      }
      if (terminatePass) return COLLISION_TERMINATED;
    }
    return COLLISION_CONTINUES;
  }

  rejectStart(reason, inputTime) {
    this.publish("claimRejected", { reason, inputTime });
    return Object.freeze({ accepted: false, reason, snapshot: this.snapshot() });
  }

  publish(type, detail) {
    const event = immutableEvent(type, detail);
    this.stepEvents?.push(event);
    this.emit(type, event.detail);
  }

  resetState() {
    this.phase = "idle";
    this.elapsed = 0;
    this.actionId = null;
    this.origin = { x: 0, z: 0 };
    this.direction = { x: 0, z: 1 };
    this.scythePosition = { x: 0, z: 0 };
    this.followupInputTime = null;
    this.completionPublished = false;
    this.outboundHitIds.clear();
    this.recallHitIds.clear();
    this.cleaveHitIds.clear();
  }
}
