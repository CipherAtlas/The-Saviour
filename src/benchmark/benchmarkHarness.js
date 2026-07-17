import { PERFORMANCE_BUDGET } from "../game/gameConfig.js";

function percentile(values, ratio) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

export function createBenchmarkHarness(game, renderer, ui) {
  const state = {
    status: "loading",
    result: null,
    startedAt: null,
    warmupMs: 2200,
    sampleMs: 9000,
    frameTimes: [],
    cpuTimes: [],
    gpuTimes: [],
    maxDrawCalls: 0,
    maxTriangles: 0,
    maxActiveActors: 0,
    maxActiveMixers: 0,
    maxSkinnedMeshes: 0,
    maxTelegraphs: 0,
    longTasks: 0,
  };
  globalThis.__ROGUE_BENCHMARK__ = state;
  renderer.setGpuTimingEnabled(true);
  game.enterBenchmarkMode(PERFORMANCE_BUDGET.stressEnemies);
  ui.hideForBenchmark();
  const resultElement = document.createElement("pre");
  resultElement.id = "benchmark-results";
  resultElement.dataset.status = "loading";
  resultElement.hidden = true;
  document.body.append(resultElement);
  renderer.whenWorldReady().then(() => {
    state.startedAt = performance.now();
    state.status = "warming";
    resultElement.dataset.status = "warming";
  });

  const observer = typeof PerformanceObserver !== "undefined"
    ? new PerformanceObserver((list) => {
        if (state.startedAt !== null && performance.now() - state.startedAt >= state.warmupMs) state.longTasks += list.getEntries().length;
      })
    : null;
  try { observer?.observe({ type: "longtask", buffered: false }); } catch { /* Not every browser exposes long tasks. */ }

  return {
    recordFrame(frameMs, cpuMs, metrics) {
      if (state.startedAt === null) return;
      const elapsed = performance.now() - state.startedAt;
      if (elapsed < state.warmupMs) return;
      state.status = "sampling";
      resultElement.dataset.status = "sampling";
      state.frameTimes.push(frameMs);
      state.cpuTimes.push(cpuMs);
      if (metrics.gpuMs != null) state.gpuTimes.push(metrics.gpuMs);
      state.maxDrawCalls = Math.max(state.maxDrawCalls, metrics.drawCalls);
      state.maxTriangles = Math.max(state.maxTriangles, metrics.triangles);
      state.maxActiveActors = Math.max(state.maxActiveActors, metrics.activeActors ?? 0);
      state.maxActiveMixers = Math.max(state.maxActiveMixers, metrics.activeMixers ?? 0);
      state.maxSkinnedMeshes = Math.max(state.maxSkinnedMeshes, metrics.skinnedMeshes ?? 0);
      state.maxTelegraphs = Math.max(state.maxTelegraphs, metrics.telegraphs ?? 0);
      if (elapsed >= state.warmupMs + state.sampleMs) this.finish();
    },

    finish() {
      if (state.status === "complete") return;
      observer?.disconnect();
      renderer.setGpuTimingEnabled(false);
      const frameMedian = percentile(state.frameTimes, 0.5);
      const refreshHz = frameMedian ? 1000 / frameMedian : null;
      const cpuP95 = percentile(state.cpuTimes, 0.95);
      const gpuP95 = percentile(state.gpuTimes, 0.95);
      const navigation = performance.getEntriesByType("navigation")[0];
      const resourceBytes = performance.getEntriesByType("resource").reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
      const refreshCapped = refreshHz != null && refreshHz < 80;
      const frameP95 = percentile(state.frameTimes, 0.95);
      const gpuTimerReliable = gpuP95 == null || frameP95 == null || gpuP95 <= frameP95 * 1.5 || refreshHz < 80;
      const result = {
        passed:
          cpuP95 <= PERFORMANCE_BUDGET.cpuP95Ms &&
          (gpuP95 == null || !gpuTimerReliable || gpuP95 <= PERFORMANCE_BUDGET.gpuP95Ms) &&
          state.maxDrawCalls <= PERFORMANCE_BUDGET.drawCalls &&
          state.maxTriangles <= PERFORMANCE_BUDGET.triangles &&
          state.longTasks === 0 &&
          (refreshCapped || frameP95 <= 12.5),
        samples: state.frameTimes.length,
        refreshHz: refreshHz == null ? null : Number(refreshHz.toFixed(1)),
        refreshCapped,
        frameP95Ms: Number(frameP95?.toFixed(2)),
        cpuP95Ms: Number(cpuP95?.toFixed(2)),
        gpuP95Ms: gpuP95 == null ? null : Number(gpuP95.toFixed(2)),
        gpuTimerReliable,
        maxDrawCalls: state.maxDrawCalls,
        maxTriangles: state.maxTriangles,
        maxActiveActors: state.maxActiveActors,
        maxActiveMixers: state.maxActiveMixers,
        maxSkinnedMeshes: state.maxSkinnedMeshes,
        maxTelegraphs: state.maxTelegraphs,
        longTasks: state.longTasks,
        domInteractiveMs: navigation ? Number(navigation.domInteractive.toFixed(1)) : null,
        resourceTransferBytes: resourceBytes,
        budgets: PERFORMANCE_BUDGET,
      };
      state.status = "complete";
      state.result = result;
      resultElement.dataset.status = "complete";
      resultElement.textContent = JSON.stringify(result);
      console.info(`ROGUE_BENCHMARK_RESULT ${JSON.stringify(result)}`);
      globalThis.dispatchEvent(new CustomEvent("rogue-benchmark-complete", { detail: result }));
    },
  };
}
