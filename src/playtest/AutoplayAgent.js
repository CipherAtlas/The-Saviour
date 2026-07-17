const DEFAULT_CONFIG = Object.freeze({
  attackRange: 5.15,
  heavyRange: 5.45,
  idealRange: 3.65,
  retreatRange: 2.15,
  dashEngageMinRange: 5.4,
  dashEngageMaxRange: 8.2,
  attackInterval: 0.24,
  heavyInterval: 1.5,
  heavyHoldSeconds: 0.34,
  dashInterval: 0.76,
  pathRefreshSeconds: 0.35,
  pathCellSize: 1.1,
  obstaclePadding: 0.84,
  waypointRadius: 0.7,
  stuckSeconds: 1.15,
  stuckProgressDistance: 0.62,
  recoverySeconds: 0.55,
  threatHorizonSeconds: 0.72,
  dangerPadding: 0.9,
  edgeSteeringDistance: 2.4,
  edgeSteeringStrength: 1.25,
});

const TYPE_PRIORITY = Object.freeze({
  queen: -8,
  bombardier: -5.2,
  hexer: -4.4,
  wraith: -2.5,
  reaver: -1.5,
  thrall: 0,
  boneguard: 1,
});

const NEIGHBORS = Object.freeze([
  Object.freeze({ x: 1, z: 0, cost: 1 }),
  Object.freeze({ x: -1, z: 0, cost: 1 }),
  Object.freeze({ x: 0, z: 1, cost: 1 }),
  Object.freeze({ x: 0, z: -1, cost: 1 }),
  Object.freeze({ x: 1, z: 1, cost: Math.SQRT2 }),
  Object.freeze({ x: 1, z: -1, cost: Math.SQRT2 }),
  Object.freeze({ x: -1, z: 1, cost: Math.SQRT2 }),
  Object.freeze({ x: -1, z: -1, cost: Math.SQRT2 }),
]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function normalize(vector, fallback = { x: 0, z: 0 }) {
  const length = Math.hypot(vector.x, vector.z);
  if (length <= 0.0001) return { ...fallback };
  return { x: vector.x / length, z: vector.z / length };
}

function addWeighted(target, direction, weight) {
  target.x += direction.x * weight;
  target.z += direction.z * weight;
}

function steerFromArenaEdges(movement, player, arena, config) {
  if (!arena || !Number.isFinite(arena.width) || !Number.isFinite(arena.depth)) return { ...movement };
  const steeringDistance = Math.max(0, config.edgeSteeringDistance);
  if (steeringDistance <= 0) return { ...movement };

  const radius = Math.max(0, player.radius ?? 0.6);
  const horizontalLimit = Math.max(0, arena.width / 2 - radius);
  const verticalLimit = Math.max(0, arena.depth / 2 - radius);
  const horizontalClearance = horizontalLimit - Math.abs(player.position.x);
  const verticalClearance = verticalLimit - Math.abs(player.position.z);
  const horizontalPressure = clamp(1 - horizontalClearance / steeringDistance, 0, 1);
  const verticalPressure = clamp(1 - verticalClearance / steeringDistance, 0, 1);
  const edgePressure = Math.max(horizontalPressure, verticalPressure);
  if (edgePressure <= 0) return { ...movement };

  const inward = normalize({
    x: -Math.sign(player.position.x) * horizontalPressure,
    z: -Math.sign(player.position.z) * verticalPressure,
  });
  const blend = clamp(edgePressure * config.edgeSteeringStrength, 0, 0.9);
  return normalize({
    x: movement.x * (1 - blend) + inward.x * blend,
    z: movement.z * (1 - blend) + inward.z * blend,
  }, inward);
}

function gridKey(x, z) {
  return `${x},${z}`;
}

function worldToGrid(position, cellSize) {
  return {
    x: Math.round(position.x / cellSize),
    z: Math.round(position.z / cellSize),
  };
}

function gridToWorld(cell, cellSize) {
  return { x: cell.x * cellSize, z: cell.z * cellSize };
}

function pointInsideExpandedObstacle(point, obstacle, padding) {
  return (
    point.x >= obstacle.x - obstacle.width / 2 - padding &&
    point.x <= obstacle.x + obstacle.width / 2 + padding &&
    point.z >= obstacle.z - obstacle.depth / 2 - padding &&
    point.z <= obstacle.z + obstacle.depth / 2 + padding
  );
}

function isWalkable(point, arena, padding) {
  const halfWidth = arena.width / 2 - padding - 0.65;
  const halfDepth = arena.depth / 2 - padding - 0.65;
  if (Math.abs(point.x) > halfWidth || Math.abs(point.z) > halfDepth) return false;
  return !(arena.obstacles ?? []).some((obstacle) => pointInsideExpandedObstacle(point, obstacle, padding));
}

function lineCrossesObstacle(start, end, obstacle, padding) {
  const steps = Math.max(2, Math.ceil(distance(start, end) / 0.55));
  for (let index = 1; index < steps; index += 1) {
    const ratio = index / steps;
    const point = {
      x: start.x + (end.x - start.x) * ratio,
      z: start.z + (end.z - start.z) * ratio,
    };
    if (pointInsideExpandedObstacle(point, obstacle, padding)) return true;
  }
  return false;
}

function hasLineOfSight(start, end, arena, padding) {
  return !(arena.obstacles ?? []).some((obstacle) => lineCrossesObstacle(start, end, obstacle, padding));
}

function nearestWalkableCell(origin, arena, cellSize, padding) {
  if (isWalkable(gridToWorld(origin, cellSize), arena, padding)) return origin;
  for (let radius = 1; radius <= 4; radius += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      for (let z = -radius; z <= radius; z += 1) {
        if (Math.abs(x) !== radius && Math.abs(z) !== radius) continue;
        const candidate = { x: origin.x + x, z: origin.z + z };
        if (isWalkable(gridToWorld(candidate, cellSize), arena, padding)) return candidate;
      }
    }
  }
  return null;
}

function reconstructPath(cameFrom, cells, endKey, cellSize, exactTarget) {
  const reversed = [];
  let key = endKey;
  while (key) {
    reversed.push(gridToWorld(cells.get(key), cellSize));
    key = cameFrom.get(key);
  }
  reversed.reverse();
  if (reversed.length > 0) reversed[reversed.length - 1] = { ...exactTarget };
  return reversed;
}

export function findNavigationPath(start, target, arena, options = {}) {
  const cellSize = options.cellSize ?? DEFAULT_CONFIG.pathCellSize;
  const padding = options.padding ?? DEFAULT_CONFIG.obstaclePadding;
  if (!arena || !Number.isFinite(arena.width) || !Number.isFinite(arena.depth)) return [{ ...target }];
  if (hasLineOfSight(start, target, arena, padding)) return [{ ...start }, { ...target }];

  const rawStart = worldToGrid(start, cellSize);
  const rawGoal = worldToGrid(target, cellSize);
  const startCell = nearestWalkableCell(rawStart, arena, cellSize, padding);
  const goalCell = nearestWalkableCell(rawGoal, arena, cellSize, padding);
  if (!startCell || !goalCell) return [];

  const startKey = gridKey(startCell.x, startCell.z);
  const goalKey = gridKey(goalCell.x, goalCell.z);
  const open = new Map([[startKey, 0]]);
  const cameFrom = new Map();
  const cells = new Map([[startKey, startCell]]);
  const costs = new Map([[startKey, 0]]);

  while (open.size > 0) {
    let currentKey = null;
    let currentScore = Infinity;
    for (const [key, score] of open) {
      if (score < currentScore) {
        currentKey = key;
        currentScore = score;
      }
    }

    if (currentKey === goalKey) return reconstructPath(cameFrom, cells, currentKey, cellSize, target);
    open.delete(currentKey);
    const current = cells.get(currentKey);

    for (const neighbor of NEIGHBORS) {
      const next = { x: current.x + neighbor.x, z: current.z + neighbor.z };
      const nextPoint = gridToWorld(next, cellSize);
      if (!isWalkable(nextPoint, arena, padding)) continue;
      if (neighbor.x !== 0 && neighbor.z !== 0) {
        const horizontal = gridToWorld({ x: current.x + neighbor.x, z: current.z }, cellSize);
        const vertical = gridToWorld({ x: current.x, z: current.z + neighbor.z }, cellSize);
        if (!isWalkable(horizontal, arena, padding) || !isWalkable(vertical, arena, padding)) continue;
      }

      const nextKey = gridKey(next.x, next.z);
      const nextCost = (costs.get(currentKey) ?? Infinity) + neighbor.cost;
      if (nextCost >= (costs.get(nextKey) ?? Infinity)) continue;
      const heuristic = Math.hypot(goalCell.x - next.x, goalCell.z - next.z);
      costs.set(nextKey, nextCost);
      cameFrom.set(nextKey, currentKey);
      cells.set(nextKey, next);
      open.set(nextKey, nextCost + heuristic);
    }
  }

  return [];
}

function defaultIntent(mode = "idle") {
  return {
    mode,
    worldMove: { x: 0, z: 0 },
    aimPoint: null,
    pressed: [],
    held: [],
    uiAction: null,
    targetId: null,
    danger: 0,
    recoveryStarted: false,
  };
}

function visibleEnemies(state) {
  return (state.enemies ?? []).filter((enemy) => enemy.active !== false && enemy.position);
}

function selectTarget(player, enemies) {
  let best = null;
  let bestScore = Infinity;
  for (const enemy of enemies) {
    const targetDistance = distance(player.position, enemy.position);
    const healthRatio = enemy.maxHealth > 0 ? enemy.health / enemy.maxHealth : 1;
    const score = targetDistance + (TYPE_PRIORITY[enemy.type] ?? 0) + healthRatio * 1.2;
    if (score < bestScore) {
      best = enemy;
      bestScore = score;
    }
  }
  return best;
}

function projectileThreat(projectile, player, horizon, padding) {
  if (projectile.active === false || !projectile.position || !projectile.velocity) return null;
  const relative = {
    x: projectile.position.x - player.position.x,
    z: projectile.position.z - player.position.z,
  };
  const speedSquared = projectile.velocity.x ** 2 + projectile.velocity.z ** 2;
  if (speedSquared < 0.001) return null;
  const time = clamp(-((relative.x * projectile.velocity.x) + (relative.z * projectile.velocity.z)) / speedSquared, 0, horizon);
  const closest = {
    x: relative.x + projectile.velocity.x * time,
    z: relative.z + projectile.velocity.z * time,
  };
  const safeRadius = (player.radius ?? 0.6) + (projectile.radius ?? 0.25) + padding;
  const closestDistance = Math.hypot(closest.x, closest.z);
  if (closestDistance >= safeRadius || time >= horizon) return null;
  const perpendicular = normalize(
    { x: -projectile.velocity.z, z: projectile.velocity.x },
    { x: -closest.x, z: -closest.z },
  );
  const side = perpendicular.x * relative.x + perpendicular.z * relative.z >= 0 ? -1 : 1;
  return {
    direction: { x: perpendicular.x * side, z: perpendicular.z * side },
    severity: 1 + (1 - time / horizon) + (safeRadius - closestDistance) / safeRadius,
    time,
  };
}

function areaThreat(telegraph, player) {
  if (!telegraph.position) return null;
  const remaining = telegraph.timeRemaining ?? telegraph.windup ?? 0.25;
  if (remaining > 0.8) return null;
  const offset = {
    x: player.position.x - telegraph.position.x,
    z: player.position.z - telegraph.position.z,
  };
  const threatRadius = (telegraph.radius ?? 1.5) + (player.radius ?? 0.6);
  const currentDistance = Math.hypot(offset.x, offset.z);
  if (currentDistance > threatRadius) return null;
  return {
    direction: normalize(offset, { x: 1, z: 0 }),
    severity: 1.2 + (1 - currentDistance / Math.max(0.1, threatRadius)) + (0.8 - remaining),
    time: remaining,
  };
}

function collectThreats(state, config) {
  const player = state.player;
  const threats = [];
  for (const projectile of state.projectiles ?? []) {
    const threat = projectile.mode === "lob" || projectile.mode === "rune"
      ? areaThreat({
          position: projectile.target,
          radius: projectile.areaRadius,
          timeRemaining: projectile.timeRemaining,
        }, player)
      : projectileThreat(projectile, player, config.threatHorizonSeconds, config.dangerPadding);
    if (threat) threats.push(threat);
  }
  for (const telegraph of state.telegraphs ?? []) {
    const threat = areaThreat(telegraph, player);
    if (threat) threats.push(threat);
  }
  for (const enemy of state.enemies ?? []) {
    if (!enemy.active || !enemy.attackPending) continue;
    const threat = areaThreat({
      position: enemy.position,
      radius: enemy.telegraphRadius ?? enemy.attackRange,
      windup: enemy.attackWindup,
    }, player);
    if (threat) threats.push(threat);
  }

  if (threats.length === 0) return null;
  const direction = { x: 0, z: 0 };
  let severity = 0;
  let soonest = Infinity;
  for (const threat of threats) {
    addWeighted(direction, threat.direction, threat.severity);
    severity += threat.severity;
    soonest = Math.min(soonest, threat.time);
  }
  return { direction: normalize(direction, threats[0].direction), severity, soonest };
}

function scoreUpgrade(choice, player) {
  const text = `${choice.id ?? ""} ${choice.name ?? ""} ${choice.description ?? ""}`.toLowerCase();
  let score = 0;
  if (/damage|critical|edge|mercy/.test(text)) score += 5;
  if (/reach|range|moon/.test(text)) score += 4;
  if (/dash|step|cooldown/.test(text)) score += 3.5;
  if (/health|heal|blood|siphon/.test(text)) score += (player.health / Math.max(1, player.maxHealth)) < 0.55 ? 7 : 2;
  if (choice.path === "Reaper") score += 1.4;
  if (choice.path === "Shade") score += 1.1;
  if (choice.path === "Grave" && player.health / Math.max(1, player.maxHealth) < 0.65) score += 2.5;
  score -= (choice.rank ?? 0) * 0.15;
  return score;
}

function chooseUpgrade(choices, player) {
  let best = null;
  let bestScore = -Infinity;
  for (const choice of choices) {
    const score = scoreUpgrade(choice, player);
    if (score > bestScore) {
      best = choice;
      bestScore = score;
    }
  }
  return best;
}

export class AutoplayAgent {
  constructor({ readState, actionSink, onDiagnostic = () => {}, config = {} }) {
    if (typeof readState !== "function") throw new TypeError("AutoplayAgent requires a readState function.");
    if (typeof actionSink !== "function") throw new TypeError("AutoplayAgent requires an actionSink function.");
    this.readState = readState;
    this.actionSink = actionSink;
    this.onDiagnostic = onDiagnostic;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.reset();
  }

  reset() {
    this.elapsed = 0;
    this.attackTimer = 0;
    this.heavyTimer = 0;
    this.dashTimer = 0;
    this.uiTimer = 0;
    this.heavyHoldRemaining = 0;
    this.pendingDashAttack = 0;
    this.pathTimer = 0;
    this.path = [];
    this.pathIndex = 0;
    this.pathTarget = null;
    this.pathKey = null;
    this.lastMove = { x: 0, z: 0 };
    this.progressAnchor = null;
    this.progressElapsed = 0;
    this.recoveryRemaining = 0;
    this.recoveryDirection = { x: 1, z: 0 };
    this.recoveryCount = 0;
  }

  tick(dt) {
    const safeDt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
    this.elapsed += safeDt;
    this.advanceTimers(safeDt);
    const state = this.readState();
    if (!state || typeof state.phase !== "string") throw new TypeError("Autoplay state requires a phase.");
    this.observeProgress(state, safeDt);
    const intent = this.decide(state, safeDt);
    if (state.phase === "playing" && state.player?.position) {
      intent.worldMove = steerFromArenaEdges(intent.worldMove, state.player, state.arena, this.config);
    }
    this.lastMove = { ...intent.worldMove };
    this.actionSink(intent);
    return intent;
  }

  advanceTimers(dt) {
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.heavyTimer = Math.max(0, this.heavyTimer - dt);
    this.dashTimer = Math.max(0, this.dashTimer - dt);
    this.uiTimer = Math.max(0, this.uiTimer - dt);
    this.pathTimer = Math.max(0, this.pathTimer - dt);
    this.recoveryRemaining = Math.max(0, this.recoveryRemaining - dt);
    if (this.pendingDashAttack > 0) this.pendingDashAttack = Math.max(0, this.pendingDashAttack - dt);
  }

  observeProgress(state, dt) {
    if (!state.player?.position || state.phase !== "playing") {
      this.progressAnchor = null;
      this.progressElapsed = 0;
      return;
    }
    if (!this.progressAnchor) this.progressAnchor = { ...state.player.position };
    const requestedMovement = Math.hypot(this.lastMove.x, this.lastMove.z) > 0.3;
    if (!requestedMovement || this.recoveryRemaining > 0) {
      this.progressAnchor = { ...state.player.position };
      this.progressElapsed = 0;
      return;
    }
    if (distance(this.progressAnchor, state.player.position) >= this.config.stuckProgressDistance) {
      this.progressAnchor = { ...state.player.position };
      this.progressElapsed = 0;
      return;
    }
    this.progressElapsed += dt;
    if (this.progressElapsed < this.config.stuckSeconds) return;

    this.recoveryCount += 1;
    const side = this.recoveryCount % 2 === 0 ? -1 : 1;
    this.recoveryDirection = normalize({ x: -this.lastMove.z * side, z: this.lastMove.x * side }, { x: side, z: 0 });
    this.recoveryRemaining = this.config.recoverySeconds;
    this.progressAnchor = { ...state.player.position };
    this.progressElapsed = 0;
    this.invalidatePath();
    this.onDiagnostic({
      type: "stuckRecovery",
      atSeconds: this.elapsed,
      floor: state.floor,
      room: state.room,
      position: { ...state.player.position },
      recoveryCount: this.recoveryCount,
    });
  }

  decide(state) {
    if (state.phase === "dialogue") return this.decideDialogue(state);
    if (state.phase === "reward") return this.decideRoomReward(state);
    if (state.phase === "blessing") return this.decideBlessing(state);
    if (state.phase === "title") return this.decideUiAction("startRun");
    if (state.phase === "dead") return this.decideUiAction("restartRun");
    if (state.phase !== "playing" || !state.player?.position) return defaultIntent(state.phase);

    if (this.recoveryRemaining > 0) {
      const intent = defaultIntent("recover");
      intent.worldMove = { ...this.recoveryDirection };
      intent.recoveryStarted = this.recoveryRemaining >= this.config.recoverySeconds - 0.11;
      return intent;
    }

    const enemies = visibleEnemies(state);
    const threat = collectThreats(state, this.config);
    if (threat && threat.severity >= 1) return this.decideEvade(state, threat, enemies);
    if (enemies.length > 0) return this.decideCombat(state, enemies);
    if (state.portalActive && state.arena?.portal) return this.decidePortal(state);

    const intent = defaultIntent("await-clear");
    const center = { x: 0, z: 0 };
    if (distance(state.player.position, center) > 2.5) intent.worldMove = this.navigate(state, center, "center");
    return intent;
  }

  decideUiAction(type, detail = {}) {
    const intent = defaultIntent(type);
    if (this.uiTimer > 0) return intent;
    intent.uiAction = { type, ...detail };
    this.uiTimer = 0.3;
    return intent;
  }

  decideDialogue(state) {
    if (state.dialogue?.awaitingResponse) return this.decideUiAction("continueDialogue");
    const choices = state.dialogue?.choices ?? [];
    if (choices.length === 0) return defaultIntent("dialogue-wait");
    const preferredIndex = choices.length >= 3 && state.floor >= 10 ? 2 : 0;
    return this.decideUiAction("chooseDialogue", { index: Math.min(preferredIndex, choices.length - 1) });
  }

  decideBlessing(state) {
    const choices = state.blessing?.choices ?? state.blessingChoices ?? [];
    const choice = chooseUpgrade(choices, state.player ?? { health: 1, maxHealth: 1 });
    if (!choice) return defaultIntent("blessing-wait");
    return this.decideUiAction("chooseBlessing", { id: choice.id });
  }

  decideRoomReward(state) {
    const choices = state.reward?.choices ?? [];
    const choice = chooseUpgrade(choices, state.player ?? { health: 1, maxHealth: 1 });
    if (!choice) return defaultIntent("reward-wait");
    return this.decideUiAction("chooseRoomReward", { id: choice.id });
  }

  decideEvade(state, threat, enemies) {
    const intent = defaultIntent("evade");
    intent.worldMove = threat.direction;
    intent.danger = threat.severity;
    const target = selectTarget(state.player, enemies);
    if (target) {
      intent.targetId = target.id;
      intent.aimPoint = { ...target.position };
    }
    const dashReady = state.player.cooldowns?.dashReady ?? this.dashTimer <= 0;
    if ((threat.soonest <= 0.44 || threat.severity >= 2.2) && dashReady) {
      intent.pressed.push("dash");
      this.dashTimer = this.config.dashInterval;
    }
    return intent;
  }

  decideCombat(state, enemies) {
    const player = state.player;
    const target = selectTarget(player, enemies);
    const targetDistance = distance(player.position, target.position);
    const intent = defaultIntent("fight");
    intent.targetId = target.id;
    intent.aimPoint = { ...target.position };

    if (this.heavyHoldRemaining > 0) {
      intent.mode = "charge-heavy";
      intent.held.push("heavy");
      this.heavyHoldRemaining = Math.max(0, this.heavyHoldRemaining - 1 / 60);
      intent.worldMove = this.orbitDirection(player.position, target.position, 0.35);
      return intent;
    }

    if (this.pendingDashAttack > 0 && this.pendingDashAttack <= 0.07) {
      intent.pressed.push("attack");
      this.pendingDashAttack = 0;
      this.attackTimer = this.config.attackInterval;
    }

    if (targetDistance > this.config.idealRange + 0.7) {
      intent.worldMove = this.navigate(state, target.position, `enemy:${target.id}`);
    } else if (targetDistance < this.config.retreatRange) {
      intent.worldMove = normalize({
        x: player.position.x - target.position.x,
        z: player.position.z - target.position.z,
      });
    } else {
      intent.worldMove = this.orbitDirection(player.position, target.position, target.id % 2 === 0 ? 0.65 : -0.65);
    }

    const nearbyCount = enemies.filter((enemy) => distance(player.position, enemy.position) <= this.config.heavyRange).length;
    const heavyReady = state.player.cooldowns?.heavyReady ?? this.heavyTimer <= 0;
    if (targetDistance <= this.config.heavyRange && heavyReady && (nearbyCount >= 3 || target.type === "queen")) {
      intent.mode = "start-heavy";
      intent.pressed.push("heavy");
      intent.held.push("heavy");
      this.heavyHoldRemaining = this.config.heavyHoldSeconds;
      this.heavyTimer = this.config.heavyInterval;
      return intent;
    }

    const dashReady = state.player.cooldowns?.dashReady ?? this.dashTimer <= 0;
    if (
      targetDistance >= this.config.dashEngageMinRange &&
      targetDistance <= this.config.dashEngageMaxRange &&
      dashReady &&
      hasLineOfSight(player.position, target.position, state.arena, this.config.obstaclePadding)
    ) {
      intent.mode = "dash-engage";
      intent.pressed.push("dash");
      this.dashTimer = this.config.dashInterval;
      this.pendingDashAttack = 0.11;
      return intent;
    }

    if (targetDistance <= this.config.attackRange && this.attackTimer <= 0 && !intent.pressed.includes("attack")) {
      intent.pressed.push("attack");
      this.attackTimer = this.config.attackInterval;
    }
    return intent;
  }

  decidePortal(state) {
    const intent = defaultIntent("enter-portal");
    const portal = state.arena.portal;
    intent.aimPoint = { ...portal };
    const portalDistance = distance(state.player.position, portal);
    if (portalDistance > 0.35) intent.worldMove = this.navigate(state, portal, "portal");
    return intent;
  }

  orbitDirection(origin, target, tangentWeight) {
    const toward = normalize({ x: target.x - origin.x, z: target.z - origin.z });
    return normalize({
      x: toward.x * 0.12 - toward.z * tangentWeight,
      z: toward.z * 0.12 + toward.x * tangentWeight,
    });
  }

  navigate(state, target, key) {
    const position = state.player.position;
    if (hasLineOfSight(position, target, state.arena, this.config.obstaclePadding)) {
      this.invalidatePath();
      return normalize({ x: target.x - position.x, z: target.z - position.z });
    }

    const targetMoved = !this.pathTarget || distance(this.pathTarget, target) > 1.2;
    if (this.pathTimer <= 0 || this.pathKey !== key || targetMoved || this.path.length === 0) {
      this.path = findNavigationPath(position, target, state.arena, {
        cellSize: this.config.pathCellSize,
        padding: this.config.obstaclePadding,
      });
      this.pathIndex = this.path.length > 1 ? 1 : 0;
      this.pathTarget = { ...target };
      this.pathKey = key;
      this.pathTimer = this.config.pathRefreshSeconds;
    }

    while (this.pathIndex < this.path.length - 1 && distance(position, this.path[this.pathIndex]) <= this.config.waypointRadius) {
      this.pathIndex += 1;
    }
    const waypoint = this.path[this.pathIndex] ?? target;
    return normalize({ x: waypoint.x - position.x, z: waypoint.z - position.z });
  }

  invalidatePath() {
    this.path = [];
    this.pathIndex = 0;
    this.pathTarget = null;
    this.pathKey = null;
    this.pathTimer = 0;
  }
}
