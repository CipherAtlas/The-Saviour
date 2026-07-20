export const PROGRESSION_TAGS = Object.freeze([
  "damage",
  "critical",
  "dash",
  "harvest",
  "claim",
  "combo",
  "charged-reap",
  "grave-line",
  "stagger",
  "execute",
  "ward",
  "pull",
  "slow",
  "healing",
  "restoration",
  "fallback",
]);

export const PROGRESSION_OPERATIONS = Object.freeze([
  "add",
  "multiply",
  "restorePercent",
  "restoreFull",
  "grant",
]);

export const PROGRESSION_UNITS = Object.freeze([
  "flat",
  "ratio",
  "percentagePoint",
]);

export const PROGRESSION_MODIFIER_IDS = Object.freeze([
  "headsmansCadence",
  "ghostCadence",
  "pallbearersCadence",
  "fallingMoon",
  "quickOrbit",
  "bloodOrbit",
  "needlemoon",
  "flashFurrow",
  "funeralFurrow",
  "guillotineReturn",
  "phantomCircuit",
  "gravebind",
  "reapingPassageOath",
  "perfectEclipse",
  "graveStep",
]);

const TAG_SET = new Set(PROGRESSION_TAGS);
const OPERATION_SET = new Set(PROGRESSION_OPERATIONS);
const UNIT_SET = new Set(PROGRESSION_UNITS);
const MODIFIER_ID_SET = new Set(PROGRESSION_MODIFIER_IDS);
const STAT_LABELS = Object.freeze({
  damageMultiplier: "Scythe damage",
  reachMultiplier: "Scythe reach",
  dashCooldownMultiplier: "Dash cooldown",
  criticalChance: "Critical chance",
  maxHealth: "Maximum health",
  health: "Health",
});
const STAT_DISPLAY_UNITS = Object.freeze({
  damageMultiplier: "ratio",
  reachMultiplier: "ratio",
  dashCooldownMultiplier: "ratio",
  criticalChance: "percentagePoint",
  maxHealth: "flat",
  health: "flat",
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function frozenUniqueStrings(values, field, allowed = null) {
  if (!Array.isArray(values)) throw new TypeError(`${field} must be an array`);
  if (values.some((value) => typeof value !== "string" || value.length === 0)) {
    throw new TypeError(`${field} must contain nonempty strings`);
  }
  if (new Set(values).size !== values.length) throw new TypeError(`${field} must be unique`);
  if (allowed && values.some((value) => !allowed.has(value))) throw new RangeError(`${field} contains an unknown value`);
  return Object.freeze([...values]);
}

function validateRankTotals(values, maxRank, field) {
  if (!Array.isArray(values)) throw new TypeError(`${field} must be an array`);
  if (Number.isFinite(maxRank) && values.length !== maxRank) {
    throw new RangeError(`${field} must contain one total for every rank`);
  }
  return Object.freeze(values.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(`${field}[${index}] must be an object`);
    }
    for (const [key, rankValue] of Object.entries(value)) {
      if (typeof key !== "string" || key.length === 0) throw new TypeError(`${field} keys must be nonempty strings`);
      if (!["number", "boolean", "string"].includes(typeof rankValue) || (
        typeof rankValue === "number" && !Number.isFinite(rankValue)
      )) {
        throw new TypeError(`${field}.${key} must be a finite number, boolean, or string`);
      }
    }
    return deepFreeze({ ...value });
  }));
}

function progressionEffect(effect, maxRank) {
  if (!effect || typeof effect !== "object") throw new TypeError("progression effects must be objects");
  if (typeof effect.stat !== "string" || !STAT_LABELS[effect.stat]) throw new RangeError("unknown progression stat");
  if (!OPERATION_SET.has(effect.operation)) throw new RangeError("unknown progression operation");
  if (!Number.isFinite(effect.value)) throw new TypeError("progression effect value must be finite");
  if (!UNIT_SET.has(effect.unit)) throw new RangeError("unknown progression unit");
  if (typeof effect.perRank !== "boolean") throw new TypeError("progression effect perRank must be boolean");
  const rankTotals = effect.rankTotals == null
    ? null
    : Object.freeze(effect.rankTotals.map((value) => {
      if (!Number.isFinite(value)) throw new TypeError("effect rank totals must be finite");
      return value;
    }));
  if (rankTotals && (!Number.isFinite(maxRank) || rankTotals.length !== maxRank)) {
    throw new RangeError("effect rank totals must contain one value for every finite rank");
  }
  return Object.freeze({
    stat: effect.stat,
    operation: effect.operation,
    value: effect.value,
    unit: effect.unit,
    perRank: effect.perRank,
    rankTotals,
  });
}

function progressionModifier(modifier, rankTotals) {
  if (!modifier || typeof modifier !== "object") throw new TypeError("progression modifiers must be objects");
  if (!MODIFIER_ID_SET.has(modifier.id)) throw new RangeError(`unknown progression modifier ID: ${modifier.id}`);
  return deepFreeze({
    ...modifier,
    id: modifier.id,
    rankTotals,
  });
}

export function defineProgressionCard(definition) {
  if (!definition || typeof definition !== "object") throw new TypeError("progression definition is required");
  if (typeof definition.id !== "string" || definition.id.length === 0) throw new TypeError("progression ID is required");
  if (!Number.isInteger(definition.maxRank) && definition.maxRank !== Number.POSITIVE_INFINITY) {
    throw new TypeError("progression maxRank must be a positive integer or Infinity");
  }
  if (definition.maxRank < 1) throw new RangeError("progression maxRank must be positive");
  for (const field of ["name", "description", "benefit", "cost"]) {
    if (typeof definition[field] !== "string") throw new TypeError(`${field} must be a string`);
  }

  const tags = frozenUniqueStrings(definition.tags, "tags", TAG_SET);
  const prerequisites = frozenUniqueStrings(definition.prerequisites, "prerequisites");
  const excludes = frozenUniqueStrings(definition.excludes ?? [], "excludes");
  const rankTotals = validateRankTotals(definition.rankTotals ?? [], definition.maxRank, "rankTotals");
  const effects = Object.freeze((definition.effects ?? []).map((effect) => progressionEffect(effect, definition.maxRank)));
  const modifiers = Object.freeze((definition.modifiers ?? []).map((modifier) => progressionModifier(modifier, rankTotals)));
  if (effects.length === 0 && modifiers.length === 0) {
    throw new TypeError("progression cards require an effect or behavioral modifier");
  }
  if (new Set(modifiers.map(({ id }) => id)).size !== modifiers.length) {
    throw new TypeError("progression modifier IDs must be unique within a card");
  }

  let card;
  const apply = (player, rank = 1) => applyProgressionCard(card, player, rank);
  card = Object.freeze({
    ...definition,
    tags,
    prerequisites,
    excludes,
    rankTotals,
    effects,
    modifiers,
    apply,
  });
  return card;
}

export function resolveProgressionRankTotal(definition, rank) {
  if (!Number.isInteger(rank) || rank < 1 || rank > definition.rankTotals.length) return null;
  return definition.rankTotals[rank - 1];
}

export function resolveModifierRankTotal(modifier, rank) {
  if (!modifier || !Number.isInteger(rank) || rank < 1 || rank > modifier.rankTotals.length) return null;
  return modifier.rankTotals[rank - 1];
}

export function getProgressionModifier(definition, modifierId) {
  return definition?.modifiers?.find(({ id }) => id === modifierId) ?? null;
}

export function getPlayerModifierRank(player, modifierId) {
  const ranks = player?.modifierRanks;
  if (ranks instanceof Map) return ranks.get(modifierId) ?? 0;
  return ranks?.[modifierId] ?? 0;
}

export function getProgressionRank(ranks, id) {
  if (ranks instanceof Map) return ranks.get(id) ?? 0;
  if (ranks instanceof Set) return ranks.has(id) ? 1 : 0;
  return ranks?.[id] ?? 0;
}

export function isProgressionCardEligible(definition, ranks) {
  if (!definition) return false;
  if (getProgressionRank(ranks, definition.id) >= definition.maxRank) return false;
  if (definition.prerequisites.some((id) => getProgressionRank(ranks, id) === 0)) return false;
  return definition.excludes.every((id) => getProgressionRank(ranks, id) === 0);
}

export function decorateProgressionChoice(definition, ranks, player = null) {
  const rank = getProgressionRank(ranks, definition.id);
  const nextRank = rank + 1;
  const preview = player ? previewProgressionCard(definition, player, nextRank) : null;
  return Object.freeze({
    ...definition,
    rank,
    nextRank,
    currentRankTotal: resolveProgressionRankTotal(definition, rank),
    nextRankTotal: resolveProgressionRankTotal(definition, nextRank),
    preview,
  });
}

function setModifierRank(player, id, rank) {
  player.modifierRanks ??= {};
  if (player.modifierRanks instanceof Map) player.modifierRanks.set(id, rank);
  else player.modifierRanks[id] = rank;
}

export function applyProgressionChoice(definition, player, ranks) {
  if (!definition || !isProgressionCardEligible(definition, ranks)) return null;
  const rank = getProgressionRank(ranks, definition.id) + 1;
  applyProgressionCard(definition, player, rank);
  for (const descriptor of definition.modifiers) setModifierRank(player, descriptor.id, rank);
  ranks.set(definition.id, rank);
  return Object.freeze({
    id: definition.id,
    name: definition.name,
    path: definition.path,
    tier: definition.tier,
    techniqueSlot: definition.techniqueSlot,
    rank,
    maxRank: definition.maxRank,
    rankTotal: resolveProgressionRankTotal(definition, rank),
    modifierIds: Object.freeze(definition.modifiers.map(({ id }) => id)),
  });
}

function effectOperand(effect, rank) {
  if (!effect.rankTotals) return effect.value;
  const currentTotal = effect.rankTotals[rank - 1];
  if (!Number.isFinite(currentTotal)) throw new RangeError("effect rank is outside its rank totals");
  if (effect.operation === "add" || effect.operation === "grant") {
    return currentTotal - (effect.rankTotals[rank - 2] ?? 0);
  }
  if (effect.operation === "multiply") {
    const previousTotal = effect.rankTotals[rank - 2] ?? 1;
    return currentTotal / previousTotal;
  }
  return currentTotal;
}

function nextEffectValue(effect, player, rank) {
  const current = player[effect.stat];
  if (!Number.isFinite(current)) throw new TypeError(`player.${effect.stat} must be finite`);
  const operand = effectOperand(effect, rank);
  if (effect.operation === "add" || effect.operation === "grant") {
    const next = current + operand;
    return effect.stat === "health" ? Math.min(player.maxHealth, next) : next;
  }
  if (effect.operation === "multiply") return current * operand;
  if (effect.operation === "restorePercent") {
    return Math.min(player.maxHealth, current + Math.round(player.maxHealth * operand));
  }
  if (effect.operation === "restoreFull") return player.maxHealth;
  throw new RangeError(`unsupported progression operation ${effect.operation}`);
}

function formatValue(value, unit) {
  if (unit === "ratio" || unit === "percentagePoint") {
    const percentage = value * 100;
    return `${Number.isInteger(percentage) ? percentage : Number(percentage.toFixed(2))}%`;
  }
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

export function calculateProgressionTransition(definition, player, rank = 1) {
  if (!definition?.effects || !player || typeof player !== "object") {
    throw new TypeError("progression definition and player are required");
  }
  if (!Number.isInteger(rank) || rank < 1 || (Number.isFinite(definition.maxRank) && rank > definition.maxRank)) {
    throw new RangeError("progression rank is outside the card range");
  }
  const next = { ...player };
  const rows = [];
  for (let index = 0; index < definition.effects.length; index += 1) {
    const effect = definition.effects[index];
    const before = next[effect.stat];
    const after = nextEffectValue(effect, next, rank);
    next[effect.stat] = after;
    rows.push(Object.freeze({
      id: `${definition.id}:${index}:${effect.stat}`,
      stat: effect.stat,
      label: STAT_LABELS[effect.stat],
      operation: effect.operation,
      unit: effect.unit,
      rank,
      before,
      after,
      beforeText: formatValue(before, STAT_DISPLAY_UNITS[effect.stat]),
      afterText: formatValue(after, STAT_DISPLAY_UNITS[effect.stat]),
    }));
  }
  return Object.freeze({
    definitionId: definition.id,
    rank,
    rows: Object.freeze(rows),
    next: Object.freeze(next),
  });
}

export function previewProgressionCard(definition, player, rank = 1) {
  const transition = calculateProgressionTransition(definition, player, rank);
  return Object.freeze({ definitionId: definition.id, rank, rows: transition.rows });
}

export function applyProgressionCard(definition, player, rank = 1) {
  const transition = calculateProgressionTransition(definition, player, rank);
  for (const effect of definition.effects) player[effect.stat] = transition.next[effect.stat];
  return transition;
}

export function progressionCardSnapshot(choice) {
  return deepFreeze({
    id: choice.id,
    name: choice.name,
    benefit: choice.benefit,
    cost: choice.cost,
    path: choice.path,
    techniqueSlot: choice.techniqueSlot,
    rank: choice.rank,
    nextRank: choice.nextRank,
    maxRank: Number.isFinite(choice.maxRank) ? choice.maxRank : null,
  });
}
