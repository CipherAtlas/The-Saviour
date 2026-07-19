import { DIFFICULTY } from "./gameConfig.js";
import { RunStatsAccumulator } from "./RunStatsAccumulator.js";
import { deriveStatisticsView } from "../settings/StatisticsStore.js";

let runSerial = 0;

function defaultRunId(seed, now) {
  runSerial += 1;
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId ? `run:${randomId}` : `run:${seed}:${now}:${runSerial}`;
}

export class RunSessionController {
  constructor({
    game,
    settings,
    suspendedRuns,
    statistics,
    now = () => Date.now(),
    runIdFactory = defaultRunId,
    platform = {},
  }) {
    this.game = game;
    this.settings = settings;
    this.suspendedRuns = suspendedRuns;
    this.statistics = statistics;
    this.now = now;
    this.runIdFactory = runIdFactory;
    this.platform = Object.freeze({ canQuit: platform.canQuit === true, quit: platform.quit ?? null });
    this.activeRun = null;
    this.lastCompletedRun = null;
    this.unflushedPlaytime = 0;
    this.lastError = null;
  }

  startNewRun(seed, difficultyId) {
    if (!DIFFICULTY[difficultyId] || typeof seed !== "string" || seed.length === 0) return false;
    this.settings.set("gameplay.difficulty", difficultyId);
    this.suspendedRuns.clear();
    const startedAt = this.now();
    this.activeRun = new RunStatsAccumulator({
      runId: this.runIdFactory(seed, startedAt),
      seed,
      difficultyId,
      startedAt: startedAt / 1_000,
    });
    this.lastCompletedRun = null;
    this.lastError = null;
    this.game.startRun(seed);
    return true;
  }

  continueRun() {
    const snapshot = this.suspendedRuns.loadValid();
    if (!snapshot) return false;
    this.settings.set("gameplay.difficulty", snapshot.difficultyId);
    let activeRun;
    try {
      activeRun = RunStatsAccumulator.fromDraft(snapshot.statisticsDraft);
    } catch {
      this.suspendedRuns.clear();
      return false;
    }
    this.activeRun = activeRun;
    this.lastCompletedRun = null;
    this.lastError = null;
    if (this.game.resumeRun(snapshot)) return true;
    this.activeRun = null;
    this.suspendedRuns.clear();
    this.game.returnToTitle();
    return false;
  }

  handleEvent(event) {
    if (!this.activeRun) return false;
    this.activeRun.record(event);
    if (event.type === "arenaChanged") {
      const snapshot = this.game.createSuspendedRunSnapshot(this.activeRun.snapshotDraft());
      if (snapshot) this.suspendedRuns.save(snapshot);
    }
    if (event.type !== "runEnded") return true;

    let finalized = false;
    try {
      this.lastCompletedRun = this.activeRun.finalize(event);
      this.statistics.recordCompletedRun(this.lastCompletedRun);
      finalized = true;
    } catch {
      this.lastCompletedRun = null;
      this.lastError = "statisticsFinalizeFailed";
    } finally {
      this.activeRun = null;
      this.suspendedRuns.clear();
      this.flush();
    }
    return finalized;
  }

  sampleTime(seconds, phase, foreground) {
    if (!Number.isFinite(seconds) || seconds <= 0 || !foreground) return false;
    if (phase !== "paused") {
      this.statistics.recordActivePlaytime(seconds);
      this.unflushedPlaytime += seconds;
    }
    this.activeRun?.sampleTime(seconds, phase, true);
    if (this.unflushedPlaytime >= 30) this.flush();
    return true;
  }

  flush() {
    this.unflushedPlaytime = 0;
    return this.statistics.flush();
  }

  suspendToTitle() {
    if (!this.suspendedRuns.loadValid()) return false;
    this.activeRun = null;
    this.game.returnToTitle();
    this.flush();
    return true;
  }

  abandonRun() {
    return this.game.abandonRun();
  }

  resetStatistics() {
    this.statistics.reset();
    return this.recordsSnapshot();
  }

  titleState() {
    const suspended = this.suspendedRuns.loadValid();
    return Object.freeze({
      continueRun: suspended ? Object.freeze({
        difficultyId: suspended.difficultyId,
        floor: suspended.nextFloor,
        room: suspended.nextRoom,
        savedAt: suspended.savedAt,
      }) : null,
      suspendStorageError: this.suspendedRuns.getStatus().storageError,
      statisticsStorageError: this.statistics.getStatus().storageError,
      canQuit: this.platform.canQuit,
    });
  }

  recordsSnapshot() {
    const statistics = this.statistics.getSnapshot();
    return Object.freeze({
      statistics,
      derived: deriveStatisticsView(statistics),
      storageError: this.statistics.getStatus().storageError,
    });
  }

  lastRunSummary() {
    return this.lastCompletedRun;
  }

  quit() {
    if (!this.platform.canQuit || typeof this.platform.quit !== "function") return false;
    this.platform.quit();
    return true;
  }
}
