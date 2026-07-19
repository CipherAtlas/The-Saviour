import {
  applyProgressionCard,
  defineProgressionCard,
  previewProgressionCard,
} from "./progressionModel.js";
import { DEATH_DEFIANCE_GRANT_CAP } from "./gameConfig.js";

export const UPGRADE_PATHS = Object.freeze({
  Reaper: Object.freeze({ id: "Reaper", label: "Reaper", description: "Long scythe strings, reach, and execution damage." }),
  Shade: Object.freeze({ id: "Shade", label: "Shade", description: "Fast dashes, critical strikes, and relentless tempo." }),
  Grave: Object.freeze({ id: "Grave", label: "Grave", description: "Vitality, recovery, and refusal to die." }),
});

const upgrade = (definition) => defineProgressionCard({
  tier: "chamber",
  maxRank: 3,
  fallback: false,
  prerequisites: [],
  excludes: [],
  transformation: null,
  deathDefianceGrant: "none",
  ...definition,
});

export const RUN_UPGRADES = Object.freeze([
  upgrade({
    id: "whetted-crescent",
    path: "Reaper",
    name: "Whetted Crescent",
    description: "Scythe damage multiplier increases by 6 percentage points per rank.",
    tags: ["damage"],
    synergies: ["grave-edge", "harvest-crown"],
    effects: [{ stat: "damageMultiplier", operation: "add", value: 0.06, unit: "ratio", perRank: true }],
  }),
  upgrade({
    id: "long-haft",
    path: "Reaper",
    name: "Long Haft",
    description: "Scythe reach multiplier increases by 5 percentage points per rank.",
    tags: ["reach"],
    synergies: ["far-reach", "harvest-crown"],
    effects: [{ stat: "reachMultiplier", operation: "add", value: 0.05, unit: "ratio", perRank: true }],
  }),
  upgrade({
    id: "reapers-focus",
    path: "Reaper",
    name: "Reaper's Focus",
    description: "Critical chance increases by 2 percentage points per rank.",
    tags: ["critical"],
    synergies: ["veil-edge", "perfect-eclipse"],
    effects: [{ stat: "criticalChance", operation: "add", value: 0.02, unit: "percentagePoint", perRank: true }],
  }),
  upgrade({
    id: "merciless-arc",
    path: "Reaper",
    name: "Merciless Arc",
    description: "Scythe damage multiplier increases by 12 percentage points. Excludes Grave Oath.",
    maxRank: 1,
    excludes: ["grave-oath"],
    tags: ["damage"],
    synergies: ["grave-edge", "harvest-crown"],
    effects: [{ stat: "damageMultiplier", operation: "add", value: 0.12, unit: "ratio", perRank: false }],
  }),
  upgrade({
    id: "quickened-step",
    path: "Shade",
    name: "Quickened Step",
    description: "Dash cooldown is multiplied by 0.95 per rank.",
    tags: ["dash"],
    synergies: ["hollow-step", "reaping-passage"],
    effects: [{ stat: "dashCooldownMultiplier", operation: "multiply", value: 0.95, unit: "ratio", perRank: true }],
  }),
  upgrade({
    id: "veil-edge",
    path: "Shade",
    name: "Veil Edge",
    description: "Critical chance increases by 3 percentage points per rank.",
    tags: ["critical"],
    synergies: ["perfect-eclipse"],
    effects: [{ stat: "criticalChance", operation: "add", value: 0.03, unit: "percentagePoint", perRank: true }],
  }),
  upgrade({
    id: "afterimage-edge",
    path: "Shade",
    name: "Afterimage Edge",
    description: "Scythe damage multiplier increases by 4 percentage points per rank.",
    tags: ["damage"],
    synergies: ["hollow-step", "reaping-passage"],
    effects: [{ stat: "damageMultiplier", operation: "add", value: 0.04, unit: "ratio", perRank: true }],
  }),
  upgrade({
    id: "nights-measure",
    path: "Shade",
    name: "Night's Measure",
    description: "Reach multiplier increases by 3 percentage points and critical chance by 1 percentage point per rank.",
    tags: ["reach", "critical"],
    synergies: ["far-reach", "perfect-eclipse"],
    effects: [
      { stat: "reachMultiplier", operation: "add", value: 0.03, unit: "ratio", perRank: true },
      { stat: "criticalChance", operation: "add", value: 0.01, unit: "percentagePoint", perRank: true },
    ],
  }),
  upgrade({
    id: "marrow-vigor",
    path: "Grave",
    name: "Marrow Vigor",
    description: "Gain 10 maximum health and heal for the same amount per rank.",
    tags: ["max-health", "healing"],
    synergies: ["royal-blood", "final-mercy"],
    effects: [
      { stat: "maxHealth", operation: "add", value: 10, unit: "flat", perRank: true },
      { stat: "health", operation: "add", value: 10, unit: "flat", perRank: true },
    ],
  }),
  upgrade({
    id: "wellspring",
    path: "Grave",
    name: "Wellspring",
    description: "Chamber recovery increases by 3% of maximum health per rank.",
    tags: ["healing", "room-recovery"],
    synergies: ["moonwell-renewal"],
    effects: [{ stat: "roomRecoveryBonus", operation: "add", value: 0.03, unit: "percentagePoint", perRank: true }],
  }),
  upgrade({
    id: "soul-tithe",
    path: "Grave",
    name: "Soul Tithe",
    description: "Defeated enemies restore 1 health per rank.",
    tags: ["healing", "kill-recovery"],
    synergies: ["soul-siphon"],
    effects: [{ stat: "healthOnKill", operation: "add", value: 1, unit: "flat", perRank: true }],
  }),
  upgrade({
    id: "grave-oath",
    path: "Grave",
    name: "Grave Oath",
    description: "Gain 18 maximum health and heal for the same amount. Excludes Merciless Arc.",
    maxRank: 1,
    excludes: ["merciless-arc"],
    tags: ["max-health", "healing"],
    synergies: ["royal-blood", "final-mercy"],
    effects: [
      { stat: "maxHealth", operation: "add", value: 18, unit: "flat", perRank: false },
      { stat: "health", operation: "add", value: 18, unit: "flat", perRank: false },
    ],
  }),
]);

export const CHAMBER_FALLBACK = upgrade({
  id: "threshold-restoration",
  path: "Grave",
  name: "Threshold Restoration",
  description: "Restore 30% of maximum health.",
  maxRank: Number.POSITIVE_INFINITY,
  fallback: true,
  tags: ["healing", "restoration", "fallback"],
  synergies: [],
  effects: [{ stat: "health", operation: "restorePercent", value: 0.3, unit: "ratio", perRank: true }],
});

export function getUpgradeRank(ranks, id) {
  if (ranks instanceof Map) return ranks.get(id) ?? 0;
  if (ranks instanceof Set) return ranks.has(id) ? 1 : 0;
  return ranks?.[id] ?? 0;
}

function deathDefianceGrantAmount(definition) {
  if (definition.deathDefianceGrant !== "activation") return 0;
  return definition.effects
    .filter((effect) => effect.stat === "deathDefiance" && effect.operation === "grant")
    .reduce((total, effect) => total + effect.value, 0);
}

function deathDefianceGranted(player) {
  if (!player) return 0;
  if (Number.isInteger(player.deathDefianceGranted)) return player.deathDefianceGranted;
  return Number.isInteger(player.deathDefiance) ? player.deathDefiance : 0;
}

export function isUpgradeEligible(definition, ranks, player = null) {
  if (getUpgradeRank(ranks, definition.id) >= definition.maxRank) return false;
  if (definition.excludes.some((id) => getUpgradeRank(ranks, id) > 0)) return false;
  const grantAmount = deathDefianceGrantAmount(definition);
  return grantAmount === 0 || deathDefianceGranted(player) + grantAmount <= DEATH_DEFIANCE_GRANT_CAP;
}

function decorateChoice(definition, ranks, player) {
  const rank = getUpgradeRank(ranks, definition.id);
  const preview = player ? previewProgressionCard(definition, player) : null;
  return Object.freeze({ ...definition, rank, nextRank: rank + 1, preview });
}

export function offerUpgradeChoices(
  rng,
  ranks,
  pool = RUN_UPGRADES,
  count = 3,
  fallback = CHAMBER_FALLBACK,
  player = null,
  { avoidIds = [] } = {},
) {
  const eligible = pool.filter((definition) => isUpgradeEligible(definition, ranks, player));
  if (eligible.length === 0) return [decorateChoice(fallback, ranks, player)];

  const avoided = new Set(avoidIds);
  const selected = [];
  for (const path of Object.keys(UPGRADE_PATHS)) {
    const pathEligible = eligible.filter((definition) => definition.path === path);
    const alternatives = pathEligible.filter((definition) => !avoided.has(definition.id));
    const options = rng.shuffle(alternatives.length > 0 ? alternatives : pathEligible);
    if (options[0]) selected.push(options[0]);
    if (selected.length >= count) break;
  }
  if (selected.length < count) {
    const selectedIds = new Set(selected.map((definition) => definition.id));
    const unselected = eligible.filter((definition) => !selectedIds.has(definition.id));
    const alternatives = unselected.filter((definition) => !avoided.has(definition.id));
    const options = alternatives.length >= count - selected.length ? alternatives : unselected;
    selected.push(...rng.shuffle(options).slice(0, count - selected.length));
  }
  return selected.slice(0, count).map((definition) => decorateChoice(definition, ranks, player));
}

export function applyRunUpgrade(definition, player, ranks) {
  if (!definition || !isUpgradeEligible(definition, ranks, player)) return null;
  const grantAmount = deathDefianceGrantAmount(definition);
  const grantedBefore = deathDefianceGranted(player);
  applyProgressionCard(definition, player);
  if (grantAmount > 0) player.deathDefianceGranted = grantedBefore + grantAmount;
  let transformationRank = null;
  if (definition.transformation?.status === "live") {
    player.transformationRanks ??= {};
    const hookId = definition.transformation.id;
    transformationRank = (player.transformationRanks[hookId] ?? 0) + 1;
    player.transformationRanks[hookId] = transformationRank;
  }
  const rank = getUpgradeRank(ranks, definition.id) + 1;
  ranks.set(definition.id, rank);
  return {
    id: definition.id,
    name: definition.name,
    path: definition.path,
    tier: definition.tier,
    rank,
    maxRank: definition.maxRank,
    transformation: definition.transformation,
    transformationRank,
    deathDefianceGranted: grantAmount,
    deathDefianceGrantedTotal: deathDefianceGranted(player),
    deathDefianceRemaining: player.deathDefiance ?? 0,
  };
}

export function summarizeUpgradePaths(ranks, definitions) {
  const summary = Object.fromEntries(Object.keys(UPGRADE_PATHS).map((path) => [path, 0]));
  for (const definition of definitions) summary[definition.path] += getUpgradeRank(ranks, definition.id);
  return summary;
}
