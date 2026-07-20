export const SPEEDRUN_RECORDS_KEY = "hollow-crown-speedrun-records";
export const SPEEDRUN_RECORDS_VERSION = 1;

const MAX_RECORDED_RUN_IDS = 10_000;
const TOP_LEVEL_KEYS = new Set([
  "version",
  "attempts",
  "completions",
  "best",
  "recordedRunIds",
]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  return isRecord(value)
    && Object.keys(value).length === keys.size
    && Object.keys(value).every((key) => keys.has(key));
}

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function emptyRecords() {
  return {
    version: SPEEDRUN_RECORDS_VERSION,
    attempts: 0,
    completions: 0,
    best: null,
    recordedRunIds: [],
  };
}

function validBest(best) {
  return best === null || (
    hasExactKeys(best, new Set(["timeSeconds", "seed", "ending"]))
    && Number.isFinite(best.timeSeconds)
    && best.timeSeconds >= 0
    && typeof best.seed === "string"
    && best.seed.length > 0
    && best.seed.length <= 256
    && ["kill", "timeout"].includes(best.ending)
  );
}

export function validateSpeedrunRecords(candidate) {
  const valid = hasExactKeys(candidate, TOP_LEVEL_KEYS)
    && candidate.version === SPEEDRUN_RECORDS_VERSION
    && Number.isInteger(candidate.attempts)
    && candidate.attempts >= 0
    && Number.isInteger(candidate.completions)
    && candidate.completions >= 0
    && candidate.completions <= candidate.attempts
    && validBest(candidate.best)
    && Array.isArray(candidate.recordedRunIds)
    && candidate.recordedRunIds.length <= MAX_RECORDED_RUN_IDS
    && candidate.recordedRunIds.every((id) => typeof id === "string" && id.length > 0 && id.length <= 256)
    && new Set(candidate.recordedRunIds).size === candidate.recordedRunIds.length;
  return valid ? deepFreeze(clone(candidate)) : null;
}

function validRun(run) {
  return isRecord(run)
    && run.runType === "speedrun"
    && typeof run.runId === "string"
    && run.runId.length > 0
    && run.runId.length <= 256
    && typeof run.seed === "string"
    && run.seed.length > 0
    && run.seed.length <= 256
    && typeof run.speedrunFinished === "boolean"
    && isRecord(run.terminal);
}

export class SpeedrunRecordsStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.listeners = new Set();
    this.lastError = null;
    this.values = this.load();
  }

  load() {
    if (!this.storage) return emptyRecords();
    try {
      const raw = this.storage.getItem(SPEEDRUN_RECORDS_KEY);
      if (raw === null) return emptyRecords();
      const value = validateSpeedrunRecords(JSON.parse(raw));
      if (value) return clone(value);
      this.lastError = "invalid";
    } catch {
      this.lastError = "readUnavailable";
    }
    return emptyRecords();
  }

  getSnapshot() {
    return deepFreeze(clone(this.values));
  }

  getStatus() {
    return Object.freeze({ storageError: this.lastError });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  recordRun(run) {
    if (!validRun(run) || this.values.recordedRunIds.includes(run.runId)) {
      return Object.freeze({ recorded: false, newBest: false });
    }
    if (this.values.recordedRunIds.length >= MAX_RECORDED_RUN_IDS) {
      this.lastError = "dedupeCapacity";
      return Object.freeze({ recorded: false, newBest: false });
    }

    this.values.recordedRunIds.push(run.runId);
    this.values.attempts += 1;
    let newBest = false;
    if (
      run.speedrunFinished
      && run.terminal.kind === "ending"
      && ["kill", "timeout"].includes(run.terminal.id)
      && Number.isFinite(run.speedrunTimeSeconds)
      && run.speedrunTimeSeconds >= 0
    ) {
      this.values.completions += 1;
      if (this.values.best === null || run.speedrunTimeSeconds < this.values.best.timeSeconds) {
        this.values.best = {
          timeSeconds: run.speedrunTimeSeconds,
          seed: run.seed,
          ending: run.terminal.id,
        };
        newBest = true;
      }
    }
    this.persistAndNotify();
    return Object.freeze({ recorded: true, newBest });
  }

  reset() {
    this.values = emptyRecords();
    try {
      this.storage?.removeItem?.(SPEEDRUN_RECORDS_KEY);
      this.lastError = null;
    } catch {
      this.lastError = "writeUnavailable";
    }
    this.notify();
  }

  persistAndNotify() {
    let persisted = true;
    try {
      this.storage?.setItem(SPEEDRUN_RECORDS_KEY, JSON.stringify(this.values));
      if (this.storage) this.lastError = null;
    } catch {
      this.lastError = "writeUnavailable";
      persisted = false;
    }
    this.notify();
    return persisted;
  }

  notify() {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}
