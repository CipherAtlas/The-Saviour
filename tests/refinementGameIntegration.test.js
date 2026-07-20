import assert from "node:assert/strict";
import test from "node:test";
import { Game } from "../src/game/Game.js";
import { isCircleWalkable } from "../src/game/arenaGeometry.js";
import { ENCOUNTER_RECIPE_TYPES } from "../src/game/encounterContracts.js";
import { RUN_CONFIG } from "../src/game/gameConfig.js";

function input() {
  return {
    settings: { get: () => "hold" },
    movement: () => ({ x: 0, y: 0 }),
    isDown: () => false,
    consume: () => false,
    consumePressed: () => null,
    consumeReleased: () => null,
    flushActions: () => {},
  };
}

function settings() {
  const values = {
    "gameplay.difficulty": "standard",
    "gameplay.autoTarget": 0,
    "gameplay.aimAssist": 0,
  };
  return { get: (path) => values[path] };
}

function initialize(seed) {
  const game = new Game(input(), settings());
  game.initializeRunState(seed);
  return game;
}

test("the runtime route preserves deterministic horde suppression and valid initial emergence placement", () => {
  const game = initialize("RUNTIME-ROUTE-CONTRACT");
  const recipes = [];
  const layouts = new Set();

  for (let floor = 1; floor <= RUN_CONFIG.totalFloors; floor += 1) {
    for (let room = 1; room <= RUN_CONFIG.roomsPerFloor; room += 1) {
      if (floor === RUN_CONFIG.totalFloors && room === RUN_CONFIG.roomsPerFloor) continue;
      game.floor = floor;
      game.room = room;
      game.loadRoom();
      const plan = game.director.encounterPlan;
      recipes.push(plan.type);
      layouts.add(game.arena.layoutFamily);
      assert.ok(game.director.enemies.length > 0, `${floor}-${room} did not release its initial batch`);
      assert.ok(game.director.enemies.every((enemy) => !game.director.isEnemyInteractive(enemy)));
      for (const enemy of game.director.enemies) {
        assert.equal(isCircleWalkable(game.arena, enemy.position, enemy.radius + 0.08), true);
        const playerDistance = Math.hypot(
          enemy.position.x - game.player.position.x,
          enemy.position.z - game.player.position.z,
        );
        assert.ok(playerDistance >= enemy.radius + game.player.radius + 0.08 - 1e-6);
      }
    }
  }

  for (let index = 1; index < recipes.length; index += 1) {
    assert.notEqual(
      recipes[index - 1] === ENCOUNTER_RECIPE_TYPES.HORDE && recipes[index] === ENCOUNTER_RECIPE_TYPES.HORDE,
      true,
      `adjacent runtime hordes at route indexes ${index - 1} and ${index}`,
    );
  }
  assert.equal(layouts.size, 8);
});

test("resumed deterministic regeneration derives the same previous recipe as uninterrupted progression", () => {
  const seed = "RUNTIME-RESUME-CONTRACT";
  const uninterrupted = initialize(seed);
  let previous = null;
  for (let floor = 1; floor <= 6; floor += 1) {
    for (let room = 1; room <= RUN_CONFIG.roomsPerFloor; room += 1) {
      if (floor === 6 && room === 2) break;
      uninterrupted.floor = floor;
      uninterrupted.room = room;
      uninterrupted.loadRoom();
      previous = uninterrupted.director.encounterPlan.type;
    }
  }

  const resumed = initialize(seed);
  resumed.floor = 6;
  resumed.room = 2;
  assert.equal(resumed.derivePreviousEncounterRecipeType(), previous);
  resumed.lastEncounterRecipeType = resumed.derivePreviousEncounterRecipeType();
  resumed.loadRoom();

  uninterrupted.floor = 6;
  uninterrupted.room = 2;
  uninterrupted.loadRoom();
  assert.deepEqual(resumed.director.encounterPlan, uninterrupted.director.encounterPlan);
  assert.deepEqual(resumed.arena, uninterrupted.arena);
});

test("reloading the same chamber retains its original previous-recipe context", () => {
  const game = initialize("RUNTIME-SAME-ROOM-RELOAD");
  game.floor = 3;
  game.room = 2;
  game.lastEncounterRecipeType = ENCOUNTER_RECIPE_TYPES.HORDE;
  game.loadRoom();
  const first = game.director.encounterPlan;
  game.loadRoom();
  assert.deepEqual(game.director.encounterPlan, first);
});
