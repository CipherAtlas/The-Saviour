import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BLESSINGS } from "../src/game/blessings.js";
import { Game } from "../src/game/Game.js";
import { NARRATIVE_TIMING, PLAYER_CONFIG, RUN_CONFIG, SCYTHE_ATTACKS } from "../src/game/gameConfig.js";
import { RUN_UPGRADES } from "../src/game/runUpgrades.js";

function createInput() {
  const pressed = new Map();
  const released = new Map();
  const flushed = [];
  return {
    flushed,
    settings: { get: () => "hold" },
    movement: () => ({ x: 0, y: 0 }),
    isDown: () => false,
    consume(action) { return Boolean(pressed.delete(action)); },
    consumePressed(action) {
      const detail = pressed.get(action) ?? null;
      pressed.delete(action);
      return detail;
    },
    consumeReleased(action) {
      const detail = released.get(action) ?? null;
      released.delete(action);
      return detail;
    },
    press(action, timeStamp = 100) { pressed.set(action, { action, timeStamp }); },
    flushActions(actions) {
      flushed.push([...actions]);
      for (const action of actions) {
        pressed.delete(action);
        released.delete(action);
      }
    },
  };
}

function createSettings() {
  const values = {
    "gameplay.difficulty": "standard",
    "gameplay.autoTarget": 0,
    "gameplay.aimAssist": 0,
  };
  return { get: (path) => values[path] };
}

function createGame(seed) {
  const input = createInput();
  const game = new Game(input, createSettings());
  const events = [];
  game.on((event) => events.push(event));
  game.startRun(seed);
  while (game.phase === "dialogue") game.skipDialogue();
  return { game, input, events };
}

function damageAttempt(overrides = {}) {
  return Object.freeze({
    attemptId: overrides.attemptId ?? "damage-attempt-contract",
    actionId: overrides.actionId ?? "enemy-action-contract",
    amount: overrides.amount ?? 10,
    source: overrides.source ?? "crosscut",
    family: overrides.family ?? "circle",
    enemyId: overrides.enemyId ?? null,
    enemyType: overrides.enemyType ?? "reaver",
    enemyOrigin: overrides.enemyOrigin ?? "witch",
    projectileId: overrides.projectileId ?? null,
  });
}

test("actor-facing timing and hit severity thresholds are deeply frozen and ordered", () => {
  const strike = NARRATIVE_TIMING.endingStrike;
  assert.deepEqual(strike, { A0: 0, T: 0.14, C: 0.34, R: 0.78 });
  assert.ok(strike.A0 < strike.T && strike.T < strike.C && strike.C < strike.R);
  assert.equal(Object.isFrozen(NARRATIVE_TIMING), true);
  assert.equal(Object.isFrozen(strike), true);
  assert.equal(Object.isFrozen(PLAYER_CONFIG.hitSeverity), true);
  assert.ok(PLAYER_CONFIG.hitSeverity.heavyThresholdRatio > 0);
  assert.ok(PLAYER_CONFIG.hitSeverity.heavyThresholdRatio < 1);
});

test("playerHit is deeply frozen with applied severity, position, and live incoming direction", () => {
  const { game, events } = createGame("PLAYER-HIT-ACTOR-CONTRACT");
  for (const enemy of game.director.enemies) enemy.active = false;
  game.director.pendingWaves.length = 0;
  game.player.position = { x: 0, z: 0 };
  const enemy = game.director.spawnEnemy("reaver", { x: 4, z: 0 }, 1);
  enemy.speed = 0;
  enemy.attackCooldown = 999;
  events.length = 0;

  game.resolvePlayerDamageAttempt(damageAttempt({ enemyId: enemy.id, amount: 10 }));
  const light = events.find((event) => event.type === "playerHit").detail;
  assert.equal(light.appliedAmount, 10);
  assert.equal(light.severity, "light");
  assert.deepEqual(light.position, { x: 0, z: 0 });
  assert.deepEqual(light.direction, { x: -1, z: 0 });
  assert.equal(Object.isFrozen(light), true);
  assert.equal(Object.isFrozen(light.position), true);
  assert.equal(Object.isFrozen(light.direction), true);

  game.player.invulnerable = 0;
  game.resolvePlayerDamageAttempt(damageAttempt({
    attemptId: "damage-attempt-heavy",
    enemyId: enemy.id,
    amount: game.player.maxHealth * PLAYER_CONFIG.hitSeverity.heavyThresholdRatio,
  }));
  assert.equal(events.filter((event) => event.type === "playerHit").at(-1).detail.severity, "heavy");
});

test("positive kill, room, upgrade, blessing, and floor recovery each emit one playerHealed event", () => {
  const kill = createGame("PLAYER-HEAL-KILL");
  kill.events.length = 0;
  kill.game.player.health -= 20;
  kill.game.player.healthOnKill = 7;
  kill.game.applyHealthOnKill("attack-heal-source");
  kill.game.applyHealthOnKill("attack-full-source");
  const killHeals = kill.events.filter((event) => event.type === "playerHealed");
  assert.equal(killHeals.length, 2);
  assert.deepEqual(killHeals[0].detail, {
    healingId: "player-heal-1",
    targetId: "player",
    amount: 7,
    requestedAmount: 7,
    reason: "kill",
    position: kill.game.player.position,
    health: PLAYER_CONFIG.maxHealth - 13,
    maxHealth: PLAYER_CONFIG.maxHealth,
    sourceActionId: "attack-heal-source",
    upgradeId: null,
    floor: 1,
    room: 1,
  });
  assert.equal(Object.isFrozen(killHeals[0].detail), true);
  assert.equal(Object.isFrozen(killHeals[0].detail.position), true);
  kill.game.player.health = kill.game.player.maxHealth;
  kill.game.applyHealthOnKill("attack-at-full-health");
  assert.equal(kill.events.filter((event) => event.type === "playerHealed").length, 2);

  const room = createGame("PLAYER-HEAL-ROOM");
  room.events.length = 0;
  room.game.player.health = 40;
  room.game.director.enemies.length = 0;
  room.game.director.pendingWaves.length = 0;
  room.game.checkRoomProgress(RUN_CONFIG.roomClearDelay);
  const roomHeal = room.events.filter((event) => event.type === "playerHealed");
  assert.equal(roomHeal.length, 1);
  assert.equal(roomHeal[0].detail.reason, "roomRecovery");
  assert.deepEqual(Object.keys(roomHeal[0].detail), [
    "healingId", "targetId", "amount", "requestedAmount", "reason", "position",
    "health", "maxHealth", "sourceActionId", "upgradeId", "floor", "room",
  ]);
  assert.equal(roomHeal[0].detail.requestedAmount, 21);
  assert.equal(roomHeal[0].detail.sourceActionId, "room:1:1");
  assert.equal(roomHeal[0].detail.upgradeId, null);
  assert.equal(room.events.filter((event) => event.type === "roomRecovered").length, 1);

  const upgrade = createGame("PLAYER-HEAL-UPGRADE");
  upgrade.events.length = 0;
  upgrade.game.player.health -= 30;
  upgrade.game.phase = "reward";
  upgrade.game.roomRewardPending = true;
  upgrade.game.pendingRoomRewards = [RUN_UPGRADES.find(({ id }) => id === "marrow-vigor")];
  upgrade.game.chooseRoomReward("marrow-vigor");
  const upgradeHeals = upgrade.events.filter((event) => event.type === "playerHealed");
  assert.equal(upgradeHeals.length, 1);
  assert.equal(upgradeHeals[0].detail.reason, "roomUpgrade");
  assert.equal(upgradeHeals[0].detail.requestedAmount, 10);
  assert.equal(upgradeHeals[0].detail.sourceActionId, null);
  assert.equal(upgradeHeals[0].detail.upgradeId, "marrow-vigor");

  const blessing = createGame("PLAYER-HEAL-BLESSING");
  blessing.events.length = 0;
  blessing.game.player.health -= 60;
  blessing.game.phase = "blessing";
  blessing.game.pendingBlessings = [BLESSINGS.find(({ id }) => id === "royal-blood")];
  blessing.game.chooseBlessing("royal-blood");
  const blessingHeals = blessing.events.filter((event) => event.type === "playerHealed");
  assert.deepEqual(blessingHeals.map((event) => event.detail.reason), ["blessing", "floorRecovery"]);
  assert.deepEqual(blessingHeals.map((event) => event.detail.healingId), ["player-heal-1", "player-heal-2"]);
  assert.deepEqual(blessingHeals.map((event) => event.detail.upgradeId), ["royal-blood", null]);
  assert.deepEqual(blessingHeals.map((event) => event.detail.floor), [1, 2]);
  assert.ok(blessingHeals.every((event) => Object.isFrozen(event.detail) && Object.isFrozen(event.detail.position)));
});

test("Death Defiance cancels Claim and every player action before one immutable revival", () => {
  const { game, events } = createGame("PLAYER-REVIVE-ACTION-CANCEL");
  game.combat.claim.requestStart({
    origin: game.player.position,
    direction: { x: 1, z: 0 },
    inputTime: 10,
  });
  game.combat.startAttack(SCYTHE_ATTACKS[0], 0);
  game.combat.startHeavyCharge(game.player, 11, "hold");
  game.combat.startDash(game.player, { x: 1, y: 0 }, { timeStamp: 12 });
  game.combat.attackBuffer = 1;
  game.combat.heavyBuffer = 1;
  game.combat.dashBuffer = 1;
  game.combat.claimBuffer = 1;
  game.player.deathDefiance = 1;
  game.player.health = 1;
  game.player.invulnerable = 0;
  events.length = 0;

  game.damagePlayer(10, "revive-contract");

  assert.equal(game.combat.claim.phase, "idle");
  assert.equal(game.combat.attack, null);
  assert.equal(game.combat.chargingHeavy, false);
  assert.equal(game.combat.isDashing, false);
  assert.deepEqual(
    [game.combat.attackBuffer, game.combat.heavyBuffer, game.combat.dashBuffer, game.combat.claimBuffer],
    [0, 0, 0, 0],
  );
  const revived = events.filter((event) => event.type === "playerRevived");
  const healed = events.filter((event) => event.type === "playerHealed");
  assert.equal(healed.length, 1);
  assert.deepEqual(healed[0].detail, {
    healingId: "player-heal-1",
    targetId: "player",
    amount: game.player.health,
    requestedAmount: game.player.health,
    reason: "deathDefiance",
    position: game.player.position,
    health: game.player.health,
    maxHealth: game.player.maxHealth,
    sourceActionId: null,
    upgradeId: "final-mercy",
    floor: game.floor,
    room: game.room,
  });
  assert.equal(Object.isFrozen(healed[0].detail), true);
  assert.equal(Object.isFrozen(healed[0].detail.position), true);
  assert.equal(revived.length, 1);
  assert.equal(revived[0].detail.actionId, "player-revive-1");
  assert.equal(revived[0].detail.amount, game.player.health);
  assert.equal(Object.isFrozen(revived[0].detail), true);
  assert.equal(Object.isFrozen(revived[0].detail.position), true);
});

test("kill resolution runs one fixed-step ending strike and preserves coarse-step event order", () => {
  const { game, input, events } = createGame("ENDING-STRIKE-ACTION-CONTRACT");
  game.resetNarrativeState();
  events.length = 0;
  game.beginEndingDecision(1_000);
  events.length = 0;

  assert.equal(game.tryKillPrincess(1_001), true);
  assert.equal(game.phase, "endingStrike");
  assert.equal(game.tryKillPrincess(1_002), false);
  const actionId = events.find((event) => event.type === "endingStrikeStarted").detail.actionId;
  assert.equal(events.some((event) => event.type === "princessStruck"), false);
  game.updateNarrativeClock(1_000_000);
  assert.equal(game.endingStrike.elapsed, 0);

  assert.equal(game.togglePause(2_000), true);
  game.updateFixed(NARRATIVE_TIMING.endingStrike.R);
  assert.equal(game.endingStrike.elapsed, 0);
  assert.equal(game.togglePause(3_000), true);
  game.updateFixed(NARRATIVE_TIMING.endingStrike.R);

  const ordered = events
    .filter((event) => ["endingChoiceResolved", "endingStrikeStarted", "princessStruck", "endingStrikeCompleted"].includes(event.type));
  assert.deepEqual(ordered.map((event) => event.type), [
    "endingChoiceResolved",
    "endingStrikeStarted",
    "princessStruck",
    "endingStrikeCompleted",
  ]);
  assert.ok(ordered.slice(1).every((event) => event.detail.actionId === actionId));
  assert.equal(ordered[2].detail.contact, NARRATIVE_TIMING.endingStrike.C);
  assert.equal(ordered[3].detail.elapsed, NARRATIVE_TIMING.endingStrike.R);
  assert.ok(ordered.every((event) => Object.isFrozen(event.detail)));
  assert.equal(Object.isFrozen(ordered[1].detail.timing), true);
  assert.equal(game.phase, "dialogue");
  assert.equal(game.activeNarrative.id, "ending.kill");
  assert.ok(input.flushed.length > 0);

  const uiSource = readFileSync(new URL("../src/ui/GameUi.js", import.meta.url), "utf8");
  assert.match(uiSource, /"endingChoice", "endingStrike", "endingFade"/);
});
