import { DEFAULT_RUN_TYPE, DIFFICULTY, RUN_TYPE_IDS } from "./gameConfig.js";
import { RunStatsAccumulator } from "./RunStatsAccumulator.js";
import { deriveStatisticsView } from "../settings/StatisticsStore.js";
import { SpeedrunRecordsStore } from "../settings/SpeedrunRecordsStore.js";

const SPEEDRUN_TIMED_PHASES = new Set(["playing", "portalTraversal", "reward", "blessing"]);

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
    speedrunRecords = new SpeedrunRecordsStore(null),
    now = () => Date.now(),
    runIdFactory = defaultRunId,
    platform = {},
  }) {
    this.game = game;
    this.settings = settings;
    this.suspendedRuns = suspendedRuns;
    this.statistics = statistics;
    this.speedrunRecords = speedrunRecords;
    this.now = now;
    this.runIdFactory = runIdFactory;
    this.platform = Object.freeze({ canQuit: platform.canQuit === true, quit: platform.quit ?? null });
    this.activeRun = null;
    this.activeRunType = DEFAULT_RUN_TYPE;
    this.speedrunTimer = { elapsedSeconds: 0, finished: false };
    this.lastCompletedRun = null;
    this.unflushedPlaytime = 0;
    this.lastError = null;
  }

  startNewRun(seed, difficultyId, runType = DEFAULT_RUN_TYPE) {
    if (
      !RUN_TYPE_IDS.includes(runType)
      || !DIFFICULTY[difficultyId]
      || (runType === "speedrun" && difficultyId !== "ruthless")
      || typeof seed !== "string"
      || seed.length === 0
    ) return false;
    if (runType === "normal") this.settings.set("gameplay.difficulty", difficultyId);
    this.suspendedRuns.clear();
    const startedAt = this.now();
    this.activeRun = new RunStatsAccumulator({
      runId: this.runIdFactory(seed, startedAt),
      seed,
      difficultyId,
      startedAt: startedAt / 1_000,
    });
    this.activeRunType = runType;
    this.speedrunTimer = { elapsedSeconds: 0, finished: false };
    this.lastCompletedRun = null;
    this.lastError = null;
    this.game.startRun(seed, { runType });
    return true;
  }

  startSpeedrun(seed) {
    return this.startNewRun(seed, "ruthless", "speedrun");
  }

  continueRun() {
    const snapshot = this.suspendedRuns.loadValid();
    if (!snapshot) return false;
    if (snapshot.runType === "normal") this.settings.set("gameplay.difficulty", snapshot.difficultyId);
    let activeRun;
    try {
      activeRun = RunStatsAccumulator.fromDraft(snapshot.statisticsDraft);
    } catch {
      this.suspendedRuns.clear();
      return false;
    }
    this.activeRun = activeRun;
    this.activeRunType = snapshot.runType;
    this.speedrunTimer = {
      elapsedSeconds: snapshot.speedrun.elapsedSeconds,
      finished: snapshot.speedrun.finished,
    };
    this.lastCompletedRun = null;
    this.lastError = null;
    if (this.game.resumeRun(snapshot)) return true;
    this.activeRun = null;
    this.activeRunType = DEFAULT_RUN_TYPE;
    this.speedrunTimer = { elapsedSeconds: 0, finished: false };
    this.suspendedRuns.clear();
    this.game.returnToTitle();
    return false;
  }

  handleEvent(event) {
    if (!this.activeRun) return false;
    this.activeRun.record(event);
    if (
      this.activeRunType === "speedrun"
      && !this.speedrunTimer.finished
      && event.type === "enemyDefeated"
      && event.detail?.type === "queen"
    ) this.speedrunTimer.finished = true;
    if (event.type === "arenaChanged") {
      const snapshot = this.game.createSuspendedRunSnapshot(
        this.activeRun.snapshotDraft(),
        this.speedrunTimer,
      );
      if (snapshot) this.suspendedRuns.save(snapshot);
    }
    if (event.type !== "runEnded") return true;

    let finalized = false;
    try {
      const summary = this.activeRun.finalize(event);
      if (this.activeRunType === "speedrun") {
        const speedrunSummary = Object.freeze({
          ...summary,
          runType: "speedrun",
          speedrunTimeSeconds: this.speedrunTimer.elapsedSeconds,
          speedrunFinished: this.speedrunTimer.finished,
        });
        const record = this.speedrunRecords.recordRun(speedrunSummary);
        this.lastCompletedRun = Object.freeze({ ...speedrunSummary, isPersonalBest: record.newBest });
      } else {
        this.lastCompletedRun = Object.freeze({ ...summary, runType: "normal" });
        this.statistics.recordCompletedRun(summary);
      }
      finalized = true;
    } catch {
      this.lastCompletedRun = null;
      this.lastError = "statisticsFinalizeFailed";
    } finally {
      this.activeRun = null;
      this.activeRunType = DEFAULT_RUN_TYPE;
      this.speedrunTimer = { elapsedSeconds: 0, finished: false };
      this.suspendedRuns.clear();
      this.flush();
    }
    return finalized;
  }

  sampleTime(seconds, phase, foreground) {
    if (!Number.isFinite(seconds) || seconds <= 0 || !foreground) return false;
    if (this.activeRunType === "normal" && phase !== "paused") {
      this.statistics.recordActivePlaytime(seconds);
      this.unflushedPlaytime += seconds;
    }
    this.activeRun?.sampleTime(seconds, phase, true);
    if (
      this.activeRunType === "speedrun"
      && !this.speedrunTimer.finished
      && SPEEDRUN_TIMED_PHASES.has(phase)
    ) this.speedrunTimer.elapsedSeconds += seconds;
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
    this.activeRunType = DEFAULT_RUN_TYPE;
    this.speedrunTimer = { elapsedSeconds: 0, finished: false };
    this.game.returnToTitle();
    this.flush();
    return true;
  }

  abandonRun() {
    return this.game.abandonRun();
  }

  resetStatistics() {
    this.statistics.reset();
    this.speedrunRecords.reset();
    return this.recordsSnapshot();
  }

  titleState() {
    const suspended = this.suspendedRuns.loadValid();
    return Object.freeze({
      continueRun: suspended ? Object.freeze({
        difficultyId: suspended.difficultyId,
        ...(suspended.runType === "speedrun" ? {
          runType: "speedrun",
          elapsedSeconds: suspended.speedrun.elapsedSeconds,
        } : {}),
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
      speedrun: this.speedrunRecords.getSnapshot(),
      storageError: this.statistics.getStatus().storageError,
      speedrunStorageError: this.speedrunRecords.getStatus().storageError,
    });
  }

  speedrunSnapshot() {
    return Object.freeze({
      active: this.activeRunType === "speedrun" && Boolean(this.activeRun),
      elapsedSeconds: this.speedrunTimer.elapsedSeconds,
      finished: this.speedrunTimer.finished,
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
