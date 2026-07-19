import {
  CHARGE_CONFIG,
  CLAIM_CONFIG,
  DASH_ATTACK,
  HEAVY_ATTACK,
  PLAYER_CONFIG,
  PROGRESSION_TRANSFORMATION_CONFIG,
  SCYTHE_ATTACKS,
} from "./gameConfig.js";
import { HarvestState } from "./HarvestState.js";
import { ReapersClaim } from "./ReapersClaim.js";

function normalize(x, z, fallbackAngle) {
  const length = Math.hypot(x, z);
  if (length > 0.001) return { x: x / length, z: z / length };
  return { x: Math.cos(fallbackAngle), z: Math.sin(fallbackAngle) };
}

export class PlayerCombat {
  constructor(emit) {
    this.emit = emit;
    this.harvest = new HarvestState();
    this.claim = new ReapersClaim((type, detail) => this.emit(type, detail));
    this.reset();
  }

  reset() {
    if (this.dashActionId) this.cancelDash("reset", true);
    this.claim.cancel("reset");
    this.harvest.resetRun();
    this.attack = null;
    this.attackTime = 0;
    this.attackHitIds = new Set();
    this.attackFacing = 0;
    this.attackKind = null;
    this.comboIndex = -1;
    this.comboWindow = 0;
    this.comboNextIndex = 0;
    this.queuedAttack = false;
    this.attackBuffer = 0;
    this.dashBuffer = 0;
    this.dashRequest = null;
    this.heavyBuffer = 0;
    this.claimBuffer = 0;
    this.claimRequest = null;
    this.dashTime = 0;
    this.dashActionSerial = 0;
    this.dashActionId = null;
    this.dashInputTime = null;
    this.dashElapsed = 0;
    this.dashRewardResolved = false;
    this.dashInheritedInvulnerability = 0;
    this.dashCooldown = 0;
    this.dashDirection = { x: 0, z: 1 };
    this.dashMomentum = { x: 0, z: 0 };
    this.dashMomentumTime = 0;
    this.dashSteeringSuppressed = 0;
    this.heavyCooldown = 0;
    this.heavyCharge = 0;
    this.chargingHeavy = false;
    this.heavyToggleArmed = false;
    this.heavyRequest = null;
    this.heavyReleaseRequest = null;
    this.chargeActionSerial = 0;
    this.chargeActionId = null;
    this.chargeState = "idle";
    this.chargeStartTime = null;
    this.chargeReleaseTime = null;
    this.chargeReleaseForced = false;
    this.swingVisual = 0;
  }

  update(dt, input, player, movement, callbacks) {
    const attackWasActive = Boolean(this.attack);
    this.tickTimers(dt);
    this.captureInput(input);
    this.advanceDash(dt, movement);
    this.tryStartClaim(player);
    this.claim.update(dt, callbacks.claimCollision);
    this.tryStartDash(player, movement, callbacks);

    if (!this.claim.blocksWeaponActions) {
      this.updateHeavyInput(dt, input, player);
      this.tryStartBufferedAttack(player);
    }

    if (attackWasActive && this.attack) this.updateAttack(dt, player, callbacks);

    return this.movementVelocity(dt, movement);
  }

  tickTimers(dt) {
    this.comboWindow = Math.max(0, this.comboWindow - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.heavyCooldown = Math.max(0, this.heavyCooldown - dt);
    this.attackBuffer = Math.max(0, this.attackBuffer - dt);
    this.dashBuffer = Math.max(0, this.dashBuffer - dt);
    if (this.dashBuffer <= 0 && this.dashTime <= 0) this.dashRequest = null;
    this.heavyBuffer = Math.max(0, this.heavyBuffer - dt);
    this.claimBuffer = Math.max(0, this.claimBuffer - dt);
    this.dashSteeringSuppressed = Math.max(0, this.dashSteeringSuppressed - dt);
    if (this.chargeState === "recovery" && this.heavyCooldown <= 0) {
      this.chargeState = "idle";
      this.chargeActionId = null;
      this.heavyCharge = 0;
    }

    if (this.comboWindow <= 0 && !this.attack) {
      this.comboIndex = -1;
      this.comboNextIndex = 0;
    }
  }

  captureInput(input) {
    const attackPress = this.consumePress(input, "attack");
    if (attackPress) {
      const followup = this.claim.bufferFollowup(attackPress.timeStamp);
      if (!followup.accepted && !this.claim.blocksWeaponActions) this.attackBuffer = PLAYER_CONFIG.combat.attackBuffer;
    }
    const dashPress = this.consumePress(input, "dash");
    if (dashPress) {
      this.dashBuffer = PLAYER_CONFIG.combat.dashBuffer;
      this.dashRequest = dashPress;
    }
    const heavyPress = this.consumePress(input, "heavy");
    if (heavyPress) {
      this.heavyBuffer = PLAYER_CONFIG.combat.heavyBuffer;
      this.heavyRequest = heavyPress;
    }
    const heavyRelease = this.consumeRelease(input, "heavy");
    if (heavyRelease) this.heavyReleaseRequest = heavyRelease;
    const claimPress = this.consumePress(input, "claim");
    if (claimPress) {
      this.claimBuffer = CLAIM_CONFIG.inputBuffer;
      this.claimRequest = claimPress;
    }
  }

  consumePress(input, action) {
    if (typeof input.consumePressed === "function") return input.consumePressed(action);
    return input.consume(action) ? { action, timeStamp: performance.now() } : null;
  }

  consumeRelease(input, action) {
    return typeof input.consumeReleased === "function" ? input.consumeReleased(action) : null;
  }

  tryStartClaim(player) {
    if (this.claimBuffer <= 0 || this.claim.phase !== "idle") return;
    if (this.attack || this.chargingHeavy || this.dashTime > 0) return;
    const inputTime = this.claimRequest?.timeStamp ?? performance.now();
    this.claimBuffer = 0;
    this.claimRequest = null;
    const request = {
      origin: player.position,
      direction: { x: Math.cos(player.aimAngle), z: Math.sin(player.aimAngle) },
      inputTime,
    };
    const validation = this.claim.validateRequest(request);
    if (!validation.accepted) {
      this.claim.requestStart(request);
      return;
    }
    const spend = this.harvest.trySpend(CLAIM_CONFIG.costSegments, "claim");
    if (!spend.accepted) {
      this.emit("claimRejected", Object.freeze({ reason: "insufficientHarvest", inputTime }));
      return;
    }
    this.claim.requestStart({
      ...request,
      harvestUnits: spend.snapshot.units,
    });
  }

  advanceDash(dt, movement) {
    if (this.dashTime <= 0) return;

    const elapsed = Math.min(dt, this.dashTime);
    this.dashElapsed += elapsed;
    this.dashInheritedInvulnerability = Math.max(0, this.dashInheritedInvulnerability - elapsed);

    if (this.dashSteeringSuppressed <= 0 && Math.hypot(movement.x, movement.y) > 0.001) {
      const desired = normalize(movement.x, movement.y, 0);
      const blend = 1 - Math.exp(-PLAYER_CONFIG.dash.steeringRate * dt);
      this.dashDirection = normalize(
        this.dashDirection.x + (desired.x - this.dashDirection.x) * blend,
        this.dashDirection.z + (desired.z - this.dashDirection.z) * blend,
        Math.atan2(this.dashDirection.z, this.dashDirection.x),
      );
    }

    this.dashTime = Math.max(0, this.dashTime - dt);
    if (this.dashTime <= 0) {
      this.dashMomentum.x = this.dashDirection.x * PLAYER_CONFIG.dash.exitSpeed;
      this.dashMomentum.z = this.dashDirection.z * PLAYER_CONFIG.dash.exitSpeed;
      this.dashMomentumTime = PLAYER_CONFIG.dash.momentumDuration;
      this.cancelDash("ended");
    }
  }

  tryStartDash(player, movement, callbacks) {
    if (this.dashBuffer <= 0 || this.dashTime > 0 || this.dashCooldown > 0) return;
    if (this.claim.blocksWeaponActions) {
      if (!this.claim.canCancelToDash) return;
      this.claim.cancel("dash");
    }
    if (this.attack && this.attackTime < (this.attack.cancelToDashAt ?? this.attack.activeEnd)) return;

    if (this.attack) this.cancelAttack("dash");
    if (this.chargingHeavy) this.cancelHeavyCharge();
    this.dashBuffer = 0;
    this.startDash(player, movement, this.dashRequest);
    callbacks.onDash?.();
  }

  tryStartBufferedAttack(player) {
    if (this.attackBuffer <= 0 || this.attack || this.chargingHeavy || this.claim.blocksWeaponActions) return;

    this.attackBuffer = 0;
    if (this.dashTime > 0 || this.dashMomentumTime > 0) {
      const facing = Math.atan2(this.dashDirection.z, this.dashDirection.x);
      this.startAttack(DASH_ATTACK, -1, true, facing);
      return;
    }

    const comboIndex = this.comboWindow > 0 ? this.comboNextIndex : 0;
    this.startAttack(SCYTHE_ATTACKS[comboIndex], comboIndex, false, player.aimAngle);
  }

  updateHeavyInput(dt, input, player) {
    if (this.claim.blocksWeaponActions) return;
    const mode = input.settings.get("gameplay.chargeMode");

    if (this.heavyBuffer > 0 && this.heavyCooldown <= 0 && !this.attack && this.dashTime <= 0) {
      if (!this.chargingHeavy) {
        this.heavyBuffer = 0;
        this.startHeavyCharge(player, this.heavyRequest?.timeStamp ?? performance.now(), mode);
      } else if (mode === "toggle") {
        this.heavyBuffer = 0;
        this.queueHeavyRelease(this.heavyRequest?.timeStamp ?? performance.now());
      }
      this.heavyRequest = null;
    }

    if (this.heavyReleaseRequest) {
      if (mode === "hold" && this.chargingHeavy) this.queueHeavyRelease(this.heavyReleaseRequest.timeStamp);
      this.heavyReleaseRequest = null;
    }

    if (!this.chargingHeavy) return;
    const timing = CHARGE_CONFIG.timing;
    this.heavyCharge = Math.min(timing.forcedRelease, this.heavyCharge + dt);
    if (this.chargeState === "releaseQueued") {
      const capturedElapsed = Math.max(0, (this.chargeReleaseTime - this.chargeStartTime) / 1000);
      if (capturedElapsed >= timing.minimumRelease || this.heavyCharge >= timing.minimumRelease) {
        this.releaseHeavy(player, false);
        return;
      }
    }
    if (this.heavyCharge >= timing.forcedRelease) {
      this.queueHeavyRelease(this.chargeStartTime + timing.forcedRelease * 1000, true);
      this.releaseHeavy(player, true);
    }
  }

  startHeavyCharge(player, inputTime, mode) {
    this.chargeActionSerial += 1;
    this.chargeActionId = `charge-${this.chargeActionSerial}`;
    this.chargeState = "charging";
    this.chargeStartTime = inputTime;
    this.chargeReleaseTime = null;
    this.chargingHeavy = true;
    this.heavyCharge = 0;
    this.heavyToggleArmed = mode === "toggle";
    this.emit("chargeStart", Object.freeze({
      actionId: this.chargeActionId,
      inputTime,
      position: Object.freeze({ ...player.position }),
    }));
  }

  queueHeavyRelease(releaseTime, forced = false) {
    if (!this.chargingHeavy || this.chargeState !== "charging") return false;
    this.chargeState = "releaseQueued";
    this.chargeReleaseTime = releaseTime;
    this.chargeReleaseForced = forced;
    return true;
  }

  releaseHeavy(player, forced = this.chargeReleaseForced === true) {
    if (!this.chargingHeavy || this.chargeState !== "releaseQueued") return false;
    const timing = CHARGE_CONFIG.timing;
    const capturedElapsed = Math.max(0, (this.chargeReleaseTime - this.chargeStartTime) / 1000);
    const elapsed = forced
      ? timing.forcedRelease
      : Math.max(timing.minimumRelease, Math.min(timing.forcedRelease, capturedElapsed));
    const quality = forced ? "full"
      : elapsed >= timing.perfectOpen && elapsed < timing.perfectClose ? "perfect"
        : elapsed >= timing.fullThreshold ? "full" : "partial";
    const values = CHARGE_CONFIG.qualities[quality];
    const ratio = Math.min(1, elapsed / timing.forcedRelease);
    const graveEdgeRank = player.transformationRanks?.graveEdgeCharge ?? 0;
    const chargedPoiseDamage = values.poiseDamage * (
      1 + PROGRESSION_TRANSFORMATION_CONFIG.graveEdgeCharge.poiseDamagePerRank * graveEdgeRank
    );
    const chargedAttack = Object.freeze({
      ...HEAVY_ATTACK,
      range: HEAVY_ATTACK.range * values.rangeMultiplier,
      damage: HEAVY_ATTACK.damage * values.damageMultiplier,
      poiseDamage: chargedPoiseDamage,
      harvestUnits: values.harvestUnits,
      chargeRatio: ratio,
      chargeQuality: quality,
      chargeActionId: this.chargeActionId,
    });
    this.chargingHeavy = false;
    this.heavyCooldown = HEAVY_ATTACK.cooldown;
    this.chargeState = quality;
    this.emit("chargeReleased", Object.freeze({
      actionId: this.chargeActionId,
      inputTime: this.chargeReleaseTime,
      startTime: this.chargeStartTime,
      releaseTime: this.chargeReleaseTime,
      elapsed,
      ratio,
      quality,
      forced,
      damage: chargedAttack.damage,
      range: chargedAttack.range,
      poiseDamage: chargedAttack.poiseDamage,
      harvestUnits: chargedAttack.harvestUnits,
    }));
    this.startAttack(chargedAttack, -1, false, player.aimAngle);
    this.chargeState = "committed";
    this.chargeReleaseForced = false;
    return true;
  }

  cancelHeavyCharge() {
    this.chargingHeavy = false;
    this.heavyCharge = 0;
    this.heavyToggleArmed = false;
    this.heavyBuffer = 0;
    this.heavyRequest = null;
    this.heavyReleaseRequest = null;
    this.chargeState = "idle";
    this.chargeActionId = null;
    this.chargeStartTime = null;
    this.chargeReleaseTime = null;
    this.chargeReleaseForced = false;
  }

  startDash(player, movement, request = this.dashRequest) {
    this.dashActionSerial += 1;
    this.dashActionId = `dash-${this.dashActionSerial}`;
    this.dashInputTime = Number.isFinite(request?.timeStamp) ? request.timeStamp : null;
    this.dashElapsed = 0;
    this.dashRewardResolved = false;
    this.dashInheritedInvulnerability = Math.max(0, player.invulnerable);
    this.dashDirection = normalize(movement.x, movement.y, player.aimAngle);
    this.dashTime = PLAYER_CONFIG.dash.duration;
    this.dashCooldown = PLAYER_CONFIG.dash.cooldown * player.dashCooldownMultiplier;
    this.dashMomentum.x = 0;
    this.dashMomentum.z = 0;
    this.dashMomentumTime = 0;
    this.dashRequest = null;
    player.invulnerable = Math.max(player.invulnerable, PLAYER_CONFIG.dash.invulnerability);
    this.emit("dash", Object.freeze({
      actionId: this.dashActionId,
      inputTime: this.dashInputTime,
      elapsed: this.dashElapsed,
      duration: PLAYER_CONFIG.dash.duration,
      perfectOpen: PLAYER_CONFIG.dash.perfectOpen,
      perfectClose: PLAYER_CONFIG.dash.perfectClose,
      inheritedInvulnerability: this.dashInheritedInvulnerability,
      position: Object.freeze({ ...player.position }),
      direction: Object.freeze({ ...this.dashDirection }),
    }));
  }

  qualifyPerfectDash() {
    const base = {
      actionId: this.dashActionId,
      inputTime: this.dashInputTime,
      elapsed: this.dashElapsed,
      direction: Object.freeze({ ...this.dashDirection }),
    };
    if (this.dashTime <= 0 || !this.dashActionId) {
      return Object.freeze({ accepted: false, reason: "inactive", ...base });
    }
    if (this.dashRewardResolved) {
      return Object.freeze({ accepted: false, reason: "alreadyResolved", ...base });
    }
    if (this.dashInheritedInvulnerability > 0) {
      return Object.freeze({ accepted: false, reason: "inheritedInvulnerability", ...base });
    }
    if (
      this.dashElapsed < PLAYER_CONFIG.dash.perfectOpen
      || this.dashElapsed >= PLAYER_CONFIG.dash.perfectClose
    ) {
      return Object.freeze({ accepted: false, reason: "outsideWindow", ...base });
    }
    this.dashRewardResolved = true;
    return Object.freeze({ accepted: true, reason: "perfectDash", ...base });
  }

  cancelDash(reason, clearMomentum = false, finalDirection = this.dashDirection) {
    const actionId = this.dashActionId;
    const inputTime = this.dashInputTime;
    const elapsed = this.dashElapsed;
    const direction = Object.freeze({ ...finalDirection });
    this.dashTime = 0;
    this.dashActionId = null;
    this.dashInputTime = null;
    this.dashElapsed = 0;
    this.dashRewardResolved = true;
    this.dashInheritedInvulnerability = 0;
    this.dashBuffer = 0;
    this.dashRequest = null;
    if (clearMomentum) {
      this.dashMomentum.x = 0;
      this.dashMomentum.z = 0;
      this.dashMomentumTime = 0;
    }
    const detail = Object.freeze({
      actionId,
      inputTime,
      elapsed,
      duration: PLAYER_CONFIG.dash.duration,
      direction,
      reason,
      cancelled: actionId !== null,
    });
    if (actionId !== null) this.emit("dashEnded", detail);
    return detail;
  }

  cancelPlayerActions(reason) {
    const attackActive = Boolean(this.attack);
    const chargeActive = this.chargingHeavy || this.chargeState !== "idle";
    const dashActive = this.dashActionId !== null;
    if (attackActive) this.cancelAttack(reason);
    this.cancelHeavyCharge();
    const dash = this.cancelDash(reason, true);
    this.attackBuffer = 0;
    this.attackTime = 0;
    this.attackHitIds.clear();
    this.attackFacing = 0;
    this.attackKind = null;
    this.dashBuffer = 0;
    this.dashRequest = null;
    this.heavyBuffer = 0;
    this.heavyRequest = null;
    this.heavyReleaseRequest = null;
    this.claimBuffer = 0;
    this.claimRequest = null;
    this.comboIndex = -1;
    this.comboWindow = 0;
    this.comboNextIndex = 0;
    this.queuedAttack = false;
    this.swingVisual = 0;
    return Object.freeze({
      reason,
      attackCancelled: attackActive,
      chargeCancelled: chargeActive,
      dashCancelled: dashActive,
      dash,
    });
  }

  startAttack(definition, comboIndex, isDashAttack = false, facing = 0) {
    this.attack = definition;
    this.attackTime = 0;
    this.attackHitIds.clear();
    this.attackFacing = facing;
    this.attackKind = isDashAttack ? "dash" : comboIndex >= 0 ? "light" : "heavy";
    this.comboIndex = comboIndex;
    this.comboWindow = 0;
    this.comboNextIndex = definition.nextComboIndex;
    this.queuedAttack = false;
    this.emit("attack", Object.freeze({
      name: definition.name,
      range: definition.range,
      arc: definition.arc,
      swing: definition.swing ?? 1,
      duration: definition.duration,
      activeStart: definition.activeStart,
      activeEnd: definition.activeEnd,
      chainAt: definition.chainAt ?? null,
      comboIndex,
      facing,
      heavy: comboIndex < 0 && !isDashAttack,
      dash: isDashAttack,
      chargeActionId: definition.chargeActionId ?? null,
      chargeQuality: definition.chargeQuality ?? null,
      poiseDamage: definition.poiseDamage ?? null,
      harvestUnits: definition.harvestUnits ?? 0,
    }));
  }

  updateAttack(dt, player, callbacks) {
    this.attackTime += dt;
    const progress = Math.min(1, this.attackTime / this.attack.duration);
    this.swingVisual = Math.sin(progress * Math.PI) * (this.attack.swing ?? 1);

    this.queueBufferedFollowUp();

    if (this.attackTime >= this.attack.activeStart && this.attackTime <= this.attack.activeEnd) {
      callbacks.onActiveAttack?.(this.attack, this.attackHitIds, this.attackFacing);
    }

    if (this.queuedAttack && this.attackTime >= this.attack.chainAt) {
      this.startComboFollowUp(player);
      return;
    }

    if (this.attackTime < this.attack.duration) return;

    const nextCombo = this.attack.nextComboIndex;
    const completedCharge = Boolean(this.attack.chargeActionId);
    this.attack = null;
    this.attackTime = 0;
    this.attackKind = null;
    this.swingVisual = 0;
    this.queuedAttack = false;
    if (completedCharge) this.chargeState = "recovery";

    if (Number.isInteger(nextCombo)) {
      this.comboNextIndex = nextCombo;
      this.comboWindow = PLAYER_CONFIG.combat.comboGrace;
    } else {
      this.comboIndex = -1;
      this.comboNextIndex = 0;
      this.comboWindow = 0;
    }
  }

  queueBufferedFollowUp() {
    if (this.attackBuffer <= 0 || !Number.isInteger(this.attack.nextComboIndex)) return;
    if (this.attackTime < (this.attack.queueOpen ?? this.attack.activeEnd)) return;
    this.attackBuffer = 0;
    this.queuedAttack = true;
  }

  startComboFollowUp(player) {
    const nextCombo = this.attack.nextComboIndex;
    this.startAttack(SCYTHE_ATTACKS[nextCombo], nextCombo, false, player.aimAngle);
  }

  cancelAttack(reason) {
    const name = this.attack?.name;
    const cancelledCharge = Boolean(this.attack?.chargeActionId);
    this.attack = null;
    this.attackTime = 0;
    this.attackKind = null;
    this.comboIndex = -1;
    this.comboWindow = 0;
    this.comboNextIndex = 0;
    this.queuedAttack = false;
    this.attackBuffer = 0;
    this.swingVisual = 0;
    if (cancelledCharge) this.chargeState = "recovery";
    if (name) this.emit("attackCancelled", Object.freeze({ name, reason }));
  }

  movementVelocity(dt, movement) {
    if (this.dashTime > 0) {
      return {
        x: this.dashDirection.x * PLAYER_CONFIG.dash.speed,
        z: this.dashDirection.z * PLAYER_CONFIG.dash.speed,
      };
    }

    const movementScale = this.chargingHeavy
      ? PLAYER_CONFIG.combat.chargeMoveScale
      : this.attack
        ? this.attack.moveScale ?? PLAYER_CONFIG.combat.attackMoveScale
        : this.claim.blocksWeaponActions ? CLAIM_CONFIG.movementScale : 1;
    const desiredX = movement.x * PLAYER_CONFIG.speed * movementScale;
    const desiredZ = movement.y * PLAYER_CONFIG.speed * movementScale;
    const carryX = this.dashMomentum.x;
    const carryZ = this.dashMomentum.z;
    this.decayDashMomentum(dt, movement);
    return { x: desiredX + carryX, z: desiredZ + carryZ };
  }

  decayDashMomentum(dt, movement) {
    if (this.dashMomentumTime <= 0) return;
    const carryLength = Math.hypot(this.dashMomentum.x, this.dashMomentum.z);
    const inputLength = Math.hypot(movement.x, movement.y);
    let decay = PLAYER_CONFIG.dash.momentumDecay;
    if (carryLength > 0.001 && inputLength > 0.001) {
      const alignment = (
        this.dashMomentum.x * movement.x + this.dashMomentum.z * movement.y
      ) / (carryLength * inputLength);
      if (alignment < -0.2) decay *= PLAYER_CONFIG.dash.reverseBrakeMultiplier;
    }

    const damping = Math.exp(-decay * dt);
    this.dashMomentum.x *= damping;
    this.dashMomentum.z *= damping;
    this.dashMomentumTime = Math.max(0, this.dashMomentumTime - dt);
    if (this.dashMomentumTime <= 0 || Math.hypot(this.dashMomentum.x, this.dashMomentum.z) < 0.05) {
      this.dashMomentum.x = 0;
      this.dashMomentum.z = 0;
      this.dashMomentumTime = 0;
    }
  }

  resolveMovement({ blockedX, blockedZ }) {
    if (blockedX) this.dashMomentum.x = 0;
    if (blockedZ) this.dashMomentum.z = 0;
    if (this.dashTime <= 0 || (!blockedX && !blockedZ)) return;

    const incomingDirection = { ...this.dashDirection };
    if (blockedX) this.dashDirection.x = 0;
    if (blockedZ) this.dashDirection.z = 0;
    if (Math.hypot(this.dashDirection.x, this.dashDirection.z) < 0.05) {
      this.cancelDash("wall", true, incomingDirection);
    } else {
      this.dashSteeringSuppressed = 0.06;
    }
  }

  get isDashing() {
    return this.dashTime > 0;
  }
}
