function bindingForMouseButton(button) {
  return `Mouse${button}`;
}

export class InputController {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.down = new Set();
    this.pressed = new Set();
    this.pressedAt = new Map();
    this.pointerNdc = { x: 0, y: 0 };
    this.touchMove = { x: 0, y: 0 };
    this.automationMove = { x: 0, y: 0 };
    this.automationPressed = new Set();
    this.automationHeld = new Set();
    this.capture = null;
    this.enabled = true;

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onBlur = this.onBlur.bind(this);

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("blur", this.onBlur);
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

    if (!this.enabled || event.repeat) return;
    this.down.add(event.code);
    this.pressed.add(event.code);
    this.pressedAt.set(event.code, event.timeStamp);

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
      event.preventDefault();
    }
  }

  onKeyUp(event) {
    this.down.delete(event.code);
  }

  onPointerDown(event) {
    const binding = bindingForMouseButton(event.button);
    if (this.capture) {
      event.preventDefault();
      const resolve = this.capture;
      this.capture = null;
      resolve(binding);
      return;
    }

    if (!this.enabled) return;
    this.canvas.focus({ preventScroll: true });
    this.down.add(binding);
    this.pressed.add(binding);
    this.pressedAt.set(binding, event.timeStamp);
  }

  onPointerUp(event) {
    this.down.delete(bindingForMouseButton(event.button));
  }

  onPointerMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  onBlur() {
    this.down.clear();
    this.pressed.clear();
    this.pressedAt.clear();
  }

  actionBindings(action) {
    return this.settings.get(`controls.bindings.${action}`) ?? [];
  }

  isDown(action) {
    return this.automationHeld.has(action) || this.actionBindings(action).some((binding) => this.down.has(binding));
  }

  isPressed(action) {
    return this.automationPressed.has(action) || this.actionBindings(action).some((binding) => this.pressed.has(binding));
  }

  consume(action) {
    return this.consumePressed(action) !== null;
  }

  consumePressed(action) {
    if (this.automationPressed.delete(action)) {
      return { action, binding: `Automation:${action}`, timeStamp: performance.now() };
    }
    for (const binding of this.actionBindings(action)) {
      if (!this.pressed.delete(binding)) continue;
      const timeStamp = this.pressedAt.get(binding) ?? performance.now();
      this.pressedAt.delete(binding);
      return { action, binding, timeStamp };
    }
    return null;
  }

  flushActions(actions) {
    for (const action of actions) {
      this.automationPressed.delete(action);
      for (const binding of this.actionBindings(action)) {
        this.pressed.delete(binding);
        this.pressedAt.delete(binding);
      }
    }
  }

  endFrame(fixedSteps = 1) {
    if (fixedSteps <= 0) return;
    this.pressed.clear();
    this.pressedAt?.clear();
  }

  movement() {
    let x = this.touchMove.x + this.automationMove.x;
    let y = this.touchMove.y + this.automationMove.y;
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

  cancelCapture() {
    if (!this.capture) return;
    const resolve = this.capture;
    this.capture = null;
    resolve(null);
  }

  setTouchAction(action, active, timeStamp = performance.now()) {
    const binding = `Touch:${action}`;
    const bindings = this.settings.values.controls.bindings[action];
    if (!bindings.includes(binding)) bindings.push(binding);
    if (active) {
      this.down.add(binding);
      this.pressed.add(binding);
      this.pressedAt.set(binding, timeStamp);
    } else {
      this.down.delete(binding);
    }
  }

  setTouchMove(x, y) {
    const length = Math.hypot(x, y);
    this.touchMove = length > 1 ? { x: x / length, y: y / length } : { x, y };
  }

  setAutomationIntent({ movement = { x: 0, y: 0 }, pressed = [], held = [] } = {}) {
    const length = Math.hypot(movement.x, movement.y);
    this.automationMove = length > 1 ? { x: movement.x / length, y: movement.y / length } : { ...movement };
    this.automationPressed = new Set(pressed);
    this.automationHeld = new Set(held);
  }

  clearAutomation() {
    this.automationMove = { x: 0, y: 0 };
    this.automationPressed.clear();
    this.automationHeld.clear();
  }
}
