import { publicAssetUrl } from "../publicAssetUrl.js";
import { equalPowerGainAt, scheduleEqualPowerFade } from "./gainAutomation.js";

const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";
const LOOP_SCHEDULE_AHEAD_SECONDS = 0.12;
const SOURCE_STOP_PADDING_SECONDS = 0.04;
// The active cue plus one transition/revisit buffer matches the two-source crossfade cap.
export const SOUNDTRACK_CACHE_LIMIT = 2;

function cue(title, file, {
  loop = true,
  loopStart = 0,
  loopTail = 0,
  transitionDuration = 1.6,
  source,
}) {
  return Object.freeze({
    title,
    creator: "Kevin MacLeod",
    file: publicAssetUrl(`assets/audio/music/${file}`),
    loop,
    loopStart,
    loopTail,
    transitionDuration,
    source,
    license: "CC BY 4.0",
    licenseUrl: LICENSE_URL,
  });
}

export const SOUNDTRACK_CUES = Object.freeze({
  title: cue("Lamentation", "lamentation.mp3", {
    loopTail: 7.2,
    transitionDuration: 2,
    source: "https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100607",
  }),
  exploration: cue("Darkest Child", "darkest-child.mp3", {
    loopTail: 2.9,
    transitionDuration: 1.8,
    source: "https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100783",
  }),
  combat: cue("Darkest Child var A", "darkest-child-var-a.mp3", {
    loopTail: 2.15,
    transitionDuration: 1.25,
    source: "https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100784",
  }),
  bossPhase1: cue("Constancy Part Two", "constancy-part-two.mp3", {
    loopTail: 1.75,
    transitionDuration: 1.5,
    source: "https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100773",
  }),
  bossPhase2: cue("Constancy Part One", "constancy-part-one.mp3", {
    loopStart: 0.9,
    loopTail: 2.9,
    transitionDuration: 1.25,
    source: "https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100775",
  }),
  bossPhase3: cue("Constancy Part Three", "constancy-part-three.mp3", {
    loopTail: 1.25,
    transitionDuration: 1.25,
    source: "https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100774",
  }),
  endingKill: cue("Death of Kings", "death-of-kings.mp3", {
    loop: false,
    transitionDuration: 2,
    source: "https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100876",
  }),
  endingTimeout: cue("Unlight", "unlight.mp3", {
    loop: false,
    transitionDuration: 2,
    source: "https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100878",
  }),
});

export class LicensedSoundtrack {
  constructor(context, destination, {
    fetcher = globalThis.fetch?.bind(globalThis),
    crossfadeDuration = null,
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
    this.pendingTransition = null;
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
      this.pendingTransition = null;
      this.touchBuffer(cueKey);
      return true;
    }
    const serial = ++this.requestSerial;
    try {
      const buffer = await this.load(cueKey);
      if (serial !== this.requestSerial || this.desiredCue !== cueKey) return false;
      this.startOrQueue(cueKey, buffer);
      return true;
    } catch {
      this.decodeFailures += 1;
      return false;
    }
  }

  async preload(cueKey) {
    if (this.disposed || !SOUNDTRACK_CUES[cueKey] || !this.fetcher) return false;
    try {
      await this.load(cueKey);
      return !this.disposed;
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

  startOrQueue(cueKey, buffer) {
    if (this.retiring.size > 0) {
      this.pendingTransition = { cueKey, buffer };
      return;
    }
    this.start(cueKey, buffer);
  }

  transitionDuration(cueKey) {
    const configured = this.crossfadeDuration ?? SOUNDTRACK_CUES[cueKey].transitionDuration;
    return Math.max(0.05, Number(configured) || 0);
  }

  playbackBounds(cueDefinition, buffer) {
    const duration = Math.max(0.1, Number(buffer.duration) || 0.1);
    const offset = Math.min(Math.max(0, cueDefinition.loopStart), duration - 0.05);
    const requestedEnd = duration - Math.max(0, cueDefinition.loopTail);
    const end = Math.max(offset + 0.05, Math.min(duration, requestedEnd));
    return { offset, end };
  }

  gainAt(record, time) {
    const envelope = record?.gainEnvelope;
    if (!envelope) return 1;
    if (time <= envelope.startAt) return envelope.from;
    if (time >= envelope.endAt) return envelope.to;
    return equalPowerGainAt(
      envelope.from,
      envelope.to,
      (time - envelope.startAt) / (envelope.endAt - envelope.startAt),
    );
  }

  fadeRecord(record, from, to, startAt, duration) {
    const endAt = scheduleEqualPowerFade(record.gain.gain, from, to, startAt, duration);
    record.gainEnvelope = { from, to, startAt, endAt };
  }

  start(cueKey, buffer, { startAt = this.context.currentTime, loopRestart = false } = {}) {
    const cueDefinition = SOUNDTRACK_CUES[cueKey];
    const fade = this.transitionDuration(cueKey);
    const { offset, end } = this.playbackBounds(cueDefinition, buffer);
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = false;
    source.connect(gain).connect(this.destination);
    source.start(startAt, offset);
    this.activeSourceCount += 1;

    const previous = this.active;
    const record = {
      cueKey,
      source,
      gain,
      buffer,
      counted: true,
      contentEndAt: startAt + end - offset,
      loopTransitionStarted: false,
      stopAt: null,
    };
    this.fadeRecord(record, 0, 1, startAt, fade);
    source.onended = () => {
      this.release(record);
      if (this.active === record) this.active = null;
      this.startPendingIfReady();
    };
    this.active = record;
    if (!loopRestart) this.onPlaybackStart(cueKey, { startAt, duration: fade });

    if (!previous) return;
    this.fadeRecord(previous, this.gainAt(previous, startAt), 0, startAt, fade);
    previous.stopAt = startAt + fade + SOURCE_STOP_PADDING_SECONDS;
    this.retiring.add(previous);
    try {
      previous.source.stop(previous.stopAt);
    } catch {
      // The prior source may have ended naturally during the crossfade.
    }
  }

  startPendingIfReady() {
    if (this.disposed || this.retiring.size > 0 || !this.pendingTransition) return false;
    const pending = this.pendingTransition;
    this.pendingTransition = null;
    if (pending.cueKey !== this.desiredCue) return false;
    this.start(pending.cueKey, pending.buffer);
    return true;
  }

  update() {
    if (this.disposed) return;
    const now = this.context.currentTime;
    for (const record of [...this.retiring]) {
      if (record.stopAt != null && now >= record.stopAt) this.release(record);
    }
    if (this.startPendingIfReady()) return;

    const record = this.active;
    if (!record || record.loopTransitionStarted || !SOUNDTRACK_CUES[record.cueKey].loop) return;
    const fade = this.transitionDuration(record.cueKey);
    const transitionAt = record.contentEndAt - fade;
    if (now + LOOP_SCHEDULE_AHEAD_SECONDS < transitionAt) return;

    record.loopTransitionStarted = true;
    this.start(record.cueKey, record.buffer, {
      startAt: Math.max(now, transitionAt),
      loopRestart: true,
    });
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
    this.pendingTransition = null;
    const record = this.active;
    if (!record) return;
    const now = this.context.currentTime;
    const fade = Math.max(0.05, Number(fadeDuration ?? SOUNDTRACK_CUES[record.cueKey].transitionDuration) || 0);
    this.fadeRecord(record, this.gainAt(record, now), 0, now, fade);
    record.stopAt = now + fade + SOURCE_STOP_PADDING_SECONDS;
    try {
      record.source.stop(record.stopAt);
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
    this.pendingTransition = null;
  }

  metrics() {
    return Object.freeze({
      desiredCue: this.desiredCue,
      activeCue: this.active?.cueKey ?? null,
      pendingCue: this.pendingTransition?.cueKey ?? null,
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
