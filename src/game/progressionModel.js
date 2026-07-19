export const PROGRESSION_TAGS = Object.freeze([
  "damage",
  "reach",
  "critical",
  "dash",
  "harvest",
  "claim",
  "charged-reap",
  "stagger",
  "healing",
  "max-health",
  "room-recovery",
  "kill-recovery",
  "death-defiance",
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
  "charge",
]);

export const TRANSFORMATION_HOOK_IDS = Object.freeze([
  "farReachClaim",
  "graveEdgeCharge",
  "harvestCrownClaim",
  "hollowStepAfterimage",
  "perfectEclipsePerfectDash",
  "reapingPassageDashAttack",
  "royalBloodWounded",
  "finalMercyDeathDefiance",
  "soulSiphonAggressiveHeal",
  "moonwellRenewalRetaliation",
]);

const TAG_SET = new Set(PROGRESSION_TAGS);
const OPERATION_SET = new Set(PROGRESSION_OPERATIONS);
const UNIT_SET = new Set(PROGRESSION_UNITS);
const TRANSFORMATION_HOOK_SET = new Set(TRANSFORMATION_HOOK_IDS);
const TRANSFORMATION_STATUSES = new Set(["live", "pending"]);
const DEATH_DEFIANCE_GRANTS = new Set(["none", "activation"]);
const STAT_LABELS = Object.freeze({
  damageMultiplier: "Scythe damage",
  reachMultiplier: "Scythe reach",
  dashCooldownMultiplier: "Dash cooldown",
  criticalChance: "Critical chance",
  maxHealth: "Maximum health",
  health: "Health",
  healthOnKill: "Health per kill",
  roomRecoveryBonus: "Room recovery",
  deathDefiance: "Death Defiance",
});
const STAT_DISPLAY_UNITS = Object.freeze({
  damageMultiplier: "ratio",
  reachMultiplier: "ratio",
  dashCooldownMultiplier: "ratio",
  criticalChance: "percentagePoint",
  maxHealth: "flat",
  health: "flat",
  healthOnKill: "flat",
  roomRecoveryBonus: "percentagePoint",
  deathDefiance: "charge",
});

function frozenUniqueStrings(values, field, allowed = null) {
  if (!Array.isArray(values)) throw new TypeError(`${field} must be an array`);
  if (values.some((value) => typeof value !== "string" || value.length === 0)) {
    throw new TypeError(`${field} must contain nonempty strings`);
  }
  if (new Set(values).size !== values.length) throw new TypeError(`${field} must be unique`);
  if (allowed && values.some((value) => !allowed.has(value))) throw new RangeError(`${field} contains an unknown value`);
  return Object.freeze([...values]);
}

function progressionEffect(effect) {
  if (!effect || typeof effect !== "object") throw new TypeError("progression effects must be objects");
  if (typeof effect.stat !== "string" || !STAT_LABELS[effect.stat]) throw new RangeError("unknown progression stat");
  if (!OPERATION_SET.has(effect.operation)) throw new RangeError("unknown progression operation");
  if (!Number.isFinite(effect.value)) throw new TypeError("progression effect value must be finite");
  if (!UNIT_SET.has(effect.unit)) throw new RangeError("unknown progression unit");
  if (typeof effect.perRank !== "boolean") throw new TypeError("progression effect perRank must be boolean");
  return Object.freeze({
    stat: effect.stat,
    operation: effect.operation,
    value: effect.value,
    unit: effect.unit,
    perRank: effect.perRank,
  });
}

function transformationHook(value) {
  if (value == null) return null;
  if (!TRANSFORMATION_HOOK_SET.has(value.id)) throw new RangeError("unknown transformation hook ID");
  if (!TRANSFORMATION_STATUSES.has(value.status)) throw new RangeError("unknown transformation hook status");
  return Object.freeze({ id: value.id, status: value.status });
}

export function defineProgressionCard(definition) {
  if (!definition || typeof definition !== "object") throw new TypeError("progression definition is required");
  if (typeof definition.id !== "string" || definition.id.length === 0) throw new TypeError("progression ID is required");
  if (!DEATH_DEFIANCE_GRANTS.has(definition.deathDefianceGrant)) {
    throw new RangeError("unknown Death Defiance grant classification");
  }
  const tags = frozenUniqueStrings(definition.tags, "tags", TAG_SET);
  const prerequisites = frozenUniqueStrings(definition.prerequisites, "prerequisites");
  const excludes = frozenUniqueStrings(definition.excludes ?? [], "excludes");
  const synergies = frozenUniqueStrings(definition.synergies, "synergies");
  const effects = Object.freeze(definition.effects.map(progressionEffect));
  if (effects.length === 0) throw new TypeError("progression cards require at least one effect");
  const transformation = transformationHook(definition.transformation);
  let card;
  const apply = (player) => applyProgressionCard(card, player);
  card = Object.freeze({
    ...definition,
    tags,
    prerequisites,
    excludes,
    synergies,
    effects,
    transformation,
    apply,
  });
  return card;
}

function nextEffectValue(effect, player) {
  const current = player[effect.stat];
  if (!Number.isFinite(current)) throw new TypeError(`player.${effect.stat} must be finite`);
  if (effect.operation === "add" || effect.operation === "grant") {
    const next = current + effect.value;
    return effect.stat === "health" ? Math.min(player.maxHealth, next) : next;
  }
  if (effect.operation === "multiply") return current * effect.value;
  if (effect.operation === "restorePercent") {
    return Math.min(player.maxHealth, current + Math.round(player.maxHealth * effect.value));
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

export function calculateProgressionTransition(definition, player) {
  if (!definition?.effects || !player || typeof player !== "object") {
    throw new TypeError("progression definition and player are required");
  }
  const next = { ...player };
  const rows = [];
  for (let index = 0; index < definition.effects.length; index += 1) {
    const effect = definition.effects[index];
    const before = next[effect.stat];
    const after = nextEffectValue(effect, next);
    next[effect.stat] = after;
    rows.push(Object.freeze({
      id: `${definition.id}:${index}:${effect.stat}`,
      stat: effect.stat,
      label: STAT_LABELS[effect.stat],
      operation: effect.operation,
      unit: effect.unit,
      before,
      after,
      beforeText: formatValue(before, STAT_DISPLAY_UNITS[effect.stat]),
      afterText: formatValue(after, STAT_DISPLAY_UNITS[effect.stat]),
    }));
  }
  return Object.freeze({
    definitionId: definition.id,
    rows: Object.freeze(rows),
    next: Object.freeze(next),
  });
}

export function previewProgressionCard(definition, player) {
  const transition = calculateProgressionTransition(definition, player);
  return Object.freeze({ definitionId: definition.id, rows: transition.rows });
}

export function applyProgressionCard(definition, player) {
  const transition = calculateProgressionTransition(definition, player);
  for (const effect of definition.effects) player[effect.stat] = transition.next[effect.stat];
  return transition;
}

export function progressionCardSnapshot(choice) {
  return Object.freeze({
    id: choice.id,
    name: choice.name,
    description: choice.description,
    path: choice.path,
    tier: choice.tier,
    rank: choice.rank,
    nextRank: choice.nextRank,
    maxRank: Number.isFinite(choice.maxRank) ? choice.maxRank : null,
    fallback: choice.fallback === true,
    tags: choice.tags,
    prerequisites: choice.prerequisites,
    excludes: choice.excludes,
    synergies: choice.synergies,
    effects: choice.effects,
    transformation: choice.transformation,
    deathDefianceGrant: choice.deathDefianceGrant,
    preview: choice.preview,
  });
}
