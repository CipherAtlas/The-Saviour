const biome = (definition) => Object.freeze({
  ...definition,
  palette: Object.freeze(definition.palette),
  decal: Object.freeze(definition.decal),
  obstacleModels: Object.freeze(definition.obstacleModels),
  propModels: Object.freeze(definition.propModels),
  gameplay: Object.freeze({
    ...definition.gameplay,
    encounterBias: Object.freeze(definition.gameplay.encounterBias),
    layoutWeights: Object.freeze(definition.gameplay.layoutWeights),
  }),
});

export const BIOMES = Object.freeze({
  forgottenKeep: biome({
    id: "forgottenKeep",
    name: "Forgotten Keep",
    floorModel: "floor-stone",
    wallModel: "wall",
    decal: { style: "keep-ward", color: 0x5da6db },
    obstacleModels: ["pillar", "pillar-decorated", "rubble-large"],
    propModels: ["banner-red", "torch-mounted", "barrel-large", "crates-stacked", "sword-shield-broken"],
    palette: { sky: 0x090c12, fog: 0x111823, hemisphere: 0x8fa8c1, ground: 0x251a1d, key: 0xffd49a, accent: 0x4c9bd6 },
    gameplay: {
      identity: "disciplined front lines and readable cover lanes",
      encounterBias: { thrall: 1.22, reaver: 1.08, boneguard: 1.2, hexer: 0.82, wraith: 0.72, bombardier: 0.68 },
      layoutWeights: { courtyard: 1.45, splitHall: 1.2, cruciform: 1, ring: 0.72, gauntlet: 0.8 },
    },
  }),
  ossuary: biome({
    id: "ossuary",
    name: "Ossuary of Saints",
    floorModel: "floor-dirt-rocky",
    wallModel: "wall-broken",
    decal: { style: "ossuary-reliquary", color: 0x70d1c9 },
    obstacleModels: ["column", "rubble-half", "wall-cracked"],
    propModels: ["candle-triple", "shelf-candles", "torch-lit", "rubble-large", "chest"],
    palette: { sky: 0x070d0f, fog: 0x102226, hemisphere: 0x9bc8c2, ground: 0x241b19, key: 0xe7d6ad, accent: 0x55c4bf },
    gameplay: {
      identity: "dense undead pressure anchored by shields and ritualists",
      encounterBias: { thrall: 1.28, reaver: 0.82, boneguard: 1.22, hexer: 1.18, wraith: 0.9, bombardier: 0.7 },
      layoutWeights: { courtyard: 0.9, splitHall: 0.85, cruciform: 1.42, ring: 1.12, gauntlet: 0.82 },
    },
  }),
  emberFoundry: biome({
    id: "emberFoundry",
    name: "Ember Foundry",
    floorModel: "floor-grate",
    wallModel: "wall-cracked",
    decal: { style: "foundry-vent", color: 0xff6a2e },
    obstacleModels: ["pillar", "wall-broken", "crates-stacked"],
    propModels: ["barrel-large", "barrel-small", "torch-lit", "floor-spikes", "rubble-half"],
    palette: { sky: 0x120806, fog: 0x2b120d, hemisphere: 0xd58b67, ground: 0x25100b, key: 0xffb15c, accent: 0xff4d1f },
    gameplay: {
      identity: "mobile attackers and spaced area denial across long lanes",
      encounterBias: { thrall: 0.82, reaver: 1.3, boneguard: 0.85, hexer: 0.92, wraith: 1.02, bombardier: 1.48 },
      layoutWeights: { courtyard: 0.72, splitHall: 1.3, cruciform: 0.8, ring: 1.08, gauntlet: 1.5 },
    },
  }),
  voidCourt: biome({
    id: "voidCourt",
    name: "Court Beyond the Veil",
    floorModel: "floor-wood-dark",
    wallModel: "wall-arched",
    decal: { style: "void-rune", color: 0xb66cff },
    obstacleModels: ["pillar-decorated", "column", "wall-arched"],
    propModels: ["banner-red", "candle-triple", "chest", "sword-shield-broken", "torch-mounted"],
    palette: { sky: 0x090511, fog: 0x1b0d28, hemisphere: 0xb091d4, ground: 0x170c1d, key: 0xf0c6ff, accent: 0xa64dff },
    gameplay: {
      identity: "teleport pressure and layered spell sightlines",
      encounterBias: { thrall: 0.62, reaver: 1.12, boneguard: 0.72, hexer: 1.4, wraith: 1.55, bombardier: 1.08 },
      layoutWeights: { courtyard: 0.62, splitHall: 0.9, cruciform: 1.12, ring: 1.58, gauntlet: 1.05 },
    },
  }),
});

const FLOOR_BIOME_WEIGHTS = Object.freeze({
  1: ["forgottenKeep"],
  2: ["forgottenKeep", "forgottenKeep", "ossuary"],
  3: ["forgottenKeep", "ossuary", "ossuary"],
  4: ["ossuary", "ossuary", "forgottenKeep"],
  5: ["ossuary", "ossuary", "emberFoundry"],
  6: ["emberFoundry", "emberFoundry", "ossuary"],
  7: ["emberFoundry", "emberFoundry", "voidCourt"],
  8: ["emberFoundry", "voidCourt", "voidCourt"],
  9: ["voidCourt", "voidCourt", "emberFoundry"],
  10: ["voidCourt"],
});

export function chooseBiome(floor, rng) {
  const choices = FLOOR_BIOME_WEIGHTS[Math.max(1, Math.min(10, floor))] ?? FLOOR_BIOME_WEIGHTS[1];
  return BIOMES[rng.pick(choices)];
}

export function getBiome(id) {
  return BIOMES[id] ?? BIOMES.forgottenKeep;
}
