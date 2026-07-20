import { isCircleWalkable, isWalkableSegment, nearestWalkablePoint } from "./arenaGeometry.js";

const DEFAULT_CELL_SIZE = 1.1;
const DEFAULT_PADDING = 0.84;

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

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
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

function pushOpen(heap, entry) {
  heap.push(entry);
  let index = heap.length - 1;
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (heap[parent].score <= entry.score) break;
    heap[index] = heap[parent];
    index = parent;
  }
  heap[index] = entry;
}

function popOpen(heap) {
  if (heap.length === 1) return heap.pop();
  const result = heap[0];
  const tail = heap.pop();
  let index = 0;
  while (true) {
    const left = index * 2 + 1;
    if (left >= heap.length) break;
    const right = left + 1;
    const child = right < heap.length && heap[right].score < heap[left].score ? right : left;
    if (heap[child].score >= tail.score) break;
    heap[index] = heap[child];
    index = child;
  }
  heap[index] = tail;
  return result;
}

function pointInsideExpandedObstacle(point, obstacle, padding) {
  return (
    point.x >= obstacle.x - obstacle.width / 2 - padding
    && point.x <= obstacle.x + obstacle.width / 2 + padding
    && point.z >= obstacle.z - obstacle.depth / 2 - padding
    && point.z <= obstacle.z + obstacle.depth / 2 + padding
  );
}

function isWalkable(point, arena, padding) {
  if (arena.walkableShape) {
    if (!isCircleWalkable(arena, point, padding)) return false;
    return !(arena.obstacles ?? []).some((obstacle) => pointInsideExpandedObstacle(point, obstacle, padding));
  }
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

export function hasLineOfSight(start, end, arena, padding = DEFAULT_PADDING) {
  if (arena?.walkableShape && !isWalkableSegment(arena, start, end, padding)) return false;
  return !(arena?.obstacles ?? []).some((obstacle) => lineCrossesObstacle(start, end, obstacle, padding));
}

function nearestWalkableCell(origin, arena, cellSize, padding) {
  if (isWalkable(gridToWorld(origin, cellSize), arena, padding)) return origin;
  if (arena.walkableShape) {
    const repaired = nearestWalkablePoint(arena, gridToWorld(origin, cellSize), padding);
    const repairedCell = worldToGrid(repaired, cellSize);
    if (isWalkable(gridToWorld(repairedCell, cellSize), arena, padding)) return repairedCell;
  }
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
  const cellSize = options.cellSize ?? DEFAULT_CELL_SIZE;
  const padding = options.padding ?? DEFAULT_PADDING;
  if (!arena || !Number.isFinite(arena.width) || !Number.isFinite(arena.depth)) return [{ ...target }];
  if (hasLineOfSight(start, target, arena, padding)) return [{ ...start }, { ...target }];

  const rawStart = worldToGrid(start, cellSize);
  const rawGoal = worldToGrid(target, cellSize);
  const startCell = nearestWalkableCell(rawStart, arena, cellSize, padding);
  const goalCell = nearestWalkableCell(rawGoal, arena, cellSize, padding);
  if (!startCell || !goalCell) return [];

  const startKey = gridKey(startCell.x, startCell.z);
  const goalKey = gridKey(goalCell.x, goalCell.z);
  const open = [{ key: startKey, score: 0 }];
  const openScores = new Map([[startKey, 0]]);
  const cameFrom = new Map();
  const cells = new Map([[startKey, startCell]]);
  const costs = new Map([[startKey, 0]]);

  while (open.length > 0) {
    const currentEntry = popOpen(open);
    const currentKey = currentEntry.key;
    if (currentEntry.score !== openScores.get(currentKey)) continue;

    if (currentKey === goalKey) return reconstructPath(cameFrom, cells, currentKey, cellSize, target);
    openScores.delete(currentKey);
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
      const score = nextCost + heuristic;
      openScores.set(nextKey, score);
      pushOpen(open, { key: nextKey, score });
    }
  }

  return [];
}
