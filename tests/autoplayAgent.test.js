import assert from "node:assert/strict";
import test from "node:test";
import { AutoplayAgent, findNavigationPath } from "../src/playtest/AutoplayAgent.js";
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

test("dialogue, reward, blessing, and portal phases use only their public action contracts", () => {
  const dialogue = createAgent(createState({
    phase: "dialogue",
    dialogue: { awaitingResponse: false, choices: [{ text: "A" }, { text: "B" }] },
  }));
  dialogue.agent.tick(1 / 60);
  assert.deepEqual(dialogue.intents[0].uiAction, { type: "chooseDialogue", index: 0 });

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

  const reward = createAgent(createState({
    phase: "reward",
    player: { position: { x: 0, z: 0 }, health: 30, maxHealth: 140 },
    reward: { choices: [
      { id: "reaper", path: "Reaper", description: "Damage increases.", rank: 0 },
      { id: "grave", path: "Grave", description: "Gain maximum health and heal.", rank: 0 },
    ] },
  }));
  reward.agent.tick(1 / 60);
  assert.deepEqual(reward.intents[0].uiAction, { type: "chooseRoomReward", id: "grave" });

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
  reporter.recordEvent({ type: "roomCleared", detail: { floor: 1, room: 1 } }, 24);
  reporter.recordEvent({ type: "roomRewardChosen", detail: {
    floor: 1, room: 1, id: "whetted-crescent", name: "Whetted Crescent", path: "Reaper", rank: 1,
  } });
  reporter.recordEvent({ type: "blessingChosen", detail: { id: "grave-edge", name: "Grave-Tempered Edge" } });
  reporter.recordEvent({ type: "runEnded", detail: { victory: true, ending: "homecoming" } }, 30);

  const report = reporter.finalize();
  const json = reporter.serialize();

  assert.equal(report.outcome.victory, true);
  assert.equal(report.combat.damageDealt, 35);
  assert.equal(report.combat.killsByType.wraith, 1);
  assert.equal(report.combat.encounteredByType.wraith, 1);
  assert.equal(report.progression.rooms[0].clearSeconds, 24);
  assert.equal(report.progression.chamberRewards.length, 1);
  assert.equal(report.progression.pathRanks.Reaper, 1);
  assert.equal(report.performance.fpsP05, 72);
  assert.equal(report.experience.recommendations.some((item) => item.category === "performance"), false);
  assert.ok(report.experience.whatWasGood.length > 0);
  assert.doesNotThrow(() => JSON.parse(json));
  assert.equal(json.includes("NaN"), false);
});
