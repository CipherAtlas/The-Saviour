import test from "node:test";
import assert from "node:assert/strict";
import { ENEMY_ARCHETYPES } from "../src/game/enemyArchetypes.js";
import {
  detailedEnemyLimit,
  ENEMY_LOD_CONFIG,
  ENEMY_MODEL_KEYS,
  ENEMY_VISUAL_PROFILES,
  getEnemyAttackVisual,
  getEnemyVisualProfile,
} from "../src/rendering/enemyVisualProfiles.js";

const AVAILABLE_MODELS = new Set(["minion", "rogue", "warrior", "mage"]);
const AVAILABLE_CLIPS = new Set([
  "1H_Melee_Attack_Chop",
  "2H_Melee_Attack_Chop",
  "2H_Melee_Attack_Spin",
  "Block",
  "Death_C_Skeletons",
  "Dodge_Forward",
  "Dualwield_Melee_Attack_Slice",
  "Hit_A",
  "Idle_Combat",
  "Running_A",
  "Skeletons_Awaken_Standing",
  "Spellcast_Long",
  "Spellcast_Shoot",
  "Spellcast_Summon",
]);

test("every enemy archetype has a complete 3D visual profile", () => {
  assert.deepEqual(Object.keys(ENEMY_VISUAL_PROFILES).sort(), Object.keys(ENEMY_ARCHETYPES).sort());
  for (const type of Object.keys(ENEMY_ARCHETYPES)) {
    const profile = getEnemyVisualProfile(type);
    assert.ok(AVAILABLE_MODELS.has(profile.modelKey), `${type} uses a bundled model`);
    assert.ok(profile.scale > 0, `${type} has a positive model scale`);
    assert.ok(profile.equipment, `${type} has silhouette-defining equipment`);
    assert.ok(AVAILABLE_CLIPS.has(profile.idleClip));
    assert.ok(AVAILABLE_CLIPS.has(profile.runClip));
    assert.ok(AVAILABLE_CLIPS.has(profile.spawnClip));
    assert.ok(AVAILABLE_CLIPS.has(profile.hitClip));
    assert.ok(AVAILABLE_CLIPS.has(profile.deathClip));
    assert.ok(profile.healthBar.width > 0 && profile.healthBar.height > 0);
  }
  assert.deepEqual([...ENEMY_MODEL_KEYS].sort(), [...AVAILABLE_MODELS].sort());
});

test("every simulated enemy attack maps to a valid clip and impact window", () => {
  for (const [type, archetype] of Object.entries(ENEMY_ARCHETYPES)) {
    for (const attackKind of Object.keys(archetype.attacks)) {
      const visual = getEnemyAttackVisual(type, attackKind);
      assert.ok(visual, `${type}.${attackKind} has presentation metadata`);
      assert.ok(AVAILABLE_CLIPS.has(visual.clip), `${type}.${attackKind} uses an available clip`);
      assert.ok(visual.impactRatio > 0 && visual.impactRatio < 1, `${type}.${attackKind} has a normalized impact ratio`);
      assert.ok(visual.recovery >= 0.15 && visual.recovery <= 0.5, `${type}.${attackKind} recovery is bounded`);
    }
  }
});

test("visual profile data is immutable", () => {
  assert.ok(Object.isFrozen(ENEMY_VISUAL_PROFILES));
  for (const profile of Object.values(ENEMY_VISUAL_PROFILES)) {
    assert.ok(Object.isFrozen(profile));
    assert.ok(Object.isFrozen(profile.attacks));
    for (const attack of Object.values(profile.attacks)) assert.ok(Object.isFrozen(attack));
  }
  assert.throws(() => getEnemyVisualProfile("missing"), RangeError);
});

test("3D detail budgets preserve nearby quality and bound stress rendering", () => {
  assert.equal(detailedEnemyLimit(6), 6);
  assert.equal(detailedEnemyLimit(15), 4);
  assert.equal(detailedEnemyLimit(35), 2);
  assert.ok(ENEMY_LOD_CONFIG.detailExitDistance > ENEMY_LOD_CONFIG.detailEnterDistance);
  assert.ok(Object.isFrozen(ENEMY_LOD_CONFIG));
});
