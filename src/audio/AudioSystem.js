import { AdaptiveMusic } from "./AdaptiveMusic.js";
import { LicensedSoundtrack, SOUNDTRACK_CUES } from "./LicensedSoundtrack.js";
import { BIOME_PALETTES, normalizeBiome } from "./musicScore.js";
import { ProceduralInstruments } from "./ProceduralInstruments.js";

const MASTER_HEADROOM_DB = -4;
const DIALOGUE_DUCK_DB = -11;
const CRITICAL_SFX_DUCK_DB = -4.5;
const QUEEN_CUE_DISCONNECT_MS = 850;

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
    this.soundtrack = null;
    this.musicState = "exploration";
    this.musicCue = "title";
    this.licensedPlaybackActive = false;
    this.queenActionCues = new Map();
    this.ducked = false;
    this.focused = true;
  }

  async resume() {
    if (!this.context) this.initialize();
    if (this.context.state !== "running") await this.context.resume();
    this.requestSoundtrackCue(this.musicCue);
  }

  initialize() {
    if (this.context) return;
    this.context = this.contextFactory({ latencyHint: "interactive" });

    const music = this.context.createGain();
    const proceduralMusic = this.context.createGain();
    const licensedMusic = this.context.createGain();
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

    proceduralMusic.connect(music);
    licensedMusic.connect(music);
    proceduralMusic.gain.value = 1;
    licensedMusic.gain.value = 0;
    music.connect(musicTone).connect(musicDuck).connect(mix);
    sfx.connect(mix);
    ui.connect(mix);
    voice.connect(mix);
    mix.connect(compressor).connect(master).connect(this.context.destination);

    this.buses = { master, music, sfx, ui, voice };
    this.nodes = { musicTone, musicDuck, proceduralMusic, licensedMusic, mix, compressor };
    this.instruments = new ProceduralInstruments(this.context, { maxSources: 72 });
    this.music = new AdaptiveMusic(this.context, proceduralMusic, this.instruments);
    if (typeof this.context.decodeAudioData === "function" && typeof globalThis.fetch === "function") {
      this.soundtrack = new LicensedSoundtrack(this.context, licensedMusic, {
        onPlaybackStart: () => this.activateLicensedMusic(),
      });
    }
    this.applySettings(this.settings.getAll());
  }

  update() {
    if (!this.context || this.context.state !== "running") return;
    if (!this.licensedPlaybackActive) this.music.update();
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
    const cueKey = state === "boss" ? "bossPhase1" : state;
    this.setSoundtrackCue(cueKey);
  }

  setSoundtrackCue(cueKey) {
    if (!SOUNDTRACK_CUES[cueKey]) return false;
    this.musicCue = cueKey;
    this.requestSoundtrackCue(cueKey);
    return true;
  }

  requestSoundtrackCue(cueKey) {
    if (!this.soundtrack || this.context?.state !== "running") return false;
    void this.soundtrack.request(cueKey);
    return true;
  }

  activateLicensedMusic() {
    if (!this.nodes || this.licensedPlaybackActive) return;
    this.licensedPlaybackActive = true;
    const now = this.context.currentTime;
    this.nodes.proceduralMusic.gain.setTargetAtTime(0, now, 0.22);
    this.nodes.licensedMusic.gain.setTargetAtTime(1, now, 0.18);
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
    this.nodes.musicDuck.gain.cancelScheduledValues(this.context.currentTime);
    this.nodes.musicDuck.gain.setTargetAtTime(target, this.context.currentTime, active ? 0.018 : 0.32);
  }

  duckMusicForCriticalSfx(duration = 0.32) {
    if (!this.context || this.ducked) return;
    const now = this.context.currentTime;
    const musicGain = this.nodes.musicDuck.gain;
    musicGain.cancelScheduledValues(now);
    musicGain.setTargetAtTime(decibelsToGain(CRITICAL_SFX_DUCK_DB), now, 0.012);
    musicGain.setTargetAtTime(1, now + duration, 0.22);
  }

  beginQueenActionCue(actionId, kind) {
    if (typeof actionId !== "string" || actionId.length === 0 || !["teleport", "summon"].includes(kind)) return null;
    this.cancelQueenActionCue(actionId);
    const gain = this.context.createGain();
    gain.gain.value = 1;
    gain.connect(this.buses.sfx);
    const cue = { actionId, kind, stage: "anticipation", gain, cleanupTimer: null };
    this.queenActionCues.set(actionId, cue);
    return cue;
  }

  scheduleQueenCueDisconnect(cue, delay = QUEEN_CUE_DISCONNECT_MS) {
    if (!cue) return;
    if (cue.cleanupTimer != null) globalThis.clearTimeout?.(cue.cleanupTimer);
    const disconnect = () => {
      cue.gain.disconnect?.();
      cue.cleanupTimer = null;
    };
    if (typeof globalThis.setTimeout !== "function") {
      disconnect();
      return;
    }
    cue.cleanupTimer = globalThis.setTimeout(disconnect, delay);
    cue.cleanupTimer?.unref?.();
  }

  cancelQueenActionCue(actionId) {
    const cue = this.queenActionCues.get(actionId);
    if (!cue) return false;
    const now = this.context.currentTime;
    cue.gain.gain.cancelScheduledValues(now);
    cue.gain.gain.setTargetAtTime(0, now, 0.012);
    this.queenActionCues.delete(actionId);
    this.scheduleQueenCueDisconnect(cue, 160);
    return true;
  }

  finishQueenActionCue(actionId) {
    const cue = this.queenActionCues.get(actionId);
    if (!cue) return false;
    const now = this.context.currentTime;
    cue.gain.gain.cancelScheduledValues(now);
    cue.gain.gain.setTargetAtTime(0, now + 0.24, 0.065);
    this.queenActionCues.delete(actionId);
    this.scheduleQueenCueDisconnect(cue);
    return true;
  }

  clearQueenActionCues() {
    for (const actionId of [...this.queenActionCues.keys()]) this.cancelQueenActionCue(actionId);
  }

  queenComboPitch(detail) {
    const phase = detail.phase ?? detail.bossPhase;
    if (phase !== 3 || detail.comboLength !== 2) return 1;
    if (detail.comboStep === 1 && detail.continuesCombo === true) return 1.12;
    if (detail.comboStep === 2) return 0.84;
    return 1;
  }

  playQueenSpecialAnticipation(detail, now) {
    const cue = this.beginQueenActionCue(detail.actionId, detail.action);
    if (!cue) return;
    const pitch = this.queenComboPitch(detail);
    if (detail.action === "teleport") {
      this.playNoise(0.16, 0.042, cue.gain, now, 1780 * pitch);
      this.playTone(392 * pitch, 0.24, 0.052, cue.gain, now, "triangle", 987.77 * pitch);
      return;
    }
    this.playNoise(0.22, 0.055, cue.gain, now, 340 * pitch);
    this.playTone(110 * pitch, 0.28, 0.064, cue.gain, now, "square", 164.81 * pitch);
  }

  playQueenSpecialRelease(detail, now) {
    const cue = this.queenActionCues.get(detail.actionId);
    if (!cue || cue.kind !== detail.action) return;
    cue.stage = "release";
    const pitch = this.queenComboPitch(detail);
    const comboFinisher = detail.phase === 3 && detail.comboStep === 2;
    this.duckMusicForCriticalSfx(comboFinisher ? 0.38 : 0.28);
    if (detail.action === "teleport") {
      this.playNoise(0.13, comboFinisher ? 0.085 : 0.068, cue.gain, now, 1280 * pitch);
      this.playTone(783.99 * pitch, 0.18, comboFinisher ? 0.092 : 0.072, cue.gain, now, "sine", (comboFinisher ? 196 : 329.63) * pitch);
      return;
    }
    this.playNoise(0.2, 0.082, cue.gain, now, 260 * pitch);
    this.playTone(98 * pitch, 0.3, 0.088, cue.gain, now, "sawtooth", 246.94 * pitch);
  }

  playQueenSpecialRecovery(detail, now) {
    const cue = this.queenActionCues.get(detail.actionId);
    if (!cue || cue.kind !== detail.action) return;
    cue.stage = "recovery";
    const pitch = this.queenComboPitch(detail);
    if (detail.action === "teleport") {
      this.playNoise(0.08, 0.025, cue.gain, now, 920 * pitch);
      this.playTone(659.25 * pitch, 0.2, 0.035, cue.gain, now, "sine", 329.63 * pitch);
    } else {
      this.playTone(146.83 * pitch, 0.2, 0.038, cue.gain, now, "triangle", 220 * pitch);
      this.playTone(440 * pitch, 0.16, 0.026, cue.gain, now + 0.055, "sine", 392 * pitch);
    }
    this.finishQueenActionCue(detail.actionId);
  }

  playBossPhaseTransition(detail, now) {
    const phase = Number(detail.phase);
    if (![1, 2, 3].includes(phase)) return;
    this.duckMusicForCriticalSfx(phase === 3 ? 0.52 : 0.4);
    const base = phase === 3 ? 82.41 : phase === 2 ? 123.47 : 164.81;
    this.playNoise(phase === 3 ? 0.3 : 0.2, phase === 3 ? 0.092 : 0.068, this.buses.sfx, now, phase === 3 ? 230 : 470);
    this.playTone(base, phase === 3 ? 0.52 : 0.38, phase === 3 ? 0.105 : 0.082, this.buses.sfx, now, phase === 3 ? "sawtooth" : "triangle", phase === 3 ? 41.2 : base * 2);
  }

  playQueenGuardDismissal(detail, now) {
    const dismissed = Math.max(0, Math.min(5, detail.actors?.length ?? 0));
    const weight = dismissed / 5;
    this.playNoise(0.22 + weight * 0.16, 0.035 + weight * 0.025, this.buses.sfx, now, 610 - weight * 180);
    this.playTone(196, 0.28 + weight * 0.18, 0.045 + weight * 0.025, this.buses.sfx, now, "triangle", 73.42);
  }

  playQueenComboAccent(detail, now) {
    const phase = detail.bossPhase ?? detail.phase;
    if (detail.type !== "queen" || phase !== 3 || detail.comboLength !== 2) return;
    if (["teleport", "summon"].includes(detail.attack)) return;
    const continues = detail.comboStep === 1 && detail.continuesCombo === true;
    const finisher = detail.comboStep === 2;
    if (!continues && !finisher) return;
    this.playTone(continues ? 349.23 : 174.61, continues ? 0.11 : 0.16, continues ? 0.03 : 0.047, this.buses.sfx, now, "triangle", continues ? 523.25 : 87.31);
  }

  handleEvent({ type, detail = {} } = {}) {
    if (!this.context || this.context.state !== "running") return;
    detail ??= {};
    const now = this.context.currentTime;

    if (type === "attack") {
      this.playNoise(0.09, detail.heavy ? 0.22 : 0.11, this.buses.sfx, now, detail.heavy ? 520 : 860);
      this.playTone(detail.heavy ? 95 : 145, 0.1, 0.075, this.buses.sfx, now, "sawtooth", detail.heavy ? 48 : 88);
    }
    if (type === "enemyHit") this.playTone(detail.critical ? 760 : 480, 0.075, detail.critical ? 0.13 : 0.075, this.buses.sfx);
    if (type === "harvestChanged" && Number(detail.delta) > 0) {
      this.playTone(523.25, 0.1, 0.045, this.buses.ui, now, "triangle", 659.25);
      this.playTone(783.99, 0.12, 0.035, this.buses.ui, now + 0.045, "sine", 880);
    }
    if (type === "harvestChanged" && Number(detail.delta) < 0) {
      this.playTone(246.94, 0.13, 0.055, this.buses.ui, now, "triangle", 146.83);
      this.playNoise(0.055, 0.028, this.buses.ui, now, 520);
    }
    if (type === "claimStarted") {
      this.playNoise(0.12, 0.085, this.buses.sfx, now, 1480);
      this.playTone(174.61, 0.16, 0.072, this.buses.sfx, now, "sawtooth", 82.41);
    }
    if (type === "claimRecallStarted") {
      this.playNoise(0.14, 0.055, this.buses.sfx, now, 960);
      this.playTone(164.81, 0.2, 0.065, this.buses.sfx, now, "triangle", 440);
    }
    if (type === "claimCaught") {
      this.playNoise(0.045, 0.075, this.buses.sfx, now, 260);
      this.playTone(110, 0.11, 0.085, this.buses.sfx, now, "square", 73.42);
    }
    if (type === "claimFollowupReady") {
      this.playTone(392, 0.12, 0.052, this.buses.ui, now, "triangle", 523.25);
      this.playTone(587.33, 0.16, 0.045, this.buses.ui, now + 0.07, "sine", 783.99);
    }
    if (type === "claimHit" && detail.pass === "outbound") {
      this.playTone(293.66, 0.075, 0.052, this.buses.sfx, now, "triangle", 196);
    }
    if (type === "claimHit" && detail.pass === "recall") {
      this.playTone(329.63, 0.085, 0.055, this.buses.sfx, now, "triangle", 493.88);
    }
    if (type === "enemyStaggered") {
      this.playNoise(0.1, 0.09, this.buses.sfx, now, 190);
      this.playTone(73.42, 0.18, 0.105, this.buses.sfx, now, "square", 43.65);
    }
    if (type === "chargeReleased" && ["partial", "full", "perfect"].includes(detail.quality)) {
      const fullCharge = detail.quality !== "partial";
      this.playTone(fullCharge ? 196 : 130.81, 0.11, fullCharge ? 0.055 : 0.038, this.buses.sfx, now, "sawtooth", fullCharge ? 146.83 : 98);
      if (detail.quality === "perfect") {
        this.playTone(783.99, 0.18, 0.062, this.buses.sfx, now + 0.045, "sine", 1046.5);
      }
    }
    if (type === "chargeStart") {
      this.playTone(146.83, 0.16, 0.035, this.buses.sfx, now, "triangle", 196);
    }
    if (type === "enemyDefeated") {
      this.playTone(detail.type === "queen" ? 92 : 220, detail.type === "queen" ? 0.8 : 0.18, 0.11, this.buses.sfx, now, "triangle", detail.type === "queen" ? 46 : 110);
    }
    if (type === "dash") this.playNoise(0.12, 0.085, this.buses.sfx, now, 1120);
    if (type === "perfectDash") {
      this.playTone(659.25, 0.12, 0.052, this.buses.ui, now, "triangle", 880);
      this.playTone(1046.5, 0.16, 0.04, this.buses.ui, now + 0.05, "sine", 1318.51);
    }
    if (type === "playerHit") this.playTone(88, 0.22, 0.15, this.buses.sfx, now, "square", 44);
    if (type === "playerHealed" && Number(detail.amount) > 0) {
      const revived = detail.reason === "deathDefiance";
      this.playTone(revived ? 196 : 440, revived ? 0.38 : 0.16, revived ? 0.075 : 0.035, this.buses.ui, now, "triangle", revived ? 783.99 : 554.37);
      if (revived) this.playTone(1046.5, 0.42, 0.055, this.buses.ui, now + 0.12, "sine", 1318.51);
    }
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
      this.clearQueenActionCues();
      this.setBiome(biomeForArena(detail));
      this.setMusicState(detail.boss ? "boss" : "combat");
    }
    if (type === "bossPhaseChanged" && [1, 2, 3].includes(detail.phase)) {
      this.setSoundtrackCue(`bossPhase${detail.phase}`);
      this.playBossPhaseTransition(detail, now);
    }
    if (type === "queenSpecialAnticipated") this.playQueenSpecialAnticipation(detail, now);
    if (type === "queenSpecialReleased") this.playQueenSpecialRelease(detail, now);
    if (type === "queenSpecialRecovered") this.playQueenSpecialRecovery(detail, now);
    if (type === "queenSpecialCancelled") this.cancelQueenActionCue(detail.actionId);
    if (type === "queenGuardsDismissed") this.playQueenGuardDismissal(detail, now);
    if (type === "enemyAttack") this.playQueenComboAccent(detail, now);
    if (type === "encounterWaveStarted") {
      const princessCount = detail.originCounts?.princess ?? 0;
      if (princessCount > 0) {
        this.playNoise(0.18, 0.045, this.buses.sfx, now, 430);
        this.playTone(164.81, 0.3, 0.055, this.buses.sfx, now, "sawtooth", 110);
      } else {
        this.playTone(220, 0.18, 0.04, this.buses.sfx, now, "triangle", 277.18);
      }
    }
    if (type === "endingSequenceStarted") {
      this.playTone(73.42, 1.1, 0.12, this.buses.sfx, now, "triangle", 36.71);
      this.setMusicState("exploration");
    }
    if (type === "witchMagicCeased") {
      this.playNoise(0.8, 0.1, this.buses.sfx, now, 310);
      this.playTone(146.83, 0.9, 0.09, this.buses.voice, now, "sine", 55);
    }
    if (type === "princessHumanReturned") {
      this.playTone(392, 0.5, 0.07, this.buses.voice, now, "sine", 523.25);
    }
    if (type === "endingDecisionStarted") {
      this.playTone(98, 0.36, 0.08, this.buses.ui, now, "triangle", 82.41);
    }
    if (type === "endingChoiceResolved") {
      this.setSoundtrackCue(detail.ending === "kill" ? "endingKill" : "endingTimeout");
      if (detail.ending === "kill") {
        this.playTone(261.63, 0.85, 0.12, this.buses.sfx, now, "triangle", 65.41);
      } else {
        this.playNoise(0.65, 0.13, this.buses.sfx, now, 240);
        this.playTone(82.41, 0.9, 0.1, this.buses.sfx, now, "sawtooth", 41.2);
      }
    }
    if (type === "endingStrikeStarted") {
      this.playTone(146.83, 0.28, 0.065, this.buses.sfx, now, "sawtooth", 73.42);
    }
    if (type === "princessStruck") {
      this.playNoise(0.18, 0.12, this.buses.sfx, now, 280);
      this.playTone(65.41, 0.48, 0.13, this.buses.sfx, now, "triangle", 32.7);
    }
    if (type === "endingStrikeCompleted") {
      this.playTone(261.63, 0.62, 0.055, this.buses.sfx, now, "sine", 130.81);
    }
    if (type === "glossaryUnlocked") {
      this.playTone(523.25, 0.22, 0.07, this.buses.ui, now, "triangle", 783.99);
      this.playTone(659.25, 0.35, 0.06, this.buses.ui, now + 0.1, "triangle", 1046.5);
    }
    if (type === "runStarted") {
      this.clearQueenActionCues();
      this.setMusicState("exploration");
    }
    if (type === "runEnded") {
      this.clearQueenActionCues();
      if (detail.completed !== true) this.setMusicState("exploration");
    }
    if (type === "dialogueStarted") this.setDialogueDucking(true);
    if (type === "phaseChanged") {
      this.setDialogueDucking(detail.phase === "dialogue");
      if (detail.phase === "title") this.setSoundtrackCue("title");
    }
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
    const procedural = this.music?.metrics() ?? {
      bpm: 132,
      state: this.musicState,
      activeSources: 0,
      sourceCap: 72,
      schedulerRecoveries: 0,
    };
    return Object.freeze({
      ...procedural,
      cue: this.musicCue,
      licensed: this.licensedPlaybackActive,
      soundtrack: this.soundtrack?.metrics() ?? null,
    });
  }

  dispose() {
    if (!this.context) return;
    this.clearQueenActionCues();
    this.soundtrack?.dispose();
    this.instruments.stopAll();
    this.context.close();
    this.context = null;
    this.buses = null;
    this.nodes = null;
    this.instruments = null;
    this.music = null;
    this.soundtrack = null;
    this.licensedPlaybackActive = false;
  }
}
