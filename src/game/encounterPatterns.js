import { encounterWeightsForFloor, getEnemyArchetype } from "./enemyArchetypes.js";
import { getBiome } from "../generation/biomes.js";

const ROLE_GROUPS = Object.freeze({
  frontline: Object.freeze(["thrall", "boneguard"]),
  mobile: Object.freeze(["reaver", "wraith"]),
  ranged: Object.freeze(["hexer", "bombardier"]),
});

export const ENEMY_ORIGINS = Object.freeze({
  WITCH: "witch",
  PRINCESS: "princess",
});

const PRINCESS_ORIGIN_QUOTAS = Object.freeze([
  Object.freeze([0, 0, 0]),
  Object.freeze([0, 1, 1]),
  Object.freeze([1, 1, 1]),
  Object.freeze([1, 1, 2]),
  Object.freeze([2, 2, 2]),
  Object.freeze([2, 3, 3]),
  Object.freeze([3, 4, 5]),
  Object.freeze([4, 5, 6]),
  Object.freeze([5, 6, 7]),
  Object.freeze([7, 8, 0]),
]);

const PRINCESS_ORIGIN_AFFINITY = Object.freeze({
  thrall: 1,
  wraith: 0.9,
  reaver: 0.75,
  bombardier: 0.55,
  hexer: 0.35,
  boneguard: 0.15,
});

export function princessOriginQuota(floor, room, count) {
  const floorQuotas = PRINCESS_ORIGIN_QUOTAS[Math.max(1, Math.min(10, floor)) - 1];
  const quota = floorQuotas?.[Math.max(1, Math.min(3, room)) - 1] ?? 0;
  return Math.min(count, quota);
}

function targetEnemyCount(floor, room) {
  return Math.min(15, 3 + Math.floor(floor * 0.72) + Math.floor((room - 1) * 1.5));
}

function targetWaveCount(floor, room, count) {
  if (count <= 4) return 1;
  if (room === 3 && floor >= 6) return 3;
  return 2;
}

function adjustedWeights(floor, biome) {
  const bias = getBiome(biome).gameplay.encounterBias;
  return encounterWeightsForFloor(floor).map((entry) => ({
    value: entry.value,
    weight: entry.weight * (bias[entry.value] ?? 1),
  }));
}

function eligibleFromGroup(weights, group) {
  return ROLE_GROUPS[group].filter((type) => weights.some((entry) => entry.value === type && entry.weight > 0));
}

function addGuaranteedRoles(types, weights, floor, room, rng) {
  const guarantees = ["frontline"];
  if (floor >= 2) guarantees.push("ranged");
  if (floor >= 3 && room >= 2) guarantees.push("mobile");
  for (const role of guarantees) {
    const choices = eligibleFromGroup(weights, role);
    if (choices.length > 0) types.push(rng.pick(choices));
  }
}

function assignOrigins(types, floor, room, rng) {
  const princessCount = princessOriginQuota(floor, room, types.length);
  const ranked = types.map((type, index) => ({
    index,
    score: (PRINCESS_ORIGIN_AFFINITY[type] ?? 0) + rng.float(0, 0.35),
  })).sort((left, right) => right.score - left.score || left.index - right.index);
  const princessIndexes = new Set(ranked.slice(0, princessCount).map((entry) => entry.index));
  return types.map((type, index) => ({
    type,
    origin: princessIndexes.has(index) ? ENEMY_ORIGINS.PRINCESS : ENEMY_ORIGINS.WITCH,
    originPhase: rng.float(0, Math.PI * 2),
  }));
}

function distributeAcrossWaves(entries, waveCount, rng, spawnCount) {
  const shuffled = rng.shuffle(entries);
  const waves = Array.from({ length: waveCount }, (_unused, index) => ({
    index,
    delay: index === 0 ? 0 : 0.52 + index * 0.08,
    entries: [],
  }));
  for (let index = 0; index < shuffled.length; index += 1) {
    const wave = waves[index % waveCount];
    wave.entries.push({
      ...shuffled[index],
      spawnIndex: (index * 5 + wave.index * 3) % Math.max(1, spawnCount),
      formationIndex: wave.entries.length,
    });
  }
  return waves;
}

export function createEncounterPlan({ floor, room, biome, spawnPoints, rng }) {
  const count = targetEnemyCount(floor, room);
  const waveCount = targetWaveCount(floor, room, count);
  const weights = adjustedWeights(floor, biome);
  const types = [];
  addGuaranteedRoles(types, weights, floor, room, rng);
  while (types.length < count) types.push(rng.weighted(weights));

  const roster = types.slice(0, count);
  const originEntries = assignOrigins(roster, floor, room, rng.fork("enemy-origins"));
  const waves = distributeAcrossWaves(originEntries, waveCount, rng, spawnPoints.length);
  return {
    id: `${floor}-${room}-${biome}`,
    floor,
    room,
    biome,
    threat: roster.reduce((sum, type) => sum + getEnemyArchetype(type).threat, 0),
    waves,
  };
}

export { ROLE_GROUPS };
