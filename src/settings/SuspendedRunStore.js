import { BLESSINGS, BLESSING_FALLBACK } from "../game/blessings.js";
import { NARRATIVE_SEQUENCES, UPGRADE_SEQUENCE_IDS } from "../game/dialogueContent.js";
import { HARVEST_CONFIG, RUN_CONFIG } from "../game/gameConfig.js";
import { CHAMBER_FALLBACK, RUN_UPGRADES } from "../game/runUpgrades.js";
import { validateRunStatisticsDraft } from "../game/RunStatsAccumulator.js";

export const SUSPENDED_RUN_KEY = "hollow-crown-suspended-run";
export const SUSPENDED_RUN_VERSION = 1;

const DIFFICULTY_IDS = new Set(["story", "standard", "ruthless"]);
const RUN_FLAG_IDS = new Set(["queenDefeated", "princeKilledByPrincess"]);
const TOP_LEVEL_KEYS = new Set([
  "version",
  "savedAt",
  "seed",
  "difficultyId",
  "nextFloor",
  "nextRoom",
  "player",
  "harvestUnits",
  "deathDefiance",
  "upgradeSelections",
  "upgradeRanks",
  "blessingIds",
  "rerollsUsedByFloor",
  "runFlags",
  "seenRunSequenceIds",
  "completedUpgradeSequenceIds",
  "statisticsDraft",
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

function validId(value, ids) {
  return typeof value === "string" && ids.has(value);
}

function uniqueStrings(values) {
  return Array.isArray(values)
    && values.every((value) => typeof value === "string")
    && new Set(values).size === values.length;
}

function maxRankFor(definition, selectionLimit) {
  return Number.isFinite(definition.maxRank) ? definition.maxRank : selectionLimit;
}

function createDefaultCatalog() {
  return Object.freeze({
    upgradeRanks: new Map(
      [...RUN_UPGRADES, CHAMBER_FALLBACK].map((definition) => [
        definition.id,
        maxRankFor(definition, RUN_CONFIG.totalFloors * RUN_CONFIG.roomsPerFloor),
      ]),
    ),
    blessingRanks: new Map(
      [...BLESSINGS, BLESSING_FALLBACK].map((definition) => [
        definition.id,
        maxRankFor(definition, RUN_CONFIG.totalFloors - 1),
      ]),
    ),
    sequenceIds: new Set(Object.keys(NARRATIVE_SEQUENCES)),
    upgradeSequenceIds: new Set(UPGRADE_SEQUENCE_IDS),
  });
}

function normalizeUpgradeState(candidate, catalog) {
  if (!Array.isArray(candidate.upgradeSelections) || candidate.upgradeSelections.length > 29) return null;
  const computedRanks = new Map();
  const upgradeSelections = [];
  for (const selection of candidate.upgradeSelections) {
    if (!hasExactKeys(selection, new Set(["upgradeId", "rankAfter"]))) return null;
    const maximum = catalog.upgradeRanks.get(selection.upgradeId);
    const expected = (computedRanks.get(selection.upgradeId) ?? 0) + 1;
    if (!maximum || selection.rankAfter !== expected || selection.rankAfter > maximum) return null;
    computedRanks.set(selection.upgradeId, selection.rankAfter);
    upgradeSelections.push({ upgradeId: selection.upgradeId, rankAfter: selection.rankAfter });
  }

  if (!Array.isArray(candidate.upgradeRanks) || candidate.upgradeRanks.length !== computedRanks.size) return null;
  const rankEntries = [];
  const seen = new Set();
  for (const entry of candidate.upgradeRanks) {
    if (!Array.isArray(entry) || entry.length !== 2) return null;
    const [upgradeId, rank] = entry;
    if (seen.has(upgradeId) || computedRanks.get(upgradeId) !== rank) return null;
    seen.add(upgradeId);
    rankEntries.push([upgradeId, rank]);
  }
  rankEntries.sort(([left], [right]) => left.localeCompare(right));
  return { upgradeSelections, upgradeRanks: rankEntries };
}

function normalizeBlessings(candidate, catalog) {
  if (!Array.isArray(candidate.blessingIds) || candidate.blessingIds.length > RUN_CONFIG.totalFloors - 1) return null;
  const counts = new Map();
  const blessingIds = [];
  for (const id of candidate.blessingIds) {
    const maximum = catalog.blessingRanks.get(id);
    const next = (counts.get(id) ?? 0) + 1;
    if (!maximum || next > maximum) return null;
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

function normalizeNarrative(candidate, catalog) {
  if (!uniqueStrings(candidate.seenRunSequenceIds)) return null;
  if (!candidate.seenRunSequenceIds.every((id) => catalog.sequenceIds.has(id))) return null;
  if (!uniqueStrings(candidate.completedUpgradeSequenceIds)) return null;
  const seen = new Set(candidate.seenRunSequenceIds);
  if (!candidate.completedUpgradeSequenceIds.every((id) => (
    catalog.upgradeSequenceIds.has(id) && seen.has(id)
  ))) return null;
  return {
    seenRunSequenceIds: [...candidate.seenRunSequenceIds].sort(),
    completedUpgradeSequenceIds: [...candidate.completedUpgradeSequenceIds].sort(),
  };
}

function normalizeCandidate(candidate, catalog) {
  if (!hasExactKeys(candidate, TOP_LEVEL_KEYS)) return null;
  if (candidate.version !== SUSPENDED_RUN_VERSION) return null;
  if (!Number.isFinite(candidate.savedAt) || candidate.savedAt < 0) return null;
  if (typeof candidate.seed !== "string" || candidate.seed.length === 0 || candidate.seed.length > 256) return null;
  if (!DIFFICULTY_IDS.has(candidate.difficultyId)) return null;
  if (!Number.isInteger(candidate.nextFloor) || candidate.nextFloor < 1 || candidate.nextFloor > RUN_CONFIG.totalFloors) return null;
  if (!Number.isInteger(candidate.nextRoom) || candidate.nextRoom < 1 || candidate.nextRoom > RUN_CONFIG.roomsPerFloor) return null;
  if (!hasExactKeys(candidate.player, new Set(["health"]))) return null;
  if (!Number.isFinite(candidate.player.health) || candidate.player.health <= 0 || candidate.player.health > 10_000) return null;
  if (!Number.isInteger(candidate.harvestUnits) || candidate.harvestUnits < 0 || candidate.harvestUnits > HARVEST_CONFIG.maxUnits) return null;
  if (!hasExactKeys(candidate.deathDefiance, new Set(["granted", "remaining"]))) return null;
  if (
    !Number.isInteger(candidate.deathDefiance.granted)
    || !Number.isInteger(candidate.deathDefiance.remaining)
    || candidate.deathDefiance.granted < 0
    || candidate.deathDefiance.granted > 2
    || candidate.deathDefiance.remaining < 0
    || candidate.deathDefiance.remaining > candidate.deathDefiance.granted
  ) return null;
  if (
    !Array.isArray(candidate.rerollsUsedByFloor)
    || candidate.rerollsUsedByFloor.length !== RUN_CONFIG.totalFloors
    || !candidate.rerollsUsedByFloor.every((count) => count === 0 || count === 1)
  ) return null;

  const upgrades = normalizeUpgradeState(candidate, catalog);
  const blessingIds = normalizeBlessings(candidate, catalog);
  const runFlags = normalizeFlags(candidate);
  const narrative = normalizeNarrative(candidate, catalog);
  const statisticsDraft = validateRunStatisticsDraft(candidate.statisticsDraft);
  if (!upgrades || !blessingIds || !runFlags || !narrative || !statisticsDraft || statisticsDraft.finalized) return null;
  if (statisticsDraft.seed !== candidate.seed || statisticsDraft.difficultyId !== candidate.difficultyId) return null;
  const expectedChamberSelections = (candidate.nextFloor - 1) * (RUN_CONFIG.roomsPerFloor - 1) + (candidate.nextRoom - 1);
  const expectedBlessings = candidate.nextFloor - 1;
  if (upgrades.upgradeSelections.length !== expectedChamberSelections || blessingIds.length !== expectedBlessings) return null;

  const draftChambers = statisticsDraft.selections
    .filter(({ tier }) => tier === "chamber")
    .map(({ id, rankAfter }) => ({ upgradeId: id, rankAfter }));
  const draftBlessings = statisticsDraft.selections
    .filter(({ tier }) => tier === "blessing")
    .map(({ id }) => id);
  if (
    JSON.stringify(draftChambers) !== JSON.stringify(upgrades.upgradeSelections)
    || JSON.stringify(draftBlessings) !== JSON.stringify(blessingIds)
  ) return null;

  const mergedRanks = Object.fromEntries(upgrades.upgradeRanks);
  for (const id of blessingIds) mergedRanks[id] = (mergedRanks[id] ?? 0) + 1;
  const sortedRankEntries = (record) => Object.entries(record).sort(([left], [right]) => left.localeCompare(right));
  if (JSON.stringify(sortedRankEntries(mergedRanks)) !== JSON.stringify(sortedRankEntries(statisticsDraft.finalRanks))) return null;
  if (
    statisticsDraft.deathDefiance.granted !== candidate.deathDefiance.granted
    || statisticsDraft.deathDefiance.consumed !== candidate.deathDefiance.granted - candidate.deathDefiance.remaining
    || statisticsDraft.rerollsUsed !== candidate.rerollsUsedByFloor.reduce((total, used) => total + used, 0)
  ) return null;

  const expectedCompletedIds = [...UPGRADE_SEQUENCE_IDS]
    .slice(0, statisticsDraft.selections.length)
    .sort();
  if (JSON.stringify(narrative.completedUpgradeSequenceIds) !== JSON.stringify(expectedCompletedIds)) return null;

  return deepFreeze({
    version: SUSPENDED_RUN_VERSION,
    savedAt: candidate.savedAt,
    seed: candidate.seed,
    difficultyId: candidate.difficultyId,
    nextFloor: candidate.nextFloor,
    nextRoom: candidate.nextRoom,
    player: { health: candidate.player.health },
    harvestUnits: candidate.harvestUnits,
    deathDefiance: { ...candidate.deathDefiance },
    ...upgrades,
    blessingIds,
    rerollsUsedByFloor: [...candidate.rerollsUsedByFloor],
    runFlags,
    ...narrative,
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
