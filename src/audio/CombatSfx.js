import { publicAssetUrl } from "../publicAssetUrl.js";

const MAX_ACTIVE_COMBAT_SOURCES = 36;

function combatFile(relativePath) {
  return publicAssetUrl(`assets/audio/sfx/combat/${relativePath}`);
}

function pool(...relativePaths) {
  return Object.freeze(relativePaths.map(combatFile));
}

export const COMBAT_SFX_CUES = Object.freeze({
  playerBasic1: pool("player/basic-1a.mp3", "player/basic-1b.mp3", "player/basic-1c.mp3"),
  playerBasic2: pool("player/basic-2a.mp3", "player/basic-2b.mp3", "player/basic-2c.mp3"),
  playerBasic3: pool("player/basic-3a.mp3", "player/basic-3b.mp3", "player/basic-3c.mp3"),
  playerDashAttack: pool("player/dash-attack-a.mp3", "player/dash-attack-b.mp3"),
  playerDash: pool("player/dash-a.mp3", "player/dash-b.mp3", "player/dash-c.mp3"),
  playerQCharge: pool("player/q-charge.mp3"),
  playerQPartial: pool("player/q-release-partial.mp3"),
  playerQFull: pool("player/q-release-full.mp3"),
  playerQPerfect: pool("player/q-release-perfect.mp3"),
  playerLineCharge: pool("player/line-charge.mp3"),
  playerLineRelease: pool("player/line-release-a.mp3", "player/line-release-b.mp3"),
  playerClaimOut: pool("player/claim-out-a.mp3", "player/claim-out-b.mp3"),
  playerClaimReturn: pool("player/claim-return-a.mp3", "player/claim-return-b.mp3"),
  playerClaimCatch: pool("player/claim-catch.mp3"),
  playerClaimCleave: pool("player/claim-cleave.mp3"),
  scytheHit: pool("impact/scythe-hit-a.mp3", "impact/scythe-hit-b.mp3", "impact/scythe-hit-c.mp3"),
  enemyMelee: pool("enemy/melee-a.mp3", "enemy/melee-b.mp3"),
  enemyDash: pool("enemy/dash-a.mp3", "enemy/dash-b.mp3"),
  enemyShield: pool("enemy/shield-a.mp3", "enemy/shield-b.mp3"),
  enemyMagicBolt: pool("enemy/magic-bolt-a.mp3", "enemy/magic-bolt-b.mp3"),
  enemyMagicArea: pool("enemy/magic-area-a.mp3", "enemy/magic-area-b.mp3"),
  enemyBlink: pool("enemy/blink-a.mp3", "enemy/blink-b.mp3"),
  enemyWraithSweep: pool("enemy/wraith-sweep-a.mp3", "enemy/wraith-sweep-b.mp3"),
  enemyBomb: pool("enemy/bomb-a.mp3", "enemy/bomb-b.mp3"),
  enemyQueen: pool("enemy/queen-a.mp3", "enemy/queen-b.mp3"),
});

export class CombatSfx {
  constructor(context, destination, {
    fetcher = globalThis.fetch?.bind(globalThis),
    random = Math.random,
    maxSources = MAX_ACTIVE_COMBAT_SOURCES,
  } = {}) {
    this.context = context;
    this.destination = destination;
    this.fetcher = fetcher;
    this.random = random;
    this.maxSources = maxSources;
    this.buffers = new Map();
    this.loading = new Map();
    this.lastVariation = new Map();
    this.active = new Set();
    this.decodeFailures = 0;
    this.disposed = false;
  }

  async preload() {
    if (this.disposed || !this.fetcher) return false;
    const files = [...new Set(Object.values(COMBAT_SFX_CUES).flat())];
    const results = await Promise.allSettled(files.map((file) => this.load(file)));
    this.decodeFailures += results.filter(({ status }) => status === "rejected").length;
    return results.some(({ status }) => status === "fulfilled");
  }

  async load(file) {
    if (this.buffers.has(file)) return this.buffers.get(file);
    if (this.loading.has(file)) return this.loading.get(file);
    const pending = (async () => {
      const response = await this.fetcher(file);
      if (!response?.ok) throw new Error(`Unable to load combat SFX: ${file}`);
      const encoded = await response.arrayBuffer();
      const buffer = await this.context.decodeAudioData(encoded);
      if (!this.disposed) this.buffers.set(file, buffer);
      return buffer;
    })();
    this.loading.set(file, pending);
    try {
      return await pending;
    } finally {
      this.loading.delete(file);
    }
  }

  selectFile(cueKey) {
    const files = COMBAT_SFX_CUES[cueKey]?.filter((file) => this.buffers.has(file));
    if (!files?.length) return null;
    if (files.length === 1) return files[0];
    const previous = this.lastVariation.get(cueKey);
    let index = Math.floor(this.random() * files.length);
    if (files[index] === previous) index = (index + 1) % files.length;
    const selected = files[index];
    this.lastVariation.set(cueKey, selected);
    return selected;
  }

  retryMissing(cueKey) {
    if (this.disposed || !this.fetcher) return;
    const file = COMBAT_SFX_CUES[cueKey]?.find((candidate) => (
      !this.buffers.has(candidate) && !this.loading.has(candidate)
    ));
    if (!file) return;
    void this.load(file).catch(() => {
      this.decodeFailures += 1;
    });
  }

  play(cueKey, {
    destination = this.destination,
    volume = 1,
    playbackRate = 1,
    detune = 0,
    startAt = this.context.currentTime,
  } = {}) {
    if (this.disposed || !destination) return false;
    this.retryMissing(cueKey);
    const file = this.selectFile(cueKey);
    const buffer = this.buffers.get(file);
    if (!file || !buffer) return false;

    while (this.active.size >= this.maxSources) {
      const oldest = this.active.values().next().value;
      this.release(oldest, true);
    }

    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = Math.max(0.5, Math.min(2, Number(playbackRate) || 1));
    if (source.detune) source.detune.value = Math.max(-1200, Math.min(1200, Number(detune) || 0));
    gain.gain.value = Math.max(0, Number(volume) || 0);
    source.connect(gain).connect(destination);
    const record = { cueKey, source, gain, stopping: false };
    source.onended = () => this.release(record);
    this.active.add(record);
    source.start(Math.max(this.context.currentTime, Number(startAt) || 0));
    return true;
  }

  stopCue(cueKey, fadeDuration = 0.04) {
    const now = this.context.currentTime;
    let stopped = false;
    for (const record of this.active) {
      if (record.cueKey !== cueKey || record.stopping) continue;
      record.stopping = true;
      stopped = true;
      const fade = Math.max(0.01, Number(fadeDuration) || 0.04);
      record.gain.gain.cancelScheduledValues(now);
      record.gain.gain.setTargetAtTime(0, now, fade / 3);
      try {
        record.source.stop(now + fade);
      } catch {
        this.release(record);
      }
    }
    return stopped;
  }

  release(record, stop = false) {
    if (!record || !this.active.delete(record)) return;
    if (stop) {
      try {
        record.source.stop(this.context.currentTime);
      } catch {
        // A source that ended between selection and eviction already owns cleanup.
      }
    }
    record.source.disconnect?.();
    record.gain.disconnect?.();
  }

  metrics() {
    return Object.freeze({
      decodedFiles: this.buffers.size,
      loadingFiles: this.loading.size,
      activeSources: this.active.size,
      sourceCap: this.maxSources,
      decodeFailures: this.decodeFailures,
    });
  }

  dispose() {
    this.disposed = true;
    for (const record of [...this.active]) this.release(record, true);
    this.buffers.clear();
    this.loading.clear();
  }
}
