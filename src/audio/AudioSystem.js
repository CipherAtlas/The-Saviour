import { AdaptiveMusic } from "./AdaptiveMusic.js";
import { BIOME_PALETTES, normalizeBiome } from "./musicScore.js";
import { ProceduralInstruments } from "./ProceduralInstruments.js";

const MASTER_HEADROOM_DB = -4;
const DIALOGUE_DUCK_DB = -11;

function decibelsToGain(decibels) {
  return 10 ** (decibels / 20);
}

export function gainFromSlider(value) {
  const slider = Math.min(1, Math.max(0, Number(value) || 0));
  if (slider === 0) return 0;
  const decibels = 40 * Math.log10(slider);
  return decibelsToGain(decibels);
}

function createDefaultContext(options) {
  const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!Context) throw new Error("Web Audio is not supported in this browser.");
  return new Context(options);
}

function biomeForArena(detail) {
  const explicit = detail.arena?.biome ?? detail.arena?.theme ?? detail.biome;
  if (explicit) return normalizeBiome(explicit);
  if (detail.floor >= 9) return "voidCourt";
  if (detail.floor >= 6) return "emberFoundry";
  if (detail.floor >= 4) return "ossuary";
  return "forgottenKeep";
}

export class AudioSystem {
  constructor(settings, { contextFactory = createDefaultContext } = {}) {
    this.settings = settings;
    this.contextFactory = contextFactory;
    this.context = null;
    this.buses = null;
    this.nodes = null;
    this.instruments = null;
    this.music = null;
    this.musicState = "exploration";
    this.ducked = false;
    this.focused = true;
  }

  async resume() {
    if (!this.context) this.initialize();
    if (this.context.state !== "running") await this.context.resume();
  }

  initialize() {
    if (this.context) return;
    this.context = this.contextFactory({ latencyHint: "interactive" });

    const music = this.context.createGain();
    const musicTone = this.context.createBiquadFilter();
    const musicDuck = this.context.createGain();
    const sfx = this.context.createGain();
    const ui = this.context.createGain();
    const voice = this.context.createGain();
    const mix = this.context.createGain();
    const compressor = this.context.createDynamicsCompressor();
    const master = this.context.createGain();

    musicTone.type = "lowpass";
    musicTone.frequency.value = 2350;
    musicTone.Q.value = 0.42;
    compressor.threshold.value = -16;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.006;
    compressor.release.value = 0.22;

    music.connect(musicTone).connect(musicDuck).connect(mix);
    sfx.connect(mix);
    ui.connect(mix);
    voice.connect(mix);
    mix.connect(compressor).connect(master).connect(this.context.destination);

    this.buses = { master, music, sfx, ui, voice };
    this.nodes = { musicTone, musicDuck, mix, compressor };
    this.instruments = new ProceduralInstruments(this.context, { maxSources: 72 });
    this.music = new AdaptiveMusic(this.context, music, this.instruments);
    this.applySettings(this.settings.getAll());
  }

  update() {
    if (!this.context || this.context.state !== "running") return;
    this.music.update();
  }

  playTone(frequency, duration, volume, destination, startAt = this.context?.currentTime ?? 0, type = "sine", glide = null) {
    if (!this.instruments) return false;
    const pitchVariation = 1 + (Math.random() - 0.5) * 0.024;
    return this.instruments.playTone(frequency * pitchVariation, duration, volume, destination, startAt, type, glide);
  }

  playNoise(duration, volume, destination, startAt = this.context?.currentTime ?? 0, frequency = 820) {
    if (!this.instruments) return false;
    const colorVariation = 1 + (Math.random() - 0.5) * 0.16;
    return this.instruments.playNoise(duration, volume, destination, startAt, frequency * colorVariation);
  }

  setMusicState(state) {
    if (!["exploration", "combat", "boss"].includes(state)) return;
    this.musicState = state;
    this.music?.requestState(state);
  }

  setBiome(value) {
    if (!this.music) return;
    const biome = normalizeBiome(value);
    this.music.requestBiome(biome);
    const palette = BIOME_PALETTES[biome];
    const targetFrequency = 1450 + palette.brightness * 2100;
    this.nodes.musicTone.frequency.setTargetAtTime(targetFrequency, this.context.currentTime, 0.35);
  }

  setDialogueDucking(active) {
    if (!this.context || this.ducked === active) return;
    this.ducked = active;
    const target = active ? decibelsToGain(DIALOGUE_DUCK_DB) : 1;
    this.nodes.musicDuck.gain.setTargetAtTime(target, this.context.currentTime, active ? 0.018 : 0.32);
  }

  handleEvent({ type, detail = {} }) {
    if (!this.context || this.context.state !== "running") return;
    const now = this.context.currentTime;

    if (type === "attack") {
      this.playNoise(0.09, detail.heavy ? 0.22 : 0.11, this.buses.sfx, now, detail.heavy ? 520 : 860);
      this.playTone(detail.heavy ? 95 : 145, 0.1, 0.075, this.buses.sfx, now, "sawtooth", detail.heavy ? 48 : 88);
    }
    if (type === "enemyHit") this.playTone(detail.critical ? 760 : 480, 0.075, detail.critical ? 0.13 : 0.075, this.buses.sfx);
    if (type === "enemyDefeated") {
      this.playTone(detail.type === "queen" ? 92 : 220, detail.type === "queen" ? 0.8 : 0.18, 0.11, this.buses.sfx, now, "triangle", detail.type === "queen" ? 46 : 110);
    }
    if (type === "dash") this.playNoise(0.12, 0.085, this.buses.sfx, now, 1120);
    if (type === "playerHit") this.playTone(88, 0.22, 0.15, this.buses.sfx, now, "square", 44);
    if (type === "roomCleared") {
      this.playTone(440, 0.2, 0.09, this.buses.ui);
      this.playTone(659.25, 0.28, 0.075, this.buses.ui, now + 0.12);
      this.setMusicState("exploration");
    }
    if (type === "portalTraversalStarted") {
      this.playTone(196, 0.7, 0.09, this.buses.sfx, now, "sine", 73.42);
      this.playNoise(0.55, 0.08, this.buses.sfx, now, 620);
    }
    if (type === "portalTraversalCompleted") {
      this.playTone(73.42, 0.36, 0.08, this.buses.sfx, now, "triangle", 36.71);
    }
    if (type === "arenaChanged") {
      this.setBiome(biomeForArena(detail));
      this.setMusicState(detail.boss ? "boss" : "combat");
    }
    if (type === "runStarted") this.setMusicState("exploration");
    if (type === "runEnded") this.setMusicState("exploration");
    if (type === "dialogueStarted") this.setDialogueDucking(true);
    if (type === "phaseChanged" && detail.phase !== "dialogue") this.setDialogueDucking(false);
    if (type === "blessingChosen") this.playTone(523.25, 0.42, 0.1, this.buses.ui, now, "triangle", 1046.5);
  }

  applySettings(values) {
    if (!this.buses) return;
    const now = this.context.currentTime;
    const audibleMaster = this.focused || !values.audio.muteUnfocused;
    const masterGain = audibleMaster ? gainFromSlider(values.audio.master) * decibelsToGain(MASTER_HEADROOM_DB) : 0;
    this.buses.master.gain.setTargetAtTime(masterGain, now, 0.05);
    this.buses.music.gain.setTargetAtTime(gainFromSlider(values.audio.music), now, 0.05);
    this.buses.sfx.gain.setTargetAtTime(gainFromSlider(values.audio.sfx), now, 0.05);
    this.buses.ui.gain.setTargetAtTime(gainFromSlider(values.audio.ui), now, 0.05);
    this.buses.voice.gain.setTargetAtTime(gainFromSlider(values.audio.voice), now, 0.05);
    this.music.setIntensity(values.audio.musicIntensity);
    this.music.setDynamic(values.audio.dynamicMusic);
  }

  setFocused(focused) {
    this.focused = focused;
    if (!this.context) return;
    this.applySettings(this.settings.getAll());
  }

  metrics() {
    return this.music?.metrics() ?? {
      bpm: 132,
      state: this.musicState,
      activeSources: 0,
      sourceCap: 72,
      schedulerRecoveries: 0,
    };
  }

  dispose() {
    if (!this.context) return;
    this.instruments.stopAll();
    this.context.close();
    this.context = null;
    this.buses = null;
    this.nodes = null;
    this.instruments = null;
    this.music = null;
  }
}
