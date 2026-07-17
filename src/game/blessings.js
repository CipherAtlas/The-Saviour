import { offerUpgradeChoices } from "./runUpgrades.js";

const blessing = (definition) => Object.freeze({
  tier: "blessing",
  maxRank: 2,
  excludes: Object.freeze([]),
  ...definition,
  excludes: Object.freeze(definition.excludes ?? []),
});

export const BLESSINGS = Object.freeze([
  blessing({
    id: "far-reach",
    path: "Reaper",
    name: "Far-Reaching Moon",
    description: "Scythe reach increases by 14%.",
    apply(player) { player.reachMultiplier += 0.14; },
  }),
  blessing({
    id: "grave-edge",
    path: "Reaper",
    name: "Grave-Tempered Edge",
    description: "All scythe damage increases by 16%.",
    apply(player) { player.damageMultiplier += 0.16; },
  }),
  blessing({
    id: "harvest-crown",
    path: "Reaper",
    name: "Harvest Crown",
    description: "Gain 9% scythe damage and 9% reach.",
    apply(player) {
      player.damageMultiplier += 0.09;
      player.reachMultiplier += 0.09;
    },
  }),
  blessing({
    id: "hollow-step",
    path: "Shade",
    name: "Hollow Step",
    description: "Dash cooldown recovers 18% faster.",
    apply(player) { player.dashCooldownMultiplier *= 0.82; },
  }),
  blessing({
    id: "perfect-eclipse",
    path: "Shade",
    name: "Perfect Eclipse",
    description: "Gain 10% critical chance.",
    apply(player) { player.criticalChance += 0.1; },
  }),
  blessing({
    id: "reaping-passage",
    path: "Shade",
    name: "Reaping Passage",
    description: "Gain 8% scythe damage and recover dash energy 10% faster.",
    apply(player) {
      player.damageMultiplier += 0.08;
      player.dashCooldownMultiplier *= 0.9;
    },
  }),
  blessing({
    id: "royal-blood",
    path: "Grave",
    name: "Royal Blood",
    description: "Gain 24 maximum health and heal for the same amount.",
    apply(player) { player.maxHealth += 24; player.health = Math.min(player.maxHealth, player.health + 24); },
  }),
  blessing({
    id: "final-mercy",
    path: "Grave",
    name: "Final Mercy",
    description: "Gain 10% critical chance and one Death Defiance that restores 35% health.",
    maxRank: 1,
    apply(player) {
      player.criticalChance += 0.1;
      player.deathDefiance += 1;
    },
  }),
  blessing({
    id: "soul-siphon",
    path: "Grave",
    name: "Soul Siphon",
    description: "Recover 2 health for every defeated enemy.",
    apply(player) { player.healthOnKill += 2; },
  }),
  blessing({
    id: "moonwell-renewal",
    path: "Grave",
    name: "Moonwell Renewal",
    description: "Every cleared chamber restores an additional 8% of maximum health.",
    apply(player) { player.roomRecoveryBonus += 0.08; },
  }),
]);

export const BLESSING_FALLBACK = blessing({
  id: "royal-restoration",
  path: "Grave",
  name: "Royal Restoration",
  description: "Restore all health before the next floor.",
  maxRank: Number.POSITIVE_INFINITY,
  fallback: true,
  apply(player) { player.health = player.maxHealth; },
});

export function chooseBlessings(rng, ranks, count = 3) {
  return offerUpgradeChoices(rng, ranks, BLESSINGS, count, BLESSING_FALLBACK);
}
