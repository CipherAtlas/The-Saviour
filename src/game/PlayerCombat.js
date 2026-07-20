import {
  CHARGE_CONFIG,
  CLAIM_CONFIG,
  DASH_ATTACK,
  HEAVY_ATTACK,
  PLAYER_CONFIG,
  PROGRESSION_BALANCE_LIMITS,
  SCYTHE_ATTACKS,
  STRAIGHT_CHARGE_ATTACK,
  STRAIGHT_CHARGE_CONFIG,
} from "./gameConfig.js";
import { HarvestState } from "./HarvestState.js";
import {
  chargedReapProfile,
  claimConfigOverrides,
  comboProfile,
  dashProfile,
  graveLineProfile,
  modifierTotal,
} from "./progressionRuntime.js";
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
    this.primaryHoldArmed = false;
    this.primaryHoldTime = 0;
    this.primaryCharge = 0;
    this.chargingPrimary = false;
    this.primaryChargeRequest = null;
    this.primaryReleaseRequest = null;
    this.primaryChargeDashesUsed = 0;
    this.primaryChargeActionSerial = 0;
    this.primaryChargeActionId = null;
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
    this.dashCooldownDuration = PLAYER_CONFIG.dash.cooldown;
    this.dashDirection = { x: 0, z: 1 };
    this.dashMomentum = { x: 0, z: 0 };
    this.dashMomentumTime = 0;
    this.dashSteeringSuppressed = 0;
    this.activeDashDistanceMultiplier = 1;
    this.activePerfectDashWindow = PLAYER_CONFIG.dash.perfectClose;
    this.comboBridgeDuration = 0;
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
    this.currentPlayer = player;
    this.claim.setConfig(claimConfigOverrides(player, CLAIM_CONFIG));
    const attackWasActive = Boolean(this.attack);
    this.tickTimers(dt);
    this.captureInput(input);
    this.advanceDash(dt, movement);
    this.tryStartClaim(player);
    this.claim.update(dt, callbacks.claimCollision);
    this.tryStartDash(player, movement, callbacks);

    if (!this.claim.blocksWeaponActions) {
      this.updatePrimaryInput(dt, input, player);
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
      if (!followup.accepted && !this.claim.blocksWeaponActions) {
        const canHold = typeof input.isDown === "function"
          && input.isDown("attack")
          && !this.attack
          && !this.chargingHeavy
          && !this.primaryHoldArmed
          && !this.chargingPrimary
          && this.dashTime <= 0
          && this.dashMomentumTime <= 0
          && this.comboWindow <= 0;
        if (canHold) this.armPrimaryHold(attackPress);
        else this.attackBuffer = PLAYER_CONFIG.combat.attackBuffer;
      }
    }
    const attackRelease = this.consumeRelease(input, "attack");
    if (attackRelease) this.primaryReleaseRequest = attackRelease;
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
    if (this.attack || this.chargingHeavy || this.primaryHoldArmed || this.chargingPrimary || this.dashTime > 0) return;
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
    if (this.dashBuffer <= 0 || this.dashTime > 0) return;
    const preservingPrimaryCharge = this.primaryHoldArmed || this.chargingPrimary;
    if (
      preservingPrimaryCharge
      && this.primaryChargeDashesUsed >= STRAIGHT_CHARGE_CONFIG.dashAllowance
    ) {
      this.dashBuffer = 0;
      this.dashRequest = null;
      return;
    }
    if (this.dashCooldown > 0) return;
    if (this.claim.blocksWeaponActions) {
      if (!this.claim.canCancelToDash) return;
      this.claim.cancel("dash");
    }
    const preservingLightCombo = this.attackKind === "light" && this.comboIndex >= 0;
    if (
      this.attack
      && !preservingLightCombo
      && this.attackTime < (this.attack.cancelToDashAt ?? this.attack.activeEnd)
    ) return;

    if (this.attack && !preservingLightCombo) this.cancelAttack("dash");
    if (preservingPrimaryCharge) this.primaryChargeDashesUsed += 1;
    if (this.chargingHeavy) this.cancelHeavyCharge();
    this.dashBuffer = 0;
    this.startDash(player, movement, this.dashRequest);
    callbacks.onDash?.();
  }

  tryStartBufferedAttack(player) {
    if (
      this.attackBuffer <= 0
      || this.attack
      || this.chargingHeavy
      || this.primaryHoldArmed
      || this.chargingPrimary
      || this.claim.blocksWeaponActions
    ) return;

    this.attackBuffer = 0;
    const continuingCombo = this.comboWindow > 0;
    if ((this.dashTime > 0 || this.dashMomentumTime > 0) && !continuingCombo) {
      const facing = Math.atan2(this.dashDirection.z, this.dashDirection.x);
      this.startAttack(DASH_ATTACK, -1, true, facing);
      return;
    }

    const comboIndex = continuingCombo ? this.comboNextIndex : 0;
    this.startAttack(SCYTHE_ATTACKS[comboIndex], comboIndex, false, player.aimAngle);
  }

  armPrimaryHold(request) {
    this.primaryHoldArmed = true;
    this.primaryHoldTime = 0;
    this.primaryCharge = 0;
    this.primaryChargeRequest = request;
    this.primaryReleaseRequest = null;
    this.primaryChargeDashesUsed = 0;
  }

  updatePrimaryInput(dt, input, player) {
    const buildupDuration = this.lineBuildupDuration(player);
    if (this.primaryReleaseRequest) {
      const release = this.primaryReleaseRequest;
      this.primaryReleaseRequest = null;
      if (this.chargingPrimary) {
        this.releasePrimaryCharge(player, false, release.timeStamp);
        return;
      }
      if (this.primaryHoldArmed) {
        this.cancelPrimaryCharge();
        this.attackBuffer = PLAYER_CONFIG.combat.attackBuffer;
        return;
      }
    }

    if (this.primaryHoldArmed) {
      const previous = this.primaryHoldTime;
      this.primaryHoldTime += dt;
      if (this.primaryHoldTime >= STRAIGHT_CHARGE_CONFIG.holdThreshold) {
        if (this.harvest.snapshot().filledSegments < STRAIGHT_CHARGE_CONFIG.costSegments) {
          const inputTime = this.primaryChargeRequest?.timeStamp ?? performance.now();
          this.emit("lineChargeRejected", Object.freeze({
            reason: "insufficientHarvest",
            inputTime,
            costSegments: STRAIGHT_CHARGE_CONFIG.costSegments,
          }));
          this.cancelPrimaryCharge();
          this.attackBuffer = PLAYER_CONFIG.combat.attackBuffer;
          return;
        }
        const overflow = Math.max(0, this.primaryHoldTime - STRAIGHT_CHARGE_CONFIG.holdThreshold);
        this.startPrimaryCharge(player, this.primaryChargeRequest?.timeStamp ?? performance.now(), overflow);
        if (this.primaryCharge >= buildupDuration) {
          this.releasePrimaryCharge(player, true);
        }
        return;
      } else if (previous === 0 && typeof input.isDown === "function" && !input.isDown("attack")) {
        this.cancelPrimaryCharge();
        this.attackBuffer = PLAYER_CONFIG.combat.attackBuffer;
        return;
      }
    }

    if (!this.chargingPrimary) return;
    this.primaryCharge = Math.min(buildupDuration, this.primaryCharge + dt);
    if (this.primaryCharge >= buildupDuration) {
      this.releasePrimaryCharge(
        player,
        true,
        (this.primaryChargeRequest?.timeStamp ?? performance.now())
          + (STRAIGHT_CHARGE_CONFIG.holdThreshold + buildupDuration) * 1000,
      );
    }
  }

  startPrimaryCharge(player, inputTime, initialCharge = 0) {
    this.primaryChargeActionSerial += 1;
    this.primaryChargeActionId = `line-charge-${this.primaryChargeActionSerial}`;
    this.primaryHoldArmed = false;
    this.chargingPrimary = true;
    this.primaryCharge = Math.min(this.lineBuildupDuration(player), Math.max(0, initialCharge));
    this.emit("lineChargeStart", Object.freeze({
      actionId: this.primaryChargeActionId,
      inputTime,
      costSegments: STRAIGHT_CHARGE_CONFIG.costSegments,
      dashAllowance: STRAIGHT_CHARGE_CONFIG.dashAllowance,
      position: Object.freeze({ ...player.position }),
    }));
  }

  primaryChargeValues() {
    const rawRatio = Math.min(1, this.primaryCharge / this.lineBuildupDuration(this.currentPlayer));
    const easedRatio = 1 - (1 - rawRatio) ** 3;
    const power = STRAIGHT_CHARGE_CONFIG.minimumPower
      + (1 - STRAIGHT_CHARGE_CONFIG.minimumPower) * easedRatio;
    const rangeScale = STRAIGHT_CHARGE_CONFIG.minimumRange
      + (1 - STRAIGHT_CHARGE_CONFIG.minimumRange) * easedRatio;
    const widthScale = STRAIGHT_CHARGE_CONFIG.minimumWidth
      + (1 - STRAIGHT_CHARGE_CONFIG.minimumWidth) * easedRatio;
    return Object.freeze({ rawRatio, easedRatio, power, rangeScale, widthScale });
  }

  releasePrimaryCharge(player, forced = false, releaseTime = performance.now()) {
    if (!this.chargingPrimary) return false;
    const values = this.primaryChargeValues();
    const spend = this.harvest.trySpend(STRAIGHT_CHARGE_CONFIG.costSegments, "lineCharge");
    if (!spend.accepted) {
      this.emit("lineChargeRejected", Object.freeze({
        actionId: this.primaryChargeActionId,
        reason: "insufficientHarvest",
        inputTime: releaseTime,
        costSegments: STRAIGHT_CHARGE_CONFIG.costSegments,
      }));
      this.cancelPrimaryCharge();
      return false;
    }
    const profile = graveLineProfile(player);
    const chargedAttack = Object.freeze({
      ...STRAIGHT_CHARGE_ATTACK,
      range: STRAIGHT_CHARGE_ATTACK.range * values.rangeScale,
      width: STRAIGHT_CHARGE_ATTACK.width * values.widthScale * profile.widthMultiplier,
      damage: STRAIGHT_CHARGE_ATTACK.damage * values.power * profile.damageMultiplier,
      poiseDamage: STRAIGHT_CHARGE_ATTACK.poiseDamage * values.power * profile.poiseMultiplier,
      duration: STRAIGHT_CHARGE_ATTACK.duration * profile.recoveryMultiplier,
      activeStart: STRAIGHT_CHARGE_ATTACK.activeStart * profile.recoveryMultiplier,
      activeEnd: STRAIGHT_CHARGE_ATTACK.activeEnd * profile.recoveryMultiplier,
      cancelToDashAt: STRAIGHT_CHARGE_ATTACK.cancelToDashAt * profile.recoveryMultiplier,
      chargeKind: "line",
      chargeRatio: values.rawRatio,
      lineChargeActionId: this.primaryChargeActionId,
      progressionLine: profile,
    });
    const actionId = this.primaryChargeActionId;
    const dashesUsed = this.primaryChargeDashesUsed;
    const inputTime = this.primaryChargeRequest?.timeStamp ?? releaseTime;
    this.primaryHoldArmed = false;
    this.chargingPrimary = false;
    this.primaryCharge = 0;
    this.emit("lineChargeReleased", Object.freeze({
      actionId,
      inputTime,
      releaseTime,
      elapsed: STRAIGHT_CHARGE_CONFIG.holdThreshold + values.rawRatio * this.lineBuildupDuration(player),
      ratio: values.rawRatio,
      forced,
      range: chargedAttack.range,
      width: chargedAttack.width,
      damage: chargedAttack.damage,
      poiseDamage: chargedAttack.poiseDamage,
      costSegments: STRAIGHT_CHARGE_CONFIG.costSegments,
      dashesUsed,
      position: Object.freeze({ ...player.position }),
      facing: player.aimAngle,
    }));
    this.startAttack(chargedAttack, -1, false, player.aimAngle);
    this.primaryChargeActionId = null;
    this.primaryChargeRequest = null;
    this.primaryChargeDashesUsed = 0;
    return true;
  }

  cancelPrimaryCharge() {
    this.primaryHoldArmed = false;
    this.primaryHoldTime = 0;
    this.primaryCharge = 0;
    this.chargingPrimary = false;
    this.primaryChargeRequest = null;
    this.primaryReleaseRequest = null;
    this.primaryChargeDashesUsed = 0;
    this.primaryChargeActionId = null;
  }

  updateHeavyInput(dt, input, player) {
    if (this.claim.blocksWeaponActions) return;
    const mode = input.settings.get("gameplay.chargeMode");

    if (
      this.heavyBuffer > 0
      && this.heavyCooldown <= 0
      && !this.attack
      && !this.primaryHoldArmed
      && !this.chargingPrimary
      && this.dashTime <= 0
    ) {
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
    const timing = this.chargeTiming(player);
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
    const timing = this.chargeTiming(player);
    const capturedElapsed = Math.max(0, (this.chargeReleaseTime - this.chargeStartTime) / 1000);
    const elapsed = forced
      ? timing.forcedRelease
      : Math.max(timing.minimumRelease, Math.min(timing.forcedRelease, capturedElapsed));
    const quality = forced ? "full"
      : elapsed >= timing.perfectOpen && elapsed < timing.perfectClose ? "perfect"
        : elapsed >= timing.fullThreshold ? "full" : "partial";
    const values = CHARGE_CONFIG.qualities[quality];
    const ratio = Math.min(1, elapsed / timing.forcedRelease);
    const profile = chargedReapProfile(player, quality);
    const bloodEmpowered = profile.healthCost > 0 && player.health > profile.healthCost;
    const bloodDamageMultiplier = bloodEmpowered ? 1 : 1 / (1 + (modifierTotal(player, "bloodOrbit")?.damageBonus ?? 0));
    if (bloodEmpowered) {
      player.health -= profile.healthCost;
      this.emit("bloodOrbitSpent", Object.freeze({
        actionId: this.chargeActionId,
        amount: profile.healthCost,
        health: player.health,
        maxHealth: player.maxHealth,
      }));
    }
    const recoveryMultiplier = profile.recoveryMultiplier;
    const chargedAttack = Object.freeze({
      ...HEAVY_ATTACK,
      range: HEAVY_ATTACK.range * values.rangeMultiplier,
      damage: HEAVY_ATTACK.damage * values.damageMultiplier * profile.damageMultiplier * bloodDamageMultiplier,
      poiseDamage: values.poiseDamage * profile.poiseMultiplier,
      duration: HEAVY_ATTACK.duration * recoveryMultiplier,
      activeStart: HEAVY_ATTACK.activeStart * recoveryMultiplier,
      activeEnd: HEAVY_ATTACK.activeEnd * recoveryMultiplier,
      cancelToDashAt: HEAVY_ATTACK.cancelToDashAt * recoveryMultiplier,
      harvestUnits: values.harvestUnits,
      chargeRatio: ratio,
      chargeQuality: quality,
      chargeActionId: this.chargeActionId,
      bloodOrbit: bloodEmpowered ? Object.freeze({ healPerEnemy: profile.healPerEnemy, healCap: profile.healCap }) : null,
    });
    this.chargingHeavy = false;
    this.heavyCooldown = HEAVY_ATTACK.cooldown * profile.cooldownMultiplier;
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
    const profile = dashProfile(player);
    const ghost = modifierTotal(player, "ghostCadence");
    this.dashActionSerial += 1;
    this.dashActionId = `dash-${this.dashActionSerial}`;
    this.dashInputTime = Number.isFinite(request?.timeStamp) ? request.timeStamp : null;
    this.dashElapsed = 0;
    this.dashRewardResolved = false;
    this.dashInheritedInvulnerability = Math.max(0, player.invulnerable);
    this.dashDirection = normalize(movement.x, movement.y, player.aimAngle);
    this.dashTime = PLAYER_CONFIG.dash.duration;
    this.dashCooldownDuration = Math.max(PROGRESSION_BALANCE_LIMITS.dashCooldownSeconds, PLAYER_CONFIG.dash.cooldown
      * player.dashCooldownMultiplier
      * profile.cooldownMultiplier);
    this.dashCooldown = this.dashCooldownDuration;
    this.activeDashDistanceMultiplier = profile.distanceMultiplier;
    this.activePerfectDashWindow = profile.perfectWindowSeconds ?? PLAYER_CONFIG.dash.perfectClose;
    this.comboBridgeDuration = Math.max(
      this.comboBridgeDuration,
      ghost ? PLAYER_CONFIG.combat.comboGrace + PLAYER_CONFIG.dash.duration : 0,
    );
    if (this.comboWindow > 0 && this.comboBridgeDuration > 0) {
      this.comboWindow = Math.max(this.comboWindow, this.comboBridgeDuration);
    }
    this.dashMomentum.x = 0;
    this.dashMomentum.z = 0;
    this.dashMomentumTime = 0;
    this.dashRequest = null;
    player.invulnerable = Math.max(
      player.invulnerable,
      profile.invulnerabilitySeconds ?? PLAYER_CONFIG.dash.invulnerability,
    );
    this.emit("dash", Object.freeze({
      actionId: this.dashActionId,
      inputTime: this.dashInputTime,
      elapsed: this.dashElapsed,
      duration: PLAYER_CONFIG.dash.duration,
      perfectOpen: PLAYER_CONFIG.dash.perfectOpen,
      perfectClose: this.activePerfectDashWindow,
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
      || this.dashElapsed >= this.activePerfectDashWindow
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
    const chargeActive = this.chargingHeavy || this.chargeState !== "idle" || this.primaryHoldArmed || this.chargingPrimary;
    const dashActive = this.dashActionId !== null;
    if (attackActive) this.cancelAttack(reason);
    this.cancelPrimaryCharge();
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
    const combo = comboIndex >= 0 ? comboProfile(this.currentPlayer, comboIndex) : null;
    const transformedCombo = combo && (
      combo.damageMultiplier !== 1
      || combo.poiseMultiplier !== 1
      || combo.reachMultiplier !== 1
      || combo.timingMultiplier !== 1
    );
    this.attack = transformedCombo ? Object.freeze({
      ...definition,
      duration: definition.duration * combo.timingMultiplier,
      activeStart: definition.activeStart * combo.timingMultiplier,
      activeEnd: definition.activeEnd * combo.timingMultiplier,
      queueOpen: (definition.queueOpen ?? definition.activeEnd) * combo.timingMultiplier,
      chainAt: Number.isFinite(definition.chainAt) ? definition.chainAt * combo.timingMultiplier : definition.chainAt,
      cancelToDashAt: definition.cancelToDashAt * combo.timingMultiplier,
      range: definition.range * combo.reachMultiplier,
      comboIndex,
      progressionCombo: combo,
      isDashAttack: false,
    }) : definition;
    this.attackTime = 0;
    this.attackHitIds.clear();
    this.attackFacing = facing;
    this.attackKind = isDashAttack ? "dash" : definition.shape === "line" ? "line" : comboIndex >= 0 ? "light" : "heavy";
    this.comboIndex = comboIndex;
    this.comboWindow = 0;
    this.comboNextIndex = definition.nextComboIndex;
    this.queuedAttack = false;
    this.emit("attack", Object.freeze({
      name: this.attack.name,
      range: this.attack.range,
      arc: this.attack.arc,
      swing: this.attack.swing ?? 1,
      duration: this.attack.duration,
      activeStart: this.attack.activeStart,
      activeEnd: this.attack.activeEnd,
      chainAt: this.attack.chainAt ?? null,
      comboIndex,
      facing,
      heavy: comboIndex < 0 && !isDashAttack,
      line: definition.shape === "line",
      shape: this.attack.shape ?? "arc",
      width: this.attack.width ?? null,
      dash: isDashAttack,
      chargeActionId: this.attack.chargeActionId ?? null,
      chargeQuality: this.attack.chargeQuality ?? null,
      poiseDamage: this.attack.poiseDamage ?? null,
      harvestUnits: this.attack.harvestUnits ?? 0,
      lineChargeActionId: this.attack.lineChargeActionId ?? null,
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
      this.comboWindow = Math.max(PLAYER_CONFIG.combat.comboGrace, this.comboBridgeDuration);
      this.comboBridgeDuration = 0;
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
        x: this.dashDirection.x * PLAYER_CONFIG.dash.speed * this.activeDashDistanceMultiplier,
        z: this.dashDirection.z * PLAYER_CONFIG.dash.speed * this.activeDashDistanceMultiplier,
      };
    }

    const movementScale = this.chargingHeavy || this.chargingPrimary
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

  lineBuildupDuration(player = this.currentPlayer) {
    return STRAIGHT_CHARGE_CONFIG.buildupDuration * graveLineProfile(player).buildupMultiplier;
  }

  chargeTiming(player = this.currentPlayer) {
    const profile = chargedReapProfile(player, "partial");
    const timingMultiplier = profile.timingMultiplier;
    const base = CHARGE_CONFIG.timing;
    const center = ((base.perfectOpen + base.perfectClose) / 2) * timingMultiplier;
    const width = profile.perfectWindowSeconds ?? (base.perfectClose - base.perfectOpen) * timingMultiplier;
    const normalizeBoundary = (seconds) => Math.round(seconds * 1_000_000) / 1_000_000;
    return Object.freeze({
      minimumRelease: normalizeBoundary(base.minimumRelease * timingMultiplier),
      fullThreshold: normalizeBoundary(base.fullThreshold * timingMultiplier),
      perfectOpen: normalizeBoundary(center - width / 2),
      perfectClose: normalizeBoundary(center + width / 2),
      forcedRelease: normalizeBoundary(base.forcedRelease * timingMultiplier),
    });
  }

  reduceChargedReapCooldown(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return this.heavyCooldown;
    this.heavyCooldown = Math.max(0, this.heavyCooldown - seconds);
    return this.heavyCooldown;
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
