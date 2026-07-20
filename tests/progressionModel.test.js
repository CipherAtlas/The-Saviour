import assert from "node:assert/strict";
import test from "node:test";
import { BLESSINGS, TECHNIQUE_SLOT_IDS } from "../src/game/blessings.js";
import {
  applyProgressionChoice,
  decorateProgressionChoice,
  progressionCardSnapshot,
  PROGRESSION_MODIFIER_IDS,
  resolveModifierRankTotal,
  resolveProgressionRankTotal,
} from "../src/game/progressionModel.js";

const EXPECTED_OATHS = Object.freeze({
  scytheCombo: Object.freeze([
    "Reaper:headsmans-cadence:headsmansCadence",
    "Shade:ghost-cadence:ghostCadence",
    "Grave:pallbearers-cadence:pallbearersCadence",
  ]),
  chargedReap: Object.freeze([
    "Reaper:falling-moon:fallingMoon",
    "Shade:quick-orbit:quickOrbit",
    "Grave:blood-orbit:bloodOrbit",
  ]),
  graveLine: Object.freeze([
    "Reaper:needlemoon:needlemoon",
    "Shade:flash-furrow:flashFurrow",
    "Grave:funeral-furrow:funeralFurrow",
  ]),
  reapersClaim: Object.freeze([
    "Reaper:guillotine-return:guillotineReturn",
    "Shade:phantom-circuit:phantomCircuit",
    "Grave:gravebind:gravebind",
  ]),
  dash: Object.freeze([
    "Reaper:reaping-passage:reapingPassageOath",
    "Shade:perfect-eclipse:perfectEclipse",
    "Grave:grave-step:graveStep",
  ]),
});

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

test("the live catalogue contains only fifteen Technique Oaths across five slots", () => {
  assert.equal(BLESSINGS.length, 15);
  assert.equal(new Set(BLESSINGS.map(({ id }) => id)).size, 15);
  assert.deepEqual(TECHNIQUE_SLOT_IDS, Object.keys(EXPECTED_OATHS));
  assert.deepEqual(
    Object.fromEntries(TECHNIQUE_SLOT_IDS.map((slot) => [
      slot,
      BLESSINGS.filter((definition) => definition.techniqueSlot === slot)
        .map(({ path, id, modifiers }) => `${path}:${id}:${modifiers[0].id}`),
    ])),
    EXPECTED_OATHS,
  );
});

test("every Oath has one frozen two-rank behavior contract and a concise tradeoff", () => {
  const modifierIds = [];
  for (const definition of BLESSINGS) {
    assert.equal(Object.isFrozen(definition), true, definition.id);
    assert.equal(definition.maxRank, 2, definition.id);
    assert.equal(definition.fallback, false, definition.id);
    assert.equal(definition.effects.length, 0, definition.id);
    assert.equal(definition.modifiers.length, 1, definition.id);
    assert.equal(definition.rankTotals.length, 2, definition.id);
    assert.ok(definition.benefit.length > 0, definition.id);
    assert.ok(definition.cost.length > 0, definition.id);
    assert.ok(definition.rankTotals.every(Object.isFrozen), definition.id);
    assert.strictEqual(definition.modifiers[0].rankTotals, definition.rankTotals);
    assert.strictEqual(resolveModifierRankTotal(definition.modifiers[0], 2), definition.rankTotals[1]);
    assert.strictEqual(resolveProgressionRankTotal(definition, 2), definition.rankTotals[1]);
    modifierIds.push(definition.modifiers[0].id);
  }
  assert.deepEqual(new Set(modifierIds), new Set(PROGRESSION_MODIFIER_IDS));
});

test("applying an Oath advances only its own rank and behavioral modifier", () => {
  const definition = BLESSINGS.find(({ id }) => id === "falling-moon");
  const player = playerState();
  const ranks = new Map();

  const first = applyProgressionChoice(definition, player, ranks);
  assert.equal(first.rank, 1);
  assert.equal(ranks.get(definition.id), 1);
  assert.equal(player.modifierRanks.fallingMoon, 1);
  assert.equal(player.maxHealth, 140);

  const second = applyProgressionChoice(definition, player, ranks);
  assert.equal(second.rank, 2);
  assert.equal(player.modifierRanks.fallingMoon, 2);
  assert.equal(applyProgressionChoice(definition, player, ranks), null);
});

test("public Oath choices expose only identity, gain, tradeoff, and rank context", () => {
  const definition = BLESSINGS.find(({ id }) => id === "falling-moon");
  const snapshot = progressionCardSnapshot(decorateProgressionChoice(
    definition,
    new Map([[definition.id, 1]]),
    playerState(),
  ));

  assert.deepEqual(Object.keys(snapshot), [
    "id", "name", "benefit", "cost", "path", "techniqueSlot", "rank", "nextRank", "maxRank",
  ]);
  assert.deepEqual(snapshot, {
    id: "falling-moon",
    name: "Falling Moon",
    benefit: definition.benefit,
    cost: definition.cost,
    path: "Reaper",
    techniqueSlot: "chargedReap",
    rank: 1,
    nextRank: 2,
    maxRank: 2,
  });
  assert.equal(Object.isFrozen(snapshot), true);
});

test("Perfect Eclipse defines Perfect Dash in concise card copy", () => {
  const definition = BLESSINGS.find(({ id }) => id === "perfect-eclipse");
  assert.match(definition.benefit, /Perfect Dash \(dash as a hit connects\)/);
  assert.match(definition.cost, /120 ms normally, 90 ms → 75 ms/);
});
