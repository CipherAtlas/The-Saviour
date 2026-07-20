import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import test from "node:test";
import { AdaptiveMusic } from "../src/audio/AdaptiveMusic.js";
import { AudioSystem, gainFromSlider } from "../src/audio/AudioSystem.js";
import {
  LicensedSoundtrack,
  SOUNDTRACK_CACHE_LIMIT,
  SOUNDTRACK_CUES,
} from "../src/audio/LicensedSoundtrack.js";
import { MUSIC_BPM, normalizeBiome } from "../src/audio/musicScore.js";
import { ProceduralInstruments } from "../src/audio/ProceduralInstruments.js";
import { DEFAULT_SETTINGS, SettingsStore } from "../src/settings/SettingsStore.js";

class FakeAudioParam {
  constructor(value = 0) {
    this.value = value;
    this.targets = [];
    this.cancelledAt = [];
    this.curves = [];
  }

  setValueAtTime(value) { this.value = value; }
  cancelScheduledValues(time) { this.cancelledAt.push(time); }
  setValueCurveAtTime(curve, startAt, duration) {
    this.curves.push({ curve: [...curve], startAt, duration });
    this.value = curve.at(-1);
  }
  linearRampToValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
  setTargetAtTime(value, time, constant) {
    this.value = value;
    this.targets.push({ value, time, constant });
  }
}

class FakeAudioNode {
  constructor() {
    this.connections = [];
    this.disconnected = false;
  }

  connect(destination) {
    this.connections.push(destination);
    return destination;
  }

  disconnect() { this.disconnected = true; }
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

  start(time, offset = 0) { this.starts.push({ time, offset }); }
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

function finishSoundtrackTransition(context, soundtrack, seconds = 3) {
  context.currentTime += seconds;
  soundtrack.update();
}

function recordEventCues(audio) {
  const calls = [];
  const busName = (destination) => {
    const directBus = Object.entries(audio.buses).find(([, bus]) => bus === destination)?.[0];
    if (directBus) return directBus;
    const actionCue = [...audio.queenActionCues.values()].find(({ gain }) => gain === destination);
    return actionCue ? "sfx" : "unknown";
  };
  audio.playTone = (frequency, duration, volume, destination, startAt = 0, type = "sine", glide = null) => {
    calls.push({ kind: "tone", frequency, duration, volume, bus: busName(destination), startAt, type, glide });
    return true;
  };
  audio.playNoise = (duration, volume, destination, startAt = 0, frequency = 820) => {
    calls.push({ kind: "noise", frequency, duration, volume, bus: busName(destination), startAt });
    return true;
  };
  return calls;
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

test("mixer leaves headroom and compresses the master", () => {
  const context = new FakeAudioContext();
  const settings = new FakeSettings();
  const audio = new AudioSystem(settings, { contextFactory: () => context });
  audio.initialize();

  assert.equal(audio.nodes.compressor.threshold.value, -16);
  assert.equal(audio.nodes.compressor.ratio.value, 4);
  assert.ok(audio.buses.master.gain.value < gainFromSlider(settings.get("audio.master")));
  assert.equal(gainFromSlider(0.5), 0.25);

  assert.equal(audio.nodes.musicDuck.gain.value, 1);
});

test("bookend events do not alter the music mix", () => {
  const context = new FakeAudioContext();
  const audio = new AudioSystem(new FakeSettings(), { contextFactory: () => context });
  audio.initialize();

  audio.handleEvent({ type: "bookendStarted", detail: {} });
  audio.handleEvent({ type: "phaseChanged", detail: { phase: "bookend" } });
  assert.equal(audio.nodes.musicDuck.gain.value, 1);
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

test("Harvest and Claim events produce distinct bounded SFX and UI cue patterns", () => {
  const context = new FakeAudioContext();
  const audio = new AudioSystem(new FakeSettings(), { contextFactory: () => context });
  audio.initialize();
  const calls = recordEventCues(audio);
  const capture = (type, detail = {}) => {
    calls.length = 0;
    audio.handleEvent({ type, detail });
    return structuredClone(calls);
  };

  const gain = capture("harvestChanged", { delta: 14 });
  const spend = capture("harvestChanged", { delta: -100 });
  assert.notDeepEqual(gain, spend);
  assert.equal(gain.length, 2);
  assert.equal(spend.length, 2);
  assert.ok([...gain, ...spend].every((call) => call.bus === "ui"));

  const throwCue = capture("claimStarted");
  const recallCue = capture("claimRecallStarted");
  const catchCue = capture("claimCaught");
  const readyCue = capture("claimFollowupReady");
  assert.deepEqual(throwCue.map((call) => call.kind), ["noise", "tone"]);
  assert.deepEqual(recallCue.map((call) => call.kind), ["noise", "tone"]);
  assert.ok(recallCue[1].glide > recallCue[1].frequency);
  assert.notDeepEqual(catchCue, throwCue);
  assert.ok([...throwCue, ...recallCue, ...catchCue].every((call) => call.bus === "sfx"));
  assert.equal(readyCue.length, 2);
  assert.ok(readyCue.every((call) => call.kind === "tone" && call.bus === "ui"));
  assert.ok([gain, spend, throwCue, recallCue, catchCue, readyCue].every((cue) => cue.length <= 2));
});

test("Claim hit accents differ by resolved pass without duplicating the generic impact burst", () => {
  const context = new FakeAudioContext();
  const audio = new AudioSystem(new FakeSettings(), { contextFactory: () => context });
  audio.initialize();
  const calls = recordEventCues(audio);
  const capture = (type, detail = {}) => {
    calls.length = 0;
    audio.handleEvent({ type, detail });
    return structuredClone(calls);
  };

  const baseImpact = capture("enemyHit", { critical: false });
  const outbound = capture("claimHit", { pass: "outbound", hit: { damage: 46 } });
  const recall = capture("claimHit", { pass: "recall", hit: { damage: 38 } });
  assert.equal(baseImpact.length, 1);
  assert.equal(outbound.length, 1);
  assert.equal(recall.length, 1);
  assert.notDeepEqual(outbound, recall);
  assert.ok([...outbound, ...recall].every((call) => call.kind === "tone" && call.bus === "sfx"));
  assert.deepEqual(capture("claimHit", {}), []);
  assert.deepEqual(capture("claimCompleted", { result: "expired" }), []);
});

test("stagger and charged-release cues remain bounded with a distinct perfect layer", () => {
  const context = new FakeAudioContext();
  const audio = new AudioSystem(new FakeSettings(), { contextFactory: () => context });
  audio.initialize();
  const calls = recordEventCues(audio);
  const capture = (type, detail = {}) => {
    calls.length = 0;
    audio.handleEvent({ type, detail });
    return structuredClone(calls);
  };

  const stagger = capture("enemyStaggered", {});
  const partial = capture("chargeReleased", { quality: "partial" });
  const full = capture("chargeReleased", { quality: "full" });
  const perfect = capture("chargeReleased", { quality: "perfect" });
  assert.deepEqual(stagger.map((call) => call.kind), ["noise", "tone"]);
  assert.equal(partial.length, 1);
  assert.equal(full.length, 1);
  assert.equal(perfect.length, 2);
  assert.ok(perfect[1].startAt > perfect[0].startAt);
  assert.ok([...stagger, ...partial, ...full, ...perfect].every((call) => call.bus === "sfx"));
  assert.deepEqual(capture("chargeReleased", {}), []);
});

test("Witch teleport and summon cues keep distinct layered action-ID lifecycles", () => {
  const context = new FakeAudioContext();
  const audio = new AudioSystem(new FakeSettings(), { contextFactory: () => context });
  audio.initialize();
  const calls = recordEventCues(audio);
  const capture = (type, detail = {}) => {
    calls.length = 0;
    audio.handleEvent({ type, detail });
    return structuredClone(calls);
  };
  const lifecycle = (action, actionId, combo = {}) => {
    const detail = { action, actionId, phase: action === "teleport" ? 3 : 2, ...combo };
    const anticipation = capture("queenSpecialAnticipated", detail);
    const cue = audio.queenActionCues.get(actionId);
    assert.equal(cue.actionId, actionId);
    assert.equal(cue.kind, action);
    assert.ok(cue.gain.connections.includes(audio.buses.sfx));
    const release = capture("queenSpecialReleased", { ...detail, stage: "release" });
    assert.equal(cue.stage, "release");
    const recovery = capture("queenSpecialRecovered", { ...detail, stage: "recovery" });
    assert.equal(audio.queenActionCues.has(actionId), false);
    return { anticipation, release, recovery };
  };

  const teleport = lifecycle("teleport", "witch-teleport-1", {
    comboId: "queen-combo-1",
    comboStep: 1,
    comboLength: 2,
    continuesCombo: true,
  });
  const summon = lifecycle("summon", "witch-summon-1");

  for (const stage of ["anticipation", "release", "recovery"]) {
    assert.equal(teleport[stage].length, 2);
    assert.equal(summon[stage].length, 2);
    assert.ok([...teleport[stage], ...summon[stage]].every((call) => call.bus === "sfx"));
    assert.notDeepEqual(teleport[stage], summon[stage]);
  }
  assert.ok(teleport.anticipation[1].glide > teleport.anticipation[1].frequency);
  assert.ok(summon.anticipation[0].frequency < teleport.anticipation[0].frequency);
});

test("cancelled Witch cues silence their action envelope and suppress stale release audio", () => {
  const context = new FakeAudioContext();
  context.currentTime = 4.25;
  const audio = new AudioSystem(new FakeSettings(), { contextFactory: () => context });
  audio.initialize();
  const calls = recordEventCues(audio);
  const detail = { action: "summon", actionId: "witch-cancelled-1", phase: 2 };

  audio.handleEvent({ type: "queenSpecialAnticipated", detail });
  const cue = audio.queenActionCues.get(detail.actionId);
  calls.length = 0;
  audio.handleEvent({ type: "queenSpecialCancelled", detail: { ...detail, reason: "phaseTransition" } });
  assert.deepEqual(calls, []);
  assert.equal(audio.queenActionCues.has(detail.actionId), false);
  assert.deepEqual(cue.gain.gain.cancelledAt, [context.currentTime]);
  assert.deepEqual(cue.gain.gain.targets.at(-1), { value: 0, time: context.currentTime, constant: 0.012 });

  audio.handleEvent({ type: "queenSpecialReleased", detail: { ...detail, stage: "release" } });
  audio.handleEvent({ type: "queenSpecialRecovered", detail: { ...detail, stage: "recovery" } });
  assert.deepEqual(calls, []);
});

test("boss phases, guard dismissal, and phase-three combo steps have readable SFX signatures", () => {
  const context = new FakeAudioContext();
  const audio = new AudioSystem(new FakeSettings(), { contextFactory: () => context });
  audio.initialize();
  const calls = recordEventCues(audio);
  const capture = (type, detail = {}) => {
    calls.length = 0;
    audio.handleEvent({ type, detail });
    return structuredClone(calls);
  };
  const requested = [];
  audio.soundtrack = { request: (cueKey) => { requested.push(cueKey); return Promise.resolve(true); } };

  const phaseTwo = capture("bossPhaseChanged", { phase: 2 });
  const phaseThree = capture("bossPhaseChanged", { phase: 3 });
  assert.deepEqual(requested, ["bossPhase2", "bossPhase3"]);
  assert.deepEqual(phaseTwo.map(({ kind }) => kind), ["noise", "tone"]);
  assert.deepEqual(phaseThree.map(({ kind }) => kind), ["noise", "tone"]);
  assert.notDeepEqual(phaseTwo, phaseThree);
  assert.ok([...phaseTwo, ...phaseThree].every((call) => call.bus === "sfx" && call.volume <= 0.105));
  assert.ok(audio.nodes.musicDuck.gain.targets.some(({ value }) => value < 0.61));
  assert.equal(audio.nodes.musicDuck.gain.targets.at(-1).value, 1);

  const dismissal = capture("queenGuardsDismissed", {
    phase: 3,
    actors: Array.from({ length: 5 }, (_, index) => ({ id: `guard-${index + 1}` })),
  });
  assert.deepEqual(dismissal.map(({ kind }) => kind), ["noise", "tone"]);
  assert.ok(dismissal.every((call) => call.bus === "sfx" && call.volume <= 0.07));

  const continuation = capture("enemyAttack", {
    type: "queen",
    attack: "royalDash",
    bossPhase: 3,
    comboId: "queen-combo-2",
    comboStep: 1,
    comboLength: 2,
    continuesCombo: true,
  });
  const finisher = capture("enemyAttack", {
    type: "queen",
    attack: "royalFan",
    bossPhase: 3,
    comboId: "queen-combo-2",
    comboStep: 2,
    comboLength: 2,
    continuesCombo: false,
  });
  assert.equal(continuation.length, 1);
  assert.equal(finisher.length, 1);
  assert.ok(continuation[0].glide > continuation[0].frequency);
  assert.ok(finisher[0].glide < finisher[0].frequency);
  assert.ok(finisher[0].volume > continuation[0].volume);
});

test("regular enemy combo openers and finishers have distinct restrained accents", () => {
  const context = new FakeAudioContext();
  const audio = new AudioSystem(new FakeSettings(), { contextFactory: () => context });
  audio.initialize();
  const calls = recordEventCues(audio);
  const capture = (detail) => {
    calls.length = 0;
    audio.handleEvent({ type: "enemyAttack", detail });
    return structuredClone(calls);
  };
  const common = { type: "reaver", comboId: "enemy-2-combo-1", comboLength: 2 };

  const opener = capture({ ...common, attack: "dashLane", comboStep: 1, continuesCombo: true });
  const finisher = capture({ ...common, attack: "crosscut", comboStep: 2, continuesCombo: false });

  assert.deepEqual(opener.map(({ kind }) => kind), ["tone"]);
  assert.deepEqual(finisher.map(({ kind }) => kind), ["noise", "tone"]);
  assert.ok([...opener, ...finisher].every((call) => call.bus === "sfx" && call.volume <= 0.038));
  assert.ok(finisher.at(-1).glide < finisher.at(-1).frequency);
});

test("phase-three special combo metadata changes release pitch without adding layers", () => {
  const context = new FakeAudioContext();
  const audio = new AudioSystem(new FakeSettings(), { contextFactory: () => context });
  audio.initialize();
  const calls = recordEventCues(audio);
  const releaseFor = (actionId, comboStep, continuesCombo) => {
    const detail = {
      action: "teleport",
      actionId,
      phase: 3,
      comboId: "queen-combo-audio",
      comboStep,
      comboLength: 2,
      continuesCombo,
    };
    audio.handleEvent({ type: "queenSpecialAnticipated", detail });
    calls.length = 0;
    audio.handleEvent({ type: "queenSpecialReleased", detail: { ...detail, stage: "release" } });
    const release = structuredClone(calls);
    audio.handleEvent({ type: "queenSpecialRecovered", detail: { ...detail, stage: "recovery" } });
    return release;
  };

  const continuation = releaseFor("witch-combo-step-1", 1, true);
  const finisher = releaseFor("witch-combo-step-2", 2, false);
  assert.equal(continuation.length, 2);
  assert.equal(finisher.length, 2);
  assert.notEqual(continuation[1].frequency, finisher[1].frequency);
  assert.ok(finisher[1].volume > continuation[1].volume);
  assert.ok([...continuation, ...finisher].every((call) => call.bus === "sfx"));
});

test("combat audio hooks are no-ops before initialization and while suspended", () => {
  const context = new FakeAudioContext();
  const audio = new AudioSystem(new FakeSettings(), { contextFactory: () => context });
  let calls = 0;
  audio.playTone = () => { calls += 1; };
  audio.playNoise = () => { calls += 1; };
  const events = [
    { type: "harvestChanged", detail: { delta: 10 } },
    { type: "claimStarted" },
    { type: "claimHit", detail: { pass: "recall" } },
    { type: "enemyStaggered" },
    { type: "chargeReleased", detail: { quality: "perfect" } },
    { type: "bossPhaseChanged", detail: { phase: 3 } },
    { type: "queenSpecialAnticipated", detail: { action: "teleport", actionId: "witch-suspended" } },
    { type: "queenGuardsDismissed", detail: { actors: [{ id: "guard" }] } },
  ];
  for (const event of events) assert.doesNotThrow(() => audio.handleEvent(event));
  assert.equal(calls, 0);

  audio.initialize();
  context.state = "suspended";
  for (const event of events) assert.doesNotThrow(() => audio.handleEvent(event));
  assert.equal(calls, 0);
});

test("mute-unfocused still silences the master while Witch cues remain on the SFX bus", () => {
  const context = new FakeAudioContext();
  const audio = new AudioSystem(new FakeSettings({ muteUnfocused: true }), { contextFactory: () => context });
  audio.initialize();
  const calls = recordEventCues(audio);

  audio.setFocused(false);
  assert.equal(audio.buses.master.gain.value, 0);
  audio.handleEvent({
    type: "queenSpecialAnticipated",
    detail: { action: "teleport", actionId: "witch-unfocused", phase: 2 },
  });
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.bus === "sfx"));
  assert.ok(calls.every((call) => call.bus !== "voice"));

  audio.setFocused(true);
  assert.ok(audio.buses.master.gain.value > 0);
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
  assert.equal(reloaded.get("version"), DEFAULT_SETTINGS.version);
});

test("licensed soundtrack covers every required state with authoritative attribution and packaged audio", async () => {
  assert.deepEqual(Object.keys(SOUNDTRACK_CUES), [
    "title",
    "exploration",
    "combat",
    "bossPhase1",
    "bossPhase2",
    "bossPhase3",
    "endingKill",
    "endingTimeout",
  ]);
  assert.equal(new Set(Object.values(SOUNDTRACK_CUES).map((cue) => cue.file)).size, 8);
  for (const cue of Object.values(SOUNDTRACK_CUES)) {
    assert.equal(cue.creator, "Kevin MacLeod");
    assert.equal(cue.license, "CC BY 4.0");
    assert.equal(cue.licenseUrl, "https://creativecommons.org/licenses/by/4.0/");
    assert.match(cue.source, /^https:\/\/incompetech\.com\//);
    assert.equal(Object.isFrozen(cue), true);
    const file = new URL(`../public${cue.file}`, import.meta.url);
    assert.ok((await stat(file)).size > 100_000, `${cue.file} must contain packaged audio`);
  }
  assert.equal(SOUNDTRACK_CUES.endingKill.loop, false);
  assert.equal(SOUNDTRACK_CUES.endingTimeout.loop, false);
  assert.ok(Object.values(SOUNDTRACK_CUES).filter((cue) => cue.loop).length >= 6);
});

test("licensed soundtrack ignores stale decodes and serializes rapid equal-power crossfades", async () => {
  const context = new FakeAudioContext();
  const pending = new Map();
  context.decodeAudioData = async (encoded) => ({ id: encoded.byteLength, duration: 120 });
  const fetcher = (path) => new Promise((resolve) => pending.set(path, resolve));
  const started = [];
  const soundtrack = new LicensedSoundtrack(context, context.destination, {
    fetcher,
    onPlaybackStart: (cueKey) => started.push(cueKey),
  });

  const exploration = soundtrack.request("exploration");
  const combat = soundtrack.request("combat");
  pending.get(SOUNDTRACK_CUES.exploration.file)({ ok: true, arrayBuffer: async () => new ArrayBuffer(12) });
  assert.equal(await exploration, false);
  pending.get(SOUNDTRACK_CUES.combat.file)({ ok: true, arrayBuffer: async () => new ArrayBuffer(24) });
  assert.equal(await combat, true);
  assert.deepEqual(started, ["combat"]);
  assert.equal(soundtrack.metrics().activeCue, "combat");
  assert.equal(soundtrack.metrics().activeSources, 1);
  assert.equal(soundtrack.metrics().cacheLimit, SOUNDTRACK_CACHE_LIMIT);
  assert.equal(soundtrack.metrics().loadedCues, 2);
  const fadeIn = soundtrack.active.gain.gain.curves.at(-1).curve;
  assert.equal(fadeIn[0], 0);
  assert.ok(Math.abs(fadeIn.at(-1) - 1) < 0.000_001);
  assert.ok(fadeIn[Math.floor(fadeIn.length / 2)] > 0.7);

  context.currentTime = 2;
  const boss = soundtrack.request("bossPhase1");
  pending.get(SOUNDTRACK_CUES.bossPhase1.file)({ ok: true, arrayBuffer: async () => new ArrayBuffer(36) });
  assert.equal(await boss, true);
  assert.deepEqual(started, ["combat", "bossPhase1"]);
  assert.equal(soundtrack.metrics().activeSources, 2);
  assert.ok(soundtrack.metrics().activeSources <= 2);
  const fadeOut = [...soundtrack.retiring][0].gain.gain.curves.at(-1).curve;
  const midpoint = Math.floor(fadeOut.length / 2);
  assert.ok(Math.abs(fadeIn[midpoint] ** 2 + fadeOut[midpoint] ** 2 - 1) < 0.03);

  const phaseTwo = soundtrack.request("bossPhase2");
  pending.get(SOUNDTRACK_CUES.bossPhase2.file)({ ok: true, arrayBuffer: async () => new ArrayBuffer(48) });
  assert.equal(await phaseTwo, true);
  assert.equal(soundtrack.metrics().pendingCue, "bossPhase2");
  assert.deepEqual(started, ["combat", "bossPhase1"]);

  finishSoundtrackTransition(context, soundtrack);
  assert.deepEqual(started, ["combat", "bossPhase1", "bossPhase2"]);
  assert.equal(soundtrack.metrics().activeSources, 2);
  assert.equal(soundtrack.metrics().pendingCue, null);
  assert.equal(soundtrack.metrics().loadedCues, SOUNDTRACK_CACHE_LIMIT);
  assert.equal(soundtrack.metrics().peakCachedCues, SOUNDTRACK_CACHE_LIMIT);
  assert.equal(soundtrack.metrics().cacheEvictions, 2);
});

test("licensed soundtrack evicts decoded cues by LRU order without interrupting crossfades", async () => {
  const context = new FakeAudioContext();
  const fetchCounts = new Map();
  context.decodeAudioData = async (encoded) => ({ id: encoded.byteLength, duration: 120 });
  const fetcher = async (path) => {
    fetchCounts.set(path, (fetchCounts.get(path) ?? 0) + 1);
    const cueIndex = Object.values(SOUNDTRACK_CUES).findIndex((cue) => cue.file === path);
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(cueIndex + 1) };
  };
  const soundtrack = new LicensedSoundtrack(context, context.destination, { fetcher });

  await soundtrack.request("title");
  await soundtrack.request("exploration");
  finishSoundtrackTransition(context, soundtrack);
  await soundtrack.request("combat");
  assert.deepEqual(soundtrack.metrics().cachedCues, ["exploration", "combat"]);
  assert.equal(soundtrack.metrics().cacheEvictions, 1);
  assert.equal(soundtrack.metrics().activeSources, 2);
  assert.ok([...soundtrack.retiring, soundtrack.active].every((record) => record.source.buffer));
  finishSoundtrackTransition(context, soundtrack);
  assert.equal(soundtrack.metrics().activeSources, 1);

  await soundtrack.request("title");
  assert.equal(soundtrack.metrics().activeSources, 2);
  assert.equal(fetchCounts.get(SOUNDTRACK_CUES.title.file), 2);
  assert.deepEqual(soundtrack.metrics().cachedCues, ["combat", "title"]);
  assert.equal(soundtrack.metrics().cacheEvictions, 2);
  finishSoundtrackTransition(context, soundtrack);
  assert.equal(soundtrack.metrics().activeSources, 1);

  await soundtrack.request("combat");
  assert.equal(fetchCounts.get(SOUNDTRACK_CUES.combat.file), 1);
  assert.equal(soundtrack.metrics().cacheHits, 1);
  assert.equal(soundtrack.metrics().cacheMisses, 4);
  assert.equal(soundtrack.metrics().peakCachedCues, SOUNDTRACK_CACHE_LIMIT);
  assert.equal(Object.isFrozen(soundtrack.metrics().cachedCues), true);

  soundtrack.dispose();
  assert.deepEqual(soundtrack.metrics().cachedCues, []);
  assert.equal(soundtrack.metrics().loadedCues, 0);
  assert.equal(soundtrack.metrics().pendingLoads, 0);
  assert.equal(soundtrack.metrics().activeSources, 0);
  assert.equal(await soundtrack.request("exploration"), false);
});

test("licensed loops crossfade before packaged tail silence on the audio clock", async () => {
  const context = new FakeAudioContext();
  context.decodeAudioData = async () => ({ duration: 10 });
  const soundtrack = new LicensedSoundtrack(context, context.destination, {
    crossfadeDuration: 0.5,
    fetcher: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }),
  });

  await soundtrack.request("exploration");
  const firstPass = soundtrack.active;
  assert.deepEqual(firstPass.source.starts, [{ time: 0, offset: 0 }]);
  assert.equal(firstPass.contentEndAt, 7.1);

  context.currentTime = 6.45;
  soundtrack.update();
  assert.equal(soundtrack.active, firstPass);

  context.currentTime = 6.5;
  soundtrack.update();
  assert.notEqual(soundtrack.active, firstPass);
  assert.deepEqual(soundtrack.active.source.starts, [{ time: 6.6, offset: 0 }]);
  assert.deepEqual(firstPass.source.stops, [7.14]);
  assert.equal(soundtrack.metrics().activeSources, 2);

  finishSoundtrackTransition(context, soundtrack, 1);
  assert.equal(soundtrack.metrics().activeSources, 1);
});

test("a cue change during initial fade-in holds the current gain without a jump", async () => {
  const context = new FakeAudioContext();
  context.decodeAudioData = async () => ({ duration: 120 });
  const soundtrack = new LicensedSoundtrack(context, context.destination, {
    crossfadeDuration: 2,
    fetcher: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }),
  });

  await soundtrack.request("title");
  const title = soundtrack.active;
  context.currentTime = 0.5;
  const heldGain = soundtrack.gainAt(title, context.currentTime);
  await soundtrack.request("exploration");

  const fadeOut = title.gain.gain.curves.at(-1).curve;
  assert.ok(heldGain > 0 && heldGain < 1);
  assert.ok(Math.abs(fadeOut[0] - heldGain) < 0.000_001);
});

test("licensed playback takes over the procedural fallback with the same fade envelope", () => {
  const context = new FakeAudioContext();
  const audio = new AudioSystem(new FakeSettings(), { contextFactory: () => context });
  audio.initialize();

  audio.activateLicensedMusic({ startAt: 0.25, duration: 1.75 });

  const fade = audio.nodes.proceduralMusic.gain.curves.at(-1);
  assert.equal(fade.startAt, 0.25);
  assert.equal(fade.duration, 1.75);
  assert.equal(fade.curve[0], 1);
  assert.ok(Math.abs(fade.curve.at(-1)) < 0.000_001);
  assert.equal(audio.nodes.licensedMusic.gain.value, 1);
});

test("disposing during decode prevents a late result from repopulating the cache", async () => {
  const context = new FakeAudioContext();
  const pending = new Map();
  context.decodeAudioData = async (encoded) => ({ id: encoded.byteLength, duration: 120 });
  const soundtrack = new LicensedSoundtrack(context, context.destination, {
    fetcher: (path) => new Promise((resolve) => pending.set(path, resolve)),
  });

  const request = soundtrack.request("title");
  soundtrack.dispose();
  pending.get(SOUNDTRACK_CUES.title.file)({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
  assert.equal(await request, false);
  assert.equal(soundtrack.metrics().loadedCues, 0);
  assert.equal(soundtrack.metrics().pendingLoads, 0);
  assert.equal(soundtrack.metrics().activeSources, 0);
});

test("licensed decode failure is contained so procedural fallback remains available", async () => {
  const context = new FakeAudioContext();
  context.decodeAudioData = async () => { throw new Error("unsupported"); };
  const soundtrack = new LicensedSoundtrack(context, context.destination, {
    fetcher: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }),
  });
  assert.equal(await soundtrack.request("title"), false);
  assert.equal(soundtrack.metrics().activeCue, null);
  assert.equal(soundtrack.metrics().decodeFailures, 1);
});

test("game events map deterministically to boss phases and both ending cues", () => {
  const context = new FakeAudioContext();
  const audio = new AudioSystem(new FakeSettings(), { contextFactory: () => context });
  audio.initialize();
  const requested = [];
  audio.soundtrack = { request: (cueKey) => { requested.push(cueKey); return Promise.resolve(true); } };

  audio.handleEvent({ type: "arenaChanged", detail: { floor: 10, boss: true } });
  audio.handleEvent({ type: "bossPhaseChanged", detail: { phase: 2 } });
  audio.handleEvent({ type: "bossPhaseChanged", detail: { phase: 3 } });
  audio.handleEvent({ type: "endingChoiceResolved", detail: { ending: "kill" } });
  audio.handleEvent({ type: "endingChoiceResolved", detail: { ending: "timeout" } });
  audio.handleEvent({ type: "phaseChanged", detail: { phase: "title" } });

  assert.deepEqual(requested, [
    "bossPhase1",
    "bossPhase2",
    "bossPhase3",
    "endingKill",
    "endingTimeout",
    "title",
  ]);
});

test("player action, recovery, and ending cues are distinct, bounded, and non-vocal", () => {
  const context = new FakeAudioContext();
  const audio = new AudioSystem(new FakeSettings(), { contextFactory: () => context });
  audio.initialize();
  const calls = recordEventCues(audio);
  const capture = (type, detail = {}) => {
    calls.length = 0;
    audio.handleEvent({ type, detail });
    return structuredClone(calls);
  };

  const chargeStart = capture("chargeStart");
  const perfectDash = capture("perfectDash");
  const heal = capture("playerHealed", { amount: 8, reason: "kill" });
  const revive = capture("playerHealed", { amount: 49, reason: "deathDefiance" });
  const strikeStart = capture("endingStrikeStarted");
  const contact = capture("princessStruck");
  const strikeEnd = capture("endingStrikeCompleted");

  assert.equal(chargeStart.length, 1);
  assert.equal(perfectDash.length, 2);
  assert.equal(heal.length, 1);
  assert.equal(revive.length, 2);
  assert.equal(strikeStart.length, 1);
  assert.equal(contact.length, 2);
  assert.equal(strikeEnd.length, 1);
  assert.notDeepEqual(heal, revive);
  assert.notDeepEqual(strikeStart, strikeEnd);
  assert.ok([chargeStart, perfectDash, heal, revive, strikeStart, contact, strikeEnd]
    .flat()
    .every((call) => call.bus === "sfx" || call.bus === "ui"));
  assert.ok([chargeStart, perfectDash, heal, revive, strikeStart, contact, strikeEnd]
    .every((cue) => cue.length <= 2));
});
