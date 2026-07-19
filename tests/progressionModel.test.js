import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BLESSINGS, BLESSING_FALLBACK } from "../src/game/blessings.js";
import {
  applyProgressionCard,
  calculateProgressionTransition,
  previewProgressionCard,
  PROGRESSION_OPERATIONS,
  PROGRESSION_TAGS,
  PROGRESSION_UNITS,
  TRANSFORMATION_HOOK_IDS,
} from "../src/game/progressionModel.js";
import { CHAMBER_FALLBACK, RUN_UPGRADES } from "../src/game/runUpgrades.js";

const DEFINITIONS = Object.freeze([
  ...RUN_UPGRADES,
  CHAMBER_FALLBACK,
  ...BLESSINGS,
  BLESSING_FALLBACK,
]);

const effect = (stat, operation, value, unit, perRank) => ({ stat, operation, value, unit, perRank });

const EXPECTED_EFFECTS = Object.freeze({
  "whetted-crescent": [effect("damageMultiplier", "add", 0.06, "ratio", true)],
  "long-haft": [effect("reachMultiplier", "add", 0.05, "ratio", true)],
  "reapers-focus": [effect("criticalChance", "add", 0.02, "percentagePoint", true)],
  "merciless-arc": [effect("damageMultiplier", "add", 0.12, "ratio", false)],
  "quickened-step": [effect("dashCooldownMultiplier", "multiply", 0.95, "ratio", true)],
  "veil-edge": [effect("criticalChance", "add", 0.03, "percentagePoint", true)],
  "afterimage-edge": [effect("damageMultiplier", "add", 0.04, "ratio", true)],
  "nights-measure": [
    effect("reachMultiplier", "add", 0.03, "ratio", true),
    effect("criticalChance", "add", 0.01, "percentagePoint", true),
  ],
  "marrow-vigor": [
    effect("maxHealth", "add", 10, "flat", true),
    effect("health", "add", 10, "flat", true),
  ],
  wellspring: [effect("roomRecoveryBonus", "add", 0.03, "percentagePoint", true)],
  "soul-tithe": [effect("healthOnKill", "add", 1, "flat", true)],
  "grave-oath": [
    effect("maxHealth", "add", 18, "flat", false),
    effect("health", "add", 18, "flat", false),
  ],
  "threshold-restoration": [effect("health", "restorePercent", 0.3, "ratio", true)],
  "far-reach": [effect("reachMultiplier", "add", 0.14, "ratio", true)],
  "grave-edge": [effect("damageMultiplier", "add", 0.16, "ratio", true)],
  "harvest-crown": [
    effect("damageMultiplier", "add", 0.09, "ratio", true),
    effect("reachMultiplier", "add", 0.09, "ratio", true),
  ],
  "hollow-step": [effect("dashCooldownMultiplier", "multiply", 0.82, "ratio", true)],
  "perfect-eclipse": [effect("criticalChance", "add", 0.1, "percentagePoint", true)],
  "reaping-passage": [
    effect("damageMultiplier", "add", 0.08, "ratio", true),
    effect("dashCooldownMultiplier", "multiply", 0.9, "ratio", true),
  ],
  "royal-blood": [
    effect("maxHealth", "add", 24, "flat", true),
    effect("health", "add", 24, "flat", true),
  ],
  "final-mercy": [
    effect("criticalChance", "add", 0.1, "percentagePoint", false),
    effect("deathDefiance", "grant", 1, "charge", false),
  ],
  "soul-siphon": [effect("healthOnKill", "add", 2, "flat", true)],
  "moonwell-renewal": [effect("roomRecoveryBonus", "add", 0.08, "percentagePoint", true)],
  "royal-restoration": [effect("health", "restoreFull", 1, "ratio", true)],
});

const EXPECTED_SYNERGIES = Object.freeze({
  "whetted-crescent": ["grave-edge", "harvest-crown"],
  "long-haft": ["far-reach", "harvest-crown"],
  "reapers-focus": ["veil-edge", "perfect-eclipse"],
  "merciless-arc": ["grave-edge", "harvest-crown"],
  "quickened-step": ["hollow-step", "reaping-passage"],
  "veil-edge": ["perfect-eclipse"],
  "afterimage-edge": ["hollow-step", "reaping-passage"],
  "nights-measure": ["far-reach", "perfect-eclipse"],
  "marrow-vigor": ["royal-blood", "final-mercy"],
  wellspring: ["moonwell-renewal"],
  "soul-tithe": ["soul-siphon"],
  "grave-oath": ["royal-blood", "final-mercy"],
});

const EXPECTED_TAGS = Object.freeze({
  "whetted-crescent": ["damage"],
  "long-haft": ["reach"],
  "reapers-focus": ["critical"],
  "merciless-arc": ["damage"],
  "quickened-step": ["dash"],
  "veil-edge": ["critical"],
  "afterimage-edge": ["damage"],
  "nights-measure": ["reach", "critical"],
  "marrow-vigor": ["max-health", "healing"],
  wellspring: ["healing", "room-recovery"],
  "soul-tithe": ["healing", "kill-recovery"],
  "grave-oath": ["max-health", "healing"],
  "threshold-restoration": ["healing", "restoration", "fallback"],
  "far-reach": ["reach"],
  "grave-edge": ["damage"],
  "harvest-crown": ["damage", "reach"],
  "hollow-step": ["dash"],
  "perfect-eclipse": ["critical"],
  "reaping-passage": ["damage", "dash"],
  "royal-blood": ["max-health", "healing"],
  "final-mercy": ["critical", "healing", "death-defiance"],
  "soul-siphon": ["healing", "kill-recovery"],
  "moonwell-renewal": ["healing", "room-recovery"],
  "royal-restoration": ["healing", "restoration", "fallback"],
});

const EXPECTED_HOOKS = Object.freeze({
  "far-reach": "farReachClaim",
  "grave-edge": "graveEdgeCharge",
  "harvest-crown": "harvestCrownClaim",
  "hollow-step": "hollowStepAfterimage",
  "perfect-eclipse": "perfectEclipsePerfectDash",
  "reaping-passage": "reapingPassageDashAttack",
  "royal-blood": "royalBloodWounded",
  "final-mercy": "finalMercyDeathDefiance",
  "soul-siphon": "soulSiphonAggressiveHeal",
  "moonwell-renewal": "moonwellRenewalRetaliation",
});

const EXPECTED_FIRST_APPLICATION = Object.freeze({
  "whetted-crescent": { damageMultiplier: 1 + 0.06 },
  "long-haft": { reachMultiplier: 1 + 0.05 },
  "reapers-focus": { criticalChance: 0.05 + 0.02 },
  "merciless-arc": { damageMultiplier: 1 + 0.12 },
  "quickened-step": { dashCooldownMultiplier: 0.95 },
  "veil-edge": { criticalChance: 0.05 + 0.03 },
  "afterimage-edge": { damageMultiplier: 1 + 0.04 },
  "nights-measure": { reachMultiplier: 1 + 0.03, criticalChance: 0.05 + 0.01 },
  "marrow-vigor": { maxHealth: 150, health: 101 },
  wellspring: { roomRecoveryBonus: 0.03 },
  "soul-tithe": { healthOnKill: 1 },
  "grave-oath": { maxHealth: 158, health: 109 },
  "threshold-restoration": { health: 133 },
  "far-reach": { reachMultiplier: 1 + 0.14 },
  "grave-edge": { damageMultiplier: 1 + 0.16 },
  "harvest-crown": { damageMultiplier: 1 + 0.09, reachMultiplier: 1 + 0.09 },
  "hollow-step": { dashCooldownMultiplier: 0.82 },
  "perfect-eclipse": { criticalChance: 0.05 + 0.1 },
  "reaping-passage": { damageMultiplier: 1 + 0.08, dashCooldownMultiplier: 0.9 },
  "royal-blood": { maxHealth: 164, health: 115 },
  "final-mercy": { criticalChance: 0.05 + 0.1, deathDefiance: 1 },
  "soul-siphon": { healthOnKill: 2 },
  "moonwell-renewal": { roomRecoveryBonus: 0.08 },
  "royal-restoration": { health: 140 },
});

function playerState() {
  return {
    health: 91,
    maxHealth: 140,
    damageMultiplier: 1,
    reachMultiplier: 1,
    dashCooldownMultiplier: 1,
    criticalChance: 0.05,
    healthOnKill: 0,
    roomRecoveryBonus: 0,
    deathDefiance: 0,
  };
}

test("all 24 progression definitions expose one deeply frozen closed data contract", () => {
  assert.equal(DEFINITIONS.length, 24);
  assert.equal(new Set(DEFINITIONS.map(({ id }) => id)).size, 24);
  const ids = new Set(DEFINITIONS.map(({ id }) => id));
  const tags = new Set(PROGRESSION_TAGS);
  const operations = new Set(PROGRESSION_OPERATIONS);
  const units = new Set(PROGRESSION_UNITS);

  for (const definition of DEFINITIONS) {
    assert.equal(Object.isFrozen(definition), true, definition.id);
    for (const field of ["tags", "prerequisites", "excludes", "synergies", "effects"]) {
      assert.equal(Object.isFrozen(definition[field]), true, `${definition.id}.${field}`);
    }
    assert.deepEqual(definition.prerequisites, [], `${definition.id} must not invent eligibility gates`);
    assert.ok(definition.tags.length > 0);
    assert.ok(definition.tags.every((value) => tags.has(value)));
    assert.ok(definition.excludes.every((value) => ids.has(value)));
    assert.ok(definition.synergies.every((value) => ids.has(value)));
    assert.ok(["none", "activation"].includes(definition.deathDefianceGrant));
    for (const descriptor of definition.effects) {
      assert.equal(Object.isFrozen(descriptor), true, `${definition.id} effect`);
      assert.deepEqual(Object.keys(descriptor), ["stat", "operation", "value", "unit", "perRank"]);
      assert.ok(operations.has(descriptor.operation));
      assert.ok(units.has(descriptor.unit));
      assert.equal(Number.isFinite(descriptor.value), true);
    }
  }
});

test("effects, informational synergies, exclusions, hooks, and Death Defiance classification are exact", () => {
  assert.deepEqual(PROGRESSION_TAGS, [
    "damage", "reach", "critical", "dash", "harvest", "claim", "charged-reap", "stagger",
    "healing", "max-health", "room-recovery", "kill-recovery", "death-defiance", "restoration", "fallback",
  ]);
  assert.deepEqual(Object.fromEntries(DEFINITIONS.map(({ id, tags }) => [id, tags])), EXPECTED_TAGS);
  assert.deepEqual(Object.fromEntries(DEFINITIONS.map(({ id, effects }) => [id, effects])), EXPECTED_EFFECTS);
  assert.deepEqual(
    Object.fromEntries(DEFINITIONS.filter(({ synergies }) => synergies.length > 0).map(({ id, synergies }) => [id, synergies])),
    EXPECTED_SYNERGIES,
  );
  assert.deepEqual(
    Object.fromEntries(DEFINITIONS.filter(({ excludes }) => excludes.length > 0).map(({ id, excludes }) => [id, excludes])),
    { "merciless-arc": ["grave-oath"], "grave-oath": ["merciless-arc"] },
  );
  assert.deepEqual(
    Object.fromEntries(DEFINITIONS.filter(({ transformation }) => transformation).map(({ id, transformation }) => [id, transformation.id])),
    EXPECTED_HOOKS,
  );
  assert.deepEqual(new Set(Object.values(EXPECTED_HOOKS)), new Set(TRANSFORMATION_HOOK_IDS));
  assert.deepEqual(DEFINITIONS.filter(({ deathDefianceGrant }) => deathDefianceGrant === "activation").map(({ id }) => id), ["final-mercy"]);
  assert.ok(DEFINITIONS.every(({ transformation }) => !transformation || transformation.status === "live"));
});

test("pure current-to-next previews equal generic application at every finite rank", () => {
  for (const definition of DEFINITIONS) {
    let current = playerState();
    const applications = Number.isFinite(definition.maxRank) ? definition.maxRank : 3;
    for (let rank = 0; rank < applications; rank += 1) {
      const untouched = structuredClone(current);
      const calculated = calculateProgressionTransition(definition, current);
      const preview = previewProgressionCard(definition, current);
      assert.deepEqual(current, untouched, `${definition.id} rank ${rank} preview mutated live state`);
      assert.deepEqual(preview.rows, calculated.rows);
      assert.ok(preview.rows.every((row) => Object.isFrozen(row) && row.beforeText.length > 0 && row.afterText.length > 0));

      const applied = structuredClone(current);
      applyProgressionCard(definition, applied);
      for (const row of preview.rows) assert.equal(applied[row.stat], row.after, `${definition.id}.${row.stat}`);

      const compatibilityApply = structuredClone(current);
      definition.apply(compatibilityApply);
      assert.deepEqual(compatibilityApply, applied, `${definition.id} direct apply drifted from the central model`);
      current = applied;
    }
  }
});

test("first application preserves every legacy live numeric result", () => {
  for (const definition of DEFINITIONS) {
    const player = playerState();
    applyProgressionCard(definition, player);
    for (const [stat, expected] of Object.entries(EXPECTED_FIRST_APPLICATION[definition.id])) {
      assert.equal(player[stat], expected, `${definition.id}.${stat}`);
    }
  }
});

test("display rows format live stat values rather than descriptor operands", () => {
  const quickened = DEFINITIONS.find(({ id }) => id === "quickened-step");
  const threshold = DEFINITIONS.find(({ id }) => id === "threshold-restoration");
  const restoration = DEFINITIONS.find(({ id }) => id === "royal-restoration");
  assert.deepEqual(previewProgressionCard(quickened, playerState()).rows.map(({ beforeText, afterText }) => [beforeText, afterText]), [["100%", "95%"]]);
  assert.deepEqual(previewProgressionCard(threshold, playerState()).rows.map(({ beforeText, afterText }) => [beforeText, afterText]), [["91", "133"]]);
  assert.deepEqual(previewProgressionCard(restoration, playerState()).rows.map(({ beforeText, afterText }) => [beforeText, afterText]), [["91", "140"]]);
});

test("live transformation hooks are described truthfully and runtime application contains no card-name switches", () => {
  const liveClaims = Object.freeze({
    farReachClaim: /claim|pull/i,
    graveEdgeCharge: /charged|stagger/i,
    harvestCrownClaim: /claim|pull/i,
    hollowStepAfterimage: /afterimage/i,
    perfectEclipsePerfectDash: /perfect dash|harvest/i,
    reapingPassageDashAttack: /dash attack/i,
    royalBloodWounded: /wounded/i,
    soulSiphonAggressiveHeal: /hits also heal/i,
    moonwellRenewalRetaliation: /taking damage empowers/i,
  });
  for (const definition of DEFINITIONS.filter(({ transformation }) => (
    transformation && transformation.id !== "finalMercyDeathDefiance"
  ))) {
    assert.match(definition.description, liveClaims[definition.transformation.id]);
  }
  assert.equal(DEFINITIONS.find(({ id }) => id === "quickened-step").description, "Dash cooldown is multiplied by 0.95 per rank.");
  assert.match(DEFINITIONS.find(({ id }) => id === "hollow-step").description, /synchronized afterimage/i);
  assert.match(DEFINITIONS.find(({ id }) => id === "reaping-passage").description, /dash attacks gain 35% damage/i);

  const sources = ["progressionModel.js", "runUpgrades.js", "blessings.js"]
    .map((file) => readFileSync(new URL(`../src/game/${file}`, import.meta.url), "utf8"))
    .join("\n");
  assert.doesNotMatch(sources, /(?:definition|choice)\.id\s*===/);
  assert.doesNotMatch(sources, /switch\s*\(\s*(?:definition|choice)\.id/);
});
