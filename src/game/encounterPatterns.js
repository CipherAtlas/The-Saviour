import { encounterWeightsForFloor, getEnemyArchetype } from "./enemyArchetypes.js";
import { getBiome } from "../generation/biomes.js";

const ROLE_GROUPS = Object.freeze({
  frontline: Object.freeze(["thrall", "boneguard"]),
  mobile: Object.freeze(["reaver", "wraith"]),
  ranged: Object.freeze(["hexer", "bombardier"]),
});

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

function distributeAcrossWaves(types, waveCount, rng, spawnCount) {
  const shuffled = rng.shuffle(types);
  const waves = Array.from({ length: waveCount }, (_unused, index) => ({
    index,
    delay: index === 0 ? 0 : 0.52 + index * 0.08,
    entries: [],
  }));
  for (let index = 0; index < shuffled.length; index += 1) {
    const wave = waves[index % waveCount];
    wave.entries.push({
      type: shuffled[index],
      spawnIndex: (index * 5 + wave.index * 3) % Math.max(1, spawnCount),
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

  const waves = distributeAcrossWaves(types.slice(0, count), waveCount, rng, spawnPoints.length);
  return {
    id: `${floor}-${room}-${biome}`,
    floor,
    room,
    biome,
    threat: types.slice(0, count).reduce((sum, type) => sum + getEnemyArchetype(type).threat, 0),
    waves,
  };
}

export { ROLE_GROUPS };
