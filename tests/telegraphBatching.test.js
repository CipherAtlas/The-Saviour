import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { EffectsPool, telegraphBatchDescriptor } from "../src/rendering/EffectsPool.js";

const settings = {
  get(key) {
    return {
      "accessibility.highContrast": false,
      "accessibility.reducedParticles": false,
      "accessibility.screenFlashes": true,
      "camera.reducedMotion": false,
      "gameplay.aimAssist": 0,
      "graphics.effectsDensity": 1,
    }[key] ?? 0;
  },
};

function warning(overrides = {}) {
  return {
    shape: "circle",
    position: { x: 0, z: 0 },
    duration: 1,
    radius: 2,
    ...overrides,
  };
}

test("telegraph descriptors group reusable shapes without changing cone coverage", () => {
  assert.deepEqual(telegraphBatchDescriptor(warning()), { key: "circle", angle: null });
  assert.deepEqual(telegraphBatchDescriptor(warning({ shape: "blink" })), { key: "circle", angle: null });
  assert.deepEqual(telegraphBatchDescriptor(warning({ shape: "ring" })), { key: "ring", angle: null });
  assert.deepEqual(telegraphBatchDescriptor(warning({ shape: "lane" })), { key: "lane", angle: null });

  const first = telegraphBatchDescriptor(warning({ shape: "cone", radius: 4, width: 3 }));
  const second = telegraphBatchDescriptor(warning({ shape: "cone", radius: 4, width: 3 }));
  assert.equal(first.key, second.key);
  assert.equal(first.angle, 2 * Math.atan2(1.5, 4));
});

test("simultaneous warnings render as shape batches with fill and rim layers", () => {
  const scene = new THREE.Scene();
  const pool = new EffectsPool(scene, settings);
  const warnings = [
    ...Array.from({ length: 4 }, (_, index) => warning({ position: { x: index, z: 0 } })),
    ...Array.from({ length: 3 }, (_, index) => warning({ shape: "ring", position: { x: index, z: 2 } })),
    ...Array.from({ length: 3 }, (_, index) => warning({
      shape: "lane",
      position: { x: index, z: 4 },
      origin: { x: index, z: 4 },
      direction: { x: 1, z: 0 },
      width: 1.2,
      radius: 4,
    })),
    ...Array.from({ length: 4 }, (_, index) => warning({
      shape: "cone",
      position: { x: index, z: 6 },
      origin: { x: index, z: 6 },
      direction: { x: 0, z: 1 },
      width: index < 2 ? 2 : 3,
      radius: 4,
    })),
  ];

  for (const detail of warnings) pool.spawnTelegraph(detail);
  pool.update(1 / 60);

  assert.equal(pool.activeTelegraphCount(), 14);
  assert.equal(pool.activeTelegraphBatchCount(), 5);
  assert.equal(
    [...pool.telegraphBatches.values()].reduce((count, batch) => count + batch.mesh.count, 0),
    14,
  );

  for (const batch of pool.telegraphBatches.values()) {
    if (batch.mesh.count === 0) continue;
    assert.equal(batch.mesh.isInstancedMesh, true);
    const roles = new Set(batch.mesh.geometry.getAttribute("layerRole").array);
    assert.deepEqual(roles, new Set([0, 1]));
  }

  assert.ok(pool.activeTelegraphBatchCount() < warnings.length * 2);
});

test("telegraph pooling retains its forty-warning capacity", () => {
  const pool = new EffectsPool(new THREE.Scene(), settings);
  for (let index = 0; index < 40; index += 1) {
    pool.spawnTelegraph(warning({ position: { x: index, z: 0 } }));
  }
  pool.update(1 / 60);

  assert.equal(pool.activeTelegraphCount(), 40);
  assert.equal(pool.activeTelegraphBatchCount(), 1);
  assert.equal(pool.telegraphBatches.get("circle").mesh.count, 40);
});
