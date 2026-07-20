import { BLESSINGS } from "../game/blessings.js";
import { createEncounterPlan, ENCOUNTER_BANDS, encounterBandForFloor } from "../game/encounterPatterns.js";
import { getEnemyArchetype } from "../game/enemyArchetypes.js";
import {
  DIFFICULTY,
  HEAVY_ATTACK,
  PLAYER_CONFIG,
  RUN_CONFIG,
  SCYTHE_ATTACKS,
  resolveEnemyStatScalars,
} from "../game/gameConfig.js";
import { modifierTotal } from "../game/progressionRuntime.js";
import { SeededRandom } from "../generation/seededRandom.js";
import { EncounterScheduler } from "./EncounterScheduler.js";

export const BALANCE_BUILD_PROFILE_IDS = Object.freeze(["baseline", "damage", "survival", "hybrid"]);

export const BALANCE_PACING_TARGETS = Object.freeze({
  [ENCOUNTER_BANDS.EARLY]: Object.freeze({ baselineMedian: 9.3, minimum: 8, maximum: 10.23 }),
  [ENCOUNTER_BANDS.MIDDLE]: Object.freeze({ baselineMedian: 25.66, minimum: 29.51, maximum: 33.36 }),
  [ENCOUNTER_BANDS.LATE]: Object.freeze({ baselineMedian: 24.57, minimum: 31.94, maximum: 36.86 }),
});

const REPRESENTATIVE_LOCATIONS = Object.freeze({
  [ENCOUNTER_BANDS.EARLY]: Object.freeze({ floor: 2, room: 2 }),
  [ENCOUNTER_BANDS.MIDDLE]: Object.freeze({ floor: 5, room: 2 }),
  [ENCOUNTER_BANDS.LATE]: Object.freeze({ floor: 9, room: 3 }),
});

const BUILD_LOADOUTS = Object.freeze({
  baseline: Object.freeze({
    early: Object.freeze({ oaths: Object.freeze([]) }),
    middle: Object.freeze({ oaths: Object.freeze([]) }),
    late: Object.freeze({ oaths: Object.freeze([]) }),
  }),
  damage: Object.freeze({
    early: Object.freeze({ oaths: Object.freeze([Object.freeze(["headsmans-cadence", 1])]) }),
    middle: Object.freeze({ oaths: Object.freeze([
      Object.freeze(["headsmans-cadence", 1]),
      Object.freeze(["falling-moon", 1]),
      Object.freeze(["needlemoon", 1]),
      Object.freeze(["guillotine-return", 1]),
    ]) }),
    late: Object.freeze({ oaths: Object.freeze([
      Object.freeze(["headsmans-cadence", 2]),
      Object.freeze(["falling-moon", 2]),
      Object.freeze(["needlemoon", 2]),
      Object.freeze(["guillotine-return", 1]),
      Object.freeze(["reaping-passage", 1]),
    ]) }),
  }),
  survival: Object.freeze({
    early: Object.freeze({ oaths: Object.freeze([Object.freeze(["blood-orbit", 1])]) }),
    middle: Object.freeze({ oaths: Object.freeze([
      Object.freeze(["pallbearers-cadence", 1]),
      Object.freeze(["blood-orbit", 1]),
      Object.freeze(["funeral-furrow", 1]),
      Object.freeze(["gravebind", 1]),
    ]) }),
    late: Object.freeze({ oaths: Object.freeze([
      Object.freeze(["pallbearers-cadence", 2]),
      Object.freeze(["blood-orbit", 2]),
      Object.freeze(["funeral-furrow", 2]),
      Object.freeze(["gravebind", 1]),
      Object.freeze(["grave-step", 1]),
    ]) }),
  }),
  hybrid: Object.freeze({
    early: Object.freeze({ oaths: Object.freeze([Object.freeze(["guillotine-return", 1])]) }),
    middle: Object.freeze({ oaths: Object.freeze([
      Object.freeze(["ghost-cadence", 1]),
      Object.freeze(["falling-moon", 1]),
      Object.freeze(["funeral-furrow", 1]),
      Object.freeze(["gravebind", 1]),
    ]) }),
    late: Object.freeze({ oaths: Object.freeze([
      Object.freeze(["ghost-cadence", 2]),
      Object.freeze(["falling-moon", 2]),
      Object.freeze(["funeral-furrow", 2]),
      Object.freeze(["gravebind", 1]),
      Object.freeze(["perfect-eclipse", 1]),
    ]) }),
  }),
});

const TYPE_ATTACK_FAMILY = Object.freeze({
  thrall: "melee",
  reaver: "melee",
  boneguard: "melee",
  wraith: "melee",
  hexer: "ranged",
  bombardier: "area",
});

const TYPE_TARGET_PRIORITY = Object.freeze({
  bombardier: 0,
  hexer: 1,
  wraith: 2,
  reaver: 3,
  thrall: 4,
  boneguard: 5,
});

const PLAYER_UPTIME_BY_BAND = Object.freeze({
  [ENCOUNTER_BANDS.EARLY]: 0.66,
  [ENCOUNTER_BANDS.MIDDLE]: 0.52,
  [ENCOUNTER_BANDS.LATE]: 0.43,
});

const REENGAGE_SECONDS_BY_BAND = Object.freeze({
  [ENCOUNTER_BANDS.EARLY]: 1.35,
  [ENCOUNTER_BANDS.MIDDLE]: 2.15,
  [ENCOUNTER_BANDS.LATE]: 3.1,
});

const EXPECTED_CONTACT_RATE = Object.freeze({ relaxed: 0.0045, standard: 0.006, ruthless: 0.008 });
const REPRESENTATIVE_BUILD_DAMAGE = Object.freeze({
  baseline: Object.freeze({ early: 1, middle: 1, late: 1 }),
  damage: Object.freeze({ early: 1.18, middle: 1.32, late: 1.42 }),
  survival: Object.freeze({ early: 1, middle: 1.04, late: 1.08 }),
  hybrid: Object.freeze({ early: 1.1, middle: 1.22, late: 1.34 }),
});

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1))];
}

function median(values) {
  return percentile(values, 0.5);
}

function average(values) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function immutable(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (!value || typeof value !== "object") return value;
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, immutable(entry)])));
}

function definitionById(definitions, id) {
  const definition = definitions.find((entry) => entry.id === id);
  if (!definition) throw new RangeError(`Unknown balance loadout card: ${id}`);
  return definition;
}

function applyRanks(player, definitions, selections) {
  for (const [id, rank] of selections) {
    const definition = definitionById(definitions, id);
    if (!Number.isInteger(rank) || rank < 1 || rank > definition.maxRank) {
      throw new RangeError(`Invalid balance loadout rank for ${id}.`);
    }
    for (let index = 0; index < rank; index += 1) definition.apply(player, index + 1);
    for (const modifier of definition.modifiers) player.modifierRanks[modifier.id] = rank;
  }
}

export function createBalanceBuild(profileId, band) {
  if (!BALANCE_BUILD_PROFILE_IDS.includes(profileId)) throw new RangeError(`Unknown balance build profile: ${profileId}`);
  if (!Object.values(ENCOUNTER_BANDS).includes(band)) throw new RangeError(`Unknown encounter band: ${band}`);
  const player = {
    maxHealth: PLAYER_CONFIG.maxHealth,
    health: PLAYER_CONFIG.maxHealth,
    damageMultiplier: PLAYER_CONFIG.baseDamageMultiplier,
    reachMultiplier: PLAYER_CONFIG.baseReachMultiplier,
    dashCooldownMultiplier: 1,
    criticalChance: 0.05,
    modifierRanks: {},
  };
  const loadout = BUILD_LOADOUTS[profileId][band];
  applyRanks(player, BLESSINGS, loadout.oaths);
  player.damageMultiplier = REPRESENTATIVE_BUILD_DAMAGE[profileId][band];
  const pallbearer = modifierTotal(player, "pallbearersCadence");
  const funeral = modifierTotal(player, "funeralFurrow");
  const graveStep = modifierTotal(player, "graveStep");
  player.pressureMultiplier = Math.max(0.7, 1
    - (pallbearer ? 0.06 : 0)
    - (funeral?.slow ?? 0) * 0.2
    - (graveStep?.slow ?? 0) * 0.12);
  player.health = player.maxHealth;
  return immutable({
    id: profileId,
    band,
    ...player,
    oathCards: loadout.oaths.map(([id, rank]) => ({ id, rank })),
  });
}

function layoutEngagementMultiplier(layoutFamily) {
  return {
    openCourtyard: 0.9,
    longHall: 1.08,
    lShape: 1.05,
    tShape: 1,
    cruciform: 0.96,
    hourglass: 1.08,
    offsetTwinChambers: 1.12,
    brokenRing: 1.07,
  }[layoutFamily] ?? 1;
}

function enemyMaxHealth(type, floor, difficulty) {
  const definition = getEnemyArchetype(type);
  return Math.round(definition.stats.maxHealth * resolveEnemyStatScalars({ type, floor, difficulty }).health);
}

function enemyDamage(type, floor, difficulty) {
  const definition = getEnemyArchetype(type);
  return definition.stats.damage * resolveEnemyStatScalars({ type, floor, difficulty }).damage;
}

function actionTargetCount(activeCount, maximum) {
  if (activeCount <= 1) return activeCount;
  return Math.min(activeCount, maximum, 1 + Math.floor((activeCount - 1) * 0.46));
}

function activeTargets(snapshot, healthById) {
  return snapshot.enemies
    .filter((enemy) => enemy.interactive && (healthById.get(enemy.id)?.health ?? 0) > 0)
    .sort((left, right) => {
      const leftHealth = healthById.get(left.id);
      const rightHealth = healthById.get(right.id);
      return (TYPE_TARGET_PRIORITY[left.type] ?? 10) - (TYPE_TARGET_PRIORITY[right.type] ?? 10)
        || leftHealth.health / leftHealth.maxHealth - rightHealth.health / rightHealth.maxHealth
        || left.id.localeCompare(right.id);
    });
}

function pressureDamagePerSecond(snapshot, healthById, floor, difficulty, build) {
  const byFamily = { melee: [], ranged: [], area: [] };
  for (const enemy of snapshot.enemies) {
    if (!enemy.interactive || (healthById.get(enemy.id)?.health ?? 0) <= 0) continue;
    const family = TYPE_ATTACK_FAMILY[enemy.type];
    byFamily[family].push(enemyDamage(enemy.type, floor, difficulty));
  }
  let committedDamage = 0;
  for (const family of Object.keys(byFamily)) {
    byFamily[family].sort((left, right) => right - left);
    committedDamage += byFamily[family]
      .slice(0, difficulty.attackBudgets[family])
      .reduce((sum, damage) => sum + damage, 0);
  }
  return committedDamage * EXPECTED_CONTACT_RATE[difficulty.id] * build.pressureMultiplier;
}

function buildRecoveryMetrics(build, population, totalAppliedDamage, aggressiveHealing) {
  const roomRecovery = Math.max(1, Math.round(build.maxHealth * RUN_CONFIG.roomRecoveryPercent));
  return {
    roomRecovery,
    killRecovery: 0,
    aggressiveHealing: round(aggressiveHealing),
    totalPotential: round(roomRecovery + aggressiveHealing),
    recoveryPerEnemy: round(aggressiveHealing / Math.max(1, population)),
    damageDealtForAggressiveHealing: round(totalAppliedDamage),
  };
}

export function simulateRefinementBalanceEncounter({
  seed,
  floor,
  room,
  difficultyId = "standard",
  runType = "normal",
  buildProfile = "baseline",
  layoutFamily = "lShape",
  previousRecipeType = null,
  maximumSeconds = 180,
}) {
  if (typeof seed !== "string" || seed.length === 0) throw new TypeError("Balance simulation requires a seed.");
  const resolvedDifficultyId = runType === "speedrun" ? "ruthless" : difficultyId;
  const difficulty = DIFFICULTY[resolvedDifficultyId];
  if (!difficulty) throw new RangeError(`Unknown balance difficulty: ${resolvedDifficultyId}`);
  const band = encounterBandForFloor(floor);
  const build = createBalanceBuild(buildProfile, band);
  const spawnPoints = Array.from({ length: 20 }, (_unused, index) => ({
    x: (index % 5) * 4 - 8,
    z: Math.floor(index / 5) * 4 - 6,
  }));
  const plan = createEncounterPlan({
    floor,
    room,
    difficulty,
    previousRecipeType,
    layout: { layoutFamily, layoutComplexity: room, combatZones: room > 1 ? [{}, {}] : [{}] },
    spawnPoints,
    rng: new SeededRandom(`${seed}:balance-plan`),
  });
  const scheduler = new EncounterScheduler(plan, { floor, room, layoutFamily });
  const healthById = new Map();
  const stepSeconds = 0.04;
  const normalIntervals = SCYTHE_ATTACKS.map((attack) => attack.chainAt ?? attack.duration);
  let normalIndex = 0;
  let nextActionAt = Infinity;
  let lastHeavyAt = -Infinity;
  let hadInteractiveEnemy = false;
  let totalAppliedDamage = 0;
  let expectedDamageTaken = 0;
  let aggressiveHealing = 0;
  let actions = 0;
  let kills = 0;
  let playerHealth = build.maxHealth;
  const bloodOrbit = modifierTotal(build, "bloodOrbit");
  const attackIntervalScale = 1 / PLAYER_UPTIME_BY_BAND[band];
  const engagementDelay = REENGAGE_SECONDS_BY_BAND[band] * layoutEngagementMultiplier(layoutFamily);

  const syncEnemies = (snapshot) => {
    for (const enemy of snapshot.enemies) {
      if (healthById.has(enemy.id)) continue;
      const maxHealth = enemyMaxHealth(enemy.type, floor, difficulty);
      healthById.set(enemy.id, { type: enemy.type, maxHealth, health: maxHealth });
    }
  };

  while (scheduler.hasCombatRemaining() && scheduler.elapsedSeconds < maximumSeconds) {
    let snapshot = scheduler.snapshot();
    syncEnemies(snapshot);
    const targets = activeTargets(snapshot, healthById);
    if (targets.length > 0 && !hadInteractiveEnemy) {
      nextActionAt = Math.max(nextActionAt === Infinity ? 0 : nextActionAt, scheduler.elapsedSeconds + engagementDelay);
    }
    hadInteractiveEnemy = targets.length > 0;

    const dt = Math.min(stepSeconds, maximumSeconds - scheduler.elapsedSeconds);
    const pressureDamage = pressureDamagePerSecond(snapshot, healthById, floor, difficulty, build) * dt;
    expectedDamageTaken += pressureDamage;
    playerHealth -= pressureDamage;
    scheduler.advance(dt);
    snapshot = scheduler.snapshot();
    syncEnemies(snapshot);
    const active = activeTargets(snapshot, healthById);
    if (active.length === 0 || scheduler.elapsedSeconds + 1e-9 < nextActionAt) continue;

    const heavy = active.length >= 3 && scheduler.elapsedSeconds - lastHeavyAt >= 1.5;
    const attack = heavy ? { ...HEAVY_ATTACK, damage: HEAVY_ATTACK.damage * 0.78 } : SCYTHE_ATTACKS[normalIndex];
    const maximumTargets = heavy ? 4 : [2, 2, 3][normalIndex];
    const targetCount = actionTargetCount(active.length, maximumTargets);
    const criticalMultiplier = 1 + build.criticalChance * 0.75;
    const damage = attack.damage * build.damageMultiplier * criticalMultiplier;
    let actionHealing = 0;
    for (const enemy of active.slice(0, targetCount)) {
      const target = healthById.get(enemy.id);
      const applied = Math.min(target.health, damage);
      target.health -= applied;
      totalAppliedDamage += applied;
      if (target.health > 0) continue;
      if (scheduler.killEnemy(enemy.id)) {
        kills += 1;
      }
    }
    if (heavy && bloodOrbit && playerHealth > bloodOrbit.healthCost) {
      playerHealth -= bloodOrbit.healthCost;
      actionHealing = Math.min(bloodOrbit.healCap, bloodOrbit.healPerEnemy * targetCount);
      aggressiveHealing += actionHealing;
      playerHealth = Math.min(build.maxHealth, playerHealth + actionHealing);
    }
    actions += 1;
    if (heavy) {
      lastHeavyAt = scheduler.elapsedSeconds;
      nextActionAt = scheduler.elapsedSeconds + (0.34 + HEAVY_ATTACK.duration) * attackIntervalScale;
    } else {
      nextActionAt = scheduler.elapsedSeconds + normalIntervals[normalIndex] * attackIntervalScale;
      normalIndex = (normalIndex + 1) % SCYTHE_ATTACKS.length;
    }
  }

  const allEnemyStats = [...healthById.values()];
  const hitDamages = allEnemyStats.map((enemy) => enemyDamage(enemy.type, floor, difficulty));
  const recovery = buildRecoveryMetrics(build, plan.totalPopulation, totalAppliedDamage, aggressiveHealing);
  const healthAfterRecovery = Math.min(build.maxHealth, playerHealth + recovery.roomRecovery);
  const maximumFamilyShare = Math.max(...plan.batches.flatMap((batch) => specialistFamilyShares(batch.entries)));
  const degenerateSpecialistBatch = plan.batches.some((batch) => hasDegenerateSpecialistBatch(batch.entries));
  return immutable({
    seed,
    floor,
    room,
    band,
    difficultyId: resolvedDifficultyId,
    runType,
    buildProfile,
    layoutFamily,
    recipeType: plan.type,
    population: plan.totalPopulation,
    activePopulationCap: plan.activePopulationCap,
    clearTimeSeconds: round(scheduler.elapsedSeconds),
    cleared: scheduler.isClear(),
    timedOut: !scheduler.isClear(),
    actions,
    kills,
    totalEnemyHealth: allEnemyStats.reduce((sum, enemy) => sum + enemy.maxHealth, 0),
    damageDealt: round(totalAppliedDamage),
    expectedDamageTaken: round(expectedDamageTaken),
    player: {
      maxHealth: build.maxHealth,
      healthBeforeRoomRecovery: round(Math.max(0, playerHealth)),
      healthAfterRoomRecovery: round(Math.max(0, healthAfterRecovery)),
      deathDefianceUsed: 0,
      survived: playerHealth > 0,
      medianIncomingHit: round(median(hitDamages)),
      p90IncomingHit: round(percentile(hitDamages, 0.9)),
      hitsToDefeatAtP90: Math.ceil(build.maxHealth / Math.max(1, percentile(hitDamages, 0.9) * build.pressureMultiplier)),
    },
    build,
    recovery,
    composition: {
      roleCounts: plan.roleCounts,
      specialistCounts: plan.specialistCounts,
      maximumSpecialistFamilyShare: round(maximumFamilyShare),
      degenerateSpecialistBatch,
    },
  });
}

function specialistFamilyShares(entries) {
  const specialists = entries.filter((entry) => entry.specialist);
  if (specialists.length === 0) return [0];
  const counts = specialists.reduce((result, entry) => {
    result[entry.type] = (result[entry.type] ?? 0) + 1;
    return result;
  }, {});
  return Object.values(counts).map((count) => count / entries.length);
}

function hasDegenerateSpecialistBatch(entries) {
  if (entries.length < 3) return false;
  const specialistCounts = entries.filter((entry) => entry.specialist).reduce((result, entry) => {
    result[entry.type] = (result[entry.type] ?? 0) + 1;
    return result;
  }, {});
  return Object.values(specialistCounts).some((count) => count >= 3 && count / entries.length > 0.5);
}

export function runRefinementBalanceSweep({
  seedPrefix = "REFINEMENT-BALANCE",
  samplesPerScenario = 24,
  layoutFamilies = ["openCourtyard", "lShape", "offsetTwinChambers", "brokenRing"],
} = {}) {
  if (!Number.isInteger(samplesPerScenario) || samplesPerScenario < 1) {
    throw new RangeError("Balance sweep sample count must be a positive integer.");
  }
  const scenarios = [];
  for (const [band, location] of Object.entries(REPRESENTATIVE_LOCATIONS)) {
    for (const difficultyId of ["relaxed", "standard", "ruthless"]) {
      for (const buildProfile of BALANCE_BUILD_PROFILE_IDS) {
        for (let index = 0; index < samplesPerScenario; index += 1) {
          scenarios.push(simulateRefinementBalanceEncounter({
            seed: `${seedPrefix}-${band}-${difficultyId}-${index}`,
            ...location,
            difficultyId,
            buildProfile,
            layoutFamily: layoutFamilies[index % layoutFamilies.length],
          }));
        }
      }
    }
    for (const buildProfile of BALANCE_BUILD_PROFILE_IDS) {
      for (let index = 0; index < samplesPerScenario; index += 1) {
        scenarios.push(simulateRefinementBalanceEncounter({
          seed: `${seedPrefix}-${band}-speedrun-${index}`,
          ...location,
          difficultyId: "relaxed",
          runType: "speedrun",
          buildProfile,
          layoutFamily: layoutFamilies[index % layoutFamilies.length],
        }));
      }
    }
  }
  return immutable(scenarios);
}

export function summarizeRefinementBalanceSweep(scenarios) {
  if (!Array.isArray(scenarios) || scenarios.length === 0) throw new TypeError("Balance summary requires scenarios.");
  const grouped = {};
  for (const scenario of scenarios) {
    const key = `${scenario.band}:${scenario.runType === "speedrun" ? "speedrun" : scenario.difficultyId}:${scenario.buildProfile}`;
    grouped[key] ??= [];
    grouped[key].push(scenario);
  }
  const groups = Object.fromEntries(Object.entries(grouped).map(([key, values]) => [key, {
    samples: values.length,
    clearRate: round(values.filter((value) => value.cleared).length / values.length),
    medianClearSeconds: round(median(values.map((value) => value.clearTimeSeconds))),
    p90ClearSeconds: round(percentile(values.map((value) => value.clearTimeSeconds), 0.9)),
    averageDamageTaken: round(average(values.map((value) => value.expectedDamageTaken))),
    averageRecoveryPotential: round(average(values.map((value) => value.recovery.totalPotential))),
    medianHitsToDefeat: median(values.map((value) => value.player.hitsToDefeatAtP90)),
    maximumSpecialistFamilyShare: round(Math.max(...values.map((value) => value.composition.maximumSpecialistFamilyShare))),
    degenerateBatches: values.filter((value) => value.composition.degenerateSpecialistBatch).length,
  }]));
  return immutable({ scenarios: scenarios.length, groups });
}

export function auditRefinementHordeRoutes({ seedPrefix = "REFINEMENT-HORDE-ROUTE", runs = 200 } = {}) {
  if (!Number.isInteger(runs) || runs < 1) throw new RangeError("Horde route audit run count must be positive.");
  const counts = { horde: 0, deathTriggered: 0, populationPressure: 0, hybrid: 0 };
  const hordeByBand = { early: 0, middle: 0, late: 0 };
  let adjacentHordes = 0;
  let chambers = 0;
  for (let run = 0; run < runs; run += 1) {
    let previousRecipeType = null;
    for (let floor = 1; floor <= RUN_CONFIG.totalFloors; floor += 1) {
      for (let room = 1; room <= RUN_CONFIG.roomsPerFloor; room += 1) {
        const plan = createEncounterPlan({
          floor,
          room,
          difficultyId: "standard",
          previousRecipeType,
          layoutFamily: "lShape",
          spawnPoints: Array.from({ length: 20 }, () => ({ x: 0, z: 0 })),
          rng: new SeededRandom(`${seedPrefix}-${run}-${floor}-${room}`),
        });
        counts[plan.type] += 1;
        chambers += 1;
        if (plan.type === "horde") hordeByBand[plan.band] += 1;
        if (previousRecipeType === "horde" && plan.type === "horde") adjacentHordes += 1;
        previousRecipeType = plan.type;
      }
    }
  }
  const chambersByBand = {
    early: runs * 3 * RUN_CONFIG.roomsPerFloor,
    middle: runs * 3 * RUN_CONFIG.roomsPerFloor,
    late: runs * 4 * RUN_CONFIG.roomsPerFloor,
  };
  return immutable({
    runs,
    chambers,
    counts,
    rates: Object.fromEntries(Object.entries(counts).map(([type, count]) => [type, round(count / chambers, 4)])),
    hordeByBand,
    hordeRatesByBand: Object.fromEntries(Object.entries(hordeByBand).map(([band, count]) => [
      band,
      round(count / chambersByBand[band], 4),
    ])),
    adjacentHordes,
  });
}
