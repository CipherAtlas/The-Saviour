import test from "node:test";
import assert from "node:assert/strict";
import { createEnemyProxyGeometry } from "../src/rendering/EnemyCharacterRenderer.js";
import { ENEMY_VISUAL_PROFILES } from "../src/rendering/enemyVisualProfiles.js";

test("every enemy LOD proxy builds as merge-compatible non-indexed 3D geometry", () => {
  for (const type of Object.keys(ENEMY_VISUAL_PROFILES)) {
    const geometry = createEnemyProxyGeometry(type);
    assert.ok(geometry?.isBufferGeometry, `${type} creates a buffer geometry`);
    assert.equal(geometry.index, null, `${type} stays non-indexed after merging`);
    assert.deepEqual(Object.keys(geometry.attributes).sort(), ["normal", "position"]);
    assert.equal(geometry.getAttribute("position").count % 3, 0);
    assert.ok(geometry.getAttribute("position").count / 3 < 1_500, `${type} stays within its proxy triangle budget`);
    assert.ok(Number.isFinite(geometry.boundingSphere?.radius) && geometry.boundingSphere.radius > 0);
    geometry.dispose();
  }
});
