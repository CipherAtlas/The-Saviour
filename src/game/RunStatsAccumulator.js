const RUN_STATS_VERSION = 1;
const DIFFICULTY_IDS = Object.freeze(["story", "standard", "ruthless"]);
const PATH_IDS = Object.freeze(["Reaper", "Shade", "Grave"]);
const ORIGIN_IDS = Object.freeze(["witch", "princess"]);
const RUN_TIME_PHASES = new Set([
  "playing",
  "portalTraversal",
  "dialogue",
  "endingChoice",
  "endingStrike",
  "endingFade",
]);
const COMBAT_PHASES = new Set(["playing"]);
const PAUSED_PHASES = new Set(["paused"]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNonnegative(value) {
  return Number.isFinite(value) && value >= 0;
}

function integerNonnegative(value) {
  return Number.isInteger(value) && value >= 0;
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

function addToMap(record, key, amount = 1) {
  if (typeof key !== "string" || key.length === 0 || !finiteNonnegative(amount)) return;
  record[key] = (record[key] ?? 0) + amount;
}

function emptyDraft({ runId, seed, difficultyId, startedAt }) {
  return {
    version: RUN_STATS_VERSION,
    runId,
    seed,
    difficultyId,
    startedAt,
    finalized: false,
    durationSeconds: 0,
    combatSeconds: 0,
    activePlaytimeSeconds: 0,
    deepestFloor: 1,
    roomsCleared: 0,
    enemiesKilled: { byType: {}, byOrigin: {} },
    damageDealt: 0,
    damageTaken: 0,
    healingReceived: 0,
    criticalHits: 0,
    highestHit: 0,
    actions: {
      dashes: 0,
      perfectDashes: 0,
      chargedReaps: 0,
      perfectReleases: 0,
      claims: 0,
    },
    harvest: { generated: 0, spent: 0 },
    deathDefiance: { granted: 0, consumed: 0 },
    selections: [],
    finalRanks: {},
    rerollsUsed: 0,
    pathTotals: { Reaper: 0, Shade: 0, Grave: 0 },
    boss: {
      attempted: false,
      active: false,
      activeSeconds: 0,
      cleared: false,
      clearTimeSeconds: null,
    },
    terminal: null,
  };
}

function validCountMap(value) {
  return isRecord(value) && Object.entries(value).every(([key, count]) => (
    key.length > 0 && integerNonnegative(count)
  ));
}

function progressionTotals(selections) {
  if (!Array.isArray(selections) || selections.length > 64) return null;
  const finalRanks = {};
  const pathTotals = { Reaper: 0, Shade: 0, Grave: 0 };
  for (const selection of selections) {
    if (
      !isRecord(selection)
      || typeof selection.id !== "string"
      || selection.id.length === 0
      || !PATH_IDS.includes(selection.path)
      || !["chamber", "blessing"].includes(selection.tier)
      || !Number.isInteger(selection.rankAfter)
      || selection.rankAfter < 1
      || selection.rankAfter > 30
      || selection.rankAfter !== (finalRanks[selection.id] ?? 0) + 1
    ) return null;
    finalRanks[selection.id] = selection.rankAfter;
    pathTotals[selection.path] += 1;
  }
  return { finalRanks, pathTotals };
}

function sameCountMap(left, right) {
  const entries = (value) => Object.entries(value)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  return JSON.stringify(entries(left)) === JSON.stringify(entries(right));
}

function validTerminal(value, finalized) {
  if (!finalized) return value === null;
  if (!isRecord(value)) return false;
  if (value.kind === "ending") return ["kill", "timeout"].includes(value.id);
  return value.kind === "death" && typeof value.cause === "string" && value.cause.length > 0;
}

export function validateRunStatisticsDraft(candidate) {
  if (!isRecord(candidate)) return null;
  const progression = progressionTotals(candidate.selections);
  const valid = candidate.version === RUN_STATS_VERSION
    && typeof candidate.runId === "string"
    && candidate.runId.length > 0
    && candidate.runId.length <= 256
    && typeof candidate.seed === "string"
    && candidate.seed.length > 0
    && candidate.seed.length <= 256
    && DIFFICULTY_IDS.includes(candidate.difficultyId)
    && finiteNonnegative(candidate.startedAt)
    && typeof candidate.finalized === "boolean"
    && finiteNonnegative(candidate.durationSeconds)
    && finiteNonnegative(candidate.combatSeconds)
    && candidate.combatSeconds <= candidate.durationSeconds
    && finiteNonnegative(candidate.activePlaytimeSeconds)
    && candidate.activePlaytimeSeconds >= candidate.durationSeconds
    && Number.isInteger(candidate.deepestFloor)
    && candidate.deepestFloor >= 1
    && candidate.deepestFloor <= 10
    && integerNonnegative(candidate.roomsCleared)
    && candidate.roomsCleared <= 30
    && isRecord(candidate.enemiesKilled)
    && validCountMap(candidate.enemiesKilled.byType)
    && validCountMap(candidate.enemiesKilled.byOrigin)
    && Object.keys(candidate.enemiesKilled.byOrigin).every((origin) => ORIGIN_IDS.includes(origin))
    && finiteNonnegative(candidate.damageDealt)
    && finiteNonnegative(candidate.damageTaken)
    && finiteNonnegative(candidate.healingReceived)
    && integerNonnegative(candidate.criticalHits)
    && finiteNonnegative(candidate.highestHit)
    && candidate.highestHit <= candidate.damageDealt
    && isRecord(candidate.actions)
    && ["dashes", "perfectDashes", "chargedReaps", "perfectReleases", "claims"]
      .every((key) => integerNonnegative(candidate.actions[key]))
    && candidate.actions.perfectDashes <= candidate.actions.dashes
    && candidate.actions.perfectReleases <= candidate.actions.chargedReaps
    && isRecord(candidate.harvest)
    && finiteNonnegative(candidate.harvest.generated)
    && finiteNonnegative(candidate.harvest.spent)
    && isRecord(candidate.deathDefiance)
    && integerNonnegative(candidate.deathDefiance.granted)
    && integerNonnegative(candidate.deathDefiance.consumed)
    && candidate.deathDefiance.granted <= 2
    && candidate.deathDefiance.consumed <= candidate.deathDefiance.granted
    && progression !== null
    && validCountMap(candidate.finalRanks)
    && sameCountMap(candidate.finalRanks, progression?.finalRanks ?? {})
    && integerNonnegative(candidate.rerollsUsed)
    && candidate.rerollsUsed <= 10
    && isRecord(candidate.pathTotals)
    && PATH_IDS.every((path) => integerNonnegative(candidate.pathTotals[path]))
    && PATH_IDS.every((path) => candidate.pathTotals[path] === progression?.pathTotals[path])
    && isRecord(candidate.boss)
    && typeof candidate.boss.attempted === "boolean"
    && typeof candidate.boss.active === "boolean"
    && finiteNonnegative(candidate.boss.activeSeconds)
    && typeof candidate.boss.cleared === "boolean"
    && (candidate.boss.clearTimeSeconds === null || finiteNonnegative(candidate.boss.clearTimeSeconds))
    && candidate.boss.activeSeconds <= candidate.combatSeconds
    && (!candidate.boss.active || (candidate.boss.attempted && !candidate.boss.cleared))
    && (candidate.boss.cleared === (candidate.boss.clearTimeSeconds !== null))
    && (!candidate.boss.cleared || (
      candidate.boss.attempted
      && candidate.boss.clearTimeSeconds !== null
      && candidate.boss.clearTimeSeconds <= candidate.boss.activeSeconds
    ))
    && validTerminal(candidate.terminal, candidate.finalized);

  if (!valid) return null;
  return deepFreeze(clone(candidate));
}

export function validateRunStatistics(candidate) {
  const value = validateRunStatisticsDraft(candidate);
  return value?.finalized ? value : null;
}

function normalizedTerminal(detail = {}) {
  if (detail.completed === true || detail.victory === true || detail.ending) {
    if (!["kill", "timeout"].includes(detail.ending)) {
      throw new RangeError("Completed runs require the kill or timeout ending.");
    }
    return { kind: "ending", id: detail.ending };
  }
  const cause = typeof detail.cause === "string" && detail.cause.length > 0
    ? detail.cause
    : typeof detail.source === "string" && detail.source.length > 0
      ? detail.source
      : "defeated";
  return { kind: "death", cause };
}

export class RunStatsAccumulator {
  constructor({ runId, seed, difficultyId, startedAt = 0, draft = null } = {}) {
    if (draft) {
      const validated = validateRunStatisticsDraft(draft);
      if (!validated || validated.finalized) throw new TypeError("Invalid resumable run statistics draft.");
      this.values = clone(validated);
      return;
    }
    if (typeof runId !== "string" || runId.length === 0 || runId.length > 256) {
      throw new TypeError("runId must be a non-empty string.");
    }
    if (typeof seed !== "string" || seed.length === 0 || seed.length > 256) {
      throw new TypeError("seed must be a non-empty string.");
    }
    if (!DIFFICULTY_IDS.includes(difficultyId)) throw new RangeError("Unknown difficulty ID.");
    if (!finiteNonnegative(startedAt)) throw new RangeError("startedAt must be nonnegative.");
    this.values = emptyDraft({ runId, seed, difficultyId, startedAt });
  }

  static fromDraft(draft) {
    return new RunStatsAccumulator({ draft });
  }

  record({ type, detail = {} } = {}) {
    if (this.values.finalized) return false;
    switch (type) {
      case "arenaChanged":
      case "roomReady":
        if (Number.isInteger(detail.floor)) {
          this.values.deepestFloor = Math.max(this.values.deepestFloor, Math.min(10, Math.max(1, detail.floor)));
        }
        if (detail.boss === true) this.startBossAttempt();
        return true;
      case "roomCleared":
        this.values.roomsCleared += 1;
        if (Number.isInteger(detail.floor)) this.values.deepestFloor = Math.max(this.values.deepestFloor, detail.floor);
        return true;
      case "enemyDefeated":
        addToMap(this.values.enemiesKilled.byType, detail.type);
        addToMap(this.values.enemiesKilled.byOrigin, detail.origin);
        if (detail.type === "queen") this.clearBoss();
        return true;
      case "enemyHit": {
        const source = detail.hitOrigin ?? detail.sourceOrigin ?? detail.hit?.origin;
        if (source !== "player") return false;
        const damage = Number(detail.damage ?? detail.hit?.damage);
        if (!finiteNonnegative(damage) || damage === 0) return false;
        this.values.damageDealt += damage;
        this.values.highestHit = Math.max(this.values.highestHit, damage);
        if (detail.critical === true || detail.hit?.critical === true) this.values.criticalHits += 1;
        return true;
      }
      case "playerHit": {
        const amount = Number(detail.appliedAmount ?? detail.amount);
        if (!finiteNonnegative(amount) || amount === 0) return false;
        this.values.damageTaken += amount;
        return true;
      }
      case "playerHealed": {
        const amount = Number(detail.amount);
        if (!finiteNonnegative(amount) || amount === 0) return false;
        this.values.healingReceived += amount;
        return true;
      }
      case "dash":
        this.values.actions.dashes += 1;
        return true;
      case "perfectDash":
        this.values.actions.perfectDashes += 1;
        return true;
      case "chargeReleased":
        this.values.actions.chargedReaps += 1;
        if (detail.quality === "perfect") this.values.actions.perfectReleases += 1;
        return true;
      case "claimStarted":
        this.values.actions.claims += 1;
        return true;
      case "harvestChanged": {
        const delta = Number(detail.delta);
        if (!Number.isFinite(delta) || delta === 0) return false;
        if (delta > 0) this.values.harvest.generated += delta;
        else this.values.harvest.spent += Math.abs(delta);
        return true;
      }
      case "deathDefianceGranted": {
        const amount = Number(detail.amount ?? 1);
        if (!Number.isInteger(amount) || amount <= 0) return false;
        this.values.deathDefiance.granted = Math.min(2, this.values.deathDefiance.granted + amount);
        return true;
      }
      case "playerRevived":
        this.values.deathDefiance.consumed = Math.min(
          this.values.deathDefiance.granted,
          this.values.deathDefiance.consumed + 1,
        );
        return true;
      case "roomRewardChosen":
        return this.recordSelection(detail, "chamber");
      case "blessingChosen":
        return this.recordSelection(detail, "blessing");
      case "upgradeRerolled":
        this.values.rerollsUsed = Math.min(10, this.values.rerollsUsed + 1);
        return true;
      case "bossCombatStarted":
        this.startBossAttempt();
        return true;
      case "bossDefeated":
        this.clearBoss();
        return true;
      default:
        return false;
    }
  }

  recordSelection(detail, tier) {
    if (
      typeof detail.id !== "string"
      || detail.id.length === 0
      || !PATH_IDS.includes(detail.path)
      || !Number.isInteger(detail.rank)
      || detail.rank < 1
      || detail.rank > 30
    ) return false;
    const previousRank = this.values.finalRanks[detail.id] ?? 0;
    if (detail.rank < previousRank) return false;
    this.values.finalRanks[detail.id] = detail.rank;
    this.values.selections.push({ id: detail.id, path: detail.path, tier, rankAfter: detail.rank });
    this.values.pathTotals[detail.path] += Math.max(0, detail.rank - previousRank);
    return true;
  }

  startBossAttempt() {
    this.values.boss.attempted = true;
    this.values.boss.active = !this.values.boss.cleared;
  }

  clearBoss() {
    if (!this.values.boss.attempted) this.startBossAttempt();
    if (this.values.boss.cleared) return;
    this.values.boss.active = false;
    this.values.boss.cleared = true;
    this.values.boss.clearTimeSeconds = this.values.boss.activeSeconds;
  }

  sampleTime(dt, phase, foreground = true) {
    if (this.values.finalized || !foreground || !finiteNonnegative(dt) || dt === 0) return false;
    if (PAUSED_PHASES.has(phase)) return false;
    this.values.activePlaytimeSeconds += dt;
    if (RUN_TIME_PHASES.has(phase)) this.values.durationSeconds += dt;
    if (COMBAT_PHASES.has(phase)) this.values.combatSeconds += dt;
    if (this.values.boss.active && COMBAT_PHASES.has(phase)) this.values.boss.activeSeconds += dt;
    return true;
  }

  snapshotDraft() {
    return deepFreeze(clone(this.values));
  }

  finalize(terminalEvent = {}) {
    if (this.values.finalized) throw new Error("Run statistics have already been finalized.");
    const detail = terminalEvent.detail ?? terminalEvent;
    this.values.terminal = normalizedTerminal(detail);
    this.values.finalized = true;
    this.values.boss.active = false;
    const result = validateRunStatistics(this.values);
    if (!result) throw new Error("Run statistics failed final validation.");
    return result;
  }
}

export const RUN_STATISTICS_VERSION = RUN_STATS_VERSION;
export const RUN_STATISTICS_DIFFICULTIES = DIFFICULTY_IDS;
export const RUN_STATISTICS_PATHS = PATH_IDS;
