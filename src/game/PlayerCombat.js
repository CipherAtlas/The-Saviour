import { DASH_ATTACK, HEAVY_ATTACK, PLAYER_CONFIG, SCYTHE_ATTACKS } from "./gameConfig.js";

function normalize(x, z, fallbackAngle) {
  const length = Math.hypot(x, z);
  if (length > 0.001) return { x: x / length, z: z / length };
  return { x: Math.cos(fallbackAngle), z: Math.sin(fallbackAngle) };
}

export class PlayerCombat {
  constructor(emit) {
    this.emit = emit;
    this.reset();
  }

  reset() {
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
    this.heavyBuffer = 0;
    this.dashTime = 0;
    this.dashCooldown = 0;
    this.dashDirection = { x: 0, z: 1 };
    this.dashMomentum = { x: 0, z: 0 };
    this.dashMomentumTime = 0;
    this.dashSteeringSuppressed = 0;
    this.heavyCooldown = 0;
    this.heavyCharge = 0;
    this.chargingHeavy = false;
    this.heavyToggleArmed = false;
    this.swingVisual = 0;
  }

  update(dt, input, player, movement, callbacks) {
    const attackWasActive = Boolean(this.attack);
    this.tickTimers(dt);
    this.captureInput(input);
    this.advanceDash(dt, movement);

    this.tryStartDash(player, movement, callbacks);
    this.updateHeavyInput(dt, input, player);
    this.tryStartBufferedAttack(player);

    if (attackWasActive && this.attack) this.updateAttack(dt, player, callbacks);

    return this.movementVelocity(dt, movement);
  }

  tickTimers(dt) {
    this.comboWindow = Math.max(0, this.comboWindow - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.heavyCooldown = Math.max(0, this.heavyCooldown - dt);
    this.attackBuffer = Math.max(0, this.attackBuffer - dt);
    this.dashBuffer = Math.max(0, this.dashBuffer - dt);
    this.heavyBuffer = Math.max(0, this.heavyBuffer - dt);
    this.dashSteeringSuppressed = Math.max(0, this.dashSteeringSuppressed - dt);

    if (this.comboWindow <= 0 && !this.attack) {
      this.comboIndex = -1;
      this.comboNextIndex = 0;
    }
  }

  captureInput(input) {
    if (input.consume("attack")) this.attackBuffer = PLAYER_CONFIG.combat.attackBuffer;
    if (input.consume("dash")) this.dashBuffer = PLAYER_CONFIG.combat.dashBuffer;
    if (input.consume("heavy")) this.heavyBuffer = PLAYER_CONFIG.combat.heavyBuffer;
  }

  advanceDash(dt, movement) {
    if (this.dashTime <= 0) return;

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
    }
  }

  tryStartDash(player, movement, callbacks) {
    if (this.dashBuffer <= 0 || this.dashTime > 0 || this.dashCooldown > 0) return;
    if (this.attack && this.attackTime < (this.attack.cancelToDashAt ?? this.attack.activeEnd)) return;

    if (this.attack) this.cancelAttack("dash");
    if (this.chargingHeavy) this.cancelHeavyCharge();
    this.dashBuffer = 0;
    this.startDash(player, movement);
    callbacks.onDash?.();
  }

  tryStartBufferedAttack(player) {
    if (this.attackBuffer <= 0 || this.attack || this.chargingHeavy) return;

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
    const mode = input.settings.get("gameplay.chargeMode");

    if (this.heavyBuffer > 0 && this.heavyCooldown <= 0 && !this.attack && this.dashTime <= 0) {
      if (!this.chargingHeavy) {
        this.heavyBuffer = 0;
        this.chargingHeavy = true;
        this.heavyCharge = 0;
        this.heavyToggleArmed = mode === "toggle";
        this.emit("chargeStart", { position: { ...player.position } });
      } else if (mode === "toggle") {
        this.heavyBuffer = 0;
        this.releaseHeavy(player);
      }
    }

    if (!this.chargingHeavy) return;
    this.heavyCharge = Math.min(0.9, this.heavyCharge + dt);
    if (this.heavyCharge >= 0.9 || (mode === "hold" && !input.isDown("heavy") && this.heavyCharge >= 0.12)) {
      this.releaseHeavy(player);
    }
  }

  releaseHeavy(player) {
    const chargeRatio = Math.min(1, Math.max(0.2, this.heavyCharge / 0.9));
    const chargedAttack = {
      ...HEAVY_ATTACK,
      range: HEAVY_ATTACK.range * (0.9 + chargeRatio * 0.22),
      damage: HEAVY_ATTACK.damage * (0.72 + chargeRatio * 0.5),
      chargeRatio,
    };
    this.chargingHeavy = false;
    this.heavyCooldown = HEAVY_ATTACK.cooldown;
    this.startAttack(chargedAttack, -1, false, player.aimAngle);
  }

  cancelHeavyCharge() {
    this.chargingHeavy = false;
    this.heavyCharge = 0;
    this.heavyToggleArmed = false;
    this.heavyBuffer = 0;
  }

  startDash(player, movement) {
    this.dashDirection = normalize(movement.x, movement.y, player.aimAngle);
    this.dashTime = PLAYER_CONFIG.dash.duration;
    this.dashCooldown = PLAYER_CONFIG.dash.cooldown * player.dashCooldownMultiplier;
    this.dashMomentum.x = 0;
    this.dashMomentum.z = 0;
    this.dashMomentumTime = 0;
    player.invulnerable = Math.max(player.invulnerable, PLAYER_CONFIG.dash.invulnerability);
    this.emit("dash", { position: { ...player.position }, direction: { ...this.dashDirection } });
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
    this.emit("attack", {
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
    });
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
    this.attack = null;
    this.attackTime = 0;
    this.attackKind = null;
    this.swingVisual = 0;
    this.queuedAttack = false;

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
    this.attack = null;
    this.attackTime = 0;
    this.attackKind = null;
    this.comboIndex = -1;
    this.comboWindow = 0;
    this.comboNextIndex = 0;
    this.queuedAttack = false;
    this.attackBuffer = 0;
    this.swingVisual = 0;
    if (name) this.emit("attackCancelled", { name, reason });
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
        : 1;
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

    if (blockedX) this.dashDirection.x = 0;
    if (blockedZ) this.dashDirection.z = 0;
    if (Math.hypot(this.dashDirection.x, this.dashDirection.z) < 0.05) {
      this.dashTime = 0;
      this.dashMomentumTime = 0;
    } else {
      this.dashSteeringSuppressed = 0.06;
    }
  }

  get isDashing() {
    return this.dashTime > 0;
  }
}
