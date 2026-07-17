const profile = (definition) => Object.freeze({
  ...definition,
  tint: Object.freeze(definition.tint),
  healthBar: Object.freeze(definition.healthBar),
  attacks: Object.freeze(
    Object.fromEntries(
      Object.entries(definition.attacks).map(([name, attack]) => [name, Object.freeze(attack)]),
    ),
  ),
});

export const ENEMY_VISUAL_PROFILES = Object.freeze({
  thrall: profile({
    modelKey: "minion",
    scale: 0.9,
    tint: { color: 0xd7d0c8, emissive: 0x241820, emissiveIntensity: 0.12 },
    equipment: "rustSword",
    idleClip: "Idle_Combat",
    runClip: "Running_A",
    spawnClip: "Skeletons_Awaken_Standing",
    hitClip: "Hit_A",
    deathClip: "Death_C_Skeletons",
    healthBar: { width: 1.75, height: 2.45 },
    attacks: {
      lunge: { clip: "1H_Melee_Attack_Chop", impactRatio: 0.62, recovery: 0.18 },
      graveCleave: { clip: "2H_Melee_Attack_Spin", impactRatio: 0.68, recovery: 0.24 },
    },
  }),
  reaver: profile({
    modelKey: "rogue",
    scale: 0.94,
    tint: { color: 0xc4cad8, emissive: 0x102338, emissiveIntensity: 0.16 },
    equipment: "twinBlades",
    idleClip: "Idle_Combat",
    runClip: "Running_A",
    spawnClip: "Skeletons_Awaken_Standing",
    hitClip: "Hit_A",
    deathClip: "Death_C_Skeletons",
    dashClip: "Dodge_Forward",
    healthBar: { width: 1.85, height: 2.6 },
    attacks: {
      dashLane: { clip: "Dualwield_Melee_Attack_Slice", impactRatio: 0.7, recovery: 0.2 },
      crosscut: { clip: "Dualwield_Melee_Attack_Slice", impactRatio: 0.66, recovery: 0.2 },
    },
  }),
  boneguard: profile({
    modelKey: "warrior",
    scale: 1.12,
    tint: { color: 0xd8c9b8, emissive: 0x241b0c, emissiveIntensity: 0.1 },
    equipment: "shieldAxe",
    idleClip: "Idle_Combat",
    runClip: "Running_A",
    spawnClip: "Skeletons_Awaken_Standing",
    hitClip: "Block",
    deathClip: "Death_C_Skeletons",
    blockClip: "Block",
    castShadow: true,
    healthBar: { width: 2.3, height: 3.1 },
    attacks: {
      shieldSlam: { clip: "2H_Melee_Attack_Chop", impactRatio: 0.66, recovery: 0.28 },
      guardCharge: { clip: "2H_Melee_Attack_Spin", impactRatio: 0.68, recovery: 0.26 },
    },
  }),
  hexer: profile({
    modelKey: "mage",
    scale: 0.98,
    tint: { color: 0xd8c8ee, emissive: 0x38104d, emissiveIntensity: 0.34 },
    equipment: "hexStaff",
    idleClip: "Idle_Combat",
    runClip: "Running_A",
    spawnClip: "Skeletons_Awaken_Standing",
    hitClip: "Hit_A",
    deathClip: "Death_C_Skeletons",
    healthBar: { width: 1.9, height: 2.85 },
    attacks: {
      aimedBolt: { clip: "Spellcast_Shoot", impactRatio: 0.7, recovery: 0.2 },
      fan: { clip: "Spellcast_Long", impactRatio: 0.74, recovery: 0.24 },
      rune: { clip: "Spellcast_Summon", impactRatio: 0.72, recovery: 0.3 },
    },
  }),
  wraith: profile({
    modelKey: "rogue",
    scale: 1.02,
    floatHeight: 0.18,
    tint: { color: 0xbba8ef, emissive: 0x421981, emissiveIntensity: 0.62, opacity: 0.82 },
    equipment: "wraithBlades",
    idleClip: "Idle_Combat",
    runClip: "Running_A",
    spawnClip: "Skeletons_Awaken_Standing",
    hitClip: "Hit_A",
    deathClip: "Death_C_Skeletons",
    dashClip: "Dodge_Forward",
    healthBar: { width: 1.9, height: 2.85 },
    attacks: {
      blinkFlank: { clip: "Dualwield_Melee_Attack_Slice", impactRatio: 0.68, recovery: 0.22 },
      veilSweep: { clip: "2H_Melee_Attack_Spin", impactRatio: 0.7, recovery: 0.25 },
    },
  }),
  bombardier: profile({
    modelKey: "minion",
    scale: 1.02,
    tint: { color: 0xe0b895, emissive: 0x5a1807, emissiveIntensity: 0.42 },
    equipment: "cinderBomb",
    idleClip: "Idle_Combat",
    runClip: "Running_A",
    spawnClip: "Skeletons_Awaken_Standing",
    hitClip: "Hit_A",
    deathClip: "Death_C_Skeletons",
    healthBar: { width: 1.95, height: 2.72 },
    attacks: {
      lobbedBomb: { clip: "Spellcast_Shoot", impactRatio: 0.72, recovery: 0.28 },
      cinderBurst: { clip: "Spellcast_Summon", impactRatio: 0.7, recovery: 0.3 },
    },
  }),
  queen: profile({
    modelKey: "mage",
    scale: 1.48,
    floatHeight: 0.12,
    tint: { color: 0xd8b2ed, emissive: 0x55106f, emissiveIntensity: 0.72 },
    equipment: "queenRegalia",
    idleClip: "Idle_Combat",
    runClip: "Running_A",
    spawnClip: "Spellcast_Summon",
    hitClip: "Hit_A",
    deathClip: "Death_C_Skeletons",
    dashClip: "Dodge_Forward",
    castShadow: true,
    healthBar: { width: 3.6, height: 4.4 },
    attacks: {
      royalVolley: { clip: "Spellcast_Summon", impactRatio: 0.72, recovery: 0.3 },
      royalFan: { clip: "Spellcast_Long", impactRatio: 0.72, recovery: 0.28 },
      royalLance: { clip: "Spellcast_Shoot", impactRatio: 0.7, recovery: 0.26 },
      royalSlam: { clip: "2H_Melee_Attack_Chop", impactRatio: 0.67, recovery: 0.34 },
      royalDash: { clip: "2H_Melee_Attack_Spin", impactRatio: 0.68, recovery: 0.25 },
      voidWell: { clip: "Spellcast_Summon", impactRatio: 0.74, recovery: 0.36 },
    },
  }),
});

export const ENEMY_MODEL_KEYS = Object.freeze(
  [...new Set(Object.values(ENEMY_VISUAL_PROFILES).map((entry) => entry.modelKey))],
);

export const ENEMY_LOD_CONFIG = Object.freeze({
  detailEnterDistance: 5.4,
  detailExitDistance: 6.6,
  openRoomDetailLimit: 6,
  crowdedRoomDetailLimit: 4,
  stressDetailLimit: 2,
  crowdedRoomThreshold: 8,
  stressThreshold: 20,
});

export function detailedEnemyLimit(enemyCount) {
  if (enemyCount > ENEMY_LOD_CONFIG.stressThreshold) return ENEMY_LOD_CONFIG.stressDetailLimit;
  if (enemyCount > ENEMY_LOD_CONFIG.crowdedRoomThreshold) return ENEMY_LOD_CONFIG.crowdedRoomDetailLimit;
  return ENEMY_LOD_CONFIG.openRoomDetailLimit;
}

export function getEnemyVisualProfile(type) {
  const result = ENEMY_VISUAL_PROFILES[type];
  if (!result) throw new RangeError(`Unknown enemy visual profile: ${type}`);
  return result;
}

export function getEnemyAttackVisual(type, attackKind) {
  return getEnemyVisualProfile(type).attacks[attackKind] ?? null;
}
