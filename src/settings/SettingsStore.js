const SETTINGS_KEY = "hollow-crown-settings";
const SETTINGS_VERSION = 2;

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
    master: 0.8,
    music: 0.68,
    musicIntensity: 0.82,
    dynamicMusic: true,
    sfx: 0.85,
    ui: 0.7,
    voice: 0.8,
    muteUnfocused: true,
  }),
  gameplay: Object.freeze({
    difficulty: "standard",
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
    subtitles: true,
    reducedParticles: false,
  }),
  controls: Object.freeze({
    touchControls: "auto",
    bindings: Object.freeze({
      moveUp: Object.freeze(["KeyW", "ArrowUp"]),
      moveDown: Object.freeze(["KeyS", "ArrowDown"]),
      moveLeft: Object.freeze(["KeyA", "ArrowLeft"]),
      moveRight: Object.freeze(["KeyD", "ArrowRight"]),
      attack: Object.freeze(["Mouse0"]),
      heavy: Object.freeze(["KeyQ", "Mouse1"]),
      dash: Object.freeze(["ShiftLeft", "Space", "Mouse2"]),
      interact: Object.freeze(["KeyE"]),
      pause: Object.freeze(["Escape"]),
    }),
  }),
});

const ENUMS = Object.freeze({
  "graphics.shadows": ["off", "low", "medium", "high"],
  "graphics.fpsLimit": ["60", "90", "120", "unlimited"],
  "gameplay.difficulty": ["story", "standard", "ruthless"],
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
  "audio.voice": [0, 1],
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
  "accessibility.subtitles",
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

  for (const path of [...Object.keys(RANGES), ...Object.keys(ENUMS), ...BOOLEAN_PATHS]) {
    const value = readPath(candidate, path);
    if (value !== undefined) {
      writePath(result, path, normalizeValue(path, value));
    }
  }

  const candidateBindings = candidate.controls?.bindings;
  if (candidateBindings && typeof candidateBindings === "object") {
    for (const action of Object.keys(result.controls.bindings)) {
      const bindings = candidateBindings[action];
      if (Array.isArray(bindings) && bindings.length > 0 && bindings.every((binding) => typeof binding === "string")) {
        result.controls.bindings[action] = [...new Set(bindings)].slice(0, 3);
      }
    }
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
    writePath(this.values, path, normalizeValue(path, value));
    this.persist();
    this.notify(path);
  }

  setBinding(action, binding) {
    if (!this.values.controls.bindings[action]) return false;

    for (const [otherAction, bindings] of Object.entries(this.values.controls.bindings)) {
      if (otherAction !== action && bindings.includes(binding)) return false;
    }

    this.values.controls.bindings[action] = [binding];
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
