import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  createWalkableShape,
  getPerimeterWallSegments,
  walkableArea,
} from "../src/game/arenaGeometry.js";
import {
  ENEMY_EMERGENCE,
  ENEMY_LIFECYCLE_STATES,
  createEmergenceState,
} from "../src/game/encounterContracts.js";
import {
  createPerimeterWallPieces,
  createShapedFloorPieces,
} from "../src/rendering/BiomeRenderer.js";
import { GameCamera } from "../src/rendering/GameCamera.js";
import {
  EnemyCharacterRenderer,
  sampleEnemyEmergencePresentation,
} from "../src/rendering/EnemyCharacterRenderer.js";

function lShapedArena() {
  return {
    width: 20,
    depth: 24,
    walkableShape: createWalkableShape({
      regions: [
        { id: "upright", role: "combat", x: -4, z: 0, width: 8, depth: 24 },
        { id: "arm", role: "combat", x: 2, z: 6, width: 20, depth: 8 },
      ],
      majorRegionIds: ["upright", "arm"],
      connectors: [{ id: "elbow", from: "upright", to: "arm", width: 8 }],
    }),
  };
}

function overlapArea(left, right) {
  const width = Math.max(0, Math.min(left.x + left.width / 2, right.x + right.width / 2)
    - Math.max(left.x - left.width / 2, right.x - right.width / 2));
  const depth = Math.max(0, Math.min(left.z + left.depth / 2, right.z + right.depth / 2)
    - Math.max(left.z - left.depth / 2, right.z - right.depth / 2));
  return width * depth;
}

test("floor pieces cover the region union exactly without filling a concave void", () => {
  const arena = lShapedArena();
  const pieces = createShapedFloorPieces(arena, 3, 2.5);
  const renderedArea = pieces.reduce((sum, piece) => sum + piece.width * piece.depth, 0);
  assert.ok(Math.abs(renderedArea - walkableArea(arena)) < 1e-8);

  for (let left = 0; left < pieces.length; left += 1) {
    const piece = pieces[left];
    assert.ok(piece.width <= 3 && piece.depth <= 2.5);
    for (const x of [piece.x - piece.width / 2, piece.x + piece.width / 2]) {
      for (const z of [piece.z - piece.depth / 2, piece.z + piece.depth / 2]) {
        assert.equal(arena.walkableShape.regions.some((region) => (
          x >= region.x - region.width / 2
          && x <= region.x + region.width / 2
          && z >= region.z - region.depth / 2
          && z <= region.z + region.depth / 2
        )), true);
      }
    }
    for (let right = left + 1; right < pieces.length; right += 1) {
      assert.ok(overlapArea(piece, pieces[right]) < 1e-10);
    }
  }
  assert.equal(pieces.some((piece) => piece.x > 0 && piece.z < 2), false);
});

test("wall pieces follow every authoritative perimeter segment and face its exterior normal", () => {
  const arena = lShapedArena();
  const perimeter = getPerimeterWallSegments(arena);
  const pieces = createPerimeterWallPieces(arena, 3.25);
  const lengthsByPerimeter = new Map();
  for (const piece of pieces) {
    assert.ok(piece.length <= 3.25);
    lengthsByPerimeter.set(piece.perimeterId, (lengthsByPerimeter.get(piece.perimeterId) ?? 0) + piece.length);
    const facing = { x: -Math.sin(piece.rotation), z: -Math.cos(piece.rotation) };
    assert.ok(Math.abs(facing.x - piece.normal.x) < 1e-10);
    assert.ok(Math.abs(facing.z - piece.normal.z) < 1e-10);
  }
  for (const segment of perimeter) {
    assert.ok(Math.abs(lengthsByPerimeter.get(segment.id) - segment.length) < 1e-8);
  }
});

test("camera keeps Zephyr in view after he crosses the arena's former camera boundary", () => {
  const originalWindow = globalThis.window;
  globalThis.window = { innerWidth: 1280, innerHeight: 720 };
  try {
    const values = {
      "camera.zoom": 1,
      "camera.aimLookAhead": 1,
      "camera.reducedMotion": true,
      "camera.shake": 0,
      "camera.dynamicZoom": false,
    };
    const camera = new GameCamera({ get: (key) => values[key] });
    const player = { x: 0, z: 0 };
    camera.snapTo(player);

    for (let frame = 0; frame < 300; frame += 1) {
      player.x += 9.2 / 60;
      player.z -= 4 / 60;
      camera.update(1 / 60, player, { x: player.x + 20, z: player.z }, false);
      camera.camera.updateMatrixWorld();
      const projectedPlayer = new THREE.Vector3(player.x, 0, player.z).project(camera.camera);
      assert.ok(Math.abs(projectedPlayer.x) <= 1, `Zephyr left the horizontal view on frame ${frame}`);
      assert.ok(Math.abs(projectedPlayer.y) <= 1, `Zephyr left the vertical view on frame ${frame}`);
    }

    assert.ok(player.x > 40, "the regression path must cross the previous arena clamp");
    assert.ok(camera.focus.x > 40, "camera focus must continue following beyond the arena boundary");
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("enemy rise sampling and animation duration use the mechanical emergence contract", () => {
  const lifecycle = createEmergenceState();
  lifecycle.elapsedSeconds = ENEMY_EMERGENCE.durationSeconds / 2;
  lifecycle.remainingSeconds = ENEMY_EMERGENCE.durationSeconds / 2;
  const enemy = { lifecycle, lifecycleState: ENEMY_LIFECYCLE_STATES.EMERGING };
  const halfway = sampleEnemyEmergencePresentation(enemy, ENEMY_EMERGENCE.durationSeconds);
  assert.equal(halfway.emerging, true);
  assert.equal(halfway.progress, 0.5);
  assert.equal(halfway.durationSeconds, ENEMY_EMERGENCE.durationSeconds);

  const renderer = new EnemyCharacterRenderer(new THREE.Scene(), {});
  const animation = renderer.resolveAnimation(
    {
      age: ENEMY_EMERGENCE.durationSeconds * 10,
      response: null,
      responseTime: 0,
      phaseTransition: null,
      queenSpecial: null,
      releaseKind: null,
      forcedClip: null,
    },
    {
      type: "thrall",
      active: true,
      state: "chase",
      hitFlash: 0,
      lifecycle,
    },
    false,
  );
  assert.equal(animation.key, "spawn");
  assert.equal(animation.duration, ENEMY_EMERGENCE.durationSeconds);

  lifecycle.state = ENEMY_LIFECYCLE_STATES.ACTIVE;
  assert.equal(sampleEnemyEmergencePresentation({ lifecycle }, 0).emerging, false);
});
