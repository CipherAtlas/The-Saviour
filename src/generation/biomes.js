const environmentTheme = (definition) => Object.freeze({
  ...definition,
  palette: Object.freeze(definition.palette),
  decal: Object.freeze(definition.decal),
  obstacleModels: Object.freeze(definition.obstacleModels),
  propModels: Object.freeze(definition.propModels),
});

export const ENVIRONMENT_THEMES = Object.freeze({
  forgottenKeep: environmentTheme({
    id: "forgottenKeep",
    name: "Forgotten Keep",
    floorModel: "floor-stone",
    wallModel: "wall",
    decal: { style: "keep-ward", color: 0x5da6db },
    obstacleModels: ["pillar", "pillar-decorated", "rubble-large", "crates-stacked"],
    propModels: ["banner-red", "torch-mounted", "barrel-large", "sword-shield-broken"],
    palette: {
      sky: 0x090c12,
      fog: 0x111823,
      hemisphere: 0x8fa8c1,
      ground: 0x251a1d,
      key: 0xffd49a,
      accent: 0x4c9bd6,
    },
  }),
  ossuary: environmentTheme({
    id: "ossuary",
    name: "Ossuary of Saints",
    floorModel: "floor-dirt-rocky",
    wallModel: "wall-broken",
    decal: { style: "ossuary-reliquary", color: 0x70d1c9 },
    obstacleModels: ["column", "rubble-half", "wall-cracked", "rubble-large"],
    propModels: ["candle-triple", "shelf-candles", "torch-lit", "chest"],
    palette: {
      sky: 0x070d0f,
      fog: 0x102226,
      hemisphere: 0x9bc8c2,
      ground: 0x241b19,
      key: 0xe7d6ad,
      accent: 0x55c4bf,
    },
  }),
  emberFoundry: environmentTheme({
    id: "emberFoundry",
    name: "Ember Foundry",
    floorModel: "floor-grate",
    wallModel: "wall-cracked",
    decal: { style: "foundry-vent", color: 0xff6a2e },
    obstacleModels: ["pillar", "wall-broken", "crates-stacked", "rubble-half"],
    propModels: ["barrel-large", "barrel-small", "torch-lit", "sword-shield-broken"],
    palette: {
      sky: 0x120806,
      fog: 0x2b120d,
      hemisphere: 0xd58b67,
      ground: 0x25100b,
      key: 0xffb15c,
      accent: 0xff4d1f,
    },
  }),
  voidCourt: environmentTheme({
    id: "voidCourt",
    name: "Court Beyond the Veil",
    floorModel: "floor-wood-dark",
    wallModel: "wall-arched",
    decal: { style: "void-rune", color: 0xb66cff },
    obstacleModels: ["pillar-decorated", "column", "wall-arched"],
    propModels: ["banner-red", "candle-triple", "chest", "sword-shield-broken", "torch-mounted"],
    palette: {
      sky: 0x090511,
      fog: 0x1b0d28,
      hemisphere: 0xb091d4,
      ground: 0x170c1d,
      key: 0xf0c6ff,
      accent: 0xa64dff,
    },
  }),
});

export const ENVIRONMENT_THEME_IDS = Object.freeze(Object.keys(ENVIRONMENT_THEMES));

export function chooseEnvironmentTheme(rng) {
  return ENVIRONMENT_THEMES[rng.pick(ENVIRONMENT_THEME_IDS)];
}

export function getEnvironmentTheme(id) {
  return ENVIRONMENT_THEMES[id] ?? ENVIRONMENT_THEMES.forgottenKeep;
}

// Compatibility exports for renderer and audio consumers during the terminology migration.
// Themes carry presentation assets only; neither layout nor encounter generation reads them.
export const BIOMES = ENVIRONMENT_THEMES;

export function chooseBiome(_floor, rng) {
  return chooseEnvironmentTheme(rng);
}

export function getBiome(id) {
  return getEnvironmentTheme(id);
}
