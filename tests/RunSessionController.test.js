import assert from "node:assert/strict";
import test from "node:test";
import { RunSessionController } from "../src/game/RunSessionController.js";
import { RunStatsAccumulator } from "../src/game/RunStatsAccumulator.js";
import { SettingsStore } from "../src/settings/SettingsStore.js";
import { StatisticsStore } from "../src/settings/StatisticsStore.js";
import {
  SUSPENDED_RUN_KEY,
  SuspendedRunStore,
} from "../src/settings/SuspendedRunStore.js";

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
    this.writeCount = 0;
  }

  getItem(key) { return this.values.get(key) ?? null; }

  setItem(key, value) {
    this.writeCount += 1;
    this.values.set(key, value);
  }

  removeItem(key) { this.values.delete(key); }
}

function runDraft({
  seed = "SESSION-SEED",
  difficultyId = "standard",
  runId = `run:${seed}`,
  configure = null,
} = {}) {
  const statistics = new RunStatsAccumulator({
    runId,
    seed,
    difficultyId,
    startedAt: 12,
  });
  configure?.(statistics);
  return statistics.snapshotDraft();
}

function roomOneSnapshot({
  seed = "SESSION-SEED",
  difficultyId = "standard",
  statisticsDraft = runDraft({ seed, difficultyId }),
} = {}) {
  return {
    seed,
    difficultyId,
    nextFloor: 1,
    nextRoom: 1,
    player: { health: 130 },
    harvestUnits: 100,
    deathDefiance: { granted: 0, remaining: 0 },
    upgradeSelections: [],
    upgradeRanks: [],
    blessingIds: [],
    rerollsUsedByFloor: Array(10).fill(0),
    runFlags: {},
    seenRunSequenceIds: [],
    completedUpgradeSequenceIds: [],
    statisticsDraft,
  };
}

class FakeGame {
  constructor({ resumeResult = true } = {}) {
    this.resumeResult = resumeResult;
    this.startedSeeds = [];
    this.resumedSnapshots = [];
    this.createdDrafts = [];
    this.returnToTitleCount = 0;
    this.abandonCount = 0;
  }

  startRun(seed) {
    this.startedSeeds.push(seed);
  }

  resumeRun(snapshot) {
    this.resumedSnapshots.push(snapshot);
    return this.resumeResult;
  }

  createSuspendedRunSnapshot(statisticsDraft) {
    this.createdDrafts.push(statisticsDraft);
    return roomOneSnapshot({
      seed: statisticsDraft.seed,
      difficultyId: statisticsDraft.difficultyId,
      statisticsDraft,
    });
  }

  returnToTitle() {
    this.returnToTitleCount += 1;
  }

  abandonRun() {
    this.abandonCount += 1;
    return true;
  }
}

function harness({ storage = new MemoryStorage(), game = new FakeGame(), platform = {} } = {}) {
  const settings = new SettingsStore(storage);
  const suspendedRuns = new SuspendedRunStore(storage, { now: () => 45_000 });
  const statistics = new StatisticsStore(storage);
  const controller = new RunSessionController({
    game,
    settings,
    suspendedRuns,
    statistics,
    now: () => 42_000,
    runIdFactory: (seed, now) => `run:${seed}:${now}`,
    platform,
  });
  return { controller, game, settings, statistics, storage, suspendedRuns };
}

test("a new run clears an old suspend and the first arena boundary replaces it", () => {
  const context = harness();
  assert.equal(context.suspendedRuns.save(roomOneSnapshot({ seed: "OLD-SEED" })), true);
  assert.equal(context.controller.titleState().continueRun.floor, 1);

  assert.equal(context.controller.startNewRun("NEW-SEED", "story"), true);
  assert.equal(context.suspendedRuns.loadValid(), null);
  assert.deepEqual(context.game.startedSeeds, ["NEW-SEED"]);
  assert.equal(context.settings.get("gameplay.difficulty"), "story");

  assert.equal(context.controller.handleEvent({ type: "dash", detail: {} }), true);
  assert.equal(context.suspendedRuns.loadValid(), null);
  assert.equal(context.controller.handleEvent({
    type: "arenaChanged",
    detail: { floor: 1, room: 1, boss: false },
  }), true);

  const replacement = context.suspendedRuns.loadValid();
  assert.equal(replacement.seed, "NEW-SEED");
  assert.equal(replacement.difficultyId, "story");
  assert.equal(replacement.statisticsDraft.actions.dashes, 1);
  assert.equal(context.game.createdDrafts.length, 1);
});

test("Continue restores the validated statistics draft and selected difficulty", () => {
  const context = harness();
  const statisticsDraft = runDraft({
    seed: "CONTINUE-SEED",
    difficultyId: "ruthless",
    configure(statistics) {
      statistics.record({ type: "dash" });
      statistics.sampleTime(2.5, "playing", true);
    },
  });
  assert.equal(context.suspendedRuns.save(roomOneSnapshot({
    seed: "CONTINUE-SEED",
    difficultyId: "ruthless",
    statisticsDraft,
  })), true);

  assert.equal(context.controller.continueRun(), true);
  assert.equal(context.settings.get("gameplay.difficulty"), "ruthless");
  assert.equal(context.game.resumedSnapshots.length, 1);
  assert.deepEqual(context.controller.activeRun.snapshotDraft(), statisticsDraft);
  assert.deepEqual(context.controller.titleState().continueRun, {
    difficultyId: "ruthless",
    floor: 1,
    room: 1,
    savedAt: 45_000,
  });
});

test("terminal handling finalizes once, records the run, and clears Continue", () => {
  const context = harness();
  context.controller.startNewRun("ENDING-SEED", "standard");
  context.controller.handleEvent({
    type: "arenaChanged",
    detail: { floor: 1, room: 1, boss: false },
  });
  assert.ok(context.suspendedRuns.loadValid());

  const terminal = {
    type: "runEnded",
    detail: { completed: true, victory: true, ending: "kill" },
  };
  assert.equal(context.controller.handleEvent(terminal), true);
  assert.equal(context.controller.handleEvent(terminal), false);
  assert.equal(context.controller.activeRun, null);
  assert.equal(context.suspendedRuns.loadValid(), null);
  assert.deepEqual(context.controller.lastRunSummary().terminal, { kind: "ending", id: "kill" });
  assert.equal(context.statistics.getSnapshot().attempts, 1);
  assert.equal(context.statistics.getSnapshot().completions.standard.kill, 1);
});

test("invalid and rejected Continue records are contained without leaving a partial run", () => {
  const malformedStorage = new MemoryStorage({
    [SUSPENDED_RUN_KEY]: "not-json",
    unrelated: "preserved",
  });
  const malformed = harness({ storage: malformedStorage });
  let continueResult;
  assert.doesNotThrow(() => { continueResult = malformed.controller.continueRun(); });
  assert.equal(continueResult, false);
  assert.equal(malformed.controller.activeRun, null);
  assert.equal(malformed.game.resumedSnapshots.length, 0);
  assert.equal(malformedStorage.getItem(SUSPENDED_RUN_KEY), null);
  assert.equal(malformedStorage.getItem("unrelated"), "preserved");

  const rejectingGame = new FakeGame({ resumeResult: false });
  const rejected = harness({ game: rejectingGame });
  assert.equal(rejected.suspendedRuns.save(roomOneSnapshot()), true);
  assert.equal(rejected.controller.continueRun(), false);
  assert.equal(rejected.controller.activeRun, null);
  assert.equal(rejected.suspendedRuns.loadValid(), null);
  assert.equal(rejectingGame.returnToTitleCount, 1);
});

test("foreground playtime excludes paused and background samples", () => {
  const context = harness();
  context.controller.startNewRun("TIMING-SEED", "standard");

  assert.equal(context.controller.sampleTime(5, "playing", true), true);
  assert.equal(context.controller.sampleTime(4, "paused", true), true);
  assert.equal(context.controller.sampleTime(7, "playing", false), false);
  assert.equal(context.controller.sampleTime(3, "dialogue", true), true);

  const draft = context.controller.activeRun.snapshotDraft();
  assert.equal(draft.durationSeconds, 8);
  assert.equal(draft.combatSeconds, 5);
  assert.equal(draft.activePlaytimeSeconds, 8);
  assert.equal(context.statistics.getSnapshot().totalActivePlaytimeSeconds, 8);
});

test("suspending to title preserves Continue and releases the active session", () => {
  const context = harness();
  context.controller.startNewRun("SUSPEND-TO-TITLE", "standard");
  context.controller.handleEvent({
    type: "arenaChanged",
    detail: { floor: 1, room: 1, boss: false },
  });

  assert.equal(context.controller.suspendToTitle(), true);
  assert.equal(context.controller.activeRun, null);
  assert.equal(context.game.returnToTitleCount, 1);
  assert.equal(context.controller.titleState().continueRun.floor, 1);

  const empty = harness();
  assert.equal(empty.controller.suspendToTitle(), false);
  assert.equal(empty.game.returnToTitleCount, 0);
});

test("quit is exposed only when the host platform explicitly supports it", () => {
  let quitCalls = 0;
  const browser = harness({ platform: { canQuit: false, quit: () => { quitCalls += 1; } } });
  assert.equal(browser.controller.titleState().canQuit, false);
  assert.equal(browser.controller.quit(), false);
  assert.equal(quitCalls, 0);

  const desktop = harness({ platform: { canQuit: true, quit: () => { quitCalls += 1; } } });
  assert.equal(desktop.controller.titleState().canQuit, true);
  assert.equal(desktop.controller.quit(), true);
  assert.equal(quitCalls, 1);
});
