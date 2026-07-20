const SETTINGS_KEY = "hollow-crown-settings";
const SETTINGS_VERSION = 5;

export const DEFAULT_SETTINGS = Object.freeze({
  version: SETTINGS_VERSION,
  graphics: Object.freeze({
    resolutionScale: 1,
    shadows: "off",
    effectsDensity: 1,
    antialias: true,
    fpsLimit: "unlimited",
    fullscreen: false,
  }),
  camera: Object.freeze({
    zoom: 1,
    aimLookAhead: 1,
    dynamicZoom: true,
    shake: 0.75,
    reducedMotion: false,
  }),
  audio: Object.freeze({
    master: 0.5,
    music: 0.5,
    musicIntensity: 0.82,
    dynamicMusic: true,
    sfx: 0.5,
    ui: 0.5,
    muteUnfocused: true,
  }),
  gameplay: Object.freeze({
    difficulty: "standard",
    lastDifficultyId: "standard",
    aimAssist: 0.35,
    autoTarget: 0.25,
    damageNumbers: true,
    chargeMode: "hold",
  }),
  accessibility: Object.freeze({
    uiScale: 1,
    highContrast: false,
    colorPalette: "default",
    screenFlashes: true,
    reducedParticles: false,
  }),
  controls: Object.freeze({
    touchControls: "auto",
    bindings: Object.freeze({
      moveUp: Object.freeze(["KeyW", "ArrowUp", "Gamepad:DPadUp"]),
      moveDown: Object.freeze(["KeyS", "ArrowDown", "Gamepad:DPadDown"]),
      moveLeft: Object.freeze(["KeyA", "ArrowLeft", "Gamepad:DPadLeft"]),
      moveRight: Object.freeze(["KeyD", "ArrowRight", "Gamepad:DPadRight"]),
      attack: Object.freeze(["Mouse0", "Gamepad:X"]),
      heavy: Object.freeze(["KeyQ", "Mouse1", "Gamepad:Y"]),
      dash: Object.freeze(["ShiftLeft", "Space", "Mouse2", "Gamepad:A"]),
      claim: Object.freeze(["KeyR", "Gamepad:RB"]),
      interact: Object.freeze(["KeyE", "Gamepad:B"]),
      pause: Object.freeze(["Escape", "Gamepad:Menu"]),
    }),
  }),
});

const ENUMS = Object.freeze({
  "graphics.shadows": ["off", "low", "medium", "high"],
  "graphics.fpsLimit": ["60", "90", "120", "unlimited"],
  "gameplay.difficulty": ["relaxed", "standard", "ruthless"],
  "gameplay.lastDifficultyId": ["relaxed", "standard", "ruthless"],
  "gameplay.chargeMode": ["hold", "toggle"],
  "accessibility.colorPalette": ["default", "deuteranopia", "tritanopia"],
  "controls.touchControls": ["auto", "on", "off"],
});

const RANGES = Object.freeze({
  "graphics.resolutionScale": [0.5, 1.25],
  "graphics.effectsDensity": [0.25, 1],
  "camera.zoom": [0.8, 1.25],
  "camera.aimLookAhead": [0, 1.5],
  "camera.shake": [0, 1],
  "audio.master": [0, 1],
  "audio.music": [0, 1],
  "audio.musicIntensity": [0, 1],
  "audio.sfx": [0, 1],
  "audio.ui": [0, 1],
  "gameplay.aimAssist": [0, 1],
  "gameplay.autoTarget": [0, 1],
  "accessibility.uiScale": [0.8, 1.35],
});

const BOOLEAN_PATHS = new Set([
  "graphics.antialias",
  "graphics.fullscreen",
  "camera.dynamicZoom",
  "camera.reducedMotion",
  "audio.muteUnfocused",
  "audio.dynamicMusic",
  "gameplay.damageNumbers",
  "accessibility.highContrast",
  "accessibility.screenFlashes",
  "accessibility.reducedParticles",
]);

function clone(value) {
  return structuredClone(value);
}

function readPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function writePath(object, path, value) {
  const keys = path.split(".");
  const finalKey = keys.pop();
  const target = keys.reduce((value, key) => value[key], object);
  target[finalKey] = value;
}

function normalizeValue(path, value) {
  if (RANGES[path]) {
    const [min, max] = RANGES[path];
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : readPath(DEFAULT_SETTINGS, path);
  }

  if (ENUMS[path]) {
    return ENUMS[path].includes(String(value)) ? String(value) : readPath(DEFAULT_SETTINGS, path);
  }

  if (BOOLEAN_PATHS.has(path)) {
    return Boolean(value);
  }

  return value;
}

function normalizeSettings(candidate = {}) {
  const result = clone(DEFAULT_SETTINGS);
  const needsControllerDefaults = candidate.version !== SETTINGS_VERSION;
  const source = clone(candidate);
  if (source?.gameplay?.difficulty === "story") source.gameplay.difficulty = "relaxed";
  if (source?.gameplay?.lastDifficultyId === "story") source.gameplay.lastDifficultyId = "relaxed";

  for (const path of [...Object.keys(RANGES), ...Object.keys(ENUMS), ...BOOLEAN_PATHS]) {
    const value = readPath(source, path);
    if (value !== undefined) {
      writePath(result, path, normalizeValue(path, value));
    }
  }

  const candidateBindings = source.controls?.bindings;
  if (candidateBindings && typeof candidateBindings === "object") {
    for (const action of Object.keys(result.controls.bindings)) {
      const bindings = candidateBindings[action];
      if (Array.isArray(bindings) && bindings.length > 0 && bindings.every((binding) => typeof binding === "string")) {
        const persistentBindings = bindings.filter((binding) => !binding.startsWith("Touch:"));
        if (persistentBindings.length > 0) {
          const gamepadDefaults = needsControllerDefaults
            ? DEFAULT_SETTINGS.controls.bindings[action].filter((binding) => binding.startsWith("Gamepad:"))
            : [];
          result.controls.bindings[action] = [...new Set([...persistentBindings, ...gamepadDefaults])].slice(0, 6);
        }
      }
    }
  }

  if (source.gameplay?.lastDifficultyId === undefined && source.gameplay?.difficulty !== undefined) {
    result.gameplay.lastDifficultyId = result.gameplay.difficulty;
  }

  result.version = SETTINGS_VERSION;
  return result;
}

export class SettingsStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.listeners = new Set();
    this.values = this.load();
  }

  load() {
    if (!this.storage) return clone(DEFAULT_SETTINGS);

    try {
      const saved = JSON.parse(this.storage.getItem(SETTINGS_KEY));
      return normalizeSettings(saved);
    } catch {
      return clone(DEFAULT_SETTINGS);
    }
  }

  get(path) {
    return readPath(this.values, path);
  }

  getAll() {
    return clone(this.values);
  }

  set(path, value) {
    const normalized = normalizeValue(path, value);
    writePath(this.values, path, normalized);
    if (path === "gameplay.difficulty") this.values.gameplay.lastDifficultyId = normalized;
    if (path === "gameplay.lastDifficultyId") this.values.gameplay.difficulty = normalized;
    this.persist();
    this.notify(path);
  }

  bindingConflict(action, binding) {
    for (const [otherAction, bindings] of Object.entries(this.values.controls.bindings)) {
      if (otherAction !== action && bindings.includes(binding)) return otherAction;
    }
    return null;
  }

  setBinding(action, binding) {
    if (!this.values.controls.bindings[action] || typeof binding !== "string" || binding.startsWith("Touch:")) return false;
    if (this.bindingConflict(action, binding)) return false;

    const device = binding.startsWith("Gamepad:") ? "gamepad" : "keyboardMouse";
    const retained = this.values.controls.bindings[action].filter((current) => {
      const currentDevice = current.startsWith("Gamepad:") ? "gamepad" : "keyboardMouse";
      return currentDevice !== device;
    });
    this.values.controls.bindings[action] = [binding, ...retained];
    this.persist();
    this.notify(`controls.bindings.${action}`);
    return true;
  }

  reset() {
    this.values = clone(DEFAULT_SETTINGS);
    this.persist();
    this.notify("reset");
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  persist() {
    try {
      this.storage?.setItem(SETTINGS_KEY, JSON.stringify(this.values));
    } catch {
      // Browsers may block storage in private or hardened contexts; gameplay still works.
    }
  }

  notify(path) {
    const snapshot = this.getAll();
    for (const listener of this.listeners) listener(snapshot, path);
  }
}
