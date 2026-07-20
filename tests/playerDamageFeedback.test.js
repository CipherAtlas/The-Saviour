import assert from "node:assert/strict";
import test from "node:test";
import { GameCamera } from "../src/rendering/GameCamera.js";
import {
  LOW_HEALTH_THRESHOLD,
  combatPresentationDescriptor,
  playerLowHealthUrgency,
} from "../src/rendering/GameRenderer.js";

function lowHealthGame(health, maxHealth = 100, phase = "playing") {
  return { phase, player: { health, maxHealth } };
}

test("low-health urgency begins below the threshold and rises smoothly toward death", () => {
  assert.equal(playerLowHealthUrgency(lowHealthGame(100)), 0);
  assert.equal(playerLowHealthUrgency(lowHealthGame(LOW_HEALTH_THRESHOLD * 100)), 0);
  const wounded = playerLowHealthUrgency(lowHealthGame(25));
  const critical = playerLowHealthUrgency(lowHealthGame(10));
  assert.ok(wounded > 0 && wounded < critical);
  assert.ok(critical < 1);
  assert.equal(playerLowHealthUrgency(lowHealthGame(0)), 0);
  assert.equal(playerLowHealthUrgency(lowHealthGame(10, 100, "paused")), 0);
  assert.equal(playerLowHealthUrgency(lowHealthGame(Number.NaN)), 0);
});

test("every accepted player hit carries visible camera trauma scaled by severity", () => {
  const options = { playerPosition: { x: 0, z: 0 } };
  const light = combatPresentationDescriptor("playerHit", { severity: "light" }, options);
  const heavy = combatPresentationDescriptor("playerHit", { severity: "heavy" }, options);
  assert.ok(light.trauma >= 0.4);
  assert.ok(heavy.trauma > light.trauma);
  assert.equal(light.bursts.length, 1);
  assert.equal(light.rings.length, 1);
});

test("critical health adds continuous camera motion without accumulating trauma", () => {
  const originalWindow = globalThis.window;
  globalThis.window = { innerWidth: 1280, innerHeight: 720 };
  try {
    const values = {
      "camera.zoom": 1,
      "camera.aimLookAhead": 0,
      "camera.reducedMotion": false,
      "camera.shake": 0.75,
      "camera.dynamicZoom": false,
    };
    const settings = { get: (key) => values[key] };
    const calm = new GameCamera(settings);
    const critical = new GameCamera(settings);
    const player = { x: 0, z: 0 };
    const aim = { x: 0, z: 0 };
    calm.snapTo(player);
    critical.snapTo(player);

    for (let frame = 0; frame < 30; frame += 1) {
      calm.update(1 / 60, player, aim, false, null, 0, 0);
      critical.update(1 / 60, player, aim, false, null, 0, 0.9);
    }

    assert.equal(critical.trauma, 0);
    assert.ok(critical.camera.position.distanceTo(calm.camera.position) > 0.02);

    values["camera.reducedMotion"] = true;
    const reduced = new GameCamera(settings);
    const reducedCalm = new GameCamera(settings);
    reduced.snapTo(player);
    reducedCalm.snapTo(player);
    for (let frame = 0; frame < 30; frame += 1) {
      reduced.update(1 / 60, player, aim, false, null, 0, 0.9);
      reducedCalm.update(1 / 60, player, aim, false, null, 0, 0);
    }
    assert.ok(reduced.camera.position.distanceTo(reducedCalm.camera.position) < Number.EPSILON);
    assert.ok(reduced.camera.position.length() > 0);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
