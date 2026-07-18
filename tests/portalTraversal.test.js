import assert from "node:assert/strict";
import test from "node:test";
import { Game } from "../src/game/Game.js";
import { PORTAL_CONFIG, RUN_CONFIG } from "../src/game/gameConfig.js";

function createInput() {
  const pressed = new Set();
  return {
    settings: { get: () => "hold" },
    movement: () => ({ x: 0, y: 0 }),
    isDown: () => false,
    consume(action) { return pressed.delete(action); },
    press(action) { pressed.add(action); },
    clear() { pressed.clear(); },
  };
}

function createSettings() {
  const values = { "gameplay.difficulty": "standard", "gameplay.autoTarget": 0, "gameplay.aimAssist": 0 };
  return { get: (path) => values[path] };
}

function startGame(seed, options = {}) {
  const input = createInput();
  const game = new Game(input, createSettings(), options);
  game.startRun(seed);
  if (options.requireRoomReady) game.acknowledgeRoomReady(game.roomLoadToken);
  while (game.phase === "dialogue") game.skipDialogue();
  return { game, input };
}

function clearEncounter(game) {
  for (const enemy of game.director.enemies) enemy.active = false;
  game.director.pendingWaves.length = 0;
  game.checkRoomProgress(RUN_CONFIG.roomClearDelay);
}

function advanceFixedTime(game, seconds) {
  const steps = Math.ceil(seconds / RUN_CONFIG.fixedStep);
  for (let index = 0; index < steps; index += 1) game.updateFixed(RUN_CONFIG.fixedStep);
}

test("a mandatory reward precedes the center portal and walking into it starts the fall", () => {
  const { game, input } = startGame("CENTER-PORTAL", { requireRoomReady: true });
  const events = [];
  game.on((event) => events.push(event));
  clearEncounter(game);

  assert.deepEqual(game.arena.portal, { x: 0, z: 0 });
  assert.equal(game.phase, "reward");
  assert.equal(game.portalActive, false);
  assert.equal(game.beginPortalTraversal(), false);
  assert.ok(events.some((event) => event.type === "roomRewardOffered"));
  assert.equal(events.some((event) => event.type === "portalOpened"), false);

  game.chooseRoomReward(game.pendingRoomRewards[0].id);
  assert.equal(game.phase, "playing");
  assert.equal(game.portalActive, true);
  assert.ok(events.some((event) => event.type === "portalOpened"));
  game.player.position = { x: 0, z: PORTAL_CONFIG.interactionRadius - 0.15 };
  game.player.previousPosition = { ...game.player.position };
  game.updateFixed(RUN_CONFIG.fixedStep);

  assert.equal(game.phase, "portalTraversal");
  assert.equal(game.room, 1);
  assert.equal(game.portalActive, false);
  assert.equal(game.portalTraversal.active, true);
  assert.equal(events.filter((event) => event.type === "portalTraversalStarted").length, 1);

  advanceFixedTime(game, PORTAL_CONFIG.traversalDuration * 0.4);
  assert.equal(game.room, 1);
  assert.ok(game.portalTraversal.visualHeight > 0.6);
  assert.ok(Math.hypot(game.player.position.x, game.player.position.z) < 0.1);

  advanceFixedTime(game, PORTAL_CONFIG.traversalDuration * 0.44);
  assert.equal(game.room, 1);
  assert.ok(game.portalTraversal.visualHeight < 0);

  advanceFixedTime(game, PORTAL_CONFIG.traversalDuration * 0.2);
  assert.equal(game.room, 2);
  assert.equal(game.phase, "roomLoading");
  assert.equal(game.roomReady, false);
  assert.equal(events.filter((event) => event.type === "portalTraversalCompleted").length, 1);

  input.press("interact");
  advanceFixedTime(game, PORTAL_CONFIG.traversalDuration * 2);
  assert.equal(game.room, 2);
  assert.equal(game.acknowledgeRoomReady("stale-room"), false);
  assert.equal(game.acknowledgeRoomReady(game.roomLoadToken), true);
  assert.equal(game.phase, "playing");
  assert.equal(game.acknowledgeRoomReady(game.roomLoadToken), false);
});

test("the third chamber portal completes once and opens the floor blessing", () => {
  const { game } = startGame("PORTAL-BLESSING");
  game.room = RUN_CONFIG.roomsPerFloor;
  game.loadRoom();
  clearEncounter(game);
  game.player.position = { x: 0, z: 1.2 };
  game.player.previousPosition = { ...game.player.position };
  game.updateFixed(RUN_CONFIG.fixedStep);
  advanceFixedTime(game, PORTAL_CONFIG.traversalDuration * 1.2);

  assert.equal(game.floor, 1);
  assert.equal(game.room, RUN_CONFIG.roomsPerFloor);
  assert.equal(game.phase, "blessing");
  assert.equal(game.pendingBlessings.length, 3);
  assert.equal(game.portalTraversal.completed, true);

  advanceFixedTime(game, PORTAL_CONFIG.traversalDuration * 2);
  assert.equal(game.phase, "blessing");
  assert.equal(game.pendingBlessings.length, 3);
});

test("a stale render completion cannot unlock a newer load of the same chamber id", () => {
  const { game } = startGame("ROOM-READY-TOKEN", { requireRoomReady: true });
  const staleToken = game.roomLoadToken;
  game.loadRoom();
  const currentToken = game.roomLoadToken;

  assert.notEqual(currentToken, staleToken);
  assert.equal(game.arena.id, "1-1");
  assert.equal(game.phase, "roomLoading");
  assert.equal(game.acknowledgeRoomReady(staleToken), false);
  assert.equal(game.phase, "roomLoading");
  assert.equal(game.acknowledgeRoomReady(currentToken), true);
  assert.equal(game.phase, "playing");
});
