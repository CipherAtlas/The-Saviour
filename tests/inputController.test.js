import assert from "node:assert/strict";
import test from "node:test";
import { InputController } from "../src/game/InputController.js";

function createInput(bindings = {}) {
  const input = Object.create(InputController.prototype);
  input.settings = { get: (path) => bindings[path.split(".").at(-1)] ?? [] };
  input.down = new Set();
  input.pressed = new Set();
  input.pressedAt = new Map();
  input.released = new Set();
  input.releasedAt = new Map();
  input.touchMove = { x: 0, y: 0 };
  input.touchAim = { x: 0, y: 0 };
  input.touchDown = new Set();
  input.touchPressed = new Set();
  input.touchPressedAt = new Map();
  input.touchReleased = new Set();
  input.touchReleasedAt = new Map();
  input.gamepadMove = { x: 0, y: 0 };
  input.gamepadAim = { x: 0, y: 0 };
  input.gamepadStates = new Map();
  input.activeGamepadIndex = null;
  input.lastAimDirection = { x: 1, y: 0 };
  input.activeDevice = "keyboardMouse";
  input.activeDeviceListeners = new Set();
  input.automationMove = { x: 0, y: 0 };
  input.automationPressed = new Set();
  input.automationHeld = new Set();
  input.automationReleasedAt = new Map();
  input.capture = null;
  input.enabled = true;
  input.canvas = { focus() {} };
  return input;
}

function gamepad({ buttons = [], axes = [0, 0, 0, 0], index = 0, connected = true } = {}) {
  return {
    index,
    connected,
    axes,
    buttons: Array.from({ length: 17 }, (_, buttonIndex) => ({
      pressed: buttons.includes(buttonIndex),
      value: buttons.includes(buttonIndex) ? 1 : 0,
    })),
  };
}

function focusedControl(kind) {
  return {
    closest(selector) {
      const matches = {
        button: selector.startsWith("button,"),
        select: selector.includes(", select,"),
        input: selector.startsWith("input:not"),
        textarea: selector.includes(", textarea,"),
        contenteditable: selector.includes("[contenteditable='true']"),
      };
      return matches[kind] ? this : null;
    },
  };
}

test("pressed actions survive render frames without a fixed simulation update", () => {
  const input = Object.create(InputController.prototype);
  input.pressed = new Set(["Mouse0", "ShiftLeft"]);

  input.endFrame(0);
  assert.deepEqual([...input.pressed], ["Mouse0", "ShiftLeft"]);

  input.endFrame(1);
  assert.equal(input.pressed.size, 0);
});

test("released actions survive render-only frames and clear after one fixed step", () => {
  const input = createInput({ heavy: ["KeyQ"] });
  input.down.add("KeyQ");
  input.onKeyUp({ code: "KeyQ", timeStamp: 120 });

  input.endFrame(0);
  assert.deepEqual(input.consumeReleased("heavy"), { action: "heavy", binding: "KeyQ", timeStamp: 120 });
  input.down.add("KeyQ");
  input.onKeyUp({ code: "KeyQ", timeStamp: 140 });
  input.endFrame(1);
  assert.equal(input.consumeReleased("heavy"), null);
});

test("keyboard and mouse releases expose one-shot timestamped action edges", () => {
  const input = createInput({ heavy: ["KeyQ", "Mouse2"] });
  input.down.add("KeyQ");
  input.onKeyUp({ code: "KeyQ", timeStamp: 200 });
  assert.deepEqual(input.consumeReleased("heavy"), { action: "heavy", binding: "KeyQ", timeStamp: 200 });
  assert.equal(input.consumeReleased("heavy"), null);

  input.down.add("Mouse2");
  input.onPointerUp({ button: 2, timeStamp: 240 });
  assert.deepEqual(input.consumeReleased("heavy"), { action: "heavy", binding: "Mouse2", timeStamp: 240 });
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

test("discrete actions retain their event timestamp and flush stale ending edges", () => {
  const input = Object.create(InputController.prototype);
  input.settings = { get: (path) => path.endsWith("attack") ? ["Mouse0"] : path.endsWith("interact") ? ["KeyE"] : [] };
  input.pressed = new Set(["Mouse0", "KeyE"]);
  input.pressedAt = new Map([["Mouse0", 1234], ["KeyE", 1240]]);
  input.automationPressed = new Set();

  assert.deepEqual(input.consumePressed("attack"), {
    action: "attack",
    binding: "Mouse0",
    timeStamp: 1234,
  });
  assert.equal(input.consumePressed("attack"), null);
  input.flushActions(["interact"]);
  assert.equal(input.pressed.has("KeyE"), false);
  assert.equal(input.pressedAt.has("KeyE"), false);
});

test("gamepad buttons expose pressed edges and held actions through canonical bindings", () => {
  const input = createInput({ claim: ["KeyR", "Gamepad:RB"] });
  input.pollGamepads([gamepad({ buttons: [5] })], 4242);

  assert.equal(input.activeDevice, "gamepad");
  assert.equal(input.isDown("claim"), true);
  assert.deepEqual(input.consumePressed("claim"), {
    action: "claim",
    binding: "Gamepad:RB",
    timeStamp: 4242,
  });
  assert.equal(input.consumePressed("claim"), null);
  assert.equal(input.isDown("claim"), true);

  input.pollGamepads([gamepad()], 4250);
  assert.equal(input.isDown("claim"), false);
  assert.deepEqual(input.consumeReleased("claim"), {
    action: "claim",
    binding: "Gamepad:RB",
    timeStamp: 4250,
  });
  assert.equal(input.consumeReleased("claim"), null);
});

test("keyboard, controller, and touch dash edges preserve equivalent timestamps", () => {
  const keyboard = createInput({ dash: ["ShiftLeft"] });
  keyboard.onKeyDown({ code: "ShiftLeft", timeStamp: 101, repeat: false, preventDefault() {} });
  assert.deepEqual(keyboard.consumePressed("dash"), {
    action: "dash",
    binding: "ShiftLeft",
    timeStamp: 101,
  });

  const controller = createInput({ dash: ["Gamepad:B"] });
  controller.pollGamepads([gamepad({ buttons: [1] })], 202);
  assert.deepEqual(controller.consumePressed("dash"), {
    action: "dash",
    binding: "Gamepad:B",
    timeStamp: 202,
  });

  const touch = createInput({ dash: ["ShiftLeft", "Gamepad:B"] });
  touch.setTouchAction("dash", true, 303);
  assert.deepEqual(touch.consumePressed("dash"), {
    action: "dash",
    binding: "Touch:dash",
    timeStamp: 303,
  });
});

test("bound action keys still route through a focused button", () => {
  const input = createInput({ moveUp: ["KeyW"] });
  let prevented = false;

  input.onKeyDown({
    code: "KeyW",
    timeStamp: 404,
    repeat: false,
    target: focusedControl("button"),
    preventDefault() { prevented = true; },
  });

  assert.deepEqual(input.consumePressed("moveUp"), {
    action: "moveUp",
    binding: "KeyW",
    timeStamp: 404,
  });
  assert.equal(prevented, false);
});

test("focused buttons retain native activation and focus-navigation keys without gameplay edges", () => {
  const button = focusedControl("button");

  for (const code of ["Space", "Enter", "NumpadEnter", "Tab"]) {
    const input = createInput({ dash: [code] });
    let prevented = false;
    input.onKeyDown({
      code,
      timeStamp: 500,
      repeat: false,
      target: button,
      preventDefault() { prevented = true; },
    });
    assert.equal(input.consumePressed("dash"), null, `${code} must not create a gameplay edge`);
    assert.equal(input.down.has(code), false);
    assert.equal(prevented, false);
  }
});

test("binding capture exposes its active state to menu input", () => {
  const input = createInput();
  assert.equal(input.isCapturingBinding, false);
  const pending = input.captureNextBinding();
  assert.equal(input.isCapturingBinding, true);
  input.cancelCapture();
  assert.equal(input.isCapturingBinding, false);
  return pending;
});

test("select and editing controls keep all keyboard behavior native", () => {
  for (const selector of ["select", "input", "textarea", "contenteditable"]) {
    const input = createInput({ moveUp: ["KeyW"] });
    input.onKeyDown({
      code: "KeyW",
      timeStamp: 600,
      repeat: false,
      target: focusedControl(selector),
      preventDefault() { assert.fail(`${selector} keyboard behavior must stay native`); },
    });
    assert.equal(input.consumePressed("moveUp"), null);
    assert.equal(input.down.has("KeyW"), false);
  }
});

test("right-stick aim uses a radial deadzone and preserves the last valid direction", () => {
  const input = createInput();
  input.pollGamepads([gamepad({ axes: [0.1, 0.1, 0.6, -0.8] })], 10);
  assert.deepEqual(input.gamepadMove, { x: 0, y: 0 });
  assert.deepEqual(input.aimIntent(), { kind: "direction", x: 0.6, y: 0.8, device: "gamepad" });

  input.pollGamepads([gamepad({ axes: [0, 0, 0.1, -0.1] })], 20);
  assert.deepEqual(input.gamepadAim, { x: 0, y: 0 });
  assert.deepEqual(input.aimIntent(), { kind: "direction", x: 0.6, y: 0.8, device: "gamepad" });
});

test("analog drift changes the active device only after radial deadzone hysteresis", () => {
  const input = createInput();
  const events = [];
  input.onActiveDeviceChanged((event) => events.push(event.detail));

  input.pollGamepads([gamepad({ axes: [0.25, 0, 0, 0] })], 10);
  assert.equal(input.activeDevice, "keyboardMouse");
  assert.deepEqual(events, []);

  input.pollGamepads([gamepad({ axes: [0.29, 0, 0, 0] })], 20);
  assert.equal(input.activeDevice, "gamepad");
  assert.deepEqual(events, [{
    previous: "keyboardMouse",
    current: "gamepad",
    previousGamepadIndex: null,
    currentGamepadIndex: 0,
    device: "gamepad",
    gamepadIndex: 0,
  }]);
  assert.equal(Object.isFrozen(events[0]), true);
});

test("active-device events expose exact transitions and suppress unchanged device/index churn", () => {
  const input = createInput();
  const events = [];
  input.onActiveDeviceChanged((event) => events.push(event.detail));

  input.setActiveDevice("keyboardMouse");
  input.setActiveDevice("gamepad", 0);
  input.setActiveDevice("gamepad", 0);
  input.setActiveDevice("gamepad", 1);
  input.setActiveDevice(null, 99);
  input.setActiveDevice(null);

  assert.deepEqual(events, [
    {
      previous: "keyboardMouse",
      current: "gamepad",
      previousGamepadIndex: null,
      currentGamepadIndex: 0,
      device: "gamepad",
      gamepadIndex: 0,
    },
    {
      previous: "gamepad",
      current: "gamepad",
      previousGamepadIndex: 0,
      currentGamepadIndex: 1,
      device: "gamepad",
      gamepadIndex: 1,
    },
    {
      previous: "gamepad",
      current: null,
      previousGamepadIndex: 1,
      currentGamepadIndex: null,
      device: null,
      gamepadIndex: null,
    },
  ]);
});

test("touch actions and aim stay transient and never mutate persisted bindings", () => {
  const persisted = { claim: ["KeyR", "Gamepad:RB"] };
  const input = createInput(persisted);
  const before = structuredClone(persisted);

  input.setTouchAction("claim", true, 99);
  input.setTouchAim(3, 4);
  assert.equal(input.isDown("claim"), true);
  assert.deepEqual(input.consumePressed("claim"), { action: "claim", binding: "Touch:claim", timeStamp: 99 });
  assert.deepEqual(input.aimIntent(), { kind: "direction", x: 0.6, y: 0.8, device: "touch" });
  assert.deepEqual(persisted, before);

  input.setTouchAction("claim", false, 120);
  assert.equal(input.isDown("claim"), false);
  assert.deepEqual(input.consumeReleased("claim"), { action: "claim", binding: "Touch:claim", timeStamp: 120 });
});

test("automation held transitions produce timestamped release edges", () => {
  const input = createInput();
  input.setAutomationIntent({ held: ["heavy"], timeStamp: 300 });
  input.setAutomationIntent({ held: [], timeStamp: 360 });
  assert.deepEqual(input.consumeReleased("heavy"), {
    action: "heavy",
    binding: "Automation:heavy",
    timeStamp: 360,
  });
  assert.equal(input.consumeReleased("heavy"), null);
});

test("flush and blur remove stale release edges from every transient source", () => {
  const input = createInput({ heavy: ["KeyQ"] });
  input.down.add("KeyQ");
  input.onKeyUp({ code: "KeyQ", timeStamp: 400 });
  input.setTouchAction("heavy", true, 401);
  input.setTouchAction("heavy", false, 402);
  input.setAutomationIntent({ held: ["heavy"], timeStamp: 403 });
  input.setAutomationIntent({ held: [], timeStamp: 404 });
  input.flushActions(["heavy"]);
  assert.equal(input.consumeReleased("heavy"), null);

  input.down.add("KeyQ");
  input.onKeyUp({ code: "KeyQ", timeStamp: 410 });
  input.onBlur();
  assert.equal(input.consumeReleased("heavy"), null);
});

test("disconnect and blur release device state without clearing keyboard state on disconnect", () => {
  const input = createInput({ moveUp: ["KeyW"], claim: ["Gamepad:RB"] });
  const events = [];
  input.onActiveDeviceChanged((event) => events.push(event.detail));
  input.down.add("KeyW");
  input.pollGamepads([gamepad({ buttons: [5] })], 10);
  input.releaseGamepad(0);
  assert.equal(input.down.has("KeyW"), true);
  assert.equal(input.down.has("Gamepad:RB"), false);
  assert.equal(input.activeDevice, null);

  input.setTouchAction("claim", true, 20);
  input.onBlur();
  assert.equal(input.down.size, 0);
  assert.equal(input.touchDown.size, 0);
  assert.equal(input.activeDevice, null);
  assert.deepEqual(input.gamepadMove, { x: 0, y: 0 });
  assert.deepEqual(events.map(({ previous, current }) => ({ previous, current })), [
    { previous: "keyboardMouse", current: "gamepad" },
    { previous: "gamepad", current: null },
    { previous: null, current: "touch" },
    { previous: "touch", current: null },
  ]);
});
