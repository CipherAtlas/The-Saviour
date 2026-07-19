import assert from "node:assert/strict";
import test from "node:test";
import { projectDamageAnchor } from "../src/rendering/DamageNumberLayer.js";

const BOUNDS = Object.freeze({ left: 100, top: 50, width: 800, height: 600 });

test("projection maps center and offsets through cached CSS canvas bounds", () => {
  assert.deepEqual(projectDamageAnchor({ x: 0, y: 0, z: 0 }, BOUNDS), { visible: true, x: 500, y: 350 });
  assert.deepEqual(projectDamageAnchor({ x: 0, y: 0, z: 0 }, BOUNDS, 18, -20), { visible: true, x: 518, y: 330 });
  const resized = { left: 0, top: 0, width: 400, height: 200 };
  assert.deepEqual(projectDamageAnchor({ x: 0, y: 0, z: 0 }, resized), { visible: true, x: 200, y: 100 });
});

test("projection culls depth and padded NDC while clamping glyph-safe visible corners", () => {
  assert.deepEqual(projectDamageAnchor({ x: -1, y: 1, z: 0 }, BOUNDS), { visible: true, x: 144, y: 76 });
  assert.deepEqual(projectDamageAnchor({ x: 1, y: -1, z: 0 }, BOUNDS), { visible: true, x: 856, y: 624 });
  assert.equal(projectDamageAnchor({ x: 1.17, y: 0, z: 0 }, BOUNDS).visible, false);
  assert.equal(projectDamageAnchor({ x: 0, y: 0, z: 1.01 }, BOUNDS).visible, false);
  assert.equal(projectDamageAnchor({ x: 0, y: 0, z: -1.01 }, BOUNDS).visible, false);
});
