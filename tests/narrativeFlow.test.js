import assert from "node:assert/strict";
import test from "node:test";
import { Game } from "../src/game/Game.js";
import {
  FLOOR_PROJECTION_IDS,
  UPGRADE_SEQUENCE_IDS,
  floorProjectionId,
  upgradeSequenceId,
} from "../src/game/dialogueContent.js";
import { ENEMY_ORIGINS } from "../src/game/encounterPatterns.js";
import { NARRATIVE_TIMING, PORTAL_CONFIG, RUN_CONFIG } from "../src/game/gameConfig.js";
import { NarrativeProgressStore } from "../src/settings/NarrativeProgressStore.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.writeCount = 0;
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.writeCount += 1;
    this.values.set(key, value);
  }
}

function createInput() {
  const flushed = [];
  return {
    flushed,
    settings: { get: () => "hold" },
    movement: () => ({ x: 0, y: 0 }),
    isDown: () => false,
    consume: () => false,
    flushActions(actions) {
      flushed.push([...actions]);
    },
  };
}

function createSettings() {
  const values = {
    "gameplay.difficulty": "standard",
    "gameplay.autoTarget": 0,
    "gameplay.aimAssist": 0,
  };
  return { get: (path) => values[path] };
}

function createHarness() {
  const input = createInput();
  const storage = new MemoryStorage();
  const progress = new NarrativeProgressStore(storage);
  const game = new Game(input, createSettings(), { narrativeProgress: progress });
  const events = [];

  game.on((event) => {
    events.push(event);
    if (event.type === "endingCompleted" && progress.unlockGlossary()) {
      game.emit("glossaryUnlocked", progress.getSnapshot());
    }
  });

  return { game, input, events, progress, storage };
}

function combatHit(actionId, damage, sourcePosition) {
  return Object.freeze({
    actionId,
    damage,
    critical: false,
    direction: Object.freeze({ x: 1, z: 0 }),
    knockback: 0,
    poiseDamage: 0,
    pullStrength: 0,
    sourcePosition: Object.freeze({ ...sourcePosition }),
    origin: "player",
  });
}

function completeActiveSequence(game) {
  assert.equal(game.phase, "dialogue");
  const sequenceId = game.activeNarrative?.id;
  assert.ok(sequenceId, "expected an active narrative sequence");

  let advances = 0;
  while (game.phase === "dialogue" && game.activeNarrative?.id === sequenceId) {
    const beat = game.dialogue.view();
    assert.equal(beat?.sequenceId, sequenceId);
    assert.equal(game.continueDialogue(), true);
    advances += 1;
    assert.ok(advances < 64, `dialogue sequence did not complete: ${sequenceId}`);
  }

  return sequenceId;
}

function completeQueuedDialogue(game) {
  const sequenceIds = [];
  let sequences = 0;
  while (game.phase === "dialogue") {
    sequenceIds.push(completeActiveSequence(game));
    sequences += 1;
    assert.ok(sequences < 16, "VN narrative queue did not drain");
  }
  return sequenceIds;
}

function latestEvent(events, type) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].type === type) return events[index];
  }
  return null;
}

function eventCount(events, type) {
  return events.filter((event) => event.type === type).length;
}

function clearEncounter(game) {
  for (const enemy of game.director.enemies) enemy.active = false;
  game.director.pendingWaves.length = 0;
  game.checkRoomProgress(RUN_CONFIG.roomClearDelay);
}

function traversePortal(game) {
  assert.equal(game.beginPortalTraversal(), true);
  game.updatePortalTraversal(PORTAL_CONFIG.traversalDuration);
}

function prepareDeterministicDecision(game, events, startAtMs, fadeAtMs) {
  game.startRun(`ENDING-${startAtMs}`);
  game.resetNarrativeState();
  events.length = 0;

  const beginEndingFade = Game.prototype.beginEndingFade;
  game.beginEndingFade = function beginEndingFadeAtDeterministicTime(nowMs = fadeAtMs) {
    return beginEndingFade.call(this, nowMs);
  };
  game.beginEndingDecision(startAtMs);

  assert.equal(game.phase, "endingChoice");
  assert.equal(game.ending.snapshot().decision.startedAtMs, startAtMs);
}

test("opening VN sequences drain in strict FIFO order before room play", () => {
  const { game, events } = createHarness();
  game.startRun("NARRATIVE-OPENING-FIFO");

  assert.equal(game.phase, "dialogue");
  assert.equal(game.activeNarrative.id, "opening.domestic");
  assert.deepEqual(game.narrativeQueue.map(({ id }) => id), [
    "opening.ring",
    "opening.threshold",
    floorProjectionId(1),
  ]);

  const completed = completeQueuedDialogue(game);
  assert.deepEqual(completed, ["opening.domestic", "opening.ring", "opening.threshold", floorProjectionId(1)]);
  assert.equal(completed[0], "opening.domestic");
  assert.equal(completed.filter((sequenceId) => sequenceId === "opening.domestic").length, 1);
  assert.equal(game.phase, "playing");
  assert.equal(game.activeNarrative, null);
  assert.deepEqual(game.narrativeQueue, []);

  assert.deepEqual(
    events.filter(({ type }) => type === "dialogueStarted").map(({ detail }) => detail.sequenceId),
    completed,
  );
  assert.deepEqual(
    events.filter(({ type }) => type === "dialogueCompleted").map(({ detail }) => detail.sequenceId),
    completed,
  );
  assert.equal(
    events.filter(({ type, detail }) => type === "dialogueCompleted" && detail.sequenceId === "opening.domestic").length,
    1,
  );
});

test("the complete ten-floor route presents every projection and all 29 full-screen upgrade sequences", () => {
  const { game, events } = createHarness();
  const placements = [];
  game.startRun("NARRATIVE-TEN-FLOORS");

  assert.deepEqual(completeQueuedDialogue(game), [
    "opening.domestic",
    "opening.ring",
    "opening.threshold",
    floorProjectionId(1),
  ]);

  for (let floor = 1; floor <= RUN_CONFIG.totalFloors; floor += 1) {
    assert.equal(game.floor, floor);
    assert.equal(game.room, 1);

    if (floor > 1) {
      assert.equal(game.activeNarrative?.id, floorProjectionId(floor));
      assert.deepEqual(completeQueuedDialogue(game), [floorProjectionId(floor)]);
    }
    assert.equal(game.phase, "playing");

    for (let room = 1; room <= 2; room += 1) {
      assert.equal(game.room, room);
      clearEncounter(game);
      assert.equal(game.phase, "dialogue");
      assert.deepEqual(completeQueuedDialogue(game), [upgradeSequenceId(floor, room)]);
      assert.equal(game.phase, "reward");
      assert.ok(game.pendingRoomRewards.length > 0, `missing reward choices at floor ${floor}, room ${room}`);

      const offer = latestEvent(events, "roomRewardOffered");
      const sequenceId = upgradeSequenceId(floor, room);
      assert.equal(offer.detail.floor, floor);
      assert.equal(offer.detail.room, room);
      assert.equal(offer.detail.sequenceId, sequenceId);
      placements.push({ floor, room, sequenceId });

      game.chooseRoomReward(game.pendingRoomRewards[0].id);
      assert.equal(game.phase, "playing");
      assert.equal(game.portalActive, true, `reward did not open the portal at floor ${floor}, room ${room}`);
      traversePortal(game);
    }

    assert.equal(game.room, RUN_CONFIG.roomsPerFloor);
    if (floor === RUN_CONFIG.totalFloors) {
      assert.equal(game.activeNarrative?.id, "boss.confrontation");
      assert.deepEqual(completeQueuedDialogue(game), ["boss.confrontation"]);
      assert.equal(game.phase, "playing");
      break;
    }

    assert.equal(game.phase, "playing");
    clearEncounter(game);
    assert.equal(game.phase, "playing");
    assert.equal(game.portalActive, true);
    traversePortal(game);
    assert.equal(game.phase, "dialogue");
    assert.deepEqual(completeQueuedDialogue(game), [upgradeSequenceId(floor, RUN_CONFIG.roomsPerFloor)]);
    assert.equal(game.phase, "blessing");
    assert.ok(game.pendingBlessings.length > 0, `missing floor blessing choices after floor ${floor}`);

    const offer = latestEvent(events, "blessingOffered");
    const sequenceId = upgradeSequenceId(floor, RUN_CONFIG.roomsPerFloor);
    assert.equal(offer.detail.floor, floor);
    assert.equal(offer.detail.room, RUN_CONFIG.roomsPerFloor);
    assert.equal(offer.detail.sequenceId, sequenceId);
    placements.push({ floor, room: RUN_CONFIG.roomsPerFloor, sequenceId });

    game.chooseBlessing(game.pendingBlessings[0].id);
    assert.equal(game.floor, floor + 1);
    assert.equal(game.room, 1);
    assert.equal(game.phase, "dialogue");
  }

  const projectionIds = events
    .filter(({ type, detail }) => type === "dialogueStarted" && FLOOR_PROJECTION_IDS.includes(detail.sequenceId))
    .map(({ detail }) => detail.sequenceId);
  assert.deepEqual(projectionIds, FLOOR_PROJECTION_IDS);
  assert.equal(new Set(projectionIds).size, 10);
  assert.deepEqual(placements.map(({ sequenceId }) => sequenceId), UPGRADE_SEQUENCE_IDS);
  assert.equal(new Set(placements.map(({ sequenceId }) => sequenceId)).size, 29);
  assert.equal(game.arena.boss, true);
  assert.equal(game.director.activeBoss()?.type, "queen");
});

test("starting a new run resets active dialogue, seen IDs, and queued callbacks", () => {
  const { game, events } = createHarness();
  game.startRun("NARRATIVE-STALE-FIRST");

  assert.equal(game.continueDialogue(), true);
  assert.equal(game.continueDialogue(), true);
  assert.equal(game.dialogue.view().position, 2);
  assert.equal(game.enqueueNarrative("ending.kill"), true);
  assert.ok(game.narrativeQueue.some(({ id }) => id === "ending.kill"));

  const restartEventIndex = events.length;
  game.startRun("NARRATIVE-STALE-SECOND");

  assert.equal(game.activeNarrative.id, "opening.domestic");
  assert.equal(game.dialogue.view().position, 1);
  assert.deepEqual(game.narrativeQueue.map(({ id }) => id), [
    "opening.ring",
    "opening.threshold",
    floorProjectionId(1),
  ]);
  assert.deepEqual([...game.seenRunSequences], [
    "opening.domestic",
    "opening.ring",
    "opening.threshold",
    floorProjectionId(1),
  ]);
  assert.equal(game.ending.snapshot().stage, "inactive");

  assert.deepEqual(completeQueuedDialogue(game), [
    "opening.domestic",
    "opening.ring",
    "opening.threshold",
    floorProjectionId(1),
  ]);
  assert.equal(game.phase, "playing");
  assert.equal(
    events.slice(restartEventIndex).some(({ detail }) => detail.sequenceId === "ending.kill"),
    false,
  );
});

test("pause preserves modal dialogue and inline offer phases", () => {
  const { game } = createHarness();

  for (const phase of ["dialogue", "reward", "blessing"]) {
    game.setPhase(phase);
    assert.equal(game.togglePause(1_000), true);
    assert.equal(game.phase, "paused");
    assert.equal(game.pausedPhase, phase);
    assert.equal(game.togglePause(2_000), true);
    assert.equal(game.phase, phase);
    assert.equal(game.pausedPhase, null);
  }
});

test("pausing at the ending deadline resolves timeout without entering a stale pause", () => {
  const { game, events } = createHarness();
  prepareDeterministicDecision(game, events, 10_000, 20_000);

  assert.equal(game.togglePause(15_000), true);
  assert.equal(game.phase, "dialogue");
  assert.equal(game.activeNarrative.id, "ending.timeout");
  assert.equal(game.pausedPhase, null);
  assert.equal(eventCount(events, "endingChoiceResolved"), 1);
});

test("boss defeat completes the Witch's final dialogue before dismissing Witch-origin forces", () => {
  const { game, events } = createHarness();
  game.startRun("NARRATIVE-BOSS-ORDER");
  completeQueuedDialogue(game);
  game.floor = RUN_CONFIG.totalFloors;
  game.room = RUN_CONFIG.roomsPerFloor;
  game.loadRoom();
  assert.deepEqual(completeQueuedDialogue(game), ["boss.confrontation"]);

  const witchGuard = game.director.spawnEnemy(
    "thrall",
    { x: 3, z: 0 },
    RUN_CONFIG.totalFloors,
    { origin: ENEMY_ORIGINS.WITCH },
  );
  const princessRemnant = game.director.spawnEnemy(
    "wraith",
    { x: -3, z: 0 },
    RUN_CONFIG.totalFloors,
    { origin: ENEMY_ORIGINS.PRINCESS },
  );
  const boss = game.director.activeBoss();
  const bossDefeatEventIndex = events.length;

  const bossDefeat = game.director.resolveCombatHit(
    boss,
    combatHit("narrative-boss-defeat", boss.maxHealth, game.player.position),
  );
  const duplicateDefeat = game.director.resolveCombatHit(
    boss,
    combatHit("narrative-boss-repeat", 1, game.player.position),
  );
  assert.equal(bossDefeat.accepted, true);
  assert.equal(bossDefeat.defeated, true);
  assert.equal(duplicateDefeat.accepted, false);
  assert.equal(duplicateDefeat.reason, "inactive");
  assert.equal(game.activeNarrative.id, "ending.witch-death");
  assert.equal(witchGuard.active, true);
  const finalWitchBeatId = game.dialogue.sequence("ending.witch-death").beats.at(-1).id;

  while (game.dialogue.view().position < game.dialogue.view().total) {
    assert.equal(game.continueDialogue(), true);
    assert.equal(game.continueDialogue(), true);
    assert.equal(witchGuard.active, true);
  }
  assert.equal(game.dialogue.view().beatId, finalWitchBeatId);
  assert.equal(game.continueDialogue(), true);
  assert.equal(witchGuard.active, true);
  assert.equal(game.continueDialogue(), true);

  assert.equal(witchGuard.active, false);
  assert.equal(witchGuard.dismissed, true);
  assert.equal(princessRemnant.active, true);
  assert.equal(game.activeNarrative.id, "ending.princess-reveal");

  const endingEvents = events.slice(bossDefeatEventIndex);
  const finalLineIndex = endingEvents.findIndex(({ type, detail }) => (
    type === "dialogueAdvanced" && detail.beatId === finalWitchBeatId
  ));
  const completedIndex = endingEvents.findIndex(({ type, detail }) => (
    type === "dialogueCompleted" && detail.sequenceId === "ending.witch-death"
  ));
  const dismissedIndex = endingEvents.findIndex(({ type }) => type === "witchOriginDismissed");
  const ceasedIndex = endingEvents.findIndex(({ type }) => type === "witchMagicCeased");
  const revealIndex = endingEvents.findIndex(({ type, detail }) => (
    type === "dialogueStarted" && detail.sequenceId === "ending.princess-reveal"
  ));

  assert.ok(finalLineIndex >= 0);
  assert.ok(finalLineIndex < completedIndex);
  assert.ok(completedIndex < dismissedIndex);
  assert.ok(dismissedIndex < ceasedIndex);
  assert.ok(ceasedIndex < revealIndex);
  assert.equal(eventCount(endingEvents, "endingSequenceStarted"), 1);
  assert.equal(eventCount(endingEvents, "witchOriginDismissed"), 1);

  assert.equal(completeActiveSequence(game), "ending.princess-reveal");
  assert.equal(game.activeNarrative.id, "ending.princess-human");
  assert.equal(completeActiveSequence(game), "ending.princess-human");
  assert.equal(game.phase, "endingChoice");
  assert.equal(game.ending.snapshot().stage, "decision");
});

test("the kill ending resolves once, fades once, ends the run once, and persists glossary access", () => {
  const { game, events, progress, storage } = createHarness();
  prepareDeterministicDecision(game, events, 10_000, 20_000);

  assert.equal(progress.isGlossaryUnlocked(), false);
  assert.equal(game.tryKillPrincess(10_000), false);
  assert.equal(game.tryKillPrincess(11_000), true);
  assert.equal(game.tryKillPrincess(11_001), false);
  assert.equal(game.phase, "endingStrike");
  assert.equal(game.activeNarrative, null);
  assert.equal(eventCount(events, "endingChoiceResolved"), 1);
  assert.equal(eventCount(events, "endingStrikeStarted"), 1);
  assert.equal(eventCount(events, "princessStruck"), 0);
  game.updateFixed(NARRATIVE_TIMING.endingStrike.R);
  assert.equal(game.phase, "dialogue");
  assert.equal(game.activeNarrative.id, "ending.kill");
  assert.equal(eventCount(events, "princessStruck"), 1);
  assert.equal(eventCount(events, "endingStrikeCompleted"), 1);
  const decisionIndex = events.findIndex(({ type }) => type === "endingChoiceResolved");
  const startedIndex = events.findIndex(({ type }) => type === "endingStrikeStarted");
  const strikeIndex = events.findIndex(({ type }) => type === "princessStruck");
  const completedIndex = events.findIndex(({ type }) => type === "endingStrikeCompleted");
  const killDialogueIndex = events.findIndex(({ type, detail }) => (
    type === "dialogueStarted" && detail.sequenceId === "ending.kill"
  ));
  assert.ok(decisionIndex < startedIndex);
  assert.ok(startedIndex < strikeIndex);
  assert.ok(strikeIndex < completedIndex);
  assert.ok(completedIndex < killDialogueIndex);

  assert.equal(completeActiveSequence(game), "ending.kill");
  assert.equal(game.phase, "endingFade");
  assert.equal(eventCount(events, "princessKilled"), 1);
  assert.equal(eventCount(events, "corruptionDestroyed"), 1);
  assert.equal(eventCount(events, "endingFadeStarted"), 1);
  assert.equal(progress.isGlossaryUnlocked(), false);

  game.updateNarrativeClock(20_000 + NARRATIVE_TIMING.fadeDurationMs - 1);
  assert.equal(game.phase, "endingFade");
  game.updateNarrativeClock(20_000 + NARRATIVE_TIMING.fadeDurationMs);
  assert.equal(game.phase, "endingComplete");
  game.updateNarrativeClock(20_000 + NARRATIVE_TIMING.fadeDurationMs + 1);
  game.completeEnding();

  assert.equal(eventCount(events, "endingCompleted"), 1);
  assert.equal(eventCount(events, "runEnded"), 1);
  assert.equal(eventCount(events, "glossaryUnlocked"), 1);
  assert.deepEqual(latestEvent(events, "runEnded").detail, {
    completed: true,
    victory: true,
    ending: "kill",
    seed: "ENDING-10000",
  });
  assert.equal(progress.isGlossaryUnlocked(), true);
  assert.equal(storage.writeCount, game.dialogue.sequence("ending.kill").beats.length + 2);
  const reloaded = new NarrativeProgressStore(storage);
  assert.equal(reloaded.isGlossaryUnlocked(), true);
  assert.equal(reloaded.isSequenceCompleted("ending.kill"), true);
});

test("the timeout ending resolves once at the deadline and cannot soft-lock or accept a late kill", () => {
  const { game, events, progress, storage } = createHarness();
  prepareDeterministicDecision(game, events, 30_000, 40_000);

  game.updateNarrativeClock(34_999);
  assert.equal(game.phase, "endingChoice");
  assert.equal(eventCount(events, "endingChoiceResolved"), 0);
  game.updateNarrativeClock(35_000);

  assert.equal(game.phase, "dialogue");
  assert.equal(game.activeNarrative.id, "ending.timeout");
  assert.equal(game.tryKillPrincess(34_999), false);
  assert.equal(eventCount(events, "endingChoiceResolved"), 1);
  assert.deepEqual(latestEvent(events, "endingChoiceResolved").detail.result, {
    id: "timeout",
    resolvedAtMs: 35_000,
  });

  assert.equal(completeActiveSequence(game), "ending.timeout");
  assert.equal(game.phase, "dialogue");
  assert.equal(game.activeNarrative.id, "ending.timeout-final");
  assert.equal(game.player.health, 0);
  assert.equal(eventCount(events, "playerKilledByPrincess"), 1);

  const fatalStrikeIndex = events.findIndex(({ type }) => type === "playerKilledByPrincess");
  const finalExchangeIndex = events.findIndex(({ type, detail }) => (
    type === "dialogueStarted" && detail.sequenceId === "ending.timeout-final"
  ));
  assert.ok(fatalStrikeIndex >= 0);
  assert.ok(fatalStrikeIndex < finalExchangeIndex);

  assert.equal(completeActiveSequence(game), "ending.timeout-final");
  assert.equal(game.phase, "endingFade");
  assert.equal(progress.isGlossaryUnlocked(), false);
  game.updateNarrativeClock(40_000 + NARRATIVE_TIMING.fadeDurationMs);
  assert.equal(game.phase, "endingComplete");
  game.updateNarrativeClock(40_000 + NARRATIVE_TIMING.fadeDurationMs + 1);
  game.completeEnding();

  assert.equal(eventCount(events, "endingChoiceResolved"), 1);
  assert.equal(eventCount(events, "endingFadeStarted"), 1);
  assert.equal(eventCount(events, "endingCompleted"), 1);
  assert.equal(eventCount(events, "runEnded"), 1);
  assert.equal(eventCount(events, "glossaryUnlocked"), 1);
  assert.deepEqual(latestEvent(events, "runEnded").detail, {
    completed: true,
    victory: false,
    ending: "timeout",
    seed: "ENDING-30000",
  });
  assert.equal(progress.isGlossaryUnlocked(), true);
  assert.equal(
    storage.writeCount,
    game.dialogue.sequence("ending.timeout").beats.length
      + game.dialogue.sequence("ending.timeout-final").beats.length
      + 3,
  );
  const reloaded = new NarrativeProgressStore(storage);
  assert.equal(reloaded.isSequenceCompleted("ending.timeout"), true);
  assert.equal(reloaded.isSequenceCompleted("ending.timeout-final"), true);
});
