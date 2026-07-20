import assert from "node:assert/strict";
import test from "node:test";
import {
  createNavigationCells,
  createWalkableShape,
  getPerimeterWallSegments,
  isCircleWalkable,
  isPointWalkable,
  isWalkableSegment,
  nearestWalkablePoint,
  walkableArea,
} from "../src/game/arenaGeometry.js";
import {
  advanceEmergence,
  BATCH_SPAWN_MODES,
  BATCH_TRIGGER_TYPES,
  createEmergenceState,
  createEncounterRecipe,
  ENCOUNTER_RECIPE_TYPES,
  ENEMY_EMERGENCE,
  ENEMY_LIFECYCLE_STATES,
  isEnemyInteractive,
} from "../src/game/encounterContracts.js";

const lShape = createWalkableShape({
  regions: [
    { id: "vertical", role: "combat", x: -4, z: 0, width: 8, depth: 24 },
    { id: "horizontal", role: "combat", x: 4, z: 8, width: 16, depth: 8 },
  ],
  majorRegionIds: ["vertical", "horizontal"],
  connectors: [{ id: "elbow", from: "vertical", to: "horizontal", width: 8 }],
});

test("walkable-shape queries share one non-rectangular silhouette", () => {
  assert.equal(isPointWalkable(lShape, { x: -4, z: -8 }), true);
  assert.equal(isPointWalkable(lShape, { x: 7, z: -8 }), false);
  assert.equal(isCircleWalkable(lShape, { x: 7, z: -8 }, 0.58), false);
  assert.equal(isWalkableSegment(lShape, { x: -4, z: -8 }, { x: -4, z: 8 }, 0.58), true);
  assert.equal(isWalkableSegment(lShape, { x: -4, z: 8 }, { x: 7, z: 8 }, 0.58), true);
  assert.equal(isWalkableSegment(lShape, { x: 7, z: -8 }, { x: 7, z: 8 }, 0.58), false);
  assert.ok(isCircleWalkable(lShape, nearestWalkablePoint(lShape, { x: 7, z: -8 }, 0.58), 0.58));
  assert.equal(walkableArea(lShape), 288);
  assert.ok(createNavigationCells(lShape, { cellSize: 1, clearance: 0.58 }).length > 150);
  assert.ok(getPerimeterWallSegments(lShape).length >= 6);
});

test("encounter recipe batches and emergence state use a closed shared contract", () => {
  const recipe = createEncounterRecipe({
    id: "contract-hybrid",
    type: ENCOUNTER_RECIPE_TYPES.HYBRID,
    activePopulationCap: 12,
    batches: [
      { id: "initial", trigger: { type: BATCH_TRIGGER_TYPES.INITIAL }, entries: [{ type: "thrall" }] },
      {
        id: "surge",
        trigger: { type: BATCH_TRIGGER_TYPES.REMAINING, remainingRatio: 0.6 },
        spawnMode: BATCH_SPAWN_MODES.STREAMED,
        streamIntervalSeconds: 0.18,
        entries: [{ type: "reaver" }, { type: "hexer" }],
      },
      { id: "reserve", trigger: { type: BATCH_TRIGGER_TYPES.REMAINING, remainingRatio: 0.3 }, entries: [{ type: "boneguard" }] },
    ],
  });
  assert.equal(recipe.totalPopulation, 4);
  assert.equal(Object.isFrozen(recipe.batches[1].entries), true);

  const lifecycle = createEmergenceState(3);
  const enemy = { lifecycle };
  assert.equal(isEnemyInteractive(enemy), false);
  assert.equal(advanceEmergence(lifecycle, ENEMY_EMERGENCE.durationSeconds - 0.01), false);
  assert.equal(advanceEmergence(lifecycle, 0.01), true);
  assert.equal(lifecycle.state, ENEMY_LIFECYCLE_STATES.ACTIVE);
  assert.equal(isEnemyInteractive(enemy), true);
});
