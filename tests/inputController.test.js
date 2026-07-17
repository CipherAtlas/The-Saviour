import assert from "node:assert/strict";
import test from "node:test";
import { InputController } from "../src/game/InputController.js";

test("pressed actions survive render frames without a fixed simulation update", () => {
  const input = Object.create(InputController.prototype);
  input.pressed = new Set(["Mouse0", "ShiftLeft"]);

  input.endFrame(0);
  assert.deepEqual([...input.pressed], ["Mouse0", "ShiftLeft"]);

  input.endFrame(1);
  assert.equal(input.pressed.size, 0);
});

test("automation enters through the same action and movement reads as player input", () => {
  const input = Object.create(InputController.prototype);
  input.settings = { get: () => [] };
  input.down = new Set();
  input.pressed = new Set();
  input.touchMove = { x: 0, y: 0 };
  input.automationMove = { x: 0, y: 0 };
  input.automationPressed = new Set();
  input.automationHeld = new Set();

  input.setAutomationIntent({ movement: { x: 0.8, y: -0.2 }, pressed: ["dash"], held: ["heavy"] });

  assert.deepEqual(input.movement(), { x: 0.8, y: -0.2 });
  assert.equal(input.consume("dash"), true);
  assert.equal(input.consume("dash"), false);
  assert.equal(input.isDown("heavy"), true);
});

test("a movement tap between fixed ticks still advances for one simulation step", () => {
  const input = Object.create(InputController.prototype);
  input.settings = { get: (path) => path.endsWith("moveUp") ? ["KeyW"] : [] };
  input.down = new Set();
  input.pressed = new Set(["KeyW"]);
  input.touchMove = { x: 0, y: 0 };
  input.automationMove = { x: 0, y: 0 };
  input.automationPressed = new Set();
  input.automationHeld = new Set();

  assert.deepEqual(input.movement(), { x: 0, y: 1 });
  input.endFrame(1);
  assert.deepEqual(input.movement(), { x: 0, y: 0 });
});
