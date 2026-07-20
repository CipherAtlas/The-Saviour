import assert from "node:assert/strict";
import test from "node:test";
import { Game } from "../src/game/Game.js";
import { ENDING_TIMING, PORTAL_CONFIG, RUN_CONFIG } from "../src/game/gameConfig.js";

function input() {
  return {
    settings: { get: () => "hold" },
    movement: () => ({ x: 0, y: 0 }),
    isDown: () => false,
    consume: () => false,
    flushActions: () => {},
  };
}

function settings() {
  const values = {
    "gameplay.difficulty": "standard",
    "gameplay.autoTarget": 0,
    "gameplay.aimAssist": 0,
  };
  return { get: (path) => values[path] };
}

function harness(seed = "BOOKEND-FLOW") {
  const game = new Game(input(), settings());
  const events = [];
  game.on((event) => events.push(event));
  game.startRun(seed);
  return { game, events };
}

function completeBookend(game) {
  const sequenceId = game.activeBookend;
  let lines = 0;
  while (game.phase === "bookend" && game.activeBookend === sequenceId) {
    assert.equal(game.continueBookend(), true);
    lines += 1;
    assert.ok(lines < 8);
  }
  return { sequenceId, lines };
}

function completeFade(game) {
  const deadline = game.ending.snapshot().fade.deadlineMs;
  game.updateEndingClock(deadline);
}

test("normal runs show a three-line intro and then stay gameplay-only between bookends", () => {
  const { game, events } = harness();
  assert.equal(game.phase, "bookend");
  assert.deepEqual(completeBookend(game), { sequenceId: "intro", lines: 3 });
  assert.equal(game.phase, "playing");

  for (const enemy of game.director.enemies) enemy.active = false;
  game.director.pendingWaves.length = 0;
  game.checkRoomProgress(RUN_CONFIG.roomClearDelay);
  assert.equal(game.beginPortalTraversal(), true);
  game.updatePortalTraversal(PORTAL_CONFIG.traversalDuration);
  assert.equal(game.phase, "reward");
  assert.equal(game.activeBookend, null);
  assert.equal(events.filter(({ type }) => type === "bookendStarted").length, 1);
});

test("the kill ending preserves the plea, five-second strike choice, response, and completion", () => {
  const { game, events } = harness("BOOKEND-KILL");
  completeBookend(game);
  game.startEndingFlow();
  assert.deepEqual(completeBookend(game), { sequenceId: "ending.plea", lines: 3 });
  const decision = game.ending.snapshot().decision;
  assert.equal(decision.durationMs, 5_000);
  assert.equal(game.tryKillPrincess(decision.startedAtMs + 1), true);
  game.updateFixed(ENDING_TIMING.endingStrike.R);
  assert.deepEqual(completeBookend(game), { sequenceId: "ending.kill", lines: 2 });
  assert.equal(game.phase, "endingFade");
  completeFade(game);
  assert.equal(game.phase, "endingComplete");
  assert.deepEqual(events.findLast(({ type }) => type === "runEnded").detail, {
    completed: true, victory: true, ending: "kill", seed: "BOOKEND-KILL",
  });
});

test("the timeout ending preserves the plea, three-line response, and losing completion", () => {
  const { game, events } = harness("BOOKEND-TIMEOUT");
  completeBookend(game);
  game.startEndingFlow();
  completeBookend(game);
  const decision = game.ending.snapshot().decision;
  game.updateEndingClock(decision.deadlineMs);
  assert.deepEqual(completeBookend(game), { sequenceId: "ending.timeout", lines: 3 });
  assert.equal(game.player.health, 0);
  assert.equal(game.phase, "endingFade");
  completeFade(game);
  assert.deepEqual(events.findLast(({ type }) => type === "runEnded").detail, {
    completed: true, victory: false, ending: "timeout", seed: "BOOKEND-TIMEOUT",
  });
});

test("Speedrun skips both VN bookends but keeps the timed ending decision", () => {
  const game = new Game(input(), settings());
  game.startRun("BOOKEND-SPEEDRUN", { runType: "speedrun" });
  assert.equal(game.phase, "playing");
  game.startEndingFlow();
  assert.equal(game.phase, "endingChoice");
  assert.equal(game.activeBookend, null);
});
