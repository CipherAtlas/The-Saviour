const archetype = (definition) => Object.freeze({
  ...definition,
  stats: Object.freeze(definition.stats),
  attacks: Object.freeze(
    Object.fromEntries(
      Object.entries(definition.attacks).map(([name, attack]) => [name, Object.freeze({
        ...attack,
        ...(attack.tracking ? { tracking: Object.freeze(attack.tracking) } : {}),
        ...(attack.combo ? { combo: Object.freeze(attack.combo) } : {}),
      })]),
    ),
  ),
});

export const ENEMY_ARCHETYPES = Object.freeze({
  thrall: archetype({
    name: "Grave Thrall",
    modelKey: "thrall",
    behavior: "lunge",
    unlockFloor: 1,
    encounterWeight: 36,
    threat: 1,
    stats: { maxHealth: 78, speed: 5.45, radius: 0.58, damage: 12, attackRange: 2.8 },
    attacks: {
      lunge: {
        windup: 0.3,
        cooldown: 0.74,
        shape: "cone",
        radius: 2.65,
        width: 1.25,
        tracking: { leadTime: 0.18, maxLead: 1.7 },
        combo: { followup: "graveCleave", gap: 0.12, window: 0.82, maxRange: 3.2 },
      },
      graveCleave: { windup: 0.42, cooldown: 0.92, shape: "cone", radius: 1.85, width: 2.35 },
    },
  }),
  reaver: archetype({
    name: "Crypt Reaver",
    modelKey: "reaver",
    behavior: "dashLane",
    unlockFloor: 2,
    encounterWeight: 20,
    threat: 1.65,
    stats: { maxHealth: 94, speed: 5.9, radius: 0.57, damage: 16, attackRange: 8.5 },
    attacks: {
      dashLane: {
        windup: 0.5,
        cooldown: 1.25,
        shape: "lane",
        radius: 7.2,
        width: 1.35,
        dashSpeed: 19.5,
        dashDuration: 0.36,
        tracking: { leadTime: 0.25, maxLead: 2.5 },
        combo: { followup: "crosscut", gap: 0.14, window: 0.88, maxRange: 3.15 },
      },
      crosscut: { windup: 0.32, cooldown: 0.95, shape: "circle", radius: 2.25, width: 0 },
    },
  }),
  boneguard: archetype({
    name: "Ossuary Boneguard",
    modelKey: "boneguard",
    behavior: "shieldSlam",
    unlockFloor: 3,
    encounterWeight: 16,
    threat: 2.35,
    stats: { maxHealth: 182, speed: 3.5, radius: 0.84, damage: 22, attackRange: 6.4 },
    attacks: {
      shieldSlam: { windup: 0.66, cooldown: 1.35, shape: "circle", radius: 3.15, width: 0 },
      guardCharge: {
        windup: 0.74,
        cooldown: 1.65,
        shape: "lane",
        radius: 6.4,
        width: 1.75,
        dashSpeed: 16,
        dashDuration: 0.42,
        tracking: { leadTime: 0.28, maxLead: 2.3 },
        combo: { followup: "shieldSlam", gap: 0.18, window: 0.94, maxRange: 3.75 },
      },
    },
  }),
  hexer: archetype({
    name: "Hollow Hexer",
    modelKey: "hexer",
    behavior: "spellCycle",
    unlockFloor: 2,
    encounterWeight: 17,
    threat: 1.75,
    stats: { maxHealth: 74, speed: 3.95, radius: 0.6, damage: 13, attackRange: 10.5 },
    attacks: {
      aimedBolt: {
        windup: 0.46,
        cooldown: 0.94,
        shape: "lane",
        radius: 10.5,
        width: 0.55,
        tracking: { leadTime: 0.23, maxLead: 2.15 },
        combo: { followup: "fan", gap: 0.2, window: 0.92, maxRange: 10.5, preferredDistance: 7.4 },
      },
      fan: {
        windup: 0.58,
        cooldown: 1.18,
        shape: "cone",
        radius: 8.5,
        width: 5.2,
        tracking: { leadTime: 0.16, maxLead: 1.4 },
      },
      rune: {
        windup: 0.72,
        cooldown: 1.42,
        shape: "circle",
        radius: 2.25,
        width: 0,
        tracking: { leadTime: 0.3, maxLead: 2.7 },
      },
    },
  }),
  wraith: archetype({
    name: "Veil Wraith",
    modelKey: "wraith",
    behavior: "blinkFlank",
    unlockFloor: 4,
    encounterWeight: 13,
    threat: 2,
    stats: { maxHealth: 98, speed: 5.35, radius: 0.62, damage: 17, attackRange: 9 },
    attacks: {
      blinkFlank: {
        windup: 0.44,
        cooldown: 1.14,
        shape: "blink",
        radius: 2.35,
        width: 0.85,
        combo: { followup: "veilSweep", gap: 0.1, window: 0.74, maxRange: 3.55 },
      },
      veilSweep: { windup: 0.48, cooldown: 1.06, shape: "circle", radius: 2.75, width: 0 },
    },
  }),
  bombardier: archetype({
    name: "Cinder Bombardier",
    modelKey: "bombardier",
    behavior: "lobbedArea",
    unlockFloor: 5,
    encounterWeight: 10,
    threat: 2.25,
    stats: { maxHealth: 104, speed: 3.7, radius: 0.67, damage: 17, attackRange: 12 },
    attacks: {
      lobbedBomb: {
        windup: 0.78,
        cooldown: 1.68,
        shape: "circle",
        radius: 2.35,
        width: 0,
        travelTime: 1.05,
        tracking: { leadTime: 0.34, maxLead: 3.1 },
        combo: { followup: "cinderBurst", gap: 1.12, window: 2.1, maxRange: 12, preferredDistance: 8.2 },
      },
      cinderBurst: {
        windup: 0.58,
        cooldown: 1.4,
        shape: "cone",
        radius: 7.5,
        width: 5.5,
        tracking: { leadTime: 0.18, maxLead: 1.6 },
      },
    },
  }),
  queen: archetype({
    name: "The Witch",
    modelKey: "queen",
    behavior: "bossPhases",
    unlockFloor: 10,
    encounterWeight: 0,
    threat: 20,
    stats: { maxHealth: 2300, speed: 5.2, radius: 1.05, damage: 24, attackRange: 3.3 },
    attacks: {
      royalVolley: { windup: 0.62, cooldown: 1.25, shape: "ring", radius: 3.8, width: 0.5 },
      royalFan: {
        windup: 0.55,
        cooldown: 1.18,
        shape: "cone",
        radius: 10,
        width: 6.5,
        tracking: { leadTime: 0.2, maxLead: 1.8 },
      },
      royalLance: {
        windup: 0.72,
        cooldown: 1.32,
        shape: "lane",
        radius: 12,
        width: 0.72,
        tracking: { leadTime: 0.26, maxLead: 2.4 },
      },
      royalSlam: { windup: 0.72, cooldown: 1.35, shape: "circle", radius: 3.6, width: 0 },
      royalDash: {
        windup: 0.52,
        cooldown: 1.05,
        shape: "lane",
        radius: 8.5,
        width: 1.8,
        dashSpeed: 23,
        dashDuration: 0.38,
        tracking: { leadTime: 0.25, maxLead: 2.8 },
      },
      voidWell: {
        windup: 0.86,
        cooldown: 1.7,
        shape: "circle",
        radius: 2.8,
        width: 0,
        duration: 1.15,
        tracking: { leadTime: 0.3, maxLead: 2.7 },
      },
    },
  }),
});

export const NON_BOSS_ARCHETYPE_IDS = Object.freeze([
  "thrall",
  "reaver",
  "boneguard",
  "hexer",
  "wraith",
  "bombardier",
]);

export const PROJECTILE_KINDS = Object.freeze({
  HEX_BOLT: "hexBolt",
  HEX_SHARD: "hexShard",
  HEX_RUNE: "hexRune",
  CINDER_BOMB: "cinderBomb",
  CINDER_SHARD: "cinderShard",
  QUEEN_ORB: "queenOrb",
  QUEEN_LANCE: "queenLance",
  QUEEN_WELL: "queenWell",
});

export function getEnemyArchetype(type) {
  const definition = ENEMY_ARCHETYPES[type];
  if (!definition) throw new RangeError(`Unknown enemy archetype: ${type}`);
  return definition;
}

export function encounterWeightsForFloor(floor) {
  return NON_BOSS_ARCHETYPE_IDS.map((type) => {
    const definition = ENEMY_ARCHETYPES[type];
    return {
      value: type,
      weight: floor >= definition.unlockFloor ? definition.encounterWeight : 0,
    };
  });
}
