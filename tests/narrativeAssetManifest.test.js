import assert from "node:assert/strict";
import test from "node:test";
import {
  CHARACTER_ART_ASSETS,
  CHARACTER_ART_STATE_IDS,
  NARRATIVE_BACKGROUND_ASSETS,
  NARRATIVE_BACKGROUND_IDS,
  characterArtAsset,
  narrativeBackgroundAsset,
} from "../src/game/narrativeAssetManifest.js";

const EXPECTED_CHARACTER_STATES = Object.freeze([
  "prince.calm",
  "prince.affectionate",
  "prince.alarmed",
  "prince.doubtful",
  "prince.injured",
  "prince.enraged",
  "prince.devastated",
  "prince.resolved",
  "princess.human",
  "princess.corrupt-1",
  "princess.corrupt-2",
  "princess.corrupt-3",
  "princess.corrupt-4",
  "princess.full",
  "princess.affectionate",
  "princess.frightened",
  "princess.strained",
  "princess.commanding",
  "princess.possessive",
  "princess.lucid",
  "princess.triumphant",
  "princess.final-plea",
  "witch.observing",
  "witch.combat",
  "witch.wounded",
  "witch.acceptance",
  "prince.determined",
  "witch.clinical",
  "witch.warning",
]);

const EXPECTED_BACKGROUNDS = Object.freeze([
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

function assertDeepFrozen(value) {
  if (!value || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}

test("the character manifest contains exactly the approved twenty-nine states", () => {
  assert.deepEqual(CHARACTER_ART_STATE_IDS, EXPECTED_CHARACTER_STATES);
  assert.deepEqual(Object.keys(CHARACTER_ART_ASSETS), EXPECTED_CHARACTER_STATES);
  assert.equal(CHARACTER_ART_STATE_IDS.length, 29);
  assert.equal(new Set(CHARACTER_ART_STATE_IDS).size, 29);

  const currentWave = Object.values(CHARACTER_ART_ASSETS).filter((asset) => asset.source === "current-26-wave");
  const acceptedRuntime = Object.values(CHARACTER_ART_ASSETS).filter((asset) => asset.source === "accepted-runtime");
  assert.equal(currentWave.length, 26);
  assert.equal(acceptedRuntime.length, 3);

  for (const asset of currentWave) {
    const prefix = asset.characterId === "prince"
      ? "zephyr-c"
      : asset.characterId === "princess"
        ? "elowen-a"
        : "witch-b";
    const fileState = asset.id === "princess.full" ? "corrupt-full" : asset.state;
    assert.equal(asset.path, `/assets/vn/characters/${prefix}-${fileState}.png`);
  }

  assert.equal(CHARACTER_ART_ASSETS["prince.determined"].path, "/assets/vn/zephyr-c-determined.png");
  assert.equal(CHARACTER_ART_ASSETS["witch.clinical"].path, "/assets/vn/witch-b-clinical.png");
  assert.equal(CHARACTER_ART_ASSETS["witch.warning"].path, "/assets/vn/witch-b-containment-gesture.png");
});

test("all forty-one backgrounds use exact paths and only inspected production waves are ready", () => {
  assert.deepEqual(NARRATIVE_BACKGROUND_IDS, EXPECTED_BACKGROUNDS);
  assert.deepEqual(Object.keys(NARRATIVE_BACKGROUND_ASSETS), EXPECTED_BACKGROUNDS);
  assert.equal(NARRATIVE_BACKGROUND_IDS.length, 41);
  assert.equal(new Set(NARRATIVE_BACKGROUND_IDS).size, 41);

  const acceptedStoryIds = [
    "royal-study-evening",
    "royal-chamber-dawn",
    "royal-armory-morning",
    "ring-void",
    "dungeon-threshold",
    "witch-domain-approach",
    "containment-antechamber-soft",
    "containment-heart",
    "containment-heart-broken",
    "prison-collapse-quiet",
    "prison-collapse-violent",
    "prison-open-unstable",
  ];
  const acceptedIds = EXPECTED_BACKGROUNDS.filter((id) => (
    id.startsWith("biome-") || id.endsWith("-threshold-soft")
  )).concat(acceptedStoryIds);
  assert.equal(acceptedIds.length, 41);
  for (const [id, asset] of Object.entries(NARRATIVE_BACKGROUND_ASSETS)) {
    const ready = acceptedIds.includes(id);
    const unprefixedFile = id.match(/^biome-(depths|ossuary|ruins|sanctum|vault)-(.+)$/)?.slice(1).join("-");
    assert.deepEqual(asset, {
      id,
      path: `/assets/vn/backgrounds/${unprefixedFile ?? id}.png`,
      source: ready ? "accepted-background-wave" : "future-background-wave",
      ready,
    });
  }
});

test("asset lookup is exact and has no legacy or blocked fallback", () => {
  assert.equal(characterArtAsset("prince.determined"), CHARACTER_ART_ASSETS["prince.determined"]);
  assert.equal(narrativeBackgroundAsset("dungeon-threshold"), NARRATIVE_BACKGROUND_ASSETS["dungeon-threshold"]);
  assert.throws(() => characterArtAsset("determined"), /Unknown narrative character art state/);
  assert.throws(() => characterArtAsset("prince.determine"), /Unknown narrative character art state/);
  assert.throws(() => narrativeBackgroundAsset("floor01-witch-projection-bg"), /Unknown narrative background/);

  const serialized = JSON.stringify({ CHARACTER_ART_ASSETS, NARRATIVE_BACKGROUND_ASSETS });
  assert.doesNotMatch(serialized, /princess-portrait|evil-queen-portrait|floor01-witch-projection-bg/);
  assertDeepFrozen(CHARACTER_ART_STATE_IDS);
  assertDeepFrozen(CHARACTER_ART_ASSETS);
  assertDeepFrozen(NARRATIVE_BACKGROUND_IDS);
  assertDeepFrozen(NARRATIVE_BACKGROUND_ASSETS);
});
