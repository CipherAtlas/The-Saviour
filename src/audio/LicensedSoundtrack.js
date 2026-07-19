import { publicAssetUrl } from "../publicAssetUrl.js";

const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";
// The active cue plus one transition/revisit buffer matches the two-source crossfade cap.
export const SOUNDTRACK_CACHE_LIMIT = 2;

function cue(title, file, { loop = true, source }) {
  return Object.freeze({
    title,
    creator: "Kevin MacLeod",
    file: publicAssetUrl(`assets/audio/music/${file}`),
    loop,
    source,
    license: "CC BY 4.0",
    licenseUrl: LICENSE_URL,
  });
}

export const SOUNDTRACK_CUES = Object.freeze({
  title: cue("Lamentation", "lamentation.mp3", {
    source: "https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100607",
  }),
  exploration: cue("Darkest Child", "darkest-child.mp3", {
    source: "https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100783",
  }),
  combat: cue("Darkest Child var A", "darkest-child-var-a.mp3", {
    source: "https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100784",
  }),
  bossPhase1: cue("Constancy Part Two", "constancy-part-two.mp3", {
    source: "https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100773",
  }),
  bossPhase2: cue("Constancy Part One", "constancy-part-one.mp3", {
    source: "https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100775",
  }),
  bossPhase3: cue("Constancy Part Three", "constancy-part-three.mp3", {
    source: "https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100774",
  }),
  endingKill: cue("Death of Kings", "death-of-kings.mp3", {
    loop: false,
    source: "https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100876",
  }),
  endingTimeout: cue("Unlight", "unlight.mp3", {
    loop: false,
    source: "https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100878",
  }),
});

function safeParamCall(param, method, ...args) {
  if (typeof param?.[method] === "function") param[method](...args);
  else if (method === "setValueAtTime") param.value = args[0];
}

export class LicensedSoundtrack {
  constructor(context, destination, {
    fetcher = globalThis.fetch?.bind(globalThis),
    crossfadeDuration = 0.8,
    onPlaybackStart = () => {},
  } = {}) {
    this.context = context;
    this.destination = destination;
    this.fetcher = fetcher;
    this.crossfadeDuration = crossfadeDuration;
    this.onPlaybackStart = onPlaybackStart;
    this.buffers = new Map();
    this.loading = new Map();
    this.desiredCue = null;
    this.active = null;
    this.retiring = new Set();
    this.activeSourceCount = 0;
    this.decodeFailures = 0;
    this.requestSerial = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.cacheEvictions = 0;
    this.peakCachedCues = 0;
    this.disposed = false;
  }

  async request(cueKey) {
    if (this.disposed || !SOUNDTRACK_CUES[cueKey] || !this.fetcher) return false;
    this.desiredCue = cueKey;
    if (this.active?.cueKey === cueKey) {
      this.touchBuffer(cueKey);
      return true;
    }
    const serial = ++this.requestSerial;
    try {
      const buffer = await this.load(cueKey);
      if (serial !== this.requestSerial || this.desiredCue !== cueKey) return false;
      this.start(cueKey, buffer);
      return true;
    } catch {
      this.decodeFailures += 1;
      return false;
    }
  }

  async load(cueKey) {
    if (this.buffers.has(cueKey)) {
      this.cacheHits += 1;
      return this.touchBuffer(cueKey);
    }
    if (this.loading.has(cueKey)) return this.loading.get(cueKey);
    this.cacheMisses += 1;
    const cueDefinition = SOUNDTRACK_CUES[cueKey];
    const pending = (async () => {
      const response = await this.fetcher(cueDefinition.file);
      if (!response?.ok) throw new Error(`Unable to load soundtrack cue: ${cueKey}`);
      const encoded = await response.arrayBuffer();
      const buffer = await this.context.decodeAudioData(encoded);
      if (!this.disposed) this.cacheBuffer(cueKey, buffer);
      return buffer;
    })();
    this.loading.set(cueKey, pending);
    try {
      return await pending;
    } finally {
      this.loading.delete(cueKey);
    }
  }

  touchBuffer(cueKey) {
    if (!this.buffers.has(cueKey)) return null;
    const buffer = this.buffers.get(cueKey);
    this.buffers.delete(cueKey);
    this.buffers.set(cueKey, buffer);
    return buffer;
  }

  cacheBuffer(cueKey, buffer) {
    this.buffers.delete(cueKey);
    this.buffers.set(cueKey, buffer);
    const protectedCues = new Set([this.active?.cueKey, this.desiredCue].filter(Boolean));
    while (this.buffers.size > SOUNDTRACK_CACHE_LIMIT) {
      // Playing sources retain their AudioBuffer reference, so retiring cues remain audible after eviction.
      const candidate = [...this.buffers.keys()].find((key) => !protectedCues.has(key))
        ?? this.buffers.keys().next().value;
      this.buffers.delete(candidate);
      this.cacheEvictions += 1;
    }
    this.peakCachedCues = Math.max(this.peakCachedCues, this.buffers.size);
  }

  start(cueKey, buffer) {
    const cueDefinition = SOUNDTRACK_CUES[cueKey];
    const now = this.context.currentTime;
    const fade = Math.max(0.05, this.crossfadeDuration);
    for (const retiring of this.retiring) {
      try {
        retiring.source.stop(now);
      } catch {
        // The retiring source may already have reached its scheduled stop.
      }
      this.release(retiring);
    }
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = cueDefinition.loop;
    source.connect(gain).connect(this.destination);
    safeParamCall(gain.gain, "cancelScheduledValues", now);
    safeParamCall(gain.gain, "setValueAtTime", 0, now);
    safeParamCall(gain.gain, "linearRampToValueAtTime", 1, now + fade);
    source.start(now);
    this.activeSourceCount += 1;

    const previous = this.active;
    const record = { cueKey, source, gain, counted: true };
    source.onended = () => {
      this.release(record);
      if (this.active === record) this.active = null;
    };
    this.active = record;
    this.onPlaybackStart(cueKey);

    if (!previous) return;
    safeParamCall(previous.gain.gain, "cancelScheduledValues", now);
    safeParamCall(previous.gain.gain, "setValueAtTime", previous.gain.gain.value, now);
    safeParamCall(previous.gain.gain, "linearRampToValueAtTime", 0, now + fade);
    this.retiring.add(previous);
    try {
      previous.source.stop(now + fade + 0.04);
    } catch {
      // The prior source may have ended naturally during the crossfade.
    }
  }

  release(record) {
    this.retiring.delete(record);
    if (!record?.counted) return;
    record.counted = false;
    this.activeSourceCount = Math.max(0, this.activeSourceCount - 1);
  }

  stop(fadeDuration = this.crossfadeDuration) {
    this.desiredCue = null;
    this.requestSerial += 1;
    const record = this.active;
    if (!record) return;
    const now = this.context.currentTime;
    const fade = Math.max(0.05, fadeDuration);
    safeParamCall(record.gain.gain, "cancelScheduledValues", now);
    safeParamCall(record.gain.gain, "setValueAtTime", record.gain.gain.value, now);
    safeParamCall(record.gain.gain, "linearRampToValueAtTime", 0, now + fade);
    try {
      record.source.stop(now + fade + 0.04);
    } catch {
      // A naturally completed one-shot already owns its cleanup.
    }
    this.retiring.add(record);
    this.active = null;
  }

  dispose() {
    this.disposed = true;
    this.stop(0.05);
    for (const record of this.retiring) {
      try {
        record.source.stop(this.context.currentTime);
      } catch {
        // The source has already stopped.
      }
      this.release(record);
    }
    this.buffers.clear();
    this.loading.clear();
  }

  metrics() {
    return Object.freeze({
      desiredCue: this.desiredCue,
      activeCue: this.active?.cueKey ?? null,
      loadedCues: this.buffers.size,
      cacheLimit: SOUNDTRACK_CACHE_LIMIT,
      cachedCues: Object.freeze([...this.buffers.keys()]),
      peakCachedCues: this.peakCachedCues,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheEvictions: this.cacheEvictions,
      pendingLoads: this.loading.size,
      activeSources: this.activeSourceCount,
      decodeFailures: this.decodeFailures,
    });
  }
}
