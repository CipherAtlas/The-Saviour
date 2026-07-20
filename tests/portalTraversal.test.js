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
  while (game.phase === "bookend") game.continueBookend();
  return { game, input };
}

function clearEncounter(game) {
  game.director.clearEncounter("testSetup");
  game.checkRoomProgress(RUN_CONFIG.roomClearDelay);
}

function advanceFixedTime(game, seconds) {
  const steps = Math.ceil(seconds / RUN_CONFIG.fixedStep);
  for (let index = 0; index < steps; index += 1) game.updateFixed(RUN_CONFIG.fixedStep);
}

test("portal entry continues directly into the next chamber", () => {
  const { game, input } = startGame("CENTER-PORTAL", { requireRoomReady: true });
  const events = [];
  game.on((event) => events.push(event));
  clearEncounter(game);

  assert.equal(Number.isFinite(game.arena.portal.x) && Number.isFinite(game.arena.portal.z), true);
  assert.equal(game.phase, "playing");
  assert.equal(game.portalActive, true);
  assert.ok(events.some((event) => event.type === "portalOpened"));
  assert.equal(events.some((event) => event.type === "bookendStarted"), false);
  assert.equal(events.some((event) => event.type === "roomRewardOffered"), false);
  game.player.position = {
    x: game.arena.portal.x,
    z: game.arena.portal.z + PORTAL_CONFIG.interactionRadius - 0.15,
  };
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
  assert.ok(Math.hypot(
    game.player.position.x - game.arena.portal.x,
    game.player.position.z - game.arena.portal.z,
  ) < 0.1);

  advanceFixedTime(game, PORTAL_CONFIG.traversalDuration * 0.44);
  assert.equal(game.room, 1);
  assert.ok(game.portalTraversal.visualHeight < 0);

  advanceFixedTime(game, PORTAL_CONFIG.traversalDuration * 0.2);
  assert.equal(game.room, 2);
  assert.equal(game.phase, "roomLoading");
  assert.equal(game.activeBookend, null);
  assert.equal(events.filter((event) => event.type === "portalTraversalCompleted").length, 1);
  assert.equal(events.some((event) => event.type === "roomRewardOffered"), false);
  assert.equal(game.portalActive, false);
  assert.equal(game.roomReady, false);

  const eventTypes = events.map(({ type }) => type);
  const orderedTypes = [
    "roomCleared",
    "portalOpened",
    "portalTraversalStarted",
    "portalTraversalCompleted",
    "arenaChanged",
  ];
  for (let index = 1; index < orderedTypes.length; index += 1) {
    assert.ok(
      eventTypes.indexOf(orderedTypes[index - 1]) < eventTypes.indexOf(orderedTypes[index]),
      `${orderedTypes[index - 1]} must precede ${orderedTypes[index]}`,
    );
  }

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
  game.player.position = { x: game.arena.portal.x, z: game.arena.portal.z + 1.2 };
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
