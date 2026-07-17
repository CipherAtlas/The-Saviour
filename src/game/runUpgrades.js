export const UPGRADE_PATHS = Object.freeze({
  Reaper: Object.freeze({ id: "Reaper", label: "Reaper", description: "Long scythe strings, reach, and execution damage." }),
  Shade: Object.freeze({ id: "Shade", label: "Shade", description: "Fast dashes, critical strikes, and relentless tempo." }),
  Grave: Object.freeze({ id: "Grave", label: "Grave", description: "Vitality, recovery, and refusal to die." }),
});

const upgrade = (definition) => Object.freeze({
  tier: "chamber",
  maxRank: 3,
  excludes: Object.freeze([]),
  ...definition,
  excludes: Object.freeze(definition.excludes ?? []),
});

export const RUN_UPGRADES = Object.freeze([
  upgrade({
    id: "whetted-crescent",
    path: "Reaper",
    name: "Whetted Crescent",
    description: "Scythe damage increases by 6% per rank.",
    apply(player) { player.damageMultiplier += 0.06; },
  }),
  upgrade({
    id: "long-haft",
    path: "Reaper",
    name: "Long Haft",
    description: "Scythe reach increases by 5% per rank.",
    apply(player) { player.reachMultiplier += 0.05; },
  }),
  upgrade({
    id: "reapers-focus",
    path: "Reaper",
    name: "Reaper's Focus",
    description: "Critical chance increases by 2% per rank.",
    apply(player) { player.criticalChance += 0.02; },
  }),
  upgrade({
    id: "merciless-arc",
    path: "Reaper",
    name: "Merciless Arc",
    description: "Scythe damage increases by 12%. Excludes Grave Oath.",
    maxRank: 1,
    excludes: ["grave-oath"],
    apply(player) { player.damageMultiplier += 0.12; },
  }),
  upgrade({
    id: "quickened-step",
    path: "Shade",
    name: "Quickened Step",
    description: "Dash energy recovers 5% faster per rank.",
    apply(player) { player.dashCooldownMultiplier *= 0.95; },
  }),
  upgrade({
    id: "veil-edge",
    path: "Shade",
    name: "Veil Edge",
    description: "Critical chance increases by 3% per rank.",
    apply(player) { player.criticalChance += 0.03; },
  }),
  upgrade({
    id: "afterimage-edge",
    path: "Shade",
    name: "Afterimage Edge",
    description: "Scythe damage increases by 4% per rank.",
    apply(player) { player.damageMultiplier += 0.04; },
  }),
  upgrade({
    id: "nights-measure",
    path: "Shade",
    name: "Night's Measure",
    description: "Reach increases by 3% and critical chance by 1% per rank.",
    apply(player) {
      player.reachMultiplier += 0.03;
      player.criticalChance += 0.01;
    },
  }),
  upgrade({
    id: "marrow-vigor",
    path: "Grave",
    name: "Marrow Vigor",
    description: "Gain 10 maximum health and heal for the same amount per rank.",
    apply(player) {
      player.maxHealth += 10;
      player.health = Math.min(player.maxHealth, player.health + 10);
    },
  }),
  upgrade({
    id: "wellspring",
    path: "Grave",
    name: "Wellspring",
    description: "Chamber recovery increases by 3% of maximum health per rank.",
    apply(player) { player.roomRecoveryBonus += 0.03; },
  }),
  upgrade({
    id: "soul-tithe",
    path: "Grave",
    name: "Soul Tithe",
    description: "Defeated enemies restore 1 health per rank.",
    apply(player) { player.healthOnKill += 1; },
  }),
  upgrade({
    id: "grave-oath",
    path: "Grave",
    name: "Grave Oath",
    description: "Gain 18 maximum health and heal for the same amount. Excludes Merciless Arc.",
    maxRank: 1,
    excludes: ["merciless-arc"],
    apply(player) {
      player.maxHealth += 18;
      player.health = Math.min(player.maxHealth, player.health + 18);
    },
  }),
]);

export const CHAMBER_FALLBACK = upgrade({
  id: "threshold-restoration",
  path: "Grave",
  name: "Threshold Restoration",
  description: "Restore 30% of maximum health.",
  maxRank: Number.POSITIVE_INFINITY,
  fallback: true,
  apply(player) { player.health = Math.min(player.maxHealth, player.health + Math.round(player.maxHealth * 0.3)); },
});

export function getUpgradeRank(ranks, id) {
  if (ranks instanceof Map) return ranks.get(id) ?? 0;
  if (ranks instanceof Set) return ranks.has(id) ? 1 : 0;
  return ranks?.[id] ?? 0;
}

export function isUpgradeEligible(definition, ranks) {
  if (getUpgradeRank(ranks, definition.id) >= definition.maxRank) return false;
  return !definition.excludes.some((id) => getUpgradeRank(ranks, id) > 0);
}

function decorateChoice(definition, ranks) {
  const rank = getUpgradeRank(ranks, definition.id);
  return Object.freeze({ ...definition, rank, nextRank: rank + 1 });
}

export function offerUpgradeChoices(rng, ranks, pool = RUN_UPGRADES, count = 3, fallback = CHAMBER_FALLBACK) {
  const eligible = pool.filter((definition) => isUpgradeEligible(definition, ranks));
  if (eligible.length === 0) return [decorateChoice(fallback, ranks)];

  const selected = [];
  for (const path of Object.keys(UPGRADE_PATHS)) {
    const options = rng.shuffle(eligible.filter((definition) => definition.path === path));
    if (options[0]) selected.push(options[0]);
    if (selected.length >= count) break;
  }
  if (selected.length < count) {
    const selectedIds = new Set(selected.map((definition) => definition.id));
    selected.push(...rng.shuffle(eligible.filter((definition) => !selectedIds.has(definition.id))).slice(0, count - selected.length));
  }
  return selected.slice(0, count).map((definition) => decorateChoice(definition, ranks));
}

export function applyRunUpgrade(definition, player, ranks) {
  if (!definition || !isUpgradeEligible(definition, ranks)) return null;
  definition.apply(player);
  const rank = getUpgradeRank(ranks, definition.id) + 1;
  ranks.set(definition.id, rank);
  return { id: definition.id, name: definition.name, path: definition.path, tier: definition.tier, rank, maxRank: definition.maxRank };
}

export function summarizeUpgradePaths(ranks, definitions) {
  const summary = Object.fromEntries(Object.keys(UPGRADE_PATHS).map((path) => [path, 0]));
  for (const definition of definitions) summary[definition.path] += getUpgradeRank(ranks, definition.id);
  return summary;
}
