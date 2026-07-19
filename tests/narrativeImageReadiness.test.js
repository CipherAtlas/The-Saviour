import assert from "node:assert/strict";
import test from "node:test";
import {
  characterArtAsset,
  decodeNarrativeImage,
  narrativeBackgroundAsset,
  NarrativeImageReadinessCache,
  NARRATIVE_SCENE_IMAGE_CACHE_LIMIT,
  prepareNarrativeImage,
} from "../src/game/narrativeAssetManifest.js";
import { NARRATIVE_SEQUENCES } from "../src/game/dialogueContent.js";

test("narrative image cache reuses promises and evicts least-recently-used paths", async () => {
  const loads = [];
  const cache = new NarrativeImageReadinessCache({
    maxEntries: 2,
    loader: async (path) => { loads.push(path); },
  });

  const first = cache.load("/a.png");
  assert.equal(cache.load("/a.png"), first);
  await first;
  await cache.load("/b.png");
  await cache.load("/a.png");
  await cache.load("/c.png");

  assert.deepEqual(loads, ["/a.png", "/b.png", "/c.png"]);
  assert.deepEqual(cache.cachedPaths(), ["/a.png", "/c.png"]);
});

test("near-term prefetch accepts only two unique paths and contains failures", async () => {
  const loads = [];
  const cache = new NarrativeImageReadinessCache({
    maxEntries: 4,
    loader: async (path) => {
      loads.push(path);
      if (path === "/bad.png") throw new Error("bad image");
    },
  });

  await cache.prefetch(["/next-background.png", "/next-cutout.png", "/too-far.png"]);
  await cache.prefetch(["/bad.png"]);
  assert.deepEqual(loads, ["/next-background.png", "/next-cutout.png", "/bad.png"]);
  assert.equal(cache.cachedPaths().includes("/bad.png"), false);
});

test("scene preload covers the bounded unique scene working set", async () => {
  const loads = [];
  const cache = new NarrativeImageReadinessCache({
    maxEntries: 4,
    loader: async (path) => { loads.push(path); },
  });

  await cache.preloadScene(["/a.png", "/b.png", "/a.png", "/c.png", "/d.png", "/too-far.png"]);
  assert.deepEqual(loads, ["/a.png", "/b.png", "/c.png", "/d.png"]);
  assert.deepEqual(cache.cachedPaths(), ["/a.png", "/b.png", "/c.png", "/d.png"]);
});

test("every shipped VN scene fits completely inside the scene image cache", () => {
  for (const [sequenceId, sequence] of Object.entries(NARRATIVE_SEQUENCES)) {
    const paths = new Set(sequence.beats.flatMap((beat) => [
      narrativeBackgroundAsset(beat.background).path,
      characterArtAsset(beat.artState).path,
    ]));
    assert.ok(
      paths.size <= NARRATIVE_SCENE_IMAGE_CACHE_LIMIT,
      `${sequenceId} needs ${paths.size} unique images; cache limit is ${NARRATIVE_SCENE_IMAGE_CACHE_LIMIT}`,
    );
  }
});

test("image readiness waits for both load and decode and rejects decode failures", async () => {
  let decodeCalls = 0;
  const createImage = () => ({
    naturalWidth: 64,
    set src(_path) { queueMicrotask(() => this.onload()); },
    async decode() { decodeCalls += 1; },
  });
  assert.equal(await decodeNarrativeImage("/ready.png", createImage), "/ready.png");
  assert.equal(decodeCalls, 1);

  const prepared = createImage();
  assert.equal(await prepareNarrativeImage("/prepared.png", () => prepared), prepared);
  assert.equal(decodeCalls, 2);

  await assert.rejects(
    decodeNarrativeImage("/decode-fails.png", () => ({
      naturalWidth: 64,
      set src(_path) { queueMicrotask(() => this.onload()); },
      async decode() { throw new Error("decode failed"); },
    })),
    /decode failed/,
  );
});
