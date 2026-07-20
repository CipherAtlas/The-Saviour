import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DIFFICULTY_ID,
  DEFAULT_RUN_TYPE,
  DIFFICULTY,
  DIFFICULTY_IDS,
  ENEMY_FAMILY_STAT_SCALARS,
  ENEMY_FLOOR_BAND_STAT_SCALARS,
  getDifficultyProfile,
  resolveEnemyStatScalars,
  RUN_TYPE_IDS,
} from "../src/game/gameConfig.js";
import { NON_BOSS_ARCHETYPE_IDS } from "../src/game/enemyArchetypes.js";

test("difficulty profiles expose a closed deeply immutable run contract", () => {
  assert.deepEqual(DIFFICULTY_IDS, ["relaxed", "standard", "ruthless"]);
  assert.equal(DEFAULT_DIFFICULTY_ID, "standard");
  assert.deepEqual(Object.keys(DIFFICULTY), DIFFICULTY_IDS);

  for (const id of DIFFICULTY_IDS) {
    const profile = DIFFICULTY[id];
    assert.equal(profile.id, id);
    assert.equal(Object.isFrozen(profile), true);
    assert.equal(Object.isFrozen(profile.attackBudgets), true);
    assert.equal(Object.isFrozen(profile.nonBossStats), true);
    assert.equal(Object.isFrozen(profile.bossStats), true);
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
      "populationMultiplier",
    ]) assert.ok(Number.isFinite(profile[field]) && profile[field] > 0, `${id}.${field}`);
    for (const family of ["total", "melee", "ranged", "area"]) {
      assert.ok(Number.isInteger(profile.attackBudgets[family]) && profile.attackBudgets[family] >= 1);
    }
  }
});

test("run types remain orthogonal to the closed difficulty profiles", () => {
  assert.equal(DEFAULT_RUN_TYPE, "normal");
  assert.deepEqual(RUN_TYPE_IDS, ["normal", "speedrun"]);
  assert.equal(Object.isFrozen(RUN_TYPE_IDS), true);
  assert.equal(DIFFICULTY.speedrun, undefined);
});

test("attack and population budgets use the approved 3/7/10 and 80/100/115 profiles", () => {
  assert.deepEqual(
    Object.fromEntries(DIFFICULTY_IDS.map((id) => [id, DIFFICULTY[id].attackBudgets])),
    {
      relaxed: { total: 3, melee: 2, ranged: 1, area: 1 },
      standard: { total: 7, melee: 4, ranged: 3, area: 2 },
      ruthless: { total: 10, melee: 5, ranged: 4, area: 3 },
    },
  );
  assert.deepEqual(
    DIFFICULTY_IDS.map((id) => DIFFICULTY[id].populationMultiplier),
    [0.8, 1, 1.15],
  );
  assert.ok(DIFFICULTY.relaxed.enemyDamage > 0.5, "Relaxed remains interactive rather than invulnerable");
});

test("difficulty uses explicit floor-band and family scalars for non-boss enemies", () => {
  assert.equal(Object.isFrozen(ENEMY_FLOOR_BAND_STAT_SCALARS), true);
  assert.equal(Object.isFrozen(ENEMY_FLOOR_BAND_STAT_SCALARS.late.healthByFloor), true);
  assert.equal(Object.isFrozen(ENEMY_FAMILY_STAT_SCALARS), true);
  for (const type of NON_BOSS_ARCHETYPE_IDS) {
    for (const floor of [1, 5, 9]) {
      const oldFloorHealth = 1 + (floor - 1) * 0.078;
      const standard = resolveEnemyStatScalars({ type, floor, difficulty: "standard" });
      const ruthless = resolveEnemyStatScalars({ type, floor, difficulty: "ruthless" });
      assert.equal(Object.isFrozen(standard), true);
      assert.ok(standard.health / oldFloorHealth >= 1.15 && standard.health / oldFloorHealth <= 1.25, `${type} Standard health`);
      assert.ok(standard.damage >= 1.05 && standard.damage <= 1.11, `${type} Standard damage`);
      assert.ok(standard.speed >= 1.045 && standard.speed <= 1.085, `${type} Standard speed`);
      assert.ok(ruthless.health / oldFloorHealth >= 1.35 && ruthless.health / oldFloorHealth <= 1.45, `${type} Ruthless health`);
      assert.ok(ruthless.damage >= 1.2 && ruthless.damage <= 1.26, `${type} Ruthless damage`);
      assert.ok(ruthless.speed >= 1.12 && ruthless.speed <= 1.17, `${type} Ruthless speed`);
    }
  }
});

test("Ruthless increases behavioral pressure without blindly stacking legacy enemy scalars", () => {
  assert.ok(DIFFICULTY.ruthless.attackBudgets.total > DIFFICULTY.standard.attackBudgets.total);
  assert.ok(DIFFICULTY.ruthless.attackBudgets.melee > DIFFICULTY.relaxed.attackBudgets.melee);
  assert.ok(DIFFICULTY.ruthless.attackBudgets.area > DIFFICULTY.standard.attackBudgets.area);
  assert.ok(DIFFICULTY.ruthless.windupMultiplier < DIFFICULTY.standard.windupMultiplier);
  assert.ok(DIFFICULTY.ruthless.cooldownMultiplier < DIFFICULTY.standard.cooldownMultiplier);
  assert.ok(DIFFICULTY.ruthless.compositionPressure > DIFFICULTY.standard.compositionPressure);
  assert.ok(DIFFICULTY.ruthless.bossCadenceMultiplier > DIFFICULTY.standard.bossCadenceMultiplier);
  assert.deepEqual(DIFFICULTY.standard.nonBossStats, { health: 1.2, damage: 1.075, speed: 1.06 });
  assert.deepEqual(DIFFICULTY.ruthless.nonBossStats, { health: 1.4, damage: 1.22, speed: 1.14 });
  assert.ok(DIFFICULTY.ruthless.enemyHealth <= 1.15);
  assert.ok(DIFFICULTY.ruthless.enemyDamage <= 1.15);
});

test("the Witch retains the prior floor and difficulty scalar contract", () => {
  assert.deepEqual(resolveEnemyStatScalars({ type: "queen", floor: 10, difficulty: "standard" }), {
    health: 1.18,
    damage: 1,
    speed: 1,
  });
  assert.deepEqual(resolveEnemyStatScalars({ type: "queen", floor: 10, difficulty: "ruthless" }), {
    health: 1.18 * 1.15,
    damage: 1.14,
    speed: 1.08,
  });
  for (const id of DIFFICULTY_IDS) {
    assert.equal(DIFFICULTY[id].enemyHealth, DIFFICULTY[id].bossStats.health);
    assert.equal(DIFFICULTY[id].enemyDamage, DIFFICULTY[id].bossStats.damage);
    assert.equal(DIFFICULTY[id].enemySpeed, DIFFICULTY[id].bossStats.speed);
  }
});

test("difficulty lookup falls back only when requested and never fabricates a profile", () => {
  assert.equal(getDifficultyProfile("relaxed"), DIFFICULTY.relaxed);
  assert.equal(getDifficultyProfile("unknown"), DIFFICULTY.standard);
  assert.throws(() => getDifficultyProfile("unknown", { fallback: false }), /Unknown difficulty ID/);
  assert.throws(() => resolveEnemyStatScalars({ type: "seventh-family", floor: 1 }), /Unknown non-boss enemy family/);
});
