import assert from "node:assert/strict";
import test from "node:test";
import { Game } from "../src/game/Game.js";
import {
  applyRunUpgrade,
  CHAMBER_FALLBACK,
  isUpgradeEligible,
  offerUpgradeChoices,
  RUN_UPGRADES,
} from "../src/game/runUpgrades.js";
import { RUN_CONFIG } from "../src/game/gameConfig.js";
import { SeededRandom } from "../src/generation/seededRandom.js";

function createInput() {
  return {
    settings: { get: () => "hold" },
    movement: () => ({ x: 0, y: 0 }),
    isDown: () => false,
    consume: () => false,
  };
}

function createSettings() {
  const values = { "gameplay.difficulty": "standard", "gameplay.autoTarget": 0, "gameplay.aimAssist": 0 };
  return { get: (path) => values[path] };
}

function startGame(seed) {
  const game = new Game(createInput(), createSettings());
  game.startRun(seed);
  while (game.phase === "dialogue") game.skipDialogue();
  return game;
}

function choiceSummary(choices) {
  return choices.map(({ id, path, rank, nextRank, maxRank }) => ({ id, path, rank, nextRank, maxRank }));
}

test("chamber offers are deterministic, unique, and span all three paths", () => {
  const ranks = new Map();
  const first = offerUpgradeChoices(new SeededRandom("REWARD-SEED"), ranks);
  const second = offerUpgradeChoices(new SeededRandom("REWARD-SEED"), ranks);

  assert.deepEqual(choiceSummary(first), choiceSummary(second));
  assert.equal(new Set(first.map((choice) => choice.id)).size, 3);
  assert.deepEqual(new Set(first.map((choice) => choice.path)), new Set(["Reaper", "Shade", "Grave"]));
  assert.ok(first.every((choice) => choice.rank === 0 && choice.nextRank === 1));
});

test("rank caps, mutual exclusions, and exhaustion fallback are enforced", () => {
  const player = {
    health: 100,
    maxHealth: 140,
    damageMultiplier: 1,
    reachMultiplier: 1,
    dashCooldownMultiplier: 1,
    criticalChance: 0.05,
    healthOnKill: 0,
    roomRecoveryBonus: 0,
  };
  const ranks = new Map();
  const merciless = RUN_UPGRADES.find((upgrade) => upgrade.id === "merciless-arc");
  const graveOath = RUN_UPGRADES.find((upgrade) => upgrade.id === "grave-oath");

  assert.equal(applyRunUpgrade(merciless, player, ranks).rank, 1);
  assert.equal(applyRunUpgrade(merciless, player, ranks), null);
  assert.equal(isUpgradeEligible(graveOath, ranks), false);

  const capped = new Map(RUN_UPGRADES.map((upgrade) => [upgrade.id, upgrade.maxRank]));
  const choices = offerUpgradeChoices(new SeededRandom("EXHAUSTED"), capped);
  assert.deepEqual(choices.map((choice) => choice.id), [CHAMBER_FALLBACK.id]);
});

test("pending encounter waves prevent an early room clear and reward phase", () => {
  const game = startGame("NO-EARLY-CLEAR");
  for (const enemy of game.director.enemies) enemy.active = false;
  game.director.pendingWaves = [{ index: 1, delay: 0.5, entries: [] }];

  game.checkRoomProgress(RUN_CONFIG.roomClearDelay);
  assert.equal(game.portalActive, false);
  assert.equal(game.phase, "playing");
  assert.equal(game.pendingRoomRewards.length, 0);

  game.director.pendingWaves = [];
  game.checkRoomProgress(RUN_CONFIG.roomClearDelay);
  assert.equal(game.portalActive, false);
  assert.equal(game.phase, "reward");
  assert.equal(game.pendingRoomRewards.length, 3);
});

test("chambers one and two grant a ranked reward before returning to the portal", () => {
  const game = startGame("CHAMBER-REWARD");
  const events = [];
  game.on((event) => events.push(event));
  game.director.enemies.length = 0;
  game.director.pendingWaves.length = 0;

  game.checkRoomProgress(RUN_CONFIG.roomClearDelay);
  assert.equal(game.phase, "reward");
  assert.equal(game.portalActive, false);
  const choice = game.pendingRoomRewards[0];
  game.chooseRoomReward(choice.id);

  assert.equal(game.phase, "playing");
  assert.equal(game.portalActive, true);
  assert.equal(game.upgradeRanks.get(choice.id), 1);
  assert.ok(events.some((event) => event.type === "roomRewardOffered"));
  assert.ok(events.some((event) => event.type === "roomRewardChosen" && event.detail.rank === 1));
  assert.ok(events.some((event) => event.type === "portalOpened"));
  assert.ok(
    events.findIndex((event) => event.type === "roomRewardOffered") <
    events.findIndex((event) => event.type === "portalOpened"),
  );
});

test("third chambers retain the major blessing transition before the next floor", () => {
  const game = startGame("MAJOR-BLESSING");
  game.room = RUN_CONFIG.roomsPerFloor;
  game.loadRoom();
  game.director.enemies.length = 0;
  game.director.pendingWaves.length = 0;
  game.checkRoomProgress(RUN_CONFIG.roomClearDelay);

  assert.equal(game.phase, "playing");
  assert.equal(game.pendingRoomRewards.length, 0);
  game.advanceRoom();
  assert.equal(game.phase, "blessing");
  assert.equal(game.pendingBlessings.length, 3);

  const choice = game.pendingBlessings[0];
  game.chooseBlessing(choice.id);
  assert.equal(game.floor, 2);
  assert.equal(game.room, 1);
  assert.equal(game.upgradeRanks.get(choice.id), 1);
});

test("boss showcase enters the final arena in a playable invulnerable state", () => {
  const game = new Game(createInput(), createSettings());
  const events = [];
  game.on((event) => events.push(event));

  game.enterBossShowcase("QA-BOSS");

  assert.equal(game.showcaseMode, "boss");
  assert.equal(game.floor, RUN_CONFIG.totalFloors);
  assert.equal(game.room, RUN_CONFIG.roomsPerFloor);
  assert.equal(game.arena.boss, true);
  assert.equal(game.phase, "playing");
  assert.equal(game.player.invulnerable, Number.POSITIVE_INFINITY);
  assert.equal(game.director.activeBoss()?.bossPhase, 1);
  assert.equal(game.dialogue.current, null);
  assert.ok(events.some((event) => event.type === "showcaseStarted" && event.detail.mode === "boss"));

  game.startRun("NORMAL-ROUTE");
  assert.equal(game.showcaseMode, null);
  assert.equal(game.floor, 1);
  assert.equal(game.room, 1);
  assert.equal(game.phase, "dialogue");
});

test("reward showcase exposes a deterministic real chamber offer without choosing it", () => {
  const first = new Game(createInput(), createSettings());
  const second = new Game(createInput(), createSettings());

  first.enterRewardShowcase("QA-REWARD");
  second.enterRewardShowcase("QA-REWARD");

  assert.equal(first.showcaseMode, "reward");
  assert.equal(first.phase, "reward");
  assert.equal(first.portalActive, false);
  assert.equal(first.roomRewardPending, true);
  assert.equal(first.director.hasCombatRemaining(), false);
  assert.equal(first.dialogue.current, null);
  assert.equal(first.pendingRoomRewards.length, 3);
  assert.deepEqual(new Set(first.pendingRoomRewards.map((choice) => choice.path)), new Set(["Reaper", "Shade", "Grave"]));
  assert.deepEqual(choiceSummary(first.pendingRoomRewards), choiceSummary(second.pendingRoomRewards));
});

test("the fixed update resolves player movement exactly once", () => {
  const game = startGame("MOVEMENT-RESOLUTION");
  const resolveMovement = game.combat.resolveMovement.bind(game.combat);
  let resolveCalls = 0;
  game.combat.resolveMovement = (movementResult) => {
    resolveCalls += 1;
    resolveMovement(movementResult);
  };

  game.updateFixed(RUN_CONFIG.fixedStep);

  assert.equal(resolveCalls, 1);
});
