import { offerUpgradeChoices } from "./runUpgrades.js";
import { defineProgressionCard } from "./progressionModel.js";

const blessing = (definition) => defineProgressionCard({
  tier: "blessing",
  maxRank: 2,
  fallback: false,
  prerequisites: [],
  excludes: [],
  deathDefianceGrant: "none",
  ...definition,
});

export const BLESSINGS = Object.freeze([
  blessing({
    id: "far-reach",
    path: "Reaper",
    name: "Far-Reaching Moon",
    description: "Scythe reach increases by 14 percentage points. Claim recall widens and pulls harder; its catch cleave also widens.",
    tags: ["reach"],
    synergies: [],
    effects: [{ stat: "reachMultiplier", operation: "add", value: 0.14, unit: "ratio", perRank: true }],
    transformation: { id: "farReachClaim", status: "live" },
  }),
  blessing({
    id: "grave-edge",
    path: "Reaper",
    name: "Grave-Tempered Edge",
    description: "Scythe damage increases by 16 percentage points. Charged reaps deal 35% more poise damage per rank.",
    tags: ["damage"],
    synergies: [],
    effects: [{ stat: "damageMultiplier", operation: "add", value: 0.16, unit: "ratio", perRank: true }],
    transformation: { id: "graveEdgeCharge", status: "live" },
  }),
  blessing({
    id: "harvest-crown",
    path: "Reaper",
    name: "Harvest Crown",
    description: "Damage and reach each increase by 9 percentage points. The first enemy caught by each Claim recall grants 10 Harvest per rank.",
    tags: ["damage", "reach"],
    synergies: [],
    effects: [
      { stat: "damageMultiplier", operation: "add", value: 0.09, unit: "ratio", perRank: true },
      { stat: "reachMultiplier", operation: "add", value: 0.09, unit: "ratio", perRank: true },
    ],
    transformation: { id: "harvestCrownClaim", status: "live" },
  }),
  blessing({
    id: "hollow-step",
    path: "Shade",
    name: "Hollow Step",
    description: "Dash cooldown is multiplied by 0.82. Dash attacks carry a synchronized afterimage for 45% bonus damage per rank.",
    tags: ["dash"],
    synergies: [],
    effects: [{ stat: "dashCooldownMultiplier", operation: "multiply", value: 0.82, unit: "ratio", perRank: true }],
    transformation: { id: "hollowStepAfterimage", status: "live" },
  }),
  blessing({
    id: "perfect-eclipse",
    path: "Shade",
    name: "Perfect Eclipse",
    description: "Critical chance increases by 10 percentage points. A perfect dash grants 10 Harvest per rank and makes the next scythe action critical.",
    tags: ["critical"],
    synergies: [],
    effects: [{ stat: "criticalChance", operation: "add", value: 0.1, unit: "percentagePoint", perRank: true }],
    transformation: { id: "perfectEclipsePerfectDash", status: "live" },
  }),
  blessing({
    id: "reaping-passage",
    path: "Shade",
    name: "Reaping Passage",
    description: "Damage increases by 8 percentage points and dash cooldown is multiplied by 0.90. Dash attacks gain 35% damage and 20% arc per rank.",
    tags: ["damage", "dash"],
    synergies: [],
    effects: [
      { stat: "damageMultiplier", operation: "add", value: 0.08, unit: "ratio", perRank: true },
      { stat: "dashCooldownMultiplier", operation: "multiply", value: 0.9, unit: "ratio", perRank: true },
    ],
    transformation: { id: "reapingPassageDashAttack", status: "live" },
  }),
  blessing({
    id: "royal-blood",
    path: "Grave",
    name: "Royal Blood",
    description: "Gain 24 maximum health and heal for the same amount. While wounded at 40% health or lower, gain 25% damage and 20% poise damage per rank.",
    tags: ["max-health", "healing"],
    synergies: [],
    effects: [
      { stat: "maxHealth", operation: "add", value: 24, unit: "flat", perRank: true },
      { stat: "health", operation: "add", value: 24, unit: "flat", perRank: true },
    ],
    transformation: { id: "royalBloodWounded", status: "live" },
  }),
  blessing({
    id: "final-mercy",
    path: "Grave",
    name: "Final Mercy",
    description: "Critical chance increases by 10 percentage points. Gain one Death Defiance that restores 35% health.",
    maxRank: 1,
    tags: ["critical", "healing", "death-defiance"],
    synergies: [],
    effects: [
      { stat: "criticalChance", operation: "add", value: 0.1, unit: "percentagePoint", perRank: false },
      { stat: "deathDefiance", operation: "grant", value: 1, unit: "charge", perRank: false },
    ],
    transformation: { id: "finalMercyDeathDefiance", status: "live" },
    deathDefianceGrant: "activation",
  }),
  blessing({
    id: "soul-siphon",
    path: "Grave",
    name: "Soul Siphon",
    description: "Recover 2 health for every defeated enemy. Hits also heal for 3% of damage per rank, capped at 10 health per action per rank.",
    tags: ["healing", "kill-recovery"],
    synergies: [],
    effects: [{ stat: "healthOnKill", operation: "add", value: 2, unit: "flat", perRank: true }],
    transformation: { id: "soulSiphonAggressiveHeal", status: "live" },
  }),
  blessing({
    id: "moonwell-renewal",
    path: "Grave",
    name: "Moonwell Renewal",
    description: "Every cleared chamber restores an additional 8% of maximum health. Taking damage empowers the next scythe or Claim hit with 28 damage and 32 poise damage per rank.",
    tags: ["healing", "room-recovery"],
    synergies: [],
    effects: [{ stat: "roomRecoveryBonus", operation: "add", value: 0.08, unit: "percentagePoint", perRank: true }],
    transformation: { id: "moonwellRenewalRetaliation", status: "live" },
  }),
]);

export const BLESSING_FALLBACK = blessing({
  id: "royal-restoration",
  path: "Grave",
  name: "Royal Restoration",
  description: "Restore all health before the next floor.",
  maxRank: Number.POSITIVE_INFINITY,
  fallback: true,
  tags: ["healing", "restoration", "fallback"],
  synergies: [],
  effects: [{ stat: "health", operation: "restoreFull", value: 1, unit: "ratio", perRank: true }],
  transformation: null,
});

export function chooseBlessings(rng, ranks, count = 3, player = null, options = {}) {
  return offerUpgradeChoices(rng, ranks, BLESSINGS, count, BLESSING_FALLBACK, player, options);
}
