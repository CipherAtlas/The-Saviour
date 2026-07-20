import assert from "node:assert/strict";
import test from "node:test";
import {
  createEncounterPlan,
  encounterBandForFloor,
  ENCOUNTER_BANDS,
  hordeChanceForFloor,
  HORDE_CHANCE_BY_BAND,
  ROLE_GROUPS,
  selectEncounterRecipe,
  SPECIALIST_ARCHETYPE_IDS,
  standardPopulationFor,
} from "../src/game/encounterPatterns.js";
import {
  BATCH_SPAWN_MODES,
  BATCH_TRIGGER_TYPES,
  ENCOUNTER_RECIPE_TYPES,
} from "../src/game/encounterContracts.js";
import { DIFFICULTY } from "../src/game/gameConfig.js";
import { NON_BOSS_ARCHETYPE_IDS } from "../src/game/enemyArchetypes.js";
import { SeededRandom } from "../src/generation/seededRandom.js";

const SPAWN_POINTS = Object.freeze(Array.from({ length: 20 }, (_unused, index) => Object.freeze({
  x: (index % 5) * 4 - 8,
  z: Math.floor(index / 5) * 4 - 6,
})));

function plan(seed, {
  floor = 8,
  room = 3,
  difficultyId = "standard",
  previousRecipeType = null,
  layoutFamily = "lShape",
  layoutComplexity = room,
  biome,
} = {}) {
  return createEncounterPlan({
    floor,
    room,
    difficultyId,
    previousRecipeType,
    layout: {
      layoutFamily,
      layoutComplexity,
      combatZones: layoutComplexity > 1 ? [{ id: "main" }, { id: "wing" }] : [{ id: "main" }],
    },
    biome,
    spawnPoints: SPAWN_POINTS,
    rng: new SeededRandom(`${seed}:plan`),
  });
}

function entries(encounter) {
  return encounter.batches.flatMap((batch) => batch.entries);
}

function findPlan(recipeType, options = {}) {
  for (let index = 0; index < 2_000; index += 1) {
    const candidate = plan(`FIND-${recipeType}-${index}`, options);
    if (candidate.type === recipeType) return candidate;
  }
  throw new Error(`Could not find deterministic ${recipeType} plan.`);
}

test("encounter plans are deterministic, immutable, and project legacy waves from authoritative batches", () => {
  const first = plan("PLAN-DETERMINISM");
  const second = plan("PLAN-DETERMINISM");
  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.batches), true);
  assert.equal(first.totalPopulation, entries(first).length);
  assert.equal(first.waves.length, first.batches.length);
  assert.ok(first.threat > 0 && first.threat <= first.threatBudget);
  assert.ok(entries(first).every((entry) => ROLE_GROUPS[entry.role].includes(entry.type)));
  assert.ok(entries(first).every((entry) => Number.isFinite(entry.threat) && typeof entry.specialist === "boolean"));
  for (let index = 0; index < first.batches.length; index += 1) {
    assert.deepEqual(first.waves[index].entries, first.batches[index].entries);
    assert.equal(first.batches[index].index, index);
  }
});

test("Standard population stays in the approved bands and room progression survives deterministic difficulty rounding", () => {
  const bandBounds = {
    [ENCOUNTER_BANDS.EARLY]: [5, 9],
    [ENCOUNTER_BANDS.MIDDLE]: [8, 13],
    [ENCOUNTER_BANDS.LATE]: [12, 18],
  };
  for (let floor = 1; floor <= 10; floor += 1) {
    let previousStandard = 0;
    for (let room = 1; room <= 3; room += 1) {
      const standard = plan(`POP-${floor}-${room}`, {
        floor,
        room,
        previousRecipeType: ENCOUNTER_RECIPE_TYPES.HORDE,
      });
      const expected = standardPopulationFor(floor, room);
      assert.equal(standard.totalPopulation, expected);
      assert.ok(standard.totalPopulation > previousStandard, `floor ${floor} room ${room} did not increase`);
      previousStandard = standard.totalPopulation;
      const [minimum, maximum] = bandBounds[encounterBandForFloor(floor)];
      assert.ok(standard.totalPopulation >= minimum && standard.totalPopulation <= maximum);

      const relaxed = plan(`POP-${floor}-${room}`, {
        floor,
        room,
        difficultyId: "relaxed",
        previousRecipeType: ENCOUNTER_RECIPE_TYPES.HORDE,
      });
      const ruthless = plan(`POP-${floor}-${room}`, {
        floor,
        room,
        difficultyId: "ruthless",
        previousRecipeType: ENCOUNTER_RECIPE_TYPES.HORDE,
      });
      assert.equal(relaxed.totalPopulation, Math.round(expected * 0.8));
      assert.equal(ruthless.totalPopulation, Math.min(18, Math.round(expected * 1.15)));
      assert.ok(relaxed.roleCounts.frontline >= 1);
      if (floor >= 2) {
        assert.ok(relaxed.roleCounts.mobile >= 1);
        assert.ok(relaxed.roleCounts.ranged >= 1);
      }
    }
  }
});

test("seeded horde selection starts near 12/18/24 percent and always stays below 25 percent", () => {
  const samples = 6_000;
  for (const [floor, expected] of [[2, 0.12], [5, 0.18], [8, 0.24]]) {
    let hordes = 0;
    for (let index = 0; index < samples; index += 1) {
      const selection = selectEncounterRecipe({
        floor,
        room: 2,
        rng: new SeededRandom(`HORDE-OCCURRENCE-${floor}-${index}`),
      });
      if (selection.type === ENCOUNTER_RECIPE_TYPES.HORDE) hordes += 1;
    }
    const rate = hordes / samples;
    assert.ok(Math.abs(rate - expected) < 0.02, `${encounterBandForFloor(floor)} horde rate was ${rate}`);
    assert.equal(hordeChanceForFloor(floor), expected);
    assert.ok(HORDE_CHANCE_BY_BAND[encounterBandForFloor(floor)] < 0.25);
  }
});

test("horde suppression prevents adjacent horde chambers while every fallback family remains reachable", () => {
  const observed = new Set();
  for (let run = 0; run < 240; run += 1) {
    let previousRecipeType = null;
    for (let floor = 1; floor <= 10; floor += 1) {
      for (let room = 1; room <= 3; room += 1) {
        const selection = selectEncounterRecipe({
          floor,
          room,
          rng: new SeededRandom(`ROUTE-${run}-${floor}-${room}`),
          previousRecipeType,
        });
        assert.notEqual(
          previousRecipeType === ENCOUNTER_RECIPE_TYPES.HORDE && selection.type,
          ENCOUNTER_RECIPE_TYPES.HORDE,
        );
        observed.add(selection.type);
        previousRecipeType = selection.type;
      }
    }
  }
  assert.deepEqual(observed, new Set(Object.values(ENCOUNTER_RECIPE_TYPES)));
});

test("all recipe families expose their authored batch triggers and streamed cadence in every run band", () => {
  for (const floor of [2, 5, 8]) {
    for (const recipeType of Object.values(ENCOUNTER_RECIPE_TYPES)) {
      const encounter = findPlan(recipeType, { floor, room: 3 });
      assert.equal(encounter.batches[0].trigger.type, BATCH_TRIGGER_TYPES.INITIAL);
      assert.ok(encounter.activePopulationCap <= 12);
      if (recipeType === ENCOUNTER_RECIPE_TYPES.HORDE) {
        assert.equal(encounter.batches.length, 1);
        assert.equal(encounter.batches[0].spawnMode, BATCH_SPAWN_MODES.TOGETHER);
        assert.equal(encounter.activePopulationCap, encounter.totalPopulation);
        assert.ok(encounter.totalPopulation <= 12);
      } else if (recipeType === ENCOUNTER_RECIPE_TYPES.DEATH_TRIGGERED) {
        assert.ok(encounter.batches.slice(1).every((batch) => batch.trigger.type === BATCH_TRIGGER_TYPES.REMAINING));
        assert.ok(encounter.batches.slice(1).every((batch) => batch.spawnMode === BATCH_SPAWN_MODES.STREAMED));
      } else if (recipeType === ENCOUNTER_RECIPE_TYPES.TIMED) {
        assert.ok(encounter.batches.slice(1).every((batch) => batch.trigger.type === BATCH_TRIGGER_TYPES.TIMER));
        assert.ok(encounter.batches.some((batch) => batch.spawnMode === BATCH_SPAWN_MODES.STREAMED));
      } else {
        assert.equal(encounter.batches[1].trigger.type, BATCH_TRIGGER_TYPES.TIMER);
        assert.equal(encounter.batches.at(-1).trigger.type, BATCH_TRIGGER_TYPES.REMAINING);
        assert.equal(encounter.batches.at(-1).spawnMode, BATCH_SPAWN_MODES.STREAMED);
      }
      for (const batch of encounter.batches.slice(1)) {
        if (batch.trigger.type !== BATCH_TRIGGER_TYPES.REMAINING) continue;
        assert.ok(batch.trigger.remainingRatio >= 0.25 && batch.trigger.remainingRatio <= 0.35);
      }
    }
  }
});

test("late recipes contain four pressure roles, obey threat and per-batch specialist caps, and retain all six families", () => {
  const observedFamilies = new Set();
  for (const difficultyId of Object.keys(DIFFICULTY)) {
    for (let index = 0; index < 240; index += 1) {
      const encounter = plan(`LATE-COMPOSITION-${difficultyId}-${index}`, {
        floor: 9,
        room: 3,
        difficultyId,
      });
      assert.ok(encounter.threat <= encounter.threatBudget);
      for (const role of Object.keys(ROLE_GROUPS)) assert.ok(encounter.roleCounts[role] >= 1, `${difficultyId} missing ${role}`);
      for (let batchIndex = 0; batchIndex < encounter.batches.length; batchIndex += 1) {
        const batch = encounter.batches[batchIndex];
        const familyCap = encounter.specialistFamilyCaps[batchIndex];
        for (const specialist of SPECIALIST_ARCHETYPE_IDS) {
          assert.ok(batch.entries.filter((entry) => entry.type === specialist).length <= familyCap);
        }
      }
      for (const entry of entries(encounter)) observedFamilies.add(entry.type);
    }
  }
  assert.deepEqual(observedFamilies, new Set(NON_BOSS_ARCHETYPE_IDS));
});

test("hordes reserve most bodies for low-threat families and use fewer specialists than reinforcement recipes", () => {
  let hordeSpecialists = 0;
  let hordePopulation = 0;
  let reinforcementSpecialists = 0;
  let reinforcementPopulation = 0;
  for (let index = 0; index < 180; index += 1) {
    const horde = findPlan(ENCOUNTER_RECIPE_TYPES.HORDE, { floor: 9, room: 3, difficultyId: "standard" });
    const reinforcement = plan(`REINFORCEMENT-SPECIALISTS-${index}`, {
      floor: 9,
      room: 3,
      previousRecipeType: ENCOUNTER_RECIPE_TYPES.HORDE,
    });
    const hordeEntries = entries(horde);
    const reinforcementEntries = entries(reinforcement);
    hordeSpecialists += hordeEntries.filter((entry) => SPECIALIST_ARCHETYPE_IDS.includes(entry.type)).length;
    hordePopulation += hordeEntries.length;
    reinforcementSpecialists += reinforcementEntries.filter((entry) => SPECIALIST_ARCHETYPE_IDS.includes(entry.type)).length;
    reinforcementPopulation += reinforcementEntries.length;
    assert.ok(hordeEntries.filter((entry) => ["thrall", "reaver"].includes(entry.type)).length >= Math.ceil(horde.totalPopulation * 0.72));
  }
  assert.ok(hordeSpecialists / hordePopulation < reinforcementSpecialists / reinforcementPopulation);
});

test("layout, room complexity, and difficulty inform deterministic batch size and cadence", () => {
  const timed = findPlan(ENCOUNTER_RECIPE_TYPES.TIMED, { floor: 8, room: 3, layoutFamily: "openCourtyard" });
  const seed = timed.hordeRoll;
  let matchingSeed = null;
  for (let index = 0; index < 2_000; index += 1) {
    const candidate = plan(`LAYOUT-CADENCE-${index}`, { floor: 8, room: 3, layoutFamily: "openCourtyard" });
    if (candidate.type === ENCOUNTER_RECIPE_TYPES.TIMED) {
      matchingSeed = `LAYOUT-CADENCE-${index}`;
      break;
    }
  }
  assert.ok(matchingSeed && Number.isFinite(seed));
  const courtyard = plan(matchingSeed, { floor: 8, room: 3, layoutFamily: "openCourtyard", layoutComplexity: 1 });
  const hall = plan(matchingSeed, { floor: 8, room: 3, layoutFamily: "longHall", layoutComplexity: 3 });
  const relaxed = plan(matchingSeed, { floor: 8, room: 3, difficultyId: "relaxed", layoutFamily: "longHall", layoutComplexity: 3 });
  const ruthless = plan(matchingSeed, { floor: 8, room: 3, difficultyId: "ruthless", layoutFamily: "longHall", layoutComplexity: 3 });
  assert.notDeepEqual(courtyard.batches.map((batch) => batch.entries.length), hall.batches.map((batch) => batch.entries.length));
  assert.notEqual(courtyard.batches[1].trigger.atSeconds, hall.batches[1].trigger.atSeconds);
  assert.ok(relaxed.batches[1].trigger.atSeconds > ruthless.batches[1].trigger.atSeconds);
  assert.ok(relaxed.totalPopulation < ruthless.totalPopulation);
});

test("cosmetic biome identity has no effect on encounter mechanics or composition", () => {
  const keep = plan("COSMETIC-THEME", { floor: 9, room: 3, biome: "forgottenKeep" });
  const voidCourt = plan("COSMETIC-THEME", { floor: 9, room: 3, biome: "voidCourt" });
  assert.deepEqual(keep, voidCourt);
  assert.equal("biome" in keep, false);
});
