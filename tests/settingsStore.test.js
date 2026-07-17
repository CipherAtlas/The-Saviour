import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SETTINGS, SettingsStore } from "../src/settings/SettingsStore.js";

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
  }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}

test("settings persist and load through the versioned store", () => {
  const storage = new MemoryStorage();
  const first = new SettingsStore(storage);
  first.set("audio.music", 0.35);
  first.set("camera.shake", 0.2);
  const second = new SettingsStore(storage);
  assert.equal(second.get("audio.music"), 0.35);
  assert.equal(second.get("camera.shake"), 0.2);
  assert.equal(second.get("version"), DEFAULT_SETTINGS.version);
});

test("settings normalize invalid ranges and enumerations", () => {
  const storage = new MemoryStorage({
    "hollow-crown-settings": JSON.stringify({
      graphics: { resolutionScale: 99, shadows: "impossible" },
      gameplay: { difficulty: "nightmare" },
    }),
  });
  const settings = new SettingsStore(storage);
  assert.equal(settings.get("graphics.resolutionScale"), 1.25);
  assert.equal(settings.get("graphics.shadows"), DEFAULT_SETTINGS.graphics.shadows);
  assert.equal(settings.get("gameplay.difficulty"), DEFAULT_SETTINGS.gameplay.difficulty);
});

test("control rebinding detects conflicts and supports reset", () => {
  const settings = new SettingsStore(new MemoryStorage());
  assert.equal(settings.setBinding("heavy", "KeyR"), true);
  assert.equal(settings.setBinding("dash", "KeyR"), false);
  settings.reset();
  assert.equal(settings.get("controls.bindings.heavy")[0], "KeyQ");
});

