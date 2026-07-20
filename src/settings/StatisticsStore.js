import {
  RUN_STATISTICS_DIFFICULTIES,
  RUN_STATISTICS_PATHS,
  validateRunStatistics,
} from "../game/RunStatsAccumulator.js";

export const STATISTICS_KEY = "hollow-crown-statistics";
export const STATISTICS_VERSION = 2;

const ENDING_IDS = Object.freeze(["kill", "timeout"]);
const ACTION_IDS = Object.freeze([
  "dashes",
  "perfectDashes",
  "chargedReaps",
  "perfectReleases",
  "claims",
]);
const MAX_RECORDED_RUN_IDS = 10_000;
const TOP_LEVEL_KEYS = new Set([
  "version",
  "totalActivePlaytimeSeconds",
  "attempts",
  "completions",
  "bestCompletionTimeSeconds",
  "deepestFloor",
  "kills",
  "damageDealt",
  "damageTaken",
  "healingReceived",
  "criticalHits",
  "highestHit",
  "actions",
  "boss",
  "upgradeHistory",
  "pathHistory",
  "recordedRunIds",
]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNonnegative(value) {
  return Number.isFinite(value) && value >= 0;
}

function integerNonnegative(value) {
  return Number.isInteger(value) && value >= 0;
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

function difficultyRecord(factory) {
  return Object.fromEntries(RUN_STATISTICS_DIFFICULTIES.map((id) => [id, factory(id)]));
}

function createEmptyStatistics() {
  return {
    version: STATISTICS_VERSION,
    totalActivePlaytimeSeconds: 0,
    attempts: 0,
    completions: difficultyRecord(() => ({ kill: 0, timeout: 0 })),
    bestCompletionTimeSeconds: difficultyRecord(() => null),
    deepestFloor: difficultyRecord(() => 0),
    kills: { byType: {}, byOrigin: {} },
    damageDealt: 0,
    damageTaken: 0,
    healingReceived: 0,
    criticalHits: 0,
    highestHit: 0,
    actions: Object.fromEntries(ACTION_IDS.map((id) => [id, 0])),
    boss: { attempts: 0, clears: 0 },
    upgradeHistory: {},
    pathHistory: Object.fromEntries(RUN_STATISTICS_PATHS.map((path) => [path, {
      runsSelected: 0,
      totalRanks: 0,
      byDifficulty: difficultyRecord(() => 0),
    }])),
    recordedRunIds: [],
  };
}

function migrateDifficultyRecord(record, fallback) {
  if (!isRecord(record)) return record;
  return {
    relaxed: record.relaxed ?? record.story ?? fallback,
    standard: record.standard ?? fallback,
    ruthless: record.ruthless ?? fallback,
  };
}

function migrateStatistics(candidate) {
  if (!isRecord(candidate) || candidate.version !== 1) return candidate;
  const migrated = clone(candidate);
  migrated.version = STATISTICS_VERSION;
  migrated.completions = migrateDifficultyRecord(migrated.completions, { kill: 0, timeout: 0 });
  migrated.bestCompletionTimeSeconds = migrateDifficultyRecord(migrated.bestCompletionTimeSeconds, null);
  migrated.deepestFloor = migrateDifficultyRecord(migrated.deepestFloor, 0);
  for (const history of Object.values(migrated.upgradeHistory ?? {})) {
    history.byDifficulty = migrateDifficultyRecord(history.byDifficulty, 0);
  }
  for (const history of Object.values(migrated.pathHistory ?? {})) {
    history.byDifficulty = migrateDifficultyRecord(history.byDifficulty, 0);
  }
  const origins = migrated.kills?.byOrigin;
  if (isRecord(origins)) {
    const stable = (origins.stable ?? 0) + (origins.witch ?? 0);
    const volatile = (origins.volatile ?? 0) + (origins.princess ?? 0);
    migrated.kills.byOrigin = {};
    if (stable > 0) migrated.kills.byOrigin.stable = stable;
    if (volatile > 0) migrated.kills.byOrigin.volatile = volatile;
  }
  return migrated;
}

function validCountMap(value) {
  return isRecord(value) && Object.entries(value).every(([key, count]) => (
    key.length > 0 && integerNonnegative(count)
  ));
}

function validDifficultyRecord(value, validator) {
  return isRecord(value)
    && Object.keys(value).length === RUN_STATISTICS_DIFFICULTIES.length
    && RUN_STATISTICS_DIFFICULTIES.every((id) => validator(value[id]));
}

function validUpgradeHistory(value) {
  return isRecord(value) && Object.entries(value).every(([id, history]) => (
    id.length > 0
    && hasExactKeys(history, new Set(["selections", "totalRanks", "byDifficulty"]))
    && integerNonnegative(history.selections)
    && integerNonnegative(history.totalRanks)
    && validDifficultyRecord(history.byDifficulty, integerNonnegative)
  ));
}

function validPathHistory(value) {
  return isRecord(value)
    && Object.keys(value).length === RUN_STATISTICS_PATHS.length
    && RUN_STATISTICS_PATHS.every((path) => {
      const history = value[path];
      return hasExactKeys(history, new Set(["runsSelected", "totalRanks", "byDifficulty"]))
        && integerNonnegative(history.runsSelected)
        && integerNonnegative(history.totalRanks)
        && validDifficultyRecord(history.byDifficulty, integerNonnegative);
    });
}

export function validateLifetimeStatistics(candidate) {
  const valid = hasExactKeys(candidate, TOP_LEVEL_KEYS)
    && candidate.version === STATISTICS_VERSION
    && finiteNonnegative(candidate.totalActivePlaytimeSeconds)
    && integerNonnegative(candidate.attempts)
    && validDifficultyRecord(candidate.completions, (entry) => (
      hasExactKeys(entry, new Set(ENDING_IDS)) && ENDING_IDS.every((id) => integerNonnegative(entry[id]))
    ))
    && validDifficultyRecord(candidate.bestCompletionTimeSeconds, (value) => (
      value === null || finiteNonnegative(value)
    ))
    && validDifficultyRecord(candidate.deepestFloor, (value) => (
      Number.isInteger(value) && value >= 0 && value <= 10
    ))
    && hasExactKeys(candidate.kills, new Set(["byType", "byOrigin"]))
    && validCountMap(candidate.kills.byType)
    && validCountMap(candidate.kills.byOrigin)
    && finiteNonnegative(candidate.damageDealt)
    && finiteNonnegative(candidate.damageTaken)
    && finiteNonnegative(candidate.healingReceived)
    && integerNonnegative(candidate.criticalHits)
    && finiteNonnegative(candidate.highestHit)
    && hasExactKeys(candidate.actions, new Set(ACTION_IDS))
    && ACTION_IDS.every((id) => integerNonnegative(candidate.actions[id]))
    && hasExactKeys(candidate.boss, new Set(["attempts", "clears"]))
    && integerNonnegative(candidate.boss.attempts)
    && integerNonnegative(candidate.boss.clears)
    && candidate.boss.clears <= candidate.boss.attempts
    && validUpgradeHistory(candidate.upgradeHistory)
    && validPathHistory(candidate.pathHistory)
    && Array.isArray(candidate.recordedRunIds)
    && candidate.recordedRunIds.length <= MAX_RECORDED_RUN_IDS
    && candidate.recordedRunIds.every((id) => typeof id === "string" && id.length > 0 && id.length <= 256)
    && new Set(candidate.recordedRunIds).size === candidate.recordedRunIds.length;
  return valid ? deepFreeze(clone(candidate)) : null;
}

function addMap(target, additions) {
  for (const [key, amount] of Object.entries(additions)) {
    target[key] = (target[key] ?? 0) + amount;
  }
}

function favoriteEntry(record) {
  const entries = Object.entries(record).filter(([, value]) => value > 0);
  if (entries.length === 0) return null;
  entries.sort(([leftId, left], [rightId, right]) => right - left || leftId.localeCompare(rightId));
  return entries[0][0];
}

export function deriveStatisticsView(snapshot) {
  const valid = validateLifetimeStatistics(snapshot);
  if (!valid) return null;
  const completions = Object.values(valid.completions)
    .reduce((total, byEnding) => total + byEnding.kill + byEnding.timeout, 0);
  const upgradeSelections = Object.fromEntries(
    Object.entries(valid.upgradeHistory).map(([id, history]) => [id, history.selections]),
  );
  const pathTotals = Object.fromEntries(
    Object.entries(valid.pathHistory).map(([path, history]) => [path, history.totalRanks]),
  );
  return deepFreeze({
    attempts: valid.attempts,
    completions,
    completionRate: valid.attempts > 0 ? completions / valid.attempts : 0,
    favoriteMajorAction: favoriteEntry(valid.actions),
    mostSelectedUpgrade: favoriteEntry(upgradeSelections),
    preferredPath: favoriteEntry(pathTotals),
  });
}

export class StatisticsStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.listeners = new Set();
    this.lastError = null;
    this.values = this.load();
  }

  load() {
    if (!this.storage) return createEmptyStatistics();
    try {
      const raw = this.storage.getItem(STATISTICS_KEY);
      if (raw === null) return createEmptyStatistics();
      const value = validateLifetimeStatistics(migrateStatistics(JSON.parse(raw)));
      if (value) return clone(value);
      this.lastError = "invalid";
    } catch {
      this.lastError = "readUnavailable";
    }
    return createEmptyStatistics();
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

  recordActivePlaytime(seconds) {
    if (!finiteNonnegative(seconds) || seconds === 0) return false;
    this.values.totalActivePlaytimeSeconds += seconds;
    return true;
  }

  recordCompletedRun(runStatistics) {
    const run = validateRunStatistics(runStatistics);
    if (!run || this.values.recordedRunIds.includes(run.runId)) return false;
    if (this.values.recordedRunIds.length >= MAX_RECORDED_RUN_IDS) {
      this.lastError = "dedupeCapacity";
      return false;
    }

    const difficulty = run.difficultyId;
    this.values.recordedRunIds.push(run.runId);
    this.values.attempts += 1;
    this.values.deepestFloor[difficulty] = Math.max(this.values.deepestFloor[difficulty], run.deepestFloor);
    if (run.terminal.kind === "ending") {
      this.values.completions[difficulty][run.terminal.id] += 1;
      const previousBest = this.values.bestCompletionTimeSeconds[difficulty];
      this.values.bestCompletionTimeSeconds[difficulty] = previousBest === null
        ? run.durationSeconds
        : Math.min(previousBest, run.durationSeconds);
    }
    addMap(this.values.kills.byType, run.enemiesKilled.byType);
    addMap(this.values.kills.byOrigin, run.enemiesKilled.byOrigin);
    this.values.damageDealt += run.damageDealt;
    this.values.damageTaken += run.damageTaken;
    this.values.healingReceived += run.healingReceived;
    this.values.criticalHits += run.criticalHits;
    this.values.highestHit = Math.max(this.values.highestHit, run.highestHit);
    for (const id of ACTION_IDS) this.values.actions[id] += run.actions[id];
    if (run.boss.attempted) this.values.boss.attempts += 1;
    if (run.boss.cleared) this.values.boss.clears += 1;

    for (const selection of run.selections) {
      const history = this.values.upgradeHistory[selection.id] ?? {
        selections: 0,
        totalRanks: 0,
        byDifficulty: difficultyRecord(() => 0),
      };
      history.selections += 1;
      history.byDifficulty[difficulty] += 1;
      this.values.upgradeHistory[selection.id] = history;
    }
    for (const [id, rank] of Object.entries(run.finalRanks)) {
      this.values.upgradeHistory[id].totalRanks += rank;
    }
    for (const path of RUN_STATISTICS_PATHS) {
      const total = run.pathTotals[path];
      if (total > 0) this.values.pathHistory[path].runsSelected += 1;
      this.values.pathHistory[path].totalRanks += total;
      this.values.pathHistory[path].byDifficulty[difficulty] += total;
    }

    this.persistAndNotify();
    return true;
  }

  flush() {
    return this.persistAndNotify();
  }

  reset() {
    this.values = createEmptyStatistics();
    try {
      this.storage?.removeItem?.(STATISTICS_KEY);
      this.lastError = null;
    } catch {
      this.lastError = "writeUnavailable";
    }
    this.notify();
  }

  persistAndNotify() {
    let persisted = true;
    try {
      this.storage?.setItem(STATISTICS_KEY, JSON.stringify(this.values));
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
