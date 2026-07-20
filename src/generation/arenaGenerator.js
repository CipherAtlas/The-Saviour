import {
  createNavigationCells,
  getWalkableRegions,
  isCircleWalkable,
  isPointWalkable,
} from "../game/arenaGeometry.js";
import { PORTAL_CONFIG } from "../game/gameConfig.js";
import { chooseArenaLayout, instantiateArenaLayout } from "./arenaLayouts.js";
import { chooseEnvironmentTheme } from "./biomes.js";
import { SeededRandom } from "./seededRandom.js";

const CELL_SIZE = 1;
const MAX_NORMAL_ACTOR_RADIUS = 0.84;
const SPAWN_POINT_RADIUS = 0.92;
const MIN_SPAWN_SEPARATION = 2.35;

function overlapsExpanded(a, b, padding) {
  return !(
    a.x + a.width / 2 + padding < b.x - b.width / 2
    || a.x - a.width / 2 - padding > b.x + b.width / 2
    || a.z + a.depth / 2 + padding < b.z - b.depth / 2
    || a.z - a.depth / 2 - padding > b.z + b.depth / 2
  );
}

function pointInsideObstacle(x, z, obstacle, padding = 0) {
  return (
    x >= obstacle.x - obstacle.width / 2 - padding
    && x <= obstacle.x + obstacle.width / 2 + padding
    && z >= obstacle.z - obstacle.depth / 2 - padding
    && z <= obstacle.z + obstacle.depth / 2 + padding
  );
}

function isPositionOpen(position, arena, radius = MAX_NORMAL_ACTOR_RADIUS) {
  return isCircleWalkable(arena, position, radius)
    && !arena.obstacles.some((obstacle) => pointInsideObstacle(position.x, position.z, obstacle, radius));
}

function obstacleFitsWalkableShape(arena, obstacle, clearance = 0.22) {
  const halfWidth = obstacle.width / 2;
  const halfDepth = obstacle.depth / 2;
  const samples = [
    { x: obstacle.x, z: obstacle.z },
    { x: obstacle.x - halfWidth, z: obstacle.z - halfDepth },
    { x: obstacle.x + halfWidth, z: obstacle.z - halfDepth },
    { x: obstacle.x - halfWidth, z: obstacle.z + halfDepth },
    { x: obstacle.x + halfWidth, z: obstacle.z + halfDepth },
    { x: obstacle.x - halfWidth, z: obstacle.z },
    { x: obstacle.x + halfWidth, z: obstacle.z },
    { x: obstacle.x, z: obstacle.z - halfDepth },
    { x: obstacle.x, z: obstacle.z + halfDepth },
  ];
  return samples.every((sample) => isCircleWalkable(arena, sample, clearance));
}

function gridKey(column, row) {
  return `${column},${row}`;
}

function traversableNavigationCells(arena, clearance) {
  return createNavigationCells(arena, { cellSize: CELL_SIZE, clearance })
    .filter((cell) => !arena.obstacles.some((obstacle) => pointInsideObstacle(cell.x, cell.z, obstacle, clearance)));
}

function closestCellKey(cells, point, maximumDistance = 2) {
  let closest = null;
  let closestDistance = maximumDistance;
  for (const cell of cells) {
    const distance = Math.hypot(cell.x - point.x, cell.z - point.z);
    if (distance < closestDistance) {
      closest = cell;
      closestDistance = distance;
    }
  }
  return closest ? gridKey(closest.column, closest.row) : null;
}

export function reachableCells(arena, start = arena.playerSpawn, clearance = MAX_NORMAL_ACTOR_RADIUS) {
  const cells = traversableNavigationCells(arena, clearance);
  const cellsByKey = new Map(cells.map((cell) => [gridKey(cell.column, cell.row), cell]));
  const startKey = closestCellKey(cells, start);
  if (!startKey) return new Set();
  const queue = [startKey];
  const visited = new Set(queue);

  for (let index = 0; index < queue.length; index += 1) {
    const current = cellsByKey.get(queue[index]);
    for (const [nextColumn, nextRow] of [
      [current.column + 1, current.row],
      [current.column - 1, current.row],
      [current.column, current.row + 1],
      [current.column, current.row - 1],
    ]) {
      const key = gridKey(nextColumn, nextRow);
      if (!cellsByKey.has(key) || visited.has(key)) continue;
      visited.add(key);
      queue.push(key);
    }
  }

  return visited;
}

function requiredPositionIsReachable(position, visited, cells) {
  const key = closestCellKey(cells, position);
  return key !== null && visited.has(key);
}

export function validateArena(arena) {
  if (arena.walkableShape?.kind !== "regionUnion") return false;
  if (arena.walkableShape.connectors.some((entry) => entry.width < 8)) return false;
  if (!isPositionOpen(arena.playerSpawn, arena, 0.58)) return false;
  if (!isPositionOpen(arena.portal, arena, PORTAL_CONFIG.clearanceRadius)) return false;
  if (arena.rewardPosition && !isPositionOpen(arena.rewardPosition, arena, 1.15)) return false;
  if ((arena.combatZones ?? []).some((position) => !isPositionOpen(position, arena, MAX_NORMAL_ACTOR_RADIUS))) return false;
  if (arena.enemySpawnPoints.some((position) => !isPositionOpen(position, arena, MAX_NORMAL_ACTOR_RADIUS))) return false;
  if (arena.obstacles.some((obstacle) => !obstacleFitsWalkableShape(arena, obstacle))) return false;

  const cells = traversableNavigationCells(arena, MAX_NORMAL_ACTOR_RADIUS);
  const visited = reachableCells(arena, arena.playerSpawn, MAX_NORMAL_ACTOR_RADIUS);
  const required = [
    arena.portal,
    arena.rewardPosition,
    ...(arena.combatZones ?? []),
    ...arena.enemySpawnPoints,
  ].filter(Boolean);
  return required.every((position) => requiredPositionIsReachable(position, visited, cells));
}

function nearestMajorRegionId(arena, point) {
  const regions = getWalkableRegions(arena);
  const majorIds = new Set(arena.walkableShape.majorRegionIds);
  return regions
    .filter((region) => majorIds.has(region.id))
    .map((region) => ({ id: region.id, distance: Math.hypot(point.x - region.x, point.z - region.z) }))
    .sort((left, right) => left.distance - right.distance || left.id.localeCompare(right.id))[0]?.id;
}

function createSpawnPoints(arena, rng, count) {
  const candidates = traversableNavigationCells(arena, SPAWN_POINT_RADIUS)
    .filter((cell) => Math.hypot(cell.x - arena.playerSpawn.x, cell.z - arena.playerSpawn.z) >= 1.7)
    .filter((cell) => Math.hypot(cell.x - arena.portal.x, cell.z - arena.portal.z) >= PORTAL_CONFIG.clearanceRadius + 0.8)
    .map((cell) => ({
      x: cell.x,
      z: cell.z,
      regionId: nearestMajorRegionId(arena, cell),
    }));
  const shuffled = rng.shuffle(candidates);
  const points = [];
  const canAdd = (candidate) => points.every(
    (other) => Math.hypot(other.x - candidate.x, other.z - candidate.z) >= MIN_SPAWN_SEPARATION,
  );
  const majorRegionIds = arena.walkableShape.majorRegionIds;
  const perRegionTarget = Math.max(4, Math.floor(count / Math.max(1, majorRegionIds.length)));

  const nearby = shuffled.find((candidate) => {
    const distance = Math.hypot(candidate.x - arena.playerSpawn.x, candidate.z - arena.playerSpawn.z);
    return distance >= 2.2 && distance <= 5.5;
  });
  if (nearby) points.push(nearby);

  for (const regionId of majorRegionIds) {
    for (const candidate of shuffled) {
      if (candidate.regionId !== regionId || !canAdd(candidate)) continue;
      points.push(candidate);
      if (points.filter((entry) => entry.regionId === regionId).length >= perRegionTarget) break;
    }
  }
  for (const candidate of shuffled) {
    if (points.length >= count) break;
    if (canAdd(candidate)) points.push(candidate);
  }

  return points.map(({ x, z }) => ({ x, z }));
}

function createSpawnGroups(arena) {
  return arena.combatZones.map((combatZone) => ({
    id: combatZone.id,
    spawnIndices: arena.enemySpawnPoints
      .map((spawnPoint, index) => ({
        index,
        distance: Math.hypot(spawnPoint.x - combatZone.x, spawnPoint.z - combatZone.z),
      }))
      .sort((left, right) => left.distance - right.distance || left.index - right.index)
      .slice(0, Math.max(4, Math.ceil(arena.enemySpawnPoints.length / arena.combatZones.length)))
      .map((entry) => entry.index),
  }));
}

function repairArenaLocally(arena, rng, spawnCount) {
  const minimumSpawnCount = Math.min(16, spawnCount);
  for (let repair = 0; repair <= arena.obstacles.length; repair += 1) {
    arena.enemySpawnPoints = createSpawnPoints(arena, rng.fork(`spawns-${repair}`), spawnCount);
    if (arena.enemySpawnPoints.length >= minimumSpawnCount && validateArena(arena)) return true;
    if (arena.obstacles.length <= 2) break;

    const objectives = [arena.playerSpawn, arena.portal, arena.rewardPosition, ...arena.combatZones];
    const removeIndex = arena.obstacles
      .map((obstacle, index) => ({
        index,
        distance: Math.min(...objectives.map((position) => Math.hypot(obstacle.x - position.x, obstacle.z - position.z))),
      }))
      .sort((left, right) => left.distance - right.distance || left.index - right.index)[0].index;
    arena.obstacles.splice(removeIndex, 1);
  }
  return false;
}

function createDecorProps(arena, rng, theme) {
  const props = [];
  const targetCount = arena.boss ? 12 : rng.int(8, 15);
  const candidates = rng.shuffle(createNavigationCells(arena, { cellSize: 1.4, clearance: 0.5 }));
  for (const position of candidates) {
    if (props.length >= targetCount) break;
    const clearOfObjectives = [arena.playerSpawn, arena.portal, arena.rewardPosition]
      .filter(Boolean)
      .every((objective) => Math.hypot(position.x - objective.x, position.z - objective.z) > 3.5);
    const clearOfObstacles = arena.obstacles.every(
      (obstacle) => !pointInsideObstacle(position.x, position.z, obstacle, 1.1),
    );
    const clearOfProps = props.every((prop) => Math.hypot(position.x - prop.x, position.z - prop.z) > 1.3);
    if (!clearOfObjectives || !clearOfObstacles || !clearOfProps) continue;
    props.push({
      x: position.x + rng.float(-0.28, 0.28),
      z: position.z + rng.float(-0.28, 0.28),
      rotation: rng.float(0, Math.PI * 2),
      scale: rng.float(0.78, 1.18),
      modelKey: rng.pick(theme.propModels),
      decalIndex: rng.int(0, 7),
    });
  }
  return props;
}

export function generateArena({ seed, floor, room, boss = false }) {
  const rng = new SeededRandom(`${seed}:floor-${floor}:room-${room}`);
  const environmentTheme = chooseEnvironmentTheme(rng.fork("environment-theme"));
  const layoutDefinition = chooseArenaLayout({
    seed,
    floor,
    room,
    boss,
    rng: rng.fork("layout-choice"),
  });
  const layout = instantiateArenaLayout(layoutDefinition, rng.fork("layout-shape"), { floor, room, boss });
  const arena = {
    id: `${floor}-${room}`,
    floor,
    room,
    boss,
    environmentTheme: environmentTheme.id,
    environmentThemeName: environmentTheme.name,
    // Compatibility aliases for renderer/audio consumers while the product contract moves away from biomes.
    biome: environmentTheme.id,
    biomeName: environmentTheme.name,
    layoutFamily: layout.layoutFamily,
    layoutComplexity: layout.layoutComplexity,
    width: layout.width,
    depth: layout.depth,
    walkableShape: layout.walkableShape,
    obstacles: [],
    props: [],
    playerSpawn: layout.playerSpawn,
    portal: layout.portal,
    rewardPosition: layout.rewardPosition,
    combatZones: layout.combatZones,
    spawnGroups: [],
    enemySpawnPoints: [],
  };

  const protectedZones = [
    { ...arena.playerSpawn, width: 7, depth: 6 },
    {
      ...arena.portal,
      width: PORTAL_CONFIG.clearanceRadius * 2,
      depth: PORTAL_CONFIG.clearanceRadius * 2,
    },
    { ...arena.rewardPosition, width: 4, depth: 4 },
    ...arena.combatZones.map((combatZone) => ({
      ...combatZone,
      width: boss ? 11 : 1.8,
      depth: boss ? 10 : 1.8,
    })),
  ];
  for (const candidate of layout.obstacleSlots) {
    const obstacle = {
      ...candidate,
      height: candidate.height * rng.float(0.9, 1.12),
      modelKey: rng.pick(environmentTheme.obstacleModels),
    };
    if (!obstacleFitsWalkableShape(arena, obstacle)) continue;
    if (protectedZones.some((protectedZone) => overlapsExpanded(obstacle, protectedZone, boss ? 1.8 : 1.05))) continue;
    if (arena.obstacles.some((other) => overlapsExpanded(obstacle, other, 2.2))) continue;
    arena.obstacles.push(obstacle);
  }

  const spawnCount = boss ? 16 : 24;
  const repaired = repairArenaLocally(arena, rng.fork("repair"), spawnCount);
  if (!repaired) {
    throw new Error(`Arena generation failed for seed ${seed}, floor ${floor}, room ${room}, layout ${arena.layoutFamily}.`);
  }
  arena.spawnGroups = createSpawnGroups(arena);
  arena.props = createDecorProps(arena, rng.fork("decor"), environmentTheme);

  return arena;
}

export function arenaContainsOnlyWalkableContent(arena) {
  return arena.props.every((prop) => isPointWalkable(arena, prop))
    && arena.obstacles.every((obstacle) => obstacleFitsWalkableShape(arena, obstacle));
}
