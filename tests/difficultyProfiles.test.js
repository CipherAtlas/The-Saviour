import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DIFFICULTY_ID,
  DIFFICULTY,
  DIFFICULTY_IDS,
  getDifficultyProfile,
} from "../src/game/gameConfig.js";

test("difficulty profiles expose a closed deeply immutable run contract", () => {
  assert.deepEqual(DIFFICULTY_IDS, ["story", "standard", "ruthless"]);
  assert.equal(DEFAULT_DIFFICULTY_ID, "standard");
  assert.deepEqual(Object.keys(DIFFICULTY), DIFFICULTY_IDS);

  for (const id of DIFFICULTY_IDS) {
    const profile = DIFFICULTY[id];
    assert.equal(profile.id, id);
    assert.equal(Object.isFrozen(profile), true);
    assert.equal(Object.isFrozen(profile.attackBudgets), true);
    assert.ok(profile.label.length > 0);
    assert.ok(profile.description.length > 30);
    for (const field of [
      "enemyHealth",
      "enemyDamage",
      "enemySpeed",
      "windupMultiplier",
      "cooldownMultiplier",
      "compositionPressure",
      "poiseMultiplier",
      "bossCadenceMultiplier",
    ]) assert.ok(Number.isFinite(profile[field]) && profile[field] > 0, `${id}.${field}`);
    for (const family of ["total", "melee", "ranged", "area"]) {
      assert.ok(Number.isInteger(profile.attackBudgets[family]) && profile.attackBudgets[family] >= 1);
    }
  }
});

test("Standard preserves the current scalar baseline while Story retains every attack family", () => {
  assert.deepEqual(
    {
      enemyHealth: DIFFICULTY.standard.enemyHealth,
      enemyDamage: DIFFICULTY.standard.enemyDamage,
      enemySpeed: DIFFICULTY.standard.enemySpeed,
    },
    { enemyHealth: 1, enemyDamage: 1, enemySpeed: 1 },
  );
  assert.ok(DIFFICULTY.story.attackBudgets.melee >= 1);
  assert.ok(DIFFICULTY.story.attackBudgets.ranged >= 1);
  assert.ok(DIFFICULTY.story.attackBudgets.area >= 1);
  assert.ok(DIFFICULTY.story.enemyDamage > 0.5, "Story remains interactive rather than invulnerable");
});

test("Ruthless increases behavioral pressure while keeping scalar inflation bounded", () => {
  assert.ok(DIFFICULTY.ruthless.attackBudgets.total > DIFFICULTY.standard.attackBudgets.total);
  assert.ok(DIFFICULTY.ruthless.attackBudgets.melee > DIFFICULTY.story.attackBudgets.melee);
  assert.ok(DIFFICULTY.ruthless.attackBudgets.area > DIFFICULTY.standard.attackBudgets.area);
  assert.ok(DIFFICULTY.ruthless.windupMultiplier < DIFFICULTY.standard.windupMultiplier);
  assert.ok(DIFFICULTY.ruthless.cooldownMultiplier < DIFFICULTY.standard.cooldownMultiplier);
  assert.ok(DIFFICULTY.ruthless.compositionPressure > DIFFICULTY.standard.compositionPressure);
  assert.ok(DIFFICULTY.ruthless.bossCadenceMultiplier > DIFFICULTY.standard.bossCadenceMultiplier);
  assert.ok(DIFFICULTY.ruthless.enemyHealth <= 1.15);
  assert.ok(DIFFICULTY.ruthless.enemyDamage <= 1.15);
});

test("difficulty lookup falls back only when requested and never fabricates a profile", () => {
  assert.equal(getDifficultyProfile("story"), DIFFICULTY.story);
  assert.equal(getDifficultyProfile("unknown"), DIFFICULTY.standard);
  assert.throws(() => getDifficultyProfile("unknown", { fallback: false }), /Unknown difficulty ID/);
});
