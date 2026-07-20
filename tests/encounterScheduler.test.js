import assert from "node:assert/strict";
import test from "node:test";
import {
  BATCH_SPAWN_MODES,
  BATCH_TRIGGER_TYPES,
  createEncounterRecipe,
  ENCOUNTER_RECIPE_TYPES,
  ENEMY_EMERGENCE,
} from "../src/game/encounterContracts.js";
import { EncounterScheduler } from "../src/playtest/EncounterScheduler.js";

function entries(count, type = "thrall") {
  return Array.from({ length: count }, (_unused, index) => ({ type, rosterIndex: index }));
}

function recipe({ id, type, cap, batches }) {
  return createEncounterRecipe({ id, type, activePopulationCap: cap, batches });
}

test("a ceiling-sized horde emerges together and cannot be killed during its warning", () => {
  const scheduler = new EncounterScheduler(recipe({
    id: "horde-ceiling",
    type: ENCOUNTER_RECIPE_TYPES.HORDE,
    cap: 12,
    batches: [{
      id: "horde",
      trigger: { type: BATCH_TRIGGER_TYPES.INITIAL },
      entries: entries(12),
    }],
  }));

  const warning = scheduler.snapshot();
  assert.equal(warning.alive, 0);
  assert.equal(warning.spawning, 12);
  assert.equal(warning.maximumSimultaneous, 12);
  assert.equal(scheduler.kill(12).length, 0);
  assert.ok(warning.enemies.every((enemy) => !enemy.interactive && !enemy.canMove && !enemy.canAttack));

  scheduler.advance(ENEMY_EMERGENCE.durationSeconds);
  const active = scheduler.snapshot();
  assert.equal(active.alive, 12);
  assert.equal(active.spawning, 0);
  assert.ok(active.enemies.every((enemy) => enemy.interactive));
});

test("slow kills let timed pressure overlap without exceeding the population cap", () => {
  const scheduler = new EncounterScheduler(recipe({
    id: "timed-overlap",
    type: ENCOUNTER_RECIPE_TYPES.TIMED,
    cap: 4,
    batches: [
      { id: "initial", trigger: { type: BATCH_TRIGGER_TYPES.INITIAL }, entries: entries(3) },
      { id: "timer", trigger: { type: BATCH_TRIGGER_TYPES.TIMER, atSeconds: 1 }, entries: entries(3, "reaver") },
    ],
  }));

  scheduler.advance(1);
  let state = scheduler.snapshot();
  assert.equal(state.alive, 3);
  assert.equal(state.spawning, 1);
  assert.equal(state.pending, 2);
  assert.equal(state.batches[1].triggeredAtSeconds, 1);
  assert.equal(state.maximumSimultaneous, 4);

  scheduler.advance(ENEMY_EMERGENCE.durationSeconds);
  scheduler.kill(2);
  state = scheduler.snapshot();
  assert.equal(state.alive, 2);
  assert.equal(state.spawning, 2);
  assert.equal(state.pending, 0);
  assert.equal(state.maximumSimultaneous, 4);
});

test("fast kills release a death-triggered reserve at the preceding batch threshold", () => {
  const scheduler = new EncounterScheduler(recipe({
    id: "death-trigger",
    type: ENCOUNTER_RECIPE_TYPES.DEATH_TRIGGERED,
    cap: 12,
    batches: [
      { id: "initial", trigger: { type: BATCH_TRIGGER_TYPES.INITIAL }, entries: entries(8) },
      {
        id: "reserve",
        trigger: { type: BATCH_TRIGGER_TYPES.REMAINING, remainingCount: 2 },
        entries: entries(4, "boneguard"),
      },
    ],
  }));

  scheduler.advance(ENEMY_EMERGENCE.durationSeconds);
  scheduler.kill(5);
  assert.equal(scheduler.snapshot().batches[1].status, "pending");

  scheduler.kill(1);
  const triggered = scheduler.snapshot();
  assert.equal(triggered.batches[1].triggeredAtSeconds, ENEMY_EMERGENCE.durationSeconds);
  assert.equal(triggered.batches[1].spawned, 4);
  assert.equal(triggered.spawning, 4);
});

test("hybrid streaming preserves cadence and its final reserve waits for stream deaths", () => {
  const scheduler = new EncounterScheduler(recipe({
    id: "streamed-hybrid",
    type: ENCOUNTER_RECIPE_TYPES.HYBRID,
    cap: 8,
    batches: [
      { id: "initial", trigger: { type: BATCH_TRIGGER_TYPES.INITIAL }, entries: entries(2) },
      {
        id: "surge",
        trigger: { type: BATCH_TRIGGER_TYPES.TIMER, atSeconds: 1 },
        spawnMode: BATCH_SPAWN_MODES.STREAMED,
        streamIntervalSeconds: 0.2,
        entries: entries(3, "wraith"),
      },
      {
        id: "reserve",
        trigger: { type: BATCH_TRIGGER_TYPES.REMAINING, remainingRatio: 0.5 },
        entries: entries(2, "hexer"),
      },
    ],
  }));

  scheduler.advance(1);
  assert.equal(scheduler.snapshot().batches[1].spawned, 1);
  scheduler.advance(0.19);
  assert.equal(scheduler.snapshot().batches[1].spawned, 1);
  scheduler.advance(0.21);
  assert.equal(scheduler.snapshot().batches[1].spawned, 3);
  assert.equal(scheduler.snapshot().batches[2].status, "pending");

  scheduler.advance(ENEMY_EMERGENCE.durationSeconds);
  const surgeIds = scheduler.snapshot().enemies
    .filter((enemy) => enemy.batchId === "surge")
    .map((enemy) => enemy.id);
  assert.equal(scheduler.killEnemy(surgeIds[0]), true);
  assert.equal(scheduler.snapshot().batches[2].status, "pending");
  assert.equal(scheduler.killEnemy(surgeIds[1]), true);
  assert.equal(scheduler.snapshot().batches[2].status, "released");
});

test("an encounter cannot clear while any enemy is pending, emerging, or alive", () => {
  const scheduler = new EncounterScheduler(recipe({
    id: "clear-guard",
    type: ENCOUNTER_RECIPE_TYPES.TIMED,
    cap: 2,
    batches: [
      { id: "initial", trigger: { type: BATCH_TRIGGER_TYPES.INITIAL }, entries: entries(1) },
      { id: "timer", trigger: { type: BATCH_TRIGGER_TYPES.TIMER, atSeconds: 3 }, entries: entries(1) },
    ],
  }));

  assert.equal(scheduler.isClear(), false);
  scheduler.advance(ENEMY_EMERGENCE.durationSeconds);
  scheduler.kill(1);
  assert.equal(scheduler.snapshot().alive, 0);
  assert.equal(scheduler.snapshot().pending, 1);
  assert.equal(scheduler.isClear(), false);

  scheduler.advance(3 - ENEMY_EMERGENCE.durationSeconds);
  assert.equal(scheduler.isClear(), false);
  scheduler.advance(ENEMY_EMERGENCE.durationSeconds);
  scheduler.kill(1);
  assert.equal(scheduler.isClear(), true);
  assert.equal(scheduler.events.filter((event) => event.type === "encounterCleared").length, 1);
});

test("origin cancellation removes both emerging and pending entries without stranding the recipe", () => {
  const scheduler = new EncounterScheduler(recipe({
    id: "origin-cancellation",
    type: ENCOUNTER_RECIPE_TYPES.TIMED,
    cap: 4,
    batches: [
      {
        id: "initial",
        trigger: { type: BATCH_TRIGGER_TYPES.INITIAL },
        entries: [{ type: "thrall", origin: "stable" }, { type: "reaver", origin: "volatile" }],
      },
      {
        id: "timer",
        trigger: { type: BATCH_TRIGGER_TYPES.TIMER, atSeconds: 1 },
        entries: [{ type: "hexer", origin: "stable" }, { type: "wraith", origin: "volatile" }],
      },
    ],
  }));

  assert.equal(scheduler.cancelWhere((entry) => entry.origin === "stable", "originDismissed"), 2);
  assert.equal(scheduler.snapshot().spawning, 1);
  assert.equal(scheduler.snapshot().pending, 1);
  scheduler.advance(1 + ENEMY_EMERGENCE.durationSeconds);
  assert.deepEqual(
    scheduler.snapshot().enemies.filter((enemy) => enemy.interactive).map((enemy) => enemy.type),
    ["reaver", "wraith"],
  );
  scheduler.kill(2);
  assert.equal(scheduler.isClear(), true);
});
