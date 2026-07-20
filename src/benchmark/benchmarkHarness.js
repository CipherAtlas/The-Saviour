import { PERFORMANCE_BUDGET } from "../game/gameConfig.js";
import { createNavigationCells, isCircleWalkable, walkableArea } from "../game/arenaGeometry.js";

export const BENCHMARK_ARENA_TARGET = Object.freeze({ floor: 9, room: 3 });

function pointInsideObstacle(point, obstacle, padding) {
  return Math.abs(point.x - obstacle.x) <= obstacle.width / 2 + padding
    && Math.abs(point.z - obstacle.z) <= obstacle.depth / 2 + padding;
}

export function placeBenchmarkEnemies(arena, enemies) {
  const clearance = Math.max(0.92, ...enemies.map((enemy) => enemy.radius ?? 0));
  const candidates = createNavigationCells(arena, { cellSize: 2, clearance })
    .filter((point) => !(arena.obstacles ?? []).some((obstacle) => pointInsideObstacle(point, obstacle, clearance)));
  if (candidates.length < enemies.length) throw new RangeError("Benchmark arena cannot contain the configured enemy burst.");
  for (let index = 0; index < enemies.length; index += 1) {
    const point = candidates[Math.floor(index * candidates.length / enemies.length)];
    enemies[index].position.x = point.x;
    enemies[index].position.z = point.z;
    enemies[index].previousPosition.x = point.x;
    enemies[index].previousPosition.z = point.z;
  }
  return enemies.every((enemy) => isCircleWalkable(arena, enemy.position, enemy.radius));
}

export function benchmarkArenaDiagnostics(arena, enemies) {
  return Object.freeze({
    layoutFamily: arena.layoutFamily,
    width: arena.width,
    depth: arena.depth,
    walkableArea: Number(walkableArea(arena).toFixed(2)),
    majorRegions: arena.walkableShape.majorRegionIds.length,
    connectorMinimum: arena.walkableShape.connectors.length > 0
      ? Math.min(...arena.walkableShape.connectors.map((connector) => connector.width))
      : null,
    burstEnemies: enemies.length,
    enemiesContained: enemies.every((enemy) => isCircleWalkable(arena, enemy.position, enemy.radius)),
  });
}

function prepareLargestSilhouetteStress(game, enemyCount) {
  game.enterBenchmarkMode(enemyCount);
  if (game.floor !== BENCHMARK_ARENA_TARGET.floor || game.room !== BENCHMARK_ARENA_TARGET.room) {
    game.floor = BENCHMARK_ARENA_TARGET.floor;
    game.room = BENCHMARK_ARENA_TARGET.room;
    game.loadRoom();
    game.director.stressSpawn(enemyCount, BENCHMARK_ARENA_TARGET.floor);
  }
  if (!placeBenchmarkEnemies(game.arena, game.director.enemies)) {
    throw new Error("Benchmark enemy burst escaped the authoritative walkable silhouette.");
  }
  game.player.invulnerable = 9999;
  return benchmarkArenaDiagnostics(game.arena, game.director.enemies);
}

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
    damageNumberScenarioStarted: false,
    maxDamageNumbers: 0,
    damageNumberCapacity: 0,
    maxDamageNumberPeak: 0,
    maxDamageNumberDropped: 0,
    maxDamageNumberReplaced: 0,
    maxDamageNumberAggregated: 0,
    maxDamageNumberDomNodes: 0,
    maxDamageNumberProjected: 0,
    longTasks: 0,
    arena: null,
  };
  globalThis.__ROGUE_BENCHMARK__ = state;
  renderer.setGpuTimingEnabled(true);
  state.arena = prepareLargestSilhouetteStress(game, PERFORMANCE_BUDGET.stressEnemies);
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
      if (!state.damageNumberScenarioStarted) {
        const damageNumbers = renderer.saturateDamageNumbersForBenchmark(game);
        metrics = { ...metrics, damageNumbers };
        state.damageNumberScenarioStarted = true;
      }
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
      state.maxDamageNumbers = Math.max(state.maxDamageNumbers, metrics.damageNumbers?.active ?? 0);
      state.damageNumberCapacity = Math.max(state.damageNumberCapacity, metrics.damageNumbers?.capacity ?? 0);
      state.maxDamageNumberPeak = Math.max(state.maxDamageNumberPeak, metrics.damageNumbers?.peak ?? 0);
      state.maxDamageNumberDropped = Math.max(state.maxDamageNumberDropped, metrics.damageNumbers?.dropped ?? 0);
      state.maxDamageNumberReplaced = Math.max(state.maxDamageNumberReplaced, metrics.damageNumbers?.replaced ?? 0);
      state.maxDamageNumberAggregated = Math.max(state.maxDamageNumberAggregated, metrics.damageNumbers?.aggregated ?? 0);
      state.maxDamageNumberDomNodes = Math.max(state.maxDamageNumberDomNodes, metrics.damageNumbers?.domNodes ?? 0);
      state.maxDamageNumberProjected = Math.max(state.maxDamageNumberProjected, metrics.damageNumbers?.projected ?? 0);
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
          state.maxDamageNumbers === 48 &&
          state.damageNumberCapacity === 48 &&
          state.maxDamageNumberPeak === 48 &&
          state.maxDamageNumberDomNodes === 48 &&
          state.maxDamageNumberAggregated > 0 &&
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
        damageNumbers: {
          maxActive: state.maxDamageNumbers,
          capacity: state.damageNumberCapacity,
          peak: state.maxDamageNumberPeak,
          dropped: state.maxDamageNumberDropped,
          replaced: state.maxDamageNumberReplaced,
          aggregated: state.maxDamageNumberAggregated,
          domNodes: state.maxDamageNumberDomNodes,
          maxProjected: state.maxDamageNumberProjected,
        },
        longTasks: state.longTasks,
        domInteractiveMs: navigation ? Number(navigation.domInteractive.toFixed(1)) : null,
        resourceTransferBytes: resourceBytes,
        arena: state.arena,
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
