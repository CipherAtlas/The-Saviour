import { SeededRandom } from "./seededRandom.js";
import { chooseBiome } from "./biomes.js";
import { chooseArenaLayout, instantiateArenaLayout } from "./arenaLayouts.js";
import { PORTAL_CONFIG } from "../game/gameConfig.js";

const CELL_SIZE = 1;

function overlapsExpanded(a, b, padding) {
  return !(
    a.x + a.width / 2 + padding < b.x - b.width / 2 ||
    a.x - a.width / 2 - padding > b.x + b.width / 2 ||
    a.z + a.depth / 2 + padding < b.z - b.depth / 2 ||
    a.z - a.depth / 2 - padding > b.z + b.depth / 2
  );
}

function pointInsideObstacle(x, z, obstacle, padding = 0) {
  return (
    x >= obstacle.x - obstacle.width / 2 - padding &&
    x <= obstacle.x + obstacle.width / 2 + padding &&
    z >= obstacle.z - obstacle.depth / 2 - padding &&
    z <= obstacle.z + obstacle.depth / 2 + padding
  );
}

function isPositionOpen(position, arena, padding = 0.9) {
  const halfWidth = arena.width / 2 - 1 - padding;
  const halfDepth = arena.depth / 2 - 1 - padding;
  if (Math.abs(position.x) > halfWidth || Math.abs(position.z) > halfDepth) return false;
  return !arena.obstacles.some((obstacle) => pointInsideObstacle(position.x, position.z, obstacle, padding));
}

function gridKey(x, z) {
  return `${x},${z}`;
}

export function reachableCells(arena, start = arena.playerSpawn) {
  const minX = Math.ceil(-arena.width / 2 + 1);
  const maxX = Math.floor(arena.width / 2 - 1);
  const minZ = Math.ceil(-arena.depth / 2 + 1);
  const maxZ = Math.floor(arena.depth / 2 - 1);
  const startX = Math.round(start.x / CELL_SIZE);
  const startZ = Math.round(start.z / CELL_SIZE);
  const queue = [[startX, startZ]];
  const visited = new Set([gridKey(startX, startZ)]);

  for (let index = 0; index < queue.length; index += 1) {
    const [x, z] = queue[index];
    for (const [nextX, nextZ] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) {
      const key = gridKey(nextX, nextZ);
      if (nextX < minX || nextX > maxX || nextZ < minZ || nextZ > maxZ || visited.has(key)) continue;
      if (arena.obstacles.some((obstacle) => pointInsideObstacle(nextX, nextZ, obstacle, 0.8))) continue;
      visited.add(key);
      queue.push([nextX, nextZ]);
    }
  }

  return visited;
}

export function validateArena(arena) {
  if (!isPositionOpen(arena.playerSpawn, arena, 1.3)) return false;
  if (!isPositionOpen(arena.portal, arena, PORTAL_CONFIG.clearanceRadius)) return false;
  if (arena.rewardPosition && !isPositionOpen(arena.rewardPosition, arena, 1.15)) return false;
  const reachable = reachableCells(arena);
  const required = [arena.portal, arena.rewardPosition, ...(arena.combatZones ?? []), ...arena.enemySpawnPoints].filter(Boolean);
  return required.every((position) => reachable.has(gridKey(Math.round(position.x), Math.round(position.z))));
}

function createSpawnPoints(arena, rng, count) {
  const points = [];
  const candidates = [];
  const halfWidth = arena.width / 2 - 2.4;
  const halfDepth = arena.depth / 2 - 2.4;

  for (let index = 0; index < 72; index += 1) {
    const side = index % 4;
    let point;
    if (side === 0) point = { x: rng.float(-halfWidth, halfWidth), z: halfDepth };
    if (side === 1) point = { x: halfWidth, z: rng.float(-halfDepth, halfDepth) };
    if (side === 2) point = { x: rng.float(-halfWidth, halfWidth), z: -halfDepth };
    if (side === 3) point = { x: -halfWidth, z: rng.float(-halfDepth, halfDepth) };
    if (isPositionOpen(point, arena, 1.1) && Math.hypot(point.x - arena.playerSpawn.x, point.z - arena.playerSpawn.z) > 7) {
      candidates.push(point);
    }
  }

  for (const point of rng.shuffle(candidates)) {
    if (points.every((other) => Math.hypot(other.x - point.x, other.z - point.z) > 2.45)) points.push(point);
    if (points.length >= count) break;
  }

  return points;
}

function createSpawnGroups(arena) {
  return arena.combatZones.map((zone) => ({
    id: zone.id,
    spawnIndices: arena.enemySpawnPoints
      .map((point, index) => ({ index, distance: Math.hypot(point.x - zone.x, point.z - zone.z) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, Math.max(4, Math.ceil(arena.enemySpawnPoints.length / arena.combatZones.length)))
      .map((entry) => entry.index),
  }));
}

function repairArenaLocally(arena, rng, spawnCount) {
  for (let repair = 0; repair <= arena.obstacles.length; repair += 1) {
    arena.enemySpawnPoints = createSpawnPoints(arena, rng.fork(`spawns-${repair}`), spawnCount);
    if (arena.enemySpawnPoints.length >= 8 && validateArena(arena)) return true;
    if (arena.obstacles.length === 0) break;
    let removeIndex = 0;
    let nearestObjective = Infinity;
    const objectives = [arena.playerSpawn, arena.portal, arena.rewardPosition, ...arena.combatZones];
    for (let index = 0; index < arena.obstacles.length; index += 1) {
      const obstacle = arena.obstacles[index];
      const distance = Math.min(...objectives.map((point) => Math.hypot(obstacle.x - point.x, obstacle.z - point.z)));
      if (distance < nearestObjective) {
        nearestObjective = distance;
        removeIndex = index;
      }
    }
    arena.obstacles.splice(removeIndex, 1);
  }
  return false;
}

function createDecorProps(arena, rng, biome) {
  const props = [];
  const targetCount = arena.boss ? 12 : rng.int(8, 15);
  for (let attempt = 0; attempt < 100 && props.length < targetCount; attempt += 1) {
    const position = {
      x: rng.float(-arena.width / 2 + 1.5, arena.width / 2 - 1.5),
      z: rng.float(-arena.depth / 2 + 1.5, arena.depth / 2 - 1.5),
    };
    const clearOfObjectives = [arena.playerSpawn, arena.portal].every((point) => Math.hypot(position.x - point.x, position.z - point.z) > 3.5);
    const clearOfObstacles = arena.obstacles.every((obstacle) => !pointInsideObstacle(position.x, position.z, obstacle, 1.1));
    const clearOfProps = props.every((prop) => Math.hypot(position.x - prop.x, position.z - prop.z) > 1.25);
    if (!clearOfObjectives || !clearOfObstacles || !clearOfProps) continue;
    props.push({
      x: position.x,
      z: position.z,
      rotation: rng.float(0, Math.PI * 2),
      scale: rng.float(0.78, 1.18),
      modelKey: rng.pick(biome.propModels),
      decalIndex: rng.int(0, 7),
    });
  }
  return props;
}

export function generateArena({ seed, floor, room, boss = false }) {
  const rng = new SeededRandom(`${seed}:floor-${floor}:room-${room}`);
  const biome = chooseBiome(floor, rng.fork("biome"));
  const layoutDefinition = chooseArenaLayout({ floor, room, boss, biome, rng: rng.fork("layout-choice") });
  const layout = instantiateArenaLayout(layoutDefinition, rng.fork("layout-shape"));
  const { width, depth } = layout;
  const arena = {
    id: `${floor}-${room}`,
    floor,
    room,
    boss,
    biome: biome.id,
    biomeName: biome.name,
    biomeIdentity: biome.gameplay.identity,
    layoutFamily: layout.layoutFamily,
    width,
    depth,
    obstacles: [],
    props: [],
    playerSpawn: { x: 0, z: -depth / 2 + 3.5 },
    portal: { x: 0, z: 0 },
    rewardPosition: { x: 0, z: depth / 2 - 5.6 },
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
    ...arena.combatZones.map((zone) => ({ ...zone, width: boss ? 10 : 3.5, depth: boss ? 9 : 3.5 })),
  ];
  for (const candidate of layout.obstacleSlots) {
    const obstacle = {
      ...candidate,
      height: candidate.height * rng.float(0.9, 1.12),
      modelKey: rng.pick(biome.obstacleModels),
    };
    if (protectedZones.some((zone) => overlapsExpanded(obstacle, zone, boss ? 1.8 : 1.1))) continue;
    if (arena.obstacles.some((other) => overlapsExpanded(obstacle, other, 2.25))) continue;
    arena.obstacles.push(obstacle);
  }

  const spawnCount = boss ? 14 : 18;
  repairArenaLocally(arena, rng.fork("repair"), spawnCount);
  arena.spawnGroups = createSpawnGroups(arena);

  arena.props = createDecorProps(arena, rng.fork("decor"), biome);

  return arena;
}
