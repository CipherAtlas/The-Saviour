import assert from "node:assert/strict";
import test from "node:test";
import {
  auditRefinementHordeRoutes,
  createBalanceBuild,
  runRefinementBalanceSweep,
  simulateRefinementBalanceEncounter,
  summarizeRefinementBalanceSweep,
} from "../src/playtest/RefinementBalanceModel.js";

const BANDS = ["early", "middle", "late"];
const ROUTES = ["relaxed", "standard", "ruthless", "speedrun"];

test("balance build profiles are composed only from the live Oath definitions", () => {
  const oathCounts = { early: 1, middle: 4, late: 5 };
  const rankTotals = { early: 1, middle: 4, late: 8 };
  for (const band of BANDS) {
    const baseline = createBalanceBuild("baseline", band);
    const damage = createBalanceBuild("damage", band);
    const survival = createBalanceBuild("survival", band);
    const hybrid = createBalanceBuild("hybrid", band);

    assert.ok(damage.damageMultiplier > baseline.damageMultiplier, `${band} damage build`);
    assert.ok(hybrid.damageMultiplier > baseline.damageMultiplier, `${band} hybrid damage`);
    assert.equal(survival.oathCards.length, oathCounts[band]);
    assert.equal(survival.oathCards.reduce((total, oath) => total + oath.rank, 0), rankTotals[band]);
    assert.equal("chamberCards" in survival, false);
  }

  assert.equal(createBalanceBuild("survival", "early").modifierRanks.bloodOrbit, 1);
  assert.ok(createBalanceBuild("survival", "late").pressureMultiplier
    < createBalanceBuild("survival", "early").pressureMultiplier);
});

test("a fixed-seed balance scenario is deterministic and speedrun uses Ruthless", () => {
  const options = {
    seed: "REFINEMENT-BALANCE-DETERMINISM",
    floor: 9,
    room: 3,
    difficultyId: "relaxed",
    runType: "speedrun",
    buildProfile: "hybrid",
    layoutFamily: "brokenRing",
  };
  const first = simulateRefinementBalanceEncounter(options);
  const second = simulateRefinementBalanceEncounter(options);

  assert.deepEqual(second, first);
  assert.equal(first.difficultyId, "ruthless");
  assert.equal(first.cleared, true);
  assert.equal(first.timedOut, false);
});

test("bounded evidence sweep clears, distinguishes builds, and stays inside practical harness ceilings", () => {
  const summary = summarizeRefinementBalanceSweep(runRefinementBalanceSweep({
    samplesPerScenario: 4,
    seedPrefix: "REFINEMENT-BALANCE-TEST",
  }));
  const practicalP90Ceilings = { early: 61, middle: 72, late: 83 };

  assert.equal(summary.scenarios, 192);
  for (const band of BANDS) {
    for (const route of ROUTES) {
      const baseline = summary.groups[`${band}:${route}:baseline`];
      const damage = summary.groups[`${band}:${route}:damage`];
      const survival = summary.groups[`${band}:${route}:survival`];

      assert.equal(baseline.clearRate, 1, `${band} ${route} low-synergy clear rate`);
      assert.ok(baseline.p90ClearSeconds < practicalP90Ceilings[band], `${band} ${route} practical ceiling`);
      assert.ok(damage.medianClearSeconds <= baseline.medianClearSeconds, `${band} ${route} damage payoff`);
      assert.ok(survival.medianHitsToDefeat >= baseline.medianHitsToDefeat, `${band} ${route} survival tolerance`);
      assert.ok(survival.averageRecoveryPotential > baseline.averageRecoveryPotential, `${band} ${route} recovery payoff`);
      assert.equal(baseline.degenerateBatches, 0, `${band} ${route} specialist diversity`);
      assert.equal(damage.degenerateBatches, 0, `${band} ${route} damage specialist diversity`);
      assert.equal(survival.degenerateBatches, 0, `${band} ${route} survival specialist diversity`);
    }
  }
});

test("seeded route evidence has rising horde frequency and no adjacent hordes", () => {
  const audit = auditRefinementHordeRoutes({ runs: 100, seedPrefix: "REFINEMENT-HORDE-TEST" });

  assert.equal(audit.chambers, 3000);
  assert.equal(audit.adjacentHordes, 0);
  assert.ok(audit.rates.horde > 0.1 && audit.rates.horde < 0.25);
  assert.ok(audit.hordeRatesByBand.middle > audit.hordeRatesByBand.early);
  assert.ok(audit.hordeRatesByBand.late > audit.hordeRatesByBand.middle);
  for (const count of Object.values(audit.counts)) assert.ok(count > 0);
});
