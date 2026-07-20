import {
  auditRefinementHordeRoutes,
  BALANCE_PACING_TARGETS,
  runRefinementBalanceSweep,
  summarizeRefinementBalanceSweep,
} from "./RefinementBalanceModel.js";

const samplesPerScenario = Number.parseInt(process.argv[2] ?? "12", 10);
if (!Number.isInteger(samplesPerScenario) || samplesPerScenario < 1) {
  throw new RangeError("Usage: node src/playtest/refinementBalanceEvidenceCli.js [positive sample count]");
}

const scenarios = runRefinementBalanceSweep({ samplesPerScenario });
const summary = summarizeRefinementBalanceSweep(scenarios);
const standardBaseline = Object.fromEntries(Object.entries(BALANCE_PACING_TARGETS).map(([band, target]) => {
  const evidence = summary.groups[`${band}:standard:baseline`];
  return [band, {
    priorBrowserMedianSeconds: target.baselineMedian,
    specificationRangeSeconds: [target.minimum, target.maximum],
    modelMedianSeconds: evidence.medianClearSeconds,
    modelP90Seconds: evidence.p90ClearSeconds,
    withinSpecificationRange: evidence.medianClearSeconds >= target.minimum
      && evidence.medianClearSeconds <= target.maximum,
  }];
}));

process.stdout.write(`${JSON.stringify({
  samplesPerScenario,
  summary,
  standardBaseline,
  hordeRoutes: auditRefinementHordeRoutes(),
}, null, 2)}\n`);
