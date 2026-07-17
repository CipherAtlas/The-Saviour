const slot = (x, z, width, depth, height = 2.5) => Object.freeze({ x, z, width, depth, height });
const zone = (x, z, radius) => Object.freeze({ x, z, radius });

const layout = (definition) => Object.freeze({
  ...definition,
  width: Object.freeze(definition.width),
  depth: Object.freeze(definition.depth),
  obstacleSlots: Object.freeze(definition.obstacleSlots),
  combatZones: Object.freeze(definition.combatZones),
});

export const ARENA_LAYOUTS = Object.freeze({
  courtyard: layout({
    id: "courtyard",
    unlockFloor: 1,
    width: [34, 38],
    depth: [25, 29],
    obstacleSlots: [slot(-0.29, -0.14, 2.8, 2.8), slot(0.29, -0.14, 2.8, 2.8), slot(-0.29, 0.25, 2.8, 2.8), slot(0.29, 0.25, 2.8, 2.8)],
    combatZones: [zone(0, -0.12, 5), zone(0, 0.28, 4.5)],
  }),
  splitHall: layout({
    id: "splitHall",
    unlockFloor: 2,
    width: [38, 42],
    depth: [24, 28],
    obstacleSlots: [slot(-0.08, -0.08, 3.2, 7), slot(0.18, 0.2, 3.2, 6), slot(-0.35, 0.23, 2.6, 2.6)],
    combatZones: [zone(-0.24, 0, 4.6), zone(0.28, 0.1, 4.6)],
  }),
  cruciform: layout({
    id: "cruciform",
    unlockFloor: 3,
    width: [36, 40],
    depth: [28, 32],
    obstacleSlots: [slot(-0.27, -0.2, 3, 3), slot(0.27, -0.2, 3, 3), slot(-0.27, 0.22, 3, 3), slot(0.27, 0.22, 3, 3), slot(0, 0.04, 2.4, 2.4)],
    combatZones: [zone(0, 0, 5.2), zone(-0.32, 0.05, 3.8), zone(0.32, 0.05, 3.8)],
  }),
  ring: layout({
    id: "ring",
    unlockFloor: 5,
    width: [38, 42],
    depth: [28, 32],
    obstacleSlots: [slot(-0.25, -0.24, 3, 3), slot(0.25, -0.24, 3, 3), slot(-0.32, 0.08, 3, 3), slot(0.32, 0.08, 3, 3), slot(-0.2, 0.31, 3, 3), slot(0.2, 0.31, 3, 3)],
    combatZones: [zone(0, 0.04, 5.4), zone(0, 0.31, 4.2)],
  }),
  gauntlet: layout({
    id: "gauntlet",
    unlockFloor: 6,
    width: [34, 38],
    depth: [30, 34],
    obstacleSlots: [slot(-0.3, -0.2, 3.3, 2.5), slot(0.3, -0.02, 3.3, 2.5), slot(-0.3, 0.17, 3.3, 2.5), slot(0.3, 0.34, 3.3, 2.5)],
    combatZones: [zone(0, -0.17, 4.4), zone(0, 0.12, 4.4), zone(0, 0.36, 4)],
  }),
  bossCourt: layout({
    id: "bossCourt",
    unlockFloor: 10,
    width: [42, 42],
    depth: [32, 32],
    obstacleSlots: [slot(-0.37, -0.18, 3.2, 3.2, 3.2), slot(0.37, -0.18, 3.2, 3.2, 3.2), slot(-0.37, 0.28, 3.2, 3.2, 3.2), slot(0.37, 0.28, 3.2, 3.2, 3.2)],
    combatZones: [zone(0, 0.05, 8.2)],
  }),
});

export function chooseArenaLayout({ floor, boss, biome, rng }) {
  if (boss) return ARENA_LAYOUTS.bossCourt;
  const candidates = Object.values(ARENA_LAYOUTS).filter((entry) => entry.id !== "bossCourt" && floor >= entry.unlockFloor);
  const weights = biome.gameplay.layoutWeights;
  return rng.weighted(candidates.map((entry) => ({ value: entry, weight: weights[entry.id] ?? 1 })));
}

export function instantiateArenaLayout(definition, rng) {
  const width = rng.int(definition.width[0], definition.width[1]);
  const depth = rng.int(definition.depth[0], definition.depth[1]);
  return {
    layoutFamily: definition.id,
    width,
    depth,
    obstacleSlots: definition.obstacleSlots.map((entry) => ({
      x: Math.round(entry.x * width + rng.float(-0.45, 0.45)),
      z: Math.round(entry.z * depth + rng.float(-0.45, 0.45)),
      width: entry.width,
      depth: entry.depth,
      height: entry.height,
    })),
    combatZones: definition.combatZones.map((entry, index) => ({
      id: `${definition.id}-${index + 1}`,
      x: Math.round(entry.x * width),
      z: Math.round(entry.z * depth),
      radius: entry.radius,
    })),
  };
}
