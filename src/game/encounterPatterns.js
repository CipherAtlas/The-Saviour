import {
  BATCH_SPAWN_MODES,
  BATCH_TRIGGER_TYPES,
  createEncounterRecipe,
  ENCOUNTER_RECIPE_TYPES,
} from "./encounterContracts.js";
import { getDifficultyProfile } from "./gameConfig.js";
import { encounterWeightsForFloor, getEnemyArchetype } from "./enemyArchetypes.js";

export const ENEMY_ORIGINS = Object.freeze({
  STABLE: "stable",
  VOLATILE: "volatile",
});

export const ENCOUNTER_BANDS = Object.freeze({
  EARLY: "early",
  MIDDLE: "middle",
  LATE: "late",
});

export const ROLE_GROUPS = Object.freeze({
  frontline: Object.freeze(["thrall", "boneguard"]),
  mobile: Object.freeze(["reaver", "wraith"]),
  ranged: Object.freeze(["hexer"]),
  area: Object.freeze(["bombardier"]),
});

export const SPECIALIST_ARCHETYPE_IDS = Object.freeze(["boneguard", "hexer", "wraith", "bombardier"]);

export const HORDE_CHANCE_BY_BAND = Object.freeze({
  [ENCOUNTER_BANDS.EARLY]: 0.12,
  [ENCOUNTER_BANDS.MIDDLE]: 0.18,
  [ENCOUNTER_BANDS.LATE]: 0.24,
});

const STANDARD_POPULATION = Object.freeze([
  Object.freeze([5, 6, 7]),
  Object.freeze([6, 7, 8]),
  Object.freeze([7, 8, 9]),
  Object.freeze([8, 9, 10]),
  Object.freeze([9, 11, 12]),
  Object.freeze([10, 12, 13]),
  Object.freeze([12, 13, 14]),
  Object.freeze([13, 14, 15]),
  Object.freeze([14, 15, 16]),
  Object.freeze([15, 17, 18]),
]);

const VOLATILE_ORIGIN_QUOTAS = Object.freeze([
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

const VOLATILE_ORIGIN_AFFINITY = Object.freeze({
  thrall: 1,
  wraith: 0.9,
  reaver: 0.75,
  bombardier: 0.55,
  hexer: 0.35,
  boneguard: 0.15,
});

const TYPE_PRIMARY_ROLE = Object.freeze({
  thrall: "frontline",
  boneguard: "frontline",
  reaver: "mobile",
  wraith: "mobile",
  hexer: "ranged",
  bombardier: "area",
});

const LOWER_THREAT_TYPES = Object.freeze(["thrall", "reaver"]);
const SPECIALIST_TYPES = new Set(SPECIALIST_ARCHETYPE_IDS);

const FALLBACK_RECIPE_WEIGHTS = Object.freeze({
  [ENCOUNTER_BANDS.EARLY]: Object.freeze([
    Object.freeze({ value: ENCOUNTER_RECIPE_TYPES.DEATH_TRIGGERED, weight: 46 }),
    Object.freeze({ value: ENCOUNTER_RECIPE_TYPES.POPULATION_PRESSURE, weight: 36 }),
    Object.freeze({ value: ENCOUNTER_RECIPE_TYPES.HYBRID, weight: 18 }),
  ]),
  [ENCOUNTER_BANDS.MIDDLE]: Object.freeze([
    Object.freeze({ value: ENCOUNTER_RECIPE_TYPES.DEATH_TRIGGERED, weight: 36 }),
    Object.freeze({ value: ENCOUNTER_RECIPE_TYPES.POPULATION_PRESSURE, weight: 34 }),
    Object.freeze({ value: ENCOUNTER_RECIPE_TYPES.HYBRID, weight: 30 }),
  ]),
  [ENCOUNTER_BANDS.LATE]: Object.freeze([
    Object.freeze({ value: ENCOUNTER_RECIPE_TYPES.DEATH_TRIGGERED, weight: 28 }),
    Object.freeze({ value: ENCOUNTER_RECIPE_TYPES.POPULATION_PRESSURE, weight: 30 }),
    Object.freeze({ value: ENCOUNTER_RECIPE_TYPES.HYBRID, weight: 42 }),
  ]),
});

const LAYOUT_PACING = Object.freeze({
  opencourtyard: Object.freeze({ overlapBias: 0.01, initialBatchBias: 1 }),
  courtyard: Object.freeze({ overlapBias: 0.01, initialBatchBias: 1 }),
  longhall: Object.freeze({ overlapBias: 0.03, initialBatchBias: -1 }),
  lshape: Object.freeze({ overlapBias: -0.02, initialBatchBias: 0 }),
  tshape: Object.freeze({ overlapBias: 0, initialBatchBias: 0 }),
  cruciform: Object.freeze({ overlapBias: 0.02, initialBatchBias: 1 }),
  hourglass: Object.freeze({ overlapBias: -0.03, initialBatchBias: 0 }),
  offsettwinchambers: Object.freeze({ overlapBias: 0.04, initialBatchBias: -1 }),
  twinchambers: Object.freeze({ overlapBias: 0.04, initialBatchBias: -1 }),
  brokenringcourt: Object.freeze({ overlapBias: -0.01, initialBatchBias: 0 }),
  brokenring: Object.freeze({ overlapBias: -0.01, initialBatchBias: 0 }),
});

function validateLocation(floor, room) {
  if (!Number.isInteger(floor) || floor < 1 || floor > 10) throw new RangeError("Encounter floor must be from 1 to 10.");
  if (!Number.isInteger(room) || room < 1 || room > 3) throw new RangeError("Encounter room must be from 1 to 3.");
}

function requireRng(rng) {
  if (!rng || typeof rng.fork !== "function" || typeof rng.weighted !== "function") {
    throw new TypeError("Encounter planning requires a forkable seeded random source.");
  }
  return rng;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizedLayoutKey(layoutFamily) {
  return String(layoutFamily ?? "unknown").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function resolveLayoutContext(layoutFamily, layout) {
  const family = layoutFamily ?? layout?.layoutFamily ?? layout?.family ?? layout?.id ?? "unknown";
  const authored = LAYOUT_PACING[normalizedLayoutKey(family)] ?? { overlapBias: 0, initialBatchBias: 0 };
  const regionCount = Array.isArray(layout?.combatZones)
    ? layout.combatZones.length
    : (Array.isArray(layout?.combatRegions)
      ? layout.combatRegions.length
      : (Array.isArray(layout?.floorRegions) ? layout.floorRegions.length : 1));
  const complexity = clamp(Number(layout?.layoutComplexity) || 1, 1, 3);
  const walkableArea = Number(layout?.walkableArea ?? layout?.shape?.walkableArea);
  const areaBias = Number.isFinite(walkableArea) && walkableArea >= 1_800 ? 1 : 0;
  return Object.freeze({
    family: String(family),
    overlapBias: clamp(authored.overlapBias + (regionCount > 1 ? 0.01 : 0) + (complexity - 1) * 0.01, -0.05, 0.06),
    initialBatchBias: clamp(authored.initialBatchBias + areaBias - (complexity === 3 ? 1 : 0), -1, 1),
  });
}

function resolveDifficulty(difficulty, difficultyId) {
  if (difficulty && typeof difficulty === "object") return difficulty;
  const requestedId = difficultyId ?? (typeof difficulty === "string" ? difficulty : "standard");
  return getDifficultyProfile(requestedId);
}

export function encounterBandForFloor(floor) {
  if (!Number.isInteger(floor) || floor < 1 || floor > 10) throw new RangeError("Encounter floor must be from 1 to 10.");
  if (floor <= 3) return ENCOUNTER_BANDS.EARLY;
  if (floor <= 6) return ENCOUNTER_BANDS.MIDDLE;
  return ENCOUNTER_BANDS.LATE;
}

export function hordeChanceForFloor(floor) {
  return HORDE_CHANCE_BY_BAND[encounterBandForFloor(floor)];
}

export function standardPopulationFor(floor, room) {
  validateLocation(floor, room);
  return STANDARD_POPULATION[floor - 1][room - 1];
}

export function selectEncounterRecipe({ floor, room, rng, previousRecipeType = null }) {
  validateLocation(floor, room);
  requireRng(rng);
  const band = encounterBandForFloor(floor);
  const hordeChance = HORDE_CHANCE_BY_BAND[band];
  const hordeRoll = rng.fork(`recipe:${floor}:${room}:horde`).next();
  const hordeSuppressed = previousRecipeType === ENCOUNTER_RECIPE_TYPES.HORDE && hordeRoll < hordeChance;
  const type = previousRecipeType !== ENCOUNTER_RECIPE_TYPES.HORDE && hordeRoll < hordeChance
    ? ENCOUNTER_RECIPE_TYPES.HORDE
    : rng.fork(`recipe:${floor}:${room}:fallback`).weighted(FALLBACK_RECIPE_WEIGHTS[band]);
  return Object.freeze({ type, hordeChance, hordeRoll, hordeSuppressed });
}

export function selectEncounterRecipeType(options) {
  return selectEncounterRecipe(options).type;
}

export function volatileOriginQuota(floor, room, count) {
  const floorQuotas = VOLATILE_ORIGIN_QUOTAS[Math.max(1, Math.min(10, floor)) - 1];
  const quota = floorQuotas?.[Math.max(1, Math.min(3, room)) - 1] ?? 0;
  return Math.min(count, quota);
}

function targetPopulation({ floor, room, recipeType, difficulty }) {
  const standardCount = standardPopulationFor(floor, room);
  const multiplier = Number.isFinite(difficulty.populationMultiplier)
    ? difficulty.populationMultiplier
    : ({ relaxed: 0.8, ruthless: 1.15 }[difficulty.id] ?? 1);
  const scaled = Math.max(1, Math.round(standardCount * multiplier));
  return recipeType === ENCOUNTER_RECIPE_TYPES.HORDE
    ? Math.min(12, scaled)
    : Math.min(18, scaled);
}

function batchCountFor(type, band, room, count) {
  if (type === ENCOUNTER_RECIPE_TYPES.HORDE) return 1;
  if (type === ENCOUNTER_RECIPE_TYPES.HYBRID) return Math.min(3, count);
  if (type === ENCOUNTER_RECIPE_TYPES.DEATH_TRIGGERED) {
    return band === ENCOUNTER_BANDS.LATE ? 3 : Math.min(2, count);
  }
  if (band === ENCOUNTER_BANDS.EARLY) return Math.min(2, count);
  if (band === ENCOUNTER_BANDS.LATE && room === 3 && count >= 16) return 4;
  return Math.min(3, count);
}

function ratiosFor(type, batchCount) {
  if (batchCount === 1) return [1];
  if (batchCount === 2) {
    return type === ENCOUNTER_RECIPE_TYPES.DEATH_TRIGGERED ? [0.62, 0.38] : [0.55, 0.45];
  }
  if (batchCount === 4) return [0.5, 0.22, 0.16, 0.12];
  if (type === ENCOUNTER_RECIPE_TYPES.DEATH_TRIGGERED) return [0.68, 0.2, 0.12];
  if (type === ENCOUNTER_RECIPE_TYPES.HYBRID) return [0.5, 0.3, 0.2];
  return [0.46, 0.32, 0.22];
}

function allocateBatchSizes(total, ratios, initialBatchBias) {
  const sizes = ratios.map((ratio) => Math.max(1, Math.floor(total * ratio)));
  let assigned = sizes.reduce((sum, size) => sum + size, 0);
  const fractions = ratios
    .map((ratio, index) => ({ index, fraction: total * ratio - Math.floor(total * ratio) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (let index = 0; assigned < total; index = (index + 1) % fractions.length) {
    sizes[fractions[index].index] += 1;
    assigned += 1;
  }
  for (let index = sizes.length - 1; assigned > total && index >= 0; index -= 1) {
    const removable = Math.min(sizes[index] - 1, assigned - total);
    sizes[index] -= removable;
    assigned -= removable;
  }
  if (sizes.length > 1 && initialBatchBias !== 0) {
    const donor = initialBatchBias > 0 ? sizes.length - 1 : 0;
    const receiver = initialBatchBias > 0 ? 0 : sizes.length - 1;
    if (sizes[donor] > 1) {
      sizes[donor] -= 1;
      sizes[receiver] += 1;
    }
  }
  return sizes;
}

function activePopulationCapFor(band, difficulty, population, recipeType) {
  if (recipeType === ENCOUNTER_RECIPE_TYPES.HORDE) return population;
  const standardCap = {
    [ENCOUNTER_BANDS.EARLY]: 6,
    [ENCOUNTER_BANDS.MIDDLE]: 9,
    [ENCOUNTER_BANDS.LATE]: 12,
  }[band];
  const multiplier = Number.isFinite(difficulty.populationMultiplier) ? difficulty.populationMultiplier : 1;
  return Math.min(12, population, Math.max(1, Math.round(standardCap * multiplier)));
}

function roleQuotas({ floor, room, population, recipeType }) {
  const band = encounterBandForFloor(floor);
  const horde = recipeType === ENCOUNTER_RECIPE_TYPES.HORDE;
  const quotas = {
    frontline: Math.max(1, Math.ceil(population * (horde ? 0.42 : 0.24))),
    mobile: floor >= 2 ? Math.max(1, Math.ceil(population * (horde ? 0.24 : 0.16))) : 0,
    ranged: floor >= 2
      ? (!horde && ((band === ENCOUNTER_BANDS.LATE && population >= 14)
        || (band === ENCOUNTER_BANDS.MIDDLE && room >= 2 && population >= 11)) ? 2 : 1)
      : 0,
    area: floor >= 5 && (band === ENCOUNTER_BANDS.LATE || room >= 2)
      ? (band === ENCOUNTER_BANDS.LATE && population >= 16 && !horde ? 2 : 1)
      : 0,
  };
  let quotaTotal = Object.values(quotas).reduce((sum, quota) => sum + quota, 0);
  for (const role of ["frontline", "mobile", "ranged", "area"]) {
    if (quotaTotal <= population) break;
    if (quotas[role] > 1) {
      quotas[role] -= 1;
      quotaTotal -= 1;
    }
  }
  return Object.freeze(quotas);
}

function specialistFamilyCap(batchSize, band, recipeType) {
  if (recipeType === ENCOUNTER_RECIPE_TYPES.HORDE) return 1;
  if (band === ENCOUNTER_BANDS.EARLY) return 1;
  if (band === ENCOUNTER_BANDS.MIDDLE) return Math.min(2, Math.max(1, Math.ceil(batchSize / 5)));
  return Math.min(3, Math.max(1, Math.ceil(batchSize / 4)));
}

function planThreatBudget({ population, band, room, difficulty, recipeType }) {
  const baseAverage = {
    [ENCOUNTER_BANDS.EARLY]: 1.65,
    [ENCOUNTER_BANDS.MIDDLE]: 1.65,
    [ENCOUNTER_BANDS.LATE]: 1.8,
  }[band];
  const pressure = clamp(difficulty.compositionPressure ?? 1, 0.8, 1.24);
  const pressureMultiplier = 0.9 + pressure * 0.1;
  const recipeMultiplier = recipeType === ENCOUNTER_RECIPE_TYPES.HORDE ? 0.88 : 1;
  return Number((population * baseAverage * pressureMultiplier * recipeMultiplier + (room - 1) * 0.35).toFixed(2));
}

function eligibleWeights(floor, recipeType, difficulty) {
  const horde = recipeType === ENCOUNTER_RECIPE_TYPES.HORDE;
  const pressure = clamp(difficulty.compositionPressure ?? 1, 0.8, 1.24);
  return encounterWeightsForFloor(floor).map((entry) => {
    const specialist = SPECIALIST_TYPES.has(entry.value);
    const lowerThreat = LOWER_THREAT_TYPES.includes(entry.value);
    let weight = entry.weight;
    if (horde && specialist) weight *= 0.28;
    if (horde && lowerThreat) weight *= 1.4;
    if (!horde && specialist) weight *= pressure;
    return Object.freeze({ value: entry.value, weight });
  });
}

function buildRosterTypes({ floor, room, population, recipeType, difficulty, threatBudget, familyCapacities, rng }) {
  const quotas = roleQuotas({ floor, room, population, recipeType });
  const types = [];
  const typeCounts = Object.fromEntries(encounterWeightsForFloor(floor).map(({ value }) => [value, 0]));
  const horde = recipeType === ENCOUNTER_RECIPE_TYPES.HORDE;
  const specialistTotalCap = horde ? Math.min(2, quotas.ranged + quotas.area) : Math.ceil(population * 0.48);

  const canAdd = (type) => {
    if (types.length >= population) return false;
    if (!SPECIALIST_TYPES.has(type)) return true;
    if (typeCounts[type] >= (familyCapacities[type] ?? 0)) return false;
    const specialistCount = types.filter((entry) => SPECIALIST_TYPES.has(entry)).length;
    return specialistCount < specialistTotalCap;
  };
  const add = (type) => {
    if (!canAdd(type)) return false;
    types.push(type);
    typeCounts[type] += 1;
    return true;
  };

  for (let index = 0; index < quotas.frontline; index += 1) add("thrall");
  for (let index = 0; index < quotas.mobile; index += 1) add("reaver");
  for (let index = 0; index < quotas.ranged; index += 1) add("hexer");
  for (let index = 0; index < quotas.area; index += 1) add("bombardier");

  if (!horde && floor >= 3) {
    const boneguardTarget = encounterBandForFloor(floor) === ENCOUNTER_BANDS.LATE && population >= 15 ? 2 : 1;
    for (let index = 0; index < boneguardTarget; index += 1) add("boneguard");
  }
  if (!horde && floor >= 4 && encounterBandForFloor(floor) === ENCOUNTER_BANDS.LATE && room >= 2) add("wraith");

  const lowerThreatTarget = Math.ceil(population * (horde ? 0.72 : 0.56));
  const lowerRng = rng.fork("lower-threat-quota");
  while (types.length < population && types.filter((type) => LOWER_THREAT_TYPES.includes(type)).length < lowerThreatTarget) {
    const choices = LOWER_THREAT_TYPES.filter((type) => floor >= getEnemyArchetype(type).unlockFloor);
    add(lowerRng.pick(choices));
  }

  const weights = eligibleWeights(floor, recipeType, difficulty);
  const fillRng = rng.fork("threat-fill");
  while (types.length < population) {
    const currentThreat = types.reduce((sum, type) => sum + getEnemyArchetype(type).threat, 0);
    const remainingSlots = population - types.length;
    const candidates = weights.filter((entry) => {
      if (entry.weight <= 0 || !canAdd(entry.value)) return false;
      const projectedThreat = currentThreat + getEnemyArchetype(entry.value).threat + Math.max(0, remainingSlots - 1);
      return projectedThreat <= threatBudget + 0.001;
    });
    const fallback = floor >= 2 && fillRng.chance(0.28) ? "reaver" : "thrall";
    add(candidates.length > 0 ? fillRng.weighted(candidates) : fallback);
  }
  return { types, quotas };
}

function distributeRoster(types, batchSizes, band, recipeType, requiredInitialRoles, rng) {
  const batches = batchSizes.map(() => []);
  const remaining = rng.shuffle(types);
  const familyCaps = batchSizes.map((size) => specialistFamilyCap(size, band, recipeType));

  for (const role of requiredInitialRoles) {
    if (batches[0].length >= batchSizes[0]) break;
    const index = remaining.findIndex((type) => TYPE_PRIMARY_ROLE[type] === role);
    if (index >= 0) batches[0].push(remaining.splice(index, 1)[0]);
  }

  remaining.sort((left, right) => Number(SPECIALIST_TYPES.has(right)) - Number(SPECIALIST_TYPES.has(left)));
  const rotation = rng.int(0, Math.max(0, batches.length - 1));
  for (const type of remaining) {
    const candidates = batches
      .map((batch, index) => ({ batch, index, fill: batch.length / batchSizes[index] }))
      .filter(({ batch, index }) => {
        if (batch.length >= batchSizes[index]) return false;
        if (!SPECIALIST_TYPES.has(type)) return true;
        return batch.filter((entry) => entry === type).length < familyCaps[index];
      })
      .sort((left, right) => left.fill - right.fill
        || ((left.index - rotation + batches.length) % batches.length) - ((right.index - rotation + batches.length) % batches.length));
    if (candidates.length > 0) {
      candidates[0].batch.push(type);
      continue;
    }
    const fallbackType = floorSafeLowerThreatType(type);
    const fallbackBatch = batches
      .map((batch, index) => ({ batch, index, fill: batch.length / batchSizes[index] }))
      .filter(({ batch, index }) => batch.length < batchSizes[index])
      .sort((left, right) => left.fill - right.fill || left.index - right.index)[0];
    if (!fallbackBatch) throw new Error(`Encounter roster could not place ${type}.`);
    fallbackBatch.batch.push(fallbackType);
  }
  return { batches, familyCaps };
}

function floorSafeLowerThreatType(type) {
  return TYPE_PRIMARY_ROLE[type] === "mobile" ? "reaver" : "thrall";
}

function assignOrigins(types, floor, room, rng) {
  const volatileCount = volatileOriginQuota(floor, room, types.length);
  const ranked = types.map((type, index) => ({
    index,
    score: (VOLATILE_ORIGIN_AFFINITY[type] ?? 0) + rng.float(0, 0.35),
  })).sort((left, right) => right.score - left.score || left.index - right.index);
  const volatileIndexes = new Set(ranked.slice(0, volatileCount).map((entry) => entry.index));
  return types.map((type, index) => ({
    type,
    origin: volatileIndexes.has(index) ? ENEMY_ORIGINS.VOLATILE : ENEMY_ORIGINS.STABLE,
    originPhase: rng.float(0, Math.PI * 2),
  }));
}

function pacingFor({ band, room, difficulty, layoutContext }) {
  const difficultyCadence = { relaxed: 1.1, standard: 1, ruthless: 0.9 }[difficulty.id] ?? 1;
  const streamInterval = {
    [ENCOUNTER_BANDS.EARLY]: 0.24,
    [ENCOUNTER_BANDS.MIDDLE]: 0.18,
    [ENCOUNTER_BANDS.LATE]: 0.13,
  }[band] * difficultyCadence;
  const attritionRemainingRatio = clamp({
    [ENCOUNTER_BANDS.EARLY]: 0.35,
    [ENCOUNTER_BANDS.MIDDLE]: 0.3,
    [ENCOUNTER_BANDS.LATE]: 0.25,
  }[band] + (room === 1 ? 0.02 : 0), 0.25, 0.35);
  const difficultyOverlapBias = { relaxed: -0.03, standard: 0, ruthless: 0.03 }[difficulty.id] ?? 0;
  const pressureRemainingRatio = clamp(
    attritionRemainingRatio + 0.2 + difficultyOverlapBias + layoutContext.overlapBias,
    0.45,
    0.65,
  );
  return { attritionRemainingRatio, pressureRemainingRatio, streamInterval };
}

function batchTriggerFor(type, index, batchSizes, pacing) {
  if (index === 0) return { type: BATCH_TRIGGER_TYPES.INITIAL };
  const pressureThreshold = type === ENCOUNTER_RECIPE_TYPES.POPULATION_PRESSURE
    || (type === ENCOUNTER_RECIPE_TYPES.HYBRID && index === 1);
  const remainingRatio = pressureThreshold
    ? pacing.pressureRemainingRatio
    : pacing.attritionRemainingRatio;
  const previousBatchSize = batchSizes[index - 1];
  return {
    type: BATCH_TRIGGER_TYPES.REMAINING,
    remainingCount: Math.max(1, Math.floor(previousBatchSize * remainingRatio)),
    remainingRatio: Number(remainingRatio.toFixed(3)),
  };
}

function spawnModeFor(type, index) {
  if (index === 0 || type === ENCOUNTER_RECIPE_TYPES.HORDE) return BATCH_SPAWN_MODES.TOGETHER;
  if (type === ENCOUNTER_RECIPE_TYPES.DEATH_TRIGGERED) return BATCH_SPAWN_MODES.STREAMED;
  if (type === ENCOUNTER_RECIPE_TYPES.HYBRID) {
    return index === 1 ? BATCH_SPAWN_MODES.TOGETHER : BATCH_SPAWN_MODES.STREAMED;
  }
  return index % 2 === 1 ? BATCH_SPAWN_MODES.STREAMED : BATCH_SPAWN_MODES.TOGETHER;
}

function countRoles(entries) {
  const counts = { frontline: 0, mobile: 0, ranged: 0, area: 0 };
  for (const entry of entries) counts[TYPE_PRIMARY_ROLE[entry.type]] += 1;
  return Object.freeze(counts);
}

function countSpecialists(entries) {
  const counts = Object.fromEntries(SPECIALIST_ARCHETYPE_IDS.map((type) => [type, 0]));
  for (const entry of entries) if (SPECIALIST_TYPES.has(entry.type)) counts[entry.type] += 1;
  return Object.freeze(counts);
}

export function createEncounterPlan({
  floor,
  room,
  spawnPoints = [],
  rng,
  difficulty = null,
  difficultyId = null,
  layout = null,
  layoutFamily = null,
  previousRecipeType = null,
}) {
  validateLocation(floor, room);
  requireRng(rng);
  const difficultyProfile = resolveDifficulty(difficulty, difficultyId);
  const layoutContext = resolveLayoutContext(layoutFamily, layout);
  const selection = selectEncounterRecipe({ floor, room, rng, previousRecipeType });
  const band = encounterBandForFloor(floor);
  const population = targetPopulation({ floor, room, recipeType: selection.type, difficulty: difficultyProfile });
  const batchCount = batchCountFor(selection.type, band, room, population);
  const batchSizes = allocateBatchSizes(
    population,
    ratiosFor(selection.type, batchCount),
    layoutContext.initialBatchBias,
  );
  const activePopulationCap = activePopulationCapFor(band, difficultyProfile, population, selection.type);
  const threatBudget = planThreatBudget({
    population,
    band,
    room,
    difficulty: difficultyProfile,
    recipeType: selection.type,
  });
  const familyCaps = batchSizes.map((size) => specialistFamilyCap(size, band, selection.type));
  const familyCapacities = Object.fromEntries(SPECIALIST_ARCHETYPE_IDS.map((type) => [
    type,
    familyCaps.reduce((sum, cap) => sum + cap, 0),
  ]));
  const composition = buildRosterTypes({
    floor,
    room,
    population,
    recipeType: selection.type,
    difficulty: difficultyProfile,
    threatBudget,
    familyCapacities,
    rng: rng.fork("composition"),
  });
  const initialRoles = Object.entries(composition.quotas)
    .filter(([, quota]) => quota > 0)
    .map(([role]) => role);
  const distributed = distributeRoster(
    composition.types,
    batchSizes,
    band,
    selection.type,
    initialRoles,
    rng.fork("batch-distribution"),
  );
  const flattenedTypes = distributed.batches.flat();
  const origins = assignOrigins(flattenedTypes, floor, room, rng.fork("enemy-origins"));
  const pacing = pacingFor({ band, room, difficulty: difficultyProfile, layoutContext });
  const spawnCount = Math.max(1, spawnPoints.length);
  let rosterIndex = 0;
  const rawBatches = distributed.batches.map((types, index) => {
    const mode = spawnModeFor(selection.type, index);
    const entries = types.map((_type, formationIndex) => {
      const originEntry = origins[rosterIndex];
      const entry = {
        ...originEntry,
        role: TYPE_PRIMARY_ROLE[originEntry.type],
        threat: getEnemyArchetype(originEntry.type).threat,
        specialist: SPECIALIST_TYPES.has(originEntry.type),
        spawnIndex: (rosterIndex * 5 + index * 3) % spawnCount,
        formationIndex,
      };
      rosterIndex += 1;
      return entry;
    });
    return {
      id: `${floor}-${room}-${selection.type}-batch-${index + 1}`,
      trigger: batchTriggerFor(selection.type, index, batchSizes, pacing),
      spawnMode: mode,
      streamIntervalSeconds: mode === BATCH_SPAWN_MODES.STREAMED ? Number(pacing.streamInterval.toFixed(3)) : 0,
      entries,
    };
  });
  const recipe = createEncounterRecipe({
    id: `${floor}-${room}-${layoutContext.family}-${difficultyProfile.id ?? "standard"}-${selection.type}`,
    type: selection.type,
    activePopulationCap,
    batches: rawBatches,
  });
  const allEntries = recipe.batches.flatMap((batch) => batch.entries);
  const compatibilityWaves = Object.freeze(recipe.batches.map((batch) => Object.freeze({ ...batch })));
  return Object.freeze({
    id: recipe.id,
    floor,
    room,
    band,
    difficultyId: difficultyProfile.id ?? "standard",
    layoutFamily: layoutContext.family,
    type: recipe.type,
    activePopulationCap: recipe.activePopulationCap,
    totalPopulation: recipe.totalPopulation,
    threatBudget,
    threat: Number(allEntries.reduce((sum, entry) => sum + getEnemyArchetype(entry.type).threat, 0).toFixed(2)),
    roleQuotas: composition.quotas,
    roleCounts: countRoles(allEntries),
    specialistCounts: countSpecialists(allEntries),
    specialistFamilyCaps: Object.freeze([...distributed.familyCaps]),
    hordeChance: selection.hordeChance,
    hordeRoll: selection.hordeRoll,
    hordeSuppressed: selection.hordeSuppressed,
    batches: recipe.batches,
    waves: compatibilityWaves,
  });
}
