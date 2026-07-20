export const SPEEDRUN_RECORDS_KEY = "hollow-crown-speedrun-records";
export const SPEEDRUN_RECORDS_VERSION = 2;
export const SPEEDRUN_LEADERBOARD_LIMIT = 10;

const MAX_RECORDED_RUN_IDS = 10_000;
const TOP_LEVEL_KEYS = new Set([
  "version",
  "attempts",
  "completions",
  "leaderboard",
  "recordedRunIds",
]);
const LEGACY_TOP_LEVEL_KEYS = new Set([
  "version",
  "attempts",
  "completions",
  "best",
  "recordedRunIds",
]);
const RECORD_KEYS = new Set(["timeSeconds", "seed", "ending"]);

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
    leaderboard: [],
    recordedRunIds: [],
  };
}

function validRecord(record) {
  return hasExactKeys(record, RECORD_KEYS)
    && Number.isFinite(record.timeSeconds)
    && record.timeSeconds >= 0
    && typeof record.seed === "string"
    && record.seed.length > 0
    && record.seed.length <= 256
    && ["kill", "timeout"].includes(record.ending);
}

function validCounts(candidate) {
  return Number.isInteger(candidate.attempts)
    && candidate.attempts >= 0
    && Number.isInteger(candidate.completions)
    && candidate.completions >= 0
    && candidate.completions <= candidate.attempts;
}

function validRecordedRunIds(recordedRunIds) {
  return Array.isArray(recordedRunIds)
    && recordedRunIds.length <= MAX_RECORDED_RUN_IDS
    && recordedRunIds.every((id) => typeof id === "string" && id.length > 0 && id.length <= 256)
    && new Set(recordedRunIds).size === recordedRunIds.length;
}

function validLegacyRecords(candidate) {
  return hasExactKeys(candidate, LEGACY_TOP_LEVEL_KEYS)
    && candidate.version === 1
    && validCounts(candidate)
    && (candidate.best === null || validRecord(candidate.best))
    && validRecordedRunIds(candidate.recordedRunIds);
}

function migrateSpeedrunRecords(candidate) {
  if (!isRecord(candidate)) return null;
  if (candidate.version === SPEEDRUN_RECORDS_VERSION) return candidate;
  if (!validLegacyRecords(candidate)) return null;
  return {
    version: SPEEDRUN_RECORDS_VERSION,
    attempts: candidate.attempts,
    completions: candidate.completions,
    leaderboard: candidate.best === null ? [] : [clone(candidate.best)],
    recordedRunIds: [...candidate.recordedRunIds],
  };
}

export function validateSpeedrunRecords(candidate) {
  const valid = hasExactKeys(candidate, TOP_LEVEL_KEYS)
    && candidate.version === SPEEDRUN_RECORDS_VERSION
    && validCounts(candidate)
    && Array.isArray(candidate.leaderboard)
    && candidate.leaderboard.length <= SPEEDRUN_LEADERBOARD_LIMIT
    && candidate.leaderboard.length <= candidate.completions
    && candidate.leaderboard.every(validRecord)
    && candidate.leaderboard.every((entry, index) => (
      index === 0 || candidate.leaderboard[index - 1].timeSeconds <= entry.timeSeconds
    ))
    && validRecordedRunIds(candidate.recordedRunIds);
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
      const parsed = JSON.parse(raw);
      const value = validateSpeedrunRecords(migrateSpeedrunRecords(parsed));
      if (value) {
        if (parsed.version !== SPEEDRUN_RECORDS_VERSION) {
          try {
            this.storage.setItem(SPEEDRUN_RECORDS_KEY, JSON.stringify(value));
          } catch {
            this.lastError = "writeUnavailable";
          }
        }
        return clone(value);
      }
      this.lastError = "invalid";
    } catch {
      this.lastError = "readUnavailable";
    }
    return emptyRecords();
  }

  getSnapshot() {
    const snapshot = clone(this.values);
    snapshot.best = snapshot.leaderboard[0] ? clone(snapshot.leaderboard[0]) : null;
    return deepFreeze(snapshot);
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
      return Object.freeze({ recorded: false, newBest: false, leaderboardRank: null });
    }
    if (this.values.recordedRunIds.length >= MAX_RECORDED_RUN_IDS) {
      this.lastError = "dedupeCapacity";
      return Object.freeze({ recorded: false, newBest: false, leaderboardRank: null });
    }

    this.values.recordedRunIds.push(run.runId);
    this.values.attempts += 1;
    let newBest = false;
    let leaderboardRank = null;
    if (
      run.speedrunFinished
      && run.terminal.kind === "ending"
      && ["kill", "timeout"].includes(run.terminal.id)
      && Number.isFinite(run.speedrunTimeSeconds)
      && run.speedrunTimeSeconds >= 0
    ) {
      this.values.completions += 1;
      const previousBestTime = this.values.leaderboard[0]?.timeSeconds ?? Number.POSITIVE_INFINITY;
      const entry = {
        timeSeconds: run.speedrunTimeSeconds,
        seed: run.seed,
        ending: run.terminal.id,
      };
      const ranked = [...this.values.leaderboard, entry]
        .sort((left, right) => left.timeSeconds - right.timeSeconds);
      const rankIndex = ranked.indexOf(entry);
      if (rankIndex < SPEEDRUN_LEADERBOARD_LIMIT) leaderboardRank = rankIndex + 1;
      this.values.leaderboard = ranked.slice(0, SPEEDRUN_LEADERBOARD_LIMIT);
      newBest = run.speedrunTimeSeconds < previousBestTime;
    }
    this.persistAndNotify();
    return Object.freeze({ recorded: true, newBest, leaderboardRank });
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
