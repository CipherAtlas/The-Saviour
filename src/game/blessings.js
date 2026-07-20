import {
  decorateProgressionChoice,
  defineProgressionCard,
  getProgressionRank,
  isProgressionCardEligible,
} from "./progressionModel.js";
import { SeededRandom } from "../generation/seededRandom.js";

export const TECHNIQUE_SLOTS = Object.freeze({
  scytheCombo: Object.freeze({ id: "scytheCombo", label: "Scythe Combo", shortLabel: "Combo" }),
  chargedReap: Object.freeze({ id: "chargedReap", label: "Charged Reap", shortLabel: "Charge" }),
  graveLine: Object.freeze({ id: "graveLine", label: "Grave Line", shortLabel: "Line" }),
  reapersClaim: Object.freeze({ id: "reapersClaim", label: "Reaper's Claim", shortLabel: "Claim" }),
  dash: Object.freeze({ id: "dash", label: "Dash", shortLabel: "Dash" }),
});

export const TECHNIQUE_SLOT_IDS = Object.freeze(Object.keys(TECHNIQUE_SLOTS));

const modifier = (id) => Object.freeze({ id });

const blessing = (definition) => defineProgressionCard({
  tier: "blessing",
  maxRank: 2,
  fallback: false,
  prerequisites: [],
  excludes: [],
  effects: [],
  modifiers: [],
  ...definition,
});

export const BLESSINGS = Object.freeze([
  blessing({
    id: "headsmans-cadence",
    path: "Reaper",
    techniqueSlot: "scytheCombo",
    name: "Headsman's Cadence",
    description: "The combo finisher becomes a brutal execution tool, while its first two cuts deliberately weaken.",
    benefit: "Finisher damage gains +45% → +70%; normal enemies execute below 8% → 12% health.",
    cost: "Combo hits one and two deal 12% less damage.",
    excludes: ["ghost-cadence", "pallbearers-cadence"],
    tags: ["damage", "combo", "execute"],
    rankTotals: [
      { finisherDamageBonus: 0.45, executeThreshold: 0.08, openingHitDamagePenalty: 0.12, bossesExecutable: false },
      { finisherDamageBonus: 0.7, executeThreshold: 0.12, openingHitDamagePenalty: 0.12, bossesExecutable: false },
    ],
    modifiers: [modifier("headsmansCadence")],
  }),
  blessing({
    id: "ghost-cadence",
    path: "Shade",
    techniqueSlot: "scytheCombo",
    name: "Ghost Cadence",
    description: "The combo becomes faster and dash-linked, with lighter, shorter-reaching cuts.",
    benefit: "Attack timings become 12% → 20% faster; one dash can preserve the chain.",
    cost: "Every combo hit deals 8% less damage and has 15% less reach.",
    excludes: ["headsmans-cadence", "pallbearers-cadence"],
    tags: ["combo", "dash"],
    rankTotals: [
      { timingReduction: 0.12, preservedDashes: 1, damagePenalty: 0.08, reachPenalty: 0.15 },
      { timingReduction: 0.2, preservedDashes: 1, damagePenalty: 0.08, reachPenalty: 0.15 },
    ],
    modifiers: [modifier("ghostCadence")],
  }),
  blessing({
    id: "pallbearers-cadence",
    path: "Grave",
    techniqueSlot: "scytheCombo",
    name: "Pallbearer's Cadence",
    description: "A multi-target finisher creates stagger pressure and a brief damage shield, while its setup hits weaken.",
    benefit: "Finisher stagger gains +25% → +45%; hitting two enemies grants a 12 → 20 damage shield for 3 seconds.",
    cost: "The first and second hits deal 10% less damage; single-target defense is unreliable.",
    excludes: ["headsmans-cadence", "ghost-cadence"],
    tags: ["combo", "stagger", "ward"],
    rankTotals: [
      { finisherPoiseBonus: 0.25, minimumWardTargets: 2, wardStrength: 12, wardDurationSeconds: 3, openingHitDamagePenalty: 0.1 },
      { finisherPoiseBonus: 0.45, minimumWardTargets: 2, wardStrength: 20, wardDurationSeconds: 3, openingHitDamagePenalty: 0.1 },
    ],
    modifiers: [modifier("pallbearersCadence")],
  }),

  blessing({
    id: "falling-moon",
    path: "Reaper",
    techniqueSlot: "chargedReap",
    name: "Falling Moon",
    description: "Perfect Charged Reaps become devastating, but their timing window contracts.",
    benefit: "Perfect Reap (release in the timing window): damage gains +40% → +65% and stagger gains +50% → +80%.",
    cost: "The perfect timing window shrinks to 70 ms → 55 ms.",
    excludes: ["quick-orbit", "blood-orbit"],
    tags: ["damage", "charged-reap", "stagger"],
    rankTotals: [
      { perfectDamageBonus: 0.4, perfectPoiseBonus: 0.5, perfectWindowSeconds: 0.07 },
      { perfectDamageBonus: 0.65, perfectPoiseBonus: 0.8, perfectWindowSeconds: 0.055 },
    ],
    modifiers: [modifier("fallingMoon")],
  }),
  blessing({
    id: "quick-orbit",
    path: "Shade",
    techniqueSlot: "chargedReap",
    name: "Quick Orbit",
    description: "Charged Reap cycles much faster, but every release is lighter.",
    benefit: "Charge time, recovery, and cooldown become 15% → 25% faster.",
    cost: "Charged Reap health damage and stagger damage are permanently 15% lower.",
    excludes: ["falling-moon", "blood-orbit"],
    tags: ["charged-reap"],
    rankTotals: [
      { timingReduction: 0.15, recoveryReduction: 0.15, cooldownReduction: 0.15, damagePenalty: 0.15, poisePenalty: 0.15 },
      { timingReduction: 0.25, recoveryReduction: 0.25, cooldownReduction: 0.25, damagePenalty: 0.15, poisePenalty: 0.15 },
    ],
    modifiers: [modifier("quickOrbit")],
  }),
  blessing({
    id: "blood-orbit",
    path: "Grave",
    techniqueSlot: "chargedReap",
    name: "Blood Orbit",
    description: "Charged Reap converts Zephyr's health into multi-target damage and conditional recovery.",
    benefit: "Damage gains +20% → +35%; heal 3 → 4 health per enemy, capped at 15 → 24 per release.",
    cost: "Release costs 8 → 12 health and cannot activate unless Zephyr can pay; it is poor against one target or on a whiff.",
    excludes: ["falling-moon", "quick-orbit"],
    tags: ["damage", "charged-reap", "healing"],
    rankTotals: [
      { damageBonus: 0.2, healPerEnemy: 3, healCap: 15, healthCost: 8 },
      { damageBonus: 0.35, healPerEnemy: 4, healCap: 24, healthCost: 12 },
    ],
    modifiers: [modifier("bloodOrbit")],
  }),

  blessing({
    id: "needlemoon",
    path: "Reaper",
    techniqueSlot: "graveLine",
    name: "Needlemoon",
    description: "Grave Line becomes a narrow, high-impact precision strike.",
    benefit: "Grave Line gains +40% → +65% health damage and +30% → +50% stagger damage.",
    cost: "Line width is reduced by 35%.",
    excludes: ["flash-furrow", "funeral-furrow"],
    tags: ["damage", "grave-line", "stagger"],
    rankTotals: [
      { damageBonus: 0.4, poiseBonus: 0.3, widthPenalty: 0.35 },
      { damageBonus: 0.65, poiseBonus: 0.5, widthPenalty: 0.35 },
    ],
    modifiers: [modifier("needlemoon")],
  }),
  blessing({
    id: "flash-furrow",
    path: "Shade",
    techniqueSlot: "graveLine",
    name: "Flash Furrow",
    description: "Grave Line builds and recovers quickly at the expense of impact and width.",
    benefit: "Charge time and recovery become 25% → 40% faster.",
    cost: "Grave Line deals 20% less damage and is 15% narrower.",
    excludes: ["needlemoon", "funeral-furrow"],
    tags: ["grave-line"],
    rankTotals: [
      { buildupReduction: 0.25, recoveryReduction: 0.25, damagePenalty: 0.2, widthPenalty: 0.15 },
      { buildupReduction: 0.4, recoveryReduction: 0.4, damagePenalty: 0.2, widthPenalty: 0.15 },
    ],
    modifiers: [modifier("flashFurrow")],
  }),
  blessing({
    id: "funeral-furrow",
    path: "Grave",
    techniqueSlot: "graveLine",
    name: "Funeral Furrow",
    description: "Grave Line becomes a broad crowd-control furrow with reduced lethality.",
    benefit: "Width gains +30% → +50%; survivors are pulled toward the line and slowed by 25% → 40% for 1.5 seconds.",
    cost: "Grave Line deals 25% less damage.",
    excludes: ["needlemoon", "flash-furrow"],
    tags: ["grave-line", "pull", "slow"],
    rankTotals: [
      { widthBonus: 0.3, pullEnabled: true, slow: 0.25, slowDurationSeconds: 1.5, damagePenalty: 0.25 },
      { widthBonus: 0.5, pullEnabled: true, slow: 0.4, slowDurationSeconds: 1.5, damagePenalty: 0.25 },
    ],
    modifiers: [modifier("funeralFurrow")],
  }),

  blessing({
    id: "guillotine-return",
    path: "Reaper",
    techniqueSlot: "reapersClaim",
    name: "Guillotine Return",
    description: "Claim shifts its damage into the recall and catch, demanding a tighter return.",
    benefit: "Recall damage gains +35% → +60%; catch cleave damage gains +20% → +35%.",
    cost: "Outbound damage is 25% lower and the catch window is 25% shorter.",
    excludes: ["phantom-circuit", "gravebind"],
    tags: ["damage", "claim"],
    rankTotals: [
      { recallDamageBonus: 0.35, catchDamageBonus: 0.2, outboundDamagePenalty: 0.25, catchWindowPenalty: 0.25 },
      { recallDamageBonus: 0.6, catchDamageBonus: 0.35, outboundDamagePenalty: 0.25, catchWindowPenalty: 0.25 },
    ],
    modifiers: [modifier("guillotineReturn")],
  }),
  blessing({
    id: "phantom-circuit",
    path: "Shade",
    techniqueSlot: "reapersClaim",
    name: "Phantom Circuit",
    description: "Claim travels faster and rewards lining up both passes, while weakening its catch cleave.",
    benefit: "Outbound and recall travel 25% → 40% faster; enemies struck on both passes detonate for 30 → 50 damage.",
    cost: "Catch cleave damage is 25% lower and its radius is 15% smaller.",
    excludes: ["guillotine-return", "gravebind"],
    tags: ["damage", "claim"],
    rankTotals: [
      { travelSpeedBonus: 0.25, doublePassDamage: 30, catchDamagePenalty: 0.25, catchRadiusPenalty: 0.15 },
      { travelSpeedBonus: 0.4, doublePassDamage: 50, catchDamagePenalty: 0.25, catchRadiusPenalty: 0.15 },
    ],
    modifiers: [modifier("phantomCircuit")],
  }),
  blessing({
    id: "gravebind",
    path: "Grave",
    techniqueSlot: "reapersClaim",
    name: "Gravebind",
    description: "Claim recall becomes a wide Harvest-refunding pull with reduced damage.",
    benefit: "Recall radius gains +20% → +35% and pull gains +50% → +80%; each surviving enemy pulled refunds 3 → 5 Harvest, capped at 15 → 25.",
    cost: "Recall and catch cleave deal 25% less damage.",
    excludes: ["guillotine-return", "phantom-circuit"],
    tags: ["claim", "harvest", "pull"],
    rankTotals: [
      { recallRadiusBonus: 0.2, recallPullBonus: 0.5, harvestPerSurvivor: 3, harvestCap: 15, recallDamagePenalty: 0.25, catchDamagePenalty: 0.25 },
      { recallRadiusBonus: 0.35, recallPullBonus: 0.8, harvestPerSurvivor: 5, harvestCap: 25, recallDamagePenalty: 0.25, catchDamagePenalty: 0.25 },
    ],
    modifiers: [modifier("gravebind")],
  }),

  blessing({
    id: "reaping-passage",
    path: "Reaper",
    techniqueSlot: "dash",
    name: "Reaping Passage",
    description: "Dash strikes become heavy attacks, but the next defensive dash returns later.",
    benefit: "Dash strike health damage and stagger damage gain +45% → +70%.",
    cost: "Dash cooldown becomes 20% → 30% longer.",
    excludes: ["perfect-eclipse", "grave-step"],
    tags: ["damage", "dash", "stagger"],
    rankTotals: [
      { dashStrikeDamageBonus: 0.45, dashStrikePoiseBonus: 0.45, dashCooldownPenalty: 0.2 },
      { dashStrikeDamageBonus: 0.7, dashStrikePoiseBonus: 0.7, dashCooldownPenalty: 0.3 },
    ],
    modifiers: [modifier("reapingPassageOath")],
  }),
  blessing({
    id: "perfect-eclipse",
    path: "Shade",
    techniqueSlot: "dash",
    name: "Perfect Eclipse",
    description: "A Perfect Dash is a dash started just before an incoming attack connects.",
    benefit: "Perfect Dash (dash as a hit connects): +10 → +18 Harvest; your next scythe hit is critical.",
    cost: "Window: 120 ms normally, 90 ms → 75 ms with this Oath. Dash protection ends at 190 ms.",
    excludes: ["reaping-passage", "grave-step"],
    tags: ["critical", "dash", "harvest"],
    rankTotals: [
      { harvestUnits: 10, guaranteedCriticalActions: 1, perfectWindowSeconds: 0.09, invulnerabilitySeconds: 0.19 },
      { harvestUnits: 18, guaranteedCriticalActions: 1, perfectWindowSeconds: 0.075, invulnerabilitySeconds: 0.19 },
    ],
    modifiers: [modifier("perfectEclipse")],
  }),
  blessing({
    id: "grave-step",
    path: "Grave",
    techniqueSlot: "dash",
    name: "Grave Step",
    description: "Dash ends in a controlling pulse while covering less ground.",
    benefit: "Dash end releases a 2.8 → 3.5 radius pulse dealing 35 → 55 stagger damage and slowing enemies by 25% for 1.2 seconds.",
    cost: "Dash distance is 18% shorter and the pulse deals no health damage.",
    excludes: ["reaping-passage", "perfect-eclipse"],
    tags: ["dash", "stagger", "slow"],
    rankTotals: [
      { pulseRadius: 2.8, pulsePoiseDamage: 35, slow: 0.25, slowDurationSeconds: 1.2, dashDistancePenalty: 0.18, pulseDamage: 0 },
      { pulseRadius: 3.5, pulsePoiseDamage: 55, slow: 0.25, slowDurationSeconds: 1.2, dashDistancePenalty: 0.18, pulseDamage: 0 },
    ],
    modifiers: [modifier("graveStep")],
  }),
]);

export const BLESSING_FALLBACK = blessing({
  id: "royal-restoration",
  path: "Grave",
  techniqueSlot: null,
  name: "Royal Restoration",
  description: "Restore all health before the next floor.",
  benefit: "Restore all health before the next floor.",
  cost: "This fallback does not occupy or improve a Technique Oath slot.",
  maxRank: Number.POSITIVE_INFINITY,
  fallback: true,
  tags: ["healing", "restoration", "fallback"],
  rankTotals: [],
  effects: [{ stat: "health", operation: "restoreFull", value: 1, unit: "ratio", perRank: true }],
});

export const LEGACY_BLESSING_ID_ALIASES = Object.freeze({
  "far-reach": "needlemoon",
  "grave-edge": "falling-moon",
  "harvest-crown": "guillotine-return",
  "hollow-step": "ghost-cadence",
  "perfect-eclipse": "perfect-eclipse",
  "reaping-passage": "reaping-passage",
  "royal-blood": "blood-orbit",
  "final-mercy": "grave-step",
  "soul-siphon": "gravebind",
  "moonwell-renewal": "funeral-furrow",
});

function baseSeedFromBlessingFork(seed) {
  return String(seed).replace(/:blessing-\d+$/, "");
}

export function oathSlotOrderForSeed(seed) {
  return Object.freeze(new SeededRandom(`${baseSeedFromBlessingFork(seed)}:oath-slot-order`).shuffle(TECHNIQUE_SLOT_IDS));
}

export function techniqueSlotForOathFloor(slotOrder, floor) {
  if (!Array.isArray(slotOrder) || slotOrder.length !== TECHNIQUE_SLOT_IDS.length) {
    throw new TypeError("Oath slot order must contain all five technique slots");
  }
  if (!Number.isInteger(floor) || floor < 1 || floor > 5) return null;
  return slotOrder[floor - 1] ?? null;
}

function inferredOathFloor(ranks) {
  const chosenRanks = BLESSINGS.reduce((total, definition) => total + getProgressionRank(ranks, definition.id), 0);
  return Math.min(9, chosenRanks + 1);
}

function ownedIdSet(ranks, ownedOathIds) {
  if (ownedOathIds instanceof Set) return ownedOathIds;
  if (Array.isArray(ownedOathIds)) return new Set(ownedOathIds);
  return new Set(BLESSINGS.filter(({ id }) => getProgressionRank(ranks, id) > 0).map(({ id }) => id));
}

export function isOathEligible(
  definition,
  ranks,
  { floor, ownedOathIds = null, slotOrder = TECHNIQUE_SLOT_IDS, player = null } = {},
) {
  if (!definition || definition.tier !== "blessing" || definition.fallback) return false;
  if (!isProgressionCardEligible(definition, ranks, player)) return false;
  const rank = getProgressionRank(ranks, definition.id);
  if (floor >= 1 && floor <= 5) {
    return rank === 0 && definition.techniqueSlot === techniqueSlotForOathFloor(slotOrder, floor);
  }
  if (floor >= 6 && floor <= 9) {
    return rank === 1 && ownedIdSet(ranks, ownedOathIds).has(definition.id);
  }
  return false;
}

export function offerOathChoices(
  rng,
  ranks,
  {
    floor,
    count = 3,
    player = null,
    ownedOathIds = null,
    slotOrder = oathSlotOrderForSeed(rng.seed),
    fallback = BLESSING_FALLBACK,
  } = {},
) {
  const eligible = BLESSINGS.filter((definition) => isOathEligible(definition, ranks, {
    floor,
    ownedOathIds,
    slotOrder,
    player,
  }));
  if (eligible.length === 0) return [decorateProgressionChoice(fallback, ranks, player)];

  if (floor <= 5) {
    const byPath = new Map(eligible.map((definition) => [definition.path, definition]));
    return ["Reaper", "Shade", "Grave"]
      .map((path) => byPath.get(path))
      .filter(Boolean)
      .slice(0, count)
      .map((definition) => decorateProgressionChoice(definition, ranks, player));
  }

  return eligible
    .map((definition) => decorateProgressionChoice(definition, ranks, player));
}

export function chooseBlessings(rng, ranks, count = 3, player = null, options = {}) {
  const floor = options.floor ?? inferredOathFloor(ranks);
  const slotOrder = options.slotOrder
    ?? options.techniqueSlotOrder
    ?? oathSlotOrderForSeed(options.seed ?? rng.seed);
  return offerOathChoices(rng, ranks, {
    ...options,
    floor,
    slotOrder,
    count,
    player,
  });
}
