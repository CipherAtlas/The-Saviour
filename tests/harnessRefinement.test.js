import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { benchmarkArenaDiagnostics, BENCHMARK_ARENA_TARGET, placeBenchmarkEnemies } from "../src/benchmark/benchmarkHarness.js";
import { isCircleWalkable } from "../src/game/arenaGeometry.js";
import { PERFORMANCE_BUDGET } from "../src/game/gameConfig.js";
import { generateArena } from "../src/generation/arenaGenerator.js";

test("the benchmark distributes the unchanged 35-enemy burst across the largest deterministic silhouette", () => {
  const arena = generateArena({
    seed: "BENCHMARK-REAPER",
    floor: BENCHMARK_ARENA_TARGET.floor,
    room: BENCHMARK_ARENA_TARGET.room,
    boss: false,
  });
  const enemies = Array.from({ length: PERFORMANCE_BUDGET.stressEnemies }, (_unused, index) => ({
    id: index + 1,
    radius: index % 6 === 2 ? 0.84 : 0.62,
    position: { x: 0, z: 0 },
    previousPosition: { x: 0, z: 0 },
  }));

  assert.equal(PERFORMANCE_BUDGET.stressEnemies, 35);
  assert.equal(placeBenchmarkEnemies(arena, enemies), true);
  assert.equal(new Set(enemies.map((enemy) => `${enemy.position.x}:${enemy.position.z}`)).size, 35);
  assert.ok(enemies.every((enemy) => isCircleWalkable(arena, enemy.position, enemy.radius)));

  const diagnostics = benchmarkArenaDiagnostics(arena, enemies);
  assert.equal(diagnostics.layoutFamily, "hourglass");
  assert.ok(diagnostics.width >= 60 && diagnostics.depth >= 45);
  assert.ok(diagnostics.walkableArea > 2_400);
  assert.equal(diagnostics.burstEnemies, 35);
  assert.equal(diagnostics.enemiesContained, true);
});

test("browser harness queries expose Speedrun startup and practical frozen-room probes", () => {
  const source = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");

  assert.match(source, /searchParams\.get\("runType"\) === "speedrun"/);
  assert.match(source, /settings\.set\("gameplay\.difficulty", autoplayRunType === "speedrun" \? "ruthless"/);
  assert.match(source, /runSession\.startSpeedrun\(autoplaySeed\)/);
  assert.match(source, /searchParams\.get\("pauseAfterRoomReady"\) === "1"/);
  assert.match(source, /searchParams\.get\("probe"\) !== "1"/);
  for (const field of [
    "layoutFamily",
    "recipeType",
    "walkableArea",
    "livingEnemies",
    "spawningEnemies",
    "pendingEnemies",
    "emergenceDuration",
    "playerShapeContained",
    "enemiesShapeContained",
  ]) assert.match(source, new RegExp(`probe\\.dataset\\.${field}`));
});
