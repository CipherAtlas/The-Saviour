import { BLESSINGS, oathSlotOrderForSeed } from "../game/blessings.js";
import { HARVEST_CONFIG, PLAYER_CONFIG, RUN_CONFIG } from "../game/gameConfig.js";
import { validateRunStatisticsDraft } from "../game/RunStatsAccumulator.js";

export const SUSPENDED_RUN_KEY = "hollow-crown-suspended-run";
export const SUSPENDED_RUN_VERSION = 5;

const DIFFICULTY_IDS = new Set(["relaxed", "standard", "ruthless"]);
const RUN_TYPE_IDS = new Set(["normal", "speedrun"]);
const RUN_FLAG_IDS = new Set(["queenDefeated", "princeKilledByPrincess"]);
const TOP_LEVEL_KEYS = new Set([
  "version",
  "savedAt",
  "seed",
  "difficultyId",
  "runType",
  "speedrun",
  "nextFloor",
  "nextRoom",
  "player",
  "harvestUnits",
  "deathDefiance",
  "blessingIds",
  "runFlags",
  "statisticsDraft",
]);
const LEGACY_TOP_LEVEL_KEYS = new Set([
  ...TOP_LEVEL_KEYS,
  "upgradeSelections",
  "upgradeRanks",
  "rerollsUsedByFloor",
]);
const V2_TOP_LEVEL_KEYS = new Set([
  ...LEGACY_TOP_LEVEL_KEYS,
  "seenRunSequenceIds",
  "completedUpgradeSequenceIds",
]);
const V1_TOP_LEVEL_KEYS = new Set([...V2_TOP_LEVEL_KEYS]
  .filter((key) => !["runType", "speedrun"].includes(key)));

const LEGACY_PATH_BY_ID = Object.freeze({
  "far-reach": "Reaper",
  "grave-edge": "Reaper",
  "harvest-crown": "Reaper",
  "hollow-step": "Shade",
  "perfect-eclipse": "Shade",
  "reaping-passage": "Shade",
  "royal-blood": "Grave",
  "final-mercy": "Grave",
  "soul-siphon": "Grave",
  "moonwell-renewal": "Grave",
});
const OATH_BY_ID = new Map(BLESSINGS.map((definition) => [definition.id, definition]));

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

function createDefaultCatalog() {
  return Object.freeze({
    blessingRanks: new Map(BLESSINGS.map((definition) => [definition.id, definition.maxRank])),
  });
}

function normalizeBlessings(candidate, catalog, seed) {
  if (!Array.isArray(candidate.blessingIds) || candidate.blessingIds.length > RUN_CONFIG.totalFloors - 1) return null;
  const counts = new Map();
  const blessingIds = [];
  const slotOrder = oathSlotOrderForSeed(seed);
  for (let index = 0; index < candidate.blessingIds.length; index += 1) {
    const id = candidate.blessingIds[index];
    const maximum = catalog.blessingRanks.get(id);
    const next = (counts.get(id) ?? 0) + 1;
    const oath = OATH_BY_ID.get(id);
    if (!maximum || !oath || next > maximum) return null;
    if (index < 5 && (next !== 1 || oath.techniqueSlot !== slotOrder[index])) return null;
    if (index >= 5 && (next !== 2 || !blessingIds.slice(0, 5).includes(id))) return null;
    counts.set(id, next);
    blessingIds.push(id);
  }
  return blessingIds;
}

function normalizeFlags(candidate) {
  if (!isRecord(candidate.runFlags)) return null;
  const runFlags = {};
  for (const [key, value] of Object.entries(candidate.runFlags)) {
    if (!RUN_FLAG_IDS.has(key) || typeof value !== "boolean") return null;
    runFlags[key] = value;
  }
  return runFlags;
}

function legacyProgressionPath(id) {
  return OATH_BY_ID.get(id)?.path ?? LEGACY_PATH_BY_ID[id] ?? "Grave";
}

function migrateBlessingIds(ids, seed) {
  if (!Array.isArray(ids)) throw new TypeError("Legacy Oath selections must be an array");
  const slotOrder = oathSlotOrderForSeed(seed);
  const ranks = new Map();
  const owned = [];
  return ids.map((legacyId, index) => {
    const existing = OATH_BY_ID.get(legacyId);
    const desiredPath = legacyProgressionPath(legacyId);
    let definition;
    if (index < 5) {
      definition = existing?.techniqueSlot === slotOrder[index]
        ? existing
        : BLESSINGS.find((candidate) => (
          candidate.techniqueSlot === slotOrder[index] && candidate.path === desiredPath
        ));
    } else {
      definition = existing && owned.includes(existing.id) && (ranks.get(existing.id) ?? 0) === 1
        ? existing
        : owned
          .map((id) => OATH_BY_ID.get(id))
          .find((candidate) => candidate.path === desiredPath && (ranks.get(candidate.id) ?? 0) === 1);
      definition ??= owned
        .map((id) => OATH_BY_ID.get(id))
        .find((candidate) => (ranks.get(candidate.id) ?? 0) === 1);
    }
    if (!definition) throw new TypeError("Unable to migrate Oath progression");
    ranks.set(definition.id, (ranks.get(definition.id) ?? 0) + 1);
    if (!owned.includes(definition.id)) owned.push(definition.id);
    return definition.id;
  });
}

function rebuildStatisticsProgression(statisticsDraft, blessingIds) {
  const draft = clone(statisticsDraft);
  const ranks = {};
  const pathTotals = { Reaper: 0, Shade: 0, Grave: 0 };
  draft.selections = blessingIds.map((id) => {
    const definition = OATH_BY_ID.get(id);
    const rankAfter = (ranks[id] ?? 0) + 1;
    ranks[id] = rankAfter;
    pathTotals[definition.path] += 1;
    return { id, path: definition.path, tier: "blessing", rankAfter };
  });
  draft.finalRanks = ranks;
  draft.pathTotals = pathTotals;
  draft.rerollsUsed = 0;
  draft.deathDefiance = { granted: 0, consumed: 0 };
  return draft;
}

function normalizeLegacyMetadata(candidate) {
  const migrated = clone(candidate);
  delete migrated.seenRunSequenceIds;
  delete migrated.completedUpgradeSequenceIds;
  if (candidate.version === 1) {
    migrated.runType = "normal";
    migrated.speedrun = { elapsedSeconds: 0, finished: false };
  }
  if (migrated.difficultyId === "story") migrated.difficultyId = "relaxed";
  if (migrated.statisticsDraft?.difficultyId === "story") migrated.statisticsDraft.difficultyId = "relaxed";
  if (migrated.statisticsDraft?.version === 1) migrated.statisticsDraft.version = 2;
  const origins = migrated.statisticsDraft?.enemiesKilled?.byOrigin;
  if (isRecord(origins)) {
    const stable = (origins.stable ?? 0) + (origins.witch ?? 0);
    const volatile = (origins.volatile ?? 0) + (origins.princess ?? 0);
    migrated.statisticsDraft.enemiesKilled.byOrigin = {};
    if (stable > 0) migrated.statisticsDraft.enemiesKilled.byOrigin.stable = stable;
    if (volatile > 0) migrated.statisticsDraft.enemiesKilled.byOrigin.volatile = volatile;
  }
  return migrated;
}

function migrateCandidate(candidate) {
  if (!isRecord(candidate) || candidate.version === SUSPENDED_RUN_VERSION) return candidate;
  if (candidate.version === 1 && !hasExactKeys(candidate, V1_TOP_LEVEL_KEYS)) return candidate;
  if (candidate.version === 2 && !hasExactKeys(candidate, V2_TOP_LEVEL_KEYS)) return candidate;
  if ([3, 4].includes(candidate.version) && !hasExactKeys(candidate, LEGACY_TOP_LEVEL_KEYS)) return candidate;
  if (![1, 2, 3, 4].includes(candidate.version)) return candidate;

  const migrated = normalizeLegacyMetadata(candidate);
  const blessingIds = migrateBlessingIds(migrated.blessingIds, migrated.seed);
  migrated.blessingIds = blessingIds;
  migrated.statisticsDraft = rebuildStatisticsProgression(migrated.statisticsDraft, blessingIds);
  migrated.deathDefiance = { granted: 0, remaining: 0 };
  migrated.player.health = Math.min(PLAYER_CONFIG.maxHealth, migrated.player.health);
  delete migrated.upgradeSelections;
  delete migrated.upgradeRanks;
  delete migrated.rerollsUsedByFloor;
  migrated.version = SUSPENDED_RUN_VERSION;
  return migrated;
}

function normalizeCandidate(rawCandidate, catalog) {
  const candidate = migrateCandidate(rawCandidate);
  if (!hasExactKeys(candidate, TOP_LEVEL_KEYS) || candidate.version !== SUSPENDED_RUN_VERSION) return null;
  if (!Number.isFinite(candidate.savedAt) || candidate.savedAt < 0) return null;
  if (typeof candidate.seed !== "string" || candidate.seed.length === 0 || candidate.seed.length > 256) return null;
  if (!DIFFICULTY_IDS.has(candidate.difficultyId) || !RUN_TYPE_IDS.has(candidate.runType)) return null;
  if (candidate.runType === "speedrun" && candidate.difficultyId !== "ruthless") return null;
  if (!hasExactKeys(candidate.speedrun, new Set(["elapsedSeconds", "finished"]))) return null;
  if (!Number.isFinite(candidate.speedrun.elapsedSeconds) || candidate.speedrun.elapsedSeconds < 0) return null;
  if (typeof candidate.speedrun.finished !== "boolean") return null;
  if (candidate.runType === "normal" && (candidate.speedrun.elapsedSeconds !== 0 || candidate.speedrun.finished)) return null;
  if (!Number.isInteger(candidate.nextFloor) || candidate.nextFloor < 1 || candidate.nextFloor > RUN_CONFIG.totalFloors) return null;
  if (!Number.isInteger(candidate.nextRoom) || candidate.nextRoom < 1 || candidate.nextRoom > RUN_CONFIG.roomsPerFloor) return null;
  if (!hasExactKeys(candidate.player, new Set(["health"]))) return null;
  if (!Number.isFinite(candidate.player.health) || candidate.player.health <= 0 || candidate.player.health > PLAYER_CONFIG.maxHealth) return null;
  if (!Number.isInteger(candidate.harvestUnits) || candidate.harvestUnits < 0 || candidate.harvestUnits > HARVEST_CONFIG.maxUnits) return null;
  if (!hasExactKeys(candidate.deathDefiance, new Set(["granted", "remaining"]))) return null;
  if (candidate.deathDefiance.granted !== 0 || candidate.deathDefiance.remaining !== 0) return null;

  const blessingIds = normalizeBlessings(candidate, catalog, candidate.seed);
  const runFlags = normalizeFlags(candidate);
  const statisticsDraft = validateRunStatisticsDraft(candidate.statisticsDraft);
  if (!blessingIds || !runFlags || !statisticsDraft || statisticsDraft.finalized) return null;
  if (statisticsDraft.seed !== candidate.seed || statisticsDraft.difficultyId !== candidate.difficultyId) return null;
  if (blessingIds.length !== candidate.nextFloor - 1) return null;

  const draftBlessings = statisticsDraft.selections.map(({ id, tier }) => tier === "blessing" ? id : null);
  if (draftBlessings.includes(null) || JSON.stringify(draftBlessings) !== JSON.stringify(blessingIds)) return null;
  const ranks = {};
  for (const id of blessingIds) ranks[id] = (ranks[id] ?? 0) + 1;
  const sortedEntries = (record) => Object.entries(record).sort(([left], [right]) => left.localeCompare(right));
  if (JSON.stringify(sortedEntries(ranks)) !== JSON.stringify(sortedEntries(statisticsDraft.finalRanks))) return null;
  if (statisticsDraft.deathDefiance.granted !== 0 || statisticsDraft.deathDefiance.consumed !== 0) return null;
  if (statisticsDraft.rerollsUsed !== 0) return null;

  return deepFreeze({
    version: SUSPENDED_RUN_VERSION,
    savedAt: candidate.savedAt,
    seed: candidate.seed,
    difficultyId: candidate.difficultyId,
    runType: candidate.runType,
    speedrun: { ...candidate.speedrun },
    nextFloor: candidate.nextFloor,
    nextRoom: candidate.nextRoom,
    player: { health: candidate.player.health },
    harvestUnits: candidate.harvestUnits,
    deathDefiance: { granted: 0, remaining: 0 },
    blessingIds,
    runFlags,
    statisticsDraft,
  });
}

export class SuspendedRunStore {
  constructor(storage = globalThis.localStorage, { now = () => Date.now(), catalog = createDefaultCatalog() } = {}) {
    this.storage = storage;
    this.now = now;
    this.catalog = catalog;
    this.lastError = null;
  }

  loadValid() {
    if (!this.storage) return null;
    let raw;
    try {
      raw = this.storage.getItem(SUSPENDED_RUN_KEY);
    } catch {
      this.lastError = "readUnavailable";
      return null;
    }
    if (raw === null) {
      this.lastError = null;
      return null;
    }
    try {
      const value = normalizeCandidate(JSON.parse(raw), this.catalog);
      if (value) {
        this.lastError = null;
        return deepFreeze(clone(value));
      }
    } catch {
      // Invalid records are removed below without exposing their raw contents.
    }
    this.lastError = "invalid";
    try { this.storage.removeItem?.(SUSPENDED_RUN_KEY); } catch { /* Best-effort invalid-slot cleanup. */ }
    return null;
  }

  save(snapshot) {
    const savedAt = this.now();
    const candidate = normalizeCandidate({
      ...clone(snapshot),
      version: SUSPENDED_RUN_VERSION,
      savedAt,
      runType: snapshot?.runType ?? "normal",
      speedrun: snapshot?.speedrun ?? { elapsedSeconds: 0, finished: false },
    }, this.catalog);
    if (!candidate) {
      this.lastError = "invalid";
      return false;
    }
    if (!this.storage) {
      this.lastError = "writeUnavailable";
      return false;
    }
    try {
      this.storage.setItem(SUSPENDED_RUN_KEY, JSON.stringify(candidate));
      this.lastError = null;
      return true;
    } catch {
      this.lastError = "writeUnavailable";
      return false;
    }
  }

  clear() {
    try {
      this.storage?.removeItem?.(SUSPENDED_RUN_KEY);
      this.lastError = null;
      return true;
    } catch {
      this.lastError = "writeUnavailable";
      return false;
    }
  }

  getStatus() {
    return Object.freeze({ storageError: this.lastError });
  }
}

export function validateSuspendedRunSnapshot(candidate, catalog = createDefaultCatalog()) {
  return normalizeCandidate(candidate, catalog);
}
