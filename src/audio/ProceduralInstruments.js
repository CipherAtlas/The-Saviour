const SILENCE = 0.0001;
const DEFAULT_SOURCE_CAP = 72;

function setEnvelope(gain, startAt, attack, peak, releaseAt) {
  gain.setValueAtTime(SILENCE, startAt);
  gain.exponentialRampToValueAtTime(Math.max(SILENCE, peak), startAt + attack);
  gain.exponentialRampToValueAtTime(SILENCE, releaseAt);
}

export class ProceduralInstruments {
  constructor(context, { maxSources = DEFAULT_SOURCE_CAP } = {}) {
    this.context = context;
    this.maxSources = maxSources;
    this.activeSources = new Set();
    this.noiseBuffer = this.createNoiseBuffer();
  }

  get activeSourceCount() {
    return this.activeSources.size;
  }

  createNoiseBuffer() {
    const length = Math.floor(this.context.sampleRate * 0.5);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    return buffer;
  }

  reserveSource(source, stopAt) {
    if (this.activeSources.size >= this.maxSources) return false;
    this.activeSources.add(source);
    source.onended = () => this.activeSources.delete(source);
    source.start(stopAt.start);
    source.stop(stopAt.end);
    return true;
  }

  oscillator({ frequency, startAt, duration, gainValue, destination, type = "sine", detune = 0, attack = 0.01, glide }) {
    if (this.activeSources.size >= this.maxSources) return false;
    const source = this.context.createOscillator();
    const gain = this.context.createGain();
    source.type = type;
    source.frequency.setValueAtTime(frequency, startAt);
    source.detune.setValueAtTime(detune, startAt);
    if (glide) source.frequency.exponentialRampToValueAtTime(glide, startAt + duration);
    setEnvelope(gain.gain, startAt, attack, gainValue, startAt + duration);
    source.connect(gain).connect(destination);
    return this.reserveSource(source, { start: startAt, end: startAt + duration + 0.025 });
  }

  noise({ startAt, duration, gainValue, destination, frequency = 900, type = "bandpass", q = 0.8 }) {
    if (this.activeSources.size >= this.maxSources) return false;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, startAt);
    filter.Q.setValueAtTime(q, startAt);
    setEnvelope(gain.gain, startAt, 0.003, gainValue, startAt + duration);
    source.connect(filter).connect(gain).connect(destination);
    return this.reserveSource(source, { start: startAt, end: startAt + duration + 0.025 });
  }

  playLute(frequency, startAt, velocity, destination) {
    this.noise({ startAt, duration: 0.13, gainValue: velocity * 0.032, destination, frequency: frequency * 2.8, q: 5 });
    this.oscillator({ frequency, startAt, duration: 0.34, gainValue: velocity * 0.032, destination, type: "triangle", attack: 0.004 });
  }

  playDulcimer(frequency, startAt, velocity, destination) {
    this.oscillator({ frequency, startAt, duration: 0.44, gainValue: velocity * 0.024, destination, type: "triangle", attack: 0.002 });
    this.oscillator({ frequency: frequency * 2.01, startAt, duration: 0.28, gainValue: velocity * 0.012, destination, attack: 0.002 });
  }

  playStrings(frequencies, startAt, velocity, destination, duration = 1.7) {
    for (const [index, frequency] of frequencies.entries()) {
      this.oscillator({
        frequency,
        startAt,
        duration,
        gainValue: velocity * 0.014,
        destination,
        type: "sawtooth",
        detune: index * 4 - 4,
        attack: 0.32,
      });
    }
  }

  playFlute(frequency, startAt, velocity, destination) {
    this.oscillator({ frequency, startAt, duration: 0.72, gainValue: velocity * 0.024, destination, attack: 0.08 });
    this.oscillator({ frequency: frequency * 2, startAt, duration: 0.54, gainValue: velocity * 0.0045, destination, type: "triangle", attack: 0.09 });
  }

  playBass(frequency, startAt, velocity, destination) {
    this.oscillator({ frequency, startAt, duration: 0.4, gainValue: velocity * 0.046, destination, type: "triangle", glide: frequency * 0.995 });
  }

  playPercussion(kind, startAt, velocity, destination, pulse = "stone") {
    const tone = pulse === "forge" ? 1260 : pulse === "bone" ? 1760 : pulse === "void" ? 620 : 980;
    if (kind === "kick") {
      this.oscillator({ frequency: pulse === "forge" ? 92 : 76, startAt, duration: 0.2, gainValue: velocity * 0.085, destination, type: "sine", glide: 44, attack: 0.002 });
      return;
    }
    this.noise({ startAt, duration: kind === "snare" ? 0.11 : 0.045, gainValue: velocity * (kind === "snare" ? 0.055 : 0.022), destination, frequency: tone, q: kind === "snare" ? 0.7 : 2.8 });
  }

  playHorns(frequency, startAt, velocity, destination) {
    this.oscillator({ frequency, startAt, duration: 0.68, gainValue: velocity * 0.024, destination, type: "sawtooth", attack: 0.07 });
    this.oscillator({ frequency: frequency * 1.5, startAt, duration: 0.58, gainValue: velocity * 0.01, destination, type: "triangle", attack: 0.07 });
  }

  playBell(frequency, startAt, velocity, destination) {
    this.oscillator({ frequency, startAt, duration: 0.9, gainValue: velocity * 0.018, destination, attack: 0.003 });
    this.oscillator({ frequency: frequency * 2.73, startAt, duration: 0.62, gainValue: velocity * 0.008, destination, attack: 0.003 });
  }

  playChoir(frequencies, startAt, velocity, destination, duration = 1.8) {
    for (const [index, frequency] of frequencies.entries()) {
      this.oscillator({
        frequency: frequency * 0.5,
        startAt,
        duration,
        gainValue: velocity * 0.012,
        destination,
        type: index === 1 ? "sine" : "triangle",
        detune: index * 7 - 7,
        attack: 0.4,
      });
    }
  }

  playTone(frequency, duration, volume, destination, startAt, type = "sine", glide = null) {
    return this.oscillator({ frequency, startAt, duration, gainValue: volume, destination, type, glide });
  }

  playNoise(duration, volume, destination, startAt, frequency = 820) {
    return this.noise({ startAt, duration, gainValue: volume, destination, frequency });
  }

  stopAll() {
    const now = this.context.currentTime;
    for (const source of this.activeSources) source.stop(now);
    this.activeSources.clear();
  }
}
