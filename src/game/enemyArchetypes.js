const archetype = (definition) => Object.freeze({
  ...definition,
  stats: Object.freeze(definition.stats),
  attacks: Object.freeze(
    Object.fromEntries(
      Object.entries(definition.attacks).map(([name, attack]) => [name, Object.freeze(attack)]),
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
    stats: { maxHealth: 62, speed: 4.9, radius: 0.58, damage: 12, attackRange: 2.8 },
    attacks: {
      lunge: { windup: 0.3, cooldown: 0.82, shape: "cone", radius: 2.65, width: 1.25 },
      graveCleave: { windup: 0.42, cooldown: 1.05, shape: "cone", radius: 1.85, width: 2.35 },
    },
  }),
  reaver: archetype({
    name: "Crypt Reaver",
    modelKey: "reaver",
    behavior: "dashLane",
    unlockFloor: 2,
    encounterWeight: 20,
    threat: 1.65,
    stats: { maxHealth: 74, speed: 5.2, radius: 0.57, damage: 16, attackRange: 8.5 },
    attacks: {
      dashLane: { windup: 0.5, cooldown: 1.45, shape: "lane", radius: 7.2, width: 1.35, dashSpeed: 18, dashDuration: 0.36 },
      crosscut: { windup: 0.32, cooldown: 1.1, shape: "circle", radius: 2.25, width: 0 },
    },
  }),
  boneguard: archetype({
    name: "Ossuary Boneguard",
    modelKey: "boneguard",
    behavior: "shieldSlam",
    unlockFloor: 3,
    encounterWeight: 16,
    threat: 2.35,
    stats: { maxHealth: 146, speed: 3.05, radius: 0.84, damage: 22, attackRange: 6.4 },
    attacks: {
      shieldSlam: { windup: 0.66, cooldown: 1.55, shape: "circle", radius: 3.15, width: 0 },
      guardCharge: { windup: 0.74, cooldown: 1.9, shape: "lane", radius: 6.4, width: 1.75, dashSpeed: 14.5, dashDuration: 0.42 },
    },
  }),
  hexer: archetype({
    name: "Hollow Hexer",
    modelKey: "hexer",
    behavior: "spellCycle",
    unlockFloor: 2,
    encounterWeight: 17,
    threat: 1.75,
    stats: { maxHealth: 58, speed: 3.55, radius: 0.6, damage: 13, attackRange: 10.5 },
    attacks: {
      aimedBolt: { windup: 0.46, cooldown: 1.08, shape: "lane", radius: 10.5, width: 0.55 },
      fan: { windup: 0.58, cooldown: 1.38, shape: "cone", radius: 8.5, width: 5.2 },
      rune: { windup: 0.72, cooldown: 1.65, shape: "circle", radius: 2.25, width: 0 },
    },
  }),
  wraith: archetype({
    name: "Veil Wraith",
    modelKey: "wraith",
    behavior: "blinkFlank",
    unlockFloor: 4,
    encounterWeight: 13,
    threat: 2,
    stats: { maxHealth: 78, speed: 4.7, radius: 0.62, damage: 17, attackRange: 9 },
    attacks: {
      blinkFlank: { windup: 0.44, cooldown: 1.35, shape: "blink", radius: 2.35, width: 0.85 },
      veilSweep: { windup: 0.48, cooldown: 1.28, shape: "circle", radius: 2.75, width: 0 },
    },
  }),
  bombardier: archetype({
    name: "Cinder Bombardier",
    modelKey: "bombardier",
    behavior: "lobbedArea",
    unlockFloor: 5,
    encounterWeight: 10,
    threat: 2.25,
    stats: { maxHealth: 82, speed: 3.25, radius: 0.67, damage: 17, attackRange: 12 },
    attacks: {
      lobbedBomb: { windup: 0.78, cooldown: 1.95, shape: "circle", radius: 2.35, width: 0, travelTime: 1.05 },
      cinderBurst: { windup: 0.58, cooldown: 1.65, shape: "cone", radius: 7.5, width: 5.5 },
    },
  }),
  queen: archetype({
    name: "The Hollow Queen",
    modelKey: "queen",
    behavior: "bossPhases",
    unlockFloor: 10,
    encounterWeight: 0,
    threat: 20,
    stats: { maxHealth: 1800, speed: 4.2, radius: 1.05, damage: 24, attackRange: 3.3 },
    attacks: {
      royalVolley: { windup: 0.62, cooldown: 1.25, shape: "ring", radius: 3.8, width: 0.5 },
      royalFan: { windup: 0.55, cooldown: 1.18, shape: "cone", radius: 10, width: 6.5 },
      royalLance: { windup: 0.72, cooldown: 1.32, shape: "lane", radius: 12, width: 0.72 },
      royalSlam: { windup: 0.72, cooldown: 1.35, shape: "circle", radius: 3.6, width: 0 },
      royalDash: { windup: 0.52, cooldown: 1.05, shape: "lane", radius: 8.5, width: 1.8, dashSpeed: 21, dashDuration: 0.38 },
      voidWell: { windup: 0.86, cooldown: 1.7, shape: "circle", radius: 2.8, width: 0, duration: 1.15 },
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
