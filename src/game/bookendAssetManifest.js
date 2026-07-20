import { publicAssetUrl } from "../publicAssetUrl.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const BOOKEND_SCENE_IMAGE_CACHE_LIMIT = 4;

export const BOOKEND_CHARACTER_ASSETS = deepFreeze({
  "prince.determined": {
    id: "prince.determined",
    characterId: "prince",
    path: publicAssetUrl("assets/vn/zephyr-c-determined.png"),
  },
  "prince.alarmed": {
    id: "prince.alarmed",
    characterId: "prince",
    path: publicAssetUrl("assets/vn/characters/zephyr-c-alarmed.png"),
  },
  "prince.devastated": {
    id: "prince.devastated",
    characterId: "prince",
    path: publicAssetUrl("assets/vn/characters/zephyr-c-devastated.png"),
  },
  "princess.corrupt-full": {
    id: "princess.corrupt-full",
    characterId: "princess",
    path: publicAssetUrl("assets/vn/characters/elowen-a-corrupt-full.png"),
  },
  "princess.final-plea": {
    id: "princess.final-plea",
    characterId: "princess",
    path: publicAssetUrl("assets/vn/characters/elowen-a-final-plea.png"),
  },
  "princess.lucid": {
    id: "princess.lucid",
    characterId: "princess",
    path: publicAssetUrl("assets/vn/characters/elowen-a-lucid.png"),
  },
  "princess.triumphant": {
    id: "princess.triumphant",
    characterId: "princess",
    path: publicAssetUrl("assets/vn/characters/elowen-a-triumphant.png"),
  },
});

export const BOOKEND_BACKGROUND_ASSETS = deepFreeze(Object.fromEntries(
  [
    "containment-heart-broken",
    "prison-collapse-quiet",
    "prison-collapse-violent",
    "prison-open-unstable",
    "ring-void",
    "witch-domain-approach",
  ].map((id) => [id, {
    id,
    path: publicAssetUrl(`assets/vn/backgrounds/${id}.png`),
  }]),
));

function requireAsset(registry, id, label) {
  const asset = registry[id];
  if (!asset) throw new RangeError(`Unknown ${label}: ${id}`);
  return asset;
}

export function bookendCharacterAsset(id) {
  return requireAsset(BOOKEND_CHARACTER_ASSETS, id, "bookend character art state");
}

export function bookendBackgroundAsset(id) {
  return requireAsset(BOOKEND_BACKGROUND_ASSETS, id, "bookend background");
}

export async function prepareBookendImage(path, createImage = () => new Image()) {
  if (typeof path !== "string" || path.length === 0) {
    throw new TypeError("Bookend image path must be a non-empty string.");
  }
  const image = createImage();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error(`Bookend image failed to load: ${path}`));
    image.src = path;
  });
  if (typeof image.decode === "function") await image.decode();
  if ("naturalWidth" in image && image.naturalWidth <= 0) {
    throw new Error(`Bookend image decoded without pixels: ${path}`);
  }
  image.onload = null;
  image.onerror = null;
  return image;
}

export class BookendImageCache {
  constructor({ maxEntries = BOOKEND_SCENE_IMAGE_CACHE_LIMIT, loader = prepareBookendImage } = {}) {
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
    promise = Promise.resolve().then(() => this.loader(path)).catch((error) => {
      if (this.entries.get(path) === promise) this.entries.delete(path);
      throw error;
    });
    this.entries.set(path, promise);
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value);
    return promise;
  }

  preload(paths) {
    return Promise.all([...new Set(paths.filter(Boolean))]
      .slice(0, this.maxEntries)
      .map((path) => this.load(path).catch(() => null)));
  }
}
