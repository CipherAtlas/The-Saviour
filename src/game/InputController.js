function bindingForMouseButton(button) {
  return `Mouse${button}`;
}

function ownsNativeKeyboardBehavior(event) {
  if (event.code === "Tab") return true;

  const target = event.target;
  if (!target || typeof target.closest !== "function") return false;
  if (target.closest("input:not([type='button']):not([type='submit']):not([type='reset']), select, textarea, [contenteditable='true'], [contenteditable='plaintext-only']")) {
    return true;
  }

  const button = target.closest("button, input[type='button'], input[type='submit'], input[type='reset']");
  return Boolean(button && ["Enter", "NumpadEnter", "Space"].includes(event.code));
}

const GAMEPAD_BUTTON_BINDINGS = Object.freeze([
  "Gamepad:A", "Gamepad:B", "Gamepad:X", "Gamepad:Y",
  "Gamepad:LB", "Gamepad:RB", "Gamepad:LT", "Gamepad:RT",
  "Gamepad:Back", "Gamepad:Menu", "Gamepad:LS", "Gamepad:RS",
  "Gamepad:DPadUp", "Gamepad:DPadDown", "Gamepad:DPadLeft", "Gamepad:DPadRight",
  "Gamepad:Home",
]);
const GAMEPAD_DEADZONE = 0.2;
const GAMEPAD_DEVICE_HYSTERESIS = 0.08;

function radialDeadzone(x, y, deadzone = GAMEPAD_DEADZONE) {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= deadzone) return { x: 0, y: 0 };
  const scaledMagnitude = Math.min(1, (magnitude - deadzone) / (1 - deadzone));
  return { x: (x / magnitude) * scaledMagnitude, y: (y / magnitude) * scaledMagnitude };
}

export class InputController {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.down = new Set();
    this.pressed = new Set();
    this.pressedAt = new Map();
    this.released = new Set();
    this.releasedAt = new Map();
    this.pointerNdc = { x: 0, y: 0 };
    this.touchMove = { x: 0, y: 0 };
    this.touchAim = { x: 0, y: 0 };
    this.touchDown = new Set();
    this.touchPressed = new Set();
    this.touchPressedAt = new Map();
    this.touchReleased = new Set();
    this.touchReleasedAt = new Map();
    this.gamepadMove = { x: 0, y: 0 };
    this.gamepadAim = { x: 0, y: 0 };
    this.gamepadStates = new Map();
    this.activeGamepadIndex = null;
    this.lastAimDirection = { x: 1, y: 0 };
    this.activeDevice = "keyboardMouse";
    this.activeDeviceListeners = new Set();
    this.automationMove = { x: 0, y: 0 };
    this.automationPressed = new Set();
    this.automationHeld = new Set();
    this.automationReleasedAt = new Map();
    this.capture = null;
    this.enabled = true;

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onBlur = this.onBlur.bind(this);
    this.onGamepadDisconnected = this.onGamepadDisconnected.bind(this);

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("gamepaddisconnected", this.onGamepadDisconnected);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    canvas.tabIndex = 0;
  }

  destroy() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("gamepaddisconnected", this.onGamepadDisconnected);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
  }

  onKeyDown(event) {
    if (this.capture) {
      event.preventDefault();
      const resolve = this.capture;
      this.capture = null;
      resolve(event.code);
      return;
    }

    if (ownsNativeKeyboardBehavior(event)) return;
    if (!this.enabled || event.repeat) return;
    this.setActiveDevice("keyboardMouse");
    this.down.add(event.code);
    this.pressed.add(event.code);
    this.pressedAt.set(event.code, event.timeStamp);

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
      event.preventDefault();
    }
  }

  onKeyUp(event) {
    if (this.down.delete(event.code) && this.enabled) this.recordRelease(event.code, event.timeStamp);
  }

  onPointerDown(event) {
    if (event.pointerType === "touch") {
      this.setActiveDevice("touch");
      return;
    }
    const binding = bindingForMouseButton(event.button);
    if (this.capture) {
      event.preventDefault();
      const resolve = this.capture;
      this.capture = null;
      resolve(binding);
      return;
    }

    if (!this.enabled) return;
    this.setActiveDevice("keyboardMouse");
    this.canvas.focus({ preventScroll: true });
    this.down.add(binding);
    this.pressed.add(binding);
    this.pressedAt.set(binding, event.timeStamp);
  }

  onPointerUp(event) {
    const binding = bindingForMouseButton(event.button);
    if (this.down.delete(binding) && this.enabled) this.recordRelease(binding, event.timeStamp);
  }

  onPointerMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.setActiveDevice(event.pointerType === "touch" ? "touch" : "keyboardMouse");
  }

  onBlur() {
    this.down.clear();
    this.pressed.clear();
    this.pressedAt.clear();
    this.released.clear();
    this.releasedAt.clear();
    this.touchDown.clear();
    this.touchPressed.clear();
    this.touchPressedAt.clear();
    this.touchReleased.clear();
    this.touchReleasedAt.clear();
    this.touchMove = { x: 0, y: 0 };
    this.touchAim = { x: 0, y: 0 };
    this.gamepadMove = { x: 0, y: 0 };
    this.gamepadAim = { x: 0, y: 0 };
    this.gamepadStates.clear();
    this.automationPressed.clear();
    this.automationHeld.clear();
    this.automationReleasedAt.clear();
    this.setActiveDevice(null);
  }

  setActiveDevice(device, gamepadIndex = null) {
    const previous = this.activeDevice;
    const previousGamepadIndex = this.activeGamepadIndex;
    const currentGamepadIndex = device === "gamepad" ? gamepadIndex : null;
    if (previous === device && previousGamepadIndex === currentGamepadIndex) return;
    this.activeDevice = device;
    this.activeGamepadIndex = currentGamepadIndex;
    const detail = Object.freeze({
      previous,
      current: device,
      previousGamepadIndex,
      currentGamepadIndex,
      device,
      gamepadIndex: currentGamepadIndex,
    });
    const event = { type: "activeDeviceChanged", detail };
    for (const listener of this.activeDeviceListeners ?? []) listener(event);
  }

  onActiveDeviceChanged(listener) {
    this.activeDeviceListeners.add(listener);
    return () => this.activeDeviceListeners.delete(listener);
  }

  onGamepadDisconnected(event) {
    this.releaseGamepad(event.gamepad.index, event.timeStamp ?? performance.now());
  }

  releaseGamepad(index, timeStamp = performance.now()) {
    const released = this.gamepadStates.get(index);
    this.gamepadStates.delete(index);
    for (const binding of released ?? []) {
      const heldElsewhere = [...this.gamepadStates.values()].some((bindings) => bindings.has(binding));
      if (!heldElsewhere && this.down.delete(binding)) this.recordRelease(binding, timeStamp);
    }
    if (this.activeGamepadIndex === index) this.setActiveDevice(null);
    if (this.gamepadStates.size === 0) {
      this.gamepadMove = { x: 0, y: 0 };
      this.gamepadAim = { x: 0, y: 0 };
    }
  }

  pollGamepads(gamepads = globalThis.navigator?.getGamepads?.() ?? [], timeStamp = performance.now()) {
    const connected = new Set();
    let selectedAxes = null;

    for (const gamepad of gamepads ?? []) {
      if (!gamepad?.connected) continue;
      connected.add(gamepad.index);
      const previous = this.gamepadStates.get(gamepad.index) ?? new Set();
      const current = new Set();
      for (let index = 0; index < Math.min(gamepad.buttons?.length ?? 0, GAMEPAD_BUTTON_BINDINGS.length); index += 1) {
        const button = gamepad.buttons[index];
        if (button?.pressed || button?.value >= 0.5) current.add(GAMEPAD_BUTTON_BINDINGS[index]);
      }

      for (const binding of current) {
        if (previous.has(binding)) continue;
        if (this.capture) {
          const resolve = this.capture;
          this.capture = null;
          resolve(binding);
          continue;
        }
        this.down.add(binding);
        this.pressed.add(binding);
        this.pressedAt.set(binding, timeStamp);
        this.setActiveDevice("gamepad", gamepad.index);
      }
      for (const binding of previous) {
        if (current.has(binding)) continue;
        const heldElsewhere = [...this.gamepadStates.entries()].some(([otherIndex, bindings]) => otherIndex !== gamepad.index && bindings.has(binding));
        if (!heldElsewhere && this.down.delete(binding)) this.recordRelease(binding, timeStamp);
      }
      this.gamepadStates.set(gamepad.index, current);

      const axes = gamepad.axes ?? [];
      const rawMove = { x: axes[0] ?? 0, y: -(axes[1] ?? 0) };
      const rawAim = { x: axes[2] ?? 0, y: -(axes[3] ?? 0) };
      const meaningfulAnalog = Math.max(Math.hypot(rawMove.x, rawMove.y), Math.hypot(rawAim.x, rawAim.y)) >= GAMEPAD_DEADZONE + GAMEPAD_DEVICE_HYSTERESIS;
      if (meaningfulAnalog) this.setActiveDevice("gamepad", gamepad.index);
      if (gamepad.index === this.activeGamepadIndex || selectedAxes === null) selectedAxes = { index: gamepad.index, rawMove, rawAim };
    }

    for (const index of [...this.gamepadStates.keys()]) {
      if (!connected.has(index)) this.releaseGamepad(index, timeStamp);
    }

    if (selectedAxes) {
      this.gamepadMove = radialDeadzone(selectedAxes.rawMove.x, selectedAxes.rawMove.y);
      const filteredAim = radialDeadzone(selectedAxes.rawAim.x, selectedAxes.rawAim.y);
      const aimMagnitude = Math.hypot(filteredAim.x, filteredAim.y);
      this.gamepadAim = aimMagnitude > 0
        ? { x: filteredAim.x / aimMagnitude, y: filteredAim.y / aimMagnitude }
        : { x: 0, y: 0 };
      if (aimMagnitude > 0) this.lastAimDirection = { ...this.gamepadAim };
    } else {
      this.gamepadMove = { x: 0, y: 0 };
      this.gamepadAim = { x: 0, y: 0 };
    }
  }

  actionBindings(action) {
    return this.settings.get(`controls.bindings.${action}`) ?? [];
  }

  isDown(action) {
    return this.automationHeld.has(action) || this.touchDown?.has(action) || this.actionBindings(action).some((binding) => this.down.has(binding));
  }

  isPressed(action) {
    return this.automationPressed.has(action) || this.touchPressed?.has(action) || this.actionBindings(action).some((binding) => this.pressed.has(binding));
  }

  consume(action) {
    return this.consumePressed(action) !== null;
  }

  consumePressed(action) {
    if (this.automationPressed.delete(action)) {
      return { action, binding: `Automation:${action}`, timeStamp: performance.now() };
    }
    if (this.touchPressed?.delete(action)) {
      const timeStamp = this.touchPressedAt.get(action) ?? performance.now();
      this.touchPressedAt.delete(action);
      return { action, binding: `Touch:${action}`, timeStamp };
    }
    for (const binding of this.actionBindings(action)) {
      if (!this.pressed.delete(binding)) continue;
      const timeStamp = this.pressedAt.get(binding) ?? performance.now();
      this.pressedAt.delete(binding);
      return { action, binding, timeStamp };
    }
    return null;
  }

  consumeReleased(action) {
    if (this.automationReleasedAt?.has(action)) {
      const timeStamp = this.automationReleasedAt.get(action);
      this.automationReleasedAt.delete(action);
      return { action, binding: `Automation:${action}`, timeStamp };
    }
    if (this.touchReleased?.delete(action)) {
      const timeStamp = this.touchReleasedAt.get(action) ?? performance.now();
      this.touchReleasedAt.delete(action);
      return { action, binding: `Touch:${action}`, timeStamp };
    }
    for (const binding of this.actionBindings(action)) {
      if (!this.released?.delete(binding)) continue;
      const timeStamp = this.releasedAt.get(binding) ?? performance.now();
      this.releasedAt.delete(binding);
      return { action, binding, timeStamp };
    }
    return null;
  }

  flushActions(actions) {
    for (const action of actions) {
      this.automationPressed.delete(action);
      this.touchPressed?.delete(action);
      this.touchPressedAt?.delete(action);
      this.touchReleased?.delete(action);
      this.touchReleasedAt?.delete(action);
      this.automationReleasedAt?.delete(action);
      for (const binding of this.actionBindings(action)) {
        this.pressed.delete(binding);
        this.pressedAt.delete(binding);
        this.released?.delete(binding);
        this.releasedAt?.delete(binding);
      }
    }
  }

  endFrame(fixedSteps = 1) {
    if (fixedSteps <= 0) return;
    this.pressed.clear();
    this.pressedAt?.clear();
    this.released?.clear();
    this.releasedAt?.clear();
    this.touchPressed?.clear();
    this.touchPressedAt?.clear();
    this.touchReleased?.clear();
    this.touchReleasedAt?.clear();
    this.automationReleasedAt?.clear();
  }

  movement() {
    let x = this.touchMove.x + this.automationMove.x + (this.gamepadMove?.x ?? 0);
    let y = this.touchMove.y + this.automationMove.y + (this.gamepadMove?.y ?? 0);
    if (this.isDown("moveLeft") || this.isPressed("moveLeft")) x -= 1;
    if (this.isDown("moveRight") || this.isPressed("moveRight")) x += 1;
    if (this.isDown("moveUp") || this.isPressed("moveUp")) y += 1;
    if (this.isDown("moveDown") || this.isPressed("moveDown")) y -= 1;
    const length = Math.hypot(x, y);
    return length > 1 ? { x: x / length, y: y / length } : { x, y };
  }

  captureNextBinding() {
    return new Promise((resolve) => {
      this.capture = resolve;
    });
  }

  get isCapturingBinding() {
    return this.capture !== null;
  }

  cancelCapture() {
    if (!this.capture) return;
    const resolve = this.capture;
    this.capture = null;
    resolve(null);
  }

  setTouchAction(action, active, timeStamp = performance.now()) {
    this.setActiveDevice("touch");
    if (active) {
      if (!this.touchDown.has(action)) {
        this.touchPressed.add(action);
        this.touchPressedAt.set(action, timeStamp);
      }
      this.touchDown.add(action);
    } else {
      if (this.touchDown.delete(action)) {
        this.touchReleased.add(action);
        this.touchReleasedAt.set(action, timeStamp);
      }
    }
  }

  setTouchMove(x, y) {
    const length = Math.hypot(x, y);
    this.touchMove = length > 1 ? { x: x / length, y: y / length } : { x, y };
    if (length > 0) this.setActiveDevice("touch");
  }

  setTouchAim(x, y) {
    const length = Math.hypot(x, y);
    this.touchAim = length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
    if (length > 0) {
      this.lastAimDirection = { ...this.touchAim };
      this.setActiveDevice("touch");
    }
  }

  aimIntent(pointerWorldPoint = null) {
    if (this.activeDevice === "gamepad" || this.activeDevice === "touch") {
      const current = this.activeDevice === "gamepad" ? this.gamepadAim : this.touchAim;
      const direction = Math.hypot(current?.x ?? 0, current?.y ?? 0) > 0 ? current : this.lastAimDirection;
      return { kind: "direction", x: direction.x, y: direction.y, device: this.activeDevice };
    }
    if (pointerWorldPoint && Number.isFinite(pointerWorldPoint.x) && Number.isFinite(pointerWorldPoint.z)) {
      return { kind: "worldPoint", x: pointerWorldPoint.x, z: pointerWorldPoint.z, device: "keyboardMouse" };
    }
    return null;
  }

  setAutomationIntent({ movement = { x: 0, y: 0 }, pressed = [], held = [], timeStamp = performance.now() } = {}) {
    const length = Math.hypot(movement.x, movement.y);
    this.automationMove = length > 1 ? { x: movement.x / length, y: movement.y / length } : { ...movement };
    this.automationPressed = new Set(pressed);
    const nextHeld = new Set(held);
    for (const action of this.automationHeld) {
      if (!nextHeld.has(action)) this.automationReleasedAt.set(action, timeStamp);
    }
    this.automationHeld = nextHeld;
  }

  clearAutomation() {
    this.automationMove = { x: 0, y: 0 };
    this.automationPressed.clear();
    this.automationHeld.clear();
    this.automationReleasedAt.clear();
  }

  recordRelease(binding, timeStamp = performance.now()) {
    this.released ??= new Set();
    this.releasedAt ??= new Map();
    this.released.add(binding);
    this.releasedAt.set(binding, timeStamp);
  }
}
