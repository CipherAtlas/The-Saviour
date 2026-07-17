const TAU = Math.PI * 2;

function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= TAU;
  while (angle < -Math.PI) angle += TAU;
  return angle;
}

export function circleIntersectsArc(origin, facing, range, arc, target, targetRadius = 0) {
  const dx = target.x - origin.x;
  const dz = target.z - origin.z;
  const distance = Math.hypot(dx, dz);
  if (distance > range + targetRadius) return false;
  if (arc >= TAU - 0.001) return true;
  const targetAngle = Math.atan2(dz, dx);
  const angularPadding = distance > 0.001 ? Math.asin(Math.min(1, targetRadius / distance)) : Math.PI;
  return Math.abs(normalizeAngle(targetAngle - facing)) <= arc / 2 + angularPadding;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function resolveObstacleAxis(position, radius, obstacle, axis) {
  const minX = obstacle.x - obstacle.width / 2;
  const maxX = obstacle.x + obstacle.width / 2;
  const minZ = obstacle.z - obstacle.depth / 2;
  const maxZ = obstacle.z + obstacle.depth / 2;
  const closestX = clamp(position.x, minX, maxX);
  const closestZ = clamp(position.z, minZ, maxZ);
  const dx = position.x - closestX;
  const dz = position.z - closestZ;
  if (dx * dx + dz * dz >= radius * radius) return;

  if (axis === "x") {
    position.x = position.x < obstacle.x ? minX - radius : maxX + radius;
  } else {
    position.z = position.z < obstacle.z ? minZ - radius : maxZ + radius;
  }
}

export function moveCircleDetailed(position, velocity, dt, radius, arena) {
  const next = { x: position.x, z: position.z };
  const halfWidth = arena.width / 2 - 1 - radius;
  const halfDepth = arena.depth / 2 - 1 - radius;
  let blockedX = false;
  let blockedZ = false;

  const totalX = velocity.x * dt;
  const totalZ = velocity.z * dt;
  const maxDistance = Math.max(Math.abs(totalX), Math.abs(totalZ));
  const steps = Math.max(1, Math.ceil(maxDistance / Math.max(0.2, radius * 0.7)));
  const stepX = totalX / steps;
  const stepZ = totalZ / steps;

  for (let step = 0; step < steps; step += 1) {
    const desiredX = next.x + stepX;
    next.x = clamp(desiredX, -halfWidth, halfWidth);
    for (const obstacle of arena.obstacles) resolveObstacleAxis(next, radius, obstacle, "x");
    if (Math.abs(next.x - desiredX) > 0.0001) blockedX = true;

    const desiredZ = next.z + stepZ;
    next.z = clamp(desiredZ, -halfDepth, halfDepth);
    for (const obstacle of arena.obstacles) resolveObstacleAxis(next, radius, obstacle, "z");
    if (Math.abs(next.z - desiredZ) > 0.0001) blockedZ = true;
  }

  return { position: next, blockedX, blockedZ };
}

export function moveCircle(position, velocity, dt, radius, arena) {
  return moveCircleDetailed(position, velocity, dt, radius, arena).position;
}

export function separateCircles(actors) {
  for (let first = 0; first < actors.length; first += 1) {
    const a = actors[first];
    if (!a.active) continue;
    for (let second = first + 1; second < actors.length; second += 1) {
      const b = actors[second];
      if (!b.active) continue;
      const dx = b.position.x - a.position.x;
      const dz = b.position.z - a.position.z;
      const minimum = a.radius + b.radius;
      const distanceSquared = dx * dx + dz * dz;
      if (distanceSquared >= minimum * minimum || distanceSquared < 0.0001) continue;
      const distance = Math.sqrt(distanceSquared);
      const overlap = (minimum - distance) * 0.5;
      const nx = dx / distance;
      const nz = dz / distance;
      a.position.x -= nx * overlap;
      a.position.z -= nz * overlap;
      b.position.x += nx * overlap;
      b.position.z += nz * overlap;
    }
  }
}

export class SpatialHash {
  constructor(cellSize = 5) {
    this.cellSize = cellSize;
    this.cells = new Map();
    this.results = [];
  }

  key(x, z) {
    return `${Math.floor(x / this.cellSize)},${Math.floor(z / this.cellSize)}`;
  }

  rebuild(actors) {
    this.cells.clear();
    for (const actor of actors) {
      if (!actor.active) continue;
      const key = this.key(actor.position.x, actor.position.z);
      const cell = this.cells.get(key);
      if (cell) cell.push(actor);
      else this.cells.set(key, [actor]);
    }
  }

  query(x, z, radius) {
    this.results.length = 0;
    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minZ = Math.floor((z - radius) / this.cellSize);
    const maxZ = Math.floor((z + radius) / this.cellSize);
    for (let cellX = minX; cellX <= maxX; cellX += 1) {
      for (let cellZ = minZ; cellZ <= maxZ; cellZ += 1) {
        const cell = this.cells.get(`${cellX},${cellZ}`);
        if (cell) this.results.push(...cell);
      }
    }
    return this.results;
  }
}
