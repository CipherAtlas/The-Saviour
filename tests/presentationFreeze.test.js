import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { EffectsPool } from "../src/rendering/EffectsPool.js";
import { presentationDelta } from "../src/rendering/GameRenderer.js";

function settings() {
  const values = {
    "accessibility.reducedParticles": false,
    "graphics.effectsDensity": 1,
    "camera.reducedMotion": false,
    "accessibility.screenFlashes": true,
    "accessibility.highContrast": false,
    "gameplay.aimAssist": 0,
  };
  return { get: (key) => values[key] };
}

test("pause and hit-stop produce one authoritative zero presentation delta", () => {
  const game = (phase, hitStop) => ({
    phase,
    hitStop: { remaining: () => hitStop },
  });
  assert.equal(presentationDelta(game("playing", 0), 1 / 60), 1 / 60);
  assert.equal(presentationDelta(game("paused", 0), 1 / 60), 0);
  assert.equal(presentationDelta(game("playing", 1 / 60), 1 / 60), 0);
  assert.equal(presentationDelta(game("playing", 0), 0), 0);
  assert.equal(presentationDelta(game("playing", 0), Number.NaN), 0);
});

test("zero delta renders newly spawned effects without aging any pooled visual", () => {
  const pool = new EffectsPool(new THREE.Scene(), settings());
  const position = { x: 2, z: -3 };
  pool.spawnBurst(position, 0x74e2ff, 1, 4);
  pool.spawnRing(position, 0.8, 0xffd985, 0.5);
  pool.spawnDashStreak(position, { x: 1, z: 0 });
  pool.spawnTelegraph({
    position,
    type: "queen",
    attack: "royalSlam",
    shape: "circle",
    radius: 2,
    duration: 0.6,
  });

  const particle = pool.particles.find((entry) => entry.active);
  const ring = pool.rings.find((entry) => entry.visible);
  const streak = pool.dashStreaks.find((entry) => entry.visible);
  const telegraph = pool.telegraphs.find((entry) => entry.active);
  const before = {
    particleLife: particle.life,
    particlePosition: particle.position.clone(),
    ringLife: ring.userData.life,
    ringOpacity: ring.material.opacity,
    ringScale: ring.scale.clone(),
    streakLife: streak.userData.life,
    telegraphLife: telegraph.life,
  };

  pool.update(0);
  assert.equal(particle.life, before.particleLife);
  assert.deepEqual(particle.position.toArray(), before.particlePosition.toArray());
  assert.equal(ring.userData.life, before.ringLife);
  assert.equal(ring.material.opacity, before.ringOpacity);
  assert.deepEqual(ring.scale.toArray(), before.ringScale.toArray());
  assert.equal(streak.userData.life, before.streakLife);
  assert.equal(telegraph.life, before.telegraphLife);
  assert.equal(pool.particleGeometry.drawRange.count, 1, "the frozen impact must still become visible");

  pool.update(0.1);
  assert.ok(particle.life < before.particleLife);
  assert.ok(ring.userData.life < before.ringLife);
  assert.ok(streak.userData.life < before.streakLife);
  assert.ok(telegraph.life < before.telegraphLife);
});

