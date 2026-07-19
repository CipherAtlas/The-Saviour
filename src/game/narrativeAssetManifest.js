import { publicAssetUrl } from "../publicAssetUrl.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const NARRATIVE_SCENE_IMAGE_CACHE_LIMIT = 12;

const CURRENT_WAVE_STATES = Object.freeze({
  prince: Object.freeze([
    "calm",
    "affectionate",
    "alarmed",
    "doubtful",
    "injured",
    "enraged",
    "devastated",
    "resolved",
  ]),
  princess: Object.freeze([
    "human",
    "corrupt-1",
    "corrupt-2",
    "corrupt-3",
    "corrupt-4",
    "full",
    "affectionate",
    "frightened",
    "strained",
    "commanding",
    "possessive",
    "lucid",
    "triumphant",
    "final-plea",
  ]),
  witch: Object.freeze(["observing", "combat", "wounded", "acceptance"]),
});

const CURRENT_WAVE_FILE_PREFIX = Object.freeze({
  prince: "zephyr-c",
  princess: "elowen-a",
  witch: "witch-b",
});

const ACCEPTED_ASSETS = Object.freeze({
  "prince.determined": Object.freeze({
    characterId: "prince",
    state: "determined",
    path: publicAssetUrl("assets/vn/zephyr-c-determined.png"),
  }),
  "witch.clinical": Object.freeze({
    characterId: "witch",
    state: "clinical",
    path: publicAssetUrl("assets/vn/witch-b-clinical.png"),
  }),
  "witch.warning": Object.freeze({
    characterId: "witch",
    state: "warning",
    path: publicAssetUrl("assets/vn/witch-b-containment-gesture.png"),
  }),
});

const currentWaveAssets = Object.entries(CURRENT_WAVE_STATES).flatMap(([characterId, states]) => (
  states.map((state) => {
    const id = `${characterId}.${state}`;
    const fileState = characterId === "princess" && state === "full" ? "corrupt-full" : state;
    return [id, {
      id,
      characterId,
      state,
      path: publicAssetUrl(`assets/vn/characters/${CURRENT_WAVE_FILE_PREFIX[characterId]}-${fileState}.png`),
      source: "current-26-wave",
    }];
  })
));

const acceptedAssets = Object.entries(ACCEPTED_ASSETS).map(([id, asset]) => [id, {
  id,
  ...asset,
  source: "accepted-runtime",
}]);

export const CHARACTER_ART_ASSETS = deepFreeze(Object.fromEntries([
  ...currentWaveAssets,
  ...acceptedAssets,
]));

export const CHARACTER_ART_STATE_IDS = deepFreeze(Object.keys(CHARACTER_ART_ASSETS));

export const NARRATIVE_BACKGROUND_IDS = deepFreeze([
  "abyss-threshold-soft",
  "biome-abyss-graded",
  "biome-abyss-soft",
  "biome-catacomb-graded",
  "biome-catacomb-soft",
  "biome-charnel-graded",
  "biome-charnel-soft",
  "biome-containment-graded",
  "biome-containment-soft",
  "biome-crypt-graded",
  "biome-crypt-soft",
  "biome-depths-graded",
  "biome-depths-soft",
  "biome-ossuary-graded",
  "biome-ossuary-soft",
  "biome-ruins-graded",
  "biome-ruins-soft",
  "biome-sanctum-graded",
  "biome-sanctum-soft",
  "biome-vault-graded",
  "biome-vault-soft",
  "catacomb-threshold-soft",
  "charnel-threshold-soft",
  "containment-antechamber-soft",
  "containment-heart",
  "containment-heart-broken",
  "crypt-threshold-soft",
  "depths-threshold-soft",
  "dungeon-threshold",
  "ossuary-threshold-soft",
  "prison-collapse-quiet",
  "prison-collapse-violent",
  "prison-open-unstable",
  "ring-void",
  "royal-armory-morning",
  "royal-chamber-dawn",
  "royal-study-evening",
  "ruins-threshold-soft",
  "sanctum-threshold-soft",
  "vault-threshold-soft",
  "witch-domain-approach",
]);

const READY_BACKGROUND_PATHS = Object.freeze({
  "abyss-threshold-soft": publicAssetUrl("assets/vn/backgrounds/abyss-threshold-soft.png"),
  "royal-study-evening": publicAssetUrl("assets/vn/backgrounds/royal-study-evening.png"),
  "royal-chamber-dawn": publicAssetUrl("assets/vn/backgrounds/royal-chamber-dawn.png"),
  "royal-armory-morning": publicAssetUrl("assets/vn/backgrounds/royal-armory-morning.png"),
  "ring-void": publicAssetUrl("assets/vn/backgrounds/ring-void.png"),
  "dungeon-threshold": publicAssetUrl("assets/vn/backgrounds/dungeon-threshold.png"),
  "witch-domain-approach": publicAssetUrl("assets/vn/backgrounds/witch-domain-approach.png"),
  "containment-antechamber-soft": publicAssetUrl("assets/vn/backgrounds/containment-antechamber-soft.png"),
  "containment-heart": publicAssetUrl("assets/vn/backgrounds/containment-heart.png"),
  "containment-heart-broken": publicAssetUrl("assets/vn/backgrounds/containment-heart-broken.png"),
  "prison-collapse-quiet": publicAssetUrl("assets/vn/backgrounds/prison-collapse-quiet.png"),
  "prison-collapse-violent": publicAssetUrl("assets/vn/backgrounds/prison-collapse-violent.png"),
  "prison-open-unstable": publicAssetUrl("assets/vn/backgrounds/prison-open-unstable.png"),
  "biome-abyss-graded": publicAssetUrl("assets/vn/backgrounds/biome-abyss-graded.png"),
  "biome-abyss-soft": publicAssetUrl("assets/vn/backgrounds/biome-abyss-soft.png"),
  "biome-catacomb-graded": publicAssetUrl("assets/vn/backgrounds/biome-catacomb-graded.png"),
  "biome-catacomb-soft": publicAssetUrl("assets/vn/backgrounds/biome-catacomb-soft.png"),
  "biome-charnel-graded": publicAssetUrl("assets/vn/backgrounds/biome-charnel-graded.png"),
  "biome-charnel-soft": publicAssetUrl("assets/vn/backgrounds/biome-charnel-soft.png"),
  "biome-containment-graded": publicAssetUrl("assets/vn/backgrounds/biome-containment-graded.png"),
  "biome-containment-soft": publicAssetUrl("assets/vn/backgrounds/biome-containment-soft.png"),
  "biome-crypt-graded": publicAssetUrl("assets/vn/backgrounds/biome-crypt-graded.png"),
  "biome-crypt-soft": publicAssetUrl("assets/vn/backgrounds/biome-crypt-soft.png"),
  "biome-depths-graded": publicAssetUrl("assets/vn/backgrounds/depths-graded.png"),
  "biome-depths-soft": publicAssetUrl("assets/vn/backgrounds/depths-soft.png"),
  "biome-ossuary-graded": publicAssetUrl("assets/vn/backgrounds/ossuary-graded.png"),
  "biome-ossuary-soft": publicAssetUrl("assets/vn/backgrounds/ossuary-soft.png"),
  "biome-ruins-graded": publicAssetUrl("assets/vn/backgrounds/ruins-graded.png"),
  "biome-ruins-soft": publicAssetUrl("assets/vn/backgrounds/ruins-soft.png"),
  "biome-sanctum-graded": publicAssetUrl("assets/vn/backgrounds/sanctum-graded.png"),
  "biome-sanctum-soft": publicAssetUrl("assets/vn/backgrounds/sanctum-soft.png"),
  "biome-vault-graded": publicAssetUrl("assets/vn/backgrounds/vault-graded.png"),
  "biome-vault-soft": publicAssetUrl("assets/vn/backgrounds/vault-soft.png"),
  "catacomb-threshold-soft": publicAssetUrl("assets/vn/backgrounds/catacomb-threshold-soft.png"),
  "charnel-threshold-soft": publicAssetUrl("assets/vn/backgrounds/charnel-threshold-soft.png"),
  "crypt-threshold-soft": publicAssetUrl("assets/vn/backgrounds/crypt-threshold-soft.png"),
  "depths-threshold-soft": publicAssetUrl("assets/vn/backgrounds/depths-threshold-soft.png"),
  "ossuary-threshold-soft": publicAssetUrl("assets/vn/backgrounds/ossuary-threshold-soft.png"),
  "ruins-threshold-soft": publicAssetUrl("assets/vn/backgrounds/ruins-threshold-soft.png"),
  "sanctum-threshold-soft": publicAssetUrl("assets/vn/backgrounds/sanctum-threshold-soft.png"),
  "vault-threshold-soft": publicAssetUrl("assets/vn/backgrounds/vault-threshold-soft.png"),
});

export const NARRATIVE_BACKGROUND_ASSETS = deepFreeze(Object.fromEntries(
  NARRATIVE_BACKGROUND_IDS.map((id) => {
    const readyPath = READY_BACKGROUND_PATHS[id];
    return [id, {
      id,
      path: readyPath ?? publicAssetUrl(`assets/vn/backgrounds/${id}.png`),
      source: readyPath ? "accepted-background-wave" : "future-background-wave",
      ready: Boolean(readyPath),
    }];
  }),
));

function requireAsset(registry, id, label) {
  const asset = registry[id];
  if (!asset) throw new RangeError(`Unknown ${label}: ${id}`);
  return asset;
}

export function characterArtAsset(id) {
  return requireAsset(CHARACTER_ART_ASSETS, id, "narrative character art state");
}

export function narrativeBackgroundAsset(id) {
  return requireAsset(NARRATIVE_BACKGROUND_ASSETS, id, "narrative background");
}

export async function prepareNarrativeImage(path, createImage = () => new Image()) {
  if (typeof path !== "string" || path.length === 0) {
    throw new TypeError("Narrative image path must be a non-empty string.");
  }
  const image = createImage();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error(`Narrative image failed to load: ${path}`));
    image.src = path;
  });
  if (typeof image.decode === "function") await image.decode();
  if ("naturalWidth" in image && image.naturalWidth <= 0) {
    throw new Error(`Narrative image decoded without pixels: ${path}`);
  }
  image.onload = null;
  image.onerror = null;
  return image;
}

export async function decodeNarrativeImage(path, createImage = () => new Image()) {
  await prepareNarrativeImage(path, createImage);
  return path;
}

export class NarrativeImageReadinessCache {
  constructor({ maxEntries = 4, loader = decodeNarrativeImage } = {}) {
    if (!Number.isInteger(maxEntries) || maxEntries < 2) {
      throw new RangeError("Narrative image cache requires at least two entries.");
    }
    if (typeof loader !== "function") throw new TypeError("Narrative image loader must be a function.");
    this.maxEntries = maxEntries;
    this.loader = loader;
    this.entries = new Map();
  }

  load(path) {
    const cached = this.entries.get(path);
    if (cached) {
      this.entries.delete(path);
      this.entries.set(path, cached);
      return cached;
    }

    let promise;
    promise = Promise.resolve()
      .then(() => this.loader(path))
      .then(() => path)
      .catch((error) => {
        if (this.entries.get(path) === promise) this.entries.delete(path);
        throw error;
      });
    this.entries.set(path, promise);
    while (this.entries.size > this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value);
    }
    return promise;
  }

  prefetch(paths) {
    const nearTermPaths = [...new Set(paths.filter(Boolean))].slice(0, 2);
    return Promise.all(nearTermPaths.map((path) => this.load(path).catch(() => null)));
  }

  preloadScene(paths) {
    const scenePaths = [...new Set(paths.filter(Boolean))].slice(0, this.maxEntries);
    return Promise.all(scenePaths.map((path) => this.load(path).catch(() => null)));
  }

  cachedPaths() {
    return Object.freeze([...this.entries.keys()]);
  }
}
