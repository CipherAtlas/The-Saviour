import assert from "node:assert/strict";
import test from "node:test";
import { createWalkableShape, isCircleWalkable, isWalkableSegment } from "../src/game/arenaGeometry.js";
import { AutoplayAgent, createAutoplayState, findNavigationPath } from "../src/playtest/AutoplayAgent.js";
import { PlaytestReporter } from "../src/playtest/PlaytestReporter.js";

function createState(overrides = {}) {
  return {
    phase: "playing",
    floor: 1,
    room: 1,
    portalActive: false,
    player: {
      position: { x: -4, z: 0 },
      radius: 0.58,
      health: 140,
      maxHealth: 140,
    },
    arena: {
      width: 18,
      depth: 14,
      portal: { x: 0, z: 0 },
      obstacles: [],
    },
    enemies: [],
    projectiles: [],
    telegraphs: [],
    ...overrides,
  };
}

function createAgent(initialState, options = {}) {
  let state = initialState;
  const intents = [];
  const diagnostics = [];
  const agent = new AutoplayAgent({
    readState: () => state,
    actionSink: (intent) => intents.push(intent),
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    ...options,
  });
  return {
    agent,
    intents,
    diagnostics,
    setState(nextState) { state = nextState; },
  };
}

const lShape = createWalkableShape({
  regions: [
    { id: "vertical", role: "combat", x: -4, z: 0, width: 8, depth: 24 },
    { id: "horizontal", role: "combat", x: 4, z: 8, width: 16, depth: 8 },
  ],
  majorRegionIds: ["vertical", "horizontal"],
  connectors: [{ id: "elbow", from: "vertical", to: "horizontal", width: 8 }],
});

test("navigation routes around expanded obstacle footprints", () => {
  const arena = {
    width: 18,
    depth: 14,
    obstacles: [{ x: 0, z: 0, width: 2.5, depth: 7 }],
  };
  const path = findNavigationPath({ x: -6, z: 0 }, { x: 6, z: 0 }, arena);

  assert.ok(path.length > 2);
  assert.ok(path.some((point) => Math.abs(point.z) > 4));
  for (const point of path.slice(1, -1)) {
    const insideObstacle = Math.abs(point.x) <= 2.05 && Math.abs(point.z) <= 4.28;
    assert.equal(insideObstacle, false);
  }
});

test("navigation crosses connected lobes without stepping through a concave void", () => {
  const arena = { width: 20, depth: 24, walkableShape: lShape, obstacles: [] };
  const path = findNavigationPath({ x: -4, z: -8 }, { x: 7, z: 8 }, arena);

  assert.ok(path.length > 2);
  assert.ok(path.every((point) => isCircleWalkable(arena, point, 0.58)));
  for (let index = 1; index < path.length; index += 1) {
    assert.equal(isWalkableSegment(arena, path[index - 1], path[index], 0.58), true);
  }
});

test("shape-aware final steering keeps orbit movement inside a concave boundary", () => {
  const arena = { width: 20, depth: 24, walkableShape: lShape, portal: { x: -4, z: 0 }, obstacles: [] };
  const player = { position: { x: 0.7, z: 4.8 }, radius: 0.58, health: 140, maxHealth: 140 };
  const state = createState({
    player,
    arena,
    enemies: [{ id: 8, type: "reaver", active: true, interactive: true, position: { x: 4.7, z: 4.8 }, health: 90, maxHealth: 90 }],
  });
  const { agent, intents } = createAgent(state);

  agent.tick(1 / 60);

  const movement = intents[0].worldMove;
  const end = { x: player.position.x + movement.x * 2.4, z: player.position.z + movement.z * 2.4 };
  assert.equal(isWalkableSegment(arena, player.position, end, player.radius), true);
});

test("emerging enemies are never selected as targets or treated as attack threats", () => {
  const state = createState({
    player: { position: { x: 0, z: 0 }, radius: 0.58, health: 140, maxHealth: 140 },
    enemies: [
      {
        id: 1, type: "bombardier", active: true, interactive: false, lifecycleState: "emerging",
        position: { x: 1, z: 0 }, health: 100, maxHealth: 100, attackPending: true, attackWindup: 0.1,
      },
      { id: 2, type: "thrall", active: true, interactive: true, lifecycleState: "active", position: { x: 4, z: 0 }, health: 70, maxHealth: 70 },
    ],
  });
  const { agent, intents } = createAgent(state);

  agent.tick(1 / 60);

  assert.equal(intents[0].mode, "fight");
  assert.equal(intents[0].targetId, 2);
});

test("autoplay state exposes authoritative shape, objectives, recipe, and enemy lifecycle", () => {
  const emerging = {
    id: 4,
    type: "hexer",
    origin: "volatile",
    active: true,
    lifecycle: { state: "emerging", remainingSeconds: 0.31 },
    emergenceDurationSeconds: 0.56,
    position: { x: -2, z: 4 },
    radius: 0.6,
    health: 80,
    maxHealth: 80,
  };
  const game = {
    phase: "playing",
    runType: "speedrun",
    difficultyId: "ruthless",
    floor: 7,
    room: 2,
    portalActive: false,
    portalTraversal: null,
    player: { position: { x: -4, z: -8 }, radius: 0.58, health: 120, maxHealth: 140 },
    combat: {
      dashCooldown: 0,
      heavyCooldown: 0,
      harvest: { snapshot: () => ({ units: 0 }) },
      claim: { snapshot: () => ({ phase: "idle" }) },
    },
    arena: {
      width: 20,
      depth: 24,
      layoutFamily: "lShape",
      walkableShape: lShape,
      portal: { x: 7, z: 8 },
      rewardPosition: { x: 5, z: 8 },
      combatZones: [{ id: "north", x: 4, z: 8 }],
      obstacles: [],
    },
    director: {
      encounterPlan: { id: "7-2-hybrid", type: "hybrid", totalPopulation: 13, threat: 18, roleCounts: { ranged: 2 } },
      encounterScheduler: { snapshot: () => ({ living: 7, spawning: 2, pending: 4, maximumSimultaneous: 9 }) },
      enemies: [emerging],
      projectiles: [],
      isEnemyInteractive: (enemy) => enemy.lifecycle.state === "active",
    },
    ending: { snapshot: () => ({ stage: "idle" }) },
    bookend: { snapshot: () => null },
    pendingBlessings: [],
    pendingRoomRewards: [],
  };

  const state = createAutoplayState(game);

  assert.equal(state.runType, "speedrun");
  assert.equal(state.arena.layoutFamily, "lShape");
  assert.equal(state.arena.walkableShape, lShape);
  assert.deepEqual(state.arena.portal, { x: 7, z: 8 });
  assert.deepEqual(state.arena.rewardPosition, { x: 5, z: 8 });
  assert.equal(state.encounter.recipeType, "hybrid");
  assert.deepEqual({ living: state.encounter.living, spawning: state.encounter.spawning, pending: state.encounter.pending }, {
    living: 7, spawning: 2, pending: 4,
  });
  assert.equal(state.enemies[0].interactive, false);
  assert.equal(state.enemies[0].lifecycleState, "emerging");
});

test("the combat policy aims at visible enemies and uses the long-range scythe", () => {
  const state = createState({
    player: { position: { x: 0, z: 0 }, radius: 0.58, health: 140, maxHealth: 140 },
    enemies: [{ id: 7, type: "wraith", active: true, position: { x: 4.8, z: 0 }, radius: 0.6, health: 72, maxHealth: 72 }],
  });
  const { agent, intents } = createAgent(state);

  agent.tick(1 / 60);

  assert.equal(intents[0].mode, "fight");
  assert.equal(intents[0].targetId, 7);
  assert.deepEqual(intents[0].aimPoint, { x: 4.8, z: 0 });
  assert.ok(intents[0].pressed.includes("attack"));
});

test("the combat policy prioritizes ranged specialists before nearby fodder", () => {
  const state = createState({
    player: { position: { x: 0, z: 0 }, radius: 0.58, health: 140, maxHealth: 140 },
    enemies: [
      { id: 1, type: "thrall", active: true, position: { x: 2.2, z: 0 }, health: 62, maxHealth: 62 },
      { id: 2, type: "bombardier", active: true, position: { x: 5.8, z: 0 }, health: 82, maxHealth: 82 },
    ],
  });
  const { agent, intents } = createAgent(state);

  agent.tick(1 / 60);

  assert.equal(intents[0].targetId, 2);
  assert.deepEqual(intents[0].aimPoint, { x: 5.8, z: 0 });
});

test("combat steering turns inward before orbiting into arena corners", () => {
  const cases = [
    {
      arena: { width: 40, depth: 26, portal: { x: 0, z: 0 }, obstacles: [] },
      position: { x: 18.42, z: -11.41 },
      enemyPosition: { x: 22.42, z: -11.41 },
      expectedInward: { x: -1, z: 1 },
    },
    {
      arena: { width: 39, depth: 29, portal: { x: 0, z: 0 }, obstacles: [] },
      position: { x: -17.92, z: -12.92 },
      enemyPosition: { x: -17.92, z: -16.92 },
      expectedInward: { x: 1, z: 1 },
    },
  ];

  for (const scenario of cases) {
    const state = createState({
      player: { position: scenario.position, radius: 0.58, health: 140, maxHealth: 140 },
      arena: scenario.arena,
      enemies: [{
        id: 3,
        type: "reaver",
        active: true,
        position: scenario.enemyPosition,
        radius: 0.6,
        health: 72,
        maxHealth: 72,
      }],
    });
    const { agent, intents } = createAgent(state);

    agent.tick(1 / 60);

    assert.equal(intents[0].mode, "fight");
    assert.ok(intents[0].worldMove.x * scenario.expectedInward.x > 0.1);
    assert.ok(intents[0].worldMove.z * scenario.expectedInward.z > 0.1);
  }
});

test("combat orbit steering is unchanged in open arena space", () => {
  const state = createState({
    player: { position: { x: 0, z: 0 }, radius: 0.58, health: 140, maxHealth: 140 },
    enemies: [{ id: 5, type: "reaver", active: true, position: { x: 4, z: 0 }, radius: 0.6, health: 72, maxHealth: 72 }],
  });
  const { agent, intents } = createAgent(state);

  agent.tick(1 / 60);

  assert.ok(intents[0].worldMove.x > 0.1);
  assert.ok(intents[0].worldMove.z < -0.9);
});

test("an incoming projectile triggers perpendicular movement and a defensive dash", () => {
  const state = createState({
    player: { position: { x: 0, z: 0 }, radius: 0.58, health: 140, maxHealth: 140 },
    enemies: [{ id: 2, type: "archer", active: true, position: { x: 7, z: 0 }, health: 50, maxHealth: 50 }],
    projectiles: [{ active: true, position: { x: 3, z: 0 }, velocity: { x: -10, z: 0 }, radius: 0.25 }],
  });
  const { agent, intents } = createAgent(state);

  agent.tick(1 / 60);

  assert.equal(intents[0].mode, "evade");
  assert.ok(Math.abs(intents[0].worldMove.z) > 0.9);
  assert.ok(intents[0].pressed.includes("dash"));
  assert.ok(intents[0].danger > 1);
});

test("projectile evasion is redirected away from an arena corner", () => {
  const state = createState({
    player: { position: { x: 18.42, z: -11.41 }, radius: 0.58, health: 140, maxHealth: 140 },
    arena: { width: 40, depth: 26, portal: { x: 0, z: 0 }, obstacles: [] },
    enemies: [{ id: 2, type: "hexer", active: true, position: { x: 12, z: -11 }, health: 50, maxHealth: 50 }],
    projectiles: [{
      active: true,
      position: { x: 15.42, z: -11.41 },
      velocity: { x: 10, z: 0 },
      radius: 0.25,
    }],
  });
  const { agent, intents } = createAgent(state);

  agent.tick(1 / 60);

  assert.equal(intents[0].mode, "evade");
  assert.ok(intents[0].worldMove.x < -0.1);
  assert.ok(intents[0].worldMove.z > 0.1);
});

test("bookend, Oath, and portal phases use only their public action contracts", () => {
  const bookend = createAgent(createState({
    phase: "bookend",
    bookend: { active: true },
  }));
  bookend.agent.tick(1 / 60);
  assert.deepEqual(bookend.intents[0].uiAction, { type: "continueBookend" });

  const ending = createAgent(createState({ phase: "endingChoice", ending: { stage: "decision" } }));
  ending.agent.tick(1 / 60);
  assert.deepEqual(ending.intents[0].uiAction, { type: "killPrincess" });

  const blessing = createAgent(createState({
    phase: "blessing",
    player: { position: { x: 0, z: 0 }, health: 25, maxHealth: 140 },
    blessing: { choices: [
      { id: "damage", description: "Damage increases." },
      { id: "health", description: "Gain maximum health and heal." },
    ] },
  }));
  blessing.agent.tick(1 / 60);
  assert.deepEqual(blessing.intents[0].uiAction, { type: "chooseBlessing", id: "health" });

  const portal = createAgent(createState({
    player: { position: { x: 0, z: 1.4 }, radius: 0.58, health: 100, maxHealth: 140 },
    portalActive: true,
  }));
  portal.agent.tick(1 / 60);
  assert.equal(portal.intents[0].mode, "enter-portal");
  assert.deepEqual(portal.intents[0].pressed, []);
});

test("repeated failed movement produces a bounded, observable stuck recovery", () => {
  const state = createState({
    enemies: [{ id: 4, type: "archer", active: true, position: { x: 6, z: 0 }, health: 50, maxHealth: 50 }],
  });
  const { agent, intents, diagnostics } = createAgent(state, {
    config: { stuckSeconds: 0.2, stuckProgressDistance: 0.5 },
  });

  for (let index = 0; index < 20; index += 1) agent.tick(1 / 60);

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].type, "stuckRecovery");
  assert.ok(intents.some((intent) => intent.mode === "recover"));
});

test("an impossible route fails closed and emits one reproducible diagnostic", () => {
  const state = createState({
    player: { position: { x: -4, z: 0 }, radius: 0.58, health: 140, maxHealth: 140 },
    arena: {
      width: 12,
      depth: 8,
      portal: { x: 0, z: 0 },
      obstacles: [{ x: 0, z: 0, width: 12, depth: 8 }],
    },
    enemies: [{ id: 9, type: "thrall", active: true, position: { x: 4, z: 0 }, health: 70, maxHealth: 70 }],
  });
  const { agent, intents, diagnostics } = createAgent(state);

  agent.tick(1 / 60);
  agent.tick(1 / 60);

  assert.deepEqual(intents[0].worldMove, { x: 0, z: 0 });
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].type, "navigationUnreachable");
  assert.deepEqual(diagnostics[0].target, { x: 4, z: 0 });
});

test("the reporter emits a serializable full-run assessment", () => {
  const reporter = new PlaytestReporter({ expectedEnemyTypeCount: 3, targetFps: 60 });
  reporter.beginRun({ runNumber: 1, seed: "REPORT-SEED" });
  reporter.recordEvent({ type: "runStarted", detail: { seed: "REPORT-SEED" } });
  reporter.recordEvent({ type: "arenaChanged", detail: { floor: 1, room: 1, boss: false } });
  reporter.sample({
    dt: 10,
    state: createState({
      enemies: [
        { type: "wraith", active: true },
        { type: "archer", active: true },
        { type: "sentinel", active: true },
      ],
    }),
    intent: { mode: "fight", pressed: ["attack", "dash"], recoveryStarted: false },
    performance: { fps: 72, cpuMs: 3.2, gpuMs: 4.1, drawCalls: 64, triangles: 120000, longTask: true },
  });
  reporter.recordEvent({ type: "enemyTelegraph", detail: { type: "wraith" } });
  reporter.recordEvent({ type: "enemyAttack", detail: { type: "wraith" } });
  reporter.recordEvent({ type: "attack", detail: { heavy: false, dash: false } });
  reporter.recordEvent({ type: "attack", detail: { heavy: true, dash: false } });
  reporter.recordEvent({ type: "dash", detail: {} });
  reporter.recordEvent({ type: "enemyHit", detail: { type: "wraith", damage: 35, critical: true } });
  reporter.recordEvent({ type: "enemyDefeated", detail: { type: "wraith" } });
  reporter.recordEvent({ type: "playerHit", detail: { amount: 12, source: "wraith" } });
  reporter.recordEvent({ type: "bookendStarted", detail: { sequenceId: "intro" } });
  reporter.recordEvent({ type: "blessingOffered", detail: {} });
  reporter.recordEvent({ type: "roomCleared", detail: { floor: 1, room: 1 } }, 24);
  reporter.recordEvent({ type: "blessingChosen", detail: {
    id: "falling-moon", name: "Falling Moon", path: "Reaper", rank: 1,
  } });
  reporter.recordEvent({
    type: "endingDecisionStarted",
    detail: { decision: { startedAtMs: 10_000 } },
  }, 29);
  reporter.recordEvent({
    type: "endingChoiceResolved",
    detail: {
      ending: "kill",
      result: { resolvedAtMs: 115_000 },
      decision: { durationMs: 5_000, remainingMs: 0 },
    },
  }, 49);
  reporter.recordEvent({ type: "runEnded", detail: { completed: true, victory: true, ending: "kill" } }, 50);

  const report = reporter.finalize();
  const json = reporter.serialize();

  assert.equal(report.outcome.victory, true);
  assert.equal(report.outcome.ending, "kill");
  assert.deepEqual(report.progression.endingDecision, {
    startedAt: 29,
    resolvedAt: 49,
    durationSeconds: 5,
    outcome: "kill",
  });
  assert.equal(report.combat.damageDealt, 35);
  assert.equal(report.combat.killsByType.wraith, 1);
  assert.equal(report.combat.encounteredByType.wraith, 1);
  assert.equal(report.progression.rooms[0].clearSeconds, 24);
  assert.equal(report.progression.pathRanks.Reaper, 1);
  assert.deepEqual(report.progression.bookendSequences, ["intro"]);
  assert.equal(report.performance.fpsP05, 72);
  assert.equal(report.experience.recommendations.some((item) => item.category === "performance"), false);
  assert.ok(report.experience.whatWasGood.length > 0);
  assert.doesNotThrow(() => JSON.parse(json));
  assert.equal(json.includes("NaN"), false);
});
