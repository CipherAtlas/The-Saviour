import assert from "node:assert/strict";
import test from "node:test";
import { BLESSINGS } from "../src/game/blessings.js";
import { Game } from "../src/game/Game.js";
import { CLAIM_CONFIG, RUN_CONFIG } from "../src/game/gameConfig.js";
import { applyProgressionChoice } from "../src/game/progressionModel.js";
import {
  chargedReapProfile,
  claimConfigOverrides,
  comboProfile,
  dashProfile,
  graveLineProfile,
  progressionBuildSnapshot,
  progressionConditionsSnapshot,
} from "../src/game/progressionRuntime.js";

const CATALOG = new Map(BLESSINGS.map((definition) => [definition.id, definition]));

function createInput() {
  return {
    settings: { get: () => "hold" },
    movement: () => ({ x: 0, y: 0 }),
    isDown: () => false,
    consume: () => false,
    consumePressed: () => null,
    consumeReleased: () => null,
    flushActions: () => {},
  };
}

function createSettings() {
  const values = { "gameplay.difficulty": "standard", "gameplay.autoTarget": 0, "gameplay.aimAssist": 0 };
  return { get: (path) => values[path] };
}

function playerState() {
  return {
    health: 140,
    maxHealth: 140,
    damageMultiplier: 1,
    reachMultiplier: 1,
    dashCooldownMultiplier: 1,
    criticalChance: 0.05,
    modifierRanks: {},
  };
}

function grant(player, id, rank = 1, ranks = new Map()) {
  const definition = CATALOG.get(id);
  assert.ok(definition, id);
  for (let next = 1; next <= rank; next += 1) {
    assert.equal(applyProgressionChoice(definition, player, ranks)?.rank, next, `${id} rank ${next}`);
  }
  return ranks;
}

function profiledPlayer(id, rank) {
  const player = playerState();
  grant(player, id, rank);
  return player;
}

function closeTo(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} must equal ${expected}`);
}

test("combo Oaths preserve three distinct gains and permanent tradeoffs", () => {
  const headsman = profiledPlayer("headsmans-cadence", 2);
  closeTo(comboProfile(headsman, 0).damageMultiplier, 0.88);
  closeTo(comboProfile(headsman, 2).damageMultiplier, 1.7);

  const ghost = profiledPlayer("ghost-cadence", 2);
  assert.deepEqual(comboProfile(ghost, 1), {
    damageMultiplier: 0.92,
    poiseMultiplier: 1,
    reachMultiplier: 0.85,
    timingMultiplier: 0.8,
  });

  const pallbearer = profiledPlayer("pallbearers-cadence", 2);
  closeTo(comboProfile(pallbearer, 0).damageMultiplier, 0.9);
  closeTo(comboProfile(pallbearer, 2).poiseMultiplier, 1.45);
});

test("Charged Reap Oaths distinguish precision, speed, and health-payment builds", () => {
  const falling = chargedReapProfile(profiledPlayer("falling-moon", 2), "perfect");
  closeTo(falling.damageMultiplier, 1.65);
  closeTo(falling.poiseMultiplier, 1.8);
  assert.equal(falling.perfectWindowSeconds, 0.055);

  const quick = chargedReapProfile(profiledPlayer("quick-orbit", 2), "full");
  closeTo(quick.damageMultiplier, 0.85);
  closeTo(quick.poiseMultiplier, 0.85);
  closeTo(quick.timingMultiplier, 0.75);
  closeTo(quick.recoveryMultiplier, 0.75);
  closeTo(quick.cooldownMultiplier, 0.75);

  const blood = chargedReapProfile(profiledPlayer("blood-orbit", 2), "full");
  closeTo(blood.damageMultiplier, 1.35);
  assert.deepEqual(
    { healthCost: blood.healthCost, healPerEnemy: blood.healPerEnemy, healCap: blood.healCap },
    { healthCost: 12, healPerEnemy: 4, healCap: 24 },
  );
});

test("Grave Line Oaths expose precision, tempo, and control with their costs", () => {
  const needle = graveLineProfile(profiledPlayer("needlemoon", 2));
  closeTo(needle.damageMultiplier, 1.65);
  closeTo(needle.poiseMultiplier, 1.5);
  closeTo(needle.widthMultiplier, 0.65);

  const flash = graveLineProfile(profiledPlayer("flash-furrow", 2));
  closeTo(flash.damageMultiplier, 0.8);
  closeTo(flash.widthMultiplier, 0.85);
  closeTo(flash.buildupMultiplier, 0.6);
  closeTo(flash.recoveryMultiplier, 0.6);

  const funeral = graveLineProfile(profiledPlayer("funeral-furrow", 2));
  closeTo(funeral.damageMultiplier, 0.75);
  closeTo(funeral.widthMultiplier, 1.5);
  assert.deepEqual(
    { pullEnabled: funeral.pullEnabled, slow: funeral.slow, duration: funeral.slowDurationSeconds },
    { pullEnabled: true, slow: 0.4, duration: 1.5 },
  );
});

test("Claim Oaths alter only their promised pass, timing, pull, and catch properties", () => {
  const guillotine = claimConfigOverrides(profiledPlayer("guillotine-return", 2), CLAIM_CONFIG);
  closeTo(guillotine.outbound.damage, CLAIM_CONFIG.outbound.damage * 0.75);
  closeTo(guillotine.recall.damage, CLAIM_CONFIG.recall.damage * 1.6);
  closeTo(guillotine.empoweredCleave.damage, CLAIM_CONFIG.empoweredCleave.damage * 1.35);
  closeTo(guillotine.empoweredWindow, CLAIM_CONFIG.empoweredWindow * 0.75);

  const phantom = claimConfigOverrides(profiledPlayer("phantom-circuit", 2), CLAIM_CONFIG);
  closeTo(phantom.outbound.duration, CLAIM_CONFIG.outbound.duration / 1.4);
  closeTo(phantom.recall.duration, CLAIM_CONFIG.recall.duration / 1.4);
  closeTo(phantom.empoweredCleave.radius, CLAIM_CONFIG.empoweredCleave.radius * 0.85);
  closeTo(phantom.empoweredCleave.damage, CLAIM_CONFIG.empoweredCleave.damage * 0.75);

  const gravebind = claimConfigOverrides(profiledPlayer("gravebind", 2), CLAIM_CONFIG);
  closeTo(gravebind.recall.radius, CLAIM_CONFIG.recall.radius * 1.35);
  closeTo(gravebind.recall.pullStrength, CLAIM_CONFIG.recall.pullStrength * 1.8);
  closeTo(gravebind.recall.damage, CLAIM_CONFIG.recall.damage * 0.75);
  closeTo(gravebind.empoweredCleave.damage, CLAIM_CONFIG.empoweredCleave.damage * 0.75);
});

test("Dash Oaths enforce cooldown, perfect-window, invulnerability, and distance tradeoffs", () => {
  assert.deepEqual(dashProfile(profiledPlayer("reaping-passage", 2)), {
    cooldownMultiplier: 1.3,
    distanceMultiplier: 1,
    perfectWindowSeconds: null,
    invulnerabilitySeconds: null,
  });
  const eclipse = dashProfile(profiledPlayer("perfect-eclipse", 2));
  assert.equal(eclipse.perfectWindowSeconds, 0.075);
  assert.equal(eclipse.invulnerabilitySeconds, 0.19);
  closeTo(dashProfile(profiledPlayer("grave-step", 2)).distanceMultiplier, 0.82);
});

test("build and combat-condition snapshots contain only owned Oaths and live Oath procs", () => {
  const player = playerState();
  const ranks = new Map();
  grant(player, "perfect-eclipse", 1, ranks);
  grant(player, "needlemoon", 2, ranks);
  const state = {
    aegisRemaining: 2.25,
    aegisReduction: 16,
    guaranteedCriticalReady: true,
  };
  const build = progressionBuildSnapshot(ranks);
  const conditions = progressionConditionsSnapshot(state, player);

  assert.deepEqual(Object.keys(build), ["oaths", "oathSlots"]);
  assert.deepEqual(build.oaths.map(({ id, rank }) => [id, rank]), [
    ["needlemoon", 2],
    ["perfect-eclipse", 1],
  ]);
  assert.equal(build.oathSlots.dash.id, "perfect-eclipse");
  assert.deepEqual(conditions, {
    aegis: { ready: true, value: 16, seconds: 2.25 },
    guaranteedCritical: { ready: true },
  });
  assert.equal(Object.isFrozen(build.oathSlots.dash), true);
  assert.equal(Object.isFrozen(conditions.aegis), true);
});

test("room replacement clears transient Oath procs while preserving owned Oaths", () => {
  const game = new Game(createInput(), createSettings());
  game.startRun("OATH-RESET");
  while (game.phase === "bookend") game.continueBookend();
  grant(game.player, "perfect-eclipse", 1, game.upgradeRanks);
  grant(game.player, "pallbearers-cadence", 1, game.upgradeRanks);
  game.progressionState.aegisRemaining = 2;
  game.progressionState.aegisReduction = 10;
  game.progressionState.guaranteedCriticalReady = true;

  game.loadRoom();

  assert.equal(game.progressionState.aegisRemaining, 0);
  assert.equal(game.progressionState.guaranteedCriticalReady, false);
  assert.equal(game.player.modifierRanks.pallbearersCadence, 1);
  assert.equal(game.player.modifierRanks.perfectEclipse, 1);
  assert.equal(game.upgradeRanks.get("perfect-eclipse"), 1);
  assert.equal(RUN_CONFIG.totalFloors, 10);
});
