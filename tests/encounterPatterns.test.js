import assert from "node:assert/strict";
import test from "node:test";
import { EnemyDirector } from "../src/game/EnemyDirector.js";
import { createEncounterPlan, ROLE_GROUPS } from "../src/game/encounterPatterns.js";
import { generateArena } from "../src/generation/arenaGenerator.js";
import { SeededRandom } from "../src/generation/seededRandom.js";

const difficulty = Object.freeze({ enemyHealth: 1, enemyDamage: 1, enemySpeed: 1 });

function plan(seed, floor = 8, room = 3) {
  const arena = generateArena({ seed, floor, room, boss: false });
  return createEncounterPlan({
    floor,
    room,
    biome: arena.biome,
    spawnPoints: arena.enemySpawnPoints,
    rng: new SeededRandom(`${seed}:plan`),
  });
}

test("encounter plans are deterministic and preserve the requested threat roster", () => {
  const first = plan("PLAN-DETERMINISM");
  const second = plan("PLAN-DETERMINISM");
  assert.deepEqual(first, second);
  assert.equal(first.waves.length, 3);
  assert.equal(first.waves.flatMap((wave) => wave.entries).length, 11);
  assert.ok(first.threat > 11);
});

test("late-floor recipes guarantee frontline, mobile, and ranged roles", () => {
  for (let seedIndex = 0; seedIndex < 120; seedIndex += 1) {
    const encounter = plan(`ROLE-SWEEP-${seedIndex}`);
    const types = new Set(encounter.waves.flatMap((wave) => wave.entries.map((entry) => entry.type)));
    for (const role of Object.values(ROLE_GROUPS)) {
      assert.ok(role.some((type) => types.has(type)), `missing role for seed ${seedIndex}`);
    }
  }
});

test("pending waves keep combat active through a fair inter-wave delay", () => {
  const seed = "WAVE-LIFECYCLE";
  const floor = 8;
  const room = 3;
  const arena = generateArena({ seed, floor, room, boss: false });
  const events = [];
  const director = new EnemyDirector((type, detail) => events.push({ type, detail }));
  director.reset({
    arena,
    floor,
    room,
    rng: new SeededRandom(`${seed}:encounter`),
    difficulty,
  });

  assert.equal(events.filter((event) => event.type === "encounterWaveStarted").length, 1);
  assert.ok(director.pendingWaves.length > 0);
  for (const enemy of director.enemies) enemy.active = false;
  assert.equal(director.hasLivingEnemies(), false);
  assert.equal(director.hasCombatRemaining(), true);

  const player = { position: { x: 0, z: 0 }, radius: 0.58 };
  director.update(0.2, player, () => {});
  assert.equal(director.hasLivingEnemies(), false);
  director.update(0.8, player, () => {});
  assert.equal(director.hasLivingEnemies(), true);
  assert.equal(events.filter((event) => event.type === "encounterWaveStarted").length, 2);

  while (director.pendingWaves.length > 0) {
    for (const enemy of director.enemies) enemy.active = false;
    director.update(1, player, () => {});
  }
  for (const enemy of director.enemies) enemy.active = false;
  assert.equal(director.hasCombatRemaining(), false);
  assert.equal(
    events.filter((event) => event.type === "encounterWaveStarted").length,
    director.encounterPlan.waves.length,
  );
});

test("biome identity changes deterministic encounter composition", () => {
  const spawnPoints = Array.from({ length: 18 }, (_unused, index) => ({ x: index - 9, z: 8 }));
  const make = (biome) => createEncounterPlan({
    floor: 9,
    room: 3,
    biome,
    spawnPoints,
    rng: new SeededRandom("BIOME-COMPOSITION"),
  }).waves.flatMap((wave) => wave.entries.map((entry) => entry.type));

  assert.notDeepEqual(make("forgottenKeep"), make("voidCourt"));
  assert.notDeepEqual(make("ossuary"), make("emberFoundry"));
});
