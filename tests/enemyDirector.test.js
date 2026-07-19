import assert from "node:assert/strict";
import test from "node:test";
import { EnemyDirector } from "../src/game/EnemyDirector.js";
import {
  ENEMY_ARCHETYPES,
  PROJECTILE_KINDS,
} from "../src/game/enemyArchetypes.js";
import {
  QUEEN_HAZARD_CAP,
  QUEEN_MIN_WINDUP_SECONDS,
  QUEEN_SUMMON_CAP,
} from "../src/game/bossPatterns.js";
import { DIFFICULTY } from "../src/game/gameConfig.js";
import { SeededRandom } from "../src/generation/seededRandom.js";

const ARENA = Object.freeze({
  width: 30,
  depth: 22,
  boss: false,
  biome: "forgottenKeep",
  obstacles: Object.freeze([]),
  enemySpawnPoints: Object.freeze([
    Object.freeze({ x: -8, z: -5 }),
    Object.freeze({ x: 8, z: -5 }),
    Object.freeze({ x: -8, z: 5 }),
    Object.freeze({ x: 8, z: 5 }),
  ]),
});

const PLAYER = Object.freeze({
  position: Object.freeze({ x: 0, z: 0 }),
  radius: 0.58,
});

function makeDirector(difficulty = DIFFICULTY.standard, seed = "ATTACK-COORDINATION") {
  const events = [];
  const director = new EnemyDirector((type, detail) => events.push({ type, detail }));
  director.arena = ARENA;
  director.rng = new SeededRandom(seed);
  director.difficulty = difficulty;
  return { director, events };
}

function poiseBreak(enemy, actionId) {
  return Object.freeze({
    actionId,
    damage: 0,
    critical: false,
    direction: Object.freeze({ x: 1, z: 0 }),
    knockback: 0,
    poiseDamage: enemy.maxPoise,
    pullStrength: 0,
    sourcePosition: Object.freeze({ x: -2, z: 0 }),
    origin: "player",
  });
}

test("Story attack budgets admit stable enemy IDs and defer excess melee pressure", () => {
  const { director, events } = makeDirector(DIFFICULTY.story);
  const enemies = Array.from({ length: 4 }, () => {
    const enemy = director.spawnEnemy("thrall", { x: 2.4, z: 0 }, 1);
    enemy.attackCooldown = 0;
    return enemy;
  });

  director.update(1 / 60, PLAYER, () => {});

  assert.deepEqual(
    enemies.filter((enemy) => enemy.attackPending).map((enemy) => enemy.id),
    enemies.slice(0, 2).map((enemy) => enemy.id),
  );
  assert.equal(director.attackCoordinator.snapshot().leases.length, 2);
  assert.equal(events.filter(({ type }) => type === "enemyAttackLeaseGranted").length, 2);
  assert.equal(events.filter(({ type }) => type === "enemyAttackDeferred").length, 2);
  assert.ok(events
    .filter(({ type }) => type === "enemyAttackDeferred")
    .every(({ detail }) => detail.reason === "familyBudget"));
  assert.equal(enemies[0].attackWindup, ENEMY_ARCHETYPES.thrall.attacks.lunge.windup * DIFFICULTY.story.windupMultiplier);
  assert.equal(enemies[0].maxPoise, Math.round(42 * DIFFICULTY.story.poiseMultiplier));
});

test("Standard preserves authored windup cooldown and poise while Ruthless changes boss cadence", () => {
  const standard = makeDirector(DIFFICULTY.standard, "STANDARD-CADENCE");
  const thrall = standard.director.spawnEnemy("thrall", { x: 1.5, z: 0 }, 1);
  standard.director.beginAttack(thrall, "graveCleave", PLAYER.position, { x: -1, z: 0 });
  assert.equal(thrall.attackWindup, ENEMY_ARCHETYPES.thrall.attacks.graveCleave.windup);
  assert.equal(thrall.maxPoise, 42);
  standard.director.update(thrall.attackWindup + 0.001, PLAYER, () => {});
  assert.equal(thrall.attackCooldown, ENEMY_ARCHETYPES.thrall.attacks.graveCleave.cooldown);

  const ruthless = makeDirector(DIFFICULTY.ruthless, "RUTHLESS-CADENCE");
  const queen = ruthless.director.spawnEnemy("queen", { x: 0, z: 2 }, 10);
  ruthless.director.beginAttack(queen, "royalSlam", PLAYER.position, { x: 0, z: -1 });
  assert.equal(
    queen.attackWindup,
    ENEMY_ARCHETYPES.queen.attacks.royalSlam.windup * DIFFICULTY.ruthless.windupMultiplier,
  );
  assert.equal(queen.maxPoise, Math.round(240 * DIFFICULTY.ruthless.poiseMultiplier));
  ruthless.director.update(queen.attackWindup + 0.001, PLAYER, () => {});
  assert.equal(
    queen.attackCooldown,
    ENEMY_ARCHETYPES.queen.attacks.royalSlam.cooldown
      * DIFFICULTY.ruthless.cooldownMultiplier
      / DIFFICULTY.ruthless.bossCadenceMultiplier,
  );
});

test("dash leases persist through travel and release exactly once on completion", () => {
  const { director, events } = makeDirector();
  const reaver = director.spawnEnemy("reaver", { x: 5, z: 0 }, 4);
  director.beginAttack(reaver, "dashLane", PLAYER.position, { x: -1, z: 0 });
  const leaseId = reaver.attackLeaseId;

  director.update(reaver.attackWindup + 0.001, PLAYER, () => {});
  assert.equal(reaver.state, "dash");
  assert.equal(reaver.attackLeaseId, leaseId);
  assert.equal(director.attackCoordinator.snapshot().leases.length, 1);

  director.update(ENEMY_ARCHETYPES.reaver.attacks.dashLane.dashDuration + 0.001, PLAYER, () => {});
  assert.equal(reaver.state, "chase");
  assert.equal(reaver.attackLeaseId, null);
  assert.equal(director.attackCoordinator.snapshot().leases.length, 0);
  assert.deepEqual(
    events.filter(({ type }) => type === "enemyAttackLeaseReleased").map(({ detail }) => detail.reason),
    ["dashCompleted"],
  );
});

test("stagger defeat inactivity phase change and dismissal cannot strand leases", () => {
  const { director, events } = makeDirector();

  const staggered = director.spawnEnemy("reaver", { x: 3, z: 0 }, 4);
  director.beginAttack(staggered, "crosscut", PLAYER.position, { x: -1, z: 0 });
  director.resolveCombatHit(staggered, poiseBreak(staggered, "break"));

  const defeated = director.spawnEnemy("thrall", { x: 3, z: 1 }, 4);
  director.beginAttack(defeated, "lunge", PLAYER.position, { x: -1, z: 0 });
  director.resolveCombatHit(defeated, { ...poiseBreak(defeated, "defeat"), damage: defeated.maxHealth });

  const inactive = director.spawnEnemy("hexer", { x: 8, z: 0 }, 4);
  director.beginAttack(inactive, "aimedBolt", PLAYER.position, { x: -1, z: 0 });
  inactive.active = false;
  director.update(1 / 60, PLAYER, () => {});

  const queen = director.spawnEnemy("queen", { x: 0, z: 3 }, 10);
  director.beginAttack(queen, "royalLance", PLAYER.position, { x: 0, z: -1 });
  queen.health = queen.maxHealth * 0.6;
  director.update(1 / 60, PLAYER, () => {});

  const dismissed = director.spawnEnemy("boneguard", { x: -3, z: 0 }, 8);
  director.beginAttack(dismissed, "shieldSlam", PLAYER.position, { x: 1, z: 0 });
  director.dismissWitchOrigin();

  assert.equal(director.attackCoordinator.snapshot().leases.length, 0);
  assert.deepEqual(
    events
      .filter(({ type }) => type === "enemyAttackLeaseReleased")
      .map(({ detail }) => detail.reason),
    ["staggered", "defeated", "inactive", "phaseTransition", "dismissed"],
  );
});

test("large boss damage advances through both ordered phase transitions", () => {
  const { director, events } = makeDirector(DIFFICULTY.standard, "ORDERED-BOSS-PHASES");
  const queen = director.spawnEnemy("queen", { x: 0, z: 3 }, 10);
  queen.health = queen.maxHealth * 0.2;

  director.update(1 / 60, PLAYER, () => {});
  assert.equal(queen.bossPhase, 2);
  assert.equal(queen.state, "phaseTransition");
  assert.deepEqual(events.filter(({ type }) => type === "bossPhaseChanged").map(({ detail }) => detail.phase), [2]);

  director.update(0.82, PLAYER, () => {});
  assert.equal(queen.bossPhase, 2);
  assert.equal(queen.state, "chase");
  director.update(1 / 60, PLAYER, () => {});

  assert.equal(queen.bossPhase, 3);
  assert.equal(queen.state, "phaseTransition");
  assert.deepEqual(events.filter(({ type }) => type === "bossPhaseChanged").map(({ detail }) => detail.phase), [2, 3]);
});

test("entering phase three dismisses Witch guards and forbids every new summon path", () => {
  const { director, events } = makeDirector(DIFFICULTY.standard, "PHASE-THREE-GUARDS");
  const queen = director.spawnEnemy("queen", { x: 0, z: 3 }, 10);
  queen.bossPhase = 2;
  const summonedTypes = director.summonQueenGuard(queen, "setup-summon");
  const guards = director.enemies.filter((enemy) => enemy.id !== queen.id);
  assert.deepEqual(summonedTypes, ["thrall", "reaver", "wraith"]);

  const guardProjectile = director.spawnProjectile(guards[0].position, 0, 4, 5, 2, "violet", {
    kind: PROJECTILE_KINDS.HEX_BOLT,
    sourceType: guards[0].type,
    origin: guards[0].origin,
    enemyId: guards[0].id,
    enemyType: guards[0].type,
    enemyOrigin: guards[0].origin,
  });
  queen.health = queen.maxHealth * 0.34;
  director.update(1 / 60, PLAYER, () => {});

  assert.equal(queen.bossPhase, 3);
  assert.ok(guards.every((guard) => !guard.active && guard.dismissed));
  assert.equal(guardProjectile.active, false);
  const dismissal = events.find(({ type }) => type === "queenGuardsDismissed")?.detail;
  assert.equal(dismissal.actors.length, guards.length);
  assert.equal(dismissal.projectiles, 1);
  assert.equal(dismissal.remaining, 0);

  const actions = Array.from({ length: 48 }, () => director.chooseQueenAction(queen));
  assert.equal(actions.includes("summon"), false);
  const before = director.enemies.length;
  assert.deepEqual(director.summonQueenGuard(queen, "blocked-phase-three-summon"), []);
  assert.equal(director.enemies.length, before);
  assert.equal(events.some(({ type, detail }) => type === "queenSummon" && detail.actionId === "blocked-phase-three-summon"), false);
});

test("phase three has deterministic two-action combinations and measurably faster safe timing", () => {
  function sequence(seed) {
    const { director } = makeDirector(DIFFICULTY.ruthless, seed);
    const queen = director.spawnEnemy("queen", { x: 0, z: 3 }, 10);
    queen.bossPhase = 3;
    return Array.from({ length: 12 }, () => {
      const action = director.chooseQueenAction(queen);
      return { action, ...director.queenPatternState.lastActionMeta };
    });
  }

  const first = sequence("PHASE-THREE-COMBOS");
  assert.deepEqual(first, sequence("PHASE-THREE-COMBOS"));
  assert.equal(first.some(({ action }) => action === "summon"), false);
  for (let index = 0; index < first.length; index += 2) {
    assert.equal(first[index].comboStep, 1);
    assert.equal(first[index].continuesCombo, true);
    assert.equal(first[index + 1].comboStep, 2);
    assert.equal(first[index + 1].continuesCombo, false);
    assert.equal(first[index].comboId, first[index + 1].comboId);
  }

  const phaseTwo = makeDirector(DIFFICULTY.ruthless, "PHASE-TWO-TIMING");
  const phaseTwoQueen = phaseTwo.director.spawnEnemy("queen", { x: 0, z: 3 }, 10);
  phaseTwoQueen.bossPhase = 2;
  phaseTwo.director.beginAttack(phaseTwoQueen, "royalSlam", PLAYER.position, { x: 0, z: -1 });
  const phaseTwoWindup = phaseTwoQueen.attackWindup;
  phaseTwo.director.update(phaseTwoWindup + 0.001, PLAYER, () => {});
  const phaseTwoCooldown = phaseTwoQueen.attackCooldown;

  const phaseThree = makeDirector(DIFFICULTY.ruthless, "PHASE-THREE-TIMING");
  const phaseThreeQueen = phaseThree.director.spawnEnemy("queen", { x: 0, z: 3 }, 10);
  phaseThreeQueen.bossPhase = 3;
  phaseThreeQueen.queenActionMeta = Object.freeze({
    comboId: "queen-combo-test",
    comboStep: 1,
    comboLength: 2,
    continuesCombo: true,
  });
  phaseThree.director.beginAttack(phaseThreeQueen, "royalSlam", PLAYER.position, { x: 0, z: -1 });
  const phaseThreeWindup = phaseThreeQueen.attackWindup;
  phaseThree.director.update(phaseThreeWindup + 0.001, PLAYER, () => {});
  const phaseThreeComboGap = phaseThreeQueen.attackCooldown;

  const phaseThreeNormal = makeDirector(DIFFICULTY.ruthless, "PHASE-THREE-NORMAL-TIMING");
  const phaseThreeNormalQueen = phaseThreeNormal.director.spawnEnemy("queen", { x: 0, z: 3 }, 10);
  phaseThreeNormalQueen.bossPhase = 3;
  phaseThreeNormalQueen.queenActionMeta = Object.freeze({
    comboId: "queen-combo-test",
    comboStep: 2,
    comboLength: 2,
    continuesCombo: false,
  });
  phaseThreeNormal.director.beginAttack(phaseThreeNormalQueen, "royalSlam", PLAYER.position, { x: 0, z: -1 });
  phaseThreeNormal.director.update(phaseThreeNormalQueen.attackWindup + 0.001, PLAYER, () => {});
  const phaseThreeCooldown = phaseThreeNormalQueen.attackCooldown;

  assert.ok(phaseThreeWindup < phaseTwoWindup);
  assert.ok(phaseThreeWindup >= QUEEN_MIN_WINDUP_SECONDS);
  assert.ok(phaseThreeCooldown < phaseTwoCooldown);
  assert.ok(phaseThreeComboGap < phaseThreeCooldown * 0.3);
});

test("phase-three combinations remain sequential and every follow-up is telegraphed", () => {
  const { director, events } = makeDirector(DIFFICULTY.standard, "PHASE-THREE-RUNTIME-COMBOS");
  const queen = director.spawnEnemy("queen", { x: 0, z: 3 }, 10);
  queen.bossPhase = 3;
  queen.attackCooldown = 0;
  events.length = 0;

  for (let frame = 0; frame < 900; frame += 1) {
    director.update(1 / 60, PLAYER, () => {});
    const completedActions = events.filter(({ type, detail }) => type === "enemyAttack" && detail.enemyId === queen.id);
    if (completedActions.length >= 4) break;
  }

  const attacks = events.filter(({ type, detail }) => type === "enemyAttack" && detail.enemyId === queen.id).slice(0, 4);
  assert.equal(attacks.length, 4);
  assert.equal(attacks.some(({ detail }) => detail.attack === "summon"), false);
  for (let index = 0; index < attacks.length; index += 2) {
    assert.equal(attacks[index].detail.comboStep, 1);
    assert.equal(attacks[index + 1].detail.comboStep, 2);
    assert.equal(attacks[index].detail.comboId, attacks[index + 1].detail.comboId);
  }

  for (const attack of attacks) {
    const telegraphIndex = events.findIndex(({ type, detail }) => (
      type === "enemyTelegraph" && detail.actionId === attack.detail.actionId
    ));
    const attackIndex = events.indexOf(attack);
    assert.ok(telegraphIndex >= 0);
    assert.ok(telegraphIndex < attackIndex);
    const nextTelegraphIndex = events.findIndex((event, index) => (
      index > telegraphIndex
      && event.type === "enemyTelegraph"
      && event.detail.enemyId === queen.id
      && event.detail.actionId !== attack.detail.actionId
    ));
    if (nextTelegraphIndex >= 0) assert.ok(attackIndex < nextTelegraphIndex);
  }
});

test("phase two keeps deterministic summon and persistent-hazard caps", () => {
  const { director } = makeDirector(DIFFICULTY.standard, "PHASE-TWO-CAPS");
  const queen = director.spawnEnemy("queen", { x: 0, z: 3 }, 10);
  queen.bossPhase = 2;
  director.summonQueenGuard(queen, "summon-one");
  director.summonQueenGuard(queen, "summon-two");
  assert.equal(director.enemies.filter((enemy) => enemy.active && enemy.id !== queen.id).length, QUEEN_SUMMON_CAP);

  for (let index = 0; index < QUEEN_HAZARD_CAP; index += 1) {
    director.spawnProjectile(queen.position, 0, 0, 1, 5, "violet", {
      kind: PROJECTILE_KINDS.QUEEN_WELL,
      mode: "rune",
      sourceType: "queen",
      target: { x: index + 1, z: 0 },
      areaRadius: 2,
    });
  }
  const actions = Array.from({ length: 30 }, () => director.chooseQueenAction(queen));
  assert.equal(actions.includes("summon"), false);
  assert.equal(actions.includes("voidWell"), false);
});

test("teleport and summon expose stable timed anticipation release and recovery events", () => {
  for (const kind of ["teleport", "summon"]) {
    const { director, events } = makeDirector(DIFFICULTY.standard, `TIMED-${kind}`);
    const queen = director.spawnEnemy("queen", { x: 0, z: 3 }, 10);
    queen.bossPhase = 2;
    events.length = 0;

    const actionId = director.beginQueenSpecial(queen, kind);
    const anticipationDuration = queen.actionTimer;
    assert.match(actionId, /^enemy-action-\d+$/);
    assert.equal(queen.state, "queenSpecial");
    assert.equal(queen.queenSpecialStage, "anticipation");
    assert.deepEqual(events.map(({ type }) => type), ["enemyTelegraph", "queenSpecialAnticipated"]);
    assert.ok(events.every(({ detail }) => detail.actionId === actionId));

    director.update(anticipationDuration - 0.001, PLAYER, () => {});
    assert.equal(events.some(({ type }) => type === "queenSpecialReleased"), false);
    director.update(0.002, PLAYER, () => {});

    const actionEvent = kind === "teleport" ? "queenTeleport" : "queenSummon";
    const relevant = events.filter(({ type }) => [
      "enemyTelegraph",
      "queenSpecialAnticipated",
      "queenSpecialReleased",
      actionEvent,
      "enemyAttack",
    ].includes(type));
    assert.deepEqual(relevant.map(({ type }) => type), [
      "enemyTelegraph",
      "queenSpecialAnticipated",
      "queenSpecialReleased",
      actionEvent,
      "enemyAttack",
    ]);
    assert.ok(relevant.every(({ detail }) => detail.actionId === actionId));
    assert.equal(relevant[2].detail.stage, "release");

    director.update(0.5, PLAYER, () => {});
    const recovered = events.find(({ type }) => type === "queenSpecialRecovered");
    assert.equal(recovered.detail.actionId, actionId);
    assert.equal(recovered.detail.stage, "recovery");
    assert.equal(queen.state, "chase");
    assert.equal(queen.queenSpecialActionId, null);
  }
});
