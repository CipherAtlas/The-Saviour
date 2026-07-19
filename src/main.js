import "./styles.css";
import { AudioSystem } from "./audio/AudioSystem.js";
import { Game } from "./game/Game.js";
import { RunSessionController } from "./game/RunSessionController.js";
import { CAMERA_CONFIG, RUN_CONFIG } from "./game/gameConfig.js";
import { InputController } from "./game/InputController.js";
import { AutoplayAgent } from "./playtest/AutoplayAgent.js";
import { PlaytestReporter } from "./playtest/PlaytestReporter.js";
import { GameRenderer } from "./rendering/GameRenderer.js";
import { SettingsStore } from "./settings/SettingsStore.js";
import { NarrativeProgressStore } from "./settings/NarrativeProgressStore.js";
import { StatisticsStore } from "./settings/StatisticsStore.js";
import { SuspendedRunStore } from "./settings/SuspendedRunStore.js";
import { GameUi } from "./ui/GameUi.js";
import { SettingsMenu } from "./ui/SettingsMenu.js";

function worldToScreenMovement(worldMove) {
  const sinYaw = Math.sin(CAMERA_CONFIG.yaw);
  const cosYaw = Math.cos(CAMERA_CONFIG.yaw);
  return {
    x: worldMove.x * sinYaw - worldMove.z * cosYaw,
    y: -worldMove.x * cosYaw - worldMove.z * sinYaw,
  };
}

function screenToWorldDirection(screenDirection) {
  const sinYaw = Math.sin(CAMERA_CONFIG.yaw);
  const cosYaw = Math.cos(CAMERA_CONFIG.yaw);
  return {
    x: screenDirection.x * sinYaw - screenDirection.y * cosYaw,
    z: -screenDirection.x * cosYaw - screenDirection.y * sinYaw,
  };
}

function autoplayState(game, telegraphs) {
  return {
    phase: game.phase,
    floor: game.floor,
    room: game.room,
    portalActive: game.portalActive,
    portalTraversal: game.portalTraversal ? {
      active: game.portalTraversal.active,
      progress: game.portalTraversal.progress,
    } : null,
    player: game.player ? {
      position: { ...game.player.position },
      radius: game.player.radius,
      health: game.player.health,
      maxHealth: game.player.maxHealth,
      cooldowns: {
        dashReady: game.combat.dashCooldown <= 0,
        heavyReady: game.combat.heavyCooldown <= 0,
      },
      harvest: game.combat.harvest.snapshot(),
      claim: game.combat.claim.snapshot(),
    } : null,
    arena: game.arena ? {
      width: game.arena.width,
      depth: game.arena.depth,
      portal: { ...game.arena.portal },
      obstacles: game.arena.obstacles.map((obstacle) => ({ ...obstacle })),
    } : null,
    enemies: game.director.enemies.map((enemy) => ({
      id: enemy.id,
      type: enemy.type,
      active: enemy.active,
      position: { ...enemy.position },
      radius: enemy.radius,
      health: enemy.health,
      maxHealth: enemy.maxHealth,
      attackPending: enemy.attackPending,
      attackWindup: enemy.attackWindup,
      attackRange: enemy.attackRange,
    })),
    projectiles: game.director.projectiles.filter((projectile) => projectile.active).map((projectile) => ({
      active: true,
      kind: projectile.kind,
      mode: projectile.mode,
      position: { ...projectile.position },
      velocity: { ...projectile.velocity },
      radius: projectile.radius,
      areaRadius: projectile.areaRadius,
      target: { ...projectile.target },
      timeRemaining: projectile.life,
    })),
    telegraphs: telegraphs.map((telegraph) => ({ ...telegraph, position: { ...telegraph.position } })),
    dialogue: game.phase === "dialogue" ? { active: Boolean(game.dialogue.view()) } : null,
    ending: game.ending.snapshot(),
    blessing: game.phase === "blessing" ? {
      choices: game.pendingBlessings.map(({ id, name, description, path, rank, nextRank, maxRank }) => ({
        id, name, description, path, rank, nextRank, maxRank,
      })),
    } : null,
    reward: game.phase === "reward" ? {
      choices: game.pendingRoomRewards.map(({ id, name, description, path, rank, nextRank, maxRank }) => ({
        id, name, description, path, rank, nextRank, maxRank,
      })),
    } : null,
  };
}

function createAutoplayRuntime({ game, input, renderer, settings, runNumber, seed, endingPolicy }) {
  const telegraphs = [];
  const reporter = new PlaytestReporter({ targetFps: 60 });
  reporter.beginRun({ runNumber, seed, difficulty: settings.get("gameplay.difficulty") });
  const reportElement = document.createElement("pre");
  reportElement.id = "playtest-report";
  reportElement.dataset.status = "running";
  reportElement.hidden = true;
  document.body.append(reportElement);
  let active = true;
  let latestIntent = null;
  let longTasks = 0;

  const observer = typeof PerformanceObserver !== "undefined"
    ? new PerformanceObserver((list) => { longTasks += list.getEntries().length; })
    : null;
  try { observer?.observe({ type: "longtask", buffered: false }); } catch { /* Optional browser metric. */ }

  function readState() {
    return autoplayState(game, telegraphs);
  }

  function applyIntent(intent) {
    latestIntent = intent;
    if (intent.uiAction) reporter.recordIntent(intent, 0);
    if (intent.aimPoint) game.setAimPoint(intent.aimPoint);
    input.setAutomationIntent({
      movement: worldToScreenMovement(intent.worldMove),
      pressed: intent.pressed,
      held: intent.held,
    });
    const action = intent.uiAction;
    if (!action) return;
    if (action.type === "continueDialogue") game.continueDialogue();
    if (action.type === "killPrincess") game.tryKillPrincess(performance.now());
    if (action.type === "chooseRoomReward") game.chooseRoomReward(action.id);
    if (action.type === "chooseBlessing") game.chooseBlessing(action.id);
  }

  const agent = new AutoplayAgent({
    readState,
    actionSink: applyIntent,
    onDiagnostic: (diagnostic) => reporter.recordDiagnostic(diagnostic),
    config: { endingPolicy },
  });

  function finish() {
    if (reportElement.dataset.status === "complete") return;
    active = false;
    input.clearAutomation();
    observer?.disconnect();
    const report = reporter.finalize();
    reportElement.textContent = JSON.stringify(report);
    reportElement.dataset.status = "complete";
    reportElement.dataset.victory = String(report.outcome.victory);
    reportElement.dataset.floor = String(game.floor);
    reportElement.dataset.room = String(game.room);
    globalThis.__ROGUE_PLAYTEST_REPORT__ = report;
  }

  return {
    get active() { return active; },

    tick(dt) {
      if (active) agent.tick(dt);
    },

    afterFixed(dt) {
      for (let index = telegraphs.length - 1; index >= 0; index -= 1) {
        telegraphs[index].timeRemaining -= dt;
        if (telegraphs[index].timeRemaining <= 0) telegraphs.splice(index, 1);
      }
    },

    sample(dt, frameMs, cpuMs) {
      if (!active || dt <= 0) return;
      const metrics = renderer.metrics();
      reporter.sample({
        state: readState(),
        intent: latestIntent,
        dt,
        performance: {
          fps: frameMs > 0 ? 1000 / frameMs : 0,
          cpuMs,
          gpuMs: metrics.gpuMs,
          drawCalls: metrics.drawCalls,
          triangles: metrics.triangles,
          longTasks,
        },
      });
      longTasks = 0;
    },

    handleEvent(event) {
      reporter.recordEvent(event);
      if (event.type === "enemyTelegraph") {
        telegraphs.push({
          ...event.detail,
          timeRemaining: event.detail.duration ?? 0.45,
        });
      }
      if (event.type === "enemyAttack") {
        const index = telegraphs.findIndex((telegraph) => telegraph.enemyId === event.detail.enemyId);
        if (index >= 0) telegraphs.splice(index, 1);
      }
      if (event.type === "runEnded") finish();
    },
  };
}

function updateRuntimeProbe(probe, game, renderer) {
  const boss = game.director.activeBoss();
  const bossPattern = game.director.queenPatternState;
  probe.dataset.phase = game.phase;
  probe.dataset.showcase = game.showcaseMode ?? "";
  probe.dataset.floor = String(game.floor);
  probe.dataset.room = String(game.room);
  probe.dataset.roomReady = String(game.roomReady);
  probe.dataset.portalActive = String(game.portalActive);
  probe.dataset.portalProgress = game.portalTraversal ? game.portalTraversal.progress.toFixed(3) : "";
  probe.dataset.portalHeight = game.portalTraversal ? game.portalTraversal.visualHeight.toFixed(3) : "";
  probe.dataset.playerX = game.player ? game.player.position.x.toFixed(3) : "";
  probe.dataset.playerZ = game.player ? game.player.position.z.toFixed(3) : "";
  probe.dataset.playerAimAngle = game.player ? game.player.aimAngle.toFixed(5) : "";
  probe.dataset.attackFacing = Number.isFinite(game.combat.attackFacing) ? game.combat.attackFacing.toFixed(5) : "";
  probe.dataset.attackKind = game.combat.attackKind ?? "";
  probe.dataset.comboIndex = String(game.combat.comboIndex);
  const harvest = game.combat.harvest.snapshot();
  const claim = game.combat.claim.snapshot();
  probe.dataset.harvestUnits = String(harvest.units);
  probe.dataset.harvestSegments = String(harvest.filledSegments);
  probe.dataset.claimActionId = claim.actionId ?? "";
  probe.dataset.claimPhase = claim.phase;
  probe.dataset.claimX = claim.scythePosition.x.toFixed(3);
  probe.dataset.claimZ = claim.scythePosition.z.toFixed(3);
  probe.dataset.bossPhase = boss ? String(boss.bossPhase) : "";
  probe.dataset.bossHealth = boss ? boss.health.toFixed(2) : "";
  probe.dataset.bossMaxHealth = boss ? String(boss.maxHealth) : "";
  probe.dataset.bossAttack = boss
    ? boss.attackKind ?? bossPattern?.lastAction ?? boss.lastAttackKind ?? ""
    : "";
  probe.dataset.bossPattern = boss && bossPattern ? bossPattern.queue.join(",") : "";
  probe.dataset.enemyCount = String(game.director.enemies.length);
  probe.dataset.activeEnemies = String(game.director.enemies.filter((enemy) => enemy.active).length);
  probe.dataset.endingStage = game.ending.snapshot().stage;
  probe.dataset.endingResult = game.ending.snapshot().result?.id ?? "";
  probe.dataset.endingPresentation = game.endingPresentationStage;
  const metrics = renderer.metrics();
  probe.dataset.drawCalls = String(metrics.drawCalls);
  probe.dataset.triangles = String(metrics.triangles);
  probe.dataset.activeActors = String(metrics.activeActors ?? 0);
  probe.dataset.activeMixers = String(metrics.activeMixers ?? 0);
  probe.dataset.proxyActors = String(metrics.proxyActors ?? 0);
  probe.dataset.damageNumbers = String(metrics.damageNumbers?.active ?? 0);
  probe.dataset.damageNumberCapacity = String(metrics.damageNumbers?.capacity ?? 0);
  probe.dataset.damageNumberPeak = String(metrics.damageNumbers?.peak ?? 0);
  probe.dataset.damageNumberDropped = String(metrics.damageNumbers?.dropped ?? 0);
}

const searchParams = new URLSearchParams(window.location.search);
const requestedShowcase = searchParams.get("showcase");
const showcaseMode = ["boss", "reward", "ending"].includes(requestedShowcase) ? requestedShowcase : null;
const autoplayEnabled = searchParams.get("autoplay") === "1" && showcaseMode !== "reward";
const endingPolicy = searchParams.get("ending") === "timeout" ? "timeout" : "kill";
const autoplayRunNumber = Math.max(1, Number(searchParams.get("run")) || 1);
const simulationScale = autoplayEnabled ? Math.min(4, Math.max(1, Number(searchParams.get("timeScale")) || 4)) : 1;
const canvas = document.querySelector("#game-canvas");
const combatOverlay = document.querySelector("#combat-overlay");
const uiRoot = document.querySelector("#ui");
const runtimeProbe = document.createElement("pre");
runtimeProbe.id = "runtime-probe";
runtimeProbe.hidden = true;
document.body.append(runtimeProbe);
const settings = new SettingsStore(searchParams.get("benchmark") === "1" ? null : undefined);
const narrativeProgress = new NarrativeProgressStore(searchParams.get("benchmark") === "1" ? null : undefined);
const statistics = new StatisticsStore(searchParams.get("benchmark") === "1" ? null : undefined);
const suspendedRuns = new SuspendedRunStore(searchParams.get("benchmark") === "1" ? null : undefined);
if (autoplayEnabled) settings.set("gameplay.difficulty", searchParams.get("difficulty") ?? "standard");
const input = new InputController(canvas, settings);
const audio = new AudioSystem(settings);
const renderer = new GameRenderer(canvas, settings, combatOverlay);
const game = new Game(input, settings, { requireRoomReady: true, narrativeProgress });
const runSession = new RunSessionController({
  game,
  settings,
  suspendedRuns,
  statistics,
  platform: Object.freeze({ canQuit: false, quit: null }),
});
const settingsMenu = new SettingsMenu(uiRoot, settings, input);
const ui = new GameUi(uiRoot, game, settings, input, audio, settingsMenu, narrativeProgress, runSession);
let autoplayRuntime = null;

input.onActiveDeviceChanged((event) => game.emit(event.type, event.detail));

renderer.setLoadProgressListener((progress) => ui.setLoadingProgress(progress));

game.on((event) => {
  runSession.handleEvent(event);
  if (event.type === "endingCompleted" && narrativeProgress.unlockGlossary()) {
    game.emit("glossaryUnlocked", narrativeProgress.getSnapshot());
  }
  renderer.handleEvent(event, game);
  audio.handleEvent(event);
  ui.handleEvent(event);
  autoplayRuntime?.handleEvent(event);
  if (event.type === "arenaChanged") {
    const { loadToken } = event.detail;
    renderer.whenWorldReady()
      .then((readyToken) => game.acknowledgeRoomReady(readyToken))
      .catch((error) => {
        console.error("Unable to build dungeon biome", error);
        game.failRoomLoad(loadToken);
      });
  }
});

settings.subscribe((values) => {
  renderer.applySettings(values);
  audio.applySettings(values);
  ui.applySettings(values);
});

let foregroundFocused = document.hasFocus();
window.addEventListener("focus", () => {
  foregroundFocused = true;
  audio.setFocused(true);
});
window.addEventListener("blur", () => {
  foregroundFocused = false;
  audio.setFocused(false);
  runSession.flush();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) runSession.flush();
  if (document.hidden && ["playing", "dialogue", "endingChoice"].includes(game.phase)) game.togglePause(performance.now());
});
window.addEventListener("pagehide", () => runSession.flush());

try {
  await renderer.ready;
  ui.setReady();
} catch (error) {
  console.error("Unable to prepare game assets", error);
  ui.setLoadError();
}

const showcaseSeed = searchParams.get("seed") ?? (
  showcaseMode === "boss" ? "SHOWCASE-BOSS" : showcaseMode === "ending" ? "SHOWCASE-ENDING" : "SHOWCASE-REWARD"
);
const autoplaySeed = showcaseMode === "boss" ? showcaseSeed : searchParams.get("seed") ?? `AI-RUN-${autoplayRunNumber}`;
if (autoplayEnabled) {
  autoplayRuntime = createAutoplayRuntime({
    game,
    input,
    renderer,
    settings,
    runNumber: autoplayRunNumber,
    seed: autoplaySeed,
    endingPolicy,
  });
}
if (showcaseMode === "boss") game.enterBossShowcase(showcaseSeed);
else if (showcaseMode === "reward") game.enterRewardShowcase(showcaseSeed);
else if (showcaseMode === "ending") game.enterEndingShowcase(showcaseSeed);
else if (autoplayRuntime) game.startRun(autoplaySeed);

let benchmark = null;
if (searchParams.get("benchmark") === "1") {
  const { createBenchmarkHarness } = await import("./benchmark/benchmarkHarness.js");
  benchmark = createBenchmarkHarness(game, renderer, ui);
}

let previousTime = performance.now();
let accumulator = 0;
let lastPresentedAt = 0;
let dialogueFastForwardHeld = false;

renderer.setAnimationLoop((time) => {
  input.pollGamepads(undefined, time);
  const fpsLimit = settings.get("graphics.fpsLimit");
  const minimumFrameMs = fpsLimit === "unlimited" ? 0 : 1000 / Number(fpsLimit);
  if (minimumFrameMs > 0 && time - lastPresentedAt < minimumFrameMs - 0.5) return;

  const rawDelta = Math.min(0.1, Math.max(0, (time - previousTime) / 1000));
  const cpuStart = performance.now();
  previousTime = time;
  lastPresentedAt = time;
  runSession.sampleTime(rawDelta, game.phase, foregroundFocused && !document.hidden);

  const dialogueWasActive = game.phase === "dialogue";
  const menuInputHandled = dialogueWasActive ? false : ui.handleMenuInput(time);
  if (!dialogueWasActive && !menuInputHandled) {
    const pauseInput = input.consumePressed("pause");
    if (pauseInput) game.togglePause(pauseInput.timeStamp);
  }

  if (dialogueWasActive) {
    const view = game.dialogue.snapshot();
    const attackInput = input.consumePressed("attack");
    const interactInput = input.consumePressed("interact");
    const advanceInput = attackInput ?? interactInput;
    const autoInput = input.consumePressed("heavy");
    const historyInput = input.consumePressed("dash");
    const hideInput = input.consumePressed("moveUp");
    const skipInput = input.consumePressed("moveDown");
    const pauseInput = input.consumePressed("pause");
    if (view?.backlogOpen) {
      const closeInput = pauseInput ?? historyInput;
      if (closeInput) game.closeDialogueBacklog(closeInput.timeStamp);
    } else if (view?.skipConfirmationOpen) {
      if (advanceInput) game.confirmDialogueSkip(advanceInput.timeStamp);
      else {
        const cancelInput = pauseInput ?? historyInput;
        if (cancelInput) game.cancelDialogueOverlay(cancelInput.timeStamp);
      }
    } else {
      if (pauseInput) {
        if (dialogueFastForwardHeld) game.setDialogueFastForward(false, pauseInput.timeStamp);
        dialogueFastForwardHeld = false;
        game.togglePause(pauseInput.timeStamp);
      }
      else if (advanceInput) game.continueDialogue(advanceInput.timeStamp);
      else if (autoInput) game.toggleDialogueAuto(autoInput.timeStamp);
      else if (historyInput) game.openDialogueBacklog(historyInput.timeStamp);
      else if (hideInput) game.toggleDialogueUi(hideInput.timeStamp);
      else if (skipInput) game.requestDialogueSkip(skipInput.timeStamp);
    }
    if (game.phase === "dialogue") {
      const activeView = game.dialogue.snapshot();
      const fastForwardHeld = !activeView?.backlogOpen && !activeView?.skipConfirmationOpen && input.isDown("claim");
      if (fastForwardHeld !== dialogueFastForwardHeld) {
        dialogueFastForwardHeld = fastForwardHeld;
        game.setDialogueFastForward(fastForwardHeld, time);
      }
    }
    input.flushActions(["attack", "interact", "heavy", "dash", "moveUp", "moveDown", "claim", "pause"]);
  } else {
    dialogueFastForwardHeld = false;
  }

  if (game.phase === "endingChoice") {
    const killInput = input.consumePressed("attack") ?? input.consumePressed("interact");
    if (killInput) game.tryKillPrincess(killInput.timeStamp);
  }
  game.updateNarrativeClock(time);

  if (game.player && !autoplayRuntime?.active) {
    const pointerGround = renderer.screenToGround(input.pointerNdc);
    const aimIntent = input.aimIntent(pointerGround);
    if (aimIntent?.kind === "worldPoint") {
      game.setAimPoint({ x: aimIntent.x, z: aimIntent.z });
    } else if (aimIntent?.kind === "direction") {
      const direction = screenToWorldDirection(aimIntent);
      game.setAimPoint({
        x: game.player.position.x + direction.x * 10,
        z: game.player.position.z + direction.z * 10,
      });
    }
  }
  accumulator += Math.min(rawDelta * simulationScale, RUN_CONFIG.fixedStep * RUN_CONFIG.maxFixedSteps);
  let fixedSteps = 0;
  while (accumulator >= RUN_CONFIG.fixedStep && fixedSteps < RUN_CONFIG.maxFixedSteps) {
    autoplayRuntime?.tick(RUN_CONFIG.fixedStep);
    game.updateFixed(RUN_CONFIG.fixedStep);
    autoplayRuntime?.afterFixed(RUN_CONFIG.fixedStep);
    accumulator -= RUN_CONFIG.fixedStep;
    fixedSteps += 1;
  }
  const alpha = accumulator / RUN_CONFIG.fixedStep;
  renderer.syncState(game, alpha, rawDelta);
  ui.updateCombatResources(game);
  audio.update();
  renderer.render();
  input.endFrame(fixedSteps);
  updateRuntimeProbe(runtimeProbe, game, renderer);

  const cpuMs = performance.now() - cpuStart;
  autoplayRuntime?.sample(fixedSteps * RUN_CONFIG.fixedStep, rawDelta * 1000, cpuMs);
  benchmark?.recordFrame(rawDelta * 1000, cpuMs, renderer.metrics());
});

globalThis.__ROGUE_GAME__ = {
  game,
  renderer,
  settings,
  runSession,
  getMetrics: () => renderer.metrics(),
};
