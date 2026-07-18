import assert from "node:assert/strict";
import test from "node:test";
import { AdaptiveMusic } from "../src/audio/AdaptiveMusic.js";
import { AudioSystem, gainFromSlider } from "../src/audio/AudioSystem.js";
import { MUSIC_BPM, normalizeBiome } from "../src/audio/musicScore.js";
import { ProceduralInstruments } from "../src/audio/ProceduralInstruments.js";
import { DEFAULT_SETTINGS, SettingsStore } from "../src/settings/SettingsStore.js";

class FakeAudioParam {
  constructor(value = 0) {
    this.value = value;
    this.targets = [];
  }

  setValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
  setTargetAtTime(value, time, constant) {
    this.value = value;
    this.targets.push({ value, time, constant });
  }
}

class FakeAudioNode {
  constructor() {
    this.connections = [];
  }

  connect(destination) {
    this.connections.push(destination);
    return destination;
  }
}

class FakeSource extends FakeAudioNode {
  constructor() {
    super();
    this.frequency = new FakeAudioParam();
    this.detune = new FakeAudioParam();
    this.starts = [];
    this.stops = [];
    this.onended = null;
  }

  start(time) { this.starts.push(time); }
  stop(time) { this.stops.push(time); }
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 48000;
    this.state = "running";
    this.destination = new FakeAudioNode();
    this.closed = false;
  }

  createGain() {
    const node = new FakeAudioNode();
    node.gain = new FakeAudioParam(1);
    return node;
  }

  createBiquadFilter() {
    const node = new FakeAudioNode();
    node.frequency = new FakeAudioParam();
    node.Q = new FakeAudioParam();
    return node;
  }

  createDynamicsCompressor() {
    const node = new FakeAudioNode();
    node.threshold = new FakeAudioParam();
    node.knee = new FakeAudioParam();
    node.ratio = new FakeAudioParam();
    node.attack = new FakeAudioParam();
    node.release = new FakeAudioParam();
    return node;
  }

  createOscillator() { return new FakeSource(); }

  createBufferSource() {
    const source = new FakeSource();
    source.buffer = null;
    return source;
  }

  createBuffer(channels, length) {
    const channelData = Array.from({ length: channels }, () => new Float32Array(length));
    return { getChannelData: (channel) => channelData[channel] };
  }

  async resume() { this.state = "running"; }
  async close() { this.closed = true; }
}

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}

class FakeSettings {
  constructor(overrides = {}) {
    this.values = structuredClone(DEFAULT_SETTINGS);
    Object.assign(this.values.audio, overrides);
  }

  get(path) {
    return path.split(".").reduce((value, key) => value[key], this.values);
  }

  getAll() { return structuredClone(this.values); }
}

class RecordingInstruments {
  constructor() {
    this.calls = [];
    this.activeSourceCount = 0;
    this.maxSources = 72;
  }

  record(name) { this.calls.push(name); }
  playLute() { this.record("lute"); }
  playDulcimer() { this.record("dulcimer"); }
  playStrings() { this.record("strings"); }
  playFlute() { this.record("flute"); }
  playBass() { this.record("bass"); }
  playPercussion() { this.record("percussion"); }
  playHorns() { this.record("horns"); }
  playBell() { this.record("bells"); }
  playChoir() { this.record("choir"); }
}

test("score is locked to 132 BPM and recognizes all environment palettes", () => {
  assert.equal(MUSIC_BPM, 132);
  assert.equal(normalizeBiome("Forgotten Keep"), "forgottenKeep");
  assert.equal(normalizeBiome("ossuary"), "ossuary");
  assert.equal(normalizeBiome({ id: "ember-foundry" }), "emberFoundry");
  assert.equal(normalizeBiome("void_court"), "voidCourt");
});

test("mixer leaves headroom, compresses the master, and ducks only music", () => {
  const context = new FakeAudioContext();
  const settings = new FakeSettings();
  const audio = new AudioSystem(settings, { contextFactory: () => context });
  audio.initialize();

  assert.equal(audio.nodes.compressor.threshold.value, -16);
  assert.equal(audio.nodes.compressor.ratio.value, 4);
  assert.ok(audio.buses.master.gain.value < gainFromSlider(settings.get("audio.master")));
  assert.equal(gainFromSlider(0.5), 0.25);

  const sfxBefore = audio.buses.sfx.gain.value;
  audio.setDialogueDucking(true);
  assert.ok(audio.nodes.musicDuck.gain.value < 0.3);
  assert.equal(audio.buses.sfx.gain.value, sfxBefore);
  audio.setDialogueDucking(false);
  assert.equal(audio.nodes.musicDuck.gain.value, 1);
});

test("dialogue ducking is restored after pausing and resuming a modal sequence", () => {
  const context = new FakeAudioContext();
  const audio = new AudioSystem(new FakeSettings(), { contextFactory: () => context });
  audio.initialize();

  audio.handleEvent({ type: "dialogueStarted", detail: {} });
  assert.ok(audio.nodes.musicDuck.gain.value < 0.3);
  audio.handleEvent({ type: "phaseChanged", detail: { phase: "paused" } });
  assert.equal(audio.nodes.musicDuck.gain.value, 1);
  audio.handleEvent({ type: "phaseChanged", detail: { phase: "dialogue" } });
  assert.ok(audio.nodes.musicDuck.gain.value < 0.3);
});

test("music state and biome switches wait for a bar boundary", () => {
  const context = new FakeAudioContext();
  const audio = new AudioSystem(new FakeSettings(), { contextFactory: () => context });
  audio.initialize();
  audio.handleEvent({ type: "arenaChanged", detail: { floor: 7, boss: true } });

  assert.equal(audio.music.state, "exploration");
  assert.equal(audio.music.pendingState, "boss");
  assert.equal(audio.music.pendingBiome, "emberFoundry");
  audio.update();
  assert.equal(audio.music.state, "boss");
  assert.equal(audio.music.biome, "emberFoundry");
});

test("boss arrangement schedules every promised dungeon instrument", () => {
  const context = { currentTime: 0 };
  const instruments = new RecordingInstruments();
  const music = new AdaptiveMusic(context, {}, instruments);
  music.requestState("boss");

  for (let step = 0; step < 8; step += 1) {
    context.currentTime = step * 0.24;
    music.update();
  }

  assert.deepEqual(
    new Set(instruments.calls),
    new Set(["lute", "dulcimer", "strings", "flute", "bass", "percussion", "horns", "bells", "choir"]),
  );
});

test("scheduler recovers at a fresh bar after a long suspended-frame gap", () => {
  const context = { currentTime: 0 };
  const music = new AdaptiveMusic(context, {}, new RecordingInstruments());
  music.update();
  context.currentTime = 12;
  music.update();
  assert.equal(music.metrics().schedulerRecoveries, 1);
  assert.ok(music.nextStepAt > context.currentTime);
});

test("procedural voices enforce their global source cap and can be cleaned up", () => {
  const context = new FakeAudioContext();
  const instruments = new ProceduralInstruments(context, { maxSources: 2 });
  const destination = context.destination;

  assert.equal(instruments.playTone(220, 1, 0.1, destination, 0), true);
  assert.equal(instruments.playTone(330, 1, 0.1, destination, 0), true);
  assert.equal(instruments.playTone(440, 1, 0.1, destination, 0), false);
  assert.equal(instruments.activeSourceCount, 2);
  instruments.stopAll();
  assert.equal(instruments.activeSourceCount, 0);
});

test("dynamic music controls migrate, clamp, and persist", () => {
  const storage = new MemoryStorage();
  const settings = new SettingsStore(storage);
  assert.equal(settings.get("audio.dynamicMusic"), true);
  settings.set("audio.musicIntensity", 4);
  settings.set("audio.dynamicMusic", false);

  const reloaded = new SettingsStore(storage);
  assert.equal(reloaded.get("audio.musicIntensity"), 1);
  assert.equal(reloaded.get("audio.dynamicMusic"), false);
  assert.equal(reloaded.get("version"), 2);
});
