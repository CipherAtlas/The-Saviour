import {
  BAR_SECONDS,
  BIOME_PALETTES,
  layerMix,
  normalizeBiome,
  scaleFrequency,
  STEP_SECONDS,
  STEPS_PER_BAR,
} from "./musicScore.js";

const SCHEDULE_AHEAD_SECONDS = 0.16;
const START_DELAY_SECONDS = 0.045;

function chordFrequencies(palette, rootDegree, octaveOffset = 0) {
  return [0, 2, 4].map((offset) => scaleFrequency(palette, rootDegree + offset, octaveOffset));
}

export class AdaptiveMusic {
  constructor(context, destination, instruments) {
    this.context = context;
    this.destination = destination;
    this.instruments = instruments;
    this.state = "exploration";
    this.pendingState = null;
    this.biome = "forgottenKeep";
    this.pendingBiome = null;
    this.intensity = 0.82;
    this.dynamic = true;
    this.absoluteStep = 0;
    this.nextStepAt = context.currentTime + START_DELAY_SECONDS;
    this.recoveryCount = 0;
    this.transitionCount = 0;
  }

  requestState(state) {
    if (!["exploration", "combat", "boss"].includes(state)) return false;
    if (state !== this.state) this.pendingState = state;
    return true;
  }

  requestBiome(value) {
    const biome = normalizeBiome(value);
    if (biome !== this.biome) this.pendingBiome = biome;
  }

  setIntensity(value) {
    this.intensity = Math.min(1, Math.max(0, Number(value) || 0));
  }

  setDynamic(enabled) {
    this.dynamic = Boolean(enabled);
  }

  update() {
    const now = this.context.currentTime;
    if (now - this.nextStepAt > BAR_SECONDS) this.recoverScheduler(now);

    while (this.nextStepAt < now + SCHEDULE_AHEAD_SECONDS) {
      this.scheduleStep(this.absoluteStep, this.nextStepAt);
      this.absoluteStep += 1;
      this.nextStepAt += STEP_SECONDS;
    }
  }

  recoverScheduler(now) {
    this.recoveryCount += 1;
    this.absoluteStep = Math.ceil(this.absoluteStep / STEPS_PER_BAR) * STEPS_PER_BAR;
    this.nextStepAt = now + START_DELAY_SECONDS;
  }

  applyPendingTransition(time) {
    const changed = Boolean(this.pendingState || this.pendingBiome);
    if (this.pendingState) {
      this.state = this.pendingState;
      this.pendingState = null;
    }
    if (this.pendingBiome) {
      this.biome = this.pendingBiome;
      this.pendingBiome = null;
    }
    if (!changed) return;
    this.transitionCount += 1;
    const palette = BIOME_PALETTES[this.biome];
    this.instruments.playBell(scaleFrequency(palette, 7, 1), time, this.state === "boss" ? 0.75 : 0.38, this.destination);
  }

  scheduleStep(absoluteStep, time) {
    const step = absoluteStep % STEPS_PER_BAR;
    const bar = Math.floor(absoluteStep / STEPS_PER_BAR);
    if (step === 0) this.applyPendingTransition(time);

    const palette = BIOME_PALETTES[this.biome];
    const scoreState = this.dynamic ? this.state : "combat";
    const mix = layerMix(scoreState, this.intensity, this.dynamic);
    const progressionDegree = palette.progression[bar % palette.progression.length];
    const arpeggioDegree = progressionDegree + [0, 2, 4, 2, 1, 3, 5, 3][step];
    const melodyDegree = palette.melody[(bar * 2 + Math.floor(step / 4)) % palette.melody.length];

    this.instruments.playLute(scaleFrequency(palette, arpeggioDegree, 1), time, mix.lute, this.destination);

    if (step % 2 === 1 && (scoreState !== "exploration" || step === 3 || step === 7)) {
      this.instruments.playDulcimer(scaleFrequency(palette, arpeggioDegree + 7, 1), time, mix.dulcimer, this.destination);
    }

    if (step === 0) {
      const chord = chordFrequencies(palette, progressionDegree, 0);
      this.instruments.playStrings(chord, time, mix.strings, this.destination);
      this.instruments.playChoir(chord, time, mix.choir, this.destination);
    }

    if (step === 2 || (step === 6 && scoreState !== "boss")) {
      this.instruments.playFlute(scaleFrequency(palette, melodyDegree, 2), time, mix.flute, this.destination);
    }

    if (step === 0 || step === 4 || (scoreState === "boss" && step === 6)) {
      this.instruments.playBass(scaleFrequency(palette, progressionDegree, -1), time, mix.bass, this.destination);
    }

    this.schedulePercussion(step, time, mix.percussion, palette.pulse, scoreState);

    if ((scoreState === "combat" && step === 4) || (scoreState === "boss" && (step === 0 || step === 4))) {
      this.instruments.playHorns(scaleFrequency(palette, progressionDegree, 0), time, mix.horns, this.destination);
    }

    if (step === 7 && (bar % 2 === 1 || scoreState === "boss")) {
      this.instruments.playBell(scaleFrequency(palette, progressionDegree + 9, 2), time, mix.bells, this.destination);
    }
  }

  schedulePercussion(step, time, velocity, pulse, scoreState) {
    if (step === 0 || step === 4) this.instruments.playPercussion("kick", time, velocity, this.destination, pulse);
    if (scoreState !== "exploration" && (step === 2 || step === 6)) {
      this.instruments.playPercussion("snare", time, velocity, this.destination, pulse);
    }
    if (scoreState === "boss" || (scoreState === "combat" && step % 2 === 1) || (scoreState === "exploration" && step === 6)) {
      this.instruments.playPercussion("hat", time, velocity, this.destination, pulse);
    }
  }

  metrics() {
    return {
      bpm: 132,
      state: this.state,
      pendingState: this.pendingState,
      biome: this.biome,
      activeSources: this.instruments.activeSourceCount,
      sourceCap: this.instruments.maxSources,
      schedulerRecoveries: this.recoveryCount,
      transitions: this.transitionCount,
    };
  }
}
