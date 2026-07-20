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

test("audio buses default to 50 percent volume", () => {
  const settings = new SettingsStore(new MemoryStorage());

  assert.equal(settings.get("audio.master"), 0.5);
  assert.equal(settings.get("audio.music"), 0.5);
  assert.equal(settings.get("audio.sfx"), 0.5);
  assert.equal(settings.get("audio.ui"), 0.5);
});

test("settings persist and load through the versioned store", () => {
  const storage = new MemoryStorage();
  const first = new SettingsStore(storage);
  first.set("audio.music", 0.35);
  first.set("camera.shake", 0.2);
  first.set("gameplay.damageNumbers", false);
  const second = new SettingsStore(storage);
  assert.equal(second.get("audio.music"), 0.35);
  assert.equal(second.get("camera.shake"), 0.2);
  assert.equal(second.get("gameplay.damageNumbers"), false);
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
  assert.deepEqual(settings.get("controls.bindings.build"), ["KeyB", "Gamepad:Back"]);
  assert.equal(settings.setBinding("heavy", "KeyZ"), true);
  assert.equal(settings.setBinding("dash", "KeyZ"), false);
  assert.equal(settings.bindingConflict("dash", "KeyR"), "claim");
  settings.reset();
  assert.equal(settings.get("controls.bindings.heavy")[0], "KeyQ");
});

test("v2 settings migrate additively to v5 and rename the legacy difficulty", () => {
  const storage = new MemoryStorage({
    "hollow-crown-settings": JSON.stringify({
      version: 2,
      audio: { music: 0.41 },
      gameplay: { difficulty: "story" },
      controls: { bindings: { attack: ["Mouse4"], heavy: ["KeyF", "Touch:heavy"] } },
    }),
  });

  const settings = new SettingsStore(storage);
  assert.equal(settings.get("version"), 5);
  assert.equal(settings.get("audio.music"), 0.41);
  assert.equal(settings.get("gameplay.difficulty"), "relaxed");
  assert.equal(settings.get("gameplay.lastDifficultyId"), "relaxed");
  assert.deepEqual(settings.get("controls.bindings.attack"), ["Mouse4", "Gamepad:X"]);
  assert.deepEqual(settings.get("controls.bindings.heavy"), ["KeyF", "Gamepad:Y"]);
  assert.deepEqual(settings.get("controls.bindings.claim"), ["KeyR", "Gamepad:RB"]);
});

test("rebinding one device preserves the other device binding and rejects touch tokens", () => {
  const settings = new SettingsStore(new MemoryStorage());
  assert.equal(settings.setBinding("claim", "KeyC"), true);
  assert.deepEqual(settings.get("controls.bindings.claim"), ["KeyC", "Gamepad:RB"]);
  assert.equal(settings.setBinding("claim", "Touch:claim"), false);
  assert.deepEqual(settings.get("controls.bindings.claim"), ["KeyC", "Gamepad:RB"]);
});

test("gamepad rebinding round-trips without resurrecting the default button", () => {
  const storage = new MemoryStorage();
  const first = new SettingsStore(storage);
  assert.equal(first.setBinding("claim", "Gamepad:LB"), true);
  assert.deepEqual(first.get("controls.bindings.claim"), ["Gamepad:LB", "KeyR"]);

  const reloaded = new SettingsStore(storage);
  assert.deepEqual(reloaded.get("controls.bindings.claim"), ["Gamepad:LB", "KeyR"]);
  assert.equal(reloaded.get("controls.bindings.claim").includes("Gamepad:RB"), false);
});

test("v3 accessibility settings migrate without the retired subtitles toggle", () => {
  const storage = new MemoryStorage({
    "hollow-crown-settings": JSON.stringify({
      version: 3,
      accessibility: {
        uiScale: 1.2,
        highContrast: true,
        subtitles: false,
      },
    }),
  });

  const settings = new SettingsStore(storage);
  assert.equal(settings.get("version"), 5);
  assert.equal(settings.get("accessibility.uiScale"), 1.2);
  assert.equal(settings.get("accessibility.highContrast"), true);
  assert.equal(settings.get("accessibility.subtitles"), undefined);
  assert.equal("subtitles" in settings.getAll().accessibility, false);
});
