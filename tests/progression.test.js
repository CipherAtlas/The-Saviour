import assert from "node:assert/strict";
import test from "node:test";
import { Game } from "../src/game/Game.js";
import {
  BLESSINGS,
  chooseBlessings,
  oathSlotOrderForSeed,
  TECHNIQUE_SLOT_IDS,
  techniqueSlotForOathFloor,
} from "../src/game/blessings.js";
import { PORTAL_CONFIG, RUN_CONFIG } from "../src/game/gameConfig.js";
import { applyProgressionChoice } from "../src/game/progressionModel.js";
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

function playerState() {
  return {
    health: 140,
    maxHealth: 140,
    damageMultiplier: 1,
    reachMultiplier: 1,
    dashCooldownMultiplier: 1,
    criticalChance: 0.05,
    modifierRanks: {},
  };
}

function completeBookend(game) {
  while (game.phase === "bookend") game.continueBookend();
}

function startGame(seed) {
  const game = new Game(createInput(), createSettings());
  game.startRun(seed);
  completeBookend(game);
  return game;
}

function traverseOpenPortal(game) {
  game.player.position = { ...game.arena.portal };
  assert.equal(game.beginPortalTraversal(), true);
  game.updatePortalTraversal(PORTAL_CONFIG.traversalDuration);
}

test("floors one through five deterministically offer one three-path Oath set per technique", () => {
  const seed = "OATH-CADENCE";
  const slotOrder = oathSlotOrderForSeed(seed);
  const ranks = new Map();
  const owned = new Set();
  const player = playerState();

  assert.equal(new Set(slotOrder).size, TECHNIQUE_SLOT_IDS.length);
  for (let floor = 1; floor <= 5; floor += 1) {
    const choices = chooseBlessings(
      new SeededRandom(`${seed}:blessing-${floor}`),
      ranks,
      3,
      player,
      { floor, ownedOathIds: owned, slotOrder },
    );
    assert.equal(choices.length, 3);
    assert.deepEqual(new Set(choices.map(({ path }) => path)), new Set(["Reaper", "Shade", "Grave"]));
    assert.ok(choices.every(({ techniqueSlot, rank, nextRank }) => (
      techniqueSlot === techniqueSlotForOathFloor(slotOrder, floor) && rank === 0 && nextRank === 1
    )));
    const chosen = choices[floor % choices.length];
    assert.equal(applyProgressionChoice(chosen, player, ranks)?.rank, 1);
    owned.add(chosen.id);
  }
  assert.equal(owned.size, 5);
  assert.equal(new Set([...owned].map((id) => (
    BLESSINGS.find((definition) => definition.id === id)?.techniqueSlot
  ))).size, 5);
});

test("floors six through nine show every unmastered owned Oath in a shrinking compact pool", () => {
  const seed = "OATH-MASTERY";
  const slotOrder = oathSlotOrderForSeed(seed);
  const ranks = new Map();
  const owned = new Set();
  const player = playerState();

  for (let floor = 1; floor <= 5; floor += 1) {
    const choice = chooseBlessings(
      new SeededRandom(`${seed}:blessing-${floor}`), ranks, 3, player,
      { floor, ownedOathIds: owned, slotOrder },
    )[0];
    applyProgressionChoice(choice, player, ranks);
    owned.add(choice.id);
  }

  for (let floor = 6; floor <= 9; floor += 1) {
    const choices = chooseBlessings(
      new SeededRandom(`${seed}:blessing-${floor}`), ranks, 3, player,
      { floor, ownedOathIds: owned, slotOrder },
    );
    assert.equal(choices.length, 11 - floor);
    assert.ok(choices.every(({ id, rank, nextRank }) => owned.has(id) && rank === 1 && nextRank === 2));
    assert.equal(applyProgressionChoice(choices[0], player, ranks)?.rank, 2);
  }
  assert.equal([...owned].filter((id) => ranks.get(id) === 2).length, 4);
  assert.equal([...owned].filter((id) => ranks.get(id) === 1).length, 1);
});

test("ordinary chamber portals continue directly with no choice phase", () => {
  const game = startGame("DIRECT-CHAMBER");
  const events = [];
  game.on((event) => events.push(event));
  game.player.health = 40;
  game.director.clearEncounter("testSetup");

  game.checkRoomProgress(RUN_CONFIG.roomClearDelay);
  assert.equal(game.player.health, 61);
  assert.equal(game.portalActive, true);
  traverseOpenPortal(game);

  assert.equal(game.phase, "playing");
  assert.equal(game.room, 2);
  assert.equal(game.pendingBlessings.length, 0);
  assert.equal(events.some(({ type }) => ["roomRewardOffered", "upgradeRerolled"].includes(type)), false);
});

test("the third chamber transitions to one concise frozen Oath offer", () => {
  const game = startGame("FLOOR-OATH");
  const events = [];
  game.on((event) => events.push(event));
  game.room = RUN_CONFIG.roomsPerFloor;
  game.loadRoom();
  game.director.clearEncounter("testSetup");
  game.checkRoomProgress(RUN_CONFIG.roomClearDelay);
  traverseOpenPortal(game);

  assert.equal(game.phase, "blessing");
  assert.equal(game.pendingBlessings.length, 3);
  const offer = events.find(({ type }) => type === "blessingOffered").detail;
  assert.equal(offer.selectionMode, "choose");
  assert.equal(offer.techniqueSlot, techniqueSlotForOathFloor(oathSlotOrderForSeed(game.seed), 1));
  assert.equal(Object.isFrozen(offer.choices), true);
  assert.deepEqual(Object.keys(offer.choices[0]), [
    "id", "name", "benefit", "cost", "path", "techniqueSlot", "rank", "nextRank", "maxRank",
  ]);
  assert.deepEqual(Object.keys(offer.build), ["oaths", "oathSlots"]);

  const choice = game.pendingBlessings[0];
  game.chooseBlessing(choice.id);
  assert.equal(game.floor, 2);
  assert.equal(game.room, 1);
  assert.equal(game.upgradeRanks.get(choice.id), 1);
  assert.equal(game.ownedBlessings.has(choice.id), true);
});

test("the Oath showcase exposes the real first-floor offer without combat", () => {
  const first = new Game(createInput(), createSettings());
  const second = new Game(createInput(), createSettings());
  first.enterOathShowcase("QA-OATH");
  second.enterOathShowcase("QA-OATH");

  assert.equal(first.showcaseMode, "oath");
  assert.equal(first.phase, "blessing");
  assert.equal(first.director.hasCombatRemaining(), false);
  assert.equal(first.pendingBlessings.length, 3);
  assert.deepEqual(
    first.pendingBlessings.map(({ id }) => id),
    second.pendingBlessings.map(({ id }) => id),
  );
});

test("boss showcase enters the final arena in a playable invulnerable state", () => {
  const game = new Game(createInput(), createSettings());
  game.enterBossShowcase("QA-BOSS");
  assert.equal(game.showcaseMode, "boss");
  assert.equal(game.floor, RUN_CONFIG.totalFloors);
  assert.equal(game.room, RUN_CONFIG.roomsPerFloor);
  assert.equal(game.arena.boss, true);
  assert.equal(game.phase, "playing");
  assert.equal(game.player.invulnerable, Number.POSITIVE_INFINITY);
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
